/**
 * The sovereign's constitutional role and the end of a reign: the weekly audience with the Prime Minister,
 * the honours list, royal assent, constitutional crises from overstepping, the republican referendum,
 * and abdication. The convention is the British one: advise, encourage, warn, and above all do not govern.
 */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { isSovereign } from "./courtState";
import { addApproval, addGovernment, addHeat, addRepublic, addStrain, info } from "./court";

export type NationKey = "economy" | "freedom" | "military";
export const NATION_LABEL: Record<NationKey, string> = { economy: "Economy", freedom: "Freedom", military: "Military" };

const refuse = (p0: PlayerState, why: string): ActionResult => ({ player: p0, notices: [info("Not possible", why, "bad")] });
const bump = (p: PlayerState, k: NationKey, d: number) => { p.nation[k] = clamp(p.nation[k] + d); };

export function sovereignBlocker(p: PlayerState): string | null {
  if (!isSovereign(p)) return "Only the sovereign holds these duties.";
  if (p.court.regency) return `${p.court.regency} acts as Regent until you turn 18.`;
  return null;
}

// ---------------------------------------------------------------------------
// The weekly audience
// ---------------------------------------------------------------------------

export type AudienceStance = "listen" | "advise" | "press";

export function audienceBlocker(p: PlayerState): string | null {
  return sovereignBlocker(p) ?? (p.court.booked.audience ? "You've already met the Prime Minister this year." : null);
}

export function adviceChance(p: PlayerState): number {
  return clamp(0.6 + (p.smarts - 50) / 250 + p.court.secretary * 0.05 + (p.court.government - 50) / 300, 0.2, 0.92);
}

export function holdAudience(p0: PlayerState, rng: Rng, stance: AudienceStance, topic: NationKey): ActionResult {
  const why = audienceBlocker(p0);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  const c = p.court;
  c.booked.audience = 1;
  const pm = c.pm || "the Prime Minister";
  let body = "";
  let tone: "good" | "bad" | "neutral" = "neutral";
  if (stance === "listen") {
    addGovernment(p, 4);
    addStrain(p, -3);
    body = `You heard ${pm} out and offered encouragement, nothing more. The government left reassured.`;
    if (rng.chance(0.15)) {
      changeStat(p, "royalRespect", 2);
      addGovernment(p, 2);
      body += " A quiet word of yours turned out to be exactly what they needed.";
    }
    tone = "good";
  } else if (stance === "advise") {
    if (rng.chance(adviceChance(p))) {
      addGovernment(p, 3);
      bump(p, topic, 2);
      changeStat(p, "royalRespect", 3);
      body = `You warned ${pm} about the ${NATION_LABEL[topic].toLowerCase()} and they took the point. The policy was quietly softened.`;
      tone = "good";
    } else {
      addGovernment(p, -5);
      addStrain(p, 6);
      body = `${pm} found your warning about the ${NATION_LABEL[topic].toLowerCase()} presumptuous. The temperature in the room dropped.`;
      tone = "bad";
    }
  } else {
    addStrain(p, Math.round(18 * (1 - 0.15 * c.secretary)));
    addGovernment(p, -8);
    body = `You told ${pm} what you wanted done about the ${NATION_LABEL[topic].toLowerCase()}. A sovereign is not supposed to have a policy.`;
    tone = "bad";
    if (rng.chance(0.35)) {
      bump(p, topic, 4);
      addApproval(p, 1);
      body += " Unwilling to cause a fuss, the government yielded.";
    }
    if (rng.chance(0.4)) {
      addApproval(p, -8);
      addRepublic(p, 6);
      addHeat(p, 15);
      body += " Then it leaked. Commentators asked who elected you.";
    }
    if (c.strain >= 70) body += " Ministers are now openly talking of a constitutional crisis.";
  }
  addLog(p, body);
  return { player: p, notices: [info("Audience with the Prime Minister", body, tone)] };
}

// ---------------------------------------------------------------------------
// Honours
// ---------------------------------------------------------------------------

export type HonoursKind = "servants" | "celebrities" | "pm_list" | "friends";

export function honoursBlocker(p: PlayerState): string | null {
  return sovereignBlocker(p) ?? (p.court.booked.honours ? "This year's honours list has already gone out." : null);
}

export function honoursList(p0: PlayerState, rng: Rng, kind: HonoursKind): ActionResult {
  const why = honoursBlocker(p0);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  p.court.booked.honours = 1;
  let body = "";
  let tone: "good" | "bad" | "neutral" = "good";
  switch (kind) {
    case "servants":
      addApproval(p, 4);
      changeStat(p, "karma", 2);
      body = "Your honours went to nurses, volunteers and teachers. The country felt seen.";
      break;
    case "celebrities":
      changeStat(p, "fame", 3);
      addApproval(p, 3);
      addHeat(p, 4);
      body = "A knighthood for a footballer and a damehood for a beloved actress made the cover of every paper.";
      break;
    case "pm_list":
      addGovernment(p, 5);
      body = "You accepted the Prime Minister's list as drafted, as convention requires.";
      if (rng.chance(0.3)) {
        addApproval(p, -3);
        addHeat(p, 5);
        body += " The press noted how many names were party donors.";
        tone = "neutral";
      }
      break;
    case "friends":
      changeStat(p, "happiness", 3);
      body = "You recognised loyal members of your household and old friends.";
      if (rng.chance(0.35)) {
        addApproval(p, -4);
        addHeat(p, 8);
        body += " The press called it 'jobs for the boys'.";
        tone = "bad";
      }
      break;
  }
  addLog(p, body);
  return { player: p, notices: [info("Honours List", body, tone)] };
}

// ---------------------------------------------------------------------------
// Royal assent
// ---------------------------------------------------------------------------

export interface Bill {
  id: string;
  name: string;
  /** Effects on the nation if it becomes law. */
  nation: Partial<Record<NationKey, number>>;
  /** Refusing assent is popular with the public. */
  popularRefusal: boolean;
}

export const BILLS: Bill[] = [
  { id: "emergency", name: "Emergency Powers Bill", nation: { freedom: -8, military: 4 }, popularRefusal: true },
  { id: "windfall", name: "Windfall Tax Bill", nation: { economy: -4, freedom: 1 }, popularRefusal: false },
  { id: "defence", name: "Defence Spending Bill", nation: { military: 8, economy: -3 }, popularRefusal: false },
];

export type AssentChoice = "assent" | "concerns" | "withhold";

export function giveAssent(p: PlayerState, rng: Rng, bill: Bill, how: AssentChoice): string {
  const c = p.court;
  const apply = (mult: number) => {
    for (const [k, v] of Object.entries(bill.nation) as Array<[NationKey, number]>) bump(p, k, Math.round(v * mult));
  };
  if (how === "assent") {
    apply(1);
    addGovernment(p, 3);
    return `You signed the ${bill.name} into law, as convention requires.`;
  }
  if (how === "concerns") {
    const chance = clamp(0.5 + c.secretary * 0.08 + (c.government - 50) / 200, 0.2, 0.9);
    if (rng.chance(chance)) {
      apply(0.5);
      addGovernment(p, 2);
      return `Your private office raised concerns with ministers before assent, and the ${bill.name} was amended. You signed it quietly.`;
    }
    apply(1);
    addStrain(p, 8);
    addApproval(p, -3);
    addHeat(p, 8);
    return `Your concerns about the ${bill.name} leaked, and ministers were furious. You signed it anyway.`;
  }
  addStrain(p, 40);
  addGovernment(p, -25);
  addRepublic(p, 3);
  addApproval(p, bill.popularRefusal ? 6 : -8);
  return `You withheld assent to the ${bill.name}. No sovereign has done that in centuries. ${bill.popularRefusal ? "The public applauded; constitutional lawyers were appalled." : "The public were baffled and furious."}`;
}

// ---------------------------------------------------------------------------
// Constitutional crisis and referendum
// ---------------------------------------------------------------------------

export type CrisisChoice = "retreat" | "dig_in" | "election";

export function resolveCrisis(p: PlayerState, rng: Rng, how: CrisisChoice): string {
  const c = p.court;
  if (how === "retreat") {
    c.strain = 20;
    addGovernment(p, 6);
    addApproval(p, -2);
    changeStat(p, "royalRespect", -2);
    return "You let the government have its way and stepped back from the quarrel. The crisis passed, at some cost to your standing.";
  }
  if (how === "election") {
    c.strain = 10;
    c.pm = "";
    addApproval(p, 1);
    changeStat(p, "royalRespect", -4);
    return "You asked the country to decide. The Prime Minister called an election, and the crisis was handed to the voters.";
  }
  const win = rng.chance(clamp(0.35 + (c.approval - 50) / 150, 0.1, 0.7));
  c.strain = 40;
  if (win) {
    addApproval(p, 8);
    addGovernment(p, -10);
    addRepublic(p, -2);
    return "The public rallied behind you and the government backed down. But everyone now knows the throne has opinions.";
  }
  addApproval(p, -15);
  addRepublic(p, 12);
  changeStat(p, "royalRespect", -10);
  addGovernment(p, -15);
  return "The country sided with its elected government. Republicans have never been so loud.";
}

export type ReferendumStance = "above" | "campaign" | "reform";

export function referendumChance(p: PlayerState, stance: ReferendumStance): number {
  const bonus = stance === "campaign" ? 0.15 : stance === "reform" ? 0.2 : 0;
  return clamp((100 - p.court.republic) / 100 + 0.05 + bonus, 0.08, 0.9);
}

/** Resolves the referendum. Returns true if the monarchy was abolished. */
export function holdReferendum(p: PlayerState, rng: Rng, stance: ReferendumStance): { abolished: boolean; text: string } {
  const c = p.court;
  const chance = referendumChance(p, stance);
  if (stance === "reform") {
    c.slimmed = true;
    addApproval(p, 3);
  } else if (stance === "campaign") {
    addStrain(p, 15);
    addApproval(p, -3);
  }
  c.lastReferendum = p.year;
  if (rng.chance(chance)) {
    c.republic = clamp(c.republic - 20);
    addApproval(p, 6);
    return { abolished: false, text: "The country voted to keep the monarchy. The result was closer than anyone in the palace would admit, and the republicans promised to try again." };
  }
  p.royalRank = "none";
  p.royal = null;
  p.specialCareerPath = "none";
  p.royalRespect = 50;
  p.bankBalance = Math.round(p.bankBalance * 0.5);
  setFlagOnce(p, "monarchy_abolished");
  changeStat(p, "happiness", -12);
  return { abolished: true, text: "The country voted to abolish the monarchy. The crown estates, palaces and titles passed to the state. You keep your private fortune, halved by the settlement, and your family name." };
}

const setFlagOnce = (p: PlayerState, f: string) => { if (!p.flags.includes(f)) p.flags.push(f); };

// ---------------------------------------------------------------------------
// Abdication
// ---------------------------------------------------------------------------

/** The next in line who could take the throne from you: your eldest royal child, else your eldest royal sibling. */
export function heirToThrone(p: PlayerState): Relative | undefined {
  const styled = (r: Relative) => r.alive && !!r.royalTitle && r.royalTitle !== "King" && r.royalTitle !== "Queen" && !/Consort/.test(r.royalTitle);
  const kids = p.relatives.filter((r) => r.relation === "Child" && styled(r)).sort((a, b) => b.age - a.age);
  if (kids[0]) return kids[0];
  return p.relatives.filter((r) => r.relation === "Sibling" && styled(r)).sort((a, b) => b.age - a.age)[0];
}

export function abdicationBlocker(p: PlayerState): string | null {
  if (!isSovereign(p)) return "Only a reigning sovereign can abdicate.";
  if (p.court.regency) return "You are a minor under a Regency.";
  if (!heirToThrone(p)) return "There is no heir ready to take the throne.";
  return null;
}

export type AbdicationMode = "retire" | "pressure" | "love";

export function abdicate(p: PlayerState, mode: AbdicationMode): string {
  const heir = heirToThrone(p);
  if (!heir || !isSovereign(p)) return "";
  const c = p.court;
  const rank = p.gender === "Male" ? "Prince" : "Princess";
  heir.royalTitle = heir.gender === "Male" ? "King" : "Queen";
  heir.relationshipBar = clamp(heir.relationshipBar + (mode === "retire" ? 8 : 0));
  if (p.royal) {
    p.royal.crown = "abdicated";
    p.royal.line = 2;
    p.royal.hrh = true;
    p.royal.peerage = null;
  }
  p.royalRank = rank;
  c.abdicated = true;
  c.strain = 0;
  c.regency = null;
  c.patronages = c.patronages.slice(0, 3);
  if (mode === "retire") {
    if (p.age >= 65) { addApproval(p, 5); addRepublic(p, -3); } else addApproval(p, -8);
    changeStat(p, "happiness", 6);
  } else if (mode === "pressure") {
    addApproval(p, -10);
    changeStat(p, "happiness", -4);
  } else {
    addApproval(p, -15);
    changeStat(p, "happiness", 10);
    addRepublic(p, 4);
  }
  const text = `You abdicated. ${heir.name} was proclaimed ${heir.royalTitle}. You are now ${rank === "Prince" ? "HRH Prince" : "HRH Princess"} ${p.firstName}, with a modest allowance from the new sovereign.`;
  addLog(p, text);
  return text;
}

export function abdicateAction(p0: PlayerState, mode: AbdicationMode): ActionResult {
  const why = abdicationBlocker(p0);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  const text = abdicate(p, mode);
  return { player: p, notices: [info("Abdication", text, "neutral")] };
}
