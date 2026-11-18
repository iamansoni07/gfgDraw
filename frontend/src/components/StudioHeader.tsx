import React, { useState } from 'react';
import {
  Radio,
  Video,
  Download,
  Upload,
  Share2,
  Users,
  Search,
  FileCode,
  Image,
  Layers,
  Edit2,
  Check,
  Play,
  FileText,
  Code,
  Sparkles,
  Bot,
  ShieldCheck,
  History,
  FolderKanban,
} from 'lucide-react';
import { UserAwareness, CanvasNode, CanvasEdge } from '../types/canvas';
import { PluginRegistry, CustomExporter } from '../sdk/pluginApi';

interface StudioHeaderProps {
  documentTitle: string;
  onChangeDocumentTitle: (title: string) => void;
  remoteUsers: UserAwareness[];
  isFollowingPresenter: boolean;
  onToggleFollowPresenter: () => void;
  isPresenter: boolean;
  onTogglePresenter: () => void;
  role: 'edit' | 'view';
  onOpenShare: () => void;
  onExportCanvas: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportPDF?: () => void;
  onCustomExport?: (exporter: CustomExporter) => void;
  onImportCanvasFile: (file: File) => void;
  onOpenCommandPalette?: () => void;
  onStartPresentation?: () => void;
  onToggleDocs?: () => void;
  isDocsOpen?: boolean;
  onToggleCodeDrawer?: () => void;
  isCodeDrawerOpen?: boolean;
  onOpenMcpModal?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenWorkspace?: () => void;
  onToggleHistory?: () => void;
  isHistoryOpen?: boolean;
  isEncrypted?: boolean;
  theme: 'light' | 'dark';
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  documentTitle,
  onChangeDocumentTitle,
  remoteUsers,
  isFollowingPresenter,
  onToggleFollowPresenter,
  isPresenter,
  onTogglePresenter,
  role,
  onOpenShare,
  onExportCanvas,
  onExportPNG,
  onExportSVG,
  onExportPDF,
  onCustomExport,
  onImportCanvasFile,
  onOpenCommandPalette,
  onStartPresentation,
  onToggleDocs,
  isDocsOpen,
  onToggleCodeDrawer,
  isCodeDrawerOpen,
  onOpenMcpModal,
  onOpenAiAssistant,
  onOpenWorkspace,
  onToggleHistory,
  isHistoryOpen,
  isEncrypted,
  theme,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(documentTitle);
  const [exportOpen, setExportOpen] = useState(false);

  const isReadOnly = role === 'view';

  const handleSaveTitle = () => {
    if (localTitle.trim().length > 0) {
      onChangeDocumentTitle(localTitle.trim());
    }
    setEditingTitle(false);
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 h-[44px] z-40 flex items-center justify-between px-3 border-b select-none transition-colors"
      style={{
        backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
        borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
      }}
    >
      {/* LEFT: Custom Geometric Emblem + Title + Command Palette Trigger */}
      <div className="flex items-center gap-3">
        {/* Custom Geometric GFG Emblem + Workspace Launcher */}
        <button
          type="button"
          onClick={onOpenWorkspace}
          title="Open Workspace Blueprints & Folders"
          className="flex items-center gap-2 p-1 -ml-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer group"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 28 28"
            fill="none"
            className="flex-shrink-0 group-hover:scale-105 transition-transform"
            aria-label="GFG Draw Architectural Studio"
          >
            {/* Outer Precision Hexagonal Caliper Frame */}
            <polygon
              points="14,2 25,8.5 25,21.5 14,28 3,21.5 3,8.5"
              fill={theme === 'dark' ? '#161B22' : '#F4F4F5'}
              stroke={theme === 'dark' ? '#10B981' : '#059669'}
              strokeWidth="1.8"
            />
            {/* Inner Precision Cross Ticks */}
            <line x1="14" y1="5" x2="14" y2="25" stroke={theme === 'dark' ? '#10B981' : '#059669'} strokeWidth="1.2" strokeDasharray="3 2" />
            <line x1="5" y1="15" x2="23" y2="15" stroke={theme === 'dark' ? '#10B981' : '#059669'} strokeWidth="1.2" strokeDasharray="3 2" />
            {/* Center Core Node */}
            <circle cx="14" cy="15" r="3" fill={theme === 'dark' ? '#10B981' : '#059669'} />
          </svg>
          <div className="flex items-baseline gap-1.5 text-left">
            <span className="text-xs font-black tracking-wider uppercase text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-500 transition-colors">
              GFG Draw
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              Drafting Studio
            </span>
          </div>
        </button>

        <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />

        {/* Document Title */}
        <div className="flex items-center">
          {editingTitle && !isReadOnly ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={localTitle}
                autoFocus
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                className="w-36 sm:w-48 px-1.5 py-0.5 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded border border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="text-emerald-500 hover:text-emerald-600"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !isReadOnly && setEditingTitle(true)}
              title={isReadOnly ? documentTitle : 'Click to rename document'}
              className={`flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-[130px] sm:max-w-[220px] truncate ${
                isReadOnly ? '' : 'hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              <span className="truncate">{documentTitle}</span>
              {!isReadOnly && <Edit2 className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />}
            </button>
          )}
        </div>

        {/* ⌘K Quick Command Palette Button */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Quick Commands (⌘K / Ctrl+K)"
          className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-[11px] font-mono text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 transition-colors"
        >
          <Search className="w-3 h-3" />
          <span>Quick actions</span>
          <kbd className="text-[9px] px-1 bg-zinc-200 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* RIGHT: Avatars + Follow Spotlight + Role Badge + Share + Export */}
      <div className="flex items-center gap-2">
        {/* Collaborators Avatar Stack */}
        <div className="flex items-center -space-x-1 pl-1">
          {remoteUsers.slice(0, 4).map((user) => (
            <div
              key={user.id}
              title={user.name || 'Collaborator'}
              style={{ backgroundColor: user.color || '#10B981' }}
              className="w-5 h-5 rounded-full border border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm flex-shrink-0"
            >
              {(user.name || 'U').slice(0, 1).toUpperCase()}
            </div>
          ))}
          {remoteUsers.length > 4 && (
            <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 border border-white dark:border-zinc-900 flex items-center justify-center text-[9px] font-mono font-bold text-zinc-600 dark:text-zinc-300 shadow-sm flex-shrink-0">
              +{remoteUsers.length - 4}
            </div>
          )}
          {remoteUsers.length === 0 && (
            <div
              className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[9px]"
              title="You are live in this studio session"
            >
              <Users className="w-3 h-3" />
            </div>
          )}
        </div>

        <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />

        {/* Follow Presenter Spotlight Toggle */}
        <button
          type="button"
          onClick={onToggleFollowPresenter}
          title={
            isFollowingPresenter
              ? 'Spotlight: Following Presenter (Click to unlock)'
              : 'Spotlight: Follow Presenter Viewport'
          }
          className={`px-2 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
            isFollowingPresenter
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Radio className={`w-3.5 h-3.5 ${isFollowingPresenter ? 'animate-pulse text-white' : ''}`} />
          <span className="hidden sm:inline">
            {isFollowingPresenter ? 'Spotlight ON' : 'Follow'}
          </span>
        </button>

        {/* Broadcast as Presenter (Editor only) */}
        {!isReadOnly && (
          <button
            type="button"
            onClick={onTogglePresenter}
            title={
              isPresenter
                ? 'Broadcasting Viewport to Session (Click to stop)'
                : 'Broadcast Viewport as Presenter'
            }
            className={`px-2 py-1 rounded text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
              isPresenter
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{isPresenter ? 'Broadcasting' : 'Present'}</span>
          </button>
        )}

        {/* Zero-Knowledge E2EE Badge */}
        {isEncrypted && (
          <div
            title="Zero-Knowledge E2EE Active: AES-GCM 256-bit encryption key stored only in URL fragment (#key=...)"
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">E2EE</span>
          </div>
        )}

        {/* Editor / Read-Only Role Badge */}
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight border ${
            isReadOnly
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isReadOnly ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
            }`}
          />
          <span>{isReadOnly ? 'VIEWER' : 'EDITOR'}</span>
        </div>

        <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />

        {/* Export / Import Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((o) => !o)}
            title="Export / Import"
            className="p-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {exportOpen && (
            <div
              className="absolute right-0 top-9 w-52 p-1.5 rounded-lg border shadow-xl space-y-0.5 text-xs font-medium z-50 select-none animate-in fade-in duration-75"
              style={{
                backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
                borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
              }}
              onClick={() => setExportOpen(false)}
            >
              <button
                type="button"
                onClick={onExportCanvas}
                className="w-full text-left px-2.5 py-1.5 rounded text-zinc-700 dark:text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2 transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export .canvas (JSON Canvas)</span>
              </button>

              <button
                type="button"
                onClick={onExportPNG}
                className="w-full text-left px-2.5 py-1.5 rounded text-zinc-700 dark:text-zinc-200 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-2 transition-colors"
              >
                <Image className="w-3.5 h-3.5 text-blue-500" />
                <span>Export as PNG</span>
              </button>

              <button
                type="button"
                onClick={onExportSVG}
                className="w-full text-left px-2.5 py-1.5 rounded text-zinc-700 dark:text-zinc-200 hover:bg-purple-500/10 hover:text-purple-500 flex items-center gap-2 transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>Export as SVG</span>
              </button>

              {onExportPDF && (
                <button
                  type="button"
                  onClick={onExportPDF}
                  className="w-full text-left px-2.5 py-1.5 rounded text-zinc-700 dark:text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-2 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Export Frames as PDF</span>
                </button>
              )}

              {/* Plugin Custom Exporters */}
              {onCustomExport &&
                PluginRegistry.getAllExporters().map((exp) => (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => onCustomExport(exp)}
                    className="w-full text-left px-2.5 py-1.5 rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{exp.label}</span>
                  </button>
                ))}

              <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800 my-1" />

              <label className="w-full text-left px-2.5 py-1.5 rounded text-zinc-700 dark:text-zinc-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>Import .canvas file</span>
                <input
                  type="file"
                  accept=".canvas,.json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportCanvasFile(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Docs Split-Pane Toggle */}
        {onToggleDocs && (
          <button
            type="button"
            onClick={onToggleDocs}
            title={isDocsOpen ? 'Close Document Spec Pane' : 'Open Document Spec Pane'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
              isDocsOpen
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Docs</span>
          </button>
        )}

        {/* Version History Timeline Toggle */}
        {onToggleHistory && (
          <button
            type="button"
            onClick={onToggleHistory}
            title={isHistoryOpen ? 'Close Version Timeline' : 'Open Version Timeline'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
              isHistoryOpen
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden md:inline">History</span>
          </button>
        )}

        {/* Diagram-as-Code Drawer Toggle */}
        {onToggleCodeDrawer && (
          <button
            type="button"
            onClick={onToggleCodeDrawer}
            title={isCodeDrawerOpen ? 'Close Code Drawer' : 'Open Diagram-as-Code (Mermaid)'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
              isCodeDrawerOpen
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mermaid</span>
          </button>
        )}

        {/* Connect AI Agent via MCP Modal */}
        {onOpenMcpModal && (
          <button
            type="button"
            onClick={onOpenMcpModal}
            title="Connect AI Agent via Model Context Protocol (MCP)"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden lg:inline">MCP</span>
          </button>
        )}

        {/* BYOK AI Assistant Modal */}
        {onOpenAiAssistant && (
          <button
            type="button"
            onClick={onOpenAiAssistant}
            title="AI Assistant: Prompt-to-Architecture, ERD, Auto-Tidy"
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">AI</span>
          </button>
        )}

        <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800" />

        {/* Present Slide Mode Trigger */}
        {onStartPresentation && (
          <button
            type="button"
            onClick={onStartPresentation}
            title="Start Slide Presentation Mode (⌘+Enter)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-mono font-medium transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Present</span>
          </button>
        )}

        {/* Share Modal Trigger */}
        <button
          type="button"
          onClick={onOpenShare}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
      </div>
    </header>
  );
};

