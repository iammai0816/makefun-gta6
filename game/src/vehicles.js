// Neon Bay — cars: parked cars to steal, traffic that follows the road grid,
// driving physics, collisions, and entering / exiting vehicles.
import { makeRng, pick, range, clamp, dist, angleTo } from './rng.js';
import { WORLD_W, WORLD_H, ROAD, ROAD_W, isOnRoad, collidesBuilding, nearestRoadPoint } from './city.js';

const CAR_COLORS = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#eccc68', '#a55eea', '#f368e0', '#c8d64f', '#dfe4ea'];
const CAR_NAMES = ['Sunrunner', 'Coastline', 'Palm GT', 'Bay Cruiser', 'Coral Coupe', 'Marina Van', 'Sunset Sedan'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle, speed: 0, color: opts.color || pick(makeRng((x | 0) + (y | 0) * 7 + 3), CAR_COLORS),
    name: opts.name || pick(makeRng((x | 0) * 13 + (y | 0)), CAR_NAMES),
    parked: opts.parked !== false, traffic: !!opts.traffic, police: !!opts.police,
    stolen: false, driver: opts.driver || null, // 'player' | 'traffic' | null
    steer: 0, targetAngle: angle, w: 44, h: 22,
  };
}

export function spawnCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 2000) {
    const gx = Math.floor(rng() * (WORLD_W / ROAD)) * ROAD;
    const gy = Math.floor(rng() * (WORLD_H / ROAD)) * ROAD;
    const alongRoad = rng() < 0.5;
    const x = alongRoad ? gx + 18 + rng() * (ROAD - 40) : gx + ROAD_W / 2 + (rng() < 0.5 ? -14 : 14);
    const y = alongRoad ? gy + ROAD_W / 2 + (rng() < 0.5 ? -14 : 14) : gy + 18 + rng() * (ROAD - 40);
    if (x < 60 || y < 60 || x > WORLD_W - 260 || y > WORLD_H - 60) continue;
    if (collidesBuilding(city, x, y, 24)) continue;
    if (cars.some((c) => dist(c.x, c.y, x, y) < 90)) continue;
    const angle = alongRoad ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    cars.push(makeCar(x, y, angle, { parked: rng() < 0.55, traffic: rng() >= 0.55 }));
  }
  return cars;
}

// Steal the nearest parked / traffic car within 46px.
export function tryEnterCar(player, cars, world) {
  if (player.inCar) return null;
  let best = null, bestD = 48;
  for (const c of cars) {
    if (c.police) continue;
    const d = dist(player.x, player.y, c.x, c.y);
    if (d < bestD) { best = c; bestD = d; }
  }
  if (!best) return null;
  if (best.parked || best.traffic) {
    best.parked = false; best.traffic = false; best.stolen = true; best.driver = 'player';
    player.inCar = best;
    player.x = best.x; player.y = best.y;
    world.addWanted(2, 'Grand theft auto');
    world.audio.steal();
    world.addFloatText(best.x, best.y - 30, 'STOLEN!', '#ffdf3d');
    world.addMessage(`You stole a ${best.name}. The heat is on!`);
  }
  return best;
}

export function exitCar(player, world) {
  const car = player.inCar;
  if (!car) return;
  car.driver = null; car.parked = true; car.speed = 0;
  player.inCar = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
}

export function updateCars(cars, player, input, city, dt, world) {
  for (const car of cars) {
    if (car.driver === 'player') {
      // Arcade driving: W/S accelerate & brake, A/D steer.
      const fwd = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const maxSpeed = 420;
      car.speed = clamp(car.speed + fwd * 520 * dt, -140, maxSpeed);
      if (fwd === 0) car.speed *= Math.pow(0.4, dt); // drag
      const steerAmt = steer * (car.speed >= 0 ? 1 : -1) * 2.4 * dt * clamp(Math.abs(car.speed) / 120, 0, 1);
      car.angle += steerAmt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const hit = collidesBuilding(city, nx, ny, 22);
      if (hit) {
        if (Math.abs(car.speed) > 180) { world.audio.crash(); world.addFloatText(car.x, car.y - 28, 'CRASH!', '#ff8a5d'); }
        car.speed *= -0.25;
      } else {
        car.x = clamp(nx, 30, WORLD_W - 50);
        car.y = clamp(ny, 30, WORLD_H - 30);
      }
      player.x = car.x; player.y = car.y; player.angle = car.angle;
      world.audio.engine(Math.abs(car.speed) / maxSpeed);
      // Running over a pedestrian is a crime.
      for (const p of world.peds) {
        if (!p.down && dist(car.x, car.y, p.x, p.y) < 26 && Math.abs(car.speed) > 60) {
          p.down = true; p.health = 0;
          world.addWanted(1, 'Pedestrian hit');
          world.audio.crash();
          world.addFloatText(p.x, p.y - 20, 'HIT!', '#ff5d5d');
        }
      }
    } else if (car.traffic) {
      // Traffic cruises along roads, turns at intersections, stops for nothing.
      car.speed = 90 + (car.cruise || 0);
      if (car.cruise === undefined) car.cruise = range(makeRng((car.x | 0) + (car.y | 0)), 0, 50);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const onRoad = isOnRoad(nx, ny);
      const atIntersection = isOnRoad(nx, ny) && (Math.abs(((nx % ROAD) + ROAD) % ROAD - ROAD_W / 2) < 40) && (Math.abs(((ny % ROAD) + ROAD) % ROAD - ROAD_W / 2) < 40);
      if (!onRoad || collidesBuilding(city, nx, ny, 22)) {
        const p = nearestRoadPoint(car.x, car.y);
        car.x = p.x; car.y = p.y;
        car.angle = angleTo(car.x, car.y, p.x + Math.cos(car.angle) * 10, p.y + Math.sin(car.angle) * 10);
        car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
      } else {
        car.x = nx; car.y = ny;
        if (atIntersection && Math.random() < dt * 0.25) {
          car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        }
      }
      // Keep traffic inside the city.
      if (car.x < 40 || car.y < 40 || car.x > WORLD_W - 60 || car.y > WORLD_H - 40) car.angle += Math.PI;
    }
    // Car-car bumps: simple push-apart.
    for (const other of cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d > 0.01 && d < 40) {
        const push = (40 - d) / 2;
        const a = angleTo(other.x, other.y, car.x, car.y);
        car.x += Math.cos(a) * push; car.y += Math.sin(a) * push;
        if (car.driver === 'player' && Math.abs(car.speed) > 200) world.audio.crash();
      }
    }
  }
}

export function drawCar(ctx, car, cam) {
  const x = car.x - cam.x, y = car.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(2, 4, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
  // Body.
  ctx.fillStyle = car.police ? '#f1f2f6' : car.color;
  roundRect(ctx, -22, -11, 44, 22, 6); ctx.fill();
  // Cabin + windows.
  ctx.fillStyle = car.police ? '#1e3799' : '#2f3542';
  roundRect(ctx, -8, -9, 16, 18, 4); ctx.fill();
  ctx.fillStyle = '#a5d8ff';
  ctx.fillRect(-4, -8, 8, 16);
  // Headlights / taillights.
  ctx.fillStyle = '#ffe66d'; ctx.fillRect(20, -9, 3, 5); ctx.fillRect(20, 4, 3, 5);
  ctx.fillStyle = '#ff4757'; ctx.fillRect(-23, -9, 3, 5); ctx.fillRect(-23, 4, 3, 5);
  if (car.police) {
    // Light bar.
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d55' : '#2d7dff';
    ctx.fillRect(-4, -11, 8, 4);
    ctx.fillStyle = flash ? '#2d7dff' : '#ff2d55';
    ctx.fillRect(-4, 7, 8, 4);
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
