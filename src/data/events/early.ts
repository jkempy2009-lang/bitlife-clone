import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Infancy (0-4) and childhood (5-12)
export const EARLY_EVENTS: LifeEvent[] = [
  // ---------- infancy ----------
  ev("dirty_diaper", "general", 0, 2, "Code Brown", "Your diaper has reached critical mass. What is your strategy?", [
    opt("Scream until someone changes it", "You screamed bloody murder until {mother} came running.", { happinessDelta: 2, relationshipDelta: { target: "Parent", delta: -2 } }),
    opt("Sit in it silently", "You sat in silence and contemplated the nature of existence. Rash acquired.", { healthDelta: -2, happinessDelta: -3, smartsDelta: 1 }),
    opt("Redecorate the nursery", "You used the contents of your diaper as finger paint. A bold artistic debut.", { happinessDelta: 5, looksDelta: -1, relationshipDelta: { target: "Parent", delta: -5 }, skillDeltas: { acting: 1 } }),
  ], { cooldown: 2 }),
  ev("first_steps", "general", 1, 2, "First Steps", "Your legs finally cooperate. The living room is a vast frontier.", [
    opt("Walk straight to {mother}", "You toddled across the room into {mother}'s arms. There wasn't a dry eye in the house.", { happinessDelta: 6, relationshipDelta: { target: "Parent", delta: 8 } }),
    opt("Beeline for the staircase", "You went straight for the staircase. Nobody remembers how you got to the top.", { healthDelta: -3, smartsDelta: -1, happinessDelta: 3 }),
    opt("Walk into the coffee table", "You walked face-first into the coffee table. It was a hard lesson in physics.", { healthDelta: -2, looksDelta: -1 }),
  ], { once: true }),
  ev("first_word", "general", 1, 3, "First Word", "The whole family hangs on your every gurgle. Your first word will be…", [
    opt("\"Mama\"", "Your first word was \"Mama\". {mother} cried happy tears.", { relationshipDelta: { target: "Parent", delta: 6 }, smartsDelta: 2, happinessDelta: 3 }),
    opt("\"Dada\"", "Your first word was \"Dada\". {father} has been insufferable about it since.", { relationshipDelta: { target: "Parent", delta: 6 }, smartsDelta: 2, happinessDelta: 3 }),
    opt("\"No!\"", "Your first word was \"No!\". It would not be your last.", { smartsDelta: 3, relationshipDelta: { target: "Parent", delta: -2 } }),
    opt("\"Pizza\"", "Your first word was \"Pizza\". The family took it as prophecy.", { happinessDelta: 6, healthDelta: -1 }),
  ], { once: true }),
  ev("toddler_tantrum", "general", 2, 4, "Supermarket Meltdown", "The checkout aisle has candy. {mother} has said no.", [
    opt("Full floor-flop tantrum", "You threw yourself to the floor and screamed. Everyone stared. {mother} was mortified.", { relationshipDelta: { target: "Parent", delta: -6 }, happinessDelta: 2 }),
    opt("Quiet, devastating pout", "You deployed the Sad Eyes. {mother} caved instantly.", { happinessDelta: 6, smartsDelta: 1 }),
    opt("Accept your fate", "You accepted the loss with grace. {mother} bought you a sticker for your maturity.", { relationshipDelta: { target: "Parent", delta: 5 }, karmaDelta: 2 }),
  ]),
  ev("eat_crayon", "health", 2, 4, "The Taste of Wax", "The red crayon looks delicious. Your instincts are loud.", [
    opt("Eat the red crayon", "You ate the crayon. The next morning's diaper was festive.", { healthDelta: -2, happinessDelta: 3 }),
    opt("Eat the whole box", "You ate the entire box. The doctor was fascinated.", { healthDelta: -6, happinessDelta: 2, diseaseTrigger: "food_poisoning" }),
    opt("Draw with it instead", "You drew a surprisingly competent horse on the wall.", { smartsDelta: 3, skillDeltas: { acting: 1 } }),
  ]),
  ev("daycare_biter", "general", 3, 5, "The Biter", "A kid at daycare keeps biting people. Today it's your turn to be bitten — or to bite.", [
    opt("Bite them back", "You bit them back. Daycare staff called {mother} in for a meeting.", { karmaDelta: -4, relationshipDelta: { target: "Parent", delta: -4 } }),
    opt("Tell a teacher", "You told the teacher. The Biter was put in time-out forever.", { karmaDelta: 2, smartsDelta: 1 }),
    opt("Befriend the Biter", "You shared your snack with the Biter. A peace treaty was signed.", { karmaDelta: 4, happinessDelta: 4 }),
  ]),
  ev("imaginary_friend", "general", 3, 6, "Mr. Whiskers", "You've acquired an imaginary friend who's a six-foot-tall cat.", [
    opt("Set a place for him at dinner", "Mr. Whiskers joined the family for dinner every night. {mother} played along.", { happinessDelta: 6, smartsDelta: 1 }),
    opt("Blame him for everything", "\"Mr. Whiskers did it\" became your legal defense.", { karmaDelta: -2, smartsDelta: 2 }),
    opt("Grow out of him", "Mr. Whiskers wandered off one day. You barely noticed.", { smartsDelta: 2 }),
  ], { once: true }),
  ev("toddler_escape", "general", 2, 4, "The Great Escape", "The front gate was left open. The street is full of possibilities.", [
    opt("Make a run for it", "You made it halfway down the street before a neighbour carried you home.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: -4 } }),
    opt("Wave at the neighbours", "You waved at the neighbours until {mother} found you. You are very popular.", { happinessDelta: 3 }),
    opt("Stay put", "You stayed in the yard like a good citizen.", { karmaDelta: 2 }),
  ]),
  ev("sibling_jealousy", "family", 2, 6, "Share and Share Alike", "{sibling} is playing with your favourite toy.", [
    opt("Grab it back", "You snatched your toy back. A war between siblings began.", { relationshipDelta: { target: "Sibling", delta: -8 }, karmaDelta: -2 }),
    opt("Play together", "You built an elaborate pillow fort together. Truly a golden age.", { relationshipDelta: { target: "Sibling", delta: 8 }, happinessDelta: 4 }),
    opt("Tattle", "You told {mother}. {sibling} will remember this.", { relationshipDelta: { target: "Sibling", delta: -4 }, karmaDelta: -1 }),
  ], { requires: { hasSibling: true } }),

  // ---------- childhood ----------
  ev("schoolyard_bully", "school", 5, 13, "Schoolyard Bully", "A bigger kid has cornered you by the monkey bars and wants your lunch money.", [
    risk("Fight back", 0.4, ["You landed a lucky punch. The bully ran off crying and you became a legend.", { karmaDelta: -2, happinessDelta: 6, fameDelta: 1 }], ["You lost the fight badly and left with a black eye.", { healthDelta: -6, happinessDelta: -8, looksDelta: -2 }], "health"),
    opt("Hand over the money", "You gave up your lunch money. You ate air for lunch.", { bankBalanceDelta: -5, happinessDelta: -4 }),
    opt("Tell a teacher", "You told the teacher. The bully got detention and glared at you for months.", { karmaDelta: 3, smartsDelta: 1, happinessDelta: -1 }),
    opt("Befriend the bully", "You offered the bully half your sandwich. He turned out to be lonely. You made a friend.", { happinessDelta: 5, karmaDelta: 4, addRelative: { relation: "Friend", ageOffset: [-1, 2] } }),
  ], { cooldown: 4 }),
  ev("cheat_test", "school", 7, 17, "Wandering Eyes", "The test is hard. Your neighbour's paper is right there.", [
    risk("Copy their answers", 0.6, ["You copied every answer and aced the test. Nobody noticed.", { smartsDelta: -1, karmaDelta: -3, happinessDelta: 3 }], ["The teacher caught you red-handed. Zero, and a call home.", { karmaDelta: -3, happinessDelta: -8, relationshipDelta: { target: "Parent", delta: -8 } }]),
    opt("Do your honest best", "You did your honest best. It wasn't brilliant, but it was yours.", { smartsDelta: 2, karmaDelta: 2 }),
    opt("Leave the paper blank in protest", "You turned in a blank paper on principle. The principal was not impressed.", { happinessDelta: 2, smartsDelta: -2, relationshipDelta: { target: "Parent", delta: -4 } }),
  ], { cooldown: 3 }),
  ev("lunch_money", "money", 6, 12, "Lunch Money", "You found $20 in an old coat pocket.", [
    opt("Spend it all on candy", "You bought a mountain of candy. Dentists wept.", { bankBalanceDelta: 20, happinessDelta: 6, healthDelta: -2 }),
    opt("Save it", "You stashed the money in a sock. The beginning of a financial empire.", { bankBalanceDelta: 20, smartsDelta: 2 }),
    opt("Give it to a classmate who needs it", "A classmate's lunch account was empty. You covered it. Quietly heroic.", { karmaDelta: 5, happinessDelta: 4, addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
  ]),
  ev("class_pet", "school", 6, 10, "Class Pet Duty", "It's your week to take the class hamster home.", [
    opt("Care for it lovingly", "You took excellent care of the hamster. It lived to a ripe old age.", { karmaDelta: 4, happinessDelta: 4 }),
    opt("Teach it tricks", "The hamster learned zero tricks, but you learned patience.", { smartsDelta: 2, happinessDelta: 3 }),
    opt("Lose it", "You lost the hamster. It was last seen heading for freedom.", { karmaDelta: -3, happinessDelta: -3 }),
  ], { once: true }),
  ev("spelling_bee", "school", 7, 13, "Spelling Bee", "You've been picked for the school spelling bee. Your word is \"onomatopoeia\".", [
    risk("Go for it, sound it out", 0.45, ["You spelled it perfectly and won the bee. Trophy acquired.", { smartsDelta: 4, happinessDelta: 7, fameDelta: 1 }], ["You blanked on the second 'o'. Eliminated in round one.", { happinessDelta: -4 }], "smarts"),
    opt("Pretend to have a stomachache", "You faked a stomachache and went home. Mum made soup.", { happinessDelta: 2, karmaDelta: -1 }),
  ]),
  ev("lost_tooth", "general", 6, 9, "Tooth Fairy", "Your front tooth finally came out!", [
    opt("Put it under the pillow", "The tooth fairy left $5. Capitalism is magical.", { bankBalanceDelta: 5, happinessDelta: 4 }),
    opt("Stay up to catch the fairy", "You stayed up all night and saw {mother} sneaking in. The magic is gone.", { smartsDelta: 3, happinessDelta: -2 }),
    opt("Sell the tooth to a classmate", "You sold the tooth to a classmate for $8. A born entrepreneur.", { bankBalanceDelta: 8, smartsDelta: 1, karmaDelta: -1 }),
  ], { once: true }),
  ev("talent_show", "school", 7, 14, "School Talent Show", "The talent show needs acts. The crowd will be your whole school.", [
    risk("Sing a pop song", 0.5, ["You belted it out and the gym went wild. You may have found a calling.", { fameDelta: 3, happinessDelta: 8, skillDeltas: { music: 4 } }], ["Your voice cracked on the high note. Someone laughed. You'll never forget it.", { happinessDelta: -6, skillDeltas: { music: 1 } }], "looks"),
    risk("Do a dramatic monologue", 0.5, ["The room fell silent, then erupted. A star is born.", { fameDelta: 3, happinessDelta: 8, skillDeltas: { acting: 4 } }], ["You forgot your lines and improvised a long, painful silence.", { happinessDelta: -6, skillDeltas: { acting: 1 } }], "looks"),
    opt("Be in the audience", "You watched from the third row with popcorn. The show was mediocre.", { happinessDelta: 2 }),
  ], { cooldown: 4 }),
  ev("piano_lessons", "general", 6, 12, "Music Lessons", "{mother} thinks you should learn an instrument.", [
    opt("Learn the guitar", "You practised until your fingertips bled. Rock and roll!", { skillDeltas: { music: 8 }, setFlags: ["music_dream"], smartsDelta: 1 }),
    opt("Learn the piano", "You practised scales every night. Your teacher says you have promise.", { skillDeltas: { music: 8 }, setFlags: ["music_dream"], smartsDelta: 2 }),
    opt("Refuse to practise", "You refused to practise. The instrument went to the attic.", { happinessDelta: 2 }),
  ], { once: true, requires: { flagsNone: ["music_dream"] } }),
  ev("school_play", "school", 6, 13, "The School Play", "The drama teacher is casting 'Hamlet: The Musical (Abridged)'.", [
    opt("Audition for the lead", "You nailed the audition and got the lead. The spotlight is warm.", { skillDeltas: { acting: 6 }, happinessDelta: 6, fameDelta: 1, setFlags: ["acting_dream"] }),
    opt("Take a tree role", "You were Tree #2. You gave it everything.", { skillDeltas: { acting: 2 }, happinessDelta: 2 }),
    opt("Run the lights", "You ran the lights from the booth. Nobody ruined your show but you.", { smartsDelta: 2 }),
  ], { once: true }),
  ev("playground_dare", "general", 7, 12, "The Dare", "A kid dares you to jump off the top of the slide.", [
    risk("Jump!", 0.6, ["You stuck the landing. The playground chanted your name.", { happinessDelta: 6, fameDelta: 1 }], ["You landed wrong and sprained your ankle.", { healthDelta: -8, happinessDelta: -3 }], "health"),
    opt("Walk away", "You walked away. You were called chicken for a week. You're still alive.", { happinessDelta: -2, smartsDelta: 1 }),
  ]),
  ev("stray_dog", "general", 6, 14, "Stray Dog", "A scruffy stray dog followed you home from school.", [
    opt("Convince your parents to keep it", "You pleaded your case with the skill of a lawyer. You have a dog now.", { happinessDelta: 10, karmaDelta: 4, addPet: "dog", relationshipDelta: { target: "Parent", delta: -2 } }),
    opt("Feed it and let it go", "You gave it a sandwich and waved goodbye.", { karmaDelta: 2, happinessDelta: 1 }),
    opt("Call animal control", "Animal control took the dog to a shelter. Hopefully it found a home.", { karmaDelta: 1 }),
  ], { once: true }),
  ev("friend_fight", "general", 8, 15, "Best Friends, Worst Enemies", "You and your best friend had a huge fight about who's cooler.", [
    opt("Apologize first", "You apologized first. Your friendship is stronger than ever.", { relationshipDelta: { target: "Friend", delta: 12 }, karmaDelta: 3 }),
    opt("Give them the silent treatment", "Neither of you spoke for months.", { relationshipDelta: { target: "Friend", delta: -15 }, happinessDelta: -4 }),
    opt("Start a rumor about them", "You started a nasty rumor. It spread fast. It will follow you.", { relationshipDelta: { target: "Friend", delta: -30 }, karmaDelta: -6, happinessDelta: 2 }),
  ], { requires: { hasFriend: true } }),
  ev("sports_team", "school", 8, 14, "Youth Sports", "Tryouts are this weekend. Which team will you try for?", [
    opt("Soccer", "You joined the soccer team and ran a lot.", { healthDelta: 6, happinessDelta: 4, skillDeltas: { athletics: 6 }, setFlags: ["athlete_dream"], addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
    opt("Basketball", "You joined the basketball team. Your jump shot was ugly but effective.", { healthDelta: 5, happinessDelta: 4, skillDeltas: { athletics: 6 }, setFlags: ["athlete_dream"], addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
    opt("Chess club instead", "You joined chess club and met your people.", { smartsDelta: 5, happinessDelta: 2, addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
  ], { once: true }),
  ev("video_games", "general", 8, 15, "Gaming Marathon", "A new video game dropped. The weekend is yours.", [
    opt("Play for 48 hours straight", "You played for 48 hours straight. You've never been happier or more tired.", { happinessDelta: 8, healthDelta: -4, smartsDelta: -1 }),
    opt("Play in moderation", "You played a few hours a day. Balanced and boring.", { happinessDelta: 3 }),
    opt("Skip the game and read", "You read three books over the weekend. Your teacher noticed.", { smartsDelta: 4 }),
  ]),
  ev("sleepover", "general", 8, 13, "Sleepover", "A friend invited you to a sleepover. They have a haunted-looking basement.", [
    opt("Tell ghost stories", "You scared everyone half to death. Nobody slept a wink.", { happinessDelta: 6, addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
    opt("Prank phone call", "You prank-called a random number. A grumpy grandpa threatened to call the cops.", { happinessDelta: 4, karmaDelta: -2 }),
    opt("Go to sleep early", "You fell asleep at 9pm. Your friends drew on your face.", { looksDelta: -1, happinessDelta: 1 }),
  ]),
  ev("lemonade_stand", "money", 7, 12, "Lemonade Stand", "It's a hot summer day. You've got a pitcher, some cups, and a dream.", [
    risk("Set up a lemonade stand", 0.65, ["You sold out by noon. A true mogul in the making.", { bankBalanceDelta: 45, smartsDelta: 2, happinessDelta: 4 }], ["It rained. Your lemonade turned to lemon-flavoured regret.", { bankBalanceDelta: -4, happinessDelta: -2 }]),
    opt("Sell it to the grumpy neighbour for double", "Your grumpy neighbour grumbled but paid. Price gouging works.", { bankBalanceDelta: 10, karmaDelta: -2 }),
    opt("Give it away for free", "You gave it away free. You made a lot of friends.", { karmaDelta: 4, happinessDelta: 5, addRelative: { relation: "Friend", ageOffset: [-1, 2] } }),
  ], { cooldown: 5 }),
  ev("found_wallet", "general", 8, 60, "Lost Wallet", "You found a fat wallet on the sidewalk. The ID inside says the owner lives nearby.", [
    opt("Return it with the cash intact", "You returned the wallet. The owner cried and gave you a reward.", { karmaDelta: 8, bankBalanceDelta: 50, happinessDelta: 5 }),
    opt("Keep the cash, toss the wallet", "You pocketed the cash. Guilt gnawed at you for weeks.", { karmaDelta: -8, bankBalanceDelta: 220, happinessDelta: -3 }),
    risk("Keep it all and spend it", 0.7, ["You spent it all on a huge shopping spree.", { karmaDelta: -10, bankBalanceDelta: 300, happinessDelta: 6 }], ["Security cameras caught you using the owner's card.", { karmaDelta: -10, arrest: { name: "Credit Card Fraud", description: "Cameras caught you using a stolen card at a department store.", years: 2, severity: "minor" } }]),
  ], { cooldown: 8, weight: 0.8 }),
  ev("chores", "family", 6, 14, "Chore Wars", "{mother} wants you to clean your room. It's a disaster zone.", [
    opt("Clean it properly", "You cleaned your room and found $5 under the bed.", { bankBalanceDelta: 5, relationshipDelta: { target: "Parent", delta: 6 }, karmaDelta: 1 }),
    opt("Shove everything in the closet", "You shoved everything in the closet. For now, it's clean.", { relationshipDelta: { target: "Parent", delta: 1 }, smartsDelta: 1 }),
    opt("Refuse", "You refused to clean it. You were grounded for a week.", { relationshipDelta: { target: "Parent", delta: -8 }, happinessDelta: -5 }),
  ], { requires: { parentAlive: true } }),
  ev("parents_argue", "family", 5, 16, "Thin Walls", "You overhear your parents arguing loudly about money.", [
    opt("Hide in your room", "You put on headphones and waited it out.", { happinessDelta: -4 }),
    opt("Try to calm them down", "You walked in and told them to stop. They did, shocked by your maturity.", { relationshipDelta: { target: "Parent", delta: 6 }, smartsDelta: 1, happinessDelta: -2 }),
    opt("Sneak out and go to a friend's", "You spent the night at a friend's house.", { happinessDelta: 2, relationshipDelta: { target: "Parent", delta: -3 } }),
  ], { requires: { parentAlive: true } }),
  ev("birthday_party", "general", 4, 12, "Birthday Bash", "It's your birthday! What kind of party do you want?", [
    opt("Pizza and laser tag", "Your friends loved the laser tag. Best. Birthday. Ever.", { happinessDelta: 10, relationshipDelta: { target: "Friend", delta: 6 } }),
    opt("A small family dinner", "You had a small, quiet dinner with the family. It was lovely.", { happinessDelta: 5, relationshipDelta: { target: "Parent", delta: 6 } }),
    opt("No party, just presents", "You opened your presents and went to bed early.", { happinessDelta: 3 }),
  ], { cooldown: 5 }),
  ev("teacher_crush", "school", 8, 12, "Teacher's Pet", "Your teacher is giving out extra credit.", [
    opt("Do the extra credit project", "You went all out on the extra credit project. Teacher called you \"a pleasure to teach\".", { smartsDelta: 4, happinessDelta: 2 }),
    opt("Skip it", "Why do extra homework? You went outside.", { happinessDelta: 3 }),
    opt("Bribe the teacher with an apple", "The teacher laughed. You got the extra credit anyway.", { smartsDelta: 1, karmaDelta: -1, happinessDelta: 2 }),
  ]),
];
