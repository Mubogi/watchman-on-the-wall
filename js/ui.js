/**
 * All DOM: HUD meters, roster, member profile, journal, modals, toasts.
 * Keeps the simulation free of element lookups.
 */

import { ACTIONS, BURDENS, SCRIPTURE, SEASONS } from "./config.js";
import { relationLabel } from "./members.js";
import { clamp, stamp } from "./utils.js";
import * as audio from "./audio.js";

const $ = (id) => document.getElementById(id);

const STATE_LABEL = {
  thriving: "thriving",
  steady: "steady",
  drifting: "drifting",
  burdened: "burdened",
  fallen: "fallen away",
};

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      alertRing: $("alert-ring"),
      alertValue: $("alert-value"),
      oilValue: $("oil-value"),
      oilBar: $("oil-bar"),
      watchStatus: $("watch-status"),
      btnWatch: $("btn-watch"),
      healthValue: $("health-value"),
      healthBar: $("health-bar"),
      unityLabel: $("unity-label"),
      statLove: $("stat-love"),
      statPrayer: $("stat-prayer"),
      statHosp: $("stat-hosp"),
      statDoctrine: $("stat-doctrine"),
      restoredCount: $("restored-count"),
      restoredSub: $("restored-sub"),
      resFood: $("res-food"),
      resTime: $("res-time"),
      resCounsel: $("res-counsel"),
      resFoodBar: $("res-food-bar"),
      resTimeBar: $("res-time-bar"),
      resCounselBar: $("res-counsel-bar"),
      seasonName: $("season-name"),
      seasonWeek: $("season-week"),
      seasonDot: $("season-dot"),
      radar: $("radar"),
      threatList: $("threat-list"),
      threatCount: $("threat-count"),
      watchLog: $("watch-log"),
      roster: $("roster"),
      profile: $("profile"),
      toasts: $("toasts"),
      backdrop: $("modal-backdrop"),
      journalNav: $("journal-nav"),
      journalEntries: $("journal-entries"),
      debriefStats: $("debrief-stats"),
      debriefVerse: $("debrief-verse"),
      debriefQuestions: $("debrief-questions"),
      debriefSub: $("debrief-sub"),
    };

    this._radarBlips = new Map();
    this._rosterFaces = new Map();
    this._lastLogLen = 0;
    this._profileId = null;
    this._journalId = null;

    this._bindStatic();
  }

  _bindStatic() {
    // Speed controls
    document.querySelectorAll(".spd").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.game.setSpeed(Number(btn.dataset.speed));
      });
    });

    $("btn-watch").addEventListener("click", () => this.game.keepWatch());
    $("btn-watch-mobile").addEventListener("click", () => this.game.keepWatch());
    $("btn-journal").addEventListener("click", () => this.openJournal());
    $("btn-save").addEventListener("click", () => this.game.save());
    $("btn-load").addEventListener("click", () => this.game.load());
    $("btn-help").addEventListener("click", () => this.openModal("modal-help"));
    $("btn-sound").addEventListener("click", () => this.game.toggleSound());
    $("btn-next-season").addEventListener("click", () => this.game.nextSeason());

    // Drawer actions stand in for the top-bar buttons on phones.
    document.getElementById("drawer-actions").addEventListener("click", (e) => {
      const btn = e.target.closest(".dact");
      if (!btn) return;
      const act = btn.dataset.mact;
      this.closeDrawer();
      this.game.onModalChange?.(false);
      if (act === "journal") this.openJournal(this._profileId);
      else if (act === "save") this.game.save();
      else if (act === "load") this.game.load();
      else if (act === "help") this.openModal("modal-help");
    });
    $("profile-close").addEventListener("click", () => this.game.selectMember(null));
    $("p-journal").addEventListener("click", () => {
      const id = this._profileId;
      this.openJournal(id);
    });

    this.el.backdrop.addEventListener("click", () => this.closeModals());
    document.querySelectorAll("[data-close]").forEach((b) =>
      b.addEventListener("click", () => this.closeModals())
    );

    // Event delegation for dynamic content.
    this.el.roster.addEventListener("click", (e) => {
      const face = e.target.closest(".face");
      if (face) this.game.selectMember(face.dataset.id);
    });

    $("p-actions").addEventListener("click", (e) => {
      const btn = e.target.closest(".act");
      if (btn && !btn.disabled) this.game.performAction(this._profileId, btn.dataset.action);
    });

    $("p-relations").addEventListener("click", (e) => {
      const chip = e.target.closest(".rel-chip");
      if (chip) this.game.selectMember(chip.dataset.id);
    });

    this.el.journalNav.addEventListener("click", (e) => {
      const btn = e.target.closest(".jnav");
      if (btn) this.renderJournalEntry(btn.dataset.id);
    });

    this.el.threatList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-warn]");
      if (btn) this.game.warnThreat(btn.dataset.warn);
    });

    this._bindMobile();
  }

  /** Drawer and bottom-sheet behaviour for phones. */
  _bindMobile() {
    const fab = $("btn-drawer");
    const scrim = $("drawer-scrim");

    const closeDrawer = () => {
      document.body.classList.remove("drawer-left", "drawer-right");
      scrim.hidden = true;
      fab.setAttribute("aria-expanded", "false");
    };

    // One button opens the left panel; a second tap toggles to the right one.
    fab.addEventListener("click", () => {
      const openLeft = document.body.classList.contains("drawer-left");
      const openRight = document.body.classList.contains("drawer-right");
      document.body.classList.remove("drawer-left", "drawer-right");
      if (openLeft) {
        document.body.classList.add("drawer-right");
      } else if (!openRight) {
        document.body.classList.add("drawer-left");
      }
      const open = document.body.classList.contains("drawer-left") || document.body.classList.contains("drawer-right");
      scrim.hidden = !open;
      fab.setAttribute("aria-expanded", String(open));
      this.game.onModalChange?.(open);
      if (open) audio.play("click");
    });

    scrim.addEventListener("click", () => {
      closeDrawer();
      this.game.onModalChange?.(false);
    });

    // Swipe the drawer shut.
    let sx = 0;
    let sy = 0;
    document.querySelectorAll(".hud").forEach((panel) => {
      panel.addEventListener("touchstart", (e) => {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }, { passive: true });
      panel.addEventListener("touchend", (e) => {
        const dx = e.changedTouches[0].clientX - sx;
        const dy = Math.abs(e.changedTouches[0].clientY - sy);
        if (dy < 60 && Math.abs(dx) > 60) {
          closeDrawer();
          this.game.onModalChange?.(false);
        }
      }, { passive: true });
    });

    // Keep the canvas from scrolling the page behind it.
    document.getElementById("world").addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

    this._closeDrawer = closeDrawer;
  }

  closeDrawer() {
    this._closeDrawer?.();
  }

  syncMobileHud(state) {
    const set = (barId, valId, pct, label) => {
      const bar = $(barId);
      const val = $(valId);
      if (bar) bar.style.width = `${clamp(pct, 0, 1) * 100}%`;
      if (val) val.textContent = label;
    };
    set("mh-alert-bar", "mh-alert", state.alertness / 100, String(Math.round(state.alertness)));
    set("mh-oil-bar", "mh-oil", state.oil / state.oilMax, String(Math.round(state.oil)));
    set("mh-health-bar", "mh-health", state.flockHealth / 100, `${Math.round(state.flockHealth)}%`);

    const w = $("btn-watch-mobile");
    if (w) w.disabled = state.oil < 8;

    // Nudge the drawer button when something urgent is happening.
    const dot = $("fab-dot");
    if (dot) {
      const urgent = state.threats.some(
        (t) => !t.defeated && !t.warned && t.isVisible(state.alertness) && t.proximity > 0.55
      );
      dot.hidden = !urgent;
    }
  }

  // ─────────────────────────── HUD ───────────────────────────

  syncHud(state) {
    const { el } = this;

    // Alertness ring.
    const pct = clamp(state.alertness / 100, 0, 1);
    const circumference = 251.3;
    el.alertRing.style.strokeDashoffset = String(circumference * (1 - pct));
    el.alertRing.style.stroke = pct > 0.66 ? "#e8bf76" : pct > 0.33 ? "#d9a45c" : "#8a7550";
    el.alertValue.textContent = String(Math.round(state.alertness));

    el.oilValue.textContent = String(Math.round(state.oil));
    el.oilBar.style.width = `${clamp(state.oil / state.oilMax, 0, 1) * 100}%`;

    const canWatch = state.oil >= 8;
    el.btnWatch.disabled = !canWatch;
    el.watchStatus.textContent = canWatch
      ? state.alertness > 70
        ? "The wall is well kept."
        : "Keep the wall — threats hide in the dark."
      : "Oil is low. It refills with the weeks.";

    // Flock health.
    const health = state.flockHealth;
    el.healthValue.textContent = `${Math.round(health)}%`;
    el.healthBar.style.width = `${health}%`;
    el.healthBar.style.background =
      health > 66
        ? "linear-gradient(90deg,#4d8a6c,#86c1a0)"
        : health > 38
        ? "linear-gradient(90deg,#a8792c,#e8bf76)"
        : "linear-gradient(90deg,#a04a35,#e2694a)";
    el.unityLabel.textContent = `Unity ${Math.round(state.unity)}`;
    el.statLove.textContent = String(Math.round(state.love));
    el.statPrayer.textContent = String(Math.round(state.prayerfulness));
    el.statHosp.textContent = String(Math.round(state.hospitality));
    el.statDoctrine.textContent = String(Math.round(state.doctrine));

    el.restoredCount.textContent = String(state.restoredTotal);
    el.restoredSub.textContent =
      state.restoredTotal === 0
        ? "none yet"
        : `${state.establishedCount} now mentoring others`;

    // Resources.
    el.resFood.textContent = String(Math.round(state.food));
    el.resTime.textContent = String(Math.round(state.timeLeft));
    el.resCounsel.textContent = String(Math.round(state.counsel));
    el.resFoodBar.style.width = `${clamp(state.food / state.foodMax, 0, 1) * 100}%`;
    el.resTimeBar.style.width = `${clamp(state.timeLeft / state.timeMax, 0, 1) * 100}%`;
    el.resCounselBar.style.width = `${clamp(state.counsel / state.counselMax, 0, 1) * 100}%`;

    // Season.
    const season = SEASONS[state.seasonIndex % SEASONS.length];
    el.seasonName.textContent = season.name;
    el.seasonWeek.textContent = `Week ${state.week} of ${state.weeksPerSeason}`;
    el.seasonDot.style.background = season.accent;
    el.seasonDot.style.color = season.accent;

    this.syncThreats(state);
    this.syncLog(state);
    this.syncRoster(state);
    this.syncProfile(state);
    this.syncMobileHud(state);
  }

  syncThreats(state) {
    const { el } = this;
    const visible = state.threats.filter((t) => !t.defeated && (t.isVisible(state.alertness) || t.spotted));

    el.threatCount.textContent = visible.length
      ? `${visible.length} approaching`
      : state.threats.length
      ? "unseen movement"
      : "clear";

    // List — only rebuild when the visible set changes, so the Warn buttons
    // stay attached long enough to be clicked.
    const signature = visible.map((t) => `${t.id}:${t.warned}`).join("|");
    if (signature !== this._threatSig) {
      this._threatSig = signature;
      const html = visible.map(
        (t) => `
        <li class="${t.warned ? "threat-item warned" : "threat-item"}">
          <span class="t-ico">${t.def.icon}</span>
          <span>
            <span class="t-name">${t.name}</span>
            <span class="t-sub">${t.def.blurb}</span>
          </span>
          ${
            t.warned
              ? `<span class="t-dist">turning</span>`
              : `<button class="ghost warn-btn" data-warn="${t.id}">Warn</button>`
          }
        </li>`
      );
      el.threatList.innerHTML = html.length
        ? html.join("")
        : `<li class="threat-empty">${
            state.alertness < 40
              ? "Alertness is low — much of the dark is hidden from you."
              : "No threat in sight. Keep the wall."
          }</li>`;
    }

    // Radar blips.
    const seen = new Set();
    for (const t of visible) {
      seen.add(t.id);
      let blip = this._radarBlips.get(t.id);
      if (!blip) {
        blip = document.createElement("div");
        blip.className = "blip";
        el.radar.appendChild(blip);
        this._radarBlips.set(t.id, blip);
      }
      const r = clamp(t.proximity, 0.06, 0.94);
      const angle = t.angle;
      blip.style.left = `${50 + Math.cos(angle) * r * 46}%`;
      blip.style.top = `${96 - (0.5 + Math.sin(angle) * r * 0.46) * 100}%`;
      blip.style.color = t.warned ? "#86c1a0" : t.def.colour;
      blip.style.background = t.warned ? "#86c1a0" : t.def.colour;
      blip.style.opacity = t.warned ? "0.5" : String(0.55 + t.proximity * 0.45);
    }
    for (const [id, blip] of this._radarBlips) {
      if (!seen.has(id)) {
        blip.remove();
        this._radarBlips.delete(id);
      }
    }
    if (!el.radar.querySelector(".tower")) {
      const tower = document.createElement("div");
      tower.className = "tower";
      tower.textContent = "🏰";
      el.radar.appendChild(tower);
    }
  }

  syncLog(state) {
    const entries = state.log;
    // Keyed off a serial counter, not array length: the log is capped, so
    // length stops changing while entries keep arriving.
    const sig = `${entries.length}:${entries[0]?.at ?? 0}:${entries[0]?.text ?? ""}`;
    if (sig === this._logSig) return;
    this._logSig = sig;
    this.el.watchLog.innerHTML = entries
      .slice(0, 14)
      .map(
        (e) =>
          `<li class="${e.kind}">${e.stamp ? `<span class="t">${e.stamp}</span>` : ""}${e.text}</li>`
      )
      .join("");
  }

  syncRoster(state) {
    const { el } = this;
    if (!this._rosterBuilt) {
      el.roster.innerHTML = state.members
        .map(
          (m) => `
          <button class="face" data-id="${m.id}" title="${m.name} — ${m.role}">
            <span class="emoji">${emojiFor(m)}</span>
            <i class="pip"></i>
            <span class="bar"><i></i></span>
          </button>`
        )
        .join("");
      this._rosterBuilt = true;
      state.members.forEach((m) => {
        this._rosterFaces.set(m.id, el.roster.querySelector(`.face[data-id="${m.id}"]`));
      });
    }

    for (const m of state.members) {
      const face = this._rosterFaces.get(m.id);
      if (!face) continue;
      face.classList.toggle("sel", state.selectedId === m.id);
      const pip = face.querySelector(".pip");
      const colour = stateColour(m);
      pip.style.background = colour;
      pip.style.color = colour;
      const bar = face.querySelector(".bar i");
      const burdenPct = m.burdenKey ? clamp(m.severity, 0, 100) : 0;
      bar.style.width = m.burdenKey ? `${Math.max(8, burdenPct)}%` : "0%";
      bar.style.background =
        burdenPct > 62 ? "#e2694a" : burdenPct > 26 ? "#e8bf76" : "#86c1a0";
      face.style.opacity = m.fallen ? "0.45" : "1";
      face.title = `${m.name} — ${m.role}${m.burdenKey && m.canDiscern(state.alertness) ? ` · ${BURDENS[m.burdenKey].label}` : ""}`;
    }
  }

  syncProfile(state) {
    const m = state.members.find((x) => x.id === state.selectedId);
    if (!m) {
      if (!this.el.profile.hidden) this.el.profile.hidden = true;
      this._profileId = null;
      this._profileSig = null;
      return;
    }
    this.el.profile.hidden = false;
    this._profileId = m.id;

    // Only touch the DOM when something the player can see has changed.
    const info = m.burdenInfo;
    const discerned = !!info && m.canDiscern(state.alertness);
    const sig = [
      m.id, m.state, Math.round(m.faith), Math.round(m.love), Math.round(m.hope),
      m.burdenKey, discerned, Math.round(m.severity), m.softened, m.fallen,
      m.mentored, Math.round(state.oil), Math.round(state.food),
      Math.round(state.timeLeft), Math.round(state.counsel),
    ].join("|");
    if (sig === this._profileSig) return;
    this._profileSig = sig;

    const $id = (k) => document.getElementById(k);
    $id("p-avatar").textContent = emojiFor(m);
    $id("p-name").textContent = m.name;
    $id("p-role").textContent = m.role;
    const stateChip = $id("p-state");
    stateChip.textContent = STATE_LABEL[m.state];
    stateChip.className = `chip state ${m.state}`;
    $id("p-line").textContent = m.note;

    const setMeter = (barId, valId, value) => {
      $id(barId).style.width = `${clamp(value, 0, 100)}%`;
      $id(valId).textContent = String(Math.round(value));
    };
    setMeter("p-faith", "p-faith-v", m.faith);
    setMeter("p-love", "p-love-v", m.love);
    setMeter("p-hope", "p-hope-v", m.hope);

    // Burden.
    $id("p-burden-name").textContent = info
      ? discerned
        ? info.label
        : "something hidden"
      : "none";
    $id("p-burden-desc").textContent = info
      ? discerned
        ? info.desc
        : "You sense a weight but cannot name it. Raise your alertness or spend time with them."
      : m.fallen
      ? "They have fallen away. Only a home visit can bring them back now."
      : "Carrying no unusual weight just now. Keep watch.";
    $id("p-sev").style.width = `${info ? clamp(m.severity, 0, 100) : 0}%`;
    $id("p-soften").hidden = !m.softened;

    // Actions.
    this._renderActions(m, state, discerned);

    // Relationships.
    const rels = m.relations
      .map((r) => {
        const other = state.members.find((x) => x.id === r.id);
        if (!other) return "";
        return `<button class="rel-chip" data-id="${other.id}">${other.name} <small>· ${relationLabel(r.kind)}</small></button>`;
      })
      .join("");
    $id("p-relations").innerHTML = rels || `<span class="micro">No recorded links yet.</span>`;
  }

  _renderActions(m, state, discerned) {
    const wrap = document.getElementById("p-actions");
    const ideal = discerned && m.burdenInfo ? m.burdenInfo.ideal : null;
    const hardHeart = discerned && m.burdenInfo?.hard && !m.softened;

    wrap.innerHTML = Object.entries(ACTIONS)
      .map(([key, a]) => {
        const cost = Object.entries(a.cost)
          .map(([res, amt]) => `${amt} ${res === "oil" ? "oil" : res}`)
          .join(" · ");
        const affordable =
          (a.cost.oil ? state.oil >= a.cost.oil : true) &&
          (a.cost.food ? state.food >= a.cost.food : true) &&
          (a.cost.time ? state.timeLeft >= a.cost.time : true) &&
          (a.cost.counsel ? state.counsel >= a.cost.counsel : true);
        const disabled = !affordable || m.fallen && key !== "visit";
        const isIdeal = ideal === key;
        const risky = key === "restoration" && hardHeart;
        const classes = ["act", isIdeal ? "ideal" : "", risky ? "warn-act" : ""]
          .filter(Boolean)
          .join(" ");
        const tag = isIdeal
          ? `<span class="act-tag">fits</span>`
          : risky
          ? `<span class="act-tag risky">hard heart</span>`
          : "";
        return `<button class="${classes}" data-action="${key}" ${disabled ? "disabled" : ""}>
          ${tag}
          <span class="act-name">${a.icon} ${a.short}</span>
          <span class="act-cost">${cost}</span>
        </button>`;
      })
      .join("");
  }

  // ─────────────────────────── Toasts & popups ───────────────────────────

  toast(text, kind = "") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.el.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 420);
    }, 2600);
    // Cap the stack.
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
  }

  // ─────────────────────────── Modals ───────────────────────────

  openModal(id) {
    this.closeModals(true);
    this.el.backdrop.hidden = false;
    const modal = document.getElementById(id);
    if (modal) modal.hidden = false;
    this.game.onModalChange?.(true);
  }

  closeModals(silent = false) {
    this.el.backdrop.hidden = true;
    document.querySelectorAll(".modal").forEach((m) => (m.hidden = true));
    if (!silent) this.game.onModalChange?.(false);
  }

  anyModalOpen() {
    return !this.el.backdrop.hidden;
  }

  // ─────────────────────────── Journal ───────────────────────────

  openJournal(focusId = null) {
    const state = this.game.snapshot();
    const members = state.members;
    const target = focusId || this._journalId || members[0].id;
    this._journalId = target;

    this.el.journalNav.innerHTML = members
      .map((m) => {
        const n = m.journal.length;
        return `<button class="jnav ${m.id === target ? "on" : ""}" data-id="${m.id}">
          <span class="jico">${emojiFor(m)}</span>
          <span>${m.name}</span>
          <span class="jmeta">${n}</span>
        </button>`;
      })
      .join("");

    this.openModal("modal-journal");
    this.renderJournalEntry(target);
  }

  renderJournalEntry(id) {
    this._journalId = id;
    const state = this.game.snapshot();
    const m = state.members.find((x) => x.id === id);
    if (!m) return;

    this.el.journalNav.querySelectorAll(".jnav").forEach((b) => {
      b.classList.toggle("on", b.dataset.id === id);
    });

    const info = m.burdenInfo;
    const discerned = info && m.canDiscern(state.alertness);
    const rels = m.relations
      .map((r) => {
        const o = state.members.find((x) => x.id === r.id);
        return o ? `${o.name} (${relationLabel(r.kind)})` : "";
      })
      .filter(Boolean)
      .join(", ");

    const timeline = m.journal.length
      ? `<ul class="timeline">${m.journal
          .slice()
          .reverse()
          .map(
            (j) =>
              `<li class="${j.kind}"><span class="tw">${j.stamp || "—"}</span>${j.text}</li>`
          )
          .join("")}</ul>`
      : `<p class="timeline-empty">No entries yet. Their journey is still unwritten.</p>`;

    const verse = pickVerseFor(m);

    this.el.journalEntries.innerHTML = `
      <div class="jentry-head">
        <div class="avatar">${emojiFor(m)}</div>
        <div>
          <h3>${m.name}</h3>
          <p>${m.role} · ${STATE_LABEL[m.state]} · faith ${Math.round(m.faith)} · love ${Math.round(m.love)} · hope ${Math.round(m.hope)}</p>
        </div>
      </div>

      <div class="jsection-title">Present burden</div>
      <p style="font-size:12px;line-height:1.55;color:var(--ink-soft);margin:0 0 4px">
        ${
          info
            ? discerned
              ? `<b style="color:var(--amber)">${info.label}</b> — ${info.desc}`
              : "A weight is present but not yet discerned. Spend time with them, or raise your alertness."
            : m.fallen
            ? "They have fallen away from fellowship. A home visit and a meal can still reach them."
            : "No unusual burden recorded. They are growing quietly."
        }
      </p>
      ${info ? `<div class="meter-bar" style="margin-top:6px"><i class="fill sev" style="width:${clamp(m.severity, 0, 100)}%"></i></div>` : ""}

      <div class="jsection-title">Care given</div>
      <p style="font-size:12px;line-height:1.55;color:var(--ink-soft);margin:0">
        ${
          m.restoredCount > 0
            ? `Restored <b>${m.restoredCount}</b> time${m.restoredCount > 1 ? "s" : ""}. ${
                m.mentored ? "Now paired with a mature mentor." : "Not yet paired with a mentor."
              }`
            : "No restoration recorded yet."
        }
      </p>

      <div class="jsection-title">Relationships</div>
      <p style="font-size:12px;line-height:1.55;color:var(--ink-soft);margin:0">${rels || "No recorded links."}</p>

      <div class="jsection-title">Journey</div>
      ${timeline}

      <div class="verse-card">
        ${verse.text}
        <cite>${verse.ref}</cite>
      </div>
    `;
  }

  // ─────────────────────────── Debrief ───────────────────────────

  openDebrief(summary) {
    const season = SEASONS[summary.seasonIndex % SEASONS.length];
    this.el.debriefSub.textContent = `For elders, cell leaders and intercessors — ${season.name}, ${season.subtitle}.`;

    this.el.debriefStats.innerHTML = [
      { v: summary.restored, k: "Restored" },
      { v: summary.fell, k: "Fell away" },
      { v: summary.threatsTurned, k: "Warnings heeded" },
      { v: `${Math.round(summary.health)}%`, k: "Flock health" },
    ]
      .map((s) => `<div class="dstat"><b>${s.v}</b><span>${s.k}</span></div>`)
      .join("");

    this.el.debriefVerse.innerHTML = `${season.verse.text}<cite>${season.verse.ref}</cite>`;
    this.el.debriefQuestions.innerHTML = season.debrief
      .map((q) => `<li>${q}</li>`)
      .join("");

    this.openModal("modal-debrief");
  }

  setSoundLabel(on) {
    const btn = document.getElementById("btn-sound");
    btn.textContent = on ? "♪" : "♪̸";
    btn.style.opacity = on ? "1" : "0.45";
  }

  setSpeedButtons(speed) {
    document.querySelectorAll(".spd").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.speed) === speed);
    });
  }
}

// ─────────────────────────── Helpers ───────────────────────────

function emojiFor(m) {
  if (m.fallen) return "🥀";
  switch (m.state) {
    case "thriving":
      return "😊";
    case "burdened":
      return "😔";
    case "drifting":
      return "😐";
    default:
      return "🙂";
  }
}

function stateColour(m) {
  if (m.fallen) return "#d76a86";
  switch (m.state) {
    case "thriving":
      return "#86c1a0";
    case "burdened":
      return "#e2694a";
    case "drifting":
      return "#e8bf76";
    default:
      return "#7fb3d5";
  }
}

function pickVerseFor(m) {
  const info = m.burdenInfo;
  if (!info) {
    return m.state === "thriving"
      ? { text: "They will be like a tree planted by the water that sends out its roots by the stream.", ref: "Jeremiah 17:8" }
      : SCRIPTURE.gather;
  }
  switch (info.ideal) {
    case "visit":
      return { text: "Religion that God our Father accepts as pure and faultless is this: to look after orphans and widows in their distress.", ref: "James 1:27" };
    case "restoration":
      return SCRIPTURE.gentle;
    case "mentor":
      return { text: "And the things you have heard me say… entrust to reliable people who will also be qualified to teach others.", ref: "2 Timothy 2:2" };
    case "intercession":
    default:
      return SCRIPTURE.pray;
  }
}
