/**
 * The human side of a sporting career, layered on top of the season simulation in athleteSeason.ts:
 * morale and burnout, locker-room politics (chemistry, coach, minutes, captaincy), sponsorship deals and
 * their image risk, rivalries and media narratives, and the national-team cycle.
 *
 * Everything here mutates the player in place (the caller already works on a clone) and uses only the
 * seeded rng. Player-facing actions live in athleteLife.ts.
 */
import type { AthleteState, DealCategory, EndorsementDeal, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { LEAGUE_MIN, sportInfo } from "@/data/sports";
import { addLog, changeStat, hasFlag, setFlag } from "./state";
import { endorsementIncome, effRating, gauss, majorQualifier, referenceRating, type SeasonOutcome } from "./athleteModel";
import { info, netExtra, type Notices } from "./athleteCareer";
import { isContractedAthlete } from "./athleteState";

// ---------------------------------------------------------------------------
// Sponsorship catalogue
// ---------------------------------------------------------------------------

export interface DealKind {
  emoji: string;
  label: string;
  brands: string[];
  /** Pay relative to the baseline endorsement value. */
  pay: number;
  /** Yearly chance of a brand-related scandal at a neutral image. */
  risk: number;
  /** Image change per season while the deal runs. */
  image: number;
  blurb: string;
  scandal: string;
}

export const DEAL_KINDS: Record<DealCategory, DealKind> = {
  apparel: {
    emoji: "👟", label: "Sportswear", brands: ["Stride", "Apex Athletics", "Northline", "Volt Sport"], pay: 1, risk: 0.02, image: 0,
    blurb: "Safe, well paid and a bit dull. The default choice.",
    scandal: "Reports of sweatshop labour in the brand's supply chain put your face on the wrong posters.",
  },
  drink: {
    emoji: "🥤", label: "Energy drink", brands: ["Surge Energy", "Rocket Fuel", "Pulse Cola"], pay: 1.25, risk: 0.05, image: -0.5,
    blurb: "Good money. Health campaigners are not fans.",
    scandal: "Doctors slammed the drink you front for being marketed to teenagers. The comments section was brutal.",
  },
  watch: {
    emoji: "⌚", label: "Luxury watches", brands: ["Haldane & Co", "Meridian", "Orsay"], pay: 1.1, risk: 0.03, image: 0.5,
    blurb: "Prestige by association, but a flashy lifestyle story is never far away.",
    scandal: "Photos of a lavish party in the brand's gear sparked a row about athletes and excess.",
  },
  betting: {
    emoji: "🎰", label: "Betting company", brands: ["BetKing", "LuckyLine", "SpinBet"], pay: 1.9, risk: 0.12, image: -1.5,
    blurb: "The biggest cheque on the table. Fans, families and regulators dislike it, and it invites questions about your games.",
    scandal: "A gambling-addiction charity ran a campaign naming you as the face of betting. Papers piled on.",
  },
  fintech: {
    emoji: "🪙", label: "Crypto platform", brands: ["CoinRush", "Zenith Exchange", "MoonVault"], pay: 2.4, risk: 0.16, image: -1,
    blurb: "An eye-watering fee for fronting a platform that may not survive the year.",
    scandal: "The platform you promoted collapsed and fans lost their savings. They remember whose face was on the ads.",
  },
  charity: {
    emoji: "🤝", label: "Charity ambassador", brands: ["Playfields Trust", "Open Gate Foundation", "Kids First"], pay: 0.25, risk: 0, image: 2,
    blurb: "Pays peanuts, but sponsors, fans and the press love it.",
    scandal: "",
  },
};

export const maxDeals = (p: PlayerState) => 1 + (p.fame >= 45 ? 1 : 0) + (p.fame >= 70 ? 1 : 0);

/** Who may be approached by sponsors at all. */
export const dealEligible = (p: PlayerState, a: AthleteState) =>
  a.banYears === 0 && a.stage !== "youth" && a.stage !== "none" && a.stage !== "retired" && !hasFlag(p, "doping_ban") && p.fame >= 30;

export function rollDealOffers(p: PlayerState, a: AthleteState, rng: Rng): EndorsementDeal[] {
  if (!dealEligible(p, a)) return [];
  const base = endorsementIncome(p, a, 0);
  if (base <= 0) return [];
  const held = new Set(a.deals.map((d) => d.category));
  const cats = (Object.keys(DEAL_KINDS) as DealCategory[]).filter((c) => !held.has(c));
  const out: EndorsementDeal[] = [];
  const n = rng.chance(0.55) ? (rng.chance(0.4) ? 2 : 1) : 0;
  for (let i = 0; i < n && cats.length > 0; i++) {
    // Shady money is on offer to everyone; charities want people with a clean name.
    const cat = rng.weighted(cats, (c) => (c === "charity" ? (a.image >= 55 ? 0.8 : 0.1) : c === "betting" || c === "fintech" ? 0.8 : 1)) ?? cats[0];
    cats.splice(cats.indexOf(cat), 1);
    const k = DEAL_KINDS[cat];
    out.push({
      id: rng.id(),
      brand: rng.pick(k.brands),
      category: cat,
      pay: Math.max(2_500, Math.round((base * k.pay * rng.float(0.8, 1.25)) / 500) * 500),
      years: rng.int(1, a.league >= 3 ? 4 : 3),
    });
  }
  return out;
}

/** Pay out the season's deals, apply image drift, and roll for scandals. Returns the gross fee. */
function processDeals(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices): number {
  if (a.deals.length === 0) return 0;
  let gross = 0;
  const kept: EndorsementDeal[] = [];
  for (const d of a.deals) {
    const k = DEAL_KINDS[d.category];
    gross += d.pay;
    a.image = clamp(a.image + k.image);
    if (d.category === "betting") changeStat(p, "karma", -1);
    const risk = k.risk * (1 + Math.max(0, 60 - a.image) / 80);
    if (risk > 0 && rng.chance(risk)) {
      const hit = rng.int(8, 16);
      a.image = clamp(a.image - hit);
      changeStat(p, "fame", -1);
      changeStat(p, "happiness", -4);
      if (d.category === "fintech") changeStat(p, "karma", -3);
      const body = `${k.scandal} ${d.brand} dropped you, and your image fell ${hit} points.`;
      addLog(p, body);
      notices.push(info(`${d.brand} Scandal`, body, "bad"));
      continue;
    }
    d.years -= 1;
    if (d.years > 0) kept.push(d);
    else notices.push(info("Sponsorship Ended", `Your deal with ${d.brand} has run its course.`, "neutral"));
  }
  a.deals = kept;
  return gross;
}

/** Legal bill for contesting a positive test. */
export const appealCost = (a: AthleteState) => Math.min(60_000, 12_000 + Math.round((a.record.earnings * 0.01) / 500) * 500);

/** Net sponsorship income for the season, after tax. Also ages the deals. */
export function dealIncome(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices, taxBase: number): number {
  const gross = processDeals(p, a, rng, notices);
  return gross > 0 ? netExtra(p, taxBase, gross) : 0;
}

// ---------------------------------------------------------------------------
// Locker room
// ---------------------------------------------------------------------------

const hasTeamLife = (a: AthleteState) => a.stage === "college" || a.stage === "semipro" || a.stage === "pro";

/** Before the season: how much you play. Individual sports always play. */
export function rollPlaying(p: PlayerState, a: AthleteState, rng: Rng) {
  if (!sportInfo(a.sport).team || !hasTeamLife(a) || a.freeAgent) {
    a.playing = 100;
    return;
  }
  const raw = 62 + (effRating(a) - referenceRating(a, p.age)) * 2.4 + (a.coachRel - 50) * 0.35 + (a.captain ? 8 : 0) + (a.form - 50) * 0.15 + gauss(rng, 0, 5);
  a.playing = clamp(Math.round(raw), 8, 100);
}

/** Season-score and fame adjustments from team politics. */
export function seasonModifiers(a: AthleteState): { bonus: number; fameScale: number } {
  const team = sportInfo(a.sport).team;
  const bonus = (team ? (a.chemistry - 50) * 0.08 : (a.chemistry - 50) * 0.04) + (a.coachRel - 50) * 0.03 + (a.captain ? 1.5 : 0) + (team ? (a.playing - 65) * 0.05 : 0) - Math.max(0, 40 - a.mental) * 0.12;
  const fameScale = team ? clamp(0.55 + a.playing / 150, 0.55, 1.2) : 1;
  return { bonus, fameScale };
}

/** Wipe club-specific relationships when you move. */
export function resetClubLife(a: AthleteState) {
  a.chemistry = 40;
  a.coachRel = 45;
  a.captain = false;
  a.transferReq = false;
}

function updateLockerRoom(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices, out: SeasonOutcome) {
  if (!hasTeamLife(a)) return;
  const bottom = out.place !== null && out.place >= out.teams - 2;
  let chem = (55 - a.chemistry) * 0.15 + (out.titles > 0 ? 6 : 0) + (bottom ? -4 : 0) + (a.captain ? 2 : 0) + (a.playing < 35 ? -2 : 0) + gauss(rng, 0, 2.5);
  if (a.mental < 30) chem -= 2;
  a.chemistry = clamp(Math.round(a.chemistry + chem));
  let coach = (50 - a.coachRel) * 0.1 + (a.playing >= 70 ? 2 : a.playing < 40 ? -4 : 0) + (out.titles > 0 ? 3 : 0) + gauss(rng, 0, 2);
  if (a.consistency < 35) coach -= 3;
  a.coachRel = clamp(Math.round(a.coachRel + coach));
  if (sportInfo(a.sport).team && rng.chance(0.07)) {
    a.coachRel = 50;
    const body = "The club sacked the head coach and brought in a new one. You start with a clean slate.";
    addLog(p, body);
    notices.push(info("New Head Coach", body, "neutral"));
  }
  if (sportInfo(a.sport).team && a.playing < 35 && out.played && !a.transferReq) {
    notices.push(info("Stuck on the Bench", "You are barely getting minutes. Talk to the coach, work on your relationship, or ask to leave (Athlete tab, Team & Mind).", "bad"));
  }
  if (a.captain && (a.image < 25 || a.mental < 15)) {
    a.captain = false;
    const body = "The squad voted to take the armband away after a miserable stretch.";
    addLog(p, body);
    notices.push(info("Stripped of the Armband", body, "bad"));
  }
}

// ---------------------------------------------------------------------------
// Mind
// ---------------------------------------------------------------------------

function updateMental(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices, out: SeasonOutcome, hurtSev: number) {
  const bottom = out.played && out.place !== null && out.place >= out.teams - 2;
  let d = (65 - a.mental) * 0.12;
  d += p.effort === "grind" ? -4 : p.effort === "coast" ? 3 : 0;
  d -= [0, 0, 3, 6, 10][Math.min(4, hurtSev)];
  if (out.titles > 0 || out.medal) d += 5;
  if (out.award) d += 2;
  if (bottom) d -= 3;
  if (a.banYears > 0) d -= 6;
  if (a.playing < 35 && sportInfo(a.sport).team) d -= 5;
  if (a.doping) d -= 2;
  if (a.captain) d += 1;
  d += p.happiness < 30 ? -3 : p.happiness > 75 ? 2 : 0;
  d += gauss(rng, 0, 1.5);
  a.mental = clamp(Math.round(a.mental + d));
  if (a.mental <= 12 && (hasTeamLife(a) || a.stage === "youth")) {
    a.mental = 35;
    a.rating = clamp(a.rating - 3);
    a.consistency = clamp(a.consistency - 20);
    changeStat(p, "happiness", -10);
    changeStat(p, "health", -3);
    setFlag(p, "ath_burnout");
    const body = "The pressure finally broke you. You spent weeks unable to face training. A sport psychologist got you back on your feet, but the layoff cost you sharpness.";
    addLog(p, body);
    notices.push(info("Burnout", body, "bad"));
  } else if (a.mental < 30 && hasTeamLife(a)) {
    notices.push(info("Running on Empty", "Your morale is dangerously low. A sport psychologist (Team & Mind) or an easier training load could stop a burnout.", "bad"));
  }
}

// ---------------------------------------------------------------------------
// Rivalry and the media story
// ---------------------------------------------------------------------------

const RIVAL_FIRST = ["Marco", "Dmitri", "Luca", "Andre", "Kofi", "Jonas", "Tariq", "Mateo", "Ivan", "Rafael", "Elena", "Sofia", "Mei", "Amara", "Nadia", "Chloe"];
const RIVAL_LAST = ["Vasquez", "Kovac", "Okafor", "Lindqvist", "Moreau", "Tanaka", "Brandt", "Rossi", "Haddad", "Silva", "Novak", "Petrov", "Duarte", "Larsen"];

function updateRival(p: PlayerState, a: AthleteState, rng: Rng, out: SeasonOutcome) {
  if (!a.rival) {
    if (isContractedAthlete(p) && a.league >= 1 && a.record.proSeasons >= 1 && out.played && rng.chance(0.14)) {
      a.rival = { name: `${rng.pick(RIVAL_FIRST)} ${rng.pick(RIVAL_LAST)}`, heat: 20, wins: 0, losses: 0 };
    }
    return;
  }
  const r = a.rival;
  if (out.played) {
    const win = out.score + gauss(rng, 0, 6) > gauss(rng, 6, 6);
    if (win) r.wins += 1;
    else r.losses += 1;
    r.heat = clamp(Math.round(r.heat + (win ? 4 : 6) - 5));
    if (r.heat >= 60 && win && rng.chance(0.5)) changeStat(p, "fame", 1);
  }
  if (r.heat < 25 && rng.chance(0.1)) a.rival = null;
}

export function narrativeFor(p: PlayerState, a: AthleteState, out: SeasonOutcome | null): string {
  const info = sportInfo(a.sport);
  const last = a.history[a.history.length - 1];
  if (a.banYears > 0 || (hasFlag(p, "doping_ban") && a.record.proSeasons > 0 && a.banYears > 0)) return "Disgraced";
  if (a.image < 35) return "The villain";
  if (a.mental < 30) return "Under pressure";
  if (hasFlag(p, "comeback")) return "Comeback kid";
  if (p.age <= 22 && a.rating >= 60 && (out?.titles ?? 0) > 0) return "Wonderkid";
  if ((out?.titles ?? 0) > 0 && (last?.titles ?? 0) > 0) return "Dynasty";
  if (a.rival && a.rival.heat >= 60) return `Feud with ${a.rival.name}`;
  if (p.age > info.peak[1] + 1 && a.rating >= LEAGUE_MIN[a.league] && isContractedAthlete(p)) return "Old guard";
  if (out && out.played && out.place !== null && out.place >= out.teams - 2) return "Struggling";
  if (a.captain) return "The captain";
  return "";
}

// ---------------------------------------------------------------------------
// National team
// ---------------------------------------------------------------------------

export const majorYear = (sport: string | null, year: number) => year % 4 === sportInfo(sport).major.offset;

/** Year after year the same four-year cycle: invitations go out the season before, results arrive in the major year. */
function nationalCycle(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices) {
  const sinfo = sportInfo(a.sport);
  if (a.natCall && a.natCall.year <= p.year) {
    // The tournament has been played (or skipped). Pay what the plan cost.
    const plan = a.natPlan;
    if (a.natCall.selected && plan === "allin") {
      changeStat(p, "happiness", -2);
      a.mental = clamp(a.mental - 4);
      a.coachRel = clamp(a.coachRel - 4);
      p.bankBalance -= Math.min(Math.max(0, p.bankBalance), 8_000);
    } else if (a.natCall.selected && plan === "withdraw") {
      a.mental = clamp(a.mental + 5);
      a.coachRel = clamp(a.coachRel + 4);
      changeStat(p, "fame", -1);
    }
    a.natCall = null;
    a.natPlan = "balanced";
  }
  if (a.natCall || !majorYear(a.sport, p.year + 1)) return;
  if (!(isContractedAthlete(p) || a.stage === "college")) return;
  if (p.age > sinfo.maxAge - 3 || a.banYears > 0 || a.freeAgent) return;
  const eff = effRating(a);
  if (!majorQualifier(a, eff)) return;
  const thr = sinfo.team ? 70 : 64;
  const chance = clamp(0.55 + (eff - thr) / 30 + (a.exposure - 50) / 300 + (sinfo.team ? (a.coachRel - 50) / 200 : 0) + (a.captain ? 0.08 : 0) - (a.injury ? 0.3 : 0) - (a.image < 35 ? 0.1 : 0), 0.12, 0.97);
  const selected = rng.chance(chance);
  a.natCall = { year: p.year + 1, major: sinfo.major.name, selected };
  a.natPlan = "balanced";
  if (selected) {
    const body = `You've been named in the national squad for the ${sinfo.major.name} next year. Commit fully, balance it with your club, or withdraw: see the Athlete tab.`;
    addLog(p, body);
    notices.push(info("National Squad Call-Up", body, "good"));
  } else {
    const body = `The selectors left you out of the ${sinfo.major.name} squad. A bitter pill when you believed you'd earned it.`;
    a.mental = clamp(a.mental - 4);
    addLog(p, body);
    notices.push(info("Snubbed", body, "bad"));
  }
}

// ---------------------------------------------------------------------------
// The yearly hook
// ---------------------------------------------------------------------------

/** After the season is played: update everything human. Call once per processed season. */
export function afterSeasonDepth(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices, out: SeasonOutcome, hurtSev: number) {
  updateMental(p, a, rng, notices, out, hurtSev);
  updateLockerRoom(p, a, rng, notices, out);
  updateRival(p, a, rng, out);
  // Image drifts back towards neutral, with success polishing it.
  a.image = clamp(Math.round(a.image + (60 - a.image) * 0.08 + (out.titles > 0 ? 1.5 : 0) + (out.medal ? 2 : 0)));
  a.narrative = narrativeFor(p, a, out);
  if (a.narrative === "Wonderkid" || a.narrative === "Dynasty" || a.narrative === "Comeback kid") a.image = clamp(a.image + 1);
  if (a.narrative === "The villain") a.image = clamp(a.image - 1);
}

/** Late in the yearly transaction, once offers have been built. */
export function lateDepth(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices) {
  nationalCycle(p, a, rng, notices);
  // New sponsorship offers (they expire at the next Age Up).
  a.dealOffers = rollDealOffers(p, a, rng);
  if (a.dealOffers.length > 0) notices.push(info("Sponsors Are Calling", `${a.dealOffers.length} brand${a.dealOffers.length > 1 ? "s want" : " wants"} you as the face of a campaign. See Brand deals in the Athlete tab.`, "good"));
}

/** A transfer request is a gamble: the club may shop you around, or freeze you out. */
export function resolveTransferRequest(p: PlayerState, a: AthleteState, rng: Rng, notices: Notices, makeOffer: () => import("@/types/game.types").AthleteOffer | null) {
  if (!a.transferReq) return;
  a.transferReq = false;
  if (!isContractedAthlete(p) || a.freeAgent || a.expiring) return;
  const sold = rng.chance(clamp(0.55 + (effRating(a) - LEAGUE_MIN[a.league]) * 0.02 + (a.coachRel - 50) / 300, 0.25, 0.9));
  const o = sold ? makeOffer() : null;
  if (o) {
    o.note = "The club agreed to let you go. Take it, or stay and swallow your pride.";
    a.offers.push(o);
    notices.push(info("Transfer Request Granted", `${o.club} have come in for you. Review the offer in the Athlete tab.`, "good"));
  } else {
    changeStat(p, "happiness", -4);
    a.coachRel = clamp(a.coachRel - 6);
    const body = "The club refused to sell you. You're staying, and the dressing room hasn't forgotten you tried to leave.";
    addLog(p, body);
    notices.push(info("Request Refused", body, "bad"));
  }
}
