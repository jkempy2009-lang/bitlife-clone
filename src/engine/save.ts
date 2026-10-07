import type { PlayerState } from "@/types/game.types";
import { hydrateAthlete } from "./athleteState";
import { upgradeBusiness } from "./business";
import { hydrateCrimeLife } from "./justiceState";

const KEY = "lifeline-save-v1";
const PREV_KEY = "lifeline-save-prev";
let lastSaved: { id: string; age: number } | null = null;

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
    // Rolling backup: when the year (or life) changes, the previous year's save becomes the backup.
    if (lastSaved && (lastSaved.age !== player.age || lastSaved.id !== player.id)) {
      const existing = localStorage.getItem(KEY);
      if (existing) localStorage.setItem(PREV_KEY, existing);
    }
    lastSaved = { id: player.id, age: player.age };
    localStorage.setItem(KEY, JSON.stringify(data));
    notify();
  } catch {
    /* storage may be unavailable (private mode / quota) */
  }
}

export function loadGame(): SaveData | null {
  return readSlot(KEY);
}

/** The save from one year ago, for recovering from a bad decision or a crash. */
export function loadPreviousGame(): SaveData | null {
  return readSlot(PREV_KEY);
}

function readSlot(key: string): SaveData | null {
  try {
    const raw = localStorage.getItem(key);
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
    athlete: hydrateAthlete(p.athlete, p),
    hobbies: p.hobbies ?? {},
    politics: { ...p.politics, party: p.politics?.party ?? null },
    economy: p.economy ?? { climate: "normal", yearsLeft: 2 },
    residence: p.residence ?? { country: p.birthCountry, city: p.birthCity, rentTier: 1 },
    investments: p.investments ?? {},
    vices: p.vices ?? { smoking: 0, alcohol: 0, drugs: 0, gambling: 0 },
    probation: p.probation ?? null,
    ...hydrateCrimeLife(p),
    pregnancy: p.pregnancy ?? null,
    blackjack: p.blackjack ?? null,
    careerYears: p.careerYears ?? (p.currentJob ? { [p.currentJob.lineId]: Math.round(p.stats?.yearsWorked ?? 0) } : {}),
    intimacy: p.intimacy ?? { ageAuto: true, ageMin: 18, ageMax: 60, genders: [], interests: ["sensual", "playful"] },
    retirementSavings: p.retirementSavings ?? 0,
    savingsLevel: p.savingsLevel ?? 1,
    matureContent: p.matureContent ?? true,
    effort: p.effort ?? "steady",
    habits: p.habits ?? { exercise: 1, diet: 1 },
    lifestyle: p.lifestyle ?? 1,
    business: p.business ? upgradeBusiness({ ...p.business }) : null,
    achievements: p.achievements ?? [],
    history: p.history ?? [],
    goalsDone: p.goalsDone ?? [],
    challenge: p.challenge ?? null,
    lastYear: p.lastYear ?? null,
    recentCats: p.recentCats ?? [],
    stats: { ...p.stats, highestSalary: p.stats.highestSalary ?? 0, kills: p.stats.kills ?? 0, affairs: p.stats.affairs ?? 0, hookups: p.stats.hookups ?? 0, yearsWorked: p.stats.yearsWorked ?? Math.max(0, p.age - 22) },
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

export function restorePrevious(): boolean {
  try {
    const raw = localStorage.getItem(PREV_KEY);
    if (!raw || !readSlot(PREV_KEY)) return false;
    localStorage.setItem(KEY, raw);
    lastSaved = null;
    notify();
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PREV_KEY);
    lastSaved = null;
    notify();
  } catch {
    /* ignore */
  }
}
