/**
 * Central type definitions for the life simulator.
 * Everything inside `PlayerState` is plain JSON so it can be cloned and persisted safely.
 */

export type StatKey = "happiness" | "health" | "smarts" | "looks";
export type Severity = "mild" | "chronic" | "fatal";

export interface Disease {
  id: string;
  name: string;
  severity: Severity;
  /** Magnitudes (positive numbers) subtracted from the player every year. */
  happinessImpact: number;
  healthImpact: number;
  /** Fatal diseases carry a countdown to death. */
  yearsLeft?: number;
}

export type Relation = "Parent" | "Sibling" | "Child" | "Partner" | "Friend";
export type PartnerStatus = "dating" | "married" | "ex";

export interface Relative {
  id: string;
  relation: Relation;
  name: string;
  age: number;
  relationshipBar: number;
  health: number;
  alive: boolean;
  /** 1 (struggling) – 5 (wealthy). Drives inheritance and parental allowances. */
  incomeTier: number;
  gender: string;
  smarts: number;
  looks: number;
  partnerStatus?: PartnerStatus;
  deathAge?: number;
  deathYear?: number;
}

export interface Property {
  id: string;
  name: string;
  originalValue: number;
  currentValue: number;
  condition: number;
  monthlyMortgage: number;
  /** Years remaining on the mortgage. */
  remainingTerm: number;
  mortgageBalance: number;
  archetypeId: string;
}

export interface Vehicle {
  id: string;
  name: string;
  purchasePrice: number;
  currentValue: number;
  condition: number;
  yearManufactured: number;
  loanBalance: number;
  loanPaymentAnnual: number;
  loanYearsLeft: number;
  maintenanceWeight: number;
  archetypeId: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  salary: number;
  performance: number;
  tier: number;
  lineId: string;
  /** Years spent at the current rung (gates promotion offers). */
  yearsInRole?: number;
}

export type SpecialCareerPath = "none" | "royalty" | "actor" | "musician";
export type RoyalRank = "none" | "Prince" | "Princess" | "King" | "Queen";

export type EducationStage =
  | "None"
  | "Primary"
  | "HighSchool"
  | "University"
  | "MedicalSchool"
  | "LawSchool";

export interface EducationState {
  stage: EducationStage;
  yearsLeft: number;
  major: string | null;
  grades: number;
  /** Hidden variable that modifies graduation odds. Decays yearly. */
  studyEffort: number;
  degrees: string[];
}

export interface Skills {
  acting: number;
  music: number;
  charisma: number;
  athletics: number;
}

export interface Business {
  kind: string;
  name: string;
  value: number;
  lastProfit: number;
  /** Bonus to next year's profit from hands-on work (consumed on Age Up). */
  boost: number;
  founded: number;
}

export interface InfluencerState {
  active: boolean;
  followers: number;
  lastPostYear: number;
}

export interface AthleteState {
  sport: string | null;
}

export interface Album {
  title: string;
  genre: string;
  rating: string;
  sales: number;
  royalty: number;
  year: number;
}

export interface MusicState {
  status: "none" | "band" | "solo";
  signed: boolean;
  pendingAlbum: { title: string; genre: string } | null;
  albums: Album[];
}

export interface NationState {
  economy: number;
  freedom: number;
  military: number;
}

export interface CrimeCharge {
  name: string;
  description: string;
  years: number;
  severity: "minor" | "serious" | "heinous";
}

export interface PrisonState {
  charge: string;
  sentenceYears: number;
  yearsServed: number;
}

export interface LifetimeStats {
  highestCareerTier: number;
  highestCareerTitle: string;
  highestSalary: number;
  crimesCommitted: number;
  childrenBorn: number;
  peakNetWorth: number;
  yearsInPrison: number;
}

export interface PlayerState {
  // Personal profile
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  year: number;
  birthYear: number;
  birthCountry: string;
  birthCity: string;
  gender: string;
  sexuality: string;
  karma: number;
  fame: number;

  // Core stats (0-100)
  happiness: number;
  health: number;
  smarts: number;
  looks: number;

  // Medical ledger
  diseases: Disease[];

  // Wealth engine
  bankBalance: number;
  outstandingLoans: number;
  creditScore: number;
  annualSalary: number;
  taxesPaidThisYear: number;
  pension: number;

  // Social graph
  relatives: Relative[];

  // Assets ledger
  properties: Property[];
  vehicles: Vehicle[];

  // Career tracking
  currentJob: Job | null;
  specialCareerPath: SpecialCareerPath;
  specialCareers: Array<"actor" | "musician">;
  royalRank: RoyalRank;
  royalRespect: number;
  nation: NationState;
  education: EducationState;
  skills: Skills;
  music: MusicState;
  business: Business | null;
  influencer: InfluencerState;
  athlete: AthleteState;

  // Justice
  isInPrison: boolean;
  isFugitive: boolean;
  prison: PrisonState | null;
  pendingTrial: CrimeCharge | null;
  criminalRecord: string[];

  // Engine bookkeeping
  flags: string[];
  /** Per-year action counters (reset on Age Up). */
  annual: Record<string, number>;
  queuedEvents: string[];
  seenEvents: Record<string, number>;
  lifeLog: string[];
  stats: LifetimeStats;
  generation: number;
  alive: boolean;
  causeOfDeath: string | null;
  deathYear: number | null;
}

// ---------------------------------------------------------------------------
// Event system types (data schemas live in data/lifeEventsEngine.ts)
// ---------------------------------------------------------------------------

export type Tone = "good" | "bad" | "neutral" | "jackpot" | "surgery";

export interface Chip {
  label: string;
  delta: number;
  money?: boolean;
}

export type Notice =
  | { id: string; kind: "event"; event: import("../data/lifeEventsEngine").LifeEvent }
  | {
      id: string;
      kind: "info";
      title: string;
      body: string;
      tone: Tone;
      chips?: Chip[];
    };

export interface ActionResult {
  player: PlayerState;
  notices?: Array<Omit<Notice, "id"> | Notice>;
  banner?: string;
}

export type TabId =
  | "dashboard"
  | "relationships"
  | "activities"
  | "career"
  | "assets"
  | "prison";

export interface GameState {
  screen: "start" | "game";
  player: PlayerState | null;
  tab: TabId;
  notices: Notice[];
  banner: string | null;
  rngState: number;
}
