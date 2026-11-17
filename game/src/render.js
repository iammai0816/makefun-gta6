// World rendering: camera, ground, ocean, beach, roads, parks, buildings
// with neon signs, palms, markers, bullets and particles.
import { CONFIG, PALETTE } from './config.js';
import { clamp } from './rng.js';
import { drawCar } from './vehicles.js';
import { drawPedestrian } from './pedestrians.js';

export function drawWorld(ctx, game) {
  const { city, camera, time } = game;
  const W = CONFIG.viewW, H = CONFIG.viewH;
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  const vx0 = camera.x - 80, vy0 = camera.y - 80;
  const vx1 = camera.x + W + 80, vy1 = camera.y + H + 80;

  // Ground
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Mowing stripes
  ctx.fillStyle = PALETTE.grassDark;
  for (let y = Math.floor(vy0 / 160) * 160; y < vy1; y += 320) {
    ctx.fillRect(vx0, y, vx1 - vx0, 160);
  }
  // Ocean (west) + beach
  ctx.fillStyle = PALETTE.oceanDeep;
  ctx.fillRect(vx0, vy0, CONFIG.beachW - 120 < vx0 ? 0 : Math.min(vx1, CONFIG.beachW - 120) - vx0, vy1 - vy0);
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(Math.max(vx0, CONFIG.beachW - 120), vy0, Math.min(vx1, CONFIG.beachW) - Math.max(vx0, CONFIG.beachW - 120), vy1 - vy0);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = Math.floor(vy0 / 90) * 90; y < vy1; y += 90) {
    const off = (Math.sin(time * 1.4 + y * 0.05) * 14);
    ctx.fillRect(CONFIG.beachW - 100 + off, y, 70, 3);
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(vx0, CONFIG.beachW), vy0, Math.min(vx1, CONFIG.beachW + 40) - Math.max(vx0, CONFIG.beachW), vy1 - vy0);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = Math.floor(vy0 / 46) * 46; y < vy1; y += 46) {
    ctx.fillRect(Math.max(vx0, CONFIG.beachW + 8), y, 3, 3);
  }

  // Parks
  for (const p of city.parks) {
    if (p.x + p.w / 2 < vx0 || p.x - p.w / 2 > vx1 || p.y + p.h / 2 < vy0 || p.y - p.h / 2 > vy1) continue;
    ctx.fillStyle = '#3f9e57';
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.fillStyle = '#79c98f';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.min(p.w, p.h) * 0.22, 0, Math.PI * 2); ctx.fill();
  }

  // Roads + sidewalks + lane markings
  for (const vx of city.vRoads) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx - CONFIG.roadW / 2 - 10, vy0, CONFIG.roadW + 20, vy1 - vy0);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(vx - CONFIG.roadW / 2, vy0, CONFIG.roadW, vy1 - vy0);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath(); ctx.moveTo(vx, vy0); ctx.lineTo(vx, vy1); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const hy of city.hRoads) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(vx0, hy - CONFIG.roadW / 2 - 10, vx1 - vx0, CONFIG.roadW + 20);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(vx0, hy - CONFIG.roadW / 2, vx1 - vx0, CONFIG.roadW);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath(); ctx.moveTo(vx0, hy); ctx.lineTo(vx1, hy); ctx.stroke();
    ctx.setLineDash([]);
  }
  // Crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const vx of city.vRoads) {
    for (const hy of city.hRoads) {
      if (vx < vx0 - 60 || vx > vx1 + 60 || hy < vy0 - 60 || hy > vy1 + 60) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(vx - 34 + i * 10, hy - CONFIG.roadW / 2 + 4, 5, 12);
        ctx.fillRect(vx - 34 + i * 10, hy + CONFIG.roadW / 2 - 16, 5, 12);
      }
    }
  }

  // Buildings
  for (const b of city.buildings) {
    if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Windows
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c * 7 + r * 3 + b.floors) % 4 === 0) continue;
        ctx.fillRect(b.x + 8 + c * 26, b.y + 8 + r * 26, 12, 14);
      }
    }
    // Roof edge
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 8);
  }

  // Neon signs (glow + text)
  ctx.textAlign = 'center';
  for (const s of city.neonSigns) {
    if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + s.x);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = s.color;
    ctx.font = 'bold 15px sans-serif';
    ctx.shadowColor = s.color; ctx.shadowBlur = 14;
    ctx.fillText(s.text, s.x, s.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // District labels
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 22px sans-serif';
  for (const d of city.districts) {
    if (d.x < vx0 || d.x > vx1 || d.y < vy0 || d.y > vy1) continue;
    ctx.fillText(d.name.toUpperCase(), d.x, d.y);
  }

  // Palm trees
  for (const p of city.palms) {
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
    drawPalm(ctx, p.x, p.y, p.s, time);
  }

  // Mission marker
  const target = game.missions.targetPos();
  if (target) drawMarker(ctx, target, time);

  // Parked + traffic cars
  for (const c of game.parkedCars) drawCar(ctx, c, false);
  for (const c of game.traffic) drawCar(ctx, c, false);
  for (const c of game.police.cars) drawCar(ctx, c, false);
  if (game.missions.targetCar) drawCar(ctx, game.missions.targetCar, false);
  if (game.player.inCar && game.player.car) drawCar(ctx, game.player.car, true);

  // Pedestrians
  for (const p of game.peds) drawPedestrian(ctx, p, time);

  // Player on foot
  if (!game.player.inCar) game.player.draw(ctx);

  // Bullets
  for (const b of game.bullets) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,109,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - Math.cos(b.angle) * 18, b.y - Math.sin(b.angle) * 18); ctx.stroke();
  }

  // Particles
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Wanted flash ring around player when heat is high
  if (game.police.wanted >= 3) {
    const px = game.player.inCar && game.player.car ? game.player.car.x : game.player.x;
    const py = game.player.inCar && game.player.car ? game.player.car.y : game.player.y;
    ctx.strokeStyle = 'rgba(255,40,60,' + (0.35 + 0.2 * Math.sin(time * 8)) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, 70 + 8 * Math.sin(time * 8), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPalm(ctx, x, y, s, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#7a4a2b';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(3, -14, 0, -26); ctx.stroke();
  const sway = Math.sin(time * 1.2 + x * 0.01) * 0.12;
  ctx.strokeStyle = '#2f9e4f';
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + sway;
    ctx.beginPath(); ctx.moveTo(0, -26);
    ctx.quadraticCurveTo(Math.cos(a) * 14, -26 + Math.sin(a) * 14 - 6, Math.cos(a) * 22, -26 + Math.sin(a) * 22 + 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath(); ctx.arc(2, -24, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-3, -22, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMarker(ctx, target, time) {
  const pulse = 1 + 0.18 * Math.sin(time * 5);
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, target.radius * 0.55, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.16)';
  ctx.fill();
  // Floating diamond
  const bobY = -46 + Math.sin(time * 3) * 6;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(0, bobY - 16); ctx.lineTo(12, bobY); ctx.lineTo(0, bobY + 16); ctx.lineTo(-12, bobY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  // Off-screen direction arrow is handled by the HUD edge indicator in main.js.
}

export function drawOffscreenArrow(ctx, game) {
  const t = game.missions.targetPos();
  if (!t) return;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  const cx = game.camera.x + CONFIG.viewW / 2;
  const cy = game.camera.y + CONFIG.viewH / 2;
  const dx = t.x - cx, dy = t.y - cy;
  const onScreen = Math.abs(dx) < CONFIG.viewW / 2 - 40 && Math.abs(dy) < CONFIG.viewH / 2 - 40;
  if (onScreen) return;
  const ang = Math.atan2(dy, dx);
  const ex = CONFIG.viewW / 2 + Math.cos(ang) * (CONFIG.viewW / 2 - 60);
  const ey = CONFIG.viewH / 2 + Math.sin(ang) * (CONFIG.viewH / 2 - 60);
  const distM = Math.round(Math.hypot(dx, dy) / 10) * 10;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, -13); ctx.lineTo(-6, 0); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(distM + 'm', ex, ey + 30);
}
