export interface AuroraOptions {
  /** Number of curtain bands. Changing this re-initialises the renderer. Default 16. */
  curtains?: number;
  /** Colour band `[low, high]` in degrees. Default `[85, 165]` (green → teal). */
  hue?: [number, number];
  /** Curtain width. Default 0.6. */
  thickness?: number;
  /** Line brightness — scales each curtain's contribution; the floor is unaffected. `1` is default; `0` hides the lines. */
  brightness?: number;
  /** Animation speed multiplier. Default 1. */
  speed?: number;
  /** Comonadic 3×3 blur radius, in texels. `0` disables it. Default 1.5. */
  blur?: number;
  /** Tilt in degrees (clockwise). Default 22. */
  tilt?: number;
  /** Lifted black floor — hex string or `[r, g, b]` in 0..1. Default `'#030503'`. */
  floor?: string | [number, number, number];
  /** TPDF blue-noise temporal dithering (kills 8-bit banding). Default true. */
  dither?: boolean;
  /** Frame cap. Default 30. */
  fps?: number;
  /** Maximum rendered pixels, to protect the GPU. Default 4.2e6. */
  resolutionCap?: number;
  /** Default `'auto'` (honours `prefers-reduced-motion`). */
  reducedMotion?: 'auto' | 'reduce' | 'no-preference';
  /** CSS saturation boost on the canvas. Default 1. */
  saturate?: number;
  /** Canvas `z-index`. Default -1. */
  zIndex?: number;
  /** Canvas opacity. Default 1. */
  opacity?: number;
}

export interface AuroraHandle {
  /** Live-tweak options (everything except `curtains`, which needs a restart). */
  set(patch: Partial<AuroraOptions>): void;
  /** Stop animating and remove the canvas. */
  stop(): void;
  /** The created `<canvas>` element. */
  canvas: HTMLCanvasElement;
}

export const DEFAULTS: Required<Omit<AuroraOptions, 'hue' | 'floor'>> & Pick<AuroraOptions, 'hue' | 'floor'>;
export const presets: Record<'jagajaga' | 'ice' | 'ember' | 'violet', Partial<AuroraOptions>>;

/**
 * Mount a full-page aurora background.
 * @param target  CSS selector or element to append the canvas to (default: document.body).
 * @param options see {@link AuroraOptions}.
 */
export function aurora(target?: string | Element | null, options?: AuroraOptions): AuroraHandle;
export default aurora;
