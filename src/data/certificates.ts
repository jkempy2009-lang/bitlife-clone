/** Short vocational courses: a realistic way into a field without a four-year degree. */
export interface Certificate {
  id: string;
  name: string;
  emoji: string;
  years: number;
  tuition: number;
  minSmarts: number;
  blurb: string;
  /** Career lines this unlocks (the line's degree list includes `cert:<id>`), or experience it grants. */
  unlocks: string;
  /** Years of field experience credited on completion (apprenticeships). */
  experience?: Record<string, number>;
}

export const CERTIFICATES: Certificate[] = [
  { id: "bootcamp", name: "Coding Bootcamp", emoji: "💻", years: 1, tuition: 12_000, minSmarts: 40, blurb: "An intense year of code. Opens Technology and Game Development.", unlocks: "software, gamedev" },
  { id: "nursing", name: "Nursing Diploma", emoji: "🩺", years: 2, tuition: 9_000, minSmarts: 45, blurb: "Hospital placements and long shifts. Opens Healthcare Nursing.", unlocks: "nurse" },
  { id: "pilot", name: "Commercial Pilot Licence", emoji: "✈️", years: 2, tuition: 28_000, minSmarts: 55, blurb: "Flight hours aren't cheap. Opens Aviation without a degree.", unlocks: "pilot" },
  { id: "apprentice", name: "Trade Apprenticeship", emoji: "🔧", years: 2, tuition: 2_000, minSmarts: 20, blurb: "Learn on site under a master. Counts as 3 years of experience in construction, trades and auto repair.", unlocks: "trades, construction, mechanic", experience: { construction: 3, trades: 3, mechanic: 3 } },
];

export const CERT_BY_ID: Record<string, Certificate> = Object.fromEntries(CERTIFICATES.map((c) => [c.id, c]));
