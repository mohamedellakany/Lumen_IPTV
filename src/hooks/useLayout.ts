import { Platform, useWindowDimensions } from 'react-native';

import { spacing } from '@/theme';

export const isTV = Platform.isTV;

/**
 * Responsive breakpoints: phones get chips + compact grids, tablets/desktop get a category sidebar.
 * TVs (Fire TV reports ~960×540) get a denser layout so several rows fit on screen.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  // Left navigation rail that replaces the bottom tab bar on wide screens and TV.
  const navWidth = isTV ? 190 : width >= 1200 ? 220 : isWide ? 196 : 0;
  const sidebarWidth = isTV ? 220 : isWide ? 260 : 0;
  const contentWidth = width - navWidth - sidebarWidth;
  const targetPoster = isTV ? 76 : width >= 1400 ? 170 : width >= 900 ? 150 : width >= 600 ? 130 : 108;
  const gap = spacing.md;
  const columns = Math.max(2, Math.floor((contentWidth - spacing.lg * 2 + gap) / (targetPoster + gap)));
  const posterWidth = Math.floor((contentWidth - spacing.lg * 2 - gap * (columns - 1)) / columns);
  return {
    width,
    height,
    isWide: isWide || isTV,
    isTV,
    navWidth,
    sidebarWidth,
    columns,
    posterWidth,
    gap,
    rowGap: isTV ? spacing.md : spacing.lg,
    railPoster: isTV ? 96 : targetPoster,
  };
}
