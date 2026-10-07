/**
 * Business archetypes. Each has its own unit economics: revenue per location at full demand and full staffing,
 * gross margin, fixed costs (rent, utilities, licences), labour needs and wages, sensitivity to the economy, and how
 * dependent the business is on its owner. The yearly simulation lives in src/engine/businessModel.ts.
 */
import type { Skills } from "@/types/game.types";

export interface BusinessType {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Startup capital. Roughly `startCash` of it becomes working cash, the rest premises and equipment. */
  cost: number;
  startCash: number;
  minSmarts: number;
  skill?: { key: keyof Skills; min: number; label: string };
  /** Revenue per location at full demand and full staffing. */
  baseRev: number;
  /** Gross margin after cost of goods. */
  margin: number;
  /** Yearly rent, utilities and licences per location. */
  fixed: number;
  /** Labour units a location needs to serve full demand (the owner or manager counts as one). */
  ideal: number;
  wage: number;
  /** Yearly pay for a general manager. */
  mgrWage: number;
  maxStaff: number;
  maxLocations: number;
  /** How fast the customer base converges on its target (per year). */
  ramp: number;
  /** Std-dev of the yearly demand shock. */
  vol: number;
  /** Sensitivity to boom / recession (1 = average). */
  cyclical: number;
  /** Incident risk (fire, theft, accident, lawsuit). */
  hazard: number;
  /** How much the business depends on the owner personally (key-person discount, absentee penalty). */
  ownerDep: number;
  /** Baseline marketing spend as a share of revenue. */
  mktNeed: number;
  /** Yearly upkeep as a share of startup cost, per location. */
  upkeep: number;
  /** Earnings multiple range for valuation (low reputation to high reputation). */
  mult: [number, number];
  /** Revenue multiple for growth businesses (startups); 0 = earnings only. */
  revMult: number;
  /** Share of premises/equipment value recovered in a liquidation. */
  assetRatio: number;
  /** Starting local competition 0-100. */
  competition: number;
  startCustomers: number;
  fitMean: number;
  fitSd: number;
  franchise?: { fee: number; royalty: number };
  /** Rough share of founders who go bust or give up within five years under typical play (from simulation; shown in the UI). */
  fail5: number;
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: "foodtruck", name: "Food Truck", emoji: "🚚", blurb: "Cheap to start, brutal hours, loyal fans.",
    cost: 30_000, startCash: 0.3, minSmarts: 15,
    baseRev: 165_000, margin: 0.6, fixed: 30_000, ideal: 2, wage: 29_000, mgrWage: 38_000, maxStaff: 4, maxLocations: 3,
    ramp: 0.5, vol: 0.24, cyclical: 0.6, hazard: 0.8, ownerDep: 0.8, mktNeed: 0.025, upkeep: 0.08,
    mult: [1.2, 2.4], revMult: 0, assetRatio: 0.35, competition: 55, startCustomers: 26, fitMean: 0.92, fitSd: 0.3,
    franchise: { fee: 18_000, royalty: 9_000 },
    fail5: 30,
  },
  {
    id: "onlinestore", name: "Online Store", emoji: "🛒", blurb: "Low overhead, fierce competition, platform whims.",
    cost: 20_000, startCash: 0.45, minSmarts: 30,
    baseRev: 215_000, margin: 0.45, fixed: 18_000, ideal: 1, wage: 38_000, mgrWage: 55_000, maxStaff: 5, maxLocations: 1,
    ramp: 0.5, vol: 0.32, cyclical: 0.8, hazard: 0.4, ownerDep: 0.55, mktNeed: 0.11, upkeep: 0.1,
    mult: [1.5, 3], revMult: 0, assetRatio: 0.15, competition: 80, startCustomers: 18, fitMean: 0.9, fitSd: 0.3,
    fail5: 30,
  },
  {
    id: "boutique", name: "Boutique Shop", emoji: "👗", blurb: "A little store with a lot of taste and a lot of rent.",
    cost: 60_000, startCash: 0.3, minSmarts: 25,
    baseRev: 305_000, margin: 0.5, fixed: 52_000, ideal: 2, wage: 30_000, mgrWage: 48_000, maxStaff: 6, maxLocations: 4,
    ramp: 0.4, vol: 0.2, cyclical: 1.1, hazard: 0.6, ownerDep: 0.6, mktNeed: 0.03, upkeep: 0.07,
    mult: [1.5, 3], revMult: 0, assetRatio: 0.3, competition: 50, startCustomers: 24, fitMean: 0.92, fitSd: 0.3,
    franchise: { fee: 30_000, royalty: 14_000 },
    fail5: 30,
  },
  {
    id: "consultancy", name: "Consultancy", emoji: "📊", blurb: "You are the product. Reputation is everything.",
    cost: 35_000, startCash: 0.6, minSmarts: 55, skill: { key: "charisma", min: 15, label: "Charisma" },
    baseRev: 180_000, margin: 0.9, fixed: 36_000, ideal: 2, wage: 70_000, mgrWage: 110_000, maxStaff: 8, maxLocations: 2,
    ramp: 0.35, vol: 0.3, cyclical: 1.2, hazard: 0.3, ownerDep: 0.95, mktNeed: 0.03, upkeep: 0.04,
    mult: [1.2, 2.8], revMult: 0, assetRatio: 0.08, competition: 45, startCustomers: 14, fitMean: 0.92, fitSd: 0.34,
    fail5: 15,
  },
  {
    id: "farm", name: "Organic Farm", emoji: "🌾", blurb: "Slow, steady, soil under your nails. The land holds its value.",
    cost: 120_000, startCash: 0.2, minSmarts: 20,
    baseRev: 265_000, margin: 0.45, fixed: 40_000, ideal: 2, wage: 30_000, mgrWage: 52_000, maxStaff: 6, maxLocations: 2,
    ramp: 0.3, vol: 0.32, cyclical: 0.3, hazard: 1.1, ownerDep: 0.6, mktNeed: 0.015, upkeep: 0.075,
    mult: [2, 4], revMult: 0, assetRatio: 0.7, competition: 30, startCustomers: 28, fitMean: 1, fitSd: 0.2,
    fail5: 35,
  },
  {
    id: "barcafe", name: "Bar & Cafe", emoji: "☕", blurb: "Coffee by day, cocktails by night. Margins in the drinks.",
    cost: 110_000, startCash: 0.25, minSmarts: 25,
    baseRev: 365_000, margin: 0.64, fixed: 62_000, ideal: 4, wage: 27_000, mgrWage: 46_000, maxStaff: 9, maxLocations: 4,
    ramp: 0.4, vol: 0.2, cyclical: 0.9, hazard: 0.9, ownerDep: 0.7, mktNeed: 0.025, upkeep: 0.08,
    mult: [1.5, 3], revMult: 0, assetRatio: 0.3, competition: 60, startCustomers: 26, fitMean: 1, fitSd: 0.3,
    franchise: { fee: 40_000, royalty: 17_000 },
    fail5: 45,
  },
  {
    id: "restaurant", name: "Restaurant", emoji: "🍽️", blurb: "Thin margins and long nights. Most fail. Yours might not.",
    cost: 150_000, startCash: 0.25, minSmarts: 30,
    baseRev: 535_000, margin: 0.66, fixed: 90_000, ideal: 6, wage: 30_000, mgrWage: 55_000, maxStaff: 12, maxLocations: 4,
    ramp: 0.4, vol: 0.18, cyclical: 1, hazard: 1, ownerDep: 0.7, mktNeed: 0.02, upkeep: 0.075,
    mult: [1.6, 3.2], revMult: 0, assetRatio: 0.3, competition: 65, startCustomers: 26, fitMean: 1, fitSd: 0.27,
    franchise: { fee: 55_000, royalty: 24_000 },
    fail5: 55,
  },
  {
    id: "gym", name: "Gym & Fitness Studio", emoji: "🏋️", blurb: "Memberships are sticky, rent and equipment are not.",
    cost: 140_000, startCash: 0.25, minSmarts: 20, skill: { key: "athletics", min: 25, label: "Athletics" },
    baseRev: 400_000, margin: 0.82, fixed: 112_000, ideal: 4, wage: 30_000, mgrWage: 52_000, maxStaff: 8, maxLocations: 3,
    ramp: 0.36, vol: 0.12, cyclical: 0.5, hazard: 0.8, ownerDep: 0.5, mktNeed: 0.03, upkeep: 0.08,
    mult: [2, 3.8], revMult: 0, assetRatio: 0.35, competition: 55, startCustomers: 20, fitMean: 1, fitSd: 0.24,
    franchise: { fee: 50_000, royalty: 22_000 },
    fail5: 45,
  },
  {
    id: "construction", name: "Construction Firm", emoji: "🏗️", blurb: "Lumpy contracts, heavy liability, cyclical to the bone.",
    cost: 220_000, startCash: 0.3, minSmarts: 30,
    baseRev: 1_050_000, margin: 0.52, fixed: 70_000, ideal: 8, wage: 42_000, mgrWage: 80_000, maxStaff: 16, maxLocations: 3,
    ramp: 0.35, vol: 0.24, cyclical: 1.6, hazard: 1.1, ownerDep: 0.65, mktNeed: 0.01, upkeep: 0.08,
    mult: [2, 4], revMult: 0, assetRatio: 0.45, competition: 55, startCustomers: 22, fitMean: 1, fitSd: 0.22,
    fail5: 45,
  },
  {
    id: "logistics", name: "Logistics & Freight", emoji: "🚛", blurb: "Trucks, fuel and contracts. Scale or die.",
    cost: 300_000, startCash: 0.3, minSmarts: 35,
    baseRev: 1_150_000, margin: 0.58, fixed: 120_000, ideal: 8, wage: 45_000, mgrWage: 85_000, maxStaff: 18, maxLocations: 4,
    ramp: 0.35, vol: 0.22, cyclical: 1.3, hazard: 1.2, ownerDep: 0.45, mktNeed: 0.01, upkeep: 0.09,
    mult: [2.5, 4.5], revMult: 0, assetRatio: 0.5, competition: 60, startCustomers: 22, fitMean: 1, fitSd: 0.2,
    fail5: 50,
  },
  {
    id: "nightclub", name: "Nightclub", emoji: "🪩", blurb: "Glamorous, loud, and legally complicated.",
    cost: 400_000, startCash: 0.25, minSmarts: 30,
    baseRev: 1_300_000, margin: 0.75, fixed: 330_000, ideal: 11, wage: 32_000, mgrWage: 70_000, maxStaff: 20, maxLocations: 3,
    ramp: 0.45, vol: 0.26, cyclical: 1, hazard: 1.4, ownerDep: 0.5, mktNeed: 0.03, upkeep: 0.07,
    mult: [1.5, 3.5], revMult: 0, assetRatio: 0.25, competition: 60, startCustomers: 26, fitMean: 1, fitSd: 0.24,
    fail5: 65,
  },
  {
    id: "startup", name: "Tech Startup", emoji: "🚀", blurb: "Burn cash, raise rounds, chase an exit, or flame out.",
    cost: 250_000, startCash: 0.55, minSmarts: 55,
    baseRev: 3_500_000, margin: 0.8, fixed: 350_000, ideal: 20, wage: 105_000, mgrWage: 160_000, maxStaff: 40, maxLocations: 1,
    ramp: 0.55, vol: 0.35, cyclical: 1.2, hazard: 0.5, ownerDep: 0.6, mktNeed: 0.05, upkeep: 0.03,
    mult: [1, 2.5], revMult: 4, assetRatio: 0.1, competition: 60, startCustomers: 4, fitMean: 0.9, fitSd: 0.5,
    fail5: 90,
  },
];

export const BUSINESS_BY_ID: Record<string, BusinessType> = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.id, b]));
