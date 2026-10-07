/**
 * Autopilot: how "your life carries on" while you skip years. Decisions that come up are
 * made the way a sensible, cautious version of you would, not at random and not recklessly.
 */
import type { PlayerState } from "@/types/game.types";
import type { ChoiceEffects, ChoiceOption, LifeEvent } from "@/data/lifeEventsEngine";
import { canAfford } from "./events";

/** How good (or bad) one outcome looks. Never touches the RNG. */
function effectsScore(p: PlayerState, fx: ChoiceEffects): number {
  let s = 0;
  s += (fx.happinessDelta ?? 0) * 1.0;
  s += (fx.healthDelta ?? 0) * 1.2;
  s += (fx.smartsDelta ?? 0) * 0.6;
  s += (fx.looksDelta ?? 0) * 0.4;
  s += (fx.karmaDelta ?? 0) * 0.5;
  s += (fx.fameDelta ?? 0) * 0.2;
  s += (fx.royalRespectDelta ?? 0) * 0.4;
  // Money matters in proportion to what you have: losing a month's pay is minor, losing everything isn't.
  const scale = Math.max(3_000, p.bankBalance * 0.15);
  s += Math.max(-12, Math.min(8, (fx.bankBalanceDelta ?? 0) / scale));
  if (fx.promote) s += 6;
  if (fx.salaryPct) s += fx.salaryPct * 0.3;
  if (fx.cureAll) s += 8;
  // Things a careful person avoids on a whim.
  if (fx.die) s -= 1000;
  if (fx.arrest) s -= 60;
  if (fx.kill) s -= 200;
  if (fx.exposeAffair) s -= 25;
  if (fx.loseJob) s -= 20;
  if (fx.stripRoyalty) s -= 40;
  if (fx.emigrate) s -= 12;
  if (fx.diseaseTrigger) s -= 15;
  if (fx.pregnancy) s -= 3;
  if (fx.endRelationship) s -= 6;
  for (const v of Object.values(fx.viceDelta ?? {})) s -= Math.max(0, v ?? 0) * 0.4;
  return s;
}

/** Expected value of an option: its success outcome, blended with its failure outcome. */
export function optionScore(p: PlayerState, opt: ChoiceOption): number {
  const win = effectsScore(p, opt.effects);
  if (!opt.chance) return win;
  const pr = Math.max(0.02, Math.min(0.98, opt.chance.p));
  return pr * win + (1 - pr) * effectsScore(p, opt.chance.failure);
}

/** Below this, an option is something a careful person wouldn't do just because it was the only one they could pay for. */
const WORTH_DOING = -15;

/**
 * Option indexes, best first, among those the player can afford. `pass` means the only
 * options within reach are reckless ones (e.g. a dine-and-dash when you can't pay the bill),
 * so the autopilot lets the moment go by instead.
 */
export function autoPlan(p: PlayerState, event: LifeEvent): { order: number[]; pass: boolean } {
  const all = event.options.map((o, i) => ({ i, afford: canAfford(p, o), score: optionScore(p, o) }));
  const order = all.filter((o) => o.afford).sort((a, b) => b.score - a.score || a.i - b.i);
  const pass = order.length < all.length && (order.length === 0 || order[0].score < WORTH_DOING);
  return { order: order.map((o) => o.i), pass };
}

export const autoChoices = (p: PlayerState, event: LifeEvent): number[] => autoPlan(p, event).order;
