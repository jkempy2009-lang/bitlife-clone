import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { COUNTRIES } from "@/data/countries";
import { NAME_POOLS } from "@/data/names";
import { randomName } from "../state";

describe("country name pools", () => {
  it("every country has a deep, clean pool", () => {
    for (const c of COUNTRIES) {
      expect(NAME_POOLS[c.name], c.name).toBeDefined();
      expect(c.maleNames.length, `${c.name} male`).toBeGreaterThanOrEqual(40);
      expect(c.femaleNames.length, `${c.name} female`).toBeGreaterThanOrEqual(40);
      expect(c.lastNames.length, `${c.name} last`).toBeGreaterThanOrEqual(50);
      for (const n of [...c.maleNames, ...c.femaleNames, ...c.lastNames]) {
        expect(n, c.name).toMatch(/^[\p{L}][\p{L}' -]*$/u);
      }
    }
  });

  it("names are not repetitive: hundreds of draws give many distinct names", () => {
    const rng = makeRng(7);
    const firsts = new Set<string>();
    const lasts = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const n = randomName("United Kingdom", i % 2 ? "Male" : "Female", rng);
      firsts.add(n.first);
      lasts.add(n.last);
    }
    expect(firsts.size).toBeGreaterThan(60);
    expect(lasts.size).toBeGreaterThan(50);
  });

  it("names follow the country", () => {
    const rng = makeRng(9);
    const jp = new Set(NAME_POOLS.Japan.male);
    let match = 0;
    for (let i = 0; i < 100; i++) if (jp.has(randomName("Japan", "Male", rng).first)) match++;
    expect(match).toBe(100);
    const lasts = Array.from({ length: 200 }, () => randomName("Japan", "Female", rng).last);
    expect(lasts.every((l) => NAME_POOLS.Japan.last.includes(l))).toBe(true);
  });
});
