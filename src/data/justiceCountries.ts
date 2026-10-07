/** How each country's justice system behaves. Kept separate from countries.ts (names, tax, cities). */
export interface LawProfile {
  /** Police presence: scales the odds of being caught (1 = baseline). */
  policing: number;
  /** 0-1: how far money talks. Drives bribery success. */
  corruption: number;
  /** Sentence multiplier (1 = baseline). */
  harshness: number;
  deathPenalty: boolean;
  /** Compensation per wrongful year served, if the state pays at all. */
  compensation: number;
  /** Felons are refused entry here. */
  strictBorders: boolean;
}

const DEFAULT: LawProfile = { policing: 1, corruption: 0.25, harshness: 1, deathPenalty: false, compensation: 20_000, strictBorders: false };

export const LAW: Record<string, LawProfile> = {
  "United States": { policing: 1.1, corruption: 0.2, harshness: 1.35, deathPenalty: true, compensation: 50_000, strictBorders: true },
  "United Kingdom": { policing: 1.15, corruption: 0.1, harshness: 0.9, deathPenalty: false, compensation: 40_000, strictBorders: true },
  Canada: { policing: 1.0, corruption: 0.1, harshness: 0.8, deathPenalty: false, compensation: 60_000, strictBorders: true },
  Australia: { policing: 1.0, corruption: 0.12, harshness: 0.9, deathPenalty: false, compensation: 45_000, strictBorders: true },
  Germany: { policing: 1.0, corruption: 0.1, harshness: 0.75, deathPenalty: false, compensation: 30_000, strictBorders: false },
  France: { policing: 1.05, corruption: 0.2, harshness: 0.85, deathPenalty: false, compensation: 30_000, strictBorders: false },
  Japan: { policing: 1.2, corruption: 0.1, harshness: 1.0, deathPenalty: true, compensation: 25_000, strictBorders: true },
  India: { policing: 0.8, corruption: 0.6, harshness: 1.0, deathPenalty: true, compensation: 5_000, strictBorders: false },
  Brazil: { policing: 0.75, corruption: 0.6, harshness: 1.2, deathPenalty: false, compensation: 8_000, strictBorders: false },
  Mexico: { policing: 0.7, corruption: 0.7, harshness: 1.1, deathPenalty: false, compensation: 6_000, strictBorders: false },
  Spain: { policing: 1.0, corruption: 0.25, harshness: 0.85, deathPenalty: false, compensation: 25_000, strictBorders: false },
  Sweden: { policing: 1.05, corruption: 0.05, harshness: 0.6, deathPenalty: false, compensation: 45_000, strictBorders: false },
  Netherlands: { policing: 1.0, corruption: 0.08, harshness: 0.65, deathPenalty: false, compensation: 40_000, strictBorders: false },
  Nigeria: { policing: 0.7, corruption: 0.75, harshness: 1.1, deathPenalty: true, compensation: 2_000, strictBorders: false },
  "South Korea": { policing: 1.1, corruption: 0.25, harshness: 0.95, deathPenalty: false, compensation: 25_000, strictBorders: true },
  Italy: { policing: 0.95, corruption: 0.35, harshness: 0.9, deathPenalty: false, compensation: 20_000, strictBorders: false },
};

export const lawFor = (country: string): LawProfile => LAW[country] ?? DEFAULT;
