/**
 * The working life of a royal: public approval, a limited diary of engagements (patronages, tours, ceremonial
 * duties) that can't be double-booked, military service, the private office, scandals and the press office, the
 * money (Sovereign Grant, duchy and estate income, a working royal's allowance), and stepping back from it all.
 * Constitutional duties and abdication are in crown.ts; marriage and bringing up heirs are in courtFamily.ts.
 */
import type { ActionResult, PlayerState, ServiceBranch } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { BRANCHES, PATRONAGE_BY_ID, SCANDALS, SECRETARIES, type ScandalTemplate } from "@/data/court";
import { addLog, changeStat, clone, getPartner, isRoyal } from "./state";
import { killPlayer } from "./mortality";
import { isSovereign } from "./courtState";
import { processRoyalFamily } from "./courtFamily";

export type Notices = NonNullable<ActionResult["notices"]>;
type Tone = "good" | "bad" | "neutral" | "jackpot";
export const info = (title: string, body: string, tone: Tone = "neutral") => ({ kind: "info" as const, title, body, tone });
const refuse = (p0: PlayerState, why: string): ActionResult => ({ player: p0, notices: [info("Not possible", why, "bad")] });

// ---------------------------------------------------------------------------
// Popularity
// ---------------------------------------------------------------------------

/** Public approval moves your standing at court too: a popular royal is a safe one. */
export function addApproval(p: PlayerState, n: number) {
  p.court.approval = clamp(p.court.approval + n);
  if (isRoyal(p)) changeStat(p, "royalRespect", Math.round(n / 4));
}
export const addHeat = (p: PlayerState, n: number) => { p.court.heat = clamp(p.court.heat + n); };
export const addRepublic = (p: PlayerState, n: number) => { p.court.republic = clamp(p.court.republic + n); };
export const addStrain = (p: PlayerState, n: number) => { p.court.strain = clamp(p.court.strain + n); };
export const addGovernment = (p: PlayerState, n: number) => { p.court.government = clamp(p.court.government + n); };

export function approvalWord(a: number): string {
  return a >= 80 ? "Adored" : a >= 65 ? "Popular" : a >= 50 ? "Respected" : a >= 35 ? "Divisive" : a >= 20 ? "Unpopular" : "Despised";
}
export function republicWord(r: number): string {
  return r >= 65 ? "Referendum territory" : r >= 45 ? "A growing movement" : r >= 25 ? "A vocal minority" : "Fringe";
}

// ---------------------------------------------------------------------------
// The diary: engagement days that can't be double-booked
// ---------------------------------------------------------------------------

/** Engagement days available this year. */
export function slotsFor(p: PlayerState): number {
  const c = p.court;
  if (!isRoyal(p) || c.withdrawn > 0 || c.disgraced || c.steppedBack || c.regency) return 0;
  if (p.age < 16) return 0;
  if (p.age < 18) return 1;
  let s = isSovereign(p) ? 7 : p.royal?.line === 1 && p.royal.crown !== "abdicated" ? 6 : 5;
  if (c.abdicated || p.royal?.crown === "abdicated") s = 2;
  if (p.age >= 90) s = Math.min(s, 2);
  else if (p.age >= 80) s = Math.round(s * 0.6);
  s += c.secretary >= 3 ? 2 : c.secretary >= 2 ? 1 : 0;
  const serving = c.service && !c.service.done;
  if (serving) s -= c.service!.deployed ? 4 : 2;
  if (p.relatives.some((r) => r.relation === "Child" && r.alive && r.age < 1)) s -= 1;
  return Math.max(serving ? 1 : 0, s);
}
export const slotsUsed = (p: PlayerState) => p.court.booked.slots ?? 0;
export const slotsLeft = (p: PlayerState) => Math.max(0, slotsFor(p) - slotsUsed(p));

export function book(p: PlayerState, key: string, days: number) {
  p.court.booked[key] = (p.court.booked[key] ?? 0) + 1;
  p.court.booked.slots = slotsUsed(p) + days;
}

export type EngagementKind = "hospital" | "walkabout" | "remembrance" | "investiture" | "banquet" | "patron" | "tour_realm" | "tour_state";

export const ENGAGEMENTS: Record<EngagementKind, { label: string; emoji: string; days: number; cost: number; blurb: string; solemn?: boolean; sovereignOnly?: boolean }> = {
  hospital: { label: "Hospital & hospice visit", emoji: "🏥", days: 1, cost: 0, blurb: "Quiet, human work. Approval rises a little.", solemn: true },
  walkabout: { label: "Public walkabout", emoji: "🚶", days: 1, cost: 0, blurb: "Shake hands with the crowds. Charm wins, gaffes cost.", solemn: true },
  remembrance: { label: "Remembrance & military parade", emoji: "🎖️", days: 1, cost: 0, blurb: "For the sovereign and those who have served. Boosts the armed forces.", solemn: true },
  patron: { label: "Patronage engagement", emoji: "🎗️", days: 1, cost: 0, blurb: "Visit a charity you back. Years of commitment compound.", solemn: true },
  investiture: { label: "Investiture", emoji: "🏅", days: 1, cost: 0, blurb: "Present honours in person (sovereign).", sovereignOnly: true },
  banquet: { label: "State banquet", emoji: "🍽️", days: 1, cost: 40_000, blurb: "Host a visiting head of state: trade, goodwill, government gratitude.", sovereignOnly: true },
  tour_realm: { label: "Realm tour", emoji: "🌍", days: 3, cost: 80_000, blurb: "Three days away: reassure the realms that share your crown." },
  tour_state: { label: "Overseas state visit", emoji: "✈️", days: 3, cost: 60_000, blurb: "Three days away: diplomacy and trade deals." },
};

export function engagementBlocker(p: PlayerState, kind: EngagementKind, arg?: string): string | null {
  const c = p.court;
  const e = ENGAGEMENTS[kind];
  if (!p.alive) return "You are dead.";
  if (!isRoyal(p)) return "Only working royals keep an engagement diary.";
  if (p.isInPrison) return "You're in prison.";
  if (c.regency) return `${c.regency} acts as Regent until you turn 18.`;
  if (c.disgraced) return "You have been stripped of public duties.";
  if (c.withdrawn > 0) return `You are out of public life for ${c.withdrawn} more year${c.withdrawn === 1 ? "" : "s"}.`;
  if (p.age < 16) return "Too young for public engagements.";
  if (e.sovereignOnly && !isSovereign(p)) return "Reserved for the sovereign.";
  if (c.mourning > 0 && !e.solemn) return "The nation is in mourning. Only solemn duties are appropriate.";
  if (kind === "patron") {
    if (!arg || !c.patronages.some((x) => x.id === arg)) return "You don't back that cause.";
    if ((c.booked[`patron:${arg}`] ?? 0) >= 1) return "You've already visited them this year.";
  }
  if (kind === "hospital" && (c.booked.hospital ?? 0) >= 2) return "You've done as many visits as the diary allows this year.";
  if (["walkabout", "remembrance", "investiture", "banquet"].includes(kind) && (c.booked[kind] ?? 0) >= 1) return "Already done this year.";
  if (kind === "remembrance" && !isSovereign(p) && !c.service) return "Reserved for the sovereign and those who have served.";
  if (kind === "tour_realm" || kind === "tour_state") {
    if ((c.booked.tour ?? 0) >= 1) return "You've already toured this year. One trip a year keeps the family home.";
    if (c.service && !c.service.done) return c.service.deployed ? "You're on an operational posting." : "Your posting leaves no time for a long trip.";
    if (kind === "tour_realm" && c.realmNames.length === 0) return "No realms share your crown.";
    if (p.bankBalance < e.cost) return `A tour costs ${money(e.cost)}.`;
  }
  if (kind === "banquet" && p.bankBalance < e.cost) return `A banquet costs ${money(e.cost)}.`;
  const left = slotsLeft(p);
  const total = slotsFor(p);
  if (left < e.days) return left === 0 ? `Your diary is full: all ${total} engagement days are booked.` : `Not enough days: this needs ${e.days}, you have ${left} left (of ${total}).`;
  return null;
}

const GAFFES = [
  "You mispronounced the host's name during a toast.",
  "A candid comment about the weather in front of an open microphone made the evening news.",
  "You were photographed checking your watch during a long speech.",
  "A joke landed very badly with a delegation.",
];

export function gaffeChance(p: PlayerState): number {
  return clamp(0.12 - p.court.secretary * 0.025 - p.skills.charisma / 1000 - (p.talents.speaking - 50) / 1000, 0.02, 0.25);
}

export function engage(p0: PlayerState, rng: Rng, kind: EngagementKind, arg?: string): ActionResult {
  const why = engagementBlocker(p0, kind, arg);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  const c = p.court;
  const e = ENGAGEMENTS[kind];
  book(p, kind === "patron" ? `patron:${arg}` : kind.startsWith("tour") ? "tour" : kind, e.days);
  if (e.cost) p.bankBalance -= e.cost;
  const gaffe = rng.chance(gaffeChance(p));
  const sec = c.secretary >= 1 ? 1 : 0;
  let title = e.label;
  let body = "";
  let tone: Tone = "good";
  switch (kind) {
    case "hospital":
      addApproval(p, 2 + sec);
      changeStat(p, "karma", 1);
      changeStat(p, "happiness", 1);
      body = "You spent the afternoon on the wards, talking to patients and staff. The photographs were gentle.";
      break;
    case "walkabout": {
      if (gaffe) {
        addApproval(p, -4);
        addHeat(p, 8);
        body = `${rng.pick(GAFFES)} The clip circulated for days.`;
        tone = "bad";
      } else {
        const win = 1 + Math.round(p.skills.charisma / 40) + rng.int(0, 2);
        addApproval(p, win);
        body = "You worked the barriers for an hour and the crowd loved it.";
      }
      break;
    }
    case "remembrance": {
      addApproval(p, 3 + (c.service?.done || c.service?.deployments ? 2 : 0));
      p.nation.military = clamp(p.nation.military + 1);
      body = "You stood to attention while the nation fell silent. It was exactly what was needed.";
      break;
    }
    case "investiture":
      addApproval(p, 2);
      changeStat(p, "karma", 1);
      body = "You presented honours to nurses, teachers and sporting heroes, and found something kind to say to each.";
      break;
    case "banquet":
      addApproval(p, 2);
      addGovernment(p, 3);
      p.nation.economy = clamp(p.nation.economy + 1);
      body = "The state banquet went off without a hitch. Ministers noted the deals discussed over the soup.";
      break;
    case "patron": {
      const hold = c.patronages.find((x) => x.id === arg)!;
      const info_ = PATRONAGE_BY_ID[hold.id];
      const depth = Math.min(3, Math.floor(hold.years / 3));
      addApproval(p, info_.approval + depth);
      const k = info_.perk;
      changeStat(p, "happiness", k.happiness);
      changeStat(p, "karma", k.karma);
      changeStat(p, "fame", k.fame);
      changeStat(p, "health", k.health);
      if (k.respect) changeStat(p, "royalRespect", k.respect);
      if (k.military) p.nation.military = clamp(p.nation.military + k.military);
      title = `${info_.name}`;
      body = `You visited ${info_.name}${hold.years >= 3 ? `, a cause you have backed for ${hold.years} years` : ""}. ${info_.perkText}.`;
      break;
    }
    case "tour_realm":
    case "tour_state": {
      const realm = kind === "tour_realm" ? rng.pick(c.realmNames) : null;
      const chance = clamp(0.62 + p.skills.charisma / 400 + c.secretary * 0.07 + (c.approval - 50) / 300 + (p.talents.speaking - 50) / 500, 0.2, 0.92);
      const roll = rng.next();
      title = realm ? `Tour of ${realm}` : "State visit";
      if (roll < chance * 0.45) {
        addApproval(p, 7);
        changeStat(p, "fame", 2);
        if (realm) addRepublic(p, -3);
        else { p.nation.economy = clamp(p.nation.economy + 3); addGovernment(p, 3); }
        body = realm ? `Crowds lined the streets of ${realm}. The tour was a triumph, and talk of a republic quietened.` : "Trade deals were signed and the host president called the visit 'transformative'.";
      } else if (roll < chance) {
        addApproval(p, 3);
        body = "A competent, dignified tour. Nothing went wrong, which at this level is an achievement.";
      } else {
        addApproval(p, -5);
        addHeat(p, 10);
        if (realm) {
          addRepublic(p, 4);
          body = `Protesters in ${realm} demanded an apology for the colonial past, and the cameras caught your awkward reply.`;
        } else body = `${rng.pick(GAFFES)} It overshadowed the whole visit.`;
        tone = "bad";
      }
      if (kind === "tour_realm") c.booked.realmTour = 1;
      break;
    }
  }
  addLog(p, `${title}: ${body}`);
  return { player: p, notices: [info(title, body, tone)] };
}

// ---------------------------------------------------------------------------
// Patronages
// ---------------------------------------------------------------------------

export function maxPatronages(p: PlayerState): number {
  return isSovereign(p) ? 8 : p.royal?.hrh ? 6 : 3;
}

export function patronageBlocker(p: PlayerState, id: string): string | null {
  const c = p.court;
  if (!isRoyal(p)) return "Only working royals take patronages.";
  if (p.age < 16) return "Too young to be a patron.";
  if (c.disgraced || c.withdrawn > 0 || c.regency) return "You are not in public life right now.";
  if (c.patronages.some((x) => x.id === id)) return "You already back that cause.";
  if (c.patronages.length >= maxPatronages(p)) return `You can only back ${maxPatronages(p)} causes: drop one first.`;
  if (slotsLeft(p) < 1) return "Your diary is full: launching a patronage takes an engagement day.";
  return null;
}

export function adoptPatronage(p0: PlayerState, id: string): ActionResult {
  const why = patronageBlocker(p0, id);
  const cause = PATRONAGE_BY_ID[id];
  if (why || !cause) return refuse(p0, why ?? "Unknown cause.");
  const p = clone(p0);
  book(p, `launch:${id}`, 1);
  const body = addPatronage(p, id);
  return { player: p, notices: [info("New Patronage", body, "good")] };
}

/** Becomes patron of a cause (no checks). Also used by events. */
export function addPatronage(p: PlayerState, id: string): string {
  p.court.patronages.push({ id, years: 0, lastYear: p.year });
  addApproval(p, 1);
  const body = `You became patron of the ${PATRONAGE_BY_ID[id].name}. Visit them each year to deepen the bond; neglect them for three years and they will quietly move on.`;
  addLog(p, body);
  return body;
}

export function dropPatronage(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const hold = p.court.patronages.find((x) => x.id === id);
  if (!hold) return { player: p0 };
  p.court.patronages = p.court.patronages.filter((x) => x.id !== id);
  addApproval(p, hold.years >= 3 ? -3 : -1);
  const body = `You stepped down as patron of the ${PATRONAGE_BY_ID[id]?.name ?? id}${hold.years >= 3 ? " after years of service. The charity said it was 'disappointed'." : "."}`;
  addLog(p, body);
  return { player: p, notices: [info("Patronage Ended", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Military service
// ---------------------------------------------------------------------------

export function serviceBlocker(p: PlayerState): string | null {
  const c = p.court;
  if (!isRoyal(p)) return "Only serving royals can join up from here.";
  if (isSovereign(p)) return "A sovereign is the head of the armed forces, not a serving officer.";
  if (p.age < 18) return "You must be 18 to take a commission.";
  if (p.age > 35) return "Too old to begin officer training.";
  if (c.service) return c.service.done ? "You have completed your service." : "You are already serving.";
  if (c.regency || c.disgraced || c.withdrawn > 0) return "You are not in public life right now.";
  if (p.education.stage !== "None" && p.education.stage !== "Certificate") return "Finish your studies first.";
  return null;
}

/** Takes a commission (no checks). Also used by events. */
export function enlist(p: PlayerState, branch: ServiceBranch): string {
  p.court.service = { branch, years: 0, rank: 0, deployed: false, deployments: 0, done: false };
  addApproval(p, 3);
  changeStat(p, "royalRespect", 3);
  const body = `You entered officer training with the ${BRANCHES[branch].name}. Expect a punishing year and a posting afterwards; it eats into your diary.`;
  addLog(p, body);
  return body;
}

export function joinService(p0: PlayerState, branch: ServiceBranch): ActionResult {
  const why = serviceBlocker(p0);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  const body = enlist(p, branch);
  return { player: p, notices: [info("Commissioned", body, "good")] };
}

export function deploymentBlocker(p: PlayerState): string | null {
  const s = p.court.service;
  if (!s || s.done) return "You are not serving.";
  if (s.deployed) return "You are already deployed.";
  if (s.years < 2) return "Complete two years of service first.";
  if (s.deployments >= 2) return "You have done your share of operational tours.";
  return null;
}

export function requestDeployment(p0: PlayerState, rng: Rng): ActionResult {
  const why = deploymentBlocker(p0);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  const heir = p.royal?.line === 1;
  if (!rng.chance(heir ? 0.3 : 0.8)) {
    addApproval(p, -1);
    const body = heir ? "The Ministry of Defence refused: the risk to the heir to the throne is too great. You will serve on the home front." : "Your request was turned down for operational reasons.";
    addLog(p, body);
    return { player: p, notices: [info("Deployment Refused", body, "neutral")] };
  }
  p.court.service!.deployed = true;
  addApproval(p, 2);
  addHeat(p, 6);
  changeStat(p, "happiness", -3);
  const body = "You deploy with your unit. The press agree to stay quiet until you return. Your diary is almost empty while you are away, and the risk is real.";
  addLog(p, body);
  return { player: p, notices: [info("Deployed", body, "neutral")] };
}

export function leaveService(p0: PlayerState): ActionResult {
  const s = p0.court.service;
  if (!s || s.done) return { player: p0 };
  const p = clone(p0);
  p.court.service!.done = true;
  p.court.service!.deployed = false;
  addApproval(p, s.years >= 4 ? 2 : 0);
  const body = `You left the ${BRANCHES[s.branch].name} as a ${BRANCHES[s.branch].ranks[s.rank]} after ${s.years} year${s.years === 1 ? "" : "s"}.`;
  addLog(p, body);
  return { player: p, notices: [info("Service Ended", body, "neutral")] };
}

function processService(p: PlayerState, rng: Rng, notices: Notices) {
  const s = p.court.service;
  if (!s || s.done) return;
  s.years += 1;
  const b = BRANCHES[s.branch];
  if (s.rank < b.ranks.length - 1 && rng.chance(0.4)) {
    s.rank += 1;
    addLog(p, `You were promoted to ${b.ranks[s.rank]}.`);
  }
  if (p.health < 90) changeStat(p, "health", 1);
  changeStat(p, "royalRespect", 1);
  addApproval(p, 1);
  if (s.deployed) {
    const heir = p.royal?.line === 1;
    if (rng.chance(heir ? 0.004 : 0.01)) {
      killPlayer(p, "killed in action");
      notices.push(info("Killed in Action", "Your unit came under fire on an operational tour. The nation mourns.", "bad"));
      return;
    }
    if (rng.chance(0.09)) {
      changeStat(p, "health", -14);
      changeStat(p, "happiness", -5);
      notices.push(info("Wounded", "You were hurt on your tour and invalided home for treatment.", "bad"));
    }
    s.deployed = false;
    s.deployments += 1;
    addApproval(p, 8);
    changeStat(p, "royalRespect", 4);
    changeStat(p, "fame", 2);
    changeStat(p, "karma", 1);
    const body = "You came home from an operational tour to a hero's welcome. The public respects a royal who has served.";
    addLog(p, body);
    notices.push(info("Home from the Front", body, "good"));
  }
  if (s.years >= 8) {
    s.done = true;
    addLog(p, `Your commission ended after ${s.years} years.`);
  }
}

// ---------------------------------------------------------------------------
// The private office
// ---------------------------------------------------------------------------

export function secretaryBlocker(p: PlayerState, tier: number): string | null {
  if (!isRoyal(p)) return "No household for a private citizen.";
  if (tier === p.court.secretary) return "That's the team you have.";
  if (tier > p.court.secretary && p.bankBalance < SECRETARIES[tier].hire) return `Recruiting costs ${money(SECRETARIES[tier].hire)}.`;
  return null;
}

export function setSecretary(p0: PlayerState, rng: Rng, tier: number): ActionResult {
  const why = secretaryBlocker(p0, tier);
  if (why || !SECRETARIES[tier]) return refuse(p0, why ?? "No such team.");
  const p = clone(p0);
  const c = p.court;
  const prev = c.secretary;
  let body: string;
  if (tier > prev) {
    p.bankBalance -= SECRETARIES[tier].hire;
    body = `You built up your office: ${SECRETARIES[tier].name}, at ${money(SECRETARIES[tier].cost)} a year.`;
  } else {
    body = `You scaled your household back to: ${SECRETARIES[tier].name}.`;
    if (prev >= 2 && rng.chance(0.25)) {
      addHeat(p, 12);
      addApproval(p, -2);
      body += " A former aide, unhappy at the dismissal, spoke to a newspaper about life behind the scenes.";
    }
  }
  c.secretary = tier;
  addLog(p, body);
  return { player: p, notices: [info("Household", body, tier > prev ? "good" : "neutral")] };
}

// ---------------------------------------------------------------------------
// Scandals and the press office
// ---------------------------------------------------------------------------

export type ScandalAnswer = "statement" | "apologise" | "lawyers" | "silence" | "address" | "withdraw" | "leave";

function scandalEligible(p: PlayerState, s: ScandalTemplate): boolean {
  if (p.age < s.minAge) return false;
  if (s.need === "married" && getPartner(p)?.partnerStatus !== "married") return false;
  if (s.need === "sovereign" && !isSovereign(p)) return false;
  if (s.need === "notSovereign" && isSovereign(p)) return false;
  if (s.need === "serving" && !(p.court.service && !p.court.service.done)) return false;
  return true;
}

/** Yearly chance a new story breaks. */
export function scandalChance(p: PlayerState): number {
  const c = p.court;
  const vices = p.vices.alcohol > 50 || p.vices.gambling > 40 || p.vices.drugs > 30 ? 0.03 : 0;
  return clamp(0.03 + c.heat / 500 + Math.max(0, 50 - p.karma) / 600 + (p.fame > 50 ? 0.01 : 0) + vices - c.secretary * 0.008, 0.01, 0.2);
}

export function startScandal(p: PlayerState, rng: Rng, notices: Notices, forceId?: string): boolean {
  const c = p.court;
  if (c.scandal) return false;
  const pool = SCANDALS.filter((s) => (forceId ? s.id === forceId : scandalEligible(p, s)));
  const t = rng.weighted(pool, (s) => s.weight);
  if (!t) return false;
  c.scandal = { id: t.id, title: t.title, story: t.story, severity: t.severity, year: p.year };
  addHeat(p, 12);
  addLog(p, `Scandal: ${t.story}`);
  notices.push(info(`Scandal: ${t.title}`, t.story, "bad"));
  p.queuedEvents.push(isSovereign(p) || p.royal?.line === 1 ? "crown_scandal_core" : "crown_scandal_open");
  return true;
}

export function answerChance(p: PlayerState, how: ScandalAnswer, sev: number): number {
  const s = p.court.secretary;
  const k = (p.karma - 50) / 400;
  switch (how) {
    case "statement": return clamp(0.5 + s * 0.09 - (sev - 1) * 0.1 + k, 0.1, 0.95);
    case "apologise": return clamp(0.62 + s * 0.05 - (sev - 1) * 0.12 + k * 1.3, 0.1, 0.95);
    case "lawyers": return clamp(0.4 + s * 0.08 - sev * 0.05, 0.1, 0.9);
    case "silence": return sev === 1 ? 0.65 : sev === 2 ? 0.35 : 0.15;
    case "address": return clamp(0.6 + s * 0.05 - (sev - 1) * 0.1 + k, 0.1, 0.95);
    default: return 1;
  }
}

/** Leave royal life: lose the title in practice, the funding and the security; gain a private life. */
export function leaveRoyalLife(p: PlayerState) {
  p.royalRank = "none";
  if (p.royal) p.royal.hrh = false;
  p.court.steppedBack = true;
  p.court.patronages = [];
  p.court.withdrawn = 0;
  p.court.secretary = 0;
  p.specialCareerPath = p.music.signed ? "musician" : p.specialCareers.includes("actor") ? "actor" : "none";
}

/** Resolves the pending scandal. Returns a sentence describing how it went. */
export function resolveScandal(p: PlayerState, rng: Rng, how: ScandalAnswer): string {
  const c = p.court;
  const sc = c.scandal;
  if (!sc) return "";
  const sev = sc.severity;
  let out = "";
  if (how === "withdraw") {
    c.withdrawn = Math.max(1, sev);
    addApproval(p, -sev);
    addHeat(p, -15);
    changeStat(p, "happiness", -2);
    out = `You withdrew from public life for ${c.withdrawn} year${c.withdrawn === 1 ? "" : "s"}. The story faded, your diary emptied, and your allowance was halved.`;
  } else if (how === "leave") {
    leaveRoyalLife(p);
    addApproval(p, -sev * 2);
    addRepublic(p, sev);
    addHeat(p, 10);
    out = "You announced you were leaving royal life for good. You lose your allowance, your security and the use of your title, but you are free to work and live as you please.";
  } else {
    if (how === "lawyers") p.bankBalance -= sev * 120_000;
    if (how === "apologise") { changeStat(p, "happiness", -2); changeStat(p, "karma", 1); }
    const ok = rng.chance(answerChance(p, how, sev));
    if (ok) {
      addApproval(p, how === "address" ? 3 - sev : -Math.max(0, sev - 1));
      addHeat(p, -6);
      out = how === "silence" ? "Nobody could find a new angle, and the story died on its own." : how === "lawyers" ? "Your lawyers killed the story before it spread." : how === "apologise" ? "The apology sounded sincere, and the public forgave you." : how === "address" ? "Your broadcast struck the right note, and the country listened." : "The press office statement drew the sting. The story moved on in days.";
    } else {
      addApproval(p, -sev * 4);
      addRepublic(p, sev * 2.5);
      addHeat(p, how === "lawyers" ? 20 : 10);
      out = how === "lawyers" ? "The injunction leaked. The cover-up was a bigger story than the scandal." : how === "silence" ? "Silence read as guilt, and the papers filled it for you." : "It didn't land. The story ran for weeks.";
      if (sev === 3) {
        if (isSovereign(p) || p.royal?.line === 1) {
          addApproval(p, -8);
          addRepublic(p, 6);
          out += " Calls for you to go grew louder.";
        } else {
          c.disgraced = true;
          c.patronages = [];
          c.withdrawn = 0;
          if (p.royal) p.royal.hrh = false;
          changeStat(p, "royalRespect", -15);
          out += " The sovereign has stripped you of your patronages and public role. You no longer use your title, and your allowance is withdrawn.";
        }
      }
    }
  }
  addLog(p, `${sc.title}: ${out}`);
  c.scandal = null;
  return out;
}

export function answerScandal(p0: PlayerState, rng: Rng, how: ScandalAnswer): ActionResult {
  if (!p0.court.scandal) return { player: p0 };
  if ((how === "withdraw" || how === "leave") && (isSovereign(p0) || p0.royal?.line === 1)) return refuse(p0, "You can't walk away from the line of succession that way.");
  if (how === "lawyers" && p0.bankBalance < p0.court.scandal.severity * 120_000) return refuse(p0, `Lawyers cost ${money(p0.court.scandal.severity * 120_000)}.`);
  const p = clone(p0);
  const out = resolveScandal(p, rng, how);
  return { player: p, notices: [info("Press Office", out, out.includes("didn't") || out.includes("leaked") || out.includes("Silence") ? "bad" : "good")] };
}

export function stepBackBlocker(p: PlayerState): string | null {
  if (!isRoyal(p)) return "You are not a working royal.";
  if (isSovereign(p)) return "A sovereign cannot step back. Abdicating is the way out.";
  if (p.royal?.line === 1 && p.royal.crown !== "abdicated") return "You are the heir to the throne. The crown is not something you can step away from.";
  if (p.court.regency) return "You are a minor under a Regency.";
  return null;
}

/** Walk away from royal life like a "senior royal" who leaves: no funding, no security, no HRH in use, but a life of your own. */
export function stepBack(p0: PlayerState): ActionResult {
  const why = stepBackBlocker(p0);
  if (why) return refuse(p0, why);
  const p = clone(p0);
  leaveRoyalLife(p);
  addApproval(p, p.court.approval < 50 ? -4 : -8);
  addRepublic(p, 2);
  addHeat(p, 25);
  changeStat(p, "happiness", 4);
  for (const r of p.relatives) if (r.alive && r.relation === "Parent") r.relationshipBar = clamp(r.relationshipBar - 10);
  const body = "You announced you were stepping back as a working royal. The allowance, security detail and the use of HRH went with it, but you may now work, start a business and live as you please. The press will not stop watching.";
  addLog(p, body);
  return { player: p, notices: [info("Stepping Back", body, "neutral")] };
}

/** After leaving: sell your story (once). */
export function tellAll(p0: PlayerState, rng: Rng): ActionResult {
  if (!p0.court.steppedBack && !p0.court.disgraced) return refuse(p0, "Only a former working royal has a story to sell.");
  if (p0.flags.includes("royal_tell_all")) return refuse(p0, "You've already told your side of the story.");
  const p = clone(p0);
  const fee = rng.int(1_500_000, 4_000_000) * (1 + p.fame / 100);
  p.bankBalance += Math.round(fee);
  p.flags.push("royal_tell_all");
  changeStat(p, "fame", 8);
  changeStat(p, "happiness", 3);
  addApproval(p, -12);
  addRepublic(p, 4);
  for (const r of p.relatives) if (r.alive && (r.relation === "Parent" || r.relation === "Sibling")) r.relationshipBar = clamp(r.relationshipBar - 25);
  const body = `A television interview and a memoir paid ${money(Math.round(fee))}. The family reacted with a long, frosty silence.`;
  addLog(p, body);
  return { player: p, notices: [info("Telling Your Story", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Money: Sovereign Grant, duchy, estates, allowances
// ---------------------------------------------------------------------------

export interface Finance {
  /** Tax-free funding (Sovereign Grant or an allowance). */
  allowance: number;
  /** Taxable private income. */
  duchy: number;
  estate: number;
  /** Money out: private office and upkeep of private estates. */
  staff: number;
  upkeep: number;
  lines: Array<{ label: string; amount: number }>;
}

export function royalFinance(p: PlayerState): Finance {
  const c = p.court;
  const fin: Finance = { allowance: 0, duchy: 0, estate: 0, staff: SECRETARIES[c.secretary]?.cost ?? 0, upkeep: 0, lines: [] };
  const respectF = p.royalRespect < 20 ? 0.5 : 1;
  if (isSovereign(p)) {
    const a = c.approval;
    const approvalF = a >= 70 ? 1.15 : a >= 50 ? 1 : a >= 35 ? 0.85 : 0.65;
    const econF = p.economy.climate === "boom" ? 1.08 : p.economy.climate === "recession" ? 0.92 : 1;
    fin.allowance = Math.round(3_000_000 * approvalF * econF * (1 + c.grantAdj) * (c.slimmed ? 0.85 : 1) * respectF);
    fin.lines.push({ label: "Sovereign Grant (tax-free, funds official duties)", amount: fin.allowance });
    fin.duchy = 1_100_000;
    fin.lines.push({ label: "Duchy income (private, taxed)", amount: fin.duchy });
    fin.estate = 700_000 + (c.estateOpen ? 350_000 : 0);
    fin.upkeep = 250_000 + (c.estateOpen ? 80_000 : 0);
    fin.lines.push({ label: c.estateOpen ? "Private estate, open to visitors" : "Private estate rents", amount: fin.estate });
    fin.lines.push({ label: "Estate upkeep", amount: -fin.upkeep });
  } else if (p.age < 18) {
    fin.allowance = 100_000;
    fin.lines.push({ label: "Trust fund income", amount: fin.allowance });
  } else if (c.disgraced) {
    fin.lines.push({ label: "Funding withdrawn", amount: 0 });
  } else if (p.royal?.crown === "abdicated" || c.abdicated) {
    fin.allowance = Math.round(600_000 * respectF);
    fin.lines.push({ label: "Allowance from the new sovereign", amount: fin.allowance });
  } else {
    if (p.royal?.line === 1 && p.royal.crown !== "sibling") {
      fin.duchy = 2_000_000;
      fin.lines.push({ label: "Heir's duchy income (private, taxed)", amount: fin.duchy });
    }
    const work = c.slotsLast >= 3 ? 1 : c.slotsLast >= 1 ? 0.6 : 0.3;
    const base = fin.duchy > 0 ? 0 : 400_000;
    fin.allowance = Math.round(base * work * (c.withdrawn > 0 ? 0.5 : 1) * respectF);
    if (base) fin.lines.push({ label: `Privy purse allowance${work < 1 ? " (cut for light duties)" : ""}`, amount: fin.allowance });
  }
  if (fin.staff) fin.lines.push({ label: SECRETARIES[c.secretary].name, amount: -fin.staff });
  return fin;
}

export function toggleEstate(p0: PlayerState): ActionResult {
  if (!isSovereign(p0)) return refuse(p0, "Only the sovereign owns the private estates.");
  const p = clone(p0);
  p.court.estateOpen = !p.court.estateOpen;
  if (p.court.estateOpen) {
    addApproval(p, 3);
    addHeat(p, 4);
    changeStat(p, "happiness", -1);
  } else addApproval(p, -1);
  const body = p.court.estateOpen ? "The gates of your private estate opened to paying visitors. Income rises, the public are charmed, and your privacy suffers." : "You closed the estate to visitors again. Quiet returns.";
  addLog(p, body);
  return { player: p, notices: [info("Private Estate", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// The yearly turn
// ---------------------------------------------------------------------------

export function processCourt(p: PlayerState, rng: Rng, notices: Notices) {
  const c = p.court;
  const sov = isSovereign(p);
  const adult = p.age >= 18;

  // Roll the diary over.
  c.slotsLast = c.booked.slots ?? 0;
  const engaged = c.booked;
  c.booked = {};

  processService(p, rng, notices);
  if (!p.alive) return;

  // Patronages deepen with attention and lapse with neglect.
  for (const hold of [...c.patronages]) {
    if (engaged[`patron:${hold.id}`]) {
      hold.years += 1;
      hold.lastYear = p.year;
    } else if (p.year - hold.lastYear >= 3) {
      c.patronages = c.patronages.filter((x) => x !== hold);
      addApproval(p, -2);
      notices.push(info("Patronage Lapsed", `With no visits for three years, the ${PATRONAGE_BY_ID[hold.id]?.name ?? hold.id} quietly found another patron.`, "bad"));
    }
  }

  if (c.mourning > 0) c.mourning -= 1;
  if (c.withdrawn > 0) {
    c.withdrawn -= 1;
    if (c.withdrawn === 0) {
      addLog(p, "You returned to public life.");
      notices.push(info("Back in Public Life", "Your period out of the public eye is over. The diary opens up again.", "neutral"));
    }
  }
  if (c.regency && p.age >= 18) {
    addLog(p, `The Regency ended. At 18 you assume the full powers of the crown from ${c.regency}.`);
    notices.push(info("Regency Ends", `You turn 18 and take over the full duties of the crown from ${c.regency}.`, "good"));
    c.regency = null;
  }

  // Popularity
  if (c.scandal) {
    const s = c.scandal;
    addApproval(p, -s.severity * 4);
    addRepublic(p, s.severity * 2);
    addLog(p, `${s.title}: you let the story run, and it did damage.`);
    notices.push(info("Story Left to Run", `You never responded to "${s.title}", and the silence was read as arrogance.`, "bad"));
    c.scandal = null;
  }
  // A royal with a free diary who never turns up looks idle.
  const idle = adult && slotsFor(p) > 0 && c.slotsLast === 0 ? -6 : 0;
  const target = 52 + (p.karma - 50) / 5 + Math.min(12, c.slotsLast * 1.6) - c.heat / 8 + idle + c.secretary
    + (sov ? (c.government - 50) / 12 - c.strain / 10 + (p.nation.economy + p.nation.freedom - 100) / 20 : 0)
    + (c.service?.deployments ? 2 : 0);
  c.approval = clamp(Math.round(c.approval + (target - c.approval) * 0.2 + rng.int(-2, 2)));
  c.heat = clamp(Math.round(c.heat - 6 + (p.fame > 40 ? 2 : 0)), 3, 100);
  c.strain = clamp(c.strain - 6);
  const rTarget = 10 + Math.max(0, 65 - c.approval) * 1.6 + (sov ? 5 : 0) - (c.slimmed ? 8 : 0) + (c.coronated || !sov ? 0 : 4);
  c.republic = clamp(Math.round(c.republic + (rTarget - c.republic) * 0.2 + rng.int(-1, 1)));

  // Scandals
  if (adult && !c.scandal && c.withdrawn === 0 && rng.chance(scandalChance(p))) startScandal(p, rng, notices);

  if (sov && !c.regency) {
    // A new government now and then.
    if (!c.pm || rng.chance(0.2)) {
      const first = !c.pm;
      const gender = rng.pick(["Male", "Female"]);
      c.pm = `${gender === "Male" ? "Mr." : "Ms."} ${rng.pick(["Hartley", "Okafor", "Lindqvist", "Marlowe", "Vance", "Desai", "Whitcombe", "Moreau", "Tanaka", "Brennan"])}`;
      c.government = clamp(c.government + rng.int(-14, 10), 15, 90);
      if (!first) notices.push(info("New Government", `${c.pm} has won the election and been appointed Prime Minister. Your weekly audiences will be with them from now on.`, "neutral"));
    }
    // Realms that share your crown may drift away.
    if (c.realmNames.length > 0) {
      const odds = clamp((55 - c.approval) / 500 + c.republic / 1500, 0, 0.12) * (engaged.realmTour ? 0.5 : 1);
      if (rng.chance(odds)) {
        const leaving = rng.pick(c.realmNames);
        c.realmNames = c.realmNames.filter((x) => x !== leaving);
        addApproval(p, -3);
        addRepublic(p, 2);
        const body = `${leaving} has voted to become a republic and remove you as head of state. ${c.realmNames.length} realm${c.realmNames.length === 1 ? "" : "s"} remain.`;
        addLog(p, body);
        notices.push(info(`${leaving} Leaves the Crown`, body, "bad"));
      }
    }
    if (c.strain >= 70 && !p.queuedEvents.includes("crown_constitutional_crisis")) p.queuedEvents.push("crown_constitutional_crisis");
  }
  // A republican tide can force a vote.
  if (c.republic >= 65 && p.year - c.lastReferendum >= 10 && rng.chance(0.3) && !p.queuedEvents.includes("crown_referendum")) {
    c.lastReferendum = p.year;
    p.queuedEvents.push("crown_referendum");
  }

  processRoyalFamily(p, rng, notices);
}
