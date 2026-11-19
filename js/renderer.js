/**
 * Canvas renderer. Draws the isometric village, buildings, villagers, threats
 * and floating grace popups. Ground is pre-rendered once per season; everything
 * animated is drawn per frame with painter's-algorithm depth sorting.
 */

import { GRID, TILE_W, TILE_H } from "./config.js";
import { TILE } from "./world.js";
import { isoToScreen, clamp, lerp, hashString, shade, rgba } from "./utils.js";

const GROUND_PAD = 120;

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.world = world;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.ground = document.createElement("canvas");
    this.groundCtx = this.ground.getContext("2d");
    this.time = 0;
    this.hoverId = null;
    this.selectedId = null;
    this.groundSeason = -1;
    this.stars = this._makeStars();
    this.resize();
  }

  _makeStars() {
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({ x: Math.random(), y: Math.random() * 0.45, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28 });
    }
    return stars;
  }

  resize() {
    const { canvas } = this;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    canvas.width = Math.floor(w * this.dpr);
    canvas.height = Math.floor(h * this.dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.world.resize(w, h);
  }

  // ─────────────────────────── Ground ───────────────────────────

  rebuildGround() {
    const season = this.world.season;
    const c = this.groundCtx;

    // Bounding box of the whole grid in world space.
    const min = isoToScreen(-1, GRID + 1, TILE_W, TILE_H);
    const max = isoToScreen(GRID + 1, -1, TILE_W, TILE_H);
    const ox = min.x - GROUND_PAD;
    const oy = min.y - GROUND_PAD;
    const gw = max.x - min.x + GROUND_PAD * 2;
    const gh = max.y - min.y + GROUND_PAD * 2;

    this.ground.width = Math.ceil(gw);
    this.ground.height = Math.ceil(gh);
    this.groundOrigin = { x: ox, y: oy };

    c.clearRect(0, 0, gw, gh);
    c.translate(-ox, -oy);

    // Outskirts: soft dark earth fading to nothing.
    const halo = c.createRadialGradient(0, 0, 120, 0, 0, 900);
    halo.addColorStop(0, "rgba(26,34,28,0.95)");
    halo.addColorStop(0.55, "rgba(14,19,18,0.7)");
    halo.addColorStop(1, "rgba(6,8,12,0)");
    c.fillStyle = halo;
    c.fillRect(ox, oy, gw, gh);

    // Tiles, back to front.
    for (let sum = 0; sum <= (GRID - 1) * 2; sum++) {
      for (let gy = 0; gy < GRID; gy++) {
        const gx = sum - gy;
        if (gx < 0 || gx >= GRID) continue;
        this._drawTile(c, gx, gy, season);
      }
    }

    // Grass tufts.
    for (const t of this.world.grassTufts) {
      const p = isoToScreen(t.gx, t.gy, TILE_W, TILE_H);
      c.strokeStyle = rgba(shade(season.ground[0], 0.22), 0.5);
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x + 1.6 * t.s, p.y - 5 * t.s);
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - 1.4 * t.s, p.y - 4 * t.s);
      c.stroke();
    }

    c.setTransform(1, 0, 0, 1, 0, 0);
    this.groundSeason = this.world.seasonIndex;
  }

  _drawTile(c, gx, gy, season) {
    const type = this.world.tiles[gy * GRID + gx];
    const p = isoToScreen(gx + 0.5, gy + 0.5, TILE_W, TILE_H);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const n = hashString(`${gx}:${gy}:${season.key}`);

    let base;
    if (type === TILE.PATH) {
      base = shade("#6f6350", (n - 0.5) * 0.16);
    } else if (type === TILE.PLAZA) {
      base = shade("#7d7160", (n - 0.5) * 0.12);
    } else if (type === TILE.WATER) {
      base = "#1d3a4a";
    } else if (type === TILE.FIELD) {
      base = shade(season.ground[2], (n - 0.5) * 0.14);
    } else {
      base = shade(season.ground[n > 0.5 ? 0 : 1], (n - 0.5) * 0.18);
    }

    c.beginPath();
    c.moveTo(p.x, p.y - hh);
    c.lineTo(p.x + hw, p.y);
    c.lineTo(p.x, p.y + hh);
    c.lineTo(p.x - hw, p.y);
    c.closePath();
    c.fillStyle = base;
    c.fill();

    // Slight per-tile sheen on the upper-left edge.
    c.strokeStyle = rgba("#ffffff", 0.035);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(p.x - hw, p.y);
    c.lineTo(p.x, p.y - hh);
    c.lineTo(p.x + hw, p.y);
    c.stroke();

    if (type === TILE.WATER) {
      c.fillStyle = rgba("#8fc4d8", 0.12 + 0.05 * Math.sin(gx + gy));
      c.fill();
    }
    if (type === TILE.PATH || type === TILE.PLAZA) {
      // Scattered pebbles.
      if (n > 0.72) {
        c.fillStyle = rgba("#2a2419", 0.22);
        c.beginPath();
        c.ellipse(p.x + (n - 0.5) * 20, p.y + (n - 0.5) * 8, 2.1, 1.2, 0, 0, 6.28);
        c.fill();
      }
    }
  }

  // ─────────────────────────── Frame ───────────────────────────

  draw(state) {
    const { ctx, world } = this;
    const season = world.season;
    this.time = state.time;
    this.selectedId = state.selectedId;
    this.hoverId = state.hoverId;

    const cam = world.camera;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Sky / background.
    const bg = ctx.createLinearGradient(0, 0, 0, this.h);
    bg.addColorStop(0, shade(season.sky, -0.25));
    bg.addColorStop(0.55, season.sky);
    bg.addColorStop(1, shade(season.sky, -0.42));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    this._drawSky(ctx, season);

    // World transform.
    ctx.setTransform(
      this.dpr * cam.zoom, 0, 0, this.dpr * cam.zoom,
      this.dpr * (this.w / 2 - cam.x * cam.zoom),
      this.dpr * (this.h / 2 - cam.y * cam.zoom)
    );

    if (this.groundSeason !== world.seasonIndex) this.rebuildGround();
    ctx.drawImage(this.ground, this.groundOrigin.x, this.groundOrigin.y);

    // Depth-sorted scene objects.
    const drawables = [];
    for (const b of world.buildings) {
      drawables.push({ depth: b.gx + b.gy + (b.w + b.h) / 2, kind: "building", ref: b });
    }
    for (const p of world.props) {
      drawables.push({ depth: p.gx + p.gy, kind: "prop", ref: p });
    }
    for (const m of state.members) {
      drawables.push({ depth: m.gx + m.gy + 0.05, kind: "member", ref: m });
    }
    for (const t of state.threats) {
      if (t.defeated) continue;
      const pos = this.threatWorldPos(t);
      drawables.push({ depth: (pos.depth ?? 0), kind: "threat", ref: t, pos });
    }
    drawables.sort((a, b) => a.depth - b.depth);

    for (const d of drawables) {
      if (d.kind === "building") this._drawBuilding(ctx, d.ref, season);
      else if (d.kind === "prop") this._drawProp(ctx, d.ref, season);
      else if (d.kind === "member") this._drawMember(ctx, d.ref, season);
    }

    // Threats sit above the scene as looming silhouettes.
    for (const d of drawables) {
      if (d.kind === "threat") this._drawThreat(ctx, d.ref, d.pos);
    }

    // Selection ring drawn on top of the ground layer but under figures' labels.
    if (state.selectedId) {
      const m = state.members.find((x) => x.id === state.selectedId);
      if (m) this._drawSelection(ctx, m);
    }

    // Reset to screen space for crisp text.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const m of state.members) this._drawMemberLabel(ctx, m, season);
    for (const t of state.threats) {
      if (!t.defeated && t.isVisible(state.alertness)) {
        this._drawThreatBadge(ctx, t, this.threatWorldPos(t));
      }
    }
    this._drawEdgeArrows(ctx, state);
    for (const p of state.popups) this._drawPopup(ctx, p);
    this._drawHoverTip(ctx, state);
  }

  _drawSky(ctx, season) {
    // Stars, dimmed by season.
    const starAlpha = season.key === "winter" ? 0.75 : 0.4;
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.time * 1.4 + s.p);
      ctx.fillStyle = `rgba(255, 246, 224, ${0.5 * tw * starAlpha})`;
      ctx.beginPath();
      ctx.arc(s.x * this.w, s.y * this.h * 0.9, s.r, 0, 6.28);
      ctx.fill();
    }
    // Moon.
    const mx = this.w * 0.82;
    const my = this.h * 0.13;
    const g = ctx.createRadialGradient(mx, my, 4, mx, my, 92);
    g.addColorStop(0, "rgba(255, 246, 222, 0.32)");
    g.addColorStop(1, "rgba(255, 246, 222, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, 92, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 250, 235, 0.86)";
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = shade(season.sky, 0.06);
    ctx.beginPath();
    ctx.arc(mx - 8, my - 6, 17, 0, 6.28);
    ctx.fill();
  }

  // ─────────────────────────── Buildings ───────────────────────────

  _isoQuad(gx, gy, w, h) {
    return [
      isoToScreen(gx, gy, TILE_W, TILE_H),
      isoToScreen(gx + w, gy, TILE_W, TILE_H),
      isoToScreen(gx + w, gy + h, TILE_W, TILE_H),
      isoToScreen(gx, gy + h, TILE_W, TILE_H),
    ];
  }

  _poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  _drawBuilding(ctx, b, season) {
    const H = b.kind === "tower" ? 34 : b.kind === "hall" ? 30 : 24;
    const storeys = b.storeys || 1;
    const totalH = H * storeys;

    const [A, B, C, D] = this._isoQuad(b.gx, b.gy, b.w, b.h);

    // Ground shadow.
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#05070c";
    ctx.beginPath();
    ctx.moveTo(A.x + 10, A.y + 6);
    ctx.lineTo(B.x + 16, B.y + 12);
    ctx.lineTo(C.x + 6, C.y + 18);
    ctx.lineTo(D.x - 8, D.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Walls: left face (+y) darker, right face (+x) mid.
    const wallDark = shade(b.wall, -0.34);
    const wallMid = shade(b.wall, -0.14);
    const wallTop = shade(b.wall, 0.1);

    const leftFace = [
      D, C,
      { x: C.x, y: C.y - totalH },
      { x: D.x, y: D.y - totalH },
    ];
    const rightFace = [
      C, B,
      { x: B.x, y: B.y - totalH },
      { x: C.x, y: C.y - totalH },
    ];
    this._poly(ctx, leftFace, wallDark, rgba("#000000", 0.22));
    this._poly(ctx, rightFace, wallMid, rgba("#000000", 0.22));

    // Top slab (visible if roof is short / flat-roofed market).
    const topFace = [
      { x: A.x, y: A.y - totalH },
      { x: B.x, y: B.y - totalH },
      { x: C.x, y: C.y - totalH },
      { x: D.x, y: D.y - totalH },
    ];

    // Roof.
    if (b.kind === "tower") {
      this._drawTowerTop(ctx, b, topFace, totalH, season);
    } else if (b.kind === "market") {
      this._drawAwning(ctx, b, topFace);
    } else {
      this._drawHipRoof(ctx, b, topFace, b.kind === "hall" ? 26 : 20, season);
    }

    // Windows with warm light.
    this._drawWindows(ctx, b, leftFace, rightFace, totalH, storeys);

    // Door on the right face.
    this._drawDoor(ctx, b, rightFace, totalH);
  }

  _drawHipRoof(ctx, b, topFace, roofH, season) {
    const [A, B, C, D] = topFace;
    const cx = (A.x + B.x + C.x + D.x) / 4;
    const cy = (A.y + B.y + C.y + D.y) / 4;

    // Slight overhang.
    const over = 4;
    const ex = (p) => ({ x: p.x + (p.x - cx) * (over / 40), y: p.y + (p.y - cy) * (over / 40) });
    const A2 = ex(A), B2 = ex(B), C2 = ex(C), D2 = ex(D);

    const ridgeA = { x: lerp(D2.x, A2.x, 0.5) + (A2.x - D2.x) * 0.12, y: lerp(D2.y, A2.y, 0.5) + (A2.y - D2.y) * 0.12 - roofH };
    const ridgeB = { x: lerp(C2.x, B2.x, 0.5) + (B2.x - C2.x) * 0.12, y: lerp(C2.y, B2.y, 0.5) + (B2.y - C2.y) * 0.12 - roofH };

    const roofMid = shade(b.roof, -0.06);
    const roofLight = shade(b.roof, 0.16);

    // South plane (+y side, faces viewer-left).
    this._poly(ctx, [D2, C2, ridgeB, ridgeA], roofMid, rgba("#000000", 0.28));
    // East plane (+x side, faces viewer-right).
    this._poly(ctx, [C2, B2, ridgeB], roofLight, rgba("#000000", 0.28));

    // Ridge highlight.
    ctx.strokeStyle = rgba(shade(b.trim, 0.2), 0.5);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ridgeA.x, ridgeA.y);
    ctx.lineTo(ridgeB.x, ridgeB.y);
    ctx.stroke();

    // Eave shadow on the wall.
    ctx.strokeStyle = rgba("#000000", 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(D2.x, D2.y);
    ctx.lineTo(C2.x, C2.y);
    ctx.lineTo(B2.x, B2.y);
    ctx.stroke();
  }

  _drawTowerTop(ctx, b, topFace, totalH, season) {
    const [A, B, C, D] = topFace;
    const cx = (A.x + B.x + C.x + D.x) / 4;
    const cy = (A.y + B.y + C.y + D.y) / 4;

    // Battlemented parapet: a ring of crenellations around the top slab.
    this._poly(ctx, [A, B, C, D], shade(b.wall, 0.14), rgba("#000000", 0.3));

    const wallH = 7;
    const corners = [A, B, C, D];
    // Parapet walls on the two visible sides.
    this._poly(ctx, [
      D, C, { x: C.x, y: C.y - wallH }, { x: D.x, y: D.y - wallH },
    ], shade(b.wall, -0.18));
    this._poly(ctx, [
      C, B, { x: B.x, y: B.y - wallH }, { x: C.x, y: C.y - wallH },
    ], shade(b.wall, -0.05));

    // Crenellations along the top edges.
    const crenel = (p1, p2, count, colour) => {
      for (let i = 0; i < count; i++) {
        const t0 = i / count + 0.12 / count;
        const t1 = (i + 0.62) / count;
        const a = { x: lerp(p1.x, p2.x, t0), y: lerp(p1.y, p2.y, t0) - wallH };
        const bb = { x: lerp(p1.x, p2.x, t1), y: lerp(p1.y, p2.y, t1) - wallH };
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(bb.x, bb.y);
        ctx.lineTo(bb.x, bb.y - 5);
        ctx.lineTo(a.x, a.y - 5);
        ctx.closePath();
        ctx.fill();
      }
    };
    crenel(D, C, 4, shade(b.wall, -0.02));
    crenel(C, B, 4, shade(b.wall, 0.1));

    // The watch fire on top — a warm pool of light.
    const fireY = cy - totalH - 16;
    const t = this.time;
    const flick = 0.8 + 0.2 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.1);

    const glow = ctx.createRadialGradient(cx, fireY, 2, cx, fireY, 120 * flick);
    glow.addColorStop(0, "rgba(255, 205, 130, 0.55)");
    glow.addColorStop(0.35, "rgba(240, 161, 90, 0.2)");
    glow.addColorStop(1, "rgba(240, 161, 90, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, fireY, 120 * flick, 0, 6.28);
    ctx.fill();

    // Brazier.
    ctx.fillStyle = "#2b2a26";
    ctx.beginPath();
    ctx.ellipse(cx, fireY + 12, 9, 4, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = "#3a3833";
    ctx.fillRect(cx - 2.5, fireY + 4, 5, 9);

    // Flame.
    ctx.fillStyle = `rgba(255, 186, 96, ${0.85 * flick})`;
    ctx.beginPath();
    ctx.moveTo(cx - 6, fireY + 8);
    ctx.quadraticCurveTo(cx - 4, fireY - 6 * flick, cx, fireY - 13 * flick);
    ctx.quadraticCurveTo(cx + 5, fireY - 4 * flick, cx + 6, fireY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 246, 210, ${0.9 * flick})`;
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, fireY + 7);
    ctx.quadraticCurveTo(cx - 1.4, fireY - 2 * flick, cx, fireY - 6 * flick);
    ctx.quadraticCurveTo(cx + 1.6, fireY - 1 * flick, cx + 2.5, fireY + 7);
    ctx.closePath();
    ctx.fill();

    // A banner on a pole.
    const px = cx + 16;
    ctx.strokeStyle = "#4a443a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, fireY + 14);
    ctx.lineTo(px, fireY - 26);
    ctx.stroke();
    const wave = Math.sin(t * 2.2) * 3;
    ctx.fillStyle = rgba(b.trim, 0.85);
    ctx.beginPath();
    ctx.moveTo(px, fireY - 26);
    ctx.quadraticCurveTo(px + 12 + wave, fireY - 22, px + 15 + wave, fireY - 16);
    ctx.quadraticCurveTo(px + 9, fireY - 15, px, fireY - 12);
    ctx.closePath();
    ctx.fill();
  }

  _drawAwning(ctx, b, topFace) {
    const [A, B, C, D] = topFace;
    const minX = Math.min(A.x, B.x, C.x, D.x);
    const maxX = Math.max(A.x, B.x, C.x, D.x);

    // Striped canvas roof, clipped to the footprint.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(D.x, D.y);
    ctx.closePath();
    ctx.clip();
    const stripeW = 9;
    for (let x = minX, i = 0; x < maxX + stripeW; x += stripeW, i++) {
      ctx.fillStyle = i % 2 === 0 ? "#b8563c" : "#e8d7b8";
      ctx.fillRect(x, A.y - 30, stripeW, 60);
    }
    ctx.restore();

    ctx.strokeStyle = rgba("#000000", 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(D.x, D.y);
    ctx.closePath();
    ctx.stroke();

    // Produce crates along the front edge.
    for (let i = 0; i < 3; i++) {
      const t = 0.25 + i * 0.25;
      const px = lerp(D.x, C.x, t);
      const py = lerp(D.y, C.y, t) - 3;
      ctx.fillStyle = "#7a5c3c";
      ctx.fillRect(px - 4, py - 5, 8, 5);
      ctx.fillStyle = i === 1 ? "#c2703f" : "#8a6a3a";
      ctx.fillRect(px - 3, py - 8, 6, 3);
    }
  }

  _drawWindows(ctx, b, leftFace, rightFace, totalH, storeys) {
    const lit = b.id === "tower" ? 1 : 0.6;
    const flicker = 0.86 + 0.14 * Math.sin(this.time * 1.7 + b.gx);

    for (let s = 0; s < storeys; s++) {
      const baseY = -12 - s * (totalH / storeys);
      // Right face windows.
      for (let i = 0; i < b.w; i++) {
        const t = (i + 0.5) / b.w;
        const x = lerp(rightFace[0].x, rightFace[1].x, t);
        const y = lerp(rightFace[0].y, rightFace[1].y, t) + baseY;
        this._window(ctx, x, y, lit * flicker);
      }
      // Left face windows.
      for (let i = 0; i < b.h; i++) {
        const t = (i + 0.5) / b.h;
        const x = lerp(leftFace[0].x, leftFace[1].x, t);
        const y = lerp(leftFace[0].y, leftFace[1].y, t) + baseY;
        this._window(ctx, x, y, lit * flicker * 0.8);
      }
    }
  }

  _window(ctx, x, y, intensity) {
    const w = 5;
    const h = 7;
    const g = ctx.createRadialGradient(x, y - h / 2, 1, x, y - h / 2, 26);
    g.addColorStop(0, `rgba(255, 200, 120, ${0.4 * intensity})`);
    g.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - h / 2, 26, 0, 6.28);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 214, 145, ${0.55 + 0.4 * intensity})`;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.strokeStyle = "rgba(30, 20, 12, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2, y - h, w, h);
  }

  _drawDoor(ctx, b, rightFace, totalH) {
    const t = 0.5;
    const x = lerp(rightFace[0].x, rightFace[1].x, t);
    const y = lerp(rightFace[0].y, rightFace[1].y, t);
    const dh = 12;
    ctx.fillStyle = "rgba(38, 26, 16, 0.85)";
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 4, y - dh);
    ctx.quadraticCurveTo(x, y - dh - 4, x + 4, y - dh);
    ctx.lineTo(x + 4, y);
    ctx.closePath();
    ctx.fill();
    // Warm light spilling from the doorway.
    const g = ctx.createLinearGradient(x, y, x, y + 14);
    g.addColorStop(0, "rgba(255, 190, 110, 0.24)");
    g.addColorStop(1, "rgba(255, 190, 110, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x + 12, y + 12);
    ctx.lineTo(x - 12, y + 12);
    ctx.closePath();
    ctx.fill();
  }

  // ─────────────────────────── Props ───────────────────────────

  _drawProp(ctx, p, season) {
    const s = isoToScreen(p.gx, p.gy, TILE_W, TILE_H);
    const scale = p.s || 1;

    switch (p.kind) {
      case "tree": {
        // Trunk.
        ctx.fillStyle = "#3d2f24";
        ctx.fillRect(s.x - 2 * scale, s.y - 12 * scale, 4 * scale, 13 * scale);
        // Canopy: layered blobs with seasonal tint.
        const leaf = season.key === "autumn" ? "#b06a3a" : season.key === "winter" ? "#5a6b62" : "#3f6b4a";
        const sway = Math.sin(this.time * 1.1 + p.gx) * 1.6;
        const layers = [
          { dx: 0, dy: -22, r: 13 },
          { dx: -7, dy: -17, r: 10 },
          { dx: 7, dy: -18, r: 10 },
          { dx: 0, dy: -30, r: 9 },
        ];
        for (const l of layers) {
          ctx.fillStyle = shade(leaf, l.dy > -25 ? -0.06 : 0.08);
          ctx.beginPath();
          ctx.arc(s.x + (l.dx + sway) * scale, s.y + l.dy * scale, l.r * scale, 0, 6.28);
          ctx.fill();
        }
        // Shadow.
        ctx.fillStyle = "rgba(0,0,0,0.26)";
        ctx.beginPath();
        ctx.ellipse(s.x + 4, s.y + 1, 12 * scale, 5 * scale, 0, 0, 6.28);
        ctx.fill();
        break;
      }
      case "lamp": {
        ctx.fillStyle = "#332c24";
        ctx.fillRect(s.x - 1.5, s.y - 22, 3, 23);
        const flick = 0.85 + 0.15 * Math.sin(this.time * 5.1 + p.gx * 2);
        const g = ctx.createRadialGradient(s.x, s.y - 24, 1, s.x, s.y - 24, 46 * flick);
        g.addColorStop(0, `rgba(255, 208, 132, ${0.5 * flick})`);
        g.addColorStop(1, "rgba(255, 208, 132, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 24, 46 * flick, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#ffd894";
        ctx.beginPath();
        ctx.arc(s.x, s.y - 24, 3.2, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "#4a4136";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(s.x - 4, s.y - 27);
        ctx.lineTo(s.x, s.y - 30);
        ctx.lineTo(s.x + 4, s.y - 27);
        ctx.stroke();
        break;
      }
      case "well": {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 2, 18, 8, 0, 0, 6.28);
        ctx.fill();
        // Stone ring.
        ctx.fillStyle = "#6b6558";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 15, 7.5, 0, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#4a463c";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 1, 11, 5.5, 0, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#2b3a44";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 1, 8, 4, 0, 0, 6.28);
        ctx.fill();
        // Posts and crossbar.
        ctx.strokeStyle = "#4a3d2c";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x - 10, s.y - 2);
        ctx.lineTo(s.x - 10, s.y - 22);
        ctx.moveTo(s.x + 10, s.y - 2);
        ctx.lineTo(s.x + 10, s.y - 22);
        ctx.moveTo(s.x - 11, s.y - 22);
        ctx.lineTo(s.x + 11, s.y - 22);
        ctx.stroke();
        // Little roof.
        this._poly(ctx, [
          { x: s.x - 14, y: s.y - 22 },
          { x: s.x, y: s.y - 32 },
          { x: s.x + 14, y: s.y - 22 },
        ], "#7a4f44");
        break;
      }
      case "bench": {
        ctx.fillStyle = "#4a3b2a";
        ctx.fillRect(s.x - 10, s.y - 5, 20, 3);
        ctx.fillRect(s.x - 10, s.y - 10, 20, 2.5);
        ctx.fillStyle = "#33291d";
        ctx.fillRect(s.x - 8, s.y - 2, 2, 5);
        ctx.fillRect(s.x + 6, s.y - 2, 2, 5);
        break;
      }
      case "crate": {
        ctx.fillStyle = "#6b4f32";
        ctx.fillRect(s.x - 6, s.y - 10, 12, 10);
        ctx.strokeStyle = "#4a3620";
        ctx.lineWidth = 1;
        ctx.strokeRect(s.x - 6, s.y - 10, 12, 10);
        ctx.beginPath();
        ctx.moveTo(s.x - 6, s.y - 10);
        ctx.lineTo(s.x + 6, s.y);
        ctx.stroke();
        break;
      }
      case "cart": {
        ctx.fillStyle = "#5c452c";
        ctx.beginPath();
        ctx.moveTo(s.x - 12, s.y - 6);
        ctx.lineTo(s.x + 12, s.y - 6);
        ctx.lineTo(s.x + 9, s.y - 1);
        ctx.lineTo(s.x - 9, s.y - 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#3d2d1c";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(s.x - 7, s.y + 1, 4, 0, 6.28);
        ctx.arc(s.x + 7, s.y + 1, 4, 0, 6.28);
        ctx.stroke();
        // Hay.
        ctx.fillStyle = "#c9a24e";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 8, 9, 4, 0, 0, 6.28);
        ctx.fill();
        break;
      }
      case "fire": {
        const flick = 0.8 + 0.2 * Math.sin(this.time * 6.7) + 0.08 * Math.sin(this.time * 11.3);
        const g = ctx.createRadialGradient(s.x, s.y - 4, 2, s.x, s.y - 4, 70 * flick);
        g.addColorStop(0, `rgba(255, 176, 92, ${0.42 * flick})`);
        g.addColorStop(1, "rgba(255, 176, 92, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 4, 70 * flick, 0, 6.28);
        ctx.fill();
        // Logs.
        ctx.strokeStyle = "#3b2c1e";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x - 8, s.y);
        ctx.lineTo(s.x + 8, s.y - 3);
        ctx.moveTo(s.x - 8, s.y - 3);
        ctx.lineTo(s.x + 8, s.y);
        ctx.stroke();
        // Flame.
        ctx.fillStyle = `rgba(255, 168, 76, ${0.9 * flick})`;
        ctx.beginPath();
        ctx.moveTo(s.x - 5, s.y - 1);
        ctx.quadraticCurveTo(s.x - 3, s.y - 12 * flick, s.x, s.y - 18 * flick);
        ctx.quadraticCurveTo(s.x + 4, s.y - 9 * flick, s.x + 5, s.y - 1);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "grave": {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + 1, 8, 3.5, 0, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = "#6f6a60";
        ctx.beginPath();
        ctx.moveTo(s.x - 5, s.y);
        ctx.lineTo(s.x - 5, s.y - 10);
        ctx.quadraticCurveTo(s.x, s.y - 16, s.x + 5, s.y - 10);
        ctx.lineTo(s.x + 5, s.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
    }
  }

  // ─────────────────────────── Members ───────────────────────────

  _drawSelection(ctx, m) {
    const p = isoToScreen(m.gx, m.gy, TILE_W, TILE_H);
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 2.6);
    ctx.save();
    ctx.strokeStyle = `rgba(232, 191, 118, ${0.4 + 0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, 16, 8, 0, 0, 6.28);
    ctx.stroke();
    ctx.strokeStyle = `rgba(232, 191, 118, ${0.16 * pulse})`;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }

  _drawMember(ctx, m, season) {
    const p = isoToScreen(m.gx, m.gy, TILE_W, TILE_H);
    const cues = m.cues;
    const bobY = m.moving ? Math.abs(Math.sin(m.bob)) * -2.4 : Math.sin(this.time * 1.6 + m.bob) * -0.7;
    const dim = m.fallen ? 0.4 : m.state === "burdened" ? 0.78 : 1;
    const isHover = m.id === this.hoverId;
    const isSel = m.id === this.selectedId;

    ctx.save();
    ctx.globalAlpha = dim;

    // Ground shadow.
    ctx.fillStyle = `rgba(0,0,0,${0.3 + cues.shadow * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, 7.5, 3.6, 0, 0, 6.28);
    ctx.fill();

    // Thriving aura.
    if (cues.glow > 0) {
      const g = ctx.createRadialGradient(p.x, p.y - 10, 2, p.x, p.y - 10, 26);
      g.addColorStop(0, `rgba(255, 226, 160, ${0.2 * cues.glow})`);
      g.addColorStop(1, "rgba(255, 226, 160, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 26, 0, 6.28);
      ctx.fill();
    }

    // Undiscovered silent struggler: a faint anxious flicker.
    if (cues.pulse && !m.known) {
      const a = 0.16 + 0.16 * Math.sin(this.time * 3.4);
      ctx.fillStyle = `rgba(226, 105, 74, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 13, 0, 6.28);
      ctx.fill();
    }

    const y = p.y + bobY;

    // Robe.
    const robeCol = m.fallen ? shade(m.robe, -0.4) : m.robe;
    ctx.fillStyle = robeCol;
    ctx.beginPath();
    ctx.moveTo(p.x - 5.4, y);
    ctx.quadraticCurveTo(p.x - 6.2, y - 9, p.x - 3.4, y - 12);
    ctx.lineTo(p.x + 3.4, y - 12);
    ctx.quadraticCurveTo(p.x + 6.2, y - 9, p.x + 5.4, y);
    ctx.closePath();
    ctx.fill();

    // Robe shading on the left.
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.moveTo(p.x - 5.4, y);
    ctx.quadraticCurveTo(p.x - 6.2, y - 9, p.x - 3.4, y - 12);
    ctx.lineTo(p.x - 0.6, y - 12);
    ctx.lineTo(p.x - 1.2, y);
    ctx.closePath();
    ctx.fill();

    // Sash in the member's accent colour.
    ctx.strokeStyle = rgba(m.accent, m.fallen ? 0.3 : 0.85);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x - 4.4, y - 7.5);
    ctx.lineTo(p.x + 4.4, y - 8.6);
    ctx.stroke();

    // Head.
    ctx.fillStyle = m.skin;
    ctx.beginPath();
    ctx.arc(p.x, y - 15.4, 3.9, 0, 6.28);
    ctx.fill();
    // Hair.
    ctx.fillStyle = m.hair;
    ctx.beginPath();
    ctx.arc(p.x, y - 16.4, 4.0, Math.PI * 1.02, Math.PI * 2.02);
    ctx.fill();

    // Walking arms swing.
    if (m.moving) {
      ctx.strokeStyle = m.skin;
      ctx.lineWidth = 1.5;
      const swing = Math.sin(m.bob) * 1.8;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, y - 9);
      ctx.lineTo(p.x - 5.4 - swing, y - 5);
      ctx.moveTo(p.x + 4, y - 9);
      ctx.lineTo(p.x + 5.4 + swing, y - 5);
      ctx.stroke();
    }

    // Burden icon carried overhead.
    if (cues.heavyIcon) {
      const lift = 6 + Math.sin(this.time * 2 + m.bob) * 1.4;
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = dim * 0.92;
      ctx.fillText(cues.heavyIcon, p.x, y - 24 - lift);
      ctx.globalAlpha = dim;
    }

    // Hover / selection halo ring at the feet.
    if (isHover || isSel) {
      ctx.strokeStyle = isSel ? "rgba(232,191,118,0.9)" : "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 1, 10, 4.8, 0, 0, 6.28);
      ctx.stroke();
    }

    // Care glow burst after an action.
    if (m.careGlow > 0) {
      const r = 10 + (1 - m.careGlow) * 40;
      ctx.strokeStyle = `rgba(255, 228, 168, ${m.careGlow * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 6, r, r * 0.55, 0, 0, 6.28);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawMemberLabel(ctx, m, season) {
    const iso = isoToScreen(m.gx, m.gy, TILE_W, TILE_H);
    const p = this.world.worldToScreen(iso.x, iso.y);
    const showName = this.hoverId === m.id || this.selectedId === m.id || m.careGlow > 0.1;
    if (!showName) return;

    const y = p.y - 34 * this.world.camera.zoom;
    ctx.save();
    ctx.font = "600 10.5px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = m.name;
    const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = "rgba(10, 14, 24, 0.86)";
    this._roundRect(ctx, p.x - w / 2, y - 8, w, 16, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(232, 191, 118, 0.28)";
    ctx.lineWidth = 1;
    this._roundRect(ctx, p.x - w / 2, y - 8, w, 16, 6);
    ctx.stroke();
    ctx.fillStyle = m.fallen ? "#d76a86" : "#f4ecd9";
    ctx.fillText(text, p.x, y);
    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ─────────────────────────── Threats ───────────────────────────

  threatWorldPos(t) {
    const centre = isoToScreen(GRID / 2, GRID / 2, TILE_W, TILE_H);
    const radius = 70 + t.distance * 7.2;
    const x = centre.x + Math.cos(t.angle) * radius;
    const y = centre.y + Math.sin(t.angle) * radius * 0.62;
    return { x, y, depth: GRID + 2 + (1 - t.distance / 100) * 4 };
  }

  _drawThreat(ctx, t, pos) {
    const visible = t.isVisible(this._alertness ?? 0) || t.spotted;
    const alpha = t.warned ? 1 - t.fade : visible ? 0.95 : 0.22;
    if (alpha <= 0.02) return;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    const pulse = 0.75 + 0.25 * Math.sin(t.pulse);
    // Dark fog.
    const g = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, 54 * pulse);
    g.addColorStop(0, rgba(t.def.colour, 0.4));
    g.addColorStop(0.5, rgba(t.def.colour, 0.14));
    g.addColorStop(1, rgba(t.def.colour, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 54 * pulse, 0, 6.28);
    ctx.fill();

    // Cloaked silhouette.
    const sway = Math.sin(t.age * 1.4 + t.pulse) * 3;
    ctx.fillStyle = t.warned ? "rgba(140, 200, 170, 0.55)" : "rgba(20, 14, 20, 0.82)";
    ctx.beginPath();
    ctx.moveTo(pos.x - 12 + sway, pos.y + 6);
    ctx.quadraticCurveTo(pos.x - 10 + sway, pos.y - 22, pos.x + sway, pos.y - 30);
    ctx.quadraticCurveTo(pos.x + 10 + sway, pos.y - 22, pos.x + 12 + sway, pos.y + 6);
    ctx.closePath();
    ctx.fill();

    ctx.font = "15px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.def.icon, pos.x + sway, pos.y - 15);

    ctx.restore();
  }

  _drawThreatBadge(ctx, t, pos) {
    const s = this.world.worldToScreen(pos.x, pos.y);
    if (s.x < 90 || s.x > this.w - 90 || s.y < 80 || s.y > this.h - 60) return;
    const y = s.y - 40 * this.world.camera.zoom;
    ctx.save();
    ctx.font = "600 9.5px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    const label = t.warned ? "warned — turning back" : t.name;
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = t.warned ? "rgba(20, 44, 34, 0.9)" : "rgba(48, 18, 14, 0.9)";
    this._roundRect(ctx, s.x - w / 2, y - 7, w, 14, 5);
    ctx.fill();
    ctx.strokeStyle = t.warned ? "rgba(134,193,160,0.5)" : rgba(t.def.colour, 0.6);
    ctx.lineWidth = 1;
    this._roundRect(ctx, s.x - w / 2, y - 7, w, 14, 5);
    ctx.stroke();
    ctx.fillStyle = t.warned ? "#a8e0c4" : "#f4c9b8";
    ctx.fillText(label, s.x, y + 0.5);
    ctx.restore();
  }

  /** Arrows at the screen edge pointing to off-screen threats. */
  _drawEdgeArrows(ctx, state) {
    ctx.save();
    for (const t of state.threats) {
      if (t.defeated || t.warned || !t.isVisible(state.alertness)) continue;
      const pos = this.threatWorldPos(t);
      const s = this.world.worldToScreen(pos.x, pos.y);
      const pad = 46;
      const inside = s.x > pad && s.x < this.w - pad && s.y > 70 && s.y < this.h - pad;
      if (inside) continue;

      const cx = this.w / 2;
      const cy = this.h / 2;
      const dx = s.x - cx;
      const dy = s.y - cy;
      const angle = Math.atan2(dy, dx);
      const rx = (this.w / 2 - pad) / Math.abs(Math.cos(angle) || 1e-6);
      const ry = (this.h / 2 - pad) / Math.abs(Math.sin(angle) || 1e-6);
      const r = Math.min(rx, ry);
      const ex = cx + Math.cos(angle) * r;
      const ey = cy + Math.sin(angle) * r;

      const pulse = 0.6 + 0.4 * Math.sin(this.time * 3 + t.pulse);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      ctx.fillStyle = rgba(t.def.colour, 0.55 + 0.35 * pulse);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -7);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(t.def.colour, 0.9);
      ctx.fillText(t.def.icon, ex - Math.cos(angle) * 20, ey - Math.sin(angle) * 20);
    }
    ctx.restore();
  }

  // ─────────────────────────── Popups & tooltips ───────────────────────────

  _drawPopup(ctx, p) {
    const s = this.world.worldToScreen(p.wx, p.wy);
    const t = clamp(p.age / p.life, 0, 1);
    const rise = 46 * t;
    const alpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.colour;
    ctx.fillText(p.text, s.x, s.y - 26 - rise);
    if (p.sub) {
      ctx.font = "500 10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(244, 236, 217, 0.72)";
      ctx.fillText(p.sub, s.x, s.y - 14 - rise);
    }
    ctx.restore();
  }

  _drawHoverTip(ctx, state) {
    if (!state.hoverMember) return;
    const m = state.hoverMember;
    const iso = isoToScreen(m.gx, m.gy, TILE_W, TILE_H);
    const p = this.world.worldToScreen(iso.x, iso.y);
    if (state.selectedId === m.id) return;
    ctx.save();
    ctx.font = "500 10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    const stateText = m.fallen ? "fallen away" : m.state;
    const label = `${m.name} · ${stateText}`;
    const w = ctx.measureText(label).width + 16;
    const y = p.y - 44 * this.world.camera.zoom;
    ctx.fillStyle = "rgba(10, 14, 24, 0.9)";
    this._roundRect(ctx, p.x - w / 2, y - 9, w, 18, 7);
    ctx.fill();
    ctx.fillStyle = "#e8dcc2";
    ctx.fillText(label, p.x, y + 0.5);
    ctx.restore();
  }

  setAlertness(v) {
    this._alertness = v;
  }
}
