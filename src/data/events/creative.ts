/**
 * Fame-career events: online creators, musicians, actors / models and anyone famous enough to be followed.
 * Each is gated on the relevant state through `requires.custom`. State-changing effects go through `apply`,
 * which runs on a clone after the ordinary stat effects (see `ChoiceEffects.apply`).
 */
import type { PlayerState } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { clamp } from "@/lib/format";
import { raiseScandal } from "@/engine/celebrity";
import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";

const creator = (p: PlayerState) => p.influencer.active && p.influencer.bannedYears === 0;
const bigCreator = (p: PlayerState) => creator(p) && p.influencer.followers >= 5_000;
const inScene = (p: PlayerState) => p.music.status !== "none" || p.music.signed;
const unsigned = (p: PlayerState) => inScene(p) && !p.music.signed;
const performer = (p: PlayerState) => p.currentJob?.lineId === "actor" || p.currentJob?.lineId === "model";
const actor = (p: PlayerState) => p.currentJob?.lineId === "actor";
const scandal = (p: PlayerState, rng: Rng, source: "influencer" | "music" | "acting" | "general", sev?: 1 | 2 | 3) => {
  raiseScandal(p, source, rng, [], sev);
};

export const CREATIVE_EVENTS: LifeEvent[] = [
  // ---------- online creators ----------
  ev("cr_viral_clip", "fame", 12, 70, "A Clip Takes Off", "An old, throwaway clip from your channel is suddenly everywhere. Strangers are quoting it back at you.", [
    risk("Lean into it and post a follow-up", 0.6, ["The follow-up landed. The wave turned into real fans.", { happinessDelta: 6, apply: (p) => { p.influencer.followers = Math.round(p.influencer.followers * 1.25 + 400); p.influencer.peakFollowers = Math.max(p.influencer.peakFollowers, p.influencer.followers); p.influencer.burnout = clamp(p.influencer.burnout + 5); } }], ["The follow-up felt desperate and the comments were brutal. Many of the newcomers left.", { happinessDelta: -3, apply: (p) => { p.influencer.followers = Math.round(p.influencer.followers * 1.08 + 100); p.influencer.engagement = clamp(p.influencer.engagement - 6); } }]),
    opt("Enjoy it quietly", "You let the wave pass. A few thousand strangers stuck around.", { happinessDelta: 3, apply: (p) => { p.influencer.followers = Math.round(p.influencer.followers * 1.1 + 150); } }),
  ], { requires: { custom: (p) => creator(p) && p.influencer.followers >= 100 }, cooldown: 6 }),

  ev("cr_shady_sponsor", "money", 14, 70, "Too Good to Be True", "A supplement brand offers a lot of cash for one glowing video. You are fairly sure the product does nothing.", [
    risk("Take the money", 0.65, ["Nobody asked questions. The cash cleared, and a few followers rolled their eyes.", { bankBalanceDelta: 6_000, karmaDelta: -4, apply: (p) => { p.influencer.authenticity = clamp(p.influencer.authenticity - 8); } }], ["A journalist dug into the product. Your name is all over the story.", { bankBalanceDelta: 6_000, karmaDelta: -4, apply: (p, rng) => { p.influencer.authenticity = clamp(p.influencer.authenticity - 12); scandal(p, rng, "influencer", 2); } }]),
    opt("Turn it down", "You told them no. Your audience noticed you had standards.", { karmaDelta: 3, apply: (p) => { p.influencer.authenticity = clamp(p.influencer.authenticity + 3); } }),
  ], { requires: { custom: bigCreator }, cooldown: 6 }),

  ev("cr_copyright_strike", "career", 12, 70, "Copyright Strike", "An automated notice claims your latest upload uses someone else's music. It is half true.", [
    opt("Fight it with a lawyer ($1,200)", "It took weeks, but the claim was dropped.", { bankBalanceDelta: -1200, happinessDelta: -1 }),
    opt("Re-edit and re-upload", "You lost the video's momentum but kept the channel clean.", { apply: (p) => { p.influencer.cadence = clamp(p.influencer.cadence - 5); } }),
    risk("Ignore it and keep posting", 0.5, ["The claim quietly lapsed.", { happinessDelta: 2 }], ["A second strike landed. The platform suspended you for a year.", { happinessDelta: -8, apply: (p) => { p.influencer.bannedYears = 1; } }]),
  ], { requires: { custom: (p) => creator(p) && p.influencer.followers >= 300 }, cooldown: 8 }),

  ev("cr_algorithm_trend", "career", 12, 70, "The Platform Pivots", "A new feature is getting heavy promotion, and creators who jump on it early are exploding.", [
    risk("Rebuild your content around it", 0.55, ["You got in early. The algorithm rewarded you.", { apply: (p) => { p.influencer.algorithm = "boost"; p.influencer.algoYears = 2; p.influencer.followers = Math.round(p.influencer.followers * 1.12); } }], ["You chased the trend and missed. Your regulars felt abandoned.", { apply: (p) => { p.influencer.engagement = clamp(p.influencer.engagement - 8); p.influencer.followers = Math.round(p.influencer.followers * 0.95); } }]),
    opt("Stay true to what works", "Your audience appreciated the consistency.", { apply: (p) => { p.influencer.engagement = clamp(p.influencer.engagement + 3); } }),
  ], { requires: { custom: (p) => creator(p) && p.influencer.followers >= 1_000 }, cooldown: 6 }),

  ev("cr_fan_meetup", "fame", 15, 70, "A Fan Meet-Up", "A few hundred followers want to meet you in person. It is flattering, and slightly terrifying.", [
    opt("Host it properly ($2,500)", "A warm, chaotic afternoon. Fans said it was the best day of their year.", { bankBalanceDelta: -2500, happinessDelta: 7, apply: (p) => { p.influencer.engagement = clamp(p.influencer.engagement + 8); p.celeb.privacy = clamp(p.celeb.privacy - 6); } }),
    opt("Keep it online", "A livestream Q&A. Safe and a little impersonal.", { happinessDelta: 1, apply: (p) => { p.influencer.engagement = clamp(p.influencer.engagement + 2); } }),
  ], { requires: { custom: (p) => creator(p) && p.influencer.followers >= 2_000 }, cooldown: 7 }),

  ev("cr_creator_wall", "health", 14, 70, "Hitting the Wall", "You are staring at an empty script and cannot face the camera. This is not a blip.", [
    opt("Announce a break", "You stepped away. The comments were kind, and the algorithm was less so.", { happinessDelta: 6, healthDelta: 3, apply: (p) => { p.influencer.burnout = clamp(p.influencer.burnout - 30); p.influencer.cadence = clamp(p.influencer.cadence - 10); } }),
    risk("Push through", 0.5, ["You ground out a strong run and the numbers rewarded you.", { happinessDelta: -3, apply: (p) => { p.influencer.followers = Math.round(p.influencer.followers * 1.06); p.influencer.burnout = clamp(p.influencer.burnout + 10); } }], ["You collapsed on camera. It became a story, and a doctor's visit.", { healthDelta: -8, happinessDelta: -8, apply: (p) => { p.influencer.burnout = clamp(p.influencer.burnout + 15); } }]),
  ], { requires: { custom: (p) => creator(p) && p.influencer.burnout >= 60 }, cooldown: 4 }),

  // ---------- musicians ----------
  ev("cr_opening_slot", "career", 14, 60, "A Last-Minute Opening Slot", "The headliner's support act cancelled. The promoter needs somebody in 90 minutes, and you are the only name he knows.", [
    risk("Take the slot", 0.6, ["You owned the room. People were asking for your name at the bar.", { happinessDelta: 8, apply: (p) => { p.music.localFame = clamp(p.music.localFame + 8); p.music.fans += 250; } }], ["The sound was awful and the crowd talked through your set.", { happinessDelta: -4, apply: (p) => { p.music.localFame = clamp(p.music.localFame - 2); } }]),
    opt("Pass, you are not ready", "You watched from the back and took notes.", { skillDeltas: { music: 1 } }),
  ], { requires: { custom: unsigned }, cooldown: 4 }),

  ev("cr_bandmate_ego", "career", 15, 60, "The Bassist Wants Songs", "A bandmate is demanding more writing credits and a bigger share. Rehearsals have been tense for weeks.", [
    opt("Give them a couple of songs", "The record got a little weirder and the band got a lot closer.", { apply: (p) => { for (const m of p.music.members) m.loyalty = clamp(m.loyalty + 8); p.music.songwriting = clamp(p.music.songwriting - 1); } }),
    risk("Stand your ground", 0.5, ["They grumbled, then backed down. Order restored.", { happinessDelta: 2 }], ["They quit mid-rehearsal and took the van keys with them.", { happinessDelta: -6, apply: (p) => { const worst = [...p.music.members].sort((a, b) => a.loyalty - b.loyalty)[0]; if (worst) p.music.members = p.music.members.filter((m) => m.id !== worst.id); for (const m of p.music.members) m.loyalty = clamp(m.loyalty - 6); } }]),
  ], { requires: { custom: (p) => p.music.status === "band" && p.music.members.length >= 1 }, cooldown: 5 }),

  ev("cr_scout_in_crowd", "career", 17, 45, "A Man With a Lanyard", "A woman with an industry lanyard tells you she liked your set. She will not say who she works for.", [
    risk("Give her your demo and your number", 0.55, ["She worked for a label. She is making calls on your behalf.", { happinessDelta: 8, apply: (p) => { p.music.localFame = clamp(p.music.localFame + 10); p.music.fans += 600; p.music.labelStanding = clamp(p.music.labelStanding + 8); } }], ["She was a blogger with a very small audience. A nice evening, nothing more.", { happinessDelta: 1 }]),
    opt("Play it cool", "You kept your mystery. She forgot your name by morning.", {}),
  ], { requires: { custom: (p) => unsigned(p) && (p.music.localFame >= 25 || p.music.demo >= 50) }, cooldown: 6 }),

  ev("cr_label_single", "money", 18, 60, "The Label Wants a Single", "Your A&R rep played you a song written by committee and said, 'This is the one.' It is catchy and hollow.", [
    opt("Record it as it is", "It charted. It also made you a little sick.", { bankBalanceDelta: 8_000, happinessDelta: -3, apply: (p) => { p.music.relevance = clamp(p.music.relevance + 8); p.music.fans += 4_000; if (p.music.contract) p.music.contract.creativeControl = clamp(p.music.contract.creativeControl - 6); } }),
    risk("Refuse and push your own song", 0.45, ["They heard the demo and gave in. Your song became the single.", { happinessDelta: 8, apply: (p) => { p.music.labelStanding = clamp(p.music.labelStanding + 6); if (p.music.contract) p.music.contract.creativeControl = clamp(p.music.contract.creativeControl + 8); } }], ["The label was furious. They froze your marketing budget.", { happinessDelta: -5, apply: (p) => { p.music.labelStanding = clamp(p.music.labelStanding - 15); } }]),
  ], { requires: { custom: (p) => p.music.signed }, cooldown: 5 }),

  ev("cr_writers_block", "health", 14, 70, "The Songs Dried Up", "You sit at the piano every night and nothing comes. Not a lyric, not a riff.", [
    opt("Get away for a few weeks", "Walking, reading, no instruments. The first idea came on the way home.", { happinessDelta: 4, apply: (p) => { p.music.burnout = clamp(p.music.burnout - 15); p.music.blockYears = 0; } }),
    opt("Force it", "You wrote forty bad songs and one good one.", { happinessDelta: -3, skillDeltas: { music: 1 }, apply: (p) => { p.music.songwriting = clamp(p.music.songwriting + 2); p.music.burnout = clamp(p.music.burnout + 8); } }),
  ], { requires: { custom: (p) => inScene(p) && (p.music.blockYears > 0 || p.music.burnout >= 65) }, cooldown: 4 }),

  // ---------- actors and models ----------
  ev("cr_method_role", "career", 18, 70, "A Role That Demands Everything", "A director wants you to stay in character for the entire shoot. The part is career-making, if it does not break you first.", [
    risk("Go all the way in", 0.55, ["Critics called it fearless. People are saying your name in award conversations.", { happinessDelta: -2, apply: (p) => { p.acting.critics = clamp(p.acting.critics + 10); p.acting.reputation = clamp(p.acting.reputation + 6); p.skills.acting = clamp(p.skills.acting + 2); } }], ["Three weeks in, you were sleeping in a trailer and shouting at strangers. The shoot ended early.", { healthDelta: -6, happinessDelta: -8, apply: (p, rng) => { p.acting.reputation = clamp(p.acting.reputation - 4); scandal(p, rng, "acting", 1); } }]),
    opt("Keep a professional distance", "A solid performance, and you went home at night.", { happinessDelta: 2, apply: (p) => { p.acting.critics = clamp(p.acting.critics + 2); } }),
  ], { requires: { custom: (p) => actor(p) && p.acting.credits.length >= 1 }, cooldown: 6 }),

  ev("cr_break_typecast", "career", 18, 70, "Against Type", "Everyone sees you as one thing. A small, strange film wants you to play the opposite.", [
    risk("Take the risk", 0.55, ["Critics were stunned. You are no longer 'that kind of actor'.", { happinessDelta: 6, apply: (p) => { p.acting.typecast = null; p.acting.critics = clamp(p.acting.critics + 8); } }], ["The film vanished and so did your next three offers.", { happinessDelta: -4, apply: (p) => { p.acting.reputation = clamp(p.acting.reputation - 5); } }]),
    opt("Stay in your lane", "It is a comfortable living, and a comfortable rut.", { bankBalanceDelta: 4_000 }),
  ], { requires: { custom: (p) => performer(p) && !!p.acting.typecast }, cooldown: 6 }),

  // ---------- anyone famous ----------
  ev("cr_paparazzi", "fame", 16, 90, "Long Lenses", "A photographer has been outside your house all week. Today there is a picture of you in the paper, looking like a mess.", [
    risk("Confront him on the pavement", 0.4, ["You said your piece calmly and he left. A neighbour filmed it, in your favour.", { happinessDelta: 3, fameDelta: 1 }], ["It was filmed, and not in your favour.", { happinessDelta: -5, apply: (p, rng) => { p.celeb.privacy = clamp(p.celeb.privacy - 6); scandal(p, rng, "general", 1); } }]),
    opt("Ignore it", "The story ran for a day and was replaced by someone else's disaster.", { apply: (p) => { p.celeb.privacy = clamp(p.celeb.privacy - 5); } }),
    opt("Move into a gated place ($6,000)", "Expensive, but the street is quiet again.", { bankBalanceDelta: -6000, happinessDelta: 3, apply: (p) => { p.celeb.privacy = clamp(p.celeb.privacy + 15); } }),
  ], { requires: { custom: (p) => p.fame >= 25 && !p.celeb.security }, cooldown: 6 }),

  ev("cr_stalker_letter", "fame", 16, 90, "The Same Handwriting", "That is the sixth letter this month. This one knows what you had for breakfast.", [
    opt("Go to the police", "They took it seriously. The letters stopped, for now.", { happinessDelta: -2, apply: (p) => { p.celeb.stalker = clamp(p.celeb.stalker - 25); } }),
    opt("Hire a bodyguard ($8,000)", "A large man now follows you everywhere. You feel safer, and more watched.", { bankBalanceDelta: -8000, apply: (p) => { p.celeb.stalker = clamp(p.celeb.stalker - 35); p.celeb.privacy = clamp(p.celeb.privacy + 5); } }),
    risk("Write back", 0.3, ["It was a lonely teenager. A kind reply ended it.", { happinessDelta: 4, apply: (p) => { p.celeb.stalker = clamp(p.celeb.stalker - 30); } }], ["It made things much worse.", { happinessDelta: -8, apply: (p) => { p.celeb.stalker = clamp(p.celeb.stalker + 20); } }]),
  ], { requires: { custom: (p) => p.celeb.stalker >= 25 }, cooldown: 4 }),
];
