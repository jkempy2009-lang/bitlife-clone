/**
 * Working life beyond the job title: burnout and rest, annual reviews and bonuses, the management-or-specialist
 * choice at the first senior promotion, sector slumps and booms, layoffs with real choices, unemployment
 * insurance and the safety net. Everything here is a yearly consequence of how you work.
 */
import type { ActionResult, Job, PlayerState, ReviewRating } from "@/types/game.types";
import type { LifeEvent } from "@/data/lifeEventsEngine";
import { hashString, makeRng, type Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { incomeTaxFor } from "@/data/countries";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone, isRoyal, livingRelatives } from "./state";
import { careSystem } from "./health";
import { marriedPartner } from "./household";
import { effortPerformanceDelta, isStudyingFullTime } from "./occupation";
import { layoffChance } from "./world";
import { worldLayoff } from "./worldEvents";
import { pensionFor, promoteJob, recordCareerPeak } from "./career";
import { CYCLICAL_SECTORS, SECTOR_HEADLINES, layoffRisk, payCeiling, sectorMood, sectorOf } from "./careerPay";

type Notices = NonNullable<ActionResult["notices"]>;

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") => ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Burnout
// ---------------------------------------------------------------------------

/** Lines where the hours are brutal even when you "coast". */
const DEMANDING = new Set(["finance", "consulting", "lawyer", "doctor", "nurse", "paramedic", "gamedev", "software", "chef", "police", "military", "firefighter", "journalism", "pilot"]);

export type BurnoutLevel = "fresh" | "stretched" | "burnt";
export const burnoutLevel = (b: number): BurnoutLevel => (b >= 75 ? "burnt" : b >= 50 ? "stretched" : "fresh");

/** Net change in burnout over a working year. */
export function burnoutDelta(p: PlayerState): number {
  const job = p.currentJob;
  if (!job) return -15;
  if (job.partTime) return -10;
  let d = -5 + (p.effort === "grind" ? 14 : p.effort === "steady" ? 4 : -6);
  if (DEMANDING.has(job.lineId)) d += 4;
  if (p.career.track === "mgmt") d += 4;
  else if (p.career.track === "ic") d -= 1;
  const toddlers = livingRelatives(p, "Child").filter((c) => c.age < 6).length;
  d += Math.min(3, toddlers) * 1.5;
  d += p.happiness < 40 ? 3 : p.happiness > 75 ? -2 : 0;
  d -= Math.round((p.talents.resilience - 50) / 25);
  return Math.round(d);
}

export function vacationCost(p: PlayerState): number {
  return clamp(Math.round((p.currentJob?.salary ?? 0) * 0.05), 1_500, 15_000);
}

export function takeVacation(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.partTime || p.career.onLeave) return { player: p0 };
  if ((p.annual.vacation ?? 0) >= 1) return { player: p0, notices: [info("Already Away", "You've already taken your holiday this year.")] };
  const cost = vacationCost(p);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `A proper break costs about ${money(cost)}.`, "bad")] };
  p.annual.vacation = 1;
  p.bankBalance -= cost;
  p.career.burnout = clamp(p.career.burnout - 22);
  changeStat(p, "happiness", 5);
  changeStat(p, "health", 1);
  const body = `You took two proper weeks off for ${money(cost)}: no email, no laptop. Burnout eased.`;
  addLog(p, body);
  return { player: p, notices: [info("Time Off", body, "good")] };
}

/** Years between sabbaticals. */
export const SABBATICAL_GAP = 5;

export function sabbaticalBlocker(p: PlayerState): string | null {
  const job = p.currentJob;
  if (!job) return "You need a job to take leave from.";
  if (CAREER_BY_ID[job.lineId]?.pack) return "This career doesn't offer leave.";
  if (p.career.onLeave) return "You're already on leave.";
  if (p.career.lastSabbatical && p.year - p.career.lastSabbatical < SABBATICAL_GAP) return `Your employer only grants leave every ${SABBATICAL_GAP} years.`;
  return null;
}

/** A year of unpaid leave: no salary, burnout falls hard, and you come back to the same desk. */
export function takeSabbatical(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const blocked = sabbaticalBlocker(p);
  if (blocked) return { player: p0, notices: [info("Can't Take Leave", blocked, "bad")] };
  p.career.onLeave = true;
  p.career.lastSabbatical = p.year;
  const body = `You took a year of unpaid leave from ${p.currentJob!.company}. No salary for the coming year, but your job is waiting for you.`;
  addLog(p, body);
  return { player: p, notices: [info("Sabbatical", body)] };
}

// ---------------------------------------------------------------------------
// Unemployment insurance and the safety net
// ---------------------------------------------------------------------------

export function benefitYearsFor(country: string): number {
  const sys = careSystem(country);
  return sys === "universal" ? 2 : sys === "insured" ? 1 : 0;
}

export function unemploymentBenefit(p: PlayerState): number {
  if (p.currentJob || p.isInPrison || p.career.benefitYears <= 0) return 0;
  return Math.min(30_000, Math.round(p.career.lastPay * 0.45));
}

/** A means-tested safety net for adults with nothing: smaller than a living wage, gone once you have savings. */
export function welfareIncome(p: PlayerState): number {
  if (p.age < 18 || p.age >= 65 || p.currentJob || p.business || p.pension > 0 || isRoyal(p) || p.isInPrison || p.music.signed || p.influencer.fullTime) return 0;
  if (marriedPartner(p) || unemploymentBenefit(p) > 0) return 0;
  const assets = p.bankBalance + Object.values(p.investments).reduce((s, h) => s + h.value, 0);
  if (assets > 15_000) return 0;
  const sys = careSystem(p.residence.country);
  return sys === "universal" ? 11_000 : sys === "insured" ? 7_000 : 3_000;
}

// ---------------------------------------------------------------------------
// Sector cycles, jobless spells (called every Age Up, before the job year)
// ---------------------------------------------------------------------------

export function careerYearStart(p: PlayerState, _rng: Rng, notices: Notices) {
  void _rng;
  // Sector weather is rolled from its own seeded stream (player + year) so it never shifts the main random sequence.
  const rng = makeRng(hashString(`${p.id}:sector:${p.year}`));
  const c = p.career;
  for (const [k, m] of Object.entries(c.sectors)) if (p.year > m.until) delete c.sectors[k];
  if (p.age >= 16 && rng.chance(0.09)) {
    const cat = rng.pick(CYCLICAL_SECTORS);
    if (!c.sectors[cat]) {
      const slumpP = p.economy.climate === "recession" ? 0.75 : p.economy.climate === "boom" ? 0.3 : 0.5;
      const kind = rng.chance(slumpP) ? "slump" : "boom";
      c.sectors[cat] = { kind, until: p.year + rng.int(2, 4) };
      const line = SECTOR_HEADLINES[cat][kind];
      addLog(p, `📰 ${line}`);
      const mine = p.currentJob && sectorOf(p.currentJob.lineId) === cat;
      if (mine || (p.age >= 18 && !p.currentJob && !p.business)) notices.push(info(kind === "slump" ? `${cat} Slump` : `${cat} Boom`, line, kind === "slump" ? "bad" : "good"));
    }
  }
  if (p.currentJob) {
    c.gapYears = 0;
    return;
  }
  c.onLeave = false;
  c.burnout = clamp(c.burnout + burnoutDelta(p));
  if (c.benefitYears > 0) c.benefitYears -= 1;
  const idle = p.age >= 22 && p.age < 65 && !p.business && !isStudyingFullTime(p) && !p.isInPrison && !isRoyal(p) && !p.music.signed && !p.influencer.fullTime && p.pension === 0;
  if (idle) c.gapYears += 1;
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

/** Promote with a track decision and the burnout that a bigger role brings. */
export function promoteWithTrack(p: PlayerState, track: "ic" | "mgmt" | null, extraPct = 0): boolean {
  if (!promoteJob(p)) return false;
  const j = p.currentJob!;
  const line = CAREER_BY_ID[j.lineId];
  if (track) p.career.track = track;
  const bump = (track === "mgmt" ? 0.06 : 0) + extraPct;
  if (bump > 0) j.salary = Math.min(Math.round(j.salary * (1 + bump)), payCeiling(line, j.tier, { track: p.career.track }));
  p.annualSalary = j.salary;
  p.career.burnout = clamp(p.career.burnout + (track === "mgmt" ? 10 : 6));
  recordCareerPeak(p);
  return true;
}

export function promotionEvent(p: PlayerState): LifeEvent | null {
  const j = p.currentJob;
  if (!j) return null;
  const line = CAREER_BY_ID[j.lineId];
  if (!line || line.pack === "politics" || j.tier >= line.ladder.length - 1) return null;
  const next = line.ladder[j.tier + 1];
  const base = { id: `promo_${j.id}_${p.year}`, minAge: 0, maxAge: 200, category: "career" as const };
  const firstSenior = p.career.track === null && j.tier + 1 >= 2 && line.ladder.length >= 4;
  if (firstSenior) {
    return {
      ...base,
      title: "A Fork in the Career",
      description: `You've been offered ${next.title} (about ${money(next.salary)} a year). It comes with a choice that will shape the rest of your career: run people, or stay hands-on and become the best at the craft.`,
      options: [
        {
          text: `Management track: ${next.title}, bigger pay, a team, and the stress that comes with it`,
          effects: { logText: `You took the management track as ${next.title}. More money, more meetings, more people who need you.`, happinessDelta: 6, apply: (pl) => void promoteWithTrack(pl, "mgmt") },
        },
        {
          text: `Specialist track: ${next.title}, hands-on, calmer, and secure if you're good`,
          effects: { logText: `You chose the specialist track as ${next.title}: the work you love, without the politics.`, happinessDelta: 8, apply: (pl) => void promoteWithTrack(pl, "ic") },
        },
        {
          text: "Decline both and keep the evenings",
          effects: { logText: `You turned down ${next.title}. You kept your evenings and a little of your sanity.`, happinessDelta: 1, performanceDelta: -10, apply: (pl) => void (pl.career.burnout = clamp(pl.career.burnout - 8)) },
        },
      ],
    };
  }
  return {
    ...base,
    title: "Promotion Opportunity!",
    description: `Your outstanding performance has been noticed. Management wants to promote you to ${next.title} (about ${money(next.salary)} a year). A bigger role also means bigger demands.`,
    options: [
      {
        text: `Accept the promotion to ${next.title}`,
        effects: { logText: `You were promoted to ${next.title}!`, happinessDelta: 8, apply: (pl) => void promoteWithTrack(pl, null) },
      },
      {
        text: "Hold out for a bigger package",
        effects: { logText: `You held your nerve and negotiated: promoted to ${next.title} with an extra 7% on top.`, happinessDelta: 10, apply: (pl) => void promoteWithTrack(pl, null, 0.07) },
        chance: {
          p: 0.55,
          failure: { logText: `Management shrugged and offered the role to someone else. You've been quietly marked down as difficult.`, happinessDelta: -5, performanceDelta: -8 },
        },
      },
      {
        text: "Decline and stay put",
        effects: { logText: `You turned down a promotion to ${next.title}. Lower stakes, steadier evenings.`, happinessDelta: 1, performanceDelta: -10, apply: (pl) => void (pl.career.burnout = clamp(pl.career.burnout - 8)) },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Layoffs
// ---------------------------------------------------------------------------

export function layoffEvent(p: PlayerState, job: Job): LifeEvent {
  const salary = job.salary;
  const mood = sectorMood(p, sectorOf(job.lineId));
  const why = mood === "slump" ? `${job.company} is cutting ${sectorOf(job.lineId).toLowerCase()} roles across the board` : `${job.company} is restructuring`;
  const talk = clamp(0.5 + (p.skills.charisma - 30) / 300 + (p.talents.speaking - 50) / 400, 0.3, 0.75);
  const options: LifeEvent["options"] = [
    {
      text: `Sign the standard package (${money(Math.round(salary * 0.15))})`,
      effects: { logText: "You signed, shook hands and carried your things to the car in a cardboard box.", bankBalanceDelta: Math.round(salary * 0.15), happinessDelta: -6 },
    },
    {
      text: "Negotiate a better exit",
      effects: { logText: "You argued your case calmly and left with a much better package.", bankBalanceDelta: Math.round(salary * 0.3), happinessDelta: -3 },
      chance: { p: talk, failure: { logText: "HR didn't budge, and now the reference they'll give you is a cool one.", bankBalanceDelta: Math.round(salary * 0.06), happinessDelta: -8 } },
    },
    {
      text: "Take the package and a few months off",
      effects: { logText: "You took the money, switched your phone off and slept properly for the first time in years.", bankBalanceDelta: Math.round(salary * 0.15), happinessDelta: 2, healthDelta: 2, apply: (pl) => void (pl.career.burnout = clamp(pl.career.burnout - 30)) },
    },
  ];
  if (job.performance >= 70) {
    options.push({
      text: "Threaten to sue for unfair dismissal",
      effects: { logText: "Their lawyers blinked first. You settled for a very good sum and an NDA.", bankBalanceDelta: Math.round(salary * 0.6), happinessDelta: 2 },
      chance: {
        p: 0.35,
        failure: {
          logText: "The claim went nowhere, the fees were real, and word got around that you're litigious.",
          bankBalanceDelta: -Math.min(6_000, Math.round(salary * 0.15)),
          happinessDelta: -9,
          karmaDelta: -1,
          apply: (pl) => void (pl.career.blacklistUntil = pl.year + 3),
        },
      },
    });
  }
  return {
    id: `layoff_${job.id}_${p.year}`,
    title: "Laid Off",
    description: `${why}, and your role is gone. HR is waiting in a glass meeting room with a folder. ${benefitYearsFor(p.residence.country) > 0 ? "You'll qualify for unemployment insurance." : "There's no unemployment insurance where you live."}`,
    minAge: 0,
    maxAge: 200,
    category: "career",
    options,
  };
}

// ---------------------------------------------------------------------------
// The working year
// ---------------------------------------------------------------------------

const BONUS: Record<string, Record<ReviewRating, number>> = {
  Business: { star: 0.1, solid: 0.04, weak: 0 },
  Legal: { star: 0.1, solid: 0.04, weak: 0 },
  Technology: { star: 0.07, solid: 0.025, weak: 0 },
  Healthcare: { star: 0.02, solid: 0, weak: 0 },
  "Public Service": { star: 0.01, solid: 0, weak: 0 },
  Education: { star: 0, solid: 0, weak: 0 },
};
const DEFAULT_BONUS: Record<ReviewRating, number> = { star: 0.04, solid: 0.015, weak: 0 };

export const ratingFor = (performance: number): ReviewRating => (performance >= 80 ? "star" : performance >= 55 ? "solid" : "weak");

/** Annual review: a bonus for strong years, plus a verdict on the pay conversation. */
function annualReview(p: PlayerState, notices: Notices) {
  const job = p.currentJob!;
  const rating = ratingFor(job.performance);
  const table = BONUS[sectorOf(job.lineId)] ?? DEFAULT_BONUS;
  const climate = p.economy.climate === "boom" ? 1.3 : p.economy.climate === "recession" ? 0.4 : 1;
  const mood = sectorMood(p, sectorOf(job.lineId));
  const gross = Math.round(job.salary * table[rating] * climate * (mood === "slump" ? 0.3 : mood === "boom" ? 1.3 : 1) * (p.career.track === "mgmt" ? 1.5 : 1));
  let net = 0;
  if (gross > 0) {
    net = gross - (incomeTaxFor(p.residence.country, job.salary + gross) - incomeTaxFor(p.residence.country, job.salary));
    p.bankBalance += net;
  }
  p.career.lastReview = { year: p.year, rating, bonus: net };
  const label = rating === "star" ? "Exceeds expectations" : rating === "solid" ? "Meets expectations" : "Needs improvement";
  addLog(p, `Annual review: ${label}${net > 0 ? `, with a bonus of ${money(net)} after tax` : ""}.`);
  if (rating === "star" && net >= 5_000) notices.push(info("Bonus Season", `Your review came back "${label}". A bonus of ${money(net)} landed after tax.`, "good"));
  if (rating === "weak") {
    changeStat(p, "happiness", -3);
    notices.push(info("Rough Review", `Your review said "${label}". Your manager wants to see changes before the next one.`, "bad"));
  }
}

/** The job half of the yearly career step: performance, firing, layoffs, burnout, review, raise, promotion offer. */
export function processJobYear(p: PlayerState, rng: Rng, notices: Notices) {
  const job = p.currentJob;
  if (!job) return;
  const c = p.career;
  const line = CAREER_BY_ID[job.lineId];
  const sector = sectorOf(job.lineId);
  const leave = c.onLeave;
  c.onLeave = false;

  const burnBefore = c.burnout;
  c.burnout = clamp(c.burnout + (leave ? -55 : burnoutDelta(p)));
  let drift = leave ? -4 : effortPerformanceDelta(job.partTime ? "steady" : p.effort, rng) + Math.round((p.smarts - 50) / 25);
  if (!leave) drift -= c.burnout >= 75 ? 8 : c.burnout >= 50 ? 3 : 0;
  job.performance = clamp(job.performance + drift);
  if (!leave && c.burnout >= 75) {
    changeStat(p, "health", -2);
    changeStat(p, "happiness", -3);
    if (burnBefore < 75 && c.burnout < 100) {
      const body = "You're running on empty: mistakes, short temper, a constant hum of dread on Sunday nights. Your work is suffering. Take a holiday or a sabbatical before something gives.";
      addLog(p, body);
      notices.push(info("Burnout Warning", body, "bad"));
    }
  }

  if (job.performance < 20 && rng.chance(0.4)) {
    const body = `You were fired from your job as a ${job.title} for poor performance.`;
    p.currentJob = null;
    changeStat(p, "happiness", -10);
    addLog(p, body);
    notices.push(info("You're Fired", body, "bad"));
    return;
  }
  if (rng.chance(layoffRisk(p, layoffChance(p.economy.climate) + worldLayoff(p)))) {
    p.currentJob = null;
    p.career.lastPay = job.salary;
    p.career.benefitYears = benefitYearsFor(p.residence.country);
    p.career.gapYears = 0;
    changeStat(p, "happiness", -4);
    addLog(p, `${job.company} let you go (${job.title}).`);
    notices.push({ kind: "event", event: layoffEvent(p, job) });
    return;
  }
  if (c.burnout >= 100) {
    c.onLeave = true;
    c.burnout = 45;
    p.effort = "steady";
    changeStat(p, "health", -5);
    changeStat(p, "happiness", -6);
    const body = "You collapsed at your desk. Your doctor signed you off for a year: no salary for the coming year, effort reset to Steady, and a long, quiet recovery.";
    addLog(p, body);
    notices.push(info("Burnout Collapse", body, "bad"));
    return;
  }

  if (!leave && !job.partTime) annualReview(p, notices);

  if (!leave && job.performance >= 50) {
    const ceiling = payCeiling(line, job.tier, { partTime: job.partTime, track: c.track });
    const mood = sectorMood(p, sector);
    const climate = (p.economy.climate === "boom" ? 1.3 : p.economy.climate === "recession" ? 0.4 : 1) * (mood === "slump" ? 0.3 : mood === "boom" ? 1.4 : 1) * (c.track === "mgmt" ? 1.2 : 1);
    // Annual raise tracks performance and the economy: ~1% for adequate work, up to ~5% for stars, never past the band.
    const rate = (0.01 + Math.max(0, job.performance - 50) / 1000) * climate;
    if (job.salary < ceiling) job.salary = Math.min(Math.round(job.salary * (1 + rate)), Math.round(ceiling));
  }
  p.annualSalary = job.salary;
  if (p.age >= 75) {
    p.pension = pensionFor(p);
    addLog(p, `You retired from your job as a ${job.title} at age ${p.age}. Your pension is ${money(p.pension)} a year.`);
    p.currentJob = null;
    p.annualSalary = 0;
    return;
  }
  job.yearsInRole = (job.yearsInRole ?? 0) + 1;
  // Promotions need standout performance, time in the role, a healthy candidate and an opening.
  const mood = sectorMood(p, sector);
  const openingChance =
    (p.economy.climate === "boom" ? 0.55 : p.economy.climate === "recession" ? 0.2 : 0.4) *
    Math.max(0.3, 1 - 0.15 * job.tier) *
    (1 + (p.talents.leadership - 50) / 150) *
    (mood === "slump" ? 0.4 : mood === "boom" ? 1.3 : 1) *
    (c.track === "mgmt" ? 1.3 : 1);
  if (!leave && !job.partTime && c.burnout < 75 && job.performance > 85 && job.yearsInRole >= 3 + job.tier && rng.chance(openingChance)) {
    const ev = promotionEvent(p);
    if (ev) notices.push({ kind: "event", event: ev });
  }
}

/** One-line status for the UI. */
export function careerStatus(p: PlayerState) {
  const job = p.currentJob;
  const line = job ? CAREER_BY_ID[job.lineId] : undefined;
  const ceiling = job ? payCeiling(line, job.tier, { partTime: job.partTime, track: p.career.track }) : 0;
  return {
    ceiling,
    atCeiling: !!job && job.salary >= ceiling,
    sector: job ? sectorOf(job.lineId) : null,
    mood: job ? sectorMood(p, sectorOf(job.lineId)) : null,
    risk: job ? layoffRisk(p, layoffChance(p.economy.climate) + worldLayoff(p)) : 0,
    burnout: p.career.burnout,
    level: burnoutLevel(p.career.burnout),
  };
}
