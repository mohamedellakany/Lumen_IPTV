import { useKeepAwake } from 'expo-keep-awake';
import { useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { PLAYER_USER_AGENT } from '@/api/streamCheck';

import { getVlcPlayerView, isVlcAvailable, type VlcPlayerViewRef, type VlcTracks } from '../../../modules/vlc-player/src';
import type { TrackInfo, VideoSurfaceProps } from './types';

// Looked up once; the native view only exists in iOS builds (VideoSurface checks before using this).
const VlcPlayerView = isVlcAvailable ? getVlcPlayerView() : null;

const toTrackInfo = (t: VlcTracks): TrackInfo => ({
  audio: t.audio,
  subtitles: t.subtitles,
  selectedAudio: t.selectedAudio ?? undefined,
  selectedSubtitle: t.selectedSubtitle ?? undefined,
});

/**
 * iOS playback through libVLC, for streams AVPlayer can't show: HEVC inside MPEG-TS (common for 4K
 * live channels), MKV, AVI. No Picture-in-Picture or AirPlay, so it's only used as a fallback.
 */
export function VlcSurface({
  uri,
  isLive,
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
  const viewRef = useRef<VlcPlayerViewRef>(null);
  const state = useRef({ playing: false, position: 0 });
  const tracks = useRef<TrackInfo>({ audio: [], subtitles: [] });
  const lastSaved = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      play: () => void viewRef.current?.play(),
      pause: () => void viewRef.current?.pause(),
      togglePlay: () => void (state.current.playing ? viewRef.current?.pause() : viewRef.current?.play()),
      seekBy: (seconds) => void viewRef.current?.seekTo(state.current.position + seconds),
      seekTo: (seconds) => void viewRef.current?.seekTo(seconds),
      getTracks: () => tracks.current,
      setAudioTrack: (id) => void viewRef.current?.setAudioTrack(Number(id)),
      setSubtitleTrack: (id) => void viewRef.current?.setSubtitleTrack(id === undefined ? -1 : Number(id)),
    }),
    [],
  );

  if (!VlcPlayerView) return null;
  return (
    <VlcPlayerView
      ref={viewRef}
      style={StyleSheet.absoluteFill}
      uri={uri}
      userAgent={PLAYER_USER_AGENT}
      isLive={isLive}
      startAt={isLive ? 0 : startAt}
      contentFit={contentFit}
      onStateChange={({ nativeEvent: s }) => {
        state.current = { playing: s.playing, position: s.position };
        onStateChange?.(s);
        if (isLive || !s.duration || Math.abs(s.position - lastSaved.current) < 5) return;
        lastSaved.current = s.position;
        onProgress?.(s.position, s.duration);
      }}
      onTracksChange={({ nativeEvent }) => {
        tracks.current = toTrackInfo(nativeEvent);
        onTracksChange?.(tracks.current);
      }}
      onEnded={() => onEnded?.()}
      onError={({ nativeEvent }) => onError?.(nativeEvent.message)}
    />
  );
}
