import { requireNativeView, requireOptionalNativeModule } from 'expo';
import type { ComponentType, Ref } from 'react';
import type { ViewProps } from 'react-native';

export interface VlcPlaybackState {
  playing: boolean;
  /** Seconds. */
  position: number;
  /** Seconds; 0 for live streams. */
  duration: number;
  buffering: boolean;
}

export interface VlcTracks {
  audio: { id: string; label: string }[];
  subtitles: { id: string; label: string }[];
  selectedAudio?: string | null;
  selectedSubtitle?: string | null;
}

/** View functions, called through a ref. */
export interface VlcPlayerViewRef {
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  setAudioTrack(id: number): Promise<void>;
  /** -1 turns subtitles off. */
  setSubtitleTrack(id: number): Promise<void>;
}

export type VlcPlayerViewProps = ViewProps & {
  uri: string;
  userAgent?: string;
  isLive?: boolean;
  /** Seconds to resume from (VOD only). */
  startAt?: number;
  contentFit?: 'contain' | 'cover' | 'fill';
  onStateChange?: (event: { nativeEvent: VlcPlaybackState }) => void;
  onTracksChange?: (event: { nativeEvent: VlcTracks }) => void;
  onEnded?: () => void;
  onError?: (event: { nativeEvent: { message: string } }) => void;
  ref?: Ref<VlcPlayerViewRef>;
};

/** True when the VLC engine is built into this app (iOS builds only). */
export const isVlcAvailable = requireOptionalNativeModule('VlcPlayer') != null;

let view: ComponentType<VlcPlayerViewProps> | null = null;

/** The native VLC view. Only call when `isVlcAvailable` is true: the view doesn't exist elsewhere. */
export function getVlcPlayerView(): ComponentType<VlcPlayerViewProps> {
  view ??= requireNativeView<VlcPlayerViewProps>('VlcPlayer');
  return view;
}
