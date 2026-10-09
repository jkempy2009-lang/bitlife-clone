import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { makeRng } from "@/lib/rng";
import { parseSave } from "../save";
import { ageUp, finalize } from "../ageUp";
import { buildFamilyTree } from "../familyTree";
import { resolveTrial } from "../crime";
import { resolveEvent } from "../events";
import { autoPlan } from "../autopilot";
import { netWorth } from "../state";
import type { Notice } from "@/types/game.types";

/** A real save written by the game before the career, relationship, world, business, music, dynasty and UI work. */
const old = fs.readFileSync(path.join(__dirname, "fixtures", "save-5a1e9a0.json"), "utf8");

describe("saves from before the depth work still load and play", () => {
  it("fills in every new field and lives a full life", () => {
    const data = parseSave(old);
    expect(data).not.toBeNull();
    let p = data!.player;
    const rng = makeRng(data!.rngState);
    // New systems exist with defaults.
    for (const k of ["world", "school", "immigration", "career", "finance", "dynasty", "court"] as const) expect(p[k], k).toBeDefined();
    expect(() => buildFamilyTree(p)).not.toThrow();
    for (let g = 0; g < 110 && p.alive; g++) {
      if (p.pendingTrial) p = resolveTrial(p, "public", rng).player;
      const res = ageUp(p, rng);
      p = res.player;
      for (const n of (res.notices ?? []) as Notice[]) {
        if (n.kind === "event" && p.alive) {
          p = resolveEvent(p, n.event, autoPlan(p, n.event).order[0] ?? 0, rng).player;
          finalize(p, []);
        }
      }
      expect(Number.isFinite(netWorth(p))).toBe(true);
    }
    expect(p.age).toBeGreaterThan(40);
    expect(() => buildFamilyTree(p)).not.toThrow();
  });
});
