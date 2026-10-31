import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Artwork } from '@/components/Artwork';
import { Button, IconButton } from '@/components/Button';
import { DetailHero } from '@/components/DetailHero';
import { InfoSection } from '@/components/InfoSection';
import { ProgressBar } from '@/components/ProgressBar';
import { ErrorState, LoadingState } from '@/components/StateViews';
import { useCatalog, useMovieInfo } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { resetFocus, useRememberedFocus } from '@/hooks/useRememberedFocus';
import { inProgressFraction, libraryActions, useIsFavorite, useLibrary } from '@/store/library';
import { colors, radius, spacing } from '@/theme';
import { formatDuration, yearOf } from '@/utils/format';

export default function MovieScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { byId } = useCatalog('movie');
  const movie = byId.get(id);
  const info = useMovieInfo(id);
  const library = useLibrary();
  const favorite = useIsFavorite('movie', id);
  const progress = library.progress[`movie:${id}`];
  const fraction = inProgressFraction(progress);
  const { isTV } = useLayout();
  const playFocus = useRememberedFocus('play', 'movie');
  const restartFocus = useRememberedFocus('restart', 'movie');
  const favFocus = useRememberedFocus('fav', 'movie');
  const trailerFocus = useRememberedFocus('trailer', 'movie');

  // A newly opened movie starts with the remote on Play.
  useEffect(() => resetFocus('movie'), [id]);

  if (info.isLoading && !movie) return <LoadingState />;
  if (info.error && !movie) return <ErrorState error={info.error} onRetry={info.refetch} />;

  const name = info.data?.name ?? movie?.name ?? '';
  const poster = info.data?.poster ?? movie?.poster;

  const play = (fromStart = false) =>
    router.push({ pathname: '/player', params: { kind: 'movie', id, ...(fromStart ? { restart: '1' } : {}) } });

  const toggleFavorite = () =>
    libraryActions().toggleFavorite({ kind: 'movie', id, name, image: poster, categoryId: movie?.categoryId });

  const meta = [yearOf(info.data?.releaseDate), formatDuration(info.data?.durationSecs), (info.data?.ext ?? movie?.ext)?.toUpperCase()];
  const rating = info.data?.rating ?? movie?.rating;

  // TV: everything on one screen (no scrolling), like a streaming app's details page.
  if (isTV) {
    const credits = (
      [
        ['Director', info.data?.director],
        ['Cast', info.data?.cast],
        ['Released', info.data?.releaseDate],
      ] as const
    ).filter(([, value]) => !!value);
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
        <LinearGradient colors={['transparent', 'rgba(11,13,18,0.8)']} style={StyleSheet.absoluteFill} />
        <View style={styles.tvBody}>
          <Artwork uri={poster} name={name} style={styles.tvPoster} />
          <View style={styles.tvInfo}>
            <Text style={styles.tvTitle} numberOfLines={2}>
              {name}
            </Text>
            <View style={styles.tvMetaRow}>
              {!!rating && rating > 0 && (
                <View style={styles.tvRating}>
                  <Ionicons name="star" size={14} color={colors.warning} />
                  <Text style={styles.tvRatingText}>{rating.toFixed(1)}</Text>
                </View>
              )}
              {meta.filter(Boolean).map((m) => (
                <Text key={m} style={styles.tvMeta}>
                  {m}
                </Text>
              ))}
            </View>
            {!!info.data?.genre && (
              <Text style={styles.tvGenre} numberOfLines={1}>
                {info.data.genre}
              </Text>
            )}

            <View style={styles.tvActions}>
              <Button
                title={fraction ? 'Resume' : 'Play'}
                icon="play"
                onPress={() => play()}
                style={styles.playButton}
                preferredFocus
                {...playFocus}
              />
              {fraction !== undefined && (
                <Button title="Start over" icon="refresh" variant="secondary" onPress={() => play(true)} {...restartFocus} />
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
            {fraction !== undefined && <ProgressBar value={fraction} style={styles.tvProgress} />}

            {info.isLoading ? (
              <Text style={styles.tvPlot}>Loading details…</Text>
            ) : (
              <>
                {!!info.data?.plot && (
                  <Text style={styles.tvPlot} numberOfLines={5}>
                    {info.data.plot}
                  </Text>
                )}
                {credits.map(([label, value]) => (
                  <Text key={label} style={styles.tvCredit} numberOfLines={1}>
                    <Text style={styles.tvCreditLabel}>{label}: </Text>
                    {value}
                  </Text>
                ))}
              </>
            )}
          </View>
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
        genre={info.data?.genre}
        meta={meta}
      >
        <View style={styles.actions}>
          <Button
            title={fraction ? 'Resume' : 'Play'}
            icon="play"
            onPress={() => play()}
            style={styles.playButton}
          />
          {fraction !== undefined && <Button title="Start over" icon="refresh" variant="secondary" onPress={() => play(true)} />}
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
        {fraction !== undefined && <ProgressBar value={fraction} style={styles.progress} />}
      </DetailHero>

      {info.isLoading ? (
        <View style={{ height: 120 }}>
          <LoadingState message="" />
        </View>
      ) : (
        <InfoSection
          plot={info.data?.plot}
          rows={[
            ['Director', info.data?.director],
            ['Cast', info.data?.cast],
            ['Released', info.data?.releaseDate],
          ]}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  playButton: { minWidth: 140, paddingHorizontal: spacing.xl },
  iconAction: { backgroundColor: colors.surfaceAlt, padding: 12 },
  progress: { marginTop: spacing.md, maxWidth: 360 },
  tvBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xxl, paddingHorizontal: 48, paddingVertical: 36 },
  tvPoster: {
    height: '100%',
    maxHeight: 420,
    aspectRatio: 2 / 3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tvInfo: { flex: 1, maxWidth: 640, gap: spacing.sm },
  tvTitle: { color: colors.text, fontSize: 28, fontWeight: '800' },
  tvMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tvRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tvRatingText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  tvMeta: { color: colors.textDim, fontSize: 14 },
  tvGenre: { color: colors.textMuted, fontSize: 13 },
  tvActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  tvProgress: { maxWidth: 300 },
  tvPlot: { color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  tvCredit: { color: colors.textDim, fontSize: 12 },
  tvCreditLabel: { color: colors.textMuted, fontWeight: '700' },
});
