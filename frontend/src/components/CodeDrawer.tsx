import React, { useState } from 'react';
import {
  Code,
  X,
  Play,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  parseMermaidFlowchart,
  layoutDiagramToCanvas,
  serializeCanvasToMermaid,
} from '../engine/diagramCodeSync';
import { CanvasNode, CanvasEdge } from '../types/canvas';
import { YjsStore } from '../store/yjsStore';

interface CodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  store: YjsStore;
  activePageId: string;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  theme: 'light' | 'dark';
}

const TEMPLATES: { label: string; code: string }[] = [
  {
    label: 'Microservices Pipeline',
    code: `flowchart TD
    Client["Web / Mobile Client"]
    API["API Gateway"]
    Auth["Auth Service"]
    Order["Order Service"]
    Payment["Payment Worker"]
    DB[("PostgreSQL DB")]
    Cache[("Redis Cache")]

    Client --> API
    API --> Auth
    API --> Order
    Order --> Cache
    Order --> Payment
    Order --> DB`,
  },
  {
    label: 'DSA: Binary Search',
    code: `flowchart TD
    Start(["Start (arr, target)"])
    Init["low = 0, high = n - 1"]
    Cond{"low <= high?"}
    Calc["mid = (low + high) / 2"]
    Found{"arr[mid] == target?"}
    ReturnMid["return mid"]
    Compare{"arr[mid] < target?"}
    ShiftRight["low = mid + 1"]
    ShiftLeft["high = mid - 1"]
    NotFound["return -1"]

    Start --> Init
    Init --> Cond
    Cond -->|Yes| Calc
    Cond -->|No| NotFound
    Calc --> Found
    Found -->|Yes| ReturnMid
    Found -->|No| Compare
    Compare -->|Yes| ShiftRight
    Compare -->|No| ShiftLeft
    ShiftRight --> Cond
    ShiftLeft --> Cond`,
  },
  {
    label: 'Decision Flow',
    code: `flowchart LR
    A["User Request"] --> B{"Valid Session?"}
    B -->|Yes| C["Process Action"]
    B -->|No| D["Redirect Login"]
    C --> E["200 OK"]`,
  },
];

export const CodeDrawer: React.FC<CodeDrawerProps> = ({
  isOpen,
  onClose,
  store,
  activePageId,
  nodes,
  edges,
  theme,
}) => {
  const [code, setCode] = useState<string>(TEMPLATES[0].code);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const handleApplyToCanvas = () => {
    try {
      const parsed = parseMermaidFlowchart(code);
      if (parsed.nodes.size === 0) {
        setStatusMsg('No valid nodes found to layout.');
        return;
      }

      // Calculate center or offset based on existing elements
      const existingNodes = Object.values(nodes);
      let originX = 150;
      let originY = 150;
      if (existingNodes.length > 0) {
        const maxX = Math.max(...existingNodes.map((n) => n.x + n.width));
        originX = maxX + 100;
      }

      const { nodes: newNodes, edges: newEdges } = layoutDiagramToCanvas(parsed, {
        x: originX,
        y: originY,
      });

      // Commit to Yjs
      store.doc.transact(() => {
        for (const n of newNodes) {
          store.setNode(activePageId, n);
        }
        for (const e of newEdges) {
          store.setEdge(activePageId, e);
        }
      });

      setStatusMsg(`Added ${newNodes.length} nodes & ${newEdges.length} connectors!`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg(`Error parsing syntax: ${err.message || 'Syntax error'}`);
    }
  };

  const handleSyncFromCanvas = () => {
    const generated = serializeCanvasToMermaid(nodes, edges, 'TD');
    setCode(generated);
    setStatusMsg('Synced live canvas into Mermaid code!');
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`fixed top-12 bottom-0 left-0 z-30 w-96 flex flex-col border-r shadow-2xl transition-all duration-100 select-text ${
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
          <Code className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-wider font-mono">
            Diagram-as-Code
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Templates Bar */}
      <div
        className={`px-3 py-2 flex items-center gap-1.5 border-b overflow-x-auto text-xs shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50/50' : 'border-[#1F2633] bg-[#161B22]/40'
        }`}
      >
        <span className="text-[10px] uppercase font-mono text-zinc-400 shrink-0">
          Preset:
        </span>
        {TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.label}
            onClick={() => setCode(tmpl.code)}
            className="px-2 py-0.5 rounded text-[11px] whitespace-nowrap bg-zinc-200/60 dark:bg-zinc-800 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
          >
            {tmpl.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="flowchart TD&#10;    A --> B"
          spellCheck={false}
          className="flex-1 p-3 text-xs font-mono resize-none focus:outline-hidden bg-transparent overflow-y-auto leading-relaxed border-none"
        />
        {statusMsg && (
          <div className="absolute bottom-2 left-2 right-2 px-2.5 py-1.5 text-xs font-mono rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-md backdrop-blur-xs flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div
        className={`p-3 flex flex-col gap-2 border-t shrink-0 ${
          isLight ? 'border-zinc-200 bg-zinc-50' : 'border-[#1F2633] bg-[#161B22]'
        }`}
      >
        <button
          onClick={handleApplyToCanvas}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Apply to Canvas (Auto-Layout DAG)</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromCanvas}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Generate Mermaid code from current board nodes and edges"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync from Canvas</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Copy Mermaid code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
