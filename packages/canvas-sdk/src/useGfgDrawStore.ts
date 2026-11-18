import { useState, useEffect, useRef, useCallback } from 'react';
import { YjsStore } from '../../../frontend/src/store/yjsStore';
import { CanvasNode, CanvasEdge, PageData, JSONCanvasDoc } from '../../../frontend/src/types/canvas';

export interface UseGfgDrawStoreOptions {
  roomId?: string;
  role?: 'edit' | 'view';
  userName?: string;
  initialDoc?: JSONCanvasDoc;
}

export function useGfgDrawStore(options: UseGfgDrawStoreOptions = {}) {
  const { roomId = 'sdk-room', role = 'edit', userName } = options;
  const storeRef = useRef<YjsStore | null>(null);

  const [activePageId, setActivePageId] = useState<string>('page-1');
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [nodes, setNodes] = useState<Record<string, CanvasNode>>({});
  const [edges, setEdges] = useState<Record<string, CanvasEdge>>({});
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const store = new YjsStore({ roomId, role, userName });
    storeRef.current = store;

    if (options.initialDoc) {
      store.importFromJSONCanvas(store.getFirstPageId(), options.initialDoc);
    }

    const unsubscribe = store.subscribe(() => {
      const pageList = store.getAllPages();
      setPages(pageList);

      const currPage = store.getFirstPageId();
      const pageNodes = store.getPageNodes(currPage);
      const pageEdges = store.getPageEdges(currPage);
      setNodes({ ...pageNodes });
      setEdges({ ...pageEdges });

      setCanUndo(store.canUndo());
      setCanRedo(store.canRedo());
    });

    // Initial sync
    setPages(store.getAllPages());
    setActivePageId(store.getFirstPageId());
    setNodes(store.getPageNodes(store.getFirstPageId()));
    setEdges(store.getPageEdges(store.getFirstPageId()));

    return () => {
      unsubscribe();
      store.destroy();
    };
  }, [roomId, role, userName]);

  const addNode = useCallback((node: CanvasNode, pageId: string = activePageId) => {
    storeRef.current?.setNode(pageId, node);
  }, [activePageId]);

  const updateNode = useCallback((node: CanvasNode, pageId: string = activePageId) => {
    storeRef.current?.setNode(pageId, node);
  }, [activePageId]);

  const deleteNodes = useCallback((nodeIds: string[], pageId: string = activePageId) => {
    storeRef.current?.deleteNodes(pageId, nodeIds);
  }, [activePageId]);

  const addEdge = useCallback((edge: CanvasEdge, pageId: string = activePageId) => {
    storeRef.current?.setEdge(pageId, edge);
  }, [activePageId]);

  const deleteEdge = useCallback((edgeId: string, pageId: string = activePageId) => {
    storeRef.current?.deleteEdge(pageId, edgeId);
  }, [activePageId]);

  const undo = useCallback(() => {
    storeRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    storeRef.current?.redo();
  }, []);

  return {
    store: storeRef.current,
    activePageId,
    setActivePageId,
    pages,
    nodes,
    edges,
    canUndo,
    canRedo,
    addNode,
    updateNode,
    deleteNodes,
    addEdge,
    deleteEdge,
    undo,
    redo,
  };
}
