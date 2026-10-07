"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  APPEAL_COUNSEL_COST,
  ESCAPE_PATHS,
  MAX_VISITS,
  PRISON_GANGS,
  PRISON_JOBS,
  PRISON_PROGRAMS,
  appealConviction,
  appealSentence,
  attemptEscape,
  contactInnocenceProject,
  enrollPrisonProgram,
  joinPrisonGang,
  leavePrisonGang,
  paroleEligibleAt,
  paroleOdds,
  prisonVisit,
  protectiveCustody,
  requestParole,
  sentenceLeft,
  startRiot,
  studyInPrison,
  takePrisonJob,
  workOutYard,
} from "@/engine/prison";
import { hydratePrison } from "@/engine/justiceState";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle, StatBar } from "./ui";

/** Penitentiary (or juvenile detention) dashboard. */
export default function PrisonView() {
  const { player: p, act } = useGame();
  const [escaping, setEscaping] = useState(false);
  const prison = hydratePrison(p.prison);
  if (!prison) return null;
  const juvenile = !!prison.juvenile;
  const remaining = sentenceLeft(prison);
  const pct = Math.min(100, (prison.yearsServed / Math.max(1, prison.sentenceYears)) * 100);
  const eligibleAt = paroleEligibleAt(prison);
  const canParole = !prison.deathRow && !juvenile && prison.yearsServed >= eligibleAt;
  const paroleReason = prison.deathRow ? "Not on death row." : juvenile ? "Juvenile detention has its own review. You'll be released by 18." : prison.yearsServed < eligibleAt ? `Eligible after ${eligibleAt} years (${eligibleAt - prison.yearsServed} to go).` : (p.annual.parole ?? 0) >= 1 ? "The board hears one case a year." : null;
  const visits = Object.keys(p.annual).filter((k) => k.startsWith("visit:")).length;
  const visitable = p.relatives.filter((r) => r.alive && r.relation !== "Pet" && r.partnerStatus !== "ex");
  const inProgress = Object.keys(prison.progress ?? {});
  const hasDegree = p.education.degrees.some((d) => d.startsWith("bachelor"));
  const hasDiploma = p.education.degrees.includes("highschool");
  const gang = PRISON_GANGS.find((g) => g.id === prison.gang);
  const job = PRISON_JOBS.find((j) => j.id === prison.job);

  return (
    <div className="flex flex-col gap-3">
      <Card className="border-rose-900/60 bg-gradient-to-br from-zinc-900 to-slate-800">
        <div className="mb-1 text-xs uppercase tracking-widest text-rose-300">{juvenile ? "Juvenile Detention Centre" : "State Penitentiary"}</div>
        <div className="text-2xl font-bold">{juvenile ? "Resident" : "Inmate"} #{p.id.slice(0, 5).toUpperCase()}</div>
        <div className="text-sm text-slate-400">{p.firstName} {p.lastName} · {prison.wrongful ? "Convicted (you say wrongly) of" : "Convicted of"} {prison.charge}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gang && <Pill tone="red">🕶️ {gang.name}</Pill>}
          {job && <Pill tone="blue">🔧 {job.name}</Pill>}
          {(prison.solitary ?? 0) > 0 && <Pill tone="amber">🚪 Solitary ({prison.solitary}y)</Pill>}
          {prison.wrongful && <Pill tone="green">⚖️ Innocent</Pill>}
          {(prison.programs ?? []).map((g) => <Pill key={g} tone="green">✓ {PRISON_PROGRAMS.find((x) => x.id === g)?.name ?? g}</Pill>)}
        </div>
        {prison.deathRow && (
          <div className="mt-3 rounded-xl border border-rose-500/60 bg-rose-950/40 p-3 text-sm text-rose-200">
            ☠️ <strong>Death row.</strong> Execution in about {remaining} year{remaining === 1 ? "" : "s"} unless an appeal succeeds.
            <Button variant="danger" className="mt-2 w-full" disabled={(p.annual.appeal ?? 0) >= 1} onClick={() => act((pl, rng) => appealSentence(pl, rng))}>⚖️ File an Appeal</Button>
          </div>
        )}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-slate-200">Sentence</span>
            <span className="tabular-nums text-slate-300">{remaining} year{remaining === 1 ? "" : "s"} remaining</span>
          </div>
          <div className="relative h-4 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Sentence served">
            <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {prison.yearsServed} of {prison.sentenceYears} years served
            {prison.creditYears ? ` (including ${prison.creditYears} year of pre-trial detention)` : ""}
            {!prison.deathRow && !juvenile ? ` · parole hearing after ${eligibleAt}` : ""}
            {juvenile ? " · released by age 18" : ""}
          </div>
        </div>
      </Card>

      <Card>
        <StatBar label="❤️ Health" value={p.health} color="teal" />
        <StatBar label="😊 Happiness" value={p.happiness} color="green" />
        <StatBar label="📋 Conduct record" value={prison.conduct ?? 70} color="blue" />
        <StatBar label="💪 Standing among inmates" value={prison.standing ?? 20} color="red" compact />
        <p className="mt-2 text-xs text-slate-500">Conduct feeds parole and early release (85% served with 65+ conduct and no gang). Standing keeps you safe, and costs you if you earn it with gangs and trouble.</p>
      </Card>

      {!prison.deathRow && !juvenile && (
        <Card>
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">⚖️ Parole board</span>
            <span className="text-sm text-slate-400">{canParole ? `Estimated odds ${Math.round(paroleOdds(p) * 100)}%` : `Hearing after ${eligibleAt} years`}</span>
          </div>
          <Button variant="gold" className="mt-2 w-full" disabled={!!paroleReason} onClick={() => act((pl, rng) => requestParole(pl, rng))}>Request a Parole Hearing</Button>
          {paroleReason && <div className="mt-1 text-xs text-rose-300">🔒 {paroleReason}</div>}
          <p className="mt-2 text-xs text-slate-500">The board looks at your conduct, work, programmes, gang ties and solitary time, and how you answer for what you did.</p>
        </Card>
      )}

      {!prison.deathRow && (
        <>
          <SectionTitle hint="steady work counts for you">Work Detail</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {PRISON_JOBS.map((j) => {
              const blocked = prison.job === j.id ? "Your current job" : "minSmarts" in j && p.smarts < j.minSmarts ? `Needs ${j.minSmarts}+ Smarts` : (prison.solitary ?? 0) > 0 ? "Not from solitary" : null;
              return (
                <button key={j.id} type="button" disabled={!!blocked} onClick={() => act((pl) => takePrisonJob(pl, j.id))} className="rounded-xl border border-slate-700/60 bg-slate-800/70 p-2.5 text-left transition-colors hover:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-40">
                  <div className="text-sm font-semibold">{j.name}</div>
                  <div className="text-xs text-slate-400">{j.blurb}</div>
                  {blocked && <div className="mt-1 text-xs text-rose-300">{blocked}</div>}
                </button>
              );
            })}
          </div>

          <SectionTitle hint="max two at once">Programmes</SectionTitle>
          <div className="flex flex-col gap-2">
            {PRISON_PROGRAMS.map((g) => {
              const done = (prison.programs ?? []).includes(g.id);
              const progress = prison.progress?.[g.id];
              const blocked = done ? "Completed" : progress !== undefined ? `In progress (${progress}/${g.years} years)` : g.id === "ged" && hasDiploma ? "You already have a diploma" : g.id === "degree" && !hasDiploma ? "Needs a diploma first" : g.id === "degree" && hasDegree ? "You already have a degree" : g.id === "degree" && p.smarts < 45 ? "Needs 45+ Smarts" : g.years > remaining ? `Needs ${g.years} years; you have ${remaining}` : inProgress.length >= 2 ? "Timetable full" : null;
              return (
                <div key={g.id} className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-800/70 p-2.5">
                  <span className="text-2xl">{g.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{g.name} <span className="text-xs font-normal text-slate-500">· {g.years}y</span></div>
                    <div className="text-xs text-slate-400">{g.blurb}</div>
                    {blocked && <div className={`text-xs ${done || progress !== undefined ? "text-emerald-300" : "text-rose-300"}`}>{done || progress !== undefined ? "✓ " : "🔒 "}{blocked}</div>}
                  </div>
                  <Button variant="secondary" className="shrink-0 px-3 py-1.5" disabled={!!blocked} onClick={() => act((pl) => enrollPrisonProgram(pl, g.id))}>Enrol</Button>
                </div>
              );
            })}
          </div>

          {!juvenile && (
            <>
              <SectionTitle hint="protection has a price">The Yard</SectionTitle>
              {gang ? (
                <Card>
                  <div className="text-sm"><strong>{gang.name}</strong>: {gang.blurb}</div>
                  <Button variant="ghost" className="mt-2 w-full" onClick={() => act((pl, rng) => leavePrisonGang(pl, rng))}>Walk away (expect a beating)</Button>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {PRISON_GANGS.map((g) => (
                    <button key={g.id} type="button" onClick={() => act((pl) => joinPrisonGang(pl, g.id))} className="rounded-xl border border-slate-700/60 bg-slate-800/70 p-2.5 text-left transition-colors hover:border-rose-500/60">
                      <div className="text-sm font-semibold">🕶️ Join {g.name}</div>
                      <div className="text-xs text-slate-400">{g.blurb} Safer now; worse parole odds, and ties that follow you out.</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <SectionTitle hint={`${visits}/${MAX_VISITS} visits this year`}>Visiting Day</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {visitable.length === 0 && <p className="text-xs text-slate-500">Nobody left to visit you.</p>}
        {visitable.slice(0, 8).map((r) => {
          const blocked = (p.annual[`visit:${r.id}`] ?? 0) >= 1 ? "Visited this year" : visits >= MAX_VISITS ? "Visit limit reached" : r.relationshipBar < 12 ? "Stopped writing" : null;
          return (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/70 p-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.name} <span className="text-xs text-slate-500">({r.relation.toLowerCase()})</span></div>
                <div className="text-xs text-slate-400">Closeness {Math.round(r.relationshipBar)}{blocked ? ` · ${blocked}` : ""}</div>
              </div>
              <Button variant="secondary" className="shrink-0 px-3 py-1.5" disabled={!!blocked} onClick={() => act((pl) => prisonVisit(pl, r.id))}>Visit</Button>
            </div>
          );
        })}
      </div>

      {!prison.deathRow && (
        <>
          <SectionTitle>Legal</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={(p.annual.appeal ?? 0) >= 1} onClick={() => act((pl, rng) => appealConviction(pl, rng, false))}>⚖️ Appeal (legal aid)</Button>
            <Button variant="secondary" disabled={(p.annual.appeal ?? 0) >= 1 || p.bankBalance < APPEAL_COUNSEL_COST} onClick={() => act((pl, rng) => appealConviction(pl, rng, true))}>⚖️ Appeal ({money(APPEAL_COUNSEL_COST)})</Button>
            {prison.wrongful && <Button variant="primary" className="col-span-2" disabled={(p.annual.innocence ?? 0) >= 1} onClick={() => act((pl, rng) => contactInnocenceProject(pl, rng))}>📨 Write to the Innocence Clinic</Button>}
          </div>
        </>
      )}

      <SectionTitle>Prison Activities</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => act((pl) => workOutYard(pl))} disabled={(p.annual.yard ?? 0) >= 1}>🏋️ Work Out in the Yard</Button>
        <Button variant="secondary" onClick={() => act((pl) => studyInPrison(pl))} disabled={(p.annual.prisonstudy ?? 0) >= 1}>📚 Library</Button>
        {!prison.deathRow && <Button variant="ghost" className="col-span-2" onClick={() => act((pl) => protectiveCustody(pl))} disabled={(p.annual.pc ?? 0) >= 1}>🛡️ Request Protective Custody</Button>}
        {!juvenile && (
          <>
            <Button variant="danger" onClick={() => act((pl, rng) => startRiot(pl, rng))} disabled={(p.annual.riot ?? 0) >= 1}>🔥 Start a Riot</Button>
            <Button variant="gold" onClick={() => setEscaping(true)} disabled={(p.annual.escape ?? 0) >= 1}>🏃 Escape Attempt</Button>
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">Relationships, tabs and your job are on hold while you're inside. Age up to serve a year.</p>

      {escaping && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/85 p-3 sm:items-center">
          <div className="pop-in w-full max-w-md rounded-3xl border border-amber-500/50 bg-slate-800 p-5">
            <h2 className="text-xl font-bold text-amber-300">Plan Your Escape</h2>
            <p className="mb-3 mt-1 text-sm text-slate-400">Failure means 3 more years, a year in solitary and a ruined conduct record. Success makes you a fugitive.</p>
            <div className="flex flex-col gap-2">
              {ESCAPE_PATHS.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => {
                    setEscaping(false);
                    act((pl, rng) => attemptEscape(pl, path.id, rng));
                  }}
                  className="rounded-xl border border-slate-600 bg-slate-700/60 p-3 text-left hover:border-amber-400"
                >
                  <div className="font-semibold">{path.name}</div>
                  <div className="text-xs text-slate-400">{path.blurb}</div>
                </button>
              ))}
            </div>
            <Button variant="ghost" className="mt-3 w-full" onClick={() => setEscaping(false)}>Never mind</Button>
          </div>
        </div>
      )}
    </div>
  );
}
