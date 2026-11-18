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
  SnapGuide,
  DistanceMeasurement,
  RoutingMode,
  EndpointMarker,
} from '../types/canvas';
import {
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
  getZoomToFitCamera,
  generateHexId,
} from '../engine/camera';
import { SpatialIndex, getNodeBoundingBox, getEdgeBoundingBox } from '../engine/spatialIndex';
import {
  renderNode,
  renderEdge,
  drawGrid,
  drawMagneticPorts,
  renderSelectionOverlay,
  renderLaser,
  renderRemoteCursors,
  getAnchorPoint,
  renderSnapGuides,
  renderDistanceMeasurement,
} from '../engine/renderer';
import { computeSnap, computeDistanceMeasurement } from '../engine/snapping';
import { routeEdge, hitTestEdge } from '../engine/connectorRouter';
import { exportFramesToPdf } from '../engine/pdfExport';
import { RenderCacheManager } from '../engine/renderCache';
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
import { PresentationOverlay } from './PresentationOverlay';
import { CommandPalette } from './CommandPalette';
import { DocSplitPane } from './DocSplitPane';
import { CodeDrawer } from './CodeDrawer';
import { SmartKitsDrawer } from './SmartKitsDrawer';
import { AiAssistantModal } from './AiAssistantModal';
import { McpModal } from './McpModal';
import { WorkspaceModal } from './WorkspaceModal';
import { HistoryDrawer } from './HistoryDrawer';
import { embedSceneInPng, embedSceneInSvg, extractSceneFromFile } from '../engine/sceneEmbed';
import { isSessionEncrypted } from '../engine/crypto';
import { CustomExporter } from '../sdk/pluginApi';

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

  // Modals & Stage Overlays
  const [shareOpen, setShareOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Phase 3 & 4 Studio Drawers & Modals
  const [currentRoomId, setCurrentRoomId] = useState<string>(roomId);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState<boolean>(false);
  const [isSmartKitsOpen, setIsSmartKitsOpen] = useState<boolean>(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);
  const [isMcpModalOpen, setIsMcpModalOpen] = useState<boolean>(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isEncrypted, setIsEncrypted] = useState<boolean>(() => isSessionEncrypted());

  // Snapping & Measurement Guides
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [distanceMeasurement, setDistanceMeasurement] = useState<DistanceMeasurement | null>(null);
  const [isAltKeyHeld, setIsAltKeyHeld] = useState(false);

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
  const isDraggingSegmentRef = useRef<{ edgeId: string; startOffset: number; isVertical: boolean } | null>(null);
  const internalClipboardRef = useRef<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null>(null);
  const frameChildrenInitialPosRef = useRef<Record<string, { x: number; y: number }>>({});
  const animationFrameRef = useRef<number | null>(null);

  // High-Scale Offscreen Render Cache & Multi-Touch/Stylus Refs
  const renderCacheRef = useRef<RenderCacheManager>(new RenderCacheManager());
  const activePointersRef = useRef<Map<number, { x: number; y: number; pointerType: string }>>(new Map());
  const prevPinchRef = useRef<{ distance: number; midpoint: { x: number; y: number } } | null>(null);
  const hasActivePenRef = useRef<boolean>(false);

  // Room switching handler
  const handleSwitchRoom = (newRoomId: string) => {
    setCurrentRoomId(newRoomId);
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoomId);
    window.history.pushState({}, '', url.toString());
  };

  // Canvas anchor navigation (used by DocSplitPane chips)
  const handleNavigateToNode = (nodeId: string) => {
    if (!storeRef.current) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const targetNode = nodes[nodeId];
    if (targetNode) {
      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;
      const targetCameraX = -(targetNode.x + targetNode.width / 2) + screenCenterX / camera.zoom;
      const targetCameraY = -(targetNode.y + targetNode.height / 2) + screenCenterY / camera.zoom;
      setCamera((prev) => ({ ...prev, x: targetCameraX, y: targetCameraY }));
      setSelectedIds(new Set([nodeId]));
    }
  };

  // Drag and drop handler for smart PNG/SVG and JSON Canvas files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (isReadOnly || !storeRef.current) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      try {
        const doc = await extractSceneFromFile(file);
        if (doc) {
          storeRef.current.importFromJSONCanvas(activePageId, doc);
        } else {
          const fallback = await parseCanvasFile(file);
          storeRef.current.importFromJSONCanvas(activePageId, fallback);
        }
      } catch (err) {
        alert(`Error importing dropped diagram: ${(err as Error).message}`);
      }
    }
  };

  // 1. Initialize Yjs Store
  useEffect(() => {
    const store = new YjsStore({ roomId: currentRoomId, role });
    storeRef.current = store;

    const initialPage = store.ensureDefaultPage();
    setActivePageId(initialPage);
    setPages(store.getAllPages());

    // Check for cached initial blueprint template
    const cachedTemplate = localStorage.getItem(`gfg_init_doc_${currentRoomId}`);
    if (cachedTemplate) {
      try {
        const parsed = JSON.parse(cachedTemplate);
        store.importFromJSONCanvas(initialPage, parsed);
        localStorage.removeItem(`gfg_init_doc_${currentRoomId}`);
      } catch (err) {
        console.warn('Failed to load cached template doc', err);
      }
    }

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
  }, [currentRoomId, role]);

  // Periodic automatic history snapshot
  useEffect(() => {
    const timer = setInterval(() => {
      if (storeRef.current && role === 'edit') {
        import('../store/historyStore').then(({ HistoryStore }) => {
          if (storeRef.current) {
            HistoryStore.saveSnapshot(currentRoomId, storeRef.current.doc, undefined, true).catch(() => {});
          }
        });
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [currentRoomId, role]);

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
      spatialIndex: spatialIndexRef.current,
      showGrid,
    };

    const isActivelyModifying = isInteractingRef.current && (selectedIds.size > 0 || activeTool === 'pen');

    if (isActivelyModifying) {
      const allNodesList = Object.values(nodes);
      const allEdgesList = Object.values(edges);
      const staticNodes = allNodesList.filter((n) => !selectedIds.has(n.id));
      const staticEdges = allEdgesList.filter(
        (e) => !selectedIds.has(e.fromNode) && !selectedIds.has(e.toNode) && !selectedIds.has(e.id)
      );

      const version = store ? store.getVersion() : 1;
      if (!renderCacheRef.current.shouldReuseCache(camera, activePageId, theme, globalRenderMode, showGrid, version)) {
        renderCacheRef.current.updateStaticCache(
          rect.width,
          rect.height,
          dpr,
          renderCtx,
          staticNodes,
          staticEdges,
          version
        );
      }
      renderCacheRef.current.blitStaticCache(ctx, rect.width, rect.height);

      // World Transform for active interactive elements
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Render active edges
      for (const edge of allEdgesList) {
        if (selectedIds.has(edge.fromNode) || selectedIds.has(edge.toNode) || selectedIds.has(edge.id)) {
          renderEdge(edge, nodes, null, renderCtx);
        }
      }

      // Render active nodes
      for (const id of selectedIds) {
        const node = nodes[id];
        if (node) renderNode(node, null, renderCtx);
      }
    } else {
      renderCacheRef.current.invalidate();

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
      renderNode(liveNode, null, renderCtx);
    }

    // Render Magnetic Alignment Snap Guides
    renderSnapGuides(ctx, snapGuides, theme);

    // Render CAD-style Distance Telemetry Lines
    if (distanceMeasurement) {
      renderDistanceMeasurement(ctx, distanceMeasurement, theme);
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
    // Stylus Palm Rejection:
    if (e.pointerType === 'pen') {
      hasActivePenRef.current = true;
    }
    if (e.pointerType === 'touch' && hasActivePenRef.current) {
      return;
    }

    activePointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      pointerType: e.pointerType,
    });

    // Multi-touch 2-finger gesture initiation (Pinch-to-zoom / Two-finger pan)
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      prevPinchRef.current = { distance: dist, midpoint: { x: midX, y: midY } };
      return;
    }

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
      const edges = storeRef.current ? storeRef.current.getPageEdges(activePageId) : {};
      const nodes = storeRef.current ? storeRef.current.getPageNodes(activePageId) : {};

      // 1. Check if user clicked an edge connector or its middle segment handle
      let hitEdgeId: string | null = null;
      let isMidSeg = false;
      for (const edge of Object.values(edges)) {
        const routed = routeEdge(edge, nodes, spatialIndexRef.current);
        const test = hitTestEdge(worldPos.x, worldPos.y, routed, 8);
        if (test.hit) {
          hitEdgeId = edge.id;
          isMidSeg = test.isMiddleSegment;
          break;
        }
      }

      if (hitEdgeId) {
        setSelectedIds(new Set([hitEdgeId]));
        if (isMidSeg) {
          const edge = edges[hitEdgeId];
          const routed = routeEdge(edge, nodes, spatialIndexRef.current);
          isDraggingSegmentRef.current = {
            edgeId: hitEdgeId,
            startOffset: edge._ext?.segmentOffset || 0,
            isVertical: routed.isMiddleVertical ?? true,
          };
        }
        return;
      }

      // 2. Node Hit Testing
      const hits = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 8);
      if (hits.length > 0) {
        const topHitId = hits[hits.length - 1].id;
        let newSel: Set<string>;
        if (e.shiftKey) {
          newSel = new Set(selectedIds);
          if (newSel.has(topHitId)) newSel.delete(topHitId);
          else newSel.add(topHitId);
        } else if (!selectedIds.has(topHitId)) {
          newSel = new Set([topHitId]);
        } else {
          newSel = selectedIds;
        }
        setSelectedIds(newSel);

        if (storeRef.current) {
          const allNodes = storeRef.current.getPageNodes(activePageId);
          initialNodesStateRef.current = allNodes;

          // Frame child detection: if any selected node is a frame, find its enclosed children
          const frameChildren: Record<string, { x: number; y: number }> = {};
          for (const sId of newSel) {
            const frameNode = allNodes[sId];
            if (frameNode && (frameNode.type === 'frame' || frameNode._ext?.shape === 'frame')) {
              for (const other of Object.values(allNodes)) {
                if (other.id !== frameNode.id && !newSel.has(other.id)) {
                  if (
                    other.x >= frameNode.x &&
                    other.x + other.width <= frameNode.x + frameNode.width &&
                    other.y >= frameNode.y &&
                    other.y + other.height <= frameNode.y + frameNode.height
                  ) {
                    frameChildren[other.id] = { x: other.x, y: other.y };
                  }
                }
              }
            }
          }
          frameChildrenInitialPosRef.current = frameChildren;
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
    // Stylus Palm Rejection:
    if (e.pointerType === 'touch' && hasActivePenRef.current) {
      return;
    }

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        pointerType: e.pointerType,
      });
    }

    // Two-finger pinch-to-zoom and pan
    if (activePointersRef.current.size === 2 && prevPinchRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pts = Array.from(activePointersRef.current.values());
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const newMidX = (pts[0].x + pts[1].x) / 2;
      const newMidY = (pts[0].y + pts[1].y) / 2;
      const prevPinch = prevPinchRef.current;

      if (prevPinch.distance > 0 && newDist > 0) {
        const zoomFactor = newDist / prevPinch.distance;
        const rect = canvas.getBoundingClientRect();
        const screenMidX = newMidX - rect.left;
        const screenMidY = newMidY - rect.top;

        setCamera((c) => {
          const nextZoom = Math.min(Math.max(c.zoom * zoomFactor, 0.1), 5.0);
          const dx = newMidX - prevPinch.midpoint.x;
          const dy = newMidY - prevPinch.midpoint.y;
          return {
            zoom: nextZoom,
            x: screenMidX - (screenMidX - c.x) * (nextZoom / c.zoom) + dx,
            y: screenMidY - (screenMidY - c.y) * (nextZoom / c.zoom) + dy,
          };
        });
      }
      prevPinchRef.current = { distance: newDist, midpoint: { x: newMidX, y: newMidY } };
      return;
    }

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

    // Middle segment drag
    if (isDraggingSegmentRef.current && storeRef.current) {
      const dragSeg = isDraggingSegmentRef.current;
      const dx = worldPos.x - interactionStartRef.current.worldX;
      const dy = worldPos.y - interactionStartRef.current.worldY;
      const offsetDelta = dragSeg.isVertical ? dx : dy;
      const edge = storeRef.current.getPageEdges(activePageId)[dragSeg.edgeId];
      if (edge) {
        storeRef.current.setEdge(activePageId, {
          ...edge,
          _ext: {
            ...edge._ext,
            segmentOffset: dragSeg.startOffset + offsetDelta,
          },
        });
      }
      return;
    }

    // Alt distance measurement
    if ((e.altKey || isAltKeyHeld) && selectedIds.size > 0 && !isInteractingRef.current && selectionBounds) {
      const hits = spatialIndexRef.current.hitTest(worldPos.x, worldPos.y, 8);
      const hitNode = hits.find((h) => h.kind === 'node' && !selectedIds.has(h.id));
      if (hitNode && storeRef.current) {
        const nodes = storeRef.current.getPageNodes(activePageId);
        const hoveredNode = nodes[hitNode.id];
        if (hoveredNode) {
          const hBox: BoundingBox = {
            minX: hoveredNode.x,
            minY: hoveredNode.y,
            maxX: hoveredNode.x + hoveredNode.width,
            maxY: hoveredNode.y + hoveredNode.height,
          };
          const dist = computeDistanceMeasurement(selectionBounds, hBox);
          setDistanceMeasurement(dist);
          triggerRender();
        }
      } else if (distanceMeasurement) {
        setDistanceMeasurement(null);
        triggerRender();
      }
    } else if (distanceMeasurement && !isInteractingRef.current) {
      setDistanceMeasurement(null);
      triggerRender();
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

    // Drag-to-move selected elements with Snapping & Frame Child Propagation
    if (activeTool === 'select' && selectedIds.size > 0 && storeRef.current && isInteractingRef.current) {
      let dx = worldPos.x - interactionStartRef.current.worldX;
      let dy = worldPos.y - interactionStartRef.current.worldY;
      const initial = initialNodesStateRef.current;

      // Calculate bounding box of primary moving selection to test snap
      let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
      for (const id of selectedIds) {
        const orig = initial[id];
        if (orig) {
          sMinX = Math.min(sMinX, orig.x + dx);
          sMinY = Math.min(sMinY, orig.y + dy);
          sMaxX = Math.max(sMaxX, orig.x + orig.width + dx);
          sMaxY = Math.max(sMaxY, orig.y + orig.height + dy);
        }
      }

      if (sMinX !== Infinity) {
        const snap = computeSnap(
          { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY },
          selectedIds,
          initial,
          spatialIndexRef.current
        );
        dx += snap.deltaX;
        dy += snap.deltaY;
        setSnapGuides(snap.guides);
      }

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

      // Also move enclosed frame children
      for (const [childId, childInit] of Object.entries(frameChildrenInitialPosRef.current)) {
        const origChild = initial[childId];
        if (origChild && !selectedIds.has(childId)) {
          updatedNodes.push({
            ...origChild,
            x: childInit.x + dx,
            y: childInit.y + dy,
          });
        }
      }

      if (updatedNodes.length > 0) {
        storeRef.current.setNodes(activePageId, updatedNodes);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (e.pointerType === 'pen') {
      hasActivePenRef.current = false;
    }
    if (activePointersRef.current.size < 2) {
      prevPinchRef.current = null;
    }

    isInteractingRef.current = false;
    setSnapGuides([]);
    isDraggingSegmentRef.current = null;
    frameChildrenInitialPosRef.current = {};

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

    // Shape Creation Completion (Rectangle, Diamond, Ellipse, Frame, Text)
    if (['rectangle', 'diamond', 'ellipse', 'frame', 'text'].includes(activeTool)) {
      const w = Math.abs(worldPos.x - startWorld.worldX);
      const h = Math.abs(worldPos.y - startWorld.worldY);
      const minX = Math.min(startWorld.worldX, worldPos.x);
      const minY = Math.min(startWorld.worldY, worldPos.y);

      const isFrame = activeTool === 'frame';
      const width = Math.max(isFrame ? 220 : activeTool === 'text' ? 140 : 40, w);
      const height = Math.max(isFrame ? 150 : activeTool === 'text' ? 50 : 40, h);

      const allNodes = storeRef.current.getPageNodes(activePageId);
      const frameCount = Object.values(allNodes).filter(
        (n) => n.type === 'frame' || n._ext?.shape === 'frame'
      ).length;

      const newNode: CanvasNode = {
        id: generateHexId(),
        type: isFrame ? 'frame' : activeTool === 'text' ? 'text' : 'shape',
        x: minX,
        y: minY,
        width,
        height,
        color: isFrame ? '#10B981' : strokeColor,
        text: isFrame ? `Frame ${frameCount + 1}` : activeTool === 'text' ? 'Text label' : '',
        _ext: {
          shape: isFrame ? 'frame' : activeTool === 'text' ? 'rectangle' : (activeTool as any),
          strokeWidth,
          strokeColor,
          renderMode: globalRenderMode,
          seed: Math.floor(Math.random() * 100000),
          frameTitle: isFrame ? `Frame ${frameCount + 1}` : undefined,
          frameOrder: isFrame ? frameCount + 1 : undefined,
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

  // 6. Presentation Mode & Slide Camera Animation
  const getOrderedFrames = useCallback(() => {
    if (!storeRef.current) return [];
    const nodes = storeRef.current.getPageNodes(activePageId);
    const frames = Object.values(nodes).filter(
      (n) => n.type === 'frame' || n._ext?.shape === 'frame'
    );
    frames.sort((a, b) => {
      const orderA = a._ext?.frameOrder ?? a.y * 10000 + a.x;
      const orderB = b._ext?.frameOrder ?? b.y * 10000 + b.x;
      return orderA - orderB;
    });
    return frames;
  }, [activePageId]);

  const animateCameraToFrame = useCallback(
    (frame: CanvasNode) => {
      if (!canvasRef.current) return;
      const canvasW = canvasRef.current.clientWidth;
      const canvasH = canvasRef.current.clientHeight;

      const pad = 60;
      const scale = Math.min((canvasW - pad * 2) / frame.width, (canvasH - pad * 2) / frame.height);
      const targetZoom = Math.min(2.5, Math.max(0.2, scale));

      const cx = canvasW / 2;
      const cy = canvasH / 2;
      const frameCenterX = frame.x + frame.width / 2;
      const frameCenterY = frame.y + frame.height / 2;

      const targetX = cx - frameCenterX * targetZoom;
      const targetY = cy - frameCenterY * targetZoom;

      const startCamera = { ...camera };
      const startTime = performance.now();
      const duration = 350;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = easeOutCubic(progress);

        const nextCam: Camera = {
          x: startCamera.x + (targetX - startCamera.x) * eased,
          y: startCamera.y + (targetY - startCamera.y) * eased,
          zoom: startCamera.zoom + (targetZoom - startCamera.zoom) * eased,
        };

        setCamera(nextCam);

        if (storeRef.current) {
          storeRef.current.updateLocalCursor(null, activePageId, nextCam, true);
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);
    },
    [camera, activePageId]
  );

  const handleStartPresentation = useCallback(() => {
    const frames = getOrderedFrames();
    if (frames.length === 0) {
      alert('No Frames found. Create one or more frames using the Frame tool (F) to start presentation mode.');
      return;
    }
    setIsPresentationMode(true);
    setActiveSlideIndex(0);
    animateCameraToFrame(frames[0]);
  }, [getOrderedFrames, animateCameraToFrame]);

  const handleNextSlide = useCallback(() => {
    const frames = getOrderedFrames();
    if (frames.length === 0) return;
    const nextIdx = Math.min(frames.length - 1, activeSlideIndex + 1);
    setActiveSlideIndex(nextIdx);
    animateCameraToFrame(frames[nextIdx]);
  }, [getOrderedFrames, activeSlideIndex, animateCameraToFrame]);

  const handlePrevSlide = useCallback(() => {
    const frames = getOrderedFrames();
    if (frames.length === 0) return;
    const prevIdx = Math.max(0, activeSlideIndex - 1);
    setActiveSlideIndex(prevIdx);
    animateCameraToFrame(frames[prevIdx]);
  }, [getOrderedFrames, activeSlideIndex, animateCameraToFrame]);

  // 7. Clipboard Copy & Paste
  const handleCopy = useCallback(() => {
    if (!storeRef.current || selectedIds.size === 0) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    const edges = storeRef.current.getPageEdges(activePageId);

    const copiedNodes: CanvasNode[] = [];
    selectedIds.forEach((id) => {
      if (nodes[id]) copiedNodes.push({ ...nodes[id] });
    });

    const copiedEdges: CanvasEdge[] = [];
    Object.values(edges).forEach((e) => {
      if (selectedIds.has(e.fromNode) && selectedIds.has(e.toNode)) {
        copiedEdges.push({ ...e });
      }
    });

    internalClipboardRef.current = { nodes: copiedNodes, edges: copiedEdges };
  }, [selectedIds, activePageId]);

  const handlePaste = useCallback(() => {
    if (!storeRef.current || !internalClipboardRef.current) return;
    const { nodes: clipNodes, edges: clipEdges } = internalClipboardRef.current;
    if (clipNodes.length === 0) return;

    const idMap: Record<string, string> = {};
    const newNodes: CanvasNode[] = [];
    const newSelectedIds = new Set<string>();

    for (const node of clipNodes) {
      const newId = generateHexId();
      idMap[node.id] = newId;
      newSelectedIds.add(newId);

      const shiftedNode: CanvasNode = {
        ...node,
        id: newId,
        x: node.x + 24,
        y: node.y + 24,
      };

      if (shiftedNode._ext?.freehandPoints) {
        shiftedNode._ext = {
          ...shiftedNode._ext,
          freehandPoints: shiftedNode._ext.freehandPoints.map((pt) => [
            pt[0] + 24,
            pt[1] + 24,
            pt[2] ?? 0.5,
          ]),
        };
      }

      newNodes.push(shiftedNode);
    }

    const newEdges: CanvasEdge[] = [];
    for (const edge of clipEdges) {
      const newFrom = idMap[edge.fromNode];
      const newTo = idMap[edge.toNode];
      if (newFrom && newTo) {
        newEdges.push({
          ...edge,
          id: generateHexId(),
          fromNode: newFrom,
          toNode: newTo,
        });
      }
    }

    storeRef.current.doc.transact(() => {
      storeRef.current?.setNodes(activePageId, newNodes);
      for (const e of newEdges) {
        storeRef.current?.setEdge(activePageId, e);
      }
    });

    setSelectedIds(newSelectedIds);
    internalClipboardRef.current = {
      nodes: newNodes,
      edges: newEdges,
    };
  }, [activePageId]);

  // 8. Alignment & Distribution
  const handleAlign = useCallback(
    (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      if (!storeRef.current || selectedIds.size < 2) return;
      const nodes = storeRef.current.getPageNodes(activePageId);
      const selectedList = Array.from(selectedIds)
        .map((id) => nodes[id])
        .filter(Boolean);
      if (selectedList.length < 2) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const n of selectedList) {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x + n.width);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y + n.height);
      }

      const updated: CanvasNode[] = [];
      for (const n of selectedList) {
        let nx = n.x;
        let ny = n.y;
        if (alignment === 'left') nx = minX;
        else if (alignment === 'center') nx = (minX + maxX) / 2 - n.width / 2;
        else if (alignment === 'right') nx = maxX - n.width;
        else if (alignment === 'top') ny = minY;
        else if (alignment === 'middle') ny = (minY + maxY) / 2 - n.height / 2;
        else if (alignment === 'bottom') ny = maxY - n.height;

        updated.push({ ...n, x: nx, y: ny });
      }

      storeRef.current.setNodes(activePageId, updated);
    },
    [selectedIds, activePageId]
  );

  const handleDistribute = useCallback(
    (axis: 'horizontal' | 'vertical') => {
      if (!storeRef.current || selectedIds.size < 3) return;
      const nodes = storeRef.current.getPageNodes(activePageId);
      const selectedList = Array.from(selectedIds)
        .map((id) => nodes[id])
        .filter(Boolean);
      if (selectedList.length < 3) return;

      if (axis === 'horizontal') {
        selectedList.sort((a, b) => a.x - b.x);
        const first = selectedList[0];
        const last = selectedList[selectedList.length - 1];
        const totalWidth = selectedList.reduce((acc, n) => acc + n.width, 0);
        const span = last.x + last.width - first.x;
        const gap = (span - totalWidth) / (selectedList.length - 1);

        let currentX = first.x;
        const updated: CanvasNode[] = [];
        for (const n of selectedList) {
          updated.push({ ...n, x: currentX });
          currentX += n.width + gap;
        }
        storeRef.current.setNodes(activePageId, updated);
      } else {
        selectedList.sort((a, b) => a.y - b.y);
        const first = selectedList[0];
        const last = selectedList[selectedList.length - 1];
        const totalHeight = selectedList.reduce((acc, n) => acc + n.height, 0);
        const span = last.y + last.height - first.y;
        const gap = (span - totalHeight) / (selectedList.length - 1);

        let currentY = first.y;
        const updated: CanvasNode[] = [];
        for (const n of selectedList) {
          updated.push({ ...n, y: currentY });
          currentY += n.height + gap;
        }
        storeRef.current.setNodes(activePageId, updated);
      }
    },
    [selectedIds, activePageId]
  );

  const handleBringToFront = useCallback(() => {
    if (!storeRef.current || selectedIds.size === 0) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    let maxZ = 0;
    Object.values(nodes).forEach((n) => {
      maxZ = Math.max(maxZ, n._ext?.zIndex || 0);
    });
    const updated: CanvasNode[] = [];
    selectedIds.forEach((id) => {
      const n = nodes[id];
      if (n) {
        updated.push({ ...n, _ext: { ...n._ext, zIndex: maxZ + 1 } });
      }
    });
    storeRef.current.setNodes(activePageId, updated);
  }, [selectedIds, activePageId]);

  const handleSendToBack = useCallback(() => {
    if (!storeRef.current || selectedIds.size === 0) return;
    const nodes = storeRef.current.getPageNodes(activePageId);
    let minZ = 0;
    Object.values(nodes).forEach((n) => {
      minZ = Math.min(minZ, n._ext?.zIndex || 0);
    });
    const updated: CanvasNode[] = [];
    selectedIds.forEach((id) => {
      const n = nodes[id];
      if (n) {
        updated.push({ ...n, _ext: { ...n._ext, zIndex: minZ - 1 } });
      }
    });
    storeRef.current.setNodes(activePageId, updated);
  }, [selectedIds, activePageId]);

  // 9. Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingNodeId || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        spacebarHeldRef.current = true;
      }

      if (e.key === 'Alt') {
        setIsAltKeyHeld(true);
      }

      // Quick Command Palette: Cmd+K / Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Start / Toggle Presentation Mode: Cmd+Enter / Ctrl+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isPresentationMode) {
          setIsPresentationMode(false);
        } else {
          handleStartPresentation();
        }
        return;
      }

      // Copy: Cmd+C / Ctrl+C
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Paste: Cmd+V / Ctrl+V
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Layer ordering: ] for front, [ for back
      if (e.key === ']') {
        e.preventDefault();
        handleBringToFront();
        return;
      }
      if (e.key === '[') {
        e.preventDefault();
        handleSendToBack();
        return;
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
      if (key === 'F') setActiveTool('frame');
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
      if (e.key === 'Alt') {
        setIsAltKeyHeld(false);
        setDistanceMeasurement(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    editingNodeId,
    selectedIds,
    activePageId,
    isPresentationMode,
    handleStartPresentation,
    handleCopy,
    handlePaste,
    handleBringToFront,
    handleSendToBack,
  ]);

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

  const handleChangeSelectedRoutingMode = (mode: RoutingMode) => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const edges = storeRef.current.getPageEdges(activePageId);
    for (const id of selectedIds) {
      const e = edges[id];
      if (e) {
        storeRef.current.setEdge(activePageId, {
          ...e,
          routing: mode,
          _ext: { ...e._ext, routing: mode },
        });
      }
    }
  };

  const handleChangeSelectedEndpoint = (end: 'from' | 'to', marker: EndpointMarker) => {
    if (!storeRef.current || selectedIds.size === 0 || isReadOnly) return;
    const edges = storeRef.current.getPageEdges(activePageId);
    for (const id of selectedIds) {
      const e = edges[id];
      if (e) {
        storeRef.current.setEdge(activePageId, {
          ...e,
          ...(end === 'from' ? { fromEnd: marker } : { toEnd: marker }),
        });
      }
    }
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
  const activeEdges = storeRef.current ? storeRef.current.getPageEdges(activePageId) : {};
  const selectedNodesList: CanvasNode[] = [];
  const selectedEdgesList: CanvasEdge[] = [];
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
      const e = activeEdges[id];
      if (e) {
        selectedEdgesList.push(e);
        const b = getEdgeBoundingBox(e, activeNodes);
        if (b) {
          minX = Math.min(minX, b.minX);
          minY = Math.min(minY, b.minY);
          maxX = Math.max(maxX, b.maxX);
          maxY = Math.max(maxY, b.maxY);
        }
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
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-screen h-screen overflow-hidden select-none font-sans ${
        theme === 'dark' ? 'dark bg-[#0B0E14] text-[#F3F4F6]' : 'bg-[#F7F7F5] text-[#111827]'
      }`}
    >
      {/* 1. Top Architectural Studio Header (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
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
          onStartPresentation={handleStartPresentation}
          onOpenWorkspace={() => setIsWorkspaceOpen(true)}
          onToggleDocs={() => setIsDocsOpen((d) => !d)}
          isDocsOpen={isDocsOpen}
          onToggleCodeDrawer={() => setIsCodeDrawerOpen((c) => !c)}
          isCodeDrawerOpen={isCodeDrawerOpen}
          onOpenMcpModal={() => setIsMcpModalOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
          onToggleHistory={() => setIsHistoryOpen((h) => !h)}
          isHistoryOpen={isHistoryOpen}
          isEncrypted={isEncrypted}
          onExportCanvas={() => {
            if (storeRef.current) {
              const doc = storeRef.current.exportToJSONCanvas(activePageId);
              exportCanvasFile(doc, boardTitle.toLowerCase().replace(/\s+/g, '-'));
            }
          }}
          onExportPNG={async () => {
            if (canvasRef.current && storeRef.current) {
              const rawBlob = await exportCanvasToPNG(canvasRef.current, false);
              const doc = storeRef.current.exportToJSONCanvas(activePageId);
              const smartBlob = await embedSceneInPng(rawBlob, doc);
              downloadFile(smartBlob, `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.png`, 'image/png');
            }
          }}
          onExportSVG={() => {
            if (storeRef.current) {
              const nodes = storeRef.current.getPageNodes(activePageId);
              const edges = storeRef.current.getPageEdges(activePageId);
              const doc = storeRef.current.exportToJSONCanvas(activePageId);
              const rawSvg = exportPageToSVG(nodes, edges, theme, false);
              const smartSvg = embedSceneInSvg(rawSvg, doc);
              downloadFile(smartSvg, `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.svg`, 'image/svg+xml');
            }
          }}
          onExportPDF={() => {
            if (storeRef.current) {
              const nodes = storeRef.current.getPageNodes(activePageId);
              const edges = storeRef.current.getPageEdges(activePageId);
              exportFramesToPdf(nodes, edges, theme, boardTitle.toLowerCase().replace(/\s+/g, '-'));
            }
          }}
          onCustomExport={async (exporter) => {
            if (storeRef.current) {
              const nodes = storeRef.current.getPageNodes(activePageId);
              const edges = storeRef.current.getPageEdges(activePageId);
              const res = await exporter.export(nodes, edges);
              downloadFile(
                res,
                `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.${exporter.extension}`,
                exporter.mimeType
              );
            }
          }}
          onImportCanvasFile={async (file) => {
            if (!storeRef.current) return;
            try {
              const doc = await extractSceneFromFile(file);
              if (doc) {
                storeRef.current.importFromJSONCanvas(activePageId, doc);
              } else {
                const fallbackDoc = await parseCanvasFile(file);
                storeRef.current.importFromJSONCanvas(activePageId, fallbackDoc);
              }
            } catch (err) {
              alert(`Error importing file: ${(err as Error).message}`);
            }
          }}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          theme={theme}
        />
      )}

      {/* 2. Left Docked Tool Strip (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <Toolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          canUndo={storeRef.current?.canUndo() ?? false}
          canRedo={storeRef.current?.canRedo() ?? false}
          onUndo={() => storeRef.current?.undo()}
          onRedo={() => storeRef.current?.redo()}
          readOnly={isReadOnly}
          theme={theme}
          onToggleKits={() => setIsSmartKitsOpen((k) => !k)}
          isKitsOpen={isSmartKitsOpen}
        />
      )}

      {/* 3. Live Viewport Rulers (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
        <RulerOverlay
          camera={camera}
          cursorScreenPos={cursorScreenPos}
          theme={theme}
        />
      )}

      {/* 4. Main Canvas Viewport (docked edge-to-edge between chrome, or full-bleed in presentation) */}
      <div
        className={`absolute overflow-hidden ${
          isPresentationMode ? 'inset-0' : 'top-[64px] left-[68px] right-0 bottom-[30px]'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={(e) => {
            activePointersRef.current.delete(e.pointerId);
            if (e.pointerType === 'pen') hasActivePenRef.current = false;
            if (activePointersRef.current.size < 2) prevPinchRef.current = null;
          }}
          onPointerLeave={(e) => {
            activePointersRef.current.delete(e.pointerId);
            if (e.pointerType === 'pen') hasActivePenRef.current = false;
            if (activePointersRef.current.size < 2) prevPinchRef.current = null;
            setCursorScreenPos(null);
            setCursorWorldPos(null);
            setDistanceMeasurement(null);
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
      {selectionBounds && (selectedNodesList.length > 0 || selectedEdgesList.length > 0) && !isReadOnly && !isPresentationMode && (
        <SelectionInspector
          selectedNodes={selectedNodesList}
          selectedEdges={selectedEdgesList}
          bounds={selectionBounds}
          camera={camera}
          theme={theme}
          onChangeColor={handleChangeSelectedColor}
          onChangeStrokeWidth={handleChangeSelectedStrokeWidth}
          onChangeFillStyle={handleChangeSelectedFillStyle}
          onChangeRenderMode={handleChangeSelectedRenderMode}
          onChangeRoutingMode={handleChangeSelectedRoutingMode}
          onChangeEndpoint={handleChangeSelectedEndpoint}
          onDelete={handleDeleteSelected}
          onDuplicate={handleDuplicateSelected}
        />
      )}

      {/* 6. Bottom Telemetry & Multi-Page Bar (Hidden in Presentation Mode) */}
      {!isPresentationMode && (
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
      )}

      {/* 7. Slide Presentation Mode Stage Overlay */}
      {isPresentationMode && (
        <PresentationOverlay
          frames={getOrderedFrames()}
          activeSlideIndex={activeSlideIndex}
          onNextSlide={handleNextSlide}
          onPrevSlide={handlePrevSlide}
          onGoToSlide={(idx) => {
            setActiveSlideIndex(idx);
            animateCameraToFrame(getOrderedFrames()[idx]);
          }}
          onExit={() => setIsPresentationMode(false)}
          theme={theme}
        />
      )}

      {/* 8. Functional ⌘K Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        theme={theme}
        onSelectTool={setActiveTool}
        onSelectRenderMode={setGlobalRenderMode}
        onToggleGrid={() => setShowGrid((g) => !g)}
        onToggleTheme={toggleLocalTheme}
        onZoomToFit={handleZoomToFit}
        onStartPresentation={handleStartPresentation}
        onAlign={handleAlign}
        onDistribute={handleDistribute}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onDuplicate={handleDuplicateSelected}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDeleteSelected}
        onCreatePage={() => {
          if (storeRef.current) {
            const newId = storeRef.current.createPage();
            setActivePageId(newId);
          }
        }}
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
        onExportPDF={() => {
          if (storeRef.current) {
            const nodes = storeRef.current.getPageNodes(activePageId);
            const edges = storeRef.current.getPageEdges(activePageId);
            exportFramesToPdf(nodes, edges, theme, boardTitle.toLowerCase().replace(/\s+/g, '-'));
          }
        }}
        hasSelection={selectedIds.size > 0}
      />

      {/* 9. Share Modal Dialog */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        roomId={currentRoomId}
        onExportCanvas={() => {
          if (storeRef.current) {
            const doc = storeRef.current.exportToJSONCanvas(activePageId);
            exportCanvasFile(doc, boardTitle.toLowerCase().replace(/\s+/g, '-'));
          }
        }}
        onExportPNG={async () => {
          if (canvasRef.current && storeRef.current) {
            const rawBlob = await exportCanvasToPNG(canvasRef.current, false);
            const doc = storeRef.current.exportToJSONCanvas(activePageId);
            const smartBlob = await embedSceneInPng(rawBlob, doc);
            downloadFile(smartBlob, `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.png`, 'image/png');
          }
        }}
        onExportSVG={() => {
          if (storeRef.current) {
            const nodes = storeRef.current.getPageNodes(activePageId);
            const edges = storeRef.current.getPageEdges(activePageId);
            const doc = storeRef.current.exportToJSONCanvas(activePageId);
            const rawSvg = exportPageToSVG(nodes, edges, theme, false);
            const smartSvg = embedSceneInSvg(rawSvg, doc);
            downloadFile(smartSvg, `${boardTitle.toLowerCase().replace(/\s+/g, '-')}.svg`, 'image/svg+xml');
          }
        }}
      />

      {/* 10. Doc Spec Split-Pane */}
      {storeRef.current && (
        <DocSplitPane
          isOpen={isDocsOpen}
          onClose={() => setIsDocsOpen(false)}
          store={storeRef.current}
          activePageId={activePageId}
          selectedNodes={Array.from(selectedIds)}
          nodes={activeNodes}
          theme={theme}
          onNavigateToNode={handleNavigateToNode}
        />
      )}

      {/* 11. Diagram-as-Code Drawer */}
      {storeRef.current && (
        <CodeDrawer
          isOpen={isCodeDrawerOpen}
          onClose={() => setIsCodeDrawerOpen(false)}
          store={storeRef.current}
          activePageId={activePageId}
          nodes={activeNodes}
          edges={activeEdges}
          theme={theme}
        />
      )}

      {/* 12. Domain Smart Kits Drawer */}
      {storeRef.current && (
        <SmartKitsDrawer
          isOpen={isSmartKitsOpen}
          onClose={() => setIsSmartKitsOpen(false)}
          store={storeRef.current}
          activePageId={activePageId}
          camera={camera}
          theme={theme}
          onSelectNode={(nodeId) => setSelectedIds(new Set([nodeId]))}
        />
      )}

      {/* 13. BYOK AI Assistant Modal */}
      {storeRef.current && (
        <AiAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => setIsAiAssistantOpen(false)}
          store={storeRef.current}
          activePageId={activePageId}
          nodes={activeNodes}
          edges={activeEdges}
          selectedNodes={Array.from(selectedIds)}
          theme={theme}
        />
      )}

      {/* 14. Connect AI Agent via MCP Modal */}
      <McpModal
        isOpen={isMcpModalOpen}
        onClose={() => setIsMcpModalOpen(false)}
        roomId={currentRoomId}
        theme={theme}
      />

      {/* 15. Multi-Board Workspace Modal */}
      <WorkspaceModal
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        activeRoomId={currentRoomId}
        onSelectBoard={handleSwitchRoom}
        theme={theme}
      />

      {/* 16. Non-Destructive Version History Drawer */}
      {storeRef.current && (
        <HistoryDrawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          store={storeRef.current}
          roomId={currentRoomId}
          theme={theme}
          onSwitchRoom={handleSwitchRoom}
        />
      )}
    </div>
  );
};

export default WhiteboardApp;
