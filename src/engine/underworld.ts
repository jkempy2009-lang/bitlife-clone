/**
 * The Underworld: join a crime family and earn your place. Loyalty and street respect decide your rank;
 * jobs and heists run on planning and crew; territory pays but starts wars; tribute flows upward;
 * betrayal (informing, skimming, coups) is always on the table, and so is witness protection.
 */
import type { ActionResult, CrimeCharge, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone, hasFlag, isRoyal, setFlag } from "./state";
import { jobEligibility, makeJob, promoteJob } from "./career";
import { killPlayer } from "./mortality";
import { startTrial } from "./crime";
import { addHeat, adjustCatch, policingOf } from "./justice";
import { freshMob } from "./justiceState";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const inMob = (p: PlayerState) => p.currentJob?.lineId === "mafia";

/** Street respect needed to be promoted out of each rank (Associate to Underboss). */
export const RESPECT_FOR_RANK = [25, 45, 65, 85];
export const MAX_TERRITORY = 6;
export const MAX_CREW = 4;

export const tributeRate = (tier: number) => 0.1 + tier * 0.03;
export const territoryIncome = (tier: number, blocks: number) => Math.round(blocks * 15_000 * (1 + tier * 0.5));

export interface MobJobDef {
  id: string;
  name: string;
  emoji: string;
  minTier: number;
  reward: [number, number];
  /** Difficulty: lowers success odds. */
  hard: number;
  heat: number;
  respect: number;
  rivals: number;
  blurb: string;
  mature?: boolean;
  charge: CrimeCharge;
}

export const MOB_JOBS: MobJobDef[] = [
  { id: "collect", name: "Collect Debts", emoji: "💵", minTier: 0, reward: [4_000, 12_000], hard: 0, heat: 6, respect: 6, rivals: 0, blurb: "Knock on doors. Be persuasive.", charge: { name: "Extortion", description: "A debtor wore a wire and recorded your visit.", years: 4, severity: "serious" } },
  { id: "racket", name: "Run a Protection Racket", emoji: "🏪", minTier: 0, reward: [8_000, 25_000], hard: 0.06, heat: 10, respect: 8, rivals: 6, blurb: "Shopkeepers pay for peace. Rivals notice.", charge: { name: "Racketeering", description: "A shopkeeper finally talked to the police.", years: 5, severity: "serious" } },
  { id: "smuggle", name: "Move a Shipment", emoji: "📦", minTier: 1, reward: [15_000, 50_000], hard: 0.1, heat: 14, respect: 10, rivals: 4, blurb: "A container, a dock and a customs officer on the payroll.", charge: { name: "Smuggling", description: "Customs opened the wrong container.", years: 8, severity: "serious" } },
  { id: "heist", name: "Pull a Heist", emoji: "💎", minTier: 1, reward: [60_000, 250_000], hard: 0.22, heat: 22, respect: 18, rivals: 0, blurb: "Big score. Crew and planning matter most.", charge: { name: "Armed Robbery", description: "The vault job went wrong and the crew scattered.", years: 10, severity: "heinous", violent: true } },
  { id: "hit", name: "Take Out a Rival", emoji: "🎯", minTier: 1, reward: [20_000, 60_000], hard: 0.18, heat: 25, respect: 22, rivals: 10, blurb: "Orders come from above. Adults only; off-screen and non-graphic.", mature: true, charge: { name: "Murder", description: "Forensics tied you to the killing of a rival associate.", years: 28, severity: "heinous", capital: true, violent: true } },
];

export function jobChance(p: PlayerState, job: MobJobDef, plan: number, crew: number): number {
  const m = p.mob;
  return clamp(0.68 + p.smarts / 500 + m.respect / 400 - p.justice.heat / 300 + plan * 0.07 + crew * 0.05 - m.rivalHeat / 500 - job.hard, 0.2, 0.92);
}

export function joinChance(p: PlayerState): number {
  return clamp(0.3 + (50 - p.karma) / 150 + p.stats.crimesCommitted * 0.03 + (hasFlag(p, "ex_con") ? 0.15 : 0) + (p.justice.gangTies ? 0.1 : 0) + (p.dynasty?.clout.crime ?? 0) / 400, 0.1, 0.85); // a family name they know helps
}

export function joinMob(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const mob = CAREER_BY_ID.mafia;
  const elig = jobEligibility(p, mob);
  if (!elig.ok) return { player: p0, notices: [info("No Introduction", elig.reason ?? "They won't talk to you.", "bad")] };
  if (isRoyal(p)) return { player: p0 };
  if (p.mob.witsec) return { player: p0, notices: [info("Dead to Them", "You testified. No family on earth will touch you.", "bad")] };
  if ((p.annual["apply:mafia"] ?? 0) >= 1) return { player: p0, notices: [info("Lie Low", "You've already asked around this year. Don't look desperate.")] };
  if (p.business) return { player: p0, notices: [info("Too Busy", `You can't run ${p.business.name} and work for a family at the same time. Sell or close the business first.`)] };
  p.annual["apply:mafia"] = 1;
  if (!rng.chance(joinChance(p))) {
    changeStat(p, "happiness", -3);
    const body = "You asked around in all the wrong bars. Nobody would vouch for you.";
    addLog(p, body);
    return { player: p, notices: [info("Turned Away", body, "bad")] };
  }
  p.currentJob = makeJob(mob, 0, rng);
  p.annualSalary = p.currentJob.salary;
  p.mob = { ...freshMob(), loyalty: 40, respect: 5, rivalHeat: 10 };
  p.currentJob.performance = 5;
  setFlag(p, "made_man");
  changeStat(p, "karma", -6);
  const body = `${p.currentJob.company} took you in as an Associate. The pay is off the books and the favours are never free. Earn their trust and street respect to rise.`;
  addLog(p, body);
  return { player: p, notices: [info("Welcome to the Family", body, "good")] };
}

export function leaveRisk(p: PlayerState, buyout: boolean): number {
  const tier = p.currentJob?.tier ?? 0;
  const base = clamp(0.15 + tier * 0.1 - p.mob.loyalty / 250 + (p.mob.marked ? 0.25 : 0) + (p.mob.informant ? 0.2 : 0), 0.05, 0.8);
  return buyout ? base / 2 : base;
}

export const buyoutCost = (tier: number) => 50_000 * (1 + tier);

export function leaveMob(p0: PlayerState, rng: Rng, mode: "walk" | "buyout" = "walk"): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  const tier = p.currentJob!.tier;
  const buyout = mode === "buyout";
  if (buyout) {
    const cost = buyoutCost(tier);
    if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `Buying your way out costs ${money(cost)}.`, "bad")] };
    p.bankBalance -= cost;
  }
  const blessing = p.mob.loyalty >= 70 && !p.mob.informant && rng.chance(0.6);
  const risk = leaveRisk(p, buyout);
  p.currentJob = null;
  p.annualSalary = 0;
  const loyal = p.mob.loyalty;
  const stillMarked = p.mob.marked;
  p.mob = { ...freshMob(), witsec: p.mob.witsec };
  if (blessing) {
    const body = "The boss shook your hand and wished you well. A man who served loyally can walk away with respect.";
    addLog(p, body);
    return { player: p, notices: [info("Retired with Blessing", body, "good")] };
  }
  if (rng.chance(risk)) {
    if (tier >= 2 && rng.chance(0.15)) {
      killPlayer(p, "a gang hit");
      return { player: p, notices: [info("Whacked", "Nobody walks away from the top. They made sure of it.", "bad")] };
    }
    changeStat(p, "health", -rng.int(10, 25));
    p.mob.marked = rng.chance(0.4) || stillMarked;
    const body = "You walked away from the family. They sent a message. It hurt.";
    addLog(p, body);
    return { player: p, notices: [info("Parting Gift", body, "bad")] };
  }
  const body = loyal >= 40 ? "You left the family quietly. For now, they're letting you go." : "You slipped out. Someone made a note of the name.";
  addLog(p, body);
  return { player: p, notices: [info("Out", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Work
// ---------------------------------------------------------------------------

export function recruitCrew(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  if (p.mob.crew >= MAX_CREW) return { player: p0, notices: [info("Full Crew", "You can't manage more people than that.")] };
  if (p.mob.respect < 20) return { player: p0, notices: [info("Nobody Follows You", "You need 20+ street respect before anyone works for you.", "bad")] };
  if ((p.annual["mob:recruit"] ?? 0) >= 1) return { player: p0, notices: [info("Choosy", "You've already vetted someone this year.")] };
  if (p.bankBalance < 5_000) return { player: p0, notices: [info("Insufficient Funds", "A good crew member wants 5,000 dollars up front.", "bad")] };
  p.annual["mob:recruit"] = 1;
  p.bankBalance -= 5_000;
  p.mob.crew += 1;
  const body = `You brought a new man into your crew. They're loyal to you first, and they'll want a cut of every job (${p.mob.crew} in the crew).`;
  addLog(p, body);
  return { player: p, notices: [info("Crew Member", body, "good")] };
}

export function runMobJob(p0: PlayerState, jobId: string, rng: Rng, opts: { plan?: 0 | 1 | 2; crew?: number } = {}): ActionResult {
  const p = clone(p0);
  const job = MOB_JOBS.find((j) => j.id === jobId);
  if (!inMob(p) || !job || p.isInPrison || p.pendingTrial) return { player: p0 };
  const tier = p.currentJob!.tier;
  if (job.minTier > tier) return { player: p0, notices: [info("Not Yet", `${job.name} is for ${CAREER_BY_ID.mafia.ladder[job.minTier].title}s and above.`, "bad")] };
  if (job.mature && (!p.matureContent || p.age < 18)) return { player: p0, notices: [info("Mature Content Off", "Turn on mature content in Settings to access this job.")] };
  if ((p.annual.mobjob ?? 0) >= 2) return { player: p0, notices: [info("Too Much Heat", "The family only authorises two jobs a year.")] };
  const plan = (opts.plan ?? 0) as 0 | 1 | 2;
  const crew = clamp(Math.round(opts.crew ?? 0), 0, Math.min(2, p.mob.crew));
  const planCost = plan * 2_000 * (1 + tier);
  if (planCost > p.bankBalance) return { player: p0, notices: [info("Can't Afford the Prep", `Planning costs ${money(planCost)}.`, "bad")] };
  p.annual.mobjob = (p.annual.mobjob ?? 0) + 1;
  p.bankBalance -= planCost;
  const m = p.mob;
  addHeat(p, job.heat);
  if (crew > 0) p.justice.accomplices = Math.min(6, p.justice.accomplices + crew);
  if (rng.chance(jobChance(p, job, plan, crew))) {
    const raw = Math.round(rng.int(job.reward[0], job.reward[1]) * (1 + tier * 0.5));
    const crewCut = Math.round(raw * 0.15 * crew);
    const kickUp = Math.round(raw * tributeRate(tier));
    const net = raw - crewCut - kickUp;
    p.bankBalance += net;
    p.justice.proceeds += net;
    m.respect = clamp(m.respect + job.respect);
    m.loyalty = clamp(m.loyalty + 3);
    m.rivalHeat = clamp(m.rivalHeat + job.rivals);
    m.jobsDone += 1;
    changeStat(p, "karma", job.id === "hit" ? -25 : -3);
    if (job.id === "hit") {
      p.stats.kills += 1;
      setFlag(p, "killer");
      setFlag(p, "under_investigation");
      changeStat(p, "happiness", -6);
    }
    p.currentJob!.performance = m.respect;
    let body = `${job.name}: success. You cleared ${money(net)} after your crew's cut and the family's share (${money(kickUp)}). Respect +${job.respect}.`;
    const notices: Notices = [info("Job Done", body, "good")];
    // Rank.
    if (tier < 3 && m.respect >= RESPECT_FOR_RANK[tier] && m.loyalty >= 50 && promoteJob(p)) {
      m.respect = Math.max(10, m.respect - 15);
      p.currentJob!.performance = m.respect;
      const promo = `The boss called you in. You are now a ${p.currentJob!.title}. Your pay and your enemies both just went up.`;
      addLog(p, promo);
      notices.push(info("Promoted", promo, "jackpot"));
      body += ` ${promo}`;
    }
    addLog(p, body);
    return { player: p, notices };
  }
  // It went wrong.
  const roll = rng.next();
  const caughtChance = adjustCatch(p, 0.3);
  if (roll < caughtChance) {
    const evidence = clamp(45 + Math.round(p.justice.heat / 4) + crew * 8 - plan * 8 + rng.int(-5, 15), 10, 95);
    startTrial(p, { ...job.charge, evidence, years: job.charge.years + tier });
    m.loyalty = clamp(m.loyalty - 2);
    return { player: p, notices: [info("It Went Wrong", `${job.name} fell apart. The police were waiting.`, "bad")] };
  }
  m.respect = clamp(m.respect - 5);
  m.loyalty = clamp(m.loyalty - 8);
  m.rivalHeat = clamp(m.rivalHeat + 6);
  const dmg = rng.int(8, 28);
  changeStat(p, "health", -dmg);
  p.currentJob!.performance = m.respect;
  const body = `${job.name} went wrong. You got away with injuries (Health −${dmg}), but the family isn't happy.`;
  addLog(p, body);
  return { player: p, notices: [info("Botched Job", body, "bad")] };
}

export function expandTerritory(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  const tier = p.currentJob!.tier;
  if (tier < 1) return { player: p0, notices: [info("Earn It First", "Only Soldiers and above run territory.", "bad")] };
  if (p.mob.territory >= MAX_TERRITORY) return { player: p0, notices: [info("Spread Thin", "You can't hold any more ground.")] };
  if ((p.annual["mob:turf"] ?? 0) >= 1) return { player: p0, notices: [info("Wait", "You've already pushed into someone's turf this year.")] };
  const cost = 15_000 * (1 + tier);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `Muscle and bribes cost ${money(cost)}.`, "bad")] };
  p.annual["mob:turf"] = 1;
  p.bankBalance -= cost;
  const m = p.mob;
  addHeat(p, 8);
  if (rng.chance(clamp(0.55 + m.respect / 300 - m.rivalHeat / 300, 0.2, 0.85))) {
    m.territory += 1;
    m.respect = clamp(m.respect + 4);
    m.rivalHeat = clamp(m.rivalHeat + 12);
    const body = `You took another block. It pays ${money(territoryIncome(tier, 1))} a year, and every rival crew just took notice.`;
    addLog(p, body);
    return { player: p, notices: [info("New Territory", body, "good")] };
  }
  m.rivalHeat = clamp(m.rivalHeat + 8);
  m.loyalty = clamp(m.loyalty - 3);
  changeStat(p, "health", -rng.int(3, 12));
  const body = "You pushed into rival ground and got pushed back. You lost money and blood for nothing.";
  addLog(p, body);
  return { player: p, notices: [info("Pushed Back", body, "bad")] };
}

/** A formal sit-down with the rival crews to cool things off. */
export function sitDown(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  if ((p.annual["mob:sitdown"] ?? 0) >= 1) return { player: p0, notices: [info("Talked Out", "You've already held a sit-down this year.")] };
  const cost = 10_000 * (1 + (p.currentJob?.tier ?? 0));
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `A sit-down costs ${money(cost)} in gifts and dinner.`, "bad")] };
  p.annual["mob:sitdown"] = 1;
  p.bankBalance -= cost;
  if (rng.chance(0.7)) {
    p.mob.rivalHeat = clamp(p.mob.rivalHeat - 25);
    const body = "The bosses shared a meal and redrew the lines. Nobody's happy, nobody's shooting.";
    addLog(p, body);
    return { player: p, notices: [info("Peace, for Now", body, "good")] };
  }
  p.mob.rivalHeat = clamp(p.mob.rivalHeat + 10);
  const body = "The sit-down ended with an insult and a walk-out. Things are worse.";
  addLog(p, body);
  return { player: p, notices: [info("Sit-Down Failed", body, "bad")] };
}

export function payRespects(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  if ((p.annual["mob:respects"] ?? 0) >= 1) return { player: p0, notices: [info("Already Done", "You've already paid your respects this year.")] };
  const cost = 2_000 * (1 + p.currentJob!.tier);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `A proper gift costs ${money(cost)}.`, "bad")] };
  p.annual["mob:respects"] = 1;
  p.bankBalance -= cost;
  p.mob.loyalty = clamp(p.mob.loyalty + 8);
  const body = "You brought the boss a gift and sat through a long dinner. Loyalty +8.";
  addLog(p, body);
  return { player: p, notices: [info("Paying Respects", body, "good")] };
}

export function skimChance(p: PlayerState): number {
  return clamp(0.35 + (p.mob.loyalty < 40 ? 0.1 : 0) + p.justice.heat / 400 - p.smarts / 500, 0.15, 0.7);
}

export function skimTribute(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  if ((p.annual["mob:skim"] ?? 0) >= 1) return { player: p0, notices: [info("Greedy", "You already dipped into the till this year.")] };
  p.annual["mob:skim"] = 1;
  const tier = p.currentJob!.tier;
  const amount = Math.round(6_000 * (1 + tier) * rng.float(0.8, 1.3));
  changeStat(p, "karma", -3);
  if (rng.chance(skimChance(p))) {
    p.mob.loyalty = clamp(p.mob.loyalty - 40);
    if (p.mob.loyalty < 15) p.mob.marked = true;
    const body = `The count came up ${money(amount)} short and the boss knew exactly who was holding the envelope. Loyalty −40${p.mob.marked ? ", and the family has marked you" : ""}.`;
    addLog(p, body);
    return { player: p, notices: [info("Caught Skimming", body, "bad")] };
  }
  p.bankBalance += amount;
  p.justice.proceeds += amount;
  const body = `You shaved ${money(amount)} off the family's take. Nobody noticed. This year.`;
  addLog(p, body);
  return { player: p, notices: [info("Skimmed", body, "neutral")] };
}

export function coupChance(p: PlayerState): number {
  return clamp(0.15 + p.mob.crew * 0.06 + p.mob.respect / 400 + p.mob.territory * 0.02 - p.mob.loyalty / 500, 0.1, 0.6);
}

/** The Underboss moves against the Boss. High risk, no second chances. */
export function plotCoup(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inMob(p) || p.currentJob!.tier !== 3) return { player: p0, notices: [info("Not Your Place", "Only the Underboss can move against the Boss.", "bad")] };
  if (p.mob.respect < 70) return { player: p0, notices: [info("Not Ready", "You need 70+ street respect to carry the family with you.", "bad")] };
  if ((p.annual["mob:coup"] ?? 0) >= 1) return { player: p0, notices: [info("Too Soon", "You can't plot twice in a year.")] };
  p.annual["mob:coup"] = 1;
  changeStat(p, "karma", -10);
  if (rng.chance(coupChance(p))) {
    promoteJob(p);
    p.mob.loyalty = 70;
    p.mob.rivalHeat = clamp(p.mob.rivalHeat + 20);
    p.mob.respect = 60;
    p.currentJob!.performance = 60;
    changeStat(p, "fame", 5);
    const body = "The old boss had an accident. The capos came to kiss your ring. You run the family now.";
    addLog(p, body);
    return { player: p, notices: [info("The New Boss", body, "jackpot")] };
  }
  if (rng.chance(0.55)) {
    killPlayer(p, "a gang hit");
    return { player: p, notices: [info("The Plot Failed", "The boss's people were waiting. It was quick.", "bad")] };
  }
  p.currentJob = null;
  p.annualSalary = 0;
  p.mob.marked = true;
  changeStat(p, "health", -rng.int(20, 40));
  const body = "The plot was discovered. You were beaten, stripped of your rank and thrown out, with a price on your head.";
  addLog(p, body);
  return { player: p, notices: [info("Exposed", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Betrayal: informing and witness protection
// ---------------------------------------------------------------------------

/** Secretly cooperate with the authorities. Raids against the family slow; the family finds out eventually. */
export function becomeInformant(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  if (p.mob.informant) return { player: p0, notices: [info("Already Working for Them", "You're already wearing a wire.")] };
  p.mob.informant = true;
  p.mob.exposure = 10;
  addHeat(p, -20);
  p.bankBalance += 25_000;
  changeStat(p, "karma", 3);
  const body = "You agreed to feed information to federal agents in exchange for immunity and a monthly payment. Every day inside the family is now a risk.";
  addLog(p, body);
  return { player: p, notices: [info("Informant", body, "neutral")] };
}

export const WITSEC_STIPEND = 15_000;

/** Disappear: leave the life, relocate within the country, lose most contact with your old world. */
export function enterWitsec(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!p.mob.informant) return { player: p0, notices: [info("Not Eligible", "Only cooperating witnesses are offered protection.", "bad")] };
  if (p.mob.witsec && !inMob(p)) return { player: p0 };
  p.currentJob = null;
  p.annualSalary = 0;
  p.mob = { ...freshMob(), informant: true, witsec: true };
  const cities = ["Boise", "Duluth", "Tulsa", "Spokane", "Fargo", "Albany"];
  p.residence = { ...p.residence, city: rng.pick(cities) };
  for (const r of p.relatives) {
    if (!r.alive || r.relation === "Pet" || r.relation === "Partner") continue;
    r.relationshipBar = r.relation === "Friend" ? Math.min(r.relationshipBar, 10) : Math.max(0, r.relationshipBar - 50);
  }
  p.justice.heat = 0;
  p.justice.accomplices = 0;
  p.bankBalance += WITSEC_STIPEND;
  changeStat(p, "karma", 5);
  changeStat(p, "happiness", -5);
  setFlag(p, "witsec");
  const body = "The marshals gave you a new address, a new routine and strict rules: no calls home. You are out of the life, and the life is still looking for you.";
  addLog(p, body);
  return { player: p, notices: [info("Witness Protection", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Yearly
// ---------------------------------------------------------------------------

/** Yearly: tribute, turf, rivals, arrests, hits and moral decay. */
export function processMob(p: PlayerState, rng: Rng, notices: Notices) {
  const m = p.mob;
  // The family still remembers: marked ex-members and witnesses look over their shoulders.
  if (!inMob(p)) {
    if (m.marked && !p.isInPrison) {
      if (rng.chance(0.07)) {
        const dmg = rng.int(10, 30);
        changeStat(p, "health", -dmg);
        const body = `Someone from the old family found you. You survived, barely. Health −${dmg}.`;
        addLog(p, body);
        notices.push(info("Old Debts", body, "bad"));
        if (rng.chance(0.12)) killPlayer(p, "a gang hit");
      } else if (rng.chance(0.25)) m.marked = false;
    }
    if (m.witsec && !p.isInPrison) {
      p.bankBalance += Math.round(WITSEC_STIPEND * 0.7);
      if (rng.chance(0.015)) killPlayer(p, "a gang hit");
    }
    return;
  }
  const job = p.currentJob;
  if (!job || p.isInPrison) return;
  const tier = job.tier;
  m.yearsIn += 1;
  changeStat(p, "karma", -2);

  // Income from territory, and the tribute that goes up the chain.
  const turf = territoryIncome(tier, m.territory);
  if (turf > 0) {
    p.bankBalance += turf;
    p.justice.proceeds += Math.round(turf * 0.5);
  }
  const tribute = Math.round((job.salary + turf) * tributeRate(tier));
  let loyalty = m.loyalty;
  if (p.bankBalance >= tribute) {
    p.bankBalance -= tribute;
    loyalty += 1;
  } else {
    loyalty -= 15;
    const body = "You couldn't cover your tribute this year. The family noticed. Loyalty −15.";
    addLog(p, body);
    notices.push(info("Short on Tribute", body, "bad"));
  }
  if (p.justice.heat > 60) loyalty -= 4; // a liability
  if (m.territory > 0) loyalty += 1;
  if (m.informant) {
    p.bankBalance += 10_000;
    m.exposure = clamp(m.exposure + rng.int(5, 15) + tier * 2);
  }
  m.loyalty = clamp(Math.round(loyalty));

  // Rivals.
  m.rivalHeat = clamp(Math.round(m.rivalHeat + m.territory * 3 + 1 + rng.int(-4, 6)));
  if (m.loyalty >= 50) addHeat(p, -6); // the family has lawyers and friends on the force
  if (m.rivalHeat >= 60 && rng.chance(0.3 + (m.rivalHeat - 60) / 100)) {
    const dmg = rng.int(15, 35);
    changeStat(p, "health", -dmg);
    let body = `A rival crew ambushed you. You survived, barely. Health −${dmg}.`;
    if (m.territory > 0 && rng.chance(0.4)) {
      m.territory -= 1;
      body += " They took a block.";
    }
    addLog(p, body);
    notices.push(info("Gang War", body, "bad"));
    if (tier >= 1 && rng.chance(0.15 + (m.rivalHeat - 60) / 300)) {
      killPlayer(p, "a gang hit");
      return;
    }
  }

  // Street violence reaches everyone in the life, whatever their rank.
  if (rng.chance(0.03 + tier * 0.015)) {
    const dmg = rng.int(10, 25);
    changeStat(p, "health", -dmg);
    const body = `A job went bad on the street and you were shot at. You survived (Health −${dmg}).`;
    addLog(p, body);
    notices.push(info("Shots Fired", body, "bad"));
    if (rng.chance(0.08)) {
      killPlayer(p, "a gang hit");
      return;
    }
  }

  // Raids.
  if (!p.pendingTrial) {
    const raid = clamp((0.04 + tier * 0.02) * policingOf(p) * (1 + p.justice.heat / 100) * (m.informant ? 0.3 : 1), 0.02, 0.5);
    if (rng.chance(raid)) {
      p.currentJob = null;
      p.annualSalary = 0;
      m.respect = clamp(m.respect - 10);
      startTrial(p, {
        name: "Racketeering",
        description: "Federal investigators built a case against the organisation, and your name was on every page.",
        years: 4 + tier * 2,
        severity: tier >= 2 ? "heinous" : "serious",
      });
      notices.push(info("Raided!", "Agents kicked down the door. You're being charged with racketeering.", "bad"));
      return;
    }
  }

  // Informants get found out.
  if (m.informant && rng.chance(m.exposure / 300)) {
    m.marked = true;
    const body = "The family found the wire. They came for you the same night.";
    addLog(p, body);
    if (rng.chance(0.5 + tier * 0.1)) {
      killPlayer(p, "a gang hit");
      return;
    }
    changeStat(p, "health", -rng.int(25, 45));
    p.currentJob = null;
    p.annualSalary = 0;
    m.informant = false;
    notices.push(info("Your Cover Is Blown", body + " You survived, barely.", "bad"));
    return;
  }

  // Out of favour: the family decides.
  if ((m.marked || m.loyalty < 15) && rng.chance(0.35)) {
    m.marked = true;
    if (rng.chance(0.4 + tier * 0.08)) {
      killPlayer(p, "a gang hit");
      return;
    }
    p.currentJob = null;
    p.annualSalary = 0;
    changeStat(p, "health", -rng.int(15, 35));
    const body = "The boss decided you weren't family anymore. You were beaten and cut loose.";
    addLog(p, body);
    notices.push(info("Cut Loose", body, "bad"));
    return;
  }
  job.performance = m.respect;
}
