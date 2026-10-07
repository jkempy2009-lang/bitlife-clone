/** Raising children: schooling, activities, family time, discipline, and how they turn out. */
import type { ActionResult, PlayerState, Relative } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { firstName } from "./social";
import { occupationFor } from "@/data/occupations";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const TUTOR_COST = 1_200;
export const ACTIVITY_COST = 600;
export const PRIVATE_SCHOOL_COST = 12_000;

export const INTERESTS = [
  { id: "sport", label: "Sport", emoji: "⚽" },
  { id: "music", label: "Music", emoji: "🎸" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "science", label: "Science club", emoji: "🔬" },
] as const;

export type ChildAction = "tutor" | "activity" | "family" | "school" | "talk";

const kidOf = (p: PlayerState, id: string): Relative | undefined => p.relatives.find((r) => r.id === id && r.alive && r.relation === "Child" && r.age < 18);

export function childAction(p0: PlayerState, kidId: string, action: ChildAction, rng: Rng, interest?: Relative["interest"]): ActionResult {
  const p = clone(p0);
  const kid = kidOf(p, kidId);
  if (!kid) return { player: p0 };
  const n = firstName(kid);
  const key = `kid:${action}:${kid.id}`;
  if (action !== "school" && (p.annual[key] ?? 0) >= 1) return { player: p0, notices: [info("Already Done", `You've already done that with ${n} this year.`)] };

  if (action === "school") {
    if (kid.age < 5) return { player: p0, notices: [info("Too Young", `${n} isn't old enough for school yet.`)] };
    kid.school = kid.school === "private" ? "public" : "private";
    const body = kid.school === "private" ? `You enrolled ${n} in a private school (${money(PRIVATE_SCHOOL_COST)} a year).` : `You moved ${n} to the local public school.`;
    addLog(p, body);
    return { player: p, notices: [info("School Choice", body)] };
  }
  if (action === "tutor") {
    if (kid.age < 5) return { player: p0 };
    if (p.bankBalance < TUTOR_COST) return { player: p0, notices: [info("Insufficient Funds", `A tutor costs ${money(TUTOR_COST)}.`, "bad")] };
    p.annual[key] = 1;
    p.bankBalance -= TUTOR_COST;
    const gain = rng.int(2, 5);
    kid.smarts = clamp(kid.smarts + gain);
    kid.relationshipBar = clamp(kid.relationshipBar + (rng.chance(0.5) ? 2 : -2));
    const body = `A tutor worked with ${n} all year. Smarts +${gain}.`;
    addLog(p, body);
    return { player: p, notices: [info("Extra Lessons", body, "good")] };
  }
  if (action === "activity") {
    if (kid.age < 4) return { player: p0 };
    if (p.bankBalance < ACTIVITY_COST) return { player: p0, notices: [info("Insufficient Funds", `That costs ${money(ACTIVITY_COST)}.`, "bad")] };
    p.annual[key] = 1;
    p.bankBalance -= ACTIVITY_COST;
    kid.interest = interest ?? "sport";
    kid.relationshipBar = clamp(kid.relationshipBar + 5);
    if (kid.interest === "science") kid.smarts = clamp(kid.smarts + 2);
    if (kid.interest === "art") kid.looks = clamp(kid.looks + 1);
    const label = INTERESTS.find((i) => i.id === kid.interest)?.label.toLowerCase() ?? "something";
    const body = `You signed ${n} up for ${label}. They threw themselves into it.`;
    addLog(p, body);
    return { player: p, notices: [info("A New Passion", body, "good")] };
  }
  if (action === "family") {
    p.annual[key] = 1;
    kid.relationshipBar = clamp(kid.relationshipBar + 10);
    changeStat(p, "happiness", 3);
    const body = `A whole weekend with ${n}, no phones. They talked about everything.`;
    addLog(p, body);
    return { player: p, notices: [info("Family Time", body, "good")] };
  }
  // talk: sit down about problems
  p.annual[key] = 1;
  kid.relationshipBar = clamp(kid.relationshipBar + 5);
  if ((kid.trouble ?? 0) > 0) {
    kid.trouble = Math.max(0, (kid.trouble ?? 0) - 1);
    const body = `You sat ${n} down and listened first. Things at school have calmed down.`;
    addLog(p, body);
    return { player: p, notices: [info("A Real Talk", body, "good")] };
  }
  const body = `You and ${n} had a heart-to-heart. They said it meant a lot.`;
  addLog(p, body);
  return { player: p, notices: [info("A Real Talk", body, "good")] };
}

/** Yearly cost of private schooling for all your children. */
export function schoolCosts(p: PlayerState): number {
  return p.relatives.filter((r) => r.relation === "Child" && r.alive && r.age >= 5 && r.age < 18 && r.school === "private").length * PRIVATE_SCHOOL_COST;
}

/** Yearly: children grow, get into trouble when neglected, and launch at 18. */
export function processChildren(p: PlayerState, rng: Rng, notices: Notices) {
  const tier = Math.min(5, Math.max(1, Math.round(1 + (p.bankBalance + p.retirementSavings) / 150_000)));
  for (const kid of p.relatives) {
    if (kid.relation !== "Child" || !kid.alive) continue;
    const n = firstName(kid);
    if (kid.age < 18) {
      kid.smarts = clamp(kid.smarts + rng.int(0, 2) + (kid.school === "private" ? 1 : 0));
      if (kid.age >= 12 && kid.relationshipBar < 40 && rng.chance(0.12 + (kid.trouble ?? 0) * 0.05)) {
        kid.trouble = (kid.trouble ?? 0) + 1;
        const cost = rng.int(300, 2_500);
        p.bankBalance = Math.max(0, p.bankBalance - cost);
        changeStat(p, "happiness", -4);
        const body = `${n} got into trouble this year (a fight, skipping school, and a call from the principal). It cost ${money(cost)} to smooth over. Maybe it's time for a real talk.`;
        addLog(p, body);
        notices.push(info("Teenage Trouble", body, "bad"));
      }
    }
    if (kid.age === 18) {
      const bonus = (kid.school === "private" ? 0.4 : 0) + (kid.interest === "science" ? 0.2 : 0);
      kid.incomeTier = Math.min(5, Math.max(1, Math.round(1 + (kid.smarts - 30) / 20 + bonus + (tier - 3) * 0.3 - (kid.trouble ?? 0) * 0.3)));
      kid.occupation = kid.smarts >= 62 && (kid.trouble ?? 0) < 2 ? `University student (${occupationFor(kid.incomeTier, rng).toLowerCase()} in the making)` : occupationFor(Math.max(1, kid.incomeTier - 1), rng);
      const body = `${n} turned 18 and set out on their own: ${kid.occupation}.`;
      addLog(p, body);
      notices.push(info("All Grown Up", body, "good"));
    }
  }
}
