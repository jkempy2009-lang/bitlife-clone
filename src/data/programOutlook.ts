/** What a degree actually buys: the careers it opens, what they pay at the start, and how long the tuition takes to earn back. */
import { CAREER_LINES, PROGRAMS, UNIVERSITY_MAJORS } from "./careersRegistry";
import { CERT_BY_ID } from "./certificates";

export interface OutlookLine {
  id: string;
  name: string;
  emoji: string;
  start: number;
  top: number;
}

export interface ProgramOutlook {
  /** Sticker tuition for the whole programme. */
  cost: number;
  years: number;
  /** Careers whose degree requirement this programme meets, best-paying first. */
  opens: OutlookLine[];
  /** Typical starting pay across the careers it opens. */
  typicalStart: number;
  /** The same for a school-leaver with no degree. */
  baseline: number;
  /** Years after graduating to earn back the tuition from the pay premium (null if there's no premium). */
  payback: number | null;
}

const corporate = CAREER_LINES.filter((l) => !l.pack);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Entry pay for someone with no qualification beyond school, in lines they could actually get. */
export const NO_DEGREE_BASELINE = median(
  corporate.filter((l) => !(l.requirements.degrees?.some((d) => d !== "highschool")) && l.requirements.minSmarts <= 45).map((l) => l.ladder[0].salary),
);

const TAKE_HOME = 0.72;

function outlookFor(degrees: string[], cost: number, years: number): ProgramOutlook {
  const opens = corporate
    .filter((l) => (l.requirements.degrees ?? []).some((d) => degrees.includes(d)))
    .map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, start: l.ladder[0].salary, top: l.ladder[l.ladder.length - 1].salary }))
    .sort((a, b) => b.start - a.start);
  const typicalStart = median(opens.map((o) => o.start));
  const premium = (typicalStart - NO_DEGREE_BASELINE) * TAKE_HOME;
  return { cost, years, opens, typicalStart, baseline: NO_DEGREE_BASELINE, payback: premium > 0 ? Math.round((cost / premium) * 10) / 10 : null };
}

export type OutlookKey = { stage: "University"; major: string } | { stage: "Masters" | "MedicalSchool" | "LawSchool" } | { stage: "Certificate"; cert: string };

export function programOutlook(key: OutlookKey): ProgramOutlook {
  switch (key.stage) {
    case "University": {
      const prog = PROGRAMS.University;
      // A bachelor's in any subject meets "bachelor"; a named major also meets its specialist lines.
      return outlookFor(["bachelor", `bachelor:${key.major}`], prog.tuition * prog.years, prog.years);
    }
    case "Masters":
      return outlookFor(["masters"], PROGRAMS.Masters.tuition * PROGRAMS.Masters.years, PROGRAMS.Masters.years);
    case "MedicalSchool":
      return outlookFor(["md"], PROGRAMS.MedicalSchool.tuition * PROGRAMS.MedicalSchool.years, PROGRAMS.MedicalSchool.years);
    case "LawSchool":
      return outlookFor(["jd"], PROGRAMS.LawSchool.tuition * PROGRAMS.LawSchool.years, PROGRAMS.LawSchool.years);
    case "Certificate": {
      const c = CERT_BY_ID[key.cert];
      return outlookFor([`cert:${key.cert}`], (c?.tuition ?? 0) * (c?.years ?? 1), c?.years ?? 1);
    }
  }
}

export const majorName = (id: string) => UNIVERSITY_MAJORS.find((m) => m.id === id)?.name ?? id;
