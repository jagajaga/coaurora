# Coaurora — desktop screensavers

The same Store-comonad aurora, as native screensavers for **macOS** and
**Windows**. Prebuilt binaries land on the
[releases page](https://github.com/jagajaga/coaurora/releases) (built by CI
from this branch whenever a `saver-v*` tag is pushed).

| | macOS (`macos/`) | Windows (`windows/`) |
|---|---|---|
| Tech | Swift + Metal | C + Win32 + OpenGL |
| Shader | MSL port | the web GLSL, near-verbatim |
| Bit depth | **rgba16Float + extended sRGB → true 10-bit+** on capable panels | 8-bit + temporal TPDF dither (band-free) |
| Build | `make install` (CLT only, no Xcode app) | `make` (MinGW, cross-compiles from Linux) |

## macOS

```bash
cd screensaver/macos
make install        # builds Coaurora.saver and installs to ~/Library/Screen Savers
```

System Settings → Screen Saver → **Coaurora** (under "Other"). Reopen System
Settings if it was already running. `make uninstall` removes it.

Why the bit-depth note: the saver renders into an `rgba16Float` drawable with an
extended-sRGB colorspace, so macOS composites the un-quantized float image —
on XDR/10-bit panels that's a genuinely deeper path than any browser allows.
A 1/1023-amplitude temporal TPDF dither guards the final panel quantization.

## Windows

From a release: download `Coaurora.scr` → right-click → **Install**.

From source (MinGW, works cross from Linux too):

```bash
cd screensaver/windows
make                # or: make CC=gcc   on Windows itself
```

Implements the full `.scr` protocol: `/s` fullscreen (spans all monitors),
`/p <hwnd>` settings preview, `/c` about box. Exits on key/click/mouse-move.

## Cutting a release

```bash
git tag saver-v0.1.0 && git push origin saver-v0.1.0
```

CI builds both platforms and attaches `Coaurora.saver.zip` + `Coaurora.scr`
to a GitHub Release automatically.

## The 5-minute web alternative (macOS)

[WebViewScreenSaver](https://github.com/liquidx/webviewscreensaver)
(`brew install --cask webviewscreensaver`) pointed at:

```
https://jagajaga.me/coaurora/screensaver.html
```

Needs network and rides the browser's 8-bit pipeline — the native savers above
are the real thing.
