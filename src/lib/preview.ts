import type { ChoiceEffects, ChoiceOption } from "@/data/lifeEventsEngine";

export interface OptionPreview {
  /** Certain up-front cost in dollars (0 if free). */
  cost: number;
  /** How likely the good branch is, when the outcome is a gamble. */
  odds: "likely" | "toss-up" | "long shot" | null;
  /** Short warnings about serious consequences, without giving the outcome away. */
  warnings: string[];
}

const serious = (fx: ChoiceEffects, out: Set<string>) => {
  if (fx.die) out.add("☠️ Could be fatal");
  if (fx.arrest || fx.kill) out.add("⚖️ Legal risk");
  if (fx.loseJob) out.add("💼 Job at risk");
  if (fx.endRelationship) out.add("💔 Could end a relationship");
  if (fx.emigrate) out.add("✈️ Moves you abroad");
  if (fx.pregnancy) out.add("🍼 Could lead to a baby");
};

/** What the player can fairly be told about a choice before making it. Pure and cheap. */
export function previewOption(opt: ChoiceOption): OptionPreview {
  const warnings = new Set<string>();
  serious(opt.effects, warnings);
  if (opt.chance) serious(opt.chance.failure, warnings);
  const cost = Math.max(0, -(opt.effects.bankBalanceDelta ?? 0));
  const p = opt.chance?.p;
  const odds = p === undefined ? null : p >= 0.7 ? "likely" : p >= 0.4 ? "toss-up" : "long shot";
  return { cost, odds, warnings: [...warnings] };
}
