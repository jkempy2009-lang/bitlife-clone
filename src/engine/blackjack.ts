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
