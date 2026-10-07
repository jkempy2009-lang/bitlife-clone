import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

// Adolescence (13-17)
export const TEEN_EVENTS: LifeEvent[] = [
  ev("learn_to_drive", "general", 16, 17, "Behind the Wheel", "You're old enough to learn to drive. How will you do it?", [
    opt("Enrol in driver's ed ($300)", "You passed driver's ed with flying colours. License in hand!", { bankBalanceDelta: -300, smartsDelta: 2, setFlags: ["license"], happinessDelta: 8 }),
    risk("Have a parent teach you", 0.75, ["{father} taught you in an empty parking lot. You passed your test first try!", { setFlags: ["license"], happinessDelta: 8, relationshipDelta: { target: "Parent", delta: 8 } }], ["You failed the test after rolling through a stop sign. Humbling.", { happinessDelta: -4, relationshipDelta: { target: "Parent", delta: -3 } }]),
    risk("Teach yourself in secret", 0.4, ["You taught yourself with a borrowed car. No one noticed. Remarkable.", { setFlags: ["license"], happinessDelta: 10, karmaDelta: -2 }], ["You crashed into the neighbour's mailbox and were caught on a doorbell camera.", { healthDelta: -5, bankBalanceDelta: -250, relationshipDelta: { target: "Parent", delta: -10 }, karmaDelta: -3 }]),
  ], { once: true, requires: { flagsNone: ["license"] }, weight: 3 }),
  ev("high_school_romance", "romance", 14, 18, "Butterflies", "Someone in your class keeps smiling at you in the hallway.", [
    risk("Ask them out", 0.55, ["They said yes! Your first relationship begins.", { happinessDelta: 10, addRelative: { relation: "Partner", ageOffset: [-1, 1], partnerStatus: "dating" } }], ["They laughed and said no. Your ego needs ice.", { happinessDelta: -8 }], "looks"),
    opt("Write an anonymous love note", "You slipped a note in their locker. They found out. It was sweet.", { happinessDelta: 6, addRelative: { relation: "Partner", ageOffset: [-1, 1], partnerStatus: "dating" } }),
    opt("Stay single and focus on friends", "You focused on your friends and your studies.", { smartsDelta: 2, relationshipDelta: { target: "Friend", delta: 4 } }),
  ], { requires: { hasPartner: false }, cooldown: 2, weight: 2 }),
  ev("prom", "romance", 16, 18, "Prom Night", "Prom is coming. The dress code is 'regret later'.", [
    opt("Go with your partner", "You and {partner} danced all night. A magical evening.", { happinessDelta: 10, relationshipDelta: { target: "Partner", delta: 12 }, bankBalanceDelta: -50 }),
    opt("Go with friends", "You went with friends and danced badly together. Perfect.", { happinessDelta: 8, relationshipDelta: { target: "Friend", delta: 6 }, bankBalanceDelta: -30 }),
    opt("Skip it", "You spent the night with a movie. Nobody missed you, probably.", { happinessDelta: -2 }),
  ], { once: true }),
  ev("peer_drugs", "crime", 14, 18, "Peer Pressure", "At a party, someone passes you something questionable.", [
    risk("Try it", 0.55, ["You tried it and felt great. Now you're curious for more…", { happinessDelta: 6, healthDelta: -4, karmaDelta: -2 }], ["You felt awful and ended up in the hospital. Your parents were furious.", { healthDelta: -12, happinessDelta: -8, relationshipDelta: { target: "Parent", delta: -12 }, bankBalanceDelta: -300 }], "health"),
    opt("Say no and leave", "You said no and went home. You were proud of yourself the next morning.", { karmaDelta: 4, smartsDelta: 1 }),
    opt("Report it to a teacher", "You reported it. You're now a social pariah — and safe.", { karmaDelta: 6, happinessDelta: -5, relationshipDelta: { target: "Friend", delta: -10 } }),
  ], { cooldown: 4 }),
  ev("teen_job", "money", 15, 17, "Summer Job", "A local business is hiring teenagers for the summer.", [
    opt("Take the job", "You worked all summer and saved $1,200. Responsibility is exhausting.", { bankBalanceDelta: 1200, smartsDelta: 1, happinessDelta: -1 }),
    opt("Start a mowing business", "You mowed lawns around the neighbourhood. $800 and a sunburn.", { bankBalanceDelta: 800, healthDelta: 2, looksDelta: -1 }),
    opt("Relax all summer", "You lounged around all summer. Zero regrets.", { happinessDelta: 7 }),
  ], { cooldown: 2 }),
  ev("viral_post", "fame", 13, 30, "Going Viral", "A video of you doing something silly is blowing up online.", [
    opt("Lean into it", "You posted follow-ups and leaned into the attention. You've got a following!", { fameDelta: 8, happinessDelta: 8, skillDeltas: { charisma: 2 } }),
    opt("Delete everything", "You deleted the video. The Internet remembers, but you're calm.", { happinessDelta: -2, karmaDelta: 1 }),
    risk("Cash in with a sponsorship", 0.5, ["A brand paid you $2,000 for a shout-out. Easy money.", { fameDelta: 5, bankBalanceDelta: 2000, happinessDelta: 5 }], ["The brand was a scam. Followers lost faith.", { fameDelta: -2, happinessDelta: -5 }]),
  ], { cooldown: 4 }),
  ev("skip_class", "school", 13, 18, "Cutting Class", "The weather's beautiful and chemistry is awful.", [
    risk("Skip and go to the park", 0.6, ["You spent the day at the park. Nobody noticed.", { happinessDelta: 6 }], ["The principal caught you. Detention for a month.", { happinessDelta: -4, relationshipDelta: { target: "Parent", delta: -6 }, smartsDelta: -1 }]),
    opt("Go to class", "You went to class. Chemistry was OK, actually.", { smartsDelta: 3 }),
  ], { cooldown: 3 }),
  ev("acne", "health", 13, 17, "Puberty Strikes", "A mountain range of pimples has appeared on your face.", [
    opt("Buy expensive skincare ($100)", "The skincare routine worked wonders.", { bankBalanceDelta: -100, looksDelta: 2, happinessDelta: 3 }),
    opt("Pop them all", "You popped them all. Scars were the result.", { looksDelta: -4, happinessDelta: -2 }),
    opt("Embrace the pimples", "You rocked it with confidence. Confidence is attractive.", { happinessDelta: 3, looksDelta: -1, karmaDelta: 1 }),
  ], { once: true }),
  ev("rebel_phase", "family", 13, 17, "Rebel Without a Cause", "You're in a bad mood and everyone is annoying.", [
    opt("Slam your bedroom door", "The door slammed. It rattled the whole house.", { relationshipDelta: { target: "Parent", delta: -6 }, happinessDelta: 2 }),
    opt("Dye your hair neon green", "Your hair is now neon green. Your parents are not amused.", { looksDelta: -1, happinessDelta: 6, relationshipDelta: { target: "Parent", delta: -4 } }),
    opt("Write angry poetry", "You wrote heartfelt, deeply cringey poems. Art!", { smartsDelta: 2, happinessDelta: 3, skillDeltas: { acting: 1 } }),
  ], { requires: { parentAlive: true }, cooldown: 4 }),
  ev("sports_tryout", "school", 13, 17, "Varsity Tryout", "The varsity coach is watching you at tryouts.", [
    risk("Give it everything", 0.5, ["You made the varsity team! Teammates are already calling you 'Ace'.", { healthDelta: 5, happinessDelta: 8, fameDelta: 2, looksDelta: 2 }], ["You pulled a hamstring on the first drill.", { healthDelta: -6, happinessDelta: -5 }], "health"),
    opt("Skip tryouts", "You went home. Maybe next year.", { happinessDelta: -1 }),
  ], { cooldown: 3 }),
  ev("form_band", "fame", 13, 19, "Garage Band", "Your friends want to start a band. You'd play the lead.", [
    opt("Start the band", "You started a band called 'The Detentions'. Your first gig was your friend's birthday party.", { skillDeltas: { music: 8 }, setFlags: ["music_dream"], happinessDelta: 8 }),
    opt("Join as a roadie", "You hauled amps and learned everything about live sound.", { skillDeltas: { music: 3 }, happinessDelta: 3 }),
    opt("Decline", "You said no. They found another singer.", { happinessDelta: -1 }),
  ], { once: true }),
  ev("drama_club", "school", 13, 17, "Drama Club", "The drama club is looking for new members.", [
    opt("Join and aim for the lead", "You joined drama and landed leads in two productions.", { skillDeltas: { acting: 8 }, setFlags: ["acting_dream"], happinessDelta: 6 }),
    opt("Join the stage crew", "You built sets and learned a lot about teamwork.", { smartsDelta: 2, happinessDelta: 3 }),
    opt("Not interested", "You said no and went home to play video games.", {}),
  ], { once: true }),
  ev("school_hack", "crime", 14, 18, "Grade Tampering", "You've found a way into the school's grade system.", [
    risk("Change your grades", 0.5, ["You gave yourself straight A's. Nobody noticed.", { smartsDelta: -1, karmaDelta: -6, happinessDelta: 5 }], ["The IT department caught you. Expelled for a semester.", { karmaDelta: -6, happinessDelta: -10, arrest: { name: "Juvenile Computer Tampering", description: "The school reported your intrusion into its grading system to the police.", years: 1, severity: "minor" } }], "smarts"),
    opt("Report the vulnerability", "You reported the hole in the system. The school gave you a certificate.", { karmaDelta: 6, smartsDelta: 3, happinessDelta: 3 }),
    opt("Ignore it", "You closed the laptop and went to bed.", {}),
  ], { once: true, requires: { minStat: { smarts: 65 } } }),
  ev("curfew", "family", 14, 17, "Past Curfew", "A friend's party is raging. Your curfew was an hour ago.", [
    risk("Stay at the party", 0.55, ["You stayed until dawn and sneaked in unnoticed.", { happinessDelta: 8 }], ["{mother} was waiting in the kitchen. You're grounded for a month.", { relationshipDelta: { target: "Parent", delta: -10 }, happinessDelta: -6 }]),
    opt("Go home on time", "You went home like a good kid. Your parents trust you.", { relationshipDelta: { target: "Parent", delta: 5 }, happinessDelta: -2 }),
  ], { requires: { parentAlive: true } }),
  ev("cyberbully", "school", 13, 17, "Group Chat Drama", "Someone is being nasty about a classmate in the group chat.", [
    opt("Defend the classmate", "You stood up for them. The group chat turned on you for a week, but the classmate is grateful.", { karmaDelta: 6, happinessDelta: -2, addRelative: { relation: "Friend", ageOffset: [-1, 1] } }),
    opt("Join in", "You piled on. It felt fun until you saw their face at school.", { karmaDelta: -8, happinessDelta: -3 }),
    opt("Mute the chat", "You muted the chat and went outside.", { karmaDelta: -1 }),
  ], { cooldown: 5 }),
  ev("sat_prep", "school", 16, 18, "Exam Season", "College entrance exams are coming up.", [
    opt("Study like crazy", "You hit the books hard. You aced the exam.", { smartsDelta: 5, happinessDelta: -3 }),
    opt("Hire a tutor ($500)", "The tutor was worth every penny.", { bankBalanceDelta: -500, smartsDelta: 4 }),
    opt("Wing it", "You winged it. It went about as well as expected.", { happinessDelta: 3, smartsDelta: -1 }),
  ], { once: true }),
  ev("fake_id", "crime", 16, 19, "Fake ID", "A kid at school sells convincing fake IDs for $80.", [
    risk("Buy one", 0.65, ["The ID works like a charm. Welcome to the nightlife.", { bankBalanceDelta: -80, happinessDelta: 5, karmaDelta: -3 }], ["It was confiscated at the first bar and you were arrested.", { bankBalanceDelta: -80, karmaDelta: -4, arrest: { name: "Possession of Forged ID", description: "A bouncer called the police when your fake ID scanned as invalid.", years: 1, severity: "minor" } }]),
    opt("Pass", "You decided not to risk it.", { karmaDelta: 1 }),
  ], { once: true }),
  ev("scholarship", "school", 16, 18, "Scholarship Offer", "A local foundation offers an academic scholarship to one applicant.", [
    risk("Apply with a killer essay", 0.45, ["You won the scholarship! Tuition just got cheaper.", { bankBalanceDelta: 5000, smartsDelta: 3, happinessDelta: 10 }], ["You didn't win. Rejection letters sting.", { happinessDelta: -4 }], "smarts"),
    opt("Skip the paperwork", "You couldn't be bothered with another application.", {}),
  ], { once: true, requires: { minStat: { smarts: 50 } } }),
  ev("teen_heartbreak", "romance", 14, 19, "Heartbreak", "{partner} wants to talk. Uh-oh.", [
    opt("Let them go", "You said goodbye gracefully. It hurt, but you'll be fine.", { happinessDelta: -8, endRelationship: "breakup", karmaDelta: 1 }),
    opt("Beg them to stay", "You begged. They stayed out of pity. It didn't feel great.", { happinessDelta: -4, relationshipDelta: { target: "Partner", delta: -10 } }),
    opt("Break up with them first", "You got there first. Petty but effective.", { happinessDelta: -3, endRelationship: "breakup", karmaDelta: -2 }),
  ], { requires: { hasPartner: true, maxStat: { happiness: 90 } }, cooldown: 3, weight: 0.6 }),
  ev("first_party", "general", 14, 17, "House Party", "Someone's parents are out of town. The party is on.", [
    opt("Be the life of the party", "You were everywhere, doing everything. Legend status!", { happinessDelta: 8, fameDelta: 1, healthDelta: -2, skillDeltas: { charisma: 2 } }),
    risk("Drink too much", 0.5, ["You woke up on a couch with a funny story.", { happinessDelta: 4, healthDelta: -2 }], ["You threw up on the host's rug. You're never invited again.", { happinessDelta: -8, relationshipDelta: { target: "Friend", delta: -8 }, healthDelta: -3 }]),
    opt("Leave early", "You left early with your dignity intact.", { happinessDelta: 1 }),
  ], { cooldown: 3 }),
  ev("teen_vandalism", "crime", 13, 17, "Spray Paint", "Your friends found a wall begging for graffiti.", [
    risk("Tag the wall", 0.65, ["You tagged the wall without getting caught. Street cred acquired.", { happinessDelta: 6, karmaDelta: -4, skillDeltas: { acting: 1 } }], ["A police car rolled up mid-tag.", { karmaDelta: -4, arrest: { name: "Vandalism", description: "You were caught spray-painting a public wall.", years: 1, severity: "minor" } }]),
    opt("Paint a legal mural", "You painted a beautiful mural with permission. The town loved it.", { karmaDelta: 4, happinessDelta: 6, fameDelta: 1 }),
    opt("Go home", "Not worth the risk.", {}),
  ], { once: true }),
];
