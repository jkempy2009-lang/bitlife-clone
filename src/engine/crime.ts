import type { ActionResult, CrimeCharge, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CRIME_BY_ID, LAWYERS } from "@/data/crimes";
import { addLog, changeStat, clone, hasFlag, setFlag } from "./state";

/** Countries that still apply the death penalty for the worst crimes. */
export const DEATH_PENALTY = new Set(["United States", "Japan", "India", "Nigeria"]);

export function startTrial(p: PlayerState, charge: CrimeCharge) {
  if (p.pendingTrial || p.isInPrison) return;
  if (p.probation) {
    // Reoffending on probation means the book gets thrown at you.
    charge = { ...charge, years: Math.ceil(charge.years * 1.5) };
    addLog(p, `You violated your probation for ${p.probation.charge}. The judge is not amused.`);
    p.probation = null;
  }
  p.pendingTrial = charge;
  p.stats.crimesCommitted += 1;
  p.criminalRecord.push(charge.name);
  addLog(p, `You were arrested and charged with ${charge.name}.`);
}

/** Attempt a crime from the Crime Rings panel. */
export function commitCrime(p0: PlayerState, crimeId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const crime = CRIME_BY_ID[crimeId];
  if (!crime || p.age < crime.minAge) return { player: p0 };
  const blocked = crime.requires?.(p);
  if (blocked) return { player: p0, notices: [{ kind: "info", title: "Can't Do That", body: blocked, tone: "neutral" }] };
  const repeat = p.annual[`crime:${crime.id}`] ?? 0;
  p.annual[`crime:${crime.id}`] = repeat + 1;
  // Each repeat in the same year makes the cops warier.
  const chance = clamp(crime.successChance(p, rng.next()) * Math.pow(0.85, repeat), 0.02, 0.95);
  if (rng.chance(chance)) {
    const amount = rng.int(crime.reward[0], crime.reward[1]);
    p.bankBalance += amount;
    changeStat(p, "karma", crime.karmaDelta);
    p.stats.crimesCommitted += 1;
    const body = `You pulled off ${crime.name.toLowerCase()} and walked away with ${money(amount)}.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: `${crime.name}: Success`, body, tone: "good" }] };
  }
  changeStat(p, "karma", crime.karmaDelta);
  startTrial(p, crime.charge);
  return { player: p };
}

/** Resolve the Trial overlay by choosing representation. */
export function resolveTrial(p0: PlayerState, lawyerId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const charge = p.pendingTrial;
  const lawyer = LAWYERS.find((l) => l.id === lawyerId);
  if (!charge || !lawyer) return { player: p0 };
  if (lawyer.cost > p.bankBalance) {
    return { player: p0, notices: [{ kind: "info", title: "Can't afford it", body: `${lawyer.name} costs ${money(lawyer.cost)}.`, tone: "bad" }] };
  }
  p.bankBalance -= lawyer.cost;
  p.pendingTrial = null;
  const plea = lawyer.id === "plea";
  if (!plea && rng.chance(lawyer.successChance)) {
    const body = `${lawyer.name} was brilliant. You were found NOT GUILTY of ${charge.name}!`;
    addLog(p, body);
    changeStat(p, "happiness", 6);
    return { player: p, notices: [{ kind: "info", title: "Not Guilty", body, tone: "good" }] };
  }
  const years = plea ? Math.max(1, Math.ceil(charge.years / 2)) : Math.max(1, charge.years + rng.int(-1, 1));
  // Minor offences often end in a fine and probation instead of a cell.
  if (charge.severity === "minor" && rng.chance(0.55)) {
    const fine = rng.int(500, 5_000);
    p.bankBalance -= fine;
    p.probation = { yearsLeft: years + 1, charge: charge.name };
    changeStat(p, "happiness", -6);
    const body = `Found guilty of ${charge.name}${plea ? " (plea bargain)" : ""}, but the judge showed leniency: a ${money(fine)} fine and ${years + 1} years of probation. Stay out of trouble.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Probation", body, tone: "bad" }] };
  }
  p.isInPrison = true;
  const capital = !!charge.capital && !plea && DEATH_PENALTY.has(p.residence.country) && rng.chance(0.3);
  p.prison = capital
    ? { charge: charge.name, sentenceYears: rng.int(3, 7), yearsServed: 0, deathRow: true }
    : { charge: charge.name, sentenceYears: years, yearsServed: 0 };
  p.currentJob = null;
  p.annualSalary = 0;
  changeStat(p, "happiness", -15);
  changeStat(p, "fame", -5);
  const body = capital
    ? `GUILTY. The judge sentenced you to DEATH for ${charge.name}. You have about ${p.prison.sentenceYears} years of appeals left.`
    : `GUILTY. The judge sentenced you to ${years} year${years > 1 ? "s" : ""} in prison for ${charge.name}. You lost your job.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Found Guilty", body, tone: "bad" }] };
}

// ---------------------------------------------------------------------------
// Prison activities
// ---------------------------------------------------------------------------

export const ESCAPE_PATHS = [
  { id: "tunnel", name: "Dig a Tunnel", blurb: "Slow, dirty, and weirdly romantic.", chance: 0.14 },
  { id: "disguise", name: "Guard Disguise", blurb: "Walk out the front door in a stolen uniform.", chance: 0.1 },
  { id: "laundry", name: "Laundry Truck", blurb: "Hide among the dirty sheets.", chance: 0.18 },
  { id: "riot_cover", name: "Escape During a Distraction", blurb: "Chaos is a ladder.", chance: 0.08 },
] as const;

export function workOutYard(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if ((p.annual.yard ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Spent", body: "You already worked out this year. Your arms say thanks.", tone: "neutral" }] };
  }
  p.annual.yard = 1;
  changeStat(p, "health", 2);
  const body = "You lifted weights in the yard. +2 Health.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Yard Time", body, tone: "good" }] };
}

export function attemptEscape(p0: PlayerState, pathId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const path = ESCAPE_PATHS.find((x) => x.id === pathId);
  if (!path || !p.prison) return { player: p0 };
  if ((p.annual.escape ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Too hot", body: "The guards are watching you closely this year.", tone: "neutral" }] };
  }
  p.annual.escape = 1;
  if (rng.chance(path.chance + (p.smarts - 50) / 800)) {
    p.isInPrison = false;
    p.isFugitive = true;
    setFlag(p, "fugitive");
    setFlag(p, "escaped");
    changeStat(p, "karma", -10);
    const body = `You escaped via "${path.name}"! You're a free man... woman... person — but now a fugitive.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "ESCAPED!", body, tone: "jackpot" }] };
  }
  p.prison.sentenceYears += 3;
  changeStat(p, "happiness", -10);
  changeStat(p, "health", -5);
  const body = `Your escape attempt ("${path.name}") failed. The warden added 3 years to your sentence.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Escape Failed", body, tone: "bad" }] };
}

export function startRiot(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if ((p.annual.riot ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Quiet down", body: "The guards are on high alert. No riot this year.", tone: "neutral" }] };
  }
  p.annual.riot = 1;
  const roll = rng.next();
  let body: string;
  let tone: "good" | "bad" | "neutral";
  if (roll < 0.3) {
    changeStat(p, "health", -rng.int(10, 25));
    changeStat(p, "happiness", -rng.int(5, 12));
    body = "The riot turned violent. You took a beating before the guards restored order.";
    tone = "bad";
  } else if (roll < 0.7) {
    changeStat(p, "health", -rng.int(2, 8));
    changeStat(p, "happiness", rng.int(3, 8));
    changeStat(p, "fame", 1);
    body = "You threw a few punches, earned some respect, and escaped with bruises.";
    tone = "neutral";
  } else {
    changeStat(p, "happiness", rng.int(8, 14));
    changeStat(p, "health", -rng.int(0, 3));
    changeStat(p, "karma", -3);
    body = "The riot was glorious chaos. You came out the folk hero of Cell Block C.";
    tone = "good";
  }
  if (p.prison && rng.chance(0.35)) {
    p.prison.sentenceYears += 1;
    body += " Your sentence was extended by a year.";
  }
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "RIOT!", body, tone }] };
}

export function appealSentence(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!p.prison?.deathRow) return { player: p0 };
  if ((p.annual.appeal ?? 0) >= 1) return { player: p0, notices: [{ kind: "info", title: "Pending", body: "Your lawyers have already filed this year.", tone: "neutral" }] };
  p.annual.appeal = 1;
  if (rng.chance(clamp(0.15 + p.smarts / 500, 0.1, 0.4))) {
    p.prison.deathRow = false;
    p.prison.sentenceYears = p.prison.yearsServed + 30;
    const body = "Your appeal succeeded. The death sentence was commuted to 30 more years in prison.";
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Commuted", body, tone: "good" }] };
  }
  const body = "The court rejected your appeal. The execution date draws closer.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Appeal Denied", body, tone: "bad" }] };
}

export function requestParole(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!p.prison || p.prison.deathRow) return { player: p0 };
  if ((p.annual.parole ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Already heard", body: "The board only hears one case a year.", tone: "neutral" }] };
  }
  if (p.prison.yearsServed < p.prison.sentenceYears / 2) {
    return { player: p0, notices: [{ kind: "info", title: "Too soon", body: "You need to serve at least half of your sentence first.", tone: "neutral" }] };
  }
  p.annual.parole = 1;
  const chance = clamp(0.1 + (p.karma - 30) / 200 + (hasFlag(p, "fugitive") ? -0.1 : 0), 0.05, 0.6);
  if (rng.chance(chance)) {
    p.isInPrison = false;
    p.prison = null;
    setFlag(p, "ex_con");
    const body = "The parole board granted your release. You walk free.";
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Paroled!", body, tone: "good" }] };
  }
  const body = "The parole board denied your request. Try again next year.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Parole Denied", body, tone: "bad" }] };
}

export function studyInPrison(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if ((p.annual.prisonstudy ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Lights out", body: "You've read enough this year.", tone: "neutral" }] };
  }
  p.annual.prisonstudy = 1;
  changeStat(p, "smarts", 2);
  changeStat(p, "happiness", 1);
  const body = "You spent your free hours in the prison library. +2 Smarts.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Library Time", body, tone: "good" }] };
}
