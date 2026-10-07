import { NEUTRAL } from "./helpers/neutral";
import { upgradeBusiness } from "../business";
import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import { applyForJob, quitJob } from "../career";
import { blockerFor } from "../occupation";
import { continueAsChild } from "../legacy";
import { exportSave, parseSave } from "../save";
import { startBusiness } from "../paths";
import {
  acceptOffer, advanceRequirements, attendShowcase, chooseTreatment, comeback, commitBlocker, exitPreview, hireAgent, negotiateOffer, quitSport,
  retireFromSport, signWithClub, stageLabel, trainAthletics,
} from "../athlete";
import { buildOffers, processAthlete } from "../athleteSeason";
import { contractSalary, declineAmount, injuryChance, leagueFor, maturity, nextRating, phaseFor } from "../athleteModel";
import { signContract } from "../athleteCareer";
import { hydrateAthlete, newAthleteState } from "../athleteState";
import { SPORTS } from "@/data/sports";
import { ACHIEVEMENT_BY_ID } from "@/data/achievements";
import { EVENT_BY_ID } from "@/data/lifeEventsEngine";
import { resolveEvent } from "../events";
import type { ActionResult, AthleteOffer, Notice, PlayerState } from "@/types/game.types";

type Notices = NonNullable<ActionResult["notices"]>;

function mk(seed: number, stage: PlayerState["athlete"]["stage"], over: Partial<PlayerState["athlete"]> = {}, age = 20, sport = "Soccer") {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = age;
  p.education = { ...p.education, stage: "None", degrees: ["highschool"], grades: 70 };
  p.smarts = 60;
  p.health = 85;
  p.bankBalance = 50_000;
  Object.assign(p.athlete, {
    sport, stage, talent: 70, rating: 60, form: 55, consistency: 60, exposure: 50, years: 8, club: "Test FC", league: 0,
  }, over);
  return { p, rng };
}

const offer = (over: Partial<AthleteOffer>): AthleteOffer => ({ id: "o1", kind: "pro", club: "Metro FC", league: 1, salary: 100_000, years: 3, bonus: 10_000, note: "", ...over });

function year(p: PlayerState, rng: Rng, effort: PlayerState["effort"] = "steady") {
  p.age += 1;
  p.year += 1;
  p.effort = effort;
  p.annual = {};
  const notices: Notices = [];
  processAthlete(p, rng, notices);
  return notices;
}

describe("commitment", () => {
  it("applying for an athlete job is not possible; signing is a pipeline", () => {
    const { p, rng } = mk(1, "none", {}, 17);
    p.skills.athletics = 95;
    const res = applyForJob(p, "athlete", rng);
    expect(res.player.currentJob).toBeNull();
  });

  it("choosing a sport makes you a youth player with no contract, however good you are", () => {
    const { p, rng } = mk(2, "none", { sport: null }, 16);
    p.skills.athletics = 90;
    const res = signWithClub(p, "Tennis", rng).player;
    expect(res.athlete.stage).toBe("youth");
    expect(res.currentJob).toBeNull();
    expect(res.athlete.rating).toBeLessThan(70);
  });

  it("is only possible from age 8 and not twice", () => {
    const { p, rng } = mk(3, "none", { sport: null }, 6);
    expect(commitBlocker(p)).toMatch(/Too young/);
    expect(signWithClub(p, "Golf", rng).player).toBe(p);
    const q = mk(3, "none", { sport: null }, 12);
    const once = signWithClub(q.p, "Golf", q.rng).player;
    expect(commitBlocker(once)).toMatch(/already/);
  });

  it("closes to adults: 40-year-olds can't start a competitive soccer career", () => {
    const { p } = mk(4, "none", { sport: null }, 40);
    expect(commitBlocker(p, "Soccer")).toMatch(/Too late/);
  });

  it("a sport can't be joined without a valid name", () => {
    const { p, rng } = mk(5, "none", { sport: null }, 12);
    expect(signWithClub(p, "Curling", rng).player).toBe(p);
  });

  it("training camp without a sport only raises general fitness and is limited to once a year", () => {
    const { p, rng } = mk(6, "none", { sport: null }, 15);
    const once = trainAthletics(p, rng).player;
    expect(once.skills.athletics).toBeGreaterThan(p.skills.athletics);
    expect(trainAthletics(once, rng).player.skills.athletics).toBe(once.skills.athletics);
    expect(once.athlete.stage).toBe("none");
  });
});

describe("stage gates", () => {
  it("a 16-year-old prodigy gets no pro contract offer: you must be 17+", () => {
    const { p, rng } = mk(10, "youth", { rating: 90, talent: 95, exposure: 100 }, 16);
    for (let i = 0; i < 20; i++) expect(buildOffers(p, rng).some((o) => o.kind === "pro" || o.kind === "semipro")).toBe(false);
  });

  it("a scholarship needs grades, a diploma and age 18-20", () => {
    const kinds = (age: number, grades: number, diploma: boolean) => {
      const { p, rng } = mk(11, "youth", { rating: 55, talent: 80, exposure: 100, years: 9 }, age);
      p.education.grades = grades;
      p.education.degrees = diploma ? ["highschool"] : [];
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) buildOffers(p, rng).forEach((o) => seen.add(o.kind));
      return seen;
    };
    expect(kinds(19, 75, true).has("scholarship")).toBe(true);
    expect(kinds(19, 40, true).has("scholarship")).toBe(false);
    expect(kinds(19, 75, false).has("scholarship")).toBe(false);
    expect(kinds(16, 75, true).has("scholarship")).toBe(false);
  });

  it("an academy needs projected talent and age 15-19", () => {
    const seen = (talent: number, age: number) => {
      const { p, rng } = mk(12, "youth", { rating: talent * 0.5, talent, exposure: 100, years: 7 }, age);
      const s = new Set<string>();
      for (let i = 0; i < 40; i++) buildOffers(p, rng).forEach((o) => s.add(o.kind));
      return s.has("academy");
    };
    expect(seen(95, 16)).toBe(true);
    expect(seen(15, 16)).toBe(false);
    expect(seen(95, 12)).toBe(false);
  });

  it("scouts can't offer what they haven't seen: zero exposure sharply cuts offers", () => {
    const hi = mk(13, "youth", { rating: 66, talent: 85, exposure: 100, years: 9 }, 18);
    const lo = mk(13, "youth", { rating: 66, talent: 85, exposure: 0, years: 9 }, 18);
    let a = 0;
    let b = 0;
    for (let i = 0; i < 200; i++) {
      a += buildOffers(hi.p, hi.rng).length;
      b += buildOffers(lo.p, lo.rng).length;
    }
    expect(a).toBeGreaterThan(b * 1.3);
  });

  it("accepting a scholarship enrols you at university and puts you in college", () => {
    const { p, rng } = mk(14, "youth", {}, 18);
    p.athlete.offers = [offer({ id: "s", kind: "scholarship", league: 0, salary: 18_000, years: 4, bonus: 0, club: "State University" })];
    const res = acceptOffer(p, "s", rng).player;
    expect(res.athlete.stage).toBe("college");
    expect(res.athlete.scholarship).toBe(true);
    expect(res.education.stage).toBe("University");
    expect(res.currentJob).toBeNull();
  });

  it("accepting a pro contract creates an athlete job with sport-specific title, bonus and flag", () => {
    const { p, rng } = mk(15, "college", {}, 21);
    p.athlete.offers = [offer({ id: "c", kind: "pro", league: 1, salary: 120_000, years: 3, bonus: 20_000, club: "Harbor United" })];
    const bank = p.bankBalance;
    const res = acceptOffer(p, "c", rng).player;
    expect(res.athlete.stage).toBe("pro");
    expect(res.currentJob?.lineId).toBe("athlete");
    expect(res.currentJob?.salary).toBe(120_000);
    expect(res.currentJob?.title).toBe("Second-Division Pro");
    expect(res.flags).toContain("athlete");
    expect(res.bankBalance).toBeGreaterThan(bank);
    expect(res.athlete.contractYears).toBe(3);
  });

  it("signing a pro deal while studying at university forces you to leave", () => {
    const { p, rng } = mk(16, "youth", {}, 19);
    p.education.stage = "University";
    p.education.yearsLeft = 3;
    p.athlete.offers = [offer({ id: "c", kind: "semipro", league: 0, salary: 26_000, years: 2, bonus: 0 })];
    const res = acceptOffer(p, "c", rng).player;
    expect(res.education.stage).toBe("None");
    expect(res.athlete.stage).toBe("semipro");
  });

  it("requirements checklist is available for every stage", () => {
    for (const st of ["none", "youth", "college", "semipro", "pro"] as const) {
      const { p } = mk(17, st, {}, 19);
      expect(advanceRequirements(p).length).toBeGreaterThan(0);
      expect(stageLabel(p).length).toBeGreaterThan(0);
    }
  });

  it("a committed grinder can reach the pros; a coaster never does", () => {
    const play = (effort: PlayerState["effort"], seed: number) => {
      const rng = makeRng(seed);
      let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
      let maxLeague = -1;
      for (let guard = 0; guard < 40 && p.alive; guard++) {
        p = ageUp(p, rng).player;
        if (p.age === 10) p = signWithClub(p, SPORTS[seed % SPORTS.length], rng).player;
        if (p.athlete.stage !== "none") p.effort = effort;
        const best = [...p.athlete.offers].sort((a, b) => b.league - a.league)[0];
        if (best && (best.kind === "pro" || best.kind === "transfer" || best.kind === "renew" || best.kind === "semipro")) p = acceptOffer(p, best.id, rng).player;
        if ((p.athlete.stage === "pro" || p.athlete.stage === "semipro") && p.athlete.league >= 1) maxLeague = Math.max(maxLeague, p.athlete.league);
      }
      return maxLeague;
    };
    let grinderPro = 0;
    let coasterPro = 0;
    for (let s = 1; s <= 60; s++) {
      if (play("grind", s) >= 1) grinderPro++;
      if (play("coast", s) >= 1) coasterPro++;
    }
    expect(grinderPro).toBeGreaterThan(2);
    expect(grinderPro).toBeLessThan(30);
    expect(coasterPro).toBe(0);
  }, 120_000);
});

describe("commitment and neglect", () => {
  it("coasting detrains you and gets you cut from a youth programme", () => {
    let cut = 0;
    for (let s = 0; s < 30; s++) {
      const { p, rng } = mk(100 + s, "college", { track: "academy", rating: 55 }, 18);
      for (let y = 0; y < 5 && p.athlete.stage === "college"; y++) year(p, rng, "coast");
      if (p.athlete.stage === "none") cut++;
    }
    expect(cut).toBeGreaterThanOrEqual(20);
  });

  it("coasting makes the rating slide; grinding grows it faster than steady", () => {
    const run = (effort: "coast" | "steady" | "grind") => {
      let total = 0;
      for (let seed = 20; seed < 32; seed++) {
        const { p, rng } = mk(seed, "youth", { rating: 30, talent: 70, years: 4, consistency: 50 }, 14);
        for (let i = 0; i < 4; i++) year(p, rng, effort);
        total += p.athlete.rating;
      }
      return total / 12;
    };
    const c = run("coast");
    const s = run("steady");
    const g = run("grind");
    expect(g).toBeGreaterThan(s);
    expect(s).toBeGreaterThan(c);
  });

  it("grinding raises injury risk, age raises it too", () => {
    const { p } = mk(21, "pro", { league: 1 }, 25);
    expect(injuryChance(p, p.athlete, "grind")).toBeGreaterThan(injuryChance(p, p.athlete, "steady") * 1.4);
    const older = mk(21, "pro", { league: 1 }, 34).p;
    expect(injuryChance(older, older.athlete, "steady")).toBeGreaterThan(injuryChance(p, p.athlete, "steady"));
  });

  it("training pulls grades down for athletes in school; scholarships are lost after repeated warnings", () => {
    const { p, rng } = mk(22, "college", { track: "college", scholarship: true, rating: 60 }, 19);
    p.education.stage = "University";
    p.education.yearsLeft = 3;
    p.education.grades = 20;
    p.smarts = 10;
    for (let y = 0; y < 2; y++) {
      p.education.grades = 20;
      year(p, rng, "grind");
    }
    expect(p.athlete.scholarship).toBe(false);
  });
});

describe("ratings, peak curves and decline", () => {
  it("each sport peaks at a different age", () => {
    expect(phaseFor("Gymnastics", 16).phase).toBe("prime");
    expect(phaseFor("Golf", 16).phase).toBe("rising");
    expect(phaseFor("Golf", 35).phase).toBe("prime");
    expect(phaseFor("Gymnastics", 26).phase).toBe("declining");
    expect(maturity("Gymnastics", 14)).toBeGreaterThan(maturity("Golf", 14));
    expect(declineAmount("Gymnastics", 26)).toBeGreaterThan(declineAmount("Golf", 46));
  });

  it("rating declines past the prime and sooner/harder for coasting veterans", () => {
    const rng = makeRng(30);
    const a = { ...newAthleteState(), sport: "Soccer", rating: 80, talent: 80, years: 15, consistency: 80 };
    const steady = nextRating(a, 34, "steady", 80, rng);
    expect(steady).toBeLessThan(80);
    const coast = nextRating(a, 34, "coast", 80, makeRng(30));
    expect(coast).toBeLessThan(steady);
  });

  it("league tier follows rating", () => {
    expect(leagueFor(30)).toBe(-1);
    expect(leagueFor(50)).toBe(0);
    expect(leagueFor(66)).toBe(1);
    expect(leagueFor(80)).toBe(2);
    expect(leagueFor(95)).toBe(3);
  });
});

describe("money", () => {
  it("most pros are modest, stars are rich, and sport matters", () => {
    const rng = makeRng(40);
    const semi = contractSalary("Soccer", 0, 50, rng);
    const second = contractSalary("Soccer", 1, 66, rng);
    const top = contractSalary("Soccer", 2, 80, rng);
    const star = contractSalary("Soccer", 3, 98, rng);
    expect(semi).toBeLessThan(60_000);
    expect(second).toBeLessThan(250_000);
    expect(top).toBeGreaterThan(second);
    expect(star).toBeGreaterThan(5_000_000);
    expect(contractSalary("Gymnastics", 2, 80, rng)).toBeLessThan(contractSalary("Basketball", 2, 80, rng));
  });

  it("negotiating can improve an offer or sour it, only once", () => {
    let better = 0;
    let worse = 0;
    for (let s = 0; s < 60; s++) {
      const { p, rng } = mk(200 + s, "pro", { league: 1, contractYears: 0, expiring: true }, 26);
      p.athlete.offers = [offer({ id: "x", kind: "renew", salary: 100_000 })];
      const res = negotiateOffer(p, "x", rng).player;
      const o = res.athlete.offers.find((x) => x.id === "x");
      if (o && o.salary > 100_000) better++;
      else worse++;
      if (o) expect(negotiateOffer(res, "x", rng).player).toBe(res);
    }
    expect(better).toBeGreaterThan(10);
    expect(worse).toBeGreaterThan(3);
  });

  it("an agent costs 8% of income and sweetens offers", () => {
    const { p } = mk(41, "pro", { league: 1, rating: 60 }, 26);
    const res = hireAgent(p).player;
    expect(res.athlete.agent).toBe(true);
    const young = mk(42, "youth", { rating: 30 }, 12);
    expect(hireAgent(young.p).player.athlete.agent).toBe(false);
  });

  it("a season pays endorsements only to people with fame, and records earnings and results", () => {
    const { p, rng } = mk(43, "pro", { league: 2, rating: 80, contractYears: 3 }, 27);
    signContract(p, rng, offer({ league: 2, salary: 500_000, years: 3 }));
    p.fame = 60;
    const before = p.athlete.record.earnings;
    year(p, rng);
    expect(p.athlete.history.length).toBe(1);
    expect(p.athlete.history[0].summary.length).toBeGreaterThan(5);
    expect(p.athlete.record.earnings).toBeGreaterThan(before);
    expect(p.athlete.endorsements).toBeGreaterThan(0);
    const poor = mk(44, "pro", { league: 2, rating: 80, contractYears: 3 }, 27);
    signContract(poor.p, poor.rng, offer({ league: 2, salary: 500_000, years: 3 }));
    poor.p.fame = 5;
    year(poor.p, poor.rng);
    expect(poor.p.athlete.endorsements).toBe(0);
  });
});

describe("injuries", () => {
  it("a serious injury costs seasons, then heals and leaves a lasting loss", () => {
    const { p, rng } = mk(50, "pro", { league: 1, contractYears: 5, rating: 70 }, 27);
    signContract(p, rng, offer({ years: 5, league: 1 }));
    p.athlete.injury = { label: "ACL rupture", severity: 3, yearsLeft: 2, plan: "rest", ratingLoss: 4, decided: true, age: 27 };
    year(p, rng);
    expect(p.athlete.history[0].place).toBeNull();
    expect(p.athlete.injury?.yearsLeft).toBe(1);
    year(p, rng);
    expect(p.athlete.injury).toBeNull();
    expect(p.athlete.history[1].summary).toMatch(/Missed/);
  });

  it("surgery shortens recovery and rehab trims the damage", () => {
    let shorter = 0;
    for (let s = 0; s < 40; s++) {
      const { p, rng } = mk(300 + s, "pro", { league: 1 }, 27);
      p.athlete.injury = { label: "ACL rupture", severity: 3, yearsLeft: 2, plan: "rest", ratingLoss: 4, decided: false, age: 27 };
      const res = chooseTreatment(p, "surgery", rng).player;
      if (res.athlete.injury!.yearsLeft === 1 && res.athlete.injury!.ratingLoss === 2) shorter++;
    }
    expect(shorter).toBeGreaterThan(25);
    const { p, rng } = mk(60, "pro", { league: 1 }, 27);
    p.athlete.injury = { label: "Torn labrum", severity: 3, yearsLeft: 2, plan: "rest", ratingLoss: 4, decided: false, age: 27 };
    const rehab = chooseTreatment(p, "rehab", rng).player;
    expect(rehab.athlete.injury!.ratingLoss).toBeLessThan(4);
    // locked once decided (except play-through)
    expect(chooseTreatment(rehab, "surgery", rng).player).toBe(rehab);
  });

  it("playing through the pain risks aggravating it, sometimes ending the career", () => {
    let aggravated = 0;
    let retired = 0;
    for (let s = 0; s < 80; s++) {
      const { p, rng } = mk(400 + s, "pro", { league: 1 }, 29);
      signContract(p, rng, offer({ years: 5 }));
      p.athlete.injury = { label: "Chronic back disc injury", severity: 3, yearsLeft: 2, plan: "play", ratingLoss: 4, decided: true, age: 29 };
      const notices = year(p, rng);
      if (notices.some((n) => "title" in n && n.title === "Aggravated Injury")) aggravated++;
      if (p.athlete.stage === "retired") retired++;
    }
    expect(aggravated).toBeGreaterThan(15);
    expect(retired).toBeGreaterThan(0);
    expect(retired).toBeLessThan(aggravated);
  });

  it("a career-threatening injury can end a career at once", () => {
    let ended = 0;
    for (let s = 0; s < 30; s++) {
      const { p, rng } = mk(500 + s, "pro", { league: 1 }, 31);
      signContract(p, rng, offer({ years: 4 }));
      p.flags.push("ath:inj4");
      year(p, rng);
      if (p.athlete.stage === "retired") {
        ended++;
        expect(p.currentJob).toBeNull();
        expect(p.flags).not.toContain("athlete");
      }
    }
    expect(ended).toBeGreaterThan(5);
  });

  it("minor injuries need no surgery; no treatment possible without an injury", () => {
    const { p, rng } = mk(61, "pro", { league: 1 }, 27);
    expect(chooseTreatment(p, "rest", rng).player).toBe(p);
    p.athlete.injury = { label: "Hamstring strain", severity: 1, yearsLeft: 0, plan: "rest", ratingLoss: 0, decided: false, age: 27 };
    expect(chooseTreatment(p, "surgery", rng).player).toBe(p);
  });
});

describe("contracts, decline and retirement", () => {
  it("contracts count down, expire into offers, and auto-extend if ignored", () => {
    const { p, rng } = mk(70, "pro", { league: 1, rating: 68 }, 26);
    signContract(p, rng, offer({ years: 1, salary: 100_000 }));
    let sawExpiring = false;
    for (let i = 0; i < 6 && !sawExpiring; i++) {
      year(p, rng);
      sawExpiring = p.athlete.expiring;
    }
    if (sawExpiring) {
      expect(p.athlete.offers.length).toBeGreaterThan(0);
      // ignore the offers: the next Age Up either extends or releases
      year(p, rng);
      expect(p.athlete.expiring && p.athlete.stage === "pro" && !p.athlete.freeAgent && p.athlete.contractYears <= 0).toBe(false);
    }
    expect(p.athlete.history.length).toBeGreaterThan(0);
  });

  it("a veteran is not renewed once the rating collapses, and ends up a free agent or retired", () => {
    let out = 0;
    for (let s = 0; s < 30; s++) {
      const { p, rng } = mk(600 + s, "pro", { league: 1, rating: 45, talent: 50, form: 30 }, 35);
      signContract(p, rng, offer({ years: 1 }));
      for (let i = 0; i < 6 && (p.athlete.stage === "pro" || p.athlete.stage === "semipro"); i++) year(p, rng);
      if (p.athlete.stage === "retired" || p.athlete.freeAgent || !p.currentJob) out++;
    }
    expect(out).toBeGreaterThan(24);
  });

  it("everyone retires by their sport's age limit, with no free pension", () => {
    const { p, rng } = mk(71, "pro", { league: 1, rating: 70 }, 38);
    signContract(p, rng, offer({ years: 5 }));
    for (let i = 0; i < 8 && p.athlete.stage !== "retired"; i++) year(p, rng);
    expect(p.athlete.stage).toBe("retired");
    expect(p.currentJob).toBeNull();
    expect(p.pension).toBe(0);
    expect(p.athlete.retiredAge).not.toBeNull();
    expect(p.flags).toContain("ex_athlete");
  });

  it("chosen retirement mid-contract costs a buy-out; after expiry it's free", () => {
    const { p, rng } = mk(72, "pro", { league: 2, rating: 78 }, 30);
    signContract(p, rng, offer({ league: 2, salary: 1_000_000, years: 3, bonus: 0 }));
    p.bankBalance = 1_000_000;
    const mid = retireFromSport(p).player;
    expect(mid.athlete.stage).toBe("retired");
    expect(mid.bankBalance).toBeLessThan(1_000_000);
    const q = mk(73, "pro", { league: 2, rating: 78, expiring: true, contractYears: 0 }, 30);
    signContract(q.p, q.rng, offer({ league: 2, salary: 1_000_000, years: 3, bonus: 0 }));
    q.p.athlete.expiring = true;
    q.p.athlete.contractYears = 0;
    q.p.bankBalance = 1_000_000;
    expect(retireFromSport(q.p).player.bankBalance).toBeGreaterThanOrEqual(1_000_000 - 1);
  });

  it("retired athletes get coaching or media offers and can take them", () => {
    let took = false;
    for (let s = 0; s < 40 && !took; s++) {
      const { p, rng } = mk(700 + s, "retired", { retiredAge: 34, post: "none" }, 36);
      p.athlete.record.proSeasons = 10;
      p.athlete.record.bestRating = 80;
      p.athlete.record.titles = 3;
      p.fame = 55;
      year(p, rng);
      const o = p.athlete.offers[0];
      if (o) {
        const res = acceptOffer(p, o.id, rng).player;
        expect(res.currentJob?.lineId === "sports_coach" || res.currentJob?.lineId === "sports_pundit").toBe(true);
        expect(res.athlete.post).not.toBe("none");
        took = true;
      }
    }
    expect(took).toBe(true);
  });

  it("comeback needs a decent rating, no job, and a year out", () => {
    const { p } = mk(74, "retired", { retiredAge: 30, rating: 70 }, 32);
    const res = comeback(p).player;
    expect(res.athlete.stage === "pro" || res.athlete.stage === "semipro").toBe(true);
    expect(res.athlete.freeAgent).toBe(true);
    const bad = mk(75, "retired", { retiredAge: 30, rating: 30 }, 32).p;
    expect(comeback(bad).player.athlete.stage).toBe("retired");
  });
});

describe("quitting", () => {
  it("quitting a youth programme hurts and locks you out for a year", () => {
    const { p } = mk(80, "youth", {}, 14);
    p.happiness = 80;
    const res = quitSport(p).player;
    expect(res.athlete.stage).toBe("none");
    expect(res.athlete.lockedUntil).toBeGreaterThan(14);
    expect(res.happiness).toBeLessThan(80);
    expect(commitBlocker(res)).toMatch(/until age/);
  });

  it("breaking a pro contract costs a buy-out, fame and a multi-year lock-out", () => {
    const { p, rng } = mk(81, "pro", { league: 2, rating: 78 }, 28);
    signContract(p, rng, offer({ league: 2, salary: 500_000, years: 3, bonus: 0 }));
    p.bankBalance = 600_000;
    p.fame = 50;
    expect(exitPreview(p)!.cost).toBeGreaterThan(100_000);
    const res = quitSport(p).player;
    expect(res.bankBalance).toBeLessThan(600_000 - 100_000);
    expect(res.fame).toBeLessThan(50);
    expect(res.athlete.lockedUntil).toBeGreaterThanOrEqual(28 + 4);
    expect(res.currentJob).toBeNull();
    expect(res.flags).toContain("burned_bridges");
  });

  it("leaving through the Work tab (generic quit) is reconciled as a terminated contract", () => {
    const { p, rng } = mk(82, "pro", { league: 1, rating: 68 }, 28);
    signContract(p, rng, offer({ years: 3 }));
    p.fame = 30;
    const quit = quitJob(p).player;
    expect(quit.currentJob).toBeNull();
    year(quit, rng);
    expect(quit.athlete.freeAgent || quit.athlete.stage === "retired").toBe(true);
    expect(quit.flags).not.toContain("athlete");
  });
});

describe("exclusivity", () => {
  it("a normal job blocks signing, and a contract blocks other jobs and businesses", () => {
    const { p, rng } = mk(90, "youth", {}, 20);
    p.currentJob = { id: "j", title: "Cashier", company: "MegaMart", salary: 20_000, performance: 60, tier: 0, lineId: "retail" };
    p.athlete.offers = [offer({ id: "pro1", kind: "semipro", league: 0, salary: 26_000 })];
    const res = acceptOffer(p, "pro1", rng);
    expect(res.player.athlete.stage).toBe("youth");
    expect(JSON.stringify(res.notices)).toMatch(/Quit first/);
    p.currentJob = null;
    const signed = acceptOffer(p, "pro1", rng).player;
    expect(signed.athlete.stage).toBe("semipro");
    expect(blockerFor(signed, "business")).toBeTruthy();
    expect(blockerFor(signed, "job")).toBeTruthy();
    signed.bankBalance = 500_000;
    expect(startBusiness(signed, "restaurant", "X").player.business).toBeNull();
    expect(applyForJob(signed, "retail", rng).player.currentJob?.lineId).toBe("athlete");
  });

  it("youth and college athletes may keep studying", () => {
    const { p } = mk(91, "college", { track: "college" }, 19);
    p.education.stage = "University";
    expect(blockerFor(p, "study")).toBeNull();
    expect(p.currentJob).toBeNull();
  });

  it("a pro contract can't be signed while running a business or signed to a label", () => {
    const { p, rng } = mk(92, "college", {}, 21);
    p.business = upgradeBusiness({ kind: "restaurant", name: "Chez Test", value: 100_000, staff: 0, locations: 1, lastProfit: 0, boost: 0, founded: 2020 } as never);
    p.athlete.offers = [offer({ id: "b", kind: "pro" })];
    expect(acceptOffer(p, "b", rng).player.athlete.stage).toBe("college");
  });
});

describe("dark side", () => {
  it("doping boosts you but eventually gets caught: ban, lost titles, lost contract", () => {
    let caught = 0;
    for (let s = 0; s < 40; s++) {
      const { p, rng } = mk(800 + s, "pro", { league: 3, rating: 90, doping: true }, 27);
      signContract(p, rng, offer({ league: 3, salary: 3_000_000, years: 6 }));
      p.athlete.doping = true;
      p.athlete.record.titles = 4;
      p.athlete.dopeTitles = 3;
      for (let i = 0; i < 8 && !p.flags.includes("doping_caught"); i++) year(p, rng);
      if (p.flags.includes("doping_caught")) {
        caught++;
        expect(p.athlete.banYears).toBeGreaterThan(0);
        expect(p.currentJob).toBeNull();
        expect(p.athlete.record.titles).toBeLessThan(4 + 8);
        expect(p.athlete.doping).toBe(false);
        expect(p.karma).toBeLessThan(50);
      }
    }
    expect(caught).toBeGreaterThan(30);
  });

  it("the doping event sets a flag that starts doping at the next Age Up", () => {
    const { p, rng } = mk(93, "pro", { league: 1 }, 25);
    signContract(p, rng, offer({ years: 3 }));
    const ev = EVENT_BY_ID.ath_doping_offer;
    const res = resolveEvent(p, ev, 0, rng).player;
    expect(res.flags).toContain("ath:dope");
    year(res, rng);
    expect(res.athlete.doping || res.flags.includes("doping_caught")).toBe(true);
  });

  it("a match-fixing scandal ends in a lifetime ban and a trial", () => {
    let busted = 0;
    for (let s = 0; s < 60; s++) {
      const { p, rng } = mk(900 + s, "pro", { league: 1 }, 25);
      signContract(p, rng, offer({ years: 6 }));
      p.flags.push("ath:fixed");
      for (let i = 0; i < 6 && !p.flags.includes("match_fixer"); i++) year(p, rng);
      if (p.flags.includes("match_fixer")) {
        busted++;
        expect(p.pendingTrial?.name).toBe("Match Fixing");
        expect(p.athlete.stage).toBe("retired");
        expect(p.athlete.banYears).toBeGreaterThanOrEqual(99);
      }
    }
    expect(busted).toBeGreaterThan(15);
  });

  it("a banned athlete can't commit or sign", () => {
    const { p } = mk(94, "none", { banYears: 3 }, 20);
    expect(commitBlocker(p)).toMatch(/banned/);
  });
});

describe("events", () => {
  it("all sports events resolve cleanly for every option", () => {
    const evs = Object.values(EVENT_BY_ID).filter((e) => e.id.startsWith("ath_"));
    expect(evs.length).toBeGreaterThanOrEqual(20);
    for (const e of evs) {
      for (let i = 0; i < e.options.length; i++) {
        const { p, rng } = mk(1000 + i, "pro", { league: 1 }, 30);
        signContract(p, rng, offer({ years: 3 }));
        p.bankBalance = 500_000;
        const res = resolveEvent(p, e, i, rng);
        expect(res.player).toBeTruthy();
        // and the next Age Up copes with whatever flags it left behind
        year(res.player, rng);
      }
    }
  });
});

describe("achievements, saves and heirs", () => {
  it("sports achievements read the athlete record", () => {
    const { p } = mk(95, "retired", {}, 40);
    expect(ACHIEVEMENT_BY_ID.first_title.check(p)).toBe(false);
    p.athlete.record.titles = 6;
    p.athlete.record.proSeasons = 11;
    p.athlete.record.medals = 1;
    p.athlete.record.bestRating = 93;
    p.athlete.record.earnings = 12_000_000;
    for (const id of ["first_title", "serial_winner", "iron_pro", "podium", "world_class", "sports_fortune", "pro_athlete"]) expect(ACHIEVEMENT_BY_ID[id].check(p), id).toBe(true);
  });

  it("old saves load: missing athlete field, bare {sport}, and signed athletes are migrated", () => {
    const { p } = mk(96, "none", {}, 30);
    const none = JSON.parse(exportSave(p, 1)) as { v: 1; player: Record<string, unknown>; rngState: number };
    delete none.player.athlete;
    expect(parseSave(JSON.stringify(none))!.player.athlete.stage).toBe("none");
    expect(parseSave(JSON.stringify(none))!.player.athlete.record.titles).toBe(0);

    const old = JSON.parse(exportSave(p, 1)) as { v: 1; player: Record<string, unknown>; rngState: number };
    old.player.athlete = { sport: "Tennis" };
    expect(parseSave(JSON.stringify(old))!.player.athlete.stage).toBe("none");
    expect(parseSave(JSON.stringify(old))!.player.athlete.sport).toBeNull();

    old.player.athlete = { sport: "Soccer" };
    old.player.currentJob = { id: "j", title: "Pro Player", company: "Union FC", salary: 420_000, performance: 60, tier: 1, lineId: "athlete" };
    (old.player.skills as Record<string, number>).athletics = 70;
    const migrated = parseSave(JSON.stringify(old))!.player;
    expect(migrated.athlete.stage).toBe("pro");
    expect(migrated.athlete.sport).toBe("Soccer");
    expect(migrated.athlete.rating).toBeGreaterThanOrEqual(70);
    expect(migrated.athlete.contractYears).toBeGreaterThan(0);
  });

  it("current-format saves round-trip, history and all", () => {
    const { p, rng } = mk(97, "pro", { league: 1 }, 27);
    signContract(p, rng, offer({ years: 3 }));
    year(p, rng);
    const back = parseSave(exportSave(p, 1))!.player;
    expect(back.athlete).toEqual(p.athlete);
    expect(hydrateAthlete(undefined, p).stage).toBe("none");
  });

  it("an heir starts with a clean sporting record", () => {
    const rng = makeRng(98);
    const old = createNewPlayer({ scenario: "wealthy", startYear: 2026, talents: NEUTRAL }, rng);
    old.age = 60;
    old.athlete.stage = "retired";
    old.athlete.sport = "Soccer";
    old.athlete.record.titles = 9;
    old.relatives.push({ id: "k1", relation: "Child", name: "Kid Test", age: 20, relationshipBar: 80, health: 90, alive: true, incomeTier: 3, gender: "Female", smarts: 60, looks: 60 });
    old.alive = false;
    const heir = continueAsChild(old, "k1", rng)!;
    expect(heir.athlete.stage).toBe("none");
    expect(heir.athlete.sport).toBeNull();
    expect(heir.athlete.record.titles).toBe(0);
  });

  it("full years never throw for an athlete bot across many seasons", () => {
    for (let s = 0; s < 12; s++) {
      const rng = makeRng(2000 + s);
      let p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
      for (let g = 0; g < 70 && p.alive; g++) {
        const res = ageUp(p, rng);
        p = res.player;
        for (const n of (res.notices ?? []) as Notice[]) if (n.kind === "event" && p.alive) p = resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng).player;
        if (p.pendingTrial) break;
        if (p.age === 9 && p.athlete.stage === "none") p = signWithClub(p, SPORTS[s % SPORTS.length], rng).player;
        if (p.athlete.stage !== "none") p = attendShowcase(p, rng).player;
        const o = p.athlete.offers[0];
        if (o) p = acceptOffer(p, o.id, rng).player;
      }
      expect(p.age).toBeGreaterThan(0);
    }
  }, 120_000);
});
