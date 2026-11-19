/**
 * Threats approach the village from the dark. The watchman sees them earlier
 * when alertness is high, and can sound a warning before they reach the gate.
 *
 * A threat that arrives un-warned seeds burdens in the flock.
 * A threat warned in time is turned away — and often strengthens the village.
 */

import { THREATS } from "./config.js";
import { rand, clamp, pick } from "./utils.js";

export class Threat {
  constructor(key, spawnDistance, seasonDifficulty) {
    const def = THREATS[key];
    this.key = key;
    this.def = def;
    this.angle = rand(0, Math.PI * 2);
    this.distance = spawnDistance;
    this.speed = def.speed * rand(0.85, 1.15) * (0.9 + seasonDifficulty * 0.22);
    this.warned = false;
    this.defeated = false;
    this.spotted = false;
    this.id = `t${Threat.nextId++}`;
    this.age = 0;
    this.fade = 0;
    this.warningProgress = 0;
    this.pulse = rand(0, 6.28);
  }

  get name() {
    return this.def.label;
  }

  /** 0..1 — how close it is to the gate. */
  get proximity() {
    return clamp(1 - this.distance / 100, 0, 1);
  }

  /** Visible only within the watchman's reach. */
  isVisible(alertness) {
    const revealAt = 100 - alertness * 0.86;
    return this.distance <= revealAt || this.spotted;
  }

  update(dt, alertness) {
    this.age += dt;
    this.pulse += dt * 2.4;
    if (this.isVisible(alertness)) this.spotted = true;

    if (this.warned) {
      // A warned threat is turned back; it retreats and fades.
      this.warningProgress += dt * 0.85;
      this.distance += this.speed * 42 * dt;
      this.fade = clamp(this.warningProgress, 0, 1);
      if (this.distance > 130 || this.fade >= 1) this.defeated = true;
    } else {
      this.distance -= this.speed * 11 * dt;
    }
  }

  get arrived() {
    return !this.warned && this.distance <= 0;
  }
}

Threat.nextId = 1;

/** Owns spawning, pacing, and resolution of threats. */
export class ThreatDirector {
  constructor() {
    this.threats = [];
    this.cooldown = 30;
    this.nextSpawn = rand(20, 34);
    this.totalSpawned = 0;
    this.totalTurned = 0;
    this.totalBreached = 0;
  }

  reset() {
    this.threats = [];
    this.nextSpawn = rand(18, 30);
    this.totalSpawned = 0;
    this.totalTurned = 0;
    this.totalBreached = 0;
  }

  /** Seconds until the next threat is due (for the HUD hint). */
  get calmFor() {
    return Math.max(0, this.nextSpawn);
  }

  update(dt, ctx) {
    const { alertness, seasonDifficulty, gameSpeed } = ctx;
    // Threats must share the simulation clock, or at 2x the flock ages twice
    // as fast as the dangers approaching it.
    const simDt = dt * gameSpeed;
    if (gameSpeed > 0) {
      this.nextSpawn -= simDt;
      if (this.nextSpawn <= 0) {
        this._spawn(seasonDifficulty, ctx.week);
        const base = rand(30, 52) / Math.max(0.6, seasonDifficulty);
        this.nextSpawn = Math.max(14, base);
      }
    }

    for (const t of this.threats) {
      if (gameSpeed > 0) t.update(simDt, alertness);
    }
    this.threats = this.threats.filter((t) => !t.defeated);
  }

  _spawn(seasonDifficulty, week) {
    const maxActive = seasonDifficulty > 1.3 ? 3 : 2;
    if (this.threats.filter((t) => !t.warned).length >= maxActive) return;

    const keys = Object.keys(THREATS);
    const key = pick(keys);
    const t = new Threat(key, 100, seasonDifficulty);
    this.threats.push(t);
    this.totalSpawned++;
    return t;
  }

  /** Sound a warning. Returns 'turned' | 'tooLate' | 'nothing'. */
  warn(threatId) {
    const t = this.threats.find((x) => x.id === threatId);
    if (!t || t.warned) return "nothing";
    if (t.proximity > 0.94) return "tooLate";
    t.warned = true;
    this.totalTurned++;
    return "turned";
  }

  /** Threats that reached the gate un-warned this tick. */
  drainArrivals() {
    const arrived = this.threats.filter((t) => t.arrived && !t.defeated);
    for (const t of arrived) {
      t.defeated = true;
      this.totalBreached++;
    }
    this.threats = this.threats.filter((t) => !t.defeated);
    return arrived;
  }
}
