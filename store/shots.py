"""Compose Chrome Web Store listing screenshots (1280x800) from the test artifacts.

Run tests/run.py first so tests/artifacts/*.png are current, then:
    python3 store/shots.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "tests" / "artifacts"
OUT = Path(__file__).resolve().parent / "screenshots"
OUT.mkdir(exist_ok=True)

SIZE = (1280, 800)
GROUND = (245, 244, 239)
INK = (29, 26, 34)
INK_2 = (74, 68, 83)
LEAD = (184, 41, 41)

DISPLAY = ROOT / "fonts" / "righteous-400.ttf"
MONO = ROOT / "fonts" / "chivo-mono-500.ttf"


def font(path, size):
    return ImageFont.truetype(str(path), size)


def fit(image, box):
    copy = image.copy()
    copy.thumbnail(box, Image.LANCZOS)
    return copy


def frame(canvas, image, position):
    box = (position[0] - 1, position[1] - 1, position[0] + image.width, position[1] + image.height)
    ImageDraw.Draw(canvas).rectangle(box, outline=(207, 202, 188), width=1)
    canvas.paste(image, position)


GUTTER = 44
TOP = 214


def shot(name, headline, kicker, panels):
    canvas = Image.new("RGB", SIZE, GROUND)
    draw = ImageDraw.Draw(canvas)
    draw.text((72, 64), kicker, font=font(MONO, 13), fill=INK_2)
    draw.text((70, 96), headline, font=font(DISPLAY, 46), fill=INK)
    draw.line((72, 176, 1208, 176), fill=(207, 202, 188), width=1)

    span = sum(image.width for image in panels) + GUTTER * (len(panels) - 1)
    x = (SIZE[0] - span) // 2
    for image in panels:
        frame(canvas, image, (x, TOP))
        x += image.width + GUTTER

    canvas.save(OUT / name)
    print("wrote", OUT / name)


popup = Image.open(ARTIFACTS / "popup.png")
control = Image.open(ARTIFACTS / "control.png")
marked = Image.open(ARTIFACTS / "marked-page.png")

shot(
    "01-page.png",
    "Every pattern, marked in place.",
    "BB://SCAN",
    [fit(marked, (620, 528)), fit(popup, (330, 528))],
)

shot(
    "02-index.png",
    "An index of what is working on you.",
    "BB://INDEX",
    [fit(popup, (300, 528)), fit(control, (740, 528))],
)

shot(
    "03-control.png",
    "Control your own mind.",
    "BB://CONTROL",
    [fit(control, (1136, 528))],
)


def promo():
    """440x280 small promo tile."""
    canvas = Image.new("RGB", (440, 280), GROUND)
    draw = ImageDraw.Draw(canvas)
    draw.text((32, 44), "BAIT", font=font(DISPLAY, 40), fill=INK)
    draw.text((32 + draw.textlength("BAIT", font=font(DISPLAY, 40)), 44),
              "BLOCKER", font=font(DISPLAY, 40), fill=LEAD)
    draw.text((33, 104), "Persuasion patterns, marked as you read.", font=font(MONO, 12), fill=INK_2)

    draw.line((32, 150, 408, 150), fill=(207, 202, 188), width=1)
    draw.ellipse((32, 178, 40, 186), fill=LEAD)
    draw.line((36, 186, 36, 214), fill=LEAD, width=1)
    draw.text((50, 176), "SCARCITY PRESSURE", font=font(MONO, 12), fill=LEAD)
    draw.text((50, 200), "ENGAGEMENT BAIT", font=font(MONO, 12), fill=INK_2)
    draw.text((50, 224), "LOADED FRAMING", font=font(MONO, 12), fill=INK_2)

    out = OUT.parent / "promo-440x280.png"
    canvas.save(out)
    print("wrote", out)


promo()
