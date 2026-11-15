import React, { useState } from 'react';
import { X, Copy, Check, Users, Shield, Edit3, Eye } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomId,
}) => {
  const [copiedRole, setCopiedRole] = useState<'edit' | 'view' | null>(null);

  if (!isOpen) return null;

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
        className="relative w-full max-w-md p-6 bg-white dark:bg-[#161B22] rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl space-y-5"
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
                Studio Collaboration
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Share live peer sessions or present to students in real time.
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

        {/* Room Info */}
        <div className="px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/80 dark:border-white/5 flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Session Room:</span>
          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 select-all">
            {roomId}
          </span>
        </div>

        {/* Link 1: Editor Link */}
        <div className="space-y-2">
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
        <div className="space-y-2">
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

        {/* Footer Note */}
        <div className="pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <Shield className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span>Real-time Yjs CRDT synchronization with IndexedDB browser persistence.</span>
        </div>
      </div>
    </div>
  );
};

