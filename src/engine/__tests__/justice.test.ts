import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import {
  bribeOfficial,
  commitCrime,
  postBail,
  representationOptions,
  resolveTrial,
  startTrial,
} from "../crime";
import {
  acquittalChance,
  careerBlocker,
  catchChance,
  expungeBlocker,
  expectedYears,
  fineFor,
  forfeit,
  hiringPenalty,
  officeBlocker,
  petitionExpungement,
  recordLevel,
  relocationBlocker,
  sealJuvenileRecord,
} from "../justice";
import {
  appealConviction,
  contactInnocenceProject,
  enrollPrisonProgram,
  joinPrisonGang,
  leavePrisonGang,
  paroleEligibleAt,
  paroleOdds,
  prisonVisit,
  processPrisonYear,
  releaseFromPrison,
  requestParole,
  takePrisonJob,
} from "../prison";
import { processJustice } from "../justiceYear";
import { exportSave, parseSave } from "../save";
import { hydratePrison } from "../justiceState";
import { CRIMES } from "@/data/crimes";
import { jobEligibility } from "../career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import type { PlayerState } from "@/types/game.types";

const adult = (seed = 1, country = "United States") => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, country }, rng);
  p.age = 30;
  p.education.degrees = ["highschool"];
  p.residence.country = country;
  return { rng, p };
};

const jail = (p: PlayerState, years = 10, served = 0, extra: Partial<NonNullable<PlayerState["prison"]>> = {}) => {
  p.isInPrison = true;
  p.prison = hydratePrison({ charge: "Burglary", sentenceYears: years, yearsServed: served, ...extra });
  return p;
};

describe("detection depends on circumstances", () => {
  it("heat, priors, probation and loose-lipped accomplices raise the odds of being caught", () => {
    const { p } = adult(1);
    const cold = catchChance(p, "burglary");
    p.justice.heat = 70;
    const hot = catchChance(p, "burglary");
    expect(hot).toBeGreaterThan(cold + 0.15);
    p.justice.heat = 0;
    p.justice.convictions = 4;
    expect(catchChance(p, "burglary")).toBeGreaterThan(cold);
    p.justice.convictions = 0;
    p.probation = { yearsLeft: 2, charge: "x" };
    expect(catchChance(p, "burglary")).toBeGreaterThan(cold);
    p.probation = null;
    p.justice.accomplices = 3;
    expect(catchChance(p, "burglary")).toBeGreaterThan(cold);
  });
  it("planning and crew help, but crew only on team crimes", () => {
    const { p } = adult(2);
    const base = catchChance(p, "burglary");
    expect(catchChance(p, "burglary", { plan: 2 })).toBeLessThan(base);
    expect(catchChance(p, "burglary", { crew: 2 })).toBeLessThan(base);
    expect(catchChance(p, "hacking", { crew: 2 })).toBe(catchChance(p, "hacking"));
  });
  it("police presence differs by country", () => {
    const us = adult(3, "United States").p;
    const mx = adult(3, "Mexico").p;
    expect(catchChance(us, "burglary")).toBeGreaterThan(catchChance(mx, "burglary"));
  });
  it("every crime attempt adds heat, which decays each year", () => {
    const { p, rng } = adult(4);
    const out = commitCrime(p, "burglary", rng, { crew: 1 }).player;
    expect(out.justice.heat).toBeGreaterThan(0);
    expect(out.justice.accomplices).toBe(1);
    const later = out.pendingTrial ? out : ageUp(out, makeRng(7)).player;
    expect(later.justice.heat).toBeLessThanOrEqual(out.justice.heat);
  });
  it("catch rates are sane for every crime (nobody is arrested 100% or never)", () => {
    const { p } = adult(5);
    p.currentJob = { id: "j", title: "x", company: "y", salary: 60_000, performance: 50, tier: 0, lineId: "retail" };
    for (const c of CRIMES) {
      const chance = catchChance(p, c.id);
      expect(chance, c.id).toBeGreaterThan(0.02);
      expect(chance, c.id).toBeLessThan(0.98);
    }
    expect(catchChance(p, "shoplifting")).toBeLessThan(catchChance(p, "bank_robbery"));
  });
});

describe("sentencing, bail and representation", () => {
  it("repeat offenders and habitual felons get harsher sentences; countries differ", () => {
    const { p } = adult(6);
    const charge = { name: "Burglary", description: "d", years: 4, severity: "serious" as const };
    const first = expectedYears(p, charge);
    p.justice.convictions = 3;
    p.justice.felonies = 3;
    expect(expectedYears(p, charge)).toBeGreaterThan(first);
    const us = adult(6, "United States").p;
    const se = adult(6, "Sweden").p;
    expect(expectedYears(us, charge)).toBeGreaterThan(expectedYears(se, charge));
  });
  it("a better lawyer improves acquittal odds; weak evidence helps; money buys representation", () => {
    const { p } = adult(7);
    p.bankBalance = 200_000;
    startTrial(p, { name: "Burglary", description: "d", years: 4, severity: "serious", evidence: 70 });
    const charge = p.pendingTrial!;
    const pub = acquittalChance(p, charge, "public");
    const exp = acquittalChance(p, charge, "expensive");
    const dream = acquittalChance(p, charge, "dream_team");
    expect(exp).toBeGreaterThan(pub);
    expect(dream).toBeGreaterThan(exp);
    expect(acquittalChance(p, { ...charge, evidence: 20 }, "public")).toBeGreaterThan(pub);
    expect(acquittalChance(p, { ...charge, innocent: true }, "public")).toBeGreaterThan(pub + 0.2);
    const options = representationOptions(p);
    expect(options.find((o) => o.id === "public")!.cost).toBe(0);
    expect(options.find((o) => o.id === "dream_team")!.cost).toBeGreaterThan(options.find((o) => o.id === "expensive")!.cost);
    const poor = { ...p, bankBalance: 100 } as PlayerState;
    expect(representationOptions(poor).find((o) => o.id === "expensive")!.affordable).toBe(false);
  });
  it("a law degree makes defending yourself viable", () => {
    const { p } = adult(8);
    startTrial(p, { name: "Fraud", description: "d", years: 3, severity: "serious", evidence: 50 });
    const layman = acquittalChance(p, p.pendingTrial!, "self");
    p.education.degrees.push("jd");
    expect(acquittalChance(p, p.pendingTrial!, "self")).toBeGreaterThan(layman + 0.2);
  });
  it("bail: minor first offences are released, serious charges need a bondsman, jail costs your job", () => {
    const { p } = adult(9);
    startTrial(p, { name: "Petty Theft", description: "d", years: 1, severity: "minor" });
    expect(p.pendingTrial!.bail).toMatchObject({ amount: 0, posted: true });
    const q = adult(10).p;
    q.bankBalance = 40_000;
    q.currentJob = { id: "j", title: "Clerk", company: "y", salary: 40_000, performance: 50, tier: 0, lineId: "retail" };
    startTrial(q, { name: "Burglary", description: "d", years: 4, severity: "serious", evidence: 60 });
    expect(q.pendingTrial!.bail!.posted).toBe(false);
    expect(q.pendingTrial!.bail!.amount).toBeGreaterThan(0);
    const bailed = postBail(q).player;
    expect(bailed.pendingTrial!.bail!.posted).toBe(true);
    expect(bailed.bankBalance).toBeLessThan(q.bankBalance);
    let kept = 0;
    let lost = 0;
    for (let s = 0; s < 40; s++) {
      const a = JSON.parse(JSON.stringify(bailed)) as PlayerState;
      const b = JSON.parse(JSON.stringify(q)) as PlayerState;
      const r1 = resolveTrial(a, "private", makeRng(s)).player;
      const r2 = resolveTrial(b, "private", makeRng(s)).player;
      if (!r1.isInPrison && r1.currentJob) kept++;
      if (!r2.currentJob) lost++;
    }
    expect(kept).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(15);
  });
  it("denied bail on heinous charges; juveniles are never bailed", () => {
    const { p } = adult(11);
    startTrial(p, { name: "Murder", description: "d", years: 30, severity: "heinous", evidence: 80 });
    expect(p.pendingTrial!.bail!.denied).toBe(true);
    const kid = adult(12).p;
    kid.age = 15;
    startTrial(kid, { name: "Vandalism", description: "d", years: 1, severity: "minor" });
    expect(kid.pendingTrial!.juvenile).toBe(true);
    expect(kid.pendingTrial!.bail!.posted).toBe(true);
  });
  it("fines scale with wealth", () => {
    const poor = adult(13).p;
    poor.bankBalance = 800;
    const rich = adult(13).p;
    rich.bankBalance = 2_000_000;
    rich.currentJob = { id: "j", title: "CEO", company: "y", salary: 500_000, performance: 50, tier: 4, lineId: "finance" };
    expect(fineFor(rich, 1_000)).toBeGreaterThan(fineFor(poor, 1_000) * 5);
  });
  it("fraud proceeds are forfeited on conviction, starting with cash then assets", () => {
    const { p } = adult(14);
    p.bankBalance = 10_000;
    p.vehicles.push({ id: "v", name: "Car", purchasePrice: 30_000, currentValue: 20_000, condition: 80, yearManufactured: 2024, loanBalance: 0, loanPaymentAnnual: 0, loanYearsLeft: 0, maintenanceWeight: 1, archetypeId: "a" });
    const taken = forfeit(p, 25_000);
    expect(taken).toBe(25_000);
    expect(p.vehicles).toHaveLength(0);
    expect(p.bankBalance).toBeGreaterThanOrEqual(0);
    const q = adult(15).p;
    q.bankBalance = 100_000;
    q.justice.proceeds = 60_000;
    startTrial(q, { name: "Embezzlement", description: "d", years: 6, severity: "serious", evidence: 90 });
    const out = resolveTrial(q, "plea", makeRng(1)).player;
    expect(out.justice.proceeds).toBe(0);
    expect(out.bankBalance).toBeLessThan(100_000 - 25_000);
  });
  it("bribes work where corruption is high and backfire elsewhere", () => {
    let mexicoWins = 0;
    let swedenWins = 0;
    for (let s = 0; s < 60; s++) {
      const m = adult(100 + s, "Mexico").p;
      m.bankBalance = 100_000;
      startTrial(m, { name: "Burglary", description: "d", years: 4, severity: "serious", evidence: 50 });
      if (!bribeOfficial(m, makeRng(s)).player.pendingTrial) mexicoWins++;
      const w = adult(100 + s, "Sweden").p;
      w.bankBalance = 100_000;
      startTrial(w, { name: "Burglary", description: "d", years: 4, severity: "serious", evidence: 50 });
      if (!bribeOfficial(w, makeRng(s)).player.pendingTrial) swedenWins++;
    }
    expect(mexicoWins).toBeGreaterThan(swedenWins + 10);
  });
  it("repeating a charge on probation or parole adds time", () => {
    const { p } = adult(16);
    p.probation = { yearsLeft: 3, charge: "Burglary", parole: true };
    startTrial(p, { name: "Burglary", description: "d", years: 4, severity: "serious" });
    expect(p.pendingTrial!.years).toBe(Math.ceil(4 * 1.5) + 3);
    expect(p.probation).toBeNull();
  });
});

describe("juvenile justice", () => {
  it("minors are tried in juvenile court, kept off the adult record, and sent to detention not prison", () => {
    const { p } = adult(20);
    p.age = 15;
    p.bankBalance = 0;
    startTrial(p, { name: "Burglary", description: "d", years: 6, severity: "serious", evidence: 90 });
    expect(p.pendingTrial!.juvenile).toBe(true);
    expect(p.criminalRecord).toHaveLength(0);
    expect(p.justice.juvenileRecord).toHaveLength(1);
    let detained = 0;
    for (let s = 0; s < 40; s++) {
      const q = JSON.parse(JSON.stringify(p)) as PlayerState;
      const out = resolveTrial(q, "public", makeRng(s)).player;
      if (out.isInPrison) {
        detained++;
        expect(out.prison!.juvenile).toBe(true);
        expect(out.prison!.sentenceYears).toBeLessThanOrEqual(3);
        expect(out.justice.convictions).toBe(0);
      }
    }
    expect(detained).toBeGreaterThan(3);
  });
  it("heinous crimes at 16+ go to adult court", () => {
    const { p } = adult(21);
    p.age = 17;
    startTrial(p, { name: "Murder", description: "d", years: 25, severity: "heinous" });
    expect(p.pendingTrial!.juvenile).toBe(false);
    expect(p.justice.adultTried).toBe(true);
    expect(recordLevel(p)).toBe("felony");
  });
  it("records are sealed at 18, unless serious or numerous", () => {
    let sealed = 0;
    for (let s = 0; s < 40; s++) {
      const { p } = adult(300 + s);
      p.justice.juvenileRecord = ["Vandalism (minor)"];
      if (sealJuvenileRecord(p, makeRng(s))) sealed += p.justice.recordSealed ? 1 : 0;
    }
    expect(sealed).toBeGreaterThan(25);
    const { p } = adult(22);
    p.justice.juvenileRecord = ["Burglary (serious)", "Arson (heinous)"];
    const line = sealJuvenileRecord(p, makeRng(1));
    expect(line).toContain("NOT");
    expect(p.justice.recordSealed).toBe(false);
    expect(recordLevel(p)).not.toBe("clean");
  });
  it("juvenile detention releases at 18 without an ex-con flag", () => {
    const { p, rng } = adult(23);
    p.age = 16;
    jail(p, 2, 0, { juvenile: true });
    let cur = p;
    for (let i = 0; i < 4 && cur.isInPrison; i++) cur = ageUp(cur, rng).player;
    expect(cur.isInPrison).toBe(false);
    expect(cur.flags).not.toContain("ex_con");
  });
});

describe("what a record closes off", () => {
  it("felonies permanently close certain careers; misdemeanours only the strictest", () => {
    const { p } = adult(30);
    p.education.degrees = ["highschool", "bachelor:arts", "md"];
    p.smarts = 90;
    expect(careerBlocker(p, "doctor")).toBeNull();
    p.justice.convictions = 1;
    expect(recordLevel(p)).toBe("misdemeanor");
    expect(careerBlocker(p, "doctor")).toBeNull();
    expect(careerBlocker(p, "police")).not.toBeNull();
    p.justice.felonies = 1;
    expect(recordLevel(p)).toBe("felony");
    expect(careerBlocker(p, "doctor")).not.toBeNull();
    expect(jobEligibility(p, CAREER_BY_ID.doctor).ok).toBe(false);
    expect(careerBlocker(p, "chef")).toBeNull();
    p.justice.violentConvictions = 1;
    expect(careerBlocker(p, "security")).not.toBeNull();
  });
  it("hiring penalty grows with severity and shrinks with rehabilitation", () => {
    const { p } = adult(31);
    expect(hiringPenalty(p)).toBe(0);
    p.justice.convictions = 1;
    p.justice.felonies = 1;
    const felony = hiringPenalty(p);
    expect(felony).toBeGreaterThanOrEqual(0.25);
    p.justice.reentry = 2;
    expect(hiringPenalty(p)).toBeGreaterThan(felony);
    p.justice.reentry = 0;
    p.justice.programs = ["trade", "ged"];
    expect(hiringPenalty(p)).toBeLessThan(felony);
  });
  it("blocks office, probation travel and strict borders", () => {
    const { p } = adult(32);
    expect(officeBlocker(p)).toBeNull();
    p.probation = { yearsLeft: 2, charge: "x" };
    expect(officeBlocker(p)).not.toBeNull();
    expect(relocationBlocker(p, "Canada")).not.toBeNull();
    p.probation = null;
    p.justice.convictions = 1;
    p.justice.felonies = 1;
    expect(relocationBlocker(p, "Canada")).toContain("refuses entry");
    expect(relocationBlocker(p, "Germany")).toBeNull();
    expect(officeBlocker(p)).not.toBeNull();
  });
  it("expungement needs seven clean years and money, then reopens doors", () => {
    const { p, rng } = adult(33);
    p.justice.convictions = 1;
    p.justice.felonies = 1;
    p.justice.lastConvictionYear = p.year - 2;
    p.flags.push("ex_con");
    expect(expungeBlocker(p)).toContain("stay clean");
    p.justice.lastConvictionYear = p.year - 8;
    p.bankBalance = 10_000;
    expect(expungeBlocker(p)).toBeNull();
    let cleared: PlayerState | null = null;
    for (let s = 0; s < 20 && !cleared; s++) {
      const out = petitionExpungement(p, makeRng(s + 1)).player;
      if (out.justice.expunged) cleared = out;
    }
    expect(cleared).not.toBeNull();
    expect(recordLevel(cleared!)).toBe("clean");
    expect(cleared!.flags).not.toContain("ex_con");
    expect(careerBlocker(cleared!, "doctor")).toBeNull();
    expect(rng).toBeTruthy();
    p.justice.violentConvictions = 1;
    expect(expungeBlocker(p)).toContain("Violent");
  });
});

describe("prison life", () => {
  it("programmes take time, then pay off: GED, trade certificate and a degree behind bars", () => {
    const { p, rng } = adult(40);
    p.education.degrees = [];
    jail(p, 12);
    let cur = enrollPrisonProgram(p, "ged").player;
    cur = enrollPrisonProgram(cur, "trade").player;
    expect(Object.keys(cur.prison!.progress!)).toHaveLength(2);
    expect(enrollPrisonProgram(cur, "therapy").player).toBe(cur); // timetable full
    cur = ageUp(cur, rng).player;
    expect(cur.prison!.programs).toContain("ged");
    expect(cur.prison!.programs).toContain("trade");
    expect(cur.education.degrees).toContain("highschool");
    cur = enrollPrisonProgram(cur, "degree").player;
    for (let i = 0; i < 4 && cur.isInPrison; i++) cur = ageUp(cur, rng).player;
    expect(cur.education.degrees.some((d) => d.startsWith("bachelor"))).toBe(true);
  });
  it("a prison job pays and improves conduct", () => {
    const { p, rng } = adult(41);
    jail(p, 6);
    const working = takePrisonJob(p, "workshop").player;
    expect(working.prison!.job).toBe("workshop");
    const out = ageUp(working, rng).player;
    expect(out.prison!.conduct!).toBeGreaterThanOrEqual(p.prison!.conduct!);
  });
  it("gangs protect but cost parole odds; leaving costs a beating", () => {
    const { p, rng } = adult(42);
    jail(p, 12, 8);
    const base = paroleOdds(p);
    const gang = joinPrisonGang(p, "brotherhood").player;
    expect(gang.prison!.gang).toBe("brotherhood");
    expect(gang.prison!.standing!).toBeGreaterThan(p.prison!.standing!);
    expect(paroleOdds(gang)).toBeLessThan(base);
    expect(gang.justice.gangTies).toBe("brotherhood");
    const out = leavePrisonGang(gang, rng).player;
    expect(out.prison!.gang).toBeNull();
    expect(out.health).toBeLessThan(gang.health);
  });
  it("visits preserve relationships, limited per year", () => {
    const { p } = adult(43);
    jail(p);
    const parent = p.relatives.find((r) => r.relation === "Parent")!;
    parent.relationshipBar = 40;
    const out = prisonVisit(p, parent.id).player;
    expect(out.relatives.find((r) => r.id === parent.id)!.relationshipBar).toBe(50);
    expect(prisonVisit(out, parent.id).player).toBe(out);
    parent.relationshipBar = 5;
    expect(prisonVisit(p, parent.id).player).toBe(p);
  });
  it("good conduct earns good-time release; gang members don't", () => {
    let early = 0;
    let gangEarly = 0;
    for (let s = 0; s < 10; s++) {
      const { p } = adult(50 + s);
      jail(p, 10, 0, { conduct: 90 });
      const g = adult(50 + s).p;
      jail(g, 10, 0, { conduct: 90, gang: "crew" });
      const a = { p, g };
      for (let y = 0; y < 9; y++) {
        processPrisonYear(a.p, makeRng(s * 31 + y), []);
        processPrisonYear(a.g, makeRng(s * 31 + y), []);
        if (!a.p.isInPrison) break;
        if (a.p.prison) a.p.prison.conduct = 90;
        if (a.g.prison) a.g.prison.conduct = 90;
      }
      if (!a.p.isInPrison && a.p.age >= 0 && a.p.justice.releasedYear !== null) early++;
      if (!a.g.isInPrison) gangEarly++;
    }
    expect(early).toBeGreaterThan(5);
    expect(gangEarly).toBe(0);
  });
  it("solitary hurts and counts against you", () => {
    const { p, rng } = adult(44);
    jail(p, 6, 0, { solitary: 1, conduct: 70 });
    const out = ageUp(p, rng).player;
    expect(out.health).toBeLessThan(p.health + 1);
    expect(out.prison!.solitary).toBe(0);
    const clean = jail(adult(44).p, 12, 7);
    const hole = jail(adult(44).p, 12, 7, { solitary: 2 });
    expect(paroleOdds(hole)).toBeLessThan(paroleOdds(clean));
  });
});

describe("parole", () => {
  it("is only heard after the eligibility period, once a year", () => {
    const { p, rng } = adult(60);
    jail(p, 10, 2);
    const early = requestParole(p, rng);
    expect(early.player).toBe(p);
    expect(early.notices![0].kind).toBe("info");
    expect(paroleEligibleAt(p.prison!)).toBe(5);
    p.prison!.yearsServed = 5;
    const first = requestParole(p, makeRng(1)).player;
    expect(requestParole(first, makeRng(2)).player).toBe(first);
  });
  it("behaviour, programmes and work raise the odds; a violent charge lowers them", () => {
    const a = jail(adult(61).p, 10, 6, { conduct: 30 });
    const b = jail(adult(61).p, 10, 6, { conduct: 95, programs: ["therapy", "trade"], job: "kitchen" });
    expect(paroleOdds(b)).toBeGreaterThan(paroleOdds(a) + 0.2);
    const v = jail(adult(61).p, 10, 6, { conduct: 95, programs: ["therapy", "trade"], job: "kitchen", charge: "Armed Robbery" });
    expect(paroleOdds(v)).toBeLessThan(paroleOdds(b));
  });
  it("a granted parole releases you under supervision, and violations send you back", () => {
    let paroled: PlayerState | null = null;
    for (let s = 0; s < 40 && !paroled; s++) {
      const { p } = adult(70 + s);
      jail(p, 10, 6, { conduct: 100, programs: ["therapy", "trade", "ged"], job: "kitchen" });
      const out = requestParole(p, makeRng(s)).player;
      if (!out.isInPrison) paroled = out;
    }
    expect(paroled).not.toBeNull();
    expect(paroled!.probation?.parole).toBe(true);
    expect(paroled!.flags).toContain("ex_con");
    expect(paroled!.justice.reentry).toBeGreaterThan(0);
    // Unemployed, with a drug habit: two violations revoke parole.
    let back = 0;
    for (let s = 0; s < 40; s++) {
      const q = JSON.parse(JSON.stringify(paroled)) as PlayerState;
      q.currentJob = null;
      q.vices.drugs = 60;
      const rng = makeRng(s);
      for (let y = 0; y < 4 && !q.isInPrison; y++) processJustice(q, rng, []);
      if (q.isInPrison) back++;
    }
    expect(back).toBeGreaterThan(10);
  });
});

describe("wrongful convictions", () => {
  it("innocent defendants are acquitted more often, and wrongful convictions can be exonerated with compensation", () => {
    const { p } = adult(80);
    startTrial(p, { name: "Armed Robbery", description: "d", years: 6, severity: "serious", evidence: 60, innocent: true });
    const innocent = acquittalChance(p, p.pendingTrial!, "private");
    expect(innocent).toBeGreaterThan(acquittalChance(p, { ...p.pendingTrial!, innocent: false }, "private") + 0.2);
    p.bankBalance = 1_000;
    let wrongful: PlayerState | null = null;
    for (let s = 0; s < 60 && !wrongful; s++) {
      const q = JSON.parse(JSON.stringify(p)) as PlayerState;
      const out = resolveTrial(q, "plea", makeRng(s)).player;
      if (out.prison?.wrongful) wrongful = out;
    }
    expect(wrongful).not.toBeNull();
    const before = wrongful!.bankBalance;
    let freed: PlayerState | null = null;
    for (let s = 0; s < 60 && !freed; s++) {
      const q = JSON.parse(JSON.stringify(wrongful)) as PlayerState;
      q.prison!.yearsServed = 3;
      const out = contactInnocenceProject(q, makeRng(s)).player;
      if (!out.isInPrison) freed = out;
    }
    expect(freed).not.toBeNull();
    expect(freed!.bankBalance).toBeGreaterThan(before + 100_000);
    expect(freed!.justice.exonerations).toBe(1);
    expect(freed!.criminalRecord).toHaveLength(0);
    expect(freed!.flags).not.toContain("ex_con");
  });
  it("normal appeals can shorten a sentence; wrongful ones can overturn it", () => {
    let cut = 0;
    for (let s = 0; s < 80; s++) {
      const { p } = adult(90 + s);
      p.bankBalance = 50_000;
      jail(p, 10, 2);
      const out = appealConviction(p, makeRng(s), true).player;
      if (out.prison && out.prison.sentenceYears < 10) cut++;
    }
    expect(cut).toBeGreaterThan(0);
    const { p, rng } = adult(91);
    jail(p, 10, 2, { wrongful: true });
    const notices: Parameters<typeof releaseFromPrison>[3] = [];
    releaseFromPrison(p, "exonerated", rng, notices);
    expect(p.isInPrison).toBe(false);
  });
});

describe("snitches", () => {
  it("accomplices eventually talk, and the count drops once they do", () => {
    let flipped = 0;
    for (let s = 0; s < 80; s++) {
      const { p } = adult(200 + s);
      p.justice.accomplices = 4;
      p.justice.heat = 40;
      processJustice(p, makeRng(s), []);
      if (p.pendingTrial?.name === "Conspiracy") {
        flipped++;
        expect(p.justice.accomplices).toBe(3);
        expect(p.pendingTrial.evidence).toBeGreaterThanOrEqual(80);
      }
    }
    expect(flipped).toBeGreaterThan(3);
  });
});

describe("old saves", () => {
  it("hydrate every new field, and infer a record from the old flags", () => {
    const { p } = adult(300);
    p.criminalRecord = ["Burglary", "Assault"];
    p.flags.push("ex_con");
    const raw = JSON.parse(exportSave(p, 5)) as { player: Record<string, unknown> };
    for (const k of ["justice", "mob", "spy", "statecraft"]) delete raw.player[k];
    const loaded = parseSave(JSON.stringify(raw))!.player;
    expect(loaded.justice.heat).toBe(0);
    expect(loaded.justice.convictions).toBe(2);
    expect(loaded.justice.felonies).toBeGreaterThan(0);
    expect(recordLevel(loaded)).toBe("felony");
    expect(loaded.mob.loyalty).toBe(50);
    expect(loaded.spy.cover).toBe(80);
    expect(loaded.statecraft.stances.economy).toBe(0);
    expect(loaded.statecraft.donors).toEqual([]);
    // And the game still runs.
    expect(ageUp(loaded, makeRng(1)).player.age).toBe(loaded.age + 1);
  });
  it("fills prison fields on an old sentence", () => {
    const { p } = adult(301);
    p.isInPrison = true;
    p.prison = { charge: "Burglary", sentenceYears: 5, yearsServed: 1 };
    const raw = JSON.parse(exportSave(p, 5));
    const loaded = parseSave(JSON.stringify(raw))!.player;
    expect(loaded.prison!.conduct).toBe(70);
    expect(loaded.prison!.programs).toEqual([]);
    const out = ageUp(loaded, makeRng(2)).player;
    expect(out.prison === null || out.prison.yearsServed === 2).toBe(true);
  });
});
