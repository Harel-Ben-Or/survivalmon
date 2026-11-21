# Packs the 30 set-outfit sheets (assets/sprites/outfits/<look>_<set>.png, 768 x 1600 each) 5 to a file
# for the Claude link, which can hold only 511 files: one PNG per look with its sets one under the
# other, and pack.json saying which set is where (gfx/art.js loadOutfit reads it; GitHub Pages has the
# single sheets and no pack.json). The output is never committed.
#   python tools/pack_outfits.py <output folder>
import sys, os, json, glob
from PIL import Image
SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'sprites', 'outfits')
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
LOOKS = ['you_boy', 'you_girl', 'rowan', 'bram', 'lyra', 'pip']
H = 1600
looks = {}
for look in LOOKS:
    files = sorted(glob.glob(os.path.join(SRC, look + '_*.png')))
    sets = [os.path.basename(f)[len(look) + 1:-4] for f in files]
    sheet = Image.new('RGBA', (768, H * len(files)), (0, 0, 0, 0))
    for i, f in enumerate(files):
        im = Image.open(f).convert('RGBA')
        assert im.size == (768, H), (f, im.size)
        sheet.paste(im, (0, i * H))
    sheet.save(os.path.join(out, look + '.png'), optimize=True)
    looks[look] = sets
    print(look, sets, os.path.getsize(os.path.join(out, look + '.png')) // 1024, 'KB')
json.dump({'h': H, 'looks': looks}, open(os.path.join(out, 'pack.json'), 'w'))
print('packed', sum(len(v) for v in looks.values()), 'sheets into', len(looks), 'files')
