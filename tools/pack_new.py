# Builds the new families' atlas: assets/sprites/creatures/new/atlas.png + atlas.json.
# It holds every new survivalmon's standing picture (the first cell of its animation sheet, trimmed) and the
# new types' stone and egg icons and shots (tools/new_art/icons/*.png, 32 px tiles; tools/new_art/proj/*.png).
# The game loads this one small picture at the start; a new survivalmon's full sheet
# (assets/sprites/creatures/anim/<id>.png) is fetched only when it is first animated (gfx/art.js).
# Run it again whenever a new survivalmon's sheet or one of those pictures changes:
#   python tools/pack_new.py
import glob, json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'assets', 'sprites', 'creatures', 'anim')
OUT = os.path.join(ROOT, 'assets', 'sprites', 'creatures', 'new')
SRC = os.path.join(ROOT, 'tools', 'new_art')
W = 1024
js = open(os.path.join(ROOT, 'src', 'content', 'species_new.js'), encoding='utf-8').read()
ids = list(json.loads(re.search(r'export const NEW_MOTION = (\{.*?\});', js).group(1)))

tiles = []   # (group, id, picture, extra)
for i in ids:
    path = os.path.join(SHEETS, i + '.png')
    if not os.path.exists(path): print('no sheet yet:', i); continue
    im = Image.open(path).convert('RGBA'); c = im.width // 8
    cell = im.crop((0, 0, c, c)); b = cell.getbbox()
    tiles.append(('stills', i, cell.crop(b), [c, b[0], b[1]]))
for group in ('icons', 'proj'):
    for path in sorted(glob.glob(os.path.join(SRC, group, '*.png'))):
        tiles.append((group, os.path.basename(path)[:-4], Image.open(path).convert('RGBA'), []))
tiles.sort(key=lambda t: (-t[2].height, t[1]))
x = y = row = 0; place = []
for group, i, im, extra in tiles:
    if x + im.width > W: x, y, row = 0, y + row + 1, 0
    place.append((group, i, im, extra, x, y)); x += im.width + 1; row = max(row, im.height)
atlas = Image.new('RGBA', (W, y + row), (0, 0, 0, 0)); out = {'stills': {}, 'icons': {}, 'proj': {}}
for group, i, im, extra, px, py in place:
    atlas.paste(im, (px, py)); out[group][i] = [px, py, im.width, im.height] + extra
os.makedirs(OUT, exist_ok=True)
atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
json.dump(out, open(os.path.join(OUT, 'atlas.json'), 'w'), separators=(',', ':'))
print(f"{len(out['stills'])} standing pictures, {len(out['icons'])} icons, {len(out['proj'])} shots; atlas {atlas.size}, "
      f"{os.path.getsize(os.path.join(OUT, 'atlas.png')) // 1024} KB")
