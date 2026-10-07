import { opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import { beat, begin, entry, fin, later, type Arc } from "./arcKit";

// ===========================================================================
// HEALTH: a scare, a choice and a long year
// ===========================================================================
const HEALTH: LifeEvent[] = [
  entry("health", "health_1", "health", 38, 74, "A Cough That Outstayed Its Welcome",
    "It started as a tickle in March. By June it was a cough with opinions. A shadow on a scan, an appointment card, and a doctor called {doctor} who says, in a very careful voice: 'I'd like to run a few more tests.'", [
      opt("Book the tests this week: $600", "Your hands only shook when you signed the form. Everyone says early is everything, and you want to believe them.",
        begin("health", later("health_result", 1, 1, { bankBalanceDelta: -600, happinessDelta: -3, setFlags: ["arc_health_early"] }))),
      opt("Take someone you trust along: $600", "Waiting rooms are better with someone beside you. You held a stranger's coffee while they filled in the forms.",
        begin("health", later("health_result", 1, 1, { bankBalanceDelta: -600, relationshipDelta: { target: "All", delta: 5 }, happinessDelta: -2, setFlags: ["arc_health_early"] }))),
      opt("Put it off: it's the busy season at work", "The cough got a little louder. The excuse got a little thinner. The calendar filled up politely.",
        begin("health", later("health_result_late", 1, 2, { performanceDelta: 4, happinessDelta: 1, setFlags: ["arc_health_ignored"] }))),
    ], { requires: { custom: (p) => !p.diseases.some((d) => d.id === "cancer" || d.id === "early_cancer") }, weight: 1.0 }),

  beat("health", "health_result", "health", 38, 82, "The Results",
    "It's early. 'Treatable,' says {doctor}, in the tone of someone who says it often and means it sometimes. A folder of leaflets, a list of options, and the dizzying sensation of being the main character in a story you didn't audition for.", [
      opt("Start treatment at once: $8,000", "A schedule, a hospital band and a stack of leaflets. You turned a frightening thing into a project, and that felt almost like control.",
        later("health_treatment", 1, 2, { bankBalanceDelta: -8000, diseaseTrigger: "early_cancer", happinessDelta: -5 })),
      risk("Try the miracle clinic everyone's talking about: $3,000", 0.3,
        ["Against all odds, the follow-up scan came back clear. You told everyone about the clinic, and gave their number to the wrong people.",
          fin("health", "clear", { bankBalanceDelta: -3000, happinessDelta: 8, healthDelta: 4, setFlags: ["health_survivor"] })],
        ["The clinic had a lovely lobby and a refund policy written in invisible ink. It cost you four months, and the condition got worse.",
          later("health_treatment", 1, 1, { bankBalanceDelta: -3000, diseaseTrigger: "cancer", happinessDelta: -8, healthDelta: -5 })]),
      risk("Get a second opinion first: $900", 0.5,
        ["Different hospital, different reading: benign, kept an eye on, nothing more. You cried in the car park, and then you laughed.",
          fin("health", "clear", { bankBalanceDelta: -900, happinessDelta: 8, setFlags: ["health_survivor"] })],
        ["The second opinion confirmed the first, kindly and at a cost.", later("health_treatment", 1, 1, { bankBalanceDelta: -900, diseaseTrigger: "early_cancer", happinessDelta: -5 })]),
    ], { requires: { flagsAll: ["arc_health_early"] } }),

  beat("health", "health_result_late", "health", 38, 86, "The Results, a Little Late",
    "The cough is a hospital stay now. {doctor} has a new expression that isn't professional calm. 'It's further along than I'd like,' they say. 'But there are options. Several. Let's go through them.'", [
      opt("Fight: aggressive treatment, $15,000", "Surgery, chemo, long hospital nights and a gallows sense of humour that served you well. You hadn't known it was so large.",
        later("health_treatment", 1, 2, { bankBalanceDelta: -15000, diseaseTrigger: "cancer", healthDelta: -6, happinessDelta: -6 })),
      opt("Choose comfort: a gentler course, and make the time count", "No miracles, and no pretending. You spent the next year saying everything that needed saying, to everyone who needed to hear it.",
        fin("health", "palliative", { diseaseTrigger: "cancer", healthDelta: -5, relationshipDelta: { target: "All", delta: 12 }, happinessDelta: 6, karmaDelta: 3 })),
    ], { requires: { flagsAll: ["arc_health_ignored"] } }),

  beat("health", "health_treatment", "health", 38, 88, "The Treatment Year",
    "Chemo on Tuesdays, nausea on Wednesdays, a casserole on every doorstep by Thursday. People you hadn't heard from in years suddenly appear with soup. Your days have become a calendar of other people's kindness, and you're not sure how to hold it.", [
      opt("Let people in. Accept every casserole and every hug", "It was harder than the chemo. You cried at a stranger's tuna bake, and recovered more quickly than the numbers said you would.",
        later("health_outcome", 1, 2, { relationshipDelta: { target: "All", delta: 8 }, happinessDelta: 2, healthDelta: -4, setFlags: ["arc_health_supported"] })),
      opt("Go it alone. You don't want pity", "You turned off your phone and pulled the curtains. Nobody argued. That, too, was somehow a verdict.",
        later("health_outcome", 1, 2, { healthDelta: -8, happinessDelta: -7, relationshipDelta: { target: "All", delta: -6 } })),
      opt("Treat it like a job: schedule, spreadsheet, no excuses", "Colour-coded appointments, a log of every pill and a ban on googling. The doctors called you 'the model patient', which was strange praise but not unwelcome.",
        later("health_outcome", 1, 2, { healthDelta: -5, happinessDelta: -2, smartsDelta: 1, performanceDelta: -5 })),
    ]),

  beat("health", "health_outcome", "health", 38, 90, "The Scan",
    "Tomorrow's the scan, the big one. You lie awake rehearsing both speeches, the thank-you and the goodbye. In the morning the sun comes up regardless, which is annoyingly reassuring.", [
      risk("Go in with someone holding your hand", 0.7,
        ["'Clear,' said {doctor}, and the room tilted. You were in remission. Somebody was crying very loudly in the corridor, and it was you.",
          fin("health", "remission", { cureAll: true, happinessDelta: 12, karmaDelta: 2, setFlags: ["health_survivor"] })],
        ["It was back. {doctor} said 'manageable' twice, and 'we'll fight it', and you nodded at all the right moments.",
          fin("health", "relapse", { healthDelta: -10, happinessDelta: -10 })], "health"),
      risk("Go in alone, to keep it simple", 0.6,
        ["'Clear.' You said thank you to the nurse and walked out in a fog. It took an hour to tell anyone.",
          fin("health", "remission", { cureAll: true, happinessDelta: 10, setFlags: ["health_survivor"] })],
        ["It was back. You took the bus home in a trance, stared at the ceiling and made tea you didn't drink.",
          fin("health", "relapse", { healthDelta: -10, happinessDelta: -12 })], "health"),
      opt("Refuse further treatment and take what time you have", "You shook {doctor}'s hand. It was a calm decision, and a calm few months. You made ordinary days look rather lovely.",
        fin("health", "stopped", { healthDelta: -10, happinessDelta: 4, relationshipDelta: { target: "All", delta: 8 }, karmaDelta: 2 })),
    ]),
];

// ===========================================================================
// NEIGHBOUR: the hedge, the war, the smoke
// ===========================================================================
const NEIGHBOUR: LifeEvent[] = [
  entry("neighbour", "neighbour_1", "general", 25, 76, "The Hedge",
    "Your neighbour {neighbour} has measured the hedge. With a ruler. A formal letter, on cream paper, now sits in your hall: 'Re: the boundary'. It uses the word 'encroachment' twice, and 'with regret' once, which is the most threatening thing in it.", [
      risk("Bring over a plate of cookies and an apology", 0.6,
        ["They accepted the cookies, then the apology, then a second cookie. By dusk you were sharing a bench. Something quiet and unlikely had started.",
          begin("neighbour", later("neighbour_friends", 2, 4, { happinessDelta: 3, karmaDelta: 2 }))],
        ["They declined the cookies, accepted the apology and measured again. You could hear the tape from the street.",
          begin("neighbour", later("neighbour_war", 1, 2, { happinessDelta: -2 }))]),
      opt("Reply with a stern letter", "You wrote four drafts, each more passive-aggressive than the last. The one you sent was the winner.",
        begin("neighbour", later("neighbour_war", 1, 2, { karmaDelta: -1, happinessDelta: -2 }))),
      opt("Ignore it, and let the hedge grow", "A whole summer of silent war: tall hedge, taller grudge. You weren't proud of how much you enjoyed it.",
        begin("neighbour", later("neighbour_war", 1, 2, { happinessDelta: 1, karmaDelta: -2 }))),
    ], { weight: 1.2 }),

  beat("neighbour", "neighbour_war", "general", 25, 82, "Escalation",
    "It's a prank war now, and nobody remembers who started it. Your bins have been rearranged by size, and their garden gnomes have been rearranged by rank. Last night, a floodlight appeared that points, with great precision, at your bedroom window.", [
      risk("Hire a surveyor: $2,500", 0.55,
        ["The survey found the hedge was yours by eleven centimetres. You framed the certificate. Nobody has spoken of it at a barbecue since.",
          later("neighbour_crisis", 2, 4, { bankBalanceDelta: -2500, karmaDelta: -1, happinessDelta: 2 })],
        ["The survey found the hedge was theirs by twelve centimetres. You paid for the privilege of being wrong.",
          later("neighbour_crisis", 2, 4, { bankBalanceDelta: -2500, happinessDelta: -5 })]),
      opt("Call a truce: invite them to a street barbecue: $200", "You stood in the road with a spatula, in full view of the street. {neighbour_first} took a burger and nodded. Not a handshake, but not a war.",
        later("neighbour_crisis", 2, 4, { bankBalanceDelta: -200, karmaDelta: 2, happinessDelta: 1 })),
      risk("Out-prank them: the Great Gnome Heist", 0.6,
        ["Forty gnomes, one midnight, a costume and a hand-drawn ransom note. The whole street loved it, and so, secretly, did {neighbour_first}.",
          later("neighbour_crisis", 2, 4, { happinessDelta: 6, karmaDelta: -3 })],
        ["A motion sensor, a bad hiding place and the police on the porch at 2am. It was the end of an era and the start of a caution.",
          later("neighbour_crisis", 2, 4, { bankBalanceDelta: -400, happinessDelta: -4, karmaDelta: -2 })]),
    ]),

  beat("neighbour", "neighbour_friends", "general", 26, 86, "The Fence Comes Down",
    "A year on, {neighbour_first} is a fixture: borrower of power tools, keeper of your spare key, ranker of your tomatoes. Today they lean over the fence: 'What if we took this down, and shared the garden?'", [
      opt("Share the garden: $500 for new beds", "Two sets of tomatoes, one barbecue, a bench made out of pallets. You'd never have guessed it, on the day of the ruler.",
        fin("neighbour", "friends", { bankBalanceDelta: -500, happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 6 }, karmaDelta: 2 })),
      opt("Keep the fence, but put in a gate", "A modest, sensible compromise. You use the gate more than you'd admit.",
        fin("neighbour", "cordial", { bankBalanceDelta: -150, happinessDelta: 3 })),
      opt("Politely say you value your privacy", "They nodded. It was a small, clean 'no', and the friendship stayed exactly the same, perhaps a notch cooler.",
        fin("neighbour", "cordial", { happinessDelta: 0, karmaDelta: 0 })),
    ]),

  beat("neighbour", "neighbour_crisis", "general", 27, 88, "Smoke",
    "At 3am you smell smoke. It's coming from next door. Through the window, you can see an orange glow in {neighbour}'s kitchen. A chip pan, probably. Possibly a person.", [
      risk("Break the door down and get them out", 0.75,
        ["You got them out with a blanket and a stubborn kind of luck. The fire brigade arrived to find two people in pyjamas on the lawn.",
          later("neighbour_thanks", 1, 2, { karmaDelta: 9, fameDelta: 2, healthDelta: -2, happinessDelta: 4 })],
        ["You got them out. You also picked up burns and a cracked rib you'd feel for months. It was worth it, though you'd never say so.",
          later("neighbour_thanks", 1, 2, { karmaDelta: 9, healthDelta: -10, happinessDelta: 3 })], "health"),
      opt("Call the fire brigade and wait on the pavement", "They came in six minutes. You pointed, shouted, held the hose. Practical and brave in a modest way.",
        later("neighbour_end", 1, 2, { karmaDelta: 2, happinessDelta: 1 })),
      opt("Stay in bed and assume someone else will call", "Nobody else did, as it turned out. The house didn't survive, and you didn't sleep for a month.",
        later("neighbour_end", 1, 2, { karmaDelta: -9, happinessDelta: -6 })),
    ]),

  beat("neighbour", "neighbour_thanks", "family", 27, 90, "A Parcel on the Doorstep",
    "A heavy parcel, wrapped in brown paper and a ridiculous amount of tape. Inside: a very old, very good fountain pen, a card that reads 'I measured it wrong', and a cheque for $3,000 'for the hedge, whichever of us is right'.", [
      opt("Keep the pen, tear up the cheque, and take them to dinner", "They protested through three courses and gave up at dessert. You keep the pen on your desk.",
        fin("neighbour", "friends", { karmaDelta: 4, happinessDelta: 8, bankBalanceDelta: -120, relationshipDelta: { target: "Friend", delta: 8 } })),
      opt("Accept it all graciously", "They looked relieved. A gift unaccepted is a debt unpaid, you decided, with only a little shame.",
        fin("neighbour", "friends", { bankBalanceDelta: 3000, happinessDelta: 6 })),
    ]),

  beat("neighbour", "neighbour_end", "general", 27, 90, "The Last Word",
    "A For Sale sign goes up next door. Six weeks later, new people arrive with a leaf blower, a trampoline and music that carries across the wall. You realise, with some surprise, that you miss the ruler.", [
      opt("Drop by with a plate of welcome cookies, anyway", "New neighbours, new chances. They were charming and loud. You've been told the hedge is fine.",
        fin("neighbour", "moved", { karmaDelta: 2, happinessDelta: 2 })),
      opt("Write {neighbour_first} a note: 'You were right about the hedge'", "A short, stupid note. The reply was a postcard from a sunny beach: 'I know.'",
        fin("neighbour", "moved", { karmaDelta: 3, happinessDelta: 4 })),
    ]),
];

// ===========================================================================
// MOVEMENT: a petition that grows legs
// ===========================================================================
const MOVEMENT: LifeEvent[] = [
  entry("movement", "movement_1", "general", 25, 74, "The Empty Lot",
    "The old library is scheduled for demolition. A developer's glossy brochure promises 'vibrant mixed-use space'. On the lamp-post outside, someone has taped a petition. It has three signatures, one of which is 'Mickey Mouse'. You stop and read it twice.", [
      opt("Organise a meeting and a petition drive", "You booked the church hall, made 400 leaflets and said 'we' for the first time in a very long time.",
        begin("movement", later("movement_meeting", 1, 1, { karmaDelta: 3, happinessDelta: 2, skillDeltas: { charisma: 2 }, setFlags: ["arc_movement_lead"] }))),
      opt("Donate $500 and sign", "A cheque and a signature. You told yourself that was how democracy works, and it was, partly.",
        begin("movement", later("movement_hearing", 1, 2, { bankBalanceDelta: -500, karmaDelta: 2, setFlags: ["arc_movement_donor"] }))),
      opt("Sign it, and get on with your day", "A signature in biro and a conscience marginally lighter. The brochure was glossy, and so were the machines on the following Monday.",
        fin("movement", "signed", { karmaDelta: 1 })),
    ], { requires: { custom: (p) => p.karma >= 45 }, weight: 0.9 }),

  beat("movement", "movement_meeting", "general", 25, 76, "Four Folding Chairs",
    "Forty people turn up for a meeting with four folding chairs. There is a long and spirited argument about the logo, three about the parking, and a retired teacher, {organizer}, who knows every councillor by their first name and their weakness.", [
      opt("Take charge and be the face of the campaign", "You made the speech and kept the microphone. The local paper called you 'the library lady' or 'the library chap'. You didn't mind.",
        later("movement_hearing", 1, 2, { fameDelta: 2, skillDeltas: { charisma: 2 }, happinessDelta: -1, setFlags: ["arc_movement_face"] })),
      opt("Team up with {organizer} and let them steer", "{organizer} had the contact book and a voice that could break glass. You carried the boxes and the morale.",
        later("movement_hearing", 1, 2, { karmaDelta: 3, happinessDelta: 2 })),
      risk("Launch a social media campaign", 0.5,
        ["A video of a child reading her last library book went viral. You got a call from the national news, and an unreasonable number of heart emojis.",
          later("movement_hearing", 1, 2, { fameDelta: 4, happinessDelta: 3, setFlags: ["arc_movement_viral"] })],
        ["The hashtag was hijacked by people selling crypto, and a man called 'Dave from Gloucester' with strong views on parking. It dented morale.",
          later("movement_hearing", 1, 2, { karmaDelta: -1, happinessDelta: -3 })]),
    ], { requires: { flagsAll: ["arc_movement_lead"] } }),

  beat("movement", "movement_hearing", "general", 25, 78, "The Council Chamber",
    "The chamber is full, the air is thick, and a man with a very expensive watch is clearing his throat on the other side. Three minutes each, strict timekeeping. The agenda says 'Item 7: Library Site'. Everyone knows that item 7 is the whole evening.", [
      risk("Speak for three minutes, straight from the heart", 0.5,
        ["You talked about your first library card and stopped, mid-sentence, and the whole chamber was holding its breath. Then someone started clapping.",
          later("movement_victory", 1, 1, { karmaDelta: 4, fameDelta: 2 })],
        ["You hit the buzzer at 'And so, in conclusion'. The vote went 6–5 against. The man in the watch shook your hand with real warmth.",
          later("movement_defeat", 1, 1, { happinessDelta: -4 })], "smarts"),
      risk("Fill the gallery with 300 supporters and a brass band: $1,500", 0.65,
        ["The brass band started on 'Item 7' and wouldn't stop. The council adjourned in confusion and voted in favour the next morning.",
          later("movement_victory", 1, 1, { bankBalanceDelta: -1500, fameDelta: 3, happinessDelta: 3 })],
        ["They voted anyway. It was the loudest defeat in the building's history.", later("movement_defeat", 1, 1, { bankBalanceDelta: -1500, happinessDelta: -4 })]),
      risk("Offer the developer a compromise: keep the façade", 0.5,
        ["The developer looked at the polling and decided they quite liked the idea of a historic façade. Everyone could win.",
          later("movement_victory", 1, 1, { karmaDelta: 2, happinessDelta: 3 })],
        ["The developer smiled and said, 'We'll take that under advisement'. They did, and demolished it the following week.", later("movement_defeat", 1, 1, { karmaDelta: -1, happinessDelta: -5 })], "smarts"),
    ]),

  beat("movement", "movement_victory", "fame", 25, 80, "The Library Stays",
    "The library is saved. There's cake, a plaque, a speech and a queue of strangers who tell you what it meant. Your phone rings with other causes, other lots, other libraries. Somebody says the word 'movement', and several others say 'council seat'.", [
      opt("Run for the council: $4,000", "Posters, doorsteps and a lot of tea. You lost by eleven votes and became a local celebrity.",
        fin("movement", "councillor", { bankBalanceDelta: -4000, fameDelta: 5, karmaDelta: 3, happinessDelta: 5 })),
      opt("Set up a foundation for community spaces: $2,000", "A charity number, a leaflet and a very patient accountant. The first grant went to a community garden.",
        fin("movement", "foundation", { bankBalanceDelta: -2000, karmaDelta: 8, happinessDelta: 6 })),
      opt("Take a bow and go home", "A cup of tea, a very tired dog and a satisfied sigh. The movement could manage without you.",
        fin("movement", "hero", { happinessDelta: 4, fameDelta: 1, karmaDelta: 2 })),
    ], { requires: { flagsAll: ["arc_movement"] } }),

  beat("movement", "movement_defeat", "general", 25, 80, "The Wrecking Ball",
    "A yellow machine swings on a Tuesday morning. A small crowd watches the wall go, brick by brick. Somebody is quietly crying; somebody else holds up a phone. You find you're holding a half-eaten sandwich you can't remember making.", [
      risk("Chain yourself to the next building on the list", 0.4,
        ["You and fifteen others stayed for three days. The story went national, the developer blinked and the next building was saved.",
          fin("movement", "regrouped", { karmaDelta: 6, fameDelta: 3, happinessDelta: 4 })],
        ["You were removed by two polite officers and issued with a charge you never wanted. It made the evening news, though not as you'd hoped.",
          fin("movement", "arrested", { arrest: { name: "Trespass and Obstruction", description: "Chained to a building scheduled for demolition. Principled, loud and technically illegal.", years: 1, severity: "minor" }, karmaDelta: 4, fameDelta: 2, happinessDelta: -3 })]),
      opt("Turn the energy into a community garden on the cleared site", "A temporary licence, a hundred volunteers and an awful lot of compost. It grew, in every sense.",
        fin("movement", "regrouped", { karmaDelta: 6, happinessDelta: 4, bankBalanceDelta: -600 })),
      opt("Step back. You gave it everything you had", "You folded the banner, put it in the loft and let go. It took a long time to stop checking the news.",
        fin("movement", "defeated", { happinessDelta: -6, karmaDelta: 1 })),
    ]),
];

export const LIFE_ARC_EVENTS: LifeEvent[] = [...HEALTH, ...NEIGHBOUR, ...MOVEMENT];

export const LIFE_ARCS: Arc[] = [
  {
    id: "health", title: "A Health Scare", emoji: "🩺", start: "You're waiting on test results.",
    stages: [
      { flag: "arc_health_early", text: "You caught it early. Treatment is next." },
      { flag: "arc_health_ignored", text: "You put it off. It hasn't gone away." },
      { flag: "arc_health_supported", text: "You're in treatment, with people around you." },
    ],
  },
  {
    id: "neighbour", title: "The Neighbour", emoji: "🏘️", start: "{neighbour} next door has Opinions about your hedge.",
    stages: [],
  },
  {
    id: "movement", title: "Save the Library", emoji: "📚", start: "A cause is growing around you.",
    stages: [
      { flag: "arc_movement_lead", text: "You're leading a campaign to save the old library." },
      { flag: "arc_movement_donor", text: "You backed the library campaign with a donation." },
      { flag: "arc_movement_face", text: "You're the public face of the library campaign." },
      { flag: "arc_movement_viral", text: "The library campaign has gone viral." },
    ],
  },
];
