# Coaurora — macOS screensaver

The same Store-comonad aurora, as a native macOS screensaver — Swift + Metal,
at **maximum bit depth**: the shader renders into an `rgba16Float` drawable
with an extended-sRGB colorspace, so macOS composites the un-quantized float
image and capable displays (MacBook Pro XDR, Studio Display, most 10-bit
panels) get a true high-bit-depth path. No 8-bit banding at the source —
the thing browsers wouldn't let the web version do.

A 10-bit-amplitude temporal TPDF dither guards the final panel quantization;
at 1/1023 it is invisible.

## Build & install (on the Mac)

Requires the Xcode Command Line Tools (`xcode-select --install`) — no Xcode app needed.

```bash
git clone -b screensaver https://github.com/jagajaga/coaurora
cd coaurora/screensaver
make install
```

Then **System Settings → Screen Saver → Coaurora** (under "Other").
If System Settings was already open, quit and reopen it to refresh the list.

`make uninstall` removes it.

Notes:
- Built locally, ad-hoc signed — no Gatekeeper friction since there is no
  quarantine attribute on files you compile yourself.
- 30 fps cap (`fps` constant in `CoauroraSaver.swift`); the drift is slow,
  more would only warm the room.
- Multi-display works: macOS instantiates one view per screen.

## The 5-minute alternative (no compiling)

[WebViewScreenSaver](https://github.com/liquidx/webviewscreensaver) renders any
URL as a screensaver:

```bash
brew install --cask webviewscreensaver
```

System Settings → Screen Saver → WebViewScreenSaver → **Options…** → set the URL to:

```
https://jagajaga.me/coaurora/screensaver.html
```

(That page is the bare fullscreen aurora — no UI, hidden cursor.) Caveats: needs
network, and it renders through the browser's 8-bit pipeline — the native saver
above is the maximum-bits one.
