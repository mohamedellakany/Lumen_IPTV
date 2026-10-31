import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Movie, Series } from '@/api/types';
import { Artwork } from '@/components/Artwork';
import { IconButton } from '@/components/Button';
import { ExitDialog } from '@/components/ExitDialog';
import { PosterCard } from '@/components/PosterCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Rail } from '@/components/Rail';
import { useAccountInfo, useCatalog, useMovieInfo, useSeriesInfo, recency, useRefreshCatalog, type RefreshResult } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { rememberFocus, useRememberedFocus } from '@/hooks/useRememberedFocus';
import { inProgressFraction, keyOf, useLibrary, type MediaRef } from '@/store/library';
import { useActiveProfile } from '@/store/profiles';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { daysUntil, initials } from '@/utils/format';
import { openMedia } from '@/utils/navigation';

// On TV, opening a rail poster and coming back returns the remote to the hero.
const rememberHero = () => rememberFocus('hero');

const FEATURED_COUNT = 5;
const SLIDE_MS = 8000;

type IconName = keyof typeof Ionicons.glyphMap;

export default function HomeScreen() {
  const router = useRouter();
  const profile = useActiveProfile();
  const { width, height, railPoster, isWide, isTV, navWidth } = useLayout();
  const library = useLibrary();
  const account = useAccountInfo();
  const live = useCatalog('live');
  const movies = useCatalog('movie');
  const series = useCatalog('series');
  const searchFocus = useRememberedFocus('search');
  const refreshFocus = useRememberedFocus('refresh');
  const settingsFocus = useRememberedFocus('settings');
  const insets = useSafeAreaInsets();

  // Android / Fire TV: Back on Home asks before closing the app instead of quitting straight away.
  const [confirmExit, setConfirmExit] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setConfirmExit(true);
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  const continueWatching = useMemo(() => {
    const seenSeries = new Set<string>();
    return library.recents.filter((r) => {
      if (r.kind !== 'movie' && r.kind !== 'episode') return false;
      if (inProgressFraction(library.progress[keyOf(r)]) === undefined) return false;
      if (r.kind === 'episode') {
        if (seenSeries.has(r.seriesId ?? '')) return false;
        seenSeries.add(r.seriesId ?? '');
      }
      return true;
    });
  }, [library]);

  const favorites = useMemo(
    () => Object.values(library.favorites).sort((a, b) => b.addedAt - a.addedAt).slice(0, 30),
    [library.favorites],
  );
  const latestMovies = useMemo(() => [...movies.items].sort((a, b) => recency(b) - recency(a)).slice(0, 20), [movies.items]);
  const latestSeries = useMemo(() => [...series.items].sort((a, b) => recency(b) - recency(a)).slice(0, 20), [series.items]);

  // Featured carousel: the newest titles that have artwork, movies first, topped up with series.
  const featured = useMemo<(Movie | Series)[]>(() => {
    const withArt = (items: (Movie | Series)[]) => items.filter((i) => !!i.poster);
    return [...withArt(latestMovies).slice(0, 3), ...withArt(latestSeries)].slice(0, FEATURED_COUNT);
  }, [latestMovies, latestSeries]);

  const expiresIn = daysUntil(account.data?.expiresAt);
  const loadingCatalog = live.isLoading || movies.isLoading || series.isLoading;
  const { refresh, refreshing } = useRefreshCatalog();
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);

  const reload = async () => {
    setRefreshResult(null);
    setRefreshResult(await refresh());
  };

  useEffect(() => {
    if (!refreshResult) return;
    const timer = setTimeout(() => setRefreshResult(null), refreshResult.ok ? 3000 : 6000);
    return () => clearTimeout(timer);
  }, [refreshResult]);

  const status = refreshing
    ? { icon: 'sync-outline' as const, color: colors.textDim, text: 'Updating channels, movies and series…' }
    : refreshResult
      ? refreshResult.ok
        ? { icon: 'checkmark-circle-outline' as const, color: colors.success, text: refreshResult.message }
        : { icon: 'alert-circle-outline' as const, color: colors.danger, text: refreshResult.message }
      : expiresIn !== null && expiresIn <= 7
        ? {
            icon: 'warning-outline' as const,
            color: colors.warning,
            text: expiresIn <= 0 ? 'Your subscription has expired.' : `Your subscription expires in ${expiresIn} day${expiresIn === 1 ? '' : 's'}.`,
          }
        : null;

  const count = (n: number, noun: string) => (loadingCatalog && !n ? 'Loading…' : `${n.toLocaleString()} ${noun}`);
  const categories = [
    { id: 'live', label: 'Live TV', icon: 'tv' as const, count: count(live.items.length, 'Channels'), route: '/live', gradient: ['#2F5BFF', '#132A7A'] as const },
    { id: 'movies', label: 'Movies', icon: 'film' as const, count: count(movies.items.length, 'Titles'), route: '/movies', gradient: ['#8B3DFF', '#3E1689'] as const },
    { id: 'series', label: 'Series', icon: 'albums' as const, count: count(series.items.length, 'Shows'), route: '/series', gradient: ['#13A08C', '#0D4A4A'] as const },
  ];

  const pad = isWide ? spacing.xl : spacing.lg;
  const contentWidth = width - navWidth;
  const heroHeight = isTV ? Math.round(height * 0.4) : isWide ? Math.round(Math.min(480, Math.max(340, height * 0.5))) : Math.round(Math.min(520, width * 1.15));
  // Continue-watching cards are 16:9; about six fit across on desktop, like the rails below.
  const wideCard = isWide ? Math.max(200, Math.floor((contentWidth - pad * 2 - spacing.md * 5) / 6)) : Math.round(railPoster * 1.7);
  const posterWidth = railPoster;
  // TV: the rails share whatever height is left under the hero and category cards.
  const [tvRailsHeight, setTvRailsHeight] = useState(0);

  const actions = (
    <View style={styles.actions}>
      {!isWide && <View style={{ flex: 1 }} />}
      <IconButton icon="search" label="Search" onPress={() => router.push('/search')} style={styles.actionButton} {...searchFocus} />
      {refreshing ? (
        <View style={[styles.actionButton, styles.spinner]} accessibilityLabel="Refreshing playlist">
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <IconButton icon="refresh" label="Refresh channels, movies and series" onPress={reload} style={styles.actionButton} {...refreshFocus} />
      )}
      {!isWide && (
        <IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} style={styles.actionButton} {...settingsFocus} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playlist: ${profile?.name ?? ''}. Switch playlist`}
        onPress={() => router.push('/login')}
        style={({ pressed, focused }) => [styles.avatar, pressed && { opacity: 0.8 }, tvFocus(focused)]}
      >
        <Text style={styles.avatarText}>{initials(profile?.name ?? '?').slice(0, 1)}</Text>
      </Pressable>
    </View>
  );

  const libraryCard = (item: MediaRef) => (
    <WideCard
      key={keyOf(item)}
      title={item.kind === 'episode' ? (item.seriesName ?? item.name) : item.name}
      subtitle={item.kind === 'episode' ? `S${item.season} · E${item.episodeNum}` : undefined}
      image={item.image}
      width={wideCard}
      progress={inProgressFraction(library.progress[keyOf(item)])}
      onPress={() => openMedia(router, item)}
    />
  );

  const seeAll = (route: Href, label: string) =>
    isTV ? undefined : (
      <Pressable accessibilityRole="link" accessibilityLabel={`See all ${label}`} onPress={() => router.push(route)} style={styles.seeAll}>
        <Text style={styles.seeAllText}>See All</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.text} />
      </Pressable>
    );

  const posterRail = (title: string, items: (Movie | Series)[], route: Href) => (
    <Rail
      title={title}
      data={items}
      keyExtractor={(m) => m.id}
      action={seeAll(route, title.toLowerCase())}
      renderItem={(m) => (
        <PosterCard
          title={m.name}
          image={m.poster}
          rating={m.rating}
          width={posterWidth}
          onFocus={rememberHero}
          onPress={() => openMedia(router, m)}
        />
      )}
    />
  );

  const hero =
    featured.length > 0 ? (
      <FeaturedCarousel items={featured} height={heroHeight} pad={pad} isWide={isWide} isTV={isTV} />
    ) : (
      <View style={[styles.heroEmpty, { height: isTV ? heroHeight : Math.min(heroHeight, 260) }]}>
        {loadingCatalog ? <ActivityIndicator color={colors.text} /> : <Text style={styles.heroEmptyText}>Welcome to {profile?.name}</Text>}
      </View>
    );

  const categoryCards = categories.map((c) => (
    <CategoryCard
      key={c.id}
      id={c.id}
      label={c.label}
      icon={c.icon}
      count={c.count}
      gradient={c.gradient}
      compact={!isWide}
      dense={isTV}
      onPress={() => router.push(c.route as Href)}
    />
  ));

  // TV (Fire TV / Android TV): everything fits on one screen, no scrolling. Two rails of 16:9 cards share
  // the space left under the hero; posters sit on a blurred copy of themselves to fill the wide frame.
  if (isTV) {
    type TvCard = Omit<WideCardProps, 'width'> & { key: string };
    const catalogCards = (items: (Movie | Series)[]): TvCard[] =>
      items.map((m) => ({ key: m.id, title: m.name, image: m.poster, poster: true, onPress: () => openMedia(router, m) }));
    const continueCards: TvCard[] = continueWatching.slice(0, 20).map((i) => ({
      key: keyOf(i),
      title: i.kind === 'episode' ? (i.seriesName ?? i.name) : i.name,
      subtitle: i.kind === 'episode' ? `S${i.season} · E${i.episodeNum}` : undefined,
      image: i.image,
      progress: inProgressFraction(library.progress[keyOf(i)]),
      onPress: () => openMedia(router, i),
    }));
    const tvRails = (
      continueCards.length > 0
        ? [
            { key: 'continue', title: 'Continue Watching', items: continueCards },
            { key: 'movies', title: 'Recently Added Movies', items: catalogCards(latestMovies) },
          ]
        : [
            { key: 'movies', title: 'Recently Added Movies', items: catalogCards(latestMovies) },
            { key: 'series', title: 'Recently Updated Series', items: catalogCards(latestSeries) },
          ]
    ).filter((r) => r.items.length > 0);
    // Each compact rail spends ~38dp on its title and focus padding; the cards get the rest.
    const cardHeight = tvRailsHeight ? Math.max(60, Math.floor((tvRailsHeight - spacing.md) / Math.max(1, tvRails.length)) - 38) : 0;
    const cardWidth = Math.round((cardHeight * 16) / 9);
    return (
      <View style={styles.safe}>
        <View>
          {hero}
          <View style={[styles.actionsWrap, { paddingHorizontal: pad, top: spacing.md }]} pointerEvents="box-none">
            <View style={styles.actions}>
              {status && (
                <View style={[styles.tvStatus, { borderColor: status.color }]}>
                  <Ionicons name={status.icon} size={14} color={status.color} />
                  <Text style={[styles.tvStatusText, { color: status.color }]} numberOfLines={1}>
                    {status.text}
                  </Text>
                </View>
              )}
              {actions}
            </View>
          </View>
        </View>
        <View style={[styles.categories, styles.categoriesTV, { paddingHorizontal: pad }]}>{categoryCards}</View>
        <View style={styles.tvRails} onLayout={(e) => setTvRailsHeight(e.nativeEvent.layout.height)}>
          {cardHeight > 0 &&
            tvRails.map((r) => (
              <Rail
                key={r.key}
                compact
                title={r.title}
                data={r.items}
                keyExtractor={(c) => c.key}
                renderItem={({ key, ...card }) => <WideCard key={key} {...card} width={cardWidth} />}
              />
            ))}
        </View>
        <ExitDialog visible={confirmExit} onStay={() => setConfirmExit(false)} onExit={() => BackHandler.exitApp()} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={isWide ? [] : ['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={isTV ? undefined : <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.text} />}
      >
        <View>
          {hero}
          <View style={[styles.actionsWrap, { paddingHorizontal: pad, top: (isWide ? insets.top : 0) + spacing.lg }]} pointerEvents="box-none">
            {actions}
          </View>
        </View>

        {status && (
          <View style={[styles.banner, { marginHorizontal: pad, borderColor: status.color }]}>
            <Ionicons name={status.icon} size={18} color={status.color} />
            <Text style={[styles.bannerText, { color: status.color }]}>{status.text}</Text>
          </View>
        )}

        <View style={[styles.categories, { paddingHorizontal: pad }]}>{categoryCards}</View>

        <View style={isWide && { paddingHorizontal: spacing.sm }}>
          <Rail
            title="Continue Watching"
            data={continueWatching}
            keyExtractor={keyOf}
            renderItem={libraryCard}
            action={seeAll('/favorites', 'watch history')}
          />
          {posterRail('Recently Added Movies', latestMovies, '/movies')}
          {posterRail('Recently Updated Series', latestSeries, '/series')}
          <Rail
            title="My List"
            data={favorites}
            keyExtractor={keyOf}
            action={seeAll('/favorites', 'my list')}
            renderItem={(item) => (
              <PosterCard
                key={keyOf(item)}
                title={item.kind === 'episode' ? (item.seriesName ?? item.name) : item.name}
                image={item.image}
                width={posterWidth}
                onFocus={rememberHero}
                onPress={() => openMedia(router, item)}
              />
            )}
          />
        </View>
      </ScrollView>
      <ExitDialog visible={confirmExit} onStay={() => setConfirmExit(false)} onExit={() => BackHandler.exitApp()} />
    </SafeAreaView>
  );
}

function FeaturedCarousel({
  items,
  height,
  pad,
  isWide,
  isTV,
}: {
  items: (Movie | Series)[];
  height: number;
  pad: number;
  isWide: boolean;
  isTV: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { ref: heroRef, onFocus: onHeroFocus } = useRememberedFocus('hero');
  const item = items[Math.min(index, items.length - 1)];

  // Backdrop and plot only come with the details call; it's cached, so revisiting a slide is free.
  const movieInfo = useMovieInfo(item.kind === 'movie' ? item.id : undefined);
  const seriesInfo = useSeriesInfo(item.kind === 'series' ? item.id : undefined);
  const info = item.kind === 'movie' ? movieInfo.data : seriesInfo.data;
  const backdrop = info?.backdrop;
  const plot = info?.plot || (item.kind === 'series' ? item.plot : undefined);
  const meta = [info?.genre?.split(/[,/]/)[0]?.trim(), item.kind === 'series' ? item.year : undefined, item.rating ? `★ ${item.rating.toFixed(1)}` : undefined]
    .filter(Boolean)
    .join('  ·  ');

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % items.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, items.length]);

  const play = () =>
    item.kind === 'movie' ? router.push({ pathname: '/player', params: { kind: 'movie', id: item.id } }) : openMedia(router, item);
  const focusHandlers = { onFocus: () => setPaused(true), onBlur: () => setPaused(false) };

  return (
    <View style={{ height }} onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      {backdrop ? (
        <Artwork uri={backdrop} name={item.name} style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <Artwork uri={item.poster} name={item.name} style={StyleSheet.absoluteFill} blurRadius={28} />
          <Artwork
            uri={item.poster}
            name={item.name}
            style={[styles.heroPoster, isWide ? { right: pad * 3, top: pad * 2, bottom: pad * 2 } : styles.heroPosterPhone]}
          />
        </>
      )}
      <LinearGradient
        colors={['rgba(7,10,22,0.95)', 'rgba(7,10,22,0.7)', 'rgba(7,10,22,0)']}
        locations={[0, 0.4, 0.75]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(11,13,18,0.5)', 'rgba(11,13,18,0)', 'rgba(11,13,18,0)', colors.bg]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.heroContent, isTV && styles.heroContentTV, { paddingHorizontal: pad, maxWidth: isWide ? '55%' : '100%' }]}>
        <View style={styles.featuredChip}>
          <Ionicons name="star" size={13} color={colors.warning} />
          <Text style={styles.featuredText}>Featured</Text>
        </View>
        <Text style={[styles.heroTitle, isWide && styles.heroTitleWide, isTV && styles.heroTitleTV]} numberOfLines={isWide ? 1 : 2}>
          {item.name}
        </Text>
        {!!meta && !isTV && <Text style={styles.heroMeta}>{meta}</Text>}
        {!!plot && (
          <Text style={[styles.heroPlot, isWide && styles.heroPlotWide]} numberOfLines={isTV ? 1 : 2}>
            {plot}
          </Text>
        )}
        <View style={styles.heroButtons}>
          <Pressable
            ref={heroRef}
            accessibilityRole="button"
            accessibilityLabel={`${item.kind === 'movie' ? 'Play' : 'Open'} ${item.name}`}
            hasTVPreferredFocus={isTV}
            onFocus={() => {
              onHeroFocus();
              setPaused(true);
            }}
            onBlur={focusHandlers.onBlur}
            onPress={play}
            style={({ pressed, focused }) => [styles.playButton, isTV && styles.heroButtonTV, pressed && { opacity: 0.85 }, tvFocus(focused)]}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.playText}>{item.kind === 'movie' ? 'Play Now' : 'Watch Now'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More info about ${item.name}`}
            {...focusHandlers}
            onPress={() => openMedia(router, item)}
            style={({ pressed, focused }) => [styles.infoButton, isTV && styles.heroButtonTV, pressed && { opacity: 0.85 }, tvFocus(focused)]}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.text} />
            <Text style={styles.infoText}>More Info</Text>
          </Pressable>
        </View>
        {items.length > 1 && (
          <View style={[styles.dots, isTV && { marginTop: spacing.xs }]}>
            {items.map((it, i) => (
              <Pressable
                key={it.id}
                accessibilityRole="button"
                accessibilityLabel={`Show ${it.name}`}
                focusable={!isTV}
                hitSlop={6}
                onPress={() => setIndex(i)}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function CategoryCard({
  id,
  label,
  icon,
  count,
  gradient,
  compact,
  dense,
  onPress,
}: {
  id: string;
  label: string;
  icon: IconName;
  count: string;
  gradient: readonly [string, string];
  compact: boolean;
  /** TV: a thin strip, so the one-screen home has room for the rails. */
  dense?: boolean;
  onPress: () => void;
}) {
  const { ref, onFocus } = useRememberedFocus(id);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      onFocus={onFocus}
      onPress={onPress}
      style={({ pressed, focused }) => [styles.category, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, tvFocus(focused)]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Ionicons name={icon} size={compact || dense ? 64 : 110} color="rgba(255,255,255,0.1)" style={styles.categoryWatermark} />
      <View style={[styles.categoryBody, compact && styles.categoryBodyCompact, dense && styles.categoryBodyDense]}>
        <Ionicons name={icon} size={compact || dense ? 26 : 40} color="#fff" />
        <View style={{ flex: compact ? undefined : 1 }}>
          <Text style={[styles.categoryLabel, (compact || dense) && styles.categoryLabelCompact]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.categoryCount} numberOfLines={1}>
            {count}
          </Text>
        </View>
        {!compact && (
          <View style={[styles.chevron, dense && styles.chevronDense]}>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface WideCardProps {
  title: string;
  subtitle?: string;
  image?: string;
  width: number;
  progress?: number;
  /** The image is a 2:3 poster: show it whole over a blurred copy instead of cropping it. */
  poster?: boolean;
  onPress: () => void;
}

function WideCard({ title, subtitle, image, width, progress, poster, onPress }: WideCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={progress !== undefined ? `Continue ${title}` : title}
      onFocus={rememberHero}
      onPress={onPress}
      style={({ pressed, focused }) => [{ width }, pressed && { opacity: 0.85 }, focused && Platform.isTV && styles.cardFocused]}
    >
      {({ focused }) => (
        <View style={[styles.continueCard, { height: width * 0.5625 }, tvFocus(focused)]}>
          {poster ? (
            <>
              <Artwork uri={image} name={title} style={StyleSheet.absoluteFill} blurRadius={18} />
              <Artwork uri={image} name={title} style={styles.widePoster} />
            </>
          ) : (
            <Artwork uri={image} name={title} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
          {progress !== undefined && (
            <View style={styles.continuePlay}>
              <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          )}
          <View style={[styles.continueText, poster && { right: '40%' }]}>
            {!!subtitle && <Text style={styles.continueSubtitle}>{subtitle}</Text>}
            <Text style={styles.continueTitle} numberOfLines={poster ? 2 : 1}>
              {title}
            </Text>
            {progress !== undefined && <ProgressBar value={progress} style={styles.continueProgress} />}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  actionsWrap: { position: 'absolute', left: 0, right: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  actionButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  spinner: { borderRadius: radius.pill },
  avatar: {
    width: 40,
    height: 40,
    marginLeft: spacing.xs,
    borderRadius: 20,
    backgroundColor: '#6D3BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  heroEmpty: { alignItems: 'center', justifyContent: 'center' },
  heroEmptyText: { color: colors.textDim, fontSize: 18, fontWeight: '600' },
  heroPoster: {
    position: 'absolute',
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroPosterPhone: { alignSelf: 'center', top: spacing.xxl * 2, height: '42%' },
  heroContent: { flex: 1, justifyContent: 'flex-end', paddingTop: 72, paddingBottom: spacing.lg, gap: spacing.sm },
  featuredChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  featuredText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  heroTitleTV: { fontSize: 30, letterSpacing: 2 },
  heroContentTV: { paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 6 },
  heroButtonTV: { height: 40, paddingHorizontal: spacing.lg },
  heroTitleWide: { fontSize: 44, letterSpacing: 3, textTransform: 'uppercase' },
  heroMeta: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  heroPlot: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  heroPlotWide: { fontSize: 17, lineHeight: 24 },
  heroButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: '#2D5BFF',
    borderWidth: 1,
    borderColor: '#6F93FF',
    shadowColor: '#3D6BFF',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  playText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  infoText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 22, backgroundColor: '#5B8CFF' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  bannerText: { fontSize: 14, flex: 1 },
  categories: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  category: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  categoryWatermark: { position: 'absolute', right: -8, bottom: -14 },
  categoryBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  categoryBodyDense: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.md },
  categoryBodyCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  categoryLabel: { color: '#fff', fontSize: 22, fontWeight: '800' },
  categoryLabelCompact: { fontSize: 15 },
  categoryCount: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  chevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  chevronDense: { width: 28, height: 28, borderRadius: 14 },
  categoriesTV: { marginTop: spacing.sm },
  tvRails: { flex: 1, paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  tvStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 320,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(11,13,18,0.8)',
  },
  tvStatusText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  cardFocused: { transform: [{ scale: 1.05 }], zIndex: 1 },
  widePoster: {
    position: 'absolute',
    right: '6%',
    top: '8%',
    bottom: '8%',
    aspectRatio: 2 / 3,
    borderRadius: radius.sm,
  },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  continueCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  continuePlay: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  continueText: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm },
  continueSubtitle: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  continueTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  continueProgress: { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
});
