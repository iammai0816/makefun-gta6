// Vehicles: parked cars to steal, traffic that cruises the road grid,
// and the driving model for the player. All cars are drawn as rounded
// top-down bodies with windscreens, headlights and brake lights.
import { CONFIG, CAR_COLORS, CAR_MODELS } from './config.js';
import { makeRng, pick, range, rangeInt, clamp, angleDiff } from './rng.js';
import { isOnRoad, nearestRoadPoint, randomStreetPoint, collidesWithBuilding } from './city.js';

export function makeCar(x, y, angle, modelIdx, color, kind) {
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    x, y, angle, speed: 0, model, color, kind: kind || 'traffic',
    parked: kind === 'parked',
    targetSpeed: 0, lane: 0, honkTimer: 0, brake: false,
    id: Math.floor(Math.random() * 1e9),
  };
}

export function spawnParkedCars(rng, city, count, avoid) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 600) {
    tries++;
    const p = randomStreetPoint(rng, city);
    const onV = city.vRoads.some((vx) => Math.abs(p.x - vx) < 26);
    const angle = onV ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    // Park tight in a lane, on the road surface, facing along the road.
    const x = onV ? p.x + (rng() < 0.5 ? -24 : 24) : p.x;
    const y = onV ? p.y : p.y + (rng() < 0.5 ? -24 : 24);
    if (avoid && avoid.some((a) => Math.hypot(a.x - x, a.y - y) < 220)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 130)) continue;
    cars.push(makeCar(x, y, angle, rangeInt(rng, 0, CAR_MODELS.length - 1), pick(rng, CAR_COLORS), 'parked'));
  }
  return cars;
}

export function spawnTraffic(rng, city, count, avoid) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < 800) {
    tries++;
    const p = randomStreetPoint(rng, city);
    if (avoid && avoid.some((a) => Math.hypot(a.x - p.x, a.y - p.y) < 300)) continue;
    const onV = city.vRoads.some((vx) => Math.abs(p.x - vx) < 26);
    const angle = onV ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const c = makeCar(p.x, p.y, angle, rangeInt(rng, 0, CAR_MODELS.length - 1), pick(rng, CAR_COLORS), 'traffic');
    c.targetSpeed = range(rng, 120, 220);
    c.speed = c.targetSpeed;
    cars.push(c);
  }
  return cars;
}

// Traffic AI: follow the road, turn at intersections, slow for cars ahead.
export function updateTraffic(dt, city, cars, playerCar, policeCars) {
  const all = cars.concat(playerCar ? [playerCar] : [], policeCars || []);
  for (const c of cars) {
    const ahead = carAhead(all, c, 90);
    let want = c.targetSpeed;
    if (ahead) want = Math.min(want, Math.max(0, ahead.speed - 20));
    c.speed += clamp(want - c.speed, -260 * dt, 160 * dt);
    // At an intersection, sometimes turn.
    const nearV = city.vRoads.find((vx) => Math.abs(c.x - vx) < 14);
    const nearH = city.hRoads.find((hy) => Math.abs(c.y - hy) < 14);
    if (nearV !== undefined && nearH !== undefined && Math.random() < 0.012) {
      const vertical = Math.random() < 0.5;
      c.angle = vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
    }
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (isOnRoad(city, nx, ny) || Math.hypot(nx - c.x, ny - c.y) < 4) {
      c.x = clamp(nx, 60, CONFIG.worldW - 60);
      c.y = clamp(ny, 60, CONFIG.worldH - 60);
    } else {
      // Nudge back onto the nearest road.
      const rp = nearestRoadPoint(city, c.x, c.y);
      c.angle += angleDiff(c.angle, rp.vertical ? Math.PI / 2 : 0) * 2 * dt;
      c.speed *= 0.9;
    }
    c.brake = want < c.speed - 10;
  }
}

function carAhead(all, self, distAhead) {
  let best = null, bestD = Infinity;
  for (const o of all) {
    if (o === self) continue;
    const dx = o.x - self.x, dy = o.y - self.y;
    const along = dx * Math.cos(self.angle) + dy * Math.sin(self.angle);
    const side = Math.abs(-dx * Math.sin(self.angle) + dy * Math.cos(self.angle));
    if (along > 0 && along < distAhead && side < 34 && along < bestD) { bestD = along; best = o; }
  }
  return best;
}

// Player driving: arcade handling with drift, collision with buildings.
export function driveCar(dt, car, input, city, onCrash) {
  const fwd = (input.down('w') || input.down('ArrowUp')) ? 1 : 0;
  const back = (input.down('s') || input.down('ArrowDown')) ? 1 : 0;
  const left = input.down('a') || input.down('ArrowLeft');
  const right = input.down('d') || input.down('ArrowRight');
  if (fwd) car.speed += CONFIG.carAccel * dt;
  else if (back) car.speed -= CONFIG.carAccel * 0.7 * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  if (input.down(' ') || input.down('Shift')) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
  car.speed = clamp(car.speed, -CONFIG.carReverseMax, CONFIG.carMaxSpeed * car.model.top);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CONFIG.carTurn * dir * dt * clamp(Math.abs(car.speed) / 120, 0, 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = car.model.len / 2 - 14;
  const hitX = collidesWithBuilding(city, nx, car.y, r);
  const hitY = collidesWithBuilding(city, car.x, ny, r);
  if (hitX || hitY) {
    if (Math.abs(car.speed) > 260 && onCrash) onCrash();
    car.speed *= -0.25;
  }
  // Axis-separated movement lets the car slide along walls instead of sticking.
  if (!hitX) car.x = clamp(nx, 40, CONFIG.worldW - 40);
  if (!hitY) car.y = clamp(ny, 40, CONFIG.worldH - 40);
  car.brake = back || input.down(' ');
  return Math.abs(car.speed) / CONFIG.carMaxSpeed;
}

export function drawCar(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const { len, wid } = car.model;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-len / 2 + 4, -wid / 2 + 5, len, wid);
  // Body
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Windscreen + rear window
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, len * 0.08, -wid / 2 + 5, len * 0.2, wid - 10, 4); ctx.fill();
  roundRect(ctx, -len * 0.32, -wid / 2 + 5, len * 0.14, wid - 10, 4); ctx.fill();
  // Roof
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, -len * 0.12, -wid / 2 + 6, len * 0.2, wid - 12, 4); ctx.fill();
  // Headlights / brake lights
  ctx.fillStyle = car.brake ? '#ff2222' : '#ffd76a';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 4, 7);
  ctx.fillRect(len / 2 - 3, wid / 2 - 10, 4, 7);
  ctx.fillStyle = '#ff3333';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 3, 4, 7);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 10, 4, 7);
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-len * 0.1, -wid / 2 + 2, len * 0.2, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NBPD', 0, 3);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, -len / 2 - 6, -wid / 2 - 6, len + 12, wid + 12, 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
