import type { PlayerState } from "@/types/game.types";
import { netWorth } from "@/engine/state";

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  check: (p: PlayerState) => boolean;
}

const has = (p: PlayerState, f: string) => p.flags.includes(f);
const degree = (p: PlayerState, d: string) => p.education.degrees.some((x) => x === d || (d === "bachelor" && x.startsWith("bachelor:")));
const jobLine = (p: PlayerState, line: string, minTier = 0) => p.currentJob?.lineId === line && p.currentJob.tier >= minTier;

export const ACHIEVEMENTS: Achievement[] = [
  // Money
  { id: "first_paycheck", name: "First Paycheck", emoji: "💵", desc: "Land your first job.", check: (p) => p.stats.highestSalary > 0 },
  { id: "millionaire", name: "Millionaire", emoji: "💰", desc: "Reach a net worth of $1,000,000.", check: (p) => netWorth(p) >= 1_000_000 },
  { id: "ten_million", name: "Eight Figures", emoji: "🏦", desc: "Reach a net worth of $10,000,000.", check: (p) => netWorth(p) >= 10_000_000 },
  { id: "billionaire", name: "Billionaire", emoji: "🛥️", desc: "Reach a net worth of $1,000,000,000.", check: (p) => netWorth(p) >= 1_000_000_000 },
  { id: "deep_debt", name: "In Deep", emoji: "📉", desc: "Owe over $100,000.", check: (p) => p.outstandingLoans >= 100_000 },
  { id: "investor", name: "Wall Street Wannabe", emoji: "📈", desc: "Hold $100,000 in investments.", check: (p) => Object.values(p.investments).reduce((s, h) => s + h.value, 0) >= 100_000 },
  { id: "lottery", name: "Lucky Duck", emoji: "🎰", desc: "Win the lottery jackpot.", check: (p) => has(p, "lottery_winner") },
  { id: "homeowner", name: "Home Sweet Home", emoji: "🏠", desc: "Own a property.", check: (p) => p.properties.length > 0 },
  { id: "mansion", name: "Lifestyles of the Rich", emoji: "🏰", desc: "Own a property worth $10M or more.", check: (p) => p.properties.some((h) => h.currentValue >= 10_000_000) },
  { id: "supercar", name: "Gearhead", emoji: "🏎️", desc: "Own a car worth $300,000 or more.", check: (p) => p.vehicles.some((v) => v.currentValue >= 300_000) },
  { id: "world_citizen", name: "World Citizen", emoji: "🌍", desc: "Live in a different country from the one you were born in.", check: (p) => p.residence.country !== p.birthCountry },
  // Learning
  { id: "graduate", name: "Graduate", emoji: "🎓", desc: "Earn a high school diploma.", check: (p) => degree(p, "highschool") },
  { id: "bachelor", name: "Bachelor of Something", emoji: "📜", desc: "Earn a university degree.", check: (p) => degree(p, "bachelor") },
  { id: "doctor", name: "Doctor", emoji: "⚕️", desc: "Graduate from medical school.", check: (p) => degree(p, "md") },
  { id: "esquire", name: "Esquire", emoji: "⚖️", desc: "Graduate from law school.", check: (p) => degree(p, "jd") },
  { id: "polymath", name: "Polymath", emoji: "🧠", desc: "Reach 95 Smarts.", check: (p) => p.smarts >= 95 },
  { id: "hobby_master", name: "Master of a Craft", emoji: "🎨", desc: "Reach 90 skill in a hobby.", check: (p) => Object.values(p.hobbies).some((v) => v >= 90) },
  { id: "novelist", name: "Bestselling Author", emoji: "✍️", desc: "Write a bestselling novel.", check: (p) => has(p, "hm:writing:80") },
  { id: "grandmaster", name: "Grandmaster", emoji: "♟️", desc: "Earn the chess grandmaster title.", check: (p) => has(p, "hm:chess:90") },
  // Love & family
  { id: "married", name: "Tied the Knot", emoji: "💍", desc: "Get married.", check: (p) => p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "married") },
  { id: "divorced", name: "It's Complicated", emoji: "💔", desc: "Go through a divorce.", check: (p) => has(p, "was_divorced") },
  { id: "parent", name: "Parent", emoji: "🍼", desc: "Have a child.", check: (p) => p.stats.childrenBorn >= 1 },
  { id: "big_family", name: "Full House", emoji: "🏡", desc: "Have four or more children.", check: (p) => p.stats.childrenBorn >= 4 },
  { id: "adopter", name: "Open Arms", emoji: "🤗", desc: "Adopt a child.", check: (p) => has(p, "adopted") },
  { id: "grandparent", name: "Grandparent", emoji: "👴", desc: "Meet your first grandchild.", check: (p) => p.relatives.some((r) => r.relation === "Grandchild") },
  { id: "orphan", name: "Alone Too Soon", emoji: "🕯️", desc: "Lose both parents before 18.", check: (p) => has(p, "orphan") },
  { id: "dynasty", name: "Dynasty", emoji: "👑", desc: "Play as the descendant of a previous life.", check: (p) => p.generation >= 2 },
  { id: "long_line", name: "Family Saga", emoji: "📚", desc: "Reach the fourth generation of your family.", check: (p) => p.generation >= 4 },
  // Work & fame
  { id: "famous", name: "Famous", emoji: "🌟", desc: "Reach 50 Fame.", check: (p) => p.fame >= 50 },
  { id: "superstar", name: "Household Name", emoji: "💫", desc: "Reach 90 Fame.", check: (p) => p.fame >= 90 },
  { id: "record_deal", name: "Record Deal", emoji: "🎤", desc: "Sign a record contract.", check: (p) => p.music.signed },
  { id: "diamond", name: "Diamond Certified", emoji: "💎", desc: "Release a Diamond-rated album.", check: (p) => p.music.albums.some((a) => a.rating === "Diamond") },
  { id: "a_list", name: "A-List", emoji: "🎬", desc: "Become an A-List movie star.", check: (p) => jobLine(p, "actor", 3) },
  { id: "pro_athlete", name: "Going Pro", emoji: "🏅", desc: "Play a season in a professional league.", check: (p) => p.athlete.record.proSeasons >= 1 || has(p, "athlete") },
  { id: "scholar_athlete", name: "Scholar-Athlete", emoji: "🎓", desc: "Win an athletic scholarship.", check: (p) => has(p, "athlete_scholar") },
  { id: "first_title", name: "Silverware", emoji: "🏆", desc: "Win a senior title.", check: (p) => p.athlete.record.titles >= 1 },
  { id: "serial_winner", name: "Serial Winner", emoji: "🏆", desc: "Win five titles.", check: (p) => p.athlete.record.titles >= 5 },
  { id: "podium", name: "On the Podium", emoji: "🥇", desc: "Win a medal at the Olympics or a World Cup.", check: (p) => p.athlete.record.medals >= 1 },
  { id: "world_class", name: "World Class", emoji: "⭐", desc: "Reach an athlete rating of 90.", check: (p) => p.athlete.record.bestRating >= 90 },
  { id: "iron_pro", name: "Iron Pro", emoji: "🛡️", desc: "Play ten seasons as a professional.", check: (p) => p.athlete.record.proSeasons >= 10 },
  { id: "comeback_kid", name: "Comeback Kid", emoji: "🩹", desc: "Return to play after a major injury.", check: (p) => has(p, "comeback") },
  { id: "sports_fortune", name: "Paid to Play", emoji: "💸", desc: "Earn $10,000,000 from sport.", check: (p) => p.athlete.record.earnings >= 10_000_000 },
  { id: "hall_of_fame", name: "Hall of Fame", emoji: "🏛️", desc: "Be inducted into your sport's Hall of Fame.", check: (p) => has(p, "hall_of_fame") },
  { id: "busted", name: "Busted", emoji: "💉", desc: "Fail a drug test.", check: (p) => has(p, "doping_caught") },
  { id: "fixer", name: "Fixer", emoji: "🎲", desc: "Be exposed for match-fixing.", check: (p) => has(p, "match_fixer") },
  { id: "entrepreneur", name: "Entrepreneur", emoji: "🏢", desc: "Own a business.", check: (p) => !!p.business },
  { id: "viral_million", name: "A Million Followers", emoji: "📱", desc: "Reach 1,000,000 followers.", check: (p) => p.influencer.followers >= 1_000_000 },
  { id: "full_time_creator", name: "Quit the Day Job", emoji: "🎬", desc: "Go full-time as a content creator.", check: (p) => p.influencer.fullTime },
  { id: "ten_k", name: "Micro-Influencer", emoji: "📈", desc: "Reach 10,000 followers.", check: (p) => p.influencer.peakFollowers >= 10_000 },
  { id: "recouped", name: "In the Black", emoji: "💿", desc: "Earn back a label advance in full.", check: (p) => p.music.albums.length > 0 && p.music.contract !== null && p.music.contract.unrecouped === 0 && p.music.albums.some((a) => a.royalty > 0) },
  { id: "award_winner", name: "And the Winner Is", emoji: "🏆", desc: "Win a music or film award.", check: (p) => p.music.awards.length > 0 || p.acting.awards.length > 0 },
  { id: "indie_artist", name: "Independent", emoji: "🎛️", desc: "Release an album on your own.", check: (p) => p.music.albums.some((a) => a.indie) },
  { id: "blockbuster", name: "Blockbuster", emoji: "🍿", desc: "Star in a blockbuster.", check: (p) => p.acting.credits.some((c) => c.outcome === "blockbuster" && c.role !== "producer") },
  { id: "politician", name: "Public Servant", emoji: "🏛️", desc: "Win an election.", check: (p) => jobLine(p, "politics") },
  { id: "head_of_state", name: "Head of State", emoji: "🌐", desc: "Become head of state.", check: (p) => jobLine(p, "politics", 4) },
  { id: "veteran", name: "Veteran", emoji: "🎖️", desc: "Serve in the armed forces.", check: (p) => has(p, "veteran") },
  { id: "ceo", name: "Top of the Ladder", emoji: "🪜", desc: "Reach the top rung of any corporate career.", check: (p) => p.stats.highestCareerTier >= 4 },
  // Royalty
  { id: "royal_born", name: "Born to Rule", emoji: "🤴", desc: "Be born into royalty.", check: (p) => has(p, "royal_born") },
  { id: "crowned", name: "Long Live the Crown", emoji: "👑", desc: "Become King or Queen.", check: (p) => p.royalRank === "King" || p.royalRank === "Queen" },
  { id: "exiled", name: "Deposed", emoji: "🚪", desc: "Lose your throne in a coup.", check: (p) => has(p, "exiled") },
  // Crime & trouble
  { id: "first_arrest", name: "Booked", emoji: "🚓", desc: "Get arrested.", check: (p) => p.stats.crimesCommitted >= 1 },
  { id: "crime_wave", name: "Crime Wave", emoji: "🦹", desc: "Commit ten crimes.", check: (p) => p.stats.crimesCommitted >= 10 },
  { id: "jailbird", name: "Jailbird", emoji: "⛓️", desc: "Serve five years in prison.", check: (p) => p.stats.yearsInPrison >= 5 },
  { id: "escapee", name: "Great Escape", emoji: "🏃", desc: "Break out of prison.", check: (p) => has(p, "escaped") },
  { id: "made_man", name: "Made Man", emoji: "🕴️", desc: "Join a crime family.", check: (p) => has(p, "made_man") },
  { id: "boss", name: "Capo di Tutti Capi", emoji: "🔫", desc: "Become a crime boss.", check: (p) => jobLine(p, "mafia", 4) },
  { id: "saint", name: "Saint", emoji: "😇", desc: "Reach 95 Karma.", check: (p) => p.karma >= 95 },
  { id: "recovered", name: "Clean and Sober", emoji: "🌅", desc: "Beat a serious addiction.", check: (p) => has(p, "was_addict") && Object.values(p.vices).every((v) => v < 5) },
  // Adult life (mature content)
  { id: "hookup_artist", name: "Social Butterfly", emoji: "🦋", desc: "Have ten casual encounters.", check: (p) => p.stats.hookups >= 10 },
  { id: "cheater", name: "Two-Timer", emoji: "🎭", desc: "Cheat on a partner.", check: (p) => has(p, "cheater") },
  { id: "open_rel", name: "Open Book", emoji: "🔓", desc: "Open up a relationship.", check: (p) => has(p, "open_relationship") },
  { id: "threesome", name: "Three's Company", emoji: "👥", desc: "Try a threesome.", check: (p) => has(p, "threesome") },
  { id: "swinger", name: "Club Regular", emoji: "🪩", desc: "Visit a swinger club.", check: (p) => has(p, "swinger") },
  { id: "adult_work", name: "Night Shift", emoji: "🔞", desc: "Work in the adult industry.", check: (p) => ["dancer", "escort", "creator"].includes(p.currentJob?.lineId ?? "") },
  { id: "sti_survivor", name: "Learned the Hard Way", emoji: "🩹", desc: "Catch an STI.", check: (p) => has(p, "had_sti") },
  // Darker paths
  { id: "murderer", name: "Blood on Your Hands", emoji: "🩸", desc: "Take a life.", check: (p) => p.stats.kills >= 1 },
  { id: "serial", name: "Serial Offender", emoji: "🕳️", desc: "Kill three people.", check: (p) => p.stats.kills >= 3 },
  { id: "death_row", name: "Dead Man Walking", emoji: "☠️", desc: "Be sentenced to death.", check: (p) => !!p.prison?.deathRow },
  { id: "perfect_crime", name: "The Perfect Crime", emoji: "🕵️", desc: "Let a murder investigation go cold.", check: (p) => has(p, "killer") && !has(p, "under_investigation") && p.stats.kills > 0 && p.age >= 40 },
  { id: "pet_parent", name: "Pet Parent", emoji: "🐾", desc: "Adopt a pet.", check: (p) => p.relatives.some((r) => r.relation === "Pet") },
  { id: "empire", name: "Empire Builder", emoji: "🏪", desc: "Run a business with three or more locations.", check: (p) => (p.business?.locations ?? 0) >= 3 },
  { id: "biz_profit", name: "In the Black", emoji: "🟢", desc: "Post your first profitable year as a business owner.", check: (p) => has(p, "biz_profit_year") },
  { id: "biz_decade", name: "Built to Last", emoji: "🏛️", desc: "Keep a business going for ten years.", check: (p) => has(p, "biz_survive_10") },
  { id: "biz_franchise", name: "Franchisor", emoji: "🍔", desc: "Sell three franchise units of your brand.", check: (p) => has(p, "biz_franchise") },
  { id: "biz_exit", name: "Exit Strategy", emoji: "🚪", desc: "Sell, float or be acquired at a profit.", check: (p) => has(p, "biz_exit") },
  { id: "biz_bankrupt", name: "Chapter Closed", emoji: "📉", desc: "Watch a business go bankrupt.", check: (p) => has(p, "biz_bankrupt") },
  { id: "biz_comeback", name: "Phoenix", emoji: "🔥", desc: "Run three profitable years after a bankruptcy.", check: (p) => has(p, "biz_comeback") },
  { id: "biz_unicorn", name: "Unicorn", emoji: "🦄", desc: "Own a business stake worth $50,000,000 or more.", check: (p) => has(p, "biz_unicorn") },
  { id: "partisan", name: "Party Loyalist", emoji: "🗳️", desc: "Join a political party.", check: (p) => p.politics.party !== null },
  // Longevity
  { id: "octogenarian", name: "Still Going", emoji: "🎂", desc: "Live to 80.", check: (p) => p.age >= 80 },
  { id: "centenarian", name: "Centenarian", emoji: "🧓", desc: "Live to 100.", check: (p) => p.age >= 100 },
];

export const ACHIEVEMENT_BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
