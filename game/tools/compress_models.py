"""
Makes the game's 3D models (public/assets/models/**/*.vrm, *.glb) download faster, in two sets:

  assets/models/    PC: original textures untouched; vertex / index data packed with EXT_meshopt_compression,
                    which is lossless (decodes to the exact same bytes), so the quality is the original's.
  assets/models_m/  phones: the same file with its textures shrunk (VRoid characters 1024 px, everything else
                    512 px, the sizes the game used to cut them to after downloading anyway) and stored as WebP.

Only bufferView bytes change: every node, mesh, material, texture and image keeps its index, so VRM bone /
expression / spring-bone data stays valid. Work already done is skipped, so it is safe to run again.
Geometry packing is tools/meshopt_glb.mjs (needs `npm install`).

    python tools/compress_models.py                       # every model
    python tools/compress_models.py public/.../a.vrm ...  # just these

import_assets.py runs it on models it copies in.
"""
import io
import json
import struct
import subprocess
import sys
from pathlib import Path

from PIL import Image

GAME = Path(__file__).resolve().parent.parent
MODELS = GAME / "public" / "assets" / "models"
MOBILE = GAME / "public" / "assets" / "models_m"
MOBILE_SIDE = {".vrm": 1024, ".glb": 512}
QUALITY = 88
EXT = "EXT_meshopt_compression"


def align(n: int, a: int = 8) -> int:
    return (n + a - 1) // a * a


def read_glb(data: bytes):
    if data[:4] != b"glTF":
        raise ValueError("not a GLB")
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    s = 20 + jlen
    blen = struct.unpack_from("<I", data, s)[0] if s + 8 <= len(data) else 0
    return j, data[s + 8:s + 8 + blen]


def write_glb(j: dict, bin_: bytes) -> bytes:
    js = json.dumps(j, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    js += b" " * (align(len(js), 4) - len(js))
    bin_ += b"\0" * (align(len(bin_), 4) - len(bin_))
    total = 12 + 8 + len(js) + 8 + len(bin_)
    return (b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I", len(js)) + b"JSON" + js
            + struct.pack("<I", len(bin_)) + b"BIN\0" + bin_)


def to_webp(raw: bytes, max_side: int) -> bytes:
    im = Image.open(io.BytesIO(raw))
    im.load()
    if max(im.size) > max_side:
        k = max_side / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    alpha = im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alpha else "RGB")
    if alpha and im.getchannel("A").getextrema()[0] == 255:
        im, alpha = im.convert("RGB"), False  # an alpha channel that is fully opaque everywhere
    out = io.BytesIO()
    # exact: keep the colour of fully transparent texels (cut-out hair would get dark fringes otherwise)
    im.save(out, "WEBP", quality=QUALITY, method=5, alpha_quality=100, exact=alpha)
    return out.getvalue()


def image_size(raw: bytes) -> int:
    try:
        return max(Image.open(io.BytesIO(raw)).size)
    except Exception:
        return 0


def shrink_textures(data: bytes, max_side: int) -> tuple[bytes, int]:
    """Phone copy: images bigger than max_side (or still PNG/JPEG) become smaller WebPs. Works on files whose
    geometry is already meshopt-packed too (those blocks are carried over and re-pointed)."""
    j, bin_ = read_glb(data)
    if len(j.get("buffers", [])) > 2:
        return data, 0
    views = j.get("bufferViews", [])
    new_bytes: dict[int, bytes] = {}
    for im in j.get("images", []):
        v = im.get("bufferView")
        if v is None or v in new_bytes or im.get("mimeType") not in ("image/png", "image/jpeg", "image/webp"):
            continue
        bv = views[v]
        raw = bin_[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        if im.get("mimeType") == "image/webp" and image_size(raw) <= max_side:
            continue
        try:
            webp = to_webp(raw, max_side)
        except Exception as e:  # unreadable image: leave it alone
            print(f"    ! image {v} kept ({e})")
            continue
        if len(webp) < len(raw):
            new_bytes[v] = webp
            for other in j["images"]:
                if other.get("bufferView") == v:
                    other["mimeType"] = "image/webp"
    if not new_bytes:
        return data, 0
    parts, size = [], 0

    def put(chunk: bytes) -> int:
        nonlocal size
        off = align(size)
        parts.append(b"\0" * (off - size))
        parts.append(chunk)
        size = off + len(chunk)
        return off

    for i, bv in enumerate(views):
        ext = bv.get("extensions", {}).get(EXT)
        if ext:  # meshopt block lives in buffer 0; the view itself points at the data-less fallback buffer
            ext["byteOffset"] = put(bin_[ext["byteOffset"]:ext["byteOffset"] + ext["byteLength"]])
            continue
        chunk = new_bytes.get(i) or bin_[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        bv["byteOffset"], bv["byteLength"] = put(chunk), len(chunk)
    j["buffers"][0]["byteLength"] = size
    return write_glb(j, b"".join(parts)), len(new_bytes)


def rel(f: Path) -> Path:
    return f.relative_to(MODELS)


def has_meshopt(f: Path) -> bool:
    with f.open("rb") as fh:
        head = fh.read(20)
        return EXT.encode() in fh.read(struct.unpack_from("<I", head, 12)[0])


def meshopt(files: list[Path]):
    # one node process per 40 files (keeps the command line under Windows' length limit)
    for i in range(0, len(files), 40):
        r = subprocess.run(["node", str(GAME / "tools" / "meshopt_glb.mjs"), *map(str, files[i:i + 40])],
                           cwd=GAME, capture_output=True, text=True, encoding="utf-8", errors="replace")
        for line in r.stdout.splitlines():
            if "FAILED" in line:
                print("  !", line)
        if r.returncode:
            print(r.stderr[-2000:])


def compress(files: list[Path]):
    files = [f for f in files if f.suffix.lower() in (".vrm", ".glb") and f.is_relative_to(MODELS)]
    if not files:
        return
    # 1. PC set: lossless geometry packing in place
    todo = [f for f in files if not has_meshopt(f)]
    before = sum(f.stat().st_size for f in todo)
    meshopt(todo)
    if todo:
        print(f"  PC: {len(todo)} ไฟล์ {before / 1e6:.0f} -> {sum(f.stat().st_size for f in todo) / 1e6:.0f} MB (เท็กซ์เจอร์เดิม)")
    # 2. phone set: the PC file with smaller WebP textures
    made, pc_mb, m_mb = 0, 0, 0
    for f in files:
        m = MOBILE / rel(f)
        if m.exists() and m.stat().st_mtime >= f.stat().st_mtime:
            continue
        data = f.read_bytes()
        out, n = shrink_textures(data, MOBILE_SIDE[f.suffix.lower()])
        m.parent.mkdir(parents=True, exist_ok=True)
        m.write_bytes(out)
        made, pc_mb, m_mb = made + 1, pc_mb + len(data), m_mb + len(out)
    if made:
        print(f"  มือถือ: {made} ไฟล์ {pc_mb / 1e6:.0f} -> {m_mb / 1e6:.0f} MB")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = [Path(a).resolve() for a in sys.argv[1:]]
    compress(args or sorted(p for p in MODELS.rglob("*") if p.suffix.lower() in (".vrm", ".glb")))
    # phone copies of models that were removed from the game
    for m in [p for p in MOBILE.rglob("*") if p.is_file()] if not args and MOBILE.exists() else []:
        if not (MODELS / m.relative_to(MOBILE)).exists():
            m.unlink()


if __name__ == "__main__":
    main()
