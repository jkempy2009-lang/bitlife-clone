/**
 * Student loans: borrow to pay tuition, interest grows while you study, then an income-driven plan takes a share of what you
 * earn above a threshold until the balance is cleared (or forgiven after 20 years of repayment). Dropping out leaves the debt.
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import { clamp, money } from "@/lib/format";
import { addLog, clone } from "./state";
import { isStudying } from "./occupation";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") => ({ kind: "info" as const, title, body, tone });

export const STUDENT_LOAN_RATE = 0.045;
/** Income you keep before repayments start. */
export const IDR_THRESHOLD = 30_000;
export const IDR_SHARE = 0.1;
export const FORGIVENESS_YEARS = 20;

/** Tuition after any scholarship, for the programme the player is in. */
export const netTuition = (full: number, scholarship: number | undefined) => Math.round(full * (1 - (scholarship ?? 0)));

/** Loan when you can't comfortably pay the first year yourself, cash otherwise. */
export function defaultFunding(p: PlayerState, firstYear: number): "cash" | "loan" {
  return p.bankBalance >= firstYear * 1.5 ? "cash" : "loan";
}

/** What an income-driven plan would take from this year's gross pay. */
export function studentLoanPayment(p: PlayerState, gross: number): number {
  const bal = p.finance.studentLoan;
  if (bal <= 0 || isStudying(p)) return 0;
  return Math.min(Math.round(bal * (1 + STUDENT_LOAN_RATE)), Math.max(0, Math.round((gross - IDR_THRESHOLD) * IDR_SHARE)));
}

/** Pay a year's tuition from cash or add it to the loan. */
export function payTuition(p: PlayerState, tuition: number) {
  if (tuition <= 0) return;
  if (p.education.funding === "loan") p.finance.studentLoan += tuition;
  else p.bankBalance -= tuition;
}

/** Yearly interest, repayment and forgiveness. Called from the finance step with the year's gross income. */
export function processStudentLoan(p: PlayerState, gross: number, notices: Notices): number {
  const f = p.finance;
  if (f.studentLoan <= 0) return 0;
  f.studentLoan = Math.round(f.studentLoan * (1 + STUDENT_LOAN_RATE));
  if (isStudying(p) || p.isInPrison) return 0;
  const pay = Math.min(f.studentLoan, Math.max(0, Math.round((gross - IDR_THRESHOLD) * IDR_SHARE)));
  p.bankBalance -= pay;
  f.studentLoan -= pay;
  f.loanRepayYears += 1;
  if (f.studentLoan > 0 && f.loanRepayYears >= FORGIVENESS_YEARS) {
    const body = `After ${FORGIVENESS_YEARS} years of repayments, the remaining ${money(f.studentLoan)} of your student loan was forgiven.`;
    addLog(p, body);
    notices.push(info("Loan Forgiven", body, "good"));
    f.studentLoan = 0;
    f.loanRepayYears = 0;
  } else if (f.studentLoan <= 0) {
    f.studentLoan = 0;
    f.loanRepayYears = 0;
    const body = "You made your final student loan payment. That's a weight off.";
    addLog(p, body);
    notices.push(info("Debt Free (Almost)", body, "good"));
  }
  return pay;
}

/** Pay the loan off early (cheaper than the 4.5% it costs to carry, if you can't beat that elsewhere). */
export function repayStudentLoan(p0: PlayerState, amount: number): ActionResult {
  const p = clone(p0);
  const pay = Math.min(amount, p.finance.studentLoan, p.bankBalance);
  if (pay <= 0) return { player: p0, notices: [info("Nothing to Repay", "You have no student debt or no spare cash.")] };
  p.bankBalance -= pay;
  p.finance.studentLoan -= pay;
  if (p.finance.studentLoan <= 0) p.finance.loanRepayYears = 0;
  p.creditScore = clamp(p.creditScore + 3, 300, 850);
  const body = `You paid ${money(pay)} towards your student loan${p.finance.studentLoan > 0 ? `; ${money(p.finance.studentLoan)} to go.` : ". It's cleared."}`;
  addLog(p, body);
  return { player: p, notices: [info("Student Loan", body, "good")] };
}
