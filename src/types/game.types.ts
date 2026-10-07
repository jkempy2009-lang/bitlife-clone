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

// ---------------------------------------------------------------------------
// Fame careers: online creator, musician, actor / model, and the cost of being known
// ---------------------------------------------------------------------------

export type Platform = "video" | "shorts" | "stream" | "photo" | "podcast";

/** A brand contract: paid yearly, but it obliges you to keep producing and it costs authenticity. */
export interface SponsorDeal {
  id: string;
  brand: string;
  pay: number;
  yearsLeft: number;
  /** Minimum creative output (0-1.6) needed to honour the contract. */
  minOutput: number;
  /** Authenticity lost per year for pushing this product. */
  authCost: number;
  shady: boolean;
}

export interface IncomeBreakdown {
  ads: number;
  deals: number;
  subs: number;
  merch: number;
  costs: number;
}

export interface InfluencerState {
  active: boolean;
  followers: number;
  lastPostYear: number;
  platform: Platform;
  niche: string;
  /** Audience quality, 0-100. Drives ad and sponsor rates. */
  engagement: number;
  /** Trust you've built, 0-100. Spent by sponsored content and scandals. */
  authenticity: number;
  /** Learned skill at making content, 0-100. */
  craft: number;
  /** Rolling posting consistency, 0-100. */
  cadence: number;
  burnout: number;
  yearsActive: number;
  /** Creating is your day job. Needs no other full-time commitment. */
  fullTime: boolean;
  /** Resting this year: output drops to a trickle, burnout heals. */
  onBreak: boolean;
  algorithm: "boost" | "neutral" | "suppress";
  algoYears: number;
  /** The niche the platform is currently pushing. */
  trend: string;
  bannedYears: number;
  deals: SponsorDeal[];
  /** Brand offers waiting for an answer (they expire at Age Up). */
  offers: SponsorDeal[];
  merch: boolean;
  premium: boolean;
  subscribers: number;
  boughtFollowers: boolean;
  income: IncomeBreakdown;
  lifetimeEarnings: number;
  peakFollowers: number;
  viralHits: number;
  followerHistory: number[];
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
  /** Artist royalty earned for the coming year (decays as the record ages). */
  royalty: number;
  year: number;
  /** 0-100 craft behind the record. */
  quality?: number;
  /** Spawned a chart single. */
  hit?: boolean;
  /** Self-released rather than through a label. */
  indie?: boolean;
  /** The label owns it and keeps the royalties. */
  labelOwned?: boolean;
  award?: string;
}

export interface BandMember {
  id: string;
  name: string;
  role: string;
  skill: number;
  /** Chemistry with you, 0-100. Low loyalty means they walk. */
  loyalty: number;
  ego: number;
  partier: boolean;
}

export interface RecordContract {
  label: string;
  totalYears: number;
  yearsLeft: number;
  /** Lump sum paid at signing (recoupable). */
  advance: number;
  /** Yearly living stipend (recoupable). */
  stipend: number;
  /** Your share of album revenue, 0.08-0.30. */
  royaltyRate: number;
  albumsOwed: number;
  albumsDelivered: number;
  /** Advances, stipends and studio bills the label has fronted and not yet earned back. */
  unrecouped: number;
  /** 0-100: how much say you have over the sound. */
  creativeControl: number;
  tourCut: number;
  renegotiatedYear: number;
}

export interface PendingAlbum {
  title: string;
  genre: string;
  quality?: number;
  producer?: string;
  direction?: "commercial" | "balanced" | "artistic";
  indie?: boolean;
}

export interface MusicState {
  status: "none" | "band" | "solo";
  signed: boolean;
  pendingAlbum: PendingAlbum | null;
  albums: Album[];
  bandName: string;
  members: BandMember[];
  genre: string;
  songwriting: number;
  /** 0-100 quality of your latest demo tape. */
  demo: number;
  /** Fame in your own scene, 0-100. */
  localFame: number;
  fans: number;
  /** 0-100: how current you sound. Decays with time, age and flops. */
  relevance: number;
  contract: RecordContract | null;
  /** The label's opinion of you, 0-100. */
  labelStanding: number;
  manager: boolean;
  burnout: number;
  /** Years of writer's block remaining. */
  blockYears: number;
  /** Resting this year: no gigs, burnout heals. */
  onBreak: boolean;
  hits: number;
  yearsSinceHit: number;
  awards: string[];
  gigs: number;
  tours: number;
  yearsActive: number;
  earnings: number;
  droppedCount: number;
  lastIncome: { gigs: number; royalties: number; stipend: number; costs: number };
}

export interface FilmCredit {
  id: string;
  title: string;
  year: number;
  genre: string;
  role: "extra" | "cameo" | "supporting" | "lead" | "producer" | "director";
  budget: number;
  boxOffice: number;
  /** Critics' score, 0-100. */
  critics: number;
  outcome: "flop" | "modest" | "hit" | "blockbuster";
  award?: string;
}

export interface FilmOffer {
  id: string;
  title: string;
  genre: string;
  role: "cameo" | "supporting" | "lead";
  fee: number;
  budget: number;
  /** Script quality, 0-100. */
  script: number;
  prestige: number;
}

export interface PendingFilm extends Omit<FilmOffer, "role"> {
  role: FilmCredit["role"];
  /** Your own money riding on it (producer / director). */
  invested?: number;
}

export interface Agent {
  name: string;
  cut: number;
  /** 0-100: how hard they work for you. */
  skill: number;
  yearsWith: number;
}

export interface StudioDeal {
  studio: string;
  yearsLeft: number;
  fee: number;
  genre: string;
}

export interface ActingState {
  agent: Agent | null;
  /** Standing with the industry, 0-100. */
  reputation: number;
  /** Critical acclaim, 0-100. */
  critics: number;
  /** Box-office draw, 0-100. */
  pull: number;
  typecast: string | null;
  credits: FilmCredit[];
  offers: FilmOffer[];
  pendingFilm: PendingFilm | null;
  studioDeal: StudioDeal | null;
  awards: string[];
  nominations: number;
  earnings: number;
  yearsSinceWork: number;
  modelBookings: number;
  lastIncome: { fees: number; bonuses: number; agent: number };
}

export interface ScandalState {
  source: "influencer" | "music" | "acting" | "general";
  cause: string;
  /** 1 (embarrassing) to 3 (career-threatening). */
  severity: 1 | 2 | 3;
}

/** The cost of being known, shared by every fame career. */
export interface CelebState {
  /** 0-100, higher is more private. */
  privacy: number;
  stalker: number;
  security: boolean;
  businessManager: boolean;
  scandal: ScandalState | null;
  scandals: number;
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
  acting: ActingState;
  celeb: CelebState;
  athlete: AthleteState;
  hobbies: Record<string, number>;
  politics: PoliticsState;
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
