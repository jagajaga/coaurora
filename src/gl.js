// GPU renderer — the comonad as a two-pass WebGL pipeline.
//   pass 1: `extend curtains` -> an off-screen texture (the Store, materialised)
//   pass 2: `extract . extend dither . extend blur`, sampling that texture.
// Returns a stop() function, or null if WebGL/shaders are unavailable.

import { VERTEX, fsCurtains, FS_COMPOSE } from './shaders.js';

export function runGL(canvas, opts, env) {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return null;

  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const link = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const pCurt = link(fsCurtains(opts.curtains));
  const pComp = link(FS_COMPOSE);
  if (!pCurt || !pComp) return null;

  // one full-screen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attrib = (p) => { const l = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); };

  // the Store between passes: an off-screen texture + framebuffer
  const tex = gl.createTexture(), fbo = gl.createFramebuffer();
  const texAlloc = (w, h) => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  let W, H;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), over = env.oversize();
    W = Math.round(innerWidth * over * dpr);
    H = Math.round(innerHeight * over * dpr);
    const n = W * H;
    if (n > opts.resolutionCap) { const s = Math.sqrt(opts.resolutionCap / n); W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s)); }
    canvas.width = W; canvas.height = H;
    texAlloc(W, H);
  };
  resize();
  addEventListener('resize', resize);

  const u = (p, n) => gl.getUniformLocation(p, n);
  const c = { res: u(pCurt, 'uRes'), t: u(pCurt, 'uT'), floor: u(pCurt, 'uFloor'), hueC: u(pCurt, 'uHueC'), hueA: u(pCurt, 'uHueA'), thick: u(pCurt, 'uThick'), bright: u(pCurt, 'uBright') };
  const o = { res: u(pComp, 'uRes'), t: u(pComp, 'uT'), field: u(pComp, 'uField'), blur: u(pComp, 'uBlur'), dither: u(pComp, 'uDither') };

  let last = 0, raf = 0, stopped = false;
  const frame = (now) => {
    if (!env.reduced && !stopped) raf = requestAnimationFrame(frame);
    if (now - last < 1000 / opts.fps) return;
    last = now;
    const T = now * 0.0004 * opts.speed;
    const [hc, ha] = env.hue(opts.hue), fl = opts._floor;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, W, H);           // pass 1: extend curtains -> the Store
    gl.useProgram(pCurt); attrib(pCurt);
    gl.uniform2f(c.res, W, H); gl.uniform1f(c.t, T);
    gl.uniform3f(c.floor, fl[0], fl[1], fl[2]);
    gl.uniform1f(c.hueC, hc); gl.uniform1f(c.hueA, ha); gl.uniform1f(c.thick, opts.thickness);
    gl.uniform1f(c.bright, opts.brightness);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);          // pass 2: extend blur, then extend dither
    gl.useProgram(pComp); attrib(pComp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(o.field, 0);
    gl.uniform2f(o.res, W, H); gl.uniform1f(o.t, T);
    gl.uniform1f(o.blur, opts.blur); gl.uniform1f(o.dither, opts.dither ? 1.1 : 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame(frame);

  return () => { stopped = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); };
}
