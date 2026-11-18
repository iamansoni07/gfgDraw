import {
  CanvasNode,
  CanvasEdge,
  Camera,
  BoundingBox,
  ConnectionSide,
  RenderMode,
  UserAwareness,
  LaserPoint,
  ResizeHandle,
  SnapGuide,
  DistanceMeasurement,
  EndpointMarker,
} from '../types/canvas';
import { routeEdge } from './connectorRouter';
import { SpatialIndex } from './spatialIndex';
import { PluginRegistry } from '../sdk/pluginApi';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  theme: 'light' | 'dark';
  globalRenderMode: RenderMode;
  selectedIds: Set<string>;
  hoveredAnchor?: { nodeId: string; side: ConnectionSide } | null;
  laserPoints?: LaserPoint[];
  remoteUsers?: UserAwareness[];
  currentPageId: string;
  marqueeBox?: BoundingBox | null;
  dpr: number;
  showGrid?: boolean;
  spatialIndex?: SpatialIndex;
  snapGuides?: SnapGuide[];
  distanceMeasurement?: DistanceMeasurement | null;
  hoveredEdgeId?: string | null;
  hoveredSegmentIndex?: number | null;
}

/**
 * Brand color tokens: Emerald accent for Architectural Drafting Studio.
 * Light: #059669 (Vibrant Emerald)
 * Dark:  #10B981 (Luminous Emerald)
 */
export function getEmeraldAccent(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#10B981' : '#059669';
}

/**
 * Canvas background tokens:
 * Light: #F7F7F5 ("Studio Paper")
 * Dark:  #0B0E14 ("Carbon Studio")
 */
export function getCanvasBgColor(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? '#0B0E14' : '#F7F7F5';
}

/**
 * Returns anchor coordinates for a node side.
 */
export function getAnchorPoint(
  node: CanvasNode,
  side: ConnectionSide
): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
  }
}

/**
 * Resolves theme-adaptive stroke and fill colors for Studio Paper & Carbon Studio.
 */
export function resolveColor(
  rawColor: string | undefined,
  theme: 'light' | 'dark',
  fallbackNeutral = true
): string {
  const defaultInk = theme === 'dark' ? '#F3F4F6' : '#111827';
  if (!rawColor) {
    return defaultInk;
  }

  // Handle JSON Canvas numeric color values (1=red, 2=orange, 3=yellow, 4=emerald, 5=cyan, 6=purple)
  const colorMap: Record<string, string> = {
    '1': '#EF4444',
    '2': '#F97316',
    '3': '#F59E0B',
    '4': theme === 'dark' ? '#10B981' : '#059669',
    '5': '#06B6D4',
    '6': '#8B5CF6',
  };
  if (colorMap[rawColor]) {
    return colorMap[rawColor];
  }

  // Invert pure black/neutral for dark/light themes
  if (fallbackNeutral) {
    const lower = rawColor.toLowerCase();
    if (lower === '#000000' || lower === '#111827' || lower === '#18181b' || lower === '#1f2937') {
      return theme === 'dark' ? '#F3F4F6' : '#111827';
    }
    if (lower === '#ffffff' || lower === '#f3f4f6' || lower === '#f7f7f5' || lower === '#f9f9f6') {
      return theme === 'dark' ? '#111827' : '#F3F4F6';
    }
  }

  return rawColor;
}

/**
 * Draws the technical dot-matrix canvas grid:
 * - Studio Paper (Light): #E4E4E7 / #DCDAD3 dots
 * - Carbon Studio (Dark): #1F2633 dots
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  theme: 'light' | 'dark'
): void {
  ctx.save();
  const baseSpacing = 28;
  const spacing = baseSpacing * camera.zoom;

  // Fade out grid if zoomed out too far
  if (spacing < 7) {
    ctx.restore();
    return;
  }

  const dotColor = theme === 'dark' ? '#1F2633' : '#DCDAD3';
  ctx.fillStyle = dotColor;

  const startX = ((camera.x % spacing) + spacing) % spacing;
  const startY = ((camera.y % spacing) + spacing) % spacing;

  const dotSize = Math.max(0.75, Math.min(1.8, 1.0 * camera.zoom));

  for (let x = startX; x < canvasWidth; x += spacing) {
    for (let y = startY; y < canvasHeight; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Native Velocity-Weighted Ink Stroke Renderer (100% Custom Native Path2D math):
 * Converts discrete pointer points [x, y, pressure, time?] into a smooth,
 * velocity-responsive Catmull-Rom / Quadratic Bezier tapered ribbon with zero external libraries.
 */
export function renderCustomInkStroke(
  points: number[][],
  ctx: CanvasRenderingContext2D,
  color: string,
  baseWidth = 3
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  if (points.length === 2) {
    ctx.beginPath();
    ctx.arc(points[0][0], points[0][1], baseWidth, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 1. Calculate dynamic velocities & widths per segment
  const widths: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const curr = points[i];
    const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    const pressure = curr[2] ?? 0.5;

    // Velocity factor: faster strokes taper thinner, slow strokes create rich ink pools
    const velocityFactor = Math.max(0.35, Math.min(1.6, 1.4 - dist / 35));
    const w = Math.max(1, baseWidth * pressure * 1.5 * velocityFactor);
    widths.push(w);
  }

  // 2. Generate smooth ribbon polygon using normal vectors
  const leftPts: [number, number][] = [];
  const rightPts: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const halfW = widths[i] / 2;

    leftPts.push([p0[0] + nx * halfW, p0[1] + ny * halfW]);
    rightPts.push([p0[0] - nx * halfW, p0[1] - ny * halfW]);
  }

  // Final point
  const lastP = points[points.length - 1];
  const prevP = points[points.length - 2];
  const lastDx = lastP[0] - prevP[0];
  const lastDy = lastP[1] - prevP[1];
  const lastLen = Math.hypot(lastDx, lastDy) || 1;
  const lastNx = -lastDy / lastLen;
  const lastNy = lastDx / lastLen;
  const lastHalfW = widths[widths.length - 1] / 3; // tapered tip

  leftPts.push([lastP[0] + lastNx * lastHalfW, lastP[1] + lastNy * lastHalfW]);
  rightPts.push([lastP[0] - lastNx * lastHalfW, lastP[1] - lastNy * lastHalfW]);

  // 3. Construct smooth Path2D contour
  const ribbonPath = new Path2D();
  if (leftPts.length > 0) {
    ribbonPath.moveTo(leftPts[0][0], leftPts[0][1]);

    // Forward along left edge with mid-point quad smoothing
    for (let i = 0; i < leftPts.length - 1; i++) {
      const midX = (leftPts[i][0] + leftPts[i + 1][0]) / 2;
      const midY = (leftPts[i][1] + leftPts[i + 1][1]) / 2;
      ribbonPath.quadraticCurveTo(leftPts[i][0], leftPts[i][1], midX, midY);
    }
    ribbonPath.lineTo(leftPts[leftPts.length - 1][0], leftPts[leftPts.length - 1][1]);

    // Rounded tip cap
    ribbonPath.lineTo(rightPts[rightPts.length - 1][0], rightPts[rightPts.length - 1][1]);

    // Backward along right edge
    for (let i = rightPts.length - 1; i > 0; i--) {
      const midX = (rightPts[i][0] + rightPts[i - 1][0]) / 2;
      const midY = (rightPts[i][1] + rightPts[i - 1][1]) / 2;
      ribbonPath.quadraticCurveTo(rightPts[i][0], rightPts[i][1], midX, midY);
    }
    ribbonPath.closePath();

    ctx.fill(ribbonPath);
  }

  ctx.restore();
}

/**
 * Draws corner technical registration cross-ticks (+) for "blueprint" mode.
 */
function drawCornerTicks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  tickLen = 5
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Horizontal tick
  ctx.moveTo(x - tickLen, y);
  ctx.lineTo(x + tickLen, y);
  // Vertical tick
  ctx.moveTo(x, y - tickLen);
  ctx.lineTo(x, y + tickLen);
  ctx.stroke();
  ctx.restore();
}

/**
 * 100% Native Pure Path2D Shape Renderer:
 * Supports three custom architectural visual styles:
 * 1. "precision": Crisp anti-aliased geometry, clean elevation shadow, sharp typography.
 * 2. "blueprint": Technical drafting aesthetic with primary border, inner hairline offset, and registration cross-ticks (+).
 * 3. "ink": Subtle organic stroke modulation and velocity-reactive freehand curves.
 */
export function renderNode(
  node: CanvasNode,
  _unusedRc: any,
  renderCtx: RenderContext
): void {
  const { ctx, theme, globalRenderMode } = renderCtx;
  const strokeColor = resolveColor(node.color || node._ext?.strokeColor, theme);
  const strokeWidth = node._ext?.strokeWidth || 2;
  const mode: RenderMode = node._ext?.renderMode || globalRenderMode || 'precision';
  const shape = node._ext?.shape || 'rectangle';

  // 1. Freehand Ink Stroke
  if (node._ext?.freehandPoints && node._ext.freehandPoints.length > 0) {
    renderCustomInkStroke(node._ext.freehandPoints, ctx, strokeColor, strokeWidth * 1.6);
    return;
  }

  // 2. Frame Container Tool Rendering
  if (shape === 'frame' || node.type === 'frame') {
    const fx = node.x;
    const fy = node.y;
    const fw = node.width;
    const fh = node.height;
    const title = node._ext?.frameTitle || node.text || 'Frame';

    ctx.save();
    // Translucent architectural glass fill
    ctx.fillStyle = theme === 'dark' ? 'rgba(17, 21, 29, 0.45)' : 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(fx, fy, fw, fh);

    // Frame Border
    ctx.strokeStyle = theme === 'dark' ? '#1F2633' : '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.setLineDash([]);

    // Header Title Tag above top-left corner
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    const tagPadding = 8;
    const tagMetrics = ctx.measureText(title);
    const tagW = Math.max(70, tagMetrics.width + tagPadding * 2);
    const tagH = 20;

    // Tag background
    ctx.fillStyle = theme === 'dark' ? '#161B22' : '#FFFFFF';
    ctx.strokeStyle = theme === 'dark' ? '#10B981' : '#059669';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(fx, fy - tagH, tagW, tagH, [4, 4, 0, 0]);
    ctx.fill();
    ctx.stroke();

    // Tag text
    ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, fx + tagPadding, fy - tagH / 2);

    ctx.restore();
    return;
  }

  // Fill properties
  const fillColor = node._ext?.backgroundColor || 'transparent';
  const hasFill = fillColor !== 'transparent' && fillColor !== 'none';
  const fillStyle = node._ext?.fillStyle || 'none';

  ctx.save();

  // Mode 1: Precision — directional elevation shadow
  if (mode === 'precision') {
    ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.05)';
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 6;
  }

  // --- RECTANGLE ---
  if (shape === 'rectangle') {
    const rx = node.x;
    const ry = node.y;
    const rw = node.width;
    const rh = node.height;

    // Base fill
    if (hasFill) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(rx, ry, rw, rh);

      // Hachure hatching if requested
      if (fillStyle === 'hachure') {
        drawHatching(ctx, rx, ry, rw, rh, strokeColor);
      }
    }

    // Precision Style
    if (mode === 'precision') {
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 3);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    // Blueprint Style: Primary border + inner hairline offset + corner registration ticks
    else if (mode === 'blueprint') {
      // Primary outer border
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Subtle inner hairline offset (3px inside)
      if (rw > 10 && rh > 10) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx + 3.5, ry + 3.5, rw - 7, rh - 7);
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.75;
        ctx.stroke();
        ctx.restore();
      }

      // 4 Corner registration cross-ticks (+)
      const tickColor = theme === 'dark' ? '#10B981' : '#059669';
      drawCornerTicks(ctx, rx, ry, tickColor);
      drawCornerTicks(ctx, rx + rw, ry, tickColor);
      drawCornerTicks(ctx, rx + rw, ry + rh, tickColor);
      drawCornerTicks(ctx, rx, ry + rh, tickColor);
    }
    // Ink Style: Organic subtle line modulation
    else if (mode === 'ink') {
      drawOrganicRect(ctx, rx, ry, rw, rh, strokeColor, strokeWidth, node._ext?.seed || 42);
    }
  }

  // --- DIAMOND ---
  else if (shape === 'diamond') {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const p1: [number, number] = [cx, node.y];
    const p2: [number, number] = [node.x + node.width, cy];
    const p3: [number, number] = [cx, node.y + node.height];
    const p4: [number, number] = [node.x, cy];

    const diamondPath = new Path2D();
    diamondPath.moveTo(p1[0], p1[1]);
    diamondPath.lineTo(p2[0], p2[1]);
    diamondPath.lineTo(p3[0], p3[1]);
    diamondPath.lineTo(p4[0], p4[1]);
    diamondPath.closePath();

    if (hasFill) {
      ctx.fillStyle = fillColor;
      ctx.fill(diamondPath);
    }

    if (mode === 'precision') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke(diamondPath);
    } else if (mode === 'blueprint') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke(diamondPath);

      // Inner diamond hairline offset
      if (node.width > 14 && node.height > 14) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, node.y + 4);
        ctx.lineTo(node.x + node.width - 4, cy);
        ctx.lineTo(cx, node.y + node.height - 4);
        ctx.lineTo(node.x + 4, cy);
        ctx.closePath();
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.75;
        ctx.stroke();
        ctx.restore();
      }

      const tickColor = theme === 'dark' ? '#10B981' : '#059669';
      drawCornerTicks(ctx, p1[0], p1[1], tickColor);
      drawCornerTicks(ctx, p2[0], p2[1], tickColor);
      drawCornerTicks(ctx, p3[0], p3[1], tickColor);
      drawCornerTicks(ctx, p4[0], p4[1], tickColor);
    } else if (mode === 'ink') {
      drawOrganicPolygon(ctx, [p1, p2, p3, p4], strokeColor, strokeWidth, node._ext?.seed || 42);
    }
  }

  // --- ELLIPSE ---
  else if (shape === 'ellipse') {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const rx = Math.max(1, node.width / 2);
    const ry = Math.max(1, node.height / 2);

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

    if (hasFill) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    if (mode === 'precision') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    } else if (mode === 'blueprint') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Subtle inner concentric ring
      if (rx > 6 && ry > 6) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx - 3.5, ry - 3.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.75;
        ctx.stroke();
        ctx.restore();
      }

      // Center crosshair registration marks
      const tickColor = theme === 'dark' ? '#10B981' : '#059669';
      drawCornerTicks(ctx, cx, cy - ry, tickColor);
      drawCornerTicks(ctx, cx + rx, cy, tickColor);
      drawCornerTicks(ctx, cx, cy + ry, tickColor);
      drawCornerTicks(ctx, cx - rx, cy, tickColor);
    } else if (mode === 'ink') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      // Second organic pass
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = strokeWidth * 0.75;
      ctx.beginPath();
      ctx.ellipse(cx + 0.3, cy + 0.3, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- DSA SMART KITS ---
  else if (shape === 'dsa-array') {
    drawDsaArray(ctx, node, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  } else if (shape === 'dsa-linked-list') {
    drawDsaLinkedList(ctx, node, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  } else if (shape === 'dsa-binary-tree') {
    drawDsaBinaryTree(ctx, node, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  } else if (shape === 'dsa-stack') {
    drawDsaStack(ctx, node, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  } else if (shape === 'dsa-queue') {
    drawDsaQueue(ctx, node, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  }
  // --- SYSTEM DESIGN SMART KITS ---
  else if (shape === 'sys-database') {
    drawSysDatabase(ctx, node, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  } else if (
    shape === 'sys-load-balancer' ||
    shape === 'sys-api-gateway' ||
    shape === 'sys-microservice' ||
    shape === 'sys-cache' ||
    shape === 'sys-queue' ||
    shape === 'sys-client'
  ) {
    drawSysContainer(ctx, node, shape, strokeColor, strokeWidth, fillColor, theme);
    ctx.restore();
    return;
  }

  // --- EXTENSIBLE PLUGIN CUSTOM NODES ---
  const customPluginNode = PluginRegistry.getCustomNode(shape);
  if (customPluginNode) {
    customPluginNode.render({ ctx, node, theme, strokeColor, strokeWidth, fillColor });
    ctx.restore();
    return;
  }

  ctx.restore(); // Undo shadow

  // 3. Crisp Architectural Typography
  if (node.text && node.text.trim().length > 0) {
    ctx.save();
    const fontSize = node._ext?.fontSize || 14;
    ctx.font = `500 ${fontSize}px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = resolveColor(node.color || node._ext?.strokeColor, theme);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;

    const lines = node.text.split('\n');
    const lineHeight = fontSize * 1.35;
    const totalHeight = lines.length * lineHeight;
    let startY = cy - totalHeight / 2 + lineHeight / 2;

    for (const line of lines) {
      ctx.fillText(line, cx, startY, node.width - 12);
      startY += lineHeight;
    }
    ctx.restore();
  }
}

// ==========================================
// PURE NATIVE PATH2D DOMAIN SMART KITS
// ==========================================

function drawDsaArray(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const cells =
    node._ext?.arrayCells && node._ext.arrayCells.length > 0
      ? node._ext.arrayCells
      : ['10', '24', '35', '77'];
  const n = cells.length;
  const cellW = node.width / n;
  const x = node.x;
  const y = node.y;
  const h = node.height;

  // Background
  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.fillRect(x, y, node.width, h);

  // Outer border
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.strokeRect(x, y, node.width, h);

  // Cell dividers and contents
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < n; i++) {
    const cx = x + i * cellW;
    // Divider
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
    }

    // Index badge above cell: [0], [1], ...
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
    ctx.fillText(`[${i}]`, cx + cellW / 2, y - 10);

    // Value inside cell
    ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = strokeColor;
    ctx.fillText(cells[i], cx + cellW / 2, y + h / 2);
  }
}

function drawDsaLinkedList(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const splitX = x + w * 0.68;

  // Background
  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.fillRect(x, y, w, h);

  // Outer border
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.strokeRect(x, y, w, h);

  // Split line between data and next
  ctx.beginPath();
  ctx.moveTo(splitX, y);
  ctx.lineTo(splitX, y + h);
  ctx.stroke();

  // Data label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = strokeColor;
  ctx.fillText(node.text || '42', x + (splitX - x) / 2, y + h / 2);

  // Next pointer port dot
  const dotX = splitX + (x + w - splitX) / 2;
  const dotY = y + h / 2;
  ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Small pointer stub: arrow pointing out right
  ctx.beginPath();
  ctx.moveTo(dotX + 4, dotY);
  ctx.lineTo(x + w + 8, dotY);
  ctx.strokeStyle = theme === 'dark' ? '#10B981' : '#059669';
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(x + w + 4, dotY - 3);
  ctx.lineTo(x + w + 8, dotY);
  ctx.lineTo(x + w + 4, dotY + 3);
  ctx.stroke();
}

function drawDsaBinaryTree(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const r = Math.min(node.width, node.height) / 2;

  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();

  // Value
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = strokeColor;
  ctx.fillText(node.text || '8', cx, cy);

  // Left & Right port hints (L, R)
  ctx.font = '500 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
  ctx.fillText('L', cx - r * 0.55, cy + r * 0.7);
  ctx.fillText('R', cx + r * 0.55, cy + r * 0.7);
}

function drawDsaStack(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const cells =
    node._ext?.arrayCells && node._ext.arrayCells.length > 0
      ? node._ext.arrayCells
      : ['val 3', 'val 2', 'val 1'];

  // Fill
  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.fillRect(x, y, w, h);

  // U-shaped border (open top)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y);
  ctx.stroke();

  // Draw stacked items from bottom to top
  const n = cells.length;
  const cellH = (h - 10) / n;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < n; i++) {
    const itemY = y + h - (i + 1) * cellH;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x + 4, itemY);
    ctx.lineTo(x + w - 4, itemY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '500 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = strokeColor;
    ctx.fillText(cells[cells.length - 1 - i], x + w / 2, itemY + cellH / 2);
  }

  // "TOP" indicator tag
  ctx.font = '700 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
  ctx.fillText('▲ TOP', x + w / 2, y - 8);
}

function drawDsaQueue(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const cells =
    node._ext?.arrayCells && node._ext.arrayCells.length > 0
      ? node._ext.arrayCells
      : ['D', 'C', 'B', 'A'];

  // Fill
  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.fillRect(x, y, w, h);

  // Top and bottom horizontal rails (open left and right)
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  // Vertical dividers
  const n = cells.length;
  const cellW = w / n;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < n; i++) {
    const cx = x + i * cellW;
    if (i > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = strokeColor;
    ctx.fillText(cells[i], cx + cellW / 2, y + h / 2);
  }

  // Flow tags
  ctx.font = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
  ctx.fillText('ENQUEUE →', x - 30, y + h / 2);
  ctx.fillText('→ DEQUEUE', x + w + 32, y + h / 2);
}

function drawSysDatabase(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const rx = w / 2;
  const ry = Math.min(14, h / 4);
  const cx = x + rx;

  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  // Body path
  ctx.beginPath();
  ctx.ellipse(cx, y + ry, rx, ry, 0, Math.PI, 0, false);
  ctx.lineTo(x + w, y + h - ry);
  ctx.ellipse(cx, y + h - ry, rx, ry, 0, 0, Math.PI, false);
  ctx.lineTo(x, y + ry);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top lid ellipse
  ctx.beginPath();
  ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Interior disk divider lines
  const d1 = y + ry + (h - ry * 2) * 0.35;
  const d2 = y + ry + (h - ry * 2) * 0.7;

  ctx.beginPath();
  ctx.ellipse(cx, d1, rx, ry, 0, 0, Math.PI, false);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(cx, d2, rx, ry, 0, 0, Math.PI, false);
  ctx.stroke();

  // Text inside
  if (node.text) {
    ctx.font = '600 12px ui-sans-serif, -apple-system, sans-serif';
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = node.text.split('\n');
    const midY = y + h / 2 + 4;
    lines.forEach((line, idx) => {
      ctx.fillText(line, cx, midY + (idx - (lines.length - 1) / 2) * 15, w - 16);
    });
  }
}

function drawSysContainer(
  ctx: CanvasRenderingContext2D,
  node: CanvasNode,
  shape: string,
  strokeColor: string,
  strokeWidth: number,
  fillColor: string,
  theme: 'light' | 'dark'
): void {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const r = 6;

  // Background container
  ctx.fillStyle =
    fillColor !== 'transparent'
      ? fillColor
      : theme === 'dark'
      ? '#161B22'
      : '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();

  // Top accent banner or glyph
  const accentColor = strokeColor;

  if (shape === 'sys-client') {
    // Browser Chrome header bar
    const barH = 22;
    ctx.fillStyle = theme === 'dark' ? '#1F2633' : '#E5E7EB';
    ctx.beginPath();
    ctx.roundRect(x, y, w, barH, [r, r, 0, 0]);
    ctx.fill();

    // 3 Dots
    const dotColors = ['#EF4444', '#F59E0B', '#10B981'];
    dotColors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 12 + i * 10, y + barH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // URL bar
    ctx.fillStyle = theme === 'dark' ? '#0B0E14' : '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(x + 50, y + 4, w - 60, barH - 8, 3);
    ctx.fill();
    ctx.font = '500 8px ui-monospace, monospace';
    ctx.fillStyle = theme === 'dark' ? '#9CA3AF' : '#6B7280';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('https://app.io', x + 56, y + barH / 2);
  } else {
    // Mini glyph badge on top-left
    ctx.save();
    ctx.translate(x + 16, y + 16);
    ctx.strokeStyle = accentColor;
    ctx.fillStyle = accentColor;
    ctx.lineWidth = 1.5;

    if (shape === 'sys-load-balancer') {
      // 3 radiating distribution arrows
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      for (let a = 0; a < 3; a++) {
        const rad = (a * 120 * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * 4, Math.sin(rad) * 4);
        ctx.lineTo(Math.cos(rad) * 10, Math.sin(rad) * 10);
        ctx.stroke();
      }
    } else if (shape === 'sys-api-gateway') {
      // Fork gateway: line entering, splitting
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-2, 0);
      ctx.lineTo(6, -6);
      ctx.moveTo(-2, 0);
      ctx.lineTo(8, 0);
      ctx.moveTo(-2, 0);
      ctx.lineTo(6, 6);
      ctx.stroke();
    } else if (shape === 'sys-microservice') {
      // Hexagon / cube
      ctx.beginPath();
      ctx.rect(-6, -6, 12, 12);
      ctx.stroke();
      ctx.fillRect(-2, -2, 4, 4);
    } else if (shape === 'sys-cache') {
      // Lightning / RAM
      ctx.beginPath();
      ctx.moveTo(1, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(-2, 7);
      ctx.lineTo(5, -1);
      ctx.lineTo(1, -1);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'sys-queue') {
      // Partitioned queue blocks
      ctx.strokeRect(-8, -4, 5, 8);
      ctx.strokeRect(-2, -4, 5, 8);
      ctx.strokeRect(4, -4, 5, 8);
    }
    ctx.restore();
  }

  // Node text
  if (node.text) {
    ctx.font = '600 12px ui-sans-serif, -apple-system, sans-serif';
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = node.text.split('\n');
    const offsetY = shape === 'sys-client' ? y + 22 + (h - 22) / 2 : y + h / 2 + 4;
    lines.forEach((line, idx) => {
      ctx.fillText(
        line,
        x + w / 2,
        offsetY + (idx - (lines.length - 1) / 2) * 16,
        w - 20
      );
    });
  }
}

function drawOrganicRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  width: number,
  seed: number
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const wobble = (offset: number) => {
    return Math.sin((offset + seed) * 1.8) * 0.6;
  };

  ctx.beginPath();
  // Top edge
  ctx.moveTo(x, y + wobble(0));
  ctx.quadraticCurveTo(x + w / 2, y + wobble(1), x + w, y + wobble(2));
  // Right edge
  ctx.quadraticCurveTo(x + w + wobble(3), y + h / 2, x + w, y + h + wobble(4));
  // Bottom edge
  ctx.quadraticCurveTo(x + w / 2, y + h + wobble(5), x, y + h + wobble(6));
  // Left edge
  ctx.quadraticCurveTo(x + wobble(7), y + h / 2, x, y + wobble(8));
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

/**
 * Organic Polygon for Diamond shapes in ink mode.
 */
function drawOrganicPolygon(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  color: string,
  width: number,
  seed: number
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    const midX = (pts[i][0] + next[0]) / 2 + Math.sin((i + seed) * 2) * 0.6;
    const midY = (pts[i][1] + next[1]) / 2 + Math.cos((i + seed) * 2) * 0.6;
    ctx.quadraticCurveTo(midX, midY, next[0], next[1]);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/**
 * Technical Hachure Hatching in native Canvas.
 */
function drawHatching(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.75;
  ctx.globalAlpha = 0.25;

  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const step = 8;
  const diag = w + h;
  for (let d = -diag; d < diag * 2; d += step) {
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + d + h, y + h);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders selectable endpoint markers (none | arrow | diamond | circle).
 */
export function renderEndpointMarker(
  ctx: CanvasRenderingContext2D,
  tip: { x: number; y: number },
  angle: number,
  marker: EndpointMarker = 'none',
  color: string,
  strokeWidth: number
): void {
  if (!marker || marker === 'none') return;

  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);

  if (marker === 'arrow') {
    const headLen = 12;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-headLen, -headLen * 0.45);
    ctx.lineTo(-headLen, headLen * 0.45);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  } else if (marker === 'diamond') {
    const size = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.6);
    ctx.lineTo(-size * 2, 0);
    ctx.lineTo(-size, size * 0.6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  } else if (marker === 'circle') {
    const radius = 5;
    ctx.beginPath();
    ctx.arc(-radius, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders an edge connector with native Path2D precision and crisp arrowheads.
 */
export function renderEdge(
  edge: CanvasEdge,
  nodes: Record<string, CanvasNode>,
  _unusedRc: any,
  renderCtx: RenderContext
): void {
  const { ctx, theme, globalRenderMode, spatialIndex, selectedIds } = renderCtx;
  const strokeColor = resolveColor(edge.color, theme);
  const strokeWidth = edge._ext?.strokeWidth || 2;
  const mode: RenderMode = edge._ext?.renderMode || globalRenderMode || 'precision';

  const routed = routeEdge(edge, nodes, spatialIndex);
  const points = routed.points;
  if (points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  if (mode === 'blueprint') {
    // Drafting dashed hairline for blueprint connectors
    ctx.setLineDash([6, 3]);
  } else {
    ctx.setLineDash([]);
  }

  if (routed.routing === 'curved' && points.length === 4) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.bezierCurveTo(
      points[1].x,
      points[1].y,
      points[2].x,
      points[2].y,
      points[3].x,
      points[3].y
    );
    ctx.stroke();

    // Endpoints
    const startAngle = Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x);
    const endAngle = Math.atan2(points[3].y - points[2].y, points[3].x - points[2].x);

    renderEndpointMarker(ctx, points[0], startAngle, edge.fromEnd, strokeColor, strokeWidth);
    renderEndpointMarker(ctx, points[3], endAngle, edge.toEnd, strokeColor, strokeWidth);
  } else {
    // Elbow or Straight
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Endpoints
    const p0 = points[0];
    const p1 = points[1];
    const pn = points[points.length - 1];
    const pnPrev = points[points.length - 2];

    const startAngle = Math.atan2(p0.y - p1.y, p0.x - p1.x);
    const endAngle = Math.atan2(pn.y - pnPrev.y, pn.x - pnPrev.x);

    renderEndpointMarker(ctx, p0, startAngle, edge.fromEnd, strokeColor, strokeWidth);
    renderEndpointMarker(ctx, pn, endAngle, edge.toEnd, strokeColor, strokeWidth);

    // Interactive Middle Segment Drag Handle when selected
    const isSelected = selectedIds.has(edge.id);
    if (isSelected && routed.routing === 'elbow' && routed.middleSegmentIndex !== undefined) {
      const segA = points[routed.middleSegmentIndex];
      const segB = points[routed.middleSegmentIndex + 1];
      if (segA && segB) {
        const midSegX = (segA.x + segB.x) / 2;
        const midSegY = (segA.y + segB.y) / 2;

        ctx.save();
        ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (routed.isMiddleVertical) {
          ctx.roundRect(midSegX - 3.5, midSegY - 9, 7, 18, 3);
        } else {
          ctx.roundRect(midSegX - 9, midSegY - 3.5, 18, 7, 3);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Draw Midpoint Technical Label
  if (edge.label && edge.label.trim().length > 0) {
    const midIdx = Math.floor(points.length / 2);
    const midPt = points[midIdx] || points[0];

    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    const textMetrics = ctx.measureText(edge.label);
    const badgeW = textMetrics.width + 12;
    const badgeH = 18;

    // Sharp badge
    ctx.fillStyle = theme === 'dark' ? '#11151D' : '#FFFFFF';
    ctx.strokeStyle = theme === 'dark' ? '#1F2633' : '#E4E4E7';
    ctx.lineWidth = 1;
    ctx.fillRect(midPt.x - badgeW / 2, midPt.y - badgeH / 2, badgeW, badgeH);
    ctx.strokeRect(midPt.x - badgeW / 2, midPt.y - badgeH / 2, badgeW, badgeH);

    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(edge.label, midPt.x, midPt.y);
  }

  ctx.restore();
}

/**
 * Draws precision magnetic anchor ports with luminous emerald halo.
 */
export function drawMagneticPorts(
  node: CanvasNode,
  ctx: CanvasRenderingContext2D,
  activeSide?: ConnectionSide,
  theme: 'light' | 'dark' = 'light'
): void {
  const emerald = getEmeraldAccent(theme);
  const sides: ConnectionSide[] = ['top', 'right', 'bottom', 'left'];

  for (const side of sides) {
    const pt = getAnchorPoint(node, side);
    const isTarget = activeSide === side;

    ctx.save();
    // Glowing halo ring
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isTarget ? 8 : 5.5, 0, Math.PI * 2);
    ctx.fillStyle = isTarget ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(5, 150, 105, 0.25)') : 'transparent';
    ctx.fill();

    // Technical Target Anchor Ring
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isTarget ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isTarget ? emerald : (theme === 'dark' ? '#0B0E14' : '#FFFFFF');
    ctx.strokeStyle = emerald;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = emerald;
    ctx.shadowBlur = isTarget ? 8 : 3;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Renders technical selection bounding box, diamond-shaped resize handles (7px),
 * and live W × H dimension telemetry badge.
 */
export function renderSelectionOverlay(
  bounds: BoundingBox,
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  theme: 'light' | 'dark' = 'light'
): void {
  const emerald = getEmeraldAccent(theme);
  ctx.save();
  ctx.strokeStyle = emerald;
  ctx.lineWidth = 1.5 / camera.zoom;

  // Box border
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  ctx.strokeRect(bounds.minX, bounds.minY, width, height);

  // 8 Diamond-shaped Resize Handles (7px size)
  const dSize = 3.5 / camera.zoom;

  const positions: [number, number, ResizeHandle][] = [
    [bounds.minX, bounds.minY, 'nw'],
    [bounds.minX + width / 2, bounds.minY, 'n'],
    [bounds.maxX, bounds.minY, 'ne'],
    [bounds.maxX, bounds.minY + height / 2, 'e'],
    [bounds.maxX, bounds.maxY, 'se'],
    [bounds.minX + width / 2, bounds.maxY, 's'],
    [bounds.minX, bounds.maxY, 'sw'],
    [bounds.minX, bounds.minY + height / 2, 'w'],
  ];

  for (const [hx, hy] of positions) {
    ctx.beginPath();
    // Diamond path
    ctx.moveTo(hx, hy - dSize);
    ctx.lineTo(hx + dSize, hy);
    ctx.lineTo(hx, hy + dSize);
    ctx.lineTo(hx - dSize, hy);
    ctx.closePath();
    ctx.fillStyle = theme === 'dark' ? '#11151D' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = emerald;
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.stroke();
  }

  // Live W × H Dimension Badge underneath selection
  const badgeText = `${Math.round(width)} × ${Math.round(height)} px`;
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = (badgeMetrics.width + 10) / camera.zoom;
  const badgeH = 16 / camera.zoom;
  const badgeX = bounds.minX + width / 2 - badgeW / 2;
  const badgeY = bounds.maxY + 8 / camera.zoom;

  ctx.fillStyle = theme === 'dark' ? '#11151D' : '#FFFFFF';
  ctx.strokeStyle = theme === 'dark' ? '#1F2633' : '#E4E4E7';
  ctx.lineWidth = 1 / camera.zoom;
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
  ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

  ctx.fillStyle = theme === 'dark' ? '#9CA3AF' : '#4B5563';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

  ctx.restore();
}

/**
 * Renders fading laser pointer trail with smooth glow.
 */
export function renderLaser(
  points: LaserPoint[],
  ctx: CanvasRenderingContext2D,
  now = Date.now()
): void {
  if (points.length < 2) return;

  const maxAge = 1200;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const age = now - p2.time;
    if (age > maxAge) continue;

    const opacity = Math.max(0, 1 - age / maxAge);
    const strokeWidth = (1 - age / maxAge) * 5 + 1.5;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = `rgba(239, 68, 68, ${opacity})`;
    ctx.lineWidth = strokeWidth;
    ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
    ctx.shadowBlur = 6;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Renders remote multiplayer cursors and user badges.
 */
export function renderRemoteCursors(
  users: UserAwareness[],
  ctx: CanvasRenderingContext2D,
  currentPageId: string,
  camera: Camera
): void {
  ctx.save();

  for (const user of users) {
    if (!user.cursor || user.pageId !== currentPageId) continue;

    const { x, y } = user.cursor;
    const color = user.color || '#10B981';

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 / camera.zoom, 1 / camera.zoom);

    // Modern Drafting Stylus Pointer
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(4, 12);
    ctx.lineTo(8, 20);
    ctx.lineTo(11, 18);
    ctx.lineTo(7, 11);
    ctx.lineTo(12, 11);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // User Tag
    if (user.name) {
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      const textMetrics = ctx.measureText(user.name);
      const tagWidth = textMetrics.width + 8;
      const tagHeight = 16;

      ctx.beginPath();
      ctx.rect(12, 12, tagWidth, tagHeight);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(user.name, 16, 12 + tagHeight / 2);
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders crisp 1px dashed Emerald alignment guides with small 'x' intersection markers.
 */
export function renderSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuide[],
  theme: 'light' | 'dark'
): void {
  if (!guides || guides.length === 0) return;

  const emerald = getEmeraldAccent(theme);
  ctx.save();
  ctx.strokeStyle = emerald;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (const guide of guides) {
    ctx.beginPath();
    if (guide.type === 'vertical') {
      ctx.moveTo(guide.pos, guide.start);
      ctx.lineTo(guide.pos, guide.end);
      ctx.stroke();

      renderCrossMarker(ctx, guide.pos, guide.start, emerald);
      renderCrossMarker(ctx, guide.pos, guide.end, emerald);
    } else {
      ctx.moveTo(guide.start, guide.pos);
      ctx.lineTo(guide.end, guide.pos);
      ctx.stroke();

      renderCrossMarker(ctx, guide.start, guide.pos, emerald);
      renderCrossMarker(ctx, guide.end, guide.pos, emerald);
    }
  }

  ctx.restore();
}

function renderCrossMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  const size = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders CAD-style distance measurement lines with pixel gap telemetry badge.
 */
export function renderDistanceMeasurement(
  ctx: CanvasRenderingContext2D,
  measurement: DistanceMeasurement,
  theme: 'light' | 'dark'
): void {
  const { axis, gap, x1, y1, x2, y2 } = measurement;
  if (gap <= 0) return;

  const accentColor = theme === 'dark' ? '#10B981' : '#059669';
  ctx.save();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  // Dimension line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Tick markers at ends
  ctx.setLineDash([]);
  const tickSize = 4;
  if (axis === 'horizontal') {
    ctx.beginPath();
    ctx.moveTo(x1, y1 - tickSize);
    ctx.lineTo(x1, y1 + tickSize);
    ctx.moveTo(x2, y2 - tickSize);
    ctx.lineTo(x2, y2 + tickSize);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1 - tickSize, y1);
    ctx.lineTo(x1 + tickSize, y1);
    ctx.moveTo(x2 - tickSize, y2);
    ctx.lineTo(x2 + tickSize, y2);
    ctx.stroke();
  }

  // Distance Badge
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const label = `${gap}px`;

  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  const textMetrics = ctx.measureText(label);
  const badgeW = textMetrics.width + 10;
  const badgeH = 16;

  ctx.fillStyle = theme === 'dark' ? '#11151D' : '#FFFFFF';
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
  ctx.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

  ctx.fillStyle = accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, midX, midY);

  ctx.restore();
}
