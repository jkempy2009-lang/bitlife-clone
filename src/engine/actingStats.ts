/** Read-only summaries of a screen career for the filmography and career-summary screens. */
import type { ActingMedium, FilmCredit, PlayerState } from "@/types/game.types";

export interface CareerSummary {
  total: number;
  byMedium: Record<ActingMedium, number>;
  hits: number;
  flops: number;
  hitRate: number;
  grossed: number;
  best: FilmCredit | null;
  worst: FilmCredit | null;
  awards: number;
  nominations: number;
  seasons: number;
  producing: number;
  years: number;
}

const isBehind = (c: FilmCredit) => c.role === "producer" || c.role === "director";
const score = (c: FilmCredit) => c.critics + (c.outcome === "blockbuster" ? 30 : c.outcome === "hit" ? 15 : c.outcome === "flop" ? -15 : 0) + (c.award ? 20 : 0);

export function careerSummary(p: PlayerState): CareerSummary {
  const credits = p.acting.credits;
  const byMedium: Record<ActingMedium, number> = { film: 0, tv: 0, stage: 0 };
  let hits = 0;
  let flops = 0;
  let grossed = 0;
  let seasons = 0;
  let producing = 0;
  for (const c of credits) {
    byMedium[c.medium ?? "film"] += 1;
    if (c.outcome === "hit" || c.outcome === "blockbuster") hits += 1;
    if (c.outcome === "flop") flops += 1;
    if (c.medium !== "tv") grossed += c.boxOffice;
    seasons += c.seasons ?? 0;
    if (isBehind(c)) producing += 1;
  }
  const sorted = [...credits].sort((a, b) => score(b) - score(a));
  const first = credits.length ? Math.min(...credits.map((c) => c.year)) : p.year;
  return {
    total: credits.length,
    byMedium,
    hits,
    flops,
    hitRate: credits.length ? hits / credits.length : 0,
    grossed,
    best: sorted[0] ?? null,
    worst: credits.length > 1 ? sorted[sorted.length - 1] : null,
    awards: p.acting.awards.length,
    nominations: p.acting.nominations,
    seasons,
    producing,
    years: credits.length ? p.year - first + 1 : 0,
  };
}

/** The four rungs of the role ladder and what it takes to reach the next. */
export function ladderSteps(p: PlayerState): Array<{ title: string; role: string; state: "done" | "here" | "next" | "later"; need?: string }> {
  const tier = p.currentJob?.lineId === "actor" ? p.currentJob.tier : -1;
  const a = p.acting;
  const steps = [
    { title: "Background Actor", role: "Extra and bit parts" },
    { title: "Supporting Actor", role: "Named supporting roles" },
    { title: "Lead Actor", role: "Top billing" },
    { title: "A-List Movie Star", role: "Franchise leads" },
  ];
  const needs = [
    "Audition for a supporting role",
    a.agent ? "Reputation 35+, then audition for the lead" : "Hire an agent, reach reputation 35+, then audition",
    "Reputation 60+ and box-office pull 40+, then audition",
  ];
  return steps.map((s, i) => ({
    ...s,
    state: tier < 0 ? "later" : i < tier ? "done" : i === tier ? "here" : i === tier + 1 ? "next" : "later",
    need: i === tier + 1 ? needs[tier] : undefined,
  }));
}
