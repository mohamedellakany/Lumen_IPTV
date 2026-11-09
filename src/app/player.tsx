import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Episode, LiveChannel } from '@/api/types';
import { Button, IconButton } from '@/components/Button';
import { CHANNEL_ROW_HEIGHT, ChannelRow } from '@/components/ChannelRow';
import { ProgressBar } from '@/components/ProgressBar';
import { LoadingState } from '@/components/StateViews';
import { VideoSurface } from '@/components/player/VideoSurface';
import { ResumePrompt } from '@/components/player/ResumePrompt';
import { VodPlayer } from '@/components/player/VodPlayer';
import { checkStream, describePlayerError, findAlternativeStream } from '@/api/streamCheck';
import { useCatalog, useMovieInfo, useProvider, useSeriesInfo, useShortEpg } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { useNow } from '@/hooks/useNow';
import { useRemoteKeys } from '@/hooks/useRemoteKeys';
import { isWatched, keyOf, libraryActions, useIsFavorite, useLibrary, useLibraryStore, type MediaRef } from '@/store/library';
import { useActiveProfile, useProfiles } from '@/store/profiles';
import { useSettings } from '@/store/settings';
import { colors, radius, spacing } from '@/theme';
import { formatClock } from '@/utils/format';
import { Text } from '@/components/Text';

type Params = {
  kind: 'live' | 'movie' | 'episode';
  id: string;
  categoryId?: string;
  list?: string;
  seriesId?: string;
  restart?: string;
};

interface Playable {
  uri: string;
  title: string;
  subtitle?: string;
  image?: string;
  ref: MediaRef;
  isLive: boolean;
}

// iOS (AVPlayer) can't play raw MPEG-TS, so live streams always use HLS there.
const forcedHls = Platform.OS === 'ios';
// From this many seconds in, reopening a movie/episode asks "Resume or start from beginning?".
const MIN_RESUME_PROMPT = 60;

export default function PlayerScreen() {
  const { kind, id, categoryId, list, seriesId, restart } = useLocalSearchParams<Params>();
  const router = useRouter();
  const { provider } = useProvider();
  const isXtream = useActiveProfile()?.type === 'xtream';
  const { width, height, isWide, isTV } = useLayout();
  const library = useLibrary();
  const liveFormat = useSettings((s) => s.liveFormat);
  const autoplayNext = useSettings((s) => s.autoplayNext);
  const setSettings = useSettings((s) => s.set);
  const [failure, setFailure] = useState<{ key: string; message: string; detail?: string; searching?: boolean } | null>(null);
  // A working URL found by trying other file types, for the item it belongs to.
  const [altUri, setAltUri] = useState<{ key: string; uri: string } | null>(null);
  const altTried = useRef(new Set<string>());
  const [attempt, setAttempt] = useState(0);
  const [showChannels, setShowChannels] = useState(isWide);
  const [fullscreen, setFullscreen] = useState(false);
  const [info, setInfo] = useState({ visible: false, tick: 0 });
  const lastDuration = useRef(0);
  const autoRetry = useRef<{ uri: string; count: number; since: number } | null>(null);

  const live = useCatalog('live', kind === 'live');
  const movies = useCatalog('movie', kind === 'movie');
  const movieInfo = useMovieInfo(kind === 'movie' ? id : undefined);
  const seriesInfo = useSeriesInfo(kind === 'episode' ? seriesId : undefined);

  // ----- Resolve the current item -----
  const channel = useMemo<LiveChannel | undefined>(() => {
    if (kind !== 'live') return undefined;
    const found = live.byId.get(id);
    if (found) return found;
    // Xtream URLs can be built from the id alone, so favorites/history still play before the catalog loads.
    const ref = library.favorites[`live:${id}`] ?? library.recents.find((r) => r.kind === 'live' && r.id === id);
    if (ref && isXtream) {
      return { kind: 'live', id, name: ref.name, logo: ref.image, categoryId: ref.categoryId ?? '' };
    }
    return undefined;
  }, [kind, id, live.byId, library.favorites, library.recents, isXtream]);

  const episodes = useMemo(() => seriesInfo.data?.seasons.flatMap((s) => s.episodes) ?? [], [seriesInfo.data]);
  const episodeIndex = episodes.findIndex((e) => e.id === id);
  const episode: Episode | undefined = episodes[episodeIndex];
  const nextEpisode: Episode | undefined = episodeIndex >= 0 ? episodes[episodeIndex + 1] : undefined;

  const basePlayable = useMemo<Playable | null>(() => {
    if (!provider) return null;
    if (kind === 'live' && channel) {
      return {
        uri: provider.liveUrl(channel, forcedHls ? 'm3u8' : liveFormat),
        title: channel.name,
        image: channel.logo,
        isLive: true,
        ref: { kind: 'live', id: channel.id, name: channel.name, image: channel.logo, categoryId: channel.categoryId },
      };
    }
    if (kind === 'movie') {
      const movie = movies.byId.get(id);
      if (!movie && movieInfo.isLoading) return null;
      if (!movie && !movieInfo.data) return null;
      const name = movie?.name ?? movieInfo.data!.name;
      const image = movieInfo.data?.poster ?? movie?.poster;
      return {
        uri: provider.movieUrl({ id, ext: movie?.ext ?? movieInfo.data?.ext, directUrl: movie?.directUrl ?? movieInfo.data?.directUrl }),
        title: name,
        image,
        isLive: false,
        ref: { kind: 'movie', id, name, image, categoryId: movie?.categoryId },
      };
    }
    if (kind === 'episode' && episode && seriesInfo.data) {
      const seriesName = seriesInfo.data.name;
      return {
        uri: provider.episodeUrl(episode),
        title: seriesName,
        subtitle: `S${episode.season} E${episode.episodeNum} · ${episode.title}`,
        image: episode.image ?? seriesInfo.data.poster,
        isLive: false,
        ref: {
          kind: 'episode',
          id: episode.id,
          name: episode.title,
          image: episode.image || seriesInfo.data.poster,
          seriesId,
          seriesName,
          season: episode.season,
          episodeNum: episode.episodeNum,
        },
      };
    }
    return null;
  }, [provider, kind, channel, liveFormat, movies.byId, id, movieInfo.isLoading, movieInfo.data, episode, seriesInfo.data, seriesId]);

  const itemKey = basePlayable ? keyOf(basePlayable.ref) : null;
  const playable = useMemo(
    () => (basePlayable && altUri && altUri.key === itemKey ? { ...basePlayable, uri: altUri.uri } : basePlayable),
    [basePlayable, altUri, itemKey],
  );
  const favoriteRef =
    kind === 'episode' && seriesInfo.data
      ? { kind: 'series' as const, id: seriesId ?? '', name: seriesInfo.data.name, image: seriesInfo.data.poster }
      : playable?.ref;
  const favorite = useIsFavorite(favoriteRef?.kind ?? 'live', favoriteRef?.id ?? '');

  // Resume position is read once per item, so saving progress doesn't re-trigger seeking.
  const resume = useMemo(() => {
    if (!itemKey || restart === '1') return undefined;
    const profileId = useProfiles.getState().activeId;
    const progress = profileId ? useLibraryStore.getState().libraries[profileId]?.progress[itemKey] : undefined;
    // Any stop from a minute in counts (not only the "in progress" range used for Continue Watching),
    // except when it was basically finished.
    if (!progress?.duration || progress.position < MIN_RESUME_PROMPT || isWatched(progress)) return undefined;
    return { position: progress.position, duration: progress.duration };
  }, [itemKey, restart]);
  // Movies/episodes watched for a while ask "Resume or start over?" before playing. The answer is kept
  // per item, so retries and alternative streams of the same title don't ask again.
  const [resumeChoice, setResumeChoice] = useState<{ key: string; at: number } | null>(null);
  const askResume = !!itemKey && !!resume && resume.position >= MIN_RESUME_PROMPT && resumeChoice?.key !== itemKey;
  const startAt = resumeChoice?.key === itemKey ? resumeChoice.at : resume?.position;

  useEffect(() => {
    if (playable) libraryActions().addRecent(playable.ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record once per item
  }, [itemKey]);

  // ----- Live channel zapping -----
  const zapList = useMemo<LiveChannel[]>(() => {
    if (kind !== 'live') return [];
    if (list === 'favorites') {
      return Object.values(library.favorites).flatMap((f) => (f.kind === 'live' && live.byId.get(f.id) ? [live.byId.get(f.id)!] : []));
    }
    const category = categoryId || channel?.categoryId;
    return category ? live.items.filter((c) => c.categoryId === category) : live.items;
  }, [kind, list, library.favorites, live.byId, live.items, categoryId, channel?.categoryId]);

  const zap = useCallback(
    (offset: number) => {
      if (!zapList.length) return;
      const index = zapList.findIndex((c) => c.id === id);
      const next = zapList[(index + offset + zapList.length) % zapList.length];
      router.setParams({ id: next.id });
    },
    [zapList, id, router],
  );

  const epg = useShortEpg(kind === 'live' ? channel : undefined);
  const now = useNow();
  const nowPlaying = epg.data?.find((e) => e.start <= now && e.end > now);
  const upNext = epg.data?.find((e) => e.start >= (nowPlaying?.end ?? now));

  // ----- Live fullscreen (OK on the playing channel, like IPTV Smarters) -----
  const flashInfo = useCallback(() => setInfo((i) => ({ visible: true, tick: i.tick + 1 })), []);
  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    flashInfo();
  }, [flashInfo]);

  useEffect(() => {
    if (!info.visible) return;
    const timer = setTimeout(() => setInfo((i) => ({ ...i, visible: false })), 4000);
    return () => clearTimeout(timer);
  }, [info]);

  useEffect(() => {
    if (!fullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [fullscreen]);

  useRemoteKeys((key) => {
    if (!fullscreen) return;
    if (key === 'back') setFullscreen(false);
    else if (key === 'up' || key === 'down') {
      zap(key === 'up' ? -1 : 1);
      flashInfo();
    } else flashInfo();
  }, kind === 'live');

  const onChannelPress = useCallback(
    (c: LiveChannel) => (c.id === id ? enterFullscreen() : router.setParams({ id: c.id })),
    [id, enterFullscreen, router],
  );

  // ----- Callbacks -----
  const onProgress = useCallback(
    (position: number, duration: number) => {
      if (!itemKey || !duration) return;
      lastDuration.current = duration;
      libraryActions().saveProgress(itemKey, position, duration);
    },
    [itemKey],
  );

  // Marks the item watched. Moving on to the next episode is handled by the player's "Next episode" card.
  const onEnded = useCallback(() => {
    if (itemKey && lastDuration.current) libraryActions().saveProgress(itemKey, lastDuration.current, lastDuration.current);
  }, [itemKey]);

  // Errors belong to a specific stream attempt, so switching channel or retrying clears them.
  const streamKey = playable ? `${playable.uri}#${attempt}` : '';
  const failed = failure?.key === streamKey ? failure : null;
  const error = failed?.message ?? null;
  const onError = useCallback(
    (message: string) => {
      // Live streams drop out now and then (server hiccups, expired tokens). Restart the channel
      // quietly a few times per minute before bothering the viewer with an error screen.
      if (playable?.isLive) {
        const now = Date.now();
        const prev = autoRetry.current;
        const count = prev && prev.uri === playable.uri && now - prev.since < 60_000 ? prev.count : 0;
        if (count < 3) {
          autoRetry.current = { uri: playable.uri, count: count + 1, since: count === 0 ? now : prev!.since };
          setTimeout(() => setAttempt((a) => a + 1), 1000 * (count + 1));
          return;
        }
      }
      const explain = () => {
        // Show a readable explanation right away, then refine it with what the server actually returned.
        setFailure({ key: streamKey, ...describePlayerError(message) });
        if (playable) {
          checkStream(playable.uri).then((problem) => {
            if (problem) setFailure((f) => (f?.key === streamKey ? { key: streamKey, ...problem } : f));
          });
        }
      };
      // Movies/episodes: the panel may list the wrong file type. Quietly try the others first.
      if (playable && !playable.isLive && itemKey && !altTried.current.has(itemKey)) {
        altTried.current.add(itemKey);
        setFailure({ key: streamKey, message: 'Trying another version of this video…', searching: true });
        findAlternativeStream(playable.uri).then((alt) => {
          if (alt) setAltUri({ key: itemKey, uri: alt });
          else explain();
        });
        return;
      }
      explain();
    },
    [streamKey, playable, itemKey],
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const loading = !playable && (live.isLoading || movies.isLoading || movieInfo.isLoading || seriesInfo.isLoading);
  const isLandscape = width > height;

  const errorOverlay = error && (
    <View style={styles.overlay}>
      {failed?.searching ? (
        <ActivityIndicator size="large" color={colors.text} />
      ) : (
        <Ionicons name="alert-circle-outline" size={42} color={colors.danger} />
      )}
      <Text style={styles.errorText}>{error}</Text>
      {!!failed?.detail && (
        <Text style={styles.errorDetail} numberOfLines={3}>
          {failed.detail}
        </Text>
      )}
      <View style={styles.errorActions}>
        {!failed?.searching && <Button title="Retry" icon="refresh" preferredFocus onPress={() => setAttempt((a) => a + 1)} />}
        {kind === 'live' && !forcedHls && provider && (
          <Button
            title={`Try ${liveFormat === 'm3u8' ? 'MPEG-TS' : 'HLS'}`}
            variant="secondary"
            onPress={() => setSettings({ liveFormat: liveFormat === 'm3u8' ? 'ts' : 'm3u8' })}
          />
        )}
        <Button title="Back" variant="secondary" onPress={goBack} />
      </View>
    </View>
  );

  if (kind !== 'live') {
    return (
      <View style={styles.safe}>
        <StatusBar hidden style="light" />
        {playable && askResume && resume && itemKey ? (
          <ResumePrompt
            title={playable.title}
            subtitle={playable.subtitle}
            artwork={playable.image}
            position={resume.position}
            duration={resume.duration}
            onResume={() => setResumeChoice({ key: itemKey, at: resume.position })}
            onRestart={() => setResumeChoice({ key: itemKey, at: 0 })}
            onBack={goBack}
          />
        ) : playable ? (
          <VodPlayer
            key={streamKey}
            uri={playable.uri}
            title={playable.title}
            subtitle={playable.subtitle}
            artwork={playable.image}
            startAt={startAt}
            onProgress={onProgress}
            onEnded={onEnded}
            onError={onError}
            onBack={goBack}
            next={
              nextEpisode
                ? {
                    label: `Next: E${nextEpisode.episodeNum}`,
                    onPress: () => router.setParams({ id: nextEpisode.id, restart: '' }),
                    title: `S${nextEpisode.season} E${nextEpisode.episodeNum} · ${nextEpisode.title}`,
                    image: nextEpisode.image ?? playable.image,
                    autoplay: autoplayNext,
                  }
                : undefined
            }
            favorite={favoriteRef ? { active: favorite, onToggle: () => libraryActions().toggleFavorite(favoriteRef) } : undefined}
            episodes={
              kind === 'episode'
                ? episodes.map((e) => ({
                    id: e.id,
                    title: `S${e.season} E${e.episodeNum} · ${e.title}`,
                    subtitle: isWatched(library.progress[`episode:${e.id}`]) ? 'Watched' : undefined,
                    active: e.id === id,
                  }))
                : undefined
            }
            onSelectEpisode={(episodeId) => router.setParams({ id: episodeId, restart: '' })}
          />
        ) : (
          <>
            {loading ? (
              <LoadingState message="Preparing stream…" />
            ) : (
              <View style={styles.overlay}>
                <Text style={styles.errorText}>This item is no longer available.</Text>
                <Button title="Go back" variant="secondary" onPress={goBack} />
              </View>
            )}
            <IconButton icon="chevron-back" label="Back" onPress={goBack} style={styles.floatingBack} />
          </>
        )}
        {errorOverlay}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={isLandscape ? ['left', 'right'] : ['top', 'bottom', 'left', 'right']}>
      <StatusBar hidden={isLandscape || fullscreen} style="light" />
      {!fullscreen && (
        <View style={styles.topBar}>
          <IconButton icon="chevron-back" label="Back" onPress={goBack} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {playable?.title ?? ''}
            </Text>
            {!!(playable?.subtitle ?? nowPlaying?.title) && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {playable?.subtitle ?? nowPlaying?.title}
              </Text>
            )}
          </View>
          {kind === 'live' && zapList.length > 1 && (
            <>
              <IconButton icon="play-skip-back" label="Previous channel" onPress={() => zap(-1)} />
              <IconButton icon="play-skip-forward" label="Next channel" onPress={() => zap(1)} />
              <IconButton
                icon="list"
                label="Channel list"
                color={showChannels ? colors.primary : colors.text}
                onPress={() => setShowChannels((v) => !v)}
              />
            </>
          )}
          {playable && <IconButton icon="expand" label="Full screen" onPress={enterFullscreen} />}
          {favoriteRef && (
            <IconButton
              icon={favorite ? 'heart' : 'heart-outline'}
              color={favorite ? colors.accent : colors.text}
              label={favorite ? 'Remove from My List' : 'Add to My List'}
              onPress={() => libraryActions().toggleFavorite(favoriteRef)}
            />
          )}
        </View>
      )}

      <View style={[styles.body, isWide && { flexDirection: 'row' }]}>
        <View style={styles.videoArea}>
          {playable ? (
            <VideoSurface
              key={streamKey}
              uri={playable.uri}
              isLive={playable.isLive}
              controls={fullscreen || isTV ? 'none' : 'native'}
              title={playable.subtitle ? `${playable.title} · ${playable.subtitle}` : playable.title}
              artwork={playable.image}
              startAt={startAt}
              onProgress={onProgress}
              onEnded={onEnded}
              onError={onError}
            />
          ) : loading ? (
            <LoadingState message="Preparing stream…" />
          ) : (
            <View style={styles.overlay}>
              <Text style={styles.errorText}>This item is no longer available.</Text>
              <Button title="Go back" variant="secondary" onPress={goBack} />
            </View>
          )}
          {fullscreen && (
            // On TV this holds the remote's focus in full screen; without a focused view Android
            // doesn't deliver ▲/▼/OK to the app.
            <Pressable
              accessibilityLabel="Show channel info"
              focusable={isTV}
              hasTVPreferredFocus={isTV}
              style={StyleSheet.absoluteFill}
              onPress={flashInfo}
            />
          )}
          {fullscreen && info.visible && channel && (
            <View pointerEvents="box-none" style={styles.infoBar}>
              {channel.num !== undefined && <Text style={styles.infoNum}>{channel.num}</Text>}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.infoName} numberOfLines={1}>
                  {channel.name}
                </Text>
                {nowPlaying ? (
                  <>
                    <Text style={styles.infoNow} numberOfLines={1}>
                      {formatClock(nowPlaying.start)} – {formatClock(nowPlaying.end)} {nowPlaying.title}
                    </Text>
                    <ProgressBar value={(now - nowPlaying.start) / (nowPlaying.end - nowPlaying.start)} style={{ maxWidth: 360 }} />
                    {upNext && (
                      <Text style={styles.infoNext} numberOfLines={1}>
                        Next {formatClock(upNext.start)} {upNext.title}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.infoNext}>{isTV ? '▲ ▼ change channel · Back to exit full screen' : 'No programme information'}</Text>
                )}
              </View>
              {!isTV && <IconButton icon="contract" label="Exit full screen" onPress={() => setFullscreen(false)} />}
            </View>
          )}
          {errorOverlay}
        </View>

        {kind === 'live' && !fullscreen && showChannels && zapList.length > 1 && (
          <View style={[styles.channelPanel, isWide ? styles.channelPanelWide : styles.channelPanelNarrow]}>
            <FlatList
              data={zapList}
              keyExtractor={(c) => c.id}
              initialScrollIndex={Math.max(
                0,
                zapList.findIndex((c) => c.id === id),
              )}
              getItemLayout={(_, index) => ({ length: CHANNEL_ROW_HEIGHT, offset: CHANNEL_ROW_HEIGHT * index, index })}
              renderItem={({ item }) => (
                <ChannelRow
                  channel={item}
                  active={item.id === id}
                  preferredFocus={item.id === id}
                  favorite={!!library.favorites[`live:${item.id}`]}
                  onPress={onChannelPress}
                  onToggleFavorite={(c) =>
                    libraryActions().toggleFavorite({ kind: 'live', id: c.id, name: c.name, image: c.logo, categoryId: c.categoryId })
                  }
                />
              )}
            />
          </View>
        )}
      </View>

      {kind === 'live' && !fullscreen && nowPlaying && !(showChannels && !isWide) && (
        <View style={styles.epg}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.epgLabel}>
              NOW · {formatClock(nowPlaying.start)} – {formatClock(nowPlaying.end)}
            </Text>
            <Text style={styles.epgTitle} numberOfLines={1}>
              {nowPlaying.title}
            </Text>
            <ProgressBar value={(now - nowPlaying.start) / (nowPlaying.end - nowPlaying.start)} style={{ maxWidth: 320 }} />
          </View>
          {upNext && (
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.epgLabel}>NEXT · {formatClock(upNext.start)}</Text>
              <Text style={styles.epgNext} numberOfLines={1}>
                {upNext.title}
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  body: { flex: 1 },
  videoArea: { flex: 1, backgroundColor: '#000' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorText: { color: colors.text, fontSize: 15, textAlign: 'center', maxWidth: 420, lineHeight: 21 },
  errorDetail: { color: colors.textMuted, fontSize: 11, textAlign: 'center', maxWidth: 560, lineHeight: 15 },
  errorActions: { flexDirection: 'row', gap: spacing.sm },
  channelPanel: { backgroundColor: colors.bg },
  channelPanelWide: { width: 340, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  channelPanelNarrow: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  epg: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  epgLabel: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  epgTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  epgNext: { color: colors.textDim, fontSize: 14 },
  floatingBack: { position: 'absolute', top: spacing.lg, left: spacing.lg, backgroundColor: 'rgba(0,0,0,0.5)' },
  infoBar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(11,20,23,0.88)',
  },
  infoNum: { color: colors.primary, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  infoName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  infoNow: { color: colors.text, fontSize: 14 },
  infoNext: { color: colors.textDim, fontSize: 13 },
});
