/** The Hall of Lives: persists across characters in its own storage key. */
import type { PlayerState } from "@/types/game.types";
import { epitaph, summarize } from "./legacy";

const KEY = "lifeline-hall-v1";

export interface HallLife {
  key: string;
  name: string;
  age: number;
  birthYear: number;
  deathYear: number;
  country: string;
  cause: string;
  netWorth: number;
  epitaph: string;
  generation: number;
  career: string;
}

export interface Hall {
  lives: HallLife[];
  achievements: string[];
}

const EMPTY: Hall = { lives: [], achievements: [] };
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheValue: Hall = EMPTY;

export const subscribeHall = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function readHall(): Hall {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cacheRaw) return cacheValue;
    cacheRaw = raw;
    cacheValue = raw ? { ...EMPTY, ...(JSON.parse(raw) as Hall) } : EMPTY;
    return cacheValue;
  } catch {
    return EMPTY;
  }
}

export const hallServerSnapshot = () => EMPTY;

function write(h: Hall) {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
    listeners.forEach((l) => l());
  } catch {
    /* ignore */
  }
}

export function recordLife(p: PlayerState) {
  const hall = readHall();
  const key = `${p.id}:${p.generation}:${p.deathYear}`;
  if (hall.lives.some((l) => l.key === key)) return;
  const s = summarize(p);
  const life: HallLife = {
    key,
    name: `${p.firstName} ${p.lastName}`,
    age: p.age,
    birthYear: p.birthYear,
    deathYear: p.deathYear ?? p.year,
    country: p.birthCountry,
    cause: p.causeOfDeath ?? "unknown",
    netWorth: s.netWorth,
    epitaph: epitaph(p),
    generation: p.generation,
    career: s.highestCareer,
  };
  write({ ...hall, lives: [life, ...hall.lives].slice(0, 50) });
}

export function recordAchievements(ids: string[]) {
  const hall = readHall();
  const merged = Array.from(new Set([...hall.achievements, ...ids]));
  if (merged.length !== hall.achievements.length) write({ ...hall, achievements: merged });
}

export function clearHall() {
  try {
    localStorage.removeItem(KEY);
    cacheRaw = undefined;
    listeners.forEach((l) => l());
  } catch {
    /* ignore */
  }
}
