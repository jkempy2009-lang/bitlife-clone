export interface TaxBracket {
  /** Upper bound of the bracket in USD-equivalent income. */
  upTo: number;
  rate: number;
}

export interface Country {
  name: string;
  monarchy: boolean;
  cities: string[];
  taxBrackets: TaxBracket[];
  maleNames: string[];
  femaleNames: string[];
  lastNames: string[];
}

import { NAME_POOLS } from "./names";

const INF = Number.POSITIVE_INFINITY;

export const COUNTRIES: Country[] = [
  {
    name: "United States",
    monarchy: false,
    cities: ["New York", "Los Angeles", "Chicago", "Austin", "Miami", "Seattle", "Denver", "Atlanta"],
    taxBrackets: [
      { upTo: 20_000, rate: 0 },
      { upTo: 50_000, rate: 0.2 },
      { upTo: 100_000, rate: 0.28 },
      { upTo: INF, rate: 0.35 },
    ],
    maleNames: ["James", "Liam", "Noah", "Ethan", "Mason", "Jacob", "Lucas", "Henry", "Jack", "Owen"],
    femaleNames: ["Olivia", "Emma", "Ava", "Sophia", "Mia", "Harper", "Emily", "Grace", "Chloe", "Ella"],
    lastNames: ["Smith", "Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson"],
  },
  {
    name: "United Kingdom",
    monarchy: true,
    cities: ["London", "Manchester", "Edinburgh", "Bristol", "Leeds", "Cardiff", "Glasgow"],
    taxBrackets: [
      { upTo: 15_000, rate: 0 },
      { upTo: 55_000, rate: 0.2 },
      { upTo: 140_000, rate: 0.4 },
      { upTo: INF, rate: 0.45 },
    ],
    maleNames: ["Oliver", "George", "Harry", "Arthur", "Alfie", "Freddie", "Archie", "Thomas", "Edward", "Oscar"],
    femaleNames: ["Amelia", "Isla", "Poppy", "Florence", "Evie", "Lily", "Charlotte", "Matilda", "Imogen", "Beatrice"],
    lastNames: ["Taylor", "Evans", "Thomas", "Roberts", "Walker", "Wright", "Robinson", "Thompson", "Hughes", "Edwards"],
  },
  {
    name: "Canada",
    monarchy: false,
    cities: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Halifax"],
    taxBrackets: [
      { upTo: 15_000, rate: 0 },
      { upTo: 55_000, rate: 0.22 },
      { upTo: 110_000, rate: 0.3 },
      { upTo: INF, rate: 0.4 },
    ],
    maleNames: ["Liam", "Logan", "Ryan", "Connor", "Nathan", "Gabriel", "Evan", "Dylan", "Wyatt", "Jacob"],
    femaleNames: ["Emma", "Charlotte", "Abigail", "Sophie", "Hannah", "Zoe", "Lily", "Hailey", "Avery", "Chloe"],
    lastNames: ["Tremblay", "Roy", "Campbell", "MacDonald", "Gagnon", "Wilson", "Stewart", "Fraser", "Singh", "Lee"],
  },
  {
    name: "Australia",
    monarchy: false,
    cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Darwin"],
    taxBrackets: [
      { upTo: 18_000, rate: 0 },
      { upTo: 45_000, rate: 0.19 },
      { upTo: 120_000, rate: 0.33 },
      { upTo: INF, rate: 0.43 },
    ],
    maleNames: ["Jack", "Cooper", "Hunter", "Lachlan", "Mitchell", "Riley", "Flynn", "Harvey", "Xavier", "Archer"],
    femaleNames: ["Charlotte", "Matilda", "Ruby", "Chloe", "Willow", "Georgia", "Mia", "Isla", "Jasmine", "Ivy"],
    lastNames: ["Jones", "Williams", "Kelly", "Ryan", "Murphy", "Nguyen", "Anderson", "Harris", "Clarke", "Campbell"],
  },
  {
    name: "Germany",
    monarchy: false,
    cities: ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Leipzig"],
    taxBrackets: [
      { upTo: 11_000, rate: 0 },
      { upTo: 60_000, rate: 0.25 },
      { upTo: 270_000, rate: 0.42 },
      { upTo: INF, rate: 0.45 },
    ],
    maleNames: ["Lukas", "Felix", "Jonas", "Leon", "Maximilian", "Paul", "Elias", "Finn", "Moritz", "Hans"],
    femaleNames: ["Mia", "Hannah", "Emilia", "Sophie", "Lena", "Clara", "Marie", "Lea", "Greta", "Anna"],
    lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Hoffmann", "Koch"],
  },
  {
    name: "France",
    monarchy: false,
    cities: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Bordeaux"],
    taxBrackets: [
      { upTo: 11_000, rate: 0 },
      { upTo: 28_000, rate: 0.11 },
      { upTo: 80_000, rate: 0.3 },
      { upTo: 180_000, rate: 0.41 },
      { upTo: INF, rate: 0.45 },
    ],
    maleNames: ["Louis", "Gabriel", "Raphaël", "Arthur", "Hugo", "Jules", "Adam", "Léo", "Lucas", "Étienne"],
    femaleNames: ["Emma", "Jade", "Louise", "Alice", "Chloé", "Léa", "Camille", "Manon", "Inès", "Margaux"],
    lastNames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau"],
  },
  {
    name: "Japan",
    monarchy: true,
    cities: ["Tokyo", "Osaka", "Kyoto", "Yokohama", "Sapporo", "Fukuoka"],
    taxBrackets: [
      { upTo: 15_000, rate: 0.05 },
      { upTo: 40_000, rate: 0.2 },
      { upTo: 130_000, rate: 0.33 },
      { upTo: INF, rate: 0.45 },
    ],
    maleNames: ["Haruto", "Sota", "Ren", "Yuto", "Kaito", "Daiki", "Takumi", "Riku", "Hiroshi", "Kenji"],
    femaleNames: ["Yui", "Hina", "Sakura", "Aoi", "Mio", "Rin", "Yuna", "Akari", "Haruka", "Emi"],
    lastNames: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato"],
  },
  {
    name: "India",
    monarchy: false,
    cities: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Kolkata", "Jaipur"],
    taxBrackets: [
      { upTo: 4_000, rate: 0 },
      { upTo: 12_000, rate: 0.1 },
      { upTo: 30_000, rate: 0.2 },
      { upTo: INF, rate: 0.3 },
    ],
    maleNames: ["Aarav", "Vivaan", "Arjun", "Rohan", "Kabir", "Ishaan", "Aditya", "Rahul", "Dev", "Karan"],
    femaleNames: ["Aanya", "Diya", "Saanvi", "Priya", "Ananya", "Meera", "Isha", "Kavya", "Riya", "Neha"],
    lastNames: ["Sharma", "Patel", "Singh", "Kumar", "Gupta", "Reddy", "Mehta", "Iyer", "Nair", "Das"],
  },
  {
    name: "Brazil",
    monarchy: false,
    cities: ["São Paulo", "Rio de Janeiro", "Salvador", "Brasília", "Recife", "Curitiba"],
    taxBrackets: [
      { upTo: 5_000, rate: 0 },
      { upTo: 15_000, rate: 0.15 },
      { upTo: 40_000, rate: 0.225 },
      { upTo: INF, rate: 0.275 },
    ],
    maleNames: ["Miguel", "Arthur", "Heitor", "Davi", "Gabriel", "Pedro", "Rafael", "Thiago", "Bruno", "Mateus"],
    femaleNames: ["Helena", "Alice", "Laura", "Maria", "Valentina", "Sofia", "Isabella", "Luna", "Beatriz", "Camila"],
    lastNames: ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Carvalho", "Almeida", "Ribeiro"],
  },
  {
    name: "Mexico",
    monarchy: false,
    cities: ["Mexico City", "Guadalajara", "Monterrey", "Cancún", "Puebla", "Oaxaca"],
    taxBrackets: [
      { upTo: 5_000, rate: 0 },
      { upTo: 20_000, rate: 0.16 },
      { upTo: 60_000, rate: 0.28 },
      { upTo: INF, rate: 0.35 },
    ],
    maleNames: ["Santiago", "Mateo", "Sebastián", "Diego", "Emiliano", "Leonardo", "Carlos", "Javier", "Luis", "Alejandro"],
    femaleNames: ["Sofía", "Valentina", "Regina", "Camila", "Ximena", "María", "Fernanda", "Renata", "Daniela", "Lupita"],
    lastNames: ["Hernández", "García", "Martínez", "López", "González", "Rodríguez", "Pérez", "Sánchez", "Ramírez", "Flores"],
  },
  {
    name: "Spain",
    monarchy: true,
    cities: ["Madrid", "Barcelona", "Valencia", "Seville", "Bilbao", "Málaga"],
    taxBrackets: [
      { upTo: 12_000, rate: 0.19 },
      { upTo: 35_000, rate: 0.3 },
      { upTo: 60_000, rate: 0.37 },
      { upTo: INF, rate: 0.45 },
    ],
    maleNames: ["Hugo", "Martín", "Pablo", "Álvaro", "Daniel", "Adrián", "Javier", "Mario", "Iker", "Enrique"],
    femaleNames: ["Lucía", "Sofía", "Martina", "Paula", "Julia", "Carmen", "Alba", "Noa", "Elena", "Isabel"],
    lastNames: ["García", "Fernández", "González", "Rodríguez", "López", "Martínez", "Sánchez", "Romero", "Navarro", "Torres"],
  },
  {
    name: "Sweden",
    monarchy: true,
    cities: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås"],
    taxBrackets: [
      { upTo: 18_000, rate: 0 },
      { upTo: 60_000, rate: 0.32 },
      { upTo: INF, rate: 0.52 },
    ],
    maleNames: ["Lucas", "Hugo", "Oliver", "Oscar", "Elias", "Axel", "Gustav", "Erik", "Nils", "Viktor"],
    femaleNames: ["Alice", "Maja", "Elsa", "Astrid", "Ebba", "Ella", "Wilma", "Freja", "Saga", "Ida"],
    lastNames: ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Lindqvist"],
  },
  {
    name: "Netherlands",
    monarchy: true,
    cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
    taxBrackets: [
      { upTo: 15_000, rate: 0 },
      { upTo: 45_000, rate: 0.37 },
      { upTo: INF, rate: 0.5 },
    ],
    maleNames: ["Daan", "Sem", "Lucas", "Milan", "Bram", "Finn", "Jesse", "Thijs", "Sven", "Max"],
    femaleNames: ["Emma", "Julia", "Tess", "Sophie", "Anna", "Lotte", "Eva", "Fleur", "Noor", "Saar"],
    lastNames: ["de Jong", "Jansen", "de Vries", "van den Berg", "Bakker", "Visser", "Smit", "Meijer", "Mulder", "de Boer"],
  },
  {
    name: "Nigeria",
    monarchy: false,
    cities: ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt"],
    taxBrackets: [
      { upTo: 2_000, rate: 0 },
      { upTo: 10_000, rate: 0.15 },
      { upTo: 30_000, rate: 0.24 },
      { upTo: INF, rate: 0.3 },
    ],
    maleNames: ["Chinedu", "Emeka", "Tunde", "Femi", "Ibrahim", "Obinna", "Segun", "Kelechi", "Yusuf", "Chidi"],
    femaleNames: ["Ngozi", "Amara", "Chioma", "Funmi", "Aisha", "Folake", "Adaeze", "Zainab", "Tolu", "Ife"],
    lastNames: ["Okafor", "Adeyemi", "Balogun", "Okoro", "Ibrahim", "Eze", "Nwosu", "Abiola", "Bello", "Obi"],
  },
  {
    name: "South Korea",
    monarchy: false,
    cities: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"],
    taxBrackets: [
      { upTo: 10_000, rate: 0.06 },
      { upTo: 35_000, rate: 0.15 },
      { upTo: 90_000, rate: 0.35 },
      { upTo: INF, rate: 0.42 },
    ],
    maleNames: ["Min-jun", "Seo-jun", "Do-yun", "Ji-ho", "Hyun-woo", "Joon", "Tae-yang", "Sung-min", "Jae-won", "Dong-hyun"],
    femaleNames: ["Seo-yeon", "Ji-woo", "Ha-eun", "Soo-ah", "Min-seo", "Yuna", "Ji-min", "Chae-won", "Da-eun", "Hye-jin"],
    lastNames: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"],
  },
  {
    name: "Italy",
    monarchy: false,
    cities: ["Rome", "Milan", "Naples", "Turin", "Florence", "Venice"],
    taxBrackets: [
      { upTo: 15_000, rate: 0.23 },
      { upTo: 28_000, rate: 0.25 },
      { upTo: 50_000, rate: 0.35 },
      { upTo: INF, rate: 0.43 },
    ],
    maleNames: ["Leonardo", "Francesco", "Alessandro", "Lorenzo", "Mattia", "Andrea", "Matteo", "Marco", "Luca", "Enzo"],
    femaleNames: ["Sofia", "Giulia", "Aurora", "Alice", "Ginevra", "Beatrice", "Chiara", "Francesca", "Gaia", "Bianca"],
    lastNames: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"],
  },
];

export const COUNTRY_BY_NAME: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.name, c]),
);

// Name pools live in ./names.ts (much larger than the inline starter lists above).
for (const c of COUNTRIES) {
  const pool = NAME_POOLS[c.name];
  if (pool) {
    c.maleNames = pool.male;
    c.femaleNames = pool.female;
    c.lastNames = pool.last;
  }
}

export const MONARCHIES = COUNTRIES.filter((c) => c.monarchy);

export function getCountry(name: string): Country {
  return COUNTRY_BY_NAME[name] ?? COUNTRIES[0];
}

/** Marginal progressive income tax. */
export function incomeTaxFor(countryName: string, income: number): number {
  const { taxBrackets } = getCountry(countryName);
  let tax = 0;
  let lower = 0;
  for (const b of taxBrackets) {
    if (income <= lower) break;
    tax += (Math.min(income, b.upTo) - lower) * b.rate;
    lower = b.upTo;
  }
  return Math.round(tax);
}
