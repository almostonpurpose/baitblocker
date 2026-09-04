"""Chrome Web Store icon: 128x128 with the graphic inside a 96x96 area.

Google's store-icon guidance asks for roughly 16px of padding on each side, which the
extension's own toolbar icons deliberately do not have (those should fill their box).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent
GROUND = (245, 244, 239, 255)


def store_icon(source, name, pad=16, ground=None):
    art = Image.open(source).convert("RGBA")
    inner = 128 - pad * 2
    art.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (128, 128), ground or (0, 0, 0, 0))
    canvas.paste(art, ((128 - art.width) // 2, (128 - art.height) // 2), art)
    canvas.save(OUT / name)
    print(f"wrote {name}  graphic {art.size} inside 128x128")


# Option A: the mark currently shipping in the manifest.
store_icon(ROOT / "icons" / "baitblocker-128.png", "store-icon-monogram.png")

# Option B: the hook concept, trimmed to its own content first so the padding is even.
hook = Image.open(ROOT / "icons" / "baitblocker-hook-concept-preview.png").convert("RGBA")
hook = hook.crop(hook.getbbox())
tmp = OUT / ".hook-trimmed.png"
hook.save(tmp)
store_icon(tmp, "store-icon-hook.png")
store_icon(tmp, "store-icon-hook-on-paper.png", ground=GROUND)
tmp.unlink()
