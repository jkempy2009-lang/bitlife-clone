/** Entrepreneurship. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";

import { addLog, changeStat, clearFlag, clone, isRoyal, setFlag } from "./state";

import { blockerFor } from "./occupation";

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
  const blocked = blockerFor(p, "business");
  if (blocked) return { player: p0, notices: [info("Can't Start a Business", blocked, "bad")] };
  if (p.smarts < kind.minSmarts) return { player: p0, notices: [info("Not Ready", `Running a ${kind.name.toLowerCase()} needs ${kind.minSmarts}+ Smarts.`, "bad")] };
  if (p.bankBalance < kind.cost) return { player: p0, notices: [info("Insufficient Funds", `You need ${money(kind.cost)} in cash to open a ${kind.name.toLowerCase()}.`, "bad")] };
  p.bankBalance -= kind.cost;
  const label = name.trim() || `${p.lastName} ${kind.name}`;
  p.business = { kind: kind.id, name: label, value: kind.cost, staff: 0, locations: 1, lastProfit: 0, boost: 0, founded: p.year };
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

export const STAFF_SALARY = 12_000;
export const MARKETING_COST = 10_000;
export const MAX_LOCATIONS = 4;

export const maxStaff = (locations: number) => 10 + 5 * (locations - 1);

export function hireStaff(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const biz = p.business;
  if (!biz) return { player: p0 };
  if (biz.staff >= maxStaff(biz.locations)) return { player: p0, notices: [info("Fully Staffed", "You've hit your headcount limit. Expand to add more.")] };
  if (p.bankBalance < 3_000) return { player: p0, notices: [info("Insufficient Funds", "Recruiting costs $3,000.", "bad")] };
  p.bankBalance -= 3_000;
  biz.staff += 1;
  const body = `You hired a new employee at ${biz.name}. Headcount: ${biz.staff}.`;
  addLog(p, body);
  return { player: p, notices: [info("New Hire", body, "good")] };
}

export function fireStaff(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const biz = p.business;
  if (!biz || biz.staff <= 0) return { player: p0 };
  biz.staff -= 1;
  changeStat(p, "karma", -1);
  const body = `You let someone go at ${biz.name}. Headcount: ${biz.staff}.`;
  addLog(p, body);
  return { player: p, notices: [info("Layoff", body, "neutral")] };
}

export function runMarketing(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const biz = p.business;
  if (!biz) return { player: p0 };
  if (p.bankBalance < MARKETING_COST) return { player: p0, notices: [info("Insufficient Funds", `A campaign costs ${money(MARKETING_COST)}.`, "bad")] };
  if ((p.annual.marketing ?? 0) >= 1) return { player: p0, notices: [info("Campaign Running", "One marketing push per year.")] };
  p.annual.marketing = 1;
  p.bankBalance -= MARKETING_COST;
  biz.boost += 0.1;
  const body = `A new marketing campaign for ${biz.name} is live. Expect +10% profit this year.`;
  addLog(p, body);
  return { player: p, notices: [info("Marketing Push", body, "good")] };
}

export function expandBusiness(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const biz = p.business;
  if (!biz) return { player: p0 };
  if (biz.locations >= MAX_LOCATIONS) return { player: p0, notices: [info("Empire Complete", "You already operate the maximum number of locations.")] };
  const cost = Math.round(biz.value * 0.6);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `Opening another location costs ${money(cost)}.`, "bad")] };
  p.bankBalance -= cost;
  biz.locations += 1;
  biz.value = Math.round(biz.value * 1.6);
  const body = `${biz.name} opened location #${biz.locations}. Valuation: ${money(biz.value)}.`;
  addLog(p, body);
  return { player: p, notices: [info("Expansion!", body, "good")] };
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
  const locationRisk = 1 + (biz.locations - 1) * 0.15;
  const raw = biz.value * (kind.mean + skillBonus + rng.float(-kind.vol * locationRisk, kind.vol * locationRisk)) * (1 + biz.boost) * (1 + 0.04 * biz.staff);
  const profit = Math.round(raw - biz.staff * STAFF_SALARY);
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

