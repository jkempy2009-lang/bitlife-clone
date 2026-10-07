/**
 * Multi-year storylines. Each arc is an entry event (drawn from the random pool) followed by beats that
 * earlier choices book for later years. See arcKit.ts for the conventions.
 */
import type { LifeEvent } from "../lifeEventsEngine";
import type { Arc } from "./arcKit";
import { YOUTH_ARC_EVENTS, YOUTH_ARCS } from "./arcsYouth";
import { WORK_ARC_EVENTS, WORK_ARCS } from "./arcsWork";
import { FAMILY_ARC_EVENTS, FAMILY_ARCS } from "./arcsFamily";
import { LIFE_ARC_EVENTS, LIFE_ARCS } from "./arcsLife";
import { LEGACY_ARC_EVENTS, LEGACY_ARCS } from "./arcsLegacy";

export type { Arc } from "./arcKit";

export const ARC_EVENTS: LifeEvent[] = [
  ...YOUTH_ARC_EVENTS,
  ...WORK_ARC_EVENTS,
  ...FAMILY_ARC_EVENTS,
  ...LIFE_ARC_EVENTS,
  ...LEGACY_ARC_EVENTS,
];

export const ARCS: Arc[] = [...YOUTH_ARCS, ...WORK_ARCS, ...FAMILY_ARCS, ...LIFE_ARCS, ...LEGACY_ARCS];
export const ARC_BY_ID: Record<string, Arc> = Object.fromEntries(ARCS.map((a) => [a.id, a]));
