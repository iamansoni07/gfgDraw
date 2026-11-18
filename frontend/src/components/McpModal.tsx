import React, { useState } from 'react';
import {
  Bot,
  X,
  Copy,
  Check,
  Terminal,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react';

interface McpModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  theme: 'light' | 'dark';
}

export const McpModal: React.FC<McpModalProps> = ({
  isOpen,
  onClose,
  roomId,
  theme,
}) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'cli'>('claude');

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        'gfg-draw': {
          command: 'npx',
          args: ['tsx', 'mcp-server/src/index.ts', '--room', roomId],
        },
      },
    },
    null,
    2
  );

  const cursorConfig = JSON.stringify(
    {
      mcp: {
        servers: {
          'gfg-draw': {
            type: 'stdio',
            command: 'npx',
            args: ['tsx', 'mcp-server/src/index.ts', '--room', roomId],
          },
        },
      },
    },
    null,
    2
  );

  const cliCommand = `npx tsx mcp-server/src/index.ts --room "${roomId}"`;

  const copyToClipboard = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text">
      <div
        className={`w-full max-w-xl rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all ${
          isLight
            ? 'bg-white border-zinc-200 text-zinc-900'
            : 'bg-[#12161F] border-[#1F2633] text-zinc-100'
        }`}
      >
        {/* Header */}
        <div
          className={`h-12 px-4 flex items-center justify-between border-b shrink-0 ${
            isLight ? 'border-zinc-200 bg-zinc-50' : 'border-[#1F2633] bg-[#161B22]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono">
              Connect AI Agent via Model Context Protocol (MCP)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Connect autonomous coding agents (Claude Desktop, Cursor, Antigravity) directly to your live whiteboard. Agents can inspect the canvas, layout diagrams, and synthesize code architectures live.
          </p>

          {/* Room info pill */}
          <div className="flex items-center justify-between p-2.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-xs font-mono">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Target Live Room: <strong className="underline">{roomId}</strong>
            </span>
            <span className="text-[10px] text-zinc-500">WebSocket: demos.yjs.dev</span>
          </div>

          {/* Config Tabs */}
          <div>
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <button
                onClick={() => setActiveTab('claude')}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  activeTab === 'claude'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Claude Desktop
              </button>
              <button
                onClick={() => setActiveTab('cursor')}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  activeTab === 'cursor'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Cursor (.cursor/mcp.json)
              </button>
              <button
                onClick={() => setActiveTab('cli')}
                className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                  activeTab === 'cli'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                CLI Stdio
              </button>
            </div>

            {/* Code Box */}
            <div className="relative mt-2">
              <pre
                className={`p-3 text-xs font-mono rounded-lg overflow-x-auto leading-relaxed border ${
                  isLight
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    : 'bg-zinc-950/80 border-[#1F2633] text-zinc-200'
                }`}
              >
                {activeTab === 'claude' && claudeConfig}
                {activeTab === 'cursor' && cursorConfig}
                {activeTab === 'cli' && cliCommand}
              </pre>

              <button
                onClick={() =>
                  copyToClipboard(
                    activeTab === 'claude'
                      ? claudeConfig
                      : activeTab === 'cursor'
                      ? cursorConfig
                      : cliCommand,
                    activeTab
                  )
                }
                className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-emerald-500 hover:text-white transition-colors"
              >
                {copiedTab === activeTab ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Config</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Exposed MCP Tools List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Wrench className="w-3 h-3 text-emerald-500" />
              <span>Exposed Agent Tools (JSON-RPC)</span>
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-emerald-500 font-semibold block">get_board_summary</span>
                <span className="text-[10px] text-zinc-500">Read nodes, connectors & frames</span>
              </div>
              <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-emerald-500 font-semibold block">upsert_nodes_and_edges</span>
                <span className="text-[10px] text-zinc-500">Create & update canvas elements</span>
              </div>
              <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-emerald-500 font-semibold block">auto_layout_page</span>
                <span className="text-[10px] text-zinc-500">DAG rank & coordinate leveling</span>
              </div>
              <div className="p-2 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
                <span className="text-emerald-500 font-semibold block">clear_or_delete_elements</span>
                <span className="text-[10px] text-zinc-500">Selective or total page wiping</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`h-11 px-4 flex items-center justify-between border-t shrink-0 ${
            isLight ? 'border-zinc-200 bg-zinc-50' : 'border-[#1F2633] bg-[#161B22]'
          }`}
        >
          <span className="text-[10px] font-mono text-zinc-400">
            Protocol: 2024-11-05 (Model Context Protocol)
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
