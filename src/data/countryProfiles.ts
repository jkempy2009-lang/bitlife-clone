/**
 * What a country is actually like to live (and die) in, beyond its tax table and its names:
 * the healthcare system, how risky childhood and old age are, which disasters it suffers,
 * how politically and economically stable it is, and how hard it is to move there.
 */

export type Region = "north_america" | "europe" | "east_asia" | "south_asia" | "latin_america" | "africa" | "oceania";
export type CareSystem = "universal" | "insured" | "private";
export type Disaster = "earthquake" | "flood" | "hurricane" | "wildfire" | "heatwave" | "typhoon" | "drought";

export interface CountryProfile {
  region: Region;
  care: CareSystem;
  /** 0-100: how good the health service is when you can reach it. */
  careQuality: number;
  /** Multiplier on childhood death rates against a rich-country baseline. */
  childRisk: number;
  /** Multiplier on death rates for adults (violence, roads, untreated illness). */
  adultRisk: number;
  /** Multiplier on death rates after 60 (care, diet, pollution). */
  elderRisk: number;
  /** Multiplier on infectious disease (sanitation, climate, vaccination). */
  infection: number;
  /** Disasters this country is prone to. */
  disasters: Disaster[];
  /** 0-1: yearly appetite for war and unrest. */
  conflict: number;
  /** How violently its economy swings (recessions, currency crises). */
  volatility: number;
  language: string;
  /** 0-100: how hard it is to be admitted (higher = tougher). */
  entry: number;
  /** One-line portrait for the relocation screen. */
  blurb: string;
}

export const COUNTRY_PROFILES: Record<string, CountryProfile> = {
  "United States": {
    region: "north_america", care: "insured", careQuality: 78, childRisk: 1.25, adultRisk: 1.2, elderRisk: 1.05, infection: 1,
    disasters: ["hurricane", "wildfire", "flood"], conflict: 0.015, volatility: 1, language: "English", entry: 72,
    blurb: "World-class hospitals if you are insured, bankruptcy if you are not. High pay, thin safety net.",
  },
  "United Kingdom": {
    region: "europe", care: "universal", careQuality: 74, childRisk: 0.95, adultRisk: 0.95, elderRisk: 1, infection: 1,
    disasters: ["flood", "heatwave"], conflict: 0.01, volatility: 0.9, language: "English", entry: 66,
    blurb: "Free public healthcare with long waits. A stable democracy with a stormy economy.",
  },
  Canada: {
    region: "north_america", care: "universal", careQuality: 80, childRisk: 0.9, adultRisk: 0.95, elderRisk: 0.95, infection: 1,
    disasters: ["wildfire", "flood"], conflict: 0.005, volatility: 0.8, language: "English", entry: 42,
    blurb: "Public healthcare, cold winters and an immigration system that actively wants workers.",
  },
  Australia: {
    region: "oceania", care: "universal", careQuality: 83, childRisk: 0.85, adultRisk: 0.9, elderRisk: 0.9, infection: 0.95,
    disasters: ["wildfire", "flood", "heatwave", "drought"], conflict: 0.004, volatility: 0.8, language: "English", entry: 55,
    blurb: "Sunny, safe and long-lived, but the country burns and floods more each decade.",
  },
  Germany: {
    region: "europe", care: "universal", careQuality: 86, childRisk: 0.8, adultRisk: 0.95, elderRisk: 0.95, infection: 0.95,
    disasters: ["flood", "heatwave"], conflict: 0.008, volatility: 0.8, language: "German", entry: 50,
    blurb: "Statutory health insurance that covers nearly everyone. Industrial, orderly, exposed to energy shocks.",
  },
  France: {
    region: "europe", care: "universal", careQuality: 86, childRisk: 0.8, adultRisk: 0.95, elderRisk: 0.9, infection: 0.95,
    disasters: ["heatwave", "flood", "wildfire"], conflict: 0.01, volatility: 0.9, language: "French", entry: 60,
    blurb: "Excellent public healthcare, strong unions, frequent strikes, hot summers.",
  },
  Japan: {
    region: "east_asia", care: "universal", careQuality: 91, childRisk: 0.5, adultRisk: 0.75, elderRisk: 0.75, infection: 0.85,
    disasters: ["earthquake", "typhoon"], conflict: 0.006, volatility: 0.7, language: "Japanese", entry: 86,
    blurb: "The longest lives on Earth. Quakes and typhoons, a shrinking population and a very closed door.",
  },
  India: {
    region: "south_asia", care: "private", careQuality: 42, childRisk: 4.5, adultRisk: 1.9, elderRisk: 1.35, infection: 2,
    disasters: ["flood", "heatwave", "drought"], conflict: 0.04, volatility: 1.2, language: "Hindi", entry: 45,
    blurb: "Superb private hospitals for those who can pay, overstretched public ones for the rest. Fast growth, heat and monsoons.",
  },
  Brazil: {
    region: "latin_america", care: "private", careQuality: 52, childRisk: 2.5, adultRisk: 1.6, elderRisk: 1.1, infection: 1.5,
    disasters: ["flood", "drought"], conflict: 0.03, volatility: 1.5, language: "Portuguese", entry: 36,
    blurb: "A free public health service that is patchy, and violence that shortens young lives. Volatile currency.",
  },
  Mexico: {
    region: "latin_america", care: "private", careQuality: 52, childRisk: 2.2, adultRisk: 1.6, elderRisk: 1.1, infection: 1.4,
    disasters: ["earthquake", "hurricane", "drought"], conflict: 0.035, volatility: 1.3, language: "Spanish", entry: 40,
    blurb: "Public care is thin; most people pay for private. Quakes, hurricanes and cartel violence.",
  },
  Spain: {
    region: "europe", care: "universal", careQuality: 86, childRisk: 0.7, adultRisk: 0.85, elderRisk: 0.8, infection: 0.95,
    disasters: ["heatwave", "wildfire", "drought"], conflict: 0.008, volatility: 1.1, language: "Spanish", entry: 46,
    blurb: "Universal healthcare and some of the longest lives in Europe. Youth unemployment is high.",
  },
  Sweden: {
    region: "europe", care: "universal", careQuality: 88, childRisk: 0.5, adultRisk: 0.8, elderRisk: 0.85, infection: 0.9,
    disasters: ["flood"], conflict: 0.006, volatility: 0.7, language: "Swedish", entry: 56,
    blurb: "A generous welfare state with the highest taxes on the list. Safe, quiet and dark in winter.",
  },
  Netherlands: {
    region: "europe", care: "universal", careQuality: 88, childRisk: 0.55, adultRisk: 0.85, elderRisk: 0.85, infection: 0.9,
    disasters: ["flood"], conflict: 0.005, volatility: 0.7, language: "Dutch", entry: 54,
    blurb: "Compulsory insurance, bicycles and a low country that depends on its dykes.",
  },
  Nigeria: {
    region: "africa", care: "private", careQuality: 25, childRisk: 10, adultRisk: 3, elderRisk: 1.8, infection: 3,
    disasters: ["flood", "drought"], conflict: 0.09, volatility: 1.6, language: "English", entry: 30,
    blurb: "Malaria, thin public clinics and costly private ones. Africa's biggest economy, with a volatile naira and regional insecurity.",
  },
  "South Korea": {
    region: "east_asia", care: "universal", careQuality: 89, childRisk: 0.5, adultRisk: 0.8, elderRisk: 0.8, infection: 0.9,
    disasters: ["typhoon", "flood", "heatwave"], conflict: 0.02, volatility: 0.9, language: "Korean", entry: 80,
    blurb: "National health insurance, brutal exam culture and a long-running standoff with the North.",
  },
  Italy: {
    region: "europe", care: "universal", careQuality: 83, childRisk: 0.6, adultRisk: 0.85, elderRisk: 0.8, infection: 0.95,
    disasters: ["earthquake", "heatwave", "flood"], conflict: 0.008, volatility: 1.2, language: "Italian", entry: 56,
    blurb: "A national health service that is strong in the north and strained in the south. Quakes and sluggish growth.",
  },
};

const FALLBACK: CountryProfile = COUNTRY_PROFILES["United States"];

export const profileOf = (country: string): CountryProfile => COUNTRY_PROFILES[country] ?? FALLBACK;

export const REGION_LABEL: Record<Region, string> = {
  north_america: "North America",
  europe: "Europe",
  east_asia: "East Asia",
  south_asia: "South Asia",
  latin_america: "Latin America",
  africa: "Africa",
  oceania: "Oceania",
};

/** Countries that share a region with `country` (excluding itself). */
export const neighboursOf = (country: string): string[] => {
  const r = profileOf(country).region;
  return Object.keys(COUNTRY_PROFILES).filter((c) => c !== country && COUNTRY_PROFILES[c].region === r);
};
