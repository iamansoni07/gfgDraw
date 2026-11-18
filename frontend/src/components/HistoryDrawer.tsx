import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  RotateCcw,
  GitBranch,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { BoardVersion, HistoryStore } from '../store/historyStore';
import { YjsStore } from '../store/yjsStore';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  store: YjsStore;
  roomId: string;
  theme: 'light' | 'dark';
  onSwitchRoom: (newRoomId: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  store,
  roomId,
  theme,
  onSwitchRoom,
}) => {
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadVersions = async () => {
    try {
      const list = await HistoryStore.listSnapshots(roomId);
      setVersions(list);
    } catch (err) {
      console.warn('Failed to load version history', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const handleCreateSnapshot = async () => {
    if (!store) return;
    setIsCreating(true);
    try {
      await HistoryStore.saveSnapshot(
        roomId,
        store.doc,
        snapshotName.trim() || undefined,
        false
      );
      setSnapshotName('');
      await loadVersions();
      setStatusMsg({ type: 'success', text: 'Captured named version snapshot!' });
      setTimeout(() => setStatusMsg(null), 2500);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to capture snapshot' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = (ver: BoardVersion) => {
    if (
      window.confirm(
        `Are you sure you want to restore "${ver.name}"? Current canvas state will be overwritten by this snapshot.`
      )
    ) {
      HistoryStore.restoreSnapshot(store.doc, ver);
      setStatusMsg({ type: 'success', text: `Restored version: ${ver.name}` });
      setTimeout(() => setStatusMsg(null), 2500);
    }
  };

  const handleBranch = async (ver: BoardVersion) => {
    const branchName = prompt('Enter name for the new branched board:', `Branch of ${ver.name}`);
    if (branchName) {
      const newRoomId = await HistoryStore.branchAsNewBoard(ver, branchName);
      onSwitchRoom(newRoomId);
      onClose();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Delete snapshot "${name}"?`)) {
      await HistoryStore.deleteSnapshot(id);
      await loadVersions();
    }
  };

  const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`fixed top-11 right-0 bottom-0 z-30 w-96 flex flex-col border-l shadow-2xl transition-all duration-100 select-text ${
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
          <History className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider font-mono">
            Version Timeline ({versions.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Snapshot Creator Bar */}
      <div
        className={`p-3 border-b space-y-2 shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50/40' : 'border-[#1F2633] bg-[#161B22]/40'
        }`}
      >
        <div className="flex gap-1.5">
          <input
            type="text"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Name this milestone (e.g. v1.2 Flow)..."
            className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-hidden focus:border-emerald-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSnapshot();
            }}
          />
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreating}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shrink-0 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Snapshot</span>
          </button>
        </div>

        {statusMsg && (
          <div
            className={`p-2 rounded text-xs flex items-center gap-1.5 font-mono ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-500 border border-red-500/30'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{statusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Timeline List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {versions.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Clock className="w-6 h-6 text-zinc-400 mx-auto opacity-50" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No saved snapshots yet.
            </p>
            <p className="text-[11px] text-zinc-400">
              Click "+ Snapshot" above to create a milestone version.
            </p>
          </div>
        ) : (
          versions.map((ver) => (
            <div
              key={ver.id}
              className={`p-3 rounded-lg border transition-all ${
                isLight
                  ? 'bg-zinc-50/80 border-zinc-200 hover:border-zinc-300 shadow-2xs'
                  : 'bg-[#161B22]/70 border-[#21262D] hover:border-zinc-700 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {ver.name}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                    ver.isAutoSnapshot
                      ? 'bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 font-medium'
                  }`}
                >
                  {ver.isAutoSnapshot ? 'AUTO' : 'MANUAL'}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                <span>{formatTimestamp(ver.timestamp)}</span>
                <span>•</span>
                <span>{ver.nodeCount} nodes, {ver.edgeCount} edges</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleRestore(ver)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                    title="Restore this version onto current board"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore</span>
                  </button>

                  <button
                    onClick={() => handleBranch(ver)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                    title="Branch this version into a new board"
                  >
                    <GitBranch className="w-3 h-3" />
                    <span>Branch</span>
                  </button>
                </div>

                <button
                  onClick={() => handleDelete(ver.id, ver.name)}
                  className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Delete snapshot"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className={`h-8 px-3 flex items-center justify-between text-[10px] font-mono border-t shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-500' : 'border-[#1F2633] bg-[#161B22] text-zinc-400'
        }`}
      >
        <span>Yjs CRDT Binary State</span>
        <span>Non-Destructive</span>
      </div>
    </div>
  );
};

