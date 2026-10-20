import React from 'react';
import {ICONS} from '../generated/icons';

/**
 * Material Symbols icon, matching `Icons.Filled.X` / `Icons.Outlined.X` in the app.
 * Sizing follows the Compose call site (dp × px-per-dp). `size` may be fractional.
 */
export const Ico: React.FC<{
  name: keyof typeof ICONS | string;
  size: number;
  color?: string;
  style?: React.CSSProperties;
  opacity?: number;
}> = ({name, size, color = 'currentColor', style, opacity}) => {
  const body = ICONS[name as string];
  if (!body) return <span style={{display: 'inline-block', width: size, height: size}} />;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{display: 'block', flexShrink: 0, color, opacity, ...style}}
      dangerouslySetInnerHTML={{__html: body}}
    />
  );
};
