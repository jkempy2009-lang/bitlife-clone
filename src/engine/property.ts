/**
 * The real cost of owning: property tax and insurance, letting a home to tenants, and what happens when debt gets out of hand
 * (collections, repossession, foreclosure, personal bankruptcy).
 */
import type { ActionResult, PlayerState, Property } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, isRoyal } from "./state";
import { qualifyingIncome } from "./household";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") => ({ kind: "info" as const, title, body, tone });

export const PROPERTY_TAX_RATE = 0.009;
export const HOME_INSURANCE_RATE = 0.0035;
/** Share of rent the letting agent keeps. */
export const MANAGEMENT_FEE = 0.08;
export const VACANCY_CHANCE = 0.1;

/** Property tax and insurance for one property. */
export const carryingCost = (value: number) => Math.round(value * (PROPERTY_TAX_RATE + HOME_INSURANCE_RATE));

/** Gross yearly rent a property of this value and condition would fetch (cheaper homes yield more). */
export function marketRent(value: number, condition = 80): number {
  const yieldRate = value <= 600_000 ? 0.062 : value <= 2_000_000 ? 0.05 : 0.035;
  return Math.round(value * yieldRate * (0.6 + (0.4 * clamp(condition)) / 100));
}

/** Net of the management fee, before income tax. */
export const netRent = (h: Property) => Math.round(marketRent(h.currentValue, h.condition) * (1 - MANAGEMENT_FEE));

/** Does the player still live in one of their own properties? */
export const hasOwnedHome = (p: PlayerState) => p.properties.some((h) => !h.rentedOut);

export function bankruptcyBlocker(p: PlayerState): string | null {
  const until = p.finance.bankruptUntil;
  return until && p.year < until ? `Your bankruptcy bars new credit until ${until}.` : null;
}

/** Yearly cash cost of owning, financed or not, versus renting the same place. For the listing screen. */
export function ownershipComparison(price: number, condition: number, mortgagePayment: number) {
  const running = carryingCost(price) + Math.round(price * (1 - condition / 100) * 0.02);
  return { ownYearly: mortgagePayment + running, runningOnly: running, rentYearly: marketRent(price, condition) };
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export function rentOut(p0: PlayerState, propId: string): ActionResult {
  const p = clone(p0);
  const h = p.properties.find((x) => x.id === propId);
  if (!h || h.rentedOut) return { player: p0 };
  if (p.isInPrison || isRoyal(p)) return { player: p0, notices: [info("Not Now", "You can't manage tenants right now.", "bad")] };
  h.rentedOut = true;
  const others = p.properties.some((x) => x.id !== h.id && !x.rentedOut);
  const body = `You let your ${h.name} to tenants for about ${money(netRent(h))} a year after the letting agent's fee.${others ? "" : " It was your only home, so you'll rent a place of your own while it is let."}`;
  addLog(p, body);
  return { player: p, notices: [info("Tenants Move In", body, "good")] };
}

export function moveBackIn(p0: PlayerState, propId: string): ActionResult {
  const p = clone(p0);
  const h = p.properties.find((x) => x.id === propId);
  if (!h || !h.rentedOut) return { player: p0 };
  h.rentedOut = false;
  const body = `Your tenants moved out and you moved back into your ${h.name}.`;
  addLog(p, body);
  return { player: p, notices: [info("Home Again", body)] };
}

/** Rent for the year goes into `finance.rentThisYear` (taxed with the rest of income); bad tenants cost repairs. */
export function processRentals(p: PlayerState, rng: Rng, notices: Notices) {
  for (const h of p.properties) {
    if (!h.rentedOut) continue;
    if (rng.chance(VACANCY_CHANCE)) {
      addLog(p, `Your ${h.name} stood empty for much of the year: no rent.`);
      continue;
    }
    p.finance.rentThisYear += netRent(h);
    if (rng.chance(0.08)) {
      const repair = Math.round(h.currentValue * 0.025);
      h.condition = clamp(h.condition - 12);
      p.bankBalance -= repair;
      const body = `Tenants trashed part of your ${h.name}. Repairs cost ${money(repair)}.`;
      addLog(p, body);
      notices.push(info("Tenant Trouble", body, "bad"));
    }
  }
}

/** Take this year's rent into the income calculation. */
export function takeRent(p: PlayerState): number {
  const r = p.finance.rentThisYear;
  p.finance.rentThisYear = 0;
  return r;
}

// ---------------------------------------------------------------------------
// Debt crisis, foreclosure and bankruptcy
// ---------------------------------------------------------------------------

export const SALE_DISCOUNT_FORCED = 0.85;
export const BANKRUPTCY_YEARS = 7;

/** Is the player drowning? Overdrawn, with unsecured debt far beyond what they earn. */
export function inDebtCrisis(p: PlayerState): boolean {
  if (p.age < 18) return false;
  const overdraft = Math.max(0, -p.bankBalance);
  const income = Math.max(qualifyingIncome(p), 12_000);
  return overdraft > 0 && p.outstandingLoans + overdraft > income * 2.5;
}

/** Called after the year's money is settled but before an overdraft is turned into a loan. */
export function processDistress(p: PlayerState, notices: Notices) {
  const f = p.finance;
  if (f.bankruptUntil && p.year < f.bankruptUntil) p.creditScore = Math.min(p.creditScore, 640);
  if (!inDebtCrisis(p)) {
    if (f.distressYears > 0 && (p.bankBalance > 0 || p.outstandingLoans < 5_000)) f.distressYears -= 1;
    return;
  }
  f.distressYears += 1;
  p.creditScore = clamp(p.creditScore - 25, 300, 850);
  const body = (t: string) => {
    addLog(p, t);
    return t;
  };
  if (f.distressYears === 1 && p.vehicles.length > 0) {
    const proceeds = p.vehicles.reduce((s, v) => s + Math.round(v.currentValue * 0.65) - v.loanBalance, 0);
    p.bankBalance += Math.max(0, proceeds);
    if (proceeds < 0) p.outstandingLoans += -proceeds;
    const n = p.vehicles.length;
    p.vehicles = [];
    changeStat(p, "happiness", -6);
    notices.push(info("Repossession", body(`Creditors took ${n === 1 ? "your car" : `your ${n} cars`}. You'll be walking to work.`), "bad"));
    return;
  }
  if (f.distressYears >= 2) {
    const mortgaged = [...p.properties].filter((h) => h.mortgageBalance > 0).sort((a, b) => b.mortgageBalance - a.mortgageBalance)[0];
    if (mortgaged) {
      const net = Math.round(mortgaged.currentValue * SALE_DISCOUNT_FORCED) - mortgaged.mortgageBalance;
      p.properties = p.properties.filter((h) => h.id !== mortgaged.id);
      if (net >= 0) p.bankBalance += net;
      else p.outstandingLoans += -net;
      p.creditScore = clamp(p.creditScore - 55, 300, 850);
      changeStat(p, "happiness", -10);
      notices.push(info("Foreclosure", body(`The bank foreclosed on your ${mortgaged.name} and sold it at auction${net < 0 ? `, leaving you ${money(-net)} short on top of everything else` : ""}.`), "bad"));
      return;
    }
  }
  if (f.distressYears >= 3) {
    const r = declareBankruptcy(p, true);
    if (r) notices.push(info("Bankruptcy", r, "bad"));
    return;
  }
  notices.push(info("Debt Collectors", body("The calls and letters never stop. Your debts are far beyond what you earn: cut spending, sell assets or consider declaring bankruptcy (Assets, then Bank)."), "bad"));
  changeStat(p, "happiness", -4);
}

/** Wipe unsecured debt in exchange for your non-exempt assets and seven years of bad credit. Mutates; returns the log text, or null if not allowed. */
export function declareBankruptcy(p: PlayerState, forced = false): string | null {
  if (p.outstandingLoans <= 0 && p.bankBalance >= 0) return null;
  let debt = p.outstandingLoans + Math.max(0, -p.bankBalance);
  p.bankBalance = Math.max(0, p.bankBalance);
  const sold: string[] = [];
  // Investments (not the retirement account) go to the creditors.
  let pot = 0;
  for (const h of Object.values(p.investments)) pot += h.value;
  if (pot > 0) sold.push(`investments (${money(pot)})`);
  p.investments = {};
  // Cars: keep one modest car.
  const cars = [...p.vehicles].sort((a, b) => b.currentValue - a.currentValue);
  const keep = cars.find((v) => v.currentValue <= 10_000);
  for (const v of cars) {
    if (v === keep) continue;
    pot += Math.round(v.currentValue * 0.7) - v.loanBalance;
    sold.push(v.name);
  }
  p.vehicles = keep ? [keep] : [];
  // Homes: the home you live in is protected up to $250,000 of equity; everything else is sold.
  const homes = [...p.properties].sort((a, b) => a.currentValue - a.mortgageBalance - (b.currentValue - b.mortgageBalance));
  const protectedHome = homes.find((h) => !h.rentedOut && h.currentValue - h.mortgageBalance <= 250_000);
  for (const h of homes) {
    if (h === protectedHome) continue;
    pot += Math.round(h.currentValue * SALE_DISCOUNT_FORCED) - h.mortgageBalance;
    sold.push(h.name);
  }
  p.properties = protectedHome ? [protectedHome] : [];
  // Cash above a small allowance goes too.
  const keepCash = 5_000;
  if (p.bankBalance > keepCash) {
    pot += p.bankBalance - keepCash;
    p.bankBalance = keepCash;
  }
  const paid = Math.min(Math.max(0, pot), debt);
  debt -= paid;
  const leftover = Math.max(0, pot - paid);
  p.bankBalance += Math.round(leftover);
  const wiped = debt;
  p.outstandingLoans = 0;
  p.creditScore = 480;
  p.finance.bankruptUntil = p.year + BANKRUPTCY_YEARS;
  p.finance.distressYears = 0;
  changeStat(p, "happiness", -12);
  changeStat(p, "karma", -1);
  const text = `${forced ? "A court declared you bankrupt" : "You filed for bankruptcy"}. ${sold.length ? `Creditors took your ${sold.join(", ")}. ` : ""}${money(Math.round(wiped))} of debt was wiped out, and your credit is wrecked until ${p.finance.bankruptUntil}. Student loans and your retirement account are untouched.`;
  addLog(p, text);
  return text;
}

export function fileBankruptcy(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0 };
  if (p.business) return { player: p0, notices: [info("Business First", `Close or sell ${p.business.name} before you file: a company's debts are settled separately.`, "bad")] };
  if (bankruptcyBlocker(p)) return { player: p0, notices: [info("Already Bankrupt", bankruptcyBlocker(p) ?? "", "neutral")] };
  const text = declareBankruptcy(p);
  if (!text) return { player: p0, notices: [info("Nothing to Discharge", "You have no unsecured debt to wipe out.")] };
  return { player: p, notices: [info("Bankruptcy", text, "bad")] };
}
