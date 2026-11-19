/**
 * Procedural audio. No asset files — everything is synthesised so the game
 * runs from a bare file server. Sounds are deliberately soft: bell tones,
 * a low drone for the wall, and a muted thud for burdens falling.
 */

let ctx = null;
let master = null;
let droneNodes = null;
let enabled = true;
let started = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export function isEnabled() {
  return enabled;
}

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.15);
  if (on) resume();
}

export function resume() {
  if (ctx && ctx.state === "suspended") ctx.resume();
}

/** Start the ambient drone. Safe to call repeatedly. */
export function startAmbience() {
  if (started) return;
  const c = ensureCtx();
  if (!c) return;
  started = true;
  resume();

  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(master);
  bus.gain.setTargetAtTime(0.5, c.currentTime, 3);

  // Two detuned low sines plus filtered noise: a night wind under a stone wall.
  const oscs = [55, 82.5].map((freq, i) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = i === 0 ? 0.16 : 0.07;
    o.connect(g).connect(bus);
    o.start();
    return { o, g };
  });

  const noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 340;
  const ng = c.createGain();
  ng.gain.value = 0.05;
  noise.connect(lp).connect(ng).connect(bus);
  noise.start();

  // Slow breathing LFO on the wind so it never feels static.
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.055;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.028;
  lfo.connect(lfoGain).connect(ng.gain);
  lfo.start();

  droneNodes = { bus, oscs, noise, lfo };
}

function tone({ freq = 440, dur = 0.9, type = "sine", gain = 0.2, delay = 0, detune = 0, glide = 0 }) {
  if (!enabled) return;
  const c = ensureCtx();
  if (!c) return;
  resume();
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * glide), t0 + dur);
  if (detune) o.detune.value = detune;

  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  const bp = c.createBiquadFilter();
  bp.type = "lowpass";
  bp.frequency.value = 2600;

  o.connect(g).connect(bp).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const NAMES = {
  click: () => tone({ freq: 660, dur: 0.1, type: "triangle", gain: 0.09 }),
  select: () => {
    tone({ freq: 523.25, dur: 0.5, gain: 0.1 });
    tone({ freq: 783.99, dur: 0.55, gain: 0.055, delay: 0.05 });
  },
  care: () => {
    tone({ freq: 587.33, dur: 0.75, gain: 0.11 });
    tone({ freq: 880, dur: 0.8, gain: 0.07, delay: 0.07 });
    tone({ freq: 1174.66, dur: 0.7, gain: 0.04, delay: 0.14 });
  },
  restore: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, dur: 1.4, gain: 0.085 - i * 0.012, delay: i * 0.11 })
    );
  },
  watch: () => {
    tone({ freq: 196, dur: 1.6, type: "sine", gain: 0.1 });
    tone({ freq: 293.66, dur: 1.4, type: "sine", gain: 0.05, delay: 0.2 });
  },
  threat: () => {
    tone({ freq: 146.83, dur: 1.5, type: "sawtooth", gain: 0.055, glide: 0.94 });
    tone({ freq: 110, dur: 1.9, type: "sine", gain: 0.075, glide: 0.9 });
  },
  warn: () => {
    tone({ freq: 392, dur: 1.1, type: "triangle", gain: 0.1 });
    tone({ freq: 587.33, dur: 1.2, type: "triangle", gain: 0.07, delay: 0.14 });
  },
  fall: () => {
    tone({ freq: 220, dur: 2.0, type: "sine", gain: 0.11, glide: 0.5 });
    tone({ freq: 164.81, dur: 2.2, type: "triangle", gain: 0.05, glide: 0.55 });
  },
  season: () => {
    [392, 523.25, 659.25, 783.99].forEach((f, i) =>
      tone({ freq: f, dur: 2.0, gain: 0.075, delay: i * 0.16 })
    );
  },
  error: () => tone({ freq: 174.61, dur: 0.28, type: "square", gain: 0.05 }),
};

export function play(name) {
  if (!enabled) return;
  const fn = NAMES[name];
  if (fn) fn();
}

/** Duck the ambience a little when a modal is open. */
export function setAmbienceLevel(level) {
  if (!droneNodes || !ctx) return;
  droneNodes.bus.gain.setTargetAtTime(level, ctx.currentTime, 0.6);
}
