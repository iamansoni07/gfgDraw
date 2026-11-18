import { CanvasNode, CanvasEdge } from '../types/canvas';
import { renderNode, renderEdge, drawGrid } from './renderer';
import { downloadFile } from './export';

interface FrameSlide {
  frame: CanvasNode;
  title: string;
}

/**
 * Encodes a string into ASCII bytes.
 */
function asciiBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Combines multiple Uint8Array buffers into a single buffer.
 */
function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * Builds a valid, standard PDF 1.4 binary file with embedded JPEG slides.
 */
export function buildPdfFromImages(
  images: { jpegBytes: Uint8Array; width: number; height: number }[]
): Uint8Array {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0]; // Object 0 is null

  let byteOffset = 0;

  function write(chunk: Uint8Array | string) {
    const b = typeof chunk === 'string' ? asciiBytes(chunk) : chunk;
    parts.push(b);
    byteOffset += b.length;
  }

  // Header
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageCount = images.length;
  // Object IDs:
  // 1: Catalog
  // 2: Pages
  // Per image (3 objects): Page, Content Stream, Image XObject
  const catalogObjId = 1;
  const pagesObjId = 2;

  // Obj 1: Catalog
  offsets[catalogObjId] = byteOffset;
  write(`${catalogObjId} 0 obj\n<< /Type /Catalog /Pages ${pagesObjId} 0 R >>\nendobj\n`);

  // Obj 2: Pages
  const pageObjIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageObjIds.push(3 + i * 3);
  }

  offsets[pagesObjId] = byteOffset;
  const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  write(`${pagesObjId} 0 obj\n<< /Type /Pages /Count ${pageCount} /Kids [${kidsStr}] >>\nendobj\n`);

  // Per slide: Page, Content Stream, Image XObject
  for (let i = 0; i < pageCount; i++) {
    const img = images[i];
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imgId = pageId + 2;

    // Standard 16:9 landscape PDF points (842 x 595 A4 landscape or scaled to image ratio)
    const ptWidth = 842;
    const ptHeight = 595;

    // Page object
    offsets[pageId] = byteOffset;
    write(
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> >>\nendobj\n`
    );

    // Content stream
    const contentStream = `q ${ptWidth} 0 0 ${ptHeight} 0 0 cm /Im${i} Do Q\n`;
    offsets[contentId] = byteOffset;
    write(
      `${contentId} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
    );

    // Image XObject
    offsets[imgId] = byteOffset;
    const imgHeader = `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpegBytes.length} >>\nstream\n`;
    write(imgHeader);
    write(img.jpegBytes);
    write('\nendstream\nendobj\n');
  }

  // Cross Reference Table
  const xrefOffset = byteOffset;
  const totalObjects = 3 + pageCount * 3;
  write(`xref\n0 ${totalObjects}\n`);
  write('0000000000 65535 f \n');
  for (let i = 1; i < totalObjects; i++) {
    const off = offsets[i] || 0;
    const offStr = off.toString().padStart(10, '0');
    write(`${offStr} 00000 n \n`);
  }

  // Trailer
  write(`trailer\n<< /Size ${totalObjects} /Root ${catalogObjId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return concatBuffers(parts);
}

/**
 * Renders a specific Frame onto an offscreen canvas and converts it to JPEG bytes.
 */
async function renderFrameToJpeg(
  frame: CanvasNode,
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  theme: 'light' | 'dark'
): Promise<{ jpegBytes: Uint8Array; width: number; height: number }> {
  const canvasW = 1920;
  const canvasH = 1080;

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get offscreen 2d context');

  // Background
  ctx.fillStyle = theme === 'dark' ? '#0B0E14' : '#F7F7F5';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Compute camera transform so frame fits nicely with 40px margin
  const margin = 40;
  const targetW = canvasW - margin * 2;
  const targetH = canvasH - margin * 2;
  const scale = Math.min(targetW / frame.width, targetH / frame.height);

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const frameCenterX = frame.x + frame.width / 2;
  const frameCenterY = frame.y + frame.height / 2;

  const camera = {
    x: cx - frameCenterX * scale,
    y: cy - frameCenterY * scale,
    zoom: scale,
  };

  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  const renderCtx = {
    ctx,
    camera,
    theme,
    globalRenderMode: 'precision' as const,
    selectedIds: new Set<string>(),
    hoveredAnchor: null,
    laserPoints: [],
    remoteUsers: [],
    currentPageId: 'pdf',
    marqueeBox: null,
    dpr: 1,
  };

  // Render edges
  for (const edge of Object.values(edges)) {
    renderEdge(edge, nodes, null, renderCtx);
  }

  // Render nodes within or intersecting the frame (excluding the outer frame itself for clean slides)
  for (const node of Object.values(nodes)) {
    if (node.id === frame.id) continue;
    // Check if node is inside frame bounds
    const isInside =
      node.x + node.width > frame.x &&
      node.x < frame.x + frame.width &&
      node.y + node.height > frame.y &&
      node.y < frame.y + frame.height;

    if (isInside) {
      renderNode(node, null, renderCtx);
    }
  }

  ctx.restore();

  // Convert canvas to JPEG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    offscreen.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.95
    );
  });

  const arrayBuffer = await blob.arrayBuffer();
  return {
    jpegBytes: new Uint8Array(arrayBuffer),
    width: canvasW,
    height: canvasH,
  };
}

/**
 * Collects all frames on the active page, sorts them in presentation order,
 * and downloads a multipage PDF presentation.
 */
export async function exportFramesToPdf(
  nodes: Record<string, CanvasNode>,
  edges: Record<string, CanvasEdge>,
  theme: 'light' | 'dark',
  filename = 'presentation-slides'
): Promise<void> {
  const frames = Object.values(nodes).filter((n) => n.type === 'frame' || n._ext?.shape === 'frame');

  if (frames.length === 0) {
    alert('No frames found on this page. Use the Frame tool (F) to create presentation slides.');
    return;
  }

  // Sort frames by order or top-to-bottom, left-to-right
  frames.sort((a, b) => {
    const orderA = a._ext?.frameOrder ?? a.y * 10000 + a.x;
    const orderB = b._ext?.frameOrder ?? b.y * 10000 + b.x;
    return orderA - orderB;
  });

  const slideImages: { jpegBytes: Uint8Array; width: number; height: number }[] = [];

  for (const frame of frames) {
    const slide = await renderFrameToJpeg(frame, nodes, edges, theme);
    slideImages.push(slide);
  }

  const pdfBytes = buildPdfFromImages(slideImages);
  const pdfBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  downloadFile(pdfBlob, `${filename}.pdf`, 'application/pdf');
}

