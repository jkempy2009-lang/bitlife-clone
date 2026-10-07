/** Shared plumbing for the fame careers (creator, musician, actor / model). */
import type { ActionResult, Effort, PlayerState } from "@/types/game.types";
import { hashString } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { addLog } from "./state";
import { isStudying } from "./occupation";

export type Notices = NonNullable<ActionResult["notices"]>;
export type Tone = "good" | "bad" | "neutral" | "jackpot";

export const info = (title: string, body: string, tone: Tone = "neutral") => ({ kind: "info" as const, title, body, tone });

/** How much creative output each effort level yields from the hours you have. */
export const EFFORT_OUTPUT: Record<Effort, number> = { coast: 0.5, steady: 1, grind: 1.6 };

export type CreativeKind = "creator" | "music";

/**
 * The share of a full-time week the player can give a creative career.
 * A day job leaves evenings and weekends; going all in means giving up the salary.
 */
export function capacityFor(p: PlayerState, kind: CreativeKind): number {
  if (kind === "creator" && p.influencer.fullTime) return 1;
  if (kind === "music" && p.music.signed) return 1;
  if (kind === "creator" && p.music.signed) return 0.3;
  if (p.business) return 0.25;
  const job = p.currentJob;
  if (job) return job.partTime ? 0.55 : 0.3;
  if (p.isInPrison) return 0.05;
  if (isStudying(p)) return p.education.stage === "Primary" || p.education.stage === "HighSchool" ? 0.5 : 0.4;
  return 0.7;
}

export const outputFor = (p: PlayerState, kind: CreativeKind): number => capacityFor(p, kind) * EFFORT_OUTPUT[p.effort];

/** Human label for how the player's hours are being spent. */
export function hoursLabel(p: PlayerState, kind: CreativeKind): string {
  if (kind === "creator" && p.influencer.fullTime) return "Full-time creator";
  if (kind === "music" && p.music.signed) return "Full-time artist";
  if (p.business) return "Squeezed around running a business";
  if (p.currentJob) return p.currentJob.partTime ? `After a part-time ${p.currentJob.title} shift` : `Evenings and weekends around your ${p.currentJob.title} job`;
  if (isStudying(p)) return "Around your classes";
  return "Spare time (no job)";
}

/** Piecewise-linear lookup on log10(x). */
export function logInterp(table: ReadonlyArray<readonly [number, number]>, x: number): number {
  const lx = Math.log10(Math.max(1, x));
  if (lx <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (lx <= x1) return y0 + ((lx - x0) / (x1 - x0)) * (y1 - y0);
  }
  return table[table.length - 1][1];
}

/** Withholding applied to income that arrives straight into the bank from a button press. */
export const ACTION_TAX = 0.25;

/** Pay the player the after-tax value of a one-off gig. Returns the net. */
export function payout(p: PlayerState, gross: number): number {
  const net = gross > 0 ? Math.round(gross * (1 - ACTION_TAX)) : Math.round(gross);
  p.bankBalance += net;
  return net;
}

export function logEvent(p: PlayerState, notices: Notices, title: string, body: string, tone: Tone = "neutral") {
  addLog(p, body);
  notices.push(info(title, body, tone));
}

export const fmtCount = (n: number): string => {
  if (n >= 10_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
};

/**
 * Natural talent sets how far a skill can be trained. A hidden, persistent roll per person and craft
 * (plus a little from smarts): practice has diminishing returns as you approach it.
 */
export function talentCeiling(p: PlayerState, craft: "music" | "song" | "acting"): number {
  const u = (hashString(`${p.id}:${craft}`) % 10_000) / 10_000;
  const gift = craft === "acting" ? p.talents.acting : p.talents.musical;
  return clamp(Math.round(32 + 0.2 * p.smarts + 50 * Math.pow(u, 0.8) + (gift - 50) * 0.35), 30, 100);
}

/** Scale a raw training gain by how close the skill already is to the person's ceiling. */
export function trained(p: PlayerState, craft: "music" | "song" | "acting", skill: number, raw: number): number {
  return Math.round(raw * clamp(1 - skill / talentCeiling(p, craft), 0.1, 1));
}
