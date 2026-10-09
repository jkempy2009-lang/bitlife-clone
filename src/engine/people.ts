/**
 * Who you meet: dating preferences, candidate generation for adults, and the hidden tastes people
 * have. Everyone generated here is an adult (18+).
 */
import type { PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { INTEREST_BY_ID } from "@/data/experiences";
import { clamp } from "@/lib/format";
import { partnerGenderFor, randomName } from "./state";

export const MIN_ADULT_AGE = 18;
export const MAX_PREF_AGE = 99;

/** The age window of people you're open to meeting. Never below 18. */
export function adultRange(p: PlayerState): [number, number] {
  const prefs = p.intimacy;
  if (prefs.ageAuto) {
    return [Math.max(MIN_ADULT_AGE, p.age - 8), Math.max(MIN_ADULT_AGE + 4, Math.min(MAX_PREF_AGE, p.age + 10))];
  }
  const lo = clamp(Math.round(prefs.ageMin), MIN_ADULT_AGE, MAX_PREF_AGE);
  const hi = clamp(Math.round(prefs.ageMax), lo, MAX_PREF_AGE);
  return [lo, hi];
}

/** A gender from your preferences, or by sexuality if you haven't set any. */
export function candidateGender(p: PlayerState, rng: Rng): string {
  const g = p.intimacy.genders;
  if (g.length > 0) return rng.pick(g);
  return partnerGenderFor(p, rng);
}

/** Picks an adult age inside your range, leaning toward your own age. */
export function sampleAge(p: PlayerState, rng: Rng, shift = 0): number {
  const [lo, hi] = adultRange(p);
  if (rng.chance(0.3)) return rng.int(lo, hi);
  const centre = clamp(p.age + shift, lo, hi);
  const spread = Math.max(2, Math.round((hi - lo) / 4));
  return clamp(Math.round(centre + (rng.next() + rng.next() - 1) * spread * 1.6), lo, hi);
}

/** Deterministic 0-1 hash so tastes never need storing or re-rolling. */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * What this person feels about an interest: they like it, it's a hard limit, or they're open to being
 * asked. Driven by their openness and jealousy, scaled by how adventurous the interest is.
 */
export function tasteOf(rel: Relative, tag: string): "like" | "limit" | undefined {
  if (rel.tastes?.[tag]) return rel.tastes[tag];
  const intensity = INTEREST_BY_ID[tag]?.intensity ?? 0.5;
  const open = (rel.openness ?? 40) / 100;
  const jealous = (rel.jealousy ?? 50) / 100;
  const pLike = clamp(0.12 + open * 0.55 * (1.15 - intensity * 0.45), 0.05, 0.85);
  const pLimit = clamp((0.45 - open * 0.45 + jealous * 0.08) * intensity, 0, 0.7);
  const u = hash01(`${rel.id}:${tag}`);
  if (u < pLike) return "like";
  if (u > 1 - pLimit) return "limit";
  return undefined;
}

export const knows = (rel: Relative, tag: string) => !!rel.knownTastes?.includes(tag);

/** An adult candidate that respects the player's preferences. Caller sets relation/status. */
export function adultSpec(p: PlayerState, rng: Rng, shift = 0): { gender: string; ageRange: [number, number]; age: number } {
  const age = sampleAge(p, rng, shift);
  return { gender: candidateGender(p, rng), ageRange: [age, age], age };
}

/**
 * A first name nobody in your life already has, so "Anna" always means one person. Re-rolls a few
 * times and only gives up (accepting a repeat) in a small name pool.
 */
export function freshFirstName(p: PlayerState, gender: string, rng: Rng, country = p.residence.country): string {
  const used = new Set(p.relatives.map((r) => r.name.split(" ")[0]));
  used.add(p.firstName);
  let first = randomName(country, gender, rng).first;
  for (let i = 0; i < 8 && used.has(first); i++) first = randomName(country, gender, rng).first;
  return first;
}
