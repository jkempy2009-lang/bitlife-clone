import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, netWorth } from "../state";
import { ageUp } from "../ageUp";
import { postContent, signWithClub, startBusiness, startChannel, trainAthletics, sellBusiness } from "../paths";
import { applyForJob, auditionContract, formBand, recordAlbum } from "../career";

const base = (seed: number) => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 24;
  p.education.degrees = ["highschool"];
  return { rng, p };
};

describe("business", () => {
  it("requires cash and counts toward net worth", () => {
    const { rng, p } = base(1);
    p.bankBalance = 10_000;
    p.smarts = 60;
    expect(startBusiness(p, "restaurant", "").player.business).toBeNull();
    p.bankBalance = 200_000;
    const started = startBusiness(p, "restaurant", "Chez Test").player;
    expect(started.business?.name).toBe("Chez Test");
    expect(started.bankBalance).toBe(50_000);
    expect(netWorth(started)).toBe(200_000);
    const aged = ageUp(started, rng).player;
    expect(aged.business === null || aged.business.lastProfit !== undefined).toBe(true);
    const sold = sellBusiness(started).player;
    expect(sold.business).toBeNull();
    expect(sold.bankBalance).toBe(50_000 + 135_000);
  });
});

describe("athlete", () => {
  it("needs athletics skill to sign", () => {
    const { rng, p } = base(2);
    p.skills.athletics = 10;
    expect(signWithClub(p, "Soccer", rng).player.currentJob).toBeNull();
    p.skills.athletics = 95;
    p.health = 100;
    let signed = false;
    for (let s = 0; s < 20 && !signed; s++) signed = signWithClub(p, "Soccer", makeRng(s + 100)).player.currentJob?.lineId === "athlete";
    expect(signed).toBe(true);
  });
  it("training is once a year", () => {
    const { rng, p } = base(3);
    const once = trainAthletics(p, rng).player;
    const twice = trainAthletics(once, rng).player;
    expect(twice.skills.athletics).toBe(once.skills.athletics);
  });
});

describe("influencer", () => {
  it("grows followers when posting and earns fame", () => {
    const { rng, p } = base(4);
    const started = startChannel(p, rng).player;
    const posted = postContent(started, rng).player;
    expect(posted.influencer.followers).toBeGreaterThan(started.influencer.followers);
  });
});

describe("rock star", () => {
  it("band formation then record album pipeline", () => {
    const { rng, p } = base(5);
    p.skills.music = 90;
    const band = formBand(p, 100).player;
    expect(band.music.status).toBe("band");
    band.annual = {};
    let signed = band;
    for (let s = 0; s < 20 && !signed.music.signed; s++) {
      signed = auditionContract({ ...band, annual: {} }, "band", 100, makeRng(s + 7)).player;
    }
    expect(signed.music.signed).toBe(true);
    const rec = recordAlbum(signed, "Metal", "Loud").player;
    expect(rec.music.pendingAlbum?.genre).toBe("Metal");
    const aged = ageUp(rec, rng).player;
    expect(aged.music.albums.length).toBe(1);
    expect(["Flop", "Modest", "Hit", "Gold", "Platinum", "Diamond"]).toContain(aged.music.albums[0].rating);
  });
});

describe("jobs", () => {
  it("background actor is guaranteed above 70 looks and blocked below", () => {
    const { rng, p } = base(6);
    p.looks = 60;
    expect(applyForJob(p, "actor", rng).player.currentJob).toBeNull();
    p.looks = 80;
    expect(applyForJob(p, "actor", rng).player.currentJob?.title).toBe("Background Actor");
  });
});
