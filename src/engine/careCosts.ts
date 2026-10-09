/** What care costs where you live: the health system, insurance, outbreaks and policy, and your immigration status. */
import type { PlayerState } from "@/types/game.types";
import { profileOf, type CareSystem } from "@/data/countryProfiles";
import { getPartner } from "./state";
import { worldCareFactor } from "./worldEvents";

export type { CareSystem };

export const careSystem = (country: string): CareSystem => profileOf(country).care;

/** Employed (or married to someone who is) in an insurance-based system; migrants without papers are never covered. */
export function hasInsurance(p: PlayerState): boolean {
  if (p.immigration?.status === "overstay") return false;
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
  const policy = worldCareFactor(p);
  if (sys === "universal") return (p.immigration?.status === "overstay" ? 1 : 0.15) * policy;
  if (sys === "insured") return (hasInsurance(p) ? 0.3 : 1.8) * policy;
  return policy;
}

export const medicalPrice = (p: PlayerState, base: number) => Math.max(5, Math.round(base * medicalCostFactor(p)));
