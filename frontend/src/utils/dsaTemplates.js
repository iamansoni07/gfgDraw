import { convertToExcalidrawElements } from '@excalidraw/excalidraw';

const STROKE = '#2F9E44';
const FILL = '#EBFBEE';
const LABEL = '#1F2937';

const shapeStyle = {
  strokeColor: STROKE,
  backgroundColor: FILL,
  fillStyle: 'solid',
  strokeWidth: 2,
  roughness: 0,
};

const arrowStyle = {
  strokeColor: STROKE,
  strokeWidth: 2,
  roughness: 0,
  endArrowhead: 'arrow',
};

const ARRAY_VALUES = [12, 7, 19, 3, 25];

export function createBinaryTreeTemplate(centerX, centerY) {
  const nodeSize = 76;
  const levelGap = 130;
  const siblingGap = 120;

  const rootX = centerX - nodeSize / 2;
  const rootY = centerY - levelGap / 2 - 10;
  const childY = rootY + levelGap;
  const leftX = centerX - siblingGap - nodeSize / 2;
  const rightX = centerX + siblingGap - nodeSize / 2;

  return convertToExcalidrawElements([
    {
      type: 'ellipse',
      id: 'bt-root',
      x: rootX,
      y: rootY,
      width: nodeSize,
      height: nodeSize,
      ...shapeStyle,
      label: { text: '10', fontSize: 22, strokeColor: LABEL },
    },
    {
      type: 'ellipse',
      id: 'bt-left',
      x: leftX,
      y: childY,
      width: nodeSize,
      height: nodeSize,
      ...shapeStyle,
      label: { text: '5', fontSize: 22, strokeColor: LABEL },
    },
    {
      type: 'ellipse',
      id: 'bt-right',
      x: rightX,
      y: childY,
      width: nodeSize,
      height: nodeSize,
      ...shapeStyle,
      label: { text: '15', fontSize: 22, strokeColor: LABEL },
    },
    {
      type: 'arrow',
      id: 'bt-edge-left',
      x: rootX + nodeSize / 2,
      y: rootY + nodeSize,
      ...arrowStyle,
      start: { id: 'bt-root' },
      end: { id: 'bt-left' },
    },
    {
      type: 'arrow',
      id: 'bt-edge-right',
      x: rootX + nodeSize / 2,
      y: rootY + nodeSize,
      ...arrowStyle,
      start: { id: 'bt-root' },
      end: { id: 'bt-right' },
    },
  ]);
}

export function createArrayTemplate(centerX, centerY, length = 5) {
  const cellSize = 72;
  const gap = 0;
  const values = ARRAY_VALUES.slice(0, length);
  while (values.length < length) {
    values.push(values.length);
  }

  const totalWidth = values.length * cellSize + (values.length - 1) * gap;
  const startX = centerX - totalWidth / 2;
  const cellY = centerY - cellSize / 2;
  const indexY = cellY - 28;

  const skeletons = values.flatMap((value, index) => [
    {
      type: 'rectangle',
      id: `arr-cell-${index}`,
      x: startX + index * (cellSize + gap),
      y: cellY,
      width: cellSize,
      height: cellSize,
      ...shapeStyle,
      label: { text: String(value), fontSize: 20, strokeColor: LABEL },
    },
    {
      type: 'text',
      id: `arr-idx-${index}`,
      x: startX + index * (cellSize + gap) + cellSize / 2 - 6,
      y: indexY,
      text: String(index),
      fontSize: 16,
      strokeColor: STROKE,
    },
  ]);

  return convertToExcalidrawElements(skeletons);
}

export function createLinkedListTemplate(centerX, centerY) {
  const dataW = 72;
  const nextW = 32;
  const nodeH = 56;
  const nodeW = dataW + nextW;
  const gap = 56;
  const values = [10, 20, 30];

  const totalWidth = values.length * nodeW + values.length * gap;
  const startX = centerX - totalWidth / 2;
  const nodeY = centerY - nodeH / 2;

  const skeletons = [];

  values.forEach((value, index) => {
    const x = startX + index * (nodeW + gap);
    const dataId = `ll-data-${index}`;
    const nextId = `ll-next-${index}`;

    skeletons.push(
      {
        type: 'rectangle',
        id: dataId,
        x,
        y: nodeY,
        width: dataW,
        height: nodeH,
        ...shapeStyle,
        label: { text: String(value), fontSize: 20, strokeColor: LABEL },
      },
      {
        type: 'rectangle',
        id: nextId,
        x: x + dataW,
        y: nodeY,
        width: nextW,
        height: nodeH,
        ...shapeStyle,
        backgroundColor: '#D3F9D8',
        label: { text: '•', fontSize: 18, strokeColor: STROKE },
      },
    );

    if (index < values.length - 1) {
      skeletons.push({
        type: 'arrow',
        id: `ll-edge-${index}`,
        x: x + nodeW,
        y: nodeY + nodeH / 2,
        ...arrowStyle,
        start: { id: nextId },
        end: { id: `ll-data-${index + 1}` },
      });
    } else {
      skeletons.push(
        {
          type: 'text',
          id: 'll-null',
          x: x + nodeW + gap - 8,
          y: nodeY + nodeH / 2 - 12,
          text: 'NULL',
          fontSize: 18,
          strokeColor: STROKE,
        },
        {
          type: 'arrow',
          id: 'll-edge-null',
          x: x + nodeW,
          y: nodeY + nodeH / 2,
          ...arrowStyle,
          start: { id: nextId },
          end: { id: 'll-null' },
        },
      );
    }
  });

  return convertToExcalidrawElements(skeletons);
}

export const DSA_TEMPLATES = [
  {
    id: 'binary-tree',
    name: 'Binary Tree',
    description: 'Root 10 with left 5 and right 15, linked by arrows.',
    category: 'Trees',
    generator: createBinaryTreeTemplate,
  },
  {
    id: 'array',
    name: 'Array',
    description: 'Five adjacent cells (12, 7, 19, 3, 25) with index labels.',
    category: 'Linear',
    generator: createArrayTemplate,
  },
  {
    id: 'singly-linked-list',
    name: 'Singly Linked List',
    description: '10 → 20 → 30 → NULL with data and next compartments.',
    category: 'Linear',
    generator: createLinkedListTemplate,
  },
];
