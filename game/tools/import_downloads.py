"""
Import the free models the user picked (tools/model_picks.json) from Assets/_Project/Downloads.

Drop each download into Assets/_Project/Downloads without renaming it:
  * Sketchfab: the "glTF" zip (its file name is the model's slug, e.g. stylized-treasure-chest.zip)
  * or a folder named after the pick code (e.g. Downloads/RK-11/) holding a .gltf/.glb

For every pick that has a download, this script extracts it, simplifies it to the polygon budget,
shrinks textures to 1024 px WebP (gltf-transform via npx) and writes
Assets/_Project/Models/<dir>/<name>.glb. Then it writes the credits (CC BY needs attribution):
Assets/_Project/Models/CREDITS.md and game/public/data/credits.json.
Finally run tools/import_assets.py to copy the models into the game.

usage: python tools/import_downloads.py [CODE ...]
       python tools/import_downloads.py --lod [CODE ...]   (only rebuild the distance LOD copies)
"""
from __future__ import annotations

import json
import re
import shutil
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GAME = ROOT / "game"
DL = ROOT / "Assets" / "_Project" / "Downloads"
MODELS = ROOT / "Assets" / "_Project" / "Models"
WORK = DL / "_extracted"
PICKS = json.loads((GAME / "tools" / "model_picks.json").read_text(encoding="utf-8"))["picks"]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def slug_of(p: dict) -> str:
    m = re.search(r"/3d-models/(.+)-[0-9a-f]{32}$", p["url"])
    return m.group(1) if m else ""


def find_source(p: dict) -> Path | None:
    folder = DL / p["code"]
    if folder.is_dir():
        return folder
    slug = slug_of(p)
    if not slug:
        return None
    for z in DL.glob("*.zip"):
        stem = norm(re.sub(r"\s*\(\d+\)$", "", z.stem))  # "name (1).zip" from repeated downloads
        if stem == slug or stem.startswith(slug) or (len(stem) > 6 and slug.startswith(stem)):
            return z
    return None


def model_file(src: Path, code: str) -> Path | None:
    if src.suffix.lower() == ".zip":
        dst = WORK / code
        if dst.exists():
            shutil.rmtree(dst)
        with zipfile.ZipFile(src) as zf:
            zf.extractall(dst)
        src = dst
    files = sorted(src.rglob("*.glb")) or sorted(src.rglob("*.gltf"))
    return files[0] if files else None


def npx(*args: str):
    r = subprocess.run(["npx", "-y", "@gltf-transform/cli", *args], cwd=GAME, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=sys.platform == "win32")
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout).strip()[-600:])


def glb_json(path: Path) -> dict:
    data = path.read_bytes()
    n = struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:20 + n])


def edit_json(path: Path, fn) -> bool:
    """Rewrite the JSON chunk of a .glb in place; fn(json) returns True when it changed something."""
    data = path.read_bytes()
    n = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + n])
    if not fn(j):
        return False
    rest = data[20 + n:]
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    path.write_bytes(struct.pack("<III", 0x46546C67, 2, 20 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest)
    return True


def fix_unlit_emissive(j: dict) -> bool:
    """Some unlit models paint with a black base colour + an emissive texture; three.js ignores emissive on unlit
    materials (→ solid black), so move that texture into the base-colour slot."""
    changed = False
    for m in j.get("materials", []):
        pbr = m.setdefault("pbrMetallicRoughness", {})
        base = pbr.get("baseColorFactor", [1, 1, 1, 1])
        if "emissiveTexture" in m and "baseColorTexture" not in pbr and max(base[:3]) < 0.05:
            pbr["baseColorTexture"] = m.pop("emissiveTexture")
            pbr["baseColorFactor"] = [1, 1, 1, base[3] if len(base) > 3 else 1]
            m.pop("emissiveFactor", None)
            changed = True
    return changed


def flip_winding(path: Path):
    """Reverse every triangle (inside-out models); normals are stripped too so the game recomputes them."""
    data = bytearray(path.read_bytes())
    n = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + n])
    bin_start = 20 + n + 8  # after the BIN chunk header
    fmt = {5121: "B", 5123: "H", 5125: "I"}
    for mesh in j.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" not in prim:
                continue
            acc = j["accessors"][prim["indices"]]
            view = j["bufferViews"][acc["bufferView"]]
            f = fmt[acc["componentType"]]
            size = struct.calcsize(f)
            off = bin_start + view.get("byteOffset", 0) + acc.get("byteOffset", 0)
            for t in range(acc["count"] // 3):
                a, b = off + (t * 3 + 1) * size, off + (t * 3 + 2) * size
                va, vb = struct.unpack_from("<" + f, data, a)[0], struct.unpack_from("<" + f, data, b)[0]
                struct.pack_into("<" + f, data, a, vb)
                struct.pack_into("<" + f, data, b, va)
    path.write_bytes(bytes(data))

    def strip_normals(js: dict) -> bool:
        for m in js.get("meshes", []):
            for prim in m.get("primitives", []):
                prim["attributes"].pop("NORMAL", None)
        return True
    edit_json(path, strip_normals)


def drop_nodes(path: Path, prefixes: list[str]):
    """Detach meshes whose node name starts with one of `prefixes` (e.g. a giant water-spray sim, a second model in a pack)."""
    def fn(j: dict) -> bool:
        hit = [n for n in j.get("nodes", []) if "mesh" in n and any(n.get("name", "").startswith(px) for px in prefixes)]
        for n in hit:
            del n["mesh"]
        return bool(hit)
    edit_json(path, fn)


def triangles(path: Path) -> int:
    j = glb_json(path)
    acc = j.get("accessors", [])
    total = 0
    for mesh in j.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if prim.get("mode", 4) != 4:
                continue
            if "indices" in prim:
                total += acc[prim["indices"]]["count"] // 3
            else:
                total += acc[prim["attributes"]["POSITION"]]["count"] // 3
    return total


def process(p: dict) -> str:
    src = find_source(p)
    if not src:
        return "ยังไม่มีไฟล์"
    mf = model_file(src, p["code"])
    if not mf:
        return f"ไม่พบ .gltf/.glb ใน {src.name} (ตอนดาวน์โหลดให้เลือก glTF)"
    WORK.mkdir(parents=True, exist_ok=True)
    raw = WORK / f"{p['code']}_raw.glb"
    npx("copy", str(mf), str(raw))
    if "KHR_materials_pbrSpecularGlossiness" in glb_json(raw).get("extensionsUsed", []):
        # three.js dropped spec/gloss materials (their colour texture would be ignored) → convert to metal/rough
        npx("metalrough", str(raw), str(raw))
    if p.get("drop"):
        drop_nodes(raw, p["drop"])
    edit_json(raw, fix_unlit_emissive)
    if p.get("insideOut"):
        flip_winding(raw)
    if p.get("baseColor"):  # recolour untextured models whose original colour reads as black under toon shading
        def recolour(j: dict) -> bool:
            for m in j.get("materials", []):
                m.setdefault("pbrMetallicRoughness", {})["baseColorFactor"] = p["baseColor"] + [1]
            return True
        edit_json(raw, recolour)
    tris = triangles(raw)
    ratio = min(1.0, p["faces"] / max(tris, 1))
    out = MODELS / p["dir"] / f"{p['name']}.glb"
    out.parent.mkdir(parents=True, exist_ok=True)
    opts = ["--compress", "false", "--texture-compress", "webp", "--texture-size", "1024", "--palette", "false"]
    if ratio < 0.98:
        opts += ["--simplify", "true", "--simplify-ratio", f"{ratio:.3f}", "--simplify-error", "0.01"]
    else:
        opts += ["--simplify", "false"]
    if p.get("pack"):  # keep each rock/tree a separate node so the game can scatter them one by one
        opts += ["--flatten", "false", "--join", "false", "--instance", "false"]
    npx("optimize", str(raw), str(out), *opts)
    after = triangles(out)
    lod = make_lod(p, out, after)
    return f"OK {tris:,} → {after:,} โพลี · {out.stat().st_size / 1e6:.1f} MB → {out.relative_to(ROOT)}{lod}"


def make_lod(p: dict, out: Path, tris: int) -> str:
    """Low-detail copy (<name>_lod.glb) that the game swaps in at a distance: ~15–30 % of the triangles, 256 px
    textures. Props and nature only — enemies/NPCs are near the player when they matter (and rigs don't simplify well)."""
    lod = out.with_name(f"{p['name']}_lod.glb")
    if p["dir"] not in ("Props", "Nature") or tris < 1500:
        lod.unlink(missing_ok=True)
        return ""
    ratio = 0.2 if p.get("pack") else max(0.08, min(0.3, 3000 / tris))
    opts = ["--compress", "false", "--texture-compress", "webp", "--texture-size", "256", "--palette", "false",
            "--simplify", "true", "--simplify-ratio", f"{ratio:.3f}", "--simplify-error", "0.2"]
    if p.get("pack"):
        opts += ["--flatten", "false", "--join", "false", "--instance", "false"]
    npx("optimize", str(out), str(lod), *opts)
    low = triangles(lod)
    if low > tris * 0.6:  # made of many loose pieces (leaf cards, ropes): simplifying barely helps, distance culling does
        lod.unlink()
        return f" · LOD ไม่คุ้ม ({low:,}) — ใช้การซ่อนตามระยะแทน"
    return f" · LOD {low:,}"


def credits():
    done = [p for p in PICKS if (MODELS / p["dir"] / f"{p['name']}.glb").exists()]
    # VRoid Hub characters (tools/vroid_picks.json) — credited even when the model's terms don't require it
    vroid = json.loads((Path(__file__).parent / "vroid_picks.json").read_text(encoding="utf-8"))
    done += [p for p in vroid if (MODELS / p["dir"] / p["file"]).exists()]
    # music and sound effects (tools/audio_credits.json)
    done += json.loads((Path(__file__).parent / "audio_credits.json").read_text(encoding="utf-8"))
    lines = ["# เครดิตโมเดล 3D เพลง และเสียงฟรี", "", "โมเดลเหล่านี้ใช้ภายใต้สัญญาอนุญาตของผู้สร้าง (CC BY ต้องระบุชื่อผู้สร้าง · CC BY-SA ต้องแจกงานดัดแปลงด้วยสัญญาเดียวกัน)", "",
             "| ไฟล์ในเกม | ชื่อโมเดล | ผู้สร้าง | สัญญาอนุญาต | แหล่ง |", "|---|---|---|---|---|"]
    for p in done:
        lines.append(f"| `{p['name']}` | {p['title']} | {p['author']} | {p['license']} | [{p['src']}]({p['url']}) |")
    (MODELS / "CREDITS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    data = [{k: p[k] for k in ("name", "title", "author", "license", "src", "url")} for p in done]
    (GAME / "public" / "data" / "credits.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nเครดิต: {len(done)} รายการ → Assets/_Project/Models/CREDITS.md, game/public/data/credits.json")


def lods_only(only: set[str]):
    """--lod: (re)build the low-detail copies from the already imported models, without re-downloading/optimising."""
    for p in PICKS:
        out = MODELS / p["dir"] / f"{p['name']}.glb"
        if (only and p["code"] not in only) or not out.exists():
            continue
        try:
            print(p["code"], p["name"], make_lod(p, out, triangles(out)) or "· ไม่ต้องมี LOD")
        except Exception as e:
            print(p["code"], p["name"], f"ผิดพลาด: {e}")


def main():
    if "--lod" in sys.argv:
        return lods_only(set(a for a in sys.argv[1:] if a != "--lod"))
    only = set(sys.argv[1:])
    missing = []
    for p in PICKS:
        if only and p["code"] not in only:
            continue
        try:
            msg = process(p)
        except Exception as e:  # keep going; report at the end
            msg = f"ผิดพลาด: {e}"
        if msg == "ยังไม่มีไฟล์":
            missing.append(p)
        else:
            print(f"{p['code']} {p['name']}: {msg}")
    if missing:
        print(f"\nยังไม่ได้ดาวน์โหลด {len(missing)} ชิ้น:")
        for p in missing:
            print(f"  {p['code']}  {p['title']}  {p['url']}")
    credits()


if __name__ == "__main__":
    main()
