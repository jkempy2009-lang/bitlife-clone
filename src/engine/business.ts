/**
 * Entrepreneurship: running a company is a full-time commitment with real economics.
 *
 * - `businessModel.ts` holds the pure math (revenue, costs, valuation, loan limits, projections).
 * - This file holds the player's decisions (each an `ActionResult` action), the yearly transaction
 *   (`processBusiness`, called from Age Up), exits (sale, closure, bankruptcy, acquisition, IPO) and inheritance.
 *
 * Money model: the business has its own cash and debt, separate from the owner's savings. The owner is paid through
 * draws (`payout` policy), which is the only thing that reaches personal taxable income. Profit is taxed at the
 * company level (15%) and draws are then taxed as personal income. Exit proceeds above the owner's invested capital
 * are taxed at a capital-gains-like rate (see `exitTax`).
 */
import type { ActionResult, Business, BusinessPayout, PlayerState } from "@/types/game.types";
import { hashString, makeRng, type Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { BUSINESS_BY_ID, BUSINESS_TYPES, type BusinessType } from "@/data/businessTypes";
import { addLog, changeStat, clearFlag, clone, isRoyal, setFlag } from "./state";
import { blockerFor } from "./occupation";
import {
  CORP_TAX,
  OVERDRAFT_RATE,
  PAYOUT_SHARE,
  capacityOf,
  drawFit,
  ensureBusiness,
  equityOf,
  exitTax,
  gauss,
  kindOf,
  liquidationValue,
  loanLimit,
  loanRateFor,
  newBusiness,
  revenueGrowth,
  saleQuote,
  stakeValue,
  stepYear,
  type SaleQuote,
  type Shocks,
} from "./businessModel";

export { BUSINESS_TYPES, BUSINESS_BY_ID };
export type { BusinessType };
export {
  forecast, riskNotes, saleQuote, loanLimit, loanRateFor, kindOf, capacityOf, enterpriseValue, equityOf, stakeValue, liquidationValue,
  normalizedEarnings, recommendedStaff, typicalOutlook, businessHealth, PRICE_LABELS, PAYOUT_LABELS, INSURANCE_LABELS, CORP_TAX, SALE_FEE, PAYOUT_SHARE, marketMood, exitTax,
} from "./businessModel";

type Notices = NonNullable<ActionResult["notices"]>;
type Tone = "good" | "bad" | "neutral" | "jackpot";
const info = (title: string, body: string, tone: Tone = "neutral") => ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Constants kept for older callers
// ---------------------------------------------------------------------------

/** Typical pay for a hired hand (the real wage depends on the business type). */
export const STAFF_SALARY = 12_000;
/** Minimum cost of a marketing campaign (larger businesses pay more). */
export const MARKETING_COST = 10_000;
export const MAX_LOCATIONS = 4;
export const maxStaff = (locations: number, kindId?: string) => {
  const k = kindId ? BUSINESS_BY_ID[kindId] : undefined;
  return (k?.maxStaff ?? 10) * locations;
};

/** Years after a bankruptcy during which you can't found another company. */
export const COOLOFF_YEARS = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const unitCost = (k: BusinessType, b: Business) => k.cost * b.locations;
const reserveOf = (b: Business) => {
  const k = kindOf(b);
  return 0.25 * (k.fixed * b.locations + b.staff * k.wage + (b.manager?.wage ?? 0));
};
const scale = (b: Business) => {
  const k = kindOf(b);
  return Math.max(k.baseRev * b.locations * 0.4, b.revenue);
};

function refresh(b: Business) {
  b.value = stakeValue(b);
  b.reputation = Math.round(clamp(b.reputation) * 10) / 10;
}

/**
 * Pay for a decision. Company cash is used while it stays above a small reserve, otherwise the owner's savings,
 * otherwise whatever company cash is left. Capital items paid from savings raise the owner's cost basis.
 */
function spend(p: PlayerState, b: Business, amount: number, capital: boolean): "company" | "savings" | null {
  amount = Math.round(amount);
  let src: "company" | "savings" | null = null;
  if (b.cash - amount >= reserveOf(b)) {
    b.cash -= amount;
    src = "company";
  } else if (p.bankBalance >= amount) {
    p.bankBalance -= amount;
    if (capital) b.basis += amount;
    src = "savings";
  } else if (b.cash >= amount) {
    b.cash -= amount;
    src = "company";
  }
  if (src && !capital) b.ytdSpend += amount;
  return src;
}

const canSpend = (p: PlayerState, b: Business, amount: number) => b.cash >= amount || p.bankBalance >= amount;
const fromWhere = (src: "company" | "savings") => (src === "company" ? "from company cash" : "from your savings");

interface Ctx {
  p: PlayerState;
  b: Business;
  k: BusinessType;
}

/** Common preamble for actions on an existing business. */
function open(p0: PlayerState): Ctx | null {
  if (!p0.business) return null;
  const p = clone(p0);
  const b = ensureBusiness(p.business!);
  return { p, b, k: kindOf(b) };
}

const unchanged = (p0: PlayerState, title: string, body: string, tone: Tone = "neutral"): ActionResult => ({ player: p0, notices: [info(title, body, tone)] });
const poor = (p0: PlayerState, what: string, cost: number): ActionResult => unchanged(p0, "Insufficient Funds", `${what} costs ${money(cost)}. Neither your savings nor the company's cash can cover it.`, "bad");

function done(c: Ctx, title: string, body: string, tone: Tone = "good"): ActionResult {
  refresh(c.b);
  addLog(c.p, body);
  return { player: c.p, notices: [info(title, body, tone)] };
}

/** Costs shown in the UI and charged by actions. */
export function businessCosts(b: Business) {
  const k = kindOf(b);
  return {
    hire: Math.max(1_500, Math.round(k.wage * 0.1)),
    severance: Math.round(k.wage * 0.25),
    train: 3_000 + 1_500 * b.staff,
    marketing: Math.max(4_000, Math.round(0.04 * scale(b))),
    audit: Math.max(3_000, Math.round(0.008 * k.baseRev * b.locations)),
    renovate: Math.round(0.12 * unitCost(k, b)),
    upgrade: Math.round(0.1 * unitCost(k, b) * (1 + 0.25 * b.upgrades)),
    diversify: Math.max(Math.round(0.09 * k.cost), Math.round(0.05 * scale(b))) * (1 + b.diversified),
    pivot: Math.round(0.15 * k.cost),
    acquire: Math.max(40_000, Math.round(0.5 * scale(b))),
    expand: Math.round(k.cost * 0.9 * (1 + 0.15 * (b.locations - 1))),
    managerFee: { solid: Math.round(k.mgrWage * 0.2), star: Math.round(k.mgrWage * 1.5 * 0.2) },
    managerWage: { solid: k.mgrWage, star: Math.round(k.mgrWage * 1.5) },
    managerSeverance: Math.round((b.manager?.wage ?? 0) * 0.5),
  };
}

// ---------------------------------------------------------------------------
// Founding
// ---------------------------------------------------------------------------

export function startBusiness(p0: PlayerState, kindId: string, name: string, rng?: Rng): ActionResult {
  const p = clone(p0);
  const kind = BUSINESS_BY_ID[kindId];
  if (!kind) return { player: p0 };
  if (p.business) return { player: p0, notices: [info("One Empire at a Time", "Sell or close your current business first.")] };
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You must be 18 to incorporate a business.", "bad")] };
  if (isRoyal(p)) return { player: p0, notices: [info("Beneath You", "Royals can't run commercial ventures.", "bad")] };
  if (p.isInPrison) return { player: p0, notices: [info("Locked Up", "Hard to run a business from a cell.", "bad")] };
  const blocked = blockerFor(p, "business");
  if (blocked) return { player: p0, notices: [info("Can't Start a Business", blocked, "bad")] };
  if (p.smarts < kind.minSmarts) return { player: p0, notices: [info("Not Ready", `Running a ${kind.name.toLowerCase()} needs ${kind.minSmarts}+ Smarts.`, "bad")] };
  if (kind.skill && p.skills[kind.skill.key] < kind.skill.min) return { player: p0, notices: [info("Not Ready", `A ${kind.name.toLowerCase()} needs ${kind.skill.min}+ ${kind.skill.label}.`, "bad")] };
  if (p.bankBalance < kind.cost) return { player: p0, notices: [info("Insufficient Funds", `You need ${money(kind.cost)} in cash to open a ${kind.name.toLowerCase()}.`, "bad")] };
  const r = rng ?? makeRng(hashString(`${p.firstName}${p.lastName}${p.year}${kindId}${name}`));
  p.bankBalance -= kind.cost;
  const label = name.trim() || `${p.lastName} ${kind.name}`;
  p.business = newBusiness(kind, label, p.year, r);
  p.business.value = stakeValue(p.business);
  setFlag(p, "business_owner");
  changeStat(p, "happiness", 8);
  const body = `You opened "${label}" with ${money(kind.cost)} of your own capital (${money(p.business.cash)} working cash, the rest premises and equipment). Now you need staff, customers and a bit of luck.`;
  addLog(p, body);
  return { player: p, notices: [info("Business Launched", body, "good")] };
}

// ---------------------------------------------------------------------------
// Owner commitment
// ---------------------------------------------------------------------------

/** A one-off sprint on top of your normal effort setting. */
export function workOnBusiness(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  if (c.b.manager) return unchanged(p0, "Delegated", `${c.b.manager.name} runs the day-to-day. Fire them or step in by dropping the manager if you want to work the floor yourself.`);
  if ((c.p.annual.bizwork ?? 0) >= 1) return unchanged(p0, "Already Hustling", "You've already put in the extra hours this year.");
  c.p.annual.bizwork = 1;
  c.b.boost += 0.06;
  changeStat(c.p, "happiness", -2);
  changeStat(c.p, "health", -1);
  return done(c, "Crunch Time", `You worked a punishing sprint on ${c.b.name}. Revenue should get a small lift this year. It stacks with your effort setting and costs health.`);
}

export function hireManager(p0: PlayerState, rng: Rng, tier: "solid" | "star" = "solid"): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  if (c.b.manager) return unchanged(p0, "Already Managed", `${c.b.manager.name} is already your general manager.`);
  const costs = businessCosts(c.b);
  const fee = costs.managerFee[tier];
  if (!canSpend(c.p, c.b, fee)) return poor(p0, "A search firm's fee", fee);
  const src = spend(c.p, c.b, fee, false)!;
  const skill = tier === "star" ? rng.int(62, 92) : rng.int(38, 68);
  const names = ["Alex", "Jordan", "Morgan", "Sam", "Casey", "Riley", "Taylor", "Quinn", "Robin", "Dana"];
  c.b.manager = { name: `${rng.pick(names)} ${rng.pick(["Reyes", "Okafor", "Lindqvist", "Patel", "Novak", "Haddad", "Brooks", "Tanaka"])}`, skill, wage: costs.managerWage[tier], hired: c.p.year };
  c.b.neglect = 0;
  const body = `You hired ${c.b.manager.name} as general manager at ${money(c.b.manager.wage)} a year (search fee ${money(fee)} ${fromWhere(src)}). They will run the day-to-day, so your effort setting no longer drives the business, grinding no longer costs you, and you can finally take a weekend. Expect somewhat lower profit than a great owner-operator.`;
  return done(c, "General Manager Hired", body);
}

export function fireManager(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c?.b.manager) return { player: p0 };
  const sev = businessCosts(c.b).managerSeverance;
  const name = c.b.manager.name;
  if (!spend(c.p, c.b, sev, false)) c.b.cash -= sev;
  c.b.manager = null;
  c.b.morale = clamp(c.b.morale - 6);
  return done(c, "Manager Let Go", `You parted ways with ${name} (severance ${money(sev)}). You're running ${c.b.name} yourself again.`, "neutral");
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export function hireStaff(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b, k } = c;
  if (b.staff >= k.maxStaff * b.locations) return unchanged(p0, "Fully Staffed", "You've hit your headcount limit. Open another location to add more.");
  const cost = businessCosts(b).hire;
  if (!canSpend(c.p, b, cost)) return poor(p0, "Recruiting", cost);
  spend(c.p, b, cost, false);
  b.staff += 1;
  b.morale = clamp(b.morale + 2);
  const cap = Math.round(capacityOf(c.p, b) * 100);
  return done(c, "New Hire", `You hired a new employee at ${b.name} for ${money(k.wage)} a year. Headcount: ${b.staff}. You can now serve about ${Math.min(cap, 100)}% of demand.`);
}

export function fireStaff(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c || c.b.staff <= 0) return { player: p0 };
  const { b, k } = c;
  const sev = businessCosts(b).severance;
  if (!spend(c.p, b, sev, false)) b.cash -= sev;
  b.staff -= 1;
  b.morale = clamp(b.morale - (b.staff >= k.ideal * b.locations ? 3 : 8));
  changeStat(c.p, "karma", -1);
  return done(c, "Layoff", `You let someone go at ${b.name} (severance ${money(sev)}). Headcount: ${b.staff}. The rest of the team is nervous.`, "neutral");
}

export function trainStaff(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b } = c;
  if (b.staff + (b.manager ? 1 : 0) <= 0) return unchanged(p0, "Nobody to Train", "Hire someone first.");
  if ((c.p.annual.biztrain ?? 0) >= 1) return unchanged(p0, "Training Done", "One training programme per year.");
  const cost = businessCosts(b).train;
  if (!canSpend(c.p, b, cost)) return poor(p0, "A training programme", cost);
  spend(c.p, b, cost, false);
  c.p.annual.biztrain = 1;
  b.training = clamp(b.training + 28);
  b.morale = clamp(b.morale + 4);
  return done(c, "Staff Trained", `You invested ${money(cost)} in training. Service quality and morale improve, though training fades without reinforcement.`);
}

// ---------------------------------------------------------------------------
// Market-facing decisions
// ---------------------------------------------------------------------------

export function runMarketing(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b } = c;
  const cost = businessCosts(b).marketing;
  if ((c.p.annual.marketing ?? 0) >= 1) return unchanged(p0, "Campaign Running", "One marketing push per year.");
  if (!canSpend(c.p, b, cost)) return poor(p0, "A campaign", cost);
  spend(c.p, b, cost, false);
  c.p.annual.marketing = 1;
  const saturated = b.marketing > 2.2;
  b.marketing += 1;
  b.boost += saturated ? 0.025 : 0.05;
  return done(c, "Marketing Push", `A new campaign for ${b.name} is live (${money(cost)}). ${saturated ? "Your market is already saturated with your ads, so returns are diminishing." : "Expect a modest bump in customers and revenue."}`);
}

export function setPrice(p0: PlayerState, level: number): ActionResult {
  const c = open(p0);
  if (!c || level === c.b.price || level < 0 || level > 2) return { player: p0 };
  if ((c.p.annual.bizprice ?? 0) >= 1) return unchanged(p0, "Prices Just Changed", "Changing prices more than once a year confuses customers.");
  c.p.annual.bizprice = 1;
  c.b.price = level;
  const txt = ["Budget pricing: more customers, thinner margins, a cheaper image.", "Market pricing: the safe middle.", "Premium pricing: better margins, but only if quality and reputation back it up. Fewer customers will pay."][level];
  return done(c, "Pricing Changed", `${c.b.name} now charges ${["budget", "market", "premium"][level]} prices. ${txt}`, "neutral");
}

export function setPayout(p0: PlayerState, mode: BusinessPayout): ActionResult {
  const c = open(p0);
  if (!c || c.b.payout === mode) return { player: p0 };
  c.b.payout = mode;
  const txt = { reinvest: "No payouts. Every dollar stays in the company, and you live off savings.", balanced: "About half of spare profit goes to you; the rest builds a cushion.", salary: "Most spare profit goes to you, leaving little for growth or bad years." }[mode];
  return done(c, "Payout Policy", `Payout set to ${mode}. ${txt}`, "neutral");
}

export function setInsurance(p0: PlayerState, level: number): ActionResult {
  const c = open(p0);
  if (!c || level === c.b.insurance || level < 0 || level > 2) return { player: p0 };
  c.b.insurance = level;
  const txt = ["Uninsured: you eat every incident yourself.", "Basic cover absorbs about 60% of large losses for roughly 0.5% of revenue.", "Comprehensive cover absorbs about 90% of large losses for roughly 1.4% of revenue."][level];
  return done(c, "Insurance Changed", txt, "neutral");
}

export function setRescue(p0: PlayerState, on: boolean): ActionResult {
  const c = open(p0);
  if (!c || c.b.rescue === on) return { player: p0 };
  c.b.rescue = on;
  return done(c, "Safety Net", on ? "If the company runs out of cash, you will automatically cover the gap from your savings." : "You will no longer bail the company out with your own savings. If it runs dry, it goes under.", "neutral");
}

export function complianceAudit(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  if ((c.p.annual.bizaudit ?? 0) >= 1) return unchanged(p0, "Already Audited", "One compliance review per year.");
  const cost = businessCosts(c.b).audit;
  if (!canSpend(c.p, c.b, cost)) return poor(p0, "A compliance review", cost);
  spend(c.p, c.b, cost, false);
  c.p.annual.bizaudit = 1;
  c.b.compliance = clamp(c.b.compliance + 30);
  return done(c, "Compliance Review", `A consultant overhauled safety, payroll and paperwork for ${money(cost)}. Incidents, fraud, inspections and audits all become less likely and less costly, until the effect fades.`);
}

export function renovateBusiness(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const cost = businessCosts(c.b).renovate;
  if (c.b.facility >= 85) return unchanged(p0, "Looks Fine", "The premises are in good shape already.");
  if (!canSpend(c.p, c.b, cost)) return poor(p0, "A renovation", cost);
  spend(c.p, c.b, cost, true);
  c.b.facility = clamp(c.b.facility + 50);
  c.b.assets += Math.round(cost * 0.6);
  c.b.morale = clamp(c.b.morale + 3);
  return done(c, "Renovated", `${c.b.name} reopened after a ${money(cost)} refit. Customers notice, staff are happier, and inspectors have less to say.`);
}

export function upgradeProduct(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  if (c.b.upgrades >= 5) return unchanged(p0, "Best in Class", "You can't meaningfully improve the product further.");
  const cost = businessCosts(c.b).upgrade;
  if (!canSpend(c.p, c.b, cost)) return poor(p0, "An upgrade", cost);
  spend(c.p, c.b, cost, true);
  c.b.upgrades += 1;
  c.b.quality = clamp(c.b.quality + 8);
  c.b.assets += Math.round(cost * 0.4);
  return done(c, "Product Upgrade", `You invested ${money(cost)} in better equipment and ingredients (level ${c.b.upgrades}/5). Quality rises, reputation follows slowly, and unit costs creep up.`);
}

export function diversifyBusiness(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  if (c.b.diversified >= 2) return unchanged(p0, "Diversified Enough", "You already run several product lines.");
  const cost = businessCosts(c.b).diversify;
  if (!canSpend(c.p, c.b, cost)) return poor(p0, "A new product line", cost);
  spend(c.p, c.b, cost, true);
  c.b.diversified += 1;
  c.b.assets += Math.round(cost * 0.5);
  c.b.morale = clamp(c.b.morale - 2);
  return done(c, "Diversified", `A new product line launched at ${c.b.name} (${money(cost)}). Revenue gets a small lift and yearly swings in demand are damped, but management attention is stretched.`);
}

export function pivotBusiness(p0: PlayerState, rng: Rng): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b, k } = c;
  if (c.p.year - b.lastPivot < 3) return unchanged(p0, "Too Soon", "Customers need time to understand what you've become. Wait a few years between pivots.");
  const cost = businessCosts(b).pivot;
  if (!canSpend(c.p, b, cost)) return poor(p0, "A pivot", cost);
  spend(c.p, b, cost, false);
  const old = b.fit;
  b.fit = clamp(0.5 * b.fit + 0.5 * (drawFit(k, rng) + 0.08), 0.35, 1.8);
  b.reputation = Math.round(b.reputation * 0.75);
  b.customers = Math.round(b.customers * 0.7);
  b.morale = clamp(b.morale - 5);
  b.marketing += 1;
  b.lastPivot = c.p.year;
  b.competition = clamp(k.competition + rng.int(-15, 10), 5, 95);
  const better = b.fit > old;
  return done(c, "Pivot", `You rebranded ${b.name} and changed the offer (${money(cost)}). Reputation and customers took a hit. ${better ? "Early signs suggest the new direction fits the market better." : "Early signs are mixed: it may not have fixed the underlying problem."}`, better ? "good" : "neutral");
}

export function acquireCompetitor(p0: PlayerState, rng: Rng): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b } = c;
  if (b.competition < 25) return unchanged(p0, "No Targets", "There are no rivals left worth buying.");
  if ((c.p.annual.bizacquire ?? 0) >= 1) return unchanged(p0, "Already Dealing", "One acquisition per year.");
  const cost = businessCosts(b).acquire;
  if (!canSpend(c.p, b, cost)) return poor(p0, "Buying a rival", cost);
  spend(c.p, b, cost, true);
  c.p.annual.bizacquire = 1;
  b.customers = clamp(b.customers + 10);
  b.competition = clamp(b.competition - 18, 5, 95);
  b.assets += Math.round(cost * 0.3);
  b.reputation = clamp(b.reputation - 2);
  b.morale = clamp(b.morale - 8);
  const clash = rng.chance(b.manager ? 0.2 : 0.35);
  if (clash) {
    b.morale = clamp(b.morale - 10);
    b.staff = Math.max(0, b.staff - 1);
  }
  return done(c, "Rival Acquired", `You bought a competitor for ${money(cost)}, absorbing customers and weakening the local competition. ${clash ? "The merger was messy: a culture clash cost you morale and a key employee." : "Integration went smoothly, if tensely."}`, clash ? "neutral" : "good");
}

export function expandBusiness(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b, k } = c;
  if (b.locations >= k.maxLocations) return unchanged(p0, "Empire Complete", "You already operate the maximum number of locations for this kind of business.");
  const cost = businessCosts(b).expand;
  if (!canSpend(c.p, b, cost)) return poor(p0, "Opening another location", cost);
  spend(c.p, b, cost, true);
  const before = b.locations;
  b.locations += 1;
  b.assets += Math.round(cost * 0.8);
  b.customers = Math.round((b.customers * before + k.startCustomers) / b.locations);
  b.morale = clamp(b.morale - 3);
  const need = k.ideal * b.locations;
  const note = b.manager ? "Your manager will absorb some of the extra load." : "Without a manager, every extra location stretches you thinner. Consider hiring one.";
  return done(c, "Expansion!", `${b.name} opened location #${b.locations} (${money(cost)}). The new site starts with few customers and needs about ${need} labour units in total. ${note}`);
}

// ---------------------------------------------------------------------------
// Financing
// ---------------------------------------------------------------------------

export function investInBusiness(p0: PlayerState, amount: number): ActionResult {
  const c = open(p0);
  amount = Math.round(amount);
  if (!c || amount <= 0 || amount > p0.bankBalance) return { player: p0, notices: [info("Can't Invest", "You don't have that much cash.", "bad")] };
  c.p.bankBalance -= amount;
  c.b.cash += amount;
  c.b.basis += amount;
  return done(c, "Capital Injected", `You put ${money(amount)} of your own money into ${c.b.name}'s bank account. It extends the runway but is not guaranteed to come back: only profits and an eventual sale return it.`);
}

export function takeBusinessLoan(p0: PlayerState, amount: number): ActionResult {
  const c = open(p0);
  amount = Math.round(amount);
  if (!c) return { player: p0 };
  const limit = loanLimit(c.p, c.b);
  if (amount <= 0) return { player: p0 };
  if (amount > limit) {
    return unchanged(p0, "Loan Declined", limit > 0 ? `The bank will lend ${c.b.name} at most ${money(limit)} right now, based on its profits, collateral and your credit.` : `The bank won't lend to ${c.b.name} right now. Lenders want profits and collateral, and a track record.`, "bad");
  }
  const rate = loanRateFor(c.p, c.b);
  c.b.loanRate = Math.round(((c.b.debt * c.b.loanRate + amount * rate) / (c.b.debt + amount)) * 1000) / 1000;
  c.b.debt += amount;
  c.b.cash += amount;
  return done(c, "Business Loan", `${c.b.name} borrowed ${money(amount)} at ${(rate * 100).toFixed(1)}%. Each year it must pay interest plus about 10% of the balance, and keep profit above its debt service or the bank may call the loan. You personally guarantee part of it.`);
}

export function repayBusinessLoan(p0: PlayerState, amount: number): ActionResult {
  const c = open(p0);
  if (!c || c.b.debt <= 0) return { player: p0 };
  const pay = Math.min(Math.round(amount), c.b.debt);
  if (pay <= 0) return { player: p0 };
  if (c.b.cash - pay >= reserveOf(c.b)) c.b.cash -= pay;
  else if (c.p.bankBalance >= pay) c.p.bankBalance -= pay;
  else if (c.b.cash >= pay) c.b.cash -= pay;
  else return poor(p0, "That repayment", pay);
  c.b.debt -= pay;
  if (c.b.debt === 0) c.b.covenantBreaches = 0;
  c.p.creditScore = clamp(c.p.creditScore + 3, 300, 850);
  return done(c, "Loan Repaid", `You repaid ${money(pay)} of ${c.b.name}'s debt. Outstanding: ${money(c.b.debt)}.`);
}

export interface FundingTerms {
  available: boolean;
  reason?: string;
  preMoney: number;
  /** Chance a pitch for this round succeeds. */
  chance: number;
  vc: boolean;
}

export function fundingTerms(p: PlayerState, b: Business, stake: number): FundingTerms & { amount: number } {
  const k = kindOf(b);
  const vc = k.revMult > 0;
  const years = b.history.length;
  const growth = revenueGrowth(b);
  let pre: number;
  let chance: number;
  if (vc) {
    pre = Math.max(equityOf(b), 800_000 + 45_000 * b.customers + 20_000 * b.reputation) * (1 + 0.35 * b.rounds);
    chance = clamp(0.25 + b.customers / 150 + b.reputation / 300 + (growth > 0.3 ? 0.15 : 0) - (p.economy.climate === "recession" ? 0.15 : 0), 0.05, 0.85);
  } else {
    pre = Math.max(equityOf(b), 0) * 0.85;
    chance = clamp(0.4 + (b.reputation - 50) / 200 + (b.lastProfit > 0 ? 0.15 : -0.2) - (p.economy.climate === "recession" ? 0.1 : 0), 0.05, 0.85);
  }
  const amountRaw = (pre * stake) / (1 - stake);
  const amount = Math.round((vc ? amountRaw : Math.min(amountRaw, Math.max(60_000, b.revenue * 1.2))) / 1000) * 1000;
  let reason: string | undefined;
  if (!vc && (years < 2 || b.lastProfit <= 0)) reason = "Angel investors want to see at least two years of trading and a profitable last year.";
  if (b.rounds >= 4) reason = "You've raised as many rounds as the market will tolerate.";
  if (b.ownerShare <= 0.2) reason = "You would be left with too little of your own company.";
  return { available: !reason, reason, preMoney: Math.round(pre), chance, vc, amount };
}

export function raiseFunding(p0: PlayerState, rng: Rng, stake: number): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b } = c;
  const t = fundingTerms(c.p, b, stake);
  if (!t.available) return unchanged(p0, "No Term Sheet", t.reason ?? "Investors aren't interested.", "bad");
  if ((c.p.annual.bizraise ?? 0) >= 1) return unchanged(p0, "Pitched Out", "You've already pitched investors this year.");
  c.p.annual.bizraise = 1;
  if (!rng.chance(t.chance)) {
    changeStat(c.p, "happiness", -3);
    return done(c, "Investors Passed", `You pitched ${t.vc ? "venture capitalists" : "angel investors"} for ${money(t.amount)} and they passed. Traction, reputation and the economy all matter.`, "bad");
  }
  b.cash += t.amount;
  b.ownerShare = Math.round(b.ownerShare * (1 - stake) * 1000) / 1000;
  b.rounds += 1;
  return done(
    c,
    t.vc ? "Funding Round Closed" : "Angel Investment",
    `${t.vc ? "A venture fund" : "An angel investor"} put ${money(t.amount)} into ${b.name} for ${Math.round(stake * 100)}% at a ${money(t.preMoney)} pre-money valuation. You now own ${(b.ownerShare * 100).toFixed(0)}%. Investors share every payout and any exit, and their cash is the company's, not yours.`,
    "jackpot",
  );
}

export function sellFranchise(p0: PlayerState, rng: Rng): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b, k } = c;
  if (!k.franchise) return unchanged(p0, "Not Franchisable", `${k.name}s depend too much on the owner to franchise.`);
  const years = b.history.length;
  if (b.reputation < 60 || years < 2 || b.profitableYears < 2) return unchanged(p0, "Not Ready", "Franchisees pay for a proven brand: 60+ reputation and at least two profitable years.", "bad");
  if (b.franchises >= 10) return unchanged(p0, "Network Complete", "You already have ten franchised units.");
  if ((c.p.annual.bizfranchise ?? 0) >= 1) return unchanged(p0, "Deal Pending", "One franchise sale per year.");
  const legal = b.franchises === 0 ? k.franchise.fee : Math.round(k.franchise.fee * 0.2);
  if (!canSpend(c.p, b, legal)) return poor(p0, "Franchise legal work", legal);
  spend(c.p, b, legal, false);
  c.p.annual.bizfranchise = 1;
  const fee = Math.round(k.franchise.fee * (0.5 + b.reputation / 200) * rng.float(0.9, 1.3));
  b.cash += fee;
  b.franchises += 1;
  if (b.franchises >= 3) setFlag(c.p, "biz_franchise");
  return done(c, "Franchise Sold", `A franchisee signed on (upfront fee ${money(fee)}, legal ${money(legal)}). Unit #${b.franchises} will pay about ${money(Math.round(k.franchise.royalty * (0.5 + b.reputation / 100)))} a year in royalties, but their mistakes become your reputation problem.`);
}

// ---------------------------------------------------------------------------
// Exits
// ---------------------------------------------------------------------------

function removeBusiness(p: PlayerState) {
  p.business = null;
  clearFlag(p, "business_owner");
}

function finishSale(c: Ctx, q: SaleQuote, title: string, story: string, liquidShare = 1): ActionResult {
  const { p, b } = c;
  const gain = q.gross - q.fee - b.basis;
  const liquid = Math.round(q.net * liquidShare);
  p.bankBalance += liquid;
  if (liquidShare < 1) {
    const stock = Math.round(q.net - liquid);
    const h = p.investments.index ?? { value: 0, basis: 0 };
    p.investments.index = { value: h.value + stock, basis: h.basis + stock };
  }
  const debtNote = b.debt > 0 ? ` (after repaying ${money(b.debt)} of debt)` : "";
  const body = `${story} The company fetched ${money(q.equity)} for the whole equity${debtNote}; you owned ${(b.ownerShare * 100).toFixed(0)}% and kept ${money(q.net)} after ${money(q.fee)} in fees and ${money(q.tax)} tax on ${money(Math.max(0, gain))} of gain.`;
  removeBusiness(p);
  if (gain > 0) setFlag(p, "biz_exit");
  if (q.gross >= 50_000_000) setFlag(p, "biz_unicorn");
  changeStat(p, "happiness", gain > 0 ? 8 : -2);
  addLog(p, body);
  return { player: p, notices: [info(title, body, gain > b.basis ? "jackpot" : gain > 0 ? "good" : "neutral")] };
}

export function sellBusiness(p0: PlayerState, rng?: Rng): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { p, b } = c;
  const factor = rng ? rng.float(0.92, 1.08) : 1;
  const q = saleQuote(p, b, factor);
  if (q.equity <= 0) return unchanged(p0, "No Buyers", `${b.name}'s debts exceed what it's worth. Nobody will take it. Close it or file for bankruptcy.`, "bad");
  const mood = p.economy.climate === "boom" ? "Buyers were hungry in the boom." : p.economy.climate === "recession" ? "Buyers lowballed you in the recession." : "";
  return finishSale(c, q, "Business Sold", `You sold ${b.name} at about ${q.multiple > 0 ? q.multiple.toFixed(1) + "x earnings" : "asset value"}. ${mood}`.trim());
}

/** An outside buyer wants the company at a premium (used by events). */
export function acceptAcquisition(p0: PlayerState, rng: Rng, premium: number): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const q = saleQuote(c.p, c.b, rng.float(0.97, 1.05), premium);
  return finishSale(c, q, "Acquired!", `${c.b.name} was acquired by a larger company.`);
}

/** Stock-market debut: part of the proceeds is liquid now, the rest is invested in the market. */
export function takePublic(p0: PlayerState, rng: Rng): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const q = saleQuote(c.p, c.b, rng.float(0.95, 1.2), 1.3);
  return finishSale(c, q, "IPO!", `${c.b.name} went public.`, 0.4);
}

export function handToManager(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c?.b.manager) return unchanged(p0, "No Successor", "Hire a general manager first, then you can sell the business to them.");
  const { p, b } = c;
  const q = saleQuote(p, b, 0.7);
  if (q.equity <= 0) return unchanged(p0, "Nothing to Sell", "The company is worth less than its debts.", "bad");
  const name = b.manager!.name;
  return finishSale(c, { ...q, fee: 0, net: q.gross - exitTax(p.residence.country, q.gross - b.basis), tax: exitTax(p.residence.country, q.gross - b.basis) }, "Handed Over", `${name}, your manager, bought you out at a friendly 70% of market value, with no broker fees.`);
}

function settleDebtShortfall(p: PlayerState, shortfall: number, guarantee: number): number {
  const personal = Math.round(Math.max(0, shortfall) * guarantee);
  p.outstandingLoans += personal;
  return personal;
}

export function closeBusiness(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { p, b } = c;
  const severance = Math.round(b.staff * kindOf(b).wage * 0.15);
  const proceeds = Math.round(liquidationValue(b) * 0.9) + b.cash - severance;
  const left = proceeds - b.debt;
  let body: string;
  if (left >= 0) {
    const gross = Math.round(left * b.ownerShare);
    const tax = exitTax(p.residence.country, gross - b.basis);
    p.bankBalance += gross - tax;
    body = `You wound ${b.name} down. Assets fetched ${money(liquidationValue(b) * 0.9)} at liquidation prices; after paying staff and creditors you kept ${money(gross - tax)}.`;
  } else {
    const personal = settleDebtShortfall(p, -left, 0.4);
    p.creditScore = clamp(p.creditScore - 35, 300, 850);
    body = `You wound ${b.name} down, but the assets didn't cover its debts. The bank is chasing you personally for ${money(personal)}.`;
  }
  removeBusiness(p);
  changeStat(p, "happiness", -6);
  addLog(p, body);
  return { player: p, notices: [info("Business Closed", body, left >= 0 ? "neutral" : "bad")] };
}

/** Insolvency proceedings: fire-sale liquidation, credit damage and a cool-off before founding anything new. */
export function bankruptcyOf(p: PlayerState, reason: string): Notices {
  const b = p.business!;
  const sale = Math.round(liquidationValue(b) * 0.7) + Math.max(0, b.cash);
  const shortfall = b.debt - sale;
  let personal = 0;
  let extra = "";
  if (shortfall > 0) {
    personal = settleDebtShortfall(p, shortfall, 0.4);
    extra = ` Creditors recovered what they could; you were personally liable for ${money(personal)} through guarantees.`;
  } else if (shortfall < 0) {
    p.bankBalance += Math.round(-shortfall * b.ownerShare);
    extra = ` A small surplus of ${money(Math.round(-shortfall * b.ownerShare))} came back to you.`;
  }
  const body = `${b.name} went bankrupt (${reason}).${extra} Your credit is wrecked and you cannot found another company until ${p.year + COOLOFF_YEARS}.`;
  removeBusiness(p);
  setFlag(p, "biz_bankrupt");
  p.flags = p.flags.filter((f) => !f.startsWith("biz_cooloff:"));
  p.flags.push(`biz_cooloff:${p.year + COOLOFF_YEARS}`);
  p.creditScore = clamp(p.creditScore - 110, 300, 850);
  changeStat(p, "happiness", -18);
  changeStat(p, "fame", -3);
  addLog(p, body);
  return [info("Bankrupt", body, "bad")];
}

export function fileBankruptcy(p0: PlayerState): ActionResult {
  if (!p0.business) return { player: p0 };
  const p = clone(p0);
  return { player: p, notices: bankruptcyOf(p, "you filed voluntarily") };
}

// ---------------------------------------------------------------------------
// The yearly transaction
// ---------------------------------------------------------------------------

function rollShocks(b: Business, k: BusinessType, rng: Rng): Shocks {
  const sigma = k.vol * (1 - 0.12 * b.diversified);
  const demand = clamp(gauss(rng) * sigma, -0.45, 0.45);
  const cost = clamp(gauss(rng) * 0.05, -0.15, 0.15);
  const risk = clamp(0.05 * k.hazard * (1.5 - (0.8 * b.compliance) / 100) * (b.facility < 35 ? 1.3 : 1) * (b.neglect > 0 ? 1.3 : 1), 0, 0.5);
  const incident = rng.chance(risk) ? clamp(rng.float(0.06, 0.35) * k.hazard, 0, 0.6) : 0;
  return { demand, cost, incident };
}

/**
 * Runs during Age Up. Returns the owner's draw for the year (taxable personal income). Everything else (profit,
 * tax, loans, rescue, insolvency) is settled inside the company.
 */
export function processBusiness(p: PlayerState, rng: Rng, notices: Notices): number {
  if (!p.business) return 0;
  const b = ensureBusiness(p.business);
  const k = kindOf(b);
  const sh = rollShocks(b, k, rng);
  const step = stepYear(p, b, sh);
  const pnl = step.pnl;

  // --- the soft state moves ---
  Object.assign(b, step.next);
  b.competition = clamp(b.competition + rng.int(-6, 8), 5, 95);
  b.boost = 0;
  // Market shake-out: a rival opens, a road is dug up, a scandal hits the sector. Strong brands and diversified
  // businesses ride these out better.
  const shake = clamp(0.06 + 0.002 * (b.competition - 50) - 0.0008 * (b.reputation - 50) - 0.02 * b.diversified, 0.015, 0.14);
  if (rng.chance(shake)) {
    const loss = rng.int(8, 20);
    b.customers = clamp(b.customers - loss);
    b.competition = clamp(b.competition + 8, 5, 95);
    const cause = rng.pick(["A big-chain competitor opened a block away", "Roadworks cut off your street for months", "A scare in the local press hurt your whole sector", "A trendy rival poached your regulars"]);
    const body = `${cause}. ${b.name} lost customers it will have to win back.`;
    addLog(p, body);
    notices.push(info("Market Shake-out", body, "bad"));
  }
  if (b.manager) {
    if (b.manager.skill < 85) b.manager.skill += rng.int(0, 3);
    if (rng.chance(0.03)) {
      const body = `${b.manager.name}, your general manager, resigned to join a rival.`;
      addLog(p, body);
      notices.push(info("Manager Quit", body, "bad"));
      b.manager = null;
    }
  }
  if (b.franchises > 0) {
    if (rng.chance(clamp(0.06 * b.franchises * (1.3 - b.compliance / 100), 0, 0.5))) {
      b.reputation = clamp(b.reputation - rng.int(5, 12));
      const body = `A franchisee of ${b.name} made the news for all the wrong reasons. Reputation took a hit.`;
      addLog(p, body);
      notices.push(info("Franchise Scandal", body, "bad"));
    }
  }
  b.compliance = clamp(b.compliance - 8);

  if (sh.incident > 0) {
    const body = `${b.name} suffered an incident (fire, theft, a lawsuit or an accident) costing ${money(pnl.incidentNet)} after insurance.`;
    addLog(p, body);
    notices.push(info("Business Incident", body, "bad"));
  }

  // --- the books ---
  const interest = Math.round(b.debt * b.loanRate);
  const principal = Math.min(b.debt, Math.round(b.debt * 0.1));
  const spent = b.ytdSpend;
  const pretax = pnl.operating - spent - interest;
  const tax = pretax > 0 ? Math.round(pretax * CORP_TAX) : 0;
  b.ytdSpend = 0;
  b.cash += pnl.operating - interest - tax - principal;
  b.debt -= principal;
  b.revenue = pnl.revenue + pnl.royalties;
  b.lastProfit = pretax;
  if (pretax > 0) {
    b.profitableYears += 1;
    if (!p.flags.includes("biz_profit_year")) {
      setFlag(p, "biz_profit_year");
      const body = `${b.name} turned its first annual profit: ${money(pretax)}.`;
      addLog(p, body);
      notices.push(info("In the Black", body, "good"));
    }
  }
  if (p.flags.includes("biz_bankrupt") && b.profitableYears >= 3) setFlag(p, "biz_comeback");

  // --- cash crunch: savings, then overdraft, then insolvency ---
  let insolvent = false;
  if (b.cash < 0) {
    let gap = -b.cash;
    if (b.rescue && p.bankBalance > 0) {
      const inject = Math.min(Math.round(p.bankBalance), gap);
      p.bankBalance -= inject;
      b.cash += inject;
      b.basis += inject;
      gap -= inject;
      const body = `${b.name} ran short of cash and you covered ${money(inject)} from your savings.`;
      addLog(p, body);
      notices.push(info("Cash Crunch", body, "bad"));
    }
    if (gap > 0) {
      const limit = Math.round(0.12 * b.revenue + 10_000);
      if (gap <= limit && b.covenantBreaches < 2) {
        b.loanRate = Math.round(((b.debt * b.loanRate + gap * OVERDRAFT_RATE) / (b.debt + gap)) * 1000) / 1000;
        b.debt += gap;
        b.cash += gap;
        const body = `${b.name} couldn't make payroll and drew ${money(gap)} on an emergency overdraft at ${(OVERDRAFT_RATE * 100).toFixed(0)}%.`;
        addLog(p, body);
        notices.push(info("Emergency Overdraft", body, "bad"));
      } else {
        insolvent = true;
      }
    }
  }
  if (insolvent) {
    notices.push(...bankruptcyOf(p, "it ran out of cash with no way to raise more"));
    return 0;
  }

  // --- covenants ---
  if (b.debt > 0 || interest > 0) {
    const service = interest + principal;
    const dscr = service > 0 ? (pnl.operating - spent) / service : 9;
    if (dscr < 1) {
      b.covenantBreaches += 1;
      b.loanRate = Math.min(0.2, b.loanRate + 0.015);
      const body = `${b.name} didn't earn enough to cover its debt service. The lender raised the rate to ${(b.loanRate * 100).toFixed(1)}% and put you on notice.`;
      addLog(p, body);
      notices.push(info("Covenant Breach", body, "bad"));
    } else if (dscr >= 1.25) {
      b.covenantBreaches = 0;
    }
    if (b.covenantBreaches >= 2 && b.debt > 0) {
      const call = Math.round(b.debt * 0.5);
      let paid = Math.min(b.cash, call);
      b.cash -= paid;
      let rest = call - paid;
      if (rest > 0 && b.rescue && p.bankBalance > 0) {
        const extra = Math.min(Math.round(p.bankBalance), rest);
        p.bankBalance -= extra;
        b.basis += extra;
        paid += extra;
        rest -= extra;
      }
      b.debt -= paid;
      if (rest > 0) {
        notices.push(...bankruptcyOf(p, "it defaulted when the bank called its loan"));
        return 0;
      }
      b.covenantBreaches = 0;
      const body = `The bank called half of ${b.name}'s loan (${money(call)}) after repeated covenant breaches. You scraped it together.`;
      addLog(p, body);
      notices.push(info("Loan Called", body, "bad"));
    }
  }

  // --- owner draw ---
  const net = pretax - tax;
  const distributable = Math.max(0, Math.min(net, b.cash - reserveOf(b)));
  const pool = Math.round(distributable * PAYOUT_SHARE[b.payout]);
  b.cash -= pool;
  const draw = Math.round(pool * b.ownerShare);

  // --- records ---
  b.history.push({ year: p.year, revenue: b.revenue, profit: pretax, cash: Math.round(b.cash), reputation: Math.round(b.reputation) });
  if (b.history.length > 12) b.history.shift();
  for (const key of ["customers", "quality", "morale", "training", "facility", "marketing"] as const) b[key] = Math.round(b[key] * 10) / 10;
  refresh(b);

  const years = p.year - b.founded;
  if (years >= 10 && !p.flags.includes("biz_survive_10")) setFlag(p, "biz_survive_10");
  if (b.value >= 50_000_000) setFlag(p, "biz_unicorn");
  if (b.neglect >= 2) changeStat(p, "happiness", -2);
  if (!b.manager && b.locations > 1) changeStat(p, "happiness", -(b.locations - 1));
  if (pretax < 0 && b.debt > 0) changeStat(p, "happiness", -3);

  addLog(
    p,
    `🏢 ${b.name}: revenue ${money(b.revenue)}, profit ${money(pretax)}${tax > 0 ? ` (${money(tax)} tax)` : ""}, cash ${money(b.cash)}${b.debt > 0 ? `, debt ${money(b.debt)}` : ""}, reputation ${Math.round(b.reputation)}. You took ${money(draw)}.`,
  );
  return draw;
}

// ---------------------------------------------------------------------------
// Inheritance
// ---------------------------------------------------------------------------

export interface BusinessInheritance {
  business: Business | null;
  /** Cash from an estate sale (heirs too young to run the company). */
  cash: number;
  note: string | null;
}

/**
 * What a child receives when a business owner dies. Minors can't run a company: trustees sell it at an estate-sale
 * discount. Adult heirs inherit it running, with its debts, under a caretaker manager if it had none, after estate
 * taxes and some loss of the founder's reputation.
 */
export function inheritBusiness(old: PlayerState, heirAge: number, rng: Rng): BusinessInheritance {
  if (!old.business) return { business: null, cash: 0, note: null };
  const b = ensureBusiness(clone(old.business));
  const k = kindOf(b);
  const stake = stakeValue(b);
  if (heirAge < 18) {
    const cash = Math.round(stake * 0.78);
    return { business: null, cash, note: `Trustees sold your parent's business, ${b.name}, and you received ${money(cash)} from the estate.` };
  }
  const estateTax = Math.round(Math.max(0, equityOf(b)) * 0.1);
  b.cash = Math.max(0, b.cash - estateTax);
  if (!b.manager) b.manager = { name: `${rng.pick(["Pat", "Lee", "Chris", "Jamie"])} ${rng.pick(["Moreno", "Walsh", "Iyer", "Kowalski"])}`, skill: 45, wage: k.mgrWage, hired: old.deathYear ?? old.year };
  b.reputation = Math.round(b.reputation * 0.85);
  b.customers = Math.round(b.customers * 0.92);
  b.morale = clamp(b.morale - 10);
  b.neglect = 0;
  b.covenantBreaches = 0;
  b.basis = Math.max(0, equityOf(b));
  b.ownerShare = Math.max(0.01, b.ownerShare);
  b.rescue = true;
  b.boost = 0;
  b.ytdSpend = 0;
  // The founder is gone: buyers and customers trust the track record less, so past results are written down.
  b.history = b.history.slice(-3).map((r) => ({ ...r, revenue: Math.round(r.revenue * 0.9), profit: Math.round(r.profit * 0.7) }));
  b.revenue = Math.round(b.revenue * 0.9);
  b.value = stakeValue(b);
  const debtNote = b.debt > 0 ? ` It still owes ${money(b.debt)} to the bank.` : "";
  return { business: b, cash: 0, note: `You inherited the family business, ${b.name}, worth about ${money(b.value)}. A caretaker manager is keeping it running.${debtNote}` };
}

/** Upgrade a business from an older save (adds fields, refreshes the valuation). */
export function upgradeBusiness(b: Business): Business {
  const up = ensureBusiness(b);
  up.value = stakeValue(up);
  return up;
}

// ---------------------------------------------------------------------------
// Event helpers (used by data/events/business.ts)
// ---------------------------------------------------------------------------

export const ownsKind = (p: PlayerState, ...ids: string[]) => !!p.business && (ids.length === 0 || ids.includes(p.business.kind));

export interface BizDelta {
  rep?: number;
  customers?: number;
  morale?: number;
  quality?: number;
  compliance?: number;
  competition?: number;
  facility?: number;
  marketing?: number;
  /** Company cash (positive or negative; shortfalls are covered by savings, then the company goes into the red). */
  cash?: number;
  /** Fraction of last year's revenue added to (or removed from) company cash. */
  cashPctRevenue?: number;
  staff?: number;
  fit?: number;
}

/** Apply a change to the owned business from an event. Returns a short sentence describing money moved. */
export function bizApply(p: PlayerState, d: BizDelta): string | undefined {
  const b = p.business;
  if (!b) return undefined;
  ensureBusiness(b);
  if (d.rep) b.reputation = clamp(b.reputation + d.rep);
  if (d.customers) b.customers = clamp(b.customers + d.customers);
  if (d.morale) b.morale = clamp(b.morale + d.morale);
  if (d.quality) b.quality = clamp(b.quality + d.quality);
  if (d.compliance) b.compliance = clamp(b.compliance + d.compliance);
  if (d.competition) b.competition = clamp(b.competition + d.competition, 5, 95);
  if (d.facility) b.facility = clamp(b.facility + d.facility);
  if (d.marketing) b.marketing = Math.max(0, b.marketing + d.marketing);
  if (d.fit) b.fit = clamp(b.fit + d.fit, 0.3, 1.8);
  if (d.staff) b.staff = Math.max(0, b.staff + d.staff);
  let cash = d.cash ?? 0;
  if (d.cashPctRevenue) cash += Math.round(d.cashPctRevenue * Math.max(b.revenue, kindOf(b).baseRev * 0.25));
  let note: string | undefined;
  if (cash !== 0) {
    b.cash += cash;
    if (cash < 0) b.ytdSpend += -cash;
    if (b.cash < 0 && b.rescue && p.bankBalance > 0) {
      const inject = Math.min(Math.round(p.bankBalance), -b.cash);
      p.bankBalance -= inject;
      b.cash += inject;
      b.basis += inject;
    }
    note = `${cash > 0 ? "The company gained" : "It cost the company"} ${money(Math.abs(cash))}.`;
  }
  refresh(b);
  return note;
}

export const bizEffect = (d: BizDelta) => (p: PlayerState) => bizApply(p, d);

/** Sell the company to an outside buyer at a premium. `mode` picks acquisition or IPO. */
export function bizSellInPlace(p: PlayerState, rng: Rng, mode: "acquired" | "ipo", premium: number): string | undefined {
  const b = p.business;
  if (!b) return undefined;
  ensureBusiness(b);
  const c: Ctx = { p, b, k: kindOf(b) };
  const q = saleQuote(p, b, rng.float(0.97, 1.05), premium);
  if (q.equity <= 0) return "The deal fell through when the buyer saw the debts.";
  const res =
    mode === "ipo"
      ? finishSale(c, saleQuote(p, b, rng.float(0.95, 1.2), premium), "IPO!", `${b.name} went public.`, 0.4)
      : finishSale(c, q, "Acquired!", `${b.name} was acquired.`);
  const n = res.notices?.[0];
  return n && "body" in n ? n.body : undefined;
}

/** Sell a minority stake to an investor. Returns a sentence describing the terms. */
export function bizSellStake(p: PlayerState, stake: number, discount = 1): string | undefined {
  const b = p.business;
  if (!b) return undefined;
  ensureBusiness(b);
  if (b.ownerShare <= 0.25) return "Investors weren't interested in what was left of the company.";
  const amount = Math.max(40_000, Math.round(((Math.max(0, equityOf(b)) * stake) / (1 - stake)) * discount / 1000) * 1000);
  b.cash += amount;
  b.ownerShare = Math.round(b.ownerShare * (1 - stake) * 1000) / 1000;
  b.rounds += 1;
  refresh(b);
  return `The investor put ${money(amount)} into the company for ${Math.round(stake * 100)}%. You now own ${(b.ownerShare * 100).toFixed(0)}%.`;
}

/** Buy back some of an investor's shares at a 10% premium to fair value. */
export function bizBuyShares(p: PlayerState, frac: number): string | undefined {
  const b = p.business;
  if (!b || b.ownerShare >= 1) return undefined;
  ensureBusiness(b);
  const add = Math.min(frac, 1 - b.ownerShare);
  const price = Math.round(Math.max(0, equityOf(b)) * add * 1.1);
  if (p.bankBalance >= price) {
    p.bankBalance -= price;
    b.basis += price;
  } else if (b.cash >= price) {
    b.cash -= price;
  } else {
    return "You couldn't raise the money to buy them out.";
  }
  b.ownerShare = Math.round((b.ownerShare + add) * 1000) / 1000;
  refresh(b);
  return `You bought back ${(add * 100).toFixed(0)}% of the company for ${money(price)}. You now own ${(b.ownerShare * 100).toFixed(0)}%.`;
}

/** A subsidised loan worth a share of last year's revenue. */
export function bizCheapLoan(p: PlayerState, pctRevenue: number, rate: number): string | undefined {
  const b = p.business;
  if (!b) return undefined;
  ensureBusiness(b);
  const amount = Math.max(20_000, Math.round((b.revenue * pctRevenue) / 1000) * 1000);
  b.loanRate = Math.round(((b.debt * b.loanRate + amount * rate) / (b.debt + amount)) * 1000) / 1000;
  b.debt += amount;
  b.cash += amount;
  refresh(b);
  return `The company borrowed ${money(amount)} at ${(rate * 100).toFixed(1)}%.`;
}
