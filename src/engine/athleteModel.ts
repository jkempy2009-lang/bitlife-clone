/**
 * Pure calculators for the athlete career: age curves, ratings, contracts, injuries and season results.
 * Nothing here mutates player state; athleteSeason.ts / athleteCareer.ts apply the results.
 */
import type { AthleteInjury, AthleteOffer, AthleteState, Effort, PlayerState, SeasonRecord } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { CITY_PREFIXES, LEAGUE_BASE_SALARY, LEAGUE_MIN, sportInfo } from "@/data/sports";

export const gauss = (rng: Rng, mean = 0, sd = 1) => mean + sd * (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.732;
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Share of potential you convert at each training load. */
export const EFFORT_MULT: Record<Effort, number> = { grind: 0.96, steady: 0.9, coast: 0.55 };
/** How fast the rating moves toward its target each year. */
export const EFFORT_SPEED: Record<Effort, number> = { grind: 0.62, steady: 0.5, coast: 0.35 };
export const INJURY_LOAD: Record<Effort, number> = { grind: 1.55, steady: 1, coast: 0.85 };
export const CONSISTENCY_STEP: Record<Effort, number> = { grind: 12, steady: 8, coast: -25 };

export const MIN_AGE = 8;
export const SCHOLARSHIP_AGES: [number, number] = [18, 20];
export const ACADEMY_AGES: [number, number] = [15, 19];
export const RULES = {
  academyProj: 58,
  scholarshipProj: 55,
  scholarshipRating: 38,
  scholarshipGrades: 55,
  scholarshipSmarts: 35,
  semiproRating: LEAGUE_MIN[0] - 2,
  proEarlyRating: 64,
  proEarlyAges: [17, 20] as [number, number],
  proRating: LEAGUE_MIN[1],
};

export const INJURY_TABLE = {
  /** Weeks-to-years: seasons missed after the injury season. */
  yearsLeft: [0, 1, 2, 3],
  ratingLoss: [0, 1.5, 4, 9],
  health: [4, 8, 14, 22],
};

// ---------------------------------------------------------------------------
// Age curves and ratings
// ---------------------------------------------------------------------------

export function ceilingFor(talent: number): number {
  return 27 + talent * 0.7;
}

/** Fraction of potential available at an age (1 once you reach the start of the sport's prime). */
export function maturity(sport: string | null, age: number): number {
  const [p0] = sportInfo(sport).peak;
  return Math.pow(clamp((age - 7) / (p0 - 7), 0, 1), 0.85);
}

export const experience = (years: number) => Math.min(1, 0.22 + 0.085 * years);

export type Phase = "rising" | "prime" | "declining";

export function phaseFor(sport: string | null, age: number): { phase: Phase; yearsToPeak: number; yearsPast: number } {
  const [p0, p1] = sportInfo(sport).peak;
  if (age < p0) return { phase: "rising", yearsToPeak: p0 - age, yearsPast: 0 };
  if (age <= p1) return { phase: "prime", yearsToPeak: 0, yearsPast: 0 };
  return { phase: "declining", yearsToPeak: 0, yearsPast: age - p1 };
}

export function declineAmount(sport: string | null, age: number): number {
  const [, p1] = sportInfo(sport).peak;
  const past = age - p1;
  if (past <= 0) return 0;
  return sportInfo(sport).decline * (1 + 0.18 * (past - 1));
}

/** Rating including temporary effects (doping boost, playing through pain). */
export function effRating(a: AthleteState): number {
  return a.rating + (a.doping ? 4 : 0) - (a.injury?.plan === "play" ? 12 : 0);
}

/** What scouts project your peak to be (age-adjusted). */
export function projected(a: AthleteState, age: number): number {
  const lim = clamp(Math.min(maturity(a.sport, age), experience(a.years)), 0.2, 1);
  return Math.min(100, a.rating / lim);
}

/** One year of ability change. Returns the new rating. */
export function nextRating(a: AthleteState, age: number, effort: Effort, health: number, rng: Rng): number {
  const info = sportInfo(a.sport);
  const consPenalty = Math.max(0, 60 - a.consistency) / 300;
  const eff = Math.max(0.2, EFFORT_MULT[effort] - consPenalty) + (a.doping ? 0.05 : 0);
  const [, p1] = info.peak;
  let r = a.rating;
  if (age <= p1) {
    const cap = Math.min(maturity(a.sport, age), experience(a.years));
    const target = ceilingFor(a.talent) * cap * eff;
    r += (target - r) * EFFORT_SPEED[effort] + gauss(rng, 0, 1.2);
  } else {
    const care = effort === "coast" ? 1.4 : effort === "steady" ? 0.85 : 1;
    r -= declineAmount(a.sport, age) * care * (health < 50 ? 1.2 : 1) * (a.doping ? 0.8 : 1);
    r += gauss(rng, 0, 0.8);
  }
  return clamp(r, 0, 100);
}

export const leagueFor = (rating: number): number => {
  let l = -1;
  for (let i = 0; i < LEAGUE_MIN.length; i++) if (rating >= LEAGUE_MIN[i]) l = i;
  return l;
};

export function potentialGrade(a: AthleteState, age: number): string {
  const proj = projected(a, age);
  const grades: [number, string][] = [[88, "A+"], [80, "A"], [72, "B+"], [64, "B"], [56, "C+"], [48, "C"], [38, "D"]];
  return grades.find(([m]) => proj >= m)?.[1] ?? "E";
}

// ---------------------------------------------------------------------------
// Contracts and money
// ---------------------------------------------------------------------------

export function contractSalary(sport: string | null, league: number, rating: number, rng: Rng, agent = false): number {
  const info = sportInfo(sport);
  const base = LEAGUE_BASE_SALARY[league] * info.pay;
  const span = league === 3 ? 14 : 12;
  const t = clamp((rating - LEAGUE_MIN[league]) / span, 0, 1.2);
  const mult = league < 3 ? 0.7 + 0.9 * t : 1 + 4.5 * Math.pow(Math.min(1, t), 1.7);
  const floor = league === 0 ? 18_000 : 0;
  return Math.max(floor, Math.round((base * mult * rng.float(0.88, 1.15) * (agent ? 1.06 : 1)) / 500) * 500);
}

export function contractYears(league: number, age: number, rng: Rng): number {
  const ranges: [number, number][] = [[1, 2], [2, 3], [3, 5], [4, 6]];
  let y = rng.int(ranges[league][0], ranges[league][1]);
  if (age < 21) y += 1;
  if (age >= 33) y = Math.min(y, 2);
  return y;
}

export function endorsementIncome(p: PlayerState, a: AthleteState, titlesThisSeason: number): number {
  if (a.banYears > 0 || p.fame < 30) return 0;
  const info = sportInfo(a.sport);
  if (a.stage === "youth") return 0;
  const stageMult = a.stage === "college" ? 0.15 : a.stage === "retired" ? 0.3 : [0.2, 0.5, 1, 3][a.league];
  let v = Math.pow(p.fame - 25, 2) * 120 * stageMult * info.endorse * (a.agent ? 1.25 : 1) * (1 + 0.25 * Math.min(2, titlesThisSeason));
  if (p.fame >= 90 && a.record.bestRating >= 92) v *= 2;
  return Math.round(v / 100) * 100;
}

export function clubName(sport: string | null, league: number, rng: Rng): string {
  const info = sportInfo(sport);
  return `${rng.pick(CITY_PREFIXES)} ${rng.pick(info.clubNouns)}`;
}

export function makeOffer(kind: AthleteOffer["kind"], sport: string | null, league: number, rating: number, age: number, agent: boolean, rng: Rng, note: string, club?: string): AthleteOffer {
  const salary = contractSalary(sport, league, rating, rng, agent);
  return {
    id: rng.id(),
    kind,
    club: club ?? clubName(sport, league, rng),
    league,
    salary,
    years: contractYears(league, age, rng),
    bonus: league >= 1 ? Math.round((salary * rng.float(0.1, 0.3)) / 500) * 500 : 0,
    note,
  };
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

export function injuryChance(p: PlayerState, a: AthleteState, effort: Effort): number {
  const info = sportInfo(a.sport);
  const ageMult = p.age < 14 ? 0.5 : p.age <= 29 ? 1 : p.age <= 33 ? 1.25 : 1.5;
  const healthMult = p.health < 55 ? 1.4 : p.health > 85 ? 0.9 : 1;
  return clamp(info.injury * INJURY_LOAD[effort] * ageMult * healthMult * (a.doping ? 1.2 : 1), 0, 0.6);
}

export function rollInjury(p: PlayerState, a: AthleteState, effort: Effort, rng: Rng, forceSeverity?: number): AthleteInjury {
  const info = sportInfo(a.sport);
  let sev = forceSeverity ?? 1;
  if (!forceSeverity) {
    const older = p.age >= 31;
    const w = effort === "grind" ? [0.5, 0.29, 0.17, 0.04] : older ? [0.45, 0.3, 0.19, 0.06] : [0.55, 0.28, 0.14, 0.03];
    const soft = a.sport === "Golf" || a.sport === "Swimming" ? 0.5 : 1;
    const weights = [w[0], w[1], w[2] * soft, w[3] * soft * (a.sport === "Boxing" ? 2.5 : 1)];
    const pick = rng.weighted([1, 2, 3, 4], (s) => weights[s - 1]) ?? 1;
    sev = pick;
  }
  return {
    label: info.injuries[sev - 1],
    severity: sev,
    yearsLeft: INJURY_TABLE.yearsLeft[sev - 1],
    plan: "rest",
    ratingLoss: INJURY_TABLE.ratingLoss[sev - 1],
    decided: false,
    age: p.age,
  };
}

export function injuryCost(a: AthleteState, plan: AthleteInjury["plan"], severity: number): number {
  const clubPays = a.stage === "pro" && a.league >= 1;
  if (plan === "rehab") return clubPays ? 0 : 2_500 * severity;
  if (plan === "surgery") return clubPays ? 0 : 14_000 * severity;
  return 0;
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export interface SeasonOutcome {
  played: boolean;
  place: number | null;
  teams: number;
  titles: number;
  award: string | null;
  medal: "gold" | "silver" | "bronze" | null;
  major: string | null;
  caps: number;
  summary: string;
  fame: number;
  happiness: number;
  score: number;
}

const TEAMS = { youth: 12, college: 16, semipro: 18, pro: 20 } as const;

export function leagueLabel(a: AthleteState): string {
  const info = sportInfo(a.sport);
  if (a.stage === "youth") return "Youth league";
  if (a.stage === "college") return a.track === "academy" ? "Academy league" : "College league";
  return info.leagues[a.league];
}

/** Reference rating of a solid player in the competition you're in. */
export function referenceRating(a: AthleteState, age: number): number {
  if (a.stage === "youth") return 62 * Math.min(1, maturity(a.sport, age)) * 0.9;
  if (a.stage === "college") return 60 * Math.min(1, maturity(a.sport, age)) + 4;
  return LEAGUE_MIN[a.league] + 5 + (a.league === 3 ? 5 : 0);
}

const FAME_BASE: Record<string, number[]> = {
  youth: [0.2, 0.2, 0.2, 0.2],
  college: [0.5, 0.5, 0.5, 0.5],
  semipro: [0.3, 0.3, 0.3, 0.3],
  pro: [0.3, 0.8, 2, 3.5],
};
const FAME_TITLE = [1.5, 3, 5, 8];

export function playSeason(p: PlayerState, a: AthleteState, rng: Rng, opts: { missed: boolean; reason?: "injury" | "ban" | "unattached"; hurtSeverity: number; label?: string }): SeasonOutcome {
  const info = sportInfo(a.sport);
  const stage = a.stage === "youth" || a.stage === "college" || a.stage === "semipro" || a.stage === "pro" ? a.stage : "pro";
  const teams = TEAMS[stage];
  const lg = leagueLabel(a);
  const out: SeasonOutcome = { played: !opts.missed, place: null, teams, titles: 0, award: null, medal: null, major: null, caps: 0, summary: "", fame: 0, happiness: 0, score: 0 };
  if (opts.missed) {
    out.summary =
      opts.reason === "unattached" ? "Unattached all season: no club." : opts.reason === "ban" ? "Sat out the season." : `Missed the season injured (${opts.label ?? "injury"}).`;
    out.happiness = opts.reason === "unattached" ? -3 : -4;
    return out;
  }
  const eff = effRating(a);
  const delta = eff - referenceRating(a, p.age);
  const score = delta + gauss(rng, 0, 7) + (a.form - 50) * 0.12 - opts.hurtSeverity * 8;
  out.score = score;
  out.place = clamp(Math.round(1 + (teams - 1) * clamp(0.5 - score / 45, 0, 1)), 1, teams);
  const pTitle = sigmoid((score - 18) / 5.5);
  const senior = stage !== "youth";
  if (info.team) {
    if (rng.chance(pTitle)) {
      out.titles += 1;
      out.place = 1;
    }
    if (rng.chance(pTitle * 0.6)) out.titles += 1;
  } else if (score >= 14) {
    out.titles = Math.min(6, Math.floor((score - 10) / 12 + rng.float(0, 1)));
    if (out.titles > 0) out.place = Math.min(out.place, 2);
  }
  const awardName = stage === "youth" ? "Young Player of the Year" : info.award;
  if (rng.chance(clamp((score - 14) / 55, 0, 0.35))) out.award = awardName;

  // International caps and the four-yearly major
  const isMajorYear = p.year % 4 === info.major.offset;
  const qualifies = senior && ((a.stage === "pro" && a.league >= 1 && eff >= (info.team ? 70 : 64)) || (a.stage === "college" && eff >= 70));
  if (qualifies && info.team && a.league >= 2) out.caps = rng.int(2, 9);
  if (qualifies && isMajorYear) {
    const s2 = score + gauss(rng, 0, 8) - (info.team ? 4 : 0);
    out.major = info.major.name;
    if (s2 >= 26) out.medal = "gold";
    else if (s2 >= 20) out.medal = "silver";
    else if (s2 >= 15) out.medal = "bronze";
  }

  // Fame and mood
  const lgIdx = a.stage === "pro" || a.stage === "semipro" ? a.league : 0;
  let fame = FAME_BASE[stage][lgIdx];
  fame += out.titles * FAME_TITLE[lgIdx] * (senior ? 1 : 0.15);
  if (out.award) fame += (senior ? 3 : 0.5) * (1 + lgIdx * 0.5);
  if (out.place !== null && out.place <= 3 && senior) fame += 0.5 * (lgIdx + 1);
  if (out.medal) fame += out.medal === "gold" ? 14 : out.medal === "silver" ? 9 : 6;
  else if (out.major) fame += 2;
  if (out.caps) fame += 1;
  if (stage === "youth" && a.stage === "youth" && out.titles > 0) fame += 0.5;
  fame *= clamp(1.2 - p.fame / 100, 0.35, 1);
  out.fame = Math.round(fame * 10) / 10;
  out.happiness = (out.titles > 0 || out.medal ? 6 : 0) + (out.award ? 3 : 0) - (out.place !== null && out.place >= teams - 2 ? 3 : 0) + (a.form < 30 ? -2 : 0);

  // Summary text
  const parts: string[] = [];
  if (info.team) parts.push(out.place === 1 ? `${lg}: champions!` : `${lg}: finished ${ordinal(out.place)} of ${teams}.`);
  else parts.push(`${lg}: ${out.titles > 0 ? `won ${out.titles} title${out.titles > 1 ? "s" : ""}, ` : ""}ranked #${out.place} of ${teams}.`);
  if (info.team && out.titles > 1) parts.push("Added a cup double.");
  if (out.medal) parts.push(`${info.major.name}: ${out.medal} medal!`);
  else if (out.major) parts.push(`Competed at the ${info.major.name}.`);
  if (out.caps) parts.push(`${out.caps} international caps.`);
  if (out.award) parts.push(`${out.award}.`);
  if (opts.hurtSeverity > 0) parts.push(`Hampered by a ${opts.label ?? "injury"}.`);
  out.summary = parts.join(" ");
  return out;
}

export function toRecord(p: PlayerState, a: AthleteState, o: SeasonOutcome, earnings: number): SeasonRecord {
  return {
    age: p.age,
    year: p.year,
    stage: a.stage,
    club: a.club || leagueLabel(a),
    league: a.league,
    rating: Math.round(a.rating),
    place: o.place,
    summary: o.summary,
    titles: o.titles + (o.medal === "gold" ? 1 : 0),
    award: o.award,
    earnings: Math.round(earnings),
  };
}
