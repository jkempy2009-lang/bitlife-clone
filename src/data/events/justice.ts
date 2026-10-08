import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { CAREER_BY_ID } from "../careersRegistry";
import { makeJob } from "@/engine/career";
import { addHeat, forfeit, recordLevel } from "@/engine/justice";
import { paroleEligibleAt, releaseFromPrison } from "@/engine/prison";
import { inMob } from "@/engine/underworld";
import { inAgency } from "@/engine/spy";
import { clamp } from "@/lib/format";

const hire = (p: PlayerState, rng: { id(): string; pick<T>(a: readonly T[]): T }) => {
  if (!p.currentJob && !p.business) p.currentJob = makeJob(CAREER_BY_ID.fast_food, 0, rng as never);
  if (p.currentJob) p.annualSalary = p.currentJob.salary;
};
const strike = (p: PlayerState, years = 1) => {
  if (p.probation) {
    p.probation.yearsLeft += years;
    p.probation.strikes = (p.probation.strikes ?? 0) + 1;
  }
};
const hasRecord = (p: PlayerState) => recordLevel(p) !== "clean";

// Justice, prison, the underworld and the Agency: choices with real trade-offs, gated on the state they touch.
export const JUSTICE_EVENTS: LifeEvent[] = [
  // ---------- reintegration and the record ----------
  ev("jx_ban_the_box", "career", 18, 65, "The Question on the Form", "A job application asks: 'Have you ever been convicted of a crime?' Your record is not clean, and the rent is due.", [
    risk("Answer honestly and explain", 0.5, ["The manager read your explanation, nodded slowly and gave you a start date. 'Everybody deserves one.'", { happinessDelta: 4, karmaDelta: 2, apply: (p, rng) => hire(p, rng) }], ["Honesty did not pay this time. The recruiter was polite, and never called back.", { happinessDelta: -4 }]),
    risk("Tick 'no' and hope", 0.5, ["The check was lazy and nobody looked. You started on Monday, with a secret.", { karmaDelta: -3, apply: (p, rng) => hire(p, rng) }], ["The background check found everything. They fired you before your first shift and told the whole chain.", { karmaDelta: -4, happinessDelta: -6 }]),
    opt("Apply only to second-chance employers", "A workshop that hires ex-offenders took you on. Smaller pay, no questions, real work.", { happinessDelta: 3, apply: (p, rng) => hire(p, rng) }),
  ], { cooldown: 5, requires: { hasJob: false, custom: (p) => hasRecord(p) && p.age >= 18 && !p.isInPrison && !p.influencer.fullTime && !p.music.signed && !p.business } }),

  ev("jx_old_crew_calls", "crime", 18, 60, "The Old Crew Calls", "You're barely out and already broke. An old friend rings: 'One job, easy money. We need you.'", [
    risk("Do the one job", 0.5, ["The job went perfectly. You pocketed $15,000, and the old feeling came right back.", { bankBalanceDelta: 15000, karmaDelta: -8, apply: (p) => { addHeat(p, 15); p.justice.accomplices = Math.min(6, p.justice.accomplices + 1); } }], ["The police were waiting. As a recent ex-con, you won't get a second chance.", { karmaDelta: -8, arrest: { name: "Burglary", description: "You were caught on a job within months of release. The prosecutor called you 'incorrigible'.", years: 5, severity: "serious", evidence: 80 } }]),
    opt("Say no and stay clean", "It was lonely saying no, but you slept well. A year of boring is a start.", { karmaDelta: 3, happinessDelta: -2 }),
    opt("Tell your probation officer", "Your officer thanked you and noted it in your file. That counts, and your old friend will never forgive you.", { karmaDelta: 3, relationshipDelta: { target: "Friend", delta: -15 }, apply: (p) => { if (p.probation) p.probation.yearsLeft = Math.max(1, p.probation.yearsLeft - 1); } }),
  ], { cooldown: 4, requires: { custom: (p) => p.justice.reentry > 0 && !p.isInPrison } }),

  ev("jx_probation_visit", "crime", 14, 80, "Surprise Home Visit", "Your probation officer knocks on the door unannounced.", [
    risk("Let them in and answer everything", 0.7, ["The visit was clean. Your officer wrote 'cooperative' in the file.", { karmaDelta: 1, happinessDelta: 1 }], ["They found something you'd forgotten about. A violation, and an extra year of supervision.", { happinessDelta: -4, apply: (p) => strike(p) }], "smarts"),
    risk("Insist on a warrant", 0.4, ["They left. It was within your rights, and an officer who respects your rights tends to relax.", { karmaDelta: 1 }], ["Refusing a visit looked like hiding something. They filed a violation anyway.", { happinessDelta: -4, apply: (p) => strike(p) }]),
    opt("Pay a cleaner and hope", "A very thorough cleaner ($300) made the flat spotless. The officer was suspiciously impressed.", { bankBalanceDelta: -300, happinessDelta: 1 }),
  ], { cooldown: 3, requires: { custom: (p) => !!p.probation } }),

  ev("jx_expunge_offer", "crime", 25, 80, "A Chance to Clear Your Name", "A legal aid clinic says you may be eligible to have your old conviction expunged. Sealing it would reopen doors that have been shut for years.", [
    opt("Pay the legal fees ($3,000)", "The judge signed the order. The conviction vanished from background checks. You walked out lighter.", { bankBalanceDelta: -3000, happinessDelta: 8, karmaDelta: 1, clearFlags: ["ex_con"], apply: (p) => { p.justice.expunged = true; p.justice.reentry = 0; } }),
    opt("Do the paperwork yourself", "Months of forms and one missed deadline. It worked, eventually.", { happinessDelta: 4, clearFlags: ["ex_con"], apply: (p) => { p.justice.expunged = true; } }),
    opt("It doesn't matter any more", "You'd made your peace with it. Some doors stay closed, and that's all right.", { happinessDelta: 1 }),
  ], { once: true, requires: { custom: (p) => hasRecord(p) && !p.justice.expunged && p.justice.violentConvictions === 0 && p.justice.lastConvictionYear !== null && p.year - p.justice.lastConvictionYear >= 7 && !p.isInPrison && !p.probation && p.bankBalance >= 3000 } }),

  // ---------- heat, snitches and accomplices ----------
  ev("jx_old_partner_talking", "crime", 18, 70, "An Old Partner Is Talking", "Word reaches you that someone you once worked with has been arrested, and is 'cooperating'.", [
    risk("Pay for their silence ($8,000)", 0.6, ["The money reached the right pockets. A lawyer's letter later, the statement was withdrawn.", { bankBalanceDelta: -8000, karmaDelta: -3, apply: (p) => { p.justice.accomplices = Math.max(0, p.justice.accomplices - 1); } }], ["They took the money and talked anyway. Detectives arrive within the month.", { bankBalanceDelta: -8000, karmaDelta: -3, arrest: { name: "Conspiracy", description: "A cooperating witness gave the police your name, and the bribe attempt corroborated it.", years: 6, severity: "serious", evidence: 85 } }]),
    opt("Skip town for a while", "You left for six months. The trail cooled, the job didn't survive, and you lost touch with people.", { bankBalanceDelta: -3000, loseJob: true, happinessDelta: -5, relationshipDelta: { target: "Friend", delta: -8 }, apply: (p) => { p.justice.accomplices = 0; addHeat(p, -25); } }),
    risk("Go to the police first and cut a deal", 0.55, ["Coming forward earned you a deal: a modest sentence, and nothing worse.", { karmaDelta: 4, arrest: { name: "Conspiracy", description: "You voluntarily came forward and gave a full statement.", years: 2, severity: "minor", evidence: 40 }, apply: (p) => { p.justice.accomplices = 0; } }], ["The prosecutor smelled desperation and pushed for the maximum.", { karmaDelta: 2, arrest: { name: "Conspiracy", description: "You came forward, but they already had a better witness.", years: 5, severity: "serious", evidence: 80 }, apply: (p) => { p.justice.accomplices = 0; } }], "smarts"),
  ], { cooldown: 5, requires: { custom: (p) => p.justice.accomplices > 0 && p.justice.heat >= 20 && !p.isInPrison && !p.pendingTrial } }),

  ev("jx_surveillance", "crime", 18, 70, "The Same Van", "For three weeks the same grey van has been parked outside. You are being watched.", [
    opt("Lie low and keep your hands clean", "Months of boredom later, the van left. Heat fades if you let it.", { happinessDelta: -3, apply: (p) => addHeat(p, -20) }),
    opt("Confront them", "A detective took your name, smiled and said 'see you soon'. It made things worse.", { happinessDelta: -2, apply: (p) => addHeat(p, 8) }),
    risk("Feed them a false lead", 0.5, ["Your tip sent the surveillance team across town. The pressure eased.", { apply: (p) => addHeat(p, -35), karmaDelta: -2 }], ["They saw straight through it, and now you're suspected of obstruction.", { apply: (p) => addHeat(p, 15), karmaDelta: -2 }], "smarts"),
  ], { cooldown: 5, requires: { custom: (p) => p.justice.heat >= 40 && !p.isInPrison && !p.pendingTrial } }),

  ev("jx_asset_freeze", "crime", 21, 75, "A Visit from Financial Crimes", "Investigators ask about large cash deposits that don't match your income. They have a warrant to freeze your accounts.", [
    opt("Cooperate and settle", "You agreed to forfeit part of the money. They took $40,000 or so and closed the file.", { karmaDelta: 2, happinessDelta: -4, apply: (p) => { const take = Math.round(Math.min(p.justice.proceeds * 0.4, Math.max(p.bankBalance, 0.5 * p.justice.proceeds))); forfeit(p, take); p.justice.proceeds = Math.round(p.justice.proceeds * 0.4); addHeat(p, -15); } }),
    risk("Say you won it gambling", 0.45, ["The paperwork was thin, but nobody could disprove it. The freeze was lifted.", { karmaDelta: -3, apply: (p) => { p.justice.proceeds = Math.round(p.justice.proceeds * 0.5); } }], ["The casino had no record of you. They charged you with money laundering.", { karmaDelta: -4, arrest: { name: "Money Laundering", description: "Investigators proved the cash came from crime and that you lied about its source.", years: 5, severity: "serious", evidence: 80 } }], "smarts"),
    opt("Hire a forensic accountant ($6,000)", "The accountant built a story of consulting income and small loans. It held up, mostly.", { bankBalanceDelta: -6000, apply: (p) => { p.justice.proceeds = Math.round(p.justice.proceeds * 0.3); addHeat(p, -10); } }),
  ], { cooldown: 6, requires: { custom: (p) => p.justice.proceeds >= 40_000 && p.justice.heat >= 20 && !p.isInPrison && !p.pendingTrial } }),

  // ---------- youth ----------
  ev("jx_juvenile_diversion", "crime", 12, 17, "Caught With the Spray Paint", "A police officer catches you tagging the underpass. A youth worker explains that there's a diversion programme for first offenders.", [
    opt("Take the diversion programme", "Six weeks of workshops and a mural you were proud of. No record, and a mentor who gives a damn.", { karmaDelta: 3, happinessDelta: -1, smartsDelta: 1 }),
    risk("Refuse and take your chances in court", 0.45, ["The case was thrown out on a technicality. A lucky escape.", { happinessDelta: 3, karmaDelta: -1 }], ["The juvenile court found you delinquent. Probation, and a record that may or may not be sealed.", { arrest: { name: "Vandalism", description: "You tagged public property and refused the diversion offer.", years: 1, severity: "minor", evidence: 70 }, karmaDelta: -2 }]),
    opt("Blame your friend", "The police believed you. Your friend had to do the programme. You are not welcome at their house any more.", { karmaDelta: -6, relationshipDelta: { target: "Friend", delta: -30 }, happinessDelta: -2 }),
  ], { once: true, requires: { custom: (p) => p.justice.juvenileRecord.length === 0 && p.criminalRecord.length === 0 } }),

  ev("jx_juvenile_counsellor", "crime", 12, 17, "A Counsellor Who Gets It", "Your probation officer says something nobody else has: 'You're not a bad kid. You're a kid in a bad spot.'", [
    opt("Take the offer of a mentor", "Weekly meetings with someone who'd been where you were. Slowly, the trouble faded.", { happinessDelta: 5, karmaDelta: 3, apply: (p) => { if (p.probation) p.probation.yearsLeft = Math.max(1, p.probation.yearsLeft - 1); } }),
    opt("Shrug it off", "You nodded, rolled your eyes and left. It stuck in your head anyway.", { happinessDelta: -1 }),
  ], { once: true, requires: { custom: (p) => !!p.probation && p.age < 18 } }),

  // ---------- wrongful accusation ----------
  ev("jx_mistaken_identity", "crime", 18, 70, "Fits the Description", "Two officers stop you on the street. You match the description of a man seen leaving a robbery. You didn't do it.", [
    risk("Cooperate fully", 0.5, ["Your alibi checked out within hours. They apologised, awkwardly, and you got home by midnight.", { happinessDelta: 1 }], ["The victim picked you out of a line-up. You are charged with a crime you did not commit.", { arrest: { name: "Armed Robbery", description: "A witness identified you from a line-up. You have no alibi that anyone can confirm.", years: 6, severity: "serious", evidence: 55, innocent: true, violent: true }, happinessDelta: -6 }]),
    risk("Demand a lawyer immediately ($3,000)", 0.75, ["Your lawyer shut down the questioning, found the CCTV, and had you cleared by lunchtime.", { bankBalanceDelta: -3000 }], ["Even with a lawyer, the case went ahead. At least you won't face it alone.", { bankBalanceDelta: -3000, arrest: { name: "Armed Robbery", description: "A witness identified you. You maintain your innocence.", years: 6, severity: "serious", evidence: 45, innocent: true, violent: true } }]),
    opt("Walk away", "Walking away from police only made them more certain. They arrested you for resisting, and the robbery question came later.", { arrest: { name: "Armed Robbery", description: "You ran from the police, which a prosecutor will describe as consciousness of guilt.", years: 6, severity: "serious", evidence: 70, innocent: true, violent: true }, karmaDelta: -2 }),
  ], { cooldown: 15, weight: 0.5, requires: { custom: (p) => !p.pendingTrial && !p.isInPrison } }),

  // ---------- inside ----------
  ev("jx_cellmate", "prison", 14, 90, "Your New Cellmate", "The door slams and a new man drops his bag on the lower bunk. He looks you up and down.", [
    opt("Let him tutor you", "He'd been a teacher once. Two hours a day, and you learned more in a year than in school. Smarts +3.", { smartsDelta: 3, happinessDelta: 2, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) + 5); } }),
    risk("Join his side business", 0.6, ["Cigarettes, phone cards and a cut of everything. Respect, and money in your account.", { bankBalanceDelta: 1500, karmaDelta: -3, apply: (p) => { if (p.prison) { p.prison.standing = clamp((p.prison.standing ?? 20) + 10); p.prison.conduct = clamp((p.prison.conduct ?? 70) - 6); } } }], ["A guard found the stash. You took the blame. Solitary, and your sentence went up.", { karmaDelta: -3, healthDelta: -4, apply: (p) => { if (p.prison) { p.prison.solitary = (p.prison.solitary ?? 0) + 1; p.prison.conduct = clamp((p.prison.conduct ?? 70) - 15); p.prison.sentenceYears += 1; } } }]),
    opt("Keep to yourself", "He gave up trying to talk after a month. The silence was peaceful, mostly.", { happinessDelta: -1 }),
  ], { prisonOnly: true, cooldown: 4 }),

  ev("jx_guard_offer", "prison", 16, 90, "A Guard With an Offer", "A guard stops you in the corridor. 'A phone. A better cell. A bit of privacy. It'll cost you $1,000, and nobody needs to know.'", [
    risk("Accept", 0.65, ["For a while, life got easier. A phone call home meant everything.", { bankBalanceDelta: -1000, happinessDelta: 7, karmaDelta: -3, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) - 8); } }], ["Someone talked. You were caught with the phone. A year in solitary and extra time.", { bankBalanceDelta: -1000, happinessDelta: -6, apply: (p) => { if (p.prison) { p.prison.solitary = (p.prison.solitary ?? 0) + 1; p.prison.sentenceYears += 1; p.prison.conduct = clamp((p.prison.conduct ?? 70) - 18); } } }]),
    risk("Report him to the warden", 0.55, ["The warden listened. The guard was suspended and your file now has a commendation.", { karmaDelta: 5, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) + 8); } }], ["Nobody believed you. His friends made sure you paid for it in the yard.", { karmaDelta: 3, healthDelta: -10, apply: (p) => { if (p.prison) p.prison.standing = clamp((p.prison.standing ?? 20) - 10); } }]),
    opt("Decline politely", "He shrugged and moved on to the next cell. You got a bad reputation for being difficult, and a clean file.", { karmaDelta: 1 }),
  ], { prisonOnly: true, cooldown: 5 }),

  ev("jx_victim_letter", "prison", 16, 90, "A Letter from Someone You Hurt", "A letter arrives forwarded by the prison. It is from someone affected by what you did. You hold it for an hour before opening it.", [
    opt("Write back honestly and take responsibility", "You wrote four drafts and sent the worst one. It was true. Parole boards read files like this.", { karmaDelta: 5, happinessDelta: -2, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) + 6); } }),
    opt("Don't reply", "You put it in a drawer. It's there still.", { happinessDelta: -3 }),
    opt("Write something defiant", "Pride is a poor cellmate. A copy was added to your file.", { karmaDelta: -3, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) - 5); } }),
  ], { prisonOnly: true, cooldown: 8, requires: { custom: (p) => !!p.prison && !p.prison.deathRow && !p.prison.wrongful } }),

  ev("jx_parole_prep", "prison", 18, 90, "Your Parole Hearing Approaches", "The board will see you soon. The counsellor says there's still time to strengthen your case.", [
    opt("Throw yourself into the programmes", "A year of classes, a job, a spotless record. The hearing was the least of your worries.", { happinessDelta: 2, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) + 10); } }),
    opt("Hire a parole attorney ($4,000)", "A lawyer who knows the board prepared your statement and your release plan.", { bankBalanceDelta: -4000, apply: (p) => { if (p.prison) p.prison.conduct = clamp((p.prison.conduct ?? 70) + 7); } }),
    opt("Wait and see", "You did nothing different. The board will take you as you are.", {}),
  ], { prisonOnly: true, cooldown: 4, requires: { custom: (p) => !!p.prison && !p.prison.deathRow && !p.prison.juvenile && p.prison.yearsServed >= paroleEligibleAt(p.prison) - 1 } }),

  ev("jx_dna_hearing", "prison", 18, 90, "New Evidence", "A law clinic has found something in your old case file: DNA that was never tested, and an alibi witness nobody called.", [
    risk("Fight for a new hearing", 0.5, ["The court agreed to a hearing, and the evidence was undeniable. Your conviction was overturned.", { apply: (p, rng) => { if (p.prison) releaseFromPrison(p, "exonerated", rng, []); } }], ["The judge ruled the evidence 'procedurally barred'. You will keep trying.", { happinessDelta: -6 }]),
    opt("Be patient and let the lawyers work", "It will take years. At least somebody is working on it.", { happinessDelta: 2 }),
  ], { prisonOnly: true, cooldown: 3, requires: { custom: (p) => !!p.prison?.wrongful } }),

  // ---------- underworld ----------
  ev("ux_fed_approach", "crime", 18, 70, "Two Agents at Your Door", "Two federal agents sit across from you in a diner. 'We know what you do. We know who you work for. We can make this go away, if you help us.'", [
    opt("Say nothing and walk out", "You said 'am I being detained?' and left. They'll be back, with a warrant this time.", { apply: (p) => { addHeat(p, 8); p.mob.loyalty = Math.min(100, p.mob.loyalty + 3); } }),
    opt("Tell the boss about it", "The boss appreciated knowing. Your loyalty counts for something now.", { karmaDelta: -2, apply: (p) => { p.mob.loyalty = Math.min(100, p.mob.loyalty + 15); p.mob.respect = Math.min(100, p.mob.respect + 5); } }),
    opt("Agree to inform", "You signed their papers. Immunity, $25,000 and a lifetime of looking over your shoulder.", { bankBalanceDelta: 25000, karmaDelta: 3, apply: (p) => { p.mob.informant = true; p.mob.exposure = 10; addHeat(p, -20); } }),
  ], { cooldown: 6, requires: { custom: (p) => inMob(p) && !p.mob.informant && !p.mob.witsec } }),

  ev("ux_boss_word", "crime", 18, 80, "The Boss Wants a Word", "A car pulls up outside your house. The driver doesn't smile. 'He wants to see you. Tonight.'", [
    opt("Swear loyalty", "You kissed the ring and said the words. The boss nodded. For now, you're family.", { karmaDelta: -2, apply: (p) => { p.mob.loyalty = Math.min(100, p.mob.loyalty + 10); } }),
    opt("Hand over an extra cut ($10,000)", "An envelope across the table. Loyalty can be bought, if you buy it often.", { bankBalanceDelta: -10000, apply: (p) => { p.mob.loyalty = Math.min(100, p.mob.loyalty + 22); } }),
    risk("Tell him you're thinking of getting out", 0.35, ["The boss laughed, then paused. 'A good man knows when to stop.' He blessed your exit.", { karmaDelta: 2, apply: (p) => { p.mob.loyalty = Math.max(p.mob.loyalty, 75); } }], ["The room went very quiet. You left with a warning, and the next year was very long.", { healthDelta: -8, apply: (p) => { p.mob.loyalty = Math.max(0, p.mob.loyalty - 30); } }]),
  ], { cooldown: 4, requires: { custom: (p) => inMob(p) && p.mob.loyalty < 55 } }),

  ev("ux_rival_offer", "crime", 20, 75, "A Rival Boss Reaches Out", "A rival boss sends word: 'This war is bad for business. A truce, or a better offer for you personally.'", [
    opt("Agree to a truce ($25,000)", "The truce cost money, and your boss will be pleased with the quiet. Rivals cooled.", { bankBalanceDelta: -25000, apply: (p) => { p.mob.rivalHeat = Math.max(0, p.mob.rivalHeat - 30); p.mob.loyalty = Math.min(100, p.mob.loyalty + 3); } }),
    opt("Refuse and send a message", "You sent back a very short note. Your crew loved it. The rivals did not.", { karmaDelta: -2, apply: (p) => { p.mob.respect = Math.min(100, p.mob.respect + 6); p.mob.rivalHeat = Math.min(100, p.mob.rivalHeat + 12); } }),
    risk("Take the 'better offer' and sell out the family", 0.4, ["The rival paid handsomely for what you knew. They don't know you like we do, though.", { bankBalanceDelta: 60000, karmaDelta: -8, apply: (p) => { p.mob.rivalHeat = Math.max(0, p.mob.rivalHeat - 40); p.mob.loyalty = Math.max(0, p.mob.loyalty - 25); } }], ["Your own boss learned about the meeting before you'd finished breakfast.", { karmaDelta: -8, healthDelta: -15, apply: (p) => { p.mob.marked = true; p.mob.loyalty = Math.max(0, p.mob.loyalty - 40); } }]),
  ], { cooldown: 5, requires: { custom: (p) => inMob(p) && p.mob.rivalHeat >= 40 } }),

  ev("ux_witsec_street", "crime", 20, 90, "A Familiar Face", "Across the supermarket aisle, a man you used to know is staring at you. He has a very good memory.", [
    opt("Walk away and call your handler", "Your marshal had you moved within the week. A new city again, a new routine. Safer, lonelier.", { happinessDelta: -4, apply: (p) => { p.residence = { ...p.residence, city: "Fargo" }; } }),
    risk("Act like a stranger", 0.6, ["He frowned, shook his head, and walked on. You made it to the car before your hands started shaking.", { happinessDelta: -2 }], ["He didn't forget. Two men were waiting by the car park exit that night.", { healthDelta: -25, happinessDelta: -8, apply: (p) => { p.mob.marked = true; } }]),
  ], { cooldown: 6, requires: { custom: (p) => p.mob.witsec && !inMob(p) } }),

  // ---------- the Agency ----------
  ev("sx_handler_favour", "crime", 21, 70, "Your Handler Asks for a Favour", "Your handler wants something off the books: a quiet look at a colleague's files.", [
    risk("Do it", 0.65, ["It was easy and it was never mentioned again. Your handler owes you.", { bankBalanceDelta: 5000, apply: (p) => { p.spy.handlerTrust = Math.min(100, p.spy.handlerTrust + 12); p.spy.cover = Math.max(0, p.spy.cover - 4); } }], ["The colleague's security system logged everything. Internal affairs wants a chat.", { karmaDelta: -2, apply: (p) => { p.spy.suspicion = Math.min(100, p.spy.suspicion + 25); p.spy.handlerTrust = Math.max(0, p.spy.handlerTrust - 10); } }]),
    opt("Refuse on principle", "'Understood,' said your handler, and meant the opposite. You're clean, and a little less trusted.", { karmaDelta: 2, apply: (p) => { p.spy.handlerTrust = Math.max(0, p.spy.handlerTrust - 8); } }),
    opt("Report it to oversight", "Oversight thanked you. Your handler didn't. Suspicion fell on him, not you.", { karmaDelta: 3, apply: (p) => { p.spy.handlerTrust = Math.max(0, p.spy.handlerTrust - 25); p.spy.suspicion = Math.max(0, p.spy.suspicion - 15); } }),
  ], { cooldown: 5, requires: { custom: (p) => inAgency(p) } }),

  ev("sx_foreign_recruit", "crime", 22, 70, "A Pleasant Stranger", "At a conference, a charming diplomat buys you a drink and slowly steers the talk toward your work, and your salary.", [
    opt("Report the approach to your handler", "Your handler was delighted. A foreign recruitment attempt, caught early. Trust and a commendation.", { karmaDelta: 2, apply: (p) => { p.spy.handlerTrust = Math.min(100, p.spy.handlerTrust + 15); if (p.currentJob) p.currentJob.performance = Math.min(100, p.currentJob.performance + 10); } }),
    opt("Take the money ($40,000)", "An envelope and a promise of more. You are not a loyal servant any more, only a careful one.", { bankBalanceDelta: 40000, karmaDelta: -12, apply: (p) => { p.spy.doubleAgent = true; p.spy.foreignTrust = 20; p.spy.suspicion = Math.min(100, p.spy.suspicion + 15); } }),
    opt("Excuse yourself and say nothing", "You left early. Not reporting it is a small sin that grows in the dark.", { apply: (p) => { p.spy.suspicion = Math.min(100, p.spy.suspicion + 5); } }),
  ], { cooldown: 6, requires: { custom: (p) => inAgency(p) && !p.spy.doubleAgent } }),

  ev("sx_after_burn", "career", 22, 80, "No Longer Cleared", "Years of secrecy, and now nobody will confirm you ever worked for the government. A defence contractor offers a quiet job, a publisher offers a lot of money, and your old life keeps shadowing you.", [
    opt("Take the contractor's job", "Your skills still count for something. The job is dull, and the pay is respectable.", { bankBalanceDelta: 15000, happinessDelta: 2, apply: (p, rng) => { if (!p.currentJob && !p.business) { p.currentJob = makeJob(CAREER_BY_ID.security, 0, rng as never); p.annualSalary = p.currentJob.salary; } } }),
    risk("Write the tell-all", 0.4, ["It sold well and nobody sued. You're famous for ten minutes.", { bankBalanceDelta: 90000, fameDelta: 8, karmaDelta: -3 }], ["Your old employer's lawyers called it a breach of the Official Secrets Act.", { arrest: { name: "Unauthorised Disclosure", description: "You published classified details in breach of your oath.", years: 4, severity: "serious", evidence: 85 }, karmaDelta: -3 }]),
    opt("Live quietly", "You took up gardening. Nobody asked what you used to do, and you never said.", { happinessDelta: 4 }),
  ], { once: true, requires: { custom: (p) => p.spy.burned && !!p.spy.burnedYear && p.year - p.spy.burnedYear <= 4 && !p.isInPrison } }),

  ev("sx_cover_slip", "general", 21, 70, "A Slip of the Tongue", "At a dinner party someone asks where you work. The cover story you've told for years has a hole in it, and a guest has noticed.", [
    opt("Smile and change the subject", "Practised charm carried you through. Nobody pressed.", { apply: (p) => { p.spy.cover = Math.max(0, p.spy.cover - 4); } }),
    opt("Tell a bigger lie", "You added three details, a name and a nonexistent colleague. Your cover is richer, and more fragile.", { karmaDelta: -1, apply: (p) => { p.spy.cover = Math.min(100, p.spy.cover + 6); p.spy.suspicion = Math.min(100, p.spy.suspicion + 4); } }),
    opt("Leave early with a headache", "You left in a hurry. The host thought it was strange. So did you.", { happinessDelta: -2, apply: (p) => { p.spy.cover = Math.max(0, p.spy.cover - 8); } }),
  ], { cooldown: 5, requires: { custom: (p) => inAgency(p) && p.spy.cover < 70 } }),
];
