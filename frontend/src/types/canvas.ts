// JSON Canvas 1.0 compatible schema with namespaced _ext extensions

export type ShapeType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'frame'
  // DSA Smart Kit
  | 'dsa-array'
  | 'dsa-linked-list'
  | 'dsa-binary-tree'
  | 'dsa-stack'
  | 'dsa-queue'
  // System Design Smart Kit
  | 'sys-load-balancer'
  | 'sys-api-gateway'
  | 'sys-microservice'
  | 'sys-database'
  | 'sys-cache'
  | 'sys-queue'
  | 'sys-client'
  // Custom Plugin Nodes
  | 'plugin-code-block'
  | 'plugin-latex-math'
  | (string & {});
export type RenderMode = 'precision' | 'blueprint' | 'ink';
export type FillStyle = 'none' | 'solid' | 'hachure' | 'cross-hatch';
export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';
export type EndpointMarker = 'none' | 'arrow' | 'diamond' | 'circle';
export type ArrowEnd = EndpointMarker; // backwards-compatible alias
export type RoutingMode = 'straight' | 'curved' | 'elbow';

export type ToolType =
  | 'select'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'frame'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'eraser'
  | 'text'
  | 'laser';

export interface NodeExtension {
  shape?: ShapeType;
  renderMode?: RenderMode;
  roughness?: number;
  seed?: number;
  freehandPoints?: number[][]; // [x, y, pressure?]
  strokeWidth?: number;
  fillStyle?: FillStyle;
  zIndex?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fontSize?: number;
  isFreehand?: boolean;
  frameTitle?: string;
  frameOrder?: number;
  // Domain Smart Kit Extensions
  isKit?: boolean;
  kitCategory?: 'dsa' | 'system' | 'erd';
  arrayCells?: string[];
  linkedListNext?: string;
  erdFields?: { name: string; type: string; isPk?: boolean; isFk?: boolean }[];
  iconType?: string;
}

export interface CanvasNode {
  id: string; // 16-char hex
  type: 'text' | 'group' | 'shape' | 'frame';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // standard hex or JSON Canvas color enum 1-6
  text?: string;
  _ext?: NodeExtension;
}

export interface EdgeExtension {
  renderMode?: RenderMode;
  points?: number[][]; // [x, y][] waypoints
  strokeWidth?: number;
  roughness?: number;
  seed?: number;
  routing?: RoutingMode;
  segmentOffset?: number; // User-dragged offset for elbow middle segment
  waypoints?: { x: number; y: number }[];
}

export interface CanvasEdge {
  id: string; // 16-char hex
  fromNode: string;
  fromSide?: ConnectionSide;
  fromEnd?: EndpointMarker;
  toNode: string;
  toSide?: ConnectionSide;
  toEnd?: EndpointMarker;
  color?: string;
  label?: string;
  routing?: RoutingMode;
  _ext?: EdgeExtension;
}

export interface PageData {
  id: string;
  name: string;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  createdAt: number;
}

export interface JSONCanvasDoc {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface UserAwareness {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number } | null;
  pageId?: string;
  viewport?: Camera;
  isPresenter?: boolean;
  lastActive?: number;
}

export interface LaserPoint {
  x: number;
  y: number;
  time: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  pos: number;
  start: number;
  end: number;
}

export interface DistanceMeasurement {
  fromBox: BoundingBox;
  toBox: BoundingBox;
  axis: 'horizontal' | 'vertical';
  gap: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}


