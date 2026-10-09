/**
 * Long-term treatment of chronic and terminal conditions. A diagnosis is no longer a one-visit lottery:
 * you choose a plan (medication, lifestyle change, therapy, surgery, chemotherapy, palliative care...),
 * pay for it every year, and live with what it does. Plans that are dropped or become unaffordable let the
 * condition run unchecked. What care costs and how well it works depends on the country you live in.
 */
import type { ActionResult, Disease, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { profileOf } from "@/data/countryProfiles";
import { addLog, changeStat, clone, livingRelatives } from "./state";
import { killPlayer } from "./mortality";
import { careSystem, medicalPrice } from "./careCosts";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "surgery" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export interface PlanDef {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** Yearly cost before the country's care factor. */
  cost: number;
  /** One-off cost (operations). */
  upfront?: number;
  /** Multiplier on the condition's yearly toll while followed (lower is better). */
  dampen: number;
  /** Yearly chance the condition clears (remission or cure). */
  remission?: number;
  /** Yearly body and mood cost of the treatment itself. */
  sideHealth?: number;
  sideHappy?: number;
  /** Chance each year that a terminal countdown does not advance. */
  slows?: number;
  /** An operation: chance of success and the cost of failure. */
  surgery?: { success: number; risk: number };
  /** Comfort over cure: a gentle end among family. */
  palliative?: boolean;
  /** Why you can't choose this right now (or null). */
  blocker?: (p: PlayerState) => string | null;
}

const MENTAL = new Set(["anxiety", "depression", "ptsd"]);
const PALLIATIVE: PlanDef = { id: "palliative", label: "Palliative Care", emoji: "🕊️", blurb: "Comfort and dignity over cure: pain control, home visits, time with the people you love. It does not fight the illness.", cost: 9_000, dampen: 0.4, palliative: true, sideHappy: 1 };
const MEDS: PlanDef = { id: "meds", label: "Daily Medication", emoji: "💊", blurb: "A regular prescription and check-ups. Keeps symptoms down but does not cure.", cost: 900, dampen: 0.4 };
const SPECIALIST: PlanDef = { id: "specialist", label: "Specialist Programme", emoji: "🩻", blurb: "A consultant, scans and a tailored regimen. Expensive; the best control short of surgery.", cost: 4_000, dampen: 0.25, remission: 0.03 };
const lifestyleBlock = (p: PlayerState) => (p.habits.exercise >= 1 && p.habits.diet >= 1 ? null : "This only works if you also keep up exercise and a balanced diet (Habits, below).");

const PLANS: Record<string, PlanDef[]> = {
  mental: [
    { id: "therapy", label: "Talk Therapy", emoji: "🛋️", blurb: "Regular sessions. Slow, honest work that can lift the condition for good.", cost: 2_400, dampen: 0.55, remission: 0.1, sideHappy: 1 },
    { id: "meds", label: "Medication", emoji: "💊", blurb: "Prescribed daily. Steadies the worst of it; rarely a cure on its own.", cost: 700, dampen: 0.5, remission: 0.04 },
    { id: "therapy_meds", label: "Therapy + Medication", emoji: "🧠", blurb: "The gold standard: sessions and prescription together.", cost: 3_000, dampen: 0.3, remission: 0.14, sideHappy: 1 },
  ],
  chronic: [
    MEDS,
    { id: "lifestyle", label: "Lifestyle Programme", emoji: "🥗", blurb: "Supervised diet and exercise. Cheap and good for you; can send some conditions into remission.", cost: 500, dampen: 0.65, remission: 0.07, blocker: lifestyleBlock },
    SPECIALIST,
  ],
  bypass: [{ id: "bypass", label: "Bypass Surgery", emoji: "🫀", blurb: "Open-heart surgery to restore blood flow. Major, risky, and often transformative.", cost: 0, upfront: 60_000, dampen: 1, surgery: { success: 0.82, risk: 0.04 } }],
  joint: [{ id: "joint", label: "Joint Replacement", emoji: "🦴", blurb: "Swap the worn joint for a new one. Painful recovery, lasting relief.", cost: 0, upfront: 20_000, dampen: 1, surgery: { success: 0.9, risk: 0.03 } }],
  tb: [{ id: "antibiotics", label: "Six-Month Antibiotic Course", emoji: "💊", blurb: "The standard regimen. Cures most cases if you finish it.", cost: 2_500, dampen: 0.4, remission: 0.55 }, SPECIALIST],
  hiv: [{ id: "arv", label: "Antiretroviral Therapy", emoji: "💊", blurb: "Daily pills that hold the virus down so far that life is close to normal. Needs steady access to care.", cost: 12_000, dampen: 0.15 }],
  herpes: [{ id: "antivirals", label: "Antivirals", emoji: "💊", blurb: "Keeps outbreaks rare.", cost: 800, dampen: 0.4 }],
  cancer: [
    { id: "chemo", label: "Aggressive Treatment", emoji: "☢️", blurb: "Surgery, chemotherapy and radiation. Harsh on the body, and the best chance of beating it.", cost: 45_000, dampen: 0.9, remission: 0.28, sideHealth: -3, slows: 0.5 },
    { id: "trial", label: "Clinical Trial", emoji: "🧪", blurb: "An experimental therapy. Free of charge, uncertain, occasionally miraculous.", cost: 6_000, dampen: 0.9, remission: 0.12, sideHealth: -1, slows: 0.2 },
    PALLIATIVE,
  ],
  earlycancer: [
    { id: "cancer_surgery", label: "Surgery", emoji: "🔪", blurb: "Remove it while it is small. High odds of a clean result.", cost: 0, upfront: 20_000, dampen: 1, surgery: { success: 0.84, risk: 0.02 } },
    { id: "radiation", label: "Radiation Course", emoji: "☢️", blurb: "Targeted radiation over several months.", cost: 12_000, dampen: 0.7, remission: 0.5, sideHealth: -1 },
  ],
  liver: [
    { id: "hepatology", label: "Hepatology Programme", emoji: "🩺", blurb: "Specialist care to slow the damage. It only works if you have stopped drinking.", cost: 4_000, dampen: 0.6, slows: 0.4, blocker: (p) => (p.vices.alcohol > 15 ? "The clinic will not take you while you are still drinking heavily. Try rehab or quit first." : null) },
    { id: "liver_transplant", label: "Liver Transplant", emoji: "🫘", blurb: "A new liver, if you are fit enough to survive the operation.", cost: 0, upfront: 140_000, dampen: 1, surgery: { success: 0.72, risk: 0.12 }, blocker: (p) => (p.age > 70 ? "You are too old to be put on the transplant list." : p.vices.alcohol > 15 ? "Transplant teams demand you stop drinking first." : null) },
    PALLIATIVE,
  ],
  kidney: [
    { id: "dialysis", label: "Dialysis", emoji: "🩸", blurb: "Three sessions a week keep you alive. Exhausting, costly, and it holds the countdown back.", cost: 30_000, dampen: 0.7, slows: 1, sideHealth: -1 },
    { id: "kidney_transplant", label: "Kidney Transplant", emoji: "🫘", blurb: "A donor kidney. Long waits where care is thin.", cost: 0, upfront: 110_000, dampen: 1, surgery: { success: 0.78, risk: 0.07 }, blocker: (p) => (p.age > 72 ? "You are too old to be put on the transplant list." : null) },
    PALLIATIVE,
  ],
  stroke: [{ id: "stroke_rehab", label: "Stroke Rehabilitation", emoji: "🦽", blurb: "Intensive physiotherapy and secondary prevention.", cost: 8_000, dampen: 0.5, slows: 0.5 }, PALLIATIVE],
  alz: [{ id: "memory", label: "Dementia Medication & Memory Care", emoji: "🧩", blurb: "Slows the decline a little and keeps you steadier at home.", cost: 6_000, dampen: 0.8, slows: 0.35, sideHappy: 1 }, PALLIATIVE],
};

/** The plans that make sense for this condition. Mild illnesses have none (a doctor's visit sorts them out). */
export function plansFor(d: Disease): PlanDef[] {
  if (d.severity === "mild") return [];
  if (MENTAL.has(d.id)) return PLANS.mental;
  switch (d.id) {
    case "heart_disease": return [...PLANS.chronic, ...PLANS.bypass];
    case "arthritis": return [...PLANS.chronic, ...PLANS.joint];
    case "tuberculosis": return PLANS.tb;
    case "hiv": return PLANS.hiv;
    case "herpes": return PLANS.herpes;
    case "cancer": return PLANS.cancer;
    case "early_cancer": return PLANS.earlycancer;
    case "liver_disease": return PLANS.liver;
    case "kidney_failure": return PLANS.kidney;
    case "stroke": return PLANS.stroke;
    case "alzheimers": return PLANS.alz;
    default: return d.severity === "fatal" ? [SPECIALIST, PALLIATIVE] : PLANS.chronic;
  }
}

export const planById = (d: Disease, id: string | undefined): PlanDef | undefined => (id ? plansFor(d).find((x) => x.id === id) : undefined);
export const activePlan = (d: Disease): PlanDef | undefined => (d.plan && !d.lapsed ? planById(d, d.plan) : undefined);

/** How well treatment works here: thin health systems get weaker results. */
export const careEffectiveness = (p: PlayerState): number => clamp(0.35 + (profileOf(p.residence.country).careQuality / 100) * 0.9, 0.4, 1.1);

/** What the plan costs you each year where you live. */
export const planYearlyCost = (p: PlayerState, plan: PlanDef) => (plan.cost > 0 ? medicalPrice(p, plan.cost) : 0);
export const planUpfrontCost = (p: PlayerState, plan: PlanDef) => (plan.upfront ? medicalPrice(p, plan.upfront) : 0);

/** Can the system be leaned on to finance life-saving care? Only where you would otherwise go without. */
const canFinance = (p: PlayerState, d: Disease) => d.severity === "fatal" && careSystem(p.residence.country) !== "universal";
const MEDICAL_DEBT_CEILING = 250_000;

export function planBlocker(p: PlayerState, d: Disease, plan: PlanDef): string | null {
  if (p.age < 18) return "Your parents manage your care until you are 18.";
  const b = plan.blocker?.(p);
  if (b) return b;
  const price = Math.max(planUpfrontCost(p, plan), planYearlyCost(p, plan));
  if (p.bankBalance < price) {
    if (canFinance(p, d) && p.outstandingLoans < MEDICAL_DEBT_CEILING) return null;
    return `You need ${money(price)}.`;
  }
  return null;
}

/** The yearly multiplier on a condition's toll from its treatment (or the lack of it). */
export function diseaseToll(p: PlayerState, d: Disease): number {
  if (p.age < 18 && d.severity !== "mild") return profileOf(p.residence.country).careQuality >= 50 ? 0.7 : 1;
  const plan = activePlan(d);
  if (plan) return plan.dampen;
  return d.lapsed ? 1.25 : 1;
}

/** Yearly spend on treatment plans (replaces the flat cost of monitoring for conditions you treat). */
export function plansCost(p: PlayerState): number {
  let total = 0;
  for (const d of p.diseases) {
    const plan = activePlan(d);
    if (plan) total += planYearlyCost(p, plan);
  }
  return total;
}

function payUpfront(p: PlayerState, d: Disease, price: number): boolean {
  if (p.bankBalance >= price) {
    p.bankBalance -= price;
    return true;
  }
  if (!canFinance(p, d)) return false;
  const debt = price - p.bankBalance;
  p.bankBalance = 0;
  p.outstandingLoans += debt;
  p.creditScore -= 25;
  addLog(p, `You financed the bill with medical debt of ${money(debt)}.`);
  return true;
}

export function startTreatment(p0: PlayerState, diseaseId: string, planId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const d = p.diseases.find((x) => x.id === diseaseId);
  if (!d) return { player: p0 };
  const plan = planById(d, planId);
  if (!plan) return { player: p0 };
  const block = planBlocker(p, d, plan);
  if (block) return { player: p0, notices: [info("Not Possible", block, "bad")] };
  if (d.plan === plan.id && !d.lapsed) return { player: p0 };
  if (plan.surgery) {
    if ((p.annual.surgeryTx ?? 0) >= 1) return { player: p0, notices: [info("Recovering", "Your body needs a year between major operations.")] };
    const price = planUpfrontCost(p, plan);
    if (!payUpfront(p, d, price)) return { player: p0, notices: [info("Can't Afford It", `${plan.label} costs ${money(price)}.`, "bad")] };
    p.annual.surgeryTx = 1;
    const ageDrag = Math.max(0, (p.age - 60) / 100);
    const success = clamp((plan.surgery.success - ageDrag + (p.health - 50) / 400) * careEffectiveness(p), 0.2, 0.97);
    const died = p.age >= 50 && rng.chance(plan.surgery.risk * (1.4 - careEffectiveness(p) / 2) * (p.health < 35 ? 2 : 1));
    if (died) {
      addLog(p, `You did not wake up from ${plan.label.toLowerCase()}. The surgeons did everything they could.`);
      killPlayer(p, `complications of ${plan.label.toLowerCase()}`);
      return { player: p, notices: [info("Surgery Failed", `You did not survive ${plan.label.toLowerCase()}. The family was at your bedside for hours beforehand.`, "bad")] };
    }
    if (rng.chance(success)) {
      p.diseases = p.diseases.filter((x) => x.id !== d.id);
      changeStat(p, "health", 6);
      changeStat(p, "happiness", 6);
      const body = `${plan.label} went well. ${d.name} is behind you. Recovery takes months, but you can feel the difference.`;
      addLog(p, body);
      if (d.id === "early_cancer" || d.id === "cancer") markSurvivor(p);
      return { player: p, notices: [info("Operation Successful", body, "surgery")] };
    }
    changeStat(p, "health", -8);
    changeStat(p, "happiness", -5);
    const body = `${plan.label} did not fully work. You are weaker for it and ${d.name} remains.`;
    addLog(p, body);
    return { player: p, notices: [info("Operation Unsuccessful", body, "bad")] };
  }
  d.plan = plan.id;
  d.planSince = p.year;
  d.lapsed = false;
  d.treatedYears = 0;
  const price = planYearlyCost(p, plan);
  const body = `You started ${plan.label.toLowerCase()} for ${d.name}${price > 0 ? ` at about ${money(price)} a year` : ""}. ${plan.palliative ? "The focus is now on comfort and time with your family." : "It will be reviewed every year."}`;
  addLog(p, body);
  return { player: p, notices: [info("Treatment Plan", body, "good")] };
}

export function stopTreatment(p0: PlayerState, diseaseId: string): ActionResult {
  const p = clone(p0);
  const d = p.diseases.find((x) => x.id === diseaseId);
  if (!d || !d.plan) return { player: p0 };
  const body = `You stopped treatment for ${d.name}. Without it, the condition will take its full toll.`;
  d.plan = undefined;
  d.planSince = undefined;
  d.lapsed = false;
  d.treatedYears = 0;
  addLog(p, body);
  return { player: p, notices: [info("Treatment Stopped", body, "bad")] };
}

/** A cancer survivor: it can come back. */
function markSurvivor(p: PlayerState) {
  p.flags = p.flags.filter((f) => !f.startsWith("cancer_survivor:"));
  p.flags.push(`cancer_survivor:${p.year}`);
}

export const isCancerSurvivor = (p: PlayerState) => p.flags.some((f) => f.startsWith("cancer_survivor:"));

/** Runs once a year during Age Up, after finances have charged the plan fees. */
export function processTreatment(p: PlayerState, rng: Rng, notices: Notices, addDisease: (p: PlayerState, id: string, rng: Rng) => boolean) {
  // Survivors: a few years of risk of recurrence.
  const sv = p.flags.find((f) => f.startsWith("cancer_survivor:"));
  if (sv) {
    const since = Number(sv.split(":")[1]);
    if (p.year - since > 8) p.flags = p.flags.filter((f) => f !== sv);
    else if (!p.diseases.some((d) => d.id === "cancer" || d.id === "early_cancer") && rng.chance(0.035)) {
      p.flags = p.flags.filter((f) => f !== sv);
      if (addDisease(p, "cancer", rng)) notices.push(info("It's Back", "A routine scan showed the cancer has returned.", "bad"));
    }
  }
  const eff = careEffectiveness(p);
  // Couldn't pay this year's fees? Care lapses, except where life depends on it and debt can cover it.
  const broke = p.bankBalance < 0;
  for (const d of [...p.diseases]) {
    const plan = activePlan(d);
    if (!plan) continue;
    if (broke && !canFinance(p, d)) {
      const cost = planYearlyCost(p, plan);
      p.bankBalance += cost;
      d.lapsed = true;
      d.treatedYears = 0;
      const body = `You could no longer afford ${plan.label.toLowerCase()} for ${d.name}. Without it, the condition runs unchecked.`;
      addLog(p, body);
      notices.push(info("Treatment Lapsed", body, "bad"));
      continue;
    }
    d.treatedYears = (d.treatedYears ?? 0) + 1;
    if (plan.sideHealth) changeStat(p, "health", plan.sideHealth);
    if (plan.sideHappy) changeStat(p, "happiness", plan.sideHappy);
    if (plan.remission && !d.incurable) {
      // Lifestyle programmes only reverse the conditions lifestyle causes, and persistence helps.
      const reversible = plan.id !== "lifestyle" || ["diabetes", "hypertension"].includes(d.id);
      const chance = reversible ? clamp(plan.remission * eff * (1 + Math.min(3, d.treatedYears) * 0.15) * (p.age > 75 ? 0.7 : 1), 0, 0.85) : 0;
      if (chance > 0 && rng.chance(chance)) {
        p.diseases = p.diseases.filter((x) => x.id !== d.id);
        changeStat(p, "happiness", 6);
        changeStat(p, "health", 3);
        const body = d.severity === "fatal" ? `Scans show ${d.name} in remission. After everything, you have been given time back.` : `After a year of ${plan.label.toLowerCase()}, ${d.name} has gone into remission.`;
        addLog(p, body);
        notices.push(info(d.severity === "fatal" ? "Remission!" : "Much Better", body, "good"));
        if (d.id === "cancer" || d.id === "early_cancer") markSurvivor(p);
      }
    }
  }
}

/** Does the fatal countdown pause this year? (Called from the yearly disease loop.) */
export function slowsCountdown(d: Disease, rng: Rng): boolean {
  const plan = activePlan(d);
  return !!plan?.slows && rng.chance(plan.slows);
}

/** Cause-of-death wording that reflects how the end came. */
export function deathPhrase(p: PlayerState, d: Disease): string {
  const plan = activePlan(d);
  const base = d.name.toLowerCase();
  if (plan?.palliative) return `${base}, peacefully under palliative care${livingRelatives(p).some((r) => r.relation !== "Pet") ? ", with family at your side" : ""}`;
  return base;
}

/** Palliative care eases the end for the people around you too. */
export function palliativeFarewell(p: PlayerState, d: Disease) {
  if (!activePlan(d)?.palliative) return;
  for (const r of livingRelatives(p)) if (r.relation === "Child" || r.relation === "Partner" || r.relation === "Sibling") r.relationshipBar = clamp(r.relationshipBar + 8);
}
