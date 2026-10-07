/**
 * Extra life paths beyond the 9-to-5: entrepreneurship, professional sports, and online fame.
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clearFlag, clone, hasFlag, isRoyal, setFlag } from "./state";
import { jobEligibility, makeJob } from "./career";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Entrepreneurship
// ---------------------------------------------------------------------------

export interface BusinessType {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  /** Mean yearly profit as a fraction of business value. */
  mean: number;
  /** Profit swings uniformly within ± vol. */
  vol: number;
  minSmarts: number;
  blurb: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { id: "foodtruck", name: "Food Truck", emoji: "🚚", cost: 25_000, mean: 0.35, vol: 0.3, minSmarts: 15, blurb: "Cheap to start, brutal hours, loyal fans." },
  { id: "boutique", name: "Boutique Shop", emoji: "👗", cost: 60_000, mean: 0.2, vol: 0.2, minSmarts: 25, blurb: "A little store with a lot of taste." },
  { id: "farm", name: "Organic Farm", emoji: "🌾", cost: 120_000, mean: 0.1, vol: 0.15, minSmarts: 20, blurb: "Slow, steady, soil under your nails." },
  { id: "restaurant", name: "Restaurant", emoji: "🍽️", cost: 150_000, mean: 0.16, vol: 0.25, minSmarts: 30, blurb: "Most fail. Yours might not." },
  { id: "startup", name: "Tech Startup", emoji: "🚀", cost: 250_000, mean: 0.05, vol: 0.9, minSmarts: 55, blurb: "Burn cash, chase an exit, or flame out." },
  { id: "nightclub", name: "Nightclub", emoji: "🪩", cost: 400_000, mean: 0.22, vol: 0.35, minSmarts: 30, blurb: "Glamorous, loud, and legally complicated." },
];

export function startBusiness(p0: PlayerState, kindId: string, name: string): ActionResult {
  const p = clone(p0);
  const kind = BUSINESS_TYPES.find((b) => b.id === kindId);
  if (!kind) return { player: p0 };
  if (p.business) return { player: p0, notices: [info("One Empire at a Time", "Sell or close your current business first.")] };
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You must be 18 to incorporate a business.", "bad")] };
  if (isRoyal(p)) return { player: p0, notices: [info("Beneath You", "Royals can't run commercial ventures.", "bad")] };
  if (p.isInPrison) return { player: p0, notices: [info("Locked Up", "Hard to run a business from a cell.", "bad")] };
  if (p.smarts < kind.minSmarts) return { player: p0, notices: [info("Not Ready", `Running a ${kind.name.toLowerCase()} needs ${kind.minSmarts}+ Smarts.`, "bad")] };
  if (p.bankBalance < kind.cost) return { player: p0, notices: [info("Insufficient Funds", `You need ${money(kind.cost)} in cash to open a ${kind.name.toLowerCase()}.`, "bad")] };
  p.bankBalance -= kind.cost;
  const label = name.trim() || `${p.lastName} ${kind.name}`;
  p.business = { kind: kind.id, name: label, value: kind.cost, lastProfit: 0, boost: 0, founded: p.year };
  setFlag(p, "business_owner");
  changeStat(p, "happiness", 8);
  const body = `You opened "${label}" for ${money(kind.cost)}. Time to be your own boss.`;
  addLog(p, body);
  return { player: p, notices: [info("Business Launched", body, "good")] };
}

export function investInBusiness(p0: PlayerState, amount: number): ActionResult {
  const p = clone(p0);
  if (!p.business || amount <= 0 || amount > p.bankBalance) return { player: p0, notices: [info("Can't Invest", "You don't have that much cash.", "bad")] };
  p.bankBalance -= amount;
  p.business.value += amount;
  const body = `You invested ${money(amount)} into ${p.business.name}.`;
  addLog(p, body);
  return { player: p, notices: [info("Investment Made", body, "good")] };
}

export function workOnBusiness(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.business) return { player: p0 };
  if ((p.annual.bizwork ?? 0) >= 1) return { player: p0, notices: [info("Already Hustling", "You've already put in the extra hours this year.")] };
  p.annual.bizwork = 1;
  p.business.boost += 0.12;
  changeStat(p, "happiness", -2);
  changeStat(p, "health", -1);
  const body = `You worked 80-hour weeks on ${p.business.name}. Profits should climb this year.`;
  addLog(p, body);
  return { player: p, notices: [info("Hustle Mode", body, "good")] };
}

export function sellBusiness(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.business) return { player: p0 };
  const proceeds = Math.round(p.business.value * 0.9);
  p.bankBalance += proceeds;
  const body = `You sold ${p.business.name} for ${money(proceeds)}.`;
  p.business = null;
  clearFlag(p, "business_owner");
  addLog(p, body);
  return { player: p, notices: [info("Business Sold", body, "good")] };
}

/** Runs during Age Up. Returns the year's profit (negative = loss). */
export function processBusiness(p: PlayerState, rng: Rng, notices: NonNullable<ActionResult["notices"]>): number {
  const biz = p.business;
  if (!biz) return 0;
  const kind = BUSINESS_TYPES.find((b) => b.id === biz.kind)!;
  const skillBonus = (p.smarts - 50) / 1000;
  const raw = biz.value * (kind.mean + skillBonus + rng.float(-kind.vol, kind.vol)) * (1 + biz.boost);
  const profit = Math.round(raw);
  biz.boost = 0;
  biz.lastProfit = profit;
  biz.value = Math.max(0, Math.round(biz.value * (1 + clamp(profit / Math.max(1, biz.value), -0.5, 1) * 0.35)));

  if (kind.id === "startup" && biz.value >= kind.cost * 1.3 && rng.chance(0.06)) {
    const payout = Math.round(biz.value * rng.float(4, 12));
    p.bankBalance += payout;
    const body = `A tech giant acquired ${biz.name} for ${money(payout)}. You're an overnight success!`;
    addLog(p, body);
    notices.push(info("ACQUIRED!", body, "jackpot"));
    changeStat(p, "fame", 8);
    changeStat(p, "happiness", 20);
    p.business = null;
    clearFlag(p, "business_owner");
    return 0;
  }
  if (rng.chance(0.03 + (profit < 0 ? 0.07 : 0))) {
    const body = `${biz.name} went bankrupt. You lost almost everything you put in.`;
    addLog(p, body);
    notices.push(info("Bankrupt", body, "bad"));
    changeStat(p, "happiness", -15);
    p.creditScore -= 40;
    p.business = null;
    clearFlag(p, "business_owner");
    return 0;
  }
  return profit;
}

// ---------------------------------------------------------------------------
// Professional sports
// ---------------------------------------------------------------------------

export const SPORTS = ["Soccer", "Basketball", "Tennis", "Boxing", "Golf", "Swimming"] as const;

export function trainAthletics(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 8) return { player: p0, notices: [info("Too Young", "Come back when you're a little older.")] };
  if ((p.annual.train ?? 0) >= 1) return { player: p0, notices: [info("Rest Day", "You've already trained hard this year. Your body needs recovery.")] };
  p.annual.train = 1;
  const gain = rng.int(4, 8);
  p.skills.athletics = clamp(p.skills.athletics + gain);
  changeStat(p, "health", 1);
  changeStat(p, "looks", 1);
  const body = `You trained relentlessly. Athletics +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [info("Training Camp", body, "good")] };
}

export function signWithClub(p0: PlayerState, sport: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const line = CAREER_BY_ID.athlete;
  const elig = jobEligibility(p, line);
  if (!elig.ok) return { player: p0, notices: [info("Can't Sign", elig.reason ?? "You aren't eligible.", "bad")] };
  if ((p.annual["apply:athlete"] ?? 0) >= 1) return { player: p0, notices: [info("Already Tried Out", "Scouts only visit once a year.")] };
  p.annual["apply:athlete"] = 1;
  const chance = clamp((p.skills.athletics - 30) / 70 + (p.health - 60) / 400 - (hasFlag(p, "ex_con") ? 0.2 : 0), 0.05, 0.9);
  if (!rng.chance(chance)) {
    changeStat(p, "happiness", -5);
    const body = `Scouts watched you play ${sport.toLowerCase()} but didn't offer a contract. Keep training.`;
    addLog(p, body);
    return { player: p, notices: [info("No Offers", body, "bad")] };
  }
  const job = makeJob(line, 0, rng);
  job.company = `${job.company.split(" ")[0]} ${sport} Club`;
  p.currentJob = job;
  p.annualSalary = job.salary;
  p.athlete.sport = sport;
  setFlag(p, "athlete");
  changeStat(p, "happiness", 12);
  changeStat(p, "fame", 3);
  const body = `You signed with ${job.company} as a ${job.title} for ${money(job.salary)} a year!`;
  addLog(p, body);
  return { player: p, notices: [info("Signed!", body, "good")] };
}

/** Injuries, ageing and retirement for pro athletes. */
export function processAthlete(p: PlayerState, rng: Rng, notices: NonNullable<ActionResult["notices"]>) {
  const job = p.currentJob;
  if (!job || job.lineId !== "athlete") return;
  p.skills.athletics = clamp(p.skills.athletics + (p.age < 28 ? rng.int(0, 2) : -rng.int(0, 3)));
  if (rng.chance(0.12)) {
    const dmg = rng.int(8, 20);
    changeStat(p, "health", -dmg);
    job.performance = clamp(job.performance - 15);
    const career = rng.chance(p.age > 30 ? 0.18 : 0.06);
    if (career) {
      const body = `A devastating injury ended your sports career. You lost ${dmg} Health and your contract.`;
      p.currentJob = null;
      p.annualSalary = 0;
      clearFlag(p, "athlete");
      changeStat(p, "happiness", -15);
      addLog(p, body);
      notices.push(info("Career-Ending Injury", body, "bad"));
      return;
    }
    const body = `You suffered a serious injury (−${dmg} Health, performance dipped).`;
    addLog(p, body);
    notices.push(info("Injured", body, "bad"));
  }
  if (p.age >= 36 && rng.chance(p.age >= 40 ? 1 : 0.45)) {
    const bonus = Math.round(job.salary * 0.5);
    p.bankBalance += bonus;
    const body = `You retired from professional sports with a ${money(bonus)} farewell package and a standing ovation.`;
    p.currentJob = null;
    p.annualSalary = 0;
    clearFlag(p, "athlete");
    addLog(p, body);
    notices.push(info("Retired a Legend", body, "good"));
  }
}

// ---------------------------------------------------------------------------
// Influencer
// ---------------------------------------------------------------------------

export function startChannel(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 10) return { player: p0, notices: [info("Too Young", "Ask your parents again in a few years.")] };
  if (p.influencer.active) return { player: p0 };
  p.influencer = { active: true, followers: rng.int(50, 500), lastPostYear: p.year };
  setFlag(p, "influencer");
  const body = `You launched your channel and posted your first video. ${p.influencer.followers} people followed.`;
  addLog(p, body);
  return { player: p, notices: [info("Channel Launched", body, "good")] };
}

export function postContent(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active) return { player: p0 };
  if ((p.annual.post ?? 0) >= 1) return { player: p0, notices: [info("Algorithm Fatigue", "You've posted your big content for the year.")] };
  p.annual.post = 1;
  inf.lastPostYear = p.year;
  const viral = rng.chance(0.08 + p.skills.charisma / 1000);
  const growth = 0.08 + rng.float(0, 0.35) + p.looks / 500 + p.skills.charisma / 500 + (viral ? 1.5 : 0);
  const gained = Math.max(30, Math.round(inf.followers * growth + rng.int(50, 800)));
  inf.followers += gained;
  p.skills.charisma = clamp(p.skills.charisma + 1);
  const body = viral
    ? `One of your videos went VIRAL! You gained ${gained.toLocaleString()} followers (${inf.followers.toLocaleString()} total).`
    : `Your content found an audience: +${gained.toLocaleString()} followers (${inf.followers.toLocaleString()} total).`;
  addLog(p, body);
  return { player: p, notices: [info(viral ? "VIRAL!" : "New Content", body, viral ? "jackpot" : "good")] };
}

export function brandCollab(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active || inf.followers < 5_000) return { player: p0, notices: [info("Not Yet", "Brands start calling at 5,000 followers.")] };
  if ((p.annual.collab ?? 0) >= 1) return { player: p0, notices: [info("Booked Solid", "You've already done a collab this year.")] };
  p.annual.collab = 1;
  const pay = Math.round(inf.followers * 0.25);
  p.bankBalance += pay;
  const body = `A brand paid you ${money(pay)} for a sponsored post.`;
  addLog(p, body);
  return { player: p, notices: [info("Sponsored Post", body, "good")] };
}

/** Returns yearly platform income (taxable). */
export function processInfluencer(p: PlayerState): number {
  const inf = p.influencer;
  if (!inf.active) return 0;
  if (inf.lastPostYear < p.year - 1) inf.followers = Math.round(inf.followers * 0.85);
  const famous = Math.round(Math.log10(Math.max(1, inf.followers)) * 10 - 10);
  if (famous > p.fame) p.fame = Math.min(100, famous);
  return inf.followers >= 5_000 ? Math.round(inf.followers * 0.35) : 0;
}
