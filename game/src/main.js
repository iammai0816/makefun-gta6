// Neon Bay — game loop, state machine, camera, bullets, and the ?shot=
// screenshot states. Entry point loaded by game/index.html.
import { makeRng, clamp } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity, drawCity, WORLD_W, WORLD_H } from './city.js';
import { createPlayer, updatePlayer, playerPunch, playerShoot, drawPlayer } from './player.js';
import { spawnCars, updateCars, tryEnterCar, exitCar, drawCar, makeCar } from './vehicles.js';
import { createPolice, addWanted, updatePolice, drawOfficers } from './police.js';
import { spawnPeds, updatePeds, drawPeds } from './pedestrians.js';
import { createMissions, startNextMission, updateMissions, drawMissionMarker } from './missions.js';
import { loadSave, writeSave, drawHUD, drawStartScreen, drawPauseScreen, drawEndScreen } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10) || 1;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const audio = createAudio();
const saveData = loadSave();

const world = {
  state: 'start', // start | playing | paused | busted
  time: 0, viewW: canvas.width, viewH: canvas.height,
  player: null, city: null, cars: [], peds: [], police: null, missions: null,
  bullets: [], messages: [], floatTexts: [],
  wanted: 0, lastCrime: '', bustedTimer: 0, saveData,
  audio, cam: { x: 0, y: 0, w: 1280, h: 720 },
  save() { writeSave({ money: world.player.money, missionIndex: world.missions.index }); world.saveData = loadSave(); },
  addWanted(stars, reason) { addWanted(world, stars, reason); },
  addMessage(text) {
    world.messages.push({ text, life: 6 });
    if (world.messages.length > 5) world.messages.shift();
  },
  addFloatText(x, y, text, color) { world.floatTexts.push({ x, y, text, color, life: 1.2 }); },
};

function buildWorld(seed) {
  const rng = makeRng(seed);
  world.city = createCity(seed);
  world.player = createPlayer(420, 420);
  if (saveData) {
    world.player.money = saveData.money || 0;
    world.missions = createMissions();
    world.missions.index = Math.min(saveData.missionIndex || 0, 3);
  } else {
    world.missions = createMissions();
  }
  world.cars = spawnCars(world.city, rng, 26);
  world.peds = spawnPeds(rng, 42);
  world.police = createPolice();
  world.bullets = [];
  world.messages = [];
  world.floatTexts = [];
  world.wanted = 0;
  world.bustedTimer = 0;
}

buildWorld(SEED);

// ---- Screenshot states: the game's own states, staged deterministically. ----
function setupShot(shot) {
  buildWorld(SEED);
  world.shotMode = shot;
  const p = world.player;
  if (shot === 'start') {
    world.state = 'start';
    return;
  }
  world.state = 'playing';
  if (shot === 'drive') {
    // Rook driving a stolen car down a busy avenue, traffic around.
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    car.parked = false; car.traffic = false; car.stolen = true; car.driver = 'player';
    car.color = '#ff4757';
    car.x = 1200; car.y = 832; car.angle = 0; car.speed = 300;
    p.inCar = car; p.x = car.x; p.y = car.y;
    for (let i = 0; i < 5; i++) {
      const t = world.cars[i + 2];
      if (t) { t.traffic = true; t.x = 1000 + i * 170; t.y = 832 + (i % 2 ? 16 : -16); t.angle = 0; t.speed = 120; }
    }
    world.addMessage('You stole a Coastline. The heat is on!');
    world.addWanted(1, 'Grand theft auto');
    startNextMission(world);
  } else if (shot === 'chase') {
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    car.parked = false; car.traffic = false; car.stolen = true; car.driver = 'player';
    car.color = '#ff4757';
    car.x = 1500; car.y = 1232; car.angle = Math.PI / 2; car.speed = 320;
    p.inCar = car; p.x = car.x; p.y = car.y;
    world.wanted = 3; world.lastCrime = 'Grand theft auto';
    const cop1 = makeCar(1500, 1050, Math.PI / 2, { police: true, parked: false });
    cop1.driver = 'police'; cop1.speed = 340;
    const cop2 = makeCar(1440, 1400, Math.PI / 2, { police: true, parked: false });
    cop2.driver = 'police'; cop2.speed = 320;
    world.cars.push(cop1, cop2);
    world.police.cars.push(cop1, cop2);
    world.police.officers.push({ x: 1560, y: 1300, angle: 0, speed: 0, health: 100, down: false, knocked: false, knockTimer: 0, fleeing: false, walkPhase: 0, shirt: '#1e3799', name: 'Officer' });
    world.missions.index = 1;
    startNextMission(world);
    world.addMessage('Lose the heat — break line of sight!');
    p.money = 650;
  } else if (shot === 'mission') {
    // On foot at Marina Row, package marker ahead, peds and a parked car nearby.
    p.x = 420; p.y = 420; p.angle = 0.4;
    p.money = 250;
    startNextMission(world);
  }
  updateCamera(0);
}

function updateCamera(dt) {
  const p = world.player;
  const vw = canvas.width, vh = canvas.height;
  const tx = clamp(p.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
  const ty = clamp(p.y - vh / 2, 0, Math.max(0, WORLD_H - vh));
  if (dt === 0) { world.cam.x = tx; world.cam.y = ty; }
  else { world.cam.x += (tx - world.cam.x) * Math.min(1, dt * 6); world.cam.y += (ty - world.cam.y) * Math.min(1, dt * 6); }
  world.cam.w = vw; world.cam.h = vh;
  world.viewW = vw; world.viewH = vh;
}

function update(dt) {
  world.time += dt;
  for (const m of world.messages) m.life -= dt;
  world.messages = world.messages.filter((m) => m.life > 0);
  for (const f of world.floatTexts) { f.life -= dt; f.y -= 30 * dt; }
  world.floatTexts = world.floatTexts.filter((f) => f.life > 0);
  if (world.state !== 'playing') return;
  const p = world.player;
  updatePlayer(p, input, world.city, dt, world);
  updateCars(world.cars, p, input, world.city, dt, world);
  updatePeds(world.peds, p, world.city, dt, world);
  updatePolice(world, dt);
  updateMissions(world, dt);
  // Bullets.
  for (const b of world.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    for (const t of [...world.peds, ...world.police.officers]) {
      if (!t.down && Math.hypot(b.x - t.x, b.y - t.y) < 16) {
        t.health -= 40; t.knocked = true; t.knockTimer = 0.5; b.life = 0;
        if (t.health <= 0) t.down = true;
        world.addWanted(1, 'Shots fired');
      }
    }
    for (const c of world.cars) {
      if (c.driver !== 'player' && Math.hypot(b.x - c.x, b.y - c.y) < 24) b.life = 0;
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
  // Slow health regen out of combat.
  if (world.wanted === 0 && p.health > 0 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);
  updateCamera(dt);
  // Keys.
  if (input.wasPressed('KeyE')) {
    if (p.inCar) exitCar(p, world);
    else tryEnterCar(p, world.cars, world);
  }
  if (input.wasPressed('KeyF')) playerPunch(p, world);
  if (input.wasPressed('KeyM')) {
    if (!world.missions.active && world.missions.index < 3) startNextMission(world);
    else if (world.missions.active) world.addMessage(`JOB: ${world.missions.active.title} — ${world.missions.active.objective}`);
  }
  if (input.wasPressed('KeyN')) { const m = audio.toggleMute(); world.addMessage(m ? 'Sound muted' : 'Sound on'); }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) { world.state = 'paused'; }
  if (input.clicked) playerShoot(p, input, world.cam, world);
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (world.state === 'start') {
    // City backdrop behind the title: draw the world, then the title overlay.
    drawCity(ctx, world.city, { x: 200, y: 200, w: W, h: H });
    drawStartScreen(ctx, world);
    return;
  }
  drawCity(ctx, world.city, world.cam);
  drawMissionMarker(ctx, world.missions.active, world.cam, world.time);
  for (const car of world.cars) {
    if (car.x < world.cam.x - 80 || car.x > world.cam.x + W + 80 || car.y < world.cam.y - 80 || car.y > world.cam.y + H + 80) continue;
    drawCar(ctx, car, world.cam);
  }
  drawPeds(ctx, world.peds, world.cam);
  drawOfficers(ctx, world.police.officers, world.cam);
  // Bullets.
  ctx.fillStyle = '#ffe66d';
  for (const b of world.bullets) ctx.fillRect(b.x - world.cam.x - 2, b.y - world.cam.y - 2, 5, 5);
  drawPlayer(ctx, world.player, world.cam);
  // Floating texts.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floatTexts) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - world.cam.x, f.y - world.cam.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  if (world.state === 'playing' || world.state === 'paused') drawHUD(ctx, world);
  if (world.state === 'paused') drawPauseScreen(ctx, world);
  if (world.state === 'busted') drawEndScreen(ctx, world, 'busted');
}

function handleGlobalKeys() {
  if (input.wasPressed('Enter')) {
    if (world.state === 'start') {
      audio.ensure(); audio.startMusic();
      world.state = 'playing';
      world.addMessage('Welcome to Neon Bay, Rook. Press M for your first job.');
      if (!world.missions.active && world.missions.index === 0) startNextMission(world);
    } else if (world.state === 'busted') {
      buildWorld(SEED);
      world.state = 'playing';
      world.player.health = 100; world.player.alive = true;
      world.addMessage('Back on the streets. Stay sharp.');
    }
  }
  if (input.wasPressed('KeyP') && world.state === 'paused') {
    world.state = 'playing';
    input.pressed.delete('KeyP'); // consume so update() doesn't re-pause this frame
  }
  if (input.wasPressed('KeyR') && (world.state === 'busted' || world.state === 'paused')) {
    buildWorld(SEED);
    world.state = 'playing';
  }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleGlobalKeys();
  if (!SHOT) update(dt);
  else if (world.state === 'playing') {
    // Shot scenes are frozen tableaus: messages tick, nothing moves.
    for (const m of world.messages) m.life = Math.max(3, m.life);
    updateCamera(0);
  }
  render();
  input.endFrame();
  requestAnimationFrame(loop);
}

if (SHOT) setupShot(SHOT);
updateCamera(0);
requestAnimationFrame(loop);

// Expose a tiny debug handle for play-testing (state reads only).
window.__neonBay = {
  world,
  state: () => world.state,
  wanted: () => world.wanted,
  money: () => world.player.money,
  mission: () => (world.missions.active ? world.missions.active.title : null),
  inCar: () => !!world.player.inCar,
};
