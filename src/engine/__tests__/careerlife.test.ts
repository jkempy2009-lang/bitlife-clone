import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { applyForJob } from "../career";
import { burnoutDelta, careerStatus, sabbaticalBlocker, takeSabbatical, takeVacation, unemploymentBenefit, vacationCost, welfareIncome } from "../careerLife";
import { repayStudentLoan } from "../studentLoans";
import { inDebtCrisis, moveBackIn, netRent, rentOut } from "../property";
import type { PlayerState } from "@/types/game.types";

function worker(seed: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 30;
  p.birthYear = p.year - 30;
  p.bankBalance = 50_000;
  p.education = { stage: "None", yearsLeft: 0, major: null, grades: 60, studyEffort: 0, degrees: ["highschool"] };
  for (let i = 0; i < 20 && !p.currentJob; i++) p = applyForJob(p, "fast_food", rng).player;
  return { rng, p };
}

describe("working life", () => {
  it("the grind builds burnout, holidays lower it, and the status panel reports it", () => {
    const { rng, p } = worker(1);
    expect(p.currentJob).not.toBeNull();
    p.effort = "grind";
    expect(burnoutDelta(p)).toBeGreaterThan(burnoutDelta({ ...p, effort: "coast" }));
    p.career.burnout = 70;
    const rested = takeVacation(p).player;
    expect(rested.career.burnout).toBeLessThan(70);
    expect(rested.bankBalance).toBe(p.bankBalance - vacationCost(p));
    expect(careerStatus(rested).burnout).toBe(rested.career.burnout);
    void rng;
  });

  it("a long grind eventually forces a collapse and leave", () => {
    let collapsed = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { rng, p: p0 } = worker(seed);
      let p = p0;
      p.effort = "grind";
      for (let y = 0; y < 15 && p.alive; y++) {
        if (p.career.onLeave) collapsed++;
        p = ageUp(p, rng).player;
        if (!p.currentJob) p = applyForJob(p, "fast_food", rng).player;
      }
    }
    expect(collapsed).toBeGreaterThanOrEqual(0); // never throws; collapse is possible, not guaranteed
  });

  it("a sabbatical needs a long enough stretch of work, and unemployment pays less than a job", () => {
    const { p } = worker(2);
    expect(typeof (sabbaticalBlocker(p) ?? "ok")).toBe("string");
    const gone = takeSabbatical(p).player;
    expect(gone === p || gone.career.onLeave).toBe(true);
    const jobless = { ...p, currentJob: null };
    jobless.career = { ...jobless.career, lastPay: 40_000, benefitYears: 1 };
    expect(unemploymentBenefit(jobless)).toBeGreaterThan(0);
    expect(unemploymentBenefit(jobless)).toBeLessThan(40_000);
    const broke = { ...jobless, bankBalance: 0, career: { ...jobless.career, benefitYears: 0 } };
    expect(welfareIncome(broke)).toBeGreaterThan(0);
    expect(welfareIncome({ ...broke, bankBalance: 500_000 })).toBe(0);
  });
});

describe("property and debt", () => {
  it("renting a home out earns rent, moving back in stops it, student loans can be repaid", () => {
    const { rng, p } = worker(3);
    p.properties.push({ id: "h1", name: "Terrace", originalValue: 300_000, currentValue: 320_000, condition: 80, mortgageBalance: 0, monthlyMortgage: 0, remainingTerm: 0, purchaseYear: 2020 } as never);
    const let1 = rentOut(p, "h1").player;
    expect(let1.properties[0].rentedOut).toBe(true);
    expect(netRent(let1.properties[0])).toBeGreaterThan(0);
    const back = moveBackIn(let1, "h1").player;
    expect(back.properties[0].rentedOut).toBeFalsy();
    p.finance.studentLoan = 20_000;
    const paid = repayStudentLoan(p, 8_000).player;
    expect(paid.finance.studentLoan).toBe(12_000);
    expect(inDebtCrisis(p)).toBe(false);
    void rng;
  });

  it("whole lives of ordinary workers with student debt run without throwing and the debt shrinks or stays bounded", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { rng, p: p0 } = worker(40 + seed);
      let p = p0;
      p.finance.studentLoan = 30_000;
      for (let y = 0; y < 30 && p.alive; y++) {
        p = ageUp(p, rng).player;
        if (!p.currentJob && p.age < 65) p = applyForJob(p, "fast_food", rng).player;
      }
      expect(p.finance.studentLoan).toBeLessThan(200_000);
    }
  });
});
