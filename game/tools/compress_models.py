"""
Shrinks the game's 3D models (public/assets/models/**/*.vrm, *.glb) so they download faster, in place:
  1. textures: PNG / JPEG inside the file -> WebP (alpha kept losslessly, capped at 2048 px)
  2. vertex / index data -> EXT_meshopt_compression (tools/meshopt_glb.mjs, needs `npm install`)
Nothing else in the file moves: every node, mesh, material, texture and image keeps its index, so VRM bone /
expression / spring-bone data stays valid. Files already done are skipped, so it is safe to run again.

    python tools/compress_models.py            # every model
    python tools/compress_models.py a.vrm ...  # just these

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
MAX_SIDE = 2048
QUALITY = 90


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


def to_webp(raw: bytes) -> bytes | None:
    im = Image.open(io.BytesIO(raw))
    im.load()
    if max(im.size) > MAX_SIDE:
        k = MAX_SIDE / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    alpha = im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alpha else "RGB")
    if alpha and im.getchannel("A").getextrema()[0] == 255:
        im, alpha = im.convert("RGB"), False  # an alpha channel that is fully opaque everywhere
    out = io.BytesIO()
    # exact: keep the colour of fully transparent texels (cut-out hair would get dark fringes otherwise)
    im.save(out, "WEBP", quality=QUALITY, method=5, alpha_quality=100, exact=alpha)
    return out.getvalue()


def webp_pass(path: Path) -> tuple[int, int, int]:
    """Re-encodes the file's PNG/JPEG images; returns (bytes before, bytes after, images changed)."""
    data = path.read_bytes()
    j, bin_ = read_glb(data)
    if "EXT_meshopt_compression" in j.get("extensionsUsed", []) or len(j.get("buffers", [])) != 1:
        return len(data), len(data), 0
    views = j.get("bufferViews", [])
    new_bytes: dict[int, bytes] = {}
    for im in j.get("images", []):
        v = im.get("bufferView")
        if v is None or im.get("mimeType") not in ("image/png", "image/jpeg") or v in new_bytes:
            continue
        bv = views[v]
        raw = bin_[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        try:
            webp = to_webp(raw)
        except Exception as e:  # unreadable image: leave it alone
            print(f"    ! {path.name}: image {v} kept ({e})")
            continue
        if webp and len(webp) < len(raw) * 0.9:
            new_bytes[v] = webp
            for other in j["images"]:
                if other.get("bufferView") == v:
                    other["mimeType"] = "image/webp"
    if not new_bytes:
        return len(data), len(data), 0
    parts, size = [], 0
    for i, bv in enumerate(views):
        chunk = new_bytes.get(i) or bin_[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        off = align(size)
        parts.append(b"\0" * (off - size))
        parts.append(chunk)
        bv["byteOffset"], bv["byteLength"] = off, len(chunk)
        size = off + len(chunk)
    j["buffers"][0]["byteLength"] = size
    out = write_glb(j, b"".join(parts))
    path.write_bytes(out)
    return len(data), len(out), len(new_bytes)


def rel(f: Path) -> str:
    return str(f.relative_to(MODELS)) if f.is_relative_to(MODELS) else f.name


def compress(files: list[Path]):
    files = [f for f in files if f.suffix.lower() in (".vrm", ".glb")]
    if not files:
        return
    before = sum(f.stat().st_size for f in files)
    for f in files:
        a, b, n = webp_pass(f)
        if n:
            print(f"  webp  {rel(f)}: {a / 1e6:.1f} -> {b / 1e6:.1f} MB ({n} images)")
    # geometry: one node process for all files (the command line is split to stay under Windows' length limit)
    for i in range(0, len(files), 40):
        r = subprocess.run(["node", str(GAME / "tools" / "meshopt_glb.mjs"), *map(str, files[i:i + 40])],
                           cwd=GAME, capture_output=True, text=True, encoding="utf-8", errors="replace")
        for line in r.stdout.splitlines():
            if "->" in line or "FAILED" in line:
                print("  mesh ", line.replace(str(MODELS) + "\\", "").replace(str(MODELS) + "/", ""))
        if r.returncode:
            print(r.stderr[-2000:])
    after = sum(f.stat().st_size for f in files)
    print(f"โมเดล {len(files)} ไฟล์: {before / 1e6:.0f} MB -> {after / 1e6:.0f} MB")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = [Path(a).resolve() for a in sys.argv[1:]]
    compress(args or sorted(p for p in MODELS.rglob("*") if p.suffix.lower() in (".vrm", ".glb")))


if __name__ == "__main__":
    main()
