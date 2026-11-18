import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  X,
  Play,
  Pause,
} from 'lucide-react';
import { CanvasNode, Camera } from '../types/canvas';

interface PresentationOverlayProps {
  frames: CanvasNode[];
  activeSlideIndex: number;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onGoToSlide: (index: number) => void;
  onExit: () => void;
  theme: 'light' | 'dark';
}

export const PresentationOverlay: React.FC<PresentationOverlayProps> = ({
  frames,
  activeSlideIndex,
  onNextSlide,
  onPrevSlide,
  onGoToSlide,
  onExit,
  theme,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const totalSlides = frames.length;
  const currentFrame = frames[activeSlideIndex];
  const slideTitle = currentFrame?._ext?.frameTitle || currentFrame?.text || `Slide ${activeSlideIndex + 1}`;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        onNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        onPrevSlide();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextSlide, onPrevSlide, onExit]);

  // Auto-play timer
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      onNextSlide();
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, onNextSlide]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const progressPercent = totalSlides > 0 ? ((activeSlideIndex + 1) / totalSlides) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none select-none flex flex-col justify-between">
      {/* Top Header Tag: Slide Title & Exit button */}
      <div className="flex items-center justify-between p-4 pointer-events-auto">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border shadow-lg backdrop-blur-md text-xs font-mono font-semibold"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(17, 21, 29, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
            color: theme === 'dark' ? '#F3F4F6' : '#111827',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-500 uppercase tracking-wider text-[10px]">Presenting</span>
          <span className="text-zinc-400">|</span>
          <span className="truncate max-w-[300px]">{slideTitle}</span>
        </div>

        <button
          type="button"
          onClick={onExit}
          title="Exit Presentation Mode (Esc)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border shadow-lg backdrop-blur-md text-xs font-mono font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(17, 21, 29, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
          }}
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit (Esc)</span>
        </button>
      </div>

      {/* Floating Bottom Presentation HUD */}
      <div className="flex flex-col items-center pb-6 pointer-events-auto">
        <div
          className="flex items-center gap-3 p-1.5 px-3 rounded-lg border shadow-2xl backdrop-blur-md"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(17, 21, 29, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderColor: theme === 'dark' ? '#1F2633' : '#E4E4E7',
          }}
        >
          {/* Previous Slide */}
          <button
            type="button"
            onClick={onPrevSlide}
            disabled={activeSlideIndex <= 0}
            title="Previous Frame (ArrowLeft)"
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Slide Progress Badge */}
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200">
            <span>{activeSlideIndex + 1}</span>
            <span className="text-zinc-400 font-normal">/</span>
            <span className="text-zinc-500">{totalSlides}</span>
          </div>

          {/* Next Slide */}
          <button
            type="button"
            onClick={onNextSlide}
            disabled={activeSlideIndex >= totalSlides - 1}
            title="Next Frame (ArrowRight / Space)"
            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-600 dark:text-zinc-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

          {/* Auto-play toggle */}
          <button
            type="button"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            title={isAutoPlaying ? 'Pause Slideshow' : 'Auto-Advance Slides'}
            className={`p-1.5 rounded transition-colors ${
              isAutoPlaying
                ? 'bg-emerald-500/15 text-emerald-500 font-bold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (F)"
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Thin bottom progress hairline */}
        <div className="w-64 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

