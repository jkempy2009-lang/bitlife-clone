import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { createNewPlayer, netWorth } from "../state";
import { ageUp, finalize } from "../ageUp";
import { resolveEvent } from "../events";
import { resolveTrial } from "../crime";
import { applyForJob } from "../career";
import { takeVacation } from "../careerLife";
import { rentOut } from "../property";
import { plansFor, startTreatment } from "../treatment";
import { SCHOOL_ACTIONS, joinClub, schoolAction, inSchoolYears, CLUBS, type SchoolAction } from "../school";
import { continueAsChild } from "../legacy";
import { buildFamilyTree } from "../familyTree";
import { fundTrust } from "../dynasty";
import { recruitKey, ROLES, startBusiness } from "../business";
import { availableBills, pushBill } from "../legislature";
import { talkAboutUs, giveSpace } from "../partnership";
import type { Notice, PlayerState } from "@/types/game.types";

function check(p: PlayerState) {
  for (const k of ["happiness", "health", "smarts", "looks", "karma", "fame"] as const) {
    expect(Number.isFinite(p[k]), `${k} finite`).toBe(true);
    expect(p[k], `${k} >= 0 at age ${p.age}`).toBeGreaterThanOrEqual(0);
    expect(p[k], `${k} <= 100`).toBeLessThanOrEqual(100);
  }
  expect(Number.isFinite(p.bankBalance)).toBe(true);
  expect(Number.isFinite(netWorth(p))).toBe(true);
  expect(p.bankBalance, `bank at age ${p.age}`).toBeGreaterThanOrEqual(0);
  const ids = p.relatives.map((r) => r.id);
  expect(new Set(ids).size, "unique relative ids").toBe(ids.length);
  for (const r of p.relatives) if (r.parentId) expect(ids.includes(r.parentId), `parentId of ${r.name} resolves`).toBe(true);
  if (p.business && !p.business.passive) expect(p.currentJob, "business and job at once").toBeNull();
  if (p.business) {
    expect(Number.isFinite(p.business.cash)).toBe(true);
    const out = p.business.investors.reduce((s, i) => s + i.share, 0);
    expect(p.business.ownerShare + out).toBeLessThanOrEqual(1.0001);
  }
  const sovereigns = p.relatives.filter((r) => r.alive && (r.royalTitle === "King" || r.royalTitle === "Queen")).length + (p.royalRank === "King" || p.royalRank === "Queen" ? 1 : 0);
  expect(sovereigns, "one sovereign").toBeLessThanOrEqual(1);
  expect(() => buildFamilyTree(p)).not.toThrow();
}

function drive(p: PlayerState, rng: Rng, notices: Notice[]): PlayerState {
  for (const n of notices) {
    if (n.kind === "event" && p.alive) { p = resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng).player; finalize(p, []); }
  }
  return p;
}

function life(seed: number, scenario: "random" | "royal" | "wealthy"): PlayerState {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario, startYear: 1990 + (seed % 40), talents: NEUTRAL }, rng);
  const acts: Array<(pl: PlayerState) => PlayerState> = [
    (pl) => (pl.age >= 18 && !pl.currentJob && !pl.business ? applyForJob(pl, "fast_food", rng).player : pl),
    (pl) => (pl.currentJob ? takeVacation(pl).player : pl),
    (pl) => (pl.properties[0] ? rentOut(pl, pl.properties[0].id).player : pl),
    (pl) => { const d = pl.diseases.find((x) => plansFor(x).length); return d ? startTreatment(pl, d.id, plansFor(d)[0].id, rng).player : pl; },
    (pl) => (inSchoolYears(pl) ? joinClub(pl, rng.pick(CLUBS).id).player : pl),
    (pl) => { if (!inSchoolYears(pl)) return pl; const a = rng.pick(Object.keys(SCHOOL_ACTIONS) as SchoolAction[]); return SCHOOL_ACTIONS[a].when(pl) ? schoolAction(pl, a, rng).player : pl; },
    (pl) => (pl.age >= 35 && pl.bankBalance > 400_000 && !pl.business && !pl.currentJob ? startBusiness(pl, "restaurant", "Fuzz Co", rng).player : pl),
    (pl) => (pl.business ? recruitKey(pl, rng.pick(ROLES)).player : pl),
    (pl) => { const b = availableBills(pl)[0]; return b && pl.currentJob ? pushBill(pl, rng, b.id).player : pl; },
    (pl) => { const m = pl.relatives.find((r) => r.relation === "Partner" && r.alive); return m ? (rng.chance(0.5) ? talkAboutUs(pl, m.id) : giveSpace(pl, m.id)).player : pl; },
    (pl) => (pl.age >= 30 && pl.bankBalance > 60_000 ? fundTrust(pl, 20_000).player : pl),
  ];
  for (let guard = 0; guard < 110 && p.alive; guard++) {
    if (p.pendingTrial) p = resolveTrial(p, "public", rng).player;
    {
      const before = p;
      p = rng.pick(acts)(p);
      if (p !== before) finalize(p, []); // the reducer does this after every action
    }
    const res = ageUp(p, rng);
    p = drive(res.player, rng, (res.notices ?? []) as Notice[]);
    // Hand life over now and then, alive or after death.
    const kid = p.relatives.find((r) => r.relation === "Child" && r.alive && r.age >= 16);
    if (kid && p.alive && rng.chance(0.03)) {
      const next = continueAsChild(p, kid.id, rng, true);
      if (next) p = next;
    }
    check(p);
    if (!p.alive) {
      const heir = p.relatives.find((r) => r.relation === "Child" && r.alive);
      if (heir && rng.chance(0.7)) {
        const next = continueAsChild(p, heir.id, rng, false);
        if (next) { p = next; check(p); }
      } else break;
    }
  }
  return p;
}

describe("fuzz: the new depth systems together", () => {
  it("random lives using careers, property, health, school, business, politics, family and handovers keep every invariant", () => {
    for (let seed = 1; seed <= Number(process.env.FUZZ_N ?? 36); seed++) {
      const scenario = seed % 6 === 0 ? "royal" : seed % 3 === 0 ? "wealthy" : "random";
      const p = life(seed, scenario);
      expect(p.age).toBeGreaterThan(0);
    }
  }, 240_000);
});
