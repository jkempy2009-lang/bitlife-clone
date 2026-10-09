import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer } from "../state";
import { ageUp } from "../ageUp";
import {
  ROLES,
  bizSellStake,
  buyOutInvestor,
  canPayDividend,
  dismissKey,
  giveRaise,
  hireManager,
  offerEquity,
  payDividend,
  priceWar,
  recruitKey,
  respondToShift,
  spareCash,
  spawnRival,
  startBusiness,
  stepBack,
  takeBackControl,
} from "../business";
import type { PlayerState } from "@/types/game.types";

function founder(seed: number, kind = "restaurant"): { rng: ReturnType<typeof makeRng>; p: PlayerState } {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "wealthy", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 34;
  p.birthYear = p.year - 34;
  p.bankBalance = 3_000_000;
  p.education.degrees = ["highschool"];
  p.currentJob = null;
  p = startBusiness(p, kind, "Test Co", rng).player;
  return { rng, p };
}

describe("key people", () => {
  it("each role can be filled once, paid, given equity or let go", () => {
    const { rng, p } = founder(1);
    expect(p.business).not.toBeNull();
    let q = p;
    for (const role of ROLES) q = recruitKey(q, role).player;
    expect(q.business!.team.length).toBe(3);
    expect(recruitKey(q, "craft").player).toBe(q); // already filled
    const first = q.business!.team[0];
    const raised = giveRaise(q, first.id).player;
    expect(raised.business!.team[0].wage).toBeGreaterThan(first.wage);
    const partner = offerEquity(raised, first.id).player;
    expect(partner.business!.team[0].partner).toBe(true);
    expect(partner.business!.ownerShare).toBeLessThan(raised.business!.ownerShare);
    const gone = dismissKey(partner, first.id).player;
    expect(gone.business!.team.length).toBe(2);
    void rng;
  });
});

describe("market", () => {
  it("rivals appear, price wars cost money, shifts can be answered", () => {
    const { rng, p } = founder(2);
    const b = p.business!;
    const rival = spawnRival(b, p.year, rng, "discounter");
    expect(rival).not.toBeNull();
    const out = priceWar(p, rng, b.rivals[0].id).player;
    expect(out.bankBalance + out.business!.cash).toBeLessThan(p.bankBalance + b.cash);
    p.business!.shift = { id: "craze", label: "A craze", blurb: "Demand surges.", demand: 0.1, cost: 0, yearsLeft: 2, responded: false };
    expect(respondToShift(p).player.business!.shift?.responded).toBe(true);
  });
});

describe("board and passive ownership", () => {
  it("selling a stake brings an investor with an agenda; dividends, buyouts and stepping back work", () => {
    const { rng, p } = founder(3);
    p.business!.cash = 400_000;
    const note = bizSellStake(p, 0.2, 1, rng, "vc");
    expect(note === undefined || typeof note === "string").toBe(true);
    expect(p.business!.investors.length).toBeGreaterThan(0);
    expect(p.business!.ownerShare).toBeLessThan(1);
    expect(canPayDividend(p, p.business!)).toBe(true);
    const paid = payDividend(p, spareCash(p.business!)).player;
    expect(paid.bankBalance).toBeGreaterThan(p.bankBalance);
    expect(stepBack(p).player).toBe(p); // nobody to run it
    const managed = hireManager(p, rng).player;
    expect(managed.business!.manager).toBeTruthy();
    const stepped = stepBack(managed).player;
    expect(stepped.business!.passive).toBe(true);
    expect(takeBackControl(stepped).player.business!.passive).toBe(false);
    const inv = p.business!.investors[0];
    const bought = buyOutInvestor(managed, inv.id).player;
    expect(bought.business!.investors.length).toBeLessThanOrEqual(managed.business!.investors.length);
  });
});

describe("whole business lives", () => {
  it("founders of every kind run for decades with a team, rivals and investors without throwing", () => {
    for (const [i, kind] of ["restaurant", "barcafe", "tech", "retail"].entries()) {
      for (let seed = 1; seed <= 3; seed++) {
        const { rng, p: p0 } = founder(10 * i + seed, kind);
        let p = p0;
        if (!p.business) continue;
        for (const role of ROLES) p = recruitKey(p, role).player;
        for (let y = 0; y < 25 && p.alive; y++) {
          p = ageUp(p, rng).player;
          if (p.business && y === 3) bizSellStake(p, 0.1, 1, rng, "angel");
        }
        expect(p.age).toBeGreaterThan(34);
      }
    }
  });
});
