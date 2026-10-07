"use client";

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/context/GameStateContext";
import { ALBUM_RATINGS, MUSIC_GENRES } from "@/data/careersRegistry";
import { auditionContract, formBand, leaveLabel, practiceMusic, recordAlbum } from "@/engine/career";
import { Button, Card, Pill, SectionTitle, StatBar } from "../ui";

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

export function MusicSection() {
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
        {m.signed && (
          <Button variant="ghost" className="mt-2 w-full" onClick={() => act((pl) => leaveLabel(pl))}>Leave the label</Button>
        )}
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
