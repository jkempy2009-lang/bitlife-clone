import { opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { beat, begin, entry, fin, later, type Arc } from "./arcKit";

// ===========================================================================
// LOAN SHARK: a debt that grows teeth
// ===========================================================================
const LOANSHARK: LifeEvent[] = [
  entry("loanshark", "loanshark_1", "money", 21, 62, "A Very Reasonable Man",
    "The bank said no. The bank said no twice. Then, outside the bank, {lender}: soft voice, expensive coat, smile like a closed door. 'No forms,' they say. 'Friendly terms. Fifteen thousand. Pay when you can.' It's the kindest thing anyone's said to you all year.", [
      opt("Take the money", "A fat envelope, a warm handshake, and a number nobody quite explained. The relief lasted about a week.",
        begin("loanshark", later("loanshark_due", 1, 2, { bankBalanceDelta: 15000, happinessDelta: 4, karmaDelta: -1 }))),
      opt("Swallow your pride and ask family for help", "It was humiliating and it was also, somehow, not that bad. Someone put the kettle on and a cheque on the table.",
        fin("loanshark", "declined", { bankBalanceDelta: 4000, relationshipDelta: { target: "All", delta: -3 }, happinessDelta: -3 })),
      opt("Say no thank you and cut everything back", "Instant noodles, no phone plan, a spreadsheet taped to the fridge. Miserable, and honest.",
        fin("loanshark", "walked", { happinessDelta: -5, healthDelta: -1, karmaDelta: 1 })),
    ], {
      requires: { maxBank: 3000, custom: (p: PlayerState) => p.outstandingLoans > 3000 || p.vices.gambling >= 25 || p.creditScore < 580 },
      weight: 1.6,
    }),

  beat("loanshark", "loanshark_due", "money", 21, 70, "The Friendly Interest",
    "Fifteen thousand has become twenty-four by arithmetic nobody explained. {lender} sends friendly messages: 'No rush. Just checking in. Lovely family you've got.' You haven't mentioned a family. Neither has anyone else.", [
      opt("Pay it all: $24,000", "You wired the whole amount, trembling. {lender} sent a smiley face. You have never hated a punctuation mark more.",
        fin("loanshark", "paid", { bankBalanceDelta: -24000, happinessDelta: 5 })),
      opt("Work it off by running errands", "'Just a few small jobs,' {lender} said. Small jobs, you were learning, are how large things get done.",
        later("loanshark_job", 1, 2, { karmaDelta: -6, happinessDelta: -3, setFlags: ["arc_loanshark_errands"] })),
      risk("Run: new city, new phone, no forwarding address", 0.5,
        ["Three cities and a prepaid phone later, the messages stopped. You still check every shadow for a long coat.",
          fin("loanshark", "fled", { emigrate: "abroad", karmaDelta: -3, happinessDelta: -6 })],
        ["They found you in a laundromat, politely. It wasn't a violent conversation, exactly; the washing machines were very loud.",
          later("loanshark_found", 1, 1, { healthDelta: -10, happinessDelta: -8 })]),
      risk("Go to the police", 0.55,
        ["The detective had a file on {lender} as thick as a phone book. 'We've been waiting for someone brave,' she said. You weren't brave, but you were stuck.",
          later("loanshark_testify", 1, 2, { karmaDelta: 6, happinessDelta: -2 })],
        ["The officer knew {lender} by name and by Christmas card. By the time you got home, someone had been inside.",
          later("loanshark_found", 1, 1, { karmaDelta: 2, healthDelta: -8, happinessDelta: -6 })]),
    ]),

  beat("loanshark", "loanshark_job", "crime", 21, 70, "The Package",
    "A sports bag. A drop-off across town. 'Don't open it,' {lender} says. 'Don't be late. Don't be clever.' You've been all three before. The debt shrinks by a third if you do it, and the bag is heavier than it looks.", [
      risk("Do the run", 0.7,
        ["You handed it over, and nobody even looked at you. The debt was marked 'settled in kind' and you went home to be sick in the sink.",
          fin("loanshark", "indebted", { bankBalanceDelta: 2000, karmaDelta: -5, happinessDelta: -4 })],
        ["Someone was watching the drop-off. The bag was opened on a police table, and you were the only name on the CCTV.",
          fin("loanshark", "caught", { arrest: { name: "Drug Trafficking", description: "Caught carrying a bag you were told not to open. The contents spoke for themselves.", years: 4, severity: "serious" }, karmaDelta: -4, happinessDelta: -8 })]),
      opt("Refuse, whatever it costs", "It cost a rib, two teeth and a good deal of dignity. {lender} didn't raise their voice once.",
        later("loanshark_found", 1, 2, { healthDelta: -12, karmaDelta: 3, happinessDelta: -6 })),
    ], { requires: { flagsAll: ["arc_loanshark_errands"] } }),

  beat("loanshark", "loanshark_found", "money", 21, 75, "A Visit From {lender}'s Friends",
    "Two men in good coats sit in your living room as if they pay the rent. They are very calm. 'The principal,' says the taller one, 'is not the problem. The problem is the principle.'", [
      opt("Pay what they ask: $10,000", "You emptied the account on the spot. They gave you a receipt, which is the most sinister thing that has ever happened.",
        fin("loanshark", "paid", { bankBalanceDelta: -10000, healthDelta: -2, happinessDelta: 2 })),
      risk("Beg for time and offer a smaller settlement", 0.4,
        ["Something in your terrified honesty amused them. $5,000, final, and 'we never speak of this again'.",
          fin("loanshark", "paid", { bankBalanceDelta: -5000, happinessDelta: 2 })],
        ["They did not find you amusing. You did not find hospital food amusing either.",
          fin("loanshark", "broken", { healthDelta: -20, happinessDelta: -10, loseJob: true })]),
      risk("Call the police the moment they leave", 0.5,
        ["This time somebody listened. The case file got bigger, and so did your hope.", later("loanshark_testify", 1, 2, { karmaDelta: 4, happinessDelta: -2 })],
        ["The phone rang before the call connected. 'Wrong number,' said a calm voice. They paid you a second visit within the hour.",
          fin("loanshark", "broken", { healthDelta: -15, happinessDelta: -10, bankBalanceDelta: -6000 })]),
    ]),

  beat("loanshark", "loanshark_testify", "crime", 22, 78, "The Witness Stand",
    "The prosecutor says you are the case. 'Without you,' she says, 'it's a rumour with a nice coat on.' The defence lawyer is already smiling at you from across the corridor, in a way you'll remember.", [
      risk("Testify in open court", 0.7,
        ["It took two days on the stand. The jury was out for forty minutes. {lender} did not look at you when they led them away, which was somehow worse.",
          fin("loanshark", "witness", { karmaDelta: 10, happinessDelta: 6, fameDelta: 2 })],
        ["Another witness 'forgot' everything overnight. The case fell apart, and the 'friendly terms' came back with a new coat of paint.",
          fin("loanshark", "failed", { bankBalanceDelta: -5000, healthDelta: -6, happinessDelta: -8, karmaDelta: 5 })]),
      opt("Accept witness protection: new city, new name", "A new flat, a new job, a life you'd have to explain to nobody. It cost you everyone you had.",
        fin("loanshark", "protected", { emigrate: "abroad", karmaDelta: 6, happinessDelta: -2 })),
      opt("Refuse to testify and take your chances", "You said nothing, which is the whole thing a coward's courage consists of.",
        fin("loanshark", "silent", { karmaDelta: -6, bankBalanceDelta: -8000, happinessDelta: -5 })),
    ]),
];

// ===========================================================================
// PITCH: the best friend's business
// ===========================================================================
const PITCH: LifeEvent[] = [
  entry("pitch", "pitch_1", "money", 22, 56, "The Napkin",
    "Over a second beer, {friend} unfolds a napkin covered in arrows. A food truck, a craft brewery, an app that does something with dogs: it changes with the third drink. 'I just need a partner who believes in me,' they say, eyes shining, hands shaking.", [
      opt("Put in $12,000 and your weekends", "You shook on it and signed a napkin that became a contract. Your weekends dissolved into spreadsheets and optimism.",
        begin("pitch", later("pitch_early", 1, 2, { bankBalanceDelta: -12000, happinessDelta: 3, setFlags: ["arc_pitch_in"] }))),
      opt("Offer advice and a good reference, but no cash", "You gave them all the wisdom you had and kept your savings. They said they understood. They said it quickly.",
        begin("pitch", later("pitch_out", 1, 2, { karmaDelta: 1, relationshipDelta: { target: "Friend", delta: -2 }, setFlags: ["arc_pitch_out"] }))),
      opt("Gently say no", "It was the sensible thing and it felt awful. The silence in the pub was a physical object.",
        fin("pitch", "walked", { relationshipDelta: { target: "Friend", delta: -8 }, happinessDelta: -2 })),
    ], { requires: { hasFriend: true, minBank: 12000 }, weight: 1.3 }),

  beat("pitch", "pitch_early", "money", 22, 62, "Month Eleven",
    "The first year has been equal parts triumph and tragedy. The product exists. The customers... mostly exist. {friend} calls at midnight with a voice that goes up at the end of every sentence: 'It's going great. Can we talk about money?'", [
      risk("Double down with another $15,000", 0.55,
        ["The second round did it. A big client signed, a review went viral and {friend} cried on your shoulder in a car park.",
          later("pitch_exit", 2, 3, { bankBalanceDelta: -15000, happinessDelta: 4 })],
        ["The second round vanished into a warehouse lease and a supplier who definitely wasn't reliable. The mood in the office could be measured with a ruler.",
          later("pitch_crash", 1, 2, { bankBalanceDelta: -15000, happinessDelta: -5 })]),
      risk("Stay the course with no extra cash, just sweat", 0.45,
        ["Slow, ugly, steady. A year of 80-hour weeks later, the numbers finally pointed the right way.",
          later("pitch_exit", 2, 3, { healthDelta: -3, happinessDelta: 1 })],
        ["You worked yourself ragged for a business that wasn't going to make it. The only thing that grew was your coffee habit.",
          later("pitch_crash", 1, 2, { healthDelta: -4, happinessDelta: -5 })]),
      opt("Sell your stake back to {friend} at a loss", "You took $5,000 and a hug that felt like a handshake. You were both being very adult about it, which is to say you both wanted to scream.",
        fin("pitch", "sold", { bankBalanceDelta: 5000, relationshipDelta: { target: "Friend", delta: -12 }, happinessDelta: -2 })),
    ], { requires: { flagsAll: ["arc_pitch_in"] } }),

  beat("pitch", "pitch_exit", "money", 24, 66, "The Offer",
    "A bigger company wants to buy the whole thing: $90,000 on the table, your stake worth about $30,000 of it. {friend} wants to sell. You hold the swing vote, and this is the part of the movie where somebody always shows their true colours.", [
      opt("Sell. Take the money and the win", "Champagne in plastic cups. {friend} was ecstatic, and so were you, and neither of you mentioned the dream out loud.",
        fin("pitch", "payday", { bankBalanceDelta: 30000, happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 5 } })),
      opt("Refuse. Keep the company, keep the friend", "It wasn't the smart play. You kept the lights on, the friendship intact and the odd slice of stolen pizza on a Friday.",
        fin("pitch", "loyal", { bankBalanceDelta: 4000, happinessDelta: 4, relationshipDelta: { target: "Friend", delta: 12 } })),
      opt("Quietly sell your shares to the buyer behind {friend}'s back", "The cheque was bigger and the guilt was heavier. {friend} found out from a lawyer, which is how everybody finds out.",
        fin("pitch", "betrayed", { bankBalanceDelta: 38000, karmaDelta: -9, relationshipDelta: { target: "Friend", delta: -30 }, happinessDelta: -3 })),
    ]),

  beat("pitch", "pitch_crash", "money", 23, 66, "The Last Month",
    "The business is dying politely. Suppliers are calling twice a day; {friend} has stopped answering the phone at all. Somebody has to decide what a company's last month looks like, and it appears to be you.", [
      opt("Cover the creditors from your own pocket", "$8,000 of your money bought {friend}'s name back. It wasn't wise. It was right.",
        fin("pitch", "loyal", { bankBalanceDelta: -8000, karmaDelta: 5, relationshipDelta: { target: "Friend", delta: 12 }, happinessDelta: 1 })),
      opt("Walk away. It's their mess", "You returned your keys and your share certificate, and you didn't look back. It was the sensible thing and you've been telling yourself so ever since.",
        fin("pitch", "walked", { karmaDelta: -3, relationshipDelta: { target: "Friend", delta: -20 }, happinessDelta: -3 })),
      risk("Negotiate with a liquidator and salvage something", 0.5,
        ["The liquidator, to everyone's surprise, was human. You walked away with a little cash and the equipment.", fin("pitch", "salvaged", { bankBalanceDelta: 3000, happinessDelta: 1 })],
        ["The liquidator took everything including, somehow, the office plant.", fin("pitch", "crashed", { bankBalanceDelta: -5000, happinessDelta: -6 })], "smarts"),
    ]),

  beat("pitch", "pitch_out", "money", 22, 66, "The Launch Party",
    "The launch is tonight in a converted warehouse. {friend} has a banner, a playlist and a hundred strangers. You're holding a drink and the knowledge that you didn't back this. The line to the counter goes out the door.", [
      risk("Buy a round and tell everyone you were first to believe", 0.55,
        ["The business took off, and so did the retelling. {friend} laughed when you claimed it. You paid for the drinks, in more ways than one.",
          fin("pitch", "bystander", { bankBalanceDelta: -200, happinessDelta: 2, relationshipDelta: { target: "Friend", delta: 4 } })],
        ["The business folded within the year. You told everyone how sorry you were, and quietly paid for lunch.",
          fin("pitch", "bystander", { happinessDelta: -1, relationshipDelta: { target: "Friend", delta: 5 }, karmaDelta: 1 })]),
      opt("Skip it. You can't watch", "You made an excuse and stayed home with a bad film. By midnight, you were the only person in town not at the party.",
        fin("pitch", "walked", { relationshipDelta: { target: "Friend", delta: -10 }, happinessDelta: -3 })),
    ], { requires: { flagsAll: ["arc_pitch_out"] } }),
];

// ===========================================================================
// WHISTLE: numbers that don't add up
// ===========================================================================
const WHISTLE: LifeEvent[] = [
  entry("whistle", "whistle_1", "career", 24, 62, "Numbers That Don't Add Up",
    "While reconciling the quarter you find the same invoice paid three times to a company that, as far as you can tell, does not exist. The approval signature belongs to {boss}. It is 6:40pm. You are alone in the office. Your phone camera is, very suddenly, in your hand.", [
      opt("Copy everything and say nothing, for now", "A USB stick in a sock drawer, a heart rate you could feel in your teeth. Evidence is just courage held in escrow.",
        begin("whistle", later("whistle_press", 1, 2, { karmaDelta: 2, happinessDelta: -3, setFlags: ["arc_whistle_proof"] }))),
      risk("Raise it quietly with {boss}", 0.5,
        ["{boss} thanked you, corrected the invoices, and promoted you sideways. It looked fixed. It looked, you noted, a bit too fixed.",
          fin("whistle", "fixed", { karmaDelta: 2, happinessDelta: 2, performanceDelta: 5 })],
        ["{boss} thanked you warmly. Two weeks later your badge stopped working. You'd copied the files on your way out, because you aren't stupid.",
          begin("whistle", later("whistle_press", 1, 2, { loseJob: true, happinessDelta: -8, setFlags: ["arc_whistle_proof"] }))]),
      opt("Say nothing. Mortgages exist", "You closed the spreadsheet. The cursor kept blinking in your head for months afterwards.",
        fin("whistle", "silent", { karmaDelta: -6, happinessDelta: -3, performanceDelta: 3 })),
    ], { requires: { hasJob: true }, weight: 0.9 }),

  beat("whistle", "whistle_press", "career", 24, 66, "A Journalist Calls",
    "{journalist} has heard whispers and doesn't say how. 'I'm not asking you to say anything,' they tell you. 'I'm asking you not to lie if I ask.' The stick in your sock drawer feels much heavier than a stick.", [
      opt("Go on the record, with your name", "Your name in print above a headline you didn't write. It felt like taking off a coat in a blizzard.",
        later("whistle_backlash", 1, 1, { karmaDelta: 6, fameDelta: 3, happinessDelta: -2, setFlags: ["arc_whistle_public"] })),
      risk("Be an anonymous source", 0.55,
        ["The article ran with 'a person familiar with the matter'. Nobody connected the dots, and regulators opened a file.",
          later("whistle_verdict", 1, 2, { karmaDelta: 4, setFlags: ["arc_whistle_anon"] })],
        ["'Anonymous', the company's lawyers noted, was only anonymous to people who couldn't count. Everybody could count.",
          later("whistle_backlash", 1, 1, { karmaDelta: 4, happinessDelta: -3, setFlags: ["arc_whistle_public"] })]),
      opt("Sell the files to a rival firm instead", "$25,000 wired to an account that smelled faintly of pine. You told yourself it counted as justice.",
        fin("whistle", "sold", { bankBalanceDelta: 25000, karmaDelta: -10, happinessDelta: -3 })),
      opt("Delete everything. It isn't worth it", "A long breath, a few keystrokes and a decision. The silence afterwards felt like a hotel room.",
        fin("whistle", "silent", { karmaDelta: -5, happinessDelta: -2 })),
    ], { requires: { flagsAll: ["arc_whistle_proof"] } }),

  beat("whistle", "whistle_backlash", "career", 24, 68, "The Wrong Kind of Famous",
    "HR has opened an 'inquiry into your conduct'. Colleagues avoid you at the kettle. A lawyer's letter, co-signed by {boss}, alleges defamation. Somebody leaves a stuffed rat on your desk, which is clumsy but clear.", [
      opt("Hire a whistleblower attorney: $8,000", "She was small, calm and terrifying. 'Forget the rat,' she said. 'Let's talk about the timelines.'",
        later("whistle_verdict", 1, 2, { bankBalanceDelta: -8000, happinessDelta: 1, setFlags: ["arc_whistle_lawyered"] })),
      risk("Fight it alone", 0.35,
        ["You answered every letter with a spreadsheet and an attitude. Somehow, it worked, and they backed off.", later("whistle_verdict", 1, 2, { karmaDelta: 2, happinessDelta: 2 })],
        ["It turns out a spreadsheet is not an attorney. You were let go with a polite message and a larger bill.", later("whistle_verdict", 1, 2, { loseJob: true, bankBalanceDelta: -3000, happinessDelta: -8 })], "smarts"),
      opt("Resign loudly and go straight to the regulators", "You left with a cardboard box and a clear conscience. The regulator's lobby had a surprisingly nice sofa.",
        later("whistle_verdict", 1, 2, { loseJob: true, karmaDelta: 3, happinessDelta: -3, setFlags: ["arc_whistle_regulator"] })),
    ]),

  beat("whistle", "whistle_verdict", "career", 24, 72, "The Hearing",
    "The hearing room is smaller than you expected, with worse chairs. {boss} sits on the other side in a very good suit. Someone you've never met says, 'Please state your name for the record,' and you realise you have been preparing for this for two years.", [
      risk("Testify in full", 0.68,
        ["The company was fined into oblivion and {boss} was indicted. A statutory reward arrived by post in an unmarked envelope that you kept looking at.",
          later("whistle_aftermath", 3, 5, { bankBalanceDelta: 30000, karmaDelta: 8, fameDelta: 3, happinessDelta: 6 })],
        ["A technicality. The fine was smaller than your legal fees, and the company issued a press release thanking its 'valued team'.",
          fin("whistle", "lost", { bankBalanceDelta: -4000, karmaDelta: 4, happinessDelta: -8 })], "smarts"),
      opt("Settle: take the hush money and sign the NDA", "$45,000 and a clause that said you'd never talk about it. You've never talked about it. It talks about you.",
        fin("whistle", "bought", { bankBalanceDelta: 45000, karmaDelta: -7, happinessDelta: -2 })),
      opt("Withdraw. You can't do this any more", "You walked out into the corridor and breathed. Nobody followed. That was the saddest part.",
        fin("whistle", "withdrew", { karmaDelta: -4, happinessDelta: -5 })),
    ]),

  beat("whistle", "whistle_aftermath", "fame", 26, 78, "A Publisher Calls",
    "Three years on, you're 'that person from the news'. A publisher wants a book. A regulator wants a consultant. A recruiter wants to know if you're 'open to new opportunities', in the voice of someone who's heard the answer in advance.", [
      opt("Write the book", "A year of early mornings and weirdly therapeutic typing. It sold modestly, and a lot of former colleagues claimed they'd always known.",
        fin("whistle", "vindicated", { bankBalanceDelta: 12000, fameDelta: 5, karmaDelta: 2, happinessDelta: 4 })),
      opt("Join the oversight agency", "You swapped fame for a lanyard and a cause. Quietly, it was the best job you ever had.",
        fin("whistle", "vindicated", { salaryPct: 12, karmaDelta: 5, happinessDelta: 5 })),
      opt("Retreat to a quiet life", "You sold the story to nobody, took a gentler job and learned to enjoy gardening and anonymity.",
        fin("whistle", "vindicated", { happinessDelta: 6, healthDelta: 2, karmaDelta: 2 })),
    ]),
];

// ===========================================================================
// EMIGRATE: leaving, arriving, belonging (or not)
// ===========================================================================
const EMIGRATE: LifeEvent[] = [
  entry("emigrate", "emigrate_1", "general", 21, 46, "The Letter from Abroad",
    "An envelope with an unfamiliar stamp: a job offer, a lottery visa, a cousin's spare room in a city you've only seen on postcards. You have six weeks to decide. You read it standing up in the hallway, three times, as if it might change.", [
      opt("Pack up and go: $4,000 for flights and a deposit", "Two suitcases, a plant you couldn't take and a lump in your throat. Take-off felt like falling upward.",
        begin("emigrate", later("emigrate_settle", 1, 1, { bankBalanceDelta: -4000, happinessDelta: 3, emigrate: "abroad", setFlags: ["arc_emigrate_gone"] }))),
      opt("Stay. Some roots are worth their weight", "You folded the letter into a drawer and went back to the dishes. Some days it was the right answer.",
        fin("emigrate", "stayed", { happinessDelta: 1, relationshipDelta: { target: "All", delta: 4 } })),
    ], {
      requires: { custom: (p: PlayerState) => p.residence.country === p.birthCountry && p.royalRank === "none" && p.bankBalance >= 4500 && !p.isInPrison && !p.probation },
      weight: 0.8,
    }),

  beat("emigrate", "emigrate_settle", "general", 21, 58, "The First Winter",
    "Nobody warned you about the paperwork. Or the supermarkets. Or the way your own name sounds in other people's mouths. By January the sun sets at four and you have eaten dinner standing at the counter for eleven nights straight.", [
      opt("Throw yourself into the community, expat and local", "You said yes to every invitation, including the bowling league. You learned the language by getting it wrong loudly.",
        later("emigrate_status", 2, 4, { skillDeltas: { charisma: 2 }, happinessDelta: 4, setFlags: ["arc_emigrate_rooted"] })),
      opt("Keep your head down and work every hour", "Seven days, double shifts, a savings account that grew while you shrank. You told yourself it was temporary.",
        later("emigrate_status", 2, 4, { bankBalanceDelta: 6000, happinessDelta: -5, healthDelta: -2, setFlags: ["arc_emigrate_grind"] })),
      opt("Fly home after six months", "A one-way ticket you hated buying. Your friends said they understood, and mostly did.",
        fin("emigrate", "returned", { emigrate: "home", bankBalanceDelta: -2500, happinessDelta: -3 })),
    ]),

  beat("emigrate", "emigrate_status", "general", 22, 62, "The Renewal",
    "Your visa comes up for renewal. The department has lost your file, found your file, lost it again, and sent you a letter requesting the document that proves you were already sent a letter. A clerk says 'next window', and the window is closed.", [
      risk("Hire an immigration lawyer: $6,000", 0.8,
        ["The lawyer cleared it in a month with a single phone call. 'Everyone panics,' she said. 'It's lovely to watch.'",
          later("emigrate_citizen", 2, 4, { bankBalanceDelta: -6000, happinessDelta: 3 })],
        ["The lawyer was good, the situation was complicated. You kept your right to stay by a thread. A thread that cost $6,000.",
          later("emigrate_homesick", 1, 2, { bankBalanceDelta: -6000, happinessDelta: -3 })]),
      risk("Handle it yourself", 0.5,
        ["Eleven forms, three queues, one photocopier fight. You won, and you are never doing that again.", later("emigrate_citizen", 2, 4, { smartsDelta: 1, happinessDelta: 3 })],
        ["You missed a stamp. Technically you're allowed to stay for now. Practically, it's all a bit precarious.", later("emigrate_homesick", 1, 2, { happinessDelta: -5 })], "smarts"),
      opt("Give up and go home", "You packed in an afternoon. The airport was full of other people leaving other places.",
        fin("emigrate", "returned", { emigrate: "home", bankBalanceDelta: -1500, happinessDelta: -4 })),
    ]),

  beat("emigrate", "emigrate_homesick", "family", 22, 66, "A Call From Home",
    "The call comes on a bad line. Someone back home is seriously unwell, and the family is asking, gently, whether you'll come. If you leave, your status might not survive. If you stay, you might not forgive yourself.", [
      opt("Go home for good", "You came home to a kitchen that smelled exactly the same. Some things, you learned, can't be renewed by post.",
        fin("emigrate", "returned", { emigrate: "home", relationshipDelta: { target: "All", delta: 14 }, bankBalanceDelta: -2000, happinessDelta: 2 })),
      opt("Stay, and send money and long letters", "It was practical and it hurt. Nobody said so, and that hurt more.",
        later("emigrate_citizen", 2, 4, { bankBalanceDelta: -3000, relationshipDelta: { target: "All", delta: -6 }, karmaDelta: -2, happinessDelta: -3 })),
      opt("Fly back for two weeks, then return", "Two weeks of soup and ironing, then another goodbye at the airport. Someone pressed a cake tin into your hands.",
        later("emigrate_citizen", 2, 3, { bankBalanceDelta: -1800, relationshipDelta: { target: "All", delta: 8 }, healthDelta: -1, happinessDelta: 2 })),
    ]),

  beat("emigrate", "emigrate_citizen", "general", 24, 70, "The Oath",
    "In a municipal hall with a bad carpet, forty strangers raise their right hands. The official reads the oath slowly, as if it were a fragile piece of china. Somebody's grandmother is crying. You've been here long enough to know exactly why.", [
      opt("Take the oath, flag and all", "You said the words and meant them, which surprised you. Afterwards you ate cake from a paper plate and called it the best day of your life.",
        fin("emigrate", "citizen", { happinessDelta: 10, karmaDelta: 3 })),
      opt("Collect the paper, skip the party", "A certificate, a nod and a bus ride home. You were from two places now and a little tired of both.",
        fin("emigrate", "citizen", { happinessDelta: 4 })),
      opt("Run for the local council: $3,000 campaign", "You lost by eleven votes and became weirdly famous in the neighbourhood. The next election, they said, would be different.",
        fin("emigrate", "citizen", { bankBalanceDelta: -3000, fameDelta: 3, karmaDelta: 2, happinessDelta: 6 })),
    ]),
];

export const WORK_ARC_EVENTS: LifeEvent[] = [...LOANSHARK, ...PITCH, ...WHISTLE, ...EMIGRATE];

export const WORK_ARCS: Arc[] = [
  {
    id: "loanshark", title: "A Dangerous Loan", emoji: "🦈", start: "{lender}'s money is in your pocket. The bill is coming.",
    stages: [
      { flag: "arc_loanshark_errands", text: "You're running errands for {lender} to work off the debt." },
    ],
  },
  {
    id: "pitch", title: "The Business Pitch", emoji: "🥪", start: "{friend} pitched you a dream.",
    stages: [
      { flag: "arc_pitch_in", text: "You've put $12,000 into {friend}'s business." },
      { flag: "arc_pitch_out", text: "{friend} started the business without your money." },
    ],
  },
  {
    id: "whistle", title: "The Whistleblower", emoji: "📢", start: "You know something the company would rather you didn't.",
    stages: [
      { flag: "arc_whistle_proof", text: "You hold proof of fraud. Someone is already sniffing around." },
      { flag: "arc_whistle_public", text: "You went public. The company is not pleased." },
      { flag: "arc_whistle_anon", text: "You leaked anonymously. Regulators are circling." },
      { flag: "arc_whistle_lawyered", text: "Your attorney says: wait for the hearing." },
    ],
  },
  {
    id: "emigrate", title: "A New Country", emoji: "🛫", start: "You're building a life abroad.",
    stages: [
      { flag: "arc_emigrate_gone", text: "You moved abroad. Everything is new." },
      { flag: "arc_emigrate_rooted", text: "You're putting down roots in your new country." },
      { flag: "arc_emigrate_grind", text: "You're working relentlessly to build a life abroad." },
    ],
  },
];
