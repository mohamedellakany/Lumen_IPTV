import { useSyncExternalStore } from 'react';

import { useLibraryStore } from './library';
import { useProfiles } from './profiles';
import { useSettings } from './settings';

const stores = [useProfiles, useSettings, useLibraryStore];
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());
const subscribe = (onChange: () => void) => {
  const unsubs = stores.map((s) => s.persist.onFinishHydration(onChange));
  return () => unsubs.forEach((u) => u());
};

/** True once persisted state has been loaded from storage. */
export function useStoresHydrated(): boolean {
  return useSyncExternalStore(subscribe, allHydrated, () => false);
}
