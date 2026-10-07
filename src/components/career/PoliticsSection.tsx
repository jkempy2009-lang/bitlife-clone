"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  AMBASSADOR_PAY,
  CAMPAIGN_COST,
  DONOR_KINDS,
  ISSUES,
  LOBBY_INCOME,
  MIN_AGE,
  PARTIES,
  PUNDIT_PAY,
  TERM_LIMITS,
  TERM_YEARS,
  ambassadorBlocker,
  buildCoalition,
  buyAds,
  canRun,
  charityDrive,
  currentTier,
  debateCoaching,
  electionOdds,
  endorsementChance,
  fightInvestigation,
  fundraisingChance,
  giveSpeech,
  handleScandal,
  inOffice,
  joinParty,
  kickbackAmount,
  lobbyBlocker,
  memoirBlocker,
  nextTier,
  officeYears,
  partyWork,
  platformFit,
  politicalMemoir,
  policyChance,
  punditBlocker,
  pushPolicy,
  raiseFunds,
  researchOpponent,
  retireFromOffice,
  runForOffice,
  seekEndorsement,
  selfFund,
  setStance,
  takeKickback,
  takeRetirementPath,
  townHall,
} from "@/engine/politics";
import { CAREER_BY_ID } from "@/data/careersRegistry";
import { RECORD_LABEL, officeBlocker, recordLevel } from "@/engine/justice";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";

const moodWord = (m: number) => (Math.abs(m) < 0.15 ? "split" : m < 0 ? "leans left" : "leans right");

export function PoliticsSection() {
  const { player: p, act } = useGame();
  const [showOdds, setShowOdds] = useState(false);
  const line = CAREER_BY_ID.politics;
  const sc = p.statecraft;
  const job = inOffice(p) ? p.currentJob : null;
  const tier = nextTier(p);
  const next = line.ladder[tier];
  const check = canRun(p);
  const odds = next ? electionOdds(p, tier, "run") : null;
  const limit = job ? TERM_LIMITS[job.tier] : null;
  const party = PARTIES.find((x) => x.id === p.politics.party);
  const adult = p.age >= 18;
  const campaignBase = CAMPAIGN_COST[Math.max(0, Math.min(4, tier))];
  const annualUsed = (k: string) => (p.annual[k] ?? 0) > 0;
  const rec = recordLevel(p);
  const recordBlock = officeBlocker(p);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Politics</SectionTitle>

      <Card>
        {job ? (
          <>
            <div className="text-lg font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">
              {job.company} · {money(job.salary)}/yr · term year {p.politics.yearsInOffice + 1}/{TERM_YEARS}
              {limit !== null ? ` · term ${sc.termsInOffice + 1}/${limit} (limit)` : " · no term limit"}
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-300">
            You hold no office.
            {sc.highestTier >= 0 ? ` You once served as ${line.ladder[sc.highestTier].title}.` : " Win elections, from city council all the way to head of state."}
            {sc.retired ? ` Now: ${sc.retired === "lobbyist" ? "lobbyist" : sc.retired === "ambassador" ? "ambassador" : "political commentator"}.` : ""}
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2.5">
          <Meter label="🗳️ Approval" value={p.politics.popularity} tone={p.politics.popularity < 25 ? "red" : p.politics.popularity < 45 ? "amber" : "green"} />
          <Meter label="🏛️ Party standing" value={sc.machine} tone="blue" note={party ? `${Math.round(sc.machine)}` : "no party"} />
          {job && <Meter label="🤝 Legislative coalition" value={sc.coalition} tone="slate" />}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="green">💰 War chest {money(sc.funds)}</Pill>
          {sc.endorsed && <Pill tone="green">✅ Endorsed</Pill>}
          {job && <Pill tone="blue">📜 {sc.policyWins} bills passed</Pill>}
          {sc.removed > 0 && <Pill tone="red">Removed ×{sc.removed}</Pill>}
          {rec !== "clean" && <Pill tone="red">{RECORD_LABEL[rec]}</Pill>}
          {p.economy.climate !== "normal" && <Pill tone="amber">{p.economy.climate === "boom" ? "📈 Boom: voters content" : "📉 Recession: voters angry"}</Pill>}
        </div>
        {recordBlock && <div className="mt-2"><Banner tone="red">🔒 {recordBlock}</Banner></div>}
      </Card>

      {sc.scandal && (
        <Card className="border-rose-800/70">
          <div className="text-xs uppercase tracking-widest text-rose-300">Scandal · severity {sc.scandal.severity}/3</div>
          <div className="text-lg font-bold">{sc.scandal.title}</div>
          <p className="mt-1 text-xs text-slate-400">It costs you approval every year and cuts your election odds. Choose how to answer (one response a year).</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ActionButton label="Apologise" hint="Safe, humble" reason={annualUsed("pol:scandal") ? "Already responded this year" : null} onClick={() => act((pl, rng) => handleScandal(pl, rng, "apologise"))} />
            <ActionButton label="Deny & attack" hint="Risky: can backfire" reason={annualUsed("pol:scandal") ? "Already responded this year" : null} onClick={() => act((pl, rng) => handleScandal(pl, rng, "deny"))} />
            <ActionButton label="Hire PR firm" hint={money(5_000 * (Math.max(0, currentTier(p)) + 1))} reason={annualUsed("pol:scandal") ? "Already responded this year" : null} onClick={() => act((pl, rng) => handleScandal(pl, rng, "spin"))} />
            <ActionButton label="Resign" hint="End it, lose the seat" variant="ghost" reason={annualUsed("pol:scandal") ? "Already responded this year" : null} onClick={() => act((pl, rng) => handleScandal(pl, rng, "resign"))} />
          </div>
        </Card>
      )}

      {sc.investigation && (
        <Card className="border-amber-800/70">
          <div className="text-xs uppercase tracking-widest text-amber-300">Corruption investigation</div>
          <p className="mt-1 text-sm text-slate-300">Prosecutors are building a case ({sc.investigation.yearsLeft} year{sc.investigation.yearsLeft === 1 ? "" : "s"} to run). You can't campaign until it ends.</p>
          <ActionButton className="mt-2" variant="secondary" label={`Hire specialist counsel (${money(20_000 * (Math.max(0, currentTier(p)) + 1))})`} reason={annualUsed("pol:fight") ? "Already briefed this year" : p.bankBalance + sc.funds < 20_000 * (Math.max(0, currentTier(p)) + 1) ? "Can't afford it" : null} onClick={() => act((pl, rng) => fightInvestigation(pl, rng))} />
        </Card>
      )}

      <SectionTitle hint={p.politics.party ? "switching costs approval and standing" : "pick your side"}>Your Party</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {PARTIES.map((x) => (
          <button
            key={x.id}
            type="button"
            disabled={p.politics.party === x.id || !adult}
            onClick={() => act((pl) => joinParty(pl, x.id))}
            className={`rounded-xl border p-2.5 text-left transition-colors disabled:cursor-default ${p.politics.party === x.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-700/60 bg-slate-800/60 hover:border-emerald-500/50 disabled:opacity-50"}`}
          >
            <div className="text-sm font-semibold">{x.emoji} {x.name}</div>
            <div className="text-xs text-slate-400">{x.blurb}</div>
          </button>
        ))}
      </div>
      {party && (
        <div className="grid grid-cols-2 gap-2">
          <ActionButton label="🧢 Party Work" hint="+8 party standing" reason={annualUsed("pol:work") ? "Done this year" : null} onClick={() => act((pl) => partyWork(pl))} />
          <ActionButton
            label="🤝 Seek Endorsement"
            hint={`${Math.round(endorsementChance(p) * 100)}% to land · +7% election odds`}
            reason={sc.endorsed ? "Already endorsed" : annualUsed("pol:endorse") ? "Asked this year" : null}
            onClick={() => act((pl, rng) => seekEndorsement(pl, rng))}
          />
        </div>
      )}

      <SectionTitle hint="please some, cost others">Positions</SectionTitle>
      <Card>
        <div className="flex flex-col gap-3">
          {ISSUES.map((issue, i) => {
            const stance = sc.stances[issue.id] ?? 0;
            const mood = sc.mood[issue.id] ?? 0;
            const plat = party?.platform[i];
            const donor = sc.donors.find((d) => d.issue === issue.id);
            return (
              <div key={issue.id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{issue.emoji} {issue.name}</span>
                  <span className="text-xs text-slate-500">Voters {moodWord(mood)}{plat !== undefined ? ` · party: ${issue.options[plat + 1]}` : ""}</span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {issue.options.map((label, n) => (
                    <button
                      key={label}
                      type="button"
                      disabled={!adult}
                      onClick={() => act((pl) => setStance(pl, issue.id, n - 1))}
                      className={`rounded-lg px-1 py-1.5 text-xs font-medium transition-colors ${stance === n - 1 ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {donor && (
                  <div className="mt-1 text-xs text-amber-300">
                    💼 {donor.name} ({money(donor.given)}) expects "{issue.options[donor.stance + 1]}"{stance !== donor.stance ? ": you are letting them down" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {party ? `Platform match: ${Math.round(platformFit(p) * 100)}%. Straying costs party standing.` : "Join a party for a ready-made platform."} Positions that match what voters want lift your odds; reversing one makes you a flip-flopper.
        </p>
      </Card>

      <SectionTitle hint="donors always want something">Campaign Finance</SectionTitle>
      <Card>
        <div className="mb-2 text-sm text-slate-300">War chest: <strong className="text-emerald-300">{money(sc.funds)}</strong> · campaign for {next?.title ?? "highest office"} costs {next ? money(CAMPAIGN_COST[tier]) : "n/a"}</div>
        <div className="flex flex-col gap-2">
          {DONOR_KINDS.map((d) => (
            <ActionButton
              key={d.id}
              label={`${d.emoji} ${d.name} (~${money(Math.round(campaignBase * d.share))})`}
              hint={`${d.blurb} ${Math.round(fundraisingChance(p, d.id) * 100)}% to land.`}
              reason={!adult ? "Adults only" : annualUsed(`fund:${d.id}`) ? "Worked this year" : null}
              onClick={() => act((pl, rng) => raiseFunds(pl, rng, d.id))}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton label="Self-fund $10,000" reason={p.bankBalance < 10_000 ? "Not enough savings" : null} onClick={() => act((pl) => selfFund(pl, 10_000))} />
          <ActionButton label="Self-fund $50,000" reason={p.bankBalance < 50_000 ? "Not enough savings" : null} onClick={() => act((pl) => selfFund(pl, 50_000))} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <ActionButton label="🎤 Give a Speech" reason={annualUsed("speech") ? "Voice hoarse: done this year" : !adult ? "Adults only" : null} onClick={() => act((pl, rng) => giveSpeech(pl, rng))} />
        <ActionButton label="🏘️ Town Hall" hint="Pressing the flesh. Gaffe risk." reason={annualUsed("pol:town") ? "Done this year" : !adult ? "Adults only" : null} onClick={() => act((pl, rng) => townHall(pl, rng))} />
        <ActionButton label="🤝 Charity Drive ($5,000)" className="col-span-2" reason={annualUsed("drive") ? "Donor fatigue: done this year" : p.bankBalance < 5_000 ? "Needs $5,000" : null} onClick={() => act((pl) => charityDrive(pl))} />
      </div>

      {next && (
        <Card>
          <div className="font-semibold">Run for {next.title}</div>
          <div className="text-xs text-slate-400">Campaign cost {money(CAMPAIGN_COST[tier])} · age {MIN_AGE[tier]}+ · salary {money(next.salary)}{TERM_LIMITS[tier] ? ` · ${TERM_LIMITS[tier]}-term limit` : ""}</div>
          {check.ok && odds ? (
            <button type="button" onClick={() => setShowOdds((v) => !v)} className="mt-1 text-left text-xs text-emerald-300 underline-offset-2 hover:underline">
              Estimated odds: {Math.round(odds.chance * 100)}% {showOdds ? "▲" : "▼ why?"}
            </button>
          ) : (
            <div className="mt-1 text-xs font-medium text-rose-300">🔒 {check.reason}</div>
          )}
          {showOdds && odds && (
            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 text-xs text-slate-400">
              {odds.factors.map((f) => (
                <li key={f.label} className="flex justify-between">
                  <span>{f.label}</span>
                  <span className={f.value < 0 ? "text-rose-300" : "text-emerald-300"}>{f.value >= 0 ? "+" : ""}{Math.round(f.value * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ActionButton label="📺 Ad Blitz" hint={`${money(Math.round(CAMPAIGN_COST[tier] * 0.1))}: +4% odds`} reason={annualUsed("pol:ads") ? "Already running" : null} onClick={() => act((pl) => buyAds(pl))} />
            <ActionButton label="🎓 Debate Coach" hint={`${money(2_000 * (tier + 1))}: +2 charisma`} reason={annualUsed("pol:coach") ? "Coached this year" : null} onClick={() => act((pl) => debateCoaching(pl))} />
            <ActionButton label="🔍 Research Rival" hint="+3% odds, clean" reason={annualUsed("pol:oppo") || annualUsed("pol:oppo_done") ? "File already assembled" : null} onClick={() => act((pl, rng) => researchOpponent(pl, rng, false))} />
            <ActionButton label="🕵️ Dig Dirt" hint="+7% odds, 25% blowback" variant="ghost" reason={annualUsed("pol:oppo") || annualUsed("pol:oppo_done") ? "File already assembled" : null} onClick={() => act((pl, rng) => researchOpponent(pl, rng, true))} />
          </div>
          <Button variant="gold" className="mt-2 w-full" disabled={!check.ok || annualUsed("campaign")} onClick={() => act((pl, rng) => runForOffice(pl, rng))}>🏛️ Launch Campaign</Button>
          {check.ok && annualUsed("campaign") && <div className="mt-1 text-xs text-rose-300">🔒 You've already stood for election this year.</div>}
          {tier > 0 && sc.highestTier >= 0 && <div className="mt-1 text-xs text-slate-500">Tenure in your current office: {officeYears(p)} years.</div>}
        </Card>
      )}

      {job && (
        <>
          <SectionTitle hint="effort matters: coasting costs approval">Governing</SectionTitle>
          <Card>
            <div className="grid grid-cols-1 gap-2">
              {ISSUES.filter((i) => (sc.stances[i.id] ?? 0) !== 0).map((issue) => (
                <ActionButton
                  key={issue.id}
                  label={`📜 Push "${issue.options[(sc.stances[issue.id] ?? 0) + 1]}" (${issue.name})`}
                  hint={`${Math.round(policyChance(p, issue.id) * 100)}% to pass · better with party standing, coalition and effort`}
                  reason={annualUsed("pol:policy") ? "Floor time used this year" : null}
                  onClick={() => act((pl, rng) => pushPolicy(pl, rng, issue.id))}
                />
              ))}
              {ISSUES.every((i) => (sc.stances[i.id] ?? 0) === 0) && <p className="text-xs text-slate-500">Take a position on an issue above to push legislation.</p>}
              <ActionButton label="🍽️ Build a Coalition" hint="Trade favours: +25% coalition" reason={annualUsed("pol:coalition") ? "Favours traded this year" : null} onClick={() => act((pl) => buildCoalition(pl))} />
              <ActionButton
                label={`✉️ Accept an envelope (~${money(kickbackAmount(p))})`}
                hint="Easy money. Corruption investigations start here."
                variant="danger"
                reason={annualUsed("pol:kickback") ? "One a year is plenty" : null}
                onClick={() => act((pl, rng) => takeKickback(pl, rng))}
              />
              <ActionButton label="👋 Step Down" hint="Leave on your own terms" variant="ghost" reason={null} onClick={() => act((pl) => retireFromOffice(pl))} />
            </div>
            {sc.bribes > 0 && <p className="mt-2 text-xs text-amber-300">You've pocketed {money(sc.bribes)} in total. Prosecutors can seize it and more.</p>}
          </Card>
        </>
      )}

      {!job && sc.highestTier >= 0 && (
        <>
          <SectionTitle hint="life after office">Beyond Politics</SectionTitle>
          <Card>
            <div className="grid grid-cols-1 gap-2">
              <ActionButton label={`🏢 Become a Lobbyist (~${money(Math.round(LOBBY_INCOME[Math.max(0, sc.highestTier)] * (0.5 + sc.machine / 100)))}/yr)`} hint="Lucrative, and an ethics scandal waiting to happen." reason={lobbyBlocker(p)} onClick={() => act((pl, rng) => takeRetirementPath(pl, rng, "lobbyist"))} />
              <ActionButton label={`🌐 Seek an Ambassadorship (${money(AMBASSADOR_PAY)}/yr)`} hint="Needs party standing 45+ and a governor-level past." reason={ambassadorBlocker(p)} onClick={() => act((pl, rng) => takeRetirementPath(pl, rng, "ambassador"))} />
              <ActionButton label={`📺 Become a Pundit (${money(PUNDIT_PAY)}/yr)`} hint="Fame 20+. Steady, visible, harmless." reason={punditBlocker(p)} onClick={() => act((pl, rng) => takeRetirementPath(pl, rng, "pundit"))} />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton label="📖 Memoir" hint="Sanitised" reason={memoirBlocker(p)} onClick={() => act((pl, rng) => politicalMemoir(pl, rng, false))} />
                <ActionButton label="💣 Tell-All Memoir" hint="+80% advance, burns bridges" variant="danger" reason={memoirBlocker(p)} onClick={() => act((pl, rng) => politicalMemoir(pl, rng, true))} />
              </div>
            </div>
          </Card>
        </>
      )}
      <p className="text-xs text-slate-500">Elections won {sc.electionsWon} · lost {sc.electionsLost}.Incumbents face voters every {TERM_YEARS} years, and a collapsing approval rating means recall or impeachment. Public office is full-time: coasting costs you approval, grinding costs your health and family.</p>
    </div>
  );
}
