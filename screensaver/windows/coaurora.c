/* Coaurora — Windows screensaver (.scr).
 *
 * The same Store-comonad aurora as the web library, rendered with OpenGL —
 * the fragment shader below is essentially the web version's GLSL verbatim
 * (curtains + temporal TPDF blue-noise dither, fused into one pass).
 *
 * Screensaver protocol:  /s fullscreen   /p <hwnd> preview   /c config
 * Build (MinGW):         make            (cross-compiles fine from Linux)
 * Install:               right-click Coaurora.scr -> Install
 */

#include <windows.h>
#include <windowsx.h>
#include <commctrl.h>      /* trackbar in the config dialog */
#include <GL/gl.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/* ---- minimal GL 2.0 loader (gl.h on Windows is stuck at 1.1) ------------ */
typedef char GLchar;
#define GL_FRAGMENT_SHADER 0x8B30
#define GL_COMPILE_STATUS  0x8B81
#define GL_LINK_STATUS     0x8B82

typedef GLuint (APIENTRY *PFNGLCREATESHADERPROC)(GLenum);
typedef void   (APIENTRY *PFNGLSHADERSOURCEPROC)(GLuint, GLsizei, const GLchar *const*, const GLint*);
typedef void   (APIENTRY *PFNGLCOMPILESHADERPROC)(GLuint);
typedef void   (APIENTRY *PFNGLGETSHADERIVPROC)(GLuint, GLenum, GLint*);
typedef GLuint (APIENTRY *PFNGLCREATEPROGRAMPROC)(void);
typedef void   (APIENTRY *PFNGLATTACHSHADERPROC)(GLuint, GLuint);
typedef void   (APIENTRY *PFNGLLINKPROGRAMPROC)(GLuint);
typedef void   (APIENTRY *PFNGLGETPROGRAMIVPROC)(GLuint, GLenum, GLint*);
typedef void   (APIENTRY *PFNGLUSEPROGRAMPROC)(GLuint);
typedef GLint  (APIENTRY *PFNGLGETUNIFORMLOCATIONPROC)(GLuint, const GLchar*);
typedef void   (APIENTRY *PFNGLUNIFORM1FPROC)(GLint, GLfloat);
typedef void   (APIENTRY *PFNGLUNIFORM2FPROC)(GLint, GLfloat, GLfloat);

static PFNGLCREATESHADERPROC       pglCreateShader;
static PFNGLSHADERSOURCEPROC       pglShaderSource;
static PFNGLCOMPILESHADERPROC      pglCompileShader;
static PFNGLGETSHADERIVPROC        pglGetShaderiv;
static PFNGLCREATEPROGRAMPROC      pglCreateProgram;
static PFNGLATTACHSHADERPROC       pglAttachShader;
static PFNGLLINKPROGRAMPROC        pglLinkProgram;
static PFNGLGETPROGRAMIVPROC       pglGetProgramiv;
static PFNGLUSEPROGRAMPROC         pglUseProgram;
static PFNGLGETUNIFORMLOCATIONPROC pglGetUniformLocation;
static PFNGLUNIFORM1FPROC          pglUniform1f;
static PFNGLUNIFORM2FPROC          pglUniform2f;

static int loadGL(void)
{
    pglCreateShader       = (PFNGLCREATESHADERPROC)      wglGetProcAddress("glCreateShader");
    pglShaderSource       = (PFNGLSHADERSOURCEPROC)      wglGetProcAddress("glShaderSource");
    pglCompileShader      = (PFNGLCOMPILESHADERPROC)     wglGetProcAddress("glCompileShader");
    pglGetShaderiv        = (PFNGLGETSHADERIVPROC)       wglGetProcAddress("glGetShaderiv");
    pglCreateProgram      = (PFNGLCREATEPROGRAMPROC)     wglGetProcAddress("glCreateProgram");
    pglAttachShader       = (PFNGLATTACHSHADERPROC)      wglGetProcAddress("glAttachShader");
    pglLinkProgram        = (PFNGLLINKPROGRAMPROC)       wglGetProcAddress("glLinkProgram");
    pglGetProgramiv       = (PFNGLGETPROGRAMIVPROC)      wglGetProcAddress("glGetProgramiv");
    pglUseProgram         = (PFNGLUSEPROGRAMPROC)        wglGetProcAddress("glUseProgram");
    pglGetUniformLocation = (PFNGLGETUNIFORMLOCATIONPROC)wglGetProcAddress("glGetUniformLocation");
    pglUniform1f          = (PFNGLUNIFORM1FPROC)         wglGetProcAddress("glUniform1f");
    pglUniform2f          = (PFNGLUNIFORM2FPROC)         wglGetProcAddress("glUniform2f");
    return pglCreateShader && pglShaderSource && pglCompileShader && pglGetShaderiv
        && pglCreateProgram && pglAttachShader && pglLinkProgram && pglGetProgramiv
        && pglUseProgram && pglGetUniformLocation && pglUniform1f && pglUniform2f;
}

/* ---- the shader: the web library's GLSL, fragment-only (fixed-fn vertex) - */
static const char *FRAGMENT_SRC =
"#version 120\n"
"uniform vec2  uRes;\n"
"uniform float uT;\n"
"uniform float uBright;\n"
"float hashf(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }\n"
"vec3 hsl(float h, float s, float l) {\n"
"  vec3 r = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);\n"
"  return l + s * (r - 0.5) * (1.0 - abs(2.0 * l - 1.0));\n"
"}\n"
"void main() {\n"
"  vec2 uv = gl_FragCoord.xy / uRes;\n"
"  /* tilt: 22 deg, baked into pattern space */\n"
"  vec2 c = uv - 0.5;\n"
"  vec2 p = vec2(c.x * 0.9272 - c.y * 0.3746, c.x * 0.3746 + c.y * 0.9272) + 0.5;\n"
"  float T = uT;\n"
"  vec3 col = vec3(0.010, 0.018, 0.013);\n"
"  for (int i = 0; i < 16; i++) {\n"
"    float fi = float(i) / 15.0;\n"
"    float d  = hashf(float(i) + 0.3);\n"
"    float bx = -0.18 + 1.36 * fi + 0.05 * (hashf(float(i) * 1.7) - 0.5);\n"
"    float am = (0.028 + 0.03 * hashf(float(i) * 2.3)) * (0.6 + 0.4 * sin(T * 0.5 + fi * 3.0));\n"
"    float fr = (0.35 + 0.5 * hashf(float(i) * 0.7)) * 6.2831853;\n"
"    float ph = T * 0.6 + hashf(float(i) * 3.1) * 6.2831853;\n"
"    float r  = (0.0112 + 0.0308 * d) * 0.6;\n"
"    float cx = bx + am * sin(p.y * fr + ph) + am * 0.22 * sin(p.y * fr * 1.7 - T * 0.7 + fi * 3.1);\n"
"    float g  = exp(-(p.x - cx) * (p.x - cx) / (2.0 * r * r));\n"
"    float hue  = 125.0 + 40.0 * sin(T * 0.35 + fi * 2.0 + p.y * 2.5);\n"
"    float fold = 0.5 + 0.5 * sin(p.y * 7.0 - T * 1.3 + fi * 4.0);\n"
"    float a    = (0.11 + 0.17 * d) * (0.3 + 0.7 * fold * fold) * g * uBright;\n"
"    col += hsl(hue / 360.0, 0.9, 0.6) * a;\n"
"  }\n"
"  float grey = dot(col, vec3(0.2126, 0.7152, 0.0722));\n"
"  col = clamp(mix(vec3(grey), col, 1.35), 0.0, 1.0);\n"
"  /* TPDF blue-noise temporal dither, applied last (kills banding on 8-bit) */\n"
"  float tt  = fract(T * 50.0);\n"
"  float ig  = fract(52.9829189 * fract(dot(gl_FragCoord.xy,                   vec2(0.06711056, 0.00583715))) + tt);\n"
"  float ig2 = fract(52.9829189 * fract(dot(gl_FragCoord.xy + vec2(97.0, 71.0), vec2(0.06711056, 0.00583715))) + tt + 0.5);\n"
"  col += (ig + ig2 - 1.0) * 1.1 / 255.0;\n"
"  gl_FragColor = vec4(col, 1.0);\n"
"}\n";

/* ---- state --------------------------------------------------------------- */
static int    g_preview = 0;
static HDC    g_dc      = NULL;
static HGLRC  g_rc      = NULL;
static GLuint g_prog    = 0;
static GLint  g_uRes    = -1, g_uT = -1, g_uBright = -1;
static POINT  g_mouse0  = { -1, -1 };
static DWORD  g_t0      = 0;
static float  g_bright  = 1.0f;          /* line brightness, persisted in HKCU */

/* ---- persisted setting: HKCU\Software\coaurora\brightness (DWORD percent) - */
static float loadBrightness(void)
{
    HKEY  key;
    DWORD val = 100, sz = sizeof(val), type = REG_DWORD;
    if (RegOpenKeyExA(HKEY_CURRENT_USER, "Software\\coaurora", 0, KEY_READ, &key) == ERROR_SUCCESS) {
        RegQueryValueExA(key, "brightness", NULL, &type, (LPBYTE)&val, &sz);
        RegCloseKey(key);
    }
    if (val > 250) val = 250;
    return (float)val / 100.0f;          /* 100 -> 1.0 */
}

static void saveBrightness(DWORD pct)
{
    HKEY key;
    if (RegCreateKeyExA(HKEY_CURRENT_USER, "Software\\coaurora", 0, NULL, 0,
                        KEY_WRITE, NULL, &key, NULL) == ERROR_SUCCESS) {
        RegSetValueExA(key, "brightness", 0, REG_DWORD, (const BYTE *)&pct, sizeof(pct));
        RegCloseKey(key);
    }
}

/* ---- window proc ---------------------------------------------------------- */
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp)
{
    switch (msg) {
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    case WM_KEYDOWN:
    case WM_LBUTTONDOWN:
    case WM_RBUTTONDOWN:
    case WM_MBUTTONDOWN:
        if (!g_preview) PostQuitMessage(0);
        return 0;
    case WM_MOUSEMOVE:
        if (!g_preview) {
            int x = GET_X_LPARAM(lp), y = GET_Y_LPARAM(lp);
            if (g_mouse0.x < 0) { g_mouse0.x = x; g_mouse0.y = y; }
            else if (abs(x - g_mouse0.x) > 8 || abs(y - g_mouse0.y) > 8)
                PostQuitMessage(0);
        }
        return 0;
    case WM_SETCURSOR:
        if (!g_preview) { SetCursor(NULL); return TRUE; }
        break;
    case WM_SYSCOMMAND:
        if (!g_preview && (wp == SC_SCREENSAVE || wp == SC_MONITORPOWER)) return 0;
        break;
    }
    return DefWindowProc(hwnd, msg, wp, lp);
}

/* ---- GL setup -------------------------------------------------------------- */
static int initGL(HWND hwnd)
{
    PIXELFORMATDESCRIPTOR pfd;
    int fmt;
    GLuint fs;
    GLint ok;

    memset(&pfd, 0, sizeof(pfd));
    pfd.nSize      = sizeof(pfd);
    pfd.nVersion   = 1;
    pfd.dwFlags    = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
    pfd.iPixelType = PFD_TYPE_RGBA;
    pfd.cColorBits = 32;
    pfd.iLayerType = PFD_MAIN_PLANE;

    g_dc = GetDC(hwnd);
    if (!g_dc) return 0;
    fmt = ChoosePixelFormat(g_dc, &pfd);
    if (!fmt || !SetPixelFormat(g_dc, fmt, &pfd)) return 0;
    g_rc = wglCreateContext(g_dc);
    if (!g_rc || !wglMakeCurrent(g_dc, g_rc)) return 0;
    if (!loadGL()) return 0;

    fs = pglCreateShader(GL_FRAGMENT_SHADER);
    pglShaderSource(fs, 1, &FRAGMENT_SRC, NULL);
    pglCompileShader(fs);
    pglGetShaderiv(fs, GL_COMPILE_STATUS, &ok);
    if (!ok) return 0;

    g_prog = pglCreateProgram();
    pglAttachShader(g_prog, fs);
    pglLinkProgram(g_prog);
    pglGetProgramiv(g_prog, GL_LINK_STATUS, &ok);
    if (!ok) return 0;

    g_uRes    = pglGetUniformLocation(g_prog, "uRes");
    g_uT      = pglGetUniformLocation(g_prog, "uT");
    g_uBright = pglGetUniformLocation(g_prog, "uBright");
    g_t0      = GetTickCount();
    return 1;
}

static void drawFrame(HWND hwnd)
{
    RECT r;
    GetClientRect(hwnd, &r);
    {
        int w = r.right - r.left, h = r.bottom - r.top;
        if (w < 1) w = 1;
        if (h < 1) h = 1;
        glViewport(0, 0, w, h);
        pglUseProgram(g_prog);
        pglUniform2f(g_uRes, (GLfloat)w, (GLfloat)h);
        pglUniform1f(g_uT, (GLfloat)((GetTickCount() - g_t0) * 0.0004)); /* web's T */
        pglUniform1f(g_uBright, (GLfloat)g_bright);
        glBegin(GL_TRIANGLES);                /* one full-screen triangle */
        glVertex2f(-1.0f, -1.0f);
        glVertex2f( 3.0f, -1.0f);
        glVertex2f(-1.0f,  3.0f);
        glEnd();
    }
}

/* ---- config dialog: a single brightness trackbar ------------------------- */
#define IDC_TRACK 1001
static HWND g_cfgTrack = NULL;

static LRESULT CALLBACK ConfigProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp)
{
    switch (msg) {
    case WM_COMMAND:
        if (LOWORD(wp) == IDOK) {
            DWORD pos = (DWORD)SendMessage(g_cfgTrack, TBM_GETPOS, 0, 0);
            saveBrightness(pos);
            DestroyWindow(hwnd);
        } else if (LOWORD(wp) == IDCANCEL) {
            DestroyWindow(hwnd);
        }
        return 0;
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, msg, wp, lp);
}

static void runConfig(HINSTANCE hInst)
{
    WNDCLASSA wc;
    HWND hwnd;
    MSG msg;
    int sw = GetSystemMetrics(SM_CXSCREEN), sh = GetSystemMetrics(SM_CYSCREEN);
    INITCOMMONCONTROLSEX icc;

    icc.dwSize = sizeof(icc);
    icc.dwICC  = ICC_BAR_CLASSES;
    InitCommonControlsEx(&icc);

    memset(&wc, 0, sizeof(wc));
    wc.lpfnWndProc   = ConfigProc;
    wc.hInstance     = hInst;
    wc.lpszClassName = "CoauroraConfig";
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);
    if (!RegisterClassA(&wc)) return;

    hwnd = CreateWindowExA(WS_EX_DLGMODALFRAME, wc.lpszClassName, "Coaurora settings",
                           WS_CAPTION | WS_SYSMENU | WS_VISIBLE,
                           (sw - 340) / 2, (sh - 150) / 2, 340, 150,
                           NULL, NULL, hInst, NULL);
    if (!hwnd) return;

    CreateWindowExA(0, "STATIC", "Line brightness", WS_CHILD | WS_VISIBLE,
                    16, 14, 200, 18, hwnd, NULL, hInst, NULL);

    g_cfgTrack = CreateWindowExA(0, TRACKBAR_CLASS, "", WS_CHILD | WS_VISIBLE | TBS_HORZ,
                                 16, 36, 300, 30, hwnd, (HMENU)IDC_TRACK, hInst, NULL);
    SendMessage(g_cfgTrack, TBM_SETRANGE, TRUE, MAKELONG(0, 250));   /* 0..2.5x */
    SendMessage(g_cfgTrack, TBM_SETTICFREQ, 25, 0);
    SendMessage(g_cfgTrack, TBM_SETPOS, TRUE, (LPARAM)(int)(loadBrightness() * 100.0f));

    CreateWindowExA(0, "BUTTON", "Cancel", WS_CHILD | WS_VISIBLE,
                    148, 78, 80, 26, hwnd, (HMENU)IDCANCEL, hInst, NULL);
    CreateWindowExA(0, "BUTTON", "OK", WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                    236, 78, 80, 26, hwnd, (HMENU)IDOK, hInst, NULL);

    while (GetMessage(&msg, NULL, 0, 0) > 0) {
        if (!IsDialogMessage(hwnd, &msg)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
    }
}

/* ---- entry ------------------------------------------------------------------ */
int WINAPI WinMain(HINSTANCE hInst, HINSTANCE hPrev, LPSTR cmd, int show)
{
    WNDCLASSA wc;
    HWND hwnd = NULL, parent = NULL;
    MSG msg;
    int running = 1;

    (void)hPrev; (void)show;

    g_bright = loadBrightness();          /* persisted line brightness */

    /* parse:  /s = run, /p <hwnd> = preview, /c or nothing = config */
    if (cmd && (strstr(cmd, "/p") || strstr(cmd, "/P"))) {
        const char *digits = cmd;
        while (*digits && (*digits < '0' || *digits > '9')) digits++;
        if (*digits) parent = (HWND)(UINT_PTR)_strtoui64(digits, NULL, 10);
        if (!parent) return 0;
        g_preview = 1;
    } else if (!cmd || !(strstr(cmd, "/s") || strstr(cmd, "/S"))) {
        runConfig(hInst);                 /* /c (or no args): the settings dialog */
        return 0;
    }

    memset(&wc, 0, sizeof(wc));
    wc.lpfnWndProc   = WndProc;
    wc.hInstance     = hInst;
    wc.lpszClassName = "CoauroraSaver";
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    if (!RegisterClassA(&wc)) return 0;

    if (g_preview) {
        RECT pr;
        GetClientRect(parent, &pr);
        hwnd = CreateWindowExA(0, wc.lpszClassName, "Coaurora",
                               WS_CHILD | WS_VISIBLE,
                               0, 0, pr.right, pr.bottom,
                               parent, NULL, hInst, NULL);
    } else {
        int x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        int y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        int h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        hwnd = CreateWindowExA(WS_EX_TOPMOST, wc.lpszClassName, "Coaurora",
                               WS_POPUP | WS_VISIBLE,
                               x, y, w, h, NULL, NULL, hInst, NULL);
        SetCursor(NULL);
    }
    if (!hwnd) return 0;

    if (!initGL(hwnd)) return 0;   /* no GL -> exit quietly, never crash */

    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) { running = 0; break; }
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
        if (!running) break;
        if (g_preview && !IsWindow(parent)) break;   /* settings dialog closed */
        drawFrame(hwnd);
        SwapBuffers(g_dc);
        Sleep(33);                                    /* ~30 fps */
    }

    wglMakeCurrent(NULL, NULL);
    if (g_rc) wglDeleteContext(g_rc);
    if (g_dc) ReleaseDC(hwnd, g_dc);
    return 0;
}
