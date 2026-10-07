/**
 * Sports careers: the player-facing actions and the view model used by the Athlete tab.
 *
 * A sports career is a pipeline, not a job application: youth team -> college / academy -> semi-pro -> pro ->
 * veteran -> retirement -> coaching or media. The yearly simulation lives in athleteSeason.ts; the maths in
 * athleteModel.ts; this file holds the decisions the player makes.
 */
import type { ActionResult, AthleteOffer, InjuryPlan, PlayerState } from "@/types/game.types";
import type { Effort } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID, UNIVERSITY_MAJORS } from "@/data/careersRegistry";
import { LEAGUE_MIN, SPORTS, SPORT_INFO, isSport, sportInfo } from "@/data/sports";
import { addLog, changeStat, clone, setFlag } from "./state";
import { makeJob } from "./career";
import { blockerFor } from "./occupation";
import {
  ACADEMY_AGES, MIN_AGE, RULES, SCHOLARSHIP_AGES, experience, gauss, injuryCost, maturity, phaseFor, potentialGrade, projected, effRating,
} from "./athleteModel";
import { athleteJob, dropContract, exitAmateur, info, retireAthlete, signContract } from "./athleteCareer";
import { inSport, isContractedAthlete } from "./athleteState";
import { processAthlete } from "./athleteSeason";

export { SPORTS, SPORT_INFO };
export { processAthlete };

const reject = (p0: PlayerState, title: string, body: string): ActionResult => ({ player: p0, notices: [info(title, body, "bad")] });

const youthMaxAge = (sport: string | null) => (sport === "Golf" ? 27 : 22);

// ---------------------------------------------------------------------------
// Choosing a sport
// ---------------------------------------------------------------------------

/** Why the player can't commit to a sport right now, or null. */
export function commitBlocker(p: PlayerState, sport?: string | null): string | null {
  const a = p.athlete;
  if (p.age < MIN_AGE) return `Too young: competitive sport starts at ${MIN_AGE}.`;
  if (p.isInPrison) return "You're in prison.";
  if (inSport(p)) return "You're already committed to a sport.";
  if (a.stage === "retired") return "You've retired. Use the comeback option instead.";
  if (a.banYears > 0) return a.banYears >= 99 ? "You're banned for life." : `You're banned from competition for ${a.banYears} more year${a.banYears === 1 ? "" : "s"}.`;
  if (p.age < a.lockedUntil) return `Clubs won't take you back until age ${a.lockedUntil}.`;
  const s = sport ?? a.sport;
  if (p.age >= youthMaxAge(s)) return `Too late to start: academies and clubs recruit before ${youthMaxAge(s)}.`;
  return null;
}

/** Commit to a sport: the first step of the pipeline (youth team or, for late starters, an amateur club). */
export function signWithClub(p0: PlayerState, sport: string, rng: Rng): ActionResult {
  if (!isSport(sport)) return reject(p0, "Unknown Sport", "Pick one of the listed sports.");
  const why = commitBlocker(p0, sport);
  if (why) return reject(p0, "Can't Commit", why);
  const p = clone(p0);
  const a = p.athlete;
  const sinfo = sportInfo(sport);
  const same = a.sport === sport && a.rating > 0;
  const ath = p.skills.athletics;
  const rolled = clamp(Math.round(gauss(rng, 38, 19) + (ath - 10) * 0.35 + (p.health - 70) * 0.08 + (p.talents.athletic - 50) * 0.5), 3, 100);
  a.sport = sport;
  a.talent = same ? Math.max(a.talent, Math.round(rolled * 0.4 + a.talent * 0.6)) : rolled;
  a.rating = same ? a.rating : clamp(Math.round(ath * 0.7 + rng.int(0, 6)), 3, 60);
  a.years = same ? a.years : Math.min(8, Math.round(ath / 12));
  a.stage = "youth";
  a.track = null;
  a.scholarship = false;
  a.warnings = 0;
  a.stipend = 0;
  a.stageYears = 0;
  a.club = `${p.residence.city || p.birthCity} Juniors`;
  a.exposure = 15;
  a.consistency = 50;
  a.form = 50;
  a.detrain = 0;
  a.freeAgent = false;
  a.offers = [];
  a.athMirror = p.skills.athletics;
  setFlag(p, "athlete_dream");
  const late = p.age >= 18;
  const body = late
    ? `You joined an amateur ${sport.toLowerCase()} club at ${p.age}. Late starters face long odds: scouts recruit the young. Your training load is set to ${p.effort}.`
    : `You committed to ${sport.toLowerCase()}. Expect years of training with no guarantee: your training load (${p.effort}), health, grades and a bit of luck decide whether this goes anywhere.`;
  addLog(p, body);
  return { player: p, notices: [info(`${sinfo.emoji} Committed to ${sport}`, body, "good")] };
}
export const commitToSport = signWithClub;

export function setEffort(p0: PlayerState, effort: Effort): ActionResult {
  if (p0.effort === effort) return { player: p0 };
  return { player: { ...p0, effort } };
}

// ---------------------------------------------------------------------------
// Training and exposure
// ---------------------------------------------------------------------------

export function trainAthletics(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 8) return { player: p0, notices: [info("Too Young", "Come back when you're a little older.")] };
  if ((p.annual.train ?? 0) >= 1) return { player: p0, notices: [info("Rest Day", "You've already trained hard this year. Your body needs recovery.")] };
  const a = p.athlete;
  if (inSport(p)) {
    if (a.injury && a.injury.yearsLeft > 0) return reject(p0, "Injured", "You can't attend a camp while recovering from a serious injury.");
    const cost = p.age >= 18 ? 1_500 : 0;
    if (p.bankBalance < cost) return reject(p0, "Can't Afford It", `A private coaching camp costs ${money(cost)}.`);
    p.annual.train = 1;
    p.bankBalance -= cost;
    const gain = rng.int(1, 3);
    a.rating = clamp(a.rating + gain);
    a.consistency = clamp(a.consistency + 8);
    changeStat(p, "health", -1);
    const body = `You spent the off-season at a coaching camp${cost ? ` (${money(cost)})` : ""}. Rating +${gain}, and your training consistency is up.`;
    addLog(p, body);
    return { player: p, notices: [info("Training Camp", body, "good")] };
  }
  p.annual.train = 1;
  const gain = rng.int(4, 8);
  p.skills.athletics = clamp(p.skills.athletics + gain);
  changeStat(p, "health", 1);
  changeStat(p, "looks", 1);
  const body = `You trained relentlessly. Athletics +${gain}. (To turn this into a career, commit to a sport first.)`;
  addLog(p, body);
  return { player: p, notices: [info("Training Camp", body, "good")] };
}

/** Pay to be seen: a showcase tournament or trial in front of scouts. Once a year. */
export function attendShowcase(p0: PlayerState, rng: Rng): ActionResult {
  const a0 = p0.athlete;
  if (!inSport(p0)) return reject(p0, "Not In a Sport", "Commit to a sport first.");
  if ((p0.annual["ath:showcase"] ?? 0) >= 1) return reject(p0, "Already Showcased", "Scouts only come to one showcase a year.");
  if (a0.injury && a0.injury.severity >= 2) return reject(p0, "Injured", "You're in no state to impress anyone.");
  const cost = p0.age >= 18 ? 800 : 0;
  if (p0.bankBalance < cost) return reject(p0, "Can't Afford It", `Entry costs ${money(cost)}.`);
  const p = clone(p0);
  const a = p.athlete;
  p.annual["ath:showcase"] = 1;
  p.bankBalance -= cost;
  const good = rng.chance(clamp(0.45 + (a.form - 50) / 150 + (a.rating - 50) / 200, 0.2, 0.85));
  a.exposure = clamp(a.exposure + (good ? 22 : 8));
  changeStat(p, "happiness", good ? 3 : -2);
  const body = good ? "You impressed the scouts at a showcase. More clubs will know your name." : "A quiet day at the showcase. A few notes were taken, nothing more.";
  addLog(p, body);
  return { player: p, notices: [info("Showcase", body, good ? "good" : "neutral")] };
}

// ---------------------------------------------------------------------------
// Offers: scholarships, academies, contracts, post-career jobs
// ---------------------------------------------------------------------------

const findOffer = (p: PlayerState, id: string) => p.athlete.offers.find((o) => o.id === id);

export function offerBlocker(p: PlayerState, o: AthleteOffer): string | null {
  const a = p.athlete;
  if (a.banYears > 0) return "You're banned from competition.";
  switch (o.kind) {
    case "scholarship":
      if (p.currentJob) return "Quit your job first: college is full time.";
      if (p.education.stage !== "None") return "You're already enrolled somewhere.";
      return null;
    case "academy":
      return null;
    case "coach":
    case "pundit":
      return p.currentJob ? `Quit your current job first.` : blockerFor(p, "job");
    default: {
      if (p.currentJob && p.currentJob.lineId !== "athlete") return `You can't sign while working as a ${p.currentJob.title}. Quit first: pro sport is all-consuming.`;
      return blockerFor(p, "athlete");
    }
  }
}

export function acceptOffer(p0: PlayerState, offerId: string, rng: Rng): ActionResult {
  const o0 = findOffer(p0, offerId);
  if (!o0) return reject(p0, "Offer Expired", "That offer is no longer on the table.");
  const why = offerBlocker(p0, o0);
  if (why) return reject(p0, "Can't Accept", why);
  const p = clone(p0);
  const a = p.athlete;
  const o = findOffer(p, offerId)!;
  if (o.kind === "scholarship") {
    p.education.stage = "University";
    p.education.yearsLeft = 4;
    p.education.major = UNIVERSITY_MAJORS[0].id;
    setFlag(p, "athlete_scholar");
    a.stage = "college";
    a.track = "college";
    a.scholarship = true;
    a.warnings = 0;
    a.stipend = 3_000;
    a.club = o.club;
    a.stageYears = 0;
    a.offers = [];
    const body = `You accepted a full scholarship to ${o.club}. You're enrolled in University (${UNIVERSITY_MAJORS[0].name}) and on the team. Keep your grades at 50+ or you'll lose it, and training hard eats study time.`;
    addLog(p, body);
    return { player: p, notices: [info("Scholarship Accepted", body, "good")] };
  }
  if (o.kind === "academy") {
    a.stage = "college";
    a.track = "academy";
    a.scholarship = false;
    a.stipend = o.salary;
    a.club = o.club;
    a.stageYears = 0;
    a.offers = [];
    const body = `You joined ${o.club}: elite coaching, ${money(o.salary)} a year, and scouts watching every game. The academy cuts players who coast or fall behind.`;
    addLog(p, body);
    return { player: p, notices: [info("Academy Place", body, "good")] };
  }
  if (o.kind === "coach" || o.kind === "pundit") {
    const line = CAREER_BY_ID[o.kind === "coach" ? "sports_coach" : "sports_pundit"];
    const job = makeJob(line, o.league, rng);
    job.company = o.club;
    job.salary = o.salary;
    p.currentJob = job;
    p.annualSalary = o.salary;
    a.post = o.kind;
    a.offers = [];
    const body = `You started a new career as a ${job.title} at ${job.company}: ${money(o.salary)} a year.`;
    addLog(p, body);
    return { player: p, notices: [info("New Chapter", body, "good")] };
  }
  // Contracts. Full-time students in higher education must leave school first.
  const notices: NonNullable<ActionResult["notices"]> = [];
  const stage = p.education.stage;
  if (stage !== "None" && stage !== "Primary" && stage !== "HighSchool") {
    p.education.stage = "None";
    p.education.yearsLeft = 0;
    p.education.major = null;
    changeStat(p, "happiness", -3);
    notices.push(info("Left University", "You dropped out to sign. Your scholarship, if you had one, ends with it.", "neutral"));
  }
  const wasFreeAgent = a.freeAgent;
  const line = signContract(p, rng, o);
  if (wasFreeAgent) a.freeAgentYears = 0;
  changeStat(p, "happiness", o.league >= 1 ? 10 : 6);
  const body = `You ${line}`;
  addLog(p, body);
  notices.push(info(o.kind === "renew" ? "Re-signed" : "Signed!", body, "jackpot"));
  return { player: p, notices };
}

export function declineOffer(p0: PlayerState, offerId: string): ActionResult {
  if (!findOffer(p0, offerId)) return { player: p0 };
  const p = clone(p0);
  p.athlete.offers = p.athlete.offers.filter((o) => o.id !== offerId);
  return { player: p, notices: [info("Offer Declined", "You turned it down. There's no guarantee another will come.", "neutral")] };
}

/** Push for better terms. Can improve the deal, or sour it. */
export function negotiateOffer(p0: PlayerState, offerId: string, rng: Rng): ActionResult {
  const o0 = findOffer(p0, offerId);
  if (!o0) return reject(p0, "Offer Expired", "That offer is no longer on the table.");
  if (o0.years <= 0 || o0.kind === "scholarship" || o0.kind === "academy") return reject(p0, "Not Negotiable", "This offer is take it or leave it.");
  if (o0.haggled) return reject(p0, "Already Pushed", "You've already pushed on this one. Take it or leave it.");
  const p = clone(p0);
  const a = p.athlete;
  const o = findOffer(p, offerId)!;
  o.haggled = true;
  const eff = effRating(a);
  const leverage = clamp((eff - LEAGUE_MIN[o.league]) / 60, -0.1, 0.25);
  const chance = clamp(0.5 + (a.agent ? 0.2 : 0) + (a.form - 50) / 400 + leverage - (p.age >= 33 ? 0.1 : 0), 0.2, 0.9);
  if (rng.chance(chance)) {
    const f = rng.float(1.1, 1.25);
    o.salary = Math.round((o.salary * f) / 500) * 500;
    o.bonus = Math.round((o.bonus * 1.2) / 500) * 500;
    const body = `${a.agent ? "Your agent" : "You"} pushed hard and ${o.club} came up to ${money(o.salary)} a year.`;
    addLog(p, body);
    return { player: p, notices: [info("Better Terms", body, "good")] };
  }
  if (rng.chance(0.3)) {
    a.offers = a.offers.filter((x) => x.id !== offerId);
    const body = `${o.club} walked away from the table when you pushed. The offer is gone.`;
    addLog(p, body);
    return { player: p, notices: [info("Offer Withdrawn", body, "bad")] };
  }
  o.salary = Math.round((o.salary * 0.93) / 500) * 500;
  const body = `${o.club} dug in and trimmed the offer to ${money(o.salary)}. Take it or leave it now.`;
  addLog(p, body);
  return { player: p, notices: [info("Talks Soured", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Injuries
// ---------------------------------------------------------------------------

export function treatmentBlocker(p: PlayerState, plan: InjuryPlan): string | null {
  const a = p.athlete;
  const inj = a.injury;
  if (!inj) return "You're not injured.";
  if (inj.decided && inj.plan !== "play") return "You've already committed to a treatment plan.";
  if (plan === "surgery" && inj.severity < 2) return "A minor knock doesn't need surgery.";
  if (plan === "play" && inj.yearsLeft <= 0) return "It will heal on its own by the next season; no need to risk it.";
  const cost = injuryCost(a, plan, inj.severity);
  if (cost > p.bankBalance) return `Costs ${money(cost)}.`;
  return null;
}

export function chooseTreatment(p0: PlayerState, plan: InjuryPlan, rng: Rng): ActionResult {
  const why = treatmentBlocker(p0, plan);
  if (why) return reject(p0, "Can't Do That", why);
  const p = clone(p0);
  const a = p.athlete;
  const inj = a.injury!;
  const cost = injuryCost(a, plan, inj.severity);
  p.bankBalance -= cost;
  const firstDecision = !inj.decided;
  inj.plan = plan;
  inj.decided = true;
  let body = "";
  if (plan === "rest") body = `You'll rest and let your ${inj.label.toLowerCase()} heal naturally.`;
  else if (plan === "rehab") {
    if (firstDecision) inj.ratingLoss = Math.round(inj.ratingLoss * 0.7 * 10) / 10;
    body = `You started structured rehab${cost ? ` (${money(cost)})` : ""}. It protects your long-term level.`;
  } else if (plan === "surgery") {
    if (rng.chance(0.88)) {
      inj.yearsLeft = Math.max(0, inj.yearsLeft - 1);
      inj.ratingLoss = Math.round(inj.ratingLoss * 0.5 * 10) / 10;
      changeStat(p, "health", 3);
      body = `Surgery on your ${inj.label.toLowerCase()} went well${cost ? ` (${money(cost)})` : ""}. Recovery is shorter and the lasting damage smaller.`;
    } else {
      inj.yearsLeft += 1;
      inj.ratingLoss = Math.round(inj.ratingLoss * 1.3 * 10) / 10;
      changeStat(p, "health", -6);
      body = `Complications set you back. Surgery on your ${inj.label.toLowerCase()} went badly and recovery will take longer.`;
    }
  } else {
    body = `You'll play through the pain. You keep your place and your salary, but you're well below your best and every game risks making it worse.`;
  }
  addLog(p, body);
  return { player: p, notices: [info(plan === "play" ? "Playing Through It" : "Treatment", body, plan === "surgery" && !body.startsWith("Complications") ? "good" : plan === "play" ? "bad" : "neutral")] };
}

// ---------------------------------------------------------------------------
// Agent, doping, quitting, retiring, coming back
// ---------------------------------------------------------------------------

export function agentBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  if (!inSport(p)) return "You're not in a sport.";
  if (a.agent) return "You already have an agent.";
  if (a.stage === "youth") return "Agents don't sign youth players. Move up first.";
  if (a.rating < 50 && p.fame < 20) return "No agent will take you on yet: reach a rating of 50 or some fame.";
  return null;
}

export function hireAgent(p0: PlayerState): ActionResult {
  const why = agentBlocker(p0);
  if (why) return reject(p0, "No Agent", why);
  const p = clone(p0);
  p.athlete.agent = true;
  const body = "You hired an agent. Offers will be about 6% better, negotiations go your way more often and endorsements grow, but the agent takes 8% of everything you earn.";
  addLog(p, body);
  return { player: p, notices: [info("Agent Hired", body, "good")] };
}

export function fireAgent(p0: PlayerState): ActionResult {
  if (!p0.athlete.agent) return { player: p0 };
  const p = clone(p0);
  p.athlete.agent = false;
  addLog(p, "You parted ways with your agent.");
  return { player: p, notices: [info("Agent Fired", "You're on your own again. No more 8% fee, no more help at the table.", "neutral")] };
}

export function stopDoping(p0: PlayerState): ActionResult {
  if (!p0.athlete.doping) return { player: p0 };
  const p = clone(p0);
  p.athlete.doping = false;
  changeStat(p, "karma", 3);
  const body = "You came off the stuff. Your numbers will drop, but so will the risk of a positive test. Past results remain on the record.";
  addLog(p, body);
  return { player: p, notices: [info("Clean Again", body, "neutral")] };
}

export interface ExitPreview {
  title: string;
  lines: string[];
  cost: number;
}

/** What quitting (or retiring) would cost right now. */
export function exitPreview(p: PlayerState): ExitPreview | null {
  const a = p.athlete;
  const job = athleteJob(p);
  if (!inSport(p)) return null;
  if (a.stage === "youth") return { title: "Quit the sport", lines: ["Your place on the team goes to someone else.", "Happiness drops. You can re-enter after a year, but your rating will fade.", "Your record and rating are kept; they decay while you're away."], cost: 0 };
  if (a.stage === "college") {
    return {
      title: "Leave the programme",
      lines: [a.scholarship ? "You forfeit your scholarship and pay your own tuition." : "You walk away from the programme.", "Scouts will remember it. You can re-enter after two years.", "Happiness takes a big hit."],
      cost: 0,
    };
  }
  const mid = !!job && a.contractYears > 0 && !a.expiring && !a.freeAgent;
  const penalty = mid ? Math.round(job.salary * Math.min(a.contractYears, 2) * 0.4) : 0;
  return {
    title: mid ? "Break your contract" : "Retire from sport",
    lines: mid
      ? [`You owe ${a.club} a buy-out of about ${money(penalty)}.`, "Your fame drops and your name is mud with other clubs.", `You can't sign anywhere for ${2 + a.league} years.`]
      : ["Your contract is up, so you walk away clean.", "You can coach or work in the media afterwards, or come back later at a lower level."],
    cost: penalty,
  };
}

/** Quit the sport (youth/college) or break a contract. Retiring after a contract ends is `retireFromSport`. */
export function quitSport(p0: PlayerState): ActionResult {
  if (!inSport(p0)) return { player: p0 };
  const a0 = p0.athlete;
  if (isContractedAthlete(p0) && (a0.freeAgent || a0.expiring || a0.contractYears <= 0)) return retireFromSport(p0);
  const prev = exitPreview(p0)!;
  const p = clone(p0);
  const a = p.athlete;
  const notices: NonNullable<ActionResult["notices"]> = [];
  if (a.stage === "youth") {
    exitAmateur(p, 1);
    changeStat(p, "happiness", -4);
  } else if (a.stage === "college") {
    exitAmateur(p, 2);
    changeStat(p, "happiness", -8);
    changeStat(p, "fame", -1);
  } else {
    const lock = 2 + a.league;
    p.bankBalance -= prev.cost;
    dropContract(p);
    a.stage = "none";
    a.lockedUntil = Math.max(a.lockedUntil, p.age + lock);
    a.offers = [];
    changeStat(p, "happiness", -10);
    changeStat(p, "fame", -(3 + a.league * 3));
    setFlag(p, "burned_bridges");
  }
  setFlag(p, "quit_sport");
  const body = `You quit ${a.sport?.toLowerCase()}.${prev.cost ? ` The buy-out cost ${money(prev.cost)}.` : ""} Your rating will fade without training. You can re-enter after age ${a.lockedUntil}.`;
  addLog(p, body);
  notices.push(info("You Quit", body, "bad"));
  return { player: p, notices };
}

export function retireFromSport(p0: PlayerState): ActionResult {
  if (!isContractedAthlete(p0)) return { player: p0 };
  const p = clone(p0);
  const a = p.athlete;
  const job = athleteJob(p);
  const notices: NonNullable<ActionResult["notices"]> = [];
  const mid = !!job && a.contractYears > 0 && !a.expiring && !a.freeAgent;
  if (mid) {
    const penalty = Math.round(job!.salary * Math.min(a.contractYears, 2) * 0.3);
    p.bankBalance -= penalty;
    changeStat(p, "fame", -2);
    notices.push(info("Contract Buy-Out", `Retiring early cost you a ${money(penalty)} buy-out.`, "bad"));
  }
  retireAthlete(p, notices, "chosen");
  return { player: p, notices };
}

export function comebackBlocker(p: PlayerState): string | null {
  const a = p.athlete;
  const info = sportInfo(a.sport);
  if (a.stage !== "retired") return "You haven't retired.";
  if (a.banYears > 0) return "You're banned from competition.";
  if (p.currentJob) return `Leave your job as ${p.currentJob.title} first.`;
  if (p.age >= info.maxAge - 3) return "Too old to come back.";
  if (a.rating < 44) return "You've lost too much ability: clubs wouldn't look twice.";
  if (a.retiredAge !== null && p.age <= a.retiredAge) return "Give it at least a year.";
  return null;
}

/** Come out of retirement as a free agent. */
export function comeback(p0: PlayerState): ActionResult {
  const why = comebackBlocker(p0);
  if (why) return reject(p0, "Can't Come Back", why);
  const p = clone(p0);
  const a = p.athlete;
  a.stage = a.league >= 1 ? "pro" : "semipro";
  a.freeAgent = true;
  a.freeAgentYears = 0;
  a.consistency = 50;
  a.retiredAge = null;
  a.post = "none";
  a.offers = [];
  setFlag(p, "athlete_comeback");
  const body = `You announced a comeback. You're a free agent with a rating of ${Math.round(a.rating)}; clubs will make offers if you can still play.`;
  addLog(p, body);
  return { player: p, notices: [info("Comeback", body, "neutral")] };
}

// ---------------------------------------------------------------------------
// View model
// ---------------------------------------------------------------------------

export function stageLabel(p: PlayerState): string {
  const a = p.athlete;
  const s = sportInfo(a.sport);
  switch (a.stage) {
    case "none": return "Not in a sport";
    case "youth": return p.age >= 18 ? "Amateur" : p.age < 13 ? "Youth Team" : "School / Club Team";
    case "college": return a.track === "academy" ? "Academy" : "College Athlete";
    case "semipro": return a.freeAgent ? "Free Agent (semi-pro)" : "Semi-Pro";
    case "pro": {
      if (a.freeAgent) return "Free Agent";
      return p.age > s.peak[1] + 2 ? "Veteran Pro" : "Pro";
    }
    case "retired": return a.post === "coach" ? "Retired · Coach" : a.post === "pundit" ? "Retired · Pundit" : "Retired";
  }
}

export interface Req {
  label: string;
  ok: boolean;
  detail?: string;
}
export interface ReqGroup {
  title: string;
  items: Req[];
}

const req = (label: string, ok: boolean, detail?: string): Req => ({ label, ok, detail });

/** Requirements for the next steps in the pipeline, for the UI's checklist. */
export function advanceRequirements(p: PlayerState): ReqGroup[] {
  const a = p.athlete;
  const e = p.education;
  const proj = Math.round(projected(a, p.age));
  const groups: ReqGroup[] = [];
  const rating = Math.round(a.rating);
  if (a.stage === "youth") {
    groups.push({
      title: "Academy place (ages 15-19)",
      items: [
        req(`Age ${ACADEMY_AGES[0]}-${ACADEMY_AGES[1]}`, p.age >= ACADEMY_AGES[0] && p.age <= ACADEMY_AGES[1], `you're ${p.age}`),
        req(`Scouts project ${RULES.academyProj}+ at your peak`, proj >= RULES.academyProj, `projection ${proj}`),
        req("Scouts have seen you", a.exposure >= 25, `visibility ${a.exposure}`),
      ],
    });
    groups.push({
      title: "College scholarship (ages 18-20)",
      items: [
        req(`Age ${SCHOLARSHIP_AGES[0]}-${SCHOLARSHIP_AGES[1]}`, p.age >= SCHOLARSHIP_AGES[0] && p.age <= SCHOLARSHIP_AGES[1], `you're ${p.age}`),
        req("High school diploma", e.degrees.includes("highschool")),
        req(`Grades ${RULES.scholarshipGrades}+`, e.grades >= RULES.scholarshipGrades, `grades ${Math.round(e.grades)}`),
        req(`Smarts ${RULES.scholarshipSmarts}+`, p.smarts >= RULES.scholarshipSmarts, `smarts ${p.smarts}`),
        req(`Rating ${RULES.scholarshipRating}+ and projection ${RULES.scholarshipProj}+`, a.rating >= RULES.scholarshipRating && proj >= RULES.scholarshipProj, `rating ${rating}, projection ${proj}`),
      ],
    });
    groups.push({
      title: "Turn semi-pro (17+)",
      items: [req("Age 17+", p.age >= 17), req(`Rating ${RULES.semiproRating}+`, a.rating >= RULES.semiproRating, `rating ${rating}`)],
    });
    groups.push({
      title: "Go pro early (prodigies only)",
      items: [req(`Age ${RULES.proEarlyAges[0]}-${RULES.proEarlyAges[1]}`, p.age >= RULES.proEarlyAges[0] && p.age <= RULES.proEarlyAges[1]), req(`Rating ${RULES.proEarlyRating}+`, a.rating >= RULES.proEarlyRating, `rating ${rating}`)],
    });
  } else if (a.stage === "college") {
    groups.push({
      title: "Move on from the programme",
      items: [
        req(`Rating ${RULES.proRating}+ for a pro club (${RULES.semiproRating}+ for semi-pro)`, a.rating >= RULES.semiproRating, `rating ${rating}`),
        req("Selection happens when your programme ends or if you declare early", true, `${Math.max(0, 4 - a.stageYears)} year(s) left`),
        ...(a.scholarship ? [req("Keep grades above 50 to keep your scholarship", e.grades >= 50, `grades ${Math.round(e.grades)}`)] : []),
      ],
    });
  } else if (a.stage === "semipro" || a.stage === "pro") {
    const next = a.league + 1;
    if (next <= 3) {
      groups.push({
        title: `Reach the ${sportInfo(a.sport).leagues[next]}`,
        items: [
          req(`Rating ${LEAGUE_MIN[next] + (a.league === 0 ? 0 : 2)}+`, a.rating >= LEAGUE_MIN[next] + (a.league === 0 ? 0 : 2), `rating ${rating}`),
          req("Be visible to scouts (results, titles and showcases)", a.exposure >= 30, `visibility ${a.exposure}`),
          req("Avoid a long injury", !(a.injury && a.injury.severity >= 3)),
        ],
      });
    }
    groups.push({
      title: "Keep your contract",
      items: [
        req(`Stay above the ${LEAGUE_MIN[0] - 4} rating floor`, a.rating >= LEAGUE_MIN[0] - 4, `rating ${rating}`),
        req("Train: coasting two years running gets you released", a.detrain < 2, `${a.detrain} year(s) coasting`),
      ],
    });
  } else if (a.stage === "none") {
    const why = commitBlocker(p);
    groups.push({ title: "Commit to a sport", items: [req(`Age ${MIN_AGE}+`, p.age >= MIN_AGE), req("Free to join", !why, why ?? undefined)] });
  }
  return groups;
}

export interface AthleteView {
  stage: string;
  phase: ReturnType<typeof phaseFor>;
  peak: [number, number];
  maturity: number;
  experience: number;
  potential: string;
  retireHorizon: number;
  contractValue: number;
  injuryNotes: string[];
}

export function athleteView(p: PlayerState): AthleteView {
  const a = p.athlete;
  const s = sportInfo(a.sport);
  return {
    stage: stageLabel(p),
    phase: phaseFor(a.sport, p.age),
    peak: s.peak,
    maturity: maturity(a.sport, p.age),
    experience: experience(a.years),
    potential: potentialGrade(a, p.age),
    retireHorizon: s.maxAge,
    contractValue: athleteJob(p)?.salary ?? 0,
    injuryNotes: a.injury ? [`${a.injury.label} · ${a.injury.yearsLeft > 0 ? `${a.injury.yearsLeft} season(s) out after this one` : "back by next season"}`] : [],
  };
}
