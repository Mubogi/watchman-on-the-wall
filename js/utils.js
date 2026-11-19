/** Small helpers shared across the game. */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Pick from a weighted array of [item, weight] pairs. */
export function weightedPick(pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let roll = Math.random() * total;
  for (const [item, w] of pairs) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return pairs[pairs.length - 1][0];
}

/** Remove an item, returning a new array. */
export const without = (arr, item) => arr.filter((x) => x !== item);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic-ish smooth noise for organic motion, no dependencies. */
export function wobble(t, seed = 0) {
  return Math.sin(t * 0.9 + seed * 1.7) * 0.5 + Math.sin(t * 1.7 + seed * 3.1) * 0.3;
}

/** Ease-out cubic. */
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Colour helpers. */
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = (x, y) => Math.round(lerp(x, y, t)).toString(16).padStart(2, "0");
  return `#${c(A.r, B.r)}${c(A.g, B.g)}${c(A.b, B.b)}`;
}

export function shade(hex, amount) {
  return amount >= 0 ? mixHex(hex, "#ffffff", amount) : mixHex(hex, "#000000", -amount);
}

/** Isometric grid → screen. */
export function isoToScreen(gx, gy, tw, th) {
  return { x: (gx - gy) * (tw / 2), y: (gx + gy) * (th / 2) };
}

/** Screen → isometric grid (fractional). */
export function screenToIso(x, y, tw, th) {
  return {
    gx: (y / (th / 2) + x / (tw / 2)) / 2,
    gy: (y / (th / 2) - x / (tw / 2)) / 2,
  };
}

/** Format a season/week stamp like "Spring · W3". */
export function stamp(seasonName, week) {
  return `${seasonName} · W${week}`;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
