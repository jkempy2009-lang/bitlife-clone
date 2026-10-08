/**
 * Player-facing decisions for the human side of a sporting career: sponsorship deals, the national team,
 * locker-room politics, mental health, contesting a doping ban, rivalries, and life after the game.
 * Each action is `(p, rng?) => ActionResult` on a clone, with a matching `*Blocker` for the UI.
 */
import { blockerFor } from "./occupation";
import type { ActionResult, NationalPlan, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { BUSINESS_BY_ID } from "@/data/businessTypes";
import { sportInfo } from "@/data/sports";
import { addLog, changeStat, clone, getPartner, livingRelatives, setFlag } from "./state";
import { info } from "./athleteCareer";
import { inSport, isContractedAthlete } from "./athleteState";
import { DEAL_KINDS, appealCost, dealEligible, maxDeals } from "./athleteDepth";
import { effRating } from "./athleteModel";
import { startBusiness } from "./business";

const reject = (p0: PlayerState, title: string, body: string): ActionResult => ({ player: p0, notices: [info(title, body, "bad")] });
const annualUsed = (p: PlayerState, key: string) => (p.annual[key] ?? 0) >= 1;
const spend = (p: PlayerState, cost: number) => {
  p.bankBalance -= cost;
};

// ---------------------------------------------------------------------------
// Sponsorship
// ---------------------------------------------------------------------------

export function dealBlocker(p: PlayerState, id: string): string | null {
  const a = p.athlete;
  const d = a.dealOffers.find((x) => x.id === id);
  if (!d) return "That offer has expired.";
  if (!dealEligible(p, a)) return "Sponsors are staying away from you right now.";
  if (a.deals.length >= maxDeals(p)) return `You can only front ${maxDeals(p)} brand${maxDeals(p) === 1 ? "" : "s"} at your level of fame.`;
  if (a.deals.some((x) => x.category === d.category)) return "You already have a deal in that category.";
  return null;
}

export function signDeal(p0: PlayerState, id: string): ActionResult {
  const why = dealBlocker(p0, id);
  if (why) return reject(p0, "Can't Sign", why);
  const p = clone(p0);
  const a = p.athlete;
  const d = a.dealOffers.find((x) => x.id === id)!;
  a.deals.push(d);
  a.dealOffers = a.dealOffers.filter((x) => x.id !== id);
  const k = DEAL_KINDS[d.category];
  if (d.category === "charity") changeStat(p, "karma", 4);
  if (d.category === "betting") changeStat(p, "karma", -3);
  const body = `You signed with ${d.brand}: ${money(d.pay)} a season for ${d.years} season${d.years === 1 ? "" : "s"}. ${k.blurb}`;
  addLog(p, body);
  return { player: p, notices: [info(`${k.emoji} ${d.brand}`, body, d.category === "betting" || d.category === "fintech" ? "neutral" : "good")] };
}

export function declineDeal(p0: PlayerState, id: string): ActionResult {
  if (!p0.athlete.dealOffers.some((x) => x.id === id)) return { player: p0 };
  const p = clone(p0);
  p.athlete.dealOffers = p.athlete.dealOffers.filter((x) => x.id !== id);
  return { player: p };
}

/** Walk away from a running deal: you owe half a season's fee and sponsors talk. */
export function dropDeal(p0: PlayerState, id: string): ActionResult {
  const d0 = p0.athlete.deals.find((x) => x.id === id);
  if (!d0) return { player: p0 };
  const p = clone(p0);
  const a = p.athlete;
  const d = a.deals.find((x) => x.id === id)!;
  const fee = Math.round(d.pay * 0.5);
  spend(p, fee);
  a.deals = a.deals.filter((x) => x.id !== id);
  a.image = clamp(a.image - 4);
  const body = `You tore up your deal with ${d.brand} and paid ${money(fee)} to leave. Brands don't love athletes who walk out.`;
  addLog(p, body);
  return { player: p, notices: [info("Deal Terminated", body, "bad")] };
}

// ---------------------------------------------------------------------------
// National team
// ---------------------------------------------------------------------------

export const NATIONAL_PLANS: { id: NationalPlan; label: string; blurb: string }[] = [
  { id: "allin", label: "All in", blurb: "Prepare for it as the goal of your career: +5 in the tournament, but injury risk up 35%, around $8,000 of preparation, burnout risk, and your club is not happy." },
  { id: "balanced", label: "Balanced", blurb: "Go, but keep your club commitments. No bonus and no extra cost." },
  { id: "withdraw", label: "Withdraw", blurb: "Sit it out. You rest and the club is pleased, but you can't win a medal and your name fades a little." },
];

export function nationalBlocker(p: PlayerState, plan: NationalPlan): string | null {
  const c = p.athlete.natCall;
  if (!c) return "There is no invitation on the table.";
  if (!c.selected) return "You weren't picked.";
  if (plan === "allin" && p.bankBalance < 8_000) return "Preparation costs $8,000.";
  return null;
}

export function setNationalPlan(p0: PlayerState, plan: NationalPlan): ActionResult {
  const why = nationalBlocker(p0, plan);
  if (why) return reject(p0, "Can't Do That", why);
  if (p0.athlete.natPlan === plan) return { player: p0 };
  const p = clone(p0);
  const a = p.athlete;
  a.natPlan = plan;
  let body = "";
  if (plan === "allin") {
    body = `You committed everything to the ${a.natCall!.major}. Camps, travel and sacrifice: the people close to you will feel it.`;
    const family = [...(getPartner(p) ? [getPartner(p)!] : []), ...livingRelatives(p, "Child").filter((c) => c.age < 18)];
    for (const r of family) r.relationshipBar = Math.max(0, r.relationshipBar - 4);
  } else if (plan === "withdraw") body = `You told the federation you'd sit out the ${a.natCall!.major}. They weren't happy, but your body will thank you.`;
  else body = `You'll go to the ${a.natCall!.major} but not at the cost of your club season.`;
  addLog(p, body);
  return { player: p, notices: [info(`${a.natCall!.major} plan`, body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Mind and locker room
// ---------------------------------------------------------------------------

export const THERAPY_COST = 2_000;

export function therapyBlocker(p: PlayerState): string | null {
  if (!inSport(p)) return "You're not in a sport.";
  if (annualUsed(p, "ath:therapy")) return "You've already worked with your psychologist this year.";
  if (p.bankBalance < THERAPY_COST && p.age >= 18) return `Sessions cost ${money(THERAPY_COST)}.`;
  return null;
}

export function seeTherapist(p0: PlayerState, rng: Rng): ActionResult {
  const why = therapyBlocker(p0);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:therapy"] = 1;
  if (p.age >= 18) spend(p, THERAPY_COST);
  const gain = rng.int(10, 18);
  a.mental = clamp(a.mental + gain);
  changeStat(p, "happiness", 2);
  const body = `A sport psychologist helped you get your head straight. Morale +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [info("Sport Psychologist", body, "good")] };
}

export const DINNER_COST = 1_500;

export function dinnerBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  if (!(a.stage === "college" || isContractedAthlete(p))) return "You need a team to host.";
  if (a.freeAgent) return "You have no club right now.";
  if (annualUsed(p, "ath:dinner")) return "You've already hosted the team this year.";
  if (p.bankBalance < DINNER_COST) return `It costs ${money(DINNER_COST)}.`;
  return null;
}

export function teamDinner(p0: PlayerState, rng: Rng): ActionResult {
  const why = dinnerBlocker(p0);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:dinner"] = 1;
  spend(p, DINNER_COST);
  const gain = rng.int(6, 11);
  a.chemistry = clamp(a.chemistry + gain);
  changeStat(p, "happiness", 2);
  const body = `You took the squad out for dinner on your own tab. Chemistry +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [info("Team Dinner", body, "good")] };
}

export function coachTalkBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  if (!(a.stage === "college" || isContractedAthlete(p))) return "You need a coach to talk to.";
  if (a.freeAgent) return "You have no club right now.";
  if (annualUsed(p, "ath:coach")) return "You've already had that conversation this year.";
  return null;
}

/** Ask the coach for a bigger role: it can win him over or backfire. */
export function talkToCoach(p0: PlayerState, rng: Rng): ActionResult {
  const why = coachTalkBlocker(p0);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:coach"] = 1;
  const chance = clamp(0.5 + (a.coachRel - 50) / 120 + (a.consistency - 50) / 250 + (a.captain ? 0.1 : 0) + (a.mental < 30 ? -0.1 : 0), 0.2, 0.85);
  if (rng.chance(chance)) {
    a.coachRel = clamp(a.coachRel + 9);
    a.playing = clamp(a.playing + 10);
    changeStat(p, "happiness", 2);
    const body = "You sat down with the coach and spoke honestly. He respected it and promised you a bigger part.";
    addLog(p, body);
    return { player: p, notices: [info("A Good Talk", body, "good")] };
  }
  a.coachRel = clamp(a.coachRel - 9);
  changeStat(p, "happiness", -2);
  const body = "The conversation went badly. The coach heard an entitled player demanding minutes.";
  addLog(p, body);
  return { player: p, notices: [info("It Went Badly", body, "bad")] };
}

export function captainBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  if (a.captain) return "You already wear the armband.";
  if (!sportInfo(a.sport).team) return "Individual sports have no captain.";
  if (!isContractedAthlete(p) || a.freeAgent) return "You need to be under contract.";
  if (a.league < 1) return "Captains are chosen from the professional ranks.";
  if (a.stageYears < 2) return "Give yourself time at the club first.";
  if (a.chemistry < 55) return "The dressing room isn't behind you yet (chemistry 55+).";
  if (annualUsed(p, "ath:captain")) return "The vote is held once a year.";
  return null;
}

export function runForCaptain(p0: PlayerState, rng: Rng): ActionResult {
  const why = captainBlocker(p0);
  if (why) return reject(p0, "Can't Stand", why);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:captain"] = 1;
  const chance = clamp(0.3 + (a.chemistry - 55) / 100 + (a.coachRel - 50) / 200 + (a.stageYears - 2) * 0.03 + (effRating(a) >= 70 ? 0.1 : 0) - (a.image < 40 ? 0.15 : 0), 0.1, 0.85);
  if (rng.chance(chance)) {
    a.captain = true;
    changeStat(p, "fame", 1);
    changeStat(p, "happiness", 5);
    a.mental = clamp(a.mental + 4);
    const body = `The squad voted you captain of ${a.club}. The armband comes with leadership, media duty and pressure.`;
    addLog(p, body);
    return { player: p, notices: [info("Captain!", body, "good")] };
  }
  a.chemistry = clamp(a.chemistry - 3);
  changeStat(p, "happiness", -2);
  const body = "The vote went to someone else. A few teammates avoided your eye afterwards.";
  addLog(p, body);
  return { player: p, notices: [info("Not This Time", body, "bad")] };
}

export function transferRequestBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  if (!isContractedAthlete(p) || a.freeAgent) return "You're not under contract.";
  if (a.expiring) return "Your contract is already up: look at the offers instead.";
  if (a.transferReq) return "You've already asked to leave.";
  return null;
}

export function requestTransfer(p0: PlayerState): ActionResult {
  const why = transferRequestBlocker(p0);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  a.transferReq = true;
  a.coachRel = clamp(a.coachRel - 12);
  a.chemistry = clamp(a.chemistry - 8);
  a.image = clamp(a.image - 3);
  const body = `You handed in a transfer request. The club will decide at the end of the season whether to find you a buyer. Meanwhile, expect a frosty dressing room.`;
  addLog(p, body);
  return { player: p, notices: [info("Transfer Request", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// Doping appeal
// ---------------------------------------------------------------------------

export function appealBlocker(p: PlayerState): string | null {
  const ap = p.athlete.appeal;
  if (!ap) return "There is no ban to contest.";
  if (p.bankBalance < ap.cost) return `Lawyers cost ${money(ap.cost)}.`;
  return null;
}

export function appealChance(p: PlayerState): number {
  return clamp(0.3 + (p.athlete.agent ? 0.1 : 0) + (p.fame >= 50 ? 0.08 : 0) + (p.karma >= 50 ? 0.05 : -0.05) - (p.athlete.dopeTitles > 2 ? 0.05 : 0), 0.15, 0.6);
}

export function appealBan(p0: PlayerState, rng: Rng): ActionResult {
  const why = appealBlocker(p0);
  if (why) return reject(p0, "Can't Appeal", why);
  const p = clone(p0);
  const a = p.athlete;
  const ap = a.appeal!;
  spend(p, ap.cost);
  a.appeal = null;
  if (rng.chance(appealChance(p))) {
    const cut = Math.max(0, Math.ceil(ap.ban / 2));
    a.banYears = cut;
    a.record.titles += Math.floor(ap.stripped / 2);
    a.image = clamp(a.image + 8);
    changeStat(p, "happiness", 6);
    const body = `The tribunal accepted that the positive test came from a contaminated supplement. Your ban was halved to ${cut} year${cut === 1 ? "" : "s"} and half your titles were reinstated. The stain on your name remains.`;
    addLog(p, body);
    return { player: p, notices: [info("Appeal Partly Upheld", body, "good")] };
  }
  a.banYears += 1;
  a.image = clamp(a.image - 6);
  changeStat(p, "happiness", -5);
  const body = "The tribunal rejected your appeal and added a year to the ban for wasting its time.";
  addLog(p, body);
  return { player: p, notices: [info("Appeal Rejected", body, "bad")] };
}
export { appealCost };

// ---------------------------------------------------------------------------
// Rivalry
// ---------------------------------------------------------------------------

export function rivalBlocker(p: PlayerState): string | null {
  if (!p.athlete.rival) return "You have no rival.";
  if (annualUsed(p, "ath:rival")) return "You've already made your move this year.";
  return null;
}

/** Play up the feud: attention and fame, at the price of your image. */
export function fuelRivalry(p0: PlayerState): ActionResult {
  const why = rivalBlocker(p0);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:rival"] = 1;
  a.rival!.heat = clamp(a.rival!.heat + 18);
  a.exposure = clamp(a.exposure + 8);
  a.image = clamp(a.image - 3);
  changeStat(p, "fame", 1);
  const body = `You swiped at ${a.rival!.name} in the press. The headlines wrote themselves.`;
  addLog(p, body);
  return { player: p, notices: [info("Feud Fuelled", body, "neutral")] };
}

export function makePeace(p0: PlayerState): ActionResult {
  const why = rivalBlocker(p0);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:rival"] = 1;
  a.rival!.heat = clamp(a.rival!.heat - 30);
  a.image = clamp(a.image + 4);
  a.mental = clamp(a.mental + 3);
  changeStat(p, "karma", 2);
  const body = `You shook hands with ${a.rival!.name} on camera. The respect was genuine, and so were the cheers.`;
  addLog(p, body);
  return { player: p, notices: [info("Burying the Hatchet", body, "good")] };
}

// ---------------------------------------------------------------------------
// After the game
// ---------------------------------------------------------------------------

const ACADEMY_KIND = "gym";

export function academyCost(): number {
  return BUSINESS_BY_ID[ACADEMY_KIND]?.cost ?? 0;
}

/** A famous name gets sponsors to chip in. */
export function academyDiscount(p: PlayerState): number {
  return p.fame >= 40 ? Math.round(academyCost() * Math.min(0.35, (p.fame - 30) / 150)) : 0;
}

export function academyBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  if (a.stage !== "retired") return "You can only found an academy once you've retired.";
  if (a.post === "academy" || p.business) return p.business ? `You already run ${p.business.name}.` : "You already run an academy.";
  const clash = blockerFor(p, "business");
  if (clash) return clash;
  if (p.fame < 15 && a.record.proSeasons < 3) return "Parents want a name they recognise: build a bigger career first.";
  const cost = academyCost() - academyDiscount(p);
  if (p.bankBalance < cost) return `Opening an academy costs ${money(cost)} (${money(academyDiscount(p))} off for your name).`;
  return null;
}

/** Turn a sporting name into a business with the existing business engine. */
export function startAcademy(p0: PlayerState, rng: Rng): ActionResult {
  const why = academyBlocker(p0);
  if (why) return reject(p0, "Can't Open an Academy", why);
  const a0 = p0.athlete;
  const start = clone(p0);
  const discount = academyDiscount(start);
  start.bankBalance += discount;
  // A former pro has the fitness know-how a gym needs, however far their own form has faded.
  start.skills.athletics = Math.max(start.skills.athletics, 30);
  const res = startBusiness(start, ACADEMY_KIND, `${start.lastName} ${a0.sport ?? "Sports"} Academy`, rng);
  if (!res.player.business) {
    const n = (res.notices ?? []).find((x) => x.kind === "info") as { body?: string } | undefined;
    return reject(p0, "Can't Open an Academy", n?.body ?? "The bank wouldn't back it.");
  }
  const p = res.player;
  const b = p.business!;
  // The famous founder makes the brand worth more.
  b.fit = Math.min(2.4, b.fit * (1 + Math.min(0.35, p.fame / 250 + a0.record.titles * 0.01)));
  p.athlete.post = "academy";
  setFlag(p, "athlete_academy");
  const body = `You opened the ${b.name}. Your name fills the first intake; sponsors ${discount > 0 ? `covered ${money(discount)} of the cost` : "kept their distance"}. Manage it from the Business tab.`;
  addLog(p, body);
  return { player: p, notices: [info("Academy Founded", body, "good")] };
}
