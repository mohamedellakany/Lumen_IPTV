import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Profile } from '@/api/types';
import { persistStorage } from './storage';

interface ProfilesState {
  profiles: Profile[];
  activeId: string | null;
  add: (profile: Profile) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
}

export const useProfiles = create<ProfilesState>()(
  persist(
    (set) => ({
      profiles: [],
      activeId: null,
      add: (profile) => set((s) => ({ profiles: [...s.profiles.filter((p) => p.id !== profile.id), profile] })),
      remove: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      setActive: (activeId) => set({ activeId }),
    }),
    { name: 'profiles', storage: persistStorage, version: 1 },
  ),
);

export function useActiveProfile(): Profile | null {
  return useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? null);
}
