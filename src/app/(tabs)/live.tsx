import { useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TVFocusGuideView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LiveChannel } from '@/api/types';
import { CategoryPicker, type PickerCategory } from '@/components/CategoryPicker';
import { CHANNEL_ROW_HEIGHT, ChannelRow } from '@/components/ChannelRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchInput } from '@/components/SearchInput';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { filterByQuery, useCatalog } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { markOpeningChild, useSectionEntry } from '@/hooks/useSectionEntry';
import { libraryActions, useLibrary } from '@/store/library';
import { colors, spacing } from '@/theme';

const ALL = '__all';
const FAVORITES = '__fav';
const RECENT = '__recent';

export default function LiveScreen() {
  const router = useRouter();
  const { isWide, isTV } = useLayout();
  const { categories, items, byId, isLoading, error, refetch } = useCatalog('live');
  const library = useLibrary();
  const [selected, setSelected] = useState(ALL);
  const [query, setQuery] = useState('');
  const listRef = useRef<FlatList<LiveChannel>>(null);
  // The category highlight updates instantly; the channel list catches up in the background.
  const shownCategory = useDeferredValue(selected);
  const shownQuery = useDeferredValue(query);

  const pickerCategories = useMemo<PickerCategory[]>(() => {
    const counts = new Map<string, number>();
    for (const c of items) counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
    return [
      { id: RECENT, name: 'Recently watched', icon: 'time-outline' },
      { id: ALL, name: 'All channels', icon: 'apps-outline', count: items.length },
      { id: FAVORITES, name: 'Favorites', icon: 'heart-outline' },
      ...categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })),
    ];
  }, [categories, items]);

  const channels = useMemo(() => {
    let list: LiveChannel[];
    if (shownCategory === ALL) list = items;
    else if (shownCategory === FAVORITES)
      list = Object.values(library.favorites).flatMap((f) => (f.kind === 'live' && byId.get(f.id) ? [byId.get(f.id)!] : []));
    else if (shownCategory === RECENT)
      list = library.recents.flatMap((r) => (r.kind === 'live' && byId.get(r.id) ? [byId.get(r.id)!] : []));
    else list = items.filter((c) => c.categoryId === shownCategory);
    return filterByQuery(list, shownQuery);
  }, [shownCategory, items, byId, library.favorites, library.recents, shownQuery]);

  // Choosing a category (even the current one again) starts its list from the top.
  const [picks, setPicks] = useState(0);
  const choose = useCallback((id: string) => {
    setSelected(id);
    setPicks((n) => n + 1);
  }, []);
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [shownCategory, picks]);

  // TV: entering the list with the remote (e.g. ▶ from a category) lands on the first channel,
  // not on whichever row happens to sit next to the category.
  const [firstChannel, setFirstChannel] = useState<ComponentRef<typeof Pressable> | null>(null);

  // Opening the section: show Recently watched (if any) and put the remote on it.
  const [focusSignal, setFocusSignal] = useState(0);
  const hasRecent = library.recents.some((r) => r.kind === 'live' && byId.has(r.id));
  useSectionEntry(() => {
    setSelected(hasRecent ? RECENT : ALL);
    setFocusSignal((n) => n + 1);
  });

  const play = useCallback(
    (channel: LiveChannel) => {
      markOpeningChild();
      router.push({
        pathname: '/player',
        params: {
          kind: 'live',
          id: channel.id,
          categoryId: shownCategory.startsWith('__') ? '' : shownCategory,
          ...(shownCategory === FAVORITES ? { list: 'favorites' } : {}),
        },
      });
    },
    [router, shownCategory],
  );

  const toggleFavorite = useCallback(
    (c: LiveChannel) => libraryActions().toggleFavorite({ kind: 'live', id: c.id, name: c.name, image: c.logo, categoryId: c.categoryId }),
    [],
  );

  const body = () => {
    if (isLoading) return <LoadingState message="Loading channels…" />;
    if (error) return <ErrorState error={error} onRetry={refetch} />;
    if (channels.length === 0) {
      if (shownCategory === RECENT && !shownQuery) {
        return <EmptyState icon="time-outline" title="Nothing watched yet" message="Channels you watch will show up here." />;
      }
      return shownCategory === FAVORITES && !shownQuery ? (
        <EmptyState icon="heart-outline" title="No favorite channels" message="Tap the heart next to a channel to add it here." />
      ) : (
        <EmptyState icon="tv-outline" title="No channels found" />
      );
    }
    return (
      <FlatList
        ref={listRef}
        data={channels}
        keyExtractor={(c) => c.id}
        renderItem={({ item, index }) => (
          <ChannelRow
            ref={index === 0 ? setFirstChannel : undefined}
            channel={item} favorite={!!library.favorites[`live:${item.id}`]} onPress={play} onToggleFavorite={toggleFavorite} />
        )}
        getItemLayout={(_, index) => ({ length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index })}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const listArea = isTV ? (
    <TVFocusGuideView style={{ flex: 1 }} destinations={firstChannel ? [firstChannel] : undefined}>
      {body()}
    </TVFocusGuideView>
  ) : (
    <View style={{ flex: 1 }}>{body()}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Live TV"
        subtitle={items.length ? `${items.length.toLocaleString()} channels` : undefined}
        right={isTV ? <SearchInput value={query} onChangeText={setQuery} placeholder="Search channels" style={styles.searchTV} /> : undefined}
      />
      {!isTV && <SearchInput value={query} onChangeText={setQuery} placeholder="Search channels" style={styles.search} />}
      {isWide ? (
        <View style={styles.split}>
          <CategoryPicker variant="sidebar" categories={pickerCategories} selected={selected} onSelect={choose} focusFirstSignal={focusSignal} />
          {listArea}
        </View>
      ) : (
        <>
          <CategoryPicker variant="chips" categories={pickerCategories} selected={selected} onSelect={choose} focusFirstSignal={focusSignal} />
          {listArea}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  searchTV: { width: 340 },
  split: { flex: 1, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
