// Deterministic screenshot setups: ?shot=start|drive|chase|mission&seed=1
// places the player, cars, police and mission state, settles the world
// with fixed update steps, then freezes time so the frame is reproducible.
import { CONFIG } from './config.js';
import { makeCar } from './vehicles.js';

export function applyShot(game, shot, seed) {
  game.audio.ensure = () => {}; // no audio in screenshot mode

  if (shot === 'start') {
    game.state = 'start';
    game.time = 4.2;
    game.saveExists = false; // cover shot shows the clean first-run screen
    game.frozen = true;
    return;
  }

  // All gameplay shots start in the playing state with a fixed clock.
  game.state = 'playing';
  game.time = 12.5;
  game.audio.startMusic = () => {};

  if (shot === 'drive') {
    // Player driving south down a busy avenue, traffic and pedestrians around.
    const car = makeCar(1820, 1180, Math.PI / 2, 2, '#ff2e88', 'player');
    car.speed = 320;
    game.player.enterCar(car, game);
    game.player.car = car;
    game.player.x = car.x; game.player.y = car.y;
    game.traffic = game.traffic.slice(0, 10);
    game.traffic[0].x = 1790; game.traffic[0].y = 900; game.traffic[0].angle = Math.PI / 2; game.traffic[0].speed = 200;
    game.traffic[1].x = 1852; game.traffic[1].y = 1500; game.traffic[1].angle = -Math.PI / 2; game.traffic[1].speed = 180;
    game.traffic[2].x = 1400; game.traffic[2].y = 1330; game.traffic[2].angle = 0; game.traffic[2].speed = 160;
    game.traffic[3].x = 2240; game.traffic[3].y = 1270; game.traffic[3].angle = Math.PI; game.traffic[3].speed = 170;
    game.camera.x = 1820 - CONFIG.viewW / 2;
    game.camera.y = 1180 - CONFIG.viewH / 2;
    game.missions.message = 'Free roam — steal any parked car with E, or press M to start a job for Vera.';
    game.missions.messageTimer = 1;
  } else if (shot === 'chase') {
    // Three-star wanted: police cars closing in on the player's car.
    const car = makeCar(1820, 1400, Math.PI / 2, 1, '#ffd23f', 'player');
    car.speed = 380;
    game.player.enterCar(car, game);
    game.player.x = car.x; game.player.y = car.y;
    game.police.setWanted(3, null);
    game.police.cars = [
      makeCar(1820, 1080, Math.PI / 2, 1, '#e8e8e8', 'police'),
      makeCar(1752, 1560, Math.PI / 2, 1, '#e8e8e8', 'police'),
      makeCar(1890, 1620, -Math.PI / 2, 1, '#e8e8e8', 'police'),
      makeCar(1400, 1400, 0, 1, '#e8e8e8', 'police'),
    ];
    for (const c of game.police.cars) c.speed = 400;
    game.traffic = game.traffic.slice(0, 6);
    game.camera.x = 1820 - CONFIG.viewW / 2;
    game.camera.y = 1400 - CONFIG.viewH / 2;
    game.missions.message = 'WANTED — 3 stars! Lose the Neon Bay police!';
    game.missions.messageTimer = 1;
  } else if (shot === 'mission') {
    // Mission 1 in progress: player on foot on the marina road, gold marker ahead.
    game.player.x = 560; game.player.y = 1880;
    game.player.angle = Math.PI / 2;
    game.missions.start(game);
    game.missions.message = '1 · Sunset Pickup — Reach the marina kiosk and grab the package.';
    game.missions.messageTimer = 1;
    game.camera.x = 0;
    game.camera.y = 1610;
  } else {
    game.state = 'start';
  }

  // Freeze: render the settled frame, never advance the simulation.
  game.frozen = true;
  game.render();
}
