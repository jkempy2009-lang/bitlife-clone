import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { beat, begin, entry, fin, later, type Arc } from "./arcKit";
import { equaliseWithSiblings, giftSiblings } from "@/engine/estate";

/**
 * Generations: the estate that families fight over, and the first years of an heir's life.
 * Family flags (raised_wealthy, family_scandal, ...) are set in engine/generations.ts.
 */

const recentlyBereaved = (p: PlayerState) =>
  p.relatives.some((r) => r.relation === "Parent" && !r.alive && (r.deathYear ?? 0) >= p.year - 2);
const hasLivingGrandparent = (p: PlayerState) => p.relatives.some((r) => r.relation === "Grandparent" && r.alive);
const hasSurvivingParent = (p: PlayerState) => p.relatives.some((r) => r.relation === "Parent" && r.alive);

// ===========================================================================
// ESTATE: who gets what when a parent dies
// ===========================================================================
const ESTATE: LifeEvent[] = [
  entry("estate", "estate_will", "family", 20, 80, "The Reading of the Will",
    "The solicitor's office smells of old paper and carpet shampoo. {lateparent}'s will is read in a flat voice that makes everything sound like a parking fine. The family home goes to one of you; the savings are split in an unusual ratio; there is a surprising bequest to a cat charity. {sibling} is counting something on their fingers.", [
      opt("Propose splitting everything evenly", "You said it before anyone could argue. Somebody exhaled. It was the cleanest sentence of the afternoon.",
        begin("estate", later("estate_peace", 1, 2, { karmaDelta: 4, relationshipDelta: { target: "Sibling", delta: 10 }, setFlags: ["arc_estate_fair"] }))),
      opt("Contest the will: you did the caring ($5,000 in fees)", "You said the quiet part out loud: who showed up, who paid, who changed the sheets. {sibling} turned a very particular shade of white.",
        begin("estate", later("estate_lawyers", 1, 1, { bankBalanceDelta: -5000, relationshipDelta: { target: "Sibling", delta: -12 }, setFlags: ["arc_estate_contest"] }))),
      opt("Take what you're given and stay out of it", "A signature, a handshake, a drive home with the radio off. You'd decided long ago that peace was worth more than a piano.",
        fin("estate", "walked", { happinessDelta: -2, karmaDelta: 1 })),
    ], { requires: { hasSibling: true, flagsNone: ["gen_heir"], custom: recentlyBereaved }, weight: 4 }),

  entry("estate", "estate_heir_will", "family", 0, 90, "The Reading of the Will",
    "The solicitor's office smells of old paper and carpet shampoo. {lateparent}'s will names you as the main heir, the one to carry the name, and your siblings as 'also beneficiaries'. Nobody is smiling. {sibling} is counting something on their fingers, and the pen the solicitor hands you is heavier than it looks.", [
      opt("Split the estate equally with your siblings", "You told the solicitor to redraw the numbers. {sibling} stared at you for a long moment, and then cried into a tissue the solicitor, who's seen it all, silently provided.",
        begin("estate", later("estate_peace", 1, 2, { apply: (pl) => equaliseWithSiblings(pl), karmaDelta: 5, relationshipDelta: { target: "Sibling", delta: 15 }, setFlags: ["arc_estate_fair"] }))),
      opt("Give each sibling a generous gift and keep the rest", "A fair gesture, if not quite a fair share. It took the sting out of the room, mostly.",
        begin("estate", later("estate_peace", 1, 2, { apply: (pl) => giftSiblings(pl, 0.08), karmaDelta: 2, relationshipDelta: { target: "Sibling", delta: 7 }, setFlags: ["arc_estate_fair"] }))),
      opt("Keep it all: it was left to you", "You signed. The pen scratched like a fingernail. {sibling} left the room without a word and the door did the speaking.",
        begin("estate", later("estate_lawyers", 1, 2, { karmaDelta: -5, relationshipDelta: { target: "Sibling", delta: -25 }, happinessDelta: -2, setFlags: ["arc_estate_greedy"] }))),
    ], { scheduledOnly: true, requires: { hasSibling: true } }),

  beat("estate", "estate_lawyers", "money", 18, 88, "Letters from Solicitors",
    "The letters come on thick cream paper, with a crest. 'Our client contends...' is how they all begin. {sibling} has hired somebody expensive. The family dinner table has become a legal exhibit, and nobody has had pudding in months.", [
      opt("Settle out of court: $4,000", "A compromise that left nobody smiling, and everybody breathing. You shook hands at the door with a stranger's courtesy.",
        fin("estate", "settled", { bankBalanceDelta: -4000, relationshipDelta: { target: "Sibling", delta: -3 }, happinessDelta: 1 })),
      risk("Fight to the end: $9,000", 0.5,
        ["The judge found in your favour, in a dry paragraph that took four minutes to read. You won the house. You've never felt so lonely in a victory.",
          fin("estate", "won", { bankBalanceDelta: 20000, relationshipDelta: { target: "Sibling", delta: -25 }, karmaDelta: -3, happinessDelta: -1 })],
        ["The judge found for {sibling}. Your legal fees were, in a cruel twist, larger than the item in dispute.",
          fin("estate", "lost", { bankBalanceDelta: -9000, relationshipDelta: { target: "Sibling", delta: -15 }, happinessDelta: -8 })], "smarts"),
      opt("Back down and apologise", "It cost you a house and a certain amount of pride. {sibling} cried, and so did you. It turned out neither of you had wanted the house.",
        fin("estate", "mended", { relationshipDelta: { target: "Sibling", delta: 14 }, karmaDelta: 4, happinessDelta: 2 })),
    ], { requires: { hasSibling: true } }),

  beat("estate", "estate_peace", "family", 18, 90, "The House Is Empty",
    "You and {sibling} spend a weekend clearing {lateparent}'s house. There are forty years of birthday cards in a biscuit tin. In the attic, a dusty piano and an argument waiting to happen about it.", [
      opt("Each take one thing, donate the rest", "A teapot, a coat, a tobacco tin of buttons. The rest went to a charity shop with an awful lot of laughter, and a little crying in the car.",
        fin("estate", "kept", { relationshipDelta: { target: "Sibling", delta: 12 }, karmaDelta: 4, happinessDelta: 4 })),
      opt("Sell everything and split the cash", "An auctioneer, a van and a lot of strangers in the hall. Business-like, if a bit bleak. The money was good.",
        fin("estate", "sold", { bankBalanceDelta: 6000, relationshipDelta: { target: "Sibling", delta: -2 }, happinessDelta: -2 })),
      opt("Argue about the piano", "Neither of you can play. Neither of you will give it up. It's still in the attic, and so is the grudge.",
        fin("estate", "feud", { relationshipDelta: { target: "Sibling", delta: -8 }, happinessDelta: -3 })),
    ], { requires: { hasSibling: true } }),
];

// ===========================================================================
// LEGACY: the first years of a new generation, and the long shadow of the last
// ===========================================================================
const heir = { flagsAll: ["gen_heir"] };

const LEGACY: LifeEvent[] = [
  ev("legacy_memorial", "family", 0, 120, "The Day You Said Goodbye",
    "The chapel is full of people you don't know, all of whom knew {lateparent}. Somebody has put {lateparent}'s favourite song on the speakers, and somebody else starts crying at the wrong moment, which sets everyone off. It's your turn to stand up.", [
      opt("Say a few words", "You stood, forgot your notes and told the truth instead. Strangers came to find you afterwards to tell you what {lateparent} had done for them.",
        { karmaDelta: 2, happinessDelta: -3, relationshipDelta: { target: "Parent", delta: 6 } }),
      opt("Hold the nearest hand and say nothing", "Nobody said anything wise. Somebody squeezed back. It was, possibly, the right amount of words.",
        { relationshipDelta: { target: "All", delta: 4 }, happinessDelta: -2 }),
      opt("Slip out the side door and be alone for a while", "You sat on the church steps, listening to the muffled hymn through the wall. Nobody noticed you were gone. Everybody did.",
        { happinessDelta: -5, healthDelta: -1, relationshipDelta: { target: "All", delta: -3 }, setFlags: ["grief_alone"] }),
    ], { once: true, scheduledOnly: true, cooldown: 0 }),

  ev("legacy_letter_note", "family", 0, 120, "A Letter in Familiar Handwriting",
    "Among the papers is an envelope with your name on it in {lateparent}'s handwriting. On the back, underlined twice: 'Open when you need it.' The glue is tired, and so, somehow, are you.", [
      opt("Open it right now", "It was two pages: advice, apologies and a recipe. Not the great revelation, but you read it six times.",
        { happinessDelta: 4, karmaDelta: 2, smartsDelta: 1 }),
      opt("Keep it sealed until you really need it", "You put it in a drawer, where it sat like a small, warm stone. Sometimes you'd touch the corner on your way to bed.",
        { happinessDelta: 1, queueAfter: { id: "legacy_letter_later", years: [6, 14] }, setFlags: ["legacy_letter_kept"] }),
      opt("Burn it unopened. You've heard enough", "A match, a saucer and a lot of smoke. You told yourself you felt nothing, and the house smelled of regret for a week.",
        { karmaDelta: -2, happinessDelta: -3, setFlags: ["legacy_letter_burned"] }),
    ], { once: true, scheduledOnly: true, cooldown: 0 }),

  ev("legacy_letter_later", "family", 12, 120, "The Letter, Finally",
    "It's been years, and tonight is the night. You take out the envelope you never opened, with its tired glue and its underlined sentence. 'Open when you need it.' You discover you do.", [
      opt("Read it aloud to someone you love", "Your voice cracked on the second line. The room did the rest. It was the best night you'd had in years, and the saddest.",
        { relationshipDelta: { target: "All", delta: 8 }, happinessDelta: 6 }),
      opt("Read it alone, in the quiet", "It said what you needed it to, and also a few things you didn't, and that was how you knew it was real.",
        { happinessDelta: 8, smartsDelta: 1 }),
      opt("Write your own reply, and keep both for your own child", "You wrote four drafts of a letter for a child who doesn't exist yet. It was the nicest thing you'd ever done, and the most mortal.",
        { karmaDelta: 3, happinessDelta: 5, setFlags: ["legacy_letter_passed"] }),
    ], { once: true, scheduledOnly: true, cooldown: 0, requires: { flagsAll: ["legacy_letter_kept"] } }),

  ev("legacy_scandal_whispers", "school", 6, 17, "The Whispers", "Two kids stop talking when you walk into the cloakroom. 'My mum says what {lateparent} did...' they begin, then stop. You have already learned to read the pauses.", [
    risk("Answer with your fists", 0.4, ["It was over in ten seconds. They never mentioned it again, and neither did anyone else.", { karmaDelta: -2, happinessDelta: 2 }], ["It was over in ten seconds, and so was your clean record. A letter went home.", { karmaDelta: -3, happinessDelta: -4, relationshipDelta: { target: "Parent", delta: -4 } }], "health"),
    opt("Be impossible to dislike", "You were kind, funny and extremely well-behaved, which is a heavy thing to carry at twelve. By spring they'd forgotten what the whispers were about.", { skillDeltas: { charisma: 2 }, karmaDelta: 2, happinessDelta: -2 }),
    opt("Ask for the truth at home", "It was an awkward evening, a long conversation and a very quiet cup of tea. The truth wasn't flattering, but it was yours.", { relationshipDelta: { target: "Parent", delta: 6 }, smartsDelta: 1, happinessDelta: -3 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_scandal"] }, weight: 3 }),

  ev("legacy_prison_shadow", "general", 8, 26, "That Prisoner's Kid", "A boy at the bus stop says it loudly: 'My dad says your family's got form.' The rest of the queue pretends to be very interested in the timetable.", [
    opt("Join the neighbourhood watch and prove them wrong", "You turned up in a hi-vis vest, to general amazement. A skinny old man shook your hand and said he'd always liked your family. He may have been confused.", { karmaDelta: 3, happinessDelta: -1 }),
    opt("Lean in. Let them think you're dangerous", "It was a useful reputation. It was also a lonely one, and the stare practice cost you a friend or two.", { karmaDelta: -3, skillDeltas: { charisma: 2 }, happinessDelta: 1, relationshipDelta: { target: "Friend", delta: -3 } }),
    opt("Keep your head down and your grades up", "You studied in the library, ate lunch quietly and kept receipts. It worked, in the way that moving away works.", { smartsDelta: 2, happinessDelta: -2 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_prison"], flagsNone: ["family_scandal"] }, weight: 3 }),

  ev("legacy_famous_shadow", "fame", 12, 40, "Whose Child Are You?", "A teacher, a journalist and a taxi driver all ask the same question in the same week: 'Aren't you the child of...' The name opens doors. It also stands in front of you in photographs.", [
    opt("Lean into the name", "A magazine interview, a free dinner and a surprisingly tidy cheque. You felt less like yourself and more like a brand.", { fameDelta: 4, bankBalanceDelta: 1500, karmaDelta: -1, happinessDelta: 2 }),
    opt("Use it to open one door, and only one", "A single phone call. Then you walked through on your own. It was a clever use of an unfair advantage.", { fameDelta: 1, performanceDelta: 6, smartsDelta: 1 }),
    opt("Change the subject, and then possibly the surname", "You introduced yourself with your middle name for a year. Nobody asked, and you were quietly proud.", { happinessDelta: 3, fameDelta: -2, karmaDelta: 1 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_famous"] }, weight: 3 }),

  ev("legacy_family_business", "money", 18, 50, "The Old Firm", "The family business still has your surname above the door and a managing director who calls you 'young one'. A buyer has made an offer for your share, and the office smells exactly the way it did when you were small.", [
    opt("Sell your share: $45,000", "A signature, a handshake and a surprising absence of ceremony. The name on the door was changed within a month.", { bankBalanceDelta: 45000, happinessDelta: -2, karmaDelta: -1, setFlags: ["legacy_business_sold"] }),
    opt("Keep your share and take a seat on the board", "Quarterly meetings, bad biscuits and a seat at a very long table. You have opinions about the carpet.", { happinessDelta: 3, karmaDelta: 1, performanceDelta: 3, setFlags: ["legacy_business_kept"] }),
    opt("Work there for a year to learn the ropes", "You learned the ledgers, the suppliers and that nobody loves a boss's child. By Christmas they'd stopped hiding the biscuits.", { smartsDelta: 2, skillDeltas: { charisma: 2 }, happinessDelta: -2, setFlags: ["legacy_business_kept"] }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_legacy_business"], flagsNone: ["legacy_business_sold", "legacy_business_kept"] }, weight: 3 }),

  ev("legacy_athletic_calling", "general", 8, 22, "The Name on the Trophy Cabinet", "A coach squints at you across the playground. 'You're the athlete's child, aren't you?' They check your stride. They check your lungs. They quietly offer you a place on the junior team.", [
    opt("Join the junior squad", "Mornings at six, the smell of liniment and a knot of pride in your throat. Your parent would have loved the whistle.", { skillDeltas: { athletics: 8 }, healthDelta: 2, setFlags: ["athlete_dream"], happinessDelta: 2 }),
    opt("Pick a different sport: your own", "It was harder: no legacy, no reputation, no free pass. You were quietly delighted.", { skillDeltas: { athletics: 4 }, happinessDelta: 3 }),
    opt("Refuse the family sport", "You said you'd rather read. The coach looked wounded, then nodded. Nobody ever asked you again, which was a relief and a loss.", { happinessDelta: 2, smartsDelta: 1 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_athletic"] }, weight: 3 }),

  ev("legacy_artistic_house", "general", 6, 20, "A House Full of Instruments", "You grew up among guitars with names, sheet music in the bath and a wardrobe of costumes. A visiting friend of the family spots a battered case and says, 'You've got your parent's hands.'", [
    opt("Learn from the old notebooks", "The marginalia was better than any teacher. You played slowly, badly and for hours.", { skillDeltas: { music: 8 }, happinessDelta: 3, setFlags: ["music_dream"] }),
    opt("Take acting classes", "You borrowed a coat from the family wardrobe and became, for an afternoon, somebody else entirely.", { skillDeltas: { acting: 8 }, happinessDelta: 3, setFlags: ["acting_dream"] }),
    opt("Keep well away from the family circus", "You took up maths. The family took this as a minor betrayal, and you took it as a hobby.", { smartsDelta: 2, happinessDelta: 1 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_artistic"] }, weight: 3 }),

  ev("legacy_political_dinner", "general", 10, 36, "Dinner with a Senator", "A party fundraiser at the family house. Your late parent's old colleagues remember you as 'the little one'. A senator pats your shoulder and says, 'We could use a mind like yours.' Somebody takes a picture.", [
    opt("Work the room", "You shook forty hands and remembered thirty names. It felt like a gift, and a very slight burden.", { skillDeltas: { charisma: 5 }, fameDelta: 1, happinessDelta: 1 }),
    opt("Argue with the senator about the budget", "You were thirteen, wrong and passionate. They loved it, and said so in the newsletter.", { skillDeltas: { charisma: 3 }, karmaDelta: 2, smartsDelta: 1 }),
    opt("Hide in the kitchen with the caterers", "The caterers were fascinating. You learned all their names, and several recipes.", { happinessDelta: 3, karmaDelta: 1 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "family_political"] }, weight: 3 }),

  ev("legacy_poor_pride", "general", 8, 24, "Hand-Me-Downs", "Your coat was your cousin's, your shoes were a neighbour's, your lunch is something wrapped in foil. A classmate says, kindly and clumsily, 'We can share if you want.' It lands like a slap.", [
    opt("Work odd jobs after school", "Paper rounds, dog-walking and a stint at the car wash. You came home smelling of soap and pride.", { bankBalanceDelta: 700, smartsDelta: -1, happinessDelta: -1, healthDelta: 1 }),
    opt("Study as if it's the only way out", "It might have been. You worked until your pencils bit back, and you came top of the year.", { smartsDelta: 3, happinessDelta: -3 }),
    opt("Accept the kindness with grace", "You said yes to the sandwich. It turned out to be the first of many, and the beginning of a rather good friendship.", { karmaDelta: 3, relationshipDelta: { target: "Friend", delta: 4 }, happinessDelta: 2 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "raised_poor"] }, weight: 3 }),

  ev("legacy_wealth_expect", "money", 12, 30, "The Name on the Cheque", "Everyone assumes you're paying. At the pub, in the queue, at the school trip, even at the funeral of a classmate's goldfish. It's flattering and exhausting and, increasingly, a little lonely.", [
    opt("Pay for everyone's night out: $400", "The mood was glorious. The bill was $400. It was also, you suspect, the entire basis of two friendships.", { bankBalanceDelta: -400, relationshipDelta: { target: "Friend", delta: 5 }, karmaDelta: -1 }),
    opt("Take a summer job to prove something", "Eight weeks of folding shirts for a manager who'd never heard of your surname. It was bliss.", { smartsDelta: 1, karmaDelta: 3, happinessDelta: 2, bankBalanceDelta: 1400 }),
    opt("Coast. The family money will cover it", "It did cover it, in every sense, and you felt it quietly wear away something you couldn't name.", { happinessDelta: 5, karmaDelta: -3, smartsDelta: -1 }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "raised_wealthy"] }, weight: 3 }),

  ev("legacy_neglected_child", "family", 6, 28, "They Were Always Working", "You've been told for years that {lateparent} 'did it all for you'. Sorting through a box in the loft, you find school plays they never attended, tickets they bought for the ones they missed, and a drawing you made at six with the caption: 'Please come'.", [
    opt("Forgive them. They were doing their best", "It took a long walk and a longer sigh. In the end you wrapped the drawing in tissue and kept it.", { karmaDelta: 4, happinessDelta: 3 }),
    opt("Stay angry. Someone should be", "It was warm, in a way, to stay angry. It was also exhausting, and a bit lonely.", { karmaDelta: -1, happinessDelta: -4 }),
    opt("Resolve to be a different sort of person", "You wrote it on a postcard and stuck it on the fridge: 'be there'. It became a quiet sort of religion.", { smartsDelta: 1, karmaDelta: 3, happinessDelta: 1, setFlags: ["legacy_balance"] }),
  ], { once: true, requires: { flagsAll: ["gen_heir", "parent_neglect"] }, weight: 3 }),

  ev("legacy_anniversary", "family", 14, 80, "The Anniversary", "It's been years since {lateparent} died. You wake up on the day knowing it before you open your eyes. There's drizzle on the windows, and no one has called.", [
    opt("Visit the grave with flowers and an old story", "You told the headstone three bad jokes and a good memory. It listened, as it always had.", { happinessDelta: 3, karmaDelta: 2 }),
    opt("Hold a memorial dinner with family and friends: $300", "A long table, a favourite recipe and everyone telling the same stories in different voices. It was loud, and warm, and right.", { bankBalanceDelta: -300, relationshipDelta: { target: "All", delta: 6 }, happinessDelta: 4 }),
    opt("Let the day pass and feel guilty about it for a week", "Work, dishes, an email about nothing in particular. It was only at midnight that the date caught up with you.", { happinessDelta: -4 }),
  ], { once: true, requires: { ...heir, custom: (p: PlayerState) => p.age >= 14 && p.relatives.some((r) => r.relation === "Parent" && !r.alive && (r.deathYear ?? 0) <= p.year - 3) }, weight: 1.2 }),

  ev("legacy_grandparent_stories", "family", 6, 36, "Gran's Stories", "Your grandmother, or your grandfather, depending on who's closest, has started telling you stories about {lateparent} as a child. There was a goat. There was a bicycle. There was a sensible reason for the goat, apparently.", [
    opt("Ask for every story, from the start", "An entire afternoon, a tin of shortbread and a second history of your family. By teatime you were somebody who knew where they came from.", { relationshipDelta: { target: "Grandparent", delta: 10 }, happinessDelta: 4, smartsDelta: 1 }),
    opt("Record them on your phone", "Forty minutes of tape, fumbling and chuckling. You've listened since, more than you'd admit.", { relationshipDelta: { target: "Grandparent", delta: 6 }, smartsDelta: 1, happinessDelta: 2 }),
    opt("Ask about the family secrets", "A very long pause. A very short answer. A sudden need for more shortbread. Some things are only passed down in silence.", { relationshipDelta: { target: "Grandparent", delta: -3 }, karmaDelta: 0, smartsDelta: 1 }),
  ], { once: true, requires: { ...heir, custom: hasLivingGrandparent }, weight: 3 }),

  ev("legacy_surviving_parent", "family", 5, 24, "The Quiet House", "The house is quieter than it should be. {parent} sits at the kitchen table until late, a mug going cold between both hands. Neither of you says very much, and both of you notice.", [
    opt("Sit with them, and just be there", "No speeches, no solutions: you pulled up a chair and a blanket and stayed until the mug was empty. They squeezed your hand.", { relationshipDelta: { target: "Parent", delta: 12 }, happinessDelta: -1 }),
    opt("Throw yourself into school to make them proud", "Top marks, no social life and a very tidy room. It worked, in the way that running away works.", { smartsDelta: 2, happinessDelta: -3, relationshipDelta: { target: "Parent", delta: 5 } }),
    opt("Act out. It's not fair", "Slammed doors, a detention and a dreadful row about nothing. It was grief wearing a very bad disguise.", { karmaDelta: -2, relationshipDelta: { target: "Parent", delta: -8 }, happinessDelta: 2 }),
  ], { once: true, requires: { ...heir, custom: hasSurvivingParent }, weight: 3 }),
];

export const LEGACY_ARC_EVENTS: LifeEvent[] = [...ESTATE, ...LEGACY];

export const LEGACY_ARCS: Arc[] = [
  {
    id: "estate", title: "The Estate", emoji: "⚖️", start: "The estate is not settled. Siblings are watching each other.",
    stages: [
      { flag: "arc_estate_fair", text: "You offered a fair split. Now to sort the house." },
      { flag: "arc_estate_contest", text: "You're contesting the will. Solicitors are involved." },
      { flag: "arc_estate_greedy", text: "You kept the estate. {sibling} has gone quiet, and then loud." },
    ],
  },
];
