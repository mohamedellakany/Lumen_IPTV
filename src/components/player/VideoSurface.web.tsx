import { useEffect, useEffectEvent, useImperativeHandle, useRef } from 'react';

import { proxify } from '@/api/http';
import { seekTarget, type PlaybackState, type VideoSurfaceProps } from './types';

const isHls = (url: string) => /\.m3u8(\?|$)/i.test(url);
const isMpegTs = (url: string) => /\.ts(\?|$)/i.test(url);

/**
 * Browser playback. Chrome/Firefox can't play HLS or raw MPEG-TS natively, so we use hls.js for .m3u8
 * and mpegts.js for live .ts streams. Safari plays HLS natively. Everything goes through the dev proxy.
 */
export function VideoSurface({
  uri,
  isLive,
  controls = 'native',
  contentFit = 'contain',
  startAt,
  onProgress,
  onStateChange,
  onEnded,
  onError,
  ref,
}: VideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const emitState = useEffectEvent((state: PlaybackState) => onStateChange?.(state));
  const emitProgress = useEffectEvent((position: number, duration: number) => onProgress?.(position, duration));
  const emitEnded = useEffectEvent(() => onEnded?.());
  const emitError = useEffectEvent((message: string) => onError?.(message));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let destroy: (() => void) | undefined;
    const src = proxify(uri);
    const fail = (message: string) => {
      if (!disposed) emitError(message);
    };

    (async () => {
      const Hls = isHls(uri) ? (await import('hls.js')).default : null;
      if (disposed) return;
      // Prefer hls.js wherever MSE exists: native HLS in desktop Chrome is newer and less tolerant of
      // IPTV playlists. Native HLS is the fallback (e.g. older iOS Safari without MSE).
      if (Hls?.isSupported()) {
        // IPTV streams are regular (not low-latency) HLS; low-latency mode only adds extra playlist reloads.
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: isLive ? 30 : 90 });
        // Consecutive failures; reset whenever video is flowing again, so occasional blips during a
        // long match never add up to a fatal error.
        let failures = 0;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        hls.on(Hls.Events.FRAG_LOADED, () => {
          failures = 0;
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          failures++;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && failures <= 3) {
            hls.recoverMediaError();
          } else if (failures <= 2) {
            // IPTV servers intermittently answer a playlist refresh with an empty/garbled reply.
            // Resume loading in place: the buffered video keeps playing, so this is invisible.
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => !disposed && hls.startLoad(), 500 * failures);
          } else if (failures <= 5) {
            // Still failing (often an expired token): reload from the original channel URL, which gets
            // a fresh redirect and token.
            clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (disposed) return;
              hls.loadSource(src);
              hls.startLoad();
            }, 1000 * failures);
          } else {
            fail(`The stream stopped responding (${data.details}).`);
          }
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        destroy = () => {
          clearTimeout(retryTimer);
          hls.destroy();
        };
      } else if (Hls && !video.canPlayType('application/vnd.apple.mpegurl')) {
        return fail('HLS playback is not supported in this browser.');
      } else if (isMpegTs(uri)) {
        const { default: mpegts } = await import('mpegts.js');
        if (disposed) return;
        if (!mpegts.getFeatureList().mseLivePlayback) return fail('MPEG-TS playback is not supported in this browser. Switch Live format to HLS in Settings.');
        const player = mpegts.createPlayer(
          { type: 'mpegts', isLive: true, url: src },
          { enableWorker: true, liveBufferLatencyChasing: true, lazyLoad: false },
        );
        player.on(mpegts.Events.ERROR, (_type: string, detail: string) => fail(`Stream error: ${detail}`));
        player.attachMediaElement(video);
        player.load();
        destroy = () => player.destroy();
      } else {
        video.src = src;
        destroy = () => {
          video.removeAttribute('src');
          video.load();
        };
      }
      video.play().catch(() => {
        // Autoplay can be blocked until the user interacts; the native controls let them start playback.
      });
    })().catch((error: unknown) => fail(error instanceof Error ? error.message : 'Playback failed.'));

    return () => {
      disposed = true;
      destroy?.();
    };
  }, [uri, isLive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let resumed = false;
    let lastReport = 0;
    const onLoaded = () => {
      if (!resumed && !isLive && startAt && startAt > 0 && Number.isFinite(video.duration)) video.currentTime = startAt;
      resumed = true;
    };
    const onTime = () => {
      const seekedBack = video.currentTime < lastReport;
      if (isLive || (video.currentTime - lastReport < 5 && !seekedBack)) return;
      lastReport = video.currentTime;
      emitProgress(video.currentTime, Number.isFinite(video.duration) ? video.duration : 0);
    };
    const report = () =>
      emitState({
        playing: !video.paused && !video.ended,
        position: video.currentTime,
        duration: isLive || !Number.isFinite(video.duration) ? 0 : video.duration,
        buffering: video.readyState < 3 && !video.paused,
      });
    const onEnd = () => emitEnded();
    const onErr = () => {
      // Tearing down a player empties the src, which fires a harmless error event.
      if (!video.getAttribute('src')) return;
      const code = video.error?.code;
      if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        emitError('This format is not supported by your browser (often MKV/HEVC). It should play in the mobile app.');
      } else if (code) emitError('The stream could not be loaded.');
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnd);
    video.addEventListener('error', onErr);
    const stateEvents = ['timeupdate', 'play', 'pause', 'waiting', 'playing', 'seeked', 'durationchange'];
    for (const name of stateEvents) video.addEventListener(name, report);
    return () => {
      for (const name of stateEvents) video.removeEventListener(name, report);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('error', onErr);
    };
  }, [uri, isLive, startAt]);

  useImperativeHandle(
    ref,
    () => {
      const video = () => videoRef.current;
      return {
        play: () => void video()?.play().catch(() => {}),
        pause: () => video()?.pause(),
        togglePlay: () => {
          const v = video();
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        },
        seekBy: (seconds) => {
          const v = video();
          const target = v && seekTarget(v.currentTime + seconds, v.duration);
          if (v && target !== null) v.currentTime = target;
        },
        seekTo: (seconds) => {
          const v = video();
          const target = v && seekTarget(seconds, v.duration);
          if (v && target !== null) v.currentTime = target;
        },
        // Track switching isn't wired up in the browser build; the mobile/TV apps support it.
        getTracks: () => ({ audio: [], subtitles: [] }),
        setAudioTrack: () => {},
        setSubtitleTrack: () => {},
        startPictureInPicture: () => {
          video()?.requestPictureInPicture?.().catch(() => {});
        },
      };
    },
    [],
  );

  return (
    <video
      ref={videoRef}
      controls={controls === 'native'}
      autoPlay
      playsInline
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: '#000', objectFit: contentFit }}
    />
  );
}
