import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { getPartner } from "@/engine/state";

const single = (p: PlayerState) => !getPartner(p);
const hasLover = (p: PlayerState) => p.relatives.some((r) => r.relation === "Lover" && r.alive && r.partnerStatus === "fling");
const bigGap = (p: PlayerState) => {
  const partner = getPartner(p);
  return !!partner && Math.abs(partner.age - p.age) >= 15;
};
const poly = (p: PlayerState) => p.flags.includes("polyamorous");
const hasEx = (p: PlayerState) => p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "ex" && r.alive);

// Adult life between consenting adults: communication, choices, and consequences. Suggestive only.
export const ADULT2_EVENTS: LifeEvent[] = [
  ev("swipe_fatigue", "romance", 20, 55, "Swipe Fatigue", "You've been on the apps for months. Everyone has the same photo with a fish.", [
    opt("Take a break from dating", "You deleted the apps and rediscovered your hobbies.", { happinessDelta: 3, smartsDelta: 1 }),
    risk("One more coffee date", 0.45, ["The coffee turned into dinner, and dinner into a second date. Promising.", { happinessDelta: 7, addRelative: { relation: "Partner", ageOffset: [-6, 8], partnerStatus: "dating" } }], ["They talked about their ex for an hour. You paid for both coffees.", { happinessDelta: -3, bankBalanceDelta: -30 }]),
    opt("Change your photo and your bio", "A more honest profile attracted more honest people. Slowly.", { looksDelta: 1, happinessDelta: 2 }),
  ], { requires: { custom: single }, mature: true, cooldown: 4 }),

  ev("benefits_feelings", "romance", 20, 60, "Catching Feelings", "What started as casual has become the best part of your week. You're not sure what to call it.", [
    risk("Tell them how you feel", 0.5, ["They'd been wondering the same thing. The 'casual' label is retired.", { happinessDelta: 9 }], ["They said they valued what you had but wanted it to stay casual. It stung.", { happinessDelta: -8 }]),
    opt("Keep things as they are", "You said nothing and kept enjoying it. For now.", { happinessDelta: 1 }),
    opt("End it before it gets complicated", "A clean break, kindly done. You both said you'd stay friends.", { happinessDelta: -3, karmaDelta: 1 }),
  ], { requires: { custom: hasLover }, mature: true, cooldown: 4 }),

  ev("age_gap_remarks", "romance", 21, 80, "Raised Eyebrows", "Your family has noticed the age difference between you and {partner}, and has opinions about it.", [
    opt("Introduce them properly and let people judge", "Over a long dinner, {partner} won them over, mostly.", { relationshipDelta: { target: "Partner", delta: 6 }, happinessDelta: 3 }),
    opt("Tell your family it's none of their business", "You drew a line. It cost you a few awkward holidays.", { relationshipDelta: { target: "Parent", delta: -6 }, happinessDelta: 1 }),
    opt("Keep them apart for now", "You avoided the conversation. {partner} noticed, and wasn't thrilled.", { relationshipDelta: { target: "Partner", delta: -8 }, happinessDelta: -3 }),
  ], { requires: { custom: bigGap }, mature: true, cooldown: 12, once: true }),

  ev("sexual_health_check", "health", 18, 65, "Get Tested", "A friend mentions their routine sexual-health screening. When did you last have one?", [
    opt("Book a screening ($80)", "Quick, confidential and reassuring. You feel responsible.", { bankBalanceDelta: -80, happinessDelta: 3, karmaDelta: 2 }),
    opt("Go together with your partner", "Awkward in the waiting room, closer afterwards.", { bankBalanceDelta: -160, relationshipDelta: { target: "Partner", delta: 5 }, happinessDelta: 3 }),
    opt("Put it off", "You told yourself you'd do it next month.", {}),
  ], { requires: { custom: (p) => p.stats.hookups > 0 || !!getPartner(p) }, mature: true, cooldown: 4, weight: 0.8 }),

  ev("partner_suggestion", "romance", 22, 75, "A Shy Suggestion", "{partner} hesitantly brings up something they've been curious about, and asks what you think.", [
    risk("Say yes, with ground rules", 0.8, ["You talked it through, set your boundaries, and tried it. You laughed a lot. You're closer for it.", { relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: 6 }], ["It turned out neither of you enjoyed it. You laughed it off and ordered pizza.", { relationshipDelta: { target: "Partner", delta: 2 }, happinessDelta: 1 }]),
    opt("Say no, kindly", "You said it wasn't for you. {partner} thanked you for being honest.", { relationshipDelta: { target: "Partner", delta: 3 }, happinessDelta: 1 }),
    opt("Suggest something you'd both enjoy instead", "A compromise, and a very good evening.", { relationshipDelta: { target: "Partner", delta: 7 }, happinessDelta: 4 }),
  ], { requires: { hasPartner: true }, mature: true, cooldown: 6 }),

  ev("poly_calendar", "romance", 22, 70, "The Shared Calendar", "Between work, {partner} and your other relationship, your weekends have become a logistics problem.", [
    opt("Schedule a proper check-in with everyone", "A hard, honest conversation, and a better rota. Everyone felt heard.", { relationshipDelta: { target: "All", delta: 4 }, happinessDelta: 4 }),
    opt("Ease back on one relationship", "Quality over quantity. One person was hurt, and understood.", { relationshipDelta: { target: "Lover", delta: -10 }, happinessDelta: 1 }),
    opt("Carry on and hope it works out", "It didn't, entirely. A double-booked anniversary will be remembered.", { relationshipDelta: { target: "Partner", delta: -9 }, happinessDelta: -4 }),
  ], { requires: { custom: poly }, mature: true, cooldown: 4 }),

  ev("ex_texts", "romance", 22, 70, "Message From an Ex", "An old flame writes: 'I was clearing out my phone and found your name. Hope you're well.'", [
    opt("Reply warmly and leave it there", "A kind exchange. Closure, of a sort.", { happinessDelta: 2, karmaDelta: 1 }),
    risk("Suggest meeting for a drink", 0.5, ["It was lovely. You left with a hug and no regrets.", { happinessDelta: 5 }], ["It was awkward. You remembered why it ended.", { happinessDelta: -3 }]),
    opt("Don't reply", "You deleted it. Some doors stay shut.", {}),
  ], { requires: { custom: hasEx }, mature: true, cooldown: 6 }),

  ev("couples_retreat", "romance", 25, 75, "A Weekend Away", "A spa resort has a couples' package: massages, workshops and a very large bed.", [
    opt("Book it ($1,400)", "Phones off, honesty on. You came home like newlyweds.", { bankBalanceDelta: -1400, relationshipDelta: { target: "Partner", delta: 14 }, happinessDelta: 8 }),
    opt("A cheaper weekend at home", "You turned the flat into a hotel for two days. It worked.", { bankBalanceDelta: -150, relationshipDelta: { target: "Partner", delta: 7 }, happinessDelta: 4 }),
    opt("Skip it", "Work got in the way again.", { relationshipDelta: { target: "Partner", delta: -4 } }),
  ], { requires: { hasPartner: true, minBank: 2500 }, mature: true, cooldown: 5, weight: 0.8 }),
];
