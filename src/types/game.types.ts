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
  | "Masters";

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
  /** Released early under supervision (violations send you back to finish the sentence). */
  parole?: boolean;
  /** Technical violations so far; the second one revokes. */
  strikes?: number;
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
  /** Strength of the prosecution's case, 0-100 (drives acquittal odds and sentencing). */
  evidence?: number;
  /** Tried as a minor: juvenile court, detention instead of prison, sealed record. */
  juvenile?: boolean;
  /** The defendant did not do it (mistaken identity, frame-up). */
  innocent?: boolean;
  /** Id of the crime from the Crime Rings (paper trail, crew rules). */
  crimeId?: string;
  /** Known violent offence (felony record consequences are harsher). */
  violent?: boolean;
  /** Bail set at arraignment. */
  bail?: { amount: number; posted: boolean; denied?: boolean };
}

export interface PrisonState {
  charge: string;
  sentenceYears: number;
  yearsServed: number;
  /** Sentenced to death: the sentence is a countdown to execution unless an appeal succeeds. */
  deathRow?: boolean;
  /** Serving in juvenile detention (no adult prison, records sealed at 18). */
  juvenile?: boolean;
  /** Institutional record 0-100: drives parole, good-time release and solitary. */
  conduct?: number;
  /** Respect among inmates 0-100. */
  standing?: number;
  gang?: string | null;
  job?: string | null;
  /** Programmes finished this term. */
  programs?: string[];
  /** Years put into programmes in progress. */
  progress?: Record<string, number>;
  /** Years of solitary confinement still to serve. */
  solitary?: number;
  /** Convicted of something you did not do. */
  wrongful?: boolean;
  /** Appeals filed. */
  appeals?: number;
  /** Detention before and during trial that counts as time served. */
  creditYears?: number;
}

/** Everything the justice system remembers about you. */
export interface JusticeState {
  /** Police attention 0-100: raises catch odds, decays yearly. */
  heat: number;
  /** Adult convictions. */
  convictions: number;
  felonies: number;
  violentConvictions: number;
  /** Juvenile adjudications (sealed at 18 unless serious). */
  juvenileRecord: string[];
  recordSealed: boolean;
  /** Was tried as an adult for a heinous crime as a minor. */
  adultTried: boolean;
  /** Record expunged: no longer closes careers. */
  expunged: boolean;
  lastConvictionYear: number | null;
  releasedYear: number | null;
  /** Years of difficult reintegration left after release. */
  reentry: number;
  /** People who know what you did and could talk. */
  accomplices: number;
  /** Illicit gains not yet recovered by the courts. */
  proceeds: number;
  /** Lifetime programmes completed behind bars. */
  programs: string[];
  gangTies: string | null;
  exonerations: number;
}

export interface MobState {
  /** How much the family trusts you, 0-100. */
  loyalty: number;
  /** Street respect, 0-100: drives promotion. */
  respect: number;
  /** Blocks you control. */
  territory: number;
  /** Rival crews' hostility, 0-100. War breaks out when high. */
  rivalHeat: number;
  /** Your own crew under you. */
  crew: number;
  jobsDone: number;
  yearsIn: number;
  /** Secretly cooperating with the authorities. */
  informant: boolean;
  /** Risk that the family finds out, 0-100. */
  exposure: number;
  /** In witness protection: out of the life, with a new start. */
  witsec: boolean;
  /** The family wants you gone. */
  marked: boolean;
}

export interface SpyState {
  /** Cover integrity 0-100. */
  cover: number;
  handlerTrust: number;
  /** Counter-intelligence suspicion 0-100. */
  suspicion: number;
  doubleAgent: boolean;
  foreignTrust: number;
  burned: boolean;
  burnedYear: number | null;
  /** Years foreign services keep hunting a burned agent. */
  hunted: number;
  missions: number;
  secrets: number;
  /** Told your partner what you do. */
  partnerKnows: boolean;
}

export interface Donor {
  id: string;
  name: string;
  kind: "grassroots" | "business" | "union" | "billionaire" | "pac";
  given: number;
  /** Policy they expect in return (issue id) and the stance they want (-1 / +1); null = no strings. */
  issue: string | null;
  stance: number;
  year: number;
}

export interface Scandal {
  kind: string;
  title: string;
  severity: number;
  year: number;
}

export interface Investigation {
  kind: string;
  yearsLeft: number;
  evidence: number;
}

/** The political machine behind the ladder in `PoliticsState`. */
export interface StatecraftState {
  /** Standing with the party apparatus 0-100. */
  machine: number;
  /** Campaign war chest. */
  funds: number;
  donors: Donor[];
  /** Position on each issue: -1, 0 or +1. */
  stances: Record<string, number>;
  /** Public mood on each issue, -1 to +1. */
  mood: Record<string, number>;
  endorsed: boolean;
  scandal: Scandal | null;
  investigation: Investigation | null;
  /** Consecutive terms in the current office. */
  termsInOffice: number;
  highestTier: number;
  policyWins: number;
  /** Legislative coalition strength 0-100. */
  coalition: number;
  /** Consecutive years with approval below the recall line. */
  lowYears: number;
  /** Total bribes pocketed. */
  bribes: number;
  retired: "lobbyist" | "ambassador" | "pundit" | null;
  retiredYear: number | null;
  /** Times removed from office by recall or impeachment. */
  removed: number;
  electionsWon: number;
  electionsLost: number;
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
  statecraft: StatecraftState;
  pregnancy: Pregnancy | null;
  blackjack: BlackjackHand | null;
  /** Mature (18+) content: sexual choices, adult careers, and graphic-ish crime options. */
  matureContent: boolean;

  // World & lifestyle
  effort: Effort;
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
  justice: JusticeState;
  mob: MobState;
  spy: SpyState;

  // Engine bookkeeping
  achievements: string[];
  goalsDone: string[];
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
