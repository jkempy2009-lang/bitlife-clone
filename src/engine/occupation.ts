/**
 * What a person can realistically do at the same time.
 *
 * Life has a limited number of hours: a full-time job, running a business, a record contract,
 * elected office and full-time study are all commitments that exclude each other. Side activities
 * (hobbies, an online channel) are not. Every system that starts a commitment asks `blockerFor`.
 */
import type { Effort, PlayerState } from "@/types/game.types";
import type { CareerLine } from "@/data/careersRegistry";
import type { Rng } from "@/lib/rng";
import { addLog, changeStat, getPartner, isRoyal, livingRelatives } from "./state";
import { isAmateurAthlete, isContractedAthlete } from "./athleteState";

export type Commitment = "job" | "business" | "music" | "office" | "study" | "athlete" | "creator";

export const isStudying = (p: PlayerState) => p.education.stage !== "None";
/** Evening courses (certificates) fit around a full-time job; degrees don't. */
export const isStudyingFullTime = (p: PlayerState) => p.education.stage !== "None" && p.education.stage !== "Certificate";

/** Entry-level, no-qualification lines a student can work around classes. */
export function partTimeFriendly(line: CareerLine): boolean {
  return !line.pack && !line.requirements.degrees?.length && line.requirements.minSmarts <= 25 && line.ladder[0].salary <= 30_000;
}

export const PART_TIME_FACTOR = 0.45;

/** Bankruptcy bars founding a new company for a few years (see `bankruptcyOf` in business.ts). */
export function bankruptcyCooloff(p: PlayerState): string | null {
  for (const f of p.flags) {
    if (!f.startsWith("biz_cooloff:")) continue;
    const until = Number(f.slice("biz_cooloff:".length));
    if (p.year < until) return `Your bankruptcy bars you from founding a company until ${until}.`;
  }
  return null;
}

/** Reason a new commitment can't start right now, or null. */
export function blockerFor(p: PlayerState, want: Commitment): string | null {
  const job = p.currentJob;
  const fullTimeJob = job && !job.partTime;
  // A passive stake (stepped back to chair, or pushed out by the board) is owned but not worked: it does not take your days.
  const biz = p.business && !p.business.passive ? p.business : null;
  if (isRoyal(p) && want !== "office") return "Royal duties leave no room for that.";
  if (p.isInPrison) return "You're in prison.";
  const creatorFT = p.influencer.fullTime ? "You're a full-time creator. Step back to part-time creating first." : null;
  switch (want) {
    case "creator":
      if (fullTimeJob) return `You can't go full-time as a creator while working as a ${job.title}. Quit first.`;
      if (biz) return `You can't go full-time as a creator while running ${biz.name}.`;
      if (p.music.signed) return "Your record contract is a full-time commitment. Leave the label first.";
      if (isStudying(p) && p.education.stage !== "Primary" && p.education.stage !== "HighSchool") return "You can't go full-time as a creator while studying full time.";
      return null;
    case "business":
      if (creatorFT) return creatorFT;
      if (job) return `You can't run a business while working as a ${job.title}. Quit first.`;
      if (bankruptcyCooloff(p)) return bankruptcyCooloff(p);
      if (p.music.signed) return "Your record contract is a full-time commitment. Leave the label first.";
      if (isStudyingFullTime(p) && p.education.stage !== "Primary" && p.education.stage !== "HighSchool") return "You can't start a company while studying full time. Finish or drop out first.";
      return null;
    case "athlete":
      if (creatorFT) return creatorFT;
      if (job && job.lineId !== "athlete") return `You can't play professionally while working as a ${job.title}. Quit first.`;
      if (biz) return `You can't play professionally while running ${biz.name}. Sell or close it first.`;
      if (p.music.signed) return "Your record contract is a full-time commitment. Leave the label first.";
      return null;
    case "job":
      if (creatorFT) return creatorFT;
      if (p.athlete && isContractedAthlete(p)) return "Your sports contract is a full-time commitment. Retire or leave it first.";
      if (biz) return `You can't hold a job while running ${biz.name}. Sell or close it first.`;
      if (p.music.signed) return "Your record contract is a full-time commitment. Leave the label first.";
      return null;
    case "music":
      if (creatorFT) return "You can't sign a record deal while running a full-time channel. Step back to part-time creating first.";
      if (fullTimeJob) return `You can't tour while working as a ${job.title}. Quit first.`;
      if (biz) return `You can't sign a record deal while running ${biz.name}.`;
      if (isStudyingFullTime(p) && p.education.stage !== "Primary" && p.education.stage !== "HighSchool") return "You can't sign a record deal while studying full time.";
      return null;
    case "office":
      if (creatorFT) return creatorFT;
      if (biz) return `You can't hold public office while running ${biz.name}. Sell or close it first.`;
      if (p.music.signed) return "Your record contract is a full-time commitment. Leave the label first.";
      return null;
    case "study":
      if (creatorFT) return creatorFT;
      if (fullTimeJob) return `You can't study full time while working as a ${job.title}. Quit or go part-time first.`;
      if (biz) return `You can't study full time while running ${biz.name}.`;
      if (p.music.signed) return "Your record contract is a full-time commitment. Leave the label first.";
      return null;
  }
}

export const EFFORT_INFO: Record<Effort, { label: string; emoji: string; blurb: string }> = {
  coast: { label: "Coast", emoji: "🛋️", blurb: "Do the minimum. More time and energy for life, but performance, skills and grades slip." },
  steady: { label: "Steady", emoji: "⚖️", blurb: "A sustainable pace. Slow, reliable progress." },
  grind: { label: "Grind", emoji: "🔥", blurb: "All in. Fast progress, but it costs health, happiness and the people close to you. Burnout is real." },
};

/** Does the player currently have anything that effort applies to? */
export function hasCommitment(p: PlayerState): boolean {
  // A business with a general manager runs without you, so your effort setting doesn't drive it (or cost you).
  return !!p.currentJob || (!!p.business && !p.business.manager && !p.business.passive) || isStudying(p) || p.music.signed || p.influencer.fullTime || isAmateurAthlete(p);
}

/** Performance drift for jobs, per effort level (before smarts adjustment). */
export function effortPerformanceDelta(effort: Effort, rng: Rng): number {
  if (effort === "grind") return rng.int(3, 10);
  if (effort === "coast") return rng.int(-12, -2);
  return rng.int(-4, 4);
}

/** Yearly study effort credit. */
export const EFFORT_STUDY: Record<Effort, number> = { coast: 0, steady: 1, grind: 3 };

/**
 * The human cost (or dividend) of the chosen effort. Called once per Age Up while committed to something.
 */
export function applyEffortCosts(p: PlayerState, rng: Rng, notices: NonNullable<import("@/types/game.types").ActionResult["notices"]>) {
  if (!hasCommitment(p) || p.age < 14) return;
  const partner = getPartner(p);
  const family = [...(partner ? [partner] : []), ...livingRelatives(p, "Child").filter((c) => c.age < 18)];
  if (p.effort === "grind") {
    changeStat(p, "health", -Math.max(0, (p.age > 45 ? 3 : 2) - Math.round((p.talents.stamina - 50) / 30)));
    changeStat(p, "happiness", -2);
    for (const r of family) r.relationshipBar = Math.max(0, r.relationshipBar - 3);
    if (rng.chance((p.age > 45 ? 0.14 : 0.09) * (1.4 - p.talents.discipline / 125))) {
      p.effort = "steady";
      changeStat(p, "happiness", -10);
      changeStat(p, "health", -6);
      const body = "You pushed too hard for too long and burned out. A doctor ordered you to ease off, so your effort has been reset to Steady.";
      addLog(p, body);
      notices.push({ kind: "info", title: "Burnout", body, tone: "bad" });
    }
  } else if (p.effort === "coast") {
    changeStat(p, "happiness", 1);
    for (const r of family) r.relationshipBar = Math.min(100, r.relationshipBar + 1);
  }
}
