/**
 * Rights and legacy: credit and plagiarism disputes, selling or buying back catalogue, and the long tail
 * of a career. Pure bookkeeping on top of musicCore; no imports of the other music modules (they import this).
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { info, logEvent, payout, type Notices } from "./creativeCore";
import { catalogueValue, masterBuybackPrice } from "./musicCore";

/** Start a dispute. Returns false if one is already running. */
export function raiseDispute(p: PlayerState, kind: "credit" | "plagiarism" | "masters", claimant: string, amount: number, years: number): boolean {
  if (p.music.dispute) return false;
  p.music.dispute = { kind, claimant, amount: Math.round(amount), yearsLeft: years };
  addLog(p, `Legal trouble: ${claimant} is demanding ${money(Math.round(amount))} over ${kind === "plagiarism" ? "a melody they say you lifted" : kind === "masters" ? "ownership of your recordings" : "songwriting credit"}.`);
  return true;
}

const DISPUTE_NAME = { credit: "Credit Dispute", plagiarism: "Plagiarism Claim", masters: "Masters Dispute" } as const;

export function resolveDispute(p0: PlayerState, rng: Rng, how: "settle" | "fight"): ActionResult {
  const p = clone(p0);
  const d = p.music.dispute;
  if (!d) return { player: p0 };
  if (how === "settle") {
    if (p.bankBalance < d.amount) return { player: p0, notices: [info("Can't Afford It", `A settlement is ${money(d.amount)}.`, "bad")] };
    p.bankBalance -= d.amount;
    p.music.dispute = null;
    const body = `You settled with ${d.claimant} for ${money(d.amount)} and a confidentiality agreement. Expensive, quiet and over.`;
    addLog(p, body);
    return { player: p, notices: [info("Settled", body, "neutral")] };
  }
  const fees = Math.round(d.amount * 0.2);
  if (p.bankBalance < fees) return { player: p0, notices: [info("Can't Afford It", `Taking it to court costs ${money(fees)} in fees up front.`, "bad")] };
  p.bankBalance -= fees;
  p.music.dispute = null;
  const strength = d.kind === "plagiarism" ? 0.5 : d.kind === "credit" ? 0.45 : 0.4;
  if (rng.chance(clamp(strength + p.smarts / 600 + (p.music.manager ? 0.08 : 0), 0.2, 0.75))) {
    const body = `The court threw out ${d.claimant}'s claim. You paid ${money(fees)} in fees and kept every cent of the rest. The press called you vindicated.`;
    addLog(p, body);
    changeStat(p, "happiness", 4);
    return { player: p, notices: [info("Case Dismissed", body, "good")] };
  }
  const pay = Math.round(d.amount * 1.4);
  p.bankBalance -= Math.min(p.bankBalance, pay);
  p.music.relevance = clamp(p.music.relevance - 4);
  changeStat(p, "happiness", -6);
  const body = `You lost in court. ${d.claimant} was awarded ${money(pay)} on top of your ${money(fees)} fees, and the headlines were not kind.`;
  addLog(p, body);
  return { player: p, notices: [info("Judgement Against You", body, "bad")] };
}

/** An unanswered dispute runs out its clock and goes against you. */
export function disputeTick(p: PlayerState, rng: Rng, notices: Notices) {
  const d = p.music.dispute;
  if (!d) {
    if (p.music.fans >= 50_000 && p.music.hits > 0 && rng.chance(0.02)) {
      raiseDispute(p, "plagiarism", rng.pick(["an unknown songwriter", "a session guitarist", "a small label", "a jazz estate"]), Math.max(15_000, p.music.lastIncome.royalties * 0.2), 2);
      notices.push(info("Lawsuit", `${p.music.dispute?.claimant ?? "Someone"} claims you lifted part of a song. See the Legacy section of your music tab.`, "bad"));
    }
    return;
  }
  d.yearsLeft -= 1;
  if (d.yearsLeft > 0) return;
  const pay = Math.round(d.amount * 1.3);
  p.bankBalance -= Math.min(p.bankBalance, pay);
  p.music.dispute = null;
  p.music.relevance = clamp(p.music.relevance - 4);
  logEvent(p, notices, "Default Judgement", `You never answered ${d.claimant}'s ${DISPUTE_NAME[d.kind].toLowerCase()}. A court ruled for them by default: ${money(pay)}.`, "bad");
}

export function sellCatalogue(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const value = catalogueValue(p);
  if (value < 5_000) return { player: p0, notices: [info("Not Worth Buying", "Your catalogue doesn't earn enough for anyone to bid on it.")] };
  const net = payout(p, value);
  for (const a of p.music.albums) {
    if (!a.labelOwned) {
      a.sold = true;
      a.royalty = 0;
      a.evergreen = 0;
    }
  }
  p.music.catalogSold = (p.music.catalogSold ?? 0) + value;
  changeStat(p, "happiness", 3);
  const body = `You sold the rights to your back catalogue for ${money(value)} (${money(net)} after withholding). A fund now owns what you made. The albums still stream, but not for you.`;
  addLog(p, body);
  return { player: p, notices: [info("Catalogue Sold", body, "good")] };
}

export function buyBackMasters(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const price = masterBuybackPrice(p);
  if (price <= 0) return { player: p0 };
  if (p.bankBalance < price) return { player: p0, notices: [info("Can't Afford It", `The label wants ${money(price)} for your masters.`, "bad")] };
  p.bankBalance -= price;
  let n = 0;
  for (const a of p.music.albums) {
    if (a.labelOwned) {
      a.labelOwned = false;
      n += 1;
    }
  }
  changeStat(p, "happiness", 8);
  const body = `You bought back the masters to ${n} record${n > 1 ? "s" : ""} for ${money(price)}. They are yours again, and so is every royalty.`;
  addLog(p, body);
  return { player: p, notices: [info("Masters Recovered", body, "jackpot")] };
}
