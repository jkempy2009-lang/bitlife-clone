/** Hidden gifts at work: small, steady nudges that make people genuinely different. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { addLog } from "./state";

type Notices = NonNullable<ActionResult["notices"]>;

/** -1 … +1 around the typical value (50). */
export const gift = (p: PlayerState, key: keyof PlayerState["talents"]): number => ((p.talents?.[key] ?? 50) - 50) / 50;

/** Yearly flare-ups for the hot-headed: a row with someone close. */
export function processTemper(p: PlayerState, rng: Rng, notices: Notices) {
  const temper = p.talents.temper;
  if (p.age < 14 || temper < 65 || p.isInPrison) return;
  if (!rng.chance((temper - 60) / 380)) return;
  const targets = p.relatives.filter((r) => r.alive && r.partnerStatus !== "ex" && (r.relation === "Partner" || r.relation === "Friend" || r.relation === "Parent" || r.relation === "Sibling"));
  if (targets.length === 0) return;
  const t = rng.pick(targets);
  t.relationshipBar = clamp(t.relationshipBar - rng.int(6, 14));
  p.happiness = clamp(p.happiness - 3);
  const body = `You lost your temper with ${t.name.split(" ")[0]} and said things you didn't mean. The silence afterwards was worse.`;
  addLog(p, body);
  notices.push({ kind: "info", title: "Lost Your Temper", body, tone: "bad" });
}
