import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

export const isTV = Platform.isTV;

/**
 * Responsive breakpoints: phones get chips + compact grids, tablets/desktop get a category sidebar.
 * TVs (Fire TV reports ~960×540) get a denser layout so several rows fit on screen.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Phones held sideways: too short for a bottom tab bar, so they get a slim icon-only rail instead.
  const compactNav = !isTV && width > height && height < 600;
  const isWide = width >= 900 || compactNav;
  // Left navigation rail that replaces the bottom tab bar on wide screens and TV. It also covers the
  // left safe area (the iPhone notch in landscape), so its width includes that inset.
  const navWidth = (isTV ? 190 : compactNav ? 72 : width >= 1200 ? 220 : isWide ? 196 : 0) + (isWide ? insets.left : 0);
  const sidebarWidth = isTV ? 220 : compactNav ? 200 : isWide ? 260 : 0;
  const contentWidth = width - navWidth - insets.right - sidebarWidth;
  const targetPoster = isTV ? 76 : width >= 1400 ? 170 : width >= 900 ? 150 : width >= 600 ? 130 : 108;
  const gap = spacing.md;
  // Movie / series grids show five posters per row; four only if five would make them tiny.
  const fitsFive = (contentWidth - spacing.lg * 2 - gap * 4) / 5 >= 72;
  const columns = fitsFive ? 5 : 4;
  const posterWidth = Math.floor((contentWidth - spacing.lg * 2 - gap * (columns - 1)) / columns);
  return {
    width,
    height,
    isWide: isWide || isTV,
    isTV,
    navWidth,
    compactNav,
    sidebarWidth,
    columns,
    posterWidth,
    gap,
    rowGap: isTV ? spacing.md : spacing.lg,
    railPoster: isTV ? 96 : targetPoster,
  };
}
