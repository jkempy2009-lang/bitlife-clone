import type { ActionResult, EducationStage, Job, PlayerState } from "@/types/game.types";
import type { LifeEvent } from "@/data/lifeEventsEngine";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import {
  ALBUM_RATINGS,
  CAREER_BY_ID,
  DECREES,
  PROGRAMS,
  UNIVERSITY_MAJORS,
  type CareerLine,
} from "@/data/careersRegistry";
import { addLog, changeStat, clone, hasAnyDegree, hasFlag, isRoyal, setFlag } from "./state";
import { hiringModifier } from "./world";
import { PART_TIME_FACTOR, blockerFor, isStudying, partTimeFriendly } from "./occupation";

// ---------------------------------------------------------------------------
// Corporate career
// ---------------------------------------------------------------------------

export function makeJob(line: CareerLine, tier: number, rng: Rng): Job {
  const t = Math.min(tier, line.ladder.length - 1);
  return {
    id: rng.id(),
    title: line.ladder[t].title,
    company: rng.pick(line.companies),
    salary: line.ladder[t].salary,
    performance: 60,
    tier: t,
    lineId: line.id,
    yearsInRole: 0,
  };
}

function recordCareerPeak(p: PlayerState) {
  const j = p.currentJob;
  if (!j || j.salary <= p.stats.highestSalary) return;
  p.stats.highestSalary = j.salary;
  p.stats.highestCareerTitle = `${j.title} at ${j.company}`;
  p.stats.highestCareerTier = j.tier;
}

export interface Eligibility {
  ok: boolean;
  reason?: string;
  /** The only way you can take this right now is part-time (you're studying). */
  partTime?: boolean;
  /** You'd be leaving your current job for this one (searching while employed). */
  switching?: boolean;
}

/** Entry rank earned by prior years in the same field. */
export function startingTier(p: PlayerState, line: CareerLine): number {
  if (line.pack) return 0;
  const exp = p.careerYears[line.id] ?? 0;
  return Math.min(line.ladder.length - 1, exp >= 12 ? 3 : exp >= 8 ? 2 : exp >= 4 ? 1 : 0);
}

export function jobEligibility(p: PlayerState, line: CareerLine): Eligibility {
  if (line.pack === "adult" && (!p.matureContent || p.age < 18)) return { ok: false, reason: "Mature content is off" };
  if (isRoyal(p)) return { ok: false, reason: "Royals can't hold ordinary jobs" };
  if (p.isInPrison) return { ok: false, reason: "You're in prison" };
  if (p.isFugitive) return { ok: false, reason: "Fugitives can't get hired" };
  let switching = false;
  if (p.currentJob) {
    const cur = CAREER_BY_ID[p.currentJob.lineId];
    if (p.currentJob.lineId === line.id) return { ok: false, reason: "You already work in this field" };
    if (line.pack || cur?.pack) return { ok: false, reason: "Quit your current job first" };
    switching = true;
  }
  if (p.age < line.minAge) return { ok: false, reason: `Must be ${line.minAge}+` };
  const blocked = line.pack === "politics" ? null : blockerFor(p, "job");
  if (blocked) return { ok: false, reason: blocked };
  let partTime = false;
  if (isStudying(p)) {
    if (!partTimeFriendly(line)) return { ok: false, reason: "You're studying. Only part-time work fits around classes." };
    partTime = true;
  }
  if (!hasAnyDegree(p, line.requirements.degrees)) {
    return { ok: false, reason: `Needs ${line.requirements.degrees?.map(degreeName).join(" or ")}` };
  }
  if (p.smarts < line.requirements.minSmarts) return { ok: false, reason: `Needs ${line.requirements.minSmarts}+ Smarts` };
  if (line.requirements.minLooks && p.looks < line.requirements.minLooks) {
    return { ok: false, reason: `Needs ${line.requirements.minLooks}+ Looks` };
  }
  if (line.requirements.maxKarma !== undefined && p.karma > line.requirements.maxKarma) {
    return { ok: false, reason: "The family doesn't trust do-gooders (Karma 50 or lower)" };
  }
  for (const [skill, min] of Object.entries(line.requirements.minSkills ?? {})) {
    if (p.skills[skill as keyof typeof p.skills] < (min ?? 0)) {
      return { ok: false, reason: `Needs ${min}+ ${skill[0].toUpperCase() + skill.slice(1)} skill` };
    }
  }
  return { ok: true, partTime, switching };
}

export function degreeName(id: string): string {
  if (id === "highschool") return "a High School Diploma";
  if (id === "bachelor") return "a Bachelor's Degree";
  if (id === "md") return "a Medical Degree";
  if (id === "masters") return "a Master's Degree";
  if (id === "jd") return "a Law Degree";
  if (id.startsWith("bachelor:")) {
    const major = UNIVERSITY_MAJORS.find((m) => m.id === id.slice(9));
    return `a Bachelor's in ${major?.name ?? id.slice(9)}`;
  }
  return id;
}

export function applyForJob(p0: PlayerState, lineId: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const line = CAREER_BY_ID[lineId];
  if (!line) return { player: p0 };
  const elig = jobEligibility(p, line);
  if (!elig.ok) {
    return { player: p0, notices: [{ kind: "info", title: "Can't Apply", body: elig.reason ?? "You aren't eligible.", tone: "bad" }] };
  }
  const key = `apply:${line.id}`;
  if ((p.annual[key] ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Already Applied", body: "You've already applied to this field this year.", tone: "neutral" }] };
  }
  p.annual[key] = 1;
  const guaranteed = line.pack === "actor" || line.id === "creator";
  const exp = p.careerYears[line.id] ?? 0;
  const chance = clamp(
    0.55 + (p.smarts - line.requirements.minSmarts) / 200 + (p.looks - 50) / 400 + Math.min(0.25, exp * 0.03) - (hasFlag(p, "ex_con") ? 0.25 : 0) + hiringModifier(p.economy.climate),
    0.15,
    0.95,
  );
  if (!guaranteed && !rng.chance(chance)) {
    let body = `You interviewed for a ${line.ladder[0].title} position but didn't get the job.`;
    if (elig.switching && rng.chance(0.15) && p.currentJob) {
      p.currentJob.performance = clamp(p.currentJob.performance - 8);
      changeStat(p, "happiness", -2);
      body += ` Word got back to your boss that you were looking around, and the atmosphere at ${p.currentJob.company} has cooled.`;
    }
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Rejected", body, tone: "bad" }] };
  }
  const left = elig.switching ? p.currentJob : null;
  const job = makeJob(line, startingTier(p, line), rng);
  if (elig.partTime) {
    job.partTime = true;
    job.salary = Math.round(job.salary * PART_TIME_FACTOR);
  }
  p.currentJob = job;
  p.annualSalary = job.salary;
  if (line.pack === "actor") {
    if (!p.specialCareers.includes("actor")) p.specialCareers.push("actor");
    if (p.specialCareerPath === "none") p.specialCareerPath = "actor";
    setFlag(p, "acting_dream");
    changeStat(p, "fame", 2);
  }
  if (line.id === "military") setFlag(p, "veteran");
  recordCareerPeak(p);
  const body = `You got a ${job.partTime ? "part-time " : ""}job as a ${job.title} at ${job.company}, earning ${money(job.salary)} a year!${left ? ` You handed in your notice at ${left.company}.` : ""}${job.tier > 0 ? ` Your ${Math.round(exp)} years of experience got you in above entry level.` : ""}`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "You're Hired!", body, tone: "good" }] };
}

export function workHarder(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!p.currentJob) return { player: p0 };
  if ((p.annual.work ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Burnt Out", body: "You've already gone above and beyond this year.", tone: "neutral" }] };
  }
  p.annual.work = 1;
  const gain = rng.int(8, 15);
  p.currentJob.performance = clamp(p.currentJob.performance + gain);
  changeStat(p, "happiness", -2);
  changeStat(p, "health", -1);
  const body = `You worked extra hard this year. Performance +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Hard Work", body, tone: "good" }] };
}

/** Ask for a raise: depends on performance, tier and the economy. Once a year. */
export function askForRaise(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || CAREER_BY_ID[job.lineId]?.pack) return { player: p0 };
  if ((p.annual.raise ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Once Is Enough", body: "You already made your case this year.", tone: "neutral" }] };
  }
  p.annual.raise = 1;
  const chance = clamp(0.1 + (job.performance - 50) / 100 + (p.skills.charisma - 30) / 400 + (p.economy.climate === "boom" ? 0.1 : p.economy.climate === "recession" ? -0.15 : 0), 0.03, 0.8);
  if (rng.chance(chance)) {
    const pct = rng.int(6, 14);
    job.salary = Math.round(job.salary * (1 + pct / 100));
    p.annualSalary = job.salary;
    changeStat(p, "happiness", 6);
    const body = `Your boss agreed: a ${pct}% raise to ${money(job.salary)}.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Raise Granted", body, tone: "good" }] };
  }
  job.performance = clamp(job.performance - (job.performance < 55 ? 12 : 4));
  changeStat(p, "happiness", -4);
  const body = job.performance < 45 ? "Your boss laughed. Then suggested you focus on your results first." : "Your boss said the budget isn't there this year.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "No Raise", body, tone: "bad" }] };
}

export function quitJob(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.currentJob) return { player: p0 };
  const body = `You quit your job as a ${p.currentJob.title}.`;
  p.currentJob = null;
  p.annualSalary = 0;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "You Quit", body, tone: "neutral" }] };
}

/** State + occupational pension: scales with the years you actually worked. */
export function pensionFor(p: PlayerState): number {
  const years = p.stats.yearsWorked;
  const base = Math.max(p.currentJob?.salary ?? 0, Math.round(p.stats.highestSalary * 0.75));
  const rate = Math.min(0.65, years * 0.0165);
  const floor = years >= 10 ? 14_000 : years >= 3 ? 10_000 : 6_000;
  return Math.max(p.pension, floor, Math.round(base * rate));
}

export function retire(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.age < 60) {
    return { player: p0, notices: [{ kind: "info", title: "Too Young", body: "You can retire from age 60.", tone: "neutral" }] };
  }
  p.pension = pensionFor(p);
  const body = `You retired${p.currentJob ? ` from your job as a ${p.currentJob.title}` : ""} after about ${Math.round(p.stats.yearsWorked)} years of work. Your pension is ${money(p.pension)} a year.`;
  p.currentJob = null;
  p.annualSalary = 0;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Happy Retirement!", body, tone: "good" }] };
}

/** Cut to reduced hours: half pay, no promotions, room to study. */
export function goPartTime(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.partTime || CAREER_BY_ID[job.lineId]?.pack) return { player: p0 };
  job.partTime = true;
  job.salary = Math.round(job.salary * 0.5);
  p.annualSalary = job.salary;
  const body = `You cut your hours at ${job.company}. Pay is now ${money(job.salary)} a year, and there will be no promotions while you're part-time.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Part-Time", body, tone: "neutral" }] };
}

/** Mutating helper shared by the button and graduation. Returns the log line, or null if nothing changed. */
export function convertToFullTime(p: PlayerState): string | null {
  const job = p.currentJob;
  if (!job || !job.partTime) return null;
  const line = CAREER_BY_ID[job.lineId];
  job.partTime = false;
  job.salary = Math.max(Math.round(job.salary / PART_TIME_FACTOR), line ? line.ladder[job.tier].salary : 0);
  p.annualSalary = job.salary;
  return `You went back to full-time hours at ${job.company}: ${money(job.salary)} a year.`;
}

export function goFullTime(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.currentJob?.partTime) return { player: p0 };
  if (isStudying(p) && p.education.stage !== "Primary" && p.education.stage !== "HighSchool") {
    return { player: p0, notices: [{ kind: "info", title: "Still Studying", body: "You can't work full time while enrolled.", tone: "bad" }] };
  }
  const body = convertToFullTime(p)!;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Full-Time", body, tone: "good" }] };
}

/** Promote the player one rung up their ladder. */
export function promoteJob(p: PlayerState): boolean {
  const j = p.currentJob;
  if (!j) return false;
  const line = CAREER_BY_ID[j.lineId];
  if (!line || j.tier >= line.ladder.length - 1) return false;
  j.tier += 1;
  j.title = line.ladder[j.tier].title;
  j.salary = Math.max(Math.round(j.salary * 1.12), line.ladder[j.tier].salary);
  j.performance = 55;
  j.yearsInRole = 0;
  p.annualSalary = j.salary;
  recordCareerPeak(p);
  return true;
}

export function promotionEvent(p: PlayerState): LifeEvent | null {
  const j = p.currentJob;
  if (!j) return null;
  const line = CAREER_BY_ID[j.lineId];
  if (!line || line.pack === "politics" || j.tier >= line.ladder.length - 1) return null;
  const next = line.ladder[j.tier + 1];
  return {
    id: `promo_${j.id}_${p.year}`,
    title: "Promotion Opportunity!",
    description: `Your outstanding performance has been noticed. Management wants to promote you to ${next.title} (about ${money(next.salary)} a year).`,
    minAge: 0,
    maxAge: 200,
    category: "career",
    options: [
      {
        text: `Accept the promotion to ${next.title}`,
        effects: { logText: `You were promoted to ${next.title}!`, promote: true, happinessDelta: 10 },
      },
      {
        text: "Decline and stay put",
        effects: { logText: `You turned down a promotion to ${next.title}.`, happinessDelta: 1, performanceDelta: -10 },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

export function studyHarder(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.education.stage === "None") return { player: p0 };
  if ((p.annual.study ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Brain Full", body: "You've already hit the books hard this year.", tone: "neutral" }] };
  }
  p.annual.study = 1;
  p.education.studyEffort = Math.min(8, p.education.studyEffort + 2);
  p.education.grades = clamp(p.education.grades + 3);
  changeStat(p, "happiness", -1);
  const body = "You buckled down and studied harder. Your grades are climbing.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Study Session", body, tone: "good" }] };
}

export function dropOut(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.education.stage === "None" || p.education.stage === "Primary" || p.age < 16) return { player: p0 };
  const was = p.education.stage;
  p.education.stage = "None";
  p.education.yearsLeft = 0;
  p.education.major = null;
  changeStat(p, "happiness", -3);
  const body = `You dropped out of ${was === "HighSchool" ? "high school" : was.replace(/([A-Z])/g, " $1").trim().toLowerCase()}.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Dropped Out", body, tone: "bad" }] };
}

export function enrollProgram(
  p0: PlayerState,
  stage: Extract<EducationStage, "University" | "MedicalSchool" | "LawSchool" | "Masters">,
  major: string | null,
  rng: Rng,
): ActionResult {
  const p = clone(p0);
  const prog = PROGRAMS[stage];
  const reject = (body: string): ActionResult => ({ player: p0, notices: [{ kind: "info", title: "Can't Enroll", body, tone: "bad" }] });
  if (p.education.stage !== "None") return reject("You're already studying.");
  if (p.isInPrison) return reject("You're in prison.");
  const blocked = blockerFor(p, "study");
  if (blocked) return reject(blocked);
  if (stage === "University" && !p.education.degrees.includes("highschool")) return reject("You need a high school diploma.");
  if (stage !== "University" && !p.education.degrees.some((d) => d.startsWith("bachelor:"))) return reject("You need a Bachelor's degree first.");
  if (stage === "MedicalSchool" && p.education.degrees.includes("md")) return reject("You're already a doctor.");
  if (stage === "LawSchool" && p.education.degrees.includes("jd")) return reject("You already hold a law degree.");
  if (p.age < 17) return reject("You're too young.");
  if (p.smarts < prog.minSmarts) return reject(`${prog.label} requires ${prog.minSmarts}+ Smarts.`);
  if (stage === "University" && !major) return reject("Pick a major.");
  const key = `enroll:${stage}`;
  if ((p.annual[key] ?? 0) >= 1) return reject("You've already applied this year.");
  p.annual[key] = 1;
  const chance = clamp(0.4 + p.education.grades / 250 + p.smarts / 400, 0.2, 0.95);
  if (!rng.chance(chance)) {
    const body = `${prog.label} rejected your application. Maybe next year.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Rejected", body, tone: "bad" }] };
  }
  p.education.stage = stage;
  p.education.yearsLeft = prog.years;
  p.education.major = major;
  const majorName = UNIVERSITY_MAJORS.find((m) => m.id === major)?.name;
  const body = `You were accepted into ${prog.label}${majorName ? ` to study ${majorName}` : ""}! Tuition is ${money(prog.tuition)} a year.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Accepted!", body, tone: "good" }] };
}

// ---------------------------------------------------------------------------
// Movie Star pack
// ---------------------------------------------------------------------------

export const FAMOUS_FAME = 30;

export function auditionForLead(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "actor") return { player: p0 };
  if ((p.annual.audition ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Already Auditioned", body: "Casting directors need time to forget your face. Try next year.", tone: "neutral" }] };
  }
  if (job.tier >= 3) return { player: p0 };
  p.annual.audition = 1;
  const base = (p.looks / 100) * (job.performance / 100) * (job.tier === 0 ? 0.5 : 0.8);
  const chance = clamp(base + p.skills.acting / 500, 0.03, 0.9);
  if (rng.chance(chance)) {
    promoteJob(p);
    const fameGain = rng.int(8, 15);
    changeStat(p, "fame", fameGain);
    changeStat(p, "happiness", 12);
    const body = `You nailed the audition and landed a bigger role: ${p.currentJob?.title}! Fame +${fameGain}.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "You Got the Part!", body, tone: "good" }] };
  }
  changeStat(p, "happiness", -4);
  const body = "The casting director said, \"Thanks, we'll call you.\" They won't.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "No Callback", body, tone: "bad" }] };
}

export function shootCommercial(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (p.fame < FAMOUS_FAME) return { player: p0 };
  if ((p.annual.commercial ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Over-exposed", body: "You've already shot a commercial this year.", tone: "neutral" }] };
  }
  p.annual.commercial = 1;
  p.bankBalance += 50_000;
  changeStat(p, "fame", 5);
  const body = "You shot a commercial for a luxury brand. +$50,000, +5 Fame.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Commercial Shoot", body, tone: "good" }] };
}

export function writeMemoir(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.fame < FAMOUS_FAME) return { player: p0 };
  if ((p.annual.memoir ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Writer's Cramp", body: "You've already written a memoir this year.", tone: "neutral" }] };
  }
  p.annual.memoir = 1;
  const payout = Math.round(p.fame * 25_000 * rng.float(0.8, 1.2));
  p.bankBalance += payout;
  changeStat(p, "happiness", 4);
  const body = `Your memoir became a bestseller. The publisher paid you ${money(payout)}.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Memoir Published", body, tone: "good" }] };
}

// ---------------------------------------------------------------------------
// Rock Star pack
// ---------------------------------------------------------------------------

export function practiceMusic(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if ((p.annual.practice ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Sore Fingers", body: "You've practised plenty this year.", tone: "neutral" }] };
  }
  p.annual.practice = 1;
  const gain = rng.int(3, 6);
  p.skills.music = clamp(p.skills.music + gain);
  changeStat(p, "happiness", 2);
  const body = `You practised for hours every day. Music skill +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Practice Makes Perfect", body, tone: "good" }] };
}

export function formBand(p0: PlayerState, tapScore: number): ActionResult {
  const p = clone(p0);
  if (p.age < 14) return { player: p0 };
  if (p.music.status !== "none") return { player: p0 };
  if ((p.annual.audition_music ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Try Next Year", body: "Your bandmates are tired of rehearsing for now.", tone: "neutral" }] };
  }
  p.annual.audition_music = 1;
  const rating = p.skills.music * 0.6 + tapScore * 0.6;
  if (rating >= 40) {
    p.music.status = "band";
    changeStat(p, "fame", 2);
    changeStat(p, "happiness", 8);
    const body = `You formed a band! Your skill and rhythm check (${Math.round(rating)}) impressed everybody.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "A Band Is Born", body, tone: "good" }] };
  }
  changeStat(p, "happiness", -3);
  const body = `Nobody wanted to join your band. Rating: ${Math.round(rating)} (needed 40). Practise and try again.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Band Fell Apart", body, tone: "bad" }] };
}

export function auditionContract(p0: PlayerState, kind: "solo" | "band", tapScore: number, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) {
    return { player: p0, notices: [{ kind: "info", title: "Too Young", body: "Record labels only sign artists who are 18 or older.", tone: "neutral" }] };
  }
  if (p.music.signed) return { player: p0 };
  const blocked = blockerFor(p, "music");
  if (blocked) return { player: p0, notices: [{ kind: "info", title: "Can't Sign", body: blocked, tone: "bad" }] };
  if (kind === "band" && p.music.status !== "band") return { player: p0 };
  if ((p.annual.audition_music ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Try Next Year", body: "You've already auditioned this year.", tone: "neutral" }] };
  }
  p.annual.audition_music = 1;
  const rating = p.skills.music * 0.5 + tapScore * 0.4 + p.looks * 0.1 + p.fame * 0.2 + rng.int(-8, 8) + (kind === "band" ? 6 : 0);
  const needed = kind === "solo" ? 58 : 52;
  if (rating >= needed) {
    p.music.signed = true;
    p.music.status = kind;
    if (!p.specialCareers.includes("musician")) p.specialCareers.push("musician");
    if (!isRoyal(p)) p.specialCareerPath = "musician";
    changeStat(p, "fame", 6);
    changeStat(p, "happiness", 15);
    const body = `A label signed you to a ${kind === "solo" ? "solo" : "band"} contract! You get a ${money(25_000)} yearly advance.`;
    addLog(p, body);
    return { player: p, notices: [{ kind: "info", title: "Record Deal!", body, tone: "good" }] };
  }
  changeStat(p, "happiness", -5);
  const body = `The label passed. Your audition scored ${Math.round(rating)} (needed ${needed}). Practise and try again.`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Audition Failed", body, tone: "bad" }] };
}

/** Walk away from your label (and its yearly advance). */
export function leaveLabel(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.music.signed) return { player: p0 };
  p.music.signed = false;
  p.music.status = "none";
  p.music.pendingAlbum = null;
  if (p.specialCareerPath === "musician") p.specialCareerPath = "none";
  changeStat(p, "happiness", -3);
  const body = "You left your record label. Your back catalogue still earns royalties, but the yearly advance is gone.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Left the Label", body, tone: "neutral" }] };
}

export function recordAlbum(p0: PlayerState, genre: string, title: string): ActionResult {
  const p = clone(p0);
  if (!p.music.signed) return { player: p0 };
  if (p.music.pendingAlbum || (p.annual.album ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Studio Booked", body: "You've already recorded an album this year. It will be released when you age up.", tone: "neutral" }] };
  }
  p.annual.album = 1;
  const name = title.trim() || `${genre} Dreams ${p.music.albums.length + 1}`;
  p.music.pendingAlbum = { title: name, genre };
  const body = `You recorded a ${genre} album called "${name}". It will be released this year!`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "In the Studio", body, tone: "good" }] };
}

export function albumRating(score: number) {
  let chosen: (typeof ALBUM_RATINGS)[number] = ALBUM_RATINGS[0];
  for (const r of ALBUM_RATINGS) if (score >= r.min) chosen = r;
  return chosen;
}

// ---------------------------------------------------------------------------
// Royalty pack
// ---------------------------------------------------------------------------

export const CHAOTIC_EXECUTIONS = [
  "You pointed at a random peasant and shouted \"OFF WITH HIS HEAD!\" The court gasped. A baker was never seen again.",
  "A citizen sneezed during your speech. You had them executed. The sneeze was never explained.",
  "You executed a poet for a rhyme you found unflattering. The crowd stood in uneasy silence.",
  "On a whim you ordered an execution. Your advisors winced, then applauded nervously.",
];

export function executeCitizen(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!isRoyal(p)) return { player: p0 };
  if ((p.annual.exec ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Enough Bloodshed", body: "Your advisors begged you to rest the axe this year.", tone: "neutral" }] };
  }
  p.annual.exec = 1;
  p.karma = 0;
  changeStat(p, "royalRespect", -30);
  changeStat(p, "happiness", -4);
  const body = rng.pick(CHAOTIC_EXECUTIONS);
  p.stats.crimesCommitted += 1;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Executed a Citizen", body: body + " Karma zeroed. Respect −30.", tone: "bad" }] };
}

export function passDecree(p0: PlayerState, decreeId: string): ActionResult {
  const p = clone(p0);
  const d = DECREES.find((x) => x.id === decreeId);
  if (!isRoyal(p) || !d) return { player: p0 };
  if ((p.annual.decree ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "One Decree a Year", body: "The scribes are exhausted. Wait until next year.", tone: "neutral" }] };
  }
  p.annual.decree = 1;
  p.nation.economy = clamp(p.nation.economy + d.economy);
  p.nation.freedom = clamp(p.nation.freedom + d.freedom);
  p.nation.military = clamp(p.nation.military + d.military);
  changeStat(p, "royalRespect", d.respect);
  const body = `You decreed: ${d.name}. ${d.blurb}`;
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Royal Decree", body, tone: d.respect >= 0 ? "good" : "bad" }] };
}

export function holdGala(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!isRoyal(p)) return { player: p0 };
  if ((p.annual.gala ?? 0) >= 1) {
    return { player: p0, notices: [{ kind: "info", title: "Too Many Parties", body: "You've already thrown a gala this year.", tone: "neutral" }] };
  }
  if (p.bankBalance < 100_000) {
    return { player: p0, notices: [{ kind: "info", title: "Can't Afford It", body: "A proper royal gala costs $100,000.", tone: "bad" }] };
  }
  p.annual.gala = 1;
  p.bankBalance -= 100_000;
  changeStat(p, "royalRespect", 10);
  changeStat(p, "happiness", 5);
  const body = "You threw a dazzling public gala. The people loved it. Respect +10.";
  addLog(p, body);
  return { player: p, notices: [{ kind: "info", title: "Public Gala", body, tone: "good" }] };
}

export function coupEvent(): LifeEvent {
  return {
    id: "coup_d_etat",
    title: "COUP D'ÉTAT!",
    description: "Your people's respect has vanished. Armed rebels storm the palace gates demanding your abdication.",
    minAge: 0,
    maxAge: 200,
    category: "royalty",
    options: [
      {
        text: "Flee into exile",
        effects: { logText: "You slipped out of the palace in disguise and fled the country, losing your title and most of your fortune.", stripRoyalty: true, bankMultiplier: 0.4, happinessDelta: -15, clearFlags: ["coup_pending"], setFlags: ["exiled"] },
      },
      {
        text: "Fight the rebels",
        effects: { logText: "You rallied loyal guards and crushed the rebellion! The crown is yours — for now.", royalRespectDelta: 40, karmaDelta: -5, happinessDelta: 5, clearFlags: ["coup_pending"] },
        chance: {
          p: 0.4,
          failure: {
            logText: "The rebels overpowered your guards. You were captured and tried for 'crimes against the people'.",
            stripRoyalty: true,
            bankMultiplier: 0.2,
            happinessDelta: -20,
            clearFlags: ["coup_pending"],
            setFlags: ["exiled"],
            arrest: { name: "Crimes Against the People", description: "The revolutionary tribunal found you guilty of tyranny.", years: 8, severity: "heinous" },
          },
        },
      },
      {
        text: "Abdicate gracefully",
        effects: { logText: "You signed the abdication papers with dignity, keeping a modest fortune and your head.", stripRoyalty: true, bankMultiplier: 0.7, happinessDelta: -8, karmaDelta: 4, clearFlags: ["coup_pending"], setFlags: ["exiled"] },
      },
    ],
  };
}

export function maybeCoup(p: PlayerState): LifeEvent | null {
  if (!isRoyal(p) || p.royalRespect > 0 || hasFlag(p, "coup_pending")) return null;
  setFlag(p, "coup_pending");
  return coupEvent();
}
