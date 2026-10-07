import { opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { beat, begin, entry, fin, later, type Arc } from "./arcKit";

const working = (p: PlayerState) => !!p.currentJob;

// ===========================================================================
// RIVAL: the school rival who comes back as an adult
// ===========================================================================
const RIVAL: LifeEvent[] = [
  entry("rival", "rival_1", "school", 10, 17, "The Other Top Student",
    "Every class has one: the kid who puts their hand up a heartbeat before you do. For you, it's {rival}. Report cards now arrive in pairs, and the teacher has started pitting the two of you against each other for the end-of-year prize.", [
      opt("Study like your pride depends on it", "You turned flashcards into a blood sport and took the prize by half a point. {rival} did not say congratulations.",
        begin("rival", later("rival_foe", 12, 16, { smartsDelta: 3, happinessDelta: -3, healthDelta: -1, setFlags: ["arc_rival_driven"] }))),
      risk("Quietly sabotage {rival}'s project", 0.55,
        ["A mysteriously smudged poster board later, the prize was yours. {rival} cried in the bathroom. You told yourself it was fine.",
          begin("rival", later("rival_foe", 12, 16, { karmaDelta: -7, smartsDelta: 1, happinessDelta: 2, setFlags: ["arc_rival_wronged"] }))],
        ["A teacher found the glue in your bag. Detention, a call home, and {rival} knows exactly who did it.",
          begin("rival", later("rival_foe", 12, 16, { karmaDelta: -8, happinessDelta: -5, relationshipDelta: { target: "Parent", delta: -5 }, setFlags: ["arc_rival_wronged"] }))]),
      opt("Suggest you team up for the joint project", "You split the work, split the prize and split a sandwich. An unlikely friendship begins.",
        begin("rival", later("rival_ally", 12, 16, { karmaDelta: 2, happinessDelta: 4, smartsDelta: 1, setFlags: ["arc_rival_friend"] }))),
      opt("Let {rival} have it. It's only a certificate", "You shrugged and clapped. It stung for about a week, and after that it felt oddly like freedom.",
        fin("rival", "walked", { happinessDelta: -2, karmaDelta: 2 })),
    ], { requires: { inSchool: true }, weight: 1.3 }),

  beat("rival", "rival_foe", "career", 21, 58, "Old Scores",
    "The meeting invite had a name on it you'd have known anywhere. {rival}, yes, the one from school, is now across the table: the other finalist for the same promotion, the same contract, the same everything. Life is small and cruel and has a sense of humour.", [
      risk("Out-prepare them. Again", 0.55,
        ["Three sleepless nights and one very good slide deck later, you won. {rival} shook your hand with the grip of someone holding in a scream.",
          later("rival_respect", 5, 9, { promote: true, happinessDelta: 6, smartsDelta: 1 })],
        ["They won, narrowly, and thanked you for 'pushing them'. You'd have preferred a punch.",
          later("rival_respect", 5, 9, { happinessDelta: -6, setFlags: ["arc_rival_lost"] })], "smarts"),
      risk("Dig up something embarrassing and 'accidentally' share it", 0.6,
        ["A screenshot from 2009 made its way into the right inbox. You got the job. You also got a small, cold stone in your stomach.",
          later("rival_blowback", 2, 4, { promote: true, karmaDelta: -8, happinessDelta: 3, setFlags: ["arc_rival_dirty"] })],
        ["It turned out the inbox you chose was monitored. HR had a lot of questions, and you were the only one with answers.",
          later("rival_blowback", 2, 4, { karmaDelta: -8, performanceDelta: -15, happinessDelta: -8, setFlags: ["arc_rival_dirty"] })]),
      opt("Call them first: 'May the best one win. Drinks after?'", "Two adults, one pint, and thirty years of grudge worn down to a joke. Whoever got the thing, you both got a friend.",
        later("rival_ally", 2, 4, { karmaDelta: 3, happinessDelta: 4, bankBalanceDelta: -60, setFlags: ["arc_rival_friend"] })),
    ]),

  beat("rival", "rival_ally", "money", 21, 65, "A Favour From an Old Rival",
    "Your oldest rival-turned-friend calls late. There was a startup, and then there was a lease, and now there's an $8,000 hole and a landlord with a spreadsheet. {rival_first} would never ask unless it was bad.", [
      risk("Lend them the $8,000", 0.7,
        ["You wired the money before you could think better of it. {rival_first} said it was a loan, and meant it.",
          later("rival_payback", 2, 3, { bankBalanceDelta: -8000, karmaDelta: 4, happinessDelta: 3 })],
        ["The money left, and so did {rival_first}: new number, new city, one postcard that said 'sorry' and nothing else.",
          fin("rival", "burned", { bankBalanceDelta: -8000, happinessDelta: -7, karmaDelta: 1 })]),
      opt("Offer a couch and a reference instead", "No cash, but a spare room and the best reference of your life. {rival_first} was grateful, if not exactly solvent.",
        fin("rival", "friend", { karmaDelta: 3, happinessDelta: 2 })),
      opt("Say no. You're not a bank", "The line went quiet. You told yourself it was prudence, and mostly it was.",
        fin("rival", "walked", { karmaDelta: -3, happinessDelta: -2 })),
    ], { requires: { flagsAll: ["arc_rival_friend"] } }),

  beat("rival", "rival_payback", "money", 22, 70, "Back in Black",
    "An envelope arrives with a cheque for $11,000 and a note in unmistakable handwriting: 'Told you I'd outlast you. Interest included. Dinner's on me.'", [
      opt("Take every cent. They insisted", "You cashed it with a clear conscience and let {rival_first} buy a ridiculously good dinner.",
        fin("rival", "friend", { bankBalanceDelta: 11000, happinessDelta: 5 })),
      opt("Take the principal, split the bill, call it even", "You kept the $8,000, tore up the interest and hugged in a restaurant like an idiot.",
        fin("rival", "friend", { bankBalanceDelta: 7900, karmaDelta: 4, happinessDelta: 8, relationshipDelta: { target: "Friend", delta: 6 } })),
    ]),

  beat("rival", "rival_respect", "general", 26, 75, "The Handshake",
    "At a conference, a wedding, a funeral (they all blur) {rival} finds you by the buffet. 'I always thought you were the better one,' they say. Then, a beat later: 'Also, my firm is hiring. Think about it.'", [
      opt("Accept the offer", "Working for your former nemesis turned out to be easier than competing with them. The pay was better, too.",
        fin("rival", "partner", { salaryPct: 20, happinessDelta: -1, karmaDelta: 1 })),
      opt("Return the compliment, decline the job", "You told them they'd always been the harder opponent. Neither of you cried, much.",
        fin("rival", "respect", { karmaDelta: 3, happinessDelta: 5 })),
      risk("Use the offer to squeeze a raise out of your boss", 0.5,
        ["Your boss discovered a budget that had definitely not existed yesterday.", fin("rival", "leverage", { salaryPct: 15, happinessDelta: 3 })],
        ["Your boss took it personally, and so did your performance review.", fin("rival", "leverage", { performanceDelta: -12, happinessDelta: -4 })], "smarts"),
    ]),

  beat("rival", "rival_blowback", "general", 24, 75, "The Screenshot Never Dies",
    "{rival} worked it out, and the group chat worked it out before that. There's a message waiting for you that begins 'I just want to understand why'.", [
      opt("Apologise, properly and in public", "You wrote it, rewrote it, and posted it without a single qualifier. It was the worst and best afternoon of the year.",
        fin("rival", "atoned", { karmaDelta: 7, happinessDelta: -3, fameDelta: 1 })),
      risk("Deny everything", 0.45,
        ["Nobody could prove anything, and the story drifted off, leaving you with a lighter conscience on paper only.", fin("rival", "buried", { karmaDelta: -3, happinessDelta: -2 })],
        ["The denial lasted until someone found the original metadata. You were let go by Friday.", fin("rival", "exposed", { loseJob: true, karmaDelta: -5, happinessDelta: -10 })]),
      opt("Quietly settle with a cheque", "Lawyers, non-disclosure, a silence you paid for. It's not forgiveness, but it's quiet.",
        fin("rival", "settled", { bankBalanceDelta: -12000, karmaDelta: -2, happinessDelta: -2 })),
    ]),
];

// ===========================================================================
// MENTOR: the person who changes your path (or betrays it)
// ===========================================================================
const MENTOR: LifeEvent[] = [
  entry("mentor", "mentor_1", "career", 15, 38, "Someone Notices You",
    "{mentor}, who has been doing the thing you secretly want to do for thirty years, keeps stopping by. 'You've got something,' they say. 'Come by on Thursday. Bring questions. Not excuses.'", [
      opt("Show up every Thursday", "Thursdays became sacred. You learned more over coffee and criticism than in a year of class. Your friends noticed your absence.",
        begin("mentor", later("mentor_offer", 2, 4, { smartsDelta: 3, skillDeltas: { charisma: 2 }, happinessDelta: 3, relationshipDelta: { target: "Friend", delta: -4 }, setFlags: ["arc_mentor_close"] }))),
      opt("Take the advice, skip the friendship", "You mined {mentor} for tips and kept things professional. It worked, mostly.",
        begin("mentor", later("mentor_offer", 2, 4, { smartsDelta: 2, setFlags: ["arc_mentor_distant"] }))),
      opt("Decline politely. You'll find your own way", "You thanked {mentor} and kept walking. You wondered, now and then, what Thursdays might have held.",
        fin("mentor", "walked", { happinessDelta: -1, karmaDelta: 1 })),
    ], { requires: { custom: (p) => p.education.stage !== "None" || working(p) }, weight: 1.1 }),

  beat("mentor", "mentor_offer", "career", 18, 48, "The Door They Opened",
    "{mentor} has made a call. A place on a prestigious programme, or a job at their old firm, or a studio in the city: a real shot, a long way from everything you know. 'Don't make me look stupid,' they say, smiling.", [
      risk("Take the leap", 0.68,
        ["You went. The first year was brutal and the second was the best of your life. {mentor} sent a postcard every spring with the same line: 'Told you.'",
          later("mentor_proud", 5, 9, { salaryPct: 18, smartsDelta: 3, happinessDelta: 4, relationshipDelta: { target: "Friend", delta: -6 } })],
        ["It looked different from the inside. The programme was {mentor}'s stage, and your best work went out under their name.",
          later("mentor_betrayal", 1, 3, { smartsDelta: 1, happinessDelta: -6, relationshipDelta: { target: "Friend", delta: -6 } })], "smarts"),
      opt("Stay with the people you love", "You said no, with gratitude and a slightly broken heart. Home was warm, and you did not look at the postmarks.",
        later("mentor_farewell", 3, 6, { happinessDelta: 3, relationshipDelta: { target: "All", delta: 4 }, setFlags: ["arc_mentor_stay"] })),
    ]),

  beat("mentor", "mentor_proud", "career", 26, 80, "Your Turn",
    "{mentor} is retiring. The room is full of people they trained, and somehow you are the one holding the microphone. Afterwards they take you aside: 'Someone has to carry this on. It might as well be someone I like.'", [
      opt("Take over their work (and the headaches)", "You inherited the files, the grudges and the corner office. It was heavier than it looked, and better.",
        fin("mentor", "heir", { salaryPct: 10, happinessDelta: -1, karmaDelta: 3, smartsDelta: 1 })),
      opt("Give a glowing toast and go your own way", "You said the thing everyone was thinking, got a standing ovation, and went home to cry in the car.",
        fin("mentor", "gratitude", { karmaDelta: 2, happinessDelta: 4 })),
      opt("Fund a scholarship in their name and take on a protégé", "Somewhere, a nervous kid is being told to bring questions, not excuses. You have never felt older or prouder.",
        fin("mentor", "paidforward", { bankBalanceDelta: -3000, karmaDelta: 6, happinessDelta: 7, fameDelta: 1 })),
    ]),

  beat("mentor", "mentor_betrayal", "career", 20, 70, "Your Name, Their Paper",
    "It is on the front page of the trade journal: three years of your work, with {mentor}'s name alone on the byline. You are thanked in the acknowledgements. Spelled wrong.", [
      risk("Confront them in front of everyone", 0.5,
        ["You laid out the dates, the drafts and the emails in a quiet voice. The room did the rest. {mentor} 'took a sabbatical' within the month.",
          fin("mentor", "exposed", { karmaDelta: 4, happinessDelta: 5, fameDelta: 3, performanceDelta: 8 })],
        ["It was your word against a legend's. The legend had the better lawyer, and the better friends, and you had a very quiet phone afterwards.",
          fin("mentor", "crushed", { loseJob: true, happinessDelta: -10, karmaDelta: 2 })], "smarts"),
      opt("Quietly take your work elsewhere", "You packed your notes into a banker's box and left without a speech. Somewhere new, nobody had heard of {mentor}.",
        fin("mentor", "walked", { happinessDelta: -3, smartsDelta: 2, karmaDelta: 1 })),
      opt("Say nothing and keep using their influence", "It's how the world works, you told yourself, and your career agreed with you for years.",
        fin("mentor", "complicit", { salaryPct: 10, karmaDelta: -6, happinessDelta: -3 })),
    ]),

  beat("mentor", "mentor_farewell", "career", 22, 70, "The Postcard",
    "A letter from {mentor}: 'Pity about the programme. My door's still open, but I'm retiring in the spring. Last chance, kid.' The date is circled twice.", [
      risk("Go now. Late is better than never", 0.6,
        ["You were the last person {mentor} ever took on, and the only one they cried about. It changed the shape of the next decade.",
          fin("mentor", "late", { salaryPct: 10, smartsDelta: 3, happinessDelta: 4, relationshipDelta: { target: "Friend", delta: -5 } })],
        ["The door was open; the job behind it had been given to someone else. {mentor} bought you lunch to apologise. It was a nice lunch.",
          fin("mentor", "late", { happinessDelta: -3, smartsDelta: 1 })]),
      opt("Send a heartfelt thank-you and stay put", "You wrote four drafts and sent the fifth. {mentor} framed it, apparently.",
        fin("mentor", "stayed", { karmaDelta: 2, happinessDelta: 2 })),
      opt("Visit, and ask what they'd do differently", "Two hours, a pot of tea, and more truth than a year of advice. You left lighter, and a little braver.",
        fin("mentor", "wisdom", { smartsDelta: 2, happinessDelta: 4, bankBalanceDelta: -150 })),
    ]),
];

// ===========================================================================
// SECRET: something you did, that could surface
// ===========================================================================
const SECRET: LifeEvent[] = [
  entry("secret", "secret_1", "crime", 13, 24, "The Barn",
    "It was a dare. It was {friend}'s lighter, your idea, and a very dry old barn. By the time the flames were visible from the road, the two of you were already running. Nobody was hurt. Nobody saw. That's the whole problem: it's only a crime if somebody talks.", [
      opt("Swear a blood oath: nobody ever speaks of it", "You and {friend} sealed it with a pinky promise and a lot of fake bravado. It bonded you, and it sat in your chest for years.",
        begin("secret", later("secret_surface_barn", 6, 12, { karmaDelta: -3, happinessDelta: -2, relationshipDelta: { target: "Friend", delta: 8 }, setFlags: ["arc_secret_pact"] }))),
      risk("Walk up to the owner and confess", 0.6,
        ["The old farmer looked at you for a long time, then handed you a shovel. You spent the summer clearing ash, and he never mentioned it again.",
          fin("secret", "confessed", { bankBalanceDelta: -300, karmaDelta: 8, happinessDelta: 2, relationshipDelta: { target: "Friend", delta: -6 } })],
        ["The farmer called your parents, and your parents called you a lot of things. Restitution came out of your savings for years.",
          fin("secret", "confessed", { bankBalanceDelta: -800, karmaDelta: 3, happinessDelta: -8, relationshipDelta: { target: "Parent", delta: -8 } })]),
      opt("Tell no one. Not even {friend}", "You went home, scrubbed the smoke out of your hair and ate dinner. The silence started that night.",
        begin("secret", later("secret_surface_barn", 6, 12, { karmaDelta: -4, happinessDelta: -4, setFlags: ["arc_secret_alone"] }))),
    ], { requires: { hasFriend: true }, weight: 1.0 }),

  entry("secret", "secret_cheat", "romance", 24, 62, "The Thing You Haven't Said",
    "Months after it ended, you still haven't told {partner}. The only person who knows is someone you swore you'd never speak to again. Every unexplained phone buzz makes your pulse jump. Secrets are expensive to keep.", [
      risk("Come clean now, before it finds them", 0.5,
        ["They cried, then asked to hear all of it, then stayed. Therapy, a great deal of therapy, and a long winter. But it was honest.",
          fin("secret", "forgiven", { relationshipDelta: { target: "Partner", delta: -10 }, karmaDelta: 6, happinessDelta: -4 })],
        ["They listened to every word. Then they packed a bag. You'd wanted forgiveness; you got the truth, at least.",
          fin("secret", "confessed", { endRelationship: "divorce", karmaDelta: 4, happinessDelta: -12 })]),
      opt("Say nothing. Bury it deep", "You smiled at dinner, you remembered the anniversary, and you waited for the sky to fall.",
        begin("secret", later("secret_surface_affair", 2, 6, { karmaDelta: -2, happinessDelta: -3, setFlags: ["arc_secret_affair"] }))),
      opt("Cut every last tie and spend a year being unbelievably good", "You deleted numbers, changed routes and became the most attentive partner in the postcode. Guilt makes an excellent personal trainer.",
        begin("secret", later("secret_surface_affair", 4, 9, { karmaDelta: 2, happinessDelta: -1, relationshipDelta: { target: "Partner", delta: 6 }, setFlags: ["arc_secret_affair"] }))),
    ], { requires: { flagsAll: ["cheater"], married: true }, weight: 2.2 }),

  beat("secret", "secret_surface_barn", "crime", 18, 55, "'Unsolved Mysteries of the Valley'",
    "A local podcast is making a series on the old valley. Episode three is 'The Barn'. The host has been asking questions, and one of the people they asked was {friend}. You haven't slept properly for two nights.", [
      opt("Come forward before it airs and tell the owner's family", "You spoke to the grandson, you offered what you could, and you told the host the truth off the record. It was the hardest and cleanest thing you've done in years.",
        fin("secret", "confessed", { bankBalanceDelta: -2500, karmaDelta: 8, happinessDelta: 3 })),
      opt("Pay the family anonymously", "A cashier's cheque, no note. It eased the guilt without paying the debt of honesty, but the family could finally rebuild.",
        fin("secret", "amends", { bankBalanceDelta: -4000, karmaDelta: 4, happinessDelta: 1 })),
      risk("Hope it blows over", 0.5,
        ["The episode aired as a shrug: 'we may never know'. You listened to it twice, in the car, with the windows up.", fin("secret", "buried", { karmaDelta: -3, happinessDelta: -2 })],
        ["It aired. The host didn't say your name; they said everything but. The comments finished the sentence.", later("secret_reckoning", 1, 1, { karmaDelta: -2, happinessDelta: -5 })]),
    ]),

  beat("secret", "secret_reckoning", "crime", 18, 70, "It Airs",
    "The host named a decade, a street, and a first initial. It was enough. {friend} has stopped answering messages, and people at the corner shop are suddenly very interested in their change.", [
      opt("Issue a statement owning it", "You wrote it plainly: what you did, what you're sorry for, what you'll pay. The internet decided to be kind, for once.",
        fin("secret", "owned", { karmaDelta: 5, happinessDelta: -4, fameDelta: 2, bankBalanceDelta: -1500 })),
      risk("Sue the podcast", 0.35,
        ["The lawyers made it go away, and so did the episode. You didn't feel better.", fin("secret", "buried", { bankBalanceDelta: -6000, karmaDelta: -4, happinessDelta: 2 })],
        ["The case dragged on, and every filing made the story longer. You became the answer to a trivia question.", fin("secret", "exposed", { bankBalanceDelta: -9000, happinessDelta: -10, fameDelta: 3 })]),
      opt("Leave town and start again somewhere new", "Boxes, a one-way ticket, a stranger's flat. The secret came with you, but nobody knew its name.",
        fin("secret", "fled", { bankBalanceDelta: -8000, emigrate: "abroad", happinessDelta: -3, karmaDelta: -2 })),
    ]),

  beat("secret", "secret_surface_affair", "romance", 24, 72, "Addressed in Familiar Handwriting",
    "A letter lies on the mat. The handwriting is one {partner} has never seen and you would know anywhere. {partner}'s footsteps are in the hall.", [
      risk("Own it before they open it", 0.55,
        ["They hadn't opened it. You told them at the kitchen table, all of it. They didn't leave. Not that night, and not the next.",
          fin("secret", "confessed", { relationshipDelta: { target: "Partner", delta: -12 }, karmaDelta: 5, happinessDelta: -5 })],
        ["They'd already read it. The look on their face was worse than the words they chose.",
          fin("secret", "exposed", { endRelationship: "auto", happinessDelta: -12, karmaDelta: 2 })]),
      risk("Laugh it off: a scam, surely", 0.4,
        ["They bought it, or decided to. The letter went into the fire and the matter into the ground.", fin("secret", "buried", { karmaDelta: -3, happinessDelta: -3 })],
        ["They'd noticed the lie before you'd finished telling it.", fin("secret", "exposed", { endRelationship: "auto", karmaDelta: -5, happinessDelta: -14 })]),
      opt("Blame an old colleague for sending it, a total lie", "The lie came out smooth. Someone innocent lost a friendship, and you got to keep a marriage held together with tape.",
        fin("secret", "liar", { karmaDelta: -9, happinessDelta: -4, relationshipDelta: { target: "Friend", delta: -8 } })),
    ], { requires: { hasPartner: true } }),
];

export const YOUTH_ARC_EVENTS: LifeEvent[] = [...RIVAL, ...MENTOR, ...SECRET];

export const YOUTH_ARCS: Arc[] = [
  {
    id: "rival", title: "School Rivalry", emoji: "🥇", start: "{rival} is your classmate and your rival.",
    stages: [
      { flag: "arc_rival_driven", text: "You beat {rival} fair and square. They haven't forgotten." },
      { flag: "arc_rival_wronged", text: "You wronged {rival} once. Karma is patient." },
      { flag: "arc_rival_friend", text: "{rival} turned from rival to friend." },
    ],
  },
  {
    id: "mentor", title: "The Mentor", emoji: "🧭", start: "{mentor} has taken an interest in you.",
    stages: [
      { flag: "arc_mentor_close", text: "Thursdays with {mentor} are shaping you." },
      { flag: "arc_mentor_distant", text: "You take {mentor}'s advice at arm's length." },
      { flag: "arc_mentor_stay", text: "You turned down {mentor}'s offer. The door may still be open." },
    ],
  },
  {
    id: "secret", title: "A Secret", emoji: "🤫", start: "You're keeping something to yourself.",
    stages: [
      { flag: "arc_secret_pact", text: "You and {friend} swore to never speak of the barn." },
      { flag: "arc_secret_alone", text: "You carry the barn secret alone." },
      { flag: "arc_secret_affair", text: "The affair is buried, for now." },
    ],
  },
];
