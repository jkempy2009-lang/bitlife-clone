/**
 * Shared plumbing for business actions: opening a clone of the owner's company, paying for decisions from company cash
 * or savings, and producing the notices the UI shows. `business.ts` and the depth modules (people, market, board)
 * all build their actions on these.
 */
import type { ActionResult, Business, PlayerState } from "@/types/game.types";
import { clamp, money } from "@/lib/format";
import type { BusinessType } from "@/data/businessTypes";
import { addLog, clone } from "./state";
import { ensureBusiness, kindOf, stakeValue } from "./businessModel";

export type Notices = NonNullable<ActionResult["notices"]>;
export type Tone = "good" | "bad" | "neutral" | "jackpot";
export const info = (title: string, body: string, tone: Tone = "neutral") => ({ kind: "info" as const, title, body, tone });

export const unitCost = (k: BusinessType, b: Business) => k.cost * b.locations;
export const reserveOf = (b: Business) => {
  const k = kindOf(b);
  return 0.25 * (k.fixed * b.locations + b.staff * k.wage + (b.manager?.wage ?? 0));
};
export const scale = (b: Business) => {
  const k = kindOf(b);
  return Math.max(k.baseRev * b.locations * 0.4, b.revenue);
};

export function refresh(b: Business) {
  b.value = stakeValue(b);
  b.reputation = Math.round(clamp(b.reputation) * 10) / 10;
}

/**
 * Pay for a decision. Company cash is used while it stays above a small reserve, otherwise the owner's savings,
 * otherwise whatever company cash is left. Capital items paid from savings raise the owner's cost basis.
 */
export function spend(p: PlayerState, b: Business, amount: number, capital: boolean): "company" | "savings" | null {
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

export const canSpend = (p: PlayerState, b: Business, amount: number) => b.cash >= amount || p.bankBalance >= amount;
export const fromWhere = (src: "company" | "savings") => (src === "company" ? "from company cash" : "from your savings");

export interface Ctx {
  p: PlayerState;
  b: Business;
  k: BusinessType;
}

/** Common preamble for actions on an existing business. */
export function open(p0: PlayerState): Ctx | null {
  if (!p0.business) return null;
  const p = clone(p0);
  const b = ensureBusiness(p.business!);
  return { p, b, k: kindOf(b) };
}

export const unchanged = (p0: PlayerState, title: string, body: string, tone: Tone = "neutral"): ActionResult => ({ player: p0, notices: [info(title, body, tone)] });
export const poor = (p0: PlayerState, what: string, cost: number): ActionResult => unchanged(p0, "Insufficient Funds", `${what} costs ${money(cost)}. Neither your savings nor the company's cash can cover it.`, "bad");

export function done(c: Ctx, title: string, body: string, tone: Tone = "good"): ActionResult {
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
    expand: Math.round(k.cost * 0.9 * (1 + 0.15 * (b.locations - 1))) + (b.franchisor ? Math.round((k.franchise?.fee ?? 0) * 0.5) : 0),
    managerFee: { solid: Math.round(k.mgrWage * 0.2), star: Math.round(k.mgrWage * 1.5 * 0.2) },
    managerWage: { solid: k.mgrWage, star: Math.round(k.mgrWage * 1.5) },
    managerSeverance: Math.round((b.manager?.wage ?? 0) * 0.5),
  };
}
