import { Camera, BoundingBox } from '../types/canvas';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20.0;

/**
 * Converts screen pixel coordinates to world canvas coordinates.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom,
  };
}

/**
 * Converts world canvas coordinates to screen pixel coordinates.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: worldX * camera.zoom + camera.x,
    y: worldY * camera.zoom + camera.y,
  };
}

/**
 * Returns the current visible camera bounds in world coordinates.
 */
export function getViewportWorldBounds(
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number
): BoundingBox {
  const topLeft = screenToWorld(0, 0, camera);
  const bottomRight = screenToWorld(viewportWidth, viewportHeight, camera);
  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxX: Math.max(topLeft.x, bottomRight.x),
    maxY: Math.max(topLeft.y, bottomRight.y),
  };
}

/**
 * Zooms smoothly centered at a specific screen coordinate (e.g., mouse cursor).
 */
export function zoomAtScreenPoint(
  camera: Camera,
  screenX: number,
  screenY: number,
  factor: number
): Camera {
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  if (Math.abs(newZoom - camera.zoom) < 0.00001) {
    return camera;
  }

  // Find world coordinates under the cursor before zoom
  const worldX = (screenX - camera.x) / camera.zoom;
  const worldY = (screenY - camera.y) / camera.zoom;

  // Reposition camera so the world point remains under the cursor
  return {
    zoom: newZoom,
    x: screenX - worldX * newZoom,
    y: screenY - worldY * newZoom,
  };
}

/**
 * Computes camera viewport to fit all elements with padding (Shift + 1).
 */
export function getZoomToFitCamera(
  bounds: BoundingBox | null,
  canvasWidth: number,
  canvasHeight: number,
  padding = 80
): Camera {
  if (!bounds || bounds.maxX - bounds.minX <= 0 || bounds.maxY - bounds.minY <= 0) {
    return {
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      zoom: 1,
    };
  }

  const boxWidth = bounds.maxX - bounds.minX;
  const boxHeight = bounds.maxY - bounds.minY;

  const availWidth = Math.max(100, canvasWidth - padding * 2);
  const availHeight = Math.max(100, canvasHeight - padding * 2);

  const zoomX = availWidth / boxWidth;
  const zoomY = availHeight / boxHeight;
  const fitZoom = Math.min(1.5, Math.max(MIN_ZOOM, Math.min(zoomX, zoomY)));

  const boxCenterX = (bounds.minX + bounds.maxX) / 2;
  const boxCenterY = (bounds.minY + bounds.maxY) / 2;

  return {
    zoom: fitZoom,
    x: canvasWidth / 2 - boxCenterX * fitZoom,
    y: canvasHeight / 2 - boxCenterY * fitZoom,
  };
}

/**
 * Generates a 16-character hex ID (JSON Canvas compliant).
 */
export function generateHexId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

