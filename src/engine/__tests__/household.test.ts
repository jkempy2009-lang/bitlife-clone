import { NEUTRAL } from "./helpers/neutral";
import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { createNewPlayer, getPartner, makeRelativeBase } from "../state";
import { HANDOVER_CASH_SHARE, continueAsChild, handoverBlocker } from "../legacy";
import { ageUp } from "../ageUp";
import { endRelationship } from "../social";
import { divorceSettlement, minorChildren, spouseIncome } from "../household";
import type { PlayerState, Relative } from "@/types/game.types";

const married = (seed: number, tier: number): { rng: ReturnType<typeof makeRng>; p: PlayerState } => {
  const rng = makeRng(seed);
  const p = createNewPlayer({ scenario: "average", startYear: 2026, talents: NEUTRAL }, rng);
  p.age = 35;
  p.education.degrees = ["highschool"];
  p.education = { ...p.education, stage: "None", yearsLeft: 0 };
  const partner: Relative = {
    id: "sp", relation: "Partner", name: "Sam Spouse", age: 34, relationshipBar: 80, health: 90, alive: true, incomeTier: tier,
    gender: "Female", smarts: 60, looks: 60, partnerStatus: "married", marriedYear: p.year - 6,
  };
  p.relatives = p.relatives.filter((r) => r.relation !== "Partner").concat(partner);
  p.bankBalance = 100_000;
  return { rng, p };
};

describe("household economy", () => {
  it("a high-earning spouse lifts household savings; shared home costs less than two flats", () => {
    const rich = married(1, 5);
    const poor = married(1, 1);
    const a = ageUp(rich.p, makeRng(7)).player.bankBalance;
    const b = ageUp(poor.p, makeRng(7)).player.bankBalance;
    expect(a).toBeGreaterThan(b + 50_000);
  });

  it("divorce settlement grows with the length of the marriage and can force a house sale", () => {
    const { p } = married(2, 3);
    const partner = getPartner(p)!;
    p.bankBalance = 200_000;
    partner.marriedYear = p.year - 1;
    const short = divorceSettlement(structuredClone(p), partner, false);
    partner.marriedYear = p.year - 15;
    const long = divorceSettlement(structuredClone(p), partner, false);
    expect(long).toBeGreaterThan(short);
    const fault = divorceSettlement(structuredClone(p), partner, true);
    expect(fault).toBeGreaterThan(long);

    p.bankBalance = 1_000;
    p.properties = [{ id: "h", name: "Family Home", originalValue: 400_000, currentValue: 400_000, condition: 80, monthlyMortgage: 0, remainingTerm: 0, mortgageBalance: 0, archetypeId: "x" }];
    endRelationship(p, "divorce");
    expect(p.properties).toHaveLength(0);
    expect(p.bankBalance).toBeGreaterThan(100_000);
  });

  it("pays child support after a divorce while kids are minors, and stops when they grow up", () => {
    const { p } = married(3, 3);
    p.relatives.push({ id: "k", relation: "Child", name: "Kid", age: 16, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Male", smarts: 50, looks: 50 });
    p.currentJob = { id: "j", title: "Manager", company: "X", salary: 80_000, performance: 70, tier: 2, lineId: "retail" };
    endRelationship(p, "divorce");
    expect(p.flags).toContain("child_support");
    expect(minorChildren(p)).toHaveLength(1);
    let q = ageUp(p, makeRng(1)).player;
    expect(q.flags).toContain("child_support");
    q = ageUp(q, makeRng(2)).player;
    q = ageUp(q, makeRng(3)).player;
    expect(q.flags).not.toContain("child_support");
  });

  it("spouse income drops in retirement", () => {
    const { p } = married(4, 4);
    const sp = getPartner(p)!;
    const working = spouseIncome(sp);
    sp.age = 70;
    expect(spouseIncome(sp)).toBeLessThan(working / 2);
  });
});

describe("family home", () => {
  it("adults can live with parents cheaply and move out for a fee", async () => {
    const { housingCost, livesWithParents, toggleFamilyHome } = await import("../world");
    const { p } = married(7, 3);
    p.relatives = p.relatives.filter((r) => r.relation !== "Partner");
    p.age = 23;
    const rentCost = housingCost(p);
    const home = toggleFamilyHome(p).player;
    expect(livesWithParents(home)).toBe(true);
    expect(housingCost(home)).toBeLessThan(rentCost / 3);
    const out = toggleFamilyHome(home).player;
    expect(livesWithParents(out)).toBe(false);
    expect(out.bankBalance).toBe(home.bankBalance - 500);
    for (const r of home.relatives) if (r.relation === "Parent") r.alive = false;
    expect(livesWithParents(home)).toBe(false);
  });
});

describe("friends and family support", () => {
  it("a good word boosts the next job application once; loans are repaid or defaulted", async () => {
    const { supportAction, processFriendLoans } = await import("../friends");
    const { applyForJob } = await import("../career");
    const { p } = married(9, 3);
    p.relatives.push({ id: "F1", relation: "Friend", name: "Frankie Friend", age: 33, relationshipBar: 90, health: 90, alive: true, incomeTier: 2, gender: "Male", smarts: 50, looks: 50 });
    p.currentJob = null;
    let got: PlayerState | null = null;
    for (let s = 1; s <= 20 && !got; s++) {
      const r = supportAction({ ...structuredClone(p), annual: {} }, "F1", "favor", makeRng(s)).player;
      if (r.flags.includes("referral")) got = r;
    }
    expect(got).not.toBeNull();
    const applied = applyForJob(got!, "retail", makeRng(3)).player;
    expect(applied.flags).not.toContain("referral");
    // lending
    const lent = supportAction(p, "F1", "lend", makeRng(1), 1_000).player;
    expect(lent.bankBalance).toBe(p.bankBalance - 1_000);
    expect(lent.flags.some((f) => f.startsWith("lent:F1"))).toBe(true);
    let repaid = 0;
    for (let s = 1; s <= 30; s++) {
      const q = structuredClone(lent);
      q.year += 1;
      processFriendLoans(q, makeRng(s), []);
      if (q.bankBalance > lent.bankBalance) repaid++;
    }
    expect(repaid).toBeGreaterThan(10);
  });
});

describe("retirement account", () => {
  it("contributions are deducted, matched by the employer, grow, and fund retirees", async () => {
    const { contributionFor, drawdownFor, withdrawRetirement, setSavingsLevel } = await import("../retirement");
    const { p } = married(12, 3);
    p.relatives = p.relatives.filter((r) => r.relation !== "Partner");
    p.currentJob = { id: "j", title: "Manager", company: "X", salary: 80_000, performance: 70, tier: 2, lineId: "retail" };
    const c = contributionFor(p);
    expect(c.employee).toBe(4_000);
    expect(c.employer).toBe(2_000);
    expect(contributionFor(setSavingsLevel(p, 0).player).employee).toBe(0);
    const aged = ageUp(p, makeRng(4)).player;
    expect(aged.retirementSavings).toBeGreaterThanOrEqual(5_500);
    // retirees draw down
    const old = { ...structuredClone(p), age: 70, currentJob: null, retirementSavings: 500_000 };
    expect(drawdownFor(old)).toBeGreaterThan(20_000);
    expect(ageUp(old, makeRng(5)).player.retirementSavings).toBeLessThan(500_000 * 1.4);
    // early withdrawal penalty
    const young = { ...structuredClone(p), age: 40, retirementSavings: 50_000 };
    const w = withdrawRetirement(young, 10_000).player;
    expect(w.bankBalance - young.bankBalance).toBe(7_000);
    expect(w.retirementSavings).toBe(40_000);
  });

  it("savings pass to the estate at death", async () => {
    const { killPlayer } = await import("../mortality");
    const { p } = married(13, 3);
    p.retirementSavings = 100_000;
    const before = p.bankBalance;
    killPlayer(p, "old age");
    expect(p.bankBalance).toBe(before + 85_000);
    expect(p.retirementSavings).toBe(0);
  });
});

describe("parenting", () => {
  it("tutoring helps, private school costs and helps, neglected teens get into trouble, 18-year-olds launch", async () => {
    const { childAction, schoolCosts, processChildren } = await import("../parenting");
    const { p } = married(14, 3);
    const kid: Relative = { id: "K", relation: "Child", name: "Kay Kid", age: 10, relationshipBar: 70, health: 90, alive: true, incomeTier: 3, gender: "Female", smarts: 50, looks: 50 };
    p.relatives.push(kid);
    const t = childAction(p, "K", "tutor", makeRng(1)).player;
    expect(t.relatives.find((r) => r.id === "K")!.smarts).toBeGreaterThan(50);
    expect(childAction(t, "K", "tutor", makeRng(1)).notices?.[0]).toMatchObject({ title: "Already Done" });
    const s = childAction(p, "K", "school", makeRng(1)).player;
    expect(schoolCosts(s)).toBe(12_000);
    expect(schoolCosts(childAction(s, "K", "school", makeRng(1)).player)).toBe(0);
    // trouble
    let trouble = 0;
    for (let i = 1; i <= 40; i++) {
      const q = structuredClone(p);
      const k = q.relatives.find((r) => r.id === "K")!;
      k.age = 15;
      k.relationshipBar = 15;
      processChildren(q, makeRng(i), []);
      if ((k.trouble ?? 0) > 0) trouble++;
    }
    expect(trouble).toBeGreaterThan(2);
    // launch
    const q = structuredClone(p);
    const k = q.relatives.find((r) => r.id === "K")!;
    k.age = 18;
    k.smarts = 80;
    processChildren(q, makeRng(5), []);
    expect(k.occupation).toBeTruthy();
    expect(k.incomeTier).toBeGreaterThanOrEqual(2);
  });
});

describe("handing your life to a child while alive", () => {
  const setup = (seed = 3) => {
    const rng = makeRng(seed);
    const p = createNewPlayer({ scenario: "wealthy", startYear: 2026, talents: NEUTRAL }, rng);
    p.age = 55;
    p.birthYear = p.year - 55;
    p.bankBalance = 400_000;
    p.outstandingLoans = 20_000;
    p.relatives = p.relatives.filter((r) => r.relation !== "Child");
    const kid = makeRelativeBase(rng, "Child", `Sam ${p.lastName}`, 24, "Male", 3, 70);
    p.relatives.push(kid);
    return { rng, p, kid };
  };

  it("keeps you alive as a parent, moves the money and leaves debts behind", () => {
    const { rng, p, kid } = setup();
    const next = continueAsChild(p, kid.id, rng, true)!;
    expect(next).not.toBeNull();
    expect(next.firstName).toBe("Sam");
    expect(next.bankBalance).toBe(Math.round(400_000 * HANDOVER_CASH_SHARE));
    expect(next.outstandingLoans).toBe(0);
    const parent = next.relatives.find((r) => r.relation === "Parent" && r.name.startsWith(p.firstName));
    expect(parent?.alive).toBe(true);
    expect(parent?.age).toBe(55);
    expect(next.queuedEvents).not.toContain("legacy_memorial");
    expect(parent?.traits ?? []).not.toContain("Grieving");
  });

  it("the heir plays on and the old parent still ages in the family", () => {
    const { rng, p, kid } = setup(5);
    let next = continueAsChild(p, kid.id, rng, true)!;
    for (let i = 0; i < 10 && next.alive; i++) next = ageUp(next, rng).player;
    expect(next.age).toBeGreaterThan(24);
    expect(next.relatives.some((r) => r.relation === "Parent" && r.name.startsWith(p.firstName))).toBe(true);
  });

  it("works any time: from prison, on trial, or as a sovereign (abdication to the chosen child)", () => {
    const { rng, p, kid } = setup();
    expect(handoverBlocker(p, kid)).toBeNull();
    expect(handoverBlocker(p, { ...kid, alive: false })).not.toBeNull();
    const jailed = continueAsChild({ ...p, isInPrison: true }, kid.id, rng, true)!;
    expect(jailed.isInPrison).toBe(false);
    expect(jailed.relatives.find((r) => r.relation === "Parent" && r.traits?.includes("In prison"))?.alive).toBe(true);
    const king = { ...p, royalRank: "King" as const, royal: { crown: "self" as const, hrh: true, peerage: null, line: 0 } };
    const elder = makeRelativeBase(rng, "Child", "Eldest Royal", 30, "Female", 3, 70);
    king.relatives = [...p.relatives, elder];
    const crowned = continueAsChild(king, kid.id, rng, true)!;
    expect(crowned.royalRank).toBe("King");
    expect(crowned.royal?.crown).toBe("self");
  });
});
