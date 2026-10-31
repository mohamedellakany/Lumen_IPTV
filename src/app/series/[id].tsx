import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Episode } from '@/api/types';
import { Artwork } from '@/components/Artwork';
import { Button, IconButton } from '@/components/Button';
import { DetailHero } from '@/components/DetailHero';
import { InfoSection } from '@/components/InfoSection';
import { ProgressBar } from '@/components/ProgressBar';
import { Segmented } from '@/components/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateViews';
import { useCatalog, useSeriesInfo } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { resetFocus, useRememberedFocus } from '@/hooks/useRememberedFocus';
import { inProgressFraction, isWatched, libraryActions, useIsFavorite, useLibrary, type Progress } from '@/store/library';
import { colors, radius, spacing } from '@/theme';
import { formatDuration, yearOf } from '@/utils/format';

export default function SeriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isTV } = useLayout();
  const playFocus = useRememberedFocus('play', 'series');
  const favFocus = useRememberedFocus('fav', 'series');
  const trailerFocus = useRememberedFocus('trailer', 'series');

  // A newly opened series starts with the remote on Play.
  useEffect(() => resetFocus('series'), [id]);
  const { byId } = useCatalog('series');
  const series = byId.get(id);
  const info = useSeriesInfo(id);
  const library = useLibrary();
  const favorite = useIsFavorite('series', id);

  const seasons = useMemo(() => info.data?.seasons ?? [], [info.data]);
  const allEpisodes = useMemo(() => seasons.flatMap((s) => s.episodes), [seasons]);

  // Where to pick up: the last episode played for this series, or the next one if it was finished.
  const upNext = useMemo(() => {
    const last = library.recents.find((r) => r.kind === 'episode' && r.seriesId === id);
    if (!last) return { episode: allEpisodes[0], resume: false };
    const index = allEpisodes.findIndex((e) => e.id === last.id);
    if (index === -1) return { episode: allEpisodes[0], resume: false };
    if (isWatched(library.progress[`episode:${last.id}`]) && allEpisodes[index + 1]) {
      return { episode: allEpisodes[index + 1], resume: false };
    }
    return { episode: allEpisodes[index], resume: true };
  }, [library.recents, library.progress, allEpisodes, id]);

  const [season, setSeason] = useState<number | null>(null);
  const activeSeason = season ?? upNext.episode?.season ?? seasons[0]?.number;
  const episodes = seasons.find((s) => s.number === activeSeason)?.episodes ?? [];

  if (info.isLoading && !series) return <LoadingState />;
  if (info.error) return <ErrorState error={info.error} onRetry={info.refetch} />;

  const name = info.data?.name && info.data.name !== 'Untitled' ? info.data.name : (series?.name ?? '');
  const poster = info.data?.poster ?? series?.poster;

  const play = (episode: Episode) => router.push({ pathname: '/player', params: { kind: 'episode', id: episode.id, seriesId: id } });

  const toggleFavorite = () => libraryActions().toggleFavorite({ kind: 'series', id, name, image: poster, categoryId: series?.categoryId });

  const rating = info.data?.rating ?? series?.rating;
  const meta = [
    yearOf(info.data?.releaseDate) ?? series?.year,
    seasons.length ? `${seasons.length} season${seasons.length === 1 ? '' : 's'}` : undefined,
  ];

  // TV: everything on one screen, with the selected season's episodes in a single row (◀ ▶ to browse).
  if (isTV) {
    const plot = info.data?.plot ?? series?.plot;
    const credits = (
      [
        ['Cast', info.data?.cast],
        ['Director', info.data?.director],
      ] as const
    ).filter(([, value]) => !!value);
    const startIndex = Math.max(
      0,
      episodes.findIndex((e) => e.id === upNext.episode?.id),
    );
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Artwork uri={info.data?.backdrop || poster} name={name} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(11,13,18,0.97)', 'rgba(11,13,18,0.85)', 'rgba(11,13,18,0.35)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(11,13,18,0.75)', colors.bg]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.tvTop}>
          <Artwork uri={poster} name={name} style={styles.tvPoster} />
          <View style={styles.tvInfo}>
            <Text style={styles.tvTitle} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.tvMetaRow}>
              {!!rating && rating > 0 && (
                <View style={styles.tvRating}>
                  <Ionicons name="star" size={13} color={colors.warning} />
                  <Text style={styles.tvRatingText}>{rating.toFixed(1)}</Text>
                </View>
              )}
              {meta.filter(Boolean).map((m) => (
                <Text key={m} style={styles.tvMeta}>
                  {m}
                </Text>
              ))}
              {!!(info.data?.genre ?? series?.genre) && (
                <Text style={styles.tvGenre} numberOfLines={1}>
                  {info.data?.genre ?? series?.genre}
                </Text>
              )}
            </View>
            <View style={styles.tvActions}>
              {upNext.episode && (
                <Button
                  title={`${upNext.resume ? 'Resume' : 'Play'} S${upNext.episode.season} E${upNext.episode.episodeNum}`}
                  icon="play"
                  onPress={() => play(upNext.episode!)}
                  style={styles.playButton}
                  preferredFocus
                  {...playFocus}
                />
              )}
              <IconButton
                icon={favorite ? 'heart' : 'heart-outline'}
                color={favorite ? colors.accent : colors.text}
                label={favorite ? 'Remove from My List' : 'Add to My List'}
                onPress={toggleFavorite}
                style={styles.iconAction}
                {...favFocus}
              />
              {!!info.data?.trailer && (
                <IconButton
                  icon="logo-youtube"
                  label="Watch trailer"
                  onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${info.data!.trailer}`)}
                  style={styles.iconAction}
                  {...trailerFocus}
                />
              )}
            </View>
            {!!plot && (
              <Text style={styles.tvPlot} numberOfLines={3}>
                {plot}
              </Text>
            )}
            {credits.map(([label, value]) => (
              <Text key={label} style={styles.tvCredit} numberOfLines={1}>
                <Text style={styles.tvCreditLabel}>{label}: </Text>
                {value}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.tvEpisodes}>
          {info.isLoading ? (
            <Text style={styles.tvCredit}>Loading episodes…</Text>
          ) : seasons.length === 0 ? (
            <Text style={styles.tvCredit}>No episodes available</Text>
          ) : (
            <>
              <View style={styles.tvSeasons}>
                <Segmented
                  value={String(activeSeason)}
                  onChange={(v) => setSeason(Number(v))}
                  options={seasons.map((s) => ({ value: String(s.number), label: `${s.name} · ${s.episodes.length}` }))}
                />
              </View>
              <FlatList
                key={`season-${activeSeason}`}
                horizontal
                data={episodes}
                keyExtractor={(e) => e.id}
                initialScrollIndex={startIndex}
                getItemLayout={(_, index) => ({ length: EPISODE_CARD + spacing.md, offset: (EPISODE_CARD + spacing.md) * index, index })}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tvEpisodeList}
                renderItem={({ item }) => (
                  <EpisodeCard episode={item} fallbackImage={poster} progress={library.progress[`episode:${item.id}`]} onPlay={play} />
                )}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <DetailHero
        title={name}
        poster={poster}
        backdrop={info.data?.backdrop}
        rating={rating}
        genre={info.data?.genre ?? series?.genre}
        meta={meta}
      >
        <View style={styles.actions}>
          {upNext.episode && (
            <Button
              title={`${upNext.resume ? 'Resume' : 'Play'} S${upNext.episode.season} E${upNext.episode.episodeNum}`}
              icon="play"
              onPress={() => play(upNext.episode!)}
              style={styles.playButton}
            />
          )}
          <IconButton
            icon={favorite ? 'heart' : 'heart-outline'}
            color={favorite ? colors.accent : colors.text}
            label={favorite ? 'Remove from My List' : 'Add to My List'}
            onPress={toggleFavorite}
            style={styles.iconAction}
          />
          {!!info.data?.trailer && (
            <IconButton
              icon="logo-youtube"
              label="Watch trailer"
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${info.data!.trailer}`)}
              style={styles.iconAction}
            />
          )}
        </View>
      </DetailHero>

      <InfoSection
        plot={info.data?.plot ?? series?.plot}
        rows={[
          ['Cast', info.data?.cast],
          ['Director', info.data?.director],
        ]}
      />

      <View style={styles.episodesHeader}>
        <Text style={styles.sectionTitle}>Episodes</Text>
      </View>
      {info.isLoading ? (
        <View style={{ height: 160 }}>
          <LoadingState message="Loading episodes…" />
        </View>
      ) : seasons.length === 0 ? (
        <EmptyState icon="albums-outline" title="No episodes available" />
      ) : (
        <>
          <Segmented
            value={String(activeSeason)}
            onChange={(v) => setSeason(Number(v))}
            options={seasons.map((s) => ({ value: String(s.number), label: `${s.name} · ${s.episodes.length}` }))}
          />
          {/* Same as TV: the selected season's episodes side by side in one scrollable row. */}
          <FlatList
            key={`season-${activeSeason}`}
            horizontal
            data={episodes}
            keyExtractor={(e) => e.id}
            initialScrollIndex={Math.max(
              0,
              episodes.findIndex((e) => e.id === upNext.episode?.id),
            )}
            getItemLayout={(_, index) => ({ length: EPISODE_CARD + spacing.md, offset: (EPISODE_CARD + spacing.md) * index, index })}
            showsHorizontalScrollIndicator={Platform.OS === 'web'}
            contentContainerStyle={styles.episodeRow}
            renderItem={({ item }) => (
              <EpisodeCard episode={item} fallbackImage={poster} progress={library.progress[`episode:${item.id}`]} onPlay={play} />
            )}
          />
        </>
      )}
    </ScrollView>
  );
}

const EPISODE_CARD = 176;

const EpisodeCard = memo(function EpisodeCard({
  episode,
  fallbackImage,
  progress,
  onPlay,
}: {
  episode: Episode;
  fallbackImage?: string;
  progress?: Progress;
  onPlay: (episode: Episode) => void;
}) {
  const { ref, onFocus } = useRememberedFocus(`ep:${episode.id}`, 'series');
  const fraction = inProgressFraction(progress);
  const watched = isWatched(progress);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`Episode ${episode.episodeNum}: ${episode.title}`}
      onFocus={onFocus}
      onPress={() => onPlay(episode)}
      style={({ focused, pressed }) => [styles.tvCard, focused && styles.tvCardFocused, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.tvThumbWrap}>
        <Artwork uri={episode.image || fallbackImage} name={episode.title} style={styles.thumb} />
        <View style={styles.tvEpisodeBadge}>
          <Text style={styles.tvEpisodeBadgeText}>E{episode.episodeNum}</Text>
        </View>
        {watched && (
          <View style={styles.playBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
          </View>
        )}
        {fraction !== undefined && <ProgressBar value={fraction} style={styles.thumbProgress} />}
      </View>
      <Text style={styles.tvCardTitle} numberOfLines={1}>
        {episode.title}
      </Text>
      <Text style={styles.tvCardMeta} numberOfLines={1}>
        {[formatDuration(episode.durationSecs), watched && 'Watched'].filter(Boolean).join(' · ') || ' '}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  playButton: { minWidth: 160, paddingHorizontal: spacing.xl },
  iconAction: { backgroundColor: colors.surfaceAlt, padding: 12 },
  episodesHeader: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  episodes: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  episode: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    right: 6,
    bottom: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbProgress: { position: 'absolute', left: 0, right: 0, bottom: 0, borderRadius: 0 },
  tvTop: { flexDirection: 'row', gap: spacing.xl, paddingHorizontal: 40, paddingTop: 28, height: 300 },
  tvPoster: { height: '100%', aspectRatio: 2 / 3, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  tvInfo: { flex: 1, maxWidth: 680, gap: 6, justifyContent: 'center' },
  tvTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  tvMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tvRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tvRatingText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tvMeta: { color: colors.textDim, fontSize: 13 },
  tvGenre: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  tvActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: 4 },
  tvPlot: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  tvCredit: { color: colors.textDim, fontSize: 12 },
  tvCreditLabel: { color: colors.textMuted, fontWeight: '700' },
  tvEpisodes: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.lg },
  tvSeasons: { marginBottom: spacing.sm, marginLeft: 40 - spacing.lg },
  episodeRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.md },
  tvEpisodeList: { paddingHorizontal: 40, gap: spacing.md, paddingVertical: 6 },
  tvCard: { width: EPISODE_CARD, borderRadius: radius.md, padding: 4, borderWidth: 2, borderColor: 'transparent' },
  tvCardFocused: { borderColor: colors.primary, backgroundColor: colors.primaryDim, transform: [{ scale: 1.05 }] },
  tvThumbWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  tvEpisodeBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: colors.overlay,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tvEpisodeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tvCardTitle: { color: colors.text, fontSize: 12, fontWeight: '600', marginTop: 5 },
  tvCardMeta: { color: colors.textMuted, fontSize: 11 },
});
