// Neon Bay configuration: world size, colours, tuning and mission data.
// Every value here is original to this game; the city is fictional.
export const CONFIG = {
  worldW: 3400,
  worldH: 2600,
  viewW: 1280,
  viewH: 720,
  roadGap: 420,
  roadW: 96,
  beachW: 260,
  playerRadius: 14,
  playerWalkSpeed: 205,
  playerRunSpeed: 300,
  playerHealth: 100,
  carAccel: 520,
  carMaxSpeed: 560,
  carReverseMax: 200,
  carTurn: 2.6,
  policeMax: 7,
  trafficCount: 22,
  pedCount: 34,
  parkedCount: 16,
  wantedDecaySeconds: 26,
  saveKey: 'neon-bay-save-v1',
};

export const PALETTE = {
  grass: '#2e7d4f',
  grassDark: '#276b43',
  sand: '#e8c98a',
  ocean: '#1b6fa8',
  oceanDeep: '#155a8a',
  road: '#33363f',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0ab',
  buildingRoof: '#4a4e69',
  neonPink: '#ff2e88',
  neonCyan: '#22d3ee',
  neonYellow: '#ffd23f',
  neonPurple: '#a855f7',
  hudBg: 'rgba(8, 12, 30, 0.72)',
  hudText: '#f5f7ff',
};

// The three story missions, given by fixer Vera Solano.
export const MISSIONS = [
  {
    id: 'sunset-pickup',
    title: '1 · Sunset Pickup',
    giver: 'Vera Solano',
    brief: 'Vera needs a package from the marina kiosk. Drive or walk to the gold marker, grab it, then bring it to the hideout on Coral Row.',
    steps: [
      { kind: 'goto', label: 'Reach the marina kiosk', x: 560, y: 2060, radius: 90 },
      { kind: 'goto', label: 'Deliver the package to the hideout', x: 2620, y: 620, radius: 90 },
    ],
    reward: 400,
    wantedOnStart: 0,
  },
  {
    id: 'neon-getaway',
    title: '2 · Neon Getaway',
    giver: 'Vera Solano',
    brief: 'A rival crew left a coral sports car by the plaza. Steal it and bring it to the lockup on Harbor Lane — the cops will be watching.',
    steps: [
      { kind: 'steal', label: 'Steal the coral sports car at the plaza', x: 1720, y: 1280, radius: 110 },
      { kind: 'goto', label: 'Deliver the car to the lockup', x: 3020, y: 2060, radius: 100 },
    ],
    reward: 900,
    wantedOnStart: 2,
  },
  {
    id: 'harbor-heist',
    title: '3 · Harbor Heist',
    giver: 'Vera Solano',
    brief: 'The harbor vault is lightly guarded tonight. Grab the cash, then lose the heat and reach the hideout. Finish this and Neon Bay is yours.',
    steps: [
      { kind: 'grab', label: 'Grab the cash at the harbor vault', x: 620, y: 1240, radius: 90 },
      { kind: 'escape', label: 'Lose the cops, then reach the hideout', x: 2620, y: 620, radius: 100 },
    ],
    reward: 2000,
    wantedOnStart: 3,
  },
];

export const CAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#4361ee', '#ffbe0b', '#fb5607',
  '#8338ec', '#06d6a0', '#e0e0e0', '#22223b', '#ff70a6', '#80ed99',
];

export const CAR_MODELS = [
  { name: 'Civic hatch', len: 74, wid: 36, top: 1.0 },
  { name: 'Sedan', len: 84, wid: 38, top: 1.05 },
  { name: 'Sports coupe', len: 80, wid: 36, top: 1.35 },
  { name: 'Pickup', len: 92, wid: 40, top: 0.95 },
  { name: 'Taxi cab', len: 82, wid: 38, top: 1.0 },
  { name: 'Van', len: 96, wid: 42, top: 0.85 },
];

export const PED_NAMES = [
  'Mara', 'Theo', 'Luz', 'Ravi', 'Ana', 'Kiko', 'Sofia', 'Dario',
  'Ines', 'Marco', 'Lena', 'Omar', 'Rosa', 'Felix', 'Nadia', 'Ben',
];
