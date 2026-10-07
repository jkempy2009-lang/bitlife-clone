export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  if (v >= 1_000_000_000) return `${sign}$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 10_000_000) return `${sign}$${(v / 1_000_000).toFixed(1)}M`;
  return `${sign}$${v.toLocaleString("en-US")}`;
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Emoji avatar that grows up with the character. */
export function avatarFor(p: { age: number; gender: string; alive: boolean }): string {
  if (!p.alive) return "🪦";
  const m = p.gender === "Male";
  const f = p.gender === "Female";
  if (p.age < 1) return "👶";
  if (p.age < 4) return "🧒";
  if (p.age < 13) return m ? "👦" : f ? "👧" : "🧒";
  if (p.age < 18) return m ? "👦" : f ? "👧" : "🧑";
  if (p.age < 60) return m ? "👨" : f ? "👩" : "🧑";
  return m ? "👴" : f ? "👵" : "🧓";
}
