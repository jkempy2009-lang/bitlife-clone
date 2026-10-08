/** Mutating helpers shared by the yearly season processing and the player's actions. */
import type { ActionResult, AthleteOffer, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { money } from "@/lib/format";
import { incomeTaxFor } from "@/data/countries";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { sportInfo } from "@/data/sports";
import { addLog, changeStat, clearFlag, hasFlag, setFlag } from "./state";
import { makeJob } from "./career";

export type Notices = NonNullable<ActionResult["notices"]>;

export const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

/** After-tax value of extra income on top of a base salary (marginal tax). */
export function netExtra(p: PlayerState, base: number, extra: number): number {
  if (extra <= 0) return extra;
  const country = p.residence.country;
  return Math.round(extra - (incomeTaxFor(country, base + extra) - incomeTaxFor(country, base)));
}

export const athleteJob = (p: PlayerState) => (p.currentJob?.lineId === "athlete" ? p.currentJob : null);

function recordPeak(p: PlayerState) {
  const j = p.currentJob;
  if (!j) return;
  const a = p.athlete;
  a.record.peakSalary = Math.max(a.record.peakSalary, j.salary);
  if (j.salary > p.stats.highestSalary) {
    p.stats.highestSalary = j.salary;
    p.stats.highestCareerTitle = `${j.title} at ${j.company}`;
    p.stats.highestCareerTier = j.tier;
  }
}

/** Put the player under contract (new signing, renewal or transfer). Returns the log line. */
export function signContract(p: PlayerState, rng: Rng, o: AthleteOffer): string {
  const a = p.athlete;
  const sinfo = sportInfo(a.sport);
  const renew = o.kind === "renew" && athleteJob(p) !== null;
  if (!renew && o.club !== a.club) {
    // A new dressing room: chemistry, the coach and the armband all start over.
    a.chemistry = 40;
    a.coachRel = 45;
    a.captain = false;
    a.transferReq = false;
  }
  const job = renew ? p.currentJob! : makeJob(CAREER_BY_ID.athlete, o.league, rng);
  job.title = sinfo.titles[o.league];
  job.company = o.club;
  job.salary = o.salary;
  job.tier = o.league;
  job.lineId = "athlete";
  job.performance = Math.max(60, job.performance);
  if (!renew) job.yearsInRole = 0;
  p.currentJob = job;
  p.annualSalary = o.salary;
  a.stage = o.league === 0 ? "semipro" : "pro";
  a.league = o.league;
  a.club = o.club;
  a.contractYears = o.years;
  a.expiring = false;
  a.freeAgent = false;
  a.freeAgentYears = 0;
  a.track = null;
  a.scholarship = false;
  a.stipend = 0;
  if (!renew) a.stageYears = 0;
  a.offers = [];
  setFlag(p, "athlete");
  setFlag(p, "athlete_career");
  clearFlag(p, "ex_athlete");
  if (o.bonus > 0) {
    p.bankBalance += netExtra(p, o.salary, o.bonus);
    a.record.earnings += o.bonus;
  }
  recordPeak(p);
  return `${renew ? "re-signed with" : "signed with"} ${o.club} (${sinfo.leagues[o.league]}): ${money(o.salary)} a year for ${o.years} season${o.years === 1 ? "" : "s"}${o.bonus ? `, plus a ${money(o.bonus)} signing bonus` : ""}.`;
}

/** Remove the athlete contract (release, quit, ban). Does not touch stage; callers decide what comes next. */
export function dropContract(p: PlayerState) {
  if (athleteJob(p)) {
    p.currentJob = null;
    p.annualSalary = 0;
  }
  const a = p.athlete;
  a.contractYears = 0;
  a.expiring = false;
  clearFlag(p, "athlete");
}

/** Leave the amateur pipeline (cut, quit, aged out). */
export function exitAmateur(p: PlayerState, lockYears: number) {
  const a = p.athlete;
  a.stage = "none";
  a.track = null;
  a.scholarship = false;
  a.warnings = 0;
  a.stipend = 0;
  a.stageYears = 0;
  a.offers = [];
  a.lockedUntil = Math.max(a.lockedUntil, p.age + lockYears);
}

/** Retire from the sport. `reason` shapes the emotional and financial landing. */
export function retireAthlete(p: PlayerState, notices: Notices, reason: "chosen" | "age" | "injury" | "cut" | "ban") {
  const a = p.athlete;
  const job = athleteJob(p);
  const wasPro = a.stage === "pro" || a.stage === "semipro";
  const salary = job?.salary ?? 0;
  const league = a.league;
  dropContract(p);
  a.stage = "retired";
  a.retiredAge = p.age;
  a.track = null;
  a.scholarship = false;
  a.stipend = 0;
  a.offers = [];
  a.injury = null;
  a.freeAgent = false;
  a.expiring = false;
  a.doping = false;
  a.deals = [];
  a.dealOffers = [];
  a.natCall = null;
  a.natPlan = "balanced";
  a.captain = false;
  a.transferReq = false;
  a.playing = 100;
  setFlag(p, "ex_athlete");
  const mood = { chosen: -2, age: -4, injury: -12, cut: -10, ban: -10 }[reason];
  changeStat(p, "happiness", mood);

  const lines: string[] = [];
  const why = {
    chosen: "You hung up your boots on your own terms.",
    age: "Your body told you it was time. No club came calling.",
    injury: "A career-ending injury forced you to stop.",
    cut: "No club wanted you any more, and you called it a day.",
    ban: "With a ban and a ruined name, you walked away.",
  }[reason];
  lines.push(why);
  const r = a.record;
  if (wasPro && reason !== "ban" && reason !== "cut" && league >= 2 && r.proSeasons >= 8 && p.fame >= 50) {
    const gift = Math.round(salary * 0.25);
    p.bankBalance += netExtra(p, 0, gift);
    lines.push(`Your old club held a testimonial match in your honour and you pocketed ${money(netExtra(p, 0, gift))}.`);
  }
  if (r.bestRating >= 88 && r.titles >= 3 && r.proSeasons >= 8 && reason !== "ban") {
    setFlag(p, "hall_of_fame");
    a.hofYear = p.year;
    changeStat(p, "fame", 8);
    lines.push("You were inducted into the Hall of Fame.");
  }
  if (hasFlag(p, "ath:planned") && wasPro && r.earnings > 0) {
    const nest = Math.round((r.earnings * 0.05) / 500) * 500;
    p.bankBalance += nest;
    lines.push(`The savings plan you started years ago matured: ${money(nest)} waiting for you.`);
  }
  if (wasPro && r.proSeasons > 0) lines.push(`Career: ${r.proSeasons} pro season${r.proSeasons === 1 ? "" : "s"}, ${r.titles} title${r.titles === 1 ? "" : "s"}, ${money(r.earnings)} earned.`);
  const body = lines.join(" ");
  addLog(p, `Retired from ${a.sport?.toLowerCase() ?? "sport"}. ${body}`);
  notices.push(info(reason === "injury" ? "Career-Ending Injury" : "Retired", body, reason === "chosen" || reason === "age" ? "neutral" : "bad"));
}
