/** Hidden natural gifts and tendencies (0-100, 50 = typical). Never shown in play; editable at character design. */
export interface TalentDef {
  key: string;
  label: string;
  emoji: string;
  group: "Body" | "Mind" | "People" | "Craft" | "Temperament";
  /** Shown in the designer, deliberately vague about numbers. */
  low: string;
  high: string;
}

export const TALENTS = [
  { key: "athletic", label: "Athletic gift", emoji: "🏃", group: "Body", low: "clumsy", high: "born athlete" },
  { key: "stamina", label: "Stamina", emoji: "🔋", group: "Body", low: "tires fast", high: "tireless" },
  { key: "injuryProne", label: "Tendency to injury", emoji: "🩹", group: "Body", low: "sturdy", high: "injury-prone" },
  { key: "longevity", label: "Constitution", emoji: "🧬", group: "Body", low: "frail genes", high: "long-lived genes" },
  { key: "graceful", label: "Ageing well", emoji: "🌿", group: "Body", low: "ages quickly", high: "ages gracefully" },
  { key: "fertility", label: "Fertility", emoji: "🍼", group: "Body", low: "struggles", high: "very fertile" },
  { key: "learner", label: "Quick learner", emoji: "📖", group: "Mind", low: "slow to grasp", high: "picks things up fast" },
  { key: "moneySense", label: "Money sense", emoji: "🪙", group: "Mind", low: "spendthrift", high: "shrewd with money" },
  { key: "cunning", label: "Cunning", emoji: "🦊", group: "Mind", low: "transparent", high: "sly" },
  { key: "business", label: "Business sense", emoji: "💼", group: "Mind", low: "no head for it", high: "natural entrepreneur" },
  { key: "charisma", label: "Charm", emoji: "✨", group: "People", low: "awkward", high: "magnetic" },
  { key: "speaking", label: "Public speaking", emoji: "🎤", group: "People", low: "freezes up", high: "commands a room" },
  { key: "empathy", label: "Empathy", emoji: "🫂", group: "People", low: "tone-deaf", high: "deeply attuned" },
  { key: "leadership", label: "Leadership", emoji: "🧭", group: "People", low: "follower", high: "natural leader" },
  { key: "romance", label: "Romantic charm", emoji: "💘", group: "People", low: "hopeless", high: "smooth" },
  { key: "musical", label: "Musical ear", emoji: "🎵", group: "Craft", low: "tone-deaf", high: "perfect pitch" },
  { key: "acting", label: "Stage presence", emoji: "🎭", group: "Craft", low: "wooden", high: "captivating" },
  { key: "creativity", label: "Creativity", emoji: "🎨", group: "Craft", low: "literal", high: "endlessly inventive" },
  { key: "discipline", label: "Willpower", emoji: "🧱", group: "Temperament", low: "easily tempted", high: "iron will" },
  { key: "addictive", label: "Addictive personality", emoji: "🎲", group: "Temperament", low: "unhookable", high: "gets hooked easily" },
  { key: "resilience", label: "Resilience", emoji: "🛡️", group: "Temperament", low: "fragile", high: "bounces back" },
  { key: "temper", label: "Temper", emoji: "🌋", group: "Temperament", low: "placid", high: "hot-headed" },
  { key: "courage", label: "Courage", emoji: "🦁", group: "Temperament", low: "timid", high: "fearless" },
  { key: "luck", label: "Luck", emoji: "🍀", group: "Temperament", low: "jinxed", high: "charmed" },
] as const satisfies readonly TalentDef[];

export type TalentKey = (typeof TALENTS)[number]["key"];
export const TALENT_KEYS = TALENTS.map((t) => t.key) as TalentKey[];
