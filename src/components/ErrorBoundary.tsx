"use client";

import { Component, type ReactNode } from "react";
import { loadGame, loadPreviousGame, restorePrevious } from "@/engine/save";

interface State {
  error: Error | null;
}

/** Catches render crashes so a bug never costs the player their life: offers a reload, last-year restore or a save download. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private download = () => {
    const data = loadGame();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lifeline-${data.player.firstName}-age${data.player.age}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  render() {
    if (!this.state.error) return this.props.children;
    const hasPrev = typeof window !== "undefined" && loadPreviousGame() !== null;
    const hasSave = typeof window !== "undefined" && loadGame() !== null;
    const btn = "w-full rounded-xl px-4 py-3 text-sm font-bold";
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🛠️</div>
        <h1 className="text-xl font-extrabold">Something went wrong</h1>
        <p className="text-sm text-slate-400">
          Your life is saved automatically. Reload to carry on; if the problem keeps happening, restore last year&apos;s save or download your save so it can be fixed.
        </p>
        <pre className="max-h-24 overflow-auto rounded-lg bg-slate-800 p-2 text-left text-[11px] text-rose-300">{this.state.error.message}</pre>
        <button className={`${btn} bg-emerald-500 text-slate-950`} onClick={() => window.location.reload()}>
          Reload game
        </button>
        {hasPrev && (
          <button
            className={`${btn} bg-slate-700 text-slate-100`}
            onClick={() => {
              if (restorePrevious()) window.location.reload();
            }}
          >
            ⏪ Restore last year&apos;s save
          </button>
        )}
        {hasSave && (
          <button className={`${btn} bg-slate-800 text-slate-300`} onClick={this.download}>
            💾 Download my save
          </button>
        )}
      </div>
    );
  }
}
