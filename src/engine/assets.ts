import type { ActionResult, PlayerState, Property, Vehicle } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { hashString, makeRng } from "@/lib/rng";
import { clamp, money } from "@/lib/format";
import {
  CAR_LOAN_RATE,
  CAR_LOAN_YEARS,
  MORTGAGE_RATE,
  MORTGAGE_YEARS,
  PROPERTY_ARCHETYPES,
  VEHICLE_ARCHETYPES,
  annualPayment,
  type PropertyArchetype,
  type VehicleArchetype,
} from "@/data/assetsCatalog";
import { qualifyingIncome } from "./household";
import { addLog, changeStat, clone } from "./state";

// ---------------------------------------------------------------------------
// Inventory (deterministic per year so refreshing can't reroll the lot)
// ---------------------------------------------------------------------------

export interface CarListing {
  listingId: string;
  arch: VehicleArchetype;
  price: number;
  condition: number;
  year: number;
}

export function carInventory(playerYear: number, seedKey: string): CarListing[] {
  return VEHICLE_ARCHETYPES.map((arch) => {
    const rng = makeRng(hashString(`${seedKey}:car:${arch.id}:${playerYear}`));
    const used = !!arch.usedCondition;
    const condition = used ? rng.int(arch.usedCondition![0], arch.usedCondition![1]) : 100;
    const age = used ? rng.int(4, 18) : 0;
    const price = Math.round(arch.basePrice * (used ? Math.max(0.3, 1 - age * 0.04 * (arch.id === "classic" ? -0.5 : 1)) : rng.float(0.97, 1.05)) / 100) * 100;
    return { listingId: `${arch.id}-${playerYear}`, arch, price, condition, year: playerYear - age };
  });
}

export interface HouseListing {
  listingId: string;
  arch: PropertyArchetype;
  price: number;
  condition: number;
}

export function houseInventory(playerYear: number, seedKey: string): HouseListing[] {
  return PROPERTY_ARCHETYPES.map((arch) => {
    const rng = makeRng(hashString(`${seedKey}:house:${arch.id}:${playerYear}`));
    return {
      listingId: `${arch.id}-${playerYear}`,
      arch,
      price: Math.round((arch.basePrice * rng.float(0.92, 1.12)) / 1000) * 1000,
      condition: rng.int(arch.condition[0], arch.condition[1]),
    };
  });
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

const info = (title: string, body: string, tone: "good" | "bad" | "neutral" = "neutral") =>
  ({ kind: "info" as const, title, body, tone });

export function buyCar(p0: PlayerState, listing: CarListing, financed: boolean, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < listing.arch.minAge) {
    return { player: p0, notices: [info("Too Young", `You must be ${listing.arch.minAge}+ to buy this car.`, "bad")] };
  }
  const price = listing.price;
  let down = price;
  let loan = 0;
  if (financed) {
    if (p.creditScore < 550) {
      return { player: p0, notices: [info("Loan Denied", "Your credit score is too low for a car loan.", "bad")] };
    }
    down = Math.round(price * 0.1);
    loan = price - down;
  }
  if (p.bankBalance < down) {
    return { player: p0, notices: [info("Insufficient Funds", `You need ${money(down)} ${financed ? "as a down payment" : "in cash"}.`, "bad")] };
  }
  p.bankBalance -= down;
  const car: Vehicle = {
    id: rng.id(),
    name: listing.arch.name,
    purchasePrice: price,
    currentValue: price,
    condition: listing.condition,
    yearManufactured: listing.year,
    loanBalance: loan,
    loanPaymentAnnual: loan ? annualPayment(loan, CAR_LOAN_RATE, CAR_LOAN_YEARS) : 0,
    loanYearsLeft: loan ? CAR_LOAN_YEARS : 0,
    maintenanceWeight: listing.arch.maintenanceWeight,
    archetypeId: listing.arch.id,
  };
  p.vehicles.push(car);
  changeStat(p, "happiness", 6);
  const body = `You bought a ${listing.year} ${car.name} for ${money(price)}${financed ? ` (${money(down)} down, financed over ${CAR_LOAN_YEARS} years)` : ""}.`;
  addLog(p, body);
  return { player: p, notices: [info("New Wheels!", body, "good")] };
}

export function sellCar(p0: PlayerState, carId: string): ActionResult {
  const p = clone(p0);
  const car = p.vehicles.find((c) => c.id === carId);
  if (!car) return { player: p0 };
  const proceeds = Math.round(car.currentValue * 0.9) - car.loanBalance;
  p.bankBalance += proceeds;
  p.vehicles = p.vehicles.filter((c) => c.id !== carId);
  const body = `You sold your ${car.name} and ${proceeds >= 0 ? "pocketed" : "still owed"} ${money(Math.abs(proceeds))} after settling the loan.`;
  addLog(p, body);
  return { player: p, notices: [info("Car Sold", body)] };
}

export function buyHouse(p0: PlayerState, listing: HouseListing, financed: boolean, rng: Rng): ActionResult {
  const p = clone(p0);
  if (p.age < 18) return { player: p0, notices: [info("Too Young", "You must be 18 to buy property.", "bad")] };
  const price = listing.price;
  let down = price;
  let loan = 0;
  if (financed) {
    if (p.creditScore < 600) {
      return { player: p0, notices: [info("Mortgage Denied", "Your credit score is too low for a mortgage (600 needed).", "bad")] };
    }
    down = Math.round(price * 0.2);
    loan = price - down;
    const payment = annualPayment(loan, MORTGAGE_RATE, MORTGAGE_YEARS);
    const income = qualifyingIncome(p);
    if (income > 0 ? payment > income * 0.6 : p.bankBalance < price * 0.5) {
      return { player: p0, notices: [info("Mortgage Denied", "The bank doesn't believe you can afford the payments.", "bad")] };
    }
  }
  const closing = Math.round(price * 0.025);
  if (p.bankBalance < down + closing) {
    return { player: p0, notices: [info("Insufficient Funds", `You need ${money(down)} ${financed ? "for the 20% down payment" : "in cash"} plus ${money(closing)} in legal and closing costs.`, "bad")] };
  }
  p.bankBalance -= down + closing;
  const prop: Property = {
    id: rng.id(),
    name: listing.arch.name,
    originalValue: price,
    currentValue: price,
    condition: listing.condition,
    monthlyMortgage: loan ? Math.round(annualPayment(loan, MORTGAGE_RATE, MORTGAGE_YEARS) / 12) : 0,
    remainingTerm: loan ? MORTGAGE_YEARS : 0,
    mortgageBalance: loan,
    archetypeId: listing.arch.id,
  };
  p.properties.push(prop);
  changeStat(p, "happiness", 8);
  const body = `You bought a ${prop.name} for ${money(price)}${financed ? ` with a ${MORTGAGE_YEARS}-year mortgage (${money(down)} down)` : " in cash"}, plus ${money(closing)} in closing costs.`;
  addLog(p, body);
  return { player: p, notices: [info("Home Sweet Home", body, "good")] };
}

export function sellHouse(p0: PlayerState, propId: string): ActionResult {
  const p = clone(p0);
  const prop = p.properties.find((x) => x.id === propId);
  if (!prop) return { player: p0 };
  const proceeds = Math.round(prop.currentValue * 0.95) - prop.mortgageBalance;
  p.bankBalance += proceeds;
  p.properties = p.properties.filter((x) => x.id !== propId);
  const body = `You sold your ${prop.name} for a net ${money(proceeds)} after paying off the mortgage.`;
  addLog(p, body);
  return { player: p, notices: [info("Property Sold", body)] };
}

/** Renovate costs 10% of value, restores condition to 100. */
export function renovate(p0: PlayerState, propId: string): ActionResult {
  const p = clone(p0);
  const prop = p.properties.find((x) => x.id === propId);
  if (!prop) return { player: p0 };
  const cost = Math.round(prop.currentValue * 0.1);
  if (p.bankBalance < cost) {
    return { player: p0, notices: [info("Insufficient Funds", `Renovating costs ${money(cost)}.`, "bad")] };
  }
  if (prop.condition >= 100) {
    return { player: p0, notices: [info("Already Perfect", "This property is already in mint condition.")] };
  }
  p.bankBalance -= cost;
  prop.condition = 100;
  changeStat(p, "happiness", 3);
  const body = `You renovated your ${prop.name} for ${money(cost)}. It's in perfect condition.`;
  addLog(p, body);
  return { player: p, notices: [info("Renovation Complete", body, "good")] };
}

// ---------------------------------------------------------------------------
// Bank loans
// ---------------------------------------------------------------------------

export function maxLoan(p: PlayerState): number {
  if (p.age < 18 || p.creditScore < 500) return 0;
  const income = qualifyingIncome(p) + (p.royalRank !== "none" ? 400_000 : 0);
  const capacity = Math.max(2_000, income * 1.5 + p.bankBalance * 0.2) * ((p.creditScore - 400) / 450);
  return Math.max(0, Math.round((capacity - p.outstandingLoans) / 500) * 500);
}

export function takeLoan(p0: PlayerState, amount: number): ActionResult {
  const p = clone(p0);
  if (amount > maxLoan(p) || amount <= 0) {
    return { player: p0, notices: [info("Loan Denied", "The bank won't lend you that much.", "bad")] };
  }
  p.bankBalance += amount;
  p.outstandingLoans += amount;
  const body = `You took out a ${money(amount)} loan at 7% interest.`;
  addLog(p, body);
  return { player: p, notices: [info("Loan Approved", body, "good")] };
}

export function repayLoan(p0: PlayerState, amount: number): ActionResult {
  const p = clone(p0);
  const pay = Math.min(amount, p.outstandingLoans, p.bankBalance);
  if (pay <= 0) return { player: p0, notices: [info("Nothing to repay", "You have no funds or no debt.")] };
  p.bankBalance -= pay;
  p.outstandingLoans -= pay;
  p.creditScore = clamp(p.creditScore + 4, 300, 850);
  const body = `You repaid ${money(pay)} of your debt.`;
  addLog(p, body);
  return { player: p, notices: [info("Loan Payment", body, "good")] };
}
