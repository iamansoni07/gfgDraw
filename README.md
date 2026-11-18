# GFG Draw — Precision Drafting Studio

GFG Draw is an infinite whiteboard and precision architectural drafting studio engineered with pure HTML5 Canvas 2D / Path2D rendering, zero third-party drawing libraries, real-time multiplayer CRDT sync via Yjs, and native Diagram-as-Code workflows.

---

## Key Highlights

- **Pure Canvas 2D / Path2D Vector Engine:** Zero external canvas dependencies (no roughjs, no perfect-freehand). Custom anti-aliasing, directional elevation shading, velocity-tapered ink curves, and CAD drafting styling.
- **Three Signature Visual Modes:**
  - `precision`: Clean geometric vector strokes, elevation drops, sharp typography.
  - `blueprint`: Technical CAD drafting aesthetics with inner hairline offsets and corner cross-ticks.
  - `ink`: Velocity-weighted quadratic Bezier freehand ink with natural taper.
- **Smart Orthogonal Elbow Connectors:** Computes 90-degree orthogonal routes with 24px stubs, obstacle avoidance around intermediate nodes via R-tree spatial indexing, and draggable middle segments.
- **Magnetic Alignment & Distance Telemetry:** Snap guides with auto-alignment against adjacent node centers and edges; Alt-key CAD distance telemetry measurement.
- **Bi-Directional Mermaid Diagram-as-Code Engine:** Two-way synchronization between Mermaid flowchart syntax and interactive canvas elements.
- **Dockable Markdown Split-Pane:** Side-by-side technical document mode with clickable bi-directional `@node:<id>` navigation chips.
- **JSON Canvas 1.0 Specification:** Native multi-page documents fully compatible with Obsidian JSON Canvas format.
- **Zero-Knowledge End-to-End Encryption (E2EE):** Client-side 256-bit AES-GCM encryption with cryptographic keys stored strictly in the URL hash fragment.
- **Multi-Board Workspace Dashboard:** Categorized board management with folders, tags, search, and pre-built domain templates (System Design, DSA Trees & Graphs, Cloud Architectures).
- **Self-Hosted Persistence Server:** Lightweight Node.js server powered by SQLite and WebSocket sync for live rooms and snapshot history.
- **Model Context Protocol (MCP) Server:** Native MCP integration enabling AI assistants to inspect, modify, and generate board elements.
- **Standalone React SDK (`@gfg-draw/canvas-sdk`):** Embed the canvas directly in any React web application.

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │                     GFG Draw Studio UI                     │
 │  StudioHeader │ Vertical Tool Rail │ Telemetry Bar │ Drawers│
 └──────────────┬───────────────────────────────┬──────────────┘
                │                               │
 ┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
 │  Native Path2D Engine       │ │  RBush Spatial Index (R-Tree)│
 │  - Precision Vector Paths   │ │  - O(log n) Viewport Culling│
 │  - Blueprint Technical CAD  │ │  - Hit-Testing & Obstacles  │
 │  - Smooth Catmull-Rom Ink   │ │  - Multi-Selection Queries  │
 └──────────────┬──────────────┘ └──────────────┬──────────────┘
                │                               │
 ┌──────────────▼───────────────────────────────▼──────────────┐
 │             Yjs CRDT Document & State Engine                │
 │  - Pages (Y.Map<PageData>)                                  │
 │  - IndexedDB Persistence (Local-first, zero signup)        │
 │  - Live WebSocket Awareness & Remote Cursors                │
 └──────────────┬───────────────────────────────┬──────────────┘
                │                               │
 ┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
 │ Self-Hosted SQLite Backend  │ │ Model Context Protocol (MCP)│
 │ ws relay + update persistence│ │ AI Board Automation Tools  │
 └─────────────────────────────┘ └─────────────────────────────┘
```

---

## Quickstart (Development)

### Prerequisites
- Node.js 22+
- npm 10+

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/geeksforgeeks/gfgDraw.git
cd gfgDraw

# Install dependencies across workspaces
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Docker Deployment

Deploy the frontend and persistent backend with a single command:

```bash
docker compose up -d --build
```

The app will be accessible at `http://localhost:3000`.

---

## Running Automated Tests

```bash
# Run unit test suite (Vitest: Spatial Index, Routers, Mermaid Sync, E2EE)
npm run test:unit

# Run headless browser end-to-end tests (Playwright)
npm run test:e2e
```

---

## Standalone React Canvas SDK

Install the SDK package in your application:

```bash
npm install @gfg-draw/canvas-sdk
```

### Basic Embedding Example

```tsx
import React from 'react';
import { GfgDrawCanvas } from '@gfg-draw/canvas-sdk';

export function EmbeddedWhiteboard() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GfgDrawCanvas
        roomId="project-architecture"
        theme="dark"
        readOnly={false}
      />
    </div>
  );
}
```

### Headless State Hook Example

```tsx
import { useGfgDrawStore } from '@gfg-draw/canvas-sdk';

export function DiagramController() {
  const { nodes, addNode, undo, redo, canUndo } = useGfgDrawStore({
    roomId: 'architecture-board',
  });

  const handleCreateNode = () => {
    addNode({
      id: 'node-1',
      type: 'shape',
      x: 100,
      y: 100,
      width: 160,
      height: 90,
      text: 'API Gateway',
    });
  };

  return (
    <div>
      <button onClick={handleCreateNode}>Add Node</button>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
    </div>
  );
}
```

---

## Model Context Protocol (MCP) Server

Connect GFG Draw to Claude Desktop, Cursor, or Antigravity via MCP:

```json
{
  "mcpServers": {
    "gfg-draw": {
      "command": "node",
      "args": ["/path/to/gfgDraw/mcp-server/dist/index.js"]
    }
  }
}
```

### Supported MCP Tools:
- `get_board_nodes`: Query all nodes and positions on a board.
- `create_diagram`: Automatically generate system design and DSA diagrams on canvas.
- `export_board`: Export high-resolution PNG or SVG representations of active pages.
- `apply_mermaid`: Apply Mermaid flowchart syntax directly to a live room.

---

## Keyboard Shortcuts Reference

| Shortcut | Action |
| :--- | :--- |
| `V` / `1` | Select & Transform Tool |
| `R` / `2` | Rectangle Shape Tool |
| `D` / `3` | Diamond Decision Tool |
| `O` / `4` | Ellipse / Circle Tool |
| `F` / `5` | Frame Container Tool |
| `A` / `6` | Arrow Connector Tool |
| `L` / `7` | Line Connector Tool |
| `P` / `8` | Freehand Pen Tool |
| `T` / `9` | Text Annotation Tool |
| `X` / `0` | Laser Presentation Pointer |
| `E` | Eraser Tool |
| `Ctrl` + `Z` | Undo Mutation |
| `Ctrl` + `Shift` + `Z` | Redo Mutation |
| `Ctrl` + `K` | Studio Command Palette |
| `Ctrl` + `D` | Toggle Markdown Document Split View |
| `Space` + Drag | Pan Canvas Viewport |
| `Mouse Wheel` | Zoom In / Out at Cursor |
| `Alt` + Hover | CAD Distance Measurement |
