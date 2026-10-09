"use client";

import { useSyncExternalStore } from "react";

/** First-run onboarding flag: the "Getting started" card is shown until it is dismissed once, on this browser. */
const KEY = "lifeline-coach-v1";
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  if (cached !== null) return cached;
  try {
    cached = localStorage.getItem(KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

export function dismissCoach() {
  cached = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode: it simply comes back next visit */
  }
  listeners.forEach((l) => l());
}

/** True while the onboarding card should show. Server render says false so there is no hydration flash. */
export function useCoachVisible(): boolean {
  const dismissed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    read,
    () => true,
  );
  return !dismissed;
}
