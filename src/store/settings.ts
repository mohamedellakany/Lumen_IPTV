import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LiveFormat } from '@/api/types';
import { persistStorage } from './storage';

export type SortMode = 'default' | 'az' | 'recent' | 'rating';

const defaultProxy = Platform.OS === 'web' ? (process.env.EXPO_PUBLIC_PROXY_URL ?? 'http://localhost:8787') : '';

interface SettingsState {
  liveFormat: LiveFormat;
  hideAdult: boolean;
  autoplayNext: boolean;
  webProxyUrl: string;
  movieSort: SortMode;
  seriesSort: SortMode;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      liveFormat: 'm3u8',
      hideAdult: true,
      autoplayNext: true,
      webProxyUrl: defaultProxy,
      movieSort: 'default',
      seriesSort: 'default',
      set: (patch) => set(patch),
    }),
    { name: 'settings', storage: persistStorage, version: 1 },
  ),
);
