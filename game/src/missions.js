// Story missions from fixer Vera Solano: three jobs that take the player
// across Neon Bay, with step markers, rewards and wanted heat.
import { MISSIONS } from './config.js';
import { dist } from './rng.js';

export class MissionManager {
  constructor() {
    this.index = 0; // next mission to start
    this.active = null;
    this.step = 0;
    this.completed = [];
    this.message = '';
    this.messageTimer = 0;
    this.targetCar = null;
  }

  currentDef() { return MISSIONS[this.index] || null; }

  start(game) {
    const def = this.currentDef();
    if (!def || this.active) return false;
    this.active = def;
    this.step = 0;
    this.message = def.title + ' — ' + def.brief;
    this.messageTimer = 7;
    if (def.wantedOnStart > 0) game.police.setWanted(def.wantedOnStart, game.audio);
    if (def.id === 'neon-getaway') {
      // The coral sports car waiting at the plaza.
      const c = game.spawnMissionCar(1720, 1280);
      this.targetCar = c;
    }
    game.audio.pickup();
    return true;
  }

  stepDef() {
    if (!this.active) return null;
    return this.active.steps[this.step] || null;
  }

  targetPos() {
    const s = this.stepDef();
    return s ? { x: s.x, y: s.y, radius: s.radius, label: s.label, kind: s.kind } : null;
  }

  update(dt, game) {
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    if (!this.active) return;
    const s = this.stepDef();
    if (!s) return;
    const p = game.player;
    const px = p.inCar && p.car ? p.car.x : p.x;
    const py = p.inCar && p.car ? p.car.y : p.y;
    if (s.kind === 'steal') {
      if (this.targetCar && p.inCar && p.car === this.targetCar) this.advance(game);
      return;
    }
    if (s.kind === 'grab') {
      if (dist(px, py, s.x, s.y) < s.radius) {
        game.player.cash += 0; // cash comes at completion
        this.message = 'Cash grabbed! Get to the hideout — and shake the cops first.';
        this.messageTimer = 5;
        game.police.setWanted(3, game.audio);
        this.advance(game);
      }
      return;
    }
    if (s.kind === 'escape') {
      if (game.police.wanted === 0 && dist(px, py, s.x, s.y) < s.radius) this.advance(game);
      return;
    }
    if (dist(px, py, s.x, s.y) < s.radius) this.advance(game);
  }

  advance(game) {
    this.step++;
    game.audio.pickup();
    if (this.step >= this.active.steps.length) {
      const def = this.active;
      game.player.cash += def.reward;
      game.player.heal(30);
      this.completed.push(def.id);
      this.message = def.title + ' COMPLETE — Vera paid you $' + def.reward + '.';
      this.messageTimer = 6;
      game.audio.missionDone();
      game.audio.cash();
      game.saveGame();
      this.active = null;
      this.index++;
      this.targetCar = null;
    } else {
      const s = this.stepDef();
      this.message = 'Next: ' + s.label;
      this.messageTimer = 5;
    }
  }

  allDone() { return this.index >= MISSIONS.length; }

  objectiveText() {
    if (this.active) {
      const s = this.stepDef();
      return this.active.title + ' — ' + (s ? s.label : '');
    }
    if (this.allDone()) return 'All missions complete! Free roam Neon Bay.';
    const next = this.currentDef();
    return next ? 'Next job: ' + next.title + ' — press M to start' : 'Free roam';
  }
}
