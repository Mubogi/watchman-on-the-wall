#!/usr/bin/env bash
# Build the desktop apps: Linux AppImage + deb, and a Windows x64 portable zip.
#
# Produces (in build/):
#   watchman-on-the-wall-<v>-linux-x86_64.AppImage
#   watchman-on-the-wall-<v>-linux-amd64.deb
#   watchman-on-the-wall-<v>-windows-x64.zip
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
VERSION="$(node -p "require('./package.json').version")"

echo "==> Staging desktop bundle"
rm -rf desktop/www
mkdir -p desktop/www
cp index.html manifest.webmanifest desktop/www/
cp -r css js assets desktop/www/
# No service worker in the packaged app: the shell is already local, and a
# stale cache would survive an upgrade.
rm -f desktop/www/sw.js
python3 - <<'PY'
import pathlib
p = pathlib.Path("desktop/www/index.html")
s = p.read_text()
start = s.find("<script>\n  // PWA: register the offline shell")
if start != -1:
    end = s.find("</script>", start) + len("</script>")
    s = s[:start] + s[end:]
p.write_text(s)
print("    stripped service-worker registration")
PY

cat > desktop/electron-builder.yml <<'EOF'
appId: org.watchmanonthewall.game
productName: Watchman on the Wall
electronVersion: 31.7.7
directories:
  output: ../build/desktop
  buildResources: resources
files:
  - main.js
  - asset-path.js
  - package.json
  - www/**
asar: true
compression: maximum

linux:
  target:
    - AppImage
    - deb
  category: Game
  icon: www/assets/icons/icon-512.png
  desktop:
    Name: Watchman on the Wall
    Comment: A game of community care, intercession and spiritual watchfulness
    Categories: Game;Simulation;
  maintainer: Mubogi
  synopsis: Community care and spiritual watchfulness

win:
  target:
    - target: dir
      arch: [x64]
  icon: www/assets/icons/icon-512.png
EOF

echo "==> Building desktop packages (this downloads Electron runtimes)"
cd desktop
# electron-builder's Windows step shells out to wine/rcedit to rewrite exe
# metadata. That is unavailable here, but it has already produced a complete
# win-unpacked tree by then, so a non-zero exit is tolerated.
npx electron-builder --linux AppImage --win dir --x64 --publish never 2>&1 | tail -12 || true
cd "$ROOT"

echo "==> Packaging Windows portable zip"
python3 - <<'PYZ'
import os, shutil, zipfile
src = "build/desktop/win-unpacked"
out = "build/watchman-on-the-wall-%s-windows-x64.zip" % os.environ["VERSION"]
if os.path.isdir(src):
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for root, _dirs, files in os.walk(src):
            for f in files:
                full = os.path.join(root, f)
                arc = os.path.join("WatchmanOnTheWall", os.path.relpath(full, src))
                z.write(full, arc)
    print("    %s (%.1f MB)" % (os.path.basename(out), os.path.getsize(out) / 1e6))
else:
    print("    ! win-unpacked missing, skipping Windows zip")
PYZ

echo "==> Packaging .deb with dpkg-deb"
python3 - <<'PYD'
import os, shutil, pathlib
src = "build/desktop/linux-unpacked"
if not os.path.isdir(src):
    raise SystemExit("linux-unpacked missing")
ver = os.environ["VERSION"]
stage = pathlib.Path("build/deb-stage")
if stage.exists():
    shutil.rmtree(stage)
opt = stage / "opt" / "watchman-on-the-wall"
shutil.copytree(src, opt)
(stage / "DEBIAN").mkdir(parents=True)
(stage / "usr/share/applications").mkdir(parents=True)
(stage / "usr/share/icons/hicolor/512x512/apps").mkdir(parents=True)
(stage / "usr/bin").mkdir(parents=True, exist_ok=True)

(stage / "usr/share/applications/watchman-on-the-wall.desktop").write_text(
    "[Desktop Entry]\n"
    "Type=Application\n"
    "Name=Watchman on the Wall\n"
    "Comment=A game of community care, intercession and spiritual watchfulness\n"
    "Exec=/opt/watchman-on-the-wall/watchman-on-the-wall %U\n"
    "Icon=watchman-on-the-wall\n"
    "Terminal=false\n"
    "Categories=Game;Simulation;\n"
)
shutil.copyfile("assets/icons/icon-512.png",
                stage / "usr/share/icons/hicolor/512x512/apps/watchman-on-the-wall.png")
os.symlink("/opt/watchman-on-the-wall/watchman-on-the-wall",
           stage / "usr/bin/watchman-on-the-wall")

size = sum(f.stat().st_size for f in opt.rglob("*") if f.is_file()) // 1024
(stage / "DEBIAN/control").write_text(
    "Package: watchman-on-the-wall\n"
    f"Version: {ver}\n"
    "Section: games\n"
    "Priority: optional\n"
    "Architecture: amd64\n"
    "Maintainer: Mubogi <noreply@github.com>\n"
    "Installed-Size: %d\n" % size +
    "Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0\n"
    "Description: Community care and spiritual watchfulness\n"
    " A game of community care, intercession and spiritual watchfulness.\n"
)
# dpkg-deb rejects setgid/loose permissions on the control dir.
# The workspace inherits setgid; dpkg-deb refuses it on the control dir.
os.system("chmod -R g-s '%s'" % stage)
os.system("chmod 0755 '%s/DEBIAN'" % stage)
os.system("chmod -R 0755 '%s/opt/watchman-on-the-wall'" % stage)
os.system("chmod 0644 '%s/usr/share/applications/watchman-on-the-wall.desktop'" % stage)
out = f"build/watchman-on-the-wall-{ver}-linux-amd64.deb"
rc = os.system(f"dpkg-deb --build --root-owner-group '{stage}' '{out}' > /dev/null")
if rc == 0:
    print("    %s (%.1f MB)" % (os.path.basename(out), os.path.getsize(out) / 1e6))
else:
    print("    ! dpkg-deb failed")
PYD
cd "$ROOT"

echo "==> Renaming artifacts"
mkdir -p build
shopt -s nullglob
for f in build/desktop/*.AppImage; do
  new="watchman-on-the-wall-${VERSION}-linux-x86_64.AppImage"
  cp "$f" "build/$new"
  echo "    $new ($(du -h "$f" | cut -f1))"
done
