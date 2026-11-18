import * as Y from 'yjs';
import { generateHexId } from '../engine/camera';

export interface BoardVersion {
  id: string;
  roomId: string;
  name: string;
  timestamp: number;
  nodeCount: number;
  edgeCount: number;
  isAutoSnapshot: boolean;
  data: string; // Base64 of Y.encodeStateAsUpdate
}

const DB_NAME = 'gfg_draw_history_db';
const STORE_NAME = 'versions';

function openHistoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not available'));
    }
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('roomId', 'roomId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class HistoryStore {
  /**
   * Captures and persists a binary snapshot of the Y.Doc.
   */
  public static async saveSnapshot(
    roomId: string,
    doc: Y.Doc,
    name?: string,
    isAutoSnapshot = false
  ): Promise<BoardVersion> {
    const updateBytes = Y.encodeStateAsUpdate(doc);
    const base64Data = uint8ArrayToBase64(updateBytes);

    // Compute element counts
    let nodeCount = 0;
    let edgeCount = 0;
    const pagesMap = doc.getMap('pages');
    pagesMap.forEach((pageYMap: any) => {
      const nodesMap = pageYMap.get('nodes');
      const edgesMap = pageYMap.get('edges');
      if (nodesMap) nodeCount += nodesMap.size;
      if (edgesMap) edgeCount += edgesMap.size;
    });

    const version: BoardVersion = {
      id: generateHexId(),
      roomId,
      name: name || (isAutoSnapshot ? `Auto Snapshot ${new Date().toLocaleTimeString()}` : `Manual Snapshot`),
      timestamp: Date.now(),
      nodeCount,
      edgeCount,
      isAutoSnapshot,
      data: base64Data,
    };

    try {
      const db = await openHistoryDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(version);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to save version to IndexedDB', err);
    }

    // Also push to server if connected
    const serverUrl = (import.meta as any).env?.VITE_SERVER_URL;
    if (serverUrl) {
      try {
        await fetch(`${serverUrl}/api/boards/${roomId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(version),
        });
      } catch {
        // Fallback silently to local
      }
    }

    return version;
  }

  /**
   * Retrieves all snapshots for a given room, sorted newest first.
   */
  public static async listSnapshots(roomId: string): Promise<BoardVersion[]> {
    let localVersions: BoardVersion[] = [];

    try {
      const db = await openHistoryDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('roomId');
      const request = index.getAll(roomId);

      localVersions = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result as BoardVersion[]);
        request.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to list versions from IndexedDB', err);
    }

    // Sort newest first
    localVersions.sort((a, b) => b.timestamp - a.timestamp);
    return localVersions;
  }

  /**
   * Restores a version into the live active Y.Doc using a transaction.
   */
  public static restoreSnapshot(doc: Y.Doc, version: BoardVersion): void {
    const updateBytes = base64ToUint8Array(version.data);
    Y.applyUpdate(doc, updateBytes);
  }

  /**
   * Branches a snapshot as an entirely new board.
   */
  public static async branchAsNewBoard(
    version: BoardVersion,
    newBoardName?: string
  ): Promise<string> {
    const newRoomId = generateHexId();
    const branchedVersion: BoardVersion = {
      ...version,
      id: generateHexId(),
      roomId: newRoomId,
      name: newBoardName || `Branch of ${version.name}`,
      timestamp: Date.now(),
    };

    try {
      const db = await openHistoryDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(branchedVersion);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to save branched version', err);
    }

    return newRoomId;
  }

  /**
   * Deletes a specific snapshot by ID.
   */
  public static async deleteSnapshot(id: string): Promise<void> {
    try {
      const db = await openHistoryDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });
    } catch (err) {
      console.warn('Failed to delete version from IndexedDB', err);
    }
  }
}

