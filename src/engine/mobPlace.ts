/**
 * Doing time as a made man. The family keeps your place while you are away, if you keep your mouth shut:
 * a stand-up guy walks out to the rank he left; someone who talked, or who the family wrote off, does not.
 * Kept apart from underworld.ts so the courts and prisons can use it without a dependency loop.
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog } from "./state";

type Notices = NonNullable<ActionResult["notices"]>;

const inFamily = (p: PlayerState) => p.currentJob?.lineId === "mafia";

/** Take the player out of the family's day-to-day (arrest, detention, prison) while remembering the place. */
export function parkMobPlace(p: PlayerState) {
  if (!inFamily(p) || !p.currentJob) return;
  p.mob.held = { tier: p.currentJob.tier, company: p.currentJob.company, year: p.year };
}

/** Forget the place for good (you talked, or the family cut you loose). */
export function dropMobPlace(p: PlayerState) {
  p.mob.held = null;
}

/** Can the family still take this person back? */
export function mobWouldTakeBack(p: PlayerState): boolean {
  const m = p.mob;
  return !!m.held && !m.informant && !m.witsec && !m.marked && m.loyalty >= 20;
}

/**
 * Come home to the family (release, acquittal, charges dropped). Returns true if the place was restored.
 * `yearsAway` demotes you after a long stretch: the family does not wait forever for the same rank.
 */
export function restoreMobPlace(p: PlayerState, rng: Rng, yearsAway: number, notices?: Notices): boolean {
  const held = p.mob.held;
  if (!held) return false;
  const ok = mobWouldTakeBack(p);
  p.mob.held = null;
  if (!ok) {
    const body = p.mob.informant
      ? "The family knows you talked. Nobody from the old crew will ever call."
      : "The family has moved on. Your seat was given to someone else while you were away.";
    addLog(p, body);
    notices?.push({ kind: "info", title: "No Place Waiting", body, tone: "bad" });
    return false;
  }
  const line = CAREER_BY_ID.mafia;
  const tier = Math.max(0, Math.min(held.tier - (yearsAway >= 8 ? 2 : yearsAway >= 4 ? 1 : 0), line.ladder.length - 1));
  p.currentJob = { id: rng.id(), title: line.ladder[tier].title, company: held.company, salary: line.ladder[tier].salary, performance: p.mob.respect, tier, lineId: "mafia", yearsInRole: 0 };
  p.annualSalary = p.currentJob.salary;
  const demoted = tier < held.tier;
  const body = demoted
    ? `The ${held.company} did not forget a man who kept quiet, but a long absence costs you: you're back as ${line.ladder[tier].title}.`
    : `The ${held.company} kept your place warm. You walk back in as ${line.ladder[tier].title}, and nobody asks where you've been.`;
  addLog(p, body);
  notices?.push({ kind: "info", title: demoted ? "Back in the Family" : "Welcome Back", body, tone: "good" });
  return true;
}
