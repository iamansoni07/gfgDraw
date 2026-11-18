import React from 'react';
import { WhiteboardApp } from '../../../frontend/src/components/WhiteboardApp';
import { RenderMode, JSONCanvasDoc, CanvasNode } from '../../../frontend/src/types/canvas';
import { GfgPlugin, registerPlugin } from '../../../frontend/src/sdk/pluginApi';

export interface GfgDrawCanvasProps {
  roomId?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  readOnly?: boolean;
  renderMode?: RenderMode;
  initialDoc?: JSONCanvasDoc;
  plugins?: GfgPlugin[];
  className?: string;
  style?: React.CSSProperties;
}

export const GfgDrawCanvas: React.FC<GfgDrawCanvasProps> = ({
  roomId = 'embedded-studio',
  theme = 'light',
  onToggleTheme,
  readOnly = false,
  plugins = [],
  className = '',
  style,
}) => {
  // Register optional custom plugins on mount
  React.useEffect(() => {
    for (const plugin of plugins) {
      registerPlugin(plugin);
    }
  }, [plugins]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${className}`}
      style={style}
    >
      <WhiteboardApp
        roomId={roomId}
        theme={theme}
        onToggleTheme={onToggleTheme}
        readOnly={readOnly}
      />
    </div>
  );
};
