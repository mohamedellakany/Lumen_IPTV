import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

// Set when a section opens a detail screen or the player, so coming back with Back keeps the
// viewer's place instead of jumping to the top again.
let returningFromChild = false;

export function markOpeningChild() {
  returningFromChild = true;
}

/** Runs `onEnter` each time the viewer opens this section (not when returning from a child screen). */
export function useSectionEntry(onEnter: () => void) {
  const latest = useRef(onEnter);
  useEffect(() => {
    latest.current = onEnter;
  });
  useFocusEffect(
    useCallback(() => {
      if (returningFromChild) {
        returningFromChild = false;
        return;
      }
      latest.current();
    }, []),
  );
}
