import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { db, initDatabase } from './db.js';

initDatabase();

const app = new Hono();
app.use('*', cors());

// Health Check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', uptime: process.uptime(), time: Date.now() });
});

// List Boards
app.get('/api/boards', (c) => {
  const rows = db.prepare('SELECT * FROM boards ORDER BY updated_at DESC').all() as any[];
  const boards = rows.map((r) => ({
    id: r.id,
    title: r.title,
    folder: r.folder,
    tags: JSON.parse(r.tags || '[]'),
    isStarred: Boolean(r.is_starred),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    nodeCount: r.node_count,
    edgeCount: r.edge_count,
  }));
  return c.json(boards);
});

// Create Board
app.post('/api/boards', async (c) => {
  const body = await c.req.json();
  const id = body.id || Math.random().toString(36).substring(2, 10);
  const title = body.title || 'Untitled Board';
  const folder = body.folder || 'General';
  const tags = JSON.stringify(body.tags || []);
  const isStarred = body.isStarred ? 1 : 0;
  const now = Date.now();
  const nodeCount = body.nodeCount || 0;
  const edgeCount = body.edgeCount || 0;

  db.prepare(`
    INSERT INTO boards (id, title, folder, tags, is_starred, created_at, updated_at, node_count, edge_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, folder, tags, isStarred, now, now, nodeCount, edgeCount);

  // If initialDoc was provided (e.g. from template), encode and store as initial Yjs update
  if (body.initialDoc) {
    try {
      const doc = new Y.Doc();
      const pagesMap = doc.getMap('pages');
      const pageId = 'page-1';
      const pageYMap = new Y.Map();
      pageYMap.set('id', pageId);
      pageYMap.set('name', 'Page 1');

      const nodesMap = new Y.Map();
      const edgesMap = new Y.Map();

      if (body.initialDoc.nodes && Array.isArray(body.initialDoc.nodes)) {
        for (const n of body.initialDoc.nodes) nodesMap.set(n.id, n);
      }
      if (body.initialDoc.edges && Array.isArray(body.initialDoc.edges)) {
        for (const e of body.initialDoc.edges) edgesMap.set(e.id, e);
      }

      pageYMap.set('nodes', nodesMap);
      pageYMap.set('edges', edgesMap);
      pagesMap.set(pageId, pageYMap);

      const updateBytes = Y.encodeStateAsUpdate(doc);
      db.prepare(`
        INSERT INTO board_updates (room_id, update_data, created_at)
        VALUES (?, ?, ?)
      `).run(id, Buffer.from(updateBytes), now);
    } catch (err) {
      console.warn('Failed to seed initial template update', err);
    }
  }

  return c.json({ id, title, folder, isStarred: Boolean(isStarred), createdAt: now, updatedAt: now }, 201);
});

// Get Board Details
app.get('/api/boards/:id', (c) => {
  const id = c.req.param('id');
  const row = db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as any;
  if (!row) return c.json({ error: 'Board not found' }, 404);

  return c.json({
    id: row.id,
    title: row.title,
    folder: row.folder,
    tags: JSON.parse(row.tags || '[]'),
    isStarred: Boolean(row.is_starred),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nodeCount: row.node_count,
    edgeCount: row.edge_count,
  });
});

// Update Board Metadata
app.put('/api/boards/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const row = db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as any;
  if (!row) return c.json({ error: 'Board not found' }, 404);

  const title = body.title !== undefined ? body.title : row.title;
  const folder = body.folder !== undefined ? body.folder : row.folder;
  const tags = body.tags !== undefined ? JSON.stringify(body.tags) : row.tags;
  const isStarred = body.isStarred !== undefined ? (body.isStarred ? 1 : 0) : row.is_starred;
  const now = Date.now();

  db.prepare(`
    UPDATE boards
    SET title = ?, folder = ?, tags = ?, is_starred = ?, updated_at = ?
    WHERE id = ?
  `).run(title, folder, tags, isStarred, now, id);

  return c.json({ success: true, updatedAt: now });
});

// Delete Board
app.delete('/api/boards/:id', (c) => {
  const id = c.req.param('id');
  db.prepare('DELETE FROM boards WHERE id = ?').run(id);
  db.prepare('DELETE FROM board_updates WHERE room_id = ?').run(id);
  db.prepare('DELETE FROM board_versions WHERE room_id = ?').run(id);
  return c.json({ success: true });
});

// Version History Endpoints
app.get('/api/boards/:id/versions', (c) => {
  const roomId = c.req.param('id');
  const rows = db.prepare(
    'SELECT * FROM board_versions WHERE room_id = ? ORDER BY timestamp DESC'
  ).all(roomId) as any[];

  const versions = rows.map((r) => ({
    id: r.id,
    roomId: r.room_id,
    name: r.name,
    timestamp: r.timestamp,
    nodeCount: r.node_count,
    edgeCount: r.edge_count,
    isAutoSnapshot: Boolean(r.is_auto),
    data: r.data,
  }));
  return c.json(versions);
});

app.post('/api/boards/:id/versions', async (c) => {
  const roomId = c.req.param('id');
  const body = await c.req.json();
  const id = body.id || Math.random().toString(36).substring(2, 10);
  const name = body.name || 'Manual Snapshot';
  const timestamp = body.timestamp || Date.now();
  const nodeCount = body.nodeCount || 0;
  const edgeCount = body.edgeCount || 0;
  const isAuto = body.isAutoSnapshot ? 1 : 0;
  const data = body.data || '';

  db.prepare(`
    INSERT INTO board_versions (id, room_id, name, timestamp, node_count, edge_count, is_auto, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomId, name, timestamp, nodeCount, edgeCount, isAuto, data);

  return c.json({ id, roomId, name, timestamp }, 201);
});

// Static assets fallback (for docker container serving frontend)
const staticDirs = [
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'public'),
];

let publicDir: string | null = null;
for (const dir of staticDirs) {
  if (fs.existsSync(dir)) {
    publicDir = dir;
    break;
  }
}

// HTTP Server & WebSocket Server
const server = http.createServer(async (req, res) => {
  // Static file serving if public dir exists
  if (publicDir && req.method === 'GET' && !req.url?.startsWith('/api') && !req.url?.startsWith('/ws')) {
    let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : (req.url || 'index.html'));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(publicDir, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Handle Hono API requests
  const host = req.headers.host || 'localhost';
  const url = `http://${host}${req.url}`;
  const honoReq = new Request(url, {
    method: req.method,
    headers: req.headers as any,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? (req as any) : undefined,
    duplex: 'half',
  } as any);

  const honoRes = await app.fetch(honoReq);
  res.writeHead(honoRes.status, Object.fromEntries(honoRes.headers.entries()));

  if (honoRes.body) {
    const reader = honoRes.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      pump();
    };
    pump();
  } else {
    res.end();
  }
});

// WebSocket Server for Live Collaborative Yjs Rooms
const wss = new WebSocketServer({ server });
const roomSockets = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws, req) => {
  // Parse room name from URL query: e.g. /ws?room=xyz or ?room=gfg-whiteboard-xyz
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const rawRoom = urlObj.searchParams.get('room') || urlObj.pathname.replace(/^\/ws\/?/, '') || 'default-board';
  const room = rawRoom.replace(/^gfg-whiteboard-/, '');

  if (!roomSockets.has(room)) {
    roomSockets.set(room, new Set());
  }
  roomSockets.get(room)!.add(ws);

  // Send all stored SQLite binary updates to the newly connected client
  try {
    const updateRows = db.prepare(
      'SELECT update_data FROM board_updates WHERE room_id = ? ORDER BY id ASC'
    ).all(room) as { update_data: Buffer }[];

    if (updateRows.length > 0) {
      const updates = updateRows.map((r) => new Uint8Array(r.update_data));
      const merged = Y.mergeUpdates(updates);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(Buffer.from(merged));
      }
    }
  } catch (err) {
    console.warn('Error loading initial room updates from SQLite', err);
  }

  // Rate limiting & payload guard per connection
  const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB
  let msgCount = 0;
  let lastReset = Date.now();

  // Handle incoming binary updates from client
  ws.on('message', (message, isBinary) => {
    // 1. Rate limiter check: max 120 messages per second
    const now = Date.now();
    if (now - lastReset > 1000) {
      msgCount = 0;
      lastReset = now;
    }
    msgCount++;
    if (msgCount > 120) {
      console.warn(`[Security] Rate limit exceeded by socket in room ${room}`);
      return;
    }

    if (isBinary && Buffer.isBuffer(message)) {
      // 2. Payload size check
      if (message.length > MAX_PAYLOAD_BYTES) {
        console.warn(`[Security] Dropped oversized payload (${message.length} bytes) in room ${room}`);
        return;
      }

      // 3. Persist binary update chunk into SQLite
      try {
        db.prepare(`
          INSERT INTO board_updates (room_id, update_data, created_at)
          VALUES (?, ?, ?)
        `).run(room, message, Date.now());

        // Update board's updated_at timestamp
        db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(Date.now(), room);
      } catch (err) {
        console.warn('Failed to persist Yjs update to SQLite', err);
      }

      // 2. Broadcast update to other peers in the room
      const peers = roomSockets.get(room);
      if (peers) {
        peers.forEach((peer) => {
          if (peer !== ws && peer.readyState === WebSocket.OPEN) {
            peer.send(message);
          }
        });
      }
    }
  });

  ws.on('close', () => {
    const peers = roomSockets.get(room);
    if (peers) {
      peers.delete(ws);
      if (peers.size === 0) {
        roomSockets.delete(room);
      }
    }
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  GFG Draw Precision Drafting Studio — Server`);
  console.log(`  REST API & WebSockets live on http://localhost:${PORT}`);
  console.log(`  Database path: ${process.env.DATABASE_PATH || './data/gfgdraw.db'}`);
  console.log(`======================================================\n`);
});
