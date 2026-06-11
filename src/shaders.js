// The GLSL is the Store comonad, compiled.
//
//   gl_FragCoord is the focus; a fragment shader is `peek : Coord -> Colour`;
//   running it per-fragment is `extend`; reading one fragment is `extract`.
//
// The renderer (gl.js) runs this as a two-pass pipeline:
//
//   pass 1  FS_CURTAINS  ── `extend curtains` -> an off-screen texture (the Store, materialised)
//   pass 2  FS_COMPOSE   ── extract . extend dither . extend blur   (samples that texture)
//
// The texture between passes IS the comonad's carrier; the sampler is `peek`,
// a neighbour tap is `peeks`, and the 3x3 average is `extend (avg . neighbourhood)`.

export const VERTEX = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// Pass 1 ── `extend curtains` : positions -> Colour field.
// `count` is template-substituted because GLSL ES loop bounds must be constant.
export const fsCurtains = (count) => `
precision highp float;
uniform vec2  uRes;
uniform float uT;
uniform vec3  uFloor;            // lifted black floor (no dark-end cliff)
uniform float uHueC, uHueA;      // hue centre & amplitude (the colour band)
uniform float uThick;            // curtain thickness

float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
vec3 hsl(float h, float s, float l) {
  vec3 r = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (r - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

// coalgebra ── curtains : Store Coord _ -> Colour
vec3 curtains(vec2 uv, float T) {
  vec3 col = uFloor;
  for (int i = 0; i < ${count}; i++) {
    float fi = float(i) / ${(count - 1).toFixed(1)};
    float d  = hash(float(i) + 0.3);                     // this curtain's depth
    float bx = -0.05 + 1.10 * fi + 0.05 * (hash(float(i) * 1.7) - 0.5);
    float am = (0.028 + 0.03 * hash(float(i) * 2.3)) * (0.6 + 0.4 * sin(T * 0.5 + fi * 3.0));
    float fr = (0.35 + 0.5 * hash(float(i) * 0.7)) * 6.2831853;
    float ph = T * 0.6 + hash(float(i) * 3.1) * 6.2831853;
    float r  = (0.0112 + 0.0308 * d) * uThick;           // band half-width
    float cx = bx + am * sin(uv.y * fr + ph)
                  + am * 0.22 * sin(uv.y * fr * 1.7 - T * 0.7 + fi * 3.1);
    float gauss = exp(-(uv.x - cx) * (uv.x - cx) / (2.0 * r * r));
    float hue   = uHueC + uHueA * sin(T * 0.35 + fi * 2.0 + uv.y * 2.5);
    float fold  = 0.5 + 0.5 * sin(uv.y * 7.0 - T * 1.3 + fi * 4.0);
    float a     = (0.11 + 0.17 * d) * (0.3 + 0.7 * fold * fold) * gauss;
    col += hsl(hue / 360.0, 0.9, 0.6) * a;
  }
  return col;
}
void main() { gl_FragColor = vec4(curtains(gl_FragCoord.xy / uRes, uT), 1.0); }`;

// Pass 2 ── extract . extend dither . extend blur.  The Store is now the texture.
export const FS_COMPOSE = `
precision highp float;
uniform vec2  uRes;
uniform float uT, uBlur, uDither;
uniform sampler2D uField;        // the Store, materialised

vec3 peek(vec2 px) { return texture2D(uField, px / uRes).rgb; }

// extend ── blur : average the 3x3 neighbourhood of the focus (the canonical comonadic op)
vec3 blur(vec2 px) {
  vec3 s = vec3(0.0);
  for (int dy = -1; dy <= 1; dy++)
    for (int dx = -1; dx <= 1; dx++)
      s += peek(px + vec2(float(dx), float(dy)) * uBlur);   // peeks a neighbour
  return s / 9.0;
}

// extend ── dither : 2-LSB triangular (TPDF) blue-noise, shifted per frame
// (temporal), applied LAST, right before the 8-bit write. This dissolves banding.
vec3 dither(vec2 px, float T, vec3 c) {
  float tt  = fract(T * 50.0);
  float ig  = fract(52.9829189 * fract(dot(px,                   vec2(0.06711056, 0.00583715))) + tt);
  float ig2 = fract(52.9829189 * fract(dot(px + vec2(97.0, 71.0), vec2(0.06711056, 0.00583715))) + tt + 0.5);
  return c + (ig + ig2 - 1.0) * uDither / 255.0;
}

void main() {
  vec2 px = gl_FragCoord.xy;
  // picture = extract . extend dither . extend blur . extend curtains
  gl_FragColor = vec4(dither(px, uT, blur(px)), 1.0);
}`;
