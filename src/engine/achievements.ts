import type { ActionResult, PlayerState } from "@/types/game.types";
import { ACHIEVEMENTS } from "@/data/achievements";
import { addLog } from "./state";

/** Unlocks any newly earned achievements and queues a notice for each. */
export function checkAchievements(p: PlayerState, notices: NonNullable<ActionResult["notices"]>) {
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id)) continue;
    if (!a.check(p)) continue;
    p.achievements.push(a.id);
    addLog(p, `🏆 Achievement unlocked: ${a.name}`);
    notices.push({ kind: "info", title: `${a.emoji} ${a.name}`, body: `Achievement unlocked: ${a.desc}`, tone: "jackpot" });
  }
}
