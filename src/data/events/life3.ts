import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Faith, family change, special careers and more adult-life texture.
export const LIFE3_EVENTS: LifeEvent[] = [
  // ---------- family change ----------
  ev("new_baby_sibling", "family", 2, 14, "A New Arrival", "Your parents sit you down. 'You're going to be a big brother/sister!'", [
    opt("Be thrilled", "You helped pick the name. The baby is adorable.", { addRelative: { relation: "Sibling", age: 0 }, happinessDelta: 6, relationshipDelta: { target: "Parent", delta: 4 } }),
    opt("Sulk about it", "You sulked in your room. The baby arrived anyway.", { addRelative: { relation: "Sibling", age: 0 }, happinessDelta: -3 }),
    opt("Demand to know why", "You asked 47 questions. {mother} blushed at question 12.", { addRelative: { relation: "Sibling", age: 0 }, smartsDelta: 1 }),
  ], { requires: { parentAlive: true, flagsNone: ["new_sibling_done"] }, once: true, weight: 0.8 }),
  ev("parents_divorce", "family", 5, 17, "Splitting Up", "Your parents sit you down and say they're getting a divorce.", [
    opt("Comfort them", "You told them you'd be okay. You weren't sure you believed it.", { relationshipDelta: { target: "Parent", delta: 6 }, happinessDelta: -8, karmaDelta: 2 }),
    opt("Act out", "You acted out for a year. Everyone was patient. Mostly.", { happinessDelta: -10, relationshipDelta: { target: "Parent", delta: -6 } }),
    opt("Retreat into your own world", "You buried yourself in books, games, and music.", { happinessDelta: -6, smartsDelta: 2 }),
  ], { requires: { parentAlive: true, custom: (p) => p.relatives.filter((r) => r.relation === "Parent" && r.alive).length === 2 }, once: true, weight: 0.5 }),
  ev("family_move", "family", 5, 16, "Moving House", "Your family is moving to a new city.", [
    opt("Embrace the adventure", "New school, new friends, new you.", { happinessDelta: 2, skillDeltas: { charisma: 3 }, addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
    opt("Refuse to pack", "You were carried out with a sofa cushion in each hand.", { happinessDelta: -4, relationshipDelta: { target: "Parent", delta: -4 } }),
    opt("Keep in touch with old friends", "You wrote letters every week.", { relationshipDelta: { target: "Friend", delta: 6 }, happinessDelta: -1 }),
  ], { requires: { parentAlive: true }, once: true, weight: 0.8 }),
  ev("parent_new_partner", "family", 6, 25, "Someone New", "{mother} introduces you to someone she's been seeing.", [
    opt("Give them a chance", "They made {mother} happy. You warmed up.", { happinessDelta: 3, relationshipDelta: { target: "Parent", delta: 5 } }),
    opt("Refuse to speak to them", "A very awkward dinner.", { relationshipDelta: { target: "Parent", delta: -8 }, happinessDelta: -2 }),
    opt("Interrogate them", "You grilled them like a detective. They passed.", { smartsDelta: 1, relationshipDelta: { target: "Parent", delta: 2 } }),
  ], { requires: { parentAlive: true }, once: true, weight: 0.5 }),
  ev("teen_pregnancy_scare", "romance", 15, 19, "Scare", "A moment of panic: a missed period... and a very long wait for results.", [
    opt("Tell your parents", "They were calm and supportive. It was a false alarm.", { relationshipDelta: { target: "Parent", delta: 8 }, happinessDelta: -2 }),
    opt("Tell no one and wait", "False alarm. Your hands shook for a week.", { happinessDelta: -4 }),
  ], { requires: { hasPartner: true }, once: true, weight: 0.3 }),
  ev("empty_house_party", "family", 14, 18, "Home Alone", "Your parents are away for the weekend.", [
    opt("Throw a huge party", "The house was a disaster. The neighbours called {mother}.", { happinessDelta: 5, relationshipDelta: { target: "Parent", delta: -12 }, fameDelta: 1 }),
    opt("Invite two friends and play games", "A perfect low-key weekend.", { happinessDelta: 5, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Study", "Impressive. Concerning.", { smartsDelta: 3 }),
  ], { requires: { parentAlive: true }, cooldown: 4 }),

  // ---------- faith ----------
  ev("faith_search", "general", 14, 80, "Searching for Meaning", "A friend invites you to a spiritual gathering.", [
    opt("Go along", "You found warmth, community, and a lot of casseroles.", { setFlags: ["faithful"], happinessDelta: 5, karmaDelta: 4, addRelative: { relation: "Friend", ageOffset: [-8, 8] } }),
    opt("Try meditation instead", "Quiet mornings changed your outlook.", { happinessDelta: 5, healthDelta: 1 }),
    opt("Stay sceptical", "You raised a few uncomfortable questions.", { smartsDelta: 1 }),
  ], { requires: { flagsNone: ["faithful"] }, cooldown: 10, weight: 0.8 }),
  ev("faith_community", "general", 16, 100, "Community Potluck", "Your faith community is holding a potluck.", [
    opt("Cook something ambitious", "Your dish vanished in minutes.", { hobbyDelta: { cooking: 5 }, happinessDelta: 5, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Bring chips", "Chips are chips.", { happinessDelta: 2 }),
  ], { requires: { flagsAll: ["faithful"] }, cooldown: 3 }),
  ev("faith_doubt", "general", 18, 100, "Crisis of Faith", "A tragedy shakes your beliefs.", [
    opt("Lean on your community", "They held you up.", { happinessDelta: 3, karmaDelta: 2 }),
    opt("Walk away from it", "You left. It was lonely at first.", { happinessDelta: -3, clearFlags: ["faithful"] }),
    opt("Study other traditions", "Years of reading deepened your outlook.", { smartsDelta: 3, happinessDelta: 2 }),
  ], { requires: { flagsAll: ["faithful"] }, cooldown: 12, weight: 0.5 }),
  ev("pilgrimage", "general", 22, 90, "Pilgrimage", "You feel called to travel to a holy site.", [
    opt("Make the journey ($3,000)", "Mile after mile. You returned changed.", { bankBalanceDelta: -3000, happinessDelta: 10, karmaDelta: 6 }),
    opt("Pray at home", "A quieter but sincere devotion.", { happinessDelta: 3, karmaDelta: 2 }),
  ], { requires: { flagsAll: ["faithful"], minBank: 3000 }, once: true }),
  ev("charity_drive_faith", "general", 18, 100, "Feeding the Hungry", "Your community runs a soup kitchen every Sunday.", [
    opt("Volunteer every week", "You served 400 meals. And made a few friends.", { karmaDelta: 8, happinessDelta: 6, addRelative: { relation: "Friend", ageOffset: [-10, 10] } }),
    opt("Donate money ($500)", "A generous donation.", { bankBalanceDelta: -500, karmaDelta: 4 }),
  ], { requires: { flagsAll: ["faithful"] }, cooldown: 4 }),

  // ---------- agency / astronaut ----------
  ev("agency_dead_drop", "career", 21, 60, "Dead Drop", "A message in a hollowed-out book sends you to a train station locker.", [
    risk("Collect the package", 0.7, ["Clean grab. Nobody saw. Your handler was pleased.", { performanceDelta: 8, happinessDelta: 3 }], ["It was a trap. You barely escaped.", { healthDelta: -12, performanceDelta: -6 }], "smarts"),
    opt("Abort the pickup", "You walked away. Your handler wasn't happy.", { performanceDelta: -5 }),
  ], { requires: { jobLine: ["spy"] }, cooldown: 3 }),
  ev("agency_mole", "career", 25, 65, "There's a Mole", "Someone inside the Agency is leaking secrets. Your handler eyes you suspiciously.", [
    opt("Investigate quietly", "You uncovered the mole in accounts. Nobody saw that coming.", { performanceDelta: 15, karmaDelta: 4, fameDelta: 1 }),
    opt("Do nothing", "You kept your head down. The leak continued.", { performanceDelta: -4 }),
  ], { requires: { jobLine: ["spy"] }, once: true }),
  ev("launch_day", "career", 26, 62, "Launch Day", "The countdown begins. 10... 9... 8...", [
    risk("Ride the rocket", 0.97, ["Liftoff! You orbit the Earth and see a sunrise every 90 minutes.", { fameDelta: 8, happinessDelta: 15, smartsDelta: 2, bankBalanceDelta: 30000, performanceDelta: 10 }], ["Something went wrong on ascent. You survived the abort, barely.", { healthDelta: -25, fameDelta: 3, happinessDelta: -8 }], "health"),
    opt("Hand the seat to your backup", "You stepped aside. Your backup got the glory. You got a long lecture from the director.", { happinessDelta: -6, performanceDelta: -10 }),
  ], { requires: { jobLine: ["astronaut"] }, cooldown: 4, weight: 2 }),
  ev("spacewalk", "career", 26, 62, "Spacewalk", "You step out of the airlock into the void.", [
    opt("Do the repair", "A flawless repair, 400 km above Earth.", { fameDelta: 4, performanceDelta: 10, happinessDelta: 8 }),
    opt("Take a moment to just look", "The whole planet below you. You'll never forget it.", { happinessDelta: 12, smartsDelta: 1 }),
  ], { requires: { jobLine: ["astronaut"] }, cooldown: 4 }),
  ev("sermon_big", "career", 22, 80, "The Big Sermon", "A huge crowd has gathered for your sermon.", [
    risk("Deliver your best", 0.6, ["The congregation wept and applauded.", { fameDelta: 3, karmaDelta: 4, happinessDelta: 6, performanceDelta: 8 }], ["You lost your place. A long, awkward silence.", { happinessDelta: -3, performanceDelta: -4 }], "smarts"),
    opt("Keep it short", "A short, simple sermon. People appreciated the brevity.", { karmaDelta: 2, happinessDelta: 2 }),
  ], { requires: { jobLine: ["clergy"] }, cooldown: 4 }),

  // ---------- more adult-life texture ----------
  ev("dream_job_offer", "career", 24, 55, "Dream Job", "A company you've idolised for years offers you a job abroad.", [
    opt("Take it", "You packed up and moved for your dream.", { salaryPct: 30, happinessDelta: 10, relationshipDelta: { target: "Friend", delta: -8 } }),
    opt("Decline and stay put", "Comfort won out.", { happinessDelta: -1 }),
  ], { requires: { hasJob: true, minStat: { smarts: 65 } }, once: true }),
  ev("work_from_home", "career", 24, 64, "Work From Home", "Your company announces a remote-work policy.", [
    opt("Go fully remote", "Pyjama bottoms, productivity soaring. Occasionally.", { happinessDelta: 6, healthDelta: -1, performanceDelta: 2 }),
    opt("Stay in the office", "You enjoy the buzz.", { performanceDelta: 4, relationshipDelta: { target: "Friend", delta: 3 } }),
    opt("Move to a beach town", "You worked from a hammock. It was great until the Wi-Fi died.", { happinessDelta: 8, bankBalanceDelta: -1500 }),
  ], { requires: { hasJob: true }, cooldown: 12, weight: 0.6 }),
  ev("unpaid_internship", "career", 18, 24, "Unpaid Internship", "A prestigious firm offers an unpaid internship.", [
    opt("Take it", "You made coffee for six months. The reference letter is shiny.", { smartsDelta: 2, bankBalanceDelta: -2000, happinessDelta: -2, performanceDelta: 4 }),
    opt("Hold out for paid work", "You held out. Rent keeps coming due.", { happinessDelta: -2 }),
  ], { requires: { hasJob: false }, cooldown: 4 }),
  ev("pension_scare", "money", 50, 70, "Pension Panic", "Your pension fund is rumoured to be underfunded.", [
    opt("Top up your savings ($10,000)", "Better safe than sorry.", { bankBalanceDelta: -10000, smartsDelta: 1 }),
    opt("Cross your fingers", "It was fine. Probably.", { happinessDelta: -3 }),
  ], { requires: { minBank: 20000 }, once: true, weight: 0.6 }),
  ev("yoga_retreat", "health", 25, 80, "Wellness Retreat", "A friend books you a week at a mountain retreat.", [
    opt("Go ($1,200)", "Yoga, green juice, and a sunrise. You felt reborn.", { bankBalanceDelta: -1200, happinessDelta: 9, healthDelta: 3, viceDelta: { smoking: -5, alcohol: -5 } }),
    opt("Decline", "You decided to nap at home.", {}),
  ], { requires: { minBank: 1500 }, cooldown: 6 }),
  ev("friends_trip", "general", 20, 50, "Friends' Getaway", "Your friends are planning a big trip.", [
    opt("Cruise ($1,800)", "Sunburn, sea air, and dancing on deck.", { bankBalanceDelta: -1800, relationshipDelta: { target: "Friend", delta: 10 }, happinessDelta: 8 }),
    opt("Cabin in the woods ($300)", "Campfires and ghost stories.", { bankBalanceDelta: -300, relationshipDelta: { target: "Friend", delta: 8 }, happinessDelta: 6 }),
    opt("Sit it out", "You regretted it for months.", { relationshipDelta: { target: "Friend", delta: -8 }, happinessDelta: -2 }),
  ], { requires: { hasFriend: true, minBank: 300 }, cooldown: 5 }),
  ev("boss_birthday", "career", 22, 62, "The Boss's Surprise", "The office is throwing your boss a surprise party and you've been put in charge.", [
    opt("Go big ($200)", "It was spectacular. The boss cried.", { bankBalanceDelta: -200, performanceDelta: 8, happinessDelta: 3 }),
    opt("Keep it simple", "Cake and a card. Safe.", { performanceDelta: 3 }),
    opt("Forget entirely", "You forgot. The boss didn't.", { performanceDelta: -8 }),
  ], { requires: { hasJob: true }, cooldown: 6 }),
  ev("neighbour_hero", "general", 20, 80, "Smoke in the Night", "You smell smoke from next door.", [
    risk("Run in and help", 0.75, ["You pulled your neighbour out in time. The news called you a hero.", { karmaDelta: 12, fameDelta: 3, healthDelta: -3, happinessDelta: 6 }], ["You inhaled a lot of smoke. Everyone survived, but you spent weeks in hospital.", { karmaDelta: 12, healthDelta: -18, bankBalanceDelta: -2500 }], "health"),
    opt("Call the fire brigade", "You called it in. The fire was contained.", { karmaDelta: 5 }),
  ], { cooldown: 15, weight: 0.4 }),
  ev("midlife_marathon_friend", "general", 35, 60, "Midlife Crisis, Friend Edition", "Your oldest friend has bought a motorbike and quit accounting.", [
    opt("Go for a ride", "You rode into the sunset and got a speeding ticket.", { happinessDelta: 6, healthDelta: -1, bankBalanceDelta: -150 }),
    opt("Tell them it's a bad idea", "He's going to do it anyway.", { relationshipDelta: { target: "Friend", delta: -3 } }),
  ], { requires: { hasFriend: true }, cooldown: 8 }),
  ev("fraud_victim", "money", 22, 80, "Contractor Con", "A contractor took your deposit and vanished.", [
    opt("Sue him", "It took two years, but you got most of it back.", { bankBalanceDelta: -800, happinessDelta: -3, smartsDelta: 1 }),
    opt("Write it off", "A very expensive lesson.", { bankBalanceDelta: -4500, happinessDelta: -5 }),
    opt("Track him down yourself", "You found him at a car wash. Awkward.", { bankBalanceDelta: 3000, karmaDelta: -2, happinessDelta: 2 }),
  ], { requires: { hasProperty: true, minBank: 5000 }, cooldown: 12 }),
  ev("lucky_find", "money", 16, 90, "Pawn Shop Treasure", "You spot an old painting at a flea market for $40.", [
    risk("Buy it", 0.2, ["It's worth $22,000. You stare at it for an hour.", { bankBalanceDelta: 21960, happinessDelta: 10 }], ["It's a print. Oh well.", { bankBalanceDelta: -40 }]),
    opt("Leave it", "You left it. Somebody else got lucky.", {}),
  ], { requires: { minBank: 100 }, cooldown: 12, weight: 0.5 }),
  ev("shared_bank", "money", 20, 50, "Joint Account", "{partner} suggests combining your finances.", [
    opt("Merge accounts", "A big step. Trust all round.", { relationshipDelta: { target: "Partner", delta: 8 }, happinessDelta: 3 }),
    opt("Keep them separate", "You kept your independence.", { relationshipDelta: { target: "Partner", delta: -3 } }),
  ], { requires: { hasPartner: true }, once: true }),
  ev("long_term_illness_partner", "romance", 30, 85, "Hard Times", "{partner} is diagnosed with a serious illness.", [
    opt("Stay by their side", "You held their hand through every appointment.", { relationshipDelta: { target: "Partner", delta: 15 }, happinessDelta: -6, karmaDelta: 3 }),
    opt("Pay for the best care ($25,000)", "You spared no expense.", { bankBalanceDelta: -25000, relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: -3 }),
    opt("Withdraw", "It was too much. You stepped back.", { relationshipDelta: { target: "Partner", delta: -25 }, karmaDelta: -5, happinessDelta: -4 }),
  ], { requires: { hasPartner: true }, cooldown: 15, weight: 0.4 }),
];
