import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, makeRelativeBase } from "../state";
import { ageUp } from "../ageUp";
import { continueAsChild } from "../legacy";
import { buildFamilyTree } from "../familyTree";
import { dynastyScore, fundTrust, groomBlocker, groomChild, setWill, TRUST_MIN_GIFT } from "../dynasty";
import type { PlayerState } from "@/types/game.types";

function family(seed: number): PlayerState {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "wealthy", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 55;
  p.birthYear = p.year - 55;
  p.bankBalance = 800_000;
  p.relatives = p.relatives.filter((r) => r.relation === "Friend");
  p.relatives.push(makeRelativeBase(rng, "Child", `Sam ${p.lastName}`, 26, "Male", 4, 70), makeRelativeBase(rng, "Child", `Alex ${p.lastName}`, 12, "Female", 4, 70));
  return p;
}

describe("dynasty", () => {
  it("a family tree builds for any life and tracks generations across handovers", () => {
    const p = family(1);
    const t0 = buildFamilyTree(p);
    expect(t0.you.relation).toBe("You");
    expect(t0.children.length).toBe(2);
    const kid = p.relatives.find((r) => r.relation === "Child" && r.age === 26)!;
    const next = continueAsChild(p, kid.id, makeRng(2), true)!;
    const t1 = buildFamilyTree(next);
    expect(t1.standing.generation).toBe(2);
    expect(t1.chronicle.length).toBeGreaterThanOrEqual(1);
    expect(t1.siblings.length).toBe(1);
    expect(dynastyScore(next)).toBeGreaterThan(0);
  });

  it("the trust takes cash for good and pays a yearly distribution", () => {
    const rng = makeRng(3);
    const p = family(3);
    expect(fundTrust(p, 100).player).toBe(p); // below minimum
    const funded = fundTrust(p, TRUST_MIN_GIFT * 5).player;
    expect(funded.bankBalance).toBe(p.bankBalance - TRUST_MIN_GIFT * 5);
    expect(funded.dynasty.trust?.balance).toBe(TRUST_MIN_GIFT * 5);
    let q = funded;
    const before = q.dynasty.trust!.paid;
    for (let i = 0; i < 3; i++) q = ageUp(q, rng).player;
    expect(q.dynasty.trust!.paid).toBeGreaterThan(before);
  });

  it("the will is recorded, and a named heir is remembered", () => {
    const p = family(4);
    const kid = p.relatives.find((r) => r.relation === "Child")!;
    const q = setWill(p, "chosen", kid.id).player;
    expect(q.dynasty.will).toEqual({ plan: "chosen", chosenId: kid.id });
    expect(setWill(q, "equal", kid.id).player.dynasty.will.chosenId).toBeNull();
  });

  it("grooming an heir needs a real background in the field, a child of the right age, and one child a year", () => {
    const rng = makeRng(5);
    const p = family(5);
    const young = p.relatives.find((r) => r.age === 12)!;
    const grown = p.relatives.find((r) => r.age === 26)!;
    expect(groomBlocker(p, grown, "business")).toMatch(/grown/);
    p.flags.push("business_owner");
    expect(groomBlocker(p, young, "business")).toBeNull();
    const done = groomChild(p, rng, young.id, "business").player;
    expect(done.relatives.find((r) => r.id === young.id)?.groom?.level).toBeGreaterThan(0);
    expect(groomBlocker(done, done.relatives.find((r) => r.id === young.id)!, "business")).toMatch(/already/);
  });

  it("dynasty chains over many handovers never throw and keep the chronicle growing", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const rng = makeRng(seed);
      let p = family(seed);
      for (let gen = 0; gen < 4; gen++) {
        const kid = p.relatives.find((r) => r.relation === "Child" && r.alive);
        if (!kid) break;
        p = continueAsChild(p, kid.id, rng, gen % 2 === 0)!;
        for (let y = 0; y < 25 && p.alive; y++) p = ageUp(p, rng).player;
        if (!p.relatives.some((r) => r.relation === "Child" && r.alive)) p.relatives.push(makeRelativeBase(rng, "Child", `Heir ${p.lastName}`, 22, "Female", 3, 70));
        expect(() => buildFamilyTree(p)).not.toThrow();
      }
      expect(buildFamilyTree(p).standing.generation).toBeGreaterThanOrEqual(2);
    }
  });
});
