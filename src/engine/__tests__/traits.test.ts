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

    const old = make(9, { talents: Object.fromEntries(TALENT_KEYS.map((k) => [k, 100])) as PlayerState["talents"] });
    old.age = 60;
    old.alive = false;
    old.deathYear = old.year;
    old.relatives = [{ id: "K", relation: "Child", name: "Kid Test", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Male", smarts: 50, looks: 50 }];
    const heir = continueAsChild(old, "K", makeRng(10))!;
    for (const k of TALENT_KEYS) expect(heir.talents[k]).toBeGreaterThanOrEqual(50);
  });
});

describe("the wider set of hidden traits", () => {
  const all = (v: number) => Object.fromEntries(TALENT_KEYS.map((k) => [k, v])) as PlayerState["talents"];
  it("there are many, all editable, each 0-100, with unrandomised choices honoured", () => {
    expect(TALENT_KEYS.length).toBeGreaterThanOrEqual(20);
    const p = make(21, { talents: { injuryProne: 100, speaking: 0 } });
    expect(p.talents.injuryProne).toBe(100);
    expect(p.talents.speaking).toBe(0);
    for (const k of TALENT_KEYS) expect(p.talents[k]).toBeGreaterThanOrEqual(0);
  });

  it("injury-prone athletes are hurt more; sly criminals are caught less; resilient and long-lived people get ill less", async () => {
    const { injuryChance } = await import("../athleteModel");
    const { catchChance } = await import("../justice");
    const { riskMultiplier } = await import("../health");
    const hi = make(22, { talents: all(100) });
    const lo = make(22, { talents: all(0) });
    hi.athlete.sport = "Soccer";
    lo.athlete.sport = "Soccer";
    expect(injuryChance(hi, hi.athlete, "steady")).toBeGreaterThan(injuryChance(lo, lo.athlete, "steady"));
    hi.age = lo.age = 25;
    expect(catchChance(hi, "shoplifting")).toBeLessThan(catchChance(lo, "shoplifting"));
    expect(riskMultiplier(hi, "diabetes")).toBeLessThan(riskMultiplier(lo, "diabetes"));
    expect(riskMultiplier(hi, "depression")).toBeLessThan(riskMultiplier(lo, "depression"));
  });

  it("public speaking sways voters; money sense trims living costs; addictive personalities get hooked faster", async () => {
    const { electionOdds } = await import("../politics");
    const { addVice } = await import("../vices");
    const hi = make(23, { talents: all(100) });
    const lo = make(23, { talents: all(0) });
    expect(electionOdds(hi, 1).chance).toBeGreaterThanOrEqual(electionOdds(lo, 1).chance);
    const a = make(24, { talents: { addictive: 100 } });
    const b = make(24, { talents: { addictive: 0 } });
    addVice(a, "smoking", 20);
    addVice(b, "smoking", 20);
    expect(a.vices.smoking).toBeGreaterThan(b.vices.smoking);
    const run = (v: number) => {
      const p = make(25, { talents: { moneySense: v } });
      p.age = 30;
      p.bankBalance = 50_000;
      p.currentJob = { id: "j", title: "Clerk", company: "X", salary: 40_000, performance: 60, tier: 0, lineId: "retail" };
      p.education = { ...p.education, stage: "None", yearsLeft: 0 };
      return ageUp(p, makeRng(3)).player.bankBalance;
    };
    expect(run(100)).toBeGreaterThan(run(0));
  });

  it("the hot-tempered fall out with people; the placid rarely do", async () => {
    const { processTemper } = await import("../talentEffects");
    let hot = 0;
    let calm = 0;
    for (let s = 1; s <= 600; s++) {
      const a = make(30, { talents: { temper: 100 } });
      a.age = 30;
      a.relatives.push({ id: "F", relation: "Friend", name: "Fay Friend", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 2, gender: "Female", smarts: 50, looks: 50 });
      const before = a.relatives.find((r) => r.id === "F")!.relationshipBar;
      processTemper(a, makeRng(s), []);
      if (a.relatives.find((r) => r.id === "F")!.relationshipBar < before) hot++;
      const b = make(30, { talents: { temper: 10 } });
      b.age = 30;
      b.relatives.push({ id: "F", relation: "Friend", name: "Fay Friend", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 2, gender: "Female", smarts: 50, looks: 50 });
      processTemper(b, makeRng(s), []);
      if (b.relatives.find((r) => r.id === "F")!.relationshipBar < 70) calm++;
    }
    expect(hot).toBeGreaterThan(10);
    expect(calm).toBe(0);
  });
});
