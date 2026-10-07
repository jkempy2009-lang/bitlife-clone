import type { PlayerState } from "@/types/game.types";

const KEY = "lifeline-save-v1";

export interface SaveData {
  v: 1;
  player: PlayerState;
  rngState: number;
}

// Tiny external store so React can read "is there a save?" without setState-in-effect.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const subscribeSave = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
export const hasSaveSnapshot = () => loadGame() !== null;

export function saveGame(player: PlayerState, rngState: number) {
  try {
    const data: SaveData = { v: 1, player, rngState };
    localStorage.setItem(KEY, JSON.stringify(data));
    notify();
  } catch {
    /* storage may be unavailable (private mode / quota) */
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1 || typeof data.player?.age !== "number" || !Array.isArray(data.player.relatives)) return null;
    return { ...data, player: hydrate(data.player) };
  } catch {
    return null;
  }
}

/** Fill in fields added after a save was written so older saves keep working. */
function hydrate(p: PlayerState): PlayerState {
  return {
    ...p,
    skills: { ...p.skills, athletics: p.skills.athletics ?? 0 },
    influencer: p.influencer ?? { active: false, followers: 0, lastPostYear: 0 },
    athlete: p.athlete ?? { sport: null },
    hobbies: p.hobbies ?? {},
    politics: { ...p.politics, party: p.politics?.party ?? null },
    economy: p.economy ?? { climate: "normal", yearsLeft: 2 },
    residence: p.residence ?? { country: p.birthCountry, city: p.birthCity, rentTier: 1 },
    investments: p.investments ?? {},
    vices: p.vices ?? { smoking: 0, alcohol: 0, drugs: 0, gambling: 0 },
    probation: p.probation ?? null,
    pregnancy: p.pregnancy ?? null,
    blackjack: p.blackjack ?? null,
    matureContent: p.matureContent ?? true,
    business: p.business ? { ...p.business, staff: p.business.staff ?? 0, locations: p.business.locations ?? 1 } : null,
    achievements: p.achievements ?? [],
    history: p.history ?? [],
    stats: { ...p.stats, highestSalary: p.stats.highestSalary ?? 0, kills: p.stats.kills ?? 0, affairs: p.stats.affairs ?? 0, hookups: p.stats.hookups ?? 0 },
  };
}

/** Parse a pasted/exported save. Returns null if it doesn't look like a valid save. */
export function parseSave(input: string): SaveData | null {
  try {
    let json = input.trim();
    if (!json.startsWith("{")) {
      // Share codes are base64-encoded JSON.
      json = decodeURIComponent(escape(atob(json)));
    }
    const data = JSON.parse(json) as SaveData;
    if (data.v !== 1 || typeof data.player?.age !== "number" || !Array.isArray(data.player.relatives)) return null;
    return { ...data, rngState: typeof data.rngState === "number" ? data.rngState : 1, player: hydrate(data.player) };
  } catch {
    return null;
  }
}

export function exportSave(player: PlayerState, rngState: number): string {
  return JSON.stringify({ v: 1, player, rngState } satisfies SaveData);
}

/** Compact share code (base64) that's easy to paste into a message. */
export function exportShareCode(player: PlayerState, rngState: number): string {
  return btoa(unescape(encodeURIComponent(exportSave(player, rngState))));
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    notify();
  } catch {
    /* ignore */
  }
}
