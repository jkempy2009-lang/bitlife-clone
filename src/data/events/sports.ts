/**
 * Sports-career events. They only appear for people in the athlete pipeline (see `requires.custom`).
 *
 * Events can't call the athlete engine directly, so some options set `ath:*` flags that
 * processAthlete() consumes at the next Age Up: ath:dope, ath:inj1-4, ath:spotlight, ath:cut,
 * ath:ban, ath:ban_life, ath:lose_scholarship, ath:fire_agent. Persistent flags: ath:fixed, coach_badge.
 */
import type { PlayerState } from "@/types/game.types";
import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

const stageOf = (p: PlayerState) => p.athlete?.stage ?? "none";
const amateur = (p: PlayerState) => stageOf(p) === "youth" || stageOf(p) === "college";
const college = (p: PlayerState) => stageOf(p) === "college";
const signed = (p: PlayerState) => (stageOf(p) === "semipro" || stageOf(p) === "pro") && !p.athlete.freeAgent;
const topPro = (p: PlayerState) => stageOf(p) === "pro" && !p.athlete.freeAgent && p.athlete.league >= 1;
const retired = (p: PlayerState) => stageOf(p) === "retired";

export const SPORTS_EVENTS: LifeEvent[] = [
  // ---------- youth and college ----------
  ev("ath_growth_spurt", "health", 11, 16, "Growth Spurt", "You shot up four inches this year and your coordination hasn't caught up. Coaches are split on what to do.", [
    risk("Train through it", 0.6, ["You adapted fast and came out stronger.", { skillDeltas: { athletics: 5 }, happinessDelta: 3 }], ["Your joints complained. You pulled up lame in training.", { setFlags: ["ath:inj1"], happinessDelta: -3 }], "health"),
    opt("Ease off and let your body catch up", "A calmer year. Your body thanked you.", { healthDelta: 2, skillDeltas: { athletics: 2 } }),
  ], { requires: { custom: (p) => amateur(p) && p.athlete.stage === "youth" }, cooldown: 5 }),
  ev("ath_pushy_parent", "family", 9, 17, "The Sideline Parent", "A parent is shouting instructions from the touchline again. It's yours.", [
    opt("Tell them to back off", "It was an awkward drive home, but you got your Saturdays back.", { happinessDelta: 3, relationshipDelta: { target: "Parent", delta: -10 } }),
    opt("Let them push you", "You trained harder than anyone. You also dreaded every practice.", { skillDeltas: { athletics: 4 }, happinessDelta: -5, relationshipDelta: { target: "Parent", delta: 5 } }),
    opt("Sit down together and set some ground rules", "You agreed on goals. It brought you closer.", { happinessDelta: 4, relationshipDelta: { target: "Parent", delta: 8 } }),
  ], { requires: { custom: (p) => amateur(p) && p.age <= 17 && p.athlete.stage === "youth" }, cooldown: 5 }),
  ev("ath_exam_clash", "school", 14, 22, "Exam or Match?", "Your biggest game of the year is the same morning as a major exam.", [
    risk("Play the game", 0.55, ["You starred in front of a scout and talked your teacher into a retake.", { fameDelta: 1, setFlags: ["ath:spotlight"], happinessDelta: 6 }], ["You lost, and the teacher wouldn't budge. The worst of both.", { smartsDelta: -2, happinessDelta: -6 }]),
    opt("Sit the exam", "You aced it and watched the match highlights later.", { smartsDelta: 2, happinessDelta: -1 }),
  ], { requires: { custom: (p) => amateur(p) && p.education.stage !== "None" }, cooldown: 4 }),
  ev("ath_scout_in_stands", "career", 13, 20, "A Scout in the Stands", "A stranger with a clipboard is watching your match. Your coach has noticed too.", [
    risk("Play the game of your life", 0.5, ["You were electric. The clipboard guy came over afterwards.", { setFlags: ["ath:spotlight"], happinessDelta: 8, fameDelta: 1 }], ["You tried too hard and went down clutching your leg.", { setFlags: ["ath:inj1"], happinessDelta: -5 }], "health"),
    opt("Play your normal game", "A solid day. No harm done.", { happinessDelta: 2, skillDeltas: { athletics: 1 } }),
  ], { requires: { custom: (p) => p.athlete.stage === "youth" && p.athlete.rating >= 20 }, cooldown: 3 }),
  ev("ath_booster_gift", "money", 18, 23, "A Generous Booster", "A wealthy alumnus presses an envelope into your hand. 'Just a little something for our star.'", [
    risk("Take the $8,000", 0.62, ["Nobody asked questions. You bought a lot of pizza.", { bankBalanceDelta: 8000, karmaDelta: -5 }], ["It came out in an inquiry. You lost your scholarship and the whole campus knows.", { bankBalanceDelta: 8000, karmaDelta: -5, happinessDelta: -10, fameDelta: -2, setFlags: ["ath:lose_scholarship"] }]),
    opt("Hand it back", "He looked offended. Your conscience was clean.", { karmaDelta: 4 }),
  ], { requires: { custom: (p) => college(p) && p.athlete.track === "college" }, cooldown: 6 }),
  ev("ath_coach_feud", "career", 12, 22, "The Coach's Favourite", "The coach keeps starting his nephew over you, and everyone can see it.", [
    risk("Confront the coach", 0.5, ["He respected the honesty and started you the next week.", { skillDeltas: { athletics: 3 }, happinessDelta: 4 }], ["He didn't take it well. You were cut from the squad.", { setFlags: ["ath:cut"], happinessDelta: -6 }]),
    opt("Keep your head down and work", "You earned your minutes the slow way.", { happinessDelta: -3, skillDeltas: { athletics: 1 } }),
  ], { requires: { custom: (p) => amateur(p) }, cooldown: 6 }),
  ev("ath_team_title", "fame", 12, 22, "Championship Parade", "Your team won the title. The whole school lined the corridors.", [
    opt("Soak it in", "You carried the trophy through the halls. A great memory.", { happinessDelta: 8, fameDelta: 1 }),
    opt("Share the credit", "You put the whole squad in front of the cameras.", { happinessDelta: 6, karmaDelta: 3 }),
  ], { requires: { custom: (p) => amateur(p) && p.athlete.history.length > 0 && p.athlete.history[p.athlete.history.length - 1].titles > 0 }, cooldown: 3 }),

  // ---------- temptations ----------
  ev("ath_doping_offer", "crime", 17, 38, "An Untraceable Edge", "A trainer slides you a vial: 'Undetectable. Everyone at the top uses it.'", [
    opt("Take it", "Your numbers started climbing almost at once. You tell yourself nobody will find out.", { setFlags: ["ath:dope"], healthDelta: -2, karmaDelta: -8 }),
    opt("Refuse", "You said no. The trainer shrugged and found someone else.", { karmaDelta: 2 }),
    opt("Report him to the league", "You reported the trainer. Locker rooms are cold places now.", { karmaDelta: 6, happinessDelta: -2, fameDelta: 1 }),
  ], { requires: { custom: (p) => (college(p) || signed(p)) && !p.athlete.doping && !p.flags.includes("doping_caught") }, once: true }),
  ev("ath_match_fixing", "crime", 18, 40, "The Bookmaker's Offer", "A man you've never met says a few of your games could earn you $40,000. He only needs you to lose.", [
    opt("Take the money", "You threw the match. It was easy, and that scares you. Somebody, somewhere, is keeping count.", { bankBalanceDelta: 40000, setFlags: ["ath:fixed"], karmaDelta: -15, happinessDelta: -4 }),
    opt("Refuse", "You walked away. He didn't look surprised.", { karmaDelta: 3 }),
    opt("Report it to the league", "The league thanked you and opened an investigation.", { karmaDelta: 8, fameDelta: 2, happinessDelta: -2 }),
  ], { requires: { custom: (p) => signed(p) && !p.flags.includes("ath:fixed") }, cooldown: 8, weight: 0.7 }),
  ev("ath_nightlife", "romance", 18, 31, "One Night Out", "Your teammates are going out the night before a big match.", [
    risk("Go with them", 0.6, ["Great night, and you still ran well the next day.", { happinessDelta: 6, healthDelta: -2 }], ["Photos leaked. The club fined you $25,000 and the press had a field day.", { bankBalanceDelta: -25000, fameDelta: -2, happinessDelta: -4 }]),
    opt("Stay in and rest", "Boring, but the right call.", { healthDelta: 1, happinessDelta: -1 }),
  ], { requires: { custom: (p) => signed(p) && p.athlete.league >= 1 && p.bankBalance >= 25000 }, cooldown: 4 }),

  // ---------- contracts and club life ----------
  ev("ath_contract_dispute", "career", 18, 36, "Contract Standoff", "You think you're underpaid. Your agent says you have leverage.", [
    risk("Hold out for more", 0.45, ["The club blinked: a 25% raise!", { salaryPct: 25, happinessDelta: 6, fameDelta: 1 }], ["The club called your bluff and docked your pay.", { salaryPct: -10, happinessDelta: -6, fameDelta: -1 }]),
    opt("Stay quiet and play", "You kept your head down. Management noticed and rewarded you a little.", { salaryPct: 4, happinessDelta: 1 }),
  ], { requires: { custom: (p) => topPro(p) && p.athlete.rating >= p.athlete.league * 6 + 62 }, cooldown: 5 }),
  ev("ath_transfer_rumours", "career", 19, 35, "Transfer Rumours", "The papers say you want to leave. You haven't said a word.", [
    opt("Pledge your loyalty", "The fans loved it. So did the board, who found a little extra in your pay.", { fameDelta: 2, salaryPct: 3, happinessDelta: 3 }),
    risk("Demand a move", 0.5, ["The club sweetened the deal to keep you.", { salaryPct: 12, happinessDelta: 4 }], ["You were frozen out of the squad until you apologised.", { happinessDelta: -7, fameDelta: -2 }]),
  ], { requires: { custom: (p) => topPro(p) }, cooldown: 5 }),
  ev("ath_sponsor_offer", "fame", 18, 40, "A Sponsor Calls", "A sportswear brand wants you in its next campaign.", [
    opt("Sign the deal ($60,000)", "The ads were everywhere. So was your face.", { bankBalanceDelta: 60000, fameDelta: 3, happinessDelta: 5 }),
    risk("Hold out for a bigger brand", 0.5, ["A bigger brand came knocking with double the money.", { bankBalanceDelta: 130000, fameDelta: 4, happinessDelta: 7 }], ["The first brand moved on, and nobody else called.", { happinessDelta: -3 }]),
  ], { requires: { custom: (p) => topPro(p) && p.fame >= 25 }, cooldown: 5 }),
  ev("ath_media_storm", "fame", 18, 40, "Postgame Interview", "A reporter pushes you on your team's collapse and the microphone is live.", [
    risk("Tell it like it is", 0.5, ["Your honesty went viral for the right reasons.", { fameDelta: 3, happinessDelta: 4 }], ["It went viral for the wrong reasons. A sponsor wavered.", { fameDelta: -2, happinessDelta: -5 }]),
    opt("Give the usual clichés", "'We take it one game at a time.' Nobody could argue.", { happinessDelta: 0 }),
  ], { requires: { custom: (p) => topPro(p) && p.fame >= 15 }, cooldown: 4 }),
  ev("ath_fan_moment", "fame", 18, 45, "The Kid at the Gate", "A young fan in your jersey waits for an hour outside the training ground.", [
    opt("Stop and sign everything", "He'll remember it forever. So will the local paper.", { fameDelta: 1, karmaDelta: 3, happinessDelta: 4 }),
    opt("Wave and keep walking", "You were late and tired. The kid's face stayed with you.", { karmaDelta: -2, happinessDelta: -1 }),
  ], { requires: { custom: (p) => signed(p) && p.fame >= 10 }, cooldown: 4 }),
  ev("ath_injury_niggle", "health", 18, 38, "A Nagging Knock", "You pulled up feeling something in training. The physio says rest. The coach says you're needed.", [
    opt("Rest it", "You sat out the next match. It healed cleanly.", { healthDelta: 2, happinessDelta: -1 }),
    risk("Play on", 0.6, ["You shook it off and played well.", { fameDelta: 1, happinessDelta: 2 }], ["You made it worse. Now it's a proper injury.", { setFlags: ["ath:inj2"], happinessDelta: -5 }], "health"),
  ], { requires: { custom: (p) => signed(p) && !p.athlete.injury }, cooldown: 3 }),
  ev("ath_agent_trouble", "money", 20, 45, "Your Agent's 'Investments'", "An accountant calls: your agent has been moving your money around, and it's not going well.", [
    risk("Take him to court", 0.5, ["You recovered most of it and found a better agent.", { bankBalanceDelta: -5000, happinessDelta: 2, setFlags: ["ath:fire_agent"] }], ["You lost the case and a pile of legal fees.", { bankBalanceDelta: -35000, happinessDelta: -6, setFlags: ["ath:fire_agent"] }]),
    opt("Fire him quietly and take the loss", "It cost you $20,000, but you were free of him.", { bankBalanceDelta: -20000, setFlags: ["ath:fire_agent"] }),
  ], { requires: { custom: (p) => signed(p) && p.athlete.agent && p.bankBalance >= 40000 }, once: true }),
  ev("ath_charity_foundation", "money", 22, 60, "Start a Foundation", "Your name opens doors. Your accountant suggests a charitable foundation.", [
    opt("Fund it ($100,000)", "The foundation built pitches in a dozen neighbourhoods. Your name will outlast your career.", { bankBalanceDelta: -100000, karmaDelta: 10, fameDelta: 3, happinessDelta: 6 }),
    opt("Not now", "Maybe when your career is over.", {}),
  ], { requires: { custom: (p) => (signed(p) || retired(p)) && p.fame >= 40 && p.bankBalance >= 300000 }, once: true }),

  // ---------- veterans and retirees ----------
  ev("ath_veteran_mentor", "career", 29, 45, "The Rookie", "A teenage prospect has been assigned the locker next to yours.", [
    opt("Take him under your wing", "He called you his hero in his first interview.", { karmaDelta: 4, fameDelta: 1, happinessDelta: 4 }),
    opt("Protect your place", "You gave him nothing. He didn't last. Neither did your conscience.", { karmaDelta: -3, happinessDelta: -1 }),
  ], { requires: { custom: (p) => signed(p) && p.age >= 29 }, cooldown: 6 }),
  ev("ath_one_more_year", "career", 31, 45, "One More Season?", "Your body hurts every morning. A club offers you one more year.", [
    opt("Do it one last time", "You squeezed out another season. The knees disagreed.", { healthDelta: -2, happinessDelta: 3, bankBalanceDelta: 15000 }),
    opt("Enrol in a coaching course ($3,000)", "You earned your coaching badge. You'll be ready when the legs finally go.", { bankBalanceDelta: -3000, smartsDelta: 1, setFlags: ["coach_badge"] }),
  ], { requires: { custom: (p) => signed(p) && p.age >= 31 && p.athlete.rating < 80 }, cooldown: 5 }),
  ev("ath_testimonial", "fame", 33, 70, "Testimonial Match", "Your old club wants to hold a match in your honour.", [
    opt("Say yes", "Forty thousand fans sang your name. The takings came to a tidy sum.", { bankBalanceDelta: 50000, fameDelta: 3, happinessDelta: 10 }),
    opt("Ask them to donate the proceeds to charity", "The fans loved it even more.", { karmaDelta: 8, fameDelta: 4, happinessDelta: 8 }),
  ], { requires: { custom: (p) => retired(p) && p.fame >= 45 && p.athlete.record.titles >= 1 }, once: true }),
  ev("ath_old_rival", "romance", 33, 70, "Old Rivals", "At a charity dinner you end up sat next to your greatest rival.", [
    opt("Bury the hatchet", "You swapped war stories until midnight. You are friends now.", { happinessDelta: 5, addRelative: { relation: "Friend", ageOffset: [-3, 3] } }),
    opt("Pick up where you left off", "Words were exchanged. Phones came out. It trended.", { fameDelta: 2, happinessDelta: -2 }),
  ], { requires: { custom: (p) => retired(p) && p.athlete.record.proSeasons >= 4 }, cooldown: 10 }),
  ev("ath_quit_regret", "general", 19, 40, "The One That Got Away", "You see your old team win a title on TV. It stings.", [
    opt("Throw yourself into something new", "You found a new project. It helped.", { happinessDelta: 3, smartsDelta: 1 }),
    opt("Stew about it", "You replayed old decisions for weeks.", { happinessDelta: -5 }),
  ], { requires: { custom: (p) => p.athlete.stage === "none" && p.flags.includes("quit_sport") }, once: true }),
];
