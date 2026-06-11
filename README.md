<div align="center">

# coaurora

**A WebGL aurora background that is, internally, a Store comonad.**

Zero dependencies · ~6 KB · WebGL2 two-pass renderer with a Canvas-2D fallback · band-free on any display.

[**Live demo →**](https://jagajaga.me/coaurora/)

</div>

---

## Install

```bash
npm i coaurora
```

```js
import { aurora } from 'coaurora';

const bg = aurora();              // full-page green aurora behind your content
bg.set({ speed: 0.8, tilt: 30 }); // live-tweak
bg.stop();                        // tear down
```

Or straight from a CDN, no build step:

```html
<script type="module">
  import { aurora } from 'https://esm.sh/coaurora';
  aurora();
</script>
```

## Options

```js
aurora('#bg', {
  curtains: 16,          // number of curtain bands
  hue:      [85, 165],   // colour band [low, high] in degrees — green → teal
  thickness:0.6,
  speed:    1,
  blur:     1.5,         // the comonadic 3×3 neighbourhood radius (0 = off)
  tilt:     22,          // degrees
  floor:    '#030503',   // lifted black floor
  dither:   true,        // TPDF blue-noise temporal dithering (kills banding)
  fps:      30,
  reducedMotion: 'auto',
});
```

Presets: `aurora('#bg', { ...presets.ice })` — `jagajaga` (green), `ice`, `ember`, `violet`.

---

## The background is a comonad

A **`Store s a`** is a pair: a function `peek : s → a` and a focused position `pos : s` — *a value of type `a` living in a space `s`, with one position singled out*. Here `s = Coord` (a pixel) and `a = Colour`, so the aurora is a `Store Coord Colour`: the whole green field, plus the pixel we're looking at.

```
extract w    = w.peek(w.pos)                      -- the colour under the focus
extend  f w  = Store(p => f(seek(p, w)), w.pos)   -- recompute the WHOLE field,
                                                     each point free to consult
                                                     its neighbourhood
seek  p w    = Store(w.peek, p)                    -- move the focus
```

`extend` is the dual of monadic `bind`: instead of *sequencing* effects it *spreads* a local computation across every position. The whole picture is a pipeline of `extend`s, read off at each pixel:

```
picture = extract . extend dither . extend blur . extend curtains $ positions
```

1. `extend curtains` — light the 16 Gaussian curtain bands at every position.
2. `extend blur` — average each point's **3×3 neighbourhood** (`peeks`). This is the canonical comonadic op — genuine neighbourhood work, not just `fmap`.
3. `extend dither` — add blue-noise (below).
4. `extract` — read the colour out at each pixel.

### A fragment shader *is* this comonad

| comonad | GLSL |
|---|---|
| `peek` | the shader body |
| focus | `gl_FragCoord` |
| `extract` | evaluating one fragment |
| `extend f` | the GPU dispatching `f` over **all** fragments |

So the GPU renderer is the comonad, compiled — as a **two-pass pipeline**:

- **pass 1** renders `extend curtains` into an off-screen **texture** — the `Store`, *materialised*;
- **pass 2** is `extract . extend dither . extend blur`, where the **texture sampler is `peek`**, a **neighbour tap is `peeks`**, and the **3×3 average is `extend`**.

The `src/cpu.js` fallback spells the same thing out in plain JS with `Store` / `extract` / `extend` / `seek`. Read [`src/store.js`](src/store.js) and [`src/shaders.js`](src/shaders.js).

---

## Why it never bands

Smooth dark gradients band on 8-bit displays. coaurora fixes it the way signal theory says to:

- **TPDF dither, 2 LSB.** Triangular-PDF noise (two summed uniforms) makes the quantization error's *mean and variance* independent of the signal — the formal condition for no contouring.
- **Applied last,** right before the 8-bit write (no blur after it to average it away).
- **Blue noise** (interleaved-gradient), so the residual noise sits above the eye's sensitivity peak — invisible grain.
- **Temporal:** the pattern shifts each frame by a golden-ratio offset; your eye integrates ~3–4 frames toward the true value → ~1–2 extra effective bits.

---

## Notes

- The canvas sits at `z-index:-1`, so keep your page's backdrop on `html` (or leave `body` transparent) — an opaque `body` background would paint over it.
- Honours `prefers-reduced-motion` (renders one static frame).
- Render resolution tracks device pixels, capped at `resolutionCap` to keep the GPU honest.
- The curtains are analytic, so the GPU path is one curtain evaluation per pixel plus a cheap blur pass.

## License

MIT © [Arseniy Seroka (jagajaga)](https://jagajaga.me)
