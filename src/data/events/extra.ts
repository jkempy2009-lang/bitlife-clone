import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// A second wave of scenarios: pets, hobbies, windfalls, chains, new career paths, and chaos.
export const EXTRA_EVENTS: LifeEvent[] = [
  // ---------- childhood & school ----------
  ev("dog_vet_bill", "money", 8, 90, "Vet Visit", "Your dog swallowed a sock. The vet has opinions.", [
    opt("Pay for the surgery ($900)", "The surgery was a success. The sock is in a jar on your shelf.", { bankBalanceDelta: -900, happinessDelta: 5, karmaDelta: 2 }),
    opt("Try home remedies", "Nature took its course. It was gross. The dog survived.", { happinessDelta: -3 }),
  ], { requires: { flagsAll: ["has_dog"] }, cooldown: 5 }),
  ev("dog_walks", "general", 8, 90, "Good Boy", "Your dog brings you its leash. Again.", [
    opt("Go on a long walk", "You walked for hours. Your dog was ecstatic, and so were you.", { healthDelta: 3, happinessDelta: 5 }),
    opt("Play fetch in the yard", "You played fetch until your arm hurt.", { happinessDelta: 4, healthDelta: 1 }),
    opt("Ignore the leash", "You ignored it. The dog sighed audibly.", { happinessDelta: -2 }),
  ], { requires: { flagsAll: ["has_dog"] }, cooldown: 3 }),
  ev("adopt_pet", "general", 12, 85, "Shelter Visit", "You walk past an animal shelter full of hopeful faces.", [
    opt("Adopt a dog", "You adopted a scruffy dog named Biscuit. Life is better.", { setFlags: ["has_dog"], happinessDelta: 10, bankBalanceDelta: -150, karmaDelta: 3 }),
    opt("Adopt a cat", "You adopted a cat who immediately ignored you. Perfect.", { setFlags: ["has_cat"], happinessDelta: 8, bankBalanceDelta: -100, karmaDelta: 3 }),
    opt("Volunteer for an afternoon", "You walked dogs for a few hours and left smelling like fur.", { karmaDelta: 4, happinessDelta: 3 }),
  ], { requires: { flagsNone: ["has_dog"], minBank: 200 }, cooldown: 8 }),
  ev("science_fair", "school", 8, 17, "Science Fair", "The school science fair is coming up and you need a project.", [
    risk("Build a volcano", 0.5, ["Your volcano erupted perfectly. First place!", { smartsDelta: 3, happinessDelta: 6, fameDelta: 1 }], ["The volcano exploded in the gym. Cleanup took hours.", { happinessDelta: -4, karmaDelta: -1 }]),
    risk("Attempt something ambitious", 0.35, ["Your experiment impressed the judges. You won a regional prize.", { smartsDelta: 6, happinessDelta: 8, bankBalanceDelta: 300 }], ["It didn't work, but you learned a lot.", { smartsDelta: 3 }], "smarts"),
    opt("Buy a project online", "You bought a ready-made kit. Nobody asked questions.", { karmaDelta: -2, smartsDelta: -1 }),
  ], { cooldown: 4 }),
  ev("class_clown", "school", 8, 17, "Class Clown", "You've got the whole class laughing. The teacher is not laughing.", [
    opt("Keep the jokes coming", "You got detention but a standing ovation at lunch.", { happinessDelta: 6, fameDelta: 1, skillDeltas: { charisma: 2 }, smartsDelta: -1 }),
    opt("Apologise and behave", "You behaved. The class was oddly disappointed.", { karmaDelta: 2 }),
    opt("Aim jokes at the teacher", "You roasted the teacher. It was brilliant. It was also a mistake.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: -6 }, karmaDelta: -2 }),
  ], { cooldown: 5 }),
  ev("exchange_student", "school", 14, 18, "Exchange Programme", "Your school offers a year abroad as an exchange student.", [
    opt("Go abroad", "You spent the year abroad. You learned a language and a lot about yourself.", { smartsDelta: 5, happinessDelta: 8, skillDeltas: { charisma: 3 }, bankBalanceDelta: -1500 }),
    opt("Host a visiting student", "You hosted a student from overseas. Dinner table debates were epic.", { smartsDelta: 2, happinessDelta: 4, addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
    opt("Stay home", "You stayed with your friends.", {}),
  ], { once: true }),
  ev("science_olympiad", "school", 12, 18, "Olympiad Team", "Your math teacher wants you on the competition team.", [
    risk("Join the team", 0.5, ["Your team won the regional trophy. You're basically a mathlete legend.", { smartsDelta: 5, happinessDelta: 7, fameDelta: 1 }], ["You choked on question 3. The team forgave you (mostly).", { smartsDelta: 2, happinessDelta: -3 }], "smarts"),
    opt("Decline", "You skipped the club. The trophy case remained empty.", {}),
  ], { requires: { minStat: { smarts: 55 } }, once: true }),
  ev("college_roommate_friend", "school", 18, 24, "Study Group", "A classmate invites you to a study group.", [
    opt("Join the group", "You aced the exams together and became fast friends.", { smartsDelta: 3, addRelative: { relation: "Friend", ageOffset: [-2, 3] } }),
    opt("Study alone", "You studied alone in the library. Efficient, if lonely.", { smartsDelta: 2 }),
  ], { requires: { inSchool: true }, cooldown: 4 }),
  ev("thesis_crunch", "school", 20, 26, "All-Nighter", "Your big paper is due tomorrow and you've written one sentence.", [
    risk("Pull an all-nighter", 0.65, ["You finished at 6am and got an A-minus. Coffee is a food group.", { smartsDelta: 2, healthDelta: -2 }], ["You fell asleep on the keyboard. The paper contained 4,000 letter Ls.", { happinessDelta: -6, smartsDelta: -1 }]),
    opt("Ask for an extension", "The professor was kind this time.", { happinessDelta: 2 }),
    risk("Buy an essay online", 0.5, ["It worked. You feel awful but your GPA doesn't.", { karmaDelta: -5, smartsDelta: -1 }], ["The essay was plagiarised. Academic probation.", { karmaDelta: -5, happinessDelta: -10 }]),
  ], { requires: { inSchool: true }, cooldown: 3 }),

  // ---------- teens & sports ----------
  ev("sports_academy", "school", 12, 18, "Scouted!", "A scout noticed you at a school match and suggests a sports academy.", [
    opt("Join the academy", "Early mornings, hard drills, sore legs. Your athleticism skyrockets.", { skillDeltas: { athletics: 12 }, healthDelta: 4, happinessDelta: 4, setFlags: ["athlete_dream"], bankBalanceDelta: -500 }),
    opt("Stay a casual player", "You played for fun and kept your weekends.", { skillDeltas: { athletics: 3 }, happinessDelta: 3 }),
    opt("Turn it down", "Sports aren't your thing.", {}),
  ], { once: true, requires: { minStat: { health: 55 } } }),
  ev("big_match", "school", 13, 20, "Big Game", "The championship match is today and you're in the squad.", [
    risk("Play the game of your life", 0.45, ["You scored the winning point. The crowd chanted your name.", { happinessDelta: 12, fameDelta: 3, skillDeltas: { athletics: 4 } }], ["You missed the decisive shot. The silence on the bus home was long.", { happinessDelta: -8, skillDeltas: { athletics: 1 } }], "health"),
    opt("Play it safe", "You played a solid supporting role. The team lost, but not because of you.", { happinessDelta: 1, skillDeltas: { athletics: 2 } }),
  ], { requires: { flagsAll: ["athlete_dream"] }, cooldown: 3 }),
  ev("pro_scout", "career", 17, 28, "Pro Scout", "A pro scout slips you a card. 'Call me, kid.'", [
    opt("Call the scout", "The scout invites you to a training camp. Your sporting career could begin.", { skillDeltas: { athletics: 5 }, happinessDelta: 8, fameDelta: 2 }),
    opt("Ignore it", "You let the chance pass.", { happinessDelta: -2 }),
  ], { requires: { flagsAll: ["athlete_dream"], flagsNone: ["athlete"], minStat: { health: 60 } }, once: true }),
  ev("pro_athlete_contract", "career", 18, 36, "Contract Talks", "Your agent says the club wants to renegotiate.", [
    risk("Hold out for more", 0.45, ["You got a 25% raise!", { salaryPct: 25, happinessDelta: 6, fameDelta: 1 }], ["The club called your bluff. Salary cut.", { salaryPct: -10, happinessDelta: -6 }]),
    opt("Sign the extension", "You signed a modest extension. Security feels good.", { salaryPct: 8, happinessDelta: 3 }),
  ], { requires: { flagsAll: ["athlete"] }, cooldown: 4 }),
  ev("doping_offer", "crime", 18, 35, "Performance Enhancement", "A trainer whispers about a 'supplement' that's untraceable.", [
    risk("Take it", 0.55, ["Your numbers went through the roof. Nobody noticed.", { skillDeltas: { athletics: 8 }, healthDelta: -4, karmaDelta: -8 }], ["You failed a drug test. Banned and publicly shamed.", { loseJob: true, fameDelta: -15, karmaDelta: -8, happinessDelta: -15 }]),
    opt("Report him", "You reported the trainer. Locker rooms are cold places now.", { karmaDelta: 6, happinessDelta: -2 }),
    opt("Decline", "You trained clean.", { karmaDelta: 2 }),
  ], { requires: { flagsAll: ["athlete"] }, once: true }),
  ev("endorsement_sports", "fame", 18, 38, "Endorsement Deal", "A sportswear brand wants you in its next campaign.", [
    opt("Sign the deal ($60,000)", "The ads were everywhere. So was your face.", { bankBalanceDelta: 60000, fameDelta: 4, happinessDelta: 5 }),
    opt("Hold out for a bigger brand", "You waited. A bigger brand came knocking.", { bankBalanceDelta: 120000, fameDelta: 5, happinessDelta: 7 }),
  ], { requires: { flagsAll: ["athlete"], minStat: { fame: 20 } }, cooldown: 4 }),

  // ---------- business & money ----------
  ev("biz_review", "money", 20, 80, "Bad Review", "A one-star review has gone viral for your business.", [
    opt("Respond graciously", "You replied politely and offered a free meal. Public opinion flipped.", { karmaDelta: 3, happinessDelta: 2 }),
    opt("Respond with sarcasm", "Your sarcastic reply was screenshotted 40,000 times.", { fameDelta: 3, happinessDelta: -3, karmaDelta: -2 }),
    opt("Ignore it", "The review fades into the internet's noise.", {}),
  ], { requires: { flagsAll: ["business_owner"] }, cooldown: 4 }),
  ev("biz_inspection", "money", 20, 80, "Health Inspector", "An inspector arrives unannounced.", [
    risk("Welcome them in", 0.7, ["You passed with flying colours.", { happinessDelta: 4, smartsDelta: 1 }], ["You were fined for several violations.", { bankBalanceDelta: -4000, happinessDelta: -4 }]),
    risk("Offer a 'gift'", 0.3, ["The inspector pocketed it and left.", { bankBalanceDelta: -500, karmaDelta: -6 }], ["Attempted bribery. The police were called.", { karmaDelta: -8, arrest: { name: "Bribery", description: "An inspector reported your attempted bribe.", years: 2, severity: "serious" } }]),
  ], { requires: { flagsAll: ["business_owner"] }, cooldown: 6 }),
  ev("biz_investor", "money", 22, 70, "Angel Investor", "An investor offers $200,000 for a 30% share of your business.", [
    opt("Take the money", "You took the deal. Cash flooded your accounts.", { bankBalanceDelta: 200000, happinessDelta: 6 }),
    opt("Bootstrap on your own", "You declined. It's your baby.", { smartsDelta: 1 }),
  ], { requires: { flagsAll: ["business_owner"] }, cooldown: 8 }),
  ev("windfall_inheritance", "money", 25, 80, "Distant Relative", "A lawyer calls: a great-aunt you barely knew left you something.", [
    opt("Accept the estate", "You inherited $30,000 and a very old cat.", { bankBalanceDelta: 30000, happinessDelta: 6, setFlags: ["has_cat"] }),
    opt("Donate it all", "You donated the inheritance to charity.", { karmaDelta: 12, happinessDelta: 4 }),
  ], { once: true, weight: 0.6 }),
  ev("crypto_boom", "money", 20, 70, "Crypto Mania", "Everyone at work is talking about a new coin.", [
    risk("Put in $10,000", 0.35, ["The coin tripled. You pulled out at the top.", { bankBalanceDelta: 20000, happinessDelta: 8 }], ["The coin collapsed. It was a rug pull.", { bankBalanceDelta: -10000, happinessDelta: -8 }]),
    risk("Put in $500 for fun", 0.45, ["Your $500 became $2,800.", { bankBalanceDelta: 2300, happinessDelta: 4 }], ["Your $500 vanished.", { bankBalanceDelta: -500, happinessDelta: -1 }]),
    opt("Ignore the hype", "You ignored it. Boring and safe.", { smartsDelta: 1 }),
  ], { requires: { minBank: 10500 }, cooldown: 8 }),
  ev("flat_tyre_money", "money", 18, 80, "Unexpected Bill", "Your car's gearbox died and the repair quote made you sit down.", [
    opt("Pay for the repair ($1,800)", "You paid and kept driving.", { bankBalanceDelta: -1800 }),
    opt("Buy a bus pass", "You took public transport for a while.", { happinessDelta: -3, healthDelta: 1 }),
  ], { requires: { hasVehicle: true }, cooldown: 4 }),
  ev("roof_leak", "money", 20, 90, "The Roof Leaks", "A storm has revealed a hole in your roof.", [
    opt("Hire a roofer ($3,500)", "The roofer fixed it. Dry at last.", { bankBalanceDelta: -3500, happinessDelta: 2 }),
    risk("DIY the repair", 0.5, ["You patched it yourself. It's ugly but works.", { smartsDelta: 1, happinessDelta: 3 }], ["You fell off the ladder.", { healthDelta: -12, bankBalanceDelta: -1000 }], "health"),
  ], { requires: { hasProperty: true }, cooldown: 6 }),
  ev("neighbour_feud", "general", 20, 90, "Neighbour From Hell", "Your neighbour's hedge is encroaching on your property line.", [
    opt("Talk to them nicely", "You sorted it out over tea. Surprisingly civil.", { karmaDelta: 3, happinessDelta: 3 }),
    opt("Trim the hedge at 6am", "You buzzed the hedge at dawn. Escalation commenced.", { happinessDelta: 1, karmaDelta: -3 }),
    risk("Sue them", 0.5, ["The judge sided with you. $2,000 in damages.", { bankBalanceDelta: 2000, happinessDelta: 4 }], ["The lawsuit was thrown out. Legal fees hurt.", { bankBalanceDelta: -3500, happinessDelta: -5 }]),
  ], { requires: { hasProperty: true }, cooldown: 8 }),
  ev("lottery_scratch", "money", 18, 90, "Scratch Card", "Someone left a scratch card on the bar.", [
    risk("Scratch it", 0.1, ["It's a winner! $1,000!", { bankBalanceDelta: 1000, happinessDelta: 8 }], ["It's a loser. Of course.", {}]),
    opt("Hand it to the bartender", "You handed it back. Karma noted.", { karmaDelta: 2 }),
  ], { cooldown: 5, weight: 0.6 }),

  // ---------- influencer / fame ----------
  ev("influencer_meetup", "fame", 14, 60, "Fan Meetup", "A thousand followers want to meet you at the mall.", [
    opt("Show up and sign things", "Hundreds queued up. You made so many friends.", { fameDelta: 3, happinessDelta: 8, skillDeltas: { charisma: 2 } }),
    opt("Livestream it", "You livestreamed the whole thing. Engagement exploded.", { fameDelta: 4, happinessDelta: 5 }),
    opt("Send a video message instead", "Fans were politely disappointed.", { fameDelta: -1 }),
  ], { requires: { flagsAll: ["influencer"], minStat: { fame: 30 } }, cooldown: 4 }),
  ev("influencer_scandal", "fame", 14, 60, "Cancelled?", "An old post resurfaced. The comments are not kind.", [
    opt("Apologise sincerely", "Your apology video won people over.", { fameDelta: -2, karmaDelta: 4, happinessDelta: -2 }),
    opt("Double down", "You doubled down. It either made you or broke you.", { fameDelta: 5, karmaDelta: -4, happinessDelta: -3 }),
    opt("Go offline for a while", "You logged off and touched grass.", { fameDelta: -6, happinessDelta: 5, healthDelta: 2 }),
  ], { requires: { flagsAll: ["influencer"], minStat: { fame: 30 } }, cooldown: 6 }),
  ev("reality_tv", "fame", 18, 55, "Reality TV Offer", "A producer wants you on a new reality show: 'Love Island Cooking Rescue'.", [
    risk("Accept", 0.6, ["You became a breakout star. The memes are everywhere.", { fameDelta: 12, bankBalanceDelta: 40000, happinessDelta: 8 }], ["You were edited as the villain. Ouch.", { fameDelta: 4, karmaDelta: -4, happinessDelta: -8 }], "looks"),
    opt("Decline", "You kept your dignity.", { karmaDelta: 1 }),
  ], { requires: { minStat: { looks: 55 } }, once: true }),
  ev("hollywood_cameo", "fame", 20, 70, "Cameo Offer", "A director wants you for a cameo in a blockbuster.", [
    opt("Do the cameo ($100,000)", "Your 8 seconds on screen made $100,000 and a thousand memes.", { bankBalanceDelta: 100000, fameDelta: 5, happinessDelta: 8 }),
    opt("Ask for a speaking role", "The director laughed, then gave you two lines.", { bankBalanceDelta: 150000, fameDelta: 7, skillDeltas: { acting: 4 } }),
  ], { requires: { minStat: { fame: 50 } }, cooldown: 6 }),
  ev("festival_headliner", "fame", 18, 60, "Festival Headliner", "A major festival wants you on the main stage.", [
    risk("Headline the show", 0.65, ["You electrified 80,000 people. The encore lasted an hour.", { fameDelta: 8, bankBalanceDelta: 250000, happinessDelta: 12, skillDeltas: { music: 3 } }], ["Your amp blew up and you forgot the lyrics.", { fameDelta: -4, happinessDelta: -8 }], "looks"),
    opt("Decline", "You skipped the festival and slept in.", {}),
  ], { requires: { careers: ["musician"] }, cooldown: 4 }),
  ev("band_breakup", "fame", 20, 60, "Creative Differences", "Your bandmates are arguing about the next album.", [
    opt("Mediate", "You brokered peace over pizza. The band lives.", { happinessDelta: 4, karmaDelta: 2 }),
    opt("Go solo", "You broke up the band and went solo. The tabloids went wild.", { fameDelta: 3, happinessDelta: -3, skillDeltas: { music: 2 } }),
    opt("Walk out", "You quit mid-rehearsal. Bridges burned.", { fameDelta: -4, happinessDelta: -4 }),
  ], { requires: { careers: ["musician"] }, cooldown: 8 }),
  ev("director_couch", "fame", 18, 50, "Shady Producer", "A powerful producer suggests you 'get to know him better' for a big role.", [
    opt("Report him", "You reported him. It cost you work, but the truth came out.", { karmaDelta: 10, happinessDelta: -3, fameDelta: 2 }),
    opt("Walk out and keep your dignity", "You left immediately. You lost the role but kept your integrity.", { karmaDelta: 4, happinessDelta: -2 }),
    opt("Play along", "You got the role. It haunts you.", { karmaDelta: -8, happinessDelta: -8, fameDelta: 4 }),
  ], { requires: { careers: ["actor"] }, once: true, weight: 0.7 }),

  // ---------- adult life & chaos ----------
  ev("mystery_letter", "general", 20, 70, "A Strange Letter", "An unsigned letter arrives: 'I know what you did.' There's a return address.", [
    opt("Visit the address", "You went... and found a surprise party. Wrong letter? Weird.", { queueEvent: "mystery_letter_2", happinessDelta: 3 }),
    opt("Burn the letter", "You burned the letter. The ashes smelled like lavender.", { happinessDelta: -1 }),
    opt("Call the police", "The police found it was a prank by an old friend.", { karmaDelta: 2 }),
  ], { once: true, weight: 0.5 }),
  ev("mystery_letter_2", "general", 20, 75, "The Plot Thickens", "The 'prank' wasn't a prank. A second letter has arrived, and this one is handwritten.", [
    risk("Open it", 0.5, ["It was a legacy letter from a long-lost relative with $12,000 enclosed.", { bankBalanceDelta: 12000, happinessDelta: 8 }], ["It was a scam, and a cheque with your signature appeared in an offshore account.", { bankBalanceDelta: -4000, happinessDelta: -6 }]),
    opt("Return to sender", "You wrote 'NOPE' on it. A statement.", {}),
  ], { once: true, weight: 0 }),
  ev("alien_sighting", "general", 14, 90, "Lights in the Sky", "You see strange lights hovering over your town.", [
    opt("Film it", "Your footage went mildly viral. It was probably a drone.", { fameDelta: 1, happinessDelta: 4 }),
    opt("Run inside", "You locked the door and hid under a blanket.", { happinessDelta: -1 }),
    opt("Wave at it", "You waved. It blinked twice and left. You'll never be sure.", { happinessDelta: 6, smartsDelta: 1 }),
  ], { once: true, weight: 0.4 }),
  ev("haunted_house", "general", 16, 70, "Haunted?", "Your new place makes weird noises at night.", [
    opt("Hire a ghost hunter ($400)", "The hunter found a family of raccoons. No ghosts. Probably.", { bankBalanceDelta: -400, happinessDelta: 2 }),
    opt("Embrace the haunting", "You named the ghost Gary. Gary is quiet now.", { happinessDelta: 5 }),
    opt("Move out", "You got out of there. No regrets.", { bankBalanceDelta: -1200, happinessDelta: -1 }),
  ], { requires: { hasProperty: true }, once: true, weight: 0.4 }),
  ev("flash_mob", "general", 14, 60, "Flash Mob", "A flash mob erupts in the square and someone hands you a tambourine.", [
    opt("Join in", "You danced like nobody was watching. Everyone was watching.", { happinessDelta: 8, fameDelta: 1, healthDelta: 1 }),
    opt("Film it", "You filmed it. Fifty likes.", { happinessDelta: 2 }),
    opt("Pretend you're not with them", "You slowly backed away.", {}),
  ], { cooldown: 8 }),
  ev("food_critic", "general", 20, 80, "Restaurant Roulette", "The new restaurant has a tasting menu of 14 courses.", [
    opt("Go for the full tasting menu ($250)", "Every course was a miracle. You cried at dessert.", { bankBalanceDelta: -250, happinessDelta: 8 }),
    opt("Order a burger", "The burger was the best thing you ate all year.", { bankBalanceDelta: -25, happinessDelta: 4 }),
    risk("Dine and dash", 0.6, ["You escaped without paying. Adrenaline!", { karmaDelta: -6, happinessDelta: 3 }], ["The waiter chased you into the car park. Police arrived.", { karmaDelta: -6, arrest: { name: "Theft of Services", description: "Security footage caught you leaving without paying.", years: 1, severity: "minor" } }]),
  ], { cooldown: 5 }),
  ev("tech_breakthrough", "career", 22, 55, "Eureka!", "You've had an idea at 3am that could transform your field.", [
    risk("Pitch it to your boss", 0.5, ["Your boss loved it. A big bonus and credit!", { bankBalanceDelta: 12000, performanceDelta: 12, happinessDelta: 8 }], ["Your boss stole the credit and filed the patent.", { performanceDelta: -4, happinessDelta: -8, karmaDelta: 0 }]),
    opt("Quit and build it yourself", "You went solo with your idea. The outcome is uncertain.", { loseJob: true, bankBalanceDelta: -8000, happinessDelta: 6, smartsDelta: 2 }),
    opt("Patent it quietly", "You patented the idea and waited. Time will tell.", { bankBalanceDelta: -2500, smartsDelta: 2 }),
  ], { requires: { hasJob: true, minStat: { smarts: 60 } }, once: true }),
  ev("workplace_accident", "career", 20, 65, "Workplace Accident", "A machine malfunctions at work.", [
    opt("Report the hazard", "You reported the hazard. Safer for everyone.", { karmaDelta: 3, performanceDelta: 3 }),
    risk("Try to fix it yourself", 0.5, ["You fixed it in minutes. Hero of the shift.", { performanceDelta: 6, happinessDelta: 4 }], ["It shocked you badly.", { healthDelta: -14, performanceDelta: -3, bankBalanceDelta: -800 }], "smarts"),
  ], { requires: { hasJob: true }, cooldown: 8 }),
  ev("company_party", "career", 20, 64, "Holiday Party", "The office holiday party has an open bar.", [
    opt("Behave professionally", "You mingled and left on time.", { performanceDelta: 2, happinessDelta: 2 }),
    risk("Do karaoke", 0.5, ["You killed 'Bohemian Rhapsody'. People cheered.", { happinessDelta: 8, performanceDelta: 3, skillDeltas: { music: 1 } }], ["You sang to the CEO's husband. It got weird.", { happinessDelta: -3, performanceDelta: -5 }]),
    opt("Fall asleep in the coat room", "Someone drew a moustache on you.", { looksDelta: -1, happinessDelta: -1 }),
  ], { requires: { hasJob: true }, cooldown: 4 }),
  ev("whistleblower", "career", 24, 62, "Dirty Secret", "You find out your company is dumping waste illegally.", [
    risk("Blow the whistle", 0.55, ["The press ran with it. The company was fined and you became a hero.", { karmaDelta: 14, fameDelta: 4, bankBalanceDelta: 15000, happinessDelta: 6 }], ["The company retaliated and fired you.", { karmaDelta: 14, loseJob: true, happinessDelta: -8 }]),
    opt("Stay silent", "You stayed quiet. Your conscience didn't.", { karmaDelta: -6, happinessDelta: -4 }),
    opt("Blackmail the company", "You demanded cash. It was both risky and profitable.", { bankBalanceDelta: 30000, karmaDelta: -14 }),
  ], { requires: { hasJob: true }, once: true, weight: 0.5 }),
  ev("promotion_politics", "career", 24, 62, "Office Politics", "A rival is gunning for your corner office.", [
    opt("Outwork them", "You outworked the rival. The boss noticed.", { performanceDelta: 8, happinessDelta: -3, healthDelta: -2 }),
    opt("Befriend them", "You made an ally of your rival. A smart move.", { performanceDelta: 3, karmaDelta: 3 }),
    opt("Spread a rumour about them", "The rumour spread. The rival was transferred. You feel slightly awful.", { performanceDelta: 5, karmaDelta: -8 }),
  ], { requires: { hasJob: true }, cooldown: 5 }),
  ev("jury_duty", "general", 21, 75, "Jury Duty", "A summons has arrived: you're on a jury.", [
    opt("Serve diligently", "You helped deliver a fair verdict.", { karmaDelta: 4, smartsDelta: 1 }),
    opt("Try to get out of it", "You claimed a weak excuse. The judge was unimpressed.", { karmaDelta: -1 }),
    opt("Convict them anyway because you're hungry", "You rushed the verdict. It wasn't your proudest moment.", { karmaDelta: -6 }),
  ], { cooldown: 12 }),
  ev("natural_disaster", "general", 10, 90, "Storm Warning", "A massive storm is bearing down on your city.", [
    opt("Evacuate early", "You left in time. Your place held up.", { bankBalanceDelta: -300, happinessDelta: -1 }),
    risk("Ride it out", 0.6, ["The storm passed. You made hurricane-party memories.", { happinessDelta: 4 }], ["Flooding damaged everything. You lost money and sleep.", { bankBalanceDelta: -6000, happinessDelta: -8, healthDelta: -4 }]),
    opt("Help your neighbours", "You helped others prepare and became a local hero.", { karmaDelta: 8, happinessDelta: 4, relationshipDelta: { target: "Friend", delta: 4 } }),
  ], { cooldown: 12 }),
  ev("viral_good_deed", "fame", 14, 80, "Caught on Camera", "A stranger filmed you doing something kind and it blew up.", [
    opt("Humbly accept the praise", "People called you a hero. You blushed.", { fameDelta: 4, karmaDelta: 4, happinessDelta: 6 }),
    opt("Hide from the attention", "You ducked the cameras. The story faded.", { happinessDelta: 1 }),
  ], { cooldown: 12, weight: 0.5 }),
  ev("gym_rival", "general", 18, 60, "Gym Rivalry", "A buff stranger keeps sneering at your deadlift.", [
    risk("Challenge them to a lift-off", 0.45, ["You outlifted them. Respect earned.", { healthDelta: 3, happinessDelta: 6, skillDeltas: { athletics: 2 } }], ["You pulled a back muscle in front of everyone.", { healthDelta: -6, happinessDelta: -5 }], "health"),
    opt("Ignore them", "You focused on your own routine.", { healthDelta: 1 }),
  ], { cooldown: 6 }),
  ev("fortune_teller", "general", 16, 90, "Fortune Teller", "A fortune teller at the fair grabs your hand: 'I see... great change!'", [
    opt("Pay $20 for a reading", "She said you'd find wealth and love. You'll see.", { bankBalanceDelta: -20, happinessDelta: 4 }),
    opt("Argue with her", "She cursed your sandwich. It fell on the floor.", { happinessDelta: -1 }),
    opt("Walk away", "You walked away. Probably for the best.", {}),
  ], { cooldown: 12, weight: 0.5 }),
  ev("lost_in_translation", "general", 22, 70, "Business Trip Abroad", "Your trip abroad goes sideways: wrong hotel, lost luggage, no phone signal.", [
    opt("Wing it with charm", "You charmed your way through it. Memories made.", { happinessDelta: 6, skillDeltas: { charisma: 2 } }),
    opt("Pay for a luxury suite ($800)", "You booked the penthouse. Problem solved.", { bankBalanceDelta: -800, happinessDelta: 3 }),
    opt("Call home and complain", "You complained to {mother}. They were sympathetic.", { happinessDelta: -2 }),
  ], { requires: { hasJob: true }, cooldown: 8 }),
  ev("mid_marathon", "health", 30, 65, "Fitness Wake-Up", "You get winded climbing a flight of stairs.", [
    opt("Start jogging", "You started jogging and surprised yourself.", { healthDelta: 5, looksDelta: 1, happinessDelta: 3 }),
    opt("Buy a bike ($600)", "You started cycling to work. Quads of steel.", { bankBalanceDelta: -600, healthDelta: 4, happinessDelta: 3 }),
    opt("Blame the stairs", "The stairs were designed poorly, you decided.", { happinessDelta: 1 }),
  ], { requires: { maxStat: { health: 70 } }, cooldown: 6 }),
  ev("therapy_breakthrough", "health", 18, 80, "Hard Conversations", "A friend suggests therapy. Your mood has been heavy.", [
    opt("Try therapy ($600)", "You started therapy and it worked wonders.", { bankBalanceDelta: -600, happinessDelta: 10 }),
    opt("Try journaling", "You wrote your feelings out each morning. A small but real shift.", { happinessDelta: 5, smartsDelta: 1 }),
    opt("Push it down", "You pushed it down. It didn't go away.", { happinessDelta: -4 }),
  ], { requires: { maxStat: { happiness: 50 } }, cooldown: 4 }),
  ev("food_allergy", "health", 3, 40, "Allergic Reaction", "You ate something and your lips began to swell.", [
    opt("Go to the ER", "The ER gave you an adrenaline shot. Close call.", { bankBalanceDelta: -1200, healthDelta: -3 }),
    risk("Take an antihistamine and hope", 0.7, ["The antihistamine did the trick.", {}], ["The reaction got worse.", { healthDelta: -15, bankBalanceDelta: -2500 }], "health"),
  ], { once: true, weight: 0.5 }),
  ev("blood_donation", "general", 18, 70, "Blood Drive", "A mobile blood drive is parked outside your office.", [
    opt("Donate blood", "You donated and got a free cookie. Heroic.", { karmaDelta: 6, happinessDelta: 3, healthDelta: -1 }),
    opt("Pass", "You were busy.", {}),
  ], { cooldown: 4 }),
  ev("viral_stunt_fail", "general", 14, 40, "Dumb Challenge", "Your friends dare you to do something on camera that is definitely a bad idea.", [
    risk("Do the stunt", 0.5, ["It worked and the video got a million views.", { fameDelta: 4, happinessDelta: 8 }], ["It went horribly wrong. A cast, and a hospital bill.", { healthDelta: -14, happinessDelta: -6, bankBalanceDelta: -1500 }], "health"),
    opt("Say no", "You said no. Your friends called you boring.", { happinessDelta: -1, smartsDelta: 1 }),
  ], { cooldown: 5 }),
  ev("lost_phone", "general", 14, 90, "Lost Phone", "You left your phone in a taxi.", [
    opt("Track it down", "You tracked it down. A kind driver returned it.", { karmaDelta: 1, happinessDelta: 2 }),
    opt("Buy a new one ($700)", "You bought a new phone. The upgrade felt good.", { bankBalanceDelta: -700, happinessDelta: 2 }),
    opt("Embrace digital detox", "A week without a phone? Surprisingly peaceful.", { happinessDelta: 4, healthDelta: 1 }),
  ], { cooldown: 8 }),

  // ---------- relationships ----------
  ev("proposal_planning", "romance", 20, 60, "Planning the Perfect Proposal", "You've been thinking about asking {partner} to marry you.", [
    opt("Rent a rooftop and propose", "You proposed on a rooftop at sunset. It was perfect.", { relationshipDelta: { target: "Partner", delta: 15 }, marry: true, happinessDelta: 12 }),
    opt("Propose casually at home", "You proposed on the couch. Simple and sincere.", { relationshipDelta: { target: "Partner", delta: 8 }, marry: true, happinessDelta: 8 }),
    opt("Wait a little longer", "You decided to wait.", {}),
  ], { requires: { hasPartner: true, custom: (p) => p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "dating" && r.relationshipBar >= 70 && r.age >= 18) && p.age >= 21 }, cooldown: 4, weight: 1.5 }),
  ev("in_laws", "romance", 22, 80, "Meet the In-Laws", "{partner}'s parents are visiting for two weeks.", [
    opt("Be the perfect host", "You cooked, cleaned, and charmed. They love you.", { relationshipDelta: { target: "Partner", delta: 6 }, happinessDelta: -1 }),
    opt("Plan activities every day", "You kept them busy. No awkward silences.", { happinessDelta: 2, bankBalanceDelta: -400 }),
    opt("Hide in the garage", "Hiding in the garage got old fast.", { relationshipDelta: { target: "Partner", delta: -8 }, happinessDelta: -2 }),
  ], { requires: { hasPartner: true }, cooldown: 6 }),
  ev("partner_career", "romance", 22, 55, "Big Opportunity Abroad", "{partner} got a job offer in another city.", [
    opt("Support them and relocate", "You moved for love. A fresh start.", { relationshipDelta: { target: "Partner", delta: 12 }, happinessDelta: 3, bankBalanceDelta: -2500 }),
    opt("Try long distance", "Long distance was rough, but you coped.", { relationshipDelta: { target: "Partner", delta: -6 }, happinessDelta: -3 }),
    opt("Ask them to stay", "They stayed, but their resentment lingered.", { relationshipDelta: { target: "Partner", delta: -10 } }),
  ], { requires: { hasPartner: true }, cooldown: 8 }),
  ev("friend_betrayal", "family", 14, 60, "Backstabber", "You find out {friend} has been talking behind your back.", [
    opt("Confront them", "You confronted them. They apologised, kind of.", { relationshipDelta: { target: "Friend", delta: -10 }, happinessDelta: -2 }),
    opt("Cut them out", "You cut them out of your life.", { relationshipDelta: { target: "Friend", delta: -30 }, happinessDelta: -3 }),
    opt("Return the favour", "You spread a story about them. Even.", { relationshipDelta: { target: "Friend", delta: -40 }, karmaDelta: -5, happinessDelta: 1 }),
  ], { requires: { hasFriend: true }, cooldown: 8 }),
  ev("surprise_party", "family", 14, 90, "Surprise!", "You walk into your house and everyone jumps out to shout 'Surprise!'.", [
    opt("Act delighted", "You acted delighted and secretly loved it.", { happinessDelta: 9, relationshipDelta: { target: "All", delta: 6 } }),
    opt("Scream and throw something", "You threw a cushion by reflex. It hit {friend}.", { happinessDelta: 3, relationshipDelta: { target: "Friend", delta: -4 } }),
  ], { cooldown: 10 }),
  ev("childs_question", "family", 22, 60, "Where Do Babies Come From?", "Your kid asks a very awkward question in a very public place.", [
    opt("Answer honestly", "You gave an age-appropriate answer. Your child was unfazed.", { relationshipDelta: { target: "Child", delta: 6 }, smartsDelta: 1 }),
    opt("Invent a story about storks", "You went with the stork. It held up for another year.", { relationshipDelta: { target: "Child", delta: 2 } }),
    opt("Change the subject to ice cream", "Ice cream solved it. For now.", { relationshipDelta: { target: "Child", delta: 4 }, bankBalanceDelta: -10 }),
  ], { requires: { hasChildren: true }, cooldown: 12 }),
  ev("kid_college", "family", 40, 65, "Tuition Time", "Your kid is heading to university.", [
    opt("Pay for everything ($30,000)", "You covered all costs. Your kid is overjoyed.", { bankBalanceDelta: -30000, relationshipDelta: { target: "Child", delta: 14 }, karmaDelta: 2 }),
    opt("Help with half ($15,000)", "You split the cost with your kid.", { bankBalanceDelta: -15000, relationshipDelta: { target: "Child", delta: 8 } }),
    opt("Let them handle it", "You let them take loans. They remembered.", { relationshipDelta: { target: "Child", delta: -10 } }),
  ], { requires: { hasChildren: true, minBank: 15000 }, once: true }),
  ev("parent_moves_in", "family", 35, 75, "Mum or Dad Moves In", "Your parent can no longer live alone safely.", [
    opt("Move them in", "You moved them in. It's cosy, noisy, and full of stories.", { relationshipDelta: { target: "Parent", delta: 14 }, happinessDelta: -2 }),
    opt("Pay for a carer ($12,000)", "You paid for a carer. They're comfortable.", { bankBalanceDelta: -12000, relationshipDelta: { target: "Parent", delta: 6 } }),
    opt("Tell them to manage", "You told them to manage. They were hurt.", { relationshipDelta: { target: "Parent", delta: -18 }, karmaDelta: -4 }),
  ], { requires: { parentAlive: true, custom: (p) => p.relatives.some((r) => r.relation === "Parent" && r.alive && r.age >= 72) }, once: true }),
  ev("sibling_wedding", "family", 20, 70, "Sibling's Big Day", "{sibling} is getting married and wants you as a groomsman/bridesmaid.", [
    opt("Throw them an unforgettable bachelor/bachelorette party", "It was epic. Details are classified.", { relationshipDelta: { target: "Sibling", delta: 12 }, bankBalanceDelta: -800, happinessDelta: 6 }),
    opt("Give a heartfelt speech", "You made the whole hall tear up.", { relationshipDelta: { target: "Sibling", delta: 10 }, happinessDelta: 5 }),
    opt("Show up late and sunburnt", "You showed up late. Photos will remember.", { relationshipDelta: { target: "Sibling", delta: -8 } }),
  ], { requires: { hasSibling: true }, cooldown: 12 }),
  ev("old_friend_reunion", "family", 25, 80, "Long-Lost Friend", "An old friend you lost touch with sends you a message.", [
    opt("Reconnect", "You caught up for hours. Nothing had changed and everything had.", { addRelative: { relation: "Friend", ageOffset: [-3, 3] }, happinessDelta: 6 }),
    opt("Leave them on read", "You did nothing. Perhaps for the best.", { happinessDelta: -1 }),
  ], { cooldown: 8 }),
  ev("custody_chaos", "family", 25, 60, "School Pickup Mix-Up", "You forgot to pick up your child from school.", [
    opt("Apologise profusely", "You apologised and made it up with ice cream.", { relationshipDelta: { target: "Child", delta: -2 }, bankBalanceDelta: -15 }),
    opt("Blame traffic", "Your child saw through it.", { relationshipDelta: { target: "Child", delta: -6 } }),
  ], { requires: { hasChildren: true, custom: (p) => p.relatives.some((r) => r.relation === "Child" && r.alive && r.age >= 4 && r.age <= 12) }, cooldown: 6 }),

  // ---------- crime & danger ----------
  ev("heist_crew", "crime", 20, 50, "The Crew", "An old friend has put together a crew for a jewellery heist. They need a driver.", [
    risk("Take the job", 0.35, ["The heist went perfectly. Your share: $60,000.", { bankBalanceDelta: 60000, karmaDelta: -12, happinessDelta: 6 }], ["It all went wrong. Sirens, chaos, and handcuffs.", { karmaDelta: -12, arrest: { name: "Armed Robbery", description: "The getaway car was identified and you were caught.", years: 8, severity: "heinous" } }]),
    opt("Say no", "You walked away. Wise.", { karmaDelta: 2 }),
    opt("Call the police", "You tipped off the police. The crew didn't forgive you.", { karmaDelta: 8, happinessDelta: -2 }),
  ], { once: true, weight: 0.6, requires: { minStat: { karma: 0 } } }),
  ev("road_rage", "crime", 18, 70, "Road Rage", "Someone cut you off and gave you a gesture.", [
    risk("Chase them down", 0.5, ["You tailgated them for a mile. They finally pulled over, apologised, and you drove off.", { happinessDelta: 3, karmaDelta: -3 }], ["It ended in a fender-bender and a shouting match. The police charged you.", { karmaDelta: -5, arrest: { name: "Reckless Driving", description: "A traffic camera caught you tailgating dangerously.", years: 1, severity: "minor" } }]),
    opt("Breathe deeply and let it go", "You let it go. Serenity now.", { karmaDelta: 2, happinessDelta: 2 }),
  ], { requires: { hasVehicle: true }, cooldown: 6 }),
  ev("catfish", "romance", 16, 60, "Too Good to Be True", "An online match seems perfect and asks for $1,000 for a 'flight to meet you'.", [
    risk("Send the money", 0.1, ["It was real! You met and clicked.", { addRelative: { relation: "Partner", ageOffset: [-4, 4], partnerStatus: "dating" }, bankBalanceDelta: -1000, happinessDelta: 8 }], ["It was a scam. $1,000 gone.", { bankBalanceDelta: -1000, happinessDelta: -8 }]),
    opt("Block them", "You blocked them. A wise choice.", { smartsDelta: 1 }),
    opt("Troll the scammer", "You wasted their time for weeks. A noble hobby.", { happinessDelta: 4, karmaDelta: 1 }),
  ], { requires: { hasPartner: false, minBank: 1000 }, cooldown: 10, weight: 0.6 }),
  ev("witness", "crime", 18, 80, "Witness", "You witness a serious crime. The police want a statement.", [
    opt("Testify", "You testified bravely. The criminal was convicted.", { karmaDelta: 10, happinessDelta: -2 }),
    opt("Refuse to get involved", "You kept your head down.", { karmaDelta: -3 }),
    risk("Blackmail the criminal", 0.4, ["They paid up. $15,000 richer, soul a little lighter.", { bankBalanceDelta: 15000, karmaDelta: -12 }], ["They didn't like that. You were hurt.", { healthDelta: -18, karmaDelta: -12 }], "health"),
  ], { cooldown: 12 }),
  ev("prison_pen_pal", "prison", 14, 100, "Letters From Outside", "A stranger writes to you in prison. They say your story moved them.", [
    opt("Write back", "You wrote back. Their letters brightened your days.", { happinessDelta: 6, addRelative: { relation: "Friend", ageOffset: [-6, 6] } }),
    opt("Ignore it", "You tossed the letter aside.", {}),
  ], { prisonOnly: true, cooldown: 6 }),
  ev("prison_job", "prison", 14, 100, "Prison Job", "The warden offers you a job in the prison kitchen.", [
    opt("Take the job", "You earned a little cash and a lot of respect from the cooks.", { bankBalanceDelta: 300, happinessDelta: 2 }),
    opt("Skip it", "You kept to your cell.", {}),
  ], { prisonOnly: true, cooldown: 4 }),

  // ---------- royalty ----------
  ev("royal_wedding_guest", "royalty", 14, 100, "A Neighbouring Wedding", "A royal wedding in a neighbouring kingdom requires your attendance.", [
    opt("Attend in splendour", "You dazzled the guests. The press called you the best-dressed royal.", { royalRespectDelta: 6, fameDelta: 2, bankBalanceDelta: -40000 }),
    opt("Send a gift instead", "A tasteful gift was sent in your place.", { royalRespectDelta: -2 }),
    opt("Cause a scene at the buffet", "You criticised the soup in a loud voice. It made the evening news.", { royalRespectDelta: -8, happinessDelta: 3 }),
  ], { requires: { royal: true }, cooldown: 5 }),
  ev("royal_charity_gala", "royalty", 14, 100, "Patron of the Arts", "A major museum asks you to be its royal patron.", [
    opt("Accept graciously", "The arts were delighted. Your portrait hangs in the lobby.", { royalRespectDelta: 8, karmaDelta: 4 }),
    opt("Demand a statue", "You demanded a statue in your likeness. Your ego is now bronze.", { royalRespectDelta: -4, happinessDelta: 4, karmaDelta: -2 }),
  ], { requires: { royal: true }, cooldown: 6 }),
  ev("royal_prank", "royalty", 12, 60, "Palace Mischief", "The palace halls are dull. A prank would liven things up.", [
    opt("Slide down the banister", "You slid down the 200-year-old banister. The guards pretended not to see.", { happinessDelta: 6, healthDelta: -1 }),
    opt("Switch the guards' hats", "The guards looked ridiculous for the whole day. The chancellor was livid.", { happinessDelta: 6, royalRespectDelta: -3 }),
    opt("Behave", "You behaved. How very regal.", { royalRespectDelta: 2 }),
  ], { requires: { royal: true }, cooldown: 4 }),
  ev("royal_scholarship", "royalty", 14, 100, "Royal Foundation", "Your advisers suggest founding a royal scholarship.", [
    opt("Fund it generously ($200,000)", "Hundreds of students will benefit. The nation applauds.", { bankBalanceDelta: -200000, royalRespectDelta: 12, karmaDelta: 6 }),
    opt("Give a small fund ($20,000)", "A modest scholarship was well received.", { bankBalanceDelta: -20000, royalRespectDelta: 4, karmaDelta: 2 }),
    opt("Decline", "You declined. The press noticed.", { royalRespectDelta: -4 }),
  ], { requires: { royal: true, minBank: 20000 }, cooldown: 8 }),
];
