/**
 * Where and when you live shapes how long you live: childhood is far riskier in some countries than
 * others, adult risk follows violence, roads and untreated illness, old age follows care and diet,
 * and the whole picture improves with the decades. Wars and pandemics layer on top.
 */
import type { PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { profileOf } from "@/data/countryProfiles";
import type { DiseaseTemplate } from "@/data/diseases";
import { activeEvents, worldInfection, worldMortality } from "./worldEvents";

/** Medicine and sanitation get better with the years (and were far worse in 1950). Returns the multiplier on death risk. */
export function eraFactor(year: number, band: "child" | "adult" | "elder"): number {
  const decades = (2026 - year) / 10;
  const k = band === "child" ? 1.22 : band === "adult" ? 1.12 : 1.07;
  if (decades >= 0) return Math.pow(k, decades);
  const floor = band === "child" ? 0.6 : band === "adult" ? 0.7 : 0.75;
  const gain = band === "child" ? 0.97 : band === "adult" ? 0.98 : 0.985;
  return Math.max(floor, Math.pow(gain, -decades));
}

/** Smooth blend across the age bands: childhood fades out by 12, old-age risk fades in from 55 to 70. */
export function countryAgeRisk(country: string, age: number): number {
  const c = profileOf(country);
  if (age < 12) {
    const fade = age < 1 ? 1 : Math.max(0.2, 1 - age / 10);
    return 1 + (c.childRisk - 1) * fade;
  }
  if (age < 15) return 1 + (c.childRisk - 1) * 0.15;
  if (age < 55) return c.adultRisk;
  if (age < 70) {
    const t = (age - 55) / 15;
    return c.adultRisk * (1 - t) + c.elderRisk * t;
  }
  return c.elderRisk;
}

/** Everything about your time and place that scales your yearly chance of dying. */
export function mortalityMultiplier(p: PlayerState, age = p.age): number {
  const band = age < 15 ? "child" : age < 60 ? "adult" : "elder";
  return countryAgeRisk(p.residence.country, age) * eraFactor(p.year, band) * worldMortality(p, age);
}

/** Region-driven odds of catching a given illness (malaria, TB, water-borne disease) plus pandemic surges. */
export function diseaseExposure(p: PlayerState, t: DiseaseTemplate): number {
  const c = profileOf(p.residence.country);
  if (t.gate === "pandemic" && !activeEvents(p.world, p.residence.country, p.year).some((a) => a.def.kind === "pandemic")) return 0;
  let m = t.regional ? (t.regional[c.region] ?? t.elsewhere ?? 1) : 1;
  if (t.infectious) m *= c.infection * worldInfection(p) * (p.year < 1990 ? 1.5 : 1);
  return m;
}

const pick = <T,>(rng: Rng, xs: T[]) => xs[rng.int(0, xs.length - 1)];

/** What actually killed you, given your age, country and the times. */
export function causeOfDeath(p: PlayerState, age: number, rng: Rng): string {
  const c = profileOf(p.residence.country);
  const war = activeEvents(p.world, p.residence.country, p.year).find((a) => a.def.kind === "war" && a.reach === "home");
  const pandemic = activeEvents(p.world, p.residence.country, p.year).find((a) => a.def.kind === "pandemic");
  if (war && age >= 10 && rng.chance(0.55)) return age >= 17 && age <= 45 && rng.chance(0.6) ? "the war (killed in the fighting)" : "the war (a bombing raid)";
  if (pandemic && age >= 30 && rng.chance(0.55)) return "the pandemic";
  if (age < 5) {
    if (c.childRisk >= 3) {
      const tropical = c.region === "africa" || c.region === "south_asia";
      return pick(rng, tropical ? ["malaria", "diarrhoeal disease", "pneumonia", "severe malnutrition", "measles"] : ["pneumonia", "diarrhoeal disease", "an untreated infection"]);
    }
    return pick(rng, ["a rare childhood illness", "a congenital condition", "sudden infant death", "meningitis"]);
  }
  if (age < 18) {
    if (c.childRisk >= 3) return pick(rng, ["malaria", "typhoid", "a drowning accident", "tuberculosis", "a road accident"]);
    return pick(rng, ["a tragic accident", "a road accident", "a drowning accident", "leukaemia", "a rare childhood illness"]);
  }
  if (age < 60) {
    const violent = c.adultRisk >= 1.4 || c.conflict >= 0.04;
    return pick(rng, violent
      ? ["a shooting", "a car accident", "a sudden heart attack", "an act of violence", "an undiagnosed illness"]
      : ["a sudden heart attack", "a car accident", "an undiagnosed illness", "a freak accident", "a stroke"]);
  }
  if (age >= 80) return pick(rng, ["old age", "heart failure in your sleep", "a peaceful passing at home", "pneumonia"]);
  return pick(rng, ["a heart attack", "a stroke", "pneumonia", "complications from old age"]);
}

/** Expected-lifespan helper for the relocation screen: a rough number, from the country's risk bands. */
export function lifeExpectancyHint(country: string): number {
  const c = profileOf(country);
  const risk = (c.childRisk * 0.5 + c.adultRisk * 2 + c.elderRisk * 2.5) / 5;
  return Math.round(clamp(86 - (risk - 0.75) * 14, 52, 88));
}
