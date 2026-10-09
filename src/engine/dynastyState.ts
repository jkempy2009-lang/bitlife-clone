/**
 * Dynasty state factory and save migration. Deliberately free of engine imports so that state.ts, save.ts and
 * legacy.ts can use it without import cycles.
 */
import type { DynastyState, PlayerState } from "@/types/game.types";

export const newDynasty = (name: string, founded: number): DynastyState => ({
  name,
  founded,
  chronicle: [],
  clout: {},
  trust: null,
  will: { plan: "equal", chosenId: null },
  peakFortune: 0,
});

/** Fill in the dynasty for saves made before families were tracked. */
export function hydrateDynasty(p: Pick<PlayerState, "lastName" | "birthYear"> & { dynasty?: Partial<DynastyState> }): DynastyState {
  const base = newDynasty(p.lastName, p.birthYear);
  const d = p.dynasty ?? {};
  return {
    ...base,
    ...d,
    chronicle: Array.isArray(d.chronicle) ? d.chronicle : [],
    clout: d.clout ?? {},
    trust: d.trust ?? null,
    will: { ...base.will, ...(d.will ?? {}) },
  };
}
