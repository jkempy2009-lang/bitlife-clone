/**
 * Pure helpers for how a job pays and how secure it is: pay bands per grade, how exposed each sector is to
 * downturns, and what a slump or a long gap on the CV does to hiring odds.
 */
import type { PlayerState } from "@/types/game.types";
import { CAREER_BY_ID, type CareerLine } from "@/data/careersRegistry";

/** How hard each sector is hit when the economy turns (1 = the economy-wide average). */
export const SECTOR_EXPOSURE: Record<string, number> = {
  Technology: 1.5,
  Business: 1.3,
  Trades: 1.3,
  Creative: 1.2,
  Entertainment: 1.1,
  Service: 1,
  Transport: 1,
  Legal: 0.8,
  Science: 0.7,
  Healthcare: 0.35,
  Education: 0.35,
  "Public Service": 0.3,
};

export const sectorOf = (lineId: string): string => CAREER_BY_ID[lineId]?.category ?? "Service";
export const exposureOf = (lineId: string): number => SECTOR_EXPOSURE[sectorOf(lineId)] ?? 0.6;

/** Sectors that can swing into a slump or a boom (the rest are too steady or too special to model). */
export const CYCLICAL_SECTORS = ["Technology", "Business", "Trades", "Creative", "Service", "Transport", "Legal", "Science", "Healthcare", "Education", "Public Service"];

export const SECTOR_HEADLINES: Record<string, { slump: string; boom: string }> = {
  Technology: { slump: "A tech winter sets in: hiring freezes and layoffs ripple through software.", boom: "A tech hiring frenzy: recruiters are calling everyone with a keyboard." },
  Business: { slump: "Deal flow dries up. Banks and consultancies are cutting heads.", boom: "Deals are flowing and bonuses are fat across business and finance." },
  Trades: { slump: "Building projects are cancelled across the region. Trades work is scarce.", boom: "A construction boom: every contractor is booked solid." },
  Creative: { slump: "Advertisers pull back and newsrooms shrink.", boom: "Media and creative budgets swell." },
  Service: { slump: "Consumers stop spending. Shops, kitchens and bars cut shifts.", boom: "Customers are spending freely; restaurants and shops are hiring." },
  Transport: { slump: "Freight volumes fall and routes are cut.", boom: "Freight and travel surge. Carriers are short of staff." },
  Legal: { slump: "Corporate legal budgets tighten and firms stop hiring.", boom: "A wave of litigation and deals keeps every law firm busy." },
  Science: { slump: "Research funding is frozen.", boom: "A funding round floods labs with grants." },
  Healthcare: { slump: "Hospital budgets are squeezed and hiring slows.", boom: "A nationwide staffing shortage: hospitals are bidding for clinicians." },
  Education: { slump: "School budgets are cut and posts go unfilled.", boom: "A schools investment drive opens new posts." },
  "Public Service": { slump: "A public-sector pay freeze and hiring pause.", boom: "Government expands the public workforce." },
};

export function sectorMood(p: PlayerState, category: string): "slump" | "boom" | null {
  const m = p.career?.sectors?.[category];
  return m && p.year <= m.until ? m.kind : null;
}

/**
 * The most a job at this grade pays. Pay rises stop at the top of the band; only a promotion (or a better
 * employer) opens the next one. Specialists on the hands-on track keep a little more headroom.
 */
export function payCeiling(line: CareerLine | undefined, tier: number, opts: { partTime?: boolean; track?: "ic" | "mgmt" | null } = {}): number {
  if (!line) return Infinity;
  const t = Math.min(tier, line.ladder.length - 1);
  const next = line.ladder[t + 1];
  let ceiling = next ? next.salary * 0.95 : line.ladder[t].salary * 1.6;
  if (opts.track === "ic") ceiling *= 1.08;
  return Math.round(ceiling * (opts.partTime ? 0.5 : 1));
}

/** Hiring odds shift with the target sector's mood, a long gap on the CV and a burned bridge. */
export function careerHiringModifier(p: PlayerState, line: CareerLine): number {
  let m = 0;
  const mood = sectorMood(p, line.category);
  if (mood === "slump") m -= 0.12;
  else if (mood === "boom") m += 0.08;
  m -= Math.min(0.2, Math.max(0, (p.career?.gapYears ?? 0) - 1) * 0.04);
  if ((p.career?.blacklistUntil ?? 0) > p.year) m -= 0.15;
  return m;
}

/** Per-year chance of losing this job to a layoff. */
export function layoffRisk(p: PlayerState, baseByClimate: number): number {
  const job = p.currentJob;
  if (!job) return 0;
  const mood = sectorMood(p, sectorOf(job.lineId));
  const moodFactor = mood === "slump" ? 2.5 : mood === "boom" ? 0.5 : 1;
  const perf = job.performance >= 80 ? 0.5 : job.performance < 50 ? 1.6 : 1;
  const newcomer = (job.yearsInRole ?? 0) < 2 ? 1.2 : 1;
  const specialist = p.career?.track === "ic" && job.performance >= 70 ? 0.8 : 1;
  return Math.min(0.5, baseByClimate * exposureOf(job.lineId) * moodFactor * perf * newcomer * specialist);
}
