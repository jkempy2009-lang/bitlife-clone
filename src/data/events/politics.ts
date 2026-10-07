import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { CAMPAIGN_COST, currentTier, inOffice } from "@/engine/politics";
import { clamp } from "@/lib/format";

const pop = (p: PlayerState, d: number) => {
  p.politics.popularity = clamp(p.politics.popularity + d);
};
const machine = (p: PlayerState, d: number) => {
  p.statecraft.machine = clamp(p.statecraft.machine + d);
};
const tierCost = (p: PlayerState) => CAMPAIGN_COST[clamp(currentTier(p) + 1, 0, 4)];
const active = (p: PlayerState) => p.politics.party !== null && p.age >= 25 && !p.isInPrison;

// Politics: the machinery, the money and the temptations. Gated on a party card or an office.
export const POLITICS_EVENTS: LifeEvent[] = [
  ev("px_donor_strings", "money", 25, 80, "A Very Generous Donor", "A well-dressed stranger offers to bundle a six-figure sum for your next campaign. 'No strings,' he says, in the tone of a man with several.", [
    opt("Take the money, strings and all", "The money was real and so were the expectations. He now expects a call about 'tax policy'.", { karmaDelta: -2, apply: (p, rng) => { const amt = Math.round(tierCost(p) * 0.35); p.statecraft.funds += amt; p.statecraft.donors.push({ id: rng.id(), name: "Anonymous Bundler", kind: "business", given: amt, issue: "economy", stance: 1, year: p.year }); } }),
    opt("Accept only small grassroots donations", "It took longer, and the campaign felt cleaner. You raised a modest sum from people who cared.", { karmaDelta: 2, apply: (p) => { p.statecraft.funds += Math.round(tierCost(p) * 0.08); pop(p, 2); } }),
    opt("Refuse and say why, publicly", "The press loved it, the donors wouldn't return your calls, and your base thinks you're the real thing.", { karmaDelta: 3, fameDelta: 2, apply: (p) => pop(p, 5) }),
  ], { cooldown: 5, requires: { custom: active } }),

  ev("px_oppo_dump", "career", 25, 80, "A Folder on Your Desk", "An anonymous envelope contains documents about your main rival: a scandal, signed and dated. It would end their career.", [
    risk("Leak it to a journalist", 0.6, ["The story ran, the rival dropped in the polls, and your hands stayed clean.", { karmaDelta: -3, apply: (p) => pop(p, 6) }], ["The documents were forged, and a journalist traced them back to you.", { karmaDelta: -6, apply: (p) => { p.statecraft.scandal = { kind: "dirty_tricks", title: "Smear campaign backfires", severity: 2, year: p.year }; pop(p, -6); } }], "smarts"),
    opt("Return it to your rival", "Your rival never forgot the gesture. A gracious enemy is worth more than a dead one.", { karmaDelta: 4, apply: (p) => machine(p, 3) }),
    opt("Shred it", "You told yourself it was a matter of principle. It was partly a matter of fear.", { karmaDelta: 2 }),
  ], { cooldown: 7, requires: { custom: active } }),

  ev("px_party_whip", "career", 25, 80, "The Whip Calls", "The party whip wants your vote on a bill you think is wrong. 'The leadership remembers who votes with them.'", [
    opt("Vote with the party", "You voted yes and said nothing. The leadership remembered.", { karmaDelta: -2, apply: (p) => { machine(p, 8); pop(p, -3); } }),
    opt("Vote your conscience", "You voted no, and said why. Voters liked it. The party did not.", { karmaDelta: 3, fameDelta: 1, apply: (p) => { machine(p, -10); pop(p, 4); } }),
    opt("Abstain and go for lunch", "You skipped the vote. Everybody noticed, and nobody was impressed.", { apply: (p) => { machine(p, -2); pop(p, -1); } }),
  ], { cooldown: 3, requires: { custom: (p) => inOffice(p) && p.politics.party !== null } }),

  ev("px_lobby_lunch", "money", 28, 80, "A Lobbyist's Lunch", "A polished lobbyist invites you to lunch, a consultancy role 'for later' and a donation 'for your charity'.", [
    risk("Accept the 'charity donation'", 0.65, ["The money reached your 'charity' and then, mostly, you. Nobody noticed.", { bankBalanceDelta: 30000, karmaDelta: -6, apply: (p) => { p.statecraft.bribes += 30000; p.justice.proceeds += 30000; } }], ["A journalist had the lobbyist's emails. 'Pay-to-play' is not a good headline.", { bankBalanceDelta: 30000, karmaDelta: -6, apply: (p) => { p.statecraft.bribes += 30000; p.justice.proceeds += 30000; p.statecraft.scandal = { kind: "donor", title: "Pay-to-play allegations", severity: 2, year: p.year }; pop(p, -5); } }]),
    opt("Pay for your own lunch and leave", "A small gesture. In a city of favours, people noticed that you didn't owe any.", { karmaDelta: 3, apply: (p) => pop(p, 2) }),
    opt("Report the approach to the ethics office", "The ethics office was surprised, and your peers less so. You're now known as 'difficult'.", { karmaDelta: 5, apply: (p) => { machine(p, -4); pop(p, 3); } }),
  ], { cooldown: 5, requires: { custom: (p) => inOffice(p) && currentTier(p) >= 1 } }),

  ev("px_budget_hole", "money", 25, 80, "A Hole in the Budget", "The accounts don't add up, and a deficit looms. Every option costs you somebody's vote.", [
    opt("Raise taxes", "It was the honest option, and the least popular. Services stayed intact.", { karmaDelta: 1, apply: (p) => { pop(p, -8); p.statecraft.mood.economy = clamp((p.statecraft.mood.economy ?? 0) - 0.2, -1, 1); } }),
    opt("Cut services", "Libraries closed and clinics shortened their hours. The deficit shrank. So did your approval.", { karmaDelta: -1, apply: (p) => pop(p, -5) }),
    opt("Borrow and hope", "The debt can wait. Some later politician will worry about it.", { apply: (p) => pop(p, 2) }),
  ], { cooldown: 5, requires: { custom: (p) => inOffice(p) && p.economy.climate === "recession" } }),

  ev("px_whistleblower", "career", 28, 80, "A Staffer with a Conscience", "A young aide in your office has been asking odd questions about the payments, and the paperwork. She's seen too much.", [
    risk("Buy her silence with a promotion", 0.55, ["She took the promotion and stopped asking. It will cost you eventually.", { karmaDelta: -5 }], ["She took the promotion and the files. The prosecutor thanks her.", { karmaDelta: -5, apply: (p) => { if (!p.statecraft.investigation) p.statecraft.investigation = { kind: "corruption", yearsLeft: 2, evidence: 70 }; } }]),
    opt("Come clean to your lawyer and start repairing", "Your lawyer groaned, then went to work. The books are cleaner now.", { bankBalanceDelta: -15000, apply: (p) => { p.statecraft.bribes = Math.round(p.statecraft.bribes * 0.4); } }),
    opt("Ignore it", "You told yourself it was nothing. It was not nothing.", { apply: (p) => { if (!p.statecraft.investigation) p.statecraft.investigation = { kind: "corruption", yearsLeft: 3, evidence: 45 }; } }),
  ], { cooldown: 8, requires: { custom: (p) => inOffice(p) && p.statecraft.bribes > 0 && !p.statecraft.investigation } }),

  ev("px_recall_petition", "career", 25, 80, "Signatures Are Being Collected", "A group has launched a recall campaign against you. They need ten thousand signatures, and they're nearly there.", [
    risk("Fight it with a town-hall tour", 0.55, ["You showed up, shook hands and answered questions in forty town halls. The petition fizzled.", { happinessDelta: -3, healthDelta: -2, apply: (p) => { pop(p, 10); p.statecraft.lowYears = 0; } }], ["The tour made things worse: every clip was a gaffe. Your approval fell further.", { happinessDelta: -5, apply: (p) => pop(p, -5) }], "happiness"),
    opt("Hire a consultant ($20,000)", "A professional campaign manager reshaped your message. Your numbers crept up.", { bankBalanceDelta: -20000, apply: (p) => pop(p, 6) }),
    opt("Ignore it", "You assumed it would go nowhere. It didn't.", { apply: (p) => pop(p, -4) }),
  ], { cooldown: 6, requires: { custom: (p) => inOffice(p) && p.politics.popularity < 35 } }),

  ev("px_flood_response", "general", 25, 80, "The River Rises", "Floodwaters are rising in the district. This is your moment, for better or worse.", [
    risk("Go to the sandbag line yourself", 0.7, ["You were photographed hauling sandbags at 3am. Voters remember who showed up.", { healthDelta: -3, karmaDelta: 3, apply: (p) => pop(p, 10) }], ["You slipped in the mud and the clip went viral for all the wrong reasons.", { healthDelta: -5, apply: (p) => pop(p, -3) }], "health"),
    opt("Release emergency funds ($25,000 personally)", "Your donation covered the first week of relief. Nobody asked, and everybody knew.", { bankBalanceDelta: -25000, karmaDelta: 4, apply: (p) => pop(p, 7) }),
    opt("Stay in the capital and issue a statement", "A statement is not a sandbag. The local paper said so, repeatedly.", { karmaDelta: -2, apply: (p) => pop(p, -7) }),
  ], { cooldown: 8, requires: { custom: inOffice } }),

  ev("px_party_leader_calls", "career", 45, 80, "A Call from the Party Leader", "The party leader rings you personally. 'We have a vacancy. An embassy. You've earned it.'", [
    opt("Accept the ambassadorship", "A residence, a driver and a lot of canapés. Public service, in a gentler form.", { fameDelta: 3, happinessDelta: 5, apply: (p) => { p.statecraft.retired = "ambassador"; p.statecraft.retiredYear = p.year; } }),
    opt("Decline and keep your options open", "You thanked them and said you had other plans. They remembered the refusal.", { apply: (p) => machine(p, -5) }),
    opt("Demand a ministerial post instead", "A short silence on the line. Then: 'I'll see what I can do.' They did not.", { karmaDelta: -1, apply: (p) => machine(p, -10) }),
  ], { once: true, requires: { custom: (p) => !inOffice(p) && p.statecraft.highestTier >= 2 && p.politics.party !== null && p.statecraft.machine >= 45 && !p.statecraft.retired && !p.currentJob } }),

  ev("px_debate_moment", "career", 25, 80, "A Question You Weren't Ready For", "On live television, a journalist asks the question you've been dreading.", [
    risk("Answer it head-on", 0.55, ["You gave a straight answer. The audience applauded and the journalist looked impressed.", { fameDelta: 2, apply: (p) => pop(p, 8) }], ["It came out wrong. The clip is in every newsroom by tonight.", { fameDelta: 1, apply: (p) => pop(p, -7) }], "smarts"),
    opt("Pivot to a rehearsed line", "A tried-and-tested dodge. The journalist rolled their eyes and the audience didn't notice.", { apply: (p) => pop(p, 1) }),
    opt("Walk off set", "A defiant exit. Your base loves it. Everyone else is baffled.", { karmaDelta: -1, fameDelta: 3, apply: (p) => pop(p, -3) }),
  ], { cooldown: 6, requires: { custom: (p) => active(p) && p.politics.popularity > 20 } }),

  ev("px_scandal_leak", "career", 28, 80, "The Journalist's Call", "A reporter calls at 11pm. 'We're running a story about your finances tomorrow. Do you want to comment?'", [
    opt("Get ahead of the story", "You held a press conference at dawn and apologised for what was true. The story got smaller.", { karmaDelta: 2, apply: (p) => { pop(p, -2); } }),
    risk("Threaten to sue", 0.4, ["The paper's lawyers blinked and the story was shelved. For now.", { karmaDelta: -2, apply: (p) => pop(p, 1) }], ["The paper ran a second story about the threat, and the first one anyway.", { karmaDelta: -3, apply: (p) => { pop(p, -8); } }]),
    opt("No comment", "The story ran. It was fair, and it hurt.", { apply: (p) => pop(p, -5) }),
  ], { cooldown: 6, requires: { custom: (p) => inOffice(p) && (p.statecraft.bribes > 0 || p.stats.affairs > 0 || p.criminalRecord.length > 0) } }),

  ev("px_coalition_crisis", "career", 30, 80, "The Coalition Wobbles", "Your legislative partners are threatening to walk out over a pet project. Your agenda depends on them.", [
    opt("Give them their project", "A little pork, and the coalition steadied. The treasury noticed.", { bankBalanceDelta: 0, apply: (p) => { p.statecraft.coalition = clamp(p.statecraft.coalition + 25); pop(p, -2); } }),
    opt("Call their bluff", "You told them to go ahead. They didn't, but they did not forget either.", { karmaDelta: 1, apply: (p) => { p.statecraft.coalition = clamp(p.statecraft.coalition - 15); pop(p, 3); } }),
  ], { cooldown: 5, requires: { custom: (p) => inOffice(p) && currentTier(p) >= 2 } }),

  ev("px_retired_calls", "money", 45, 85, "The Revolving Door", "A firm you once regulated offers you a very large salary to 'advise'.", [
    opt("Take the job and the money", "You joined as a consultant. It paid very well, and your old colleagues don't return your calls.", { bankBalanceDelta: 150000, karmaDelta: -5, apply: (p) => { p.statecraft.retired = "lobbyist"; p.statecraft.retiredYear = p.year; } }),
    opt("Decline and write your memoir instead", "You chose your reputation over a salary. The book will pay back eventually.", { karmaDelta: 3, fameDelta: 2 }),
  ], { once: true, requires: { custom: (p) => !inOffice(p) && p.statecraft.highestTier >= 2 && !p.statecraft.retired && !p.currentJob && !p.business } }),
];
