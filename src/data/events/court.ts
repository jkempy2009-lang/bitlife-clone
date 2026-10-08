import { ev, opt, risk } from "../eventBuilders";
import type { LifeEvent } from "../lifeEventsEngine";
import type { PlayerState } from "@/types/game.types";
import { INFAMOUS_NAMES, PATRONAGES, TRADITIONAL_NAMES } from "../court";
import { clamp } from "@/lib/format";
import { isRoyal } from "@/engine/state";
import { isSovereign, roman } from "@/engine/courtState";
import { addApproval, addGovernment, addHeat, addPatronage, addRepublic, addStrain, enlist, maxPatronages, resolveScandal, startScandal } from "@/engine/court";
import { BILLS, abdicate, abdicationBlocker, giveAssent, heirToThrone, holdReferendum, resolveCrisis } from "@/engine/crown";
import { royalChildren, styleSpouse } from "@/engine/courtFamily";
import { defaultTraining } from "@/engine/courtState";

const sov = (p: PlayerState) => isSovereign(p) && !p.court.regency;
const adultRoyal = (p: PlayerState) => isRoyal(p) && p.age >= 16 && !p.court.regency;
const noPartner = (p: PlayerState) => !p.relatives.some((r) => r.relation === "Partner" && r.alive && r.partnerStatus !== "ex");

const regnal = (p: PlayerState, name: string): string => {
  p.court.regnalName = name;
  const style = p.gender === "Male" ? "King" : "Queen";
  const text = `You will reign as ${style} ${name}.`;
  p.lifeLog.push(text);
  return text;
};
const ownName = (p: PlayerState, rngChance: boolean, num: number) => `${p.firstName}${rngChance ? ` ${roman(num)}` : ""}`;

// The crown: accession, mourning, the constitution, the purse, the family. Almost all of these are queued by the
// engine (scheduledOnly) or gated on being a royal; none appear for ordinary lives.
export const COURT_EVENTS: LifeEvent[] = [
  // ---------- accession and mourning ----------
  ev("crown_accession_council", "royalty", 0, 120, "The Accession Council", "The Privy Council has assembled to proclaim you sovereign. Tradition says you must announce the name under which you will reign. The choice is a statement.", [
    opt("Reign under your own name", "You chose your own name. Honest, modern, and a little unusual.", {
      bizEffect: (p, rng) => { addApproval(p, 2); return regnal(p, ownName(p, rng.chance(0.55), rng.int(2, 5))); },
    }),
    opt("Take the name of a great predecessor", "You took the name of a revered sovereign. Continuity is comforting at a time like this.", {
      royalRespectDelta: 6,
      bizEffect: (p, rng) => { addApproval(p, 2); return regnal(p, `${rng.pick(TRADITIONAL_NAMES[p.gender === "Male" ? "Male" : "Female"])} ${roman(rng.int(2, 8))}`); },
    }),
    risk("Take the name of a notorious predecessor", 0.5, [
      "You reclaimed a name with a bloody reputation, and the country admired the nerve.",
      { bizEffect: (p, rng) => { addApproval(p, 8); return regnal(p, `${rng.pick(INFAMOUS_NAMES[p.gender === "Male" ? "Male" : "Female"])} ${roman(rng.int(2, 4))}`); } },
    ], [
      "Historians pounced. 'Why that name?' ran every headline.",
      { royalRespectDelta: -4, bizEffect: (p, rng) => { addApproval(p, -8); return regnal(p, `${rng.pick(INFAMOUS_NAMES[p.gender === "Male" ? "Male" : "Female"])} ${roman(rng.int(2, 4))}`); } },
    ]),
  ], { scheduledOnly: true }),

  ev("crown_state_funeral", "royalty", 0, 120, "A State Funeral", "The sovereign is dead. The country is in mourning and the whole family walks behind the coffin. The cameras will remember every expression.", [
    opt("Walk with the family, dignified and composed", "You walked in step with the family, head high. The country took comfort in it.", { royalRespectDelta: 3, happinessDelta: -5, karmaDelta: 1, bizEffect: (p) => { addApproval(p, 3); } }),
    opt("Keep the vigil beside the coffin", "You stood vigil for hours through the night. Strangers wept at the photographs.", { royalRespectDelta: 4, happinessDelta: -8, healthDelta: -2, bizEffect: (p) => { addApproval(p, 5); } }),
    opt("Grieve privately and stay out of sight", "You asked for privacy. The family understood. The public did not entirely.", { happinessDelta: -3, bizEffect: (p) => { addApproval(p, -3); addHeat(p, 4); } }),
  ], { scheduledOnly: true }),

  ev("crown_coronation", "royalty", 0, 120, "The Coronation", "A year of mourning is over. The time has come to crown you in the great cathedral, with all the pageantry the nation can muster.", [
    opt("A full state coronation", "The bells rang, the trumpets sounded, and the crown was placed on your head before a hundred million viewers.", {
      happinessDelta: 8,
      bizEffect: (p) => {
        const c = p.economy.climate;
        p.court.coronated = true;
        addApproval(p, c === "recession" ? -3 : c === "boom" ? 12 : 9);
        addRepublic(p, c === "recession" ? 3 : -2);
        return c === "recession" ? "With families struggling, the cost of the spectacle drew sharp criticism." : "The nation basked in the pageantry.";
      },
    }),
    opt("A slimmed-down ceremony", "A shorter, cheaper service, with fewer guests and no carriages. Traditionalists sniffed. The country approved.", {
      happinessDelta: 3,
      bizEffect: (p) => {
        const c = p.economy.climate;
        p.court.coronated = true;
        addApproval(p, c === "recession" ? 9 : 5);
        addRepublic(p, -3);
        changeRespect(p, -2);
      },
    }),
    opt("Postpone it indefinitely", "You postponed the coronation. Constitutionally nothing changes, but the whispering has started.", {
      royalRespectDelta: -6,
      bizEffect: (p) => { addApproval(p, -4); p.scheduled.push({ id: "crown_coronation", dueYear: p.year + 2 }); },
    }),
  ], { scheduledOnly: true, cooldown: 1, requires: { custom: sov } }),

  // ---------- the press office ----------
  ev("crown_scandal_open", "royalty", 14, 120, "The Press Office", "A damaging story is breaking. Your press office is waiting for instructions. How will you respond?", [
    opt("A press office statement", "You had the press office issue a firm statement.", { bizEffect: (p, rng) => resolveScandal(p, rng, "statement") }),
    opt("A sincere public apology", "You apologised in your own words.", { bizEffect: (p, rng) => resolveScandal(p, rng, "apologise") }),
    opt("Send in the lawyers", "You instructed your lawyers to suppress the story.", { bizEffect: (p, rng) => resolveScandal(p, rng, "lawyers") }),
    opt("Never complain, never explain", "You said nothing at all.", { bizEffect: (p, rng) => resolveScandal(p, rng, "silence") }),
    opt("Withdraw from public life for a while", "You asked to be left out of the diary for a time.", { bizEffect: (p, rng) => resolveScandal(p, rng, "withdraw") }),
    opt("Leave royal life for good", "You told the family you were done with the Firm.", { bizEffect: (p, rng) => resolveScandal(p, rng, "leave") }),
  ], { scheduledOnly: true }),

  ev("crown_scandal_core", "royalty", 14, 120, "The Press Office", "A damaging story is breaking. As the sovereign, or the heir, you can't simply step back from it. How will you respond?", [
    opt("A press office statement", "You had the press office issue a firm statement.", { bizEffect: (p, rng) => resolveScandal(p, rng, "statement") }),
    opt("A sincere public apology", "You apologised in your own words.", { bizEffect: (p, rng) => resolveScandal(p, rng, "apologise") }),
    opt("Address the nation", "You went on television and spoke directly to the people.", { bizEffect: (p, rng) => resolveScandal(p, rng, "address") }),
    opt("Send in the lawyers", "You instructed your lawyers to suppress the story.", { bizEffect: (p, rng) => resolveScandal(p, rng, "lawyers") }),
    opt("Never complain, never explain", "You said nothing at all.", { bizEffect: (p, rng) => resolveScandal(p, rng, "silence") }),
  ], { scheduledOnly: true }),

  ev("crown_tabloid_deal", "royalty", 18, 100, "A Friendly Editor", "A tabloid editor offers sympathetic coverage in return for regular access to your private life.", [
    risk("Accept the arrangement", 0.7, ["The coverage glowed for a year and the public adored you.", { bizEffect: (p) => { addApproval(p, 5); addHeat(p, 10); } }], ["The arrangement leaked, and the papers turned on you.", { bizEffect: (p, rng) => { addApproval(p, -4); addHeat(p, 15); startScandal(p, rng, [], "feud"); } }]),
    opt("Decline politely", "You kept the press at arm's length.", { karmaDelta: 1, bizEffect: (p) => { addHeat(p, -4); } }),
    opt("Brief the serious papers instead", "You gave a considered interview to a broadsheet. It was read by about forty people.", { bizEffect: (p) => { addApproval(p, 2); } }),
  ], { requires: { royal: true, custom: adultRoyal }, cooldown: 5, weight: 0.8 }),

  ev("crown_secretary_warns", "royalty", 18, 100, "A Quiet Word", "Your private secretary asks for a private word. A donor you are due to dine with has a controversial reputation. 'Ma'am, sir, I would not.'", [
    opt("Take the advice and cancel", "You cancelled. The donor sulked; the papers never knew how close it was.", { royalRespectDelta: 1, bizEffect: (p) => { addHeat(p, -3); } }),
    risk("Dine anyway", 0.55, ["The dinner passed without incident. The donor wrote a large cheque to your charities.", { bankBalanceDelta: 50000, bizEffect: (p) => { addApproval(p, 1); } }], ["The photograph of you with the donor landed in the papers within the week.", { bizEffect: (p, rng) => { startScandal(p, rng, [], "tax"); } }]),
  ], { requires: { royal: true, custom: (p) => adultRoyal(p) && p.court.secretary >= 2 }, cooldown: 6, weight: 1.2 }),

  // ---------- the constitution ----------
  ...BILLS.map((bill) =>
    ev(`crown_assent_${bill.id}`, "royalty", 16, 120, "Royal Assent", `Parliament has passed the ${bill.name} and it awaits your signature. By convention you sign what Parliament sends. You have private doubts about this one.`, [
      opt("Grant assent, as convention requires", `You signed the ${bill.name}.`, { bizEffect: (p, rng) => giveAssent(p, rng, bill, "assent") }),
      opt("Raise concerns with ministers first", "Your private office sent a quiet note to the Cabinet Office.", { bizEffect: (p, rng) => giveAssent(p, rng, bill, "concerns") }),
      opt("Withhold assent", "You refused to sign.", { bizEffect: (p, rng) => giveAssent(p, rng, bill, "withhold") }),
    ], { requires: { royal: true, custom: sov }, cooldown: 6, weight: 0.7 }),
  ),

  ev("crown_state_opening", "royalty", 18, 120, "State Opening of Parliament", "It's the State Opening. You will read the government's speech from the throne, the one day a year the sovereign addresses both houses.", [
    opt("Read it exactly as written", "You read every word as given, without a flicker of expression. Perfect.", { bizEffect: (p) => { addGovernment(p, 2); } }),
    risk("Lean on the passages you care about", 0.6, ["A subtle emphasis, and nobody could say you'd gone off script. Your point was made.", { royalRespectDelta: 2, bizEffect: (p) => { addApproval(p, 1); } }], ["The inflection was noticed. Commentators were scandalised at 'royal politics'.", { bizEffect: (p) => { addStrain(p, 10); addGovernment(p, -5); addApproval(p, -2); } }]),
    opt("Let your heir read it instead", "You delegated the speech to the heir. Age has its privileges; the public sympathised.", { bizEffect: (p) => { addApproval(p, p.age >= 70 ? 0 : -3); changeRespect(p, p.age >= 70 ? 0 : -3); } }),
  ], { requires: { royal: true, custom: sov }, cooldown: 2, weight: 0.8 }),

  ev("crown_constitutional_crisis", "royalty", 16, 120, "A Constitutional Crisis", "Your meddling has finally boiled over. The Prime Minister is publicly warning that the sovereign must stay out of politics, and the papers are asking who is really in charge.", [
    opt("Back down and let the government govern", "You stepped back. It was humbling and it worked.", { bizEffect: (p, rng) => resolveCrisis(p, rng, "retreat") }),
    opt("Dig in and appeal to the public", "You made it a fight, and went over the government's head.", { bizEffect: (p, rng) => resolveCrisis(p, rng, "dig_in") }),
    opt("Ask the Prime Minister to call an election", "You let the voters decide who is right.", { bizEffect: (p, rng) => resolveCrisis(p, rng, "election") }),
  ], { scheduledOnly: true }),

  ev("crown_referendum", "royalty", 16, 120, "A Referendum on the Monarchy", "Republicans have won a referendum on abolishing the monarchy. The country is split. The vote is in a few weeks and all eyes are on the palace.", [
    opt("Stay above politics", "You said nothing, as a constitutional monarch must.", { bizEffect: (p, rng) => resolveRef(p, rng, "above") }),
    opt("Campaign openly for the Crown", "You took your case to the people, which is not what a sovereign is supposed to do.", { bizEffect: (p, rng) => resolveRef(p, rng, "campaign") }),
    opt("Offer to slim down the monarchy", "You offered to cut the grant, open the books and shrink the royal household.", { bizEffect: (p, rng) => resolveRef(p, rng, "reform") }),
  ], { scheduledOnly: true }),

  ev("crown_grant_review", "royalty", 25, 120, "The Sovereign Grant Review", "The Treasury is reviewing the funding of the monarchy. A new formula will fix the Sovereign Grant for years to come.", [
    opt("Accept the Treasury's formula", "You accepted the Treasury's formula without a quarrel.", { bizEffect: (p) => { addGovernment(p, 2); addApproval(p, 1); } }),
    risk("Lobby ministers for a bigger share", 0.5, ["Your private office won a more generous settlement.", { bizEffect: (p) => { p.court.grantAdj = clamp(p.court.grantAdj + 0.15, -0.4, 0.3); addGovernment(p, -2); } }], ["The press learned that the palace was lobbying for more public money.", { bizEffect: (p) => { addApproval(p, -4); addStrain(p, 10); addHeat(p, 10); } }]),
    opt("Volunteer cuts and open the books", "You published the palace accounts and offered a leaner grant. The public were pleasantly stunned.", { royalRespectDelta: 2, bizEffect: (p) => { p.court.grantAdj = clamp(p.court.grantAdj - 0.1, -0.4, 0.3); addApproval(p, 6); addRepublic(p, -4); } }),
  ], { requires: { royal: true, custom: sov }, cooldown: 9, weight: 0.6 }),

  ev("crown_love_or_crown", "royalty", 25, 70, "Love and the Crown", "You have fallen for someone the government and the church say is an unsuitable consort. The Prime Minister has warned you privately: marry them and he will advise that you cannot remain sovereign.", [
    opt("Abdicate and marry the one you love", "You signed the instrument of abdication, and your heir was proclaimed.", {
      addRelative: { relation: "Partner", ageOffset: [-6, 6], partnerStatus: "married" },
      bizEffect: (p) => abdicate(p, "love"),
    }),
    opt("Give them up and stay on the throne", "You told them it was over. You kept the crown, and lost something else.", { happinessDelta: -10, royalRespectDelta: 3, karmaDelta: 2, bizEffect: (p) => { addApproval(p, 3); } }),
    risk("Marry anyway and weather the storm", 0.4, ["The country shrugged. Times had changed, and the marriage was accepted.", { happinessDelta: 12, addRelative: { relation: "Partner", ageOffset: [-6, 6], partnerStatus: "married" }, bizEffect: (p) => { addApproval(p, 4); addRepublic(p, -2); } }], ["The government resigned and the church refused to bless the marriage. The crisis dragged on for months.", { happinessDelta: -6, addRelative: { relation: "Partner", ageOffset: [-6, 6], partnerStatus: "married" }, bizEffect: (p) => { addStrain(p, 35); addApproval(p, -10); addRepublic(p, 8); } }]),
  ], { requires: { royal: true, custom: (p) => sov(p) && !!heirToThrone(p) && abdicationBlocker(p) === null }, once: true, weight: 0.5 }),

  // ---------- family ----------
  ev("crown_romance", "royalty", 20, 42, "A Royal Courtship", "Someone has caught your eye. Marrying into the family is not like other marriages: if you are in the first six in line, the sovereign must consent.", [
    opt("Pursue a dynastic match with a foreign royal", "The sovereign approved at once. The wedding was a spectacle of lace and cannons.", {
      bankBalanceDelta: -250000, royalRespectDelta: 4,
      addRelative: { relation: "Partner", ageOffset: [-4, 4], partnerStatus: "married" },
      bizEffect: (p) => { styleSpouse(p); addApproval(p, 3); },
    }),
    risk("Marry the commoner you love, with the sovereign's consent", 0.65, ["The sovereign gave consent. The public delighted in a love match, and the commoner won the crowd over.", {
      happinessDelta: 10, addRelative: { relation: "Partner", ageOffset: [-4, 4], partnerStatus: "married" },
      bizEffect: (p) => { styleSpouse(p); addApproval(p, 6); addHeat(p, 15); },
    }], ["Consent was refused. You spent two unhappy years waiting; your sweetheart eventually drifted away.", { happinessDelta: -8, royalRespectDelta: -3 }]),
    opt("Marry without consent", "You went ahead without permission. The marriage stands, but you lost your place in the line of succession.", {
      happinessDelta: 8, royalRespectDelta: -8,
      addRelative: { relation: "Partner", ageOffset: [-4, 4], partnerStatus: "married" },
      bizEffect: (p) => { if (p.royal && p.royal.line <= 6) p.royal.line = 30; styleSpouse(p); addApproval(p, -4); },
    }),
    opt("Stay single and focus on duty", "You chose duty over romance. The court sighed with relief and the tabloids with disappointment.", { royalRespectDelta: 2, happinessDelta: -2 }),
  ], { requires: { royal: true, custom: (p) => !isSovereign(p) && noPartner(p) && p.seenEvents.arranged_marriage === undefined }, once: true, weight: 2.4 }),

  ev("crown_heir_trouble", "royalty", 15, 120, "The Young Royal's Night Out", "One of your children has been photographed leaving a nightclub in the early hours, and the papers have it all.", [
    opt("A quiet family talk", "You sat them down for a long, honest talk. They listened.", { bizEffect: (p) => { const k = pickKid(p); if (k) { k.relationshipBar = clamp(k.relationshipBar + 6); k.royalTraining = bump(k.royalTraining, "duty", 3); } addApproval(p, -1); } }),
    opt("Send them on a service placement", "A placement with a rural charity worked wonders for their character.", { bizEffect: (p) => { const k = pickKid(p); if (k) { k.relationshipBar = clamp(k.relationshipBar - 4); k.royalTraining = bump(k.royalTraining, "duty", 8); } addApproval(p, 2); } }),
    risk("Pay to keep it out of the papers ($60,000)", 0.65, ["The pictures vanished before the first edition.", { bankBalanceDelta: -60000 }], ["The payment leaked. 'Palace hush money' was the headline.", { bankBalanceDelta: -60000, bizEffect: (p, rng) => { addApproval(p, -4); addHeat(p, 15); startScandal(p, rng, [], "photos"); } }]),
  ], { scheduledOnly: true, requires: { custom: (p) => royalChildren(p).some((k) => k.age >= 15 && k.age <= 24) } }),

  // ---------- young royals ----------
  ev("crown_officer_training", "royalty", 18, 20, "A Commission Beckons", "You are 18. Royals have long served in the armed forces, and the public respects it. A place at officer training is yours if you want it.", [
    opt("Take a commission in the Army", "You began officer training with the Army.", { bizEffect: (p) => enlist(p, "army") }),
    opt("Join the Navy", "You began officer training with the Navy.", { bizEffect: (p) => enlist(p, "navy") }),
    opt("Train as a pilot in the Air Force", "You began officer training with the Air Force.", { bizEffect: (p) => enlist(p, "air") }),
    opt("Go to university instead", "You turned down the commission and put your name down for university.", { smartsDelta: 1, bizEffect: (p) => { addApproval(p, -1); } }),
    opt("Take a gap year", "You took a year to travel and think. The press called you a 'gap-year royal'.", { happinessDelta: 5, bizEffect: (p) => { addApproval(p, -2); addHeat(p, 4); } }),
  ], { requires: { royal: true, custom: (p) => isRoyal(p) && !isSovereign(p) && !p.court.service && !p.court.regency }, once: true, weight: 3 }),

  ev("crown_patronage_invite", "royalty", 16, 90, "Would You Be Our Patron?", "A charity has written to ask whether you would become its patron. A patron lends their name, visits once a year and, over time, becomes the face of the cause.", [
    opt("Accept, and make it your own", "You said yes. The charity was thrilled.", { bizEffect: (p, rng) => {
      const free = PATRONAGES.filter((x) => !p.court.patronages.some((h) => h.id === x.id));
      if (free.length === 0 || p.court.patronages.length >= maxPatronages(p)) return "You already back as many causes as you can manage.";
      const pick = rng.pick(free);
      return addPatronage(p, pick.id);
    } }),
    opt("Politely decline", "You declined. The charity found someone else, and said all the right things.", { bizEffect: (p) => { addApproval(p, -1); } }),
  ], { requires: { royal: true, custom: (p) => adultRoyal(p) && !p.court.disgraced && p.court.patronages.length < maxPatronages(p) }, cooldown: 4, weight: 1.5 }),
];

function pickKid(p: PlayerState) {
  return royalChildren(p).filter((k) => k.age >= 15 && k.age <= 24)[0];
}
function bump(t: ReturnType<typeof defaultTraining> | undefined, key: "duty" | "touch" | "polish", n: number) {
  const base = t ?? defaultTraining();
  return { ...base, [key]: clamp(base[key] + n) };
}
function changeRespect(p: PlayerState, n: number) {
  p.royalRespect = clamp(p.royalRespect + n);
}
function resolveRef(p: PlayerState, rng: import("@/lib/rng").Rng, stance: "above" | "campaign" | "reform"): string {
  return holdReferendum(p, rng, stance).text;
}
