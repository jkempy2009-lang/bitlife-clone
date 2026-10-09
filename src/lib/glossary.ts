/** Plain-language explanations of the numbers and ideas the game throws at a new player. */
export interface GlossaryEntry {
  id: string;
  emoji: string;
  term: string;
  text: string;
  group: "Vitals" | "Money" | "People" | "How it works";
}

export const GLOSSARY: GlossaryEntry[] = [
  { id: "happiness", emoji: "😊", term: "Happiness", group: "Vitals", text: "Your mood. It drifts back toward your natural temperament over time. Low happiness drags down health and work; high happiness protects them." },
  { id: "health", emoji: "❤️", term: "Health", group: "Vitals", text: "Resistance to illness and how long you will live. Sport, hard work and some careers also need stamina. Habits, illness, age and vices change it every year." },
  { id: "smarts", emoji: "🧠", term: "Smarts", group: "Vitals", text: "Grades, which jobs and courses you qualify for, and how well a business runs. Study, reading and the library raise it." },
  { id: "looks", emoji: "✨", term: "Looks", group: "Vitals", text: "Helps with hiring in some fields, dating, modelling and fame. It fades with age; the gym and surgery can help." },
  { id: "karma", emoji: "☯️", term: "Karma", group: "Vitals", text: "Your moral balance. Kindness and honesty raise it; crime and cruelty lower it. Some paths open only at low karma (the Underworld), and fortune tends to treat high karma gently." },
  { id: "fame", emoji: "🌟", term: "Fame", group: "Vitals", text: "How well known you are. It comes from media, sport, music, politics and scandal, and it fades if you stay out of the spotlight." },
  { id: "networth", emoji: "💰", term: "Net worth", group: "Money", text: "Cash plus property, cars, investments, business stake and retirement savings, minus every loan and mortgage." },
  { id: "salary", emoji: "💵", term: "Salary", group: "Money", text: "Your gross yearly pay before tax. Raises and promotions grow it; losing your job zeroes it." },
  { id: "credit", emoji: "🧾", term: "Credit score", group: "Money", text: "From 300 to 850. A better score gets you bigger loans at a lower price. Paying debts on time raises it; defaulting wrecks it." },
  { id: "economy", emoji: "📈", term: "Economy", group: "Money", text: "Boom, steady or recession. Booms mean hiring and rising markets; recessions mean layoffs and falling markets. It changes every few years." },
  { id: "relationship", emoji: "💞", term: "Relationship bar", group: "People", text: "How close you are to someone. Spend time, talk and help to build it; neglect lets it fade. Partners, kids and friends all notice." },
  { id: "effort", emoji: "🔥", term: "Effort", group: "How it works", text: "How hard you push at work, study and business. Coasting is easy and slow; grinding is fast but costs health, happiness and the people close to you." },
  { id: "annual", emoji: "📅", term: "Once per year", group: "How it works", text: "Most activities can be done once each year. Age Up starts a new year and resets them, so there is no need to rush." },
  { id: "ageup", emoji: "⏳", term: "Age Up", group: "How it works", text: "Lives one year. Events happen and some ask you to choose. You can use any tab before aging up." },
  { id: "skip", emoji: "⏩", term: "Skip 10 years", group: "How it works", text: "Autopilot lives the next decade for you and makes sensible choices. It stops for death, a trial or prison, and everything is written into your Life Story." },
  { id: "heirs", emoji: "👶", term: "Heirs", group: "How it works", text: "When you die, a living child can carry on the family with a share of your wealth. You can also hand your life over to a child while you are still alive." },
];

export const HOW_TO_PLAY: { emoji: string; title: string; text: string }[] = [
  { emoji: "⏳", title: "Age Up to live a year", text: "The big green button. Events will appear and some ask you to decide." },
  { emoji: "🧭", title: "Check \"This year\" on the Life tab", text: "It suggests the most useful things to do right now for your age and situation." },
  { emoji: "🗂️", title: "Use the tabs", text: "People for family and love, Activities for health and fun, Career for school and work, Assets for money." },
  { emoji: "⏩", title: "Skip quiet decades", text: "Skip 10 years hands the wheel to autopilot. It stops when something big happens." },
  { emoji: "💾", title: "Everything saves itself", text: "Close the tab any time. Export a backup from Settings to move to another device." },
];
