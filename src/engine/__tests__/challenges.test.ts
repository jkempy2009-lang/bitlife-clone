import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { checkChallenge } from "../challenges";
import { continueAsChild } from "../legacy";
import { initialState, reducer } from "../reducer";
import { CHALLENGES } from "@/data/challenges";
import type { PlayerState } from "@/types/game.types";

const mk = (challenge: string, seed = 1): PlayerState => {
  const rng = makeRng(seed);
  return createNewPlayer({ scenario: "average", startYear: 2026, challenge }, rng);
};

describe("scenario challenges", () => {
  it("every challenge has a unique id, a sane deadline and working progress text", () => {
    const ids = new Set(CHALLENGES.map((c) => c.id));
    expect(ids.size).toBe(CHALLENGES.length);
    const p = mk("rags");
    for (const c of CHALLENGES) {
      expect(c.byAge).toBeGreaterThan(20);
      expect(typeof c.progress(p)).toBe("string");
      expect(c.achieved(p)).toBe(false);
    }
  });

  it("is won when the goal is met, and only once", () => {
    const p = mk("rags");
    p.bankBalance = 2_000_000;
    const notices: Parameters<typeof checkChallenge>[1] = [];
    checkChallenge(p, notices);
    expect(p.challenge?.status).toBe("won");
    expect(p.flags).toContain("challenge_won");
    expect(notices).toHaveLength(1);
    checkChallenge(p, notices);
    expect(notices).toHaveLength(1);
  });

  it("fails when the deadline passes or the player dies", () => {
    const late = mk("rags");
    late.age = 51;
    const n1: Parameters<typeof checkChallenge>[1] = [];
    checkChallenge(late, n1);
    expect(late.challenge?.status).toBe("failed");

    const dead = mk("saint");
    dead.alive = false;
    const n2: Parameters<typeof checkChallenge>[1] = [];
    checkChallenge(dead, n2);
    expect(dead.challenge?.status).toBe("failed");
  });

  it("Dynasty survives death while a child lives, and is carried to the heir", () => {
    const p = mk("dynasty", 4);
    p.age = 60;
    p.alive = false;
    p.relatives.push({ id: "kid", relation: "Child", name: "Kid Heir", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Male", smarts: 60, looks: 60 });
    const n: Parameters<typeof checkChallenge>[1] = [];
    checkChallenge(p, n);
    expect(p.challenge?.status).toBe("active");
    const heir = continueAsChild(p, "kid", makeRng(9))!;
    expect(heir.challenge).toEqual({ id: "dynasty", status: "active" });
    expect(heir.generation).toBe(2);
  });

  it("new games record the challenge and announce it", () => {
    const s = reducer(initialState, { type: "NEW_GAME", opts: { scenario: "struggling", startYear: 2026, challenge: "rags" }, seed: 3 });
    expect(s.player!.challenge).toEqual({ id: "rags", status: "active" });
    expect(s.notices.some((x) => x.kind === "info" && x.title.includes("Rags"))).toBe(true);
  });
});
