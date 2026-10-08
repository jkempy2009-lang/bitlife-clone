/**
 * Screen and runway. The `actor` career line stays the income backbone (a retainer that rises and
 * falls with your fortunes); on top of it sit an agent and manager, film / television / theatre
 * offers, staged auditions with call-backs, typecasting, press and box-office results, awards season,
 * franchises, scandals, studio contracts and producing / directing. See actingActions.ts for the
 * player's one-off choices and actingYear.ts for series, residuals and prizes.
 */
import type { ActionResult, ActingState, Agent, AgentKind, FilmCredit, FilmOffer, PendingFilm, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone, getPartner } from "./state";
import { promoteJob } from "./career";
import { info, logEvent, payout, trained, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";
import { PART_TIME_FACTOR, isStudyingFullTime } from "./occupation";
import {
  AGENT_FIRST, AGENT_LAST, FILM_GENRES, MEDIUM_LABEL, NETWORKS, STUDIOS, ageLooksFactor, buildOffer, cutsFor, isActor, isModel, makeTitle, roleFor,
} from "./actingShared";
import { processAwards, processFranchise, processResiduals, processSeries } from "./actingYear";

export { FILM_GENRES, ageLooksFactor, isActor, isModel };
export const FAMOUS_FAME = 30;

export const PRODUCE_TIERS = [
  { id: "indie", label: "Indie feature", cost: 300_000, blurb: "A small film made with friends and favours." },
  { id: "studio", label: "Studio picture", cost: 4_000_000, blurb: "A proper release with a marketing push." },
  { id: "tentpole", label: "Tentpole blockbuster", cost: 30_000_000, blurb: "Win big or lose a fortune." },
] as const;
export type ProduceTier = (typeof PRODUCE_TIERS)[number]["id"];

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

/** Genre you're being typecast in: three of your last five roles. */
export function typecastFrom(credits: FilmCredit[]): string | null {
  const recent = credits.filter((c) => c.role !== "producer" && c.role !== "director").slice(-5);
  const counts: Record<string, number> = {};
  for (const c of recent) counts[c.genre] = (counts[c.genre] ?? 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 3 ? best[0] : null;
}

export function actingTier(p: PlayerState): string {
  const job = p.currentJob;
  if (!job || (job.lineId !== "actor" && job.lineId !== "model")) return p.acting.credits.length > 0 ? "Former performer" : "Not in the business";
  return job.title;
}

export function auditionChance(p: PlayerState, genre: string): number {
  const job = p.currentJob;
  const a = p.acting;
  if (!job) return 0;
  let c =
    0.0 + 0.3 * (p.skills.acting / 100) + 0.12 * (p.looks / 100) * ageLooksFactor(p) + 0.1 * (job.performance / 100) +
    (a.agent ? a.agent.skill / 1000 : 0) + (a.manager ? a.manager.skill / 2000 : 0) + a.reputation * 0.0015 - job.tier * 0.06;
  if (a.typecast) c += a.typecast === genre ? 0.12 : -0.1;
  // A long run of rejections wears down your nerve.
  c -= 0.02 * Math.min(4, Math.max(0, a.rejections - 2));
  return clamp(c, 0.03, 0.85);
}

export const auditionLimit = (p: PlayerState) => (p.acting.agent && p.acting.reputation >= 50 ? 2 : 1);

export function auditionBlocker(p: PlayerState): string | null {
  const job = p.currentJob;
  if (!job || job.lineId !== "actor") return "You need an acting job first.";
  if (job.tier >= 3) return "You're already at the very top.";
  if (p.acting.pendingFilm) return "You're already committed to a film this year.";
  if (p.acting.series) return "Your series contract is exclusive. You can't audition for features.";
  if (p.acting.franchise) return "Your franchise contract covers your film work.";
  if (p.acting.callback) return "You already have a call-back waiting. Attend it first.";
  if (job.tier >= 1 && !p.acting.agent) return "Studios won't see unrepresented leads. Hire an agent first.";
  if (job.tier === 1 && p.acting.reputation < 35) return "Casting directors don't see you as a lead yet (industry reputation 35+).";
  if (job.tier === 2 && (p.acting.reputation < 60 || p.acting.pull < 40)) return "Studios won't bet a franchise on you yet (reputation 60+ and box-office pull 40+).";
  if ((p.annual.audition ?? 0) >= auditionLimit(p)) return "You've used up your auditions this year.";
  return null;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const AGENT_KINDS: Record<AgentKind, { label: string; cut: number; blurb: string }> = {
  boutique: { label: "Boutique agent", cut: 0.08, blurb: "Takes anyone with promise, works hard for few clients, 8% cut. Small black book." },
  mid: { label: "Established agency", cut: 0.1, blurb: "Solid contacts, standard 10% cut." },
  major: { label: "Major agency", cut: 0.12, blurb: "Everyone takes their calls, 12% cut. They drop clients who go quiet." },
};

export function agentBlocker(p: PlayerState, kind: AgentKind): string | null {
  const a = p.acting;
  if (!isActor(p) && !isModel(p)) return "Agents represent working performers. Get a job in acting or modelling first.";
  if (a.agent) return "You already have an agent.";
  if (kind === "major" && (a.reputation < 55 || (p.currentJob?.tier ?? 0) < 1 || p.fame < 25)) return "A major agency wants a name: reputation 55+, fame 25+ and a supporting role or better.";
  return null;
}

export function hireAgent(p0: PlayerState, rng: Rng, kind: AgentKind = "mid"): ActionResult {
  const p = clone(p0);
  if (!isActor(p) && !isModel(p)) return { player: p0, notices: [info("No Career Yet", "Agents represent working performers. Get a job in acting or modelling first.")] };
  if (p.acting.agent) return { player: p0 };
  const blocked = agentBlocker(p, kind);
  if (blocked) return { player: p0, notices: [info("Not Yet", blocked, "bad")] };
  const unknown = p.acting.reputation < 15 && p.fame < 10 && (p.currentJob?.tier ?? 0) === 0;
  if (unknown && !rng.chance(kind === "boutique" ? 0.8 : 0.5)) return { player: p0, notices: [info("No Takers", "Nobody wants to represent a total unknown. Build a few credits or try again next year.", "bad")] };
  const base = kind === "boutique" ? rng.int(25, 60) : kind === "mid" ? rng.int(35, 72) : rng.int(62, 92);
  const skill = clamp(Math.round(base + p.acting.reputation / 6));
  const info0 = AGENT_KINDS[kind];
  const agent: Agent = { name: `${rng.pick(AGENT_FIRST)} ${rng.pick(AGENT_LAST)}`, cut: info0.cut, skill, yearsWith: 0, kind, trust: kind === "boutique" ? 70 : kind === "mid" ? 60 : 45 };
  p.acting.agent = agent;
  const body = `${agent.name} of a ${kind === "major" ? "major agency" : kind === "mid" ? "respected agency" : "small boutique"} agreed to represent you for ${Math.round(agent.cut * 100)}% of your fees. They seem ${skill >= 65 ? "very well connected" : skill >= 45 ? "reasonably connected" : "enthusiastic, mostly"}.`;
  addLog(p, body);
  return { player: p, notices: [info("Agent Signed", body, "good")] };
}

export function fireAgent(p0: PlayerState, rng?: Rng): ActionResult {
  const p = clone(p0);
  if (!p.acting.agent) return { player: p0 };
  let body = `You parted ways with ${p.acting.agent.name}. Without representation you'll see fewer offers and no lead roles.`;
  // A jilted agent talks. High-trust agents are the ones who feel betrayed.
  if (rng && p.acting.agent.trust >= 60 && rng.chance(0.3)) {
    p.acting.reputation = clamp(p.acting.reputation - 3);
    body += " They are telling people at lunch that you are difficult to work with.";
  }
  p.acting.agent = null;
  addLog(p, body);
  return { player: p, notices: [info("Agent Dropped", body)] };
}

export function managerBlocker(p: PlayerState): string | null {
  if (!isActor(p) && !isModel(p)) return "Managers guide working performers.";
  if (p.acting.manager) return "You already have a manager.";
  if (p.acting.reputation < 25 && p.fame < 15) return "Managers don't take unknowns (reputation 25+ or fame 15+).";
  return null;
}

export function hireManager(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const blocked = managerBlocker(p);
  if (blocked) return { player: p0, notices: [info("Not Yet", blocked, "bad")] };
  const skill = clamp(Math.round(rng.int(35, 85) + p.acting.reputation / 10));
  p.acting.manager = { name: `${rng.pick(AGENT_FIRST)} ${rng.pick(AGENT_LAST)}`, cut: 0.12, skill, yearsWith: 0 };
  const body = `${p.acting.manager.name} became your personal manager for 12% on top of your agent's cut. Expect better scripts, calmer crises and a thinner pay cheque.`;
  addLog(p, body);
  return { player: p, notices: [info("Manager Hired", body, "good")] };
}

export function fireManager(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.acting.manager) return { player: p0 };
  const body = `You let your manager ${p.acting.manager.name} go.`;
  p.acting.manager = null;
  addLog(p, body);
  return { player: p, notices: [info("Manager Dropped", body)] };
}

// ---------------------------------------------------------------------------
// Offers, auditions and contracts
// ---------------------------------------------------------------------------

export function acceptOffer(p0: PlayerState, rng: Rng, id: string, haggle = false): ActionResult {
  const p = clone(p0);
  const a = p.acting;
  const offer = a.offers.find((o) => o.id === id);
  if (!offer || !isActor(p)) return { player: p0 };
  const medium = offer.medium ?? "film";
  if (a.pendingFilm) return { player: p0, notices: [info("Booked", "You can only make one film at a time.")] };
  if (a.studioDeal) return { player: p0, notices: [info("Exclusive", "Your studio deal covers your film work.", "bad")] };
  if (a.franchise) return { player: p0, notices: [info("Exclusive", "Your franchise contract covers your film work.", "bad")] };
  if (a.series) return { player: p0, notices: [info("Exclusive", "Your series contract is exclusive. Finish or leave the show first.", "bad")] };
  let fee = offer.fee;
  let extra = "";
  if (haggle) {
    if ((p.annual[`haggle:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Already Pushed", "They won't move again.")] };
    p.annual[`haggle:${id}`] = 1;
    const skill = clamp(0.35 + ((a.agent?.skill ?? 0) + (a.manager?.skill ?? 0) * 0.5) / 250 + a.reputation / 400, 0.2, 0.8);
    if (rng.chance(skill)) {
      fee = Math.round(fee * 1.25);
      extra = ` You negotiated the fee up to ${money(fee)}.`;
    } else if (rng.chance(0.35)) {
      a.offers = a.offers.filter((o) => o.id !== id);
      const body = `The producers thanked you and called the next name on their list. "${offer.title}" is gone.`;
      addLog(p, body);
      return { player: p, notices: [info("Offer Withdrawn", body, "bad")] };
    } else {
      return { player: p, notices: [info("No Movement", "They won't pay more, but the original offer stands.")] };
    }
  }
  a.offers = [];
  const part = offer.role === "lead" ? "the lead" : offer.role === "supporting" ? "a supporting actor" : "a small part";
  if (medium === "tv") {
    a.series = {
      title: offer.title, genre: offer.genre, network: rng.pick(NETWORKS), status: "pilot", season: 0, yearsLeft: offer.seasons ?? 3, fee,
      ratings: 50, script: offer.script, prestige: offer.prestige, role: offer.role, critics: 0,
    };
    const body = `You signed on as ${part} in the pilot of "${offer.title}" (${offer.genre}) for ${money(fee)} a season, with ${a.series.yearsLeft} seasons guaranteed if it is picked up. Until the network decides, you can't take other features.${extra}`;
    addLog(p, body);
    return { player: p, notices: [info("Pilot Booked", body, "good")] };
  }
  a.pendingFilm = { ...offer, fee };
  const body = `You signed on as ${part} in the ${medium === "stage" ? "stage production" : "film"} "${offer.title}" (${offer.genre}, ${money(offer.budget)} budget) for ${money(fee)}.${extra} It opens when you age up.`;
  addLog(p, body);
  return { player: p, notices: [info("Cast!", body, "good")] };
}

export function declineOffer(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  p.acting.offers = p.acting.offers.filter((o) => o.id !== id);
  return { player: p, notices: [info("Passed", "You turned the role down. The studio will find someone else.")] };
}

/** Landing the bigger part: a promotion and a film to shoot this year. Mutates p. */
function winRole(p: PlayerState, rng: Rng, genre: string, notices: Notices) {
  const a = p.acting;
  const wasType = a.typecast;
  const streak = a.rejections;
  a.rejections = 0;
  a.callback = null;
  promoteJob(p);
  const j = p.currentJob!;
  const role: FilmOffer["role"] = j.tier >= 2 ? "lead" : "supporting";
  const offer = buildOffer(p, rng, role, genre);
  a.pendingFilm = offer;
  a.reputation = clamp(a.reputation + 4);
  const fameGain = rng.int(8, 15);
  changeStat(p, "fame", fameGain);
  changeStat(p, "happiness", 12 + (streak >= 3 ? 6 : 0));
  let body = `You nailed the ${genre.toLowerCase()} audition and landed a bigger role: ${j.title}, starring in "${offer.title}"! Fame +${fameGain}.`;
  if (streak >= 3) body += ` After ${streak} rejections in a row, it tastes sweeter.`;
  if (wasType && genre !== wasType) {
    a.critics = clamp(a.critics + 6);
    body += ` Breaking out of your ${wasType.toLowerCase()} typecasting impressed critics.`;
  }
  logEvent(p, notices, "You Got the Part!", body, "good");
}

function rejected(p: PlayerState, notices: Notices, body: string) {
  const a = p.acting;
  a.rejections += 1;
  a.callback = null;
  changeStat(p, "happiness", -(2 + Math.min(a.rejections, 4)));
  if (a.rejections >= 5) a.reputation = clamp(a.reputation - 1);
  logEvent(p, notices, "No Callback", `${body}${a.rejections >= 3 ? ` That is ${a.rejections} rejections in a row. It is getting to you.` : ""}`, "bad");
}

/**
 * Audition for a bigger role. The first read either ends in a polite no or a call-back; the call-back
 * is a second chance you prepare for (see attendCallback). Success earns a promotion and a film.
 */
export function auditionForLead(p0: PlayerState, rng: Rng, genre: string = "Drama"): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "actor") return { player: p0 };
  if (job.tier >= 3) return { player: p0 };
  const blocked = auditionBlocker(p);
  if (blocked) {
    const exhausted = (p.annual.audition ?? 0) >= auditionLimit(p);
    return { player: p0, notices: [info(exhausted ? "Already Auditioned" : "Can't Audition", exhausted ? "Casting directors need time to forget your face. Try next year." : blocked, exhausted ? "neutral" : "bad")] };
  }
  p.annual.audition = (p.annual.audition ?? 0) + 1;
  const a = p.acting;
  const chance = auditionChance(p, genre);
  const first = clamp(chance * 1.6 + 0.06, 0.1, 0.92);
  const notices: Notices = [];
  if (!rng.chance(first)) {
    rejected(p, notices, `The casting director said, "Thanks, we'll call you." (${Math.round(chance * 100)}% odds for ${genre.toLowerCase()}.) They won't.`);
    return { player: p, notices };
  }
  a.callback = { genre, odds: clamp(chance / first, 0.15, 0.95) };
  const body = `The ${genre.toLowerCase()} audition went well enough for a call-back. The producers want to see you again. How you prepare is up to you.`;
  logEvent(p, notices, "Call-back!", body, "good");
  return { player: p, notices };
}

export type CallbackPrep = "wing" | "rehearse" | "coach";
export const COACH_COST = 5_000;

export function attendCallback(p0: PlayerState, rng: Rng, prep: CallbackPrep): ActionResult {
  const p = clone(p0);
  const a = p.acting;
  const cb = a.callback;
  if (!cb || !isActor(p)) return { player: p0 };
  let odds = cb.odds;
  if (prep === "coach") {
    if (p.bankBalance < COACH_COST) return { player: p0, notices: [info("Can't Afford It", `A coaching session costs ${money(COACH_COST)}.`, "bad")] };
    p.bankBalance -= COACH_COST;
    odds += 0.15;
  } else if (prep === "rehearse") {
    odds += 0.08;
    changeStat(p, "happiness", -2);
  }
  const notices: Notices = [];
  if (rng.chance(clamp(odds, 0.05, 0.97))) {
    winRole(p, rng, cb.genre, notices);
  } else {
    rejected(p, notices, `You gave the ${cb.genre.toLowerCase()} call-back everything${prep === "wing" ? " you could without preparing" : ""}, but they went with someone else. (${Math.round(clamp(odds, 0.05, 0.97) * 100)}% odds.)`);
  }
  return { player: p, notices };
}

export function signStudioDeal(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const a = p.acting;
  const job = p.currentJob;
  if (!job || job.lineId !== "actor" || job.tier < 1) return { player: p0, notices: [info("Not Yet", "Studios sign supporting actors and above to multi-picture deals.")] };
  if (a.studioDeal) return { player: p0 };
  if (a.series) return { player: p0, notices: [info("Exclusive", "Your series contract is exclusive. A studio can't sign you.", "bad")] };
  if (a.franchise) return { player: p0, notices: [info("Exclusive", "Your franchise contract already covers your film work.", "bad")] };
  if (a.reputation < 30) return { player: p0, notices: [info("Not Yet", "Your reputation (30+) isn't strong enough for a studio to commit.")] };
  if (a.pendingFilm) return { player: p0, notices: [info("Booked", "Finish the film you're making first.")] };
  const genre = a.typecast ?? rng.pick(FILM_GENRES);
  a.studioDeal = { studio: rng.pick(STUDIOS), yearsLeft: 3, fee: Math.round(job.salary * 0.5), genre };
  const body = `${a.studioDeal.studio} signed you to a three-picture deal: one ${genre.toLowerCase()} film a year at ${money(a.studioDeal.fee)} each. Steady money, but they choose the roles and the genre.`;
  addLog(p, body);
  return { player: p, notices: [info("Studio Deal", body, "good")] };
}

export function buyOutStudioDeal(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const d = p.acting.studioDeal;
  if (!d) return { player: p0 };
  const cost = Math.round(d.fee * d.yearsLeft * 0.5);
  if (p.bankBalance < cost) return { player: p0, notices: [info("Can't Afford It", `Buying out the contract costs ${money(cost)}.`, "bad")] };
  p.bankBalance -= cost;
  p.acting.studioDeal = null;
  const body = `You paid ${money(cost)} to walk away from ${d.studio}.`;
  addLog(p, body);
  return { player: p, notices: [info("Bought Out", body)] };
}

export function produceBlocker(p: PlayerState, tier: ProduceTier, directing: boolean): string | null {
  const a = p.acting;
  const t = PRODUCE_TIERS.find((x) => x.id === tier)!;
  if (p.age < 25) return "You're too young for the producer's chair.";
  if (a.pendingFilm) return "You're already committed to a film this year.";
  if (a.credits.length < (directing ? 5 : 3)) return `You need ${directing ? 5 : 3}+ screen credits first.`;
  if (p.fame < 30) return "Financiers want a name (30+ Fame).";
  if (directing && a.critics < 50) return "Directing needs critical credibility (50+).";
  if (p.bankBalance < t.cost) return `You'd have to put up ${money(t.cost)} of your own.`;
  return null;
}

export function produceFilm(p0: PlayerState, rng: Rng, tier: ProduceTier, directing = false): ActionResult {
  const p = clone(p0);
  const blocked = produceBlocker(p, tier, directing);
  if (blocked) return { player: p0, notices: [info("Can't Greenlight", blocked, "bad")] };
  const t = PRODUCE_TIERS.find((x) => x.id === tier)!;
  const a = p.acting;
  p.bankBalance -= t.cost;
  const film: PendingFilm = {
    id: rng.id(),
    title: makeTitle(rng),
    genre: tier === "indie" ? "Indie" : rng.pick(FILM_GENRES),
    role: directing ? "director" : "producer",
    fee: 0,
    budget: t.cost,
    script: clamp(Math.round(40 + a.reputation * 0.3 + (directing ? p.smarts * 0.1 : 0) + rng.int(-15, 25))),
    prestige: rng.int(30, 90),
    invested: t.cost,
    medium: "film",
  };
  a.pendingFilm = film;
  const body = `You put ${money(t.cost)} of your own money into "${film.title}" (${t.label.toLowerCase()})${directing ? " and took the director's chair" : ""}. A marketing push before it opens could help. You'll know how it did when you age up.`;
  addLog(p, body);
  return { player: p, notices: [info("Film Greenlit", body, "good")] };
}

/** One-off modelling job. Quick money, a little exposure. */
export function bookCampaign(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "model") return { player: p0, notices: [info("Not a Model", "You need a modelling job.")] };
  if ((p.annual.campaign ?? 0) >= 1) return { player: p0, notices: [info("Booked Out", "You've already shot a campaign this year.")] };
  p.annual.campaign = 1;
  const a = p.acting;
  const gross = Math.round(job.salary * rng.float(0.15, 0.35) * ageLooksFactor(p) * (a.agent ? 1 + a.agent.skill / 300 : 1));
  const cuts = cutsFor(p, gross);
  const net = payout(p, gross - cuts.total);
  a.modelBookings += 1;
  changeStat(p, "fame", rng.int(1, 2));
  changeStat(p, "happiness", 2);
  const notices: Notices = [];
  const body = `You shot a campaign for ${money(gross)}${cuts.total ? ` (${money(cuts.total)} to your representation)` : ""}. ${money(net)} after withholding.`;
  addLog(p, body);
  notices.push(info("Campaign Shot", body, "good"));
  if (rng.chance(0.05)) raiseScandal(p, "acting", rng, notices, 1);
  return { player: p, notices };
}

export function shootCommercial(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.fame < FAMOUS_FAME) return { player: p0 };
  if ((p.annual.commercial ?? 0) >= 1) {
    return { player: p0, notices: [info("Over-exposed", "You've already shot a commercial this year.")] };
  }
  p.annual.commercial = 1;
  const fee = 20_000 + p.fame * 1_000;
  const cuts = cutsFor(p, fee);
  p.bankBalance += fee - cuts.total;
  changeStat(p, "fame", 5);
  const body = `You shot a commercial for a luxury brand. +${money(fee - cuts.total)}${cuts.total ? ` (after your representation's ${money(cuts.total)})` : ""}, +5 Fame.`;
  addLog(p, body);
  return { player: p, notices: [info("Commercial Shoot", body, "good")] };
}

export function writeMemoir(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.fame < FAMOUS_FAME) return { player: p0 };
  if ((p.annual.memoir ?? 0) >= 1) {
    return { player: p0, notices: [info("Writer's Cramp", "You've already written a memoir this year.")] };
  }
  p.annual.memoir = 1;
  const payoutAmount = Math.round(p.fame * 25_000 * rng.float(0.8, 1.2));
  p.bankBalance += payoutAmount;
  changeStat(p, "happiness", 4);
  const body = `Your memoir became a bestseller. The publisher paid you ${money(payoutAmount)}.`;
  addLog(p, body);
  return { player: p, notices: [info("Memoir Published", body, "good")] };
}

// ---------------------------------------------------------------------------
// Yearly tick
// ---------------------------------------------------------------------------

function demote(p: PlayerState, why: string, notices: Notices) {
  const j = p.currentJob;
  if (!j) return;
  const line = CAREER_BY_ID[j.lineId];
  if (!line || j.tier <= 0) return;
  j.tier -= 1;
  j.title = line.ladder[j.tier].title;
  j.salary = Math.max(line.ladder[j.tier].salary, Math.round(j.salary * 0.6));
  p.annualSalary = j.salary;
  logEvent(p, notices, "Demoted by the Industry", `${why} You're now billed as a ${j.title}.`, "bad");
}

interface Release {
  fees: number;
  bonuses: number;
  revenue: number;
  outcome: FilmCredit["outcome"] | null;
}

function releaseFilm(p: PlayerState, rng: Rng, notices: Notices): Release {
  const a = p.acting;
  const f = a.pendingFilm;
  if (!f) return { fees: 0, bonuses: 0, revenue: 0, outcome: null };
  a.pendingFilm = null;
  const job = p.currentJob;
  const medium = f.medium ?? "film";
  const stage = medium === "stage";
  const behind = f.role === "producer" || f.role === "director";
  const star = clamp(0.5 * a.pull + 0.3 * a.reputation + 0.2 * p.fame);
  const effortBonus = p.effort === "grind" ? 6 : p.effort === "coast" ? -8 : 0;
  const prep = a.prepBonus;
  a.prepBonus = 0;
  const perf = clamp(0.55 * p.skills.acting + 0.25 * (job?.performance ?? 55) + 0.2 * p.smarts + effortBonus + prep + (f.method ? 9 : 0));
  const directorBonus = f.role === "director" ? (a.critics - 50) * 0.15 + (p.smarts - 50) * 0.1 : 0;
  // Range pays off: critics notice an actor who has not played the same note for years.
  const recentGenres = new Set(a.credits.slice(-6).map((c) => c.genre));
  const rangeBonus = recentGenres.size >= 4 ? 3 : a.typecast ? -2 : 0;
  const critics = clamp(Math.round(0.42 * f.script + 0.38 * perf + 0.1 * f.prestige + directorBonus + rangeBonus + (stage ? 4 : 0) + rng.int(-12, 12)));
  const promo = f.promo ?? 0;
  const installment = f.installment ?? 1;
  const brand = installment > 1 ? 12 - 4 * (installment - 2) : 0;
  const marketing = stage ? 0 : clamp((Math.log10(Math.max(1, f.budget)) - 5.5) * 8, -10, 16);
  const audience = clamp(
    (stage ? 0.3 : 0.25) * f.script + (stage ? 0.2 : 0.35) * star + marketing + 14 + promo * 0.6 + brand + (a.typecast === f.genre ? 4 : 0) + rng.int(-26, 26),
  );
  let mult = stage
    ? audience < 30 ? rng.float(0.3, 0.9) : audience < 50 ? rng.float(0.9, 1.6) : audience < 70 ? rng.float(1.6, 2.6) : rng.float(2.6, 4.5)
    : audience < 30 ? rng.float(0.15, 0.7)
    : audience < 50 ? rng.float(0.7, 1.5)
    : audience < 68 ? rng.float(1.5, 3.2)
    : audience < 82 ? rng.float(3.2, 6)
    : rng.float(6, 12);
  let sleeper = false;
  if (!stage && f.budget < 8_000_000 && audience >= 60 && rng.chance(0.4)) {
    mult *= 1.8;
    sleeper = true;
  }
  const boxOffice = Math.round(f.budget * mult);
  const outcome: FilmCredit["outcome"] = mult < 1 ? "flop" : mult < 2.2 ? "modest" : mult < 4 ? "hit" : "blockbuster";
  const credit: FilmCredit = { id: f.id, title: f.title, year: p.year, genre: f.genre, role: f.role, budget: f.budget, boxOffice, critics, outcome, medium };
  if (sleeper) credit.sleeper = true;
  if (installment > 1) credit.installment = installment;
  const lead = f.role === "lead" || behind;
  const soft = stage ? 0.3 : 1;

  // Industry standing
  const rep = { flop: lead ? -7 : -4, modest: 1, hit: 4, blockbuster: 7 }[outcome];
  const pull = Math.round({ flop: lead ? -5 : -3, modest: 1, hit: 5, blockbuster: 9 }[outcome] * soft);
  a.reputation = clamp(a.reputation + rep + (critics >= 75 ? 3 : critics < 30 ? -2 : 0));
  a.pull = clamp(a.pull + pull);
  a.critics = clamp(Math.round(a.critics * (stage ? 0.6 : 0.7) + critics * (stage ? 0.4 : 0.3)));
  if (outcome === "blockbuster" && !stage) changeStat(p, "fame", 4);
  if (job && job.lineId === "actor" && !stage) {
    const line = CAREER_BY_ID.actor;
    const factor = { flop: 0.92, modest: 1, hit: 1.1, blockbuster: 1.25 }[outcome];
    job.salary = Math.max(Math.round(line.ladder[job.tier].salary * 0.5), Math.round(job.salary * factor));
    p.annualSalary = job.salary;
  }

  // Money
  let fees = 0;
  let bonuses = 0;
  let revenue = 0;
  if (behind) {
    revenue = Math.round(boxOffice * 0.45);
  } else {
    fees = f.fee;
    if (!stage && job && job.tier >= 2 && (outcome === "hit" || outcome === "blockbuster")) bonuses = Math.round(boxOffice * 0.008 * (a.pull / 100 + 0.3));
    // Repeat fees on a successful picture.
    if (!stage && (outcome === "hit" || outcome === "blockbuster") && fees > 0) {
      a.residuals.push({ title: f.title, amount: Math.round(fees * (outcome === "blockbuster" ? 0.12 : 0.06)), yearsLeft: 4 });
    }
  }

  // Method acting takes its toll.
  if (f.method && !behind) {
    const risk = clamp(0.2 - (p.talents.discipline - 50) / 300 + (p.health < 50 ? 0.1 : 0), 0.05, 0.4);
    if (rng.chance(risk)) {
      changeStat(p, "health", -8);
      changeStat(p, "happiness", -10);
      const partner = getPartner(p);
      if (partner) partner.relationshipBar = clamp(partner.relationshipBar - 8);
      logEvent(p, notices, "The Part Stayed With You", "Weeks after wrapping you were still answering to your character's name. Friends staged an intervention and your partner barely recognised you.", "bad");
      if (rng.chance(0.4)) raiseScandal(p, "acting", rng, notices, 1, "you walked off set mid-scene, still in character, and the crew are talking");
    }
  }

  // Comeback arc
  if (f.comeback) {
    if (critics >= 68) {
      a.reputation = clamp(a.reputation + 10);
      a.pull = clamp(a.pull + 8);
      changeStat(p, "fame", 6);
      changeStat(p, "happiness", 10);
      if (job && job.lineId === "actor") {
        job.salary = Math.round(job.salary * 1.25);
        p.annualSalary = job.salary;
      }
      logEvent(p, notices, "The Comeback", `"${f.title}" brought you back. Critics are calling it the return of the decade and the phone is ringing again.`, "jackpot");
    } else if (critics < 45) {
      a.reputation = clamp(a.reputation - 3);
      logEvent(p, notices, "A Quiet Return", `"${f.title}" did not land. The industry is not ready to forgive the gap.`, "bad");
    }
  }

  // Awards: contenders go to the ceremony next year, where a campaign can make the difference.
  if (critics >= 65) {
    a.awardsRun = {
      filmId: f.id, title: f.title, genre: f.genre, role: f.role, critics, prestige: f.prestige,
      indie: f.genre === "Indie" || f.budget < 6_000_000, medium, campaign: "quiet", spent: 0,
    };
    notices.push(info("Awards Buzz", `"${f.title}" is being talked about as a contender (critics ${critics}). Decide how hard to campaign before next year's ceremony.`, "good"));
  }
  if (!behind && !stage) p.skills.acting = clamp(p.skills.acting + trained(p, "acting", p.skills.acting, p.effort === "grind" ? 4 : p.effort === "steady" ? 3 : 1));
  if (stage) p.skills.acting = clamp(p.skills.acting + trained(p, "acting", p.skills.acting, p.effort === "coast" ? 3 : 5));
  a.credits.push(credit);
  const before = a.typecast;
  a.typecast = typecastFrom(a.credits);
  if (a.typecast && a.typecast !== before) logEvent(p, notices, "Typecast", `Casting directors now see you as "the ${a.typecast.toLowerCase()} one". Offers in that genre come easy; everything else is a fight.`, "neutral");

  // A hit invites a sequel contract.
  if (!behind && (outcome === "hit" || outcome === "blockbuster") && !stage && f.genre !== "Indie" && job && job.tier >= 1 && installment === 1 && !a.franchise && !a.studioDeal && !a.series && !a.franchiseOffer && rng.chance(0.55)) {
    const films = rng.int(2, 4);
    a.franchiseOffer = { name: f.title, genre: f.genre, films, fee: Math.max(Math.round(job.salary * 1.1), Math.round(f.fee * 1.5)) };
    notices.push(info("A Franchise Beckons", `The studio wants a ${films}-film sequel deal for "${f.title}" at ${money(a.franchiseOffer.fee)} a picture. It expires when you age up. See the Movie Star tab.`, "good"));
  }

  const mood = outcome === "flop" ? "bad" : outcome === "blockbuster" ? "jackpot" : "good";
  const net = behind ? `Your share is ${money(revenue)} against ${money(f.invested ?? 0)} invested.` : `You earned ${money(fees)}${bonuses ? ` plus a ${money(bonuses)} profit bonus` : ""}.`;
  const label = stage ? "Play Closes" : "Film Released";
  const tag = sleeper ? " SLEEPER HIT" : "";
  logEvent(
    p, notices, `${label}: ${outcome.toUpperCase()}${tag}`,
    `"${f.title}" (${f.genre}) ${stage ? "took" : "grossed"} ${money(boxOffice)} on a ${money(f.budget)} budget. ${stage ? "Reviewers" : "Critics"} gave it ${critics}/100. ${net}`,
    mood,
  );
  return { fees, bonuses, revenue, outcome };
}

function agentYear(p: PlayerState, rng: Rng, notices: Notices, worked: boolean, outcome: FilmCredit["outcome"] | null) {
  const a = p.acting;
  const ag = a.agent;
  if (ag) {
    ag.yearsWith += 1;
    ag.skill = clamp(ag.skill + rng.int(-3, 3));
    const quiet = { boutique: 5, mid: 8, major: 12 }[ag.kind];
    ag.trust = clamp(ag.trust + (worked ? 4 : -quiet) + (outcome === "blockbuster" ? 6 : outcome === "hit" ? 3 : outcome === "flop" ? -5 : 0));
    if (ag.trust <= 10 && rng.chance(ag.kind === "boutique" ? 0.5 : 0.8)) {
      a.agent = null;
      logEvent(p, notices, "Dropped by Your Agent", `${ag.name} stopped returning your calls and sent a short email ending the representation. Without an agent you will see fewer offers and no lead roles.`, "bad");
    }
  }
  const mg = a.manager;
  if (mg) {
    mg.yearsWith += 1;
    mg.skill = clamp(mg.skill + rng.int(-3, 3));
  }
}

/** Returns the year's gross (taxable) screen income. Representation fees are deducted from the bank. */
export function processActing(p: PlayerState, rng: Rng, notices: Notices): number {
  const a: ActingState = p.acting;
  const job = p.currentJob;
  const actor = job?.lineId === "actor";
  const model = job?.lineId === "model";
  if (!actor && !model && a.credits.length === 0 && !a.pendingFilm && !a.series && a.residuals.length === 0) {
    a.offers = [];
    return 0;
  }
  a.offers = [];
  a.franchiseOffer = null;
  a.callback = null;
  // Last year's contender goes to the ceremony before this year's film opens.
  processAwards(p, rng, notices);
  const released = releaseFilm(p, rng, notices);
  const tv = processSeries(p, rng, notices);
  const residuals = processResiduals(p);
  let gross = released.fees + released.bonuses + released.revenue + tv + residuals;
  const commissionable = released.fees + released.bonuses + tv + residuals;
  const cuts = cutsFor(p, commissionable);
  if (residuals > 0) notices.push(info("Residuals", `Repeat fees from earlier work paid ${money(residuals)}.`, "good"));

  // Studio deal: one film a year, chosen for you
  const d = a.studioDeal;
  if (d && actor && !a.pendingFilm && !a.series) {
    const role: FilmOffer["role"] = (job?.tier ?? 1) >= 2 ? "lead" : "supporting";
    a.pendingFilm = buildOffer(p, rng, role, d.genre, d.fee);
    d.yearsLeft -= 1;
    if (d.yearsLeft <= 0) {
      a.studioDeal = null;
      logEvent(p, notices, "Studio Deal Ends", `Your three-picture deal with ${d.studio} wrapped. You're a free agent again.`, "neutral");
    }
  }
  processFranchise(p, rng, notices);

  if (actor && job) {
    const worked = released.fees + released.revenue + tv > 0 || !!a.pendingFilm || !!a.series;
    a.yearsSinceWork = worked ? 0 : a.yearsSinceWork + 1;
    agentYear(p, rng, notices, worked, released.outcome);
    const line = CAREER_BY_ID.actor;
    if (a.yearsSinceWork >= 2) {
      a.reputation = clamp(a.reputation - 3);
      a.pull = clamp(a.pull - 2);
      job.salary = Math.max(Math.round(line.ladder[job.tier].salary * 0.4), Math.round(job.salary * 0.9));
      p.annualSalary = job.salary;
      notices.push(info("Work Is Drying Up", "You haven't been in a film for two years. Casting directors have forgotten you and your retainer is shrinking.", "bad"));
      if (a.yearsSinceWork >= 3 && job.tier >= 1) {
        demote(p, "Three quiet years is a long time in this business.", notices);
        a.yearsSinceWork = 1;
      }
    }
    // Ageing: draw fades without a body of work behind it
    if (p.age > 45) a.pull = clamp(a.pull - Math.max(0, Math.round((p.age - 45) * 0.15)) + (a.reputation >= 70 ? 1 : 0));
    // A child star who has left school goes full-time.
    if (job.partTime && !isStudyingFullTime(p)) {
      job.partTime = false;
      job.salary = Math.round(job.salary / PART_TIME_FACTOR);
      p.annualSalary = job.salary;
      logEvent(p, notices, "Full-Time Actor", `With school behind you, you can work full time. Your retainer is now ${money(job.salary)}.`, "good");
    }
    // Child actors miss school when they work, unless there is a tutor on set.
    if (p.age < 18 && (p.education.stage === "Primary" || p.education.stage === "HighSchool") && worked && !p.flags.includes("set_tutor")) {
      p.education.studyEffort = Math.max(0, p.education.studyEffort - 2);
    }
    // Next year's offers: none while a show or franchise has you under exclusive contract.
    if (!a.pendingFilm && !a.series) {
      const n = a.agent ? 1 + Math.round(a.agent.skill / 45) : rng.chance(0.4) ? 1 : 0;
      const slots = Math.min(3, n + (a.reputation >= 60 ? 1 : 0) + (a.manager && a.manager.skill >= 50 ? 1 : 0));
      for (let i = 0; i < slots; i++) {
        const roll = rng.next();
        const medium = roll < 0.18 ? "tv" : roll < 0.3 ? "stage" : "film";
        a.offers.push(buildOffer(p, rng, roleFor(p, rng), undefined, undefined, medium));
      }
      if (a.offers.length) {
        const kinds = [...new Set(a.offers.map((o) => MEDIUM_LABEL[o.medium ?? "film"].toLowerCase()))].join(", ");
        notices.push(info("Scripts Arrive", `${a.offers.length} offer${a.offers.length > 1 ? "s" : ""} on your desk (${kinds}). See the Movie Star tab.`, "good"));
      }
    }
  }

  if (model && job) {
    if (p.age >= 32) {
      job.salary = Math.round(job.salary * 0.94);
      p.annualSalary = job.salary;
    }
    agentYear(p, rng, notices, true, null);
    const line = CAREER_BY_ID.model;
    if (job.tier >= 1 && (p.looks < 70 || (p.age >= 38 && p.fame < 40)) && rng.chance(0.35)) {
      job.tier -= 1;
      job.title = line.ladder[job.tier].title;
      job.salary = Math.max(line.ladder[job.tier].salary, Math.round(job.salary * 0.5));
      p.annualSalary = job.salary;
      logEvent(p, notices, "Aged Out", `The bookings thinned out as the industry chased younger faces. You're now billed as a ${job.title}.`, "bad");
    }
  }

  if (cuts.total) p.bankBalance -= cuts.total;
  a.lastIncome = { fees: released.fees + released.revenue, bonuses: released.bonuses, agent: cuts.total, series: tv, residuals };
  a.earnings += gross - cuts.total;

  // Scandals
  if ((actor || model) && p.fame >= 20) {
    const risk = (0.015 + p.fame / 900 + (Math.max(...Object.values(p.vices)) >= 40 ? 0.03 : 0)) * (a.manager ? 0.8 : 1);
    if (rng.chance(risk)) raiseScandal(p, "acting", rng, notices);
  }
  gross = Math.round(gross);
  return gross;
}
