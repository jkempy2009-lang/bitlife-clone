import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, getPartner } from "../state";
import { ageUp } from "../ageUp";
import { endRelationship } from "../social";
import { divorceSettlement, minorChildren, spouseIncome } from "../household";
import type { PlayerState, Relative } from "@/types/game.types";

const married = (seed: number, tier: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 35;
  p.education.degrees = ["highschool"];
  p.education = { ...p.education, stage: "None", yearsLeft: 0 };
  const partner: Relative = {
    id: "sp", relation: "Partner", name: "Sam Spouse", age: 34, relationshipBar: 80, health: 90, alive: true, incomeTier: tier,
    gender: "Female", smarts: 60, looks: 60, partnerStatus: "married", marriedYear: p.year - 6,
  };
  p.relatives = p.relatives.filter((r) => r.relation !== "Partner").concat(partner);
  p.bankBalance = 100_000;
  return { rng, p };
};

describe("household economy", () => {
  it("a high-earning spouse lifts household savings; shared home costs less than two flats", () => {
    const rich = married(1, 5);
    const poor = married(1, 1);
    const a = ageUp(rich.p, makeRng(7)).player.bankBalance;
    const b = ageUp(poor.p, makeRng(7)).player.bankBalance;
    expect(a).toBeGreaterThan(b + 50_000);
  });

  it("divorce settlement grows with the length of the marriage and can force a house sale", () => {
    const { p } = married(2, 3);
    const partner = getPartner(p)!;
    p.bankBalance = 200_000;
    partner.marriedYear = p.year - 1;
    const short = divorceSettlement(structuredClone(p), partner, false);
    partner.marriedYear = p.year - 15;
    const long = divorceSettlement(structuredClone(p), partner, false);
    expect(long).toBeGreaterThan(short);
    const fault = divorceSettlement(structuredClone(p), partner, true);
    expect(fault).toBeGreaterThan(long);

    p.bankBalance = 1_000;
    p.properties = [{ id: "h", name: "Family Home", originalValue: 400_000, currentValue: 400_000, condition: 80, monthlyMortgage: 0, remainingTerm: 0, mortgageBalance: 0, archetypeId: "x" }];
    endRelationship(p, "divorce");
    expect(p.properties).toHaveLength(0);
    expect(p.bankBalance).toBeGreaterThan(100_000);
  });

  it("pays child support after a divorce while kids are minors, and stops when they grow up", () => {
    const { p } = married(3, 3);
    p.relatives.push({ id: "k", relation: "Child", name: "Kid", age: 16, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Male", smarts: 50, looks: 50 });
    p.currentJob = { id: "j", title: "Manager", company: "X", salary: 80_000, performance: 70, tier: 2, lineId: "retail" };
    endRelationship(p, "divorce");
    expect(p.flags).toContain("child_support");
    expect(minorChildren(p)).toHaveLength(1);
    let q = ageUp(p, makeRng(1)).player;
    expect(q.flags).toContain("child_support");
    q = ageUp(q, makeRng(2)).player;
    q = ageUp(q, makeRng(3)).player;
    expect(q.flags).not.toContain("child_support");
  });

  it("spouse income drops in retirement", () => {
    const { p } = married(4, 4);
    const sp = getPartner(p)!;
    const working = spouseIncome(sp);
    sp.age = 70;
    expect(spouseIncome(sp)).toBeLessThan(working / 2);
  });
});
