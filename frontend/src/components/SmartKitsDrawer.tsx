import React, { useState } from 'react';
import {
  Boxes,
  X,
  Layers,
  Cpu,
  Plus,
  Puzzle,
} from 'lucide-react';
import { SMART_KITS, SmartKitItem } from '../engine/smartKits';
import { YjsStore } from '../store/yjsStore';
import { Camera } from '../types/canvas';

interface SmartKitsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  store: YjsStore;
  activePageId: string;
  camera: Camera;
  theme: 'light' | 'dark';
  onSelectNode?: (nodeId: string) => void;
}

export const SmartKitsDrawer: React.FC<SmartKitsDrawerProps> = ({
  isOpen,
  onClose,
  store,
  activePageId,
  camera,
  theme,
  onSelectNode,
}) => {
  const [activeCategory, setActiveCategory] = useState<'dsa' | 'system' | 'plugins'>('dsa');

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const filteredKits = SMART_KITS.filter((kit) => kit.category === activeCategory);

  const handleInsertKit = (kit: SmartKitItem) => {
    // Drop into visible canvas center
    const viewportCenterX = -camera.x + (window.innerWidth / 2) / camera.zoom;
    const viewportCenterY = -camera.y + (window.innerHeight / 2) / camera.zoom;

    const x = Math.round(viewportCenterX - kit.defaultWidth / 2);
    const y = Math.round(viewportCenterY - kit.defaultHeight / 2);

    const accentColor = theme === 'dark' ? '#10B981' : '#059669';
    const newNode = kit.createNode(x, y, accentColor);

    store.setNode(activePageId, newNode);
    if (onSelectNode) {
      onSelectNode(newNode.id);
    }
  };

  return (
    <div
      className={`fixed top-12 bottom-0 left-12 z-30 w-80 flex flex-col border-r shadow-2xl transition-all select-none ${
        isLight
          ? 'bg-white border-zinc-200 text-zinc-900'
          : 'bg-[#12161F] border-[#1F2633] text-zinc-100'
      }`}
    >
      {/* Header */}
      <div
        className={`h-11 px-3 flex items-center justify-between border-b shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-[#1F2633] bg-[#161B22]/70'
        }`}
      >
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider font-mono">
            Domain Smart Kits
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div
        className={`h-10 px-2 flex items-center gap-1 border-b shrink-0 text-xs ${
          isLight ? 'border-zinc-200 bg-white' : 'border-[#1F2633] bg-[#12161F]'
        }`}
      >
        <button
          onClick={() => setActiveCategory('dsa')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded font-mono text-xs transition-colors ${
            activeCategory === 'dsa'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>DSA Structures</span>
        </button>
        <button
          onClick={() => setActiveCategory('system')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded font-mono text-xs transition-colors ${
            activeCategory === 'system'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
        <button
          onClick={() => setActiveCategory('plugins')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded font-mono text-xs transition-colors ${
            activeCategory === 'plugins'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Puzzle className="w-3.5 h-3.5" />
          <span>Plugins</span>
        </button>
      </div>

      {/* Kits List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        <div className="text-[11px] font-mono text-zinc-400">
          Click any component to drop it onto the canvas:
        </div>

        {filteredKits.map((kit) => (
          <div
            key={kit.id}
            onClick={() => handleInsertKit(kit)}
            className={`p-2.5 rounded-md border cursor-pointer transition-all hover:scale-[1.01] group ${
              isLight
                ? 'bg-zinc-50/80 border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/20 shadow-2xs'
                : 'bg-[#161B22]/60 border-[#21262D] hover:border-emerald-500 hover:bg-[#1A222D] shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-500 transition-colors">
                {kit.name}
              </span>
              <span className="p-1 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Plus className="w-3 h-3" />
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
              {kit.description}
            </p>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div
        className={`h-7 px-3 flex items-center justify-between text-[10px] font-mono border-t shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-500' : 'border-[#1F2633] bg-[#161B22] text-zinc-400'
        }`}
      >
        <span>Parametric Path2D Kits</span>
        <span>Auto-Connector Ports</span>
      </div>
    </div>
  );
};
