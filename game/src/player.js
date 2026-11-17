// The player on foot: walking, running, punching, shooting, and
// entering / exiting / stealing cars. Health, cash and ammo live here.
import { CONFIG } from './config.js';
import { clamp, dist, angleTo } from './rng.js';
import { collidesWithBuilding } from './city.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.health = CONFIG.playerHealth;
    this.cash = 150;
    this.ammo = 24;
    this.hasGun = true;
    this.inCar = false;
    this.car = null;
    this.punchTimer = 0;
    this.shootCooldown = 0;
    this.hurtFlash = 0;
    this.walkBob = 0;
    this.moving = false;
  }

  updateOnFoot(dt, input, city, game) {
    const mv = input.moveVector();
    this.moving = mv.x !== 0 || mv.y !== 0;
    const speed = (input.down('Shift') ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed);
    if (this.moving) {
      this.angle = Math.atan2(mv.y, mv.x);
      this.walkBob += dt * 11;
      const nx = this.x + mv.x * speed * dt;
      const ny = this.y + mv.y * speed * dt;
      if (!collidesWithBuilding(city, nx, this.y, CONFIG.playerRadius)) this.x = nx;
      if (!collidesWithBuilding(city, this.x, ny, CONFIG.playerRadius)) this.y = ny;
      this.x = clamp(this.x, 30, CONFIG.worldW - 30);
      this.y = clamp(this.y, 30, CONFIG.worldH - 30);
    }
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    // Aim at the mouse when shooting with it; otherwise face movement.
    if (game.mouseAim) {
      const wx = game.camera.x + input.mouseX;
      const wy = game.camera.y + input.mouseY;
      if (dist(this.x, this.y, wx, wy) > 40) this.angle = angleTo(this.x, this.y, wx, wy);
    }
  }

  tryShoot(game) {
    if (this.shootCooldown > 0) return false;
    if (this.hasGun) {
      if (this.ammo <= 0) { game.audio.tone(160, 0.06, 'square', 0.08); this.shootCooldown = 0.25; return false; }
      this.ammo--;
      this.shootCooldown = 0.22;
      game.fireBullet(this.x, this.y, this.angle, true);
      game.audio.shoot();
      return true;
    }
    this.punchTimer = 0.28;
    this.shootCooldown = 0.35;
    game.audio.punch();
    game.punchHit(this.x + Math.cos(this.angle) * 30, this.y + Math.sin(this.angle) * 30);
    return true;
  }

  takeDamage(amount, game) {
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 0.35;
    game.audio.hurt();
    if (this.health <= 0) game.wasted();
  }

  heal(amount) { this.health = Math.min(CONFIG.playerHealth, this.health + amount); }

  enterCar(car, game) {
    this.inCar = true;
    this.car = car;
    car.parked = false;
    car.kind = 'player';
    game.audio.door();
    game.audio.carStart();
  }

  exitCar(game) {
    if (!this.car) return;
    const a = this.car.angle + Math.PI / 2;
    this.x = this.car.x + Math.cos(a) * 42;
    this.y = this.car.y + Math.sin(a) * 42;
    this.inCar = false;
    this.car.kind = 'parked';
    this.car.speed = 0;
    this.car = null;
    game.audio.door();
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const bob = this.moving ? Math.sin(this.walkBob) * 3 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(this.angle + Math.PI / 2);
    // Legs
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, 2); ctx.lineTo(-4 - bob, 12);
    ctx.moveTo(4, 2); ctx.lineTo(4 + bob, 12);
    ctx.stroke();
    // Jacket (teal, the player's signature look)
    ctx.fillStyle = '#0ea5a5';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-10, -4, 20, 6);
    // Head
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(0, -13, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(0, -15, 7.5, Math.PI, Math.PI * 2); ctx.fill();
    // Gun or fist
    if (this.hasGun) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(-2, -26, 4, 12);
    } else if (this.punchTimer > 0) {
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath(); ctx.arc(0, -24, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Name tag
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REX', this.x, this.y - 26);
  }
}
