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
import { Glyph, SECTION_ICONS, type GlyphName } from '@/components/Glyph';
import { PosterCard } from '@/components/PosterCard';
import { Rail } from '@/components/Rail';
import { StoryModal } from '@/components/StoryModal';
import { useAccountInfo, useCatalog, useMovieInfo, useSeriesInfo, recency, useRefreshCatalog, type RefreshResult } from '@/hooks/useCatalog';
import { useLayout } from '@/hooks/useLayout';
import { rememberFocus, useRememberedFocus } from '@/hooks/useRememberedFocus';
import { useActiveProfile } from '@/store/profiles';
import { colors, radius, spacing, tvFocus } from '@/theme';
import { daysUntil, initials } from '@/utils/format';
import { openMedia } from '@/utils/navigation';

// On TV, opening a rail poster and coming back returns the remote to the hero.
const rememberHero = () => rememberFocus('hero');

const FEATURED_COUNT = 5;
const SLIDE_MS = 8000;

export default function HomeScreen() {
  const router = useRouter();
  const profile = useActiveProfile();
  const { width, height, railPoster, isWide, isTV, navWidth } = useLayout();
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

  const latestMovies = useMemo(() => [...movies.items].sort((a, b) => recency(b) - recency(a)).slice(0, 20), [movies.items]);
  const latestSeries = useMemo(() => [...series.items].sort((a, b) => recency(b) - recency(a)).slice(0, 20), [series.items]);
  // One "Recently Added" row: newest movies and series together, newest first.
  const recentlyAdded = useMemo(
    () => [...latestMovies, ...latestSeries].sort((a, b) => recency(b) - recency(a)).slice(0, 30),
    [latestMovies, latestSeries],
  );

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
  const categories: CategoryProps[] = [
    { id: 'live', label: 'Live TV', icon: SECTION_ICONS.live[1], count: count(live.items.length, 'Channels'), gradient: ['#3D7BFF', '#2449D8', '#101E6B'], route: '/live' },
    { id: 'movies', label: 'Movies', icon: SECTION_ICONS.movies[1], count: count(movies.items.length, 'Movies'), gradient: ['#B04DFF', '#7428E0', '#2E0E73'], route: '/movies' },
    { id: 'series', label: 'Series', icon: SECTION_ICONS.series[1], count: count(series.items.length, 'Shows'), gradient: ['#1BC7A5', '#0E8C80', '#073F45'], route: '/series' },
  ];

  const pad = isWide ? spacing.xl : spacing.lg;
  const heroHeight = isWide ? Math.round(Math.min(480, Math.max(340, height * 0.5))) : Math.round(Math.min(520, width * 1.15));
  // TV, tablets and large screens: the whole Home fits on one screen with no scrolling. Phones scroll.
  const oneScreen = isTV || Math.min(width, height) >= 600 || width > height;
  // Measured sizes for the one-screen layout: the whole screen, and the space left for the hero.
  const [screenHeight, setScreenHeight] = useState(0);
  const [heroSpace, setHeroSpace] = useState(0);
  // One-screen sizes scale with the screen: big category cards, then one row of posters.
  // Short screens (phones held sideways, ~400pt tall) get smaller minimums so everything still fits.
  const shortScreen = screenHeight > 0 && screenHeight < 500;
  const categoryHeight = oneScreen ? Math.min(170, Math.max(shortScreen ? 60 : 84, Math.round(screenHeight * 0.17))) : 140;
  // Icon beside the text needs a wide card; narrower ones (phones, tablets held upright) stack it on top.
  const categoryWidth = (width - navWidth - insets.right - pad * 2 - spacing.md * 2) / 3;
  const stackedCategories = categoryWidth < categoryHeight * 2.3;
  const posterWidth = oneScreen
    ? Math.round(Math.min(300, Math.max(shortScreen ? 80 : 110, Math.round(screenHeight * (shortScreen ? 0.24 : 0.27)))) / 1.5)
    : railPoster;

  const actions = (
    <View style={styles.actions}>
      {/* Phone-sized screens have no room for it beside the hero title; the sidebar dot still shows status. */}
      {status && oneScreen && width - navWidth >= 900 && (
        <View style={[styles.statusPill, { borderColor: status.color }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusPillText, { color: status.color }]} numberOfLines={1}>
            {status.text}
          </Text>
        </View>
      )}
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

  const heroFor = (h: number) =>
    featured.length > 0 ? (
      <FeaturedCarousel items={featured} height={h} pad={pad} isWide={isWide} isTV={isTV} dense={oneScreen && h < 380} tiny={oneScreen && h < 200} />
    ) : (
      <View style={[styles.heroEmpty, { height: oneScreen ? h : Math.min(h, 260) }]}>
        {loadingCatalog ? <ActivityIndicator color={colors.text} /> : <Text style={styles.heroEmptyText}>Welcome to {profile?.name}</Text>}
      </View>
    );

  const categoryRow = (
    <View style={[styles.categories, { paddingHorizontal: pad }]}>
      {categories.map((c) => (
        <CategoryCard key={c.id} {...c} height={categoryHeight} stacked={stackedCategories} arrow={categoryWidth >= 200} />
      ))}
    </View>
  );

  const recentRail = (
    <View style={{ paddingHorizontal: isWide ? spacing.sm : 0 }}>
      <Rail
        compact={oneScreen}
        title="Recently Added"
        data={recentlyAdded}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        renderItem={(i) => (
          <PosterCard
            title={i.name}
            subtitle={i.kind === 'movie' ? 'Movie' : 'Series'}
            image={i.poster}
            rating={isTV ? undefined : i.rating}
            width={posterWidth}
            onFocus={rememberHero}
            onPress={() => openMedia(router, i)}
          />
        )}
      />
    </View>
  );

  // One screen, no scrolling: the hero fills whatever the category cards and the poster row leave.
  if (oneScreen) {
    const bottomInset = isWide ? insets.bottom : 0; // with bottom tabs, the tab bar already handles it
    return (
      <View style={styles.safe} onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
        <View style={styles.heroSpace} onLayout={(e) => setHeroSpace(e.nativeEvent.layout.height)}>
          {heroSpace > 0 && heroFor(heroSpace)}
          <View style={[styles.actionsWrap, { paddingHorizontal: pad, top: insets.top + spacing.md }]} pointerEvents="box-none">
            {actions}
          </View>
        </View>
        {screenHeight > 0 && (
          <>
            {categoryRow}
            <View style={{ paddingBottom: spacing.sm + bottomInset }}>{recentRail}</View>
          </>
        )}
        <ExitDialog visible={confirmExit} onStay={() => setConfirmExit(false)} onExit={() => BackHandler.exitApp()} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={isWide ? [] : ['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.text} />}
      >
        <View>
          {heroFor(heroHeight)}
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

        {categoryRow}
        {recentRail}
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
  dense,
  tiny,
}: {
  items: (Movie | Series)[];
  height: number;
  pad: number;
  isWide: boolean;
  isTV: boolean;
  /** Short hero (one-screen layouts): one-line plot, smaller buttons. */
  dense: boolean;
  /** Very short hero (phones held sideways): just the title, buttons and dots. */
  tiny: boolean;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
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
    if (paused || storyOpen || items.length < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % items.length), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, paused, storyOpen, items.length]);

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

      <View style={[styles.heroContent, dense && styles.heroContentTV, { paddingHorizontal: pad, maxWidth: isWide ? '55%' : '100%' }]}>
        {!tiny && (
          <View style={styles.featuredChip}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
        <Text style={[styles.heroTitle, isWide && styles.heroTitleWide, dense && styles.heroTitleTV]} numberOfLines={isWide ? 1 : 2}>
          {item.name}
        </Text>
        {!!meta && !dense && <Text style={styles.heroMeta}>{meta}</Text>}
        {!!plot && !tiny && (
          // A short preview; "More" opens the whole story.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Read the full story of ${item.name}`}
            {...focusHandlers}
            onPress={() => setStoryOpen(true)}
            style={({ pressed, focused }) => [styles.plotRow, pressed && { opacity: 0.8 }, tvFocus(focused)]}
          >
            <Text style={[styles.heroPlot, isWide && styles.heroPlotWide, styles.plotText]} numberOfLines={dense ? 1 : 2}>
              {plot}
            </Text>
            <Text style={styles.plotMore}>More ›</Text>
          </Pressable>
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
            style={({ pressed, focused }) => [styles.playButton, dense && styles.heroButtonTV, pressed && { opacity: 0.85 }, tvFocus(focused)]}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.playText}>{item.kind === 'movie' ? 'Play Now' : 'Watch Now'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More info about ${item.name}`}
            {...focusHandlers}
            onPress={() => openMedia(router, item)}
            style={({ pressed, focused }) => [styles.infoButton, dense && styles.heroButtonTV, pressed && { opacity: 0.85 }, tvFocus(focused)]}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.text} />
            <Text style={styles.infoText}>More Info</Text>
          </Pressable>
        </View>
        {items.length > 1 && (
          <View style={[styles.dots, dense && { marginTop: spacing.xs }]}>
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
      {!!plot && (
        <StoryModal
          visible={storyOpen}
          title={item.name}
          poster={item.poster}
          meta={meta}
          plot={plot}
          cast={info?.cast}
          director={info?.director}
          playLabel={item.kind === 'movie' ? 'Play' : 'Watch'}
          onPlay={() => {
            setStoryOpen(false);
            play();
          }}
          onClose={() => setStoryOpen(false)}
        />
      )}
    </View>
  );
}

interface CategoryProps {
  id: string;
  label: string;
  icon: GlyphName;
  count: string;
  /** Three stops, light to dark, drawn diagonally. */
  gradient: [string, string, string];
  route: Href;
}

/** Big gradient tile for a section. Row layout when wide; stacked (icon above text) on phones. */
function CategoryCard({ id, label, icon, count, gradient, route, height, stacked, arrow }: CategoryProps & { height: number; stacked: boolean; arrow: boolean }) {
  const router = useRouter();
  const { ref, onFocus } = useRememberedFocus(id);
  // Everything inside scales with the card, so it reads well from a phone to a TV across the room.
  const badge = Math.round(Math.min(78, Math.max(40, height * (stacked ? 0.36 : 0.46))));
  const labelSize = Math.round(Math.min(28, Math.max(16, height * (stacked ? 0.13 : 0.17))));
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      onFocus={onFocus}
      onPress={() => router.push(route)}
      style={({ pressed, focused }) => [
        styles.category,
        { height },
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        focused && Platform.isTV && styles.categoryFocused,
        tvFocus(focused),
      ]}
    >
      <LinearGradient colors={gradient} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Soft light from the top-left corner, like a glossy panel. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <Glyph
        icon={icon}
        size={Math.round(height * 1.05)}
        color="rgba(255,255,255,0.11)"
        style={[styles.categoryWatermark, { right: -height * 0.12, bottom: -height * 0.22 }]}
      />
      <View style={[styles.categoryBody, stacked ? styles.categoryBodyStacked : { paddingHorizontal: Math.round(height * 0.2) }]}>
        <View style={[styles.categoryBadge, { width: badge, height: badge, borderRadius: badge * 0.3 }]}>
          <Glyph icon={icon} size={Math.round(badge * 0.52)} color="#fff" />
        </View>
        <View style={stacked ? undefined : { flex: 1 }}>
          <Text style={[styles.categoryLabel, { fontSize: labelSize }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.categoryCount, { fontSize: Math.max(12, Math.round(labelSize * 0.55)) }]} numberOfLines={1}>
            {count}
          </Text>
        </View>
        {!stacked && arrow && (
          <View style={[styles.chevron, { width: badge * 0.5, height: badge * 0.5, borderRadius: badge * 0.25 }]}>
            <Ionicons name="arrow-forward" size={Math.round(badge * 0.26)} color="#fff" />
          </View>
        )}
      </View>
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
  plotRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, alignSelf: 'flex-start', borderRadius: radius.sm },
  plotText: { flexShrink: 1 },
  plotMore: { color: '#8FB0FF', fontSize: 14, fontWeight: '800', lineHeight: 20 },
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
  categories: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  category: {
    flex: 1,
    borderRadius: radius.lg + 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  categoryFocused: { transform: [{ scale: 1.04 }], zIndex: 1 },
  categoryWatermark: { position: 'absolute', transform: [{ rotate: '-12deg' }] },
  categoryBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  categoryBodyStacked: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.sm, padding: spacing.md },
  categoryBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  categoryLabel: { color: '#fff', fontWeight: '800', letterSpacing: 0.3 },
  categoryCount: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },
  chevron: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  heroSpace: { flex: 1, minHeight: 120 },
  statusPill: {
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
  statusPillText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
