/**
 * Central type definitions for the life simulator.
 * Everything inside `PlayerState` is plain JSON so it can be cloned and persisted safely.
 */

import type { CareerLife, FinanceLife } from "./careerMoney.types";
export type * from "./careerMoney.types";

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
  /** Chosen long-term treatment plan (see engine/treatment.ts). Unset means monitoring only. */
  plan?: string;
  /** Calendar year the current plan began. */
  planSince?: number;
  /** The plan lapsed (unaffordable or abandoned): the condition runs unchecked. */
  lapsed?: boolean;
  /** Years this condition has been under treatment without a break (drives adherence and remission). */
  treatedYears?: number;
}

export type Relation = "Parent" | "Sibling" | "Child" | "Partner" | "Friend" | "Grandparent" | "Grandchild" | "Nephew" | "Pet" | "Lover";
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
  /** Royal style of this person: "King", "Queen", "Prince", "Princess", "Duke of X", "Lord", "Lady". */
  royalTitle?: string;
  /** Grandchildren and nephews/nieces: the id of their parent among your children or siblings. Drives succession. */
  parentId?: string;
  /** Royal ancestors who are not the sovereign: their own place in line (1 = heir) when you took over. Drives who is crowned next. */
  royalLine?: number;
  /** Calendar year you married them (partners). */
  marriedYear?: number;
  /** Short occupation blurb for flavour ("Nurse", "Electrician"). */
  occupation?: string;
  /** Children: schooling and what they're passionate about. */
  school?: "public" | "private";
  interest?: "sport" | "music" | "art" | "science" | "none";
  /** Children: how much trouble they've been in lately. */
  trouble?: number;
  /** Royal children: how they are being raised for public life (see engine/courtFamily.ts). */
  royalTraining?: RoyalTraining;
  /** Money this person holds from the family estate (see engine/estate.ts): a parent who handed over their life, or a sibling's share. */
  wealth?: number;
  /** The old character who handed their life over: how they meant the estate to be split when they die (see engine/estate.ts). */
  willPlan?: WillPlan;
  /** Their chosen heir (relative id), when `willPlan` is "chosen". */
  willHeirId?: string;
  /** Children: the family path they are being groomed for (see engine/dynasty.ts). */
  groom?: HeirGroom;
  /** What this person did with their life, when they were once you (a parent who handed over, or an ancestor). */
  legacyNote?: string;
  // ---- relationship depth (see engine/bonds.ts, partnership.ts, circle.ts, inlaws.ts) ----
  /** Calendar year you met them (or they were born into your life). */
  metYear?: number;
  /** The moments worth remembering, oldest first (capped). */
  memories?: Memory[];
  /** Unresolved hurts that can resurface until you clear the air. */
  grievances?: Grievance[];
  /** What they need from a relationship (two of the VALUES in engine/bonds.ts). */
  values?: string[];
  /** Which of those you have worked out. */
  knownValues?: string[];
  /** Years in a row a particular need went unmet. */
  unmet?: Record<string, number>;
  /** Partners: living apart but not divorced. Calendar year it began. */
  separatedYear?: number;
  /** Partners: attended counselling together this many times. */
  counselling?: number;
  /** Partner's family, who you meet as the relationship deepens. */
  inLaws?: InLaw[];
  /** Children of a split couple: where they mostly live. */
  custody?: "shared" | "you" | "them";
  /** Name of the child's other parent when you are not together. */
  otherParent?: string;
  /** Children: what they are like (see engine/parenting.ts). */
  temperament?: string;
  /** Friends: how the friendship is labelled (best friend, old friend, work friend...). */
  friendKind?: string;
  /** Friends: calendar year of a falling-out that has not been mended. */
  riftYear?: number;
  /** Drifted away or estranged: calendar year it happened (used to offer a reunion). */
  lostYear?: number;
}

// ---- Dynasty: the family across generations (engine: src/engine/dynasty.ts, estate.ts, familyTree.ts) ----

/** The fields a family name can be known in. */
export type DynastyField = "political" | "business" | "sport" | "crime" | "arts" | "royal" | "academic";
export type WillPlan = "equal" | "eldest" | "chosen" | "charity";

export interface Will {
  plan: WillPlan;
  /** The child named as chief heir when `plan` is "chosen". */
  chosenId: string | null;
}

/** An heir being raised for a family path: how far along they are and how hard they've been pushed. */
export interface HeirGroom {
  track: DynastyField;
  /** 0-100: how far along they are. */
  level: number;
  /** 0-100: how much they resent the push. High pressure risks a rebellion. */
  pressure: number;
  /** Year of the last session (one a year per family). */
  lastYear: number;
}

/** One generation of the family, written down when the next one takes over. */
export interface GenerationRecord {
  generation: number;
  name: string;
  gender: string;
  born: number;
  /** Null when they handed the family over while alive. */
  died: number | null;
  age: number;
  headline: string;
  honours: string[];
  netWorth: number;
  fame: number;
  children: number;
  reputation: number;
  /** What this life added to the family's standing. */
  score: number;
  epitaph: string;
  handedOver: boolean;
}

/** Wealth held by the family line, outside any one person's estate: not taxed at death, not seizable by creditors. */
export interface FamilyTrust {
  balance: number;
  founded: number;
  /** Lifetime distributions paid to the line. */
  paid: number;
}

export interface DynastyState {
  /** The family name when the line began. */
  name: string;
  founded: number;
  /** Earlier generations, oldest first. */
  chronicle: GenerationRecord[];
  /** How strongly the family name carries in each field (0-100), fading unless each generation keeps it alive. */
  clout: Partial<Record<DynastyField, number>>;
  trust: FamilyTrust | null;
  will: Will;
  /** Highest combined wealth the family has held at a handover. */
  peakFortune: number;
  /** A sporting name the family carries: opens doors (and weighs) for an heir who takes up the same sport. */
  sportLegacy?: { sport: string; club: string; tier: string; score: number; parent: string };
}


export type MemoryKind = "met" | "milestone" | "joy" | "hardship" | "conflict" | "betrayal" | "kindness" | "loss";

/** A moment you and someone shared, kept so the relationship has a past. */
export interface Memory {
  year: number;
  age: number;
  kind: MemoryKind;
  text: string;
}

export type GrievanceKind = "fight" | "betrayal" | "neglect" | "debt" | "insult";

/** Something unresolved between you and another person. */
export interface Grievance {
  id: string;
  year: number;
  kind: GrievanceKind;
  /** 1 (a sore spot) to 3 (a wound). */
  weight: number;
  text: string;
}

export interface InLaw {
  name: string;
  role: "Mother-in-law" | "Father-in-law" | "Sister-in-law" | "Brother-in-law";
  age: number;
  alive: boolean;
  /** 0-100: how they feel about you. */
  warmth: number;
}

export type ParentingStyle = "strict" | "balanced" | "permissive" | "handsoff";

/** How a royal child is being brought up. Carries into the next generation if they inherit. */
export interface RoyalTraining {
  /** 0-100: sense of public duty. */
  duty: number;
  /** 0-100: the common touch, from an ordinary upbringing. */
  touch: number;
  /** 0-100: media and etiquette polish. */
  polish: number;
  school: "tutors" | "boarding" | "state";
  /** Military branch they have been steered towards (age 18+). */
  service?: "army" | "navy" | "air";
  /** Patronage they have taken up (age 16+). */
  patron?: string;
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
  /** Let to tenants: earns rent, but isn't your home. */
  rentedOut?: boolean;
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
  /** How tuition is paid: from cash (default) or a student loan. */
  funding?: "cash" | "loan";
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

/** What a named key employee is hired to do. */
export type KeyRole = "craft" | "sales" | "ops";

/** A named key employee: the chef, the rainmaker, the operations lead. They can be poached, paid, given equity or lost. */
export interface KeyPerson {
  id: string;
  name: string;
  role: KeyRole;
  title: string;
  /** 0-100. Drives how much they lift quality, sales or operations. */
  skill: number;
  /** 0-100. Low loyalty means they are listening to recruiters. */
  loyalty: number;
  wage: number;
  hired: number;
  /** Holds a slice of the company: far stickier, but the slice is gone for good. */
  partner: boolean;
}

export type RivalKind = "discounter" | "premium" | "chain" | "upstart";

/** A named competitor. Each attacks a different weakness and can be fought, bought out or outlasted. */
export interface BusinessRival {
  id: string;
  name: string;
  kind: RivalKind;
  /** 5-95. How hard they are pulling customers away. */
  strength: number;
  since: number;
}

/** A multi-year change in the whole industry (a craze, a squeeze, a wave of regulation). */
export interface MarketShift {
  id: string;
  label: string;
  blurb: string;
  /** Yearly swing in demand (fraction of revenue, positive or negative). */
  demand: number;
  /** Yearly swing in cost of goods. */
  cost: number;
  yearsLeft: number;
  /** The owner paid to lean into a tailwind or brace for a headwind. */
  responded: boolean;
}

export type InvestorKind = "angel" | "vc" | "staff";
export type InvestorAgenda = "growth" | "profit" | "exit";

/** Outside shareholder. The sum of investor shares is always `1 - ownerShare`. */
export interface BusinessInvestor {
  id: string;
  name: string;
  kind: InvestorKind;
  share: number;
  agenda: InvestorAgenda;
  /** Money they put in (VCs get it back first on a sale below their price). */
  invested: number;
  /** 1x non-participating liquidation preference. */
  pref: boolean;
  since: number;
}

/** A franchisee's agreement with the brand they bought into. */
export interface FranchiseDeal {
  brand: string;
  /** Royalty as a share of revenue. */
  royalty: number;
  /** Mandatory brand-fund contribution as a share of revenue. */
  adFund: number;
  since: number;
}

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

  // ---- business depth II: people, rivals, board, franchise (defaults in ensureBusiness) ----
  /** Named key employees (at most one per role). */
  team: KeyPerson[];
  rivals: BusinessRival[];
  shift: MarketShift | null;
  investors: BusinessInvestor[];
  /** 0-100. Investor patience running out. */
  boardHeat: number;
  /** The owner holds the shares but a professional runs the company, so it is not a full-time commitment. */
  passive: boolean;
  /** Pushed out by the board: cannot take the reins back. */
  ousted: boolean;
  /** Set when the owner bought into a franchise rather than inventing a concept. */
  franchisor: FranchiseDeal | null;
  /** Loan principal the owner has personally guaranteed. */
  guaranteed: number;
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
  /** Clean brands have a morals clause: a serious scandal ends the deal. Shady ones don't care. Defaults to !shady. */
  morals?: boolean;
  /** Years you missed the output target while burnt out. A first strike is forgiven, a second breaches. */
  strikes?: number;
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
  /** Collaborations done in your whole career. */
  collabs?: number;
  /** An ongoing public feud: it feeds attention and starves trust until it burns out. */
  feud?: CreatorFeud | null;
  /** A collaborator whose behaviour can splash onto you for a couple of years. */
  associate?: { name: string; years: number } | null;
}

export interface CreatorFeud {
  name: string;
  years: number;
  /** 0-100: how loud it is. */
  heat: number;
}

// ---- Sports career (engine: src/engine/athlete*.ts, data: src/data/sports.ts) ----

export type AthleteStage = "none" | "youth" | "college" | "semipro" | "pro" | "retired";
export type InjuryPlan = "rest" | "rehab" | "surgery" | "play" | "rush";

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
  /** Came back a season early (plan "rush"): the injury may flare up again on return. */
  rushed?: boolean;
}

export type DealCategory = "apparel" | "drink" | "watch" | "betting" | "fintech" | "charity";

/** A multi-year sponsorship. Pays every season; carries an image risk. */
export interface EndorsementDeal {
  id: string;
  brand: string;
  category: DealCategory;
  /** Gross pay per season. */
  pay: number;
  /** Seasons left on the deal (offers: seasons it would run). */
  years: number;
}

/** The squad invitation for the next four-yearly major. */
export interface NationalCall {
  /** Year the tournament is played. */
  year: number;
  major: string;
  /** False when the selectors left you out. */
  selected: boolean;
}

export type NationalPlan = "balanced" | "allin" | "withdraw";

/** A positive test the player may still contest this season. */
export interface DopingAppeal {
  ban: number;
  stripped: number;
  cost: number;
}

export interface AthleteRival {
  name: string;
  /** 0-100: how personal it has become. */
  heat: number;
  wins: number;
  losses: number;
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
  post: "none" | "coach" | "pundit" | "academy";
  /** Endorsement income paid in the latest season. */
  endorsements: number;
  /** Morale and mental health 0-100. Low values wreck form and end in burnout. */
  mental: number;
  /** Team chemistry (or, in individual sports, how well your support team works together) 0-100. */
  chemistry: number;
  /** Relationship with the head coach 0-100. */
  coachRel: number;
  captain: boolean;
  /** Share of the minutes you get 0-100 (always full in individual sports). */
  playing: number;
  /** You asked to leave; the club will shop you around at the end of the season. */
  transferReq: boolean;
  /** Public image 0-100. Sponsors pay for it and flee from damage to it. */
  image: number;
  deals: EndorsementDeal[];
  dealOffers: EndorsementDeal[];
  natCall: NationalCall | null;
  natPlan: NationalPlan;
  appeal: DopingAppeal | null;
  rival: AthleteRival | null;
  /** The story the media tells about you this season. */
  narrative: string;
  /** Year of Hall of Fame induction, if any. */
  hofYear: number | null;
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

// ---------------------------------------------------------------------------
// The wider world, school life and immigration (see engine/worldEvents.ts, school.ts, visa.ts)
// ---------------------------------------------------------------------------

/** A running world event: a pandemic, war, recession, policy change... `country` is where it started ("*" = everywhere). */
export interface WorldEventState {
  id: string;
  country: string;
  startYear: number;
  endYear: number;
  /** 1 mild, 2 serious, 3 severe. */
  severity: number;
}

export interface WorldState {
  /** Everything currently under way, in every country. */
  events: WorldEventState[];
  /** Excess cost-of-living pressure (1 = normal): rises with inflation shocks, then fades as wages catch up. */
  prices: number;
  /** Calendar year each kind of event last began, to space them out. */
  lastStart: Record<string, number>;
  /** Headlines that touched your countries, newest last. */
  chronicle: Array<{ year: number; text: string }>;
}

export interface SchoolState {
  /** 0-100: how well you fit in with classmates. */
  social: number;
  /** 0-100: how much you are being picked on right now. */
  bullied: number;
  /** 0-100: how you get on with teachers. */
  teacher: number;
  /** 0-100: exam and performance pressure. */
  stress: number;
  /** Extracurricular you stick with, if any. */
  club: string | null;
  clubYears: number;
  /** Where you go to school. */
  tier: "state" | "private";
  /** A tutor is helping this year. */
  tutor: boolean;
  /** School years you skipped a lot of lessons. */
  truancy: number;
  /** Report cards: newest last (max 6). */
  reports: Array<{ age: number; grade: string; note: string }>;
  /** Highlights and scars that carry into adult life. */
  honors: string[];
}

export type VisaStatus = "citizen" | "permanent" | "work" | "student" | "family" | "asylum" | "overstay";

export interface ImmigrationState {
  /** Countries you hold citizenship in (your birth country to begin with). */
  citizenship: string[];
  status: VisaStatus;
  /** Years left on a temporary permit (0 for citizen and permanent). */
  yearsLeft: number;
  /** Consecutive years living in the current country. */
  residenceYears: number;
  /** 0-100 fluency in the language of the country you live in. */
  fluency: number;
  /** Visa applications refused. */
  refused: number;
  /** Years in a row on a work or student permit without the job or course it depends on. */
  idle: number;
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

/** Where you stand in a royal family. Titles follow the British model (absolute primogeniture). */
export interface RoyalLife {
  /** Who holds the crown relative to you. */
  crown: "self" | "parent" | "grandparent" | "sibling" | "other" | "abdicated";
  /** Styled His/Her Royal Highness: only children and grandchildren of the reigning sovereign. */
  hrh: boolean;
  /** A dukedom or courtesy title you hold, e.g. "Duke of Kent". */
  peerage: string | null;
  /** Position in the line of succession (0 = sovereign, 1 = heir). */
  line: number;
}

export type ServiceBranch = "army" | "navy" | "air";

/** Military service as a young royal. */
export interface MilitaryService {
  branch: ServiceBranch;
  years: number;
  /** Index into the branch's rank ladder. */
  rank: number;
  /** On an operational posting this year. */
  deployed: boolean;
  deployments: number;
  /** Service has ended (you can still be a veteran patron). */
  done: boolean;
}

/** A scandal waiting for a response from the press office. */
export interface CourtScandal {
  id: string;
  title: string;
  story: string;
  severity: 1 | 2 | 3;
  year: number;
}

/** Everything about being a working royal that isn't succession: popularity, duties, the household and the purse. */
export interface CourtState {
  /** 0-100: how much the public like you personally (separate from Royal Respect, which guards against a coup). */
  approval: number;
  /** 0-100: public appetite for abolishing the monarchy. */
  republic: number;
  /** 0-100: how closely the tabloids are watching. */
  heat: number;
  /** 0-100: constitutional strain from meddling in politics. */
  strain: number;
  /** 0-100: your working relationship with the government (sovereign). */
  government: number;
  /** Name of the current Prime Minister. */
  pm: string;
  /** Household: 0 none, 1 press secretary, 2 private secretary, 3 full private office. */
  secretary: number;
  patronages: Array<{ id: string; years: number; lastYear: number }>;
  service: MilitaryService | null;
  scandal: CourtScandal | null;
  /** Reigning name, e.g. "Charles III". */
  regnalName: string | null;
  /** Years of national mourning remaining. */
  mourning: number;
  /** If crowned as a minor: who governs for you until you are 18. */
  regency: string | null;
  coronated: boolean;
  /** Realms that still share the sovereign as head of state. */
  realmNames: string[];
  /** Years left out of public life (withdrawn after a scandal). */
  withdrawn: number;
  /** Stripped of titles and funding after a disgrace. */
  disgraced: boolean;
  /** Left royal life (a former "senior royal"). */
  steppedBack: boolean;
  /** Gave up the throne in favour of an heir. */
  abdicated: boolean;
  lastReferendum: number;
  /** Private estate open to paying visitors. */
  estateOpen: boolean;
  /** Accepted a slimmed-down, cheaper monarchy. */
  slimmed: boolean;
  /** Change to the Sovereign Grant after funding reviews (-0.4 .. +0.3). */
  grantAdj: number;
  /** Engagement days used this year, by booking key. Reset every Age Up. */
  booked: Record<string, number>;
  /** Engagement days you used last year (drives the allowance of working royals). */
  slotsLast: number;
  /** Last year's money in and out, for display. */
  ledger: { grant: number; duchy: number; estate: number; allowance: number; staff: number; upkeep: number };
}

/** Hidden gifts and tendencies (0-100, 50 typical). Never shown in play; see data/talents.ts. */
export type Talents = Record<import("../data/talents").TalentKey, number>;

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
  /** Floor under the yearly royalty: a loved record never quite stops earning. */
  evergreen?: number;
  /** The catalogue was sold: it no longer pays you. */
  sold?: boolean;
  /** An unexpected streaming breakout rather than a planned hit. */
  breakout?: boolean;
  direction?: "commercial" | "balanced" | "artistic";
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
  /** Personality. Shapes what they want and how they fall apart. */
  trait?: BandTrait;
  /** Share (0-100) of the band's songs credited to them. The rest is yours. */
  credit?: number;
  /** Years in the band. */
  years?: number;
  /** What is eating them right now, if anything. Unaddressed grievances end careers. */
  grievance?: "credit" | "money" | "direction" | "habit" | null;
  /** Years the grievance has gone unanswered. */
  grievanceYears?: number;
  /** The player talked to them this year. */
  talked?: boolean;
}

export type BandTrait = "peacemaker" | "diva" | "workaholic" | "flake" | "addict" | "mercenary" | "loyalist";

/** A band that no longer exists but might one day reunite. */
export interface FormerBand {
  name: string;
  year: number;
  members: BandMember[];
  /** How it ended: shapes whether anyone will pick up the phone. */
  split: "amicable" | "bitter";
}

/** A rights or credit dispute over your work. */
export interface RightsDispute {
  kind: "credit" | "plagiarism" | "masters";
  claimant: string;
  /** What they want, in dollars. */
  amount: number;
  yearsLeft: number;
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
  /** Times the label has extended the term to make you finish owed albums. */
  extended?: number;
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
  /** How band income is carved up: equally, or by who wrote the songs. */
  split?: "equal" | "writers";
  /** Largest audience you ever had. */
  peakFans?: number;
  /** The band you used to be in, if it broke up. */
  formerBand?: FormerBand | null;
  dispute?: RightsDispute | null;
  /** Cash taken for selling catalogue rights over the years. */
  catalogSold?: number;
  /** Summary of the last tour for the dashboard. */
  lastTour?: { year: number; label: string; shows: number; attendance: number; net: number; mode: "headline" | "support" } | null;
}

export type ActingMedium = "film" | "tv" | "stage";

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
  /** Film when absent (old saves). */
  medium?: ActingMedium;
  /** A low-budget film that outperformed everything. */
  sleeper?: boolean;
  /** Seasons (TV) or installment number (franchise). */
  seasons?: number;
  installment?: number;
}

export interface FilmOffer {
  id: string;
  title: string;
  genre: string;
  role: "cameo" | "supporting" | "lead";
  /** Film fee, or the fee per season for television. */
  fee: number;
  budget: number;
  /** Script quality, 0-100. */
  script: number;
  prestige: number;
  medium?: ActingMedium;
  /** TV only: seasons guaranteed by the contract. */
  seasons?: number;
  /** A passion project offered to a faded star. */
  comeback?: boolean;
  /** Franchise sequel number (1 = the original). */
  installment?: number;
}

export interface PendingFilm extends Omit<FilmOffer, "role"> {
  role: FilmCredit["role"];
  /** Your own money riding on it (producer / director). */
  invested?: number;
  /** Press and marketing push, 0-40. */
  promo?: number;
  /** You are staying in character for the shoot. */
  method?: boolean;
}

export type AgentKind = "boutique" | "mid" | "major";

export interface Agent {
  name: string;
  cut: number;
  /** 0-100: how hard they work for you. */
  skill: number;
  yearsWith: number;
  /** Boutique agents are hungry for you, major agencies drop quiet clients. */
  kind: AgentKind;
  /** 0-100: their faith in you. */
  trust: number;
}

/** A personal manager: an extra cut in return for steering the whole career. */
export interface Manager {
  name: string;
  cut: number;
  skill: number;
  yearsWith: number;
}

export interface StudioDeal {
  studio: string;
  yearsLeft: number;
  fee: number;
  genre: string;
}

/** A television show you are contracted to. */
export interface Series {
  title: string;
  genre: string;
  network: string;
  /** A pilot waits to be picked up; a running show airs a season a year. */
  status: "pilot" | "running";
  /** Seasons aired so far. */
  season: number;
  /** Seasons left on your contract. */
  yearsLeft: number;
  /** Your fee per season. */
  fee: number;
  /** Audience / ratings, 0-100. */
  ratings: number;
  script: number;
  prestige: number;
  role: "cameo" | "supporting" | "lead";
  /** Running average of the critics' score. */
  critics: number;
}

export interface Franchise {
  name: string;
  genre: string;
  /** Sequels still owed. */
  filmsLeft: number;
  /** The installment currently in production or next up. */
  installment: number;
  fee: number;
}

export interface FranchiseOffer {
  name: string;
  genre: string;
  films: number;
  fee: number;
}

export type CampaignMode = "quiet" | "festivals" | "lunch" | "blitz";

/** A film in the running for this year's prizes. */
export interface AwardsRun {
  filmId: string;
  title: string;
  genre: string;
  role: FilmCredit["role"];
  critics: number;
  prestige: number;
  indie: boolean;
  medium: ActingMedium;
  campaign: CampaignMode;
  spent: number;
}

/** A second round of auditions you have been invited to. */
export interface AuditionCallback {
  genre: string;
  /** Chance of winning the part if you wing it. */
  odds: number;
}

export interface Residual {
  title: string;
  amount: number;
  yearsLeft: number;
}

export interface ActingState {
  agent: Agent | null;
  manager: Manager | null;
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
  series: Series | null;
  franchise: Franchise | null;
  franchiseOffer: FranchiseOffer | null;
  awardsRun: AwardsRun | null;
  callback: AuditionCallback | null;
  /** Auditions failed in a row. */
  rejections: number;
  residuals: Residual[];
  /** Coaching bonus applied to the next performance. */
  prepBonus: number;
  /** Year of the last comeback attempt. */
  comebackYear: number;
  /** Voice jobs and regional commercials booked, ever. */
  sideGigs: number;
  awards: string[];
  nominations: number;
  earnings: number;
  yearsSinceWork: number;
  modelBookings: number;
  lastIncome: { fees: number; bonuses: number; agent: number; series: number; residuals: number };
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
  /** 0-100: how intense your fans' attachment is. Loyal, but a few go too far. */
  devotion?: number;
  /** Paying to keep a partner and children out of the press. */
  familyShield?: boolean;
  /** Restraining orders obtained over your career. */
  orders?: number;
  /** A restraining order is in force: stalker incidents are rarer but a breach is dangerous. */
  orderYears?: number;
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
  /** Turned state's evidence against people who do not forget. */
  snitch: boolean;
  /** Where you live after release: shapes supervision risk and relapse. */
  housing: "stable" | "halfway" | "unstable";
  /** Trust with your parole or probation officer, 0-100. */
  officerTrust: number;
  /** Years since you last committed a crime the police know of (drives early discharge). */
  cleanYears: number;
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
  /** Named people working under you. `crew` always equals the roster length. */
  crewList: CrewMember[];
  /** The place the family keeps for you while you serve time (null when you are not away). */
  held: HeldPlace | null;
}

export interface CrewMember {
  id: string;
  name: string;
  /** How much they will take for you before they take a deal, 0-100. */
  loyalty: number;
  /** Competence 0-100: improves the odds of jobs they join. */
  skill: number;
  /** Years in your crew. */
  years: number;
}

export interface HeldPlace {
  tier: number;
  company: string;
  /** Year the sentence began. */
  year: number;
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
  /** Moral compass 0-100. Ruthless choices in the field wear it down; low conscience haunts you. */
  conscience: number;
  /** Operations that ended in a moral choice. */
  dilemmas: number;
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
  /** How the country is doing under your laws, 0-100 each (prosperity, health, environment, safety, liberty, finances). */
  indicators: Record<string, number>;
  /** Laws you passed that are still on the books. */
  laws: EnactedLaw[];
  /** The paper trail of your corruption, 0-100: what prosecutors can eventually prove. */
  evidence: number;
}

/** A bill you got through the legislature. Effects ramp up over a few years. */
export interface EnactedLaw {
  id: string;
  year: number;
  /** Country whose statute book it changed. */
  country: string;
  /** 1 = passed as written, 0.5 = watered down in a compromise. */
  power: number;
  /** The office you held when it passed. */
  tier: number;
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

/** A life event booked for a later calendar year (multi-year storylines). */
export interface ScheduledEvent {
  id: string;
  dueYear: number;
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
  /** Hidden natural gifts that shape careers and willpower. */
  talents: Talents;
  /** Your temperament: the level happiness settles around. Set at birth (or in character design). */
  outlook: number;
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
  /** Working life: burnout, sector cycles, unemployment spells. */
  career: CareerLife;
  /** Personal finance: student loan, Roth account, insolvency. */
  finance: FinanceLife;

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
  /** Line of succession, titles and style (null if not from a royal family). */
  royal: RoyalLife | null;
  royalRespect: number;
  nation: NationState;
  /** Popularity, engagements, household and finances of a royal (defaults for everyone). */
  court: CourtState;
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
  statecraft: StatecraftState;
  pregnancy: Pregnancy | null;
  blackjack: BlackjackHand | null;
  /** Who you're looking for and what you're open to (adult content only). */
  intimacy: IntimacyPrefs;
  /** How you raise your children: a standing choice with trade-offs (see engine/parenting.ts). */
  parentingStyle: ParentingStyle;
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
  /** Pandemics, wars, recessions and policy shifts around you. */
  world: WorldState;
  /** Report cards, friendships, bullying and clubs through your school years. */
  school: SchoolState;
  /** Your right to live and work where you are. */
  immigration: ImmigrationState;

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
  /** Storyline beats due in a future year (see engine/arcEffects.ts). */
  scheduled: ScheduledEvent[];
  seenEvents: Record<string, number>;
  lifeLog: string[];
  stats: LifetimeStats;
  generation: number;
  /** The family line across generations: chronicle, name clout, trust and will. */
  dynasty: DynastyState;
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
