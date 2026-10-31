import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, type ComponentRef } from 'react';
import { Platform, type Pressable } from 'react-native';

/*
 * TV remote focus memory, per screen ("scope"). Android drops focus while a screen is hidden behind
 * another one, and when it reappears it auto-focuses the first element before we can react. So focus
 * changes are ignored while the screen is hidden/reappearing, and once it's visible the remembered
 * element takes focus back. Kept outside React state: these system focus events shouldn't re-render.
 */
interface FocusMemory {
  last: string;
  paused: boolean;
}

const DEFAULT_FOCUS: Record<string, string> = { home: 'hero', movie: 'play', series: 'play' };
const memories = new Map<string, FocusMemory>();

function memoryFor(scope: string): FocusMemory {
  let memory = memories.get(scope);
  if (!memory) {
    memory = { last: DEFAULT_FOCUS[scope] ?? '', paused: false };
    memories.set(scope, memory);
  }
  return memory;
}

type FocusTarget = ComponentRef<typeof Pressable> & { requestTVFocus?: () => void };

/** Remember that `id` was focused (for elements that don't restore focus themselves, e.g. rail posters). */
export function rememberFocus(id: string, scope = 'home') {
  const memory = memoryFor(scope);
  if (!memory.paused) memory.last = id;
}

/** Start a screen's memory over, e.g. when a different movie opens. */
export function resetFocus(scope: string) {
  const memory = memoryFor(scope);
  memory.last = DEFAULT_FOCUS[scope] ?? '';
  memory.paused = false;
}

/** Attach `ref` and `onFocus` to a Pressable so the remote returns to it after navigating back. */
export function useRememberedFocus(id: string, scope = 'home') {
  const ref = useRef<ComponentRef<typeof Pressable>>(null);
  useFocusEffect(
    useCallback(() => {
      if (!Platform.isTV) return;
      const memory = memoryFor(scope);
      // Wait until the screen is actually visible again; hidden views can't take focus.
      const timer = setTimeout(() => {
        if (memory.last === id) (ref.current as FocusTarget | null)?.requestTVFocus?.();
        memory.paused = false;
      }, 150);
      return () => {
        clearTimeout(timer);
        memory.paused = true;
      };
    }, [id, scope]),
  );
  const onFocus = useCallback(() => rememberFocus(id, scope), [id, scope]);
  return { ref, onFocus };
}
