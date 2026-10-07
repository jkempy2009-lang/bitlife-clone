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

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const isAdult = (r: Relative) => r.age >= 18;

function gate(p: PlayerState): ActionResult | null {
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

const fill = (line: string, name: string) => line.replace("{n}", name);

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
  if (!rng.chance(protectedSex ? 0.02 : 0.14)) return;
  p.pregnancy = { carrier: carrierId, other: other.name };
  const who = carrierId === "self" ? "You're" : `${firstName(other)} is`;
  addLog(p, `${who} expecting a baby!`);
  notices.push(info("Positive Test!", `${who} pregnant. A baby is due by next year.`, "neutral"));
}

function maybeInfect(p: PlayerState, protectedSex: boolean, risk: number, rng: Rng, notices: Notices) {
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

function recordCheating(p: PlayerState, rng: Rng, notices: Notices, immediateRisk: number): boolean {
  const partner = getPartner(p);
  if (!partner || p.flags.includes("open_relationship")) return false;
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
function encounter(p: PlayerState, other: Relative, protectedSex: boolean, rng: Rng, notices: Notices, stiRisk: number) {
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

export function proposeOpenRelationship(p0: PlayerState, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner || !isAdult(partner)) return { player: p0 };
  if (p.flags.includes("open_relationship")) return { player: p0, notices: [info("Already Open", "You two already have an open relationship.")] };
  if ((p.annual.openask ?? 0) >= 1) return { player: p0, notices: [info("Give It Time", "You've already raised this once this year.")] };
  p.annual.openask = 1;
  const chance = clamp((partner.openness ?? 40) / 100 - (partner.jealousy ?? 50) / 200 + partner.relationshipBar / 300, 0.05, 0.85);
  const n = firstName(partner);
  if (rng.chance(chance)) {
    p.flags.push("open_relationship");
    partner.relationshipBar = clamp(partner.relationshipBar + 4);
    const body = `After a long, honest conversation, ${n} agreed to open up your relationship. Ground rules were set.`;
    addLog(p, body);
    return { player: p, notices: [info("Open Relationship", body, "good")] };
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

export function askThreesome(p0: PlayerState, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const partner = getPartner(p);
  if (!partner || !isAdult(partner)) return { player: p0 };
  if ((p.annual.threesome ?? 0) >= 1) return { player: p0, notices: [info("Maybe Next Year", "You've already had that conversation this year.")] };
  p.annual.threesome = 1;
  const open = p.flags.includes("open_relationship");
  const chance = clamp(0.08 + (partner.openness ?? 40) / 120 + partner.relationshipBar / 400 - (partner.jealousy ?? 50) / 250 + (open ? 0.25 : 0), 0.03, 0.8);
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
  const guest = createRelative(p, { relation: "Partner", ageOffset: [-5, 7], partnerStatus: "dating" }, rng);
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
  if (partner && !p.flags.includes("open_relationship")) {
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

export type Venue = "bar" | "app" | "party" | "gym";
const VENUE_COST: Record<Venue, number> = { bar: 100, app: 20, party: 50, gym: 0 };
export const VENUES: { id: Venue; label: string; emoji: string; cost: number }[] = [
  { id: "bar", label: "At the Bar", emoji: "🍸", cost: VENUE_COST.bar },
  { id: "app", label: "Dating App", emoji: "📱", cost: VENUE_COST.app },
  { id: "party", label: "At a Party", emoji: "🎉", cost: VENUE_COST.party },
  { id: "gym", label: "At the Gym", emoji: "🏋️", cost: VENUE_COST.gym },
];

function newLover(p: PlayerState, rng: Rng, status: "fling" | "affair"): Relative {
  const base = createRelative(p, { relation: "Partner", ageOffset: [-6, 8], partnerStatus: "dating" }, rng);
  base.age = Math.max(18, base.age);
  base.relation = "Lover";
  base.partnerStatus = status;
  base.relationshipBar = rng.int(35, 65);
  return base;
}

export function hookUp(p0: PlayerState, venue: Venue, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  const cost = VENUE_COST[venue];
  if (p.bankBalance < cost) return { player: p0, notices: [info("Insufficient Funds", `That costs ${money(cost)}.`, "bad")] };
  if ((p.annual[`hookup:${venue}`] ?? 0) >= 2) return { player: p0, notices: [info("Out of Energy", "You've been out enough this way for one year.")] };
  p.annual[`hookup:${venue}`] = (p.annual[`hookup:${venue}`] ?? 0) + 1;
  p.bankBalance -= cost;
  const partner = getPartner(p);
  const open = p.flags.includes("open_relationship");
  const cheating = !!partner && !open;
  const chance = clamp(0.35 + (p.looks - 50) / 200 + p.skills.charisma / 300 + (venue === "app" ? 0.1 : 0), 0.1, 0.85);
  if (!rng.chance(chance)) {
    changeStat(p, "happiness", -2);
    const body = "You tried your luck, but nobody was biting tonight.";
    addLog(p, body);
    return { player: p, notices: [info("No Luck", body, "neutral")] };
  }
  const notices: Notices = [];
  const stays = rng.chance(0.4);
  const status = cheating || open ? "affair" : "fling";
  const lover = newLover(p, rng, status);
  p.stats.hookups += 1;
  encounter(p, lover, protectedSex, rng, notices, 0.12);
  const line = rng.pick(FLING_LINES);
  addLog(p, `${line} (${lover.name})`);
  if (stays) p.relatives.push(lover);
  if (cheating) recordCheating(p, rng, notices, 0.1);
  const tail = stays ? ` You're keeping in touch with ${lover.name.split(" ")[0]}.` : "";
  return { player: p, notices: [info(cheating ? "Cheating..." : "Hookup", `${line}${tail}${cheating ? " Your partner doesn't know." : ""}`, cheating ? "bad" : "good"), ...notices] };
}

export type SeduceKind = "friend" | "coworker" | "ex";

export function seduce(p0: PlayerState, kind: SeduceKind, protectedSex: boolean, rng: Rng): ActionResult {
  const blocked = gate(p0);
  if (blocked) return { ...blocked, player: p0 };
  const p = clone(p0);
  if ((p.annual[`seduce:${kind}`] ?? 0) >= 1) return { player: p0, notices: [info("Too Obvious", "You've already tried that this year.")] };
  if (kind === "coworker" && !p.currentJob) return { player: p0, notices: [info("No Coworkers", "You need a job for that.")] };
  let target: Relative | undefined;
  if (kind === "friend") target = p.relatives.filter((r) => r.alive && r.relation === "Friend" && r.age >= 18 && r.partnerStatus !== "ex").sort((a, b) => b.relationshipBar - a.relationshipBar)[0];
  if (kind === "ex") target = p.relatives.find((r) => r.alive && r.relation === "Partner" && r.partnerStatus === "ex" && r.age >= 18);
  if (kind === "coworker") {
    target = createRelative(p, { relation: "Friend", ageOffset: [-8, 10] }, rng);
    target.age = Math.max(18, target.age);
    target.relation = "Lover";
    target.partnerStatus = "fling";
    target.relationshipBar = rng.int(40, 60);
  }
  if (!target) return { player: p0, notices: [info("Nobody There", kind === "friend" ? "You don't have a friend who fits." : "You don't have an ex to call.")] };
  p.annual[`seduce:${kind}`] = 1;
  const partner = getPartner(p);
  const cheating = !!partner && !p.flags.includes("open_relationship");
  const base = kind === "friend" ? target.relationshipBar / 120 : kind === "ex" ? 0.5 : 0.4;
  const chance = clamp(base + (p.looks - 50) / 250 + (target.openness ?? 40) / 400, 0.1, 0.85);
  const name = target.name.split(" ")[0];
  if (!rng.chance(chance)) {
    if (kind === "friend") target.relationshipBar = clamp(target.relationshipBar - 20);
    changeStat(p, "happiness", -3);
    const body = kind === "friend" ? `${name} politely turned you down. Things are weird now.` : `${name} wasn't interested. Awkward.`;
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
    lover = { ...target, relation: "Lover", partnerStatus: cheating || p.flags.includes("open_relationship") ? "affair" : "fling" };
  }
  if (kind === "coworker" && cheating) lover.partnerStatus = "affair";
  p.relatives.push(lover);
  encounter(p, lover, protectedSex, rng, notices, 0.1);
  const body =
    kind === "coworker" ? `Late nights at the office turned into something else with ${name}.`
    : kind === "ex" ? `One thing led to another with your ex, ${name}. Old habits.`
    : `A friendship with ${name} crossed a line, in the best way.`;
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
    const first = randomName(p.birthCountry, gender, rng).first;
    const kid = makeRelativeBase(rng, "Child", `${first} ${p.lastName}`, 0, gender, 2, rng.int(70, 100));
    kid.smarts = clamp(Math.round((p.smarts + 50) / 2 + rng.int(-15, 15)));
    kid.looks = clamp(Math.round((p.looks + 50) / 2 + rng.int(-15, 15)));
    kid.health = rng.int(78, 100);
    p.relatives.push(kid);
    p.stats.childrenBorn += 1;
    changeStat(p, "happiness", 12);
    if (carrier === "self") changeStat(p, "health", -2);
    const body = `A baby ${gender === "Male" ? "boy" : "girl"} was born: ${kid.name}! ${carrier === "self" ? "You gave birth" : "The birth went smoothly"}${other ? `, with ${other} as the other parent` : ""}.`;
    addLog(p, body);
    notices.push(info("A New Baby!", body, "good"));
    const partner = getPartner(p);
    if (partner && partner.name !== other && !p.flags.includes("open_relationship") && rng.chance(0.4)) exposeAffair(p, rng, notices);
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
  const partner = getPartner(p);
  if (partner && !p.flags.includes("open_relationship")) {
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
    if (partner && !p.flags.includes("open_relationship")) partner.relationshipBar = clamp(partner.relationshipBar - 6);
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
