/**
 * Recurring supporting cast for storylines. Names are derived deterministically from the player's id,
 * so {rival} is the same person in every beat (and after a save/load) without storing anything.
 */
import { getCountry } from "@/data/countries";
import { hashString } from "@/lib/rng";
import type { PlayerState, Relative } from "@/types/game.types";

export const NPC_ROLES = [
  "rival", "mentor", "lender", "neighbour", "tempter", "journalist", "fosterkid", "cousin",
  "boss", "doctor", "organizer", "broker", "colleague", "caseworker", "ally",
] as const;
export type NpcRole = (typeof NPC_ROLES)[number];

export function npcName(p: PlayerState, role: string): { first: string; last: string } {
  const c = getCountry(p.birthCountry);
  const h = hashString(`${p.id}:${role}`);
  const pool = h % 2 === 0 ? c.maleNames : c.femaleNames;
  let first = pool[(h >>> 1) % pool.length];
  if (first === p.firstName) first = pool[((h >>> 1) + 3) % pool.length];
  const last = c.lastNames[(h >>> 9) % c.lastNames.length];
  return { first, last };
}

/** Most recently deceased parent, if any (for "{lateparent}"). */
export function lateParent(p: PlayerState): Relative | undefined {
  return [...p.relatives].filter((r) => r.relation === "Parent" && !r.alive).sort((a, b) => (b.deathYear ?? 0) - (a.deathYear ?? 0))[0];
}

/** Replaces {rival}, {rival_first}, {lateparent}, ... Unknown tokens are left alone. */
export function fillNpcTokens(text: string, p: PlayerState): string {
  if (!text.includes("{")) return text;
  let out = text;
  for (const role of NPC_ROLES) {
    if (!out.includes(`{${role}`)) continue;
    const n = npcName(p, role);
    out = out.replaceAll(`{${role}_first}`, n.first).replaceAll(`{${role}}`, `${n.first} ${n.last}`);
  }
  if (out.includes("{parent}")) {
    const eldest = p.relatives.filter((r) => r.relation === "Parent" && r.alive).sort((a, b) => b.age - a.age)[0];
    out = out.replaceAll("{parent}", eldest ? eldest.name.split(" ")[0] : "your parent");
  }
  if (out.includes("{lateparent")) {
    const lp = lateParent(p);
    out = out.replaceAll("{lateparent}", lp ? lp.name.split(" ")[0] : "your late parent");
  }
  return out;
}
