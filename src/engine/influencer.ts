/** Online fame. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";

import { addLog, clone, setFlag } from "./state";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Influencer
// ---------------------------------------------------------------------------

export function startChannel(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 10) return { player: p0, notices: [info("Too Young", "Ask your parents again in a few years.")] };
  if (p.influencer.active) return { player: p0 };
  p.influencer = { active: true, followers: rng.int(50, 500), lastPostYear: p.year };
  setFlag(p, "influencer");
  const body = `You launched your channel and posted your first video. ${p.influencer.followers} people followed.`;
  addLog(p, body);
  return { player: p, notices: [info("Channel Launched", body, "good")] };
}

export function postContent(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active) return { player: p0 };
  if ((p.annual.post ?? 0) >= 1) return { player: p0, notices: [info("Algorithm Fatigue", "You've posted your big content for the year.")] };
  p.annual.post = 1;
  inf.lastPostYear = p.year;
  const viral = rng.chance(0.08 + p.skills.charisma / 1000);
  const growth = 0.08 + rng.float(0, 0.35) + p.looks / 500 + p.skills.charisma / 500 + (viral ? 1.5 : 0);
  const gained = Math.max(30, Math.round(inf.followers * growth + rng.int(50, 800)));
  inf.followers += gained;
  p.skills.charisma = clamp(p.skills.charisma + 1);
  const body = viral
    ? `One of your videos went VIRAL! You gained ${gained.toLocaleString()} followers (${inf.followers.toLocaleString()} total).`
    : `Your content found an audience: +${gained.toLocaleString()} followers (${inf.followers.toLocaleString()} total).`;
  addLog(p, body);
  return { player: p, notices: [info(viral ? "VIRAL!" : "New Content", body, viral ? "jackpot" : "good")] };
}

export function brandCollab(p0: PlayerState): ActionResult {
  const p = clone(p0);
  const inf = p.influencer;
  if (!inf.active || inf.followers < 5_000) return { player: p0, notices: [info("Not Yet", "Brands start calling at 5,000 followers.")] };
  if ((p.annual.collab ?? 0) >= 1) return { player: p0, notices: [info("Booked Solid", "You've already done a collab this year.")] };
  p.annual.collab = 1;
  const pay = Math.round(inf.followers * 0.25);
  p.bankBalance += pay;
  const body = `A brand paid you ${money(pay)} for a sponsored post.`;
  addLog(p, body);
  return { player: p, notices: [info("Sponsored Post", body, "good")] };
}

/** Returns yearly platform income (taxable). */
export function processInfluencer(p: PlayerState): number {
  const inf = p.influencer;
  if (!inf.active) return 0;
  if (inf.lastPostYear < p.year - 1) inf.followers = Math.round(inf.followers * 0.85);
  const famous = Math.round(Math.log10(Math.max(1, inf.followers)) * 10 - 10);
  if (famous > p.fame) p.fame = Math.min(100, famous);
  return inf.followers >= 5_000 ? Math.round(inf.followers * 0.35) : 0;
}
