import { describe, it, expect } from 'vitest';
import {
  getAnchorPoint,
  getSideNormal,
  simplifyOrthogonalPath,
  computeElbowPath,
  routeEdge,
  hitTestEdge,
} from '../../frontend/src/engine/connectorRouter';
import { CanvasNode, CanvasEdge } from '../../frontend/src/types/canvas';
import { SpatialIndex } from '../../frontend/src/engine/spatialIndex';

describe('Connector Router & Smart Orthogonal Routing Engine', () => {
  const nodeA: CanvasNode = {
    id: 'node-a',
    type: 'shape',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  };

  const nodeB: CanvasNode = {
    id: 'node-b',
    type: 'shape',
    x: 400,
    y: 100,
    width: 100,
    height: 100,
  };

  it('computes accurate cardinal anchor points for nodes', () => {
    expect(getAnchorPoint(nodeA, 'top')).toEqual({ x: 150, y: 100 });
    expect(getAnchorPoint(nodeA, 'right')).toEqual({ x: 200, y: 150 });
    expect(getAnchorPoint(nodeA, 'bottom')).toEqual({ x: 150, y: 200 });
    expect(getAnchorPoint(nodeA, 'left')).toEqual({ x: 100, y: 150 });
  });

  it('returns unit normal vectors for sides', () => {
    expect(getSideNormal('top')).toEqual({ x: 0, y: -1 });
    expect(getSideNormal('right')).toEqual({ x: 1, y: 0 });
    expect(getSideNormal('bottom')).toEqual({ x: 0, y: 1 });
    expect(getSideNormal('left')).toEqual({ x: -1, y: 0 });
  });

  it('simplifies collinear orthogonal segments', () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    const simplified = simplifyOrthogonalPath(raw);
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('computes orthogonal elbow route between opposite sides with 24px stubs', () => {
    const p1 = getAnchorPoint(nodeA, 'right'); // { x: 200, y: 150 }
    const p2 = getAnchorPoint(nodeB, 'left');  // { x: 400, y: 150 }

    const routed = computeElbowPath(p1, 'right', p2, 'left');
    expect(routed.routing).toBe('elbow');
    expect(routed.points.length).toBeGreaterThanOrEqual(2);
    // Start at p1, end at p2
    expect(routed.points[0]).toEqual(p1);
    expect(routed.points[routed.points.length - 1]).toEqual(p2);
  });

  it('routes straight and curved edges properly', () => {
    const edgeStraight: CanvasEdge = {
      id: 'e-straight',
      fromNode: 'node-a',
      toNode: 'node-b',
      fromSide: 'right',
      toSide: 'left',
      _ext: { routing: 'straight' },
    };

    const edgeCurved: CanvasEdge = {
      id: 'e-curved',
      fromNode: 'node-a',
      toNode: 'node-b',
      fromSide: 'right',
      toSide: 'left',
      _ext: { routing: 'curved' },
    };

    const nodes = { 'node-a': nodeA, 'node-b': nodeB };
    const rStraight = routeEdge(edgeStraight, nodes);
    expect(rStraight.routing).toBe('straight');
    expect(rStraight.points.length).toBe(2);

    const rCurved = routeEdge(edgeCurved, nodes);
    expect(rCurved.routing).toBe('curved');
    expect(rCurved.points.length).toBe(4);
  });

  it('hit-tests connector line segments and identifies middle drag segment', () => {
    const p1 = { x: 0, y: 100 };
    const p2 = { x: 100, y: 100 };
    const routed: any = {
      points: [p1, p2],
      routing: 'straight',
      middleSegmentIndex: 0,
      isMiddleVertical: false,
    };

    const hitResult = hitTestEdge(50, 100, routed, 8);
    expect(hitResult.hit).toBe(true);

    const missResult = hitTestEdge(50, 200, routed, 8);
    expect(missResult.hit).toBe(false);
  });

  it('navigates around intermediate obstacle with spatial index', () => {
    const spatialIndex = new SpatialIndex();
    const obstacleNode: CanvasNode = {
      id: 'obstacle',
      type: 'shape',
      x: 250,
      y: 120,
      width: 60,
      height: 60,
    };
    const allNodes = { 'node-a': nodeA, 'node-b': nodeB, obstacle: obstacleNode };
    spatialIndex.rebuild(allNodes, {});

    const p1 = getAnchorPoint(nodeA, 'right');
    const p2 = getAnchorPoint(nodeB, 'left');
    const routed = computeElbowPath(
      p1,
      'right',
      p2,
      'left',
      0,
      'node-a',
      'node-b',
      allNodes,
      spatialIndex
    );

    expect(routed.points.length).toBeGreaterThan(2);
    // Confirm no segment cuts straight through obstacle center
    const cutsObstacleCenter = routed.points.some(
      (pt) => pt.x > obstacleNode.x && pt.x < obstacleNode.x + obstacleNode.width &&
              pt.y > obstacleNode.y && pt.y < obstacleNode.y + obstacleNode.height
    );
    expect(cutsObstacleCenter).toBe(false);
  });
});

