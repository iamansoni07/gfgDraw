import RBush from 'rbush';
import { CanvasNode, CanvasEdge, BoundingBox } from '../types/canvas';

export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  kind: 'node' | 'edge';
}

/**
 * Calculates the bounding box for a canvas node.
 */
export function getNodeBoundingBox(node: CanvasNode): BoundingBox {
  if (node._ext?.freehandPoints && node._ext.freehandPoints.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of node._ext.freehandPoints) {
      minX = Math.min(minX, pt[0]);
      minY = Math.min(minY, pt[1]);
      maxX = Math.max(maxX, pt[0]);
      maxY = Math.max(maxY, pt[1]);
    }
    const pad = (node._ext?.strokeWidth || 4) + 4;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }

  const pad = (node._ext?.strokeWidth || 2) + 2;
  return {
    minX: node.x - pad,
    minY: node.y - pad,
    maxX: node.x + node.width + pad,
    maxY: node.y + node.height + pad,
  };
}

/**
 * Calculates the bounding box for an edge given source and target node positions.
 */
export function getEdgeBoundingBox(
  edge: CanvasEdge,
  nodes: Record<string, CanvasNode>
): BoundingBox | null {
  if (edge._ext?.points && edge._ext.points.length >= 2) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of edge._ext.points) {
      minX = Math.min(minX, pt[0]);
      minY = Math.min(minY, pt[1]);
      maxX = Math.max(maxX, pt[0]);
      maxY = Math.max(maxY, pt[1]);
    }
    const pad = 12;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }

  const fromNode = nodes[edge.fromNode];
  const toNode = nodes[edge.toNode];
  if (!fromNode || !toNode) {
    return null;
  }

  const pad = 16;
  const minX = Math.min(fromNode.x, toNode.x) - pad;
  const minY = Math.min(fromNode.y, toNode.y) - pad;
  const maxX = Math.max(fromNode.x + fromNode.width, toNode.x + toNode.width) + pad;
  const maxY = Math.max(fromNode.y + fromNode.height, toNode.y + toNode.height) + pad;

  return { minX, minY, maxX, maxY };
}

export class SpatialIndex {
  private tree: RBush<SpatialItem>;

  constructor() {
    this.tree = new RBush<SpatialItem>(16);
  }

  /**
   * Rebuilds spatial index from the active page nodes and edges.
   */
  public rebuild(
    nodes: Record<string, CanvasNode>,
    edges: Record<string, CanvasEdge>
  ): void {
    this.tree.clear();
    const items: SpatialItem[] = [];

    for (const node of Object.values(nodes)) {
      const bounds = getNodeBoundingBox(node);
      items.push({
        ...bounds,
        id: node.id,
        kind: 'node',
      });
    }

    for (const edge of Object.values(edges)) {
      const bounds = getEdgeBoundingBox(edge, nodes);
      if (bounds) {
        items.push({
          ...bounds,
          id: edge.id,
          kind: 'edge',
        });
      }
    }

    if (items.length > 0) {
      this.tree.load(items);
    }
  }

  /**
   * Returns all items intersecting the viewport bounding box (O(log n) culling).
   */
  public queryViewport(bounds: BoundingBox): SpatialItem[] {
    return this.tree.search(bounds);
  }

  /**
   * Returns items intersecting a marquee selection box.
   */
  public queryBox(box: BoundingBox): SpatialItem[] {
    return this.tree.search(box);
  }

  /**
   * Hit test a single point in world coordinates.
   */
  public hitTest(
    x: number,
    y: number,
    tolerance = 8
  ): SpatialItem[] {
    return this.tree.search({
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance,
    });
  }
}

