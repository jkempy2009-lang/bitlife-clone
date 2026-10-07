/**
 * Politics: a ladder from city council to head of state with real machinery behind it.
 * Party standing and endorsements, campaign finance (donors with strings), policy stances that please
 * some voters and cost you others, debates, scandals, investigations, recall and impeachment,
 * term limits, and a retirement path (lobbying, ambassadorship, punditry, memoirs).
 */
import type { ActionResult, Donor, PlayerState, StatecraftState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone, hasFlag, isRoyal, setFlag } from "./state";
import { makeJob } from "./career";
import { blockerFor } from "./occupation";
import { ISSUE_IDS } from "./justiceState";
import { officeBlocker, recordLevel } from "./justice";
import { startTrial } from "./crime";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

const line = () => CAREER_BY_ID.politics;
export const CAMPAIGN_COST = [5_000, 25_000, 100_000, 400_000, 1_500_000];
export const MIN_AGE = [25, 28, 35, 40, 45];
export const TERM_YEARS = 4;
/** Consecutive terms allowed in each office (null = unlimited). */
export const TERM_LIMITS: (number | null)[] = [null, 3, 2, null, 2];
/** Years you must have held your current office before the voters will take you seriously for the next. */
export const MIN_TENURE = [0, 4, 4, 4, 8];
/** Fame voters expect of a candidate for each office; below it, name recognition costs you. */
export const FAME_NEEDED = [0, 8, 18, 32, 50];

export const ISSUES = [
  { id: "economy", name: "Economy", emoji: "💰", options: ["Tax the wealthy", "Balanced budget", "Cut taxes"] },
  { id: "health", name: "Healthcare", emoji: "🏥", options: ["Universal care", "Mixed system", "Market-based"] },
  { id: "environment", name: "Environment", emoji: "🌍", options: ["Green transition", "Gradual change", "Drill and grow"] },
  { id: "security", name: "Policing", emoji: "🚓", options: ["Reform policing", "Status quo", "Tough on crime"] },
  { id: "liberty", name: "Liberty", emoji: "🗽", options: ["Expand freedoms", "Balanced", "Order first"] },
] as const;

export const PARTIES = [
  { id: "progressive", name: "Progressive Alliance", emoji: "🌹", blurb: "Strong in steady times. +4% odds when the economy is normal. Platform: left on every issue.", platform: [-1, -1, -1, -1, -1] },
  { id: "conservative", name: "Conservative Union", emoji: "🏛️", blurb: "Trusted when the economy is stable or booming. +4% odds. Platform: right on every issue.", platform: [1, 1, 1, 1, 1] },
  { id: "centrist", name: "Centrist Pact", emoji: "⚖️", blurb: "Moderate and dependable. +3% odds in any climate. Platform: stay in the middle.", platform: [0, 0, 0, 0, 0] },
  { id: "populist", name: "People's Front", emoji: "📢", blurb: "Thrives in recessions (+8%), struggles in booms (−3%). Left on money, right on order.", platform: [-1, -1, 1, 1, 1] },
  { id: "green", name: "Green Party", emoji: "🌿", blurb: "Rewards good character: +5% odds if your Karma is 60+. Greens on the environment and liberty.", platform: [-1, 0, -1, 0, -1] },
] as const;

export function partyBonus(p: PlayerState): number {
  const c = p.economy.climate;
  switch (p.politics.party) {
    case "progressive": return c === "normal" ? 0.04 : c === "boom" ? 0.02 : 0;
    case "conservative": return c === "recession" ? 0 : 0.04;
    case "centrist": return 0.03;
    case "populist": return c === "recession" ? 0.08 : c === "boom" ? -0.03 : 0.01;
    case "green": return p.karma >= 60 ? 0.05 : 0;
    default: return 0;
  }
}

const platformOf = (p: PlayerState): readonly number[] | null => PARTIES.find((x) => x.id === p.politics.party)?.platform ?? null;

/** -1..1: how closely your stated positions follow the party platform. */
export function platformFit(p: PlayerState): number {
  const plat = platformOf(p);
  if (!plat) return 0;
  let sum = 0;
  let n = 0;
  ISSUE_IDS.forEach((id, i) => {
    const s = p.statecraft.stances[id] ?? 0;
    if (s === 0 && plat[i] === 0) return;
    n += 1;
    sum += s === plat[i] ? 1 : s === 0 || plat[i] === 0 ? 0 : -1;
  });
  return n === 0 ? 0 : sum / n;
}

/** How well your positions match what voters currently want, plus the energy of a committed base. */
export function stanceFit(p: PlayerState): number {
  const sc = p.statecraft;
  let sum = 0;
  let committed = 0;
  for (const id of ISSUE_IDS) {
    const s = sc.stances[id] ?? 0;
    sum += s * (sc.mood[id] ?? 0);
    if (s !== 0) committed += 1;
  }
  return clamp(sum * 0.02, -0.08, 0.08) + committed * 0.006;
}

export function currentTier(p: PlayerState): number {
  return p.currentJob?.lineId === "politics" ? p.currentJob.tier : -1;
}

export function nextTier(p: PlayerState): number {
  return currentTier(p) + 1;
}

export const officeYears = (p: PlayerState) => p.statecraft.termsInOffice * TERM_YEARS + p.politics.yearsInOffice;

export interface Factor {
  label: string;
  value: number;
}

export interface Odds {
  chance: number;
  factors: Factor[];
}

const costFor = (tier: number) => CAMPAIGN_COST[clamp(tier, 0, CAMPAIGN_COST.length - 1)];

/**
 * The odds of winning, with every factor listed. `mode` is "reelect" for incumbents seeking another term,
 * otherwise a first run or a step up the ladder.
 */
export function electionOdds(p: PlayerState, tier: number, mode: "run" | "reelect" = "run"): Odds {
  const sc = p.statecraft;
  const recession = p.economy.climate === "recession";
  const boom = p.economy.climate === "boom";
  const annual = p.annual;
  const rec = recordLevel(p);
  const factors: Factor[] = [
    { label: "Base appeal", value: 0.12 },
    { label: "Popularity", value: p.politics.popularity / 150 },
    { label: "Charisma", value: p.skills.charisma / 320 },
    { label: "Public speaking", value: (p.talents.speaking - 50) / 500 },
    { label: "Fame", value: p.fame / 450 },
    { label: "Character", value: (p.karma - 50) / 350 },
    { label: "Party brand", value: partyBonus(p) },
    { label: "Party machine", value: sc.machine / 1500 },
    { label: "Party endorsement", value: sc.endorsed ? 0.07 : 0 },
    { label: "Positions vs public mood", value: stanceFit(p) },
    { label: "War chest", value: clamp((sc.funds - costFor(tier)) / costFor(tier), 0, 1.5) * 0.04 },
    { label: "Ad blitz", value: (annual["pol:ads"] ?? 0) / 100 },
    { label: "Opposition research", value: (annual["pol:oppo"] ?? 0) / 100 },
    { label: "Economy", value: mode === "reelect" ? (recession ? -0.06 : boom ? 0.03 : 0) : 0 },
    { label: "Incumbency", value: mode === "reelect" ? 0.07 : currentTier(p) >= 0 ? 0.03 : 0 },
    { label: "Scandal", value: sc.scandal ? -sc.scandal.severity * 0.08 : 0 },
    { label: "Criminal record", value: rec === "misdemeanor" ? -0.06 : rec === "clean" ? 0 : -0.3 },
    { label: "Name recognition", value: -Math.max(0, FAME_NEEDED[Math.min(4, tier)] - p.fame) / 250 },
    { label: "Office difficulty", value: -(0.07 * tier + 0.03 * tier * tier) * (mode === "reelect" ? 0.3 : 1) },
  ].filter((f) => Math.abs(f.value) >= 0.0005 || f.label === "Base appeal");
  const total = factors.reduce((s, f) => s + f.value, 0);
  return { chance: clamp(total, 0.03, 0.85), factors };
}

export function electionChance(p: PlayerState, tier: number): number {
  return electionOdds(p, tier, "run").chance;
}

export function canRun(p: PlayerState): { ok: boolean; reason?: string } {
  const tier = nextTier(p);
  if (tier >= line().ladder.length) return { ok: false, reason: "You've reached the highest office." };
  if (isRoyal(p)) return { ok: false, reason: "Royals don't stand for election." };
  if (p.isInPrison || p.isFugitive || p.pendingTrial) return { ok: false, reason: "Not while you're on the wrong side of the law." };
  const record = officeBlocker(p);
  if (record) return { ok: false, reason: record };
  if (p.age < MIN_AGE[tier]) return { ok: false, reason: `Candidates for ${line().ladder[tier].title} must be ${MIN_AGE[tier]}+.` };
  const blocked = blockerFor(p, "office");
  if (blocked) return { ok: false, reason: blocked };
  if (p.smarts < 45) return { ok: false, reason: "You need 45+ Smarts to run a credible campaign." };
  if (tier > 0 && officeYears(p) < MIN_TENURE[tier]) {
    return { ok: false, reason: `Voters want ${MIN_TENURE[tier]} years' experience as ${CAREER_BY_ID.politics.ladder[tier - 1].title} first (${officeYears(p)} so far).` };
  }
  if (p.statecraft.investigation) return { ok: false, reason: "You can't campaign under investigation." };
  const cost = CAMPAIGN_COST[tier];
  if (p.bankBalance + p.statecraft.funds < cost) return { ok: false, reason: `You need ${money(cost)} for a campaign (war chest ${money(p.statecraft.funds)} + savings).` };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Party machine
// ---------------------------------------------------------------------------

export function joinParty(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const party = PARTIES.find((x) => x.id === id);
  if (!party || p.politics.party === id) return { player: p0 };
  const switching = p.politics.party !== null;
  p.politics.party = id;
  p.statecraft.endorsed = false;
  if (switching) {
    p.politics.popularity = clamp(p.politics.popularity - 15);
    p.statecraft.machine = 15;
    changeStat(p, "karma", -3);
  } else {
    p.politics.popularity = clamp(p.politics.popularity + 5);
    p.statecraft.machine = Math.max(p.statecraft.machine, 20);
  }
  // Adopt the platform unless you've already staked out positions.
  if (ISSUE_IDS.every((i) => (p.statecraft.stances[i] ?? 0) === 0)) {
    ISSUE_IDS.forEach((i, n) => (p.statecraft.stances[i] = party.platform[n]));
  }
  const body = switching ? `You defected to the ${party.name}. Your old allies called you a turncoat and the new ones don't trust you yet.` : `You joined the ${party.name}.`;
  addLog(p, body);
  return { player: p, notices: [info("Party Politics", body, switching ? "bad" : "good")] };
}

/** Do the unglamorous work: stuff envelopes, knock on doors, show up for the whip. */
export function partyWork(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.politics.party) return { player: p0, notices: [info("No Party", "Join a party first.", "bad")] };
  if ((p.annual["pol:work"] ?? 0) >= 1) return { player: p0, notices: [info("Enough For Now", "You've already put in your party hours this year.")] };
  p.annual["pol:work"] = 1;
  p.statecraft.machine = clamp(p.statecraft.machine + 8);
  p.politics.popularity = clamp(p.politics.popularity + 1);
  changeStat(p, "happiness", -1);
  const body = "You spent the year doing the party's dirty work. The machine noticed. Party standing +8.";
  addLog(p, body);
  return { player: p, notices: [info("Party Work", body, "good")] };
}

export function endorsementChance(p: PlayerState): number {
  return clamp(0.15 + p.statecraft.machine / 150 + p.politics.popularity / 400 + platformFit(p) * 0.1 - (p.statecraft.scandal ? 0.2 : 0), 0.05, 0.85);
}

export function seekEndorsement(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!p.politics.party) return { player: p0, notices: [info("No Party", "Join a party first.", "bad")] };
  if (p.statecraft.endorsed) return { player: p0, notices: [info("Already Endorsed", "The party is already behind you this cycle.")] };
  if ((p.annual["pol:endorse"] ?? 0) >= 1) return { player: p0, notices: [info("Asked Already", "The party leadership has given you their answer for the year.")] };
  p.annual["pol:endorse"] = 1;
  const party = PARTIES.find((x) => x.id === p.politics.party)!;
  if (rng.chance(endorsementChance(p))) {
    p.statecraft.endorsed = true;
    p.statecraft.funds += Math.round(costFor(nextTier(p)) * 0.1);
    const body = `The ${party.name} leadership endorsed you. Their donors, volunteers and press contacts are now yours.`;
    addLog(p, body);
    return { player: p, notices: [info("Endorsed!", body, "good")] };
  }
  p.statecraft.machine = clamp(p.statecraft.machine - 3);
  const body = `The ${party.name} leadership said they were "staying neutral for now". That is never good news.`;
  addLog(p, body);
  return { player: p, notices: [info("No Endorsement", body, "bad")] };
}

export function setStance(p0: PlayerState, issueId: string, value: number): ActionResult {
  const p = clone(p0);
  const issue = ISSUES.find((i) => i.id === issueId);
  if (!issue || ![-1, 0, 1].includes(value)) return { player: p0 };
  const sc = p.statecraft;
  const old = sc.stances[issueId] ?? 0;
  if (old === value) return { player: p0 };
  sc.stances[issueId] = value;
  const idx = ISSUE_IDS.indexOf(issueId as (typeof ISSUE_IDS)[number]);
  const plat = platformOf(p)?.[idx];
  let body = `You now stand for "${issue.options[value + 1]}" on ${issue.name.toLowerCase()}.`;
  if (old !== 0 && value !== 0 && old !== value) {
    p.politics.popularity = clamp(p.politics.popularity - 4);
    body += " The press calls it a flip-flop. Popularity −4.";
  }
  if (plat !== undefined && value !== 0) {
    if (value === plat) sc.machine = clamp(sc.machine + 2);
    else if (plat !== 0) {
      sc.machine = clamp(sc.machine - 3);
      body += " Party loyalists are not pleased. Party standing −3.";
    }
  }
  addLog(p, body);
  return { player: p, notices: [info("Policy Position", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Campaign finance
// ---------------------------------------------------------------------------

export const DONOR_KINDS = [
  { id: "grassroots", name: "Grassroots Appeal", emoji: "🧢", share: 0.1, blurb: "Small donors, no strings. Slow but clean.", issue: null, stance: 0 },
  { id: "union", name: "Union Backing", emoji: "🛠️", share: 0.22, blurb: "Solid money. They'll expect you to push for working people.", issue: "economy", stance: -1 },
  { id: "business", name: "Business PAC", emoji: "🏢", share: 0.3, blurb: "Deep pockets. They'll expect lower taxes.", issue: "economy", stance: 1 },
  { id: "pac", name: "Law & Order PAC", emoji: "🛡️", share: 0.25, blurb: "Generous, and watching your stance on policing.", issue: "security", stance: 1 },
  { id: "billionaire", name: "Billionaire Backer", emoji: "🎩", share: 0.7, blurb: "Writes huge cheques. Wants deregulation, and the attention is a liability.", issue: "environment", stance: 1 },
] as const;

export function fundraisingChance(p: PlayerState, kind: string): number {
  const base = clamp(0.35 + p.politics.popularity / 200 + p.statecraft.machine / 300 + p.skills.charisma / 400, 0.2, 0.9);
  return kind === "billionaire" ? base * (p.politics.popularity >= 35 || currentTier(p) >= 1 ? 0.8 : 0.3) : base;
}

export function raiseFunds(p0: PlayerState, rng: Rng, kind: string): ActionResult {
  const p = clone(p0);
  const dk = DONOR_KINDS.find((d) => d.id === kind);
  if (!dk) return { player: p0 };
  if (p.age < 18) return { player: p0 };
  if ((p.annual[`fund:${kind}`] ?? 0) >= 1) return { player: p0, notices: [info("Donor Fatigue", `You've already worked the ${dk.name.toLowerCase()} this year.`)] };
  p.annual[`fund:${kind}`] = 1;
  if (!rng.chance(fundraisingChance(p, kind))) {
    changeStat(p, "happiness", -2);
    const body = `${dk.name} came to nothing. A year of phone calls and no cheque.`;
    addLog(p, body);
    return { player: p, notices: [info("Fundraising Flop", body, "bad")] };
  }
  const amount = Math.round(costFor(Math.max(0, nextTier(p))) * dk.share * rng.float(0.6, 1.4));
  p.statecraft.funds += amount;
  const donor: Donor = { id: rng.id(), name: dk.name, kind: dk.id, given: amount, issue: dk.issue, stance: dk.stance, year: p.year };
  if (dk.id === "grassroots") p.politics.popularity = clamp(p.politics.popularity + 2);
  else p.statecraft.donors.push(donor);
  const strings = dk.issue ? ` They expect you to hold "${ISSUES.find((i) => i.id === dk.issue)!.options[dk.stance + 1]}" on ${dk.issue}.` : "";
  const body = `${dk.name} raised ${money(amount)} for your war chest.${strings}`;
  addLog(p, body);
  return { player: p, notices: [info("Campaign Funds", body, "good")] };
}

/** Move personal savings into the campaign fund. */
export function selfFund(p0: PlayerState, amount: number): ActionResult {
  const p = clone(p0);
  const amt = Math.min(Math.round(amount), Math.floor(p.bankBalance));
  if (amt <= 0) return { player: p0, notices: [info("No Money", "You have nothing to put in.", "bad")] };
  p.bankBalance -= amt;
  p.statecraft.funds += amt;
  const body = `You put ${money(amt)} of your own money into the campaign. Nobody can say you're bought, but you're out of pocket.`;
  addLog(p, body);
  return { player: p, notices: [info("Self-Funding", body, "neutral")] };
}

export function buyAds(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const tier = clamp(nextTier(p), 0, 4);
  const cost = Math.round(CAMPAIGN_COST[tier] * 0.1);
  if ((p.annual["pol:ads"] ?? 0) > 0) return { player: p0, notices: [info("Saturated", "The airwaves are already full of you.")] };
  if (p.statecraft.funds + p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `An ad blitz costs ${money(cost)}.`, "bad")] };
  const fromFunds = Math.min(p.statecraft.funds, cost);
  p.statecraft.funds -= fromFunds;
  p.bankBalance -= cost - fromFunds;
  p.annual["pol:ads"] = 4;
  const body = `You bought a month of television and online ads for ${money(cost)}. Your name is everywhere. Odds +4% this year.`;
  addLog(p, body);
  return { player: p, notices: [info("Ad Blitz", body, "good")] };
}

export function researchOpponent(p0: PlayerState, rng: Rng, dirty: boolean): ActionResult {
  const p = clone(p0);
  const tier = clamp(nextTier(p), 0, 4);
  const cost = Math.max(1_000, Math.round(CAMPAIGN_COST[tier] * (dirty ? 0.05 : 0.03)));
  if ((p.annual["pol:oppo"] ?? 0) > 0 || (p.annual["pol:oppo_done"] ?? 0) > 0) return { player: p0, notices: [info("Already Digging", "Your researchers already have a file on your opponent.")] };
  if (p.statecraft.funds + p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `Opposition research costs ${money(cost)}.`, "bad")] };
  const fromFunds = Math.min(p.statecraft.funds, cost);
  p.statecraft.funds -= fromFunds;
  p.bankBalance -= cost - fromFunds;
  p.annual["pol:oppo_done"] = 1;
  if (dirty) {
    changeStat(p, "karma", -4);
    if (rng.chance(0.25)) {
      p.statecraft.scandal = { kind: "dirty_tricks", title: "Dirty tricks exposed", severity: 2, year: p.year };
      const body = "Your researchers hacked a rival's emails, and a journalist found out. You are the story now.";
      addLog(p, body);
      return { player: p, notices: [info("Dirty Tricks Exposed", body, "bad")] };
    }
    p.annual["pol:oppo"] = 7;
    const body = `A private investigator dug up everything on your opponent for ${money(cost)}. Odds +7% this year. Nobody knows how you got it.`;
    addLog(p, body);
    return { player: p, notices: [info("Dirt Found", body, "good")] };
  }
  p.annual["pol:oppo"] = 3;
  const body = `Your researchers assembled a clean, factual file on your opponent's record for ${money(cost)}. Odds +3% this year.`;
  addLog(p, body);
  return { player: p, notices: [info("Opposition Research", body, "good")] };
}

export function debateCoaching(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const tier = clamp(nextTier(p), 0, 4);
  const cost = 2_000 * (tier + 1);
  if ((p.annual["pol:coach"] ?? 0) > 0) return { player: p0, notices: [info("Coached Already", "Your coach has nothing left to teach you this year.")] };
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `Debate coaching costs ${money(cost)}.`, "bad")] };
  p.bankBalance -= cost;
  p.annual["pol:coach"] = 1;
  p.skills.charisma = clamp(p.skills.charisma + 2);
  const body = "A coach drilled you on zingers, deflections and posture. Charisma +2, and you'll hold your own on the debate stage.";
  addLog(p, body);
  return { player: p, notices: [info("Debate Coaching", body, "good")] };
}

// ---------------------------------------------------------------------------
// Everyday actions
// ---------------------------------------------------------------------------

export function giveSpeech(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0 };
  if ((p.annual.speech ?? 0) >= 1) return { player: p0, notices: [info("Voice Hoarse", "You've already given a major speech this year.")] };
  p.annual.speech = 1;
  const gain = Math.max(2, Math.round((rng.int(5, 12) + Math.floor(p.skills.charisma / 20) + Math.round((p.talents.speaking - 50) / 10)) * (1 - p.politics.popularity / 130)));
  p.politics.popularity = clamp(p.politics.popularity + gain);
  p.skills.charisma = clamp(p.skills.charisma + 1);
  changeStat(p, "fame", 1);
  const body = `Your speech stirred the crowd. Popularity +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [info("Rousing Speech", body, "good")] };
}

export function charityDrive(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.bankBalance < 5_000) return { player: p0, notices: [info("Insufficient Funds", "A charity drive costs $5,000.", "bad")] };
  if ((p.annual.drive ?? 0) >= 1) return { player: p0, notices: [info("Donor Fatigue", "You've already run a drive this year.")] };
  p.annual.drive = 1;
  p.bankBalance -= 5_000;
  p.politics.popularity = clamp(p.politics.popularity + Math.max(2, Math.round(8 * (1 - p.politics.popularity / 140))));
  changeStat(p, "karma", 4);
  const body = "A community charity drive earned you goodwill. Popularity +8, Karma +4.";
  addLog(p, body);
  return { player: p, notices: [info("Charity Drive", body, "good")] };
}

/** Town halls: pressing the flesh. Good for local standing, risky for gaffes. */
export function townHall(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0 };
  if ((p.annual["pol:town"] ?? 0) >= 1) return { player: p0, notices: [info("Listened Enough", "You've done your town halls this year.")] };
  p.annual["pol:town"] = 1;
  if (rng.chance(clamp(0.7 + (p.skills.charisma - 40) / 300, 0.45, 0.9))) {
    p.politics.popularity = clamp(p.politics.popularity + Math.max(1, Math.round(rng.int(3, 7) * (1 - p.politics.popularity / 130))));
    const body = "You took hard questions for two hours and answered every one. Voters like people who show up.";
    addLog(p, body);
    return { player: p, notices: [info("Town Hall", body, "good")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - rng.int(3, 8));
  const body = "A question caught you off guard and the clip is everywhere. Popularity falls.";
  addLog(p, body);
  return { player: p, notices: [info("Town Hall Gaffe", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

function debate(p: PlayerState, rng: Rng): { delta: number; text: string } {
  const score = (p.smarts + p.skills.charisma) / 200 + (p.annual["pol:coach"] ? 0.15 : 0) + rng.float(-0.25, 0.25);
  if (score > 0.6) return { delta: 0.04, text: "You won the debate." };
  if (score < 0.3) return { delta: -0.05, text: "You had a disastrous debate." };
  return { delta: 0, text: "The debate was a draw." };
}

export function runForOffice(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const check = canRun(p);
  if (!check.ok) return { player: p0, notices: [info("Can't Run", check.reason ?? "Not eligible.", "bad")] };
  if ((p.annual.campaign ?? 0) >= 1) return { player: p0, notices: [info("Campaign Fatigue", "You've already stood for election this year.")] };
  const tier = nextTier(p);
  const sc = p.statecraft;
  p.annual.campaign = 1;
  const cost = CAMPAIGN_COST[tier];
  const odds = electionOdds(p, tier, "run");
  const fromFunds = Math.min(sc.funds, cost);
  sc.funds -= fromFunds;
  p.bankBalance -= cost - fromFunds;
  const title = line().ladder[tier].title;
  const d = tier >= 1 ? debate(p, rng) : { delta: 0, text: "" };
  const incumbentOpponent = rng.chance(0.5) ? 0.03 : 0;
  const chance = clamp(odds.chance + d.delta + rng.float(-0.04, 0.04) - incumbentOpponent, 0.02, 0.9);
  const debateNote = d.text ? ` ${d.text}` : "";
  sc.endorsed = false;
  if (rng.chance(chance)) {
    if (p.currentJob && p.currentJob.lineId !== "politics") addLog(p, `You resigned from your job as a ${p.currentJob.title} to serve.`);
    p.currentJob = makeJob(line(), tier, rng);
    p.annualSalary = p.currentJob.salary;
    p.politics.yearsInOffice = 0;
    p.politics.popularity = clamp(p.politics.popularity + 10);
    sc.termsInOffice = 0;
    sc.coalition = 30;
    sc.lowYears = 0;
    sc.highestTier = Math.max(sc.highestTier, tier);
    sc.electionsWon += 1;
    sc.retired = null;
    sc.retiredYear = null;
    changeStat(p, "fame", 4 + tier * 3);
    changeStat(p, "happiness", 14);
    const body = `You WON the election and became ${title}!${debateNote} Salary: ${money(p.currentJob.salary)}.`;
    addLog(p, body);
    return { player: p, notices: [info("Elected!", body, "jackpot")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - 10);
  sc.electionsLost += 1;
  changeStat(p, "happiness", -8);
  changeStat(p, "fame", -1);
  const body = `You lost the race for ${title}.${debateNote} The campaign cost you ${money(cost)}.`;
  addLog(p, body);
  return { player: p, notices: [info("Defeated", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Governing
// ---------------------------------------------------------------------------

export function inOffice(p: PlayerState): boolean {
  return p.currentJob?.lineId === "politics";
}

/** Chance a policy push passes this year. */
export function policyChance(p: PlayerState, issueId: string): number {
  const sc = p.statecraft;
  const tier = Math.max(0, currentTier(p));
  const stance = sc.stances[issueId] ?? 0;
  const idx = ISSUE_IDS.indexOf(issueId as (typeof ISSUE_IDS)[number]);
  const plat = platformOf(p)?.[idx];
  const effort = p.effort === "grind" ? 8 : p.effort === "coast" ? -10 : 0;
  const votes = sc.machine * 0.35 + sc.coalition * 0.35 + p.politics.popularity * 0.3 + effort;
  const need = 38 + tier * 6;
  return clamp((votes - need) / 60 + 0.5 + (plat !== undefined && stance === plat ? 0.05 : plat !== undefined && plat !== 0 && stance !== 0 ? -0.1 : 0), 0.1, 0.9);
}

export function pushPolicy(p0: PlayerState, rng: Rng, issueId: string): ActionResult {
  const p = clone(p0);
  if (!inOffice(p)) return { player: p0, notices: [info("Not in Office", "You need a seat to propose legislation.", "bad")] };
  const issue = ISSUES.find((i) => i.id === issueId);
  const sc = p.statecraft;
  const stance = sc.stances[issueId] ?? 0;
  if (!issue || stance === 0) return { player: p0, notices: [info("No Position", "Take a stance on that issue first.", "bad")] };
  if ((p.annual["pol:policy"] ?? 0) >= 1) return { player: p0, notices: [info("Floor Time Used", "The legislature has no more time for your agenda this year.")] };
  p.annual["pol:policy"] = 1;
  const title = issue.options[stance + 1];
  if (rng.chance(policyChance(p, issueId))) {
    sc.policyWins += 1;
    p.annual["pol:win"] = (p.annual["pol:win"] ?? 0) + 1;
    const popular = stance * (sc.mood[issueId] ?? 0) > 0;
    p.politics.popularity = clamp(p.politics.popularity + (popular ? 5 : 1));
    sc.machine = clamp(sc.machine + 2);
    changeStat(p, "fame", 1);
    const body = `Your "${title}" bill passed. ${popular ? "Voters like it." : "Voters shrugged: it isn't what they're asking for right now."}`;
    addLog(p, body);
    return { player: p, notices: [info("Bill Passed", body, "good")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - 3);
  sc.machine = clamp(sc.machine - 2);
  const body = `Your "${title}" bill died in committee. The opposition made sure of it.`;
  addLog(p, body);
  return { player: p, notices: [info("Bill Defeated", body, "bad")] };
}

export function buildCoalition(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inOffice(p)) return { player: p0 };
  if ((p.annual["pol:coalition"] ?? 0) >= 1) return { player: p0, notices: [info("Deals Done", "You've traded all the favours you can this year.")] };
  const cost = Math.max(2_000, Math.round(CAMPAIGN_COST[Math.max(0, currentTier(p))] * 0.05));
  if (p.statecraft.funds + p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `Greasing the wheels costs ${money(cost)}.`, "bad")] };
  const fromFunds = Math.min(p.statecraft.funds, cost);
  p.statecraft.funds -= fromFunds;
  p.bankBalance -= cost - fromFunds;
  p.annual["pol:coalition"] = 1;
  p.statecraft.coalition = clamp(p.statecraft.coalition + 25);
  const body = `You spent ${money(cost)} on dinners, committee seats and district projects. Your coalition grew to ${p.statecraft.coalition}%.`;
  addLog(p, body);
  return { player: p, notices: [info("Coalition Building", body, "good")] };
}

export function kickbackAmount(p: PlayerState): number {
  return Math.round((p.currentJob?.salary ?? 60_000) * 1.2);
}

/** A developer slips you an envelope. The money is real; so is the paper trail. */
export function takeKickback(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inOffice(p)) return { player: p0 };
  if ((p.annual["pol:kickback"] ?? 0) >= 1) return { player: p0, notices: [info("Too Greedy", "One envelope a year is plenty.")] };
  p.annual["pol:kickback"] = 1;
  const amount = Math.round(kickbackAmount(p) * rng.float(0.7, 1.4));
  p.bankBalance += amount;
  p.statecraft.bribes += amount;
  p.justice.proceeds += amount;
  changeStat(p, "karma", -8);
  const body = `A developer's "consulting fee" of ${money(amount)} landed in your account in return for a zoning vote. Nobody will ever find out. Probably.`;
  addLog(p, body);
  return { player: p, notices: [info("Envelope", body, "bad")] };
}

export function handleScandal(p0: PlayerState, rng: Rng, how: "apologise" | "deny" | "spin" | "resign"): ActionResult {
  const p = clone(p0);
  const sc = p.statecraft;
  const s = sc.scandal;
  if (!s) return { player: p0 };
  if ((p.annual["pol:scandal"] ?? 0) >= 1) return { player: p0, notices: [info("Already Responded", "You've said all you can on this for the year.")] };
  p.annual["pol:scandal"] = 1;
  const truth = ["affair", "finance", "past", "dirty_tricks", "donor"].includes(s.kind);
  const tier = Math.max(0, currentTier(p));
  if (how === "resign") {
    if (inOffice(p)) {
      p.currentJob = null;
      p.annualSalary = 0;
    }
    sc.scandal = null;
    changeStat(p, "karma", 2);
    changeStat(p, "fame", -2);
    const body = `You resigned over "${s.title}". It cost you your career, but it will not follow you around forever.`;
    addLog(p, body);
    return { player: p, notices: [info("Resigned", body, "neutral")] };
  }
  if (how === "spin") {
    const cost = 5_000 * (tier + 1);
    if (p.statecraft.funds + p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `A crisis-PR firm costs ${money(cost)}.`, "bad")] };
    const fromFunds = Math.min(sc.funds, cost);
    sc.funds -= fromFunds;
    p.bankBalance -= cost - fromFunds;
  }
  const chance = how === "apologise" ? (truth ? 0.65 : 0.55) : how === "spin" ? 0.55 : truth ? 0.3 : 0.6;
  if (rng.chance(clamp(chance + p.skills.charisma / 500, 0.1, 0.9))) {
    sc.scandal = null;
    p.politics.popularity = clamp(p.politics.popularity + (how === "apologise" ? -2 : 0));
    if (how === "apologise") changeStat(p, "karma", 1);
    const body = how === "apologise" ? "You apologised with grace and the story faded." : how === "spin" ? "Your PR people changed the subject and the news cycle moved on." : "You hit back hard, the story collapsed, and your base rallied.";
    addLog(p, body);
    return { player: p, notices: [info("Scandal Contained", body, "good")] };
  }
  if (how === "deny") {
    s.severity = Math.min(3, s.severity + 1);
    changeStat(p, "karma", -3);
  }
  p.politics.popularity = clamp(p.politics.popularity - 4);
  const body = how === "deny" ? "The denial unravelled and the cover-up became a bigger story than the scandal." : "Your response didn't land. The story is still running.";
  addLog(p, body);
  return { player: p, notices: [info("Scandal Worsens", body, "bad")] };
}

export function fightInvestigation(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const inv = p.statecraft.investigation;
  if (!inv) return { player: p0 };
  const cost = 20_000 * (Math.max(0, currentTier(p)) + 1);
  if ((p.annual["pol:fight"] ?? 0) >= 1) return { player: p0, notices: [info("Already Briefed", "Your lawyers are already on it.")] };
  if (p.bankBalance + p.statecraft.funds < cost) return { player: p0, notices: [info("Insufficient Funds", `Specialist counsel costs ${money(cost)}.`, "bad")] };
  const fromFunds = Math.min(p.statecraft.funds, cost);
  p.statecraft.funds -= fromFunds;
  p.bankBalance -= cost - fromFunds;
  p.annual["pol:fight"] = 1;
  const cut = rng.int(10, 22);
  inv.evidence = Math.max(0, inv.evidence - cut);
  const body = `Your lawyers challenged subpoenas and discredited a witness. The case against you weakened.`;
  addLog(p, body);
  return { player: p, notices: [info("Fighting the Investigation", body, "good")] };
}

// ---------------------------------------------------------------------------
// Leaving politics
// ---------------------------------------------------------------------------

export function retireFromOffice(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!inOffice(p)) return { player: p0 };
  const title = p.currentJob!.title;
  p.currentJob = null;
  p.annualSalary = 0;
  p.statecraft.scandal = null;
  p.statecraft.termsInOffice = 0;
  p.politics.yearsInOffice = 0;
  changeStat(p, "happiness", 2);
  const body = `You stepped down as ${title} and left public life on your own terms.`;
  addLog(p, body);
  return { player: p, notices: [info("Stepping Down", body, "neutral")] };
}

export const LOBBY_INCOME = [0, 70_000, 140_000, 280_000, 500_000];
export const AMBASSADOR_PAY = 150_000;
export const PUNDIT_PAY = 60_000;

function retireBlocker(p: PlayerState): string | null {
  if (inOffice(p)) return "Leave office first.";
  if (p.statecraft.highestTier < 0) return "You've never held office.";
  if (p.currentJob || p.business) return "Quit your job or business first.";
  if (p.isInPrison) return "You're in prison.";
  return null;
}

export function lobbyBlocker(p: PlayerState): string | null {
  return retireBlocker(p) ?? (p.statecraft.highestTier < 1 ? "Lobbying firms want a mayor or above." : p.statecraft.retired === "lobbyist" ? "You're already a lobbyist." : null);
}

export function ambassadorBlocker(p: PlayerState): string | null {
  return retireBlocker(p) ?? (p.statecraft.highestTier < 2 ? "Only governors and above are considered." : !p.politics.party ? "You need a party patron." : p.statecraft.machine < 45 ? "Your party standing is too low (45+ needed)." : p.age >= 75 ? "You're too old for a posting." : p.statecraft.retired === "ambassador" ? "You already hold a post." : null);
}

export function punditBlocker(p: PlayerState): string | null {
  return retireBlocker(p) ?? (p.fame < 20 ? "Networks want a recognisable face (20+ Fame)." : p.statecraft.retired === "pundit" ? "You already have a column." : null);
}

export function takeRetirementPath(p0: PlayerState, rng: Rng, path: "lobbyist" | "ambassador" | "pundit"): ActionResult {
  const p = clone(p0);
  const why = path === "lobbyist" ? lobbyBlocker(p) : path === "ambassador" ? ambassadorBlocker(p) : punditBlocker(p);
  if (why) return { player: p0, notices: [info("Not Available", why, "bad")] };
  if (path === "ambassador" && !rng.chance(clamp(p.statecraft.machine / 100 + 0.1, 0.2, 0.9))) {
    p.statecraft.machine = clamp(p.statecraft.machine - 5);
    return { player: p, notices: [info("Passed Over", "The party gave the embassy to someone else.", "bad")] };
  }
  p.statecraft.retired = path;
  p.statecraft.retiredYear = p.year;
  const body =
    path === "lobbyist" ? "You joined a lobbying firm. Your Rolodex is worth more than your vote ever was."
    : path === "ambassador" ? "You were appointed ambassador. A residence, a driver and a lot of canapés."
    : "You signed with a news network as a political commentator.";
  addLog(p, body);
  return { player: p, notices: [info(path === "lobbyist" ? "K Street" : path === "ambassador" ? "Ambassador" : "Pundit", body, "good")] };
}

export function memoirBlocker(p: PlayerState): string | null {
  return retireBlocker(p) ?? (hasFlag(p, "pol_memoir") ? "You've already published." : p.statecraft.highestTier < 1 ? "Publishers want someone who held real office." : null);
}

export function politicalMemoir(p0: PlayerState, rng: Rng, tellAll: boolean): ActionResult {
  const p = clone(p0);
  const why = memoirBlocker(p);
  if (why) return { player: p0, notices: [info("Not Available", why, "bad")] };
  setFlag(p, "pol_memoir");
  const advance = Math.round(((p.statecraft.highestTier + 1) * 30_000 + p.fame * 2_000) * (tellAll ? 1.8 : 1) * rng.float(0.8, 1.3));
  p.bankBalance += advance;
  changeStat(p, "fame", tellAll ? 6 : 3);
  let body = `Your memoir sold well: a ${money(advance)} advance and a book tour.`;
  if (tellAll) {
    p.statecraft.machine = clamp(p.statecraft.machine - 25);
    changeStat(p, "karma", -3);
    body += " Your tell-all burned every bridge in the party. Former allies are not returning calls.";
  }
  addLog(p, body);
  return { player: p, notices: [info("Memoir Published", body, "good")] };
}

// ---------------------------------------------------------------------------
// Yearly
// ---------------------------------------------------------------------------

const MOOD_BIAS: Record<string, Record<string, number>> = {
  recession: { economy: -0.2, health: -0.08 },
  boom: { economy: 0.15, environment: -0.05 },
  normal: {},
};

function driftMood(p: PlayerState, rng: Rng) {
  const bias = MOOD_BIAS[p.economy.climate] ?? {};
  for (const id of ISSUE_IDS) {
    const m = p.statecraft.mood[id] ?? 0;
    p.statecraft.mood[id] = Math.round(clamp(m * 0.75 + rng.float(-0.4, 0.4) + (bias[id] ?? 0), -1, 1) * 100) / 100;
  }
}

function newScandal(p: PlayerState, rng: Rng): StatecraftState["scandal"] {
  const sc = p.statecraft;
  const tier = Math.max(0, currentTier(p));
  const pool: { kind: string; title: string; w: number }[] = [
    { kind: "gaffe", title: "Offensive remarks resurface", w: 3 },
    { kind: "expenses", title: "Expenses scandal", w: 2 },
  ];
  if (p.stats.affairs > 0) pool.push({ kind: "affair", title: "Affair exposed", w: 2 + p.stats.affairs });
  if (sc.bribes > 0) pool.push({ kind: "finance", title: "Questionable payments", w: 4 });
  if (recordLevel(p) !== "clean") pool.push({ kind: "past", title: "Criminal past dug up", w: 3 });
  if (sc.donors.some((d) => d.kind === "billionaire" || d.kind === "business")) pool.push({ kind: "donor", title: "Pay-to-play allegations", w: 2 });
  const pick = rng.weighted(pool, (x) => x.w)!;
  const severity = clamp(1 + (rng.chance(0.35 + tier * 0.08) ? 1 : 0) + (rng.chance(0.15 + p.fame / 400) ? 1 : 0), 1, 3);
  return { kind: pick.kind, title: pick.title, severity, year: p.year };
}

/** Yearly: approval drifts, the machine hums, scandals break, incumbents face the voters. */
export function processPolitics(p: PlayerState, rng: Rng, notices: Notices) {
  const sc = p.statecraft;
  driftMood(p, rng);
  sc.endorsed = false;
  sc.coalition = clamp(sc.coalition - 12);
  // Machine drift: loyalty to the platform keeps you in favour.
  sc.machine = clamp(Math.round(sc.machine - 1 + platformFit(p) * 2));

  // Donors with strings: they notice when you cross them.
  for (const d of [...sc.donors]) {
    if (!d.issue) continue;
    if ((sc.stances[d.issue] ?? 0) === d.stance) continue;
    sc.donors = sc.donors.filter((x) => x.id !== d.id);
    sc.funds = Math.max(0, sc.funds - Math.round(d.given * 0.4));
    p.politics.popularity = clamp(p.politics.popularity - 3);
    const body = `${d.name} withdrew its support after you abandoned its position on ${d.issue}. They pulled ${money(Math.round(d.given * 0.4))} and told the press why.`;
    addLog(p, body);
    notices.push(info("Donor Revolt", body, "bad"));
    if (rng.chance(0.3) && !sc.scandal) sc.scandal = { kind: "donor", title: "Pay-to-play allegations", severity: 1, year: p.year };
  }
  // Old donors forget you eventually.
  sc.donors = sc.donors.filter((d) => p.year - d.year < 8);

  const job = p.currentJob;
  const holding = !!job && job.lineId === "politics";

  if (!holding) {
    // Out of office: the public forgets, and the post-politics career pays or burns.
    p.politics.popularity = clamp(Math.round(p.politics.popularity - 4 + (p.karma - 50) / 20));
    sc.termsInOffice = 0;
    if (sc.retired && (p.currentJob || p.business)) {
      sc.retired = null;
      addLog(p, "You gave up your post-political career for something else.");
    }
    if (sc.retired === "lobbyist") {
      const income = Math.round(LOBBY_INCOME[Math.max(0, sc.highestTier)] * (0.5 + sc.machine / 100));
      p.bankBalance += Math.round(income * 0.7);
      changeStat(p, "karma", -1);
      if (rng.chance(0.05)) {
        sc.retired = null;
        changeStat(p, "fame", -3);
        const body = "A watchdog exposed your lobbying for a company you once regulated. The firm let you go.";
        addLog(p, body);
        notices.push(info("Revolving Door", body, "bad"));
      }
    } else if (sc.retired === "ambassador") {
      p.bankBalance += Math.round(AMBASSADOR_PAY * 0.75);
      changeStat(p, "fame", 1);
      if (p.age >= 75 || p.year - (sc.retiredYear ?? p.year) >= 8) {
        sc.retired = null;
        const body = "Your ambassadorial posting ended. You came home with a good tan and a lot of stories.";
        addLog(p, body);
        notices.push(info("Posting Ends", body, "neutral"));
      }
    } else if (sc.retired === "pundit") {
      p.bankBalance += Math.round(PUNDIT_PAY * 0.75);
      changeStat(p, "fame", 1);
    }
    // A past corruption investigation can still catch up.
    if (sc.investigation) resolveInvestigationYear(p, rng, notices, false);
    if (sc.scandal && p.year - sc.scandal.year >= 2) sc.scandal = null;
    return;
  }

  p.politics.yearsInOffice += 1;
  sc.highestTier = Math.max(sc.highestTier, job.tier);
  if (job.tier >= 3) changeStat(p, "fame", 2);
  const tier = job.tier;

  // Approval: the economy, the work you put in, what you delivered, scandal and fatigue.
  const climate = p.economy.climate === "boom" ? 3 : p.economy.climate === "recession" ? -5 : 0;
  const effort = p.effort === "grind" ? 3 : p.effort === "coast" ? -4 : 0;
  const wins = (p.annual["pol:win"] ?? 0) * 3;
  const drag = sc.scandal ? -sc.scandal.severity * 5 : 0;
  const delta = Math.round((45 - p.politics.popularity) * 0.2 + climate + effort + wins + (p.karma - 50) / 25 + drag - 2);
  p.politics.popularity = clamp(p.politics.popularity + delta);
  if (effort < 0 && rng.chance(0.4)) {
    const body = "The press noticed you are barely showing up to work. Absentee politicians don't last.";
    addLog(p, body);
    notices.push(info("Checked Out", body, "bad"));
  }

  // Scandal: breaking, or fading.
  if (sc.scandal) {
    if (p.year - sc.scandal.year >= 2) {
      sc.scandal = null;
      addLog(p, "The scandal finally dropped off the front pages.");
    }
  } else {
    const chance = 0.03 + tier * 0.012 + p.fame / 2000 + (sc.bribes > 0 ? 0.03 : 0) + Math.min(0.03, p.stats.affairs * 0.005) + (recordLevel(p) !== "clean" ? 0.03 : 0);
    if (rng.chance(chance)) {
      sc.scandal = newScandal(p, rng);
      const body = `SCANDAL: ${sc.scandal!.title}. Your phone has not stopped ringing. Choose how to respond in the Politics tab.`;
      addLog(p, body);
      notices.push(info(sc.scandal!.title, body, "bad"));
    }
  }

  // Corruption investigations.
  if (!sc.investigation && sc.bribes > 0) {
    const open = clamp(0.03 + sc.bribes / (job.salary * 25), 0.03, 0.3);
    if (rng.chance(open)) {
      sc.investigation = { kind: "corruption", yearsLeft: rng.int(1, 3), evidence: clamp(20 + rng.int(0, 25) + Math.round((sc.bribes / (job.salary * 10)) * 15), 10, 90) };
      const body = "Prosecutors opened a corruption investigation into your finances. Your lawyer says to say nothing.";
      addLog(p, body);
      notices.push(info("Under Investigation", body, "bad"));
    }
  }
  if (sc.investigation && p.currentJob) resolveInvestigationYear(p, rng, notices, true);
  if (!p.currentJob || p.currentJob.lineId !== "politics") return;

  // Recall and impeachment when approval collapses.
  sc.lowYears = p.politics.popularity < 20 ? sc.lowYears + 1 : Math.max(0, sc.lowYears - 1);
  if (sc.lowYears >= 2) {
    const removal = clamp(0.45 - sc.machine / 250 - p.politics.popularity / 200, 0.05, 0.5);
    sc.lowYears = 0;
    if (rng.chance(removal)) {
      const word = tier >= 3 ? "impeached" : "recalled";
      const body = `Your approval collapsed and you were ${word}. Your time as ${job.title} is over.`;
      removeFromOffice(p, 12, 4);
      sc.removed += 1;
      sc.machine = clamp(sc.machine - 15);
      addLog(p, body);
      notices.push(info(tier >= 3 ? "Impeached" : "Recalled", body, "bad"));
      return;
    }
    const body = "A recall petition circulated, but the party closed ranks and you survived the vote.";
    addLog(p, body);
    notices.push(info("Survived the Vote", body, "neutral"));
  }

  // Term end: term limits or re-election.
  if (p.politics.yearsInOffice >= TERM_YEARS) {
    p.politics.yearsInOffice = 0;
    const limit = TERM_LIMITS[tier];
    if (limit !== null && sc.termsInOffice + 1 >= limit) {
      const body = `Term limits bar you from running for ${job.title} again. You leave office after ${limit} terms.`;
      p.currentJob = null;
      p.annualSalary = 0;
      sc.termsInOffice = 0;
      changeStat(p, "happiness", -4);
      addLog(p, body);
      notices.push(info("Term-Limited", body, "neutral"));
      return;
    }
    const odds = electionOdds(p, tier, "reelect").chance;
    if (rng.chance(odds + rng.float(-0.03, 0.03))) {
      sc.termsInOffice += 1;
      sc.electionsWon += 1;
      p.politics.popularity = clamp(p.politics.popularity + 6);
      const body = `Voters re-elected you as ${job.title}. Another term begins.`;
      addLog(p, body);
      notices.push(info("Re-elected", body, "good"));
    } else {
      const body = `Voters threw you out of office. Your time as ${job.title} is over.`;
      addLog(p, body);
      sc.electionsLost += 1;
      removeFromOffice(p, 12, 3);
      notices.push(info("Voted Out", body, "bad"));
    }
  }
}

function removeFromOffice(p: PlayerState, happiness: number, fame: number) {
  p.currentJob = null;
  p.annualSalary = 0;
  p.statecraft.termsInOffice = 0;
  p.politics.yearsInOffice = 0;
  changeStat(p, "happiness", -happiness);
  changeStat(p, "fame", -fame);
}

function resolveInvestigationYear(p: PlayerState, rng: Rng, notices: Notices, inOfficeNow: boolean) {
  const sc = p.statecraft;
  const inv = sc.investigation;
  if (!inv) return;
  if (sc.bribes > 0) inv.evidence = clamp(inv.evidence + rng.int(1, 6));
  inv.yearsLeft -= 1;
  if (inv.yearsLeft > 0) return;
  sc.investigation = null;
  const tier = Math.max(0, sc.highestTier);
  if (inv.evidence >= 65) {
    sc.bribes = 0; // the proceeds booked when the money was taken are forfeited on conviction
    if (inOfficeNow) removeFromOffice(p, 0, 6);
    startTrial(p, {
      name: "Corruption in Office",
      description: "Prosecutors laid out the payments, the votes that followed, and your signature on both.",
      years: 3 + tier * 2,
      severity: tier >= 3 ? "heinous" : "serious",
      evidence: inv.evidence,
    });
    notices.push(info("Indicted", "The investigation ended in an indictment. You're being tried for corruption.", "bad"));
  } else if (inv.evidence >= 35) {
    p.politics.popularity = clamp(p.politics.popularity - 15);
    sc.machine = clamp(sc.machine - 20);
    const body = "The investigation ended without charges, but a formal censure was published. The stain stays.";
    addLog(p, body);
    notices.push(info("Censured", body, "bad"));
  } else {
    p.politics.popularity = clamp(p.politics.popularity + 6);
    sc.bribes = Math.round(sc.bribes * 0.5);
    const body = "Investigators found nothing they could prove. You called it a witch hunt and the voters agreed.";
    addLog(p, body);
    notices.push(info("Cleared", body, "good"));
  }
}
