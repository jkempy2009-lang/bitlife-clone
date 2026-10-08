"use client";

import { useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { CAREER_LINES } from "@/data/careersRegistry";
import {
  FAMOUS_FAME,
  FILM_GENRES,
  PRODUCE_TIERS,
  acceptOffer,
  actingTier,
  auditionBlocker,
  auditionChance,
  auditionForLead,
  auditionLimit,
  bookCampaign,
  buyOutStudioDeal,
  declineOffer,
  isActor,
  isModel,
  produceBlocker,
  produceFilm,
  shootCommercial,
  signStudioDeal,
  writeMemoir,
  type ProduceTier,
} from "@/engine/acting";
import { applyForJob, jobEligibility, quitJob } from "@/engine/career";
import { MEDIUM_LABEL } from "@/engine/actingShared";
import { money } from "@/lib/format";
import { Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";
import { BigStat, CelebrityPanel, Choice, Row, money0 } from "./creativeUi";
import {
  AwardsPanel, CallbackCard, CareerSummaryCard, Filmography, FranchisePanel, LadderCard, ProductionPanel, RepresentationPanel, SeriesPanel, SideWorkPanel,
} from "./ActingPanels";

export function MovieStarSection() {
  const { player: p, act } = useGame();
  const [genre, setGenre] = useState<string>(p.acting.typecast ?? "Drama");
  const [tier, setTier] = useState<ProduceTier>("indie");
  const a = p.acting;
  const job = isActor(p) || isModel(p) ? p.currentJob! : null;
  const actor = isActor(p);
  const model = isModel(p);
  const actorLine = CAREER_LINES.find((l) => l.id === "actor")!;
  const modelLine = CAREER_LINES.find((l) => l.id === "model")!;
  const famous = p.fame >= FAMOUS_FAME;
  const hasHistory = a.credits.length > 0 || a.modelBookings > 0;

  // ---------------- Not in the business ----------------
  if (!job && !hasHistory) {
    const ea = jobEligibility(p, actorLine);
    const em = jobEligibility(p, modelLine);
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>Stage and Screen</SectionTitle>
        <Card>
          <h4 className="mb-1 font-bold">Break into show business</h4>
          <p className="mb-2 text-sm text-slate-300">
            Acting and modelling are real jobs. You start at the bottom as a background actor or a junior model. Climb by auditioning, building credits and an industry reputation, and signing with an agent (and perhaps a manager) who take a cut of your fees.
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">
            <li>It is a full-time job, so it replaces any other job you hold. You can quit from the Work tab or the button here.</li>
            <li>Films, plays and TV seasons come out when you age up. Auditions lead to call-backs; a TV contract or franchise locks you in for years. Flops hurt your pull and reputation, hits and awards lift them.</li>
            <li>Repeating one genre gets you typecast. Looks matter, and the industry is not kind to the ageing.</li>
            <li>Later you can produce or direct films with your own money and write a memoir.</li>
          </ul>
        </Card>
        <Card>
          <div className="grid grid-cols-1 gap-3">
            <ActionButton
              variant="primary"
              label="🎬 Become a background actor"
              hint={actorLine.blurb}
              reason={!ea.ok ? ea.reason ?? "Not eligible" : (p.annual["apply:actor"] ?? 0) >= 1 ? "Already applied this year" : null}
              onClick={() => act((pl, rng) => applyForJob(pl, "actor", rng))}
            />
            <ActionButton
              variant="primary"
              label="📸 Become a model"
              hint={modelLine.blurb}
              reason={!em.ok ? em.reason ?? "Not eligible" : (p.annual["apply:model"] ?? 0) >= 1 ? "Already applied this year" : null}
              onClick={() => act((pl, rng) => applyForJob(pl, "model", rng))}
            />
          </div>
        </Card>
        <CelebrityPanel />
      </div>
    );
  }

  const blocker = actor ? auditionBlocker(p) : null;
  const limit = auditionLimit(p);
  const used = p.annual.audition ?? 0;
  const chance = actor ? auditionChance(p, genre) : 0;
  const inc = a.lastIncome;
  const netLast = inc.fees + inc.series + inc.residuals + inc.bonuses - inc.agent;
  const studio = a.studioDeal;
  const signReason = !actor || !job ? "Only working actors sign studio deals."
    : job.tier < 1 ? "Studios sign supporting actors and above."
    : a.reputation < 30 ? "Needs industry reputation 30+."
    : a.pendingFilm ? "Finish the film you're making first."
    : null;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint={actingTier(p)}>Stage and Screen</SectionTitle>

      <Card>
        <BigStat label={job ? job.title : "Former performer"} value={`${p.fame} fame`} sub={job ? `${job.company} · ${money0(job.salary)}/yr` : `${a.credits.length} film credit${a.credits.length === 1 ? "" : "s"}`} />
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {a.agent ? <Pill tone="green">Agent: {a.agent.name}</Pill> : <Pill tone="slate">No agent</Pill>}
          {a.typecast && <Pill tone="amber">Typecast: {a.typecast}</Pill>}
          {a.manager && <Pill tone="green">Manager: {a.manager.name}</Pill>}
          {studio && <Pill tone="blue">{studio.studio} deal</Pill>}
          {a.series && <Pill tone="blue">📺 {a.series.title}</Pill>}
          {a.franchise && <Pill tone="blue">Saga: {a.franchise.name}</Pill>}
          {a.rejections >= 3 && <Pill tone="red">{a.rejections} rejections in a row</Pill>}
          {a.awards.length > 0 && <Pill tone="amber">🏆 {a.awards.length}</Pill>}
        </div>
      </Card>

      {a.pendingFilm && (
        <Banner tone="blue">
          🎞️ {a.pendingFilm.medium === "stage" ? "Rehearsing" : "Shooting"} &quot;{a.pendingFilm.title}&quot; ({a.pendingFilm.genre}, {a.pendingFilm.role}{a.pendingFilm.method ? ", method" : ""}). {money0(a.pendingFilm.budget)} budget{a.pendingFilm.invested ? `, with ${money0(a.pendingFilm.invested)} of your own money riding on it` : ""}. It will be released when you age up.
        </Banner>
      )}
      {a.yearsSinceWork >= 2 && job && <Banner tone="amber">{a.yearsSinceWork} years without screen work. Your reputation is slipping.</Banner>}
      {!job && <Banner tone="blue">You no longer have a performing job. Reapply to start working again; your credits and reputation stay.</Banner>}

      <Card>
        <div className="grid grid-cols-1 gap-2">
          {job && <Meter label="Performance in role" value={job.performance} tone="green" />}
          <Meter label="Industry reputation" value={a.reputation} tone={a.reputation > 50 ? "green" : "amber"} />
          <Meter label="Critical acclaim" value={a.critics} tone={a.critics > 50 ? "green" : "amber"} />
          <Meter label="Box-office pull" value={a.pull} tone="blue" />
          <Meter label="Acting skill" value={p.skills.acting} tone="blue" />
          <Meter label="Looks" value={p.looks} tone="blue" />
        </div>
        <div className="mt-2">
          <Row label="Nominations" value={a.nominations} />
          <Row label="Modelling bookings" value={a.modelBookings} />
        </div>
        {a.awards.length > 0 && <p className="mt-1 text-xs text-amber-300">🏆 {a.awards.join(", ")}</p>}
      </Card>

      <LadderCard />

      <SectionTitle>Finances</SectionTitle>
      <Card>
        <Row label="Salary (retainer)" value={job ? `${money0(job.salary)}/yr` : "none"} />
        <Row label="Film and stage fees (last year)" value={money0(inc.fees)} />
        <Row label="Television seasons" value={money0(inc.series)} />
        <Row label="Bonuses and box-office share" value={money0(inc.bonuses)} />
        <Row label="Residuals" value={money0(inc.residuals)} />
        <Row label="Agent and manager cuts" value={`-${money0(inc.agent)}`} tone="bad" />
        <Row label="Net extra income last year" value={money0(netLast)} tone={netLast >= 0 ? "good" : "bad"} />
        <Row label="Lifetime screen earnings" value={money0(a.earnings)} />
        {a.residuals.length > 0 && <p className="mt-1 text-xs text-slate-500">{a.residuals.length} residual stream{a.residuals.length === 1 ? "" : "s"} still paying, about {money0(a.residuals.reduce((t, r) => t + r.amount, 0))} a year. Everything above is before tax. Guild minimums apply to every contract.</p>}
      </Card>

      <CallbackCard />
      <FranchisePanel />
      <SeriesPanel />

      {a.offers.length > 0 && (
        <>
          <SectionTitle hint="expire when you age up">Film Offers</SectionTitle>
          <div className="flex flex-col gap-2">
            {a.offers.map((o) => {
              const reason = a.pendingFilm ? "Already committed to a film" : studio ? "Your studio deal covers your film work" : a.franchise ? "Your franchise covers your film work" : a.series ? "Your series contract is exclusive" : null;
              const pushed = (p.annual[`haggle:${o.id}`] ?? 0) >= 1;
              return (
                <Card key={o.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{o.medium === "tv" ? "📺" : o.medium === "stage" ? "🎭" : "🎬"} {o.title}</div>
                      <div className="text-xs text-slate-400">{MEDIUM_LABEL[o.medium ?? "film"]} · {o.genre} · {o.role}{o.medium === "tv" ? ` · ${o.seasons} seasons guaranteed` : ` · ${money0(o.budget)} budget`}</div>
                    </div>
                    <div className="text-right font-bold tabular-nums text-emerald-300">{money0(o.fee)}{o.medium === "tv" && <div className="text-[10px] font-normal text-slate-500">per season</div>}</div>
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    <Pill tone={o.script >= 65 ? "green" : o.script >= 45 ? "amber" : "red"}>Script {o.script}</Pill>
                    <Pill tone={o.prestige >= 65 ? "green" : "slate"}>Prestige {o.prestige}</Pill>
                    {a.typecast && a.typecast !== o.genre && <Pill tone="blue">Breaks typecast</Pill>}
                    {o.comeback && <Pill tone="amber">Comeback</Pill>}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <ActionButton variant="primary" label="Accept" reason={reason} onClick={() => act((pl, rng) => acceptOffer(pl, rng, o.id))} />
                    <ActionButton label="Haggle" hint="+25%, may be pulled" reason={reason ?? (pushed ? "Tried" : null)} onClick={() => act((pl, rng) => acceptOffer(pl, rng, o.id, true))} />
                    <ActionButton variant="ghost" label="Pass" onClick={() => act((pl) => declineOffer(pl, o.id))} />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <RepresentationPanel />

      {actor && job && (
        <>
          <SectionTitle hint={`${used}/${limit} auditions this year`}>Auditions</SectionTitle>
          <Card>
            <p className="mb-2 text-xs text-slate-400">Pick the genre to audition in. Your typecasting helps in your usual genre and hurts elsewhere, but breaking out impresses critics. A good read earns a call-back, and a good call-back earns a promotion and a film to shoot. Rejection streaks wear you down.</p>
            <div className="mb-2 grid grid-cols-2 gap-2">
              {FILM_GENRES.map((g) => <Choice key={g} selected={genre === g} onClick={() => setGenre(g)} title={g} hint={a.typecast === g ? "your typecast" : undefined} />)}
            </div>
            <ActionButton
              variant="gold"
              label="🎭 Audition for a bigger role"
              hint={`About ${Math.round(chance * 100)}% odds in ${genre.toLowerCase()}. Next step: ${job.tier >= 2 ? "franchise lead" : job.tier === 1 ? "lead role" : "supporting role"}.`}
              reason={blocker}
              onClick={() => act((pl, rng) => auditionForLead(pl, rng, genre))}
            />
          </Card>

          <ProductionPanel />
          <AwardsPanel />

          <SectionTitle>Studio Contract</SectionTitle>
          <Card>
            {studio ? (
              <>
                <Row label="Studio" value={studio.studio} />
                <Row label="Genre they choose" value={studio.genre} />
                <Row label="Fee per film" value={money0(studio.fee)} />
                <Row label="Years left" value={studio.yearsLeft} />
                <ActionButton
                  className="mt-2"
                  variant="danger"
                  label={`Buy out contract (${money0(Math.round(studio.fee * studio.yearsLeft * 0.5))})`}
                  hint="Frees you to take any film offer."
                  reason={p.bankBalance < Math.round(studio.fee * studio.yearsLeft * 0.5) ? "Can't afford it" : null}
                  onClick={() => act((pl) => buyOutStudioDeal(pl))}
                />
              </>
            ) : (
              <ActionButton
                label="🖋️ Sign a three-picture studio deal"
                hint="Steady money: one film a year in a genre they choose. You lose control of your roles."
                reason={signReason ?? (a.series ? "Your series contract is exclusive." : a.franchise ? "Your franchise contract covers your film work." : null)}
                onClick={() => act((pl, rng) => signStudioDeal(pl, rng))}
              />
            )}
          </Card>

          <SideWorkPanel />
        </>
      )}

      {model && (
        <>
          <SectionTitle>Modelling</SectionTitle>
          <Card>
            <ActionButton
              variant="primary"
              label="📸 Book a campaign"
              hint="15–35% of your salary in one shoot, +1–2 fame. Small scandal risk. Once a year."
              reason={(p.annual.campaign ?? 0) >= 1 ? "Already shot a campaign this year" : null}
              onClick={() => act((pl, rng) => bookCampaign(pl, rng))}
            />
            <p className="mt-2 text-xs text-slate-500">Modelling careers fade with age. You can also act: quit modelling and apply for acting work.</p>
          </Card>
        </>
      )}

      <SectionTitle hint={famous ? "unlocked" : `unlocks at ${FAMOUS_FAME} fame`}>Celebrity Activities</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-3">
          <ActionButton
            variant="primary"
            label={`📺 Shoot a commercial (≈${money0(20_000 + p.fame * 1_000)}, +5 fame)`}
            reason={!famous ? `Needs ${FAMOUS_FAME} fame` : (p.annual.commercial ?? 0) >= 1 ? "Already shot one this year" : null}
            onClick={() => act((pl) => shootCommercial(pl))}
          />
          <ActionButton
            variant="primary"
            label={`📖 Write a memoir (≈${money0(p.fame * 25_000)})`}
            reason={!famous ? `Needs ${FAMOUS_FAME} fame` : (p.annual.memoir ?? 0) >= 1 ? "Already wrote one this year" : null}
            onClick={() => act((pl, rng) => writeMemoir(pl, rng))}
          />
        </div>
      </Card>

      <SectionTitle hint="your own money at stake">Produce or Direct</SectionTitle>
      <Card>
        <p className="mb-2 text-xs text-slate-400">Finance a picture yourself. You need screen credits, fame and the full budget in the bank. A hit pays handsomely, a flop can ruin you. Directing needs 5+ credits and 50+ critical acclaim.</p>
        <div className="mb-3 grid grid-cols-1 gap-2">
          {PRODUCE_TIERS.map((t) => <Choice key={t.id} selected={tier === t.id} onClick={() => setTier(t.id)} title={`${t.label} · ${money(t.cost)}`} hint={t.blurb} />)}
        </div>
        <div className="grid grid-cols-1 gap-2">
          <ActionButton
            variant="gold"
            label="🎥 Produce it"
            hint={`Needs 3+ credits, 30+ fame, age 25+.`}
            reason={produceBlocker(p, tier, false)}
            onClick={() => act((pl, rng) => produceFilm(pl, rng, tier, false))}
          />
          <ActionButton
            variant="gold"
            label="🎬 Produce and direct it"
            hint="A better film if you have the craft."
            reason={produceBlocker(p, tier, true)}
            onClick={() => act((pl, rng) => produceFilm(pl, rng, tier, true))}
          />
        </div>
      </Card>

      <CareerSummaryCard />
      <Filmography />

      {job && (
        <ActionButton variant="ghost" label="Quit performing" hint="Leave the industry. Your credits stay on your record." onClick={() => act((pl) => quitJob(pl))} />
      )}

      <CelebrityPanel />
    </div>
  );
}
