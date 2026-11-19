/**
 * The village: tile map, buildings, paths, props, and the camera.
 * Pure data + geometry — no drawing here (see renderer.js).
 */

import { GRID, TILE_W, TILE_H, SEASONS } from "./config.js";
import { isoToScreen, rand, clamp, hashString } from "./utils.js";

export const TILE = { GRASS: 0, PATH: 1, PLAZA: 2, WATER: 3, FIELD: 4 };

/** Buildings occupy a w×h footprint in grid cells. */
export const BUILDINGS = [
  {
    id: "tower",
    name: "Watchtower & Prayer Room",
    gx: 8, gy: 8, w: 2, h: 2,
    kind: "tower",
    storeys: 3,
    wall: "#6d6355", roof: "#8a4b3c", trim: "#e8bf76",
    blurb: "The upper room. Oil is kept here and the wall is watched from here.",
  },
  {
    id: "meeting",
    name: "Fellowship House",
    gx: 4, gy: 5, w: 3, h: 2,
    kind: "hall",
    wall: "#8a7a62", roof: "#5c6b7d", trim: "#d9c9a8",
    blurb: "Where the congregation gathers. Chairs still out from Sunday.",
  },
  {
    id: "home-a",
    name: "Ruth's House",
    gx: 11, gy: 4, w: 2, h: 2,
    kind: "house",
    wall: "#9b8467", roof: "#7a4f44", trim: "#d9c9a8",
    blurb: "Always a pot on the stove. Always room for one more.",
  },
  {
    id: "home-b",
    name: "Caleb's House",
    gx: 12, gy: 10, w: 2, h: 2,
    kind: "house",
    wall: "#8f7c63", roof: "#4f6070", trim: "#d9c9a8",
    blurb: "Toys on the step, a broken gate, a light on late.",
  },
  {
    id: "home-c",
    name: "Jonas's Room",
    gx: 4, gy: 11, w: 2, h: 2,
    kind: "house",
    wall: "#7d7365", roof: "#5a4a5f", trim: "#c8bda8",
    blurb: "A rented room above a workshop. Curtains never quite open.",
  },
  {
    id: "market",
    name: "Market",
    gx: 12, gy: 6, w: 2, h: 1,
    kind: "market",
    wall: "#8a6f4e", roof: "#a8613f", trim: "#e8bf76",
    blurb: "Bread, gossip, and the occasional confident stranger.",
  },
];

export const PROPS = [
  { kind: "well", gx: 7.4, gy: 10.6 },
  { kind: "tree", gx: 2.4, gy: 3.2, s: 1.1 },
  { kind: "tree", gx: 3.1, gy: 13.8, s: 0.95 },
  { kind: "tree", gx: 14.2, gy: 3.0, s: 1.05 },
  { kind: "tree", gx: 15.0, gy: 13.4, s: 1.15 },
  { kind: "tree", gx: 1.4, gy: 8.6, s: 0.9 },
  { kind: "tree", gx: 15.4, gy: 8.0, s: 0.85 },
  { kind: "lamp", gx: 6.6, gy: 6.6 },
  { kind: "lamp", gx: 10.2, gy: 9.6 },
  { kind: "lamp", gx: 9.4, gy: 5.2 },
  { kind: "lamp", gx: 5.4, gy: 9.8 },
  { kind: "bench", gx: 9.6, gy: 11.4 },
  { kind: "bench", gx: 6.2, gy: 4.4 },
  { kind: "crate", gx: 13.6, gy: 7.4 },
  { kind: "crate", gx: 13.2, gy: 7.9 },
  { kind: "cart", gx: 11.4, gy: 7.2 },
  { kind: "fire", gx: 8.4, gy: 12.4 },
  { kind: "grave", gx: 2.0, gy: 11.4 },
  { kind: "grave", gx: 2.7, gy: 12.1 },
  { kind: "grave", gx: 2.0, gy: 12.8 },
];

/** Roads are drawn as polylines of grid points, widened into walkable tiles. */
const ROADS = [
  [[0, 8.5], [6, 8.5], [8.5, 8.5], [12, 8.5], [17, 8.5]],
  [[8.5, 0], [8.5, 6.5], [8.5, 8.5], [8.5, 12], [8.5, 17]],
  [[5.5, 8.5], [5.5, 6], [5.5, 4.6]],
  [[11.5, 8.5], [11.5, 6.6]],
  [[8.5, 11.5], [6, 11.5], [5, 12]],
  [[8.5, 11.5], [11.5, 11.5], [13, 11]],
];

export class World {
  constructor(seasonIndex = 0) {
    this.seasonIndex = seasonIndex;
    this.tiles = new Uint8Array(GRID * GRID);
    this.buildings = BUILDINGS.map((b) => ({ ...b }));
    this.props = PROPS.map((p) => ({ ...p }));
    this.camera = { x: 0, y: 0, zoom: 1, targetZoom: 1 };
    this.viewW = 0;
    this.viewH = 0;
    this.time = 0;
    this._buildTiles();
    this._scatterGrass();
    this.buildingAt = this._indexBuildings();
    this.pathPoints = this._collectWalkables();
  }

  get season() {
    return SEASONS[this.seasonIndex % SEASONS.length];
  }

  _buildTiles() {
    // Base grass with gentle noise so the ground is not flat colour.
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const n = hashString(`${x},${y}`);
        this.tiles[y * GRID + x] = n > 0.9 ? TILE.FIELD : TILE.GRASS;
      }
    }

    // Paint roads with a soft half-tile radius.
    for (const road of ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const [ax, ay] = road[i];
        const [bx, by] = road[i + 1];
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const px = ax + (bx - ax) * t;
          const py = ay + (by - ay) * t;
          this._paintDisc(px, py, 0.75, TILE.PATH);
        }
      }
    }

    // Plaza in front of the tower.
    this._paintDisc(8.5, 8.5, 2.3, TILE.PLAZA);

    // A stream at the far edge, purely scenic.
    for (let y = 0; y < GRID; y++) {
      const x = 0.4 + Math.sin(y * 0.7) * 0.5;
      this._paintDisc(x, y, 0.55, TILE.WATER);
    }

    // Clear ground under buildings.
    for (const b of this.buildings) {
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          this._set(Math.floor(b.gx) + x, Math.floor(b.gy) + y, TILE.PLAZA);
        }
      }
    }
  }

  _paintDisc(cx, cy, radius, type) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= radius) this._set(x, y, type);
      }
    }
  }

  _set(x, y, type) {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    this.tiles[y * GRID + x] = type;
  }

  tileAt(gx, gy) {
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return TILE.WATER;
    return this.tiles[y * GRID + x];
  }

  isWalkable(gx, gy) {
    const t = this.tileAt(gx, gy);
    return t !== TILE.WATER && !this.buildingAt(Math.floor(gx), Math.floor(gy));
  }

  _indexBuildings() {
    const map = new Map();
    for (const b of this.buildings) {
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          map.set(`${Math.floor(b.gx) + x},${Math.floor(b.gy) + y}`, b);
        }
      }
    }
    return (x, y) => map.get(`${x},${y}`) || null;
  }

  _scatterGrass() {
    this.grassTufts = [];
    for (let i = 0; i < 260; i++) {
      const gx = rand(0.2, GRID - 0.2);
      const gy = rand(0.2, GRID - 0.2);
      if (this.tileAt(gx, gy) !== TILE.GRASS) continue;
      this.grassTufts.push({ gx, gy, s: rand(0.5, 1.2), phase: rand(0, 6.28) });
    }
  }

  /** Random walkable points, weighted toward paths. */
  _collectWalkables() {
    const pts = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const t = this.tiles[y * GRID + x];
        if (t === TILE.WATER) continue;
        if (this.buildingAt(x, y)) continue;
        const w = t === TILE.PATH || t === TILE.PLAZA ? 3 : 1;
        for (let i = 0; i < w; i++) pts.push({ gx: x + 0.5, gy: y + 0.5 });
      }
    }
    return pts;
  }

  randomPoint() {
    return this.pathPoints[Math.floor(Math.random() * this.pathPoints.length)];
  }

  /** Walkable point near a grid position, for members attached to homes. */
  pointNear(gx, gy, radius = 1.6) {
    const near = this.pathPoints.filter(
      (p) => Math.hypot(p.gx - gx, p.gy - gy) < radius
    );
    if (near.length) return near[Math.floor(Math.random() * near.length)];
    return this.randomPoint();
  }

  /** Grid-space centre of a building's front door. */
  doorOf(building) {
    return { gx: building.gx + building.w / 2, gy: building.gy + building.h + 0.35 };
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  /** Centre the camera on the tower, scaled to fit between the side panels. */
  focusCentre() {
    const c = isoToScreen(GRID / 2, GRID / 2, TILE_W, TILE_H);
    this.camera.x = c.x;
    this.camera.y = c.y;
    if (this.viewW && this.viewH) {
      const panelGutter = this.viewW > 1060 ? 660 : 80;
      const availW = Math.max(360, this.viewW - panelGutter);
      const availH = Math.max(300, this.viewH - 170);
      const fit = Math.min(availW / (GRID * TILE_W), availH / (GRID * TILE_H));
      this.camera.zoom = this.camera.targetZoom = clamp(fit, 0.62, 1.25);
    }
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + this.viewW / 2,
      y: (wy - this.camera.y) * this.camera.zoom + this.viewH / 2,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.viewH / 2) / this.camera.zoom + this.camera.y,
    };
  }

  /** Grid cell under a screen point. */
  pickCell(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    const gx = (w.y / (TILE_H / 2) + w.x / (TILE_W / 2)) / 2;
    const gy = (w.y / (TILE_H / 2) - w.x / (TILE_W / 2)) / 2;
    return { gx, gy };
  }

  clampCamera() {
    const pad = 4;
    const min = isoToScreen(-pad, GRID + pad, TILE_W, TILE_H);
    const max = isoToScreen(GRID + pad, -pad, TILE_W, TILE_H);
    this.camera.x = clamp(this.camera.x, min.x, max.x);
    this.camera.y = clamp(this.camera.y, min.y, max.y);
  }

  pan(dx, dy) {
    this.userMoved = true;
    this.camera.x -= dx / this.camera.zoom;
    this.camera.y -= dy / this.camera.zoom;
    this.clampCamera();
  }

  zoomBy(delta, sx, sy) {
    this.userMoved = true;
    const before = this.screenToWorld(sx, sy);
    this.camera.targetZoom = clamp(this.camera.targetZoom * (1 - delta * 0.0016), 0.62, 1.9);
    this.camera.zoom = this.camera.targetZoom;
    const after = this.screenToWorld(sx, sy);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this.clampCamera();
  }

  update(dt) {
    this.time += dt;
    const z = this.camera.zoom + (this.camera.targetZoom - this.camera.zoom) * Math.min(1, dt * 8);
    this.camera.zoom = z;
  }

  /** Depth key for painter's-algorithm sorting. */
  static depth(gx, gy) {
    return gx + gy;
  }
}
