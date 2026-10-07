"use client";

import { useEffect } from "react";
import { BarChart3, Briefcase, Building2, Lock, Sparkles, Users } from "lucide-react";
import { GameStateProvider, useGame } from "@/context/GameStateContext";
import type { TabId } from "@/types/game.types";
import { money } from "@/lib/format";
import StartScreen from "./StartScreen";
import DashboardTab from "./DashboardTab";
import RelationshipsTab from "./RelationshipsTab";
import ActivitiesTab from "./ActivitiesTab";
import CareerTab from "./CareerTab";
import AssetsTab from "./AssetsTab";
import PrisonView from "./PrisonView";
import ModalManager from "./ModalManager";
import TrialView from "./TrialView";
import TombstoneOverlay from "./TombstoneOverlay";

const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "dashboard", label: "Life", icon: BarChart3 },
  { id: "relationships", label: "People", icon: Users },
  { id: "activities", label: "Activities", icon: Sparkles },
  { id: "career", label: "Career", icon: Briefcase },
  { id: "assets", label: "Assets", icon: Building2 },
  { id: "prison", label: "Prison", icon: Lock },
];

function Banner() {
  const { state, clearBanner } = useGame();
  useEffect(() => {
    if (!state.banner) return;
    const t = setTimeout(clearBanner, 9000);
    return () => clearTimeout(t);
  }, [state.banner, clearBanner]);
  if (!state.banner) return null;
  return (
    <button
      type="button"
      onClick={clearBanner}
      className="banner-flash fixed inset-x-0 top-0 z-[60] bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 px-4 py-4 text-center text-lg font-black text-slate-900 shadow-2xl"
    >
      {state.banner}
    </button>
  );
}

function Shell() {
  const { state, player: p, setTab, ageUp } = useGame();
  const trial = !!p.pendingTrial;
  const locked = trial || !p.alive;
  const noticesPending = state.notices.length > 0;
  const tab: TabId = p.isInPrison && !["prison", "dashboard", "relationships"].includes(state.tab) ? "prison" : state.tab;

  const disabled = (id: TabId) => {
    if (locked) return true;
    if (id === "prison") return !p.isInPrison;
    if (p.isInPrison) return !["prison", "dashboard", "relationships"].includes(id);
    return false;
  };

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col bg-slate-900 text-slate-100 shadow-2xl sm:border-x sm:border-slate-800">
      {/* Slim top bar */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{p.firstName} {p.lastName}</div>
          <div className="text-xs text-slate-400">Age {p.age} · {p.year}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Cash</div>
          <div className="text-sm font-bold tabular-nums text-emerald-300">{money(p.bankBalance)}</div>
        </div>
      </header>

      <main className="scroll-thin flex-1 overflow-y-auto px-3 pb-4 pt-3">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "relationships" && <RelationshipsTab />}
        {tab === "activities" && <ActivitiesTab />}
        {tab === "career" && <CareerTab />}
        {tab === "assets" && <AssetsTab />}
        {tab === "prison" && <PrisonView />}
      </main>

      {/* Dominant Age Up + navigation */}
      <footer className="border-t border-slate-800 bg-slate-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="px-3 pt-2.5">
          <button
            type="button"
            onClick={ageUp}
            disabled={locked || noticesPending}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-lg font-extrabold tracking-wide text-slate-950 shadow-lg shadow-emerald-900/40 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⏳ Age Up · {p.age} → {p.age + 1}
          </button>
        </div>
        <nav className="mt-1 grid grid-cols-6" aria-label="Main navigation">
          {TABS.map(({ id, label, icon: Icon }) => {
            const off = disabled(id);
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                disabled={off}
                onClick={() => setTab(id)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors disabled:opacity-25 ${
                  active ? "text-emerald-400" : "text-slate-400 hover:text-slate-200"
                } ${id === "prison" && p.isInPrison ? "text-rose-400" : ""}`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </nav>
      </footer>

      <ModalManager />
      {trial && !noticesPending && <TrialView />}
      {!p.alive && !noticesPending && <TombstoneOverlay />}
    </div>
  );
}

function Root() {
  const { state, ready } = useGame();
  if (!ready) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-500">Loading…</div>;
  }
  return (
    <>
      <Banner />
      {state.screen === "start" || !state.player ? <StartScreen /> : <Shell />}
    </>
  );
}

export default function GameApp() {
  return (
    <GameStateProvider>
      <Root />
    </GameStateProvider>
  );
}
