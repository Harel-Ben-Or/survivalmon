# Builds assets/news/new_attacks.png, the picture for the 1.11 What's new note: three of the new families'
# evolutions with their own big move, on the grass of the 1.10 picture.
#   python tools/new_art/news_attacks.py
import json, os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VFX = os.path.join(ROOT, 'tools', 'new_art', 'vfx')
ANIM = os.path.join(ROOT, 'assets', 'sprites', 'creatures', 'anim')
W, H, GY = 760, 230, 168
def effect(i, frame):
    d = json.load(open(os.path.join(VFX, i + '.json'), encoding='utf-8')); sh = Image.open(os.path.join(VFX, i + '.png')).convert('RGBA')
    f = d['frames'][frame]['frame']; a = d['meta']['anchor']
    return sh.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), a['x'], a['y']
def mon(i, row=2, frame=2):
    sh = Image.open(os.path.join(ANIM, i + '.png')).convert('RGBA'); c = sh.width // 8
    return sh.crop((frame * c, row * c, frame * c + c, row * c + c)), c
# the grass: the strip above the mons in the 1.10 picture, repeated down the picture
old = Image.open(os.path.join(ROOT, 'assets', 'news', 'new_four.png')).convert('RGBA')
strip = old.crop((0, 0, W, 18)); out = Image.new('RGBA', (W, H))
for y in range(0, H, 18): out.paste(strip if (y // 18) % 2 == 0 else strip.transpose(Image.FLIP_TOP_BOTTOM), (0, y))
# (panel centre x, the mon, its x, the effect, its frame, the effect's x, drawn over the mon?)
SCENES = [(127, 'blazeram', 52, 'evo_blazeram', 5, 168, True), (380, 'wyrmcrown', 380, 'evo_wyrmcrown', 6, 380, False),
          (633, 'neonmander', 560, 'evo_neonmander', 7, 672, True)]
for cx, m, mx, fx, frame, ex, over in SCENES:
    e, ax, ay = effect(fx, frame); s, c = mon(m)
    def put_mon(): out.alpha_composite(s, (mx - c // 2, GY - 30 - c // 2))
    def put_fx(): out.alpha_composite(e, (ex - ax, GY - ay))
    if over: put_mon(); put_fx()
    else: put_fx(); put_mon()
out.convert('RGB').save(os.path.join(ROOT, 'assets', 'news', 'new_attacks.png'), optimize=True)
print('assets/news/new_attacks.png', out.size, os.path.getsize(os.path.join(ROOT, 'assets', 'news', 'new_attacks.png')) // 1024, 'KB')
