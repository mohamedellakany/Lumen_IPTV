import { useRouter } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ChannelRow } from '@/components/ChannelRow';
import { PosterCard } from '@/components/PosterCard';
import { Rail } from '@/components/Rail';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, LoadingState } from '@/components/StateViews';
import { useCatalog } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { libraryActions, useLibrary } from '@/store/library';
import { colors, spacing } from '@/theme';
import { openMedia } from '@/utils/navigation';
import { Text } from '@/components/Text';

const LIMIT = 40;

function search<T extends { name: string }>(items: T[], q: string): T[] {
  if (q.length < 2) return [];
  const results: T[] = [];
  for (const item of items) {
    if (item.name.toLowerCase().includes(q)) {
      results.push(item);
      if (results.length >= LIMIT) break;
    }
  }
  return results;
}

export default function SearchScreen() {
  const router = useRouter();
  const { railPoster } = useLayout();
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const live = useCatalog('live');
  const movies = useCatalog('movie');
  const series = useCatalog('series');

  const results = useMemo(
    () => ({ live: search(live.items, deferred), movies: search(movies.items, deferred), series: search(series.items, deferred) }),
    [live.items, movies.items, series.items, deferred],
  );
  const total = results.live.length + results.movies.length + results.series.length;
  const loading = live.isLoading || movies.isLoading || series.isLoading;

  return (
    <View style={styles.screen}>
      <SearchInput value={query} onChangeText={setQuery} placeholder="Channels, movies, series…" autoFocus style={styles.input} />
      {deferred.length < 2 ? (
        loading ? <LoadingState message="Loading your library…" /> : <EmptyState icon="search" title="Search everything" message="Find live channels, movies and series across your playlist." />
      ) : total === 0 ? (
        <EmptyState icon="search" title="No results" message={`Nothing matches "${query.trim()}".`} />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <Rail
            title={`Movies (${results.movies.length})`}
            data={results.movies}
            keyExtractor={(m) => m.id}
            renderItem={(m) => <PosterCard title={m.name} image={m.poster} rating={m.rating} width={railPoster} onPress={() => openMedia(router, m)} />}
          />
          <Rail
            title={`Series (${results.series.length})`}
            data={results.series}
            keyExtractor={(s) => s.id}
            renderItem={(s) => <PosterCard title={s.name} image={s.poster} rating={s.rating} width={railPoster} onPress={() => openMedia(router, s)} />}
          />
          {results.live.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={styles.section}>Channels ({results.live.length})</Text>
              {results.live.map((c) => (
                <ChannelRow
                  key={c.id}
                  channel={c}
                  favorite={!!library.favorites[`live:${c.id}`]}
                  onPress={() => openMedia(router, c)}
                  onToggleFavorite={() => libraryActions().toggleFavorite({ kind: 'live', id: c.id, name: c.name, image: c.logo, categoryId: c.categoryId })}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  input: { margin: spacing.lg },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
});
