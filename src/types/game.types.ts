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
  /** Cannot be cured, only managed. */
  incurable?: boolean;
  /** Magnitudes (positive numbers) subtracted from the player every year. */
  happinessImpact: number;
  healthImpact: number;
  /** Fatal diseases carry a countdown to death. */
  yearsLeft?: number;
}

export type Relation = "Parent" | "Sibling" | "Child" | "Partner" | "Friend" | "Grandparent" | "Grandchild" | "Pet" | "Lover";
export type PartnerStatus = "dating" | "married" | "ex" | "affair" | "fling";

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
  /** 0-100: how adventurous they are. Drives threesome / open-relationship consent. */
  openness?: number;
  /** 0-100: how badly they react to betrayal. */
  jealousy?: number;
  traits?: string[];
  /** Pets only: "dog", "cat", etc. */
  species?: string;
  /** Times you've been intimate this life (lovers and partners). */
  encounters?: number;
  deathAge?: number;
  deathYear?: number;
  /** Calendar year you married them (partners). */
  marriedYear?: number;
  /** Short occupation blurb for flavour ("Nurse", "Electrician"). */
  occupation?: string;
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
  /** Reduced hours: lower pay, no promotions, but leaves room to study. */
  partTime?: boolean;
}

/** How hard you push at work / training / study. Persists until changed. */
export type Effort = "coast" | "steady" | "grind";

export type SpecialCareerPath = "none" | "royalty" | "actor" | "musician";
export type RoyalRank = "none" | "Prince" | "Princess" | "King" | "Queen";

export type EducationStage =
  | "None"
  | "Primary"
  | "HighSchool"
  | "University"
  | "MedicalSchool"
  | "LawSchool"
  | "Masters"
  | "Certificate";

export interface EducationState {
  stage: EducationStage;
  yearsLeft: number;
  major: string | null;
  grades: number;
  /** Hidden variable that modifies graduation odds. Decays yearly. */
  studyEffort: number;
  degrees: string[];
  /** Fraction of tuition covered (0–1). Lost if grades slip. */
  scholarship?: number;
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
  /** Employees: each adds profit but costs a salary. */
  staff: number;
  /** Extra locations (each scales value and risk). */
  locations: number;
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

export type Climate = "boom" | "normal" | "recession";

export interface EconomyState {
  climate: Climate;
  yearsLeft: number;
}

export interface Residence {
  country: string;
  city: string;
  /** 0 basic room, 1 standard apartment, 2 nice apartment, 3 luxury rental. */
  rentTier: number;
}

export interface Holding {
  value: number;
  basis: number;
}

export interface Vices {
  smoking: number;
  alcohol: number;
  drugs: number;
  gambling: number;
}

export interface PoliticsState {
  popularity: number;
  yearsInOffice: number;
  party: string | null;
}

export interface Pregnancy {
  /** "self" or the relative id of whoever is carrying the baby. */
  carrier: string;
  /** Name of the other parent, for the log. */
  other: string;
}

export interface BlackjackHand {
  phase: "play" | "done";
  deck: { rank: string; suit: string }[];
  player: { rank: string; suit: string }[];
  dealer: { rank: string; suit: string }[];
  wager: number;
  message: string;
}

export interface Probation {
  yearsLeft: number;
  charge: string;
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
  /** Punishable by death in some countries. */
  capital?: boolean;
}

export interface PrisonState {
  charge: string;
  sentenceYears: number;
  yearsServed: number;
  /** Sentenced to death: the sentence is a countdown to execution unless an appeal succeeds. */
  deathRow?: boolean;
}

export interface LifetimeStats {
  highestCareerTier: number;
  highestCareerTitle: string;
  highestSalary: number;
  crimesCommitted: number;
  childrenBorn: number;
  peakNetWorth: number;
  yearsInPrison: number;
  kills: number;
  affairs: number;
  hookups: number;
  /** Years in paid work (part-time counts half). Drives pension. */
  yearsWorked: number;
}

export interface ChallengeState {
  id: string;
  status: "active" | "won" | "failed";
}

export interface YearSummary {
  age: number;
  happiness: number;
  health: number;
  smarts: number;
  looks: number;
  money: number;
  netWorth: number;
}

export interface HistoryPoint {
  age: number;
  netWorth: number;
  happiness: number;
  health: number;
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
  /** Years of experience per career line (drives hiring odds and starting rank). */
  careerYears: Record<string, number>;
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
  hobbies: Record<string, number>;
  politics: PoliticsState;
  pregnancy: Pregnancy | null;
  blackjack: BlackjackHand | null;
  /** Mature (18+) content: sexual choices, adult careers, and graphic-ish crime options. */
  matureContent: boolean;

  // World & lifestyle
  effort: Effort;
  /** Standing health routine: exercise and diet, 0 (neglect) – 2 (dedicated). 1 is the baseline. */
  habits: { exercise: number; diet: number };
  /** Living standard: 0 frugal, 1 comfortable, 2 lavish. */
  lifestyle: number;
  economy: EconomyState;
  residence: Residence;
  investments: Record<string, Holding>;
  vices: Vices;

  // Justice
  probation: Probation | null;
  isInPrison: boolean;
  isFugitive: boolean;
  prison: PrisonState | null;
  pendingTrial: CrimeCharge | null;
  criminalRecord: string[];

  // Engine bookkeeping
  achievements: string[];
  goalsDone: string[];
  /** The scenario challenge this life is attempting, if any (carries across generations). */
  challenge: ChallengeState | null;
  /** What changed during the last Age Up (before you made any choices). */
  lastYear: YearSummary | null;
  /** Categories of the last few events, used to keep years varied. */
  recentCats: string[];
  history: HistoryPoint[];
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
