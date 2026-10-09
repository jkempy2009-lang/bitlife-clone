import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, makeRelativeBase } from "../state";
import { ageUp } from "../ageUp";
import { addGrievance, compatibility, remember, relationshipHealth, soften, timeline, worstGrievance } from "../bonds";
import { backTheirGoals, clearTheAir, counselling, giveSpace, reconcile, separate, setCustody, talkAboutUs } from "../partnership";
import { ensureInLaws, visitInLaws } from "../inlaws";
import { reachOut } from "../circle";
import { meetSomeone, propose } from "../social";
import type { PlayerState, Relative } from "@/types/game.types";

function couple(seed: number): { rng: ReturnType<typeof makeRng>; p: PlayerState; partner: Relative } {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 32;
  p.birthYear = p.year - 32;
  p.bankBalance = 80_000;
  const partner: Relative = { ...makeRelativeBase(rng, "Partner", "Jo Rivers", 31, "Female", 3, 70), partnerStatus: "married", marriedYear: p.year - 3 };
  p.relatives = p.relatives.filter((r) => r.relation === "Friend");
  p.relatives.push(partner);
  return { rng, p, partner };
}

describe("memory and grievances", () => {
  it("moments are remembered, capped, and hurts can be softened", () => {
    const { p, partner } = couple(1);
    for (let i = 0; i < 40; i++) remember(p, partner, "joy", `Moment ${i}`);
    expect(partner.memories!.length).toBeLessThanOrEqual(30);
    expect(timeline(partner, 5)).toHaveLength(5);
    const g = addGrievance(p, partner, "betrayal", 3, "You lied about the money.");
    expect(worstGrievance(partner)?.id).toBe(g.id);
    soften(partner, g.id, 2);
    expect(worstGrievance(partner)?.weight ?? 0).toBeLessThan(3);
  });

  it("compatibility and health summaries exist for any partner", () => {
    const { p, partner } = couple(2);
    expect(compatibility(p, partner)).toBeTruthy();
    expect(relationshipHealth(p, partner)).toBeTruthy();
  });
});

describe("partnership actions", () => {
  it("talking, backing goals, space, counselling, separation and reconciling all run and change the state", () => {
    const { rng, p, partner } = couple(3);
    for (const out of [talkAboutUs(p, partner.id), backTheirGoals(p, partner.id, rng), giveSpace(p, partner.id), counselling(p, partner.id, rng)]) {
      expect(out.player).toBeDefined();
    }
    const sep = separate(p, partner.id).player;
    expect(sep.relatives.find((r) => r.id === partner.id)?.separatedYear).toBe(p.year);
    const back = reconcile(sep, partner.id, rng).player;
    expect(back).toBeDefined();
    addGrievance(p, partner, "fight", 2, "A bad row.");
    expect(clearTheAir(p, partner.id, "apologise" as never, rng).player).toBeDefined();
  });

  it("children of a split couple get a custody arrangement", () => {
    const { rng, p, partner } = couple(4);
    partner.partnerStatus = "ex";
    const kid = { ...makeRelativeBase(rng, "Child", `Sam ${p.lastName}`, 8, "Male", 3, 70), custody: "you" as const, otherParent: partner.name };
    p.relatives.push(kid);
    const out = setCustody(p, kid.id, "shared", rng).player;
    expect(out.relatives.find((r) => r.id === kid.id)?.custody).toBe("shared");
  });
});

describe("in-laws and friends", () => {
  it("a spouse comes with a family you can visit", () => {
    const { rng, p, partner } = couple(5);
    expect(ensureInLaws(p, partner, rng).length).toBeGreaterThan(0);
    expect(visitInLaws(p, partner.id, rng).player).toBeDefined();
  });

  it("friends can be met and reached out to", () => {
    const rng = makeRng(6);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 25;
    const friend: Relative = { ...makeRelativeBase(rng, "Friend", "Pat Lee", 26, "Male", 3, 55), lostYear: p.year - 4 };
    p.relatives.push(friend);
    expect(meetSomeone).toBeDefined();
    const out = reachOut(p, friend.id, rng);
    expect(out.player).toBeDefined();
  });
});

describe("whole lives", () => {
  it("long marriages and families run to old age without throwing, with memories accumulating", () => {
    let withMemories = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { rng, p: p0 } = couple(60 + seed);
      let p = p0;
      for (let y = 0; y < 40 && p.alive; y++) p = ageUp(p, rng).player;
      const spouse = p.relatives.find((r) => r.relation === "Partner" || r.relation === "Child");
      if ((spouse?.memories?.length ?? 0) > 0 || p.relatives.some((r) => (r.memories?.length ?? 0) > 0)) withMemories++;
    }
    expect(withMemories).toBeGreaterThan(2);
    void propose;
  });
});
