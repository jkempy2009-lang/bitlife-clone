/**
 * Adult relationships: intimacy, open relationships, threesomes, hookups, affairs and their fallout.
 * Everything here is gated behind the player's "mature content" setting and requires every
 * person involved to be an adult and a willing participant. Text is suggestive, never explicit.
 */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone, getPartner } from "./state";
import { createRelative, endRelationship, firstName } from "./social";
import { addDisease } from "./events";
import { startTrial } from "./crime";
import { makeRelativeBase, randomGender, randomName } from "./state";
import { adultSpec, tasteOf } from "./people";
import { royalStyleForChild } from "./royalty";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const isAdult = (r: Relative) => r.age >= 18;

/** Open or polyamorous: your partner knows and agrees about other people. */
export const isOpen = (p: PlayerState) => p.flags.includes("open_relationship") || p.flags.includes("polyamorous");

export function gate(p: PlayerState): ActionResult | null {
  if (!p.matureContent) {
    return { player: p, notices: [info("Mature Content Off", "Turn on mature content in Settings to access adult options.")] };
  }
  if (p.age < 18) return { player: p, notices: [info("Not for You", "Those options are only for adults.")] };
  if (p.isInPrison) return { player: p, notices: [info("Behind Bars", "No privacy in the cell block.")] };
  return null;
}

const LOVE_LINES = [
  "You and {n} skipped dessert and headed straight for the bedroom.",
  "The candles burned low. What happened next stays between you two.",
  "{n} pulled you close and the evening got steamy.",
  "A long, slow night with {n}. You didn't check your phone once.",
  "You and {n} rediscovered each other. The neighbours may have heard.",
  "Things escalated quickly with {n}. You weren't complaining.",
];
const SPICE_LINES = [
  "You surprised {n} with a little something from the boutique. They loved it.",
  "Costume night with {n} went far better than either of you expected.",
  "You tried something new with {n}. There was laughter, then not much talking.",
];
const FLING_LINES = [
  "You went home together. No names were exchanged (well, one).",
  "A spark, a taxi ride, and a very good night.",
  "It was brief, passionate, and entirely without regret. Mostly.",
  "You didn't plan on staying the night, but here you are.",
];

export const fill = (line: string, name: string) => line.replace("{n}", name);

function canConceive(p: PlayerState, other: Relative): boolean {
  const a = p.gender;
  const b = other.gender;
  if (a === b && a !== "Non-binary") return false;
  return true;
}

/** Who carries a pregnancy: "self" or the other person's id. */
function carrierFor(p: PlayerState, other: Relative, rng: Rng): string {
  if (p.gender === "Female") return "self";
  if (other.gender === "Female") return other.id;
  return rng.chance(0.5) ? "self" : other.id;
}

function maybeConceive(p: PlayerState, other: Relative, protectedSex: boolean, rng: Rng, notices: Notices) {
  if (p.pregnancy || !canConceive(p, other)) return;
  const carrierId = carrierFor(p, other, rng);
  const carrierAge = carrierId === "self" ? p.age : other.age;
  if (carrierAge < 18 || carrierAge > 44) return;
  if (!rng.chance((protectedSex ? 0.02 : 0.14) * (0.6 + (p.talents.fertility / 100) * 0.8))) return;
  p.pregnancy = { carrier: carrierId, other: other.name };
  const who = carrierId === "self" ? "You're" : `${firstName(other)} is`;
  addLog(p, `${who} expecting a baby!`);
  notices.push(info("Positive Test!", `${who} pregnant. A baby is due by next year.`, "neutral"));
}

export function maybeInfect(p: PlayerState, protectedSex: boolean, risk: number, rng: Rng, notices: Notices) {
  if (!rng.chance(protectedSex ? risk * 0.1 : risk)) return;
  const id = rng.weighted(["chlamydia", "herpes", "hiv"], (d) => (d === "chlamydia" ? 0.6 : d === "herpes" ? 0.3 : 0.1))!;
  if (addDisease(p, id, rng)) {
    notices.push(info("Health Scare", `You tested positive for ${id === "hiv" ? "HIV" : id}. Protection matters, and so does honesty with partners.`, "bad"));
  }
}

/** The party you wronged finds out. */
export function exposeAffair(p: PlayerState, rng: Rng, notices: Notices) {
  const partner = getPartner(p);
  if (!partner) return;
  const jealousy = partner.jealousy ?? 50;
  const married = partner.partnerStatus === "married";
  changeStat(p, "karma", -8);
  for (const r of p.relatives) if (r.alive && r.relation === "Child") r.relationshipBar = clamp(r.relationshipBar - 8);
  if (rng.chance(clamp(0.25 + jealousy / 150, 0.1, 0.9))) {
    const name = partner.name;
    endRelationship(p, married ? "divorce" : "breakup", true);
    p.flags = p.flags.filter((f) => f !== "open_relationship");
    changeStat(p, "happiness", -12);
    const body = `${name} found out about the affair and ended things${married ? " in divorce court" : ""}.`;
    addLog(p, body);
    notices.push(info("Caught!", body, "bad"));
  } else {
    partner.relationshipBar = clamp(partner.relationshipBar - 25);
    changeStat(p, "happiness", -8);
    const body = `${partner.name} found out and was devastated, but chose to stay (for now). Trust is shattered.`;
    addLog(p, body);
    notices.push(info("Caught!", body, "bad"));
  }
}

export function recordCheating(p: PlayerState, rng: Rng, notices: Notices, immediateRisk: number): boolean {
  const partner = getPartner(p);
  if (!partner || isOpen(p)) return false;
  p.stats.affairs += 1;
  if (!p.flags.includes("cheater")) p.flags.push("cheater");
  changeStat(p, "karma", -5);
  if (rng.chance(immediateRisk)) {
    exposeAffair(p, rng, notices);
    return true;
  }
  return false;
}

/** Common intimate-encounter outcome. */
export function encounter(p: PlayerState, other: Relative, protectedSex: boolean, rng: Rng, notices: Notices, stiRisk: number) {
  other.encounters = (other.encounters ?? 0) + 1;
  p.annual[`love:${other.id}`] = (p.annual[`love:${other.id}`] ?? 0) + 1;
  changeStat(p, "happiness", rng.int(3, 7));
  changeStat(p, "health", 1);
  maybeConceive(p, other, protectedSex, rng, notices);
  maybeInfect(p, protectedSex, stiRisk, rng, notices);
}

// ---------------------------------------------------------------------------
// Partners and lovers
// ---------------------------------------------------------------------------

export const LOVE_CAP = 6;

export function makeLove(p0: PlayerState, relId: string, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const other = p.relatives.find((r) => r.id === relId && r.alive && (r.relation === "Partner" || r.relation === "Lover") && r.partnerStatus !== "ex");
  if (!other) return { player: p0 };
  if (!isAdult(other)) return { player: p0 };
  if ((p.annual[`love:${other.id}`] ?? 0) >= LOVE_CAP) {
    return { player: p0, notices: [info("Pace Yourselves", `You and ${firstName(other)} have been busy enough this year.`)] };
  }
  const notices: Notices = [];
  const n = firstName(other);
  const body = fill(rng.pick(LOVE_LINES), n);
  const affair = other.relation === "Lover" && other.partnerStatus === "affair";
  encounter(p, other, protectedSex, rng, notices, other.relation === "Partner" ? 0.004 : 0.12);
  other.relationshipBar = clamp(other.relationshipBar + rng.int(4, 10));
  addLog(p, body);
  if (affair) recordCheating(p, rng, notices, 0.06);
  return { player: p, notices: [info("Intimate Night", body + (protectedSex ? "" : " (Unprotected.)"), "good"), ...notices] };
}

export const SPICE_COST = 150;

export function spiceItUp(p0: PlayerState, relId: string, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const other = p.relatives.find((r) => r.id === relId && r.alive && r.relation === "Partner" && r.partnerStatus !== "ex");
  if (!other || !isAdult(other)) return { player: p0 };
  if (p.bankBalance < SPICE_COST) return { player: p0, notices: [info("Insufficient Funds", `The shopping trip costs ${money(SPICE_COST)}.`, "bad")] };
  if ((p.annual[`spice:${other.id}`] ?? 0) >= 2) return { player: p0, notices: [info("Pace Yourselves", "You've explored plenty this year.")] };
  p.annual[`spice:${other.id}`] = (p.annual[`spice:${other.id}`] ?? 0) + 1;
  p.bankBalance -= SPICE_COST;
  const n = firstName(other);
  if (rng.chance(clamp(0.35 + (other.openness ?? 40) / 120, 0.2, 0.9))) {
    other.relationshipBar = clamp(other.relationshipBar + rng.int(8, 14));
    changeStat(p, "happiness", rng.int(4, 8));
    const body = fill(rng.pick(SPICE_LINES), n);
    addLog(p, body);
    return { player: p, notices: [info("Spicing Things Up", body, "good")] };
  }
  other.relationshipBar = clamp(other.relationshipBar - 5);
  const body = `${n} wasn't into your idea and things got a bit awkward. You both laughed about it later (sort of).`;
  addLog(p, body);
  return { player: p, notices: [info("Awkward", body, "bad")] };
}

export const GETAWAY_COST = 1_200;

export function romanticGetaway(p0: PlayerState, relId: string): ActionResult {
  const p = clone(p0);
  const other = p.relatives.find((r) => r.id === relId && r.alive && r.relation === "Partner" && r.partnerStatus !== "ex");
  if (!other) return { player: p0 };
  if (p.bankBalance < GETAWAY_COST) return { player: p0, notices: [info("Insufficient Funds", `A getaway costs ${money(GETAWAY_COST)}.`, "bad")] };
  if ((p.annual.getaway ?? 0) >= 1) return { player: p0, notices: [info("Home Again", "You've already had your getaway this year.")] };
  p.annual.getaway = 1;
  p.bankBalance -= GETAWAY_COST;
  other.relationshipBar = clamp(other.relationshipBar + 15);
  changeStat(p, "happiness", 7);
  const body = `You whisked ${firstName(other)} away for a romantic weekend. Room service, sunsets, and no alarm clocks.`;
  addLog(p, body);
  return { player: p, notices: [info("Romantic Getaway", body, "good")] };
}

export type RelationshipStyle = "open" | "poly";

export function proposeOpenRelationship(p0: PlayerState, rng: Rng, style: RelationshipStyle = "open"): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner || !isAdult(partner)) return { player: p0 };
  const flag = style === "poly" ? "polyamorous" : "open_relationship";
  if (p.flags.includes(flag)) return { player: p0, notices: [info("Already Agreed", style === "poly" ? "You two already practise polyamory." : "You two already have an open relationship.")] };
  if ((p.annual.openask ?? 0) >= 1) return { player: p0, notices: [info("Give It Time", "You've already raised this once this year.")] };
  p.annual.openask = 1;
  const tag = style === "poly" ? "open" : "group";
  void tag;
  const hardness = style === "poly" ? 0.7 : 1;
  const chance = clamp(((partner.openness ?? 40) / 100 - (partner.jealousy ?? 50) / 200 + partner.relationshipBar / 300) * hardness, 0.04, 0.85);
  const n = firstName(partner);
  if (rng.chance(chance)) {
    p.flags.push(flag);
    partner.relationshipBar = clamp(partner.relationshipBar + 4);
    const body =
      style === "poly"
        ? `After several honest conversations, ${n} agreed to try polyamory: more than one loving relationship, everyone informed and consenting. Ground rules, schedules and a shared calendar were involved.`
        : `After a long, honest conversation, ${n} agreed to open up your relationship. Ground rules were set.`;
    addLog(p, body);
    return { player: p, notices: [info(style === "poly" ? "Polyamory" : "Open Relationship", body, "good")] };
  }
  partner.relationshipBar = clamp(partner.relationshipBar - 12);
  changeStat(p, "happiness", -3);
  const body = `${n} wasn't comfortable with that and told you so, loudly.`;
  addLog(p, body);
  const notices: Notices = [info("Hard No", body, "bad")];
  if ((partner.jealousy ?? 50) > 70 && rng.chance(0.25)) {
    endRelationship(p, partner.partnerStatus === "married" ? "divorce" : "breakup");
    notices.push(info("It's Over", `${n} ended the relationship over it.`, "bad"));
  }
  return { player: p, notices };
}

/** Return to a monogamous relationship (your partner is told, and has feelings about it). */
export function closeRelationship(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.flags.includes("open_relationship") && !p.flags.includes("polyamorous")) return { player: p0 };
  p.flags = p.flags.filter((f) => f !== "open_relationship" && f !== "polyamorous");
  const partner = getPartner(p);
  if (partner) partner.relationshipBar = clamp(partner.relationshipBar + 3);
  for (const l of p.relatives) if (l.relation === "Lover" && l.partnerStatus !== "ex" && l.alive) l.partnerStatus = "ex";
  const body = "You agreed to be exclusive again. Any other connections were ended kindly.";
  addLog(p, body);
  return { player: p, notices: [info("Exclusive Again", body, "neutral")] };
}

export function askThreesome(p0: PlayerState, protectedSex: boolean, rng: Rng, guestGender?: string): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner || !isAdult(partner)) return { player: p0 };
  if (!p.intimacy.interests.includes("group")) return { player: p0, notices: [info("Not On Your List", "Add \"More Than Two\" to your interests (Preferences) before raising it.")] };
  if ((p.annual.threesome ?? 0) >= 1) return { player: p0, notices: [info("Maybe Next Year", "You've already had that conversation this year.")] };
  p.annual.threesome = 1;
  const open = isOpen(p);
  const taste = tasteOf(partner, "group");
  const chance = taste === "limit" ? 0.02 : clamp(0.08 + (partner.openness ?? 40) / 120 + partner.relationshipBar / 400 - (partner.jealousy ?? 50) / 250 + (open ? 0.25 : 0) + (taste === "like" ? 0.35 : 0), 0.03, 0.92);
  const n = firstName(partner);
  if (!rng.chance(chance)) {
    partner.relationshipBar = clamp(partner.relationshipBar - 10);
    changeStat(p, "happiness", -3);
    const body = `You floated the idea of a threesome. ${n} said no, firmly, and the conversation got awkward.`;
    addLog(p, body);
    return { player: p, notices: [info("Not Interested", body, "bad")] };
  }
  if (!p.flags.includes("threesome")) p.flags.push("threesome");
  const notices: Notices = [];
  const ad = adultSpec(p, rng);
  const guest = createRelative(p, { relation: "Partner", ageOffset: [-5, 7], partnerStatus: "dating", gender: guestGender ?? ad.gender, ageRange: ad.ageRange }, rng);
  guest.age = Math.max(18, guest.age);
  const g = guest.name.split(" ")[0];
  p.stats.hookups += 1;
  changeStat(p, "happiness", rng.int(7, 12));
  changeStat(p, "health", 1);
  maybeInfect(p, protectedSex, 0.05, rng, notices);
  const jealous = (partner.jealousy ?? 50) > 70 && rng.chance(0.4);
  if (jealous) {
    partner.relationshipBar = clamp(partner.relationshipBar - 10);
  } else {
    partner.relationshipBar = clamp(partner.relationshipBar + 6);
  }
  const body = `${n} said yes. With ${g} joining you, the three of you had a night nobody will ever mention at brunch.${jealous ? ` Afterwards, ${n} admitted feeling a bit jealous.` : " You both agreed it was fun."}`;
  addLog(p, body);
  return { player: p, notices: [info("Three's Company", body, "good"), ...notices] };
}

export const SWINGER_COST = 400;

export function swingerClub(p0: PlayerState, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const partner = getPartner(p);
  if (partner && !isOpen(p)) {
    return { player: p0, notices: [info("Not Without Consent", "Your partner needs to be on board (open relationship) first.")] };
  }
  if (p.bankBalance < SWINGER_COST) return { player: p0, notices: [info("Insufficient Funds", `Entry and drinks cost ${money(SWINGER_COST)}.`, "bad")] };
  if ((p.annual.swinger ?? 0) >= 2) return { player: p0, notices: [info("Take a Breather", "You've been to the club plenty this year.")] };
  if (!p.flags.includes("swinger")) p.flags.push("swinger");
  p.annual.swinger = (p.annual.swinger ?? 0) + 1;
  p.bankBalance -= SWINGER_COST;
  p.stats.hookups += 1;
  const notices: Notices = [];
  changeStat(p, "happiness", rng.int(5, 10));
  maybeInfect(p, protectedSex, 0.08, rng, notices);
  if (partner) partner.relationshipBar = clamp(partner.relationshipBar + (rng.chance(0.7) ? 4 : -4));
  const body = partner
    ? "You and your partner spent a night at an adults-only club. The rules were clear and everyone respected them."
    : "You spent a wild night at an adults-only club, no strings attached.";
  addLog(p, body);
  return { player: p, notices: [info("Club Night", body, "good"), ...notices] };
}

// ---------------------------------------------------------------------------
// Hookups, flings, affairs
// ---------------------------------------------------------------------------

export type Venue = "bar" | "app" | "party" | "gym" | "singles" | "club" | "social" | "retreat" | "scene";
export type Intent = "casual" | "relationship";

interface VenueDef {
  id: Venue;
  label: string;
  emoji: string;
  cost: number;
  blurb: string;
  /** Shifts the typical age of people you meet there. */
  ageShift: number;
  chanceBonus: number;
  /** Interest tag you must have opted into. */
  requires?: string;
}

export const VENUES: VenueDef[] = [
  { id: "bar", label: "At the Bar", emoji: "🍸", cost: 100, blurb: "Low lights, loud music, short conversations.", ageShift: 0, chanceBonus: 0 },
  { id: "app", label: "Dating App", emoji: "📱", cost: 20, blurb: "Swipe on your own terms and filters.", ageShift: 0, chanceBonus: 0.1 },
  { id: "party", label: "House Party", emoji: "🎉", cost: 50, blurb: "Friends of friends and good music.", ageShift: -3, chanceBonus: 0 },
  { id: "gym", label: "The Gym", emoji: "🏋️", cost: 0, blurb: "Shared spotting and sweaty small talk.", ageShift: -2, chanceBonus: 0 },
  { id: "singles", label: "Singles Mixer", emoji: "🥂", cost: 60, blurb: "Name tags and clear intentions. Older crowd.", ageShift: 8, chanceBonus: 0.08 },
  { id: "club", label: "Nightclub", emoji: "🪩", cost: 80, blurb: "Loud, young and fast.", ageShift: -5, chanceBonus: 0.03 },
  { id: "social", label: "Hobby Club", emoji: "🎨", cost: 40, blurb: "Slow to start, but you meet real people.", ageShift: 2, chanceBonus: -0.1 },
  { id: "retreat", label: "Adults-Only Resort", emoji: "🏝️", cost: 900, blurb: "Everyone is there to unwind and meet someone.", ageShift: 3, chanceBonus: 0.15 },
  { id: "scene", label: "Lifestyle Event", emoji: "🔥", cost: 120, blurb: "An adults-only evening for people with open minds. Needs the \"More Than Two\" or \"Power Play\" interest.", ageShift: 4, chanceBonus: 0.12, requires: "group" },
];

function newLover(p: PlayerState, rng: Rng, status: "fling" | "affair", shift = 0): Relative {
  const ad = adultSpec(p, rng, shift);
  const base = createRelative(p, { relation: "Partner", ageOffset: [-6, 8], partnerStatus: "dating", gender: ad.gender, ageRange: ad.ageRange }, rng);
  base.age = Math.max(18, base.age);
  base.relation = "Lover";
  base.partnerStatus = status;
  base.relationshipBar = rng.int(35, 65);
  return base;
}

export function hookUp(p0: PlayerState, venue: Venue, protectedSex: boolean, rng: Rng, intent: Intent = "casual"): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const def = VENUES.find((v) => v.id === venue)!;
  if (def.requires && !p.intimacy.interests.includes(def.requires) && !p.intimacy.interests.includes("kink")) {
    return { player: p0, notices: [info("Not On Your List", "Add the matching interest in Preferences first.")] };
  }
  if (p.bankBalance < def.cost) return { player: p0, notices: [info("Insufficient Funds", `That costs ${money(def.cost)}.`, "bad")] };
  const cap = venue === "retreat" ? 1 : 2;
  if ((p.annual[`hookup:${venue}`] ?? 0) >= cap) return { player: p0, notices: [info("Out of Energy", "You've been out enough this way for one year.")] };
  p.annual[`hookup:${venue}`] = (p.annual[`hookup:${venue}`] ?? 0) + 1;
  p.bankBalance -= def.cost;
  const partner = getPartner(p);
  const open = isOpen(p);
  const cheating = !!partner && !open;
  const chance = clamp(0.35 + (p.looks - 50) / 200 + p.skills.charisma / 300 + def.chanceBonus - (intent === "relationship" ? 0.08 : 0), 0.1, 0.88);
  if (!rng.chance(chance)) {
    changeStat(p, "happiness", -2);
    const body = "You tried your luck, but nobody was biting tonight.";
    addLog(p, body);
    return { player: p, notices: [info("No Luck", body, "neutral")] };
  }
  const notices: Notices = [];
  // Looking for something real: someone single who wants the same.
  if (intent === "relationship" && !partner) {
    const ad = adultSpec(p, rng, def.ageShift);
    const match = createRelative(p, { relation: "Partner", ageOffset: [-6, 8], partnerStatus: "dating", gender: ad.gender, ageRange: ad.ageRange }, rng);
    match.age = Math.max(18, match.age);
    match.relationshipBar = rng.int(50, 72);
    p.relatives.push(match);
    changeStat(p, "happiness", 6);
    const body = `You met ${match.name} (${match.age}) and, for once, you both wanted the same thing. You're officially dating.`;
    addLog(p, body);
    return { player: p, notices: [info("A Real Connection", body, "good")] };
  }
  const stays = rng.chance(intent === "relationship" ? 0.7 : 0.4);
  const status = cheating || open ? "affair" : "fling";
  const lover = newLover(p, rng, status, def.ageShift);
  p.stats.hookups += 1;
  encounter(p, lover, protectedSex, rng, notices, 0.12);
  const line = rng.pick(FLING_LINES);
  addLog(p, `${line} (${lover.name}, ${lover.age})`);
  if (stays) p.relatives.push(lover);
  if (cheating) recordCheating(p, rng, notices, 0.1);
  const tail = stays ? ` You're keeping in touch with ${lover.name.split(" ")[0]}.` : "";
  return { player: p, notices: [info(cheating ? "Cheating..." : "Hookup", `${line}${tail}${cheating ? " Your partner doesn't know." : ""}`, cheating ? "bad" : "good"), ...notices] };
}

export type SeduceKind = "friend" | "coworker" | "ex" | "boss" | "employee" | "neighbour" | "classmate" | "trainer" | "client" | "fan";

export interface SeduceDef {
  id: SeduceKind;
  label: string;
  emoji: string;
  blurb: string;
  /** Null when this is possible right now, otherwise why not. */
  need: (p: PlayerState) => string | null;
  cost?: number;
}

const inCollege = (p: PlayerState) => p.age >= 18 && p.education.yearsLeft > 0 && !["None", "Primary", "HighSchool"].includes(p.education.stage);

export const SEDUCE_TARGETS: SeduceDef[] = [
  { id: "friend", label: "A Friend", emoji: "🤝", blurb: "The closer you are, the better the odds. A no can cool the friendship.", need: (p) => (p.relatives.some((r) => r.alive && r.relation === "Friend" && r.age >= 18 && r.partnerStatus !== "ex") ? null : "You don't have an adult friend who fits.") },
  { id: "ex", label: "An Ex", emoji: "💔", blurb: "Old habits. Even odds.", need: (p) => (p.relatives.some((r) => r.alive && r.relation === "Partner" && r.partnerStatus === "ex" && r.age >= 18) ? null : "You don't have an ex to call.") },
  { id: "coworker", label: "A Coworker", emoji: "💼", blurb: "Late nights at the office. Gossip travels.", need: (p) => (p.currentJob ? null : "You need a job for that.") },
  { id: "boss", label: "Your Boss", emoji: "👔", blurb: "Both adults, but the power gap is real. If it surfaces, HR gets involved.", need: (p) => (p.currentJob ? null : "You need a job for that.") },
  { id: "employee", label: "An Employee", emoji: "🧑‍💼", blurb: "You sign their pay cheque. They may not feel free to say no, and the fallout can be serious.", need: (p) => (p.business && p.business.staff > 0 ? null : "You need staff in your business.") },
  { id: "client", label: "A Client", emoji: "🤵", blurb: "Business and pleasure. Mixing them can cost you the account.", need: (p) => (p.currentJob || p.business ? null : "You need a job or a business.") },
  { id: "classmate", label: "A Classmate", emoji: "🎓", blurb: "Study sessions that run late.", need: (p) => (inCollege(p) ? null : "You need to be in college or university.") },
  { id: "trainer", label: "Your Trainer", emoji: "🏋️", blurb: "Sessions cost $90. Fit, focused, and paid by the hour.", need: (p) => (p.bankBalance >= 90 ? null : "You can't afford a session."), cost: 90 },
  { id: "neighbour", label: "A Neighbour", emoji: "🏘️", blurb: "Convenient. Awkward if it ends badly.", need: () => null },
  { id: "fan", label: "A Fan", emoji: "⭐", blurb: "Fame opens doors. Kiss-and-tell is the risk.", need: (p) => (p.fame >= 30 ? null : "You need more fame (30+).") },
];

interface GenSpec {
  age: (p: PlayerState, rng: Rng) => number;
  base: number;
  trait: string;
  win: (n: string) => string;
  lose: (n: string) => string;
}

const GEN: Partial<Record<SeduceKind, GenSpec>> = {
  coworker: { age: (p, r) => p.age + r.int(-8, 10), base: 0.4, trait: "Coworker", win: (n) => `Late nights at the office turned into something else with ${n}.`, lose: (n) => `${n} wasn't interested. Awkward.` },
  boss: { age: (p, r) => Math.max(26, p.age + r.int(0, 15)), base: 0.28, trait: "Your boss", win: (n) => `After a long project, ${n} said what you were both thinking. You agreed to keep it quiet.`, lose: (n) => `${n} gently said it wouldn't be appropriate. Professional, and a little awkward.` },
  employee: { age: (p, r) => p.age + r.int(-12, 3), base: 0.35, trait: "Your employee", win: (n) => `${n} said yes, but you'll never be sure how freely it was given.`, lose: (n) => `${n} politely declined and changed the subject. You both pretended it hadn't happened.` },
  client: { age: (p, r) => p.age + r.int(-8, 12), base: 0.3, trait: "Client", win: (n) => `A dinner to close the deal ended somewhere else with ${n}.`, lose: (n) => `${n} kept it strictly business. You kept the contract, just.` },
  classmate: { age: (p, r) => Math.max(18, p.age + r.int(-3, 5)), base: 0.45, trait: "Classmate", win: (n) => `Study sessions with ${n} stopped being about studying.`, lose: (n) => `${n} just wanted a study partner.` },
  trainer: { age: (p, r) => Math.max(21, p.age + r.int(-10, 5)), base: 0.3, trait: "Personal trainer", win: (n) => `${n} noticed you noticing. The session finished a different way.`, lose: (n) => `${n} smiled, said "nice try", and added ten minutes of squats.` },
  neighbour: { age: (p, r) => Math.max(18, p.age + r.int(-8, 10)), base: 0.45, trait: "Neighbour", win: (n) => `A borrowed cup of sugar led to ${n}'s sofa.`, lose: (n) => `${n} laughed it off. You'll see them at the bins tomorrow.` },
  fan: { age: (p, r) => Math.max(18, p.age + r.int(-10, 6)), base: 0.7, trait: "Fan", win: (n) => `${n} had followed your work for years. Meeting you was everything they hoped.`, lose: (n) => `${n} froze, then fled in embarrassment.` },
};

export function seduce(p0: PlayerState, kind: SeduceKind, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const def = SEDUCE_TARGETS.find((d) => d.id === kind)!;
  const why = def.need(p0);
  if (why) return { player: p0, notices: [info("Not Possible", why)] };
  const p = clone(p0);
  if ((p.annual[`seduce:${kind}`] ?? 0) >= 1) return { player: p0, notices: [info("Too Obvious", "You've already tried that this year.")] };
  const gen = GEN[kind];
  let target: Relative | undefined;
  if (kind === "friend") target = p.relatives.filter((r) => r.alive && r.relation === "Friend" && r.age >= 18 && r.partnerStatus !== "ex").sort((a, b) => b.relationshipBar - a.relationshipBar)[0];
  if (kind === "ex") target = p.relatives.find((r) => r.alive && r.relation === "Partner" && r.partnerStatus === "ex" && r.age >= 18);
  if (gen) {
    const ad = adultSpec(p, rng);
    const age = clamp(Math.round(gen.age(p, rng)), 18, 75);
    target = createRelative(p, { relation: "Partner", ageOffset: [-8, 10], partnerStatus: "dating", gender: ad.gender, ageRange: [age, age] }, rng);
    target.age = age;
    target.relation = "Lover";
    target.partnerStatus = "fling";
    target.relationshipBar = rng.int(40, 60);
    target.traits = [gen.trait];
  }
  if (!target) return { player: p0, notices: [info("Nobody There", "Nobody fits.")] };
  p.annual[`seduce:${kind}`] = 1;
  if (def.cost) p.bankBalance -= def.cost;
  const partner = getPartner(p);
  const cheating = !!partner && !isOpen(p);
  const base = gen ? gen.base : kind === "friend" ? target.relationshipBar / 120 : 0.5;
  const chance = clamp(base + (p.looks - 50) / 250 + p.skills.charisma / 600 + (target.openness ?? 40) / 400, 0.08, 0.88);
  const name = target.name.split(" ")[0];
  if (!rng.chance(chance)) {
    if (kind === "friend") target.relationshipBar = clamp(target.relationshipBar - 20);
    changeStat(p, "happiness", -3);
    let body = gen ? gen.lose(name) : kind === "friend" ? `${name} politely turned you down. Things are weird now.` : `${name} wasn't interested. Awkward.`;
    if (kind === "boss" && p.currentJob && rng.chance(0.2)) {
      p.currentJob.performance = clamp(p.currentJob.performance - 5);
      body += " Your next review was noticeably cooler.";
    }
    addLog(p, body);
    return { player: p, notices: [info("Rejected", body, "bad")] };
  }
  const notices: Notices = [];
  p.stats.hookups += 1;
  let lover: Relative;
  if (target.relation === "Lover") lover = target;
  else {
    // Existing friend or ex becomes a lover; the original entry is replaced.
    p.relatives = p.relatives.filter((r) => r.id !== target!.id);
    lover = { ...target, relation: "Lover", partnerStatus: cheating || isOpen(p) ? "affair" : "fling" };
  }
  if (gen && cheating) lover.partnerStatus = "affair";
  p.relatives.push(lover);
  encounter(p, lover, protectedSex, rng, notices, 0.1);
  let body = gen ? gen.win(name) : kind === "ex" ? `One thing led to another with your ex, ${name}. Old habits.` : `A friendship with ${name} crossed a line, in the best way.`;
  // Mixing intimacy with a working relationship has knock-on effects.
  if (kind === "employee" && p.business) {
    if (rng.chance(0.3)) {
      const settlement = rng.int(8_000, 25_000);
      p.bankBalance = Math.max(0, p.bankBalance - settlement);
      p.business.staff = Math.max(0, p.business.staff - 1);
      p.business.reputation = clamp(p.business.reputation - 8);
      lover.partnerStatus = "ex";
      body += ` Weeks later ${name} resigned, saying they hadn't felt able to refuse. A settlement of ${money(settlement)} kept it out of court, but word got round.`;
      changeStat(p, "karma", -6);
    } else {
      body += " Staff noticed. Morale wobbled.";
      p.business.morale = clamp(p.business.morale - 6);
    }
  }
  if (kind === "client" && rng.chance(0.25)) {
    if (p.business) p.business.reputation = clamp(p.business.reputation - 6);
    else if (p.currentJob) p.currentJob.performance = clamp(p.currentJob.performance - 5);
    body += " The account was moved elsewhere soon afterwards.";
  }
  if (kind === "coworker" && rng.chance(0.2) && p.currentJob) {
    p.currentJob.performance = clamp(p.currentJob.performance - 3);
    body += " The office gossip didn't help your reputation.";
  }
  if (kind === "fan" && rng.chance(0.25)) {
    changeStat(p, "fame", 3);
    changeStat(p, "happiness", -3);
    body += " A tabloid ran their version of the night.";
  }
  addLog(p, body);
  if (cheating) recordCheating(p, rng, notices, 0.1);
  return { player: p, notices: [info(cheating ? "Cheating..." : "Fling", body, cheating ? "bad" : "good"), ...notices] };
}

export function endLover(p0: PlayerState, loverId: string): ActionResult {
  const p = clone(p0);
  const lover = p.relatives.find((r) => r.id === loverId && r.relation === "Lover");
  if (!lover) return { player: p0 };
  lover.partnerStatus = "ex";
  const body = `You ended things with ${lover.name}.`;
  addLog(p, body);
  return { player: p, notices: [info("It's Over", body, "neutral")] };
}

export function leaveForLover(p0: PlayerState, loverId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const lover = p.relatives.find((r) => r.id === loverId && r.relation === "Lover" && r.partnerStatus !== "ex");
  if (!lover) return { player: p0 };
  if (lover.relationshipBar < 55) return { player: p0, notices: [info("Not Ready", `${firstName(lover)} isn't serious enough about you yet (relationship 55+).`)] };
  const partner = getPartner(p);
  if (partner) {
    const married = partner.partnerStatus === "married";
    endRelationship(p, married ? "divorce" : "breakup", true);
    changeStat(p, "karma", -4);
  }
  p.flags = p.flags.filter((f) => f !== "open_relationship");
  lover.relation = "Partner";
  lover.partnerStatus = "dating";
  const body = `You ${partner ? `left ${partner.name} for` : "made it official with"} ${lover.name}. ${rng.chance(0.5) ? "Your friends have opinions." : "It was messy, but you're together."}`;
  addLog(p, body);
  return { player: p, notices: [info("Making It Official", body, "good")] };
}

// ---------------------------------------------------------------------------
// Yearly processing
// ---------------------------------------------------------------------------

export function processIntimacy(p: PlayerState, prevAnnual: Record<string, number>, rng: Rng, notices: Notices) {
  // Births
  if (p.pregnancy) {
    const { carrier, other } = p.pregnancy;
    p.pregnancy = null;
    const gender = randomGender(rng);
    const first = randomName(p.residence.country, gender, rng).first;
    const kid = makeRelativeBase(rng, "Child", `${first} ${p.lastName}`, 0, gender, 2, rng.int(70, 100));
    kid.smarts = clamp(Math.round((p.smarts + 50) / 2 + rng.int(-15, 15)));
    kid.looks = clamp(Math.round((p.looks + 50) / 2 + rng.int(-15, 15)));
    kid.health = rng.int(78, 100);
    kid.royalTitle = royalStyleForChild(p, gender);
    p.relatives.push(kid);
    p.stats.childrenBorn += 1;
    changeStat(p, "happiness", 12);
    if (carrier === "self") changeStat(p, "health", -2);
    const body = `A baby ${gender === "Male" ? "boy" : "girl"} was born: ${kid.name}! ${carrier === "self" ? "You gave birth" : "The birth went smoothly"}${other ? `, with ${other} as the other parent` : ""}.`;
    addLog(p, body);
    notices.push(info("A New Baby!", body, "good"));
    const partner = getPartner(p);
    if (partner && partner.name !== other && !isOpen(p) && rng.chance(0.4)) exposeAffair(p, rng, notices);
  }
  // Lovers: upkeep, drift and discovery
  for (const l of p.relatives) {
    if (l.relation !== "Lover" || !l.alive || l.partnerStatus === "ex") continue;
    const meetups = prevAnnual[`love:${l.id}`] ?? 0;
    l.relationshipBar = clamp(l.relationshipBar - (l.partnerStatus === "fling" ? rng.int(5, 15) : rng.int(2, 8)) + meetups * 3);
    if (l.relationshipBar <= 0) {
      l.partnerStatus = "ex";
      addLog(p, `${l.name} drifted out of your life.`);
    }
  }
  // Workplace romances across a power gap tend to surface.
  for (const l of p.relatives) {
    if (l.relation !== "Lover" || !l.alive || l.partnerStatus === "ex" || !l.traits) continue;
    if (l.traits.includes("Your boss") && p.currentJob && rng.chance(0.14)) {
      const fired = rng.chance(0.25);
      const body = fired
        ? `HR found out about you and ${firstName(l)}. Because of the reporting line, you were let go with a signed agreement to stay quiet.`
        : `HR found out about you and ${firstName(l)}. One of you had to move teams, and it was you. The gossip didn't stop.`;
      if (fired) { p.currentJob = null; p.annualSalary = 0; } else p.currentJob.performance = clamp(p.currentJob.performance - 12);
      l.partnerStatus = "ex";
      changeStat(p, "happiness", -5);
      addLog(p, body);
      notices.push(info("The Office Finds Out", body, "bad"));
    } else if (l.traits.includes("Your employee") && p.business && rng.chance(0.14)) {
      p.business.reputation = clamp(p.business.reputation - 10);
      p.business.morale = clamp(p.business.morale - 10);
      l.partnerStatus = "ex";
      const body = `The staff learned about you and ${firstName(l)}. Resentment about favouritism spread, and the relationship couldn't survive the scrutiny.`;
      addLog(p, body);
      notices.push(info("Trouble at Work", body, "bad"));
    }
  }
  const partner = getPartner(p);
  // Juggling more than one relationship takes time and emotional work, whatever the rules.
  if (partner && p.flags.includes("polyamorous")) {
    const others = p.relatives.filter((l) => l.relation === "Lover" && l.alive && l.partnerStatus !== "ex").length;
    if (others > 0) {
      const strain = Math.round(others * (0.5 + (partner.jealousy ?? 50) / 100) * rng.int(0, 3));
      partner.relationshipBar = clamp(partner.relationshipBar - strain + (prevAnnual[`love:${partner.id}`] ?? 0) * 2);
      if (strain >= 4) {
        const body = `${firstName(partner)} admitted that sharing your time is harder than they expected. A heart-to-heart is overdue.`;
        addLog(p, body);
        notices.push(info("Strain", body, "bad"));
      }
    }
  }
  if (partner && !isOpen(p)) {
    for (const l of p.relatives) {
      if (l.relation !== "Lover" || l.partnerStatus !== "affair" || !l.alive) continue;
      const meetups = prevAnnual[`love:${l.id}`] ?? 0;
      const risk = clamp(0.02 + meetups * 0.07, 0, 0.6);
      if (rng.chance(risk)) {
        exposeAffair(p, rng, notices);
        l.partnerStatus = "ex";
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Adult work
// ---------------------------------------------------------------------------

/** Countries where companionship work is legal and regulated (approximate, for game purposes). */
export const ESCORT_LEGAL = new Set(["Germany", "Netherlands", "Australia"]);

export const escortIsIllegal = (p: PlayerState) => p.currentJob?.lineId === "escort" && !ESCORT_LEGAL.has(p.residence.country);

export function processAdultWork(p: PlayerState, rng: Rng, notices: Notices) {
  const job = p.currentJob;
  if (!job || p.isInPrison) return;
  if (!["dancer", "escort", "creator"].includes(job.lineId)) return;
  if (!p.matureContent) {
    p.currentJob = null;
    p.annualSalary = 0;
    return;
  }
  const partner = getPartner(p);
  if (job.lineId === "escort") {
    if (partner && !isOpen(p)) partner.relationshipBar = clamp(partner.relationshipBar - 6);
    maybeInfect(p, true, 0.1, rng, notices);
    if (rng.chance(0.03)) {
      const dmg = rng.int(10, 30);
      changeStat(p, "health", -dmg);
      const body = `A client turned violent. You got out, hurt (Health −${dmg}).`;
      addLog(p, body);
      notices.push(info("Dangerous Night", body, "bad"));
    }
    if (escortIsIllegal(p) && !p.pendingTrial && rng.chance(0.06)) {
      p.currentJob = null;
      p.annualSalary = 0;
      startTrial(p, { name: "Solicitation", description: "An undercover sting caught you in the act.", years: 2, severity: "minor" });
      notices.push(info("Sting Operation", "Police busted you in an undercover operation.", "bad"));
    }
  } else if (job.lineId === "dancer") {
    if (rng.chance(0.02)) changeStat(p, "health", -5);
  } else if (job.lineId === "creator") {
    if (job.tier >= 1) changeStat(p, "fame", job.tier);
    if (rng.chance(0.04)) {
      for (const r of p.relatives) if (r.alive && (r.relation === "Parent" || r.relation === "Sibling")) r.relationshipBar = clamp(r.relationshipBar - 10);
      changeStat(p, "happiness", -6);
      changeStat(p, "fame", 3);
      const body = "Someone recognised you in public and your family found out about your page. Awkward dinners ahead.";
      addLog(p, body);
      notices.push(info("Exposed", body, "bad"));
    }
  }
}
