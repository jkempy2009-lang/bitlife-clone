/**
 * Choice and depth in adult relationships: dating preferences, what you share with a partner or
 * lover, and learning what they enjoy. Only for adults (18+), only with willing adults; everything
 * a person isn't comfortable with is simply declined. Text is suggestive and fades to black.
 */
import type { ActionResult, IntimacyPrefs, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { EXPERIENCE_BY_ID, INTERESTS, INTEREST_BY_ID } from "@/data/experiences";
import { addLog, changeStat, clone } from "./state";
import { encounter, fill, gate, isAdult, isOpen, recordCheating } from "./intimacy";
import { firstName } from "./social";
import { MAX_PREF_AGE, MIN_ADULT_AGE, knows, tasteOf } from "./people";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

const GENDERS = ["Male", "Female", "Non-binary"];

/** Updates dating preferences, clamped so everyone you meet is an adult. */
export function setIntimacyPrefs(p0: PlayerState, patch: Partial<IntimacyPrefs>): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0 };
  const cur = p.intimacy;
  const next: IntimacyPrefs = { ...cur, ...patch };
  next.ageMin = clamp(Math.round(next.ageMin), MIN_ADULT_AGE, MAX_PREF_AGE);
  next.ageMax = clamp(Math.round(next.ageMax), next.ageMin, MAX_PREF_AGE);
  next.genders = (next.genders ?? []).filter((g) => GENDERS.includes(g));
  next.interests = (next.interests ?? []).filter((i) => i in INTEREST_BY_ID);
  p.intimacy = next;
  return { player: p };
}

export function toggleInterest(p: PlayerState, id: string): ActionResult {
  const has = p.intimacy.interests.includes(id);
  return setIntimacyPrefs(p, { interests: has ? p.intimacy.interests.filter((i) => i !== id) : [...p.intimacy.interests, id] });
}

export function toggleGender(p: PlayerState, gender: string): ActionResult {
  const has = p.intimacy.genders.includes(gender);
  return setIntimacyPrefs(p, { genders: has ? p.intimacy.genders.filter((g) => g !== gender) : [...p.intimacy.genders, gender] });
}

function findPartnerLike(p: PlayerState, relId: string): Relative | undefined {
  return p.relatives.find((r) => r.id === relId && r.alive && (r.relation === "Partner" || r.relation === "Lover") && r.partnerStatus !== "ex");
}

function learn(rel: Relative, tag: string, taste: "like" | "limit") {
  rel.tastes = { ...(rel.tastes ?? {}), [tag]: taste };
  if (!rel.knownTastes) rel.knownTastes = [];
  if (!rel.knownTastes.includes(tag)) rel.knownTastes.push(tag);
}

/** Talk openly about what you each enjoy and where your limits are. Reveals one thing about them. */
export function discussDesires(p0: PlayerState, relId: string): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const rel = findPartnerLike(p, relId);
  if (!rel || !isAdult(rel)) return { player: p0 };
  if ((p.annual[`talk:${rel.id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Talked", "You've had that conversation this year. Give it time.")] };
  if (rel.relationshipBar < 20) return { player: p0, notices: [info("Not Close Enough", `${firstName(rel)} isn't ready to open up to you yet.`)] };
  p.annual[`talk:${rel.id}`] = 1;
  const n = firstName(rel);
  const unknown = INTERESTS.filter((i) => !knows(rel, i.id));
  rel.relationshipBar = clamp(rel.relationshipBar + 4);
  changeStat(p, "happiness", 2);
  if (unknown.length === 0) {
    const body = `You and ${n} talked for hours. There was nothing left to discover, only each other.`;
    addLog(p, body);
    return { player: p, notices: [info("Honest Talk", body, "good")] };
  }
  // Prefer an interesting reveal: something they feel strongly about.
  const strong = unknown.filter((i) => tasteOf(rel, i.id));
  const pick = (strong.length ? strong : unknown)[Math.floor(((rel.openness ?? 40) * 7 + p.year) % (strong.length ? strong.length : unknown.length))];
  const taste = tasteOf(rel, pick.id);
  let body: string;
  if (taste === "like") {
    learn(rel, pick.id, "like");
    body = `${n} admitted, a little shyly, that they're really into "${pick.label.toLowerCase()}". You've filed that away.`;
  } else if (taste === "limit") {
    learn(rel, pick.id, "limit");
    body = `${n} told you "${pick.label.toLowerCase()}" isn't something they're comfortable with. You thanked them for being honest, and meant it.`;
  } else {
    rel.knownTastes = [...(rel.knownTastes ?? []), pick.id];
    body = `You asked ${n} about "${pick.label.toLowerCase()}". They shrugged: "Maybe, if the mood is right." Good to know.`;
  }
  addLog(p, body);
  return { player: p, notices: [info("Honest Talk", body, "good")] };
}

/** Try something together. Needs your own opt-in, their willingness, and trust. */
export function shareExperience(p0: PlayerState, relId: string, expId: string, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const exp = EXPERIENCE_BY_ID[expId];
  const rel = findPartnerLike(p, relId);
  if (!exp || !rel || !isAdult(rel)) return { player: p0 };
  if (exp.partnerOnly && rel.relation !== "Partner") return { player: p0, notices: [info("Not Casual", "That needs the trust of a real relationship.")] };
  if (!p.intimacy.interests.includes(exp.tag)) return { player: p0, notices: [info("Not On Your List", `Add "${INTEREST_BY_ID[exp.tag].label}" to your interests (Preferences) first.`)] };
  if (rel.relationshipBar < exp.minBar) return { player: p0, notices: [info("Not There Yet", `${firstName(rel)} would want a stronger bond first (relationship ${exp.minBar}+).`)] };
  const key = `exp:${exp.id}:${rel.id}`;
  if ((p.annual[key] ?? 0) >= exp.cap) return { player: p0, notices: [info("Pace Yourselves", "You've enjoyed that plenty this year.")] };
  if (p.bankBalance < exp.cost) return { player: p0, notices: [info("Insufficient Funds", `That costs ${money(exp.cost)}.`, "bad")] };
  p.annual[key] = (p.annual[key] ?? 0) + 1;
  p.bankBalance -= exp.cost;
  const n = firstName(rel);
  const taste = tasteOf(rel, exp.tag);
  const notices: Notices = [];
  const cheating = rel.relation === "Lover" && rel.partnerStatus === "affair";

  if (taste === "limit") {
    // A hard limit: they say no, kindly or otherwise. Nothing happens beyond a bruised mood.
    learn(rel, exp.tag, "limit");
    rel.relationshipBar = clamp(rel.relationshipBar - 2);
    const body = `${n} gently but firmly said no to that. It's a limit, and you respected it. You found something else to do with the evening.`;
    addLog(p, body);
    return { player: p, notices: [info("Not For Them", body, "neutral")] };
  }
  const bonus = taste === "like" ? 0.35 : 0;
  const chance = clamp(0.3 + (rel.openness ?? 40) / 140 + rel.relationshipBar / 300 + bonus + (p.skills.charisma - 30) / 600, 0.1, 0.96);
  if (!rng.chance(chance)) {
    rel.relationshipBar = clamp(rel.relationshipBar - 4);
    changeStat(p, "happiness", -2);
    const body = `${n} wasn't in the mood for that tonight. You laughed it off and ordered food.`;
    addLog(p, body);
    return { player: p, notices: [info("Not Tonight", body, "neutral")] };
  }
  if (exp.intimate) encounter(p, rel, protectedSex, rng, notices, rel.relation === "Partner" ? 0.004 : 0.1);
  else {
    rel.encounters = rel.encounters ?? 0;
    changeStat(p, "happiness", rng.int(3, 6));
  }
  const gain = taste === "like" ? rng.int(10, 16) : rng.int(5, 10);
  rel.relationshipBar = clamp(rel.relationshipBar + gain);
  if (taste === "like") learn(rel, exp.tag, "like");
  else if (!knows(rel, exp.tag)) {
    rel.knownTastes = [...(rel.knownTastes ?? []), exp.tag];
  }
  let body = fill(rng.pick(exp.lines), n);
  if (taste === "like") body += ` ${n} clearly adored it.`;
  addLog(p, body);
  p.stats.hookups += rel.relation === "Lover" ? 1 : 0;
  notices.unshift(info(exp.label, body, "good"));
  if (exp.risk && rng.chance(exp.risk.chance)) {
    if (exp.risk.money) p.bankBalance = Math.max(0, p.bankBalance + exp.risk.money);
    changeStat(p, "happiness", exp.risk.happiness ?? 0);
    changeStat(p, "fame", exp.risk.fame ?? 0);
    addLog(p, exp.risk.body);
    notices.push(info(exp.risk.title, exp.risk.body, "bad"));
  }
  if (cheating) recordCheating(p, rng, notices, 0.06);
  return { player: p, notices };
}

/** What the player knows about someone's tastes, for the UI. */
export function knownTastes(rel: Relative): { tag: string; taste: "like" | "limit" | "open" }[] {
  return (rel.knownTastes ?? []).map((tag) => ({ tag, taste: tasteOf(rel, tag) ?? "open" }));
}

export const isOpenRelationship = isOpen;
