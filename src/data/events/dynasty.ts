import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { claimFromRichestSibling } from "@/engine/estate";
import { clamp } from "@/lib/format";

/**
 * The family across generations: a will that reads differently from how you hoped, what a surname opens (and
 * closes), the trust, the heir you have been raising, and the feuds that outlive the people who started them.
 * Ids are prefixed `dyn_`. Name clout and flags are set in engine/dynasty.ts.
 */

const clout = (p: PlayerState, field: keyof PlayerState["dynasty"]["clout"], min = 30) => (p.dynasty?.clout[field] ?? 0) >= min;
const groomed = (p: PlayerState) => p.relatives.find((r) => r.relation === "Child" && r.alive && r.groom && r.groom.level >= 45 && r.age >= 14 && r.age <= 22);

export const DYNASTY_EVENTS: LifeEvent[] = [
  // ---------- the will ----------
  ev("dyn_estate_short", "family", 16, 100, "The Will Reads Differently",
    "The solicitor clears her throat twice before she gets to the part about you. {sibling} is named as the principal heir; you are named as 'also remembered'. There is a long silence. Somebody's chair scrapes.", [
      opt("Accept it: money isn't worth the family", "You shook the solicitor's hand, squeezed {sibling}'s shoulder and drove home with the windows down. It cost you something, and you decided it was worth it.",
        { karmaDelta: 3, happinessDelta: -2, relationshipDelta: { target: "Sibling", delta: 8 } }),
      risk("Contest the will ($6,000 in fees)", 0.45,
        ["The judge found the will had been unevenly drawn and redistributed part of it. You won. You also gained a sibling who won't return calls.",
          { bankBalanceDelta: -6000, relationshipDelta: { target: "Sibling", delta: -22 }, karmaDelta: -2, apply: (p) => { claimFromRichestSibling(p, 0.5); } }],
        ["The judge upheld the will in a dry paragraph that took four minutes to read. Your fees were the only thing that changed hands.",
          { bankBalanceDelta: -6000, relationshipDelta: { target: "Sibling", delta: -12 }, happinessDelta: -6 }], "smarts"),
      risk("Ask {sibling}, as family, to even it out", 0.5,
        ["{sibling} stared at the table for a long time and then said, 'You're right.' A cheque, a hug and a surprisingly easy afternoon.",
          { relationshipDelta: { target: "Sibling", delta: 10 }, karmaDelta: 2, happinessDelta: 3, apply: (p) => { claimFromRichestSibling(p, 0.35); } }],
        ["'It's what they wanted,' {sibling} said, and the conversation ended there. It has not really started again since.",
          { relationshipDelta: { target: "Sibling", delta: -10 }, happinessDelta: -4 }]),
    ], { scheduledOnly: true, once: true, cooldown: 0, requires: { hasSibling: true } }),

  // ---------- what a surname opens ----------
  ev("dyn_name_political", "career", 16, 38, "A Famous Surname in a Political Town",
    "A party organiser at a fundraiser looks at your name tag and then at you. 'Your family,' she says carefully, 'was something in this town.' You are handed a glass of warm wine and three business cards.", [
      opt("Take the internship at party headquarters", "Photocopying, canvassing and a lot of people saying the family name as if it were a recommendation. It was one.",
        { skillDeltas: { charisma: 4 }, relationshipDelta: { target: "Friend", delta: 2 }, performanceDelta: 4, apply: (p) => { p.statecraft.machine = clamp(p.statecraft.machine + 8); } }),
      opt("Make your own way and keep the name out of it", "You used your middle initial for a year and your second cousin's maiden name for another. When it finally got out, you had a record of your own.",
        { smartsDelta: 1, karmaDelta: 2, happinessDelta: 2 }),
      opt("Walk away from politics altogether", "The family business, you told them, can run itself. There was a pause in which several generations looked at you from the wall.",
        { happinessDelta: 2, karmaDelta: 1, apply: (p) => { p.dynasty.clout.political = Math.round((p.dynasty.clout.political ?? 0) * 0.7); } }),
    ], { once: true, requires: { flagsAll: ["gen_heir", "clout_political"], custom: (p) => clout(p, "political") } }),

  ev("dyn_name_business", "money", 18, 45, "The Name on the Door",
    "A banker you've never met sends a handwritten note: 'We were fond of your family's account.' An old supplier waves your invoices through. A stranger at a wedding says he would back anyone called by your name.", [
      opt("Take the family friends' offer to invest: $30,000", "Handshakes, a short meeting and a surprisingly warm cheque. It felt like money, and it felt like an obligation.",
        { bankBalanceDelta: 30000, karmaDelta: -1, happinessDelta: 2, setFlags: ["family_backers"] }),
      opt("Take a modest seat on the old board and learn", "Quarterly meetings, a very long table and several people who knew your grandparent. You learned more in a year than in a degree.",
        { smartsDelta: 2, performanceDelta: 4, happinessDelta: 1 }),
      opt("Refuse every favour. You'll earn it", "You turned down three offers and a lunch. It cost you a head start and bought you the right to say you did it yourself.",
        { karmaDelta: 3, smartsDelta: 1, happinessDelta: 2 }),
    ], { once: true, requires: { flagsAll: ["gen_heir", "clout_business"], custom: (p) => clout(p, "business") } }),

  ev("dyn_name_sport", "general", 8, 30, "The Name on the Shirt",
    "{name}: that's the surname on the oldest trophy in the clubhouse. A coach introduces you as 'the next one', and the whole room turns to look. Somebody has already hung a scarf with your family's colours on it.", [
      opt("Embrace the legacy", "You wore the name like armour. Scouts came to your games, which was wonderful, and the comparisons followed, which was less so.",
        { skillDeltas: { athletics: 3 }, fameDelta: 2, happinessDelta: 1, apply: (p) => { p.athlete.exposure = clamp(p.athlete.exposure + 10); p.athlete.image = clamp(p.athlete.image + 5); p.athlete.mental = clamp(p.athlete.mental - 4); } }),
      opt("Make your own name: change clubs", "You moved across town under a different shirt. Nobody gave you a head start and nobody drew a comparison, which was exactly the point.",
        { skillDeltas: { athletics: 2 }, karmaDelta: 2, happinessDelta: 3, apply: (p) => { p.athlete.mental = clamp(p.athlete.mental + 6); p.athlete.exposure = clamp(p.athlete.exposure - 4); } }),
      opt("Ask your parent to coach you", "Evenings on the training field, a flask of tea and more honest criticism than you'd ever heard. It was the best year of your childhood.",
        { skillDeltas: { athletics: 5 }, relationshipDelta: { target: "Parent", delta: 10 }, happinessDelta: 2, apply: (p) => { p.athlete.coachRel = clamp(p.athlete.coachRel + 10); } }),
    ], { once: true, requires: { flagsAll: ["athlete_legacy_active"] }, weight: 6 }),

  ev("dyn_name_crime", "crime", 14, 40, "They Know Your Name",
    "A man you don't know buys your drink and says, 'I knew your family.' He says it softly and with respect, which is much worse than if he'd said it loudly. Two others at the bar look away at exactly the same moment.", [
      opt("Say you're not your parent and leave", "Your hands shook all the way to the corner. The next morning you found a note on the car: 'If you ever change your mind.'",
        { karmaDelta: 3, happinessDelta: -2, setFlags: ["gang_offer_declined"] }),
      opt("Hear him out", "He talked for an hour. It was reasonable, flattering and entirely about money. You walked home with a phone number and a feeling you couldn't name.",
        { karmaDelta: -3, happinessDelta: 1, skillDeltas: { charisma: 2 }, setFlags: ["gang_offer"], apply: (p) => { p.justice.heat = clamp(p.justice.heat + 6); } }),
      opt("Use the name to get what you want, once", "A bully backed off, a landlord went quiet, a debt was forgiven. It worked, and the sensation of it working was the most dangerous part.",
        { karmaDelta: -4, fameDelta: 1, happinessDelta: 3, apply: (p) => { p.justice.heat = clamp(p.justice.heat + 8); } }),
    ], { once: true, requires: { flagsAll: ["gen_heir", "clout_crime"], custom: (p) => clout(p, "crime", 25) } }),

  ev("dyn_name_arts", "fame", 12, 40, "You Have Your Parent's Hands",
    "A conductor, a casting director and a gallery owner each say it in the same week, in the same tone: 'You must be one of the family.' Someone presses a card into your hand with the name of the person who taught your parent.", [
      opt("Take the lessons with the old teacher", "A cold studio, a tiny piano and a woman who had taught three generations of your family and was not impressed by any of them. You improved.",
        { skillDeltas: { music: 5, acting: 3 }, happinessDelta: 2, smartsDelta: 1 }),
      opt("Use the name to get an audition", "The door opened and the panel smiled and then, ninety seconds in, stopped smiling. The name got you in; the rest was up to you.",
        { skillDeltas: { acting: 4 }, fameDelta: 2, happinessDelta: 1 }),
      opt("Turn it down. You'll find your own thing", "You took up carpentry, to the family's collective horror. It was the first thing you'd been good at that nobody had a view about.",
        { happinessDelta: 3, karmaDelta: 1 }),
    ], { once: true, requires: { flagsAll: ["gen_heir", "clout_arts"], custom: (p) => clout(p, "arts", 25) } }),

  ev("dyn_name_academic", "school", 14, 30, "A Family of Scholars",
    "Your name is on a plaque in the library, a bursary and one of the lecture theatres. A tutor who taught your parent asks, with an expression of barely concealed hope, whether you've thought about reading the same subject.", [
      opt("Take the family bursary", "A modest sum and a lot of expectation. You arrived at the library every morning in time to be seen.",
        { smartsDelta: 3, bankBalanceDelta: 4000, happinessDelta: -1 }),
      opt("Read something nobody in the family has", "Palaeography, as it turned out. The family took it as a minor betrayal and a major boast.",
        { smartsDelta: 2, happinessDelta: 3, karmaDelta: 1 }),
      opt("Skip the university and get a job", "You told them you wanted to see how other people lived. The tutor wrote you a very kind and rather sad reference.",
        { happinessDelta: 2, smartsDelta: -1, performanceDelta: 3 }),
    ], { once: true, requires: { flagsAll: ["gen_heir", "clout_academic"], custom: (p) => clout(p, "academic", 25) } }),

  // ---------- the trust ----------
  ev("dyn_trust_trustees", "money", 21, 100, "The Trustees Write",
    "The family trust's annual letter arrives on thick paper. The trustees are 'delighted' with performance and 'minded' to remind you of the terms. At the bottom, in a different pen: 'Do call if you'd like to discuss a distribution.'", [
      risk("Ask for an advance: ten percent of the trust", 0.5,
        ["The trustees conferred, sighed and agreed. A cheque arrived within the week with a letter that used the word 'exceptionally' four times.",
          { karmaDelta: -1, happinessDelta: 3, apply: (p) => { const t = p.dynasty.trust; if (t) { const sum = Math.round(t.balance * 0.1); t.balance -= sum; p.bankBalance += sum; } } }],
        ["The trustees declined. They were extremely courteous about it, which made it feel considerably worse.",
          { happinessDelta: -3 }], "smarts"),
      opt("Leave it alone, and let it grow", "A short letter of thanks, a deep breath and a slight sense of dynastic virtue. The trust, for its part, did not notice.",
        { karmaDelta: 2, happinessDelta: 1 }),
      opt("Meet the trustees in person", "A long lunch, a tour of a vault full of paper and a frank discussion of what the family was for. You came away understanding the money a great deal better.",
        { smartsDelta: 2, skillDeltas: { charisma: 2 }, bankBalanceDelta: -150 }),
    ], { cooldown: 8, weight: 2, requires: { custom: (p) => (p.dynasty?.trust?.balance ?? 0) >= 150_000 } }),

  // ---------- raising an heir ----------
  ev("dyn_groom_path", "family", 14, 100, "The Family Path",
    "The child you've been raising for the family path sits down at the kitchen table, takes a breath and says, 'I need to tell you something.' You have been waiting for this conversation for years and are not sure which version it is.", [
      opt("'I want to do it. Teach me properly.'", "A long hug, a longer evening and a plan for the winter. You had hoped for exactly this and were not prepared for how much it would mean.",
        { relationshipDelta: { target: "Child", delta: 10 }, happinessDelta: 6, karmaDelta: 1, apply: (p) => { const k = groomed(p); if (k?.groom) { k.groom.level = clamp(k.groom.level + 15); k.groom.pressure = 0; } } }),
      opt("'I want something else.' You listen", "It was harder to hear than you'd imagined and easier to forgive. You listened to every word, and by morning you'd stopped planning their future.",
        { relationshipDelta: { target: "Child", delta: 14 }, karmaDelta: 4, happinessDelta: 1, apply: (p) => { const k = groomed(p); if (k) k.groom = undefined; } }),
      opt("'I want something else.' You insist", "Voices were raised. A door was closed, then opened, then closed again. The path is still there; the child is somewhere else on it, or not at all.",
        { relationshipDelta: { target: "Child", delta: -18 }, karmaDelta: -2, happinessDelta: -4, apply: (p) => { const k = groomed(p); if (k?.groom) { k.groom.level = clamp(k.groom.level + 8); k.groom.pressure = clamp(k.groom.pressure + 25); } } }),
    ], { once: true, cooldown: 0, requires: { custom: (p) => !!groomed(p), hasChildren: true } }),

  // ---------- feuds and portraits ----------
  ev("dyn_family_feud", "family", 22, 90, "The Dinner Nobody Wanted",
    "It's a family dinner with an empty chair and a full table. {sibling} has barely looked at you since the funeral. Somebody mentions the house, somebody else mentions the will, and the soup goes cold.", [
      opt("Say the thing nobody has said", "You put your fork down and told the truth about what had hurt. Nobody spoke for a long time. Then {sibling} did.",
        { relationshipDelta: { target: "Sibling", delta: 16 }, happinessDelta: 2, karmaDelta: 2 }),
      opt("Leave before the main course", "You were polite on the way out, and the front door was not. The silence at the table followed you to the car.",
        { relationshipDelta: { target: "Sibling", delta: -8 }, happinessDelta: -3 }),
      opt("Side with {sibling} loudly, for the sake of peace", "You gave up a point you'd been defending for years. It bought an evening of peace and a lingering suspicion that you'd been bought.",
        { relationshipDelta: { target: "Sibling", delta: 10 }, karmaDelta: -1, happinessDelta: 1 }),
    ], { cooldown: 8, weight: 3, requires: { hasSibling: true, custom: (p) => p.relatives.some((r) => r.relation === "Sibling" && r.alive && r.relationshipBar <= 30) } }),

  ev("dyn_portraits", "family", 28, 100, "The Portrait Gallery",
    "You are given the family's old photograph albums to sort. Three generations look out of them in different decades and very similar poses. The names are written on the backs in a hand you know. There is, for the first time, space on the wall for yours.", [
      opt("Write the family's story down", "A winter of notebooks, interviews with elderly relatives and a recurring tendency to cry in the archive. It is a good book, and is mostly true.",
        { smartsDelta: 2, happinessDelta: 4, karmaDelta: 2, setFlags: ["family_historian"] }),
      opt("Take the best one and put it above the stairs", "A hammer, a nail and a long look. Every morning for years afterwards somebody in the house said hello to it.",
        { happinessDelta: 3, relationshipDelta: { target: "All", delta: 3 } }),
      opt("Leave the past where it is", "A closed album and a firm decision to start your own tradition. The attic sighed.",
        { happinessDelta: 1, karmaDelta: 0 }),
    ], { once: true, requires: { custom: (p) => (p.dynasty?.chronicle.length ?? 0) >= 2 } }),
];
