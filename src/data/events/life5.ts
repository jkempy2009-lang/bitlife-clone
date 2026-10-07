import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";

const minorKid = (p: PlayerState) => p.relatives.some((r) => r.relation === "Child" && r.alive && r.age < 18);

// Fills the thin stretches of life: the first years, the long middle, and the slow goodbye.
export const LIFE5_EVENTS: LifeEvent[] = [
  // ---------- infancy & toddlerhood ----------
  ev("baby_colic", "health", 0, 1, "The Screaming Months", "For reasons nobody can explain, you cry from dusk until dawn.", [
    opt("Cry louder", "You cried with a conviction that unsettled the neighbours. {mother} aged ten years.", { relationshipDelta: { target: "Parent", delta: -3 }, happinessDelta: -2 }),
    opt("Be soothed by the vacuum cleaner", "A mysterious hum and you were out cold. {father} vacuumed the same rug for hours.", { happinessDelta: 3, relationshipDelta: { target: "Parent", delta: 3 } }),
  ], { once: true }),
  ev("toddler_potty", "general", 2, 4, "Potty Training", "The tiny throne awaits. Everyone is very invested in your bladder.", [
    opt("Master it in a week", "You were a natural. {mother} bragged to everyone at the park.", { smartsDelta: 2, relationshipDelta: { target: "Parent", delta: 4 }, happinessDelta: 3 }),
    opt("Refuse on principle", "You held out for months. It became a family saga.", { happinessDelta: -1, relationshipDelta: { target: "Parent", delta: -3 } }),
    opt("Only use it when no one's watching", "A secretive approach, but it worked.", { smartsDelta: 1, happinessDelta: 2 }),
  ], { once: true }),
  ev("toddler_paint", "general", 2, 5, "Wall Art", "You find a marker. Beside you stands a clean white wall.", [
    opt("Create a masterpiece", "A mural of a dog, a sun, and what may be {mother}. It stayed on the wall for years.", { skillDeltas: { acting: 1 }, happinessDelta: 5, relationshipDelta: { target: "Parent", delta: -3 } }),
    opt("Draw on paper like a civilised person", "Your parents framed it. It's on the fridge to this day.", { happinessDelta: 3, smartsDelta: 1, relationshipDelta: { target: "Parent", delta: 3 } }),
  ], { cooldown: 3 }),
  ev("toddler_storm", "general", 3, 6, "Thunder in the Night", "A huge storm rattles the windows. It's very dark in your room.", [
    opt("Dive into your parents' bed", "{mother} made room without a word. Safe and warm.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: 5 } }),
    opt("Count the seconds between flashes", "You counted every one. Science is a comfort.", { smartsDelta: 3, happinessDelta: 1 }),
    opt("Pull the blanket over your head", "You held out until dawn, brave and sweaty.", { happinessDelta: -1, karmaDelta: 1 }),
  ], { cooldown: 4 }),
  ev("toddler_zoo", "family", 3, 8, "A Day at the Zoo", "The family is going to the zoo. There's a very large gift shop.", [
    opt("Befriend the goats", "The petting zoo goat ate your hat. Best day of your life.", { happinessDelta: 7, relationshipDelta: { target: "Parent", delta: 4 } }),
    opt("Demand a plush giraffe", "{mother} caved at the exit. The giraffe has a name now.", { happinessDelta: 6, bankBalanceDelta: 0 }),
    opt("Fall asleep in the stroller", "You missed the lions. The photos suggest you were adorable.", { happinessDelta: 2, healthDelta: 1 }),
  ], { cooldown: 5 }),
  ev("kindergarten_friend", "school", 4, 7, "Your First Best Friend", "A kid in class shares their crayons with you. A bond is formed.", [
    opt("Become inseparable", "You and your new best friend did everything together.", { happinessDelta: 6, addRelative: { relation: "Friend", ageOffset: [0, 1] } }),
    opt("Keep to yourself", "You preferred your own company. It's a valid lifestyle.", { smartsDelta: 1, happinessDelta: -1 }),
  ], { once: true, requires: { custom: (p) => !p.relatives.some((r) => r.relation === "Friend" && r.alive) } }),

  // ---------- the long middle ----------
  ev("midlife_reunion", "general", 28, 55, "Class Reunion", "An invitation arrives: your old school is having a reunion.", [
    opt("Go and show off", "You told every story you had. Some of them were even true.", { happinessDelta: 5, bankBalanceDelta: -150, relationshipDelta: { target: "Friend", delta: 4 } }),
    opt("Go in your comfortable shoes", "You had a lovely evening with the people who actually mattered.", { happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 6 } }),
    opt("Skip it", "You stayed home. Social media told you everything you needed to know.", { happinessDelta: -1 }),
  ], { cooldown: 10, weight: 0.8 }),
  ev("marathon_dream", "health", 24, 55, "Race Day", "A friend dares you to sign up for a marathon.", [
    risk("Train properly and run it", 0.7, ["You crossed the line crying and elated. You are now insufferable about running.", { healthDelta: 8, happinessDelta: 10, looksDelta: 2 }], ["Your knee gave out at mile 18. The ambulance was surprisingly comfortable.", { healthDelta: -8, happinessDelta: -3, bankBalanceDelta: -600 }], "health"),
    opt("Sign up and never train", "You signed up. You did not train. The sunk cost haunts you.", { bankBalanceDelta: -90, happinessDelta: -1 }),
    opt("Cheer from the sidewalk", "Holding a sign was surprisingly emotional.", { happinessDelta: 3, relationshipDelta: { target: "Friend", delta: 4 } }),
  ], { cooldown: 12 }),
  ev("school_run", "family", 25, 50, "Parent-Teacher Night", "{child}'s teacher wants a word with you.", [
    opt("Listen and plan with them", "A good chat and a plan. {child} noticed you cared.", { relationshipDelta: { target: "Child", delta: 6 }, happinessDelta: 2 }),
    opt("Defend {child} at all costs", "You were certain the teacher was wrong. They were not.", { relationshipDelta: { target: "Child", delta: 3 }, karmaDelta: -1 }),
    opt("Send your partner instead", "You'd rather not. Your partner did, and told you everything.", { relationshipDelta: { target: "Partner", delta: -3 } }),
  ], { requires: { custom: minorKid }, cooldown: 3 }),
  ev("midlife_checkup", "health", 40, 70, "A Concerning Number", "Your routine blood test comes back with a flagged result.", [
    opt("Change your diet and exercise", "Salad became a personality. The numbers improved.", { healthDelta: 6, happinessDelta: -1 }),
    opt("Get a second opinion ($400)", "Another doctor, another coffee, another nervous wait. Largely fine.", { bankBalanceDelta: -400, happinessDelta: 2 }),
    opt("Ignore it", "You ignored it. It did not ignore you.", { healthDelta: -5 }),
  ], { cooldown: 8 }),
  ev("side_hustle", "money", 22, 55, "The Side Hustle", "A friend suggests turning a hobby into a little income on the weekends.", [
    opt("Give it a go", "Weekends vanished, but so did some bills.", { bankBalanceDelta: 3200, happinessDelta: 2, healthDelta: -2 }),
    opt("Stay focused on your day job", "You protected your weekends fiercely.", { happinessDelta: 3 }),
  ], { cooldown: 6 }),

  // ---------- later life ----------
  ev("grandkid_visit", "family", 55, 95, "Sticky Fingers", "Your grandchildren are staying for the weekend.", [
    opt("Spoil them rotten", "Sweets, stories and late nights. Your children will hear about it.", { happinessDelta: 9, bankBalanceDelta: -250, relationshipDelta: { target: "Grandchild", delta: 8 } }),
    opt("Teach them something", "You taught them a card game. They cheat already.", { happinessDelta: 6, smartsDelta: 1, relationshipDelta: { target: "Grandchild", delta: 5 } }),
  ], { requires: { hasGrandchildren: true }, cooldown: 3 }),
  ev("memory_lane", "general", 65, 100, "Old Photographs", "You find a box of old photographs in the attic.", [
    opt("Spend the afternoon with them", "Every face had a story. You smiled and cried a little.", { happinessDelta: 6 }),
    opt("Share them with the family", "The family listened. You told stories you'd never told.", { happinessDelta: 8, relationshipDelta: { target: "All", delta: 4 } }),
    opt("Put them back", "Some things are better left in the attic.", {}),
  ], { cooldown: 10 }),
  ev("garden_joy", "general", 60, 100, "Green Fingers", "Your garden has become a quiet obsession.", [
    opt("Grow vegetables", "The tomatoes were the best you've ever had, and nobody can tell you otherwise.", { happinessDelta: 6, healthDelta: 2 }),
    opt("Plant roses", "The neighbourhood stops to admire your roses.", { happinessDelta: 7, fameDelta: 1 }),
  ], { cooldown: 8, weight: 0.8 }),
  ev("old_friend_passes", "family", 65, 100, "Another Name", "A dear old friend has died.", [
    opt("Go to the funeral", "You said goodbye. The service was beautiful and heavy.", { happinessDelta: -6, karmaDelta: 2 }),
    opt("Write a letter to their family", "You put it into words. It meant a lot to them.", { happinessDelta: -3, karmaDelta: 3 }),
  ], { requires: { hasFriend: true }, cooldown: 4, weight: 0.8 }),
  ev("fall_hip", "health", 70, 100, "A Bad Step", "You slip on the stairs.", [
    opt("Go to the hospital ($1,000)", "Bruised, not broken. They sent you home with a stern lecture.", { bankBalanceDelta: -1000, healthDelta: -4 }),
    opt("Tough it out", "You didn't need a doctor. You definitely needed a doctor.", { healthDelta: -10, happinessDelta: -4 }),
  ], { cooldown: 5 }),
  ev("volunteer_drive", "general", 55, 95, "Give Something Back", "The local community centre needs volunteers.", [
    opt("Sign up", "A new purpose, a new set of friends, and surprisingly sore knees.", { karmaDelta: 6, happinessDelta: 6, addRelative: { relation: "Friend", ageOffset: [-8, 8] } }),
    opt("Donate money ($300)", "A small cheque, a warm feeling.", { bankBalanceDelta: -300, karmaDelta: 3, happinessDelta: 2 }),
  ], { cooldown: 6 }),
];
