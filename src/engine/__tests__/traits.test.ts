import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, TALENT_KEYS } from "../state";
import { ageUp } from "../ageUp";
import { applyMoodEffects } from "../health";
import { checkChallenge } from "../challenges";
import { hydrate } from "../save";
import { quitVice } from "../vices";
import { signWithClub } from "../athlete";
import { talentCeiling } from "../creativeCore";
import { continueAsChild } from "../legacy";
import type { PlayerState } from "@/types/game.types";

const make = (seed: number, opts: Partial<Parameters<typeof createNewPlayer>[0]> = {}) =>
  createNewPlayer({ scenario: "average", startYear: 2026, ...opts }, makeRng(seed));

describe("character design", () => {
  it("chosen traits are used exactly; unchosen gifts are randomised", () => {
    const p = make(1, { stats: { happiness: 40, health: 95, smarts: 20, looks: 77 }, talents: { athletic: 90 } });
    expect([p.happiness, p.health, p.smarts, p.looks]).toEqual([40, 95, 20, 77]);
    expect(p.talents.athletic).toBe(90);
    const a = make(2).talents;
    const b = make(3).talents;
    expect(TALENT_KEYS.some((k) => a[k] !== b[k])).toBe(true);
    for (const k of TALENT_KEYS) {
      expect(a[k]).toBeGreaterThanOrEqual(0);
      expect(a[k]).toBeLessThanOrEqual(100);
    }
  });

  it("temperament is lasting: a cheerful start settles higher than a gloomy one", () => {
    const run = (happy: number) => {
      let tot = 0;
      for (let s = 1; s <= 8; s++) {
        let p = make(s, { stats: { happiness: happy, health: 80, smarts: 60, looks: 60 } });
        p.age = 30;
        p.currentJob = null;
        const rng = makeRng(s);
        for (let i = 0; i < 12; i++) p = ageUp(p, rng).player;
        tot += p.happiness;
      }
      return tot / 8;
    };
    expect(run(95)).toBeGreaterThan(run(20) + 5);
  });

  it("misery wears health and work down; contentment protects them", () => {
    const low = make(4);
    low.age = 30;
    low.happiness = 15;
    low.health = 70;
    applyMoodEffects(low);
    expect(low.health).toBeLessThan(70);
    const high = make(5);
    high.age = 30;
    high.happiness = 90;
    high.health = 70;
    applyMoodEffects(high);
    expect(high.health).toBeGreaterThan(70);
  });

  it("hidden gifts have real effects: athletic talent, musical ceiling, charm and willpower", () => {
    const strong = make(6, { talents: { athletic: 100, musical: 100, charisma: 100, discipline: 100 } });
    const weak = make(6, { talents: { athletic: 0, musical: 0, charisma: 0, discipline: 0 } });
    expect(strong.skills.charisma).toBeGreaterThan(weak.skills.charisma + 20);
    expect(talentCeiling(strong, "music")).toBeGreaterThan(talentCeiling(weak, "music") + 30);
    for (const pl of [strong, weak]) {
      pl.age = 12;
      pl.skills.athletics = 30;
    }
    let s = 0;
    let w = 0;
    for (let i = 1; i <= 20; i++) {
      s += signWithClub(strong, "Soccer", makeRng(i)).player.athlete.talent;
      w += signWithClub(weak, "Soccer", makeRng(i)).player.athlete.talent;
    }
    expect(s).toBeGreaterThan(w + 20 * 20);
    // Willpower helps quitting
    let quitStrong = 0;
    let quitWeak = 0;
    for (let i = 1; i <= 60; i++) {
      const a = { ...structuredClone(strong), age: 30 } as PlayerState;
      a.vices.smoking = 50;
      const b = { ...structuredClone(weak), age: 30 } as PlayerState;
      b.vices.smoking = 50;
      if (quitVice(a, "smoking", makeRng(i)).player.vices.smoking < 50) quitStrong++;
      if (quitVice(b, "smoking", makeRng(i)).player.vices.smoking < 50) quitWeak++;
    }
    expect(quitStrong).toBeGreaterThan(quitWeak + 10);
  });

  it("free-edited lives don't win challenges; old saves get stable gifts; heirs inherit gifts", () => {
    const p = make(7, { challenge: "rags", freeStats: true });
    p.bankBalance = 5_000_000;
    const n: Parameters<typeof checkChallenge>[1] = [];
    checkChallenge(p, n);
    expect(p.challenge?.status).toBe("active");

    const raw = JSON.parse(JSON.stringify(make(8))) as Partial<PlayerState>;
    delete raw.talents;
    delete raw.outlook;
    const h1 = hydrate(raw as PlayerState);
    const h2 = hydrate(raw as PlayerState);
    expect(h1.talents).toEqual(h2.talents);
    expect(h1.outlook).toBe(84);

    const old = make(9, { talents: { athletic: 100, musical: 100, acting: 100, charisma: 100, business: 100, discipline: 100 } });
    old.age = 60;
    old.alive = false;
    old.deathYear = old.year;
    old.relatives = [{ id: "K", relation: "Child", name: "Kid Test", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Male", smarts: 50, looks: 50 }];
    const heir = continueAsChild(old, "K", makeRng(10))!;
    for (const k of TALENT_KEYS) expect(heir.talents[k]).toBeGreaterThanOrEqual(50);
  });
});
