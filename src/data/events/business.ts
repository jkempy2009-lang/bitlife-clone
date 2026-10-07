/**
 * Business-owner events. Every event is gated on actually owning a business (often of particular kinds) and works
 * on the company's own state through `bizEffect`. Dollar amounts are shares of the company's revenue so they scale
 * from a food truck to a freight firm. Costs come out of company cash (and, if that runs dry, your savings).
 */
import type { LifeEvent } from "../lifeEventsEngine";
import { ev, opt, risk } from "../eventBuilders";
import type { PlayerState } from "@/types/game.types";
import {
  bizBuyShares,
  bizCheapLoan,
  bizEffect,
  bizSellInPlace,
  bizSellStake,
  capacityOf,
  kindOf,
  ownsKind,
} from "@/engine/business";

const owns = (...ids: string[]) => (p: PlayerState) => ownsKind(p, ...ids);
const FOOD = ["foodtruck", "restaurant", "barcafe", "nightclub"];
const SHOPS = ["boutique", "restaurant", "barcafe", "foodtruck", "gym", "onlinestore"];
const PHYSICAL = ["foodtruck", "farm", "restaurant", "barcafe", "gym", "construction", "logistics", "nightclub", "boutique"];
const years = (p: PlayerState) => p.business?.history.length ?? 0;
const biz = (p: PlayerState) => p.business!;

/** Owners of a business face business events far more often than the general pool would produce, hence the weight boost. */
const BOOST = 4;
const RAW_EVENTS: LifeEvent[] = [
  ev("biz_health_inspection", "money", 18, 85, "Surprise Inspection", "An inspector walks into {biz} unannounced with a clipboard and a flashlight.", [
    risk("Welcome them and show the paperwork", 0.62, ["You passed with flying colours.", { happinessDelta: 3, bizEffect: bizEffect({ rep: 4, compliance: 12 }) }], ["They found several violations and issued a hefty fine.", { happinessDelta: -4, bizEffect: bizEffect({ cashPctRevenue: -0.03, rep: -6, compliance: 5 }) }], "smarts"),
    opt("Shut for a day and fix everything first (about 2% of revenue)", "You scrubbed, relabelled and re-filed. The inspector had little to say.", { bizEffect: bizEffect({ cashPctRevenue: -0.02, compliance: 25, facility: 8, rep: 1 }) }),
    risk("Slip the inspector an envelope", 0.3, ["He pocketed it and left. You feel dirty.", { karmaDelta: -6, bizEffect: bizEffect({ cashPctRevenue: -0.005 }) }], ["He reported it. The police were waiting.", { karmaDelta: -8, bizEffect: bizEffect({ rep: -10 }), arrest: { name: "Bribery", description: "An inspector reported your attempted bribe.", years: 2, severity: "serious" } }]),
  ], { requires: { custom: owns(...FOOD, "gym") }, cooldown: 5, weight: 1.3 }),

  ev("biz_poaching", "money", 20, 70, "Poached", "A rival wants your best person and has made them a tempting offer. They've come to you before they decide.", [
    opt("Match the offer (about 2% of revenue a year)", "You matched it. They stayed, and so did the knowledge in their head.", { happinessDelta: 1, bizEffect: bizEffect({ cashPctRevenue: -0.02, morale: 4 }) }),
    opt("Wish them well", "They left on good terms, and you scrambled to cover the gap.", { bizEffect: bizEffect({ staff: -1, morale: -6, customers: -2 }) }),
    risk("Give them a small share of the company to stay", 0.6, ["They stayed and worked like an owner.", { bizEffect: bizEffect({ morale: 8, quality: 3, rep: 2 }) }], ["They took the equity and left a year later anyway.", { bizEffect: bizEffect({ staff: -1, morale: -8 }) }], "smarts"),
  ], { requires: { custom: (p) => !!p.business && (biz(p).staff >= 2 || !!biz(p).manager) }, cooldown: 5 }),

  ev("biz_supplier_shock", "money", 18, 80, "Supplier Shock", "Your main supplier has hiked prices 25% overnight. Your costs are about to bite.", [
    opt("Absorb it and protect your customers", "You swallowed the increase for now. Margins are thin this year.", { bizEffect: bizEffect({ cashPctRevenue: -0.04 }) }),
    opt("Pass the cost on to customers", "Prices went up. Some regulars grumbled, a few left.", { bizEffect: bizEffect({ cashPctRevenue: -0.01, customers: -5, rep: -1 }) }),
    risk("Switch to a cheaper supplier", 0.55, ["The new supplier was as good and cheaper.", { bizEffect: bizEffect({ cashPctRevenue: -0.012, quality: 1 }) }], ["The new supplier's quality was dreadful, and customers noticed.", { bizEffect: bizEffect({ cashPctRevenue: -0.03, quality: -6, rep: -4 }) }], "smarts"),
  ], { requires: { custom: owns(...FOOD, "farm", "boutique", "construction", "logistics", "gym") }, cooldown: 5 }),

  ev("biz_viral_review", "money", 18, 80, "Gone Viral", "A popular local reviewer just posted about {biz} and the post is spreading fast.", [
    risk("Lean in: invite them back and engage with the comments", 0.65, ["The follow-up charmed everyone. Queues round the block.", { fameDelta: 2, happinessDelta: 5, bizEffect: bizEffect({ customers: 10, rep: 6, marketing: 1 }) }], ["The review was brutal, and engaging only fanned the flames.", { happinessDelta: -4, bizEffect: bizEffect({ customers: -4, rep: -7 }) }], "looks"),
    opt("Put money behind it with a quick ad push (about 2% of revenue)", "You rode the wave with a targeted campaign.", { bizEffect: bizEffect({ cashPctRevenue: -0.02, customers: 6, marketing: 1 }) }),
    opt("Ignore it", "The internet's attention moved on in a week.", { bizEffect: bizEffect({ customers: 1 }) }),
  ], { requires: { custom: owns(...SHOPS) }, cooldown: 4, weight: 1.2 }),

  ev("biz_lawsuit", "money", 20, 85, "Served Papers", "A former customer is suing {biz} over an alleged injury. Your lawyer says it could go either way.", [
    opt("Settle quietly (about 4% of revenue)", "You paid, signed an NDA, and moved on.", { bizEffect: bizEffect({ cashPctRevenue: -0.04, rep: -1 }) }),
    risk("Fight it in court", 0.5, ["The judge threw the case out.", { happinessDelta: 3, bizEffect: bizEffect({ cashPctRevenue: -0.01, rep: 2 }) }], ["You lost, and the damages and legal fees were steep.", { happinessDelta: -5, bizEffect: bizEffect({ cashPctRevenue: -0.14, rep: -5 }) }], "smarts"),
  ], { requires: { custom: owns(...PHYSICAL) }, cooldown: 6 }),

  ev("biz_theft", "money", 20, 80, "Cooking the Books", "An audit trail shows someone on your payroll has been quietly skimming from the till.", [
    risk("Prosecute", 0.6, ["They were convicted and you recovered most of the money.", { karmaDelta: 2, bizEffect: bizEffect({ cashPctRevenue: -0.01, morale: -3, compliance: 12 }) }], ["The case collapsed and you lost the money and the goodwill.", { bizEffect: bizEffect({ cashPctRevenue: -0.05, morale: -6 }) }], "smarts"),
    opt("Fire them quietly and eat the loss", "No scandal, no recovery.", { bizEffect: bizEffect({ cashPctRevenue: -0.03, staff: -1, morale: -4 }) }),
    opt("Install proper controls (about 5% of revenue)", "You tightened every process. It won't happen again.", { bizEffect: bizEffect({ cashPctRevenue: -0.05, compliance: 28, morale: -2 }) }),
  ], { requires: { custom: (p) => !!p.business && (biz(p).staff >= 2 || !!biz(p).manager) && biz(p).compliance < 75 }, cooldown: 7 }),

  ev("biz_tax_audit", "money", 22, 85, "The Taxman Cometh", "Tax authorities have selected {biz} for an audit.", [
    opt("Hire a top accountant (about 1.5% of revenue)", "The accountant found every deduction and you passed cleanly.", { bizEffect: bizEffect({ cashPctRevenue: -0.015, compliance: 15 }) }),
    risk("Handle it yourself", 0.5, ["Your records held up. Nothing to see.", { happinessDelta: 2 }], ["They found errors and levied penalties and interest.", { happinessDelta: -4, bizEffect: bizEffect({ cashPctRevenue: -0.09, compliance: -10 }) }], "smarts"),
    opt("Voluntarily disclose past mistakes", "You came clean and paid what you owed with a reduced penalty.", { karmaDelta: 3, bizEffect: bizEffect({ cashPctRevenue: -0.04, compliance: 18 }) }),
  ], { requires: { custom: (p) => !!p.business && biz(p).revenue > 80_000 }, cooldown: 7 }),

  ev("biz_big_contract", "money", 22, 70, "The Big Contract", "A large client offers {biz} a major contract. The upside is huge, but so are the demands.", [
    risk("Accept and scale up to deliver", 0.58, ["You delivered on time. The client became a repeat customer.", { happinessDelta: 6, bizEffect: bizEffect({ cashPctRevenue: 0.25, rep: 6, morale: -2 }) }], ["You couldn't keep up. Missed deadlines, penalties and an angry client.", { happinessDelta: -5, bizEffect: bizEffect({ cashPctRevenue: -0.12, rep: -9, morale: -8 }) }], "smarts"),
    risk("Negotiate for better terms", 0.35, ["They agreed to your terms. A fantastic deal.", { happinessDelta: 8, bizEffect: bizEffect({ cashPctRevenue: 0.35, rep: 6 }) }], ["They walked away and gave the work to someone else.", { bizEffect: bizEffect({}) }], "smarts"),
    opt("Decline and stay focused", "You stayed on your steady course.", { smartsDelta: 1 }),
  ], { requires: { custom: owns("construction", "logistics", "consultancy", "onlinestore", "farm", "startup") }, cooldown: 6, weight: 1.2 }),

  ev("biz_acquisition_offer", "money", 25, 75, "An Offer for the Company", "A larger competitor has made an unsolicited offer for {biz}.", [
    opt("Accept the offer", "You took the deal and walked away with your payout.", { happinessDelta: 4, bizEffect: (p, rng) => bizSellInPlace(p, rng, "acquired", 1.15) }),
    risk("Push for a higher price", 0.45, ["They came back with a much better number, and you took it.", { happinessDelta: 6, bizEffect: (p, rng) => bizSellInPlace(p, rng, "acquired", 1.4) }], ["They walked away and the offer is gone.", { happinessDelta: -2, bizEffect: bizEffect({ morale: -2 }) }], "smarts"),
    opt("Decline: it's not for sale", "You told them no. The business stays yours.", { happinessDelta: 1, bizEffect: bizEffect({ morale: 3 }) }),
  ], { requires: { custom: (p) => !!p.business && p.business.kind !== "startup" && years(p) >= 3 && biz(p).lastProfit > 0 && biz(p).value > 150_000 }, cooldown: 8, weight: 0.8 }),

  ev("biz_startup_buyout", "money", 20, 60, "Big Tech Comes Knocking", "A tech giant wants to acquire {biz} and fold your team into theirs.", [
    opt("Take the exit", "You signed. Press releases, champagne, and a very large wire transfer.", { happinessDelta: 8, fameDelta: 5, bizEffect: (p, rng) => bizSellInPlace(p, rng, "acquired", 1.35) }),
    risk("Hold out for a bidding war", 0.4, ["A second bidder appeared. You sold for far more.", { happinessDelta: 12, fameDelta: 8, bizEffect: (p, rng) => bizSellInPlace(p, rng, "acquired", 1.9) }], ["The giant lost interest and walked away. Your team is rattled.", { happinessDelta: -4, bizEffect: bizEffect({ morale: -8, customers: -3 }) }], "smarts"),
    opt("Stay independent", "You turned them down to keep building.", { smartsDelta: 1, bizEffect: bizEffect({ morale: 4, rep: 2 }) }),
  ], { requires: { custom: (p) => ownsKind(p, "startup") && biz(p).customers >= 25 && biz(p).revenue >= 1_000_000 }, cooldown: 4, weight: 1.6 }),

  ev("biz_ipo_window", "money", 22, 65, "The IPO Window", "Markets are hot and bankers say {biz} could list on the stock exchange.", [
    opt("Go public", "The bell rang. You're a public-company founder.", { happinessDelta: 10, fameDelta: 10, bizEffect: (p, rng) => bizSellInPlace(p, rng, "ipo", 1.3) }),
    opt("Raise one more private round instead", "You sold a slice of the company to fund growth.", { bizEffect: (p) => bizSellStake(p, 0.15, 1.1) }),
    opt("Stay private", "You didn't want the quarterly pressure.", { bizEffect: bizEffect({ morale: 2 }) }),
  ], { requires: { custom: (p) => ownsKind(p, "startup") && biz(p).revenue >= 5_000_000 && biz(p).reputation >= 55 }, cooldown: 5, weight: 1.6 }),

  ev("biz_strike", "money", 20, 70, "Walkout", "Your staff are threatening to walk out over pay and conditions.", [
    opt("Meet their demands (about 4% of revenue)", "You gave them a fair raise and a better rota. Morale soared.", { bizEffect: bizEffect({ cashPctRevenue: -0.04, morale: 22 }) }),
    risk("Hold firm", 0.4, ["They backed down within days.", { bizEffect: bizEffect({ morale: -6 }) }], ["The strike shut the doors for weeks.", { happinessDelta: -4, bizEffect: bizEffect({ cashPctRevenue: -0.1, rep: -5, morale: -15, customers: -4 }) }]),
    opt("Bring in replacement workers", "You kept the doors open and made enemies.", { karmaDelta: -4, bizEffect: bizEffect({ cashPctRevenue: -0.02, rep: -4, morale: -12 }) }),
  ], { requires: { custom: (p) => !!p.business && biz(p).staff >= 3 && biz(p).morale < 50 }, cooldown: 6, weight: 2 }),

  ev("biz_recession_squeeze", "money", 20, 80, "Customers Tighten Their Belts", "The recession is biting. Fewer customers, shorter visits, slower payers.", [
    opt("Cut costs and lay people off", "You trimmed the team and the budget. Leaner, but fragile.", { karmaDelta: -2, bizEffect: bizEffect({ staff: -1, cashPctRevenue: 0.02, morale: -7, quality: -2 }) }),
    opt("Run discounts to keep customers coming", "Margins suffered but the doors stayed busy.", { bizEffect: bizEffect({ cashPctRevenue: -0.03, customers: 5 }) }),
    opt("Tough it out with your savings", "You absorbed the pain, bet on a recovery, and kept everyone employed.", { happinessDelta: -2, bizEffect: bizEffect({ cashPctRevenue: -0.04, morale: 4, rep: 1 }) }),
  ], { requires: { climate: ["recession"], custom: (p) => !!p.business && kindOf(biz(p)).cyclical >= 0.9 }, cooldown: 3, weight: 1.6 }),

  ev("biz_partner_dispute", "money", 22, 75, "Shareholder Dispute", "One of your minority investors is unhappy and wants a say in how {biz} is run.", [
    opt("Buy them out (about 15% of the company)", "You bought back their shares at a fair premium.", { bizEffect: (p) => bizBuyShares(p, 0.15) }),
    risk("Negotiate a compromise", 0.5, ["You reached a truce and they backed off.", { bizEffect: bizEffect({ morale: 2 }) }], ["Talks broke down and the dispute went public.", { happinessDelta: -4, bizEffect: bizEffect({ rep: -5, cashPctRevenue: -0.03 }) }], "smarts"),
    opt("Stonewall them", "You ignored the letters. Lawyers are now involved.", { happinessDelta: -3, bizEffect: bizEffect({ cashPctRevenue: -0.02, rep: -2 }) }),
  ], { requires: { custom: (p) => !!p.business && biz(p).ownerShare < 0.95 }, cooldown: 7 }),

  ev("biz_competitor_opens", "money", 20, 75, "New Kid on the Block", "A well-funded competitor just opened close to {biz} with flashy launch discounts.", [
    opt("Match their prices (about 3% of revenue)", "You matched the discounts and held your customers, at a cost.", { bizEffect: bizEffect({ cashPctRevenue: -0.03, competition: 12, customers: 1 }) }),
    opt("Double down on quality (about 2.5% of revenue)", "You invested in what makes you different.", { bizEffect: bizEffect({ cashPctRevenue: -0.025, quality: 5, rep: 2, competition: 15 }) }),
    opt("Ignore them", "You carried on and lost a few customers to the newcomer.", { bizEffect: bizEffect({ customers: -6, competition: 20 }) }),
  ], { requires: { custom: owns(...SHOPS, "gym", "farm") }, cooldown: 5 }),

  ev("biz_equipment_failure", "money", 18, 80, "Breakdown", "A critical piece of equipment at {biz} has just died in the middle of a busy period.", [
    opt("Repair it (about 4% of revenue)", "A patch job. It works, for now.", { bizEffect: bizEffect({ cashPctRevenue: -0.04 }) }),
    opt("Replace it with new kit (about 9% of revenue)", "A big outlay, but everything runs better.", { bizEffect: bizEffect({ cashPctRevenue: -0.09, quality: 5, facility: 20 }) }),
    risk("Limp along without it", 0.5, ["You improvised and got lucky.", {}], ["The disruption cost you customers and a lot of money.", { bizEffect: bizEffect({ cashPctRevenue: -0.12, rep: -5, customers: -4 }) }]),
  ], { requires: { custom: owns("foodtruck", "farm", "restaurant", "barcafe", "gym", "construction", "logistics", "nightclub") }, cooldown: 5 }),

  ev("biz_regulation", "money", 20, 80, "New Regulations", "The government has introduced sweeping new rules for your industry. Compliance won't be cheap.", [
    opt("Comply fully (about 2.5% of revenue)", "You updated everything. A cost of doing business.", { bizEffect: bizEffect({ cashPctRevenue: -0.025, compliance: 22 }) }),
    risk("Use your connections for an exemption", 0.35, ["A phone call and a favour got you a waiver.", { karmaDelta: -3 }], ["The waiver was refused and you were fined.", { karmaDelta: -3, bizEffect: bizEffect({ cashPctRevenue: -0.08, rep: -3 }) }]),
    risk("Ignore it and hope", 0.5, ["Nobody checked.", { karmaDelta: -1 }], ["An inspector did check. The penalty was severe.", { bizEffect: bizEffect({ cashPctRevenue: -0.1, rep: -4, compliance: -5 }) }]),
  ], { requires: { custom: owns(...FOOD, "gym", "construction", "logistics", "farm", "nightclub", "onlinestore") }, cooldown: 7 }),

  ev("biz_cheap_loan", "money", 22, 65, "Small Business Boost", "A government scheme offers subsidised loans to small businesses.", [
    opt("Apply for the subsidised loan", "You were approved at a low rate. It extends your runway, but it must be repaid.", { happinessDelta: 2, bizEffect: (p) => bizCheapLoan(p, 0.3, 0.035) }),
    opt("Skip the paperwork", "You decided against taking on more debt.", { smartsDelta: 1 }),
  ], { requires: { climate: ["recession", "normal"], custom: (p) => !!p.business && years(p) >= 1 && biz(p).debt < biz(p).revenue * 0.5 }, cooldown: 6 }),

  ev("biz_angel_pitch", "money", 22, 70, "Angel Investor", "An investor has taken a shine to {biz} and wants a piece of it.", [
    opt("Sell 25% of the company", "You sold a quarter of the company for fresh capital.", { happinessDelta: 4, bizEffect: (p) => bizSellStake(p, 0.25, 0.9) }),
    risk("Push for better terms (20% instead)", 0.4, ["They agreed to your terms.", { happinessDelta: 5, bizEffect: (p) => bizSellStake(p, 0.2, 1) }], ["They lost interest and walked.", { bizEffect: bizEffect({ morale: -1 }) }], "smarts"),
    opt("Bootstrap on your own", "You declined. It's your baby.", { smartsDelta: 1 }),
  ], { requires: { custom: (p) => !!p.business && years(p) >= 1 && biz(p).ownerShare > 0.6 && biz(p).customers > 20 }, cooldown: 7 }),

  ev("biz_burnout_warning", "health", 20, 70, "Running on Fumes", "You've been running {biz} flat out and your body is sending warnings.", [
    opt("Take a real break (about 3% of revenue)", "Two weeks off. The business survived without you, barely.", { healthDelta: 6, happinessDelta: 6, bizEffect: bizEffect({ cashPctRevenue: -0.03, morale: -2 }) }),
    opt("Push through it", "You powered on. Your doctor was not impressed.", { healthDelta: -7, happinessDelta: -5, bizEffect: bizEffect({ customers: 2, quality: 1 }) }),
    opt("Start looking for a manager", "You drew up a job description. Delegation is a skill too.", { smartsDelta: 1, happinessDelta: 2 }),
  ], { requires: { custom: (p) => !!p.business && !biz(p).manager && p.effort === "grind" }, cooldown: 4, weight: 1.6 }),

  ev("biz_family_pressure", "family", 22, 65, "Married to the Business", "{partner} says you're never home. {biz} has eaten every evening and weekend.", [
    opt("Take a proper family week off (about 2% of revenue)", "You switched your phone off and went away together.", { happinessDelta: 6, relationshipDelta: { target: "Partner", delta: 15 }, bizEffect: bizEffect({ cashPctRevenue: -0.02 }) }),
    opt("Promise to cut back", "You promised. They'll be watching.", { relationshipDelta: { target: "Partner", delta: 5 } }),
    opt("Wave it away", "The business needs you. They'll understand.", { happinessDelta: -3, relationshipDelta: { target: "Partner", delta: -14 } }),
  ], { requires: { hasPartner: true, custom: (p) => !!p.business && !biz(p).manager && p.effort !== "coast" }, cooldown: 5 }),

  ev("biz_data_breach", "money", 20, 70, "Data Breach", "Hackers have gotten into {biz}'s systems and customer data is exposed.", [
    opt("Disclose it and fix it properly (about 4% of revenue)", "You told customers immediately and hired specialists. It hurt, but they respected the honesty.", { karmaDelta: 3, bizEffect: bizEffect({ cashPctRevenue: -0.04, rep: -3, compliance: 20 }) }),
    risk("Cover it up", 0.4, ["Nobody found out. This time.", { karmaDelta: -8 }], ["It leaked. The scandal was far worse than the breach.", { karmaDelta: -8, bizEffect: bizEffect({ cashPctRevenue: -0.15, rep: -18, customers: -8 }) }]),
    opt("Pay the ransom (about 6% of revenue)", "The hackers deleted the data. Allegedly.", { karmaDelta: -3, bizEffect: bizEffect({ cashPctRevenue: -0.06, rep: -2 }) }),
  ], { requires: { custom: owns("onlinestore", "startup", "consultancy") }, cooldown: 7 }),

  ev("biz_festival_season", "money", 18, 75, "Festival in Town", "A big festival is coming to town and {biz} is perfectly placed to cash in.", [
    risk("Go all in with extra stock and temporary staff", 0.65, ["The crowds were enormous. A banner season.", { happinessDelta: 5, bizEffect: bizEffect({ cashPctRevenue: 0.1, customers: 5, rep: 2 }) }], ["The crowds were smaller than promised and you were left with surplus stock.", { happinessDelta: -3, bizEffect: bizEffect({ cashPctRevenue: -0.03 }) }]),
    opt("Run business as usual", "A little extra footfall and nothing more.", { bizEffect: bizEffect({ cashPctRevenue: 0.02 }) }),
  ], { requires: { custom: (p) => ownsKind(p, "foodtruck", "boutique", "restaurant", "barcafe", "nightclub") && capacityOf(p, biz(p)) >= 0.7 }, cooldown: 5 }),

  ev("biz_award", "money", 20, 80, "Best in Town", "{biz} has been nominated for a local business award.", [
    opt("Attend the ceremony", "You hosted a table, shook hands and won. It was great PR.", { happinessDelta: 6, fameDelta: 2, bizEffect: bizEffect({ rep: 8, customers: 4, morale: 6 }) }),
    opt("Send an employee instead", "Your team won and went wild.", { bizEffect: bizEffect({ rep: 5, morale: 10 }) }),
  ], { requires: { custom: (p) => !!p.business && biz(p).reputation >= 65 }, cooldown: 8, weight: 0.8 }),

  ev("biz_zoning_dispute", "money", 22, 75, "The Neighbours Complain", "Neighbours are lobbying the council to restrict {biz}'s hours.", [
    opt("Soundproof and make peace (about 3% of revenue)", "You built bridges and bought earplugs.", { bizEffect: bizEffect({ cashPctRevenue: -0.03, rep: 2, facility: 5 }) }),
    risk("Fight them at a council hearing", 0.45, ["The council sided with you.", { bizEffect: bizEffect({ rep: 1 }) }], ["The council cut your trading hours.", { happinessDelta: -3, bizEffect: bizEffect({ customers: -6, cashPctRevenue: -0.04 }) }], "smarts"),
  ], { requires: { custom: owns("nightclub", "barcafe", "restaurant", "gym", "construction") }, cooldown: 7 }),
];

export const BUSINESS_EVENTS: LifeEvent[] = RAW_EVENTS.map((e) => ({ ...e, weight: (e.weight ?? 1) * BOOST }));
