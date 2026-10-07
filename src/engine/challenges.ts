import type { ActionResult, PlayerState } from "@/types/game.types";
import { CHALLENGE_BY_ID } from "@/data/challenges";
import { addLog } from "./state";

/** Called from finalize: resolves an active challenge when it is won, or its deadline passes. */
export function checkChallenge(p: PlayerState, notices: NonNullable<ActionResult["notices"]>) {
  const state = p.challenge;
  if (!state || state.status !== "active") return;
  const def = CHALLENGE_BY_ID[state.id];
  if (!def) return;
  if (def.achieved(p)) {
    state.status = "won";
    if (!p.flags.includes("challenge_won")) p.flags.push("challenge_won");
    const body = `Challenge complete: ${def.name}! ${def.goal}`;
    addLog(p, `🏅 ${body}`);
    notices.push({ kind: "info", title: `${def.emoji} Challenge Won`, body, tone: "jackpot" });
    return;
  }
  if (!p.alive && def.survivesDeath && p.relatives.some((r) => r.relation === "Child" && r.alive)) return;
  if (!p.alive || p.age > def.byAge) {
    state.status = "failed";
    const body = p.alive ? `You ran out of time. ${def.name}: ${def.goal}` : `Your life ended before you could finish. ${def.name}: ${def.goal}`;
    addLog(p, `Challenge failed: ${def.name}.`);
    notices.push({ kind: "info", title: "Challenge Failed", body, tone: "bad" });
  }
}
