import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { ageUp, finalize } from "../ageUp";
import { createNewPlayer, netWorth } from "../state";
import { resolveEvent } from "../events";
import { resolveTrial, commitCrime, attemptEscape, startRiot, workOutYard, requestParole } from "../crime";
import { CAREER_LINES, UNIVERSITY_MAJORS } from "@/data/careersRegistry";
import {
  applyForJob, auditionContract, auditionForLead, enrollProgram, formBand, holdGala, passDecree, practiceMusic,
  quitJob, recordAlbum, retire, shootCommercial, studyHarder, workHarder, writeMemoir, executeCitizen,
} from "../career";
import { buyCar, buyHouse, carInventory, houseInventory, renovate, sellCar, takeLoan, repayLoan } from "../assets";
import { doLeisure, doWellness, plasticSurgery, visitDoctor, visitWitchDoctor, buyLotteryTicket } from "../activities";
import { dateNight, interact, meetSomeone, propose, tryForBaby } from "../social";
import { BUSINESS_TYPES, brandCollab, postContent, signWithClub, startBusiness, startChannel, trainAthletics, workOnBusiness, investInBusiness } from "../paths";
import { SPORTS, acceptOffer, attendShowcase, chooseTreatment, comeback, declineOffer, fireAgent, hireAgent, negotiateOffer, quitSport, retireFromSport, setEffort, stopDoping } from "../athlete";
import { DECREES } from "@/data/careersRegistry";
import { continueAsChild, heirs } from "../legacy";
import { divest, invest, relocate, setRentTier, INVESTMENTS } from "../world";
import { quitVice, rehab } from "../vices";
import { HOBBIES, practiceHobby } from "../hobbies";
import { charityDrive, giveSpeech, runForOffice } from "../politics";
import { joinMob, leaveMob } from "../underworld";
import { adoptChild } from "../social";
import { runMission } from "../spy";
import { discussDesires, setIntimacyPrefs, shareExperience, toggleGender, toggleInterest } from "../desire";
import { EXPERIENCES, INTERESTS } from "@/data/experiences";
import { closeRelationship } from "../intimacy";
import { askThreesome, endLover, hookUp, leaveForLover, makeLove, proposeOpenRelationship, romanticGetaway, seduce, spiceItUp, swingerClub } from "../intimacy";
import { arson, assault, blackmail, commitMurder, kidnap, targetsFor } from "../violence";
import { appealSentence } from "../crime";
import { adoptPet } from "../social";
import { blackjackClear, blackjackDeal, blackjackHit, blackjackStand } from "../blackjack";
import { joinParty, PARTIES } from "../politics";
import { expandBusiness, fireStaff, hireStaff, runMarketing } from "../paths";
import {
  acquireCompetitor, closeBusiness, complianceAudit, diversifyBusiness, fileBankruptcy, fireManager, handToManager, hireManager, pivotBusiness,
  raiseFunding, renovateBusiness, repayBusinessLoan, sellBusiness, sellFranchise, setInsurance, setPayout, setPrice, setRescue, takeBusinessLoan,
  trainStaff, upgradeProduct,
} from "../paths";
import { COUNTRIES } from "@/data/countries";
import type { ActionResult, Notice, PlayerState } from "@/types/game.types";

function run(p: PlayerState, rng: Rng, fn: (p: PlayerState, rng: Rng) => ActionResult): { p: PlayerState; notices: NonNullable<ActionResult["notices"]> } {
  const res = fn(p, rng);
  const extra: NonNullable<ActionResult["notices"]> = [];
  if (res.player !== p) finalize(res.player, extra);
  return { p: res.player, notices: [...(res.notices ?? []), ...extra] };
}

function checkInvariants(p: PlayerState) {
  for (const k of ["happiness", "health", "smarts", "looks", "karma", "fame", "royalRespect"] as const) {
    expect(Number.isFinite(p[k]), `${k} finite`).toBe(true);
    expect(p[k]).toBeGreaterThanOrEqual(0);
    expect(p[k]).toBeLessThanOrEqual(100);
  }
  expect(Number.isFinite(p.bankBalance)).toBe(true);
  expect(p.bankBalance).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(netWorth(p))).toBe(true);
  expect(p.creditScore).toBeGreaterThanOrEqual(300);
  expect(p.creditScore).toBeLessThanOrEqual(850);
  for (const r of p.relatives) expect(r.relationshipBar).toBeGreaterThanOrEqual(0);
  if (p.isInPrison) expect(p.currentJob).toBeNull();
  const a = p.athlete;
  for (const k of ["rating", "form", "consistency", "exposure", "talent"] as const) {
    expect(Number.isFinite(a[k]), `athlete.${k} finite`).toBe(true);
    expect(a[k]).toBeGreaterThanOrEqual(0);
    expect(a[k]).toBeLessThanOrEqual(100);
  }
  // A sports contract only exists inside a contracted stage, and nobody holds a second job beside it.
  if (p.currentJob?.lineId === "athlete") expect(["semipro", "pro"]).toContain(a.stage);
  if (a.stage === "semipro" || a.stage === "pro") expect(p.business).toBeNull();
  if (a.stage === "retired") expect(p.currentJob?.lineId).not.toBe("athlete");
  expect(a.history.length).toBeLessThanOrEqual(40);
  // A business is a full-time commitment: it never coexists with a job.
  if (p.business) {
    expect(p.currentJob, "business and job at once").toBeNull();
    const b = p.business;
    for (const k of ["cash", "debt", "value", "assets", "basis", "revenue", "customers", "reputation", "quality", "morale", "fit"] as const) expect(Number.isFinite(b[k]), `business.${k}`).toBe(true);
    expect(b.ownerShare).toBeGreaterThan(0);
    expect(b.ownerShare).toBeLessThanOrEqual(1);
    expect(b.debt).toBeGreaterThanOrEqual(0);
    expect(b.staff).toBeGreaterThanOrEqual(0);
    expect(b.reputation).toBeLessThanOrEqual(100);
    expect(p.flags).toContain("business_owner");
  } else {
    expect(p.flags).not.toContain("business_owner");
  }
}

function playBot(seed: number, scenario: "random" | "royal" | "wealthy"): PlayerState {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario, startYear: 2026 }, rng);
  for (let guard = 0; guard < 150 && p.alive; guard++) {
    const res = ageUp(p, rng);
    p = res.player;
    checkInvariants(p);
    const pending = [...(res.notices ?? [])] as Notice[];
    for (const n of pending) {
      if (n.kind === "event" && p.alive) {
        p = run(p, rng, (pl, r) => resolveEvent(pl, n.event, r.int(0, n.event.options.length - 1), r)).p;
      }
    }
    if (!p.alive) break;
    if (p.pendingTrial) {
      p = run(p, rng, (pl, r) => resolveTrial(pl, rng.pick(["expensive", "public", "self", "plea"]), r)).p;
    }
    // random actions
    const actions: Array<(pl: PlayerState, r: Rng) => ActionResult> = [
      (pl) => studyHarder(pl),
      (pl, r) => enrollProgram(pl, r.pick(["University", "MedicalSchool", "LawSchool"] as const), r.pick(UNIVERSITY_MAJORS).id, r),
      (pl, r) => applyForJob(pl, r.pick(CAREER_LINES).id, r),
      (pl, r) => workHarder(pl, r),
      (pl) => (rng.chance(0.1) ? quitJob(pl) : { player: pl }),
      (pl) => retire(pl),
      (pl, r) => doWellness(pl, r.pick(["gym", "meditate", "walk", "library"] as const)),
      (pl, r) => doLeisure(pl, r.pick(["vacation", "party", "therapy", "volunteer", "sidehustle"] as const), r),
      (pl, r) => commitCrime(pl, r.pick(["shoplifting", "car_theft", "burglary", "hacking", "bank_robbery"]), r),
      (pl, r) => plasticSurgery(pl, r.pick(["botox", "facelift", "rhinoplasty"]), r),
      (pl, r) => visitDoctor(pl, pl.diseases[0]?.id ?? null, r),
      (pl, r) => visitWitchDoctor(pl, r),
      (pl, r) => buyLotteryTicket(pl, r),
      (pl, r) => buyCar(pl, r.pick(carInventory(pl.year, pl.id)), r.chance(0.5), r),
      (pl, r) => buyHouse(pl, r.pick(houseInventory(pl.year, pl.id)), r.chance(0.7), r),
      (pl) => (pl.properties[0] ? renovate(pl, pl.properties[0].id) : { player: pl }),
      (pl) => (pl.vehicles[0] && rng.chance(0.3) ? sellCar(pl, pl.vehicles[0].id) : { player: pl }),
      (pl) => takeLoan(pl, 5000),
      (pl) => repayLoan(pl, 2000),
      (pl) => (pl.relatives[0] ? interact(pl, rng.pick(pl.relatives).id, rng.pick(["spend", "converse", "compliment", "insult", "askMoney"] as const), rng) : { player: pl }),
      (pl, r) => meetSomeone(pl, r.pick(["friend", "date"] as const), r),
      (pl, r) => propose(pl, r),
      (pl, r) => tryForBaby(pl, r),
      (pl) => dateNight(pl),
      (pl, r) => auditionForLead(pl, r),
      (pl) => shootCommercial(pl),
      (pl, r) => writeMemoir(pl, r),
      (pl, r) => practiceMusic(pl, r),
      (pl) => formBand(pl, rng.int(0, 100)),
      (pl, r) => auditionContract(pl, r.pick(["solo", "band"] as const), r.int(0, 100), r),
      (pl) => recordAlbum(pl, "Rock", ""),
      (pl) => holdGala(pl),
      (pl, r) => executeCitizen(pl, r),
      (pl) => passDecree(pl, rng.pick(DECREES).id),
      (pl, r) => startBusiness(pl, r.pick(BUSINESS_TYPES).id, "", r),
      (pl) => workOnBusiness(pl),
      (pl) => investInBusiness(pl, 10_000),
      (pl, r) => startChannel(pl, r),
      (pl, r) => postContent(pl, r),
      (pl) => brandCollab(pl),
      (pl, r) => trainAthletics(pl, r),
      (pl, r) => signWithClub(pl, r.pick(SPORTS), r),
      (pl, r) => (pl.athlete.offers[0] ? acceptOffer(pl, r.pick(pl.athlete.offers).id, r) : { player: pl }),
      (pl, r) => (pl.athlete.offers[0] ? negotiateOffer(pl, r.pick(pl.athlete.offers).id, r) : { player: pl }),
      (pl) => (pl.athlete.offers[0] && rng.chance(0.3) ? declineOffer(pl, pl.athlete.offers[0].id) : { player: pl }),
      (pl, r) => chooseTreatment(pl, r.pick(["rest", "rehab", "surgery", "play"] as const), r),
      (pl, r) => attendShowcase(pl, r),
      (pl) => (rng.chance(0.15) ? quitSport(pl) : { player: pl }),
      (pl) => (rng.chance(0.2) ? retireFromSport(pl) : { player: pl }),
      (pl) => comeback(pl),
      (pl) => (rng.chance(0.5) ? hireAgent(pl) : fireAgent(pl)),
      (pl) => stopDoping(pl),
      (pl, r) => setEffort(pl, r.pick(["coast", "steady", "grind"] as const)),
      (pl, r) => invest(pl, r.pick(INVESTMENTS).id, 5_000),
      (pl) => divest(pl, rng.pick(Object.keys(pl.investments).concat("index"))),
      (pl) => setRentTier(pl, rng.int(0, 3)),
      (pl, r) => relocate(pl, r.pick(COUNTRIES).name, r),
      (pl, r) => quitVice(pl, r.pick(["smoking", "alcohol", "drugs", "gambling"] as const), r),
      (pl) => rehab(pl),
      (pl, r) => practiceHobby(pl, r.pick(HOBBIES).id, r),
      (pl, r) => giveSpeech(pl, r),
      (pl) => charityDrive(pl),
      (pl, r) => runForOffice(pl, r),
      (pl, r) => joinMob(pl, r),
      (pl, r) => leaveMob(pl, r),
      (pl, r) => adoptChild(pl, r),
      (pl, r) => makeLove(pl, (pl.relatives.find((x) => x.relation === "Partner" || x.relation === "Lover") ?? { id: "x" }).id, r.chance(0.5), r),
      (pl, r) => spiceItUp(pl, (pl.relatives.find((x) => x.relation === "Partner") ?? { id: "x" }).id, r),
      (pl) => romanticGetaway(pl, (pl.relatives.find((x) => x.relation === "Partner") ?? { id: "x" }).id),
      (pl, r) => proposeOpenRelationship(pl, r),
      (pl, r) => askThreesome(pl, r.chance(0.5), r),
      (pl, r) => swingerClub(pl, r.chance(0.5), r),
      (pl, r) => hookUp(pl, r.pick(["bar", "app", "party", "gym", "singles", "club", "social", "retreat", "scene"] as const), r.chance(0.5), r, r.pick(["casual", "relationship"] as const)),
      (pl, r) => shareExperience(pl, (pl.relatives.find((x) => x.relation === "Partner" || x.relation === "Lover") ?? { id: "x" }).id, r.pick(EXPERIENCES).id, r.chance(0.5), r),
      (pl) => discussDesires(pl, (pl.relatives.find((x) => x.relation === "Partner" || x.relation === "Lover") ?? { id: "x" }).id),
      (pl, r) => toggleInterest(pl, r.pick(INTERESTS).id),
      (pl, r) => toggleGender(pl, r.pick(["Male", "Female", "Non-binary"])),
      (pl, r) => setIntimacyPrefs(pl, { ageAuto: r.chance(0.5), ageMin: r.int(0, 80), ageMax: r.int(0, 120) }),
      (pl, r) => proposeOpenRelationship(pl, r, r.pick(["open", "poly"] as const)),
      (pl) => closeRelationship(pl),
      (pl, r) => seduce(pl, r.pick(["friend", "coworker", "ex"] as const), r.chance(0.5), r),
      (pl) => endLover(pl, (pl.relatives.find((x) => x.relation === "Lover") ?? { id: "x" }).id),
      (pl, r) => leaveForLover(pl, (pl.relatives.find((x) => x.relation === "Lover") ?? { id: "x" }).id, r),
      (pl, r) => commitMurder(pl, r.pick(targetsFor(pl)).id, r.pick(["poison", "stab", "shoot", "accident", "hitman"]), r),
      (pl, r) => assault(pl, r.pick(targetsFor(pl)).id, r),
      (pl, r) => blackmail(pl, r.pick(targetsFor(pl)).id, r),
      (pl, r) => arson(pl, r.pick(["own", "rival"] as const), r),
      (pl, r) => kidnap(pl, r),
      (pl, r) => appealSentence(pl, r),
      (pl, r) => adoptPet(pl, r.pick(["dog", "cat"] as const), r),
      (pl, r) => blackjackDeal(pl, 200, r),
      (pl) => blackjackHit(pl),
      (pl) => blackjackStand(pl),
      (pl) => blackjackClear(pl),
      (pl) => joinParty(pl, rng.pick(PARTIES).id),
      (pl) => hireStaff(pl),
      (pl) => fireStaff(pl),
      (pl) => runMarketing(pl),
      (pl) => expandBusiness(pl),
      (pl, r) => hireManager(pl, r, r.pick(["solid", "star"] as const)),
      (pl) => fireManager(pl),
      (pl) => trainStaff(pl),
      (pl, r) => setPrice(pl, r.int(0, 2)),
      (pl, r) => setPayout(pl, r.pick(["reinvest", "balanced", "salary"] as const)),
      (pl, r) => setInsurance(pl, r.int(0, 2)),
      (pl, r) => setRescue(pl, r.chance(0.5)),
      (pl) => complianceAudit(pl),
      (pl) => renovateBusiness(pl),
      (pl) => upgradeProduct(pl),
      (pl) => diversifyBusiness(pl),
      (pl, r) => pivotBusiness(pl, r),
      (pl, r) => acquireCompetitor(pl, r),
      (pl, r) => takeBusinessLoan(pl, r.int(5, 400) * 1000),
      (pl, r) => repayBusinessLoan(pl, r.int(5, 400) * 1000),
      (pl, r) => raiseFunding(pl, r, r.pick([0.1, 0.2, 0.3])),
      (pl, r) => sellFranchise(pl, r),
      (pl, r) => (r.chance(0.15) ? sellBusiness(pl, r) : { player: pl }),
      (pl, r) => (r.chance(0.08) ? closeBusiness(pl) : { player: pl }),
      (pl, r) => (r.chance(0.05) ? fileBankruptcy(pl) : { player: pl }),
      (pl, r) => (r.chance(0.1) ? handToManager(pl) : { player: pl }),
      (pl, r) => applyForJob(pl, r.pick(["dancer", "escort", "creator"]), r),
      (pl, r) => runMission(pl, r.pick(["stealth", "social", "force"]), r),
      (pl, r) => applyForJob(pl, "spy", r),
      (pl, r) => enrollProgram(pl, "Masters", null, r),
      (pl, r) => doLeisure(pl, r.pick(["bar", "experiment"] as const), r),
      (pl, r) => attemptEscape(pl, "tunnel", r),
      (pl, r) => startRiot(pl, r),
      (pl) => workOutYard(pl),
      (pl, r) => requestParole(pl, r),
    ];
    for (let i = 0; i < 5; i++) {
      p = run(p, rng, rng.pick(actions)).p;
      if (p.pendingTrial) p = run(p, rng, (pl, r) => resolveTrial(pl, "public", r)).p;
      if (!p.alive) break;
    }
    checkInvariants(p);
  }
  return p;
}

/** A sports-obsessed life: commits young, then makes random career decisions every year. */
function playAthleteBot(seed: number): PlayerState {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "random", startYear: 2026 }, rng);
  for (let guard = 0; guard < 90 && p.alive; guard++) {
    const res = ageUp(p, rng);
    p = res.player;
    checkInvariants(p);
    for (const n of (res.notices ?? []) as Notice[]) {
      if (n.kind === "event" && p.alive) p = run(p, rng, (pl, r) => resolveEvent(pl, n.event, r.int(0, n.event.options.length - 1), r)).p;
    }
    if (!p.alive) break;
    if (p.pendingTrial) p = run(p, rng, (pl, r) => resolveTrial(pl, "public", r)).p;
    if (p.age >= 9 && p.athlete.stage === "none" && rng.chance(0.5)) p = run(p, rng, (pl, r) => signWithClub(pl, r.pick(SPORTS), r)).p;
    if (p.athlete.stage !== "none" && rng.chance(0.4)) p = run(p, rng, (pl, r) => setEffort(pl, r.pick(["steady", "grind", "grind", "coast"] as const))).p;
    for (let i = 0; i < 3 && p.alive; i++) {
      const o = p.athlete.offers;
      const pick = o.length ? rng.pick(o).id : "none";
      const acts: Array<(pl: PlayerState, r: Rng) => ActionResult> = [
        (pl, r) => acceptOffer(pl, pick, r),
        (pl, r) => negotiateOffer(pl, pick, r),
        (pl) => declineOffer(pl, pick),
        (pl, r) => chooseTreatment(pl, r.pick(["rest", "rehab", "surgery", "play"] as const), r),
        (pl, r) => attendShowcase(pl, r),
        (pl, r) => trainAthletics(pl, r),
        (pl) => (rng.chance(0.1) ? quitSport(pl) : { player: pl }),
        (pl) => (rng.chance(0.15) ? retireFromSport(pl) : { player: pl }),
        (pl) => comeback(pl),
        (pl) => hireAgent(pl),
      ];
      p = run(p, rng, rng.pick(acts)).p;
      if (p.pendingTrial) p = run(p, rng, (pl, r) => resolveTrial(pl, "public", r)).p;
    }
    checkInvariants(p);
  }
  return p;
}

describe("fuzz: bot that pokes every system", () => {
  it("never produces invalid state across many lives", () => {
    for (let s = 1; s <= 120; s++) {
      const scenario = s % 10 === 0 ? "royal" : s % 4 === 0 ? "wealthy" : "random";
      const p = playBot(s, scenario);
      expect(p.age).toBeLessThanOrEqual(120);
    }
  }, 180_000);

  it("sports-career bot never breaks the athlete state machine", () => {
    let careers = 0;
    for (let s = 1; s <= 80; s++) {
      const p = playAthleteBot(7000 + s);
      if (p.athlete.record.seasons > 0) careers++;
      expect(p.age).toBeLessThanOrEqual(120);
    }
    expect(careers).toBeGreaterThan(30);
  }, 180_000);

  it("generations chain: continue as child repeatedly", () => {
    const rng = makeRng(999);
    let p = createNewPlayer({ scenario: "wealthy", startYear: 2026 }, rng);
    let generations = 0;
    for (let guard = 0; guard < 400 && generations < 3; guard++) {
      if (!p.alive) {
        const kid = heirs(p)[0];
        if (!kid) break;
        const next = continueAsChild(p, kid.id, rng)!;
        expect(next.generation).toBe(p.generation + 1);
        p = next;
        generations++;
        continue;
      }
      if (p.pendingTrial) p = resolveTrial(p, "public", rng).player;
      // force a family early so heirs exist
      if (p.age === 25 && !p.relatives.some((r) => r.relation === "Partner")) {
        p = meetSomeone(p, "date", rng).player;
      }
      if (p.age >= 22 && p.age <= 40 && heirs(p).length < 2) {
        p.relatives.push({ id: rng.id(), relation: "Child", name: "Kid " + p.lastName, age: 0, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Female", smarts: 60, looks: 60 });
      }
      const res = ageUp(p, rng);
      p = res.player;
    }
    expect(generations).toBeGreaterThanOrEqual(1);
  });
});
