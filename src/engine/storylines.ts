/** Read-only view of the storylines a life is currently in (used by the Dashboard). */
import type { PlayerState } from "@/types/game.types";
import { ARCS } from "@/data/events/arcs";
import { fillTokens } from "./events";

export interface StorylineStatus {
  id: string;
  title: string;
  emoji: string;
  /** One line describing where the story stands right now. */
  status: string;
}

export const isArcActive = (p: PlayerState, arcId: string) => p.flags.includes(`arc_${arcId}`) && !p.flags.includes(`arc_${arcId}_done`);

export function activeStorylines(p: PlayerState): StorylineStatus[] {
  const out: StorylineStatus[] = [];
  for (const arc of ARCS) {
    if (!isArcActive(p, arc.id)) continue;
    let text = arc.start;
    for (const s of arc.stages) if (p.flags.includes(s.flag)) text = s.text; // last matching stage wins
    out.push({ id: arc.id, title: arc.title, emoji: arc.emoji, status: fillTokens(text, p) });
  }
  return out;
}

/** Storylines that reached a named ending this life, e.g. [{ arc: "rival", outcome: "friend" }]. */
export function finishedStorylines(p: PlayerState): Array<{ arc: string; outcome: string }> {
  const out: Array<{ arc: string; outcome: string }> = [];
  for (const arc of ARCS) {
    if (!p.flags.includes(`arc_${arc.id}_done`)) continue;
    const prefix = `arc_${arc.id}_`;
    const outcome = p.flags.find((f) => f.startsWith(prefix) && f !== `${prefix}done` && f !== `${prefix}lapsed`);
    out.push({ arc: arc.id, outcome: outcome ? outcome.slice(prefix.length) : "lapsed" });
  }
  return out;
}
