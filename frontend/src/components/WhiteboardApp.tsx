import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  CanvasNode,
  CanvasEdge,
  ToolType,
  RenderMode,
  UserAwareness,
  LaserPoint,
  BoundingBox,
  ConnectionSide,
  ResizeHandle,
  FillStyle,
} from '../types/canvas';
import {
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
  getZoomToFitCamera,
  generateHexId,
} from '../engine/camera';
import { SpatialIndex, getNodeBoundingBox } from '../engine/spatialIndex';
import {
  renderNode,
  renderEdge,
  drawGrid,
  drawMagneticPorts,
  renderSelectionOverlay,
  renderLaser,
  renderRemoteCursors,
  getAnchorPoint,
} from '../engine/renderer';
import { YjsStore } from '../store/yjsStore';
import {
  exportCanvasFile,
  parseCanvasFile,
  exportCanvasToPNG,
  exportPageToSVG,
  downloadFile,
  getAllNodesBounds,
} from '../engine/export';
import { StudioHeader } from './StudioHeader';
import { Toolbar } from './Toolbar';
import { RulerOverlay } from './RulerOverlay';
import { BottomTelemetryBar } from './BottomTelemetryBar';
import { SelectionInspector } from './SelectionInspector';
import { ShareModal } from './ShareModal';

interface WhiteboardAppProps {
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  roomId?: string;
  readOnly?: boolean;
}

export const WhiteboardApp: React.FC<WhiteboardAppProps> = ({
  theme: propTheme = 'light',
  onToggleTheme,
  roomId: propRoomId,
  readOnly: propReadOnly = false,
}) => {
  // Query params extraction (e.g. ?room=abc&role=view)
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = propRoomId || urlParams.get('room') || 'precision-studio';
  const role = (urlParams.get('role') as 'edit' | 'view') || (propReadOnly ? 'view' : 'edit');
  const isReadOnly = role === 'view';

  // Visual Theme: Drafting Vellum (light) vs Obsidian Studio (dark)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('gfg_theme') as 'light' | 'dark') || propTheme;
  });

  const toggleLocalTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('gfg_theme', next);
    if (onToggleTheme) onToggleTheme();
  };

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Engine state
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [globalRenderMode, setGlobalRenderMode] = useState<RenderMode>('precision');
  const [strokeColor, setStrokeColor] = useState<string>('#059669');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Live Cursor Telemetry (Screen & World coordinates)
  const [cursorScreenPos, setCursorScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorWorldPos, setCursorWorldPos] = useState<{ x: number; y: number } | null>(null);

  // Board Title
  const [boardTitle, setBoardTitle] = useState<string>('Untitled Studio Diagram');

  // Multi-Page state
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [activePageId, setActivePageId] = useState<string>('page-1');

  // Selection & Interactions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredAnchor, setHoveredAnchor] = useState<{ nodeId: string; side: ConnectionSide } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<BoundingBox | null>(null);

  // Laser Pointer & Multiplayer Awareness
  const [laserPoints, setLaserPoints] = useState<LaserPoint[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<UserAwareness[]>([]);
  const [isFollowingPresenter, setIsFollowingPresenter] = useState<boolean>(false);
  const [isPresenter, setIsPresenter] = useState<boolean>(false);

  // Inline Text Editor
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Modals
  const [shareOpen, setShareOpen] = useState(false);

  // Yjs Store & Spatial Index references
  const storeRef = useRef<YjsStore | null>(null);
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());

  // Interaction tracking refs
  const isInteractingRef = useRef<boolean>(false);
  const interactionStartRef = useRef<{ screenX: number; screenY: number; worldX: number; worldY: number }>({
    screenX: 0,
    screenY: 0,
    worldX: 0,
    worldY: 0,
  });
  const spacebarHeldRef = useRef<boolean>(false);
  const freehandPointsRef = useRef<number[][]>([]);
  const initialNodesStateRef = useRef<Record<string, CanvasNode>>({});

  // 1. Initialize Yjs Store
  useEffect(() => {
    const store = new YjsStore({ roomId, role });
    storeRef.current = store;

    const initialPage = store.ensureDefaultPage();
    setActivePageId(initialPage);
    setPages(store.getAllPages());

    // Subscription for doc changes
    const unsubDoc = store.subscribe(() => {
      setPages(store.getAllPages());
      triggerRender();
    });

    // Subscription for awareness changes
    const unsubAwareness = store.subscribeAwareness((users) => {
      setRemoteUsers(users);
    });

    return () => {
      unsubDoc();
      unsubAwareness();
      store.destroy();
    };
  }, [roomId, role]);

  // Trigger repaint
  const [, setRepaintCount] = useState(0);
  const triggerRender = useCallback(() => {
    setRepaintCount((c) => (c + 1) % 10000);
  }, []);

  // Update spatial index whenever active page data changes
  useEffect(() => {
    if (!storeRef.current) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const edges = storeRef.current.getPageEdges(activePageId);
    spatialIndexRef.current.rebuild(nodes, edges);
  }, [activePageId, triggerRender]);

  // Handle "Follow Presenter" camera lerp loop
  useEffect(() => {
    if (!isFollowingPresenter) return;

    const presenter = remoteUsers.find((u) => u.isPresenter && u.viewport);
    if (presenter && presenter.viewport) {
      const target = presenter.viewport;
      setCamera((prev) => ({
        x: prev.x + (target.x - prev.x) * 0.2,
        y: prev.y + (target.y - prev.y) * 0.2,
        zoom: prev.zoom + (target.zoom - prev.zoom) * 0.2,
      }));
    }
  }, [remoteUsers, isFollowingPresenter]);

  // 2. Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Canvas Background Surface:
    // Light Mode: Studio Paper #F7F7F5
    // Dark Mode: Carbon Studio #0B0E14
    ctx.fillStyle = theme === 'dark' ? '#0B0E14' : '#F7F7F5';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Dot Matrix Background Grid
    if (showGrid) {
      drawGrid(ctx, camera, rect.width, rect.height, theme);
    }

    // World Transform
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    const store = storeRef.current;
    const nodes = store ? store.getPageNodes(activePageId) : {};
    const edges = store ? store.getPageEdges(activePageId) : {};

    const renderCtx = {
      ctx,
      camera,
      theme,
      globalRenderMode,
      selectedIds,
      hoveredAnchor,
      laserPoints,
      remoteUsers,
      currentPageId: activePageId,
      marqueeBox,
      dpr,
    };

    // Render Edges
    for (const edge of Object.values(edges)) {
      renderEdge(edge, nodes, null, renderCtx);
    }

    // Render Nodes
    for (const node of Object.values(nodes)) {
      renderNode(node, null, renderCtx);

      // Magnetic Anchor Ports when connecting
      if ((activeTool === 'arrow' || activeTool === 'line') && node._ext?.shape) {
        drawMagneticPorts(node, ctx, hoveredAnchor?.side, theme);
      }
    }

    // Live Freehand Pen Stroke
    if (activeTool === 'pen' && freehandPointsRef.current.length > 1) {
      const liveNode: CanvasNode = {
        id: 'temp-live',
        type: 'shape',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        _ext: {
          freehandPoints: freehandPointsRef.current,
          strokeWidth,
          strokeColor,
        },
      };
      renderNode(liveNode, rc, renderCtx);
    }

    // Selection Bounding Box with Circular Resize Handles
    if (selectedIds.size > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const id of selectedIds) {
        const node = nodes[id];
        if (node) {
          const b = getNodeBoundingBox(node);
          minX = Math.min(minX, b.minX);
          minY = Math.min(minY, b.minY);
          maxX = Math.max(maxX, b.maxX);
          maxY = Math.max(maxY, b.maxY);
        }
      }

      if (minX !== Infinity) {
        renderSelectionOverlay({ minX, minY, maxX, maxY }, ctx, camera, theme);
      }
    }

    // Marquee Drag Selection Box
    if (marqueeBox) {
      ctx.save();
      const emerald = theme === 'dark' ? '#10B981' : '#059669';
      ctx.strokeStyle = emerald;
      ctx.fillStyle = theme === 'dark' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(5, 150, 105, 0.1)';
      ctx.lineWidth = 1 / camera.zoom;
      ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
      const w = marqueeBox.maxX - marqueeBox.minX;
      const h = marqueeBox.maxY - marqueeBox.minY;
      ctx.fillRect(marqueeBox.minX, marqueeBox.minY, w, h);
      ctx.strokeRect(marqueeBox.minX, marqueeBox.minY, w, h);
      ctx.restore();
    }

    // Fading Laser Pointer Trail
    renderLaser(laserPoints, ctx);

    // Remote Multiplayer Cursors
    renderRemoteCursors(remoteUsers, ctx, activePageId, camera);

    ctx.restore(); // Undo Camera transform
    ctx.restore(); // Undo DPR scale
  });

  // Laser decay animation frame loop
  useEffect(() => {
    if (laserPoints.length === 0) return;
    const interval = requestAnimationFrame(() => {
      const now = Date.now();
      setLaserPoints((prev) => prev.filter((p) => now - p.time < 1200));
      triggerRender();
    });
    return () => cancelAnimationFrame(interval);
  }, [laserPoints, triggerRender]);

  // 3. Pointer & Mouse Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY, camera);

    isInteractingRef.current = true;
    interactionStartRef.current = {
      screenX,
      screenY,
      worldX: worldPos.x,
      worldY: worldPos.y,
    };

    // Pan with spacebar or middle mouse
    if (spacebarHeldRef.current || e.button === 1) {
      return;
    }

    if (isReadOnly) return;

    // Laser pointer tool
    if (activeTool === 'laser') {
      setLaserPoints([{ x: worldPos.x, y: worldPos.y, time: Date.now() }]);
      return;
    }

    // Freehand pen tool
    if (activeTool === 'pen') {
      freehandPointsRef.current = [[worldPos.x, worldPos.y, e.pressure || 0.5]];
      return;
    }

    // Select Tool Hit Testing
    if (activeTool === 'select') {
      const hits = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 8);
      if (hits.length > 0) {
        const topHitId = hits[hits.length - 1].id;
        if (e.shiftKey) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(topHitId)) next.delete(topHitId);
            else next.add(topHitId);
            return next;
          });
        } else if (!selectedIds.has(topHitId)) {
          setSelectedIds(new Set([topHitId]));
        }

        if (storeRef.current) {
          initialNodesStateRef.current = storeRef.current.getPageNodes(activePageId);
        }
      } else {
        // Clicked empty space
        if (!e.shiftKey) {
          setSelectedIds(new Set());
        }
        setMarqueeBox({
          minX: worldPos.x,
          minY: worldPos.y,
          maxX: worldPos.x,
          maxY: worldPos.y,
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY, camera);

    // Update live cursor coordinates for rulers and telemetry HUD
    setCursorScreenPos({ x: screenX, y: screenY });
    setCursorWorldPos(worldPos);

    // Broadcast cursor position to peers via Yjs awareness
    if (storeRef.current) {
      storeRef.current.updateLocalCursor(worldPos, activePageId, camera, isPresenter);
    }

    // Spacebar / Middle mouse drag panning
    if (isInteractingRef.current && (spacebarHeldRef.current || e.buttons === 4)) {
      const dx = screenX - interactionStartRef.current.screenX;
      const dy = screenY - interactionStartRef.current.screenY;
      setCamera((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      interactionStartRef.current.screenX = screenX;
      interactionStartRef.current.screenY = screenY;
      return;
    }

    if (!isInteractingRef.current) {
      // Hover detection for magnetic anchor ports
      if (activeTool === 'arrow' || activeTool === 'line') {
        const hits = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 18);
        const nodeHit = hits.find((h) => h.kind === 'node');
        if (nodeHit && storeRef.current) {
          const node = storeRef.current.getPageNodes(activePageId)[nodeHit.id];
          if (node && node._ext?.shape) {
            const sides: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];
            let closestSide: ConnectionSide = 'right';
            let minDist = Infinity;
            for (const s of sides) {
              const pt = getAnchorPoint(node, s);
              const dist = Math.hypot(pt.x - worldPos.x, pt.y - worldPos.y);
              if (dist < minDist) {
                minDist = dist;
                closestSide = s;
              }
            }
            setHoveredAnchor({ nodeId: node.id, side: closestSide });
            triggerRender();
            return;
          }
        }
        setHoveredAnchor(null);
      }
      return;
    }

    if (isReadOnly) return;

    // Laser pointer move
    if (activeTool === 'laser') {
      setLaserPoints((prev) => [...prev, { x: worldPos.x, y: worldPos.y, time: Date.now() }]);
      return;
    }

    // Freehand pen move
    if (activeTool === 'pen') {
      freehandPointsRef.current.push([worldPos.x, worldPos.y, e.pressure || 0.5]);
      triggerRender();
      return;
    }

    // Eraser drag
    if (activeTool === 'eraser' && storeRef.current) {
      const hits = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 16);
      if (hits.length > 0) {
        const nodeIds = hits.filter((h) => h.kind === 'node').map((h) => h.id);
        const edgeIds = hits.filter((h) => h.kind === 'edge').map((h) => h.id);
        if (nodeIds.length > 0) storeRef.current.deleteNodes(activePageId, nodeIds);
        for (const eId of edgeIds) storeRef.current.deleteEdge(activePageId, eId);
      }
      return;
    }

    // Marquee box selection drag
    if (activeTool === 'select' && marqueeBox) {
      const minX = Math.min(interactionStartRef.current.worldX, worldPos.x);
      const minY = Math.min(interactionStartRef.current.worldY, worldPos.y);
      const maxX = Math.max(interactionStartRef.current.worldX, worldPos.x);
      const maxY = Math.max(interactionStartRef.current.worldY, worldPos.y);
      setMarqueeBox({ minX, minY, maxX, maxY });

      const hits = spatialIndexRef.current.queryBox({ minX, minY, maxX, maxY });
      const foundNodeIds = hits.filter((h) => h.kind === 'node').map((h) => h.id);
      setSelectedIds(new Set(foundNodeIds));
      return;
    }

    // Drag-to-move selected elements
    if (activeTool === 'select' && selectedIds.size > 0 && storeRef.current) {
      const dx = worldPos.x - interactionStartRef.current.worldX;
      const dy = worldPos.y - interactionStartRef.current.worldY;
      const initial = initialNodesStateRef.current;

      const updatedNodes: CanvasNode[] = [];
      for (const id of selectedIds) {
        const orig = initial[id];
        if (orig) {
          if (orig._ext?.freehandPoints) {
            const shiftedPoints = orig._ext.freehandPoints.map((pt) => [
              pt[0] + dx,
              pt[1] + dy,
              pt[2] ?? 0.5,
            ]);
            updatedNodes.push({
              ...orig,
              x: orig.x + dx,
              y: orig.y + dy,
              _ext: { ...orig._ext, freehandPoints: shiftedPoints },
            });
          } else {
            updatedNodes.push({
              ...orig,
              x: orig.x + dx,
              y: orig.y + dy,
            });
          }
        }
      }

      if (updatedNodes.length > 0) {
        storeRef.current.setNodes(activePageId, updatedNodes);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isInteractingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !storeRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY, camera);
    const startWorld = interactionStartRef.current;

    if (marqueeBox) {
      setMarqueeBox(null);
    }

    if (isReadOnly) return;

    // Freehand Pen completion
    if (activeTool === 'pen' && freehandPointsRef.current.length > 1) {
      const points = [...freehandPointsRef.current];
      freehandPointsRef.current = [];
      const newNode: CanvasNode = {
        id: generateHexId(),
        type: 'shape',
        x: points[0][0],
        y: points[0][1],
        width: 10,
        height: 10,
        color: strokeColor,
        _ext: {
          freehandPoints: points,
          strokeWidth,
          strokeColor,
          renderMode: globalRenderMode,
        },
      };
      storeRef.current.setNode(activePageId, newNode);
      return;
    }

    // Shape Creation Completion (Rectangle, Diamond, Ellipse, Text)
    if (['rectangle', 'diamond', 'ellipse', 'text'].includes(activeTool)) {
      const w = Math.abs(worldPos.x - startWorld.worldX);
      const h = Math.abs(worldPos.y - startWorld.worldY);
      const minX = Math.min(startWorld.worldX, worldPos.x);
      const minY = Math.min(startWorld.worldY, worldPos.y);

      const width = Math.max(activeTool === 'text' ? 140 : 40, w);
      const height = Math.max(activeTool === 'text' ? 50 : 40, h);

      const newNode: CanvasNode = {
        id: generateHexId(),
        type: activeTool === 'text' ? 'text' : 'shape',
        x: minX,
        y: minY,
        width,
        height,
        color: strokeColor,
        text: activeTool === 'text' ? 'Text label' : '',
        _ext: {
          shape: activeTool === 'text' ? 'rectangle' : (activeTool as any),
          strokeWidth,
          strokeColor,
          renderMode: globalRenderMode,
          seed: Math.floor(Math.random() * 100000),
          roughness: 1,
        },
      };

      storeRef.current.setNode(activePageId, newNode);
      setSelectedIds(new Set([newNode.id]));

      if (activeTool === 'text') {
        setEditingNodeId(newNode.id);
        setEditingText('');
      }

      setActiveTool('select');
      return;
    }

    // Smart Magnetic Arrow / Line Creation
    if (activeTool === 'arrow' || activeTool === 'line') {
      const hitsStart = spatialIndexRef.current.hitTest(startWorld.worldX, startWorld.worldY, 20);
      const hitsEnd = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 20);
      const fromNodeHit = hitsStart.find((h) => h.kind === 'node');
      const toNodeHit = hitsEnd.find((h) => h.kind === 'node');

      if (fromNodeHit && toNodeHit && fromNodeHit.id !== toNodeHit.id) {
        const newEdge: CanvasEdge = {
          id: generateHexId(),
          fromNode: fromNodeHit.id,
          fromSide: 'right',
          toNode: toNodeHit.id,
          toSide: 'left',
          toEnd: activeTool === 'arrow' ? 'arrow' : 'none',
          color: strokeColor,
          label: '',
          _ext: {
            renderMode: globalRenderMode,
            strokeWidth,
          },
        };
        storeRef.current.setEdge(activePageId, newEdge);
      } else {
        const newEdge: CanvasEdge = {
          id: generateHexId(),
          fromNode: fromNodeHit?.id || 'origin',
          toNode: toNodeHit?.id || 'target',
          toEnd: activeTool === 'arrow' ? 'arrow' : 'none',
          color: strokeColor,
          _ext: {
            renderMode: globalRenderMode,
            strokeWidth,
            points: [
              [startWorld.worldX, startWorld.worldY],
              [worldPos.x, worldPos.y],
            ],
          },
        };
        storeRef.current.setEdge(activePageId, newEdge);
      }

      setActiveTool('select');
    }
  };

  // 4. Double Click for Inline Text Editing
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isReadOnly) return;
    const canvas = canvasRef.current;
    if (!canvas || !storeRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY, camera);

    const hits = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 8);
    const nodeHit = hits.find((h) => h.kind === 'node');
    if (nodeHit) {
      const node = storeRef.current.getPageNodes(activePageId)[nodeHit.id];
      if (node) {
        setEditingNodeId(node.id);
        setEditingText(node.text || '');
        return;
      }
    }

    const edgeHit = hits.find((h) => h.kind === 'edge');
    if (edgeHit) {
      const edge = storeRef.current.getPageEdges(activePageId)[edgeHit.id];
      if (edge) {
        const newLabel = window.prompt('Edit Connector Label:', edge.label || '');
        if (newLabel !== null) {
          storeRef.current.setEdge(activePageId, { ...edge, label: newLabel });
        }
      }
    }
  };

  const handleSaveText = () => {
    if (editingNodeId && storeRef.current) {
      const node = storeRef.current.getPageNodes(activePageId)[editingNodeId];
      if (node) {
        storeRef.current.setNode(activePageId, {
          ...node,
          text: editingText,
        });
      }
    }
    setEditingNodeId(null);
  };

  // 5. Trackpad Pinch-to-Zoom & Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = Math.pow(0.992, e.deltaY);
      setCamera((c) => zoomAtScreenPoint(c, screenX, screenY, zoomFactor));
    } else {
      setCamera((c) => ({
        ...c,
        x: c.x - e.deltaX,
        y: c.y - e.deltaY,
      }));
    }
  };

  // 6. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingNodeId || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        spacebarHeldRef.current = true;
      }

      // Zoom to Fit: Shift + 1
      if (e.shiftKey && e.key === '!') {
        e.preventDefault();
        handleZoomToFit();
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        storeRef.current?.undo();
      }

      // Redo: Ctrl+Y / Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        storeRef.current?.redo();
      }

      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      }

      // Delete selected: Backspace / Delete
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }

      // Tool shortcuts
      const key = e.key.toUpperCase();
      if (key === 'V') setActiveTool('select');
      if (key === 'R') setActiveTool('rectangle');
      if (key === 'D') setActiveTool('diamond');
      if (key === 'O') setActiveTool('ellipse');
      if (key === 'A') setActiveTool('arrow');
      if (key === 'L') setActiveTool('line');
      if (key === 'P') setActiveTool('pen');
      if (key === 'E') setActiveTool('eraser');
      if (key === 'T') setActiveTool('text');
      if (key === 'K') setActiveTool('laser');
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacebarHeldRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingNodeId, selectedIds, activePageId]);

  // Contextual Selection Operations
  const handleDuplicateSelected = () => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const newSelected = new Set<string>();
    const clonedNodes: CanvasNode[] = [];

    for (const id of selectedIds) {
      const orig = nodes[id];
      if (orig) {
        const newId = generateHexId();
        newSelected.add(newId);
        clonedNodes.push({
          ...orig,
          id: newId,
          x: orig.x + 24,
          y: orig.y + 24,
          _ext: orig._ext ? { ...orig._ext, seed: Math.floor(Math.random() * 100000) } : undefined,
        });
      }
    }

    if (clonedNodes.length > 0) {
      storeRef.current.setNodes(activePageId, clonedNodes);
      setSelectedIds(newSelected);
    }
  };

  const handleDeleteSelected = () => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    storeRef.current.deleteNodes(activePageId, Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleChangeSelectedColor = (color: string) => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const updated: CanvasNode[] = [];
    for (const id of selectedIds) {
      const n = nodes[id];
      if (n) {
        updated.push({
          ...n,
          color,
          _ext: { ...n._ext, strokeColor: color },
        });
      }
    }
    if (updated.length > 0) storeRef.current.setNodes(activePageId, updated);
  };

  const handleChangeSelectedStrokeWidth = (strokeWidth: number) => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const updated: CanvasNode[] = [];
    for (const id of selectedIds) {
      const n = nodes[id];
      if (n) {
        updated.push({
          ...n,
          _ext: { ...n._ext, strokeWidth },
        });
      }
    }
    if (updated.length > 0) storeRef.current.setNodes(activePageId, updated);
  };

  const handleChangeSelectedFillStyle = (fillStyle: FillStyle) => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const updated: CanvasNode[] = [];
    for (const id of selectedIds) {
      const n = nodes[id];
      if (n) {
        updated.push({
          ...n,
          _ext: {
            ...n._ext,
            fillStyle,
            backgroundColor: fillStyle === 'none' ? 'transparent' : (n.color || strokeColor),
          },
        });
      }
    }
    if (updated.length > 0) storeRef.current.setNodes(activePageId, updated);
  };

  const handleChangeSelectedRenderMode = (renderMode: RenderMode) => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const updated: CanvasNode[] = [];
    for (const id of selectedIds) {
      const n = nodes[id];
      if (n) {
        updated.push({
          ...n,
          _ext: { ...n._ext, renderMode },
        });
      }
    }
    if (updated.length > 0) storeRef.current.setNodes(activePageId, updated);
  };

  // Zoom Helpers
  const handleZoomIn = () => {
    if (!canvasRef.current) return;
    const cx = canvasRef.current.clientWidth / 2;
    const cy = canvasRef.current.clientHeight / 2;
    setCamera((c) => zoomAtScreenPoint(c, cx, cy, 1.25));
  };

  const handleZoomOut = () => {
    if (!canvasRef.current) return;
    const cx = canvasRef.current.clientWidth / 2;
    const cy = canvasRef.current.clientHeight / 2;
    setCamera((c) => zoomAtScreenPoint(c, cx, cy, 0.8));
  };

  const handleZoomToFit = () => {
    if (storeRef.current && canvasRef.current) {
      const nodes = storeRef.current.getPageNodes(activePageId);
      const bounds = getAllNodesBounds(nodes);
      setCamera(
        getZoomToFitCamera(
          bounds,
          canvasRef.current.clientWidth,
          canvasRef.current.clientHeight
        )
      );
    }
  };

  const handleResetZoom = () => {
    if (!canvasRef.current) return;
    const cx = canvasRef.current.clientWidth / 2;
    const cy = canvasRef.current.clientHeight / 2;
    setCamera((c) => ({
      x: cx - (cx - c.x) / c.zoom,
      y: cy - (cy - c.y) / c.zoom,
      zoom: 1,
    }));
  };

  // Calculate Selection Bounding Box for Contextual Inspector
  const activeNodes = storeRef.current ? storeRef.current.getPageNodes(activePageId) : {};
  const selectedNodesList: CanvasNode[] = [];
  let selectionBounds: BoundingBox | null = null;

  if (selectedIds.size > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const id of selectedIds) {
      const n = activeNodes[id];
      if (n) {
        selectedNodesList.push(n);
        const b = getNodeBoundingBox(n);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
      }
    }

    if (minX !== Infinity) {
      selectionBounds = { minX, minY, maxX, maxY };
    }
  }

  // Active editing node screen position for inline text
  const activeEditingNode = editingNodeId ? activeNodes[editingNodeId] : null;
  const editingScreenPos = activeEditingNode
    ? worldToScreen(activeEditingNode.x, activeEditingNode.y, camera)
    : null;

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden select-none font-sans ${
        theme === 'dark' ? 'dark bg-[#0B0E14] text-[#F3F4F6]' : 'bg-[#F7F7F5] text-[#111827]'
      }`}
    >
      {/* 1. Top Architectural Studio Header (44px full-width docked bar) */}
      <StudioHeader
        documentTitle={boardTitle}
        onChangeDocumentTitle={setBoardTitle}
        remoteUsers={remoteUsers}
        isFollowingPresenter={isFollowingPresenter}
        onToggleFollowPresenter={() => setIsFollowingPresenter((f) => !f)}
        isPresenter={isPresenter}
        onTogglePresenter={() => setIsPresenter((p) => !p)}
        role={role}
        onOpenShare={() => setShareOpen(true)}
        onExportCanvas={() => {
          if (storeRef.current) {
            const doc = storeRef.current.exportToJSONCanvas(activePageId);
            exportCanvasFile(doc, boardTitle.toLowerCase().replace(/\s+/g, '-'));
          }
        }}
        onExportPNG={async () => {
          if (canvasRef.current) {
            const blob = await exportCanvasToPNG(canvasRef.current, false);
            downloadFile(blob, `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.png`, 'image/png');
          }
        }}
        onExportSVG={() => {
          if (storeRef.current) {
            const nodes = storeRef.current.getPageNodes(activePageId);
            const edges = storeRef.current.getPageEdges(activePageId);
            const svg = exportPageToSVG(nodes, edges, theme, false);
            downloadFile(svg, `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.svg`, 'image/svg+xml');
          }
        }}
        onImportCanvasFile={async (file) => {
          if (!storeRef.current) return;
          try {
            const doc = await parseCanvasFile(file);
            storeRef.current.importFromJSONCanvas(activePageId, doc);
          } catch (err) {
            alert(`Error parsing .canvas file: ${(err as Error).message}`);
          }
        }}
        onOpenCommandPalette={() => {
          // Trigger quick search or tool focus
          setActiveTool('select');
        }}
        theme={theme}
      />

      {/* 2. Left Docked Tool Strip (48px vertical rail with 1px right border) */}
      <Toolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        canUndo={storeRef.current?.canUndo() ?? false}
        canRedo={storeRef.current?.canRedo() ?? false}
        onUndo={() => storeRef.current?.undo()}
        onRedo={() => storeRef.current?.redo()}
        readOnly={isReadOnly}
        theme={theme}
      />

      {/* 3. Live Viewport Rulers (20px top from left 68px, 20px left from top 64px) */}
      <RulerOverlay
        camera={camera}
        cursorScreenPos={cursorScreenPos}
        theme={theme}
      />

      {/* 4. Main Canvas Viewport (docked edge-to-edge between rulers and telemetry footer) */}
      <div className="absolute top-[64px] left-[68px] right-0 bottom-[30px] overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setCursorScreenPos(null);
            setCursorWorldPos(null);
          }}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          className="w-full h-full block cursor-crosshair touch-none"
        />

        {/* Inline Text Editor Overlay */}
        {editingNodeId && activeEditingNode && editingScreenPos && (
          <div
            className="absolute z-50 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${editingScreenPos.x + (activeEditingNode.width * camera.zoom) / 2}px`,
              top: `${editingScreenPos.y + (activeEditingNode.height * camera.zoom) / 2}px`,
            }}
          >
            <textarea
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={handleSaveText}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleSaveText();
              }}
              placeholder="Type text..."
              className={`p-2 text-center text-sm font-sans rounded-md border shadow-xl outline-none resize-none min-w-[150px] min-h-[50px] ${
                theme === 'dark'
                  ? 'bg-[#11151D] text-[#F3F4F6] border-emerald-500 shadow-black/80'
                  : 'bg-white text-[#111827] border-emerald-600 shadow-zinc-300'
              }`}
              style={{
                fontSize: `${Math.max(12, 16 * camera.zoom)}px`,
              }}
            />
          </div>
        )}
      </div>

      {/* 5. Contextual Floating Inspector (Rendered 10px above selection top) */}
      {selectionBounds && selectedNodesList.length > 0 && !isReadOnly && (
        <SelectionInspector
          selectedNodes={selectedNodesList}
          selectedEdges={[]}
          bounds={selectionBounds}
          camera={camera}
          theme={theme}
          onChangeColor={handleChangeSelectedColor}
          onChangeStrokeWidth={handleChangeSelectedStrokeWidth}
          onChangeFillStyle={handleChangeSelectedFillStyle}
          onChangeRenderMode={handleChangeSelectedRenderMode}
          onDelete={handleDeleteSelected}
          onDuplicate={handleDuplicateSelected}
        />
      )}

      {/* 6. Bottom Telemetry & Multi-Page Bar (30px full-width docked footer) */}
      <BottomTelemetryBar
        pages={pages}
        activePageId={activePageId}
        onSelectPage={(id) => {
          setActivePageId(id);
          setSelectedIds(new Set());
          storeRef.current?.setupUndoManager(id);
        }}
        onCreatePage={() => {
          if (storeRef.current) {
            const newId = storeRef.current.createPage();
            setActivePageId(newId);
          }
        }}
        onRenamePage={(id, name) => {
          storeRef.current?.renamePage(id, name);
        }}
        onDeletePage={(id) => {
          if (storeRef.current) {
            const nextActive = storeRef.current.deletePage(id);
            if (nextActive) setActivePageId(nextActive);
          }
        }}
        cursorWorldPos={cursorWorldPos}
        selectedBounds={selectionBounds}
        camera={camera}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onZoomToFit={handleZoomToFit}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((g) => !g)}
        theme={theme}
        onToggleTheme={toggleLocalTheme}
        readOnly={isReadOnly}
      />

      {/* 7. Share Modal Dialog */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        roomId={roomId}
      />
    </div>
  );
};

export default WhiteboardApp;
