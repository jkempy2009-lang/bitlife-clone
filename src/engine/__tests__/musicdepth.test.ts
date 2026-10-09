import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { ageUp } from "../ageUp";
import { createNewPlayer } from "../state";
import { formBand, recruitMember } from "../music";
import { dismissMember, leaveBand, reunite, setSplit, shareCredit, talkToMember, teamNight } from "../musicBand";
import { goOnTour } from "../musicTour";
import { raiseDispute, resolveDispute, sellCatalogue } from "../musicLegacy";
import type { PlayerState } from "@/types/game.types";

function bandLeader(seed: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 24;
  p.bankBalance = 60_000;
  p.skills.music = 60;
  p = formBand(p, 90, rng).player;
  for (let i = 0; i < 4 && p.music.members.length < 3; i++) {
    p.annual.recruit = 0;
    p = recruitMember(p, rng).player;
  }
  return { rng, p };
}

describe("band management", () => {
  it("members have traits, talk, share credit, and the split policy can change", () => {
    const { rng, p } = bandLeader(1);
    expect(p.music.status).toBe("band");
    expect(p.music.members.length).toBeGreaterThan(0);
    const mem = p.music.members[0];
    expect(talkToMember(p, rng, mem.id).player).toBeDefined();
    expect(shareCredit(p, mem.id).player).toBeDefined();
    expect(setSplit(p, "writers").player.music.split).toBe("writers");
    expect(teamNight(p).player.bankBalance).toBeLessThanOrEqual(p.bankBalance);
    const fewer = dismissMember(p, mem.id, rng).player;
    expect(fewer.music.members.length).toBeLessThan(p.music.members.length);
  });

  it("leaving the band records it for a possible reunion years later", () => {
    const { rng, p } = bandLeader(2);
    const solo = leaveBand(p, rng, true).player;
    expect(solo.music.formerBand?.members.length).toBeGreaterThan(0);
    const later = { ...solo, year: solo.year + 5, annual: {} } as PlayerState;
    expect(reunite(later, rng).player).toBeDefined();
  });
});

describe("touring and rights", () => {
  it("touring at different paces runs; punishing pace earns more but costs more", () => {
    let light = 0;
    let hard = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { rng, p } = bandLeader(seed);
      p.music.fans = 60_000;
      p.music.relevance = 70;
      for (const [pace, key] of [["light", "light"], ["punishing", "hard"]] as const) {
        const q = { ...p, annual: {} } as PlayerState;
        const out = goOnTour(q, makeRng(seed), "club", { pace }).player;
        const gain = out.bankBalance - q.bankBalance;
        if (key === "light") light += gain; else hard += gain;
      }
      void rng;
    }
    expect(hard).toBeGreaterThan(light);
  });

  it("a rights dispute can be settled or fought, and catalogues can be sold", () => {
    const { rng, p } = bandLeader(3);
    p.music.albums.push({ title: "First", genre: "rock", rating: "★★★★", year: 2024, quality: 70, sales: 400_000, royalty: 60_000, evergreen: 30_000 } as never);
    expect(raiseDispute(p, "credit", "A former member", 20_000, 2)).toBe(true);
    const settled = resolveDispute(p, rng, "settle").player;
    expect(settled.bankBalance).toBeLessThanOrEqual(p.bankBalance);
    const sold = sellCatalogue(p).player;
    expect(sold.bankBalance).toBeGreaterThan(p.bankBalance);
  });
});

describe("whole careers", () => {
  it("bands live through decades of drama without throwing", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { rng, p: p0 } = bandLeader(30 + seed);
      let p = p0;
      for (let y = 0; y < 25 && p.alive; y++) {
        p = ageUp(p, rng).player;
        if (p.music.status === "band" && y % 3 === 0) p = goOnTour({ ...p, annual: { ...p.annual } } as PlayerState, rng, "club").player;
      }
      expect(p.age).toBeGreaterThan(24);
    }
  });
});
