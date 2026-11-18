import React, { useState } from 'react';
import { X, Copy, Check, Users, Shield, Edit3, Eye, HardDrive, Wifi, FileCode2, Image, FileText } from 'lucide-react';
import { isLocalFirstMode } from '../store/yjsStore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  isLocalFirst?: boolean;
  onExportCanvas?: () => void;
  onExportPNG?: () => void;
  onExportSVG?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomId,
  isLocalFirst: propIsLocalFirst,
  onExportCanvas,
  onExportPNG,
  onExportSVG,
}) => {
  const [copiedRole, setCopiedRole] = useState<'edit' | 'view' | null>(null);

  if (!isOpen) return null;

  const isLocalFirst = propIsLocalFirst !== undefined ? propIsLocalFirst : isLocalFirstMode();

  const baseUrl = window.location.origin + window.location.pathname;
  const editorUrl = `${baseUrl}?room=${roomId}&role=edit`;
  const viewerUrl = `${baseUrl}?room=${roomId}&role=view`;

  const copyToClipboard = async (url: string, role: 'edit' | 'view') => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedRole(role);
      setTimeout(() => setCopiedRole(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg p-6 bg-white dark:bg-[#161B22] rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
                Studio Collaboration & Sharing
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Share live peer sessions, present to students, or export smart files.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Local-First vs Server Status Badge */}
        {isLocalFirst ? (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Local-First Mode
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700/90 dark:text-emerald-300/80">
                <HardDrive className="w-3 h-3" />
                <span>IndexedDB + Multi-Tab Sync</span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Running without external servers. Your board is preserved in local browser storage and syncs across tabs in real-time. Share using room URLs or export self-contained smart files.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300">
                Live Multiplayer Relay Active
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-blue-700/90 dark:text-blue-300/80">
              <Wifi className="w-3 h-3" />
              <span>WebSocket Connected</span>
            </div>
          </div>
        )}

        {/* Room Info */}
        <div className="px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/80 dark:border-white/5 flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Session Room:</span>
          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 select-all">
            {roomId}
          </span>
        </div>

        {/* Link 1: Editor Link */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Editor Link (Full Studio Drafting Access)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={editorUrl}
              className="flex-1 px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-700 dark:text-zinc-300 outline-none select-all"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(editorUrl, 'edit')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex-shrink-0"
            >
              {copiedRole === 'edit' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Link 2: Read-Only Viewer Link */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            <span>Spectator Link (Student Safe, Read-Only)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={viewerUrl}
              className="flex-1 px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-black/30 border border-zinc-200 dark:border-white/10 rounded-xl text-zinc-700 dark:text-zinc-300 outline-none select-all"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(viewerUrl, 'view')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-800 dark:text-white bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 border border-zinc-200 dark:border-white/10 rounded-xl transition-all flex-shrink-0"
            >
              {copiedRole === 'view' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Portable Smart File Sharing Options */}
        {(onExportCanvas || onExportPNG || onExportSVG) && (
          <div className="pt-2 border-t border-zinc-100 dark:border-white/5 space-y-2">
            <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Portable File Export (Zero Server Required)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {onExportCanvas && (
                <button
                  type="button"
                  onClick={onExportCanvas}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center group"
                >
                  <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">.canvas</span>
                  <span className="text-[9px] text-zinc-400">JSON Canvas 1.0</span>
                </button>
              )}
              {onExportPNG && (
                <button
                  type="button"
                  onClick={onExportPNG}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center group"
                >
                  <Image className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Smart PNG</span>
                  <span className="text-[9px] text-zinc-400">Embedded Scene</span>
                </button>
              )}
              {onExportSVG && (
                <button
                  type="button"
                  onClick={onExportSVG}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center group"
                >
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Smart SVG</span>
                  <span className="text-[9px] text-zinc-400">Vector Embed</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Shield className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span>Real-time Yjs CRDT synchronization with IndexedDB browser persistence.</span>
        </div>
      </div>
    </div>
  );
};
