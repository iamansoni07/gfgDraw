import React, { useRef, useEffect } from 'react';
import { Camera } from '../types/canvas';
import { screenToWorld } from '../engine/camera';

interface RulerOverlayProps {
  camera: Camera;
  cursorScreenPos: { x: number; y: number } | null;
  theme: 'light' | 'dark';
}

export const RulerOverlay: React.FC<RulerOverlayProps> = ({
  camera,
  cursorScreenPos,
  theme,
}) => {
  const topCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw Top & Left Rulers
  useEffect(() => {
    const topCanvas = topCanvasRef.current;
    const leftCanvas = leftCanvasRef.current;
    if (!topCanvas || !leftCanvas) return;

    const topCtx = topCanvas.getContext('2d');
    const leftCtx = leftCanvas.getContext('2d');
    if (!topCtx || !leftCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const topRect = topCanvas.getBoundingClientRect();
    const leftRect = leftCanvas.getBoundingClientRect();

    if (topCanvas.width !== topRect.width * dpr || topCanvas.height !== topRect.height * dpr) {
      topCanvas.width = topRect.width * dpr;
      topCanvas.height = topRect.height * dpr;
    }

    if (leftCanvas.width !== leftRect.width * dpr || leftCanvas.height !== leftRect.height * dpr) {
      leftCanvas.width = leftRect.width * dpr;
      leftCanvas.height = leftRect.height * dpr;
    }

    const chromeBg = theme === 'dark' ? '#11151D' : '#FFFFFF';
    const borderColor = theme === 'dark' ? '#1F2633' : '#E4E4E7';
    const textColor = theme === 'dark' ? '#6B7280' : '#9CA3AF';
    const tickColor = theme === 'dark' ? '#374151' : '#D1D5DB';
    const emerald = theme === 'dark' ? '#10B981' : '#059669';

    // Calculate dynamic step interval based on camera zoom
    const rawStep = 100 / camera.zoom;
    let step = 100;
    if (rawStep < 40) step = 20;
    else if (rawStep < 80) step = 50;
    else if (rawStep > 300) step = 500;
    else if (rawStep > 150) step = 200;

    // --- DRAW TOP RULER ---
    topCtx.save();
    topCtx.scale(dpr, dpr);
    topCtx.fillStyle = chromeBg;
    topCtx.fillRect(0, 0, topRect.width, topRect.height);

    topCtx.strokeStyle = borderColor;
    topCtx.lineWidth = 1;
    topCtx.beginPath();
    topCtx.moveTo(0, topRect.height - 0.5);
    topCtx.lineTo(topRect.width, topRect.height - 0.5);
    topCtx.stroke();

    topCtx.font = '500 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    topCtx.fillStyle = textColor;
    topCtx.strokeStyle = tickColor;

    // World X bounds visible in this ruler segment
    const startWorldX = Math.floor(screenToWorld(0, 0, camera).x / step) * step;
    const endWorldX = Math.ceil(screenToWorld(topRect.width, 0, camera).x / step) * step;

    for (let wx = startWorldX; wx <= endWorldX; wx += step) {
      const sx = wx * camera.zoom + camera.x;
      if (sx < 0 || sx > topRect.width) continue;

      // Major tick
      topCtx.beginPath();
      topCtx.moveTo(sx, topRect.height - 8);
      topCtx.lineTo(sx, topRect.height);
      topCtx.stroke();

      topCtx.fillText(String(wx), sx + 2, 10);

      // Minor tick halfway
      const midSx = (wx + step / 2) * camera.zoom + camera.x;
      if (midSx >= 0 && midSx <= topRect.width) {
        topCtx.beginPath();
        topCtx.moveTo(midSx, topRect.height - 4);
        topCtx.lineTo(midSx, topRect.height);
        topCtx.stroke();
      }
    }

    // Cursor indicator on top ruler
    if (cursorScreenPos && cursorScreenPos.x >= 0 && cursorScreenPos.x <= topRect.width) {
      topCtx.strokeStyle = emerald;
      topCtx.lineWidth = 1.5;
      topCtx.beginPath();
      topCtx.moveTo(cursorScreenPos.x, 0);
      topCtx.lineTo(cursorScreenPos.x, topRect.height);
      topCtx.stroke();
    }

    topCtx.restore();

    // --- DRAW LEFT RULER ---
    leftCtx.save();
    leftCtx.scale(dpr, dpr);
    leftCtx.fillStyle = chromeBg;
    leftCtx.fillRect(0, 0, leftRect.width, leftRect.height);

    leftCtx.strokeStyle = borderColor;
    leftCtx.lineWidth = 1;
    leftCtx.beginPath();
    leftCtx.moveTo(leftRect.width - 0.5, 0);
    leftCtx.lineTo(leftRect.width - 0.5, leftRect.height);
    leftCtx.stroke();

    leftCtx.font = '500 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    leftCtx.fillStyle = textColor;
    leftCtx.strokeStyle = tickColor;

    const startWorldY = Math.floor(screenToWorld(0, 0, camera).y / step) * step;
    const endWorldY = Math.ceil(screenToWorld(0, leftRect.height, camera).y / step) * step;

    for (let wy = startWorldY; wy <= endWorldY; wy += step) {
      const sy = wy * camera.zoom + camera.y;
      if (sy < 0 || sy > leftRect.height) continue;

      // Major tick
      leftCtx.beginPath();
      leftCtx.moveTo(leftRect.width - 8, sy);
      leftCtx.lineTo(leftRect.width, sy);
      leftCtx.stroke();

      leftCtx.save();
      leftCtx.translate(9, sy - 2);
      leftCtx.rotate(-Math.PI / 2);
      leftCtx.fillText(String(wy), 0, 0);
      leftCtx.restore();

      // Minor tick halfway
      const midSy = (wy + step / 2) * camera.zoom + camera.y;
      if (midSy >= 0 && midSy <= leftRect.height) {
        leftCtx.beginPath();
        leftCtx.moveTo(leftRect.width - 4, midSy);
        leftCtx.lineTo(leftRect.width, midSy);
        leftCtx.stroke();
      }
    }

    // Cursor indicator on left ruler
    if (cursorScreenPos && cursorScreenPos.y >= 0 && cursorScreenPos.y <= leftRect.height) {
      leftCtx.strokeStyle = emerald;
      leftCtx.lineWidth = 1.5;
      leftCtx.beginPath();
      leftCtx.moveTo(0, cursorScreenPos.y);
      leftCtx.lineTo(leftRect.width, cursorScreenPos.y);
      leftCtx.stroke();
    }

    leftCtx.restore();
  }, [camera, cursorScreenPos, theme]);

  return (
    <>
      {/* 20px Top Ruler (anchored from left 68px to right 0px, top 44px) */}
      <div className="absolute top-[44px] left-[68px] right-0 h-[20px] z-30 pointer-events-none select-none">
        <canvas ref={topCanvasRef} className="w-full h-full block" />
      </div>

      {/* 20px Left Ruler (anchored from top 44px to bottom 30px, left 48px) */}
      <div className="absolute top-[64px] left-[48px] bottom-[30px] w-[20px] z-30 pointer-events-none select-none">
        <canvas ref={leftCanvasRef} className="w-full h-full block" />
      </div>

      {/* 20x20 Origin Block */}
      <div
        className="absolute top-[44px] left-[48px] w-[20px] h-[20px] z-30 border-r border-b pointer-events-none flex items-center justify-center text-[8px] font-mono select-none"
        style={{
          backgroundColor: theme === 'dark' ? '#11151D' : '#FFFFFF',
          borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
          color: theme === 'dark' ? '#6B7280' : '#9CA3AF',
        }}
      >
        +
      </div>
    </>
  );
};
