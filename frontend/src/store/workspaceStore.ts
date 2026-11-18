import { generateHexId } from '../engine/camera';
import { STARTER_TEMPLATES } from '../data/templates';
import { JSONCanvasDoc } from '../types/canvas';

export interface BoardMetadata {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  isStarred: boolean;
  createdAt: number;
  updatedAt: number;
  nodeCount?: number;
  edgeCount?: number;
}

const DB_NAME = 'gfg_draw_workspace_db';
const STORE_NAME = 'boards';

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('folder', 'folder', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class WorkspaceStore {
  private static getServerUrl(): string | null {
    return (import.meta as any).env?.VITE_SERVER_URL || null;
  }

  /**
   * Lists all boards (merges local IndexedDB with self-hosted server if online).
   */
  public static async listBoards(): Promise<BoardMetadata[]> {
    let localBoards: BoardMetadata[] = [];

    try {
      const db = await openWorkspaceDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();

      localBoards = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as BoardMetadata[]);
        request.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to list local boards', err);
    }

    const serverUrl = this.getServerUrl();
    if (serverUrl) {
      try {
        const res = await fetch(`${serverUrl}/api/boards`);
        if (res.ok) {
          const serverBoards = await res.json();
          // Merge server boards
          return serverBoards;
        }
      } catch {
        // Fall back to local
      }
    }

    // Default seed board if completely empty
    if (localBoards.length === 0) {
      const defaultBoard = await this.createBoard('Default Board', 'General');
      return [defaultBoard];
    }

    return localBoards.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Creates a new board, optionally from a starter template.
   */
  public static async createBoard(
    title: string,
    folder: string = 'General',
    templateId?: string
  ): Promise<BoardMetadata> {
    const id = generateHexId();
    const now = Date.now();

    let nodeCount = 0;
    let edgeCount = 0;
    let initialDoc: JSONCanvasDoc | null = null;

    if (templateId) {
      const template = STARTER_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        initialDoc = template.doc;
        nodeCount = template.doc.nodes.length;
        edgeCount = template.doc.edges.length;
      }
    }

    const board: BoardMetadata = {
      id,
      title: title || 'Untitled Board',
      folder: folder || 'General',
      tags: [],
      isStarred: false,
      createdAt: now,
      updatedAt: now,
      nodeCount,
      edgeCount,
    };

    // Save to local IndexedDB
    try {
      const db = await openWorkspaceDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(board);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to save board locally', err);
    }

    // If template has initial nodes, write to localStorage / initial buffer for that board
    if (initialDoc) {
      try {
        localStorage.setItem(`gfg_init_doc_${id}`, JSON.stringify(initialDoc));
      } catch (e) {
        console.warn('Failed to cache template doc', e);
      }
    }

    // Save to server if connected
    const serverUrl = this.getServerUrl();
    if (serverUrl) {
      try {
        await fetch(`${serverUrl}/api/boards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...board, initialDoc }),
        });
      } catch {
        // Continue in local mode
      }
    }

    return board;
  }

  /**
   * Updates board metadata (title, folder, tags, isStarred).
   */
  public static async updateBoard(
    id: string,
    updates: Partial<BoardMetadata>
  ): Promise<void> {
    try {
      const db = await openWorkspaceDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      await new Promise((resolve, reject) => {
        getReq.onsuccess = () => {
          const existing = getReq.result as BoardMetadata;
          if (existing) {
            const updated = {
              ...existing,
              ...updates,
              updatedAt: Date.now(),
            };
            store.put(updated);
          }
          resolve(null);
        };
        getReq.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to update board', err);
    }

    const serverUrl = this.getServerUrl();
    if (serverUrl) {
      try {
        await fetch(`${serverUrl}/api/boards/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Deletes a board by ID.
   */
  public static async deleteBoard(id: string): Promise<void> {
    try {
      const db = await openWorkspaceDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to delete board locally', err);
    }

    const serverUrl = this.getServerUrl();
    if (serverUrl) {
      try {
        await fetch(`${serverUrl}/api/boards/${id}`, { method: 'DELETE' });
      } catch {
        // Fallback
      }
    }
  }

  /**
   * Duplicates an existing board.
   */
  public static async duplicateBoard(id: string): Promise<BoardMetadata> {
    const list = await this.listBoards();
    const source = list.find((b) => b.id === id);
    const newTitle = source ? `${source.title} (Copy)` : 'Duplicated Board';
    const folder = source?.folder || 'General';

    return await this.createBoard(newTitle, folder);
  }
}

