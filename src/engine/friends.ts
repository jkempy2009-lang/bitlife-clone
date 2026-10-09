/**
 * Friends and family as a support network: favours (job references), loans, confiding, and
 * helping ageing parents. These cost money or goodwill and can go wrong.
 */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { firstName } from "./social";
import { addGrievance, remember } from "./bonds";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export type SupportAction = "favor" | "lend" | "confide" | "help";

/** Consumed by applyForJob: a friend put in a good word. */
export const REFERRAL_FLAG = "referral";

export function supportAction(p0: PlayerState, relId: string, action: SupportAction, rng: Rng, amount = 1_000): ActionResult {
  const p = clone(p0);
  const rel = p.relatives.find((r) => r.id === relId && r.alive);
  if (!rel) return { player: p0 };
  const n = firstName(rel);
  const key = `support:${action}:${rel.id}`;
  if ((p.annual[key] ?? 0) >= 1) return { player: p0, notices: [info("Not Again", `You've already done that with ${n} this year.`)] };

  if (action === "favor") {
    if (rel.relation !== "Friend" && rel.relation !== "Sibling" && rel.relation !== "Parent") return { player: p0 };
    if (rel.relationshipBar < 45) return { player: p0, notices: [info("Not Close Enough", `${n} doesn't know you well enough to stick their neck out (relationship 45+).`)] };
    if (p.age < 16) return { player: p0 };
    p.annual[key] = 1;
    if (rng.chance(clamp(rel.relationshipBar / 120 + (p.skills.charisma - 20) / 500, 0.15, 0.9))) {
      if (!p.flags.includes(REFERRAL_FLAG)) p.flags.push(REFERRAL_FLAG);
      const body = `${n} said they'd put in a good word for you wherever you apply next. That's worth a lot.`;
      addLog(p, body);
      return { player: p, notices: [info("A Good Word", body, "good")] };
    }
    rel.relationshipBar = clamp(rel.relationshipBar - 6);
    const body = `${n} would rather not use up favours right now. It was a bit awkward to ask.`;
    addLog(p, body);
    return { player: p, notices: [info("Not This Time", body, "bad")] };
  }

  if (action === "lend") {
    if (rel.relation === "Pet" || rel.relation === "Child" || rel.relation === "Grandchild") return { player: p0 };
    if (p.bankBalance < amount) return { player: p0, notices: [info("Insufficient Funds", `You don't have ${money(amount)} to spare.`, "bad")] };
    p.annual[key] = 1;
    p.bankBalance -= amount;
    p.flags.push(`lent:${rel.id}:${amount}:${p.year}`);
    rel.relationshipBar = clamp(rel.relationshipBar + 8);
    remember(p, rel, "kindness", `You lent ${n} ${money(amount)} when they needed it.`);
    const body = `You lent ${n} ${money(amount)}. They promised to pay it back as soon as they can.`;
    addLog(p, body);
    return { player: p, notices: [info("A Loan Between Friends", body, "neutral")] };
  }

  if (action === "confide") {
    if (rel.relation === "Pet") return { player: p0 };
    p.annual[key] = 1;
    const warm = rel.relationshipBar >= 40 || rng.chance(0.4);
    if (warm) {
      rel.relationshipBar = clamp(rel.relationshipBar + 6);
      changeStat(p, "happiness", 4);
      if (rel.relationshipBar >= 60) remember(p, rel, "kindness", `You opened up to ${n} when it mattered.`);
      const body = `You told ${n} what's been weighing on you. They listened properly and didn't try to fix everything.`;
      addLog(p, body);
      return { player: p, notices: [info("Opening Up", body, "good")] };
    }
    changeStat(p, "happiness", -1);
    const body = `You tried to talk to ${n}, but they weren't really listening. You felt a little more alone.`;
    addLog(p, body);
    return { player: p, notices: [info("Not Heard", body, "bad")] };
  }

  // help: money or time for parents / siblings in need
  if (rel.relation !== "Parent" && rel.relation !== "Sibling" && rel.relation !== "Grandparent") return { player: p0 };
  if (p.bankBalance < amount) return { player: p0, notices: [info("Insufficient Funds", `You don't have ${money(amount)} to give.`, "bad")] };
  p.annual[key] = 1;
  p.bankBalance -= amount;
  rel.relationshipBar = clamp(rel.relationshipBar + 10);
  rel.health = clamp(rel.health + (rel.age >= 65 ? 4 : 1));
  changeStat(p, "karma", 3);
  changeStat(p, "happiness", 3);
  const body = `You helped ${n} with ${money(amount)} for bills and care. They were quietly grateful.`;
  addLog(p, body);
  return { player: p, notices: [info("Looking After Family", body, "good")] };
}

/** Yearly: friends decide whether to repay what you lent them. */
export function processFriendLoans(p: PlayerState, rng: Rng, notices: Notices) {
  const remaining: string[] = [];
  for (const f of p.flags) {
    if (!f.startsWith("lent:")) {
      remaining.push(f);
      continue;
    }
    const [, id, amtStr, yearStr] = f.split(":");
    const amt = Number(amtStr);
    const year = Number(yearStr);
    const rel = p.relatives.find((r) => r.id === id);
    if (!rel || !rel.alive) {
      continue; // lost to time; nobody left to chase
    }
    if (p.year - year < 1) {
      remaining.push(f);
      continue;
    }
    const honest = rng.chance(clamp(0.35 + rel.relationshipBar / 160, 0.3, 0.9));
    if (honest) {
      p.bankBalance += amt;
      rel.relationshipBar = clamp(rel.relationshipBar + 4);
      const body = `${firstName(rel)} paid back the ${money(amt)} you lent, with a thank-you card.`;
      addLog(p, body);
      notices.push(info("Repaid", body, "good"));
    } else if (p.year - year >= 3) {
      rel.relationshipBar = clamp(rel.relationshipBar - 25);
      addGrievance(p, rel, "debt", 2, `the ${money(amt)} they never paid back`);
      remember(p, rel, "hardship", `${firstName(rel)} never repaid the ${money(amt)} you lent.`);
      const body = `You've given up on ever seeing the ${money(amt)} ${firstName(rel)} borrowed. The friendship has cooled.`;
      addLog(p, body);
      notices.push(info("Never Repaid", body, "bad"));
    } else {
      remaining.push(f);
    }
  }
  p.flags = remaining;
}
