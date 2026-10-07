import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, getPartner } from "../state";
import { ageUp } from "../ageUp";
import {
  askThreesome, endLover, hookUp, leaveForLover, makeLove, proposeOpenRelationship, romanticGetaway, seduce, spiceItUp, swingerClub, processIntimacy, exposeAffair,
} from "../intimacy";
import { appealSentence, resolveTrial, startTrial } from "../crime";
import { METHODS, arson, assault, blackmail, commitMurder, coverChance, kidnap, targetsFor } from "../violence";
import { addPet, adoptPet } from "../social";
import { blackjackClear, blackjackDeal, blackjackHit, blackjackStand } from "../blackjack";
import { jobEligibility } from "../career";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { PARTIES, joinParty, electionChance } from "../politics";
import { expandBusiness, fireStaff, hireStaff, processBusiness, runMarketing, startBusiness } from "../paths";
import { exportShareCode, parseSave } from "../save";
import { selectEvents, isEligible } from "../events";
import { LIFE_EVENTS } from "@/data/lifeEventsEngine";
import { ACHIEVEMENTS } from "@/data/achievements";
import { epitaph } from "../legacy";
import type { PlayerState, Relative } from "@/types/game.types";

const adult = (seed = 1) => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, gender: "Female" }, rng);
  p.age = 30;
  p.sexuality = "Straight";
  p.education.degrees = ["highschool"];
  p.bankBalance = 100_000;
  return { rng, p };
};

function withPartner(p: PlayerState, rng: ReturnType<typeof makeRng>, over: Partial<Relative> = {}): Relative {
  const partner: Relative = {
    id: "partner1", relation: "Partner", name: "Alex Rivers", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 3,
    gender: "Male", smarts: 60, looks: 60, partnerStatus: "dating", openness: 60, jealousy: 30, traits: ["Adventurous", "Kind"], ...over,
  };
  p.relatives.push(partner);
  void rng;
  return partner;
}

describe("mature content gating", () => {
  it("blocks adult actions when the setting is off or the player is a minor", () => {
    const { rng, p } = adult(1);
    const partner = withPartner(p, rng);
    p.matureContent = false;
    expect(makeLove(p, partner.id, true, rng).player).toBe(p);
    expect(hookUp(p, "bar", true, rng).player).toBe(p);
    expect(commitMurder(p, "stranger", "poison", rng).player).toBe(p);
    p.matureContent = true;
    p.age = 16;
    expect(makeLove(p, partner.id, true, rng).player).toBe(p);
    expect(kidnap(p, rng).player).toBe(p);
  });
  it("never offers mature events when the setting is off", () => {
    const { p } = adult(2);
    p.matureContent = false;
    for (const e of LIFE_EVENTS.filter((x) => x.mature)) expect(isEligible(p, e)).toBe(false);
    const rng = makeRng(7);
    for (let i = 0; i < 100; i++) for (const e of selectEvents(p, rng)) expect(e.mature).toBeFalsy();
  });
  it("adult careers are blocked when the setting is off", () => {
    const { p } = adult(3);
    p.looks = 90;
    p.matureContent = false;
    expect(jobEligibility(p, CAREER_BY_ID.creator).ok).toBe(false);
    p.matureContent = true;
    expect(jobEligibility(p, CAREER_BY_ID.creator).ok).toBe(true);
  });
});

describe("intimacy", () => {
  it("making love boosts the relationship and is capped per year", () => {
    const { rng, p } = adult(4);
    const partner = withPartner(p, rng, { relationshipBar: 40 });
    let cur = p;
    for (let i = 0; i < 10; i++) cur = makeLove(cur, partner.id, true, makeRng(i + 1)).player;
    const after = cur.relatives.find((r) => r.id === partner.id)!;
    expect(after.relationshipBar).toBeGreaterThan(40);
    expect(cur.annual[`love:${partner.id}`]).toBe(6);
  });
  it("unprotected sex can lead to pregnancy, and a birth follows next age-up", () => {
    let conceived = false;
    for (let s = 0; s < 80 && !conceived; s++) {
      const { p } = adult(100 + s);
      const partner = withPartner(p, makeRng(1));
      p.annual = {};
      const out = makeLove(p, partner.id, false, makeRng(s)).player;
      if (out.pregnancy) {
        conceived = true;
        const aged = ageUp(out, makeRng(s)).player;
        expect(aged.pregnancy).toBeNull();
        expect(aged.relatives.filter((r) => r.relation === "Child")).toHaveLength(1);
        expect(aged.stats.childrenBorn).toBe(1);
      }
    }
    expect(conceived).toBe(true);
  });
  it("same-sex couples can't conceive naturally", () => {
    const { rng, p } = adult(5);
    p.gender = "Female";
    const partner = withPartner(p, rng, { gender: "Female" });
    let any = false;
    for (let s = 0; s < 60; s++) any = any || !!makeLove({ ...p, annual: {} }, partner.id, false, makeRng(s)).player.pregnancy;
    expect(any).toBe(false);
  });
  it("threesome and open-relationship requests depend on the partner's personality", () => {
    const rate = (openness: number, jealousy: number, fn: (p: PlayerState, r: ReturnType<typeof makeRng>) => PlayerState) => {
      let yes = 0;
      for (let s = 0; s < 120; s++) {
        const { p } = adult(200 + s);
        withPartner(p, makeRng(1), { openness, jealousy });
        if (fn(p, makeRng(s)).relatives.some((r) => r.relation === "Partner")) yes++;
      }
      return yes;
    };
    const threes = (p: PlayerState, r: ReturnType<typeof makeRng>) => askThreesome({ ...p, intimacy: { ...p.intimacy, interests: [...p.intimacy.interests, "group"] } }, true, r).player;
    let eager = 0, prudish = 0;
    for (let s = 0; s < 150; s++) {
      const a = adult(300 + s); withPartner(a.p, a.rng, { openness: 95, jealousy: 5, relationshipBar: 90 });
      const b = adult(300 + s); withPartner(b.p, b.rng, { openness: 5, jealousy: 95, relationshipBar: 40 });
      if (threes(a.p, makeRng(s)).flags.includes("threesome")) eager++;
      if (threes(b.p, makeRng(s)).flags.includes("threesome")) prudish++;
    }
    expect(eager).toBeGreaterThan(prudish * 2);
    expect(rate(50, 50, (p) => p)).toBe(120);
    let opened = 0;
    for (let s = 0; s < 100; s++) {
      const { p } = adult(500 + s);
      withPartner(p, makeRng(1), { openness: 90, jealousy: 10, relationshipBar: 80 });
      if (proposeOpenRelationship(p, makeRng(s)).player.flags.includes("open_relationship")) opened++;
    }
    expect(opened).toBeGreaterThan(40);
  });
  it("hooking up while partnered is cheating and can be exposed; open relationships are exempt", () => {
    let cheated = 0;
    for (let s = 0; s < 60; s++) {
      const { p } = adult(600 + s);
      withPartner(p, makeRng(1));
      const out = hookUp(p, "bar", true, makeRng(s)).player;
      if (out.flags.includes("cheater")) cheated++;
    }
    expect(cheated).toBeGreaterThan(10);
    const { p, rng } = adult(7);
    withPartner(p, rng);
    p.flags.push("open_relationship");
    for (let s = 0; s < 40; s++) expect(hookUp({ ...p, annual: {} }, "app", true, makeRng(s)).player.flags.includes("cheater")).toBe(false);
  });
  it("exposure can end the relationship or leave it damaged", () => {
    let ended = 0, stayed = 0;
    for (let s = 0; s < 80; s++) {
      const { p } = adult(700 + s);
      withPartner(p, makeRng(1), { jealousy: 60 });
      exposeAffair(p, makeRng(s), []);
      if (getPartner(p)) {
        stayed++;
        expect(getPartner(p)!.relationshipBar).toBeLessThan(70);
      } else ended++;
    }
    expect(ended).toBeGreaterThan(10);
    expect(stayed).toBeGreaterThan(10);
  });
  it("lovers can be ended or promoted to partner", () => {
    const { rng, p } = adult(8);
    p.relatives.push({ id: "lov", relation: "Lover", name: "Sam Hart", age: 28, relationshipBar: 80, health: 90, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 70, partnerStatus: "fling" });
    const promoted = leaveForLover(p, "lov", rng).player;
    expect(promoted.relatives.find((r) => r.id === "lov")!.relation).toBe("Partner");
    const ended = endLover(p, "lov").player;
    expect(ended.relatives.find((r) => r.id === "lov")!.partnerStatus).toBe("ex");
    p.relatives[p.relatives.length - 1].relationshipBar = 20;
    expect(leaveForLover(p, "lov", rng).player.relatives.find((r) => r.id === "lov")!.relation).toBe("Lover");
  });
  it("other actions work and cost money", () => {
    const { rng, p } = adult(9);
    const partner = withPartner(p, rng, { openness: 90 });
    p.flags.push("open_relationship");
    expect(spiceItUp(p, partner.id, makeRng(1)).player.bankBalance).toBeLessThan(p.bankBalance);
    expect(romanticGetaway(p, partner.id).player.bankBalance).toBe(p.bankBalance - 1200);
    expect(swingerClub(p, true, makeRng(2)).player.bankBalance).toBe(p.bankBalance - 400);
    expect(seduce(p, "friend", true, rng).player).toBeTruthy();
  });
  it("yearly processing never leaves lovers with negative bars", () => {
    const { rng, p } = adult(10);
    p.relatives.push({ id: "lov", relation: "Lover", name: "Sam Hart", age: 28, relationshipBar: 5, health: 90, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 70, partnerStatus: "fling" });
    processIntimacy(p, {}, rng, []);
    expect(p.relatives[p.relatives.length - 1].relationshipBar).toBeGreaterThanOrEqual(0);
  });
});

describe("murder and violence", () => {
  it("children and minors can never be targets", () => {
    const { p } = adult(11);
    p.relatives.push({ id: "kid", relation: "Child", name: "Kid Z", age: 30, relationshipBar: 70, health: 90, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 50 });
    p.relatives.push({ id: "teen", relation: "Sibling", name: "Teen Z", age: 15, relationshipBar: 70, health: 90, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 50 });
    p.relatives.push({ id: "pet", relation: "Pet", name: "Rex", age: 3, relationshipBar: 70, health: 90, alive: true, incomeTier: 1, gender: "Unknown", smarts: 10, looks: 10, species: "dog" });
    const ids = targetsFor(p).map((t) => t.id);
    expect(ids).not.toContain("kid");
    expect(ids).not.toContain("teen");
    expect(ids).not.toContain("pet");
    expect(ids).toContain("stranger");
    expect(commitMurder(p, "kid", "poison", makeRng(1)).player).toBe(p);
  });
  it("murder either goes undetected (investigation) or ends in a murder trial; kills are recorded", () => {
    let undetected = 0, caught = 0;
    for (let s = 0; s < 80; s++) {
      const { p } = adult(800 + s);
      p.smarts = 80;
      const out = commitMurder(p, "stranger", "poison", makeRng(s)).player;
      if (out.pendingTrial?.name === "Murder") {
        caught++;
        expect(out.pendingTrial.capital).toBe(true);
      }
      if (out.flags.includes("under_investigation")) {
        undetected++;
        expect(out.flags).toContain("killer");
        expect(out.stats.kills).toBe(1);
        expect(out.karma).toBeLessThanOrEqual(10);
      }
    }
    expect(undetected).toBeGreaterThan(10);
    expect(caught).toBeGreaterThan(5);
  });
  it("killing a relative marks them dead and is more suspicious; murder is limited to once a year", () => {
    const { rng, p } = adult(12);
    const partner = withPartner(p, rng);
    expect(coverChance(p, "poison", "relative", partner)).toBeLessThan(coverChance(p, "poison", "stranger"));
    let killed = false;
    for (let s = 0; s < 40 && !killed; s++) {
      const fresh = adult(900 + s);
      const pr = withPartner(fresh.p, fresh.rng);
      const out = commitMurder(fresh.p, pr.id, "shoot", makeRng(s)).player;
      const rel = out.relatives.find((r) => r.id === pr.id)!;
      if (!rel.alive) {
        killed = true;
        expect(rel.deathYear).toBe(out.year);
        const again = commitMurder(out, "stranger", "poison", makeRng(1));
        expect(again.player.stats.kills).toBe(1);
      }
    }
    expect(killed).toBe(true);
  });
  it("hitman costs money; each method exists", () => {
    const { rng, p } = adult(13);
    p.bankBalance = 100;
    expect(commitMurder(p, "stranger", "hitman", rng).player.stats.kills).toBe(0);
    expect(METHODS.length).toBe(5);
  });
  it("an open investigation eventually leads to arrest or goes cold", () => {
    let arrested = 0, cold = 0;
    for (let s = 0; s < 40; s++) {
      const { p } = adult(1000 + s);
      p.flags.push("killer", "under_investigation");
      p.stats.kills = 1;
      let cur = p;
      const rng = makeRng(s);
      for (let y = 0; y < 12 && !cur.pendingTrial && cur.alive; y++) {
        cur = ageUp(cur, rng).player;
        if (!cur.flags.includes("under_investigation")) break;
      }
      if (cur.pendingTrial?.name === "Murder" || cur.isInPrison) arrested++;
      else if (!cur.flags.includes("under_investigation")) cold++;
    }
    expect(arrested).toBeGreaterThan(3);
    expect(cold).toBeGreaterThan(3);
  });
  it("death penalty applies only in some countries and only for capital charges; appeals can commute", () => {
    let sentenced = 0;
    for (let s = 0; s < 120; s++) {
      const { p } = adult(1200 + s);
      p.residence.country = "United States";
      p.bankBalance = 30_000;
      startTrial(p, { name: "Murder", description: "d", years: 30, severity: "heinous", capital: true });
      const out = resolveTrial(p, "self", makeRng(s)).player;
      if (out.prison?.deathRow) {
        sentenced++;
        const appeal = appealSentence(out, makeRng(s + 5)).player;
        expect(appeal.prison!.deathRow === true || appeal.prison!.sentenceYears >= 30).toBe(true);
      }
    }
    expect(sentenced).toBeGreaterThan(3);
    const { p } = adult(1300);
    p.residence.country = "Sweden";
    p.bankBalance = 30_000;
    startTrial(p, { name: "Murder", description: "d", years: 30, severity: "heinous", capital: true });
    for (let s = 0; s < 30; s++) {
      const q = JSON.parse(JSON.stringify(p));
      expect(resolveTrial(q, "self", makeRng(s)).player.prison?.deathRow).toBeFalsy();
    }
  });
  it("a death-row countdown ends in execution", () => {
    const { rng, p } = adult(14);
    p.isInPrison = true;
    p.prison = { charge: "Murder", sentenceYears: 1, yearsServed: 0, deathRow: true };
    const out = ageUp(p, rng).player;
    expect(out.alive).toBe(false);
    expect(out.causeOfDeath).toBe("execution");
  });
  it("assault, blackmail, arson and kidnapping have consequences", () => {
    const { rng, p } = adult(15);
    const partner = withPartner(p, rng);
    expect(assault(p, partner.id, makeRng(1)).player.karma).toBeLessThan(p.karma);
    expect(blackmail(p, partner.id, makeRng(2)).player.relatives.find((r) => r.id === partner.id)!.relationshipBar).toBeLessThan(70);
    expect(arson(p, "own", rng).player).toBe(p);
    p.properties.push({ id: "h", name: "House", originalValue: 1, currentValue: 300_000, condition: 80, monthlyMortgage: 0, remainingTerm: 0, mortgageBalance: 0, archetypeId: "starter" });
    const burned = arson(p, "own", makeRng(3)).player;
    expect(burned.properties).toHaveLength(0);
    let ransomed = 0, jailed = 0;
    for (let s = 0; s < 60; s++) {
      const q = adult(1400 + s).p;
      const out = kidnap(q, makeRng(s)).player;
      if (out.bankBalance > q.bankBalance) ransomed++;
      if (out.pendingTrial?.name === "Kidnapping") jailed++;
    }
    expect(ransomed).toBeGreaterThan(2);
    expect(jailed).toBeGreaterThan(10);
  });
});

describe("pets, parties, business management and saves", () => {
  it("pets are relatives that age and die; adoption costs money", () => {
    const { rng, p } = adult(16);
    const pet = addPet(p, "dog", rng);
    expect(p.flags).toContain("has_dog");
    expect(adoptPet(p, "cat", rng).player.bankBalance).toBe(p.bankBalance - 150);
    pet.age = 20;
    let cur = p;
    for (let i = 0; i < 6 && cur.relatives.find((r) => r.id === pet.id)!.alive; i++) cur = ageUp(cur, makeRng(i + 1)).player;
    expect(cur.relatives.find((r) => r.id === pet.id)!.alive).toBe(false);
  });
  it("blackjack hands persist in player state and settle correctly", () => {
    const { rng, p } = adult(17);
    let settled = 0;
    for (let s = 0; s < 40; s++) {
      let cur = blackjackClear(p).player;
      cur = blackjackDeal(cur, 1000, makeRng(s)).player;
      expect(cur.blackjack).not.toBeNull();
      if (cur.blackjack!.phase === "play") {
        expect(cur.bankBalance).toBe(p.bankBalance - 1000);
        cur = blackjackStand(cur).player;
      }
      expect(cur.blackjack!.phase).toBe("done");
      settled++;
      expect([p.bankBalance - 1000, p.bankBalance, p.bankBalance + 1000, p.bankBalance + 1500]).toContain(cur.bankBalance);
    }
    expect(settled).toBe(40);
    const cur = blackjackDeal(p, 500, rng).player;
    if (cur.blackjack!.phase === "play") expect(blackjackHit(cur).player.blackjack!.player.length).toBeGreaterThan(2);
  });
  it("party choice shifts election odds with the economy", () => {
    const { p } = adult(18);
    p.smarts = 80;
    p.economy.climate = "recession";
    const base = electionChance(p, 0);
    const out = joinParty(p, "populist").player;
    expect(electionChance(out, 0)).toBeGreaterThan(base);
    out.economy.climate = "boom";
    expect(electionChance(out, 0)).toBeLessThan(electionChance({ ...out, economy: { ...out.economy, climate: "recession" } }, 0));
    expect(PARTIES.length).toBe(5);
  });
  it("business staff, marketing and expansion work", () => {
    const { rng, p } = adult(19);
    p.smarts = 80;
    p.bankBalance = 2_000_000;
    const started = startBusiness(p, "restaurant", "Chez").player;
    const hired = hireStaff(started).player;
    expect(hired.business!.staff).toBe(1);
    expect(fireStaff(hired).player.business!.staff).toBe(0);
    expect(runMarketing(started).player.business!.boost).toBeGreaterThan(0);
    const expanded = expandBusiness(started).player;
    expect(expanded.business!.locations).toBe(2);
    expect(expanded.business!.value).toBeGreaterThan(started.business!.value);
    processBusiness(expanded, rng, []);
    expect(Number.isFinite(expanded.business?.lastProfit ?? 0)).toBe(true);
  });
  it("share codes round-trip", () => {
    const { p } = adult(20);
    const code = exportShareCode(p, 42);
    const parsed = parseSave(code);
    expect(parsed?.player.firstName).toBe(p.firstName);
    expect(parsed?.rngState).toBe(42);
    expect(parseSave("not a save")).toBeNull();
  });
  it("new achievements and epitaphs exist", () => {
    expect(ACHIEVEMENTS.some((a) => a.id === "murderer")).toBe(true);
    const { p } = adult(21);
    p.stats.kills = 3;
    expect(epitaph(p)).toContain("whispered");
  });
});
