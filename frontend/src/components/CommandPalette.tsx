import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  MousePointer2,
  Square,
  Diamond,
  Circle,
  Frame,
  ArrowUpRight,
  PenTool,
  Type,
  Flame,
  Eraser,
  Play,
  Grid,
  Sun,
  Moon,
  Maximize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  Layers,
  Copy,
  Download,
  FileCode,
  Image,
  FileText,
  Plus,
} from 'lucide-react';
import { ToolType, RenderMode } from '../types/canvas';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Tools' | 'Styles' | 'View & Stage' | 'Arrange & Selection' | 'Export & Document';
  shortcut?: string;
  icon: React.ReactNode;
  perform: () => void;
  disabled?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  onSelectTool: (tool: ToolType) => void;
  onSelectRenderMode: (mode: RenderMode) => void;
  onToggleGrid: () => void;
  onToggleTheme: () => void;
  onZoomToFit: () => void;
  onStartPresentation: () => void;
  onAlign: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onCreatePage: () => void;
  onExportCanvas: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF: () => void;
  hasSelection: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  theme,
  onSelectTool,
  onSelectRenderMode,
  onToggleGrid,
  onToggleTheme,
  onZoomToFit,
  onStartPresentation,
  onAlign,
  onDistribute,
  onBringToFront,
  onSendToBack,
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
  onCreatePage,
  onExportCanvas,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  hasSelection,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commands: CommandItem[] = useMemo(
    () => [
      // Tools
      {
        id: 'tool-select',
        title: 'Select Tool',
        category: 'Tools',
        shortcut: 'V',
        icon: <MousePointer2 className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('select'),
      },
      {
        id: 'tool-rect',
        title: 'Rectangle Tool',
        category: 'Tools',
        shortcut: 'R',
        icon: <Square className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('rectangle'),
      },
      {
        id: 'tool-diamond',
        title: 'Diamond Tool',
        category: 'Tools',
        shortcut: 'D',
        icon: <Diamond className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('diamond'),
      },
      {
        id: 'tool-ellipse',
        title: 'Ellipse Tool',
        category: 'Tools',
        shortcut: 'O',
        icon: <Circle className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('ellipse'),
      },
      {
        id: 'tool-frame',
        title: 'Frame / Slide Tool',
        category: 'Tools',
        shortcut: 'F',
        icon: <Frame className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('frame'),
      },
      {
        id: 'tool-arrow',
        title: 'Connector Arrow Tool',
        category: 'Tools',
        shortcut: 'A',
        icon: <ArrowUpRight className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('arrow'),
      },
      {
        id: 'tool-pen',
        title: 'Ink Pen Tool',
        category: 'Tools',
        shortcut: 'P',
        icon: <PenTool className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('pen'),
      },
      {
        id: 'tool-text',
        title: 'Text Card Tool',
        category: 'Tools',
        shortcut: 'T',
        icon: <Type className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('text'),
      },
      {
        id: 'tool-laser',
        title: 'Laser Pointer Tool',
        category: 'Tools',
        shortcut: 'K',
        icon: <Flame className="w-3.5 h-3.5 text-red-500" />,
        perform: () => onSelectTool('laser'),
      },
      {
        id: 'tool-eraser',
        title: 'Eraser Tool',
        category: 'Tools',
        shortcut: 'E',
        icon: <Eraser className="w-3.5 h-3.5" />,
        perform: () => onSelectTool('eraser'),
      },

      // Styles
      {
        id: 'style-precision',
        title: 'Precision Style (Clean Vector)',
        category: 'Styles',
        icon: <Square className="w-3.5 h-3.5" />,
        perform: () => onSelectRenderMode('precision'),
      },
      {
        id: 'style-blueprint',
        title: 'Blueprint Style (Drafting Hairlines)',
        category: 'Styles',
        icon: <Square className="w-3.5 h-3.5 text-blue-400" />,
        perform: () => onSelectRenderMode('blueprint'),
      },
      {
        id: 'style-ink',
        title: 'Ink Style (Organic Modulation)',
        category: 'Styles',
        icon: <PenTool className="w-3.5 h-3.5" />,
        perform: () => onSelectRenderMode('ink'),
      },

      // View & Stage
      {
        id: 'view-present',
        title: 'Start Slide Presentation Mode',
        category: 'View & Stage',
        shortcut: '⌘Enter',
        icon: <Play className="w-3.5 h-3.5 text-emerald-500" />,
        perform: onStartPresentation,
      },
      {
        id: 'view-zoom-fit',
        title: 'Zoom to Fit Diagram',
        category: 'View & Stage',
        shortcut: '⇧1',
        icon: <Maximize2 className="w-3.5 h-3.5" />,
        perform: onZoomToFit,
      },
      {
        id: 'view-toggle-grid',
        title: 'Toggle Dot Grid',
        category: 'View & Stage',
        shortcut: 'G',
        icon: <Grid className="w-3.5 h-3.5" />,
        perform: onToggleGrid,
      },
      {
        id: 'view-toggle-theme',
        title: `Switch to ${theme === 'dark' ? 'Studio Paper (Light)' : 'Carbon Studio (Dark)'}`,
        category: 'View & Stage',
        icon: theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />,
        perform: onToggleTheme,
      },

      // Arrange & Selection
      {
        id: 'align-left',
        title: 'Align Left',
        category: 'Arrange & Selection',
        icon: <AlignLeft className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onAlign('left'),
      },
      {
        id: 'align-center',
        title: 'Align Center (Horizontal)',
        category: 'Arrange & Selection',
        icon: <AlignCenter className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onAlign('center'),
      },
      {
        id: 'align-right',
        title: 'Align Right',
        category: 'Arrange & Selection',
        icon: <AlignRight className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onAlign('right'),
      },
      {
        id: 'align-top',
        title: 'Align Top',
        category: 'Arrange & Selection',
        icon: <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onAlign('top'),
      },
      {
        id: 'align-middle',
        title: 'Align Middle (Vertical)',
        category: 'Arrange & Selection',
        icon: <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onAlign('middle'),
      },
      {
        id: 'align-bottom',
        title: 'Align Bottom',
        category: 'Arrange & Selection',
        icon: <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onAlign('bottom'),
      },
      {
        id: 'distribute-h',
        title: 'Distribute Horizontally',
        category: 'Arrange & Selection',
        icon: <AlignCenter className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onDistribute('horizontal'),
      },
      {
        id: 'distribute-v',
        title: 'Distribute Vertically',
        category: 'Arrange & Selection',
        icon: <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: () => onDistribute('vertical'),
      },
      {
        id: 'layer-front',
        title: 'Bring to Front',
        category: 'Arrange & Selection',
        shortcut: ']',
        icon: <Layers className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: onBringToFront,
      },
      {
        id: 'layer-back',
        title: 'Send to Back',
        category: 'Arrange & Selection',
        shortcut: '[',
        icon: <Layers className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: onSendToBack,
      },
      {
        id: 'edit-copy',
        title: 'Copy Selection',
        category: 'Arrange & Selection',
        shortcut: '⌘C',
        icon: <Copy className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: onCopy,
      },
      {
        id: 'edit-paste',
        title: 'Paste from Clipboard',
        category: 'Arrange & Selection',
        shortcut: '⌘V',
        icon: <Copy className="w-3.5 h-3.5" />,
        perform: onPaste,
      },
      {
        id: 'edit-duplicate',
        title: 'Duplicate Selection',
        category: 'Arrange & Selection',
        shortcut: '⌘D',
        icon: <Copy className="w-3.5 h-3.5" />,
        disabled: !hasSelection,
        perform: onDuplicate,
      },
      {
        id: 'edit-delete',
        title: 'Delete Selection',
        category: 'Arrange & Selection',
        shortcut: '⌫',
        icon: <Eraser className="w-3.5 h-3.5 text-red-500" />,
        disabled: !hasSelection,
        perform: onDelete,
      },

      // Export & Document
      {
        id: 'doc-new-page',
        title: 'Create New Canvas Page',
        category: 'Export & Document',
        icon: <Plus className="w-3.5 h-3.5" />,
        perform: onCreatePage,
      },
      {
        id: 'export-pdf',
        title: 'Export Frames as PDF Presentation',
        category: 'Export & Document',
        icon: <FileText className="w-3.5 h-3.5 text-emerald-500" />,
        perform: onExportPDF,
      },
      {
        id: 'export-canvas',
        title: 'Export JSON Canvas 1.0 (.canvas)',
        category: 'Export & Document',
        icon: <FileCode className="w-3.5 h-3.5" />,
        perform: onExportCanvas,
      },
      {
        id: 'export-png',
        title: 'Export High-Res PNG Image',
        category: 'Export & Document',
        icon: <Image className="w-3.5 h-3.5" />,
        perform: onExportPNG,
      },
      {
        id: 'export-svg',
        title: 'Export Clean Vector SVG',
        category: 'Export & Document',
        icon: <Download className="w-3.5 h-3.5" />,
        perform: onExportSVG,
      },
    ],
    [
      onSelectTool,
      onSelectRenderMode,
      onToggleGrid,
      onToggleTheme,
      onZoomToFit,
      onStartPresentation,
      onAlign,
      onDistribute,
      onBringToFront,
      onSendToBack,
      onDuplicate,
      onCopy,
      onPaste,
      onDelete,
      onCreatePage,
      onExportCanvas,
      onExportPNG,
      onExportSVG,
      onExportPDF,
      theme,
      hasSelection,
    ]
  );

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lower = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower) ||
        (cmd.shortcut && cmd.shortcut.toLowerCase().includes(lower))
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected && !selected.disabled) {
        selected.perform();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[90vw] rounded-lg border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
          borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-zinc-200 dark:border-[#1F2633]">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, tools, or actions..."
            className="w-full bg-transparent text-sm font-sans outline-none placeholder-zinc-400 text-zinc-900 dark:text-zinc-100"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-[380px] overflow-y-auto p-1.5 divide-y divide-transparent">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-sm font-mono text-zinc-400">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  disabled={cmd.disabled}
                  onClick={() => {
                    cmd.perform();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors ${
                    isSelected
                      ? 'bg-emerald-500 text-white font-medium'
                      : cmd.disabled
                      ? 'opacity-35 text-zinc-400 pointer-events-none'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isSelected ? 'text-white' : 'text-zinc-500'}>{cmd.icon}</span>
                    <span>{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-mono tracking-wider ${
                        isSelected ? 'text-white/80' : 'text-zinc-400'
                      }`}
                    >
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-between px-3.5 py-2 border-t border-zinc-200 dark:border-[#1F2633] text-[10px] font-mono text-zinc-400 bg-zinc-50 dark:bg-[#0E1218]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Dismiss</span>
          </div>
          <span className="text-emerald-500">GFG Draw Studio</span>
        </div>
      </div>
    </div>
  );
};

