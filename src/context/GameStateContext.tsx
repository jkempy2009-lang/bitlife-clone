"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ActionResult, GameState, PlayerState, TabId } from "@/types/game.types";
import type { Rng } from "@/lib/rng";
import { freshSeed } from "@/lib/rng";
import { initialState, reducer } from "@/engine/reducer";
import { recordAchievements, recordLife } from "@/engine/hall";
import { clearSave, exportSave, exportShareCode, hasSaveSnapshot, loadGame, parseSave, saveGame, subscribeSave } from "@/engine/save";
import type { NewLifeOptions } from "@/engine/state";
import { consumeIntro } from "@/lib/prefs";

interface GameContextValue {
  state: GameState;
  /** Non-null whenever screen === "game". */
  player: PlayerState;
  ready: boolean;
  hasSave: boolean;
  act: (run: (p: PlayerState, rng: Rng) => ActionResult) => void;
  ageUp: () => void;
  fastForward: () => void;
  setTab: (tab: TabId) => void;
  resolveEvent: (noticeId: string, optionIndex: number) => void;
  dismissNotice: (id: string) => void;
  clearBanner: () => void;
  newGame: (opts: Omit<NewLifeOptions, "startYear">) => void;
  continueSave: () => void;
  continueAsChild: (childId: string) => void;
  quitToMenu: () => void;
  deleteSave: () => void;
  exportCurrent: () => string;
  exportCode: () => string;
  importFromText: (text: string) => boolean;
}

const Ctx = createContext<GameContextValue | null>(null);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Server snapshot is false, client snapshot is true: avoids hydration mismatches without setState-in-effect.
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const hasSave = useSyncExternalStore(subscribeSave, hasSaveSnapshot, () => false);

  // Autosave on every committed state change.
  useEffect(() => {
    if (state.screen === "game" && state.player) saveGame(state.player, state.rngState);
  }, [state.player, state.rngState, state.screen]);

  // Immortalise finished lives and unlocked achievements in the Hall of Lives.
  useEffect(() => {
    const pl = state.player;
    if (!pl) return;
    recordAchievements(pl.achievements);
    if (!pl.alive) recordLife(pl);
  }, [state.player]);

  const act = useCallback((run: (p: PlayerState, rng: Rng) => ActionResult) => dispatch({ type: "RUN", run }), []);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      player: state.player as PlayerState,
      ready,
      hasSave,
      act,
      ageUp: () => dispatch({ type: "AGE_UP" }),
      fastForward: () => dispatch({ type: "FAST_FORWARD" }),
      setTab: (tab) => dispatch({ type: "SET_TAB", tab }),
      resolveEvent: (noticeId, optionIndex) => dispatch({ type: "RESOLVE_EVENT", noticeId, optionIndex }),
      dismissNotice: (id) => dispatch({ type: "DISMISS_NOTICE", id }),
      clearBanner: () => dispatch({ type: "CLEAR_BANNER" }),
      newGame: (opts) => {
        dispatch({ type: "NEW_GAME", opts: { ...opts, startYear: new Date().getFullYear() }, seed: freshSeed(), intro: consumeIntro() });
      },
      continueSave: () => {
        const data = loadGame();
        if (data) dispatch({ type: "LOAD", player: data.player, rngState: data.rngState });
      },
      continueAsChild: (childId) => {
        dispatch({ type: "CONTINUE_AS_CHILD", childId });
      },
      quitToMenu: () => {
        dispatch({ type: "QUIT_TO_MENU" });
      },
      deleteSave: () => {
        clearSave();
      },
      exportCurrent: () => exportSave(state.player as PlayerState, state.rngState),
      exportCode: () => exportShareCode(state.player as PlayerState, state.rngState),
      importFromText: (text) => {
        const data = parseSave(text);
        if (!data) return false;
        dispatch({ type: "LOAD", player: data.player, rngState: data.rngState });
        return true;
      },
    }),
    [state, ready, hasSave, act],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGame must be used inside GameStateProvider");
  return v;
}
