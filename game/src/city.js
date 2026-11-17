// Neon Bay itself: a fictional sun-soaked coastal city on a road grid,
// with a beach and ocean on the west edge, a harbor in the south-west,
// parks, plazas, buildings and palm trees. All names are invented.
import { CONFIG, PALETTE } from './config.js';
import { makeRng, pick, range, rangeInt } from './rng.js';

export const DISTRICTS = [
  { name: 'Coral Row', x: 2300, y: 300, r: 420 },
  { name: 'Plaza Neon', x: 1700, y: 1300, r: 380 },
  { name: 'Harbor Lane', x: 700, y: 1900, r: 420 },
  { name: 'Sunset Marina', x: 500, y: 2100, r: 300 },
  { name: 'Palm Heights', x: 2700, y: 1800, r: 420 },
];

export function roadCenters(size, gap, offset) {
  const lines = [];
  for (let v = offset; v <= size; v += gap) lines.push(v);
  return lines;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const { worldW, worldH, roadGap, beachW } = CONFIG;
  const vRoads = roadCenters(worldW, roadGap, 560);
  const hRoads = roadCenters(worldH, roadGap, 560);
  const buildings = [];
  const palms = [];
  const parks = [];
  const neonSigns = [];

  const signTexts = ['NEON BAY', 'TACO SOL', 'HOTEL PALMA', 'ARCADE', 'SURF SHOP', 'DISCO SOL', 'PIZZA LUNA', 'GYM 24'];
  const signColors = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonYellow, PALETTE.neonPurple];

  // Buildings fill the blocks between roads, skipping the beach strip.
  for (let i = 0; i < vRoads.length - 1; i++) {
    for (let j = 0; j < hRoads.length - 1; j++) {
      const x0 = vRoads[i] + 70, x1 = vRoads[i + 1] - 70;
      const y0 = hRoads[j] + 70, y1 = hRoads[j + 1] - 70;
      if (x0 < beachW + 60) continue; // beach strip stays open
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p++) {
          palms.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), s: range(rng, 0.8, 1.3) });
        }
        continue;
      }
      const n = rangeInt(rng, 1, 3);
      for (let b = 0; b < n; b++) {
        const w = range(rng, 90, Math.max(100, (x1 - x0) / n - 20));
        const h = range(rng, 80, 150);
        const x = x0 + (b * (x1 - x0)) / n + range(rng, 8, 24);
        const y = y0 + range(rng, 10, Math.max(12, y1 - y0 - h - 10));
        const hue = pick(rng, ['#5b6b8c', '#7d5a6e', '#4a7a6a', '#8c6b4a', '#6a5b8c', '#3f5a7a', '#94556a']);
        buildings.push({ x, y, w, h, color: hue, floors: rangeInt(rng, 1, 5) });
        if (rng() < 0.5) {
          neonSigns.push({
            x: x + w / 2, y: y - 6, text: pick(rng, signTexts),
            color: pick(rng, signColors),
          });
        }
      }
      // A few palms along the block edge.
      if (rng() < 0.6) palms.push({ x: range(rng, x0, x1), y: y0 + 8, s: range(rng, 0.8, 1.2) });
    }
  }

  // Palm-lined beach promenade.
  for (let y = 120; y < worldH - 80; y += 130) {
    palms.push({ x: beachW - 40 + range(rng, -14, 14), y, s: range(rng, 0.9, 1.4) });
  }

  return { seed, vRoads, hRoads, buildings, palms, parks, neonSigns, districts: DISTRICTS };
}

export function isOnRoad(city, x, y) {
  const half = CONFIG.roadW / 2;
  for (const vx of city.vRoads) if (Math.abs(x - vx) < half) return true;
  for (const hy of city.hRoads) if (Math.abs(y - hy) < half) return true;
  return false;
}

export function nearestRoadPoint(city, x, y) {
  let best = null, bestD = Infinity;
  for (const vx of city.vRoads) {
    const d = Math.abs(x - vx);
    if (d < bestD) { bestD = d; best = { x: vx, y, vertical: true }; }
  }
  for (const hy of city.hRoads) {
    const d = Math.abs(y - hy);
    if (d < bestD) { bestD = d; best = { x, y: hy, vertical: false }; }
  }
  return best;
}

export function collidesWithBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function randomStreetPoint(rng, city) {
  const vertical = rng() < 0.5;
  if (vertical) {
    return { x: pick(rng, city.vRoads) + range(rng, -18, 18), y: range(rng, 200, CONFIG.worldH - 200) };
  }
  return { x: range(rng, CONFIG.beachW + 150, CONFIG.worldW - 200), y: pick(rng, city.hRoads) + range(rng, -18, 18) };
}
