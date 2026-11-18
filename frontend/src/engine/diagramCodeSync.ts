import { CanvasNode, CanvasEdge, ShapeType, ConnectionSide } from '../types/canvas';
import { generateHexId } from './camera';

export interface ParsedMermaidNode {
  id: string;
  label: string;
  shape: ShapeType;
  subgraph?: string;
}

export interface ParsedMermaidEdge {
  fromId: string;
  toId: string;
  label?: string;
  isDashed?: boolean;
}

export interface ParsedDiagram {
  direction: 'TD' | 'LR' | 'TB';
  nodes: Map<string, ParsedMermaidNode>;
  edges: ParsedMermaidEdge[];
  subgraphs: Map<string, string[]>; // subgraph name -> node ids
}

/**
 * Lightweight, zero-dependency Mermaid flowchart parser.
 * Supports:
 * - `flowchart TD`, `flowchart LR`, `graph TD`, `graph LR`
 * - Shapes: `[rect]`, `(rounded)`, `([stadium])`, `{diamond}`, `((circle))`, `[(database)]`
 * - Edges: `-->`, `---`, `-->|label|`, `-- label -->`, `-.->`
 * - Subgraphs: `subgraph Title ... end`
 */
export function parseMermaidFlowchart(code: string): ParsedDiagram {
  const lines = code.split('\n');
  let direction: 'TD' | 'LR' | 'TB' = 'TD';
  const nodes = new Map<string, ParsedMermaidNode>();
  const edges: ParsedMermaidEdge[] = [];
  const subgraphs = new Map<string, string[]>();

  let currentSubgraph: string | null = null;

  const getOrCreateNode = (rawId: string, defaultLabel?: string, defaultShape: ShapeType = 'rectangle'): ParsedMermaidNode => {
    const id = rawId.trim();
    if (nodes.has(id)) {
      const existing = nodes.get(id)!;
      if (defaultLabel && existing.label === id) {
        existing.label = defaultLabel;
      }
      return existing;
    }
    const newNode: ParsedMermaidNode = {
      id,
      label: defaultLabel || id,
      shape: defaultShape,
      subgraph: currentSubgraph || undefined,
    };
    nodes.set(id, newNode);

    if (currentSubgraph) {
      const list = subgraphs.get(currentSubgraph) || [];
      list.push(id);
      subgraphs.set(currentSubgraph, list);
    }

    return newNode;
  };

  // Helper to extract node token with shape
  // e.g. A["Hello World"], B{"Decision"}, C[(Database)], D((Circle))
  const parseNodeToken = (token: string): { id: string; label: string; shape: ShapeType } => {
    const trimmed = token.trim();

    // [(Database)]
    const dbMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\[\((.*?)\)\]$/);
    if (dbMatch) {
      return { id: dbMatch[1], label: dbMatch[2].replace(/^["']|["']$/g, ''), shape: 'sys-database' };
    }

    // (([Circle]))
    const circleMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\(\((.*?)\)\)$/);
    if (circleMatch) {
      return { id: circleMatch[1], label: circleMatch[2].replace(/^["']|["']$/g, ''), shape: 'ellipse' };
    }

    // ([Stadium])
    const stadiumMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\(\[(.*?)\]\)$/);
    if (stadiumMatch) {
      return { id: stadiumMatch[1], label: stadiumMatch[2].replace(/^["']|["']$/g, ''), shape: 'ellipse' };
    }

    // {Diamond}
    const diamondMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\{(.*?)\}$/);
    if (diamondMatch) {
      return { id: diamondMatch[1], label: diamondMatch[2].replace(/^["']|["']$/g, ''), shape: 'diamond' };
    }

    // (Rounded)
    const roundedMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\((.*?)\)$/);
    if (roundedMatch) {
      return { id: roundedMatch[1], label: roundedMatch[2].replace(/^["']|["']$/g, ''), shape: 'rectangle' };
    }

    // [Rectangle]
    const rectMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\[(.*?)\]$/);
    if (rectMatch) {
      return { id: rectMatch[1], label: rectMatch[2].replace(/^["']|["']$/g, ''), shape: 'rectangle' };
    }

    return { id: trimmed, label: trimmed, shape: 'rectangle' };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue; // Skip comments and empty lines

    // Diagram declaration
    if (line.startsWith('graph') || line.startsWith('flowchart')) {
      if (line.includes('LR')) direction = 'LR';
      else if (line.includes('TB')) direction = 'TB';
      else direction = 'TD';
      continue;
    }

    // Subgraph declaration
    if (line.startsWith('subgraph')) {
      const match = line.match(/^subgraph\s+(?:["'](.*?)["']|(.*?))$/);
      currentSubgraph = match ? (match[1] || match[2] || 'Frame').trim() : 'Frame';
      if (!subgraphs.has(currentSubgraph)) {
        subgraphs.set(currentSubgraph, []);
      }
      continue;
    }

    if (line === 'end') {
      currentSubgraph = null;
      continue;
    }

    // Check for edge: A -->|label| B or A -- label --> B or A --> B or A -.-> B
    // Regex splits by edge operators
    const edgeMatch = line.match(
      /^(.*?)(-->|---|==>|-\.->)(?:\|(.*?)\|)?(.*)$/
    );

    if (edgeMatch) {
      const leftPart = edgeMatch[1].trim();
      const edgeOp = edgeMatch[2];
      let edgeLabel = edgeMatch[3] ? edgeMatch[3].trim() : undefined;
      let rightPart = edgeMatch[4].trim();

      // Check alternate syntax: A -- label --> B
      const altLabelMatch = leftPart.match(/^(.*?)--\s*(.*?)\s*$/);
      let parsedLeft = leftPart;
      if (altLabelMatch) {
        parsedLeft = altLabelMatch[1].trim();
        edgeLabel = altLabelMatch[2].trim();
      }

      const leftNodeInfo = parseNodeToken(parsedLeft);
      const rightNodeInfo = parseNodeToken(rightPart);

      getOrCreateNode(leftNodeInfo.id, leftNodeInfo.label, leftNodeInfo.shape);
      getOrCreateNode(rightNodeInfo.id, rightNodeInfo.label, rightNodeInfo.shape);

      edges.push({
        fromId: leftNodeInfo.id,
        toId: rightNodeInfo.id,
        label: edgeLabel,
        isDashed: edgeOp.includes('.'),
      });
      continue;
    }

    // Single node definition: e.g. A["Database"]
    if (line.includes('[') || line.includes('(') || line.includes('{')) {
      const nodeInfo = parseNodeToken(line);
      getOrCreateNode(nodeInfo.id, nodeInfo.label, nodeInfo.shape);
    }
  }

  return { direction, nodes, edges, subgraphs };
}

/**
 * Layered DAG auto-layout algorithm (Sugiyama-inspired rank assignment + barycenter ordering)
 */
export function layoutDiagramToCanvas(
  diagram: ParsedDiagram,
  startOrigin: { x: number; y: number } = { x: 100, y: 100 }
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const { direction, nodes: parsedNodes, edges: parsedEdges, subgraphs } = diagram;
  const isHorizontal = direction === 'LR';

  const nodeMap = new Map<string, CanvasNode>();
  const idToHexMap = new Map<string, string>();

  // 1. Assign unique 16-char hex IDs
  parsedNodes.forEach((node, rawId) => {
    idToHexMap.set(rawId, generateHexId());
  });

  // 2. Compute in-degree and adjacency
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const revAdj = new Map<string, string[]>();

  parsedNodes.forEach((_, id) => {
    inDegree.set(id, 0);
    adj.set(id, []);
    revAdj.set(id, []);
  });

  for (const edge of parsedEdges) {
    if (adj.has(edge.fromId) && adj.has(edge.toId)) {
      adj.get(edge.fromId)!.push(edge.toId);
      revAdj.get(edge.toId)!.push(edge.fromId);
      inDegree.set(edge.toId, (inDegree.get(edge.toId) || 0) + 1);
    }
  }

  // 3. Layer Assignment (Rank assignment via Topological longest path)
  const ranks = new Map<string, number>();
  const queue: string[] = [];

  // Seed nodes with in-degree 0
  parsedNodes.forEach((_, id) => {
    if ((inDegree.get(id) || 0) === 0) {
      ranks.set(id, 0);
      queue.push(id);
    }
  });

  // If cycle or no in-degree 0, seed first node
  if (queue.length === 0 && parsedNodes.size > 0) {
    const firstKey = parsedNodes.keys().next().value!;
    ranks.set(firstKey, 0);
    queue.push(firstKey);
  }

  // BFS longest path
  const visited = new Set<string>();
  while (queue.length > 0) {
    const curr = queue.shift()!;
    visited.add(curr);
    const currRank = ranks.get(curr) || 0;

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      const nextRank = ranks.get(next) || 0;
      if (currRank + 1 > nextRank) {
        ranks.set(next, currRank + 1);
      }
      if (!visited.has(next) && !queue.includes(next)) {
        queue.push(next);
      }
    }
  }

  // Ensure all nodes have a rank
  parsedNodes.forEach((_, id) => {
    if (!ranks.has(id)) {
      ranks.set(id, 0);
    }
  });

  // 4. Group nodes into layers
  const layers: string[][] = [];
  ranks.forEach((rank, id) => {
    while (layers.length <= rank) {
      layers.push([]);
    }
    layers[rank].push(id);
  });

  // 5. Barycenter crossing reduction
  for (let l = 1; l < layers.length; l++) {
    const prevLayer = layers[l - 1];
    const prevPosMap = new Map<string, number>();
    prevLayer.forEach((id, idx) => prevPosMap.set(id, idx));

    layers[l].sort((a, b) => {
      const parentsA = revAdj.get(a) || [];
      const parentsB = revAdj.get(b) || [];

      const avgA =
        parentsA.length > 0
          ? parentsA.reduce((sum, p) => sum + (prevPosMap.get(p) ?? 0), 0) / parentsA.length
          : 0;
      const avgB =
        parentsB.length > 0
          ? parentsB.reduce((sum, p) => sum + (prevPosMap.get(p) ?? 0), 0) / parentsB.length
          : 0;

      return avgA - avgB;
    });
  }

  // 6. Calculate Coordinates
  const NODE_W = 140;
  const NODE_H = 56;
  const GAP_LAYER = 130;
  const GAP_SIBLING = 60;

  layers.forEach((layerNodes, layerIndex) => {
    const layerBreadth = layerNodes.length * (NODE_W + GAP_SIBLING) - GAP_SIBLING;
    const startBreadth = -layerBreadth / 2;

    layerNodes.forEach((nodeId, nodeIndex) => {
      const pNode = parsedNodes.get(nodeId)!;
      const hexId = idToHexMap.get(nodeId)!;

      let x = 0;
      let y = 0;

      if (isHorizontal) {
        // Left to Right: layer is X, index is Y
        x = startOrigin.x + layerIndex * (NODE_W + GAP_LAYER);
        y = startOrigin.y + startBreadth + nodeIndex * (NODE_H + GAP_SIBLING);
      } else {
        // Top to Down: layer is Y, index is X
        x = startOrigin.x + startBreadth + nodeIndex * (NODE_W + GAP_SIBLING);
        y = startOrigin.y + layerIndex * (NODE_H + GAP_LAYER);
      }

      const canvasNode: CanvasNode = {
        id: hexId,
        type: 'shape',
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        color: '#10B981',
        text: pNode.label,
        _ext: {
          shape: pNode.shape,
          renderMode: 'precision',
          strokeWidth: 2,
          strokeColor: '#10B981',
          backgroundColor: '#10B98115',
          fontSize: 13,
        },
      };

      nodeMap.set(nodeId, canvasNode);
    });
  });

  // 7. Subgraph Frames
  const frameNodes: CanvasNode[] = [];
  subgraphs.forEach((childIds, name) => {
    if (childIds.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    childIds.forEach((cId) => {
      const n = nodeMap.get(cId);
      if (n) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      }
    });

    if (minX !== Infinity) {
      const pad = 30;
      frameNodes.push({
        id: generateHexId(),
        type: 'frame',
        x: minX - pad,
        y: minY - pad - 20,
        width: maxX - minX + pad * 2,
        height: maxY - minY + pad * 2 + 20,
        text: name,
        _ext: {
          shape: 'frame',
          frameTitle: name,
          renderMode: 'precision',
        },
      });
    }
  });

  // 8. Connectors
  const canvasEdges: CanvasEdge[] = [];
  for (const edge of parsedEdges) {
    const fromCanvasNode = nodeMap.get(edge.fromId);
    const toCanvasNode = nodeMap.get(edge.toId);

    if (fromCanvasNode && toCanvasNode) {
      let fromSide: ConnectionSide = isHorizontal ? 'right' : 'bottom';
      let toSide: ConnectionSide = isHorizontal ? 'left' : 'top';

      canvasEdges.push({
        id: generateHexId(),
        fromNode: fromCanvasNode.id,
        fromSide,
        fromEnd: 'none',
        toNode: toCanvasNode.id,
        toSide,
        toEnd: 'arrow',
        color: '#10B981',
        label: edge.label,
        routing: 'elbow',
        _ext: {
          renderMode: 'precision',
          strokeWidth: 2,
          routing: 'elbow',
        },
      });
    }
  }

  return {
    nodes: [...frameNodes, ...Array.from(nodeMap.values())],
    edges: canvasEdges,
  };
}

/**
 * Canvas-to-Code: Serializes live canvas nodes and edges to clean Mermaid flowchart syntax.
 */
export function serializeCanvasToMermaid(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  direction: 'TD' | 'LR' = 'TD'
): string {
  const lines: string[] = [`flowchart ${direction}`];
  const nodeArray = Object.values(nodes);
  const edgeArray = Object.values(edges);

  if (nodeArray.length === 0) {
    return 'flowchart TD\n    %% Empty canvas';
  }

  // Create clean short aliases
  const idToAlias = new Map<string, string>();
  let counter = 1;

  for (const node of nodeArray) {
    if (node.type === 'frame') continue;
    const cleanAlias = `node_${counter++}`;
    idToAlias.set(node.id, cleanAlias);

    const label = (node.text || 'Node').replace(/"/g, "'").replace(/\n/g, ' ');
    const shape = node._ext?.shape || 'rectangle';

    if (shape === 'diamond') {
      lines.push(`    ${cleanAlias}{"${label}"}`);
    } else if (shape === 'ellipse') {
      lines.push(`    ${cleanAlias}(("${label}"))`);
    } else if (shape === 'sys-database') {
      lines.push(`    ${cleanAlias}[("${label}")]`);
    } else {
      lines.push(`    ${cleanAlias}["${label}"]`);
    }
  }

  lines.push('');

  // Edges
  for (const edge of edgeArray) {
    const fromAlias = idToAlias.get(edge.fromNode);
    const toAlias = idToAlias.get(edge.toNode);

    if (fromAlias && toAlias) {
      if (edge.label && edge.label.trim()) {
        const cleanLabel = edge.label.replace(/"/g, "'").trim();
        lines.push(`    ${fromAlias} -->|${cleanLabel}| ${toAlias}`);
      } else {
        lines.push(`    ${fromAlias} --> ${toAlias}`);
      }
    }
  }

  return lines.join('\n');
}
