/**
 * Game orchestration: state ownership, the care actions, weekly ticks,
 * seasons, save/load, and the loop that ties simulation to rendering.
 */

import {
  ACTIONS, BURDENS, SEASONS, WEEKS_PER_SEASON, WEEK_SECONDS,
  SAVE_KEY, SAVE_VERSION, GRACE_WORDS, TILE_W, TILE_H,
} from "./config.js";
import { World } from "./world.js";
import { createFlock } from "./members.js";
import { ThreatDirector } from "./threats.js";
import { Renderer } from "./renderer.js";
import { UI } from "./ui.js";
import * as audio from "./audio.js";
import { clamp, pick, stamp, isoToScreen } from "./utils.js";

const MAX_LOG = 40;

export class Game {
  constructor(canvas) {
    this.world = new World(0);
    this.renderer = new Renderer(canvas, this.world);
    this.world.focusCentre();
    this.threats = new ThreatDirector();
    this.ui = new UI(this);

    this.speed = 1;
    this.paused = false;
    this.time = 0;
    this.accum = 0;
    this.selectedId = null;
    this.hoverId = null;
    this.hoverMember = null;
    this.popups = [];
    this.log = [];

    this.soundOn = true;
    this.modalOpen = false;

    this._resetRun();
    this._bindInput(canvas);
    this._bindKeys();
    this._loop = this._loop.bind(this);
    this._lastFrame = performance.now();
    requestAnimationFrame(this._loop);

    this.ui.setSpeedButtons(this.speed);
    this.ui.setSoundLabel(true);
    audio.startAmbience();
  }

  // ─────────────────────────── Run state ───────────────────────────

  _resetRun() {
    this.seasonIndex = 0;
    this.week = 1;
    this.weekTimer = 0;
    this.members = createFlock(this.world);
    this.threats.reset();

    this.alertness = 38;
    this.oil = 74;
    this.oilMax = 100;
    this.food = 52;
    this.foodMax = 100;
    this.timeLeft = 58;
    this.timeMax = 100;
    this.counsel = 44;
    this.counselMax = 100;

    this.restoredTotal = 0;
    this.fellTotal = 0;
    this.seasonRestored = 0;
    this.seasonFell = 0;
    this.seasonTurned = 0;

    this.log = [];
    this.popups = [];
    this.selectedId = null;
    this._pushLog(SEASONS[0].name + " begins. You are the watchman for this street.", "good");
  }

  get season() {
    return SEASONS[this.seasonIndex % SEASONS.length];
  }

  get seasonName() {
    return this.season.name;
  }

  // ─────────────────────────── Derived stats ───────────────────────────

  get flockHealth() {
    const living = this.members.filter((m) => !m.fallen);
    if (!living.length) return 0;
    const base = living.reduce((s, m) => s + m.vitality, 0) / living.length;
    const fallenPenalty = (this.members.length - living.length) / this.members.length * 42;
    return clamp(base - fallenPenalty, 0, 100);
  }

  get unity() {
    const living = this.members.filter((m) => !m.fallen);
    if (!living.length) return 0;
    const loveAvg = living.reduce((s, m) => s + m.love, 0) / living.length;
    const strained = living.reduce((s, m) => s + (m.burdenKey === "offense" || m.burdenKey === "pride" ? 8 : 0), 0);
    return clamp(loveAvg - strained * 0.5, 0, 100);
  }

  get love() {
    const l = this.members.filter((m) => !m.fallen);
    return l.length ? l.reduce((s, m) => s + m.love, 0) / l.length : 0;
  }

  get prayerfulness() {
    const l = this.members.filter((m) => !m.fallen);
    const base = l.length ? l.reduce((s, m) => s + m.faith, 0) / l.length : 0;
    return clamp(base * 0.72 + this.alertness * 0.28, 0, 100);
  }

  get hospitality() {
    const l = this.members.filter((m) => !m.fallen);
    const visited = l.filter((m) => m.lastAction === "visit").length;
    return clamp(this.food * 0.55 + (visited / Math.max(1, l.length)) * 45, 0, 100);
  }

  get doctrine() {
    const l = this.members.filter((m) => !m.fallen);
    const deceived = l.filter((m) => m.burdenKey === "deception" || m.burdenKey === "doubt").length;
    const mentored = l.filter((m) => m.mentored).length;
    return clamp(72 + mentored * 4 - deceived * 11 - this.threats.totalBreached * 3, 0, 100);
  }

  get establishedCount() {
    return this.members.filter((m) => m.mentored && !m.fallen).length;
  }

  // ─────────────────────────── Speed & pause ───────────────────────────

  setSpeed(speed) {
    this.speed = speed;
    this.paused = speed === 0;
    this.ui.setSpeedButtons(speed);
    audio.play("click");
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    audio.setEnabled(this.soundOn);
    this.ui.setSoundLabel(this.soundOn);
    if (this.soundOn) audio.play("click");
  }

  onModalChange(open) {
    this.modalOpen = open;
    audio.setAmbienceLevel(open ? 0.22 : 0.5);
  }

  // ─────────────────────────── Selection ───────────────────────────

  selectMember(id) {
    this.selectedId = id;
    if (id) audio.play("select");
  }

  // ─────────────────────────── Core actions ───────────────────────────

  keepWatch() {
    if (this.oil < 8) {
      this.ui.toast("Not enough prayer oil. It refills as the weeks pass.", "warn");
      audio.play("error");
      return;
    }
    this.oil -= 8;
    this.alertness = clamp(this.alertness + 18, 0, 100);
    audio.play("watch");
    this._pushLog("You kept watch on the wall. The dark gave up some of its secrets.", "good");

    // Watching reveals hidden burdens on the most burdened members.
    const hidden = this.members
      .filter((m) => m.burdenKey && !m.known)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 2);
    for (const m of hidden) {
      m.known = true;
      this._pushLog(`In prayer you saw it: ${m.name} is carrying ${m.burdenInfo.label.toLowerCase()}.`, "warn");
      this._popup(m, "discerned", "burden revealed", "#e8bf76");
    }
    if (!hidden.length) this.ui.toast("The wall is quiet. Keep watch still.", "");
  }

  warnThreat(threatId) {
    const t = this.threats.threats.find((x) => x.id === threatId);
    if (!t) return;
    const result = this.threats.warn(threatId);

    if (result === "tooLate") {
      audio.play("error");
      this.ui.toast("Too late — it is already at the gate.", "bad");
      return;
    }
    if (result !== "turned") return;

    this.seasonTurned++;
    audio.play("warn");
    const verse = pick([SEASONS[0].verse, { text: "Brothers and sisters, if someone is caught in a sin, you who live by the Spirit should restore that person gently.", ref: "Galatians 6:1" }]);
    this._pushLog(`You sounded a loving warning against ${t.name.toLowerCase()}. It is turning back.`, "good");
    this.ui.toast(`Warning sounded in time — ${t.name.toLowerCase()} is turning back.`, "good");

    // A timely warning strengthens doctrine and unity slightly.
    for (const m of this.members) {
      if (m.fallen) continue;
      m.faith = clamp(m.faith + 1.6, 0, 100);
      m.hope = clamp(m.hope + 1.1, 0, 100);
    }
    this.alertness = clamp(this.alertness - 4, 0, 100);
  }

  performAction(memberId, actionKey) {
    const m = this.members.find((x) => x.id === memberId);
    const action = ACTIONS[actionKey];
    if (!m || !action) return;

    // Cost check.
    for (const [res, amt] of Object.entries(action.cost)) {
      const have = res === "oil" ? this.oil : res === "food" ? this.food : res === "time" ? this.timeLeft : this.counsel;
      if (have < amt) {
        this.ui.toast(`Not enough ${res === "oil" ? "prayer oil" : res}.`, "warn");
        audio.play("error");
        return;
      }
    }
    for (const [res, amt] of Object.entries(action.cost)) {
      if (res === "oil") this.oil -= amt;
      else if (res === "food") this.food -= amt;
      else if (res === "time") this.timeLeft -= amt;
      else if (res === "counsel") this.counsel -= amt;
    }

    const info = m.burdenInfo;
    const stampText = stamp(this.seasonName, this.week);
    let relief = action.relief;
    let kind = "info";
    let popupText = action.short;
    let note = "";

    // Fell-away members can only be reached by a visit.
    if (m.fallen && actionKey !== "visit") {
      this._refund(action);
      this.ui.toast("They have withdrawn entirely. Only a home visit can reach them now.", "warn");
      audio.play("error");
      return;
    }

    const fits = info && info.ideal === actionKey;
    if (fits) relief *= 1.85;

    // Restoration on a hard, unsoftened heart backfires.
    const hardHeart = info?.hard && !m.softened;
    if (actionKey === "restoration" && hardHeart) {
      m.applyWound(9);
      m.trust = clamp(m.trust - 12, 0, 100);
      m.log("Truth was spoken before the heart was ready. It landed as a wound.", "bad", stampText);
      this._pushLog(`${m.name} stiffened under correction. Intercede before speaking again.`, "bad");
      this.ui.toast("A hard heart. The truth wounded rather than healed — intercede first.", "bad");
      this._popup(m, "wounded", "hardened", "#e2694a");
      audio.play("error");
      m.lastAction = actionKey;
      return;
    }

    if (actionKey === "intercession") {
      m.softened = true;
      m.known = true;
      relief = info && info.hard ? action.relief * 1.5 : action.relief;
      note = "Prayed for in secret. The heart is softer than it was.";
      kind = "good";
      popupText = "interceded";
    } else if (actionKey === "visit") {
      relief = m.fallen ? action.relief * 2.4 : action.relief;
      note = "A meal, a chair, a long unhurried hour. Isolation loosened its grip.";
      kind = "good";
      popupText = "visited";
      if (m.fallen && m.severity < 45) {
        m.fallen = false;
        m.restoredCount++;
        this.restoredTotal++;
        this.seasonRestored++;
        this._pushLog(`${m.name} has come back from the far edge of town.`, "good");
        this.ui.toast(`${m.name} has returned to fellowship.`, "good");
        audio.play("restore");
      }
    } else if (actionKey === "restoration") {
      note = "Truth was spoken gently, and it was received. Deception lost its footing.";
      kind = "good";
      popupText = "restored";
    } else if (actionKey === "mentor") {
      m.mentored = true;
      relief = action.relief;
      note = "Paired with a mature believer. This one will grow, and later carry others.";
      kind = "good";
      popupText = "mentored";
    }

    m.applyRelief(relief);
    m.trust = clamp(m.trust + (fits ? 12 : 6), 0, 100);
    m.careGlow = 1;
    m.careCooldown = 4;
    m.lastAction = actionKey;
    m.known = true;

    if (fits) m.log(`${action.name} — a good fit. ${note}`, "good", stampText);
    else m.log(`${action.name}. ${note}`, "good", stampText);

    const healed = info && m.severity <= 0.5;
    if (healed) {
      const was = m.clearBurden();
      m.restoredCount++;
      this.restoredTotal++;
      this.seasonRestored++;
      this._pushLog(`${m.name} is restored — ${BURDENS[was]?.label.toLowerCase() ?? "burden"} lifted.`, "good");
      this.ui.toast(`${m.name} is restored.`, "good");
      this._popup(m, pick(GRACE_WORDS), "burden lifted", "#86c1a0");
      audio.play("restore");
      m.mentored = m.mentored || actionKey === "mentor";
    } else {
      this._pushLog(
        `${action.name} for ${m.name}${fits ? " — a good fit" : ""}.`,
        fits ? "good" : "info"
      );
      this._popup(m, `+${Math.round(relief)}`, popupText, fits ? "#86c1a0" : "#e8bf76");
      audio.play("care");
      if (fits) this.ui.toast(`Good fit — ${action.short} met ${m.name}'s real need.`, "good");
    }

    // Caring for one another feeds the wider flock.
    this.alertness = clamp(this.alertness - 2.5, 0, 100);
  }

  _refund(action) {
    for (const [res, amt] of Object.entries(action.cost)) {
      if (res === "oil") this.oil = clamp(this.oil + amt, 0, this.oilMax);
      else if (res === "food") this.food = clamp(this.food + amt, 0, this.foodMax);
      else if (res === "time") this.timeLeft = clamp(this.timeLeft + amt, 0, this.timeMax);
      else if (res === "counsel") this.counsel = clamp(this.counsel + amt, 0, this.counselMax);
    }
  }

  // ─────────────────────────── Weekly tick ───────────────────────────

  _tickWeek() {
    this.week++;
    const stampText = stamp(this.seasonName, this.week);
    const difficulty = this.season.difficulty;
    const ctx = { difficulty, alertness: this.alertness, unity: this.unity, stamp: stampText };

    // Resources regenerate weekly.
    this.oil = clamp(this.oil + 26, 0, this.oilMax);
    this.food = clamp(this.food + 17, 0, this.foodMax);
    this.timeLeft = clamp(this.timeLeft + 32, 0, this.timeMax);
    this.counsel = clamp(this.counsel + 20, 0, this.counselMax);

    // Alertness decays — the wall must be kept.
    this.alertness = clamp(this.alertness - 11, 0, 100);

    for (const m of this.members) {
      const ev = m.tickWeek(this.world, ctx);
      if (!ev) continue;

      if (ev.type === "fell") {
        this.fellTotal++;
        this.seasonFell++;
        this._pushLog(`${m.name} has fallen away. Nobody carried the weight.`, "bad");
        this.ui.toast(`${m.name} has fallen away from fellowship.`, "bad");
        audio.play("fall");
        this._popup(m, "fallen away", "", "#d76a86");
      } else if (ev.type === "critical") {
        if (m.known) {
          this._pushLog(`${m.name} is close to breaking. Go to them this week.`, "warn");
          this._popup(m, "critical", "burden heavy", "#e2694a");
        }
      } else if (ev.type === "newBurden") {
        const discerned = m.canDiscern(this.alertness);
        if (discerned) {
          this._pushLog(`You notice a change in ${m.name}: ${m.burdenInfo.label.toLowerCase()}.`, "warn");
        } else {
          this._pushLog(`${m.name} has grown quiet. Something may be wrong.`, "warn");
        }
      }
    }

    // Burdens strain unity between related members.
    this._spreadStrain(stampText);

    // Threats that arrived un-warned seed burdens.
    const arrived = this.threats.drainArrivals();
    for (const t of arrived) {
      this._applyBreach(t, stampText);
    }

    if (this.week > WEEKS_PER_SEASON) {
      this._endSeason();
    }
  }

  _spreadStrain(stampText) {
    for (const m of this.members) {
      if (!m.burdenKey || m.fallen) continue;
      if (m.burdenKey !== "offense" && m.burdenKey !== "pride") continue;
      for (const r of m.relations) {
        const other = this.members.find((x) => x.id === r.id);
        if (!other || other.fallen) continue;
        if (r.kind === "tension" || Math.random() < 0.4) {
          other.love = clamp(other.love - 1.6, 0, 100);
          if (Math.random() < 0.22) {
            other.log(`Felt the chill between them. ${m.name}'s hurt is spreading.`, "bad", stampText);
          }
        }
      }
    }
  }

  _applyBreach(threat, stampText) {
    this._pushLog(`${threat.name} reached the village un-warned.`, "bad");
    this.ui.toast(`${threat.name} slipped in. Burdens took root.`, "bad");
    audio.play("fall");

    const targets = this.members
      .filter((m) => !m.fallen)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    for (const m of targets) {
      const seed = pick(threat.def.seeds);
      if (m.burdenKey) {
        m.applyWound(11);
        m.log(`Weighed down further by ${threat.name.toLowerCase()}.`, "bad", stampText);
      } else {
        m.assignBurden(seed, stampText);
        m.severity = clamp(m.severity + 14, 0, 100);
        m.log(`Caught by ${threat.name.toLowerCase()}: ${BURDENS[seed].label.toLowerCase()}.`, "bad", stampText);
      }
    }
    this.alertness = clamp(this.alertness - 8, 0, 100);
  }

  _endSeason() {
    this.paused = true;
    this.speed = 0;
    this.ui.setSpeedButtons(0);
    audio.play("season");

    const summary = {
      seasonIndex: this.seasonIndex,
      restored: this.seasonRestored,
      fell: this.seasonFell,
      threatsTurned: this.seasonTurned,
      health: this.flockHealth,
    };
    this.lastSummary = summary;
    this.ui.openDebrief(summary);
  }

  nextSeason() {
    this.ui.closeModals();
    this.seasonIndex = (this.seasonIndex + 1) % SEASONS.length;
    this.week = 1;
    this.weekTimer = 0;
    this.seasonRestored = 0;
    this.seasonFell = 0;
    this.seasonTurned = 0;
    this.threats.reset();
    this.world.seasonIndex = this.seasonIndex;
    this.renderer.groundSeason = -1;

    // A new season brings fresh supply and a little recovery.
    this.oil = clamp(this.oil + 30, 0, this.oilMax);
    this.food = clamp(this.food + 24, 0, this.foodMax);
    this.counsel = clamp(this.counsel + 26, 0, this.counselMax);
    this.timeLeft = this.timeMax;
    this.alertness = clamp(this.alertness + 12, 0, 100);

    for (const m of this.members) {
      if (m.fallen) continue;
      m.faith = clamp(m.faith + 3, 0, 100);
      m.hope = clamp(m.hope + 3, 0, 100);
      m.log(`${this.season.name} begins. A new season of watching.`, "info", stamp(this.seasonName, 1));
    }

    this._pushLog(`${this.season.name} — ${this.season.subtitle}. The watch continues.`, "good");
    this.setSpeed(1);
  }

  // ─────────────────────────── Save / load ───────────────────────────

  save() {
    const data = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      seasonIndex: this.seasonIndex,
      week: this.week,
      alertness: this.alertness,
      oil: this.oil,
      food: this.food,
      timeLeft: this.timeLeft,
      counsel: this.counsel,
      restoredTotal: this.restoredTotal,
      fellTotal: this.fellTotal,
      seasonRestored: this.seasonRestored,
      seasonFell: this.seasonFell,
      seasonTurned: this.seasonTurned,
      log: this.log.slice(0, 20),
      members: this.members.map((m) => ({
        id: m.id,
        name: m.name,
        faith: m.faith,
        love: m.love,
        hope: m.hope,
        burdenKey: m.burdenKey,
        severity: m.severity,
        softened: m.softened,
        mentored: m.mentored,
        fallen: m.fallen,
        known: m.known,
        restoredCount: m.restoredCount,
        trust: m.trust,
        journal: m.journal.slice(-24),
        gx: m.gx,
        gy: m.gy,
      })),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.ui.toast("Saved. Your watch is remembered.", "good");
      this._pushLog("Game saved.", "info");
      audio.play("click");
    } catch (err) {
      this.ui.toast("Could not save — storage is unavailable.", "bad");
      console.error(err);
    }
  }

  load() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      this.ui.toast("Storage is unavailable.", "bad");
      return;
    }
    if (!raw) {
      this.ui.toast("No saved watch found.", "warn");
      audio.play("error");
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      this.ui.toast("Save file is corrupt.", "bad");
      return;
    }
    if (data.version !== SAVE_VERSION) {
      this.ui.toast("Save is from an older version and cannot be loaded.", "warn");
      return;
    }

    this.seasonIndex = data.seasonIndex ?? 0;
    this.week = data.week ?? 1;
    this.weekTimer = 0;
    this.alertness = data.alertness ?? 40;
    this.oil = data.oil ?? 60;
    this.food = data.food ?? 50;
    this.timeLeft = data.timeLeft ?? 60;
    this.counsel = data.counsel ?? 44;
    this.restoredTotal = data.restoredTotal ?? 0;
    this.fellTotal = data.fellTotal ?? 0;
    this.seasonRestored = data.seasonRestored ?? 0;
    this.seasonFell = data.seasonFell ?? 0;
    this.seasonTurned = data.seasonTurned ?? 0;
    this.log = Array.isArray(data.log) ? data.log : [];

    for (const saved of data.members ?? []) {
      const m = this.members.find((x) => x.id === saved.id);
      if (!m) continue;
      Object.assign(m, {
        faith: saved.faith, love: saved.love, hope: saved.hope,
        burdenKey: saved.burdenKey, burden: saved.burdenKey ? BURDENS[saved.burdenKey] : null,
        severity: saved.severity, softened: saved.softened, mentored: saved.mentored,
        fallen: saved.fallen, known: saved.known, restoredCount: saved.restoredCount,
        trust: saved.trust ?? 30,
        journal: Array.isArray(saved.journal) ? saved.journal : m.journal,
        gx: saved.gx ?? m.gx, gy: saved.gy ?? m.gy,
        tx: saved.gx ?? m.tx, ty: saved.gy ?? m.ty,
      });
    }

    this.threats.reset();
    this.world.seasonIndex = this.seasonIndex;
    this.renderer.groundSeason = -1;
    this.ui.closeModals();
    this.ui.toast("Watch restored from your last save.", "good");
    this._pushLog("Save loaded.", "info");
    this.setSpeed(1);
  }

  // ─────────────────────────── Input ───────────────────────────

  _bindInput(canvas) {
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;

    const pointerPos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = false;
      const p = pointerPos(e);
      lastX = p.x;
      lastY = p.y;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("dragging");
    });

    canvas.addEventListener("pointermove", (e) => {
      const p = pointerPos(e);
      if (dragging) {
        const dx = p.x - lastX;
        const dy = p.y - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        this.world.pan(dx, dy);
        lastX = p.x;
        lastY = p.y;
      }
      this._updateHover(p.x, p.y);
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove("dragging");
      const p = pointerPos(e);
      if (!moved) this._clickAt(p.x, p.y);
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", () => {
      dragging = false;
      canvas.classList.remove("dragging");
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const p = pointerPos(e);
        this.world.zoomBy(e.deltaY, p.x, p.y);
      },
      { passive: false }
    );

    canvas.addEventListener("pointerleave", () => {
      this.hoverMember = null;
      this.hoverId = null;
      canvas.classList.remove("pointing");
    });

    window.addEventListener("resize", () => {
      this.renderer.resize();
      // Keep the village framed unless the player has chosen their own view.
      if (!this.world.userMoved) this.world.focusCentre();
    });
  }

  _updateHover(sx, sy) {
    let best = null;
    let bestDist = 26;
    for (const m of this.members) {
      const iso = isoToScreen(m.gx, m.gy, TILE_W, TILE_H);
      const s = this.world.worldToScreen(iso.x, iso.y - 12);
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    this.hoverMember = best;
    this.hoverId = best ? best.id : null;
    this.renderer.canvas.classList.toggle("pointing", !!best);
  }

  _clickAt(sx, sy) {
    // Nearest member within a generous click radius.
    let best = null;
    let bestDist = 30;
    for (const m of this.members) {
      const iso = isoToScreen(m.gx, m.gy, TILE_W, TILE_H);
      const s = this.world.worldToScreen(iso.x, iso.y - 12);
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    if (best) {
      this.selectMember(best.id);
      return;
    }
    // Clicking empty ground deselects.
    this.selectMember(null);
  }

  _bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) return;
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          this.setSpeed(this.speed === 0 ? 1 : 0);
          break;
        case "1":
          this.setSpeed(1);
          break;
        case "2":
          this.setSpeed(2);
          break;
        case "j":
          this.ui.openJournal(this.selectedId);
          break;
        case "s":
          this.save();
          break;
        case "l":
          this.load();
          break;
        case "h":
          this.ui.openModal("modal-help");
          break;
        case "m":
          this.toggleSound();
          break;
        case "escape":
          if (this.ui.anyModalOpen()) this.ui.closeModals();
          else this.selectMember(null);
          break;
        case "arrowleft":
          this.world.pan(60, 0);
          break;
        case "arrowright":
          this.world.pan(-60, 0);
          break;
        case "arrowup":
          this.world.pan(0, 60);
          break;
        case "arrowdown":
          this.world.pan(0, -60);
          break;
      }
    });
  }

  // ─────────────────────────── Loop ───────────────────────────

  _loop(now) {
    const rawDt = Math.min(0.05, (now - this._lastFrame) / 1000);
    this._lastFrame = now;
    const dt = rawDt;

    const effectiveSpeed = this.modalOpen ? 0 : this.speed;
    const simDt = dt * effectiveSpeed;

    this.time += dt;
    this.world.update(dt);
    this.renderer.setAlertness(this.alertness);

    // Simulation.
    if (effectiveSpeed > 0) {
      this.weekTimer += dt * effectiveSpeed;
      if (this.weekTimer >= WEEK_SECONDS) {
        this.weekTimer -= WEEK_SECONDS;
        this._tickWeek();
      }

      for (const m of this.members) m.update(dt, this.world, effectiveSpeed);

      this.threats.update(dt, {
        alertness: this.alertness,
        seasonDifficulty: this.season.difficulty,
        gameSpeed: effectiveSpeed,
        week: this.week,
      });

      // Threat arrival is resolved on the weekly tick, but flag urgency here.
      const imminent = this.threats.threats.filter((t) => !t.warned && t.proximity > 0.9);
      for (const t of imminent) {
        if (!t._warned50) {
          t._warned50 = true;
          audio.play("threat");
          this.ui.toast(`${t.name} is nearly at the gate. Sound the warning.`, "warn");
        }
      }
    }

    // Popups age in real time so they finish even while paused.
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < p.life);

    this.renderer.draw({
      time: this.time,
      members: this.members,
      threats: this.threats.threats,
      alertness: this.alertness,
      selectedId: this.selectedId,
      hoverId: this.hoverId,
      hoverMember: this.hoverMember,
      popups: this.popups,
    });

    this.ui.syncHud(this.snapshot());

    requestAnimationFrame(this._loop);
  }

  // ─────────────────────────── Helpers ───────────────────────────

  _popup(member, text, sub, colour) {
    const iso = isoToScreen(member.gx, member.gy, TILE_W, TILE_H);
    this.popups.push({
      wx: iso.x,
      wy: iso.y,
      text,
      sub,
      colour,
      age: 0,
      life: 2.4,
    });
  }

  _pushLog(text, kind = "info") {
    this.log.unshift({ text, kind, at: this.time, stamp: stamp(this.seasonName, this.week) });
    if (this.log.length > MAX_LOG) this.log.pop();
  }

  /** Immutable-ish view for the UI and renderer. */
  snapshot() {
    return {
      members: this.members,
      threats: this.threats.threats,
      alertness: this.alertness,
      oil: this.oil,
      oilMax: this.oilMax,
      food: this.food,
      foodMax: this.foodMax,
      timeLeft: this.timeLeft,
      timeMax: this.timeMax,
      counsel: this.counsel,
      counselMax: this.counselMax,
      flockHealth: this.flockHealth,
      unity: this.unity,
      love: this.love,
      prayerfulness: this.prayerfulness,
      hospitality: this.hospitality,
      doctrine: this.doctrine,
      restoredTotal: this.restoredTotal,
      establishedCount: this.establishedCount,
      seasonIndex: this.seasonIndex,
      week: Math.min(this.week, WEEKS_PER_SEASON),
      weeksPerSeason: WEEKS_PER_SEASON,
      selectedId: this.selectedId,
      log: this.log,
    };
  }
}
