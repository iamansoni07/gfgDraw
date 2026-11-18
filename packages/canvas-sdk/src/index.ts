export { GfgDrawCanvas } from './GfgDrawCanvas';
export type { GfgDrawCanvasProps } from './GfgDrawCanvas';

export { useGfgDrawStore } from './useGfgDrawStore';
export type { UseGfgDrawStoreOptions } from './useGfgDrawStore';

export {
  PluginRegistry,
  registerPlugin,
  unregisterPlugin,
  getActivePlugins,
  CodeSnippetCardPlugin,
  LatexMathBlockPlugin,
  BuiltInExportersPlugin,
} from '../../../frontend/src/sdk/pluginApi';
export type {
  GfgPlugin,
  PluginDefinition,
  PluginContext,
  CustomExporter,
  CustomNodeDefinition,
  CustomNodeRenderer,
} from '../../../frontend/src/sdk/pluginApi';

export type {
  CanvasNode,
  CanvasEdge,
  PageData,
  JSONCanvasDoc,
  Camera,
  RenderMode,
  ToolType,
  ShapeType,
  FillStyle,
  ConnectionSide,
  RoutingMode,
  EndpointMarker,
  BoundingBox,
  UserAwareness,
} from '../../../frontend/src/types/canvas';

export { SpatialIndex } from '../../../frontend/src/engine/spatialIndex';
export { routeEdge } from '../../../frontend/src/engine/connectorRouter';
export { parseMermaidFlowchart, serializeCanvasToMermaid } from '../../../frontend/src/engine/diagramCodeSync';
export { sanitizeHtml, sanitizeSvgText, sanitizeMarkdownSpec } from '../../../frontend/src/engine/sanitize';
