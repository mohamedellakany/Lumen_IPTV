import { useEffect, useEffectEvent } from 'react';
import { Platform, TVEventHandler } from 'react-native';

export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'playPause' | 'fastForward' | 'rewind' | 'back';

const KEYS = new Set<string>(['up', 'down', 'left', 'right', 'select', 'playPause', 'fastForward', 'rewind']);
const KEY_DOWN = 0;
const KEY_UP = 1;

/**
 * TV remote (D-pad and media keys). Back is handled separately with BackHandler.
 *
 * Android delivers key-down (repeated while held) and key-up, but when a key press moves focus
 * between buttons the system consumes the key-down and only key-up reaches us. So: act on
 * key-down when it arrives (instant, and repeats while held), otherwise act on key-up — never both.
 */
export function useRemoteKeys(handler: (key: RemoteKey) => void, enabled = true) {
  const onKey = useEffectEvent(handler);
  useEffect(() => {
    if (!enabled || !Platform.isTV) return;
    const sawKeyDown = new Set<string>();
    const subscription = TVEventHandler.addListener((event) => {
      const key = event?.eventType;
      if (!key || !KEYS.has(key)) return;
      const action = Number(event.eventKeyAction);
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
    return () => subscription?.remove();
  }, [enabled]);
}
