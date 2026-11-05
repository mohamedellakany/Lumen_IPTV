import { useEvent, useEventListener } from 'expo';
import { useKeepAwake } from 'expo-keep-awake';
import { useVideoPlayer, VideoView, type AudioTrack, type SubtitleTrack, type VideoPlayer } from 'expo-video';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { isHevcInTs, PLAYER_USER_AGENT } from '@/api/streamCheck';

import { isVlcAvailable } from '../../../modules/vlc-player/src';
import { trackLabel, type PlaybackState, type TrackInfo, type VideoSurfaceProps } from './types';
import { VlcSurface } from './VlcSurface';

const trackId = (t: AudioTrack | SubtitleTrack, i: number) => t.id ?? `${t.language}|${t.label}|${i}`;

// Kept outside the component: the React Compiler treats hook return values as immutable.
function setTrack(player: VideoPlayer, kind: 'audioTrack' | 'subtitleTrack', track: AudioTrack | SubtitleTrack | null) {
  player[kind] = track;
}

function readTracks(player: VideoPlayer): TrackInfo {
  const audio = player.availableAudioTracks ?? [];
  const subs = player.availableSubtitleTracks ?? [];
  const current = (list: (AudioTrack | SubtitleTrack)[], selected: AudioTrack | SubtitleTrack | null) => {
    if (!selected) return undefined;
    const i = list.findIndex((t) => t === selected || (t.language === selected.language && t.label === selected.label));
    return i >= 0 ? trackId(list[i], i) : undefined;
  };
  return {
    audio: audio.map((t, i) => ({ id: trackId(t, i), label: trackLabel(t, i) })),
    subtitles: subs.map((t, i) => ({ id: trackId(t, i), label: trackLabel(t, i) })),
    selectedAudio: current(audio, player.audioTrack),
    selectedSubtitle: current(subs, player.subtitleTrack),
  };
}

// iOS: containers AVPlayer can't open at all go straight to VLC.
const VLC_FIRST = /\.(mkv|avi|wmv|flv|webm)(\?|$)/i;
// How long AVPlayer may play with no picture before we decide it can't decode the video.
const NO_PICTURE_MS = 4000;

/**
 * Native playback. Android / Fire TV: ExoPlayer. iOS: AVPlayer first (AirPlay, Picture-in-Picture,
 * lock-screen controls), switching to VLC for streams AVPlayer can't show.
 */
export function VideoSurface(props: VideoSurfaceProps) {
  const vlcFallback = Platform.OS === 'ios' && isVlcAvailable;
  // The stream that AVPlayer failed on; any other stream starts on AVPlayer again.
  const [vlcUri, setVlcUri] = useState<string | null>(null);

  // HEVC inside MPEG-TS (typical of 4K live channels): AVPlayer would play only the sound, and may not
  // say so. Check the stream itself and hand it to VLC as soon as that's known.
  const { uri } = props;
  useEffect(() => {
    if (!vlcFallback || !/\.m3u8(\?|$)/i.test(uri)) return;
    let cancelled = false;
    isHevcInTs(uri).then((hevc) => {
      if (hevc && !cancelled) setVlcUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [vlcFallback, uri]);

  if (vlcFallback && (vlcUri === props.uri || VLC_FIRST.test(props.uri))) return <VlcSurface {...props} />;
  const toVlc = () => setVlcUri(props.uri);
  return <AppleSurface {...props} onError={vlcFallback ? toVlc : props.onError} onNoPicture={vlcFallback ? toVlc : undefined} />;
}

/** AVPlayer (iOS) / ExoPlayer (Android) through expo-video. */
function AppleSurface({
  uri,
  isLive,
  title,
  artwork,
  controls = 'native',
  contentFit = 'contain',
  startAt,
  onProgress,
  onStateChange,
  onTracksChange,
  onEnded,
  onError,
  onNoPicture,
  ref,
}: VideoSurfaceProps & {
  /** Playing, but no video track appeared: e.g. HEVC in MPEG-TS on iOS, where only the sound plays. */
  onNoPicture?: () => void;
}) {
  useKeepAwake();
  const resumed = useRef(false);
  const lastSaved = useRef(0);
  const viewRef = useRef<VideoView>(null);
  const custom = controls === 'none';

  const player = useVideoPlayer(
    {
      uri,
      headers: { 'User-Agent': PLAYER_USER_AGENT },
      contentType: /\.m3u8(\?|$)/i.test(uri) ? 'hls' : 'auto',
      metadata: { title, artwork },
    },
    (p) => {
      // Custom controls need a smooth progress bar; native controls only need periodic saves.
      p.timeUpdateEventInterval = custom ? 1 : 5;
      p.showNowPlayingNotification = true;
      p.staysActiveInBackground = true;
      p.play();
    },
  );

  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (status === 'readyToPlay' && !resumed.current) {
      resumed.current = true;
      if (!isLive && startAt && startAt > 0) player.seekBy(startAt - player.currentTime);
    }
    if (status === 'error') onError?.(error?.message ?? 'This stream could not be played.');
    onStateChange?.({
      playing: isPlaying,
      position: player.currentTime,
      duration: isLive ? 0 : player.duration,
      buffering: status === 'loading',
    });
  }, [status, error, isPlaying, isLive, startAt, player, onError, onStateChange]);

  // Sound without picture: once playing, give AVPlayer a few seconds to report a video track.
  useEffect(() => {
    if (!onNoPicture || !isPlaying || status !== 'readyToPlay') return;
    const timer = setTimeout(() => {
      const video = player.videoTrack;
      if (!video || !video.size?.width) onNoPicture();
    }, NO_PICTURE_MS);
    return () => clearTimeout(timer);
  }, [onNoPicture, isPlaying, status, player]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const state: PlaybackState = {
      playing: player.playing,
      position: currentTime,
      duration: isLive ? 0 : player.duration,
      buffering: player.status === 'loading',
    };
    onStateChange?.(state);
    if (isLive || Math.abs(currentTime - lastSaved.current) < 5) return;
    lastSaved.current = currentTime;
    onProgress?.(currentTime, player.duration);
  });

  useEventListener(player, 'sourceLoad', () => onTracksChange?.(readTracks(player)));
  useEventListener(player, 'availableAudioTracksChange', () => onTracksChange?.(readTracks(player)));
  useEventListener(player, 'availableSubtitleTracksChange', () => onTracksChange?.(readTracks(player)));
  useEventListener(player, 'playToEnd', () => onEnded?.());

  useImperativeHandle(
    ref,
    () => ({
      play: () => player.play(),
      pause: () => player.pause(),
      togglePlay: () => (player.playing ? player.pause() : player.play()),
      seekBy: (seconds) => player.seekBy(seconds),
      seekTo: (seconds) => player.seekBy(seconds - player.currentTime),
      getTracks: () => readTracks(player),
      setAudioTrack: (id) => {
        const list = player.availableAudioTracks ?? [];
        const track = list.find((t, i) => trackId(t, i) === id);
        if (track) setTrack(player, 'audioTrack', track);
      },
      setSubtitleTrack: (id) => {
        const list = player.availableSubtitleTracks ?? [];
        setTrack(player, 'subtitleTrack', id === undefined ? null : (list.find((t, i) => trackId(t, i) === id) ?? null));
      },
      startPictureInPicture: () => {
        viewRef.current?.startPictureInPicture().catch(() => {});
      },
    }),
    [player],
  );

  return (
    <VideoView
      ref={viewRef}
      player={player}
      style={StyleSheet.absoluteFill}
      nativeControls={!custom}
      contentFit={contentFit}
      fullscreenOptions={{ enable: !custom }}
      allowsPictureInPicture
      focusable={!custom}
    />
  );
}
