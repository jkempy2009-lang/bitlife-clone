/**
 * Health beyond the hit points: standing habits, what care costs where you live, chronic-illness
 * expenses, and how lifestyle shifts disease risk.
 */
import type { ActionResult, PlayerState, Vices } from "@/types/game.types";
import { money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner } from "./state";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export const EXERCISE_LEVELS = [
  { name: "Sedentary", emoji: "🛋️", cost: 0, blurb: "Sofa, screens, taxis. Free, restful, and slowly costly: health slips, heart disease and diabetes get likelier." },
  { name: "Active", emoji: "🚶", cost: 0, blurb: "Regular walks, the odd sport. The baseline." },
  { name: "Dedicated", emoji: "🏃", cost: 1_200, blurb: "Gym membership, early runs, a coach now and then. Better health, looks and heart; takes real time." },
] as const;

export const DIET_LEVELS = [
  { name: "Whatever's Fast", emoji: "🍟", cost: 0, blurb: "Takeaway and snacks. Cheap and cheerful now, hard on your body later." },
  { name: "Balanced", emoji: "🥗", cost: 0, blurb: "Mostly home cooking. The baseline." },
  { name: "Disciplined", emoji: "🥦", cost: 1_800, blurb: "Meal-prepped and measured. Lowers disease risk, slightly dulls the fun." },
] as const;

export function setHabit(p0: PlayerState, kind: "exercise" | "diet", level: number): ActionResult {
  const p = clone(p0);
  if (level < 0 || level > 2 || p.habits[kind] === level) return { player: p0 };
  if (p.age < 12) return { player: p0, notices: [info("Too Young", "Your parents decide that for now.")] };
  p.habits[kind] = level;
  const name = kind === "exercise" ? EXERCISE_LEVELS[level].name : DIET_LEVELS[level].name;
  const body = `You changed your ${kind} routine: ${name.toLowerCase()}.`;
  addLog(p, body);
  return { player: p, notices: [info("New Routine", body)] };
}

/** Yearly cost of the chosen routine. */
export function habitCost(p: PlayerState): number {
  return EXERCISE_LEVELS[p.habits.exercise].cost + DIET_LEVELS[p.habits.diet].cost;
}

/** Yearly body effects of the routine, applied during Age Up. */
export function applyHabitEffects(p: PlayerState) {
  if (p.age < 12) return;
  const { exercise, diet } = p.habits;
  if (exercise === 0) {
    changeStat(p, "health", -1);
    changeStat(p, "happiness", 1);
  } else if (exercise === 2) {
    changeStat(p, "health", 2);
    if (p.age < 55) changeStat(p, "looks", 1);
    p.skills.athletics = Math.min(100, p.skills.athletics + 1);
  }
  if (diet === 0) {
    changeStat(p, "health", -1);
    changeStat(p, "happiness", 1);
  } else if (diet === 2) {
    changeStat(p, "health", 1);
    changeStat(p, "happiness", -1);
  }
  // Money is deducted by the caller (processFinance) via habitCost.
}

// ---------------------------------------------------------------------------
// Care costs by country
// ---------------------------------------------------------------------------

type CareSystem = "universal" | "insured" | "private";

const CARE_SYSTEM: Record<string, CareSystem> = {
  "United States": "insured",
  India: "private",
  Brazil: "private",
  Mexico: "private",
  Nigeria: "private",
};

export const careSystem = (country: string): CareSystem => CARE_SYSTEM[country] ?? "universal";

/** Employed (or married to someone who is) in an insurance-based system. */
export function hasInsurance(p: PlayerState): boolean {
  const sys = careSystem(p.residence.country);
  if (sys === "universal") return true;
  if (p.pension > 0 && p.age >= 65) return true;
  if (p.currentJob && !p.currentJob.partTime) return true;
  const partner = getPartner(p);
  return !!partner && partner.partnerStatus === "married" && partner.incomeTier >= 2;
}

/** Multiplier on medical prices. */
export function medicalCostFactor(p: PlayerState): number {
  const sys = careSystem(p.residence.country);
  if (sys === "universal") return 0.15;
  if (sys === "insured") return hasInsurance(p) ? 0.3 : 1.8;
  return 1;
}

export const medicalPrice = (p: PlayerState, base: number) => Math.max(5, Math.round(base * medicalCostFactor(p)));

/** Yearly cost of living with chronic or terminal conditions (drugs, appointments, home care). */
export function illnessCosts(p: PlayerState): number {
  let base = 0;
  for (const d of p.diseases) {
    if (d.severity === "chronic" && d.id !== "early_cancer") base += 700;
    else if (d.severity === "chronic") base += 4_000;
    else if (d.severity === "fatal") base += 9_000;
  }
  return Math.round(base * medicalCostFactor(p));
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

const CARDIO = new Set(["diabetes", "hypertension", "heart_disease", "stroke", "kidney_failure"]);

/** How much more (or less) likely this lifestyle makes a given diagnosis. */
export function riskMultiplier(p: PlayerState, diseaseId: string): number {
  let m = 1;
  if (CARDIO.has(diseaseId)) {
    m *= [1.6, 1, 0.6][p.habits.exercise] * [1.4, 1, 0.75][p.habits.diet];
  }
  if (diseaseId === "copd" || diseaseId === "cancer" || diseaseId === "early_cancer") m *= 1 + p.vices.smoking / 60;
  if (diseaseId === "liver_disease") m *= 1 + p.vices.alcohol / 40;
  if (diseaseId === "anxiety" || diseaseId === "depression") {
    m *= 1 + Math.max(0, 40 - p.happiness) / 50;
    m *= p.effort === "grind" ? 1.35 : p.effort === "coast" ? 0.85 : 1;
    m *= p.habits.exercise === 2 ? 0.8 : p.habits.exercise === 0 ? 1.2 : 1;
    m *= 1 + p.vices.drugs / 80;
  }
  if (diseaseId === "broken_bone" && p.habits.exercise === 2) m *= 1.3;
  return m;
}

export const vicesLabel = (v: Vices) => Object.entries(v).filter(([, n]) => n > 0).map(([k]) => k).join(", ");

export function describeCost(p: PlayerState, base: number): string {
  return money(medicalPrice(p, base));
}

/** Mood isn't just a number: misery wears the body and work down, contentment protects them. */
export function applyMoodEffects(p: PlayerState) {
  if (p.age < 8) return;
  if (p.happiness < 25) {
    changeStat(p, "health", p.happiness < 10 ? -3 : -2);
    if (p.currentJob) p.currentJob.performance = Math.max(0, p.currentJob.performance - 3);
    for (const r of p.relatives) if (r.alive && (r.relation === "Partner" || r.relation === "Friend")) r.relationshipBar = Math.max(0, r.relationshipBar - 1);
  } else if (p.happiness >= 80) {
    if (p.age < 65) changeStat(p, "health", 1);
    if (p.currentJob) p.currentJob.performance = Math.min(100, p.currentJob.performance + 1);
  }
}
