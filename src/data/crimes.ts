import type { CrimeCharge, PlayerState } from "@/types/game.types";

export interface CrimeDef {
  id: string;
  category: "Theft" | "Fraud" | "Underworld";
  /** Returns a reason the crime is unavailable, or null. */
  requires?: (p: PlayerState) => string | null;
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
    category: "Theft",
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
    category: "Theft",
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
    category: "Theft",
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
    category: "Fraud",
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
    id: "mugging",
    category: "Theft",
    name: "Armed Mugging",
    emoji: "🔪",
    blurb: "Rob a stranger at knifepoint. Quick, nasty, and risky.",
    minAge: 15,
    risk: "Medium",
    successChance: (p) => 0.55 + (p.health - 50) / 400,
    reward: [200, 3_000],
    karmaDelta: -12,
    charge: { name: "Armed Robbery", description: "Your victim identified you in a line-up.", years: 5, severity: "serious" },
  },
  {
    id: "counterfeit",
    category: "Fraud",
    name: "Counterfeit Goods",
    emoji: "💳",
    blurb: "Print fake designer bags and sell them online.",
    minAge: 16,
    risk: "Medium",
    successChance: (p) => 0.5 + p.smarts / 400,
    reward: [4_000, 35_000],
    karmaDelta: -6,
    charge: { name: "Counterfeiting", description: "Customs seized a shipment with your fingerprints on the packaging.", years: 4, severity: "serious" },
  },
  {
    id: "identity_theft",
    category: "Fraud",
    name: "Identity Theft",
    emoji: "🪪",
    blurb: "Open accounts in other people's names.",
    minAge: 16,
    risk: "High",
    successChance: (p) => 0.35 + p.smarts / 300,
    reward: [8_000, 60_000],
    karmaDelta: -9,
    charge: { name: "Identity Fraud", description: "A bank flagged the pattern and traced it to you.", years: 5, severity: "serious" },
  },
  {
    id: "tax_evasion",
    category: "Fraud",
    name: "Tax Evasion",
    emoji: "🧾",
    blurb: "Hide income from the tax office. You need a decent income.",
    minAge: 18,
    risk: "Medium",
    requires: (p) => ((p.currentJob?.salary ?? 0) + (p.business ? Math.max(0, p.business.lastProfit) : 0) < 40_000 ? "Needs an income of $40,000+" : null),
    successChance: (p) => 0.6 + p.smarts / 500,
    reward: [10_000, 90_000],
    karmaDelta: -5,
    charge: { name: "Tax Evasion", description: "A revenue audit unravelled your offshore accounts.", years: 4, severity: "serious" },
  },
  {
    id: "embezzlement",
    category: "Fraud",
    name: "Embezzle from Work",
    emoji: "🗂️",
    blurb: "Skim from the company accounts. Needs a job.",
    minAge: 18,
    risk: "High",
    requires: (p) => (!p.currentJob ? "Needs a job" : null),
    successChance: (p) => 0.4 + p.smarts / 300,
    reward: [15_000, 120_000],
    karmaDelta: -10,
    charge: { name: "Embezzlement", description: "Company auditors traced the missing money to your login.", years: 6, severity: "serious" },
  },
  {
    id: "insurance_fraud",
    category: "Fraud",
    name: "Insurance Fraud",
    emoji: "📑",
    blurb: "Report your car stolen (and quietly sell it). Needs a vehicle.",
    minAge: 18,
    risk: "Medium",
    requires: (p) => (p.vehicles.length === 0 ? "Needs a vehicle" : null),
    successChance: (p) => 0.5 + p.smarts / 400,
    reward: [8_000, 40_000],
    karmaDelta: -7,
    charge: { name: "Insurance Fraud", description: "An investigator found your 'stolen' car on an auction site.", years: 3, severity: "serious" },
  },
  {
    id: "smuggling",
    category: "Underworld",
    name: "Smuggling",
    emoji: "📦",
    blurb: "Move contraband across a border.",
    minAge: 18,
    risk: "High",
    successChance: (p) => 0.4 + p.smarts / 400,
    reward: [20_000, 150_000],
    karmaDelta: -10,
    charge: { name: "Smuggling", description: "Border agents x-rayed the false bottom of your suitcase.", years: 8, severity: "serious" },
  },
  {
    id: "drug_dealing",
    category: "Underworld",
    name: "Drug Dealing",
    emoji: "💊",
    blurb: "Sell on the side. Easy money, until it isn't.",
    minAge: 16,
    risk: "High",
    successChance: (p) => 0.5 + p.smarts / 500,
    reward: [5_000, 50_000],
    karmaDelta: -12,
    charge: { name: "Drug Trafficking", description: "A street sting caught you mid-sale.", years: 6, severity: "serious" },
  },
  {
    id: "bank_robbery",
    category: "Theft",
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

/** Extra facts about each crime used by the justice engine. */
export interface CrimeMeta {
  /** Police attention generated by one attempt. */
  heat: number;
  /** A crew helps (heists, smuggling, burglary). */
  team?: boolean;
  /** Violent offence: harsher record consequences. */
  violent?: boolean;
  /** Leaves a paper trail: stronger evidence when caught. */
  paper?: boolean;
}

export const CRIME_META: Record<string, CrimeMeta> = {
  shoplifting: { heat: 2 },
  car_theft: { heat: 8, team: true },
  burglary: { heat: 8, team: true },
  hacking: { heat: 6, paper: true },
  mugging: { heat: 12, violent: true },
  counterfeit: { heat: 6, team: true, paper: true },
  identity_theft: { heat: 7, paper: true },
  tax_evasion: { heat: 3, paper: true },
  embezzlement: { heat: 6, paper: true },
  insurance_fraud: { heat: 4, paper: true },
  smuggling: { heat: 10, team: true },
  drug_dealing: { heat: 10, team: true },
  bank_robbery: { heat: 25, team: true, violent: true },
};

export const crimeMeta = (id: string): CrimeMeta => CRIME_META[id] ?? { heat: 5 };

export interface LawyerDef {
  id: string;
  name: string;
  /** Base fee; scaled by the seriousness of the charge. */
  cost: number;
  /** 0-1: how well they work the case. */
  quality: number;
  blurb: string;
}

/** Representation at trial. Quality (and your money) shapes the odds; evidence does the rest. */
export const LAWYERS: readonly LawyerDef[] = [
  { id: "public", name: "Public Defender", cost: 0, quality: 0.25, blurb: "Overworked, underpaid, and well-meaning. Sixty other clients this week." },
  { id: "private", name: "Private Attorney", cost: 8_000, quality: 0.55, blurb: "Returns your calls and reads the file." },
  { id: "expensive", name: "Expensive Lawyer", cost: 20_000, quality: 0.8, blurb: "A shark in a three-piece suit." },
  { id: "dream_team", name: "Celebrity Legal Team", cost: 90_000, quality: 0.95, blurb: "Three partners, two investigators and a jury consultant." },
  { id: "self", name: "Defend Yourself", cost: 0, quality: 0.1, blurb: "You have a fool for a client (unless you have a law degree)." },
  { id: "plea", name: "Plea Bargain", cost: 0, quality: 0, blurb: "Admit guilt in exchange for a reduced sentence." },
];

