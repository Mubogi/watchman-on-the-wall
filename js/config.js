/**
 * Static game data: dimensions, pacing, scripture, burdens, actions, threats.
 * Everything tunable lives here so the simulation stays readable elsewhere.
 */

export const TILE_W = 64;
export const TILE_H = 32;
export const GRID = 17;

/** One in-game week, in real seconds at 1x speed. */
export const WEEK_SECONDS = 25;
export const WEEKS_PER_SEASON = 12;

export const SEASONS = [
  {
    key: "spring",
    name: "Spring",
    subtitle: "Sowing",
    accent: "#8fc9a4",
    ground: ["#4e7a58", "#57855f", "#4a7353"],
    sky: "#131c2c",
    difficulty: 1.0,
    verse: { text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.", ref: "Galatians 6:9" },
    debrief: [
      "Who quietly returned to us this season, and what did their return cost someone?",
      "Where did we act out of urgency rather than love — and what would patience have looked like?",
      "Which name on our list has no one visiting them? Who will go this week?",
    ],
  },
  {
    key: "summer",
    name: "Summer",
    subtitle: "Growing",
    accent: "#e8c979",
    ground: ["#5c8153", "#668c5b", "#547a4c"],
    sky: "#1a2231",
    difficulty: 1.18,
    verse: { text: "Carry each other's burdens, and in this way you will fulfil the law of Christ.", ref: "Galatians 6:2" },
    debrief: [
      "Whose burden did we carry without being asked? Whose did we only talk about?",
      "What did we mistake for growth because it was loud?",
      "Which new believer still needs a mentor rather than a meeting?",
    ],
  },
  {
    key: "autumn",
    name: "Autumn",
    subtitle: "Harvest",
    accent: "#e0955c",
    ground: ["#6b6a44", "#77744a", "#635f3d"],
    sky: "#201c26",
    difficulty: 1.34,
    verse: { text: "And let us consider how we may spur one another on toward love and good deeds.", ref: "Hebrews 10:24" },
    debrief: [
      "Which warning did we delay, and what did the delay cost the flock?",
      "Where were we right but not gentle?",
      "Who has been faithful in secret intercession that the congregation has never thanked?",
    ],
  },
  {
    key: "winter",
    name: "Winter",
    subtitle: "Watching",
    accent: "#8fb4d6",
    ground: ["#4a5a68", "#54646f", "#42515f"],
    sky: "#0e1520",
    difficulty: 1.5,
    verse: { text: "Therefore confess your sins to each other and pray for each other so that you may be healed.", ref: "James 5:16" },
    debrief: [
      "Who kept watch while others slept, and how will we hold them up in turn?",
      "What did this winter teach us about the difference between vigilance and suspicion?",
      "What will we carry into the next season, and what will we finally lay down?",
    ],
  },
];

export const SCRIPTURE = {
  call: {
    text: "Son of man, I have made you a watchman for the people of Israel; so hear the word I speak and give them warning from me.",
    ref: "Ezekiel 33:7",
  },
  gentle: {
    text: "Brothers and sisters, if someone is caught in a sin, you who live by the Spirit should restore that person gently.",
    ref: "Galatians 6:1",
  },
  gather: {
    text: "Not giving up meeting together… but encouraging one another — and all the more as you see the Day approaching.",
    ref: "Hebrews 10:25",
  },
  pray: {
    text: "The prayer of a righteous person is powerful and effective.",
    ref: "James 5:16",
  },
};

/**
 * Burden catalogue. `ideal` is the ministry that fits; `hard` means the heart
 * must be softened by intercession before truth can be spoken safely.
 */
export const BURDENS = {
  grief: {
    label: "Grieving a loss",
    icon: "🕯",
    ideal: "visit",
    hard: false,
    desc: "A chair at the table stays empty. Grief makes the house feel loud and the fellowship feel far.",
    weight: 1.0,
  },
  offense: {
    label: "Offended by a harsh word",
    icon: "⚡",
    ideal: "restoration",
    hard: true,
    desc: "A careless sentence landed where it hurt. The wound has been rehearsed more often than it has been healed.",
    weight: 1.1,
  },
  deception: {
    label: "Enticed by a false teacher",
    icon: "🐺",
    ideal: "restoration",
    hard: true,
    desc: "A confident voice at the market has made error sound like freedom. Correction without gentleness will only harden it.",
    weight: 1.25,
  },
  finances: {
    label: "Under financial strain",
    icon: "⚖",
    ideal: "visit",
    hard: false,
    desc: "The maths does not work this month. Pride is doing its best to keep anyone from finding out.",
    weight: 1.05,
  },
  hunger: {
    label: "Growing hungry for the Word",
    icon: "📖",
    ideal: "mentor",
    hard: false,
    desc: "A real appetite has started, and no one has yet walked beside it. Left alone, appetite cools.",
    weight: 0.85,
  },
  shame: {
    label: "Carrying hidden shame",
    icon: "🩹",
    ideal: "intercession",
    hard: false,
    desc: "They serve on Sundays and shrink on Mondays. What they cannot say aloud, they can still be prayed for.",
    weight: 1.0,
  },
  weariness: {
    label: "Weary in serving",
    icon: "🌾",
    ideal: "mentor",
    hard: false,
    desc: "Too many rotas, too few sabbaths. The hands are still serving; the heart is quietly packing up.",
    weight: 0.95,
  },
  isolation: {
    label: "Withdrawn into isolation",
    icon: "🚪",
    ideal: "visit",
    hard: false,
    desc: "Three weeks of missed gatherings and nobody has knocked. Absence is a message if we listen.",
    weight: 1.15,
  },
  family: {
    label: "Tension at home",
    icon: "🏠",
    ideal: "visit",
    hard: false,
    desc: "The house is quiet in the wrong way. The marriage is tired, and the children have noticed.",
    weight: 1.1,
  },
  pride: {
    label: "Pride after correction",
    icon: "🪞",
    ideal: "intercession",
    hard: true,
    desc: "Being right has become more precious than being near. A second correction now would only confirm them in it.",
    weight: 1.0,
  },
  doubt: {
    label: "Quiet doubt",
    icon: "🌫",
    ideal: "mentor",
    hard: false,
    desc: "The questions are sincere and unspoken. They need company in the fog, not an argument at the door.",
    weight: 0.9,
  },
  fear: {
    label: "Fear of the future",
    icon: "🌑",
    ideal: "intercession",
    hard: false,
    desc: "Every headline is a prophecy now. Fear has made them small, and small is easy to pick off.",
    weight: 1.0,
  },
  loneliness: {
    label: "Lonely in a crowded room",
    icon: "🫂",
    ideal: "visit",
    hard: false,
    desc: "Surrounded on Sunday, unknown on Tuesday. They have learned to be pleasant rather than known.",
    weight: 0.95,
  },
  distraction: {
    label: "Distracted by many cares",
    icon: "🌀",
    ideal: "mentor",
    hard: false,
    desc: "A hundred good things have crowded out the one needful thing. The heart is scattered, not rebellious.",
    weight: 0.9,
  },
};

export const ACTION_KEYS = ["intercession", "visit", "restoration", "mentor"];

export const ACTIONS = {
  intercession: {
    name: "Secret Intercession",
    short: "Intercede",
    icon: "🙏",
    cost: { oil: 12 },
    blurb: "Pray in secret. Softens a hard heart from afar and steadies the fearful.",
    detail: "Softens a hard heart from afar. No one knows but God.",
    relief: 15,
    soften: true,
  },
  visit: {
    name: "Home Visit & Meal",
    short: "Visit",
    icon: "🍞",
    cost: { food: 9, time: 6 },
    blurb: "Sit at their table. Heals isolation and carries practical need.",
    detail: "Heals isolation and practical need. Slower, but it reaches the body too.",
    relief: 23,
    soften: false,
  },
  restoration: {
    name: "Gentle Restoration & Truth",
    short: "Restore",
    icon: "🕯",
    cost: { counsel: 11, time: 8 },
    blurb: "Speak truth gently. Rescues from deception — if the heart is soft.",
    detail: "Rescues from deception without pride. Dangerous on a hard heart.",
    relief: 31,
    soften: false,
  },
  mentor: {
    name: "Pair with a Mature Mentor",
    short: "Mentor",
    icon: "🤝",
    cost: { time: 10, counsel: 6 },
    blurb: "Build lasting discipleship. Best for hunger and weariness.",
    detail: "Builds lasting discipleship. Established members grow burdens far slower.",
    relief: 19,
    soften: false,
  },
};

/** Threat archetypes that walk toward the village from the dark. */
export const THREATS = {
  falseTeacher: {
    label: "False teacher",
    icon: "🐺",
    blurb: "A smooth voice at the market gate, selling freedom without the cross.",
    seeds: ["deception", "doubt"],
    speed: 0.34,
    colour: "#d97a55",
  },
  division: {
    label: "Whisper of division",
    icon: "🗣",
    blurb: "A small rumour, told kindly, that will not stay small.",
    seeds: ["offense", "pride"],
    speed: 0.4,
    colour: "#d76a86",
  },
  drift: {
    label: "Cultural drift",
    icon: "🌊",
    blurb: "Not an attack — a current. It carries the unwatchful out without a sound.",
    seeds: ["distraction", "doubt"],
    speed: 0.28,
    colour: "#7fb3d5",
  },
  discouragement: {
    label: "Spirit of discouragement",
    icon: "🌫",
    blurb: "It does not argue. It simply makes every good thing feel pointless.",
    seeds: ["weariness", "fear"],
    speed: 0.32,
    colour: "#9d8fc4",
  },
  greed: {
    label: "Love of money",
    icon: "💰",
    blurb: "A reasonable offer, a small compromise, an open door.",
    seeds: ["finances", "distraction"],
    speed: 0.36,
    colour: "#c9a04e",
  },
  hardness: {
    label: "Hardening of heart",
    icon: "🪨",
    blurb: "An old wound, nursed until it turned to stone.",
    seeds: ["pride", "offense"],
    speed: 0.3,
    colour: "#a08d7a",
  },
};

/** Congregation roster seed data. */
export const ROSTER = [
  { name: "Miriam", role: "Intercessor", note: "Keeps a list of names inside her Bible's back cover.", skin: "#e3b58c", hair: "#3b2a22", robe: "#7a5f9e", accent: "#a48ede" },
  { name: "Tobias", role: "Elder", note: "Slow to speak, slower to leave. Has buried more friends than he will say.", skin: "#c99a72", hair: "#8b8b8b", robe: "#4e6b8a", accent: "#7fb3d5" },
  { name: "Hannah", role: "New believer", note: "Baptised in spring. Still surprised that anyone remembers her name.", skin: "#f0cfae", hair: "#a4602c", robe: "#8a6f4e", accent: "#e8bf76" },
  { name: "Elias", role: "Deacon", note: "Loads chairs, fixes boilers, prays at 5am with the lights off.", skin: "#8d6244", hair: "#241a15", robe: "#3f6f5a", accent: "#86c1a0" },
  { name: "Ruth", role: "Widow", note: "Feeds anyone who stands still long enough. Cooks for two out of habit.", skin: "#dcb08a", hair: "#cfc6bb", robe: "#7a5566", accent: "#d76a86" },
  { name: "Caleb", role: "Young father", note: "Carries a toddler on one hip and a job on the other.", skin: "#c08a5e", hair: "#3d2a1c", robe: "#5f6f8f", accent: "#7fb3d5" },
  { name: "Priscilla", role: "Teacher", note: "Explains hard verses with her hands. Rarely says the easy thing.", skin: "#e8c3a0", hair: "#2e2320", robe: "#8f6b52", accent: "#e8bf76" },
  { name: "Jonas", role: "Night worker", note: "Arrives late, sits at the back, stays until the lights go out.", skin: "#a87a56", hair: "#1f1a17", robe: "#4a4f63", accent: "#9d8fc4" },
  { name: "Abigail", role: "Cell leader", note: "Holds eleven people's worries in her head and none of her own out loud.", skin: "#d9a97f", hair: "#4a3327", robe: "#6b7f5c", accent: "#86c1a0" },
  { name: "Simeon", role: "Retired", note: "Prays at dawn for the whole street by name, in order.", skin: "#d3a880", hair: "#ddd8d0", robe: "#7f6a55", accent: "#e8bf76" },
  { name: "Talitha", role: "Student", note: "Asks the questions everyone else is too polite to ask.", skin: "#efc9a4", hair: "#5c3a22", robe: "#8f5f78", accent: "#d76a86" },
  { name: "Boaz", role: "Merchant", note: "Knows everyone at the market. Has not yet decided what he believes.", skin: "#b98a5e", hair: "#33241a", robe: "#5d6d54", accent: "#86c1a0" },
];

/** Relationship flavour between members. */
export const RELATION_KINDS = {
  spouse: { label: "married to", strength: 1 },
  family: { label: "family with", strength: 1 },
  mentor: { label: "mentors", strength: 1.2 },
  friend: { label: "close friend of", strength: 1 },
  tension: { label: "strained with", strength: -1 },
};

export const RELATION_PAIRS = [
  ["Caleb", "Ruth", "family"],
  ["Tobias", "Elias", "friend"],
  ["Miriam", "Simeon", "friend"],
  ["Priscilla", "Hannah", "mentor"],
  ["Abigail", "Talitha", "mentor"],
  ["Ruth", "Hannah", "friend"],
  ["Jonas", "Boaz", "tension"],
  ["Simeon", "Tobias", "friend"],
  ["Miriam", "Abigail", "friend"],
  ["Elias", "Caleb", "friend"],
];

export const GRACE_WORDS = [
  "Grace", "Restored", "Strengthened", "Comforted", "Carried", "Loved well",
  "Heard", "Softened", "Encouraged", "Set free", "Held", "Fed",
];

export const SAVE_KEY = "watchman-on-the-wall.save.v1";
export const SAVE_VERSION = 1;
