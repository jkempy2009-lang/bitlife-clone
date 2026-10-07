export interface Card {
  rank: string;
  suit: string;
}

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

export function newDeck(random: () => number = Math.random): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["J", "Q", "K"].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export const isBlackjack = (hand: Card[]) => hand.length === 2 && handValue(hand) === 21;

export type Outcome = "win" | "blackjack" | "lose" | "push";

/** Dealer draws to 17 and the winner is decided. Returns payout multiplier applied to the wager. */
export function settle(player: Card[], dealer: Card[], deck: Card[]): { dealer: Card[]; deck: Card[]; outcome: Outcome; multiplier: number } {
  const pv = handValue(player);
  const d = [...dealer];
  const rest = [...deck];
  if (pv > 21) return { dealer: d, deck: rest, outcome: "lose", multiplier: 0 };
  if (isBlackjack(player) && !isBlackjack(d)) return { dealer: d, deck: rest, outcome: "blackjack", multiplier: 2.5 };
  while (handValue(d) < 17) d.push(rest.pop()!);
  const dv = handValue(d);
  if (dv > 21 || pv > dv) return { dealer: d, deck: rest, outcome: "win", multiplier: 2 };
  if (pv === dv) return { dealer: d, deck: rest, outcome: "push", multiplier: 1 };
  return { dealer: d, deck: rest, outcome: "lose", multiplier: 0 };
}

// ---------------------------------------------------------------------------
// Player-state actions. The hand lives in PlayerState so it survives reloads.
// ---------------------------------------------------------------------------
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { money, clamp } from "@/lib/format";
import { addLog } from "./state";

const note = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

function finishHand(p: PlayerState, stakeMessage = true) {
  const hand = p.blackjack!;
  const res = settle(hand.player, hand.dealer, hand.deck);
  const payout = Math.round(hand.wager * res.multiplier);
  p.bankBalance += payout;
  const message =
    res.outcome === "blackjack" ? `Blackjack! You win ${money(payout - hand.wager)}.`
    : res.outcome === "win" ? `You win ${money(payout - hand.wager)}!`
    : res.outcome === "push" ? "Push. Your wager is returned."
    : `You lose ${money(hand.wager)}.`;
  p.blackjack = { ...hand, phase: "done", dealer: res.dealer, deck: res.deck, message };
  if (stakeMessage) addLog(p, `Blackjack: ${message}`);
}

export function blackjackDeal(p0: PlayerState, wager: number, rng: Rng): ActionResult {
  const p = structuredClone(p0);
  if (p.age < 18) return { player: p0, notices: [note("Too Young", "You must be 18 to gamble.")] };
  if (p.blackjack?.phase === "play") return { player: p0 };
  if (wager <= 0 || wager > p.bankBalance) return { player: p0, notices: [note("Bad Wager", "You can't bet that much.", "bad")] };
  p.bankBalance -= wager;
  p.vices.gambling = clamp(p.vices.gambling + 1);
  const deck = newDeck(() => rng.next());
  const player = [deck.pop()!, deck.pop()!];
  const dealer = [deck.pop()!, deck.pop()!];
  p.blackjack = { phase: "play", deck, player, dealer, wager, message: "" };
  if (isBlackjack(player) || isBlackjack(dealer)) finishHand(p);
  return { player: p };
}

export function blackjackHit(p0: PlayerState): ActionResult {
  const p = structuredClone(p0);
  const hand = p.blackjack;
  if (!hand || hand.phase !== "play") return { player: p0 };
  const deck = [...hand.deck];
  const next = [...hand.player, deck.pop()!];
  p.blackjack = { ...hand, deck, player: next };
  if (handValue(next) >= 21) finishHand(p);
  return { player: p };
}

export function blackjackStand(p0: PlayerState): ActionResult {
  const p = structuredClone(p0);
  if (!p.blackjack || p.blackjack.phase !== "play") return { player: p0 };
  finishHand(p);
  return { player: p };
}

export function blackjackClear(p0: PlayerState): ActionResult {
  const p = structuredClone(p0);
  p.blackjack = null;
  return { player: p };
}
