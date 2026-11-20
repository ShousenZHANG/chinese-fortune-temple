"""Turn the raw GPT Image set into the web assets under public/art.

Usage: python scripts/art.py <raw-dir>

The raw files stay outside the repo (D:/suanming/temple-art-raw); each is matched by its two-character id prefix.
Sprite sheets come with a transparent background, so every sprite is the union of the alpha components whose
centre falls in its grid cell (detached bits such as incense smoke stay with their object), trimmed and padded.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

OUT = Path(__file__).resolve().parent.parent / 'public' / 'art'
SPRITE_MAX = 480
PAD = 8
GRAIN = 3.0

SHEETS = {
    'M1': (4, 1, ['monk-front', 'monk-turn', 'monk-side', 'monk-back']),
    'M2': (3, 2, ['monk-greet', 'monk-point', 'monk-meditate', 'monk-muyu', 'monk-beads', 'monk-bow']),
    'P1': (3, 2, ['muyu', 'incense', 'lamp', 'ribbon', 'beads', 'wish-tag']),
}
HALLS = {'H1': 'qiuqian', 'H2': 'yuelao', 'H3': 'huangli', 'H4': 'wenxin', 'H5': 'ziwei', 'H6': 'xuyuan'}


def raw(directory: Path, art_id: str) -> Image.Image:
    matches = sorted(directory.glob(f'{art_id}-*.png'))
    if len(matches) != 1:
        raise SystemExit(f'{art_id}: expected one file in {directory}, found {len(matches)}')
    return Image.open(matches[0])


def webp(image: Image.Image, name: str, quality: int = 82) -> None:
    image.save(OUT / f'{name}.webp', 'WEBP', quality=quality, method=6, alpha_quality=90)


def fit(image: Image.Image, longest: int) -> Image.Image:
    scale = longest / max(image.size)
    if scale >= 1:
        return image
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)


def sprites(sheet: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    rgba = sheet.convert('RGBA')
    alpha = np.asarray(rgba)[:, :, 3]
    labels, count = ndimage.label(alpha > 16)
    boxes = ndimage.find_objects(labels)
    centres = ndimage.center_of_mass(alpha > 16, labels, range(1, count + 1))
    cell_w, cell_h = rgba.width / cols, rgba.height / rows
    cells: dict[int, list[int]] = {}
    for (cy, cx), box in zip(centres, boxes):
        cell = int(cy // cell_h) * cols + int(cx // cell_w)
        y0, x0, y1, x1 = box[0].start, box[1].start, box[0].stop, box[1].stop
        old = cells.get(cell)
        cells[cell] = [x0, y0, x1, y1] if old is None else [min(old[0], x0), min(old[1], y0), max(old[2], x1), max(old[3], y1)]
    if len(cells) != cols * rows:
        raise SystemExit(f'expected {cols * rows} sprites, found {len(cells)}')
    out = []
    for cell in range(cols * rows):
        x0, y0, x1, y1 = cells[cell]
        piece = rgba.crop((x0, y0, x1, y1))
        padded = Image.new('RGBA', (piece.width + 2 * PAD, piece.height + 2 * PAD), (0, 0, 0, 0))
        padded.paste(piece, (PAD, PAD))
        out.append(fit(padded, SPRITE_MAX))
    return out


def trim(image: Image.Image) -> Image.Image:
    box = image.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
    piece = image.crop(box)
    padded = Image.new('RGBA', (piece.width + 2 * PAD, piece.height + 2 * PAD), (0, 0, 0, 0))
    padded.paste(piece, (PAD, PAD))
    return padded


def paper(image: Image.Image) -> Image.Image:
    """The page's background tile. Scaling the whole tile keeps it seamless, since both edges are resampled from
    the same wrapped content. The raw grain is too faint to see (grey std ~1.4 of 255), so it is stretched around
    its mean to std ~4, keeping the average colour on --paper."""
    small = np.asarray(image.convert('RGB').resize((512, 512), Image.LANCZOS)).astype(float)
    mean = small.reshape(-1, 3).mean(0)
    stretched = mean + (small - mean) * GRAIN
    return Image.fromarray(np.clip(stretched, 0, 255).round().astype(np.uint8))


def main(directory: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    for art_id, (cols, rows, names) in SHEETS.items():
        for name, sprite in zip(names, sprites(raw(directory, art_id), cols, rows)):
            webp(sprite, name, 85)
    webp(fit(trim(raw(directory, 'P2').convert('RGBA')), SPRITE_MAX), 'bell', 85)

    for art_id, hall in HALLS.items():
        webp(fit(raw(directory, art_id).convert('RGB'), 480), f'hall-{hall}')

    courtyard = raw(directory, 'G1').convert('RGB')
    for width in (768, 1536):
        webp(fit(courtyard, width), f'courtyard-{width}')
    og = courtyard.resize((1200, 800), Image.LANCZOS).crop((0, 170, 1200, 800))
    og.save(OUT / 'og.jpg', 'JPEG', quality=85, optimize=True, progressive=True)

    webp(raw(directory, 'G2').convert('RGB'), 'mountains', 80)
    webp(paper(raw(directory, 'T1')), 'paper', 85)
    webp(raw(directory, 'S1').convert('RGB'), 'frame-share', 85)
    webp(raw(directory, 'S2').convert('RGB'), 'frame-wish', 85)

    icon = raw(directory, 'I1').convert('RGB')
    side = icon.width
    inset = round(side * 0.12)  # the prompt kept the mark inside the central 60%; a tighter crop reads at 32 px
    icon = icon.crop((inset, inset, side - inset, side - inset))
    for size, name in ((32, 'favicon-32.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')):
        icon.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
