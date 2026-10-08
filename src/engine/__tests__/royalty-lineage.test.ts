import { ageUp } from "../ageUp";
import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, makeRelativeBase } from "../state";
import { continueAsChild } from "../legacy";
import { ensureSuccession, processRoyalFamily, syncLine } from "../royalty";
import type { PlayerState, Relative } from "@/types/game.types";

const rng = makeRng(11);
const kid = (name: string, age: number, gender: string, title = gender === "Male" ? "Prince" : "Princess"): Relative => ({
  ...makeRelativeBase(rng, "Child", name, age, gender, 5, 70),
  royalTitle: title,
});

/** A royal player (crown prince by default) with a reigning parent and their own children. */
function royal(opts: { crown: "parent" | "self"; line?: number; children?: Relative[]; grandchildren?: Relative[] }): PlayerState {
  const p = createNewPlayer({ scenario: "royal", startYear: 2026, talents: NEUTRAL }, makeRng(5));
  p.age = 50;
  p.birthYear = p.year - 50;
  p.bankBalance = 1_000_000;
  p.gender = "Male";
  p.relatives = p.relatives.filter((r) => r.relation === "Friend" || r.relation === "Pet");
  p.royal = { crown: opts.crown, hrh: true, peerage: null, line: opts.crown === "self" ? 0 : opts.line ?? 1 };
  if (opts.crown === "self") {
    p.royalRank = "King";
  } else {
    p.royalRank = "Prince";
    p.relatives.push({ ...makeRelativeBase(rng, "Parent", "Old Sovereign", 78, "Female", 5, 70), royalTitle: "Queen" });
  }
  p.relatives.push(...(opts.children ?? []), ...(opts.grandchildren ?? []));
  return p;
}

const grandchild = (name: string, parent: Relative, age = 2): Relative => ({
  ...makeRelativeBase(rng, "Grandchild", name, age, "Female", 5, 70),
  parentId: parent.id,
  royalTitle: "Princess",
});

const killSovereign = (p: PlayerState) => {
  const s = p.relatives.find((r) => r.royalTitle === "King" || r.royalTitle === "Queen")!;
  s.alive = false;
};

describe("a crown prince hands his life to his son", () => {
  it("the original heir is crowned when the sovereign dies, and the son becomes heir", () => {
    const son = kid("Will Windsor", 24, "Male");
    const old = royal({ crown: "parent", line: 1, children: [son] });
    const p = continueAsChild(old, son.id, makeRng(1), true)!;
    expect(p.royal?.crown).toBe("grandparent");
    expect(p.royal?.line).toBe(2);
    const father = p.relatives.find((r) => r.relation === "Parent")!;
    expect(father.alive).toBe(true);
    expect(father.royalLine).toBe(1);

    killSovereign(p);
    const notices: never[] = [];
    ensureSuccession(p, makeRng(2), notices);
    expect(father.royalTitle).toBe("King");
    expect(p.royal?.crown).toBe("parent");
    expect(p.royal?.line).toBe(1); // the son is now heir
    expect(p.royalRank).not.toBe("King");

    // Later the new king dies and the son inherits.
    father.alive = false;
    ensureSuccession(p, makeRng(3), notices);
    expect(p.royal?.crown).toBe("self");
    expect(p.royalRank).toBe("King");
  });

  it("if the original heir dies first, the son moves up and is crowned when the sovereign dies", () => {
    const son = kid("Will Windsor", 24, "Male");
    const old = royal({ crown: "parent", line: 1, children: [son] });
    const p = continueAsChild(old, son.id, makeRng(1), true)!;
    const father = p.relatives.find((r) => r.relation === "Parent")!;
    father.alive = false;
    syncLine(p);
    expect(p.royal?.line).toBe(1);
    killSovereign(p);
    ensureSuccession(p, makeRng(2), []);
    expect(p.royal?.crown).toBe("self");
  });

  it("works across three generations: the great-grandparent's crown still reaches this line", () => {
    const son = kid("Will Windsor", 24, "Male");
    const old = royal({ crown: "parent", line: 1, children: [son] });
    const p1 = continueAsChild(old, son.id, makeRng(1), true)!;
    const grandson = { ...kid("George Windsor", 19, "Male"), royalTitle: "Prince" };
    p1.age = 50;
    p1.relatives.push(grandson);
    const p2 = continueAsChild(p1, grandson.id, makeRng(2), true)!;
    expect(p2.relatives.some((r) => r.relation === "Grandparent" && r.royalTitle === "Queen")).toBe(true);
    expect(p2.royal?.line).toBe(3);
    // The sovereign, then her heir, then his heir die in order.
    killSovereign(p2);
    ensureSuccession(p2, makeRng(3), []);
    expect(p2.royal?.line).toBe(2);
    const chain = p2.relatives.filter((r) => r.royalTitle === "King");
    expect(chain).toHaveLength(1);
    chain[0].alive = false;
    ensureSuccession(p2, makeRng(4), []);
    syncLine(p2);
    expect(p2.royal?.line).toBe(1);
  });
});

describe("the younger son and the elder son's baby", () => {
  it("handing over to the second son puts the elder brother and his baby ahead of you", () => {
    const first = kid("Elder Windsor", 30, "Male");
    const second = kid("Second Windsor", 24, "Male");
    const baby = grandchild("Baby Windsor", first);
    const old = royal({ crown: "self", children: [first, second], grandchildren: [baby] });
    const p = continueAsChild(old, second.id, makeRng(1), true)!;
    expect(p.royal?.crown).toBe("parent");
    expect(p.royal?.line).toBe(3); // elder brother, his baby, then you
    expect(p.relatives.find((r) => r.relation === "Nephew")?.parentId).toBe(p.relatives.find((r) => r.name === "Elder Windsor")?.id);
    // The sovereign dies: the elder brother is crowned, not you.
    killSovereign(p);
    ensureSuccession(p, makeRng(2), []);
    expect(p.relatives.find((r) => r.name === "Elder Windsor")?.royalTitle).toBe("King");
    expect(p.royal?.crown).toBe("sibling");
    expect(p.royal?.line).toBe(3 - 0); // his baby then you, plus the king counted ahead
  });

  it("if the elder brother has died, his child is crowned ahead of you", () => {
    const first = { ...kid("Elder Windsor", 30, "Male"), alive: false, deathYear: 2026 };
    const second = kid("Second Windsor", 24, "Male");
    const baby = grandchild("Baby Windsor", first);
    const old = royal({ crown: "self", children: [first, second], grandchildren: [baby] });
    // On the sovereign's death the grandchild (a dead eldest child's line) is crowned, not the second son.
    old.alive = false;
    old.deathYear = old.year;
    const p = continueAsChild(old, second.id, makeRng(1))!;
    expect(p.royal?.crown).toBe("other");
    expect(p.royal?.line).toBeGreaterThanOrEqual(2);
    expect(p.royalRank).not.toBe("King");
  });

  it("with no elder line, the second son is crowned only after the elder son's line is exhausted", () => {
    const first = kid("Elder Windsor", 30, "Male");
    const second = kid("Second Windsor", 24, "Male");
    const old = royal({ crown: "self", children: [first, second] });
    old.alive = false;
    old.deathYear = old.year;
    const p = continueAsChild(old, second.id, makeRng(1))!;
    expect(p.royalRank).not.toBe("King");
    expect(p.royal?.crown).toBe("sibling");
  });

  it("royal siblings have children over the years, and those ahead of you push you down the line", () => {
    const p = royal({ crown: "parent", line: 3 });
    p.age = 20;
    const elder = { ...makeRelativeBase(rng, "Sibling", "Elder Windsor", 32, "Male", 5, 70), royalTitle: "Prince" };
    const heirApparent = { ...makeRelativeBase(rng, "Sibling", "Eldest Windsor", 35, "Female", 5, 70), royalTitle: "Princess" };
    p.relatives.push(elder, heirApparent);
    p.royal!.line = 3;
    const r = makeRng(42);
    for (let y = 0; y < 60 && p.relatives.filter((x) => x.relation === "Nephew").length < 2; y++) processRoyalFamily(p, r, []);
    const nephews = p.relatives.filter((x) => x.relation === "Nephew");
    expect(nephews.length).toBeGreaterThanOrEqual(1);
    expect(p.royal!.line).toBe(3 + nephews.length);
    expect(nephews.every((n) => n.royalTitle === "Prince" || n.royalTitle === "Princess")).toBe(true);
  });
});

describe("full lives", () => {
  it("a crown prince's heir, played after a handover, is crowned in the end and the throne never has two holders", () => {
    let crowned = 0;
    const seeds = 14;
    for (let seed = 1; seed <= seeds; seed++) {
      const r = makeRng(900 + seed);
      const son = { ...makeRelativeBase(r, "Child", "Will Windsor", 20, "Male", 5, 80), royalTitle: "Prince" };
      const old = royal({ crown: "parent", line: 1, children: [son] });
      old.age = 48;
      let p = continueAsChild(old, son.id, r, true)!;
      let wasKing = false;
      for (let y = 0; y < 70 && p.alive; y++) {
        p = ageUp(p, r).player;
        const holders = p.relatives.filter((x) => x.alive && (x.royalTitle === "King" || x.royalTitle === "Queen")).length + (p.royalRank === "King" || p.royalRank === "Queen" ? 1 : 0);
        expect(holders, `seed ${seed} age ${p.age}`).toBeLessThanOrEqual(1);
        if (p.royal?.crown === "self") wasKing = true;
      }
      if (wasKing) crowned++;
    }
    expect(crowned).toBeGreaterThanOrEqual(Math.floor(seeds * 0.6));
  });
});
