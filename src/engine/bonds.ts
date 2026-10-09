/**
 * What gives a relationship a past and a character: shared memories, unresolved grievances that come
 * back to bite, and the two things each person needs (their values), which decide how well you fit.
 * Pure helpers: nothing here rolls dice unless handed an rng.
 */
import type { Grievance, GrievanceKind, Memory, MemoryKind, PlayerState, Relative } from "@/types/game.types";
import { clamp } from "@/lib/format";
import { hash01 } from "./people";

const first = (r: Relative) => r.name.split(" ")[0];

// ---------------------------------------------------------------------------
// Memories
// ---------------------------------------------------------------------------

export const MAX_MEMORIES = 16;
/** Kinds that are never the first to be forgotten. */
const KEEPERS: MemoryKind[] = ["met", "milestone", "betrayal", "loss"];

export function remember(p: PlayerState, rel: Relative, kind: MemoryKind, text: string) {
  const list = (rel.memories = rel.memories ?? []);
  if (list.some((m) => m.year === p.year && m.text === text)) return;
  list.push({ year: p.year, age: p.age, kind, text });
  while (list.length > MAX_MEMORIES) {
    const i = list.findIndex((m) => !KEEPERS.includes(m.kind));
    list.splice(i >= 0 ? i : 0, 1);
  }
}

/** Marks when you met someone and files the first memory. Safe to call twice. */
export function introduce(p: PlayerState, rel: Relative, text?: string) {
  if (rel.metYear === undefined) rel.metYear = p.year;
  if (!rel.memories?.some((m) => m.kind === "met")) remember(p, rel, "met", text ?? `You met ${first(rel)}.`);
}

/** Years you've known someone, when it can be told (family are known from birth or marriage). */
export function yearsKnown(p: PlayerState, rel: Relative): number | null {
  if (rel.metYear !== undefined) return Math.max(0, p.year - rel.metYear);
  if (rel.relation === "Parent" || rel.relation === "Sibling" || rel.relation === "Grandparent") return p.age;
  if (rel.relation === "Child" || rel.relation === "Grandchild" || rel.relation === "Nephew") return rel.age;
  return null;
}

// ---------------------------------------------------------------------------
// Grievances
// ---------------------------------------------------------------------------

/** Adds (or deepens) an unresolved hurt. Repeating the same kind of hurt makes the existing one worse. */
export function addGrievance(p: PlayerState, rel: Relative, kind: GrievanceKind, weight: number, text: string): Grievance {
  const list = (rel.grievances = rel.grievances ?? []);
  const same = list.find((g) => g.kind === kind && g.text === text) ?? (kind === "betrayal" ? list.find((g) => g.kind === kind) : undefined);
  if (same) {
    same.weight = Math.min(3, same.weight + (weight >= same.weight ? 1 : 0));
    same.year = p.year;
    return same;
  }
  let n = 0;
  while (list.some((x) => x.id === `g${p.year}${kind[0]}${n}`)) n++;
  const g: Grievance = { id: `g${p.year}${kind[0]}${n}`, year: p.year, kind, weight: clamp(weight, 1, 3), text };
  list.push(g);
  return g;
}

export const grievanceLoad = (rel: Relative) => (rel.grievances ?? []).reduce((s, g) => s + g.weight, 0);

/** The one that hurts most (oldest breaks a tie). */
export function worstGrievance(rel: Relative): Grievance | undefined {
  return [...(rel.grievances ?? [])].sort((a, b) => b.weight - a.weight || a.year - b.year)[0];
}

/** Eases a grievance by `by` steps; it's gone at zero. Returns true if it was removed. */
export function soften(rel: Relative, id: string, by = 1): boolean {
  const g = rel.grievances?.find((x) => x.id === id);
  if (!g) return false;
  g.weight -= by;
  if (g.weight <= 0) {
    rel.grievances = rel.grievances!.filter((x) => x.id !== id);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Values and fit
// ---------------------------------------------------------------------------

export interface ValueDef {
  id: string;
  label: string;
  emoji: string;
  /** What it looks like when this need goes unmet. */
  lack: string;
  /** What meets it, for the UI. */
  hint: string;
}

export const VALUES: ValueDef[] = [
  { id: "affection", label: "Affection", emoji: "💞", lack: "feels taken for granted", hint: "Date nights, time together, love" },
  { id: "adventure", label: "Adventure", emoji: "🧭", lack: "is bored and restless", hint: "Getaways, trying new things" },
  { id: "security", label: "Security", emoji: "🏡", lack: "worries about where this is going", hint: "Planning the future, helping with money" },
  { id: "independence", label: "Space", emoji: "🕊️", lack: "feels smothered", hint: "Time apart, trust, not hovering" },
  { id: "ambition", label: "Drive", emoji: "🚀", lack: "feels their goals don't matter to you", hint: "Backing their goals" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧", lack: "wants more family life", hint: "Family weekends, in-laws, kids" },
];
export const VALUE_BY_ID: Record<string, ValueDef> = Object.fromEntries(VALUES.map((v) => [v.id, v]));

const TRAIT_VALUES: Record<string, string[]> = {
  Loyal: ["security", "family"],
  Adventurous: ["adventure"],
  Jealous: ["affection"],
  Romantic: ["affection"],
  Ambitious: ["ambition"],
  Easygoing: ["independence"],
  Wild: ["adventure", "independence"],
  Reserved: ["independence", "security"],
  Kind: ["family", "affection"],
  "Hot-tempered": ["ambition", "independence"],
};

/** The two things this person needs. Follows their personality; stable for the life of the relationship. */
export function valuesOf(rel: Relative): [string, string] {
  if (rel.values && rel.values.length >= 2) return [rel.values[0], rel.values[1]];
  const picks: string[] = [];
  for (const t of rel.traits ?? []) for (const v of TRAIT_VALUES[t] ?? []) if (!picks.includes(v)) picks.push(v);
  let i = 0;
  while (picks.length < 2) {
    const v = VALUES[Math.floor(hash01(`${rel.id}:v${i++}`) * VALUES.length)].id;
    if (!picks.includes(v)) picks.push(v);
  }
  return [picks[0], picks[1]];
}

/** What matters to you, from your hidden gifts. */
export function myValues(p: PlayerState): [string, string] {
  const t = p.talents;
  const score: Record<string, number> = {
    affection: (t.romance + t.empathy) / 2,
    adventure: (t.courage + t.athletic) / 2,
    security: (t.moneySense + t.discipline) / 2,
    independence: (t.resilience + t.cunning) / 2,
    ambition: (t.leadership + t.business) / 2,
    family: (t.empathy + t.fertility) / 2,
  };
  const ranked = VALUES.map((v) => ({ id: v.id, s: score[v.id] + hash01(`${p.id}:${v.id}`) * 8 })).sort((a, b) => b.s - a.s);
  return [ranked[0].id, ranked[1].id];
}

const CLASH: [string, string][] = [["adventure", "security"], ["independence", "affection"], ["independence", "family"]];

export interface Fit {
  score: number;
  label: "Natural fit" | "Workable" | "Opposites";
  shared: string[];
  clashes: number;
}

/** How well your two sets of needs sit together (0-100). */
export function compatibility(p: PlayerState, rel: Relative): Fit {
  const mine = myValues(p);
  const theirs = valuesOf(rel);
  const shared = mine.filter((v) => theirs.includes(v));
  let clashes = 0;
  for (const m of mine) for (const t of theirs) if (CLASH.some(([a, b]) => (a === m && b === t) || (a === t && b === m))) clashes++;
  const openness = 1 - Math.abs((rel.openness ?? 40) - (p.intimacy.interests.length * 12 + 20)) / 120;
  const score = clamp(Math.round(48 + shared.length * 20 - clashes * 14 + openness * 12));
  return { score, label: score >= 66 ? "Natural fit" : score >= 42 ? "Workable" : "Opposites", shared, clashes };
}

/** Learn one of their needs. Returns the value learned, or undefined if you know them both. */
export function learnValue(rel: Relative): ValueDef | undefined {
  const known = (rel.knownValues = rel.knownValues ?? []);
  const next = valuesOf(rel).find((v) => !known.includes(v));
  if (!next) return undefined;
  known.push(next);
  return VALUE_BY_ID[next];
}

/** Record that something you did met one of their needs this year. */
export function meet(p: PlayerState, rel: Relative, ...values: string[]) {
  for (const v of values) p.annual[`need:${rel.id}:${v}`] = 1;
}

export const needMet = (annual: Record<string, number>, rel: Relative, v: string) => !!annual[`need:${rel.id}:${v}`];

// ---------------------------------------------------------------------------
// How the relationship is going
// ---------------------------------------------------------------------------

export interface Health {
  score: number;
  label: "Thriving" | "Steady" | "Strained" | "On the rocks";
  tone: "green" | "blue" | "amber" | "red";
}

export function relationshipHealth(p: PlayerState, rel: Relative): Health {
  const fit = compatibility(p, rel);
  const years = Math.min(10, yearsKnown(p, rel) ?? 0);
  const score = Math.round(rel.relationshipBar * 0.65 + (fit.score - 50) * 0.25 + years * 0.8 - grievanceLoad(rel) * 7 - (rel.separatedYear ? 15 : 0));
  if (score >= 72) return { score, label: "Thriving", tone: "green" };
  if (score >= 50) return { score, label: "Steady", tone: "blue" };
  if (score >= 30) return { score, label: "Strained", tone: "amber" };
  return { score, label: "On the rocks", tone: "red" };
}

/** Short timeline lines for the UI, newest last. */
export function timeline(rel: Relative, n = 8): Memory[] {
  return (rel.memories ?? []).slice(-n);
}
