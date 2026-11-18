import { describe, it, expect } from 'vitest';
import { SpatialIndex, getNodeBoundingBox, getEdgeBoundingBox } from '../../frontend/src/engine/spatialIndex';
import { CanvasNode, CanvasEdge } from '../../frontend/src/types/canvas';

describe('SpatialIndex Engine & R-Tree Culling', () => {
  it('calculates node bounding boxes with stroke padding', () => {
    const node: CanvasNode = {
      id: 'node-1',
      type: 'shape',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      _ext: {
        strokeWidth: 2,
      },
    };

    const bbox = getNodeBoundingBox(node);
    expect(bbox.minX).toBe(100 - 4); // 96
    expect(bbox.minY).toBe(100 - 4); // 96
    expect(bbox.maxX).toBe(300 + 4); // 304
    expect(bbox.maxY).toBe(250 + 4); // 254
  });

  it('calculates freehand ink stroke bounding boxes', () => {
    const node: CanvasNode = {
      id: 'ink-1',
      type: 'shape',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      _ext: {
        strokeWidth: 4,
        freehandPoints: [
          [10, 20, 0.5],
          [50, 80, 0.8],
          [120, 40, 0.4],
        ],
      },
    };

    const bbox = getNodeBoundingBox(node);
    // minX = 10 - 8 = 2, maxX = 120 + 8 = 128
    expect(bbox.minX).toBe(2);
    expect(bbox.maxX).toBe(128);
    // minY = 20 - 8 = 12, maxY = 80 + 8 = 88
    expect(bbox.minY).toBe(12);
    expect(bbox.maxY).toBe(88);
  });

  it('indexes and hit-tests multiple nodes with O(log n) efficiency', () => {
    const spatialIndex = new SpatialIndex();
    const nodes: Record<string, CanvasNode> = {
      'node-a': {
        id: 'node-a',
        type: 'shape',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
      'node-b': {
        id: 'node-b',
        type: 'shape',
        x: 500,
        y: 500,
        width: 100,
        height: 100,
      },
      'node-c': {
        id: 'node-c',
        type: 'shape',
        x: 1000,
        y: 1000,
        width: 100,
        height: 100,
      },
    };

    spatialIndex.rebuild(nodes, {});

    // Point inside node-a
    const hitA = spatialIndex.hitTest(50, 50, 8);
    expect(hitA.length).toBe(1);
    expect(hitA[0].id).toBe('node-a');

    // Point in empty space
    const hitEmpty = spatialIndex.hitTest(300, 300, 8);
    expect(hitEmpty.length).toBe(0);

    // Viewport query culling only node-a and node-b
    const viewportHits = spatialIndex.queryViewport({
      minX: -50,
      minY: -50,
      maxX: 700,
      maxY: 700,
    });
    const hitIds = viewportHits.map((h) => h.id);
    expect(hitIds).toContain('node-a');
    expect(hitIds).toContain('node-b');
    expect(hitIds).not.toContain('node-c');
  });

  it('correctly handles edge bounding box search', () => {
    const spatialIndex = new SpatialIndex();
    const nodes: Record<string, CanvasNode> = {
      'node-1': { id: 'node-1', type: 'shape', x: 0, y: 0, width: 50, height: 50 },
      'node-2': { id: 'node-2', type: 'shape', x: 200, y: 200, width: 50, height: 50 },
    };
    const edges: Record<string, CanvasEdge> = {
      'edge-1': {
        id: 'edge-1',
        fromNode: 'node-1',
        toNode: 'node-2',
      },
    };

    spatialIndex.rebuild(nodes, edges);
    const results = spatialIndex.queryBox({ minX: 50, minY: 50, maxX: 150, maxY: 150 });
    const edgeHit = results.find((r) => r.kind === 'edge');
    expect(edgeHit).toBeDefined();
    expect(edgeHit?.id).toBe('edge-1');
  });
});

