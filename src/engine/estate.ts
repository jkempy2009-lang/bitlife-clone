/**
 * The family estate: what happens to the money when a life ends or is handed over.
 *
 *  - Debts come off the top. An estate that cannot cover them is insolvent: creditors take what there is and the
 *    rest dies with the person. Children never inherit unlimited debt.
 *  - The will decides who gets what. Houses, cars, investments and any business go to the heir you play; the cash
 *    is shared out so that everyone's slice comes to roughly their weight in the whole estate.
 *  - Money in the family trust never enters the estate: no tax, no division, no creditors.
 *
 * Pure helpers plus `settleNpcEstate`, which runs when a parent who once handed their life over dies.
 */
import type { ActionResult, PlayerState, Relative, WillPlan } from "@/types/game.types";
import { money } from "@/lib/format";
import { addLog, changeStat } from "./state";

type Notices = NonNullable<ActionResult["notices"]>;

export const ESTATE_TAX = 0.1;
/** Share of the whole estate that goes to good causes under the "charity" plan. */
export const CHARITY_SHARE = 0.25;
/** The favoured child's weight under "eldest" and "chosen". */
export const FAVOURED_SHARE = 0.6;

export const PLAN_INFO: Record<WillPlan, { label: string; emoji: string; blurb: string }> = {
  equal: { label: "Equal shares", emoji: "⚖️", blurb: "Every living child gets the same. Nobody can say it was unfair." },
  eldest: { label: "Eldest leads", emoji: "👑", blurb: "The eldest living child takes 60%, the rest share 40%. Old money, old rules, and younger siblings notice." },
  chosen: { label: "Name an heir", emoji: "✍️", blurb: "The child you name takes 60%, the rest share 40%. Pick well: the others will find out." },
  charity: { label: "Gift to charity", emoji: "🎗️", blurb: "A quarter of everything goes to good causes; the rest is split equally. The family name gains respect." },
};

export interface Claimant {
  id: string;
  age: number;
}

/** The weight each living child receives of the whole estate, and what goes to charity. */
export function willShares(plan: WillPlan, kids: Claimant[], chosenId: string | null): { shares: Record<string, number>; charity: number; plan: WillPlan } {
  const n = kids.length;
  const shares: Record<string, number> = {};
  if (n === 0) return { shares, charity: 0, plan };
  let eff: WillPlan = plan;
  if (eff === "chosen" && !kids.some((k) => k.id === chosenId)) eff = "equal"; // the named child is gone: the law decides
  if (n === 1 && eff !== "charity") {
    shares[kids[0].id] = 1;
    return { shares, charity: 0, plan: eff };
  }
  if (eff === "charity") {
    for (const k of kids) shares[k.id] = (1 - CHARITY_SHARE) / n;
    return { shares, charity: CHARITY_SHARE, plan: eff };
  }
  if (eff === "equal") {
    for (const k of kids) shares[k.id] = 1 / n;
    return { shares, charity: 0, plan: eff };
  }
  const first = eff === "chosen" ? kids.find((k) => k.id === chosenId)! : [...kids].sort((a, b) => b.age - a.age)[0];
  for (const k of kids) shares[k.id] = k.id === first.id ? FAVOURED_SHARE : (1 - FAVOURED_SHARE) / (n - 1);
  return { shares, charity: 0, plan: eff };
}

export interface DebtSettlement {
  /** Cash left once the creditors are paid. */
  cash: number;
  /** Fraction of the investment portfolio still held (the rest was sold to pay debts). */
  investmentKeep: number;
  debtPaid: number;
  /** Debt the estate could not cover: creditors take the loss. */
  writtenOff: number;
}

/** Unsecured debts are paid from cash, then from investments. Mortgages and car loans stay with the house or car. */
export function settleDebts(old: PlayerState, cash: number): DebtSettlement {
  let debt = Math.max(0, old.outstandingLoans);
  const fromCash = Math.min(cash, debt);
  debt -= fromCash;
  let keep = 1;
  const portfolio = Object.values(old.investments).reduce((s, h) => s + h.value, 0);
  if (debt > 0 && portfolio > 0) {
    const sold = Math.min(portfolio, debt);
    debt -= sold;
    keep = 1 - sold / portfolio;
  }
  return { cash: cash - fromCash, investmentKeep: keep, debtPaid: Math.max(0, old.outstandingLoans) - debt, writtenOff: debt };
}

export interface Division {
  /** Cash for the heir you play. */
  heirCash: number;
  /** Cash for each other child, by id. */
  siblingCash: Record<string, number>;
  charity: number;
  /** The plan that was actually applied. */
  plan: WillPlan;
  /** Heir's share of the whole estate (cash plus the assets they keep). */
  heirWeight: number;
  /** What an equal split would have given each child. */
  equalWeight: number;
}

/**
 * Shares out `cash` (already taxed). `keptAssets` is the value of what the heir takes in kind (property, cars,
 * investments, business): it counts towards their share, so the siblings are paid first out of the cash.
 */
export function divideEstate(cash: number, keptAssets: number, plan: WillPlan, heirId: string, kids: Claimant[], chosenId: string | null): Division {
  const { shares, charity, plan: used } = willShares(plan, kids, chosenId);
  const total = cash + Math.max(0, keptAssets);
  const equalWeight = kids.length > 0 ? 1 / kids.length : 1;
  const others = kids.filter((k) => k.id !== heirId);
  const wantOthers = others.reduce((s, k) => s + shares[k.id] * total, 0) + charity * total;
  const paid = Math.min(cash, wantOthers);
  const scale = wantOthers > 0 ? paid / wantOthers : 0;
  const siblingCash: Record<string, number> = {};
  for (const k of others) siblingCash[k.id] = Math.round(shares[k.id] * total * scale);
  const charityCash = Math.round(charity * total * scale);
  const heirCash = Math.max(0, Math.round(cash - Object.values(siblingCash).reduce((s, v) => s + v, 0) - charityCash));
  return { heirCash, siblingCash, charity: charityCash, plan: used, heirWeight: shares[heirId] ?? 1, equalWeight };
}

/** How the siblings feel about their slice compared with an equal split. */
export function fairness(d: Division, siblingId: string): number {
  const share = d.siblingCash[siblingId] ?? 0;
  const total = Object.values(d.siblingCash).reduce((s, v) => s + v, 0) + d.heirCash + d.charity;
  return total > 0 ? share / (total * d.equalWeight) : 1;
}

/**
 * A parent who once handed their life to you has died. What they kept (a quarter of their cash and their
 * retirement pot, less debts) is divided under their will between you and your siblings.
 */
export function settleNpcEstate(p: PlayerState, r: Relative, notices: Notices): boolean {
  if (r.wealth === undefined) return false;
  const estate = Math.max(0, r.wealth);
  r.wealth = 0;
  const siblings = p.relatives.filter((s) => s.relation === "Sibling" && s.alive);
  const me: Claimant = { id: "self", age: p.age };
  const kids: Claimant[] = [me, ...siblings.map((s) => ({ id: s.id, age: s.age }))];
  const net = Math.round(estate * (1 - ESTATE_TAX));
  if (r.relation === "Grandparent") {
    // A grandparent's estate goes to their own children first; a grandchild is remembered with a slice.
    const mine = Math.round(net * 0.3);
    if (mine > 0) p.bankBalance += mine;
    const gbody = `${r.name.split(" ")[0]} passed away${mine > 0 ? ` and remembered you in the will with ${money(mine)}` : ""}.`;
    addLog(p, gbody);
    notices.push({ kind: "info", title: "The Estate Is Settled", body: gbody, tone: "neutral" });
    return true;
  }
  const chosen = r.willHeirId ?? null;
  const { shares, charity } = willShares(r.willPlan ?? "equal", kids, chosen);
  const mine = Math.round((shares.self ?? 1) * net);
  let body = `${r.name.split(" ")[0]} passed away. `;
  if (net <= 0) {
    body += "There was almost nothing left in the estate: it had all gone to you already.";
  } else {
    p.bankBalance += mine;
    for (const s of siblings) {
      const cut = Math.round((shares[s.id] ?? 0) * net);
      s.wealth = (s.wealth ?? 0) + cut;
      if (r.willPlan === "chosen" || r.willPlan === "eldest") {
        const fair = (shares[s.id] ?? 0) * kids.length;
        s.relationshipBar = Math.max(0, s.relationshipBar + (fair < 0.75 ? -12 : fair > 1.2 ? 6 : 0));
      }
    }
    body += `Their will left you ${money(mine)}${siblings.length ? ` and your ${siblings.length === 1 ? "sibling" : "siblings"} ${money(net - mine - Math.round(charity * net))} between them` : ""}${charity > 0 ? `, with ${money(Math.round(charity * net))} to charity` : ""}. Estate tax took ${money(estate - net)}.`;
    if (charity > 0) changeStat(p, "karma", 3);
  }
  addLog(p, body);
  notices.push({ kind: "info", title: "The Estate Is Settled", body, tone: "neutral" });
  return true;
}

// ---------------------------------------------------------------------------
// Helpers for the estate events (data/events/dynasty.ts, arcsLegacy.ts)
// ---------------------------------------------------------------------------

const livingSiblings = (p: PlayerState) => p.relatives.filter((s) => s.relation === "Sibling" && s.alive);

/** You and your siblings end up with the same cash: whoever has more hands the difference round. */
export function equaliseWithSiblings(p: PlayerState) {
  const sibs = livingSiblings(p);
  if (sibs.length === 0) return;
  const pot = Math.max(0, p.bankBalance) + sibs.reduce((s, x) => s + (x.wealth ?? 0), 0);
  const each = Math.round(pot / (sibs.length + 1));
  p.bankBalance = each;
  for (const s of sibs) s.wealth = each;
}

/** Hands each sibling a share of your cash as a gift. */
export function giftSiblings(p: PlayerState, pct: number) {
  const sibs = livingSiblings(p);
  for (const s of sibs) {
    const gift = Math.round(Math.max(0, p.bankBalance) * pct);
    p.bankBalance -= gift;
    s.wealth = (s.wealth ?? 0) + gift;
  }
}

/** Takes a share of what the best-provided sibling holds (a court order or a family settlement). Returns the sum. */
export function claimFromRichestSibling(p: PlayerState, share: number): number {
  const sibs = livingSiblings(p).sort((a, b) => (b.wealth ?? 0) - (a.wealth ?? 0));
  const rich = sibs[0];
  if (!rich || !rich.wealth) return 0;
  const sum = Math.round(rich.wealth * share);
  rich.wealth -= sum;
  p.bankBalance += sum;
  return sum;
}
