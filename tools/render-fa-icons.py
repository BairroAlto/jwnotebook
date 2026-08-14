"""Render FontAwesome glyphs with the shared Conexoes visual base."""

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
    parser.add_argument("--font-dir", type=Path, required=True)
    parser.add_argument("--map", type=Path, required=True)
    parser.add_argument("--anchor", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def load_codepoints(css_path: Path) -> dict[str, int]:
    css = css_path.read_text(encoding="utf-8")
    codepoints: dict[str, int] = {}
    for match in re.finditer(r"([^{}]+)\{content:\"\\([0-9a-f]+)\"\}", css):
        selectors, code = match.groups()
        for name in re.findall(r"\.fa-([a-z0-9-]+)(?::before|::before)", selectors):
            codepoints[name] = int(code, 16)
    return codepoints


def build_shared_base(anchor_path: Path) -> Image.Image:
    anchor = Image.open(anchor_path).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    source = anchor.load()
    base = Image.new("RGBA", (SIZE, SIZE), (*BACKGROUND, 255))

    # Keep the lower platform from the reference and remove its original symbol.
    platform = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    target = platform.load()
    for y in range(620, 1090):
        for x in range(SIZE):
            r, g, b = source[x, y]
            delta = max(r - BACKGROUND[0], g - BACKGROUND[1], b - BACKGROUND[2])
            alpha = max(0, min(255, int((delta - 1) * 12)))
            if alpha:
                target[x, y] = (r, g, b, alpha)
    base.alpha_composite(platform)
    return base


def render_mask(font_path: Path, codepoint: int) -> Image.Image:
    font_size = 720
    font = ImageFont.truetype(str(font_path), font_size)
    char = chr(codepoint)
    bbox = font.getbbox(char)
    width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
    scale = min(700 / max(width, 1), 560 / max(height, 1))
    font = ImageFont.truetype(str(font_path), max(80, int(font_size * scale)))
    bbox = font.getbbox(char)
    width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]

    mask = Image.new("L", (SIZE, SIZE), 0)
    draw = ImageDraw.Draw(mask)
    x = (SIZE - width) // 2 - bbox[0]
    y = 155 + (560 - height) // 2 - bbox[1]
    draw.text((x, y), char, font=font, fill=255)
    return mask


def gradient_fill(mask: Image.Image) -> Image.Image:
    gradient = Image.new("RGBA", (1, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(gradient)
    for y in range(SIZE):
        t = max(0.0, min(1.0, (y - 170) / 570))
        draw.point((0, y), fill=(int(175 * (1 - t) + 35 * t), int(191 * (1 - t) + 53 * t), int(255 * (1 - t) + 145 * t), 255))
    fill = gradient.resize((SIZE, SIZE))
    fill.putalpha(mask)
    return fill


def render_icon(shared_base: Image.Image, mask: Image.Image) -> Image.Image:
    result = shared_base.copy()

    glow = mask.filter(ImageFilter.GaussianBlur(28))
    blue_glow = Image.new("RGBA", (SIZE, SIZE), (44, 89, 255, 0))
    blue_glow.putalpha(glow.point(lambda value: int(value * 0.38)))
    result.alpha_composite(blue_glow)

    stroke = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(17)), mask)
    warm_edge = Image.new("RGBA", (SIZE, SIZE), (255, 202, 157, 0))
    warm_edge.putalpha(stroke.point(lambda value: int(value * 0.9)))
    result.alpha_composite(warm_edge)
    result.alpha_composite(gradient_fill(mask))

    highlight = ImageChops.subtract(ImageChops.offset(mask, 0, -5), mask)
    highlight_layer = Image.new("RGBA", (SIZE, SIZE), (255, 231, 205, 0))
    highlight_layer.putalpha(highlight.point(lambda value: int(value * 0.75)))
    result.alpha_composite(highlight_layer)
    return result.convert("RGB")


def main() -> None:
    args = parse_args()
    icon_map = json.loads(args.map.read_text(encoding="utf-8"))
    codepoints = load_codepoints(args.font_dir / "all.min.css")
    shared_base = build_shared_base(args.anchor)
    args.output.mkdir(parents=True, exist_ok=True)

    for relative, (family, name) in icon_map.items():
        if name not in codepoints:
            raise SystemExit(f"FontAwesome glyph not found: {family}/{name}")
        font = args.font_dir / ("fa-solid-900.ttf" if family == "solid" else "fa-brands-400.ttf")
        destination = args.output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        render_icon(shared_base, render_mask(font, codepoints[name])).save(destination, "PNG", optimize=True)
        print(destination)


if __name__ == "__main__":
    main()
