import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { useRemoteKeys, type RemoteKey } from '@/hooks/useRemoteKeys';
import { colors, radius, spacing } from '@/theme';
import { UpNextCard } from './UpNextCard';
import type { MediaTrack, PlaybackState, TrackInfo, VideoSurfaceHandle } from './types';
import { VideoSurface } from './VideoSurface';

const SEEK_SECONDS = 15;
const HIDE_AFTER_MS = 5000;
// The "Next episode" card appears this many seconds before an episode ends.
const UP_NEXT_LEAD_SECONDS = 20;
// Remote scrubbing: presses closer together than this count as one continuous "hold".
const SCRUB_STREAK_MS = 450;
// After the last press, wait this long before actually seeking (so a hold seeks once, not 50 times).
const SCRUB_COMMIT_MS = 900;
/** Step size grows the longer ◀/▶/⏪/⏩ is held: 10s, then 30s, 1 min, 2 min. */
const scrubStep = (streak: number) => (streak < 5 ? 10 : streak < 15 ? 30 : streak < 30 ? 60 : 120);
const isTV = Platform.isTV;
const isPhone = !isTV && Platform.OS !== 'web';

type Fit = 'contain' | 'cover' | 'fill';
const FITS: { value: Fit; label: string }[] = [
  { value: 'contain', label: 'FIT' },
  { value: 'cover', label: 'FILL' },
  { value: 'fill', label: 'STRETCH' },
];

export interface EpisodeOption {
  id: string;
  title: string;
  subtitle?: string;
  active: boolean;
}

interface Props {
  uri: string;
  title: string;
  subtitle?: string;
  artwork?: string;
  startAt?: number;
  onProgress: (position: number, duration: number) => void;
  onEnded: () => void;
  onError: (message: string) => void;
  onBack: () => void;
  /** Series: the following episode. `title`/`image`/`autoplay` drive the "Next episode" card at the end. */
  next?: { label: string; onPress: () => void; title?: string; image?: string; autoplay?: boolean };
  favorite?: { active: boolean; onToggle: () => void };
  /** Series only: all episodes, for the LIST panel. */
  episodes?: EpisodeOption[];
  onSelectEpisode?: (id: string) => void;
}

type Panel = 'tracks' | 'episodes' | null;

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Movie/episode player in the style of IPTV TV apps: progress bar, ⏪ ⏯ ⏩ transport and a row of
 * labelled tool buttons. Works with TV remotes, touch, mouse and keyboard.
 */
export function VodPlayer({
  uri,
  title,
  subtitle,
  artwork,
  startAt,
  onProgress,
  onEnded,
  onError,
  onBack,
  next,
  favorite,
  episodes,
  onSelectEpisode,
}: Props) {
  const surface = useRef<VideoSurfaceHandle>(null);
  const [state, setState] = useState<PlaybackState>({ playing: false, position: startAt ?? 0, duration: 0, buffering: true });
  // Spinner only while the picture is really stuck: engines can report "buffering" while playing fine
  // (VLC on iOS does), so a buffering flag with the position still moving doesn't count.
  const [stalled, setStalled] = useState(true);
  const lastAdvance = useRef({ position: startAt ?? 0, at: 0 });
  const onSurfaceState = useCallback((next: PlaybackState) => {
    const now = Date.now();
    const seen = lastAdvance.current;
    if (Math.abs(next.position - seen.position) > 0.05) lastAdvance.current = { position: next.position, at: now };
    setStalled(next.buffering && now - lastAdvance.current.at > 1200);
    setState(next);
  }, []);
  const [tracks, setTracks] = useState<TrackInfo>({ audio: [], subtitles: [] });
  const [visible, setVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [fit, setFit] = useState<Fit>('contain');
  const [seekFocused, setSeekFocused] = useState(false);
  const [activity, setActivity] = useState(0);
  const [osd, setOsd] = useState<{ amount: number; at: number } | null>(null);
  // Remote scrubbing target in seconds: shown on the bar, sought once the presses stop.
  const [scrub, setScrub] = useState<number | null>(null);
  const scrubStreak = useRef({ count: 0, at: 0 });
  // Running target, updated on every key repeat even if a render hasn't happened in between.
  const scrubTarget = useRef<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  // Last seconds of an episode (or its end): offer the next one. Rewinding out of the window hides it.
  const remaining = state.duration > 0 ? state.duration - state.position : Infinity;
  const showUpNext =
    !!next?.title && !upNextDismissed && !panel && (ended || (state.duration > 60 && remaining <= UP_NEXT_LEAD_SECONDS));

  const poke = useCallback(() => setActivity((a) => a + 1), []);
  const show = useCallback(() => {
    setVisible(true);
    setActivity((a) => a + 1);
  }, []);

  // Auto-hide while playing; stay visible while paused or while a panel is open.
  useEffect(() => {
    if (!visible || !state.playing || panel) return;
    const timer = setTimeout(() => setVisible(false), HIDE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [visible, state.playing, panel, activity]);

  useEffect(() => {
    if (!osd) return;
    const timer = setTimeout(() => setOsd(null), 900);
    return () => clearTimeout(timer);
  }, [osd]);

  const seek = useCallback((delta: number) => {
    surface.current?.seekBy(delta);
    setState((s) => ({ ...s, position: Math.max(0, Math.min(s.position + delta, s.duration || Infinity)) }));
    setOsd((o) => ({
      amount: (o && Date.now() - o.at < 900 && Math.sign(o.amount) === Math.sign(delta) ? o.amount : 0) + delta,
      at: Date.now(),
    }));
  }, []);

  // Move the scrub target; the video itself jumps once, shortly after the last press.
  const nudge = (direction: 1 | -1) => {
    const streak = scrubStreak.current;
    const now = Date.now();
    streak.count = now - streak.at < SCRUB_STREAK_MS ? streak.count + 1 : 0;
    streak.at = now;
    const from = scrubTarget.current ?? state.position;
    const end = state.duration ? state.duration - 1 : Infinity;
    scrubTarget.current = Math.max(0, Math.min(end, from + direction * scrubStep(streak.count)));
    setScrub(scrubTarget.current);
    show();
  };

  const commitScrub = useCallback((target: number) => {
    scrubTarget.current = null;
    surface.current?.seekTo(target);
    setState((s) => ({ ...s, position: target }));
    setScrub(null);
  }, []);

  useEffect(() => {
    if (scrub === null) return;
    const timer = setTimeout(() => commitScrub(scrub), SCRUB_COMMIT_MS);
    return () => clearTimeout(timer);
  }, [scrub, commitScrub]);

  const handleEnded = () => {
    onEnded();
    setEnded(true);
    if (next?.autoplay && !upNextDismissed) next.onPress();
  };

  const togglePlay = useCallback(() => {
    surface.current?.togglePlay();
    show();
  }, [show]);

  const restart = useCallback(() => {
    surface.current?.seekTo(0);
    surface.current?.play();
    setState((s) => ({ ...s, position: 0 }));
    show();
  }, [show]);

  const openTracks = () => {
    setTracks(surface.current?.getTracks() ?? tracks);
    setPanel('tracks');
  };

  const onRemote = (key: RemoteKey) => {
    if (key === 'back') {
      if (panel) setPanel(null);
      else onBack();
      return;
    }
    if (panel) return poke();
    if (showUpNext && (key === 'left' || key === 'right' || key === 'select' || key === 'up' || key === 'down')) return;
    switch (key) {
      case 'playPause':
        return togglePlay();
      case 'fastForward':
        return nudge(1);
      case 'rewind':
        return nudge(-1);
      case 'left':
      case 'right':
        // Hidden controls or a focused progress bar: Left/Right scrub. Otherwise they move between buttons.
        if (!visible || seekFocused || Platform.OS === 'web') nudge(key === 'left' ? -1 : 1);
        else poke();
        return;
      case 'select':
        // OK while scrubbing: jump there now instead of waiting.
        if (scrub !== null) return commitScrub(scrub);
        if (Platform.OS === 'web') return togglePlay();
        if (!visible) return show();
        return poke();
      default:
        if (!visible) show();
        else poke();
    }
  };
  useRemoteKeys(onRemote);

  // Android / Fire TV Back: close a panel, then hide the controls, then leave the player.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel) {
        setPanel(null);
        return true;
      }
      if (showUpNext) {
        setUpNextDismissed(true);
        return true;
      }
      if (isTV && visible) {
        setVisible(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [panel, visible, showUpNext]);

  const fitLabel = FITS.find((f) => f.value === fit)!.label;
  const cycleFit = () => {
    setFit((f) => FITS[(FITS.findIndex((x) => x.value === f) + 1) % FITS.length].value);
    poke();
  };

  return (
    <View style={styles.root}>
      <VideoSurface
        ref={surface}
        uri={uri}
        isLive={false}
        title={subtitle ? `${title} · ${subtitle}` : title}
        artwork={artwork}
        controls="none"
        contentFit={fit}
        startAt={startAt}
        onProgress={onProgress}
        onStateChange={onSurfaceState}
        onTracksChange={setTracks}
        onEnded={handleEnded}
        onError={onError}
      />

      {/*
        Touch/mouse: tap anywhere to toggle the controls.
        TV: while the controls are hidden this layer holds the remote's focus. Android only delivers
        remote key presses to the app when something is focused, so without it OK/◀/▶ would do nothing.
      */}
      <Pressable
        key={visible ? 'catcher-idle' : 'catcher-active'}
        accessibilityLabel={visible ? 'Hide controls' : 'Show controls'}
        focusable={isTV && !visible && !panel && !showUpNext}
        hasTVPreferredFocus={isTV && !visible && !panel && !showUpNext}
        style={StyleSheet.absoluteFill}
        onPress={() => (visible ? setVisible(false) : show())}
      />

      {stalled && (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {osd && !visible && (
        <View pointerEvents="none" style={styles.center}>
          <View style={styles.osd}>
            <Ionicons name={osd.amount < 0 ? 'play-back' : 'play-forward'} size={26} color="#fff" />
            <Text style={styles.osdText}>
              {osd.amount > 0 ? '+' : '−'}
              {Math.abs(osd.amount)}s
            </Text>
          </View>
          <View style={styles.osdBar}>
            <SeekBar position={state.position} duration={state.duration} />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatTime(state.position)}</Text>
              <Text style={styles.time}>{state.duration ? formatTime(state.duration) : '--:--'}</Text>
            </View>
          </View>
        </View>
      )}

      {visible && (
        <>
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.75)', 'transparent']} style={styles.top}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </LinearGradient>

          <LinearGradient pointerEvents="box-none" colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.92)']} style={styles.bottom}>
            <SeekBar
              position={scrub ?? state.position}
              duration={state.duration}
              preview={scrub !== null}
              focused={seekFocused}
              onFocusChange={setSeekFocused}
              onSeek={(seconds) => {
                surface.current?.seekTo(seconds);
                setState((s) => ({ ...s, position: seconds }));
                show();
              }}
            />
            <View style={styles.timeRow}>
              <Text style={[styles.time, scrub !== null && styles.timeScrub]}>{formatTime(scrub ?? state.position)}</Text>
              <Text style={styles.time}>{state.duration ? formatTime(state.duration) : '--:--'}</Text>
            </View>

            <View style={styles.transport}>
              <TransportButton
                icon="play-back"
                caption="15s"
                label="Back 15 seconds"
                onPress={() => {
                  seek(-SEEK_SECONDS);
                  poke();
                }}
              />
              <TransportButton
                icon={state.playing ? 'pause' : 'play'}
                big
                preferredFocus
                label={state.playing ? 'Pause' : 'Play'}
                onPress={togglePlay}
              />
              <TransportButton
                icon="play-forward"
                caption="15s"
                label="Forward 15 seconds"
                onPress={() => {
                  seek(SEEK_SECONDS);
                  poke();
                }}
              />
            </View>

            <View style={styles.tools}>
              {episodes && episodes.length > 1 && <ToolButton caption="LIST" icon="list" label="Episodes" onPress={() => setPanel('episodes')} />}
              <ToolButton caption="BACK" icon="arrow-undo" label="Back" onPress={onBack} />
              <ToolButton caption="SUB" mdi="subtitles-outline" label="Subtitles" dim={!tracks.subtitles.length} onPress={openTracks} />
              <ToolButton caption="AUDIO" mdi="translate" label="Audio language" dim={tracks.audio.length < 2} onPress={openTracks} />
              {favorite && (
                <ToolButton
                  caption="FAV"
                  icon={favorite.active ? 'heart' : 'heart-outline'}
                  color={favorite.active ? colors.accent : '#fff'}
                  label={favorite.active ? 'Remove from My List' : 'Add to My List'}
                  onPress={() => {
                    favorite.onToggle();
                    poke();
                  }}
                />
              )}
              <ToolButton caption="RESTART" icon="refresh" label="Play from the beginning" onPress={restart} />
              <ToolButton caption={fitLabel} mdi="aspect-ratio" label={`Picture size: ${fitLabel}`} onPress={cycleFit} />
              {isPhone && (
                <ToolButton
                  caption="PIP"
                  mdi="picture-in-picture-bottom-right"
                  label="Picture in picture"
                  onPress={() => surface.current?.startPictureInPicture?.()}
                />
              )}
              {next && <ToolButton caption="NEXT" icon="play-skip-forward" label={next.label} onPress={next.onPress} />}
            </View>
          </LinearGradient>
        </>
      )}

      {panel === 'tracks' && (
        <TrackPanel
          tracks={tracks}
          onAudio={(id) => {
            surface.current?.setAudioTrack(id);
            setTracks((t) => ({ ...t, selectedAudio: id }));
          }}
          onSubtitle={(id) => {
            surface.current?.setSubtitleTrack(id);
            setTracks((t) => ({ ...t, selectedSubtitle: id }));
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'episodes' && episodes && (
        <EpisodePanel
          episodes={episodes}
          onSelect={(id) => {
            setPanel(null);
            onSelectEpisode?.(id);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {showUpNext && next?.title && (
        <UpNextCard
          title={next.title}
          image={next.image}
          autoplay={!!next.autoplay}
          onPlay={next.onPress}
          onCancel={() => setUpNextDismissed(true)}
        />
      )}
    </View>
  );
}

function TransportButton({
  icon,
  caption,
  label,
  big,
  preferredFocus,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  caption?: string;
  label: string;
  big?: boolean;
  preferredFocus?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hasTVPreferredFocus={preferredFocus}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed, focused }) => [
        styles.transportButton,
        big && styles.transportBig,
        focused && styles.transportFocused,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={big ? 34 : 30} color="#fff" style={big && icon === 'play' ? { marginLeft: 4 } : undefined} />
      {caption && <Text style={styles.transportCaption}>{caption}</Text>}
    </Pressable>
  );
}

function ToolButton({
  caption,
  icon,
  mdi,
  label,
  color = '#fff',
  dim,
  onPress,
}: {
  caption: string;
  icon?: keyof typeof Ionicons.glyphMap;
  mdi?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  color?: string;
  dim?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, focused }) => [styles.tool, dim && !focused && { opacity: 0.45 }, focused && styles.toolFocused, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.toolCaption} numberOfLines={1}>
        {caption}
      </Text>
      {mdi ? <MaterialCommunityIcons name={mdi} size={22} color={color} /> : <Ionicons name={icon!} size={22} color={color} />}
    </Pressable>
  );
}

function SeekBar({
  position,
  duration,
  preview,
  focused,
  onFocusChange,
  onSeek,
}: {
  position: number;
  duration: number;
  /** Scrubbing with the remote: show the target time above the thumb. */
  preview?: boolean;
  focused?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onSeek?: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0;
  return (
    <Pressable
      accessibilityLabel="Progress. Use left and right to move through the video; hold to go faster."
      disabled={!onSeek || !duration}
      focusable={isTV && !!onSeek}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onPress={(e) => {
        // On TV, OK on the focused bar does nothing special; on touch/mouse, jump to the tapped point.
        if (!isTV && width) onSeek?.((e.nativeEvent.locationX / width) * duration);
      }}
      style={styles.seekHit}
    >
      <View style={[styles.seekTrack, focused && styles.seekTrackFocused]}>
        <View style={[styles.seekFill, { width: `${fraction * 100}%` }]} />
      </View>
      <View style={[styles.seekThumb, (focused || preview) && styles.seekThumbFocused, { left: `${fraction * 100}%` }]} />
      {preview && (
        // Centred on the thumb, but kept inside the bar at the very start and end.
        <View pointerEvents="none" style={[styles.seekBubble, { left: Math.min(Math.max(fraction * width, 42), Math.max(42, width - 42)) }]}>
          <Text style={styles.seekBubbleText}>{formatTime(position)}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <View style={styles.panelBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} focusable={false} onPress={onClose} />
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

function TrackPanel({
  tracks,
  onAudio,
  onSubtitle,
  onClose,
}: {
  tracks: TrackInfo;
  onAudio: (id: string) => void;
  onSubtitle: (id: string | undefined) => void;
  onClose: () => void;
}) {
  const subtitleOptions: (MediaTrack | { id: undefined; label: string })[] = [{ id: undefined, label: 'Off' }, ...tracks.subtitles];
  return (
    <SidePanel title="Audio & subtitles" onClose={onClose}>
      <ScrollView contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.lg }}>
        <Text style={styles.panelHeading}>Audio</Text>
        {tracks.audio.length === 0 && <Text style={styles.panelEmpty}>Default audio only</Text>}
        {tracks.audio.map((t, i) => (
          <PanelRow key={t.id} label={t.label} selected={t.id === tracks.selectedAudio} preferredFocus={i === 0} onPress={() => onAudio(t.id)} />
        ))}
        <Text style={[styles.panelHeading, { marginTop: spacing.lg }]}>Subtitles</Text>
        {tracks.subtitles.length === 0 ? (
          <Text style={styles.panelEmpty}>This video has no subtitles</Text>
        ) : (
          subtitleOptions.map((t, i) => (
            <PanelRow
              key={t.id ?? 'off'}
              label={t.label}
              selected={t.id === tracks.selectedSubtitle}
              preferredFocus={tracks.audio.length === 0 && i === 0}
              onPress={() => onSubtitle(t.id)}
            />
          ))
        )}
        <PanelRow label="Close" icon="close" preferredFocus={tracks.audio.length === 0 && tracks.subtitles.length === 0} onPress={onClose} />
      </ScrollView>
    </SidePanel>
  );
}

function EpisodePanel({ episodes, onSelect, onClose }: { episodes: EpisodeOption[]; onSelect: (id: string) => void; onClose: () => void }) {
  const activeIndex = Math.max(0, episodes.findIndex((e) => e.active));
  return (
    <SidePanel title="Episodes" onClose={onClose}>
      <FlatList
        data={episodes}
        keyExtractor={(e) => e.id}
        initialScrollIndex={activeIndex}
        getItemLayout={(_, index) => ({ length: EPISODE_ROW, offset: EPISODE_ROW * index, index })}
        renderItem={({ item }) => (
          <PanelRow label={item.title} detail={item.subtitle} selected={item.active} preferredFocus={item.active} height={EPISODE_ROW} onPress={() => onSelect(item.id)} />
        )}
      />
    </SidePanel>
  );
}

const EPISODE_ROW = 52;

function PanelRow({
  label,
  detail,
  selected,
  preferredFocus,
  icon,
  height,
  onPress,
}: {
  label: string;
  detail?: string;
  selected?: boolean;
  preferredFocus?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  height?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hasTVPreferredFocus={preferredFocus}
      onPress={onPress}
      style={({ focused, pressed }) => [styles.panelRow, height ? { height } : null, (focused || pressed) && styles.panelRowFocused]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={18} color={colors.primary} style={{ width: 22 }} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={colors.textDim} style={{ width: 22 }} />
      ) : (
        <View style={{ width: 22 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.panelLabel, selected && { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
          {label}
        </Text>
        {!!detail && (
          <Text style={styles.panelDetail} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl * 1.5 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl * 2, paddingBottom: spacing.lg },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  time: { color: '#fff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  timeScrub: { color: colors.primary, fontWeight: '800' },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxl * 2, marginTop: spacing.xs },
  transportButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  transportBig: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.22)' },
  transportFocused: { backgroundColor: colors.primary, transform: [{ scale: 1.12 }] },
  transportCaption: { position: 'absolute', bottom: -6, color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700' },
  tools: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  tool: {
    width: 70,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    gap: 2,
  },
  toolFocused: { borderColor: colors.primary, backgroundColor: colors.primary, transform: [{ scale: 1.08 }] },
  toolCaption: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  seekHit: { height: 26, justifyContent: 'center' },
  seekBubble: {
    position: 'absolute',
    bottom: 26,
    width: 84,
    marginLeft: -42,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  seekBubbleText: { color: '#fff', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  seekTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  seekTrackFocused: { height: 8, borderRadius: 4 },
  seekFill: { height: '100%', backgroundColor: colors.primary },
  seekThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, marginLeft: -7, backgroundColor: '#fff' },
  seekThumbFocused: { width: 22, height: 22, borderRadius: 11, marginLeft: -11, borderWidth: 3, borderColor: colors.primary },
  osd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  osdText: { color: '#fff', fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  osdBar: { position: 'absolute', left: spacing.xxl, right: spacing.xxl, bottom: spacing.xl },
  panelBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'flex-end' },
  panel: { width: 340, maxWidth: '85%', height: '100%', backgroundColor: 'rgba(21,24,33,0.97)', padding: spacing.lg },
  panelTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
  panelHeading: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs },
  panelEmpty: { color: colors.textMuted, fontSize: 14, paddingVertical: spacing.sm, paddingLeft: 30 },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  panelRowFocused: { backgroundColor: colors.surfaceAlt },
  panelLabel: { color: colors.textDim, fontSize: 15 },
  panelDetail: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
});
