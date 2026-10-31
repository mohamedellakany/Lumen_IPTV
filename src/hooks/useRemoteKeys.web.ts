import { useEffect, useEffectEvent } from 'react';

export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'playPause' | 'fastForward' | 'rewind' | 'back';

const KEY_MAP: Record<string, RemoteKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  ' ': 'playPause',
  k: 'playPause',
  MediaPlayPause: 'playPause',
  MediaFastForward: 'fastForward',
  MediaRewind: 'rewind',
  Escape: 'back',
};

/** Browser keyboard equivalent of the TV remote, so the TV player can be tested on the web. */
export function useRemoteKeys(handler: (key: RemoteKey) => void, enabled = true) {
  const onKey = useEffectEvent(handler);
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const key = KEY_MAP[event.key];
      if (!key) return;
      // Let Enter/Space activate a focused button normally.
      if ((key === 'select' || key === 'playPause') && target?.getAttribute('role') === 'button') return;
      event.preventDefault();
      onKey(key);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [enabled]);
}
