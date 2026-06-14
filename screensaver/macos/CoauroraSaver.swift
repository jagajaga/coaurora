// Coaurora — macOS screensaver.
// The same Store-comonad aurora as the web library, ported to Metal — but at
// MAXIMUM bit depth: we render into an rgba16Float drawable with an
// extended-sRGB colorspace, so macOS composites the float image directly and
// capable displays get a true 10-bit+ path. (The thing browsers wouldn't let
// the web version do.)
//
// Build & install:   make install      (see Makefile / README.md)

import ScreenSaver
import Metal
import MetalKit
import QuartzCore
import AppKit

private let shaderSource = """
#include <metal_stdlib>
using namespace metal;

struct VOut { float4 pos [[position]]; };

// one full-screen triangle
vertex VOut coauroraVertex(uint vid [[vertex_id]]) {
    float2 p = float2(float((vid << 1) & 2), float(vid & 2));
    VOut o;
    o.pos = float4(p * 2.0 - 1.0, 0.0, 1.0);
    return o;
}

float hashf(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

float3 hsl2rgb(float h, float s, float l) {
    float3 r = clamp(abs(fmod(h * 6.0 + float3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return l + s * (r - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

// The comonad, compiled: this function is `peek`, the fragment position is the
// focus, and the GPU running it everywhere is `extend`.
//   picture = extract . extend dither . extend curtains $ positions
fragment float4 coauroraFragment(VOut in [[stage_in]],
                                 constant float2 &res    [[buffer(0)]],
                                 constant float  &time   [[buffer(1)]],
                                 constant float  &bright [[buffer(2)]]) {
    float2 uv = in.pos.xy / res;

    // tilt: 22° clockwise, baked into pattern space (cos 22° = .9272, sin 22° = .3746)
    float2 c = uv - 0.5;
    float2 p = float2(c.x * 0.9272 - c.y * 0.3746,
                      c.x * 0.3746 + c.y * 0.9272) + 0.5;

    float T = time;
    float3 col = float3(0.010, 0.018, 0.013);          // lifted black floor

    // coalgebra: curtains — 16 drifting Gaussian bands (spread widened so the
    // rotated corners stay covered)
    for (int i = 0; i < 16; i++) {
        float fi = float(i) / 15.0;
        float d  = hashf(float(i) + 0.3);
        float bx = -0.18 + 1.36 * fi + 0.05 * (hashf(float(i) * 1.7) - 0.5);
        float am = (0.028 + 0.03 * hashf(float(i) * 2.3)) * (0.6 + 0.4 * sin(T * 0.5 + fi * 3.0));
        float fr = (0.35 + 0.5 * hashf(float(i) * 0.7)) * 6.2831853;
        float ph = T * 0.6 + hashf(float(i) * 3.1) * 6.2831853;
        float r  = (0.0112 + 0.0308 * d) * 0.6;
        float cx = bx + am * sin(p.y * fr + ph)
                      + am * 0.22 * sin(p.y * fr * 1.7 - T * 0.7 + fi * 3.1);
        float g  = exp(-(p.x - cx) * (p.x - cx) / (2.0 * r * r));
        float hue  = 125.0 + 40.0 * sin(T * 0.35 + fi * 2.0 + p.y * 2.5);
        float fold = 0.5 + 0.5 * sin(p.y * 7.0 - T * 1.3 + fi * 4.0);
        float a    = (0.11 + 0.17 * d) * (0.3 + 0.7 * fold * fold) * g * bright;
        col += hsl2rgb(hue / 360.0, 0.9, 0.6) * a;
    }

    // saturation boost (the web preset's saturate: 1.35)
    float grey = dot(col, float3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(float3(grey), col, 1.35), 0.0, 1.0);

    // coalgebra: dither — TPDF blue-noise, temporal, at 10-BIT amplitude.
    // With the float16 drawable the compositor gets the smooth signal; this
    // only guards the final panel quantization, and is invisible at 1/1023.
    float tt  = fract(T * 50.0);
    float ig  = fract(52.9829189 * fract(dot(in.pos.xy,                      float2(0.06711056, 0.00583715))) + tt);
    float ig2 = fract(52.9829189 * fract(dot(in.pos.xy + float2(97.0, 71.0), float2(0.06711056, 0.00583715))) + tt + 0.5);
    col += (ig + ig2 - 1.0) * 1.1 / 1023.0;

    return float4(col, 1.0);
}
"""

@objc(CoauroraSaverView)
public final class CoauroraSaverView: ScreenSaverView, MTKViewDelegate {

    private var mtk: MTKView?
    private var queue: MTLCommandQueue?
    private var pipeline: MTLRenderPipelineState?
    private let t0 = CACurrentMediaTime()
    private let speed: Float = 1.0          // animation speed (web units)
    private let fps = 30                    // frame cap — the aurora is slow

    // line brightness — persisted in this saver's own defaults domain, edited
    // from the standard Screen Saver "Options…" sheet.
    private static let defaultsDomain = "me.jagajaga.coaurora.saver"
    private static let brightnessKey  = "brightness"
    private static func savedBrightness() -> Float {
        guard let d = ScreenSaverDefaults(forModuleWithName: defaultsDomain) else { return 1.0 }
        d.register(defaults: [brightnessKey: 1.0])
        return Float(d.double(forKey: brightnessKey))
    }
    private var brightness = CoauroraSaverView.savedBrightness()

    public override init?(frame: NSRect, isPreview: Bool) {
        super.init(frame: frame, isPreview: isPreview)
        setup()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        guard let device = MTLCreateSystemDefaultDevice(),
              let lib = try? device.makeLibrary(source: shaderSource, options: nil),
              let vfn = lib.makeFunction(name: "coauroraVertex"),
              let ffn = lib.makeFunction(name: "coauroraFragment")
        else { return }                      // no Metal -> static black, never crash

        let view = MTKView(frame: bounds, device: device)
        view.autoresizingMask = [.width, .height]
        view.preferredFramesPerSecond = fps
        view.framebufferOnly = true

        // ── maximum bits ────────────────────────────────────────────────
        // Half-float drawable + extended-sRGB colorspace: the compositor
        // receives the un-quantized image and drives 10-bit panels natively.
        view.colorPixelFormat = .rgba16Float
        view.colorspace = CGColorSpace(name: CGColorSpace.extendedSRGB)

        let desc = MTLRenderPipelineDescriptor()
        desc.vertexFunction = vfn
        desc.fragmentFunction = ffn
        desc.colorAttachments[0].pixelFormat = view.colorPixelFormat
        guard let pso = try? device.makeRenderPipelineState(descriptor: desc) else { return }

        view.delegate = self
        addSubview(view)
        pipeline = pso
        queue = device.makeCommandQueue()
        mtk = view
    }

    public override func startAnimation() { super.startAnimation(); mtk?.isPaused = false }
    public override func stopAnimation()  { super.stopAnimation();  mtk?.isPaused = true  }

    // ── the "Options…" sheet: a single brightness slider ────────────────────
    private var configWindow: NSWindow?
    private var brightnessSlider: NSSlider?

    public override var hasConfigureSheet: Bool { true }

    public override var configureSheet: NSWindow? {
        if let w = configWindow { return w }
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 340, height: 130),
                         styleMask: [.titled], backing: .buffered, defer: true)
        w.title = "Coaurora"
        let v = w.contentView!

        let label = NSTextField(labelWithString: "Line brightness")
        label.frame = NSRect(x: 20, y: 92, width: 200, height: 18)
        v.addSubview(label)

        let slider = NSSlider(value: Double(brightness), minValue: 0.0, maxValue: 2.5,
                              target: self, action: #selector(brightnessSliderMoved(_:)))
        slider.frame = NSRect(x: 20, y: 60, width: 300, height: 20)
        v.addSubview(slider)
        brightnessSlider = slider

        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancelConfig(_:)))
        cancel.frame = NSRect(x: 150, y: 16, width: 80, height: 28); cancel.bezelStyle = .rounded
        v.addSubview(cancel)

        let ok = NSButton(title: "OK", target: self, action: #selector(saveConfig(_:)))
        ok.frame = NSRect(x: 238, y: 16, width: 80, height: 28); ok.bezelStyle = .rounded
        ok.keyEquivalent = "\r"
        v.addSubview(ok)

        configWindow = w
        return w
    }

    @objc private func brightnessSliderMoved(_ s: NSSlider) {
        brightness = Float(s.doubleValue)          // live preview while the sheet is open
    }

    private func endSheet() {
        guard let w = configWindow else { return }
        if let parent = w.sheetParent { parent.endSheet(w) } else { NSApp.stopModal() }
    }

    @objc private func saveConfig(_ sender: Any?) {
        if let d = ScreenSaverDefaults(forModuleWithName: CoauroraSaverView.defaultsDomain) {
            d.set(Double(brightness), forKey: CoauroraSaverView.brightnessKey)
            d.synchronize()
        }
        endSheet()
    }

    @objc private func cancelConfig(_ sender: Any?) {
        brightness = CoauroraSaverView.savedBrightness()   // revert the live preview
        brightnessSlider?.doubleValue = Double(brightness)
        endSheet()
    }

    public func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}

    public func draw(in view: MTKView) {
        guard let pipeline, let queue,
              let rpd = view.currentRenderPassDescriptor,
              let drawable = view.currentDrawable,
              let cmd = queue.makeCommandBuffer(),
              let enc = cmd.makeRenderCommandEncoder(descriptor: rpd)
        else { return }

        var res = SIMD2<Float>(Float(view.drawableSize.width), Float(view.drawableSize.height))
        var t   = Float(CACurrentMediaTime() - t0) * 0.4 * speed   // web's T = ms * 0.0004
        var b   = brightness

        enc.setRenderPipelineState(pipeline)
        enc.setFragmentBytes(&res, length: MemoryLayout<SIMD2<Float>>.size, index: 0)
        enc.setFragmentBytes(&t,   length: MemoryLayout<Float>.size,        index: 1)
        enc.setFragmentBytes(&b,   length: MemoryLayout<Float>.size,        index: 2)
        enc.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        enc.endEncoding()
        cmd.present(drawable)
        cmd.commit()
    }
}
