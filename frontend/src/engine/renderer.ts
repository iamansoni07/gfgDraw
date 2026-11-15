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
} from '../types/canvas';

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

/**
 * Organic Rectangle with deterministic subtle harmonic stroke modulation.
 */
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
 * Renders an edge connector with native Path2D precision and crisp arrowheads.
 */
export function renderEdge(
  edge: CanvasEdge,
  nodes: Record<string, CanvasNode>,
  _unusedRc: any,
  renderCtx: RenderContext
): void {
  const { ctx, theme, globalRenderMode } = renderCtx;
  const strokeColor = resolveColor(edge.color, theme);
  const strokeWidth = edge._ext?.strokeWidth || 2;
  const mode: RenderMode = edge._ext?.renderMode || globalRenderMode || 'precision';

  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;

  if (edge._ext?.points && edge._ext.points.length >= 2) {
    startX = edge._ext.points[0][0];
    startY = edge._ext.points[0][1];
    endX = edge._ext.points[edge._ext.points.length - 1][0];
    endY = edge._ext.points[edge._ext.points.length - 1][1];
  } else {
    const fromNode = nodes[edge.fromNode];
    const toNode = nodes[edge.toNode];
    if (!fromNode || !toNode) return;

    const fromPt = getAnchorPoint(fromNode, edge.fromSide || 'right');
    const toPt = getAnchorPoint(toNode, edge.toSide || 'left');
    startX = fromPt.x;
    startY = fromPt.y;
    endX = toPt.x;
    endY = toPt.y;
  }

  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  if (mode === 'blueprint') {
    // Drafting dashed hairline for blueprint connectors
    ctx.setLineDash([6, 3]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Arrowhead
  if (edge.toEnd === 'arrow') {
    const angle = Math.atan2(endY - startY, endX - startX);
    const headLen = 12;
    const arrowP1X = endX - headLen * Math.cos(angle - Math.PI / 6);
    const arrowP1Y = endY - headLen * Math.sin(angle - Math.PI / 6);
    const arrowP2X = endX - headLen * Math.cos(angle + Math.PI / 6);
    const arrowP2Y = endY - headLen * Math.sin(angle + Math.PI / 6);

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(arrowP1X, arrowP1Y);
    ctx.lineTo(arrowP2X, arrowP2Y);
    ctx.closePath();
    ctx.fillStyle = strokeColor;
    ctx.fill();
  }

  // Draw Midpoint Technical Label
  if (edge.label && edge.label.trim().length > 0) {
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    const textMetrics = ctx.measureText(edge.label);
    const badgeW = textMetrics.width + 12;
    const badgeH = 18;

    // Sharp badge
    ctx.fillStyle = theme === 'dark' ? '#11151D' : '#FFFFFF';
    ctx.strokeStyle = theme === 'dark' ? '#1F2633' : '#E4E4E7';
    ctx.lineWidth = 1;
    ctx.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
    ctx.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(edge.label, midX, midY);
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
