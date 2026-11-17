// Neon Drift — central tuning. Change values here, not inside the engine.

export const PALETTE = {
  bg: '#020617',
  deep: '#030b18',
  indigo: '#6366f1',
  indigoSoft: '#818cf8',
  cyan: '#22d3ee',
  cyanSoft: '#67e8f9',
  emerald: '#34d399',
  emeraldSoft: '#6ee7b7',
  violet: '#c084fc',
  rose: '#fb7185',
  amber: '#fbbf24',
  ink: '#e2e8f0'
};

export const TUNING = {
  baseSpeed: 32,
  maxSpeed: 92,
  speedCurve: 2400,       // metres; larger = slower ramp
  playRadius: 5.0,
  playerRadius: 0.48,
  spawnDepth: 168,
  despawnZ: 16,
  scorePerMetre: 1.35,
  orbPoints: 25,
  nearMissPoints: 15,
  nearMissMargin: 1.15,
  comboWindow: 3.2,
  comboStep: 4,
  maxMultiplier: 5,
  shieldDuration: 5,
  shieldMax: 2,
  sectorSize: 500
};

export const SPAWN = {
  intervalStart: 1.55,
  intervalMin: 0.72,
  intervalCurve: 3600,
  firstDelay: 0.9,
  orbIntervalStart: 1.15,
  orbIntervalMin: 0.75,
  powerMin: 24,
  powerMax: 36
};

// Labels are drawn onto the collectible orbs and mirrored in the menu.
// Add, remove or rename freely; textures are generated at runtime.
export const SKILLS = [
  { label: 'Python', tone: 'emerald' },
  { label: 'PyTorch', tone: 'violet' },
  { label: 'React', tone: 'cyan' },
  { label: 'FastAPI', tone: 'emerald' },
  { label: 'TypeScript', tone: 'indigo' },
  { label: 'Node.js', tone: 'emerald' },
  { label: 'Three.js', tone: 'cyan' },
  { label: 'SQL', tone: 'indigo' },
  { label: 'AWS', tone: 'amber' },
  { label: 'OpenCV', tone: 'violet' },
  { label: 'NLP', tone: 'cyan' },
  { label: 'RAG', tone: 'emerald' },
  { label: 'GraphSAGE', tone: 'violet' },
  { label: 'Java', tone: 'indigo' },
  { label: 'C++', tone: 'cyan' },
  { label: 'Power BI', tone: 'amber' },
  { label: 'Tableau', tone: 'indigo' },
  { label: 'Git', tone: 'emerald' }
];

export const TONE_HEX = {
  emerald: PALETTE.emerald,
  cyan: PALETTE.cyan,
  indigo: PALETTE.indigoSoft,
  violet: PALETTE.violet,
  amber: PALETTE.amber
};

export const GATE_PATTERNS = [
  { holes: [{ x: 0, y: 0, r: 1.72 }] },
  { holes: [{ x: 2.7, y: 0.2, r: 1.68 }] },
  { holes: [{ x: -2.6, y: -0.3, r: 1.68 }] },
  { holes: [{ x: 0.1, y: 2.55, r: 1.66 }] },
  { holes: [{ x: -0.2, y: -2.5, r: 1.66 }] },
  { holes: [{ x: -2.35, y: 0.1, r: 1.48 }, { x: 2.35, y: -0.1, r: 1.48 }] }
];

export const QUALITY = {
  high: { dpr: 2, particles: 900, post: true, stars: 780, debris: 44 },
  low: { dpr: 1.25, particles: 340, post: false, stars: 420, debris: 22 }
};
