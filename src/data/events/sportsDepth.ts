/**
 * Deeper sports-career events: academy pressure, locker-room politics, media narratives, rivalries, doping
 * scares, money and the identity crisis after retirement. They talk to the athlete state directly through `apply`
 * (see engine/athleteDepth.ts for what the numbers mean). All ids start with `ath_`.
 */
import type { PlayerState } from "@/types/game.types";
import { clamp } from "@/lib/format";
import { ev, fx, opt, risk } from "../eventBuilders";
import type { ChoiceOption, LifeEvent } from "../lifeEventsEngine";

const stage = (p: PlayerState) => p.athlete?.stage ?? "none";
const amateur = (p: PlayerState) => stage(p) === "youth" || stage(p) === "college";
const signed = (p: PlayerState) => (stage(p) === "semipro" || stage(p) === "pro") && !p.athlete.freeAgent;
const pro = (p: PlayerState) => signed(p) && p.athlete.league >= 1;
const teamSport = (p: PlayerState) => ["Soccer", "Basketball"].includes(p.athlete?.sport ?? "");

const mental = (p: PlayerState, d: number) => {
  p.athlete.mental = clamp(p.athlete.mental + d);
};
const image = (p: PlayerState, d: number) => {
  p.athlete.image = clamp(p.athlete.image + d);
};
const coach = (p: PlayerState, d: number) => {
  p.athlete.coachRel = clamp(p.athlete.coachRel + d);
};
const chem = (p: PlayerState, d: number) => {
  p.athlete.chemistry = clamp(p.athlete.chemistry + d);
};

/** An option whose main effect is on athlete state. */
const act = (text: string, log: string, apply: (p: PlayerState) => void, rest: Parameters<typeof fx>[1] = {}): ChoiceOption => ({
  text,
  effects: fx(log, { ...rest, apply }),
});

type Hook = (p: PlayerState) => void;

/** Attach athlete-state side effects to the win (and failure) branch of a normal option. */
const hook = (o: ChoiceOption, win?: Hook, lose?: Hook): ChoiceOption => {
  if (win) o.effects.apply = win;
  if (lose && o.chance) o.chance.failure.apply = lose;
  return o;
};

export const SPORTS_DEPTH_EVENTS: LifeEvent[] = [
  // ---------- youth and academy ----------
  ev("ath_academy_pressure", "health", 13, 20, "Make Weight or Make the Cut", "A coach pulls you aside: 'Drop five pounds before the trials, or I can't protect your place.' Half the squad is skipping meals.", [
    act("Do what it takes", "You crash-dieted and made the cut. You also felt terrible for months.", (p) => {
      mental(p, -8);
      p.athlete.rating = clamp(p.athlete.rating + 1);
    }, { healthDelta: -4, happinessDelta: -4 }),
    act("Tell your parents and the academy welfare officer", "The academy sorted out proper nutrition. The coach resented you for it, but you were looked after.", (p) => {
      mental(p, 6);
      coach(p, -8);
    }, { happinessDelta: 3, karmaDelta: 2 }),
    risk("Ignore him and train smart", 0.5, ["Your numbers spoke for themselves and he backed down.", { happinessDelta: 3 }], ["He cut you from the trials squad for insubordination.", { setFlags: ["ath:cut"], happinessDelta: -6 }]),
  ], { requires: { custom: (p) => amateur(p) && p.age >= 13 }, cooldown: 6 }),
  ev("ath_parent_manager", "family", 15, 19, "Dad Wants to Be Your Agent", "Scouts are circling and a parent is convinced they can negotiate your future better than any stranger.", [
    act("Let your parent handle it", "They saved you the fees and tried their best, but it showed. You've lost a little leverage, and the dinner table now has agenda items.", (p) => {
      p.athlete.exposure = clamp(p.athlete.exposure - 5);
    }, { happinessDelta: -1, relationshipDelta: { target: "Parent", delta: 6 } }),
    opt("Politely explain you need a professional", "It stung at first. They came round, and you stayed close.", { happinessDelta: 1, relationshipDelta: { target: "Parent", delta: -3 } }),
    act("Keep your parent as an adviser, hire help for the contracts", "A sensible split. Your parent felt valued; the paperwork got done properly.", (p) => {
      p.athlete.exposure = clamp(p.athlete.exposure + 4);
    }, { relationshipDelta: { target: "Parent", delta: 5 }, bankBalanceDelta: -1500 }),
  ], { requires: { custom: (p) => p.athlete.stage === "youth" && p.athlete.rating >= 35 && !p.athlete.agent }, once: true }),

  // ---------- locker room ----------
  ev("ath_locker_feud", "career", 18, 36, "Dressing-Room Feud", "Two teammates have stopped passing to each other and the squad is picking sides.", [
    hook(
      risk("Mediate", 0.6, ["You got them in a room and they shook hands. The squad respects you more for it.", { happinessDelta: 3 }], ["Both of them think you took the other's side.", { happinessDelta: -3 }]),
      (p) => chem(p, 8),
      (p) => chem(p, -6),
    ),
    act("Back the senior player", "You sided with the veteran. He remembers favours.", (p) => {
      chem(p, -4);
      coach(p, 3);
    }),
    act("Stay out of it", "You kept your head down, and the tension simmered all year.", (p) => chem(p, -6)),
  ], { requires: { custom: (p) => signed(p) && teamSport(p) }, cooldown: 4 }),
  ev("ath_new_system", "career", 18, 36, "A New System", "The coach has torn up the playbook for a style that doesn't suit your strengths.", [
    risk("Adapt and make it work", 0.55, ["You added a new dimension to your game. The coach noticed.", { skillDeltas: { athletics: 2 } }], ["You never looked comfortable in it and were dropped.", { happinessDelta: -4 }]),
    act("Tell him it doesn't work", "He took it personally. Your minutes dried up for a while.", (p) => {
      coach(p, -10);
      p.athlete.playing = clamp(p.athlete.playing - 15);
    }, { happinessDelta: -1 }),
    act("Quietly ask for a move", "You told your agent you're open to leaving.", (p) => {
      p.athlete.transferReq = true;
    }),
  ], { requires: { custom: (p) => signed(p) && teamSport(p) && p.athlete.coachRel < 70 }, cooldown: 5 }),
  ev("ath_salary_cap", "money", 21, 38, "Cap Crunch", "The club is over the salary cap and wants a few senior players to take a pay cut to keep the squad together.", [
    act("Take the cut (-10%)", "You put the team first. The dressing room noticed.", (p) => {
      chem(p, 8);
      coach(p, 6);
      image(p, 3);
    }, { salaryPct: -10, karmaDelta: 2 }),
    act("Refuse", "The club found the money elsewhere, but your name was mentioned in the board meeting.", (p) => {
      coach(p, -8);
      chem(p, -5);
    }, { happinessDelta: 1 }),
    risk("Tell them you'll take it if they extend you", 0.5, ["They agreed to a longer deal on better terms.", { salaryPct: 6, happinessDelta: 4 }], ["They said no and the offer was withdrawn. Awkward.", { happinessDelta: -3 }]),
  ], { requires: { custom: (p) => topSigned(p) && teamSport(p) }, cooldown: 6 }),
  ev("ath_bidding_war", "money", 20, 36, "A Bidding War", "With your contract up, three clubs are circling. Your agent smells blood.", [
    hook(
      risk("Run an auction", 0.55, ["The clubs bid each other up. Every offer improved by about 12%.", { happinessDelta: 5 }], ["One club walked out, tired of being played. The others held firm.", { happinessDelta: -2 }]),
      (p) => p.athlete.offers.forEach((x) => {
        if (x.years > 0) x.salary = Math.round((x.salary * 1.12) / 500) * 500;
      }),
      (p) => {
        if (p.athlete.offers.length > 1) p.athlete.offers = p.athlete.offers.slice(1);
      },
    ),
    opt("Stay loyal to your club", "You went with the familiar and got a modest loyalty bonus.", { karmaDelta: 2, bankBalanceDelta: 20000, happinessDelta: 2 }),
  ], { requires: { custom: (p) => (p.athlete.expiring || p.athlete.freeAgent) && p.athlete.offers.filter((o) => o.years > 0).length >= 2 && p.athlete.agent }, cooldown: 5 }),

  // ---------- media, image, rivalry ----------
  ev("ath_profile_piece", "fame", 18, 40, "The Profile", "A magazine wants a long, candid piece on you: your childhood, your fears, your rival. It could make you, or it could make a headline.", [
    hook(
      risk("Open up", 0.6, ["Readers loved the honest version of you.", { fameDelta: 2, happinessDelta: 3 }], ["One careless quote went viral. Sponsors were not amused.", { fameDelta: 1, happinessDelta: -4 }]),
      (p) => image(p, 6),
      (p) => image(p, -8),
    ),
    opt("Decline politely", "A quiet life. The magazine ran a piece on someone else.", {}),
  ], { requires: { custom: (p) => pro(p) && p.fame >= 25 }, cooldown: 5 }),
  ev("ath_old_posts", "fame", 18, 40, "Old Posts Resurface", "Something you wrote at seventeen has been dug up and a sponsor wants to talk.", [
    act("Apologise sincerely and donate to a relevant charity ($10,000)", "People respect a real apology. The story faded in a week.", (p) => image(p, -2), { bankBalanceDelta: -10000, karmaDelta: 2 }),
    act("Double down", "It trended for all the wrong reasons.", (p) => image(p, -12), { fameDelta: 1, happinessDelta: -3 }),
    act("Say nothing", "It blew over, mostly, but the sponsor remembered.", (p) => image(p, -5)),
  ], { requires: { custom: (p) => pro(p) && p.fame >= 30 }, cooldown: 6 }),
  ev("ath_rival_taunt", "fame", 20, 40, "A Rival Gets Personal", "Your rival says in an interview that you are overrated and finished. A camera is already pointed at you.", [
    act("Fire back", "The press was delighted. So was the box office.", (p) => {
      if (p.athlete.rival) p.athlete.rival.heat = clamp(p.athlete.rival.heat + 20);
      p.athlete.exposure = clamp(p.athlete.exposure + 8);
      image(p, -3);
    }, { fameDelta: 2 }),
    act("Answer on the pitch", "You said nothing and let the results do the talking.", (p) => {
      mental(p, 3);
      image(p, 3);
      p.athlete.form = clamp(p.athlete.form + 5);
    }),
    act("Call and clear the air", "He admitted it was for the cameras. You're not friends, but there's respect.", (p) => {
      if (p.athlete.rival) p.athlete.rival.heat = clamp(p.athlete.rival.heat - 25);
      image(p, 4);
    }, { karmaDelta: 2 }),
  ], { requires: { custom: (p) => !!p.athlete.rival && signed(p) }, cooldown: 4 }),

  // ---------- mind and body ----------
  ev("ath_burnout_crossroads", "health", 16, 38, "Running on Fumes", "You wake up dreading training. The joy has gone and you cannot remember when you last smiled in a match.", [
    act("Take a proper break", "You stepped away for a few weeks. It was the best decision of your year.", (p) => {
      mental(p, 28);
      p.athlete.rating = clamp(p.athlete.rating - 1.5);
    }, { happinessDelta: 5, healthDelta: 2 }),
    act("Push on", "You ground it out. It showed.", (p) => {
      mental(p, -6);
      p.athlete.rating = clamp(p.athlete.rating + 0.5);
    }, { happinessDelta: -5 }),
    act("Talk to someone ($2,000)", "A sport psychologist helped you name what was going on. It lifted a weight.", (p) => mental(p, 20), { bankBalanceDelta: -2000, happinessDelta: 3 }),
  ], { requires: { custom: (p) => (amateur(p) || signed(p)) && p.athlete.mental < 40 }, cooldown: 3 }),
  ev("ath_second_opinion", "health", 18, 38, "A Second Opinion", "The club doctor says your injury will take a season. A specialist in another city says he can do better.", [
    hook(
      risk("Fly out to see the specialist ($6,000)", 0.6, ["His plan was cleverer than the club's. The lasting damage looks smaller.", { bankBalanceDelta: -6000 }], ["He found nothing the club hadn't. An expensive trip.", { bankBalanceDelta: -6000, happinessDelta: -2 }]),
      (p) => {
        if (p.athlete.injury) p.athlete.injury.ratingLoss = Math.round(p.athlete.injury.ratingLoss * 0.75 * 10) / 10;
      },
    ),
    opt("Trust the club doctor", "You followed the club's plan to the letter.", {}),
  ], { requires: { custom: (p) => !!p.athlete.injury && p.athlete.injury.severity >= 2 && p.athlete.injury.yearsLeft > 0 }, cooldown: 4 }),

  // ---------- temptations ----------
  ev("ath_casino_trip", "crime", 19, 38, "High Stakes", "The lads are going to a casino after the match. The stakes at the private table are far above what you'd normally risk.", [
    risk("Sit down and play", 0.4, ["Hot streak. You walked out up $25,000, which is the worst thing that could have happened.", { bankBalanceDelta: 25000, viceDelta: { gambling: 8 } }], ["You lost $50,000 in a night and a man in a suit offered you a way to 'settle up'.", { bankBalanceDelta: -50000, viceDelta: { gambling: 12 }, happinessDelta: -6, queueEvent: "ath_match_fixing" }]),
    opt("Go home", "The lads called you boring. Your wallet was safe.", { karmaDelta: 1 }),
  ], { requires: { custom: (p) => signed(p) && p.bankBalance >= 60000 }, cooldown: 6, weight: 0.8 }),
  ev("ath_surprise_test", "crime", 17, 40, "Surprise Test at Dawn", "Testers are in your hallway at six in the morning with a clipboard. You know what's in your system.", [
    risk("Use a masking agent ($20,000)", 0.55, ["The test came back clean. Your heart took a day to slow down.", { bankBalanceDelta: -20000, karmaDelta: -4 }], ["The masking agent was itself flagged. It is a bigger violation than the original.", { bankBalanceDelta: -20000, karmaDelta: -8, setFlags: ["doping_caught", "ath:ban"] }]),
    act("Come clean", "You admitted everything and accepted the sanction. It was a relief, and it cost you dearly.", (p) => {
      p.athlete.doping = false;
      p.athlete.deals = [];
      image(p, -15);
      mental(p, 8);
    }, { karmaDelta: 8, fameDelta: -6, happinessDelta: -4, setFlags: ["doping_caught", "ath:ban"] }),
    act("Take it and stop using afterwards", "You passed by luck and came off the programme.", (p) => {
      p.athlete.doping = false;
    }, { karmaDelta: 1, setFlags: ["ath:clean"] }),
  ], { requires: { custom: (p) => p.athlete.doping && signed(p) }, cooldown: 3 }),

  // ---------- money and life after ----------
  ev("ath_financial_adviser", "money", 22, 38, "The Money Talk", "An old teammate went bankrupt at 35. You look at your own bank statements and wonder how long this will last.", [
    opt("Hire a fee-only adviser and save a fifth of everything", "It's not exciting, but you'll have a life after sport.", { bankBalanceDelta: -3000, happinessDelta: 2, smartsDelta: 1, setFlags: ["ath:planned"] }),
    risk("Back a friend's restaurant ($80,000)", 0.4, ["The restaurant took off and you took a cut.", { bankBalanceDelta: 140000, happinessDelta: 4 }], ["It folded in a year. So did the friendship.", { bankBalanceDelta: -80000, happinessDelta: -5 }]),
    opt("Enjoy it while it lasts", "You bought a very fast car.", { bankBalanceDelta: -60000, happinessDelta: 5 }),
  ], { requires: { custom: (p) => pro(p) && p.bankBalance >= 150000 && p.athlete.league >= 2 }, cooldown: 6 }),
  ev("ath_after_the_roar", "general", 25, 60, "After the Roar", "Months after retirement, the phone has stopped ringing. Nobody greets you by name at the shops, and the days are very long.", [
    act("Sign up for a coaching course ($3,000)", "Giving the game back gave you a reason to get up.", (p) => {
      mental(p, 15);
    }, { bankBalanceDelta: -3000, happinessDelta: 5, setFlags: ["coach_badge"] }),
    opt("Travel for a year", "You saw the world on your own terms. Some of the weight lifted.", { bankBalanceDelta: -15000, happinessDelta: 6 }),
    opt("Withdraw from the world", "You turned down every invitation. It was a quiet, bad year.", { happinessDelta: -6, healthDelta: -1 }),
  ], { requires: { custom: (p) => stage(p) === "retired" && p.athlete.retiredAge !== null && p.age - p.athlete.retiredAge <= 3 }, once: true }),
  ev("ath_academy_visit", "fame", 28, 70, "Come and Speak to the Kids", "A local youth academy asks you to run a clinic and talk to the kids about the game.", [
    opt("Do it and stay for the whole day", "A kid asked how you handled losing. You told him the truth. It was the best day of your month.", { karmaDelta: 4, fameDelta: 1, happinessDelta: 5 }),
    opt("Send a signed shirt", "Polite, quick and forgotten.", {}),
  ], { requires: { custom: (p) => stage(p) === "retired" && p.fame >= 30 }, cooldown: 6 }),
];

function topSigned(p: PlayerState) {
  return signed(p) && p.athlete.league >= 1 && !p.athlete.expiring;
}
