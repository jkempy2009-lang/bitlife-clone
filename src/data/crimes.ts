import type { CrimeCharge, PlayerState } from "@/types/game.types";

export interface CrimeDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  minAge: number;
  risk: "Low" | "Medium" | "High" | "Extreme";
  /** Base probability of getting away with it. */
  successChance: (p: PlayerState, roll: number) => number;
  reward: [number, number];
  karmaDelta: number;
  charge: CrimeCharge;
}

export const CRIMES: CrimeDef[] = [
  {
    id: "shoplifting",
    name: "Shoplifting",
    emoji: "🛍️",
    blurb: "Pocket something small. Low risk.",
    minAge: 8,
    risk: "Low",
    successChance: () => 0.85,
    reward: [20, 200],
    karmaDelta: -3,
    charge: {
      name: "Petty Theft",
      description: "You were caught by store security with merchandise you hadn't paid for.",
      years: 1,
      severity: "minor",
    },
  },
  {
    id: "car_theft",
    name: "Grand Theft Auto",
    emoji: "🚗",
    blurb: "Hot-wire a parked car and sell it on.",
    minAge: 14,
    risk: "Medium",
    successChance: (p) => 0.5 + p.smarts / 400,
    reward: [3_000, 20_000],
    karmaDelta: -8,
    charge: {
      name: "Grand Theft Auto",
      description: "A patrol car spotted you behind the wheel of a stolen vehicle.",
      years: 3,
      severity: "serious",
    },
  },
  {
    id: "burglary",
    name: "Burglary",
    emoji: "🏚️",
    blurb: "Break into a house while the owners are away.",
    minAge: 14,
    risk: "Medium",
    successChance: (p) => 0.45 + p.smarts / 300,
    reward: [1_500, 15_000],
    karmaDelta: -8,
    charge: {
      name: "Burglary",
      description: "A neighbour's doorbell camera captured your face as you climbed through the window.",
      years: 4,
      severity: "serious",
    },
  },
  {
    id: "hacking",
    name: "Hack a Bank's Servers",
    emoji: "💻",
    blurb: "Skim fractions of cents. Needs serious brains.",
    minAge: 16,
    risk: "High",
    successChance: (p) => Math.max(0.05, (p.smarts - 40) / 120),
    reward: [20_000, 120_000],
    karmaDelta: -10,
    charge: {
      name: "Computer Fraud",
      description: "Federal agents traced the intrusion straight back to your IP address.",
      years: 6,
      severity: "serious",
    },
  },
  {
    id: "bank_robbery",
    name: "Bank Robbery",
    emoji: "🏦",
    blurb: "Extreme risk. Odds scale with smarts and a dash of luck, capped at 25%.",
    minAge: 16,
    risk: "Extreme",
    successChance: (p, roll) => Math.min(0.25, (p.smarts / 100) * roll * 0.35),
    reward: [150_000, 150_000],
    karmaDelta: -25,
    charge: {
      name: "Armed Bank Robbery",
      description: "The alarm tripped, the vault door jammed, and the police arrived within minutes.",
      years: 10,
      severity: "heinous",
    },
  },
];

export const CRIME_BY_ID: Record<string, CrimeDef> = Object.fromEntries(CRIMES.map((c) => [c.id, c]));

/** Special named lawyer options for trials. */
export const LAWYERS = [
  { id: "expensive", name: "Expensive Lawyer", cost: 20_000, successChance: 0.8, blurb: "A shark in a three-piece suit." },
  { id: "public", name: "Public Defender", cost: 0, successChance: 0.2, blurb: "Overworked, underpaid, and well-meaning." },
  { id: "self", name: "Defend Yourself", cost: 0, successChance: 0.05, blurb: "You have a fool for a client." },
] as const;
