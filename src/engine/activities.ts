import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CURE_CHANCE } from "@/data/diseases";
import { addLog, changeStat, clone } from "./state";
import { killPlayer } from "./mortality";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" | "surgery" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Medical Center
// ---------------------------------------------------------------------------

export const DOCTOR_COST = 200;
export const WITCH_COST = 50;

export function visitDoctor(p0: PlayerState, diseaseId: string | null, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.bankBalance < DOCTOR_COST) return { player: p0, notices: [info("Can't Afford It", `A doctor's visit costs ${money(DOCTOR_COST)}.`, "bad")] };
  const target = diseaseId ? p.diseases.find((d) => d.id === diseaseId) : p.diseases[0];
  const key = `doctor:${target?.id ?? "checkup"}`;
  if ((p.annual[key] ?? 0) >= 1) {
    return { player: p0, notices: [info("Second Opinion Denied", "The doctor has already done all they can for this condition this year.")] };
  }
  p.annual[key] = 1;
  p.bankBalance -= DOCTOR_COST;
  if (!target) {
    changeStat(p, "health", 1);
    const body = "The doctor gave you a clean bill of health. You paid $200 for peace of mind.";
    addLog(p, body);
    return { player: p, notices: [info("Checkup", body, "good")] };
  }
  const chance = CURE_CHANCE[target.severity];
  if (rng.chance(chance)) {
    p.diseases = p.diseases.filter((d) => d.id !== target.id);
    const body = `The doctor successfully treated your ${target.name}. You're cured!`;
    addLog(p, body);
    return { player: p, notices: [info("Cured!", body, "good")] };
  }
  const body = "The doctor couldn't find a cure.";
  addLog(p, `You visited the doctor about your ${target.name}, but the doctor couldn't find a cure.`);
  return { player: p, notices: [info("No Cure Found", body, "bad")] };
}

export function visitWitchDoctor(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.bankBalance < WITCH_COST) return { player: p0, notices: [info("Can't Afford It", `The witch doctor demands ${money(WITCH_COST)}.`, "bad")] };
  if ((p.annual.witch ?? 0) >= 1) return { player: p0, notices: [info("Spirits Exhausted", "The spirits need a year to recover.")] };
  p.annual.witch = 1;
  p.bankBalance -= WITCH_COST;
  if (rng.chance(0.5)) {
    p.diseases = [];
    changeStat(p, "health", 5);
    const body = "The witch doctor chanted over a bubbling cauldron. Every disease vanished. Incredible!";
    addLog(p, body);
    return { player: p, notices: [info("Miracle Cure", body, "good")] };
  }
  p.happiness = 10;
  p.health = 10;
  p.smarts = 10;
  p.looks = 10;
  const body = "The witch doctor cackled and spat out a hex. Your happiness, health, smarts, and looks all crashed to 10.";
  addLog(p, body);
  return { player: p, notices: [info("CURSED!", body, "bad")] };
}

// ---------------------------------------------------------------------------
// Wellness Complex
// ---------------------------------------------------------------------------

export type WellnessId = "gym" | "meditate" | "walk" | "library";

export const WELLNESS: Record<WellnessId, { label: string; emoji: string; blurb: string; effects: string }> = {
  gym: { label: "Gym", emoji: "🏋️", blurb: "Pump some iron.", effects: "+3 Health, +2 Looks" },
  meditate: { label: "Meditate", emoji: "🧘", blurb: "Find your centre.", effects: "+5 Happiness" },
  walk: { label: "Take a Walk", emoji: "🚶", blurb: "Fresh air and sunshine.", effects: "+2 Health, +1 Happiness" },
  library: { label: "Library", emoji: "📚", blurb: "Hit the books.", effects: "+4 Smarts" },
};

export function doWellness(p0: PlayerState, id: WellnessId): ActionResult {
  const p = clone(p0);
  if ((p.annual[`wellness:${id}`] ?? 0) >= 1) {
    return { player: p0, notices: [info("Done for the Year", `You've already used the ${WELLNESS[id].label.toLowerCase()} this year.`)] };
  }
  p.annual[`wellness:${id}`] = 1;
  let body = "";
  if (id === "gym") {
    changeStat(p, "health", 3);
    changeStat(p, "looks", 2);
    p.skills.athletics = clamp(p.skills.athletics + 1);
    body = "You sweated it out at the gym. +3 Health, +2 Looks.";
  } else if (id === "meditate") {
    changeStat(p, "happiness", 5);
    body = "You meditated and felt at peace. +5 Happiness.";
  } else if (id === "walk") {
    changeStat(p, "health", 2);
    changeStat(p, "happiness", 1);
    body = "You went for a long walk. +2 Health, +1 Happiness.";
  } else {
    changeStat(p, "smarts", 4);
    body = "You spent hours in the library. +4 Smarts.";
  }
  addLog(p, body);
  return { player: p, notices: [info(WELLNESS[id].label, body, "good")] };
}

// ---------------------------------------------------------------------------
// Leisure & social extras
// ---------------------------------------------------------------------------

export type LeisureId = "vacation" | "party" | "therapy" | "volunteer" | "sidehustle";

export const LEISURE: Record<LeisureId, { label: string; emoji: string; blurb: string; cost: number }> = {
  vacation: { label: "Take a Vacation", emoji: "🏖️", blurb: "Unwind somewhere sunny.", cost: 3000 },
  party: { label: "Throw a Party", emoji: "🎉", blurb: "Good times, questionable decisions.", cost: 400 },
  therapy: { label: "See a Therapist", emoji: "🛋️", blurb: "Talk it out.", cost: 150 },
  volunteer: { label: "Volunteer", emoji: "🤝", blurb: "Do some good.", cost: 0 },
  sidehustle: { label: "Side Hustle", emoji: "💼", blurb: "Gig work for quick cash.", cost: 0 },
};

export function doLeisure(p0: PlayerState, id: LeisureId, rng: Rng): ActionResult {
  const p = clone(p0);
  const def = LEISURE[id];
  if (p.age < 12 && id !== "volunteer") return { player: p0, notices: [info("Too Young", "Ask again when you're older.")] };
  if (p.bankBalance < def.cost) return { player: p0, notices: [info("Can't Afford It", `${def.label} costs ${money(def.cost)}.`, "bad")] };
  if ((p.annual[`leisure:${id}`] ?? 0) >= 1) return { player: p0, notices: [info("Not Again", "You've already done that this year.")] };
  p.annual[`leisure:${id}`] = 1;
  p.bankBalance -= def.cost;
  let body = "";
  let tone: "good" | "bad" = "good";
  if (id === "vacation") {
    changeStat(p, "happiness", rng.int(8, 14));
    changeStat(p, "health", 2);
    body = "You had a fantastic vacation and came home refreshed.";
  } else if (id === "party") {
    changeStat(p, "happiness", rng.int(5, 10));
    for (const r of p.relatives) if (r.alive && r.relation === "Friend") r.relationshipBar = clamp(r.relationshipBar + 8);
    if (rng.chance(0.15)) {
      changeStat(p, "health", -3);
      body = "The party was legendary. So was the hangover.";
    } else {
      body = "The party was a smash hit. Friends are talking about it for weeks.";
    }
  } else if (id === "therapy") {
    changeStat(p, "happiness", rng.int(4, 9));
    body = "You talked through your feelings. You feel lighter.";
  } else if (id === "volunteer") {
    changeStat(p, "karma", rng.int(4, 9));
    changeStat(p, "happiness", 3);
    body = "You volunteered at a local shelter. It felt great.";
  } else {
    const earned = rng.int(300, 3500);
    p.bankBalance += earned;
    changeStat(p, "happiness", -1);
    body = `You drove for a ride-sharing app and did odd jobs. You earned ${money(earned)}.`;
    tone = "good";
  }
  addLog(p, body);
  return { player: p, notices: [info(def.label, body, tone)] };
}

// ---------------------------------------------------------------------------
// Gambling Den
// ---------------------------------------------------------------------------

export const LOTTERY_COST = 10;
export const LOTTERY_JACKPOT = 50_000_000;
export const LOTTERY_ANNUAL_CAP = 5;

export function buyLotteryTicket(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You must be 18 to buy lottery tickets.")] };
  if (p.bankBalance < LOTTERY_COST) return { player: p0, notices: [info("Can't Afford It", "A ticket costs $10.", "bad")] };
  const bought = p.annual.lottery ?? 0;
  if (bought >= LOTTERY_ANNUAL_CAP) return { player: p0, notices: [info("Sold Out", `The shop limits you to ${LOTTERY_ANNUAL_CAP} tickets a year.`)] };
  p.annual.lottery = bought + 1;
  p.bankBalance -= LOTTERY_COST;
  if (rng.next() < 0.00001) {
    p.bankBalance += LOTTERY_JACKPOT;
    changeStat(p, "happiness", 40);
    changeStat(p, "fame", 15);
    const body = `JACKPOT! Your ticket won ${money(LOTTERY_JACKPOT)}!`;
    addLog(p, body);
    return { player: p, banner: `🎰 JACKPOT! You won ${money(LOTTERY_JACKPOT)} in the lottery!`, notices: [info("JACKPOT!!!", body, "jackpot")] };
  }
  // Small consolation prizes keep the ticket exciting without breaking the economy.
  const r = rng.next();
  if (r < 0.04) {
    p.bankBalance += 50;
    addLog(p, "Your lottery ticket won $50.");
    return { player: p, notices: [info("Small Win", "Your scratch ticket won $50!", "good")] };
  }
  addLog(p, "You bought a lottery ticket. It didn't win.");
  return { player: p, notices: [info("No Luck", "Not a winner. Better luck next time.", "neutral")] };
}

/** Called when a blackjack hand ends. `delta` is net change vs. stake already deducted: +2*wager, +wager (push), 0. */
export function settleBlackjack(p0: PlayerState, payout: number, summary: string): ActionResult {
  const p = clone(p0);
  p.bankBalance += payout;
  addLog(p, summary);
  return { player: p };
}

export function placeWager(p0: PlayerState, wager: number): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You must be 18 to gamble.")] };
  if (wager <= 0 || wager > p.bankBalance) return { player: p0 };
  p.bankBalance -= wager;
  return { player: p };
}

// ---------------------------------------------------------------------------
// Plastic Surgery Clinic
// ---------------------------------------------------------------------------

export const SURGERIES = [
  { id: "botox", name: "Botox", cost: 1_500, emoji: "💉" },
  { id: "rhinoplasty", name: "Rhinoplasty", cost: 5_000, emoji: "👃" },
  { id: "hair", name: "Hair Transplant", cost: 4_000, emoji: "💇" },
  { id: "lipo", name: "Liposuction", cost: 6_000, emoji: "🧈" },
  { id: "facelift", name: "Facelift", cost: 8_000, emoji: "✨" },
  { id: "makeover", name: "Full Makeover", cost: 20_000, emoji: "👑" },
] as const;

export function botchChance(cost: number): number {
  return clamp(0.15 + (5000 - cost) / 50_000, 0.06, 0.25);
}

export function plasticSurgery(p0: PlayerState, id: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const s = SURGERIES.find((x) => x.id === id);
  if (!s) return { player: p0 };
  if (p.age < 16) return { player: p0, notices: [info("Too Young", "Surgeons won't operate on minors.")] };
  if (p.bankBalance < s.cost) return { player: p0, notices: [info("Can't Afford It", `${s.name} costs ${money(s.cost)}.`, "bad")] };
  if ((p.annual.surgery ?? 0) >= 1) return { player: p0, notices: [info("Healing Time", "Your body needs a year between procedures.")] };
  p.annual.surgery = 1;
  p.bankBalance -= s.cost;
  if (rng.chance(botchChance(s.cost))) {
    p.looks = Math.max(0, p.looks - 30);
    changeStat(p, "health", -20);
    changeStat(p, "happiness", -12);
    const body = `The ${s.name.toLowerCase()} was BOTCHED. Looks −30, Health −20.`;
    addLog(p, body);
    if (p.health <= 0) killPlayer(p, "a botched surgery");
    return { player: p, notices: [info("Surgery Botched!", body, "surgery")] };
  }
  changeStat(p, "looks", 15);
  changeStat(p, "happiness", 4);
  const body = `The ${s.name.toLowerCase()} was a success! You look fantastic. +15 Looks.`;
  addLog(p, body);
  return { player: p, notices: [info("Surgery Success", body, "surgery")] };
}
