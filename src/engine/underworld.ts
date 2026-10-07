/** The Underworld: join a crime family, climb the ranks, try not to get arrested (or whacked). */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clone, hasFlag, isRoyal, setFlag } from "./state";
import { jobEligibility, makeJob } from "./career";
import { killPlayer } from "./mortality";
import { startTrial } from "./crime";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const inMob = (p: PlayerState) => p.currentJob?.lineId === "mafia";

export function joinMob(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  const mob = CAREER_BY_ID.mafia;
  const elig = jobEligibility(p, mob);
  if (!elig.ok) return { player: p0, notices: [info("No Introduction", elig.reason ?? "They won't talk to you.", "bad")] };
  if (isRoyal(p)) return { player: p0 };
  if ((p.annual["apply:mafia"] ?? 0) >= 1) return { player: p0, notices: [info("Lie Low", "You've already asked around this year. Don't look desperate.")] };
  p.annual["apply:mafia"] = 1;
  const chance = clamp(0.3 + (50 - p.karma) / 150 + p.stats.crimesCommitted * 0.03 + (hasFlag(p, "ex_con") ? 0.15 : 0), 0.1, 0.85);
  if (!rng.chance(chance)) {
    changeStat(p, "happiness", -3);
    const body = "You asked around in all the wrong bars. Nobody would vouch for you.";
    addLog(p, body);
    return { player: p, notices: [info("Turned Away", body, "bad")] };
  }
  p.currentJob = makeJob(mob, 0, rng);
  p.annualSalary = p.currentJob.salary;
  setFlag(p, "made_man");
  changeStat(p, "karma", -6);
  const body = `${p.currentJob.company} took you in as an Associate. The pay is off the books and the favours are never free.`;
  addLog(p, body);
  return { player: p, notices: [info("Welcome to the Family", body, "good")] };
}

export function leaveMob(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (!inMob(p)) return { player: p0 };
  p.currentJob = null;
  p.annualSalary = 0;
  if (rng.chance(0.3)) {
    changeStat(p, "health", -rng.int(10, 25));
    const body = "You walked away from the family. They sent a message. It hurt.";
    addLog(p, body);
    return { player: p, notices: [info("Parting Gift", body, "bad")] };
  }
  const body = "You left the family quietly. For now, they're letting you go.";
  addLog(p, body);
  return { player: p, notices: [info("Out", body, "neutral")] };
}

/** Yearly: arrests, hits and moral decay. */
export function processMob(p: PlayerState, rng: Rng, notices: Notices) {
  const job = p.currentJob;
  if (!job || job.lineId !== "mafia" || p.isInPrison) return;
  changeStat(p, "karma", -2);
  if (!p.pendingTrial && rng.chance(0.06 + job.tier * 0.03)) {
    p.currentJob = null;
    p.annualSalary = 0;
    startTrial(p, {
      name: "Racketeering",
      description: "Federal investigators built a case against the organisation, and your name was on every page.",
      years: 4 + job.tier * 2,
      severity: job.tier >= 2 ? "heinous" : "serious",
    });
    notices.push(info("Raided!", "Agents kicked down the door. You're being charged with racketeering.", "bad"));
    return;
  }
  if (rng.chance(0.04)) {
    const dmg = rng.int(15, 35);
    changeStat(p, "health", -dmg);
    const body = `A rival crew ambushed you. You survived, barely. Health −${dmg}.`;
    addLog(p, body);
    notices.push(info("Gang War", body, "bad"));
    if (job.tier >= 2 && rng.chance(0.2)) killPlayer(p, "a gang hit");
  }
}

