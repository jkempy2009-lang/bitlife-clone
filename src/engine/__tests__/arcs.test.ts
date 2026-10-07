import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { ARCS, ARC_EVENTS } from "@/data/events/arcs";
import { EVENT_BY_ID, LIFE_EVENTS, type ChoiceEffects } from "@/data/lifeEventsEngine";
import { createNewPlayer } from "../state";
import { hydrate } from "../save";
import { addRelative } from "../social";
import { continueAsChild } from "../legacy";
import { isEligible, selectEvents } from "../events";
import { SCHEDULE_GRACE, closeOrphanArcs, scheduleEvent, takeDueEvents } from "../arcEffects";
import { deriveHeirTraits } from "../generations";
import { activeStorylines } from "../storylines";
import { playTypicalLife } from "./helpers/arcBot";

const fresh = (seed = 1) => createNewPlayer({ scenario: "average", startYear: 2026 }, makeRng(seed));

/** Every effects object an event can apply (success and failure branches). */
const allEffects = (events: typeof ARC_EVENTS): Array<{ id: string; fx: ChoiceEffects }> =>
  events.flatMap((e) => e.options.flatMap((o) => [{ id: e.id, fx: o.effects }, ...(o.chance ? [{ id: e.id, fx: o.chance.failure }] : [])]));

const stillThere = () => true;

describe("storyline scheduling", () => {
  it("books a beat for a year inside the requested range, deterministically", () => {
    const a = fresh();
    const b = fresh();
    scheduleEvent(a, { id: "rival_foe", years: [3, 5] }, makeRng(9));
    scheduleEvent(b, { id: "rival_foe", years: [3, 5] }, makeRng(9));
    expect(a.scheduled).toHaveLength(1);
    expect(a.scheduled[0].dueYear).toBeGreaterThanOrEqual(a.year + 3);
    expect(a.scheduled[0].dueYear).toBeLessThanOrEqual(a.year + 5);
    expect(a.scheduled).toEqual(b.scheduled);
  });

  it("never double-books a beat or books an unknown id", () => {
    const p = fresh();
    scheduleEvent(p, { id: "rival_foe", years: [1, 1] }, makeRng(1));
    scheduleEvent(p, { id: "rival_foe", years: [1, 1] }, makeRng(2));
    scheduleEvent(p, { id: "no_such_event", years: [1, 1] }, makeRng(3));
    expect(p.scheduled).toHaveLength(1);
  });

  it("delivers a due, eligible beat once and keeps a future one", () => {
    const p = fresh();
    p.age = 30;
    p.flags.push("arc_rival");
    p.scheduled.push({ id: "rival_foe", dueYear: p.year + 2 });
    const eligible = (e: Parameters<typeof isEligible>[1]) => isEligible(p, e);
    expect(takeDueEvents(p, eligible, stillThere)).toHaveLength(0);
    expect(p.scheduled).toHaveLength(1);
    p.year += 2;
    const due = takeDueEvents(p, eligible, stillThere);
    expect(due.map((e) => e.id)).toEqual(["rival_foe"]);
    expect(p.scheduled).toHaveLength(0);
  });

  it("waits while ineligible, then lapses the arc once the grace period runs out", () => {
    const p = fresh();
    p.age = 30;
    p.flags.push("arc_rival");
    p.scheduled.push({ id: "rival_foe", dueYear: p.year });
    const never = () => false;
    p.year += 1;
    expect(takeDueEvents(p, never, stillThere)).toHaveLength(0);
    expect(p.scheduled).toHaveLength(1);
    p.year += SCHEDULE_GRACE + 1;
    takeDueEvents(p, never, stillThere);
    expect(p.scheduled).toHaveLength(0);
    expect(p.flags).toContain("arc_rival_done");
    expect(p.flags).toContain("arc_rival_lapsed");
  });

  it("never lapses a beat while the player is in prison", () => {
    const p = fresh();
    p.flags.push("arc_rival");
    p.scheduled.push({ id: "rival_foe", dueYear: p.year });
    p.isInPrison = true;
    p.year += 20;
    takeDueEvents(p, () => false, stillThere);
    expect(p.scheduled).toHaveLength(1);
    expect(p.flags).not.toContain("arc_rival_done");
  });

  it("selectEvents never draws a scheduledOnly beat from the random pool", () => {
    const p = fresh();
    p.age = 30;
    for (let i = 0; i < 40; i++) {
      for (const e of selectEvents(p, makeRng(100 + i))) expect(e.scheduledOnly, e.id).not.toBe(true);
    }
  });
});

describe("storyline data", () => {
  it("has at least 14 arcs with 3-6 chapters each", () => {
    expect(ARCS.length).toBeGreaterThanOrEqual(14);
    for (const arc of ARCS) {
      const chapters = ARC_EVENTS.filter((e) => e.arc === arc.id);
      expect(chapters.length, `${arc.id} chapters`).toBeGreaterThanOrEqual(3);
      expect(chapters.length, `${arc.id} chapters`).toBeLessThanOrEqual(8);
      expect(chapters.some((e) => !e.scheduledOnly), `${arc.id} has an entry`).toBe(true);
      expect(arc.id).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("references only events that exist, and gives every option an effect", () => {
    for (const { id, fx } of allEffects(ARC_EVENTS)) {
      expect(Object.keys(fx).length, `${id} has an option with no effects`).toBeGreaterThan(0);
      const specs = fx.queueAfter ? (Array.isArray(fx.queueAfter) ? fx.queueAfter : [fx.queueAfter]) : [];
      for (const s of specs) {
        expect(EVENT_BY_ID[s.id], `${id} books missing ${s.id}`).toBeDefined();
        expect(s.years[0]).toBeGreaterThanOrEqual(1);
        expect(s.years[1]).toBeGreaterThanOrEqual(s.years[0]);
      }
      if (fx.queueEvent) expect(EVENT_BY_ID[fx.queueEvent], `${id} queues missing ${fx.queueEvent}`).toBeDefined();
      for (const c of fx.cancelScheduled ?? []) expect(EVENT_BY_ID[c], `${id} cancels missing ${c}`).toBeDefined();
    }
  });

  it("every scheduled-only beat is booked by something, and every required flag can be set", () => {
    const booked = new Set<string>(["estate_heir_will", "legacy_letter_note", "legacy_memorial"]); // booked by generations.ts
    const setFlags = new Set<string>();
    for (const { fx } of allEffects(LIFE_EVENTS)) {
      for (const s of fx.queueAfter ? (Array.isArray(fx.queueAfter) ? fx.queueAfter : [fx.queueAfter]) : []) booked.add(s.id);
      for (const f of fx.setFlags ?? []) setFlags.add(f);
    }
    for (const e of ARC_EVENTS) {
      if (e.scheduledOnly) expect(booked.has(e.id), `${e.id} is never booked`).toBe(true);
      for (const f of e.requires?.flagsAll ?? []) {
        if (f.startsWith("arc_")) expect(setFlags.has(f), `${e.id} needs ${f}, which nothing sets`).toBe(true);
      }
    }
  });

  it("keeps arc flags namespaced and the dashboard summary working", () => {
    const p = fresh();
    expect(activeStorylines(p)).toEqual([]);
    p.flags.push("arc_rival");
    const s = activeStorylines(p);
    expect(s).toHaveLength(1);
    expect(s[0].status).not.toContain("{");
  });
});

describe("old saves and orphaned arcs", () => {
  it("hydrates a save with no scheduled list, and drops junk entries", () => {
    const p = fresh();
    const old = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    delete old.scheduled;
    expect(hydrate(old as unknown as typeof p).scheduled).toEqual([]);
    old.scheduled = [{ id: "rival_foe", dueYear: 2030 }, { id: 5 }, null, { id: "x" }];
    expect(hydrate(old as unknown as typeof p).scheduled).toEqual([{ id: "rival_foe", dueYear: 2030 }]);
  });

  it("closes an arc that is underway with nothing booked, and drops removed event ids", () => {
    const p = fresh();
    p.flags.push("arc_rival");
    p.scheduled.push({ id: "removed_in_a_later_version", dueYear: p.year });
    closeOrphanArcs(p);
    expect(p.flags).toContain("arc_rival_done");
    expect(takeDueEvents(p, stillThere, stillThere)).toEqual([]);
    expect(p.scheduled).toHaveLength(0);
  });
});

describe("generations", () => {
  const dynasty = (childOpts: Partial<Parameters<typeof addRelative>[1]> = {}, kid: Record<string, unknown> = {}) => {
    const rng = makeRng(5);
    const old = fresh(5);
    old.age = 80;
    old.alive = false;
    old.deathYear = old.year;
    old.bankBalance = 400_000;
    old.flags.push("arc_rival", "arc_mentor", "arc_secret_done");
    old.scheduled.push({ id: "rival_foe", dueYear: old.year + 2 });
    const child = addRelative(old, { relation: "Child", age: 24, ...childOpts }, rng);
    child.relationshipBar = 90;
    Object.assign(child, kid);
    return { old, child, rng };
  };

  it("starts the heir with a clean slate of storylines but a family legacy", () => {
    const { old, child, rng } = dynasty();
    const next = continueAsChild(old, child.id, rng)!;
    expect(next.generation).toBe(old.generation + 1);
    expect(next.flags).toContain("gen_heir");
    expect(next.flags.filter((f) => /^arc_/.test(f))).toEqual([]);
    expect(next.scheduled.every((s) => EVENT_BY_ID[s.id])).toBe(true);
    expect(next.scheduled.some((s) => s.id === "rival_foe")).toBe(false);
    expect(next.lifeLog.join("\n")).toMatch(/Generation 2/);
    expect(next.queuedEvents).toContain("legacy_memorial");
  });

  it("derives heir traits from the child, the upbringing and the surviving parent", () => {
    const child = { traits: ["Wild", "Loyal"] } as Parameters<typeof deriveHeirTraits>[0];
    const parent = { traits: ["Ambitious"] } as Parameters<typeof deriveHeirTraits>[2];
    const nurtured = deriveHeirTraits(child, "nurtured", parent, makeRng(1));
    expect(nurtured).toEqual(["Wild", "Kind", "Ambitious"]);
    expect(deriveHeirTraits(child, "neglected", undefined, makeRng(1))).toEqual(deriveHeirTraits(child, "neglected", undefined, makeRng(1)));
    expect(deriveHeirTraits(child, "ordinary", undefined, makeRng(1))).toEqual(["Wild", "Loyal"]);
  });

  it("lets how the child was raised shape their starting skills", () => {
    const base = dynasty();
    const plain = continueAsChild(base.old, base.child.id, makeRng(7))!;
    const music = dynasty({}, { interest: "music", school: "private" });
    const gifted = continueAsChild(music.old, music.child.id, makeRng(7))!;
    expect(gifted.skills.music).toBeGreaterThan(plain.skills.music);
    expect(gifted.flags).toContain("raised_private_school");
    expect(gifted.smarts).toBeGreaterThan(plain.smarts);
  });
});

describe("termination", () => {
  it("a 100-year random-bot life, with heirs, terminates inside its bound", () => {
    for (const seed of [11, 12]) {
      const r = playTypicalLife(seed, { heirs: true, maxYears: 120 });
      expect(r.years).toBeLessThanOrEqual(120);
      expect(r.p.scheduled.every((s) => typeof s.dueYear === "number")).toBe(true);
      expect(r.p.scheduled.length).toBeLessThan(20);
    }
  });
});
