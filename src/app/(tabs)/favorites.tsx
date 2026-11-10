import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LiveChannel } from '@/api/types';
import { Artwork } from '@/components/Artwork';
import { IconButton } from '@/components/Button';
import { CHANNEL_ROW_HEIGHT, ChannelRow } from '@/components/ChannelRow';
import { PosterCard } from '@/components/PosterCard';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Segmented } from '@/components/Segmented';
import { EmptyState } from '@/components/StateViews';
import { useLayout } from '@/hooks/useLayout';
import { inProgressFraction, keyOf, libraryActions, useLibrary, type MediaRef } from '@/store/library';
import { colors, radius, spacing } from '@/theme';
import { openMedia } from '@/utils/navigation';
import { Text } from '@/components/Text';
import { ThemeBackdrop } from '@/components/ThemeBackdrop';

type Tab = 'live' | 'movie' | 'series' | 'history';

const KIND_LABEL: Record<MediaRef['kind'], string> = { live: 'Channel', movie: 'Movie', series: 'Series', episode: 'Episode' };

function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const library = useLibrary();
  const { columns, posterWidth, gap } = useLayout();
  const [tab, setTab] = useState<Tab>('live');

  const favorites = useMemo(
    () => Object.values(library.favorites).sort((a, b) => b.addedAt - a.addedAt),
    [library.favorites],
  );
  const byKind = useMemo(() => favorites.filter((f) => f.kind === tab), [favorites, tab]);

  const clearHistory = () => {
    const run = () => libraryActions().clearHistory();
    if (Platform.OS === 'web') {
      if (window.confirm('Clear watch history and resume positions?')) run();
    } else {
      Alert.alert('Clear history', 'Clear watch history and resume positions?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: run },
      ]);
    }
  };

  const content = () => {
    if (tab === 'history') {
      if (!library.recents.length) return <EmptyState icon="time-outline" title="Nothing watched yet" message="Channels, movies and episodes you play will show up here." />;
      return (
        <FlatList
          data={library.recents}
          keyExtractor={keyOf}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderItem={({ item }) => {
            const progress = inProgressFraction(library.progress[keyOf(item)]);
            return (
              <Pressable onPress={() => openMedia(router, item)} style={({ pressed, focused }) => [styles.historyRow, pressed && { opacity: 0.7 }, focused && styles.historyFocused]}>
                <Artwork uri={item.image} name={item.name} style={styles.historyImage} contentFit={item.kind === 'live' ? 'contain' : 'cover'} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.kind === 'episode' ? item.seriesName : item.name}
                  </Text>
                  <Text style={styles.historyMeta} numberOfLines={1}>
                    {item.kind === 'episode' ? `S${item.season} E${item.episodeNum} · ${item.name}` : KIND_LABEL[item.kind]} · {timeAgo(item.watchedAt)}
                  </Text>
                  {progress !== undefined && <ProgressBar value={progress} style={{ marginTop: 4, maxWidth: 200 }} />}
                </View>
                <IconButton icon="close" size={18} color={colors.textMuted} label="Remove from history" onPress={() => libraryActions().removeRecent(keyOf(item))} />
              </Pressable>
            );
          }}
        />
      );
    }

    if (!byKind.length) {
      return <EmptyState icon="heart-outline" title="Nothing here yet" message="Tap the heart on any channel, movie or series to add it to your list." />;
    }

    if (tab === 'live') {
      return (
        <FlatList
          data={byKind}
          keyExtractor={keyOf}
          getItemLayout={(_, index) => ({ length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index })}
          renderItem={({ item }) => {
            const channel: LiveChannel = { kind: 'live', id: item.id, name: item.name, logo: item.image, categoryId: item.categoryId ?? '' };
            return (
              <ChannelRow
                channel={channel}
                favorite
                onPress={() => router.push({ pathname: '/player', params: { kind: 'live', id: item.id, list: 'favorites' } })}
                onToggleFavorite={() => libraryActions().toggleFavorite(item)}
              />
            );
          }}
        />
      );
    }

    return (
      <FlatList
        key={`fav-grid-${columns}`}
        data={byKind}
        numColumns={columns}
        keyExtractor={keyOf}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        renderItem={({ item }) => (
          <PosterCard
            title={item.name}
            image={item.image}
            width={posterWidth}
            onPress={() => openMedia(router, item)}
            onLongPress={() => libraryActions().toggleFavorite(item)}
          />
        )}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ThemeBackdrop />
      <ScreenHeader
        title="My List"
        right={tab === 'history' && library.recents.length > 0 ? <IconButton icon="trash-outline" label="Clear history" onPress={clearHistory} /> : undefined}
      />
      <View style={styles.tabs}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'live', label: 'Channels' },
            { value: 'movie', label: 'Movies' },
            { value: 'series', label: 'Series' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>
      {content()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  tabs: { marginBottom: spacing.md },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  historyImage: { width: 96, height: 54, borderRadius: radius.sm },
  historyTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  historyFocused: { backgroundColor: colors.surfaceAlt },
  historyMeta: { color: colors.textMuted, fontSize: 12 },
});
