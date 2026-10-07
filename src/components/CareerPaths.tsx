"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  BUSINESS_TYPES,
  SPORTS,
  brandCollab,
  investInBusiness,
  postContent,
  sellBusiness,
  signWithClub,
  startBusiness,
  MARKETING_COST,
  MAX_LOCATIONS,
  expandBusiness,
  fireStaff,
  hireStaff,
  maxStaff,
  runMarketing,
  STAFF_SALARY,
  startChannel,
  trainAthletics,
  workOnBusiness,
} from "@/engine/paths";
import { applyForJob, jobEligibility, workHarder, quitJob } from "@/engine/career";
import { CAMPAIGN_COST, MIN_AGE, PARTIES, TERM_YEARS, canRun, charityDrive, electionChance, giveSpeech, joinParty, nextTier, runForOffice } from "@/engine/politics";
import { inMob, joinMob, leaveMob } from "@/engine/underworld";
import { APPROACHES, inAgency, missionChance, runMission } from "@/engine/spy";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle, StatBar } from "./ui";

export function BusinessSection() {
  const { player: p, act } = useGame();
  const [name, setName] = useState("");
  const biz = p.business;

  if (biz) {
    const kind = BUSINESS_TYPES.find((b) => b.id === biz.kind)!;
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>Your Business</SectionTitle>
        <Card>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{kind.emoji}</span>
            <div>
              <div className="text-lg font-bold">{biz.name}</div>
              <div className="text-xs text-slate-400">{kind.name} · founded {biz.founded}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div><div className="text-xs text-slate-400">Valuation</div><div className="text-lg font-bold text-amber-300">{money(biz.value)}</div></div>
            <div><div className="text-xs text-slate-400">Last year's profit</div><div className={`text-lg font-bold ${biz.lastProfit < 0 ? "text-rose-300" : "text-emerald-300"}`}>{money(biz.lastProfit)}</div></div>
          </div>
        </Card>
        <Button variant="primary" disabled={(p.annual.bizwork ?? 0) >= 1} onClick={() => act((pl) => workOnBusiness(pl))}>
          💪 Work Overtime (+12% profit this year)
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={p.bankBalance < 25_000} onClick={() => act((pl) => investInBusiness(pl, 25_000))}>Invest $25,000</Button>
          <Button variant="secondary" disabled={p.bankBalance < 100_000} onClick={() => act((pl) => investInBusiness(pl, 100_000))}>Invest $100,000</Button>
        </div>
        <Card className="p-3">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">Operations</span>
            <span className="text-slate-400">{biz.staff} staff · {biz.locations} location{biz.locations > 1 ? "s" : ""}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={biz.staff >= maxStaff(biz.locations) || p.bankBalance < 3_000} onClick={() => act((pl) => hireStaff(pl))}>👤 Hire Staff</Button>
            <Button variant="ghost" disabled={biz.staff <= 0} onClick={() => act((pl) => fireStaff(pl))}>Let Someone Go</Button>
            <Button variant="secondary" disabled={(p.annual.marketing ?? 0) >= 1 || p.bankBalance < MARKETING_COST} onClick={() => act((pl) => runMarketing(pl))}>📣 Marketing ({money(MARKETING_COST)})</Button>
            <Button variant="secondary" disabled={biz.locations >= MAX_LOCATIONS || p.bankBalance < biz.value * 0.6} onClick={() => act((pl) => expandBusiness(pl))}>🏪 Expand ({money(biz.value * 0.6)})</Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Each employee adds 4% to profit but costs {money(STAFF_SALARY)} a year. More locations multiply value and risk.</p>
        </Card>
        <Button variant="ghost" onClick={() => act((pl) => sellBusiness(pl))}>Sell Business ({money(biz.value * 0.9)})</Button>
        <p className="text-xs text-slate-500">Profit is taxed as income. Risky ventures can go bankrupt; tech startups may get acquired.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="you can hold a job too">Start a Business</SectionTitle>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="Business name (optional)"
        className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      {BUSINESS_TYPES.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
          <span className="text-3xl">{b.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{b.name}</div>
            <div className="text-xs text-slate-400">{b.blurb}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Pill tone={b.vol > 0.5 ? "red" : b.vol > 0.25 ? "amber" : "green"}>{b.vol > 0.5 ? "Wild" : b.vol > 0.25 ? "Volatile" : "Stable"}</Pill>
              <Pill>{b.minSmarts}+ Smarts</Pill>
            </div>
          </div>
          <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={p.bankBalance < b.cost || p.smarts < b.minSmarts || p.age < 18} onClick={() => act((pl) => startBusiness(pl, b.id, name))}>
            {money(b.cost)}
          </Button>
        </div>
      ))}
    </div>
  );
}

export function AthleteSection() {
  const { player: p, act } = useGame();
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const job = p.currentJob?.lineId === "athlete" ? p.currentJob : null;
  const line = CAREER_BY_ID.athlete;
  const elig = jobEligibility(p, line);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Professional Sports</SectionTitle>
      <Card>
        <StatBar label="🏃 Athletics" value={p.skills.athletics} color="teal" />
        <StatBar label="❤️ Health" value={p.health} color="green" compact />
        {job ? (
          <div className="mt-3">
            <div className="text-lg font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{job.company} · {money(job.salary)}/yr</div>
            <div className="mt-2"><StatBar label="Performance" value={job.performance} color="green" /></div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" disabled={(p.annual.work ?? 0) >= 1} onClick={() => act((pl, rng) => workHarder(pl, rng))}>💪 Push Harder</Button>
              <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Leave Club</Button>
            </div>
          </div>
        ) : null}
      </Card>
      <Button variant="secondary" disabled={(p.annual.train ?? 0) >= 1 || p.age < 8} onClick={() => act((pl, rng) => trainAthletics(pl, rng))}>
        🏋️ Training Camp ({(p.annual.train ?? 0) >= 1 ? "done" : "+4–8 Athletics"})
      </Button>
      {!job && (
        <Card>
          <div className="mb-1 font-semibold">Sign with a club</div>
          <p className="mb-2 text-xs text-slate-400">Needs 40+ Athletics and age 16+. Better skill and health mean better odds. Careers end around 36–40, and injuries happen.</p>
          <select value={sport} onChange={(e) => setSport(e.target.value)} className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm" aria-label="Sport">
            {SPORTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
          <Button variant="gold" className="w-full" disabled={!elig.ok || (p.annual["apply:athlete"] ?? 0) >= 1} onClick={() => act((pl, rng) => signWithClub(pl, sport, rng))}>
            🏅 Try Out
          </Button>
        </Card>
      )}
    </div>
  );
}

export function InfluencerSection() {
  const { player: p, act } = useGame();
  const inf = p.influencer;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Online Fame</SectionTitle>
      {!inf.active ? (
        <Card>
          <p className="mb-3 text-sm text-slate-300">Start a channel and grow an audience. Looks and charisma help, and consistent posting keeps followers from drifting away.</p>
          <Button variant="primary" className="w-full" disabled={p.age < 10} onClick={() => act((pl, rng) => startChannel(pl, rng))}>📱 Launch Your Channel</Button>
        </Card>
      ) : (
        <>
          <Card>
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-slate-400">Followers</div>
              <div className="text-3xl font-black tabular-nums text-pink-300">{inf.followers.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Earning about {money(inf.followers >= 5_000 ? inf.followers * 0.35 : 0)} / year</div>
            </div>
            <div className="mt-3"><StatBar label="🌟 Fame" value={p.fame} color="amber" compact /></div>
          </Card>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" disabled={(p.annual.post ?? 0) >= 1} onClick={() => act((pl, rng) => postContent(pl, rng))}>🎥 Post Big Content</Button>
            <Button variant="gold" disabled={(p.annual.collab ?? 0) >= 1 || inf.followers < 5_000} onClick={() => act((pl) => brandCollab(pl))}>🤝 Brand Collab {inf.followers < 5_000 ? "(5,000 followers)" : `(≈${money(inf.followers * 0.25)})`}</Button>
          </div>
          <p className="text-xs text-slate-500">If you skip a year of posting, your audience shrinks by 15%.</p>
        </>
      )}
    </div>
  );
}

export function PoliticsSection() {
  const { player: p, act } = useGame();
  const line = CAREER_BY_ID.politics;
  const job = p.currentJob?.lineId === "politics" ? p.currentJob : null;
  const tier = nextTier(p);
  const next = line.ladder[tier];
  const check = canRun(p);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Politics</SectionTitle>
      <Card>
        {job ? (
          <>
            <div className="text-lg font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{job.company} · {money(job.salary)}/yr · term year {p.politics.yearsInOffice + 1}/{TERM_YEARS}</div>
          </>
        ) : (
          <div className="text-sm text-slate-300">You hold no office. Win elections, from city council all the way to head of state.</div>
        )}
        <div className="mt-3"><StatBar label="🗳️ Popularity" value={p.politics.popularity} color="blue" compact /></div>
      </Card>
      <SectionTitle hint={p.politics.party ? "switching costs popularity" : "pick your side"}>Your Party</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {PARTIES.map((party) => (
          <button
            key={party.id}
            type="button"
            disabled={p.politics.party === party.id}
            onClick={() => act((pl) => joinParty(pl, party.id))}
            className={`rounded-xl border p-2.5 text-left transition-colors disabled:cursor-default ${p.politics.party === party.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700/60 bg-slate-800/60 hover:border-emerald-500/50"}`}
          >
            <div className="text-sm font-semibold">{party.emoji} {party.name}</div>
            <div className="text-xs text-slate-400">{party.blurb}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={(p.annual.speech ?? 0) >= 1 || p.age < 18} onClick={() => act((pl, rng) => giveSpeech(pl, rng))}>🎤 Give a Speech</Button>
        <Button variant="secondary" disabled={(p.annual.drive ?? 0) >= 1 || p.bankBalance < 5_000} onClick={() => act((pl) => charityDrive(pl))}>🤝 Charity Drive ($5,000)</Button>
      </div>
      {next && (
        <Card>
          <div className="font-semibold">Run for {next.title}</div>
          <div className="text-xs text-slate-400">Campaign cost {money(CAMPAIGN_COST[tier])} · age {MIN_AGE[tier]}+ · salary {money(next.salary)}</div>
          {check.ok ? <div className="mt-1 text-xs text-emerald-300">Estimated odds: {Math.round(electionChance(p, tier) * 100)}%</div> : <div className="mt-1 text-xs font-medium text-rose-300">🔒 {check.reason}</div>}
          <Button variant="gold" className="mt-2 w-full" disabled={!check.ok || (p.annual.campaign ?? 0) >= 1} onClick={() => act((pl, rng) => runForOffice(pl, rng))}>🏛️ Launch Campaign</Button>
        </Card>
      )}
      <p className="text-xs text-slate-500">Karma, charisma, fame and popularity all sway voters. Incumbents face re-election every {TERM_YEARS} years.</p>
    </div>
  );
}

export function UnderworldSection() {
  const { player: p, act } = useGame();
  const job = inMob(p) ? p.currentJob : null;
  const line = CAREER_BY_ID.mafia;
  const elig = jobEligibility(p, line);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>The Underworld</SectionTitle>
      {job ? (
        <Card className="border-rose-900/60">
          <div className="text-xs uppercase tracking-widest text-rose-300">{job.company}</div>
          <div className="text-xl font-bold">{job.title}</div>
          <div className="text-sm text-slate-400">{money(job.salary)}/yr, untaxed · arrest and gang-war risk rises with rank</div>
          <div className="mt-3"><StatBar label="Standing" value={job.performance} color="red" /></div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" disabled={(p.annual.work ?? 0) >= 1} onClick={() => act((pl, rng) => workHarder(pl, rng))}>🔫 Take on a Job</Button>
            <Button variant="ghost" onClick={() => act((pl, rng) => leaveMob(pl, rng))}>Leave the Family</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="mb-2 text-sm text-slate-300">Associates earn off-the-books cash and climb to Boss. But the police, rival crews, and your conscience are all watching.</p>
          <p className="mb-2 text-xs text-slate-500">Odds improve with a criminal record and a low karma. Open to Karma 50 or lower.</p>
          {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
          <Button variant="danger" className="w-full" disabled={!elig.ok || (p.annual["apply:mafia"] ?? 0) >= 1} onClick={() => act((pl, rng) => joinMob(pl, rng))}>🕴️ Seek Out the Family</Button>
        </Card>
      )}
    </div>
  );
}

export function SpySection() {
  const { player: p, act } = useGame();
  const job = inAgency(p) ? p.currentJob : null;
  const line = CAREER_BY_ID.spy;
  const elig = jobEligibility(p, line);
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Secret Agent</SectionTitle>
      {job ? (
        <>
          <Card className="border-sky-900/60">
            <div className="text-xs uppercase tracking-widest text-sky-300">{job.company}</div>
            <div className="text-xl font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{money(job.salary)}/yr · mission bonus {money(20_000 * (job.tier + 1))}</div>
            <div className="mt-3"><StatBar label="Standing" value={job.performance} color="blue" compact /></div>
          </Card>
          <SectionTitle hint="one mission per year">Take a Mission</SectionTitle>
          {APPROACHES.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={(p.annual.mission ?? 0) >= 1}
              onClick={() => act((pl, rng) => runMission(pl, a.id, rng))}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{a.name}</span>
                <span className="text-sm text-emerald-300">{Math.round(missionChance(p, a.id) * 100)}%</span>
              </div>
              <div className="text-xs text-slate-400">{a.blurb} Uses {a.stat}.</div>
            </button>
          ))}
          <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Resign</Button>
        </>
      ) : (
        <Card>
          <p className="mb-2 text-sm text-slate-300">The Agency recruits quietly: a degree and 70+ Smarts. Pay is good. Disavowal is possible.</p>
          {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
          <Button variant="primary" className="w-full" disabled={!elig.ok || (p.annual["apply:spy"] ?? 0) >= 1} onClick={() => act((pl, rng) => applyForJob(pl, "spy", rng))}>🕵️ Apply to the Agency</Button>
        </Card>
      )}
    </div>
  );
}

export function AdultWorkSection() {
  const { player: p, act } = useGame();
  const lines = ["dancer", "escort", "creator"].map((id) => CAREER_BY_ID[id]);
  const job = p.currentJob && lines.some((l) => l.id === p.currentJob?.lineId) ? p.currentJob : null;
  if (!p.matureContent || p.age < 18) {
    return <Card><p className="text-sm text-slate-400">Adult work is hidden while mature content is off. Enable it in Settings (⚙️).</p></Card>;
  }
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint="18+ · legal gray areas vary by country">Adult Work</SectionTitle>
      {job ? (
        <Card className="border-fuchsia-900/60">
          <div className="text-xs uppercase tracking-widest text-fuchsia-300">{job.company}</div>
          <div className="text-xl font-bold">{job.title}</div>
          <div className="text-sm text-slate-400">{money(job.salary)}/yr</div>
          <div className="mt-3"><StatBar label="Standing" value={job.performance} color="pink" /></div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" disabled={(p.annual.work ?? 0) >= 1} onClick={() => act((pl, rng) => workHarder(pl, rng))}>💪 Push Harder</Button>
            <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Quit</Button>
          </div>
        </Card>
      ) : (
        lines.map((line) => {
          const elig = jobEligibility(p, line);
          return (
            <div key={line.id} className="flex items-start gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
              <span className="text-2xl">{line.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{line.name}</div>
                <div className="text-xs text-slate-400">{line.blurb}</div>
                <div className="mt-1 text-xs text-slate-500">{money(line.ladder[0].salary)}/yr → {money(line.ladder[line.ladder.length - 1].salary)}</div>
                {!elig.ok && <div className="mt-1 text-xs font-medium text-rose-300">🔒 {elig.reason}</div>}
              </div>
              <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={!elig.ok || (p.annual[`apply:${line.id}`] ?? 0) >= 1} onClick={() => act((pl, rng) => applyForJob(pl, line.id, rng))}>Apply</Button>
            </div>
          );
        })
      )}
      <p className="text-xs text-slate-500">Everything is between consenting adults. Health, legal and family risks are real.</p>
    </div>
  );
}
