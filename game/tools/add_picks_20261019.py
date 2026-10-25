"""2026-10-19: register the user-approved scene props (Florantis / Metabolis) and the animated enemy/boss models.
Replaced static enemy models are moved to Assets/_Project/Models/_Replaced and their picks removed (so credits stay
accurate). Run once:  python tools/add_picks_20261019.py <scratchpad dir with prop_candidates/enemy_picks json>"""
import json, shutil, sys
from pathlib import Path

GAME = Path(__file__).resolve().parents[1]
ROOT = GAME.parent
SP = Path(sys.argv[1])
props = json.loads((GAME / 'tools' / 'prop_candidates.json').read_text(encoding='utf-8'))
enemies = json.loads((SP / 'enemy_picks.json').read_text(encoding='utf-8'))
picks_path = GAME / 'tools' / 'model_picks.json'
data = json.loads(picks_path.read_text(encoding='utf-8'))

LIC = {'CC Attribution': 'CC BY 4.0', 'CC0 Public Domain': 'CC0', 'Free Standard': 'Sketchfab Free Standard'}
PROPS = [  # code, game name, polygon budget, keep pieces separate
    ('MH-2', 'BLD_MetHouse', 30000, True), ('FG-2', 'BLD_Forge', 30000, False), ('AV-3', 'PRP_Anvil', 4000, False),
    ('BZ-1', 'PRP_Brazier', 6000, True), ('MG-1', 'PRP_MouthGate', 12000, False), ('ST-2', 'PRP_Stomach', 12000, False),
    ('IN-3', 'PRP_Intestine', 6000, False), ('LV-2', 'PRP_Liver', 8000, False), ('LU-2', 'PRP_Lungs', 20000, False),
    ('CV-3', 'PRP_Conveyor', 8000, False), ('KW-2', 'PRP_KrebsWheel', 4000, False), ('MT-2', 'PRP_Mitochondrion', 20000, False),
    ('PB-3', 'PRP_PuzzleBoard', 2000, True), ('FH-3', 'BLD_FloHut', 12000, True), ('TH-1', 'BLD_FloTreehouse', 20000, False),
    ('GF-1', 'PRP_GiantFlower', 12000, False), ('SD-1', 'PRP_Sundial', 2000, False), ('CO-1', 'PRP_Corn', 3200, False),
    ('RI-1', 'PRP_Rice', 4000, False), ('PA-3', 'PRP_Pineapple', 8000, True), ('CA-2', 'PRP_Cactus', 8000, False),
    ('PL-1', 'PRP_Planter', 3000, False), ('PT-1', 'PRP_PotionTable', 20000, True),
]
ENEMIES = [  # code, game name (rigged: never simplified)
    ('CS-1', 'ENM_CoccusSlime'), ('BC-1', 'ENM_BacillusSlime'), ('PD-3', 'ENM_PhageDrone'), ('BT-4', 'ENM_BlightTrooper'),
    ('GS-2', 'ENM_GeneSplicer'), ('SM-4', 'ENM_SporeMage'), ('CG-2', 'BOS_CarcinomaGolem'), ('CB-1', 'BOS_ChimeraBeast'),
    ('VT-1', 'BOS_ViralTempest'), ('SP-1', 'BOS_SporeMatriarch'), ('CC-1', 'BOS_CyanoCore'),
]
REPLACED = {'SL-01', 'SL-02', 'BA-01', 'PH-06', 'PH-09', 'EA-09', 'TR-09', 'SP-01', 'GO-04', 'CH-04', 'VI-01'}

def entry(code, name, dir_, faces, src, pack=False):
    e = {'code': code, 'dir': dir_, 'name': name, 'faces': faces, 'src': 'Sketchfab', 'title': src['title'], 'author': src['author'],
         'license': LIC.get(src['license'], src['license']), 'url': src['url']}
    if pack: e['pack'] = True
    return e

old = data['picks']
moved = ROOT / 'Assets' / '_Project' / 'Models' / '_Replaced'
moved.mkdir(parents=True, exist_ok=True)
for p in old:
    if p['code'] in REPLACED:
        for suffix in ('', '_lod'):
            f = ROOT / 'Assets' / '_Project' / 'Models' / p['dir'] / f"{p['name']}{suffix}.glb"
            if f.exists(): shutil.move(str(f), str(moved / f.name))
keep = [p for p in old if p['code'] not in REPLACED]
new_codes = {c for c, *_ in PROPS} | {c for c, _ in ENEMIES} | {'CS-1K'}
keep = [p for p in keep if p['code'] not in new_codes]
for code, name, faces, pack in PROPS:
    keep.append(entry(code, name, 'Props', faces, props[code], pack))
for code, name in ENEMIES:
    keep.append(entry(code, name, 'Enemies', 80000, enemies[code], pack=True))  # rigged: keep the node tree
# the Bacteria King is the same slime, bigger (its own file so the boss can be tinted/scaled separately)
dl = ROOT / 'Assets' / '_Project' / 'Downloads'
if not (dl / 'CS-1K').exists(): shutil.copytree(dl / 'CS-1', dl / 'CS-1K')
keep.append(entry('CS-1K', 'BOS_BacteriaKing', 'Enemies', 80000, enemies['CS-1'], pack=True))
data['picks'] = keep
picks_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('picks:', len(keep), '| moved old enemy models to', moved)
print(' '.join(c for c, *_ in PROPS) + ' ' + ' '.join(c for c, _ in ENEMIES) + ' CS-1K')
