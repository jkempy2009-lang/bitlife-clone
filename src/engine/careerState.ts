/** Defaults and save migration for the working-life and personal-finance state. */
import type { CareerLife, FinanceLife, PlayerState } from "@/types/game.types";

export function freshCareer(): CareerLife {
  return {
    burnout: 0,
    track: null,
    sectors: {},
    benefitYears: 0,
    lastPay: 0,
    gapYears: 0,
    onLeave: false,
    lastSabbatical: 0,
    blacklistUntil: 0,
    lastReview: null,
  };
}

export function freshFinance(): FinanceLife {
  return { studentLoan: 0, loanRepayYears: 0, rothSavings: 0, roth: false, bankruptUntil: 0, distressYears: 0, rentThisYear: 0 };
}

/** Old saves predate these fields: fill them in. */
export function hydrateCareerMoney(p: Pick<PlayerState, "career" | "finance">): { career: CareerLife; finance: FinanceLife } {
  return { career: { ...freshCareer(), ...(p.career ?? {}) }, finance: { ...freshFinance(), ...(p.finance ?? {}) } };
}
