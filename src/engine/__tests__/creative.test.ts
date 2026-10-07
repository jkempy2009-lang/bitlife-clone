import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { ageUp } from "../ageUp";
import { createNewPlayer } from "../state";
import { hydrate } from "../save";
import { blockerFor } from "../occupation";
import { applyForJob } from "../career";
import { goFullTimeCreator, postContent, startChannel, switchFocus } from "../influencer";
import { auditionContract, leaveLabel, processMusic, recruitMember, formBand } from "../music";
import { typecastFrom, hireAgent } from "../acting";
import { raiseScandal, resolveScandal } from "../celebrity";
import type { PlayerState } from "@/types/game.types";

function adult(seed: number) {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 25;
  p.education.stage = "None";
  return { rng, p };
}

describe("creator career", () => {
  it("full-time creating excludes jobs and signing, and needs the job gone first", () => {
    const { rng, p } = adult(1);
    const started = startChannel(p, rng).player;
    const withJob = applyForJob(started, "retail", rng).player;
    expect(withJob.currentJob).not.toBeNull();
    expect(goFullTimeCreator(withJob, false).player.influencer.fullTime).toBe(false);
    const ft = goFullTimeCreator(withJob, true).player;
    expect(ft.influencer.fullTime).toBe(true);
    expect(ft.currentJob).toBeNull();
    expect(blockerFor(ft, "job")).toMatch(/full-time creator/);
    expect(blockerFor(ft, "music")).toMatch(/channel/);
  });

  it("effort and hours drive growth: full-time grind beats coasting beside a job", () => {
    const total = { grind: 0, coast: 0 };
    for (let s = 1; s <= 12; s++) {
      for (const mode of ["grind", "coast"] as const) {
        const { rng, p } = adult(s);
        let q = startChannel(p, rng).player;
        if (mode === "grind") {
          q = goFullTimeCreator(q, false).player;
          q.effort = "grind";
        } else {
          q = applyForJob(q, "retail", rng).player;
          q.effort = "coast";
        }
        for (let y = 0; y < 5; y++) q = ageUp(q, rng).player;
        total[mode] += q.influencer.followers;
      }
    }
    expect(total.grind).toBeGreaterThan(total.coast * 3);
  });

  it("switching niche costs followers", () => {
    const { rng, p } = adult(2);
    const q = startChannel(p, rng).player;
    q.influencer.followers = 10_000;
    const sw = switchFocus(q, rng, { niche: "gaming" }).player;
    expect(sw.influencer.followers).toBeLessThan(7_000);
    expect(postContent(q, rng).player.influencer.followers).toBeGreaterThan(10_000);
  });
});

describe("music career", () => {
  it("contract recoupment: royalties repay the label before you are paid", () => {
    const { rng, p } = adult(3);
    p.music.status = "solo";
    p.music.signed = true;
    p.music.contract = { label: "X", totalYears: 4, yearsLeft: 4, advance: 0, stipend: 0, royaltyRate: 0.15, albumsOwed: 3, albumsDelivered: 0, unrecouped: 100_000, creativeControl: 50, tourCut: 0.15, renegotiatedYear: 0 };
    p.music.albums = [{ title: "A", genre: "Rock", rating: "Hit", sales: 1, royalty: 60_000, year: 2020, indie: false }];
    const n: never[] = [];
    const pay1 = processMusic(p, rng, n);
    expect(pay1).toBe(0);
    expect(p.music.contract!.unrecouped).toBe(40_000);
    p.music.albums[0].royalty = 100_000;
    const pay2 = processMusic(p, rng, n);
    expect(pay2).toBe(60_000);
    expect(p.music.contract!.unrecouped).toBe(0);
  });

  it("leaving early forfeits label masters", () => {
    const { p } = adult(4);
    p.music.signed = true;
    p.music.status = "solo";
    p.music.contract = { label: "X", totalYears: 4, yearsLeft: 3, advance: 0, stipend: 0, royaltyRate: 0.15, albumsOwed: 3, albumsDelivered: 0, unrecouped: 0, creativeControl: 50, tourCut: 0.15, renegotiatedYear: 0 };
    p.music.albums = [{ title: "A", genre: "Rock", rating: "Hit", sales: 1, royalty: 5_000, year: 2020 }];
    const left = leaveLabel(p).player;
    expect(left.music.albums[0].labelOwned).toBe(true);
    expect(left.music.signed).toBe(false);
  });

  it("an employee can't sign, and a bandmate with no loyalty walks", () => {
    const { rng, p } = adult(5);
    const band = formBand({ ...p, skills: { ...p.skills, music: 90 } }, 100, rng).player;
    expect(band.music.members.length).toBeGreaterThan(0);
    band.music.members[0].loyalty = 0;
    const before = band.music.members.length;
    for (let s = 0; s < 10 && band.music.members.length === before; s++) processMusic(band, makeRng(s), []);
    expect(band.music.members.length).toBeLessThan(before);
    const employed = applyForJob(band, "retail", rng).player;
    expect(auditionContract(employed, "band", 100, rng).player.music.signed).toBe(false);
    expect(recruitMember(band, rng).notices).toBeDefined();
  });
});

describe("acting and PR", () => {
  it("typecasting emerges from three of five credits in a genre", () => {
    const credit = (genre: string) => ({ id: genre + Math.random(), title: "t", year: 2020, genre, role: "lead" as const, budget: 1, boxOffice: 1, critics: 50, outcome: "hit" as const });
    expect(typecastFrom([credit("Horror"), credit("Horror"), credit("Comedy"), credit("Horror")])).toBe("Horror");
    expect(typecastFrom([credit("Horror"), credit("Comedy"), credit("Drama")])).toBeNull();
  });

  it("agents need a working performer", () => {
    const { rng, p } = adult(6);
    expect(hireAgent(p, rng).player.acting.agent).toBeNull();
  });

  it("a scandal can be answered and is cleared", () => {
    const { rng, p } = adult(7);
    const q: PlayerState = structuredClone(p);
    raiseScandal(q, "general", rng, [], 2);
    expect(q.celeb.scandal).not.toBeNull();
    const res = resolveScandal(q, rng, "apologise").player;
    expect(res.celeb.scandal).toBeNull();
  });
});

describe("old saves", () => {
  it("upgrade old influencer and music shapes", () => {
    const { p } = adult(8);
    const old = structuredClone(p) as unknown as Record<string, unknown>;
    old.influencer = { active: true, followers: 12_345, lastPostYear: 2025 };
    old.music = { status: "solo", signed: true, pendingAlbum: null, albums: [{ title: "T", genre: "Rock", rating: "Hit", sales: 1, royalty: 1, year: 2020 }] };
    delete old.acting;
    delete old.celeb;
    const h = hydrate(old as unknown as PlayerState);
    expect(h.influencer.followers).toBe(12_345);
    expect(h.influencer.engagement).toBeGreaterThan(0);
    expect(h.music.contract).not.toBeNull();
    expect(h.music.members).toEqual([]);
    expect(h.acting.credits).toEqual([]);
    expect(h.celeb.scandal).toBeNull();
    expect(ageUp(h, makeRng(1)).player.alive).toBeDefined();
  });
});
