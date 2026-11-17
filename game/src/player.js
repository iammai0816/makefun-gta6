// Neon Bay — the player on foot: movement, health, punching, shooting, money.
// Original character: "Rook", a small-time courier trying to go straight.
import { clamp, dist } from './rng.js';
import { collidesBuilding } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: 0, speed: 0, health: 100, maxHealth: 100,
    money: 0, ammo: 24, inCar: null, punchCooldown: 0, shootCooldown: 0,
    name: 'Rook', walkPhase: 0, alive: true,
  };
}

export function updatePlayer(player, input, city, dt, world) {
  if (!player.alive || player.inCar) return;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    player.angle = Math.atan2(my, mx);
    player.walkPhase += dt * 10;
    const speed = 170;
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    if (!collidesBuilding(city, nx, player.y, 14)) player.x = nx;
    if (!collidesBuilding(city, player.x, ny, 14)) player.y = ny;
    player.x = clamp(player.x, 20, 3180);
    player.y = clamp(player.y, 20, 2380);
  }
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  if (player.health <= 0) { player.alive = false; world.state = 'busted'; }
}

// Punch: hits the nearest pedestrian / officer within 34px in front.
export function playerPunch(player, world) {
  if (player.punchCooldown > 0 || player.inCar) return false;
  player.punchCooldown = 0.35;
  const targets = [...world.peds, ...world.police.officers];
  for (const t of targets) {
    if (dist(player.x, player.y, t.x, t.y) < 40) {
      t.health = (t.health ?? 100) - 34;
      t.knocked = true; t.knockTimer = 0.6;
      t.fleeing = true;
      if (t.health <= 0) t.down = true;
      world.addWanted(1, 'Assault');
      world.audio.punch();
      world.addFloatText(t.x, t.y - 20, 'POW!', '#ffdf3d');
      return true;
    }
  }
  world.audio.punch();
  return false;
}

// Shoot toward the mouse (screen -> world via camera).
export function playerShoot(player, input, cam, world) {
  if (player.shootCooldown > 0 || player.ammo <= 0 || player.inCar) return false;
  player.shootCooldown = 0.22;
  player.ammo -= 1;
  const wx = cam.x + input.mouseX * (cam.w / world.viewW);
  const wy = cam.y + input.mouseY * (cam.h / world.viewH);
  const a = Math.atan2(wy - player.y, wx - player.x);
  player.angle = a;
  world.bullets.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.7, fromPlayer: true });
  world.audio.shoot();
  world.addWanted(1, 'Shots fired');
  return true;
}

export function drawPlayer(ctx, player, cam) {
  if (!player.alive) return;
  const x = player.x - cam.x, y = player.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 4, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
  // Body: teal jacket, dark jeans.
  ctx.fillStyle = '#1f6f6b'; ctx.fillRect(-12, -9, 20, 18);
  ctx.fillStyle = '#22293a'; ctx.fillRect(-16, -8, 8, 16);
  // Head + cap.
  ctx.fillStyle = '#f2c29b'; ctx.beginPath(); ctx.arc(12, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5d8f'; ctx.fillRect(6, -8, 10, 16);
  // Arms swing while walking.
  const swing = Math.sin(player.walkPhase) * 4;
  ctx.fillStyle = '#f2c29b';
  ctx.fillRect(-2, -13, 8, 5); ctx.fillRect(-2 + swing * 0.3, 8, 8, 5);
  ctx.restore();
  // Health bar when hurt.
  if (player.health < 100) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 16, y - 28, 32, 5);
    ctx.fillStyle = player.health > 40 ? '#57cc7a' : '#ff5d5d';
    ctx.fillRect(x - 16, y - 28, 32 * (player.health / 100), 5);
  }
}
