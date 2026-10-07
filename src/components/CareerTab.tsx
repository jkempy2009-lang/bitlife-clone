"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/context/GameStateContext";
import {
  ALBUM_RATINGS,
  CAREER_LINES,
  DECREES,
  MUSIC_GENRES,
  PROGRAMS,
  UNIVERSITY_MAJORS,
} from "@/data/careersRegistry";
import {
  FAMOUS_FAME,
  applyForJob,
  auditionContract,
  auditionForLead,
  dropOut,
  enrollProgram,
  executeCitizen,
  formBand,
  holdGala,
  jobEligibility,
  passDecree,
  practiceMusic,
  quitJob,
  recordAlbum,
  retire,
  shootCommercial,
  studyHarder,
  workHarder,
  writeMemoir,
} from "@/engine/career";
import { isRoyal } from "@/engine/state";
import { money } from "@/lib/format";
import { Button, Card, Pill, Segmented, SectionTitle, StatBar, TooYoung } from "./ui";
import { AthleteSection, BusinessSection, InfluencerSection, PoliticsSection, UnderworldSection } from "./CareerPaths";

type Section = "work" | "school" | "business" | "sports" | "online" | "politics" | "underworld" | "stardom" | "music";

export default function CareerTab() {
  const { player: p } = useGame();
  const royal = isRoyal(p);
  const [section, setSection] = useState<Section>(royal ? "work" : p.education.stage !== "None" && !p.currentJob ? "school" : "work");

  if (p.age < 5) return <TooYoung>No career yet — your job is to nap, eat, and be adorable.</TooYoung>;
  const options: { id: Section; label: string }[] = [
    { id: "work", label: royal ? "👑 Royal Duties" : "💼 Work" },
    { id: "school", label: "🎓 Academics" },
    ...(royal ? [] : [{ id: "business" as const, label: "🏢 Business" }, { id: "sports" as const, label: "🏅 Athlete" }]),
    { id: "online", label: "📱 Influencer" },
    ...(royal ? [] : [{ id: "politics" as const, label: "🏛️ Politics" }, { id: "underworld" as const, label: "🕴️ Underworld" }]),
    ...(royal ? [] : [{ id: "stardom" as const, label: "🎬 Movie Star" }]),
    { id: "music", label: "🎸 Rock Star" },
  ];
  return (
    <div>
      <Segmented<Section> value={section} onChange={setSection} options={options} />
      {section === "work" && (royal ? <RoyalDuties /> : <CorporateCareer />)}
      {section === "school" && <Academics />}
      {section === "business" && <BusinessSection />}
      {section === "sports" && <AthleteSection />}
      {section === "online" && <InfluencerSection />}
      {section === "politics" && <PoliticsSection />}
      {section === "underworld" && <UnderworldSection />}
      {section === "stardom" && <MovieStar />}
      {section === "music" && <RockStar />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academics
// ---------------------------------------------------------------------------

const STAGE_LABEL: Record<string, string> = {
  None: "Not enrolled",
  Primary: "Primary School",
  HighSchool: "High School",
  University: "University",
  MedicalSchool: "Medical School",
  LawSchool: "Law School",
};

function Academics() {
  const { player: p, act } = useGame();
  const e = p.education;
  const [major, setMajor] = useState<string>(UNIVERSITY_MAJORS[0].id);
  const enrolled = e.stage !== "None";
  const studied = (p.annual.study ?? 0) >= 1;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Education</SectionTitle>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">{STAGE_LABEL[e.stage]}</div>
            {enrolled && (
              <div className="text-sm text-slate-400">
                {e.yearsLeft} year{e.yearsLeft === 1 ? "" : "s"} left{e.major ? ` · ${UNIVERSITY_MAJORS.find((m) => m.id === e.major)?.name}` : ""}
              </div>
            )}
          </div>
          <span className="text-3xl">🎓</span>
        </div>
        {enrolled && (
          <>
            <div className="mt-3">
              <StatBar label="Grades" value={e.grades} color="blue" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => act((pl) => studyHarder(pl))} disabled={studied}>
                📖 {studied ? "Studied" : "Study Harder"}
              </Button>
              <Button variant="ghost" onClick={() => act((pl) => dropOut(pl))} disabled={p.age < 16 || e.stage === "Primary"}>
                Drop Out
              </Button>
            </div>
          </>
        )}
        {e.degrees.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.degrees.map((d) => (
              <Pill key={d} tone="green">
                {d === "highschool" ? "High School Diploma" : d === "md" ? "Medical Degree" : d === "jd" ? "Law Degree" : `BA/BS ${UNIVERSITY_MAJORS.find((m) => m.id === d.slice(9))?.name ?? ""}`}
              </Pill>
            ))}
          </div>
        )}
      </Card>

      {!enrolled && (
        <>
          <SectionTitle>Continue Your Studies</SectionTitle>
          <Card>
            <div className="mb-1 font-semibold">🏛️ University</div>
            <p className="mb-2 text-xs text-slate-400">4 years · {money(PROGRAMS.University.tuition)}/yr · needs a high school diploma & {PROGRAMS.University.minSmarts}+ Smarts. Unaffordable tuition becomes student debt.</p>
            <select
              value={major}
              onChange={(ev) => setMajor(ev.target.value)}
              className="mb-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              aria-label="Choose a major"
            >
              {UNIVERSITY_MAJORS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "University", major, rng))}>
              Apply
            </Button>
          </Card>
          <Card>
            <div className="mb-1 font-semibold">⚕️ Medical School</div>
            <p className="mb-2 text-xs text-slate-400">4 years · {money(PROGRAMS.MedicalSchool.tuition)}/yr · needs a Bachelor's & {PROGRAMS.MedicalSchool.minSmarts}+ Smarts.</p>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "MedicalSchool", null, rng))}>Apply</Button>
          </Card>
          <Card>
            <div className="mb-1 font-semibold">⚖️ Law School</div>
            <p className="mb-2 text-xs text-slate-400">3 years · {money(PROGRAMS.LawSchool.tuition)}/yr · needs a Bachelor's & {PROGRAMS.LawSchool.minSmarts}+ Smarts.</p>
            <Button variant="primary" className="w-full" onClick={() => act((pl, rng) => enrollProgram(pl, "LawSchool", null, rng))}>Apply</Button>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corporate career
// ---------------------------------------------------------------------------

function CorporateCareer() {
  const { player: p, act } = useGame();
  const job = p.currentJob;

  return (
    <div className="flex flex-col gap-3">
      {job ? (
        <>
          <SectionTitle>Current Job</SectionTitle>
          <Card>
            <div className="text-lg font-bold">{job.title}</div>
            <div className="text-sm text-slate-400">{job.company}</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-300">{money(job.salary)}<span className="text-sm font-normal text-slate-400"> / year</span></div>
            <div className="mt-3">
              <StatBar label="Performance (85+ earns a promotion offer)" value={job.performance} color="green" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => act((pl, rng) => workHarder(pl, rng))} disabled={(p.annual.work ?? 0) >= 1}>
                💪 {(p.annual.work ?? 0) >= 1 ? "Worked hard" : "Work Harder"}
              </Button>
              <Button variant="ghost" onClick={() => act((pl) => quitJob(pl))}>Quit Job</Button>
              {p.age >= 60 && (
                <Button variant="gold" className="col-span-2" onClick={() => act((pl) => retire(pl))}>🏖️ Retire</Button>
              )}
            </div>
          </Card>
        </>
      ) : (
        <>
          {p.pension > 0 ? (
            <Card>
              <div className="font-semibold">🏖️ Retired</div>
              <div className="text-sm text-slate-400">Pension: {money(p.pension)} / year</div>
            </Card>
          ) : p.age >= 60 ? (
            <Button variant="gold" onClick={() => act((pl) => retire(pl))}>🏖️ Retire</Button>
          ) : null}
          <SectionTitle hint="entry-level postings">Job Board</SectionTitle>
          <div className="flex flex-col gap-2">
            {CAREER_LINES.filter((l) => !l.pack).map((line) => {
              const elig = jobEligibility(p, line);
              const applied = (p.annual[`apply:${line.id}`] ?? 0) >= 1;
              return (
                <div key={line.id} className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{line.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{line.ladder[0].title}</div>
                      <div className="text-xs text-slate-400">{line.name} · {money(line.ladder[0].salary)}/yr → {money(line.ladder[line.ladder.length - 1].salary)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Needs {line.requirements.degrees?.length ? "degree, " : ""}{line.requirements.minSmarts}+ Smarts{line.requirements.minLooks ? `, ${line.requirements.minLooks}+ Looks` : ""}, age {line.minAge}+
                      </div>
                      {!elig.ok && <div className="mt-1 text-xs font-medium text-rose-300">🔒 {elig.reason}</div>}
                    </div>
                    <Button variant="primary" className="shrink-0 px-3 py-1.5" disabled={!elig.ok || applied} onClick={() => act((pl, rng) => applyForJob(pl, line.id, rng))}>
                      {applied ? "Applied" : "Apply"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Royalty pack
// ---------------------------------------------------------------------------

function RoyalDuties() {
  const { player: p, act } = useGame();
  const used = (k: string) => (p.annual[k] ?? 0) >= 1;
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Royal Duties</SectionTitle>
      <Card className="border-purple-500/40 bg-gradient-to-br from-purple-950/60 to-slate-800/70">
        <div className="text-xs uppercase tracking-wider text-purple-300">{p.birthCountry}</div>
        <div className="text-2xl font-bold">{p.royalRank} {p.firstName}</div>
        <div className="mt-3">
          <StatBar label="Royal Respect (0 means a coup)" value={p.royalRespect} color="purple" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-slate-400">Economy</div><div className="text-base font-bold">{p.nation.economy}</div></div>
          <div><div className="text-slate-400">Freedom</div><div className="text-base font-bold">{p.nation.freedom}</div></div>
          <div><div className="text-slate-400">Military</div><div className="text-base font-bold">{p.nation.military}</div></div>
        </div>
      </Card>

      <Button variant="gold" onClick={() => act((pl) => holdGala(pl))} disabled={used("gala")}>
        🎉 Hold a Public Gala (−$100,000, +10 Respect)
      </Button>
      <Button variant="danger" onClick={() => act((pl, rng) => executeCitizen(pl, rng))} disabled={used("exec")}>
        🪓 Execute a Citizen (Karma → 0, −30 Respect)
      </Button>

      <SectionTitle hint="one per year">Pass a Decree</SectionTitle>
      <div className="flex flex-col gap-2">
        {DECREES.map((d) => (
          <button
            key={d.id}
            type="button"
            disabled={used("decree")}
            onClick={() => act((pl) => passDecree(pl, d.id))}
            className="rounded-2xl border border-slate-700/60 bg-slate-800/70 p-3 text-left transition-colors hover:border-purple-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="font-semibold">{d.name}</div>
            <div className="text-xs text-slate-400">{d.blurb}</div>
            <div className="mt-1 text-xs text-slate-500">
              Respect {d.respect >= 0 ? "+" : ""}{d.respect}
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Royals can't hold ordinary jobs. They receive a state allowance, tax-free.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movie Star pack
// ---------------------------------------------------------------------------

function MovieStar() {
  const { player: p, act } = useGame();
  const line = CAREER_LINES.find((l) => l.id === "actor")!;
  const job = p.currentJob?.lineId === "actor" ? p.currentJob : null;
  const elig = jobEligibility(p, line);
  const famous = p.fame >= FAMOUS_FAME;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Movie Star</SectionTitle>
      <Card>
        <StatBar label="🌟 Fame" value={p.fame} color="amber" />
        {job ? (
          <>
            <div className="text-lg font-bold">{job.title}</div>
            <div className="mb-2 text-sm text-slate-400">{job.company} · {money(job.salary)}/yr</div>
            <StatBar label="Performance" value={job.performance} color="green" />
            <Button
              variant="gold"
              className="w-full"
              disabled={(p.annual.audition ?? 0) >= 1 || job.tier >= 3}
              onClick={() => act((pl, rng) => auditionForLead(pl, rng))}
            >
              {job.tier >= 3 ? "You're at the top!" : "🎭 Audition for Lead Role"}
            </Button>
            <p className="mt-2 text-xs text-slate-500">Success odds scale with Looks × Performance.</p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-slate-300">Start at the bottom: a Background Actor needs Looks above 70.</p>
            {!elig.ok && <p className="mb-2 text-xs font-medium text-rose-300">🔒 {elig.reason}</p>}
            <Button variant="primary" className="w-full" disabled={!elig.ok || (p.annual["apply:actor"] ?? 0) >= 1} onClick={() => act((pl, rng) => applyForJob(pl, "actor", rng))}>
              🎬 Become a Background Actor
            </Button>
          </>
        )}
      </Card>

      <SectionTitle hint={famous ? "unlocked" : `unlocks at ${FAMOUS_FAME} Fame`}>Celebrity Activities</SectionTitle>
      <div className="grid grid-cols-1 gap-2">
        <Button variant="primary" disabled={!famous || (p.annual.commercial ?? 0) >= 1} onClick={() => act((pl) => shootCommercial(pl))}>
          📺 Shoot a Commercial (+$50,000, +5 Fame)
        </Button>
        <Button variant="primary" disabled={!famous || (p.annual.memoir ?? 0) >= 1} onClick={() => act((pl, rng) => writeMemoir(pl, rng))}>
          📖 Write a Memoir (pays ≈ {money(p.fame * 25_000)})
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rock Star pack
// ---------------------------------------------------------------------------

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
          <p className="mb-2 text-xs text-slate-400">Tap the drum as fast as you can for 5 seconds (20 taps = perfect). {score !== null && <strong className="text-amber-300">Last score: {score}</strong>}</p>
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

function RockStar() {
  const { player: p, act } = useGame();
  const [tap, setTap] = useState(0);
  const [genre, setGenre] = useState<string>(MUSIC_GENRES[0]);
  const [title, setTitle] = useState("");
  const m = p.music;
  const auditioned = (p.annual.audition_music ?? 0) >= 1;

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Rock Star</SectionTitle>
      <Card>
        <StatBar label="🎵 Music Skill" value={p.skills.music} color="purple" />
        <StatBar label="🌟 Fame" value={p.fame} color="amber" />
        <div className="mb-2 flex gap-1.5">
          <Pill tone={m.signed ? "green" : "slate"}>{m.signed ? (m.status === "band" ? "Signed band" : "Signed solo artist") : m.status === "band" ? "Unsigned band" : "No band"}</Pill>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => act((pl, rng) => practiceMusic(pl, rng))} disabled={(p.annual.practice ?? 0) >= 1}>
          🎸 Practise ({(p.annual.practice ?? 0) >= 1 ? "done" : "+3–6 skill"})
        </Button>
      </Card>

      {!m.signed && (
        <>
          <SectionTitle>Break into the Industry</SectionTitle>
          <Card>
            <RhythmCheck onScore={setTap} />
            <div className="mt-2 text-xs text-slate-400">Beat score: <strong>{tap}</strong> — success depends on your music skill and beat score (labels require age 18+).</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {m.status === "none" && (
                <Button variant="primary" disabled={auditioned || p.age < 14} onClick={() => act((pl) => formBand(pl, tap))}>
                  👥 Form a Band
                </Button>
              )}
              {m.status === "band" && (
                <Button variant="gold" disabled={auditioned || p.age < 18} onClick={() => act((pl, rng) => auditionContract(pl, "band", tap, rng))}>
                  📝 Audition for a Band Contract
                </Button>
              )}
              <Button variant="gold" disabled={auditioned || p.age < 18} onClick={() => act((pl, rng) => auditionContract(pl, "solo", tap, rng))}>
                🎤 Audition for a Solo Contract
              </Button>
            </div>
          </Card>
        </>
      )}

      {m.signed && (
        <>
          <SectionTitle hint="released when you age up">Record an Album</SectionTitle>
          <Card>
            {m.pendingAlbum ? (
              <p className="text-sm text-slate-300">💿 "{m.pendingAlbum.title}" ({m.pendingAlbum.genre}) is in post-production. Age up to see how it sells!</p>
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
                <Button variant="primary" className="w-full" disabled={(p.annual.album ?? 0) >= 1} onClick={() => act((pl) => recordAlbum(pl, genre, title))}>
                  🎙️ Record Album
                </Button>
              </>
            )}
            <p className="mt-2 text-xs text-slate-500">Ratings: {ALBUM_RATINGS.map((r) => r.rating).join(" → ")}. Fame improves your odds.</p>
          </Card>
        </>
      )}

      {m.albums.length > 0 && (
        <>
          <SectionTitle>Discography</SectionTitle>
          <div className="flex flex-col gap-2">
            {[...m.albums].reverse().map((a, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">💿 {a.title}</div>
                    <div className="text-xs text-slate-400">{a.genre} · {a.year} · {a.sales.toLocaleString()} sold</div>
                  </div>
                  <Pill tone={a.rating === "Flop" ? "red" : a.rating === "Diamond" || a.rating === "Platinum" ? "amber" : "green"}>{a.rating}</Pill>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
