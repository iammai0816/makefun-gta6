// HUD, minimap, menus and messages: everything drawn over the world.
import { CONFIG, PALETTE } from './config.js';
import { clamp } from './rng.js';

export function drawHUD(ctx, game) {
  const { player, police, missions, time } = game;
  const W = CONFIG.viewW, H = CONFIG.viewH;
  ctx.save();
  // Top-left: wanted stars + cash + health + ammo
  ctx.fillStyle = PALETTE.hudBg;
  roundPanel(ctx, 12, 12, 300, 96, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < police.wanted ? '★' : '☆';
  ctx.fillText(stars, 24, 44);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('$' + player.cash.toLocaleString('en-US'), 24, 72);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#7ee787';
  ctx.fillText('♥ ' + Math.round(player.health), 150, 72);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('Ammo ' + player.ammo, 24, 96);
  ctx.fillStyle = '#9ecbff';
  ctx.fillText(player.inCar ? 'DRIVING — ' + (player.car ? player.car.model.name : '') : 'ON FOOT', 150, 96);

  // Mission objective bar
  ctx.fillStyle = PALETTE.hudBg;
  roundPanel(ctx, 12, 118, 460, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('◆ ' + missions.objectiveText(), 22, 140);

  // Mission message toast
  if (missions.messageTimer > 0) {
    ctx.globalAlpha = clamp(missions.messageTimer, 0, 1);
    ctx.fillStyle = 'rgba(10,14,34,0.88)';
    roundPanel(ctx, W / 2 - 330, 12, 660, 54, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, missions.message, W / 2, 32, 630, 18);
    ctx.restore();
    ctx.save();
  }

  // Bottom-left: controls hint
  ctx.fillStyle = 'rgba(8,12,30,0.6)';
  roundPanel(ctx, 12, H - 44, 560, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#cfd6ff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move / drive · E enter or steal car · Space / click shoot · M mission · P pause · H help', 22, H - 23);

  // Speedometer when driving
  if (player.inCar && player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.32);
    ctx.fillStyle = PALETTE.hudBg;
    roundPanel(ctx, W - 190, H - 84, 178, 72, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(kmh + '', W - 40, H - 40);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#9ecbff';
    ctx.fillText('km/h', W - 40, H - 20);
  }

  // Damage flash
  if (player.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,30,30,' + (player.hurtFlash * 0.5) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  // Low-health vignette
  if (player.health < 30) {
    const pulse = 0.10 + 0.06 * Math.sin(time * 5);
    ctx.fillStyle = 'rgba(255,0,0,' + pulse + ')';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

export function drawMinimap(ctx, game) {
  const size = 190;
  const x0 = CONFIG.viewW - size - 12, y0 = 12;
  const sx = size / CONFIG.worldW, sy = size / CONFIG.worldH;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,30,0.78)';
  roundPanel(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Ocean + sand
  ctx.fillStyle = '#155a8a';
  ctx.fillRect(x0, y0, CONFIG.beachW * sx, size);
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(x0 + CONFIG.beachW * sx, y0, 8, size);
  ctx.fillStyle = '#2e7d4f';
  ctx.fillRect(x0 + CONFIG.beachW * sx + 8, y0, size, size);
  // Roads
  ctx.strokeStyle = '#555a66';
  ctx.lineWidth = 3;
  for (const vx of game.city.vRoads) {
    ctx.beginPath(); ctx.moveTo(x0 + vx * sx, y0); ctx.lineTo(x0 + vx * sx, y0 + size); ctx.stroke();
  }
  for (const hy of game.city.hRoads) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + hy * sy); ctx.lineTo(x0 + size, y0 + hy * sy); ctx.stroke();
  }
  // Mission target
  const t = game.missions.targetPos();
  if (t) {
    const pulse = 5 + 2 * Math.sin(game.time * 6);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x0 + t.x * sx, y0 + t.y * sy, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  }
  // Police
  ctx.fillStyle = '#4aa8ff';
  for (const c of game.police.cars) {
    ctx.beginPath(); ctx.arc(x0 + c.x * sx, y0 + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NEON BAY', x0, y0 + size + 22);
}

export function drawStartScreen(ctx, game) {
  const W = CONFIG.viewW, H = CONFIG.viewH;
  // Sunset gradient sky over a stylised skyline
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1035');
  g.addColorStop(0.45, '#7b2d8b');
  g.addColorStop(0.75, '#ff6b6b');
  g.addColorStop(1, '#ffb347');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(W * 0.14, 150, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,63,0.25)';
  ctx.beginPath(); ctx.arc(W * 0.14, 150, 84, 0, Math.PI * 2); ctx.fill();
  // Skyline
  ctx.fillStyle = '#160f2e';
  const skyline = [120, 200, 150, 260, 180, 230, 140, 290, 170, 210, 130, 250];
  let sx = 0;
  const neon = ['#ff2e88', '#22d3ee', '#ffd23f', '#a855f7'];
  for (let i = 0; i < skyline.length; i++) {
    const w = W / skyline.length;
    const top = H - 190 - skyline[i];
    ctx.fillStyle = '#160f2e';
    ctx.fillRect(sx, top, w - 6, skyline[i] + 190);
    // Lit windows inside this building only.
    for (let wy = top + 18; wy < H - 210; wy += 34) {
      for (let wx = sx + 12; wx < sx + w - 18; wx += 26) {
        if ((wx * 7 + wy * 3 + i) % 5 === 0) continue;
        ctx.fillStyle = neon[(wx + wy + i) % neon.length];
        ctx.fillRect(wx, wy, 7, 9);
      }
    }
    sx += w;
  }
  // Ocean strip
  ctx.fillStyle = '#155a8a';
  ctx.fillRect(0, H - 60, W, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 8; i++) ctx.fillRect((i * 173 + 40) % W, H - 44 + (i % 3) * 12, 60, 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 92px sans-serif';
  ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 34;
  ctx.fillText('NEON BAY', W / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('AN ORIGINAL OPEN-WORLD CRIME GAME', W / 2, 232);
  ctx.fillStyle = '#e8ecff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Explore a sun-soaked coastal city on foot and by car. Steal cars,', W / 2, 300);
  ctx.fillText('outrun the Neon Bay police, and run three story jobs for fixer Vera Solano.', W / 2, 326);
  const blink = 0.85 + 0.15 * Math.sin(game.time * 4);
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('PRESS ENTER OR CLICK TO START', W / 2, 420);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#cfd6ff';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD / arrows move & drive · E enter or steal a car · Space / click shoot', W / 2, 470);
  ctx.fillText('M start mission · P pause · Mute with N · Progress saves automatically', W / 2, 494);
  if (game.saveExists) {
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Saved game found — press C to continue, or Enter for a new game', W / 2, 540);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px sans-serif';
  ctx.fillText('A fictional city. No real places, people or games are depicted.', W / 2, H - 76);
}

export function drawPauseScreen(ctx, game) {
  ctx.fillStyle = 'rgba(5,8,22,0.72)';
  ctx.fillRect(0, 0, CONFIG.viewW, CONFIG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSED', CONFIG.viewW / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#cfd6ff';
  ctx.fillText('P resume · M mission · N mute sound · R restart from save', CONFIG.viewW / 2, 350);
  ctx.fillText('Cash $' + game.player.cash + ' · Missions done ' + game.missions.completed.length + ' / 3', CONFIG.viewW / 2, 382);
}

export function drawGameOver(ctx, game, kind) {
  ctx.fillStyle = 'rgba(5,8,22,0.8)';
  ctx.fillRect(0, 0, CONFIG.viewW, CONFIG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#4aa8ff' : '#ff5555';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED!' : 'WASTED', CONFIG.viewW / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(kind === 'busted'
    ? 'The Neon Bay police caught you. You paid $100 bail and walked free.'
    : 'You went down in Neon Bay. The hospital patched you up for $100.', CONFIG.viewW / 2, 350);
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('PRESS ENTER TO KEEP PLAYING', CONFIG.viewW / 2, 420);
}

export function drawHelpOverlay(ctx) {
  ctx.fillStyle = 'rgba(5,8,22,0.85)';
  roundPanel(ctx, 320, 130, 640, 460, 14);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('HOW TO PLAY NEON BAY', 350, 175);
  ctx.fillStyle = '#e8ecff';
  ctx.font = '16px sans-serif';
  const lines = [
    'Move / drive: WASD or arrow keys. Hold Shift to sprint on foot.',
    'Enter or steal a car: walk up to a parked car and press E.',
    'Exit a car: press E again.',
    'Shoot: Space or left click (aims at the mouse). Punch when unarmed.',
    'Start a mission: press M, then follow the gold marker.',
    'Wanted stars: stealing, shooting and hitting people raise the heat.',
    'Lose the cops: stay out of sight and the stars fade, one at a time.',
    'Police cars will ram your car and bust you on foot if they catch you.',
    'Missions: 3 story jobs from Vera Solano. Each pays cash on completion.',
    'Save: your cash, missions and position save automatically.',
    'Pause: P.  Mute: N.  Restart: R (from the pause screen).',
  ];
  lines.forEach((l, i) => ctx.fillText('•  ' + l, 350, 210 + i * 30));
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Press H or Esc to close', 350, 560);
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

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
  return lines.length;
}
