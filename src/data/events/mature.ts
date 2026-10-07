import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";

const hasLover = (p: PlayerState) => p.relatives.some((r) => r.relation === "Lover" && r.alive && r.partnerStatus === "affair");
const open = (p: PlayerState) => p.flags.includes("open_relationship");

/**
 * Adult-themed scenarios (mature content only, 18+). Suggestive rather than explicit.
 * Everyone involved is an adult and a willing participant.
 */
export const MATURE_EVENTS: LifeEvent[] = [
  // ---------- dating, flings and attraction ----------
  ev("mx_flirty_stranger", "romance", 18, 60, "Eyes Across the Room", "Someone gorgeous has been making eye contact with you all night.", [
    risk("Buy them a drink", 0.55, ["The conversation sparked. You left with their number (and a promise).", { happinessDelta: 7, addRelative: { relation: "Partner", ageOffset: [-5, 6], partnerStatus: "dating" } }], ["They had a partner waiting at the door. Awkward.", { happinessDelta: -3 }], "looks"),
    opt("Wink and look away", "You played it cool. They noticed.", { happinessDelta: 2, skillDeltas: { charisma: 1 } }),
    opt("Leave early", "You went home alone with your dignity.", {}),
  ], { mature: true, requires: { hasPartner: false }, cooldown: 3, weight: 1.5 }),
  ev("mx_one_night", "romance", 18, 55, "Just One Night", "You and a charming stranger both know where the night is heading.", [
    risk("Go home together", 0.9, ["It was a night to remember. You parted on good terms.", { happinessDelta: 8, healthDelta: 1 }], ["Awkward morning after. You both pretended it didn't happen.", { happinessDelta: -2 }]),
    opt("Swap numbers instead", "A slower burn. Your phone buzzed all week.", { happinessDelta: 4 }),
    opt("Walk away", "You walked away, a bit proud and a bit sorry.", { happinessDelta: 1 }),
  ], { mature: true, requires: { hasPartner: false }, cooldown: 4 }),
  ev("mx_walk_of_shame", "romance", 18, 45, "The Walk of Shame", "You wake up in an unfamiliar flat wearing one sock and last night's regrets.", [
    opt("Own it with a grin", "You strolled home with your head high. A neighbour applauded.", { happinessDelta: 5, fameDelta: 1 }),
    opt("Order a car and hide", "You hid under a hoodie the whole ride.", { bankBalanceDelta: -25, happinessDelta: -1 }),
    opt("Text your friends the whole story", "Group chat was thrilled.", { happinessDelta: 4, relationshipDelta: { target: "Friend", delta: 4 } }),
  ], { mature: true, cooldown: 5 }),
  ev("mx_friends_benefits", "romance", 18, 50, "Friends... With Benefits?", "A good friend suggests a no-strings arrangement.", [
    risk("Say yes", 0.6, ["It worked out better than expected. Easy, fun, drama-free.", { happinessDelta: 7, healthDelta: 1 }], ["Feelings got involved on one side. The friendship cracked.", { relationshipDelta: { target: "Friend", delta: -25 }, happinessDelta: -6 }]),
    opt("Politely decline", "You kept the friendship intact.", { relationshipDelta: { target: "Friend", delta: 3 } }),
  ], { mature: true, requires: { hasFriend: true, hasPartner: false }, cooldown: 6 }),
  ev("mx_coworker_spark", "romance", 21, 55, "After-Hours", "A late night at the office turns flirty. The elevator ride is very, very quiet.", [
    opt("Kiss them", "Fireworks. HR would call it a policy violation. You called it Tuesday.", { happinessDelta: 8, performanceDelta: -3, karmaDelta: -2 }),
    opt("Keep it professional", "You said goodnight. Maybe another time.", { performanceDelta: 3 }),
    risk("Suggest drinks somewhere private", 0.5, ["It turned into a discreet fling. Nobody at work suspected a thing.", { happinessDelta: 7 }], ["Someone saw you leave together. By Monday, everyone knew.", { performanceDelta: -8, happinessDelta: -4 }]),
  ], { mature: true, requires: { hasJob: true, hasPartner: false }, cooldown: 5 }),
  ev("mx_ex_midnight", "romance", 20, 55, "Midnight Text", "At 1am your phone lights up: 'Are you awake? I miss you.' It's your ex.", [
    opt("Reply and invite them over", "Old habits die hard. It was good. It was also a mistake.", { happinessDelta: 6, karmaDelta: -2 }),
    opt("Leave them on read", "You turned your phone over and went to sleep.", { happinessDelta: 1 }),
    opt("Block the number", "Closure, delivered via the block button.", { happinessDelta: 2, karmaDelta: 1 }),
  ], { mature: true, requires: { custom: (p) => p.relatives.some((r) => r.partnerStatus === "ex" && r.relation === "Partner" && r.alive) && !p.relatives.some((r) => r.relation === "Partner" && r.partnerStatus !== "ex" && r.alive) }, cooldown: 6 }),
  ev("mx_bachelor_party", "romance", 21, 45, "Bachelor / Bachelorette Party", "A friend's pre-wedding celebration is heading to Vegas.", [
    opt("Go all out ($2,000)", "What happens in Vegas... was documented by seven people.", { bankBalanceDelta: -2000, happinessDelta: 10, relationshipDelta: { target: "Friend", delta: 8 } }),
    opt("Keep it classy", "A steak dinner and a show. Civilised.", { bankBalanceDelta: -500, happinessDelta: 5 }),
    risk("Do something you'll regret", 0.4, ["You woke up with a tattoo and no regrets.", { happinessDelta: 6, looksDelta: -1 }], ["You woke up married to a stranger. The annulment cost $1,500.", { bankBalanceDelta: -1500, happinessDelta: -4 }]),
  ], { mature: true, requires: { hasFriend: true, minBank: 2000 }, cooldown: 8 }),
  ev("mx_strip_club", "romance", 21, 70, "Night Out", "Your friends want to end the night at a gentlemen's/ladies' club.", [
    opt("Join them ($300)", "Loud music, big tips, and a lot of explaining to do.", { bankBalanceDelta: -300, happinessDelta: 6, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Be the designated driver", "You kept everyone safe and sober.", { karmaDelta: 3 }),
    opt("Pass", "Not your scene.", {}),
  ], { mature: true, cooldown: 5 }),
  ev("mx_lingerie_gift", "romance", 18, 80, "Special Occasion", "Valentine's Day is coming up and you're shopping for {partner}.", [
    opt("Something from the boutique ($200)", "The gift was a hit. The evening ended early.", { bankBalanceDelta: -200, relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: 6 }),
    opt("Flowers and chocolates", "Classic, thoughtful, appreciated.", { bankBalanceDelta: -60, relationshipDelta: { target: "Partner", delta: 6 } }),
    opt("Forget until the 14th", "A last-minute petrol-station bouquet. {partner} noticed.", { relationshipDelta: { target: "Partner", delta: -8 } }),
  ], { mature: true, requires: { hasPartner: true }, cooldown: 3 }),
  ev("mx_anniversary_night", "romance", 20, 90, "Anniversary Night", "You and {partner} want to make tonight unforgettable.", [
    opt("Candlelit dinner, then the bedroom", "The evening ended exactly the way you hoped.", { bankBalanceDelta: -200, relationshipDelta: { target: "Partner", delta: 12 }, happinessDelta: 8 }),
    opt("Stay in with takeaway and a film", "Cosy, easy, and perfect.", { relationshipDelta: { target: "Partner", delta: 7 }, happinessDelta: 5 }),
    opt("Both fall asleep at 9pm", "Parenthood/work is exhausting. You'll make it up soon.", { relationshipDelta: { target: "Partner", delta: -2 }, healthDelta: 2 }),
  ], { mature: true, requires: { hasPartner: true }, cooldown: 3 }),
  ev("mx_sexting", "romance", 18, 60, "A Spicy Text", "{partner} sends you a very flirty message in the middle of a meeting.", [
    opt("Reply in kind", "You didn't hear a word of the meeting. Worth it.", { relationshipDelta: { target: "Partner", delta: 7 }, happinessDelta: 5, performanceDelta: -2 }),
    opt("Wait until you're alone", "You waited, then wrote a masterpiece.", { relationshipDelta: { target: "Partner", delta: 5 }, happinessDelta: 4 }),
    opt("Accidentally send it to the family group chat", "Mortifying. Your mum has replied with an emoji.", { happinessDelta: -6, relationshipDelta: { target: "Parent", delta: -3 }, fameDelta: 0 }),
  ], { mature: true, requires: { hasPartner: true }, cooldown: 4 }),
  ev("mx_search_history", "romance", 18, 70, "Browser History", "{partner} stumbles across something in your search history.", [
    opt("Laugh it off", "They laughed too. You both learned something.", { relationshipDelta: { target: "Partner", delta: 4 }, happinessDelta: 2 }),
    opt("Deny it's yours", "Nobody believed you.", { relationshipDelta: { target: "Partner", delta: -3 } }),
    opt("Have an honest chat", "An honest talk about fantasies. Healthy, if awkward.", { relationshipDelta: { target: "Partner", delta: 8 }, happinessDelta: 3 }),
  ], { mature: true, requires: { hasPartner: true }, cooldown: 8, weight: 0.7 }),
  ev("mx_threesome_invite", "romance", 20, 55, "A Suggestion", "{partner} brings up trying a threesome. You weren't expecting that.", [
    risk("Say yes", 0.65, ["You agreed. Everyone was respectful, nobody got hurt, and there's a story you'll never tell your mother.", { relationshipDelta: { target: "Partner", delta: 8 }, happinessDelta: 9, setFlags: ["threesome"], addRelative: { relation: "Friend", ageOffset: [-4, 6] } }], ["It got awkward fast and the mood collapsed. You laughed about it later, sort of.", { relationshipDelta: { target: "Partner", delta: -6 }, happinessDelta: -3 }]),
    opt("Say no, kindly", "You said no. They said it was fine, and meant it.", { relationshipDelta: { target: "Partner", delta: 2 } }),
    opt("Ask for time to think", "You talked about boundaries for a week. It strengthened you both.", { relationshipDelta: { target: "Partner", delta: 5 }, smartsDelta: 1 }),
  ], { mature: true, requires: { hasPartner: true }, once: true, weight: 0.6 }),
  ev("mx_swinger_invite", "romance", 25, 60, "A Curious Invitation", "Another couple at the dinner party hands you a card for a private club.", [
    opt("Talk it over with {partner}", "A long, honest conversation. You agreed to give it a try, with clear rules.", { setFlags: ["open_relationship"], relationshipDelta: { target: "Partner", delta: 6 }, happinessDelta: 4 }),
    opt("Throw the card away", "Not for you.", {}),
    opt("Go alone and say nothing", "You went alone. Guilt was your plus-one.", { happinessDelta: 3, karmaDelta: -6, healthDelta: -1 }),
  ], { mature: true, requires: { hasPartner: true, custom: (p) => !open(p) }, once: true, weight: 0.5 }),
  ev("mx_open_chat", "romance", 22, 70, "The Big Conversation", "You and {partner} have been drifting. They ask what you actually want.", [
    opt("Propose opening the relationship", "It was a tough conversation. You're both trying a new approach.", { setFlags: ["open_relationship"], relationshipDelta: { target: "Partner", delta: 4 }, happinessDelta: 2 }),
    opt("Recommit to each other", "You booked a trip and turned off your phones.", { relationshipDelta: { target: "Partner", delta: 12 }, happinessDelta: 6, bankBalanceDelta: -1500 }),
    opt("Say nothing and drift", "You said nothing. The distance grew.", { relationshipDelta: { target: "Partner", delta: -10 }, happinessDelta: -4 }),
  ], { mature: true, requires: { hasPartner: true, custom: (p) => !open(p) && p.relatives.some((r) => r.relation === "Partner" && r.relationshipBar < 55) }, cooldown: 6 }),

  // ---------- affairs & fallout ----------
  ev("mx_tempted_again", "romance", 22, 65, "Temptation", "A colleague/friend has made it clear they'd happily take things further.", [
    risk("Give in", 0.8, ["A secret rendezvous. You got away with it. The guilt, though.", { happinessDelta: 4, karmaDelta: -8, addRelative: { relation: "Friend", ageOffset: [-4, 6] } }], ["{partner} found out. It was ugly.", { karmaDelta: -8, endRelationship: "breakup", happinessDelta: -12 }]),
    opt("Shut it down", "You said no, and you meant it.", { karmaDelta: 4, relationshipDelta: { target: "Partner", delta: 3 } }),
    opt("Tell {partner} about the advance", "Honesty built trust. {partner} was grateful.", { relationshipDelta: { target: "Partner", delta: 8 }, karmaDelta: 3 }),
  ], { mature: true, requires: { hasPartner: true, custom: (p) => !open(p) }, cooldown: 6 }),
  ev("mx_lover_demands", "romance", 20, 70, "Make Your Choice", "Your secret lover is tired of sneaking around. 'Leave them or we're done.'", [
    opt("Leave your partner", "You ended things and chose the lover. Your friends are not thrilled.", { endRelationship: "breakup", happinessDelta: -3, karmaDelta: -3 }),
    opt("End the affair", "You ended it. It hurt, but you did the right thing.", { happinessDelta: -4, karmaDelta: 3 }),
    risk("Stall for time", 0.5, ["You bought another few months of secrecy.", { happinessDelta: 1, karmaDelta: -2 }], ["Your lover told your partner everything.", { exposeAffair: true, happinessDelta: -8 }]),
  ], { mature: true, requires: { hasPartner: true, custom: hasLover }, cooldown: 4 }),
  ev("mx_lover_blackmail", "crime", 20, 70, "A Threat", "Your lover has screenshots of everything. 'Pay me $15,000 or I tell your partner.'", [
    opt("Pay up ($15,000)", "You paid. They vanished. The secret is safe.", { bankBalanceDelta: -15000, happinessDelta: -5 }),
    opt("Confess to your partner first", "You told {partner} yourself. It was awful, but at least it was on your terms.", { exposeAffair: true, happinessDelta: -4, karmaDelta: 4 }),
    risk("Call their bluff", 0.45, ["They backed down. Nothing happened.", { happinessDelta: 3 }], ["They made good on the threat.", { exposeAffair: true, happinessDelta: -8 }]),
  ], { mature: true, requires: { hasPartner: true, minBank: 15000, custom: hasLover }, once: true }),
  ev("mx_lover_pregnant", "family", 20, 45, "Unexpected News", "Your secret lover says they're expecting. 'It's yours.'", [
    opt("Stand by them", "You promised to support them and the baby.", { pregnancy: "lover", happinessDelta: -2, karmaDelta: 2 }),
    opt("Tell {partner} everything", "A devastating conversation, and an honest one.", { pregnancy: "lover", exposeAffair: true, happinessDelta: -6 }),
    opt("Pay them to go away ($30,000)", "It cost a fortune and you can't sleep.", { bankBalanceDelta: -30000, karmaDelta: -10, happinessDelta: -6 }),
  ], { mature: true, requires: { hasPartner: true, custom: (p) => hasLover(p) && p.relatives.some((r) => r.relation === "Lover" && r.alive && r.gender === "Female") && !p.pregnancy }, once: true, weight: 0.4 }),
  ev("mx_partner_cheats_found", "romance", 20, 75, "The Evidence", "You find proof that {partner} has been cheating on you.", [
    opt("Confront them calmly", "They broke down and admitted everything. You need time to decide.", { relationshipDelta: { target: "Partner", delta: -20 }, happinessDelta: -8 }),
    opt("Leave without a word", "You packed a bag and left a note. That's all.", { endRelationship: "breakup", happinessDelta: -10, karmaDelta: 1 }),
    opt("Cheat right back", "Revenge felt great for about a day.", { karmaDelta: -6, happinessDelta: 2, relationshipDelta: { target: "Partner", delta: -15 } }),
    risk("Seek revenge", 0.4, ["You wrecked their car and posted about it. They got the message.", { karmaDelta: -8, endRelationship: "breakup", happinessDelta: 3 }], ["Your revenge went too far and the police got involved.", { karmaDelta: -10, endRelationship: "breakup", arrest: { name: "Criminal Damage", description: "Your revenge campaign was caught on a neighbour's camera.", years: 2, severity: "minor" } }]),
  ], { mature: true, requires: { hasPartner: true, custom: (p) => !open(p) }, cooldown: 12, weight: 0.5 }),
  ev("mx_lover_spouse", "crime", 22, 60, "The Husband/Wife Came Home", "Your lover's spouse has found out and is waiting outside.", [
    opt("Apologise and leave", "You got out of there. It cost you dignity, nothing else.", { happinessDelta: -4, karmaDelta: -2 }),
    risk("Stand your ground", 0.4, ["Words were exchanged and nothing more.", { happinessDelta: -2 }], ["It turned physical and you came off worst.", { healthDelta: -15, happinessDelta: -6 }], "health"),
    opt("Run", "You ran, half-dressed, across the lawn. A legend was born.", { happinessDelta: -3, fameDelta: 1 }),
  ], { mature: true, requires: { custom: hasLover }, once: true, weight: 0.6 }),
  ev("mx_partner_forgives", "romance", 22, 70, "Forgiveness", "{partner} says they're willing to work through what happened.", [
    opt("Commit to couples therapy ($2,400)", "A year of hard work and honest conversations. You rebuilt.", { bankBalanceDelta: -2400, relationshipDelta: { target: "Partner", delta: 20 }, happinessDelta: 4 }),
    opt("Promise it won't happen again", "You said the right words. Time will tell.", { relationshipDelta: { target: "Partner", delta: 8 } }),
  ], { mature: true, requires: { hasPartner: true, flagsAll: ["cheater"] }, once: true, weight: 0.5 }),
  ev("mx_std_scare", "health", 18, 60, "Test Results", "A friend mentions they've tested positive for something. You realise you should get checked.", [
    opt("Get tested ($80)", "All clear. Responsible, and relieved.", { bankBalanceDelta: -80, happinessDelta: 4, smartsDelta: 1 }),
    risk("Put it off", 0.75, ["Nothing came of it. You got lucky.", { happinessDelta: -1 }], ["It was something that needed treatment sooner than you'd hoped.", { diseaseTrigger: "chlamydia", happinessDelta: -5 }]),
  ], { mature: true, cooldown: 6, weight: 0.6 }),
  ev("mx_disclosure", "romance", 18, 70, "The Conversation", "You've been carrying a health diagnosis and a new partner has asked to take things further.", [
    opt("Tell them honestly", "They listened, thanked you for your honesty, and stayed.", { relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: 2, karmaDelta: 4 }),
    opt("Wait for the right moment", "You waited. Awkwardly.", { happinessDelta: -3 }),
  ], { mature: true, requires: { hasPartner: true, custom: (p) => p.diseases.some((d) => ["herpes", "hiv"].includes(d.id)) }, once: true }),

  // ---------- pregnancy ----------
  ev("mx_pregnancy_surprise", "family", 20, 44, "Surprise!", "Either a happy accident or a very long conversation: a pregnancy test shows two lines.", [
    opt("Embrace it", "You decided to go for it. Nerves and excitement in equal measure.", { pregnancy: "partner", happinessDelta: 6 }),
    opt("Ask for a few days alone", "You took time to think and ended up smiling.", { pregnancy: "partner", happinessDelta: 3, smartsDelta: 1 }),
  ], { requires: { hasPartner: true, custom: (p) => !p.pregnancy && p.relatives.some((r) => r.relation === "Partner" && r.alive && r.age <= 44 && r.gender !== p.gender) }, cooldown: 4, weight: 0.6 }),
  ev("mx_babymoon", "family", 20, 50, "Babymoon", "A trip before the baby arrives?", [
    opt("Quiet spa weekend ($900)", "You napped, ate well, and talked about names.", { bankBalanceDelta: -900, happinessDelta: 6, relationshipDelta: { target: "Partner", delta: 8 } }),
    opt("Stay home and nest", "You painted the nursery together.", { happinessDelta: 4, relationshipDelta: { target: "Partner", delta: 5 } }),
  ], { requires: { custom: (p) => !!p.pregnancy }, once: true }),
  ev("mx_prenatal_scare", "health", 20, 44, "Prenatal Scare", "A routine check-up shows something the doctor wants to monitor.", [
    opt("Follow every recommendation", "Extra scans, extra rest. All is well.", { bankBalanceDelta: -1200, healthDelta: 1, happinessDelta: -2 }),
    risk("Carry on as normal", 0.7, ["Everything turned out fine.", { happinessDelta: 2 }], ["There were complications and a rough few weeks.", { healthDelta: -12, happinessDelta: -8, bankBalanceDelta: -4000 }], "health"),
  ], { requires: { custom: (p) => !!p.pregnancy }, cooldown: 5, weight: 0.8 }),
  ev("mx_baby_name", "family", 20, 50, "What to Call Them?", "The big debate: baby names.", [
    opt("A family name", "A tribute to a grandparent. Everybody cried.", { relationshipDelta: { target: "Parent", delta: 6 }, happinessDelta: 3 }),
    opt("Something unique", "You chose a name nobody has heard before. It's growing on people.", { happinessDelta: 3 }),
    opt("Let {partner} decide", "Peace in the house.", { relationshipDelta: { target: "Partner", delta: 5 } }),
  ], { requires: { custom: (p) => !!p.pregnancy }, once: true }),

  // ---------- adult work ----------
  ev("mx_dancer_regular", "career", 18, 45, "A Big Spender", "A regular at the club keeps tipping heavily and asking for more.", [
    opt("Keep it professional", "They tipped well and respected the boundaries.", { bankBalanceDelta: 1500, happinessDelta: 2 }),
    opt("Report them to security", "Security handled it. Management appreciated it.", { karmaDelta: 2, performanceDelta: 3 }),
    opt("Accept an expensive gift", "A designer bag. It came with expectations.", { bankBalanceDelta: 2500, karmaDelta: -2 }),
  ], { mature: true, requires: { jobLine: ["dancer"] }, cooldown: 4 }),
  ev("mx_escort_client", "crime", 18, 50, "A Difficult Client", "A new client pushes your boundaries in ways you hadn't agreed to.", [
    opt("Call it off and leave", "You left immediately. Your agency backed you.", { performanceDelta: 4, happinessDelta: -2 }),
    risk("Stand firm and renegotiate", 0.6, ["They respected your boundaries and paid extra.", { bankBalanceDelta: 3000, performanceDelta: 5 }], ["It escalated, and you left shaken.", { happinessDelta: -8, healthDelta: -8 }]),
  ], { mature: true, requires: { jobLine: ["escort"] }, cooldown: 4 }),
  ev("mx_creator_viral", "fame", 18, 45, "Your Page Blows Up", "A post goes viral and your subscriber count triples overnight.", [
    opt("Ride the wave", "Subscribers poured in. Your bank balance loved it.", { bankBalanceDelta: 12000, fameDelta: 5, happinessDelta: 6 }),
    opt("Keep a low profile", "You kept things steady and private.", { bankBalanceDelta: 3000 }),
  ], { mature: true, requires: { jobLine: ["creator"] }, cooldown: 4 }),
  ev("mx_creator_troll", "fame", 18, 50, "Trolls", "Harassment is flooding your comments.", [
    opt("Block, report, move on", "You cleaned house. Quiet again.", { happinessDelta: -2 }),
    opt("Clap back publicly", "Your reply went viral. So did the hate.", { fameDelta: 4, happinessDelta: -3 }),
    opt("Hire a moderation team ($1,500)", "Peace of mind, for a price.", { bankBalanceDelta: -1500, happinessDelta: 3 }),
  ], { mature: true, requires: { jobLine: ["creator"] }, cooldown: 5 }),

  // ---------- partying, nightlife, boundaries ----------
  ev("mx_nightclub", "general", 18, 45, "Dance Floor", "The bass is deafening and your friends are pulling you onto the dance floor.", [
    opt("Dance until sunrise", "You danced all night. Your feet disagreed with you for days.", { happinessDelta: 8, healthDelta: -1, fameDelta: 0, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Chat at the bar", "You made a new friend over a quiet drink.", { addRelative: { relation: "Friend", ageOffset: [-5, 6] }, happinessDelta: 4 }),
    opt("Leave early", "You were home by midnight.", { healthDelta: 1 }),
  ], { mature: true, cooldown: 4 }),
  ev("mx_hot_tub", "romance", 20, 60, "Hot Tub Party", "A friend's party has a hot tub, string lights, and no supervision.", [
    opt("Dive in", "The night got playful. Nobody remembers who started the water fight.", { happinessDelta: 7, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Hold the drinks", "You kept a clear head and watched the show.", { happinessDelta: 3 }),
  ], { mature: true, cooldown: 6 }),
  ev("mx_consent_talk", "romance", 18, 40, "Setting Boundaries", "You and a new partner talk openly about what you each want and don't want.", [
    opt("Be honest and listen", "The honesty made things much better, in every sense.", { relationshipDelta: { target: "Partner", delta: 10 }, happinessDelta: 5, smartsDelta: 1 }),
    opt("Avoid the topic", "Things stayed awkward longer than they needed to.", { relationshipDelta: { target: "Partner", delta: -4 } }),
  ], { mature: true, requires: { hasPartner: true }, once: true, weight: 1.2 }),
  ev("mx_love_triangle", "romance", 18, 40, "Two Admirers", "Two people you like are both asking you out.", [
    opt("Pick one", "You chose with your heart. The other took it gracefully.", { addRelative: { relation: "Partner", ageOffset: [-4, 5], partnerStatus: "dating" }, happinessDelta: 6 }),
    opt("Date neither for now", "You decided to focus on yourself.", { smartsDelta: 1, happinessDelta: 2 }),
    risk("Date both", 0.35, ["It stayed a delicious secret for a while.", { happinessDelta: 6, karmaDelta: -4 }], ["Both found out at the same time, from the same friend.", { happinessDelta: -8, relationshipDelta: { target: "Friend", delta: -10 } }]),
  ], { mature: true, requires: { hasPartner: false }, once: true, weight: 0.6 }),

  // ---------- murder & violence ----------
  ev("mx_conscience", "crime", 18, 90, "Sleepless Nights", "The memory of what you did won't leave you alone.", [
    opt("See a therapist ($800)", "You couldn't say everything, but it helped to say something.", { bankBalanceDelta: -800, happinessDelta: 4 }),
    opt("Drink it away", "It worked, until morning.", { happinessDelta: 1, viceDelta: { alcohol: 8 } }),
    opt("Turn yourself in", "You walked into the station and told them everything.", { arrest: { name: "Murder", description: "You confessed to a killing the police never connected to you.", years: 25, severity: "heinous" }, karmaDelta: 20, clearFlags: ["under_investigation"], happinessDelta: 5 }),
  ], { mature: true, requires: { flagsAll: ["killer"] }, cooldown: 4, weight: 2 }),
  ev("mx_detective_visit", "crime", 18, 90, "Routine Questions", "A detective turns up at your door: 'Just a few routine questions.'", [
    risk("Answer calmly", 0.65, ["You gave nothing away. He left, but he wrote something down.", { happinessDelta: -3 }], ["You contradicted yourself. He didn't need to write anything down.", { arrest: { name: "Murder", description: "Contradictions in your statement put you at the scene.", years: 30, severity: "heinous" }, happinessDelta: -8 }], "smarts"),
    opt("Demand a lawyer ($5,000)", "Your lawyer did the talking. Nothing came of it.", { bankBalanceDelta: -5000, happinessDelta: -2 }),
    opt("Slam the door", "That looked suspicious. You know it.", { happinessDelta: -4 }),
  ], { mature: true, requires: { flagsAll: ["under_investigation"] }, cooldown: 3, weight: 2 }),
  ev("mx_witness_saw", "crime", 18, 80, "I Saw Everything", "A stranger approaches: 'I saw what you did that night. It'll cost you.'", [
    opt("Pay them ($40,000)", "You paid. They promised silence.", { bankBalanceDelta: -40000, happinessDelta: -6 }),
    risk("Silence the witness", 0.5, ["The problem went away. So did your last piece of innocence.", { kill: true, happinessDelta: -8 }], ["It went wrong. Very wrong.", { arrest: { name: "Murder", description: "You were caught trying to silence a witness.", years: 40, severity: "heinous", capital: true }, kill: true, happinessDelta: -12 }]),
    opt("Call the witness's bluff", "They never came back. You were lucky.", { happinessDelta: -2 }),
  ], { mature: true, requires: { flagsAll: ["killer"] }, once: true, weight: 1.2 }),
  ev("mx_hitman_offer", "crime", 20, 80, "A Dark Proposal", "A shady acquaintance leans close: 'I know a man who solves problems. Anyone bothering you?'", [
    opt("Decline and walk away", "You walked away. Your heart was pounding.", { karmaDelta: 3 }),
    opt("Hire him to scare someone ($6,000)", "A scary visit. Nobody was hurt. The problem went away.", { bankBalanceDelta: -6000, karmaDelta: -8 }),
    opt("Tell the police", "A sting caught the fixer. The police thanked you.", { karmaDelta: 8, happinessDelta: 2 }),
  ], { mature: true, once: true, weight: 0.5 }),
  ev("mx_home_invader", "crime", 18, 85, "Intruder", "You hear glass break downstairs at 3am.", [
    risk("Confront the intruder", 0.6, ["You scared them off. Your heart took an hour to slow down.", { happinessDelta: -2, fameDelta: 0 }], ["The intruder was armed. You were hurt.", { healthDelta: -22, happinessDelta: -8, bankBalanceDelta: -3000 }], "health"),
    opt("Lock the bedroom door and call the police", "The police arrived in minutes. Nothing was taken.", { happinessDelta: -3 }),
    risk("Defend yourself with force", 0.55, ["Self-defence. The police cleared you, but it will stay with you.", { karmaDelta: 5, happinessDelta: -10 }], ["You were seriously injured in the struggle.", { healthDelta: -30, happinessDelta: -10 }], "health"),
  ], { mature: true, requires: { hasProperty: true }, cooldown: 12, weight: 0.4 }),
  ev("mx_stalker", "crime", 18, 60, "Followed", "Someone has been following you for weeks and leaving messages.", [
    opt("Go to the police", "They took it seriously and issued a restraining order.", { happinessDelta: -3 }),
    opt("Hire a bodyguard ($12,000)", "A professional made them think twice.", { bankBalanceDelta: -12000, happinessDelta: 2 }),
    risk("Confront them", 0.5, ["You faced them down. They left town.", { happinessDelta: 4 }], ["They attacked you.", { healthDelta: -18, happinessDelta: -8 }], "health"),
  ], { mature: true, cooldown: 10, weight: 0.5 }),
  ev("mx_barfight_knife", "crime", 18, 50, "A Blade Appears", "A heated bar argument escalates when someone pulls a knife.", [
    opt("Back away slowly", "You de-escalated and walked out. Smart.", { karmaDelta: 2 }),
    risk("Fight for it", 0.45, ["You disarmed them and walked away with a scar.", { healthDelta: -8, happinessDelta: 2, karmaDelta: -3 }], ["You were stabbed and rushed to hospital.", { healthDelta: -28, bankBalanceDelta: -6000, happinessDelta: -8 }], "health"),
  ], { mature: true, cooldown: 10, weight: 0.5 }),
  ev("mx_vigilante", "crime", 20, 65, "Taking Justice Into Your Own Hands", "A local predator has dodged conviction again. Everyone's furious.", [
    opt("Let the courts handle it", "Frustrating, but you stayed on the right side.", { karmaDelta: 3 }),
    opt("Organise a peaceful protest", "Hundreds showed up. Pressure led to a retrial.", { karmaDelta: 6, fameDelta: 2, happinessDelta: 4 }),
    risk("Make them pay yourself", 0.45, ["Justice, of a kind. You'll never tell anyone.", { kill: true, karmaDelta: 20, happinessDelta: -6 }], ["It went wrong and you were arrested.", { arrest: { name: "Aggravated Assault", description: "Your vigilante night out was caught on camera.", years: 7, severity: "serious" }, happinessDelta: -8 }]),
  ], { mature: true, once: true, weight: 0.4 }),
  ev("mx_gang_initiation", "crime", 16, 40, "Initiation", "A gang offers you a place if you pass a test: a robbery.", [
    risk("Do the job", 0.5, ["You passed. You're in, for better or worse.", { bankBalanceDelta: 3000, karmaDelta: -10, happinessDelta: 3 }], ["Police caught you in the act.", { arrest: { name: "Robbery", description: "A shop camera recorded the whole robbery.", years: 4, severity: "serious" }, karmaDelta: -10 }]),
    opt("Refuse", "They called you a coward. You called yourself alive.", { karmaDelta: 3 }),
  ], { mature: true, once: true, weight: 0.5 }),
  ev("mx_prison_romance", "prison", 18, 80, "Connection", "A fellow inmate, someone you've talked with for months, shows a kinder side. You might be falling for them.", [
    opt("Keep it friendly", "You leaned on each other, which helped more than you'd admit.", { happinessDelta: 5, relationshipDelta: { target: "Friend", delta: 5 } }),
    opt("Let it become more", "A quiet, consensual closeness in a harsh place.", { happinessDelta: 8, healthDelta: 1 }),
    opt("Keep to yourself", "You stayed to yourself.", { happinessDelta: -1 }),
  ], { mature: true, prisonOnly: true, cooldown: 6 }),
  ev("mx_prison_cellmate_threat", "prison", 18, 90, "A Bad Cellmate", "Your new cellmate starts making threats on day one.", [
    opt("Ask the guards for a transfer", "They transferred you. Your new cellmate is a chess fan.", { happinessDelta: 3 }),
    risk("Stand up to them", 0.45, ["You earned respect, and a quiet cell.", { happinessDelta: 3, healthDelta: -3 }], ["It ended in the infirmary.", { healthDelta: -22, happinessDelta: -6 }], "health"),
  ], { prisonOnly: true, cooldown: 5 }),

  // ---------- other illegal acts outside the crime tab ----------
  ev("mx_bribe_inspector", "crime", 22, 70, "A Quick Fix", "A fire inspector hints that 'a donation' would smooth over your building's violations.", [
    risk("Slip him an envelope ($5,000)", 0.6, ["The violations vanished. So did the cash.", { bankBalanceDelta: -5000, karmaDelta: -6 }], ["He was wearing a wire.", { bankBalanceDelta: -5000, karmaDelta: -6, arrest: { name: "Bribery", description: "The inspector recorded your offer.", years: 3, severity: "serious" } }]),
    opt("Fix the violations legitimately ($14,000)", "Expensive, but legal.", { bankBalanceDelta: -14000, karmaDelta: 2 }),
  ], { mature: true, requires: { flagsAll: ["business_owner"], minBank: 5000 }, cooldown: 8 }),
  ev("mx_smuggling_offer", "crime", 20, 60, "A Quiet Job", "A contact needs a package moved across the border. $20,000 for one trip.", [
    risk("Take the job", 0.6, ["Smooth as silk. Nobody asked a question.", { bankBalanceDelta: 20000, karmaDelta: -8 }], ["Customs opened the package.", { arrest: { name: "Smuggling", description: "Border agents found contraband in your luggage.", years: 8, severity: "serious" }, karmaDelta: -8 }]),
    opt("Decline", "You didn't need the trouble.", { karmaDelta: 2 }),
  ], { mature: true, once: true, weight: 0.6 }),
  ev("mx_fake_death", "crime", 25, 70, "Disappear", "A friend offers to help you vanish and start over under a new name.", [
    opt("Do it ($50,000)", "You vanished. A new name, a new city, a clean slate. Your family never knew.", { bankBalanceDelta: -50000, happinessDelta: -4, relationshipDelta: { target: "All", delta: -40 } }),
    opt("Stay and face your life", "You stayed. It was the harder path.", { smartsDelta: 1 }),
  ], { mature: true, requires: { minBank: 50000 }, once: true, weight: 0.2 }),
  ev("mx_hacker_ransom", "crime", 18, 50, "Easy Pickings", "You've found a hospital network with a gaping security hole.", [
    opt("Report it responsibly", "They thanked you and gave you a bounty.", { bankBalanceDelta: 8000, karmaDelta: 8, smartsDelta: 2 }),
    risk("Ransom them", 0.4, ["Bitcoin arrived. You vanished into the net.", { bankBalanceDelta: 180000, karmaDelta: -20 }], ["The feds were faster than you.", { arrest: { name: "Ransomware Attack", description: "Federal cybercrime agents traced the ransom to your wallet.", years: 15, severity: "heinous" }, karmaDelta: -20 }], "smarts"),
    opt("Ignore it", "Not your business.", {}),
  ], { mature: true, requires: { minStat: { smarts: 70 } }, once: true, weight: 0.5 }),
];
