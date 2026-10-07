/** Professional sports. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { addLog, changeStat, clearFlag, clone, hasFlag, setFlag } from "./state";
import { jobEligibility, makeJob } from "./career";

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" | "jackpot" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

// ---------------------------------------------------------------------------
// Professional sports
// ---------------------------------------------------------------------------

export const SPORTS = ["Soccer", "Basketball", "Tennis", "Boxing", "Golf", "Swimming"] as const;

export function trainAthletics(p0: PlayerState, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 8) return { player: p0, notices: [info("Too Young", "Come back when you're a little older.")] };
  if ((p.annual.train ?? 0) >= 1) return { player: p0, notices: [info("Rest Day", "You've already trained hard this year. Your body needs recovery.")] };
  p.annual.train = 1;
  const gain = rng.int(4, 8);
  p.skills.athletics = clamp(p.skills.athletics + gain);
  changeStat(p, "health", 1);
  changeStat(p, "looks", 1);
  const body = `You trained relentlessly. Athletics +${gain}.`;
  addLog(p, body);
  return { player: p, notices: [info("Training Camp", body, "good")] };
}

export function signWithClub(p0: PlayerState, sport: string, rng: Rng): ActionResult {
  const p = clone(p0);
  const line = CAREER_BY_ID.athlete;
  const elig = jobEligibility(p, line);
  if (!elig.ok) return { player: p0, notices: [info("Can't Sign", elig.reason ?? "You aren't eligible.", "bad")] };
  if ((p.annual["apply:athlete"] ?? 0) >= 1) return { player: p0, notices: [info("Already Tried Out", "Scouts only visit once a year.")] };
  p.annual["apply:athlete"] = 1;
  const chance = clamp((p.skills.athletics - 30) / 70 + (p.health - 60) / 400 - (hasFlag(p, "ex_con") ? 0.2 : 0), 0.05, 0.9);
  if (!rng.chance(chance)) {
    changeStat(p, "happiness", -5);
    const body = `Scouts watched you play ${sport.toLowerCase()} but didn't offer a contract. Keep training.`;
    addLog(p, body);
    return { player: p, notices: [info("No Offers", body, "bad")] };
  }
  const job = makeJob(line, 0, rng);
  job.company = `${job.company.split(" ")[0]} ${sport} Club`;
  p.currentJob = job;
  p.annualSalary = job.salary;
  p.athlete.sport = sport;
  setFlag(p, "athlete");
  changeStat(p, "happiness", 12);
  changeStat(p, "fame", 3);
  const body = `You signed with ${job.company} as a ${job.title} for ${money(job.salary)} a year!`;
  addLog(p, body);
  return { player: p, notices: [info("Signed!", body, "good")] };
}

/** Injuries, ageing and retirement for pro athletes. */
export function processAthlete(p: PlayerState, rng: Rng, notices: NonNullable<ActionResult["notices"]>) {
  const job = p.currentJob;
  if (!job || job.lineId !== "athlete") return;
  p.skills.athletics = clamp(p.skills.athletics + (p.age < 28 ? rng.int(0, 2) : -rng.int(0, 3)));
  if (rng.chance(0.12)) {
    const dmg = rng.int(8, 20);
    changeStat(p, "health", -dmg);
    job.performance = clamp(job.performance - 15);
    const career = rng.chance(p.age > 30 ? 0.18 : 0.06);
    if (career) {
      const body = `A devastating injury ended your sports career. You lost ${dmg} Health and your contract.`;
      p.currentJob = null;
      p.annualSalary = 0;
      clearFlag(p, "athlete");
      changeStat(p, "happiness", -15);
      addLog(p, body);
      notices.push(info("Career-Ending Injury", body, "bad"));
      return;
    }
    const body = `You suffered a serious injury (−${dmg} Health, performance dipped).`;
    addLog(p, body);
    notices.push(info("Injured", body, "bad"));
  }
  if (p.age >= 36 && rng.chance(p.age >= 40 ? 1 : 0.45)) {
    const bonus = Math.round(job.salary * 0.5);
    p.bankBalance += bonus;
    const body = `You retired from professional sports with a ${money(bonus)} farewell package and a standing ovation.`;
    p.currentJob = null;
    p.annualSalary = 0;
    clearFlag(p, "athlete");
    addLog(p, body);
    notices.push(info("Retired a Legend", body, "good"));
  }
}

