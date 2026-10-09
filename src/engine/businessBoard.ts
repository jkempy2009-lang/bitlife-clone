/**
 * Ownership and control. Outside investors are people with agendas (a VC wants growth then an exit, an angel wants
 * profit), their patience runs down when the company disappoints them, and a hostile board can push the founder out.
 * An ousted founder (or one who deliberately steps back to chair) keeps the shares but not the job: that is the one
 * way to own a company without it being a full-time commitment.
 *
 * Invariant: the sum of `investors[].share` equals `1 - ownerShare` (see `ensureBusiness`).
 */
import type { ActionResult, Business, BusinessInvestor, InvestorAgenda, InvestorKind, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat } from "./state";
import { canSpend, done, info, open, reserveOf, unchanged, type Notices } from "./businessKit";
import { equityOf, exitTax, kindOf, revenueGrowth } from "./businessModel";
import { isStudyingFullTime } from "./occupation";

export const AGENDA_INFO: Record<InvestorAgenda, { label: string; blurb: string }> = {
  growth: { label: "Wants growth", blurb: "Judged on revenue growth. Hates cash piling up and payouts to you." },
  profit: { label: "Wants profit", blurb: "Judged on steady profit. Hates losses and money locked up unspent." },
  exit: { label: "Wants an exit", blurb: "Wants a sale or a listing within a few years of putting money in." },
};

const FUNDS = ["Harbor Ventures", "Northlight Capital", "Redwood Partners", "Bluepeak Fund", "Ironbridge Capital", "Lantern Ventures", "Summit Row Partners"];
const ANGELS = ["Margaret Hale", "Victor Osei", "Dana Whitfield", "Rohan Mehta", "Elise Moreau", "Tobias Grant", "Yuki Nakamura"];

export function makeInvestor(kind: InvestorKind, share: number, invested: number, year: number, rng: Rng): BusinessInvestor {
  const vc = kind === "vc";
  return {
    id: `inv-${year}-${rng.int(100, 999)}`,
    name: rng.pick(vc ? FUNDS : ANGELS),
    kind,
    share: Math.round(share * 1000) / 1000,
    agenda: vc ? (rng.chance(0.55) ? "growth" : "exit") : rng.chance(0.75) ? "profit" : "exit",
    invested: Math.round(invested),
    pref: vc,
    since: year,
  };
}

/** Record a sale of shares: the owner's share falls and the ledger gains the new holder. */
export function sellShares(b: Business, inv: BusinessInvestor) {
  b.ownerShare = Math.round(b.ownerShare * (1 - inv.share) * 1000) / 1000;
  // Everyone already on the register is diluted along with the owner.
  for (const o of b.investors) o.share = Math.round(o.share * (1 - inv.share) * 1000) / 1000;
  b.investors.push(inv);
  const gap = Math.round((1 - b.ownerShare - b.investors.reduce((s, i) => s + i.share, 0)) * 1000) / 1000;
  if (gap !== 0) inv.share = Math.round((inv.share + gap) * 1000) / 1000;
}

const outsideShare = (b: Business) => b.investors.filter((i) => i.kind !== "staff").reduce((s, i) => s + i.share, 0);

/** Which agenda is driving the unrest on the board. */
export function dominantAgenda(b: Business): InvestorAgenda | null {
  const tally: Record<InvestorAgenda, number> = { growth: 0, profit: 0, exit: 0 };
  for (const i of b.investors) if (i.kind !== "staff") tally[i.agenda] += i.share;
  const best = (Object.keys(tally) as InvestorAgenda[]).sort((a, c) => tally[c] - tally[a])[0];
  return tally[best] > 0 ? best : null;
}

export const hostileBoard = (b: Business) => outsideShare(b) > 0.5;

function unhappy(b: Business, i: BusinessInvestor, year: number, pretax: number): boolean {
  const k = kindOf(b);
  if (i.agenda === "growth") return revenueGrowth(b) < 0.05 || (b.payout !== "reinvest" && b.cash > k.fixed * b.locations);
  if (i.agenda === "profit") return pretax < 0 || (b.payout === "reinvest" && b.cash > 1.5 * (k.fixed * b.locations + b.staff * k.wage));
  return year - i.since >= 4;
}

/** Yearly: investor patience goes up or down with results measured against what each backer wants. */
export function processBoard(p: PlayerState, b: Business, notices: Notices, pretax: number) {
  const outside = outsideShare(b);
  if (outside < 0.12) {
    b.boardHeat = Math.max(0, b.boardHeat - 15);
    return;
  }
  let bad = 0;
  for (const i of b.investors) if (i.kind !== "staff" && unhappy(b, i, p.year, pretax)) bad += i.share;
  const frac = bad / outside;
  const weight = Math.min(1, outside / 0.4) * (b.ownerShare > 0.5 ? 0.7 : 1);
  b.boardHeat = Math.round(clamp(b.boardHeat + weight * (frac * 30 - (1 - frac) * 12)));
  if (b.boardHeat >= 55 && b.boardHeat - weight * (frac * 30) < 55) {
    const body = `${b.name}'s investors are losing patience. Expect a tense board meeting soon.`;
    addLog(p, body);
    notices.push(info("Restless Board", body, "bad"));
  }
}

export function boardNotes(b: Business): string[] {
  const notes: string[] = [];
  if (b.boardHeat >= 55 && outsideShare(b) >= 0.12) notes.push(`Investors are impatient (${Math.round(b.boardHeat)}/100). Results, a buy-out or a deal could settle them.`);
  if (hostileBoard(b)) notes.push("Outside investors own most of the company. If they lose faith, they can vote you out.");
  if (b.passive) notes.push(b.ousted ? "You were pushed out. You hold the shares but not the controls." : "You are chairing from the sidelines. Managers don't care about your money as much as you do.");
  return notes;
}

// ---------------------------------------------------------------------------
// Investor deals
// ---------------------------------------------------------------------------

export const investorBuyoutPrice = (b: Business, i: BusinessInvestor) => {
  const fair = Math.max(0, equityOf(b)) * i.share * 1.1;
  return Math.round(i.pref ? Math.max(fair, Math.min(i.invested, Math.max(0, equityOf(b)))) : fair);
};

/** Buy one investor out completely (fair value plus a 10% premium; a VC will not take less than their money back). */
export function buyOutInvestor(p0: PlayerState, id: string): ActionResult {
  const c = open(p0);
  const inv = c?.b.investors.find((x) => x.id === id);
  if (!c || !inv) return { player: p0 };
  const { p, b } = c;
  const price = investorBuyoutPrice(b, inv);
  if (p.bankBalance >= price) {
    p.bankBalance -= price;
    b.basis += price;
  } else if (b.cash - price >= reserveOf(b)) {
    b.cash -= price;
  } else return unchanged(p0, "Can't Afford It", `${inv.name} wants ${money(price)} for their ${(inv.share * 100).toFixed(0)}%. Your savings and the company's spare cash don't stretch that far.`, "bad");
  b.ownerShare = Math.round((b.ownerShare + inv.share) * 1000) / 1000;
  b.investors = b.investors.filter((x) => x.id !== id);
  b.boardHeat = Math.max(0, b.boardHeat - 25);
  return done(c, "Investor Bought Out", `You bought ${inv.name} out of ${b.name} for ${money(price)}. You now own ${(b.ownerShare * 100).toFixed(0)}%.`);
}

/** Take back `frac` of the company, starting with the biggest outside holder. Used by events. */
export function takeBackShares(b: Business, frac: number) {
  let left = Math.min(frac, 1 - b.ownerShare);
  const order = [...b.investors].sort((x, y) => y.share - x.share);
  for (const i of order) {
    if (left <= 0) break;
    const t = Math.min(i.share, left);
    i.share = Math.round((i.share - t) * 1000) / 1000;
    left -= t;
  }
  b.investors = b.investors.filter((i) => i.share > 0.0005);
  b.ownerShare = Math.round((1 - b.investors.reduce((s, i) => s + i.share, 0)) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------

/** Cash the company could hand out now without touching its safety reserve. */
export const spareCash = (b: Business) => Math.max(0, Math.round(b.cash - reserveOf(b)));

/** Pay shareholders a special dividend out of idle company cash. The owner's slice is taxed as a gain. */
export function payDividend(p0: PlayerState, requested: number): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { p, b } = c;
  const amount = Math.min(Math.round(requested), spareCash(b));
  if (amount < 1_000) return unchanged(p0, "Nothing to Pay Out", "The company has no spare cash beyond the reserve it needs to stay safe.");
  b.cash -= amount;
  const mine = Math.round(amount * b.ownerShare);
  const tax = exitTax(p.residence.country, mine);
  p.bankBalance += mine - tax;
  const others = amount - mine;
  return done(c, "Dividend Paid", `${b.name} paid out ${money(amount)}. You received ${money(mine - tax)} after ${money(tax)} tax${others > 0 ? `; investors took ${money(others)}` : ""}. The company's reserve was left alone.`);
}

// ---------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------

export function caretakerCeo(b: Business, rng: Rng, year: number, skill: number) {
  const k = kindOf(b);
  const first = rng.pick(["Pat", "Lee", "Chris", "Jamie", "Avery", "Morgan"]);
  const last = rng.pick(["Moreno", "Walsh", "Iyer", "Kowalski", "Sandoval", "Okoye"]);
  return { name: `${first} ${last}`, skill, wage: Math.round(k.mgrWage * 1.2), hired: year };
}

export function stepBack(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { b } = c;
  if (b.passive) return unchanged(p0, "Already Chairing", "You already sit above the day-to-day.");
  if (!b.manager) return unchanged(p0, "Nobody to Run It", "Hire a general manager first. Without someone in charge, stepping back is just walking away.");
  b.passive = true;
  b.neglect = 0;
  return done(c, "Stepped Back", `You became chair of ${b.name} and left ${b.manager.name} in charge. You are no longer tied to the business full-time: you can take a job, study or start something else, while your shares keep paying out. Without your eyes on it, though, standards will drift and a manager watches the company's money less closely than you do.`);
}

export function takeBackControl(p0: PlayerState): ActionResult {
  const c = open(p0);
  if (!c) return { player: p0 };
  const { p, b } = c;
  if (!b.passive) return { player: p0 };
  if (b.ousted) return unchanged(p0, "Locked Out", "The board pushed you out. You can't take the reins back, only sell your shares.", "bad");
  if (p.currentJob) return unchanged(p0, "You Have a Job", `You can't run ${b.name} again while working as a ${p.currentJob.title}. Quit first.`, "bad");
  if (isStudyingFullTime(p) && p.education.stage !== "HighSchool") return unchanged(p0, "Busy Studying", "You can't take the reins again while studying full time.", "bad");
  b.passive = false;
  return done(c, "Back in Charge", `You took the reins of ${b.name} again. ${b.manager ? `${b.manager.name} stays on as general manager.` : ""}`, "neutral");
}

/** The board removes the founder. The company carries on under a professional CEO. */
export function oust(p: PlayerState, rng: Rng): string | undefined {
  const b = p.business;
  if (!b) return undefined;
  b.passive = true;
  b.ousted = true;
  b.rescue = false;
  b.neglect = 0;
  b.boardHeat = 20;
  if (!b.manager) b.manager = caretakerCeo(b, rng, p.year, 62);
  changeStat(p, "happiness", -12);
  return `The board voted you out of ${b.name}. ${b.manager.name} is the new CEO. You keep your ${(b.ownerShare * 100).toFixed(0)}% stake but not the controls, and you are free to do something else with your time.`;
}

/** Passive owners lose a little to drift and perks; an interim CEO appears when the manager leaves. */
export function processPassive(p: PlayerState, b: Business, rng: Rng, notices: Notices) {
  if (!b.passive) return;
  const k = kindOf(b);
  if (!b.manager) {
    b.manager = caretakerCeo(b, rng, p.year, rng.int(42, 62));
    const body = `${b.name}'s manager left, so the board appointed ${b.manager.name} as interim CEO at ${money(b.manager.wage)} a year.`;
    addLog(p, body);
    notices.push(info("Interim CEO", body, "neutral"));
  }
  if (rng.chance(0.07 * (1.3 - b.compliance / 100))) {
    const loss = Math.round(0.035 * Math.max(b.revenue, k.baseRev * 0.3));
    b.cash -= loss;
    const body = `With nobody watching closely, ${b.name}'s management spent ${money(loss)} on perks and pet projects.`;
    addLog(p, body);
    notices.push(info("Executive Perks", body, "bad"));
  }
}

/** For the UI: can you afford the dividend at all? */
export const canPayDividend = (p: PlayerState, b: Business) => spareCash(b) >= 1_000 && canSpend(p, b, 0);
