import { autoChoices } from "../autopilot";
import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { initialState, reducer } from "../reducer";
import { suggestTips } from "@/lib/tips";

const newGame = (seed = 5) => reducer(initialState, { type: "NEW_GAME", opts: { scenario: "average", startYear: 2026 }, seed });

describe("year summary & milestones", () => {
  it("records what changed during Age Up", () => {
    const rng = makeRng(3);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 30;
    p.bankBalance = 1000;
    const next = ageUp(p, rng).player;
    expect(next.lastYear?.age).toBe(31);
    expect(next.lastYear?.money).toBe(Math.round(next.bankBalance - 1000));
  });

  it("announces key ages", () => {
    const rng = makeRng(4);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 17;
    const res = ageUp(p, rng);
    expect(res.notices?.some((n) => "title" in n && n.title === "Adulthood")).toBe(true);
  });
});

describe("intro", () => {
  it("only shows the welcome notice when asked", () => {
    const withIntro = reducer(initialState, { type: "NEW_GAME", opts: { scenario: "average", startYear: 2026 }, seed: 1, intro: true });
    expect(withIntro.notices).toHaveLength(1);
    expect(newGame().notices).toHaveLength(0);
  });
});

describe("fast forward", () => {
  it("skips ten full years on autopilot, leaving no decisions pending", () => {
    let full = 0;
    for (let seed = 1; seed <= 10; seed++) {
      let s = newGame(seed);
      s = { ...s, player: { ...s.player!, age: 21 } };
      const next = reducer(s, { type: "FAST_FORWARD", years: 10 });
      const p = next.player!;
      expect(next.notices.some((n) => n.kind === "event")).toBe(false);
      expect(next.notices).toHaveLength(1);
      const stopped = !p.alive || p.pendingTrial !== null || p.isInPrison !== s.player!.isInPrison;
      if (!stopped) {
        expect(p.age).toBe(31);
        full++;
      }
    }
    expect(full).toBeGreaterThanOrEqual(8);
  });

  it("autopilot avoids reckless options", () => {
    const rng = makeRng(3);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    const event = {
      id: "t", title: "Temptation", description: "", minAge: 0, maxAge: 99, category: "general" as const,
      options: [
        { text: "Rob", effects: { logText: "", bankBalanceDelta: 500, arrest: "robbery" as never } },
        { text: "Walk away", effects: { logText: "", happinessDelta: 1 } },
        { text: "Too dear", effects: { logText: "", happinessDelta: 50, bankBalanceDelta: -1e9 } },
      ],
    };
    expect(autoChoices(p, event)).toEqual([1, 0]);
  });

  it("does nothing while notices are pending", () => {
    let s = newGame();
    s = reducer(s, { type: "AGE_UP" });
    const withNotice = s.notices.length ? s : { ...s, notices: [{ id: "x", kind: "info" as const, title: "t", body: "b", tone: "neutral" as const }] };
    expect(reducer(withNotice, { type: "FAST_FORWARD" })).toBe(withNotice);
  });

  it("never throws across many seeds", () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s = newGame(seed);
      for (let i = 0; i < 12 && s.player!.alive; i++) {
        s = { ...s, notices: [] };
        s = reducer(s, { type: "FAST_FORWARD" });
      }
      expect(s.player!.age).toBeGreaterThan(0);
    }
  });
});

describe("event variety", () => {
  it("tracks recent event categories", () => {
    const rng = makeRng(11);
    let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    for (let i = 0; i < 15; i++) p = ageUp(p, rng).player;
    expect(p.recentCats.length).toBeLessThanOrEqual(6);
    expect(p.recentCats.length).toBeGreaterThan(0);
  });
});

describe("tips", () => {
  it("nudges the unemployed adult toward the Career tab and stays quiet in prison", () => {
    const rng = makeRng(2);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 30;
    p.currentJob = null;
    p.education.yearsLeft = 0;
    p.health = 80;
    p.happiness = 70;
    expect(suggestTips(p).some((t) => t.tab === "career")).toBe(true);
    p.isInPrison = true;
    expect(suggestTips(p)).toEqual([]);
  });
});
