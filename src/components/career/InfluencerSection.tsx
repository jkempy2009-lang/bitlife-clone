"use client";

import { useGame } from "@/context/GameStateContext";
import { brandCollab, postContent, startChannel } from "@/engine/paths";
import { money } from "@/lib/format";
import { Button, Card, SectionTitle, StatBar } from "../ui";

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
