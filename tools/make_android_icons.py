"""Generate Android launcher icons at every density from the master icon.

Android needs legacy square icons plus adaptive-icon foregrounds. The
foreground must keep its art inside the centre 66% safe zone because the
launcher applies its own mask and parallax.
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "icons", "icon-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}


def main():
    if not os.path.isdir(RES):
        raise SystemExit("Run `npx cap add android` first: no android/ project found")

    master = Image.open(SRC).convert("RGBA")
    # Adaptive foreground: 108dp canvas, art must sit in the middle 72dp.
    for name, size in DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{name}")
        os.makedirs(d, exist_ok=True)

        # Legacy launcher icon (rounded by the OS on older versions).
        master.resize((size, size), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
        master.resize((size, size), Image.LANCZOS).save(os.path.join(d, "ic_launcher_round.png"))

        # Adaptive foreground: scale art to 66% inside a transparent canvas.
        fg_size = int(size * 108 / 48)
        fg = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
        inner = int(fg_size * 0.66)
        art = master.resize((inner, inner), Image.LANCZOS)
        off = (fg_size - inner) // 2
        fg.paste(art, (off, off), art)
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))

        # Solid background layer matching the icon's night field.
        bg = Image.new("RGBA", (fg_size, fg_size), (12, 17, 32, 255))
        bg.save(os.path.join(d, "ic_launcher_background.png"))

    # Adaptive icon descriptor (API 26+).
    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(anydpi, name), "w") as f:
            f.write(xml)

    # Splash screen art.
    for name, size in DENSITIES.items():
        d = os.path.join(RES, f"drawable-{name}")
        os.makedirs(d, exist_ok=True)
        master.resize((int(size * 4), int(size * 4)), Image.LANCZOS).save(
            os.path.join(d, "splash.png")
        )

    print("android icons generated for", ", ".join(DENSITIES))


if __name__ == "__main__":
    main()
