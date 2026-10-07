/**
 * Authoring kit for multi-year storylines ("arcs").
 *
 * An arc is a chain of events: one `entry` (drawn from the normal random pool) followed by `beat`s, each of
 * which is booked by an earlier choice via `later(...)` and delivered some years later by the scheduler.
 *
 * Flag conventions (so arcs never collide):
 *   arc_<id>            the arc is underway (set by the entry's accepting options)
 *   arc_<id>_done       the arc is over; never re-offered
 *   arc_<id>_<outcome>  how it ended, kept for callbacks from other events
 *   arc_<id>_<memory>   decisions that colour later beats
 * Arc ids are a single lowercase word so `arc_<id>` is easy to tell apart from its memory flags.
 */
import { ev } from "../eventBuilders";
import type { ChoiceEffects, ChoiceOption, EventCategory, EventRequirements, LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";

export type Fx = Omit<ChoiceEffects, "logText">;

type Extra = Partial<Pick<LifeEvent, "weight" | "once" | "cooldown" | "prisonOnly" | "mature" | "force" | "scheduledOnly">> & {
  requires?: EventRequirements;
};

export interface ArcStage {
  /** Flag that, when set, makes this the current chapter (the last matching stage wins). */
  flag: string;
  /** One-line status shown on the Dashboard. Tokens like {rival} are filled in. */
  text: string;
}

export interface Arc {
  id: string;
  title: string;
  emoji: string;
  /** Status when no stage flag matches yet. */
  start: string;
  stages: ArcStage[];
}

export const flagOf = (arc: string) => `arc_${arc}`;
export const doneOf = (arc: string) => `arc_${arc}_done`;

const MAIN_FLAG = /^arc_[a-z0-9]+$/;
/** Arcs currently in progress (a main flag without its `_done`). */
export function activeArcFlags(p: PlayerState): string[] {
  return p.flags.filter((f) => MAIN_FLAG.test(f) && !p.flags.includes(`${f}_done`));
}
/** Keeps a life from drowning in plot: at most two storylines run at once. */
export const arcSlotFree = (p: PlayerState) => activeArcFlags(p).length < 2;

/** Book a follow-up beat (named `later`, never `then`: a module exporting `then` is thenable and hangs dynamic import)  `lo`..`hi` years from now. */
export const later = (id: string, lo: number, hi: number, rest: Fx = {}): Fx => {
  const prior = rest.queueAfter ? (Array.isArray(rest.queueAfter) ? rest.queueAfter : [rest.queueAfter]) : [];
  return { ...rest, queueAfter: [...prior, { id, years: [lo, hi] }] };
};

/** Mark the arc as underway. */
export const begin = (arc: string, rest: Fx = {}): Fx => ({ ...rest, setFlags: [flagOf(arc), ...(rest.setFlags ?? [])] });

/** Remember a decision for later beats. */
export const mark = (flags: string | string[], rest: Fx = {}): Fx => ({
  ...rest,
  setFlags: [...(rest.setFlags ?? []), ...(Array.isArray(flags) ? flags : [flags])],
});

/** End the arc with a named outcome. */
export const fin = (arc: string, outcome: string, rest: Fx = {}): Fx => ({
  ...rest,
  setFlags: [...(rest.setFlags ?? []), doneOf(arc), `arc_${arc}_${outcome}`],
});

/** First chapter: drawn from the random pool, once, and only if there's room for another storyline. */
export function entry(
  arc: string,
  id: string,
  category: EventCategory,
  minAge: number,
  maxAge: number,
  title: string,
  description: string,
  options: ChoiceOption[],
  extra: Extra = {},
): LifeEvent {
  const { requires, ...rest } = extra;
  return ev(id, category, minAge, maxAge, title, description, options, {
    once: true,
    ...rest,
    arc,
    requires: {
      ...requires,
      flagsNone: [flagOf(arc), doneOf(arc), ...(requires?.flagsNone ?? [])],
      custom: (p) => arcSlotFree(p) && (requires?.custom ? requires.custom(p) : true),
    },
  });
}

/** A later chapter: only ever delivered by the scheduler, and only while the arc is still alive. */
export function beat(
  arc: string,
  id: string,
  category: EventCategory,
  minAge: number,
  maxAge: number,
  title: string,
  description: string,
  options: ChoiceOption[],
  extra: Extra = {},
): LifeEvent {
  const { requires, ...rest } = extra;
  return ev(id, category, minAge, maxAge, title, description, options, {
    once: true,
    cooldown: 0,
    ...rest,
    arc,
    scheduledOnly: true,
    requires: {
      ...requires,
      flagsAll: [flagOf(arc), ...(requires?.flagsAll ?? [])],
      flagsNone: [doneOf(arc), ...(requires?.flagsNone ?? [])],
    },
  });
}

export const hasLivingPartner = (p: PlayerState) => p.relatives.some((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");
