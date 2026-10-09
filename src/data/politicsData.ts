/** Issues and parties of the political game. Shared by the engine and the UI. */

export const ISSUES = [
  { id: "economy", name: "Economy", emoji: "💰", options: ["Tax the wealthy", "Balanced budget", "Cut taxes"] },
  { id: "health", name: "Healthcare", emoji: "🏥", options: ["Universal care", "Mixed system", "Market-based"] },
  { id: "environment", name: "Environment", emoji: "🌍", options: ["Green transition", "Gradual change", "Drill and grow"] },
  { id: "security", name: "Policing", emoji: "🚓", options: ["Reform policing", "Status quo", "Tough on crime"] },
  { id: "liberty", name: "Liberty", emoji: "🗽", options: ["Expand freedoms", "Balanced", "Order first"] },
] as const;

export const PARTIES = [
  { id: "progressive", name: "Progressive Alliance", emoji: "🌹", blurb: "Strong in steady times. +4% odds when the economy is normal. Platform: left on every issue.", platform: [-1, -1, -1, -1, -1] },
  { id: "conservative", name: "Conservative Union", emoji: "🏛️", blurb: "Trusted when the economy is stable or booming. +4% odds. Platform: right on every issue.", platform: [1, 1, 1, 1, 1] },
  { id: "centrist", name: "Centrist Pact", emoji: "⚖️", blurb: "Moderate and dependable. +3% odds in any climate. Platform: stay in the middle.", platform: [0, 0, 0, 0, 0] },
  { id: "populist", name: "People's Front", emoji: "📢", blurb: "Thrives in recessions (+8%), struggles in booms (−3%). Left on money, right on order.", platform: [-1, -1, 1, 1, 1] },
  { id: "green", name: "Green Party", emoji: "🌿", blurb: "Rewards good character: +5% odds if your Karma is 60+. Greens on the environment and liberty.", platform: [-1, 0, -1, 0, -1] },
] as const;
