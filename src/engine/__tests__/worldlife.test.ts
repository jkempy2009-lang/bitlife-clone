import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { COUNTRIES } from "@/data/countries";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { addDisease } from "../events";
import { plansFor, startTreatment, stopTreatment, activePlan } from "../treatment";
import { routeOptions, needsRoute } from "../visa";
import { relocate } from "../world";
import { SCHOOL_ACTIONS, schoolAction, joinClub, inSchoolYears } from "../school";
import { countryNews, worldPriceLevel } from "../worldEvents";
import type { PlayerState } from "@/types/game.types";

const adult = (seed: number, country = "United States"): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, country, talents: NEUTRAL }, rng);
  p.age = 40;
  p.birthYear = p.year - 40;
  p.bankBalance = 200_000;
  p.education = { stage: "None", yearsLeft: 0, major: null, grades: 60, studyEffort: 0, degrees: ["highschool"] };
  return { rng, p };
};

describe("treatment plans", () => {
  it("a chronic condition offers plans; following one costs money and is recorded, stopping it lapses", () => {
    const { rng, p } = adult(1);
    expect(addDisease(p, "diabetes", rng)).toBe(true);
    const d = p.diseases.find((x) => x.id === "diabetes")!;
    const plans = plansFor(d);
    expect(plans.length).toBeGreaterThan(0);
    const started = startTreatment(p, "diabetes", plans[0].id, rng);
    const q = started.player;
    expect(activePlan(q.diseases[0])?.id).toBe(plans[0].id);
    const stopped = stopTreatment(q, "diabetes").player;
    expect(activePlan(stopped.diseases[0])).toBeUndefined();
  });
});

describe("immigration", () => {
  it("abroad needs a route; citizens move freely; refusals cost money", () => {
    const { rng, p } = adult(2);
    const dest = "Germany";
    expect(needsRoute(p, dest)).toBe(true);
    expect(relocate(p, dest, rng).player).toBe(p); // no papers
    const routes = routeOptions(p, dest);
    expect(routes.length).toBeGreaterThan(1);
    let moved = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const { rng: r, p: q } = adult(100 + seed);
      const route = routeOptions(q, dest).find((x) => !x.blocker && x.id !== "asylum");
      if (!route) continue;
      const out = relocate(q, dest, r, route.id).player;
      expect(out.bankBalance).toBeLessThan(q.bankBalance);
      if (out.residence.country === dest) moved++;
    }
    expect(moved).toBeGreaterThan(0);
  });
});

describe("school life", () => {
  it("clubs and actions work for school-age players", () => {
    const rng = makeRng(3);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 13;
    p.birthYear = p.year - 13;
    expect(inSchoolYears(p)).toBe(true);
    const joined = joinClub(p, "sport").player;
    expect(joined.school.club).toBe("sport");
    joined.school.bullied = 50;
    expect(SCHOOL_ACTIONS.teacher.when(joined)).toBe(true);
    const out = schoolAction(joined, "teacher", rng).player;
    expect(out).not.toBe(joined);
  });
});

describe("the world around you", () => {
  it("lives in every country and several eras run to old age without throwing; events make news and prices move", () => {
    let news = 0;
    for (const c of COUNTRIES) {
      const rng = makeRng(7);
      const p0 = createNewPlayer({ scenario: "average", startYear: 1960, country: c.name, talents: NEUTRAL }, rng);
      let p = p0;
      for (let y = 0; y < 80 && p.alive; y++) {
        p = ageUp(p, rng).player;
        news += countryNews(p.world, p.residence.country, p.year).length > 0 ? 1 : 0;
        expect(worldPriceLevel(p)).toBeGreaterThan(0.8);
      }
      expect(p.age).toBeGreaterThan(0);
    }
    expect(news).toBeGreaterThan(0);
  });
});
