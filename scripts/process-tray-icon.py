#!/usr/bin/env python3
"""
Converts menu_icon.png into a proper macOS menu bar template icon:
  1. Squares the canvas (pad shorter dimension, centred)
  2. Removes white background → transparent
  3. Saves @1x (16×16) and @2x (32×32) versions
"""
from PIL import Image
import os, sys

SRC  = os.path.join(os.path.dirname(__file__), "..", "menu_icon.png")
OUT1 = os.path.join(os.path.dirname(__file__), "..", "assets", "icons", "tray@1x.png")
OUT2 = os.path.join(os.path.dirname(__file__), "..", "assets", "icons", "tray.png")

img = Image.open(SRC).convert("RGBA")
w, h = img.size

# 1. Square the canvas by padding the shorter side
size = max(w, h)
squared = Image.new("RGBA", (size, size), (255, 255, 255, 0))
offset = ((size - w) // 2, (size - h) // 2)
squared.paste(img, offset)

# 2. Make white (and near-white) pixels transparent
pixels = squared.load()
threshold = 240  # treat anything brighter than this as "background"
for y in range(size):
    for x in range(size):
        r, g, b, a = pixels[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            pixels[x, y] = (0, 0, 0, 0)

# 3. Resize to target sizes using high-quality downsampling
for out_path, target in [(OUT1, 16), (OUT2, 32)]:
    resized = squared.resize((target, target), Image.LANCZOS)
    resized.save(out_path, "PNG", optimize=True)
    print(f"Saved {target}×{target} → {out_path}")

print("Done.")
