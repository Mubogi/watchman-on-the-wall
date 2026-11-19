/**
 * A congregation member: spiritual state, hidden burden, wandering, and the
 * journal of what has happened to them.
 *
 * State model
 *   faith / love / hope  — 0..100, the visible vitals
 *   burden.severity      — 0..100, hidden weight; 100 = fallen away
 *   softened             — heart prepared by secret intercession
 */

import { BURDENS, ROSTER, RELATION_PAIRS, RELATION_KINDS } from "./config.js";
import { clamp, rand, randInt, pick, weightedPick } from "./utils.js";
import { TILE } from "./world.js";

const STATE_ORDER = ["thriving", "steady", "drifting", "burdened", "fallen"];

export class Member {
  constructor(def, index, world) {
    this.id = `m${index}`;
    this.name = def.name;
    this.role = def.role;
    this.note = def.note;
    this.skin = def.skin;
    this.hair = def.hair;
    this.robe = def.robe;
    this.accent = def.accent;

    this.faith = randInt(45, 78);
    this.love = randInt(42, 76);
    this.hope = randInt(44, 75);

    this.burden = null;
    this.burdenKey = null;
    this.severity = 0;
    this.softened = false;
    this.softenedUntil = 0;
    this.mentored = false;
    this.fallen = false;
    this.restoredCount = 0;
    this.known = false;      // has the watchman discerned the burden
    this.revealed = false;   // has the player clicked them since it appeared

    this.careCooldown = 0;
    this.careGlow = 0;
    this.lastAction = null;

    // Movement
    const home = world.randomPoint();
    this.gx = home.gx;
    this.gy = home.gy;
    this.tx = home.gx;
    this.ty = home.gy;
    this.pauseTimer = rand(0.5, 3);
    this.bob = rand(0, 6.28);
    this.facing = 1;
    this.speed = rand(0.85, 1.15);
    this.trail = [];

    this.journal = [];
    this.relations = [];
    this.arrivedAt = 0;
    this.trust = randInt(20, 40);

    this.log(`Joined the congregation's care list. ${def.note}`, "good");
  }

  get state() {
    if (this.fallen) return "fallen";
    if (this.severity > 62) return "burdened";
    if (this.severity > 26) return "drifting";
    if (this.vitality > 66) return "thriving";
    return "steady";
  }

  get vitality() {
    return (this.faith + this.love + this.hope) / 3;
  }

  get burdenInfo() {
    return this.burdenKey ? BURDENS[this.burdenKey] : null;
  }

  /** Can the player see the burden without inspecting? */
  canDiscern(alertness) {
    return this.known || alertness >= 62 || this.severity > 52;
  }

  log(text, kind = "info", stampText = "") {
    this.journal.push({ text, kind, at: Date.now(), stamp: stampText });
    if (this.journal.length > 40) this.journal.shift();
  }

  assignBurden(key, stampText) {
    this.burdenKey = key;
    this.burden = BURDENS[key];
    this.severity = clamp(this.severity, 8, 34);
    this.known = false;
    this.softened = false;
    this.log(`A burden took root: ${this.burden.label.toLowerCase()}.`, "bad", stampText);
  }

  clearBurden() {
    const was = this.burdenKey;
    this.burdenKey = null;
    this.burden = null;
    this.severity = 0;
    this.softened = false;
    return was;
  }

  applyRelief(amount) {
    this.severity = clamp(this.severity - amount, 0, 100);
    this.faith = clamp(this.faith + amount * 0.32, 0, 100);
    this.love = clamp(this.love + amount * 0.42, 0, 100);
    this.hope = clamp(this.hope + amount * 0.3, 0, 100);
  }

  applyWound(amount) {
    this.severity = clamp(this.severity + amount, 0, 100);
    this.faith = clamp(this.faith - amount * 0.25, 0, 100);
    this.hope = clamp(this.hope - amount * 0.3, 0, 100);
    this.love = clamp(this.love - amount * 0.18, 0, 100);
  }

  /** Weekly drift. Returns an event object if something notable happened. */
  tickWeek(world, ctx) {
    const { difficulty, alertness, unity } = ctx;
    let event = null;

    if (this.fallen) {
      // Fallen members still decay slowly unless visited.
      this.hope = clamp(this.hope - rand(1, 2.4), 0, 100);
      return null;
    }

    if (this.burdenKey) {
      const info = this.burdenInfo;
      const mentorShield = this.mentored ? 0.55 : 1;
      const unityShield = 1 - (unity / 100) * 0.28;
      const watchShield = 1 - (alertness / 100) * 0.16;
      const grow = info.weight * difficulty * mentorShield * unityShield * watchShield * rand(4.4, 7.4);
      this.severity = clamp(this.severity + grow, 0, 100);

      this.faith = clamp(this.faith - grow * 0.16, 0, 100);
      this.hope = clamp(this.hope - grow * 0.2, 0, 100);
      this.love = clamp(this.love - grow * 0.1, 0, 100);

      if (this.softened && this.severity < 30) {
        this.softened = false;
      }

      if (this.severity >= 100) {
        this.fallen = true;
        this.log("Fell away from fellowship — the burden went unshared too long.", "bad", ctx.stamp);
        event = { type: "fell", member: this };
      } else if (this.severity > 62 && !this.known) {
        this.known = alertness >= 55;
        event = { type: "critical", member: this };
      }
    } else {
      // No burden: slow recovery, and a chance a new burden appears.
      this.faith = clamp(this.faith + rand(0.4, 1.5), 0, 100);
      this.love = clamp(this.love + rand(0.3, 1.2), 0, 100);
      this.hope = clamp(this.hope + rand(0.3, 1.3), 0, 100);

      const chance = 0.1 * difficulty * (1 - unity / 220);
      if (Math.random() < chance) {
        const key = weightedPick([
          ["grief", 8], ["offense", 9], ["deception", 6], ["finances", 9],
          ["hunger", 8], ["shame", 7], ["weariness", 8], ["isolation", 8],
          ["family", 7], ["pride", 5], ["doubt", 7], ["fear", 7],
          ["loneliness", 7], ["distraction", 6],
        ]);
        this.assignBurden(key, ctx.stamp);
        event = { type: "newBurden", member: this, burden: key };
      }
    }

    if (this.mentored) {
      this.faith = clamp(this.faith + 0.8, 0, 100);
    }

    return event;
  }

  /** Called every animation frame. */
  update(dt, world, simSpeed) {
    this.careCooldown = Math.max(0, this.careCooldown - dt);
    this.careGlow = Math.max(0, this.careGlow - dt * 1.6);

    const strideScale = this.state === "fallen" ? 0.22 : this.state === "burdened" ? 0.55 : this.state === "drifting" ? 0.78 : 1;

    this.pauseTimer -= dt * simSpeed;
    if (this.pauseTimer <= 0) {
      this._chooseTarget(world);
      this.pauseTimer = rand(1.6, 5.2) / strideScale;
    }

    const dx = this.tx - this.gx;
    const dy = this.ty - this.gy;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.03) {
      const step = Math.min(dist, dt * simSpeed * 1.5 * this.speed * strideScale);
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;
      this.facing = dx >= 0 ? 1 : -1;
      this.moving = true;
      this.bob += dt * simSpeed * 7.5 * strideScale;
    } else {
      this.moving = false;
    }

    if (!world.isWalkable(this.gx, this.gy)) {
      this._chooseTarget(world);
      const p = world.randomPoint();
      this.gx = p.gx;
      this.gy = p.gy;
    }
  }

  _chooseTarget(world) {
    const state = this.state;
    // Drifting and fallen members wander toward the edges of town.
    if (state === "fallen" || state === "drifting" || state === "burdened") {
      if (Math.random() < 0.45) {
        const edge = pick([
          { gx: rand(0.5, 2.5), gy: rand(1, 15) },
          { gx: rand(14, 16.5), gy: rand(1, 15) },
          { gx: rand(1, 15), gy: rand(0.5, 2.5) },
          { gx: rand(1, 15), gy: rand(14, 16.5) },
        ]);
        const near = world.pointNear(edge.gx, edge.gy, 2.2);
        this.tx = near.gx;
        this.ty = near.gy;
        return;
      }
    }
    if (state === "thriving" && Math.random() < 0.3) {
      // Thriving members gravitate to the tower and fellowship house.
      const door = world.doorOf(world.buildings[Math.random() < 0.6 ? 0 : 1]);
      this.tx = door.gx + rand(-1.4, 1.4);
      this.ty = door.gy + rand(-1, 1.4);
      return;
    }
    const p = world.randomPoint();
    this.tx = p.gx;
    this.ty = p.gy;
  }

  /** Visual cues the renderer reads. */
  get cues() {
    const state = this.state;
    return {
      glow: state === "thriving" ? 1 : state === "steady" ? 0.4 : 0,
      slow: state === "burdened" || state === "fallen" || state === "drifting",
      heavyIcon: this.burdenKey && this.severity > 18 ? this.burden.icon : null,
      shadow: state === "fallen" ? 0.85 : this.severity / 130,
      pulse: state === "burdened",
    };
  }
}

/** Build the whole congregation and wire relationships. */
export function createFlock(world) {
  const members = ROSTER.map((def, i) => new Member(def, i, world));
  const byName = new Map(members.map((m) => [m.name, m]));

  for (const [aName, bName, kind] of RELATION_PAIRS) {
    const a = byName.get(aName);
    const b = byName.get(bName);
    if (!a || !b) continue;
    a.relations.push({ id: b.id, kind });
    b.relations.push({ id: a.id, kind });
  }

  return members;
}

export function relationLabel(kind) {
  return RELATION_KINDS[kind]?.label ?? "knows";
}

export { STATE_ORDER, TILE };
