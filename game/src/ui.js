// Neon Bay — HUD, minimap, menus, messages, and the localStorage save.
// Save keeps money + mission progress only; the city itself is regenerated.
import { WORLD_W, WORLD_H } from './city.js';
import { MISSIONS } from './missions.js';

const SAVE_KEY = 'neon-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.money !== 'number' || typeof s.missionIndex !== 'number') return null;
    return s;
  } catch { return null; }
}

export function writeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

export function drawHUD(ctx, world) {
  const p = world.player;
  const W = world.viewW, H = world.viewH;
  // Top-left: cash + health + ammo.
  ctx.fillStyle = 'rgba(10,12,24,0.72)';
  roundPanel(ctx, 12, 12, 250, 92, 10); ctx.fill();
  ctx.fillStyle = '#57cc7a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`$${p.money.toLocaleString()}`, 26, 44);
  ctx.fillStyle = '#f1f2f6';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`HEALTH ${Math.ceil(p.health)}`, 26, 66);
  ctx.fillStyle = '#2f3542'; ctx.fillRect(26, 72, 150, 8);
  ctx.fillStyle = p.health > 40 ? '#57cc7a' : '#ff5d5d';
  ctx.fillRect(26, 72, 150 * (p.health / 100), 8);
  ctx.fillStyle = '#f1f2f6';
  ctx.fillText(`AMMO ${p.ammo}   ${p.inCar ? 'DRIVING: ' + p.inCar.name : 'ON FOOT'}`, 26, 96);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,12,24,0.72)';
  roundPanel(ctx, W - 232, 12, 220, 52, 10); ctx.fill();
  ctx.font = '26px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < world.wanted ? '#ffd32a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 214 + i * 40, 48);
  }
  if (world.wanted > 0) {
    ctx.fillStyle = '#ff8a5d'; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(world.lastCrime || 'WANTED', W - 214, 60);
  }
  // Mission objective bar (top centre).
  const m = world.missions.active;
  const obj = m ? `${m.title}: ${m.objective}` : (world.missions.index >= MISSIONS.length ? 'Free roam — Neon Bay is yours' : 'Press M to start the next job');
  ctx.fillStyle = 'rgba(10,12,24,0.72)';
  const ow = Math.min(560, ctx.measureText(obj).width + 120);
  roundPanel(ctx, (W - ow) / 2, 12, ow, 40, 10); ctx.fill();
  ctx.fillStyle = '#ffd32a'; ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('◆ ' + obj, W / 2, 38);
  ctx.textAlign = 'left';
  // Controls hint (bottom-left).
  ctx.fillStyle = 'rgba(10,12,24,0.6)';
  roundPanel(ctx, 12, H - 56, 430, 44, 8); ctx.fill();
  ctx.fillStyle = '#dfe4ea'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move · E steal / exit car · F punch · Click shoot · M mission · P pause · Mute: N', 24, H - 30);
  // Messages feed (bottom-centre).
  ctx.font = '14px system-ui, sans-serif';
  let y = H - 76;
  for (let i = world.messages.length - 1; i >= 0 && y > H - 200; i--) {
    const msg = world.messages[i];
    const alpha = Math.min(1, msg.life);
    ctx.fillStyle = `rgba(10,12,24,${0.65 * alpha})`;
    const w = ctx.measureText(msg.text).width + 20;
    roundPanel(ctx, (W - w) / 2, y - 18, w, 24, 6); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.textAlign = 'center';
    ctx.fillText(msg.text, W / 2, y);
    ctx.textAlign = 'left';
    y -= 30;
  }
  // Busted warning flash.
  if (world.bustedTimer > 0.4) {
    ctx.fillStyle = `rgba(255,45,85,${0.12 + 0.1 * Math.sin(world.time * 10)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff2d55'; ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THEY ARE ON YOU — RUN!', W / 2, 110);
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, world);
}

export function drawMinimap(ctx, world) {
  const W = world.viewW, H = world.viewH;
  const mw = 190, mh = 142, mx = W - mw - 14, my = H - mh - 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(10,12,24,0.78)';
  roundPanel(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8); ctx.fill();
  ctx.fillStyle = '#3a3f4a'; ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2ec4e6'; ctx.fillRect(mx + mw - 12, my, 12, mh);
  ctx.fillStyle = '#f6e3b4'; ctx.fillRect(mx + mw - 24, my, 12, mh);
  ctx.fillStyle = '#7ec850';
  for (const park of world.city.parks) ctx.fillRect(mx + park.x * sx, my + park.y * sy, park.w * sx, park.h * sy);
  ctx.fillStyle = '#ffd32a';
  const m = world.missions.active;
  if (m) { ctx.beginPath(); ctx.arc(mx + m.x * sx, my + m.y * sy, 5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff4757';
  for (const c of world.police.cars) { ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  // Player arrow.
  const px = mx + world.player.x * sx, py = my + world.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(world.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.strokeRect(mx, my, mw, mh);
  ctx.fillStyle = '#dfe4ea'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('NEON BAY', mx + 4, my - 8 + 0);
}

export function drawStartScreen(ctx, world) {
  const W = world.viewW, H = world.viewH;
  // Sunset gradient sky over the city backdrop.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ff7e5f'); g.addColorStop(0.5, '#feb47b'); g.addColorStop(1, '#2b1055');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffdf6b';
  ctx.beginPath(); ctx.arc(W * 0.86, H * 0.18, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,223,107,0.25)';
  ctx.beginPath(); ctx.arc(W * 0.86, H * 0.18, 80, 0, Math.PI * 2); ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#1a1033';
  let x = 0;
  const rngHeights = [70, 120, 90, 150, 100, 130, 80, 160, 95, 125, 75, 140];
  for (let i = 0; i < 12; i++) {
    const bw = W / 12;
    ctx.fillRect(x, H - 130 - rngHeights[i], bw - 6, 130 + rngHeights[i]);
    x += bw;
  }
  ctx.fillStyle = '#ff5d8f';
  ctx.fillRect(0, H - 130, W, 6);
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = '#ff5d8f'; ctx.shadowBlur = 30;
  ctx.fillText('NEON BAY', W / 2, H * 0.34);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME GAME', W / 2, H * 0.34 + 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Explore the city on foot and by car · Steal cars · Outrun the Bay City Police', W / 2, H * 0.52);
  ctx.fillText('Run jobs for Vera · Earn cash · Don\'t get busted', W / 2, H * 0.52 + 28);
  const save = world.saveData;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#2b1055';
  roundPanel(ctx, W / 2 - 170, H * 0.62, 340, 56, 12); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(save && save.money > 0 ? `CONTINUE — $${save.money} · Job ${Math.min(save.missionIndex + 1, 3)}/3` : '▶  PRESS ENTER TO START', W / 2, H * 0.62 + 36);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD move · E steal / exit car · F punch · Click to shoot · M next job · P pause', W / 2, H * 0.62 + 96);
  ctx.fillText('A fictional city. No real places, people or games — all original.', W / 2, H - 24);
  ctx.textAlign = 'left';
}

export function drawPauseScreen(ctx, world) {
  const W = world.viewW, H = world.viewH;
  ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('P resume · Enter restart · N mute', W / 2, H / 2 + 24);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, world, kind) {
  const W = world.viewW, H = world.viewH;
  ctx.fillStyle = kind === 'busted' ? 'rgba(120,10,30,0.82)' : 'rgba(10,10,30,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', W / 2, H / 2 - 40);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(`Cash kept: $${world.player.money.toLocaleString()} · Jobs done: ${world.missions.done.length}/3`, W / 2, H / 2 + 8);
  ctx.fillText('Press Enter to play again', W / 2, H / 2 + 48);
  ctx.textAlign = 'left';
}

function roundPanel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
