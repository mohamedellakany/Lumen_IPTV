import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { clearM3UCache } from '@/api/m3u';
import { isAdultCategory } from '@/api/parsers';
import { createProvider } from '@/api/provider';
import type { CatalogKind, CatalogProvider, Category, LiveChannel, Movie, Series } from '@/api/types';
import { useActiveProfile } from '@/store/profiles';
import { useSettings, type SortMode } from '@/store/settings';

const HOUR = 60 * 60 * 1000;

export function useProvider(): { provider: CatalogProvider | null; profileId: string } {
  const profile = useActiveProfile();
  const provider = useMemo(() => (profile ? createProvider(profile) : null), [profile]);
  return { provider, profileId: profile?.id ?? 'none' };
}

export function useAccountInfo() {
  const { provider, profileId } = useProvider();
  return useQuery({
    queryKey: [profileId, 'account'],
    queryFn: () => provider!.authenticate(),
    enabled: !!provider,
    staleTime: 10 * 60 * 1000,
  });
}

type ItemOf<K extends CatalogKind> = K extends 'live' ? LiveChannel : K extends 'movie' ? Movie : Series;

const loaders = {
  live: { categories: (p: CatalogProvider) => p.getLiveCategories(), items: (p: CatalogProvider) => p.getLiveStreams() },
  movie: { categories: (p: CatalogProvider) => p.getMovieCategories(), items: (p: CatalogProvider) => p.getMovies() },
  series: { categories: (p: CatalogProvider) => p.getSeriesCategories(), items: (p: CatalogProvider) => p.getSeries() },
};

export interface CatalogResult<T> {
  categories: Category[];
  items: T[];
  byId: Map<string, T>;
  isLoading: boolean;
  /** When the items were last downloaded (ms), 0 if never. */
  updatedAt: number;
  error: Error | null;
  refetch: () => void;
}

/** Full catalog for one content type, with adult categories (and their items) hidden when enabled in settings. */
export function useCatalog<K extends CatalogKind>(kind: K, enabled = true): CatalogResult<ItemOf<K>> {
  const { provider, profileId } = useProvider();
  const hideAdult = useSettings((s) => s.hideAdult);

  const categoriesQuery = useQuery({
    queryKey: [profileId, kind, 'categories'],
    queryFn: () => loaders[kind].categories(provider!),
    enabled: !!provider && enabled,
    staleTime: HOUR,
  });
  const itemsQuery = useQuery({
    queryKey: [profileId, kind, 'items'],
    queryFn: () => loaders[kind].items(provider!) as Promise<ItemOf<K>[]>,
    enabled: !!provider && enabled,
    staleTime: HOUR,
  });

  return useMemo(() => {
    const allCategories = categoriesQuery.data ?? [];
    const allItems = itemsQuery.data ?? [];
    const hidden = new Set(hideAdult ? allCategories.filter((c) => isAdultCategory(c.name)).map((c) => c.id) : []);
    const categories = allCategories.filter((c) => !hidden.has(c.id));
    const items = hidden.size ? allItems.filter((i) => !hidden.has(i.categoryId)) : allItems;
    return {
      categories,
      items,
      byId: new Map(items.map((i) => [i.id, i])),
      isLoading: categoriesQuery.isLoading || itemsQuery.isLoading,
      updatedAt: itemsQuery.dataUpdatedAt,
      error: (categoriesQuery.error ?? itemsQuery.error) as Error | null,
      refetch: () => {
        categoriesQuery.refetch();
        itemsQuery.refetch();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- query objects change identity every render
  }, [categoriesQuery.data, itemsQuery.data, categoriesQuery.isLoading, itemsQuery.isLoading, categoriesQuery.error, itemsQuery.error, itemsQuery.dataUpdatedAt, hideAdult]);
}

export function useMovieInfo(id: string | undefined) {
  const { provider, profileId } = useProvider();
  return useQuery({
    queryKey: [profileId, 'movie-info', id],
    queryFn: () => provider!.getMovieInfo(id!),
    enabled: !!provider && !!id,
    staleTime: HOUR,
  });
}

export function useSeriesInfo(id: string | undefined) {
  const { provider, profileId } = useProvider();
  return useQuery({
    queryKey: [profileId, 'series-info', id],
    queryFn: () => provider!.getSeriesInfo(id!),
    enabled: !!provider && !!id,
    staleTime: HOUR,
  });
}

export function useShortEpg(channel: LiveChannel | undefined) {
  const { provider, profileId } = useProvider();
  return useQuery({
    queryKey: [profileId, 'epg', channel?.id],
    queryFn: () => provider!.getShortEpg(channel!),
    enabled: !!provider && !!channel,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function sortItems<T extends Movie | Series>(items: T[], mode: SortMode): T[] {
  if (mode === 'default') return items;
  const sorted = [...items];
  if (mode === 'az') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === 'rating') sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  else sorted.sort((a, b) => recency(b) - recency(a));
  return sorted;
}

export function recency(item: Movie | Series): number {
  return (item.kind === 'movie' ? item.added : item.updated) ?? 0;
}

export function filterByQuery<T extends { name: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) => i.name.toLowerCase().includes(q));
}

const CATALOGS = [
  { kind: 'live', label: 'channels' },
  { kind: 'movie', label: 'movies' },
  { kind: 'series', label: 'series' },
] as const;

export interface RefreshResult {
  ok: boolean;
  message: string;
}

/** Re-download channels, movies, series and account info for the active playlist. */
export function useRefreshCatalog() {
  const queryClient = useQueryClient();
  const profile = useActiveProfile();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (!profile) return { ok: false, message: 'No playlist selected.' };
    setRefreshing(true);
    try {
      if (profile.type === 'm3u') clearM3UCache(profile.url);
      // Mark everything stale (details, EPG…) so it reloads on next view, but only re-download the
      // big catalogs and account info right now. Old data stays on screen until the new data arrives.
      await queryClient.invalidateQueries({ queryKey: [profile.id], refetchType: 'none' });
      await Promise.all([
        ...CATALOGS.map(({ kind }) => queryClient.refetchQueries({ queryKey: [profile.id, kind] })),
        queryClient.refetchQueries({ queryKey: [profile.id, 'account'] }),
      ]);
      const failed = CATALOGS.filter(({ kind }) => queryClient.getQueryState([profile.id, kind, 'items'])?.status === 'error');
      if (failed.length) {
        return { ok: false, message: `Couldn't update ${failed.map((f) => f.label).join(', ')}. Showing the previous list.` };
      }
      return { ok: true, message: 'Playlist updated' };
    } finally {
      setRefreshing(false);
    }
  }, [profile, queryClient]);

  return { refresh, refreshing };
}
