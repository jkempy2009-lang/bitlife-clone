import type { PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { DISEASE_BY_ID, instantiateDisease } from "@/data/diseases";
import { addLog } from "./state";

/** Kept apart from events.ts so health and school code can diagnose people without pulling in the whole event catalogue. */
export function addDisease(p: PlayerState, id: string, rng: Rng): boolean {
  const t = DISEASE_BY_ID[id];
  if (!t || p.diseases.some((d) => d.id === id)) return false;
  p.diseases.push(instantiateDisease(t, (a, b) => rng.int(a, b)));
  if (["chlamydia", "herpes", "hiv"].includes(id) && !p.flags.includes("had_sti")) p.flags.push("had_sti");
  addLog(p, `You were diagnosed with ${t.name}.`);
  return true;
}
