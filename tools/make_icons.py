"""Generate app icons (PWA + Android) as PNGs, drawn procedurally.

A watchtower silhouette with a burning brazier on a deep night field.
Run: python3 tools/make_icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "icons")
os.makedirs(OUT, exist_ok=True)

GOLD = (232, 191, 118)
GOLD_DEEP = (185, 140, 62)
AMBER = (240, 161, 90)
NIGHT_TOP = (18, 26, 46)
NIGHT_BOT = (8, 11, 20)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw_icon(size, padding_ratio=0.0, rounded=True):
    """Render one icon. padding_ratio insets the art for maskable safe zones."""
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    # Night gradient inside a rounded square.
    grad = Image.new("RGB", (1, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        gd.point((0, y), lerp(NIGHT_TOP, NIGHT_BOT, y / S))
    grad = grad.resize((S, S))
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if rounded:
        md.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    else:
        md.rectangle([0, 0, S - 1, S - 1], fill=255)
    img.paste(grad, (0, 0), mask)

    pad = S * padding_ratio
    art = S - pad * 2
    cx = S / 2

    def X(u):
        return pad + art * u

    def Y(v):
        return pad + art * v

    # Warm glow behind the tower.
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gcx, gcy = cx, Y(0.30)
    for i in range(26, 0, -1):
        r = art * 0.055 * i
        a = int(8 * (1 - i / 26) ** 1.4)
        gd.ellipse([gcx - r, gcy - r, gcx + r, gcy + r], fill=(*AMBER, a))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.012))
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)

    top_w, bot_w = art * 0.26, art * 0.40
    top_y, bot_y = Y(0.30), Y(0.82)

    d.polygon(
        [
            (cx - top_w / 2, top_y),
            (cx + top_w / 2, top_y),
            (cx + bot_w / 2, bot_y),
            (cx - bot_w / 2, bot_y),
        ],
        fill=(58, 52, 44),
    )
    # Right face catches less light.
    d.polygon(
        [(cx, top_y), (cx + top_w / 2, top_y), (cx + bot_w / 2, bot_y), (cx, bot_y)],
        fill=(74, 66, 55),
    )

    # Crenellations.
    n = 4
    for i in range(n):
        t0 = i / n + 0.06 / n
        t1 = (i + 0.62) / n
        x0 = cx - top_w / 2 + top_w * t0
        x1 = cx - top_w / 2 + top_w * t1
        d.rectangle([x0, top_y - art * 0.055, x1, top_y + 1], fill=(70, 63, 52))

    # Lit window slits.
    for v, w in ((0.44, 0.055), (0.60, 0.05)):
        ww = art * w
        d.rounded_rectangle(
            [cx - ww / 2, Y(v), cx + ww / 2, Y(v) + art * 0.075],
            radius=ww * 0.45,
            fill=(255, 206, 132),
        )

    # Doorway glow.
    dw = art * 0.10
    d.rounded_rectangle(
        [cx - dw / 2, Y(0.73), cx + dw / 2, Y(0.82)],
        radius=dw * 0.5,
        fill=(255, 186, 106),
    )

    # Brazier + flame.
    bx, by = cx, top_y - art * 0.085
    d.ellipse(
        [bx - art * 0.075, by - art * 0.022, bx + art * 0.075, by + art * 0.03],
        fill=(45, 42, 36),
    )
    d.rectangle([bx - art * 0.012, by - art * 0.05, bx + art * 0.012, by], fill=(56, 52, 44))

    fy = by - art * 0.045
    for scale, colour in ((1.0, (*AMBER, 235)), (0.62, (255, 224, 168, 245))):
        h = art * 0.115 * scale
        w = art * 0.062 * scale
        d.polygon(
            [
                (bx - w, fy),
                (bx - w * 0.55, fy - h * 0.62),
                (bx, fy - h),
                (bx + w * 0.55, fy - h * 0.62),
                (bx + w, fy),
            ],
            fill=colour,
        )

    # Gold rim light on the lit edge.
    d.line(
        [(cx - top_w / 2, top_y), (cx - bot_w / 2, bot_y)],
        fill=(*GOLD, 150),
        width=max(1, int(art * 0.008)),
    )
    d.arc(
        [cx - bot_w * 0.85, bot_y - art * 0.06, cx + bot_w * 0.85, bot_y + art * 0.06],
        start=8,
        end=172,
        fill=(*GOLD_DEEP, 110),
        width=max(1, int(art * 0.011)),
    )

    return img.resize((size, size), Image.LANCZOS)


def main():
    for s in (192, 256, 384, 512):
        draw_icon(s).save(os.path.join(OUT, f"icon-{s}.png"))
        print(f"icon-{s}.png")

    for s in (192, 512):
        draw_icon(s, padding_ratio=0.14).save(os.path.join(OUT, f"maskable-{s}.png"))
        print(f"maskable-{s}.png")

    # iOS applies its own corner radius.
    draw_icon(180, rounded=False).save(os.path.join(OUT, "apple-touch-icon.png"))
    print("apple-touch-icon.png")

    draw_icon(32).save(os.path.join(OUT, "favicon-32.png"))
    print("favicon-32.png")

    card = Image.new("RGB", (1200, 630), NIGHT_BOT)
    icon = draw_icon(360)
    card.paste(icon, (90, 135), icon)
    card.save(os.path.join(OUT, "social-card.png"))
    print("social-card.png")


if __name__ == "__main__":
    main()
