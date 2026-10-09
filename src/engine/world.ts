/**
 * The wider world: economic climate, investments, rental housing and relocating abroad.
 */
import type { ActionResult, Climate, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { COUNTRY_BY_NAME, getCountry } from "@/data/countries";
import { profileOf } from "@/data/countryProfiles";
import { addLog, changeStat, clone, isRoyal } from "./state";
import { relocationBlocker } from "./justice";
import { forcedClimate, worldMarketShift } from "./worldEvents";
import { needsRoute, routeFor, settle, type RouteId } from "./visa";

type Notices = NonNullable<ActionResult["notices"]>;

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Economic climate
// ---------------------------------------------------------------------------

const HEADLINES: Record<Climate, string[]> = {
  boom: [
    "The economy is booming: hiring is up and markets are climbing.",
    "A tech-driven boom lifts wages and confidence across the country.",
  ],
  normal: [
    "The economy has settled into steady, unremarkable growth.",
    "Markets level out after a turbulent period.",
  ],
  recession: [
    "A recession has hit. Layoffs are rising and markets are tumbling.",
    "Credit tightens as the economy slides into recession.",
  ],
};

export function advanceClimate(p: PlayerState, rng: Rng, notices: Notices) {
  // A war, pandemic or crisis where you live overrides the ordinary cycle.
  const forced = forcedClimate(p);
  if (forced && p.economy.climate !== forced) {
    p.economy = { climate: forced, yearsLeft: 1 };
    return;
  }
  if (forced) {
    p.economy.yearsLeft = Math.max(1, p.economy.yearsLeft);
    return;
  }
  p.economy.yearsLeft -= 1;
  if (p.economy.yearsLeft > 0) return;
  const next = rng.weighted<Climate>(["boom", "normal", "recession"], (c) => (c === "normal" ? 0.56 : 0.22))!;
  const changed = next !== p.economy.climate;
  p.economy = { climate: next, yearsLeft: rng.int(2, 5) };
  if (changed) {
    const line = rng.pick(HEADLINES[next]);
    addLog(p, `📰 ${line}`);
    notices.push(info(next === "boom" ? "Economic Boom" : next === "recession" ? "Recession" : "Stable Economy", line, next === "boom" ? "good" : next === "recession" ? "bad" : "neutral"));
  }
}

/** Housing market change, always inside the -3%..+6% band but biased by the climate. */
export function housingIndex(climate: Climate, rng: Rng): number {
  if (climate === "boom") return rng.float(0.025, 0.06);
  if (climate === "recession") return rng.float(-0.03, 0);
  return rng.float(-0.015, 0.045);
}

export function layoffChance(climate: Climate): number {
  return climate === "recession" ? 0.06 : climate === "boom" ? 0.01 : 0.02;
}

export function hiringModifier(climate: Climate): number {
  return climate === "recession" ? -0.1 : climate === "boom" ? 0.05 : 0;
}

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

export const INVESTMENTS = [
  { id: "bonds", name: "Government Bonds", emoji: "🏛️", mean: 0.035, sd: 0.015, blurb: "Slow, safe, and boring." },
  { id: "index", name: "Index Fund", emoji: "📊", mean: 0.07, sd: 0.13, blurb: "The whole market in one purchase." },
  { id: "tech", name: "Tech Stocks", emoji: "💾", mean: 0.1, sd: 0.28, blurb: "Hype, growth, and the occasional crater." },
  { id: "crypto", name: "Crypto", emoji: "🪙", mean: 0.12, sd: 0.7, blurb: "Moonshot or rug-pull. Flip a coin." },
] as const;

export const CAPITAL_GAINS_RATE = 0.15;

function gauss(rng: Rng): number {
  let s = 0;
  for (let i = 0; i < 6; i++) s += rng.next();
  return (s - 3) / 0.7071;
}

export function yearReturn(id: string, climate: Climate, rng: Rng): number {
  const inv = INVESTMENTS.find((i) => i.id === id);
  if (!inv) return 0;
  const shift = climate === "boom" ? 0.06 : climate === "recession" ? -0.12 : 0;
  const scale = id === "bonds" ? 0.1 : 1;
  return clamp(inv.mean + shift * scale + inv.sd * gauss(rng), -0.85, 3);
}

export function portfolioValue(p: PlayerState): number {
  return Object.values(p.investments).reduce((s, h) => s + h.value, 0);
}

export function processInvestments(p: PlayerState, rng: Rng, notices: Notices) {
  const before = portfolioValue(p);
  if (before <= 0) return;
  for (const [id, h] of Object.entries(p.investments)) {
    h.value = Math.max(0, Math.round(h.value * (1 + yearReturn(id, p.economy.climate, rng) + (p.talents.moneySense - 50) / 1000 + (id === "bonds" ? 0 : worldMarketShift(p)))));
    if (h.value === 0 && h.basis === 0) delete p.investments[id];
  }
  const after = portfolioValue(p);
  const change = (after - before) / before;
  if (Math.abs(change) >= 0.2 && before > 5_000) {
    const body = `Your portfolio ${change > 0 ? "surged" : "plunged"} ${Math.round(Math.abs(change) * 100)}% this year (${money(after - before)}).`;
    addLog(p, body);
    notices.push(info(change > 0 ? "Markets Soar" : "Markets Plunge", body, change > 0 ? "good" : "bad"));
  }
}

export function invest(p0: PlayerState, id: string, amount: number): ActionResult {
  const p = clone(p0);
  if (!INVESTMENTS.some((i) => i.id === id)) return { player: p0 };
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You must be 18 to invest.", "bad")] };
  if (amount <= 0 || amount > p.bankBalance) return { player: p0, notices: [info("Insufficient Funds", "You don't have that much cash.", "bad")] };
  p.bankBalance -= amount;
  const h = p.investments[id] ?? { value: 0, basis: 0 };
  h.value += amount;
  h.basis += amount;
  p.investments[id] = h;
  const name = INVESTMENTS.find((i) => i.id === id)!.name;
  const body = `You invested ${money(amount)} in ${name}.`;
  addLog(p, body);
  return { player: p, notices: [info("Investment Made", body, "good")] };
}

/** Sell `amount` (or everything if omitted). 15% capital gains tax applies to profit. */
export function divest(p0: PlayerState, id: string, amount?: number): ActionResult {
  const p = clone(p0);
  const h = p.investments[id];
  if (!h || h.value <= 0) return { player: p0 };
  const sell = Math.min(amount ?? h.value, h.value);
  const fraction = sell / h.value;
  const basisPart = Math.round(h.basis * fraction);
  const gain = Math.max(0, sell - basisPart);
  const tax = Math.round(gain * CAPITAL_GAINS_RATE);
  p.bankBalance += sell - tax;
  h.value -= sell;
  h.basis -= basisPart;
  if (h.value <= 0) delete p.investments[id];
  const name = INVESTMENTS.find((i) => i.id === id)!.name;
  const body = `You sold ${money(sell)} of ${name}${tax ? ` and paid ${money(tax)} in capital gains tax` : ""}.`;
  addLog(p, body);
  return { player: p, notices: [info("Investment Sold", body, gain > 0 ? "good" : "neutral")] };
}

// ---------------------------------------------------------------------------
// Rental housing
// ---------------------------------------------------------------------------

export const RENT_TIERS = [
  { name: "Room in a Shared Flat", emoji: "🛏️", rent: 5_000, happiness: -1, blurb: "Cheap. Someone else's cereal is always in your cupboard." },
  { name: "Standard Apartment", emoji: "🏢", rent: 9_000, happiness: 0, blurb: "A one-bedroom with a dishwasher and a view of a wall." },
  { name: "Nice Apartment", emoji: "🌇", rent: 20_000, happiness: 1, blurb: "Hardwood floors, a gym downstairs." },
  { name: "Luxury Rental", emoji: "🏙️", rent: 55_000, happiness: 2, blurb: "Doorman, skyline, and a monthly bill that makes you wince." },
] as const;

/** Living standard: what you spend on food, clothes, nights out, holidays and gadgets. */
export const LIFESTYLES = [
  { name: "Frugal", emoji: "🥫", base: 0.65, slope: 0.2, mood: -5, blurb: "Cook at home, buy second-hand, skip the holidays. Your savings grow; your joy shrinks." },
  { name: "Comfortable", emoji: "🛋️", base: 1, slope: 0.45, mood: 0, blurb: "Eat out sometimes, a holiday each year, no stress at the till." },
  { name: "Lavish", emoji: "🥂", base: 1.8, slope: 0.85, mood: 6, blurb: "Designer everything, first-class travel, parties. Joyful, but money evaporates." },
] as const;

export function setLifestyle(p0: PlayerState, level: number): ActionResult {
  const p = clone(p0);
  if (level < 0 || level >= LIFESTYLES.length || level === p.lifestyle) return { player: p0 };
  p.lifestyle = level;
  const body = `You switched to a ${LIFESTYLES[level].name.toLowerCase()} lifestyle.`;
  addLog(p, body);
  return { player: p, notices: [info("New Lifestyle", body, "neutral")] };
}

export const BASE_LIVING = 14_000;
/** Yearly cost of raising each minor child. */
export const CHILD_COST = 6_000;
export const OWNED_HOUSING = 3_000;

/** Living in a parent's home: you chip in, but it isn't a rent. */
export const FAMILY_HOME_CONTRIBUTION = 1_500;

export const livesWithParents = (p: PlayerState) =>
  p.flags.includes("lives_with_parents") && p.relatives.some((r) => r.relation === "Parent" && r.alive);

export function housingCost(p: PlayerState): number {
  if (p.properties.length > 0) return OWNED_HOUSING;
  if (livesWithParents(p)) return FAMILY_HOME_CONTRIBUTION;
  return RENT_TIERS[p.residence.rentTier].rent;
}

/** Move back in with (or out from) a living parent. */
export function toggleFamilyHome(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0 };
  if (p.flags.includes("lives_with_parents")) {
    if (p.bankBalance < 500) return { player: p0, notices: [info("Moving Costs", "You need at least $500 for a deposit and movers.", "bad")] };
    p.bankBalance -= 500;
    p.flags = p.flags.filter((f) => f !== "lives_with_parents");
    const body = "You moved out of your parents' home and into a place of your own.";
    addLog(p, body);
    return { player: p, notices: [info("Flying the Nest", body, "good")] };
  }
  if (!p.relatives.some((r) => r.relation === "Parent" && r.alive)) return { player: p0, notices: [info("No Parents", "There's no family home to go back to.", "bad")] };
  if (p.properties.length > 0) return { player: p0, notices: [info("You Own a Home", "You already have a place of your own.", "neutral")] };
  p.flags.push("lives_with_parents");
  for (const r of p.relatives) if (r.alive && r.relation === "Parent") r.relationshipBar = Math.min(100, r.relationshipBar + 6);
  const body = "You moved back in with your parents. Rent is nearly free, but you're an adult sleeping in your childhood bedroom.";
  addLog(p, body);
  return { player: p, notices: [info("Back Home", body, "neutral")] };
}

export function setRentTier(p0: PlayerState, tier: number): ActionResult {
  const p = clone(p0);
  if (tier < 0 || tier >= RENT_TIERS.length || tier === p.residence.rentTier) return { player: p0 };
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You can't sign a lease yet.", "bad")] };
  if (p.bankBalance < 500) return { player: p0, notices: [info("Moving Costs", "You need at least $500 for movers and a deposit.", "bad")] };
  p.bankBalance -= 500;
  p.flags = p.flags.filter((f) => f !== "lives_with_parents");
  p.residence.rentTier = tier;
  const body = `You moved into a ${RENT_TIERS[tier].name.toLowerCase()} (${money(RENT_TIERS[tier].rent)}/yr).`;
  addLog(p, body);
  return { player: p, notices: [info("New Place", body, "good")] };
}

// ---------------------------------------------------------------------------
// Relocation
// ---------------------------------------------------------------------------

export const RELOCATE_DOMESTIC = 2_500;
export const RELOCATE_ABROAD = 9_000;

export function relocate(p0: PlayerState, country: string, rng: Rng, route?: RouteId): ActionResult {
  const p = clone(p0);
  const dest = COUNTRY_BY_NAME[country];
  if (!dest) return { player: p0 };
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You can't move out on your own yet.", "bad")] };
  if (p.isInPrison || p.pendingTrial) return { player: p0, notices: [info("Not Possible", "You can't relocate right now.", "bad")] };
  if (isRoyal(p)) return { player: p0, notices: [info("Duty Calls", "Royals can't simply emigrate. The crown needs you.", "bad")] };
  const restricted = relocationBlocker(p, dest.name);
  if (restricted) return { player: p0, notices: [info("Can't Move", restricted, "bad")] };
  const abroad = dest.name !== p.residence.country;
  // Abroad, you need papers: citizens move freely, everyone else picks a route.
  const needs = abroad && needsRoute(p, dest.name);
  const info0 = needs && route ? routeFor(p, dest.name, route) : undefined;
  if (needs && !info0) return { player: p0, notices: [info("You Need a Visa", `${dest.name} will not let you in without papers. Choose a route (work, study, family, investment, asylum) on the relocation screen.`, "bad")] };
  if (info0?.blocker) return { player: p0, notices: [info("Not Eligible", info0.blocker, "bad")] };
  const moveCost = route === "asylum" ? 2_000 : abroad ? RELOCATE_ABROAD : RELOCATE_DOMESTIC;
  const fees = info0 ? info0.fee : 0;
  if (p.bankBalance < moveCost + fees) return { player: p0, notices: [info("Insufficient Funds", `Moving${info0 ? ` and the ${info0.label.toLowerCase()}` : ""} costs ${money(moveCost + fees)}.`, "bad")] };
  if ((p.annual.relocate ?? 0) >= 1) return { player: p0, notices: [info("Boxes Everywhere", "You've already moved this year.")] };
  p.annual.relocate = 1;
  p.bankBalance -= moveCost + fees;
  const refused = info0 && info0.id !== "investor" && !rng.chance(info0.chance);
  if (refused && info0) {
    p.immigration.refused += 1;
    const body = info0.id === "undocumented" ? "The crossing failed. You lost the smugglers' fee and had to turn back." : `Your ${info0.label.toLowerCase()} application was refused. The fees are gone, and each refusal makes the next application harder.`;
    addLog(p, body);
    changeStat(p, "happiness", -5);
    return { player: p, notices: [info("Application Refused", body, "bad")] };
  }
  const keepJob = route === "work" && !!p.currentJob && !["athlete", "mafia", "spy"].includes(p.currentJob.lineId);
  const oldCountry = p.residence.country;
  const city = rng.pick(dest.cities.filter((c) => c !== p.residence.city).concat(dest.cities[0]));
  p.residence = { ...p.residence, country: dest.name, city };
  if (abroad) settle(p, dest.name, needs ? (route ?? null) : null);
  if (abroad) p.economy = { climate: rng.pick(["normal", "normal", "boom", "recession"] as const), yearsLeft: rng.int(1, 3) };
  for (const r of p.relatives) {
    if (!r.alive || r.partnerStatus === "ex") continue;
    if (r.relation === "Partner") continue;
    r.relationshipBar = clamp(r.relationshipBar - (abroad ? 18 : 8));
  }
  if (p.currentJob && !keepJob) {
    p.currentJob = null;
    p.annualSalary = 0;
  }
  if (abroad && p.flags.includes("emigrant") === false && dest.name !== p.birthCountry) p.flags.push("emigrant");
  if (dest.name === p.birthCountry) p.flags = p.flags.filter((f) => f !== "emigrant");
  const swing = rng.int(abroad ? -6 : -3, abroad ? 12 : 8);
  changeStat(p, "happiness", swing);
  const status = p.immigration.status;
  const how = !abroad ? "" : !needs ? ` You are a citizen there, so no papers were needed.` : ` You arrived on ${status === "permanent" ? "permanent residence" : status === "overstay" ? "no papers at all" : `a ${status === "asylum" ? "refugee" : status} permit`}.`;
  const body = abroad
    ? `You emigrated from ${oldCountry} to ${city}, ${dest.name}. New tax rules, new language${profileOf(dest.name).language === profileOf(oldCountry).language ? "" : ` (${profileOf(dest.name).language}, which you barely speak)`}, new life.${how}${keepJob ? " Your employer transferred you, so you kept your job." : " You had to leave your job behind."}`
    : `You moved to ${city}. A fresh start in a familiar country. You left your job behind.`;
  addLog(p, body);
  return { player: p, notices: [info(abroad ? "New Country!" : "New City!", body, swing >= 0 ? "good" : "neutral")] };
}

export { getCountry };
