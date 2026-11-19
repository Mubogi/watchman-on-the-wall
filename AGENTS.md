# Watchman on the Wall — repo notes

Isometric community-care game. Plain HTML/CSS/JS with ES modules on an HTML5 Canvas,
wrapped for Android (Capacitor) and Windows/Linux (Electron). No framework, no build
step for the web build.

## Layout

- `index.html`, `css/`, `js/` — the game itself (source of truth)
- `assets/` — icons, splash art
- `sw.js`, `manifest.webmanifest` — PWA install + offline
- `download.html` — platform-aware download landing page
- `android/` — Capacitor project (generated; `www/` inside it is a build copy)
- `desktop/` — Electron shell (`main.js`, `asset-path.js`)
- `tools/build_android.sh`, `tools/build_desktop.sh` — package builds
- `build/` — build output, gitignored

## Build

```bash
npm run build:android   # needs JDK 17 + Android SDK 34 (ANDROID_HOME)
npm run build:desktop   # Electron; no extra tooling
```

Generated copies (`www/`, `desktop/www/`, `desktop/electron-builder.yml`,
`build/`) are gitignored. Edit the root `js/`/`css/`, never the staged copies.

## Gotchas worth remembering

- **ES modules do not load over `file://`.** Chromium blocks module scripts with a CORS
  error, which leaves a blank window. The Electron shell therefore serves the bundle
  from a privileged `app://` scheme via `protocol.handle` + `net.fetch`, and loads
  `app://bundle/index.html`. Any new desktop entry point must do the same.
  `desktop/asset-path.js` holds the path-containment logic and is unit-testable
  without booting Electron.
- **`electron-builder` needs `electronVersion` pinned** to the hoisted
  `node_modules/electron`, otherwise it tries to download its own runtime.
- **Windows packaging on Linux** fails at the rcedit/wine step. `build_desktop.sh`
  tolerates the non-zero exit and zips `win-unpacked` manually.
- **`.deb` is built with `dpkg-deb`**, not fpm, and the staging dir needs
  `chmod -R g-s` or dpkg rejects the permissions.
- **Gradle builds hang under job control.** Run with
  `setsid … < /dev/null & disown` or the process gets SIGSTOPped.
- **The release keystore (`build/watchman-release.jks`) is never committed.** Losing it
  means future APKs cannot upgrade existing installs.

## Verifying without a device

No `/dev/kvm`, so the Android emulator cannot boot, and Electron segfaults in this
container (no X server, no dbus). Instead:

- Extract the APK's `assets/public/*` and serve it, then drive it with Playwright at a
  phone viewport. This exercises the real shipped web bundle.
- Serve `desktop/www` over HTTP to confirm the module-loading path that `app://` uses.
- Check the packaged `app.asar` with `npx @electron/asar extract-file` to confirm the
  fix actually shipped inside the binary.

## Version

`1.1.0`. Bumping it means updating `package.json`, `desktop/package.json`,
`android/app/build.gradle` (versionName/versionCode), then rebuilding and re-uploading
release assets. Keep the checksums in the release notes in sync.
