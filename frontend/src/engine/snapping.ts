import {
  BoundingBox,
  CanvasNode,
  SnapGuide,
  DistanceMeasurement,
} from '../types/canvas';
import { SpatialIndex } from './spatialIndex';

export interface SnapResult {
  deltaX: number;
  deltaY: number;
  guides: SnapGuide[];
}

const SNAP_THRESHOLD = 6; // Snap distance in world pixels

/**
 * Computes magnetic snapping for a moving or resizing bounding box against other nodes in the scene.
 */
export function computeSnap(
  draggedBox: BoundingBox,
  excludeNodeIds: Set<string>,
  nodes: Record<string, CanvasNode>,
  spatialIndex: SpatialIndex
): SnapResult {
  const queryPad = 120;
  const searchArea: BoundingBox = {
    minX: draggedBox.minX - queryPad,
    minY: draggedBox.minY - queryPad,
    maxX: draggedBox.maxX + queryPad,
    maxY: draggedBox.maxY + queryPad,
  };

  const nearbyItems = spatialIndex.queryBox(searchArea);
  const candidateBoxes: BoundingBox[] = [];

  for (const item of nearbyItems) {
    if (item.kind === 'node' && !excludeNodeIds.has(item.id)) {
      const node = nodes[item.id];
      if (node && node.type !== 'frame') {
        candidateBoxes.push({
          minX: node.x,
          minY: node.y,
          maxX: node.x + node.width,
          maxY: node.y + node.height,
        });
      }
    }
  }

  if (candidateBoxes.length === 0) {
    return { deltaX: 0, deltaY: 0, guides: [] };
  }

  const dLeft = draggedBox.minX;
  const dRight = draggedBox.maxX;
  const dMidX = (dLeft + dRight) / 2;

  const dTop = draggedBox.minY;
  const dBottom = draggedBox.maxY;
  const dMidY = (dTop + dBottom) / 2;

  let bestDiffX = Infinity;
  let snapDeltaX = 0;
  let activeGuideX: SnapGuide | null = null;

  let bestDiffY = Infinity;
  let snapDeltaY = 0;
  let activeGuideY: SnapGuide | null = null;

  // Snapping on X-Axis (vertical guide lines)
  const xTargets = [
    { pos: dLeft, offset: 0 },
    { pos: dMidX, offset: dMidX - dLeft },
    { pos: dRight, offset: dRight - dLeft },
  ];

  for (const cand of candidateBoxes) {
    const cMidX = (cand.minX + cand.maxX) / 2;
    const cXEdges = [cand.minX, cMidX, cand.maxX];

    for (const t of xTargets) {
      for (const edgeX of cXEdges) {
        const diff = edgeX - t.pos;
        if (Math.abs(diff) <= SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestDiffX)) {
          bestDiffX = diff;
          snapDeltaX = diff;
          activeGuideX = {
            type: 'vertical',
            pos: edgeX,
            start: Math.min(dTop, cand.minY) - 20,
            end: Math.max(dBottom, cand.maxY) + 20,
          };
        }
      }
    }
  }

  // Snapping on Y-Axis (horizontal guide lines)
  const yTargets = [
    { pos: dTop, offset: 0 },
    { pos: dMidY, offset: dMidY - dTop },
    { pos: dBottom, offset: dBottom - dTop },
  ];

  for (const cand of candidateBoxes) {
    const cMidY = (cand.minY + cand.maxY) / 2;
    const cYEdges = [cand.minY, cMidY, cand.maxY];

    for (const t of yTargets) {
      for (const edgeY of cYEdges) {
        const diff = edgeY - t.pos;
        if (Math.abs(diff) <= SNAP_THRESHOLD && Math.abs(diff) < Math.abs(bestDiffY)) {
          bestDiffY = diff;
          snapDeltaY = diff;
          activeGuideY = {
            type: 'horizontal',
            pos: edgeY,
            start: Math.min(dLeft, cand.minX) - 20,
            end: Math.max(dRight, cand.maxX) + 20,
          };
        }
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (activeGuideX) guides.push(activeGuideX);
  if (activeGuideY) guides.push(activeGuideY);

  return {
    deltaX: snapDeltaX,
    deltaY: snapDeltaY,
    guides,
  };
}

/**
 * Computes exact CAD-style distance measurement between selected bounds and a hovered node bounds.
 */
export function computeDistanceMeasurement(
  selectedBox: BoundingBox,
  hoveredBox: BoundingBox
): DistanceMeasurement | null {
  // Check horizontal relationship
  const isRight = hoveredBox.minX >= selectedBox.maxX;
  const isLeft = hoveredBox.maxX <= selectedBox.minX;
  const isBelow = hoveredBox.minY >= selectedBox.maxY;
  const isAbove = hoveredBox.maxY <= selectedBox.minY;

  // Overlap ranges
  const overlapY =
    Math.min(selectedBox.maxY, hoveredBox.maxY) - Math.max(selectedBox.minY, hoveredBox.minY);
  const overlapX =
    Math.min(selectedBox.maxX, hoveredBox.maxX) - Math.max(selectedBox.minX, hoveredBox.minX);

  if (isRight || isLeft) {
    const gap = isRight
      ? Math.round(hoveredBox.minX - selectedBox.maxX)
      : Math.round(selectedBox.minX - hoveredBox.maxX);

    const midY =
      overlapY > 0
        ? (Math.max(selectedBox.minY, hoveredBox.minY) + Math.min(selectedBox.maxY, hoveredBox.maxY)) / 2
        : ((selectedBox.minY + selectedBox.maxY) / 2 + (hoveredBox.minY + hoveredBox.maxY) / 2) / 2;

    const x1 = isRight ? selectedBox.maxX : hoveredBox.maxX;
    const x2 = isRight ? hoveredBox.minX : selectedBox.minX;

    return {
      fromBox: selectedBox,
      toBox: hoveredBox,
      axis: 'horizontal',
      gap,
      x1,
      y1: midY,
      x2,
      y2: midY,
    };
  }

  if (isBelow || isAbove) {
    const gap = isBelow
      ? Math.round(hoveredBox.minY - selectedBox.maxY)
      : Math.round(selectedBox.minY - hoveredBox.maxY);

    const midX =
      overlapX > 0
        ? (Math.max(selectedBox.minX, hoveredBox.minX) + Math.min(selectedBox.maxX, hoveredBox.maxX)) / 2
        : ((selectedBox.minX + selectedBox.maxX) / 2 + (hoveredBox.minX + hoveredBox.maxX) / 2) / 2;

    const y1 = isBelow ? selectedBox.maxY : hoveredBox.maxY;
    const y2 = isBelow ? hoveredBox.minY : selectedBox.minY;

    return {
      fromBox: selectedBox,
      toBox: hoveredBox,
      axis: 'vertical',
      gap,
      x1: midX,
      y1,
      x2: midX,
      y2,
    };
  }

  return null;
}

