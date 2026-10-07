/** Later life: long-term care and grief. */
import type { ActionResult, PlayerState } from "@/types/game.types";
import { money } from "@/lib/format";
import { addLog, changeStat } from "./state";
import { medicalCostFactor } from "./health";

type Notices = NonNullable<ActionResult["notices"]>;
const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export const CARE_FLAGS = ["assisted_living", "home_care", "family_care"] as const;

/** Yearly cost of the care arrangement (public systems cover most of it). */
export function careCost(p: PlayerState): number {
  const f = Math.max(0.25, medicalCostFactor(p) * 3);
  if (p.flags.includes("assisted_living")) return Math.round(32_000 * Math.min(1, f));
  if (p.flags.includes("home_care")) return Math.round(18_000 * Math.min(1, f));
  return 0;
}

export function needsCare(p: PlayerState): boolean {
  return p.age >= 78 && (p.health < 48 || p.diseases.some((d) => d.id === "alzheimers"));
}

/** Runs once a year during Age Up. */
export function processLaterLife(p: PlayerState, notices: Notices) {
  // Grief lingers after a spouse dies.
  const grief = p.flags.find((f) => f.startsWith("grief:"));
  if (grief) {
    const since = Number(grief.split(":")[1]);
    if (p.year - since >= 3) p.flags = p.flags.filter((f) => f !== grief);
    else changeStat(p, "happiness", -Math.max(1, Math.round(3 * (1.4 - p.talents.resilience / 125))));
  }
  if (p.age < 70) return;
  const cost = careCost(p);
  if (cost > 0) {
    p.bankBalance -= cost;
    changeStat(p, "health", p.flags.includes("assisted_living") ? 2 : 1);
    if (p.bankBalance < 0) {
      // Can't pay: care is cut and family bears the burden.
      p.flags = p.flags.filter((f) => f !== "assisted_living" && f !== "home_care");
      p.flags.push("family_care");
      const body = `You could no longer afford your care. It's now down to family, and that has strained things. (${money(cost)} a year was too much.)`;
      addLog(p, body);
      notices.push(info("Care Withdrawn", body, "bad"));
    }
  }
  if (p.flags.includes("family_care")) {
    for (const r of p.relatives) if (r.alive && (r.relation === "Child" || r.relation === "Sibling")) r.relationshipBar = Math.max(0, r.relationshipBar - 2);
    changeStat(p, "health", -1);
  }
}
