import type { Ref } from 'react';

export interface PlaybackState {
  playing: boolean;
  /** Seconds. */
  position: number;
  /** Seconds; 0 when unknown (e.g. live). */
  duration: number;
  buffering: boolean;
}

export interface MediaTrack {
  id: string;
  label: string;
}

export interface TrackInfo {
  audio: MediaTrack[];
  subtitles: MediaTrack[];
  selectedAudio?: string;
  /** undefined = subtitles off */
  selectedSubtitle?: string;
}

/** Imperative controls used by the custom player UI. */
export interface VideoSurfaceHandle {
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekBy(seconds: number): void;
  seekTo(seconds: number): void;
  getTracks(): TrackInfo;
  setAudioTrack(id: string): void;
  /** Pass undefined to turn subtitles off. */
  setSubtitleTrack(id: string | undefined): void;
  startPictureInPicture?(): void;
}

export interface VideoSurfaceProps {
  uri: string;
  isLive: boolean;
  title: string;
  artwork?: string;
  /** "native" shows the platform's built-in controls; "none" leaves the UI to us. */
  controls?: 'native' | 'none';
  /** How the picture fills the screen: fit (letterbox), fill (crop) or stretch. */
  contentFit?: 'contain' | 'cover' | 'fill';
  /** Seconds to resume from (VOD only). */
  startAt?: number;
  /** Called every few seconds with the playback position, for saving progress. */
  onProgress?: (position: number, duration: number) => void;
  /** Called about once per second, and on play/pause/buffering changes. */
  onStateChange?: (state: PlaybackState) => void;
  /** Called when the available audio/subtitle tracks change. */
  onTracksChange?: (tracks: TrackInfo) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
  ref?: Ref<VideoSurfaceHandle>;
}

/**
 * A seek target the players can accept: a real number of seconds, at least 0 and (when known) before
 * the end. Returns null for anything else (NaN/Infinity), which callers then ignore.
 */
export function seekTarget(seconds: number, duration?: number): number | null {
  if (!Number.isFinite(seconds)) return null;
  const end = duration && Number.isFinite(duration) && duration > 0 ? duration : Infinity;
  return Math.max(0, Math.min(seconds, end));
}

export const trackLabel = (t: { label?: string; language?: string }, index: number) =>
  t.label || (t.language ? t.language.toUpperCase() : `Track ${index + 1}`);
