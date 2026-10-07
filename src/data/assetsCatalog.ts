/** Real estate archetypes, car dealerships and dynamic maintenance weights. */

export interface VehicleArchetype {
  id: string;
  name: string;
  emoji: string;
  basePrice: number;
  /** Multiplier on the standard 3% annual maintenance fee. */
  maintenanceWeight: number;
  /** Used cars: [minCondition, maxCondition]. New cars are always 100. */
  usedCondition?: [number, number];
  minAge: number;
}

export const VEHICLE_ARCHETYPES: VehicleArchetype[] = [
  { id: "beater", name: "Used Beater", emoji: "🚙", basePrice: 3_500, maintenanceWeight: 1.8, usedCondition: [25, 55], minAge: 16 },
  { id: "budget_sedan", name: "Budget Sedan", emoji: "🚗", basePrice: 19_000, maintenanceWeight: 0.8, minAge: 16 },
  { id: "hatchback", name: "Compact Hatchback", emoji: "🚘", basePrice: 23_000, maintenanceWeight: 0.8, minAge: 16 },
  { id: "pickup", name: "Work Pickup Truck", emoji: "🛻", basePrice: 46_000, maintenanceWeight: 1, minAge: 16 },
  { id: "suv", name: "Family SUV", emoji: "🚐", basePrice: 52_000, maintenanceWeight: 1, minAge: 16 },
  { id: "luxury_sedan", name: "Luxury Sedan", emoji: "🏎️", basePrice: 95_000, maintenanceWeight: 1.4, minAge: 18 },
  { id: "sports_car", name: "Sports Car", emoji: "🏁", basePrice: 140_000, maintenanceWeight: 1.6, minAge: 18 },
  { id: "classic", name: "Vintage Classic", emoji: "🚓", basePrice: 70_000, maintenanceWeight: 2.2, usedCondition: [45, 80], minAge: 18 },
  { id: "supercar", name: "Exotic Supercar", emoji: "🏎️", basePrice: 380_000, maintenanceWeight: 2, minAge: 18 },
  { id: "hypercar", name: "Limited-Run Hypercar", emoji: "⚡", basePrice: 2_400_000, maintenanceWeight: 2.5, minAge: 18 },
];

export interface PropertyArchetype {
  id: string;
  name: string;
  emoji: string;
  basePrice: number;
  beds: number;
  baths: number;
  sqft: number;
  blurb: string;
  /** [min, max] starting condition. */
  condition: [number, number];
  minAge: number;
}

export const PROPERTY_ARCHETYPES: PropertyArchetype[] = [
  { id: "studio", name: "Downtown Studio", emoji: "🏢", basePrice: 130_000, beds: 0, baths: 1, sqft: 480, blurb: "Cosy. Very cosy.", condition: [55, 90], minAge: 18 },
  { id: "condo", name: "Riverside Condo", emoji: "🏬", basePrice: 245_000, beds: 2, baths: 2, sqft: 950, blurb: "Gym in the lobby, noisy neighbours upstairs.", condition: [60, 95], minAge: 18 },
  { id: "starter", name: "Starter Home", emoji: "🏠", basePrice: 310_000, beds: 3, baths: 2, sqft: 1_400, blurb: "A small yard and a big dream.", condition: [50, 90], minAge: 18 },
  { id: "suburban", name: "Suburban House", emoji: "🏡", basePrice: 520_000, beds: 4, baths: 3, sqft: 2_400, blurb: "Two-car garage, cul-de-sac included.", condition: [65, 95], minAge: 18 },
  { id: "townhouse", name: "Historic Townhouse", emoji: "🏘️", basePrice: 780_000, beds: 4, baths: 3, sqft: 2_100, blurb: "Creaky floors with character.", condition: [40, 80], minAge: 18 },
  { id: "beach", name: "Beachfront Villa", emoji: "🏖️", basePrice: 1_650_000, beds: 5, baths: 4, sqft: 3_800, blurb: "Wake up to waves. Salt air eats everything.", condition: [70, 98], minAge: 18 },
  { id: "penthouse", name: "Skyline Penthouse", emoji: "🌆", basePrice: 4_800_000, beds: 4, baths: 5, sqft: 4_200, blurb: "The city sparkles at your feet.", condition: [85, 100], minAge: 18 },
  { id: "mansion", name: "Sprawling Mansion", emoji: "🏰", basePrice: 12_000_000, beds: 10, baths: 12, sqft: 14_000, blurb: "A staff of twelve and a ballroom.", condition: [80, 100], minAge: 18 },
  { id: "castle", name: "Medieval Castle", emoji: "🏯", basePrice: 45_000_000, beds: 30, baths: 18, sqft: 60_000, blurb: "Moat sold separately. (It isn't.)", condition: [45, 85], minAge: 18 },
  { id: "island", name: "Private Island", emoji: "🏝️", basePrice: 120_000_000, beds: 12, baths: 14, sqft: 22_000, blurb: "Your own flag is optional.", condition: [80, 100], minAge: 18 },
];

export const MORTGAGE_RATE = 0.065;
export const MORTGAGE_YEARS = 30;
export const CAR_LOAN_RATE = 0.07;
export const CAR_LOAN_YEARS = 5;

/** Standard amortised annual payment. */
export function annualPayment(principal: number, rate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = rate;
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -years)));
}
