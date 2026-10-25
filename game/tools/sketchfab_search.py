"""Search Sketchfab for downloadable CC-BY / CC0 models for each prop slot; writes candidates JSON.
   python tools/sketchfab_search.py slots.json out.json
slots.json: [{"slot": "BLD_MetHouse", "label": "...", "q": ["query 1", "query 2"], "maxFaces": 60000}, ...]"""
import json, sys, time, urllib.parse, urllib.request

OK_LICENSES = {'CC Attribution', 'CC0 Public Domain', 'Free Standard'}

def search(q, n=24, extra=None):
    url = 'https://api.sketchfab.com/v3/search?' + urllib.parse.urlencode({'type': 'models', 'q': q, 'downloadable': 'true', 'count': n, **(extra or {})})
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=25) as r:
                return json.load(r).get('results', [])
        except Exception as e:  # rate limit / network hiccup
            print('retry', q, e, file=sys.stderr)
            time.sleep(4)
    return []

slots = json.load(open(sys.argv[1], encoding='utf-8'))
out = []
for s in slots:
    seen, cands = set(), []
    for q in s['q']:
        for m in search(q, extra=s.get('params')):
            lic = (m.get('license') or {}).get('label', '') if isinstance(m.get('license'), dict) else str(m.get('license'))
            if m['uid'] in seen or lic not in OK_LICENSES or m.get('faceCount', 0) > s.get('maxFaces', 80000) or m.get('isAgeRestricted') or m.get('animationCount', 0) < s.get('minAnims', 0):
                continue
            seen.add(m['uid'])
            thumbs = sorted(m.get('thumbnails', {}).get('images', []), key=lambda t: abs(t['width'] - 400))
            cands.append({'uid': m['uid'], 'title': m['name'], 'author': m['user']['displayName'], 'license': lic,
                          'faces': m.get('faceCount'), 'anims': m.get('animationCount', 0), 'likes': m.get('likeCount', 0), 'url': m['viewerUrl'].replace('/none-', '/' + m['slug'] + '-') if m.get('slug') else m['viewerUrl'],
                          'thumb': thumbs[0]['url'] if thumbs else ''})
        time.sleep(0.6)
    cands.sort(key=lambda c: -c['likes'])
    out.append({**s, 'cands': cands[:6]})
    print(s['slot'], len(cands), file=sys.stderr)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
