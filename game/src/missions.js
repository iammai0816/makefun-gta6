// Neon Bay — story missions. Three original jobs for Rook, handed out by
// "Vera", a fixer who runs the Marina Row docks. Complete them in order for cash.
import { dist } from './rng.js';

export const MISSIONS = [
  {
    id: 1, title: 'Pick Up the Package',
    brief: 'Vera: "A package is waiting at the Marina Row docks. Walk over and grab it. No trouble — yet."',
    objective: 'Reach the yellow marker at Marina Row',
    x: 260, y: 260, reward: 250, needsCar: false, kind: 'reach',
  },
  {
    id: 2, title: 'Lose the Heat',
    brief: 'Vera: "The package was hot. The cops are on you. Break their line of sight and stay hidden till the stars fade."',
    objective: 'Get wanted, then lose the police (stars to zero)',
    x: 1500, y: 1500, reward: 400, needsCar: false, kind: 'loseHeat',
  },
  {
    id: 3, title: 'Getaway Driver',
    brief: 'Vera: "Last job: drive the package to the Sunset Strip garage. Steal a car if you have to — just get there fast."',
    objective: 'Drive a car to the Sunset Strip garage',
    x: 900, y: 1700, reward: 750, needsCar: true, kind: 'driveTo',
  },
];

export function createMissions() {
  return { index: 0, active: null, done: [], started: false, heatWasWanted: false };
}

export function startNextMission(world) {
  const m = world.missions;
  if (m.index >= MISSIONS.length) { world.addMessage('All jobs done — Neon Bay is yours, Rook.'); return null; }
  const def = MISSIONS[m.index];
  m.active = { ...def, state: 'active' };
  m.started = true;
  m.heatWasWanted = false;
  world.addMessage(`NEW JOB: ${def.title} — ${def.objective}`);
  world.audio.pickup();
  if (def.id === 2 && !world.shotMode) {
    // The heat arrives on cue: a patrol spots the package.
    setTimeout(() => { if (world.missions.active && world.missions.active.id === 2) world.addWanted(2, 'Spotted with the package'); }, 1200);
  }
  return m.active;
}

export function updateMissions(world, dt) {
  const m = world.missions;
  if (!m.active) return;
  const p = world.player;
  const a = m.active;
  if (a.kind === 'loseHeat' && world.wanted > 0) m.heatWasWanted = true;
  let done = false;
  if (a.kind === 'reach' && dist(p.x, p.y, a.x, a.y) < 60) done = true;
  if (a.kind === 'driveTo' && p.inCar && dist(p.x, p.y, a.x, a.y) < 80) done = true;
  if (a.kind === 'loseHeat' && m.heatWasWanted && world.wanted === 0) done = true;
  if (done) completeMission(world);
}

function completeMission(world) {
  const m = world.missions;
  const a = m.active;
  m.done.push(a.id);
  world.player.money += a.reward;
  world.addMessage(`JOB DONE: ${a.title} — +$${a.reward}`);
  world.addFloatText(world.player.x, world.player.y - 34, `+$${a.reward}`, '#57cc7a');
  world.audio.missionDone();
  m.active = null;
  m.index += 1;
  world.save();
  if (m.index < MISSIONS.length) {
    setTimeout(() => startNextMission(world), 1500);
  } else {
    world.addMessage('STORY COMPLETE: Rook is the new name on the Bay. Free roam!');
  }
}

export function drawMissionMarker(ctx, mission, cam, time) {
  if (!mission) return;
  const x = mission.x - cam.x, y = mission.y - cam.y;
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffd32a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,211,42,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  // Beacon beam.
  ctx.fillStyle = 'rgba(255,211,42,0.35)';
  ctx.fillRect(-4, -90, 8, 90);
  ctx.fillStyle = '#ffd32a';
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Off-screen arrow pointing at the marker.
  const sx = Math.max(40, Math.min(cam.w - 40, x));
  const sy = Math.max(40, Math.min(cam.h - 40, y));
  if (x !== sx || y !== sy) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(y - sy, x - sx));
    ctx.fillStyle = '#ffd32a';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
