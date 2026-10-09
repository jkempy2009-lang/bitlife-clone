import type { Notice, PlayerState, Talents } from "@/types/game.types";
import { EVENT_BY_ID } from "@/data/lifeEventsEngine";
import { netWorth, playerTitle } from "./state";
import { TALENT_KEYS } from "@/data/talents";
import { hydrateAthlete } from "./athleteState";
import { upgradeBusiness } from "./business";
import { hydrateCrimeLife } from "./justiceState";
import { hydrateCreative } from "./creativeState";
import { hydrateCourt } from "./courtState";
import { hydrateDynasty } from "./dynastyState";
import { hydrateWorld } from "./worldEvents";
import { hydrateSchool } from "./school";
import { hydrateImmigration } from "./visa";
import { hydrateCareerMoney } from "./careerState";

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
/**
 * "Is there a save?" is asked on every render of the game provider, so it must be cheap: a sniff of the stored text,
 * not a parse + hydrate of the whole life. A damaged save still fails safely in `loadGame`.
 */
export const hasSaveSnapshot = () => {
  try {
    return (localStorage.getItem(KEY) ?? "").startsWith('{"v":1,');
  } catch {
    return false;
  }
};

export interface SaveSummary {
  name: string;
  age: number;
  year: number;
  generation: number;
  alive: boolean;
  title: string;
  netWorth: number;
}

let summaryCache: { raw: string | null; summary: SaveSummary | null } = { raw: null, summary: null };

/** A one-line description of the saved life for the Continue button. Cached per stored text so it is stable for React. */
export function saveSummary(): SaveSummary | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === summaryCache.raw) return summaryCache.summary;
  const data = raw ? loadGame() : null;
  const p = data?.player;
  summaryCache = {
    raw,
    summary: p
      ? { name: `${p.firstName} ${p.lastName}`, age: p.age, year: p.year, generation: p.generation, alive: p.alive, title: playerTitle(p), netWorth: netWorth(p) }
      : null,
  };
  return summaryCache.summary;
}

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

/** Stable pseudo-random gifts for saves made before talents existed. */
function legacyTalents(id: string): Talents {
  const out = {} as Talents;
  let h = 2166136261;
  for (const k of TALENT_KEYS) {
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) + k.length;
    h ^= h >>> 13;
    out[k] = 15 + (Math.abs(h) % 70);
  }
  return out;
}

/** Fill in fields added after a save was written so older saves keep working. */
export function hydrate(p: PlayerState): PlayerState {
  return {
    ...p,
    skills: { ...p.skills, athletics: p.skills.athletics ?? 0 },
    ...hydrateCreative(p),
    athlete: hydrateAthlete(p.athlete, p),
    hobbies: p.hobbies ?? {},
    politics: { ...p.politics, party: p.politics?.party ?? null },
    economy: p.economy ?? { climate: "normal", yearsLeft: 2 },
    residence: p.residence ?? { country: p.birthCountry, city: p.birthCity, rentTier: 1 },
    investments: p.investments ?? {},
    vices: p.vices ?? { smoking: 0, alcohol: 0, drugs: 0, gambling: 0 },
    world: hydrateWorld(p.world),
    school: hydrateSchool(p.school),
    immigration: hydrateImmigration(p.immigration, p),
    probation: p.probation ?? null,
    ...hydrateCrimeLife(p),
    pregnancy: p.pregnancy ?? null,
    blackjack: p.blackjack ?? null,
    careerYears: p.careerYears ?? (p.currentJob ? { [p.currentJob.lineId]: Math.round(p.stats?.yearsWorked ?? 0) } : {}),
    intimacy: p.intimacy ?? { ageAuto: true, ageMin: 18, ageMax: 60, genders: [], interests: ["sensual", "playful"] },
    parentingStyle: p.parentingStyle ?? "balanced",
    retirementSavings: p.retirementSavings ?? 0,
    savingsLevel: p.savingsLevel ?? 1,
    ...hydrateCareerMoney(p),
    royal: p.royal ?? (p.royalRank === "none" ? null : { crown: p.royalRank === "King" || p.royalRank === "Queen" ? "self" : "parent", hrh: true, peerage: null, line: p.royalRank === "King" || p.royalRank === "Queen" ? 0 : 1 }),
    court: hydrateCourt(p.court, p),
    dynasty: hydrateDynasty(p),
    outlook: p.outlook ?? 84,
    talents: { ...legacyTalents(p.id), ...(p.talents ?? {}) },
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
    scheduled: Array.isArray(p.scheduled) ? p.scheduled.filter((s) => s && typeof s.id === "string" && typeof s.dueYear === "number") : [],
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

// ---------------------------------------------------------------------------
// Pending decisions: the event or result you were looking at when the tab closed.
// ---------------------------------------------------------------------------

const PENDING_KEY = "lifeline-pending-v1";

type StoredNotice = Extract<Notice, { kind: "info" }> | { id: string; kind: "event"; eventId: string };

/** Remember unanswered notices next to the save, so reloading mid-year doesn't silently swallow a decision. */
export function savePending(player: PlayerState, notices: Notice[]) {
  try {
    if (notices.length === 0) {
      localStorage.removeItem(PENDING_KEY);
      return;
    }
    const stored: StoredNotice[] = [];
    for (const n of notices) {
      if (n.kind === "info") stored.push(n);
      // Events carry functions, so store their id; one-off generated events can't be rebuilt and are dropped.
      else if (EVENT_BY_ID[n.event.id]?.title === n.event.title) stored.push({ id: n.id, kind: "event", eventId: n.event.id });
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify({ playerId: player.id, age: player.age, notices: stored }));
  } catch {
    /* storage unavailable */
  }
}

/** Notices saved for this exact moment of this life (same person, same age), or none. */
export function loadPending(player: PlayerState): Notice[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { playerId?: string; age?: number; notices?: StoredNotice[] };
    if (data.playerId !== player.id || data.age !== player.age || !Array.isArray(data.notices)) return [];
    const out: Notice[] = [];
    for (const n of data.notices) {
      if (n?.kind === "info" && typeof n.id === "string" && typeof n.title === "string") out.push(n);
      else if (n?.kind === "event" && EVENT_BY_ID[n.eventId]) out.push({ id: n.id, kind: "event", event: EVENT_BY_ID[n.eventId] });
    }
    return out;
  } catch {
    return [];
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(KEY);
    localStorage.removeItem(PREV_KEY);
    lastSaved = null;
    notify();
  } catch {
    /* ignore */
  }
}
