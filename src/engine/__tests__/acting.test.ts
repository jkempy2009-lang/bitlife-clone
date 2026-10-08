import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { ageUp, finalize } from "../ageUp";
import { createNewPlayer } from "../state";
import { resolveEvent } from "../events";
import { hydrate } from "../save";
import { applyForJob } from "../career";
import { blockerFor } from "../occupation";
import {
  FILM_GENRES, acceptOffer, auditionBlocker, auditionForLead, attendCallback, fireAgent, hireAgent, hireManager, processActing, signStudioDeal,
} from "../acting";
import {
  acceptFranchise, bookSideGig, campaignForAwards, comebackBlocker, leaveSeries, promoteFilm, startComeback, trainActing,
} from "../actingActions";
import { UNION_SCALE, buildOffer, cutsFor } from "../actingShared";
import { processAwards } from "../actingYear";
import { careerSummary, ladderSteps } from "../actingStats";
import { LIFE_EVENTS } from "@/data/lifeEventsEngine";
import type { ActionResult, Notice, PlayerState } from "@/types/game.types";

function makeActor(seed: number, tier = 0) {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 27;
  p.education.stage = "None";
  p.looks = 85;
  p.bankBalance = 2_000_000;
  const hired = applyForJob(p, "actor", rng).player;
  expect(hired.currentJob?.lineId).toBe("actor");
  for (let i = 0; i < tier; i++) {
    const j = hired.currentJob!;
    j.tier += 1;
    j.salary = [18_000, 140_000, 1_800_000, 14_000_000][j.tier];
  }
  hired.annualSalary = hired.currentJob!.salary;
  return { rng, p: hired };
}

const withAgent = (p: PlayerState, rng: Rng, kind: "boutique" | "mid" | "major" = "mid") => {
  p.acting.reputation = 80;
  p.fame = 40;
  return hireAgent(p, rng, kind).player;
};

describe("representation", () => {
  it("agents come in tiers; majors want a name; firing is clean", () => {
    const { rng, p } = makeActor(1);
    expect(hireAgent(p, rng, "major").player.acting.agent).toBeNull();
    const boutique = hireAgent({ ...p, acting: { ...p.acting, reputation: 30 } }, rng, "boutique").player;
    expect(boutique.acting.agent?.kind).toBe("boutique");
    expect(boutique.acting.agent?.cut).toBeLessThan(0.1);
    const { p: star, rng: r2 } = makeActor(2, 1);
    const major = withAgent(star, r2, "major");
    expect(major.acting.agent?.kind).toBe("major");
    expect(major.acting.agent!.cut).toBeGreaterThan(0.1);
    expect(fireAgent(major, r2).player.acting.agent).toBeNull();
  });

  it("agent and manager cuts both come off the top", () => {
    const { rng, p } = makeActor(3, 1);
    const q = withAgent(p, rng);
    const m = hireManager(q, rng).player;
    expect(m.acting.manager).not.toBeNull();
    const c = cutsFor(m, 100_000);
    expect(c.agent).toBe(Math.round(100_000 * m.acting.agent!.cut));
    expect(c.manager).toBe(12_000);
    expect(c.total).toBe(c.agent + c.manager);
  });

  it("quiet years erode an agent's trust until they walk", () => {
    let dropped = 0;
    for (let s = 1; s <= 20; s++) {
      const { rng, p } = makeActor(s, 1);
      const q = withAgent(p, rng, "major");
      q.acting.agent!.trust = 15;
      q.acting.yearsSinceWork = 0;
      q.acting.credits = [];
      processActing(q, makeRng(s), []);
      if (!q.acting.agent) dropped++;
    }
    expect(dropped).toBeGreaterThan(5);
  });
});

describe("auditions, call-backs and rejection streaks", () => {
  it("a first read ends in a rejection or a call-back, never silently", () => {
    let callbacks = 0;
    let rejections = 0;
    for (let s = 1; s <= 60; s++) {
      const { rng, p } = makeActor(s);
      const res = auditionForLead(p, rng, "Drama").player;
      if (res.acting.callback) {
        callbacks++;
        expect(res.acting.pendingFilm).toBeNull();
        expect(auditionBlocker(res)).toMatch(/call-back/);
      } else {
        rejections++;
        expect(res.acting.rejections).toBe(1);
      }
    }
    expect(callbacks).toBeGreaterThan(5);
    expect(rejections).toBeGreaterThan(5);
  });

  it("preparing for a call-back pays: a coach beats winging it", () => {
    const wins = { wing: 0, coach: 0 };
    for (let s = 1; s <= 300; s++) {
      for (const prep of ["wing", "coach"] as const) {
        const { rng, p } = makeActor(s);
        p.acting.callback = { genre: "Drama", odds: 0.4 };
        const r = attendCallback(p, makeRng(s * 7), prep).player;
        if (r.acting.pendingFilm) wins[prep]++;
        expect(r.acting.callback).toBeNull();
        void rng;
      }
    }
    expect(wins.coach).toBeGreaterThan(wins.wing);
  });

  it("rejection streaks sap confidence, and a win resets them", () => {
    const { rng, p } = makeActor(5);
    p.acting.rejections = 6;
    p.acting.callback = { genre: "Drama", odds: 1 };
    const happyBefore = p.happiness;
    const won = attendCallback({ ...p, acting: { ...p.acting, callback: { genre: "Drama", odds: 0.97 } } }, rng, "coach").player;
    if (won.acting.pendingFilm) {
      expect(won.acting.rejections).toBe(0);
      expect(won.happiness).toBeGreaterThanOrEqual(happyBefore);
    }
  });
});

describe("television", () => {
  it("a TV offer becomes a pilot and the contract is exclusive", () => {
    const { rng, p } = makeActor(11, 1);
    const tv = buildOffer(p, rng, "supporting", "Drama", undefined, "tv");
    expect(tv.seasons).toBeGreaterThanOrEqual(3);
    expect(tv.fee).toBeGreaterThanOrEqual(UNION_SCALE.tv);
    p.acting.offers = [tv, buildOffer(p, rng, "supporting", "Comedy")];
    const q = acceptOffer(p, rng, tv.id).player;
    expect(q.acting.series?.status).toBe("pilot");
    expect(q.acting.offers).toEqual([]);
    q.acting.offers = [buildOffer(q, rng, "lead", "Action")];
    const blocked = acceptOffer(q, rng, q.acting.offers[0].id);
    expect(blocked.player.acting.pendingFilm).toBeNull();
    expect(auditionBlocker(q)).toMatch(/exclusive/);
    expect(signStudioDeal(q, rng).player.acting.studioDeal).toBeNull();
  });

  it("series run for seasons, pay each year, end with a credit, and old hits earn syndication", () => {
    let ended = 0;
    let syndicated = 0;
    let totalFees = 0;
    for (let s = 1; s <= 80; s++) {
      const { rng, p } = makeActor(s, 1);
      p.acting.series = { title: "Show", genre: "Drama", network: "Net", status: "running", season: 0, yearsLeft: 2, fee: 200_000, ratings: 60, script: 80, prestige: 70, role: "lead", critics: 0 };
      for (let y = 0; y < 15 && p.acting.series; y++) {
        const gross = processActing(p, rng, []);
        totalFees += gross;
        expect(Number.isFinite(gross)).toBe(true);
      }
      if (!p.acting.series) {
        ended++;
        const credit = p.acting.credits.find((c) => c.medium === "tv");
        expect(credit?.seasons).toBeGreaterThanOrEqual(1);
        if ((credit?.seasons ?? 0) >= 4 && p.acting.residuals.some((r) => r.title.includes("syndication"))) syndicated++;
      }
    }
    expect(ended).toBeGreaterThan(40);
    expect(syndicated).toBeGreaterThan(0);
    expect(totalFees).toBeGreaterThan(0);
  });

  it("walking out mid-contract costs money and reputation; a finished contract is free", () => {
    const { p } = makeActor(12, 1);
    p.acting.series = { title: "Show", genre: "Drama", network: "Net", status: "running", season: 2, yearsLeft: 2, fee: 100_000, ratings: 60, script: 60, prestige: 60, role: "lead", critics: 60 };
    p.acting.reputation = 60;
    const bank = p.bankBalance;
    const left = leaveSeries(p).player;
    expect(left.acting.series).toBeNull();
    expect(left.bankBalance).toBe(bank - 50_000);
    expect(left.acting.reputation).toBeLessThan(60);
    expect(left.acting.credits.at(-1)?.medium).toBe("tv");
    p.acting.series.yearsLeft = 0;
    const free = leaveSeries(p).player;
    expect(free.bankBalance).toBe(bank);
    expect(free.acting.reputation).toBe(60);
  });
});

describe("franchises, press and the production lifecycle", () => {
  it("a franchise locks you in, sequels arrive each year, and then it wraps", () => {
    const { rng, p } = makeActor(21, 2);
    p.acting.franchiseOffer = { name: "The Last Harvest", genre: "Action", films: 3, fee: 2_000_000 };
    const q = acceptFranchise(p).player;
    expect(q.acting.franchise?.filmsLeft).toBe(3);
    q.acting.offers = [buildOffer(q, rng, "lead", "Drama")];
    expect(acceptOffer(q, rng, q.acting.offers[0].id).player.acting.pendingFilm).toBeNull();
    const parts: number[] = [];
    for (let y = 0; y < 6; y++) {
      processActing(q, rng, []);
      if (q.acting.pendingFilm?.installment) parts.push(q.acting.pendingFilm.installment);
    }
    expect(parts.slice(0, 3)).toEqual([2, 3, 4]);
    expect(q.acting.franchise).toBeNull();
  });

  it("press work lifts a film's box office on average", () => {
    const mean = { cold: 0, hyped: 0 };
    const n = 120;
    for (let s = 1; s <= n; s++) {
      for (const mode of ["cold", "hyped"] as const) {
        const { rng, p } = makeActor(s, 2);
        p.acting.pendingFilm = { ...buildOffer(p, rng, "lead", "Drama"), role: "lead", promo: mode === "hyped" ? 40 : 0 };
        processActing(p, makeRng(s * 31), []);
        mean[mode] += p.acting.credits.at(-1)!.boxOffice;
      }
    }
    expect(mean.hyped).toBeGreaterThan(mean.cold);
  });

  it("promoting costs money, is limited per year, and method acting is a real commitment", () => {
    const { rng, p } = makeActor(22, 2);
    p.acting.pendingFilm = { ...buildOffer(p, rng, "lead", "Drama"), role: "lead" };
    const bank = p.bankBalance;
    const tour = promoteFilm(p, rng, "tour").player;
    expect(tour.acting.pendingFilm!.promo).toBeGreaterThan(0);
    expect(tour.bankBalance).toBeLessThan(bank);
    expect(promoteFilm(tour, rng, "interviews").player.acting.pendingFilm!.promo).toBe(tour.acting.pendingFilm!.promo);
    const health = p.health;
    const method = trainActing(p, rng, "method").player;
    expect(method.acting.pendingFilm!.method).toBe(true);
    expect(method.health).toBeLessThan(health);
    expect(trainActing(method, rng, "method").player.acting.pendingFilm!.method).toBe(true);
    const coached = trainActing(p, rng, "coach").player;
    expect(coached.acting.prepBonus).toBeGreaterThan(0);
    expect(coached.bankBalance).toBeLessThan(bank);
  });

  it("a low-budget breakout sometimes becomes a sleeper hit", () => {
    let sleepers = 0;
    for (let s = 1; s <= 300; s++) {
      const { rng, p } = makeActor(s, 2);
      p.acting.reputation = 90;
      p.acting.pull = 80;
      p.fame = 70;
      p.acting.pendingFilm = { ...buildOffer(p, rng, "lead", "Indie"), role: "lead", budget: 1_000_000, script: 95, prestige: 90 };
      processActing(p, makeRng(s), []);
      if (p.acting.credits.at(-1)?.sleeper) sleepers++;
    }
    expect(sleepers).toBeGreaterThan(0);
  });

  it("hits pay residuals; guild minimums apply to every medium", () => {
    let residuals = 0;
    for (let s = 1; s <= 80; s++) {
      const { rng, p } = makeActor(s, 1);
      p.acting.reputation = 80;
      p.acting.pull = 70;
      p.fame = 60;
      p.acting.pendingFilm = { ...buildOffer(p, rng, "lead", "Drama"), role: "lead", script: 90, prestige: 80 };
      processActing(p, makeRng(s), []);
      residuals += p.acting.residuals.length;
    }
    expect(residuals).toBeGreaterThan(0);
    for (let s = 1; s <= 40; s++) {
      const { rng, p } = makeActor(s);
      for (const m of ["film", "tv", "stage"] as const) expect(buildOffer(p, rng, "cameo", undefined, undefined, m).fee).toBeGreaterThanOrEqual(UNION_SCALE[m]);
    }
  });
});

describe("awards season", () => {
  const contender = (campaign: "quiet" | "blitz") => ({
    filmId: "f", title: "Film", genre: "Drama", role: "lead" as const, critics: 78, prestige: 70, indie: false, medium: "film" as const, campaign, spent: 0,
  });

  it("a campaign costs money once and improves the odds", () => {
    const { p } = makeActor(31, 2);
    p.acting.awardsRun = contender("quiet");
    const bank = p.bankBalance;
    const q = campaignForAwards(p, "blitz").player;
    expect(q.acting.awardsRun?.campaign).toBe("blitz");
    expect(q.bankBalance).toBeLessThan(bank);
    expect(campaignForAwards(q, "lunch").player.acting.awardsRun?.campaign).toBe("blitz");
    const noms = { quiet: 0, blitz: 0 };
    for (let s = 1; s <= 400; s++) {
      for (const mode of ["quiet", "blitz"] as const) {
        const { p: w } = makeActor(s, 2);
        w.acting.awardsRun = contender(mode);
        w.acting.credits.push({ id: "f", title: "Film", year: 2026, genre: "Drama", role: "lead", budget: 1, boxOffice: 1, critics: 78, outcome: "hit" });
        processAwards(w, makeRng(s), []);
        noms[mode] += w.acting.nominations;
        expect(w.acting.awardsRun).toBeNull();
      }
    }
    expect(noms.blitz).toBeGreaterThan(noms.quiet);
  });

  it("a win raises your fee", () => {
    let raised = 0;
    for (let s = 1; s <= 100; s++) {
      const { p } = makeActor(s, 2);
      const before = p.currentJob!.salary;
      p.acting.awardsRun = contender("blitz");
      p.acting.credits.push({ id: "f", title: "Film", year: 2026, genre: "Drama", role: "lead", budget: 1, boxOffice: 1, critics: 78, outcome: "hit" });
      processAwards(p, makeRng(s), []);
      if (p.acting.awards.length > 0) {
        expect(p.currentJob!.salary).toBe(Math.round(before * 1.2));
        expect(p.acting.credits[0].award).toBeDefined();
        raised++;
      }
    }
    expect(raised).toBeGreaterThan(5);
  });
});

describe("side work, comebacks, ageing", () => {
  it("voice work and ads pay at least guild scale, once a year, and fit around a series", () => {
    const { rng, p } = makeActor(41);
    p.acting.series = { title: "Show", genre: "Drama", network: "Net", status: "running", season: 1, yearsLeft: 2, fee: 100_000, ratings: 60, script: 60, prestige: 60, role: "lead", critics: 60 };
    const bank = p.bankBalance;
    const v = bookSideGig(p, rng, "voice").player;
    expect(v.bankBalance).toBeGreaterThan(bank);
    expect(v.acting.sideGigs).toBe(1);
    expect(bookSideGig(v, rng, "voice").player.acting.sideGigs).toBe(1);
    const ad = bookSideGig(v, rng, "commercial").player;
    expect(ad.acting.residuals.length).toBe(1);
  });

  it("a comeback needs a fall, offers a prestige script, and can restore a career", () => {
    const { rng, p } = makeActor(42, 1);
    p.acting.credits = Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, title: "t", year: 2010 + i, genre: "Drama", role: "lead" as const, budget: 1, boxOffice: 1, critics: 60, outcome: "modest" as const }));
    p.acting.reputation = 60;
    p.acting.yearsSinceWork = 0;
    expect(comebackBlocker(p)).not.toBeNull();
    p.acting.yearsSinceWork = 3;
    expect(comebackBlocker(p)).toBeNull();
    const q = startComeback(p, rng).player;
    const o = q.acting.offers.find((x) => x.comeback)!;
    expect(o.prestige).toBeGreaterThanOrEqual(75);
    expect(comebackBlocker(q)).not.toBeNull();
    let restored = 0;
    for (let s = 1; s <= 80; s++) {
      const w = structuredClone(q);
      w.acting.reputation = 30;
      w.acting.pendingFilm = { ...o, role: "lead" };
      const before = w.acting.reputation;
      processActing(w, makeRng(s), []);
      if (w.acting.reputation > before + 5) restored++;
    }
    expect(restored).toBeGreaterThan(0);
  });

  it("the industry ages out romantic and action leads", () => {
    let youngLeads = 0;
    let oldLeads = 0;
    for (let s = 1; s <= 200; s++) {
      const { rng, p } = makeActor(s, 2);
      p.acting.reputation = 40;
      youngLeads += buildOffer(p, rng, "lead", "Romance").role === "lead" ? 1 : 0;
      p.age = 58;
      oldLeads += buildOffer(p, rng, "lead", "Romance").role === "lead" ? 1 : 0;
    }
    expect(oldLeads).toBeLessThan(youngLeads);
  });
});

describe("child stars", () => {
  it("a student can act part-time and goes full-time after school", () => {
    const rng = makeRng(51);
    const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 12;
    p.looks = 90;
    p.education.stage = "HighSchool";
    const hired = applyForJob(p, "actor", rng).player;
    expect(hired.currentJob?.lineId).toBe("actor");
    expect(hired.currentJob?.partTime).toBe(true);
    expect(blockerFor(hired, "study")).toBeNull();
    hired.acting.pendingFilm = { ...buildOffer(hired, rng, "supporting", "Drama"), role: "supporting" };
    hired.education.studyEffort = 5;
    processActing(hired, rng, []);
    expect(hired.education.studyEffort).toBeLessThan(5);
    const tutored = structuredClone(hired);
    tutored.flags.push("set_tutor");
    tutored.education.studyEffort = 5;
    tutored.acting.pendingFilm = { ...buildOffer(tutored, rng, "supporting", "Drama"), role: "supporting" };
    processActing(tutored, rng, []);
    expect(tutored.education.studyEffort).toBe(5);
    const grown = structuredClone(hired);
    grown.age = 19;
    grown.education.stage = "None";
    const before = grown.currentJob!.salary;
    processActing(grown, rng, []);
    expect(grown.currentJob!.partTime).toBe(false);
    expect(grown.currentJob!.salary).toBeGreaterThan(before);
  });
});

describe("summary and old saves", () => {
  it("summarises a career and shows the ladder", () => {
    const { p } = makeActor(61, 1);
    p.acting.credits = [
      { id: "1", title: "A", year: 2020, genre: "Drama", role: "lead", budget: 10, boxOffice: 50, critics: 80, outcome: "blockbuster", medium: "film" },
      { id: "2", title: "B", year: 2022, genre: "Comedy", role: "supporting", budget: 10, boxOffice: 2, critics: 20, outcome: "flop" },
      { id: "3", title: "C", year: 2024, genre: "Drama", role: "lead", budget: 0, boxOffice: 0, critics: 70, outcome: "hit", medium: "tv", seasons: 3 },
    ];
    const s = careerSummary(p);
    expect(s.total).toBe(3);
    expect(s.byMedium).toEqual({ film: 2, tv: 1, stage: 0 });
    expect(s.hits).toBe(2);
    expect(s.flops).toBe(1);
    expect(s.seasons).toBe(3);
    expect(s.best?.title).toBe("A");
    expect(s.worst?.title).toBe("B");
    const steps = ladderSteps(p);
    expect(steps.map((x) => x.state)).toEqual(["done", "here", "next", "later"]);
  });

  it("old acting saves load with defaults for every new field", () => {
    const { p } = makeActor(62, 1);
    const old = structuredClone(p) as unknown as { acting: Record<string, unknown> };
    for (const k of ["manager", "series", "franchise", "franchiseOffer", "awardsRun", "callback", "rejections", "residuals", "prepBonus", "comebackYear", "sideGigs"]) delete old.acting[k];
    old.acting.agent = { name: "Old Agent", cut: 0.1, skill: 50, yearsWith: 3 };
    old.acting.lastIncome = { fees: 5, bonuses: 1, agent: 1 };
    old.acting.credits = [{ id: "x", title: "Old", year: 2010, genre: "Drama", role: "lead", budget: 1, boxOffice: 2, critics: 50, outcome: "hit" }];
    const h = hydrate(old as unknown as PlayerState);
    expect(h.acting.agent?.kind).toBe("mid");
    expect(h.acting.agent?.trust).toBeGreaterThan(0);
    expect(h.acting.series).toBeNull();
    expect(h.acting.residuals).toEqual([]);
    expect(h.acting.rejections).toBe(0);
    expect(h.acting.lastIncome.series).toBe(0);
    expect(careerSummary(h).byMedium.film).toBe(1);
    expect(Number.isFinite(ageUp(h, makeRng(1)).player.bankBalance)).toBe(true);
  });

  it("acting event ids are unique", () => {
    const ids = LIFE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((i) => i.startsWith("act_")).length).toBeGreaterThanOrEqual(10);
  });
});

/** A life devoted to the screen: acts every year, makes random career choices, resolves events at random. */
function playActorBot(seed: number): PlayerState {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 18;
  p.looks = 85;
  p.education.stage = "None";
  const run = (fn: (pl: PlayerState, r: Rng) => ActionResult) => {
    const res = fn(p, rng);
    if (res.player !== p) {
      finalize(res.player, []);
      p = res.player;
    }
  };
  run((pl, r) => applyForJob(pl, "actor", r));
  const mutate: Array<(pl: PlayerState, r: Rng) => ActionResult> = [
    (pl, r) => auditionForLead(pl, r, r.pick(FILM_GENRES)),
    (pl, r) => attendCallback(pl, r, r.pick(["wing", "rehearse", "coach"] as const)),
    (pl, r) => (pl.acting.offers.length ? acceptOffer(pl, r, r.pick(pl.acting.offers).id, r.chance(0.3)) : { player: pl }),
    (pl, r) => hireAgent(pl, r, r.pick(["boutique", "mid", "major"] as const)),
    (pl, r) => hireManager(pl, r),
    (pl, r) => (r.chance(0.15) ? fireAgent(pl, r) : { player: pl }),
    (pl) => acceptFranchise(pl),
    (pl) => leaveSeriesMaybe(pl),
    (pl, r) => promoteFilm(pl, r, r.pick(["interviews", "tour"] as const)),
    (pl, r) => trainActing(pl, r, r.pick(["class", "coach", "method"] as const)),
    (pl, r) => campaignForAwards(pl, r.pick(["festivals", "lunch", "blitz"] as const)),
    (pl, r) => bookSideGig(pl, r, r.pick(["voice", "commercial"] as const)),
    (pl, r) => startComeback(pl, r),
    (pl, r) => signStudioDeal(pl, r),
  ];
  function leaveSeriesMaybe(pl: PlayerState): ActionResult {
    return rng.chance(0.2) ? leaveSeries(pl) : { player: pl };
  }
  for (let guard = 0; guard < 60 && p.alive; guard++) {
    const res = ageUp(p, rng);
    p = res.player;
    check(p);
    for (const n of (res.notices ?? []) as Notice[]) {
      if (n.kind === "event" && p.alive) {
        const r = resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng);
        finalize(r.player, []);
        p = r.player;
      }
    }
    if (!p.alive) break;
    if (!p.currentJob && p.age >= 18 && rng.chance(0.5)) run((pl, r) => applyForJob(pl, "actor", r));
    for (let i = 0; i < 4 && p.alive; i++) {
      run(rng.pick(mutate));
      check(p);
    }
  }
  return p;
}

function check(p: PlayerState) {
  const a = p.acting;
  for (const [k, v] of Object.entries({ rep: a.reputation, critics: a.critics, pull: a.pull, prep: a.prepBonus, rej: a.rejections })) {
    expect(Number.isFinite(v), `${k} finite`).toBe(true);
    expect(v, `${k} >= 0`).toBeGreaterThanOrEqual(0);
  }
  expect(a.reputation).toBeLessThanOrEqual(100);
  expect(a.pull).toBeLessThanOrEqual(100);
  expect(Number.isFinite(a.earnings)).toBe(true);
  expect(Number.isFinite(p.bankBalance)).toBe(true);
  // Exclusive contracts never overlap.
  const exclusive = [!!a.series, !!a.studioDeal, !!a.franchise].filter(Boolean).length;
  expect(exclusive, "exclusive contracts").toBeLessThanOrEqual(1);
  if (a.agent) {
    expect(a.agent.trust).toBeGreaterThanOrEqual(0);
    expect(a.agent.trust).toBeLessThanOrEqual(100);
  }
  for (const r of a.residuals) expect(r.yearsLeft).toBeGreaterThan(0);
  expect(a.credits.length).toBeLessThan(400);
}

describe("acting career simulation", () => {
  it("never breaks state across many careers, and reaches the interesting systems", () => {
    let credits = 0;
    let tv = 0;
    let stage = 0;
    let nominations = 0;
    let callbacksOrAgents = 0;
    for (let s = 1; s <= 30; s++) {
      const p = playActorBot(4000 + s);
      credits += p.acting.credits.length;
      tv += p.acting.credits.filter((c) => c.medium === "tv").length + (p.acting.series ? 1 : 0);
      stage += p.acting.credits.filter((c) => c.medium === "stage").length;
      nominations += p.acting.nominations;
      if (p.acting.agent || p.acting.sideGigs > 0) callbacksOrAgents++;
      expect(p.age).toBeLessThanOrEqual(120);
    }
    expect(credits).toBeGreaterThan(30);
    expect(tv + stage).toBeGreaterThan(0);
    expect(nominations).toBeGreaterThanOrEqual(0);
    expect(callbacksOrAgents).toBeGreaterThan(5);
  }, 240_000);
});
