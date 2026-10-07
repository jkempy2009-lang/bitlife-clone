/**
 * Skip ahead: live several years in one go. Decisions are made by autopilot (see autopilot.ts)
 * and the run only stops early for things you can't hand off: death, a trial, or prison.
 */
import type { ActionResult, Chip, PlayerState } from "@/types/game.types";
import type { LifeEvent } from "@/data/lifeEventsEngine";
import type { Rng } from "@/lib/rng";
import { ageUp, finalize } from "./ageUp";
import { fillTokens, resolveEvent } from "./events";
import { autoPlan } from "./autopilot";
import { summarizeDelta } from "./state";

type Notices = NonNullable<ActionResult["notices"]>;

export const MAX_SKIP_YEARS = 25;

interface Highlight {
  age: number;
  text: string;
}

function decide(player: PlayerState, event: LifeEvent, rng: Rng, notices: Notices): { player: PlayerState; line: string } {
  const plan = autoPlan(player, event);
  if (plan.pass) {
    const next = structuredClone(player);
    next.seenEvents[event.id] = next.age;
    return { player: next, line: `${fillTokens(event.title, player)}: let it pass` };
  }
  for (const i of plan.order) {
    const result = resolveEvent(player, event, i, rng);
    if (result.player === player) continue;
    const extra: Notices = [];
    finalize(result.player, extra);
    // A decision can itself raise a follow-up decision (coups, chained beats); those are handled too.
    notices.push(...extra);
    return { player: result.player, line: `${fillTokens(event.title, player)}: ${fillTokens(event.options[i].text, player)}` };
  }
  return { player, line: "" };
}

export function skipYears(start: PlayerState, rng: Rng, years = 10): { player: PlayerState; notices: Notices; years: number } {
  let player = start;
  const highlights: Highlight[] = [];
  const stopReasons: string[] = [];
  const max = Math.max(1, Math.min(years, MAX_SKIP_YEARS));
  let done = 0;

  for (let i = 0; i < max; i++) {
    const wasPrison = player.isInPrison;
    const result = ageUp(player, rng);
    if (result.player === player) break;
    player = result.player;
    done++;

    const queue: Notices = [...(result.notices ?? [])];
    let guard = 0;
    while (queue.length && guard++ < 20) {
      const n = queue.shift()!;
      if ("event" in n) {
        if (!player.alive) continue;
        const next = decide(player, n.event, rng, queue);
        player = next.player;
        if (next.line) highlights.push({ age: player.age, text: next.line });
      } else if ("tone" in n && (n.tone === "jackpot" || n.tone === "bad")) {
        highlights.push({ age: player.age, text: `${n.title}${n.tone === "bad" ? " ⚠" : " ★"}` });
      }
    }

    if (!player.alive) {
      stopReasons.push("Your story ended.");
      break;
    }
    if (player.pendingTrial) {
      stopReasons.push("You were arrested, so the skip stopped for your trial.");
      break;
    }
    if (player.isInPrison !== wasPrison) {
      stopReasons.push(player.isInPrison ? "You were sent to prison, so the skip stopped." : "You were released from prison.");
      break;
    }
  }

  if (done === 0) return { player, notices: [], years: 0 };

  const chips: Chip[] = summarizeDelta(start, player);
  const shown = highlights.slice(-10);
  const lines = shown.map((h) => `Age ${h.age} · ${h.text}`);
  const dropped = highlights.length - shown.length;
  const intro = `You lived ${done} year${done === 1 ? "" : "s"} (age ${start.age} to ${player.age}).`;
  const body = [
    intro,
    ...(stopReasons.length ? [stopReasons[0]] : []),
    ...(lines.length ? ["", dropped > 0 ? `Highlights (last ${shown.length} of ${highlights.length}):` : "Highlights:", ...lines] : ["", "Nothing much happened that you'd remember."]),
  ].join("\n");

  return {
    player,
    notices: [{ kind: "info", title: `⏩ ${done} year${done === 1 ? "" : "s"} later`, body, tone: "neutral", chips }],
    years: done,
  };
}
