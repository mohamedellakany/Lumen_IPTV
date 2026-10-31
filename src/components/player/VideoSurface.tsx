import { useEvent, useEventListener } from 'expo';
import { useKeepAwake } from 'expo-keep-awake';
import { useVideoPlayer, VideoView, type AudioTrack, type SubtitleTrack, type VideoPlayer } from 'expo-video';
import { useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { PLAYER_USER_AGENT } from '@/api/streamCheck';

import { trackLabel, type PlaybackState, type TrackInfo, type VideoSurfaceProps } from './types';

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

/** Native playback (AVPlayer on iOS, ExoPlayer on Android / Fire TV). */
export function VideoSurface({
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
  ref,
}: VideoSurfaceProps) {
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
