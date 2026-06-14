# Coaurora — Android live wallpaper

The Store-comonad aurora as a live wallpaper for the **home and lock screen**
(Samsung One UI and stock Android), with a settings screen whose sliders apply
**live**: speed, tilt, thickness, brightness, hue band, curtain count, fps.

Prebuilt APKs land on the
[releases page](https://github.com/jagajaga/coaurora/releases) — CI builds them
from this branch when a `wallpaper-v*` tag is pushed.

## Install & set on the lock screen

1. Download `Coaurora.apk` from a release, open it on the phone
   (allow "install from this source" if asked — it's a sideload).
2. Open the **Coaurora** app → tweak the sliders → **Set as wallpaper**.
3. Samsung asks where: pick **Lock screen** or **Home and lock screens**.

Settings can be changed any time — from the app, or via the gear/Customise
button in Samsung's wallpaper preview. Changes apply immediately, no re-apply
needed.

## How it works

- `CoauroraWallpaperService` — a `WallpaperService` hosting a `GLSurfaceView`
  (the classic holder-override trick). OpenGL ES 2.0; the fragment shader is
  the web library's GLSL near-verbatim, curtain count baked at compile time
  (recompiled live when the slider moves).
- Rendering is fps-capped (15/30/60, default 30) and **fully paused whenever
  the wallpaper is not visible** — screen off, app in front, AOD — so the
  battery cost is limited to the moments you're actually looking at it.
- Temporal TPDF blue-noise dither, same as everywhere else in coaurora —
  band-free gradients on the phone's OLED.
- Zero dependencies; pure framework APIs; the settings UI is built in code.

## Build from source

CI does this on every push to the branch, but locally (with an Android SDK):

```bash
cd android
gradle assembleRelease     # or ./gradlew if you have a wrapper installed
# → app/build/outputs/apk/release/app-release.apk
```

`keystore.p12` is a committed sideload-only signing key (password `coaurora`).
That's deliberate: it keeps release APKs upgrade-compatible with each other.
It is, obviously, not a Play Store key.

## Cutting a release

```bash
git tag wallpaper-v0.1.0 && git push origin wallpaper-v0.1.0
```
