/**
 * What a sporting career adds up to: a legacy score, a tier, the Hall of Fame ballot and a career summary
 * for the UI. Pure functions of the player's state apart from the ballot, which mutates the clone it is given.
 */
import type { AthleteState, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { sportInfo } from "@/data/sports";
import { addLog, changeStat, hasFlag, setFlag } from "./state";
import { info, type Notices } from "./athleteCareer";

export const isInducted = (p: PlayerState) => hasFlag(p, "hall_of_fame") || p.athlete.hofYear !== null;

/** A single number for how history will remember you. Roughly 0-200. */
export function legacyScore(p: PlayerState): number {
  const a = p.athlete;
  const r = a.record;
  if (!a.sport || r.seasons === 0) return 0;
  let v =
    r.titles * 4 + r.medals * 6 + r.awards * 3 + Math.max(0, r.bestRating - 55) * 0.9 + r.proSeasons * 1.2 + r.caps * 0.25 +
    p.fame * 0.25 + Math.min(20, r.earnings / 1_000_000) + (a.rival ? Math.min(6, (a.rival.wins - a.rival.losses) * 0.5) : 0);
  if (hasFlag(p, "doping_caught")) v -= 60;
  if (hasFlag(p, "match_fixer")) v -= 90;
  if (a.image < 30) v -= 8;
  else if (a.image >= 75) v += 6;
  return Math.max(0, Math.round(v));
}

export const LEGACY_TIERS: [number, string, string][] = [
  [150, "Legend", "A name the sport will say for generations."],
  [100, "Icon", "A defining figure of their era."],
  [60, "Star", "A household name while it lasted."],
  [30, "Respected pro", "A solid career that earned genuine respect."],
  [10, "Journeyman", "A working pro who made a living at it."],
  [0, "Footnote", "The sport barely noticed."],
];

export const legacyTier = (score: number) => LEGACY_TIERS.find(([m]) => score >= m) ?? LEGACY_TIERS[LEGACY_TIERS.length - 1];

export interface CareerSummary {
  score: number;
  tier: string;
  verdict: string;
  inducted: boolean;
  /** Years until the next Hall of Fame vote, or null when it's no longer relevant. */
  nextBallot: number | null;
  clubs: { club: string; seasons: number; titles: number }[];
  highlights: string[];
  scandals: string[];
}

export const BALLOT_YEARS = [5, 10];

export function careerSummary(p: PlayerState): CareerSummary {
  const a = p.athlete;
  const r = a.record;
  const score = legacyScore(p);
  const [, tier, verdict] = legacyTier(score);
  const byClub = new Map<string, { club: string; seasons: number; titles: number }>();
  for (const s of a.history) {
    if (s.stage === "youth" || s.rating === 0) continue;
    const e = byClub.get(s.club) ?? { club: s.club, seasons: 0, titles: 0 };
    e.seasons += 1;
    e.titles += s.titles;
    byClub.set(s.club, e);
  }
  const info = sportInfo(a.sport);
  const hl: string[] = [];
  if (r.titles > 0) hl.push(`${r.titles} title${r.titles === 1 ? "" : "s"}`);
  if (r.medals > 0) hl.push(`${r.medals} ${info.major.name} medal${r.medals === 1 ? "" : "s"}`);
  if (r.awards > 0) hl.push(`${r.awards} individual award${r.awards === 1 ? "" : "s"}`);
  if (r.caps > 0) hl.push(`${r.caps} international appearances`);
  if (r.bestRating > 0) hl.push(`peak rating ${Math.round(r.bestRating)}`);
  if (r.peakSalary > 0) hl.push(`peak salary ${money(r.peakSalary)}`);
  if (r.earnings > 0) hl.push(`${money(r.earnings)} earned in sport`);
  if (a.rival && a.rival.wins + a.rival.losses > 0) hl.push(`${a.rival.wins}-${a.rival.losses} against rival ${a.rival.name}`);
  const sc: string[] = [];
  if (hasFlag(p, "doping_caught")) sc.push("A doping ban sits on the record.");
  if (hasFlag(p, "match_fixer")) sc.push("Banned for life for match-fixing.");
  if (hasFlag(p, "ath_burnout")) sc.push("Burned out at least once under the pressure.");
  const yrs = a.retiredAge !== null ? p.age - a.retiredAge : 0;
  const nextBallot = a.stage === "retired" && !isInducted(p) ? BALLOT_YEARS.find((y) => y > yrs) ?? null : null;
  return { score, tier, verdict, inducted: isInducted(p), nextBallot: nextBallot === null ? null : nextBallot - yrs, clubs: [...byClub.values()], highlights: hl, scandals: sc };
}

/** Hall of Fame vote, a set number of years after retirement. */
export function hallBallot(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices, yearsRetired: number) {
  if (!BALLOT_YEARS.includes(yearsRetired) || isInducted(p)) return;
  if (hasFlag(p, "doping_caught") || hasFlag(p, "match_fixer")) return;
  const score = legacyScore(p);
  if (score < 70) return;
  const chance = clamp((score - 65) / 45, 0.1, 1);
  if (rng.chance(chance)) {
    setFlag(p, "hall_of_fame");
    a.hofYear = p.year;
    changeStat(p, "fame", 6);
    changeStat(p, "happiness", 10);
    const body = `${yearsRetired} years after you retired, the voters put you in the Hall of Fame (${legacyTier(score)[1]}, legacy ${score}). A speech, a plaque and a standing ovation.`;
    addLog(p, body);
    notices.push(info("Hall of Fame", body, "jackpot"));
  } else {
    const body = `You came up short in the Hall of Fame vote after ${yearsRetired} years. ${yearsRetired < 10 ? "You'll be on the ballot again." : "That may be your last chance."}`;
    addLog(p, body);
    notices.push(info("Passed Over", body, "bad"));
  }
}
