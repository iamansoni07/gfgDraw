import React from 'react';
import {
  MousePointer2,
  Square,
  Diamond,
  Circle,
  ArrowUpRight,
  Minus,
  PenTool,
  Type,
  Flame,
  Eraser,
  Undo2,
  Redo2,
  Lock,
} from 'lucide-react';
import { ToolType } from '../types/canvas';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  readOnly?: boolean;
  theme: 'light' | 'dark';
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  readOnly = false,
  theme,
}) => {
  if (readOnly) {
    return (
      <aside
        aria-label="Read-only tool strip"
        className="fixed left-0 top-[44px] bottom-[30px] w-[48px] z-30 flex flex-col items-center py-3 border-r select-none transition-colors"
        style={{
          backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
          borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
        }}
      >
        <div className="p-2 text-amber-500" title="Viewer Mode (Locked)">
          <Lock className="w-4 h-4" />
        </div>
        <div className="h-[1px] w-6 bg-zinc-200 dark:bg-zinc-800 my-2" />
        <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 rotate-90 origin-center mt-6">
          LOCKED
        </span>
      </aside>
    );
  }

  const toolGroups: {
    id: ToolType;
    label: string;
    icon: React.ReactNode;
    shortcut: string;
  }[][] = [
    [
      { id: 'select', label: 'Select', icon: <MousePointer2 className="w-4 h-4" />, shortcut: 'V' },
    ],
    [
      { id: 'rectangle', label: 'Rectangle', icon: <Square className="w-4 h-4" />, shortcut: 'R' },
      { id: 'diamond', label: 'Diamond', icon: <Diamond className="w-4 h-4" />, shortcut: 'D' },
      { id: 'ellipse', label: 'Ellipse', icon: <Circle className="w-4 h-4" />, shortcut: 'O' },
    ],
    [
      { id: 'arrow', label: 'Connector', icon: <ArrowUpRight className="w-4 h-4" />, shortcut: 'A' },
      { id: 'line', label: 'Line', icon: <Minus className="w-4 h-4" />, shortcut: 'L' },
    ],
    [
      { id: 'pen', label: 'Ink Pen', icon: <PenTool className="w-4 h-4" />, shortcut: 'P' },
      { id: 'text', label: 'Text Card', icon: <Type className="w-4 h-4" />, shortcut: 'T' },
      { id: 'laser', label: 'Laser Pointer', icon: <Flame className="w-4 h-4 text-red-500" />, shortcut: 'K' },
      { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" />, shortcut: 'E' },
    ],
  ];

  return (
    <aside
      aria-label="Architectural Tool Strip"
      className="fixed left-0 top-[44px] bottom-[30px] w-[48px] z-30 flex flex-col items-center justify-between py-2 border-r select-none transition-colors"
      style={{
        backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
      }}
    >
      {/* Top Tools List */}
      <div className="flex flex-col items-center w-full gap-1">
        {toolGroups.map((group, gIdx) => (
          <React.Fragment key={gIdx}>
            {gIdx > 0 && <div className="h-[1px] w-6 bg-zinc-200 dark:bg-zinc-800 my-1" />}
            {group.map((tool) => {
              const isActive = activeTool === tool.id;
              return (
                <div key={tool.id} className="relative group w-full flex justify-center">
                  <button
                    type="button"
                    onClick={() => onSelectTool(tool.id)}
                    aria-label={tool.label}
                    className={`relative w-[40px] h-[34px] flex items-center justify-center rounded transition-colors ${
                      isActive
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    {/* Emerald Left Indicator Bar on Active Tool */}
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-emerald-600 dark:bg-emerald-400 rounded-r" />
                    )}
                    {tool.icon}
                  </button>

                  {/* Monospace Right Tooltip */}
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium whitespace-nowrap shadow-lg z-50 animate-in fade-in duration-75">
                    <span>{tool.label}</span>
                    <kbd className="px-1 py-0.2 rounded bg-zinc-800 dark:bg-zinc-200 font-mono text-[9px] text-zinc-300 dark:text-zinc-700">
                      {tool.shortcut}
                    </kbd>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Bottom Undo / Redo */}
      <div className="flex flex-col items-center w-full gap-1 pt-1 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z / Ctrl+Z)"
          className="w-[36px] h-[30px] flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⌘Y / Ctrl+Y)"
          className="w-[36px] h-[30px] flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
