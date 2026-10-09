/**
 * The world around you: pandemics, wars, recessions, inflation shocks, technology shifts, policy changes
 * and natural disasters. They are simulated for every country each year; what is under way where you live
 * (and, more faintly, in neighbouring countries) changes prices, jobs, healthcare, safety and mood.
 */
import type { ActionResult, Climate, PlayerState, WorldEventState, WorldState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { COUNTRY_PROFILES, profileOf } from "@/data/countryProfiles";
import { WORLD_EVENTS, WORLD_EVENT_BY_ID, exposureOf, type WorldEffects, type WorldEventDef } from "@/data/worldEvents";
import { addLog, changeStat } from "./state";

type Notices = NonNullable<ActionResult["notices"]>;

export const freshWorld = (): WorldState => ({ events: [], prices: 1, lastStart: {}, chronicle: [] });

export function hydrateWorld(raw: Partial<WorldState> | undefined): WorldState {
  return {
    events: Array.isArray(raw?.events) ? raw.events.filter((e) => e && WORLD_EVENT_BY_ID[e.id]) : [],
    prices: typeof raw?.prices === "number" && Number.isFinite(raw.prices) ? raw.prices : 1,
    lastStart: raw?.lastStart ?? {},
    chronicle: Array.isArray(raw?.chronicle) ? raw.chronicle.slice(-20) : [],
  };
}

// ---------------------------------------------------------------------------
// Effects as felt in one country
// ---------------------------------------------------------------------------

/** How hard a severity level lands: 1 is a scare, 3 is a catastrophe. */
const SEV_SCALE = [0, 0.6, 1, 1.5];

export interface ActiveEffect {
  state: WorldEventState;
  def: WorldEventDef;
  /** "home" = it struck your country, "world" = everywhere, "region" = a neighbour's trouble spilling over. */
  reach: "home" | "world" | "region";
  yearsLeft: number;
}

/** Everything under way that touches `country` right now. */
export function activeEvents(world: WorldState, country: string, year: number): ActiveEffect[] {
  const region = profileOf(country).region;
  const out: ActiveEffect[] = [];
  for (const st of world.events) {
    const def = WORLD_EVENT_BY_ID[st.id];
    if (!def || st.endYear < year) continue;
    const yearsLeft = Math.max(1, st.endYear - year + 1);
    if (def.scope === "global") out.push({ state: st, def, reach: "world", yearsLeft });
    else if (st.country === country) out.push({ state: st, def, reach: "home", yearsLeft });
    else if (def.spill && profileOf(st.country).region === region) out.push({ state: st, def, reach: "region", yearsLeft });
  }
  return out;
}

const NEUTRAL_FX = { prices: 0, layoff: 0, hiring: 0, infection: 1, mortality: 1, youngMortality: 1, care: 1, happiness: 0, market: 0, housing: 0, tax: 1 };
export type Aggregate = typeof NEUTRAL_FX & { climate: Climate | null };

function effectOf(a: ActiveEffect): WorldEffects {
  return a.reach === "region" ? (a.def.spill ?? {}) : a.def.fx;
}

/** All the active effects on a country, severity-scaled and combined. */
export function worldFxFor(world: WorldState, country: string, year: number): Aggregate {
  const agg: Aggregate = { ...NEUTRAL_FX, climate: null };
  const quality = profileOf(country).careQuality;
  for (const a of activeEvents(world, country, year)) {
    const fx = effectOf(a);
    const sev = SEV_SCALE[a.state.severity] ?? 1;
    // Global events do not hit every country alike: a pandemic is far deadlier where care is thin, a financial crisis where economies swing.
    const exposure = a.reach === "world" ? clamp(exposureOf(a.def, country), 0.3, 1.6) : 1;
    const add = (key: "prices" | "layoff" | "hiring" | "happiness" | "market" | "housing") => {
      if (fx[key]) agg[key] += fx[key]! * sev * exposure;
    };
    (["prices", "layoff", "hiring", "happiness", "market", "housing"] as const).forEach(add);
    const mult = (key: "infection" | "mortality" | "youngMortality" | "care" | "tax", scale = 1) => {
      if (fx[key]) agg[key] *= 1 + (fx[key]! - 1) * sev * scale;
    };
    const lethality = a.def.kind === "pandemic" ? clamp(1.8 - quality / 60, 0.4, 1.4) : 1;
    mult("mortality", lethality);
    mult("youngMortality");
    mult("infection");
    mult("care");
    mult("tax");
    if (fx.climate && a.reach !== "region" && (fx.climate === "recession" || !agg.climate)) agg.climate = fx.climate;
  }
  return agg;
}

export const worldFx = (p: PlayerState): Aggregate => worldFxFor(p.world, p.residence.country, p.year);

export const worldLayoff = (p: PlayerState) => worldFx(p).layoff;
export const worldHiring = (p: PlayerState) => worldFx(p).hiring;
export const worldCareFactor = (p: PlayerState) => worldFx(p).care;
export const worldTaxFactor = (p: PlayerState) => worldFx(p).tax;
export const worldMarketShift = (p: PlayerState) => worldFx(p).market;
export const worldHousingShift = (p: PlayerState) => worldFx(p).housing;
export const forcedClimate = (p: PlayerState) => worldFx(p).climate;
/** Multiplier on cost of living: pressure from inflation shocks that wages haven't caught up with. */
export const worldPriceLevel = (p: PlayerState) => clamp(p.world.prices, 0.9, 2.5);

/** Multiplier on your yearly death risk from what is going on around you (wars hit the young hardest). */
export function worldMortality(p: PlayerState, age = p.age): number {
  const f = worldFx(p);
  return f.mortality * (age >= 15 && age <= 40 ? f.youngMortality : 1);
}

export const worldInfection = (p: PlayerState) => worldFx(p).infection;

export function isAtWar(p: PlayerState, country = p.residence.country): boolean {
  return activeEvents(p.world, country, p.year).some((a) => a.def.kind === "war" && a.reach === "home");
}

/** Does anything serious (war, pandemic, crisis) afflict this country right now? */
export function inCrisis(world: WorldState, country: string, year: number): boolean {
  return activeEvents(world, country, year).some((a) => a.reach !== "region" && ["war", "unrest", "pandemic"].includes(a.def.kind) && a.state.severity >= 2);
}

// ---------------------------------------------------------------------------
// The yearly turn of the world
// ---------------------------------------------------------------------------

const lastKey = (def: WorldEventDef, country: string) => (def.scope === "global" ? def.id : `${def.id}:${country}`);

function start(w: WorldState, def: WorldEventDef, country: string, year: number, rng: Rng) {
  const severity = rng.weighted([1, 2, 3], (s) => (s === 1 ? 0.45 : s === 2 ? 0.38 : 0.17)) ?? 2;
  const [lo, hi] = def.duration;
  const len = Math.max(1, rng.int(lo, hi) + (severity >= 3 && hi > 1 ? 1 : 0));
  w.events.push({ id: def.id, country: def.scope === "global" ? "*" : country, startYear: year, endYear: year + len - 1, severity });
  w.lastStart[lastKey(def, country)] = year;
  return w.events[w.events.length - 1];
}

function relevantToPlayer(p: PlayerState, def: WorldEventDef, st: WorldEventState): boolean {
  if (def.scope === "global") return true;
  return st.country === p.residence.country || st.country === p.birthCountry;
}

export function advanceWorld(p: PlayerState, rng: Rng, notices: Notices) {
  const w = p.world;
  // Expire what has run its course, and tell the player when something they lived through ends.
  const ended = w.events.filter((e) => e.endYear < p.year);
  w.events = w.events.filter((e) => e.endYear >= p.year);
  for (const e of ended) {
    const def = WORLD_EVENT_BY_ID[e.id];
    if (def && relevantToPlayer(p, def, e) && e.endYear - e.startYear >= 1 && ["pandemic", "war", "recession", "inflation"].includes(def.kind)) {
      const text = def.kind === "war" ? `The fighting in ${e.country} has ended. A fragile peace holds.` : def.kind === "pandemic" ? "The pandemic is finally receding. Life is edging back to normal." : `The ${def.name.toLowerCase()} is easing.`;
      addLog(p, `📰 ${text}`);
      w.chronicle.push({ year: p.year, text });
    }
  }
  // Inflation: shocks lift the price level; afterwards wages catch up and the excess fades.
  const fx = worldFx(p);
  w.prices = 1 + (w.prices - 1) * 0.78 + fx.prices;
  if (fx.happiness) changeStat(p, "happiness", Math.round(fx.happiness));

  // New events across the world.
  for (const def of WORLD_EVENTS) {
    const targets = def.scope === "global" ? ["*"] : Object.keys(COUNTRY_PROFILES);
    for (const c of targets) {
      const key = lastKey(def, c);
      if (w.lastStart[key] !== undefined && p.year - w.lastStart[key] < def.gap) continue;
      if (def.scope === "country" && w.events.some((e) => e.id === def.id && e.country === c)) continue;
      if (def.scope === "global" && w.events.some((e) => e.id === def.id)) continue;
      const exp = def.scope === "global" ? 1 : exposureOf(def, c);
      if (exp <= 0 || !rng.chance(def.rate * exp)) continue;
      const st = start(w, def, c, p.year, rng);
      if (!relevantToPlayer(p, def, st)) continue;
      const line = def.headline(c === "*" ? p.residence.country : c, st.severity);
      w.chronicle.push({ year: p.year, text: line });
      addLog(p, `📰 ${line}`);
      const home = def.scope === "global" || c === p.residence.country;
      notices.push({ kind: "info", title: `${def.emoji} ${def.name}`, body: `${line}${home ? ` ${def.gist}` : " You hear about it from afar."}`, tone: ["tech", "policy"].includes(def.kind) && (def.fx.hiring ?? 0) >= 0 ? "neutral" : "bad" });
      if (def.prompt && home && p.age >= 14 && !p.queuedEvents.includes(def.prompt)) p.queuedEvents.push(def.prompt);
    }
  }
  w.chronicle = w.chronicle.slice(-20);
}

/** Short human text of what a country is going through, for the relocation screen. */
export function countryNews(world: WorldState, country: string, year: number): string[] {
  return activeEvents(world, country, year)
    .filter((a) => a.reach !== "region" || a.def.kind === "war")
    .map((a) => `${a.def.emoji} ${a.reach === "region" ? `${a.state.country}'s ${a.def.name.toLowerCase()} next door` : a.def.name}`);
}
