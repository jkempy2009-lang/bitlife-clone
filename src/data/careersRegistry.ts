/** Corporate hierarchies, requirements and Special Job Pack configuration. */

export interface JobTier {
  title: string;
  salary: number;
}

export interface CareerLine {
  id: string;
  name: string;
  emoji: string;
  category: string;
  blurb: string;
  companies: string[];
  minAge: number;
  requirements: {
    /** Any-of degree ids. "bachelor" matches any bachelor:* degree. */
    degrees?: string[];
    minSmarts: number;
    minLooks?: number;
    /** Underworld jobs: only open to people of dubious character. */
    maxKarma?: number;
    minSkills?: Partial<Record<"acting" | "music" | "charisma" | "athletics", number>>;
  };
  ladder: JobTier[];
  /** Special packs are hidden from the general corporate board. */
  pack?: "actor" | "athlete" | "politics" | "crime" | "spy" | "adult";
}

export const CAREER_LINES: CareerLine[] = [
  {
    id: "fast_food", name: "Fast Food", emoji: "🍔", category: "Service", blurb: "Flip burgers, climb the greasy ladder.",
    companies: ["Burger Barn", "Chicken Shack", "Taco Town", "Wok This Way"], minAge: 15,
    requirements: { minSmarts: 0 },
    ladder: [
      { title: "Fry Cook", salary: 16_000 },
      { title: "Shift Supervisor", salary: 26_000 },
      { title: "Assistant Manager", salary: 38_000 },
      { title: "Restaurant Manager", salary: 55_000 },
      { title: "Regional Director", salary: 90_000 },
    ],
  },
  {
    id: "retail", name: "Retail", emoji: "🛒", category: "Service", blurb: "The customer is always… present.",
    companies: ["MegaMart", "ValueTown", "Shoply", "Threads & Co"], minAge: 15,
    requirements: { minSmarts: 0 },
    ladder: [
      { title: "Cashier", salary: 17_000 },
      { title: "Sales Associate", salary: 27_000 },
      { title: "Department Lead", salary: 40_000 },
      { title: "Store Manager", salary: 62_000 },
      { title: "District Manager", salary: 105_000 },
    ],
  },
  {
    id: "construction", name: "Construction & Trades", emoji: "🏗️", category: "Trades", blurb: "Hard hats, harder work, honest pay.",
    companies: ["Ironclad Builders", "Summit Construction", "Keystone Trades"], minAge: 17,
    requirements: { minSmarts: 15 },
    ladder: [
      { title: "Laborer", salary: 28_000 },
      { title: "Skilled Tradesperson", salary: 48_000 },
      { title: "Site Foreman", salary: 72_000 },
      { title: "Project Manager", salary: 105_000 },
      { title: "Construction Magnate", salary: 190_000 },
    ],
  },
  {
    id: "police", name: "Police Force", emoji: "🚓", category: "Public Service", blurb: "Protect and serve. Donut optional.",
    companies: ["City Police Dept.", "County Sheriff's Office", "State Patrol"], minAge: 21,
    requirements: { degrees: ["highschool"], minSmarts: 40 },
    ladder: [
      { title: "Patrol Officer", salary: 52_000 },
      { title: "Detective", salary: 78_000 },
      { title: "Sergeant", salary: 98_000 },
      { title: "Captain", salary: 130_000 },
      { title: "Police Chief", salary: 185_000 },
    ],
  },
  {
    id: "military", name: "Armed Forces", emoji: "🎖️", category: "Public Service", blurb: "Serve your country. See the world. Run a lot.",
    companies: ["National Army", "Navy", "Air Force"], minAge: 18,
    requirements: { degrees: ["highschool"], minSmarts: 30 },
    ladder: [
      { title: "Private", salary: 30_000 },
      { title: "Sergeant", salary: 48_000 },
      { title: "Lieutenant", salary: 72_000 },
      { title: "Major", salary: 105_000 },
      { title: "General", salary: 210_000 },
    ],
  },
  {
    id: "firefighter", name: "Fire Department", emoji: "🚒", category: "Public Service", blurb: "Run toward what everyone else runs from.",
    companies: ["Metro Fire & Rescue", "County Fire Dept."], minAge: 19,
    requirements: { degrees: ["highschool"], minSmarts: 30 },
    ladder: [
      { title: "Firefighter", salary: 46_000 },
      { title: "Engineer", salary: 66_000 },
      { title: "Lieutenant", salary: 85_000 },
      { title: "Fire Chief", salary: 140_000 },
    ],
  },
  {
    id: "teacher", name: "Education", emoji: "🍎", category: "Public Service", blurb: "Shape young minds (and survive them).",
    companies: ["Lincoln Elementary", "Riverside High", "Oakwood Academy"], minAge: 22,
    requirements: { degrees: ["bachelor"], minSmarts: 50 },
    ladder: [
      { title: "Teacher", salary: 46_000 },
      { title: "Senior Teacher", salary: 62_000 },
      { title: "Department Head", salary: 80_000 },
      { title: "Principal", salary: 112_000 },
      { title: "Superintendent", salary: 165_000 },
    ],
  },
  {
    id: "nurse", name: "Healthcare Nursing", emoji: "🩺", category: "Healthcare", blurb: "The backbone of every hospital.",
    companies: ["St. Mary's Hospital", "General Medical Center", "Sunrise Clinic"], minAge: 22,
    requirements: { degrees: ["bachelor:nursing", "bachelor:science", "cert:nursing"], minSmarts: 55 },
    ladder: [
      { title: "Registered Nurse", salary: 74_000 },
      { title: "Charge Nurse", salary: 92_000 },
      { title: "Nurse Practitioner", salary: 125_000 },
      { title: "Director of Nursing", salary: 165_000 },
    ],
  },
  {
    id: "doctor", name: "Medicine", emoji: "⚕️", category: "Healthcare", blurb: "Requires a medical degree. Saves lives for a living.",
    companies: ["St. Mary's Hospital", "Mercy Medical", "Johns & Hopkins Clinic"], minAge: 26,
    requirements: { degrees: ["md"], minSmarts: 75 },
    ladder: [
      { title: "Resident Physician", salary: 120_000 },
      { title: "Attending Physician", salary: 260_000 },
      { title: "Surgeon", salary: 390_000 },
      { title: "Chief of Surgery", salary: 560_000 },
      { title: "Hospital Director", salary: 780_000 },
    ],
  },
  {
    id: "lawyer", name: "Law", emoji: "⚖️", category: "Legal", blurb: "Requires a law degree. Objection!",
    companies: ["Hartman & Pike LLP", "Sterling Legal", "Dunn, Brooks & Carr"], minAge: 25,
    requirements: { degrees: ["jd"], minSmarts: 65 },
    ladder: [
      { title: "Junior Associate", salary: 95_000 },
      { title: "Senior Associate", salary: 165_000 },
      { title: "Partner", salary: 330_000 },
      { title: "Managing Partner", salary: 600_000 },
      { title: "Supreme Court Justice", salary: 900_000 },
    ],
  },
  {
    id: "software", name: "Technology", emoji: "💻", category: "Technology", blurb: "Ship code. Break prod. Get free snacks.",
    companies: ["Byteforge", "NimbusSoft", "Quantum Loop", "Pixelhaus"], minAge: 20,
    requirements: { degrees: ["bachelor:cs", "bachelor:engineering", "cert:bootcamp"], minSmarts: 60 },
    ladder: [
      { title: "Junior Developer", salary: 82_000 },
      { title: "Software Engineer", salary: 128_000 },
      { title: "Senior Engineer", salary: 185_000 },
      { title: "Engineering Director", salary: 280_000 },
      { title: "Chief Technology Officer", salary: 520_000 },
    ],
  },
  {
    id: "engineer", name: "Engineering", emoji: "⚙️", category: "Technology", blurb: "Build bridges, circuits, and rockets.",
    companies: ["Atlas Dynamics", "Meridian Engineering", "Apex Aerospace"], minAge: 22,
    requirements: { degrees: ["bachelor:engineering"], minSmarts: 62 },
    ladder: [
      { title: "Graduate Engineer", salary: 72_000 },
      { title: "Design Engineer", salary: 98_000 },
      { title: "Principal Engineer", salary: 142_000 },
      { title: "VP of Engineering", salary: 230_000 },
    ],
  },
  {
    id: "finance", name: "Finance", emoji: "📈", category: "Business", blurb: "Other people's money, your bonuses.",
    companies: ["Goldfield Capital", "Vanta Bank", "Meridian Securities"], minAge: 22,
    requirements: { degrees: ["bachelor:business"], minSmarts: 60 },
    ladder: [
      { title: "Analyst", salary: 78_000 },
      { title: "Associate", salary: 125_000 },
      { title: "Vice President", salary: 210_000 },
      { title: "Managing Director", salary: 420_000 },
      { title: "Chief Executive Officer", salary: 1_200_000 },
    ],
  },
  {
    id: "marketing", name: "Marketing & Media", emoji: "📣", category: "Business", blurb: "Make people want things they don't need.",
    companies: ["Brightside Agency", "Halo Media", "Viral Labs"], minAge: 21,
    requirements: { degrees: ["bachelor"], minSmarts: 45, minLooks: 40 },
    ladder: [
      { title: "Marketing Assistant", salary: 44_000 },
      { title: "Brand Manager", salary: 72_000 },
      { title: "Creative Director", salary: 118_000 },
      { title: "Chief Marketing Officer", salary: 260_000 },
    ],
  },
  {
    id: "science", name: "Research Science", emoji: "🔬", category: "Science", blurb: "Discover something. Publish it. Repeat.",
    companies: ["Helix Labs", "National Research Institute", "Orion Biotech"], minAge: 22,
    requirements: { degrees: ["bachelor:science"], minSmarts: 68 },
    ladder: [
      { title: "Lab Technician", salary: 58_000 },
      { title: "Research Scientist", salary: 92_000 },
      { title: "Principal Investigator", salary: 148_000 },
      { title: "Director of Research", salary: 240_000 },
    ],
  },
  {
    id: "journalism", name: "Journalism", emoji: "📰", category: "Creative", blurb: "Chase the story. Meet the deadline.",
    companies: ["The Daily Courier", "Metro News Network", "Globe Wire"], minAge: 21,
    requirements: { degrees: ["bachelor:arts"], minSmarts: 45 },
    ladder: [
      { title: "Staff Writer", salary: 38_000 },
      { title: "Reporter", salary: 56_000 },
      { title: "Senior Editor", salary: 88_000 },
      { title: "Editor-in-Chief", salary: 150_000 },
    ],
  },
  {
    id: "chef", name: "Culinary Arts", emoji: "🍳", category: "Creative", blurb: "Yes, Chef!",
    companies: ["Le Petit Bistro", "The Golden Spoon", "Salt & Ember"], minAge: 17,
    requirements: { minSmarts: 20 },
    ladder: [
      { title: "Line Cook", salary: 29_000 },
      { title: "Sous Chef", salary: 48_000 },
      { title: "Head Chef", salary: 76_000 },
      { title: "Celebrity Chef", salary: 190_000 },
    ],
  },
  {
    id: "pilot", name: "Aviation", emoji: "✈️", category: "Transport", blurb: "Your captain is speaking.",
    companies: ["SkyBridge Airlines", "Meridian Air", "Pacific Wings"], minAge: 23,
    requirements: { degrees: ["bachelor", "cert:pilot"], minSmarts: 62 },
    ladder: [
      { title: "First Officer", salary: 95_000 },
      { title: "Captain", salary: 180_000 },
      { title: "Chief Pilot", salary: 275_000 },
    ],
  },
  {
    id: "realestate", name: "Real Estate", emoji: "🏘️", category: "Business", blurb: "Location, location, commission.",
    companies: ["Keystone Realty", "Harbor & Gate Properties", "Prime Estates"], minAge: 19,
    requirements: { degrees: ["highschool"], minSmarts: 35, minLooks: 35 },
    ladder: [
      { title: "Junior Agent", salary: 38_000 },
      { title: "Agent", salary: 78_000 },
      { title: "Top Producer", salary: 160_000 },
      { title: "Brokerage Owner", salary: 340_000 },
    ],
  },
  {
    id: "politics", name: "Politics", emoji: "🏛️", category: "Public Service", blurb: "Win elections to climb the ladder. Popularity is everything.",
    companies: ["City Council", "State Legislature", "National Assembly"], minAge: 25,
    requirements: { minSmarts: 45, minLooks: 35 },
    pack: "politics",
    ladder: [
      { title: "City Councillor", salary: 62_000 },
      { title: "Mayor", salary: 110_000 },
      { title: "State Governor", salary: 190_000 },
      { title: "Senator", salary: 260_000 },
      { title: "Head of State", salary: 450_000 },
    ],
  },
  {
    id: "trades", name: "Skilled Trades", emoji: "🔧", category: "Trades", blurb: "Electrician, plumber, fixer of all things.",
    companies: ["Ace Electric", "Flowright Plumbing", "Spark & Co.", "Pipeline Pros"], minAge: 18,
    requirements: { degrees: ["highschool"], minSmarts: 30 },
    ladder: [
      { title: "Apprentice", salary: 30_000 },
      { title: "Journeyman", salary: 56_000 },
      { title: "Master Tradesperson", salary: 82_000 },
      { title: "Contractor", salary: 140_000 },
    ],
  },
  {
    id: "bartender", name: "Hospitality", emoji: "🍸", category: "Service", blurb: "Pour drinks, hear confessions.",
    companies: ["The Rusty Anchor", "Velvet Lounge", "Grand Hotel Bar"], minAge: 18,
    requirements: { minSmarts: 10, minLooks: 30 },
    ladder: [
      { title: "Barback", salary: 22_000 },
      { title: "Bartender", salary: 36_000 },
      { title: "Head Bartender", salary: 52_000 },
      { title: "Bar Owner-Manager", salary: 95_000 },
    ],
  },
  {
    id: "trucking", name: "Transport & Logistics", emoji: "🚚", category: "Transport", blurb: "Long roads and longer playlists.",
    companies: ["Haul & Co.", "Cross-Country Freight", "RoadKing Logistics"], minAge: 21,
    requirements: { minSmarts: 15 },
    ladder: [
      { title: "Delivery Driver", salary: 34_000 },
      { title: "Long-Haul Trucker", salary: 58_000 },
      { title: "Fleet Supervisor", salary: 82_000 },
      { title: "Logistics Director", salary: 130_000 },
    ],
  },
  {
    id: "socialwork", name: "Social Work", emoji: "🤲", category: "Public Service", blurb: "Hard days. Meaningful ones.",
    companies: ["Family Services", "Community Outreach Center", "County Welfare Office"], minAge: 22,
    requirements: { degrees: ["bachelor"], minSmarts: 45 },
    ladder: [
      { title: "Caseworker", salary: 44_000 },
      { title: "Senior Social Worker", salary: 62_000 },
      { title: "Program Director", salary: 92_000 },
    ],
  },
  {
    id: "architect", name: "Architecture", emoji: "📐", category: "Creative", blurb: "Design the skyline.",
    companies: ["Foster & Wren", "Skyline Studio", "Blueprint Collective"], minAge: 23,
    requirements: { degrees: ["bachelor:engineering", "bachelor:arts"], minSmarts: 60 },
    ladder: [
      { title: "Junior Architect", salary: 62_000 },
      { title: "Architect", salary: 94_000 },
      { title: "Principal Architect", salary: 150_000 },
      { title: "Starchitect", salary: 340_000 },
    ],
  },
  {
    id: "vet", name: "Veterinary Medicine", emoji: "🐾", category: "Healthcare", blurb: "Everyone's favourite patients.",
    companies: ["Paws & Claws Clinic", "Greenfield Animal Hospital", "City Vets"], minAge: 24,
    requirements: { degrees: ["bachelor:science", "md"], minSmarts: 68 },
    ladder: [
      { title: "Associate Vet", salary: 88_000 },
      { title: "Veterinarian", salary: 120_000 },
      { title: "Clinic Owner", salary: 190_000 },
    ],
  },
  {
    id: "psychology", name: "Psychology", emoji: "🧠", category: "Healthcare", blurb: "How does that make you feel?",
    companies: ["Mindful Practice", "Riverside Counselling", "Univ. Health Services"], minAge: 24,
    requirements: { degrees: ["masters", "bachelor:science", "bachelor:arts", "bachelor:education"], minSmarts: 60 },
    ladder: [
      { title: "Counsellor", salary: 52_000 },
      { title: "Clinical Psychologist", salary: 98_000 },
      { title: "Practice Director", salary: 160_000 },
    ],
  },
  {
    id: "professor", name: "Academia", emoji: "🎓", category: "Education", blurb: "Publish, teach, argue about footnotes.",
    companies: ["Westbridge University", "Northgate College", "Institute of Technology"], minAge: 26,
    requirements: { degrees: ["masters", "md", "jd"], minSmarts: 72 },
    ladder: [
      { title: "Lecturer", salary: 58_000 },
      { title: "Associate Professor", salary: 92_000 },
      { title: "Full Professor", salary: 140_000 },
      { title: "University Dean", salary: 230_000 },
    ],
  },
  {
    id: "gamedev", name: "Game Development", emoji: "🎮", category: "Technology", blurb: "Crunch time forever.",
    companies: ["Pixel Forge", "Dragonfly Games", "Hyperloop Interactive"], minAge: 20,
    requirements: { degrees: ["bachelor:cs", "bachelor:arts", "cert:bootcamp"], minSmarts: 55 },
    ladder: [
      { title: "QA Tester", salary: 38_000 },
      { title: "Game Programmer", salary: 92_000 },
      { title: "Lead Designer", salary: 150_000 },
      { title: "Studio Director", salary: 300_000 },
    ],
  },
  {
    id: "accounting", name: "Accounting", emoji: "🧾", category: "Business", blurb: "Debits, credits, and caffeine.",
    companies: ["Bright & Lowe CPA", "Tallman Accounting", "Ledger Partners"], minAge: 22,
    requirements: { degrees: ["bachelor:business"], minSmarts: 55 },
    ladder: [
      { title: "Junior Accountant", salary: 54_000 },
      { title: "Senior Accountant", salary: 82_000 },
      { title: "Audit Partner", salary: 190_000 },
    ],
  },
  {
    id: "dentist", name: "Dentistry", emoji: "🦷", category: "Healthcare", blurb: "Open wide.",
    companies: ["Bright Smile Dental", "Family Dentistry", "Pearl Clinic"], minAge: 26,
    requirements: { degrees: ["md"], minSmarts: 70 },
    ladder: [
      { title: "Associate Dentist", salary: 130_000 },
      { title: "Dentist", salary: 190_000 },
      { title: "Practice Owner", salary: 320_000 },
    ],
  },
  {
    id: "mechanic", name: "Auto Repair", emoji: "🔩", category: "Trades", blurb: "That noise? Oh, that's bad.",
    companies: ["Torque Garage", "Midtown Auto", "Quick Lube & Fix"], minAge: 18,
    requirements: { minSmarts: 20 },
    ladder: [
      { title: "Lube Technician", salary: 27_000 },
      { title: "Mechanic", salary: 46_000 },
      { title: "Master Mechanic", salary: 70_000 },
      { title: "Garage Owner", salary: 110_000 },
    ],
  },
  {
    id: "hair", name: "Beauty & Styling", emoji: "💇", category: "Service", blurb: "Look good, feel good.",
    companies: ["Shear Genius", "Studio Luxe", "The Hair Loft"], minAge: 18,
    requirements: { minSmarts: 10, minLooks: 40 },
    ladder: [
      { title: "Junior Stylist", salary: 26_000 },
      { title: "Stylist", salary: 42_000 },
      { title: "Celebrity Stylist", salary: 150_000 },
    ],
  },
  {
    id: "model", name: "Modelling", emoji: "📸", category: "Entertainment", blurb: "Looks above 75 get you through the door.",
    companies: ["Vogue Agency", "Elite Faces", "Runway Management"], minAge: 16,
    requirements: { minSmarts: 0, minLooks: 75 },
    ladder: [
      { title: "Runway Model", salary: 45_000 },
      { title: "Cover Model", salary: 260_000 },
      { title: "Supermodel", salary: 2_200_000 },
    ],
  },
  {
    id: "farming", name: "Farming", emoji: "🚜", category: "Trades", blurb: "Up before the sun.",
    companies: ["Green Acres", "Sunrise Farms", "Riverbend Ranch"], minAge: 16,
    requirements: { minSmarts: 15 },
    ladder: [
      { title: "Farmhand", salary: 24_000 },
      { title: "Farm Manager", salary: 48_000 },
      { title: "Farm Owner", salary: 96_000 },
    ],
  },
  {
    id: "paramedic", name: "Emergency Medical", emoji: "🚑", category: "Healthcare", blurb: "Every second counts.",
    companies: ["Metro EMS", "County Ambulance", "City Rescue"], minAge: 20,
    requirements: { degrees: ["highschool"], minSmarts: 40 },
    ladder: [
      { title: "EMT", salary: 38_000 },
      { title: "Paramedic", salary: 56_000 },
      { title: "EMS Chief", salary: 92_000 },
    ],
  },
  {
    id: "security", name: "Security", emoji: "🛡️", category: "Service", blurb: "Stand there. Look intimidating.",
    companies: ["Guardian Securities", "Iron Shield", "SafeWatch"], minAge: 18,
    requirements: { minSmarts: 10 },
    ladder: [
      { title: "Security Guard", salary: 29_000 },
      { title: "Security Supervisor", salary: 46_000 },
      { title: "Head of Security", salary: 88_000 },
    ],
  },
  {
    id: "library", name: "Library Services", emoji: "📚", category: "Public Service", blurb: "Shhh.",
    companies: ["Central Library", "Riverside Branch", "University Library"], minAge: 20,
    requirements: { degrees: ["bachelor"], minSmarts: 40 },
    ladder: [
      { title: "Library Assistant", salary: 31_000 },
      { title: "Librarian", salary: 50_000 },
      { title: "Chief Librarian", salary: 78_000 },
    ],
  },
  {
    id: "cabin", name: "Cabin Crew", emoji: "🛫", category: "Transport", blurb: "See the world, serve the peanuts.",
    companies: ["SkyBridge Airlines", "Meridian Air", "Pacific Wings"], minAge: 20,
    requirements: { degrees: ["highschool"], minSmarts: 25, minLooks: 50 },
    ladder: [
      { title: "Flight Attendant", salary: 42_000 },
      { title: "Senior Purser", salary: 68_000 },
      { title: "Cabin Director", salary: 110_000 },
    ],
  },
  {
    id: "consulting", name: "Management Consulting", emoji: "📋", category: "Business", blurb: "Slide decks as a service.",
    companies: ["Calloway & Pine", "Strategos Group", "Meridian Advisors"], minAge: 23,
    requirements: { degrees: ["masters", "jd"], minSmarts: 68 },
    ladder: [
      { title: "Analyst", salary: 92_000 },
      { title: "Consultant", salary: 150_000 },
      { title: "Principal", salary: 280_000 },
      { title: "Senior Partner", salary: 650_000 },
    ],
  },
  {
    id: "astronaut", name: "Space Programme", emoji: "🚀", category: "Science", blurb: "Elite. Needs genius-level Smarts, strong Athletics, and a science or engineering degree.",
    companies: ["National Space Agency", "Orbital Dynamics", "Horizon Aerospace"], minAge: 26,
    requirements: { degrees: ["bachelor:science", "bachelor:engineering", "masters"], minSmarts: 85, minSkills: { athletics: 45 } },
    ladder: [
      { title: "Astronaut Candidate", salary: 78_000 },
      { title: "Astronaut", salary: 125_000 },
      { title: "Mission Commander", salary: 190_000 },
      { title: "Chief Astronaut", salary: 260_000 },
    ],
  },
  {
    id: "clergy", name: "Clergy", emoji: "⛪", category: "Public Service", blurb: "Guide the faithful.",
    companies: ["St. Andrew's Church", "Riverside Congregation", "Grace Fellowship", "The Interfaith Centre"], minAge: 22,
    requirements: { degrees: ["bachelor"], minSmarts: 35 },
    ladder: [
      { title: "Deacon", salary: 30_000 },
      { title: "Pastor", salary: 48_000 },
      { title: "Bishop", salary: 85_000 },
      { title: "Archbishop", salary: 140_000 },
    ],
  },
  // ---- Special Job Pack: Secret Agent ----
  {
    id: "spy", name: "The Agency", emoji: "🕵️", category: "Intelligence", blurb: "Classified. Apply if you have a degree and 70+ Smarts, then take missions.",
    companies: ["Intelligence Service", "Overseas Directorate", "The Bureau"], minAge: 21,
    requirements: { degrees: ["bachelor", "masters"], minSmarts: 70 },
    pack: "spy",
    ladder: [
      { title: "Trainee Operative", salary: 45_000 },
      { title: "Field Agent", salary: 95_000 },
      { title: "Senior Agent", salary: 160_000 },
      { title: "Station Chief", salary: 250_000 },
    ],
  },
  // ---- Special Job Pack: Adult Work (18+, mature content only) ----
  {
    id: "dancer", name: "Exotic Dancing", emoji: "💃", category: "Adult", blurb: "Club stages and big tips. Needs looks 55+.",
    companies: ["Velvet Room", "Club Aurora", "The Gilded Cage", "Midnight Lounge"], minAge: 18,
    requirements: { minSmarts: 0, minLooks: 55 },
    pack: "adult",
    ladder: [
      { title: "Club Dancer", salary: 38_000 },
      { title: "Headliner", salary: 95_000 },
      { title: "Club Manager", salary: 150_000 },
      { title: "Club Owner", salary: 320_000 },
    ],
  },
  {
    id: "escort", name: "Companionship", emoji: "🥂", category: "Adult", blurb: "High pay, real risks, and illegal in many countries. Needs looks 65+.",
    companies: ["Discreet Escorts", "Elite Companions", "Private Society", "Velvet Agency"], minAge: 18,
    requirements: { minSmarts: 15, minLooks: 65 },
    pack: "adult",
    ladder: [
      { title: "Companion", salary: 60_000 },
      { title: "Elite Companion", salary: 180_000 },
      { title: "Agency Madam / Manager", salary: 420_000 },
    ],
  },
  {
    id: "creator", name: "Adult Content Creator", emoji: "📲", category: "Adult", blurb: "Run your own subscription page. Needs looks 50+. Fame and privacy trade-offs.",
    companies: ["FanVault", "PrivateFeed", "SubStar", "OnlyYou"], minAge: 18,
    requirements: { minSmarts: 10, minLooks: 50 },
    pack: "adult",
    ladder: [
      { title: "New Creator", salary: 12_000 },
      { title: "Rising Creator", salary: 65_000 },
      { title: "Top Creator", salary: 360_000 },
      { title: "Platform Megastar", salary: 2_400_000 },
    ],
  },
  // ---- Special Job Pack: The Underworld ----
  {
    id: "mafia", name: "The Family", emoji: "🕴️", category: "Underworld", blurb: "An offer you can't refuse. Off-the-books pay, on-the-books risk.",
    companies: ["The Calabrese Family", "The Volkov Syndicate", "The Harbor Crew", "The Red Dragon Tong"], minAge: 18,
    requirements: { minSmarts: 0, maxKarma: 50 },
    pack: "crime",
    ladder: [
      { title: "Associate", salary: 30_000 },
      { title: "Soldier", salary: 90_000 },
      { title: "Capo", salary: 250_000 },
      { title: "Underboss", salary: 600_000 },
      { title: "Boss", salary: 2_000_000 },
    ],
  },
  // ---- Special Job Pack: Movie Star ----
  {
    id: "actor", name: "Acting", emoji: "🎬", category: "Entertainment", blurb: "Background Actor needs looks above 70. Dream big.",
    companies: ["Starlight Studios", "Silverscreen Pictures", "Indie Reel", "Horizon Films"], minAge: 5,
    requirements: { minSmarts: 0, minLooks: 71 },
    pack: "actor",
    ladder: [
      { title: "Background Actor", salary: 18_000 },
      { title: "Supporting Actor", salary: 140_000 },
      { title: "Lead Actor", salary: 1_800_000 },
      { title: "A-List Movie Star", salary: 14_000_000 },
    ],
  },
  // ---- Special Job Pack: Professional Athlete ----
  {
    id: "athlete", name: "Professional Sports", emoji: "🏅", category: "Sports", blurb: "Train hard, sign with a club, chase glory before your body gives out.",
    companies: ["Metro Titans", "Harbor Hawks", "Union FC", "Capital Lions", "Pacific Storm"], minAge: 16,
    requirements: { minSmarts: 0, minSkills: { athletics: 40 } },
    pack: "athlete",
    ladder: [
      { title: "Semi-Pro Player", salary: 38_000 },
      { title: "Pro Player", salary: 420_000 },
      { title: "Franchise Player", salary: 3_200_000 },
      { title: "Hall-of-Fame Legend", salary: 14_000_000 },
    ],
  },
];

export const CAREER_BY_ID: Record<string, CareerLine> = Object.fromEntries(CAREER_LINES.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Education programs
// ---------------------------------------------------------------------------

export const UNIVERSITY_MAJORS = [
  { id: "business", name: "Business" },
  { id: "cs", name: "Computer Science" },
  { id: "engineering", name: "Engineering" },
  { id: "science", name: "Natural Sciences" },
  { id: "arts", name: "Arts & Humanities" },
  { id: "education", name: "Education" },
  { id: "nursing", name: "Nursing" },
] as const;

export const PROGRAMS = {
  University: { years: 4, tuition: 18_000, minSmarts: 35, label: "University" },
  MedicalSchool: { years: 4, tuition: 42_000, minSmarts: 70, label: "Medical School" },
  LawSchool: { years: 3, tuition: 34_000, minSmarts: 60, label: "Law School" },
  Masters: { years: 2, tuition: 28_000, minSmarts: 55, label: "Graduate School" },
} as const;

// ---------------------------------------------------------------------------
// Special Job Pack configuration: Royalty and Music
// ---------------------------------------------------------------------------

export const ROYAL_ALLOWANCE: Record<string, number> = {
  none: 0,
  Prince: 400_000,
  Princess: 400_000,
  King: 3_000_000,
  Queen: 3_000_000,
};

export const MUSIC_GENRES = ["Rock", "Pop", "Metal", "Hip-Hop", "Country", "Jazz"] as const;

/** Album rating ladder: minimum score -> rating, units sold, first-year royalty. */
export const ALBUM_RATINGS = [
  { min: 0, rating: "Flop", sales: 2_000, royalty: 2_000, fame: -3 },
  { min: 35, rating: "Modest", sales: 40_000, royalty: 45_000, fame: 1 },
  { min: 55, rating: "Hit", sales: 250_000, royalty: 300_000, fame: 4 },
  { min: 70, rating: "Gold", sales: 500_000, royalty: 900_000, fame: 7 },
  { min: 82, rating: "Platinum", sales: 1_000_000, royalty: 3_500_000, fame: 11 },
  { min: 94, rating: "Diamond", sales: 10_000_000, royalty: 22_000_000, fame: 18 },
] as const;

export const DECREES = [
  { id: "tax_cut", name: "Cut Taxes", economy: 8, freedom: 0, military: 0, respect: 5, blurb: "The people rejoice. The treasury weeps." },
  { id: "free_press", name: "Protect Press Freedom", economy: 0, freedom: 10, military: 0, respect: 6, blurb: "Journalists send you a fruit basket." },
  { id: "rearm", name: "Expand the Army", economy: -6, freedom: -4, military: 12, respect: -4, blurb: "More tanks. Fewer schools." },
  { id: "curfew", name: "Impose a Curfew", economy: -3, freedom: -12, military: 4, respect: -10, blurb: "Order, at a price." },
  { id: "public_works", name: "Fund Public Works", economy: 6, freedom: 2, military: 0, respect: 7, blurb: "New roads named after you." },
] as const;
