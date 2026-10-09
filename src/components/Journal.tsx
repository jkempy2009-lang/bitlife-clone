"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { countEntries, filterJournal, groupJournal, type JournalFilter, type JournalYear } from "@/lib/journal";
import { Button, Modal, Segmented } from "./ui";

export function YearBlock({ year, current, highlight }: { year: JournalYear; current?: boolean; highlight?: string }) {
  const mark = (text: string) => {
    const q = highlight?.trim();
    if (!q) return text;
    const at = text.toLowerCase().indexOf(q.toLowerCase());
    if (at < 0) return text;
    return (
      <>
        {text.slice(0, at)}
        <mark className="rounded bg-amber-400/30 px-0.5 text-amber-100">{text.slice(at, at + q.length)}</mark>
        {text.slice(at + q.length)}
      </>
    );
  };
  return (
    <div className={current === false ? "opacity-90" : ""}>
      <h4 className={`sticky top-0 z-10 -mx-3 mb-1.5 mt-3 bg-slate-800/95 px-3 py-1 text-xs font-bold uppercase tracking-wider first:mt-0 ${current ? "text-emerald-300" : "text-slate-300"}`}>{year.header}</h4>
      <ul className="space-y-1.5">
        {year.entries.map((e, j) => (
          <li key={j} className={`text-[14px] leading-snug ${e.milestone ? "font-medium text-slate-50" : "text-slate-200"}`}>
            {e.milestone && <span aria-label="Milestone" className="mr-1 text-amber-300">★</span>}
            {mark(e.text)}
          </li>
        ))}
        {year.entries.length === 0 && <li className="text-sm italic text-slate-400">Nothing notable happened.</li>}
      </ul>
    </div>
  );
}

const PAGE = 12;

/** Full, searchable life journal. */
export function JournalSheet({ log, onClose }: { log: string[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<JournalFilter>("all");
  const [pages, setPages] = useState(1);
  const deferred = useDeferredValue(query);
  const years = useMemo(() => groupJournal(log), [log]);
  const hits = useMemo(() => filterJournal(years, deferred, filter), [years, deferred, filter]);
  const shown = hits.slice(0, pages * PAGE);
  const total = countEntries(hits);
  return (
    <Modal label="Life journal" onClose={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/90 p-0 sm:items-center sm:p-4">
      <div className="pop-in flex h-[94dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-slate-600 bg-slate-800 sm:h-[88dvh] sm:rounded-3xl">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <h2 className="text-lg font-bold">Life journal</h2>
          <Button variant="ghost" className="px-3 py-1.5" onClick={onClose} data-autofocus>Close</Button>
        </div>
        <div className="px-4 pt-2">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPages(1);
            }}
            placeholder="Search your life: a name, a year, a word…"
            aria-label="Search your life journal"
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
          />
          <div className="mt-2">
            <Segmented<JournalFilter>
              onPanel
              label="Journal filter"
              value={filter}
              onChange={(f) => {
                setFilter(f);
                setPages(1);
              }}
              options={[
                { id: "all", label: "Everything" },
                { id: "milestones", label: "★ Milestones" },
                { id: "people", label: "💞 People" },
                { id: "money", label: "💰 Money" },
                { id: "health", label: "🩺 Health" },
              ]}
            />
          </div>
          <div className="mb-1 text-xs text-slate-400" aria-live="polite">{total} {total === 1 ? "entry" : "entries"}{deferred.trim() ? ` matching “${deferred.trim()}”` : ""}</div>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {shown.map((y, i) => (
            <YearBlock key={`${y.header}-${i}`} year={y} current={i === 0 && !deferred && filter === "all"} highlight={deferred} />
          ))}
          {hits.length > shown.length && (
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setPages((n) => n + 1)}>
              Show older years ({hits.length - shown.length} more)
            </Button>
          )}
          {hits.length === 0 && <p className="mt-6 text-center text-sm text-slate-400">Nothing in your story matches that yet.</p>}
        </div>
      </div>
    </Modal>
  );
}
