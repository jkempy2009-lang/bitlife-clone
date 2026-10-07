import { ev, opt } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// More infancy/early childhood, plus very old age.
export const EARLY2_EVENTS: LifeEvent[] = [
  // ---------- 0-4 ----------
  ev("baby_cry", "general", 0, 1, "Colic", "You cry for hours and nobody knows why.", [
    opt("Cry louder", "The whole building knows your name now.", { happinessDelta: -1, relationshipDelta: { target: "Parent", delta: -3 } }),
    opt("Giggle at {mother}", "You gurgled at {mother}. All was forgiven.", { relationshipDelta: { target: "Parent", delta: 4 }, happinessDelta: 2 }),
    opt("Fall asleep mid-cry", "You passed out mid-wail. Everyone cheered quietly.", { healthDelta: 1 }),
  ], { weight: 2 }),
  ev("first_smile", "general", 0, 1, "First Smile", "You smile for the first time. Everyone loses their minds.", [
    opt("Smile at {mother}", "{mother} cried. You didn't know why. It felt good.", { relationshipDelta: { target: "Parent", delta: 6 }, happinessDelta: 3 }),
    opt("Smile at {father}", "{father} showed the whole neighbourhood a video.", { relationshipDelta: { target: "Parent", delta: 6 }, happinessDelta: 3 }),
    opt("Stay stoic", "You've decided to be mysterious.", { smartsDelta: 1 }),
  ], { once: true, weight: 3 }),
  ev("first_food", "general", 0, 2, "Solid Food", "You're introduced to solid food for the first time.", [
    opt("Eat it all", "You devoured mashed carrots and wanted more.", { healthDelta: 2, happinessDelta: 3 }),
    opt("Spit it out", "You rejected everything with equal contempt.", { happinessDelta: 1 }),
    opt("Throw it at the wall", "A Jackson Pollock of puréed peas.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: -2 } }),
  ], { once: true, weight: 2 }),
  ev("teething", "health", 0, 2, "Teething", "Your gums are on fire.", [
    opt("Chew everything", "Remote controls were reduced to rubble.", { happinessDelta: -1, smartsDelta: 1 }),
    opt("Wail until given a cold ring", "The teething ring worked a charm.", { happinessDelta: 2 }),
  ], { once: true, weight: 2 }),
  ev("crawling", "general", 0, 1, "On the Move", "You've learned to crawl and the whole house is your playground.", [
    opt("Head for the stairs", "You were intercepted halfway up.", { smartsDelta: 1, happinessDelta: 3 }),
    opt("Chase the cat", "The cat has left the building.", { happinessDelta: 4 }),
    opt("Crawl into the kitchen cupboard", "You found the pots and pans and began a concert.", { happinessDelta: 5, skillDeltas: { music: 1 } }),
  ], { once: true, weight: 2 }),
  ev("baby_laugh", "general", 0, 2, "Belly Laugh", "Something hilarious happened. You aren't sure what, but you can't stop laughing.", [
    opt("Laugh until you hiccup", "Everyone laughed along. Pure joy.", { happinessDelta: 6 }),
    opt("Try to share the joke", "Nobody understood the gurgling.", { happinessDelta: 2, smartsDelta: 1 }),
  ], { weight: 1 }),
  ev("lullaby", "general", 0, 3, "Lullabies", "Bedtime again. {mother} starts to sing.", [
    opt("Fall asleep immediately", "Sweet dreams.", { happinessDelta: 3, relationshipDelta: { target: "Parent", delta: 3 } }),
    opt("Demand another song", "You demanded a seventh encore.", { skillDeltas: { music: 1 }, happinessDelta: 2 }),
    opt("Stay up to supervise", "You watched the ceiling for four hours.", { smartsDelta: 1, happinessDelta: -1 }),
  ], { weight: 1 }),
  ev("toddler_words", "general", 1, 3, "Toddler Vocabulary", "You've learned a very rude word and you're using it everywhere.", [
    opt("Say it at the supermarket", "A woman gasped. {mother} turned beetroot.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: -3 } }),
    opt("Say it to the dog", "The dog was unaffected.", { happinessDelta: 2 }),
    opt("Learn a new word instead", "You've picked up 'please'.", { smartsDelta: 2, karmaDelta: 1 }),
  ], { once: true }),
  ev("potty_training", "general", 1, 4, "Potty Training", "The potty is waiting.", [
    opt("Master it quickly", "You mastered the potty in a weekend. Genius.", { smartsDelta: 2, happinessDelta: 3 }),
    opt("Resist for months", "Months of accidents. A war of attrition.", { happinessDelta: -1, relationshipDelta: { target: "Parent", delta: -3 } }),
    opt("Decorate the potty", "You made it your throne.", { happinessDelta: 3 }),
  ], { once: true, weight: 2 }),
  ev("zoo_visit", "general", 2, 8, "The Zoo", "A trip to the zoo!", [
    opt("Befriend a goat", "You and the petting-zoo goat were inseparable.", { happinessDelta: 6 }),
    opt("Scream at the lion", "The lion was unimpressed.", { happinessDelta: 3 }),
    opt("Get lost", "You wandered off and were found by the penguins.", { happinessDelta: 2, relationshipDelta: { target: "Parent", delta: -4 } }),
  ], { cooldown: 4 }),
  ev("playground_friend", "general", 2, 6, "Sandbox Pals", "A kid in the sandbox wants to build a castle with you.", [
    opt("Team up", "Your sandcastle was magnificent.", { addRelative: { relation: "Friend", ageOffset: [-1, 1] }, happinessDelta: 5 }),
    opt("Knock it down", "You knocked down their castle and they never forgave you.", { karmaDelta: -2, happinessDelta: 3 }),
    opt("Eat the sand", "You ate sand. It was gritty.", { healthDelta: -1, happinessDelta: -1 }),
  ], { cooldown: 3 }),
  ev("toy_choice", "general", 2, 7, "Birthday Toys", "It's your birthday and the presents are everywhere.", [
    opt("Play with the box", "Not the toy. The box. Always the box.", { smartsDelta: 1, happinessDelta: 5 }),
    opt("Build with the blocks", "You built a tower taller than you.", { smartsDelta: 2, happinessDelta: 4 }),
    opt("Hog all the toys", "You refused to share. A scene ensued.", { karmaDelta: -2, happinessDelta: 3 }),
  ], { cooldown: 3 }),
  ev("peekaboo", "family", 0, 2, "Peekaboo", "{father} hides behind his hands and then 'reappears'.", [
    opt("Laugh hysterically", "He did it forty-three times. You never got tired.", { relationshipDelta: { target: "Parent", delta: 5 }, happinessDelta: 5 }),
    opt("Look underwhelmed", "You've seen better magic.", { smartsDelta: 1 }),
  ], { weight: 1 }),
  ev("toddler_art", "general", 2, 5, "Wall Art", "You've discovered permanent marker.", [
    opt("Decorate the living room", "The wall is a masterpiece. {mother} disagrees.", { happinessDelta: 5, relationshipDelta: { target: "Parent", delta: -5 }, hobbyDelta: { painting: 4 } }),
    opt("Draw on paper like a normal person", "A stick figure family. Fridge-worthy.", { happinessDelta: 3, hobbyDelta: { painting: 3 } }),
    opt("Draw on your sibling", "Your sibling is now a Dalmatian.", { relationshipDelta: { target: "Sibling", delta: -4 }, happinessDelta: 3 }),
  ], { once: true }),
  ev("thunderstorm", "general", 2, 8, "Thunderstorm", "A huge storm rolls in and the thunder rattles the windows.", [
    opt("Dive into {mother}'s bed", "Hugs and a blanket fort. All better.", { relationshipDelta: { target: "Parent", delta: 5 }, happinessDelta: 2 }),
    opt("Watch it from the window", "You watched the lightning. Fascinated.", { smartsDelta: 2 }),
    opt("Hide under the table", "Brave. In a way.", { happinessDelta: -2 }),
  ], { cooldown: 4 }),
  ev("swim_lessons", "health", 3, 9, "Swim Lessons", "Time to learn to swim.", [
    opt("Dive right in", "You swam like a puppy. Full of enthusiasm.", { healthDelta: 3, happinessDelta: 4, skillDeltas: { athletics: 4 } }),
    opt("Refuse to enter the water", "You clung to the side for an hour.", { happinessDelta: -2 }),
    opt("Splash the instructor", "You got a stern talking-to and a lifetime of fun.", { happinessDelta: 4, karmaDelta: -1 }),
  ], { once: true }),
  ev("picky_eater", "health", 2, 8, "Picky Eater", "You've decided you only eat beige food.", [
    opt("Hold out for nuggets", "You survived on nuggets for a year. {mother} is horrified.", { healthDelta: -1, happinessDelta: 3 }),
    opt("Try broccoli", "It was fine. Not good, not bad. Fine.", { healthDelta: 2, karmaDelta: 1 }),
    opt("Hide veggies under the table", "The dog became a nutrition expert.", { happinessDelta: 2, relationshipDelta: { target: "Parent", delta: -2 } }),
  ], { cooldown: 5 }),
  ev("lost_in_store", "general", 3, 8, "Lost in the Store", "You've lost sight of {mother} in the huge supermarket.", [
    opt("Ask a staff member for help", "A kind worker used the loudspeaker. {mother} came running.", { smartsDelta: 2, happinessDelta: -1 }),
    opt("Cry in the cereal aisle", "A crowd formed around you. {mother} arrived in tears.", { happinessDelta: -3 }),
    opt("Enjoy your freedom", "You tried all the free samples before security found you.", { happinessDelta: 4, karmaDelta: -1 }),
  ], { once: true }),
  // ---------- 5-9 ----------
  ev("wobbly_tooth", "general", 5, 8, "Wobbly Tooth", "Your tooth won't come out. It's driving you mad.", [
    opt("Tie it to a door", "The door slammed. Tooth gone. A new smile.", { healthDelta: -1, happinessDelta: 3 }),
    opt("Wiggle it until it falls", "Eventually, it fell into your cereal.", { happinessDelta: 2 }),
    opt("Ask {mother} to pull it", "Painless. Impressive.", { relationshipDelta: { target: "Parent", delta: 3 } }),
  ], { once: true }),
  ev("first_best_friend", "general", 5, 9, "Best Friends Forever", "A kid in class has become your best friend. They have the same lunchbox!", [
    opt("Swear a blood oath (pinky)", "Pinky promises sealed the deal.", { addRelative: { relation: "Friend", ageOffset: [-1, 1] }, happinessDelta: 7 }),
    opt("Trade lunches", "You've both gained and lost a lot.", { addRelative: { relation: "Friend", ageOffset: [-1, 1] }, happinessDelta: 4 }),
  ], { once: true, weight: 2 }),
  ev("losing_game", "school", 5, 10, "Sore Loser", "You lost the school sack race by a hair.", [
    opt("Shake hands graciously", "A good sport. Parents beamed.", { karmaDelta: 3, happinessDelta: 1 }),
    opt("Throw a tantrum", "You lay down on the field and screamed.", { karmaDelta: -2, happinessDelta: -2 }),
    opt("Vow revenge", "Next year, it's yours.", { skillDeltas: { athletics: 3 } }),
  ], { cooldown: 4 }),
  ev("nightmare", "health", 4, 10, "Nightmares", "You keep dreaming about a monster under your bed.", [
    opt("Check under the bed with a torch", "Just a sock. A very scary sock.", { smartsDelta: 1, happinessDelta: 2 }),
    opt("Sleep in {mother}'s room", "Safe and sound.", { relationshipDelta: { target: "Parent", delta: 4 } }),
    opt("Befriend the monster", "He gave you a mint and went away.", { happinessDelta: 4, smartsDelta: 1 }),
  ], { once: true }),
  ev("chicken_pox", "health", 4, 10, "Spots", "You're covered in itchy spots.", [
    opt("Don't scratch", "A heroic show of restraint. No scars.", { karmaDelta: 1, healthDelta: -2 }),
    opt("Scratch like crazy", "You scratched and scarred.", { looksDelta: -1, healthDelta: -3 }),
  ], { once: true, weight: 1.5 }),
  ev("lemon_vs_pet_rock", "general", 5, 10, "Show and Tell", "Time for show and tell. You have 3 minutes.", [
    opt("Bring your pet", "Your dog stole the show (and a sandwich).", { happinessDelta: 5, fameDelta: 1 }),
    opt("Share a story", "You described a made-up adventure with total conviction.", { skillDeltas: { charisma: 2 }, happinessDelta: 3 }),
    opt("Stay home sick", "You faked a cough and avoided it.", { karmaDelta: -1 }),
  ], { cooldown: 4 }),
  ev("treehouse", "general", 6, 12, "Treehouse", "You and your friends want to build a treehouse.", [
    opt("Build it properly", "You built a sturdy treehouse. The best summer.", { smartsDelta: 3, happinessDelta: 7, relationshipDelta: { target: "Friend", delta: 6 } }),
    opt("Build it fast", "It collapsed within a day. A learning experience.", { healthDelta: -4, happinessDelta: -1 }),
  ], { once: true }),
  ev("birthday_clown", "general", 5, 9, "Clowns", "Your parents hired a clown for your birthday. You are terrified.", [
    opt("Hide in the closet", "You hid for an hour. The clown was lovely, in retrospect.", { happinessDelta: -2 }),
    opt("Befriend the clown", "He taught you balloon animals.", { happinessDelta: 5, skillDeltas: { charisma: 2 } }),
    opt("Chase him out", "A legend was born.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: -3 } }),
  ], { once: true, weight: 0.8 }),
  ev("library_card", "school", 5, 10, "Your Own Library Card", "You've been given your very own library card.", [
    opt("Borrow forty books", "You read all of them. Nerd glory.", { smartsDelta: 4, happinessDelta: 3 }),
    opt("Borrow one and lose it", "A very expensive fine.", { bankBalanceDelta: -5 }),
  ], { once: true }),
  // ---------- very old age ----------
  ev("hundredth_birthday", "general", 98, 110, "A Hundred Candles", "A reporter comes to interview you on your 100th birthday.", [
    opt("Reveal the secret to your long life", "'Pickles and spite,' you said. It made the news.", { happinessDelta: 8, fameDelta: 5 }),
    opt("Blow out the candles", "It took four lungfuls, but you did it.", { happinessDelta: 6 }),
  ], { once: true, weight: 8 }),
  ev("tech_confusion", "general", 80, 110, "Smart Home Chaos", "Your grandkids installed a smart speaker. It keeps talking to you.", [
    opt("Argue with it", "It lost. You were right.", { happinessDelta: 4 }),
    opt("Ask it for the weather", "A revelation.", { smartsDelta: 1, happinessDelta: 3 }),
    opt("Unplug it", "Silence reigns.", { happinessDelta: 1 }),
  ], { cooldown: 12 }),
  ev("old_age_walk", "health", 80, 110, "Morning Stroll", "You walk around the block every morning.", [
    opt("Add one more lap", "Your doctor was delighted.", { healthDelta: 3, happinessDelta: 3 }),
    opt("Sit on a bench and watch", "You watched the world go by.", { happinessDelta: 4 }),
  ], { cooldown: 4 }),
  ev("final_wishes", "family", 85, 110, "What Matters", "You gather your family around.", [
    opt("Share your life lessons", "They hung on every word.", { relationshipDelta: { target: "All", delta: 8 }, happinessDelta: 5 }),
    opt("Tell a joke", "It was the funniest thing they'd ever heard. You were hilarious in your day.", { happinessDelta: 6, relationshipDelta: { target: "All", delta: 4 } }),
  ], { cooldown: 8 }),
  ev("old_pet_buddy", "general", 80, 110, "A Loyal Companion", "Your pet curls at your feet while you watch TV.", [
    opt("Spoil them with treats", "The dog loved you even more.", { happinessDelta: 5, bankBalanceDelta: -20 }),
    opt("Take a nap together", "A perfect afternoon.", { happinessDelta: 5, healthDelta: 1 }),
  ], { requires: { custom: (p) => p.flags.includes("has_dog") || p.flags.includes("has_cat") }, cooldown: 4 }),
  ev("life_story_documentary", "fame", 80, 110, "Your Story", "A film student wants to make a documentary about your life.", [
    opt("Say yes", "The documentary was a quiet hit.", { fameDelta: 3, happinessDelta: 8 }),
    opt("Decline", "Some stories are meant to stay yours.", { happinessDelta: 1 }),
  ], { once: true }),
];
