import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { ageUp, finalize } from "../ageUp";
import { createNewPlayer, netWorth } from "../state";
import { resolveEvent } from "../events";
import { incomeTaxFor } from "@/data/countries";
import { LIFE_EVENTS } from "@/data/lifeEventsEngine";
import { commitCrime, resolveTrial } from "../crime";
import { continueAsChild, epitaph } from "../legacy";
import { deathChance } from "../mortality";
import { botchChance, buyLotteryTicket, plasticSurgery, visitDoctor } from "../activities";
import { buyHouse, houseInventory } from "../assets";
import { enrollProgram } from "../career";
import type { PlayerState, Notice } from "@/types/game.types";

function newPlayer(seed = 1, scenario: "random" | "royal" | "wealthy" = "average" as never) {
  const rng = makeRng(seed);
  return { rng, p: createNewPlayer({ scenario: scenario as never, startYear: 2026 }, rng) };
}

/** Auto-plays a life: random option on every event. */
function simulateLife(seed: number): PlayerState {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "random", startYear: 2026 }, rng);
  for (let guard = 0; guard < 200 && p.alive; guard++) {
    if (p.pendingTrial) {
      const r = resolveTrial(p, "public", rng);
      p = r.player;
    }
    const res = ageUp(p, rng);
    p = res.player;
    const queue = [...(res.notices ?? [])] as Notice[];
    for (const n of queue) {
      if (n.kind === "event" && p.alive) {
        const idx = rng.int(0, n.event.options.length - 1);
        const out = resolveEvent(p, n.event, idx, rng);
        const extra: NonNullable<typeof res.notices> = [];
        finalize(out.player, extra);
        p = out.player;
      }
    }
    if (p.pendingTrial) p = resolveTrial(p, "public", rng).player;
  }
  return p;
}

describe("tax", () => {
  it("applies marginal brackets", () => {
    expect(incomeTaxFor("United States", 10_000)).toBe(0);
    expect(incomeTaxFor("United States", 50_000)).toBe(6_000);
    expect(incomeTaxFor("United States", 100_000)).toBe(20_000);
    expect(incomeTaxFor("United States", 200_000)).toBe(55_000);
  });
});

describe("event data integrity", () => {
  it("has unique ids and 2+ options", () => {
    const ids = new Set<string>();
    for (const e of LIFE_EVENTS) {
      expect(ids.has(e.id), `duplicate ${e.id}`).toBe(false);
      ids.add(e.id);
      expect(e.options.length).toBeGreaterThanOrEqual(2);
      expect(e.minAge).toBeLessThanOrEqual(e.maxAge);
    }
    expect(LIFE_EVENTS.length).toBeGreaterThan(120);
  });
});

describe("age up", () => {
  it("increments age/year and appends a header", () => {
    const { rng, p } = newPlayer(3);
    const r = ageUp(p, rng);
    expect(r.player.age).toBe(1);
    expect(r.player.year).toBe(2027);
    expect(r.player.lifeLog.some((l) => l.startsWith("## Age 1"))).toBe(true);
  });

  it("keeps stats within 0..100 over full lives and always terminates", () => {
    for (let s = 1; s <= 60; s++) {
      const p = simulateLife(s);
      expect(p.alive).toBe(false);
      for (const k of ["happiness", "health", "smarts", "looks", "karma", "fame"] as const) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(100);
      }
      expect(p.age).toBeLessThanOrEqual(120);
      expect(Number.isFinite(netWorth(p))).toBe(true);
    }
  });

  it("produces a believable lifespan distribution", () => {
    const ages = Array.from({ length: 80 }, (_, i) => simulateLife(100 + i).age);
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    expect(mean).toBeGreaterThan(60);
    expect(mean).toBeLessThan(100);
  });
});

describe("mortality", () => {
  it("rises with age and falls with health", () => {
    expect(deathChance(90, 50)).toBeGreaterThan(deathChance(30, 50));
    expect(deathChance(70, 20)).toBeGreaterThan(deathChance(70, 90));
  });
});

describe("activities", () => {
  it("lottery is capped per year", () => {
    const { rng, p } = newPlayer(5);
    p.age = 30;
    p.bankBalance = 1_000;
    let cur = p;
    for (let i = 0; i < 10; i++) cur = buyLotteryTicket(cur, rng).player;
    expect(cur.annual.lottery).toBe(5);
    // 5 tickets at $10 each; consolation prizes ($50) can only push the balance up.
    expect(cur.bankBalance).toBeGreaterThanOrEqual(1_000 - 50);
  });

  it("surgery is botched less often when pricier and never leaves looks out of range", () => {
    expect(botchChance(8_000)).toBeLessThan(botchChance(1_500));
    const { rng, p } = newPlayer(8);
    p.age = 30;
    p.bankBalance = 50_000;
    p.looks = 50;
    const out = plasticSurgery(p, "facelift", rng).player;
    expect(out.looks === 65 || out.looks === 20).toBe(true);
  });

  it("doctor visits are limited once a year per disease", () => {
    const { rng, p } = newPlayer(9);
    p.bankBalance = 1_000;
    p.diseases = [{ id: "cancer", name: "Cancer", severity: "fatal", happinessImpact: 8, healthImpact: 10, yearsLeft: 3 }];
    const first = visitDoctor(p, "cancer", rng).player;
    const second = visitDoctor(first, "cancer", rng);
    expect(second.player.bankBalance).toBe(first.bankBalance);
  });
});

describe("justice", () => {
  it("failed crime opens a trial; guilty verdict sends player to prison", () => {
    const { rng, p } = newPlayer(11);
    p.age = 30;
    p.currentJob = { id: "j", title: "x", company: "y", salary: 50_000, performance: 50, tier: 0, lineId: "retail" };
    p.smarts = 0; // guarantees bank robbery failure
    const arrested = commitCrime(p, "bank_robbery", rng).player;
    expect(arrested.pendingTrial).not.toBeNull();
    const sentenced = resolveTrial(arrested, "self", makeRng(1)).player;
    if (sentenced.isInPrison) {
      expect(sentenced.prison?.sentenceYears).toBeGreaterThan(0);
      expect(sentenced.currentJob).toBeNull();
    }
    expect(sentenced.pendingTrial).toBeNull();
  });
});

describe("assets", () => {
  it("mortgage purchase creates amortising debt", () => {
    const { rng, p } = newPlayer(12);
    p.age = 30;
    p.bankBalance = 200_000;
    p.creditScore = 750;
    p.currentJob = { id: "j", title: "x", company: "y", salary: 150_000, performance: 50, tier: 0, lineId: "retail" };
    const listing = houseInventory(p.year, p.id).find((l) => l.arch.id === "starter")!;
    const out = buyHouse(p, listing, true, rng).player;
    expect(out.properties).toHaveLength(1);
    expect(out.properties[0].mortgageBalance).toBeGreaterThan(0);
    const aged = ageUp({ ...out, age: 30 }, makeRng(3)).player;
    expect(aged.properties[0].mortgageBalance).toBeLessThan(out.properties[0].mortgageBalance);
    expect(aged.properties[0].remainingTerm).toBe(29);
  });
});

describe("education", () => {
  it("requires a diploma for university", () => {
    const { rng, p } = newPlayer(13);
    p.age = 18;
    const res = enrollProgram(p, "University", "business", rng);
    expect(res.player.education.stage).toBe("None");
  });
});

describe("legacy", () => {
  it("transfers cash minus 10% estate tax and assets to the chosen child", () => {
    const { rng, p } = newPlayer(14);
    p.age = 70;
    p.bankBalance = 1_000_000;
    p.properties = [{ id: "h", name: "House", originalValue: 1, currentValue: 500_000, condition: 80, monthlyMortgage: 0, remainingTerm: 0, mortgageBalance: 0, archetypeId: "starter" }];
    p.relatives.push({ id: "kid", relation: "Child", name: "Sam Tester", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Male", smarts: 66, looks: 44 });
    p.alive = false;
    p.deathYear = p.year;
    const next = continueAsChild(p, "kid", rng)!;
    expect(next.bankBalance).toBe(900_000);
    expect(next.properties).toHaveLength(1);
    expect(next.age).toBe(30);
    expect(next.firstName).toBe("Sam");
    expect(next.lifeLog.join("\n")).toContain("You have taken control of your life at age 30, inheriting $900,000 from your late parent.");
    expect(epitaph(p)).toBeTruthy();
  });

  it("returns null without heirs", () => {
    const { rng, p } = newPlayer(15);
    expect(continueAsChild(p, "none", rng)).toBeNull();
  });
});
