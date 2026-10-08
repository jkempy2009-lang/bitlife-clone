import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { exportSave, parseSave } from "../save";
import { acceptOffer, chooseTreatment, retireFromSport, signWithClub, treatmentBlocker } from "../athlete";
import { processAthlete } from "../athleteSeason";
import { signContract } from "../athleteCareer";
import { hydrateAthlete, newAthleteState } from "../athleteState";
import { DEAL_KINDS, dealIncome, maxDeals, rollDealOffers, rollPlaying, seasonModifiers } from "../athleteDepth";
import {
  academyBlocker, appealBan, appealBlocker, captainBlocker, declineDeal, dropDeal, requestTransfer, runForCaptain, seeTherapist, setNationalPlan, signDeal,
  startAcademy, talkToCoach, teamDinner, fuelRivalry, makePeace,
} from "../athleteLife";
import { BALLOT_YEARS, careerSummary, hallBallot, legacyScore, legacyTier } from "../athleteLegacy";
import { EVENT_BY_ID } from "@/data/lifeEventsEngine";
import { resolveEvent } from "../events";
import { SPORTS } from "@/data/sports";
import type { ActionResult, AthleteOffer, EndorsementDeal, Notice, PlayerState } from "@/types/game.types";

type Notices = NonNullable<ActionResult["notices"]>;
const titleOf = (n: Notices[number]) => (n as { title?: string }).title ?? "";

function mk(seed: number, stage: PlayerState["athlete"]["stage"], over: Partial<PlayerState["athlete"]> = {}, age = 25, sport = "Soccer") {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = age;
  p.education = { ...p.education, stage: "None", degrees: ["highschool"], grades: 70 };
  p.smarts = 60;
  p.health = 85;
  p.bankBalance = 500_000;
  p.fame = 50;
  Object.assign(p.athlete, { sport, stage, talent: 70, rating: 78, form: 55, consistency: 60, exposure: 50, years: 8, club: "Test FC", league: 2 }, over);
  return { p, rng };
}

const offer = (over: Partial<AthleteOffer> = {}): AthleteOffer => ({ id: "o1", kind: "pro", club: "Metro FC", league: 2, salary: 400_000, years: 4, bonus: 10_000, note: "", ...over });

function signed(seed: number, over: Partial<PlayerState["athlete"]> = {}, age = 25, sport = "Soccer") {
  const x = mk(seed, "pro", {}, age, sport);
  signContract(x.p, x.rng, offer({ club: "Test FC" }));
  Object.assign(x.p.athlete, over);
  return x;
}

function year(p: PlayerState, rng: Rng, effort: PlayerState["effort"] = "steady") {
  p.age += 1;
  p.year += 1;
  p.effort = effort;
  p.annual = {};
  const notices: Notices = [];
  processAthlete(p, rng, notices);
  return notices;
}

const deal = (over: Partial<EndorsementDeal> = {}): EndorsementDeal => ({ id: "d1", brand: "Stride", category: "apparel", pay: 50_000, years: 2, ...over });

describe("defaults and old saves", () => {
  it("a fresh athlete has sensible human-side defaults", () => {
    const a = newAthleteState();
    expect(a.mental).toBe(70);
    expect(a.image).toBe(60);
    expect(a.deals).toEqual([]);
    expect(a.natCall).toBeNull();
    expect(a.appeal).toBeNull();
    expect(a.rival).toBeNull();
    expect(a.hofYear).toBeNull();
  });

  it("an old save without the new fields loads with defaults and keeps its career", () => {
    const { p } = signed(1);
    const raw = JSON.parse(exportSave(p, 1)) as { v: 1; player: { athlete: Record<string, unknown> }; rngState: number };
    for (const k of ["mental", "chemistry", "coachRel", "captain", "playing", "transferReq", "image", "deals", "dealOffers", "natCall", "natPlan", "appeal", "rival", "narrative", "hofYear"]) delete raw.player.athlete[k];
    const back = parseSave(JSON.stringify(raw))!.player.athlete;
    expect(back.mental).toBe(70);
    expect(back.deals).toEqual([]);
    expect(back.dealOffers).toEqual([]);
    expect(back.natCall).toBeNull();
    expect(back.stage).toBe("pro");
    expect(back.club).toBe(p.athlete.club);
    expect(hydrateAthlete(undefined, p).image).toBe(60);
  });

  it("new fields survive a save round trip", () => {
    const { p, rng } = signed(2);
    p.athlete.deals = [deal()];
    p.athlete.rival = { name: "A B", heat: 40, wins: 1, losses: 2 };
    year(p, rng);
    const back = parseSave(exportSave(p, 1))!.player;
    expect(back.athlete).toEqual(p.athlete);
  });
});

describe("brand deals and image", () => {
  it("famous clean athletes get offers, unknowns and banned athletes do not", () => {
    let famous = 0;
    let unknown = 0;
    let banned = 0;
    for (let s = 0; s < 60; s++) {
      const a = signed(10 + s);
      famous += rollDealOffers(a.p, a.p.athlete, a.rng).length;
      const b = signed(10 + s);
      b.p.fame = 5;
      unknown += rollDealOffers(b.p, b.p.athlete, b.rng).length;
      const c = signed(10 + s);
      c.p.athlete.banYears = 2;
      banned += rollDealOffers(c.p, c.p.athlete, c.rng).length;
    }
    expect(famous).toBeGreaterThan(20);
    expect(unknown).toBe(0);
    expect(banned).toBe(0);
  });

  it("signing is limited by fame and category, and pays every season", () => {
    const { p, rng } = signed(20);
    p.fame = 30;
    p.athlete.dealOffers = [deal({ id: "x1" }), deal({ id: "x2", category: "drink", brand: "Surge" })];
    expect(maxDeals(p)).toBe(1);
    const one = signDeal(p, "x1").player;
    expect(one.athlete.deals).toHaveLength(1);
    expect(signDeal(one, "x2").player).toBe(one);
    expect(signDeal(one, "x1").player).toBe(one);
    one.fame = 80;
    one.athlete.dealOffers = [deal({ id: "x3", category: "apparel" }), deal({ id: "x4", category: "watch", brand: "Orsay" })];
    expect(signDeal(one, "x3").player).toBe(one); // same category
    const two = signDeal(one, "x4").player;
    expect(two.athlete.deals).toHaveLength(2);
    const before = two.bankBalance;
    const r = makeRng(5);
    const net = dealIncome(two, two.athlete, r, [], 400_000);
    expect(net).toBeGreaterThan(0);
    expect(net).toBeLessThan(two.athlete.deals.reduce((s, d) => s + d.pay, 0) + 1);
    expect(two.bankBalance).toBe(before); // the season pays through processAthlete, not here
    expect(rng).toBeTruthy();
  });

  it("deals run down and expire, and a season of income is recorded", () => {
    let paid = 0;
    for (let s = 0; s < 20; s++) {
      const { p, rng } = signed(30 + s);
      p.athlete.deals = [deal({ years: 2, category: "charity", pay: 20_000 })];
      const e0 = p.athlete.record.earnings;
      year(p, rng);
      paid += p.athlete.record.earnings - e0 > 400_000 ? 1 : 0;
      year(p, rng);
      expect(p.athlete.deals).toHaveLength(0);
    }
    expect(paid).toBeGreaterThan(10);
  });

  it("shady categories cause more scandals than safe ones, and scandals hurt your image", () => {
    const count = (cat: EndorsementDeal["category"]) => {
      let scandals = 0;
      let img = 0;
      for (let s = 0; s < 150; s++) {
        const { p, rng } = signed(40 + s);
        p.athlete.deals = [deal({ category: cat, years: 3 })];
        const n = year(p, rng);
        if (n.some((x) => titleOf(x).endsWith("Scandal"))) scandals++;
        img += p.athlete.image;
      }
      return { scandals, img };
    };
    const betting = count("betting");
    const apparel = count("apparel");
    const charity = count("charity");
    expect(betting.scandals).toBeGreaterThan(apparel.scandals);
    expect(charity.scandals).toBe(0);
    expect(charity.img).toBeGreaterThan(betting.img);
  });

  it("a worse image means thinner endorsements", () => {
    let good = 0;
    let bad = 0;
    for (let s = 0; s < 30; s++) {
      const g = signed(300 + s);
      g.p.athlete.image = 95;
      year(g.p, g.rng);
      good += g.p.athlete.endorsements;
      const b = signed(300 + s);
      b.p.athlete.image = 15;
      year(b.p, b.rng);
      bad += b.p.athlete.endorsements;
    }
    expect(good).toBeGreaterThan(bad);
  });

  it("dropping a deal costs half a season's fee and some image", () => {
    const { p } = signed(50);
    p.athlete.deals = [deal({ pay: 40_000 })];
    const res = dropDeal(p, "d1").player;
    expect(res.athlete.deals).toHaveLength(0);
    expect(res.bankBalance).toBe(p.bankBalance - 20_000);
    expect(res.athlete.image).toBeLessThan(p.athlete.image);
    p.athlete.dealOffers = [deal({ id: "z" })];
    expect(declineDeal(p, "z").player.athlete.dealOffers).toHaveLength(0);
  });

  it("the catalogue is coherent: risky money pays more", () => {
    expect(DEAL_KINDS.betting.pay).toBeGreaterThan(DEAL_KINDS.apparel.pay);
    expect(DEAL_KINDS.charity.pay).toBeLessThan(DEAL_KINDS.apparel.pay);
    expect(DEAL_KINDS.charity.risk).toBe(0);
  });
});

describe("national team cycle", () => {
  const preMajor = (seed: number, over: Partial<PlayerState["athlete"]> = {}) => {
    const x = signed(seed, { rating: 86, ...over });
    x.p.year = 2024; // soccer's World Cup is in 2026 (year % 4 === 2)
    return x;
  };

  it("the season before the tournament a qualified player is invited or snubbed", () => {
    let invited = 0;
    let snubbed = 0;
    for (let s = 0; s < 60; s++) {
      const { p, rng } = preMajor(60 + s);
      const n = year(p, rng);
      expect(p.year).toBe(2025);
      if (p.athlete.natCall) {
        expect(p.athlete.natCall.year).toBe(2026);
        if (p.athlete.natCall.selected) invited++;
        else snubbed++;
      }
      expect(n).toBeTruthy();
    }
    expect(invited).toBeGreaterThan(40);
    expect(invited + snubbed).toBe(60);
  });

  it("mediocre players are never invited", () => {
    for (let s = 0; s < 20; s++) {
      const { p, rng } = preMajor(100 + s, { rating: 55, league: 1 });
      year(p, rng);
      expect(p.athlete.natCall).toBeNull();
    }
  });

  const medalsFor = (plan: "allin" | "balanced" | "withdraw") => {
    let medals = 0;
    let comps = 0;
    for (let s = 0; s < 120; s++) {
      const { p, rng } = preMajor(200 + s, { rating: 88 });
      year(p, rng);
      if (!p.athlete.natCall?.selected) continue;
      p.athlete.natPlan = plan;
      const before = p.athlete.record.medals;
      const n = year(p, rng);
      expect(p.year).toBe(2026);
      medals += p.athlete.record.medals - before;
      if (n.some((x) => /World Cup/.test(titleOf(x)))) comps++;
      expect(p.athlete.natCall).toBeNull();
      expect(p.athlete.natPlan).toBe("balanced");
    }
    return { medals, comps };
  };

  it("withdrawing means no medal; going all in beats a balanced approach", () => {
    const w = medalsFor("withdraw");
    const b = medalsFor("balanced");
    const all = medalsFor("allin");
    expect(w.medals).toBe(0);
    expect(b.medals).toBeGreaterThan(0);
    expect(all.medals).toBeGreaterThan(b.medals);
  });

  it("a snubbed player doesn't play the tournament", () => {
    let medals = 0;
    for (let s = 0; s < 40; s++) {
      const { p, rng } = preMajor(400 + s, { rating: 90 });
      p.year = 2025;
      p.athlete.natCall = { year: 2026, major: "World Cup", selected: false };
      year(p, rng);
      medals += p.athlete.record.medals;
    }
    expect(medals).toBe(0);
  });

  it("choosing a plan needs an invitation, and all-in costs relationships and money", () => {
    const { p } = preMajor(500);
    expect(setNationalPlan(p, "allin").player).toBe(p);
    p.athlete.natCall = { year: 2026, major: "World Cup", selected: true };
    p.bankBalance = 1_000;
    expect(setNationalPlan(p, "allin").player).toBe(p);
    p.bankBalance = 500_000;
    const res = setNationalPlan(p, "allin").player;
    expect(res.athlete.natPlan).toBe("allin");
    p.athlete.natCall.selected = false;
    expect(setNationalPlan(p, "withdraw").player).toBe(p);
  });

  it("all-in raises injury risk through the tournament year", () => {
    let balanced = 0;
    let allIn = 0;
    for (let s = 0; s < 150; s++) {
      for (const plan of ["balanced", "allin"] as const) {
        const { p, rng } = preMajor(600 + s, { rating: 88 });
        p.year = 2025;
        p.athlete.natCall = { year: 2026, major: "World Cup", selected: true };
        p.athlete.natPlan = plan;
        year(p, rng);
        if (p.athlete.record.injuries > 0) {
          if (plan === "allin") allIn++;
          else balanced++;
        }
      }
    }
    expect(allIn).toBeGreaterThanOrEqual(balanced);
  });
});

describe("locker room", () => {
  it("good players start, weak ones sit", () => {
    let star = 0;
    let scrub = 0;
    for (let s = 0; s < 40; s++) {
      const a = signed(700 + s, { rating: 92 });
      rollPlaying(a.p, a.p.athlete, a.rng);
      star += a.p.athlete.playing;
      const b = signed(700 + s, { rating: 66 });
      rollPlaying(b.p, b.p.athlete, b.rng);
      scrub += b.p.athlete.playing;
    }
    expect(star).toBeGreaterThan(scrub);
  });

  it("individual sports always play and never use the bench", () => {
    const { p, rng } = signed(710, { rating: 60 }, 25, "Tennis");
    rollPlaying(p, p.athlete, rng);
    expect(p.athlete.playing).toBe(100);
  });

  it("chemistry, coach and minutes shift the season score", () => {
    const { p } = signed(711);
    Object.assign(p.athlete, { chemistry: 90, coachRel: 90, playing: 95, captain: true });
    const hi = seasonModifiers(p.athlete);
    Object.assign(p.athlete, { chemistry: 10, coachRel: 10, playing: 10, captain: false });
    const lo = seasonModifiers(p.athlete);
    expect(hi.bonus).toBeGreaterThan(lo.bonus);
    expect(hi.fameScale).toBeGreaterThan(lo.fameScale);
  });

  it("a team dinner builds chemistry once a year; talking to the coach can help or backfire", () => {
    const { p, rng } = signed(712);
    p.athlete.chemistry = 40;
    const dined = teamDinner(p, rng).player;
    expect(dined.athlete.chemistry).toBeGreaterThan(40);
    expect(dined.bankBalance).toBeLessThan(p.bankBalance);
    expect(teamDinner(dined, rng).player).toBe(dined);
    let up = 0;
    let down = 0;
    for (let s = 0; s < 60; s++) {
      const x = signed(720 + s);
      const r = talkToCoach(x.p, x.rng).player;
      if (r.athlete.coachRel > x.p.athlete.coachRel) up++;
      if (r.athlete.coachRel < x.p.athlete.coachRel) down++;
    }
    expect(up).toBeGreaterThan(down);
    expect(down).toBeGreaterThan(0);
  });

  it("captaincy needs a team sport, a pro deal, time at the club and a dressing room that backs you", () => {
    const { p, rng } = signed(730);
    expect(captainBlocker(p)).toMatch(/time|chemistry/i);
    p.athlete.stageYears = 4;
    p.athlete.chemistry = 80;
    expect(captainBlocker(p)).toBeNull();
    let won = 0;
    for (let s = 0; s < 40; s++) {
      const x = signed(740 + s, { stageYears: 4, chemistry: 80, coachRel: 70 });
      if (runForCaptain(x.p, x.rng).player.athlete.captain) won++;
    }
    expect(won).toBeGreaterThan(10);
    expect(won).toBeLessThan(40);
    const tennis = signed(731, { stageYears: 4, chemistry: 90 }, 25, "Tennis");
    expect(captainBlocker(tennis.p)).toMatch(/Individual/);
    expect(rng).toBeTruthy();
  });

  it("moving to a new club resets chemistry, coach and the armband", () => {
    const { p, rng } = signed(750, { chemistry: 90, coachRel: 90, captain: true });
    signContract(p, rng, offer({ club: "Elsewhere United", kind: "transfer" }));
    expect(p.athlete.chemistry).toBeLessThan(60);
    expect(p.athlete.coachRel).toBeLessThan(60);
    expect(p.athlete.captain).toBe(false);
    signContract(p, rng, offer({ club: "Elsewhere United", kind: "renew" }));
    p.athlete.chemistry = 80;
    signContract(p, rng, offer({ club: "Elsewhere United", kind: "renew" }));
    expect(p.athlete.chemistry).toBe(80);
  });

  it("a transfer request is a gamble: it often produces an offer, sometimes a frozen-out refusal", () => {
    let offers = 0;
    let refused = 0;
    for (let s = 0; s < 60; s++) {
      const { p, rng } = signed(760 + s);
      const req = requestTransfer(p).player;
      expect(req.athlete.transferReq).toBe(true);
      expect(req.athlete.coachRel).toBeLessThan(p.athlete.coachRel);
      const n = year(req, rng);
      expect(req.athlete.transferReq).toBe(false);
      if (req.athlete.offers.some((o) => o.note.includes("agreed to let you go"))) offers++;
      if (n.some((x) => titleOf(x) === "Request Refused")) refused++;
    }
    expect(offers).toBeGreaterThan(15);
    expect(refused).toBeGreaterThan(5);
    expect(offers + refused).toBe(60);
  });
});

describe("mind", () => {
  it("grinding wears morale down and coasting restores it; therapy lifts it once a year", () => {
    let grind = 0;
    let coast = 0;
    for (let s = 0; s < 40; s++) {
      const a = signed(800 + s);
      for (let i = 0; i < 3; i++) year(a.p, a.rng, "grind");
      grind += a.p.athlete.mental;
      const b = signed(800 + s);
      for (let i = 0; i < 3; i++) year(b.p, b.rng, "coast");
      coast += b.p.athlete.mental;
    }
    expect(coast).toBeGreaterThan(grind);
    const { p, rng } = signed(850, { mental: 30 });
    const th = seeTherapist(p, rng).player;
    expect(th.athlete.mental).toBeGreaterThan(30);
    expect(seeTherapist(th, rng).player).toBe(th);
  });

  it("collapsed morale ends in burnout, which resets it and costs sharpness", () => {
    let burned = 0;
    for (let s = 0; s < 40; s++) {
      const { p, rng } = signed(860 + s, { mental: 8 });
      const rating = p.athlete.rating;
      year(p, rng, "grind");
      if (p.flags.includes("ath_burnout")) {
        burned++;
        expect(p.athlete.mental).toBeGreaterThan(8);
        expect(p.athlete.rating).toBeLessThan(rating + 3);
      }
    }
    expect(burned).toBeGreaterThan(5);
  });
});

describe("doping appeal", () => {
  const caught = (seed: number) => {
    for (let s = 0; s < 40; s++) {
      const x = signed(seed + s, { rating: 90, doping: true, league: 3 });
      x.p.athlete.record.titles = 3;
      x.p.athlete.dopeTitles = 3;
      for (let i = 0; i < 10 && !x.p.athlete.appeal; i++) year(x.p, x.rng);
      if (x.p.athlete.appeal) return x;
    }
    throw new Error("nobody was caught");
  };

  it("a first positive test can be contested for the rest of the year only", () => {
    const x = caught(900);
    const ap = x.p.athlete.appeal!;
    expect(ap.ban).toBeGreaterThanOrEqual(2);
    expect(ap.cost).toBeGreaterThan(0);
    expect(appealBlocker(x.p)).toBeNull();
    x.p.bankBalance = 10;
    expect(appealBlocker(x.p)).toMatch(/cost/i);
    x.p.bankBalance = 500_000;
    year(x.p, x.rng);
    expect(x.p.athlete.appeal).toBeNull();
    expect(appealBan(x.p, x.rng).player).toBe(x.p);
  });

  it("appeals sometimes halve the ban and sometimes add a year", () => {
    let won = 0;
    let lost = 0;
    for (let s = 0; s < 80; s++) {
      const { p, rng } = signed(950 + s);
      p.athlete.banYears = 4;
      p.athlete.appeal = { ban: 4, stripped: 2, cost: 10_000 };
      const res = appealBan(p, rng).player;
      expect(res.athlete.appeal).toBeNull();
      expect(res.bankBalance).toBe(p.bankBalance - 10_000);
      if (res.athlete.banYears === 2) won++;
      if (res.athlete.banYears === 5) lost++;
    }
    expect(won).toBeGreaterThan(10);
    expect(lost).toBeGreaterThan(10);
    expect(won + lost).toBe(80);
  });

  it("bans now run down while you wait, instead of lasting forever", () => {
    const { p, rng } = signed(1000, { rating: 80 });
    p.athlete.banYears = 2;
    p.athlete.stage = "pro";
    p.currentJob = null;
    p.athlete.freeAgent = true;
    year(p, rng);
    year(p, rng);
    expect(p.athlete.banYears).toBe(0);
    expect(p.athlete.freeAgentYears).toBeLessThanOrEqual(1);
  });
});

describe("rehab choices", () => {
  const injured = (seed: number, sev = 3) => {
    const x = signed(seed);
    x.p.athlete.injury = { label: "ACL rupture", severity: sev, yearsLeft: 2, plan: "rest", ratingLoss: 4, decided: false, age: x.p.age };
    return x;
  };

  it("rushing back takes a season off the layoff but increases the lasting damage", () => {
    const { p, rng } = injured(1100);
    expect(treatmentBlocker(p, "rush")).toBeNull();
    const res = chooseTreatment(p, "rush", rng).player;
    expect(res.athlete.injury!.yearsLeft).toBe(1);
    expect(res.athlete.injury!.ratingLoss).toBeGreaterThan(4);
    expect(res.athlete.injury!.rushed).toBe(true);
    expect(chooseTreatment(res, "rehab", rng).player).toBe(res);
  });

  it("minor knocks and nearly healed injuries can't be rushed", () => {
    const a = injured(1101, 1);
    expect(treatmentBlocker(a.p, "rush")).toMatch(/minor/i);
    const b = injured(1102, 3);
    b.p.athlete.injury!.yearsLeft = 0;
    expect(treatmentBlocker(b.p, "rush")).toMatch(/next season/i);
  });

  it("rushing sometimes ends in a relapse that costs the season; patience never does", () => {
    const run = (plan: "rush" | "rehab") => {
      let relapses = 0;
      let backEarly = 0;
      for (let s = 0; s < 120; s++) {
        const { p, rng } = injured(1200 + s);
        const q = chooseTreatment(p, plan, rng).player;
        const n = year(q, rng);
        if (n.some((x) => titleOf(x) === "Setback")) relapses++;
        const n2 = year(q, rng);
        if (n2.some((x) => titleOf(x) === "Setback")) relapses++;
        if (q.athlete.history.at(-1)?.summary && !/Missed the season/.test(q.athlete.history.at(-1)!.summary)) backEarly++;
      }
      return { relapses, backEarly };
    };
    const rush = run("rush");
    const rehab = run("rehab");
    expect(rush.relapses).toBeGreaterThan(10);
    expect(rehab.relapses).toBe(0);
    expect(rush.backEarly).toBeGreaterThanOrEqual(rehab.backEarly);
  });
});

describe("rivalry", () => {
  it("rivals appear in the pros, keep a record, and can be inflamed or calmed", () => {
    let rivals = 0;
    for (let s = 0; s < 60; s++) {
      const { p, rng } = signed(1300 + s, { rating: 80 });
      p.athlete.record.proSeasons = 3;
      for (let i = 0; i < 6; i++) year(p, rng);
      if (p.athlete.rival) {
        rivals++;
        expect(p.athlete.rival.heat).toBeGreaterThanOrEqual(0);
        expect(p.athlete.rival.wins + p.athlete.rival.losses).toBeGreaterThanOrEqual(0);
      }
    }
    expect(rivals).toBeGreaterThan(5);
    const { p } = signed(1400);
    expect(fuelRivalry(p).player).toBe(p); // no rival
    p.athlete.rival = { name: "Marco Rossi", heat: 40, wins: 0, losses: 0 };
    const hot = fuelRivalry(p).player;
    expect(hot.athlete.rival!.heat).toBeGreaterThan(40);
    expect(hot.athlete.image).toBeLessThan(p.athlete.image);
    expect(fuelRivalry(hot).player).toBe(hot);
    const calm = makePeace(p).player;
    expect(calm.athlete.rival!.heat).toBeLessThan(40);
    expect(calm.athlete.image).toBeGreaterThan(p.athlete.image);
  });
});

describe("legacy and the Hall of Fame", () => {
  const legend = (seed: number) => {
    const { p, rng } = mk(seed, "retired", { rating: 60 });
    Object.assign(p.athlete.record, { seasons: 16, proSeasons: 14, titles: 9, awards: 4, medals: 2, caps: 80, bestRating: 93, peakSalary: 5_000_000, earnings: 40_000_000 });
    p.fame = 85;
    p.athlete.retiredAge = 36;
    p.age = 41;
    return { p, rng };
  };

  it("scores grow with achievements and shrink with scandal", () => {
    const { p } = legend(1500);
    const base = legacyScore(p);
    expect(base).toBeGreaterThan(100);
    expect(legacyTier(base)[1]).toMatch(/Icon|Legend/);
    p.flags.push("doping_caught");
    expect(legacyScore(p)).toBeLessThan(base - 40);
    const empty = mk(1501, "pro", {}).p;
    empty.athlete.record.seasons = 0;
    expect(legacyScore(empty)).toBe(0);
    expect(legacyTier(0)[1]).toBe("Footnote");
  });

  it("great careers are inducted at the ballot, tainted ones never are, and short ones aren't on it", () => {
    expect(BALLOT_YEARS).toEqual([5, 10]);
    const { p, rng } = legend(1502);
    const n: Notices = [];
    hallBallot(p, p.athlete, rng, n, 3);
    expect(p.athlete.hofYear).toBeNull();
    let inducted = 0;
    for (let s = 0; s < 20; s++) {
      const x = legend(1510 + s);
      hallBallot(x.p, x.p.athlete, x.rng, [], 5);
      if (x.p.athlete.hofYear !== null) {
        inducted++;
        expect(x.p.flags).toContain("hall_of_fame");
      }
    }
    expect(inducted).toBeGreaterThan(10);
    const dirty = legend(1503);
    dirty.p.flags.push("doping_caught");
    hallBallot(dirty.p, dirty.p.athlete, dirty.rng, [], 5);
    expect(dirty.p.athlete.hofYear).toBeNull();
    const mid = mk(1504, "retired", {}, 45);
    Object.assign(mid.p.athlete.record, { seasons: 4, titles: 0, bestRating: 70 });
    hallBallot(mid.p, mid.p.athlete, mid.rng, [], 5);
    expect(mid.p.athlete.hofYear).toBeNull();
  });

  it("retirement years trigger the ballot automatically through the yearly processing", () => {
    let inducted = 0;
    for (let s = 0; s < 20; s++) {
      const { p, rng } = legend(1600 + s);
      p.athlete.retiredAge = p.age - 4;
      const n = year(p, rng);
      if (p.athlete.hofYear !== null) {
        inducted++;
        expect(n.some((x) => titleOf(x) === "Hall of Fame")).toBe(true);
      }
    }
    expect(inducted).toBeGreaterThan(8);
  });

  it("the career summary lists clubs, highlights and scandals", () => {
    const { p, rng } = signed(1700);
    for (let i = 0; i < 4; i++) year(p, rng);
    p.flags.push("doping_caught");
    const s = careerSummary(p);
    expect(s.clubs.length).toBeGreaterThan(0);
    expect(s.highlights.length).toBeGreaterThan(0);
    expect(s.scandals.join(" ")).toMatch(/doping/i);
    expect(s.inducted).toBe(false);
  });
});

describe("life after the game", () => {
  it("a famous retiree can found an academy using the business engine", () => {
    const { p, rng } = mk(1800, "retired", {}, 40);
    p.athlete.record.proSeasons = 10;
    p.athlete.post = "none";
    p.currentJob = null;
    p.fame = 70;
    p.bankBalance = 2_000_000;
    expect(academyBlocker(p)).toBeNull();
    const res = startAcademy(p, rng).player;
    expect(res.business).toBeTruthy();
    expect(res.business!.name).toMatch(/Academy/);
    expect(res.athlete.post).toBe("academy");
    expect(res.bankBalance).toBeLessThan(p.bankBalance);
    expect(academyBlocker(res)).toMatch(/already/);
    expect(startAcademy(res, rng).player).toBe(res);
  });

  it("it isn't available while playing, or without money or a name", () => {
    const active = signed(1801);
    expect(academyBlocker(active.p)).toMatch(/retired/);
    const poor = mk(1802, "retired", {}, 40);
    poor.p.bankBalance = 100;
    poor.p.fame = 50;
    expect(academyBlocker(poor.p)).toMatch(/costs/);
    const nobody = mk(1803, "retired", {}, 40);
    nobody.p.fame = 2;
    nobody.p.athlete.record.proSeasons = 0;
    expect(academyBlocker(nobody.p)).toMatch(/name/);
  });

  it("running an academy doesn't reset the post when the year turns over", () => {
    const { p, rng } = mk(1804, "retired", {}, 40);
    p.athlete.record.proSeasons = 10;
    p.currentJob = null;
    p.fame = 70;
    p.bankBalance = 2_000_000;
    const res = startAcademy(p, rng).player;
    year(res, rng);
    expect(res.athlete.post).toBe("academy");
  });

  it("retirement plans mature into a nest egg", () => {
    const { p } = signed(1805);
    p.flags.push("ath:planned");
    p.athlete.record.earnings = 8_000_000;
    p.athlete.record.proSeasons = 10;
    p.athlete.contractYears = 0;
    p.athlete.expiring = true;
    const before = p.bankBalance;
    const res = retireFromSport(p).player;
    expect(res.bankBalance).toBeGreaterThan(before + 300_000);
    const unplanned = signed(1805);
    unplanned.p.athlete.record.earnings = 8_000_000;
    unplanned.p.athlete.record.proSeasons = 10;
    unplanned.p.athlete.contractYears = 0;
    unplanned.p.athlete.expiring = true;
    expect(retireFromSport(unplanned.p).player.bankBalance).toBeLessThan(res.bankBalance);
  });
});

describe("new events", () => {
  const ids = ["ath_academy_pressure", "ath_parent_manager", "ath_locker_feud", "ath_new_system", "ath_salary_cap", "ath_bidding_war", "ath_profile_piece", "ath_old_posts", "ath_rival_taunt", "ath_burnout_crossroads", "ath_second_opinion", "ath_casino_trip", "ath_surprise_test", "ath_financial_adviser", "ath_after_the_roar", "ath_academy_visit"];

  it("every new event exists with a unique id and resolves cleanly for every option", () => {
    for (const id of ids) {
      const e = EVENT_BY_ID[id];
      expect(e, id).toBeTruthy();
      for (let i = 0; i < e.options.length; i++) {
        for (const stage of ["youth", "pro", "retired"] as const) {
          const { p, rng } = mk(2000 + i, stage, { doping: true, mental: 20, rival: { name: "X Y", heat: 50, wins: 1, losses: 1 } }, stage === "youth" ? 16 : 30);
          if (stage === "pro") signContract(p, rng, offer());
          p.athlete.injury = { label: "Knee", severity: 3, yearsLeft: 1, plan: "rest", ratingLoss: 3, decided: false, age: 30 };
          p.athlete.offers = [offer({ id: "a" }), offer({ id: "b", club: "Other FC" })];
          for (const twice of [false, true]) {
            const res = resolveEvent(p, e, i, rng);
            expect(res.player, `${id}/${i}/${stage}`).toBeTruthy();
            const q = res.player;
            expect(q.athlete.mental).toBeGreaterThanOrEqual(0);
            expect(q.athlete.mental).toBeLessThanOrEqual(100);
            expect(q.athlete.image).toBeLessThanOrEqual(100);
            year(q, rng);
            if (!twice) continue;
          }
        }
      }
    }
    const all = Object.keys(EVENT_BY_ID);
    expect(new Set(all).size).toBe(all.length);
  });

  it("the masking-agent gamble can end a doper's career", () => {
    let flagged = 0;
    for (let s = 0; s < 40; s++) {
      const { p, rng } = signed(2100 + s, { doping: true });
      const res = resolveEvent(p, EVENT_BY_ID.ath_surprise_test, 0, rng).player;
      if (res.flags.includes("doping_caught")) flagged++;
    }
    expect(flagged).toBeGreaterThan(5);
    expect(flagged).toBeLessThan(40);
  });

  it("the bidding war can lift every contract offer", () => {
    let lifted = 0;
    for (let s = 0; s < 40; s++) {
      const { p, rng } = signed(2200 + s);
      p.athlete.expiring = true;
      p.athlete.agent = true;
      p.athlete.offers = [offer({ id: "a", salary: 100_000 }), offer({ id: "b", salary: 120_000 })];
      const res = resolveEvent(p, EVENT_BY_ID.ath_bidding_war, 0, rng).player;
      if (res.athlete.offers.length === 2 && res.athlete.offers[0].salary > 100_000) lifted++;
    }
    expect(lifted).toBeGreaterThan(10);
  });
});

describe("full careers never throw and keep the numbers sane", () => {
  it("many seeds, every sport, with the new decisions mixed in", () => {
    for (let s = 0; s < 14; s++) {
      const rng = makeRng(3000 + s);
      let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
      for (let g = 0; g < 75 && p.alive; g++) {
        const res = ageUp(p, rng);
        p = res.player;
        for (const n of (res.notices ?? []) as Notice[]) if (n.kind === "event" && p.alive) p = resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng).player;
        if (p.pendingTrial) break;
        if (p.age === 9 && p.athlete.stage === "none") p = signWithClub(p, SPORTS[s % SPORTS.length], rng).player;
        const a = p.athlete;
        if (a.stage !== "none") {
          p = seeTherapist(p, rng).player;
          if (g % 3 === 0) p = teamDinner(p, rng).player;
          if (g % 4 === 0) p = talkToCoach(p, rng).player;
          if (g % 5 === 0) p = runForCaptain(p, rng).player;
          if (g % 7 === 0) p = requestTransfer(p).player;
          if (p.athlete.natCall) p = setNationalPlan(p, (["allin", "balanced", "withdraw"] as const)[g % 3]).player;
          if (p.athlete.dealOffers[0]) p = signDeal(p, p.athlete.dealOffers[0].id).player;
          if (p.athlete.appeal) p = appealBan(p, rng).player;
          if (p.athlete.injury && g % 2 === 0) p = chooseTreatment(p, "rush", rng).player;
          if (p.athlete.rival) p = (g % 2 ? fuelRivalry(p) : makePeace(p)).player;
        }
        const o = p.athlete.offers[0];
        if (o) p = acceptOffer(p, o.id, rng).player;
        const at = p.athlete;
        for (const v of [at.mental, at.image, at.chemistry, at.coachRel, at.playing]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
        expect(Number.isFinite(p.bankBalance)).toBe(true);
        expect(at.deals.length).toBeLessThanOrEqual(4);
      }
      expect(p.age).toBeGreaterThan(0);
    }
  }, 240_000);

  it("a dedicated bot who reaches the pros ends with a coherent career summary", () => {
    let pros = 0;
    for (let s = 0; s < 14; s++) {
      const { p, rng } = mk(4000 + s, "youth", { rating: 40, talent: 85, years: 4, league: 0, exposure: 80 }, 15, SPORTS[s % SPORTS.length]);
      p.athlete.club = "Juniors";
      let q = p;
      for (let g = 0; g < 28 && q.alive; g++) {
        q = ageUp(q, rng).player;
        q.effort = "grind";
        const o = q.athlete.offers[0];
        if (o) q = acceptOffer(q, o.id, rng).player;
        if (q.athlete.stage === "pro") pros++;
      }
      const sum = careerSummary(q);
      expect(Number.isFinite(sum.score)).toBe(true);
      expect(sum.tier.length).toBeGreaterThan(0);
    }
    expect(pros).toBeGreaterThan(5);
  }, 240_000);
});
