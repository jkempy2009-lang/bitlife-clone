"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  MONETISATION,
  NICHES,
  NICHE_BY_ID,
  PLATFORMS,
  PLATFORM_BY_ID,
  acceptDeal,
  adIncome,
  appealBan,
  brandCollab,
  buyFollowers,
  creatorTier,
  declineDeal,
  goFullTimeCreator,
  launchMerch,
  maxDeals,
  merchCost,
  negotiateDeal,
  postContent,
  projectedGrowth,
  startChannel,
  stepBackCreator,
  switchFocus,
  takeBreak,
  toggleMemberships,
} from "@/engine/influencer";
import { fmtCount, hoursLabel, outputFor } from "@/engine/creativeCore";
import { blockerFor } from "@/engine/occupation";
import type { Platform } from "@/types/game.types";
import { Button, Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";
import { BigStat, CelebrityPanel, Choice, Row, money0 } from "./creativeUi";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="text-xs text-slate-500">Your growth chart appears after your first full year.</p>;
  const shown = values.slice(-24);
  const max = Math.max(...shown, 1);
  return (
    <div className="flex h-14 items-end gap-0.5" role="img" aria-label="Follower history by year">
      {shown.map((v, i) => (
        <div key={i} className="flex-1 rounded-t bg-pink-500/80" style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}

function Onboarding() {
  const { player: p, act } = useGame();
  const [platform, setPlatform] = useState<Platform>("video");
  const [niche, setNiche] = useState("lifestyle");
  const young = p.age < 10;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <h4 className="mb-1 font-bold">Become a creator</h4>
        <p className="mb-2 text-sm text-slate-300">
          Grow an audience, then turn it into income through ads, sponsors, memberships and merch. It starts as a side hustle squeezed around work or school. Once the channel can pay the bills you can go full-time, but that means quitting your job, and you carry every bill yourself.
        </p>
        <ul className="mb-1 list-disc space-y-0.5 pl-5 text-xs text-slate-400">
          <li>Growth depends on your free hours, effort setting, talent in your niche and how consistently you post.</li>
          <li>Burnout, scandals, algorithm shake-ups and bans can all cost you the audience.</li>
          <li>Sponsors pay well but oblige you to keep output up and spend your authenticity.</li>
        </ul>
      </Card>
      <SectionTitle>Pick a platform</SectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PLATFORMS.map((x) => (
          <Choice key={x.id} selected={platform === x.id} onClick={() => setPlatform(x.id)} title={`${x.emoji} ${x.label}`} hint={x.blurb} />
        ))}
      </div>
      <SectionTitle>Pick a niche</SectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {NICHES.map((x) => (
          <Choice key={x.id} selected={niche === x.id} onClick={() => setNiche(x.id)} title={`${x.emoji} ${x.label}`} hint={`${x.blurb} Leans on ${x.skill}.`} />
        ))}
      </div>
      <ActionButton
        variant="primary"
        label="📱 Launch your channel"
        reason={young ? "You need to be at least 10 years old." : null}
        onClick={() => act((pl, rng) => startChannel(pl, rng, { platform, niche }))}
      />
    </div>
  );
}

export function InfluencerSection() {
  const { player: p, act } = useGame();
  const inf = p.influencer;
  const [sPlatform, setSPlatform] = useState<Platform>(inf.platform);
  const [sNiche, setSNiche] = useState(inf.niche);

  if (!inf.active) {
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>Online Fame</SectionTitle>
        <Onboarding />
        <CelebrityPanel />
      </div>
    );
  }

  const plat = PLATFORM_BY_ID[inf.platform];
  const niche = NICHE_BY_ID[inf.niche];
  const output = outputFor(p, "creator");
  const banned = inf.bannedYears > 0;
  const growth = projectedGrowth(p);
  const ft = inf.fullTime;
  const trial = p.currentJob ? { ...p, currentJob: null } : p;
  const ftBlock = ft ? null : p.age < 16 ? "You must be 16 to make this your job." : blockerFor(trial, "creator");
  const hasJob = !!p.currentJob;
  const dealCap = maxDeals(inf.followers);
  const inc = inf.income;
  const gross = inc.ads + inc.deals + inc.subs + inc.merch;
  const net = gross - inc.costs;
  const swapChanged = sPlatform !== inf.platform || sNiche !== inf.niche;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint={creatorTier(inf.followers)}>Online Fame</SectionTitle>

      <Card>
        <BigStat label="Followers" value={fmtCount(inf.followers)} sub={`${plat.emoji} ${plat.label} · ${niche?.emoji ?? ""} ${niche?.label ?? inf.niche} · year ${inf.yearsActive + 1}`} />
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <Pill tone={ft ? "green" : "slate"}>{ft ? "Full-time creator" : "Part-time"}</Pill>
          {inf.onBreak && <Pill tone="blue">On hiatus</Pill>}
          {banned && <Pill tone="red">Banned {inf.bannedYears}y</Pill>}
          {inf.algorithm === "boost" && <Pill tone="green">Algorithm boost</Pill>}
          {inf.algorithm === "suppress" && <Pill tone="red">Suppressed</Pill>}
          {inf.premium && <Pill tone="amber">{fmtCount(inf.subscribers)} members</Pill>}
          {inf.merch && <Pill tone="amber">Merch</Pill>}
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">{hoursLabel(p, "creator")} · output {Math.round(output * 100)}%</p>
      </Card>

      {banned && <Banner tone="red">Your channel is suspended for {inf.bannedYears} more year{inf.bannedYears > 1 ? "s" : ""}. No growth, no brand deals and no ad income until it is reinstated.</Banner>}
      {inf.algorithm !== "neutral" && !banned && (
        <Banner tone={inf.algorithm === "boost" ? "green" : "amber"}>
          {inf.algorithm === "boost" ? "The algorithm is pushing you hard right now." : "The algorithm has turned against you."} It lasts about {inf.algoYears} more year{inf.algoYears === 1 ? "" : "s"}.
        </Banner>
      )}
      {inf.burnout >= 70 && <Banner tone="red">You are burning out. Take a hiatus before it costs you your health and your audience.</Banner>}
      {inf.trend && inf.trend !== inf.niche && NICHE_BY_ID[inf.trend] && (
        <Banner tone="blue">Trending on the platform: {NICHE_BY_ID[inf.trend].emoji} {NICHE_BY_ID[inf.trend].label}.</Banner>
      )}

      <Card>
        <div className="grid grid-cols-1 gap-2">
          <Meter label="Engagement (audience quality)" value={inf.engagement} tone={inf.engagement > 55 ? "green" : inf.engagement > 30 ? "amber" : "red"} />
          <Meter label="Authenticity (trust)" value={inf.authenticity} tone={inf.authenticity > 55 ? "green" : inf.authenticity > 30 ? "amber" : "red"} />
          <Meter label="Craft (skill at content)" value={inf.craft} tone="blue" />
          <Meter label="Posting cadence" value={inf.cadence} tone={inf.cadence > 50 ? "green" : "amber"} />
          <Meter label="Burnout" value={inf.burnout} tone={inf.burnout > 60 ? "red" : inf.burnout > 35 ? "amber" : "green"} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Expected growth this year: about {growth >= 0 ? "+" : ""}{fmtCount(Math.round(growth))} followers.</p>
      </Card>

      <SectionTitle>Growth</SectionTitle>
      <Card>
        <Sparkline values={inf.followerHistory} />
        <div className="mt-2">
          <Row label="Peak followers" value={fmtCount(inf.peakFollowers)} />
          <Row label="Viral hits" value={inf.viralHits} />
          <Row label="Years creating" value={inf.yearsActive} />
        </div>
      </Card>

      <SectionTitle>Finances</SectionTitle>
      <Card>
        <Row label="Ad revenue (last year)" value={money0(inc.ads)} />
        <Row label="Sponsorships" value={money0(inc.deals)} />
        <Row label="Memberships" value={money0(inc.subs)} />
        <Row label="Merch" value={money0(inc.merch)} />
        <Row label="Costs" value={`-${money0(inc.costs)}`} tone="bad" />
        <Row label="Net last year" value={money0(net)} tone={net >= 0 ? "good" : "bad"} />
        <Row label="Lifetime earnings" value={money0(inf.lifetimeEarnings)} />
        <p className="mt-1 text-xs text-slate-500">
          Ads need {MONETISATION.ads.toLocaleString()} followers (projected {money0(adIncome(p))}/yr now). Sponsors {MONETISATION.deals.toLocaleString()}, memberships {MONETISATION.premium.toLocaleString()}, merch {MONETISATION.merch.toLocaleString()}.
        </p>
      </Card>

      {inf.offers.length > 0 && (
        <>
          <SectionTitle hint="expire when you age up">Brand Offers</SectionTitle>
          <div className="flex flex-col gap-2">
            {inf.offers.map((o) => {
              const full = inf.deals.length >= dealCap;
              const pushed = (p.annual[`haggle:${o.id}`] ?? 0) >= 1;
              const short = output < o.minOutput;
              return (
                <Card key={o.id} className={o.shady ? "border-amber-700/60" : ""}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{o.brand}</div>
                      <div className="text-xs text-slate-400">{o.yearsLeft} year{o.yearsLeft > 1 ? "s" : ""} · needs {Math.round(o.minOutput * 100)}% output · authenticity -{o.authCost}/yr</div>
                    </div>
                    <div className="text-right font-bold tabular-nums text-emerald-300">{money0(o.pay)}/yr</div>
                  </div>
                  {o.shady && <p className="mt-1 text-xs text-amber-300">Shady product. It pays extra, but your audience will not forgive it easily.</p>}
                  {short && <p className="mt-1 text-xs text-rose-300">Your current output ({Math.round(output * 100)}%) is below what this needs. You risk breaching the contract.</p>}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <ActionButton variant="primary" label="Sign" reason={full ? `Limit ${dealCap}` : null} onClick={() => act((pl) => acceptDeal(pl, o.id))} />
                    <ActionButton label="Haggle" reason={pushed ? "Tried" : full ? `Limit ${dealCap}` : null} hint="+25%, may walk" onClick={() => act((pl, rng) => negotiateDeal(pl, rng, o.id))} />
                    <ActionButton variant="ghost" label="Decline" onClick={() => act((pl) => declineDeal(pl, o.id))} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {inf.deals.length > 0 && (
        <>
          <SectionTitle hint={`${inf.deals.length}/${dealCap} slots`}>Active Contracts</SectionTitle>
          <div className="flex flex-col gap-2">
            {inf.deals.map((d) => (
              <Card key={d.id} className="p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{d.brand}</span>
                  <span className="tabular-nums text-emerald-300">{money0(d.pay)}/yr</span>
                </div>
                <div className="text-xs text-slate-400">{d.yearsLeft} year{d.yearsLeft > 1 ? "s" : ""} left · output {Math.round(d.minOutput * 100)}% needed{d.shady ? " · shady" : ""}</div>
                {output < d.minOutput && <div className="text-xs text-rose-300">You are under the required output. Expect a breach penalty.</div>}
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Decisions</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-3">
          <ActionButton
            variant="primary"
            label="🎥 Flagship content"
            hint="Big growth chance, small viral chance. +6 burnout. Once a year."
            reason={banned ? "Channel suspended" : (p.annual.post ?? 0) >= 1 ? "Already posted a flagship this year" : null}
            onClick={() => act((pl, rng) => postContent(pl, rng))}
          />
          <ActionButton
            variant="gold"
            label="🤝 One-off sponsored post"
            hint="Quick cash for -2 authenticity (about 5% of followers in pay, taxed). Once a year."
            reason={banned ? "Channel suspended" : inf.followers < MONETISATION.deals ? `Needs ${MONETISATION.deals.toLocaleString()} followers` : (p.annual.collab ?? 0) >= 1 ? "Already done this year" : null}
            onClick={() => act((pl) => brandCollab(pl))}
          />
          <ActionButton
            label={inf.onBreak ? "🏖️ On hiatus this year" : "🏖️ Take a hiatus"}
            hint="Burnout -30 and +4 happiness, but output stalls and the audience drifts."
            reason={inf.onBreak ? "Already resting" : null}
            onClick={() => act((pl) => takeBreak(pl))}
          />
          {ft ? (
            <ActionButton label="Step back to part-time" hint="Frees you to take a job again, at the cost of output." onClick={() => act((pl) => stepBackCreator(pl))} />
          ) : (
            <>
              <ActionButton
                variant="primary"
                label="Go full-time as a creator"
                hint="Full output, but no salary. Only sensible once the channel pays."
                reason={hasJob ? "Quit your job first (or use the button below)" : ftBlock}
                onClick={() => act((pl) => goFullTimeCreator(pl))}
              />
              {hasJob && (
                <ActionButton
                  variant="danger"
                  label={`Quit as ${p.currentJob?.title} and go full-time`}
                  hint="You give up your salary immediately."
                  reason={ftBlock}
                  onClick={() => act((pl) => goFullTimeCreator(pl, true))}
                />
              )}
            </>
          )}
          <ActionButton
            label={inf.merch ? "🛍️ Merch line is live" : `🛍️ Launch merch (${money0(merchCost(p))})`}
            hint="Yearly sales scale with audience loyalty."
            reason={inf.merch ? "Already launched" : inf.followers < MONETISATION.merch ? `Needs ${MONETISATION.merch.toLocaleString()} followers` : p.bankBalance < merchCost(p) ? `Needs ${money0(merchCost(p))}` : null}
            onClick={() => act((pl) => launchMerch(pl))}
          />
          <ActionButton
            label={inf.premium ? "Close paid memberships" : "⭐ Open paid memberships"}
            hint="Steady subscriber income, but they expect exclusive content."
            reason={!inf.premium && inf.followers < MONETISATION.premium ? `Needs ${MONETISATION.premium.toLocaleString()} followers` : null}
            onClick={() => act((pl) => toggleMemberships(pl))}
          />
          <ActionButton
            variant="danger"
            label={`🤖 Buy followers (${money0(300 + Math.round(inf.followers * 0.03))})`}
            hint="+25% followers, but engagement -18, authenticity -10 and a 22% chance of a scandal."
            reason={inf.followers < 500 ? "Needs 500 real followers to hide among" : (p.annual.buy ?? 0) >= 1 ? "Already bought this year" : p.bankBalance < 300 + Math.round(inf.followers * 0.03) ? "Can't afford it" : null}
            onClick={() => act((pl, rng) => buyFollowers(pl, rng))}
          />
          {banned && (
            <ActionButton
              variant="gold"
              label="⚖️ Appeal the ban ($1,500)"
              hint="Better odds with high authenticity."
              reason={(p.annual.appeal ?? 0) >= 1 ? "Already appealed this year" : p.bankBalance < 1_500 ? "Needs $1,500" : null}
              onClick={() => act((pl, rng) => appealBan(pl, rng))}
            />
          )}
        </div>
      </Card>

      <SectionTitle hint="costs followers and engagement">Rebrand</SectionTitle>
      <Card>
        <p className="mb-2 text-xs text-slate-400">Changing platform loses about half your audience, a new niche about 40%, both about 70%. Craft and engagement dip while you adjust.</p>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {PLATFORMS.map((x) => <Choice key={x.id} selected={sPlatform === x.id} onClick={() => setSPlatform(x.id)} title={`${x.emoji} ${x.label}`} />)}
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {NICHES.map((x) => <Choice key={x.id} selected={sNiche === x.id} onClick={() => setSNiche(x.id)} title={`${x.emoji} ${x.label}`} />)}
        </div>
        <Button
          variant="secondary"
          className="w-full"
          disabled={!swapChanged || (p.annual.switch ?? 0) >= 1}
          onClick={() => act((pl, rng) => switchFocus(pl, rng, { platform: sPlatform, niche: sNiche }))}
        >
          {(p.annual.switch ?? 0) >= 1 ? "Already rebranded this year" : swapChanged ? "Rebrand now" : "Pick something different"}
        </Button>
      </Card>

      <CelebrityPanel />
    </div>
  );
}
