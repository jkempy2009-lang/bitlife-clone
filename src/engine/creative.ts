/** Yearly entry point for the fame careers; see influencer.ts, music.ts, acting.ts and celebrity.ts. */
import type { PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { autoResolveScandal } from "./celebrity";
import { processInfluencer } from "./influencer";
import { processMusic } from "./music";
import { processActing } from "./acting";
import type { Notices } from "./creativeCore";

/** Runs every creative career for the year and returns the combined gross (taxable) income. */
export function processCreative(p: PlayerState, rng: Rng, notices: Notices): number {
  autoResolveScandal(p, rng, notices);
  return processInfluencer(p, rng, notices) + processMusic(p, rng, notices) + processActing(p, rng, notices);
}
