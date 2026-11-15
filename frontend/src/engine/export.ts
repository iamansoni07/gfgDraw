import { CanvasNode, CanvasEdge, BoundingBox, JSONCanvasDoc } from '../types/canvas';
import { getNodeBoundingBox } from './spatialIndex';
import { resolveColor, getAnchorPoint } from './renderer';

/**
 * Triggers a client-side file download.
 */
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports JSON Canvas 1.0 doc to a downloadable .canvas file.
 */
export function exportCanvasFile(doc: JSONCanvasDoc, title = 'whiteboard'): void {
  const jsonStr = JSON.stringify(doc, null, 2);
  downloadFile(jsonStr, `${title}.canvas`, 'application/json');
}

/**
 * Reads and parses an uploaded .canvas or .json file into a JSONCanvasDoc.
 */
export async function parseCanvasFile(file: File): Promise<JSONCanvasDoc> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed.nodes && !parsed.edges) {
    throw new Error('Invalid JSON Canvas format: missing nodes or edges array');
  }
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
  };
}

/**
 * Computes bounding box covering all nodes on the active page.
 */
export function getAllNodesBounds(nodes: Record<string, CanvasNode>): BoundingBox | null {
  const nodeList = Object.values(nodes);
  if (nodeList.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodeList) {
    const b = getNodeBoundingBox(node);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Exports canvas to PNG image blob.
 */
export async function exportCanvasToPNG(
  canvas: HTMLCanvasElement,
  transparent = false
): Promise<Blob> {
  if (transparent) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });
  }

  // Create temporary offscreen canvas with white/neutral background
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  ctx.drawImage(canvas, 0, 0);

  return new Promise((resolve, reject) => {
    offscreen.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

/**
 * Generates an SVG string representation of active page nodes and edges.
 */
export function exportPageToSVG(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  theme: 'light' | 'dark',
  transparent = false
): string {
  const bounds = getAllNodesBounds(nodes) || { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  const pad = 40;
  const x = bounds.minX - pad;
  const y = bounds.minY - pad;
  const width = Math.max(100, bounds.maxX - bounds.minX + pad * 2);
  const height = Math.max(100, bounds.maxY - bounds.minY + pad * 2);

  const bgColor = theme === 'dark' ? '#0B0E14' : '#F7F7F5';

  let svgElements = '';

  // Background
  if (!transparent) {
    svgElements += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${bgColor}" />\n`;
  }

  // Edges
  for (const edge of Object.values(edges)) {
    const fromNode = nodes[edge.fromNode];
    const toNode = nodes[edge.toNode];
    if (!fromNode || !toNode) continue;

    const fromPt = getAnchorPoint(fromNode, edge.fromSide || 'right');
    const toPt = getAnchorPoint(toNode, edge.toSide || 'left');
    const color = resolveColor(edge.color, theme);
    const strokeWidth = edge._ext?.strokeWidth || 2;

    svgElements += `<line x1="${fromPt.x}" y1="${fromPt.y}" x2="${toPt.x}" y2="${toPt.y}" stroke="${color}" stroke-width="${strokeWidth}" />\n`;

    if (edge.label) {
      const midX = (fromPt.x + toPt.x) / 2;
      const midY = (fromPt.y + toPt.y) / 2;
      svgElements += `<text x="${midX}" y="${midY}" fill="${color}" font-size="12" text-anchor="middle" dominant-baseline="middle">${edge.label}</text>\n`;
    }
  }

  // Nodes
  for (const node of Object.values(nodes)) {
    const color = resolveColor(node.color || node._ext?.strokeColor, theme);
    const strokeWidth = node._ext?.strokeWidth || 2;
    const shape = node._ext?.shape || 'rectangle';

    if (node._ext?.freehandPoints && node._ext.freehandPoints.length > 0) {
      const pts = node._ext.freehandPoints.map((p) => `${p[0]},${p[1]}`).join(' ');
      svgElements += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${strokeWidth * 2}" stroke-linecap="round" stroke-linejoin="round" />\n`;
      continue;
    }

    if (shape === 'rectangle') {
      svgElements += `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" rx="4" />\n`;
    } else if (shape === 'ellipse') {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      svgElements += `<ellipse cx="${cx}" cy="${cy}" rx="${node.width / 2}" ry="${node.height / 2}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
    } else if (shape === 'diamond') {
      const p1 = `${node.x + node.width / 2},${node.y}`;
      const p2 = `${node.x + node.width},${node.y + node.height / 2}`;
      const p3 = `${node.x + node.width / 2},${node.y + node.height}`;
      const p4 = `${node.x},${node.y + node.height / 2}`;
      svgElements += `<polygon points="${p1} ${p2} ${p3} ${p4}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" />\n`;
    }

    if (node.text) {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      svgElements += `<text x="${cx}" y="${cy}" fill="${color}" font-size="14" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${node.text}</text>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">
${svgElements}
</svg>`;
}

