# Packs every animation sheet (assets/sprites/creatures/anim/<id>.png) into a few big pages for the
# Claude link, which can hold only 511 files: pack_<n>.webp (lossless, exact: the same pixels) plus pack.json ({pages: [...], sheets:
# {id: [page, x, y, w, h]}}). The game (gfx/art.js loadArt) uses the pack when pack.json is there and
# the single sheets otherwise. The pack isn't committed; build it into a folder of its own and publish
# it in place of the single sheets.
# The new families' attack effects (assets/sprites/vfx/new/<id>.png, see tools/pack_vfx_new.py) share those
# on-demand pages, listed in pack.json as vfx: {id: [page, x, y, w, h]}.
#   python tools/pack_anims.py <out folder>
import glob, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'sprites', 'creatures', 'anim')
PAGE = 2048       # each page is at most this wide and tall
PAGE_LAZY = 4096  # the new families' pages: fewer, bigger files (each is fetched only when one of its sheets is wanted)

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
# The new families' sheets (every id with a standing picture in creatures/new/atlas.json, see tools/pack_new.py)
# are not loaded with the game, so they get pages of their own, listed in pack.json as `lazy`.
atlas = os.path.join(ROOT, 'assets', 'sprites', 'creatures', 'new', 'atlas.json')
later = set(json.load(open(atlas))['stills']) if os.path.exists(atlas) else set()
sheets = sorted(((os.path.basename(p)[:-4], Image.open(p).convert('RGBA')) for p in glob.glob(os.path.join(SRC, '*.png'))
                 if not os.path.basename(p).startswith('pack')), key=lambda s: (-s[1].height, s[0]))
names, where, lazy, vfx = [], {}, [], {}
def pack(group, size, prefix):  # group: (id, picture, the map its place goes into)
    pages, page = [], None
    x = y = row_h = 0
    first = len(names)
    for id_, im, into in group:
        w, h = im.size
        if page is None or x + w > size:  # next row
            x, y, row_h = 0, y + row_h, 0
        if page is None or y + h > size:  # next page
            page = Image.new('RGBA', (size, size), (0, 0, 0, 0)); pages.append(page)
            x = y = row_h = 0
        page.paste(im, (x, y))
        into[id_] = [first + len(pages) - 1, x, y, w, h]
        x += w; row_h = max(row_h, h)
    for i, pg in enumerate(pages):
        bb = pg.getbbox()
        pg = pg.crop((0, 0, size, bb[3] if bb else 1))  # no empty space below the last row
        name = f'{prefix}_{i}.webp'  # lossless WebP: a third of the size of the same page as PNG
        pg.save(os.path.join(out, name), 'WEBP', lossless=True, exact=True, quality=100, method=6)
        names.append(name)
    return list(range(first, first + len(pages)))
pack([(i, im, where) for i, im in sheets if i not in later], PAGE, 'pack')
effects = sorted(((os.path.basename(p)[:-4], Image.open(p).convert('RGBA')) for p in glob.glob(os.path.join(ROOT, 'assets', 'sprites', 'vfx', 'new', '*.png'))),
                 key=lambda s: (-s[1].height, s[0]))
lazy = pack(sorted([(i, im, where) for i, im in sheets if i in later] + [(i, im, vfx) for i, im in effects], key=lambda s: (-s[1].height, s[0])), PAGE_LAZY, 'packn')
json.dump({'pages': names, 'sheets': where, 'lazy': lazy, 'vfx': vfx}, open(os.path.join(out, 'pack.json'), 'w'), separators=(',', ':'))
size = sum(os.path.getsize(os.path.join(out, n)) for n in names)
print(f'{len(where)} sheets and {len(vfx)} effects in {len(names)} pages ({len(lazy)} of them fetched on demand), {size // 1024} KB')
