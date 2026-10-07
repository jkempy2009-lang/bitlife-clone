/**
 * Justice rules shared by crime, prison, politics and careers: heat and detection odds,
 * sentencing maths, the criminal record and what it closes off, juvenile handling, forfeiture.
 * Pure helpers only (no trial flow); see crime.ts, prison.ts and justiceYear.ts for the flows.
 */
import type { ActionResult, CrimeCharge, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { CRIME_BY_ID, LAWYERS, crimeMeta, type LawyerDef } from "@/data/crimes";
import { lawFor } from "@/data/justiceCountries";
import { addLog, changeStat, clone, hasFlag, netWorth } from "./state";

// ---------------------------------------------------------------------------
// Heat and detection
// ---------------------------------------------------------------------------

export const policingOf = (p: PlayerState) => lawFor(p.residence.country).policing;

export function addHeat(p: PlayerState, n: number) {
  p.justice.heat = clamp(Math.round(p.justice.heat + n));
}

export type Scrutiny = "unknown" | "noticed" | "watched" | "wanted";
export function scrutiny(p: PlayerState): Scrutiny {
  const h = p.justice.heat;
  return h >= 70 ? "wanted" : h >= 40 ? "watched" : h >= 15 ? "noticed" : "unknown";
}

export interface CrimeOpts {
  /** 0 wing it, 1 scout the place, 2 plan it properly (costs money, scales with smarts). */
  plan?: 0 | 1 | 2;
  /** Accomplices hired for team crimes. Each adds a snitch risk later. */
  crew?: 0 | 1 | 2;
}

export const CREW_CUT = 0.15;

export function planCost(level: number, crimeId: string): number {
  const c = CRIME_BY_ID[crimeId];
  if (!c || level <= 0) return 0;
  const avg = (c.reward[0] + c.reward[1]) / 2;
  return Math.round(level * clamp(avg * 0.03, 100, 6000));
}

/** Probability of being caught for one attempt, given everything the police already know about you. */
export function catchChance(p: PlayerState, crimeId: string, opts: CrimeOpts = {}, roll = 0.5): number {
  const crime = CRIME_BY_ID[crimeId];
  if (!crime) return 0;
  const meta = crimeMeta(crimeId);
  const repeat = p.annual[`crime:${crimeId}`] ?? 0;
  const success = clamp(crime.successChance(p, roll) * Math.pow(0.85, repeat), 0.02, 0.95);
  let c = (1 - success) * policingOf(p);
  c += p.justice.heat / 300;
  c += Math.min(0.12, p.justice.convictions * 0.025);
  if (p.probation) c += 0.1;
  c += Math.min(0.12, p.justice.accomplices * 0.02);
  c -= (opts.plan ?? 0) * 0.06 * (0.6 + p.smarts / 250);
  if (meta.team) c -= (opts.crew ?? 0) * 0.04;
  return clamp(c, 0.02, 0.97);
}

/** Adjust a flat detection probability (violence, events) for policing, heat and record. */
export function adjustCatch(p: PlayerState, base: number): number {
  return clamp(base * policingOf(p) + p.justice.heat / 300 + Math.min(0.1, p.justice.convictions * 0.02), 0.02, 0.97);
}

// ---------------------------------------------------------------------------
// Sentencing and the courtroom
// ---------------------------------------------------------------------------

export const isViolentName = (name: string) => /murder|assault|robbery|kidnap|arson|extortion|manslaughter|battery/i.test(name);

export const habitualOffender = (p: PlayerState, charge: CrimeCharge) => p.justice.felonies >= 2 && charge.severity !== "minor";

const JUVENILE_CAP = { minor: 1, serious: 3, heinous: 6 } as const;

/** The sentence a conviction would carry before the judge's mood and your lawyer's mitigation. */
export function expectedYears(p: PlayerState, charge: CrimeCharge): number {
  if (charge.juvenile) return Math.max(1, Math.min(charge.years, JUVENILE_CAP[charge.severity]));
  const law = lawFor(p.residence.country);
  let m = law.harshness * (1 + 0.2 * Math.min(4, p.justice.convictions));
  if (habitualOffender(p, charge)) m *= 1.35;
  return Math.max(1, Math.round(charge.years * m));
}

export function defaultEvidence(p: PlayerState, charge: CrimeCharge, paper = false): number {
  return clamp(45 + Math.round(p.justice.heat / 4) + p.justice.convictions * 3 + (paper ? 10 : 0) + (charge.severity === "heinous" ? 5 : 0), 10, 95);
}

export function lawyerById(id: string): LawyerDef | undefined {
  return LAWYERS.find((l) => l.id === id);
}

export function lawyerQuality(p: PlayerState, l: LawyerDef): number {
  if (l.id === "self") return clamp(0.1 + p.smarts / 500 + (p.education.degrees.includes("jd") ? 0.55 : 0), 0, 0.9);
  return l.quality;
}

const SEVERITY_FEE = { minor: 0.5, serious: 1, heinous: 2.2 } as const;

/** Parents pay for a minor's defence if they can afford it. */
function parentTier(p: PlayerState): number {
  return Math.max(0, ...p.relatives.filter((r) => r.relation === "Parent" && r.alive).map((r) => r.incomeTier));
}

export function lawyerCost(p: PlayerState, charge: CrimeCharge, l: LawyerDef): number {
  if (l.cost === 0) return 0;
  const fee = Math.round((l.cost * SEVERITY_FEE[charge.severity]) / 100) * 100;
  if (charge.juvenile) {
    const t = parentTier(p);
    if ((l.id === "private" && t >= 3) || (l.id === "expensive" && t >= 4) || (l.id === "dream_team" && t >= 5)) return 0;
  }
  return fee;
}

/** Chance of acquittal before the jury's mood. Evidence and representation dominate. */
export function acquittalChance(p: PlayerState, charge: CrimeCharge, lawyerId: string): number {
  const l = lawyerById(lawyerId);
  if (!l || l.id === "plea") return 0;
  let c = 0.03 + lawyerQuality(p, l) * 0.5 - ((charge.evidence ?? 50) - 50) / 220;
  if (charge.innocent) c += 0.28;
  if (charge.bail?.posted && charge.severity !== "minor") c += 0.04;
  c += (p.skills.charisma - 30) / 800 + (p.fame >= 40 ? 0.02 : 0) + (p.karma - 50) / 600;
  c -= Math.min(0.1, p.justice.convictions * 0.025);
  if (charge.severity === "heinous") c -= 0.05;
  return clamp(c, 0.02, 0.9);
}

/** Bail set at arraignment. Minor first offences are released on their own recognizance. */
export function bailFor(p: PlayerState, charge: CrimeCharge): NonNullable<CrimeCharge["bail"]> {
  if (charge.juvenile) return { amount: 0, posted: true };
  const priors = p.justice.convictions;
  if (charge.severity === "minor" && priors < 2 && !p.isFugitive) return { amount: 0, posted: true };
  if (charge.severity === "heinous" && ((charge.evidence ?? 50) >= 60 || charge.capital || hasFlag(p, "escaped"))) return { amount: 0, posted: false, denied: true };
  const base = { minor: 2_000, serious: 15_000, heinous: 100_000 }[charge.severity];
  const amount = Math.round((base * (1 + p.justice.heat / 100) * (1 + priors * 0.25) * (hasFlag(p, "escaped") ? 2 : 1)) / 500) * 500;
  return { amount, posted: false };
}

export const bailFee = (amount: number) => Math.max(300, Math.round(amount * 0.1));

/** Fines scale with means (day-fine style): the wealthy pay more than the broke. */
export function fineFor(p: PlayerState, base: number): number {
  const income = p.currentJob?.salary ?? 0;
  const cap = Math.max(3_000, p.bankBalance * 0.6 + income * 0.2);
  return Math.round(clamp(base + Math.max(0, netWorth(p)) * 0.01 + income * 0.03, 300, cap));
}

/** Seize assets to cover `amount`: cash first, then vehicles, then property. Returns what was taken. */
export function forfeit(p: PlayerState, amount: number): number {
  let left = Math.round(amount);
  const take = (value: number) => {
    const used = Math.min(value, left);
    left -= used;
    return Math.max(0, value - used) * 0.85;
  };
  const cash = Math.min(Math.max(0, p.bankBalance), left);
  p.bankBalance -= cash;
  left -= cash;
  while (left > 0 && p.vehicles.length > 0) {
    const v = p.vehicles.shift()!;
    p.bankBalance += take(Math.max(0, v.currentValue - v.loanBalance));
  }
  while (left > 0 && p.properties.length > 0) {
    const h = p.properties.shift()!;
    p.bankBalance += take(Math.max(0, h.currentValue - h.mortgageBalance));
  }
  return Math.round(amount) - left;
}

export function removeRecordEntry(p: PlayerState, charge: CrimeCharge) {
  const list = charge.juvenile ? p.justice.juvenileRecord : p.criminalRecord;
  const key = charge.juvenile ? `${charge.name} (${charge.severity})` : charge.name;
  const i = list.lastIndexOf(key);
  if (i >= 0) list.splice(i, 1);
}

/** Book a conviction on the permanent record. */
export function recordConviction(p: PlayerState, charge: CrimeCharge) {
  if (charge.juvenile) return;
  const j = p.justice;
  j.convictions += 1;
  if (charge.severity !== "minor") j.felonies += 1;
  if (charge.violent) j.violentConvictions += 1;
  j.lastConvictionYear = p.year;
  j.expunged = false;
  addHeatFloor(p, 25);
}

function addHeatFloor(p: PlayerState, floor: number) {
  p.justice.heat = Math.max(p.justice.heat, floor);
}

// ---------------------------------------------------------------------------
// The record and what it closes off
// ---------------------------------------------------------------------------

export type RecordLevel = "clean" | "misdemeanor" | "felony" | "violent";

export function recordLevel(p: PlayerState): RecordLevel {
  const j = p.justice;
  if (j.expunged) return "clean";
  if (j.violentConvictions > 0) return "violent";
  if (j.felonies > 0 || j.adultTried) return "felony";
  if (j.convictions > 0 || (p.age >= 18 && !j.recordSealed && j.juvenileRecord.length > 0)) return "misdemeanor";
  return "clean";
}

export const RECORD_LABEL: Record<RecordLevel, string> = {
  clean: "Clean record",
  misdemeanor: "Misdemeanour record",
  felony: "Felony record",
  violent: "Violent felony record",
};

const FELONY_CLOSED = ["police", "military", "lawyer", "doctor", "nurse", "teacher", "socialwork", "pilot", "cabin", "finance", "spy", "paramedic", "dentist", "psychology", "vet"];
const MISDEMEANOR_CLOSED = ["police", "spy"];
const VIOLENT_CLOSED = ["security", "firefighter", "professor", "astronaut"];

/** A career permanently closed by your record or history, or null. */
export function careerBlocker(p: PlayerState, lineId: string): string | null {
  const lvl = recordLevel(p);
  if (lineId === "spy" && p.spy.burned) return "The Agency burned you. They will never take you back.";
  if (lvl === "clean") return null;
  const name = lineId === "spy" ? "the Agency" : "this profession";
  if (lvl === "misdemeanor" && MISDEMEANOR_CLOSED.includes(lineId)) return `A criminal record fails the background check for ${name}.`;
  if ((lvl === "felony" || lvl === "violent") && (FELONY_CLOSED.includes(lineId) || MISDEMEANOR_CLOSED.includes(lineId))) {
    return `A felony conviction permanently bars you from ${name}. (Expungement can reopen it.)`;
  }
  if (lvl === "violent" && VIOLENT_CLOSED.includes(lineId)) return `A violent conviction permanently bars you from ${name}.`;
  return null;
}

/** Subtracted from hiring odds: record, recent release, and rehabilitation efforts. */
export function hiringPenalty(p: PlayerState): number {
  const lvl = recordLevel(p);
  let pen = lvl === "violent" ? 0.35 : lvl === "felony" ? 0.25 : lvl === "misdemeanor" ? 0.08 : 0;
  if (hasFlag(p, "ex_con") && !p.justice.expunged) pen = Math.max(pen, 0.25);
  if (pen === 0) return 0;
  if (p.justice.reentry > 0) pen += 0.08;
  const progs = p.justice.programs;
  if (progs.includes("trade")) pen -= 0.08;
  if (progs.includes("ged") || progs.includes("degree")) pen -= 0.04;
  if (progs.includes("therapy")) pen -= 0.02;
  return Math.max(0.02, pen);
}

/** Why the player cannot stand for public office because of their record, or null. */
export function officeBlocker(p: PlayerState): string | null {
  if (p.probation) return "You can't stand for office while on probation or parole.";
  const lvl = recordLevel(p);
  if (lvl === "violent") return "A violent felony conviction bars you from public office.";
  if (lvl === "felony") return "Convicted felons can't stand for office until the record is expunged.";
  return null;
}

/** Why the player cannot move to `dest`, or null. */
export function relocationBlocker(p: PlayerState, dest: string): string | null {
  if (dest === p.residence.country) return p.probation ? "Your probation conditions restrict moving. Ask your officer first." : null;
  if (p.probation) return "You can't leave the country while on probation or parole.";
  const lvl = recordLevel(p);
  if ((lvl === "felony" || lvl === "violent") && lawFor(dest).strictBorders) return `${dest} refuses entry to people with a felony record.`;
  return null;
}

export const EXPUNGE_COST = 3_000;
export const EXPUNGE_WAIT = 7;

export function expungeBlocker(p: PlayerState): string | null {
  const j = p.justice;
  if (j.expunged) return "Your record has already been expunged.";
  if (recordLevel(p) === "clean") return "You have nothing to expunge.";
  if (j.violentConvictions > 0) return "Violent felonies cannot be expunged.";
  if (p.isInPrison || p.probation || p.pendingTrial) return "Finish your sentence and supervision first.";
  if (j.lastConvictionYear !== null && p.year - j.lastConvictionYear < EXPUNGE_WAIT) {
    return `You must stay clean for ${EXPUNGE_WAIT} years (${EXPUNGE_WAIT - (p.year - j.lastConvictionYear)} to go).`;
  }
  if (p.bankBalance < EXPUNGE_COST) return `Legal fees are ${EXPUNGE_COST.toLocaleString("en-US")} dollars.`;
  return null;
}

/** Ask a court to seal an old, non-violent record. Reopens closed careers and removes the ex-con stigma. */
export function petitionExpungement(p0: PlayerState, rng: Rng): ActionResult {
  const why = expungeBlocker(p0);
  if (why) return { player: p0, notices: [{ kind: "info", title: "Can't Petition", body: why, tone: "bad" }] };
  const p = clone(p0);
  p.bankBalance -= EXPUNGE_COST;
  if (rng.chance(0.75)) {
    p.justice.expunged = true;
    p.justice.reentry = 0;
    p.flags = p.flags.filter((f) => f !== "ex_con");
    changeStat(p, "happiness", 8);
    const body = "The judge granted your petition. Your record is sealed from employers and election boards.";
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Record Expunged", body, tone: "good" }] };
  }
  const body = "The judge denied your petition. The prosecutor objected, and your fees are gone. You may try again.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Petition Denied", body, tone: "bad" }] };
}

/** Juvenile records are sealed at 18, unless the offences were serious or numerous. Returns a log line or null. */
export function sealJuvenileRecord(p: PlayerState, rng: Rng): string | null {
  const j = p.justice;
  if (j.juvenileRecord.length === 0 || j.recordSealed) return null;
  const heinous = j.juvenileRecord.some((r) => r.endsWith("(heinous)"));
  const seal = !j.adultTried && !heinous && j.juvenileRecord.length <= 2 && rng.chance(0.85);
  if (seal) {
    j.recordSealed = true;
    return "Your juvenile record was sealed on your 18th birthday. Employers and courts will never see it.";
  }
  for (const r of j.juvenileRecord) p.criminalRecord.push(r.replace(/ \((minor|serious|heinous)\)$/, ""));
  j.convictions += 1;
  j.felonies += j.juvenileRecord.some((r) => /serious|heinous/.test(r)) ? 1 : 0;
  j.recordSealed = false;
  return "Your juvenile record was NOT sealed. The court judged it too serious, and it follows you into adulthood.";
}
