export const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  if (v >= 1_000_000_000) return `${sign}$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 10_000_000) return `${sign}$${(v / 1_000_000).toFixed(1)}M`;
  return `${sign}$${v.toLocaleString("en-US")}`;
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
