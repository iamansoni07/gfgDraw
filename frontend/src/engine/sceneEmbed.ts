import { JSONCanvasDoc } from '../types/canvas';

const PNG_KEYWORD = 'gfgdraw-scene';

// Standard CRC32 table for PNG chunk generation
let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  crcTable = table;
  return table;
}

function calculateCrc32(buf: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Encodes a JSONCanvasDoc into a compressed Base64 string.
 */
export function encodeScenePayload(doc: JSONCanvasDoc): string {
  const jsonStr = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a compressed Base64 string back into a JSONCanvasDoc.
 */
export function decodeScenePayload(base64Str: string): JSONCanvasDoc | null {
  try {
    const binary = atob(base64Str.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);
    if (parsed && (Array.isArray(parsed.nodes) || Array.isArray(parsed.edges))) {
      return parsed as JSONCanvasDoc;
    }
    return null;
  } catch (err) {
    console.warn('Failed to decode scene payload', err);
    return null;
  }
}

/**
 * Embeds JSON Canvas scene metadata inside a standard PNG tEXt chunk.
 * Returns a new Blob containing the smart PNG.
 */
export async function embedSceneInPng(
  pngBlob: Blob,
  doc: JSONCanvasDoc
): Promise<Blob> {
  const arrayBuffer = await pngBlob.arrayBuffer();
  const sourceBytes = new Uint8Array(arrayBuffer);

  // Validate PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    sourceBytes.length > 8 &&
    sourceBytes[0] === 0x89 &&
    sourceBytes[1] === 0x50 &&
    sourceBytes[2] === 0x4e &&
    sourceBytes[3] === 0x47;

  if (!isPng) return pngBlob;

  const payload = encodeScenePayload(doc);
  const keywordBytes = new TextEncoder().encode(PNG_KEYWORD);
  const textBytes = new TextEncoder().encode(payload);

  // tEXt chunk data: keyword + 0x00 + text
  const chunkData = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  chunkData.set(keywordBytes, 0);
  chunkData[keywordBytes.length] = 0; // null separator
  chunkData.set(textBytes, keywordBytes.length + 1);

  // Chunk header (4 bytes 'tEXt') + Data for CRC computation
  const typeBytes = new TextEncoder().encode('tEXt');
  const typeAndData = new Uint8Array(4 + chunkData.length);
  typeAndData.set(typeBytes, 0);
  typeAndData.set(chunkData, 4);

  const crc = calculateCrc32(typeAndData);

  // Total chunk size: 4 (length) + 4 (type) + chunkData.length + 4 (crc)
  const fullChunk = new Uint8Array(12 + chunkData.length);
  const view = new DataView(fullChunk.buffer);
  view.setUint32(0, chunkData.length, false); // big-endian length
  fullChunk.set(typeBytes, 4);
  fullChunk.set(chunkData, 8);
  view.setUint32(8 + chunkData.length, crc, false);

  // Insert before IEND chunk (the last 12 bytes of a valid PNG)
  const iendPos = sourceBytes.length - 12;
  const result = new Uint8Array(sourceBytes.length + fullChunk.length);

  result.set(sourceBytes.subarray(0, iendPos), 0);
  result.set(fullChunk, iendPos);
  result.set(sourceBytes.subarray(iendPos), iendPos + fullChunk.length);

  return new Blob([result], { type: 'image/png' });
}

/**
 * Extracts embedded JSON Canvas scene data from a PNG ArrayBuffer.
 */
export function extractSceneFromPng(buffer: ArrayBuffer): JSONCanvasDoc | null {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Check PNG signature
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  let offset = 8;
  const decoder = new TextDecoder();

  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));

    if (type === 'tEXt') {
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      // Find null separator
      let nullIdx = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === 0) {
          nullIdx = i;
          break;
        }
      }
      if (nullIdx !== -1) {
        const keyword = decoder.decode(data.subarray(0, nullIdx));
        if (keyword === PNG_KEYWORD) {
          const text = decoder.decode(data.subarray(nullIdx + 1));
          return decodeScenePayload(text);
        }
      }
    }

    if (type === 'IEND') break;
    offset += 12 + length;
  }

  return null;
}

/**
 * Embeds JSON Canvas scene metadata inside an SVG <metadata> tag.
 */
export function embedSceneInSvg(svgString: string, doc: JSONCanvasDoc): string {
  const payload = encodeScenePayload(doc);
  const metadataTag = `\n  <metadata id="gfgdraw-scene"><![CDATA[${payload}]]></metadata>\n`;

  const closingIndex = svgString.lastIndexOf('</svg>');
  if (closingIndex !== -1) {
    return (
      svgString.slice(0, closingIndex) +
      metadataTag +
      svgString.slice(closingIndex)
    );
  }
  return svgString + metadataTag;
}

/**
 * Extracts embedded JSON Canvas scene data from an SVG string.
 */
export function extractSceneFromSvg(svgString: string): JSONCanvasDoc | null {
  const match = svgString.match(
    /<metadata\s+id=["']gfgdraw-scene["']>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/metadata>/i
  );
  if (match && match[1]) {
    return decodeScenePayload(match[1].trim());
  }
  return null;
}

/**
 * Universal file extractor for drag-and-drop or file upload:
 * Handles .canvas, .json, .png (with embedded metadata), and .svg (with metadata).
 */
export async function extractSceneFromFile(
  file: File
): Promise<JSONCanvasDoc | null> {
  const name = file.name.toLowerCase();

  // 1. JSON Canvas / JSON
  if (name.endsWith('.canvas') || name.endsWith('.json')) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.nodes || parsed.edges)) {
        return {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
        };
      }
    } catch {
      return null;
    }
  }

  // 2. PNG
  if (name.endsWith('.png') || file.type === 'image/png') {
    const buffer = await file.arrayBuffer();
    return extractSceneFromPng(buffer);
  }

  // 3. SVG
  if (name.endsWith('.svg') || file.type === 'image/svg+xml') {
    const text = await file.text();
    return extractSceneFromSvg(text);
  }

  return null;
}

