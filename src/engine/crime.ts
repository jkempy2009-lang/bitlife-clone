/**
 * Crime and trial flow: committing crimes (heat, planning, crew), arrest, bail, representation,
 * verdicts, sentencing, probation, fines and forfeiture. Prison life lives in prison.ts.
 */
import type { ActionResult, CrimeCharge, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CRIME_BY_ID, LAWYERS, crimeMeta } from "@/data/crimes";
import { LAW } from "@/data/justiceCountries";
import { addLog, changeStat, clone } from "./state";
import { dropMobPlace, parkMobPlace, restoreMobPlace } from "./mobPlace";
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
  lawOf,
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
  return Math.round((base * (1.4 - lawOf(p).corruption)) / 500) * 500;
}

export function bribeChance(p: PlayerState, charge: CrimeCharge): number {
  const sev = charge.severity === "heinous" ? 0.25 : charge.severity === "serious" ? 0.05 : 0;
  return clamp(lawOf(p).corruption * 0.9 - sev - ((charge.evidence ?? 50) - 50) / 400, 0.03, 0.8);
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
  /** Terms and risks in plain words, shown instead of the default odds line. */
  detail?: string;
}

/** How much of the sentence a straight guilty plea leaves: stingy when the case is strong, generous when it is shaky. */
export const pleaFactor = (charge: CrimeCharge) => clamp(0.5 + ((charge.evidence ?? 50) - 55) / 160, 0.45, 0.78);

const LESSER_NAMES: Record<string, string> = {
  Burglary: "Criminal Trespass",
  "Grand Theft Auto": "Joyriding",
  "Computer Fraud": "Unauthorised Computer Access",
  Counterfeiting: "Trademark Infringement",
  "Identity Fraud": "Misuse of Personal Data",
  "Tax Evasion": "Tax Filing Violation",
  Embezzlement: "Misuse of Funds",
  "Insurance Fraud": "False Statement",
  Smuggling: "Customs Violation",
  "Drug Trafficking": "Drug Possession",
  "Armed Robbery": "Theft by Threat",
  Extortion: "Harassment",
  Racketeering: "Conspiracy",
  "Money Laundering": "Structuring Deposits",
  "Armed Bank Robbery": "Robbery",
  Murder: "Manslaughter",
  "Attempted Murder": "Aggravated Assault",
  Kidnapping: "False Imprisonment",
  Arson: "Criminal Damage",
  Assault: "Disorderly Conduct",
  Conspiracy: "Obstruction",
  "Corruption in Office": "Breach of Public Trust",
};

/** The lesser offence a prosecutor might accept a plea to, or null if there is nothing below this charge. */
export function lesserCharge(charge: CrimeCharge): CrimeCharge | null {
  if (charge.severity === "minor" || charge.juvenile) return null;
  const heinous = charge.severity === "heinous";
  const name = LESSER_NAMES[charge.name] ?? `Lesser count of ${charge.name.toLowerCase()}`;
  return {
    ...charge,
    name,
    severity: heinous ? "serious" : "minor",
    years: Math.max(1, Math.round(charge.years * (heinous ? 0.5 : 0.4))),
    capital: false,
    violent: heinous ? charge.violent : false,
    description: `Prosecutors agreed to reduce the charge to ${name.toLowerCase()} in return for a guilty plea.`,
  };
}

/** Chance a prosecutor trades a lesser charge: weaker evidence and a clean record help; a heinous crime and priors do not. */
export function reducedChance(p: PlayerState, charge: CrimeCharge): number {
  return clamp(
    0.78 - ((charge.evidence ?? 50) - 50) / 150 - p.justice.convictions * 0.07 - (charge.severity === "heinous" ? 0.25 : 0) + (p.karma - 50) / 500 + (p.skills.charisma - 30) / 1000,
    0.1,
    0.85,
  );
}

/** Anyone with accomplices to name, and every made man, can trade testimony for a lighter sentence. */
export function canCooperate(p: PlayerState, charge: CrimeCharge): boolean {
  return !charge.juvenile && (p.currentJob?.lineId === "mafia" || p.justice.accomplices > 0);
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
      years: plea ? Math.max(1, Math.ceil(base * pleaFactor(charge))) : Math.max(1, Math.round(base * (1 - 0.25 * q))),
      affordable: cost <= p.bankBalance,
      detail: plea ? `Certain conviction as charged, about ${Math.max(1, Math.ceil(base * pleaFactor(charge)))} year${Math.max(1, Math.ceil(base * pleaFactor(charge))) === 1 ? "" : "s"}. The prosecutor takes ${Math.round((1 - pleaFactor(charge)) * 100)}% off because ${(charge.evidence ?? 50) >= 70 ? "their case is strong, so the discount is small" : "they want a sure thing"}.` : undefined,
    };
  });
  const lesser = lesserCharge(charge);
  const priv = lawyerById("private");
  if (lesser && priv) {
    const cost = lawyerCost(p, charge, priv);
    const lesserYears = Math.max(1, Math.ceil(expectedYears(p, lesser) * 0.7));
    out.push({
      id: "plea_reduced",
      name: "Negotiate a Lesser Charge",
      blurb: `Your private attorney bargains with the prosecutor to reduce the charge to ${lesser.name.toLowerCase()}.`,
      cost,
      acquittal: null,
      years: lesserYears,
      affordable: cost <= p.bankBalance,
      detail: `${Math.round(reducedChance(p, charge) * 100)}% the prosecutor agrees: ${lesser.severity === "minor" ? "a misdemeanour on your record, and probably no cell" : "a lesser felony"} (about ${lesserYears} year${lesserYears === 1 ? "" : "s"} at most). If not, your attorney takes the case to trial (${Math.round(acquittalChance(p, charge, "private") * 100)}% acquittal) and you keep the fee's worth of defence.`,
    });
  }
  if (canCooperate(p, charge)) {
    const mob = p.currentJob?.lineId === "mafia";
    const years = Math.max(1, Math.ceil(base * 0.35));
    out.push({
      id: "cooperate",
      name: mob ? "Cooperate with Prosecutors" : "Testify Against Your Accomplices",
      blurb: mob
        ? "Testify against the family. A third of the sentence, witness protection, and a target on your back."
        : "Name the people you worked with. A third of the sentence, and every street in the country will know you talked.",
      cost: 0,
      acquittal: null,
      years,
      affordable: true,
      detail: `About ${years} year${years === 1 ? "" : "s"}. ${mob ? "The family will never take you back." : "No gang or crew will trust you again, you start your sentence with no standing, and old associates may come looking."}`,
    });
  }
  return out;
}

/** Politicians who are convicted lose their seat; a minor conviction only costs them votes. */
function loseOffice(p: PlayerState, charge: CrimeCharge, prison: boolean) {
  const job = p.currentJob;
  if (job?.lineId !== "politics") return;
  const sc = p.statecraft;
  if (charge.severity === "minor" && !prison) {
    p.politics.popularity = clamp(p.politics.popularity - 10);
    addLog(p, "Your conviction made the front pages. Your approval rating took the hit, but voters let you keep the seat.");
    return;
  }
  p.currentJob = null;
  p.annualSalary = 0;
  sc.termsInOffice = 0;
  sc.removed += 1;
  p.politics.yearsInOffice = 0;
  p.politics.popularity = clamp(p.politics.popularity - 15);
  addLog(p, `Convicted of ${charge.name}, you forfeited your seat as ${job.title}.`);
}

function payTime(p: PlayerState, charge: CrimeCharge, rng: Rng, years: number, extra: { plea: boolean; q: number; detained: boolean; cooperate?: boolean }): ActionResult {
  const j = p.justice;
  const priors = j.convictions;
  const wasMob = p.currentJob?.lineId === "mafia";
  recordConviction(p, charge);
  const seizedTarget = j.proceeds > 0 ? Math.round(j.proceeds * rng.float(0.5, 1)) : 0;
  const seized = seizedTarget > 0 ? forfeit(p, seizedTarget) : 0;
  j.proceeds = 0;
  const seizedText = seized > 0 ? ` The court seized ${money(seized)} of your proceeds.` : "";
  const pleaText = extra.plea ? " (plea bargain)" : "";

  // Minor adult offences: fines, community service, probation, and a short jail stint for the repeat offender.
  // A cell for a year is not what a court gives a first shoplifter.
  if (charge.severity === "minor" && !charge.juvenile) {
    const repeatJail = priors >= 3 && !rng.chance(clamp(0.35 + extra.q * 0.3 + (extra.plea ? 0.1 : 0), 0.1, 0.8));
    if (!repeatJail) {
      loseOffice(p, charge, false);
      const roll = rng.next();
      const jailChance = priors >= 1 ? 0.12 + 0.05 * Math.min(priors, 3) : 0;
      const fine = fineFor(p, rng.int(500, 5_000));
      p.bankBalance -= fine;
      if (roll < jailChance) {
        const weeks = rng.int(2, 12);
        changeStat(p, "happiness", -6);
        changeStat(p, "health", -1);
        let lost = "";
        if (p.currentJob && p.currentJob.lineId !== "politics" && rng.chance(0.4)) {
          lost = ` Your employer let you go while you were away.`;
          p.currentJob = null;
          p.annualSalary = 0;
        }
        const body = `Found guilty of ${charge.name}${pleaText}. The judge gave you ${weeks} weeks in the county jail and a ${money(fine)} fine.${lost}${seizedText}`;
        addLog(p, body);
        return { player: p, notices: [info("Short Jail Term", body, "bad")] };
      }
      if (roll < jailChance + 0.45) {
        const term = years + 1;
        p.probation = { yearsLeft: term, charge: charge.name, strikes: 0 };
        changeStat(p, "happiness", -5);
        const body = `Found guilty of ${charge.name}${pleaText}: a ${money(fine)} fine and ${term} year${term === 1 ? "" : "s"} of probation. No cell this time. Stay out of trouble.${seizedText}`;
        addLog(p, body);
        return { player: p, notices: [info("Probation", body, "bad")] };
      }
      changeStat(p, "happiness", -3);
      const body = `Found guilty of ${charge.name}${pleaText}. The judge ordered a ${money(fine)} fine and community service. It is on your record, but nobody is taking you away.${seizedText}`;
      addLog(p, body);
      return { player: p, notices: [info("Fined", body, "bad")] };
    }
  }

  // Juveniles and first offenders with a strong lawyer often avoid a cell.
  const probChance = charge.juvenile
    ? (charge.severity === "minor" ? 0.85 : 0.45)
    : charge.severity === "serious" && priors === 0 && (extra.q >= 0.5 || extra.plea) && !extra.cooperate
      ? (extra.q >= 0.5 ? 0.2 : 0.12)
      : 0;
  if (!extra.cooperate && probChance > 0 && rng.chance(probChance)) {
    loseOffice(p, charge, false);
    const fine = charge.juvenile ? 0 : fineFor(p, rng.int(500, 5_000));
    p.bankBalance -= fine;
    const term = Math.max(2, years);
    p.probation = { yearsLeft: term, charge: charge.name, strikes: 0 };
    changeStat(p, "happiness", -6);
    const body = charge.juvenile
      ? `Found delinquent of ${charge.name}${pleaText}. The juvenile court ordered counselling and ${term} years of probation instead of detention. Stay out of trouble.`
      : `Found guilty of ${charge.name}${pleaText}, but the judge showed leniency: a ${money(fine)} fine (scaled to your means) and ${term} years of probation. Stay out of trouble.${seizedText}`;
    addLog(p, body);
    return { player: p, notices: [info("Probation", body, "bad")] };
  }

  loseOffice(p, charge, true);
  if (wasMob && !extra.cooperate) parkMobPlace(p);
  p.isInPrison = true;
  const capital = !charge.juvenile && !!charge.capital && !extra.plea && !extra.cooperate && lawOf(p).deathPenalty && rng.chance(0.3);
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
    if (wasMob) {
      p.mob.informant = true;
      p.mob.witsec = true;
      dropMobPlace(p);
    } else {
      j.snitch = true;
      j.accomplices = 0;
      j.gangTies = null;
      p.prison.standing = 3;
    }
  }
  p.currentJob = null;
  p.annualSalary = 0;
  changeStat(p, "happiness", -15);
  changeStat(p, "fame", -5);
  const body = capital
    ? `GUILTY. The judge sentenced you to DEATH for ${charge.name}. You have about ${p.prison.sentenceYears} years of appeals left.${seizedText}`
    : charge.juvenile
      ? `Found delinquent of ${charge.name}${pleaText}. You were sent to juvenile detention for up to ${years} year${years > 1 ? "s" : ""}. No adult prison, and your record is sealed if you stay out of trouble.`
      : `GUILTY. The judge sentenced you to ${years} year${years > 1 ? "s" : ""} in prison for ${charge.name}${pleaText}.${credit ? " One year of pre-trial detention counts as time served." : ""} You lost your job.${seizedText}${charge.innocent ? " You know you didn't do it." : ""}${wasMob && !extra.cooperate ? " The family will keep your place if you keep quiet." : ""}`;
  addLog(p, body);
  return { player: p, notices: [info(charge.juvenile ? "Juvenile Detention" : "Found Guilty", body, "bad")] };
}

/** Resolve the Trial overlay by choosing representation. */
export function resolveTrial(p0: PlayerState, lawyerId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const original = p.pendingTrial;
  if (!original) return { player: p0 };
  const cooperate = lawyerId === "cooperate";
  const negotiate = lawyerId === "plea_reduced";
  if (cooperate && !canCooperate(p, original)) return { player: p0 };
  if (negotiate && !lesserCharge(original)) return { player: p0 };
  const lawyer = lawyerById(cooperate ? "plea" : negotiate ? "private" : lawyerId);
  if (!lawyer) return { player: p0 };
  const cost = lawyerCost(p, original, lawyer);
  if (cost > p.bankBalance) {
    return { player: p0, notices: [info("Can't afford it", `${lawyer.name} costs ${money(cost)}.`, "bad")] };
  }
  p.bankBalance -= cost;
  p.pendingTrial = null;
  let charge: CrimeCharge = original;
  let plea = lawyer.id === "plea";
  const detained = !charge.juvenile && !!charge.bail && !charge.bail.posted;
  const notices: NonNullable<ActionResult["notices"]> = [];

  // Waiting in a cell costs you your job and your health, whatever the verdict. The family keeps a made man's place.
  if (detained) {
    changeStat(p, "health", -2);
    changeStat(p, "happiness", -4);
    if (p.currentJob?.lineId === "mafia") {
      parkMobPlace(p);
      p.currentJob = null;
      p.annualSalary = 0;
    } else if (p.currentJob && p.currentJob.lineId !== "politics" && rng.chance(0.7)) {
      addLog(p, `You lost your job as a ${p.currentJob.title} while locked up awaiting trial.`);
      p.currentJob = null;
      p.annualSalary = 0;
    }
  }

  // Plea negotiation: a lesser charge if the prosecutor bites, otherwise a trial with the attorney you hired.
  let negotiated = false;
  if (negotiate) {
    const lesser = lesserCharge(charge)!;
    if (rng.chance(reducedChance(p, charge))) {
      const list = charge.juvenile ? p.justice.juvenileRecord : p.criminalRecord;
      const at = list.lastIndexOf(charge.name);
      if (at >= 0) list[at] = lesser.name;
      const body = `Your attorney got the prosecutor to accept a plea to ${lesser.name.toLowerCase()}. It is a ${lesser.severity === "minor" ? "misdemeanour" : "lesser felony"}, and it is on your record instead of ${charge.name.toLowerCase()}.`;
      addLog(p, body);
      notices.push(info("Deal Struck", body, "good"));
      charge = lesser;
      plea = true;
      negotiated = true;
    } else {
      const body = `The prosecutor refused to move on ${charge.name.toLowerCase()}. Your attorney is taking the case to a jury.`;
      addLog(p, body);
      notices.push(info("No Deal", body, "bad"));
    }
  }

  const q = plea && !negotiated ? 0 : lawyerQuality(p, lawyer);
  if (!plea) {
    if (rng.chance(0.04)) {
      removeRecordEntry(p, charge);
      addHeat(p, -5);
      restoreMobPlace(p, rng, 0, notices);
      const body = `The jury could not reach a verdict on ${charge.name}, and prosecutors declined to retry. The case is over.`;
      addLog(p, body);
      return { player: p, notices: [...notices, info("Hung Jury", body, "good")] };
    }
    const jury = rng.float(-0.1, 0.1);
    if (rng.chance(clamp(acquittalChance(p, charge, lawyer.id) + jury, 0.01, 0.95))) {
      removeRecordEntry(p, charge);
      addHeat(p, -8);
      changeStat(p, "happiness", 6);
      restoreMobPlace(p, rng, 0, notices);
      const body = charge.innocent
        ? `${lawyer.name} showed the jury what really happened. You were found NOT GUILTY of ${charge.name}. Justice, for once.`
        : `${lawyer.name} was brilliant. You were found NOT GUILTY of ${charge.name}!`;
      addLog(p, body);
      return { player: p, notices: [...notices, info("Not Guilty", body, "good")] };
    }
  }

  const base = expectedYears(p, charge);
  const years = cooperate
    ? Math.max(1, Math.ceil(base * 0.35))
    : negotiated
      ? Math.max(1, Math.ceil(base * 0.7))
      : plea
        ? Math.max(1, Math.ceil(base * pleaFactor(charge)))
        : Math.max(1, Math.round(base * rng.float(0.8, 1.25) * (1 - 0.25 * q)));
  const result = payTime(p, charge, rng, years, { plea, q, detained, cooperate });
  if (cooperate) {
    p.currentJob = null;
    const mob = !!p.mob.witsec;
    notices.push(info("You Talked", mob ? "The family will know by morning. You are in the programme now." : "Your accomplices will know by morning. Nobody on the street will trust you again.", "bad"));
  }
  return { player: result.player, notices: [...notices, ...(result.notices ?? [])] };
}
