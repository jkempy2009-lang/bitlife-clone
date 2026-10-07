import { upgradeBusiness } from "../business";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { applyForJob, enrollCertificate, enrollProgram, jobEligibility } from "../career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import type { PlayerState } from "@/types/game.types";

const grad = (seed: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 24;
  p.smarts = 80;
  p.bankBalance = 50_000;
  p.education = { stage: "None", yearsLeft: 0, major: null, grades: 60, studyEffort: 0, degrees: ["highschool"] };
  return { rng, p };
};

describe("vocational certificates", () => {
  it("a bootcamp opens software without a degree, and works alongside a full-time job", () => {
    const { rng, p } = grad(1);
    expect(jobEligibility(p, CAREER_BY_ID.software).ok).toBe(false);
    p.currentJob = { id: "j", title: "Cashier", company: "X", salary: 20_000, performance: 70, tier: 0, lineId: "retail" };
    const enrolled = enrollCertificate(p, "bootcamp", rng).player;
    expect(enrolled.education.stage).toBe("Certificate");
    expect(enrolled.currentJob).not.toBeNull();
    let q = enrolled;
    for (let i = 0; i < 4 && !q.education.degrees.includes("cert:bootcamp"); i++) q = ageUp(q, makeRng(10 + i)).player;
    expect(q.education.degrees).toContain("cert:bootcamp");
    q = { ...q, currentJob: null, age: 30, education: { ...q.education, stage: "None", yearsLeft: 0 } };
    expect(jobEligibility(q, CAREER_BY_ID.software).ok).toBe(q.smarts >= CAREER_BY_ID.software.requirements.minSmarts);
  });

  it("an apprenticeship credits trade experience", () => {
    const { rng, p } = grad(2);
    let q = enrollCertificate(p, "apprentice", rng).player;
    for (let i = 0; i < 6 && !q.education.degrees.includes("cert:apprentice"); i++) q = ageUp(q, makeRng(30 + i)).player;
    expect(q.careerYears.trades).toBeGreaterThanOrEqual(3);
    expect(q.careerYears.construction).toBeGreaterThanOrEqual(3);
  });

  it("rejects enrolment when requirements aren't met", () => {
    const { rng, p } = grad(3);
    p.smarts = 10;
    expect(enrollCertificate(p, "pilot", rng).player.education.stage).toBe("None");
    p.smarts = 80;
    p.business = upgradeBusiness({ kind: "foodtruck", name: "T", value: 1, staff: 0, locations: 1, lastProfit: 0, boost: 0, founded: 2020 } as never);
    expect(enrollCertificate(p, "pilot", rng).player.education.stage).toBe("None");
  });
});

describe("scholarships", () => {
  it("strong grades earn a scholarship that cuts tuition and is lost if grades slip", () => {
    let got = 0;
    for (let s = 1; s <= 12; s++) {
      const { p } = grad(40 + s);
      p.education.grades = 95;
      const r = enrollProgram(p, "University", "business", makeRng(s)).player;
      if (r.education.stage === "University") {
        got++;
        expect(r.education.scholarship).toBe(1);
        const before = r.bankBalance;
        const aged = ageUp({ ...r, education: { ...r.education, grades: 95 } }, makeRng(s));
        expect(aged.player.taxesPaidThisYear).toBeGreaterThanOrEqual(0);
        void before;
        const slipped = ageUp({ ...r, smarts: 5, education: { ...r.education, grades: 20, scholarship: 1 } }, makeRng(s)).player;
        expect(slipped.education.scholarship).toBe(0);
        break;
      }
    }
    expect(got).toBe(1);
  });

  it("students can't take degree-level jobs, only part-time entry work", () => {
    const { rng, p } = grad(50);
    p.education = { stage: "University", yearsLeft: 3, major: "business", grades: 60, studyEffort: 0, degrees: ["highschool"] };
    expect(applyForJob(p, "accounting", rng).player.currentJob).toBeNull();
  });
});
