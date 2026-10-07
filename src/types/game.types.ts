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
  /** Hidden tastes in adult life; the player learns them by talking or trying things. */
  tastes?: Record<string, "like" | "limit">;
  /** Which tastes the player has discovered. */
  knownTastes?: string[];
  /** Calendar year you married them (partners). */
  marriedYear?: number;
  /** Short occupation blurb for flavour ("Nurse", "Electrician"). */
  occupation?: string;
  /** Children: schooling and what they're passionate about. */
  school?: "public" | "private";
  interest?: "sport" | "music" | "art" | "science" | "none";
  /** Children: how much trouble they've been in lately. */
  trouble?: number;
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

export interface BusinessManager {
  name: string;
  /** 0-100. Drives how much of the owner's job they can cover. */
  skill: number;
  wage: number;
  hired: number;
}

export interface BusinessYearRecord {
  year: number;
  revenue: number;
  /** Operating profit after interest, before tax. */
  profit: number;
  cash: number;
  reputation: number;
}

export type BusinessPayout = "reinvest" | "balanced" | "salary";

export interface Business {
  kind: string;
  name: string;
  /** The owner's stake: equity value (enterprise value + cash - debt) x owner share. Counted in net worth. */
  value: number;
  /** Hired employees (the owner and manager are not counted). */
  staff: number;
  /** Operating locations. */
  locations: number;
  /** Last year's profit after interest, before tax. */
  lastProfit: number;
  /** One-off bonus to this year's revenue from campaigns and sprints (consumed on Age Up). */
  boost: number;
  founded: number;

  // ---- depth: the fields below were added later; save.ts upgrades old saves with defaults ----
  /** 0-100. Builds slowly, crashes quickly. */
  reputation: number;
  /** 0-100 customer base index. Grows toward a target set by reputation, quality, marketing, price and market fit. */
  customers: number;
  /** 0-100 product quality. */
  quality: number;
  /** 0 budget, 1 market, 2 premium. */
  price: number;
  /** Staff morale 0-100. */
  morale: number;
  /** Staff training 0-100. */
  training: number;
  /** Premises condition 0-100. */
  facility: number;
  /** Product/equipment upgrade level 0-5. */
  upgrades: number;
  /** Business cash reserve (separate from the owner's savings). */
  cash: number;
  /** Business loan principal. */
  debt: number;
  loanRate: number;
  /** Book value of premises and equipment. */
  assets: number;
  /** Owner's invested capital (cost basis for exit tax). */
  basis: number;
  /** Fraction of the equity the owner holds (investors hold the rest). */
  ownerShare: number;
  manager: BusinessManager | null;
  /** Hidden product/market fit multiplier (0.3-1.8). Revealed only through results. */
  fit: number;
  /** Brand awareness stock built by marketing (decays yearly). */
  marketing: number;
  /** 0 none, 1 basic, 2 comprehensive. */
  insurance: number;
  /** 0-100. Lowers incident, fraud and inspection risk. Decays yearly. */
  compliance: number;
  payout: BusinessPayout;
  /** Last year's revenue (incl. royalties). */
  revenue: number;
  /** Local competitive pressure 0-100. */
  competition: number;
  /** Product diversification level 0-2. */
  diversified: number;
  franchises: number;
  /** Outside funding rounds raised. */
  rounds: number;
  /** Consecutive years with the owner absent and nobody in charge. */
  neglect: number;
  covenantBreaches: number;
  /** Cover cash shortfalls from the owner's savings automatically. */
  rescue: boolean;
  /** Spending on decisions this year (deductible; reset on Age Up). */
  ytdSpend: number;
  lastPivot: number;
  profitableYears: number;
  history: BusinessYearRecord[];
}

export interface InfluencerState {
  active: boolean;
  followers: number;
  lastPostYear: number;
}

// ---- Sports career (engine: src/engine/athlete*.ts, data: src/data/sports.ts) ----

export type AthleteStage = "none" | "youth" | "college" | "semipro" | "pro" | "retired";
export type InjuryPlan = "rest" | "rehab" | "surgery" | "play";

export interface AthleteInjury {
  label: string;
  /** 1 knock, 2 moderate, 3 major, 4 career-threatening. */
  severity: number;
  /** Full seasons still to miss. */
  yearsLeft: number;
  plan: InjuryPlan;
  /** Permanent rating loss applied when the injury heals. */
  ratingLoss: number;
  /** The player has chosen how to deal with it. */
  decided: boolean;
  /** Age when it happened. */
  age: number;
}

export interface AthleteOffer {
  id: string;
  kind: "scholarship" | "academy" | "semipro" | "pro" | "renew" | "transfer" | "coach" | "pundit";
  club: string;
  league: number;
  salary: number;
  years: number;
  bonus: number;
  note: string;
  /** Already negotiated once this year. */
  haggled?: boolean;
}

export interface SeasonRecord {
  age: number;
  year: number;
  stage: AthleteStage;
  club: string;
  league: number;
  rating: number;
  /** League finish (1 = champions) or null if you didn't play. */
  place: number | null;
  summary: string;
  titles: number;
  award: string | null;
  earnings: number;
}

export interface AthleteRecord {
  seasons: number;
  proSeasons: number;
  titles: number;
  awards: number;
  caps: number;
  medals: number;
  bestRating: number;
  peakSalary: number;
  /** Lifetime income from sport (salary, bonuses, endorsements). */
  earnings: number;
  injuries: number;
}

export interface AthleteState {
  sport: string | null;
  stage: AthleteStage;
  /** Hidden potential 0-100. Scouts only see a noisy read of it. */
  talent: number;
  /** Overall ability 0-100. */
  rating: number;
  /** This season's form 0-100. */
  form: number;
  /** Training consistency 0-100 (rises with steady/grind, collapses when you coast). */
  consistency: number;
  /** How visible you are to scouts 0-100. */
  exposure: number;
  club: string;
  /** 0 semi-pro, 1 second tier, 2 top flight, 3 elite. */
  league: number;
  track: "college" | "academy" | null;
  scholarship: boolean;
  /** Academic warnings while on scholarship. */
  warnings: number;
  /** Youth / academy stipend per year. */
  stipend: number;
  /** Seasons trained in this sport (drives experience). */
  years: number;
  stageYears: number;
  contractYears: number;
  /** Contract ran out; terms are being negotiated. Resolved automatically at the next Age Up. */
  expiring: boolean;
  freeAgent: boolean;
  freeAgentYears: number;
  agent: boolean;
  /** Consecutive years of coasting. */
  detrain: number;
  doping: boolean;
  dopeTitles: number;
  banYears: number;
  injury: AthleteInjury | null;
  offers: AthleteOffer[];
  /** Cannot re-enter / sign before this age (after quitting, being cut or banned). */
  lockedUntil: number;
  /** Mirror of skills.athletics we last wrote, so outside boosts can be detected. */
  athMirror: number;
  retiredAge: number | null;
  post: "none" | "coach" | "pundit";
  /** Endorsement income paid in the latest season. */
  endorsements: number;
  record: AthleteRecord;
  history: SeasonRecord[];
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

export interface IntimacyPrefs {
  /** Use an age window around your own age instead of fixed limits. */
  ageAuto: boolean;
  /** Adults only: never below 18. */
  ageMin: number;
  ageMax: number;
  /** Genders you're open to meeting. Empty means follow your sexuality. */
  genders: string[];
  /** Interests you're comfortable exploring (see data/experiences.ts). */
  interests: string[];
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
  /** Tax-advantaged retirement account balance. */
  retirementSavings: number;
  /** Share of pay saved: index into SAVINGS_LEVELS (0 none … 3 high). */
  savingsLevel: number;

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
  /** Who you're looking for and what you're open to (adult content only). */
  intimacy: IntimacyPrefs;
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
  justice: JusticeState;
  mob: MobState;
  spy: SpyState;

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
