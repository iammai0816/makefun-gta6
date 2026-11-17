// Neon Bay — pedestrians: beach-goers, shoppers and joggers who stroll the
// sidewalks, flee from gunfire and crime, and get knocked down.
import { makeRng, pick, range, clamp, dist } from './rng.js';
import { WORLD_W, WORLD_H, collidesBuilding } from './city.js';

const SHIRTS = ['#ff6b81', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#c8d64f'];
const NAMES = ['Mara', 'Theo', 'Luz', 'Dario', 'Sofia', 'Kai', 'Nina', 'Ben', 'Aya', 'Rosa'];

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    peds.push({
      x: 100 + rng() * (WORLD_W - 400), y: 100 + rng() * (WORLD_H - 200),
      angle: rng() * Math.PI * 2, speed: 28 + rng() * 30,
      shirt: pick(rng, SHIRTS), name: pick(rng, NAMES),
      health: 100, down: false, fleeing: false, knocked: false, knockTimer: 0,
      walkPhase: rng() * 6, retarget: rng() * 4,
    });
  }
  return peds;
}

export function updatePeds(peds, player, city, dt, world) {
  for (const p of peds) {
    if (p.down) continue;
    p.knockTimer = Math.max(0, p.knockTimer - dt);
    // Flee from the player when wanted or after a scare.
    const dPlayer = dist(p.x, p.y, player.x, player.y);
    const scared = world.wanted > 0 && dPlayer < 260;
    if (scared || p.fleeing) {
      p.fleeing = true;
      const a = Math.atan2(p.y - player.y, p.x - player.x);
      p.angle = a;
      p.x += Math.cos(a) * 110 * dt;
      p.y += Math.sin(a) * 110 * dt;
      if (dPlayer > 500) p.fleeing = false;
    } else {
      p.retarget -= dt;
      if (p.retarget <= 0) {
        p.retarget = 2 + Math.random() * 4;
        p.angle = Math.random() * Math.PI * 2;
      }
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!collidesBuilding(city, nx, ny, 10) && nx > 30 && ny > 30 && nx < WORLD_W - 60 && ny < WORLD_H - 30) {
        p.x = nx; p.y = ny;
      } else {
        p.angle += Math.PI / 2;
      }
    }
    p.x = clamp(p.x, 30, WORLD_W - 60);
    p.y = clamp(p.y, 30, WORLD_H - 30);
    p.walkPhase += dt * 6;
    // Get back up after being knocked down (unless killed).
    if (p.knocked && p.knockTimer <= 0 && p.health > 0) { p.knocked = false; p.down = false; }
  }
}

export function drawPeds(ctx, peds, cam) {
  for (const p of peds) {
    const x = p.x - cam.x, y = p.y - cam.y;
    if (x < -30 || y < -30 || x > cam.w + 30 || y > cam.h + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    if (p.down || p.knocked) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 3, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.shirt; ctx.fillRect(-11, -6, 22, 12);
      ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(14, 0, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.rotate(p.angle);
      const swing = Math.sin(p.walkPhase) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 3, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.shirt; ctx.fillRect(-8, -6, 14, 12);
      ctx.fillStyle = '#2f3542'; ctx.fillRect(-11, -5, 5, 10);
      ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(9, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c29b';
      ctx.fillRect(-2, -9, 6, 4); ctx.fillRect(-2 + swing * 0.4, 5, 6, 4);
    }
    ctx.restore();
  }
}
