import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { applyForJob, askForRaise, auditionContract, goFullTime, goPartTime, leaveLabel, pensionFor, quitJob, retire } from "../career";
import { startBusiness, sellBusiness } from "../paths";
import { blockerFor } from "../occupation";
import { setLifestyle } from "../world";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import type { PlayerState } from "@/types/game.types";

const adult = (seed: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 30;
  p.education = { stage: "None", yearsLeft: 0, major: null, grades: 60, studyEffort: 0, degrees: ["highschool"] };
  p.smarts = 70;
  p.looks = 70;
  p.bankBalance = 500_000;
  return { rng, p };
};

const hire = (p: PlayerState, line: string, rng: ReturnType<typeof makeRng>) => {
  for (let i = 0; i < 20; i++) {
    const r = applyForJob(p, line, rng);
    if (r.player.currentJob) return r.player;
    p = { ...r.player, annual: {} };
  }
  throw new Error("never hired");
};

describe("exclusive commitments", () => {
  it("a business owner cannot hold a job, and an employee cannot found a business", () => {
    const { rng, p } = adult(1);
    const employed = hire(p, "retail", rng);
    expect(blockerFor(employed, "business")).toMatch(/quit first/i);
    expect(startBusiness(employed, "foodtruck", "x").player.business).toBeNull();

    const free = quitJob(employed).player;
    const owner = startBusiness(free, "foodtruck", "Truck").player;
    expect(owner.business).not.toBeNull();
    const retry = applyForJob(owner, "retail", rng);
    expect(retry.player.currentJob).toBeNull();
    expect(retry.notices?.[0]).toMatchObject({ title: "Can't Apply" });

    const sold = sellBusiness(owner).player;
    expect(blockerFor(sold, "job")).toBeNull();
  });

  it("a signed musician can't take a job or open a business and can leave the label", () => {
    const { rng, p } = adult(2);
    p.music = { status: "solo", signed: true, pendingAlbum: null, albums: [] };
    expect(blockerFor(p, "job")).toMatch(/label/);
    expect(blockerFor(p, "business")).toMatch(/label/);
    expect(applyForJob(p, "retail", rng).player.currentJob).toBeNull();
    const left = leaveLabel(p).player;
    expect(left.music.signed).toBe(false);
    expect(blockerFor(left, "job")).toBeNull();
  });

  it("an employee can't sign a record deal", () => {
    const { rng, p } = adult(3);
    const employed = hire(p, "retail", rng);
    employed.skills.music = 100;
    const res = auditionContract(employed, "solo", 100, rng);
    expect(res.player.music.signed).toBe(false);
  });

  it("students can only work part-time at entry-level jobs", () => {
    const { rng, p } = adult(4);
    p.age = 19;
    p.education = { stage: "University", yearsLeft: 3, major: "business", grades: 60, studyEffort: 0, degrees: ["highschool"] };
    expect(applyForJob(p, "software", rng).player.currentJob).toBeNull();
    const job = hire(p, "retail", rng).currentJob!;
    expect(job.partTime).toBe(true);
    expect(job.salary).toBeLessThan(CAREER_BY_ID.retail.ladder[0].salary);
  });

  it("full-time workers can cut hours and return, and can't study full time until they do", () => {
    const { rng, p } = adult(5);
    const employed = hire(p, "retail", rng);
    const before = employed.currentJob!.salary;
    expect(blockerFor(employed, "study")).toMatch(/part-time/i);
    const pt = goPartTime(employed).player;
    expect(pt.currentJob!.partTime).toBe(true);
    expect(pt.currentJob!.salary).toBeLessThan(before);
    expect(blockerFor(pt, "study")).toBeNull();
    const ft = goFullTime(pt).player;
    expect(ft.currentJob!.partTime).toBeFalsy();
    expect(ft.currentJob!.salary).toBeGreaterThanOrEqual(before);
  });
});

describe("pension", () => {
  it("scales with years actually worked", () => {
    const { p } = adult(6);
    p.age = 62;
    p.stats.highestSalary = 80_000;
    p.currentJob = { id: "j", title: "Manager", company: "X", salary: 80_000, performance: 70, tier: 2, lineId: "retail" };
    p.stats.yearsWorked = 38;
    const long = pensionFor(p);
    p.stats.yearsWorked = 5;
    const short = pensionFor(p);
    expect(long).toBeGreaterThan(short * 2);
    p.stats.yearsWorked = 38;
    expect(retire(p).player.pension).toBe(long);
  });
});

describe("effort", () => {
  const performanceAfter = (effort: "coast" | "steady" | "grind", seed: number) => {
    const { rng, p } = adult(seed);
    const employed = hire(p, "retail", rng);
    employed.effort = effort;
    employed.currentJob!.performance = 60;
    employed.health = 80;
    const aged = ageUp(employed, rng).player;
    return aged.currentJob?.performance ?? -1;
  };
  it("grinding builds performance faster than coasting", () => {
    let grind = 0;
    let coast = 0;
    for (let s = 1; s <= 15; s++) {
      grind += performanceAfter("grind", s);
      coast += performanceAfter("coast", s);
    }
    expect(grind).toBeGreaterThan(coast + 15 * 8);
  });
  it("grinding costs health", () => {
    const { rng, p } = adult(9);
    const base = hire(p, "retail", rng);
    base.health = 80;
    base.effort = "grind";
    let steadyTotal = 0;
    let grindTotal = 0;
    for (let s = 1; s <= 10; s++) {
      const r1 = makeRng(s);
      const r2 = makeRng(s);
      grindTotal += ageUp({ ...structuredClone(base), effort: "grind" }, r1).player.health;
      steadyTotal += ageUp({ ...structuredClone(base), effort: "steady" }, r2).player.health;
    }
    expect(grindTotal).toBeLessThan(steadyTotal);
  });
});

describe("lifestyle", () => {
  it("frugal saves more than lavish but is less happy", () => {
    const run = (level: number) => {
      const { rng, p } = adult(11);
      const base = hire(p, "retail", rng);
      let q = setLifestyle(base, level).player;
      q.happiness = 60;
      const r = makeRng(5);
      for (let i = 0; i < 10; i++) q = ageUp(q, r).player;
      return q;
    };
    const frugal = run(0);
    const lavish = run(2);
    expect(frugal.bankBalance).toBeGreaterThan(lavish.bankBalance);
    expect(lavish.happiness).toBeGreaterThan(frugal.happiness);
  });
});

describe("career mobility", () => {
  it("lets you search while employed, and experience in a field skips entry level", () => {
    const { rng, p } = adult(21);
    const employed = hire(p, "retail", rng);
    expect(employed.currentJob!.tier).toBe(0);
    const switched = hire({ ...employed, annual: {} }, "fast_food", rng);
    expect(switched.currentJob!.lineId).toBe("fast_food");

    const vet = { ...adult(22).p, careerYears: { retail: 9 } as Record<string, number> };
    const hired = hire(vet, "retail", makeRng(22)).currentJob!;
    expect(hired.tier).toBe(2);
    expect(hired.salary).toBe(CAREER_BY_ID.retail.ladder[2].salary);
  });

  it("can't 'switch' into the field you already work in", () => {
    const { rng, p } = adult(23);
    const employed = hire(p, "retail", rng);
    expect(applyForJob(employed, "retail", rng).notices?.[0]).toMatchObject({ title: "Can't Apply" });
  });

  it("asking for a raise helps strong performers more than weak ones, once a year", () => {
    let strong = 0;
    let weak = 0;
    for (let s = 1; s <= 40; s++) {
      const { rng, p } = adult(100 + s);
      const j = hire(p, "retail", rng);
      const a = structuredClone(j);
      a.currentJob!.performance = 95;
      const b = structuredClone(j);
      b.currentJob!.performance = 35;
      if (askForRaise(a, makeRng(s)).player.currentJob!.salary > a.currentJob!.salary) strong++;
      if (askForRaise(b, makeRng(s)).player.currentJob!.salary > b.currentJob!.salary) weak++;
    }
    expect(strong).toBeGreaterThan(weak + 8);
    const { rng, p } = adult(150);
    const once = askForRaise(hire(p, "retail", rng), rng).player;
    expect(askForRaise(once, rng).notices?.[0]).toMatchObject({ title: "Once Is Enough" });
  });
});
