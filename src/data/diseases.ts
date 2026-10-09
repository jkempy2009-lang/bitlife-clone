import type { Disease, Severity } from "@/types/game.types";
import type { Region } from "./countryProfiles";

export interface DiseaseTemplate {
  id: string;
  name: string;
  severity: Severity;
  happinessImpact: number;
  healthImpact: number;
  minAge: number;
  incurable?: boolean;
  /** Baseline yearly chance of contracting (before age/health scaling). */
  baseChance: number;
  /** Fatal diseases: [min, max] years left. */
  fatalYears?: [number, number];
  /** Spreads person to person: scaled by the country's sanitation and by outbreaks. */
  infectious?: boolean;
  /** Odds multiplier by region (malaria is an African disease, not a Swedish one). */
  regional?: Partial<Record<Region, number>>;
  /** Multiplier in regions not listed above (default 1). */
  elsewhere?: number;
  /** Only caught while this kind of world event is under way. */
  gate?: "pandemic";
}

export const DISEASE_CATALOG: DiseaseTemplate[] = [
  { id: "cold", name: "Common Cold", severity: "mild", happinessImpact: 2, healthImpact: 3, minAge: 0, baseChance: 0.18 },
  { id: "flu", name: "Influenza", severity: "mild", happinessImpact: 4, healthImpact: 6, minAge: 0, baseChance: 0.1 },
  { id: "food_poisoning", name: "Food Poisoning", severity: "mild", happinessImpact: 4, healthImpact: 5, minAge: 2, baseChance: 0.05 },
  { id: "broken_bone", name: "Broken Bone", severity: "mild", happinessImpact: 5, healthImpact: 8, minAge: 3, baseChance: 0.03 },
  { id: "pneumonia", name: "Pneumonia", severity: "mild", happinessImpact: 5, healthImpact: 10, minAge: 0, baseChance: 0.02 },
  { id: "asthma", name: "Asthma", severity: "chronic", happinessImpact: 2, healthImpact: 1, minAge: 2, baseChance: 0.008 },
  { id: "anxiety", name: "Anxiety Disorder", severity: "chronic", happinessImpact: 6, healthImpact: 0, minAge: 12, baseChance: 0.012 },
  { id: "depression", name: "Depression", severity: "chronic", happinessImpact: 9, healthImpact: 0, minAge: 12, baseChance: 0.012 },
  { id: "migraines", name: "Chronic Migraines", severity: "chronic", happinessImpact: 4, healthImpact: 1, minAge: 14, baseChance: 0.008 },
  { id: "diabetes", name: "Type 2 Diabetes", severity: "chronic", happinessImpact: 3, healthImpact: 2, minAge: 30, baseChance: 0.012 },
  { id: "hypertension", name: "Hypertension", severity: "chronic", happinessImpact: 1, healthImpact: 2, minAge: 35, baseChance: 0.02 },
  { id: "arthritis", name: "Arthritis", severity: "chronic", happinessImpact: 3, healthImpact: 2, minAge: 45, baseChance: 0.025 },
  { id: "copd", name: "Lung Disease (COPD)", severity: "chronic", happinessImpact: 3, healthImpact: 3, minAge: 45, baseChance: 0.01 },
  { id: "heart_disease", name: "Heart Disease", severity: "chronic", happinessImpact: 3, healthImpact: 3, minAge: 45, baseChance: 0.012 },
  { id: "early_cancer", name: "Early-Stage Cancer", severity: "chronic", happinessImpact: 6, healthImpact: 3, minAge: 25, baseChance: 0 },
  { id: "liver_disease", name: "Liver Disease", severity: "fatal", happinessImpact: 5, healthImpact: 6, minAge: 25, baseChance: 0, fatalYears: [3, 8] },
  { id: "ptsd", name: "PTSD", severity: "chronic", happinessImpact: 7, healthImpact: 1, minAge: 18, baseChance: 0 },
  { id: "chlamydia", name: "Chlamydia", severity: "mild", happinessImpact: 3, healthImpact: 3, minAge: 14, baseChance: 0 },
  { id: "herpes", name: "Herpes", severity: "chronic", incurable: true, happinessImpact: 3, healthImpact: 0, minAge: 14, baseChance: 0 },
  { id: "hiv", name: "HIV", severity: "chronic", incurable: true, happinessImpact: 4, healthImpact: 3, minAge: 14, baseChance: 0 },
  { id: "malaria", name: "Malaria", severity: "mild", happinessImpact: 5, healthImpact: 11, minAge: 0, baseChance: 0.03, infectious: true, regional: { africa: 8, south_asia: 1.6, latin_america: 0.8 }, elsewhere: 0 },
  { id: "waterborne", name: "Typhoid & Waterborne Illness", severity: "mild", happinessImpact: 4, healthImpact: 8, minAge: 0, baseChance: 0.02, infectious: true, regional: { africa: 4, south_asia: 4, latin_america: 1.5 }, elsewhere: 0.15 },
  { id: "tuberculosis", name: "Tuberculosis", severity: "chronic", happinessImpact: 4, healthImpact: 5, minAge: 5, baseChance: 0.003, infectious: true, regional: { africa: 8, south_asia: 8, latin_america: 2, east_asia: 1.5 }, elsewhere: 0.1 },
  { id: "pandemic_virus", name: "Pandemic Virus", severity: "mild", happinessImpact: 6, healthImpact: 13, minAge: 0, baseChance: 0.14, infectious: true, gate: "pandemic" },
  { id: "cancer", name: "Cancer", severity: "fatal", happinessImpact: 8, healthImpact: 10, minAge: 25, baseChance: 0.0016, fatalYears: [2, 6] },
  { id: "kidney_failure", name: "Kidney Failure", severity: "fatal", happinessImpact: 5, healthImpact: 8, minAge: 35, baseChance: 0.0015, fatalYears: [2, 5] },
  { id: "stroke", name: "Stroke Complications", severity: "fatal", happinessImpact: 6, healthImpact: 9, minAge: 55, baseChance: 0.004, fatalYears: [1, 4] },
  { id: "alzheimers", name: "Alzheimer's Disease", severity: "fatal", happinessImpact: 8, healthImpact: 6, minAge: 65, baseChance: 0.007, fatalYears: [3, 8] },
];

export const DISEASE_BY_ID: Record<string, DiseaseTemplate> = Object.fromEntries(
  DISEASE_CATALOG.map((d) => [d.id, d]),
);

export function instantiateDisease(
  t: DiseaseTemplate,
  rollYears: (min: number, max: number) => number,
): Disease {
  return {
    id: t.id,
    name: t.name,
    severity: t.severity,
    ...(t.incurable ? { incurable: true } : {}),
    happinessImpact: t.happinessImpact,
    healthImpact: t.healthImpact,
    ...(t.fatalYears ? { yearsLeft: rollYears(t.fatalYears[0], t.fatalYears[1]) } : {}),
  };
}

/**
 * Chance (0-1) that a single doctor visit cures a disease of this severity. Chronic and terminal
 * conditions are managed with a treatment plan (engine/treatment.ts), not cured by one appointment:
 * a visit only occasionally turns up an easy fix.
 */
export const CURE_CHANCE: Record<Severity, number> = {
  mild: 0.75,
  chronic: 0.05,
  fatal: 0.02,
};
