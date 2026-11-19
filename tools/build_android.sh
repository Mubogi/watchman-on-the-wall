#!/usr/bin/env bash
# Build a signed release APK for Watchman on the Wall.
#
# Produces: build/watchman-on-the-wall-<version>.apk
# Requires: JDK 17, Android SDK (platform 34, build-tools 34.0.0).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/workspace/sdk/jdk-17.0.21.1+2}"
export ANDROID_HOME="${ANDROID_HOME:-/workspace/sdk/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
VERSION="$(node -p "require('./package.json').version")"

echo "==> Assembling web bundle into www/"
rm -rf www
mkdir -p www
cp index.html manifest.webmanifest sw.js www/
cp -r css js assets www/
# The service worker is for the browser build; inside the APK the shell is
# already local, and a stale cache would survive app updates.
rm -f www/sw.js
python3 - <<'PY'
import re, pathlib
p = pathlib.Path("www/index.html")
s = p.read_text()
s = s.replace(
    '<script>\n  // PWA: register the offline shell. Failures are non-fatal — the game runs\n  // fine from the network alone.\n  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {\n    window.addEventListener("load", () => {\n      navigator.serviceWorker.register("sw.js").catch(() => {});\n    });\n  }\n</script>',
    ""
)
p.write_text(s)
print("    stripped service-worker registration from bundled index.html")
PY

echo "==> Generating Android project"
if [ ! -d android ]; then
  npx cap add android >/dev/null
fi
npx cap sync android >/dev/null

echo "==> Generating launcher icons from assets/icons/icon-512.png"
python3 tools/make_android_icons.py

echo "==> Setting version ${VERSION} in build.gradle"
python3 - <<PYV
import pathlib, re
p = pathlib.Path("android/app/build.gradle")
s = p.read_text()
code = int("".join(ch for ch in "${VERSION}".split(".")[0:2] for ch in ch if ch.isdigit()) or "1")
s = re.sub(r"versionCode \\d+", f"versionCode {code}", s, count=1)
s = re.sub(r'versionName "[^"]*"', f'versionName "${VERSION}"', s, count=1)
p.write_text(s)
print(f"    versionCode {code}, versionName ${VERSION}")
PYV

echo "==> Configuring Gradle for release signing"
KEYSTORE="$ROOT/build/watchman-release.jks"
KEYSTORE_PASS="watchman-release-2024"
KEY_ALIAS="watchman"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$ROOT/build"
  "$JAVA_HOME/bin/keytool" -genkeypair -v \
    -keystore "$KEYSTORE" -storetype JKS \
    -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10950 \
    -dname "CN=Watchman on the Wall, OU=Games, O=Watchman, L=, S=, C=US" >/dev/null 2>&1
  echo "    created release keystore"
fi

cat > android/keystore.properties <<EOF
storeFile=$KEYSTORE
storePassword=$KEYSTORE_PASS
keyAlias=$KEY_ALIAS
keyPassword=$KEYSTORE_PASS
EOF

# Inject the signing config into app/build.gradle exactly once.
python3 - <<'PY'
import pathlib
p = pathlib.Path("android/app/build.gradle")
s = p.read_text()
if "watchmanSigning" not in s:
    s = s.replace(
        "android {",
        """def keystorePropsFile = rootProject.file("keystore.properties")
def keystoreProps = new Properties()
if (keystorePropsFile.exists()) {
    keystoreProps.load(new FileInputStream(keystorePropsFile))
}

android {""",
        1,
    )
    s = s.replace(
        "    buildTypes {",
        """    signingConfigs {
        watchmanSigning {
            if (keystorePropsFile.exists()) {
                storeFile file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
    buildTypes {""",
        1,
    )
    s = s.replace(
        """        release {
            minifyEnabled false""",
        """        release {
            signingConfig signingConfigs.watchmanSigning
            minifyEnabled false""",
        1,
    )
    p.write_text(s)
    print("    injected signing config")
PY

echo "==> Building release APK"
cd android
./gradlew assembleRelease --no-daemon -q 2>&1 | tail -20 || {
  echo "Gradle failed; re-running with full output" >&2
  ./gradlew assembleRelease --no-daemon 2>&1 | tail -60
  exit 1
}
cd "$ROOT"

APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
mkdir -p build
OUT="build/watchman-on-the-wall-${VERSION}.apk"
cp "$APK_SRC" "$OUT"

echo "==> Verifying signature"
"$ANDROID_HOME/build-tools/34.0.0/apksigner" verify --print-certs "$OUT" | head -4

echo
echo "APK ready: $OUT ($(du -h "$OUT" | cut -f1))"
