// CPU fallback — the very same comonad, spelled out with `Store`, rendered at
// low resolution to a Canvas-2D image. Used only when WebGL is unavailable.

import { Store, extract, extend, seek } from './store.js';
import { curtainAt } from './curtains.js';

export function runCPU(canvas, opts, env) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let W, H, img;
  const resize = () => { W = canvas.width = Math.max(1, innerWidth >> 2); H = canvas.height = Math.max(1, innerHeight >> 2); img = ctx.createImageData(W, H); };
  resize();
  addEventListener('resize', resize);

  let last = 0, raf = 0, stopped = false;
  const frame = (now) => {
    if (!env.reduced && !stopped) raf = requestAnimationFrame(frame);
    if (now - last < 1000 / opts.fps) return;
    last = now;
    const T = now * 0.0004 * opts.speed;
    const [hc, ha] = env.hue(opts.hue);

    // picture = extract . extend blur . extend curtains $ positions
    const lit = extend((w) => curtainAt(w.pos, T, opts, hc, ha), Store((p) => p, [0, 0]));
    const ex = 1 / W, ey = 1 / H;
    const field = opts.blur > 0 ? extend((w) => {           // extend blur : average the 3x3 neighbourhood
      const s = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = extract(seek([w.pos[0] + dx * ex, w.pos[1] + dy * ey], w));   // peeks a neighbour
        s[0] += n[0]; s[1] += n[1]; s[2] += n[2];
      }
      return [s[0] / 9, s[1] / 9, s[2] / 9];
    }, lit) : lit;

    let k = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const col = extract(seek([x / W, y / H], field));     // focus the pixel, read its colour
      img.data[k++] = Math.min(255, col[0] * 255);
      img.data[k++] = Math.min(255, col[1] * 255);
      img.data[k++] = Math.min(255, col[2] * 255);
      img.data[k++] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  raf = requestAnimationFrame(frame);

  return () => { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); };
}
