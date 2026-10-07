import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { visitDoctor } from "../activities";
import { habitCost, hasInsurance, illnessCosts, medicalPrice, riskMultiplier, setHabit } from "../health";
import { instantiateDisease, DISEASE_CATALOG } from "@/data/diseases";
import { NEUTRAL } from "./helpers/neutral";
import type { PlayerState } from "@/types/game.types";

const adult = (seed: number, country = "United States"): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, country, talents: NEUTRAL }, rng);
  p.age = 40;
  p.health = 70;
  p.bankBalance = 100_000;
  p.residence.country = country;
  p.education = { stage: "None", yearsLeft: 0, major: null, grades: 60, studyEffort: 0, degrees: ["highschool"] };
  return { rng, p };
};

describe("health routine", () => {
  it("dedicated exercise and diet improve health, cost money and lower cardio risk; neglect does the reverse", () => {
    const { p } = adult(1);
    const base = riskMultiplier(p, "heart_disease");
    const fit = setHabit(setHabit(p, "exercise", 2).player, "diet", 2).player;
    const slob = setHabit(setHabit(p, "exercise", 0).player, "diet", 0).player;
    expect(riskMultiplier(fit, "heart_disease")).toBeLessThan(base);
    expect(riskMultiplier(slob, "heart_disease")).toBeGreaterThan(base);
    expect(habitCost(fit)).toBeGreaterThan(habitCost(p));

    const healthAfter = (pl: PlayerState) => {
      let total = 0;
      for (let s = 1; s <= 20; s++) total += ageUp(structuredClone(pl), makeRng(s)).player.health;
      return total / 20;
    };
    expect(healthAfter(fit)).toBeGreaterThan(healthAfter(p));
    expect(healthAfter(p)).toBeGreaterThan(healthAfter(slob));
  });

  it("smoking drives lung disease and cancer risk", () => {
    const { p } = adult(2);
    p.vices.smoking = 80;
    expect(riskMultiplier(p, "copd")).toBeGreaterThan(2);
  });
});

describe("healthcare costs", () => {
  it("are far lower with public care or insurance than uninsured in the US", () => {
    const us = adult(3).p;
    us.currentJob = null;
    expect(hasInsurance(us)).toBe(false);
    const uninsured = medicalPrice(us, 200);
    us.currentJob = { id: "j", title: "Clerk", company: "X", salary: 40_000, performance: 60, tier: 0, lineId: "retail" };
    expect(hasInsurance(us)).toBe(true);
    expect(medicalPrice(us, 200)).toBeLessThan(uninsured / 4);
    const uk = adult(3, "United Kingdom").p;
    uk.currentJob = null;
    expect(medicalPrice(uk, 200)).toBeLessThan(uninsured / 8);
  });

  it("chronic and terminal illness carry yearly costs", () => {
    const { p, rng } = adult(4);
    expect(illnessCosts(p)).toBe(0);
    p.diseases.push(instantiateDisease(DISEASE_CATALOG.find((d) => d.id === "diabetes")!, (a, b) => rng.int(a, b)));
    p.diseases.push(instantiateDisease(DISEASE_CATALOG.find((d) => d.id === "cancer")!, (a, b) => rng.int(a, b)));
    expect(illnessCosts(p)).toBeGreaterThan(8_000);
  });

  it("a check-up records screening and costs the discounted price", () => {
    const { p, rng } = adult(5, "United Kingdom");
    const res = visitDoctor(p, null, rng).player;
    expect(res.flags).toContain(`checkup_${p.year}`);
    expect(100_000 - res.bankBalance).toBe(medicalPrice(p, 200));
  });
});
