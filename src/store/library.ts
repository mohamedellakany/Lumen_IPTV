import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from './storage';
import { useProfiles } from './profiles';

export type MediaKind = 'live' | 'movie' | 'series' | 'episode';

/** A lightweight snapshot of an item, enough to render it in lists without refetching the catalog. */
export interface MediaRef {
  kind: MediaKind;
  id: string;
  name: string;
  image?: string;
  categoryId?: string;
  seriesId?: string;
  seriesName?: string;
  season?: number;
  episodeNum?: number;
}

export interface Progress {
  position: number;
  duration: number;
  updatedAt: number;
}

export interface ProfileLibrary {
  favorites: Record<string, MediaRef & { addedAt: number }>;
  recents: (MediaRef & { watchedAt: number })[];
  progress: Record<string, Progress>;
}

const EMPTY: ProfileLibrary = { favorites: {}, recents: [], progress: {} };
const MAX_RECENTS = 80;

export const keyOf = (ref: { kind: MediaKind; id: string }) => `${ref.kind}:${ref.id}`;

interface LibraryState {
  libraries: Record<string, ProfileLibrary>;
  toggleFavorite: (profileId: string, ref: MediaRef) => void;
  addRecent: (profileId: string, ref: MediaRef) => void;
  removeRecent: (profileId: string, key: string) => void;
  saveProgress: (profileId: string, key: string, position: number, duration: number) => void;
  clearHistory: (profileId: string) => void;
  clearFavorites: (profileId: string) => void;
  removeProfile: (profileId: string) => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => {
      const update = (profileId: string, fn: (lib: ProfileLibrary) => ProfileLibrary) =>
        set((s) => ({ libraries: { ...s.libraries, [profileId]: fn(s.libraries[profileId] ?? EMPTY) } }));

      return {
        libraries: {},
        toggleFavorite: (profileId, ref) =>
          update(profileId, (lib) => {
            const key = keyOf(ref);
            const favorites = { ...lib.favorites };
            if (favorites[key]) delete favorites[key];
            else favorites[key] = { ...ref, addedAt: Date.now() };
            return { ...lib, favorites };
          }),
        addRecent: (profileId, ref) =>
          update(profileId, (lib) => {
            const key = keyOf(ref);
            const recents = [{ ...ref, watchedAt: Date.now() }, ...lib.recents.filter((r) => keyOf(r) !== key)];
            return { ...lib, recents: recents.slice(0, MAX_RECENTS) };
          }),
        removeRecent: (profileId, key) =>
          update(profileId, (lib) => ({ ...lib, recents: lib.recents.filter((r) => keyOf(r) !== key) })),
        saveProgress: (profileId, key, position, duration) =>
          update(profileId, (lib) => ({
            ...lib,
            progress: { ...lib.progress, [key]: { position, duration, updatedAt: Date.now() } },
          })),
        clearHistory: (profileId) => update(profileId, (lib) => ({ ...lib, recents: [], progress: {} })),
        clearFavorites: (profileId) => update(profileId, (lib) => ({ ...lib, favorites: {} })),
        removeProfile: (profileId) =>
          set((s) => {
            const libraries = { ...s.libraries };
            delete libraries[profileId];
            return { libraries };
          }),
      };
    },
    { name: 'library', storage: persistStorage, version: 1 },
  ),
);

export function useLibrary(): ProfileLibrary {
  const activeId = useProfiles((s) => s.activeId);
  return useLibraryStore((s) => (activeId ? s.libraries[activeId] : undefined) ?? EMPTY);
}

export function useIsFavorite(kind: MediaKind, id: string): boolean {
  const activeId = useProfiles((s) => s.activeId);
  return useLibraryStore((s) => !!(activeId && s.libraries[activeId]?.favorites[`${kind}:${id}`]));
}

/** Actions bound to the active profile. */
export function libraryActions() {
  const profileId = useProfiles.getState().activeId;
  const store = useLibraryStore.getState();
  return {
    toggleFavorite: (ref: MediaRef) => profileId && store.toggleFavorite(profileId, ref),
    addRecent: (ref: MediaRef) => profileId && store.addRecent(profileId, ref),
    removeRecent: (key: string) => profileId && store.removeRecent(profileId, key),
    saveProgress: (key: string, position: number, duration: number) =>
      profileId && store.saveProgress(profileId, key, position, duration),
    clearHistory: () => profileId && store.clearHistory(profileId),
    clearFavorites: () => profileId && store.clearFavorites(profileId),
  };
}

/** Fraction watched if the item is in progress (not barely started, not finished), else undefined. */
export function inProgressFraction(progress?: Progress): number | undefined {
  if (!progress || !progress.duration) return undefined;
  const fraction = progress.position / progress.duration;
  return fraction > 0.02 && fraction < 0.95 ? fraction : undefined;
}

export function isWatched(progress?: Progress): boolean {
  return !!progress?.duration && progress.position / progress.duration >= 0.95;
}
