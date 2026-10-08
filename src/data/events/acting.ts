/**
 * Screen-career events: on-set romance and temptation (adults only, kept suggestive), PR crises with
 * real options, agent poaching, ageing in the industry, stunts, series feuds, rejection streaks and
 * the child star's school problem. Gated through `requires.custom`; state changes go through `apply`.
 */
import type { PlayerState } from "@/types/game.types";
import { clamp } from "@/lib/format";
import { raiseScandal } from "@/engine/celebrity";
import { finishSeries } from "@/engine/actingYear";
import { recordCheating } from "@/engine/intimacy";
import { adultSpec } from "@/engine/people";
import { addRelative } from "@/engine/social";
import { getPartner } from "@/engine/state";
import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

const actor = (p: PlayerState) => p.currentJob?.lineId === "actor";
const performer = (p: PlayerState) => p.currentJob?.lineId === "actor" || p.currentJob?.lineId === "model";
const shooting = (p: PlayerState) => actor(p) && !!p.acting.pendingFilm && p.acting.pendingFilm.role !== "producer" && p.acting.pendingFilm.role !== "director";

export const ACTING_EVENTS: LifeEvent[] = [
  // ---------- on set ----------
  ev("act_costar_spark", "romance", 20, 65, "Chemistry on Set", "Between takes, a co-star keeps finding reasons to stand next to you. The crew has started to notice, and so has the way you laugh at their jokes. You are both adults and both free.", [
    risk("Ask them to dinner when the shoot wraps", 0.6, [
      "Dinner turned into breakfast. It is early days, but you are seeing each other.",
      { happinessDelta: 8, apply: (p, rng) => { if (!getPartner(p)) { const s = adultSpec(p, rng); addRelative(p, { relation: "Partner", partnerStatus: "dating", gender: s.gender, ageRange: s.ageRange }, rng); } } },
    ], [
      "They smiled and said it would be unprofessional. The rest of the shoot was awkward.",
      { happinessDelta: -4 },
    ]),
    opt("Keep it professional", "You kept things warm but clear. The performances were better for the tension.", { happinessDelta: 1, apply: (p) => { p.acting.critics = clamp(p.acting.critics + 1); } }),
  ], { requires: { custom: (p) => shooting(p) && !getPartner(p) }, cooldown: 6 }),

  ev("act_costar_temptation", "romance", 21, 65, "The Trailer at Midnight", "A co-star lingers at your trailer door after a late wrap, closer than the scene required. You have a partner at home. Everyone here is an adult, and everyone here would keep a secret, until they would not.", [
    opt("Say goodnight and mean it", "You went back to the hotel and called home. It was the harder choice and the easier night's sleep.", { happinessDelta: 2, karmaDelta: 2, relationshipDelta: { target: "Partner", delta: 4 } }),
    risk("Let it happen, just once", 0.55, [
      "A kiss in a doorway that you both knew you should not repeat. Nobody saw. Your conscience did.",
      { happinessDelta: -2, apply: (p, rng) => { recordCheating(p, rng, [], 0.12); } },
    ], [
      "Someone on the crew had a phone. By morning a blurry photo was in a gossip inbox, and your partner heard before you could tell them.",
      { happinessDelta: -8, apply: (p, rng) => { recordCheating(p, rng, [], 0.9); raiseScandal(p, "acting", rng, [], 2, "photos of you and a co-star outside a trailer hit the tabloids"); } },
    ]),
  ], { requires: { custom: (p) => shooting(p) && !!getPartner(p) && p.fame >= 5 }, cooldown: 7 }),

  ev("act_stunt_offer", "career", 18, 55, "Do Your Own Stunts?", "The action sequence is the film's centrepiece. The director says it would look incredible if the star did the jump. The stunt coordinator says it would look incredible and also hurt.", [
    risk("Do it yourself", 0.6, [
      "One take, no doubles. The sequence became the poster, and the trailer.",
      { happinessDelta: 5, fameDelta: 2, apply: (p) => { if (p.acting.pendingFilm) p.acting.pendingFilm.promo = Math.min(40, (p.acting.pendingFilm.promo ?? 0) + 8); } },
    ], [
      "You landed wrong. Three cracked ribs and a long, silent drive to the hospital. The shoot lost a month.",
      { healthDelta: -15, happinessDelta: -5 },
    ]),
    opt("Let the stunt double do it", "A professional made it look easy. You watched from the monitor and kept your ribs.", { happinessDelta: 1 }),
  ], { requires: { custom: (p) => shooting(p) && (p.acting.pendingFilm?.genre === "Action" || p.acting.pendingFilm?.genre === "Sci-Fi") }, cooldown: 5 }),

  // ---------- PR crises ----------
  ev("act_leaked_footage", "fame", 18, 80, "Footage Leaks", "A video from a private party years ago has surfaced. You are not at your best, and neither is the person you were with. A tabloid has it and wants a comment by morning.", [
    risk("Call a lawyer ($8,000)", 0.7, [
      "A cease-and-desist and a quiet settlement made it vanish before the evening news.",
      { bankBalanceDelta: -8_000, happinessDelta: -2 },
    ], [
      "The letters leaked too. 'Star tries to bury video' was a bigger story than the video.",
      { bankBalanceDelta: -8_000, happinessDelta: -6, apply: (p, rng) => { raiseScandal(p, "acting", rng, [], 2, "a leaked video and the attempt to suppress it"); } },
    ]),
    risk("Post a short, honest statement", 0.5, [
      "You owned it in four sentences. The internet found someone else to be angry at by Thursday.",
      { happinessDelta: 2, karmaDelta: 2, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation + 1); } },
    ], [
      "The statement was read as an admission and pulled apart line by line.",
      { happinessDelta: -5, apply: (p, rng) => { raiseScandal(p, "acting", rng, [], 1, "the fallout from a leaked video and your statement about it"); } },
    ]),
    opt("Ride it out", "You said nothing and stayed off the internet. It hurt for a fortnight, then it faded.", { happinessDelta: -3, apply: (p) => { p.acting.pull = clamp(p.acting.pull - 2); p.celeb.privacy = clamp(p.celeb.privacy - 5); } }),
  ], { requires: { custom: (p) => performer(p) && p.fame >= 20 }, cooldown: 8 }),

  ev("act_costar_accuses", "fame", 20, 80, "A Co-Star Speaks Out", "A former co-star tells a magazine you were impossible on set: late, dismissive, loud with the crew. Some of it is exaggerated. Some of it is not.", [
    risk("Apologise publicly and mean it", 0.6, [
      "Your apology was specific and unpolished, which made it believable. Several crew members quietly backed you up.",
      { happinessDelta: 1, karmaDelta: 3, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation + 2); } },
    ], [
      "The apology came across as a PR script. The story ran for another week.",
      { happinessDelta: -5, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation - 6); } },
    ]),
    opt("Get a lawyer to threaten a retraction ($10,000)", "The magazine softened the piece. Everyone remembers the original.", { bankBalanceDelta: -10_000, happinessDelta: -2, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation - 2); } }),
    risk("Say they are lying", 0.35, [
      "Three crew members posted receipts that favoured you. The accuser went quiet.",
      { happinessDelta: 4, fameDelta: 2 },
    ], [
      "Receipts surfaced. They did not favour you.",
      { happinessDelta: -8, apply: (p, rng) => { p.acting.reputation = clamp(p.acting.reputation - 8); raiseScandal(p, "acting", rng, [], 3, "a co-star's account of your behaviour on set, backed up by emails"); } },
    ]),
  ], { requires: { custom: (p) => actor(p) && p.fame >= 25 && p.acting.credits.length >= 3 }, cooldown: 8 }),

  ev("act_awards_afterparty", "fame", 20, 80, "The After-Party", "Your film is a contender. Tonight is the industry's big schmoozing night, with free champagne and everybody who votes.", [
    risk("Work the room until dawn", 0.6, [
      "You charmed three voters and one studio head. People are saying your name in the right rooms.",
      { happinessDelta: 4, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation + 3); } },
    ], [
      "Somewhere around 3 a.m. you said something about a rival film that you should not have. It is already on social media.",
      { happinessDelta: -5, apply: (p, rng) => { raiseScandal(p, "acting", rng, [], 1, "a drunken remark about a rival film at an awards party"); } },
    ]),
    opt("Make an appearance and leave early", "Polite, sober and forgotten. Sometimes that is the point.", { happinessDelta: 1 }),
  ], { requires: { custom: (p) => !!p.acting.awardsRun }, cooldown: 5 }),

  // ---------- representation and the business ----------
  ev("act_agent_poached", "career", 22, 70, "A Rival Agency Calls", "A senior agent at a bigger agency took you to lunch and told you your agent is holding you back. She has a contract in her bag.", [
    opt("Switch agencies", "You made the leap. Your old agent took it badly. The new one has a bigger black book and a shorter memory.", { apply: (p, rng) => {
      const a = p.acting;
      if (!a.agent) return;
      a.agent = { name: "Priya Castellan", cut: 0.12, skill: clamp(Math.round(rng.int(65, 90) + a.reputation / 10)), yearsWith: 0, kind: "major", trust: 50 };
      if (rng.chance(0.4)) a.reputation = clamp(a.reputation - 2);
    } }),
    opt("Stay loyal", "You told her no. Your agent heard about the lunch, and about your answer, and has fought harder for you since.", { happinessDelta: 2, karmaDelta: 2, apply: (p) => { if (p.acting.agent) p.acting.agent.trust = clamp(p.acting.agent.trust + 15); } }),
    risk("Use the offer to renegotiate your cut", 0.5, [
      "Your agent knocked two points off their commission to keep you.",
      { apply: (p) => { if (p.acting.agent) p.acting.agent.cut = Math.max(0.06, p.acting.agent.cut - 0.02); } },
    ], [
      "Your agent called your bluff and was hurt. They are still working for you, but not with the same enthusiasm.",
      { happinessDelta: -2, apply: (p) => { if (p.acting.agent) p.acting.agent.trust = clamp(p.acting.agent.trust - 25); } },
    ]),
  ], { requires: { custom: (p) => actor(p) && !!p.acting.agent && p.acting.agent.kind !== "major" && p.acting.reputation >= 45 }, cooldown: 8 }),

  ev("act_ageing_role", "career", 45, 75, "Cast as the Mother (or Father)", "For the third script in a row, the part you are offered is somebody's parent. The money is steady. The leads are going to people half your age.", [
    opt("Take the character parts", "Steady work, good scripts, fewer glamour shots. You are quietly becoming the actor everyone calls for the hard scene.", { happinessDelta: -2, apply: (p) => {
      p.bankBalance += Math.round((p.currentJob?.salary ?? 0) * 0.2);
      p.acting.reputation = clamp(p.acting.reputation + 2);
      p.acting.critics = clamp(p.acting.critics + 3);
      p.acting.pull = clamp(p.acting.pull - 2);
    } }),
    risk("Hold out for a lead", 0.4, [
      "A producer wrote a part for someone your age. It is the best script you have read in years.",
      { happinessDelta: 6, apply: (p) => { p.acting.pull = clamp(p.acting.pull + 4); p.acting.reputation = clamp(p.acting.reputation + 3); } },
    ], [
      "The phone did not ring. A long, quiet year.",
      { happinessDelta: -5, apply: (p) => { p.acting.yearsSinceWork += 1; p.acting.reputation = clamp(p.acting.reputation - 3); } },
    ]),
  ], { requires: { custom: (p) => actor(p) && p.acting.credits.length >= 4 && p.acting.reputation < 85 }, cooldown: 8 }),

  ev("act_series_feud", "career", 20, 70, "A Row With the Showrunner", "The showrunner has written your character into a storyline you hate. Your agent says it will damage the character. The showrunner says it is the story.", [
    opt("Do the job and stay professional", "You played it as written. Fans loved the twist, and you made peace with it.", { happinessDelta: -1 }),
    risk("Demand a rewrite", 0.5, [
      "They softened the storyline and gave you a better scene. Respect, and a little fear.",
      { happinessDelta: 3, apply: (p) => { if (p.acting.series) p.acting.series.script = Math.min(100, p.acting.series.script + 6); } },
    ], [
      "The showrunner took it personally. The next three scripts gave you less to do.",
      { happinessDelta: -4, apply: (p) => { if (p.acting.series) p.acting.series.script = Math.max(0, p.acting.series.script - 8); p.acting.reputation = clamp(p.acting.reputation - 2); } },
    ]),
    opt("Walk off the show", "You went to your trailer, packed up and did not come back. The studio sued.", { happinessDelta: -5, apply: (p) => {
      p.acting.reputation = clamp(p.acting.reputation - 8);
      p.bankBalance -= Math.round((p.acting.series?.fee ?? 0) * 0.5);
      finishSeries(p, [], "You walked off set and the network wrote you out.");
    } }),
  ], { requires: { custom: (p) => !!p.acting.series && p.acting.series.status === "running" }, cooldown: 6 }),

  ev("act_rejection_spiral", "health", 18, 70, "Another No", "You have lost count of the auditions that went nowhere. Your agent's voice on the phone has taken on a particular, careful brightness. You cannot remember the last time you felt good in a room.", [
    opt("Take a break and see a therapist ($1,500)", "Six weeks of sessions. You did not fix the business, but you stopped taking it personally.", { bankBalanceDelta: -1_500, happinessDelta: 8, healthDelta: 2, apply: (p) => { p.acting.rejections = 0; } }),
    opt("Keep going, harder", "You booked every audition you could find. You also stopped sleeping.", { happinessDelta: -4, healthDelta: -3, apply: (p) => { p.skills.acting = clamp(p.skills.acting + 1); } }),
    opt("Quit acting", "You told your agent you were done. It felt like a death, and then like relief.", { happinessDelta: 3, loseJob: true, apply: (p) => { p.acting.rejections = 0; } }),
  ], { requires: { custom: (p) => actor(p) && p.acting.rejections >= 4 }, cooldown: 5 }),

  // ---------- child stars ----------
  ev("act_child_school", "career", 6, 17, "School or the Set?", "You have a role that shoots during term time. Your teachers are worried about your grades, your parents are worried about you, and the production is worried about the schedule.", [
    opt("Hire an on-set tutor ($2,500)", "Three hours of lessons a day in a trailer. Not the same as school, but you kept up.", { bankBalanceDelta: -2_500, setFlags: ["set_tutor"] }),
    opt("Skip classes for the shoot", "The part was everything. The homework piled up in a corner of your bedroom.", { happinessDelta: 3, fameDelta: 2, smartsDelta: -2, apply: (p) => { p.education.studyEffort = Math.max(0, p.education.studyEffort - 3); p.acting.reputation = clamp(p.acting.reputation + 2); } }),
    opt("Say no and go back to being a kid", "You turned the part down. It felt like losing something and gaining something.", { happinessDelta: 2, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation - 3); } }),
  ], { requires: { custom: (p) => actor(p) && p.age < 18 }, cooldown: 4 }),
];
