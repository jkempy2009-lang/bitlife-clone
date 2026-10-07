import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, netWorth } from "../state";
import { ageUp } from "../ageUp";
import { INVESTMENTS, advanceClimate, divest, housingIndex, invest, portfolioValue, relocate, setRentTier, yearReturn } from "../world";
import { addVice, hasAnyVice, processVices, quitVice, rehab } from "../vices";
import { HOBBIES, hobbyIncome, practiceHobby, processHobbies } from "../hobbies";
import { canRun, giveSpeech, runForOffice } from "../politics";
import { joinMob, processMob } from "../underworld";
import { resolveTrial, startTrial } from "../crime";
import { ACHIEVEMENTS } from "@/data/achievements";
import { checkAchievements } from "../achievements";
import { adoptChild, maybeGrandchild } from "../social";
import { continueAsChild } from "../legacy";
import { incomeTaxFor } from "@/data/countries";
import type { PlayerState } from "@/types/game.types";

const base = (seed = 1) => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 30;
  p.education.degrees = ["highschool"];
  return { rng, p };
};

describe("economy & investments", () => {
  it("housing index always stays inside -3%..+6%", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 500; i++) for (const c of ["boom", "normal", "recession"] as const) {
      const v = housingIndex(c, rng);
      expect(v).toBeGreaterThanOrEqual(-0.03);
      expect(v).toBeLessThanOrEqual(0.06);
    }
  });
  it("recessions hurt stocks on average, bonds barely", () => {
    const rng = makeRng(2);
    const avg = (id: string, c: "boom" | "recession") => Array.from({ length: 800 }, () => yearReturn(id, c, rng)).reduce((a, b) => a + b, 0) / 800;
    expect(avg("index", "recession")).toBeLessThan(avg("index", "boom"));
    expect(avg("bonds", "recession")).toBeGreaterThan(-0.05);
  });
  it("buying and selling applies capital gains tax", () => {
    const { p } = base(3);
    p.bankBalance = 100_000;
    const bought = invest(p, "index", 50_000).player;
    expect(bought.bankBalance).toBe(50_000);
    expect(netWorth(bought)).toBe(100_000);
    bought.investments.index.value = 80_000; // pretend it grew
    const sold = divest(bought, "index").player;
    // gain 30,000 taxed at 15% = 4,500
    expect(sold.bankBalance).toBe(50_000 + 80_000 - 4_500);
    expect(portfolioValue(sold)).toBe(0);
    expect(INVESTMENTS.length).toBeGreaterThan(2);
  });
  it("climate eventually changes and logs headlines", () => {
    const { rng, p } = base(4);
    const notices: NonNullable<Parameters<typeof advanceClimate>[2]> = [];
    for (let i = 0; i < 60; i++) advanceClimate(p, rng, notices);
    expect(notices.length).toBeGreaterThan(0);
  });
});

describe("housing & relocation", () => {
  it("renting a nicer place changes yearly costs; relocating changes tax residence and drops the job", () => {
    const { rng, p } = base(5);
    p.bankBalance = 50_000;
    p.currentJob = { id: "j", title: "x", company: "y", salary: 80_000, performance: 50, tier: 0, lineId: "retail" };
    const nicer = setRentTier(p, 3).player;
    expect(nicer.residence.rentTier).toBe(3);
    const moved = relocate(nicer, "Sweden", rng).player;
    expect(moved.residence.country).toBe("Sweden");
    expect(moved.currentJob).toBeNull();
    expect(incomeTaxFor(moved.residence.country, 100_000)).not.toBe(incomeTaxFor("United States", 100_000));
  });
  it("doesn't allow a relocation without funds", () => {
    const { rng, p } = base(6);
    p.bankBalance = 10;
    expect(relocate(p, "Japan", rng).player.residence.country).toBe(p.residence.country);
  });
});

describe("vices", () => {
  it("rehab cuts habits, cost enforced", () => {
    const { p } = base(7);
    addVice(p, "alcohol", 60);
    expect(hasAnyVice(p)).toBe(true);
    p.bankBalance = 100;
    expect(rehab(p).player.vices.alcohol).toBe(60);
    p.bankBalance = 9_000;
    expect(rehab(p).player.vices.alcohol).toBe(24);
  });
  it("heavy habits damage health each year", () => {
    const { rng, p } = base(8);
    addVice(p, "smoking", 80);
    addVice(p, "drugs", 50);
    p.health = 90;
    processVices(p, rng, []);
    expect(p.health).toBeLessThan(90);
  });
  it("quitting is limited to once a year per vice", () => {
    const { rng, p } = base(9);
    addVice(p, "gambling", 30);
    const first = quitVice(p, "gambling", rng).player;
    const second = quitVice(first, "gambling", rng).player;
    expect(second.vices.gambling).toBe(first.vices.gambling);
  });
});

describe("hobbies", () => {
  it("practice grows skill, milestones pay once, unpractised skills fade", () => {
    const { rng, p } = base(10);
    p.hobbies.painting = 58;
    const after = practiceHobby(p, "painting", rng).player;
    expect(after.hobbies.painting).toBeGreaterThan(58);
    const notices: NonNullable<Parameters<typeof processHobbies>[2]> = [];
    const bank0 = after.bankBalance;
    after.hobbies.painting = 65;
    processHobbies(after, { "hobby:painting": 1 }, notices);
    expect(after.bankBalance).toBe(bank0 + 3_000);
    processHobbies(after, { "hobby:painting": 1 }, notices);
    expect(after.bankBalance).toBe(bank0 + 3_000);
    processHobbies(after, {}, notices);
    expect(after.hobbies.painting).toBe(63);
    expect(hobbyIncome(after)).toBeGreaterThan(0);
    expect(HOBBIES.length).toBeGreaterThan(5);
  });
  it("max three hobby sessions a year", () => {
    const { rng, p } = base(11);
    let cur = p;
    for (const h of HOBBIES.slice(0, 5)) cur = practiceHobby(cur, h.id, rng).player;
    expect(cur.annual.hobbies).toBe(3);
  });
});

describe("politics", () => {
  it("requires cash, age and smarts; winning installs the office", () => {
    const { p } = base(12);
    p.smarts = 80;
    p.bankBalance = 1_000;
    expect(canRun(p).ok).toBe(false);
    p.bankBalance = 50_000;
    p.politics.popularity = 100;
    p.skills.charisma = 100;
    expect(canRun(p).ok).toBe(true);
    let won = false;
    for (let s = 0; s < 30 && !won; s++) {
      const out = runForOffice({ ...p, annual: {} }, makeRng(s)).player;
      if (out.currentJob?.lineId === "politics") won = true;
    }
    expect(won).toBe(true);
    expect(giveSpeech(p, makeRng(1)).player.politics.popularity).toBeGreaterThan(p.politics.popularity - 1);
  });
});

describe("underworld", () => {
  it("only open to low karma; mob pay is off the books", () => {
    const { rng, p } = base(13);
    p.karma = 90;
    expect(joinMob(p, rng).player.currentJob).toBeNull();
    p.karma = 10;
    p.stats.crimesCommitted = 10;
    let joined: PlayerState | null = null;
    for (let s = 0; s < 20 && !joined; s++) {
      const out = joinMob({ ...p, annual: {} }, makeRng(s + 50)).player;
      if (out.currentJob?.lineId === "mafia") joined = out;
    }
    expect(joined).not.toBeNull();
    const notices: NonNullable<Parameters<typeof processMob>[2]> = [];
    const karma0 = joined!.karma;
    processMob(joined!, makeRng(1), notices);
    expect(joined!.karma).toBeLessThan(karma0);
  });
});

describe("justice depth", () => {
  it("plea bargain halves the sentence; probation on reoffending raises it", () => {
    const { p } = base(14);
    p.bankBalance = 5_000;
    startTrial(p, { name: "Robbery", description: "d", years: 8, severity: "serious" });
    const out = resolveTrial(p, "plea", makeRng(3)).player;
    expect(out.isInPrison).toBe(true);
    expect(out.prison?.sentenceYears).toBe(4);
    const { p: q } = base(15);
    q.probation = { yearsLeft: 2, charge: "Petty Theft" };
    startTrial(q, { name: "Vandalism", description: "d", years: 2, severity: "minor" });
    expect(q.pendingTrial?.years).toBe(3);
    expect(q.probation).toBeNull();
  });
  it("minor convictions sometimes end in probation", () => {
    let probation = 0;
    for (let s = 0; s < 40; s++) {
      const { p } = base(100 + s);
      p.bankBalance = 20_000;
      startTrial(p, { name: "Petty Theft", description: "d", years: 1, severity: "minor" });
      const out = resolveTrial(p, "self", makeRng(s)).player;
      if (out.probation) probation++;
    }
    expect(probation).toBeGreaterThan(5);
  });
});

describe("family depth", () => {
  it("adoption costs money and adds a child; grandchildren eventually arrive", () => {
    const { rng, p } = base(16);
    p.bankBalance = 20_000;
    const out = adoptChild(p, rng).player;
    expect(out.relatives.filter((r) => r.relation === "Child")).toHaveLength(1);
    expect(out.bankBalance).toBe(5_000);
    const parent = { ...out, age: 60 };
    parent.relatives[parent.relatives.length - 1] = { ...parent.relatives[parent.relatives.length - 1], age: 28 };
    let got = false;
    for (let i = 0; i < 100 && !got; i++) got = !!maybeGrandchild(parent, makeRng(i));
    expect(got).toBe(true);
  });
  it("grandparents are created at birth sometimes and parents become grandparents for the heir", () => {
    const rng = makeRng(17);
    let withGp = 0;
    for (let i = 0; i < 20; i++) {
      const pl = createNewPlayer({ scenario: "average", startYear: 2026 }, makeRng(i + 300));
      if (pl.relatives.some((r) => r.relation === "Grandparent")) withGp++;
    }
    expect(withGp).toBeGreaterThan(10);
    const { p } = base(18);
    p.age = 70;
    p.alive = false;
    p.deathYear = p.year;
    p.relatives.push({ id: "k", relation: "Child", name: "Kid X", age: 40, relationshipBar: 70, health: 80, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 50 });
    p.relatives.push({ id: "pa", relation: "Parent", name: "Old Parent", age: 92, relationshipBar: 70, health: 20, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 50 });
    p.investments.index = { value: 100_000, basis: 50_000 };
    const next = continueAsChild(p, "k", rng)!;
    expect(next.relatives.some((r) => r.relation === "Grandparent" && r.name === "Old Parent")).toBe(true);
    expect(next.investments.index.value).toBe(90_000);
  });
});

describe("achievements", () => {
  it("unlock once and log", () => {
    const { p } = base(19);
    p.bankBalance = 2_000_000;
    const notices: NonNullable<Parameters<typeof checkAchievements>[1]> = [];
    checkAchievements(p, notices);
    expect(p.achievements).toContain("millionaire");
    const n = notices.length;
    checkAchievements(p, notices);
    expect(notices.length).toBe(n);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(40);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it("age-up never throws with the whole expansion active", () => {
    const { rng, p } = base(20);
    p.hobbies = { painting: 70, coding: 80 };
    addVice(p, "alcohol", 60);
    addVice(p, "gambling", 40);
    p.investments = { crypto: { value: 5_000, basis: 5_000 } };
    let cur = p;
    for (let i = 0; i < 40 && cur.alive; i++) cur = ageUp(cur, rng).player;
    expect(Number.isFinite(netWorth(cur))).toBe(true);
  });
});
