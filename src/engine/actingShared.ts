/**
 * Shared pieces of the screen career: genres and names, union minimums, who takes a cut of what,
 * and how offers are built. No imports from acting.ts so every acting module can depend on it.
 */
import type { ActingMedium, FilmOffer, PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";

export const FILM_GENRES = ["Drama", "Comedy", "Action", "Horror", "Romance", "Sci-Fi", "Indie"] as const;

const TITLE_A = ["Last", "Silent", "Broken", "Midnight", "Crimson", "Hollow", "Golden", "Wild", "Burning", "Distant", "Final", "Secret"];
const TITLE_B = ["Harvest", "Horizon", "Signal", "Summer", "Protocol", "Kingdom", "Letters", "Frontier", "Echoes", "Promise", "Orbit", "Departure"];
export const AGENT_FIRST = ["Marcus", "Dana", "Lorraine", "Vikram", "Sofia", "Hugh", "Tamsin", "Reggie", "Camille", "Ari"];
export const AGENT_LAST = ["Sterling", "Goldberg", "Park", "Delacroix", "Bell", "Whitfield", "Oyelaran", "Ricci", "Hayes", "Moss"];
export const STUDIOS = ["Starlight Studios", "Silverscreen Pictures", "Horizon Films", "Meridian Pictures", "Apex Entertainment"];
export const NETWORKS = ["Channel Nine", "Apex Streaming", "Meridian Network", "Northlight TV", "Halcyon+"];

/** Guild minimums: nobody working under a union contract is paid less than this per job. */
export const UNION_SCALE = { film: 3_500, tv: 14_000, stage: 2_500, voice: 1_800, commercial: 2_500 } as const;

export const ROLE_PCT = { cameo: 0.1, supporting: 0.3, lead: 0.45 } as const;
/** A television season pays more of a salary than one film does: it is most of a year's work. */
export const TV_PCT = { cameo: 0.12, supporting: 0.4, lead: 0.7 } as const;

export const isActor = (p: PlayerState) => p.currentJob?.lineId === "actor";
export const isModel = (p: PlayerState) => p.currentJob?.lineId === "model";

export function ageLooksFactor(p: PlayerState): number {
  return p.age <= 40 ? 1 : Math.max(0.55, 1 - (p.age - 40) * 0.015);
}

export const makeTitle = (rng: Rng) => `The ${rng.pick(TITLE_A)} ${rng.pick(TITLE_B)}`;

export const MEDIUM_LABEL: Record<ActingMedium, string> = { film: "Film", tv: "Television", stage: "Theatre" };

/** What your agent and manager keep of a payment. */
export function cutsFor(p: PlayerState, amount: number): { agent: number; manager: number; total: number } {
  const a = p.acting;
  const agent = a.agent ? Math.round(amount * a.agent.cut) : 0;
  const manager = a.manager ? Math.round(amount * a.manager.cut) : 0;
  return { agent, manager, total: agent + manager };
}

export function roleFor(p: PlayerState, rng: Rng): FilmOffer["role"] {
  const a = p.acting;
  const tier = p.currentJob?.tier ?? 0;
  const leadOk = !!a.agent && a.reputation >= 40;
  const old = p.age >= 50 && a.reputation < 70 ? 0.3 : 1;
  if (tier === 0) return rng.chance(0.4) && a.reputation >= 25 ? "supporting" : "cameo";
  if (tier === 1) return leadOk && rng.chance(0.3 * old) ? "lead" : "supporting";
  if (tier === 2) return rng.chance(0.6 * old) ? "lead" : "supporting";
  return rng.chance(0.85 * old) ? "lead" : "supporting";
}

/** Genres a 50-year-old is rarely cast as the romantic or action lead in. */
const YOUTH_GENRES = ["Action", "Romance", "Sci-Fi"];

export function buildOffer(p: PlayerState, rng: Rng, role: FilmOffer["role"], genre?: string, fee?: number, medium: ActingMedium = "film"): FilmOffer {
  const a = p.acting;
  const job = p.currentJob;
  const salary = job?.salary ?? 18_000;
  const g = genre ?? (medium === "stage" ? rng.pick(["Drama", "Comedy", "Romance", "Indie"]) : a.typecast && rng.chance(0.65) ? a.typecast : rng.pick(FILM_GENRES));
  const indie = g === "Indie";
  // The industry ages out leads in youthful genres; the same actor is offered the parent or mentor instead.
  let r = role;
  if (p.age >= 50 && r === "lead" && YOUTH_GENRES.includes(g) && a.reputation < 80 && rng.chance(0.6)) r = "supporting";
  const budget =
    medium === "stage" ? rng.int(80_000, 1_500_000)
    : medium === "tv" ? rng.int(6_000_000, 45_000_000)
    : indie ? rng.int(300_000, 3_000_000)
    : r === "cameo" ? rng.int(500_000, 5_000_000) : r === "supporting" ? rng.int(3_000_000, 40_000_000) : rng.int(10_000_000, 120_000_000);
  const jitter = rng.float(0.7, 1.4);
  const raw =
    medium === "tv" ? salary * TV_PCT[r] * jitter
    : medium === "stage" ? salary * ROLE_PCT[r] * 0.45 * jitter
    : salary * ROLE_PCT[r] * jitter;
  const script = clamp(
    Math.round(30 + a.reputation * 0.25 + (a.agent?.skill ?? 0) * 0.2 + (a.manager?.skill ?? 0) * 0.12 + rng.int(-20, 25) + (indie ? 8 : 0) + (medium === "stage" ? 8 : 0)),
  );
  return {
    id: rng.id(),
    title: makeTitle(rng),
    genre: g,
    role: r,
    fee: fee ?? Math.max(UNION_SCALE[medium], Math.round(raw)),
    budget,
    script,
    prestige: medium === "stage" ? rng.int(45, 95) : rng.int(20, 90),
    medium,
    ...(medium === "tv" ? { seasons: rng.int(3, 6) } : {}),
  };
}

export function roman(n: number): string {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n);
}
