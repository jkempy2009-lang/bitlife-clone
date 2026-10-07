/**
 * Defaults and save migration for the justice / underworld / espionage / statecraft state.
 * Kept in one dependency-free module so state.ts and save.ts only need one-line hooks.
 */
import type { JusticeState, MobState, PlayerState, PrisonState, SpyState, StatecraftState } from "@/types/game.types";

export const ISSUE_IDS = ["economy", "health", "environment", "security", "liberty"] as const;

export const freshJustice = (): JusticeState => ({
  heat: 0,
  convictions: 0,
  felonies: 0,
  violentConvictions: 0,
  juvenileRecord: [],
  recordSealed: false,
  adultTried: false,
  expunged: false,
  lastConvictionYear: null,
  releasedYear: null,
  reentry: 0,
  accomplices: 0,
  proceeds: 0,
  programs: [],
  gangTies: null,
  exonerations: 0,
});

export const freshMob = (): MobState => ({
  loyalty: 50,
  respect: 0,
  territory: 0,
  rivalHeat: 10,
  crew: 0,
  jobsDone: 0,
  yearsIn: 0,
  informant: false,
  exposure: 0,
  witsec: false,
  marked: false,
});

export const freshSpy = (): SpyState => ({
  cover: 80,
  handlerTrust: 50,
  suspicion: 0,
  doubleAgent: false,
  foreignTrust: 0,
  burned: false,
  burnedYear: null,
  hunted: 0,
  missions: 0,
  secrets: 0,
  partnerKnows: false,
});

export const freshStatecraft = (): StatecraftState => ({
  machine: 20,
  funds: 0,
  donors: [],
  stances: Object.fromEntries(ISSUE_IDS.map((i) => [i, 0])),
  mood: Object.fromEntries(ISSUE_IDS.map((i) => [i, 0])),
  endorsed: false,
  scandal: null,
  investigation: null,
  termsInOffice: 0,
  highestTier: -1,
  policyWins: 0,
  coalition: 30,
  lowYears: 0,
  bribes: 0,
  retired: null,
  retiredYear: null,
  removed: 0,
  electionsWon: 0,
  electionsLost: 0,
});

/** Default any new prison fields on a sentence that was saved before they existed. */
export function hydratePrison(prison: PrisonState | null | undefined): PrisonState | null {
  if (!prison) return null;
  return {
    ...prison,
    conduct: prison.conduct ?? 70,
    standing: prison.standing ?? 20,
    gang: prison.gang ?? null,
    job: prison.job ?? null,
    programs: prison.programs ?? [],
    progress: prison.progress ?? {},
    solitary: prison.solitary ?? 0,
    appeals: prison.appeals ?? 0,
  };
}

/** Fields to spread over an older save so it loads with every new system initialised. */
export function hydrateCrimeLife(p: PlayerState): Pick<PlayerState, "justice" | "mob" | "spy" | "statecraft" | "prison"> {
  // Old saves: reconstruct a plausible record from what they did store.
  const legacyRecord = p.justice
    ? {}
    : { convictions: p.criminalRecord?.length ?? 0, felonies: p.flags?.includes("ex_con") ? Math.max(1, Math.round((p.criminalRecord?.length ?? 0) / 2)) : 0 };
  return {
    justice: { ...freshJustice(), ...legacyRecord, ...(p.justice ?? {}), juvenileRecord: p.justice?.juvenileRecord ?? [], programs: p.justice?.programs ?? [] },
    mob: { ...freshMob(), ...(p.mob ?? {}) },
    spy: { ...freshSpy(), ...(p.spy ?? {}) },
    statecraft: {
      ...freshStatecraft(),
      ...(p.statecraft ?? {}),
      donors: p.statecraft?.donors ?? [],
      stances: { ...freshStatecraft().stances, ...(p.statecraft?.stances ?? {}) },
      mood: { ...freshStatecraft().mood, ...(p.statecraft?.mood ?? {}) },
    },
    prison: hydratePrison(p.prison),
  };
}
