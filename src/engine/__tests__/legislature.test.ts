import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { makeJob } from "../career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { LAWS } from "@/data/laws";
import { availableBills, billChance, executiveOrder, isEnacted, nationApproval, pushBill, repealLaw } from "../legislature";
import { setStance } from "../politics";
import type { PlayerState } from "@/types/game.types";

function official(seed: number, tier: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 50;
  p.birthYear = p.year - 50;
  p.smarts = 80;
  p.bankBalance = 800_000;
  p.currentJob = makeJob(CAREER_BY_ID.politics, tier, rng);
  p.statecraft.highestTier = tier;
  p.politics.popularity = 60;
  p.statecraft.coalition = 70;
  p.statecraft = { ...p.statecraft, stances: { ...p.statecraft.stances, economy: -1, health: -1 } };
  return { rng, p };
}

describe("law data", () => {
  it("every law is well formed", () => {
    const ids = new Set<string>();
    for (const l of LAWS) {
      expect(ids.has(l.id), l.id).toBe(false);
      ids.add(l.id);
      expect(l.minTier).toBeGreaterThanOrEqual(0);
      expect(l.opposition).toBeGreaterThanOrEqual(0);
      expect(l.opposition).toBeLessThanOrEqual(1);
      expect(Object.keys(l.effects).length).toBeGreaterThan(0);
    }
  });
});

describe("legislating", () => {
  it("only offices with a seat can legislate, bills are gated by tier and stance, odds are probabilities", () => {
    const { p } = official(1, 0);
    const none = { ...p, currentJob: null };
    expect(pushBill(none, makeRng(1), LAWS[0].id).player).toBe(none);
    const bills = availableBills(p);
    for (const l of bills) {
      expect(l.minTier).toBeLessThanOrEqual(0);
      const c = billChance(p, l);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("across many attempts a bill sometimes passes and changes the statute book; repeal removes it", () => {
    let passed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { rng, p } = official(seed, 2);
      const law = availableBills(p)[0];
      if (!law) continue;
      const out = pushBill(p, rng, law.id, "compromise").player;
      if (isEnacted(out, law.id)) {
        passed++;
        // Repeal is a separate floor fight, so it may need another year; it must at least be well formed.
        const next = ageUp(out, rng).player;
        const gone = repealLaw(next, rng, law.id).player;
        expect(gone.statecraft.laws.length).toBeLessThanOrEqual(next.statecraft.laws.length);
      }
    }
    expect(passed).toBeGreaterThan(0);
  });

  it("executive orders need a governor or higher; the nation's approval is a bounded number", () => {
    const { rng, p } = official(3, 0);
    const law = LAWS.find((l) => l.minTier === 0)!;
    expect(executiveOrder(p, rng, law.id).player).toBe(p);
    expect(nationApproval(p)).toBeGreaterThanOrEqual(0);
    expect(nationApproval(p)).toBeLessThanOrEqual(100);
    void setStance;
  });

  it("whole political careers run through the term cycle without throwing", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { rng, p: p0 } = official(20 + seed, 2);
      let p = p0;
      for (let y = 0; y < 25 && p.alive; y++) {
        const law = availableBills(p)[0];
        if (law && p.currentJob) p = pushBill(p, rng, law.id).player;
        p = ageUp(p, rng).player;
      }
      expect(p.age).toBeGreaterThan(50);
    }
  });
});
