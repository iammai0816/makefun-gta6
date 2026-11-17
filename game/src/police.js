// Neon Bay — wanted level (1–5 stars) and the Bay City Police: patrol cars and
// officers who chase, ram, and try to bust Rook. Lose them by breaking line of
// sight and staying hidden until the heat cools off.
import { clamp, dist, angleTo } from './rng.js';
import { WORLD_W, WORLD_H, ROAD } from './city.js';
import { makeCar } from './vehicles.js';

export function createPolice() {
  return { cars: [], officers: [], heatTimer: 0, hiddenTimer: 0, sirenTimer: 0 };
}

export function addWanted(world, stars, reason) {
  if (world.state !== 'playing') return;
  world.wanted = clamp(world.wanted + stars, 0, 5);
  world.lastCrime = reason;
  world.police.hiddenTimer = 0;
  if (world.wanted > 0) {
    const wantCars = Math.min(world.wanted, 3);
    while (world.police.cars.length < wantCars) spawnPoliceCar(world);
    while (world.police.officers.length < Math.min(world.wanted, 4)) spawnOfficer(world);
  }
}

function spawnPoliceCar(world) {
  const p = world.player;
  const a = Math.random() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(a) * 700, 80, WORLD_W - 100);
  const y = clamp(p.y + Math.sin(a) * 700, 80, WORLD_H - 80);
  const car = makeCar(x, y, angleTo(x, y, p.x, p.y), { police: true, parked: false });
  car.driver = 'police';
  world.police.cars.push(car);
  world.cars.push(car);
}

function spawnOfficer(world) {
  const p = world.player;
  const a = Math.random() * Math.PI * 2;
  world.police.officers.push({
    x: clamp(p.x + Math.cos(a) * 320, 40, WORLD_W - 60),
    y: clamp(p.y + Math.sin(a) * 320, 40, WORLD_H - 40),
    angle: 0, speed: 150, health: 100, down: false, knocked: false, knockTimer: 0, fleeing: false,
    walkPhase: 0, shirt: '#1e3799', name: 'Officer',
  });
}

export function updatePolice(world, dt) {
  const pol = world.police;
  const p = world.player;
  if (world.wanted <= 0) {
    // Stand down: cars drive off, officers wander away.
    for (const c of pol.cars) {
      c.x += Math.cos(c.angle) * 120 * dt; c.y += Math.sin(c.angle) * 120 * dt;
      if (dist(c.x, c.y, p.x, p.y) > 1200) { c.gone = true; }
    }
    pol.cars = pol.cars.filter((c) => !c.gone);
    world.cars = world.cars.filter((c) => !c.gone);
    pol.officers = [];
    return;
  }
  // Siren wail every few seconds.
  pol.sirenTimer -= dt;
  if (pol.sirenTimer <= 0) { pol.sirenTimer = 3.5; world.audio.siren(); }
  // Heat cools only when no police can see the player.
  const nearest = Math.min(
    ...pol.cars.map((c) => dist(c.x, c.y, p.x, p.y)),
    ...pol.officers.map((o) => dist(o.x, o.y, p.x, p.y)),
    9999,
  );
  if (nearest > 520) {
    pol.hiddenTimer += dt;
    if (pol.hiddenTimer > 5) {
      world.wanted = Math.max(0, world.wanted - 1);
      pol.hiddenTimer = 0;
      world.addMessage(world.wanted === 0 ? 'You lost them. The heat is off.' : 'Heat cooling down…');
      if (world.wanted === 0) world.addMessage('Wanted level cleared.');
    }
  } else {
    pol.hiddenTimer = 0;
  }
  // Police cars ram / chase.
  for (const car of pol.cars) {
    const d = dist(car.x, car.y, p.x, p.y);
    const target = angleTo(car.x, car.y, p.x, p.y);
    let da = target - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    car.angle += clamp(da, -2.2 * dt, 2.2 * dt);
    car.speed = clamp(car.speed + 300 * dt, 0, 380 + world.wanted * 20);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, WORLD_W - 60);
    car.y = clamp(car.y, 30, WORLD_H - 30);
    // Ram the player's car.
    if (p.inCar && d < 46) {
      p.inCar.speed *= 0.6;
      p.health = Math.max(0, p.health - 6 * dt * 10);
      world.audio.crash();
    }
    // Bust on foot: officer-level proximity + slow player = busted.
    if (!p.inCar && d < 30) {
      world.bustedTimer += dt;
      if (world.bustedTimer > 1.2) { world.state = 'busted'; world.audio.busted(); }
    }
  }
  // Officers chase on foot and punch.
  for (const o of pol.officers) {
    if (o.down) continue;
    o.knockTimer = Math.max(0, o.knockTimer - dt);
    if (o.knocked && o.knockTimer <= 0) { o.knocked = false; }
    if (o.knocked) continue;
    const d = dist(o.x, o.y, p.x, p.y);
    const a = angleTo(o.x, o.y, p.x, p.y);
    o.angle = a;
    const speed = p.inCar ? 0 : 165;
    o.x += Math.cos(a) * speed * dt;
    o.y += Math.sin(a) * speed * dt;
    o.walkPhase += dt * 9;
    if (!p.inCar && d < 30) {
      p.health = Math.max(0, p.health - 22 * dt);
      world.bustedTimer += dt * 0.5;
      if (p.health <= 0) { p.alive = false; world.state = 'busted'; world.audio.busted(); }
    }
  }
  if (world.state !== 'busted') world.bustedTimer = Math.max(0, world.bustedTimer - dt * 0.5);
}

export function drawOfficers(ctx, officers, cam) {
  for (const o of officers) {
    if (o.down) continue;
    const x = o.x - cam.x, y = o.y - cam.y;
    if (x < -30 || y < -30 || x > cam.w + 30 || y > cam.h + 30) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 3, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e3799'; ctx.fillRect(-9, -7, 16, 14);
    ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c2461'; ctx.fillRect(4, -6, 8, 12);
    ctx.fillStyle = '#ffd32a'; ctx.fillRect(-2, -2, 3, 4);
    ctx.restore();
  }
}
