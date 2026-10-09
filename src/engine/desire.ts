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
import { declines, encounter, fill, gate, isAdult, isOpen, recordCheating } from "./intimacy";
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
  const no = declines(rel);
  if (no) return { player: p0, notices: [info("Not Tonight", `${firstName(rel)} ${no}. You respected that.`)] };
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

// ---------------------------------------------------------------------------
// Planning an evening together: choose each step, read their reaction, adjust.
// ---------------------------------------------------------------------------

export interface SceneChoice {
  id: string;
  label: string;
  emoji: string;
  /** Interest the player must have opted into. */
  tag: string;
  cost: number;
}

export const SCENE_SETTINGS: SceneChoice[] = [
  { id: "home", label: "Home, candles lit", emoji: "🏠", tag: "sensual", cost: 20 },
  { id: "hotel", label: "A hotel night away", emoji: "🏨", tag: "sensual", cost: 220 },
  { id: "bath", label: "Bubbles and a long bath", emoji: "🛁", tag: "sensual", cost: 30 },
  { id: "outdoors", label: "Somewhere with a thrill", emoji: "🌃", tag: "adventurous", cost: 0 },
];

export const SCENE_MOODS: SceneChoice[] = [
  { id: "tender", label: "Slow and tender", emoji: "🕯️", tag: "sensual", cost: 0 },
  { id: "playful", label: "Playful and teasing", emoji: "🎭", tag: "playful", cost: 0 },
  { id: "bold", label: "Bold and daring", emoji: "🔥", tag: "adventurous", cost: 0 },
  { id: "control", label: "Rules and trust", emoji: "🪢", tag: "kink", cost: 60 },
];

export const SCENE_EXTRAS: SceneChoice[] = [
  { id: "none", label: "Just the two of you", emoji: "💞", tag: "sensual", cost: 0 },
  { id: "roleplay", label: "Characters and costumes", emoji: "🎭", tag: "playful", cost: 100 },
  { id: "toys", label: "A little help from the boutique", emoji: "🎀", tag: "toys", cost: 120 },
  { id: "photos", label: "A private photo or two", emoji: "📸", tag: "photo", cost: 0 },
  { id: "call", label: "Tease by message first", emoji: "💬", tag: "digital", cost: 0 },
];

export const SCENE_CAP = 3;

export type SceneStep = "setting" | "mood" | "extra";

export interface Reaction {
  /** What they do when you suggest it. */
  text: string;
  /** "yes" they're keen, "maybe" willing, "no" a limit: you can't proceed with this. */
  verdict: "yes" | "maybe" | "no";
}

/** Their immediate reaction to a suggestion. Reading it is how you learn what they like. */
export function sceneReaction(rel: Relative, choice: SceneChoice): Reaction {
  const n = firstName(rel);
  if (choice.id === "none") return { verdict: "yes", text: `${n} smiles. "Just us sounds perfect."` };
  const taste = tasteOf(rel, choice.tag);
  if (taste === "limit") return { verdict: "no", text: `${n} gently shakes their head. "Not that one. Anything else?"` };
  if (taste === "like") return { verdict: "yes", text: `${n}'s eyes light up. "Oh, yes. Please."` };
  return { verdict: "maybe", text: `${n} thinks for a second, then shrugs with a grin. "Why not? If the mood's right."` };
}

export interface ScenePlan {
  setting: string;
  mood: string;
  extra: string;
  /** Pause to ask how they're doing and what they want. */
  checkIn: boolean;
  /** Finish with cuddling and an honest chat. */
  aftercare: boolean;
}

const pick = <T extends { id: string }>(list: T[], id: string) => list.find((x) => x.id === id);

export function playScene(p0: PlayerState, relId: string, plan: ScenePlan, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const rel = findPartnerLike(p, relId);
  if (!rel || !isAdult(rel)) return { player: p0 };
  const no = declines(rel);
  if (no) return { player: p0, notices: [info("Not Tonight", `${firstName(rel)} ${no}. You respected that.`)] };
  const setting = pick(SCENE_SETTINGS, plan.setting);
  const mood = pick(SCENE_MOODS, plan.mood);
  const extra = pick(SCENE_EXTRAS, plan.extra) ?? SCENE_EXTRAS[0];
  if (!setting || !mood) return { player: p0 };
  const chosen = [setting, mood, extra];
  for (const c of chosen) {
    if (!p.intimacy.interests.includes(c.tag)) return { player: p0, notices: [info("Not On Your List", `Add “${INTEREST_BY_ID[c.tag].label}” to your interests first.`)] };
    if (tasteOf(rel, c.tag) === "limit") return { player: p0, notices: [info("A Limit", `${firstName(rel)} already said no to part of that plan, and a no stays a no.`)] };
  }
  const key = `scene:${rel.id}`;
  if ((p.annual[key] ?? 0) >= SCENE_CAP) return { player: p0, notices: [info("Pace Yourselves", "You've planned plenty of evenings together this year.")] };
  const cost = chosen.reduce((s, c) => s + c.cost, 0);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `That plan costs ${money(cost)}.`, "bad")] };
  const needBar = Math.max(...chosen.map((c) => (c.tag === "kink" ? 55 : c.tag === "photo" || c.tag === "adventurous" ? 40 : 20)));
  if (rel.relationshipBar < needBar) return { player: p0, notices: [info("Not There Yet", `${firstName(rel)} would want a stronger bond first (relationship ${needBar}+).`)] };

  p.annual[key] = (p.annual[key] ?? 0) + 1;
  p.bankBalance -= cost;
  const n = firstName(rel);
  const notices: Notices = [];
  // How well it goes: shared tastes, trust, and paying attention to them.
  const likes = chosen.filter((c) => tasteOf(rel, c.tag) === "like").length;
  const quality = clamp(0.35 + likes * 0.14 + rel.relationshipBar / 250 + (plan.checkIn ? 0.12 : 0) + (rng.next() - 0.5) * 0.3, 0, 1.2);
  rel.encounters = (rel.encounters ?? 0) + 1;
  encounter(p, rel, protectedSex, rng, notices, rel.relation === "Partner" ? 0.004 : 0.1);
  for (const c of chosen) if (c.id !== "none" && !knows(rel, c.tag)) rel.knownTastes = [...(rel.knownTastes ?? []), c.tag];
  for (const c of chosen) if (tasteOf(rel, c.tag) === "like") learn(rel, c.tag, "like");

  let title: string;
  let line: string;
  let gain: number;
  if (quality >= 0.95) {
    title = "An Unforgettable Evening";
    line = `${setting.label.toLowerCase()}, ${mood.label.toLowerCase()}: you read each other perfectly. ${n} said it was the best night in a long time.`;
    gain = rng.int(12, 18);
  } else if (quality >= 0.6) {
    title = "A Lovely Evening";
    line = `${setting.label}, ${mood.label.toLowerCase()}. It started a little hesitantly and ended with both of you glowing.`;
    gain = rng.int(7, 12);
  } else {
    title = "Awkward, But Fun";
    line = `${setting.label}. The mood wasn't quite right and some things fell flat, but you laughed about it afterwards.`;
    gain = rng.int(2, 6);
  }
  if (plan.checkIn) line += ` You paused to ask how ${n} was feeling, and it made all the difference.`;
  rel.relationshipBar = clamp(rel.relationshipBar + gain);
  changeStat(p, "happiness", Math.round(gain / 2));
  if (plan.aftercare) {
    rel.relationshipBar = clamp(rel.relationshipBar + 3);
    line += " Afterwards you stayed up talking and laughing, wrapped in a blanket.";
  }
  if (setting.id === "outdoors" && rng.chance(0.1)) {
    p.bankBalance = Math.max(0, p.bankBalance - 200);
    line += " A passing patrol interrupted you and issued a fine. You'll tell that story for years.";
  }
  if (rel.relation === "Lover" && rel.partnerStatus === "affair") recordCheating(p, rng, notices, 0.06);
  addLog(p, `${title}: ${line}`);
  return { player: p, notices: [info(title, line, quality >= 0.6 ? "good" : "neutral"), ...notices] };
}
