/**
 * The economics of a business, as pure functions over `Business` + `PlayerState` (no mutation, no RNG).
 * `business.ts` owns the actions and the yearly transaction; this file answers "what would happen" so the same math
 * drives the real year, the dashboard's projected ranges and the valuation.
 */
import type { Business, BusinessPayout, KeyPerson, KeyRole, PlayerState } from "@/types/game.types";
import { makeRng, type Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { incomeTaxFor } from "@/data/countries";
import { BUSINESS_BY_ID, BUSINESS_TYPES, type BusinessType } from "@/data/businessTypes";

export const kindOf = (b: Business): BusinessType => BUSINESS_BY_ID[b.kind] ?? BUSINESS_TYPES[0];

/** Small-company tax on positive profit (owner draws are then taxed again as personal income). */
export const CORP_TAX = 0.15;
/** Broker, legal and due-diligence costs on a sale. */
export const SALE_FEE = 0.06;
export const PRICE_LABELS = ["Budget", "Market", "Premium"] as const;
export const PAYOUT_SHARE: Record<BusinessPayout, number> = { reinvest: 0, balanced: 0.45, salary: 0.85 };
export const PAYOUT_LABELS: Record<BusinessPayout, string> = { reinvest: "Reinvest", balanced: "Balanced", salary: "Max salary" };
export const INSURANCE_LABELS = ["None", "Basic", "Comprehensive"] as const;
const PRICE_MULT = [0.85, 1, 1.22];
const INS_RATE = [0, 0.005, 0.014];
const INS_COVER = [0, 0.6, 0.9];
const OVERDRAFT_RATE = 0.18;
export { OVERDRAFT_RATE };

/** Approximately N(0,1). */
export const gauss = (rng: Rng) => (rng.next() + rng.next() + rng.next() + rng.next() - 2) / 0.577;

export function drawFit(kind: BusinessType, rng: Rng): number {
  if (kind.revMult > 0) return clamp(Math.exp(gauss(rng) * 0.6 - 0.45), 0.25, 2.2);
  return clamp(kind.fitMean + kind.fitSd * gauss(rng), 0.35, 1.5);
}

export function newBusiness(kind: BusinessType, name: string, year: number, rng: Rng): Business {
  const cash = Math.round(kind.cost * kind.startCash);
  return {
    kind: kind.id, name, value: kind.cost, staff: 0, locations: 1, lastProfit: 0, boost: 0, founded: year,
    reputation: 40, customers: kind.startCustomers, quality: 50, price: 1, morale: 65, training: 25, facility: 100, upgrades: 0,
    cash, debt: 0, loanRate: 0.08, assets: kind.cost - cash, basis: kind.cost, ownerShare: 1, manager: null,
    fit: drawFit(kind, rng), marketing: 1.2, insurance: 0, compliance: 35, payout: "balanced", revenue: 0,
    competition: clamp(kind.competition + rng.int(-10, 10), 5, 95), diversified: 0, franchises: 0, rounds: 0, neglect: 0,
    covenantBreaches: 0, rescue: true, ytdSpend: 0, lastPivot: -99, profitableYears: 0, history: [],
    team: [], rivals: [], shift: null, investors: [], boardHeat: 0, passive: false, ousted: false, franchisor: null, guaranteed: 0,
  };
}

// ---------------------------------------------------------------------------
// Buying into a franchise
// ---------------------------------------------------------------------------

export const FRANCHISE_BRANDS: Record<string, string[]> = {
  foodtruck: ["Taco Titan", "Wrap Republic", "Street Eats Co"],
  boutique: ["Threadline", "Maison Lune", "Style Society"],
  barcafe: ["Bean & Barrel", "Daily Grind", "Roast House"],
  restaurant: ["Burger Barn", "Pasta Palace", "Grill & Co"],
  gym: ["PulseFit", "Iron Works Fitness", "Anytime Strength"],
};

/** What a franchisor charges: an upfront fee, a royalty on revenue and a mandatory brand fund. */
export function franchiseTerms(k: BusinessType): { fee: number; royalty: number; adFund: number } | null {
  if (!k.franchise) return null;
  return { fee: k.franchise.fee, royalty: Math.round((k.franchise.royalty / k.baseRev) * 1000) / 1000, adFund: 0.02 };
}

/**
 * A franchised unit: the brand brings customers, a proven playbook (market fit lands in a narrow band instead of a
 * lottery), supply deals and half the marketing bill, in return for an upfront fee, royalties on every dollar of
 * revenue and a franchisor who sets the rules.
 */
export function newFranchise(kind: BusinessType, name: string, year: number, rng: Rng, brand?: string): Business | null {
  const t = franchiseTerms(kind);
  if (!t) return null;
  const b = newBusiness(kind, name, year, rng);
  const brandName = brand ?? rng.pick(FRANCHISE_BRANDS[kind.id] ?? ["Brand"]);
  b.fit = clamp(1 + 0.07 * gauss(rng), 0.82, 1.2);
  b.reputation = 55;
  b.customers = Math.min(45, Math.round(kind.startCustomers * 1.6));
  b.quality = 60;
  b.compliance = 55;
  b.marketing = 1.8;
  b.basis = kind.cost + t.fee;
  b.franchisor = { brand: brandName, royalty: t.royalty, adFund: t.adFund, since: year };
  return b;
}

/** Fill any field missing from a business written by an older version of the game. Mutates and returns `b`. */
export function ensureBusiness(b: Business): Business {
  const kind = kindOf(b);
  const d = b as Partial<Business> & Business;
  const num = <K extends keyof Business>(k: K, v: Business[K]) => {
    if (typeof d[k] !== "number" || Number.isNaN(d[k])) (d as unknown as Record<string, unknown>)[k] = v;
  };
  if (!BUSINESS_BY_ID[d.kind]) d.kind = kind.id;
  d.name = d.name || "My Business";
  num("value", kind.cost);
  num("staff", 0);
  num("locations", 1);
  num("lastProfit", 0);
  num("boost", 0);
  num("founded", 2026);
  const book = Math.max(0, d.value);
  num("reputation", 50);
  num("customers", 55);
  num("quality", 50);
  num("price", 1);
  num("morale", 60);
  num("training", 30);
  num("facility", 70);
  num("upgrades", 0);
  num("cash", Math.round(book * 0.15));
  num("debt", 0);
  num("loanRate", 0.08);
  num("assets", Math.round(book * 0.85));
  num("basis", book);
  num("ownerShare", 1);
  num("fit", 1);
  num("marketing", 1.5);
  num("insurance", 0);
  num("compliance", 40);
  num("revenue", 0);
  num("competition", kind.competition);
  num("diversified", 0);
  num("franchises", 0);
  num("rounds", 0);
  num("neglect", 0);
  num("covenantBreaches", 0);
  num("ytdSpend", 0);
  num("lastPivot", -99);
  num("profitableYears", 0);
  if (d.manager === undefined) d.manager = null;
  if (!d.payout || !(d.payout in PAYOUT_SHARE)) d.payout = "balanced";
  if (typeof d.rescue !== "boolean") d.rescue = true;
  if (!Array.isArray(d.history)) d.history = [];
  num("boardHeat", 0);
  num("guaranteed", 0);
  if (!Array.isArray(d.team)) d.team = [];
  if (!Array.isArray(d.rivals)) d.rivals = [];
  if (!Array.isArray(d.investors)) d.investors = [];
  if (d.shift === undefined) d.shift = null;
  if (typeof d.passive !== "boolean") d.passive = false;
  if (typeof d.ousted !== "boolean") d.ousted = false;
  if (d.franchisor === undefined) d.franchisor = null;
  // Older saves tracked only the owner's share: invent a backer so the ledger always adds up to the outside stake.
  const outside = Math.max(0, 1 - clamp(d.ownerShare, 0, 1));
  const ledger = d.investors.reduce((s, i) => s + i.share, 0);
  if (outside > 0.001 && Math.abs(ledger - outside) > 0.002) {
    if (d.investors.length === 0) d.investors.push({ id: "legacy-backers", name: "Early backers", kind: "angel", share: Math.round(outside * 1000) / 1000, agenda: "profit", invested: 0, pref: false, since: d.founded });
    else d.investors[0].share = Math.max(0.001, Math.round((d.investors[0].share + outside - ledger) * 1000) / 1000);
  } else if (outside <= 0.001 && d.investors.length) d.investors = [];
  return d;
}

// ---------------------------------------------------------------------------
// The yearly model
// ---------------------------------------------------------------------------

export interface Shocks {
  /** Fractional swing in demand this year. */
  demand: number;
  /** Fractional swing in cost of goods. */
  cost: number;
  /** Gross incident loss as a share of revenue (0 = nothing happened). */
  incident: number;
}
export const NO_SHOCKS: Shocks = { demand: 0, cost: 0, incident: 0 };

export interface Pnl {
  revenue: number;
  royalties: number;
  cogs: number;
  fixed: number;
  wages: number;
  manager: number;
  /** Named key employees' pay. */
  keyStaff: number;
  /** Royalties and brand-fund contributions paid to a franchisor. */
  franchisor: number;
  marketing: number;
  insurance: number;
  upkeep: number;
  incidentNet: number;
  /** Before decision spending, interest and tax. */
  operating: number;
}

export interface YearStep {
  pnl: Pnl;
  /** Share of demand the team can serve (1 = fully staffed). */
  capacity: number;
  demand: number;
  next: Pick<Business, "customers" | "reputation" | "quality" | "morale" | "training" | "facility" | "competition" | "marketing" | "neglect">;
}

export function climateFactor(p: PlayerState, kind: BusinessType): number {
  const c = p.economy.climate;
  return c === "boom" ? 1 + 0.08 * kind.cyclical : c === "recession" ? 1 - 0.13 * kind.cyclical : 1;
}

/** The owner's hands-on labour, in units of one full-time worker. */
export function ownerLabour(p: PlayerState, b: Business): number {
  if (p.isInPrison) return 0;
  const effortMult = p.effort === "grind" ? 1.1 : p.effort === "coast" ? 0.65 : 1;
  const ability = clamp(0.9 + (p.smarts - 50) / 250, 0.7, 1.2);
  const strain = Math.max(0, b.locations - 1);
  if (b.manager && b.passive) return 0.05;
  if (b.manager) return 0.15 * effortMult;
  // Older saves could hold a job and a business at once: the business only gets the owner's spare hours.
  const moonlight = p.currentJob ? 0.4 : 1;
  return Math.max(0.25, 1 - 0.2 * strain) * effortMult * ability * moonlight;
}

export function managerLabour(b: Business): number {
  if (!b.manager) return 0;
  const strain = Math.max(0, b.locations - 1);
  return (0.55 + (0.4 * b.manager.skill) / 100) * Math.max(0.6, 1 - 0.04 * strain);
}

export const staffProductivity = (b: Business) => (0.78 + (0.22 * b.morale) / 100) * (0.85 + (0.3 * b.training) / 100);

// ---------------------------------------------------------------------------
// Key people, rivals and industry shifts (pure helpers; the actions live in businessPeople.ts / businessMarket.ts)
// ---------------------------------------------------------------------------

export const keyOf = (b: Business, role: KeyRole): KeyPerson | undefined => b.team.find((t) => t.role === role);
export const teamWages = (b: Business) => b.team.reduce((s, t) => s + t.wage, 0);
/** Labour a named key employee adds (each is worth about one hired hand, a bit more for the skilled). */
export const teamLabour = (b: Business) => b.team.reduce((s, t) => s + staffProductivity(b) * (0.9 + t.skill / 500), 0);
export const keySkill = (b: Business, role: KeyRole) => keyOf(b, role)?.skill ?? 0;

/**
 * How hard the named rivals are pulling customers away. Each kind attacks a different weakness: discounters hurt
 * mid-priced shops, premium rivals hurt anyone with mediocre quality, chains hurt unknown names.
 */
export function rivalPull(b: Business): { customers: number; margin: number } {
  let customers = 0;
  let margin = 0;
  for (const r of b.rivals) {
    let m = 1;
    if (r.kind === "discounter") {
      m = b.price === 0 ? 0.7 : b.price === 2 ? 0.6 : 1.4;
      margin += 0.012 * (r.strength / 50) * (b.price === 0 ? 1.3 : 1);
    } else if (r.kind === "premium") m = b.quality < 55 ? 1.4 : 0.6;
    else if (r.kind === "chain") m = b.reputation < 50 ? 1.4 : 0.8;
    customers += r.strength * 0.07 * m;
  }
  return { customers: Math.min(14, customers), margin: Math.min(0.04, margin) };
}

/** This year's swing from a running industry shift (leaning in boosts a tailwind, bracing softens a headwind). */
export function shiftEffect(b: Business): { demand: number; cost: number } {
  const s = b.shift;
  if (!s) return { demand: 0, cost: 0 };
  const up = s.demand >= 0;
  const k = s.responded ? (up ? 1.6 : 0.5) : 1;
  return { demand: s.demand * k, cost: s.cost * (s.responded ? (s.cost >= 0 ? 0.5 : 1.6) : 1) };
}

export function capacityOf(p: PlayerState, b: Business): number {
  const k = kindOf(b);
  const units = (ownerLabour(p, b) + managerLabour(b) + b.staff * staffProductivity(b) + teamLabour(b)) * (1 + 0.06 * keySkill(b, "ops") / 100);
  return units / (k.ideal * b.locations);
}

/** Headcount that maximises next year's expected operating profit (hiring only pays while demand needs the capacity). */
export function recommendedStaff(p: PlayerState, b: Business): number {
  const k = kindOf(b);
  const limit = k.maxStaff * b.locations;
  let best = 0;
  let bestOp = -Infinity;
  for (let n = 0; n <= limit; n++) {
    const op = stepYear(p, { ...b, staff: n }, NO_SHOCKS).pnl.operating;
    if (op > bestOp + 500) {
      bestOp = op;
      best = n;
    } else if (n > best + 2) break;
  }
  return best;
}

export function marketingEffect(stock: number) {
  return 22 * (1 - Math.exp(-stock / 1.2));
}

/** How much the owner's personal presence (or a manager's) helps or hurts winning customers. */
export function presence(p: PlayerState, b: Business): number {
  if (b.manager && b.passive) return -0.14 + (b.manager.skill - 50) / 400;
  if (b.manager) return -0.1 + (b.manager.skill - 50) / 400;
  if (p.isInPrison) return -0.45;
  return p.effort === "coast" ? -0.25 : p.effort === "grind" ? 0.04 : 0;
}

/** Where the customer base is heading. */
export function customerTarget(p: PlayerState, b: Business, fit = b.fit): number {
  const k = kindOf(b);
  // Premium prices only sell on the back of reputation and quality; discounts buy volume.
  const priceT = b.price === 0 ? 12 : b.price === 2 ? clamp(-20 + 0.35 * (b.reputation - 50) + 0.3 * (b.quality - 50), -20, -3) : 0;
  let t = (55 + 0.45 * (b.reputation - 50) + 0.25 * (b.quality - 50) + marketingEffect(b.marketing) - 10 + 0.1 * (p.smarts - 50) + priceT) * fit;
  t *= 1 - 0.003 * (b.competition - 30);
  t *= 1 + k.ownerDep * presence(p, b);
  if (b.facility < 35) t -= (6 * (35 - b.facility)) / 35;
  const sales = keyOf(b, "sales");
  if (sales) t += 2.5 + (sales.skill - 50) * 0.12;
  if (b.franchisor) t += 4;
  t -= rivalPull(b).customers;
  return clamp(t, 3, 100);
}

export function stepYear(p: PlayerState, b: Business, sh: Shocks, fitOverride?: number): YearStep {
  const k = kindOf(b);
  const fit = fitOverride ?? b.fit;
  const locs = b.locations;
  const prison = p.isInPrison;
  const mgr = b.manager;
  const eff = p.effort;
  const cap = capacityOf(p, b);

  // --- customers ---
  const target = customerTarget(p, b, fit);
  const c0 = b.customers;
  const c1 = clamp(c0 + (target - c0) * (target >= c0 ? k.ramp : Math.max(k.ramp, 0.4)), 1, 100);
  const dem = clamp((c0 + c1) / 2 / 55, 0.05, 1.7);

  // --- revenue ---
  const sales = Math.min(dem, 1.1 * cap);
  const climate = climateFactor(p, k);
  // Units sold are valued at the market price; the price decision scales revenue but not the cost of those units.
  const shift = shiftEffect(b);
  const units = k.baseRev * locs * sales * (1 + sh.demand + shift.demand) * climate * (1 + b.boost) * (1 + 0.05 * b.diversified);
  const core = units * PRICE_MULT[b.price];
  const royalties = b.franchises * (k.franchise?.royalty ?? 0) * (0.5 + b.reputation / 100) * clamp(climate, 0.85, 1.1);
  const revenue = Math.max(0, core);

  // --- costs ---
  const gm = clamp(k.margin - 0.002 * (b.quality - 50) - 0.0012 * (b.competition - 40) - rivalPull(b).margin + (keySkill(b, "ops") > 0 ? (keySkill(b, "ops") - 50) * 0.0006 : 0) + (b.franchisor ? 0.02 : 0), 0.1, 0.95);
  const cogs = Math.max(0, units) * (1 - gm) * (1 + sh.cost + shift.cost);
  const fixed = k.fixed * locs;
  const wages = b.staff * k.wage;
  const manager = mgr?.wage ?? 0;
  const keyStaff = teamWages(b);
  const franchisor = b.franchisor ? revenue * (b.franchisor.royalty + b.franchisor.adFund) : 0;
  const marketing = Math.max(k.mktNeed * revenue * (b.franchisor ? 0.5 : 1), 2_000 * locs);
  const insurance = b.insurance > 0 ? Math.max(INS_RATE[b.insurance] * revenue, 800 * locs * b.insurance) : 0;
  const upkeep = k.upkeep * k.cost * locs;
  const loss = sh.incident * revenue;
  const incidentNet = loss - INS_COVER[b.insurance] * Math.max(0, loss - 0.01 * revenue);
  const operating = revenue + royalties * 0.9 - cogs - fixed - wages - manager - keyStaff - franchisor - marketing - insurance - upkeep - incidentNet;

  // --- soft state ---
  const neglected = !mgr && (prison || eff === "coast");
  const neglect = neglected ? b.neglect + 1 : Math.max(0, b.neglect - 1);
  const supervision = (mgr ? (mgr.skill - 50) * 0.15 : prison ? -8 : eff === "grind" ? 3 : eff === "coast" ? -8 : 0) - (b.passive ? 2 : 0);
  const craft = keyOf(b, "craft");
  const craftQ = craft ? (craft.skill - 50) * 0.5 : 0;
  const service = (b.morale - 50) * 0.12 + (b.training - 50) * 0.08;
  const under = cap < 0.75 ? (0.75 - cap) * 35 : 0;
  const neglectPen = Math.min(18, neglect * 5);
  const stretched = !mgr && locs > 1 ? 4 * (locs - 1) : 0;
  const priceRepPen = b.price === 2 ? Math.max(0, 60 - b.quality) * 0.15 : 0;
  const repTarget = clamp(22 + 0.62 * b.quality + (craft ? (craft.skill - 50) * 0.1 : 0) + service + supervision - under - neglectPen - priceRepPen - stretched + (b.facility < 40 ? -6 : 0), 5, 98);
  const reputation = clamp(b.reputation + (repTarget > b.reputation ? 0.2 : 0.4) * (repTarget - b.reputation), 0, 100);
  const qBase = 28 + 0.3 * b.training + 0.22 * b.facility + 5 * b.upgrades + craftQ + (mgr ? (mgr.skill - 50) * 0.15 : prison ? -8 : eff === "grind" ? 3 : eff === "coast" ? -8 : 0);
  const quality = clamp(b.quality + 0.3 * (qBase - b.quality), 0, 100);
  const overwork = cap < 0.8 ? (0.8 - cap) * 25 : 0;
  const mBase = 58 + (mgr ? (mgr.skill - 50) * 0.15 : eff === "grind" ? -3 : eff === "coast" ? -2 : 0) - overwork - neglectPen * 0.8 + 0.1 * (b.training - 30);
  const morale = clamp(b.morale + 0.35 * (mBase - b.morale), 0, 100);

  return {
    pnl: { revenue: Math.round(revenue), royalties: Math.round(royalties), cogs: Math.round(cogs), fixed, wages, manager, keyStaff, franchisor: Math.round(franchisor), marketing: Math.round(marketing), insurance: Math.round(insurance), upkeep, incidentNet: Math.round(incidentNet), operating: Math.round(operating) },
    capacity: cap,
    demand: dem,
    next: {
      customers: c1,
      reputation,
      quality,
      morale,
      training: b.training * 0.85,
      facility: clamp(b.facility - 6, 0, 100),
      competition: b.competition,
      marketing: (b.marketing + 0.9) * 0.55,
      neglect,
    },
  };
}

// ---------------------------------------------------------------------------
// Valuation & finance
// ---------------------------------------------------------------------------

export function normalizedEarnings(b: Business): number {
  const h = b.history.slice(-3).reverse();
  if (h.length === 0) return 0;
  const w = [0.5, 0.3, 0.2].slice(0, h.length);
  const total = w.reduce((s, x) => s + x, 0);
  return h.reduce((s, r, i) => s + r.profit * (w[i] / total), 0) + b.debt * b.loanRate;
}

export function revenueGrowth(b: Business): number {
  const h = b.history;
  if (h.length < 2) return h.length === 1 && h[0].revenue > 0 ? 1 : 0;
  const prev = h[h.length - 2].revenue;
  return prev > 0 ? h[h.length - 1].revenue / prev - 1 : 1;
}

/** What a buyer would pay for the whole operation, before cash and debt. */
export function enterpriseValue(b: Business): number {
  const k = kindOf(b);
  const years = b.history.length;
  const repF = clamp(b.reputation / 100, 0, 1);
  const mult = k.mult[0] + (k.mult[1] - k.mult[0]) * repF;
  const keyPerson = 1 - k.ownerDep * (b.manager ? 0.08 : 0.38);
  const earnings = Math.max(0, normalizedEarnings(b));
  const proven = years >= 3 ? 1 : years === 2 ? 0.85 : 0.6;
  const earnV = earnings * mult * keyPerson * proven;
  const revV = k.revMult > 0 && years >= 1 ? b.revenue * k.revMult * clamp(revenueGrowth(b), 0, 1.2) * (0.4 + repF) * keyPerson : 0;
  const floor = b.assets * (0.6 + (0.4 * b.facility) / 100);
  return Math.round(Math.max(earnV, revV, floor));
}

export const equityOf = (b: Business) => enterpriseValue(b) + b.cash - b.debt;

/**
 * What the owner receives out of a given whole-company equity value. Without preferred investors this is simply
 * `equity x ownerShare`. A venture investor with a 1x preference is paid back first when the company sells for less
 * than their price (they convert to ordinary shares when that is worth more), which squeezes the founder in a weak exit.
 */
export function ownerProceeds(b: Business, equity: number): number {
  if (equity <= 0) return 0;
  const outside = b.investors ?? [];
  let rest = equity;
  let takenShare = 0;
  for (const i of outside) {
    if (!i.pref || i.invested <= 0) continue;
    if (i.share * equity < i.invested) {
      const take = Math.min(i.invested, rest);
      rest -= take;
      takenShare += i.share;
    }
  }
  const pool = Math.max(0, 1 - takenShare);
  return Math.max(0, Math.round(pool > 0 ? (rest * b.ownerShare) / pool : 0));
}

/** The owner's stake (what net worth counts). */
export function stakeValue(b: Business): number {
  return ownerProceeds(b, equityOf(b));
}

export function marketMood(p: PlayerState): number {
  return p.economy.climate === "boom" ? 1.08 : p.economy.climate === "recession" ? 0.88 : 1;
}

export function exitTax(countryName: string, gain: number): number {
  if (gain <= 0) return 0;
  const avg = incomeTaxFor(countryName, gain) / gain;
  return Math.round(gain * clamp(avg * 0.75, 0.1, 0.3));
}

export interface SaleQuote {
  /** Price for the whole company, before cash and debt. */
  enterprise: number;
  equity: number;
  gross: number;
  fee: number;
  tax: number;
  net: number;
  multiple: number;
}

export function saleQuote(p: PlayerState, b: Business, factor = 1, premium = 1): SaleQuote {
  // A franchisor must approve the buyer and takes a transfer fee.
  const ev = Math.round(enterpriseValue(b) * marketMood(p) * factor * premium * (b.franchisor ? 0.95 : 1));
  const equity = ev + b.cash - b.debt;
  const gross = ownerProceeds(b, equity);
  const fee = Math.round(gross * SALE_FEE);
  const tax = exitTax(p.residence.country, gross - fee - b.basis);
  const earn = normalizedEarnings(b);
  return { enterprise: ev, equity, gross, fee, tax, net: gross - fee - tax, multiple: earn > 0 ? ev / earn : 0 };
}

export function liquidationValue(b: Business): number {
  const k = kindOf(b);
  return Math.round(b.assets * k.assetRatio * (0.4 + (0.6 * b.facility) / 100));
}

export function loanLimit(p: PlayerState, b: Business): number {
  const k = kindOf(b);
  const h = b.history.slice(-2);
  const avg = h.length ? h.reduce((s, r) => s + r.profit, 0) / h.length + b.debt * b.loanRate : 0;
  const collateral = b.assets * k.assetRatio * 0.9 * (0.5 + (0.5 * b.facility) / 100);
  const creditF = clamp((p.creditScore - 480) / 220, 0.15, 1.2);
  const climateF = p.economy.climate === "recession" ? 0.65 : p.economy.climate === "boom" ? 1.1 : 1;
  const repF = 0.7 + b.reputation / 200;
  const lim = (collateral + Math.max(0, avg) * 2.5) * creditF * climateF * repF - b.debt;
  return Math.max(0, Math.floor(lim / 1000) * 1000);
}

export function loanRateFor(p: PlayerState, b: Business): number {
  return clamp(0.055 + Math.max(0, 700 - p.creditScore) / 2200 + (b.reputation < 40 ? 0.02 : 0) + (p.economy.climate === "recession" ? 0.01 : 0), 0.05, 0.17);
}

// ---------------------------------------------------------------------------
// Dashboard projections
// ---------------------------------------------------------------------------

export interface Range {
  low: number;
  mid: number;
  high: number;
}

export interface Forecast {
  revenue: Range;
  /** Profit after interest, before tax. */
  profit: Range;
  /** Share of demand the team can serve. */
  capacity: number;
  /** Expected demand as a share of what a fully staffed location could serve. */
  demand: number;
  recommendedStaff: number;
  debtService: number;
  /** Years the cash lasts at the pessimistic burn, or null if profitable. */
  runway: number | null;
  /** Rough chance of failing within three years, from an informal risk model. */
  failureRisk: number;
}

export function forecast(p: PlayerState, b: Business): Forecast {
  const k = kindOf(b);
  const years = b.history.length;
  const w = Math.min(1, years / 3);
  const believed = b.fit * w + 1 * (1 - w);
  const spread = 0.12 + 0.3 * (1 - w) + (k.revMult > 0 ? 0.25 : 0);
  const sigma = k.vol * (1 - 0.12 * b.diversified);
  const interest = b.debt * b.loanRate;
  const scen = (fit: number, sh: Shocks): { revenue: number; profit: number; demand: number } => {
    const s = stepYear(p, b, sh, fit);
    return { revenue: s.pnl.revenue + s.pnl.royalties, profit: s.pnl.operating - interest, demand: s.demand };
  };
  const low = scen(believed * (1 - spread), { demand: -1.2 * sigma, cost: 0.06, incident: 0.2 * k.hazard });
  const mid = scen(believed, NO_SHOCKS);
  const high = scen(believed * (1 + spread * 0.8), { demand: 1 * sigma, cost: -0.03, incident: 0 });
  const principal = Math.round(b.debt * 0.1);
  const burn = -low.profit + principal;
  const runway = burn > 0 ? Math.max(0, b.cash / burn) : null;
  const cap = capacityOf(p, b);
  const failureRisk = clamp(0.05 + (low.profit < 0 ? 0.15 : 0) + (mid.profit < 0 ? 0.25 : 0) + (runway !== null && runway < 1 ? 0.2 : 0) + (b.debt > 0 && b.cash < b.debt * 0.1 ? 0.05 : 0), 0.02, 0.9);
  return {
    revenue: { low: low.revenue, mid: mid.revenue, high: high.revenue },
    profit: { low: low.profit, mid: mid.profit, high: high.profit },
    capacity: cap,
    demand: mid.demand,
    recommendedStaff: recommendedStaff(p, b),
    debtService: Math.round(interest + principal),
    runway,
    failureRisk,
  };
}

/** Plain-language flags that explain what is likely to hurt the business. */
export function riskNotes(p: PlayerState, b: Business): string[] {
  const k = kindOf(b);
  const notes: string[] = [];
  const cap = capacityOf(p, b);
  if (cap < 0.75) notes.push(`Understaffed: you can only serve about ${Math.round(cap * 100)}% of demand, and staff are overworked.`);
  if (!b.manager && (p.effort === "coast" || p.isInPrison)) notes.push("Nobody is minding the shop. Quality, morale and reputation will decay until you step up or hire a manager.");
  if (b.neglect >= 1) notes.push(`Neglect is building (${b.neglect} year${b.neglect > 1 ? "s" : ""}). It costs reputation every year it continues.`);
  if (b.cash < 0.2 * (k.fixed * b.locations + b.staff * k.wage + (b.manager?.wage ?? 0))) notes.push("Thin cash cushion. A bad year could force an emergency loan or a rescue from your savings.");
  if (b.debt > 0 && b.covenantBreaches > 0) notes.push("Your lender is watching you: another weak year could trigger a loan call.");
  if (b.facility < 40) notes.push("The premises are run down. Customers notice, and inspectors will too.");
  if (b.insurance === 0 && k.hazard >= 0.8) notes.push(`${k.name}s are exposed to costly incidents and you are uninsured.`);
  if (b.morale < 35) notes.push("Staff morale is dangerously low. Expect resignations, mistakes or a strike.");
  if (b.competition > 70) notes.push("Competition is fierce in your market.");
  if (p.economy.climate === "recession" && k.cyclical >= 1) notes.push("The recession hits your sector harder than most.");
  if (b.price === 2 && b.quality < 55) notes.push("Premium prices without premium quality will drive customers away.");
  if (b.ownerShare < 1) notes.push(`Investors own ${Math.round((1 - b.ownerShare) * 100)}% of the company and share every payout and exit.`);
  return notes;
}

/** Rough profit range for a business of this type once established (years 3+), for the "start a business" list. */
export function typicalOutlook(kind: BusinessType, p: PlayerState, franchise = false): Range {
  const proto = (franchise ? newFranchise(kind, "", p.year, makeRng(1)) : null) ?? newBusiness(kind, "", p.year, makeRng(1));
  const fits = franchise ? [0.9, 1, 1.1] : [0.65, 0.92, 1.2];
  proto.customers = 55;
  proto.reputation = 50;
  proto.quality = 50;
  proto.marketing = 1.1;
  proto.facility = 70;
  const at = (fit: number, sh: Shocks) => {
    const b = { ...proto, fit };
    const staff = recommendedStaff(p, b);
    return stepYear(p, { ...b, staff }, sh).pnl.operating;
  };
  return {
    low: at(fits[0], { demand: -1.2 * kind.vol, cost: 0.06, incident: 0 }),
    mid: at(fits[1], NO_SHOCKS),
    high: at(fits[2], { demand: kind.vol, cost: -0.03, incident: 0 }),
  };
}

export interface Health {
  label: string;
  tone: "green" | "amber" | "red" | "blue" | "slate";
}

export function businessHealth(p: PlayerState, b: Business): Health {
  if (b.history.length === 0) return { label: "New venture", tone: "blue" };
  const f = forecast(p, b);
  if (f.failureRisk >= 0.5) return { label: "Distressed", tone: "red" };
  if (f.failureRisk >= 0.3 || b.lastProfit < 0) return { label: "At risk", tone: "amber" };
  if (b.lastProfit > 0 && f.failureRisk < 0.2) return { label: "Healthy", tone: "green" };
  return { label: "Fragile", tone: "slate" };
}
