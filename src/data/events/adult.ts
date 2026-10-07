import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Adulthood (18-59): career, money, midlife
export const ADULT_EVENTS: LifeEvent[] = [
  ev("graduation_party", "general", 18, 18, "Graduation Day", "You're graduating! The whole family came to cheer you on.", [
    opt("Give a speech", "You gave a rousing speech. Some people cried, some people filmed.", { fameDelta: 1, happinessDelta: 8, skillDeltas: { charisma: 2 } }),
    opt("Party until sunrise", "You partied until sunrise. Worth every ache.", { happinessDelta: 9, healthDelta: -2 }),
    opt("Go on a road trip with friends", "You and your friends hit the road. You made memories for a lifetime.", { happinessDelta: 8, bankBalanceDelta: -300, relationshipDelta: { target: "Friend", delta: 8 } }),
  ], { once: true }),
  ev("move_out", "general", 18, 24, "Leaving the Nest", "It's time to decide where you'll live.", [
    opt("Stay with the folks, rent-free", "You stayed home. Free rent, no privacy.", { relationshipDelta: { target: "Parent", delta: 4 }, happinessDelta: -2, bankBalanceDelta: 2000 }),
    opt("Share a flat with friends", "You split rent with three friends. Chaos reigned.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 6 }, healthDelta: -1 }),
    opt("Get a place of your own", "You moved into your own little place. The silence was glorious.", { happinessDelta: 5, bankBalanceDelta: -2500, smartsDelta: 1 }),
  ], { once: true }),
  ev("roommate_nightmare", "general", 18, 28, "Roommate From Hell", "Your roommate never does dishes and plays drums at 2am.", [
    opt("Confront them", "You confronted your roommate. Things improved, slightly.", { happinessDelta: 2, smartsDelta: 1 }),
    opt("Leave passive-aggressive notes", "The notes had no effect, but you felt powerful.", { happinessDelta: 1 }),
    opt("Move out", "You moved out and found a quieter place. $800 for a deposit.", { bankBalanceDelta: -800, happinessDelta: 4 }),
  ]),
  ev("college_party", "school", 18, 25, "Campus Life", "Finals are next week, and the biggest party of the semester is tonight.", [
    opt("Go to the party", "You went to the party. Your grades paid for it.", { happinessDelta: 8, smartsDelta: -2, healthDelta: -2 }),
    opt("Study", "You studied all night. Boring, but it worked.", { smartsDelta: 3, happinessDelta: -2 }),
    opt("Study in the library, then go to the party", "You found the perfect balance. A rare feat.", { smartsDelta: 1, happinessDelta: 4 }),
  ], { requires: { inSchool: true } }),
  ev("dating_app", "romance", 18, 40, "Swipe Right", "You've been getting a lot of matches lately.", [
    risk("Go on a date", 0.6, ["The date went wonderfully. You've started seeing someone.", { happinessDelta: 8, addRelative: { relation: "Partner", ageOffset: [-4, 5], partnerStatus: "dating" } }], ["The date was a disaster. They talked about their ex the whole evening.", { happinessDelta: -4, bankBalanceDelta: -60 }], "looks"),
    opt("Be a serial dater", "You had a string of fun, forgettable dates.", { happinessDelta: 4, bankBalanceDelta: -150 }),
    opt("Delete the app", "You deleted the app. Peace at last.", { happinessDelta: 1 }),
  ], { requires: { hasPartner: false }, cooldown: 2, weight: 2 }),
  ev("boss_overtime", "career", 18, 65, "Boss Wants More", "Your boss wants you to work the weekend. Again.", [
    opt("Say yes", "You worked all weekend. The boss noticed.", { performanceDelta: 10, happinessDelta: -6, healthDelta: -2, bankBalanceDelta: 400 }),
    opt("Say no politely", "You said no. Your boss was not pleased, but you got your Saturday.", { performanceDelta: -4, happinessDelta: 4 }),
    risk("Demand a raise for it", 0.4, ["Your boss agreed to a raise!", { salaryPct: 8, performanceDelta: 2, happinessDelta: 6 }], ["Your boss laughed and gave you worse hours.", { performanceDelta: -8, happinessDelta: -6 }], "smarts"),
  ], { requires: { hasJob: true }, cooldown: 3 }),
  ev("credit_thief", "career", 20, 60, "Credit Thief", "A coworker took credit for your work in front of the whole department.", [
    opt("Call them out in public", "You called them out and the room went silent. The truth came out.", { performanceDelta: 4, karmaDelta: 2, happinessDelta: 3, relationshipDelta: { target: "Friend", delta: -2 } }),
    opt("Sabotage their project", "You sabotaged their next project. Sweet, sweet revenge.", { karmaDelta: -8, happinessDelta: 4, performanceDelta: -3 }),
    opt("Let it slide", "You let it go. The resentment simmered for months.", { happinessDelta: -4, performanceDelta: -2 }),
  ], { requires: { hasJob: true } }),
  ev("office_romance", "romance", 20, 50, "Office Crush", "A charming coworker keeps stopping by your desk.", [
    risk("Ask them out", 0.5, ["They said yes! Awkward at the water cooler, but happy.", { happinessDelta: 8, addRelative: { relation: "Partner", ageOffset: [-4, 5], partnerStatus: "dating" } }], ["They said no. Now every meeting is awkward.", { happinessDelta: -6, performanceDelta: -3 }], "looks"),
    opt("Keep it professional", "You kept things professional. HR is pleased.", { performanceDelta: 2 }),
  ], { requires: { hasJob: true, hasPartner: false }, cooldown: 4 }),
  ev("startup_idea", "money", 20, 50, "The Big Idea", "You think of an app that could change everything. It needs funding.", [
    risk("Invest $20,000 of your savings", 0.1, ["Your startup was acquired for $240,000! You're a genius!", { bankBalanceDelta: 220000, happinessDelta: 14, fameDelta: 3, smartsDelta: 3 }], ["Your startup crashed and burned. $20,000 gone.", { bankBalanceDelta: -20000, happinessDelta: -8 }], "smarts"),
    opt("Build it as a side project", "You worked nights and weekends. It wasn't a hit, but you learned a lot.", { smartsDelta: 3, happinessDelta: 2, healthDelta: -2 }),
    opt("Give up on the idea", "You decided it was too risky.", { happinessDelta: -1 }),
  ], { requires: { minBank: 20000 }, cooldown: 6 }),
  ev("startup_idea_poor", "money", 20, 50, "The Big Idea (Poor Edition)", "You have an app idea but no money. A friend offers a loan.", [
    risk("Take the loan and try", 0.08, ["Against all odds, the app took off and you made $100,000.", { bankBalanceDelta: 100000, happinessDelta: 12, smartsDelta: 3 }], ["The app flopped. You owe a friend $3,000.", { bankBalanceDelta: -3000, relationshipDelta: { target: "Friend", delta: -12 }, happinessDelta: -6 }], "smarts"),
    opt("Wait until you have savings", "You decided to wait. Patience!", { smartsDelta: 1 }),
  ], { requires: { maxBank: 20000, hasFriend: true }, cooldown: 6 }),
  ev("road_trip", "general", 18, 35, "Road Trip!", "Your friends want to drive across the country.", [
    opt("Road trip!", "You sang along to terrible music for 3,000 miles. Best week ever.", { happinessDelta: 10, bankBalanceDelta: -700, relationshipDelta: { target: "Friend", delta: 10 } }),
    opt("Only if I'm driving", "You drove the whole way and developed a slight twitch.", { happinessDelta: 6, bankBalanceDelta: -500, healthDelta: -2 }),
    opt("Stay home and work", "You stayed home and got extra shifts.", { bankBalanceDelta: 800, happinessDelta: -2 }),
  ], { cooldown: 6 }),
  ev("car_accident", "health", 17, 75, "Fender Bender", "Another driver rear-ended you at a red light.", [
    risk("Sue them for damages", 0.55, ["Your lawsuit succeeded. $4,000 for your trouble.", { bankBalanceDelta: 4000, happinessDelta: 3 }], ["The lawyer ate most of the payout. You netted a $400 loss.", { bankBalanceDelta: -400, happinessDelta: -4 }]),
    opt("Exchange info and move on", "You exchanged insurance info. Whiplash lingers for a few weeks.", { healthDelta: -3 }),
    risk("Drive off before anyone sees", 0.5, ["You sped off. Nobody got your plate.", { karmaDelta: -8, happinessDelta: -2 }], ["A witness got your plate. Police came knocking.", { karmaDelta: -8, arrest: { name: "Hit and Run", description: "A witness recorded your licence plate as you left the scene.", years: 2, severity: "serious" } }]),
  ], { requires: { hasVehicle: true }, cooldown: 6 }),
  ev("tax_audit", "money", 25, 75, "Tax Audit", "The tax office wants to take a closer look at your returns.", [
    opt("Cooperate fully", "You handed over every receipt. All clear, but it took weeks.", { happinessDelta: -4, smartsDelta: 1 }),
    risk("Hide a few things", 0.4, ["You got away clean. The accountant is sweating anyway.", { bankBalanceDelta: 2000, karmaDelta: -4 }], ["Auditors found discrepancies. Fines and back taxes.", { bankBalanceDelta: -12000, karmaDelta: -4, happinessDelta: -8 }], "smarts"),
    opt("Hire an accountant ($1,500)", "The accountant was worth every penny. Zero fines.", { bankBalanceDelta: -1500, smartsDelta: 1 }),
  ], { requires: { minBank: 40000 }, cooldown: 8 }),
  ev("credit_card_trap", "money", 20, 45, "Pre-Approved!", "A shiny credit card offer arrives. 0% interest for three months!", [
    opt("Ignore it", "You tossed the offer. Boring but financially sound.", { smartsDelta: 1 }),
    opt("Max it out on a vacation", "You took a lavish vacation. The statement was terrifying.", { happinessDelta: 10, bankBalanceDelta: -6000 }),
    opt("Use it responsibly and pay it off", "You used it for small things and paid it off. Credit score up.", { bankBalanceDelta: 100, smartsDelta: 1 }),
  ], { cooldown: 6 }),
  ev("bar_fight", "crime", 18, 45, "Bar Fight", "A drunk stranger shoves you at the bar and shouts something rude.", [
    risk("Throw a punch", 0.5, ["You laid him out in one punch. The bar cheered.", { karmaDelta: -4, happinessDelta: 4, fameDelta: 1 }], ["He hit back harder. Police arrived.", { healthDelta: -8, karmaDelta: -4, arrest: { name: "Assault", description: "Witnesses told police you threw the first punch.", years: 2, severity: "minor" } }], "health"),
    opt("Walk away", "You walked away, a bigger person.", { karmaDelta: 3, happinessDelta: -1 }),
    opt("Buy him a drink", "You bought him a drink and ended up laughing together. Weird night.", { karmaDelta: 2, happinessDelta: 4, bankBalanceDelta: -20 }),
  ], { cooldown: 5 }),
  ev("speeding_ticket", "general", 17, 70, "Flashing Lights", "A cop pulled you over for speeding.", [
    opt("Apologize and take the ticket", "You took the ticket politely. $200 lighter.", { bankBalanceDelta: -200, karmaDelta: 1 }),
    risk("Talk your way out", 0.45, ["The officer let you off with a warning. Your charm works.", { happinessDelta: 3 }], ["The officer was not amused. Ticket and a lecture.", { bankBalanceDelta: -350, happinessDelta: -3 }], "looks"),
    risk("Offer a bribe", 0.25, ["The officer pocketed it and waved you on.", { bankBalanceDelta: -200, karmaDelta: -8 }], ["Bribing an officer is a crime, as it turns out.", { karmaDelta: -8, arrest: { name: "Bribery of a Public Official", description: "You handed an officer a wad of cash. He handed you handcuffs.", years: 2, severity: "serious" } }]),
  ], { requires: { hasVehicle: true }, cooldown: 4 }),
  ev("identity_theft", "money", 20, 80, "Identity Stolen", "Someone opened credit cards in your name.", [
    opt("Spend months clearing it up", "After many calls, you cleared your name.", { happinessDelta: -8, smartsDelta: 1 }),
    opt("Hire a service ($800)", "The identity service fixed it quickly.", { bankBalanceDelta: -800, happinessDelta: -2 }),
    opt("Track down the thief yourself", "You tracked the thief through an old email. The police thanked you.", { karmaDelta: 4, smartsDelta: 2, happinessDelta: 3, bankBalanceDelta: -200 }),
  ], { requires: { minBank: 10000 }, cooldown: 12 }),
  ev("friend_loan", "money", 20, 60, "Can You Spot Me?", "A friend asks to borrow $2,000 until next month.", [
    risk("Lend the money", 0.55, ["They paid you back, with a thank-you card.", { relationshipDelta: { target: "Friend", delta: 10 }, karmaDelta: 3 }], ["They never paid you back. They also stopped answering your calls.", { bankBalanceDelta: -2000, relationshipDelta: { target: "Friend", delta: -25 }, happinessDelta: -4 }]),
    opt("Say no politely", "You said no. They said it was fine. It wasn't.", { relationshipDelta: { target: "Friend", delta: -8 } }),
    opt("Give them $200 and wish them well", "You gave them $200 as a gift. They were grateful.", { bankBalanceDelta: -200, relationshipDelta: { target: "Friend", delta: 6 }, karmaDelta: 2 }),
  ], { requires: { minBank: 3000, hasFriend: true }, cooldown: 4 }),
  ev("marathon", "health", 18, 55, "Marathon Challenge", "A friend dares you to run a marathon.", [
    risk("Train and run it", 0.65, ["You finished the marathon! Your legs hate you, but you're proud.", { healthDelta: 6, happinessDelta: 10, looksDelta: 2 }], ["You collapsed at mile 18. Medical tent. Embarrassing.", { healthDelta: -6, happinessDelta: -4 }], "health"),
    opt("Cheer from the sidelines", "You cheered loudly and held up a funny sign.", { happinessDelta: 3 }),
  ], { cooldown: 8 }),
  ev("tattoo", "general", 18, 35, "Ink", "You're thinking about getting a tattoo.", [
    risk("Get a tasteful design", 0.7, ["Your new tattoo looks incredible.", { looksDelta: 2, happinessDelta: 5, bankBalanceDelta: -300 }], ["The artist misspelled it. Brutal.", { looksDelta: -3, happinessDelta: -4, bankBalanceDelta: -300 }]),
    opt("Get your ex's name", "You got your ex's name. Terrible idea, but you'll cherish the memory.", { looksDelta: -2, happinessDelta: 2, bankBalanceDelta: -250 }),
    opt("Don't get one", "You decided your skin is nice as is.", {}),
  ], { once: true }),
  ev("travel_offer", "general", 20, 70, "Wanderlust", "A cheap flight to somewhere amazing just popped up.", [
    opt("Book it!", "You explored a new country. Life-changing.", { happinessDelta: 10, bankBalanceDelta: -2500, smartsDelta: 2 }),
    opt("Backpack on a budget", "You travelled on a shoestring. Hostels were an adventure.", { happinessDelta: 8, bankBalanceDelta: -900, smartsDelta: 2, healthDelta: -1 }),
    opt("Save your money", "You saved your money. Responsible, if a bit dull.", { happinessDelta: -2 }),
  ], { requires: { minBank: 3000 }, cooldown: 4 }),
  ev("volunteer", "general", 18, 80, "Giving Back", "A local charity needs volunteers for a weekend.", [
    opt("Volunteer", "You spent a weekend helping others. It felt amazing.", { karmaDelta: 8, happinessDelta: 6 }),
    opt("Donate $200", "You donated $200 to the charity.", { karmaDelta: 5, bankBalanceDelta: -200 }),
    opt("Pass", "You had plans. Maybe next time.", {}),
  ], { cooldown: 4 }),
  ev("cult_recruiter", "general", 18, 50, "Friendly Strangers", "Two very cheerful strangers invite you to a 'community retreat'.", [
    risk("Go to the retreat", 0.4, ["It was actually a lovely meditation retreat. You came back refreshed.", { happinessDelta: 8, healthDelta: 3 }], ["It was a cult. You lost $3,000 before you escaped.", { bankBalanceDelta: -3000, happinessDelta: -8, karmaDelta: -1 }]),
    opt("Politely decline", "You declined. Wise.", { smartsDelta: 1 }),
  ], { cooldown: 12 }),
  ev("adult_viral", "fame", 18, 60, "Trending", "Your quirky video went viral overnight.", [
    opt("Embrace stardom", "You were on morning shows. Fifteen minutes of fame, and then some.", { fameDelta: 10, happinessDelta: 8 }),
    opt("Stay private", "You turned down interviews. The world moved on.", { happinessDelta: 1 }),
    risk("Make a merchandise line", 0.5, ["The merch sold out in hours! $12,000 profit.", { bankBalanceDelta: 12000, fameDelta: 4, happinessDelta: 6 }], ["Nobody bought the merch. Garage full of mugs.", { bankBalanceDelta: -3000, happinessDelta: -3 }]),
  ], { cooldown: 8, weight: 0.6 }),
  ev("busking", "fame", 16, 50, "Street Performer", "You spot a busy street corner where musicians play for tips.", [
    risk("Play for tips", 0.6, ["A crowd formed. $120 in tips and a record scout's card.", { bankBalanceDelta: 120, fameDelta: 3, skillDeltas: { music: 3 }, happinessDelta: 6 }], ["It rained and you got three coins and a dirty look.", { bankBalanceDelta: 3, happinessDelta: -3, skillDeltas: { music: 1 } }]),
    opt("Skip it", "You had other things to do.", {}),
  ], { requires: { flagsAll: ["music_dream"] }, cooldown: 3 }),
  ev("auditions_open", "fame", 16, 40, "Casting Call", "A local casting director is holding open auditions.", [
    risk("Show up and audition", 0.4, ["The director loved you! You got a small part.", { skillDeltas: { acting: 4 }, fameDelta: 3, bankBalanceDelta: 800, happinessDelta: 7 }], ["The director said 'next!' before you finished.", { skillDeltas: { acting: 1 }, happinessDelta: -4 }], "looks"),
    opt("Skip it", "You skipped it. Acting is a hard life anyway.", {}),
  ], { requires: { flagsAll: ["acting_dream"] }, cooldown: 3 }),
  ev("midlife_crisis", "general", 40, 55, "Midlife Crisis", "You wake up one morning feeling like life is passing you by.", [
    opt("Buy a red convertible ($40,000)", "You bought a bright red convertible. Dignity is overrated.", { bankBalanceDelta: -40000, happinessDelta: 12, looksDelta: 1 }),
    opt("Quit your job and travel the world", "You quit your job and spent a year travelling. You came back changed.", { loseJob: true, happinessDelta: 14, bankBalanceDelta: -15000, smartsDelta: 3 }),
    opt("See a therapist", "A few sessions later, you felt better. $1,500 well spent.", { bankBalanceDelta: -1500, happinessDelta: 8, smartsDelta: 1 }),
    opt("Ignore it", "You grit your teeth and carried on. The feeling lingered.", { happinessDelta: -6 }),
  ], { once: true }),
  ev("teen_kid_trouble", "family", 18, 55, "Calls From the Principal", "Your child got in trouble at school again.", [
    opt("Talk to them calmly", "You had a heart-to-heart. They opened up about being bullied.", { relationshipDelta: { target: "Child", delta: 10 }, happinessDelta: 2 }),
    opt("Ground them", "You grounded them for a month. They hate you. For now.", { relationshipDelta: { target: "Child", delta: -10 } }),
    opt("Hire a tutor ($1,000)", "The tutor helped. Grades improved.", { bankBalanceDelta: -1000, relationshipDelta: { target: "Child", delta: 4 } }),
  ], { requires: { hasChildren: true }, cooldown: 4 }),
  ev("parent_illness", "family", 30, 70, "Parent in the Hospital", "{mother} has been admitted to the hospital.", [
    opt("Be at their bedside", "You stayed by their side every day. They recovered, and you grew closer.", { relationshipDelta: { target: "Parent", delta: 15 }, happinessDelta: -3, karmaDelta: 3 }),
    opt("Pay for the best care ($8,000)", "You paid for the best doctors. They're comfortable and recovering.", { bankBalanceDelta: -8000, relationshipDelta: { target: "Parent", delta: 10 }, karmaDelta: 2 }),
    opt("Send flowers and stay busy", "You sent flowers and stayed away. They noticed.", { relationshipDelta: { target: "Parent", delta: -12 }, karmaDelta: -2 }),
  ], { requires: { parentAlive: true }, cooldown: 6 }),
  ev("empty_nest", "family", 45, 62, "Empty Nest", "Your youngest child has moved out. The house is quiet.", [
    opt("Take up a new hobby", "You took up painting. Your garage is now a gallery of mediocre landscapes.", { happinessDelta: 8, smartsDelta: 2 }),
    opt("Plan a romantic getaway", "You booked a getaway for two. The spark returned.", { happinessDelta: 8, bankBalanceDelta: -2500, relationshipDelta: { target: "Partner", delta: 12 } }),
    opt("Call your kids every day", "You called every day. They stopped answering.", { relationshipDelta: { target: "Child", delta: -6 }, happinessDelta: -3 }),
  ], { requires: { hasChildren: true }, once: true }),
  ev("class_reunion", "general", 28, 55, "Class Reunion", "Your high school reunion is this weekend.", [
    opt("Show up looking fabulous", "You showed up looking fabulous. Old rivals took notice.", { happinessDelta: 8, bankBalanceDelta: -200, looksDelta: 1 }),
    opt("Skip it", "You skipped it. Better things to do.", {}),
    opt("Brag about your life", "You bragged all evening. Nobody was impressed.", { happinessDelta: 3, karmaDelta: -2, relationshipDelta: { target: "Friend", delta: -3 } }),
  ], { once: true }),
  ev("market_crash", "money", 25, 75, "The Market Tumbles", "Stock markets are in free fall. Your portfolio is bleeding.", [
    opt("Hold steady", "You held steady. The market recovered in time.", { smartsDelta: 1, happinessDelta: -3 }),
    risk("Buy the dip", 0.5, ["You bought the dip and it paid off handsomely.", { bankBalanceDelta: 30000, happinessDelta: 8 }], ["It dipped further. Ouch.", { bankBalanceDelta: -30000, happinessDelta: -8 }], "smarts"),
    opt("Sell everything", "You sold everything at a loss, then watched the market rebound.", { bankBalanceDelta: -15000, happinessDelta: -6 }),
  ], { requires: { minBank: 100000 }, cooldown: 10 }),
  ev("burnout", "career", 28, 62, "Burnout", "You're exhausted. Every email makes your eye twitch.", [
    opt("Take a mental health leave", "You took time off to recover. Refreshed and reborn.", { happinessDelta: 10, healthDelta: 4, performanceDelta: -4, bankBalanceDelta: -1500 }),
    opt("Push through", "You pushed through. Your boss loved it, your body didn't.", { performanceDelta: 6, healthDelta: -6, happinessDelta: -8 }),
    opt("Quit", "You quit on the spot. The silence was golden. The bank account less so.", { loseJob: true, happinessDelta: 10 }),
  ], { requires: { hasJob: true }, cooldown: 6 }),
  ev("mentor", "career", 28, 60, "The Newbie", "A young colleague asks you to mentor them.", [
    opt("Mentor them", "You took them under your wing. They're going places.", { karmaDelta: 5, happinessDelta: 5, performanceDelta: 3 }),
    opt("Say you're too busy", "You said you were too busy. They found another mentor.", {}),
    opt("Steal their ideas", "You borrowed their best idea and ran with it. Smooth.", { karmaDelta: -6, performanceDelta: 6 }),
  ], { requires: { hasJob: true }, cooldown: 6 }),
  ev("job_offer", "career", 22, 58, "Headhunter Call", "A recruiter offers you a position at a competitor with a big raise.", [
    opt("Take the offer", "You switched companies for a bump in pay.", { salaryPct: 15, performanceDelta: -10, happinessDelta: 5 }),
    opt("Use it to negotiate a raise", "You used the offer as leverage. Your boss found some budget.", { salaryPct: 8, performanceDelta: 2, happinessDelta: 4 }),
    opt("Stay loyal", "You turned down the recruiter. Loyalty is its own reward.", { karmaDelta: 2 }),
  ], { requires: { hasJob: true, minStat: { smarts: 40 } }, cooldown: 5 }),
  ev("embezzlement", "career", 24, 60, "Creative Accounting", "A coworker has found a way to skim from the company accounts. They want you in.", [
    risk("Join the scheme", 0.5, ["The scheme worked. $25,000 landed in your account.", { bankBalanceDelta: 25000, karmaDelta: -12, happinessDelta: -2 }], ["The auditors found it. You were fired and charged.", { loseJob: true, karmaDelta: -12, arrest: { name: "Embezzlement", description: "Company auditors traced missing funds directly to your account.", years: 4, severity: "serious" } }], "smarts"),
    opt("Report them to HR", "You reported your coworker. HR was grateful, and the company gave you a bonus.", { karmaDelta: 8, bankBalanceDelta: 3000, performanceDelta: 6 }),
    opt("Pretend you didn't hear", "You looked the other way. You still felt uneasy.", { karmaDelta: -2 }),
  ], { requires: { hasJob: true }, once: true }),
  ev("back_pain", "health", 35, 65, "Creaky Bones", "Your back hurts every morning.", [
    opt("Start physical therapy ($600)", "Physical therapy helped. Your back is stronger.", { bankBalanceDelta: -600, healthDelta: 4 }),
    opt("Try yoga", "You stretched your way to health. Namaste.", { healthDelta: 3, happinessDelta: 3 }),
    opt("Ignore it", "You ignored it. It got worse.", { healthDelta: -5 }),
  ], { cooldown: 6 }),
  ev("doctor_warning", "health", 35, 75, "Doctor's Orders", "Your doctor looks at your results and sighs.", [
    opt("Overhaul your lifestyle", "You overhauled your diet and exercise. It was hard, but worth it.", { healthDelta: 8, happinessDelta: -2, looksDelta: 1 }),
    opt("Take the pills", "You took the pills and changed nothing else.", { healthDelta: 2 }),
    opt("Get a second opinion that agrees with you", "You found a doctor who said what you wanted to hear.", { happinessDelta: 3, healthDelta: -4 }),
  ], { cooldown: 8, requires: { maxStat: { health: 75 } } }),
  ev("strange_lump", "health", 30, 80, "A Strange Lump", "You've discovered something unusual. Do you get it checked?", [
    risk("See a doctor ($400)", 0.88, ["It was benign. Relief washed over you.", { bankBalanceDelta: -400, happinessDelta: 5 }], ["It was cancer, but it was caught early. Treatment is possible.", { bankBalanceDelta: -400, diseaseTrigger: "early_cancer", happinessDelta: -8 }], "health"),
    risk("Ignore it", 0.7, ["It went away on its own. Lucky.", { happinessDelta: 1 }], ["It was cancer, and it was advanced.", { diseaseTrigger: "cancer", healthDelta: -10, happinessDelta: -10 }], "health"),
  ], { once: true, weight: 0.4 }),
  ev("skydiving", "health", 18, 65, "Jump!", "A friend gives you a skydiving voucher for your birthday.", [
    risk("Jump out of the plane", 0.985, ["You jumped and it was the best day of your life!", { happinessDelta: 12, healthDelta: 1 }], ["Your parachute failed to open.", { die: "a skydiving accident" }]),
    opt("Hand it to someone braver", "You gave the voucher away. Sensible.", { happinessDelta: -1 }),
  ], { once: true, weight: 0.5 }),
  ev("rich_gala", "money", 25, 90, "Charity Gala", "You're invited to an exclusive charity gala.", [
    opt("Donate $10,000 and mingle", "You donated generously and made some powerful friends.", { bankBalanceDelta: -10000, karmaDelta: 8, fameDelta: 2, happinessDelta: 6 }),
    opt("Network aggressively", "You exchanged business cards all evening. Several promising leads.", { happinessDelta: 3, fameDelta: 1, smartsDelta: 1 }),
    opt("Skip it", "Galas aren't your thing.", {}),
  ], { requires: { minNetWorth: 1_000_000 }, cooldown: 4 }),
  ev("investor_tip", "money", 25, 80, "A Hot Tip", "A stranger at a party swears they've got a surefire investment.", [
    risk("Invest $20,000", 0.25, ["The stranger was right! Your $20,000 became $80,000.", { bankBalanceDelta: 60000, happinessDelta: 10 }], ["It was a pyramid scheme. Your money's gone.", { bankBalanceDelta: -20000, happinessDelta: -10 }], "smarts"),
    opt("Politely decline", "You declined. Good instincts.", { smartsDelta: 1 }),
  ], { requires: { minBank: 25000 }, cooldown: 6 }),
  ev("tax_haven", "crime", 30, 80, "Offshore Offer", "A smooth-talking advisor suggests hiding money in an offshore account.", [
    risk("Move $200,000 offshore", 0.5, ["The funds grew quietly. Nobody noticed.", { bankBalanceDelta: 40000, karmaDelta: -5 }], ["Investigators froze your accounts and charged you.", { bankBalanceDelta: -150000, karmaDelta: -8, arrest: { name: "Tax Evasion", description: "Federal investigators unraveled your offshore accounts.", years: 5, severity: "serious" } }]),
    opt("Decline", "You declined. Your accountant sighed in relief.", { karmaDelta: 2 }),
  ], { requires: { minBank: 200000 }, once: true }),
  ev("home_burglary", "crime", 20, 80, "Break-In", "You come home to find your door kicked in.", [
    opt("Call the police", "The police took a report. Nothing was recovered.", { bankBalanceDelta: -1500, happinessDelta: -6 }),
    opt("Install an alarm system ($1,200)", "You installed a top-notch security system.", { bankBalanceDelta: -1200, happinessDelta: -2 }),
    opt("Set a trap", "You rigged a pie to fall on the next burglar. It fell on you.", { healthDelta: -1, happinessDelta: -3 }),
  ], { requires: { hasProperty: true }, cooldown: 12, weight: 0.6 }),
  ev("mugging", "crime", 16, 80, "Wrong Side of Town", "A mugger demands your wallet in a dark alley.", [
    opt("Hand it over", "You handed it over. You lost $200 but kept your life.", { bankBalanceDelta: -200, happinessDelta: -4 }),
    risk("Fight back", 0.35, ["You fought him off! He ran away.", { happinessDelta: 6, fameDelta: 1, healthDelta: -2 }], ["He hurt you badly before running off with your wallet.", { healthDelta: -12, bankBalanceDelta: -200, happinessDelta: -8 }], "health"),
    opt("Run", "You ran so fast you nearly broke a record.", { healthDelta: 1 }),
  ], { cooldown: 8 }),
  ev("drunk_driving", "crime", 18, 60, "One for the Road", "You've had a few drinks and your car keys are in your pocket.", [
    risk("Drive home", 0.7, ["You made it home safe. Don't push your luck.", { karmaDelta: -3 }], ["Flashing lights behind you. You failed the breathalyzer.", { karmaDelta: -6, arrest: { name: "Driving Under the Influence", description: "You failed a roadside breath test.", years: 1, severity: "minor" } }]),
    opt("Call a cab", "You called a cab. $40 well spent.", { bankBalanceDelta: -40, karmaDelta: 2 }),
    opt("Sleep it off at a friend's", "You crashed on a friend's couch.", { relationshipDelta: { target: "Friend", delta: 3 } }),
  ], { requires: { hasVehicle: true }, cooldown: 8 }),
  ev("drug_deal", "crime", 18, 45, "Easy Money", "An old acquaintance offers you a spot in a lucrative street operation.", [
    risk("Join them", 0.45, ["Cash flowed in. $18,000 in a year.", { bankBalanceDelta: 18000, karmaDelta: -12, happinessDelta: 2 }], ["The police raided the operation and you were arrested.", { karmaDelta: -12, arrest: { name: "Drug Trafficking", description: "Police raided a stash house and found your fingerprints everywhere.", years: 6, severity: "serious" } }]),
    opt("Say no", "You said no and walked away.", { karmaDelta: 3 }),
    opt("Tip off the police", "You tipped off the police. Your safety may be at risk, but the streets are cleaner.", { karmaDelta: 8, happinessDelta: -2 }),
  ], { cooldown: 10 }),
];
