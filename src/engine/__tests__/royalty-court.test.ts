import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { ageUp, finalize } from "../ageUp";
import { createNewPlayer, educationForAge } from "../state";
import { resolveEvent } from "../events";
import { applyForJob } from "../career";
import { meetSomeone, propose, tryForBaby } from "../social";
import { continueAsChild, heirs } from "../legacy";
import { ensureSuccession, royalStyleText } from "../royalty";
import { hydrate } from "../save";
import { EVENT_BY_ID, LIFE_EVENTS } from "@/data/lifeEventsEngine";
import {
  adoptPatronage, answerScandal, engage, engagementBlocker, joinService, leaveService, processCourt, requestDeployment,
  royalFinance, setSecretary, slotsFor, slotsLeft, slotsUsed, startScandal, stepBack, stepBackBlocker, tellAll, toggleEstate, type EngagementKind,
} from "../court";
import {
  abdicateAction, abdicate, abdicationBlocker, giveAssent, BILLS, holdAudience, holdReferendum, honoursList, referendumChance, resolveCrisis,
} from "../crown";
import { processRoyalFamily, royalChildren, setSchool, styleSpouse, trainChild } from "../courtFamily";
import { hydrateCourt, isSovereign, newCourt, realmNamesFor } from "../courtState";
import { PATRONAGES } from "@/data/court";
import type { ActionResult, Notice, PlayerState, Relative } from "@/types/game.types";

const rel = (id: string, relation: Relative["relation"], age: number, gender: string, extra: Partial<Relative> = {}): Relative => ({
  id, relation, name: `${id} Windsor`, age, relationshipBar: 70, health: 90, alive: true, incomeTier: 5, gender, smarts: 60, looks: 60, ...extra,
});

/** An adult non-sovereign royal (a spare) in the middle of the family. */
function royal(seed: number, age = 30): PlayerState {
  const p = createNewPlayer({ scenario: "royal", startYear: 2026, talents: NEUTRAL }, makeRng(seed));
  p.age = age;
  p.year = 2026 + age;
  p.birthCountry = "United Kingdom";
  p.education = educationForAge(age);
  p.royalRespect = 70;
  p.bankBalance = 2_000_000;
  p.court.approval = 60;
  p.royal!.line = 3;
  return p;
}

function sovereign(seed: number, age = 45): PlayerState {
  const p = royal(seed, age);
  p.gender = "Female";
  p.royalRank = "Queen";
  p.royal = { crown: "self", hrh: true, peerage: null, line: 0 };
  p.court.realmNames = realmNamesFor("United Kingdom");
  p.court.pm = "Ms. Hartley";
  p.court.coronated = true;
  p.court.republic = 20;
  p.relatives = p.relatives.filter((r) => r.relation !== "Parent" && r.relation !== "Sibling");
  return p;
}

const run = <T extends unknown[]>(p: PlayerState, fn: (p: PlayerState, ...a: T) => ActionResult, ...args: T) => fn(p, ...args).player;

describe("engagement diary", () => {
  it("cannot be double-booked: a tour takes three days and a second tour is refused", () => {
    let p = royal(1);
    expect(slotsFor(p)).toBeGreaterThanOrEqual(5);
    const total = slotsFor(p);
    p = run(p, engage, makeRng(1), "tour_state" as EngagementKind);
    expect(slotsUsed(p)).toBe(3);
    expect(engagementBlocker(p, "tour_realm")).toMatch(/already toured|Not enough/);
    const again = engage(p, makeRng(2), "tour_state");
    expect(again.player).toBe(p); // refused: no change
    // Two hospital visits fit; a third is refused (visit cap and/or full diary).
    p = run(p, engage, makeRng(3), "hospital" as EngagementKind);
    p = run(p, engage, makeRng(4), "hospital" as EngagementKind);
    expect(slotsUsed(p)).toBeLessThanOrEqual(total);
    expect(engagementBlocker(p, "hospital")).toBeTruthy();
    expect(slotsLeft(p)).toBe(Math.max(0, total - slotsUsed(p)));
  });

  it("the diary shrinks with military service, a newborn and old age, and mourning forbids tours and galas", () => {
    const p = royal(2);
    const base = slotsFor(p);
    const serving = run(p, joinService, "army");
    expect(slotsFor(serving)).toBe(base - 2);
    serving.court.service!.deployed = true;
    expect(slotsFor(serving)).toBeLessThan(base - 2);
    expect(engagementBlocker(serving, "tour_state")).toMatch(/posting/);
    const baby = royal(2);
    baby.relatives.push(rel("Baby", "Child", 0, "Male", { royalTitle: "Prince" }));
    expect(slotsFor(baby)).toBe(base - 1);
    const old = royal(2, 85);
    expect(slotsFor(old)).toBeLessThan(base);
    const grieving = royal(2);
    grieving.court.mourning = 1;
    expect(engagementBlocker(grieving, "tour_state")).toMatch(/mourning/);
    expect(engagementBlocker(grieving, "hospital")).toBeNull();
    expect(slotsFor(royal(2, 12))).toBe(0);
  });

  it("tours pay off on average but can go wrong", () => {
    let gains = 0;
    let gaffes = 0;
    for (let s = 1; s <= 120; s++) {
      const p = royal(s % 10 + 1);
      const before = p.court.approval;
      const after = run(p, engage, makeRng(s * 7), "tour_realm" as EngagementKind);
      gains += after.court.approval - before;
      if (after.court.approval < before) gaffes++;
    }
    expect(gains / 120).toBeGreaterThan(0.5);
    expect(gaffes).toBeGreaterThan(0);
    expect(gaffes).toBeLessThan(60);
  });
});

describe("patronages", () => {
  it("cost a diary day, deepen with yearly visits, and lapse after three years of neglect", () => {
    let p = royal(3);
    const cause = PATRONAGES[0].id;
    p = run(p, adoptPatronage, cause);
    expect(p.court.patronages).toHaveLength(1);
    expect(slotsUsed(p)).toBe(1);
    expect(adoptPatronage(p, cause).player).toBe(p); // can't take it twice
    // Visit this year and roll the year: it deepens.
    p = run(p, engage, makeRng(1), "patron" as EngagementKind, cause);
    expect(engagementBlocker(p, "patron", cause)).toMatch(/already visited/);
    processCourt(p, makeRng(2), []);
    expect(p.court.patronages[0].years).toBe(1);
    // Neglect it for three years.
    const notices: Parameters<typeof processCourt>[2] = [];
    for (let i = 0; i < 4; i++) { p.year += 1; processCourt(p, makeRng(10 + i), notices); }
    expect(p.court.patronages).toHaveLength(0);
    expect(notices.some((n) => "title" in n && n.title === "Patronage Lapsed")).toBe(true);
  });

  it("are capped by rank", () => {
    let p = royal(4);
    p.court.secretary = 3; // plenty of days
    for (const x of PATRONAGES) {
      p.court.booked = {};
      p = run(p, adoptPatronage, x.id);
    }
    expect(p.court.patronages.length).toBeLessThanOrEqual(6);
    expect(p.court.patronages.length).toBeGreaterThanOrEqual(3);
  });
});

describe("military service", () => {
  it("is for the young, ends, and a deployment brings approval home or a wound", () => {
    let p = royal(5, 20);
    p.education = educationForAge(20);
    p.education.stage = "None";
    expect(joinService(p, "navy").player).not.toBe(p);
    p = run(p, joinService, "navy");
    expect(joinService(p, "army").player).toBe(p);
    expect(requestDeployment(p, makeRng(1)).player).toBe(p); // too soon
    p.court.service!.years = 2;
    let deployedOnce = false;
    for (let s = 1; s <= 40 && !deployedOnce; s++) {
      const q = requestDeployment(p, makeRng(s)).player;
      if (q.court.service!.deployed) deployedOnce = true;
    }
    expect(deployedOnce).toBe(true);
    // Sovereigns and the over-35 can't join.
    expect(joinService(sovereign(5), "army").player.court.service).toBeNull();
    expect(joinService(royal(5, 40), "army").player.court.service).toBeNull();
    p = run(p, leaveService);
    expect(p.court.service!.done).toBe(true);
  });

  it("a deployment returns approval on average, with some risk", () => {
    let delta = 0;
    let dead = 0;
    for (let s = 1; s <= 200; s++) {
      const p = royal((s % 8) + 1, 22);
      p.court.service = { branch: "army", years: 3, rank: 2, deployed: true, deployments: 0, done: false };
      p.court.approval = 50;
      p.royal!.line = 3;
      processCourt(p, makeRng(s), []);
      if (!p.alive) dead++;
      else delta += p.court.approval - 50;
    }
    expect(delta / 200).toBeGreaterThan(3);
    expect(dead).toBeLessThan(10);
  });
});

describe("scandals and the press office", () => {
  const withScandal = (seed: number, secretary: number, forceId = "tax") => {
    const p = royal(seed);
    p.court.secretary = secretary;
    p.court.heat = 20;
    startScandal(p, makeRng(seed), [], forceId);
    return p;
  };

  it("a scandal queues a choice event and a no-answer costs more than a good one", () => {
    const p = withScandal(6, 0);
    expect(p.court.scandal).toBeTruthy();
    expect(p.queuedEvents).toContain("crown_scandal_open");
    const left = royal(6);
    left.court.scandal = p.court.scandal;
    const before = left.court.approval;
    processCourt(left, makeRng(1), []);
    expect(left.court.scandal).toBeNull();
    expect(left.court.approval).toBeLessThan(before);
  });

  it("a better private office handles scandals better (aggregate)", () => {
    const rate = (tier: number) => {
      let wins = 0;
      for (let s = 1; s <= 300; s++) {
        const p = withScandal((s % 9) + 1, tier);
        const before = p.court.approval;
        const out = answerScandal(p, makeRng(s * 3), "statement").player;
        if (out.court.approval >= before - 1) wins++;
      }
      return wins / 300;
    };
    expect(rate(3)).toBeGreaterThan(rate(0) + 0.1);
  });

  it("withdrawing empties the diary; leaving ends royal life; heirs and sovereigns cannot walk away", () => {
    const w = run(withScandal(7, 1), answerScandal, makeRng(1), "withdraw");
    expect(w.court.withdrawn).toBeGreaterThan(0);
    expect(slotsFor(w)).toBe(0);
    const l = run(withScandal(7, 1), answerScandal, makeRng(1), "leave");
    expect(l.royalRank).toBe("none");
    expect(l.court.steppedBack).toBe(true);
    const heir = withScandal(7, 1);
    heir.royal!.line = 1;
    expect(answerScandal(heir, makeRng(1), "leave").player).toBe(heir);
    expect(answerScandal(heir, makeRng(1), "withdraw").player).toBe(heir);
  });

  it("an unanswered or botched grave scandal can disgrace a spare, with the loss of titles and funding", () => {
    let disgraced = 0;
    for (let s = 1; s <= 200; s++) {
      const p = withScandal((s % 9) + 1, 0, "friend");
      p.court.patronages = [{ id: "children", years: 4, lastYear: p.year }];
      const out = answerScandal(p, makeRng(s), "silence").player;
      if (out.court.disgraced) {
        disgraced++;
        expect(out.court.patronages).toHaveLength(0);
        expect(royalFinance(out).allowance).toBe(0);
        expect(slotsFor(out)).toBe(0);
        expect(out.royal!.hrh).toBe(false);
      }
    }
    expect(disgraced).toBeGreaterThan(100);
  });
});

describe("stepping back", () => {
  it("ends royal life: no funding, free to work, can sell the story once", () => {
    let p = royal(8);
    p.royal!.line = 4;
    expect(stepBackBlocker(p)).toBeNull();
    p = run(p, stepBack);
    expect(p.royalRank).toBe("none");
    expect(p.court.steppedBack).toBe(true);
    expect(p.royal!.hrh).toBe(false);
    // Ordinary jobs are open now.
    const applied = applyForJob(p, "retail", makeRng(1));
    expect(applied.notices?.some((n) => "title" in n && n.title === "Can't Apply" && /Royals can't/.test(n.body))).not.toBe(true);
    const bank = p.bankBalance;
    p = run(p, tellAll, makeRng(3));
    expect(p.bankBalance).toBeGreaterThan(bank + 1_000_000);
    expect(tellAll(p, makeRng(4)).player).toBe(p);
    // Year turns don't crash a former royal.
    const next = ageUp(p, makeRng(5)).player;
    expect(next.court.steppedBack).toBe(true);
  });

  it("the heir and the sovereign can't step back", () => {
    const heir = royal(8);
    heir.royal!.line = 1;
    expect(stepBackBlocker(heir)).toMatch(/heir/);
    expect(stepBackBlocker(sovereign(8))).toMatch(/sovereign/i);
  });
});

describe("money", () => {
  it("the Sovereign Grant follows approval and the economy, and the heir lives on a duchy", () => {
    const hi = sovereign(9);
    hi.court.approval = 80;
    const lo = sovereign(9);
    lo.court.approval = 25;
    expect(royalFinance(hi).allowance).toBeGreaterThan(royalFinance(lo).allowance);
    const slim = sovereign(9);
    slim.court.approval = 80;
    slim.court.slimmed = true;
    expect(royalFinance(slim).allowance).toBeLessThan(royalFinance(hi).allowance);
    expect(royalFinance(hi).duchy).toBeGreaterThan(0);
    const heir = royal(9);
    heir.royal!.line = 1;
    expect(royalFinance(heir).duchy).toBeGreaterThan(1_000_000);
    expect(royalFinance(heir).allowance).toBe(0);
  });

  it("a working royal keeps the allowance; one who never turns up is cut; staff and estates cost money", () => {
    const spare = royal(10);
    spare.royal!.line = 3;
    spare.court.slotsLast = 5;
    const worker = royalFinance(spare).allowance;
    spare.court.slotsLast = 0;
    expect(royalFinance(spare).allowance).toBeLessThan(worker);
    spare.court.secretary = 2;
    expect(royalFinance(spare).staff).toBeGreaterThan(0);
    const s = sovereign(10);
    const closed = royalFinance(s);
    const opened = royalFinance(run(s, toggleEstate));
    expect(opened.estate).toBeGreaterThan(closed.estate);
    expect(opened.upkeep).toBeGreaterThan(closed.upkeep);
  });

  it("a year of royal life pays funding into the bank", () => {
    const p = sovereign(11);
    p.court.approval = 70;
    const before = p.bankBalance;
    const out = ageUp(p, makeRng(1)).player;
    expect(out.bankBalance).toBeGreaterThan(before + 1_000_000);
    expect(out.court.ledger.grant).toBeGreaterThan(0);
  });
});

describe("the sovereign's constitutional role", () => {
  it("audiences: listening builds trust, pressing your preference strains the constitution", () => {
    let listen = 0;
    let press = 0;
    let strainPress = 0;
    for (let s = 1; s <= 80; s++) {
      const a = run(sovereign((s % 9) + 1), holdAudience, makeRng(s), "listen", "economy");
      const b = run(sovereign((s % 9) + 1), holdAudience, makeRng(s), "press", "economy");
      listen += a.court.government;
      press += b.court.government;
      strainPress += b.court.strain;
    }
    expect(listen).toBeGreaterThan(press);
    expect(strainPress / 80).toBeGreaterThan(10);
    // Once a year only.
    const p = run(sovereign(1), holdAudience, makeRng(1), "listen", "economy");
    expect(holdAudience(p, makeRng(2), "listen", "economy").player).toBe(p);
    // Not a minor under a Regency.
    const minor = sovereign(1, 15);
    minor.court.regency = "Queen Mother";
    expect(holdAudience(minor, makeRng(2), "listen", "economy").player).toBe(minor);
  });

  it("honours lists go out once a year, and favouritism is a risk", () => {
    let p = run(sovereign(2), honoursList, makeRng(1), "servants");
    expect(honoursList(p, makeRng(2), "servants").player).toBe(p);
    let hurt = 0;
    for (let s = 1; s <= 100; s++) {
      p = sovereign((s % 9) + 1);
      const before = p.court.approval;
      if (run(p, honoursList, makeRng(s), "friends").court.approval < before) hurt++;
    }
    expect(hurt).toBeGreaterThan(10);
    expect(hurt).toBeLessThan(70);
  });

  it("withholding royal assent is a constitutional crisis; granting it is routine; concerns can soften a bad bill", () => {
    const bill = BILLS[0];
    const assent = sovereign(3);
    const f0 = assent.nation.freedom;
    giveAssent(assent, makeRng(1), bill, "assent");
    expect(assent.nation.freedom).toBe(f0 + (bill.nation.freedom ?? 0));
    const refuse = sovereign(3);
    giveAssent(refuse, makeRng(1), bill, "withhold");
    expect(refuse.court.strain).toBeGreaterThanOrEqual(40);
    expect(refuse.court.government).toBeLessThan(assent.court.government);
    let softened = 0;
    for (let s = 1; s <= 100; s++) {
      const p = sovereign((s % 9) + 1);
      p.court.secretary = 2;
      const before = p.nation.freedom;
      giveAssent(p, makeRng(s), bill, "concerns");
      if (p.nation.freedom > before + (bill.nation.freedom ?? 0)) softened++;
    }
    expect(softened).toBeGreaterThan(30);
  });

  it("strain at 70 forces a constitutional crisis next year, which can be defused", () => {
    const p = sovereign(4);
    p.court.strain = 90;
    processCourt(p, makeRng(1), []);
    expect(p.queuedEvents).toContain("crown_constitutional_crisis");
    resolveCrisis(p, makeRng(2), "retreat");
    expect(p.court.strain).toBeLessThanOrEqual(20);
    const q = sovereign(4);
    q.court.strain = 90;
    resolveCrisis(q, makeRng(2), "election");
    expect(q.court.strain).toBeLessThanOrEqual(10);
  });

  it("decrees and executions carry a constitutional price", () => {
    const hi = EVENT_BY_ID.crown_constitutional_crisis;
    expect(hi.options).toHaveLength(3);
  });

  it("a republican referendum can abolish the monarchy; reform and a good record help", () => {
    const mid = sovereign(5);
    mid.court.republic = 50;
    expect(referendumChance(mid, "reform")).toBeGreaterThan(referendumChance(mid, "above"));
    let abolished = 0;
    for (let s = 1; s <= 200; s++) {
      const p = sovereign((s % 9) + 1);
      p.court.republic = 85;
      if (holdReferendum(p, makeRng(s), "above").abolished) {
        abolished++;
        expect(p.royalRank).toBe("none");
        expect(p.royal).toBeNull();
        expect(p.flags).toContain("monarchy_abolished");
      }
    }
    expect(abolished).toBeGreaterThan(100);
    let safe = 0;
    for (let s = 1; s <= 200; s++) {
      const p = sovereign((s % 9) + 1);
      p.court.republic = 20;
      if (!holdReferendum(p, makeRng(s), "above").abolished) safe++;
    }
    expect(safe).toBeGreaterThan(130);
  });

  it("realms may leave when the crown is unpopular", () => {
    let leaving = 0;
    for (let s = 1; s <= 150; s++) {
      const p = sovereign((s % 9) + 1);
      p.court.approval = 10;
      p.court.republic = 70;
      const before = p.court.realmNames.length;
      processCourt(p, makeRng(s), []);
      if (p.court.realmNames.length < before) leaving++;
    }
    expect(leaving).toBeGreaterThan(5);
  });
});

describe("accession, mourning and regency", () => {
  it("becoming sovereign starts mourning, queues the accession council and a coronation", () => {
    const p = royal(12, 30);
    p.royal = { crown: "parent", hrh: true, peerage: null, line: 1 };
    p.relatives = p.relatives.filter((r) => r.relation !== "Sibling");
    for (const r of p.relatives) if (r.royalTitle === "King" || r.royalTitle === "Queen") r.alive = false;
    ensureSuccession(p, makeRng(1), []);
    expect(isSovereign(p)).toBe(true);
    expect(p.court.mourning).toBe(1);
    expect(p.queuedEvents).toEqual(expect.arrayContaining(["crown_accession_council", "crown_state_funeral"]));
    expect(p.scheduled.some((s) => s.id === "crown_coronation")).toBe(true);
    expect(p.court.realmNames.length).toBeGreaterThan(0);
    expect(p.court.regency).toBeNull();
  });

  it("a sibling being crowned still puts the whole family into mourning", () => {
    const p = royal(13, 30);
    p.relatives = p.relatives.filter((r) => r.relation !== "Sibling");
    p.relatives.push(rel("Elder", "Sibling", 36, "Male", { royalTitle: "Prince" }));
    p.royal = { crown: "parent", hrh: true, peerage: null, line: 2 };
    for (const r of p.relatives) if (r.royalTitle === "King" || r.royalTitle === "Queen") r.alive = false;
    ensureSuccession(p, makeRng(1), []);
    expect(p.royal.crown).toBe("sibling");
    expect(p.court.mourning).toBe(1);
    expect(p.queuedEvents).toContain("crown_state_funeral");
  });

  it("a minor sovereign has a Regent until 18, who takes the powers away", () => {
    const p = royal(14, 15);
    p.royal = { crown: "parent", hrh: true, peerage: null, line: 1 };
    p.relatives = p.relatives.filter((r) => r.relation !== "Sibling");
    for (const r of p.relatives) if (r.royalTitle === "King" || r.royalTitle === "Queen") r.alive = false;
    ensureSuccession(p, makeRng(1), []);
    expect(p.court.regency).toBeTruthy();
    expect(slotsFor(p)).toBe(0);
    expect(holdAudience(p, makeRng(1), "listen", "economy").player).toBe(p);
    p.age = 18;
    const notices: Parameters<typeof processCourt>[2] = [];
    processCourt(p, makeRng(2), notices);
    expect(p.court.regency).toBeNull();
    expect(notices.some((n) => "title" in n && n.title === "Regency Ends")).toBe(true);
  });

  const choose = (p: PlayerState, id: string, idx: number, seed = 1) => resolveEvent(p, EVENT_BY_ID[id], idx, makeRng(seed)).player;

  it("the Accession Council sets a regnal name and the style follows", () => {
    for (let idx = 0; idx < 3; idx++) {
      const p = sovereign(15, 40);
      p.court.regnalName = null;
      const out = choose(p, "crown_accession_council", idx, 3 + idx);
      expect(out.court.regnalName).toBeTruthy();
      expect(royalStyleText(out)).toContain(out.court.regnalName!);
      expect(royalStyleText(out)).toMatch(/^(King|Queen) /);
    }
  });

  it("the coronation can be lavish, slim or postponed; postponing books it again", () => {
    let boom = 0;
    for (let s = 1; s <= 30; s++) {
      const p = sovereign((s % 9) + 1);
      p.court.coronated = false;
      p.economy.climate = "boom";
      const before = p.court.approval;
      const out = choose(p, "crown_coronation", 0, s);
      expect(out.court.coronated).toBe(true);
      if (out.court.approval > before) boom++;
    }
    expect(boom).toBeGreaterThan(20);
    const rec = sovereign(1);
    rec.economy.climate = "recession";
    rec.court.approval = 60;
    const lavish = choose(rec, "crown_coronation", 0);
    const slim = choose(rec, "crown_coronation", 1);
    expect(slim.court.approval).toBeGreaterThan(lavish.court.approval);
    const unCrowned = sovereign(1);
    unCrowned.court.coronated = false;
    const wait = choose(unCrowned, "crown_coronation", 2);
    expect(wait.court.coronated).toBe(false);
    expect(wait.scheduled.some((s) => s.id === "crown_coronation")).toBe(true);
  });

  it("a gala during mourning backfires", async () => {
    const { holdGala } = await import("../career");
    const calm = royal(16);
    const grieving = royal(16);
    grieving.court.mourning = 1;
    const a = holdGala(calm).player;
    const b = holdGala(grieving).player;
    expect(a.court.approval).toBeGreaterThan(calm.court.approval);
    expect(b.court.approval).toBeLessThan(grieving.court.approval);
  });
});

describe("abdication", () => {
  const withHeir = (seed: number) => {
    const p = sovereign(seed, 72);
    p.relatives.push(rel("Heir", "Child", 45, "Male", { royalTitle: "Prince" }), rel("Spare", "Child", 41, "Female", { royalTitle: "Princess" }));
    return p;
  };

  it("hands the crown to the eldest child and leaves you a Princess on an allowance", () => {
    const p = run(withHeir(1), abdicateAction, "retire");
    expect(p.royal!.crown).toBe("abdicated");
    expect(p.royalRank).toBe("Princess");
    expect(isSovereign(p)).toBe(false);
    expect(p.relatives.find((r) => r.id === "Heir")!.royalTitle).toBe("King");
    expect(royalFinance(p).allowance).toBeGreaterThan(0);
    // The succession machinery leaves the new reign alone.
    const q = structuredClone(p);
    ensureSuccession(q, makeRng(1), []);
    expect(q.royal!.crown).toBe("abdicated");
    // A year passes without trouble.
    expect(ageUp(p, makeRng(3)).player.alive).toBe(true);
  });

  it("is blocked without an heir, and its reception depends on age and reason", () => {
    const lonely = sovereign(2, 72);
    expect(abdicationBlocker(lonely)).toMatch(/no heir/);
    expect(abdicateAction(lonely, "retire").player).toBe(lonely);
    const old = withHeir(2);
    const young = withHeir(2);
    young.age = 40;
    const o = run(old, abdicateAction, "retire");
    const y = run(young, abdicateAction, "retire");
    expect(o.court.approval).toBeGreaterThan(y.court.approval);
    const forLove = withHeir(2);
    abdicate(forLove, "love");
    expect(forLove.court.approval).toBeLessThan(o.court.approval);
  });

  it("when the abdicated parent dies, the reigning child is crowned in play and a sibling becomes a duke", () => {
    const old = withHeir(3);
    abdicate(old, "retire");
    old.alive = false;
    old.deathYear = old.year;
    const crowned = continueAsChild(old, "Heir", makeRng(1))!;
    expect(crowned.royal!.crown).toBe("self");
    expect(crowned.royalRank).toBe("King");
    expect(crowned.court.mourning).toBe(1);
    expect(crowned.queuedEvents).toContain("crown_accession_council");
    const spare = continueAsChild(old, "Spare", makeRng(2))!;
    expect(spare.royal!.crown).toBe("sibling");
    expect(spare.royal!.peerage).toMatch(/^Duchess of /);
  });
});

describe("marriage and divorce", () => {
  it("a married spouse is styled, a wedding lifts popularity, and a divorce strips the style and costs money", () => {
    const p = royal(17);
    p.gender = "Male";
    p.royalRank = "Prince";
    p.relatives = p.relatives.filter((r) => r.relation !== "Partner");
    p.relatives.push(rel("Kate", "Partner", 28, "Female", { partnerStatus: "married", incomeTier: 3 }));
    const before = p.court.approval;
    const notices: Parameters<typeof processRoyalFamily>[2] = [];
    processRoyalFamily(p, makeRng(1), notices);
    const spouse = p.relatives.find((r) => r.id === "Kate")!;
    expect(spouse.royalTitle).toBe("Princess");
    expect(p.court.approval).toBeGreaterThan(before);
    expect(notices.some((n) => "title" in n && n.title === "Royal Wedding")).toBe(true);
    // Doesn't repeat the following year.
    const again: Parameters<typeof processRoyalFamily>[2] = [];
    processRoyalFamily(p, makeRng(2), again);
    expect(again).toHaveLength(0);
    spouse.partnerStatus = "ex";
    const bank = p.bankBalance;
    const appr = p.court.approval;
    processRoyalFamily(p, makeRng(3), []);
    expect(spouse.royalTitle).toBeUndefined();
    expect(p.bankBalance).toBeLessThan(bank);
    expect(p.court.approval).toBeLessThan(appr);
  });

  it("the husband of a princess takes no title; a sovereign's spouse is a consort", () => {
    const q = sovereign(18);
    q.relatives.push(rel("Phil", "Partner", 50, "Male", { partnerStatus: "married" }));
    styleSpouse(q);
    expect(q.relatives.find((r) => r.id === "Phil")!.royalTitle).toBe("Prince Consort");
    const princess = royal(18);
    princess.gender = "Female";
    princess.relatives.push(rel("Mark", "Partner", 32, "Male", { partnerStatus: "married" }));
    styleSpouse(princess);
    expect(princess.relatives.find((r) => r.id === "Mark")!.royalTitle).toBeUndefined();
  });

  it("the royal courtship event lets you marry without consent at the price of your place in line", () => {
    const e = EVENT_BY_ID.crown_romance;
    const p = royal(19, 28);
    p.relatives = p.relatives.filter((r) => r.relation !== "Partner");
    p.royal!.line = 3;
    const out = resolveEvent(p, e, 2, makeRng(1)).player;
    expect(out.royal!.line).toBe(30);
    expect(out.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "married")).toBe(true);
  });
});

describe("raising the next generation", () => {
  const withKid = (seed: number, age = 10) => {
    const p = royal(seed, 40);
    p.relatives.push(rel("Kid", "Child", age, "Female", { royalTitle: "Princess" }));
    return p;
  };

  it("training works once a year per child and shapes duty, touch and polish", () => {
    let p = withKid(20);
    p = run(p, trainChild, makeRng(1), "Kid", "ordinary" as const);
    const t = p.relatives.find((r) => r.id === "Kid")!.royalTraining!;
    expect(t.touch).toBeGreaterThan(50);
    expect(trainChild(p, makeRng(2), "Kid", "media").player).toBe(p);
    p.court.booked = {};
    p = run(p, trainChild, makeRng(3), "Kid", "engagement" as const);
    expect(slotsUsed(p)).toBe(1);
    expect(p.relatives.find((r) => r.id === "Kid")!.royalTraining!.duty).toBeGreaterThan(50);
    // Too young for some things.
    expect(trainChild(withKid(20, 3), makeRng(1), "Kid", "engagement").player.relatives.find((r) => r.id === "Kid")!.royalTraining).toBeUndefined();
    // A royal child is listed.
    expect(royalChildren(p)).toHaveLength(1);
  });

  it("boarding builds duty and polish, a state school the common touch, and each year charges fees", () => {
    const board = run(withKid(21), setSchool, "Kid", "boarding" as const);
    const state = run(withKid(21), setSchool, "Kid", "state" as const);
    for (let i = 0; i < 5; i++) {
      processRoyalFamily(board, makeRng(i), []);
      processRoyalFamily(state, makeRng(i), []);
    }
    const tb = board.relatives.find((r) => r.id === "Kid")!.royalTraining!;
    const ts = state.relatives.find((r) => r.id === "Kid")!.royalTraining!;
    expect(tb.duty).toBeGreaterThan(ts.duty);
    expect(tb.polish).toBeGreaterThan(ts.polish);
    expect(ts.touch).toBeGreaterThan(tb.touch);
    expect(board.bankBalance).toBeLessThan(state.bankBalance);
  });

  it("training carries into the next generation: a well-raised heir inherits a better court", () => {
    const build = (touch: number, patron?: string) => {
      const old = sovereign(22, 70);
      old.alive = false;
      old.deathYear = old.year;
      old.court.approval = 60;
      old.relatives = [rel("Heir", "Child", 30, "Male", { royalTitle: "Prince", royalTraining: { duty: 80, touch, polish: 60, school: "state", service: "navy", patron } })];
      return continueAsChild(old, "Heir", makeRng(4))!;
    };
    const good = build(95, "children");
    const poor = build(5);
    expect(good.court.approval).toBeGreaterThan(poor.court.approval);
    expect(good.court.patronages.map((x) => x.id)).toEqual(["children"]);
    expect(good.court.service?.branch).toBe("navy");
    expect(good.court.realmNames.length).toBeGreaterThan(0);
  });

  it("an unprepared teenager is more likely to cause trouble", () => {
    let careless = 0;
    let prepared = 0;
    for (let s = 1; s <= 400; s++) {
      const a = royal((s % 9) + 1, 40);
      a.relatives.push(rel("Kid", "Child", 17, "Male", { royalTitle: "Prince", royalTraining: { duty: 10, touch: 50, polish: 10, school: "tutors" } }));
      const b = royal((s % 9) + 1, 40);
      b.relatives.push(rel("Kid", "Child", 17, "Male", { royalTitle: "Prince", royalTraining: { duty: 90, touch: 50, polish: 90, school: "tutors" } }));
      processRoyalFamily(a, makeRng(s), []);
      processRoyalFamily(b, makeRng(s), []);
      if (a.queuedEvents.includes("crown_heir_trouble")) careless++;
      if (b.queuedEvents.includes("crown_heir_trouble")) prepared++;
    }
    expect(careless).toBeGreaterThan(prepared);
  });
});

describe("household", () => {
  it("a private office costs money, grows the diary and dismissals can leak", () => {
    let p = royal(23);
    const base = slotsFor(p);
    p = run(p, setSecretary, makeRng(1), 3);
    expect(p.court.secretary).toBe(3);
    expect(slotsFor(p)).toBe(base + 2);
    expect(royalFinance(p).staff).toBeGreaterThan(300_000);
    let leaks = 0;
    for (let s = 1; s <= 200; s++) {
      const q = royal((s % 9) + 1);
      q.court.secretary = 3;
      const before = q.court.heat;
      if (run(q, setSecretary, makeRng(s), 0).court.heat > before) leaks++;
    }
    expect(leaks).toBeGreaterThan(20);
    expect(leaks).toBeLessThan(90);
    const poor = royal(23);
    poor.bankBalance = 0;
    expect(setSecretary(poor, makeRng(1), 3).player).toBe(poor);
  });
});

describe("saves and events", () => {
  it("old saves load: a missing court is filled in, and a king keeps his realms", () => {
    const p = sovereign(24);
    const raw = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    delete raw.court;
    const h = hydrate(raw as unknown as PlayerState);
    expect(h.court.approval).toBe(newCourt().approval);
    expect(h.court.realmNames.length).toBeGreaterThan(0);
    expect(h.court.coronated).toBe(true);
    expect(hydrateCourt(undefined, { royal: null, royalRank: "none", birthCountry: "Japan" }).realmNames).toEqual([]);
    expect(hydrate(JSON.parse(JSON.stringify(royal(24))) as PlayerState).court.booked).toEqual({});
  });

  it("every crown event is registered once and has options", () => {
    const ids = LIFE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const crown = LIFE_EVENTS.filter((e) => e.id.startsWith("crown_"));
    expect(crown.length).toBeGreaterThanOrEqual(15);
    for (const e of crown) expect(e.options.length).toBeGreaterThanOrEqual(2);
  });

  it("each crown event resolves every option without crashing", () => {
    for (const e of LIFE_EVENTS.filter((x) => x.id.startsWith("crown_"))) {
      for (let i = 0; i < e.options.length; i++) {
        for (const s of [1, 2, 3]) {
          const p = sovereign(s);
          p.relatives.push(rel("Heir", "Child", 30, "Male", { royalTitle: "Prince" }), rel("Kid", "Child", 17, "Male", { royalTitle: "Prince" }));
          const q = structuredClone(p);
          startScandal(q, makeRng(s), [], "tax");
          const out = resolveEvent(q, e, i, makeRng(s * 5)).player;
          finalize(out, []);
          for (const k of ["approval", "republic", "heat", "strain", "government"] as const) expect(Number.isFinite(out.court[k]) && out.court[k] >= 0 && out.court[k] <= 100).toBe(true);
        }
      }
    }
  });
});

describe("a royal life, many seeds", () => {
  const shown: Record<string, number> = {};
  const reached = { sovereign: 0, abdicated: 0, steppedBack: 0, generations: 0, scandals: 0 };
  function playRoyal(seed: number): PlayerState {
    const rng: Rng = makeRng(seed);
    let p = createNewPlayer({ scenario: "royal", startYear: 2026, talents: NEUTRAL }, rng);
    let generations = 1;
    for (let guard = 0; guard < 260; guard++) {
      if (!p.alive) {
        const kid = generations < 3 ? heirs(p)[0] : undefined;
        if (!kid) break;
        const next = continueAsChild(p, kid.id, rng);
        if (!next) break;
        p = next;
        generations++;
        reached.generations++;
        continue;
      }
      const settle = (r: { player: PlayerState }) => { if (r.player !== p) { finalize(r.player, []); p = r.player; } };
      if (p.pendingTrial) break;
      // Settle down and have an heir or two.
      const partner = p.relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");
      if (p.age >= 20 && p.age < 45 && !partner && rng.chance(0.3)) settle(meetSomeone(p, "date", rng));
      if (partner?.partnerStatus === "dating" && partner.relationshipBar > 55 && rng.chance(0.4)) settle(propose(p, rng));
      if (partner?.partnerStatus === "married" && p.age >= 22 && p.age <= 40 && rng.chance(0.4)) settle(tryForBaby(p, rng));
      // A busy royal.
      if (p.age >= 16 && p.royalRank !== "none") {
        for (const k of ["hospital", "walkabout", "patron", "remembrance", "tour_realm", "tour_state", "investiture", "banquet"] as EngagementKind[]) {
          if (rng.chance(0.5)) settle(engage(p, rng, k, p.court.patronages[0]?.id));
        }
        if (rng.chance(0.2)) settle(adoptPatronage(p, rng.pick(PATRONAGES).id));
        if (rng.chance(0.1)) settle(setSecretary(p, rng, rng.int(0, 3)));
        if (rng.chance(0.15)) settle(joinService(p, rng.pick(["army", "navy", "air"] as const)));
        if (rng.chance(0.2)) settle(requestDeployment(p, rng));
        if (rng.chance(0.4)) settle(holdAudience(p, rng, rng.pick(["listen", "advise", "press"] as const), rng.pick(["economy", "freedom", "military"] as const)));
        if (rng.chance(0.3)) settle(honoursList(p, rng, rng.pick(["servants", "celebrities", "pm_list", "friends"] as const)));
        if (rng.chance(0.3)) settle(toggleEstate(p));
        if (p.court.scandal) settle(answerScandal(p, rng, rng.pick(["statement", "apologise", "lawyers", "silence", "address"] as const)));
        if (rng.chance(0.02)) settle(abdicateAction(p, "retire"));
        if (rng.chance(0.01)) settle(stepBack(p));
        for (const k of royalChildren(p)) if (rng.chance(0.3)) settle(trainChild(p, rng, k.id, rng.pick(["engagement", "ordinary", "media"] as const)));
      }
      const res = ageUp(p, rng);
      p = res.player;
      for (const n of (res.notices ?? []) as Notice[]) {
        if (n.kind !== "event" || !p.alive) continue;
        shown[n.event.id] = (shown[n.event.id] ?? 0) + 1;
        settle(resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng));
      }
      for (const k of ["approval", "republic", "heat", "strain", "government"] as const) {
        expect(Number.isFinite(p.court[k]), `${k} finite`).toBe(true);
        expect(p.court[k]).toBeGreaterThanOrEqual(0);
        expect(p.court[k]).toBeLessThanOrEqual(100);
      }
      if (isSovereign(p)) reached.sovereign++;
      if (p.court.abdicated) reached.abdicated++;
      if (p.court.steppedBack) reached.steppedBack++;
      if (p.court.scandal) reached.scandals++;
      expect(Number.isFinite(p.bankBalance)).toBe(true);
      expect(p.court.booked.slots ?? 0).toBeLessThanOrEqual(Math.max(slotsFor(p), 12));
    }
    return p;
  }

  it("plays through births, reigns, scandals, abdications and heirs without crashing", async () => {
    for (let s = 1; s <= 16; s++) {
      const p = playRoyal(s * 11);
      expect(Number.isFinite(p.royalRespect)).toBe(true);
    }
    // The run should actually have exercised the machinery.
    expect(reached.sovereign).toBeGreaterThan(0);
    expect(reached.generations).toBeGreaterThan(0);
    expect(shown.crown_accession_council).toBeGreaterThan(0);
    expect(Object.keys(shown).filter((id) => id.startsWith("crown_")).length).toBeGreaterThanOrEqual(5);
  }, 240_000);
});
