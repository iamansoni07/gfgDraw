/**
 * Security and Export Sanitization for GFG Draw:
 * Prevents XSS injection across user-authored Markdown specs, custom node HTML overlays,
 * and SVG XML metadata tags, with room payload bounds verification.
 */

const DANGEROUS_TAGS_REGEX = /<\s*(script|iframe|embed|object|base|link|meta)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|embed|object|base|link|meta)[\s\S]*?\/?>/gi;
const DANGEROUS_ATTRIBUTES_REGEX = /\s*(on\w+|javascript:|data:\s*text\/html|vbscript:)\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi;
const JAVASCRIPT_PROTOCOL_REGEX = /(javascript|vbscript|data):/gi;

/**
 * Sanitizes arbitrary HTML input (used in HTML overlay editors and markdown previews).
 */
export function sanitizeHtml(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(DANGEROUS_TAGS_REGEX, '')
    .replace(DANGEROUS_ATTRIBUTES_REGEX, '')
    .replace(/href\s*=\s*['"]\s*javascript:[^'"]*['"]/gi, 'href="#"');
}

/**
 * Escapes characters for safe inclusion within SVG XML nodes and <metadata> tags.
 */
export function sanitizeSvgText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sanitizes user-authored Markdown spec text before rendering.
 */
export function sanitizeMarkdownSpec(raw: string): string {
  if (!raw) return '';
  return sanitizeHtml(raw);
}

/**
 * Enforces maximum size bounds on incoming room update payloads.
 * Default limit: 10 Megabytes.
 */
export function validateRoomPayloadSize(
  byteLength: number,
  maxBytes = 10 * 1024 * 1024
): boolean {
  return byteLength > 0 && byteLength <= maxBytes;
}

