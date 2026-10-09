/**
 * The catalogue of things that happen to whole countries: pandemics, wars, recessions, inflation,
 * technology shifts, policy changes and natural disasters. The engine (engine/worldEvents.ts) rolls
 * them year by year for every country, and what is under way where you live changes prices, jobs,
 * healthcare and safety for you.
 */
import type { Climate } from "@/types/game.types";
import { profileOf, type CountryProfile, type Disaster } from "./countryProfiles";

export interface WorldEffects {
  /** Extra yearly cost-of-living pressure (fraction). */
  prices?: number;
  /** Added to the yearly chance of being laid off. */
  layoff?: number;
  /** Added to the chance of getting hired (negative = harder). */
  hiring?: number;
  /** Multiplier on infectious illness. */
  infection?: number;
  /** Multiplier on everyone's yearly death risk (before the country's care quality is applied for pandemics). */
  mortality?: number;
  /** Extra mortality for people aged 15-40 (wars). */
  youngMortality?: number;
  /** Multiplier on what care costs. */
  care?: number;
  /** Yearly mood change. */
  happiness?: number;
  /** Shift to investment returns (fraction). */
  market?: number;
  /** Shift to the housing market (fraction). */
  housing?: number;
  /** Forces the economic climate while the event lasts. */
  climate?: Climate;
  /** Multiplier on income tax. */
  tax?: number;
}

export type WorldKind = "pandemic" | "war" | "recession" | "inflation" | "tech" | "policy" | "disaster" | "unrest";

export interface WorldEventDef {
  id: string;
  name: string;
  emoji: string;
  kind: WorldKind;
  /** "global" events strike every country at once; "country" events strike one (and may spill over to its region). */
  scope: "global" | "country";
  /** Yearly chance of beginning (per country for country events, once for global ones). */
  rate: number;
  duration: [number, number];
  /** Years that must pass between starts. */
  gap: number;
  /** How exposed a country is (0 = never). Defaults to 1. */
  exposure?: (c: CountryProfile, country: string) => number;
  headline: (country: string, severity: number) => string;
  /** Effects in the country it hits. */
  fx: WorldEffects;
  /** Milder effects in the rest of the region (wars, crises, shocks that travel). */
  spill?: WorldEffects;
  /** A life event (id) offered to residents when it begins. */
  prompt?: string;
  /** One-line summary of what it does to you, for the Dashboard. */
  gist: string;
}

const hits = (d: Disaster) => (c: CountryProfile) => (c.disasters.includes(d) ? 1 : 0);

export const WORLD_EVENTS: WorldEventDef[] = [
  {
    id: "pandemic", name: "Pandemic", emoji: "🦠", kind: "pandemic", scope: "global", rate: 0.02, duration: [2, 3], gap: 25,
    headline: (_c, s) => (s >= 3 ? "A deadly new virus is spreading across the world. Hospitals are overwhelmed." : s === 2 ? "A new respiratory virus is circulating worldwide. Borders close and cities lock down." : "A new virus spreads internationally, but health systems cope."),
    fx: { infection: 2.6, mortality: 1.5, care: 1.25, layoff: 0.05, hiring: -0.12, happiness: -3, market: -0.08, climate: "recession" },
    prompt: "world_pandemic",
    gist: "Infections surge, hospitals strain, jobs vanish and everyone is anxious.",
  },
  {
    id: "financial_crisis", name: "Global Financial Crisis", emoji: "📉", kind: "recession", scope: "global", rate: 0.022, duration: [2, 4], gap: 12,
    exposure: (c) => 0.6 + c.volatility * 0.4,
    headline: () => "Banks are failing and credit has frozen. A global financial crisis is destroying jobs and savings.",
    fx: { layoff: 0.06, hiring: -0.15, housing: -0.07, market: -0.2, happiness: -1, climate: "recession", prices: 0.0 },
    prompt: "world_crisis",
    gist: "Layoffs, falling house prices, crashing markets and hard-to-find jobs.",
  },
  {
    id: "energy_shock", name: "Energy & Inflation Shock", emoji: "⛽", kind: "inflation", scope: "global", rate: 0.02, duration: [2, 3], gap: 12,
    exposure: (c) => 0.7 + c.volatility * 0.3,
    headline: () => "Energy prices have spiked and inflation is surging. Everything costs more.",
    fx: { prices: 0.07, layoff: 0.01, hiring: -0.04, happiness: -1, market: -0.06 },
    gist: "Prices climb faster than pay for a few years.",
  },
  {
    id: "automation_wave", name: "Automation Wave", emoji: "🤖", kind: "tech", scope: "global", rate: 0.028, duration: [6, 10], gap: 30,
    headline: () => "A new wave of automation and AI tools is reshaping work. Entire job categories are shrinking.",
    fx: { layoff: 0.015, hiring: -0.03, market: 0.04 },
    prompt: "world_automation",
    gist: "Routine jobs are shrinking and markets love it. Staying employable takes effort.",
  },
  {
    id: "tech_boom", name: "Technology Boom", emoji: "🚀", kind: "tech", scope: "global", rate: 0.025, duration: [3, 6], gap: 20,
    headline: () => "A breakthrough technology sparks a global investment boom. Hiring is hot.",
    fx: { hiring: 0.07, market: 0.1, layoff: -0.005, climate: "boom" },
    gist: "Hiring is hot and markets climb.",
  },
  {
    id: "recession_local", name: "National Recession", emoji: "📉", kind: "recession", scope: "country", rate: 0.026, duration: [2, 3], gap: 8,
    exposure: (c) => c.volatility,
    headline: (c) => `${c} slides into a deep recession. Factories close and unemployment climbs.`,
    fx: { layoff: 0.06, hiring: -0.14, housing: -0.05, market: -0.12, climate: "recession" },
    gist: "Layoffs, hard hiring and falling asset prices at home.",
  },
  {
    id: "currency_crisis", name: "Currency Crisis", emoji: "💸", kind: "inflation", scope: "country", rate: 0.012, duration: [2, 4], gap: 15,
    exposure: (c) => (c.volatility >= 1.3 ? c.volatility : c.volatility >= 1.1 ? 0.3 : 0),
    headline: (c) => `The currency in ${c} has collapsed. Prices are rocketing and savings are melting away.`,
    fx: { prices: 0.16, layoff: 0.03, hiring: -0.08, happiness: -2, market: -0.1, climate: "recession" },
    spill: { prices: 0.02 },
    prompt: "world_currency",
    gist: "Prices explode while pay stands still. Savings lose their value.",
  },
  {
    id: "housing_bust", name: "Housing Crash", emoji: "🏚️", kind: "recession", scope: "country", rate: 0.012, duration: [2, 3], gap: 14,
    headline: (c) => `House prices are crashing in ${c}. Mortgages are underwater and builders are laying off.`,
    fx: { housing: -0.1, layoff: 0.02, hiring: -0.05, happiness: -1 },
    gist: "Property values fall and mortgages bite.",
  },
  {
    id: "housing_boom", name: "Housing Boom", emoji: "🏘️", kind: "recession", scope: "country", rate: 0.016, duration: [3, 5], gap: 10,
    headline: (c) => `A property frenzy grips ${c}. Homes are changing hands within days at record prices.`,
    fx: { housing: 0.06, prices: 0.01, hiring: 0.02 },
    gist: "Property values soar; renting gets pricier.",
  },
  {
    id: "war", name: "War", emoji: "⚔️", kind: "war", scope: "country", rate: 0.011, duration: [2, 8], gap: 30,
    exposure: (c) => c.conflict * 12,
    headline: (c, s) => (s >= 3 ? `War has engulfed ${c}. Cities are under bombardment and refugees are fleeing.` : `Fighting has broken out in ${c}. The army is mobilising and the border is tense.`),
    fx: { mortality: 1.8, youngMortality: 2.5, prices: 0.09, layoff: 0.07, hiring: -0.2, happiness: -4, market: -0.15, care: 1.3, climate: "recession" },
    spill: { prices: 0.03, layoff: 0.015, happiness: -1, market: -0.05 },
    prompt: "world_war",
    gist: "Violence, rationing, conscription and a collapsing economy. Neighbouring countries feel the shock.",
  },
  {
    id: "unrest", name: "Political Crisis", emoji: "🔥", kind: "unrest", scope: "country", rate: 0.025, duration: [1, 3], gap: 8,
    exposure: (c) => c.conflict * 8,
    headline: (c) => `Mass protests and a political crisis shake ${c}. Strikes and clashes in the streets.`,
    fx: { mortality: 1.1, layoff: 0.025, hiring: -0.05, happiness: -2, market: -0.05 },
    gist: "Strikes, clashes and uncertainty.",
  },
  {
    id: "austerity", name: "Austerity", emoji: "✂️", kind: "policy", scope: "country", rate: 0.016, duration: [4, 8], gap: 15,
    exposure: (c) => (c.care === "universal" ? 1 : 0.3),
    headline: (c) => `The government of ${c} announces deep spending cuts. Hospitals and schools are told to do more with less.`,
    fx: { care: 1.35, layoff: 0.015, hiring: -0.03, happiness: -1 },
    gist: "Public services are cut: care costs rise and waiting lists grow.",
  },
  {
    id: "health_reform", name: "Healthcare Reform", emoji: "🏥", kind: "policy", scope: "country", rate: 0.016, duration: [6, 12], gap: 25,
    headline: (c) => `${c} passes a landmark healthcare reform. More people are covered and costs fall.`,
    fx: { care: 0.7, happiness: 0 },
    gist: "Medical care becomes cheaper and easier to reach.",
  },
  {
    id: "tax_hike", name: "Tax Rise", emoji: "🧾", kind: "policy", scope: "country", rate: 0.016, duration: [5, 10], gap: 15,
    headline: (c) => `${c} raises income taxes to plug a budget gap. Pay packets shrink.`,
    fx: { tax: 1.1 },
    gist: "You keep less of what you earn.",
  },
  {
    id: "tax_cut", name: "Tax Cut", emoji: "🏷️", kind: "policy", scope: "country", rate: 0.014, duration: [5, 10], gap: 15,
    headline: (c) => `${c} slashes income taxes. Pay packets grow, public services stretch.`,
    fx: { tax: 0.9, care: 1.05 },
    gist: "You keep more of what you earn.",
  },
  {
    id: "earthquake", name: "Major Earthquake", emoji: "🏚️", kind: "disaster", scope: "country", rate: 0.016, duration: [1, 1], gap: 6,
    exposure: hits("earthquake"),
    headline: (c, s) => `A ${s >= 3 ? "devastating" : "powerful"} earthquake strikes ${c}. Buildings have collapsed.`,
    fx: { mortality: 1.25, layoff: 0.02, prices: 0.02, happiness: -2, housing: -0.04 },
    prompt: "world_disaster",
    gist: "Damage, disruption and grief.",
  },
  {
    id: "flood", name: "Catastrophic Floods", emoji: "🌊", kind: "disaster", scope: "country", rate: 0.03, duration: [1, 1], gap: 4,
    exposure: hits("flood"),
    headline: (c) => `Severe flooding has swamped large parts of ${c}. Thousands are displaced.`,
    fx: { mortality: 1.1, prices: 0.02, happiness: -1, housing: -0.03 },
    prompt: "world_disaster",
    gist: "Homes damaged and roads cut.",
  },
  {
    id: "hurricane", name: "Hurricane Season", emoji: "🌀", kind: "disaster", scope: "country", rate: 0.04, duration: [1, 1], gap: 3,
    exposure: hits("hurricane"),
    headline: (c) => `A major hurricane has made landfall in ${c}. Power is out and coastal towns are wrecked.`,
    fx: { mortality: 1.1, prices: 0.02, happiness: -1, housing: -0.03 },
    prompt: "world_disaster",
    gist: "Storm damage and power cuts.",
  },
  {
    id: "typhoon", name: "Super Typhoon", emoji: "🌪️", kind: "disaster", scope: "country", rate: 0.04, duration: [1, 1], gap: 3,
    exposure: hits("typhoon"),
    headline: (c) => `A super typhoon has battered ${c}. Transport is shut down and coastlines are flooded.`,
    fx: { mortality: 1.08, prices: 0.01, happiness: -1 },
    prompt: "world_disaster",
    gist: "Storm damage and disruption.",
  },
  {
    id: "wildfire", name: "Wildfire Season", emoji: "🔥", kind: "disaster", scope: "country", rate: 0.04, duration: [1, 1], gap: 3,
    exposure: hits("wildfire"),
    headline: (c) => `Record wildfires are burning across ${c}. Smoke blankets the cities and whole towns are evacuated.`,
    fx: { mortality: 1.05, infection: 1.1, prices: 0.01, happiness: -1, housing: -0.02 },
    prompt: "world_disaster",
    gist: "Smoke, evacuations and burned homes.",
  },
  {
    id: "heatwave", name: "Deadly Heatwave", emoji: "🌡️", kind: "disaster", scope: "country", rate: 0.05, duration: [1, 1], gap: 3,
    exposure: hits("heatwave"),
    headline: (c) => `An unprecedented heatwave grips ${c}. Hospitals fill with the elderly.`,
    fx: { mortality: 1.12, happiness: -1 },
    gist: "Dangerous for the old and the sick.",
  },
  {
    id: "drought", name: "Severe Drought", emoji: "🏜️", kind: "disaster", scope: "country", rate: 0.03, duration: [2, 3], gap: 6,
    exposure: hits("drought"),
    headline: (c) => `A severe drought has gripped ${c}. Harvests are failing and food prices are climbing.`,
    fx: { prices: 0.05, mortality: 1.05, happiness: -1 },
    gist: "Food prices rise and the countryside suffers.",
  },
];

export const WORLD_EVENT_BY_ID: Record<string, WorldEventDef> = Object.fromEntries(WORLD_EVENTS.map((e) => [e.id, e]));

/** How exposed `country` is to an event kind. */
export function exposureOf(def: WorldEventDef, country: string): number {
  return def.exposure ? def.exposure(profileOf(country), country) : 1;
}
