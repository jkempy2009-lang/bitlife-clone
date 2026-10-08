/**
 * The yearly athlete transaction, called once per Age Up from processCareer.
 *
 * Order: outside influences (event flags) -> contract/job reconciliation -> training load -> injuries ->
 * ability change -> the season itself -> money -> doping tests -> stage progression, contract expiry,
 * offers and retirement.
 */
import type { AthleteOffer, AthleteState, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID, PROGRAMS } from "@/data/careersRegistry";
import { LEAGUE_MIN, sportInfo } from "@/data/sports";
import { addLog, changeStat, clearFlag, hasFlag, setFlag } from "./state";
import {
  ACADEMY_AGES, CONSISTENCY_STEP, RULES, SCHOLARSHIP_AGES, clubName, effRating, endorsementIncome, injuryChance, leagueFor, makeOffer,
  nextRating, playSeason, projected, rollInjury, toRecord,
} from "./athleteModel";
import { athleteJob, dropContract, exitAmateur, info, netExtra, retireAthlete, signContract, type Notices } from "./athleteCareer";
import { isContractedAthlete } from "./athleteState";
import { startTrial } from "./crime";
import { afterSeasonDepth, appealCost, dealIncome, lateDepth, resolveTransferRequest, rollPlaying, seasonModifiers } from "./athleteDepth";
import { hallBallot } from "./athleteLegacy";

function takeFlag(p: PlayerState, f: string): boolean {
  if (!hasFlag(p, f)) return false;
  clearFlag(p, f);
  return true;
}

/** Fractional fame accumulates probabilistically because fame is stored as an integer. */
function addFame(p: PlayerState, rng: Rng, f: number) {
  const whole = Math.floor(Math.abs(f)) * Math.sign(f);
  const frac = Math.abs(f) - Math.abs(whole);
  changeStat(p, "fame", whole + (rng.chance(frac) ? Math.sign(f) : 0));
}

const youthMaxAge = (sport: string | null) => (sport === "Golf" ? 27 : 22);

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

function clubWants(p: PlayerState, a: AthleteState): boolean {
  const info = sportInfo(a.sport);
  const eff = effRating(a);
  if (a.banYears > 0) return false;
  if (p.age >= info.maxAge + 1) return false;
  if (a.injury && a.injury.severity >= 3 && a.injury.yearsLeft >= 2) return false;
  if (eff < LEAGUE_MIN[0] - 4) return false;
  if (p.age >= 33 && eff < LEAGUE_MIN[a.league] - 6) return false;
  if (a.form < 20) return false;
  return true;
}

/** Offers on the table at the end of a season. */
export function buildOffers(p: PlayerState, rng: Rng, drafted = false): AthleteOffer[] {
  const a = p.athlete;
  const sinfo = sportInfo(a.sport);
  const offers: AthleteOffer[] = [];
  if (a.banYears > 0) return offers;
  const eff = a.rating + (a.doping ? 4 : 0);
  const proj = projected(a, p.age);
  const pSeen = drafted ? 0.95 : clamp(0.35 + a.exposure * 0.006 + (p.annual["ath:showcase"] ? 0.12 : 0), 0.3, 0.95);
  const seen = () => rng.chance(pSeen);
  const badInjury = !!a.injury && a.injury.severity >= 3 && a.injury.yearsLeft >= 2;
  const lg = leagueFor(eff);

  if (a.stage === "youth" || a.stage === "college") {
    if (a.stage === "youth" && p.age >= ACADEMY_AGES[0] && p.age <= ACADEMY_AGES[1] && proj >= RULES.academyProj && seen()) {
      const o = makeOffer("academy", a.sport, 0, eff, p.age, false, rng, "Elite training, a small stipend and plenty of scouts. Roster spots are cut hard.");
      o.club = `${clubName(a.sport, 0, rng).split(" ")[0]} ${sinfo.collegeLabel}`;
      o.salary = 6_000 + Math.round(clamp(proj - 55, 0, 30)) * 300;
      o.years = 3;
      o.bonus = 0;
      offers.push(o);
    }
    const e = p.education;
    if (
      a.stage === "youth" && p.age >= SCHOLARSHIP_AGES[0] && p.age <= SCHOLARSHIP_AGES[1] && e.stage === "None" && e.degrees.includes("highschool") &&
      p.smarts >= RULES.scholarshipSmarts && e.grades >= RULES.scholarshipGrades && proj >= RULES.scholarshipProj && a.rating >= RULES.scholarshipRating && seen()
    ) {
      const o = makeOffer("scholarship", a.sport, 0, eff, p.age, false, rng, "Full tuition plus a small allowance. You must keep your grades up and keep training.");
      o.club = `${clubName(a.sport, 0, rng).split(" ")[0]} University`;
      o.salary = PROGRAMS.University.tuition;
      o.years = 4;
      o.bonus = 0;
      offers.push(o);
    }
    const early = a.stage === "youth" || a.stageYears >= 1;
    if (early && p.age >= 17 && a.rating >= RULES.semiproRating && !badInjury && seen()) {
      offers.push(makeOffer("semipro", a.sport, 0, eff, p.age, a.agent, rng, "Turn semi-pro now. A real contract, low pay, and your studies take a back seat."));
    }
    const minPro = a.stage === "youth" ? RULES.proEarlyRating : RULES.proRating;
    if (p.age >= RULES.proEarlyAges[0] && eff >= minPro && !badInjury && seen()) {
      const league = clamp(Math.min(lg, a.stage === "youth" ? 1 : 2), 1, 3);
      offers.push(makeOffer("pro", a.sport, league, eff, p.age, a.agent, rng, a.stage === "youth" ? "A club wants to sign you straight out of the youth ranks." : "A professional club wants you to leave college early."));
    }
  } else if (isContractedAthlete(p) && !a.freeAgent && !a.expiring) {
    const next = a.league + 1;
    if (next <= 3 && eff >= LEAGUE_MIN[next] + (a.league === 0 ? 0 : 2) && !badInjury && seen()) {
      offers.push(makeOffer(a.league === 0 ? "pro" : "transfer", a.sport, next, eff, p.age, a.agent, rng, "A bigger club will buy out your contract. A step up, with a new city and new expectations."));
    }
  }
  return offers;
}

function expiryOffers(p: PlayerState, rng: Rng, prevClub: string): AthleteOffer[] {
  const a = p.athlete;
  const eff = a.rating + (a.doping ? 4 : 0);
  const lg = leagueFor(eff);
  const out: AthleteOffer[] = [];
  const pSeen = clamp(0.4 + a.exposure * 0.006, 0.3, 0.95);
  // Even a club that rates you may cut a marginal player to make room for someone better.
  const retain = rng.chance(clamp(0.72 + (eff - LEAGUE_MIN[a.league]) * 0.04, 0.3, 0.97));
  if (retain && clubWants(p, a)) {
    const league = clamp(Math.max(lg, a.league - 1), 0, 3);
    out.push(makeOffer("renew", a.sport, league, eff, p.age, a.agent, rng, "Your club's offer to stay.", prevClub));
  }
  for (let i = 0; i < 2; i++) {
    if (!rng.chance(pSeen - i * 0.2)) continue;
    const l = clamp(leagueFor(eff + rng.int(-2, 4)), 0, 3);
    if (eff < 44 || (l === 0 && eff < LEAGUE_MIN[0] - 4)) continue;
    out.push(makeOffer("transfer", a.sport, l, eff, p.age, a.agent, rng, "Another club has come in for you."));
  }
  return out;
}

function freeAgentOffers(p: PlayerState, rng: Rng): AthleteOffer[] {
  const a = p.athlete;
  if (a.banYears > 0) return [];
  const eff = a.rating + (a.doping ? 4 : 0);
  const out: AthleteOffer[] = [];
  const pSeen = clamp(0.4 + a.exposure * 0.005, 0.3, 0.9);
  if (eff < 44 || p.age > sportInfo(a.sport).maxAge) return out;
  for (let i = 0; i < 2; i++) {
    if (!rng.chance(pSeen - i * 0.25)) continue;
    const l = clamp(leagueFor(eff - rng.int(0, 4)), 0, 3);
    out.push(makeOffer(l === 0 ? "semipro" : "transfer", a.sport, l, eff, p.age, a.agent, rng, "A club is willing to take a chance on you."));
  }
  return out;
}

function postOffers(p: PlayerState, rng: Rng): AthleteOffer[] {
  const a = p.athlete;
  if (p.currentJob || p.age < 24 || p.age >= 65 || p.isInPrison) return [];
  const out: AthleteOffer[] = [];
  const r = a.record;
  const coach = CAREER_BY_ID.sports_coach;
  const pundit = CAREER_BY_ID.sports_pundit;
  if (coach && (r.proSeasons >= 2 || (hasFlag(p, "coach_badge") && r.seasons >= 3)) && rng.chance(hasFlag(p, "coach_badge") ? 0.75 : 0.55)) {
    const tier = r.bestRating >= 86 && r.titles >= 3 ? 2 : r.bestRating >= 74 ? 1 : 0;
    out.push({ id: rng.id(), kind: "coach", club: rng.pick(coach.companies), league: tier, salary: Math.round((coach.ladder[tier].salary * rng.float(0.9, 1.2)) / 500) * 500, years: 0, bonus: 0, note: `${coach.ladder[tier].title}: pass on what you learned.` });
  }
  if (pundit && p.fame >= 25 && rng.chance(0.5)) {
    const tier = p.fame >= 85 ? 3 : p.fame >= 65 ? 2 : p.fame >= 45 ? 1 : 0;
    out.push({ id: rng.id(), kind: "pundit", club: rng.pick(pundit.companies), league: tier, salary: Math.round((pundit.ladder[tier].salary * rng.float(0.9, 1.2)) / 500) * 500, years: 0, bonus: 0, note: `${pundit.ladder[tier].title}: your name still sells airtime.` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Releases, bans and caught doping
// ---------------------------------------------------------------------------

function releasePlayer(p: PlayerState, rng: Rng, notices: Notices, why: string) {
  const a = p.athlete;
  const job = athleteJob(p);
  const pay = job ? Math.round(job.salary * 0.25) : 0;
  if (isContractedAthlete(p)) {
    dropContract(p);
    a.freeAgent = true;
    a.freeAgentYears = 0;
    if (pay > 0) p.bankBalance += netExtra(p, 0, pay);
    changeStat(p, "happiness", -8);
    addFame(p, rng, -2);
    const body = `${why}${pay > 0 ? ` The club paid out ${money(netExtra(p, 0, pay))} to settle your contract.` : ""} You're a free agent, so look at the offers or retire.`;
    addLog(p, body);
    notices.push(info("Released", body, "bad"));
  } else {
    exitAmateur(p, 1);
    changeStat(p, "happiness", -9);
    const body = `${why} You're out of the programme. You can try again in a year.`;
    addLog(p, body);
    notices.push(info("Cut From the Team", body, "bad"));
  }
}

function caughtDoping(p: PlayerState, rng: Rng, notices: Notices) {
  const a = p.athlete;
  const repeat = hasFlag(p, "doping_caught");
  const ban = repeat ? 99 : rng.int(2, 3);
  const stripped = Math.min(a.record.titles, a.dopeTitles);
  a.record.titles -= stripped;
  a.dopeTitles = 0;
  a.doping = false;
  a.banYears = ban;
  setFlag(p, "doping_caught");
  setFlag(p, "doping_ban");
  addFame(p, rng, -22);
  changeStat(p, "happiness", -18);
  changeStat(p, "karma", -10);
  const lines = [repeat ? "A second positive test. The league handed you a lifetime ban." : `You tested positive. You are banned for ${ban} years and stripped of ${stripped} title${stripped === 1 ? "" : "s"}.`];
  addLog(p, `Failed a drug test. ${lines[0]}`);
  notices.push(info("Failed Drug Test", lines[0], "bad"));
  if (isContractedAthlete(p)) {
    dropContract(p);
    a.freeAgent = true;
    a.freeAgentYears = 0;
  } else if (a.stage === "youth" || a.stage === "college") exitAmateur(p, ban >= 99 ? 99 : ban);
  a.endorsements = 0;
  a.deals = [];
  a.dealOffers = [];
  a.captain = false;
  a.image = clamp(a.image - 25);
  a.mental = clamp(a.mental - 15);
  // A first positive can be contested for the rest of this year.
  a.appeal = ban >= 99 ? null : { ban, stripped, cost: appealCost(a) };
}

// ---------------------------------------------------------------------------
// The yearly transaction
// ---------------------------------------------------------------------------

export function processAthlete(p: PlayerState, rng: Rng, notices: Notices) {
  const a = p.athlete;
  if (!a) return;
  const prevOffers = a.offers;
  a.offers = [];
  a.appeal = null;
  a.dealOffers = [];

  // ---- 0. event-driven influences, delivered as flags by the events in data/events/sports.ts ----
  const active0 = a.stage !== "none" && a.stage !== "retired";
  const wantsDope = takeFlag(p, "ath:dope");
  const clean = takeFlag(p, "ath:clean");
  const ban = takeFlag(p, "ath:ban");
  const banLife = takeFlag(p, "ath:ban_life");
  const injFlag = [1, 2, 3, 4].find((s) => takeFlag(p, `ath:inj${s}`));
  const spotlight = takeFlag(p, "ath:spotlight");
  const forcedCut = takeFlag(p, "ath:cut");
  const loseSch = takeFlag(p, "ath:lose_scholarship");
  if (takeFlag(p, "ath:fire_agent")) a.agent = false;
  if (!active0) {
    passiveYear(p, rng, notices, prevOffers.length);
    a.athMirror = p.skills.athletics;
    return;
  }
  if (wantsDope && !a.doping && a.stage !== "youth") {
    a.doping = true;
    setFlag(p, "doped");
  }
  if (clean) a.doping = false;
  if (spotlight) a.exposure = clamp(a.exposure + 25);
  if (ban) a.banYears = Math.max(a.banYears, 2);
  if (banLife) a.banYears = 99;

  // Outside boosts (events, gym, martial arts) shift the rating a little.
  const drift = p.skills.athletics - a.athMirror;
  if (drift !== 0) a.rating = clamp(a.rating + drift * 0.6);

  // ---- 1. prison ends the dream for now ----
  if (p.isInPrison) {
    if (isContractedAthlete(p)) dropContract(p);
    exitAmateur(p, 3);
    const body = "Prison put your sporting career on ice. Clubs and scouts have moved on.";
    addLog(p, body);
    notices.push(info("Career Derailed", body, "bad"));
    a.athMirror = p.skills.athletics;
    return;
  }

  // ---- 2. reconcile the job with the sporting state ----
  const wasFA = a.freeAgent && isContractedAthlete(p);
  let job = athleteJob(p);
  if (isContractedAthlete(p) && !a.freeAgent && !job) {
    // Walked out through the Work tab, or an event removed the job.
    a.freeAgent = true;
    a.freeAgentYears = 0;
    a.contractYears = 0;
    a.expiring = false;
    clearFlag(p, "athlete");
    changeStat(p, "happiness", -5);
    addFame(p, rng, -2);
    const body = "Your contract was terminated. You're a free agent.";
    addLog(p, body);
    notices.push(info("Contract Terminated", body, "bad"));
  } else if (job && !isContractedAthlete(p)) {
    dropContract(p);
    job = null;
  } else if (job && a.freeAgent) {
    a.freeAgent = false;
  }
  if (isContractedAthlete(p) && job) setFlag(p, "athlete");

  // ---- 3. bans, forced exits, unresolved contract expiry ----
  if (a.banYears >= 99) {
    retireAthlete(p, notices, "ban");
    a.athMirror = p.skills.athletics;
    return;
  }
  if (forcedCut) {
    releasePlayer(p, rng, notices, "Management decided to cut you after a falling-out.");
    if (a.stage === "none") {
      a.athMirror = p.skills.athletics;
      return;
    }
  }
  if (a.expiring && job) {
    const renew = prevOffers.find((o) => o.kind === "renew");
    if (renew) {
      const o = { ...renew, salary: Math.round((renew.salary * 0.97) / 500) * 500, bonus: 0 };
      const line = signContract(p, rng, o);
      addLog(p, `You didn't pick an offer, so your agent let the club extend you on standard terms: ${line}`);
      notices.push(info("Contract Extended", `You didn't choose an offer in time, so you ${line}`, "neutral"));
      job = athleteJob(p);
    } else {
      releasePlayer(p, rng, notices, `Your contract expired and ${a.club} chose not to renew it.`);
      job = null;
    }
  }

  // ---- 4. training load ----
  const load = p.effort;
  a.consistency = clamp(a.consistency + CONSISTENCY_STEP[load]);
  a.detrain = load === "coast" ? a.detrain + 1 : 0;
  if (p.age < 14 && load === "grind") {
    changeStat(p, "happiness", -2);
    changeStat(p, "health", -1);
  }
  const amateur = a.stage === "youth" || a.stage === "college";
  if (amateur && p.education.stage !== "None") {
    const pull = load === "grind" ? 11 : load === "steady" ? 3 : 0;
    p.education.grades = clamp(p.education.grades - pull);
  }
  if (a.stage === "college" && a.track === "college") {
    if (loseSch && a.scholarship) {
      a.scholarship = false;
      const body = "The scholarship was pulled over the booster scandal. You're a walk-on now, and you'll pay your own tuition.";
      addLog(p, body);
      notices.push(info("Scholarship Revoked", body, "bad"));
    }
    if (a.scholarship) {
      if (p.education.grades < 50) {
        a.warnings += 1;
        if (a.warnings >= 2) {
          a.scholarship = false;
          const body = "Your grades slipped for a second year, so the university took your scholarship. You stay on the team as a walk-on and pay your own tuition.";
          addLog(p, body);
          notices.push(info("Scholarship Lost", body, "bad"));
        } else notices.push(info("Academic Warning", "Your grades are below 50. Another bad year and you lose your scholarship. Training hard leaves less time for study.", "bad"));
      } else if (p.education.grades >= 55) a.warnings = 0;
      if (a.scholarship && p.education.stage === "University") p.bankBalance += PROGRAMS.University.tuition;
    }
  }

  // Coasting gets you cut.
  if (a.detrain >= 2 && (amateur || isContractedAthlete(p))) {
    const cutP = amateur ? (p.age < 12 ? 0.15 : 0.4) : 0.3;
    if (rng.chance(cutP)) {
      releasePlayer(p, rng, notices, "You've been going through the motions and coaches noticed. Your fitness numbers fell off a cliff.");
      if (a.stage === "none") {
        a.athMirror = p.skills.athletics;
        return;
      }
    }
  }

  // ---- 5. injuries ----
  const bannedStart = a.banYears > 0;
  let missed = a.banYears > 0;
  let hurtSev = 0;
  let hurtLabel = "";
  if (a.injury) {
    const inj = a.injury;
    if (inj.plan === "play" && inj.yearsLeft > 0) {
      hurtSev = inj.severity;
      hurtLabel = inj.label;
      if (rng.chance(0.22 + 0.1 * inj.severity)) {
        inj.severity = Math.min(4, inj.severity + 1);
        inj.yearsLeft += 1;
        inj.ratingLoss += 2;
        inj.plan = "rest";
        inj.decided = false;
        changeStat(p, "health", -8);
        const body = `Playing through the pain made your ${inj.label.toLowerCase()} much worse. It's now a ${a.sport === "Boxing" ? "serious" : "major"} problem.`;
        addLog(p, body);
        notices.push(info("Aggravated Injury", body, "bad"));
        if (inj.severity >= 4 && rng.chance(0.4)) {
          retireAthlete(p, notices, "injury");
          a.athMirror = p.skills.athletics;
          return;
        }
      }
    } else if (inj.yearsLeft > 0) {
      missed = true;
      hurtLabel = inj.label;
      inj.yearsLeft -= 1;
      if (inj.yearsLeft === 0) {
        if (healInjury(p, rng, notices)) {
          a.athMirror = p.skills.athletics;
          return;
        }
      }
    } else if (healInjury(p, rng, notices)) {
      a.athMirror = p.skills.athletics;
      return;
    }
  }
  // A rushed comeback that flared up costs the season.
  if (a.injury && !missed && a.injury.yearsLeft > 0 && a.injury.plan !== "play") {
    missed = true;
    hurtLabel = a.injury.label;
    a.injury.yearsLeft -= 1;
  }
  if (!a.injury && !missed && (injFlag !== undefined || rng.chance(injuryChance(p, a, load)))) {
    const inj = rollInjury(p, a, load, rng, injFlag);
    a.injury = inj;
    a.record.injuries += 1;
    hurtSev = inj.severity;
    hurtLabel = inj.label;
    changeStat(p, "health", -[4, 8, 14, 22][inj.severity - 1]);
    const decide = inj.severity >= 2 ? " Decide how to handle it in the Athlete tab." : "";
    const body = `You suffered a ${inj.severity >= 3 ? "serious " : ""}${inj.label.toLowerCase()}${inj.severity === 1 ? ", a minor knock you'll shake off." : `. Recovery will take ${inj.yearsLeft + 1} season${inj.yearsLeft + 1 === 1 ? "" : "s"}.`}${decide}`;
    addLog(p, body);
    notices.push(info(inj.severity >= 3 ? "Serious Injury" : "Injured", body, "bad"));
    if (inj.severity >= 4 && rng.chance(p.age >= 30 ? 0.5 : 0.35)) {
      retireAthlete(p, notices, "injury");
      a.athMirror = p.skills.athletics;
      return;
    }
  }

  // ---- 6. ability and form ----
  const healthy = !missed;
  const nr = nextRating(a, p.age, load, p.health, rng);
  if (missed) a.rating = clamp(Math.min(a.rating, nr) - (a.banYears > 0 ? 2 : 0.5));
  else if (a.injury?.plan === "play") a.rating = clamp(a.rating + (nr - a.rating) * 0.5);
  else a.rating = nr;
  if (a.doping) {
    changeStat(p, "health", -2);
    changeStat(p, "karma", -1);
  }
  a.form = clamp(Math.round(42 + a.consistency * 0.25 + (p.health - 60) * 0.3 + (rng.next() + rng.next() + rng.next() - 1.5) * 14 - (a.injury?.plan === "play" ? 15 : 0) - Math.max(0, 40 - a.mental) * 0.4));

  // ---- 7. the season ----
  const unattached = a.freeAgent && isContractedAthlete(p);
  rollPlaying(p, a, rng);
  const mods = seasonModifiers(a);
  const out = playSeason(p, a, rng, {
    missed: !healthy || a.banYears > 0 || unattached,
    reason: a.banYears > 0 ? "ban" : !healthy ? "injury" : unattached ? "unattached" : undefined,
    hurtSeverity: hurtSev,
    label: hurtLabel,
    bonus: mods.bonus,
    fameScale: mods.fameScale,
  });
  if (a.banYears > 0) out.summary = `Serving a ban (${a.banYears} year${a.banYears === 1 ? "" : "s"} left).`;
  if (bannedStart && a.banYears > 0 && a.banYears < 99) a.banYears -= 1;
  afterSeasonDepth(p, a, rng, notices, out, hurtSev);
  const senior = a.stage !== "youth";
  if (out.played) {
    a.record.seasons += 1;
    if (isContractedAthlete(p) && a.league >= 1) a.record.proSeasons += 1;
    if (hasFlag(p, "comeback_pending")) {
      clearFlag(p, "comeback_pending");
      setFlag(p, "comeback");
    }
  }
  const trophies = senior ? out.titles + (out.medal === "gold" ? 1 : 0) : 0;
  a.record.titles += trophies;
  if (senior && out.award) a.record.awards += 1;
  if (out.medal) a.record.medals += 1;
  a.record.caps += out.caps;
  if (a.doping) a.dopeTitles += trophies;
  addFame(p, rng, out.fame);
  changeStat(p, "happiness", out.happiness);
  a.record.bestRating = Math.max(a.record.bestRating, Math.round(a.rating));

  // ---- 8. money ----
  let income = 0;
  const salary = isContractedAthlete(p) && job ? job.salary : 0;
  income += salary;
  if (a.stipend > 0 && amateur) {
    p.bankBalance += a.stipend;
    income += a.stipend;
  }
  let bonus = 0;
  if (salary > 0 && a.league >= 1 && trophies > 0) {
    bonus = Math.round(salary * 0.1 * trophies);
    bonus = netExtra(p, salary, bonus);
    p.bankBalance += bonus;
    income += bonus;
  }
  const endorse = endorsementIncome(p, a, trophies);
  let endorseNet = 0;
  if (endorse > 0) {
    endorseNet = netExtra(p, salary + bonus, endorse);
    p.bankBalance += endorseNet;
    income += endorseNet;
  }
  const dealNet = dealIncome(p, a, rng, notices, salary + bonus + endorse);
  if (dealNet > 0) {
    p.bankBalance += dealNet;
    income += dealNet;
  }
  a.endorsements = endorse + (dealNet > 0 ? dealNet : 0);
  if (a.agent && income > 0) p.bankBalance -= Math.round(0.08 * income);
  a.record.earnings += Math.round(income);
  p.stats.highestSalary = Math.max(p.stats.highestSalary, salary);

  const rec = toRecord(p, a, out, income);
  a.history = [...a.history, rec].slice(-40);
  addLog(p, `Season (${rec.club}): ${out.summary}${income > 0 ? ` Earned ${money(income)}.` : ""}`);
  if (out.titles > 0 || out.medal || out.award || out.caps > 0) {
    notices.push(info(out.medal ? `${out.major}: ${out.medal} medal` : out.titles > 0 ? "Trophy Time" : out.award ?? "Season Review", out.summary, out.titles > 0 || out.medal ? "jackpot" : "good"));
  }

  // ---- 9. doping control ----
  if (a.doping) {
    const testRate = a.stage === "youth" ? 0 : a.stage === "college" ? 0.1 : [0.12, 0.2, 0.3, 0.4][a.league];
    if (rng.chance(testRate * 0.55)) caughtDoping(p, rng, notices);
  }

  // ---- 10. match-fixing exposure ----
  if (hasFlag(p, "ath:fixed") && rng.chance(0.14)) {
    clearFlag(p, "ath:fixed");
    setFlag(p, "match_fixer");
    addFame(p, rng, -30);
    changeStat(p, "karma", -10);
    changeStat(p, "happiness", -20);
    a.banYears = 99;
    if (isContractedAthlete(p)) dropContract(p);
    const body = "An investigation into betting patterns traced suspicious results back to you. You are banned for life and the police are at the door.";
    addLog(p, body);
    notices.push(info("Match-Fixing Scandal", body, "bad"));
    startTrial(p, { name: "Match Fixing", description: "Prosecutors proved you deliberately lost games for money.", years: 3, severity: "serious" });
    retireAthlete(p, notices, "ban");
    a.athMirror = p.skills.athletics;
    return;
  }

  // ---- 11. exposure and progression ----
  a.stageYears += 1;
  a.years += 1;
  const expoBase = { youth: 12, college: 22, semipro: 16, pro: 24, none: 0, retired: 0 }[a.stage];
  const expoGain = expoBase + (isContractedAthlete(p) ? a.league * 4 : 0) + (out.titles > 0 ? 15 : 0) + (out.place !== null && out.place <= 3 ? 6 : 0) + (out.award ? 10 : 0) + p.fame * 0.2;
  a.exposure = clamp(Math.round(a.exposure * 0.6 + expoGain * (out.played ? 1 : 0.5)));

  if (amateur) {
    // Cut for not keeping pace.
    const mat = Math.min(1, Math.max(0.1, (p.age - 7) / (sportInfo(a.sport).peak[0] - 7)));
    if (p.age >= 12 && a.rating < 0.6 * 62 * mat && rng.chance(0.35)) {
      releasePlayer(p, rng, notices, "You're not keeping pace with the other players in the programme.");
      a.athMirror = p.skills.athletics;
      return;
    }
    if (a.stage === "youth" && p.age >= youthMaxAge(a.sport)) {
      exitAmateur(p, 0);
      const body = "You aged out of the youth ranks without a pathway. The window has closed, though you can always start again as a late amateur.";
      addLog(p, body);
      notices.push(info("Aged Out", body, "neutral"));
      a.athMirror = p.skills.athletics;
      return;
    }
    const collegeOver =
      a.stage === "college" &&
      ((a.track === "college" && ((p.education.stage !== "University" && a.stageYears >= 1) || a.stageYears >= 5)) || (a.track === "academy" && (a.stageYears >= 4 || p.age >= 22)));
    if (collegeOver) {
      const draft = buildOffers(p, rng, true);
      const best = draft.filter((o) => o.kind === "pro" || o.kind === "semipro").sort((x, y) => y.league - x.league)[0];
      exitAmateur(p, 0);
      if (best) {
        const line = signContract(p, rng, best);
        addLog(p, `Your programme ended and you ${line}`);
        notices.push(info("Drafted!", `Your programme ended and you ${line}`, "good"));
      } else {
        const body = "Your programme ended and no club came in for you. You can look for a club as a free-agent amateur or move on.";
        addLog(p, body);
        notices.push(info("Undrafted", body, "bad"));
      }
      a.athMirror = p.skills.athletics;
      syncSkill(p);
      return;
    }
  }

  if (isContractedAthlete(p)) {
    if (job && !a.freeAgent) {
      a.contractYears -= 1;
      // Released mid-contract: terrible form while declining, or a long injury for an older player.
      const decliningBadly = a.rating < LEAGUE_MIN[0] - 8 && p.age >= 24;
      const longInjury = !!a.injury && a.injury.severity >= 3 && a.injury.yearsLeft >= 2 && p.age >= 30;
      if ((decliningBadly || longInjury) && rng.chance(0.5)) {
        releasePlayer(p, rng, notices, longInjury ? "Your injury has dragged on and the club has terminated your contract." : "Your level has dropped well below what the club needs.");
      } else if (a.contractYears <= 0) {
        a.expiring = true;
        const club = a.club;
        a.offers = expiryOffers(p, rng, club);
        const body = a.offers.some((o) => o.kind === "renew")
          ? `Your contract with ${club} has run out. Review the offers in the Athlete tab, or your agent will extend you on standard terms.`
          : a.offers.length > 0
            ? `${club} won't offer you a new deal, but other clubs are interested. Check the Athlete tab.`
            : `${club} won't renew you and nobody else has called. Your career may be over.`;
        addLog(p, body);
        notices.push(info("Contract Expiring", body, a.offers.length > 0 ? "neutral" : "bad"));
      }
    }
    if (a.freeAgent) {
      if (wasFA && !bannedStart) a.freeAgentYears += 1;
      a.offers = freeAgentOffers(p, rng);
      if (a.offers.length > 0) notices.push(info("Clubs Are Interested", `${a.offers.length} club${a.offers.length > 1 ? "s have" : " has"} made an offer. Open the Athlete tab.`, "good"));
    }
  }

  // ---- 12. offers that depend on the stage ----
  if (a.offers.length === 0 && !a.expiring && !a.freeAgent) {
    a.offers = buildOffers(p, rng);
    if (a.offers.length > 0) {
      const kinds = a.offers.map((o) => o.kind).join(", ");
      addLog(p, `Offers on the table: ${kinds}.`);
      notices.push(info("Scouts Are Calling", `You have ${a.offers.length} offer${a.offers.length > 1 ? "s" : ""} to consider (${kinds}). Decide in the Athlete tab; they expire at the next Age Up.`, "good"));
    }
  }

  // ---- 12b. the human side: transfer requests, national team, sponsors ----
  resolveTransferRequest(p, a, rng, notices, () => {
    const lg = clamp(leagueFor(a.rating + (a.doping ? 4 : 0) + rng.int(-2, 3)), Math.max(0, a.league - 1), 3);
    return isContractedAthlete(p) ? makeOffer("transfer", a.sport, lg, effRating(a), p.age, a.agent, rng, "") : null;
  });
  lateDepth(p, a, rng, notices);

  // ---- 13. age takes its toll ----
  const sinfo = sportInfo(a.sport);
  if (isContractedAthlete(p) || a.freeAgent) {
    const over = p.age - sinfo.maxAge;
    const forcedAge = over >= 0 && rng.chance(Math.min(1, 0.5 + 0.25 * over));
    const noMarket = a.freeAgent && (a.freeAgentYears >= 2 || (a.offers.length === 0 && a.freeAgentYears >= 1 && a.rating < 44));
    if (forcedAge || noMarket) {
      retireAthlete(p, notices, noMarket && !forcedAge ? "cut" : "age");
      a.athMirror = p.skills.athletics;
      syncSkill(p);
      return;
    }
  }
  syncSkill(p);
}

function syncSkill(p: PlayerState) {
  p.skills.athletics = clamp(Math.round(p.athlete.rating * 0.92));
  p.athlete.athMirror = p.skills.athletics;
}

/** Back from injury: apply the lasting damage. Returns true if the player never plays again. */
function healInjury(p: PlayerState, rng: Rng, notices: Notices): boolean {
  const a = p.athlete;
  const inj = a.injury!;
  a.rating = clamp(a.rating - inj.ratingLoss);
  a.injury = null;
  if (inj.rushed && rng.chance(0.3 + 0.1 * (inj.severity - 2))) {
    // Came back too soon: it flares up and the whole comeback is lost.
    a.injury = { ...inj, label: `Recurring ${inj.label.toLowerCase()}`, yearsLeft: 1, plan: "rest", ratingLoss: Math.round((inj.ratingLoss * 0.6 + 1) * 10) / 10, decided: false, rushed: false };
    changeStat(p, "health", -6);
    a.mental = clamp(a.mental - 8);
    const body = `You rushed back and your ${inj.label.toLowerCase()} flared up again. That is another season gone and more lasting damage.`;
    addLog(p, body);
    notices.push(info("Setback", body, "bad"));
    return false;
  }
  if (inj.severity >= 3) setFlag(p, "comeback_pending");
  if (inj.severity >= 3 && p.age >= 33 && rng.chance(0.25)) {
    retireAthlete(p, notices, "injury");
    return true;
  }
  if (inj.severity >= 2) {
    const body = `You're back after your ${inj.label.toLowerCase()}${inj.ratingLoss > 0 ? `, though it cost you ${Math.round(inj.ratingLoss * 10) / 10} rating points for good` : ""}.`;
    addLog(p, body);
    notices.push(info("Back in Training", body, "good"));
  }
  return false;
}

/** The year for someone who isn't currently in the sport (never started, quit, or retired). */
function passiveYear(p: PlayerState, rng: Rng, notices: Notices, hadOffers: number) {
  const a = p.athlete;
  if (a.banYears > 0 && a.banYears < 99) a.banYears -= 1;
  a.offers = [];
  a.dealOffers = [];
  a.injury = null;
  a.endorsements = 0;
  a.mental = clamp(Math.round(a.mental + (70 - a.mental) * 0.3));
  a.narrative = "";
  if (a.sport && a.rating > 0) a.rating = clamp(a.rating - (a.stage === "retired" ? 3 : 2.5));
  if (a.stage !== "retired") return;
  // Legacy income fades with time.
  const yrs = p.age - (a.retiredAge ?? p.age);
  const fade = Math.max(0, 1 - 0.08 * yrs);
  if (fade > 0 && (a.record.titles > 0 || a.record.bestRating >= 74) && a.banYears === 0 && !hasFlag(p, "doping_caught")) {
    const legacy = Math.round(endorsementIncome(p, a, 0) * fade);
    if (legacy > 0) {
      const net = netExtra(p, p.currentJob?.salary ?? 0, legacy);
      p.bankBalance += net;
      a.endorsements = legacy;
      a.record.earnings += legacy;
    }
  }
  if (a.stage === "retired") hallBallot(p, a, rng, notices, yrs);
  if (hasFlag(p, "hall_of_fame") && yrs <= 8) addFame(p, rng, 0.5);
  else if (p.fame > 20 && yrs <= 6 && a.record.titles > 0) addFame(p, rng, 0.8); // part-offsets the generic fame decay
  if (a.post === "academy" && !p.business) a.post = "none";
  if (a.post === "none" || !p.currentJob) {
    if (!p.currentJob && a.post !== "academy") a.post = "none";
    a.offers = postOffers(p, rng);
    if (a.offers.length > 0 && hadOffers === 0) notices.push(info("Post-Career Offers", "Someone wants to hire you in a coaching or media role. See the Athlete tab.", "good"));
  }
}
