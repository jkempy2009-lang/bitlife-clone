/**
 * Life inside: work, programmes, gangs, solitary, visits, parole hearings, appeals, escape.
 * Release (sentence served, good time, parole, exoneration, juvenile age-out) is centralised here.
 */
import type { ActionResult, PlayerState, PrisonState, Probation } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { lawFor } from "@/data/justiceCountries";
import { addLog, changeStat, clone, hasFlag, setFlag } from "./state";
import { hydratePrison } from "./justiceState";
import { addHeat, isViolentName, sealJuvenileRecord } from "./justice";
import { killPlayer } from "./mortality";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const PRISON_JOBS = [
  { id: "kitchen", name: "Kitchen Duty", wage: 1.0, blurb: "Early starts, hot work, a little extra food." },
  { id: "laundry", name: "Laundry", wage: 0.8, blurb: "Dull, steady, safe." },
  { id: "library", name: "Library Clerk", wage: 0.7, blurb: "Quiet hours and a reputation as harmless. Needs 40+ Smarts.", minSmarts: 40 },
  { id: "workshop", name: "Prison Industries", wage: 1.4, blurb: "Make licence plates and furniture for pocket money." },
] as const;

export const PRISON_PROGRAMS = [
  { id: "ged", name: "GED Classes", years: 1, emoji: "📘", blurb: "A high school diploma behind bars. Only if you don't have one." },
  { id: "trade", name: "Vocational Trade", years: 1, emoji: "🔧", blurb: "Carpentry, welding or HVAC. Employers on the outside do notice." },
  { id: "therapy", name: "Counselling & Rehab", years: 1, emoji: "🧠", blurb: "Group therapy and addiction treatment. Parole boards love it." },
  { id: "degree", name: "College Degree", years: 4, emoji: "🎓", blurb: "Four years of correspondence study toward a bachelor's degree. Needs a diploma and 45+ Smarts." },
] as const;

export const PRISON_GANGS = [
  { id: "brotherhood", name: "The Brotherhood", blurb: "Old, organised and everywhere. Strong protection, strong obligations." },
  { id: "syndicate", name: "The Syndicate", blurb: "Business-minded. Good contraband, ruthless about debts." },
  { id: "crew", name: "Block C Crew", blurb: "Local boys. Loyal, loud, and always at war with someone." },
] as const;

export const MAX_VISITS = 3;

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

/** Make sure a hand-built or old prison record has every field. */
export function norm(p: PlayerState): PrisonState | null {
  if (!p.prison) return null;
  p.prison = hydratePrison(p.prison);
  return p.prison;
}

export const sentenceLeft = (pr: PrisonState) => Math.max(0, pr.sentenceYears - pr.yearsServed);

/** Years that must be served before the parole board will hear you. */
export function paroleEligibleAt(pr: PrisonState): number {
  return Math.ceil(pr.sentenceYears * (pr.sentenceYears >= 20 ? 0.7 : 0.5));
}

export function paroleOdds(p: PlayerState): number {
  const pr = p.prison;
  if (!pr) return 0;
  const conduct = pr.conduct ?? 70;
  const progs = (pr.programs ?? []).length;
  let c = 0.12 + conduct / 250 + Math.min(0.18, progs * 0.06);
  if (pr.job) c += 0.05;
  if (pr.gang) c -= 0.12;
  c -= (pr.solitary ?? 0) * 0.06;
  if (isViolentName(pr.charge)) c -= 0.08;
  c -= Math.min(0.12, p.justice.convictions * 0.03);
  c += (p.karma - 30) / 400;
  c += Math.min(0.1, Math.max(0, pr.yearsServed - paroleEligibleAt(pr)) * 0.03);
  if (hasFlag(p, "fugitive")) c -= 0.1;
  if (pr.wrongful) c -= 0.05; // refusing to show "remorse" for something you did not do
  return clamp(c, 0.03, 0.75);
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

export type ReleaseKind = "sentence" | "good_time" | "parole" | "exonerated" | "juvenile";

export function releaseFromPrison(p: PlayerState, kind: ReleaseKind, rng: Rng, notices: Notices) {
  const pr = norm(p);
  if (!pr) {
    p.isInPrison = false;
    return;
  }
  const charge = pr.charge;
  const served = pr.yearsServed;
  p.isInPrison = false;
  p.prison = null;
  p.justice.releasedYear = p.year;
  p.justice.gangTies = pr.gang ?? p.justice.gangTies;
  for (const g of pr.programs ?? []) if (!p.justice.programs.includes(g)) p.justice.programs.push(g);
  let body: string;
  let title = "Released!";
  let tone: "good" | "jackpot" = "good";
  if (kind === "exonerated") {
    const law = lawFor(p.residence.country);
    const pay = Math.round(served * law.compensation);
    p.bankBalance += pay;
    p.justice.exonerations += 1;
    p.justice.convictions = Math.max(0, p.justice.convictions - 1);
    p.justice.felonies = Math.max(0, p.justice.felonies - 1);
    if (isViolentName(charge)) p.justice.violentConvictions = Math.max(0, p.justice.violentConvictions - 1);
    const i = p.criminalRecord.lastIndexOf(charge);
    if (i >= 0) p.criminalRecord.splice(i, 1);
    if (p.justice.convictions === 0) {
      p.flags = p.flags.filter((f) => f !== "ex_con");
      p.justice.lastConvictionYear = null;
    }
    p.justice.reentry = 2;
    changeStat(p, "happiness", 15);
    changeStat(p, "karma", 5);
    title = "Exonerated!";
    tone = "jackpot";
    body = `After ${served} year${served === 1 ? "" : "s"} for a crime you did not commit, the conviction for ${charge} was overturned. ${pay > 0 ? `The state paid ${money(pay)} in compensation.` : "The state offered an apology and nothing else."}`;
  } else if (kind === "juvenile") {
    p.justice.reentry = 0;
    changeStat(p, "happiness", 8);
    body = `You were released from juvenile detention after ${served} year${served === 1 ? "" : "s"}. The counsellors say you can still turn this around.`;
    if (p.age >= 18) {
      const line = sealJuvenileRecord(p, rng);
      if (line) addLog(p, line);
    }
    if (p.justice.adultTried) setFlag(p, "ex_con");
  } else {
    setFlag(p, "ex_con");
    p.justice.reentry = 3;
    addHeat(p, 0);
    p.justice.heat = Math.max(p.justice.heat, 20);
    p.bankBalance += 200;
    changeStat(p, "happiness", 10);
    body =
      kind === "parole" ? `The parole board granted your release after ${served} years. You have a bus ticket, 200 dollars gate money and a parole officer.`
      : kind === "good_time" ? `Good behaviour earned you an early release for ${charge} after ${served} years. Welcome back to freedom.`
      : `You served your full sentence for ${charge} and were released. Welcome back to freedom. It will be harder than you remember.`;
    title = kind === "parole" ? "Paroled!" : "Released!";
  }
  p.currentJob = null;
  p.annualSalary = 0;
  addLog(p, body);
  notices.push(info(title, body, tone));
}

function juvenileAgeOut(p: PlayerState, pr: PrisonState, rng: Rng, notices: Notices): boolean {
  if (!pr.juvenile || p.age < 18) return false;
  // Serious juveniles who still have time left are transferred; the rest walk out.
  if (sentenceLeft(pr) > 2) {
    pr.juvenile = false;
    const body = "You turned 18 with years still to serve. You were transferred to an adult facility.";
    addLog(p, body);
    notices.push(info("Transferred to Adult Prison", body, "bad"));
    return false;
  }
  releaseFromPrison(p, "juvenile", rng, notices);
  return true;
}

// ---------------------------------------------------------------------------
// Yearly life inside (called from processJustice)
// ---------------------------------------------------------------------------

export function processPrisonYear(p: PlayerState, rng: Rng, notices: Notices) {
  const pr = norm(p);
  if (!pr) return;
  pr.yearsServed += 1;
  p.stats.yearsInPrison += 1;
  changeStat(p, "happiness", -3);
  addHeat(p, -10);
  if (pr.deathRow) {
    if (pr.yearsServed >= pr.sentenceYears) {
      killPlayer(p, "execution");
      addLog(p, "You were executed by the state.");
    }
    return;
  }
  const conduct0 = pr.conduct ?? 70;
  let conduct = conduct0;
  let standing = pr.standing ?? 20;

  // Health: prison is hard on the body, harder on the old.
  changeStat(p, "health", p.age > 55 ? -2 : -1);

  // Violence inside.
  const risk = clamp(0.12 - (pr.gang ? 0.05 : 0) - standing / 1200 + (!pr.gang && p.justice.gangTies ? 0.04 : 0) - (pr.juvenile ? 0.03 : 0), 0.02, 0.2);
  if (rng.chance(risk)) {
    const dmg = rng.int(5, 18);
    changeStat(p, "health", -dmg);
    const fought = rng.chance(0.45);
    let body = `You were jumped in the yard. Health −${dmg}.`;
    if (fought) {
      conduct -= 12;
      standing += 5;
      body += " You fought back, and the guards wrote you up.";
      if (rng.chance(0.5)) {
        pr.solitary = (pr.solitary ?? 0) + 1;
        body += " One year in solitary.";
      }
    }
    addLog(p, body);
    notices.push(info("Trouble Inside", body, "bad"));
  }

  // Work.
  const job = PRISON_JOBS.find((j) => j.id === pr.job);
  if (job) {
    const wage = Math.round(rng.int(300, 900) * job.wage);
    p.bankBalance += wage;
    conduct += 3;
  }

  // Programmes in progress.
  for (const prog of PRISON_PROGRAMS) {
    if ((pr.programs ?? []).includes(prog.id)) continue;
    const done = (pr.progress ?? {})[prog.id];
    if (done === undefined) continue;
    pr.progress![prog.id] = done + 1;
    conduct += 2;
    if (done + 1 >= prog.years) {
      delete pr.progress![prog.id];
      pr.programs!.push(prog.id);
      let body = "";
      if (prog.id === "ged") {
        if (!p.education.degrees.includes("highschool")) p.education.degrees.push("highschool");
        changeStat(p, "smarts", 3);
        body = "You passed your GED exams behind bars. A diploma, finally.";
      } else if (prog.id === "trade") {
        changeStat(p, "smarts", 1);
        body = "You finished your trade certificate. Employers on the outside will see that you did something with your time.";
      } else if (prog.id === "therapy") {
        conduct += 8;
        changeStat(p, "happiness", 6);
        for (const k of Object.keys(p.vices) as (keyof PlayerState["vices"])[]) p.vices[k] = Math.max(0, p.vices[k] - 30);
        body = "You completed counselling and rehab. For the first time in years your head is clear.";
      } else {
        if (!p.education.degrees.some((d) => d.startsWith("bachelor"))) p.education.degrees.push("bachelor:arts");
        changeStat(p, "smarts", 6);
        changeStat(p, "happiness", 8);
        body = "You graduated with a bachelor's degree, earned from a prison cell.";
      }
      addLog(p, body);
      notices.push(info(`${prog.name} Complete`, body, "good"));
    }
  }

  // Gangs: protection and standing now, obligations always.
  if (pr.gang) {
    standing += 3;
    conduct -= 3;
    p.justice.gangTies = pr.gang;
    if (rng.chance(0.1)) {
      changeStat(p, "karma", -3);
      const body = "The gang asked for a favour inside. You did it. Nobody says no.";
      addLog(p, body);
      notices.push(info("A Favour", body, "bad"));
    }
  } else {
    standing += standing > 20 ? -1 : 1;
  }

  // Solitary hurts.
  if ((pr.solitary ?? 0) > 0) {
    changeStat(p, "health", -5);
    changeStat(p, "happiness", -8);
    conduct -= 2;
    pr.solitary = (pr.solitary ?? 0) - 1;
  } else {
    conduct += 1;
  }
  pr.conduct = clamp(Math.round(conduct));
  pr.standing = clamp(Math.round(standing));

  // Wrongly convicted: someone eventually looks at the file.
  if (pr.wrongful && rng.chance(0.03 + (pr.programs ?? []).length * 0.01)) {
    releaseFromPrison(p, "exonerated", rng, notices);
    return;
  }
  if (juvenileAgeOut(p, pr, rng, notices)) return;

  if (pr.yearsServed >= pr.sentenceYears) {
    releaseFromPrison(p, "sentence", rng, notices);
    return;
  }
  // Good time: model prisoners earn 15% off.
  if (!pr.juvenile && pr.sentenceYears >= 4 && (pr.conduct ?? 0) >= 65 && !pr.gang && pr.yearsServed >= Math.ceil(pr.sentenceYears * 0.85)) {
    releaseFromPrison(p, "good_time", rng, notices);
  }
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

const used = (p: PlayerState, key: string, limit = 1) => (p.annual[key] ?? 0) >= limit;

export function workOutYard(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if ((p.annual.yard ?? 0) >= 1) {
    return { player: p0, notices: [info("Spent", "You already worked out this year. Your arms say thanks.")] };
  }
  const pr = norm(p);
  p.annual.yard = 1;
  changeStat(p, "health", 3);
  if (pr) pr.standing = clamp((pr.standing ?? 20) + 3);
  const body = "You lifted weights in the yard. +3 Health, and the other inmates noticed.";
  addLog(p, body);
  return { player: p, notices: [info("Yard Time", body, "good")] };
}

export function studyInPrison(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if ((p.annual.prisonstudy ?? 0) >= 1) {
    return { player: p0, notices: [info("Lights out", "You've read enough this year.")] };
  }
  p.annual.prisonstudy = 1;
  changeStat(p, "smarts", 2);
  changeStat(p, "happiness", 1);
  const body = "You spent your free hours in the prison library. +2 Smarts.";
  addLog(p, body);
  return { player: p, notices: [info("Library Time", body, "good")] };
}

export function takePrisonJob(p0: PlayerState, jobId: string): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  const job = PRISON_JOBS.find((j) => j.id === jobId);
  if (!pr || !job || pr.deathRow) return { player: p0 };
  if (pr.job === job.id) return { player: p0, notices: [info("Already Yours", `You already work in ${job.name.toLowerCase()}.`)] };
  if ("minSmarts" in job && p.smarts < job.minSmarts) return { player: p0, notices: [info("Not Qualified", `${job.name} needs ${job.minSmarts}+ Smarts.`, "bad")] };
  if (pr.solitary) return { player: p0, notices: [info("In Solitary", "You can't hold a job from the hole.", "bad")] };
  pr.job = job.id;
  const body = `You were assigned to ${job.name.toLowerCase()}. Steady work counts in your favour with the parole board.`;
  addLog(p, body);
  return { player: p, notices: [info("Prison Job", body, "good")] };
}

export function enrollPrisonProgram(p0: PlayerState, id: string): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  const prog = PRISON_PROGRAMS.find((x) => x.id === id);
  if (!pr || !prog || pr.deathRow) return { player: p0 };
  if ((pr.programs ?? []).includes(id) || pr.progress![id] !== undefined) return { player: p0, notices: [info("Already Enrolled", `${prog.name}: you're already on it, or you've finished.`)] };
  if (id === "ged" && p.education.degrees.includes("highschool")) return { player: p0, notices: [info("Not Needed", "You already hold a diploma.")] };
  if (id === "degree") {
    if (!p.education.degrees.includes("highschool")) return { player: p0, notices: [info("Need a Diploma", "Finish a GED first.", "bad")] };
    if (p.smarts < 45) return { player: p0, notices: [info("Not Ready", "A prison degree needs 45+ Smarts.", "bad")] };
    if (p.education.degrees.some((d) => d.startsWith("bachelor"))) return { player: p0, notices: [info("Not Needed", "You already have a bachelor's degree.")] };
    if (prog.years > sentenceLeft(pr)) return { player: p0, notices: [info("Not Enough Time", `The degree takes ${prog.years} years; you have ${sentenceLeft(pr)} left.`, "bad")] };
  }
  if (Object.keys(pr.progress!).length >= 2) return { player: p0, notices: [info("Full Timetable", "You can only take two programmes at once.", "bad")] };
  pr.progress![id] = 0;
  const body = `You enrolled in ${prog.name}. It will take ${prog.years} year${prog.years === 1 ? "" : "s"}.`;
  addLog(p, body);
  return { player: p, notices: [info("Enrolled", body, "good")] };
}

export function joinPrisonGang(p0: PlayerState, gangId: string): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  const gang = PRISON_GANGS.find((g) => g.id === gangId);
  if (!pr || !gang || pr.juvenile) return { player: p0 };
  if (pr.gang) return { player: p0, notices: [info("Already Patched", "You already run with a gang. Leaving costs blood.", "bad")] };
  pr.gang = gang.id;
  pr.standing = clamp((pr.standing ?? 20) + 20);
  pr.conduct = clamp((pr.conduct ?? 70) - 10);
  p.justice.gangTies = gang.id;
  changeStat(p, "karma", -4);
  const body = `You joined ${gang.name}. Nobody touches you now, and your sentence just got more complicated.`;
  addLog(p, body);
  return { player: p, notices: [info("Patched In", body, "neutral")] };
}

export function leavePrisonGang(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (!pr?.gang) return { player: p0 };
  const gang = PRISON_GANGS.find((g) => g.id === pr.gang)?.name ?? "the gang";
  pr.gang = null;
  pr.standing = clamp((pr.standing ?? 20) - 25);
  const dmg = rng.int(10, 25);
  changeStat(p, "health", -dmg);
  p.justice.gangTies = null;
  const body = `${gang} did not let you go quietly. Health −${dmg}, but you're out.`;
  addLog(p, body);
  return { player: p, notices: [info("Walking Away", body, "bad")] };
}

export function protectiveCustody(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (!pr || pr.deathRow) return { player: p0 };
  if (used(p, "pc")) return { player: p0, notices: [info("Already Requested", "You asked for protective custody this year.")] };
  p.annual.pc = 1;
  pr.standing = clamp((pr.standing ?? 20) - 10);
  pr.conduct = clamp((pr.conduct ?? 70) + 5);
  changeStat(p, "health", 3);
  changeStat(p, "happiness", -3);
  const body = "You asked to be kept apart from the general population. It's safer, quieter and lonelier. Your standing took a hit.";
  addLog(p, body);
  return { player: p, notices: [info("Protective Custody", body, "neutral")] };
}

/** A visit from family or a friend: keeps the relationship alive while you are inside. */
export function prisonVisit(p0: PlayerState, relId: string): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  const rel = p.relatives.find((r) => r.id === relId && r.alive && r.relation !== "Pet");
  if (!pr || !rel) return { player: p0 };
  const total = Object.keys(p.annual).filter((k) => k.startsWith("visit:")).length;
  if (used(p, `visit:${relId}`)) return { player: p0, notices: [info("Already Visited", `${rel.name} already came this year.`)] };
  if (total >= MAX_VISITS) return { player: p0, notices: [info("Visiting Limit", `Only ${MAX_VISITS} visits are allowed per year.`, "bad")] };
  if (rel.relationshipBar < 12) return { player: p0, notices: [info("Won't Come", `${rel.name} has stopped answering your letters.`, "bad")] };
  p.annual[`visit:${relId}`] = 1;
  rel.relationshipBar = clamp(rel.relationshipBar + 10);
  changeStat(p, "happiness", 4);
  pr.conduct = clamp((pr.conduct ?? 70) + 1);
  const body = `${rel.name} visited you through the glass. It cost them a day's travel and a lot of pride. Relationship +10.`;
  addLog(p, body);
  return { player: p, notices: [info("Visiting Day", body, "good")] };
}

export const ESCAPE_PATHS = [
  { id: "tunnel", name: "Dig a Tunnel", blurb: "Slow, dirty, and weirdly romantic.", chance: 0.14 },
  { id: "disguise", name: "Guard Disguise", blurb: "Walk out the front door in a stolen uniform.", chance: 0.1 },
  { id: "laundry", name: "Laundry Truck", blurb: "Hide among the dirty sheets.", chance: 0.18 },
  { id: "riot_cover", name: "Escape During a Distraction", blurb: "Chaos is a ladder.", chance: 0.08 },
] as const;

export function attemptEscape(p0: PlayerState, pathId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const path = ESCAPE_PATHS.find((x) => x.id === pathId);
  const pr = norm(p);
  if (!path || !pr) return { player: p0 };
  if (pr.juvenile) return { player: p0, notices: [info("Not Here", "Juvenile detention has no walls worth the name. Walking out only makes it worse.", "neutral")] };
  if ((p.annual.escape ?? 0) >= 1) {
    return { player: p0, notices: [info("Too hot", "The guards are watching you closely this year.")] };
  }
  p.annual.escape = 1;
  const lawGuards = 1 / lawFor(p.residence.country).policing;
  if (rng.chance(clamp((path.chance + (p.smarts - 50) / 800) * lawGuards + (pr.gang ? 0.04 : 0), 0.02, 0.4))) {
    p.isInPrison = false;
    p.isFugitive = true;
    setFlag(p, "fugitive");
    setFlag(p, "escaped");
    changeStat(p, "karma", -10);
    addHeat(p, 60);
    const body = `You escaped via "${path.name}"! You're a free man... woman... person — but now a fugitive.`;
    addLog(p, body);
    return { player: p, notices: [info("ESCAPED!", body, "jackpot")] };
  }
  pr.sentenceYears += 3;
  pr.conduct = clamp((pr.conduct ?? 70) - 30);
  pr.solitary = (pr.solitary ?? 0) + 1;
  changeStat(p, "happiness", -10);
  changeStat(p, "health", -5);
  const body = `Your escape attempt ("${path.name}") failed. The warden added 3 years and a year in solitary.`;
  addLog(p, body);
  return { player: p, notices: [info("Escape Failed", body, "bad")] };
}

export function startRiot(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (pr?.juvenile) return { player: p0, notices: [info("Not Here", "A riot in juvenile detention just gets you transferred early.", "neutral")] };
  if ((p.annual.riot ?? 0) >= 1) {
    return { player: p0, notices: [info("Quiet down", "The guards are on high alert. No riot this year.")] };
  }
  p.annual.riot = 1;
  const roll = rng.next();
  let body: string;
  let tone: "good" | "bad" | "neutral";
  if (roll < 0.3) {
    changeStat(p, "health", -rng.int(10, 25));
    changeStat(p, "happiness", -rng.int(5, 12));
    body = "The riot turned violent. You took a beating before the guards restored order.";
    tone = "bad";
  } else if (roll < 0.7) {
    changeStat(p, "health", -rng.int(2, 8));
    changeStat(p, "happiness", rng.int(3, 8));
    changeStat(p, "fame", 1);
    body = "You threw a few punches, earned some respect, and escaped with bruises.";
    tone = "neutral";
  } else {
    changeStat(p, "happiness", rng.int(8, 14));
    changeStat(p, "health", -rng.int(0, 3));
    changeStat(p, "karma", -3);
    body = "The riot was glorious chaos. You came out the folk hero of Cell Block C.";
    tone = "good";
  }
  if (pr) {
    pr.conduct = clamp((pr.conduct ?? 70) - 25);
    pr.standing = clamp((pr.standing ?? 20) + 8);
    if (rng.chance(0.4)) {
      pr.solitary = (pr.solitary ?? 0) + 1;
      body += " They threw you in solitary for a year.";
    }
    if (rng.chance(0.35)) {
      pr.sentenceYears += 1;
      body += " Your sentence was extended by a year.";
    }
  }
  addLog(p, body);
  return { player: p, notices: [info("RIOT!", body, tone)] };
}

/** Death-row appeal, or a normal appeal against conviction. */
export function appealSentence(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (!pr) return { player: p0 };
  if (!pr.deathRow) return appealConviction(p0, rng, false);
  if ((p.annual.appeal ?? 0) >= 1) return { player: p0, notices: [info("Pending", "Your lawyers have already filed this year.")] };
  p.annual.appeal = 1;
  if (rng.chance(clamp(0.15 + p.smarts / 500, 0.1, 0.4))) {
    pr.deathRow = false;
    pr.sentenceYears = pr.yearsServed + 30;
    const body = "Your appeal succeeded. The death sentence was commuted to 30 more years in prison.";
    addLog(p, body);
    return { player: p, notices: [info("Commuted", body, "good")] };
  }
  const body = "The court rejected your appeal. The execution date draws closer.";
  addLog(p, body);
  return { player: p, notices: [info("Appeal Denied", body, "bad")] };
}

export const APPEAL_COUNSEL_COST = 10_000;

/** Appeal the conviction itself. Hiring counsel helps; a wrongful conviction helps most. */
export function appealConviction(p0: PlayerState, rng: Rng, hireCounsel: boolean): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (!pr || pr.deathRow) return { player: p0 };
  if ((p.annual.appeal ?? 0) >= 1) return { player: p0, notices: [info("Pending", "Your appeal is already before the court this year.")] };
  if (hireCounsel && p.bankBalance < APPEAL_COUNSEL_COST) return { player: p0, notices: [info("Can't Afford Counsel", `Appeal counsel costs ${money(APPEAL_COUNSEL_COST)}.`, "bad")] };
  p.annual.appeal = 1;
  if (hireCounsel) p.bankBalance -= APPEAL_COUNSEL_COST;
  pr.appeals = (pr.appeals ?? 0) + 1;
  const chance = clamp(0.04 + (pr.wrongful ? 0.2 : 0) + (hireCounsel ? 0.08 : 0) + p.smarts / 1500 - (pr.appeals - 1) * 0.02, 0.02, 0.4);
  if (rng.chance(chance)) {
    if (pr.wrongful) {
      const notices: Notices = [];
      releaseFromPrison(p, "exonerated", rng, notices);
      return { player: p, notices };
    }
    const cut = Math.max(1, Math.round(sentenceLeft(pr) * 0.35));
    pr.sentenceYears = Math.max(pr.yearsServed + 1, pr.sentenceYears - cut);
    const body = `The appeals court found errors at your trial and cut ${cut} year${cut === 1 ? "" : "s"} from your sentence.`;
    addLog(p, body);
    return { player: p, notices: [info("Appeal Granted", body, "good")] };
  }
  const body = "The appeals court upheld your conviction.";
  addLog(p, body);
  changeStat(p, "happiness", -4);
  return { player: p, notices: [info("Appeal Denied", body, "bad")] };
}

/** An innocence clinic takes a hard look at a wrongful conviction. */
export function contactInnocenceProject(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (!pr?.wrongful) return { player: p0 };
  if ((p.annual.innocence ?? 0) >= 1) return { player: p0, notices: [info("Waiting", "The clinic has your file. Law students are slow, not idle.")] };
  p.annual.innocence = 1;
  if (rng.chance(clamp(0.1 + p.smarts / 600 + (pr.conduct ?? 70) / 800, 0.05, 0.3))) {
    const notices: Notices = [];
    releaseFromPrison(p, "exonerated", rng, notices);
    return { player: p, notices };
  }
  const body = "The innocence clinic reviewed your case. They believe you, but they need new evidence. Write again next year.";
  addLog(p, body);
  return { player: p, notices: [info("Innocence Clinic", body, "neutral")] };
}

export function requestParole(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const pr = norm(p);
  if (!pr || pr.deathRow) return { player: p0 };
  if (pr.juvenile) return { player: p0, notices: [info("Not Applicable", "Juvenile detention has its own review. You will be released by 18.")] };
  if ((p.annual.parole ?? 0) >= 1) {
    return { player: p0, notices: [info("Already heard", "The board only hears one case a year.")] };
  }
  const need = paroleEligibleAt(pr);
  if (pr.yearsServed < need) {
    return { player: p0, notices: [info("Too soon", `The board won't see you until you've served ${need} years (${need - pr.yearsServed} to go).`)] };
  }
  p.annual.parole = 1;
  const odds = paroleOdds(p);
  if (rng.chance(odds)) {
    const years = clamp(sentenceLeft(pr), 1, 6);
    const conditions: Probation = { yearsLeft: years, charge: pr.charge, parole: true, strikes: 0 };
    const notices: Notices = [];
    releaseFromPrison(p, "parole", rng, notices);
    p.probation = conditions;
    return { player: p, notices };
  }
  pr.conduct = clamp((pr.conduct ?? 70) - 2);
  const why = pr.gang ? "Your gang ties worried them." : (pr.conduct ?? 0) < 55 ? "Your disciplinary record counted against you." : (pr.programs ?? []).length === 0 ? "They wanted to see rehabilitation, and you haven't enrolled in anything." : "They weren't convinced you're ready.";
  const body = `The parole board denied your request. ${why} Try again next year.`;
  addLog(p, body);
  return { player: p, notices: [info("Parole Denied", body, "bad")] };
}
