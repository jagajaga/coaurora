// coaurora — a WebGL aurora background that is, internally, a Store comonad.
//   https://github.com/jagajaga/coaurora
//
//   import { aurora } from 'coaurora'
//   const bg = aurora()                       // full-page green aurora
//   bg.set({ speed: 0.8 })                    // live-tweak
//   bg.stop()                                 // tear down

import { runGL } from './gl.js';
import { runCPU } from './cpu.js';

export const DEFAULTS = {
  curtains: 16,            // number of curtain bands (changing this restarts)
  hue: [85, 165],          // colour band [low, high] in degrees — default green -> teal
  thickness: 0.6,          // curtain width
  speed: 1,                // animation speed multiplier
  blur: 1.5,               // comonadic 3x3 neighbourhood radius, in texels (0 = off)
  tilt: 22,                // degrees clockwise
  floor: '#030503',        // lifted black floor (hex or [r,g,b] in 0..1)
  dither: true,            // TPDF blue-noise temporal dithering (kills banding)
  fps: 30,                 // frame cap
  resolutionCap: 4.2e6,    // max rendered pixels (protects the GPU)
  reducedMotion: 'auto',   // 'auto' | 'reduce' | 'no-preference'
  saturate: 1,             // CSS saturation boost on the canvas
  zIndex: -1,
  opacity: 1,
};

export const presets = {
  jagajaga: { hue: [85, 165],  tilt: 22,  thickness: 0.6, floor: '#030503', saturate: 1.35 }, // the green λ:j look
  ice:      { hue: [180, 225], tilt: -14, thickness: 0.7, floor: '#03060a' },
  ember:    { hue: [18, 52],   tilt: 18,  thickness: 0.8, floor: '#0a0402' },
  violet:   { hue: [250, 300], tilt: 30,  thickness: 0.5, floor: '#060309' },
};

const toRGB = (c) => {
  if (Array.isArray(c)) return c;
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
};
const hueCA = ([lo, hi]) => [(lo + hi) / 2, (hi - lo) / 2];
const oversizeFor = (tilt) => {
  const r = tilt * Math.PI / 180;
  return (Math.abs(Math.cos(r)) + Math.abs(Math.sin(r)) * Math.max(innerWidth / innerHeight, innerHeight / innerWidth)) * 1.06;
};

export function aurora(target, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  opts._floor = toRGB(opts.floor);

  const host = (typeof target === 'string' ? document.querySelector(target) : target) || document.body;
  const canvas = document.createElement('canvas');
  const fx = () => { canvas.style.filter = opts.saturate !== 1 ? `saturate(${opts.saturate})` : ''; };
  Object.assign(canvas.style, { position: 'fixed', zIndex: String(opts.zIndex), opacity: String(opts.opacity), pointerEvents: 'none' });
  fx();

  const place = () => {                                   // size + tilt the layer to fully cover after rotation
    const over = oversizeFor(opts.tilt), pct = over * 100, off = -(over - 1) * 50;
    Object.assign(canvas.style, { left: off + '%', top: off + '%', right: 'auto', bottom: 'auto', width: pct + '%', height: pct + '%', transform: `rotate(${opts.tilt}deg)` });
  };
  place();
  host.appendChild(canvas);
  addEventListener('resize', place);

  const env = {
    reduced: opts.reducedMotion === 'reduce' || (opts.reducedMotion === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches),
    oversize: () => oversizeFor(opts.tilt),
    hue: hueCA,
  };

  const stop = runGL(canvas, opts, env) || runCPU(canvas, opts, env);

  return {
    set(patch) { Object.assign(opts, patch); if (patch.floor) opts._floor = toRGB(opts.floor); place(); fx(); },
    stop() { if (stop) stop(); removeEventListener('resize', place); canvas.remove(); },
    canvas,
  };
}

export default aurora;
