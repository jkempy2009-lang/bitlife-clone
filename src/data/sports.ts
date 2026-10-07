/** Sport definitions for the athlete career system: age curves, pay, injuries and league structure. */

export const SPORTS = ["Soccer", "Basketball", "Tennis", "Boxing", "Golf", "Swimming", "Gymnastics"] as const;
export type Sport = (typeof SPORTS)[number];

export interface SportInfo {
  emoji: string;
  blurb: string;
  /** What scouts look for / what the sport punishes. */
  traits: string[];
  /** Team sport (league table) or individual (rankings, tournaments). */
  team: boolean;
  /** First and last age of the physical prime. */
  peak: [number, number];
  /** Rating points lost in the first year past the prime; accelerates every year after. */
  decline: number;
  /** Annual base injury chance before modifiers. */
  injury: number;
  /** Beyond this age almost nobody is still competing. */
  maxAge: number;
  /** Salary multiplier versus the baseline scale. */
  pay: number;
  /** Endorsement multiplier. */
  endorse: number;
  /** Names for league tiers 0..3 (semi-pro, second tier, top flight, elite). */
  leagues: [string, string, string, string];
  /** Job titles for tiers 0..3. */
  titles: [string, string, string, string];
  collegeLabel: string;
  /** Names for the four injury severities. */
  injuries: [string, string, string, string];
  award: string;
  /** A major tournament: every 4 years at `year % 4 === offset`. */
  major: { name: string; offset: number };
  clubNouns: string[];
  /** Typical retirement scale label for the UI. */
  careerLength: string;
}

export const SPORT_INFO: Record<Sport, SportInfo> = {
  Soccer: {
    emoji: "⚽",
    blurb: "The world's game. Huge talent pool, brutal pyramid, rich at the top and poor everywhere else.",
    traits: ["Stamina and consistency", "Mid-career peak", "Roughly one in six players is hurt each season"],
    team: true,
    peak: [23, 30],
    decline: 2.3,
    injury: 0.15,
    maxAge: 38,
    pay: 1,
    endorse: 1.4,
    leagues: ["Lower Leagues", "Second Division", "Top Flight", "Champions Circuit"],
    titles: ["Lower-League Player", "Second-Division Pro", "Top-Flight Pro", "International Star"],
    collegeLabel: "Club academy",
    injuries: ["Hamstring strain", "Ankle ligament sprain", "ACL rupture", "Double leg fracture"],
    award: "Golden Boot",
    major: { name: "World Cup", offset: 2 },
    clubNouns: ["United", "Rovers", "Athletic", "FC", "City"],
    careerLength: "about 15 years",
  },
  Basketball: {
    emoji: "🏀",
    blurb: "Height helps, hops help more. Enormous contracts for the few who make the top league.",
    traits: ["Athleticism", "Mid-career peak", "Knees and ankles take a beating"],
    team: true,
    peak: [24, 30],
    decline: 2.3,
    injury: 0.15,
    maxAge: 38,
    pay: 1.6,
    endorse: 1.5,
    leagues: ["Development League", "Overseas Pro League", "National League", "All-Star Circuit"],
    titles: ["Development Player", "Overseas Pro", "National League Player", "All-Star"],
    collegeLabel: "College team",
    injuries: ["Jammed finger", "Sprained ankle", "Torn ACL", "Shattered tibia"],
    award: "MVP",
    major: { name: "Olympics", offset: 0 },
    clubNouns: ["Hoops", "Titans", "Kings", "Storm", "Wolves"],
    careerLength: "about 12 years",
  },
  Tennis: {
    emoji: "🎾",
    blurb: "Alone on court with no team to blame. The tour is a grind, and only the top handful get rich.",
    traits: ["Mental toughness", "Late-twenties peak", "Prize money, not salaries: the lower rungs barely break even"],
    team: false,
    peak: [22, 29],
    decline: 2.4,
    injury: 0.1,
    maxAge: 37,
    pay: 0.9,
    endorse: 1.7,
    leagues: ["Satellite Circuit", "Challenger Tour", "Pro Tour", "Grand Slam Elite"],
    titles: ["Circuit Player", "Challenger Pro", "Tour Pro", "Grand Slam Contender"],
    collegeLabel: "College team",
    injuries: ["Wrist strain", "Tennis elbow", "Torn rotator cuff", "Chronic back disc injury"],
    award: "Player of the Year",
    major: { name: "Olympics", offset: 0 },
    clubNouns: ["Racquet Club", "Tennis Team", "Baseline Club", "Open Academy"],
    careerLength: "about 12 years",
  },
  Boxing: {
    emoji: "🥊",
    blurb: "Short careers, big purses, and a body that pays the bill later. Every round is a risk.",
    traits: ["Power and chin", "Prime in the late twenties", "Highest injury rate of any sport here"],
    team: false,
    peak: [23, 31],
    decline: 3,
    injury: 0.22,
    maxAge: 40,
    pay: 0.8,
    endorse: 1.2,
    leagues: ["Regional Cards", "National Contender", "Title Fights", "Pay-Per-View Headliner"],
    titles: ["Club Fighter", "National Contender", "Title Contender", "Champion"],
    collegeLabel: "Amateur squad",
    injuries: ["Broken hand", "Cut and swollen eye", "Fractured orbital bone", "Detached retina"],
    award: "Fighter of the Year",
    major: { name: "Olympics", offset: 0 },
    clubNouns: ["Boxing Gym", "Fight Club", "Corner Team", "Pugilists"],
    careerLength: "about 12 years",
  },
  Golf: {
    emoji: "⛳",
    blurb: "The slow burn. Peaks late, lasts long, and the injury risk is low. The money is all in the top tour.",
    traits: ["Touch and composure", "Peaks after 27 and stays there", "Gentle on the body"],
    team: false,
    peak: [27, 42],
    decline: 1.4,
    injury: 0.04,
    maxAge: 56,
    pay: 0.9,
    endorse: 1.5,
    leagues: ["Mini-Tours", "Development Tour", "Pro Tour", "Major Contender"],
    titles: ["Mini-Tour Player", "Development Pro", "Tour Pro", "Major Champion Contender"],
    collegeLabel: "College team",
    injuries: ["Wrist tendonitis", "Back spasms", "Herniated disc", "Degenerative spine condition"],
    award: "Player of the Year",
    major: { name: "Olympics", offset: 0 },
    clubNouns: ["Golf Club", "Links Team", "Country Club", "Fairways"],
    careerLength: "up to 25 years",
  },
  Swimming: {
    emoji: "🏊",
    blurb: "Early peak, quiet fame outside Olympic years, and not much money beyond the very best.",
    traits: ["Early-twenties peak", "Low injury risk", "Pay is modest: sponsorships matter"],
    team: false,
    peak: [18, 25],
    decline: 2.8,
    injury: 0.06,
    maxAge: 32,
    pay: 0.35,
    endorse: 1.4,
    leagues: ["Club Meets", "National Squad", "World Series", "Olympic Elite"],
    titles: ["Club Swimmer", "National Squad Swimmer", "World Series Swimmer", "Olympic Elite"],
    collegeLabel: "College team",
    injuries: ["Swimmer's shoulder", "Ear infection", "Torn labrum", "Stress fracture in the spine"],
    award: "Swimmer of the Year",
    major: { name: "Olympics", offset: 0 },
    clubNouns: ["Aquatics", "Swim Club", "Dolphins", "Splash Team"],
    careerLength: "about 10 years",
  },
  Gymnastics: {
    emoji: "🤸",
    blurb: "The earliest peak of all. A teenage sport with a short window and almost no salary: fame is the paycheque.",
    traits: ["Peaks in the late teens", "Hard on joints and growth plates", "Almost no salary, endorsements carry you"],
    team: false,
    peak: [15, 22],
    decline: 3.5,
    injury: 0.17,
    maxAge: 29,
    pay: 0.25,
    endorse: 1.8,
    leagues: ["Club Meets", "National Squad", "World Cup Series", "Olympic Elite"],
    titles: ["Club Gymnast", "National Squad Gymnast", "World Cup Gymnast", "Olympic Elite"],
    collegeLabel: "Elite academy",
    injuries: ["Wrist sprain", "Ankle sprain", "Torn Achilles", "Spinal fracture"],
    award: "Gymnast of the Year",
    major: { name: "Olympics", offset: 0 },
    clubNouns: ["Gymnastics", "Flyers", "Tumblers", "Gym Club"],
    careerLength: "about 8 years",
  },
};

export const isSport = (s: string | null | undefined): s is Sport => !!s && (SPORTS as readonly string[]).includes(s);
export const sportInfo = (s: string | null | undefined): SportInfo => SPORT_INFO[isSport(s) ? s : "Soccer"];

/** Minimum rating for each league tier. */
export const LEAGUE_MIN = [48, 62, 74, 86] as const;
/** Annual salary at a league's minimum rating, before the sport multiplier. */
export const LEAGUE_BASE_SALARY = [26_000, 90_000, 420_000, 2_600_000] as const;

export const CITY_PREFIXES = [
  "Metro", "Harbor", "Capital", "Pacific", "Northern", "Riverside", "Lakeside", "Summit", "Iron", "Golden",
  "Eastgate", "Westbrook", "Bayview", "Crown", "Redstone", "Hillcrest", "Granite", "Silver", "Coastal", "Unity",
];

/** Coach and pundit positions for retired athletes (registry lines are hidden from the job board). */
export const POST_CAREER_LINES = { coach: "sports_coach", pundit: "sports_pundit" } as const;
