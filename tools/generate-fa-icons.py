"""Render the site's original FontAwesome glyphs with the shared Conexoes base."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


SIZE = 1254
BACKGROUND = (3, 11, 28)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--font-dir", type=Path, required=True)
    parser.add_argument("--map", type=Path, required=True)
    parser.add_argument("--anchor", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def load_codepoints(css_path: Path) -> dict[str, int]:
    css = css_path.read_text(encoding="utf-8")
    pattern = re.compile(r"\.fa-([a-z0-9-]+):before\{content:\"\\([0-9a-f]+)\"\}")
    return {name: int(code, 16) for name, code in pattern.findall(css)}


def common_base(anchor_path: Path) -> Image.Image:
    anchor = Image.open(anchor_path).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    pixels = anchor.load()
    clean = Image.new("RGB", (SIZE, SIZE), BACKGROUND)

    # Preserve the exact lower platform while removing the original central symbol.
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    base_pixels = base.load()
    for y in range(620, 1090):
        for x in range(SIZE):
            r, g, b = pixels[x, y]
            delta = max(r - BACKGROUND[0], g - BACKGROUND[1], b - BACKGROUND[2])
            alpha = max(0, min(255, int((delta - 1) * 12)))
            if alpha:
                base_pixels[x, y] = (r, g, b, alpha)

    # A subtle vignette keeps the new canvases in the same dark family.
    vignette = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(vignette)
    draw.ellipse((-180, -180, SIZE + 180, SIZE + 180), fill=32)
    vignette = vignette.filter(ImageFilter.GaussianBlur(240))
    clean = Image.composite(Image.new("RGB", (SIZE, SIZE), (5, 14, 34)), clean, vignette)
    clean = clean.convert("RGBA")
    clean.alpha_composite(base)
    return clean


def glyph_mask(font_path: Path, codepoint: int) -> Image.Image:
    char = chr(codepoint)
    size = 720
    font = ImageFont.truetype(str(font_path), size)
    bbox = font.getbbox(char, stroke_width=0)
    width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
    scale = min(700 / max(width, 1), 560 / max(height, 1))
    font = ImageFont.truetype(str(font_path), max(80, int(size * scale)))
    bbox = font.getbbox(char, stroke_width=0)
    width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    x = (SIZE - width) // 2 - bbox[0]
    y = 155 + (560 - height) // 2 - bbox[1]
    draw.text((x, y), char, font=font, fill=255)
    return mask


def render_icon(base: Image.Image, mask: Image.Image) -> Image.Image:
    result = base.copy()
    glow = mask.filter(ImageFilter.GaussianBlur(28))
    blue_glow = Image.new("RGBA", (SIZE, SIZE), (44, 89, 255, 0))
    blue_glow.putalpha(glow.point(lambda value: int(value * 0.38)))
    result.alpha_composite(blue_glow)

    expanded = mask.filter(ImageFilter.MaxFilter(17))
    stroke = ImageChops.subtract(expanded, mask)
    warm_edge = Image.new("RGBA", (SIZE, SIZE), (255, 202, 157, 0))
    warm_edge.putalpha(stroke.point(lambda value: int(value * 0.9)))
    result.alpha_composite(warm_edge)

    fill = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fill_pixels = fill.load()
    for y in range(SIZE):
        t = max(0.0, min(1.0, (y - 170) / 570))
        r = int(175 * (1 - t) + 35 * t)
        g = int(191 * (1 - t) + 53 * t)
        b = int(255 * (1 - t) + 145 * t)
        for x in range(SIZE):
            fill_pixels[x, y] = (r, g, b, 255)
    fill.putalpha(mask)
    result.alpha_composite(fill)

    highlight = ImageChops.offset(mask, 0, -5)
    highlight = ImageChops.subtract(highlight, mask)
    highlight_layer = Image.new("RGBA", (SIZE, SIZE), (255, 231, 205, 0))
    highlight_layer.putalpha(highlight.point(lambda value: int(value * 0.75)))
    result.alpha_composite(highlight_layer)
    return result.convert("RGB")


def main() -> None:
    args = parse_args()
    icon_map = json.loads(args.map.read_text(encoding="utf-8"))
    codepoints = load_codepoints(args.font_dir / "all.min.css")
    base = common_base(args.anchor)
    args.output.mkdir(parents=True, exist_ok=True)

    for relative, (family, name) in icon_map.items():
        codepoint = codepoints.get(name)
        if codepoint is None:
            raise SystemExit(f"FontAwesome glyph not found: {family}/{name}")
        font_name = "fa-solid-900.ttf" if family == "solid" else "fa-brands-400.ttf"
        mask = glyph_mask(args.font_dir / font_name, codepoint)
        destination = args.output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        render_icon(base, mask).save(destination, format="PNG", optimize=True)
        print(destination)


if __name__ == "__main__":
    main()
