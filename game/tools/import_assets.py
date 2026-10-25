"""
นำเข้าภาพจาก GPT (โฟลเดอร์ Assets/_Project/Art ตามโครงสร้างในเอกสาร 09) เข้าสู่เกมเว็บ (game/public/assets)
- ตัดแผ่นรวม (สีหน้า 8 แบบ, ไอคอนไอเทม, อาวุธ, Relic, ปฏิกิริยา) เป็นไฟล์แยกอัตโนมัติ
- ย่อขนาดและบีบอัด (Splash/ฉากเป็น .jpg) เพื่อให้เกมโหลดเร็ว
- รันซ้ำได้ทุกครั้งที่ GPT สร้างภาพใหม่:

    python tools/import_assets.py

ต้องติดตั้ง Pillow:  pip install pillow
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent          # game/
ART = ROOT.parent / "Assets" / "_Project" / "Art"       # GPT art (Unity-style layout)
OUT = ROOT / "public" / "assets"
CHARS = ["Sion", "Sira", "Mitora", "Alvi", "Chloren", "Hema", "Neuros", "Helix"]
EMOTIONS = ["Neutral", "Happy", "Sad", "Angry", "Surprised", "Worried", "Crying", "Thinking"]
report: list[str] = []


# ----------------------------------------------------------------------------- helpers
def out(sub: str, name: str) -> Path:
    p = OUT / sub
    p.mkdir(parents=True, exist_ok=True)
    return p / name


def load(rel: str) -> Image.Image | None:
    p = ART / rel
    if not p.exists():
        return None
    return Image.open(p).convert("RGBA")


def is_transparent(im: Image.Image) -> bool:
    a = im.getchannel("A")
    hist = a.histogram()
    return sum(hist[:16]) / (im.width * im.height) > 0.08


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    a = im.getchannel("A").point(lambda v: 255 if v > 24 else 0)
    box = a.getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def square(im: Image.Image, size: int, fill=(0, 0, 0, 0)) -> Image.Image:
    w, h = im.size
    s = max(w, h)
    c = Image.new("RGBA", (s, s), fill)
    c.paste(im, ((s - w) // 2, (s - h) // 2), im)
    return c.resize((size, size), Image.LANCZOS)


def cover_square(im: Image.Image, size: int, focus_y: float = 0.45) -> Image.Image:
    """Center-crop to a square (for opaque art) then resize."""
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = int(max(0, min(h - s, h * focus_y - s / 2)))
    return im.crop((left, top, left + s, top + s)).resize((size, size), Image.LANCZOS)


def save_png(im: Image.Image, path: Path, max_side: int | None = None):
    if max_side and max(im.size) > max_side:
        im = im.copy()
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(path, optimize=True)
    report.append(str(path.relative_to(ROOT)))


def save_webp(im: Image.Image, path: Path, max_side: int = 640, quality: int = 86):
    if max(im.size) > max_side:
        im = im.copy()
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=5)
    report.append(str(path.relative_to(ROOT)))


def save_jpg(im: Image.Image, path: Path, width: int = 1280, quality: int = 84):
    im = im.convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, quality=quality, optimize=True, progressive=True)
    report.append(str(path.relative_to(ROOT)))


def soft_vignette(im: Image.Image) -> Image.Image:
    """Bake soft edges into an opaque portrait so it blends into the dialogue box."""
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((-w * 0.05, h * 0.02, w * 1.05, h * 1.5), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) * 0.06))
    res = im.copy()
    res.putalpha(ImageChops.multiply(im.getchannel("A"), mask))
    return res


def remove_bg(im: Image.Image, thresh: int = 34) -> Image.Image:
    """Cut out a character from a flat light background: flood-fill from the borders, then feather."""
    rgb = im.convert("RGB")
    key = (255, 0, 255)
    w, h = rgb.size
    seeds = [(x, 0) for x in range(0, w, max(1, w // 24))] + [(x, h - 1) for x in range(0, w, max(1, w // 24))] +             [(0, y) for y in range(0, h, max(1, h // 24))] + [(w - 1, y) for y in range(0, h, max(1, h // 24))]
    for sx, sy in seeds:
        r, g, b = rgb.getpixel((sx, sy))
        if (r, g, b) == key or max(r, g, b) - min(r, g, b) > 40 or (r + g + b) / 3 < 150:
            continue  # only flood light, low-saturation background
        ImageDraw.floodfill(rgb, (sx, sy), key, thresh=thresh)
    mask = Image.eval(ImageChops.difference(rgb, Image.new("RGB", rgb.size, key)).convert("L"), lambda v: 0 if v < 8 else 255)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    res = im.copy()
    res.putalpha(ImageChops.multiply(im.getchannel("A"), mask))
    return res


def grid(im: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    cw, ch = im.width / cols, im.height / rows
    return [im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))) for r in range(rows) for c in range(cols)]


def segment(im: Image.Image, expected: int | None = None) -> list[Image.Image]:
    """Split a transparent sheet into objects using connected components on a downsampled alpha mask.
    Keeps the `expected` largest blobs (sparkles/glow are ignored) ordered row by row."""
    scale = 192 / max(im.size)
    sw, sh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    small = im.getchannel("A").resize((sw, sh), Image.BILINEAR).point(lambda v: 255 if v > 110 else 0)
    small = small.filter(ImageFilter.MaxFilter(3))  # close tiny gaps inside an object
    px = small.load()
    seen = [[False] * sw for _ in range(sh)]
    blobs = []
    for y in range(sh):
        for x in range(sw):
            if px[x, y] and not seen[y][x]:
                stack, area = [(x, y)], 0
                x0 = x1 = x
                y0 = y1 = y
                seen[y][x] = True
                while stack:
                    cx, cy = stack.pop()
                    area += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < sw and 0 <= ny < sh and px[nx, ny] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                blobs.append((area, x0, y0, x1 + 1, y1 + 1))
    blobs.sort(reverse=True)
    if expected:
        blobs = blobs[:expected]
    else:
        big = blobs[0][0] if blobs else 0
        blobs = [b for b in blobs if b[0] > big * 0.08]
    # order: rows (by vertical centre clustering), then left to right
    blobs.sort(key=lambda b: (b[2] + b[4]) / 2)
    rows, cur = [], []
    for b in blobs:
        if cur and (b[2] + b[4]) / 2 - (cur[-1][2] + cur[-1][4]) / 2 > (b[4] - b[2]) * 0.5:
            rows.append(cur)
            cur = []
        cur.append(b)
    if cur:
        rows.append(cur)
    pieces = []
    for row in rows:
        for _, x0, y0, x1, y1 in sorted(row, key=lambda b: b[1]):
            box = (max(0, int(x0 / scale) - 8), max(0, int(y0 / scale) - 8), min(im.width, int(x1 / scale) + 8), min(im.height, int(y1 / scale) + 8))
            pieces.append(trim(im.crop(box)))
    if expected and len(pieces) != expected:
        report.append(f"  ! segment: expected {expected}, found {len(pieces)}")
    return pieces


def _valleys(profile: list[float], n: int) -> list[int]:
    """Cut positions (n-1) placed at the emptiest spot near each even split."""
    L = len(profile)
    cuts = [0]
    for k in range(1, n):
        c = round(k * L / n)
        r = max(2, round(L / n * 0.35))
        lo, hi = max(1, c - r), min(L - 1, c + r)
        best = min(range(lo, hi), key=lambda i: (profile[i], abs(i - c)))
        cuts.append(best)
    cuts.append(L)
    return cuts


def keep_main(im: Image.Image) -> Image.Image:
    """Erase slivers of neighbouring objects: keep only big connected blobs of the cell."""
    scale = 160 / max(im.size)
    sw, sh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    small = im.getchannel("A").resize((sw, sh), Image.BILINEAR).point(lambda v: 255 if v > 60 else 0)
    px = small.load()
    label = [[0] * sw for _ in range(sh)]
    areas = [0]
    for y in range(sh):
        for x in range(sw):
            if px[x, y] and not label[y][x]:
                lid = len(areas)
                areas.append(0)
                stack = [(x, y)]
                label[y][x] = lid
                while stack:
                    cx, cy = stack.pop()
                    areas[lid] += 1
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < sw and 0 <= ny < sh and px[nx, ny] and not label[ny][nx]:
                            label[ny][nx] = lid
                            stack.append((nx, ny))
    if len(areas) <= 2:
        return trim(im)
    big = max(areas)
    keep = {i for i, a in enumerate(areas) if i and a >= big * 0.12}
    mask = Image.new("L", (sw, sh), 0)
    mp = mask.load()
    for y in range(sh):
        for x in range(sw):
            if label[y][x] in keep:
                mp[x, y] = 255
    mask = mask.filter(ImageFilter.MaxFilter(5)).resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(2))
    res = im.copy()
    res.putalpha(ImageChops.multiply(im.getchannel("A"), mask))
    return trim(res)


def layout(im: Image.Image, per_row: list[int]) -> list[Image.Image]:
    """Split a sheet into rows (len(per_row)) and each row into per_row[i] cells at alpha valleys."""
    a = im.getchannel("A").point(lambda v: 1 if v > 60 else 0)
    w, h = im.size
    px = a.load()
    transparent = is_transparent(im)
    rows = _valleys([sum(px[x, y] for x in range(0, w, 3)) for y in range(h)], len(per_row)) if transparent else [round(i * h / len(per_row)) for i in range(len(per_row) + 1)]
    pieces = []
    for r, n in enumerate(per_row):
        y0, y1 = rows[r], rows[r + 1]
        if transparent:
            cols = _valleys([sum(px[x, y] for y in range(y0, y1, 3)) for x in range(w)], n)
        else:
            cols = [round(i * w / n) for i in range(n + 1)]
        for c in range(n):
            cell = im.crop((cols[c], y0, cols[c + 1], y1))
            pieces.append(keep_main(cell) if transparent else trim(cell))
    return pieces


def masked_components(im: Image.Image, n: int) -> list[Image.Image]:
    """For sheets whose objects overlap diagonally (weapons): label blobs at medium resolution,
    keep the n largest, and cut each one out with its own mask so neighbours never leak in."""
    scale = 512 / max(im.size)
    sw, sh = round(im.width * scale), round(im.height * scale)
    small = im.getchannel("A").resize((sw, sh), Image.BILINEAR).point(lambda v: 255 if v > 90 else 0)
    px = small.load()
    label = [[0] * sw for _ in range(sh)]
    comps = [None]
    for y in range(sh):
        for x in range(sw):
            if px[x, y] and not label[y][x]:
                lid = len(comps)
                stack = [(x, y)]
                label[y][x] = lid
                pts = 0
                x0 = x1 = x
                while stack:
                    cx, cy = stack.pop()
                    pts += 1
                    x0, x1 = min(x0, cx), max(x1, cx)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < sw and 0 <= ny < sh and px[nx, ny] and not label[ny][nx]:
                            label[ny][nx] = lid
                            stack.append((nx, ny))
                comps.append((pts, (x0 + x1) / 2))
    order = sorted(range(1, len(comps)), key=lambda i: -comps[i][0])[:n]
    order.sort(key=lambda i: comps[i][1])
    pieces = []
    for lid in order:
        m = Image.new("L", (sw, sh), 0)
        mp = m.load()
        for y in range(sh):
            row = label[y]
            for x in range(sw):
                if row[x] == lid:
                    mp[x, y] = 255
        m = m.filter(ImageFilter.MaxFilter(5)).resize(im.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.5))
        res = im.copy()
        res.putalpha(ImageChops.multiply(im.getchannel("A"), m))
        pieces.append(trim(res))
    if len(pieces) != n:
        report.append(f"  ! masked_components: expected {n}, found {len(pieces)}")
    return pieces


def pieces_for(im: Image.Image, cols: int, rows: int, expected: int) -> list[Image.Image]:
    return layout(im, [cols] * rows)[:expected]


# ----------------------------------------------------------------------------- importers
def characters():
    for name in CHARS:
        base = f"Characters/{name}/CHR_{name}"
        icon = load(f"{base}_Icon.png")
        if icon:
            save_png(square(trim(icon), 256), out("characters", f"CHR_{name}_Icon.png"))
        sheet = load(f"{base}_Portraits.png")
        if sheet:
            for emo, cell in zip(EMOTIONS, grid(sheet, 4, 2)):
                corners = [cell.getchannel("A").getpixel(p) for p in [(3, 3), (cell.width - 4, 3), (3, cell.height - 4), (cell.width - 4, cell.height - 4)]]
                if sum(c > 200 for c in corners) >= 2:
                    cell = soft_vignette(cell)
                save_webp(trim(cell), out("characters", f"CHR_{name}_Portrait_{emo}.webp"))
        splash = load(f"{base}_Splash.png")
        if splash:
            save_jpg(splash, out("characters", f"CHR_{name}_Splash.jpg"), 1280, 80)
    am = load("Characters/Amoeby/CHR_Amoeby_Sheet_01.png")
    if am:
        first = am.crop((0, 0, am.width // 3, am.height // 3))
        save_png(cover_square(first, 256, 0.5), out("characters", "CHR_Amoeby_Icon.png"))
        save_webp(trim(remove_bg(first)), out("characters", "CHR_Amoeby_Portrait_Neutral.webp"))


def companion():
    """The floating companion: portraits rendered from her VRoid model (tools/companion-portraits.js)."""
    d = ART / "Characters" / "Companion"
    icon = load("Characters/Companion/CHR_Companion_Icon.png")
    if icon:
        bg = Image.new("RGBA", icon.size, (207, 227, 245, 255))
        bg.alpha_composite(icon)
        save_png(bg, out("characters", "CHR_Companion_Icon.png"))
    for f in sorted(d.glob("CHR_Companion_Portrait_*.png")) if d.exists() else []:
        save_webp(trim(Image.open(f).convert("RGBA")), out("characters", f.stem + ".webp"))


def npcs():
    for f in sorted((ART / "Characters" / "NPC").glob("NPC_*_Sheet.png")):
        name = f.stem.replace("NPC_", "").replace("_Sheet", "")
        im = Image.open(f).convert("RGBA")
        w, h = im.size
        bust = remove_bg(im.crop((int(w * 0.40), 0, w, h)))
        # the full-body figure may leak in from the left edge: keep only the main blob
        save_webp(keep_main(bust), out("characters", f"NPC_{name}_Portrait.webp"))
        face = im.crop((int(w * 0.48), 0, int(w * 0.96), int(h * 0.62)))
        save_png(cover_square(face, 256, 0.45), out("characters", f"NPC_{name}_Icon.png"))


def ui():
    for el in ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"]:
        im = load(f"UI/Icons/Elements/UI_Element_{el}.png")
        if im:
            save_png(square(trim(im), 128), out("ui", f"UI_Element_{el}.png"))
    for f in sorted((ART / "UI" / "Icons" / "Skills").glob("SKL_*.png")):
        save_png(square(trim(Image.open(f).convert("RGBA")), 192), out("ui", f.name))
    logo = load("UI/Logos/LOGO_Vitaria.png")
    if logo:
        save_png(trim(logo), out("ui", "LOGO_Vitaria.png"), 1100)
    bg = load("UI/Backgrounds/UI_TitleBackground.png")
    if bg:
        save_jpg(bg, out("ui", "UI_TitleBackground.jpg"), 1600)
    key = load("Concept/KEY_MainVisual.png")
    if key:
        save_jpg(key, out("ui", "KEY_MainVisual.jpg"), 1600)
    for b in ["Novice", "Featured", "Standard"]:
        im = load(f"UI/Banners/UI_Banner_{b}.png")
        if im:
            save_jpg(im, out("ui", f"UI_Banner_{b}.jpg"), 1400)
    reactions = load("UI/Icons/Reactions/UI_Reaction_Sheet.png")
    if reactions:
        ids = ["THERMO", "DENATURE", "FEVER", "OXIDATION", "CRYOSTASIS", "ELECTROLYTE",
               "GERMINATION", "SYNAPTIC", "CATALYSIS", "DIFFUSION", "MEMBRANE", "LYSIS"]
        for rid, p in zip(ids, pieces_for(reactions, 6, 2, 12)):
            icon = square(p, 160)
            save_png(icon, out("ui", f"UI_Reaction_{rid}.png"))
            save_png(square(p, 256), out("codex", f"CDX_R_{rid}.png"))


def items():
    cur = load("Items/ITM_Currency_Sheet.png")
    if cur:
        names = ["INSIGHT_CRYSTAL", "GENE_SEED", "GLUCOSE", "ATP", "CREATINE", "STARGLITTER", "BIO_ORB", "ANTIBIOTIC"]
        for n, p in zip(names, pieces_for(cur, 4, 2, 8)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    mats = load("Items/ITM_Materials_Sheet.png")
    if mats:
        names = ["EXP_MONO", "EXP_DI", "EXP_POLY", "MAT_CALCITE", "MAT_CALCITE_2", "MAT_CALCITE_3", "MAT_CALCITE_4",
                 "MAT_BAC_SLIME", "MAT_PHAGE_WING", "MAT_SPORE", "MAT_GOLEM_CORE", "VACCINE"]
        for n, p in zip(names, layout(mats, [3, 4, 5])):
            save_png(square(p, 192), out("items", f"{n}.png"))
    food = load("Items/ITM_Food_Sheet.png")
    if food:
        names = ["FOOD_MUSHROOM_RICE", "FOOD_PROTEIN_STEAK", "FOOD_HONEY_BREAD", "FOOD_LENTIL_SOUP", "FOOD_FRUIT_SALAD", "FOOD_GLUCOSE_BOMB"]
        for n, p in zip(names, pieces_for(food, 3, 2, 6)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    gear = load("Items/ITM_Gear_Sheet.png")
    if gear:
        names = ["ORE_CALCIUM", "ORE_PHOSPHATE", "GROWTH_FACTOR"]
        for n, p in zip(names, pieces_for(gear, 3, 1, 3)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    ch1 = load("Items/ITM_Chapter1_Sheet.png")
    if ch1:
        names = ["MOL_AMINO", "MOL_MONOSAC", "MOL_FATTY", "MOL_NUCLEOTIDE", "MAT_BLIGHT_CLOTH", "MAT_SYN_GEAR", "MAT_GOLEM_CORE"]
        for n, p in zip(names, pieces_for(ch1, 4, 2, 7)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    ch2 = load("Items/ITM_Chapter2_Sheet.png")
    if ch2:
        for n, p in zip(["MAT_ICE_HELIX", "MAT_CHIMERA_SCALE"], pieces_for(ch2, 2, 1, 2)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    ch3 = load("Items/ITM_Chapter3_Sheet.png")
    if ch3:
        for n, p in zip(["MAT_STORM_PEARL", "MAT_SPORE_CAP"], pieces_for(ch3, 2, 1, 2)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    books = load("Items/ITM_Book_Sheet.png")
    if books:
        names = [f"BOOK_{k}_{t}" for k in ("CELL", "OBS", "HYP") for t in (1, 2, 3)]
        for n, p in zip(names, pieces_for(books, 3, 3, 9)):
            save_png(square(p, 192), out("items", f"{n}.png"))
    core = load("Items/ITM_VitalCore_Sheet.png")
    if core:
        names = ["HOLLOW", "PYRO", "HYDRO", "ANEMO", "ELECTRO", "DENDRO", "CRYO", "GEO"]
        for n, p in zip(names, pieces_for(core, 8, 1, 8)):
            save_png(square(p, 192), out("items", f"VITALCORE_{n}.png"))


def weapons():
    s1 = load("Weapons/WPN_Sheet_01.png")
    if s1:
        names = ["LYSOZYME_BLADE", "AXON_BLADE", "TWIN_HELIX", "KERATIN_GREATSWORD", "CRYSTAL_BLOODLINE", "FLAGELLUM_SPEAR"]
        for n, p in zip(names, masked_components(s1, 6)):
            save_png(square(p, 256), out("weapons", f"WPN_{n}.png"))
    s3 = load("Weapons/WPN_Sheet_03.png")
    if s3:
        names = ["TRAINING_SWORD", "COLLAGEN_GREATSWORD", "TRAINING_POLEARM", "HORMONE_ORB"]
        for n, p in zip(names, masked_components(s3, 4)):
            save_png(square(p, 256), out("weapons", f"WPN_{n}.png"))
    s2 = load("Weapons/WPN_Sheet_02.png")
    if s2:
        names = ["CILIA_BOW", "LIVING_BAMBOO_BOW", "SPORE_BOW", "ATP_LANTERN", "ENZYME_CODEX"]
        for n, p in zip(names, masked_components(s2, 5)):
            save_png(square(p, 256), out("weapons", f"WPN_{n}.png"))


def relics():
    slots = ["MEMBRANE", "FLAGELLUM", "MITOCHONDRION", "VACUOLE", "NUCLEUS"]
    for set_name in ["PioneerProkaryote", "ComplexEukaryote", "SturdyPlantCell", "StemCellOrigin"]:
        im = load(f"Relics/RLC_{set_name}_Set.png")
        if not im:
            continue
        for slot, p in zip(slots, pieces_for(im, 5, 1, 5)):
            save_png(square(p, 192), out("relics", f"RLC_{set_name}_{slot}.png"))


def codex_and_scenes():
    slimes = load("Enemies/ENM_BacterioSlimes_Sheet.png")
    if slimes:
        cells = grid(slimes, 4, 3)
        save_png(cover_square(cells[0], 320, 0.5), out("codex", "CDX_BACTERIA_COCCI.png"))
        save_png(cover_square(cells[4], 320, 0.5), out("codex", "CDX_BACTERIA_BACILLUS.png"))
        save_png(cover_square(slimes, 320, 0.5), out("codex", "CDX_BACTERIA_BASIC.png"))
        save_png(cover_square(cells[11], 320, 0.5), out("codex", "CDX_BACTERIA_KING.png"))
        save_png(cover_square(cells[10], 320, 0.5), out("codex", "CDX_BINARY_FISSION.png"))
    phage = load("Enemies/ENM_PhageDrone_Concept.png")
    if phage:
        save_png(cover_square(phage, 320, 0.4), out("codex", "CDX_PHAGE.png"))
    pairs = {
        "CDX_TREE_OF_LIFE": ("Concept/KEY_MainVisual.png", 0.4),
        "CDX_ANIMAL_CELL": ("Environment/Cytoria/ENV_Cytoria_CellHollow.png", 0.5),
        "CDX_CELL_THEORY": ("Environment/Cytoria/ENV_Cytoria_CellariaCity.png", 0.5),
        "CDX_MEMBRANE_LAKE": ("Environment/Cytoria/ENV_Cytoria_MembraneLake.png", 0.5),
    }
    for cid, (rel, fy) in pairs.items():
        im = load(rel)
        if im:
            save_png(cover_square(im, 320, fy), out("codex", f"{cid}.png"))
    for f in sorted((ART / "Environment").rglob("ENV_*.png")):
        save_jpg(Image.open(f), out("environment", f.stem + ".jpg"), 1280, 78)
    # item art reused as codex art
    for cid, item in {"CDX_ANTIBIOTIC": "ANTIBIOTIC", "CDX_ATP": "ATP", "CDX_CALCITE": "MAT_CALCITE_4"}.items():
        src = OUT / "items" / f"{item}.png"
        if src.exists():
            im = Image.open(src).convert("RGBA")
            save_png(square(im, 256, (27, 35, 64, 255)), out("codex", f"{cid}.png"))


def models():
    """Copy 3D models (VRoid .vrm / AI .glb) from Assets/_Project/Models into assets/models + write models.json."""
    import shutil
    src = ART.parent / "Models"
    dst = OUT / "models"
    found = []
    if src.exists():
        for f in sorted(src.rglob("*")):
            if f.suffix.lower() not in (".vrm", ".glb"):
                continue
            if any(part.startswith("_") for part in f.relative_to(src).parts[:-1]):
                continue  # _Replaced etc.: retired models stay on disk but out of the game
            sub = f.parent.name.lower()
            sub = {"character": "characters", "enemy": "enemies", "npc": "npcs", "weapon": "weapons", "prop": "props", "buildings": "props", "building": "props"}.get(sub, sub)
            name = f.name
            prefix = {"characters": "CHR_", "npcs": "NPC_", "weapons": "WPN_"}.get(sub)
            if prefix and not name.startswith(prefix):
                name = prefix + name  # e.g. "Sira.vrm" -> "CHR_Sira.vrm"
            target = dst / sub / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.stat().st_mtime < f.stat().st_mtime:
                shutil.copy2(f, target)
            size = f.stat().st_size / 1024 / 1024
            if size > 30:
                report.append(f"  ! {f.name} ใหญ่ {size:.0f} MB — แนะนำลดจำนวนโพลีกอน/ขนาด texture ใน VRoid (Export: ลด texture เป็น 1024)")
            found.append(f"{sub}/{name}")
            report.append(str(target.relative_to(ROOT)))
    # seamless ground/detail textures from GPT (Art/Textures/TEX_*.png)
    tex_src = ART / "Textures"
    if tex_src.exists():
        for f in sorted(tex_src.glob("TEX_*.png")):
            im = Image.open(f).convert("RGB")
            im = im.resize((1024, 1024), Image.LANCZOS)
            t = dst / "textures" / (f.stem + ".webp")
            t.parent.mkdir(parents=True, exist_ok=True)
            im.save(t, "WEBP", quality=88)
            found.append(f"textures/{f.stem}.webp")
            report.append(str(t.relative_to(ROOT)))
    dst.mkdir(parents=True, exist_ok=True)
    (dst / "models.json").write_text(json.dumps(found, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"โมเดล 3 มิติ: {len(found)} ไฟล์")


def main():
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    if not ART.exists():
        print("ไม่พบโฟลเดอร์ภาพ:", ART)
        return
    characters()
    companion()
    npcs()
    ui()
    items()
    weapons()
    relics()
    codex_and_scenes()
    models()
    files = [r for r in report if not r.startswith("  !")]
    total = sum((ROOT / r).stat().st_size for r in files)
    manifest = OUT / "manifest.json"
    manifest.write_text(json.dumps(sorted(files), ensure_ascii=False, indent=1), encoding="utf-8")
    for r in report:
        if r.startswith("  !"):
            print(r)
    print(f"นำเข้า {len(files)} ไฟล์ · รวม {total / 1024 / 1024:.1f} MB → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
