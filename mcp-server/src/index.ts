#!/usr/bin/env node
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import * as readline from 'readline';

// Command line args: --room <id> --ws <url>
const args = process.argv.slice(2);
let roomId = 'default-board';
let wsUrl = 'wss://demos.yjs.dev/ws';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--room' && args[i + 1]) {
    roomId = args[i + 1];
    i++;
  } else if (args[i] === '--ws' && args[i + 1]) {
    wsUrl = args[i + 1];
    i++;
  }
}

// Connect Yjs doc
const doc = new Y.Doc();
const docName = `gfg-whiteboard-${roomId}`;

const wsProvider = new WebsocketProvider(wsUrl, docName, doc, {
  WebSocketPolyfill: WebSocket as any,
});

const pagesMap = doc.getMap<Y.Map<any>>('pages');

function getActivePage(pageId?: string): { pageId: string; pageYMap: Y.Map<any> } {
  let targetId = pageId;
  if (!targetId) {
    const keys = Array.from(pagesMap.keys());
    targetId = keys[0] || 'page-1';
  }

  let pageYMap = pagesMap.get(targetId);
  if (!pageYMap) {
    pageYMap = new Y.Map();
    pageYMap.set('id', targetId);
    pageYMap.set('name', 'Page 1');
    pageYMap.set('nodes', new Y.Map());
    pageYMap.set('edges', new Y.Map());
    pagesMap.set(targetId, pageYMap);
  }

  return { pageId: targetId, pageYMap };
}

// MCP Tools Definitions
const TOOLS = [
  {
    name: 'get_board_summary',
    description:
      'Inspects the live GFG Draw canvas room. Returns pages list, node count, edge count, and full list of canvas nodes and smart connectors with their coordinates, shapes, and labels.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Optional page ID. Defaults to the active first page.',
        },
      },
    },
  },
  {
    name: 'upsert_nodes_and_edges',
    description:
      'Creates or updates nodes and smart connectors live on the GFG Draw board.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Target page ID',
        },
        nodes: {
          type: 'array',
          description: 'Array of CanvasNode objects to create or update',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['shape', 'text', 'frame'] },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              color: { type: 'string' },
              text: { type: 'string' },
              _ext: { type: 'object' },
            },
            required: ['x', 'y', 'width', 'height'],
          },
        },
        edges: {
          type: 'array',
          description: 'Array of CanvasEdge connectors to create',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fromNode: { type: 'string' },
              fromSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
              toNode: { type: 'string' },
              toSide: { type: 'string', enum: ['top', 'right', 'bottom', 'left'] },
              color: { type: 'string' },
              label: { type: 'string' },
              routing: { type: 'string', enum: ['straight', 'curved', 'elbow'] },
            },
            required: ['fromNode', 'toNode'],
          },
        },
      },
      required: [],
    },
  },
  {
    name: 'auto_layout_page',
    description:
      'Rearranges existing nodes on the board into a neat, clean layered DAG or grid layout.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        direction: { type: 'string', enum: ['TD', 'LR'], description: 'Layout direction' },
      },
    },
  },
  {
    name: 'clear_or_delete_elements',
    description:
      'Clears the entire active board page or deletes specified nodes and edges.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' } },
        edgeIds: { type: 'array', items: { type: 'string' } },
        clearAll: { type: 'boolean', description: 'If true, clears all nodes & edges on the page' },
      },
    },
  },
];

function generateHex(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

// Handle Tool Executions
async function executeTool(name: string, args: any): Promise<any> {
  const { pageId, pageYMap } = getActivePage(args?.pageId);
  const nodesMap = pageYMap.get('nodes') as Y.Map<any>;
  const edgesMap = pageYMap.get('edges') as Y.Map<any>;

  if (name === 'get_board_summary') {
    const pages: any[] = [];
    pagesMap.forEach((pMap: any, id: string) => {
      pages.push({
        id,
        name: pMap.get('name') || 'Untitled',
      });
    });

    const nodes = nodesMap ? nodesMap.toJSON() : {};
    const edges = edgesMap ? edgesMap.toJSON() : {};

    return {
      roomId,
      activePageId: pageId,
      pages,
      nodeCount: Object.keys(nodes).length,
      edgeCount: Object.keys(edges).length,
      nodes,
      edges,
    };
  }

  if (name === 'upsert_nodes_and_edges') {
    const createdNodes: string[] = [];
    const createdEdges: string[] = [];

    doc.transact(() => {
      if (args.nodes && Array.isArray(args.nodes)) {
        for (const n of args.nodes) {
          const id = n.id || generateHex();
          const nodeData = {
            id,
            type: n.type || 'shape',
            x: n.x || 100,
            y: n.y || 100,
            width: n.width || 140,
            height: n.height || 60,
            color: n.color || '#10B981',
            text: n.text || '',
            _ext: {
              shape: n._ext?.shape || 'rectangle',
              renderMode: 'precision',
              strokeWidth: 2,
              strokeColor: n.color || '#10B981',
              backgroundColor: (n.color || '#10B981') + '15',
              ...n._ext,
            },
          };
          nodesMap.set(id, nodeData);
          createdNodes.push(id);
        }
      }

      if (args.edges && Array.isArray(args.edges)) {
        for (const e of args.edges) {
          const id = e.id || generateHex();
          const edgeData = {
            id,
            fromNode: e.fromNode,
            fromSide: e.fromSide || 'bottom',
            toNode: e.toNode,
            toSide: e.toSide || 'top',
            color: e.color || '#10B981',
            label: e.label || '',
            routing: e.routing || 'elbow',
            _ext: {
              renderMode: 'precision',
              strokeWidth: 2,
              routing: e.routing || 'elbow',
            },
          };
          edgesMap.set(id, edgeData);
          createdEdges.push(id);
        }
      }
    });

    return {
      success: true,
      nodesCreated: createdNodes.length,
      edgesCreated: createdEdges.length,
      nodeIds: createdNodes,
      edgeIds: createdEdges,
    };
  }

  if (name === 'auto_layout_page') {
    const nodes = Object.values(nodesMap ? nodesMap.toJSON() : {}) as any[];
    if (nodes.length === 0) return { success: false, message: 'Page is empty' };

    const isHorizontal = args?.direction === 'LR';
    const GAP = 90;

    doc.transact(() => {
      nodes.forEach((n, idx) => {
        const updated = { ...n };
        if (isHorizontal) {
          updated.x = 100 + idx * (updated.width + GAP);
          updated.y = 200;
        } else {
          updated.x = 250;
          updated.y = 100 + idx * (updated.height + GAP);
        }
        nodesMap.set(updated.id, updated);
      });
    });

    return { success: true, laidOutCount: nodes.length };
  }

  if (name === 'clear_or_delete_elements') {
    doc.transact(() => {
      if (args.clearAll) {
        nodesMap.clear();
        edgesMap.clear();
      } else {
        if (args.nodeIds && Array.isArray(args.nodeIds)) {
          for (const id of args.nodeIds) nodesMap.delete(id);
        }
        if (args.edgeIds && Array.isArray(args.edgeIds)) {
          for (const id of args.edgeIds) edgesMap.delete(id);
        }
      }
    });
    return { success: true };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// JSON-RPC 2.0 stdio Server
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'gfg-draw-mcp',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } else if (method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS,
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } else if (method === 'tools/call') {
      try {
        const result = await executeTool(params.name, params.arguments);
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (err: any) {
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: err.message || 'Internal tool execution error',
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } else {
      // Method not found or notification
      if (id !== undefined) {
        const response = {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method ${method} not found`,
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }
  } catch (parseErr) {
    // Malformed JSON
  }
});
