import { useEffect, useEffectEvent } from 'react';
import { Platform, TVEventHandler } from 'react-native';

export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'playPause' | 'fastForward' | 'rewind' | 'back';

const KEYS = new Set<string>(['up', 'down', 'left', 'right', 'select', 'playPause', 'fastForward', 'rewind']);
const KEY_DOWN = 0;
const KEY_UP = 1;
/**
 * Holding a key: Android TV sends one press, then (after ~0.3s) a single "long" event, and nothing more
 * until release. For these keys the press is repeated while held, so seeking keeps going (and speeds up).
 */
const REPEAT_WHILE_HELD: Record<string, RemoteKey> = {
  longLeft: 'left',
  longRight: 'right',
  longRewind: 'rewind',
  longFastForward: 'fastForward',
};
const REPEAT_MS = 110;

/**
 * TV remote (D-pad and media keys). Back is handled separately with BackHandler.
 *
 * Android delivers key-down and key-up, but when a key press moves focus between buttons the system
 * consumes the key-down and only key-up reaches us. So: act on key-down when it arrives (instant),
 * otherwise act on key-up — never both. Held seek keys repeat via REPEAT_WHILE_HELD.
 */
export function useRemoteKeys(handler: (key: RemoteKey) => void, enabled = true) {
  const onKey = useEffectEvent(handler);
  useEffect(() => {
    if (!enabled || !Platform.isTV) return;
    const sawKeyDown = new Set<string>();
    let held: { key: string; timer: ReturnType<typeof setInterval> } | null = null;
    const stopRepeat = () => {
      if (held) clearInterval(held.timer);
      held = null;
    };
    const subscription = TVEventHandler.addListener((event) => {
      const key = event?.eventType;
      if (!key) return;
      const action = Number(event.eventKeyAction);
      const repeated = REPEAT_WHILE_HELD[key];
      if (repeated) {
        // Long press of a seek key: repeat it until the key comes back up.
        if (action === KEY_UP) return stopRepeat();
        if (held?.key === key) return;
        stopRepeat();
        onKey(repeated);
        held = { key, timer: setInterval(() => onKey(repeated), REPEAT_MS) };
        return;
      }
      if (!KEYS.has(key)) return;
      // Any other key ends a repeat (in case the release event was missed).
      if (held) stopRepeat();
      if (action === KEY_DOWN) {
        sawKeyDown.add(key);
        onKey(key as RemoteKey);
      } else if (action === KEY_UP) {
        if (sawKeyDown.delete(key)) return;
        onKey(key as RemoteKey);
      } else {
        // No action info (older/other platforms): treat as a single press.
        onKey(key as RemoteKey);
      }
    });
    return () => {
      stopRepeat();
      subscription?.remove();
    };
  }, [enabled]);
}
