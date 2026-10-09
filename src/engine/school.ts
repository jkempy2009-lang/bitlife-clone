/**
 * School life: a thirteen-year thread rather than a pile of one-off events. Every year you get a report
 * card; friendships form and fade, bullying can start, drag on and be dealt with, clubs build skills and
 * confidence, exam pressure builds. How you come out of school (popular or outcast, bullied or bully,
 * star pupil or truant, scarred or toughened) is remembered by the flags that follow you into adult life.
 */
import type { ActionResult, PlayerState, SchoolState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { profileOf } from "@/data/countryProfiles";
import { addLog, changeStat, clone, livingRelatives } from "./state";
import { addRelative, firstName } from "./social";
import { addDisease } from "./diseaseOps";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const freshSchool = (): SchoolState => ({ social: 50, bullied: 0, teacher: 50, stress: 15, club: null, clubYears: 0, tier: "state", tutor: false, truancy: 0, reports: [], honors: [] });

export function hydrateSchool(raw: Partial<SchoolState> | undefined): SchoolState {
  const f = freshSchool();
  return {
    ...f,
    ...(raw ?? {}),
    reports: Array.isArray(raw?.reports) ? raw.reports.slice(-6) : [],
    honors: Array.isArray(raw?.honors) ? raw.honors : [],
  };
}

export const inSchoolYears = (p: PlayerState) => p.age >= 5 && p.age < 18;

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------

export interface ClubDef {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  minAge: number;
  /** What a year in the club gives. */
  gain: string;
}

export const CLUBS: ClubDef[] = [
  { id: "sport", label: "School Sports Team", emoji: "⚽", blurb: "Training twice a week and matches on Saturdays.", minAge: 8, gain: "Fitness, athletics and a team to belong to." },
  { id: "music", label: "Band & Choir", emoji: "🎺", blurb: "Rehearsals, recitals and the winter concert.", minAge: 7, gain: "Musical skill and confidence on stage." },
  { id: "drama", label: "Drama Club", emoji: "🎭", blurb: "Auditions, rehearsals and the end-of-year play.", minAge: 8, gain: "Stage presence and an outgoing circle of friends." },
  { id: "science", label: "Science & Coding Club", emoji: "🔬", blurb: "Experiments, robots and late-night debugging.", minAge: 9, gain: "Smarts and a loyal nerdy crowd." },
  { id: "debate", label: "Debate Society", emoji: "🗣️", blurb: "Arguing both sides until you win.", minAge: 12, gain: "Charisma, composure and sharper thinking." },
  { id: "art", label: "Art Club", emoji: "🎨", blurb: "Sketchbooks, clay and a gallery wall.", minAge: 7, gain: "Creativity and calm." },
  { id: "service", label: "Volunteers' Club", emoji: "🤝", blurb: "Food drives, litter picks and visiting care homes.", minAge: 10, gain: "Kindness, karma and good references." },
];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

export function joinClub(p0: PlayerState, clubId: string): ActionResult {
  const p = clone(p0);
  const club = CLUB_BY_ID[clubId];
  if (!club || !inSchoolYears(p)) return { player: p0 };
  if (p.age < club.minAge) return { player: p0, notices: [info("Too Young", `${club.label} takes members from age ${club.minAge}.`)] };
  if (p.school.club === clubId) return { player: p0 };
  if ((p.annual.club ?? 0) >= 1) return { player: p0, notices: [info("Make Up Your Mind", "You've already changed clubs this year.")] };
  p.annual.club = 1;
  const had = p.school.club ? CLUB_BY_ID[p.school.club]?.label : null;
  p.school.club = clubId;
  p.school.clubYears = 0;
  p.school.stress = clamp(p.school.stress + 3);
  const body = `${had ? `You left ${had} and joined` : "You joined"} ${club.label}. ${club.gain}`;
  addLog(p, body);
  return { player: p, notices: [info("New Club", body, "good")] };
}

export function leaveClub(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!p.school.club) return { player: p0 };
  const label = CLUB_BY_ID[p.school.club]?.label ?? "your club";
  p.school.club = null;
  p.school.clubYears = 0;
  p.school.stress = clamp(p.school.stress - 3);
  const body = `You dropped out of ${label} to free up time.`;
  addLog(p, body);
  return { player: p, notices: [info("Quit the Club", body)] };
}

// ---------------------------------------------------------------------------
// Getting through the hard parts
// ---------------------------------------------------------------------------

export type SchoolAction = "teacher" | "parents" | "stand_up" | "change_school" | "counsellor" | "tutor";

export const SCHOOL_ACTIONS: Record<SchoolAction, { label: string; emoji: string; blurb: string; when: (p: PlayerState) => boolean }> = {
  teacher: { label: "Tell a teacher", emoji: "🧑‍🏫", blurb: "Report the bullying. Works if the teacher takes you seriously.", when: (p) => p.school.bullied > 0 },
  parents: { label: "Tell your parents", emoji: "👪", blurb: "Your family steps in, and may move you if it does not stop.", when: (p) => p.school.bullied > 0 && livingRelatives(p, "Parent").length > 0 },
  stand_up: { label: "Stand up to them", emoji: "✊", blurb: "Risky. Courage helps; it can also go badly.", when: (p) => p.school.bullied > 0 && p.age >= 8 },
  change_school: { label: "Change school", emoji: "🚌", blurb: "A fresh start somewhere new. You lose your friends, and you are the new kid again.", when: (p) => p.school.bullied >= 40 || p.school.social < 25 },
  counsellor: { label: "See the school counsellor", emoji: "🛋️", blurb: "Someone to talk to about stress, bullying or home. Not available everywhere.", when: (p) => p.school.stress >= 45 || p.school.bullied >= 30 },
  tutor: { label: "Get a tutor", emoji: "📚", blurb: "Extra lessons to lift your grades. Costs your family, and adds a little pressure.", when: (p) => !p.school.tutor },
};

const parentTier = (p: PlayerState) => Math.max(0, ...livingRelatives(p, "Parent").map((r) => r.incomeTier));

export function schoolAction(p0: PlayerState, action: SchoolAction, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inSchoolYears(p) || !SCHOOL_ACTIONS[action].when(p)) return { player: p0 };
  const key = `school:${action}`;
  if ((p.annual[key] ?? 0) >= 1) return { player: p0, notices: [info("Not Again", "You've already done that this year.")] };
  p.annual[key] = 1;
  const s = p.school;
  const parent = livingRelatives(p, "Parent")[0];
  if (action === "teacher") {
    if (rng.chance(clamp(0.3 + s.teacher / 150, 0.2, 0.85))) {
      s.bullied = clamp(s.bullied - rng.int(25, 45));
      s.teacher = clamp(s.teacher + 4);
      const body = "Your teacher took it seriously. The bullies were spoken to, and things have eased.";
      addLog(p, body);
      return { player: p, notices: [info("Someone Listened", body, "good")] };
    }
    s.social = clamp(s.social - 4);
    s.bullied = clamp(s.bullied + 5);
    const body = "Nothing much happened, except that you were seen as a snitch.";
    addLog(p, body);
    return { player: p, notices: [info("Brushed Off", body, "bad")] };
  }
  if (action === "parents") {
    if (parent) parent.relationshipBar = clamp(parent.relationshipBar + 6);
    s.bullied = clamp(s.bullied - rng.int(15, 30));
    changeStat(p, "happiness", 3);
    const body = `${parent ? firstName(parent) : "Your family"} went into school the next morning. Things are calmer, and you are not carrying it alone.`;
    addLog(p, body);
    return { player: p, notices: [info("Family Steps In", body, "good")] };
  }
  if (action === "stand_up") {
    if (rng.chance(clamp(0.3 + (p.talents.courage - 50) / 150 + (p.talents.athletic - 50) / 300, 0.15, 0.8))) {
      s.bullied = clamp(s.bullied - rng.int(30, 50));
      s.social = clamp(s.social + 8);
      changeStat(p, "happiness", 5);
      const body = "You looked them in the eye and said enough. The shaking only started afterwards. They left you alone.";
      addLog(p, body);
      return { player: p, notices: [info("Enough", body, "good")] };
    }
    changeStat(p, "health", -4);
    s.bullied = clamp(s.bullied + 8);
    s.truancy += rng.chance(0.3) ? 1 : 0;
    const body = "It went badly. You came home bruised, and it only made them worse.";
    addLog(p, body);
    return { player: p, notices: [info("It Went Badly", body, "bad")] };
  }
  if (action === "change_school") {
    if (parentTier(p) < 2 && profileOf(p.residence.country).careQuality < 70) return { player: p0, notices: [info("No Choice", "Your family cannot afford a move or a new school.", "bad")] };
    s.bullied = 0;
    s.social = 40;
    s.teacher = 45;
    s.club = null;
    s.clubYears = 0;
    s.tier = parentTier(p) >= 4 ? "private" : "state";
    for (const r of p.relatives) if (r.alive && r.relation === "Friend") r.relationshipBar = clamp(r.relationshipBar - 25);
    changeStat(p, "happiness", -2);
    const body = `You started at a new ${s.tier} school. You knew nobody, but nobody knew you, either.`;
    addLog(p, body);
    return { player: p, notices: [info("A Fresh Start", body, "neutral")] };
  }
  if (action === "counsellor") {
    if (profileOf(p.residence.country).careQuality < 45) return { player: p0, notices: [info("Not Available", "Your school has no counsellor.")] };
    s.stress = clamp(s.stress - 22);
    changeStat(p, "happiness", 4);
    s.bullied = clamp(s.bullied - 8);
    const body = "An hour a week with someone who actually listens. It helps more than you expected.";
    addLog(p, body);
    return { player: p, notices: [info("Someone to Talk To", body, "good")] };
  }
  s.tutor = true;
  s.stress = clamp(s.stress + 4);
  const body = "A tutor now comes round twice a week. Your grades should pick up.";
  addLog(p, body);
  return { player: p, notices: [info("Tutor Arranged", body, "good")] };
}

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export function gradeLetter(g: number): string {
  return g >= 92 ? "A+" : g >= 85 ? "A" : g >= 78 ? "B+" : g >= 70 ? "B" : g >= 60 ? "C" : g >= 50 ? "D" : "F";
}
const GRADE_ORDER = ["F", "D", "C", "B", "B+", "A", "A+"];

function reportNote(p: PlayerState, g: number): string {
  const s = p.school;
  const club = s.club ? CLUB_BY_ID[s.club]?.label.toLowerCase() : null;
  if (s.truancy >= 2 && s.stress < 70 && g < 65) return "Too many missed lessons. Attendance is the first thing to fix.";
  if (s.bullied >= 50) return "Seems withdrawn this year. We are keeping an eye on how things are going at break times.";
  if (s.stress >= 75) return "Works hard but looks exhausted. Needs to be reminded that rest matters too.";
  if (g >= 92) return s.teacher >= 60 ? "Exceptional. A pleasure to teach, and should be stretched." : "Outstanding results. Could take more part in class.";
  if (g >= 85) return club ? `Excellent work, and a real asset to ${club}.` : "Excellent work, consistently well prepared.";
  if (g >= 70) return s.social >= 65 ? "Good results and well liked. Could push harder." : "Solid work. Capable of more if more effort goes in.";
  if (g >= 60) return "Adequate, though easily distracted. Focus will pay off.";
  if (g >= 50) return "Struggling. Extra support and homework habits are needed.";
  return "Serious concerns. At risk of being held back without a real change.";
}

// ---------------------------------------------------------------------------
// The school year
// ---------------------------------------------------------------------------

const CULTURE_PRESSURE: Record<string, number> = { "South Korea": 18, Japan: 12, India: 10, France: 4 };

export function processSchoolYear(p: PlayerState, rng: Rng, notices: Notices) {
  if (p.isInPrison) return;
  const s = p.school;
  if (p.age === 18 && !p.flags.includes("school_done")) {
    finishSchool(p, notices);
    return;
  }
  if (!inSchoolYears(p) || p.education.stage === "None" || p.education.stage === "University") return;
  const friends = livingRelatives(p, "Friend");
  const prof = profileOf(p.residence.country);

  if (p.age === 5) s.tier = parentTier(p) >= 4 && rng.chance(0.6) ? "private" : "state";

  // Standing among classmates.
  const target = 45 + (p.talents.charisma - 50) * 0.35 + (p.looks - 50) * 0.2 + Math.min(4, friends.length) * 3 + (s.club ? 6 : 0) - s.bullied * 0.3 + (p.fame > 10 ? 8 : 0);
  s.social = clamp(Math.round(s.social + (target - s.social) * 0.35 + rng.int(-4, 4)));

  // Friendships form and fade.
  if (p.age >= 6 && s.social >= 40 && friends.length < 5 && rng.chance(0.3 + (s.social - 40) / 150 + (s.club ? 0.12 : 0))) {
    const friend = addRelative(p, { relation: "Friend", ageOffset: [-1, 1] }, rng);
    const where = s.club ? `in ${CLUB_BY_ID[s.club]?.label}` : "in class";
    addLog(p, `You became friends with ${friend.name} ${where}.`);
  } else if (friends.length > 0 && s.social < 30 && rng.chance(0.25)) {
    const lost = rng.pick(friends);
    lost.relationshipBar = clamp(lost.relationshipBar - 18);
  }

  // Bullying: it starts, it drags on, it ends.
  if (s.bullied === 0 && p.age >= 7) {
    const risk = 0.04 + Math.max(0, 50 - s.social) / 280 + (p.looks < 30 ? 0.04 : 0) + (p.flags.includes("new_kid") ? 0.08 : 0) + (p.talents.courage < 30 ? 0.03 : 0);
    if (rng.chance(risk)) {
      s.bullied = 25 + rng.int(0, 20);
      const body = "A group in your year has started picking on you. Open Activities → School to decide what to do about it.";
      addLog(p, "Some kids at school started picking on you.");
      notices.push(info("Trouble at School", body, "bad"));
    }
  } else if (s.bullied > 0) {
    s.bullied = clamp(s.bullied + rng.int(-8, 9) - (s.teacher >= 65 ? 4 : 0) + (s.social < 30 ? 3 : 0));
    if (s.bullied <= 5) {
      s.bullied = 0;
      addLog(p, "The bullying finally stopped. Things at school feel lighter.");
    }
  }
  if (s.bullied >= 40) {
    changeStat(p, "happiness", -3);
    changeStat(p, "health", -1);
    s.stress = clamp(s.stress + 6);
    if (s.bullied >= 60 && rng.chance(0.2)) s.truancy += 1;
    if (!s.honors.includes("bullied") && s.bullied >= 40) s.honors.push("bullied");
    if (s.bullied >= 70 && !s.honors.includes("scarred") && rng.chance(0.4)) s.honors.push("scarred");
  }

  // Teachers.
  const teacherTarget = 35 + (p.education.grades - 50) * 0.4 + (p.effort === "grind" ? 10 : p.effort === "coast" ? -8 : 0) - s.truancy * 6;
  s.teacher = clamp(Math.round(s.teacher + (teacherTarget - s.teacher) * 0.3 + rng.int(-3, 3)));

  // Pressure.
  const stressTarget = 15 + (p.effort === "grind" ? 20 : p.effort === "coast" ? -8 : 0) + (p.age >= 15 ? 10 : 0) + (CULTURE_PRESSURE[p.residence.country] ?? 0) + s.bullied * 0.3 + (s.tutor ? 5 : 0) - (s.club ? 5 : 0) - (p.talents.resilience - 50) * 0.2;
  s.stress = clamp(Math.round(s.stress + (stressTarget - s.stress) * 0.4));
  if (s.stress >= 78 && rng.chance(0.2)) {
    changeStat(p, "happiness", -4);
    const burnt = "The pressure of exams and expectations got on top of you this year.";
    addLog(p, burnt);
    if (rng.chance(0.15) && p.age >= 12 && addDisease(p, "anxiety", rng)) notices.push(info("Exam Anxiety", "The stress tipped into something more. You were diagnosed with an anxiety disorder.", "bad"));
  }

  // Clubs.
  if (s.club) {
    s.clubYears += 1;
    const sk = p.skills;
    if (s.club === "sport") {
      sk.athletics = clamp(sk.athletics + 3);
      changeStat(p, "health", 1);
    } else if (s.club === "music") sk.music = clamp(sk.music + 3);
    else if (s.club === "drama") {
      sk.acting = clamp(sk.acting + 3);
      sk.charisma = clamp(sk.charisma + 1);
    } else if (s.club === "science") changeStat(p, "smarts", 2);
    else if (s.club === "debate") {
      sk.charisma = clamp(sk.charisma + 2);
      changeStat(p, "smarts", 1);
    } else if (s.club === "art") changeStat(p, "happiness", 1);
    else if (s.club === "service") changeStat(p, "karma", 3);
    if (s.clubYears === 3) {
      const club = CLUB_BY_ID[s.club];
      s.honors.push(`club:${s.club}`);
      const body = `After three years in ${club.label.toLowerCase()}, your teachers and teammates see you as one of its stars.`;
      addLog(p, body);
      notices.push(info(`${club.emoji} Club Star`, body, "good"));
    }
    if (p.age >= 15 && s.clubYears >= 2) {
      const dream = s.club === "sport" ? "athlete_dream" : s.club === "music" ? "music_dream" : s.club === "drama" ? "acting_dream" : null;
      if (dream && !p.flags.includes(dream)) p.flags.push(dream);
    }
  }

  // Grades answer to all of this.
  let nudge = (s.tier === "private" ? 2 : 0) + (s.tutor ? 4 : 0) + (prof.careQuality - 60) / 25 - s.truancy * 2 - (s.bullied >= 50 ? 4 : 0) - (s.stress >= 80 ? 3 : 0) - (s.club && p.effort !== "grind" ? 1 : 0) + (s.teacher - 50) / 25;
  nudge = Math.round(nudge);
  p.education.grades = clamp(p.education.grades + nudge);
  s.tutor = false;

  // Report card.
  if (p.age >= 6) {
    const g = p.education.grades;
    const letter = gradeLetter(g);
    const note = reportNote(p, g);
    const last = s.reports[s.reports.length - 1];
    s.reports.push({ age: p.age, grade: letter, note });
    s.reports = s.reports.slice(-6);
    addLog(p, `📝 Report card: ${letter}. "${note}"`);
    const parents = livingRelatives(p, "Parent");
    const jump = last ? GRADE_ORDER.indexOf(letter) - GRADE_ORDER.indexOf(last.grade) : 0;
    if (g >= 85) for (const r of parents) r.relationshipBar = clamp(r.relationshipBar + 2);
    else if (g < 55) for (const r of parents) r.relationshipBar = clamp(r.relationshipBar - 3);
    if (letter === "F" || letter === "A+" || Math.abs(jump) >= 2) {
      notices.push(info(letter === "A+" ? "Top of the Class" : letter === "F" ? "A Failing Report" : jump > 0 ? "Report Card: Big Improvement" : "Report Card: A Slide", `Your report: ${letter}. "${note}"`, letter === "A+" || jump > 0 ? "good" : "bad"));
    }
    if (letter === "A+" && !s.honors.includes("star")) s.honors.push("star");
  }
  if (s.truancy > 0 && p.age % 3 === 0) s.truancy -= 1;
}

/** At eighteen the school years are over, and what they made of you is remembered. */
function finishSchool(p: PlayerState, notices: Notices) {
  const s = p.school;
  p.flags.push("school_done");
  const tags: string[] = [];
  const mark = (flag: string, line: string) => {
    if (!p.flags.includes(flag)) p.flags.push(flag);
    tags.push(line);
  };
  if (s.social >= 68) {
    mark("school_popular", "popular");
    p.skills.charisma = clamp(p.skills.charisma + 4);
  } else if (s.social < 32) mark("school_outcast", "a loner");
  if (s.honors.includes("bullied")) {
    mark("school_bullied", s.honors.includes("scarred") ? "bullied, and it left scars" : "bullied");
    if (!s.honors.includes("scarred")) changeStat(p, "happiness", 0);
  }
  if (s.honors.includes("star") || p.education.grades >= 88) mark("school_star", "a star pupil");
  if (s.truancy >= 3 || p.education.grades < 45) mark("school_rough", "a troubled student");
  const club = s.honors.find((h) => h.startsWith("club:"));
  if (club) mark(`school_${club.slice(5)}_star`, CLUB_BY_ID[club.slice(5)]?.label.toLowerCase() ?? "a club star");
  if (tags.length > 0) {
    const body = `Looking back at school, you were ${tags.join(", ")}. It shaped who walks out of the gates today.`;
    addLog(p, body);
    notices.push(info("The School Years", body, "neutral"));
  }
}

/** Summary line of how school is going, for the Dashboard. */
export function schoolStanding(p: PlayerState): { grade: string; social: string; teacher: string; mood: string } {
  const s = p.school;
  return {
    grade: gradeLetter(p.education.grades),
    social: s.social >= 70 ? "Popular" : s.social >= 50 ? "Well liked" : s.social >= 32 ? "Keeps to a few friends" : "Isolated",
    teacher: s.teacher >= 70 ? "Teacher's favourite" : s.teacher >= 45 ? "Fine with teachers" : "On the teachers' radar",
    mood: s.bullied >= 40 ? "Being bullied" : s.stress >= 70 ? "Under heavy pressure" : s.stress >= 45 ? "Feeling the pressure" : "Coping fine",
  };
}
