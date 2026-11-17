# Packs every animation sheet (assets/sprites/creatures/anim/<id>.png) into a few big pages for the
# Claude link, which can hold only 511 files: pack_<n>.webp (lossless, exact: the same pixels) plus pack.json ({pages: [...], sheets:
# {id: [page, x, y, w, h]}}). The game (gfx/art.js loadArt) uses the pack when pack.json is there and
# the single sheets otherwise. The pack isn't committed; build it into a folder of its own and publish
# it in place of the single sheets.
#   python tools/pack_anims.py <out folder>
import glob, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'sprites', 'creatures', 'anim')
PAGE = 2048  # each page is at most this wide and tall

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
sheets = sorted(((os.path.basename(p)[:-4], Image.open(p).convert('RGBA')) for p in glob.glob(os.path.join(SRC, '*.png'))
                 if not os.path.basename(p).startswith('pack_')), key=lambda s: (-s[1].height, s[0]))
pages, where = [], {}
page = None
x = y = row_h = 0
for id_, im in sheets:
    w, h = im.size
    if page is None or x + w > PAGE:  # next row
        x, y, row_h = 0, y + row_h, 0
    if page is None or y + h > PAGE:  # next page
        page = Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0)); pages.append(page)
        x = y = row_h = 0
    page.paste(im, (x, y))
    where[id_] = [len(pages) - 1, x, y, w, h]
    x += w; row_h = max(row_h, h)
names = []
for i, pg in enumerate(pages):
    bb = pg.getbbox()
    pg = pg.crop((0, 0, PAGE, bb[3] if bb else 1))  # no empty space below the last row
    name = f'pack_{i}.webp'  # lossless WebP: a third of the size of the same page as PNG
    pg.save(os.path.join(out, name), 'WEBP', lossless=True, exact=True, quality=100, method=6)
    names.append(name)
json.dump({'pages': names, 'sheets': where}, open(os.path.join(out, 'pack.json'), 'w'), separators=(',', ':'))
size = sum(os.path.getsize(os.path.join(out, n)) for n in names)
print(f'{len(where)} sheets in {len(names)} pages, {size // 1024} KB')
