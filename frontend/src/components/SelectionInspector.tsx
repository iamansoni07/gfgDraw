import React from 'react';
import {
  Trash2,
  Layers,
  Copy,
  PenTool,
  Ruler,
  Compass,
} from 'lucide-react';
import { CanvasNode, CanvasEdge, Camera, BoundingBox, RenderMode, FillStyle } from '../types/canvas';
import { worldToScreen } from '../engine/camera';

interface SelectionInspectorProps {
  selectedNodes: CanvasNode[];
  selectedEdges: CanvasEdge[];
  bounds: BoundingBox;
  camera: Camera;
  theme: 'light' | 'dark';
  onChangeColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeFillStyle: (fillStyle: FillStyle) => void;
  onChangeRenderMode: (mode: RenderMode) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const SWATCHES = [
  '#111827', // Slate / Primary Ink
  '#059669', // Emerald Accent
  '#2563EB', // Blueprint / Sapphire
  '#7C3AED', // Amethyst
  '#DC2626', // Crimson
  '#D97706', // Amber
];

export const SelectionInspector: React.FC<SelectionInspectorProps> = ({
  selectedNodes,
  selectedEdges,
  bounds,
  camera,
  theme,
  onChangeColor,
  onChangeStrokeWidth,
  onChangeFillStyle,
  onChangeRenderMode,
  onDelete,
  onDuplicate,
}) => {
  const primaryNode = selectedNodes[0];
  const primaryEdge = selectedEdges[0];

  const currentColor =
    primaryNode?.color || primaryNode?._ext?.strokeColor || primaryEdge?.color || '#059669';
  const currentWidth =
    primaryNode?._ext?.strokeWidth || primaryEdge?._ext?.strokeWidth || 2;
  const currentRenderMode: RenderMode =
    primaryNode?._ext?.renderMode || primaryEdge?._ext?.renderMode || 'precision';
  const currentFill = primaryNode?._ext?.fillStyle || 'none';

  // Calculate screen position: 10px above top bounding box center (accounting for 68px left rail + 64px header/ruler)
  const canvasOffsetX = 68;
  const canvasOffsetY = 64;
  const topLeftScreen = worldToScreen(bounds.minX, bounds.minY, camera);
  const bottomRightScreen = worldToScreen(bounds.maxX, bounds.maxY, camera);

  const screenCenterX = (topLeftScreen.x + bottomRightScreen.x) / 2 + canvasOffsetX;
  const screenTopY = topLeftScreen.y + canvasOffsetY;

  // Clamp within viewport so inspector doesn't clip offscreen
  const posX = Math.max(220, Math.min(window.innerWidth - 200, screenCenterX));
  const posY = Math.max(76, screenTopY - 10);

  return (
    <div
      className="fixed z-50 transform -translate-x-1/2 -translate-y-full flex items-center gap-2 p-1.5 px-3 rounded-md border shadow-lg backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: `${posX}px`,
        top: `${posY}px`,
        backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
        boxShadow: theme === 'dark' ? '0 8px 24px -4px rgba(0,0,0,0.5)' : '0 8px 24px -4px rgba(0,0,0,0.1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Color Swatches */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-zinc-200 dark:border-[#1F2633]">
        {SWATCHES.map((color) => {
          const isSelected = currentColor.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChangeColor(color)}
              style={{ backgroundColor: color }}
              title={`Color ${color}`}
              className={`w-3.5 h-3.5 rounded-sm border transition-all ${
                isSelected
                  ? 'ring-2 ring-emerald-500 ring-offset-1 border-white dark:ring-offset-gray-900 scale-110'
                  : 'border-black/10 dark:border-white/20 hover:scale-110'
              }`}
            />
          );
        })}
      </div>

      {/* Stroke Width Selector (1px, 2px, 4px) */}
      <div className="flex items-center gap-1 pr-2 border-r border-zinc-200 dark:border-[#1F2633]">
        {[
          { label: 'Hairline', width: 1, height: 'h-[1px]' },
          { label: 'Medium', width: 2, height: 'h-[2px]' },
          { label: 'Bold', width: 4, height: 'h-[3px]' },
        ].map((item) => {
          const isActive = Math.abs(currentWidth - item.width) < 0.6;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onChangeStrokeWidth(item.width)}
              title={`${item.label} (${item.width}px)`}
              className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A202C]'
              }`}
            >
              <span className={`w-3 bg-current ${item.height}`} />
            </button>
          );
        })}
      </div>

      {/* Style Mode: Precision | Blueprint | Ink */}
      <div className="flex items-center gap-0.5 p-0.5 rounded bg-zinc-100 dark:bg-[#161C26] border border-zinc-200 dark:border-[#1F2633] text-[11px] font-mono">
        {(['precision', 'blueprint', 'ink'] as RenderMode[]).map((mode) => {
          const isActive = currentRenderMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeRenderMode(mode)}
              title={`Render Style: ${mode.toUpperCase()}`}
              className={`px-2 py-0.5 rounded capitalize transition-all ${
                isActive
                  ? 'bg-emerald-500 text-white font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {mode}
            </button>
          );
        })}
      </div>

      {/* Fill Style Toggle (Shapes only) */}
      {selectedNodes.some((n) => n._ext?.shape) && (
        <div className="flex items-center gap-0.5 pl-1.5 border-l border-zinc-200 dark:border-[#1F2633]">
          {(['none', 'solid', 'hachure'] as FillStyle[]).map((f) => {
            const isActive = currentFill === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onChangeFillStyle(f)}
                title={`Fill: ${f}`}
                className={`px-1.5 py-0.5 text-[10px] uppercase font-mono rounded transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {f === 'none' ? 'Empty' : f === 'solid' ? 'Fill' : 'Hatch'}
              </button>
            );
          })}
        </div>
      )}

      {/* Duplicate */}
      <button
        type="button"
        onClick={onDuplicate}
        title="Duplicate (Ctrl+D)"
        className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A202C] transition-colors ml-1"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        title="Delete Selection (Delete / Backspace)"
        className="p-1 rounded text-red-500 hover:bg-red-500/15 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

