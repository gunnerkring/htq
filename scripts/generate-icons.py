#!/usr/bin/env python3

from pathlib import Path
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = ROOT / "build"
PNG_PATH = BUILD_DIR / "icon.png"
ICO_PATH = BUILD_DIR / "icon.ico"
ICNS_PATH = BUILD_DIR / "icon.icns"

CANVAS_SIZE = 1024
BACKGROUND = "#23384C"
PANEL = "#F4EEDD"
ACCENT = "#AA8E4A"
TEXT = "#23384C"


def pick_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
  candidates = [
    "/System/Library/Fonts/Supplemental/Avenir Next Demi Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ]

  for candidate in candidates:
    path = Path(candidate)
    if path.exists():
      return ImageFont.truetype(str(path), size=size)

  return ImageFont.load_default()


def build_master_icon() -> Image.Image:
  image = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
  draw = ImageDraw.Draw(image)

  outer_margin = 56
  inner_margin = 112

  draw.rounded_rectangle(
    (outer_margin, outer_margin, CANVAS_SIZE - outer_margin, CANVAS_SIZE - outer_margin),
    radius=220,
    fill=BACKGROUND,
  )
  draw.rounded_rectangle(
    (inner_margin, inner_margin, CANVAS_SIZE - inner_margin, CANVAS_SIZE - inner_margin),
    radius=180,
    fill=PANEL,
  )

  draw.rounded_rectangle(
    (inner_margin + 120, CANVAS_SIZE - 296, CANVAS_SIZE - inner_margin - 120, CANVAS_SIZE - 240),
    radius=28,
    fill=ACCENT,
  )

  font = pick_font(320)
  text = "HTQ"
  text_box = draw.textbbox((0, 0), text, font=font)
  text_width = text_box[2] - text_box[0]
  text_height = text_box[3] - text_box[1]
  text_x = (CANVAS_SIZE - text_width) / 2
  text_y = (CANVAS_SIZE - text_height) / 2 - 52

  draw.text((text_x, text_y), text, fill=TEXT, font=font)

  return image


def write_iconset(image: Image.Image) -> None:
  sizes = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
  ]

  with tempfile.TemporaryDirectory() as temp_dir:
    iconset_dir = Path(temp_dir) / "icon.iconset"
    iconset_dir.mkdir(parents=True, exist_ok=True)

    for file_name, size in sizes:
      resized = image.resize((size, size), Image.Resampling.LANCZOS)
      resized.save(iconset_dir / file_name)

    subprocess.run(
      ["iconutil", "-c", "icns", str(iconset_dir), "-o", str(ICNS_PATH)],
      check=True,
    )


def main() -> None:
  BUILD_DIR.mkdir(parents=True, exist_ok=True)
  image = build_master_icon()
  image.save(PNG_PATH)
  image.save(
    ICO_PATH,
    format="ICO",
    sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
  )
  write_iconset(image)

  print(f"Generated {PNG_PATH.relative_to(ROOT)}")
  print(f"Generated {ICO_PATH.relative_to(ROOT)}")
  print(f"Generated {ICNS_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
  main()
