/**
 * Master life-event database. Scenario trees are decoupled data: the engine
 * (src/engine/events.ts) is the only thing that interprets them.
 *
 * Event files live in ./events/*.ts and are merged into `LIFE_EVENTS` below.
 */
import type { Climate, CrimeCharge, Relation, PartnerStatus, Relative, Skills, Vices } from "@/types/game.types";
import { EARLY_EVENTS } from "./events/early";
import { TEEN_EVENTS } from "./events/teen";
import { ADULT_EVENTS } from "./events/adult";
import { LATER_EVENTS } from "./events/later";
import { SOCIAL_EVENTS } from "./events/social";
import { SPECIAL_EVENTS } from "./events/special";
import { EXTRA_EVENTS } from "./events/extra";
import { LIFE2_EVENTS } from "./events/life2";
import { PATHS2_EVENTS } from "./events/paths2";
import { EARLY2_EVENTS } from "./events/early2";
import { LIFE3_EVENTS } from "./events/life3";
import { MATURE_EVENTS } from "./events/mature";
import { LIFE4_EVENTS } from "./events/life4";
import { LIFE5_EVENTS } from "./events/life5";
import { ADULT2_EVENTS } from "./events/adult2";
import { LATER2_EVENTS } from "./events/later2";
import { SPORTS_EVENTS } from "./events/sports";
import { BUSINESS_EVENTS } from "./events/business";
import { CREATIVE_EVENTS } from "./events/creative";
import { JUSTICE_EVENTS } from "./events/justice";
import { POLITICS_EVENTS } from "./events/politics";

export type EventCategory =
  | "general"
  | "school"
  | "career"
  | "crime"
  | "health"
  | "royalty"
  | "fame"
  | "family"
  | "romance"
  | "money"
  | "prison";

export interface NewRelativeSpec {
  relation: Extract<Relation, "Friend" | "Partner" | "Child" | "Sibling">;
  /** Age relative to the player (partners/friends). */
  ageOffset?: [number, number];
  partnerStatus?: Exclude<PartnerStatus, "ex">;
  /** Absolute age (e.g. 0 for a newborn sibling). */
  age?: number;
  /** Pre-generated person (used for "meet someone" encounters). */
  prebuilt?: Relative;
  /** Force a gender (dating preferences). */
  gender?: string;
  /** Absolute age range for the new person (dating preferences; adults only). */
  ageRange?: [number, number];
}

export interface ChoiceEffects {
  bankBalanceDelta?: number;
  happinessDelta?: number;
  healthDelta?: number;
  smartsDelta?: number;
  looksDelta?: number;
  karmaDelta?: number;
  fameDelta?: number;
  royalRespectDelta?: number;
  diseaseTrigger?: string;
  logText: string;

  // ---- extensions beyond the base schema ----
  performanceDelta?: number;
  setFlags?: string[];
  clearFlags?: string[];
  skillDeltas?: Partial<Skills>;
  relationshipDelta?: { target: Relation | "All"; delta: number };
  addRelative?: NewRelativeSpec;
  endRelationship?: "breakup" | "divorce";
  /** Upgrades a dating partner to married. */
  marry?: boolean;
  /** Event id to force into next year's Age Up. */
  queueEvent?: string;
  arrest?: CrimeCharge;
  loseJob?: boolean;
  promote?: boolean;
  /** Percent change to current salary. */
  salaryPct?: number;
  /** Instantly kills the player with this cause of death. */
  die?: string;
  stripRoyalty?: boolean;
  bankMultiplier?: number;
  cureAll?: boolean;
  /** Changes addiction levels (0-100). */
  viceDelta?: Partial<Vices>;
  /** Kills someone (adult). Triggers the murder investigation machinery. */
  kill?: boolean;
  /** Starts a pregnancy with your partner or lover. */
  pregnancy?: "partner" | "lover";
  /** Your partner learns about the affair. */
  exposeAffair?: boolean;
  /** Adopt a pet (adds a Pet relative). */
  addPet?: "dog" | "cat";
  /** Adds to hobby skill levels. */
  hobbyDelta?: Record<string, number>;
  /** Arbitrary business-state change (see engine/business.ts `bizEffect`). May return a sentence appended to the result. */
  bizEffect?: (p: import("@/types/game.types").PlayerState, rng: import("@/lib/rng").Rng) => string | void;
  /** Arbitrary state change (justice, politics, mob and spy events use this). Runs on a clone, after the other effects. */
  apply?: (p: import("@/types/game.types").PlayerState, rng: import("@/lib/rng").Rng) => void;
}

export interface ChoiceOption {
  text: string;
  /** Applied on success (or always, if `chance` is absent). */
  effects: ChoiceEffects;
  chance?: {
    p: number;
    /** Shifts p by (stat-50)/250. */
    scaleBy?: "smarts" | "looks" | "health" | "happiness";
    failure: ChoiceEffects;
  };
}

export interface EventRequirements {
  hasPartner?: boolean;
  married?: boolean;
  hasChildren?: boolean;
  hasSibling?: boolean;
  hasFriend?: boolean;
  parentAlive?: boolean;
  hasGrandchildren?: boolean;
  hasPartnerStatus?: "dating" | "married";
  /** Current job must belong to one of these career lines. */
  jobLine?: string[];
  climate?: Climate[];
  minVice?: Partial<Vices>;
  hasJob?: boolean;
  inSchool?: boolean;
  royal?: boolean;
  hasVehicle?: boolean;
  hasProperty?: boolean;
  careers?: Array<"actor" | "musician">;
  flagsAll?: string[];
  flagsNone?: string[];
  minBank?: number;
  maxBank?: number;
  minNetWorth?: number;
  minStat?: Partial<Record<"happiness" | "health" | "smarts" | "looks" | "karma" | "fame", number>>;
  maxStat?: Partial<Record<"happiness" | "health" | "smarts" | "looks" | "karma" | "fame", number>>;
  countries?: string[];
  /** Events are free-world only unless this is true (see prisonOnly). */
  custom?: (p: import("@/types/game.types").PlayerState) => boolean;
}

export interface LifeEvent {
  id: string;
  title: string;
  description: string;
  minAge: number;
  maxAge: number;
  category: EventCategory;
  options: ChoiceOption[];

  // ---- extensions ----
  /** Relative selection weight (default 1). */
  weight?: number;
  /** Only ever appears once per life. */
  once?: boolean;
  /** Minimum years between appearances (default 3). */
  cooldown?: number;
  requires?: EventRequirements;
  /** Only appears while serving a sentence. */
  prisonOnly?: boolean;
  /** Adult-themed scenario: only offered when mature content is on and the player is 18+. */
  mature?: boolean;
}

export const LIFE_EVENTS: LifeEvent[] = [
  ...EARLY_EVENTS,
  ...TEEN_EVENTS,
  ...ADULT_EVENTS,
  ...LATER_EVENTS,
  ...SOCIAL_EVENTS,
  ...SPECIAL_EVENTS,
  ...EXTRA_EVENTS,
  ...LIFE2_EVENTS,
  ...PATHS2_EVENTS,
  ...EARLY2_EVENTS,
  ...LIFE3_EVENTS,
  ...MATURE_EVENTS,
  ...LIFE4_EVENTS,
  ...LIFE5_EVENTS,
  ...ADULT2_EVENTS,
  ...LATER2_EVENTS,
  ...SPORTS_EVENTS,
  ...BUSINESS_EVENTS,
  ...CREATIVE_EVENTS,
  ...JUSTICE_EVENTS,
  ...POLITICS_EVENTS,
];

export const EVENT_BY_ID: Record<string, LifeEvent> = Object.fromEntries(
  LIFE_EVENTS.map((e) => [e.id, e]),
);
