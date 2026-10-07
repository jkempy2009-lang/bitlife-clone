/**
 * Mechanics behind multi-year storylines: delayed events, relatives passing away, emigration.
 * Kept free of imports from events.ts so events.ts can use it without a cycle.
 */
import type { PlayerState, Relation } from "@/types/game.types";
import { EVENT_BY_ID, type LifeEvent, type ScheduleSpec } from "@/data/lifeEventsEngine";
import type { Rng } from "@/lib/rng";
import { COUNTRIES, getCountry } from "@/data/countries";
import { clamp } from "@/lib/format";
import { addLog, changeStat, setFlag } from "./state";

/** How many calendar years past its due date an event may wait for eligibility before it lapses. */
export const SCHEDULE_GRACE = 4;
export const FORCE_GRACE = 10;
/** At most this many storyline beats are delivered in a single Age Up. */
export const MAX_BEATS_PER_YEAR = 2;

export function scheduleEvent(p: PlayerState, spec: ScheduleSpec, rng: Rng) {
  if (!EVENT_BY_ID[spec.id]) return;
  if (p.scheduled.some((s) => s.id === spec.id)) return; // never double-book a beat
  const [lo, hi] = spec.years;
  const years = Math.max(1, rng.int(Math.min(lo, hi), Math.max(lo, hi)));
  p.scheduled.push({ id: spec.id, dueYear: p.year + years });
}

export function scheduleAll(p: PlayerState, specs: ScheduleSpec | ScheduleSpec[], rng: Rng) {
  for (const s of Array.isArray(specs) ? specs : [specs]) scheduleEvent(p, s, rng);
}

export function cancelScheduled(p: PlayerState, ids: string[]) {
  p.scheduled = p.scheduled.filter((s) => !ids.includes(s.id));
}

/** A storyline that loses its next beat (death of a character, age limits, a long prison term) is closed off, not left dangling. */
function lapse(p: PlayerState, e: LifeEvent) {
  if (!e.arc) return;
  setFlag(p, `arc_${e.arc}_done`);
  setFlag(p, `arc_${e.arc}_lapsed`);
}

/**
 * Closes storylines that are marked underway but have nothing booked any more (an unanswered beat, an old save,
 * a beat removed from the game). Without this a dead arc would hold one of the two storyline slots forever.
 */
export function closeOrphanArcs(p: PlayerState) {
  for (const f of p.flags) {
    const m = /^arc_([a-z0-9]+)$/.exec(f);
    if (!m || p.flags.includes(`${f}_done`)) continue;
    const arc = m[1];
    const booked = p.scheduled.some((s) => EVENT_BY_ID[s.id]?.arc === arc);
    if (booked || p.queuedEvents.some((id) => EVENT_BY_ID[id]?.arc === arc)) continue;
    setFlag(p, `arc_${arc}_done`);
    setFlag(p, `arc_${arc}_lapsed`);
  }
}

/**
 * Removes and returns the scheduled events that are due now. `eligible` is the normal eligibility test;
 * `force` events skip it (but not prison / mature gating, which `canShow` supplies).
 */
export function takeDueEvents(
  p: PlayerState,
  eligible: (e: LifeEvent) => boolean,
  canShow: (e: LifeEvent) => boolean,
  max = MAX_BEATS_PER_YEAR,
): LifeEvent[] {
  closeOrphanArcs(p);
  if (p.scheduled.length === 0) return [];
  const out: LifeEvent[] = [];
  const keep: PlayerState["scheduled"] = [];
  const queue = [...p.scheduled].sort((a, b) => a.dueYear - b.dueYear);
  for (const s of queue) {
    const e = EVENT_BY_ID[s.id];
    if (!e) continue; // unknown id (removed from the game): drop silently
    if (s.dueYear > p.year) {
      keep.push(s);
      continue;
    }
    const ok = e.force ? canShow(e) : eligible(e);
    if (ok && out.length < max) {
      out.push(e);
      continue;
    }
    // Prison never lapses a beat: its grace period starts again after release.
    if (!ok && p.isInPrison) {
      keep.push({ ...s, dueYear: p.year });
      continue;
    }
    const overdue = p.year - s.dueYear;
    if (!ok && (overdue > (e.force ? FORCE_GRACE : SCHEDULE_GRACE) || (!e.force && p.age > e.maxAge))) {
      lapse(p, e);
      continue;
    }
    keep.push(s);
  }
  p.scheduled = keep;
  return out;
}

// ---------------------------------------------------------------------------
// Relatives passing away
// ---------------------------------------------------------------------------

export function relativeDies(p: PlayerState, relation: Relation) {
  const r = p.relatives
    .filter((x) => x.relation === relation && x.alive && x.partnerStatus !== "ex")
    .sort((a, b) => b.age - a.age)[0];
  if (!r) return;
  r.alive = false;
  r.deathAge = r.age;
  r.deathYear = p.year;
  changeStat(p, "happiness", -Math.round(6 + r.relationshipBar / 10));
  addLog(p, `${r.name} passed away at age ${r.age}.`);
}

// ---------------------------------------------------------------------------
// Emigration
// ---------------------------------------------------------------------------

export function emigrate(p: PlayerState, how: "abroad" | "home", rng: Rng) {
  const target =
    how === "home"
      ? getCountry(p.birthCountry)
      : rng.pick(COUNTRIES.filter((c) => c.name !== p.residence.country));
  const city = rng.pick(target.cities);
  p.residence = { ...p.residence, country: target.name, city };
  p.currentJob = null;
  p.annualSalary = 0;
  if (how === "abroad") {
    setFlag(p, "emigrant");
    for (const r of p.relatives) {
      if (!r.alive || r.relation === "Partner" || r.partnerStatus === "ex") continue;
      r.relationshipBar = clamp(r.relationshipBar - 10);
    }
  } else {
    p.flags = p.flags.filter((f) => f !== "emigrant");
    setFlag(p, "returned_home");
  }
  addLog(p, how === "abroad" ? `You moved to ${city}, ${target.name}.` : `You moved back to ${city}, ${target.name}.`);
}
