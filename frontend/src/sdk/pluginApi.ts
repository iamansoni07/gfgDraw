import React from 'react';
import { CanvasNode, CanvasEdge, ShapeType } from '../types/canvas';

export interface CustomNodeRendererProps {
  ctx: CanvasRenderingContext2D;
  node: CanvasNode;
  theme: 'light' | 'dark';
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
}

export type CustomNodeRenderer = (props: CustomNodeRendererProps) => void;

export interface CustomNodeEditorProps {
  node: CanvasNode;
  onUpdate: (updatedNode: Partial<CanvasNode>) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

export interface CustomNodePropertyProps {
  node: CanvasNode;
  onUpdate: (updatedNode: Partial<CanvasNode>) => void;
  theme: 'light' | 'dark';
}

export interface CustomNodeDefinition {
  type: string; // e.g. 'plugin-code-block' | 'plugin-latex-math'
  label: string;
  description?: string;
  icon?: string;
  defaultWidth: number;
  defaultHeight: number;
  render: CustomNodeRenderer;
  editor?: React.ComponentType<CustomNodeEditorProps>;
  propertyControls?: React.ComponentType<CustomNodePropertyProps>;
}

export interface CustomExporter {
  id: string;
  label: string;
  extension: string;
  mimeType: string;
  export: (
    nodes: Record<string, CanvasNode>,
    edges: Record<string, CanvasEdge>
  ) => string | Blob | Promise<string | Blob>;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  nodes?: CustomNodeDefinition[];
  exporters?: CustomExporter[];
  init?: (registry: typeof PluginRegistry) => void;
}

class PluginRegistryClass {
  private customNodes: Map<string, CustomNodeDefinition> = new Map();
  private exporters: Map<string, CustomExporter> = new Map();
  private registeredPlugins: Map<string, PluginDefinition> = new Map();
  private listeners: Set<() => void> = new Set();

  public registerPlugin(plugin: PluginDefinition): void {
    if (this.registeredPlugins.has(plugin.id)) {
      return;
    }
    this.registeredPlugins.set(plugin.id, plugin);

    if (plugin.nodes) {
      for (const nodeDef of plugin.nodes) {
        this.registerCustomNode(nodeDef);
      }
    }

    if (plugin.exporters) {
      for (const exporter of plugin.exporters) {
        this.registerExporter(exporter);
      }
    }

    if (plugin.init) {
      plugin.init(this);
    }

    this.notify();
  }

  public registerCustomNode(def: CustomNodeDefinition): void {
    this.customNodes.set(def.type, def);
    this.notify();
  }

  public getCustomNode(type: string): CustomNodeDefinition | undefined {
    return this.customNodes.get(type);
  }

  public getAllCustomNodes(): CustomNodeDefinition[] {
    return Array.from(this.customNodes.values());
  }

  public getAllPlugins(): PluginDefinition[] {
    return Array.from(this.registeredPlugins.values());
  }

  public unregisterPlugin(id: string): void {
    const plugin = this.registeredPlugins.get(id);
    if (!plugin) return;
    if (plugin.nodes) {
      for (const nodeDef of plugin.nodes) {
        this.customNodes.delete(nodeDef.type);
      }
    }
    if (plugin.exporters) {
      for (const exporter of plugin.exporters) {
        this.exporters.delete(exporter.id);
      }
    }
    this.registeredPlugins.delete(id);
    this.notify();
  }

  public registerExporter(exporter: CustomExporter): void {
    this.exporters.set(exporter.id, exporter);
    this.notify();
  }

  public getExporter(id: string): CustomExporter | undefined {
    return this.exporters.get(id);
  }

  public getAllExporters(): CustomExporter[] {
    return Array.from(this.exporters.values());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const PluginRegistry = new PluginRegistryClass();

export function registerPlugin(plugin: PluginDefinition): void {
  PluginRegistry.registerPlugin(plugin);
}

export function unregisterPlugin(id: string): void {
  PluginRegistry.unregisterPlugin(id);
}

export function getActivePlugins(): PluginDefinition[] {
  return PluginRegistry.getAllPlugins();
}

export type GfgPlugin = PluginDefinition;
export type PluginContext = typeof PluginRegistry;

// ========================================================
// BUILT-IN REFERENCE PLUGIN 1: CODE SNIPPET CARD
// ========================================================

export const CodeSnippetCardPlugin: PluginDefinition = {
  id: 'gfg-code-snippet',
  name: 'Code Snippet Card',
  version: '1.0.0',
  description: 'Interactive code card with syntax highlighting and window chrome.',
  nodes: [
    {
      type: 'plugin-code-block',
      label: 'Code Block',
      description: 'Syntax-highlighted code snippet card',
      icon: 'Code2',
      defaultWidth: 280,
      defaultHeight: 160,
      render: ({ ctx, node, theme, strokeColor, strokeWidth, fillColor }) => {
        const x = node.x;
        const y = node.y;
        const w = node.width;
        const h = node.height;
        const r = 8;
        const headerH = 26;

        // Container body
        ctx.save();
        ctx.fillStyle = theme === 'dark' ? '#0E131F' : '#181E29'; // Always dark studio terminal look
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();

        ctx.strokeStyle = theme === 'dark' ? '#212936' : '#374151';
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        // Mac-style Window Title Bar
        ctx.fillStyle = theme === 'dark' ? '#161B26' : '#222938';
        ctx.beginPath();
        ctx.roundRect(x, y, w, headerH, [r, r, 0, 0]);
        ctx.fill();

        // 3 Window control dots
        const dotColors = ['#EF4444', '#F59E0B', '#10B981'];
        dotColors.forEach((color, i) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + 14 + i * 11, y + headerH / 2, 3.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Language tag on right of header
        const lang = (node._ext?.iconType || 'typescript').toLowerCase();
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = '#9CA3AF';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(lang, x + w - 12, y + headerH / 2);

        // Code Lines with syntax highlighting
        const codeText = node.text || 'function solve(arr) {\n  return arr.map(x => x * 2);\n}';
        const lines = codeText.split('\n');
        const startY = y + headerH + 16;
        const lineHeight = 16;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        lines.slice(0, 10).forEach((line, idx) => {
          const lineY = startY + idx * lineHeight;

          // Line number
          ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillStyle = '#4B5563';
          ctx.fillText(String(idx + 1).padStart(2, ' '), x + 10, lineY);

          // Code line content
          let tokenX = x + 34;
          const words = line.split(/(\s+|[(),;.{}[\]])/);

          words.forEach((token) => {
            if (!token) return;

            // Simple fast syntax coloring rules
            if (
              ['function', 'const', 'let', 'var', 'return', 'import', 'export', 'class', 'if', 'for', 'while', 'def', 'async', 'await'].includes(
                token
              )
            ) {
              ctx.fillStyle = '#F472B6'; // Pink keyword
              ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            } else if (['string', 'number', 'boolean', 'void', 'any', 'Promise'].includes(token)) {
              ctx.fillStyle = '#60A5FA'; // Blue types
              ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
              ctx.fillStyle = '#34D399'; // Emerald string
              ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            } else if (token.startsWith('//') || token.startsWith('#')) {
              ctx.fillStyle = '#6B7280'; // Gray comment
              ctx.font = 'italic 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            } else {
              ctx.fillStyle = '#F3F4F6'; // White default
              ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, monospace';
            }

            ctx.fillText(token, tokenX, lineY);
            tokenX += ctx.measureText(token).width;
          });
        });

        ctx.restore();
      },
    },
  ],
};

// ========================================================
// BUILT-IN REFERENCE PLUGIN 2: LATEX MATH EQUATION BLOCK
// ========================================================

export const LatexMathBlockPlugin: PluginDefinition = {
  id: 'gfg-latex-math',
  name: 'LaTeX Equation Block',
  version: '1.0.0',
  description: 'Mathematical formula block with integral/summation glyphs and notation.',
  nodes: [
    {
      type: 'plugin-latex-math',
      label: 'LaTeX Formula',
      description: 'Mathematical equation block with KaTeX notation',
      icon: 'Pi',
      defaultWidth: 260,
      defaultHeight: 110,
      render: ({ ctx, node, theme, strokeColor, strokeWidth, fillColor }) => {
        const x = node.x;
        const y = node.y;
        const w = node.width;
        const h = node.height;
        const r = 6;

        ctx.save();
        // Architectural background
        ctx.fillStyle =
          fillColor !== 'transparent'
            ? fillColor
            : theme === 'dark'
            ? '#141A23'
            : '#FDFDFC';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        // Top-left mathematical symbol glyph (∑ / ∫)
        ctx.font = 'bold 15px "Times New Roman", Times, serif';
        ctx.fillStyle = theme === 'dark' ? '#10B981' : '#059669';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('∫ ∑', x + 12, y + 10);

        // Subtitle / Formula Name tag
        const tag = node._ext?.frameTitle || 'Formula (LaTeX)';
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = theme === 'dark' ? '#9CA3AF' : '#6B7280';
        ctx.fillText(tag, x + 40, y + 11);

        // Formula body
        const formula = node.text || 'f(x) = \\int_{-\\infty}^{\\infty} \\hat{f}(\\xi) e^{2\\pi i \\xi x} d\\xi';
        ctx.font = '500 13px "Times New Roman", Times, serif, ui-sans-serif';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = formula.split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, x + w / 2, y + h / 2 + 10 + idx * 18, w - 24);
        });

        ctx.restore();
      },
    },
  ],
};

// ========================================================
// BUILT-IN REFERENCE EXPORTERS: MARKDOWN & PLANTUML
// ========================================================

export const BuiltInExportersPlugin: PluginDefinition = {
  id: 'gfg-builtin-exporters',
  name: 'Built-in Exporters',
  version: '1.0.0',
  exporters: [
    {
      id: 'markdown-outline',
      label: 'Markdown Outline (.md)',
      extension: 'md',
      mimeType: 'text/markdown',
      export: (nodes, edges) => {
        const lines: string[] = ['# Whiteboard Architecture Outline\n'];
        const frames = Object.values(nodes).filter((n) => n.type === 'frame');
        const regularNodes = Object.values(nodes).filter((n) => n.type !== 'frame');

        if (frames.length > 0) {
          frames.forEach((frame) => {
            lines.push(`## Frame: ${frame._ext?.frameTitle || frame.text || 'Untitled'}`);
            // Find nodes physically inside this frame
            const childNodes = regularNodes.filter(
              (n) =>
                n.x >= frame.x &&
                n.x + n.width <= frame.x + frame.width &&
                n.y >= frame.y &&
                n.y + n.height <= frame.y + frame.height
            );
            childNodes.forEach((c) => {
              lines.push(`- **${c._ext?.shape || 'node'}**: ${c.text?.replace(/\n/g, ' ') || 'Untitled'}`);
            });
            lines.push('');
          });
        }

        lines.push('## Canvas Nodes & Connectors');
        regularNodes.forEach((n) => {
          lines.push(`- **${n.text?.replace(/\n/g, ' ') || 'Node'}** (${n._ext?.shape || 'shape'})`);
        });

        lines.push('\n## Relationships');
        Object.values(edges).forEach((e) => {
          const from = nodes[e.fromNode]?.text?.replace(/\n/g, ' ') || e.fromNode;
          const to = nodes[e.toNode]?.text?.replace(/\n/g, ' ') || e.toNode;
          const label = e.label ? ` --[${e.label}]--> ` : ' --> ';
          lines.push(`- ${from}${label}${to}`);
        });

        return lines.join('\n');
      },
    },
    {
      id: 'plantuml',
      label: 'PlantUML (.puml)',
      extension: 'puml',
      mimeType: 'text/plain',
      export: (nodes, edges) => {
        const lines: string[] = ['@startuml', '!theme vibrant', ''];
        const idMap = new Map<string, string>();
        let counter = 1;

        Object.values(nodes).forEach((n) => {
          if (n.type === 'frame') return;
          const alias = `node_${counter++}`;
          idMap.set(n.id, alias);
          const cleanText = (n.text || 'Node').replace(/"/g, "'").replace(/\n/g, '\\n');
          lines.push(`component "${cleanText}" as ${alias}`);
        });

        lines.push('');

        Object.values(edges).forEach((e) => {
          const from = idMap.get(e.fromNode);
          const to = idMap.get(e.toNode);
          if (from && to) {
            const label = e.label ? ` : ${e.label}` : '';
            lines.push(`${from} --> ${to}${label}`);
          }
        });

        lines.push('', '@enduml');
        return lines.join('\n');
      },
    },
  ],
};

// Register built-in reference plugins upon module load
PluginRegistry.registerPlugin(CodeSnippetCardPlugin);
PluginRegistry.registerPlugin(LatexMathBlockPlugin);
PluginRegistry.registerPlugin(BuiltInExportersPlugin);

