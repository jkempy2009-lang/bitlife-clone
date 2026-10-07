import type { ActionResult, GameState, Notice, PlayerState, TabId } from "@/types/game.types";
import { makeRng, type Rng } from "@/lib/rng";
import { ageUp, finalize } from "./ageUp";
import { skipYears } from "./skip";
import { addLog, createNewPlayer, type NewLifeOptions } from "./state";
import { resolveEvent } from "./events";
import { continueAsChild } from "./legacy";
import type { LifeEvent } from "@/data/lifeEventsEngine";
import { CHALLENGE_BY_ID } from "@/data/challenges";

export type Action =
  | { type: "NEW_GAME"; opts: NewLifeOptions; seed: number; intro?: boolean }
  | { type: "LOAD"; player: PlayerState; rngState: number }
  | { type: "AGE_UP" }
  | { type: "FAST_FORWARD"; years?: number }
  | { type: "RUN"; run: (p: PlayerState, rng: Rng) => ActionResult }
  | { type: "RESOLVE_EVENT"; noticeId: string; optionIndex: number }
  | { type: "DISMISS_NOTICE"; id: string }
  | { type: "SET_TAB"; tab: TabId }
  | { type: "CLEAR_BANNER" }
  | { type: "CONTINUE_AS_CHILD"; childId: string }
  | { type: "QUIT_TO_MENU" };

export const initialState: GameState = {
  screen: "start",
  player: null,
  tab: "dashboard",
  notices: [],
  banner: null,
  rngState: 1,
};

function withIds(rng: Rng, notices: ActionResult["notices"]): Notice[] {
  return (notices ?? []).map((n) => ({ ...n, id: "id" in n && n.id ? n.id : rng.id() }) as Notice);
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "NEW_GAME": {
      const rng = makeRng(action.seed);
      const player = createNewPlayer(action.opts, rng);
      const notices: Notice[] = action.intro
        ? [
            {
              id: "intro",
              kind: "info",
              title: "Welcome to Lifeline",
              body: "Tap Age Up to live the next year. Events will ask you to decide. Use the tabs to meet people, work, study, buy things and get into trouble. Skip fast-forwards through quiet years. Everything is saved automatically.",
              tone: "neutral",
            },
          ]
        : [];
      const ch = action.opts.challenge ? CHALLENGE_BY_ID[action.opts.challenge] : undefined;
      if (ch) {
        addLog(player, `🎯 Challenge: ${ch.name}. ${ch.goal}`);
        notices.push({ id: "challenge", kind: "info", title: `${ch.emoji} ${ch.name}`, body: `${ch.blurb} Your goal: ${ch.goal}`, tone: "neutral" });
      }
      return { ...initialState, screen: "game", player, rngState: rng.state(), notices };
    }
    case "LOAD":
      return { ...initialState, screen: "game", player: action.player, rngState: action.rngState, tab: action.player.isInPrison ? "prison" : "dashboard" };
    case "QUIT_TO_MENU":
      return { ...initialState };
    case "SET_TAB":
      return { ...state, tab: action.tab };
    case "CLEAR_BANNER":
      return { ...state, banner: null };
    case "DISMISS_NOTICE":
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
    case "AGE_UP": {
      if (!state.player || state.notices.length > 0) return state;
      const rng = makeRng(state.rngState);
      const result = ageUp(state.player, rng);
      return { ...state, player: result.player, notices: withIds(rng, result.notices), rngState: rng.state(), tab: result.player.isInPrison ? "prison" : state.tab === "prison" ? "dashboard" : state.tab };
    }
    case "FAST_FORWARD": {
      // Live several years in one go; autopilot handles the decisions (see skip.ts).
      if (!state.player || state.notices.length > 0) return state;
      const rng = makeRng(state.rngState);
      const result = skipYears(state.player, rng, action.years ?? 10);
      if (result.years === 0) return state;
      const player = result.player;
      return { ...state, player, notices: withIds(rng, result.notices), rngState: rng.state(), tab: player.isInPrison ? "prison" : state.tab === "prison" ? "dashboard" : state.tab };
    }
    case "RUN": {
      if (!state.player) return state;
      const rng = makeRng(state.rngState);
      const result = action.run(state.player, rng);
      if (result.player === state.player && !result.notices?.length) return state;
      const extra: NonNullable<ActionResult["notices"]> = [];
      const player = result.player;
      if (player !== state.player) finalize(player, extra);
      const incoming = withIds(rng, [...(result.notices ?? []), ...extra]);
      return {
        ...state,
        player,
        notices: [...state.notices, ...incoming],
        banner: result.banner ?? state.banner,
        rngState: rng.state(),
        tab: player.isInPrison && state.tab !== "prison" && state.tab !== "dashboard" && state.tab !== "relationships" ? "prison" : !player.isInPrison && state.tab === "prison" ? "dashboard" : state.tab,
      };
    }
    case "RESOLVE_EVENT": {
      if (!state.player) return state;
      const notice = state.notices.find((n) => n.id === action.noticeId);
      if (!notice || notice.kind !== "event") return state;
      const rng = makeRng(state.rngState);
      const event: LifeEvent = notice.event;
      const result = resolveEvent(state.player, event, action.optionIndex, rng);
      if (result.player === state.player) {
        // couldn't afford / invalid: keep the event open, surface a toast-like notice on top
        return { ...state, notices: [...withIds(rng, result.notices), ...state.notices], rngState: rng.state() };
      }
      const extra: NonNullable<ActionResult["notices"]> = [];
      finalize(result.player, extra);
      let remaining = state.notices.filter((n) => n.id !== action.noticeId);
      if (!result.player.alive) remaining = remaining.filter((n) => n.kind !== "event");
      return {
        ...state,
        player: result.player,
        notices: [...withIds(rng, result.notices), ...remaining, ...withIds(rng, extra)],
        rngState: rng.state(),
        tab: result.player.isInPrison ? "prison" : state.tab,
      };
    }
    case "CONTINUE_AS_CHILD": {
      if (!state.player) return state;
      const rng = makeRng(state.rngState);
      const next = continueAsChild(state.player, action.childId, rng);
      if (!next) return state;
      return { ...initialState, screen: "game", player: next, rngState: rng.state() };
    }
  }
}
