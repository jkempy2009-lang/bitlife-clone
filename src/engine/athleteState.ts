/**
 * Athlete state factory, save migration and tiny predicates. Deliberately free of engine imports so that
 * state.ts, save.ts, legacy.ts and occupation.ts can use it without import cycles.
 */
import type { AthleteRecord, AthleteState, PlayerState } from "@/types/game.types";

export const newAthleteRecord = (): AthleteRecord => ({
  seasons: 0,
  proSeasons: 0,
  titles: 0,
  awards: 0,
  caps: 0,
  medals: 0,
  bestRating: 0,
  peakSalary: 0,
  earnings: 0,
  injuries: 0,
});

export const newAthleteState = (): AthleteState => ({
  sport: null,
  stage: "none",
  talent: 0,
  rating: 0,
  form: 50,
  consistency: 50,
  exposure: 0,
  club: "",
  league: 0,
  track: null,
  scholarship: false,
  warnings: 0,
  stipend: 0,
  years: 0,
  stageYears: 0,
  contractYears: 0,
  expiring: false,
  freeAgent: false,
  freeAgentYears: 0,
  agent: false,
  detrain: 0,
  doping: false,
  dopeTitles: 0,
  banYears: 0,
  injury: null,
  offers: [],
  lockedUntil: 0,
  athMirror: 0,
  retiredAge: null,
  post: "none",
  endorsements: 0,
  mental: 70,
  chemistry: 50,
  coachRel: 50,
  captain: false,
  playing: 100,
  transferReq: false,
  image: 60,
  deals: [],
  dealOffers: [],
  natCall: null,
  natPlan: "balanced",
  appeal: null,
  rival: null,
  narrative: "",
  hofYear: null,
  record: newAthleteRecord(),
  history: [],
});

/** Fill in any missing fields; migrates the old `{ sport }` + athlete job format. */
export function hydrateAthlete(raw: Partial<AthleteState> | undefined, p: Pick<PlayerState, "currentJob" | "skills" | "age">): AthleteState {
  const base = newAthleteState();
  const a: AthleteState = { ...base, ...(raw ?? {}), record: { ...base.record, ...(raw?.record ?? {}) }, history: raw?.history ?? [], offers: raw?.offers ?? [], deals: raw?.deals ?? [], dealOffers: raw?.dealOffers ?? [] };
  const legacy = raw !== undefined && raw.stage === undefined;
  if (legacy && a.sport && p.currentJob?.lineId === "athlete") {
    // Old save: a signed athlete. Give them a plausible profile rather than wiping the career.
    const ath = p.skills.athletics ?? 0;
    a.stage = p.currentJob.tier >= 1 ? "pro" : "semipro";
    a.league = Math.min(3, Math.max(0, p.currentJob.tier));
    a.club = p.currentJob.company;
    a.rating = Math.max(40, ath);
    a.talent = Math.min(100, ath + 15);
    a.years = Math.max(4, p.age - 12);
    a.contractYears = 2;
    a.exposure = 40;
    a.consistency = 60;
    a.athMirror = ath;
    a.record.seasons = 1;
    a.record.proSeasons = 1;
    a.record.bestRating = a.rating;
    a.record.peakSalary = p.currentJob.salary;
  } else if (legacy && a.sport) {
    a.sport = null;
  }
  return a;
}

/** In the amateur pipeline: school/club team, college or academy. */
export const isAmateurAthlete = (p: Pick<PlayerState, "athlete">) => p.athlete?.stage === "youth" || p.athlete?.stage === "college";
/** Holds a semi-pro or pro contract (a full-time job). */
export const isContractedAthlete = (p: Pick<PlayerState, "athlete">) => p.athlete?.stage === "semipro" || p.athlete?.stage === "pro";
export const inSport = (p: Pick<PlayerState, "athlete">) => !!p.athlete && p.athlete.stage !== "none" && p.athlete.stage !== "retired";
