import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import {
  CanvasNode,
  CanvasEdge,
  PageData,
  JSONCanvasDoc,
  UserAwareness,
  Camera,
  BoundingBox,
} from '../types/canvas';
import { generateHexId } from '../engine/camera';

// Dynamic WebSocket resolution:
// In production without VITE_WS_URL, we run in pure Local-First mode (zero localhost connection errors).
export function resolveWsServerUrl(): string | null {
  const env = (import.meta as any)?.env;
  if (!env) return null;

  if (env.VITE_WS_URL) {
    return env.VITE_WS_URL;
  }

  if (env.VITE_SERVER_URL) {
    try {
      const serverUrl = new URL(env.VITE_SERVER_URL);
      const protocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${serverUrl.host}${serverUrl.pathname.replace(/\/$/, '')}/ws`;
    } catch {
      return env.VITE_SERVER_URL.replace(/^http/i, 'ws');
    }
  }

  // In production without explicit VITE_WS_URL, do not connect to remote or localhost WebSocket.
  if (env.PROD) {
    return null;
  }

  return null;
}

export function isLocalFirstMode(): boolean {
  return resolveWsServerUrl() === null;
}

export interface YjsStoreOptions {
  roomId: string;
  role?: 'edit' | 'view';
  userName?: string;
  userColor?: string;
}

export class YjsStore {
  public doc: Y.Doc;
  public indexeddbProvider: IndexeddbPersistence | null = null;
  public wsProvider: WebsocketProvider | null = null;
  public undoManager: Y.UndoManager | null = null;

  public isLocalFirst: boolean = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private localTabUsers: Map<string, UserAwareness> = new Map();

  public roomId: string;
  public role: 'edit' | 'view';
  public userId: string;
  public userName: string;
  public userColor: string;

  // Root Y.Map for pages
  private pagesMap: Y.Map<any>;

  private version: number = 0;

  private listeners: Set<() => void> = new Set();
  private awarenessListeners: Set<(users: UserAwareness[]) => void> = new Set();

  constructor(options: YjsStoreOptions) {
    this.roomId = options.roomId || 'default-board';
    this.role = options.role || 'edit';
    this.userId = generateHexId();
    this.userName = options.userName || `User-${this.userId.slice(0, 4)}`;
    this.userColor =
      options.userColor ||
      ['#2F9E44', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'][
        Math.floor(Math.random() * 6)
      ];

    this.doc = new Y.Doc();
    this.pagesMap = this.doc.getMap('pages');

    const wsUrl = resolveWsServerUrl();
    this.isLocalFirst = wsUrl === null;

    // Setup Local Persistence via IndexedDB
    if (typeof window !== 'undefined') {
      try {
        this.indexeddbProvider = new IndexeddbPersistence(
          `gfg-whiteboard-${this.roomId}`,
          this.doc
        );
      } catch (err) {
        console.warn('IndexedDB not supported or disabled', err);
      }

      // Setup same-device multi-tab synchronization via BroadcastChannel
      if (typeof window.BroadcastChannel !== 'undefined') {
        try {
          this.broadcastChannel = new BroadcastChannel(`gfg-sync-${this.roomId}`);
          this.broadcastChannel.onmessage = (event) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'doc-update' && data.senderId !== this.userId && data.update) {
              try {
                Y.applyUpdate(this.doc, new Uint8Array(data.update), 'broadcast-channel');
              } catch (err) {
                console.warn('Failed to apply BroadcastChannel doc update', err);
              }
            } else if (data.type === 'awareness' && data.senderId !== this.userId && data.user) {
              this.handleLocalTabAwareness(data.user);
            } else if (data.type === 'awareness-leave' && data.senderId !== this.userId) {
              this.localTabUsers.delete(data.senderId);
              this.notifyAwareness();
            }
          };
        } catch (err) {
          console.warn('BroadcastChannel initialization failed', err);
        }
      }

      // Setup Live Multiplayer WebSocket & Awareness (if remote server configured)
      if (wsUrl) {
        try {
          this.wsProvider = new WebsocketProvider(
            wsUrl,
            `gfg-whiteboard-${this.roomId}`,
            this.doc
          );

          this.setupAwareness();
        } catch (err) {
          console.warn('WebSocket provider connection failed', err);
        }
      }
    }

    // Subscribe to root doc updates
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      this.version++;
      this.notify();

      // Relay to other local tabs via BroadcastChannel if not originating from it
      if (origin !== 'broadcast-channel' && this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: 'doc-update',
            senderId: this.userId,
            update: Array.from(update),
          });
        } catch {
          // ignore
        }
      }
    });

    // Ensure at least one initial page exists once persistence syncs or on first load
    this.ensureDefaultPage();
  }

  public getVersion(): number {
    return this.version;
  }

  private handleLocalTabAwareness(user: UserAwareness): void {
    if (!user || user.id === this.userId) return;
    this.localTabUsers.set(user.id, user);
    this.notifyAwareness();
  }

  private notifyAwareness(): void {
    const now = Date.now();
    for (const [id, u] of this.localTabUsers.entries()) {
      if (now - (u.lastActive || 0) > 30000) {
        this.localTabUsers.delete(id);
      }
    }
    const users = Array.from(this.localTabUsers.values());
    for (const listener of this.awarenessListeners) {
      listener(users);
    }
  }

  private setupAwareness(): void {
    if (!this.wsProvider) return;

    const awareness = this.wsProvider.awareness;
    awareness.setLocalStateField('user', {
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      cursor: null,
      pageId: this.getFirstPageId(),
      isPresenter: false,
      lastActive: Date.now(),
    });

    awareness.on('change', () => {
      const states = awareness.getStates();
      const users: UserAwareness[] = [];
      states.forEach((state: any, clientID: number) => {
        if (state.user && state.user.id !== this.userId) {
          users.push(state.user as UserAwareness);
        }
      });

      for (const listener of this.awarenessListeners) {
        listener(users);
      }
    });
  }

  public updateLocalCursor(
    pos: { x: number; y: number } | null,
    pageId: string,
    camera?: Camera,
    isPresenter?: boolean
  ): void {
    const userData: UserAwareness = {
      id: this.userId,
      name: this.userName,
      color: this.userColor,
      cursor: pos,
      pageId,
      viewport: camera,
      isPresenter: !!isPresenter,
      lastActive: Date.now(),
    };

    if (this.wsProvider) {
      this.wsProvider.awareness.setLocalStateField('user', userData);
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'awareness',
          senderId: this.userId,
          user: userData,
        });
      } catch {
        // ignore
      }
    }
  }

  public ensureDefaultPage(): string {
    const pageKeys = Array.from(this.pagesMap.keys());
    if (pageKeys.length === 0) {
      const firstId = generateHexId();
      const pageYMap = new Y.Map();
      pageYMap.set('id', firstId);
      pageYMap.set('name', 'Page 1');
      pageYMap.set('createdAt', Date.now());
      pageYMap.set('nodes', new Y.Map());
      pageYMap.set('edges', new Y.Map());
      this.pagesMap.set(firstId, pageYMap);
      this.setupUndoManager(firstId);
      return firstId;
    }
    this.setupUndoManager(pageKeys[0]);
    return pageKeys[0];
  }

  public setupUndoManager(pageId: string): void {
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;

    const nodesMap = pageYMap.get('nodes');
    const edgesMap = pageYMap.get('edges');
    if (nodesMap && edgesMap) {
      this.undoManager = new Y.UndoManager([nodesMap, edgesMap], {
        trackedOrigins: new Set([null, this.userId]),
      });
    }
  }

  public getFirstPageId(): string {
    const pageKeys = Array.from(this.pagesMap.keys());
    return pageKeys[0] || 'page-1';
  }

  public getAllPages(): { id: string; name: string }[] {
    const pages: { id: string; name: string }[] = [];
    this.pagesMap.forEach((pageYMap: any, id: string) => {
      pages.push({
        id,
        name: pageYMap.get('name') || 'Untitled Page',
      });
    });
    return pages;
  }

  public createPage(name?: string): string {
    if (this.role === 'view') return '';
    const newId = generateHexId();
    const pageYMap = new Y.Map();
    pageYMap.set('id', newId);
    pageYMap.set('name', name || `Page ${this.pagesMap.size + 1}`);
    pageYMap.set('createdAt', Date.now());
    pageYMap.set('nodes', new Y.Map());
    pageYMap.set('edges', new Y.Map());
    this.pagesMap.set(newId, pageYMap);
    this.setupUndoManager(newId);
    this.notify();
    return newId;
  }

  public renamePage(pageId: string, newName: string): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (pageYMap) {
      pageYMap.set('name', newName);
      this.notify();
    }
  }

  public deletePage(pageId: string): string | null {
    if (this.role === 'view') return null;
    const pageKeys = Array.from(this.pagesMap.keys());
    if (pageKeys.length <= 1) {
      return null; // Cannot delete the only remaining page
    }

    this.pagesMap.delete(pageId);
    const remainingKeys = Array.from(this.pagesMap.keys());
    const nextActive = remainingKeys[0];
    this.setupUndoManager(nextActive);
    this.notify();
    return nextActive;
  }

  public getPageNodes(pageId: string): Record<string, CanvasNode> {
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return {};
    const nodesYMap = pageYMap.get('nodes');
    if (!nodesYMap) return {};
    return nodesYMap.toJSON();
  }

  public getPageEdges(pageId: string): Record<string, CanvasEdge> {
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return {};
    const edgesYMap = pageYMap.get('edges');
    if (!edgesYMap) return {};
    return edgesYMap.toJSON();
  }

  public getPageDocText(pageId: string): Y.Text {
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) {
      return this.doc.getText(`doc-${pageId}`);
    }
    let docText = pageYMap.get('doc');
    if (!docText) {
      docText = new Y.Text();
      pageYMap.set('doc', docText);
    }
    return docText;
  }

  public getDocString(pageId: string): string {
    return this.getPageDocText(pageId).toString();
  }

  public setDocString(pageId: string, text: string): void {
    if (this.role === 'view') return;
    const docText = this.getPageDocText(pageId);
    this.doc.transact(() => {
      docText.delete(0, docText.length);
      docText.insert(0, text);
    });
  }

  public setNode(pageId: string, node: CanvasNode): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;
    const nodesYMap = pageYMap.get('nodes');
    if (nodesYMap) {
      nodesYMap.set(node.id, node);
    }
  }

  public setNodes(pageId: string, nodes: CanvasNode[]): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;
    const nodesYMap = pageYMap.get('nodes');
    if (nodesYMap) {
      this.doc.transact(() => {
        for (const n of nodes) {
          nodesYMap.set(n.id, n);
        }
      });
    }
  }

  public deleteNodes(pageId: string, nodeIds: string[]): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;
    const nodesYMap = pageYMap.get('nodes');
    const edgesYMap = pageYMap.get('edges');

    this.doc.transact(() => {
      // Delete matching nodes
      for (const id of nodeIds) {
        nodesYMap?.delete(id);
      }
      // Also delete any edges attached to deleted nodes
      if (edgesYMap) {
        const edges = edgesYMap.toJSON() as Record<string, CanvasEdge>;
        for (const [eId, edge] of Object.entries(edges)) {
          if (nodeIds.includes(edge.fromNode) || nodeIds.includes(edge.toNode)) {
            edgesYMap.delete(eId);
          }
        }
      }
    });
  }

  public setEdge(pageId: string, edge: CanvasEdge): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;
    const edgesYMap = pageYMap.get('edges');
    if (edgesYMap) {
      edgesYMap.set(edge.id, edge);
    }
  }

  public deleteEdge(pageId: string, edgeId: string): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;
    const edgesYMap = pageYMap.get('edges');
    if (edgesYMap) {
      edgesYMap.delete(edgeId);
    }
  }

  // Undo / Redo
  public undo(): void {
    if (this.role === 'view' || !this.undoManager) return;
    this.undoManager.undo();
  }

  public redo(): void {
    if (this.role === 'view' || !this.undoManager) return;
    this.undoManager.redo();
  }

  public canUndo(): boolean {
    return this.undoManager ? this.undoManager.canUndo() : false;
  }

  public canRedo(): boolean {
    return this.undoManager ? this.undoManager.canRedo() : false;
  }

  // JSON Canvas 1.0 Import & Export
  public exportToJSONCanvas(pageId: string): JSONCanvasDoc {
    const nodes = Object.values(this.getPageNodes(pageId));
    const edges = Object.values(this.getPageEdges(pageId));
    return { nodes, edges };
  }

  public importFromJSONCanvas(pageId: string, canvasDoc: JSONCanvasDoc): void {
    if (this.role === 'view') return;
    const pageYMap = this.pagesMap.get(pageId);
    if (!pageYMap) return;

    const nodesYMap = pageYMap.get('nodes');
    const edgesYMap = pageYMap.get('edges');

    this.doc.transact(() => {
      nodesYMap?.clear();
      edgesYMap?.clear();

      if (canvasDoc.nodes && Array.isArray(canvasDoc.nodes)) {
        for (const node of canvasDoc.nodes) {
          nodesYMap?.set(node.id, node);
        }
      }

      if (canvasDoc.edges && Array.isArray(canvasDoc.edges)) {
        for (const edge of canvasDoc.edges) {
          edgesYMap?.set(edge.id, edge);
        }
      }
    });

    this.notify();
  }

  // Subscriptions
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeAwareness(listener: (users: UserAwareness[]) => void): () => void {
    this.awarenessListeners.add(listener);
    return () => this.awarenessListeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public destroy(): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'awareness-leave',
          senderId: this.userId,
        });
        this.broadcastChannel.close();
      } catch {
        // ignore
      }
      this.broadcastChannel = null;
    }
    this.localTabUsers.clear();
    this.listeners.clear();
    this.awarenessListeners.clear();
    this.indexeddbProvider?.destroy();
    this.wsProvider?.destroy();
    this.undoManager?.destroy();
    this.doc.destroy();
  }
}

