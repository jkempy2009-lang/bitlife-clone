import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";

const kid = (p: PlayerState, lo: number, hi: number) =>
  p.relatives.some((r) => r.relation === "Child" && r.alive && r.age >= lo && r.age <= hi);

// Milestones, family stages, school, travel and everyday life.
export const LIFE2_EVENTS: LifeEvent[] = [
  // ---------- milestones ----------
  ev("wedding_day", "romance", 18, 90, "The Big Day", "Your wedding day has arrived. {partner} is waiting at the altar.", [
    opt("Lavish ceremony ($25,000)", "Three hundred guests, a string quartet, and a cake the size of a toddler. Unforgettable.", { bankBalanceDelta: -25000, happinessDelta: 14, relationshipDelta: { target: "Partner", delta: 14 } }),
    opt("Intimate ceremony ($3,000)", "A small garden wedding with the people who matter. Perfect.", { bankBalanceDelta: -3000, happinessDelta: 10, relationshipDelta: { target: "Partner", delta: 10 } }),
    opt("Elope", "You eloped at sunrise. No guests, no stress, no regrets.", { happinessDelta: 8, relationshipDelta: { target: "Partner", delta: 8 } }),
  ], { once: true, weight: 0, requires: { hasPartnerStatus: "married" } }),
  ev("honeymoon", "romance", 18, 90, "Honeymoon", "Where will you and {partner} spend your honeymoon?", [
    opt("Tropical island ($6,000)", "Cocktails on the beach. You didn't check email once.", { bankBalanceDelta: -6000, happinessDelta: 10, relationshipDelta: { target: "Partner", delta: 10 } }),
    opt("Road trip ($800)", "A road trip with questionable playlists and unforgettable detours.", { bankBalanceDelta: -800, happinessDelta: 7, relationshipDelta: { target: "Partner", delta: 8 } }),
    opt("Skip it, back to work", "You skipped the honeymoon. {partner} remembered.", { relationshipDelta: { target: "Partner", delta: -8 }, performanceDelta: 4 }),
  ], { once: true, requires: { hasPartnerStatus: "married" }, weight: 2 }),
  ev("first_job_day", "career", 15, 40, "First Day on the Job", "It's your first day at {name}'s new workplace and you've forgotten your lunch.", [
    opt("Introduce yourself to everyone", "You charmed the whole office on day one.", { performanceDelta: 6, happinessDelta: 4, skillDeltas: { charisma: 2 } }),
    opt("Keep your head down", "You quietly learned the ropes.", { performanceDelta: 3, smartsDelta: 1 }),
    opt("Accidentally email the whole company", "Your 'reply all' with a cat meme made you instantly famous in accounting.", { performanceDelta: -2, happinessDelta: 3, fameDelta: 1 }),
  ], { once: true, requires: { hasJob: true }, weight: 4 }),
  ev("new_baby_nights", "family", 18, 60, "Sleepless Nights", "Your newborn has decided that 3am is party time.", [
    opt("Take shifts with {partner}", "You and {partner} survived on coffee and teamwork.", { relationshipDelta: { target: "Partner", delta: 6 }, healthDelta: -2, happinessDelta: 2 }),
    opt("Hire a night nurse ($4,000)", "A night nurse saved your sanity. And your marriage.", { bankBalanceDelta: -4000, happinessDelta: 6 }),
    opt("Wear earplugs and pray", "You slept. {partner} didn't forget it.", { relationshipDelta: { target: "Partner", delta: -8 }, happinessDelta: 3 }),
  ], { requires: { custom: (p) => kid(p, 0, 1) }, cooldown: 3, weight: 3 }),
  ev("kid_first_day_school", "family", 20, 60, "First Day of School", "Your child is starting school, backpack bigger than they are.", [
    opt("Walk them in and take photos", "You took forty photos. They waved you away after one.", { relationshipDelta: { target: "Child", delta: 6 }, happinessDelta: 5 }),
    opt("Cry in the car", "You cried in the car for twenty minutes. Parenthood is a lot.", { happinessDelta: 2, relationshipDelta: { target: "Child", delta: 2 } }),
  ], { requires: { custom: (p) => kid(p, 5, 5) }, once: true, weight: 4 }),
  ev("kid_graduation", "family", 38, 80, "Pomp and Circumstance", "Your child is graduating high school.", [
    opt("Throw a graduation party ($1,500)", "The party was a hit. Your kid made speeches until midnight.", { bankBalanceDelta: -1500, relationshipDelta: { target: "Child", delta: 10 }, happinessDelta: 8 }),
    opt("Give them a car ($8,000)", "You gave them keys to a used hatchback. Your kid screamed.", { bankBalanceDelta: -8000, relationshipDelta: { target: "Child", delta: 16 }, happinessDelta: 6 }),
    opt("A heartfelt hug", "You hugged them and cried. They tolerated it.", { relationshipDelta: { target: "Child", delta: 7 }, happinessDelta: 4 }),
  ], { requires: { custom: (p) => kid(p, 18, 18) }, once: true, weight: 4 }),
  ev("kid_wedding", "family", 45, 90, "Wedding Bells", "Your grown child is getting married.", [
    opt("Pay for the wedding ($20,000)", "You paid for the whole thing. Your child wept.", { bankBalanceDelta: -20000, relationshipDelta: { target: "Child", delta: 14 }, happinessDelta: 8 }),
    opt("Give a toast", "You gave a toast that made the whole room tear up.", { relationshipDelta: { target: "Child", delta: 8 }, happinessDelta: 6 }),
    opt("Criticise the venue loudly", "You critiqued the venue to anyone who'd listen.", { relationshipDelta: { target: "Child", delta: -14 }, happinessDelta: -2 }),
  ], { requires: { custom: (p) => kid(p, 25, 40) }, once: true, weight: 2 }),
  ev("college_decision", "school", 17, 18, "The Big Envelope", "Acceptance letters have started to arrive.", [
    opt("Pick the prestigious far-away university", "You chose prestige over proximity. It will pay off. (Probably.)", { smartsDelta: 3, happinessDelta: 6, bankBalanceDelta: -1000 }),
    opt("Choose the local college", "You stayed close to home and friends.", { relationshipDelta: { target: "Parent", delta: 5 }, happinessDelta: 3 }),
    opt("Take a gap year", "You travelled and found yourself. Possibly in a hostel.", { smartsDelta: 1, happinessDelta: 8, bankBalanceDelta: -2000 }),
    opt("Skip higher education", "You decided to start working right away.", { happinessDelta: 1 }),
  ], { once: true, weight: 3 }),
  ev("graduation_job_hunt", "career", 21, 26, "Job Hunt", "Your degree is framed. Your bank account is empty. Time to find work.", [
    opt("Spam applications", "You sent 200 applications and got 3 replies.", { happinessDelta: -3, smartsDelta: 1 }),
    opt("Network with alumni", "A friendly alum introduced you to the right people.", { happinessDelta: 3, skillDeltas: { charisma: 3 } }),
    opt("Move back in with your parents", "Free rent, endless questions about your plans.", { happinessDelta: -4, bankBalanceDelta: 3000 }),
  ], { requires: { hasJob: false, custom: (p) => p.education.degrees.some((d) => d.startsWith("bachelor")) }, once: true, weight: 3 }),
  ev("midlife_reinvention", "career", 38, 55, "Career Crossroads", "You're wondering whether you're in the right line of work.", [
    opt("Go back to school part-time", "Evening classes were exhausting but invigorating.", { smartsDelta: 4, happinessDelta: -2, bankBalanceDelta: -3000 }),
    opt("Ask for a new role", "Your company found you a fresh challenge.", { performanceDelta: 6, happinessDelta: 4 }),
    opt("Stay the course", "You stayed where you were. Safe, if stale.", { happinessDelta: -2 }),
  ], { requires: { hasJob: true }, cooldown: 8 }),
  ev("retirement_plans", "career", 58, 68, "Retirement Planning", "Colleagues ask what you'll do when you retire.", [
    opt("Plan a world tour", "You mapped out the trip of a lifetime.", { happinessDelta: 6 }),
    opt("Start a small hobby business", "You'll turn your hobby into a side hustle.", { smartsDelta: 1, happinessDelta: 3 }),
    opt("Never retire", "Work is life. Your family sighs.", { happinessDelta: -1, performanceDelta: 3 }),
  ], { requires: { hasJob: true }, once: true }),

  // ---------- school & growing up ----------
  ev("pop_quiz", "school", 8, 17, "Pop Quiz!", "Your teacher announces a surprise quiz. You haven't read the chapter.", [
    risk("Bluff your way through", 0.4, ["Somehow you scraped a B-plus.", { smartsDelta: 1, happinessDelta: 3 }], ["You wrote an essay on the wrong book.", { smartsDelta: -1, happinessDelta: -3 }], "smarts"),
    opt("Honestly confess", "You told the teacher the truth. They respected it.", { karmaDelta: 2 }),
  ], { cooldown: 4 }),
  ev("book_club", "school", 8, 16, "Book Fever", "You've found a book series you can't put down.", [
    opt("Read all night", "You finished the series in a week. Your eyes are red; your vocabulary isn't.", { smartsDelta: 4, happinessDelta: 4, healthDelta: -1 }),
    opt("Start writing your own", "You began writing your own stories.", { smartsDelta: 2, hobbyDelta: { writing: 10 }, happinessDelta: 3 }),
  ], { once: true, weight: 0.8 }),
  ev("art_class", "school", 8, 16, "Art Class", "Your art teacher says you have a natural eye.", [
    opt("Keep painting", "You painted every weekend. A gift took root.", { hobbyDelta: { painting: 12 }, happinessDelta: 5 }),
    opt("Try photography", "You borrowed a camera and fell in love.", { hobbyDelta: { photography: 12 }, happinessDelta: 4 }),
    opt("Skip art", "Not your thing.", {}),
  ], { once: true, weight: 0.8 }),
  ev("programming_camp", "school", 10, 17, "Coding Camp", "A summer coding camp opens enrolment.", [
    opt("Enrol ($300)", "You wrote your first game. It crashed. You loved it.", { bankBalanceDelta: -300, hobbyDelta: { coding: 15 }, smartsDelta: 3 }),
    opt("Teach yourself online", "You worked through free tutorials. Slower, but cheaper.", { hobbyDelta: { coding: 8 }, smartsDelta: 2 }),
    opt("Skip it", "Summer is for swimming.", { happinessDelta: 2 }),
  ], { once: true, weight: 0.8 }),
  ev("martial_arts_class", "school", 7, 16, "Dojo", "A new martial arts dojo has opened near you.", [
    opt("Sign up", "You learned discipline, high kicks, and how to fall properly.", { hobbyDelta: { martial: 12 }, healthDelta: 3, happinessDelta: 3 }),
    opt("Watch from the window", "You watched until the teacher waved. You waved back.", {}),
  ], { once: true, weight: 0.7 }),
  ev("chess_club", "school", 8, 16, "Check Mate", "A teacher invites you to join the chess club.", [
    opt("Join", "You were destroyed by a ten-year-old. Humbling, and inspiring.", { hobbyDelta: { chess: 12 }, smartsDelta: 3 }),
    opt("Decline", "Chess seemed too slow.", {}),
  ], { once: true, weight: 0.7 }),
  ev("cooking_class", "school", 9, 18, "Home Economics", "Your cooking class assignment: make dinner for four.", [
    opt("Cook something ambitious", "You made a lasagna. It was edible. It was good. People were shocked.", { hobbyDelta: { cooking: 12 }, happinessDelta: 4 }),
    opt("Order takeout and plate it", "Your teacher figured it out. Detention.", { karmaDelta: -2, happinessDelta: -2 }),
  ], { once: true, weight: 0.7 }),
  ev("school_trip", "school", 8, 17, "Field Trip", "The class is off on a trip to the science museum.", [
    opt("Pay attention", "You learned a lot and asked great questions.", { smartsDelta: 3, happinessDelta: 2 }),
    opt("Sit at the back of the bus with friends", "You sang the whole way. The driver was not impressed.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 4 } }),
    opt("Wander off", "You got lost in the dinosaur exhibit. Staff found you asleep under a T. rex.", { happinessDelta: 3, karmaDelta: -1 }),
  ], { cooldown: 4 }),
  ev("bad_report_card", "school", 8, 17, "Report Card", "Your report card is not good.", [
    opt("Hide it from your parents", "You hid it in a drawer. It was discovered in July.", { relationshipDelta: { target: "Parent", delta: -6 }, happinessDelta: -2 }),
    opt("Show your parents and promise to improve", "Your parents appreciated the honesty and helped you study.", { relationshipDelta: { target: "Parent", delta: 5 }, smartsDelta: 3 }),
    opt("Forge a better one", "The forgery worked. Until Parents' Night.", { karmaDelta: -4, relationshipDelta: { target: "Parent", delta: -8 } }),
  ], { requires: { inSchool: true, maxStat: { smarts: 55 } }, cooldown: 5 }),
  ev("star_student", "school", 8, 17, "Star Student", "Your teacher praises your work in front of the whole class.", [
    opt("Accept humbly", "You blushed, then secretly basked in it.", { smartsDelta: 2, happinessDelta: 5 }),
    opt("Take a bow", "You took a bow. The class booed gently.", { happinessDelta: 4, fameDelta: 1 }),
  ], { requires: { minStat: { smarts: 70 } }, cooldown: 5 }),
  ev("first_crush_kid", "romance", 9, 13, "First Crush", "Your heart does somersaults whenever a certain classmate walks by.", [
    opt("Pass a note", "You passed a note: 'Do you like me? Check yes or no.' They checked 'maybe'.", { happinessDelta: 4 }),
    opt("Ignore it", "You went back to your sandwich. For now.", {}),
    opt("Tell your best friend", "Your best friend told the whole school by lunchtime.", { happinessDelta: -3, relationshipDelta: { target: "Friend", delta: -5 } }),
  ], { once: true }),
  ev("growth_spurt", "health", 11, 16, "Growth Spurt", "You shot up four inches over the summer. None of your clothes fit.", [
    opt("New wardrobe ($300)", "New clothes, new confidence.", { bankBalanceDelta: -300, looksDelta: 2, happinessDelta: 3 }),
    opt("Wear hand-me-downs", "You wore hand-me-downs. Ankles were on display.", { happinessDelta: -2 }),
  ], { once: true }),
  ev("braces", "health", 10, 15, "Orthodontics", "The dentist says you need braces.", [
    opt("Get braces", "You spent two years as a walking metal detector. Your smile is stunning now.", { bankBalanceDelta: -2500, looksDelta: 4, happinessDelta: -3 }),
    opt("Refuse", "You kept your wonky smile. Character!", { looksDelta: -1, happinessDelta: 1 }),
  ], { once: true }),

  // ---------- travel & everyday ----------
  ev("backpacking", "general", 18, 35, "Backpacking Adventure", "You have three weeks off and a rucksack.", [
    opt("Southeast Asia ($2,500)", "Beaches, street food, and a questionable tattoo.", { bankBalanceDelta: -2500, happinessDelta: 10, smartsDelta: 2, looksDelta: 1 }),
    opt("Interrail across Europe ($3,500)", "Twenty cities and one very sore back.", { bankBalanceDelta: -3500, happinessDelta: 10, smartsDelta: 3 }),
    opt("Stay home", "You saved your money.", {}),
  ], { requires: { minBank: 3500 }, cooldown: 6 }),
  ev("lost_luggage", "general", 18, 80, "Lost Luggage", "Your suitcase has gone to Tahiti. You are in Prague.", [
    opt("Buy new clothes ($400)", "New wardrobe, tourist chic.", { bankBalanceDelta: -400, happinessDelta: 1 }),
    opt("Camp out in the airport office", "After three days you got your suitcase and a free meal voucher.", { happinessDelta: -2 }),
  ], { requires: { minBank: 500 }, cooldown: 8 }),
  ev("language_learning", "general", 14, 80, "Parlez-Vous?", "You decide to learn a new language.", [
    opt("Immersion trip ($2,000)", "You came back fluent in ordering coffee and arguing.", { bankBalanceDelta: -2000, smartsDelta: 4, happinessDelta: 6 }),
    opt("App every day", "You maintained a 400-day streak and can say 'The apple is red'.", { smartsDelta: 2, happinessDelta: 2 }),
    opt("Quit after week one", "The streak counter shamed you.", { happinessDelta: -1 }),
  ], { cooldown: 8 }),
  ev("camping_trip", "general", 8, 80, "Under the Stars", "A camping trip: tents, bugs, and a mysterious rustling.", [
    opt("Tell ghost stories", "Everyone slept with the lights on.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 4 } }),
    opt("Hike to the summit", "The view was worth every blister.", { healthDelta: 3, happinessDelta: 7 }),
    opt("Get lost", "You were lost for a day. Search party found you eating berries.", { happinessDelta: -4, healthDelta: -2 }),
  ], { cooldown: 5 }),
  ev("concert_night", "general", 14, 55, "Concert Night", "Your favourite band is in town. Tickets are pricey.", [
    opt("Splurge on front row ($400)", "You screamed every lyric. Best night ever.", { bankBalanceDelta: -400, happinessDelta: 10 }),
    opt("Cheap seats ($60)", "Bad view, great sound.", { bankBalanceDelta: -60, happinessDelta: 6 }),
    opt("Stay home and stream it", "A Wi-Fi buffering wheel is not a concert.", { happinessDelta: -1 }),
  ], { cooldown: 4 }),
  ev("moving_day", "general", 20, 70, "Moving Day", "Time to pack up your life into boxes.", [
    opt("Hire movers ($800)", "The movers dropped only one lamp.", { bankBalanceDelta: -800, happinessDelta: 1 }),
    opt("Move it yourself", "You moved it all yourself. Your back never forgave you.", { healthDelta: -3, happinessDelta: -2 }),
    opt("Throw away half your stuff", "You got rid of boxes you hadn't opened in ten years. Liberating.", { happinessDelta: 4 }),
  ], { cooldown: 6 }),
  ev("diy_disaster", "general", 22, 75, "DIY Disaster", "You've decided to renovate the bathroom yourself with the help of three videos.", [
    risk("Go for it", 0.4, ["It looks like a professional did it. You've never been prouder.", { happinessDelta: 8, smartsDelta: 1 }], ["The bathroom now has a waterfall.", { bankBalanceDelta: -4500, happinessDelta: -6 }], "smarts"),
    opt("Call a pro ($2,500)", "A professional did it quickly and quietly.", { bankBalanceDelta: -2500 }),
  ], { requires: { hasProperty: true }, cooldown: 6 }),
  ev("garage_sale", "money", 20, 80, "Garage Sale", "You find forty years of clutter in the basement.", [
    opt("Hold a garage sale", "You earned $350 and lost your emotional attachment to a lamp.", { bankBalanceDelta: 350, happinessDelta: 3 }),
    opt("Donate everything", "A charity truck hauled it away with thanks.", { karmaDelta: 4, happinessDelta: 2 }),
    opt("Bury it deeper", "The clutter continues.", {}),
  ], { requires: { hasProperty: true }, cooldown: 8 }),
  ev("new_neighbours", "general", 20, 80, "New Neighbours", "A family just moved in next door.", [
    opt("Bake them a pie", "The pie started a friendship.", { addRelative: { relation: "Friend", ageOffset: [-8, 8] }, happinessDelta: 4, karmaDelta: 2 }),
    opt("Ignore them", "You ignored them. They ignored you right back.", {}),
    opt("Complain about their moving truck", "You started a feud on day one.", { karmaDelta: -2, happinessDelta: -2 }),
  ], { requires: { hasProperty: true }, cooldown: 8 }),
  ev("bake_sale", "general", 8, 80, "Bake Sale", "The school (or community) is holding a bake sale.", [
    opt("Bake something fancy", "Your cake sold out in minutes.", { hobbyDelta: { cooking: 6 }, happinessDelta: 4, bankBalanceDelta: 120 }),
    opt("Buy store-bought and re-plate it", "Nobody noticed.", { karmaDelta: -1 }),
    opt("Skip it", "You skipped it.", {}),
  ], { cooldown: 6 }),
  ev("hair_disaster", "general", 14, 60, "Bad Haircut", "The barber/stylist said 'trust me.' You should not have.", [
    opt("Wear a hat for a month", "Hats became your signature look.", { looksDelta: -1, happinessDelta: -2 }),
    opt("Rock it with confidence", "Confidence is attractive. Allegedly.", { looksDelta: -1, happinessDelta: 2 }),
    opt("Pay for a fix ($200)", "A better stylist rescued you.", { bankBalanceDelta: -200, looksDelta: 1 }),
  ], { cooldown: 5 }),
  ev("karaoke_night", "general", 16, 70, "Karaoke Night", "Someone hands you the mic.", [
    risk("Sing 'Bohemian Rhapsody'", 0.4, ["You nailed every note. People filmed it.", { happinessDelta: 9, fameDelta: 1, skillDeltas: { music: 2 } }], ["You cracked on the high note. Never again.", { happinessDelta: -4 }]),
    opt("Hide in the bathroom", "You hid until it was over.", {}),
  ], { cooldown: 5 }),
  ev("speed_dating", "romance", 20, 55, "Speed Dating", "A friend drags you to a speed dating evening. Eight dates, six minutes each.", [
    risk("Give it a shot", 0.45, ["You clicked with someone special.", { happinessDelta: 7, addRelative: { relation: "Partner", ageOffset: [-5, 5], partnerStatus: "dating" } }], ["Eight awkward conversations. One person asked about your tax bracket.", { happinessDelta: -2 }], "looks"),
    opt("Leave early", "You left after round three.", {}),
  ], { requires: { hasPartner: false }, cooldown: 4 }),
  ev("health_fad", "health", 18, 60, "Fad Diet", "A new diet is all the rage.", [
    opt("Try it for a month", "You lost five pounds and your sense of humour.", { looksDelta: 1, happinessDelta: -3, healthDelta: 1 }),
    opt("Hire a nutritionist ($500)", "A sensible plan with actual vegetables.", { bankBalanceDelta: -500, healthDelta: 4, looksDelta: 1 }),
    opt("Ignore it and eat pizza", "You ate pizza. The pizza loved you back.", { happinessDelta: 5, healthDelta: -2 }),
  ], { cooldown: 5 }),
  ev("sleep_trouble", "health", 20, 70, "Insomnia", "You haven't slept properly in weeks.", [
    opt("See a sleep specialist ($300)", "A routine and a magic pillow fixed it.", { bankBalanceDelta: -300, healthDelta: 3, happinessDelta: 4 }),
    opt("Drink more coffee", "You are now a jittery insomniac.", { healthDelta: -3, happinessDelta: -3 }),
    opt("Meditate nightly", "A few weeks of meditation changed everything.", { happinessDelta: 5, healthDelta: 2 }),
  ], { cooldown: 5 }),
  ev("skin_cancer_scare", "health", 25, 80, "A Suspicious Mole", "You notice a mole that's changing shape.", [
    risk("Get it checked ($150)", 0.9, ["It was harmless. You exhale at last.", { bankBalanceDelta: -150, happinessDelta: 3 }], ["Early-stage skin cancer. Removed, but you're monitored now.", { bankBalanceDelta: -150, diseaseTrigger: "early_cancer", happinessDelta: -6 }]),
    opt("Hope for the best", "You ignored it. It didn't go away.", { healthDelta: -3, happinessDelta: -2 }),
  ], { once: true, weight: 0.5 }),
  ev("sports_injury_rec", "health", 14, 55, "Weekend Warrior", "Your pickup game ended with a very loud 'pop'.", [
    opt("Rest and ice it", "You rested for a month. Back to normal.", { healthDelta: -2, happinessDelta: -2 }),
    opt("Get physical therapy ($700)", "A proper rehab plan set you straight.", { bankBalanceDelta: -700, healthDelta: 1 }),
    opt("Keep playing", "You kept playing. It got much worse.", { healthDelta: -10, happinessDelta: -3 }),
  ], { cooldown: 5 }),

  // ---------- family ----------
  ev("family_secret", "family", 18, 70, "A Family Secret", "While cleaning, you find a box of old letters hinting at a secret in your family.", [
    opt("Read them all", "The letters revealed a hidden love story. Fascinating.", { smartsDelta: 1, happinessDelta: 4 }),
    opt("Ask {mother} about it", "{mother} told you the whole story over tea.", { relationshipDelta: { target: "Parent", delta: 8 } }),
    opt("Burn the box", "Some things are best left in the past.", { happinessDelta: -1 }),
  ], { requires: { parentAlive: true }, once: true, weight: 0.5 }),
  ev("holiday_dinner", "family", 12, 90, "Holiday Dinner", "The whole family is gathered for the holidays.", [
    opt("Host it yourself", "You cooked for 14. You will not do it again. (You will.)", { relationshipDelta: { target: "All", delta: 6 }, happinessDelta: 4, bankBalanceDelta: -300 }),
    opt("Bring a dish and keep the peace", "Peace was maintained, barely.", { relationshipDelta: { target: "All", delta: 3 }, happinessDelta: 3 }),
    opt("Bring up politics", "The turkey was cold by the time the shouting ended.", { relationshipDelta: { target: "All", delta: -8 }, karmaDelta: -1 }),
  ], { requires: { parentAlive: true }, cooldown: 4 }),
  ev("grandparent_wisdom", "family", 8, 40, "Gran Knows Best", "{name}'s grandparent invites you to stay for the weekend.", [
    opt("Learn the old family recipes", "You learned Gran's secret recipes. They are now yours.", { hobbyDelta: { cooking: 10 }, happinessDelta: 5, relationshipDelta: { target: "Grandparent", delta: 12 } }),
    opt("Listen to stories", "Hours of stories about the old days. Priceless.", { smartsDelta: 1, happinessDelta: 5, relationshipDelta: { target: "Grandparent", delta: 10 } }),
    opt("Play video games", "You played on your phone. Gran noticed.", { relationshipDelta: { target: "Grandparent", delta: -6 } }),
  ], { requires: { custom: (p) => p.relatives.some((r) => r.relation === "Grandparent" && r.alive) }, cooldown: 4 }),
  ev("grandchild_visit", "family", 55, 100, "Little Visitors", "Your grandchild is staying for the weekend.", [
    opt("Spoil them rotten", "Ice cream for dinner. Their parents were mortified.", { relationshipDelta: { target: "Grandchild", delta: 12 }, happinessDelta: 8 }),
    opt("Teach them a skill", "You taught them to whittle/knit/shuffle cards. They treasured it.", { relationshipDelta: { target: "Grandchild", delta: 10 }, happinessDelta: 6 }),
    opt("Enforce strict bedtimes", "Bedtimes were enforced. Silence reigned.", { relationshipDelta: { target: "Grandchild", delta: 2 } }),
  ], { requires: { hasGrandchildren: true }, cooldown: 3 }),
  ev("family_business_offer", "family", 20, 55, "Join the Family Business", "{father} wants you to take over the family business.", [
    opt("Accept", "You joined the family firm. Pay is steady and so is the guilt.", { bankBalanceDelta: 8000, relationshipDelta: { target: "Parent", delta: 12 }, performanceDelta: 3 }),
    opt("Decline politely", "You turned him down. The dinner table was quiet.", { relationshipDelta: { target: "Parent", delta: -10 } }),
  ], { requires: { parentAlive: true, custom: (p) => p.relatives.some((r) => r.relation === "Parent" && r.incomeTier >= 3) }, once: true }),
  ev("sibling_rivalry_adult", "family", 22, 70, "Inheritance Wars", "{sibling} thinks you got the better deal from your parents.", [
    opt("Talk it out", "You cleared the air over dinner.", { relationshipDelta: { target: "Sibling", delta: 8 } }),
    opt("Split the difference ($1,500)", "You paid $1,500 to keep the peace.", { bankBalanceDelta: -1500, relationshipDelta: { target: "Sibling", delta: 12 } }),
    opt("Stop speaking to them", "You haven't talked in a year.", { relationshipDelta: { target: "Sibling", delta: -25 }, happinessDelta: -3 }),
  ], { requires: { hasSibling: true, parentAlive: true }, cooldown: 8 }),
];
