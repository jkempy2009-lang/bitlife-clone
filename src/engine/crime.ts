/**
 * Crime and trial flow: committing crimes (heat, planning, crew), arrest, bail, representation,
 * verdicts, sentencing, probation, fines and forfeiture. Prison life lives in prison.ts.
 */
import type { ActionResult, CrimeCharge, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CRIME_BY_ID, LAWYERS, crimeMeta } from "@/data/crimes";
import { LAW, lawFor } from "@/data/justiceCountries";
import { addLog, changeStat, clone } from "./state";
import {
  CREW_CUT,
  acquittalChance,
  addHeat,
  bailFee,
  bailFor,
  catchChance,
  defaultEvidence,
  expectedYears,
  fineFor,
  forfeit,
  isViolentName,
  lawyerById,
  lawyerCost,
  lawyerQuality,
  planCost,
  recordConviction,
  removeRecordEntry,
  type CrimeOpts,
} from "./justice";

export {
  ESCAPE_PATHS,
  appealSentence,
  attemptEscape,
  requestParole,
  startRiot,
  studyInPrison,
  workOutYard,
} from "./prison";
export type { CrimeOpts } from "./justice";

/** Countries that still apply the death penalty for the worst crimes. */
export const DEATH_PENALTY = new Set(Object.entries(LAW).filter(([, l]) => l.deathPenalty).map(([name]) => name));

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Arrest
// ---------------------------------------------------------------------------

export function startTrial(p: PlayerState, charge: CrimeCharge) {
  if (p.pendingTrial || p.isInPrison) return;
  let c: CrimeCharge = { ...charge };
  if (p.age < 18) {
    // Minors go to juvenile court, unless they are 16+ and accused of something heinous.
    if (c.severity === "heinous" && p.age >= 16) {
      c.juvenile = false;
      p.justice.adultTried = true;
    } else {
      c.juvenile = true;
    }
  }
  if (c.violent === undefined) c.violent = isViolentName(c.name);
  if (c.evidence === undefined) c.evidence = defaultEvidence(p, c, !!c.crimeId && !!crimeMeta(c.crimeId).paper);
  if (p.probation) {
    // Reoffending on probation means the book gets thrown at you; on parole you also owe the rest of the old sentence.
    c = { ...c, years: Math.ceil(c.years * 1.5) + (p.probation.parole ? p.probation.yearsLeft : 0), evidence: Math.min(95, c.evidence + 10) };
    addLog(p, `You violated your ${p.probation.parole ? "parole" : "probation"} for ${p.probation.charge}. The judge is not amused.`);
    p.probation = null;
  }
  c.bail = bailFor(p, c);
  p.pendingTrial = c;
  p.stats.crimesCommitted += 1;
  addHeat(p, 10);
  if (c.juvenile) p.justice.juvenileRecord.push(`${c.name} (${c.severity})`);
  else p.criminalRecord.push(c.name);
  addLog(p, `You were arrested and charged with ${c.name}${c.juvenile ? " (juvenile court)" : ""}.`);
}

/** Attempt a crime from the Crime Rings panel. Planning and crew change the odds and the risks. */
export function commitCrime(p0: PlayerState, crimeId: string, rng: Rng, opts: CrimeOpts = {}): ActionResult {
  const p = clone(p0);
  const crime = CRIME_BY_ID[crimeId];
  if (!crime || p.age < crime.minAge) return { player: p0 };
  if (p.isInPrison || p.pendingTrial) return { player: p0 };
  const blocked = crime.requires?.(p);
  if (blocked) return { player: p0, notices: [info("Can't Do That", blocked)] };
  const meta = crimeMeta(crimeId);
  const plan = (opts.plan ?? 0) as 0 | 1 | 2;
  const crew = (meta.team ? opts.crew ?? 0 : 0) as 0 | 1 | 2;
  const cost = planCost(plan, crimeId);
  if (cost > p.bankBalance) return { player: p0, notices: [info("Can't Afford the Prep", `Planning this job costs ${money(cost)}.`, "bad")] };
  const roll = rng.next();
  const pCatch = catchChance(p, crimeId, { plan, crew }, roll);
  const repeat = p.annual[`crime:${crimeId}`] ?? 0;
  p.annual[`crime:${crimeId}`] = repeat + 1;
  p.bankBalance -= cost;
  addHeat(p, meta.heat * (1 + crew * 0.25));
  if (crew > 0) p.justice.accomplices = Math.min(6, p.justice.accomplices + crew);
  changeStat(p, "karma", crime.karmaDelta);
  if (!rng.chance(pCatch)) {
    const raw = rng.int(crime.reward[0], crime.reward[1]);
    const amount = Math.round(raw * (1 + 0.35 * crew) * (1 - CREW_CUT * crew));
    p.bankBalance += amount;
    p.justice.proceeds += amount;
    p.stats.crimesCommitted += 1;
    const body = `You pulled off ${crime.name.toLowerCase()} and walked away with ${money(amount)}.${crew ? ` Your crew took their cut.` : ""}${p.justice.heat >= 40 ? " You can feel the police getting closer." : ""}`;
    addLog(p, body);
    return { player: p, notices: [info(`${crime.name}: Success`, body, "good")] };
  }
  const evidence = clamp(defaultEvidence(p, crime.charge, meta.paper) + crew * 8 - plan * 10 + rng.int(-10, 15), 5, 95);
  startTrial(p, { ...crime.charge, evidence, crimeId, violent: meta.violent ?? isViolentName(crime.charge.name) });
  return { player: p };
}

// ---------------------------------------------------------------------------
// Pre-trial: bail, bribes, cooperation
// ---------------------------------------------------------------------------

/** Pay a bondsman to get out before trial. You keep your job and prepare a better defence. */
export function postBail(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const charge = p.pendingTrial;
  if (!charge?.bail || charge.bail.posted || charge.bail.denied) return { player: p0 };
  const fee = bailFee(charge.bail.amount);
  if (fee > p.bankBalance) return { player: p0, notices: [info("Can't Make Bail", `A bondsman wants ${money(fee)} (10% of the ${money(charge.bail.amount)} bail).`, "bad")] };
  p.bankBalance -= fee;
  charge.bail.posted = true;
  const body = `A bondsman posted your ${money(charge.bail.amount)} bail for a ${money(fee)} fee. You're out until trial.`;
  addLog(p, body);
  return { player: p, notices: [info("Bail Posted", body, "good")] };
}

export function bribeCost(p: PlayerState, charge: CrimeCharge): number {
  const base = { minor: 2_000, serious: 15_000, heinous: 80_000 }[charge.severity];
  return Math.round((base * (1.4 - lawFor(p.residence.country).corruption)) / 500) * 500;
}

export function bribeChance(p: PlayerState, charge: CrimeCharge): number {
  const sev = charge.severity === "heinous" ? 0.25 : charge.severity === "serious" ? 0.05 : 0;
  return clamp(lawFor(p.residence.country).corruption * 0.9 - sev - ((charge.evidence ?? 50) - 50) / 400, 0.03, 0.8);
}

/** Try to make the case go away. Works where money talks; backfires badly where it doesn't. */
export function bribeOfficial(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const charge = p.pendingTrial;
  if (!charge) return { player: p0 };
  if (charge.juvenile) return { player: p0, notices: [info("Not an Option", "Nobody takes a bribe from a child.", "bad")] };
  if ((p.annual.bribe ?? 0) >= 1) return { player: p0, notices: [info("Burned Your Chance", "You already tried that this year.", "bad")] };
  const cost = bribeCost(p, charge);
  if (cost > p.bankBalance) return { player: p0, notices: [info("Can't Afford It", `The going rate is ${money(cost)}.`, "bad")] };
  p.annual.bribe = 1;
  p.bankBalance -= cost;
  changeStat(p, "karma", -6);
  if (rng.chance(bribeChance(p, charge))) {
    removeRecordEntry(p, charge);
    p.pendingTrial = null;
    addHeat(p, 5);
    const body = `Someone senior took your ${money(cost)} and lost the paperwork. The ${charge.name} charge vanished.`;
    addLog(p, body);
    return { player: p, notices: [info("Charges Dropped", body, "bad")] };
  }
  charge.years = Math.ceil(charge.years * 1.3);
  charge.evidence = Math.min(95, (charge.evidence ?? 50) + 15);
  changeStat(p, "karma", -4);
  const body = `The official reported you instead. You lost ${money(cost)} and the prosecutor added an attempted-bribery count.`;
  addLog(p, body);
  return { player: p, notices: [info("Bribe Backfired", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Verdict and sentence
// ---------------------------------------------------------------------------

export interface Representation {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  /** Chance of acquittal (null for a plea). */
  acquittal: number | null;
  /** Years you would likely serve if convicted. */
  years: number;
  affordable: boolean;
  /** Reason it is not on the table. */
  locked?: string;
}

/** The menu shown at trial: every option with its price, odds and likely sentence. */
export function representationOptions(p: PlayerState): Representation[] {
  const charge = p.pendingTrial;
  if (!charge) return [];
  const base = expectedYears(p, charge);
  const out: Representation[] = LAWYERS.map((l) => {
    const cost = lawyerCost(p, charge, l);
    const plea = l.id === "plea";
    const q = plea ? 0 : lawyerQuality(p, l);
    return {
      id: l.id,
      name: l.name,
      blurb: l.blurb,
      cost,
      acquittal: plea ? null : acquittalChance(p, charge, l.id),
      years: plea ? Math.max(1, Math.ceil(base * 0.5)) : Math.max(1, Math.round(base * (1 - 0.25 * q))),
      affordable: cost <= p.bankBalance,
    };
  });
  const inMob = p.currentJob?.lineId === "mafia";
  if (inMob && !charge.juvenile) {
    out.push({ id: "cooperate", name: "Cooperate with Prosecutors", blurb: "Testify against the family. A third of the sentence, witness protection, and a target on your back.", cost: 0, acquittal: null, years: Math.max(1, Math.ceil(base * 0.35)), affordable: true });
  }
  return out;
}

function payTime(p: PlayerState, charge: CrimeCharge, rng: Rng, years: number, extra: { plea: boolean; q: number; detained: boolean; cooperate?: boolean }): ActionResult {
  const j = p.justice;
  const priors = j.convictions;
  recordConviction(p, charge);
  const seizedTarget = j.proceeds > 0 ? Math.round(j.proceeds * rng.float(0.5, 1)) : 0;
  const seized = seizedTarget > 0 ? forfeit(p, seizedTarget) : 0;
  j.proceeds = 0;
  const seizedText = seized > 0 ? ` The court seized ${money(seized)} of your proceeds.` : "";
  const pleaText = extra.plea ? " (plea bargain)" : "";

  // Minor offences, and first offenders with a strong lawyer, often avoid a cell.
  const minor = charge.severity === "minor";
  const probChance = charge.juvenile
    ? (minor ? 0.85 : 0.45)
    : minor
      ? clamp(0.4 + extra.q * 0.3 + (priors === 0 ? 0.15 : -0.1 * Math.min(priors, 3)) + (extra.plea ? 0.1 : 0), 0.1, 0.9)
      : charge.severity === "serious" && priors === 0 && extra.q >= 0.5 && !extra.plea
        ? 0.2
        : 0;
  if (!extra.cooperate && probChance > 0 && rng.chance(probChance)) {
    const fine = charge.juvenile ? 0 : fineFor(p, rng.int(500, 5_000));
    p.bankBalance -= fine;
    const term = minor ? years + 1 : Math.max(2, years);
    p.probation = { yearsLeft: term, charge: charge.name, strikes: 0 };
    changeStat(p, "happiness", -6);
    const body = charge.juvenile
      ? `Found delinquent of ${charge.name}${pleaText}. The juvenile court ordered counselling and ${term} years of probation instead of detention. Stay out of trouble.`
      : `Found guilty of ${charge.name}${pleaText}, but the judge showed leniency: a ${money(fine)} fine (scaled to your means) and ${term} years of probation. Stay out of trouble.${seizedText}`;
    addLog(p, body);
    return { player: p, notices: [info("Probation", body, "bad")] };
  }

  p.isInPrison = true;
  const capital = !charge.juvenile && !!charge.capital && !extra.plea && !extra.cooperate && DEATH_PENALTY.has(p.residence.country) && rng.chance(0.3);
  const credit = !charge.juvenile && extra.detained && years > 2 ? 1 : 0;
  p.prison = capital
    ? { charge: charge.name, sentenceYears: rng.int(3, 7), yearsServed: 0, deathRow: true }
    : { charge: charge.name, sentenceYears: years, yearsServed: credit, creditYears: credit || undefined };
  p.prison.conduct = 70;
  p.prison.standing = 20;
  p.prison.gang = null;
  p.prison.job = null;
  p.prison.programs = [];
  p.prison.progress = {};
  p.prison.solitary = 0;
  p.prison.appeals = 0;
  if (charge.juvenile) p.prison.juvenile = true;
  if (charge.innocent) p.prison.wrongful = true;
  if (extra.cooperate) {
    p.mob.informant = true;
    p.mob.witsec = true;
  }
  p.currentJob = null;
  p.annualSalary = 0;
  changeStat(p, "happiness", -15);
  changeStat(p, "fame", -5);
  const body = capital
    ? `GUILTY. The judge sentenced you to DEATH for ${charge.name}. You have about ${p.prison.sentenceYears} years of appeals left.${seizedText}`
    : charge.juvenile
      ? `Found delinquent of ${charge.name}${pleaText}. You were sent to juvenile detention for up to ${years} year${years > 1 ? "s" : ""}. No adult prison, and your record is sealed if you stay out of trouble.`
      : `GUILTY. The judge sentenced you to ${years} year${years > 1 ? "s" : ""} in prison for ${charge.name}${pleaText}.${credit ? " One year of pre-trial detention counts as time served." : ""} You lost your job.${seizedText}${charge.innocent ? " You know you didn't do it." : ""}`;
  addLog(p, body);
  return { player: p, notices: [info(charge.juvenile ? "Juvenile Detention" : "Found Guilty", body, "bad")] };
}

/** Resolve the Trial overlay by choosing representation. */
export function resolveTrial(p0: PlayerState, lawyerId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const charge = p.pendingTrial;
  if (!charge) return { player: p0 };
  const cooperate = lawyerId === "cooperate";
  if (cooperate && p.currentJob?.lineId !== "mafia") return { player: p0 };
  const lawyer = lawyerById(cooperate ? "plea" : lawyerId);
  if (!lawyer) return { player: p0 };
  const cost = lawyerCost(p, charge, lawyer);
  if (cost > p.bankBalance) {
    return { player: p0, notices: [info("Can't afford it", `${lawyer.name} costs ${money(cost)}.`, "bad")] };
  }
  p.bankBalance -= cost;
  p.pendingTrial = null;
  const plea = lawyer.id === "plea";
  const detained = !charge.juvenile && !!charge.bail && !charge.bail.posted;
  const notices: NonNullable<ActionResult["notices"]> = [];

  // Waiting in a cell costs you your job and your health, whatever the verdict.
  if (detained) {
    changeStat(p, "health", -2);
    changeStat(p, "happiness", -4);
    if (p.currentJob && rng.chance(0.7)) {
      addLog(p, `You lost your job as a ${p.currentJob.title} while locked up awaiting trial.`);
      p.currentJob = null;
      p.annualSalary = 0;
    }
  }

  const q = plea ? 0 : lawyerQuality(p, lawyer);
  if (!plea) {
    if (rng.chance(0.04)) {
      removeRecordEntry(p, charge);
      addHeat(p, -5);
      const body = `The jury could not reach a verdict on ${charge.name}, and prosecutors declined to retry. The case is over.`;
      addLog(p, body);
      return { player: p, notices: [info("Hung Jury", body, "good")] };
    }
    const jury = rng.float(-0.1, 0.1);
    if (rng.chance(clamp(acquittalChance(p, charge, lawyer.id) + jury, 0.01, 0.95))) {
      removeRecordEntry(p, charge);
      addHeat(p, -8);
      changeStat(p, "happiness", 6);
      const body = charge.innocent
        ? `${lawyer.name} showed the jury what really happened. You were found NOT GUILTY of ${charge.name}. Justice, for once.`
        : `${lawyer.name} was brilliant. You were found NOT GUILTY of ${charge.name}!`;
      addLog(p, body);
      return { player: p, notices: [info("Not Guilty", body, "good")] };
    }
  }

  const base = expectedYears(p, charge);
  const years = cooperate
    ? Math.max(1, Math.ceil(base * 0.35))
    : plea
      ? Math.max(1, Math.ceil(base * 0.5))
      : Math.max(1, Math.round(base * rng.float(0.8, 1.25) * (1 - 0.25 * q)));
  const result = payTime(p, charge, rng, years, { plea, q, detained, cooperate });
  if (cooperate) {
    p.currentJob = null;
    notices.push(info("You Talked", "The family will know by morning. You are in the programme now.", "bad"));
  }
  return { player: result.player, notices: [...(result.notices ?? []), ...notices] };
}
