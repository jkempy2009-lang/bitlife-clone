/**
 * The statute book a politician can write: concrete bills with concrete consequences.
 * Every bill belongs to one of the five political issues and to one side of it (-1 left, 0 centre, +1 right);
 * a politician can only push bills that match the position they have publicly staked out.
 * Effects land on the nation's indicators (and, for criminal-justice bills, on the justice system itself).
 */
export type IndicatorId = "prosperity" | "health" | "environment" | "safety" | "liberty" | "finances";
export type IssueKey = "economy" | "health" | "environment" | "security" | "liberty";

/** How the country's justice system shifts when the bill is law. Added to the country's profile. */
export interface LawDelta {
  policing?: number;
  corruption?: number;
  harshness?: number;
  compensation?: number;
  /** Force the death penalty on or off. */
  deathPenalty?: boolean;
}

export interface LawDef {
  id: string;
  issue: IssueKey;
  /** -1 left, 0 centre, +1 right: the position you must hold to push it. */
  stance: -1 | 0 | 1;
  name: string;
  blurb: string;
  /** Lowest office from which it can be proposed (0 council, 1 mayor, 2 governor, 3 senator, 4 head of state). */
  minTier: number;
  /** 0 (a formality) to 1 (a fight): raises the votes needed. */
  opposition: number;
  /** Steady-state change to each indicator once fully in force, at the scale of a senator. */
  effects: Partial<Record<IndicatorId, number>>;
  law?: LawDelta;
}

export const INDICATORS: { id: IndicatorId; name: string; emoji: string; blurb: string }[] = [
  { id: "prosperity", name: "Prosperity", emoji: "💰", blurb: "Jobs, wages and growth." },
  { id: "health", name: "Public health", emoji: "🏥", blurb: "Access to care and life expectancy." },
  { id: "environment", name: "Environment", emoji: "🌍", blurb: "Clean air, water and land." },
  { id: "safety", name: "Public safety", emoji: "🚓", blurb: "How safe people feel on the street." },
  { id: "liberty", name: "Civil liberty", emoji: "🗽", blurb: "Privacy, speech and fair treatment." },
  { id: "finances", name: "Public finances", emoji: "🏦", blurb: "Budget balance. Below 20 means a fiscal crisis." },
];

/** Which indicators matter to voters of each issue. */
export const ISSUE_INDICATORS: Record<IssueKey, IndicatorId[]> = {
  economy: ["prosperity", "finances"],
  health: ["health"],
  environment: ["environment"],
  security: ["safety"],
  liberty: ["liberty"],
};

export const LAWS: LawDef[] = [
  // ---------- economy ----------
  { id: "living_wage", issue: "economy", stance: -1, minTier: 0, opposition: 0.3, name: "Living wage ordinance", blurb: "Raise the local minimum wage.", effects: { prosperity: 2, health: 1, finances: -2 } },
  { id: "public_works", issue: "economy", stance: -1, minTier: 0, opposition: 0.3, name: "Public works programme", blurb: "Build roads and schools, hire locally.", effects: { prosperity: 4, finances: -4 } },
  { id: "wealth_tax", issue: "economy", stance: -1, minTier: 2, opposition: 0.65, name: "Wealth tax", blurb: "A levy on the largest fortunes. Business will not forgive it.", effects: { finances: 8, prosperity: -3 } },
  { id: "small_biz", issue: "economy", stance: 1, minTier: 0, opposition: 0.25, name: "Small-business tax break", blurb: "Cut red tape and taxes for local firms.", effects: { prosperity: 3, finances: -2 } },
  { id: "tax_cut", issue: "economy", stance: 1, minTier: 2, opposition: 0.5, name: "Income tax cut", blurb: "Put more money in pockets, and a hole in the budget.", effects: { prosperity: 5, finances: -6 } },
  { id: "deregulation", issue: "economy", stance: 1, minTier: 2, opposition: 0.5, name: "Deregulation act", blurb: "Strip back rules on industry. Growth now, bills later.", effects: { prosperity: 4, environment: -3, safety: -1 } },
  { id: "balanced_budget", issue: "economy", stance: 0, minTier: 1, opposition: 0.35, name: "Balanced budget act", blurb: "Hard spending caps and a rainy-day fund.", effects: { finances: 6, prosperity: -1 } },
  // ---------- health ----------
  { id: "free_clinics", issue: "health", stance: -1, minTier: 0, opposition: 0.3, name: "Free neighbourhood clinics", blurb: "A clinic in every district.", effects: { health: 3, finances: -2 } },
  { id: "universal_care", issue: "health", stance: -1, minTier: 2, opposition: 0.7, name: "Universal care", blurb: "A public health service free at the point of use.", effects: { health: 9, finances: -6, prosperity: 1 } },
  { id: "hsa_vouchers", issue: "health", stance: 1, minTier: 1, opposition: 0.35, name: "Health savings vouchers", blurb: "Let patients shop for care with tax-free accounts.", effects: { health: 3, finances: -1, prosperity: 1 } },
  { id: "private_hospitals", issue: "health", stance: 1, minTier: 2, opposition: 0.5, name: "Private hospital licences", blurb: "Open the system to private operators.", effects: { health: 2, prosperity: 3, finances: 2 } },
  { id: "insurance_mandate", issue: "health", stance: 0, minTier: 2, opposition: 0.4, name: "Insurance mandate", blurb: "Everyone must be covered, by competing insurers.", effects: { health: 5, finances: -2 } },
  // ---------- environment ----------
  { id: "clean_air", issue: "environment", stance: -1, minTier: 0, opposition: 0.25, name: "Clean air ordinance", blurb: "Low-emission zones and a recycling mandate.", effects: { environment: 3, prosperity: -1 } },
  { id: "carbon_tax", issue: "environment", stance: -1, minTier: 3, opposition: 0.65, name: "Carbon tax", blurb: "Make polluters pay. Prices rise before the air clears.", effects: { environment: 8, finances: 3, prosperity: -4 } },
  { id: "green_fund", issue: "environment", stance: -1, minTier: 2, opposition: 0.5, name: "Green transition fund", blurb: "Public money for renewables and retraining.", effects: { environment: 5, prosperity: 1, finances: -4 } },
  { id: "drilling", issue: "environment", stance: 1, minTier: 2, opposition: 0.5, name: "Drilling and mining leases", blurb: "Open public land to extraction.", effects: { prosperity: 4, finances: 3, environment: -6, health: -1 } },
  { id: "fast_permits", issue: "environment", stance: 1, minTier: 1, opposition: 0.3, name: "Fast-track permits", blurb: "Approve building projects in months, not years.", effects: { prosperity: 3, environment: -3 } },
  { id: "emission_standards", issue: "environment", stance: 0, minTier: 2, opposition: 0.4, name: "Emissions standards", blurb: "Gradual, predictable limits on industry.", effects: { environment: 4, prosperity: -2 } },
  // ---------- security ----------
  { id: "community_policing", issue: "security", stance: -1, minTier: 0, opposition: 0.3, name: "Community policing", blurb: "Officers who know the neighbourhood, and oversight boards.", effects: { safety: 2, liberty: 2, finances: -1 }, law: { policing: -0.02, harshness: -0.04 } },
  { id: "sentencing_reform", issue: "security", stance: -1, minTier: 2, opposition: 0.6, name: "Sentencing reform", blurb: "Shorter terms for minor offences, better pay-outs for the wrongly convicted.", effects: { liberty: 3, safety: -1, finances: 2 }, law: { harshness: -0.2, compensation: 15_000 } },
  { id: "abolish_death_penalty", issue: "security", stance: -1, minTier: 3, opposition: 0.6, name: "Abolish the death penalty", blurb: "No more executions, ever.", effects: { liberty: 4 }, law: { deathPenalty: false } },
  { id: "more_police", issue: "security", stance: 1, minTier: 0, opposition: 0.25, name: "More police on the street", blurb: "Hire hundreds of officers.", effects: { safety: 3, finances: -3 }, law: { policing: 0.06 } },
  { id: "mandatory_minimums", issue: "security", stance: 1, minTier: 2, opposition: 0.55, name: "Mandatory minimum sentences", blurb: "Judges lose discretion; sentences get longer.", effects: { safety: 3, liberty: -3, finances: -2 }, law: { harshness: 0.2 } },
  { id: "reinstate_death_penalty", issue: "security", stance: 1, minTier: 3, opposition: 0.65, name: "Reinstate the death penalty", blurb: "Capital punishment for the worst crimes.", effects: { safety: 1, liberty: -3 }, law: { deathPenalty: true } },
  { id: "anti_corruption", issue: "security", stance: 0, minTier: 2, opposition: 0.45, name: "Anti-corruption commission", blurb: "An independent body with subpoena powers. It will come for friends of yours too.", effects: { finances: 3, prosperity: 1 }, law: { corruption: -0.15, policing: 0.03 } },
  // ---------- liberty ----------
  { id: "privacy_act", issue: "liberty", stance: -1, minTier: 1, opposition: 0.4, name: "Privacy act", blurb: "Limits on data collection and police searches.", effects: { liberty: 5, safety: -1 }, law: { policing: -0.02 } },
  { id: "decriminalise", issue: "liberty", stance: -1, minTier: 2, opposition: 0.55, name: "Decriminalise minor offences", blurb: "Fines and treatment instead of cells for petty crime.", effects: { liberty: 3, safety: -2, finances: 2 }, law: { harshness: -0.1 } },
  { id: "speech_charter", issue: "liberty", stance: -1, minTier: 3, opposition: 0.5, name: "Free-speech charter", blurb: "Constitutional protection for dissent and the press.", effects: { liberty: 6 } },
  { id: "surveillance", issue: "liberty", stance: 1, minTier: 2, opposition: 0.5, name: "Surveillance powers", blurb: "Wide powers to monitor communications.", effects: { safety: 4, liberty: -6 }, law: { policing: 0.1 } },
  { id: "public_order", issue: "liberty", stance: 1, minTier: 1, opposition: 0.35, name: "Public order act", blurb: "Tighter rules on protests and gatherings.", effects: { safety: 3, liberty: -3 } },
  { id: "civil_rights_deal", issue: "liberty", stance: 0, minTier: 2, opposition: 0.4, name: "Civil rights compromise", blurb: "A modest charter both sides can live with.", effects: { liberty: 2, safety: 1 } },
];

export const LAW_BY_ID: Record<string, LawDef> = Object.fromEntries(LAWS.map((l) => [l.id, l]));

/** How much of a bill's effect an office can deliver: a council ordinance is not national policy. */
export const TIER_SCALE = [0.3, 0.5, 0.8, 1, 1.2];

/** Pairs of laws that cannot both stand: passing one repeals the other. */
const CONFLICT_PAIRS: [string, string][] = [
  ["wealth_tax", "tax_cut"],
  ["universal_care", "private_hospitals"],
  ["universal_care", "hsa_vouchers"],
  ["carbon_tax", "drilling"],
  ["green_fund", "drilling"],
  ["sentencing_reform", "mandatory_minimums"],
  ["decriminalise", "mandatory_minimums"],
  ["abolish_death_penalty", "reinstate_death_penalty"],
  ["privacy_act", "surveillance"],
  ["speech_charter", "public_order"],
  ["clean_air", "fast_permits"],
];

export const conflictsOf = (id: string): string[] =>
  CONFLICT_PAIRS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));
