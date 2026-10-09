"use client";

import { useCallback, useState } from "react";
import type { TabId } from "@/types/game.types";

/**
 * Tiny navigation memory shared by the tab screens.
 *  - `requestSection` lets any screen (e.g. the "This year" guide) deep-link into a section of another tab.
 *  - `useSection` is a drop-in for the `useState` each tab used for its section chips; it honours a pending
 *    request, otherwise remembers the section you were last on so switching tabs doesn't reset your place.
 * Pure module state: nothing here is saved, and an unknown or stale section id always falls back safely.
 */
const pending: Partial<Record<TabId, string>> = {};
const lastSeen: Partial<Record<TabId, string>> = {};

export function requestSection(tab: TabId, section: string | undefined) {
  if (section) pending[tab] = section;
}

/** Forget remembered sections (a new life starts from each tab's default). */
export function resetSections() {
  for (const k of Object.keys(pending)) delete pending[k as TabId];
  for (const k of Object.keys(lastSeen)) delete lastSeen[k as TabId];
}

export function pickSection<T extends string>(tab: TabId, valid: readonly T[], fallback: T): T {
  const want = pending[tab];
  if (want !== undefined) {
    delete pending[tab];
    // Remember it so a second call (React strict-mode double init) lands on the same section.
    if ((valid as readonly string[]).includes(want)) {
      lastSeen[tab] = want;
      return want as T;
    }
  }
  const last = lastSeen[tab];
  if (last !== undefined && (valid as readonly string[]).includes(last)) return last as T;
  return fallback;
}

export function useSection<T extends string>(tab: TabId, valid: readonly T[], fallback: T): [T, (s: T) => void] {
  const [section, set] = useState<T>(() => pickSection(tab, valid, fallback));
  const setSection = useCallback(
    (s: T) => {
      lastSeen[tab] = s;
      set(s);
    },
    [tab],
  );
  return [section, setSection];
}
