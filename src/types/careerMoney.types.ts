/** Persistent state for working life (burnout, sector cycles, jobless spells) and personal finance (loans, Roth, insolvency). */

export type CareerTrack = "ic" | "mgmt";

export type ReviewRating = "star" | "solid" | "weak";

export interface SectorMood {
  kind: "slump" | "boom";
  /** Last year (inclusive) the mood lasts. */
  until: number;
}

export interface CareerLife {
  /** 0-100. Climbs with grinding, extra pushes, demanding sectors and small kids; falls with rest. */
  burnout: number;
  /** Chosen at the first senior promotion: management or hands-on specialist. */
  track: CareerTrack | null;
  /** Career category (Technology, Healthcare...) to its current slump or boom. */
  sectors: Record<string, SectorMood>;
  /** Years of unemployment insurance still available. */
  benefitYears: number;
  /** Salary the benefit is based on. */
  lastPay: number;
  /** Consecutive adult years without work; long gaps hurt hiring odds. */
  gapYears: number;
  /** On unpaid leave this year (sabbatical or medical leave). Cleared by the Age Up. */
  onLeave: boolean;
  /** Year of the last sabbatical (0 = never). */
  lastSabbatical: number;
  /** A burned bridge: hiring is harder until this year. */
  blacklistUntil: number;
  lastReview: { year: number; rating: ReviewRating; bonus: number } | null;
}

export interface FinanceLife {
  /** Student loan principal plus accrued interest. */
  studentLoan: number;
  /** Years spent repaying (income-driven plans are forgiven after 20). */
  loanRepayYears: number;
  /** After-tax retirement account (withdrawals are tax free). */
  rothSavings: number;
  /** New retirement contributions go to the Roth account instead of the pre-tax one. */
  roth: boolean;
  /** Year a personal bankruptcy stops weighing on credit (0 = none). */
  bankruptUntil: number;
  /** Consecutive years of debt crisis (drives collections, repossession and foreclosure). */
  distressYears: number;
  /** Rent collected from tenants this year, taxed with the rest of income. */
  rentThisYear: number;
}
