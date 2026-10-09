/**
 * Choices inside the family and the circle around you: teenagers who test you, grown children who need you,
 * friends in crisis, in-laws, an ex you still have to co-parent with. Who the person is (their temperament, how
 * warm they are, how close you've been) decides how a choice lands, and every choice leaves a memory behind.
 */
import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState, Relative } from "@/types/game.types";
import { clamp } from "@/lib/format";
import { getPartner } from "@/engine/state";
import { bestFriendOf, coParentOf, grownOf, inLawOf, littleOf, teenOf } from "@/engine/cast";
import { addGrievance, remember } from "@/engine/bonds";
import { temperamentOf } from "@/engine/parenting";

const bump = (r: Relative | undefined, d: number) => {
  if (r) r.relationshipBar = clamp(r.relationshipBar + d);
};
const first = (r: Relative) => r.name.split(" ")[0];
const DEFIANT = ["bold", "stubborn", "mischievous"];
const TENDER = ["shy", "sensitive", "gentle"];
const temper = (k: Relative) => temperamentOf(k).id;
const trouble = (k: Relative, n = 1) => {
  k.trouble = (k.trouble ?? 0) + n;
};



const bestOk = (p: PlayerState) => {
  const b = bestFriendOf(p);
  return !!b && b.relationshipBar >= 50;
};

// ===========================================================================
// Teenagers
// ===========================================================================
const TEENS: LifeEvent[] = [
  ev("rel_teen_curfew", "family", 26, 75, "Home by Midnight",
    "{teen} wants to go to a party across town that finishes well after midnight. Everyone else is going, apparently. Everyone else's parents are apparently fine with it.", [
      {
        text: "Say no, firmly",
        effects: {
          logText: "You said no, and meant it. The discussion did not end there.",
          bizEffect: (p) => {
            const k = teenOf(p);
            if (!k) return;
            const t = temper(k);
            if (DEFIANT.includes(t)) { bump(k, -10); trouble(k); return `${first(k)} slammed the door, and at midnight a window opened quietly. You found out in the morning.`; }
            if (TENDER.includes(t)) { bump(k, -3); return `${first(k)} went quiet and obeyed, and the silence at dinner lasted a week.`; }
            bump(k, -4);
            return `${first(k)} grumbled, then drew up a case for a later curfew next year.`;
          },
        },
      },
      {
        text: "Negotiate: home by eleven, a text on arrival",
        effects: {
          logText: "You haggled it down to eleven and a text from the door. It felt like a treaty.",
          bizEffect: (p, rng) => {
            const k = teenOf(p);
            if (!k) return;
            const ok = rng.chance(DEFIANT.includes(temper(k)) ? 0.55 : 0.82);
            if (ok) { bump(k, 6); remember(p, k, "joy", `${first(k)} kept to the deal you made about the party.`); return `${first(k)} was home at 10:55 and texted from the doorstep. Trust, it turns out, is built in small deliveries.`; }
            bump(k, -3); trouble(k);
            return `${first(k)} turned up at 1am, apologetic, with a very good excuse. You believed about half of it.`;
          },
        },
      },
      {
        text: "Let them go, no conditions",
        effects: {
          logText: "You said yes and tried not to watch the clock.",
          bizEffect: (p, rng) => {
            const k = teenOf(p);
            if (!k) return;
            bump(k, 8);
            if (rng.chance(DEFIANT.includes(temper(k)) ? 0.5 : 0.18)) { trouble(k); p.bankBalance = Math.max(0, p.bankBalance - 400); return `It went badly: a broken window, an angry neighbour, and ${first(k)} sheepish at 3am. It cost $400 to smooth over.`; }
            return `${first(k)} had the best night of their year and told you the whole thing at breakfast.`;
          },
        },
      },
    ], { requires: { custom: (p) => !!teenOf(p) && teenOf(p)!.age >= 14 }, cooldown: 4 }),

  ev("rel_teen_phone", "family", 26, 75, "The Glowing Rectangle",
    "{teen} hasn't looked up from a phone since Tuesday. Grades are slipping, and the one time you asked a question you got a shrug and a sigh.", [
      opt("Confiscate it for a month", "You took the phone. The house became very quiet and very tense.", {
        bizEffect: (p) => {
          const k = teenOf(p);
          if (!k) return;
          if (DEFIANT.includes(temper(k))) { bump(k, -9); return `${first(k)} stopped speaking to you for days, then found ways round it on a friend's phone.`; }
          bump(k, -4); k.smarts = clamp(k.smarts + 3);
          return `${first(k)} sulked, then, astonishingly, picked up a book. Marks improved.`;
        },
      }),
      opt("Agree rules together: no phones at dinner or after ten", "You wrote the rules together, you included. It was oddly fair.", {
        bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, 4); k.smarts = clamp(k.smarts + 1); return `${first(k)} stuck to it, mostly, and you stuck to it too, which was the harder part.`; },
      }),
      opt("Leave them to it", "You let it go. Everyone's life is on that screen now, you told yourself.", {
        happinessDelta: 1,
        bizEffect: (p) => { const k = teenOf(p); if (!k) return; k.smarts = clamp(k.smarts - 3); bump(k, -2); return `${first(k)}'s marks slid, and you felt the distance grow.`; },
      }),
    ], { requires: { custom: (p) => !!teenOf(p) && teenOf(p)!.age <= 16 }, cooldown: 5 }),

  ev("rel_teen_grades", "family", 26, 75, "A Bad Report",
    "{teen}'s school report arrives in a plain brown envelope. Two Fs, a note about 'potential', and a teacher's request to come in.", [
      {
        text: "Hire a tutor ($1,200)",
        effects: { logText: "You booked a tutor and cleared the kitchen table.", bankBalanceDelta: -1200, bizEffect: (p) => { const k = teenOf(p); if (!k) return; k.smarts = clamp(k.smarts + 5); bump(k, TENDER.includes(temper(k)) ? 4 : 1); return `${first(k)} improved steadily, and a bit of confidence came back with the grades.`; } },
      },
      {
        text: "Lay down the law: no fun until grades are up",
        effects: {
          logText: "You said no social life until the marks improved.",
          bizEffect: (p) => {
            const k = teenOf(p);
            if (!k) return;
            const t = temper(k);
            if (t === "driven") { k.smarts = clamp(k.smarts + 4); bump(k, -2); return `${first(k)} took it as a challenge and was top of the class by spring.`; }
            if (TENDER.includes(t)) { bump(k, -12); k.smarts = clamp(k.smarts + 1); return `${first(k)} cried in their room and stopped talking to you. The marks barely moved.`; }
            bump(k, -8); trouble(k);
            return `${first(k)} stopped trying and started skipping lessons. You won the argument and lost the child, a little.`;
          },
        },
      },
      {
        text: "Sit with them and ask what's really going on",
        effects: {
          logText: "You asked what was going on, and waited.",
          bizEffect: (p, rng) => {
            const k = teenOf(p);
            if (!k) return;
            bump(k, 7);
            if (rng.chance(0.55)) { k.smarts = clamp(k.smarts + 3); k.trouble = Math.max(0, (k.trouble ?? 0) - 1); remember(p, k, "kindness", `${first(k)} finally told you what was wrong at school.`); return `It came out slowly: a friendship that ended, a teacher who frightened them. Naming it helped more than any lecture.`; }
            return `${first(k)} shrugged and said "nothing", but pulled you into a hug on the way out. A start.`;
          },
        },
      },
    ], { requires: { custom: (p) => !!teenOf(p) && teenOf(p)!.age >= 13 }, cooldown: 5 }),

  ev("rel_teen_coming_out", "family", 35, 75, "I Need to Tell You Something",
    "{teen} has been rehearsing this on the stairs for ten minutes. Then, quickly, as if pulling off a plaster: they're gay. They're watching your face very carefully.", [
      {
        text: "Hold them. \"Nothing changes. I love you.\"",
        effects: {
          logText: "You pulled them into a hug and said the only true thing: nothing changes.",
          happinessDelta: 3,
          karmaDelta: 3,
          bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, 15); remember(p, k, "milestone", `${first(k)} told you who they are, and you held them.`); return `${first(k)} cried with relief. They'd been terrified for years. It will be one of the moments they tell their own children about.`; },
        },
      },
      {
        text: "Say you need time to take it in",
        effects: {
          logText: "You said you needed time. It was honest, and it landed badly.",
          happinessDelta: -3,
          bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, -5); addGrievance(p, k, "fight", 1, "the way you reacted when they came out"); return `${first(k)} nodded and went to their room. You can still make this right, but they will remember how long it took you to say the words.`; },
        },
      },
      {
        text: "Tell them it's probably a phase",
        effects: {
          logText: "You said it was probably a phase. The look on their face said it all.",
          happinessDelta: -5,
          karmaDelta: -3,
          bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, -22); addGrievance(p, k, "betrayal", 3, "what you said when they came out"); remember(p, k, "betrayal", `${first(k)} trusted you with the truth, and you dismissed it.`); return `${first(k)} stopped confiding in you that night. Mending this will take real work, and an honest apology.`; },
        },
      },
    ], { requires: { custom: (p) => !!teenOf(p) && teenOf(p)!.age >= 14 }, once: true, weight: 0.5 }),

  ev("rel_teen_college", "family", 36, 60, "Who Pays for University?",
    "{teen} has an offer from a good university. The tuition letter is on the fridge. So is a very hopeful drawing of the campus.", [
      {
        text: "Cover it all ($25,000)",
        effects: { logText: "You wrote the cheque and called it an investment.", bankBalanceDelta: -25000, karmaDelta: 2, bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, 9); k.traits = [...(k.traits ?? []), "College fund"]; remember(p, k, "kindness", `You paid for ${first(k)}'s university.`); return `${first(k)} hugged you hard and didn't say anything, which is how you knew.`; } },
      },
      {
        text: "Pay half; they work for the rest ($12,000)",
        effects: { logText: "You split it: half from you, half from summer jobs.", bankBalanceDelta: -12000, bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, 4); k.traits = [...(k.traits ?? []), "College fund"]; return `${first(k)} took it seriously and kept every receipt.`; } },
      },
      {
        text: "They'll have to find their own way",
        effects: { logText: "You told them it was theirs to work out.", happinessDelta: 1, bizEffect: (p) => { const k = teenOf(p); if (!k) return; bump(k, TENDER.includes(temper(k)) ? -9 : -4); k.smarts = clamp(k.smarts + 1); return `${first(k)} nodded politely. They'll manage, but a door closed a little.`; } },
      },
    ], { requires: { custom: (p) => !!teenOf(p) && teenOf(p)!.age >= 16 && teenOf(p)!.smarts >= 45 && !(teenOf(p)!.traits ?? []).includes("College fund") }, once: true }),

  ev("rel_kid_bullied", "family", 26, 75, "A Quiet Child",
    "{kid} has stopped talking about school. Tonight they won't eat, and a lunchbox came home untouched for the third day.", [
      {
        text: "Go to the school and demand action",
        effects: { logText: "You marched into the head's office. Things were done.", bizEffect: (p, rng) => { const k = littleOf(p); if (!k) return; bump(k, 6); if (rng.chance(0.6)) return `The bullying stopped within the month. ${first(k)} walked taller.`; trouble(k); return `The school promised a lot and did little. ${first(k)} felt exposed by the fuss.`; } },
      },
      {
        text: "Teach them to stand up for themselves",
        effects: { logText: "You practised what to say, over and over, until it sounded natural.", bizEffect: (p) => { const k = littleOf(p); if (!k) return; const t = temper(k); if (t === "bold" || t === "stubborn" || t === "driven") { bump(k, 5); return `${first(k)} stood up to the bully on Thursday. It worked, which surprised everyone.`; } bump(k, 2); return `${first(k)} tried, but it was never their way. It helped a little.`; } },
      },
      {
        text: "Move them to a new school ($3,000)",
        effects: { logText: "You moved them to a new school and a fresh start.", bankBalanceDelta: -3000, bizEffect: (p) => { const k = littleOf(p); if (!k) return; bump(k, 8); k.smarts = clamp(k.smarts + 2); return `${first(k)} made two friends in the first week and laughed out loud at dinner. You'd forgotten the sound.`; } },
      },
    ], { requires: { custom: (p) => !!littleOf(p) && littleOf(p)!.age >= 7 }, cooldown: 6 }),
];

// ===========================================================================
// Grown children
// ===========================================================================
const GROWN: LifeEvent[] = [
  ev("rel_grown_broke", "family", 42, 80, "Can You Help?",
    "{grownchild} is calling, which is how you know it's about money. A job fell through, the rent is due, and the pride in their voice is clearly costing them.", [
      {
        text: "Give them $4,000, no strings",
        effects: { logText: "You sent $4,000 and told them not to mention it again.", bankBalanceDelta: -4000, karmaDelta: 3, bizEffect: (p) => { const k = grownOf(p); if (!k) return; bump(k, 10); remember(p, k, "kindness", `You helped ${first(k)} when they were at their lowest.`); return `${first(k)} was too choked up to say much.`; } },
      },
      {
        text: "Lend $4,000 and agree a plan to repay it",
        effects: { logText: "You lent them $4,000 on a handshake and a spreadsheet.", bankBalanceDelta: -4000, bizEffect: (p) => { const k = grownOf(p); if (!k) return; bump(k, 5); p.flags.push(`lent:${k.id}:4000:${p.year}`); return `${first(k)} promised to pay it back, and sounded like they meant it.`; } },
      },
      {
        text: "Let them move back for a while",
        effects: { logText: "You cleared the spare room and put a duvet on the bed.", happinessDelta: -3, bizEffect: (p) => { const k = grownOf(p); if (!k) return; bump(k, 12); remember(p, k, "kindness", `${first(k)} moved back home for a while.`); return `The house is louder, the fridge is emptier, and ${first(k)} laughs in the kitchen again. A year of this will test you both.`; } },
      },
      {
        text: "Say no. They have to stand on their own",
        effects: { logText: "You said no, gently. It was one of the hardest things you've said.", happinessDelta: -2, bizEffect: (p) => { const k = grownOf(p); if (!k) return; bump(k, -12); addGrievance(p, k, "neglect", 1, "the time you said no when they asked for help"); return `${first(k)} said "I understand" in the tone of someone who didn't.`; } },
      },
    ], { requires: { custom: (p) => !!grownOf(p) && grownOf(p)!.age <= 38 }, cooldown: 7 }),

  ev("rel_grown_distance", "family", 40, 90, "A Long Silence",
    "It's been months since {grownchild} called. You've drafted three texts and deleted them all. The last conversation ended with a pause that went on for a very long time.", [
      {
        text: "Write the letter you should have written years ago",
        effects: { logText: "You wrote it by hand, and it took four tries to be honest.", bizEffect: (p, rng) => { const k = grownOf(p); if (!k) return; const g = (k.grievances ?? []).length; if (rng.chance(0.62)) { bump(k, 20); k.grievances = []; remember(p, k, "milestone", `${first(k)} answered your letter, and you began again.`); return `${first(k)} called the day it arrived. You both talked for three hours.`; } bump(k, 4); return `${first(k)} sent a short, polite reply. It's a door, slightly ajar.${g ? "" : ""}`; } },
      },
      {
        text: "Keep sending small messages and no demands",
        effects: { logText: "You sent photos of the garden and a joke every week. No pressure.", bizEffect: (p) => { const k = grownOf(p); if (!k) return; bump(k, 8); return `By autumn ${first(k)} was replying with jokes of their own.`; } },
      },
      {
        text: "Wait. They know where to find you",
        effects: { logText: "You decided not to chase. It was easier to be proud than hurt.", happinessDelta: -3, bizEffect: (p) => { const k = grownOf(p); if (!k) return; bump(k, -8); return `The silence stretched on, and neither of you moved first.`; } },
      },
    ], { requires: { custom: (p) => !!grownOf(p) && grownOf(p)!.relationshipBar < 38 }, cooldown: 5 }),
];

// ===========================================================================
// Friends
// ===========================================================================
const FRIENDS: LifeEvent[] = [
  ev("rel_friend_crisis", "family", 20, 85, "The 2am Call",
    "{bestie} is on the phone at 2am, crying. A marriage that isn't working out, a loss at work, or just everything arriving at once. They don't know who else to call.", [
      {
        text: "Drive over. Stay as long as it takes",
        effects: { logText: "You drove over in your coat and stayed until sunrise.", happinessDelta: -2, karmaDelta: 3, bizEffect: (p) => { const f = bestFriendOf(p); if (!f) return; bump(f, 15); remember(p, f, "kindness", `You were there for ${first(f)} at 2am when it mattered.`); return `${first(f)} said later it was the night they knew who their real friends were.`; } },
      },
      {
        text: "Lend them $2,000 and listen",
        effects: { logText: "You listened, and quietly lent them what they needed.", bankBalanceDelta: -2000, bizEffect: (p) => { const f = bestFriendOf(p); if (!f) return; bump(f, 9); p.flags.push(`lent:${f.id}:2000:${p.year}`); return `${first(f)} swore to pay it back.`; } },
      },
      {
        text: "Say you're swamped; talk tomorrow",
        effects: { logText: "You said you'd call in the morning. It was true, and it wasn't enough.", bizEffect: (p) => { const f = bestFriendOf(p); if (!f) return; bump(f, -14); addGrievance(p, f, "neglect", 1, "the night you weren't there"); return `You did call in the morning. ${first(f)} was polite. Something had changed.`; } },
      },
    ], { requires: { custom: (p) => bestOk(p) }, cooldown: 6 }),

  ev("rel_friend_vs_partner", "romance", 22, 70, "Them or Us",
    "{bestie} and {partner} don't get along, and tonight it finally came out. Two people you love in the same room, both pretending not to be furious.", [
      {
        text: "Stand by {partner}",
        effects: { logText: "You told your friend you'd stand by your partner, and meant it.", bizEffect: (p) => { const f = bestFriendOf(p); const pa = getPartner(p); bump(f, -14); bump(pa, 5); return f ? `${first(f)} went home early and quiet.` : undefined; } },
      },
      {
        text: "Stand by {bestie}",
        effects: { logText: "You took your friend's side, and your partner noticed.", bizEffect: (p) => { const f = bestFriendOf(p); const pa = getPartner(p); bump(f, 8); bump(pa, -9); if (pa) addGrievance(p, pa, "fight", 1, "the night you took your friend's side"); return undefined; } },
      },
      risk("Sit them both down and make them talk", 0.5, ["You made them meet halfway, a negotiation worthy of diplomats. A truce, with grudging respect on both sides.", { happinessDelta: 4, bizEffect: (p) => { bump(bestFriendOf(p), 5); bump(getPartner(p), 5); } }], ["It turned into a second row, with you in the middle.", { happinessDelta: -4, bizEffect: (p) => { bump(bestFriendOf(p), -5); bump(getPartner(p), -5); } }], "happiness"),
    ], { requires: { hasPartner: true, custom: (p) => bestOk(p) }, cooldown: 8 }),
];

// ===========================================================================
// In-laws, exes and the shape of a household
// ===========================================================================
const INLAW_WARMTH = (p: PlayerState, d: number) => {
  const pa = getPartner(p);
  for (const l of pa?.inLaws ?? []) if (l.alive) l.warmth = clamp(l.warmth + d);
};

const HOUSEHOLD: LifeEvent[] = [
  ev("rel_inlaw_holiday", "family", 24, 80, "Whose Christmas Is It?",
    "Both families want you for the holidays, and both have gone quiet in the particular way that means they're offended. {inlaw} has already mentioned the empty chair twice.", [
      opt("Alternate every year, fairly", "You made a rota and stuck it on the fridge. It's almost fair.", { happinessDelta: 1, bizEffect: (p) => { INLAW_WARMTH(p, 3); bump(getPartner(p), 3); } }),
      opt("Spend it at {inlaw}'s, and win them over", "You turned up with wine and your best manners and washed every dish.", { happinessDelta: -1, bizEffect: (p) => { INLAW_WARMTH(p, 10); bump(getPartner(p), 4); } }),
      opt("Go away, just the two of you", "You booked a cabin and turned your phones off. Both families sulked.", { happinessDelta: 5, bizEffect: (p) => { INLAW_WARMTH(p, -8); bump(getPartner(p), 6); } }),
    ], { requires: { married: true, custom: (p) => !!inLawOf(p) }, cooldown: 6 }),

  ev("rel_inlaw_care", "family", 38, 90, "Who Looks After Them?",
    "{inlaw} can't manage alone any more. A fall, a hospital stay, and a social worker with a clipboard. {partner} looks at you across the kitchen table and doesn't ask. They don't have to.", [
      {
        text: "Take them in",
        effects: { logText: "You cleared the study, installed a grab rail, and braced yourselves.", happinessDelta: -5, healthDelta: -2, bizEffect: (p) => { INLAW_WARMTH(p, 25); const pa = getPartner(p); bump(pa, 12); if (pa) remember(p, pa, "kindness", `You took in ${inLawOf(p)?.name.split(" ")[0] ?? "their parent"} when it counted.`); return "It was hard. It was also the kind of thing a marriage is built on."; } },
      },
      {
        text: "Pay for a good care home ($14,000)",
        effects: { logText: "You found a good place nearby, and paid for it.", bankBalanceDelta: -14000, bizEffect: (p) => { INLAW_WARMTH(p, 8); bump(getPartner(p), 4); } },
      },
      {
        text: "Leave it to the rest of the family",
        effects: { logText: "You said it wasn't your place. It was technically true.", happinessDelta: 1, bizEffect: (p) => { INLAW_WARMTH(p, -18); const pa = getPartner(p); bump(pa, -10); if (pa) addGrievance(p, pa, "neglect", 2, "how you handled their parent's care"); } },
      },
    ], { requires: { married: true, custom: (p) => { const l = inLawOf(p); return !!l && l.age >= 75; } }, once: true }),

  ev("rel_coparent_dispute", "family", 25, 70, "A Question of Weekends",
    "{coparent} wants to change the custody arrangement: the children's weekends, the summer holidays, a possible move across the country. The email came at 11pm, in capital letters.", [
      {
        text: "Agree to the changes, for the children's sake",
        effects: { logText: "You said yes to most of it, swallowing a lot.", happinessDelta: -2, bizEffect: (p) => { const x = coParentOf(p); bump(x, 8); for (const k of p.relatives) if (k.relation === "Child" && k.custody && k.age < 18) bump(k, 3); } },
      },
      {
        text: "Refuse, and say why",
        effects: { logText: "You refused. The email back was longer than the first one.", happinessDelta: -3, bizEffect: (p) => { const x = coParentOf(p); bump(x, -10); if (x) addGrievance(p, x, "fight", 1, "the custody dispute"); } },
      },
      risk("Propose mediation ($2,500)", 0.62, ["A mediator found something both of you could live with, and the children noticed that you were no longer fighting.", { bankBalanceDelta: -2500, happinessDelta: 4, bizEffect: (p) => { bump(coParentOf(p), 6); for (const k of p.relatives) if (k.relation === "Child" && k.custody && k.age < 18) bump(k, 5); } }], ["Mediation went nowhere. Two hours of pleasantries, and $2,500 on the clock.", { bankBalanceDelta: -2500, happinessDelta: -3 }]),
    ], { requires: { custom: (p) => !!coParentOf(p) }, cooldown: 6 }),

  ev("rel_blended_family", "family", 24, 60, "Meeting the Children",
    "{partner} has been in your life for a while now, and the children don't know. You've been rehearsing the conversation in the shower.", [
      {
        text: "Introduce them slowly: a park, then a pizza",
        effects: { logText: "You introduced them slowly, on neutral ground.", happinessDelta: 2, bizEffect: (p, rng) => { const pa = getPartner(p); for (const k of p.relatives) if (k.relation === "Child" && k.alive && k.age < 18) bump(k, DEFIANT.includes(temper(k)) ? rng.int(-3, 2) : 3); bump(pa, 4); return "It was awkward and fine. Awkward and fine is a good start."; } },
      },
      {
        text: "Introduce them now: no more hiding",
        effects: { logText: "You told the children, and brought {partner} to dinner that night.", bizEffect: (p, rng) => { for (const k of p.relatives) if (k.relation === "Child" && k.alive && k.age < 18) bump(k, TENDER.includes(temper(k)) || rng.chance(0.4) ? -7 : 2); bump(getPartner(p), 2); return "Some of the children took it better than others."; } },
      },
      {
        text: "Wait another year",
        effects: { logText: "You decided the children weren't ready. Maybe you weren't either.", bizEffect: (p) => { bump(getPartner(p), -8); const pa = getPartner(p); if (pa) addGrievance(p, pa, "neglect", 1, "being kept a secret from the children"); } },
      },
    ], { requires: { hasPartnerStatus: "dating", hasChildren: true, custom: (p) => p.relatives.some((r) => r.relation === "Child" && r.alive && r.age < 18) }, once: true }),

  ev("rel_empty_nest", "romance", 44, 68, "The Quiet House",
    "The last of the children has gone. You and {partner} sit across the kitchen table in a house that suddenly echoes. Neither of you quite knows how to start the conversation, or whether to.", [
      {
        text: "Plan something new together ($3,000)",
        effects: { logText: "You booked a trip you'd both talked about for twenty years.", bankBalanceDelta: -3000, happinessDelta: 6, bizEffect: (p) => { const pa = getPartner(p); bump(pa, 10); if (pa) { pa.unmet = {}; remember(p, pa, "joy", "You rediscovered each other once the house emptied."); } } },
      },
      {
        text: "Get a hobby each and give each other room",
        effects: { logText: "You each took up something of your own, and met for dinner.", happinessDelta: 3, bizEffect: (p) => { bump(getPartner(p), 4); } },
      },
      {
        text: "Say nothing and drift",
        effects: { logText: "You let the quiet become the new normal.", happinessDelta: -4, bizEffect: (p) => { const pa = getPartner(p); bump(pa, -9); if (pa) addGrievance(p, pa, "neglect", 1, "the silence you both let grow"); } },
      },
    ], { requires: { married: true, hasChildren: true, custom: (p) => !p.relatives.some((r) => r.relation === "Child" && r.alive && r.age < 20) }, once: true }),
];

export const RELATIONSHIP_EVENTS: LifeEvent[] = [...TEENS, ...GROWN, ...FRIENDS, ...HOUSEHOLD];
