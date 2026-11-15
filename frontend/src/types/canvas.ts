// JSON Canvas 1.0 compatible schema with namespaced _ext extensions

export type ShapeType = 'rectangle' | 'diamond' | 'ellipse';
export type RenderMode = 'precision' | 'blueprint' | 'ink';
export type FillStyle = 'none' | 'solid' | 'hachure' | 'cross-hatch';
export type ConnectionSide = 'top' | 'right' | 'bottom' | 'left';
export type ArrowEnd = 'none' | 'arrow';

export type ToolType =
  | 'select'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
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
}

export interface CanvasNode {
  id: string; // 16-char hex
  type: 'text' | 'group' | 'shape';
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
}

export interface CanvasEdge {
  id: string; // 16-char hex
  fromNode: string;
  fromSide?: ConnectionSide;
  fromEnd?: ArrowEnd;
  toNode: string;
  toSide?: ConnectionSide;
  toEnd?: ArrowEnd;
  color?: string;
  label?: string;
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

