"""2026-10-23: register the user-approved Aquorra models (tools/aqu_picks.json) in model_picks.json. Re-runnable.
Then:  python tools/import_downloads.py <codes>  &&  python tools/import_assets.py"""
import json
from pathlib import Path
GAME = Path(__file__).resolve().parents[1]
new = json.loads((GAME / 'tools' / 'aqu_picks.json').read_text(encoding='utf-8'))
path = GAME / 'tools' / 'model_picks.json'
data = json.loads(path.read_text(encoding='utf-8'))
codes = {e['code'] for e in new}
data['picks'] = [p for p in data['picks'] if p['code'] not in codes] + [{k: v for k, v in e.items() if k != 'uid'} for e in new]
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('picks:', len(data['picks']), '| codes:', ' '.join(e['code'] for e in new))
