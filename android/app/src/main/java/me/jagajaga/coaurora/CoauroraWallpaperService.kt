// Coaurora — Android live wallpaper (home & lock screen).
// The same Store-comonad aurora as the web library: the fragment shader below
// is the web GLSL near-verbatim (curtains + temporal TPDF dither, fused).
// Settings (speed/tilt/hue/curtains/fps) live in SharedPreferences and apply live.

package me.jagajaga.coaurora

import android.content.Context
import android.content.SharedPreferences
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.service.wallpaper.WallpaperService
import android.view.SurfaceHolder
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

object Prefs {
    const val NAME = "coaurora"
    fun get(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)
    fun speed(p: SharedPreferences)     = p.getInt("speed", 100) / 100f          // 0..3
    fun tilt(p: SharedPreferences)      = p.getInt("tilt", 67) - 45f             // -45..45 deg
    fun thickness(p: SharedPreferences) = p.getInt("thickness", 60) / 100f       // 0.2..1.6
    fun hueLo(p: SharedPreferences)     = p.getInt("hueLo", 85).toFloat()
    fun hueHi(p: SharedPreferences)     = p.getInt("hueHi", 165).toFloat()
    fun curtains(p: SharedPreferences)  = p.getInt("curtains", 16)               // 3..28
    fun fps(p: SharedPreferences)       = intArrayOf(15, 30, 60)[p.getInt("fps", 1).coerceIn(0, 2)]
}

class AuroraRenderer(private val ctx: Context) : GLSurfaceView.Renderer {

    @Volatile var speed = 1f
    @Volatile var tiltDeg = 22f
    @Volatile var thickness = 0.6f
    @Volatile var hueLo = 85f
    @Volatile var hueHi = 165f
    @Volatile var curtains = 16
    @Volatile private var built = -1     // curtain count baked into the program

    private var prog = 0
    private var w = 1
    private var h = 1
    private val t0 = SystemClock.elapsedRealtime()
    private val tri: FloatBuffer = ByteBuffer.allocateDirect(6 * 4)
        .order(ByteOrder.nativeOrder()).asFloatBuffer()
        .apply { put(floatArrayOf(-1f, -1f, 3f, -1f, -1f, 3f)); position(0) }

    fun loadPrefs(p: SharedPreferences) {
        speed = Prefs.speed(p); tiltDeg = Prefs.tilt(p); thickness = Prefs.thickness(p)
        hueLo = Prefs.hueLo(p); hueHi = Prefs.hueHi(p); curtains = Prefs.curtains(p)
    }

    private fun vertexSrc() = """
        attribute vec2 p;
        void main() { gl_Position = vec4(p, 0.0, 1.0); }
    """

    // the web library's fragment shader, with the curtain count baked in
    private fun fragmentSrc(count: Int) = """
        precision highp float;
        uniform vec2  uRes;
        uniform float uT, uCos, uSin, uThick, uHueC, uHueA;
        float hashf(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
        vec3 hsl(float h, float s, float l) {
          vec3 r = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (r - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }
        void main() {
          vec2 uv = gl_FragCoord.xy / uRes;
          vec2 c = uv - 0.5;
          vec2 p = vec2(c.x * uCos - c.y * uSin, c.x * uSin + c.y * uCos) + 0.5;
          float T = uT;
          vec3 col = vec3(0.010, 0.018, 0.013);
          for (int i = 0; i < $count; i++) {
            float fi = float(i) / ${(count - 1).coerceAtLeast(1)}.0;
            float d  = hashf(float(i) + 0.3);
            float bx = -0.18 + 1.36 * fi + 0.05 * (hashf(float(i) * 1.7) - 0.5);
            float am = (0.028 + 0.03 * hashf(float(i) * 2.3)) * (0.6 + 0.4 * sin(T * 0.5 + fi * 3.0));
            float fr = (0.35 + 0.5 * hashf(float(i) * 0.7)) * 6.2831853;
            float ph = T * 0.6 + hashf(float(i) * 3.1) * 6.2831853;
            float r  = (0.0112 + 0.0308 * d) * uThick;
            float cx = bx + am * sin(p.y * fr + ph) + am * 0.22 * sin(p.y * fr * 1.7 - T * 0.7 + fi * 3.1);
            float g  = exp(-(p.x - cx) * (p.x - cx) / (2.0 * r * r));
            float hue  = uHueC + uHueA * sin(T * 0.35 + fi * 2.0 + p.y * 2.5);
            float fold = 0.5 + 0.5 * sin(p.y * 7.0 - T * 1.3 + fi * 4.0);
            float a    = (0.11 + 0.17 * d) * (0.3 + 0.7 * fold * fold) * g;
            col += hsl(hue / 360.0, 0.9, 0.6) * a;
          }
          float grey = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = clamp(mix(vec3(grey), col, 1.35), 0.0, 1.0);
          float tt  = fract(T * 50.0);
          float ig  = fract(52.9829189 * fract(dot(gl_FragCoord.xy,                    vec2(0.06711056, 0.00583715))) + tt);
          float ig2 = fract(52.9829189 * fract(dot(gl_FragCoord.xy + vec2(97.0, 71.0), vec2(0.06711056, 0.00583715))) + tt + 0.5);
          col += (ig + ig2 - 1.0) * 1.1 / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }
    """

    private fun compile(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        return s
    }

    private fun build() {
        if (prog != 0) GLES20.glDeleteProgram(prog)
        prog = GLES20.glCreateProgram()
        GLES20.glAttachShader(prog, compile(GLES20.GL_VERTEX_SHADER, vertexSrc()))
        GLES20.glAttachShader(prog, compile(GLES20.GL_FRAGMENT_SHADER, fragmentSrc(curtains)))
        GLES20.glBindAttribLocation(prog, 0, "p")
        GLES20.glLinkProgram(prog)
        built = curtains
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        loadPrefs(Prefs.get(ctx))
        build()
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        w = width; h = height
        GLES20.glViewport(0, 0, w, h)
    }

    override fun onDrawFrame(gl: GL10?) {
        if (built != curtains) build()
        val t = (SystemClock.elapsedRealtime() - t0) * 0.0004f * speed   // web's T
        val rad = tiltDeg * (Math.PI / 180.0)
        GLES20.glUseProgram(prog)
        fun u(n: String) = GLES20.glGetUniformLocation(prog, n)
        GLES20.glUniform2f(u("uRes"), w.toFloat(), h.toFloat())
        GLES20.glUniform1f(u("uT"), t)
        GLES20.glUniform1f(u("uCos"), Math.cos(rad).toFloat())
        GLES20.glUniform1f(u("uSin"), Math.sin(rad).toFloat())
        GLES20.glUniform1f(u("uThick"), thickness)
        GLES20.glUniform1f(u("uHueC"), (hueLo + hueHi) / 2f)
        GLES20.glUniform1f(u("uHueA"), (hueHi - hueLo) / 2f)
        GLES20.glEnableVertexAttribArray(0)
        GLES20.glVertexAttribPointer(0, 2, GLES20.GL_FLOAT, false, 0, tri)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 3)
    }
}

class CoauroraWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = AuroraEngine()

    inner class AuroraEngine : Engine(), SharedPreferences.OnSharedPreferenceChangeListener {

        // the classic trick: a GLSurfaceView whose holder is the wallpaper's
        private inner class WallpaperGLSurfaceView(ctx: Context) : GLSurfaceView(ctx) {
            override fun getHolder(): SurfaceHolder = surfaceHolder
            fun onWallpaperDestroy() = super.onDetachedFromWindow()
        }

        private lateinit var view: WallpaperGLSurfaceView
        private val renderer = AuroraRenderer(this@CoauroraWallpaperService)
        private val handler = Handler(Looper.getMainLooper())
        private var fps = 30
        private var isVisible = false

        private val tick = object : Runnable {
            override fun run() {
                if (isVisible) {
                    view.requestRender()
                    handler.postDelayed(this, 1000L / fps)
                }
            }
        }

        override fun onCreate(holder: SurfaceHolder) {
            super.onCreate(holder)
            view = WallpaperGLSurfaceView(this@CoauroraWallpaperService)
            view.setEGLContextClientVersion(2)
            view.preserveEGLContextOnPause = true
            view.setRenderer(renderer)
            view.renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
            val p = Prefs.get(this@CoauroraWallpaperService)
            renderer.loadPrefs(p)
            fps = Prefs.fps(p)
            p.registerOnSharedPreferenceChangeListener(this)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            isVisible = visible
            handler.removeCallbacks(tick)
            if (visible) {
                view.onResume()
                handler.post(tick)
            } else {
                view.onPause()       // battery: stop completely when not on screen
            }
        }

        override fun onSharedPreferenceChanged(p: SharedPreferences, key: String?) {
            renderer.loadPrefs(p)
            fps = Prefs.fps(p)
            if (isVisible) view.requestRender()
        }

        override fun onDestroy() {
            handler.removeCallbacks(tick)
            Prefs.get(this@CoauroraWallpaperService).unregisterOnSharedPreferenceChangeListener(this)
            view.onWallpaperDestroy()
            super.onDestroy()
        }
    }
}
