import type { PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { addLog, MAX_AGE } from "./state";

/** Yearly probability of death given age and health (0-100). */
export function deathChance(age: number, health: number): number {
  const base =
    age < 1 ? 0.004
    : age < 15 ? 0.0003
    : age < 40 ? 0.0008
    : age < 50 ? 0.0015
    : age < 60 ? 0.004
    : age < 70 ? 0.01
    : age < 80 ? 0.025
    : age < 90 ? 0.07
    : age < 100 ? 0.16
    : 0.3;
  const factor = health < 50 ? 1 + (50 - health) / 25 : health > 80 ? 0.8 : 1;
  return Math.min(0.95, base * factor);
}

export function naturalCause(age: number, rng: Rng): string {
  if (age >= 80) return rng.pick(["old age", "heart failure in your sleep", "a peaceful passing at home"]);
  if (age >= 60) return rng.pick(["a heart attack", "a stroke", "pneumonia", "complications from old age"]);
  if (age >= 18) return rng.pick(["a sudden heart attack", "a freak accident", "an undiagnosed illness", "a car accident"]);
  return rng.pick(["a rare childhood illness", "a tragic accident"]);
}

export function killPlayer(p: PlayerState, cause: string) {
  if (!p.alive) return;
  p.alive = false;
  p.causeOfDeath = cause;
  p.deathYear = p.year;
  addLog(p, `You died at age ${p.age} from ${cause}.`);
}

export { MAX_AGE };
