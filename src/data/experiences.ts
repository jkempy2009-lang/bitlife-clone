/**
 * Things consenting adults can choose to share. Every experience needs both people to be comfortable:
 * the player opts in through their interests, and the other person's tastes decide whether they agree.
 * All descriptions are suggestive and fade to black.
 */
export interface InterestTag {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  /** How adventurous this is (0 = nearly everyone, 1.3 = few people). Drives how likely people are to enjoy or rule it out. */
  intensity: number;
}

export const INTERESTS: InterestTag[] = [
  { id: "sensual", label: "Slow & Sensual", emoji: "🕯️", blurb: "Massage, candles, taking your time.", intensity: 0.3 },
  { id: "playful", label: "Playful", emoji: "🎭", blurb: "Costumes, dares, games and roleplay.", intensity: 0.7 },
  { id: "toys", label: "Toys & Accessories", emoji: "🎀", blurb: "A little help from the boutique.", intensity: 0.8 },
  { id: "photo", label: "Boudoir & Photos", emoji: "📸", blurb: "Private photo shoots, for your eyes only.", intensity: 0.9 },
  { id: "adventurous", label: "Adventurous Spots", emoji: "🌃", blurb: "Somewhere with a thrill of getting caught.", intensity: 1 },
  { id: "kink", label: "Power Play (light)", emoji: "🪢", blurb: "Blindfolds and ground rules, with a safeword.", intensity: 1.2 },
  { id: "group", label: "More Than Two", emoji: "👥", blurb: "Threesomes and play parties.", intensity: 1.3 },
  { id: "digital", label: "Long-Distance Flirting", emoji: "💬", blurb: "Late-night messages and video calls.", intensity: 0.4 },
];

export const INTEREST_BY_ID: Record<string, InterestTag> = Object.fromEntries(INTERESTS.map((i) => [i.id, i]));

export interface Experience {
  id: string;
  label: string;
  emoji: string;
  /** Interest the player must have opted in to. */
  tag: string;
  blurb: string;
  cost: number;
  /** Times per year with the same person. */
  cap: number;
  /** Minimum relationship bar. */
  minBar: number;
  /** Physical enough to carry pregnancy/infection risk (shows the protection toggle). */
  intimate: boolean;
  /** Risk of something going wrong in public or on camera. */
  risk?: { chance: number; title: string; body: string; money?: number; happiness?: number; fame?: number };
  lines: string[];
  /** Partners only (excludes casual lovers). */
  partnerOnly?: boolean;
}

export const EXPERIENCES: Experience[] = [
  {
    id: "massage", label: "Sensual Evening", emoji: "🕯️", tag: "sensual", cost: 60, cap: 3, minBar: 25, intimate: true,
    blurb: "Oils, candles, a playlist you both like, and no plans for the morning.",
    lines: ["Candles, music and oil. The evening unfolded slowly and neither of you looked at the clock.", "{n} melted under your hands, and the night took its own direction.", "An unhurried evening with {n}, very much behind closed doors."],
  },
  {
    id: "roleplay", label: "Costume & Character Night", emoji: "🎭", tag: "playful", cost: 150, cap: 2, minBar: 30, intimate: true,
    blurb: "Pick characters, pick a script, commit to the bit.",
    lines: ["You both arrived in character. The accents were terrible, the night wasn't.", "Strangers meeting at a hotel bar, in a flat you share. {n} was far too good at it.", "The costumes came off faster than the characters did."],
  },
  {
    id: "dares", label: "Truth, Dare & Forfeits", emoji: "🎲", tag: "playful", cost: 0, cap: 3, minBar: 20, intimate: true,
    blurb: "A deck of cards, a bottle of wine, and a rule that nobody gets to say no to a dare (except everybody can).",
    lines: ["The dares got bolder and the laughing got louder, and then it got quiet.", "{n} lost on purpose, you're fairly sure.", "Truth or dare turned out to be a very efficient way to learn things about {n}."],
  },
  {
    id: "toys", label: "Shop for Toys Together", emoji: "🎀", tag: "toys", cost: 200, cap: 2, minBar: 35, intimate: true, partnerOnly: true,
    blurb: "A trip to the boutique, a bag with no logo on it, and an evening of trying things out.",
    lines: ["The shop assistant was unflappable. You two giggled all the way home.", "{n} picked out something you'd never have dared to. Good call.", "A very well-spent $200, in the end."],
  },
  {
    id: "boudoir", label: "Private Photo Session", emoji: "📸", tag: "photo", cost: 250, cap: 1, minBar: 45, intimate: true, partnerOnly: true,
    blurb: "Tasteful, private, and deleted afterwards (probably). Be careful where those pictures end up.",
    risk: { chance: 0.04, title: "Photos Shared", body: "A phone backup synced somewhere it shouldn't have. A few mortifying hours later it was cleaned up, but you both learned about cloud storage.", happiness: -8, fame: 1 },
    lines: ["It started stiff and ended with {n} laughing so hard the photographer's job got easy.", "{n} looked incredible, and knew it.", "You'll keep these, and nobody else will ever see them."],
  },
  {
    id: "outdoors", label: "Somewhere Risky", emoji: "🌃", tag: "adventurous", cost: 0, cap: 2, minBar: 40, intimate: true,
    blurb: "A rooftop, a quiet beach, a car park with a view. The thrill is half the point.",
    risk: { chance: 0.12, title: "Caught Out", body: "A security guard with a torch ended the evening. An awkward chat, a fine and a story you'll tell for decades.", money: -250, happiness: -3 },
    lines: ["Under the stars, with the added thrill of someone possibly walking by.", "{n} dared you. You didn't back down.", "You'll never look at that beach the same way again."],
  },
  {
    id: "kink", label: "Blindfolds & Ground Rules", emoji: "🪢", tag: "kink", cost: 120, cap: 2, minBar: 55, intimate: true,
    blurb: "A conversation first, a safeword, and then whatever you both agreed to. Trust matters most here.",
    lines: ["You agreed the rules, and the safeword, over breakfast. The evening kept to every one of them.", "{n} handed you control with a smile. You took it seriously, and tenderly.", "A long conversation, a short list of limits, and a night neither of you will forget."],
  },
  {
    id: "workshop", label: "Couples' Intimacy Workshop", emoji: "🧘", tag: "sensual", cost: 300, cap: 1, minBar: 30, intimate: false, partnerOnly: true,
    blurb: "A weekend of exercises, awkward laughter and surprisingly honest talk.",
    lines: ["Eye contact for five minutes was harder than it sounds. By Sunday you were talking about things you'd never said out loud.", "You and {n} left holding hands and feeling like newlyweds."],
  },
  {
    id: "videocall", label: "Late-Night Call", emoji: "💬", tag: "digital", cost: 0, cap: 4, minBar: 15, intimate: false,
    blurb: "Miles apart or just a room away, a slow conversation that gets more flirtatious by the minute.",
    risk: { chance: 0.03, title: "Leaked Message", body: "A screenshot ended up where it shouldn't. Mortifying, but survivable.", happiness: -5 },
    lines: ["Midnight turned into two a.m. You both had work in the morning.", "{n} sent you something that made you forget your own name.", "A very long phone call, with a very short conversation."],
  },
  {
    id: "bath", label: "Candlelit Bath for Two", emoji: "🛁", tag: "sensual", cost: 30, cap: 3, minBar: 35, intimate: true,
    blurb: "Bubbles, a bottle of something cold, and nowhere to be.",
    lines: ["The water went cold long before you noticed.", "Steam, laughter and very little talking.", "{n} fell asleep on your shoulder afterwards, which you counted as a compliment."],
  },
  {
    id: "dance", label: "Dance Lesson, Then Home", emoji: "💃", tag: "sensual", cost: 90, cap: 2, minBar: 25, intimate: true,
    blurb: "Salsa, tango or a slow dance in the kitchen. Guaranteed to end well.",
    lines: ["You stepped on each other's toes and then, somehow, stopped.", "{n} led. You let them. The walk home took forever.", "The instructor said you two had chemistry. They weren't wrong."],
  },
  {
    id: "stripdance", label: "A Private Performance", emoji: "🎶", tag: "playful", cost: 40, cap: 2, minBar: 40, intimate: true,
    blurb: "A playlist, dimmed lights and a lot of nerve. Someone gets a private show.",
    lines: ["The nerves lasted about a minute, and then you were having the time of your life.", "{n} applauded, then stopped applauding for other reasons.", "You'll never hear that song the same way again."],
  },
  {
    id: "lingerie", label: "The Surprise", emoji: "🎁", tag: "playful", cost: 120, cap: 2, minBar: 35, intimate: true, partnerOnly: true,
    blurb: "A box with a ribbon, left on the bed with a note.",
    lines: ["The note said 'open me'. {n} did, and the evening got a lot shorter.", "{n} came home, found the box, and sent you a one-word text: 'Wow.'", "A surprise that was gratefully received."],
  },
  {
    id: "stories", label: "Read Something Steamy Together", emoji: "📖", tag: "digital", cost: 15, cap: 3, minBar: 25, intimate: true,
    blurb: "Take turns reading aloud from a very good (very smutty) novel.",
    lines: ["You got through two chapters. The rest of the book is still on the nightstand.", "{n} did all the voices. It was ridiculous and wonderful.", "Reading aloud turned out to be an excellent warm-up."],
  },
  {
    id: "camping", label: "A Night Under the Stars", emoji: "⛺", tag: "adventurous", cost: 80, cap: 2, minBar: 35, intimate: true,
    blurb: "A tent, a sleeping bag for two, and nobody for miles.",
    risk: { chance: 0.07, title: "Rained Off", body: "A storm flattened the tent at 2 a.m. You both ended up soaked and laughing in the car.", happiness: -1 },
    lines: ["The stars were spectacular. You paid them very little attention.", "{n} said the ground was uncomfortable, then said it was worth it.", "Smoke, stars and a very quiet campsite."],
  },
  {
    id: "hotel", label: "A Night in a Hotel", emoji: "🏨", tag: "sensual", cost: 220, cap: 2, minBar: 30, intimate: true,
    blurb: "Room service, a bigger bed than yours, and a do-not-disturb sign on the door.",
    lines: ["Checkout was at eleven. You made it at five to.", "A night away, with nobody to impress and nowhere to be.", "The do-not-disturb sign earned its keep."],
  },
  {
    id: "retreat", label: "Tantra & Mindfulness Retreat", emoji: "🧘", tag: "sensual", cost: 650, cap: 1, minBar: 45, intimate: false, partnerOnly: true,
    blurb: "A weekend in the hills learning to slow down, breathe together and really listen.",
    lines: ["Three days, no phones, and the most honest conversations of your relationship.", "You came back calmer, and more connected than you have been in years."],
  },
  {
    id: "photoshoot2", label: "Couples' Boudoir Shoot", emoji: "🖼️", tag: "photo", cost: 450, cap: 1, minBar: 55, intimate: true, partnerOnly: true,
    blurb: "A professional, discreet studio, tasteful photos just for the two of you.",
    risk: { chance: 0.03, title: "Photos Shared", body: "A hacked cloud account put them in the wrong hands for a few awful hours. Legal threats worked.", happiness: -8, fame: 1, money: -300 },
    lines: ["The photographer was a professional. You were not, and had a ball.", "{n} looked at the proofs and went quiet. Then went very pink.", "A keepsake for decades."],
  },
  {
    id: "secret_hotel", label: "Secret Meet-up", emoji: "🤫", tag: "adventurous", cost: 180, cap: 3, minBar: 30, intimate: true,
    blurb: "A discreet room, a quiet arrival, and a lot of trust in whoever you're meeting.",
    risk: { chance: 0.05, title: "Recognised", body: "Someone you know saw you walk into the hotel. Word travels.", happiness: -4 },
    lines: ["You arrived separately and left separately. In between, you didn't speak much.", "{n} had booked the room under a ridiculous name.", "A few hours that belonged entirely to the two of you."],
  },
];

export const EXPERIENCE_BY_ID: Record<string, Experience> = Object.fromEntries(EXPERIENCES.map((e) => [e.id, e]));
