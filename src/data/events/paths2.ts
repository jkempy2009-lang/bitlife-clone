import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Vices, politics, military, the underworld, the economy, hobbies, law and late life.
export const PATHS2_EVENTS: LifeEvent[] = [
  // ---------- vices ----------
  ev("smoking_temptation", "health", 13, 30, "Behind the Bike Sheds", "Someone offers you a cigarette. 'Everyone does it.'", [
    risk("Try one", 0.55, ["It tasted awful. You didn't take another... yet.", { viceDelta: { smoking: 6 }, healthDelta: -1 }], ["You loved the rush. Uh-oh.", { viceDelta: { smoking: 22 }, healthDelta: -2, happinessDelta: 3 }]),
    opt("Say no thanks", "You said no. They respected it, mostly.", { karmaDelta: 1, healthDelta: 1 }),
    opt("Report them to a teacher", "You snitched. People noticed.", { karmaDelta: 2, relationshipDelta: { target: "Friend", delta: -8 } }),
  ], { once: true, weight: 1.5 }),
  ev("vape_craze", "health", 14, 35, "Vape Craze", "Everyone at the party is vaping something fruity.", [
    opt("Join in", "Mango ice. You'd be hooked within a month.", { viceDelta: { smoking: 14 }, happinessDelta: 2 }),
    opt("Pass", "You passed, and enjoyed fresh air.", {}),
  ], { once: true, weight: 0.8 }),
  ev("drinking_game", "health", 17, 40, "Beer Pong Champion", "The party is in full swing and the beer pong table calls to you.", [
    opt("Play to win", "You were crowned champion of the house. You can't remember how.", { viceDelta: { alcohol: 8 }, happinessDelta: 6, fameDelta: 1 }),
    opt("Be the designated driver", "Sober and smug, you drove everyone home.", { karmaDelta: 4, relationshipDelta: { target: "Friend", delta: 5 } }),
  ], { cooldown: 5 }),
  ev("drunk_blackout", "health", 18, 55, "Blackout", "You wake up with no memory of last night and a traffic cone in the bed.", [
    opt("Laugh it off", "Friends filled in the details. It was legendary.", { happinessDelta: 3, viceDelta: { alcohol: 4 } }),
    opt("Swear off drinking for a while", "Sobriety felt pretty good.", { viceDelta: { alcohol: -10 }, healthDelta: 2 }),
    opt("Check your phone with dread", "There were videos. There were so many videos.", { fameDelta: 1, happinessDelta: -4 }),
  ], { requires: { minVice: { alcohol: 15 } }, cooldown: 4 }),
  ev("intervention", "family", 20, 70, "Intervention", "Your loved ones have gathered to talk about your habits.", [
    opt("Listen and agree to change", "It was the hardest conversation of your life. You made a promise.", { viceDelta: { alcohol: -15, drugs: -15, gambling: -15, smoking: -10 }, relationshipDelta: { target: "All", delta: 10 }, happinessDelta: -2 }),
    opt("Storm out", "You slammed the door. Nobody called after you.", { relationshipDelta: { target: "All", delta: -15 }, happinessDelta: -4 }),
    opt("Deny everything", "You said it was just a phase. Everyone knew better.", { relationshipDelta: { target: "All", delta: -6 } }),
  ], { requires: { minVice: { alcohol: 50 } }, cooldown: 8, weight: 2 }),
  ev("addicted_relapse", "health", 20, 80, "Cravings", "A stressful week has the old cravings roaring back.", [
    risk("Resist", 0.55, ["You called your sponsor and held the line.", { happinessDelta: 3, karmaDelta: 2 }], ["You gave in. Back to square one.", { viceDelta: { alcohol: 12, smoking: 12, drugs: 10, gambling: 10 }, happinessDelta: -6 }]),
    opt("Call a friend for support", "A friend talked you through it.", { relationshipDelta: { target: "Friend", delta: 6 }, happinessDelta: 2 }),
  ], { requires: { custom: (p) => p.flags.includes("was_addict") }, cooldown: 4 }),
  ev("casino_trip", "money", 21, 80, "Vegas, Baby", "A weekend in Vegas is calling your name.", [
    risk("Bet big ($5,000)", 0.45, ["Lady Luck smiled. You walked out $12,000 up.", { bankBalanceDelta: 7000, happinessDelta: 8, viceDelta: { gambling: 6 } }], ["The house always wins.", { bankBalanceDelta: -5000, happinessDelta: -6, viceDelta: { gambling: 10 } }]),
    opt("Play the slots with $200", "Cheap thrills and free drinks.", { bankBalanceDelta: -200, happinessDelta: 3, viceDelta: { gambling: 2 } }),
    opt("See a show instead", "You saw a magician. He was better than the roulette wheel.", { bankBalanceDelta: -150, happinessDelta: 5 }),
  ], { requires: { minBank: 5000 }, cooldown: 5 }),
  ev("gambling_debt", "money", 21, 70, "Loan Shark", "Your gambling debts have attracted unwelcome attention.", [
    opt("Pay what you owe ($12,000)", "You paid up. Your wallet screams.", { bankBalanceDelta: -12000, viceDelta: { gambling: -10 } }),
    risk("Run", 0.4, ["You vanished from their radar. For now.", { happinessDelta: -4, karmaDelta: -3 }], ["They found you. It was not a friendly chat.", { healthDelta: -20, bankBalanceDelta: -15000 }], "health"),
    opt("Go to the police", "The police took a statement. The sharks were arrested.", { karmaDelta: 3, happinessDelta: -3 }),
  ], { requires: { minVice: { gambling: 45 } }, cooldown: 8 }),
  ev("drug_friend_offer", "crime", 16, 45, "A Friend With Pills", "A friend offers you something that 'takes the edge off'.", [
    risk("Take it", 0.5, ["It was fine. It was also not nothing.", { viceDelta: { drugs: 14 }, happinessDelta: 4, healthDelta: -2 }], ["It hit you far harder than expected. ER, stomach pump, shame.", { viceDelta: { drugs: 20 }, healthDelta: -15, bankBalanceDelta: -2500, happinessDelta: -8 }], "health"),
    opt("Refuse", "You said no and left.", { karmaDelta: 2 }),
  ], { cooldown: 6 }),
  ev("clean_streak", "health", 18, 90, "Clean Streak", "It's been a year since your last craving.", [
    opt("Celebrate with a milestone dinner", "Your friends cheered. You cried a little.", { viceDelta: { alcohol: -10, drugs: -10, smoking: -10, gambling: -10 }, happinessDelta: 8, relationshipDelta: { target: "All", delta: 4 } }),
    opt("Stay quietly proud", "A quiet moment of pride.", { happinessDelta: 4 }),
  ], { requires: { custom: (p) => p.flags.includes("was_addict") && Object.values(p.vices).every((v) => v < 10) }, once: true, weight: 3 }),
  ev("smoker_cough", "health", 30, 80, "That Cough", "Your morning cough is getting worse.", [
    opt("Quit smoking cold turkey", "A rough month, then daylight.", { viceDelta: { smoking: -30 }, healthDelta: 3, happinessDelta: -2 }),
    opt("Try the patch ($80)", "The patch helped. You cut way back.", { bankBalanceDelta: -80, viceDelta: { smoking: -20 }, healthDelta: 2 }),
    opt("Light another one", "You lit another. The cough laughed.", { healthDelta: -3 }),
  ], { requires: { minVice: { smoking: 20 } }, cooldown: 5 }),

  // ---------- politics ----------
  ev("political_scandal", "career", 25, 80, "Political Scandal", "A leaked email suggests you misused public funds.", [
    opt("Apologise and repay", "You repaid every cent. The press moved on.", { bankBalanceDelta: -15000, karmaDelta: 3, fameDelta: -3 }),
    risk("Deny everything", 0.5, ["The story fizzled. Your lawyer is smug.", { fameDelta: 1 }], ["Documents surfaced. Your approval ratings collapsed.", { fameDelta: -8, karmaDelta: -6, loseJob: true, happinessDelta: -10 }]),
    opt("Blame an intern", "It worked, which is a worrying thing about politics.", { karmaDelta: -8, fameDelta: -1 }),
  ], { requires: { jobLine: ["politics"] }, cooldown: 6 }),
  ev("debate_night", "career", 25, 80, "Debate Night", "You're on stage in a televised debate.", [
    risk("Go for the throat", 0.45, ["Your zinger went viral. The polls jumped.", { fameDelta: 5, happinessDelta: 8, skillDeltas: { charisma: 3 } }], ["You attacked too hard. Voters recoiled.", { fameDelta: -3, happinessDelta: -6 }], "smarts"),
    opt("Stay statesmanlike", "You stayed calm and above the fray.", { fameDelta: 1, karmaDelta: 3 }),
  ], { requires: { jobLine: ["politics"] }, cooldown: 4 }),
  ev("lobbyist_offer", "career", 25, 80, "Lobbyist Lunch", "A lobbyist slides an envelope across the table: 'A donation. For your campaign.'", [
    risk("Take it", 0.55, ["You pocketed $50,000 and nobody noticed.", { bankBalanceDelta: 50000, karmaDelta: -10 }], ["An undercover reporter caught the whole thing.", { karmaDelta: -10, loseJob: true, fameDelta: -10, arrest: { name: "Bribery", description: "Hidden cameras caught you accepting cash from a lobbyist.", years: 3, severity: "serious" } }]),
    opt("Refuse and report it", "You turned him in and got a boost for integrity.", { karmaDelta: 8, fameDelta: 3 }),
  ], { requires: { jobLine: ["politics"] }, cooldown: 8 }),
  ev("town_hall", "career", 25, 80, "Town Hall", "A packed town hall meeting turns rowdy.", [
    opt("Answer every question", "You stayed until midnight answering questions. Constituents were impressed.", { fameDelta: 2, karmaDelta: 2, healthDelta: -1 }),
    opt("Leave early", "You left through the back door. Someone live-tweeted it.", { fameDelta: -2 }),
  ], { requires: { jobLine: ["politics"] }, cooldown: 3 }),
  ev("crisis_response", "career", 28, 80, "Crisis!", "A natural disaster strikes your constituency.", [
    opt("Lead the response personally", "You waded into the floodwaters in a hi-vis vest. The nation noticed.", { fameDelta: 6, karmaDelta: 6, happinessDelta: 3, healthDelta: -2 }),
    opt("Send a statement from your office", "A statement was released. Nobody believed you cared.", { fameDelta: -4, karmaDelta: -3 }),
  ], { requires: { jobLine: ["politics"] }, cooldown: 8 }),

  // ---------- military ----------
  ev("boot_camp", "career", 17, 40, "Boot Camp", "Basic training has begun. The sergeant knows your name. You wish he didn't.", [
    opt("Push through", "You graduated at the top of your platoon.", { healthDelta: 6, smartsDelta: 1, happinessDelta: 5, skillDeltas: { athletics: 6 } }),
    opt("Struggle quietly", "You scraped through by the skin of your teeth.", { healthDelta: 3, happinessDelta: -2 }),
  ], { requires: { jobLine: ["military"] }, once: true, weight: 4 }),
  ev("deployment", "career", 18, 50, "Deployment Orders", "Your unit is being deployed overseas.", [
    risk("Serve with distinction", 0.6, ["You returned home decorated and tougher than before.", { happinessDelta: 4, karmaDelta: 3, performanceDelta: 10, fameDelta: 1 }], ["You saw things no one should see. You came home changed.", { diseaseTrigger: "ptsd", happinessDelta: -10, performanceDelta: 5 }]),
    opt("Request a desk assignment", "You stayed on base. It was safe and boring.", { performanceDelta: -4, happinessDelta: 1 }),
  ], { requires: { jobLine: ["military"] }, cooldown: 4 }),
  ev("medal_of_honour", "career", 18, 55, "Medal of Honour", "Your commander calls you in: you've been recommended for a decoration.", [
    opt("Accept humbly", "Your family wept with pride.", { fameDelta: 5, karmaDelta: 6, happinessDelta: 8 }),
    opt("Tell them others deserve it more", "Your modesty made you a legend in the barracks.", { karmaDelta: 8, happinessDelta: 4 }),
  ], { requires: { jobLine: ["military"] }, once: true, weight: 0.6 }),
  ev("veteran_reunion", "general", 30, 90, "Old Comrades", "A veterans' reunion is happening in town.", [
    opt("Attend", "You swapped stories and tears with the people who know.", { happinessDelta: 7, addRelative: { relation: "Friend", ageOffset: [-6, 6] } }),
    opt("Stay home", "You stayed home with your memories.", { happinessDelta: -2 }),
  ], { requires: { flagsAll: ["veteran"] }, cooldown: 8 }),
  ev("vet_benefits", "money", 30, 90, "Veteran's Benefits", "You're eligible for a veterans' benefit package.", [
    opt("Claim it", "The paperwork was endless, but worth it. Extra $6,000.", { bankBalanceDelta: 6000, happinessDelta: 2 }),
    opt("Ignore the forms", "Bureaucracy won again.", {}),
  ], { requires: { flagsAll: ["veteran"] }, once: true }),

  // ---------- underworld ----------
  ev("mob_job_offer", "crime", 18, 70, "A Job That Can't Wait", "Your capo hands you a bag. 'Deliver this. Don't look inside.'", [
    risk("Deliver it without question", 0.7, ["The drop went smoothly. Your standing rose.", { bankBalanceDelta: 8000, performanceDelta: 10, karmaDelta: -3 }], ["It was a set-up. Cops swarmed the drop.", { arrest: { name: "Drug Trafficking", description: "A sting operation caught you holding the delivery.", years: 6, severity: "serious" }, karmaDelta: -6 }]),
    opt("Open the bag", "You looked. You really shouldn't have.", { performanceDelta: -15, karmaDelta: -1 }),
    opt("Hand it back and refuse", "The room went cold. They'll remember.", { performanceDelta: -20 }),
  ], { requires: { jobLine: ["mafia"] }, cooldown: 3 }),
  ev("mob_loyalty_test", "crime", 20, 70, "Loyalty Test", "The boss suspects someone in the crew is talking to the feds.", [
    opt("Point the finger at someone else", "You fingered a rival. They were never seen again.", { karmaDelta: -12, performanceDelta: 12 }),
    opt("Stay silent", "You said nothing. The boss watched you closely.", { performanceDelta: 0 }),
    opt("Go to the police", "You wore a wire. It was the bravest, most dangerous thing you've done.", { karmaDelta: 10, loseJob: true, bankBalanceDelta: 25000, happinessDelta: -5 }),
  ], { requires: { jobLine: ["mafia"] }, once: true }),
  ev("mob_wedding", "crime", 20, 70, "A Wedding with Guests You Don't Ask About", "You're invited to the family boss's daughter's wedding.", [
    opt("Give a generous envelope ($5,000)", "A generous gift. Your name was said approvingly.", { bankBalanceDelta: -5000, performanceDelta: 10 }),
    opt("Dance with the boss's mother", "She adored you. The boss noticed.", { performanceDelta: 8, happinessDelta: 3 }),
  ], { requires: { jobLine: ["mafia"] }, cooldown: 6 }),

  // ---------- economy ----------
  ev("recession_layoffs", "career", 20, 64, "Hiring Freeze", "The recession is biting. Your company just announced layoffs.", [
    opt("Volunteer for a pay cut", "You took a 10% pay cut and kept your job.", { salaryPct: -10, performanceDelta: 4, happinessDelta: -3 }),
    opt("Work twice as hard", "You put in unpaid hours. You kept your seat.", { performanceDelta: 12, happinessDelta: -5, healthDelta: -2 }),
    opt("Start job hunting quietly", "You updated your CV on your lunch break.", { happinessDelta: -1 }),
  ], { requires: { hasJob: true, climate: ["recession"] }, cooldown: 3, weight: 2 }),
  ev("boom_bonus", "career", 20, 64, "Boom Time Bonus", "The economy is booming and your company is flush.", [
    opt("Take the bonus ($8,000)", "A fat bonus. Dinner is on you.", { bankBalanceDelta: 8000, happinessDelta: 6 }),
    opt("Invest the bonus", "Straight into your index fund.", { bankBalanceDelta: 4000, smartsDelta: 1 }),
  ], { requires: { hasJob: true, climate: ["boom"] }, cooldown: 3, weight: 2 }),
  ev("housing_bubble", "money", 25, 70, "Bubble Talk", "Everyone on TV is saying the housing market is overheating.", [
    opt("Sell now and rent", "You sold at the top. Smart, or lucky.", { bankBalanceDelta: 15000, happinessDelta: 3 }),
    opt("Hold on tight", "You held on. Long-term thinking.", { smartsDelta: 1 }),
  ], { requires: { hasProperty: true, climate: ["boom"] }, cooldown: 8 }),
  ev("stimulus_cheque", "money", 18, 90, "Stimulus Cheque", "The government is sending everyone a stimulus cheque.", [
    opt("Spend it", "You bought something you didn't need. It felt great.", { bankBalanceDelta: 1200, happinessDelta: 4 }),
    opt("Save it", "You stashed it in savings.", { bankBalanceDelta: 1200, smartsDelta: 1 }),
  ], { requires: { climate: ["recession"] }, cooldown: 4 }),
  ev("small_business_loan", "money", 22, 65, "Small Business Boost", "A government scheme offers cheap loans to entrepreneurs.", [
    opt("Apply", "You got $20,000 at a low rate. Time to hustle.", { bankBalanceDelta: 20000, happinessDelta: 3 }),
    opt("Skip", "You skipped the paperwork.", {}),
  ], { requires: { flagsAll: ["business_owner"], climate: ["recession", "normal"] }, cooldown: 6 }),

  // ---------- hobbies & growth ----------
  ev("art_commission", "career", 18, 80, "A Commission", "A stranger asks you to paint a portrait for $1,500.", [
    opt("Take the commission", "The portrait took weeks. The client wept with joy.", { bankBalanceDelta: 1500, hobbyDelta: { painting: 6 }, happinessDelta: 5 }),
    opt("Decline", "You declined. Painting should stay a passion.", {}),
  ], { requires: { custom: (p) => (p.hobbies.painting ?? 0) >= 40 }, cooldown: 4 }),
  ev("writing_contest", "career", 14, 90, "Writing Contest", "A local newspaper is running a short story contest.", [
    risk("Enter your best story", 0.4, ["You won first prize and $2,000!", { bankBalanceDelta: 2000, hobbyDelta: { writing: 8 }, happinessDelta: 8, fameDelta: 1 }], ["You didn't place. You got a polite email.", { hobbyDelta: { writing: 3 }, happinessDelta: -2 }]),
    opt("Skip it", "Next time.", {}),
  ], { requires: { custom: (p) => (p.hobbies.writing ?? 0) >= 35 }, cooldown: 4 }),
  ev("chess_hustler", "general", 14, 90, "Park Hustler", "A chess hustler challenges you to a game for $50.", [
    risk("Accept", 0.5, ["You checkmated him in 14 moves. $50 richer.", { bankBalanceDelta: 50, hobbyDelta: { chess: 5 }, happinessDelta: 5 }], ["He destroyed you in eight moves. You owe $50.", { bankBalanceDelta: -50, hobbyDelta: { chess: 2 }, happinessDelta: -2 }], "smarts"),
    opt("Walk away", "You walked away. Boo.", {}),
  ], { requires: { custom: (p) => (p.hobbies.chess ?? 0) >= 30 }, cooldown: 4 }),
  ev("cooking_viral", "fame", 16, 80, "Viral Recipe", "Your pasta recipe took off online.", [
    opt("Start a food blog", "Your blog grew and you became a minor foodie celebrity.", { fameDelta: 5, bankBalanceDelta: 2500, hobbyDelta: { cooking: 6 } }),
    opt("Open a pop-up", "Your pop-up sold out. A restaurateur left their card.", { fameDelta: 4, bankBalanceDelta: 6000 }),
  ], { requires: { custom: (p) => (p.hobbies.cooking ?? 0) >= 55 }, once: true }),
  ev("open_source_drama", "career", 18, 70, "Open Source Drama", "A maintainer drama has turned your project into a battleground.", [
    opt("Step down gracefully", "You handed the project over. It survived.", { karmaDelta: 3, happinessDelta: 2 }),
    opt("Fork it", "Your fork got more stars. Allegedly the original is bitter.", { fameDelta: 2, hobbyDelta: { coding: 4 } }),
  ], { requires: { custom: (p) => (p.hobbies.coding ?? 0) >= 60 }, once: true }),
  ev("photo_exhibit", "fame", 18, 80, "Your Photo Goes Viral", "A news site picked up your photograph.", [
    opt("License it ($5,000)", "A big publication paid for it.", { bankBalanceDelta: 5000, fameDelta: 2, hobbyDelta: { photography: 6 } }),
    opt("Share it freely", "Credit and thanks poured in.", { fameDelta: 3, karmaDelta: 3 }),
  ], { requires: { custom: (p) => (p.hobbies.photography ?? 0) >= 50 }, once: true }),

  // ---------- legal ----------
  ev("lawsuit_slip", "money", 20, 80, "Slip and Fall", "You slipped on a wet floor at a supermarket.", [
    risk("Sue the supermarket", 0.5, ["The supermarket settled for $15,000.", { bankBalanceDelta: 15000, healthDelta: -3, happinessDelta: 5 }], ["The case was thrown out. Lawyer's fees stung.", { bankBalanceDelta: -3000, healthDelta: -3, happinessDelta: -3 }]),
    opt("Brush yourself off", "You limped out with some dignity.", { healthDelta: -3 }),
  ], { cooldown: 12, weight: 0.6 }),
  ev("wrongful_arrest", "crime", 18, 70, "Wrong Place, Wrong Time", "Police mistake you for a suspect and take you in for questioning.", [
    opt("Cooperate fully", "You were released after six hours with an apology.", { happinessDelta: -4 }),
    opt("Demand a lawyer ($3,000)", "Your lawyer got you out in an hour and sued the department.", { bankBalanceDelta: 4000, happinessDelta: 2 }),
    opt("Mouth off at the officers", "Your attitude earned you a night in the cells.", { happinessDelta: -6, karmaDelta: -2 }),
  ], { cooldown: 12, weight: 0.4 }),
  ev("parking_tickets", "money", 18, 80, "Parking Tickets", "A stack of unpaid parking tickets has become a monster.", [
    opt("Pay them all ($600)", "Your conscience is lighter, your wallet isn't.", { bankBalanceDelta: -600 }),
    risk("Contest them", 0.4, ["The judge dismissed half of them.", { bankBalanceDelta: -200 }], ["The judge added court costs.", { bankBalanceDelta: -900, happinessDelta: -2 }]),
    opt("Ignore them", "The letters got scarier.", { happinessDelta: -2 }),
  ], { requires: { hasVehicle: true }, cooldown: 8 }),
  ev("community_service_offer", "crime", 16, 60, "Community Service", "A judge gives you a chance to work off a minor infraction.", [
    opt("Do the hours", "You painted a fence and met some good people.", { karmaDelta: 5, happinessDelta: 2 }),
    opt("Skip them", "You skipped. A warrant was issued.", { karmaDelta: -3, bankBalanceDelta: -500 }),
  ], { requires: { custom: (p) => p.criminalRecord.length > 0 }, cooldown: 12, weight: 0.5 }),

  // ---------- mental health, relocation, late life ----------
  ev("panic_attack", "health", 14, 70, "Panic Attack", "Your chest tightens in the middle of a crowded train.", [
    opt("Seek help ($150)", "A doctor taught you breathing techniques. A lifeline.", { bankBalanceDelta: -150, happinessDelta: 4 }),
    opt("Tough it out", "It passed, but it kept returning.", { happinessDelta: -5 }),
    opt("Talk to a friend", "A friend sat with you and listened.", { happinessDelta: 3, relationshipDelta: { target: "Friend", delta: 6 } }),
  ], { requires: { maxStat: { happiness: 55 } }, cooldown: 6 }),
  ev("gratitude_journal", "health", 14, 90, "Gratitude", "A friend gifts you a gratitude journal.", [
    opt("Write in it daily", "Every night, three good things. It rewired your mood.", { happinessDelta: 7, smartsDelta: 1 }),
    opt("Regift it", "You regifted it.", {}),
  ], { cooldown: 12, weight: 0.5 }),
  ev("expat_homesick", "general", 22, 80, "Homesick", "Living abroad, you miss the food, the language, the faces.", [
    opt("Fly home for a visit ($1,500)", "You hugged your family at arrivals.", { bankBalanceDelta: -1500, happinessDelta: 8, relationshipDelta: { target: "Parent", delta: 8 } }),
    opt("Cook a taste of home", "You cooked something from your childhood. It almost worked.", { happinessDelta: 4, hobbyDelta: { cooking: 4 } }),
    opt("Embrace your new home", "You threw yourself into local life.", { happinessDelta: 5, skillDeltas: { charisma: 2 } }),
  ], { requires: { custom: (p) => p.residence.country !== p.birthCountry }, cooldown: 5 }),
  ev("visa_trouble", "general", 22, 80, "Visa Trouble", "Immigration wants to review your paperwork.", [
    opt("Hire an immigration lawyer ($2,500)", "Your lawyer smoothed things over.", { bankBalanceDelta: -2500, happinessDelta: -1 }),
    risk("Do it yourself", 0.55, ["The paperwork cleared. Phew.", { happinessDelta: 2 }], ["A form was filled out wrong. A very stressful month.", { happinessDelta: -8, bankBalanceDelta: -1800 }], "smarts"),
  ], { requires: { custom: (p) => p.residence.country !== p.birthCountry }, cooldown: 8 }),
  ev("retirement_boredom", "general", 62, 100, "Too Much Time", "Retirement was supposed to be relaxing. You are bored out of your mind.", [
    opt("Pick up a hobby", "You finally had time for the thing you always wanted to do.", { happinessDelta: 6, hobbyDelta: { gardening: 8 } }),
    opt("Volunteer", "You found purpose in helping others.", { karmaDelta: 6, happinessDelta: 6 }),
    opt("Go back to work part-time", "Some structure helped.", { bankBalanceDelta: 3000, happinessDelta: 3 }),
  ], { requires: { custom: (p) => p.pension > 0 }, cooldown: 6 }),
  ev("senior_travel", "general", 62, 100, "Golden Years Travel", "The travel brochures are calling.", [
    opt("Cruise the world ($12,000)", "Four months at sea. You made friends who send postcards.", { bankBalanceDelta: -12000, happinessDelta: 12, addRelative: { relation: "Friend", ageOffset: [-6, 6] } }),
    opt("Visit the family", "You toured the country visiting everyone.", { happinessDelta: 6, relationshipDelta: { target: "All", delta: 6 } }),
  ], { requires: { minBank: 12000 }, cooldown: 6 }),
  ev("legacy_letter", "family", 70, 100, "Legacy", "You consider what you'll leave behind.", [
    opt("Write letters for each loved one", "Words you'd never said aloud.", { relationshipDelta: { target: "All", delta: 10 }, happinessDelta: 4 }),
    opt("Plant a tree", "It will outlive all of us.", { happinessDelta: 5, karmaDelta: 4 }),
  ], { once: true }),
  ev("lifelong_regret", "general", 55, 100, "The Road Not Taken", "You think about a decision that changed everything.", [
    opt("Make peace with it", "Life is what it is. You smiled.", { happinessDelta: 5 }),
    opt("Reach out to the person you wronged", "You apologised. A long-overdue conversation.", { karmaDelta: 6, happinessDelta: 6 }),
    opt("Brood about it", "You brooded for months.", { happinessDelta: -5 }),
  ], { cooldown: 15 }),
];
