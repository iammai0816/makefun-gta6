// Pedestrians: named locals who stroll the sidewalks, panic and flee
// from gunfire and speeding cars, and occasionally cross the road.
import { CONFIG, PED_NAMES } from './config.js';
import { makeRng, pick, range, rangeInt, clamp, angleTo, dist } from './rng.js';
import { isOnRoad, randomStreetPoint } from './city.js';

export function spawnPedestrians(rng, count, city, avoid) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomStreetPoint(rng, city);
    peds.push({
      name: pick(rng, PED_NAMES),
      x: p.x + range(rng, -50, 50), y: p.y + range(rng, -50, 50),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 34, 62),
      hue: rangeInt(rng, 0, 359),
      shirt: pick(rng, ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#f9a8d4', '#93c5fd', '#fdba74']),
      panic: 0, state: 'walk', wanderTimer: range(rng, 1, 4),
      bob: range(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

export function updatePedestrians(dt, peds, city, danger) {
  for (const p of peds) {
    p.bob += dt * 8;
    if (p.panic > 0) {
      p.panic -= dt;
      p.state = 'flee';
      const d = dist(p.x, p.y, danger.x, danger.y);
      if (d < 420) {
        const a = angleTo(danger.x, danger.y, p.x, p.y);
        p.angle = a;
        p.speed = 190;
      }
    } else {
      p.state = 'walk';
      p.wanderTimer -= dt;
      if (p.wanderTimer <= 0) {
        p.wanderTimer = 2 + Math.random() * 4;
        p.angle += -1.4 + Math.random() * 2.8;
        p.speed = 34 + Math.random() * 28;
      }
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (nx > 40 && nx < CONFIG.worldW - 40 && ny > 40 && ny < CONFIG.worldH - 40) {
      p.x = nx; p.y = ny;
    } else {
      p.angle += Math.PI;
    }
  }
}

export function scareNearby(peds, x, y, radius, amount) {
  for (const p of peds) {
    if (dist(p.x, p.y, x, y) < radius) p.panic = Math.max(p.panic, amount);
  }
}

export function drawPedestrian(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = Math.sin(p.bob) * (p.state === 'flee' ? 3 : 1.5);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle + Math.PI / 2);
  // Legs
  ctx.strokeStyle = '#2b2d42';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-3, 0); ctx.lineTo(-3 - bob, 10);
  ctx.moveTo(3, 0); ctx.lineTo(3 + bob, 10);
  ctx.stroke();
  // Body
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-8, -2, 16, 8);
  // Head
  ctx.fillStyle = `hsl(${p.hue}, 45%, 72%)`;
  ctx.beginPath(); ctx.arc(0, -12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(0, -14, 7, Math.PI, Math.PI * 2); ctx.fill();
  if (p.state === 'flee') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -24);
  }
  ctx.restore();
}
