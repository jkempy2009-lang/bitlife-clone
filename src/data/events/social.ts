import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Romance & family
export const SOCIAL_EVENTS: LifeEvent[] = [
  ev("anniversary", "romance", 20, 90, "Anniversary", "It's your anniversary with {partner}.", [
    opt("Plan a surprise dinner ($150)", "The dinner was lovely. {partner} was touched.", { bankBalanceDelta: -150, relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: 5 }),
    opt("Forget it entirely", "You forgot. The silent treatment lasted a week.", { relationshipDelta: { target: "Partner", delta: -15 }, happinessDelta: -4 }),
    opt("Write a heartfelt letter", "You wrote a letter. {partner} kept it forever.", { relationshipDelta: { target: "Partner", delta: 12 }, happinessDelta: 4 }),
  ], { requires: { hasPartner: true }, cooldown: 2 }),
  ev("jealousy", "romance", 16, 80, "Green-Eyed Monster", "{partner} has been texting someone late at night.", [
    opt("Confront them", "You asked directly. It was a work thing. You apologised.", { relationshipDelta: { target: "Partner", delta: -4 }, happinessDelta: -2 }),
    opt("Read their messages", "You snooped. You found nothing, and felt dreadful.", { relationshipDelta: { target: "Partner", delta: -10 }, karmaDelta: -3 }),
    opt("Trust them", "You trusted them. It was a surprise party plan.", { relationshipDelta: { target: "Partner", delta: 8 }, karmaDelta: 2 }),
  ], { requires: { hasPartner: true }, cooldown: 6 }),
  ev("partner_proposes", "romance", 20, 55, "Down on One Knee", "{partner} is on one knee. Everyone in the restaurant is staring.", [
    opt("Say yes!", "You said yes! The restaurant erupted in applause. You're engaged and eventually wed.", { happinessDelta: 14, relationshipDelta: { target: "Partner", delta: 15 }, marry: true }),
    opt("Say not yet", "You asked for more time. {partner} took it gracefully.", { relationshipDelta: { target: "Partner", delta: -8 }, happinessDelta: -3 }),
    opt("Say no and leave", "You said no and walked out. It was a painful scene.", { endRelationship: "breakup", happinessDelta: -8, karmaDelta: -2 }),
  ], { requires: { hasPartner: true, custom: (p) => p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus === "dating" && r.relationshipBar >= 55) }, cooldown: 4, weight: 2 }),
  ev("baby_news", "family", 20, 44, "A Little Surprise", "{partner} announces they're expecting!", [
    opt("Cry happy tears", "You wept with joy. A baby is on the way!", { happinessDelta: 12, addRelative: { relation: "Child" }, relationshipDelta: { target: "Partner", delta: 10 } }),
    opt("Plan your finances", "You made a budget spreadsheet within the hour. A baby is on the way.", { happinessDelta: 8, smartsDelta: 1, addRelative: { relation: "Child" }, relationshipDelta: { target: "Partner", delta: 6 } }),
    opt("Panic, then embrace it", "You panicked for a day, then bought a crib. A baby is on the way.", { happinessDelta: 6, addRelative: { relation: "Child" } }),
  ], { requires: { hasPartner: true, custom: (p) => p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus !== "ex" && r.alive && r.age <= 44) }, cooldown: 3, weight: 0.8 }),
  ev("affair_temptation", "romance", 28, 65, "Temptation", "A very attractive stranger flirts with you at a business dinner.", [
    risk("Give in", 0.55, ["You got away with it. The guilt, however, is bottomless.", { karmaDelta: -10, happinessDelta: -3 }], ["{partner} found out. It was ugly.", { karmaDelta: -10, endRelationship: "divorce", happinessDelta: -12 }]),
    opt("Show your ring and leave", "You walked away, proud.", { karmaDelta: 4, relationshipDelta: { target: "Partner", delta: 4 } }),
  ], { requires: { married: true }, cooldown: 8 }),
  ev("partner_cheats", "romance", 20, 70, "Betrayal", "You discover {partner} has been unfaithful.", [
    opt("Leave them", "You packed your bags and left.", { endRelationship: "breakup", happinessDelta: -12, karmaDelta: 1 }),
    opt("Forgive them", "You forgave them. Trust takes time to rebuild.", { relationshipDelta: { target: "Partner", delta: -12 }, happinessDelta: -8 }),
    opt("Get revenge", "You keyed their car and posted about it. It felt great for a day.", { karmaDelta: -6, endRelationship: "breakup", happinessDelta: 2 }),
  ], { requires: { hasPartner: true }, cooldown: 10, weight: 0.5 }),
  ev("move_in_together", "romance", 20, 40, "Moving In", "{partner} suggests moving in together.", [
    opt("Say yes", "You moved in together. Their socks are now everywhere.", { relationshipDelta: { target: "Partner", delta: 8 }, happinessDelta: 6 }),
    opt("Say it's too soon", "You asked for more time.", { relationshipDelta: { target: "Partner", delta: -4 } }),
  ], { requires: { hasPartner: true }, once: true }),
  ev("meet_the_parents", "romance", 18, 40, "Meet the Parents", "{partner} wants you to meet their family.", [
    opt("Bring wine and charm", "The parents adored you.", { relationshipDelta: { target: "Partner", delta: 8 }, happinessDelta: 4 }),
    opt("Wing it", "You called their mother by the wrong name. Twice.", { relationshipDelta: { target: "Partner", delta: -5 }, happinessDelta: -2 }),
  ], { requires: { hasPartner: true }, once: true }),
  ev("blind_date", "romance", 18, 70, "The Setup", "A friend has set you up on a blind date.", [
    risk("Go", 0.55, ["Sparks flew. You're officially dating.", { happinessDelta: 8, addRelative: { relation: "Partner", ageOffset: [-5, 5], partnerStatus: "dating" } }], ["It was awful, but it makes a good story.", { happinessDelta: -2 }], "looks"),
    opt("Cancel", "You cancelled. Your friend sulked.", { relationshipDelta: { target: "Friend", delta: -3 } }),
  ], { requires: { hasFriend: true, hasPartner: false }, cooldown: 3 }),
  ev("coffee_shop", "romance", 18, 80, "Spilled Coffee", "A stranger spills coffee on your shirt and apologises profusely.", [
    risk("Flirt back", 0.5, ["You chatted for an hour and swapped numbers. A new relationship begins.", { happinessDelta: 8, addRelative: { relation: "Partner", ageOffset: [-6, 6], partnerStatus: "dating" } }], ["You tried a pickup line. It didn't land.", { happinessDelta: -3 }], "looks"),
    opt("Shrug it off", "Accidents happen.", {}),
  ], { requires: { hasPartner: false }, cooldown: 5 }),
  ev("ex_returns", "romance", 22, 60, "Ex Alert", "Your ex texted: 'Hey, been thinking about you.'", [
    opt("Ignore it", "You left them on read. Closure achieved.", { happinessDelta: 2 }),
    opt("Meet up for coffee", "You met up. A reminder of why it ended.", { happinessDelta: -2 }),
    opt("Reply with a long essay", "You wrote a very, very long reply. No response came.", { happinessDelta: -3 }),
  ], { requires: { custom: (p) => p.relatives.some((r) => r.partnerStatus === "ex") }, cooldown: 8, weight: 0.5 }),
  ev("money_fight", "romance", 22, 70, "Money Troubles", "You and {partner} are arguing about finances.", [
    opt("Create a budget together", "You made a budget together. It brought you closer.", { relationshipDelta: { target: "Partner", delta: 8 }, smartsDelta: 1 }),
    opt("Storm out", "You slammed the door. You made up after a few days.", { relationshipDelta: { target: "Partner", delta: -10 }, happinessDelta: -4 }),
    opt("Give them the credit card", "You gave in. $2,000 later, peace.", { bankBalanceDelta: -2000, relationshipDelta: { target: "Partner", delta: 5 } }),
  ], { requires: { hasPartner: true }, cooldown: 5 }),
  ev("sibling_trouble", "family", 14, 60, "Sibling Rivalry", "{sibling} is in a bit of trouble and wants your help.", [
    opt("Help them out", "You helped {sibling}. They owe you one.", { relationshipDelta: { target: "Sibling", delta: 12 }, karmaDelta: 3 }),
    opt("Lecture them", "You gave a long lecture. They rolled their eyes.", { relationshipDelta: { target: "Sibling", delta: -6 } }),
    opt("Lend them $500", "You lent $500. They didn't pay it back (yet).", { bankBalanceDelta: -500, relationshipDelta: { target: "Sibling", delta: 8 } }),
  ], { requires: { hasSibling: true }, cooldown: 4 }),
  ev("family_reunion", "family", 18, 90, "Family Reunion", "The entire family is gathering for the annual reunion.", [
    opt("Attend with a casserole", "You attended and ate seven helpings of everything.", { happinessDelta: 6, relationshipDelta: { target: "All", delta: 6 } }),
    opt("Skip it", "You skipped it. Your Aunt Karen noticed.", { relationshipDelta: { target: "Parent", delta: -4 } }),
    opt("Start a family argument", "You brought up politics. Chaos reigned.", { happinessDelta: -3, relationshipDelta: { target: "All", delta: -8 }, karmaDelta: -2 }),
  ], { requires: { parentAlive: true }, cooldown: 4 }),
  ev("child_milestone", "family", 18, 70, "Proud Parent", "Your child just won an award at school!", [
    opt("Throw a big celebration", "You threw a huge celebration. Your kid beamed.", { relationshipDelta: { target: "Child", delta: 10 }, happinessDelta: 8, bankBalanceDelta: -300 }),
    opt("Post it on social media", "Every one of your followers got an update. Your kid is mortified.", { relationshipDelta: { target: "Child", delta: -2 }, happinessDelta: 3 }),
    opt("Give a quiet hug", "You gave them a hug and a quiet 'I'm proud of you'.", { relationshipDelta: { target: "Child", delta: 8 }, happinessDelta: 4 }),
  ], { requires: { hasChildren: true }, cooldown: 4 }),
  ev("vow_renewal", "romance", 30, 90, "Vows, Again", "{partner} suggests renewing your wedding vows.", [
    opt("Do it on a beach ($3,000)", "You renewed your vows on a beach at sunset.", { bankBalanceDelta: -3000, relationshipDelta: { target: "Partner", delta: 14 }, happinessDelta: 8 }),
    opt("Do it at home", "You renewed your vows in the kitchen. Perfect.", { relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: 5 }),
  ], { requires: { married: true }, cooldown: 10 }),
  ev("friend_wedding", "family", 20, 60, "Wedding Invitation", "A friend invited you to their wedding.", [
    opt("Be the best man / maid of honour", "You gave the speech of a lifetime.", { relationshipDelta: { target: "Friend", delta: 10 }, happinessDelta: 6, bankBalanceDelta: -500 }),
    opt("Attend and dance", "You danced the night away.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 4 }, bankBalanceDelta: -100 }),
    opt("Skip it", "You skipped the wedding. Your friend was hurt.", { relationshipDelta: { target: "Friend", delta: -12 } }),
  ], { requires: { hasFriend: true }, cooldown: 5 }),
];
