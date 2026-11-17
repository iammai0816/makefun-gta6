// Neon Bay — the city: a sun-soaked coastal grid. Roads every 400px, building
// blocks between them, a palm-lined beach on the east edge, parks and a plaza.
// All art is drawn vector shapes on canvas; nothing is borrowed.
import { makeRng, pick, rangeInt } from './rng.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD = 400; // block pitch
export const ROAD_W = 64;

const PALETTE = ['#ff5d8f', '#ffb347', '#4ecdc4', '#7c5cff', '#ff6b6b', '#2ec4b6', '#f9c74f', '#e07a5f'];
const ROOFS = ['#e8e0d0', '#d9c9a8', '#cfe3e0', '#f2d8d8', '#d8e2f2'];

export function createCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  // Beach strip on the east edge.
  const beach = { x: WORLD_W - 220, y: 0, w: 220, h: WORLD_H };
  for (let bx = 0; bx < WORLD_W - 260; bx += ROAD) {
    for (let by = 0; by < WORLD_H; by += ROAD) {
      const x0 = bx + ROAD_W / 2 + 14, y0 = by + ROAD_W / 2 + 14;
      const w = ROAD - ROAD_W - 28, h = ROAD - ROAD_W - 28;
      const roll = rng();
      if (roll < 0.12) {
        parks.push({ x: x0, y: y0, w, h });
        for (let i = 0; i < 6; i++) trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, r: 10 + rng() * 8 });
        continue;
      }
      // 1-3 buildings per block.
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const bw = 70 + rng() * 90, bh = 70 + rng() * 90;
        const bx2 = x0 + rng() * Math.max(1, w - bw), by2 = y0 + rng() * Math.max(1, h - bh);
        buildings.push({
          x: bx2, y: by2, w: bw, h: bh,
          color: pick(rng, PALETTE), roof: pick(rng, ROOFS),
          height: rangeInt(rng, 1, 4),
        });
      }
      for (let i = 0; i < 2; i++) trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, r: 8 + rng() * 6 });
    }
  }
  // Named districts, purely original.
  const districts = [
    { name: 'MARINA ROW', x: 200, y: 120 },
    { name: 'PALM COURT', x: 1500, y: 520 },
    { name: 'SUNSET STRIP', x: 700, y: 1500 },
    { name: 'NEON BAY', x: 2500, y: 2000 },
  ];
  return { seed, buildings, trees, parks, beach, districts };
}

export function isOnRoad(x, y) {
  const mx = ((x % ROAD) + ROAD) % ROAD, my = ((y % ROAD) + ROAD) % ROAD;
  return mx < ROAD_W || my < ROAD_W;
}
export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function nearestRoadPoint(x, y) {
  // Snap to the centre of the nearest road lane.
  const gx = Math.round(x / ROAD) * ROAD + ROAD_W / 2;
  const gy = Math.round(y / ROAD) * ROAD + ROAD_W / 2;
  return Math.abs(x - gx) < Math.abs(y - gy) ? { x: gx, y } : { x, y: gy };
}

export function drawCity(ctx, city, cam) {
  const { x: cx, y: cy, w: vw, h: vh } = cam;
  // Ground: warm sand-tinted asphalt base (screen-aligned).
  ctx.fillStyle = '#e9d8a6';
  ctx.fillRect(cx, cy, vw, vh);
  // Everything below is drawn in world coordinates.
  ctx.save();
  ctx.translate(-cx, -cy);
  // Sidewalk blocks.
  ctx.fillStyle = '#d9c48f';
  for (let bx = 0; bx < WORLD_W; bx += ROAD) {
    for (let by = 0; by < WORLD_H; by += ROAD) {
      const x0 = bx + ROAD_W / 2, y0 = by + ROAD_W / 2;
      if (x0 > cx + vw || y0 > cy + vh || x0 + ROAD - ROAD_W < cx || y0 + ROAD - ROAD_W < cy) continue;
      ctx.fillRect(x0, y0, ROAD - ROAD_W, ROAD - ROAD_W);
    }
  }
  // Roads.
  ctx.fillStyle = '#3a3f4a';
  for (let x = 0; x < WORLD_W; x += ROAD) ctx.fillRect(x, cy, ROAD_W, vh);
  for (let y = 0; y < WORLD_H; y += ROAD) ctx.fillRect(cx, y, WORLD_W, ROAD_W);
  // Lane dashes.
  ctx.fillStyle = '#f7d154';
  for (let x = 0; x < WORLD_W; x += ROAD) {
    for (let y = 0; y < WORLD_H; y += 48) ctx.fillRect(x + ROAD_W / 2 - 2, y, 4, 22);
  }
  for (let y = 0; y < WORLD_H; y += ROAD) {
    for (let x = 0; x < WORLD_W; x += 48) ctx.fillRect(x, y + ROAD_W / 2 - 2, 22, 4);
  }
  // Beach + sea on the east edge.
  ctx.fillStyle = '#f6e3b4';
  ctx.fillRect(city.beach.x, cy, city.beach.w, vh);
  ctx.fillStyle = '#2ec4e6';
  ctx.fillRect(WORLD_W - 40, cy, 40, vh);
  ctx.fillStyle = '#7fd8f0';
  for (let y = 0; y < WORLD_H; y += 90) ctx.fillRect(WORLD_W - 40, y + ((y * 7) % 40), 40, 6);
  // Parks.
  for (const p of city.parks) {
    if (p.x > cx + vw || p.y > cy + vh || p.x + p.w < cx || p.y + p.h < cy) continue;
    ctx.fillStyle = '#7ec850'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#a5dd85'; ctx.fillRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20);
  }
  // Buildings with a simple shadow + roof + windows.
  for (const b of city.buildings) {
    if (b.x > cx + vw || b.y > cy + vh || b.x + b.w < cx || b.y + b.h < cy) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 12);
    }
    if (b.height >= 3) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + b.w - 18, b.y + 8, 8, 14); }
  }
  // Palm trees.
  for (const t of city.trees) {
    if (t.x < cx - 30 || t.x > cx + vw + 30 || t.y < cy - 30 || t.y > cy + vh + 30) continue;
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    ctx.fillStyle = '#2fae5f';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57cc7a';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // District labels.
  ctx.fillStyle = 'rgba(20,20,40,0.55)';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of city.districts) {
    if (d.x < cx - 100 || d.x > cx + vw + 100 || d.y < cy - 40 || d.y > cy + vh + 40) continue;
    ctx.fillText(d.name, d.x, d.y);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
