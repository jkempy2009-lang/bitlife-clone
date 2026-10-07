import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ensureSuccession, royalStyleForChild, royalStyleText, sovereignOf } from "../royalty";
import { continueAsChild } from "../legacy";
import type { PlayerState, Relative } from "@/types/game.types";

const rel = (id: string, relation: Relative["relation"], age: number, gender: string, extra: Partial<Relative> = {}): Relative => ({
  id, relation, name: `${id} Windsor`, age, relationshipBar: 70, health: 90, alive: true, incomeTier: 5, gender, smarts: 60, looks: 60, ...extra,
});

const royalBorn = (seed: number): PlayerState => {
  for (let s = seed; s < seed + 200; s++) {
    const p = createNewPlayer({ scenario: "royal", startYear: 2026, talents: NEUTRAL }, makeRng(s));
    return p;
  }
  throw new Error("unreachable");
};

describe("royal families", () => {
  it("a royal birth names a reigning parent, and birth order decides heir or spare", () => {
    let heirs = 0;
    let spares = 0;
    for (let s = 1; s <= 40; s++) {
      const p = royalBorn(s);
      expect(sovereignOf(p)).toBeTruthy();
      expect(p.royal?.hrh).toBe(true);
      const older = p.relatives.filter((r) => r.relation === "Sibling").length;
      if (older === 0) {
        heirs++;
        expect(p.royal?.line).toBe(1);
      } else {
        spares++;
        expect(p.royal?.line).toBe(older + 1);
      }
    }
    expect(heirs).toBeGreaterThan(8);
    expect(spares).toBeGreaterThan(8);
  });

  it("the eldest child is crowned when the sovereign dies; a younger child is not, and becomes a duke", () => {
    // Heir
    const a = royalBorn(1);
    a.relatives = a.relatives.filter((r) => r.relation !== "Sibling");
    a.royal = { crown: "parent", hrh: true, peerage: null, line: 1 };
    sovereignOf(a)!.alive = false;
    const n1: Parameters<typeof ensureSuccession>[2] = [];
    ensureSuccession(a, makeRng(2), n1);
    expect(a.royal?.crown).toBe("self");
    expect(a.royalRank === "King" || a.royalRank === "Queen").toBe(true);

    // Spare: the older brother is crowned.
    const b = royalBorn(3);
    b.age = 30;
    b.gender = "Female";
    b.royalRank = "Princess";
    b.relatives = b.relatives.filter((r) => r.relation !== "Sibling");
    b.relatives.push(rel("Edward", "Sibling", 34, "Male", { royalTitle: "Prince" }));
    b.royal = { crown: "parent", hrh: true, peerage: null, line: 2 };
    sovereignOf(b)!.alive = false;
    ensureSuccession(b, makeRng(4), []);
    expect(b.royal?.crown).toBe("sibling");
    expect(b.royalRank).toBe("Princess");
    expect(b.royal?.peerage).toMatch(/^Duchess of /);
    expect(b.relatives.find((r) => r.id === "Edward")!.royalTitle).toBe("King");
    expect(royalStyleText(b)).toMatch(/Princess/);
  });

  it("children are Princes/Princesses only if they are children or grandchildren of the reigning sovereign", () => {
    const p = royalBorn(5);
    p.royal = { crown: "self", hrh: true, peerage: null, line: 0 };
    expect(royalStyleForChild(p, "Male")).toBe("Prince");
    p.royal = { crown: "parent", hrh: true, peerage: null, line: 2 };
    expect(royalStyleForChild(p, "Female")).toBe("Princess");
    // A younger sibling of the monarch with a dukedom: their kids are Lord/Lady, never Prince/Princess.
    p.royal = { crown: "sibling", hrh: true, peerage: "Duke of Kent", line: 2 };
    expect(royalStyleForChild(p, "Male")).toBe("Lord");
    expect(royalStyleForChild(p, "Female")).toBe("Lady");
    p.royal = { crown: "sibling", hrh: true, peerage: null, line: 2 };
    expect(royalStyleForChild(p, "Male")).toBeUndefined();
  });

  it("continuing a dynasty: the crown passes to the eldest; a younger child stays HRH with a dukedom", () => {
    const old = royalBorn(6);
    old.age = 70;
    old.alive = false;
    old.deathYear = old.year;
    old.royalRank = "King";
    old.gender = "Male";
    old.royal = { crown: "self", hrh: true, peerage: null, line: 0 };
    old.relatives = [rel("Eldest", "Child", 40, "Female", { royalTitle: "Princess" }), rel("Younger", "Child", 35, "Male", { royalTitle: "Prince" })];
    const crowned = continueAsChild(old, "Eldest", makeRng(7))!;
    expect(crowned.royalRank).toBe("Queen");
    expect(crowned.royal?.crown).toBe("self");
    const spare = continueAsChild(old, "Younger", makeRng(8))!;
    expect(spare.royalRank).toBe("Prince");
    expect(spare.royal?.hrh).toBe(true);
    expect(spare.royal?.peerage).toMatch(/^Duke of /);
    expect(spare.royal?.crown).toBe("sibling");
    expect(spare.relatives.some((r) => r.relation === "Sibling" && (r.royalTitle === "Queen" || r.royalTitle === "King") === false)).toBe(true);
  });

  it("a duke's child (nephew of the monarch) loses HRH but keeps a title; the eldest son inherits the dukedom", () => {
    const old = royalBorn(9);
    old.age = 60;
    old.alive = false;
    old.deathYear = old.year;
    old.royalRank = "Prince";
    old.royal = { crown: "sibling", hrh: true, peerage: "Duke of Kent", line: 3 };
    old.relatives = [rel("Daughter", "Child", 38, "Female", { royalTitle: "Lady" }), rel("Son", "Child", 33, "Male", { royalTitle: "Lord" })];
    const heir = continueAsChild(old, "Son", makeRng(10))!;
    expect(heir.royal?.hrh).toBe(false);
    expect(heir.royalRank).toBe("none");
    expect(heir.royal?.peerage).toBe("Duke of Kent");
    const daughter = continueAsChild(old, "Daughter", makeRng(11))!;
    expect(daughter.royal?.hrh).toBe(false);
    expect(daughter.royalRank).toBe("none");
    expect(daughter.royal?.peerage ?? "").not.toBe("Duke of Kent");
    expect(royalStyleText(daughter)).toMatch(/Lady/);
  });

  it("a grandchild of a reigning sovereign is HRH and in the line of succession", () => {
    const old = royalBorn(12);
    old.age = 30;
    old.alive = false;
    old.deathYear = old.year;
    old.royal = { crown: "parent", hrh: true, peerage: null, line: 1 };
    old.relatives = [rel("Kid", "Child", 5, "Male", { royalTitle: "Prince" }), rel("Monarch", "Parent", 60, "Female", { royalTitle: "Queen" })];
    const kid = continueAsChild(old, "Kid", makeRng(13))!;
    expect(kid.royal?.hrh).toBe(true);
    expect(kid.royal?.line).toBe(1);
    expect(kid.royalRank).toBe("Prince");
    expect(sovereignOf(kid)).toBeTruthy();
  });
});
