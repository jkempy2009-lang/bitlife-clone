"use client";

import { useState, type ReactNode } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  SPORTS, acceptOffer, advanceRequirements, agentBlocker, athleteView, attendShowcase, chooseTreatment, comeback, comebackBlocker, commitBlocker,
  declineOffer, exitPreview, fireAgent, hireAgent, negotiateOffer, offerBlocker, quitSport, retireFromSport, setEffort, signWithClub, stageLabel,
  stopDoping, trainAthletics, treatmentBlocker,
} from "@/engine/athlete";
import { INJURY_LOAD } from "@/engine/athleteModel";
import { EFFORT_INFO, hasCommitment } from "@/engine/occupation";
import { SPORT_INFO, LEAGUE_MIN, type Sport } from "@/data/sports";
import { money } from "@/lib/format";
import type { AthleteOffer, Effort, InjuryPlan, PlayerState } from "@/types/game.types";
import { Button, Card, Pill, SectionTitle, StatBar } from "../ui";

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "youth", label: "Youth", sub: "8-17" },
  { id: "college", label: "College / Academy", sub: "17-22" },
  { id: "semipro", label: "Semi-pro", sub: "lower leagues" },
  { id: "pro", label: "Pro", sub: "prime" },
  { id: "vet", label: "Veteran", sub: "decline" },
  { id: "retired", label: "Retired", sub: "the landing" },
  { id: "post", label: "Coach / Media", sub: "optional" },
] as const;

function Stepper({ active }: { active: number }) {
  return (
    <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {STEPS.map((s, i) => (
        <div
          key={s.id}
          className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-center ${i === active ? "border-emerald-500 bg-emerald-900/40" : i < active ? "border-slate-600 bg-slate-800/60" : "border-slate-700/60 bg-slate-900/40"}`}
        >
          <div className={`text-xs font-semibold ${i === active ? "text-emerald-200" : i < active ? "text-slate-300" : "text-slate-500"}`}>{i < active ? "✓ " : ""}{s.label}</div>
          <div className="text-[10px] text-slate-500">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function stepIndex(p: PlayerState): number {
  const a = p.athlete;
  const info = SPORT_INFO[(a.sport as Sport) ?? "Soccer"];
  if (a.stage === "youth") return 0;
  if (a.stage === "college") return 1;
  if (a.stage === "semipro") return 2;
  if (a.stage === "pro") return p.age > info.peak[1] + 2 ? 4 : 3;
  if (a.stage === "retired") return a.post !== "none" ? 6 : 5;
  return -1;
}

/** Age axis with the sport's prime highlighted and a marker for you. */
function PeakBar({ sport, age }: { sport: Sport; age: number }) {
  const info = SPORT_INFO[sport];
  const lo = 8;
  const hi = info.maxAge + 2;
  const pos = (a: number) => `${Math.max(0, Math.min(100, ((a - lo) / (hi - lo)) * 100))}%`;
  const phase = age < info.peak[0] ? "Rising" : age <= info.peak[1] ? "In your prime" : "Past your prime";
  const tone = age < info.peak[0] ? "text-sky-300" : age <= info.peak[1] ? "text-emerald-300" : "text-amber-300";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-slate-300">Age vs. {sport} prime ({info.peak[0]}-{info.peak[1]})</span>
        <span className={`font-semibold ${tone}`}>{phase}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-700" role="img" aria-label={`Age ${age}. Prime is ${info.peak[0]} to ${info.peak[1]}. ${phase}.`}>
        <div className="absolute inset-y-0 bg-sky-900/70" style={{ left: 0, width: pos(info.peak[0]) }} />
        <div className="absolute inset-y-0 bg-emerald-600/80" style={{ left: pos(info.peak[0]), width: `calc(${pos(info.peak[1])} - ${pos(info.peak[0])})` }} />
        <div className="absolute inset-y-0 bg-amber-800/70" style={{ left: pos(info.peak[1]), right: 0 }} />
        <div className="absolute inset-y-[-2px] w-1 rounded bg-white shadow" style={{ left: `calc(${pos(age)} - 2px)` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{lo}</span><span>retire ~{info.maxAge}</span></div>
    </div>
  );
}

function Block({ title, children, tone = "slate" }: { title: string; children: ReactNode; tone?: "slate" | "red" | "amber" }) {
  const border = tone === "red" ? "border-rose-700/60" : tone === "amber" ? "border-amber-700/60" : "border-slate-700/60";
  return (
    <div className={`rounded-2xl border ${border} bg-slate-800/70 p-4`}>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}

const ENROL_NOTE = "Enrols you at university on a full scholarship.";

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

function Onboarding() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const [sport, setSport] = useState<Sport>("Soccer");
  const [confirming, setConfirming] = useState(false);
  const blocker = commitBlocker(p, sport);
  const info = SPORT_INFO[sport];

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Sports Career</SectionTitle>
      <Card>
        <div className="text-lg font-bold">Choosing to be an athlete is a big deal</div>
        <p className="mt-1 text-sm text-slate-300">
          Nobody signs a pro contract by asking nicely. It takes a decade of training, selection at every stage, and a lot of luck. Most people who try never make it. The ones who do have short careers.
        </p>
        <div className="mt-3"><Stepper active={-1} /></div>
        <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
          <li>🏋️ <strong>Training load decides your growth.</strong> Grinding builds you faster but risks injury and burnout. Coasting gets you cut.</li>
          <li>🎓 <strong>School competes with training.</strong> A scholarship needs grades, and grinding eats study time.</li>
          <li>🩹 <strong>Injuries are a matter of when.</strong> Surgery, rehab or playing through pain: your choices have consequences.</li>
          <li>💰 <strong>Most athletes are not rich.</strong> Pay depends on league tier and rating. Only stars make fortunes.</li>
          <li>⛔ <strong>Pro sport is exclusive.</strong> You can&apos;t hold another job or run a business once you sign.</li>
          <li>🚪 <strong>Quitting has a price:</strong> lost fame, buy-outs and a lock-out before you can return.</li>
        </ul>
      </Card>

      {a.sport && a.rating > 0 && (
        <Card>
          <div className="text-sm font-semibold">Your sporting past</div>
          <div className="text-xs text-slate-400">
            {SPORT_INFO[a.sport as Sport]?.emoji} {a.sport} · rating {Math.round(a.rating)} (fading without training) · {a.record.seasons} season{a.record.seasons === 1 ? "" : "s"}, {a.record.titles} title{a.record.titles === 1 ? "" : "s"}
            {a.stage === "retired" ? " · retired" : ""}
          </div>
        </Card>
      )}

      {a.stage === "retired" ? (
        <RetiredPanel />
      ) : (
        <>
          <SectionTitle hint="pick carefully">Choose your sport</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {SPORTS.map((s) => {
              const i = SPORT_INFO[s];
              const sel = s === sport;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSport(s);
                    setConfirming(false);
                  }}
                  className={`rounded-2xl border p-3 text-left transition-colors ${sel ? "border-emerald-500 bg-emerald-900/30" : "border-slate-700/60 bg-slate-800/70 hover:bg-slate-800"}`}
                >
                  <div className="text-2xl">{i.emoji}</div>
                  <div className="font-semibold">{s}</div>
                  <div className="text-[11px] text-slate-400">Prime {i.peak[0]}-{i.peak[1]} · {i.team ? "team" : "individual"}</div>
                  <div className="text-[11px] text-slate-500">Injury risk {"●".repeat(Math.max(1, Math.round(i.injury / 0.05)))}</div>
                </button>
              );
            })}
          </div>

          <Card>
            <div className="flex items-center gap-2">
              <span className="text-3xl">{info.emoji}</span>
              <div className="text-lg font-bold">{sport}</div>
            </div>
            <p className="mt-1 text-sm text-slate-300">{info.blurb}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-400">
              {info.traits.map((t) => <li key={t}>{t}</li>)}
              <li>Careers last {info.careerLength}</li>
              <li>Ladder: {info.leagues.join(" → ")}</li>
            </ul>
            <div className="mt-3"><PeakBar sport={sport} age={Math.max(8, p.age)} /></div>
            <TrainingLoad compact />
            {blocker && <p className="mb-2 mt-2 text-xs font-medium text-rose-300">🔒 {blocker}</p>}
            {p.age >= 18 && !blocker && <p className="mb-2 mt-2 text-xs text-amber-300">Starting at {p.age} makes you a late amateur. Scouts recruit the young, so the odds are long.</p>}
            {!confirming ? (
              <Button variant="gold" className="mt-2 w-full" disabled={!!blocker} onClick={() => setConfirming(true)}>🏅 Commit to {sport}</Button>
            ) : (
              <div className="mt-2 rounded-xl border border-amber-600/60 bg-amber-950/30 p-3">
                <p className="mb-2 text-xs text-amber-200">You&apos;re committing to years of training with no guarantee. Your effort setting ({EFFORT_INFO[p.effort].label}) now decides how fast you develop. Continue?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="primary" onClick={() => act((pl, rng) => signWithClub(pl, sport, rng))}>Yes, commit</Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>Not yet</Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Training load
// ---------------------------------------------------------------------------

const LOAD_NOTES: Record<Effort, string> = {
  coast: "Fitness fades: you only convert about half your potential. Two years in a row and you'll be cut.",
  steady: "Reliable progress at normal injury risk.",
  grind: "Fastest progress and a slightly higher ceiling, but injury risk ×1.5, plus health, happiness and burnout costs. Grades suffer.",
};

function TrainingLoad({ compact = false }: { compact?: boolean }) {
  const { player: p, act } = useGame();
  const body = (
    <>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold">Training load</span>
        <span className="text-xs text-slate-500">the same setting as work and study</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(EFFORT_INFO) as Effort[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={p.effort === k}
            onClick={() => act((pl) => setEffort(pl, k))}
            className={`rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${p.effort === k ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            {EFFORT_INFO[k].emoji} {EFFORT_INFO[k].label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{LOAD_NOTES[p.effort]} (injury risk ×{INJURY_LOAD[p.effort]})</p>
    </>
  );
  return compact ? <div className="mt-3 rounded-xl bg-slate-900/50 p-3">{body}</div> : <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3">{body}</div>;
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

const KIND_LABEL: Record<AthleteOffer["kind"], string> = {
  scholarship: "🎓 College scholarship",
  academy: "🏫 Academy place",
  semipro: "📝 Semi-pro contract",
  pro: "🏟️ Professional contract",
  renew: "🔁 Contract extension",
  transfer: "✈️ Transfer offer",
  coach: "📋 Coaching job",
  pundit: "🎙️ Media job",
};

function OfferCard({ o }: { o: AthleteOffer }) {
  const { player: p, act } = useGame();
  const info = SPORT_INFO[(p.athlete.sport as Sport) ?? "Soccer"];
  const blocker = offerBlocker(p, o);
  const contract = o.years > 0;
  const studying = p.education.stage !== "None" && p.education.stage !== "Primary" && p.education.stage !== "HighSchool";
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{KIND_LABEL[o.kind]}</div>
          <div className="text-xs text-slate-400">{o.club}{contract ? ` · ${info.leagues[o.league]}` : ""}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums text-emerald-300">{money(o.salary)}</div>
          <div className="text-[11px] text-slate-500">{o.kind === "scholarship" ? "tuition covered" : o.kind === "academy" ? "stipend / yr" : "per year"}</div>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">{o.note}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {contract && <Pill>{o.years} season{o.years === 1 ? "" : "s"}</Pill>}
        {o.bonus > 0 && <Pill tone="green">{money(o.bonus)} signing bonus</Pill>}
        {o.kind === "scholarship" && <Pill tone="blue">{ENROL_NOTE}</Pill>}
        {contract && studying && <Pill tone="amber">You&apos;ll drop out of university</Pill>}
        {o.haggled && <Pill tone="amber">negotiated</Pill>}
      </div>
      {blocker && <p className="mt-1 text-xs font-medium text-rose-300">🔒 {blocker}</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Button variant="primary" disabled={!!blocker} onClick={() => act((pl, rng) => acceptOffer(pl, o.id, rng))}>Accept</Button>
        <Button variant="secondary" disabled={!contract || !!o.haggled || o.kind === "coach" || o.kind === "pundit"} onClick={() => act((pl, rng) => negotiateOffer(pl, o.id, rng))}>Push</Button>
        <Button variant="ghost" onClick={() => act((pl) => declineOffer(pl, o.id))}>Decline</Button>
      </div>
    </div>
  );
}

function Offers() {
  const { player: p } = useGame();
  const a = p.athlete;
  if (a.offers.length === 0) {
    return a.stage === "retired" || a.stage === "none" ? null : (
      <Block title="Offers">
        <p className="text-xs text-slate-400">No offers right now. Results, titles and showcases get you noticed; they arrive after each season and expire at the next Age Up.</p>
      </Block>
    );
  }
  const expiring = a.expiring || a.freeAgent;
  return (
    <Block title={`📨 Offers (${a.offers.length})`}>
      <p className="mb-2 text-xs text-slate-400">
        {expiring
          ? a.freeAgent
            ? "You have no club. Sign before the next Age Up or your career could end."
            : "Your contract has run out. If you don't choose, your agent will extend you on standard terms."
          : "Offers expire at the next Age Up. You can accept one, push for more money (a gamble), or decline."}
      </p>
      <div className="flex flex-col gap-2">{a.offers.map((o) => <OfferCard key={o.id} o={o} />)}</div>
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Injury
// ---------------------------------------------------------------------------

const PLANS: { id: InjuryPlan; label: string; blurb: string }[] = [
  { id: "rest", label: "Rest", blurb: "Free. Normal recovery, full lasting damage." },
  { id: "rehab", label: "Rehab", blurb: "Physio costs money. 30% less lasting damage." },
  { id: "surgery", label: "Surgery", blurb: "Shorter recovery (88% success). Half the lasting damage, but a failure sets you back." },
  { id: "play", label: "Play through it", blurb: "Keep your place and salary at reduced level. High risk of making it worse, maybe ending your career." },
];

function InjuryCard() {
  const { player: p, act } = useGame();
  const inj = p.athlete.injury;
  if (!inj) return null;
  const locked = inj.decided && inj.plan !== "play";
  return (
    <Block title={`🩹 Injury: ${inj.label}`} tone="red">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Pill tone="red">{["Minor", "Moderate", "Major", "Career-threatening"][inj.severity - 1]}</Pill>
        <Pill>{inj.yearsLeft > 0 ? `${inj.yearsLeft} more season${inj.yearsLeft === 1 ? "" : "s"} out` : "Back by next season"}</Pill>
        {inj.ratingLoss > 0 && <Pill tone="amber">−{inj.ratingLoss} rating when healed</Pill>}
        <Pill tone={locked ? "green" : "slate"}>Plan: {inj.decided ? inj.plan : "rest (default)"}</Pill>
      </div>
      {inj.severity >= 2 && (
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map((pl) => {
            const why = treatmentBlocker(p, pl.id);
            return (
              <div key={pl.id} className="flex flex-col">
                <Button variant={pl.id === "play" ? "danger" : "secondary"} disabled={!!why} onClick={() => act((st, rng) => chooseTreatment(st, pl.id, rng))}>{pl.label}</Button>
                <span className={`mt-0.5 text-[11px] ${why ? "text-rose-300" : "text-slate-500"}`}>{why ?? pl.blurb}</span>
              </div>
            );
          })}
        </div>
      )}
      {inj.severity < 2 && <p className="text-xs text-slate-400">Just a knock. It will clear up by itself.</p>}
    </Block>
  );
}

// ---------------------------------------------------------------------------
// Money, requirements, history, record
// ---------------------------------------------------------------------------

function Finances() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const job = p.currentJob?.lineId === "athlete" ? p.currentJob : null;
  const info = SPORT_INFO[(a.sport as Sport) ?? "Soccer"];
  const agentWhy = agentBlocker(p);
  const camp = (p.annual.train ?? 0) >= 1;
  const show = (p.annual["ath:showcase"] ?? 0) >= 1;
  return (
    <Block title="💼 Contract & money">
      {job ? (
        <div className="mb-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-semibold">{job.title}</div>
              <div className="text-xs text-slate-400">{job.company} · {info.leagues[a.league]}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold tabular-nums text-emerald-300">{money(job.salary)}</div>
              <div className="text-[11px] text-slate-500">per year, before tax</div>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pill tone={a.expiring ? "amber" : "slate"}>{a.expiring ? "Contract expired: negotiating" : `${a.contractYears} season${a.contractYears === 1 ? "" : "s"} left`}</Pill>
            {a.agent && <Pill tone="blue">Agent takes 8%</Pill>}
            {a.endorsements > 0 && <Pill tone="green">Endorsements {money(a.endorsements)}</Pill>}
          </div>
        </div>
      ) : a.stage === "college" ? (
        <div className="mb-2 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={a.scholarship ? "green" : "slate"}>{a.scholarship ? "Full scholarship" : a.track === "academy" ? "Academy place" : "Walk-on (self-funded)"}</Pill>
            {a.stipend > 0 && <Pill>Stipend {money(a.stipend)}/yr</Pill>}
          </div>
          {a.scholarship && <p className="mt-1 text-xs text-slate-400">Keep grades at 50+ ({Math.round(p.education.grades)} now{a.warnings > 0 ? `, ${a.warnings} warning` : ""}) or you lose the scholarship.</p>}
        </div>
      ) : (
        <p className="mb-2 text-xs text-slate-400">{a.freeAgent ? "You're a free agent: no salary until you sign." : "Youth sport pays nothing. Parents cover the costs until you're 18."}</p>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>Lifetime sport income</span><span className="text-right tabular-nums text-slate-200">{money(a.record.earnings)}</span>
        <span>Peak salary</span><span className="text-right tabular-nums text-slate-200">{money(a.record.peakSalary)}</span>
        <span>Cash on hand</span><span className="text-right tabular-nums text-slate-200">{money(p.bankBalance)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={camp || !!(a.injury && a.injury.yearsLeft > 0)} onClick={() => act((pl, rng) => trainAthletics(pl, rng))}>🏋️ {camp ? "Camp done" : `Coaching camp${p.age >= 18 ? " ($1,500)" : ""}`}</Button>
        <Button variant="secondary" disabled={show || !!(a.injury && a.injury.severity >= 2)} onClick={() => act((pl, rng) => attendShowcase(pl, rng))}>🔭 {show ? "Showcased" : `Showcase${p.age >= 18 ? " ($800)" : ""}`}</Button>
        {a.agent ? (
          <Button variant="ghost" className="col-span-2" onClick={() => act((pl) => fireAgent(pl))}>Fire agent</Button>
        ) : (
          <div className="col-span-2">
            <Button variant="secondary" className="w-full" disabled={!!agentWhy} onClick={() => act((pl) => hireAgent(pl))}>🤝 Hire an agent (8% of income)</Button>
            {agentWhy && <p className="mt-0.5 text-[11px] text-rose-300">🔒 {agentWhy}</p>}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Camp: +1-3 rating and steadier training. Showcase: scouts see you, so more offers. An agent improves offers and endorsements.</p>
    </Block>
  );
}

function Requirements() {
  const { player: p } = useGame();
  const groups = advanceRequirements(p);
  if (groups.length === 0) return null;
  return (
    <Block title="🎯 What you need to advance">
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-xs font-semibold text-slate-300">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((r) => (
                <li key={r.label} className={`text-xs ${r.ok ? "text-emerald-300" : "text-slate-400"}`}>
                  {r.ok ? "✓" : "✗"} {r.label}{r.detail ? <span className="text-slate-500"> ({r.detail})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Meeting a requirement makes an offer possible, not certain: scouts also need to have seen you. Offers arrive after each season.</p>
    </Block>
  );
}

function Record() {
  const { player: p } = useGame();
  const a = p.athlete;
  const r = a.record;
  const rows = [...a.history].reverse().slice(0, 8);
  const trophies = "🏆".repeat(Math.min(12, r.titles));
  return (
    <>
      <Block title="📈 Career record">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Seasons", r.seasons],
            ["Pro seasons", r.proSeasons],
            ["Titles", r.titles],
            ["Awards", r.awards],
            ["Medals", r.medals],
            ["Caps", r.caps],
            ["Best rating", Math.round(r.bestRating)],
            ["Injuries", r.injuries],
            ["Fame", p.fame],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-slate-900/50 p-2">
              <div className="text-lg font-bold tabular-nums">{v}</div>
              <div className="text-[11px] text-slate-400">{k}</div>
            </div>
          ))}
        </div>
        {(r.titles > 0 || r.medals > 0 || r.awards > 0) && (
          <div className="mt-2 text-lg leading-snug" aria-label="Trophy cabinet">{trophies}{"🥇".repeat(Math.min(6, r.medals))}{"⭐".repeat(Math.min(8, r.awards))}</div>
        )}
        {p.flags.includes("hall_of_fame") && <div className="mt-1"><Pill tone="amber">🏛️ Hall of Fame</Pill></div>}
        {p.flags.includes("doping_caught") && <div className="mt-1"><Pill tone="red">Doping ban on record</Pill></div>}
      </Block>
      <Block title="🗓️ Season history">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">No seasons yet. Age Up to play your first.</p>
        ) : (
          <ul className="divide-y divide-slate-700/60">
            {rows.map((s) => (
              <li key={`${s.year}-${s.age}`} className="py-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-slate-200">Age {s.age} · {s.club}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">rtg {s.rating}{s.earnings > 0 ? ` · ${money(s.earnings)}` : ""}</span>
                </div>
                <div className="text-slate-400">{s.summary}{s.titles > 0 ? ` 🏆×${s.titles}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

function ExitCard() {
  const { player: p, act } = useGame();
  const [confirm, setConfirm] = useState(false);
  const prev = exitPreview(p);
  const a = p.athlete;
  if (!prev) return null;
  const contracted = a.stage === "semipro" || a.stage === "pro";
  const free = contracted && (a.freeAgent || a.expiring || a.contractYears <= 0);
  return (
    <Block title={`🚪 ${prev.title}`}>
      <ul className="mb-2 list-disc space-y-0.5 pl-5 text-xs text-slate-400">{prev.lines.map((l) => <li key={l}>{l}</li>)}</ul>
      {!confirm ? (
        <Button variant="ghost" className="w-full" onClick={() => setConfirm(true)}>{contracted ? "Retire / leave…" : "Quit the sport…"}</Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger" onClick={() => act((pl) => (contracted && free ? retireFromSport(pl) : quitSport(pl)))}>
            Yes{prev.cost > 0 ? `, pay ${money(prev.cost)}` : ""}
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>Keep going</Button>
        </div>
      )}
      {contracted && !free && confirm && <p className="mt-1 text-[11px] text-rose-300">Walking out mid-contract is a breach, so you&apos;re locked out for {2 + a.league} years.</p>}
    </Block>
  );
}

function RetiredPanel() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const why = comebackBlocker(p);
  return (
    <>
      <Offers />
      <Block title="🏖️ After the game">
        <p className="text-xs text-slate-400">
          Retired at {a.retiredAge ?? p.age}. {a.post === "none" ? "No salary now. Your savings, any endorsements that outlast your name and whatever job you find pay the bills." : `You're working as a ${a.post === "coach" ? "coach" : "pundit"}.`}
          {a.endorsements > 0 ? ` Legacy endorsements: ${money(a.endorsements)}/yr (fading).` : ""}
        </p>
        <Button variant="secondary" className="mt-2 w-full" disabled={!!why} onClick={() => act((pl) => comeback(pl))}>🔁 Come out of retirement</Button>
        {why && <p className="mt-0.5 text-[11px] text-rose-300">🔒 {why}</p>}
      </Block>
    </>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function Dashboard() {
  const { player: p, act } = useGame();
  const a = p.athlete;
  const sport = (a.sport as Sport) ?? "Soccer";
  const info = SPORT_INFO[sport];
  const view = athleteView(p);
  const retired = a.stage === "retired";
  const leagueName = a.stage === "youth" ? "Youth league" : a.stage === "college" ? (a.track === "academy" ? "Academy league" : "College league") : info.leagues[a.league];

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{info.emoji} {sport} career</SectionTitle>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-bold">{stageLabel(p)}</div>
            <div className="text-sm text-slate-400">{retired ? `Retired at ${a.retiredAge ?? p.age}` : `${a.club || "Unattached"} · ${leagueName}`}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {a.freeAgent && <Pill tone="amber">Free agent</Pill>}
            {a.injury && <Pill tone="red">Injured</Pill>}
            {a.banYears > 0 && <Pill tone="red">{a.banYears >= 99 ? "Banned for life" : `Banned ${a.banYears}y`}</Pill>}
            {a.doping && <Pill tone="red">Doping</Pill>}
            {a.stage === "college" && a.scholarship && <Pill tone="green">Scholarship</Pill>}
          </div>
        </div>
        <div className="mt-3"><Stepper active={stepIndex(p)} /></div>
        {!retired && (
          <>
            <div className="mt-3"><PeakBar sport={sport} age={p.age} /></div>
            <div className="mt-3">
              <StatBar label={`Rating (scouts' potential grade: ${view.potential})`} value={a.rating} color="teal" />
              <StatBar label="Form this season" value={a.form} color="green" compact />
              <div className="mt-2.5" />
              <StatBar label="Training consistency" value={a.consistency} color="blue" compact />
              <div className="mt-2.5" />
              <StatBar label="Scout visibility" value={a.exposure} color="purple" compact />
              <div className="mt-2.5" />
              <StatBar label="Health" value={p.health} color="red" compact />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {a.stage === "semipro" || a.stage === "pro"
                ? `League tiers need ${LEAGUE_MIN.join(" / ")} rating. `
                : ""}
              {a.detrain > 0 ? `You've coasted ${a.detrain} year${a.detrain > 1 ? "s" : ""}: ${a.detrain >= 2 ? "you could be cut any year now." : "another year and you risk being cut."}` : "Rating, form and consistency update every Age Up."}
            </p>
          </>
        )}
      </Card>

      {a.doping && (
        <Block title="⚠️ You're doping" tone="red">
          <p className="text-xs text-slate-300">It boosts your rating, but costs health and every season risks a positive test (about {Math.round(([0.1, 0.12, 0.2, 0.3, 0.4][a.stage === "college" ? 0 : a.league + 1] ?? 0.1) * 55)}% a year). Caught means a multi-year ban, stripped titles and a ruined name.</p>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => act((pl) => stopDoping(pl))}>Come off it</Button>
        </Block>
      )}

      {retired ? (
        <RetiredPanel />
      ) : (
        <>
          <Offers />
          <InjuryCard />
          {!(hasCommitment(p) && p.age >= 14) && <TrainingLoad />}
          <Finances />
          <Requirements />
        </>
      )}
      <Record />
      {!retired && <ExitCard />}
    </div>
  );
}

export function AthleteSection() {
  const { player: p } = useGame();
  if (p.athlete.stage === "none" || (p.athlete.stage === "retired" && !p.athlete.sport)) return <Onboarding />;
  return <Dashboard />;
}
