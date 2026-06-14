// The curtains coalgebra in JS — the same math the shader runs, for the CPU
// fallback (cpu.js). Pure: (Coord, time) -> Colour.

export const hash = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// HSL -> RGB, all channels in [0,1].
export const hslRGB = (h, s, l) => {
  const ch = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [ch(0), ch(8), ch(4)];
};

// curtains : Store Coord _ -> Colour   (evaluated at one position `uv`)
export function curtainAt(uv, T, opts, hueC, hueA) {
  const N = opts.curtains;
  const col = [opts._floor[0], opts._floor[1], opts._floor[2]];
  for (let i = 0; i < N; i++) {
    const fi = i / (N - 1), d = hash(i + 0.3);
    const bx = -0.05 + 1.10 * fi + 0.05 * (hash(i * 1.7) - 0.5);
    const am = (0.028 + 0.03 * hash(i * 2.3)) * (0.6 + 0.4 * Math.sin(T * 0.5 + fi * 3));
    const fr = (0.35 + 0.5 * hash(i * 0.7)) * 6.2831853, ph = T * 0.6 + hash(i * 3.1) * 6.2831853;
    const r = (0.0112 + 0.0308 * d) * opts.thickness;
    const cx = bx + am * Math.sin(uv[1] * fr + ph) + am * 0.22 * Math.sin(uv[1] * fr * 1.7 - T * 0.7 + fi * 3.1);
    const gauss = Math.exp(-(uv[0] - cx) * (uv[0] - cx) / (2 * r * r));
    const fold = 0.5 + 0.5 * Math.sin(uv[1] * 7 - T * 1.3 + fi * 4);
    const a = (0.11 + 0.17 * d) * (0.3 + 0.7 * fold * fold) * gauss * opts.brightness;
    const rgb = hslRGB((hueC + hueA * Math.sin(T * 0.35 + fi * 2 + uv[1] * 2.5)) / 360, 0.9, 0.6);
    col[0] += rgb[0] * a; col[1] += rgb[1] * a; col[2] += rgb[2] * a;
  }
  return col;
}
