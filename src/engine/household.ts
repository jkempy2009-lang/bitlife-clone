/**
 * The household as an economic unit: a spouse's income and shared costs, divorce settlements,
 * and child support. (Single people are unaffected: everything here keys off a married partner.)
 */
import type { PlayerState, Relative } from "@/types/game.types";
import { money } from "@/lib/format";
import { addLog, changeStat, getPartner } from "./state";

/** Typical annual income by incomeTier 1-5. */
const TIER_INCOME = [0, 16_000, 34_000, 58_000, 95_000, 160_000];

/** What a spouse earns this year (gross). Retired spouses draw a smaller pension. */
export function spouseIncome(partner: Relative): number {
  if (partner.age < 20) return 0;
  const base = TIER_INCOME[Math.min(5, Math.max(1, partner.incomeTier))];
  if (partner.age >= 67) return Math.round(base * 0.4);
  if (partner.age >= 62) return Math.round(base * 0.75);
  return base;
}

export const SPOUSE_TAX = 0.25;
/** Two people sharing a home cost less than two people living apart, but more than one. */
export const SHARED_LIVING_FACTOR = 0.55;

export function marriedPartner(p: PlayerState): Relative | undefined {
  const partner = getPartner(p);
  return partner && partner.partnerStatus === "married" ? partner : undefined;
}

export function yearsMarried(p: PlayerState, partner: Relative): number {
  return partner.marriedYear ? Math.max(0, p.year - partner.marriedYear) : 5;
}

/** Children under 18 you're responsible for. */
export const minorChildren = (p: PlayerState) => p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age < 18);

/**
 * Splits the marital estate. Roughly 10% plus 4% per year of marriage (to a max of half) of your liquid
 * savings and property equity; cash first, then property is sold if that's not enough.
 */
export function divorceSettlement(p: PlayerState, partner: Relative, atFault: boolean): number {
  const years = yearsMarried(p, partner);
  const share = Math.min(0.5, 0.1 + 0.04 * years) + (atFault ? 0.08 : 0);
  const equity = p.properties.reduce((s, h) => s + Math.max(0, h.currentValue - h.mortgageBalance), 0);
  let owed = Math.round((Math.max(0, p.bankBalance) + equity * 0.8) * Math.min(0.6, share));
  const total = owed;
  const paid = Math.min(owed, Math.max(0, p.bankBalance));
  p.bankBalance -= paid;
  owed -= paid;
  // Sell the least valuable property until the settlement is covered.
  p.properties.sort((a, b) => a.currentValue - b.currentValue);
  while (owed > 0 && p.properties.length > 0) {
    const h = p.properties.shift()!;
    const proceeds = Math.max(0, h.currentValue - h.mortgageBalance);
    const used = Math.min(owed, proceeds);
    owed -= used;
    p.bankBalance += proceeds - used;
    addLog(p, `You sold ${h.name} to fund the settlement.`);
  }
  if (owed > 0) p.outstandingLoans += owed;
  return total;
}

/** Called from endRelationship. Returns text to log. */
export function settleDivorce(p: PlayerState, partner: Relative, atFault = false): string {
  const total = divorceSettlement(p, partner, atFault);
  const kids = minorChildren(p).length;
  if (kids > 0) {
    if (!p.flags.includes("child_support")) p.flags.push("child_support");
  }
  changeStat(p, "happiness", -4);
  return `Your divorce from ${partner.name} cost you ${money(total)} in the settlement${kids > 0 ? `, and you'll pay child support for ${kids} child${kids > 1 ? "ren" : ""} until they turn 18` : ""}.`;
}

/** Yearly maintenance for children after a divorce, as a share of your income. */
export function childSupportDue(p: PlayerState, gross: number): number {
  if (!p.flags.includes("child_support")) return 0;
  const kids = minorChildren(p).length;
  if (kids === 0) {
    p.flags = p.flags.filter((f) => f !== "child_support");
    return 0;
  }
  const married = marriedPartner(p);
  if (married) return 0;
  return Math.round(gross * Math.min(0.25, 0.08 * kids));
}

/** Income a lender will count: wages, pensions, a share of a spouse's pay and of recent business profit. */
export function qualifyingIncome(p: PlayerState): number {
  const spouse = marriedPartner(p);
  const wages = p.currentJob?.salary ?? 0;
  const profit = p.business ? Math.max(0, p.business.lastProfit) * 0.7 : 0;
  return Math.round(wages + p.pension + profit + (spouse ? spouseIncome(spouse) * 0.8 : 0));
}
