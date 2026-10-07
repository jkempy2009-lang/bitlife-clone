import type {
  ChoiceEffects,
  ChoiceOption,
  EventCategory,
  LifeEvent,
} from "./lifeEventsEngine";

type Extra = Partial<
  Pick<LifeEvent, "weight" | "once" | "cooldown" | "requires" | "prisonOnly" | "mature" | "arc" | "scheduledOnly" | "force">
>;

/** Effects helper: `fx("log text", { happinessDelta: 5 })`. */
export const fx = (logText: string, rest: Omit<ChoiceEffects, "logText"> = {}): ChoiceEffects => ({
  ...rest,
  logText,
});

/** Guaranteed-outcome option. */
export const opt = (
  text: string,
  logText: string,
  rest: Omit<ChoiceEffects, "logText"> = {},
): ChoiceOption => ({ text, effects: fx(logText, rest) });

/** Risky option: succeeds with probability p, otherwise the failure branch applies. */
export const risk = (
  text: string,
  p: number,
  win: [string, Omit<ChoiceEffects, "logText">?],
  lose: [string, Omit<ChoiceEffects, "logText">?],
  scaleBy?: "smarts" | "looks" | "health" | "happiness",
): ChoiceOption => ({
  text,
  effects: fx(win[0], win[1] ?? {}),
  chance: { p, scaleBy, failure: fx(lose[0], lose[1] ?? {}) },
});

export const ev = (
  id: string,
  category: EventCategory,
  minAge: number,
  maxAge: number,
  title: string,
  description: string,
  options: ChoiceOption[],
  extra: Extra = {},
): LifeEvent => ({ id, title, description, minAge, maxAge, category, options, ...extra });
