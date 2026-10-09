/**
 * Default shapes (and old-save upgrades) for the fame careers. No engine imports so that
 * state.ts, legacy.ts and save.ts can all depend on it without cycles.
 */
import type { ActingState, CelebState, InfluencerState, MusicState, PlayerState, RecordContract } from "@/types/game.types";

export const newInfluencer = (): InfluencerState => ({
  active: false,
  followers: 0,
  lastPostYear: 0,
  platform: "video",
  niche: "lifestyle",
  engagement: 50,
  authenticity: 60,
  craft: 0,
  cadence: 50,
  burnout: 0,
  yearsActive: 0,
  fullTime: false,
  onBreak: false,
  algorithm: "neutral",
  algoYears: 0,
  trend: "gaming",
  bannedYears: 0,
  deals: [],
  offers: [],
  merch: false,
  premium: false,
  subscribers: 0,
  boughtFollowers: false,
  income: { ads: 0, deals: 0, subs: 0, merch: 0, costs: 0 },
  lifetimeEarnings: 0,
  peakFollowers: 0,
  viralHits: 0,
  followerHistory: [],
  collabs: 0,
  feud: null,
  associate: null,
});

export const newMusic = (): MusicState => ({
  status: "none",
  signed: false,
  pendingAlbum: null,
  albums: [],
  bandName: "",
  members: [],
  genre: "Rock",
  songwriting: 0,
  demo: 0,
  localFame: 0,
  fans: 0,
  relevance: 50,
  contract: null,
  labelStanding: 50,
  manager: false,
  burnout: 0,
  blockYears: 0,
  onBreak: false,
  hits: 0,
  yearsSinceHit: 0,
  awards: [],
  gigs: 0,
  tours: 0,
  yearsActive: 0,
  earnings: 0,
  droppedCount: 0,
  lastIncome: { gigs: 0, royalties: 0, stipend: 0, costs: 0 },
  split: "equal",
  peakFans: 0,
  formerBand: null,
  dispute: null,
  catalogSold: 0,
  lastTour: null,
});

export const newActing = (): ActingState => ({
  agent: null,
  manager: null,
  reputation: 20,
  critics: 30,
  pull: 5,
  typecast: null,
  credits: [],
  offers: [],
  pendingFilm: null,
  studioDeal: null,
  series: null,
  franchise: null,
  franchiseOffer: null,
  awardsRun: null,
  callback: null,
  rejections: 0,
  residuals: [],
  prepBonus: 0,
  comebackYear: 0,
  sideGigs: 0,
  awards: [],
  nominations: 0,
  earnings: 0,
  yearsSinceWork: 0,
  modelBookings: 0,
  lastIncome: { fees: 0, bonuses: 0, agent: 0, series: 0, residuals: 0 },
});

export const newCeleb = (): CelebState => ({
  privacy: 70,
  stalker: 0,
  security: false,
  businessManager: false,
  scandal: null,
  scandals: 0,
  devotion: 20,
  familyShield: false,
  orders: 0,
  orderYears: 0,
});

/** The contract an old save's signed artist is assumed to be on. */
export const legacyContract = (): RecordContract => ({
  label: "Legacy Records",
  totalYears: 6,
  yearsLeft: 4,
  advance: 0,
  stipend: 25_000,
  royaltyRate: 0.14,
  albumsOwed: 3,
  albumsDelivered: 0,
  unrecouped: 0,
  creativeControl: 50,
  tourCut: 0.15,
  renegotiatedYear: 0,
});

/** Fill in fields added after a save was written. Old InfluencerState / MusicState shapes upgrade here. */
export function hydrateCreative(p: PlayerState): Pick<PlayerState, "influencer" | "music" | "acting" | "celeb"> {
  const oldInf = p.influencer as Partial<InfluencerState> | undefined;
  const influencer: InfluencerState = { ...newInfluencer(), ...oldInf };
  // An old channel gets a plausible audience profile so its owner isn't punished by the new model.
  if (oldInf?.active && oldInf.engagement === undefined) {
    influencer.engagement = 50;
    influencer.authenticity = 60;
    influencer.cadence = 55;
    influencer.craft = Math.min(40, Math.round(Math.log10(Math.max(10, oldInf.followers ?? 10)) * 8));
    influencer.peakFollowers = oldInf.followers ?? 0;
  }
  const oldMusic = p.music as Partial<MusicState> | undefined;
  const music: MusicState = { ...newMusic(), ...oldMusic };
  music.albums = (oldMusic?.albums ?? []).map((a) => ({ ...a }));
  music.members = (oldMusic?.members ?? []).map((m) => ({
    ...m,
    trait: m.trait ?? (m.partier ? "flake" : m.ego >= 65 ? "diva" : m.loyalty >= 70 ? "loyalist" : "peacemaker"),
    credit: m.credit ?? 0,
    years: m.years ?? 1,
    grievance: m.grievance ?? null,
    grievanceYears: m.grievanceYears ?? 0,
    talked: false,
  }));
  music.split = oldMusic?.split ?? "equal";
  music.peakFans = Math.max(oldMusic?.peakFans ?? 0, oldMusic?.fans ?? 0);
  music.formerBand = oldMusic?.formerBand ?? null;
  music.dispute = oldMusic?.dispute ?? null;
  music.catalogSold = oldMusic?.catalogSold ?? 0;
  music.lastTour = oldMusic?.lastTour ?? null;
  music.awards = oldMusic?.awards ?? [];
  music.lastIncome = { ...newMusic().lastIncome, ...oldMusic?.lastIncome };
  if (music.signed && !music.contract) music.contract = legacyContract();
  if (music.status !== "none" && oldMusic && oldMusic.localFame === undefined) {
    music.localFame = music.signed ? 40 : 15;
    music.fans = music.signed ? 5_000 : 300;
    music.songwriting = 10;
  }
  const acting: ActingState = { ...newActing(), ...(p.acting as Partial<ActingState> | undefined) };
  acting.lastIncome = { ...newActing().lastIncome, ...(p.acting as Partial<ActingState> | undefined)?.lastIncome };
  if (acting.agent) {
    acting.agent = { ...acting.agent, kind: acting.agent.kind ?? "mid", trust: acting.agent.trust ?? 55 };
  }
  acting.residuals = acting.residuals ?? [];
  // An existing actor's job tier is their résumé.
  if (!p.acting && p.currentJob?.lineId === "actor") {
    acting.reputation = 20 + p.currentJob.tier * 20;
    acting.pull = 5 + p.currentJob.tier * 20;
  }
  const celeb: CelebState = { ...newCeleb(), ...(p.celeb as Partial<CelebState> | undefined) };
  influencer.deals = (influencer.deals ?? []).map((d) => ({ ...d, morals: d.morals ?? !d.shady, strikes: d.strikes ?? 0 }));
  influencer.offers = (influencer.offers ?? []).map((d) => ({ ...d, morals: d.morals ?? !d.shady, strikes: d.strikes ?? 0 }));
  return { influencer, music, acting, celeb };
}
