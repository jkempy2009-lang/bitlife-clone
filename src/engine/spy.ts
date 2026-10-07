/** The Agency: classified missions with three approaches. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { addLog, changeStat, clone } from "./state";
import { startTrial } from "./crime";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const APPROACHES = [
  { id: "stealth", name: "Stealth Infiltration", blurb: "Lockpicks, shadows, and quiet footsteps.", stat: "Smarts" },
  { id: "social", name: "Social Engineering", blurb: "Charm your way past guards and into vaults.", stat: "Charisma & Looks" },
  { id: "force", name: "Direct Assault", blurb: "Subtlety is overrated.", stat: "Athletics & Health" },
] as const;

export const inAgency = (p: PlayerState) => p.currentJob?.lineId === "spy";

export function missionChance(p: PlayerState, approach: string): number {
  const job = p.currentJob;
  const tier = job?.tier ?? 0;
  const stat =
    approach === "stealth" ? p.smarts
    : approach === "social" ? (p.skills.charisma + p.looks) / 2
    : (p.skills.athletics + p.health) / 2;
  return clamp(0.25 + stat / 160 + tier * 0.05, 0.1, 0.85);
}

export function runMission(p0: PlayerState, approach: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const job = p.currentJob;
  if (!job || job.lineId !== "spy") return { player: p0 };
  if ((p.annual.mission ?? 0) >= 1) return { player: p0, notices: [info("Debrief First", "Command only authorises one mission a year.")] };
  p.annual.mission = 1;
  if (rng.chance(missionChance(p, approach))) {
    const bonus = 20_000 * (job.tier + 1);
    p.bankBalance += bonus;
    job.performance = clamp(job.performance + 10);
    changeStat(p, "happiness", 6);
    changeStat(p, "fame", 1);
    const body = `Mission accomplished. A grateful government wired you a ${money(bonus)} bonus. (You can't say what you did.)`;
    addLog(p, body);
    return { player: p, notices: [info("Mission Success", body, "good")] };
  }
  job.performance = clamp(job.performance - 10);
  const roll = rng.next();
  if (roll < 0.65) {
    const dmg = rng.int(10, 30);
    changeStat(p, "health", -dmg);
    const body = `The mission went sideways. You escaped with injuries (Health −${dmg}).`;
    addLog(p, body);
    return { player: p, notices: [info("Mission Failed", body, "bad")] };
  }
  if (roll < 0.9) {
    p.currentJob = null;
    p.annualSalary = 0;
    changeStat(p, "happiness", -10);
    const body = "Your cover was blown. The Agency disavowed you and cleared your desk.";
    addLog(p, body);
    return { player: p, notices: [info("Disavowed", body, "bad")] };
  }
  p.currentJob = null;
  p.annualSalary = 0;
  startTrial(p, { name: "Espionage", description: "A foreign government captured you and put you on trial for spying.", years: 12, severity: "heinous" });
  return { player: p, notices: [info("Captured!", "Foreign agents caught you in the act. You're being tried for espionage.", "bad")] };
}
