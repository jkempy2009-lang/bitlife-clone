/** The yearly pass over everyone you're close to: partner, in-laws, friends. See bonds.ts for the model. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { addLog, changeStat } from "./state";
import { endRelationship } from "./social";
import { processPartnership } from "./partnership";
import { processInLaws } from "./inlaws";
import { processCircle } from "./circle";
import { remember } from "./bonds";

type Notices = NonNullable<ActionResult["notices"]>;

/**
 * Romance is only ever between two adults or two teenagers of the same age. If a gap opens up (a
 * birthday, or an older save), the relationship ends rather than continuing across it.
 */
function closeAgeGaps(p: PlayerState, notices: Notices) {
  for (const r of p.relatives) {
    if (!r.alive || r.partnerStatus === "ex" || (r.relation !== "Partner" && r.relation !== "Lover")) continue;
    if ((p.age >= 18) === (r.age >= 18)) continue;
    const n = r.name.split(" ")[0];
    if (r.relation === "Partner") endRelationship(p, r.partnerStatus === "married" ? "divorce" : "breakup");
    else {
      r.partnerStatus = "ex";
      r.lostYear = p.year;
    }
    remember(p, r, "loss", `It ended because of the gap between where you each were in life.`);
    const body = `You and ${n} are at different stages of life now, and you both knew it couldn't carry on. It ended kindly.`;
    addLog(p, body);
    changeStat(p, "happiness", -3);
    notices.push({ kind: "info", title: "Growing Apart", body, tone: "neutral" });
  }
}

export function processRelationships(p: PlayerState, prev: Record<string, number>, rng: Rng, notices: Notices) {
  closeAgeGaps(p, notices);
  processPartnership(p, prev, rng, notices);
  processInLaws(p, prev, rng, notices);
  processCircle(p, prev, rng, notices);
}
