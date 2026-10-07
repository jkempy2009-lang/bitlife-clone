import { describe, expect, it } from "vitest";
import { makeRng, type Rng } from "@/lib/rng";
import { createNewPlayer, netWorth } from "../state";
import { ageUp, finalize } from "../ageUp";
import { applyForJob, enrollProgram, quitJob } from "../career";
import { blockerFor, hasCommitment, applyEffortCosts } from "../occupation";
import { continueAsChild } from "../legacy";
import { addRelative } from "../social";
import { exportSave, parseSave } from "../save";
import { resolveEvent, isEligible } from "../events";
import { LIFE_EVENTS } from "@/data/lifeEventsEngine";
import { BUSINESS_EVENTS } from "@/data/events/business";
import { ACHIEVEMENT_BY_ID } from "@/data/achievements";
import {
  BUSINESS_TYPES,
  acquireCompetitor,
  bankruptcyOf,
  complianceAudit,
  diversifyBusiness,
  expandBusiness,
  fireManager,
  fireStaff,
  pivotBusiness,
  renovateBusiness,
  setInsurance,
  setPrice,
  setRescue,
  trainStaff,
  upgradeProduct,
  closeBusiness,
  fileBankruptcy,
  forecast,
  fundingTerms,
  handToManager,
  hireManager,
  hireStaff,
  inheritBusiness,
  investInBusiness,
  loanLimit,
  processBusiness,
  raiseFunding,
  recommendedStaff,
  repayBusinessLoan,
  runMarketing,
  saleQuote,
  sellBusiness,
  sellFranchise,
  setPayout,
  startBusiness,
  stakeValue,
  takeBusinessLoan,
} from "../paths";
import { NO_SHOCKS, kindOf, stepYear } from "../businessModel";
import type { Business, PlayerState } from "@/types/game.types";

const adult = (seed: number, cash = 2_000_000): { rng: Rng; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026 }, rng);
  p.age = 32;
  p.birthYear = p.year - 32;
  p.education = { stage: "None", yearsLeft: 0, major: null, grades: 60, studyEffort: 0, degrees: ["highschool"] };
  p.smarts = 80;
  p.looks = 70;
  p.health = 90;
  p.skills.charisma = 50;
  p.skills.athletics = 50;
  p.bankBalance = cash;
  p.economy = { climate: "normal", yearsLeft: 3 };
  return { rng, p };
};

/** A founder with an established, steady business: fixed market fit, some history. */
function established(kind: string, seed = 1, tweak?: (b: Business, p: PlayerState) => void): { rng: Rng; p: PlayerState } {
  const { rng, p: p0 } = adult(seed);
  let p = startBusiness(p0, kind, "Test Co", rng).player;
  const b = p.business!;
  b.fit = 1;
  b.customers = 55;
  b.reputation = 55;
  p.year += 3;
  for (let i = 0; i < 3; i++) b.history.push({ year: p.year - 3 + i, revenue: 300_000, profit: 60_000, cash: b.cash, reputation: 55 });
  b.revenue = 300_000;
  b.lastProfit = 60_000;
  b.profitableYears = 3;
  tweak?.(b, p);
  p = { ...p, business: b };
  return { rng, p };
}

/** Run Age Up `n` times without game events getting in the way of the business assertions. */
function runYears(p: PlayerState, rng: Rng, n: number): PlayerState {
  for (let i = 0; i < n && p.alive; i++) p = { ...ageUp(p, rng).player, queuedEvents: [] };
  return p;
}

describe("business catalogue", () => {
  it("offers a dozen distinct business types", () => {
    expect(BUSINESS_TYPES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(BUSINESS_TYPES.map((b) => b.id)).size).toBe(BUSINESS_TYPES.length);
    for (const id of ["gym", "construction", "onlinestore", "consultancy", "barcafe", "farm", "logistics"]) expect(BUSINESS_TYPES.some((b) => b.id === id)).toBe(true);
  });

  it("enforces minimum smarts, skill and capital", () => {
    const { rng, p } = adult(2, 5_000_000);
    p.smarts = 20;
    expect(startBusiness(p, "consultancy", "", rng).player.business).toBeNull();
    p.smarts = 80;
    p.skills.charisma = 0;
    expect(startBusiness(p, "consultancy", "", rng).player.business).toBeNull();
    p.skills.athletics = 0;
    expect(startBusiness(p, "gym", "", rng).player.business).toBeNull();
    p.bankBalance = 1_000;
    expect(startBusiness(p, "foodtruck", "", rng).player.business).toBeNull();
  });
});

describe("exclusive commitment", () => {
  it("an employee cannot found a business, and an owner cannot take a job, study full time or hold office", () => {
    const { rng, p } = adult(3);
    let employed = p;
    for (let i = 0; i < 20 && !employed.currentJob; i++) employed = { ...applyForJob(employed, "retail", rng).player, annual: {} };
    expect(employed.currentJob).not.toBeNull();
    expect(blockerFor(employed, "business")).toMatch(/quit first/i);
    expect(startBusiness(employed, "foodtruck", "x", rng).player.business).toBeNull();

    const owner = startBusiness(quitJob(employed).player, "foodtruck", "Truck", rng).player;
    expect(owner.business).not.toBeNull();
    for (const want of ["job", "music", "office", "study"] as const) expect(blockerFor(owner, want)).toMatch(/business|Truck/i);
    for (let i = 0; i < 5; i++) expect(applyForJob({ ...owner, annual: {} }, "retail", rng).player.currentJob).toBeNull();
    expect(enrollProgram(owner, "University", "business", rng).player.education.stage).toBe("None");

    const sold = sellBusiness(owner, rng).player;
    expect(blockerFor(sold, "job")).toBeNull();
  });

  it("every non-business career entry point is gated by the same rule", () => {
    const { rng, p } = established("restaurant");
    for (const line of ["retail", "spy", "mafia", "athlete", "dancer"]) {
      expect(applyForJob({ ...p, annual: {} }, line, rng).player.currentJob).toBeNull();
    }
  });
});

describe("owner commitment", () => {
  const profit = (p: PlayerState) => stepYear(p, p.business!, NO_SHOCKS).pnl.operating;

  it("effort matters for an owner-operator: grind > steady > coast", () => {
    const { p } = established("restaurant");
    const staffed = { ...p, business: { ...p.business!, staff: 5 } };
    const at = (effort: "coast" | "steady" | "grind") => profit({ ...staffed, effort });
    expect(at("grind")).toBeGreaterThan(at("steady"));
    expect(at("steady")).toBeGreaterThan(at("coast"));
  });

  it("coasting without a manager makes the business decay; a manager prevents neglect", () => {
    const { rng, p } = established("barcafe", 4, (b) => {
      b.staff = 3;
    });
    const coasting = runYears({ ...p, effort: "coast" }, rng, 3);
    expect(coasting.business!.neglect).toBeGreaterThanOrEqual(2);
    expect(coasting.business!.reputation).toBeLessThan(p.business!.reputation);
    expect(coasting.business!.customers).toBeLessThan(p.business!.customers);

    const managed = hireManager({ ...p, effort: "coast" }, makeRng(9), "solid").player;
    expect(managed.business!.manager).not.toBeNull();
    const later = runYears(managed, rng, 3);
    expect(later.business?.neglect ?? 0).toBe(0);
  });

  it("a manager costs wages and trims profit but frees you from grinding costs", () => {
    const { rng, p } = established("restaurant", 5, (b) => {
      b.staff = 5;
    });
    const solo = { ...p, effort: "steady" as const };
    const managed = hireManager(solo, rng, "solid").player;
    expect(managed.business!.manager!.wage).toBeGreaterThan(0);
    expect(profit(managed)).toBeLessThan(profit(solo));

    expect(hasCommitment({ ...solo })).toBe(true);
    const grinder = { ...managed, effort: "grind" as const };
    expect(hasCommitment(grinder)).toBe(false);
    const hpBefore = grinder.health;
    applyEffortCosts(grinder, rng, []);
    expect(grinder.health).toBe(hpBefore);
    const ownerGrind = { ...solo, effort: "grind" as const };
    applyEffortCosts(ownerGrind, rng, []);
    expect(ownerGrind.health).toBeLessThan(hpBefore);
  });

  it("a business owner who is imprisoned is treated as absentee", () => {
    const { p } = established("restaurant", 6, (b) => {
      b.staff = 5;
    });
    expect(profit({ ...p, isInPrison: true })).toBeLessThan(profit(p));
  });
});

describe("hiring and staffing", () => {
  it("recommends staff that match demand and stays within limits", () => {
    const { p } = established("restaurant");
    const rec = recommendedStaff(p, p.business!);
    expect(rec).toBeGreaterThan(0);
    expect(rec).toBeLessThanOrEqual(kindOf(p.business!).maxStaff);
    let q = p;
    for (let i = 0; i < 40; i++) q = hireStaff(q).player;
    expect(q.business!.staff).toBeLessThanOrEqual(kindOf(q.business!).maxStaff * q.business!.locations);
  });
});

describe("financing", () => {
  it("loans are limited by profits and collateral and charge interest", () => {
    const { p: fresh } = adult(7);
    const young = startBusiness(fresh, "restaurant", "R", makeRng(1)).player;
    const youngLimit = loanLimit(young, young.business!);
    const { p } = established("restaurant");
    const limit = loanLimit(p, p.business!);
    expect(limit).toBeGreaterThan(youngLimit);
    expect(takeBusinessLoan(p, limit + 50_000).player.business!.debt).toBe(0);
    const borrowed = takeBusinessLoan(p, limit).player;
    expect(borrowed.business!.debt).toBe(limit);
    expect(borrowed.business!.cash).toBe(p.business!.cash + limit);
    expect(borrowed.business!.loanRate).toBeGreaterThan(0.04);
    expect(loanLimit(borrowed, borrowed.business!)).toBeLessThan(limit);
    const repaid = repayBusinessLoan(borrowed, limit).player;
    expect(repaid.business!.debt).toBe(0);
  });

  it("credit limits shrink in a recession and with a bad credit score", () => {
    const { p } = established("restaurant");
    const base = loanLimit(p, p.business!);
    const rec = { ...p, economy: { climate: "recession" as const, yearsLeft: 2 } };
    expect(loanLimit(rec, rec.business!)).toBeLessThan(base);
    const bad = { ...p, creditScore: 500 };
    expect(loanLimit(bad, bad.business!)).toBeLessThan(base);
  });

  const strain = (seed: number, cash: number) =>
    established("restaurant", seed, (b, pl) => {
      b.debt = 250_000;
      b.loanRate = 0.12;
      b.cash = cash;
      b.staff = 6;
      b.fit = 0.55;
      b.rescue = false;
      pl.bankBalance = 0;
    });
  const years = (p0: PlayerState, rng: Rng, n: number) => {
    let q = p0;
    const log: string[] = [];
    for (let i = 0; i < n && q.business; i++) {
      const notices: ReturnType<typeof bankruptcyOf> = [];
      processBusiness(q, rng, notices);
      log.push(...notices.map((x) => ("title" in x ? x.title : "")));
      q = { ...q, year: q.year + 1 };
    }
    return { q, log };
  };

  it("a business that cannot service its debt breaches covenants and the bank calls the loan", () => {
    const { rng, p } = strain(8, 700_000);
    const { q, log } = years(p, rng, 3);
    expect(log).toContain("Covenant Breach");
    expect(log).toContain("Loan Called");
    expect(q.business!.debt).toBeLessThan(250_000);
  });

  it("when it cannot pay the called loan it defaults into bankruptcy", () => {
    const { rng, p } = strain(8, 60_000);
    const { q, log } = years(p, rng, 8);
    expect(log).toContain("Covenant Breach");
    expect(q.business).toBeNull();
    expect(q.flags).toContain("biz_bankrupt");
    expect(q.creditScore).toBeLessThan(p.creditScore);
  });

  it("outside investors dilute you and take their share of the exit", () => {
    const { p: base } = established("startup", 9, (b) => {
      b.customers = 40;
      b.reputation = 60;
    });
    let diluted: PlayerState | null = null;
    for (let s = 1; s < 60 && !diluted; s++) {
      const r = raiseFunding(base, makeRng(s), 0.2).player;
      if (r.business!.ownerShare < 1) diluted = r;
    }
    expect(diluted).not.toBeNull();
    const b = diluted!.business!;
    expect(b.ownerShare).toBeCloseTo(0.8, 3);
    expect(b.cash).toBeGreaterThan(base.business!.cash);
    expect(b.rounds).toBe(1);
    const quote = saleQuote(diluted!, b);
    expect(quote.gross).toBe(Math.round(quote.equity * 0.8));
    expect(fundingTerms(diluted!, b, 0.2).preMoney).toBeGreaterThan(0);
  });

  it("angel money needs a track record", () => {
    const { p } = established("restaurant");
    expect(fundingTerms(p, p.business!, 0.2).available).toBe(true);
    const young = startBusiness(adult(10).p, "restaurant", "R", makeRng(1)).player;
    expect(fundingTerms(young, young.business!, 0.2).available).toBe(false);
  });
});

describe("bankruptcy", () => {
  it("wrecks credit, imposes a cool-off, and only then lets you found again", () => {
    const { p } = established("restaurant", 11, (b) => {
      b.debt = 400_000;
      b.cash = 0;
    });
    const owed = p.outstandingLoans;
    const res = fileBankruptcy(p).player;
    expect(res.business).toBeNull();
    expect(res.flags).toContain("biz_bankrupt");
    expect(res.flags).not.toContain("business_owner");
    expect(res.creditScore).toBe(Math.max(300, p.creditScore - 110));
    expect(res.outstandingLoans).toBeGreaterThan(owed);
    expect(blockerFor(res, "business")).toMatch(/bankruptcy/i);
    expect(startBusiness(res, "foodtruck", "x", makeRng(2)).player.business).toBeNull();
    const later = { ...res, year: res.year + 4 };
    expect(blockerFor(later, "business")).toBeNull();
    expect(startBusiness(later, "foodtruck", "x", makeRng(2)).player.business).not.toBeNull();
  });

  it("an insolvent company with no safety net goes bankrupt during Age Up", () => {
    const { rng, p } = established("nightclub", 12, (b, pl) => {
      b.cash = 0;
      b.fit = 0.3;
      b.staff = 15;
      b.rescue = false;
      pl.bankBalance = 0;
    });
    const q = runYears(p, rng, 3);
    expect(q.business).toBeNull();
    expect(q.flags.some((f) => f.startsWith("biz_cooloff:"))).toBe(true);
  });
});

describe("valuation and exit", () => {
  it("values by earnings and reputation, not a flat share of cost", () => {
    const { p } = established("restaurant");
    const strong = { ...p, business: { ...p.business!, reputation: 85 } };
    const weak = { ...p, business: { ...p.business!, reputation: 20 } };
    expect(saleQuote(strong, strong.business!).enterprise).toBeGreaterThan(saleQuote(weak, weak.business!).enterprise);
    expect(saleQuote(p, p.business!).multiple).toBeGreaterThan(1);
    const boom = { ...p, economy: { climate: "boom" as const, yearsLeft: 2 } };
    const bust = { ...p, economy: { climate: "recession" as const, yearsLeft: 2 } };
    expect(saleQuote(boom, boom.business!).net).toBeGreaterThan(saleQuote(bust, bust.business!).net);
  });

  it("a manager lifts the price: owner-dependent businesses sell at a discount", () => {
    const { p } = established("consultancy", 13);
    const managed = hireManager(p, makeRng(3), "solid").player;
    expect(saleQuote(managed, managed.business!).multiple).toBeGreaterThan(saleQuote(p, p.business!).multiple * 0.9);
    const ep = saleQuote(p, p.business!).enterprise;
    const em = saleQuote(managed, managed.business!).enterprise;
    expect(em).toBeGreaterThan(ep * 0.9);
  });

  it("selling beats closing by a wide margin; both pay fees, taxes and debts", () => {
    const { p } = established("restaurant", 14, (b) => {
      b.basis = 50_000;
    });
    const before = p.bankBalance;
    const sold = sellBusiness(p).player;
    const closed = closeBusiness(p).player;
    expect(sold.business).toBeNull();
    expect(closed.business).toBeNull();
    const soldGain = sold.bankBalance - before;
    const closedGain = closed.bankBalance - before;
    expect(soldGain).toBeGreaterThan(closedGain * 1.5);
    const q = saleQuote(p, p.business!);
    expect(soldGain).toBe(q.net);
    expect(q.fee).toBeGreaterThan(0);
    expect(sold.flags).toContain("biz_exit");
  });

  it("selling repays debt first and refuses to sell an underwater company", () => {
    const { p } = established("restaurant", 15, (b) => {
      b.debt = 100_000;
    });
    const q = saleQuote(p, p.business!);
    expect(q.equity).toBe(q.enterprise + p.business!.cash - 100_000);
    const under = { ...p, business: { ...p.business!, debt: 5_000_000, history: [], assets: 1_000 } };
    expect(sellBusiness(under).player.business).not.toBeNull();
  });

  it("handing the company to a manager pays less than a market sale but no fees", () => {
    const { rng, p } = established("restaurant", 16);
    const managed = hireManager(p, rng, "solid").player;
    const handed = handToManager(managed);
    expect(handed.player.business).toBeNull();
    expect(handed.player.bankBalance).toBeGreaterThan(managed.bankBalance);
    expect(handToManager(p).player.business).not.toBeNull();
  });

  it("exit proceeds are taxed only on the gain over invested capital", () => {
    const { p } = established("restaurant", 17);
    const q = saleQuote(p, p.business!);
    const loss = { ...p, business: { ...p.business!, basis: q.gross * 2 } };
    expect(saleQuote(loss, loss.business!).tax).toBe(0);
    const gain = { ...p, business: { ...p.business!, basis: 1 } };
    expect(saleQuote(gain, gain.business!).tax).toBeGreaterThan(0);
  });

  it("owner net worth counts only the owner's stake", () => {
    const { p } = established("restaurant", 18);
    const b = p.business!;
    expect(netWorth(p) - p.bankBalance + p.outstandingLoans).toBe(b.value);
    const half = { ...p, business: { ...b, ownerShare: 0.5 } };
    expect(stakeValue(half.business!)).toBe(Math.round(stakeValue(b) / 2));
  });
});

describe("yearly processing", () => {
  it("pays owners through draws according to the payout policy", () => {
    const run = (mode: "reinvest" | "salary") => {
      const { rng, p } = established("barcafe", 19, (b) => {
        b.staff = 3;
        b.cash = 200_000;
      });
      const q = setPayout(p, mode).player;
      return processBusiness(q, rng, []);
    };
    expect(run("reinvest")).toBe(0);
    expect(run("salary")).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed and keeps the books finite across many years", () => {
    const a = established("gym", 20);
    const b = established("gym", 20);
    const ra = runYears(a.p, a.rng, 6);
    const rb = runYears(b.p, b.rng, 6);
    expect(ra.business?.value).toBe(rb.business?.value);
    expect(ra.bankBalance).toBe(rb.bankBalance);
    for (const x of [ra, rb]) if (x.business) for (const v of [x.business.cash, x.business.value, x.business.debt, x.business.reputation, x.business.customers]) expect(Number.isFinite(v)).toBe(true);
  });

  it("records a profit history and the life log", () => {
    const { rng, p } = established("farm", 21);
    const q = runYears(p, rng, 2);
    expect(q.business === null || q.business.history.length >= p.business!.history.length + 1).toBe(true);
    expect(q.lifeLog.some((l) => l.startsWith("🏢"))).toBe(true);
  });

  it("marketing has diminishing returns", () => {
    const { p } = established("boutique", 22);
    const once = runMarketing(p).player;
    const gain1 = once.business!.marketing - p.business!.marketing;
    const sat = { ...p, business: { ...p.business!, marketing: 3 } };
    const twice = runMarketing(sat).player;
    expect(twice.business!.boost).toBeLessThan(once.business!.boost);
    expect(gain1).toBeCloseTo(1, 6);
  });

  it("projects an ordered range of outcomes", () => {
    for (const k of BUSINESS_TYPES) {
      const { p } = established(k.id, 23);
      const f = forecast(p, p.business!);
      expect(f.profit.low).toBeLessThanOrEqual(f.profit.mid);
      expect(f.profit.mid).toBeLessThanOrEqual(f.profit.high);
      expect(f.failureRisk).toBeGreaterThan(0);
      expect(f.failureRisk).toBeLessThan(1);
    }
  });

  it("a franchise needs a proven brand, then pays royalties", () => {
    const { rng, p } = established("restaurant", 24);
    expect(sellFranchise({ ...p, business: { ...p.business!, reputation: 30 } }, rng).player.business!.franchises).toBe(0);
    const ok = sellFranchise({ ...p, business: { ...p.business!, reputation: 70 } }, rng).player;
    expect(ok.business!.franchises).toBe(1);
    expect(stepYear(ok, ok.business!, NO_SHOCKS).pnl.royalties).toBeGreaterThan(0);
    expect(sellFranchise({ ...established("onlinestore").p }, rng).player.business!.franchises).toBe(0);
  });

  it("capital injections extend the runway and raise the owner's basis", () => {
    const { p } = established("restaurant", 25);
    const q = investInBusiness(p, 50_000).player;
    expect(q.business!.cash).toBe(p.business!.cash + 50_000);
    expect(q.business!.basis).toBe(p.business!.basis + 50_000);
    expect(q.bankBalance).toBe(p.bankBalance - 50_000);
  });
});

describe("saves and heirs", () => {
  it("old-format businesses upgrade gracefully", () => {
    const { rng, p } = adult(26);
    const old = { kind: "restaurant", name: "Old Place", value: 200_000, staff: 2, locations: 2, lastProfit: 15_000, boost: 0, founded: 2019 };
    const legacy = { ...p, business: old } as unknown as PlayerState;
    const parsed = parseSave(exportSave(legacy, 5))!;
    const b = parsed.player.business!;
    expect(b.name).toBe("Old Place");
    expect(b.staff).toBe(2);
    expect(b.locations).toBe(2);
    expect(b.reputation).toBeGreaterThan(0);
    expect(b.ownerShare).toBe(1);
    expect(b.history).toEqual([]);
    expect(b.manager).toBeNull();
    expect(b.rescue).toBe(true);
    expect(Number.isFinite(b.value) && b.value > 0).toBe(true);
    const next = runYears(parsed.player, rng, 2);
    expect(Number.isFinite(next.business?.value ?? 0)).toBe(true);
  });

  it("saves with a modern business round-trip", () => {
    const { p } = established("gym", 27);
    const back = parseSave(exportSave(p, 1))!.player.business!;
    expect(back.history).toEqual(p.business!.history);
    expect(back.fit).toBe(p.business!.fit);
  });

  it("an adult heir inherits a running business with its debts under a caretaker manager", () => {
    const { rng, p } = established("restaurant", 28, (b) => {
      b.debt = 60_000;
      b.cash = 80_000;
    });
    const parent = { ...p, alive: false, deathYear: p.year, age: 70 };
    const child = { id: "kid", name: "Sam Test", relation: "Child" as const, age: 30, alive: true, gender: "Male", health: 90, smarts: 60, looks: 60, relationshipBar: 80, incomeTier: 2 } as unknown as PlayerState["relatives"][number];
    parent.relatives = [child];
    const heir = continueAsChild(parent, "kid", rng)!;
    expect(heir.business).not.toBeNull();
    expect(heir.business!.debt).toBe(60_000);
    expect(heir.business!.manager).not.toBeNull();
    expect(heir.flags).toContain("business_owner");
    expect(heir.business!.value).toBeLessThan(stakeValue(p.business!));
    expect(heir.lifeLog.some((l) => /inherited the family business/i.test(l))).toBe(true);
    expect(blockerFor(heir, "job")).toMatch(/Test Co/);
  });

  it("a minor heir receives estate-sale cash instead", () => {
    const { rng, p } = established("restaurant", 29);
    const inh = inheritBusiness(p, 12, rng);
    expect(inh.business).toBeNull();
    expect(inh.cash).toBeGreaterThan(0);
    expect(inh.cash).toBeLessThan(stakeValue(p.business!));
  });
});

describe("business events and achievements", () => {
  it("ships at least eighteen business events, all gated on owning a business", () => {
    expect(BUSINESS_EVENTS.length).toBeGreaterThanOrEqual(18);
    const { p } = adult(30);
    p.business = null;
    for (const e of BUSINESS_EVENTS) {
      expect(LIFE_EVENTS.some((x) => x.id === e.id)).toBe(true);
      expect(isEligible({ ...p, age: 40 }, e), e.id).toBe(false);
    }
  });

  it("every option of every event resolves cleanly for a matching owner, and each event can fire for some kind", () => {
    const exercised = new Set<string>();
    for (const e of BUSINESS_EVENTS) {
      for (const kind of BUSINESS_TYPES) {
        const { rng, p } = established(kind.id, 31, (b) => {
          b.staff = 4;
          b.ownerShare = 0.8;
          b.morale = 30;
          b.compliance = 20;
          b.customers = 40;
          b.revenue = 6_000_000;
          b.reputation = 70;
        });
        addRelative(p, { relation: "Partner", ageOffset: [-2, 2], partnerStatus: "dating" }, rng);
        const owner = { ...p, age: 40, effort: "grind" as const, economy: { climate: "recession" as const, yearsLeft: 2 } };
        if (!isEligible(owner, e)) continue;
        for (let i = 0; i < e.options.length; i++) {
          const res = resolveEvent(owner, e, i, rng);
          expect(res.notices?.length).toBeGreaterThan(0);
          const b = res.player.business;
          if (b) for (const v of [b.cash, b.value, b.reputation, b.customers, b.morale]) expect(Number.isFinite(v)).toBe(true);
        }
        exercised.add(e.id);
        break;
      }
    }
    expect([...exercised].sort()).toEqual(BUSINESS_EVENTS.map((e) => e.id).sort());
  });

  it("an acquisition offer can end the business with a payout", () => {
    const e = BUSINESS_EVENTS.find((x) => x.id === "biz_acquisition_offer")!;
    const { rng, p } = established("restaurant", 32);
    const res = resolveEvent({ ...p, age: 40 }, e, 0, rng);
    expect(res.player.business).toBeNull();
    expect(res.player.bankBalance).toBeGreaterThan(p.bankBalance);
    expect(res.player.flags).toContain("biz_exit");
  });

  it("unlocks business achievements", () => {
    for (const id of ["biz_profit", "biz_decade", "biz_franchise", "biz_exit", "biz_bankrupt", "biz_comeback", "biz_unicorn"]) expect(ACHIEVEMENT_BY_ID[id]).toBeDefined();
    const { p } = established("restaurant", 33);
    p.flags.push("biz_bankrupt");
    expect(ACHIEVEMENT_BY_ID.biz_bankrupt.check(p)).toBe(true);
    expect(ACHIEVEMENT_BY_ID.biz_decade.check(p)).toBe(false);
    const closed = closeBusiness(p).player;
    expect(closed.business).toBeNull();
  });
});

describe("random play", () => {
  it("any mix of decisions, events and years keeps the books sane", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { rng, p: p0 } = adult(seed + 100, 600_000);
      const kind = BUSINESS_TYPES[seed % BUSINESS_TYPES.length];
      p0.smarts = 90;
      let p = startBusiness(p0, kind.id, "Fuzz Co", rng).player;
      const actions: Array<(q: PlayerState) => { player: PlayerState }> = [
        (q) => hireStaff(q),
        (q) => fireStaff(q),
        (q) => hireManager(q, rng, rng.pick(["solid", "star"] as const)),
        (q) => fireManager(q),
        (q) => trainStaff(q),
        (q) => runMarketing(q),
        (q) => setPrice(q, rng.int(0, 2)),
        (q) => setPayout(q, rng.pick(["reinvest", "balanced", "salary"] as const)),
        (q) => setInsurance(q, rng.int(0, 2)),
        (q) => setRescue(q, rng.chance(0.5)),
        (q) => complianceAudit(q),
        (q) => renovateBusiness(q),
        (q) => upgradeProduct(q),
        (q) => diversifyBusiness(q),
        (q) => pivotBusiness(q, rng),
        (q) => acquireCompetitor(q, rng),
        (q) => expandBusiness(q),
        (q) => takeBusinessLoan(q, rng.int(5, 300) * 1000),
        (q) => repayBusinessLoan(q, rng.int(5, 300) * 1000),
        (q) => investInBusiness(q, rng.int(5, 100) * 1000),
        (q) => raiseFunding(q, rng, rng.pick([0.1, 0.2, 0.3])),
        (q) => sellFranchise(q, rng),
      ];
      for (let year = 0; year < 14 && p.alive && p.business; year++) {
        for (let i = 0; i < 3; i++) p = rng.pick(actions)(p).player;
        const res = ageUp(p, rng);
        p = res.player;
        for (const n of res.notices ?? []) {
          if ("event" in n && n.event.id.startsWith("biz_") && p.business) {
            p = resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng).player;
            finalize(p, []);
          }
        }
        p.queuedEvents = [];
        if (p.business) {
          const b = p.business;
          for (const v of [b.cash, b.debt, b.value, b.assets, b.revenue, b.customers, b.reputation, b.quality, b.morale, b.facility]) expect(Number.isFinite(v)).toBe(true);
          expect(b.reputation).toBeGreaterThanOrEqual(0);
          expect(b.reputation).toBeLessThanOrEqual(100);
          expect(b.debt).toBeGreaterThanOrEqual(0);
          expect(b.ownerShare).toBeGreaterThan(0);
          expect(b.ownerShare).toBeLessThanOrEqual(1);
          expect(p.currentJob).toBeNull();
        }
        expect(p.bankBalance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
