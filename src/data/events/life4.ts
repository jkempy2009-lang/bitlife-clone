import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";

const hasPet = (p: PlayerState) => p.relatives.some((r) => r.relation === "Pet" && r.alive);

// Pets, parties, workplace, money and community: texture for the long middle of life.
export const LIFE4_EVENTS: LifeEvent[] = [
  // ---------- pets ----------
  ev("pet_vet_scare", "money", 8, 90, "The Vet's Verdict", "Your pet is limping and refusing to eat.", [
    opt("Pay for tests and treatment ($1,200)", "A tricky diagnosis, but they're going to be fine.", { bankBalanceDelta: -1200, happinessDelta: 4 }),
    opt("Wait and see", "It passed. You got lucky.", { happinessDelta: -2 }),
  ], { requires: { custom: hasPet }, cooldown: 5 }),
  ev("pet_runaway", "general", 8, 90, "Missing!", "Your pet slipped out the door and hasn't come back.", [
    opt("Search the neighbourhood", "You found them three streets away, delighted with themselves.", { happinessDelta: 5, relationshipDelta: { target: "Friend", delta: 3 } }),
    opt("Post flyers and a reward ($200)", "A kind stranger brought them back.", { bankBalanceDelta: -200, happinessDelta: 4 }),
  ], { requires: { custom: hasPet }, cooldown: 6, weight: 0.8 }),
  ev("pet_trick", "general", 8, 90, "Clever Pet", "Your pet has learned a trick all by themselves.", [
    opt("Film it", "It went mildly viral. Your pet has more followers than you.", { fameDelta: 2, happinessDelta: 5 }),
    opt("Teach them more", "A month of treats and patience turned them into a performer.", { happinessDelta: 6, smartsDelta: 1 }),
  ], { requires: { custom: hasPet }, cooldown: 6 }),
  ev("dog_park_meetcute", "romance", 18, 60, "Dog Park", "Your dog has made friends with a stranger's dog (and they're very attractive).", [
    risk("Chat with the owner", 0.55, ["Dog-walking dates became a thing.", { happinessDelta: 7, addRelative: { relation: "Partner", ageOffset: [-5, 6], partnerStatus: "dating" } }], ["They mostly wanted to talk about training tips.", { happinessDelta: 1 }], "looks"),
    opt("Focus on the dogs", "The dogs were thrilled.", { happinessDelta: 3 }),
  ], { requires: { hasPartner: false, flagsAll: ["has_dog"] }, once: true, weight: 1.2 }),
  ev("pet_chaos", "general", 8, 90, "Chaos at Home", "You come home to find the sofa has been completely redecorated by your pet.", [
    opt("Laugh and clean up", "A new sofa and a new story.", { bankBalanceDelta: -300, happinessDelta: 3 }),
    opt("Get furious", "You calmed down after a walk. Everyone sulked.", { happinessDelta: -3 }),
  ], { requires: { custom: hasPet }, cooldown: 5 }),

  // ---------- pregnancy & parenting ----------
  ev("cravings", "family", 18, 45, "Cravings", "Pickles and ice cream, at 2am. Again.", [
    opt("Do the midnight run", "A 24-hour shop run and a happy mum/dad-to-be.", { happinessDelta: 3, relationshipDelta: { target: "Partner", delta: 5 } }),
    opt("Stock the pantry", "A fully stocked kitchen. Smart.", { relationshipDelta: { target: "Partner", delta: 3 } }),
  ], { requires: { custom: (p) => !!p.pregnancy }, once: true }),
  ev("baby_shower", "family", 18, 50, "Baby Shower", "Friends and family have organised a baby shower.", [
    opt("Enjoy the party", "A mountain of tiny socks and a lot of love.", { happinessDelta: 7, relationshipDelta: { target: "All", delta: 4 } }),
    opt("Escape the games", "You tolerated one round of 'guess the baby food' and left.", { happinessDelta: 1 }),
  ], { requires: { custom: (p) => !!p.pregnancy }, once: true }),
  ev("toddler_phase", "family", 20, 60, "Terrible Twos", "Your toddler has discovered the word 'no'.", [
    opt("Stay calm and consistent", "Patience paid off, eventually.", { relationshipDelta: { target: "Child", delta: 6 }, smartsDelta: 1 }),
    opt("Give in and buy ice cream", "Peace achieved. Precedent set.", { relationshipDelta: { target: "Child", delta: 3 }, happinessDelta: 2 }),
    opt("Lose your temper", "You shouted. Everyone cried, including you.", { relationshipDelta: { target: "Child", delta: -6 }, happinessDelta: -4 }),
  ], { requires: { custom: (p) => p.relatives.some((r) => r.relation === "Child" && r.alive && r.age >= 2 && r.age <= 4) }, cooldown: 4 }),
  ev("teen_talk", "family", 30, 60, "The Talk", "Your teenager would rather do anything than have the conversation you need to have.", [
    opt("Be honest and age-appropriate", "It was awkward and important. They thanked you, months later.", { relationshipDelta: { target: "Child", delta: 8 }, smartsDelta: 1 }),
    opt("Hand over a book", "A very awkward silence and a very useful book.", { relationshipDelta: { target: "Child", delta: 2 } }),
  ], { requires: { custom: (p) => p.relatives.some((r) => r.relation === "Child" && r.alive && r.age >= 13 && r.age <= 16) }, once: true }),

  // ---------- parties & social ----------
  ev("party_convention", "career", 25, 80, "Party Conference", "Your party holds its annual conference and wants you to speak.", [
    risk("Give the keynote", 0.55, ["The hall rose to its feet. Donations flooded in.", { fameDelta: 5, happinessDelta: 8, skillDeltas: { charisma: 3 } }], ["You fumbled a joke and it dominated the headlines.", { fameDelta: -3, happinessDelta: -5 }], "looks"),
    opt("Work the room instead", "You made useful connections.", { fameDelta: 1, skillDeltas: { charisma: 1 } }),
  ], { requires: { jobLine: ["politics"] }, cooldown: 4 }),
  ev("neighbourhood_party", "general", 20, 80, "Block Party", "The street is closing off for a summer block party.", [
    opt("Run the grill", "Burgers for 60. You're the street's hero.", { happinessDelta: 6, addRelative: { relation: "Friend", ageOffset: [-10, 10] } }),
    opt("Bring a six-pack and mingle", "A nice evening and a few new acquaintances.", { happinessDelta: 4 }),
    opt("Stay indoors", "You heard the music from your living room.", {}),
  ], { requires: { hasProperty: true }, cooldown: 6 }),
  ev("wedding_guest_chaos", "general", 20, 70, "Wedding Guest", "A cousin's wedding turns into a family drama.", [
    opt("Be the peacemaker", "You calmed everyone down, and got complimented by the bride.", { relationshipDelta: { target: "All", delta: 6 }, karmaDelta: 3 }),
    opt("Grab popcorn", "A very entertaining evening.", { happinessDelta: 4 }),
    opt("Join the fight", "A cake ended up on the floor. You were on the winning side.", { happinessDelta: 2, relationshipDelta: { target: "All", delta: -4 } }),
  ], { requires: { parentAlive: true }, cooldown: 8 }),

  // ---------- workplace ----------
  ev("layoff_survivor", "career", 25, 64, "Survivor's Guilt", "Half your team was laid off. You weren't.", [
    opt("Help your colleagues find jobs", "You wrote references and made calls. It meant a lot.", { karmaDelta: 6, happinessDelta: 2, relationshipDelta: { target: "Friend", delta: 4 } }),
    opt("Quietly take their projects", "More work, more credit.", { performanceDelta: 6, karmaDelta: -2 }),
  ], { requires: { hasJob: true }, cooldown: 8 }),
  ev("toxic_boss", "career", 22, 64, "Toxic Boss", "Your manager belittles people in meetings.", [
    opt("Report to HR", "HR investigated. Things improved. Slightly.", { karmaDelta: 3, performanceDelta: -2 }),
    opt("Look for another job", "You updated your CV and got three calls.", { happinessDelta: 2 }),
    opt("Grin and bear it", "You suffered in silence.", { happinessDelta: -5, performanceDelta: 3 }),
  ], { requires: { hasJob: true }, cooldown: 8 }),
  ev("promotion_snub", "career", 25, 64, "Passed Over", "A less experienced colleague got the promotion you wanted.", [
    opt("Ask for feedback", "A candid conversation. You know what to work on.", { performanceDelta: 5, smartsDelta: 1 }),
    opt("Sulk", "You sulked for months.", { happinessDelta: -5, performanceDelta: -4 }),
    opt("Start applying elsewhere", "A few interviews later, you had options.", { happinessDelta: 2 }),
  ], { requires: { hasJob: true }, cooldown: 8 }),
  ev("work_friend", "career", 20, 64, "Work Bestie", "You've found someone at work who just gets you.", [
    opt("Lunch together every day", "Your lunch hour became the best part of your day.", { addRelative: { relation: "Friend", ageOffset: [-6, 8] }, happinessDelta: 5 }),
    opt("Keep work separate", "You kept work and life separate.", {}),
  ], { requires: { hasJob: true, hasFriend: false }, cooldown: 8 }),
  ev("side_gig_success", "money", 20, 60, "Side Hustle Takes Off", "Your weekend project is attracting real customers.", [
    opt("Go full-time ($0)", "You took the leap. It's terrifying and thrilling.", { loseJob: true, bankBalanceDelta: 5000, happinessDelta: 8 }),
    opt("Keep it a side thing", "Extra income without the risk.", { bankBalanceDelta: 4000, happinessDelta: 3 }),
  ], { requires: { hasJob: true, minStat: { smarts: 55 } }, once: true, weight: 0.6 }),

  // ---------- money & life admin ----------
  ev("insurance_claim", "money", 20, 80, "Insurance Claim", "A burst pipe flooded the kitchen.", [
    opt("File a claim", "Claim approved. Premiums will rise.", { bankBalanceDelta: 2500, happinessDelta: -2 }),
    opt("Fix it yourself", "You mopped for days.", { bankBalanceDelta: -900, healthDelta: -1 }),
  ], { requires: { hasProperty: true }, cooldown: 8 }),
  ev("scammed_online", "money", 18, 85, "Too Good to Be True", "An online shop's prices were amazing. The package never came.", [
    opt("Dispute the charge", "The bank refunded you, after a month of calls.", { happinessDelta: -2 }),
    opt("Write it off ($300)", "Lesson learned the hard way.", { bankBalanceDelta: -300, smartsDelta: 1 }),
  ], { requires: { minBank: 400 }, cooldown: 6 }),
  ev("tax_refund", "money", 20, 80, "Tax Refund", "The tax office owes you money for once.", [
    opt("Treat yourself ($1,500)", "A new gadget and a good dinner.", { bankBalanceDelta: 500, happinessDelta: 5 }),
    opt("Pay down debt", "Responsible. Boring. Smart.", { bankBalanceDelta: 1500, smartsDelta: 1 }),
  ], { requires: { hasJob: true }, cooldown: 4 }),
  ev("old_debt_collector", "money", 20, 70, "Debt Collector", "A collector is hounding you about a forgotten debt.", [
    opt("Pay it off ($2,200)", "Gone. You can finally sleep.", { bankBalanceDelta: -2200, happinessDelta: 3 }),
    opt("Negotiate", "You haggled it down to a fraction.", { bankBalanceDelta: -900, smartsDelta: 1 }),
    opt("Ignore the calls", "They stopped calling. Then the letters started.", { happinessDelta: -4 }),
  ], { requires: { custom: (p) => p.outstandingLoans > 20000 }, cooldown: 6 }),

  // ---------- health & lifestyle ----------
  ev("flu_shot", "health", 18, 90, "Flu Season", "Everyone at work is sniffling.", [
    opt("Get vaccinated ($30)", "A sore arm. Healthy winter.", { bankBalanceDelta: -30, healthDelta: 2 }),
    risk("Take your chances", 0.7, ["You stayed healthy. Lucky you.", {}], ["You were flat on your back for two weeks.", { healthDelta: -6, diseaseTrigger: "flu", happinessDelta: -3 }], "health"),
  ], { cooldown: 3 }),
  ev("physio_gym_class", "health", 25, 70, "Spin Class", "A friend drags you to a spin class at 6am.", [
    opt("Embrace it", "You came out sweaty, smug, and addicted.", { healthDelta: 4, looksDelta: 1, happinessDelta: 3, skillDeltas: { athletics: 2 } }),
    opt("Quit halfway", "You left mid-sprint. You still ached for a week.", { happinessDelta: -1 }),
  ], { cooldown: 5 }),
  ev("cooking_disaster", "general", 14, 90, "Kitchen Fire", "You tried to flambé something. The smoke alarm has opinions.", [
    opt("Put it out with a lid", "Calm, collected, slightly singed.", { smartsDelta: 1, happinessDelta: -1 }),
    opt("Panic and call the fire brigade", "They were very nice about it. You were very red.", { happinessDelta: -3, bankBalanceDelta: -100 }),
  ], { cooldown: 8, weight: 0.6 }),
  ev("moving_in_together_kid", "family", 18, 30, "Grown Up", "You've found your first proper flat.", [
    opt("Throw a housewarming party ($200)", "Your first party as a host. It went well.", { bankBalanceDelta: -200, happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Quiet night with takeaway", "The first night in your own place. Perfect.", { happinessDelta: 5 }),
  ], { once: true, requires: { hasProperty: false, custom: (p) => p.age >= 18 && p.age <= 30 }, weight: 1.2 }),
];
