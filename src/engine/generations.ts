/**
 * Generational continuity: what a child inherits beyond money.
 *
 * `continueAsChild` (legacy.ts) builds the heir from fresh defaults; `applyFamilyLegacy` then layers on
 * everything that depends on how the parent lived: upbringing, wealth, profession, reputation, traits,
 * family flags that colour later events, and the relatives (the parent who is gone, the one who remains,
 * the grandparents, the siblings who share the estate).
 */
import type { PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, isRoyal, netWorth } from "./state";

export type Upbringing = "nurtured" | "neglected" | "ordinary";
export type Wealth = "wealthy" | "modest" | "poor";

export interface FamilyProfile {
  upbringing: Upbringing;
  wealth: Wealth;
  /** 0..100: how the family name is regarded. */
  reputation: number;
  reputationLabel: string;
  /** Share of the parent's fame that rubs off, 0..1. */
  famePct: number;
  /** Family flags to set on the heir (see `FAMILY_FLAGS`). */
  flags: string[];
  /** Plain-English professions that shaped the household. */
  household: string[];
}

/** Every flag this module can set, documented for event authors. */
export const FAMILY_FLAGS = [
  "gen_heir", // you are an heir (generation 2+)
  "raised_wealthy", "raised_poor",
  "family_scandal", "family_prison", "family_killer", "family_crime",
  "family_famous", "family_royal",
  "family_legacy_business", "family_political", "family_athletic", "family_artistic",
  "family_military", "family_academic",
  "family_divorced",
  "parent_close", "parent_neglect",
  "raised_by_grandparents",
  "raised_private_school", "raised_troubled",
] as const;

export const TRAIT_FX: Record<string, { smarts?: number; karma?: number; happiness?: number; athletics?: number; charisma?: number; health?: number }> = {
  Ambitious: { smarts: 2 },
  Kind: { karma: 4 },
  Easygoing: { happiness: 4 },
  "Hot-tempered": { karma: -3 },
  Adventurous: { athletics: 5 },
  Wild: { karma: -2, happiness: 2 },
  Romantic: { happiness: 1 },
  Reserved: { charisma: -3 },
  Loyal: { karma: 2 },
  Jealous: { happiness: -2 },
};

export const traitFlag = (trait: string) => `trait_${trait.toLowerCase().replaceAll("-", "_")}`;

const isLine = (p: PlayerState, ...ids: string[]) => !!p.currentJob && ids.includes(p.currentJob.lineId);

export function upbringingOf(old: PlayerState, child: Relative): Upbringing {
  const bar = child.relationshipBar;
  const ground = old.effort === "grind";
  if (bar < 40 || (ground && bar < 65)) return "neglected";
  if (bar >= 75 && !ground) return "nurtured";
  return "ordinary";
}

export function wealthOf(old: PlayerState, child: Relative): Wealth {
  const nw = netWorth(old);
  if (nw >= 1_000_000 || (child.incomeTier >= 5 && nw >= 250_000)) return "wealthy";
  if (nw < 25_000 || (child.incomeTier <= 1 && nw < 100_000)) return "poor";
  return "modest";
}

export function reputationOf(old: PlayerState): number {
  const crimes = old.stats.crimesCommitted + old.criminalRecord.length * 0.5;
  const base =
    50 +
    (old.karma - 50) * 0.6 +
    Math.min(25, old.fame * 0.3) -
    Math.min(30, crimes * 5) -
    (old.stats.kills > 0 || old.flags.includes("killer") ? 25 : 0) -
    Math.min(15, old.stats.yearsInPrison * 3);
  return clamp(Math.round(base));
}

export function reputationLabel(rep: number): string {
  if (rep >= 75) return "revered";
  if (rep >= 60) return "respected";
  if (rep >= 40) return "unremarkable";
  if (rep >= 25) return "tarnished";
  return "notorious";
}

export function familyProfile(old: PlayerState, child: Relative): FamilyProfile {
  const upbringing = upbringingOf(old, child);
  const wealth = wealthOf(old, child);
  const reputation = reputationOf(old);
  const flags: string[] = ["gen_heir"];
  const household: string[] = [];
  const add = (flag: string, label?: string) => {
    flags.push(flag);
    if (label) household.push(label);
  };

  if (wealth === "wealthy") add("raised_wealthy");
  if (wealth === "poor") add("raised_poor");
  if (upbringing === "nurtured") add("parent_close");
  if (upbringing === "neglected") add("parent_neglect");

  const killer = old.stats.kills > 0 || old.flags.includes("killer");
  if (reputation < 35 || killer || old.stats.crimesCommitted >= 3 || old.stats.yearsInPrison >= 2) add("family_scandal");
  if (old.stats.yearsInPrison > 0 || old.flags.includes("ex_con") || old.isInPrison) add("family_prison");
  if (killer) add("family_killer");
  if (isLine(old, "mafia") || old.criminalRecord.length >= 2) add("family_crime", "crime");
  if (old.fame >= 40) add("family_famous", "fame");
  if (isRoyal(old)) add("family_royal", "royalty");
  if (old.business || old.flags.includes("business_owner")) add("family_legacy_business", "a family business");
  if (isLine(old, "politics") || old.politics.yearsInOffice > 0 || old.politics.popularity >= 60) add("family_political", "politics");
  if (old.flags.includes("athlete") || old.athlete.sport || isLine(old, "athlete") || old.skills.athletics >= 55) add("family_athletic", "sport");
  if (old.specialCareers.length > 0 || old.music.albums.length > 0 || old.skills.music >= 40 || old.skills.acting >= 40) add("family_artistic", "the arts");
  if (old.flags.includes("veteran") || isLine(old, "military")) add("family_military", "the services");
  if (isLine(old, "professor", "science", "doctor", "teacher", "psychology") || old.education.degrees.some((d) => ["masters", "md", "jd"].includes(d))) add("family_academic", "study");
  if (old.flags.includes("was_divorced")) add("family_divorced");

  const famePct = isRoyal(old) ? 0.5 : reputation >= 60 ? 0.45 : 0.3;
  return { upbringing, wealth, reputation, reputationLabel: reputationLabel(reputation), famePct, flags, household };
}

/** Rough personality of a parent we only know from how they lived. */
export function parentTraits(old: PlayerState): string[] {
  const t: string[] = [];
  if (old.karma >= 70) t.push("Kind");
  else if (old.karma < 30) t.push("Hot-tempered");
  if (old.effort === "grind" || old.stats.highestCareerTier >= 4) t.push("Ambitious");
  if (old.flags.includes("cheater") || old.flags.includes("swinger")) t.push("Wild");
  if (old.flags.includes("athlete") || old.flags.includes("veteran")) t.push("Adventurous");
  if (old.flags.includes("faithful")) t.push("Loyal");
  if (t.length < 2 && old.happiness >= 70) t.push("Easygoing");
  if (t.length < 2) t.push("Reserved");
  return t.slice(0, 2);
}

/**
 * Heir traits: the child's own temperament, bent by how they were raised and by the parent who stays.
 * Deterministic for a given rng state.
 */
export function deriveHeirTraits(child: Relative, upbringing: Upbringing, survivingParent: Relative | undefined, rng: Rng): string[] {
  const own = child.traits ?? [];
  const out: string[] = [];
  const push = (t: string | undefined) => {
    if (t && !out.includes(t)) out.push(t);
  };
  push(own[0]);
  if (upbringing === "nurtured") push("Kind");
  else if (upbringing === "neglected") push(rng.pick(["Reserved", "Hot-tempered", "Ambitious"]));
  push(survivingParent?.traits?.[0]);
  push(own[1]);
  return out.slice(0, 3);
}

export interface HeirStats {
  smarts: number;
  looks: number;
  health: number;
  happiness: number;
  karma: number;
  fame: number;
  skills: PlayerState["skills"];
}

export function deriveHeirStats(old: PlayerState, child: Relative, profile: FamilyProfile, traits: string[], rng: Rng): HeirStats {
  const has = (f: string) => profile.flags.includes(f);
  let smarts = child.smarts;
  smarts += profile.upbringing === "nurtured" ? 3 : profile.upbringing === "neglected" ? -3 : 0;
  smarts += profile.wealth === "wealthy" ? 2 : profile.wealth === "poor" ? -2 : 0;
  smarts += has("family_academic") ? 3 : 0;
  smarts += old.smarts >= 75 ? 2 : 0;
  const looks = child.looks + (profile.wealth === "wealthy" ? 2 : 0) + (has("family_famous") ? 2 : 0);
  let health = Math.max(60, child.health) + (has("family_athletic") ? 3 : 0) + (has("family_military") ? 2 : 0);
  const grief = child.relationshipBar >= 60 ? 6 : 2;
  let happiness = 70 + (profile.upbringing === "nurtured" ? 6 : profile.upbringing === "neglected" ? -8 : 0) - grief;
  let karma = 50 + Math.round((old.karma - 50) * 0.2) + (has("family_scandal") ? -6 : 0);

  const skills = { acting: 0, music: 0, charisma: rng.int(0, 10), athletics: rng.int(0, 20) };
  if (has("family_athletic")) skills.athletics = Math.max(skills.athletics, Math.round(20 + old.skills.athletics * 0.4));
  if (has("family_artistic")) {
    skills.music = Math.max(skills.music, Math.round(10 + old.skills.music * 0.35));
    skills.acting = Math.max(skills.acting, Math.round(10 + old.skills.acting * 0.35));
  }
  if (has("family_political") || has("family_famous")) skills.charisma = Math.max(skills.charisma, Math.round(15 + old.skills.charisma * 0.4));
  if (has("family_military")) skills.athletics = Math.max(skills.athletics, 25);
  if (profile.upbringing === "nurtured") skills.charisma += 4;

  // What the parent invested in the child while raising them (parenting: kid.school / kid.interest / kid.trouble).
  if (child.school === "private") {
    smarts += 3;
    skills.charisma += 3;
  }
  if (child.interest === "sport") skills.athletics += 12;
  else if (child.interest === "music") skills.music += 12;
  else if (child.interest === "art") skills.acting += 8;
  else if (child.interest === "science") smarts += 4;
  if ((child.trouble ?? 0) >= 3) {
    karma -= 4;
    happiness -= 2;
  }

  for (const t of traits) {
    const fx = TRAIT_FX[t];
    if (!fx) continue;
    smarts += fx.smarts ?? 0;
    karma += fx.karma ?? 0;
    happiness += fx.happiness ?? 0;
    health += fx.health ?? 0;
    skills.athletics += fx.athletics ?? 0;
    skills.charisma += fx.charisma ?? 0;
  }
  return {
    smarts: clamp(Math.round(smarts)),
    looks: clamp(Math.round(looks)),
    health: clamp(Math.round(health)),
    happiness: clamp(Math.round(happiness)),
    karma: clamp(Math.round(karma)),
    fame: clamp(Math.round(old.fame * profile.famePct)),
    skills: {
      acting: clamp(skills.acting),
      music: clamp(skills.music),
      charisma: clamp(skills.charisma),
      athletics: clamp(skills.athletics),
    },
  };
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Layers family continuity onto a freshly built heir. Call once, after the heir's base state exists.
 * Mutates `next` in place.
 */
export function applyFamilyLegacy(next: PlayerState, old: PlayerState, child: Relative, rng: Rng) {
  const profile = familyProfile(old, child);
  const year = next.year;
  const parents = next.relatives.filter((r) => r.relation === "Parent");
  const lateParent = parents.find((r) => !r.alive);
  const surviving = parents.find((r) => r.alive);
  const siblings = next.relatives.filter((r) => r.relation === "Sibling" && r.alive);
  const grandparents = next.relatives.filter((r) => r.relation === "Grandparent" && r.alive);

  // Personality and stats
  const traits = deriveHeirTraits(child, profile.upbringing, surviving, rng);
  const stats = deriveHeirStats(old, child, profile, traits, rng);
  next.smarts = stats.smarts;
  next.looks = stats.looks;
  next.health = stats.health;
  next.happiness = stats.happiness;
  next.karma = stats.karma;
  next.fame = stats.fame;
  next.skills = stats.skills;

  // Flags: family circumstances, plus personality as trait_* flags (royal_born etc. are kept).
  const orphanedYoung = !surviving && next.age < 18;
  const flags = [...profile.flags, ...traits.map(traitFlag)];
  if (orphanedYoung && grandparents.length > 0) flags.push("raised_by_grandparents");
  if (child.school === "private") flags.push("raised_private_school");
  if ((child.trouble ?? 0) >= 3) flags.push("raised_troubled");
  for (const f of flags) if (!next.flags.includes(f)) next.flags.push(f);

  // The parent who is gone: carry over who they actually were.
  if (lateParent) {
    lateParent.smarts = old.smarts;
    lateParent.looks = old.looks;
    lateParent.traits = parentTraits(old);
    lateParent.relationshipBar = clamp(child.relationshipBar);
    lateParent.incomeTier = profile.wealth === "wealthy" ? 5 : profile.wealth === "poor" ? 1 : 3;
  }
  // The parent who stays: grieving, and shaped by how the household ran.
  if (surviving) {
    surviving.relationshipBar = clamp(profile.upbringing === "nurtured" ? Math.max(70, surviving.relationshipBar) : profile.upbringing === "neglected" ? Math.min(45, surviving.relationshipBar) : surviving.relationshipBar);
    if (!surviving.traits?.includes("Grieving")) surviving.traits = [...(surviving.traits ?? []).slice(0, 2), "Grieving"];
  }
  // Grandparents are closer to the grandchild when there is no parent left.
  for (const g of grandparents) g.relationshipBar = clamp(Math.round(g.relationshipBar * 0.6 + 25 + (surviving ? 0 : 12)));
  // Siblings: grief and an inheritance can pull a family together or apart.
  for (const s of siblings) s.relationshipBar = clamp(rng.int(50, 80) + (profile.upbringing === "neglected" ? -10 : 0));

  // Opening beats: the memorial now, the will and the letter soon.
  next.queuedEvents.push("legacy_memorial");
  if (siblings.length > 0 && next.bankBalance > 5_000) next.scheduled.push({ id: "estate_heir_will", dueYear: year + 1 });
  next.scheduled.push({ id: "legacy_letter_note", dueYear: year + Math.max(1, 12 - next.age) });

  // Intro notice for the new generation.
  const name = `${old.firstName} ${old.lastName}`;
  addLog(next, `Generation ${next.generation}: you are the child of ${name} (${old.birthYear}–${old.deathYear ?? old.year}). The family name is ${profile.reputationLabel}.`);
  const upb =
    profile.upbringing === "nurtured" ? "You were raised with warmth and attention"
    : profile.upbringing === "neglected" ? `${name.split(" ")[0]} was always working, and you learned to look after yourself`
    : "Your upbringing was ordinary and mostly happy";
  const wealthLine = profile.wealth === "wealthy" ? "in comfort" : profile.wealth === "poor" ? "on very little" : "comfortably enough";
  addLog(next, `${upb}, ${wealthLine}.${profile.household.length ? ` The household was shaped by ${profile.household.slice(0, 3).join(", ")}.` : ""}`);
  if (traits.length) addLog(next, `You take after your family: ${traits.map(lower).join(", ")}.`);
  if (next.fame > 0) addLog(next, `You inherit about ${Math.round(profile.famePct * 100)}% of ${old.firstName}'s fame.`);
  if (profile.flags.includes("family_scandal")) addLog(next, `The family name carries a scandal. Not everyone has forgotten.`);
  if (surviving) addLog(next, `${surviving.name.split(" ")[0]} is still with you, but grief has changed the house.`);
  else if (grandparents.length > 0) addLog(next, `With no parent left, your grandparents have taken you in.`);
  if (siblings.length > 0) addLog(next, `You share the estate with ${siblings.length} ${siblings.length === 1 ? "sibling" : "siblings"}. ${money(next.bankBalance)} is in your name.`);
}
