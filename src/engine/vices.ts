/** Habits and addictions: smoking, drinking, drugs and gambling. */
import type { ActionResult, PlayerState, Vices } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { killPlayer } from "./mortality";
import { addDisease } from "./events";
import { startTrial } from "./crime";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const VICE_INFO: Record<keyof Vices, { label: string; emoji: string }> = {
  smoking: { label: "Smoking", emoji: "🚬" },
  alcohol: { label: "Drinking", emoji: "🍺" },
  drugs: { label: "Drugs", emoji: "💊" },
  gambling: { label: "Gambling", emoji: "🎲" },
};

export const REHAB_COST = 5_000;

export function addVice(p: PlayerState, key: keyof Vices, delta: number) {
  p.vices[key] = clamp(Math.round(p.vices[key] + (delta > 0 ? delta * (1 + (p.talents.addictive - 50) / 100) : delta)));
}

export const hasAnyVice = (p: PlayerState) => Object.values(p.vices).some((v) => v > 0);

/** Yearly consequences of habits. */
export function processVices(p: PlayerState, rng: Rng, notices: Notices) {
  const v = p.vices;
  if (Object.values(v).some((x) => x >= 40) && !p.flags.includes("was_addict")) p.flags.push("was_addict");
  // Habits are sticky once established.
  for (const k of Object.keys(v) as (keyof Vices)[]) if (v[k] >= 15 && !(p.talents.discipline >= 65 && rng.chance((p.talents.discipline - 50) / 100))) v[k] = clamp(v[k] + rng.int(0, 2));

  // Habits cost money, and the heavy ones cost you at work.
  if (p.age >= 16) {
    const habitBill = Math.round(v.smoking * 40 + v.alcohol * 30 + v.drugs * 120);
    if (habitBill > 0) p.bankBalance -= Math.min(Math.max(0, p.bankBalance), habitBill);
    if (p.currentJob && (v.alcohol >= 40 || v.drugs >= 30)) {
      p.currentJob.performance = clamp(p.currentJob.performance - rng.int(2, 6));
      if (rng.chance(0.2)) {
        const body = "Your boss pulled you aside about your attendance and your focus. Your habits are showing at work.";
        addLog(p, body);
        notices.push(info("Warning at Work", body, "bad"));
      }
    }
    if (v.drugs >= 40) for (const r of p.relatives) if (r.alive && (r.relation === "Parent" || r.relation === "Child")) r.relationshipBar = clamp(r.relationshipBar - 2);
  }
  if (v.smoking >= 10) {
    changeStat(p, "health", -Math.floor(v.smoking / 25));
    if (v.smoking >= 40) changeStat(p, "looks", -1);
    if (v.smoking >= 40 && rng.chance((v.smoking / 100) * 0.04)) {
      const id = rng.chance(0.7) ? "copd" : "cancer";
      if (addDisease(p, id, rng)) notices.push(info("Smoker's Reward", "Years of smoking caught up with you. The doctor's expression says it all.", "bad"));
    }
  }
  if (v.alcohol >= 20) {
    changeStat(p, "health", -Math.floor(v.alcohol / 30));
    for (const r of p.relatives) if (r.alive && r.relation === "Partner" && r.partnerStatus !== "ex") r.relationshipBar = clamp(r.relationshipBar - 2);
    if (v.alcohol >= 55 && rng.chance(0.03) && addDisease(p, "liver_disease", rng)) {
      notices.push(info("Liver Failure", "Your liver has had enough. You were diagnosed with liver disease.", "bad"));
    }
  }
  if (v.drugs >= 20) {
    changeStat(p, "health", -Math.floor(v.drugs / 20));
    if (v.drugs >= 40) changeStat(p, "happiness", -3);
    if (!p.pendingTrial && !p.isInPrison && rng.chance((v.drugs / 100) * 0.06)) {
      addLog(p, "Police found drugs on you.");
      startTrial(p, { name: "Drug Possession", description: "Officers searched you and found illegal substances.", years: v.drugs >= 60 ? 3 : 1, severity: "minor" });
    }
    if (v.drugs >= 70 && rng.chance(0.02)) killPlayer(p, "a drug overdose");
  }
  if (v.gambling >= 30 && p.bankBalance > 0) {
    const lost = Math.max(200, Math.round(p.bankBalance * 0.02 * (v.gambling / 50)));
    const actual = Math.min(lost, p.bankBalance);
    p.bankBalance -= actual;
    for (const r of p.relatives) if (r.alive && r.relation === "Partner" && r.partnerStatus !== "ex") r.relationshipBar = clamp(r.relationshipBar - 3);
    addLog(p, `You lost ${money(actual)} chasing bets you couldn't resist.`);
    if (actual >= 5_000) notices.push(info("Gambling Losses", `Your gambling habit cost you ${money(actual)} this year.`, "bad"));
  }
}

export function quitVice(p0: PlayerState, key: keyof Vices, rng: Rng): ActionResult {
  const p = clone(p0);
  const level = p.vices[key];
  const label = VICE_INFO[key].label.toLowerCase();
  if (level <= 0) return { player: p0 };
  if ((p.annual[`quit:${key}`] ?? 0) >= 1) return { player: p0, notices: [info("Not Yet", "You've already tried this year. Willpower needs time to recharge.")] };
  p.annual[`quit:${key}`] = 1;
  if (rng.chance(clamp(0.65 - level / 140 + (p.talents.discipline - 50) / 200, 0.1, 0.92))) {
    p.vices[key] = Math.round(level * 0.2);
    changeStat(p, "happiness", 4);
    const body = `You white-knuckled your way through it. Your ${label} habit is mostly behind you.`;
    addLog(p, body);
    return { player: p, notices: [info("Clean!", body, "good")] };
  }
  addVice(p, key, 4);
  changeStat(p, "happiness", -3);
  const body = `You tried to quit ${label} and relapsed within weeks.`;
  addLog(p, body);
  return { player: p, notices: [info("Relapse", body, "bad")] };
}

export function rehab(p0: PlayerState): ActionResult {
  const p = clone(p0);
  if (!hasAnyVice(p)) return { player: p0, notices: [info("Nothing to Treat", "You have no habits to treat.")] };
  if (p.bankBalance < REHAB_COST) return { player: p0, notices: [info("Insufficient Funds", `Rehab costs ${money(REHAB_COST)}.`, "bad")] };
  if ((p.annual.rehab ?? 0) >= 1) return { player: p0, notices: [info("In Recovery", "You've already done a stint in rehab this year.")] };
  p.annual.rehab = 1;
  p.bankBalance -= REHAB_COST;
  for (const k of Object.keys(p.vices) as (keyof Vices)[]) p.vices[k] = Math.round(p.vices[k] * 0.4);
  changeStat(p, "health", 3);
  changeStat(p, "happiness", 3);
  const body = "A month in rehab cut your habits dramatically. Counsellors say the real work starts now.";
  addLog(p, body);
  return { player: p, notices: [info("Rehab Complete", body, "good")] };
}
