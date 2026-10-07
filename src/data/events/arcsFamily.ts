import { opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { beat, begin, entry, fin, later, type Arc } from "./arcKit";

const livingSibs = (p: PlayerState) => p.relatives.filter((r) => r.relation === "Sibling" && r.alive);
const eldestParentAge = (p: PlayerState) => Math.max(0, ...p.relatives.filter((r) => r.relation === "Parent" && r.alive).map((r) => r.age));

// ===========================================================================
// SIBLING: an estrangement, and what it takes to end one
// ===========================================================================
const SIBLING: LifeEvent[] = [
  entry("sibling", "sibling_1", "family", 22, 70, "The Thing You Said at Dinner",
    "Holiday dinner, third glass of wine, and an old argument about who did what for the family in 1998. You and {sibling} finally said the things each of you had been rehearsing for years. {sibling} put down their fork, stood up, and left. The gravy congealed. Everyone looked at their plates.", [
      risk("Call tomorrow and apologise first", 0.5,
        ["It cost you a bite of pride and a very awkward phone call. {sibling} cried, then laughed, then hung up. By Sunday, you were both back to texting memes.",
          fin("sibling", "mended", { relationshipDelta: { target: "Sibling", delta: 15 }, karmaDelta: 3, happinessDelta: 3 })],
        ["{sibling} let it ring, then texted: 'not ready'. You put the phone down and stared at a wall for forty minutes.",
          begin("sibling", later("sibling_reach", 3, 6, { relationshipDelta: { target: "Sibling", delta: -12 }, happinessDelta: -4, setFlags: ["arc_sibling_proud"] }))]),
      opt("Stand your ground. They can call when they're ready", "Pride is a lovely thing to be right with. It's a cold, quiet companion at Christmas, though.",
        begin("sibling", later("sibling_reach", 3, 6, { relationshipDelta: { target: "Sibling", delta: -20 }, happinessDelta: -4, setFlags: ["arc_sibling_proud"] }))),
      opt("Give the rest of the family your side first", "By Monday everyone knew your version. By Tuesday everyone knew {sibling}'s, and the family WhatsApp became a war zone with a cat meme in the middle.",
        begin("sibling", later("sibling_feud", 3, 6, { relationshipDelta: { target: "Sibling", delta: -25 }, karmaDelta: -4, happinessDelta: -3, setFlags: ["arc_sibling_campaign"] }))),
    ], { requires: { hasSibling: true, custom: (p) => livingSibs(p).some((s) => s.relationshipBar <= 65) }, weight: 1.2 }),

  beat("sibling", "sibling_reach", "family", 24, 82, "An Invitation by Proxy",
    "A card arrives in a hand you'd know in your sleep. Inside: '{sibling}'s daughter is being christened. I put your name on the list. The rest is up to you.' It isn't signed, but there is a coffee ring on the corner. {sibling} has always been terrible at coasters.", [
      risk("Go, and be the bigger person", 0.6,
        ["You went. You stood at the back, held a baby you'd just met, and {sibling} looked at you over the font. Something shifted in the room.",
          later("sibling_peace", 1, 2, { happinessDelta: 3, relationshipDelta: { target: "Sibling", delta: 10 } })],
        ["You went, and the atmosphere lowered to ten degrees. {sibling} was formal and polite and tall as a lamppost. Everyone watched you both over their champagne.",
          later("sibling_feud", 2, 4, { happinessDelta: -4, relationshipDelta: { target: "Sibling", delta: -6 } })]),
      opt("Write back: a short, careful letter", "Seven drafts, one stamp. {sibling} replied in two lines, and that was enough for a thaw.",
        later("sibling_peace", 2, 4, { happinessDelta: 1, relationshipDelta: { target: "Sibling", delta: 6 } })),
      opt("Ignore it. Some doors stay closed", "You put the card on the fridge and left it there. Weeks, then months. Like a very passive-aggressive magnet.",
        later("sibling_feud", 3, 6, { relationshipDelta: { target: "Sibling", delta: -10 }, happinessDelta: -3 })),
    ], { requires: { hasSibling: true } }),

  beat("sibling", "sibling_peace", "family", 24, 85, "Two Chairs on a Porch",
    "{sibling} turns up on your doorstep with a bottle and no plan. You sit on the porch as it gets dark. For a long time, neither of you says anything at all.", [
      opt("Tell them, plainly, what hurt", "You said the whole thing, no padding. {sibling} didn't interrupt. At the end they said, 'I know. I'm sorry, too.' You both cried like idiots.",
        fin("sibling", "mended", { relationshipDelta: { target: "Sibling", delta: 25 }, happinessDelta: 8, karmaDelta: 3 })),
      opt("Keep it light and surface-level", "You talked about weather, work and the neighbour's dog. Perfectly nice. Perfectly empty. It's a start, anyway.",
        fin("sibling", "cordial", { relationshipDelta: { target: "Sibling", delta: 8 }, happinessDelta: 2 })),
      opt("Bring up the money you lent them in 2009", "A grievance with a date on it. {sibling} left, with the bottle.",
        fin("sibling", "cold", { relationshipDelta: { target: "Sibling", delta: -10 }, bankBalanceDelta: 500, happinessDelta: -4, karmaDelta: -2 })),
    ], { requires: { hasSibling: true } }),

  beat("sibling", "sibling_feud", "money", 25, 88, "Who Gets the Cottage",
    "A great-aunt you barely knew has left you and {sibling} a lake cottage 'to be shared, since I suspect you need the practice'. {sibling}'s solicitor wants to sell it. It smells like pine and fish. It's worth about $70,000, and a whole lot more than that to somebody.", [
      opt("Sell it and split 50/50", "The cheque was clean and the silence afterwards was messy. At least no more solicitors' letters.",
        fin("sibling", "split", { bankBalanceDelta: 35000, relationshipDelta: { target: "Sibling", delta: -4 }, happinessDelta: 2 })),
      risk("Fight for it in court: $7,000 in fees", 0.5,
        ["The judge liked your paperwork. You got the cottage, and the satisfaction lasted until the first leak, and the first family dinner without {sibling}.",
          fin("sibling", "won", { bankBalanceDelta: 28000, relationshipDelta: { target: "Sibling", delta: -30 }, karmaDelta: -4, happinessDelta: 2 })],
        ["The judge liked {sibling}'s paperwork better. You paid for the privilege of being told so.",
          fin("sibling", "lost", { bankBalanceDelta: -7000, relationshipDelta: { target: "Sibling", delta: -15 }, happinessDelta: -8 })], "smarts"),
      opt("Sign your half over to them", "You told {sibling} to keep it. Their face did something complicated. It was probably the nicest thing you've ever done, and the most expensive.",
        fin("sibling", "gift", { relationshipDelta: { target: "Sibling", delta: 18 }, karmaDelta: 8, happinessDelta: 3 })),
    ], { requires: { hasSibling: true } }),
];

// ===========================================================================
// PARENTCARE: the long goodbye
// ===========================================================================
const PARENTCARE: LifeEvent[] = [
  entry("parentcare", "parentcare_1", "family", 34, 72, "A Fall in the Kitchen",
    "The call comes at 7am: {parent} fell in the kitchen and lay on the floor for four hours before anyone found them. They are 'fine' (their word), furious about the fuss, and clearly not fine. For the first time you hear the word 'cope' in a sentence about them.", [
      opt("Move them into your home", "You cleared the spare room, bought a grab-rail and a lot of patience. {parent} insisted they'd be gone in a week.",
        begin("parentcare", later("parentcare_strain", 1, 2, { happinessDelta: -3, relationshipDelta: { target: "Parent", delta: 12 }, setFlags: ["arc_parentcare_home"] }))),
      opt("Pay for a good care home: $18,000", "It had a garden and a woman called Bernadette who ran the place like a ship. {parent} complained, in the nicest way.",
        begin("parentcare", later("parentcare_decline", 2, 3, { bankBalanceDelta: -18000, relationshipDelta: { target: "Parent", delta: 3 }, happinessDelta: -2, setFlags: ["arc_parentcare_paid"] }))),
      opt("Visit on weekends and hire a carer: $6,000", "A carer on weekdays, you on Saturdays. It wasn't enough, and it wasn't nothing.",
        begin("parentcare", later("parentcare_decline", 2, 3, { bankBalanceDelta: -6000, happinessDelta: -2, setFlags: ["arc_parentcare_visit"] }))),
      opt("It isn't your job. They made their choices", "You said it out loud to a mirror first, to see if you could. You could. That was the saddest part.",
        fin("parentcare", "distant", { karmaDelta: -7, relationshipDelta: { target: "Parent", delta: -25 }, happinessDelta: -4 })),
    ], { requires: { parentAlive: true, custom: (p) => eldestParentAge(p) >= 72 }, weight: 1.5 }),

  beat("parentcare", "parentcare_strain", "family", 36, 76, "The Long Middle",
    "Eight months in, the spare room smells of liniment and tea. You haven't had a night out since spring. {parent} is grateful, mostly, and lonely, always. Your calendar is a game of Tetris no one can win.", [
      opt("Cut your working hours to be there", "You dropped to four days. The money hurt; the afternoons were gold.",
        later("parentcare_decline", 1, 2, { salaryPct: -20, setEffort: "coast", relationshipDelta: { target: "Parent", delta: 10 }, happinessDelta: 1 })),
      opt("Hire a part-time carer: $9,000", "Hannah came three days a week, with a flask and a laugh. The house breathed again.",
        later("parentcare_decline", 1, 2, { bankBalanceDelta: -9000, relationshipDelta: { target: "Partner", delta: 6 }, happinessDelta: 2 })),
      opt("Push through and do it all yourself", "You didn't ask for help because you didn't know how. It cost you your back, your temper and a few small evenings with {partner}.",
        later("parentcare_decline", 1, 2, { healthDelta: -6, happinessDelta: -8, karmaDelta: 4, performanceDelta: -10, setEffort: "grind", relationshipDelta: { target: "Partner", delta: -10 } })),
    ]),

  beat("parentcare", "parentcare_decline", "health", 38, 86, "The Diagnosis",
    "A neurologist uses words like 'progressive'. {parent} calls you by somebody else's name in the car park. 'There's no hurry,' says the doctor, in the voice of someone who's said it a hundred times. You look at the clock, and it is, for once, entirely quiet.", [
      opt("Keep them close, with round-the-clock help: $12,000", "Nurses in shifts, the radio always on, the old armchair by the window. It was nearly the life they'd had.",
        later("parentcare_end_close", 1, 2, { bankBalanceDelta: -12000, healthDelta: -3, relationshipDelta: { target: "Parent", delta: 8 }, happinessDelta: -2 })),
      opt("Memory-care facility: $25,000", "Specialists, locked doors, a garden with a loop path so nobody gets lost. {parent} didn't always know you. They always smiled.",
        later("parentcare_end_far", 1, 2, { bankBalanceDelta: -25000, happinessDelta: -4, relationshipDelta: { target: "Parent", delta: -2 } })),
      opt("Move in with them for the duration", "You rented out your own place and slept in your childhood bed. It was a bizarre kind of homecoming.",
        later("parentcare_end_close", 1, 2, { salaryPct: -15, healthDelta: -4, happinessDelta: -4, relationshipDelta: { target: "Parent", delta: 14 }, karmaDelta: 3 })),
    ], { requires: { parentAlive: true } }),

  beat("parentcare", "parentcare_end_close", "family", 38, 92, "The Last Chapter",
    "It is quiet in the end. {parent} is in the chair, the radio is on, and a blanket is over their knees. The nurse looks up from the doorway, and you know. They died with the house around them and you in the next room.", [
      opt("Hold the funeral at home, with everyone", "Casseroles, photo albums and a lot of terrible stories told with love. The house hadn't been this loud in years.",
        fin("parentcare", "devoted", { relativeDies: "Parent", bankBalanceDelta: -3000, relationshipDelta: { target: "All", delta: 6 }, karmaDelta: 4, happinessDelta: -5 })),
      opt("Take a month off to grieve", "You didn't answer your phone. You cleared a house, wept in a hardware shop, and woke up one morning ready to carry on.",
        fin("parentcare", "devoted", { relativeDies: "Parent", performanceDelta: -10, healthDelta: 2, karmaDelta: 2, happinessDelta: -3 })),
      opt("Keep it small and go back to work on Monday", "It was how they'd have wanted it, you said, repeatedly. By March you were hollow and nobody had noticed.",
        fin("parentcare", "devoted", { relativeDies: "Parent", happinessDelta: -9, karmaDelta: 1, performanceDelta: 2 })),
    ], { requires: { parentAlive: true } }),

  beat("parentcare", "parentcare_end_far", "family", 38, 92, "The 3am Call",
    "The facility called at 3am. You were there in forty minutes, which was forty-one too long. {parent} was peaceful, a night nurse said, and wasn't alone, and you try to hold on to that.", [
      opt("Speak at the funeral, and admit you wish you'd done more", "You said it into a microphone for forty strangers. Several of them said they'd felt exactly the same, which is how guilt turns into community.",
        fin("parentcare", "distant", { relativeDies: "Parent", karmaDelta: 4, happinessDelta: -4, relationshipDelta: { target: "Sibling", delta: 8 } })),
      opt("Settle the bill and the estate quickly", "Paperwork is a type of grieving. By Friday you had filed everything and by Saturday you'd cried in the dishwasher aisle.",
        fin("parentcare", "distant", { relativeDies: "Parent", bankBalanceDelta: 6000, happinessDelta: -6, karmaDelta: 0 })),
      opt("Skip the funeral. Too busy", "You sent flowers. Nobody said anything. That was the worst part, and you knew it.",
        fin("parentcare", "absent", { relativeDies: "Parent", karmaDelta: -8, happinessDelta: -7, relationshipDelta: { target: "Sibling", delta: -15 } })),
    ], { requires: { parentAlive: true } }),
];

// ===========================================================================
// FOSTER: a home for somebody who needs one
// ===========================================================================
const FOSTER: LifeEvent[] = [
  entry("foster", "foster_1", "family", 26, 56, "The Call From Children's Services",
    "A caseworker, {caseworker}, rings on a Tuesday. A thirteen-year-old needs a home for a few months, maybe longer. 'We think you'd be a good match,' they say, which is either flattery or desperation. Possibly both. The spare room has been a gym, an office and a storage unit, in that order.", [
      opt("Say yes", "You said it before your brain caught up. The spare room was a bedroom again by Friday.",
        begin("foster", later("foster_arrival", 1, 1, { karmaDelta: 3, happinessDelta: 2 }))),
      opt("Ask for a trial weekend first, and get the room ready: $500", "Fresh paint, a desk, a lamp. {caseworker} said that's a lot more than most people bother to do.",
        begin("foster", later("foster_arrival", 1, 1, { bankBalanceDelta: -500, karmaDelta: 2, happinessDelta: 1, setFlags: ["arc_foster_ready"] }))),
      opt("Decline. It isn't the right time", "You said all the right things, and then you stood in the spare room for quite a while.",
        fin("foster", "declined", { karmaDelta: -1, happinessDelta: -2 })),
    ], { requires: { custom: (p) => p.karma >= 45 }, weight: 0.9 }),

  beat("foster", "foster_arrival", "family", 26, 62, "A Bin Bag and a Nod",
    "{fosterkid_first} arrives in a social worker's car with a bin bag of belongings and a sullen nod. They check the locks, the windows, and where you keep the knives, in that order. Nobody tells you how to do this part.", [
      risk("Give them space and leave the door open", 0.6,
        ["By the second week there was a bowl of cereal and a grudging 'thanks'. By the fourth, a joke about your taste in music.", later("foster_hearing", 1, 2, { happinessDelta: 4, setFlags: ["arc_foster_trust"] })],
        ["Space turned into silence and silence into a window left open at 2am. The police brought them back at dawn.", later("foster_trouble", 1, 1, { happinessDelta: -4 })]),
      risk("Set clear rules and a family dinner every night", 0.5,
        ["They rolled their eyes. They also asked for seconds. Rules are a form of love, you reminded yourself, in an unusually smug voice.", later("foster_hearing", 1, 2, { happinessDelta: 3, setFlags: ["arc_foster_trust"] })],
        ["The rules lasted nine days. The last thing you heard was a slammed door and a phone number you didn't recognise.", later("foster_trouble", 1, 1, { happinessDelta: -5 })]),
      risk("Book a counsellor for them: $1,200", 0.75,
        ["The counsellor, a patient man with a beanbag, got further in an hour than you had in a month.", later("foster_hearing", 1, 2, { bankBalanceDelta: -1200, happinessDelta: 3, setFlags: ["arc_foster_trust"] })],
        ["It helped, but not fast enough. Bad weeks have a rhythm, and this one ended in a broken window.", later("foster_trouble", 1, 1, { bankBalanceDelta: -1700, happinessDelta: -3 })]),
    ]),

  beat("foster", "foster_trouble", "family", 26, 64, "The Police Car in the Driveway",
    "The officer says it's 'a minor matter': a stolen phone, a fight at school, a window. {fosterkid_first} stands behind you, jaw set, eyes defiant, waiting for the sentence they've heard before: 'I'm sorry, this isn't working.'", [
      opt("Stand by them: it was a misunderstanding", "You told the officer you'd take full responsibility. {fosterkid_first} stared at you as if you'd spoken another language.",
        later("foster_hearing", 1, 2, { bankBalanceDelta: -400, karmaDelta: 3, happinessDelta: 2, setFlags: ["arc_foster_trust"] })),
      opt("Call the caseworker and ask for a new placement", "It was an honest decision and a heavy one. {fosterkid_first} packed in four minutes, in total silence.",
        fin("foster", "returned", { karmaDelta: -2, happinessDelta: -5 })),
      opt("Make them work it off with you: chores and an apology", "They scrubbed paint off a fence for a week, grumbling the whole time. Halfway through, they started to laugh.",
        later("foster_hearing", 1, 2, { karmaDelta: 2, happinessDelta: 1, setFlags: ["arc_foster_trust"] })),
    ]),

  beat("foster", "foster_hearing", "family", 27, 66, "The Hearing",
    "The courthouse smells of floor wax and anxiety. {fosterkid_first}'s birth mother has completed her programme and is petitioning for custody. The judge will ask {fosterkid_first} what they want. Both of you have been rehearsing an answer for weeks, separately.", [
      opt("Support reunification with their birth mother", "You told the judge, honestly, that she'd earned a chance. {fosterkid_first} went home on a Saturday, with a bag and your phone number on a piece of paper.",
        fin("foster", "reunited", { karmaDelta: 8, happinessDelta: -6, relationshipDelta: { target: "Friend", delta: 2 } })),
      risk("Petition to adopt them: $6,000 in legal fees", 0.55,
        ["The judge listened for an hour. Then she turned to {fosterkid_first} and asked her question. 'I'd like to stay,' they said, to the table, not to you. The room blurred.",
          later("foster_grad", 6, 8, { bankBalanceDelta: -6000, addRelative: { relation: "Child", age: 14, npc: "fosterkid" }, karmaDelta: 8, happinessDelta: 12, setFlags: ["arc_foster_adopted"] })],
        ["The judge decided in favour of reunification. {fosterkid_first} hugged you hard in the corridor. You drove home, and parked outside, and sat there for an hour.",
          fin("foster", "lost", { bankBalanceDelta: -6000, happinessDelta: -10, karmaDelta: 2 })]),
      risk("Say nothing and let the court decide", 0.5,
        ["The court sided with staying. {fosterkid_first} shrugged, as if they'd always known, and ate three slices of the celebratory cake.",
          later("foster_grad", 6, 8, { addRelative: { relation: "Child", age: 14, npc: "fosterkid" }, bankBalanceDelta: -3000, karmaDelta: 4, happinessDelta: 9, setFlags: ["arc_foster_adopted"] })],
        ["The court sided with reunification. It was the right call, probably, and you cried in the supermarket for no reason on a Thursday.",
          fin("foster", "reunited", { karmaDelta: 3, happinessDelta: -8 })]),
    ], { requires: { flagsAll: ["arc_foster_trust"] } }),

  beat("foster", "foster_grad", "family", 30, 80, "A Cap and Gown",
    "{fosterkid_first} graduates in a gown two sizes too big. You're in the third row with a phone and no dignity whatsoever, filming a stranger's back for forty seconds before they turn and find you in the crowd. They roll their eyes. They're also crying.", [
      opt("Throw them a party for all your friends and family", "Balloons, a terrible cake and a slideshow with at least one photo of {fosterkid_first} at the age of thirteen, scowling. Everyone cried.",
        fin("foster", "adopted", { bankBalanceDelta: -1500, happinessDelta: 12, karmaDelta: 4, relationshipDelta: { target: "Child", delta: 10 } })),
      opt("Give them a quiet dinner and the keys to your old car", "A tiny hatchback with a dodgy clutch. They drove it round the block twice, grinning like lunatics.",
        fin("foster", "adopted", { happinessDelta: 10, karmaDelta: 3, relationshipDelta: { target: "Child", delta: 12 } })),
    ], { requires: { flagsAll: ["arc_foster_adopted"] } }),
];

// ===========================================================================
// TEMPTATION: the road not taken, or taken
// ===========================================================================
const TEMPTATION: LifeEvent[] = [
  entry("temptation", "temptation_1", "romance", 25, 60, "The Colleague Who Laughs at Your Jokes",
    "{tempter} is warm, funny and the only person at work who gets your references. Lunch has become a habit. Tonight there's a late project, an empty floor and low lights. Nothing has happened. It's just that nothing keeps almost happening.", [
      opt("Set a boundary: group lunches from now on", "You said it kindly and out loud. {tempter} nodded, a little too fast. It stung a bit, and it was probably right.",
        fin("temptation", "boundary", { karmaDelta: 3, happinessDelta: -2, relationshipDelta: { target: "Partner", delta: 4 } })),
      opt("Keep the friendship, it's harmless", "Of course it was harmless. That was exactly what you told yourself on the way to a second coffee.",
        begin("temptation", later("temptation_trip", 1, 2, { happinessDelta: 3, setFlags: ["arc_temptation_friend"] }))),
      risk("Tell {partner} about the friendship, and ask how they feel", 0.6,
        ["{partner} listened, thought, and said: 'Thanks for telling me.' It was a little awkward and a lot of relief, and it made the whole thing smaller.",
          fin("temptation", "honest", { relationshipDelta: { target: "Partner", delta: 8 }, karmaDelta: 3, happinessDelta: 2 })],
        ["{partner} went very quiet. 'I'd rather you didn't,' they said, and that was that. It was fair, and it was also a chill.",
          fin("temptation", "honest", { relationshipDelta: { target: "Partner", delta: -6 }, karmaDelta: 2, happinessDelta: -3 })]),
    ], { requires: { hasPartner: true, hasJob: true }, weight: 1.0 }),

  beat("temptation", "temptation_trip", "romance", 25, 62, "The Conference in Another City",
    "Three days, one hotel, one bar with a pianist who clearly hates his life. {tempter} is across the table and says, 'I've never told anyone this.' The lift is behind you and your room key is in your pocket.", [
      opt("Say goodnight at the lift and call {partner}", "It was a short call and a long breath. Something that could have been big stayed small.",
        fin("temptation", "resisted", { karmaDelta: 5, relationshipDelta: { target: "Partner", delta: 6 }, happinessDelta: 1 })),
      opt("Walk them to the door, and linger", "It was a single moment that turned into a very long night. The morning was already a different shape.",
        later("temptation_fallout", 1, 2, { setFlags: ["cheater", "arc_temptation_crossed"], karmaDelta: -8, happinessDelta: 2 })),
      opt("Call a friend and talk it through before you do anything", "The friend was blunt and funny and right. 'Go to bed,' she said. 'Alone. We'll talk at breakfast.'",
        fin("temptation", "advised", { relationshipDelta: { target: "Friend", delta: 5 }, karmaDelta: 2, happinessDelta: -1 })),
    ], { requires: { hasPartner: true } }),

  beat("temptation", "temptation_fallout", "romance", 25, 66, "The Receipt",
    "{partner} is holding something small and damning: a hotel receipt, a photo, a message with a heart. They don't shout. They simply put it on the table, and wait. In the silence, a clock you've never noticed starts to tick.", [
      risk("Tell them the truth", 0.45,
        ["You told them everything. They sat there for what felt like an hour. 'I'm not leaving,' they said at last, 'but I'm not staying the same.'",
          later("temptation_therapy", 1, 2, { relationshipDelta: { target: "Partner", delta: -15 }, karmaDelta: 6, happinessDelta: -6 })],
        ["You told them everything. They listened. They packed. It was horribly polite.", fin("temptation", "left", { endRelationship: "auto", karmaDelta: 4, happinessDelta: -12 })]),
      risk("Deny it all", 0.3,
        ["They wanted so much to believe you that they did, and you hated yourself in a new, efficient way.", fin("temptation", "buried", { karmaDelta: -6, happinessDelta: -4 })],
        ["They'd already spoken to {tempter}. It was the end of a lot of things, and the beginning of a quiet, awful drive.", fin("temptation", "exposed", { endRelationship: "auto", karmaDelta: -6, happinessDelta: -14 })]),
      opt("End it before they can: leave first", "You said what neither of you had said for a year. It felt like jumping off a roof to avoid falling.",
        fin("temptation", "left", { endRelationship: "auto", karmaDelta: -3, happinessDelta: -7 })),
    ], { requires: { hasPartner: true, flagsAll: ["arc_temptation_crossed"] } }),

  beat("temptation", "temptation_therapy", "romance", 26, 68, "The Long Road Back",
    "The marriage counsellor has a box of tissues the size of a suitcase and an irritating habit of asking questions that you can't answer. 'What do you want?' she says. 'Not what do you owe. What do you want?'", [
      opt("Commit to six months of weekly sessions: $3,000", "You turned up. Every week, tissues and truth. It was the hardest thing you've ever done and, slowly, it worked.",
        fin("temptation", "repaired", { bankBalanceDelta: -3000, relationshipDelta: { target: "Partner", delta: 22 }, karmaDelta: 4, happinessDelta: 4 })),
      opt("Go twice, then decide it's behind you", "You said you were fine. {partner} said they weren't. Neither of you said anything else for a month.",
        fin("temptation", "strained", { relationshipDelta: { target: "Partner", delta: -4 }, happinessDelta: -3 })),
    ], { requires: { hasPartner: true } }),
];

// ===========================================================================
// MIDLIFE: the red convertible
// ===========================================================================
const MIDLIFE: LifeEvent[] = [
  entry("midlife", "midlife_1", "general", 40, 57, "The Convertible in the Window",
    "You've walked past the showroom every day for a month. It's red. It's ridiculous. It costs about as much as a small wedding. Your reflection in the glass has recently begun to look like your father. Something in your chest is tapping on the inside of its cage.", [
      opt("Buy the convertible: $38,000", "The roof came down and so did the years. You drove to the coast and back with the radio too loud and no destination. It was glorious and it was a lot of money.",
        begin("midlife", later("midlife_bill", 1, 2, { bankBalanceDelta: -38000, happinessDelta: 8, looksDelta: 1, setFlags: ["arc_midlife_car"] }))),
      opt("Take a sabbatical to 'find yourself'", "You handed in your notice with a speech you'd rehearsed in the shower. Your boss said, 'Take care.' You took it as a threat.",
        begin("midlife", later("midlife_sabbatical", 1, 1, { loseJob: true, happinessDelta: 6, setFlags: ["arc_midlife_quit"] }))),
      opt("Book some therapy: $2,000", "A small beige room, a clock you could see and a tissue box you could reach. You said things you'd never said, mostly about your father.",
        begin("midlife", later("midlife_reckoning", 1, 2, { bankBalanceDelta: -2000, happinessDelta: 3, healthDelta: 1, setFlags: ["arc_midlife_therapy"] }))),
      opt("Ignore it. It'll pass", "It did not pass. It sat in the corner like a houseguest.",
        fin("midlife", "ignored", { happinessDelta: -5 })),
    ], { weight: 1.2 }),

  beat("midlife", "midlife_bill", "money", 41, 62, "The Insurance Quote",
    "The convertible is divine. The insurance is not. Neither is the parking ticket from the coast road, nor the stiffness in your neck after an hour with the top down. The car is gorgeous and absurd and, increasingly, a bit lonely.", [
      opt("Take the coast road on a Tuesday and call in sick", "You called in 'a migraine', and then drove, singing, for six hours. It felt illegal. It was only unprofessional.",
        later("midlife_reckoning", 1, 2, { happinessDelta: 6, performanceDelta: -8 })),
      opt("Sell it at a loss before the shine fades", "The dealer smiled the smile of a man who'd done this a hundred times. You got $24,000 and a sense of having learned something expensive.",
        later("midlife_reckoning", 1, 2, { bankBalanceDelta: 24000, happinessDelta: -3 })),
      risk("Let your teenager borrow it", 0.7,
        ["It came back with a full tank, a trillion crumbs and a teenager who wanted to talk to you. Not a sentence you hear often.", later("midlife_reckoning", 1, 2, { relationshipDelta: { target: "Child", delta: 10 }, happinessDelta: 4 })],
        ["It came back with a dent. The teenager came back with a speech. You were too relieved nobody was hurt to say anything sensible.", later("midlife_reckoning", 1, 2, { bankBalanceDelta: -9000, healthDelta: -2, happinessDelta: -4 })]),
    ]),

  beat("midlife", "midlife_sabbatical", "general", 40, 62, "Finding Yourself",
    "Month three of 'finding yourself', and the person you've found is a middle-aged man or woman in a dressing gown, eating cereal at noon. The pilgrimage books are piled on the sofa and {partner} has started to avoid the living room.", [
      opt("Walk the 800km pilgrimage: $1,500", "Six weeks of blisters, bad coffee and strangers' kindness. You came back thinner, softer and annoyingly calm.",
        later("midlife_reckoning", 1, 2, { bankBalanceDelta: -1500, healthDelta: 4, happinessDelta: 10 })),
      opt("Start the pottery stall you've always dreamed of: $2,000", "Your first pot slumped like a sad hat. Your fortieth was nearly a bowl. A neighbour bought one, out of pity or taste.",
        later("midlife_reckoning", 1, 2, { bankBalanceDelta: -2000, happinessDelta: 6, skillDeltas: { acting: 1 } })),
      opt("Camp in the garden and sulk", "Tent, flask and a stubborn sense of grievance. {partner} brought you dinner and a very quiet look.",
        later("midlife_reckoning", 1, 2, { relationshipDelta: { target: "Partner", delta: -12 }, happinessDelta: 1 })),
    ], { requires: { flagsAll: ["arc_midlife_quit"] } }),

  beat("midlife", "midlife_reckoning", "general", 42, 68, "Who You Are Now",
    "A grey Sunday. You look at the life you built: the house, the people, the dents. The restlessness has changed shape, and it isn't about a car any more. It's asking whether you meant any of this. Honestly, you're not sure. But you've got a choice, which is itself a luxury.", [
      opt("Recommit to the life you have", "You didn't change a single thing, except how you looked at them. It was the most dramatic act of your year.",
        fin("midlife", "renewed", { happinessDelta: 6, relationshipDelta: { target: "All", delta: 6 }, karmaDelta: 2 })),
      opt("Change one big thing on purpose: retrain for a new career: $5,000", "Evening classes, flashcards and a very young classmate who called you 'sir'. You graduated with a better CV and worse knees.",
        fin("midlife", "reinvented", { bankBalanceDelta: -5000, smartsDelta: 3, happinessDelta: 6, salaryPct: 8 })),
      opt("Burn the boats: sell up and start over somewhere new: $4,000", "A removal van, a one-way ticket and a lot of people saying 'but why'. You didn't have an answer. You had a direction.",
        fin("midlife", "fled", { bankBalanceDelta: -4000, emigrate: "abroad", happinessDelta: 4, karmaDelta: -2 })),
    ]),
];

export const FAMILY_ARC_EVENTS: LifeEvent[] = [...SIBLING, ...PARENTCARE, ...FOSTER, ...TEMPTATION, ...MIDLIFE];

export const FAMILY_ARCS: Arc[] = [
  {
    id: "sibling", title: "Estranged", emoji: "💔", start: "You and {sibling} aren't speaking.",
    stages: [
      { flag: "arc_sibling_proud", text: "You and {sibling} aren't speaking. Someone will have to blink." },
      { flag: "arc_sibling_campaign", text: "The family has taken sides in your quarrel with {sibling}." },
    ],
  },
  {
    id: "parentcare", title: "Caring for a Parent", emoji: "🕯️", start: "{parent} needs you more every year.",
    stages: [
      { flag: "arc_parentcare_home", text: "{parent} lives with you now, and everything has changed." },
      { flag: "arc_parentcare_paid", text: "{parent} is in a care home. You visit when you can." },
      { flag: "arc_parentcare_visit", text: "{parent} is declining. You're doing what you can." },
    ],
  },
  {
    id: "foster", title: "A Foster Child", emoji: "🏡", start: "Children's Services is asking you to open your home.",
    stages: [
      { flag: "arc_foster_ready", text: "The spare room is ready. A child is arriving." },
      { flag: "arc_foster_trust", text: "{fosterkid_first} is learning to trust you. A court date is coming." },
      { flag: "arc_foster_adopted", text: "{fosterkid_first} is part of your family now." },
    ],
  },
  {
    id: "temptation", title: "A Temptation", emoji: "🍷", start: "{tempter} is a little too easy to talk to.",
    stages: [
      { flag: "arc_temptation_friend", text: "Your 'harmless' friendship with {tempter} is getting complicated." },
      { flag: "arc_temptation_crossed", text: "You crossed a line with {tempter}. The truth is catching up." },
    ],
  },
  {
    id: "midlife", title: "Midlife Crisis", emoji: "🏎️", start: "Something in you is restless.",
    stages: [
      { flag: "arc_midlife_car", text: "The convertible was fun. What's next?" },
      { flag: "arc_midlife_quit", text: "You're on a sabbatical, finding yourself." },
      { flag: "arc_midlife_therapy", text: "Therapy is turning up uncomfortable truths." },
    ],
  },
];
