/** Retirement savings: contributions, employer match, growth, drawdown and early withdrawal. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { money } from "@/lib/format";
import { addLog, clone } from "./state";
import { yearReturn } from "./world";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const SAVINGS_LEVELS = [
  { rate: 0, label: "None", blurb: "Keep every paycheque. Retirement is a problem for future you." },
  { rate: 0.05, label: "5%", blurb: "A sensible default. Your employer matches half of it." },
  { rate: 0.1, label: "10%", blurb: "Serious saving. Employer match maxes out." },
  { rate: 0.15, label: "15%", blurb: "The gold standard. Less cash now, a much better old age." },
] as const;

export const MATCH_RATE = 0.5;
export const MATCH_CAP = 0.03;

export function setSavingsLevel(p0: PlayerState, level: number): ActionResult {
  const p = clone(p0);
  if (level < 0 || level >= SAVINGS_LEVELS.length || level === p.savingsLevel) return { player: p0 };
  p.savingsLevel = level;
  const body = `You set your retirement contribution to ${SAVINGS_LEVELS[level].label} of pay.`;
  addLog(p, body);
  return { player: p, notices: [info("Retirement Plan", body)] };
}

/** Pay-period contribution for this year: returns the amounts so processFinance can account for tax. */
export function contributionFor(p: PlayerState): { employee: number; employer: number } {
  const job = p.currentJob;
  if (!job || p.isInPrison || p.age >= 67 || p.age < 18) return { employee: 0, employer: 0 };
  const rate = SAVINGS_LEVELS[p.savingsLevel]?.rate ?? 0;
  const employee = Math.round(job.salary * rate);
  const employer = job.partTime ? 0 : Math.round(Math.min(employee * MATCH_RATE, job.salary * MATCH_CAP));
  return { employee, employer };
}

/** Balanced portfolio: mostly stocks when young, more bonds near retirement. */
export function accountReturn(p: PlayerState, rng: Rng): number {
  const stocks = Math.max(0.3, Math.min(0.8, (75 - p.age) / 60));
  return stocks * yearReturn("index", p.economy.climate, rng) + (1 - stocks) * yearReturn("bonds", p.economy.climate, rng);
}

export function growRetirement(p: PlayerState, rng: Rng) {
  if (p.retirementSavings <= 0) return;
  p.retirementSavings = Math.max(0, Math.round(p.retirementSavings * (1 + accountReturn(p, rng))));
}

/** Retirees live off the account: a sustainable share each year, taxed as income by the caller. */
export function drawdownFor(p: PlayerState): number {
  if (p.retirementSavings <= 0 || p.age < 62) return 0;
  const retired = !p.currentJob || p.age >= 70;
  if (!retired) return 0;
  const share = p.age >= 80 ? 0.1 : p.age >= 72 ? 0.07 : 0.05;
  return Math.min(p.retirementSavings, Math.round(p.retirementSavings * share));
}

export const EARLY_PENALTY = 0.3;
export const NORMAL_TAX = 0.18;

export function withdrawRetirement(p0: PlayerState, amount: number): ActionResult {
  const p = clone(p0);
  if (amount <= 0 || p.retirementSavings <= 0) return { player: p0 };
  const take = Math.min(amount, p.retirementSavings);
  const taxRate = p.age < 60 ? EARLY_PENALTY : NORMAL_TAX;
  const net = Math.round(take * (1 - taxRate));
  p.retirementSavings -= take;
  p.bankBalance += net;
  const body = `You withdrew ${money(take)} from your retirement account and received ${money(net)} after ${p.age < 60 ? "tax and an early-withdrawal penalty" : "tax"}.`;
  addLog(p, body);
  return { player: p, notices: [info("Withdrawal", body, p.age < 60 ? "bad" : "neutral")] };
}
