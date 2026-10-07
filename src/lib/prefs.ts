"use client";

import { useSyncExternalStore } from "react";

export interface Prefs {
  text: "normal" | "large" | "huge";
  reduceMotion: boolean;
}

const KEY = "lifeline-prefs-v1";
const DEFAULTS: Prefs = { text: "normal", reduceMotion: false };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Prefs>;
      cache = {
        text: v.text === "large" || v.text === "huge" ? v.text : "normal",
        reduceMotion: !!v.reduceMotion,
      };
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = DEFAULTS;
  return cache;
}

export function applyPrefs(p: Prefs) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.text = p.text;
  document.documentElement.dataset.motion = p.reduceMotion ? "reduce" : "full";
}

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
  applyPrefs(cache);
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    read,
    () => DEFAULTS,
  );
}

const INTRO_KEY = "lifeline-intro-seen";

/** True once, on the very first life this browser starts. */
export function consumeIntro(): boolean {
  try {
    if (localStorage.getItem(INTRO_KEY)) return false;
    localStorage.setItem(INTRO_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
