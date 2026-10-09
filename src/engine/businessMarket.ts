/**
 * The market around the company: named rivals that attack different weaknesses (and can be fought, bought out or
 * outlasted), and multi-year industry shifts (a craze, a squeeze, a regulatory wave) the owner can lean into.
 * The yearly effects of both are computed in businessModel.ts (`rivalPull`, `shiftEffect`) so forecasts see them too.
 */
import type { ActionResult, Business, BusinessRival, MarketShift, PlayerState, RivalKind } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog } from "./state";
import { businessCosts, canSpend, done, info, open, poor, scale, spend, unchanged, type Notices } from "./businessKit";

export const MAX_RIVALS = 3;

export const RIVAL_INFO: Record<RivalKind, { label: string; blurb: string }> = {
  discounter: { label: "Discounter", blurb: "Undercuts everyone on price. Hurts mid-priced businesses most." },
  premium: { label: "Premium name", blurb: "A polished, expensive brand. Hurts anyone whose quality is only so-so." },
  chain: { label: "National chain", blurb: "Deep pockets and marketing. Hurts businesses without a strong reputation." },
  upstart: { label: "Upstart", blurb: "Hungry and unpredictable. Can fade fast or take off." },
};

const PARTS: Record<RivalKind, [string[], string[]]> = {
  discounter: [["Bargain", "Penny", "Dollar", "Budget", "Value", "Thrifty"], ["Hub", "Mart", "Express", "Direct", "Depot"]],
  premium: [["Maison", "Atelier", "Gilded", "Velvet", "Prime", "Meridian"], ["& Sons", "House", "Collective", "Studio", "Reserve"]],
  chain: [["Nationwide", "Unity", "Apex", "Omni", "Pinnacle", "Continental"], ["Group", "Brands", "Holdings", "& Co", "International"]],
  upstart: [["Fresh", "Nova", "Spark", "Bright", "Wild", "Kindred"], ["Labs", "Collective", "Works", "Co", "Club"]],
};

export function makeRival(b: Business, kind: RivalKind, year: number, rng: Rng): BusinessRival {
  const [a, z] = PARTS[kind];
  const strength = Math.round(clamp(rng.int(22, 48) + (b.competition - 50) * 0.2, 12, 70));
  return { id: `r${year}-${rng.int(100, 999)}`, name: `${rng.pick(a)} ${rng.pick(z)}`, kind, strength, since: year };
}

/** Which kind of rival tends to appear, given the weakness the market can see in you. */
export function pickRivalKind(b: Business, rng: Rng): RivalKind {
  const w: [RivalKind, number][] = [
    ["discounter", b.price === 1 ? 3 : 1.5],
    ["premium", b.quality < 55 ? 3 : 1],
    ["chain", b.reputation < 50 ? 3 : 1],
    ["upstart", 2],
  ];
  const total = w.reduce((s, [, x]) => s + x, 0);
  let r = rng.next() * total;
  for (const [k, x] of w) {
    r -= x;
    if (r <= 0) return k;
  }
  return "upstart";
}

/** Add a named rival if there is room. Returns it. */
export function spawnRival(b: Business, year: number, rng: Rng, kind?: RivalKind): BusinessRival | null {
  if (b.rivals.length >= MAX_RIVALS) return null;
  const r = makeRival(b, kind ?? pickRivalKind(b, rng), year, rng);
  b.rivals.push(r);
  return r;
}

export const strongestRival = (b: Business): BusinessRival | null => (b.rivals.length ? [...b.rivals].sort((x, y) => y.strength - x.strength)[0] : null);

export const priceWarCost = (b: Business) => Math.max(6_000, Math.round(0.035 * scale(b)));
export const buyoutCost = (b: Business, r: BusinessRival) => Math.round(businessCosts(b).acquire * (0.55 + r.strength / 100));
export const priceWarOdds = (b: Business, r: BusinessRival) => clamp(0.45 + (b.reputation - 50) / 200 + (b.quality - 50) / 300 + (b.cash > 2 * priceWarCost(b) ? 0.08 : -0.1) - r.strength / 250 + (r.kind === "chain" ? -0.1 : 0), 0.12, 0.8);

export function priceWar(p0: PlayerState, rng: Rng, rivalId: string): ActionResult {
  const c = open(p0);
  const r = c?.b.rivals.find((x) => x.id === rivalId);
  if (!c || !r) return { player: p0 };
  const { p, b } = c;
  if ((p.annual.bizwar ?? 0) >= 1) return unchanged(p0, "Already Fighting", "One price war a year is all your margins can take.");
  const cost = priceWarCost(b);
  if (!canSpend(p, b, cost)) return poor(p0, "A price war", cost);
  spend(p, b, cost, false);
  p.annual.bizwar = 1;
  if (rng.chance(priceWarOdds(b, r))) {
    r.strength = Math.max(0, r.strength - 26);
    b.customers = clamp(b.customers + 3);
    if (r.strength < 12) {
      b.rivals = b.rivals.filter((x) => x.id !== r.id);
      return done(c, "Rival Crushed", `You hit ${r.name} with promotions and loyalty deals (${money(cost)}). They couldn't match your staying power and closed up shop.`);
    }
    return done(c, "Price War Won", `You hit ${r.name} with promotions and loyalty deals (${money(cost)}). Their customers drifted back to you and they are weaker for it.`);
  }
  const extra = Math.round(0.02 * Math.max(b.revenue, scale(b)));
  b.cash -= extra;
  b.ytdSpend += extra;
  r.strength = Math.min(95, r.strength + 6);
  b.reputation = clamp(b.reputation - 1);
  return done(c, "Price War Lost", `${r.name} matched every discount and kept going. The war cost you ${money(cost + extra)} and left them stronger.`, "bad");
}

export function buyOutRival(p0: PlayerState, rng: Rng, rivalId: string): ActionResult {
  const c = open(p0);
  const r = c?.b.rivals.find((x) => x.id === rivalId);
  if (!c || !r) return { player: p0 };
  const { p, b } = c;
  if ((p.annual.bizacquire ?? 0) >= 1) return unchanged(p0, "Already Dealing", "One acquisition per year.");
  const cost = buyoutCost(b, r);
  if (!canSpend(p, b, cost)) return poor(p0, "Buying a rival", cost);
  spend(p, b, cost, true);
  p.annual.bizacquire = 1;
  b.rivals = b.rivals.filter((x) => x.id !== r.id);
  b.customers = clamp(b.customers + 6 + r.strength / 8);
  b.competition = clamp(b.competition - 10, 5, 95);
  b.assets += Math.round(cost * 0.3);
  b.reputation = clamp(b.reputation - 1);
  b.morale = clamp(b.morale - 6);
  const clash = rng.chance(b.manager ? 0.2 : 0.35);
  if (clash) {
    b.morale = clamp(b.morale - 8);
    b.staff = Math.max(0, b.staff - 1);
  }
  return done(c, "Rival Bought Out", `You bought ${r.name} for ${money(cost)} and absorbed their customers. ${clash ? "Integration was messy: a culture clash cost you morale and a key employee." : "Integration went smoothly, if tensely."}`, clash ? "neutral" : "good");
}

// ---------------------------------------------------------------------------
// Industry shifts
// ---------------------------------------------------------------------------

interface ShiftDef {
  id: string;
  label: string;
  blurb: string;
  kinds: string[];
  demand: number;
  cost: number;
}
const ALL = ["foodtruck", "onlinestore", "boutique", "consultancy", "farm", "barcafe", "restaurant", "gym", "construction", "logistics", "nightclub", "startup"];
const PHYSICAL = ["foodtruck", "boutique", "farm", "barcafe", "restaurant", "gym", "construction", "logistics", "nightclub"];

export const SHIFTS: ShiftDef[] = [
  { id: "foodie", label: "Foodie boom", blurb: "People are eating out, eating local and posting every plate.", kinds: ["foodtruck", "restaurant", "barcafe", "farm"], demand: 0.07, cost: 0 },
  { id: "remote", label: "Remote-work wave", blurb: "Laptops everywhere: cafes, freelancers and online buyers are flush.", kinds: ["barcafe", "consultancy", "onlinestore", "startup"], demand: 0.07, cost: 0 },
  { id: "wellness", label: "Wellness craze", blurb: "Everyone wants to be healthier, and willing to pay for it.", kinds: ["gym", "farm", "barcafe", "boutique"], demand: 0.08, cost: 0 },
  { id: "ecom", label: "E-commerce surge", blurb: "Spending is moving online faster than anyone forecast.", kinds: ["onlinestore", "logistics", "startup"], demand: 0.09, cost: 0 },
  { id: "building", label: "Building boom", blurb: "Cheap credit and new estates: order books are filling up.", kinds: ["construction", "logistics"], demand: 0.09, cost: 0.01 },
  { id: "tourism", label: "Tourism rebound", blurb: "Visitors are flooding back into town.", kinds: ["restaurant", "barcafe", "nightclub", "boutique", "foodtruck"], demand: 0.07, cost: 0 },
  { id: "nightlife", label: "Nightlife revival", blurb: "The city is going out again.", kinds: ["nightclub", "barcafe"], demand: 0.08, cost: 0 },
  { id: "local", label: "Buy-local movement", blurb: "Shoppers are turning their back on faceless chains.", kinds: ["farm", "boutique", "foodtruck", "restaurant"], demand: 0.06, cost: 0 },
  { id: "supply", label: "Supply-chain squeeze", blurb: "Shipments are late and suppliers are charging whatever they like.", kinds: PHYSICAL, demand: 0, cost: 0.06 },
  { id: "inflation", label: "Input-cost inflation", blurb: "Everything you buy keeps getting more expensive.", kinds: ALL, demand: 0, cost: 0.045 },
  { id: "tradedown", label: "Consumer trade-down", blurb: "Households are cutting back on anything that isn't essential.", kinds: ["boutique", "restaurant", "barcafe", "nightclub", "gym", "foodtruck"], demand: -0.07, cost: 0 },
  { id: "platform", label: "Platform fee hikes", blurb: "The marketplaces you depend on have changed their terms again.", kinds: ["onlinestore", "startup"], demand: -0.03, cost: 0.04 },
  { id: "crackdown", label: "Regulatory crackdown", blurb: "New licensing rules and a wave of inspections.", kinds: ["nightclub", "construction", "logistics", "farm", "barcafe"], demand: -0.03, cost: 0.03 },
  { id: "format", label: "Flashy new format", blurb: "A trendy new concept is pulling the crowds away from the old guard.", kinds: ["gym", "restaurant", "foodtruck", "barcafe"], demand: -0.06, cost: 0 },
  { id: "automation", label: "Automation wave", blurb: "Cheap software and AI are eating into what clients used to pay for.", kinds: ["consultancy", "startup", "onlinestore"], demand: -0.06, cost: 0 },
  { id: "slump", label: "Housing slump", blurb: "Developers have stopped breaking ground.", kinds: ["construction"], demand: -0.1, cost: 0 },
];

export const shiftResponseCost = (b: Business) => Math.max(5_000, Math.round(0.03 * scale(b)));

export function newShift(b: Business, rng: Rng): MarketShift | null {
  const pool = SHIFTS.filter((s) => s.kinds.includes(b.kind));
  if (pool.length === 0) return null;
  const d = rng.pick(pool);
  return { id: d.id, label: d.label, blurb: d.blurb, demand: d.demand, cost: d.cost, yearsLeft: rng.int(2, 5), responded: false };
}

export function respondToShift(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c?.b.shift) return { player: p0 };
  const { p, b } = c;
  const s = b.shift!;
  if (s.responded) return unchanged(p0, "Already Responded", `You have already reacted to the ${s.label.toLowerCase()}.`);
  const cost = shiftResponseCost(b);
  if (!canSpend(p, b, cost)) return poor(p0, "Your response", cost);
  spend(p, b, cost, false);
  s.responded = true;
  const up = s.demand >= 0;
  return done(c, up ? "Leaning In" : "Bracing", up
    ? `You put ${money(cost)} behind the ${s.label.toLowerCase()}: extra stock, ads and staff hours. If it lasts, you'll capture far more of it than the competition.`
    : `You spent ${money(cost)} renegotiating contracts, trimming waste and reassuring customers. The ${s.label.toLowerCase()} will hurt about half as much.`);
}

/** Yearly: rivals move, shifts end or begin. */
export function processMarket(p: PlayerState, b: Business, rng: Rng, notices: Notices) {
  const recession = p.economy.climate === "recession";
  const keep: BusinessRival[] = [];
  for (const r of b.rivals) {
    r.strength = Math.round(clamp(r.strength + rng.int(-6, 8) + (b.reputation < 45 ? 2 : -1), 5, 95));
    const pDie = clamp(0.06 + (recession ? 0.07 : 0) + (r.strength < 25 ? 0.08 : 0) - (r.strength > 70 ? 0.04 : 0), 0.02, 0.3);
    if (rng.chance(pDie)) {
      b.customers = clamp(b.customers + 3);
      const body = `${r.name}, a rival that had been eating into your business, closed down. Some of its customers have found their way to you.`;
      addLog(p, body);
      notices.push(info("Rival Folded", body, "good"));
    } else keep.push(r);
  }
  b.rivals = keep;

  if (b.shift) {
    b.shift.yearsLeft -= 1;
    if (b.shift.yearsLeft <= 0) {
      const body = `The ${b.shift.label.toLowerCase()} has run its course. ${b.shift.demand >= 0 ? "The tailwind is gone." : "The pressure is easing."}`;
      addLog(p, body);
      notices.push(info("Industry Shift Over", body, "neutral"));
      b.shift = null;
    }
  } else if (rng.chance(0.13)) {
    const s = newShift(b, rng);
    if (s) {
      b.shift = s;
      const body = `${s.label}: ${s.blurb} It should last about ${s.yearsLeft} years. ${s.demand >= 0 ? "You can lean into it to capture more." : "You can brace for it to soften the blow."}`;
      addLog(p, body);
      notices.push(info("Industry Shift", body, s.demand >= 0 ? "good" : "bad"));
    }
  }
}

export function marketNotes(b: Business): string[] {
  const notes: string[] = [];
  for (const r of b.rivals) if (r.strength >= 55) notes.push(`${r.name} is a serious threat (strength ${r.strength}).`);
  if (b.shift && !b.shift.responded) notes.push(`${b.shift.label} is under way and you haven't reacted to it.`);
  return notes;
}
