// Wanted level and the Neon Bay Police Department: stars rise when the
// player commits crimes, police cars spawn and chase, and the heat fades
// when the player stays clean and out of sight.
import { CONFIG } from './config.js';
import { makeCar } from './vehicles.js';
import { clamp, angleDiff, dist } from './rng.js';
import { randomStreetPoint } from './city.js';

export class Police {
  constructor() {
    this.wanted = 0;
    this.heat = 0; // 0..100, stars = ceil(heat/20)
    this.cars = [];
    this.decayTimer = 0;
    this.sirenTimer = 0;
    this.bustedTimer = 0;
  }

  addHeat(amount, audio) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.wanted = Math.ceil(this.heat / 20);
    this.decayTimer = 0;
    if (audio && amount >= 20) audio.sirenBlip();
  }

  setWanted(stars, audio) {
    this.heat = Math.max(this.heat, stars * 20 - 10);
    this.wanted = stars;
    this.decayTimer = 0;
    if (audio) audio.sirenBlip();
  }

  update(dt, game) {
    const { player, city } = game;
    // Decay: staying clean slowly cools the heat.
    if (this.wanted > 0) {
      this.decayTimer += dt;
      if (this.decayTimer > CONFIG.wantedDecaySeconds) {
        this.heat = Math.max(0, this.heat - 20);
        this.wanted = Math.ceil(this.heat / 20);
        this.decayTimer = 0;
      }
    }
    // Spawn police cars up to the wanted level.
    const wantCars = this.wanted === 0 ? 0 : Math.min(CONFIG.policeMax, this.wanted + 1);
    while (this.cars.length < wantCars) {
      const p = randomStreetPoint(game.rng, city);
      const c = makeCar(p.x, p.y, 0, 1, '#1d3557', 'police');
      c.color = '#e8e8e8';
      c.targetSpeed = 300;
      this.cars.push(c);
    }
    while (this.cars.length > wantCars) this.cars.pop();
    // Chase the player.
    for (const c of this.cars) {
      const px = player.inCar && player.car ? player.car.x : player.x;
      const py = player.inCar && player.car ? player.car.y : player.y;
      const d = dist(c.x, c.y, px, py);
      const targetAngle = Math.atan2(py - c.y, px - c.x);
      c.angle += clamp(angleDiff(c.angle, targetAngle), -2.4 * dt, 2.4 * dt);
      const wantSpeed = d > 700 ? 480 : d > 260 ? 430 : 300;
      c.speed += clamp(wantSpeed - c.speed, -400 * dt, 320 * dt);
      c.x = clamp(c.x + Math.cos(c.angle) * c.speed * dt, 40, CONFIG.worldW - 40);
      c.y = clamp(c.y + Math.sin(c.angle) * c.speed * dt, 40, CONFIG.worldH - 40);
      // Ram / bust: touching the player on foot at low speed busts them.
      if (!player.inCar && d < 34) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.2) game.busted();
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
      // Police ram the player's car.
      if (player.inCar && player.car && d < 60) {
        player.car.speed *= 0.94;
        player.car.x += Math.cos(c.angle) * 30 * dt;
        player.car.y += Math.sin(c.angle) * 30 * dt;
      }
    }
    this.sirenTimer -= dt;
    if (this.wanted > 0 && this.sirenTimer <= 0) {
      this.sirenTimer = 1.6;
      if (game.audio) game.audio.sirenBlip();
    }
  }

  clear() {
    this.cars = [];
    this.heat = 0;
    this.wanted = 0;
    this.bustedTimer = 0;
  }
}
