import { makeRng, type Rng } from "@/lib/rng";
import { ageUp, finalize } from "../../ageUp";
import { createNewPlayer } from "../../state";
import { resolveEvent } from "../../events";
import { resolveTrial } from "../../crime";
import { applyForJob, enrollProgram } from "../../career";
import { meetSomeone, propose, tryForBaby } from "../../social";
import { continueAsChild, heirs } from "../../legacy";
import { ARCS } from "@/data/events/arcs";
import type { Notice, PlayerState } from "@/types/game.types";

const JOB_LINES = ["retail", "fast_food", "construction", "teacher", "nurse", "software", "accounting", "marketing", "trades", "mechanic", "finance"];

export interface LifeReport {
  p: PlayerState;
  /** Arcs whose entry fired, by id. */
  started: Set<string>;
  /** Arcs that reached `_done` (including lapsed ones). */
  finished: Set<string>;
  lapsed: Set<string>;
  /** Event id -> times it was shown. */
  shown: Record<string, number>;
  years: number;
  generations: number;
}

const arcMain = (f: string) => /^arc_[a-z0-9]+$/.test(f);

/** Plays a "typical" life: gets a job, friends, a partner, kids; answers events at random. */
export function playTypicalLife(seed: number, opts: { heirs?: boolean; maxYears?: number } = {}): LifeReport {
  const rng = makeRng(seed);
  let p = createNewPlayer({ scenario: "random", startYear: 2026 }, rng);
  const report: LifeReport = { p, started: new Set(), finished: new Set(), lapsed: new Set(), shown: {}, years: 0, generations: 1 };
  const scan = () => {
    for (const f of p.flags) {
      if (arcMain(f)) report.started.add(f.slice(4));
      if (/^arc_[a-z0-9]+_done$/.test(f)) report.finished.add(f.slice(4, -5));
      if (/^arc_[a-z0-9]+_lapsed$/.test(f)) report.lapsed.add(f.slice(4, -7));
    }
  };
  const settle = (res: { player: PlayerState }) => {
    const extra: NonNullable<ReturnType<typeof ageUp>["notices"]> = [];
    if (res.player !== p) finalize(res.player, extra);
    p = res.player;
  };
  const maxYears = opts.maxYears ?? 400;
  for (let guard = 0; guard < maxYears; guard++) {
    if (!p.alive) {
      scan();
      const kid = opts.heirs && report.generations < 3 ? heirs(p)[0] : undefined;
      if (!kid) break;
      const next = continueAsChild(p, kid.id, rng);
      if (!next) break;
      p = next;
      report.generations++;
      continue;
    }
    if (p.pendingTrial) settle(resolveTrial(p, "public", rng));
    typicalActions(() => p, rng, settle);
    const res = ageUp(p, rng);
    p = res.player;
    report.years++;
    for (const n of (res.notices ?? []) as Notice[]) {
      if (n.kind !== "event" || !p.alive) continue;
      report.shown[n.event.id] = (report.shown[n.event.id] ?? 0) + 1;
      const out = resolveEvent(p, n.event, rng.int(0, n.event.options.length - 1), rng);
      settle(out);
      if (p.pendingTrial) settle(resolveTrial(p, "public", rng));
    }
    scan();
  }
  report.p = p;
  return report;
}

function typicalActions(get: () => PlayerState, rng: Rng, settle: (r: { player: PlayerState }) => void) {
  const friends = get().relatives.filter((r) => r.relation === "Friend" && r.alive).length;
  if (get().age >= 8 && friends < 2 && rng.chance(0.5)) settle(meetSomeone(get(), "friend", rng));
  const p = get();
  if (p.age >= 16 && !p.currentJob && !p.business && p.education.stage === "None" && !p.isInPrison && rng.chance(0.6)) {
    settle(applyForJob(p, rng.pick(JOB_LINES), rng));
  }
  if (get().age === 18 && get().education.stage === "None" && rng.chance(0.3)) settle(enrollProgram(get(), "University", "business", rng));
  const partner = get().relatives.find((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");
  if (get().age >= 20 && get().age < 55 && !partner && rng.chance(0.25)) settle(meetSomeone(get(), "date", rng));
  if (partner && partner.partnerStatus === "dating" && partner.relationshipBar > 60 && rng.chance(0.3)) settle(propose(get(), rng));
  const now = get();
  if (now.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "married" && r.alive) && now.age >= 24 && now.age <= 38 && rng.chance(0.25)) settle(tryForBaby(now, rng));
}

/** All arc ids, for reports. */
export const ARC_IDS = ARCS.map((a) => a.id);
