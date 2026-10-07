/** Politics: win elections to climb from city council to head of state. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone, hasFlag, isRoyal } from "./state";
import { makeJob } from "./career";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

const line = () => CAREER_BY_ID.politics;
export const CAMPAIGN_COST = [5_000, 25_000, 100_000, 400_000, 1_500_000];
export const MIN_AGE = [25, 28, 35, 40, 45];
export const TERM_YEARS = 4;

export const PARTIES = [
  { id: "progressive", name: "Progressive Alliance", emoji: "🌹", blurb: "Strong in steady times. +4% odds when the economy is normal." },
  { id: "conservative", name: "Conservative Union", emoji: "🏛️", blurb: "Trusted when the economy is stable or booming. +4% odds." },
  { id: "centrist", name: "Centrist Pact", emoji: "⚖️", blurb: "Moderate and dependable. +3% odds in any climate." },
  { id: "populist", name: "People's Front", emoji: "📢", blurb: "Thrives in recessions (+8%), struggles in booms (−3%)." },
  { id: "green", name: "Green Party", emoji: "🌿", blurb: "Rewards good character: +5% odds if your Karma is 60+." },
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

export function joinParty(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const party = PARTIES.find((x) => x.id === id);
  if (!party || p.politics.party === id) return { player: p0 };
  const switching = p.politics.party !== null;
  p.politics.party = id;
  if (switching) {
    p.politics.popularity = clamp(p.politics.popularity - 15);
    changeStat(p, "karma", -3);
  } else {
    p.politics.popularity = clamp(p.politics.popularity + 5);
  }
  const body = switching ? `You defected to the ${party.name}. Your old allies called you a turncoat.` : `You joined the ${party.name}.`;
  addLog(p, body);
  return { player: p, notices: [info("Party Politics", body, switching ? "bad" : "good")] };
}

export function currentTier(p: PlayerState): number {
  return p.currentJob?.lineId === "politics" ? p.currentJob.tier : -1;
}

export function nextTier(p: PlayerState): number {
  return currentTier(p) + 1;
}

export function electionChance(p: PlayerState, tier: number): number {
  return clamp(
    0.2 + p.politics.popularity / 130 + p.skills.charisma / 300 + p.fame / 400 + (p.karma - 50) / 300 + partyBonus(p) - (hasFlag(p, "ex_con") ? 0.3 : 0) - tier * 0.06,
    0.03,
    0.85,
  );
}

export function canRun(p: PlayerState): { ok: boolean; reason?: string } {
  const tier = nextTier(p);
  if (tier >= line().ladder.length) return { ok: false, reason: "You've reached the highest office." };
  if (isRoyal(p)) return { ok: false, reason: "Royals don't stand for election." };
  if (p.isInPrison || p.isFugitive) return { ok: false, reason: "Not while you're on the wrong side of the law." };
  if (p.age < MIN_AGE[tier]) return { ok: false, reason: `Candidates for ${line().ladder[tier].title} must be ${MIN_AGE[tier]}+.` };
  if (p.smarts < 45) return { ok: false, reason: "You need 45+ Smarts to run a credible campaign." };
  if (p.bankBalance < CAMPAIGN_COST[tier]) return { ok: false, reason: `You need ${money(CAMPAIGN_COST[tier])} for a campaign.` };
  return { ok: true };
}

export function giveSpeech(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0 };
  if ((p.annual.speech ?? 0) >= 1) return { player: p0, notices: [info("Voice Hoarse", "You've already given a major speech this year.")] };
  p.annual.speech = 1;
  const gain = rng.int(5, 12) + Math.floor(p.skills.charisma / 20);
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
  p.politics.popularity = clamp(p.politics.popularity + 8);
  changeStat(p, "karma", 4);
  const body = "A community charity drive earned you goodwill. Popularity +8, Karma +4.";
  addLog(p, body);
  return { player: p, notices: [info("Charity Drive", body, "good")] };
}

export function runForOffice(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const check = canRun(p);
  if (!check.ok) return { player: p0, notices: [info("Can't Run", check.reason ?? "Not eligible.", "bad")] };
  if ((p.annual.campaign ?? 0) >= 1) return { player: p0, notices: [info("Campaign Fatigue", "You've already stood for election this year.")] };
  const tier = nextTier(p);
  p.annual.campaign = 1;
  p.bankBalance -= CAMPAIGN_COST[tier];
  const title = line().ladder[tier].title;
  if (rng.chance(electionChance(p, tier))) {
    p.currentJob = makeJob(line(), tier, rng);
    p.annualSalary = p.currentJob.salary;
    p.politics.yearsInOffice = 0;
    p.politics.popularity = clamp(p.politics.popularity + 10);
    changeStat(p, "fame", 4 + tier * 3);
    changeStat(p, "happiness", 14);
    const body = `You WON the election and became ${title}! Salary: ${money(p.currentJob.salary)}.`;
    addLog(p, body);
    return { player: p, notices: [info("Elected!", body, "jackpot")] };
  }
  p.politics.popularity = clamp(p.politics.popularity - 10);
  changeStat(p, "happiness", -8);
  changeStat(p, "fame", -1);
  const body = `You lost the race for ${title}. The campaign cost you ${money(CAMPAIGN_COST[tier])}.`;
  addLog(p, body);
  return { player: p, notices: [info("Defeated", body, "bad")] };
}

/** Yearly: popularity drifts, incumbents face re-election every term. */
export function processPolitics(p: PlayerState, rng: Rng, notices: Notices) {
  p.politics.popularity = clamp(Math.round(p.politics.popularity - 4 + (p.karma - 50) / 20));
  const job = p.currentJob;
  if (!job || job.lineId !== "politics") return;
  p.politics.yearsInOffice += 1;
  if (job.tier >= 3) changeStat(p, "fame", 2);
  if (p.politics.yearsInOffice >= TERM_YEARS) {
    p.politics.yearsInOffice = 0;
    const chance = clamp(p.politics.popularity / 100 + 0.15 + (p.karma - 50) / 300 + partyBonus(p), 0.1, 0.92);
    if (rng.chance(chance)) {
      p.politics.popularity = clamp(p.politics.popularity + 6);
      const body = `Voters re-elected you as ${job.title}. Another term begins.`;
      addLog(p, body);
      notices.push(info("Re-elected", body, "good"));
    } else {
      const body = `Voters threw you out of office. Your time as ${job.title} is over.`;
      addLog(p, body);
      p.currentJob = null;
      p.annualSalary = 0;
      changeStat(p, "happiness", -12);
      changeStat(p, "fame", -3);
      notices.push(info("Voted Out", body, "bad"));
    }
  }
}
