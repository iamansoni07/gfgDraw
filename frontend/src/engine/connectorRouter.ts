import {
  CanvasNode,
  CanvasEdge,
  ConnectionSide,
  EndpointMarker,
  RoutingMode,
  BoundingBox,
} from '../types/canvas';
import { SpatialIndex } from './spatialIndex';

export interface Point {
  x: number;
  y: number;
}

export interface RoutedPath {
  points: Point[];
  routing: RoutingMode;
  middleSegmentIndex?: number;
  isMiddleVertical?: boolean;
}

/**
 * Returns the anchor point coordinate on a node boundary for a given side.
 */
export function getAnchorPoint(node: CanvasNode, side: ConnectionSide): Point {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;

  switch (side) {
    case 'top':
      return { x: x + w / 2, y };
    case 'right':
      return { x: x + w, y: y + h / 2 };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    case 'left':
      return { x, y: y + h / 2 };
    default:
      return { x: x + w / 2, y: y + h / 2 };
  }
}

/**
 * Returns the outward unit normal vector for an anchor side.
 */
export function getSideNormal(side: ConnectionSide): Point {
  switch (side) {
    case 'top':
      return { x: 0, y: -1 };
    case 'right':
      return { x: 1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    default:
      return { x: 1, y: 0 };
  }
}

/**
 * Checks if a horizontal line segment (from (x1, y) to (x2, y)) intersects a bounding box.
 */
function horizontalSegmentIntersectsBox(
  x1: number,
  x2: number,
  y: number,
  box: BoundingBox
): boolean {
  if (y < box.minY || y > box.maxY) return false;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  return maxX > box.minX && minX < box.maxX;
}

/**
 * Checks if a vertical line segment (from (x, y1) to (x, y2)) intersects a bounding box.
 */
function verticalSegmentIntersectsBox(
  x: number,
  y1: number,
  y2: number,
  box: BoundingBox
): boolean {
  if (x < box.minX || x > box.maxX) return false;
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return maxY > box.minY && minY < box.maxY;
}

/**
 * Simplifies a sequence of orthogonal points by collapsing redundant collinear points.
 */
export function simplifyOrthogonalPath(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Collinear horizontally
    const isCollinearH = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    // Collinear vertically
    const isCollinearV = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    // Coincident
    const isDuplicate = Math.hypot(curr.x - prev.x, curr.y - prev.y) < 1;

    if (!isCollinearH && !isCollinearV && !isDuplicate) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Routes an orthogonal path around obstacles using RBush queries.
 */
function routeAroundObstacles(
  rawPoints: Point[],
  fromNodeId: string,
  toNodeId: string,
  nodes: Record<string, CanvasNode>,
  spatialIndex?: SpatialIndex
): Point[] {
  if (!spatialIndex || rawPoints.length < 2) {
    return rawPoints;
  }

  const PADDING = 16;
  const result: Point[] = [rawPoints[0]];

  for (let i = 0; i < rawPoints.length - 1; i++) {
    const pA = rawPoints[i];
    const pB = rawPoints[i + 1];

    const isHorizontal = Math.abs(pA.y - pB.y) < 1;
    const isVertical = Math.abs(pA.x - pB.x) < 1;

    // Segment bounds
    const segBox: BoundingBox = {
      minX: Math.min(pA.x, pB.x),
      minY: Math.min(pA.y, pB.y),
      maxX: Math.max(pA.x, pB.x),
      maxY: Math.max(pA.y, pB.y),
    };

    // Query spatial items intersecting this segment
    const hits = spatialIndex.queryBox(segBox);
    let obstacle: BoundingBox | null = null;

    for (const hit of hits) {
      if (hit.kind === 'node' && hit.id !== fromNodeId && hit.id !== toNodeId) {
        const node = nodes[hit.id];
        if (node && node.type !== 'frame') {
          const paddedBox: BoundingBox = {
            minX: node.x - PADDING,
            minY: node.y - PADDING,
            maxX: node.x + node.width + PADDING,
            maxY: node.y + node.height + PADDING,
          };

          if (isHorizontal && horizontalSegmentIntersectsBox(pA.x, pB.x, pA.y, paddedBox)) {
            obstacle = paddedBox;
            break;
          } else if (isVertical && verticalSegmentIntersectsBox(pA.x, pA.y, pB.y, paddedBox)) {
            obstacle = paddedBox;
            break;
          }
        }
      }
    }

    if (obstacle) {
      if (isHorizontal) {
        // Detour above or below the obstacle
        const detourY =
          Math.abs(pA.y - obstacle.minY) < Math.abs(pA.y - obstacle.maxY)
            ? obstacle.minY - 6
            : obstacle.maxY + 6;

        const dirX = Math.sign(pB.x - pA.x) || 1;
        const startDetourX = dirX > 0 ? obstacle.minX - 6 : obstacle.maxX + 6;
        const endDetourX = dirX > 0 ? obstacle.maxX + 6 : obstacle.minX - 6;

        result.push({ x: startDetourX, y: pA.y });
        result.push({ x: startDetourX, y: detourY });
        result.push({ x: endDetourX, y: detourY });
        result.push({ x: endDetourX, y: pB.y });
      } else if (isVertical) {
        // Detour left or right of the obstacle
        const detourX =
          Math.abs(pA.x - obstacle.minX) < Math.abs(pA.x - obstacle.maxX)
            ? obstacle.minX - 6
            : obstacle.maxX + 6;

        const dirY = Math.sign(pB.y - pA.y) || 1;
        const startDetourY = dirY > 0 ? obstacle.minY - 6 : obstacle.maxY + 6;
        const endDetourY = dirY > 0 ? obstacle.maxY + 6 : obstacle.minY - 6;

        result.push({ x: pA.x, y: startDetourY });
        result.push({ x: detourX, y: startDetourY });
        result.push({ x: detourX, y: endDetourY });
        result.push({ x: pB.x, y: endDetourY });
      }
    }

    result.push(pB);
  }

  return simplifyOrthogonalPath(result);
}

/**
 * Computes 90-degree orthogonal elbow routing with 24px stubs and user offset.
 */
export function computeElbowPath(
  p1: Point,
  fromSide: ConnectionSide,
  p2: Point,
  toSide: ConnectionSide,
  userOffset = 0,
  fromNodeId?: string,
  toNodeId?: string,
  nodes?: Record<string, CanvasNode>,
  spatialIndex?: SpatialIndex
): RoutedPath {
  const STUB = 24;
  const n1 = getSideNormal(fromSide);
  const n2 = getSideNormal(toSide);

  const s1: Point = { x: p1.x + n1.x * STUB, y: p1.y + n1.y * STUB };
  const s2: Point = { x: p2.x + n2.x * STUB, y: p2.y + n2.y * STUB };

  const rawPoints: Point[] = [p1, s1];
  const isFromHorizontal = fromSide === 'left' || fromSide === 'right';
  const isToHorizontal = toSide === 'left' || toSide === 'right';

  let isMiddleVertical = true;

  if (isFromHorizontal && isToHorizontal) {
    // Both horizontal (e.g. right -> left or right -> right)
    const canDirectBridge =
      (fromSide === 'right' && toSide === 'left' && s1.x < s2.x) ||
      (fromSide === 'left' && toSide === 'right' && s1.x > s2.x);

    if (canDirectBridge) {
      // Standard 3-segment Z/S shape with a vertical middle segment
      const midX = (s1.x + s2.x) / 2 + userOffset;
      rawPoints.push({ x: midX, y: s1.y });
      rawPoints.push({ x: midX, y: s2.y });
      isMiddleVertical = true;
    } else {
      // Loop around with a horizontal transit
      const midY =
        Math.abs(s1.y - s2.y) < 40
          ? Math.min(s1.y, s2.y) - 50 + userOffset
          : (s1.y + s2.y) / 2 + userOffset;

      rawPoints.push({ x: s1.x, y: midY });
      rawPoints.push({ x: s2.x, y: midY });
      isMiddleVertical = false;
    }
  } else if (!isFromHorizontal && !isToHorizontal) {
    // Both vertical (e.g. bottom -> top or top -> top)
    const canDirectBridge =
      (fromSide === 'bottom' && toSide === 'top' && s1.y < s2.y) ||
      (fromSide === 'top' && toSide === 'bottom' && s1.y > s2.y);

    if (canDirectBridge) {
      // Horizontal middle segment
      const midY = (s1.y + s2.y) / 2 + userOffset;
      rawPoints.push({ x: s1.x, y: midY });
      rawPoints.push({ x: s2.x, y: midY });
      isMiddleVertical = false;
    } else {
      const midX =
        Math.abs(s1.x - s2.x) < 40
          ? Math.max(s1.x, s2.x) + 50 + userOffset
          : (s1.x + s2.x) / 2 + userOffset;

      rawPoints.push({ x: midX, y: s1.y });
      rawPoints.push({ x: midX, y: s2.y });
      isMiddleVertical = true;
    }
  } else if (isFromHorizontal && !isToHorizontal) {
    // Horizontal start, vertical end (e.g. right -> top or right -> bottom)
    const corner: Point = { x: s2.x + userOffset, y: s1.y };
    if (userOffset !== 0) {
      rawPoints.push({ x: s2.x + userOffset, y: s1.y });
      rawPoints.push({ x: s2.x + userOffset, y: s2.y });
      isMiddleVertical = true;
    } else {
      rawPoints.push(corner);
    }
  } else {
    // Vertical start, horizontal end (e.g. bottom -> right or top -> left)
    const corner: Point = { x: s1.x, y: s2.y + userOffset };
    if (userOffset !== 0) {
      rawPoints.push({ x: s1.x, y: s2.y + userOffset });
      rawPoints.push({ x: s2.x, y: s2.y + userOffset });
      isMiddleVertical = false;
    } else {
      rawPoints.push(corner);
    }
  }

  rawPoints.push(s2);
  rawPoints.push(p2);

  const simplified = simplifyOrthogonalPath(rawPoints);

  // Apply obstacle avoidance if spatial index is available
  const obstacleAvoided =
    fromNodeId && toNodeId && nodes && spatialIndex
      ? routeAroundObstacles(simplified, fromNodeId, toNodeId, nodes, spatialIndex)
      : simplified;

  // Middle segment is located around the center of the waypoints
  const midSegIndex = Math.max(1, Math.floor(obstacleAvoided.length / 2) - 1);

  return {
    points: obstacleAvoided,
    routing: 'elbow',
    middleSegmentIndex: midSegIndex,
    isMiddleVertical,
  };
}

/**
 * Computes routing for an edge according to its routing mode ("straight" | "curved" | "elbow").
 */
export function routeEdge(
  edge: CanvasEdge,
  nodes: Record<string, CanvasNode>,
  spatialIndex?: SpatialIndex
): RoutedPath {
  const fromNode = nodes[edge.fromNode];
  const toNode = nodes[edge.toNode];

  if (!fromNode || !toNode) {
    return { points: [], routing: 'straight' };
  }

  const fromSide = edge.fromSide || 'right';
  const toSide = edge.toSide || 'left';
  const p1 = getAnchorPoint(fromNode, fromSide);
  const p2 = getAnchorPoint(toNode, toSide);

  const routing: RoutingMode = edge.routing || edge._ext?.routing || 'elbow';

  if (routing === 'straight') {
    return {
      points: [p1, p2],
      routing: 'straight',
    };
  }

  if (routing === 'curved') {
    const STUB = 40;
    const n1 = getSideNormal(fromSide);
    const n2 = getSideNormal(toSide);
    const cp1: Point = { x: p1.x + n1.x * STUB, y: p1.y + n1.y * STUB };
    const cp2: Point = { x: p2.x + n2.x * STUB, y: p2.y + n2.y * STUB };

    return {
      points: [p1, cp1, cp2, p2],
      routing: 'curved',
    };
  }

  // Orthogonal Elbow Mode
  const userOffset = edge._ext?.segmentOffset || 0;
  return computeElbowPath(
    p1,
    fromSide,
    p2,
    toSide,
    userOffset,
    edge.fromNode,
    edge.toNode,
    nodes,
    spatialIndex
  );
}

/**
 * Checks if a point is near a line segment within a tolerance distance.
 */
export function isPointNearSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tolerance = 8
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1) <= tolerance;
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY) <= tolerance;
}

/**
 * Hit tests an edge's routed path to check if (px, py) is on or near the connector.
 */
export function hitTestEdge(
  px: number,
  py: number,
  routedPath: RoutedPath,
  tolerance = 8
): { hit: boolean; isMiddleSegment: boolean; segmentIndex: number } {
  const { points, routing, middleSegmentIndex } = routedPath;

  if (points.length < 2) {
    return { hit: false, isMiddleSegment: false, segmentIndex: -1 };
  }

  if (routing === 'curved' && points.length === 4) {
    // Sample 20 points along the cubic Bezier curve
    const [p0, p1, p2, p3] = points;
    const samples: Point[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x =
        u * u * u * p0.x +
        3 * u * u * t * p1.x +
        3 * u * t * t * p2.x +
        t * t * t * p3.x;
      const y =
        u * u * u * p0.y +
        3 * u * u * t * p1.y +
        3 * u * t * t * p2.y +
        t * t * t * p3.y;
      samples.push({ x, y });
    }

    for (let i = 0; i < samples.length - 1; i++) {
      if (
        isPointNearSegment(
          px,
          py,
          samples[i].x,
          samples[i].y,
          samples[i + 1].x,
          samples[i + 1].y,
          tolerance
        )
      ) {
        return { hit: true, isMiddleSegment: false, segmentIndex: i };
      }
    }
    return { hit: false, isMiddleSegment: false, segmentIndex: -1 };
  }

  // Straight and Elbow segments
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (isPointNearSegment(px, py, a.x, a.y, b.x, b.y, tolerance)) {
      const isMiddle = i === middleSegmentIndex;
      return { hit: true, isMiddleSegment: isMiddle, segmentIndex: i };
    }
  }

  return { hit: false, isMiddleSegment: false, segmentIndex: -1 };
}

