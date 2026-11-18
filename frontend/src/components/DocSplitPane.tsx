import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  X,
  Bold,
  Italic,
  Heading,
  List,
  Code,
  Link as LinkIcon,
  Eye,
  Edit3,
  Columns,
  ExternalLink,
} from 'lucide-react';
import { YjsStore } from '../store/yjsStore';
import { CanvasNode } from '../types/canvas';
import { sanitizeMarkdownSpec } from '../engine/sanitize';

interface DocSplitPaneProps {
  isOpen: boolean;
  onClose: () => void;
  store: YjsStore;
  activePageId: string;
  selectedNodes: string[];
  nodes: Record<string, CanvasNode>;
  theme: 'light' | 'dark';
  onNavigateToNode: (nodeId: string) => void;
}

export const DocSplitPane: React.FC<DocSplitPaneProps> = ({
  isOpen,
  onClose,
  store,
  activePageId,
  selectedNodes,
  nodes,
  theme,
  onNavigateToNode,
}) => {
  const [width, setWidth] = useState<number>(380);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [content, setContent] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync content with Y.Text
  useEffect(() => {
    if (!store || !activePageId) return;

    const docText = store.getPageDocText(activePageId);
    setContent(docText.toString());

    const observer = () => {
      setContent(docText.toString());
    };

    docText.observe(observer);
    return () => {
      docText.unobserve(observer);
    };
  }, [store, activePageId]);

  // Handle local typing
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);
    store.setDocString(activePageId, newText);
  };

  // Dragging width resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 280 && newWidth <= 720) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Formatting helpers
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;

    const newContent =
      content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    store.setDocString(activePageId, newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 4)
      );
    }, 0);
  };

  // Link selected node
  const handleLinkSelectedNode = () => {
    if (selectedNodes.length === 0) {
      alert('Please select a node or frame on the canvas first to link it.');
      return;
    }
    const nodeId = selectedNodes[0];
    const node = nodes[nodeId];
    const label = node
      ? node._ext?.frameTitle || node.text?.replace(/\n/g, ' ').slice(0, 24) || `Node ${nodeId.slice(0, 6)}`
      : `Node ${nodeId.slice(0, 6)}`;

    insertFormatting(`[[${label}|${nodeId}]]`, '');
  };

  if (!isOpen) return null;

  // Render markdown with clickable anchor chips
  const renderInteractiveMarkdown = (text: string) => {
    const cleanText = sanitizeMarkdownSpec(text);
    if (!cleanText.trim()) {
      return (
        <div className="text-xs text-zinc-400 italic py-6 text-center">
          Document is empty. Type in the editor or click "Link Selected Node" to anchor canvas elements.
        </div>
      );
    }

    const lines = text.split('\n');

    return (
      <div className="space-y-2 text-sm">
        {lines.map((line, idx) => {
          // Check for headers
          if (line.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-3">
                {parseLineAnchors(line.slice(2))}
              </h1>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-2">
                {parseLineAnchors(line.slice(3))}
              </h2>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                {parseLineAnchors(line.slice(4))}
              </h3>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-emerald-500 font-bold">•</span>
                <span>{parseLineAnchors(line.slice(2))}</span>
              </div>
            );
          }
          if (line.trim() === '---') {
            return <hr key={idx} className="border-zinc-200 dark:border-zinc-800 my-2" />;
          }

          return (
            <p key={idx} className="text-zinc-700 dark:text-zinc-300 min-h-[1.25rem]">
              {parseLineAnchors(line)}
            </p>
          );
        })}
      </div>
    );
  };

  const parseLineAnchors = (lineStr: string) => {
    // Regex for:
    // 1. [[Label|nodeId]] or [[nodeId]]
    // 2. @node:nodeId
    const anchorRegex = /\[\[(.*?)(?:\|(.*?))?\]\]|@node:([a-zA-Z0-9_-]+)/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = anchorRegex.exec(lineStr)) !== null) {
      if (match.index > lastIndex) {
        elements.push(lineStr.slice(lastIndex, match.index));
      }

      let label = '';
      let targetId = '';

      if (match[3]) {
        // @node:targetId
        targetId = match[3];
        const targetNode = nodes[targetId];
        label = targetNode
          ? targetNode._ext?.frameTitle || targetNode.text?.replace(/\n/g, ' ').slice(0, 20) || `Node ${targetId.slice(0, 6)}`
          : `Node ${targetId.slice(0, 6)}`;
      } else {
        // [[Label|targetId]] or [[targetId]]
        if (match[2]) {
          label = match[1];
          targetId = match[2];
        } else {
          targetId = match[1];
          const targetNode = nodes[targetId];
          label = targetNode
            ? targetNode._ext?.frameTitle || targetNode.text?.replace(/\n/g, ' ').slice(0, 20) || `Node ${targetId.slice(0, 6)}`
            : `Node ${targetId.slice(0, 6)}`;
        }
      }

      elements.push(
        <button
          key={`anchor-${match.index}`}
          onClick={() => onNavigateToNode(targetId)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 text-xs font-medium font-mono rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-2xs group"
          title={`Click to navigate to canvas node: ${targetId}`}
        >
          <span>🔗 {label}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < lineStr.length) {
      elements.push(lineStr.slice(lastIndex));
    }

    return elements.length > 0 ? elements : lineStr;
  };

  const isLight = theme === 'light';

  return (
    <div
      style={{ width: `${width}px` }}
      className={`fixed top-12 right-0 bottom-0 z-30 flex flex-col border-l shadow-2xl transition-all duration-75 select-text ${
        isLight
          ? 'bg-white border-zinc-200 text-zinc-900'
          : 'bg-[#12161F] border-[#1F2633] text-zinc-100'
      }`}
    >
      {/* Draggable left handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-ew-resize hover:bg-emerald-500/40 transition-colors z-40"
        title="Drag to resize Document pane"
      />

      {/* Pane Header */}
      <div
        className={`h-11 px-3 flex items-center justify-between border-b shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-[#1F2633] bg-[#161B22]/70'
        }`}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider font-mono">
            Document Spec
          </span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-zinc-200/50 dark:bg-zinc-800/60 p-0.5 rounded border border-zinc-300/40 dark:border-zinc-700/50 text-xs">
          <button
            onClick={() => setMode('edit')}
            className={`p-1 rounded transition-colors ${
              mode === 'edit'
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 font-medium shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Edit Mode"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMode('split')}
            className={`p-1 rounded transition-colors ${
              mode === 'split'
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 font-medium shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Split Mode (Edit & Preview)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`p-1 rounded transition-colors ${
              mode === 'preview'
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 font-medium shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
            title="Preview Mode"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          title="Close Document Pane"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Markdown Toolbar */}
      {mode !== 'preview' && (
        <div
          className={`h-9 px-2 flex items-center justify-between border-b shrink-0 text-xs ${
            isLight ? 'border-zinc-200 bg-white' : 'border-[#1F2633] bg-[#12161F]'
          }`}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => insertFormatting('**', '**')}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Bold (**text**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('*', '*')}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Italic (*text*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('## ')}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Heading (## )"
            >
              <Heading className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('- ')}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Bullet List (- )"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => insertFormatting('`', '`')}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              title="Inline Code (`code`)"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Link Selected Node Button */}
          <button
            onClick={handleLinkSelectedNode}
            disabled={selectedNodes.length === 0}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
              selectedNodes.length > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                : 'text-zinc-400 dark:text-zinc-600 border border-transparent cursor-not-allowed opacity-50'
            }`}
            title={
              selectedNodes.length > 0
                ? 'Insert clickable link to selected canvas element'
                : 'Select a canvas node or frame first to link it'
            }
          >
            <LinkIcon className="w-3 h-3" />
            <span>Link Node</span>
          </button>
        </div>
      )}

      {/* Editor & Preview Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {mode === 'edit' && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="# System Architecture & Notes&#10;&#10;Document specifications here. Use [[node-title|node-id]] or @node:node-id to anchor canvas elements."
            className="flex-1 p-3 text-xs font-mono resize-none focus:outline-hidden bg-transparent overflow-y-auto leading-relaxed"
          />
        )}

        {mode === 'preview' && (
          <div className="flex-1 p-4 overflow-y-auto font-sans leading-relaxed">
            {renderInteractiveMarkdown(content)}
          </div>
        )}

        {mode === 'split' && (
          <div className="flex-1 flex flex-col min-h-0 divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="h-1/2 flex flex-col min-h-0">
              <div className="px-3 py-1 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-mono text-zinc-400 uppercase tracking-wider shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                Markdown Source
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                placeholder="# Architecture Spec&#10;Type here..."
                className="flex-1 p-2 text-xs font-mono resize-none focus:outline-hidden bg-transparent overflow-y-auto leading-relaxed"
              />
            </div>
            <div className="h-1/2 flex flex-col min-h-0 overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/20">
              <div className="px-3 py-1 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-mono text-zinc-400 uppercase tracking-wider shrink-0 border-b border-zinc-200 dark:border-zinc-800">
                Interactive Preview & Anchors
              </div>
              <div className="flex-1 p-3 overflow-y-auto font-sans leading-relaxed">
                {renderInteractiveMarkdown(content)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div
        className={`h-7 px-3 flex items-center justify-between text-[10px] font-mono border-t shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-500' : 'border-[#1F2633] bg-[#161B22] text-zinc-400'
        }`}
      >
        <span>Anchors: @node:id or [[Title|id]]</span>
        <span>Auto-synced via Yjs</span>
      </div>
    </div>
  );
};
