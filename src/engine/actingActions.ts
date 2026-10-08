/**
 * The choices an actor makes between jobs: training, selling a film, running an awards campaign,
 * quitting a show, franchise contracts, side work and a comeback. Each is a pure (p, rng) action.
 */
import type { ActionResult, CampaignMode, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { info, payout, trained, type Notices } from "./creativeCore";
import { raiseScandal } from "./celebrity";
import { CAMPAIGNS, campaignCost, finishSeries } from "./actingYear";
import { UNION_SCALE, buildOffer, cutsFor, isActor } from "./actingShared";

const none = (p0: PlayerState, title: string, body: string, tone: "bad" | "neutral" = "bad"): ActionResult => ({ player: p0, notices: [info(title, body, tone)] });

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type TrainKind = "class" | "coach" | "method";

export const TRAIN_INFO: Record<TrainKind, { label: string; blurb: string }> = {
  class: { label: "Take an acting class", blurb: "A year of evening workshops. Steady, safe skill growth." },
  coach: { label: "Hire a dialect and performance coach", blurb: "Private coaching before a shoot lifts your performance on that film." },
  method: { label: "Go full method", blurb: "Live as the character for the whole shoot. Critics love it. It can break you." },
};

export const classCost = (p: PlayerState) => Math.round(2_000 + p.skills.acting * 20);
export const coachCost = (p: PlayerState) => Math.round(8_000 + (p.currentJob?.salary ?? 0) * 0.01);

export function trainBlocker(p: PlayerState, kind: TrainKind): string | null {
  const a = p.acting;
  if (!isActor(p)) return "You need an acting job.";
  if (kind === "class") {
    if ((p.annual["train:class"] ?? 0) >= 1) return "You've already taken a class this year.";
    if (p.bankBalance < classCost(p)) return `Classes cost ${money(classCost(p))}.`;
    return null;
  }
  const f = a.pendingFilm;
  if (!f || f.role === "producer" || f.role === "director") return "You need a film or play you are cast in.";
  if (kind === "coach") {
    if (a.prepBonus > 0) return "You already have a coach for this shoot.";
    if (p.bankBalance < coachCost(p)) return `A coach costs ${money(coachCost(p))}.`;
    return null;
  }
  if (f.method) return "You're already deep in character.";
  if (p.health < 30) return "You're not healthy enough for that kind of immersion.";
  return null;
}

export function trainActing(p0: PlayerState, rng: Rng, kind: TrainKind): ActionResult {
  const blocked = trainBlocker(p0, kind);
  if (blocked) return none(p0, "Can't Train", blocked);
  const p = clone(p0);
  const a = p.acting;
  if (kind === "class") {
    const cost = classCost(p);
    p.bankBalance -= cost;
    p.annual["train:class"] = 1;
    const gain = trained(p, "acting", p.skills.acting, rng.int(2, 4));
    p.skills.acting = clamp(p.skills.acting + gain);
    changeStat(p, "happiness", 1);
    const body = `You spent ${money(cost)} and a year of Tuesday nights in a draughty studio. Acting skill +${gain}.`;
    addLog(p, body);
    return { player: p, notices: [info("Class Taken", body, "good")] };
  }
  if (kind === "coach") {
    const cost = coachCost(p);
    p.bankBalance -= cost;
    a.prepBonus = 8;
    p.skills.acting = clamp(p.skills.acting + trained(p, "acting", p.skills.acting, 1));
    const body = `A coach drilled you for weeks for ${money(cost)}. You'll arrive on set prepared.`;
    addLog(p, body);
    return { player: p, notices: [info("Coach Hired", body, "good")] };
  }
  a.pendingFilm!.method = true;
  changeStat(p, "health", -3);
  changeStat(p, "happiness", -5);
  const body = `You told the cast to call you by your character's name and stopped answering to your own. It will show on screen. Whether it costs you anything will be clear when the film opens.`;
  addLog(p, body);
  return { player: p, notices: [info("Going Method", body)] };
}

// ---------------------------------------------------------------------------
// Press tour
// ---------------------------------------------------------------------------

export type PressKind = "interviews" | "tour" | "marketing";

export function pressCost(p: PlayerState, kind: PressKind): number {
  const f = p.acting.pendingFilm;
  if (kind === "interviews") return 0;
  if (kind === "marketing") return Math.round((f?.budget ?? 0) * 0.08);
  return Math.round(15_000 + p.fame * 600);
}

export function pressBlocker(p: PlayerState, kind: PressKind): string | null {
  const f = p.acting.pendingFilm;
  if (!f) return "You need a film in the can.";
  const behind = f.role === "producer" || f.role === "director";
  if (kind === "marketing" && !behind) return "Only the producer controls the marketing budget.";
  if ((p.annual.press ?? 0) >= 1) return "You've already worked the press this year.";
  if ((f.promo ?? 0) >= 40) return "The film is as promoted as it will get.";
  if (p.bankBalance < pressCost(p, kind)) return `That costs ${money(pressCost(p, kind))}.`;
  return null;
}

export function promoteFilm(p0: PlayerState, rng: Rng, kind: PressKind): ActionResult {
  const blocked = pressBlocker(p0, kind);
  if (blocked) return none(p0, "Can't Promote", blocked);
  const p = clone(p0);
  const f = p.acting.pendingFilm!;
  const cost = pressCost(p, kind);
  p.bankBalance -= cost;
  p.annual.press = 1;
  const charm = Math.round(p.skills.charisma / 25);
  const gain = kind === "interviews" ? 4 + charm : kind === "tour" ? 10 + charm : 14;
  f.promo = Math.min(40, (f.promo ?? 0) + gain);
  changeStat(p, "happiness", kind === "tour" ? -3 : kind === "interviews" ? -1 : 0);
  if (kind === "tour") changeStat(p, "health", -1);
  const notices: Notices = [];
  const label = kind === "interviews" ? "You did the rounds of morning shows and podcasts" : kind === "tour" ? `You flew round the world to premieres for ${money(cost)}` : `You bought ${money(cost)} of trailers, posters and prime-time spots`;
  const body = `${label}. "${f.title}" will open with real awareness (promotion +${gain}).`;
  addLog(p, body);
  notices.push(info("Press Tour", body, "good"));
  const gaffe = kind === "tour" ? 0.09 : kind === "interviews" ? 0.05 : 0;
  if (rng.chance(gaffe) && p.fame >= 15) raiseScandal(p, "acting", rng, notices, 1, "a live interview during your press tour went badly wrong");
  return { player: p, notices };
}

// ---------------------------------------------------------------------------
// Awards campaign
// ---------------------------------------------------------------------------

export function campaignBlocker(p: PlayerState, mode: CampaignMode): string | null {
  const r = p.acting.awardsRun;
  if (!r) return "You have no contender this year.";
  if (r.campaign !== "quiet") return "Your campaign is already under way.";
  if (mode === "quiet") return "Nothing to do.";
  if (p.bankBalance < campaignCost(p, mode)) return `That costs ${money(campaignCost(p, mode))}.`;
  return null;
}

export function campaignForAwards(p0: PlayerState, mode: CampaignMode): ActionResult {
  const blocked = campaignBlocker(p0, mode);
  if (blocked) return none(p0, "Can't Campaign", blocked);
  const p = clone(p0);
  const r = p.acting.awardsRun!;
  const cost = campaignCost(p, mode);
  p.bankBalance -= cost;
  r.campaign = mode;
  r.spent = cost;
  changeStat(p, "happiness", mode === "festivals" ? -1 : -2);
  const c = CAMPAIGNS[mode];
  const body = `You chose "${c.label.toLowerCase()}" for "${r.title}" and spent ${money(cost)}. The ceremony is next year.`;
  addLog(p, body);
  return { player: p, notices: [info("Campaign Launched", body)] };
}

// ---------------------------------------------------------------------------
// TV: leaving a show
// ---------------------------------------------------------------------------

/** What it costs to walk away from your contract. */
export function seriesExitCost(p: PlayerState): number {
  const s = p.acting.series;
  if (!s) return 0;
  if (s.status === "pilot") return Math.round(s.fee * 0.1);
  return s.yearsLeft > 0 ? Math.round(s.fee * 0.5) : 0;
}

export function leaveSeries(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const s = p.acting.series;
  if (!s) return { player: p0 };
  const cost = seriesExitCost(p);
  if (p.bankBalance < cost) return none(p0, "Can't Afford It", `Breaking the contract costs ${money(cost)} in damages.`);
  p.bankBalance -= cost;
  const a = p.acting;
  const notices: Notices = [];
  const breach = cost > 0;
  if (breach) {
    a.reputation = clamp(a.reputation - (s.status === "pilot" ? 2 : 8));
    a.pull = clamp(a.pull - (s.status === "pilot" ? 0 : 3));
    if (a.agent) a.agent.trust = clamp(a.agent.trust - 10);
  }
  finishSeries(p, notices, breach ? `You walked out on "${s.title}" and paid ${money(cost)} in damages. Showrunners have long memories.` : `You left "${s.title}" when your contract ran out.`);
  return { player: p, notices };
}

// ---------------------------------------------------------------------------
// Franchise
// ---------------------------------------------------------------------------

export function acceptFranchise(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const a = p.acting;
  const o = a.franchiseOffer;
  if (!o) return { player: p0 };
  if (a.studioDeal || a.series || a.franchise) return none(p0, "Exclusive", "You're already under an exclusive contract.");
  a.franchise = { name: o.name, genre: o.genre, filmsLeft: o.films, installment: 2, fee: o.fee };
  a.franchiseOffer = null;
  const body = `You signed on for ${o.films} sequels to "${o.name}" at ${money(o.fee)} each, rising 15% per film. The studio picks the shoot dates and you can't take other features until the saga ends.`;
  addLog(p, body);
  return { player: p, notices: [info("Franchise Signed", body, "good")] };
}

export function declineFranchise(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.acting.franchiseOffer) return { player: p0 };
  p.acting.franchiseOffer = null;
  return { player: p, notices: [info("Passed", "You told the studio you want to stretch yourself. They will recast.")] };
}

export const franchiseExitCost = (p: PlayerState) => (p.acting.franchise ? Math.round(p.acting.franchise.fee * p.acting.franchise.filmsLeft * 0.6) : 0);

export function leaveFranchise(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const f = p.acting.franchise;
  if (!f) return { player: p0 };
  const cost = franchiseExitCost(p);
  if (p.bankBalance < cost) return none(p0, "Can't Afford It", `Walking away costs ${money(cost)}.`);
  p.bankBalance -= cost;
  p.acting.franchise = null;
  p.acting.reputation = clamp(p.acting.reputation - 3);
  const body = `You paid ${money(cost)} to leave "${f.name}". The studio recast your part and told the trades you were "creatively unavailable".`;
  addLog(p, body);
  return { player: p, notices: [info("Left the Franchise", body)] };
}

// ---------------------------------------------------------------------------
// Side work and comeback
// ---------------------------------------------------------------------------

export type GigKind = "voice" | "commercial";

export function gigBlocker(p: PlayerState, kind: GigKind): string | null {
  if (!isActor(p)) return "You need an acting job.";
  if (p.isInPrison) return "You're in prison.";
  if ((p.annual[`gig:${kind}`] ?? 0) >= 1) return kind === "voice" ? "You've already booked voice work this year." : "You've already shot an ad this year.";
  return null;
}

/** Quick work that fits around a shoot: voice-over and regional commercials. */
export function bookSideGig(p0: PlayerState, rng: Rng, kind: GigKind): ActionResult {
  const blocked = gigBlocker(p0, kind);
  if (blocked) return none(p0, "Can't Book", blocked, "neutral");
  const p = clone(p0);
  const a = p.acting;
  const salary = p.currentJob!.salary;
  p.annual[`gig:${kind}`] = 1;
  const gross =
    kind === "voice"
      ? Math.max(UNION_SCALE.voice, Math.round(salary * rng.float(0.01, 0.03) * (1 + p.skills.acting / 100)))
      : Math.max(UNION_SCALE.commercial, Math.round(salary * rng.float(0.02, 0.05)));
  const cuts = cutsFor(p, gross);
  const net = payout(p, gross - cuts.total);
  a.sideGigs += 1;
  a.earnings += gross - cuts.total;
  const notices: Notices = [];
  let body: string;
  if (kind === "voice") {
    p.skills.acting = clamp(p.skills.acting + trained(p, "acting", p.skills.acting, 1));
    body = `You spent a week in a padded booth voicing an animated character. ${money(gross)} at guild rates${cuts.total ? `, ${money(cuts.total)} to your representation` : ""}; ${money(net)} after withholding. Nobody knows your face, but the bills are paid.`;
  } else {
    a.residuals.push({ title: "Regional ad", amount: Math.round(gross * 0.25), yearsLeft: 2 });
    if (a.critics >= 60) a.critics = clamp(a.critics - 1);
    body = `You played a delighted customer in a regional ad. ${money(gross)} up front${cuts.total ? ` (${money(cuts.total)} to your representation)` : ""}, ${money(net)} after withholding, plus a trickle of residuals. Serious critics winced a little.`;
  }
  addLog(p, body);
  notices.push(info(kind === "voice" ? "Voice Work" : "Commercial", body, "good"));
  return { player: p, notices };
}

export function comebackBlocker(p: PlayerState): string | null {
  const a = p.acting;
  if (!isActor(p)) return "You need an acting job.";
  if (a.credits.length < 3) return "A comeback needs a past: 3+ credits.";
  if (a.pendingFilm || a.series) return "You're already working.";
  if (a.yearsSinceWork < 2 && a.reputation >= 35) return "You haven't fallen far enough to need one.";
  if (a.comebackYear && p.year - a.comebackYear < 3) return "You tried recently. Give it a few years.";
  if (a.offers.some((o) => o.comeback)) return "A comeback script is already on your desk.";
  return null;
}

/** Call in favours for one small, serious project that could remind the industry who you are. */
export function startComeback(p0: PlayerState, rng: Rng): ActionResult {
  const blocked = comebackBlocker(p0);
  if (blocked) return none(p0, "Can't Stage a Comeback", blocked);
  const p = clone(p0);
  const a = p.acting;
  const job = p.currentJob!;
  const role = job.tier >= 2 && p.age < 60 ? "lead" : "supporting";
  const offer = buildOffer(p, rng, role, rng.pick(["Drama", "Indie"]), Math.max(UNION_SCALE.film, Math.round(job.salary * 0.12)));
  offer.script = rng.int(68, 88);
  offer.prestige = rng.int(75, 95);
  offer.budget = rng.int(2_000_000, 8_000_000);
  offer.comeback = true;
  offer.medium = "film";
  a.offers.push(offer);
  a.comebackYear = p.year;
  changeStat(p, "happiness", 3);
  const body = `You called in every favour you had. A small, serious script has been sent over: "${offer.title}", for scale-plus money and a big chance. Accept it from the offers list before you age up.`;
  addLog(p, body);
  return { player: p, notices: [info("A Script Arrives", body, "good")] };
}
