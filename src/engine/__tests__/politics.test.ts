import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { makeJob } from "../career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import {
  TERM_LIMITS,
  ambassadorBlocker,
  canRun,
  electionOdds,
  handleScandal,
  joinParty,
  lobbyBlocker,
  partyWork,
  politicalMemoir,
  processPolitics,
  pushPolicy,
  raiseFunds,
  retireFromOffice,
  runForOffice,
  seekEndorsement,
  selfFund,
  setStance,
  stanceFit,
  takeKickback,
  takeRetirementPath,
} from "../politics";
import { resolveTrial } from "../crime";
import type { PlayerState } from "@/types/game.types";

const pol = (seed = 1, tier = -1) => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: { athletic: 50, musical: 50, acting: 50, charisma: 50, business: 50, discipline: 50 } }, rng);
  p.age = 45;
  p.smarts = 80;
  p.education.degrees = ["highschool"];
  p.bankBalance = 500_000;
  if (tier >= 0) {
    p.currentJob = makeJob(CAREER_BY_ID.politics, tier, rng);
    p.statecraft.highestTier = tier;
  }
  return { rng, p };
};
const fresh = (p: PlayerState): PlayerState => JSON.parse(JSON.stringify(p));

describe("campaign finance", () => {
  it("fundraising fills the war chest; business money comes with strings, grassroots does not", () => {
    const { p } = pol(1);
    let business: PlayerState | null = null;
    let grass: PlayerState | null = null;
    for (let s = 0; s < 30; s++) {
      if (!business) {
        const out = raiseFunds(fresh(p), makeRng(s), "business").player;
        if (out.statecraft.funds > 0) business = out;
      }
      if (!grass) {
        const out = raiseFunds(fresh(p), makeRng(s), "grassroots").player;
        if (out.statecraft.funds > 0) grass = out;
      }
    }
    expect(business!.statecraft.funds).toBeGreaterThan(grass!.statecraft.funds);
    expect(business!.statecraft.donors[0]).toMatchObject({ kind: "business", issue: "economy", stance: 1 });
    expect(grass!.statecraft.donors).toHaveLength(0);
    // Once per source per year.
    expect(raiseFunds(business!, makeRng(99), "business").player).toBe(business);
  });
  it("donors abandon you if you cross their position", () => {
    const { p } = pol(2, 1);
    p.skills.charisma = 0;
    p.economy.climate = "recession";
    p.statecraft.funds = 50_000;
    p.statecraft.donors = [{ id: "d", name: "Big Business", kind: "business", given: 40_000, issue: "economy", stance: 1, year: p.year }];
    p.statecraft.stances.economy = -1;
    const pop0 = p.politics.popularity;
    const notices: Parameters<typeof processPolitics>[2] = [];
    processPolitics(p, makeRng(3), notices);
    expect(p.statecraft.donors).toHaveLength(0);
    expect(p.statecraft.funds).toBeLessThan(50_000);
    expect(p.politics.popularity).toBeLessThan(pop0);
    expect(notices.some((n) => "title" in n && n.title === "Donor Revolt")).toBe(true);
    // Honouring the donor keeps them.
    const q = pol(2, 1).p;
    q.statecraft.donors = [{ id: "d", name: "Big Business", kind: "business", given: 40_000, issue: "economy", stance: 1, year: q.year }];
    q.statecraft.stances.economy = 1;
    processPolitics(q, makeRng(3), []);
    expect(q.statecraft.donors).toHaveLength(1);
  });
  it("campaigns spend the war chest before your savings; self-funding moves savings in", () => {
    const { p } = pol(3);
    p.statecraft.funds = 30_000;
    const bank0 = p.bankBalance;
    const out = runForOffice(p, makeRng(1)).player;
    expect(out.statecraft.funds).toBe(25_000);
    expect(out.bankBalance).toBe(bank0);
    const funded = selfFund(p, 20_000).player;
    expect(funded.statecraft.funds).toBe(50_000);
    expect(funded.bankBalance).toBe(bank0 - 20_000);
    const poor = pol(3).p;
    poor.bankBalance = 1_000;
    expect(canRun(poor).ok).toBe(false);
    poor.statecraft.funds = 10_000;
    expect(canRun(poor).ok).toBe(true);
  });
  it("war chest surplus lifts the odds", () => {
    const { p } = pol(4);
    const base = electionOdds(p, 0).chance;
    p.statecraft.funds = 30_000;
    expect(electionOdds(p, 0).chance).toBeGreaterThan(base);
  });
});

describe("the party machine and positions", () => {
  it("joining adopts the platform; straying costs standing, matching earns it", () => {
    const { p } = pol(5);
    const joined = joinParty(p, "conservative").player;
    expect(joined.statecraft.stances.economy).toBe(1);
    const strayed = setStance(joined, "economy", -1).player;
    expect(strayed.statecraft.machine).toBeLessThan(joined.statecraft.machine);
    const back = setStance(strayed, "economy", 1).player;
    expect(back.politics.popularity).toBeLessThan(strayed.politics.popularity); // flip-flop
    const worked = partyWork(joined).player;
    expect(worked.statecraft.machine).toBe(joined.statecraft.machine + 8);
    expect(partyWork(worked).player).toBe(worked);
  });
  it("endorsements need a party and add odds", () => {
    const { p } = pol(6);
    expect(seekEndorsement(p, makeRng(1)).player).toBe(p);
    const joined = joinParty(p, "centrist").player;
    joined.statecraft.machine = 90;
    let endorsed: PlayerState | null = null;
    for (let s = 0; s < 20 && !endorsed; s++) {
      const out = seekEndorsement(fresh(joined), makeRng(s)).player;
      if (out.statecraft.endorsed) endorsed = out;
    }
    expect(endorsed).not.toBeNull();
    expect(electionOdds(endorsed!, 0).chance).toBeGreaterThan(electionOdds(joined, 0).chance);
  });
  it("positions that match the public mood help; opposing it hurts", () => {
    const { p } = pol(7);
    p.statecraft.mood = { economy: 0.8, health: -0.8, environment: 0, security: 0, liberty: 0 };
    p.statecraft.stances = { economy: 1, health: -1, environment: 0, security: 0, liberty: 0 };
    const aligned = stanceFit(p);
    p.statecraft.stances = { economy: -1, health: 1, environment: 0, security: 0, liberty: 0 };
    expect(aligned).toBeGreaterThan(stanceFit(p));
  });
});

describe("holding office", () => {
  it("term limits push mayors out after three terms", () => {
    expect(TERM_LIMITS[1]).toBe(3);
    const { p } = pol(10, 1);
    p.statecraft.termsInOffice = 2;
    p.politics.yearsInOffice = 3;
    p.politics.popularity = 90;
    const notices: Parameters<typeof processPolitics>[2] = [];
    processPolitics(p, makeRng(1), notices);
    expect(p.currentJob).toBeNull();
    expect(notices.some((n) => "title" in n && n.title === "Term-Limited")).toBe(true);
  });
  it("senators have no term limit: a popular one is re-elected, an unpopular one is not", () => {
    let kept = 0;
    let lost = 0;
    for (let s = 0; s < 40; s++) {
      const a = pol(300 + s, 3).p;
      a.statecraft.termsInOffice = 5;
      a.politics.yearsInOffice = 3;
      a.politics.popularity = 95;
      a.fame = 80;
      processPolitics(a, makeRng(s), []);
      if (a.currentJob) kept++;
      const b = pol(300 + s, 3).p;
      b.politics.yearsInOffice = 3;
      b.politics.popularity = 5;
      b.economy.climate = "recession";
      processPolitics(b, makeRng(s), []);
      if (!b.currentJob) lost++;
    }
    expect(kept).toBeGreaterThan(25);
    expect(lost).toBeGreaterThan(15);
  });
  it("effort matters: coasting costs approval, grinding earns it", () => {
    const coast = pol(11, 1).p;
    coast.effort = "coast";
    const grind = pol(11, 1).p;
    grind.effort = "grind";
    for (const q of [coast, grind]) {
      q.politics.popularity = 50;
      q.statecraft.mood = { economy: 0, health: 0, environment: 0, security: 0, liberty: 0 };
      processPolitics(q, makeRng(5), []);
    }
    expect(grind.politics.popularity).toBeGreaterThan(coast.politics.popularity + 4);
  });
  it("the economy moves approval", () => {
    const boom = pol(12, 2).p;
    boom.economy.climate = "boom";
    const bust = pol(12, 2).p;
    bust.economy.climate = "recession";
    for (const q of [boom, bust]) {
      q.politics.popularity = 50;
      processPolitics(q, makeRng(5), []);
    }
    expect(boom.politics.popularity).toBeGreaterThan(bust.politics.popularity + 5);
  });
  it("legislation passes more often with party standing, a coalition and effort", () => {
    const strong = pol(13, 2).p;
    strong.statecraft.stances.economy = 1;
    strong.statecraft.machine = 90;
    strong.statecraft.coalition = 90;
    strong.politics.popularity = 70;
    const weak = fresh(strong);
    weak.statecraft.machine = 5;
    weak.statecraft.coalition = 5;
    weak.politics.popularity = 20;
    let a = 0;
    let b = 0;
    for (let s = 0; s < 60; s++) {
      if (pushPolicy(fresh(strong), makeRng(s), "economy").player.statecraft.policyWins > 0) a++;
      if (pushPolicy(fresh(weak), makeRng(s), "economy").player.statecraft.policyWins > 0) b++;
    }
    expect(a).toBeGreaterThan(b + 15);
    expect(pushPolicy(pol(13, 2).p, makeRng(1), "economy").player.statecraft.policyWins).toBe(0); // no stance, no bill
  });
  it("a collapsing approval rating gets you recalled or impeached", () => {
    let removed = 0;
    for (let s = 0; s < 60; s++) {
      const p = pol(400 + s, s % 2 ? 1 : 3).p;
      p.politics.popularity = 4;
      p.statecraft.lowYears = 1;
      p.statecraft.machine = 10;
      processPolitics(p, makeRng(s), []);
      if (!p.currentJob) removed++;
    }
    expect(removed).toBeGreaterThan(10);
  });
  it("scandals can be contained or end careers; resigning ends it at once", () => {
    const { p } = pol(14, 1);
    p.statecraft.scandal = { kind: "affair", title: "Affair exposed", severity: 2, year: p.year };
    const resigned = handleScandal(p, makeRng(1), "resign").player;
    expect(resigned.currentJob).toBeNull();
    expect(resigned.statecraft.scandal).toBeNull();
    let contained = 0;
    for (let s = 0; s < 40; s++) {
      const out = handleScandal(fresh(p), makeRng(s), "apologise").player;
      if (!out.statecraft.scandal) contained++;
    }
    expect(contained).toBeGreaterThan(10);
    expect(contained).toBeLessThan(40);
    // A live scandal hurts election odds.
    const clean = pol(14, 1).p;
    p.politics.popularity = 80;
    clean.politics.popularity = 80;
    expect(electionOdds(p, 2).chance).toBeLessThan(electionOdds(clean, 2).chance);
  });
});

describe("corruption", () => {
  it("kickbacks pay, but leave bribes on the books that prosecutors can find and seize", () => {
    const { p } = pol(20, 2);
    const out = takeKickback(p, makeRng(1)).player;
    expect(out.bankBalance).toBeGreaterThan(p.bankBalance);
    expect(out.statecraft.bribes).toBeGreaterThan(0);
    expect(out.justice.proceeds).toBe(out.statecraft.bribes);
    expect(takeKickback(out, makeRng(2)).player).toBe(out);
    // Strong case: indicted, removed from office, and tried.
    const q = fresh(out);
    q.statecraft.investigation = { kind: "corruption", yearsLeft: 1, evidence: 90 };
    processPolitics(q, makeRng(3), []);
    expect(q.currentJob).toBeNull();
    expect(q.pendingTrial?.name).toBe("Corruption in Office");
    const bank0 = q.bankBalance;
    const convicted = resolveTrial(q, "plea", makeRng(4)).player;
    expect(convicted.justice.proceeds).toBe(0);
    expect(convicted.bankBalance).toBeLessThan(bank0);
  });
  it("weak cases end in vindication; middling ones in censure", () => {
    const weak = pol(21, 2).p;
    weak.statecraft.investigation = { kind: "corruption", yearsLeft: 1, evidence: 5 };
    const pop = weak.politics.popularity;
    processPolitics(weak, makeRng(1), []);
    expect(weak.currentJob).not.toBeNull();
    expect(weak.politics.popularity).toBeGreaterThanOrEqual(pop - 6);
    const mid = pol(21, 2).p;
    mid.statecraft.investigation = { kind: "corruption", yearsLeft: 1, evidence: 50 };
    const machine = mid.statecraft.machine;
    processPolitics(mid, makeRng(1), []);
    expect(mid.statecraft.machine).toBeLessThan(machine);
  });
  it("you can't campaign under investigation, and felons can't run at all", () => {
    const { p } = pol(22);
    expect(canRun(p).ok).toBe(true);
    p.statecraft.investigation = { kind: "corruption", yearsLeft: 2, evidence: 40 };
    expect(canRun(p).ok).toBe(false);
    const q = pol(22).p;
    q.justice.convictions = 1;
    q.justice.felonies = 1;
    expect(canRun(q).ok).toBe(false);
    expect(canRun(q).reason).toContain("felon");
  });
});

describe("the ladder", () => {
  it("steps up require tenure in the current office", () => {
    const { p } = pol(30, 0);
    p.age = 40;
    expect(canRun(p).ok).toBe(false);
    expect(canRun(p).reason).toContain("experience");
    p.statecraft.termsInOffice = 1;
    expect(canRun(p).ok).toBe(true);
  });
  it("top offices are much harder than the bottom, and fame matters", () => {
    const { p } = pol(31);
    p.politics.popularity = 90;
    p.skills.charisma = 80;
    p.fame = 5;
    const low = electionOdds(p, 0).chance;
    const high = electionOdds(p, 4).chance;
    expect(low).toBeGreaterThan(high + 0.4);
    p.fame = 70;
    expect(electionOdds(p, 4).chance).toBeGreaterThan(high);
  });
});

describe("life after politics", () => {
  it("lobbying pays and carries ethics risk; ambassadorships need party standing; memoirs once", () => {
    const { p } = pol(40);
    p.statecraft.highestTier = 2;
    p.politics.party = "centrist";
    p.statecraft.machine = 80;
    expect(lobbyBlocker(p)).toBeNull();
    expect(ambassadorBlocker(p)).toBeNull();
    const lobby = takeRetirementPath(p, makeRng(1), "lobbyist").player;
    expect(lobby.statecraft.retired).toBe("lobbyist");
    const bank0 = lobby.bankBalance;
    processPolitics(lobby, makeRng(2), []);
    expect(lobby.bankBalance).toBeGreaterThan(bank0 + 50_000);
    const low = fresh(p);
    low.statecraft.machine = 20;
    expect(ambassadorBlocker(low)).toContain("standing");
    const book = politicalMemoir(p, makeRng(1), true).player;
    expect(book.bankBalance).toBeGreaterThan(p.bankBalance);
    expect(book.statecraft.machine).toBeLessThan(p.statecraft.machine);
    expect(politicalMemoir(book, makeRng(1), false).player).toBe(book);
    // Taking a real job ends the lobbying career.
    lobby.currentJob = makeJob(CAREER_BY_ID.retail, 0, makeRng(1));
    processPolitics(lobby, makeRng(3), []);
    expect(lobby.statecraft.retired).toBeNull();
  });
  it("stepping down is voluntary and keeps the highest office on record", () => {
    const { p } = pol(41, 2);
    const out = retireFromOffice(p).player;
    expect(out.currentJob).toBeNull();
    expect(out.statecraft.highestTier).toBe(2);
  });
});

describe("a whole political year runs inside age up", () => {
  it("never produces invalid state for office holders", () => {
    for (let s = 0; s < 20; s++) {
      const { p, rng } = pol(500 + s, s % 5);
      let cur = p;
      for (let y = 0; y < 12 && cur.alive; y++) {
        cur = ageUp(cur, rng).player;
        expect(cur.politics.popularity).toBeGreaterThanOrEqual(0);
        expect(cur.politics.popularity).toBeLessThanOrEqual(100);
        expect(cur.statecraft.machine).toBeGreaterThanOrEqual(0);
        if (cur.pendingTrial) cur = resolveTrial(cur, "public", rng).player;
      }
    }
  });
});
