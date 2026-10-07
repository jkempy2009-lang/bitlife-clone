import { TALENT_KEYS } from "@/data/talents";

/** Typical (50) for every hidden gift, so seeded tests don't depend on random talents. */
export const NEUTRAL = Object.fromEntries(TALENT_KEYS.map((k) => [k, 50])) as Record<(typeof TALENT_KEYS)[number], number>;
