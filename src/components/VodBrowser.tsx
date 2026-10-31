import { useRouter } from 'expo-router';
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentRef, type Ref } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TVFocusGuideView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Movie, Series } from '@/api/types';
import { CategoryPicker, type PickerCategory } from '@/components/CategoryPicker';
import { IconButton } from '@/components/Button';
import { PosterCard } from '@/components/PosterCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchInput } from '@/components/SearchInput';
import { Segmented } from '@/components/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { filterByQuery, sortItems, useCatalog } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { markOpeningChild, useSectionEntry } from '@/hooks/useSectionEntry';
import { inProgressFraction, useLibrary } from '@/store/library';
import { useSettings, type SortMode } from '@/store/settings';
import { colors, spacing } from '@/theme';
import { openMedia } from '@/utils/navigation';

const ALL = '__all';
const FAVORITES = '__fav';
const RECENT = '__recent';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'recent', label: 'Recently added' },
  { value: 'az', label: 'A–Z' },
  { value: 'rating', label: 'Top rated' },
];

interface CellProps {
  item: Movie | Series;
  width: number;
  favorite: boolean;
  progress?: number;
  onOpen: (item: Movie | Series) => void;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

const GridCell = memo(function GridCell({ item, width, favorite, progress, onOpen, ref }: CellProps) {
  const onPress = useCallback(() => onOpen(item), [onOpen, item]);
  return (
    <PosterCard
      ref={ref}
      title={item.name}
      image={item.poster}
      width={width}
      rating={item.rating}
      favorite={favorite}
      progress={progress}
      onPress={onPress}
    />
  );
});

export function VodBrowser({ kind }: { kind: 'movie' | 'series' }) {
  const router = useRouter();
  const { isWide, isTV, columns, posterWidth, gap, rowGap } = useLayout();
  const { categories, items, byId, isLoading, error, refetch } = useCatalog(kind);
  const library = useLibrary();
  const sortKey = kind === 'movie' ? 'movieSort' : 'seriesSort';
  const sort = useSettings((s) => s[sortKey]);
  const setSettings = useSettings((s) => s.set);
  const [selected, setSelected] = useState(ALL);
  const [query, setQuery] = useState('');
  const [showSort, setShowSort] = useState(false);
  const gridRef = useRef<FlatList<Movie | Series>>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  // Movies: titles played most recently. Series: series whose episodes were played most recently.
  const recentItems = useMemo(() => {
    const seen = new Set<string>();
    const list: (Movie | Series)[] = [];
    for (const r of library.recents) {
      const id = kind === 'movie' ? (r.kind === 'movie' ? r.id : null) : r.kind === 'episode' ? r.seriesId : r.kind === 'series' ? r.id : null;
      const item = id ? byId.get(id) : undefined;
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    }
    return list;
  }, [library.recents, byId, kind]);

  // Opening the section: show Recently watched (if any) and put the remote on it.
  useSectionEntry(() => {
    setSelected(recentItems.length ? RECENT : ALL);
    setFocusSignal((n) => n + 1);
  });

  // The sidebar highlight follows `selected` immediately; the (heavier) grid catches up in the background.
  const shownCategory = useDeferredValue(selected);
  const shownQuery = useDeferredValue(query);

  const label = kind === 'movie' ? 'Movies' : 'Series';

  const pickerCategories = useMemo<PickerCategory[]>(() => {
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.categoryId, (counts.get(i.categoryId) ?? 0) + 1);
    return [
      { id: RECENT, name: 'Recently watched', icon: 'time-outline', count: recentItems.length },
      { id: ALL, name: `All ${label.toLowerCase()}`, icon: 'apps-outline', count: items.length },
      { id: FAVORITES, name: 'Favorites', icon: 'heart-outline' },
      ...categories.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })),
    ];
  }, [categories, items, label, recentItems.length]);

  const visible = useMemo(() => {
    let list: (Movie | Series)[];
    if (shownCategory === ALL) list = items;
    else if (shownCategory === RECENT) list = recentItems;
    else if (shownCategory === FAVORITES)
      list = Object.values(library.favorites).flatMap((f) => (f.kind === kind && byId.get(f.id) ? [byId.get(f.id)!] : []));
    else list = items.filter((i) => i.categoryId === shownCategory);
    const filtered = filterByQuery(list, shownQuery);
    // Recently watched keeps its own order (most recent first).
    return shownCategory === RECENT ? filtered : sortItems(filtered, sort);
  }, [shownCategory, items, recentItems, byId, library.favorites, kind, shownQuery, sort]);

  // Choosing a category (even the current one again) starts its grid from the top.
  const [picks, setPicks] = useState(0);
  const choose = useCallback((id: string) => {
    setSelected(id);
    setPicks((n) => n + 1);
  }, []);
  useEffect(() => {
    gridRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [shownCategory, sort, picks]);

  // TV: entering the grid with the remote (e.g. ▶ from a category) lands on the first title,
  // not on whichever poster happens to sit next to the category.
  const [firstCell, setFirstCell] = useState<ComponentRef<typeof Pressable> | null>(null);

  const onOpen = useCallback(
    (item: Movie | Series) => {
      markOpeningChild();
      openMedia(router, item);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Movie | Series; index: number }) => (
      <GridCell
        ref={index === 0 ? setFirstCell : undefined}
        item={item}
        width={posterWidth}
        favorite={!!library.favorites[`${kind}:${item.id}`]}
        progress={kind === 'movie' ? inProgressFraction(library.progress[`movie:${item.id}`]) : undefined}
        onOpen={onOpen}
      />
    ),
    [posterWidth, library.favorites, library.progress, kind, onOpen],
  );

  const body = () => {
    if (isLoading) return <LoadingState message={`Loading ${label.toLowerCase()}…`} />;
    if (error) return <ErrorState error={error} onRetry={refetch} />;
    if (visible.length === 0) {
      if (shownCategory === RECENT && !shownQuery) {
        return (
          <EmptyState icon="time-outline" title="Nothing watched yet" message={`${label} you watch will show up here.`} />
        );
      }
      return shownCategory === FAVORITES && !shownQuery ? (
        <EmptyState icon="heart-outline" title={`No favorite ${label.toLowerCase()}`} message="Open a title and tap the heart to save it here." />
      ) : (
        <EmptyState icon="film-outline" title={`No ${label.toLowerCase()} found`} />
      );
    }
    return (
      <FlatList
        ref={gridRef}
        key={`grid-${columns}`}
        data={visible}
        numColumns={columns}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: spacing.lg, gap: rowGap }}
        initialNumToRender={columns * 3}
        maxToRenderPerBatch={columns * 2}
        updateCellsBatchingPeriod={30}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
      />
    );
  };

  const search = (
    <SearchInput value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}`} style={isTV ? styles.searchTV : styles.search} />
  );
  const sortButton = (
    <IconButton icon="swap-vertical" label="Sort" onPress={() => setShowSort((v) => !v)} color={showSort ? colors.primary : colors.text} />
  );

  const gridArea = isTV ? (
    <TVFocusGuideView style={{ flex: 1 }} destinations={firstCell ? [firstCell] : undefined}>
      {body()}
    </TVFocusGuideView>
  ) : (
    <View style={{ flex: 1 }}>{body()}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={label}
        subtitle={items.length ? `${items.length.toLocaleString()} titles` : undefined}
        right={
          isTV ? (
            <>
              {search}
              {sortButton}
            </>
          ) : (
            sortButton
          )
        }
      />
      {!isTV && search}
      {showSort && (
        <View style={styles.sort}>
          <Segmented options={SORT_OPTIONS} value={sort} onChange={(v) => setSettings({ [sortKey]: v })} />
        </View>
      )}
      {isWide ? (
        <View style={styles.split}>
          <CategoryPicker variant="sidebar" categories={pickerCategories} selected={selected} onSelect={choose} focusFirstSignal={focusSignal} />
          {gridArea}
        </View>
      ) : (
        <>
          <CategoryPicker variant="chips" categories={pickerCategories} selected={selected} onSelect={choose} focusFirstSignal={focusSignal} />
          {gridArea}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  searchTV: { width: 340 },
  sort: { marginBottom: spacing.md },
  split: { flex: 1, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
