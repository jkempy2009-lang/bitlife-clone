"use client";

import { useEffect, useState } from "react";
import { BarChart3, Briefcase, Building2, Lock, Settings, Sparkles, Users } from "lucide-react";
import { GameStateProvider, useGame } from "@/context/GameStateContext";
import type { TabId } from "@/types/game.types";
import { avatarFor, money } from "@/lib/format";
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
import { Button, Segmented } from "./ui";
import { applyPrefs, setPrefs, usePrefs } from "@/lib/prefs";

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { exportCurrent, exportCode, importFromText, quitToMenu, player, act } = useGame();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const prefs = usePrefs();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/85 p-3 sm:items-center">
      <div className="pop-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-600 bg-slate-800 p-5">
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="mt-1 text-xs text-slate-400">Your game autosaves in this browser. Export a backup to move it between devices.</p>
        <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-600 bg-slate-900/60 p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-rose-500" checked={player.matureContent} onChange={() => act((p) => ({ player: { ...p, matureContent: !p.matureContent } }))} />
          <span>
            <span className="font-semibold">Mature content (18+)</span>
            <span className="block text-xs text-slate-400">Adult relationships, adult careers, and violent crimes. Always requires an adult character and consenting adults. Suggestive, never explicit.</span>
          </span>
        </label>
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-600 bg-slate-900/60 p-3 text-sm">
          <span className="font-semibold">Text size</span>
          <span className="[&>div]:mb-0 [&>div]:mx-0"><Segmented value={prefs.text} onChange={(v) => setPrefs({ text: v })} options={[{ id: "normal", label: "Normal" }, { id: "large", label: "Large" }, { id: "huge", label: "Huge" }]} /></span>
        </div>
        <label className="mt-2 flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 p-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={prefs.reduceMotion} onChange={() => setPrefs({ reduceMotion: !prefs.reduceMotion })} />
          <span className="font-semibold">Reduce motion</span>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(exportCurrent()); setMsg("Save copied to clipboard."); } catch { setText(exportCurrent()); setMsg("Clipboard unavailable. Copy the text below."); } }}>📋 Export save</Button>
          <Button variant="secondary" onClick={() => { if (importFromText(text)) onClose(); else setMsg("That doesn't look like a valid save."); }} disabled={!text.trim()}>📥 Import save</Button>
          <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(exportCode()); setMsg("Share code copied. Paste it on another device to continue."); } catch { setText(exportCode()); setMsg("Clipboard unavailable. Copy the code below."); } }}>🔗 Copy share code</Button>
          <Button variant="secondary" onClick={() => { const blob = new Blob([exportCurrent()], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "lifeline-save.json"; a.click(); URL.revokeObjectURL(url); }}>💾 Download file</Button>
          <label className="cursor-pointer rounded-xl bg-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-100 hover:bg-slate-600">
            📂 Load from file
            <input type="file" accept="application/json,.json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const t = await f.text(); if (importFromText(t)) onClose(); else setMsg("That file isn't a valid save."); }} />
          </label>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a save here to import it…" className="mt-2 h-24 w-full rounded-xl border border-slate-600 bg-slate-900 p-2 text-xs outline-none focus:border-emerald-500" aria-label="Save data" />
        {msg && <p className="mt-1 text-xs text-amber-300">{msg}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => { quitToMenu(); onClose(); }}>🏠 Main menu</Button>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

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
  const { state, player: p, setTab, ageUp, fastForward } = useGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-2xl leading-none" aria-hidden="true">{avatarFor(p)}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{p.firstName} {p.lastName}</div>
            <div className="text-xs text-slate-400">Age {p.age} · {p.year}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400">Cash</div>
            <div className="text-sm font-bold tabular-nums text-emerald-300">{money(p.bankBalance)}</div>
          </div>
          <button type="button" aria-label="Settings" onClick={() => setSettingsOpen(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <Settings size={18} />
          </button>
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
        <div className="flex gap-2 px-3 pt-2.5">
          <button
            type="button"
            onClick={ageUp}
            disabled={locked || noticesPending}
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-lg font-extrabold tracking-wide text-slate-950 shadow-lg shadow-emerald-900/40 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⏳ Age Up · {p.age} → {p.age + 1}
          </button>
          <button
            type="button"
            onClick={fastForward}
            disabled={locked || noticesPending}
            title="Skip ahead until something happens (up to 10 years)"
            aria-label="Skip ahead until something happens"
            className="w-16 rounded-2xl border border-emerald-500/40 bg-slate-800 text-xs font-bold leading-tight text-emerald-300 transition-all hover:bg-slate-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⏩<br />Skip
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
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {trial && !noticesPending && <TrialView />}
      {!p.alive && !noticesPending && <TombstoneOverlay />}
    </div>
  );
}

function Root() {
  const { state, ready } = useGame();
  const prefs = usePrefs();
  useEffect(() => {
    applyPrefs(prefs);
  }, [prefs]);
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
