import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Fame, royalty and prison scenarios
export const SPECIAL_EVENTS: LifeEvent[] = [
  // ---------- fame ----------
  ev("paparazzi", "fame", 18, 90, "Paparazzi", "Photographers are camped outside your house.", [
    opt("Pose for the cameras", "You struck a pose. The tabloids loved it.", { fameDelta: 4, happinessDelta: 3, looksDelta: 1 }),
    opt("Hide behind sunglasses", "You hid behind sunglasses. The headline: 'Mysterious!'", { happinessDelta: -2, fameDelta: 1 }),
    risk("Chase them off with a hose", 0.5, ["They fled. Your neighbours applauded.", { happinessDelta: 6, fameDelta: 2, karmaDelta: -2 }], ["You hosed the wrong person. They're suing.", { bankBalanceDelta: -8000, fameDelta: -2, karmaDelta: -3 }]),
  ], { requires: { minStat: { fame: 30 } }, cooldown: 3 }),
  ev("autograph_hunters", "fame", 12, 90, "Fans!", "A crowd of fans recognises you in public.", [
    opt("Sign autographs", "You signed autographs for an hour. Your hand is cramping.", { fameDelta: 2, happinessDelta: 6, karmaDelta: 2 }),
    opt("Pretend you're someone else", "You pretended to be your lookalike. They believed you.", { happinessDelta: -1 }),
    opt("Take selfies with everyone", "You took a hundred selfies. Your charm is legendary.", { fameDelta: 3, happinessDelta: 5 }),
  ], { requires: { minStat: { fame: 20 } }, cooldown: 3 }),
  ev("celebrity_scandal", "fame", 16, 90, "Scandal!", "A tabloid is about to publish an embarrassing story about you.", [
    opt("Pay them off ($50,000)", "You paid for the story to vanish.", { bankBalanceDelta: -50000, happinessDelta: -3 }),
    opt("Deny everything", "You denied everything. The public wasn't convinced.", { fameDelta: -6, happinessDelta: -5, karmaDelta: -2 }),
    opt("Own it and apologise", "You apologised sincerely. The public forgave you.", { fameDelta: 2, happinessDelta: -2, karmaDelta: 3 }),
  ], { requires: { minStat: { fame: 25 } }, cooldown: 6 }),
  ev("fan_stalker", "fame", 16, 90, "Obsessed Fan", "A fan has been leaving strange gifts at your door.", [
    opt("Hire a bodyguard ($15,000)", "Your bodyguard scared the stalker off.", { bankBalanceDelta: -15000, happinessDelta: 2 }),
    opt("Call the police", "The police issued a restraining order.", { happinessDelta: -3 }),
    risk("Confront them yourself", 0.5, ["You calmly talked them down. They left you alone.", { karmaDelta: 3, happinessDelta: 3 }], ["It escalated and you were hurt.", { healthDelta: -10, happinessDelta: -8 }], "health"),
  ], { requires: { minStat: { fame: 40 } }, cooldown: 8, weight: 0.6 }),
  ev("talk_show", "fame", 16, 90, "Late Night Invitation", "A late-night host wants you as their guest.", [
    risk("Accept and be hilarious", 0.6, ["You killed it on air. The clip went viral.", { fameDelta: 6, happinessDelta: 8, skillDeltas: { charisma: 2 } }], ["You said something awful on live TV.", { fameDelta: -5, happinessDelta: -8 }], "looks"),
    opt("Decline politely", "You turned them down. Mystery maintained.", {}),
  ], { requires: { minStat: { fame: 35 } }, cooldown: 4 }),
  ev("brand_deal", "fame", 16, 90, "Brand Ambassador", "A big brand wants you as their ambassador.", [
    opt("Sign for $80,000", "You signed a big endorsement deal.", { bankBalanceDelta: 80000, fameDelta: 2, happinessDelta: 6 }),
    opt("Negotiate for $200,000", "You negotiated like a pro and earned a fat contract.", { bankBalanceDelta: 200000, fameDelta: 3, happinessDelta: 8, karmaDelta: -1 }),
    opt("Refuse on principle", "You turned them down. Integrity intact.", { karmaDelta: 4 }),
  ], { requires: { minStat: { fame: 40 } }, cooldown: 5 }),
  ev("award_nomination", "fame", 18, 90, "And the Nominees Are…", "You've been nominated for a major award.", [
    risk("Attend the ceremony", 0.35, ["You won! The audience roared.", { fameDelta: 12, happinessDelta: 14, bankBalanceDelta: 50000 }], ["You lost. You smiled through gritted teeth.", { fameDelta: 1, happinessDelta: -3 }], "looks"),
    opt("Skip the ceremony", "You skipped it. A statement of sorts.", { fameDelta: -2 }),
  ], { requires: { minStat: { fame: 45 }, careers: ["actor"] }, cooldown: 5 }),
  ev("charity_ambassador", "fame", 20, 90, "Charity Ambassador", "A children's charity wants you to be their celebrity face.", [
    opt("Accept", "You became the face of a worthy cause.", { karmaDelta: 12, fameDelta: 2, happinessDelta: 7 }),
    opt("Donate $25,000 quietly", "You donated quietly. The best kind of generosity.", { karmaDelta: 10, bankBalanceDelta: -25000 }),
    opt("Decline", "You declined. Image is everything.", { karmaDelta: -2 }),
  ], { requires: { minStat: { fame: 40 } }, cooldown: 8 }),
  ev("label_scout", "fame", 16, 40, "A&R Calling", "A record label scout saw your gig and left a business card.", [
    opt("Call them back", "The label wants to hear a demo. Your music career picks up.", { fameDelta: 4, skillDeltas: { music: 4 }, happinessDelta: 8 }),
    opt("Play it cool", "You waited a week before calling. They were already onto someone else.", { happinessDelta: -3 }),
  ], { requires: { flagsAll: ["music_dream"], minStat: { fame: 8 } }, once: true }),

  // ---------- royalty ----------
  ev("state_banquet", "royalty", 5, 100, "State Banquet", "A visiting head of state is dining at the palace.", [
    opt("Charm the guests", "You charmed every guest. The press adored you.", { royalRespectDelta: 6, fameDelta: 2, happinessDelta: 4 }),
    opt("Make a diplomatic blunder", "You mixed up two countries. The diplomatic fallout was spectacular.", { royalRespectDelta: -8, happinessDelta: -4 }),
    opt("Slip away early", "You slipped away early. Court officials were not amused.", { royalRespectDelta: -3, happinessDelta: 3 }),
  ], { requires: { royal: true }, cooldown: 3 }),
  ev("royal_scandal", "royalty", 14, 100, "Royal Scandal", "A leaked photo shows you doing something undignified at a party.", [
    opt("Issue a statement", "The palace issued a stiff statement. It blew over.", { royalRespectDelta: -4, happinessDelta: -3 }),
    opt("Own it with humour", "You laughed it off publicly. The people loved it.", { royalRespectDelta: 4, fameDelta: 2 }),
    opt("Pay the photographer", "You paid the photographer to go away.", { bankBalanceDelta: -100000, royalRespectDelta: 0 }),
  ], { requires: { royal: true }, cooldown: 5 }),
  ev("peasant_unrest", "royalty", 18, 100, "Murmurs in the Streets", "Citizens are protesting outside the palace gates.", [
    opt("Meet with the protesters", "You met them in person. Their demands were heard.", { royalRespectDelta: 8, happinessDelta: 2 }),
    risk("Send in the guards", 0.5, ["The guards cleared the square. Order restored.", { royalRespectDelta: -6, karmaDelta: -5 }], ["It turned violent. Headlines call you a tyrant.", { royalRespectDelta: -18, karmaDelta: -8, happinessDelta: -5 }]),
    opt("Wave from the balcony", "You waved from the balcony. It did nothing at all.", { royalRespectDelta: -4 }),
  ], { requires: { royal: true }, cooldown: 5 }),
  ev("assassination_plot", "royalty", 18, 100, "Dagger in the Dark", "Your guards uncover a plot against your life.", [
    opt("Double the guard", "You doubled the guard. The plotters were arrested.", { royalRespectDelta: 4, happinessDelta: -4 }),
    risk("Confront the conspirators personally", 0.55, ["You faced them down and they surrendered. Your legend grows.", { royalRespectDelta: 10, karmaDelta: 2 }], ["A conspirator got a blade into you.", { healthDelta: -30, happinessDelta: -10 }], "health"),
    risk("Ignore the warning", 0.6, ["Nothing happened. Perhaps it was nothing.", {}], ["The plot succeeded.", { die: "a palace assassination" }]),
  ], { requires: { royal: true }, cooldown: 12, weight: 0.4 }),
  ev("arranged_marriage", "royalty", 20, 36, "A Royal Match", "Your court advisers present an eligible partner from a neighbouring kingdom.", [
    opt("Accept the match", "You agreed to the match. The wedding was the event of the decade.", { royalRespectDelta: 10, happinessDelta: -2, addRelative: { relation: "Partner", ageOffset: [-4, 4], partnerStatus: "married" }, bankBalanceDelta: -250000 }),
    opt("Marry for love instead", "You chose love over duty. The tabloids went wild.", { royalRespectDelta: -6, happinessDelta: 8, addRelative: { relation: "Partner", ageOffset: [-4, 4], partnerStatus: "married" } }),
    opt("Refuse both", "You refused. The court sighed and prepared a long speech.", { royalRespectDelta: -4, happinessDelta: 2 }),
  ], { requires: { royal: true, custom: (p) => !p.relatives.some((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex") }, once: true, weight: 2 }),
  ev("royal_hunt", "royalty", 16, 90, "The Royal Hunt", "A grand hunting party has been arranged in your honour.", [
    risk("Join the hunt", 0.9, ["You bagged a magnificent stag. The court applauded.", { royalRespectDelta: 4, happinessDelta: 5 }], ["A hunting accident left you wounded.", { healthDelta: -18, happinessDelta: -4 }]),
    opt("Protest against hunting", "You publicly criticised the sport. A scandal — and a boost with animal lovers.", { karmaDelta: 6, royalRespectDelta: -2 }),
  ], { requires: { royal: true }, cooldown: 6 }),
  ev("foreign_tour", "royalty", 14, 100, "Royal Tour", "You're to represent the crown on an overseas tour.", [
    opt("Be gracious", "You were gracious everywhere you went. The tour was a triumph.", { royalRespectDelta: 8, fameDelta: 2, happinessDelta: 4 }),
    opt("Sightsee and shop", "You took in the sights and ignored most of the engagements.", { royalRespectDelta: -4, happinessDelta: 7, bankBalanceDelta: -30000 }),
    opt("Insult the host nation by accident", "You mispronounced the host nation's name in a toast. International incident.", { royalRespectDelta: -12, happinessDelta: -5 }),
  ], { requires: { royal: true }, cooldown: 4 }),
  ev("palace_staff_scandal", "royalty", 14, 100, "Below Stairs", "A staff member sold a story about your private life to the press.", [
    opt("Fire them", "You dismissed the employee immediately.", { royalRespectDelta: -2, karmaDelta: -2 }),
    opt("Forgive them", "You forgave them quietly. Staff loyalty rose.", { royalRespectDelta: 3, karmaDelta: 3 }),
    opt("Sue them", "You sued. It dragged on and dominated headlines.", { royalRespectDelta: -4, bankBalanceDelta: -20000 }),
  ], { requires: { royal: true }, cooldown: 8 }),

  // ---------- prison ----------
  ev("prison_shiv", "prison", 14, 100, "Yard Trouble", "A fellow inmate eyes you and slides a makeshift blade into view.", [
    risk("Fight", 0.4, ["You won the fight, earning a measure of respect.", { karmaDelta: -3, happinessDelta: 2, healthDelta: -4 }], ["You were stabbed and spent weeks in the infirmary.", { healthDelta: -18, happinessDelta: -8 }], "health"),
    opt("Alert a guard", "A guard intervened. Others call you a snitch.", { karmaDelta: 2, happinessDelta: -4 }),
    opt("Back away slowly", "You backed away and survived. Pride dented.", { happinessDelta: -3 }),
  ], { prisonOnly: true, cooldown: 3 }),
  ev("prison_library", "prison", 14, 100, "Quiet Hours", "The prison library has an actual quiet corner.", [
    opt("Study for a GED", "You studied hard in the cell and earned some credits.", { smartsDelta: 4, happinessDelta: 2 }),
    opt("Read novels", "You devoured twenty novels. Time passes more gently.", { smartsDelta: 2, happinessDelta: 4 }),
    opt("Lift weights instead", "You pumped iron all year. Strong and menacing.", { healthDelta: 5, looksDelta: 1 }),
  ], { prisonOnly: true, cooldown: 3 }),
  ev("prison_gang", "prison", 14, 100, "Recruitment Drive", "A gang leader offers you protection — in exchange for loyalty.", [
    opt("Join the gang", "You joined. The protection came with strings attached.", { karmaDelta: -8, healthDelta: 2, happinessDelta: 3 }),
    opt("Refuse politely", "You refused. They watched you for the rest of the year.", { happinessDelta: -3, karmaDelta: 2 }),
    opt("Befriend the chaplain", "You found refuge in the prison chapel.", { karmaDelta: 6, happinessDelta: 5 }),
  ], { prisonOnly: true, cooldown: 4 }),
  ev("prison_visit", "prison", 14, 100, "Visiting Day", "Someone comes to visit you.", [
    opt("Talk for hours", "You talked for hours. It lifted your spirits.", { happinessDelta: 8, relationshipDelta: { target: "All", delta: 6 } }),
    opt("Refuse the visit", "You refused to see anyone. Shame is heavy.", { happinessDelta: -5, relationshipDelta: { target: "All", delta: -6 } }),
  ], { prisonOnly: true, cooldown: 3 }),
  ev("prison_contraband", "prison", 14, 100, "Black Market", "A trader offers you contraband cigarettes in exchange for a favour.", [
    risk("Accept the deal", 0.55, ["The deal went smoothly. You're now a minor businessman.", { happinessDelta: 4, karmaDelta: -3 }], ["A guard caught you. Solitary confinement.", { happinessDelta: -10, healthDelta: -4 }]),
    opt("Decline", "You steered clear.", { karmaDelta: 2 }),
  ], { prisonOnly: true, cooldown: 3 }),
  ev("prison_parole_letter", "prison", 14, 100, "The Parole Board", "A letter arrives: your behaviour is being reviewed.", [
    opt("Be on your best behaviour", "You kept your head down all year. The board took notice.", { karmaDelta: 4, happinessDelta: 2 }),
    opt("Write an apology letter", "You wrote a sincere apology. The warden read it aloud.", { karmaDelta: 5, happinessDelta: 1 }),
    opt("Ignore it", "You ignored it.", {}),
  ], { prisonOnly: true, cooldown: 3 }),
];
