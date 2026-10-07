import type { Rng } from "@/lib/rng";

/** Flavour jobs for relatives, by income tier (1 struggling … 5 wealthy). */
const OCCUPATIONS: string[][] = [
  [],
  ["Cleaner", "Delivery driver", "Warehouse worker", "Barista", "Care assistant"],
  ["Shop manager", "Mechanic", "Teaching assistant", "Electrician", "Hairdresser", "Chef"],
  ["Nurse", "Teacher", "Accountant", "Police officer", "Project coordinator", "Journalist"],
  ["Engineer", "Software developer", "Solicitor", "Pharmacist", "Marketing director", "Architect"],
  ["Surgeon", "Barrister", "Finance director", "Founder", "Senior partner", "Consultant"],
];

export function occupationFor(tier: number, rng: Rng): string {
  const pool = OCCUPATIONS[Math.min(5, Math.max(1, tier))];
  return rng.pick(pool);
}

