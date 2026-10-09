"use client";

import { BandDepth, RightsDepth, TourSettings } from "./MusicDepth";
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { MUSIC_GENRES } from "@/data/careersRegistry";
import { fmtCount, hoursLabel, outputFor } from "@/engine/creativeCore";
import {
  DIRECTIONS,
  MAX_MEMBERS,
  PRODUCERS,
  auditionContract,
  auditionRating,
  bandSkill,
  chemistry,
  dismissMember,
  formBand,
  goOnTour,
  isOneHitWonder,
  leaveLabel,
  musicTier,
  playerShare,
  practiceMusic,
  qualityEstimate,
  recordAlbum,
  recordDemo,
  recruitMember,
  renegotiateContract,
  startSolo,
  takeMusicBreak,
  teamNight,
  toggleManager,
  tourOptions,
  writeSongs,
} from "@/engine/music";
import { blockerFor } from "@/engine/occupation";
import { money } from "@/lib/format";
import { Button, Card, Pill, SectionTitle } from "../ui";
import { ActionButton, Banner, Meter } from "./shared";
import { BigStat, CelebrityPanel, Choice, Row, money0 } from "./creativeUi";

function RhythmCheck({ onScore }: { onScore: (score: number) => void }) {
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [score, setScore] = useState<number | null>(null);
  const tapsRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setRunning(false);
          const s = Math.min(100, tapsRef.current * 5);
          setScore(s);
          onScore(s);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, onScore]);

  const start = () => {
    tapsRef.current = 0;
    setTaps(0);
    setTimeLeft(5);
    setScore(null);
    setRunning(true);
  };

  return (
    <div className="rounded-xl bg-slate-900/60 p-3">
      <div className="mb-2 text-sm font-semibold">🥁 Rhythm Check</div>
      {!running ? (
        <>
          <p className="mb-2 text-xs text-slate-400">Tap the drum as fast as you can for 5 seconds (20 taps = perfect). It feeds your band formation and label audition. {score !== null && <strong className="text-amber-300">Last score: {score}</strong>}</p>
          <Button variant="secondary" className="w-full" onClick={start}>Start</Button>
        </>
      ) : (
        <>
          <div className="mb-2 flex justify-between text-sm tabular-nums"><span>⏱ {timeLeft}s</span><span>Taps: {taps}</span></div>
          <button
            type="button"
            onPointerDown={() => {
              tapsRef.current += 1;
              setTaps(tapsRef.current);
            }}
            className="h-24 w-full select-none rounded-2xl bg-amber-500 text-4xl font-bold text-slate-900 active:scale-95 active:bg-amber-400"
          >
            🥁 TAP
          </button>
        </>
      )}
    </div>
  );
}

const ratingTone = (r: string) => (r === "Flop" ? "red" : r === "Diamond" || r === "Platinum" || r === "Gold" ? "amber" : "green");

export function MusicSection() {
  const { player: p, act } = useGame();
  const [tap, setTap] = useState(0);
  const [genre, setGenre] = useState<string>(p.music.genre || MUSIC_GENRES[0]);
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState<string>("local");
  const [direction, setDirection] = useState<"commercial" | "balanced" | "artistic">("balanced");
  const [pace, setPace] = useState<"light" | "standard" | "punishing">("standard");
  const [mode, setMode] = useState<"headline" | "support">("headline");
  const m = p.music;
  const c = m.contract;
  const inScene = m.status !== "none" || m.signed;

  // ---------------- Not a musician yet ----------------
  if (!inScene && m.albums.length === 0) {
    const bandBlock = p.age < 14 ? "You must be 14 to start a band." : (p.annual.audition_music ?? 0) >= 1 ? "Your bandmates are tired out. Try next year." : null;
    return (
      <div className="flex flex-col gap-3">
        <SectionTitle>Music</SectionTitle>
        <Card>
          <h4 className="mb-1 font-bold">Chase a music career</h4>
          <p className="mb-2 text-sm text-slate-300">
            Start in the scene as a solo act or a band. Practise, write songs, record demos and gig to build local fame. Record labels only notice acts with buzz and a decent demo, and they only sign people 18 or older.
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-400">
            <li>Unsigned, you can fit music around a job or school, gigging a little each year.</li>
            <li>A record deal is a full-time commitment. It blocks jobs, businesses and office, and the label fronts costs you repay from royalties.</li>
            <li>Albums, tours, relevance, burnout, writer&apos;s block and band drama all shape how far you go.</li>
          </ul>
        </Card>
        <Card>
          <div className="mb-3 grid grid-cols-1 gap-2">
            <ActionButton variant="primary" label="🎤 Go solo" hint="Open mics and house parties. Needs age 14." reason={p.age < 14 ? "You must be 14 to perform." : null} onClick={() => act((pl) => startSolo(pl))} />
          </div>
          <RhythmCheck onScore={setTap} />
          <div className="mt-3">
            <ActionButton
              variant="primary"
              label="👥 Form a band"
              hint={`Needs music skill × 0.6 + beat score × 0.6 of at least 40. Yours now: ${Math.round(p.skills.music * 0.6 + tap * 0.6)}.`}
              reason={bandBlock}
              onClick={() => act((pl, rng) => formBand(pl, tap, rng))}
            />
          </div>
        </Card>
        <ActionButton label="🎸 Practise first" hint="+3–6 music skill, once a year." reason={(p.annual.practice ?? 0) >= 1 ? "Done this year" : null} onClick={() => act((pl, rng) => practiceMusic(pl, rng))} />
        <CelebrityPanel />
      </div>
    );
  }

  // ---------------- In the scene ----------------
  const signed = m.signed;
  const signBlock = blockerFor(p, "music");
  const auditionUsed = (p.annual.audition_music ?? 0) >= 1;
  const auditionReason = (kind: "solo" | "band") =>
    p.age < 18 ? "Labels only sign artists 18 and over."
      : signBlock ?? (auditionUsed ? "Already auditioned this year." : kind === "band" && m.status !== "band" ? "Form a band first." : null);
  const studioBusy = !!m.pendingAlbum || (p.annual.album ?? 0) >= 1;
  const toured = (p.annual.tour ?? 0) >= 1;
  const prod = PRODUCERS.find((x) => x.id === producer) ?? PRODUCERS[1];
  const dir = DIRECTIONS.find((x) => x.id === direction)!;
  const indie = !signed;
  const albumCost = prod.cost + (indie ? 2_000 : 0);
  const forcedCommercial = !!c && direction !== "commercial" && c.creativeControl < 40;
  const estimate = qualityEstimate(p, producer, forcedCommercial ? "commercial" : direction);
  const albumReason = m.blockYears > 0
    ? "Writer's block. Write songs, rest or take a break."
    : toured ? "You toured this year. Studio year or touring year."
    : studioBusy ? "A record is already in the pipeline."
    : p.fame + (signed ? 15 : 0) < prod.minFame ? `${prod.label} wants ${prod.minFame}+ fame.`
    : indie && p.bankBalance < albumCost ? `Needs ${money0(albumCost)} to self-fund.`
    : null;
  const inc = m.lastIncome;
  const netLast = inc.gigs + inc.royalties + inc.stipend - inc.costs;
  const albumsOnLabel = c ? `${c.albumsDelivered}/${c.albumsOwed}` : "";
  const releasedUnderContract = c ? c.albumsDelivered >= c.albumsOwed : false;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle hint={m.status === "band" ? "band" : "solo"}>Music</SectionTitle>

      <Card>
        <BigStat label={musicTier(p)} value={`${fmtCount(m.fans)} fans`} sub={m.status === "band" ? `${m.bandName || "Your band"} · ${m.genre}` : `Solo artist · ${m.genre}`} />
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <Pill tone={signed ? "green" : "slate"}>{signed ? `Signed to ${c?.label ?? "a label"}` : "Unsigned"}</Pill>
          {m.manager && <Pill tone="blue">Manager</Pill>}
          {m.onBreak && <Pill tone="blue">On hiatus</Pill>}
          {m.blockYears > 0 && <Pill tone="red">Writer&apos;s block</Pill>}
          {isOneHitWonder(p) && <Pill tone="amber">One-hit wonder</Pill>}
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">{hoursLabel(p, "music")} · output {Math.round(outputFor(p, "music") * 100)}%</p>
      </Card>

      {m.burnout >= 70 && <Banner tone="red">You are burning out. Take a break before your health and your band pay for it.</Banner>}
      {m.relevance < 30 && <Banner tone="amber">Your sound is going stale (relevance {Math.round(m.relevance)}). A fresh album or a bold direction might bring you back.</Banner>}
      {signed && c && c.yearsLeft <= 1 && !releasedUnderContract && <Banner tone="amber">Your contract ends soon and you still owe {c.albumsOwed - c.albumsDelivered} album(s). Missing the target hurts your label standing.</Banner>}

      <Card>
        <div className="grid grid-cols-1 gap-2">
          <Meter label="Music skill" value={p.skills.music} tone="blue" />
          <Meter label="Songwriting" value={m.songwriting} tone="blue" />
          <Meter label="Local fame" value={m.localFame} tone={m.localFame > 40 ? "green" : "amber"} />
          <Meter label="Relevance" value={m.relevance} tone={m.relevance > 50 ? "green" : m.relevance > 25 ? "amber" : "red"} />
          <Meter label="Demo quality" value={m.demo} tone={m.demo > 55 ? "green" : "slate"} />
          <Meter label="Burnout" value={m.burnout} tone={m.burnout > 60 ? "red" : m.burnout > 35 ? "amber" : "green"} />
        </div>
        <div className="mt-2">
          <Row label="Hits" value={m.hits} />
          <Row label="Gigs played" value={m.gigs} />
          <Row label="Tours" value={m.tours} />
          <Row label="Years active" value={m.yearsActive} />
          {m.awards.length > 0 && <Row label="Awards" value={m.awards.length} />}
        </div>
        {m.awards.length > 0 && <p className="mt-1 text-xs text-amber-300">🏆 {m.awards.join(", ")}</p>}
      </Card>

      <SectionTitle>Finances</SectionTitle>
      <Card>
        <Row label="Gigs and tours (last year)" value={money0(inc.gigs)} />
        <Row label="Royalties" value={money0(inc.royalties)} />
        {signed && <Row label="Label stipend" value={money0(inc.stipend)} />}
        <Row label="Costs and cuts" value={`-${money0(inc.costs)}`} tone="bad" />
        <Row label="Net last year" value={money0(netLast)} tone={netLast >= 0 ? "good" : "bad"} />
        <Row label="Lifetime earnings" value={money0(m.earnings)} />
        {m.manager && <p className="mt-1 text-xs text-slate-500">Your manager takes 15% of everything.</p>}
      </Card>

      {signed && c && (
        <>
          <SectionTitle hint={`${c.yearsLeft}/${c.totalYears} years left`}>Record Contract</SectionTitle>
          <Card>
            <Row label="Label" value={c.label} />
            <Row label="Albums delivered" value={albumsOnLabel} />
            <Row label="Royalty rate" value={`${Math.round(c.royaltyRate * 100)}%`} />
            <Row label="Yearly stipend" value={money0(c.stipend)} />
            <Row label="Label takes from tours" value={`${Math.round(c.tourCut * 100)}%`} />
            <Row label="Unrecouped debt" value={money0(c.unrecouped)} tone={c.unrecouped > 0 ? "bad" : "good"} />
            <div className="mt-2 grid grid-cols-1 gap-2">
              <Meter label="Creative control" value={c.creativeControl} tone={c.creativeControl >= 40 ? "green" : "red"} />
              <Meter label="Label standing" value={m.labelStanding} tone={m.labelStanding >= 50 ? "green" : m.labelStanding >= 30 ? "amber" : "red"} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Advances, stipends and studio bills are fronted by the label. You see no royalties until they are earned back. Under 40 control the label overrules you and forces commercial records.</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <ActionButton
                label="🧑‍⚖️ Renegotiate terms"
                hint="Better rate, control and stipend if it works. A refusal costs label standing."
                reason={c.renegotiatedYear === p.year ? "Already tried this year" : null}
                onClick={() => act((pl, rng) => renegotiateContract(pl, rng))}
              />
              <ActionButton
                variant="danger"
                label="Leave the label"
                hint={c.yearsLeft > 0 ? "Breaking the contract early hands the label your masters and their royalties." : "Your catalogue keeps earning, the stipend stops."}
                onClick={() => act((pl) => leaveLabel(pl))}
              />
            </div>
          </Card>
        </>
      )}

      {m.status === "band" && (
        <>
          <SectionTitle hint={`chemistry ${chemistry(p)} · your share ${Math.round(playerShare(p) * 100)}%`}>The Band</SectionTitle>
          <div className="flex flex-col gap-2">
            {m.members.map((x) => (
              <Card key={x.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{x.name} <span className="font-normal text-slate-400">· {x.role}</span></div>
                    <div className="text-xs text-slate-400">Skill {x.skill} · loyalty {x.loyalty} · ego {x.ego}{x.partier ? " · partier" : ""}</div>
                  </div>
                  <Button variant="ghost" className="shrink-0 text-xs" onClick={() => act((pl) => dismissMember(pl, x.id))}>Dismiss</Button>
                </div>
                <div className="mt-1.5"><Meter label="Loyalty" value={x.loyalty} tone={x.loyalty > 55 ? "green" : x.loyalty > 35 ? "amber" : "red"} /></div>
              </Card>
            ))}
            <Row label="Band skill" value={Math.round(bandSkill(p))} />
            <div className="grid grid-cols-1 gap-2">
              <ActionButton
                label="➕ Audition a new member"
                hint="New players start with untested chemistry."
                reason={m.members.length >= MAX_MEMBERS ? `${MAX_MEMBERS} members is the cap` : (p.annual.recruit ?? 0) >= 1 ? "Already auditioned this year" : null}
                onClick={() => act((pl, rng) => recruitMember(pl, rng))}
              />
              <ActionButton
                label="🍕 Band night out ($400)"
                hint="+12 loyalty for everyone."
                reason={(p.annual.teamnight ?? 0) >= 1 ? "Already did this year" : p.bankBalance < 400 ? "Needs $400" : null}
                onClick={() => act((pl) => teamNight(pl))}
              />
            </div>
          </div>
        </>
      )}

      <SectionTitle>Build Your Craft</SectionTitle>
      <Card>
        <div className="grid grid-cols-1 gap-3">
          <ActionButton label="🎸 Practise" hint="+3–6 music skill, up to your natural talent ceiling." reason={(p.annual.practice ?? 0) >= 1 ? "Done this year" : null} onClick={() => act((pl, rng) => practiceMusic(pl, rng))} />
          <ActionButton label="📝 Write songs" hint="+3–6 songwriting. May cure writer's block." reason={p.age < 12 ? "Too young" : (p.annual.write ?? 0) >= 1 ? "Done this year" : null} onClick={() => act((pl, rng) => writeSongs(pl, rng))} />
          <ActionButton
            label="📼 Record a demo ($1,500)"
            hint={`Current demo ${m.demo}/100. Labels listen to it at audition, and it decays each year.`}
            reason={(p.annual.demo ?? 0) >= 1 ? "Already recorded this year" : p.bankBalance < 1_500 ? "Needs $1,500" : null}
            onClick={() => act((pl, rng) => recordDemo(pl, rng))}
          />
          <ActionButton
            label={m.manager ? "Fire your manager" : "🤵 Hire a manager"}
            hint="Takes 15% of earnings, opens doors, protects you from bad deals."
            reason={!m.manager && !signed && m.localFame < 25 ? "Needs 25+ local fame" : null}
            onClick={() => act((pl) => toggleManager(pl))}
          />
          <ActionButton
            label={m.onBreak ? "🏖️ On a break this year" : "🏖️ Take a year out"}
            hint="No gigs, burnout -30, +4 happiness. Your momentum will not wait."
            reason={m.onBreak ? "Already resting" : null}
            onClick={() => act((pl) => takeMusicBreak(pl))}
          />
          {!signed && m.status === "solo" && (
            <ActionButton label="👥 Form a band instead" hint="Uses the rhythm check score below." reason={p.age < 14 ? "Too young" : (p.annual.audition_music ?? 0) >= 1 ? "Try next year" : null} onClick={() => act((pl, rng) => formBand(pl, tap, rng))} />
          )}
        </div>
      </Card>

      {!signed && (
        <>
          <SectionTitle hint="age 18+">Get Signed</SectionTitle>
          <Card>
            <RhythmCheck onScore={setTap} />
            <p className="mt-2 text-xs text-slate-400">
              Beat score {tap}. Labels weigh local fame (35%), skill, demo, songwriting and fame, and they rarely take meetings with an act nobody has heard of. Your audition score today would be about {Math.round(auditionRating(p, m.status === "band" ? "band" : "solo", tap))} (solo needs 63, band 57).
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {m.status === "band" && (
                <ActionButton variant="gold" label="📝 Audition as a band" reason={auditionReason("band")} onClick={() => act((pl, rng) => auditionContract(pl, "band", tap, rng))} />
              )}
              <ActionButton variant="gold" label="🎤 Audition as a solo act" reason={auditionReason("solo")} onClick={() => act((pl, rng) => auditionContract(pl, "solo", tap, rng))} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Signing is a full-time commitment: you leave any job, and cannot run a business or hold office until you leave the label.</p>
          </Card>
        </>
      )}

      <SectionTitle hint={signed ? "label fronts the cost" : "self-funded"}>Record an Album</SectionTitle>
      <Card>
        {m.pendingAlbum ? (
          <p className="text-sm text-slate-300">💿 &quot;{m.pendingAlbum.title}&quot; ({m.pendingAlbum.genre}) is finished and will be released when you age up.</p>
        ) : (
          <>
            <label className="mb-1 block text-xs text-slate-400" htmlFor="genre">Genre</label>
            <select id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm">
              {MUSIC_GENRES.map((g) => <option key={g}>{g}</option>)}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={40}
              placeholder="Album title (optional)"
              className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Producer</div>
            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRODUCERS.map((x) => (
                <Choice key={x.id} selected={producer === x.id} onClick={() => setProducer(x.id)} title={`${x.label} · ${x.cost ? money(x.cost) : "free"}`} hint={`${x.blurb}${x.minFame ? ` Needs ${x.minFame}+ fame.` : ""}`} />
              ))}
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Direction</div>
            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DIRECTIONS.map((x) => (
                <Choice key={x.id} selected={direction === x.id} onClick={() => setDirection(x.id)} title={x.label} hint={x.blurb} />
              ))}
            </div>
            {forcedCommercial && <Banner tone="amber">Your creative control is under 40, so the label will overrule {dir.label.toLowerCase()} and demand a commercial record.</Banner>}
            <p className="my-2 text-xs text-slate-400">Estimated quality {estimate}/100. Total cost {albumCost ? money(albumCost) : "free"}{signed ? " (added to your label debt)" : indie ? " (2,000 for pressing and release included)" : ""}. Recording uses your year: you cannot tour in the same year.</p>
            <ActionButton
              variant="primary"
              label="🎙️ Record album"
              reason={albumReason}
              onClick={() => act((pl) => recordAlbum(pl, genre, title, { producer, direction }))}
            />
          </>
        )}
      </Card>

      <BandDepth />
      <SectionTitle hint="one per year">Tour</SectionTitle>
      <TourSettings pace={pace} setPace={setPace} mode={mode} setMode={setMode} />
      <div className="flex flex-col gap-2">
        {tourOptions(p).map((t) => {
          const upfront = Math.round(t.fixed * 0.5);
          const reason = toured ? "Already toured this year"
            : studioBusy ? "Studio year: recording an album"
            : !t.ok ? `Needs about ${t.minFans.toLocaleString()} fans (you have ${fmtCount(m.fans)})`
            : indie && p.bankBalance < upfront ? `Needs ${money0(upfront)} up front`
            : null;
          return (
            <ActionButton
              key={t.id}
              label={`🚌 ${t.label}`}
              hint={`${t.shows} shows · ${t.capacity.toLocaleString()} seats · $${t.price} tickets · fixed costs ${money0(t.fixed)}${indie ? ` (${money0(upfront)} up front)` : ""}. Poor attendance can lose money.`}
              reason={reason}
              onClick={() => act((pl, rng) => goOnTour(pl, rng, t.id, { pace, mode }))}
            />
          );
        })}
      </div>

      <RightsDepth />

      {m.albums.length > 0 && (
        <>
          <SectionTitle hint={`${m.albums.length} release${m.albums.length === 1 ? "" : "s"}`}>Discography</SectionTitle>
          <div className="flex flex-col gap-2">
            {[...m.albums].reverse().map((a, i) => (
              <Card key={`${a.title}-${a.year}-${i}`} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">💿 {a.title}{a.award ? " 🏆" : ""}</div>
                    <div className="text-xs text-slate-400">{a.genre} · {a.year} · {a.sales.toLocaleString()} sold{a.quality !== undefined ? ` · quality ${a.quality}` : ""}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {a.hit && <Pill tone="amber">Chart single</Pill>}
                      {a.indie && <Pill tone="blue">Indie</Pill>}
                      {a.labelOwned && <Pill tone="red">Label owns it</Pill>}
                      {a.award && <Pill tone="amber">{a.award}</Pill>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Pill tone={ratingTone(a.rating)}>{a.rating}</Pill>
                    {a.royalty > 0 && !a.labelOwned && <div className="mt-1 text-xs tabular-nums text-emerald-300">{money0(a.royalty)} royalty</div>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <CelebrityPanel />
    </div>
  );
}
