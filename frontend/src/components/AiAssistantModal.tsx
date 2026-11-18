import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Key,
  Database,
  Grid,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { YjsStore } from '../store/yjsStore';
import { CanvasNode, CanvasEdge } from '../types/canvas';
import {
  parseMermaidFlowchart,
  layoutDiagramToCanvas,
} from '../engine/diagramCodeSync';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: YjsStore;
  activePageId: string;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  selectedNodes: string[];
  theme: 'light' | 'dark';
}

type Provider = 'openai' | 'anthropic' | 'gemini' | 'ollama';
type WorkflowTab = 'prompt-diagram' | 'schema-erd' | 'auto-tidy';

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  store,
  activePageId,
  nodes,
  edges,
  selectedNodes,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('prompt-diagram');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
    ollama: 'http://localhost:11434',
  });
  const [showKeyConfig, setShowKeyConfig] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [schemaInput, setSchemaInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load API keys from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gfg_draw_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.keys) setApiKeys((prev) => ({ ...prev, ...parsed.keys }));
        if (parsed.provider) setProvider(parsed.provider);
      }
    } catch (e) {
      console.warn('Failed to load AI keys from storage', e);
    }
  }, []);

  const saveConfig = (newKeys: Record<string, string>, newProv: Provider) => {
    setApiKeys(newKeys);
    setProvider(newProv);
    localStorage.setItem(
      'gfg_draw_ai_config',
      JSON.stringify({ keys: newKeys, provider: newProv })
    );
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';

  // Call the user's selected LLM API
  const callLlm = async (systemInstruction: string, userPrompt: string): Promise<string> => {
    const key = apiKeys[provider];

    if (provider !== 'ollama' && (!key || key.trim().length === 0)) {
      throw new Error(`API key for ${provider.toUpperCase()} is required. Click the Key icon to configure.`);
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI request failed: ${res.statusText}`);
      }
      const data = await res.json();
      return data.choices[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\nUser request:\n${userPrompt}` }],
            },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini request failed: ${res.statusText}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key.trim(),
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          system: systemInstruction,
          messages: [{ role: 'user', content: userPrompt }],
          max_tokens: 1500,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Anthropic request failed: ${res.statusText}`);
      }
      const data = await res.json();
      return data.content?.[0]?.text || '';
    } else if (provider === 'ollama') {
      const endpoint = (apiKeys.ollama || 'http://localhost:11434').replace(/\/$/, '');
      const res = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `${systemInstruction}\n\n${userPrompt}`,
          stream: false,
        }),
      });
      if (!res.ok) {
        throw new Error(`Ollama connection error to ${endpoint}. Ensure Ollama is running.`);
      }
      const data = await res.json();
      return data.response || '';
    }

    throw new Error('Unsupported provider');
  };

  // Helper to extract clean mermaid code from response
  const extractMermaidCode = (raw: string): string => {
    const codeBlockMatch = raw.match(/```(?:mermaid)?([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return raw.trim();
  };

  // Workflow 1: Prompt to Architecture / Flowchart
  const handleGenerateArchitecture = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setStatusMsg(null);

    try {
      const systemPrompt = `You are an expert systems architect. Output ONLY valid Mermaid flowchart code (starting with "flowchart TD" or "flowchart LR").
Use valid Mermaid syntax:
- Nodes: A["Label"], B{"Decision"}, C[(Database)], D(("Circle"))
- Connectors: A --> B, A -->|label| B
- Grouping: subgraph "Name" ... end
Do NOT output markdown explanations or prose—output ONLY the mermaid diagram block.`;

      const reply = await callLlm(systemPrompt, prompt);
      const mermaidCode = extractMermaidCode(reply);
      const parsed = parseMermaidFlowchart(mermaidCode);

      if (parsed.nodes.size === 0) {
        throw new Error('Could not parse valid nodes from the generated architecture.');
      }

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

      store.doc.transact(() => {
        for (const n of newNodes) store.setNode(activePageId, n);
        for (const e of newEdges) store.setEdge(activePageId, e);
      });

      setStatusMsg({
        type: 'success',
        text: `Successfully generated ${newNodes.length} nodes & ${newEdges.length} connectors on canvas!`,
      });
      setPrompt('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Generation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  // Workflow 2: SQL / Prisma to ERD
  const handleGenerateErd = async () => {
    if (!schemaInput.trim()) return;
    setIsLoading(true);
    setStatusMsg(null);

    try {
      const systemPrompt = `You are a database engineer. Convert this SQL DDL or Prisma schema into a clean Mermaid flowchart diagram.
Start with "flowchart TD".
Represent each table or entity as a node:
TableName["Table: TableName\\n- id (PK)\\n- field1\\n- field2"]
Represent foreign key relationships as edges:
TableA -->|fk_relation| TableB
Output ONLY the mermaid block, no prose.`;

      const reply = await callLlm(systemPrompt, schemaInput);
      const mermaidCode = extractMermaidCode(reply);
      const parsed = parseMermaidFlowchart(mermaidCode);

      if (parsed.nodes.size === 0) {
        throw new Error('No tables or entities parsed from schema.');
      }

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

      store.doc.transact(() => {
        for (const n of newNodes) store.setNode(activePageId, n);
        for (const e of newEdges) store.setEdge(activePageId, e);
      });

      setStatusMsg({
        type: 'success',
        text: `Generated ERD with ${newNodes.length} entity tables!`,
      });
      setSchemaInput('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'ERD generation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  // Workflow 3: Auto-Tidy Selection
  const handleAutoTidySelection = () => {
    const targetNodeIds = selectedNodes.length > 0 ? selectedNodes : Object.keys(nodes);

    if (targetNodeIds.length <= 1) {
      setStatusMsg({
        type: 'error',
        text: 'Select 2 or more nodes on the canvas to auto-tidy.',
      });
      return;
    }

    const targetNodes = targetNodeIds.map((id) => nodes[id]).filter(Boolean);
    if (targetNodes.length === 0) return;

    // Sort nodes primarily by top-to-bottom or left-to-right
    targetNodes.sort((a, b) => a.y - b.y || a.x - b.x);

    // Compute average spacing and tidy them into aligned columns / rows
    const startX = targetNodes[0].x;
    const startY = targetNodes[0].y;
    const GAP_Y = 80;

    store.doc.transact(() => {
      targetNodes.forEach((node, index) => {
        const updatedNode: CanvasNode = {
          ...node,
          x: startX,
          y: startY + index * (node.height + GAP_Y),
        };
        store.setNode(activePageId, updatedNode);
      });
    });

    setStatusMsg({
      type: 'success',
      text: `Auto-tidied ${targetNodes.length} nodes into aligned layout!`,
    });
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
        {/* Modal Header */}
        <div
          className={`h-12 px-4 flex items-center justify-between border-b shrink-0 ${
            isLight ? 'border-zinc-200 bg-zinc-50' : 'border-[#1F2633] bg-[#161B22]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono">
              BYOK AI Architect & Assistant
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className={`p-1.5 rounded transition-colors ${
                showKeyConfig
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
              }`}
              title="Configure API Keys"
            >
              <Key className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* API Key Configuration Drawer (collapsible) */}
        {showKeyConfig && (
          <div
            className={`p-4 border-b space-y-3 text-xs ${
              isLight ? 'bg-zinc-100/70 border-zinc-200' : 'bg-[#161B22]/90 border-[#1F2633]'
            }`}
          >
            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-400">
              <span>LOCAL API KEY STORAGE (BYOK)</span>
              <span>Keys stay in your browser</span>
            </div>

            <div className="flex gap-2">
              {(['gemini', 'openai', 'anthropic', 'ollama'] as Provider[]).map((prov) => (
                <button
                  key={prov}
                  onClick={() => saveConfig(apiKeys, prov)}
                  className={`px-2.5 py-1 rounded text-xs font-mono uppercase transition-colors ${
                    provider === prov
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300'
                  }`}
                >
                  {prov}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                {provider === 'ollama' ? 'Ollama Endpoint URL' : `${provider.toUpperCase()} API Key`}
              </label>
              <input
                type={provider === 'ollama' ? 'text' : 'password'}
                value={apiKeys[provider]}
                onChange={(e) =>
                  saveConfig({ ...apiKeys, [provider]: e.target.value }, provider)
                }
                placeholder={
                  provider === 'ollama'
                    ? 'http://localhost:11434'
                    : `Paste your ${provider.toUpperCase()} key...`
                }
                className="w-full px-3 py-1.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Workflow Tabs */}
        <div
          className={`h-10 px-3 flex items-center gap-2 border-b shrink-0 text-xs ${
            isLight ? 'border-zinc-200 bg-white' : 'border-[#1F2633] bg-[#12161F]'
          }`}
        >
          <button
            onClick={() => setActiveTab('prompt-diagram')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded font-mono text-xs transition-colors ${
              activeTab === 'prompt-diagram'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Prompt to Diagram</span>
          </button>

          <button
            onClick={() => setActiveTab('schema-erd')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded font-mono text-xs transition-colors ${
              activeTab === 'schema-erd'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL / Prisma to ERD</span>
          </button>

          <button
            onClick={() => setActiveTab('auto-tidy')}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded font-mono text-xs transition-colors ${
              activeTab === 'auto-tidy'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-300 dark:border-emerald-800'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Auto-Tidy Selection</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 space-y-3">
          {activeTab === 'prompt-diagram' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Describe any distributed system, flowchart, or algorithm in plain English.
                The assistant will generate native GFG Draw nodes with DAG auto-layout.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Scalable microservices video streaming pipeline with CDN, transcoding worker queue, and S3 object storage..."
                rows={4}
                className="w-full p-2.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 focus:outline-hidden focus:border-emerald-500 resize-none leading-relaxed"
              />
              {/* Quick suggestions */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="text-zinc-400">Try:</span>
                {[
                  'OAuth2 Authentication Flow',
                  'Event-Driven Order Processing with Kafka',
                  'LRU Cache Algorithm State Machine',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-500/10 hover:text-emerald-500 text-zinc-600 dark:text-zinc-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'schema-erd' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste SQL DDL (`CREATE TABLE ...`) or Prisma schema. Generates interconnected ERD entities with fields, types, and foreign key relations.
              </p>
              <textarea
                value={schemaInput}
                onChange={(e) => setSchemaInput(e.target.value)}
                placeholder="CREATE TABLE users (&#10;  id SERIAL PRIMARY KEY,&#10;  email VARCHAR(255)&#10;);&#10;&#10;CREATE TABLE orders (&#10;  id SERIAL PRIMARY KEY,&#10;  user_id INT REFERENCES users(id),&#10;  total DECIMAL&#10;);"
                rows={5}
                className="w-full p-2.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 focus:outline-hidden focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>
          )}

          {activeTab === 'auto-tidy' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Organize unaligned nodes into clean, spaced orthogonal hierarchies.
              </p>
              <div
                className={`p-3 rounded border text-xs font-mono ${
                  selectedNodes.length > 0
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-500'
                }`}
              >
                {selectedNodes.length > 0
                  ? `Selected nodes to tidy: ${selectedNodes.length} elements`
                  : `No selection — will tidy all ${Object.keys(nodes).length} nodes on current page.`}
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                  : 'bg-red-500/10 border border-red-500/30 text-red-500'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className={`p-3 px-4 flex items-center justify-between border-t shrink-0 ${
            isLight ? 'border-zinc-200 bg-zinc-50' : 'border-[#1F2633] bg-[#161B22]'
          }`}
        >
          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
            <span>Provider:</span>
            <span className="font-semibold text-emerald-500 uppercase">{provider}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Close
            </button>

            {activeTab === 'prompt-diagram' && (
              <button
                onClick={handleGenerateArchitecture}
                disabled={isLoading || !prompt.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shadow-xs"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Generate Diagram</span>
              </button>
            )}

            {activeTab === 'schema-erd' && (
              <button
                onClick={handleGenerateErd}
                disabled={isLoading || !schemaInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shadow-xs"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>Generate ERD</span>
              </button>
            )}

            {activeTab === 'auto-tidy' && (
              <button
                onClick={handleAutoTidySelection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Apply Auto-Tidy</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
