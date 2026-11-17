// Neon Bay — game orchestration: state machine, loop, camera, combat,
// car stealing, collisions, saving, and the deterministic screenshot mode.
import { CONFIG } from './config.js';
import { makeRng, clamp, dist, angleTo } from './rng.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { spawnParkedCars, spawnTraffic, updateTraffic, driveCar, makeCar } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, scareNearby } from './pedestrians.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { drawHUD, drawMinimap, drawStartScreen, drawPauseScreen, drawGameOver, drawHelpOverlay } from './ui.js';
import { drawWorld, drawOffscreenArrow } from './render.js';
import { applyShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.rng = makeRng(20261118);
    this.state = 'start'; // start | playing | paused | over
    this.overKind = 'wasted';
    this.time = 0;
    this.frozen = false;
    this.mouseAim = false;
    this.showHelp = false;
    this.camera = { x: 0, y: 0 };
    this.bullets = [];
    this.particles = [];
    this.saveExists = false;
    this.shotMode = null;
    this.engineHumTimer = 0;
    this.newGame();
  }

  newGame() {
    const seed = 20261118;
    this.rng = makeRng(seed);
    this.city = buildCity(seed);
    this.player = new Player(1700, 1500);
    this.police = new Police();
    this.missions = new MissionManager();
    this.parkedCars = spawnParkedCars(this.rng, this.city, CONFIG.parkedCount, [{ x: 1700, y: 1500 }]);
    this.traffic = spawnTraffic(this.rng, this.city, CONFIG.trafficCount, [{ x: 1700, y: 1500 }]);
    this.peds = spawnPedestrians(this.rng, CONFIG.pedCount, this.city);
    this.bullets = [];
    this.particles = [];
    this.time = 0;
    try { this.saveExists = !!localStorage.getItem(CONFIG.saveKey); } catch (e) { this.saveExists = false; }
  }

  spawnMissionCar(x, y) {
    const c = makeCar(x, y, Math.PI / 2, 2, '#ff70a6', 'parked');
    c.model = { name: 'Coral sports coupe', len: 80, wid: 36, top: 1.4 };
    this.parkedCars.push(c);
    return c;
  }

  startPlaying(fromSave) {
    this.audio.ensure();
    this.audio.startMusic();
    if (fromSave) this.loadGame();
    this.state = 'playing';
  }

  saveGame() {
    try {
      const p = this.player;
      localStorage.setItem(CONFIG.saveKey, JSON.stringify({
        cash: p.cash, ammo: p.ammo, health: p.health,
        x: p.x, y: p.y, missionIndex: this.missions.index,
        completed: this.missions.completed,
      }));
      this.saveExists = true;
    } catch (e) { /* storage unavailable — play continues unsaved */ }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.player.cash = s.cash ?? 150;
      this.player.ammo = s.ammo ?? 24;
      this.player.health = s.health ?? 100;
      this.player.x = s.x ?? 1700;
      this.player.y = s.y ?? 1500;
      this.missions.index = s.missionIndex ?? 0;
      this.missions.completed = s.completed ?? [];
    } catch (e) { /* corrupt save — start fresh */ }
  }

  fireBullet(x, y, angle, byPlayer) {
    this.bullets.push({ x: x + Math.cos(angle) * 24, y: y + Math.sin(angle) * 24, angle, speed: 900, life: 0.9, byPlayer });
  }

  punchHit(x, y) {
    for (const p of this.peds) {
      if (dist(p.x, p.y, x, y) < 34) {
        p.panic = 3;
        this.burst(p.x, p.y, '#ffe66d', 6);
        this.police.addHeat(8, this.audio);
      }
    }
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * (40 + Math.random() * 120), vy: Math.sin(a) * (40 + Math.random() * 120),
        life: 0.5, maxLife: 0.5, size: 2 + Math.random() * 3, color,
      });
    }
  }

  nearestCar(maxD) {
    const p = this.player;
    let best = null, bestD = maxD;
    const consider = (c) => {
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    };
    this.parkedCars.forEach(consider);
    this.traffic.forEach(consider);
    if (this.missions.targetCar) consider(this.missions.targetCar);
    return best;
  }

  enterNearestCar() {
    const car = this.nearestCar(80);
    if (!car) return;
    const wasParked = car.kind === 'parked';
    const wasTraffic = car.kind === 'traffic';
    if (wasTraffic) this.traffic = this.traffic.filter((c) => c !== car);
    if (wasParked) this.parkedCars = this.parkedCars.filter((c) => c !== car);
    this.player.enterCar(car, this);
    if (wasParked) this.police.addHeat(20, this.audio); // grand theft auto
    if (wasTraffic) this.police.addHeat(35, this.audio); // carjacking in traffic
    this.saveGame();
  }

  busted() {
    if (this.state !== 'playing') return;
    this.overKind = 'busted';
    this.state = 'over';
    this.player.cash = Math.max(0, this.player.cash - 100);
    this.audio.busted();
    this.audio.stopMusic();
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.overKind = 'wasted';
    this.state = 'over';
    this.player.cash = Math.max(0, this.player.cash - 100);
    this.audio.stopMusic();
  }

  respawnAfterOver() {
    this.player.health = CONFIG.playerHealth;
    this.player.x = 2620; this.player.y = 620;
    this.player.inCar = false; this.player.car = null;
    this.police.clear();
    this.state = 'playing';
    this.audio.ensure();
    this.audio.startMusic();
    this.saveGame();
  }

  update(dt) {
    this.time += dt;
    const input = this.input;
    const p = this.player;

    // Global keys
    if (input.justPressed('n') || input.justPressed('N')) this.audio.toggleMute();
    if (input.justPressed('h') || input.justPressed('H')) this.showHelp = !this.showHelp;
    if (this.showHelp && (input.justPressed('Escape') || input.justPressed('h'))) this.showHelp = false;

    if (this.state === 'start') {
      if (input.justPressed('Enter') || input.mouseClicked) {
        this.audio.ensure();
        this.startPlaying(false);
      } else if ((input.justPressed('c') || input.justPressed('C')) && this.saveExists) {
        this.audio.ensure();
        this.startPlaying(true);
      }
      return;
    }
    if (this.state === 'over') {
      if (input.justPressed('Enter') || input.mouseClicked) this.respawnAfterOver();
      return;
    }
    if (input.justPressed('p') || input.justPressed('P')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      return;
    }
    if (this.state === 'paused') {
      if (input.justPressed('r') || input.justPressed('R')) { this.newGame(); this.startPlaying(true); }
      return;
    }

    // Mission start
    if ((input.justPressed('m') || input.justPressed('M')) && !this.missions.active) {
      this.missions.start(this);
    }

    // Shooting (mouse aims, Space fires forward; justPressed catches quick taps)
    this.mouseAim = input.mouseDown;
    if (input.mouseDown || input.down(' ') || input.justPressed(' ')) {
      if (!p.inCar) {
        if (input.mouseDown) {
          const wx = this.camera.x + input.mouseX;
          const wy = this.camera.y + input.mouseY;
          p.angle = angleTo(p.x, p.y, wx, wy);
        }
        p.tryShoot(this);
      }
    }

    // Enter / exit car
    if (input.justPressed('e') || input.justPressed('E')) {
      if (p.inCar) p.exitCar(this);
      else this.enterNearestCar();
    }

    if (p.inCar && p.car) {
      const ratio = driveCar(dt, p.car, input, this.city, () => {
        this.audio.crash();
        this.burst(p.car.x, p.car.y, '#ffaa33', 10);
        this.police.addHeat(5, this.audio);
      });
      this.engineHumTimer -= dt;
      if (this.engineHumTimer <= 0 && ratio > 0.05) {
        this.engineHumTimer = 0.12;
        this.audio.engineHum(ratio);
      }
      // Running over pedestrians is a crime.
      for (const ped of this.peds) {
        if (dist(ped.x, ped.y, p.car.x, p.car.y) < 34 && Math.abs(p.car.speed) > 60) {
          ped.panic = 4;
          this.burst(ped.x, ped.y, '#ff5555', 8);
          this.police.addHeat(25, this.audio);
          p.car.speed *= 0.6;
        }
      }
      // Collide with traffic cars.
      for (const c of this.traffic) {
        if (dist(c.x, c.y, p.car.x, p.car.y) < 52) {
          const push = 40 * dt;
          p.car.x += Math.cos(angleTo(c.x, c.y, p.car.x, p.car.y)) * push;
          p.car.y += Math.sin(angleTo(c.x, c.y, p.car.x, p.car.y)) * push;
          if (Math.abs(p.car.speed) > 240) { this.audio.crash(); this.police.addHeat(5, this.audio); }
          p.car.speed *= 0.92;
        }
      }
    } else {
      p.updateOnFoot(dt, input, this.city, this);
    }

    updateTraffic(dt, this.city, this.traffic, p.inCar ? p.car : null, this.police.cars);
    updatePedestrians(dt, this.peds, this.city, p.inCar && p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y });
    this.police.update(dt, this);
    this.missions.update(dt, this);
    this.updateBullets(dt);
    this.updateParticles(dt);

    // Camera follows the player / car.
    const fx = p.inCar && p.car ? p.car.x : p.x;
    const fy = p.inCar && p.car ? p.car.y : p.y;
    const tx = clamp(fx - CONFIG.viewW / 2, 0, CONFIG.worldW - CONFIG.viewW);
    const ty = clamp(fy - CONFIG.viewH / 2, 0, CONFIG.worldH - CONFIG.viewH);
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 6);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 6);

    // Passive ammo / health pickups are not spawned; ammo refills on mission completion.
    if (this.missions.active && this.missions.stepDef() && this.missions.stepDef().kind === 'escape' && this.police.wanted === 0) {
      // Escape step completes when the player reaches the hideout (handled in missions.update).
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      // Hit pedestrians
      for (const ped of this.peds) {
        if (dist(ped.x, ped.y, b.x, b.y) < 16) {
          b.life = 0;
          ped.panic = 5;
          this.burst(ped.x, ped.y, '#ff5555', 8);
          if (b.byPlayer) this.police.addHeat(30, this.audio);
          scareNearby(this.peds, b.x, b.y, 260, 4);
        }
      }
      // Hit police cars
      for (const c of this.police.cars) {
        if (dist(c.x, c.y, b.x, b.y) < 30) {
          b.life = 0;
          this.burst(c.x, c.y, '#ffd23f', 6);
          if (b.byPlayer) this.police.addHeat(15, this.audio);
        }
      }
      // Hit traffic / parked cars
      for (const c of [...this.traffic, ...this.parkedCars]) {
        if (dist(c.x, c.y, b.x, b.y) < 32) {
          b.life = 0;
          this.burst(c.x, c.y, '#ffd23f', 5);
          if (b.byPlayer) this.police.addHeat(10, this.audio);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CONFIG.viewW, CONFIG.viewH);
    if (this.state === 'start') {
      drawStartScreen(ctx, this);
      return;
    }
    drawWorld(ctx, this);
    drawOffscreenArrow(ctx, this);
    drawHUD(ctx, this);
    drawMinimap(ctx, this);
    if (this.showHelp) drawHelpOverlay(ctx);
    if (this.state === 'paused') drawPauseScreen(ctx, this);
    if (this.state === 'over') drawGameOver(ctx, this, this.overKind);
  }

  frame(dt) {
    if (!this.frozen) this.update(dt);
    this.render();
    this.input.endFrame();
  }
}

function boot() {
  const canvas = document.getElementById('game');
  const fallback = document.getElementById('fallback');
  if (!canvas || !canvas.getContext) { if (fallback) fallback.style.display = 'grid'; return; }
  const game = new Game(canvas);
  window.__neonBay = game; // exposed for play-testing hooks

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '1', 10);
  if (shot) {
    game.shotMode = shot;
    applyShot(game, shot, isNaN(seed) ? 1 : seed);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
