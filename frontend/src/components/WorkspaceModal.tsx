import React, { useState, useEffect } from 'react';
import {
  Folder,
  Star,
  Search,
  Plus,
  Trash2,
  Copy,
  FolderPlus,
  Tag,
  X,
  Layers,
  Clock,
  Sparkles,
  Server,
  HardDrive,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { BoardMetadata, WorkspaceStore } from '../store/workspaceStore';
import { STARTER_TEMPLATES, StarterTemplate } from '../data/templates';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomId: string;
  onSelectBoard: (roomId: string) => void;
  theme: 'light' | 'dark';
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  activeRoomId,
  onSelectBoard,
  theme,
}) => {
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Template Picker state
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);

  const isServerMode = !!(import.meta as any).env?.VITE_SERVER_URL;

  const loadBoards = async () => {
    const list = await WorkspaceStore.listBoards();
    setBoards(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadBoards();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  // Extract unique folders and tags
  const folders = Array.from(new Set(boards.map((b) => b.folder || 'General')));
  const allTags = Array.from(new Set(boards.flatMap((b) => b.tags || [])));

  // Filter boards
  const filteredBoards = boards.filter((b) => {
    if (onlyStarred && !b.isStarred) return false;
    if (selectedFolder !== 'all' && (b.folder || 'General') !== selectedFolder)
      return false;
    if (selectedTag && (!b.tags || !b.tags.includes(selectedTag))) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = b.title.toLowerCase().includes(q);
      const matchFolder = (b.folder || '').toLowerCase().includes(q);
      const matchTags = (b.tags || []).some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchFolder && !matchTags) return false;
    }
    return true;
  });

  const handleCreateNewBlank = async () => {
    const title = prompt('Enter new board title:', 'Untitled Blueprint');
    if (!title) return;
    const newBoard = await WorkspaceStore.createBoard(
      title,
      selectedFolder !== 'all' ? selectedFolder : 'General'
    );
    await loadBoards();
    onSelectBoard(newBoard.id);
    onClose();
  };

  const handleCreateFromTemplate = async (template: StarterTemplate) => {
    const title = prompt(
      'Enter board title for this blueprint:',
      `${template.name} Architecture`
    );
    if (!title) return;
    const newBoard = await WorkspaceStore.createBoard(
      title,
      selectedFolder !== 'all' ? selectedFolder : 'General',
      template.id
    );
    await loadBoards();
    setIsTemplatePickerOpen(false);
    onSelectBoard(newBoard.id);
    onClose();
  };

  const handleToggleStar = async (b: BoardMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    await WorkspaceStore.updateBoard(b.id, { isStarred: !b.isStarred });
    await loadBoards();
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await WorkspaceStore.duplicateBoard(id);
    await loadBoards();
  };

  const handleDelete = async (b: BoardMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete board "${b.title}"? This cannot be undone.`)) {
      await WorkspaceStore.deleteBoard(b.id);
      await loadBoards();
      if (b.id === activeRoomId) {
        const remaining = boards.filter((item) => item.id !== b.id);
        if (remaining.length > 0) onSelectBoard(remaining[0].id);
      }
    }
  };

  const handleAddFolder = () => {
    if (newFolderName.trim()) {
      setSelectedFolder(newFolderName.trim());
      setNewFolderName('');
      setShowAddFolder(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text">
      <div
        className={`w-full max-w-4xl h-[620px] rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-[#12161F] border-[#1F2633] text-zinc-100'
        }`}
      >
        {/* Top Header */}
        <div
          className={`h-12 px-4 flex items-center justify-between border-b shrink-0 ${
            isLight ? 'border-zinc-200 bg-zinc-50' : 'border-[#1F2633] bg-[#161B22]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono">
              Workspace & Multi-Board Studio
            </h2>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isServerMode
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700'
              }`}
            >
              {isServerMode ? <Server className="w-2.5 h-2.5" /> : <HardDrive className="w-2.5 h-2.5" />}
              <span>{isServerMode ? 'Self-Hosted Server' : 'Local Storage Mode'}</span>
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Body: Split Left Nav & Right Boards Grid */}
        <div className="flex-1 flex min-h-0 divide-x divide-zinc-200 dark:divide-zinc-800">
          {/* Left Navigation Rail */}
          <div
            className={`w-56 p-3 flex flex-col justify-between shrink-0 ${
              isLight ? 'bg-zinc-50/70' : 'bg-[#141822]/70'
            }`}
          >
            <div className="space-y-4 overflow-y-auto">
              {/* Filter Tabs */}
              <div className="space-y-1 text-xs font-medium">
                <button
                  onClick={() => {
                    setSelectedFolder('all');
                    setOnlyStarred(false);
                    setSelectedTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
                    selectedFolder === 'all' && !onlyStarred
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    <span>All Blueprints</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {boards.length}
                  </span>
                </button>

                <button
                  onClick={() => setOnlyStarred(true)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
                    onlyStarred
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Starred</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {boards.filter((b) => b.isStarred).length}
                  </span>
                </button>
              </div>

              {/* Folders Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 uppercase tracking-wider px-1">
                  <span>Folders</span>
                  <button
                    onClick={() => setShowAddFolder(!showAddFolder)}
                    className="p-0.5 hover:text-emerald-500"
                    title="Add Folder"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                </div>

                {showAddFolder && (
                  <div className="flex gap-1 pt-1 pb-1 px-1">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name..."
                      className="w-full px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                    />
                    <button
                      onClick={handleAddFolder}
                      className="px-2 py-1 text-xs bg-emerald-600 text-white rounded"
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="space-y-0.5 text-xs">
                  {folders.map((folder) => (
                    <button
                      key={folder}
                      onClick={() => {
                        setSelectedFolder(folder);
                        setOnlyStarred(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition-colors ${
                        selectedFolder === folder && !onlyStarred
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="truncate">{folder}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {boards.filter((b) => (b.folder || 'General') === folder).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Section */}
              {allTags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider px-1 block">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setSelectedTag(selectedTag === tag ? null : tag)
                        }
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                          selectedTag === tag
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-zinc-200/50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom info */}
            <div className="text-[10px] font-mono text-zinc-400 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              GFG Draw v4.0 Precision Studio
            </div>
          </div>

          {/* Right Main Grid */}
          <div className="flex-1 flex flex-col min-h-0 bg-transparent">
            {/* Top Bar inside Grid */}
            <div
              className={`p-3 flex items-center justify-between border-b shrink-0 gap-3 ${
                isLight ? 'bg-white' : 'bg-[#12161F]'
              }`}
            >
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blueprints, folders, tags..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTemplatePickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>New from Blueprint</span>
                </button>

                <button
                  onClick={handleCreateNewBlank}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Blank Board</span>
                </button>
              </div>
            </div>

            {/* Boards Grid Cards */}
            <div className="flex-1 p-4 overflow-y-auto">
              {filteredBoards.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <FileText className="w-8 h-8 text-zinc-400 mx-auto opacity-40" />
                  <p className="text-xs text-zinc-500">No blueprints match your filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredBoards.map((b) => {
                    const isActive = b.id === activeRoomId;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          onSelectBoard(b.id);
                          onClose();
                        }}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] flex flex-col justify-between group ${
                          isActive
                            ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5'
                            : isLight
                            ? 'bg-zinc-50/70 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100/60'
                            : 'bg-[#161B22]/60 border-[#21262D] hover:border-zinc-700 hover:bg-[#1A222D]'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex-1">
                              {b.title}
                            </h3>
                            <button
                              onClick={(e) => handleToggleStar(b, e)}
                              className="text-zinc-400 hover:text-amber-500 p-0.5"
                              title={b.isStarred ? 'Unstar' : 'Star'}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  b.isStarred
                                    ? 'text-amber-500 fill-amber-500'
                                    : 'text-zinc-400'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-zinc-500">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-800">
                              {b.folder || 'General'}
                            </span>
                            <span>{b.nodeCount || 0} nodes</span>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="flex items-center justify-between mt-4 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
                          <span className="text-[10px] font-mono text-zinc-400">
                            {new Date(b.updatedAt).toLocaleDateString()}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleDuplicate(b.id, e)}
                              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              title="Duplicate Board"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(b, e)}
                              className="p-1 rounded text-zinc-400 hover:text-red-500"
                              title="Delete Board"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Blueprint Template Picker Dialog */}
        {isTemplatePickerOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text">
            <div
              className={`w-full max-w-2xl rounded-xl border shadow-2xl p-4 flex flex-col gap-3 ${
                isLight ? 'bg-white border-zinc-200' : 'bg-[#141822] border-[#1F2633]'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold uppercase font-mono">
                    Select Starter Blueprint Template
                  </span>
                </div>
                <button
                  onClick={() => setIsTemplatePickerOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
                {STARTER_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    onClick={() => handleCreateFromTemplate(tmpl)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] hover:border-emerald-500 ${
                      isLight
                        ? 'bg-zinc-50 border-zinc-200 hover:bg-emerald-50/20'
                        : 'bg-[#161B26] border-[#21262D] hover:bg-[#1A2230]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {tmpl.name}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-emerald-500 font-semibold">
                        {tmpl.category}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                      {tmpl.description}
                    </p>
                    <div className="mt-2 text-[10px] font-mono text-zinc-400">
                      {tmpl.doc.nodes.length} nodes, {tmpl.doc.edges.length} connectors
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

