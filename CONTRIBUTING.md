# Contributing to GFG Draw

Thank you for your interest in contributing to **GFG Draw**!

## Core Architecture Principles

1. **Zero External Drawing Libraries:**
   All canvas rendering must use native HTML5 Canvas 2D (`CanvasRenderingContext2D`) and `Path2D` primitives. Do not import third-party drawing libraries (e.g., roughjs, perfect-freehand, konva, fabric).

2. **CRDT Single Source of Truth:**
   All collaborative board mutations must route through `Yjs` (`Y.Doc` and `Y.Map`). Never maintain local diverging canvas state that bypasses document synchronization.

3. **Spatial Efficiency:**
   Hit-testing, obstacle queries, viewport culling, and marquee bounding checks must utilize `RBush` (`SpatialIndex`) with $O(\log n)$ performance.

4. **Security & Sanitization:**
   All user-supplied text in Markdown, SVG exports, and HTML node overlays must be sanitized using `sanitizeHtml` / `sanitizeSvgText` / `sanitizeMarkdownSpec` before rendering or exporting.

---

## Workspace Setup

The project uses npm workspaces:
- `frontend/`: The core Vite + React + Tailwind drafting studio application.
- `server/`: Lightweight SQLite persistence server with live WebSocket sync.
- `mcp-server/`: Model Context Protocol server for AI assistants.
- `packages/canvas-sdk/`: Standalone embeddable React SDK.

### Build and Verification Commands

```bash
# Typecheck and build all packages
npm run build

# Run unit test suite
npm run test:unit

# Run Playwright E2E browser tests
npm run test:e2e
```

