import React, { useState } from 'react';
import {
  Plus,
  X,
  Check,
  Grid,
  Sun,
  Moon,
  Maximize2,
  ZoomIn,
  ZoomOut,
  FileText,
} from 'lucide-react';
import { Camera, BoundingBox } from '../types/canvas';

interface PageItem {
  id: string;
  name: string;
}

interface BottomTelemetryBarProps {
  pages: PageItem[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onCreatePage: () => void;
  onRenamePage: (pageId: string, newName: string) => void;
  onDeletePage: (pageId: string) => void;
  cursorWorldPos: { x: number; y: number } | null;
  selectedBounds: BoundingBox | null;
  camera: Camera;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomToFit: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  readOnly?: boolean;
}

export const BottomTelemetryBar: React.FC<BottomTelemetryBarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  cursorWorldPos,
  selectedBounds,
  camera,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomToFit,
  showGrid,
  onToggleGrid,
  theme,
  onToggleTheme,
  readOnly = false,
}) => {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');

  const handleStartRename = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    setEditingPageId(id);
    setEditingPageName(name);
  };

  const handleSaveRename = (id: string) => {
    if (editingPageName.trim().length > 0) {
      onRenamePage(id, editingPageName.trim());
    }
    setEditingPageId(null);
  };

  const cursorX = cursorWorldPos ? Math.round(cursorWorldPos.x) : 0;
  const cursorY = cursorWorldPos ? Math.round(cursorWorldPos.y) : 0;

  const selW = selectedBounds ? Math.round(selectedBounds.maxX - selectedBounds.minX) : null;
  const selH = selectedBounds ? Math.round(selectedBounds.maxY - selectedBounds.minY) : null;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 h-[30px] z-40 flex items-center justify-between px-2.5 border-t select-none transition-colors"
      style={{
        backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
      }}
    >
      {/* LEFT: Multi-Page Docked Tabs */}
      <div className="flex items-center h-full gap-0.5 overflow-x-auto">
        {pages.map((p) => {
          const isActive = p.id === activePageId;
          const isEditing = editingPageId === p.id;

          return (
            <div
              key={p.id}
              onClick={() => onSelectPage(p.id)}
              className={`relative group flex items-center h-full px-2.5 text-xs font-medium cursor-pointer transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold bg-zinc-100 dark:bg-zinc-800/60'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'
              }`}
            >
              {/* Active Emerald Top Border Indicator */}
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-[2px] bg-emerald-600 dark:bg-emerald-400" />
              )}

              <FileText className="w-3 h-3 opacity-60 mr-1.5" />

              {isEditing ? (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={editingPageName}
                    autoFocus
                    onChange={(e) => setEditingPageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(p.id);
                      if (e.key === 'Escape') setEditingPageId(null);
                    }}
                    onBlur={() => handleSaveRename(p.id)}
                    className="w-16 px-1 py-0 text-[11px] font-mono bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded border border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRename(p.id)}
                    className="text-emerald-500 hover:text-emerald-600"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span
                  onDoubleClick={(e) => handleStartRename(p.id, p.name, e)}
                  title="Double-click to rename page"
                  className="max-w-[100px] truncate"
                >
                  {p.name}
                </span>
              )}

              {!readOnly && pages.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePage(p.id);
                  }}
                  title="Delete page"
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 ml-1.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {!readOnly && (
          <button
            type="button"
            onClick={onCreatePage}
            title="Add Page"
            className="flex items-center justify-center w-6 h-full text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* RIGHT: Telemetry Readout (Cursor, Selection Dimensions, Grid, Theme, Zoom) */}
      <div className="flex items-center h-full gap-2.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        {/* Live Cursor Coordinates */}
        <div className="hidden sm:flex items-center gap-1.5 px-1.5">
          <span>X: <span className="text-zinc-800 dark:text-zinc-200">{cursorX}</span></span>
          <span>Y: <span className="text-zinc-800 dark:text-zinc-200">{cursorY}</span></span>
        </div>

        <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-800" />

        {/* Selected Dimensions */}
        <div className="hidden md:flex items-center gap-1 px-1.5" title="Selected element dimensions">
          <span className="text-zinc-400">DIM:</span>
          <span className="text-zinc-800 dark:text-zinc-200">
            {selW !== null && selH !== null ? `${selW} × ${selH} px` : '-- × --'}
          </span>
        </div>

        <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-800" />

        {/* Dot Matrix Grid Toggle */}
        <button
          type="button"
          onClick={onToggleGrid}
          title={showGrid ? 'Grid: ON' : 'Grid: OFF'}
          className={`px-1.5 py-0.5 rounded flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 ${
            showGrid ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
          }`}
        >
          <Grid className="w-3 h-3" />
          <span className="hidden lg:inline">{showGrid ? 'GRID' : 'OFF'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Studio Paper (Light)' : 'Carbon Studio (Dark)'}
          className="px-1.5 py-0.5 rounded flex items-center gap-1 hover:text-amber-500 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3" />}
          <span className="hidden lg:inline">{theme === 'dark' ? 'CARBON' : 'PAPER'}</span>
        </button>

        <div className="w-[1px] h-3.5 bg-zinc-200 dark:bg-zinc-800" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onZoomOut}
            title="Zoom Out"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
          >
            <ZoomOut className="w-2.5 h-2.5" />
          </button>

          <button
            type="button"
            onClick={onResetZoom}
            title="Reset to 100%"
            className="px-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            {Math.round(camera.zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={onZoomIn}
            title="Zoom In"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
          >
            <ZoomIn className="w-2.5 h-2.5" />
          </button>

          <button
            type="button"
            onClick={onZoomToFit}
            title="Zoom to Fit (Shift+1)"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <Maximize2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};

