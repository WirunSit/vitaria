// Compresses the vertex / index data of .glb and .vrm files in place with EXT_meshopt_compression.
//   node tools/meshopt_glb.mjs <file.glb|file.vrm> ...
// Only the binary data of each bufferView is re-encoded: every node, mesh, accessor, material and image keeps its
// index, so the VRM extension (bones, expressions, spring bones by index) stays valid. The game decodes it with
// three.js's MeshoptDecoder (models/ModelLibrary.ts). Called by tools/compress_models.py after the texture pass.
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptEncoder } from 'meshoptimizer';

const EXT = 'EXT_meshopt_compression';
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const align = (n, a = 4) => (n + a - 1) & ~(a - 1);

function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  const bin = binStart + 8 <= buf.length ? buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart)) : Buffer.alloc(0);
  return { json, bin };
}

function writeGlb(json, bin) {
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc(align(js.length) - js.length, 0x20)]);
  const bn = Buffer.concat([bin, Buffer.alloc(align(bin.length) - bin.length)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bn.length, 0x004e4942), bn]);
}

/** How (and whether) each bufferView can be encoded: { mode, stride, count } or null. */
function plan(json) {
  const views = json.bufferViews ?? [];
  const use = views.map(() => ({ sizes: new Set(), index: false, tris: true, bad: false, n: 0 }));
  for (const a of json.accessors ?? []) {
    if (a.sparse) { use[a.sparse.indices.bufferView].bad = true; use[a.sparse.values.bufferView].bad = true; }
    if (a.bufferView === undefined) continue;
    const u = use[a.bufferView];
    u.n++;
    u.sizes.add(COMP[a.componentType] * NUM[a.type]);
  }
  for (const m of json.meshes ?? []) for (const p of m.primitives ?? []) {
    if (p.indices === undefined) continue;
    const v = json.accessors[p.indices].bufferView;
    if (v === undefined) continue;
    use[v].index = true;
    if ((p.mode ?? 4) !== 4) use[v].tris = false;
  }
  return views.map((v, i) => {
    const u = use[i];
    if (!u.n || u.bad || (v.buffer ?? 0) !== 0) return null;
    const stride = v.byteStride ?? (u.sizes.size === 1 ? [...u.sizes][0] : 0);
    if (!stride || v.byteLength % stride) return null;
    const count = v.byteLength / stride;
    if (u.index) {
      if (stride !== 2 && stride !== 4) return null;
      return { mode: u.tris && count % 3 === 0 ? 'TRIANGLES' : 'INDICES', stride, count };
    }
    if (stride % 4 || stride > 256) return null;
    return { mode: 'ATTRIBUTES', stride, count };
  });
}

function compress(file) {
  const src = readFileSync(file);
  const { json, bin } = readGlb(src);
  if ((json.extensionsUsed ?? []).includes(EXT)) return `${file}: already compressed`;
  if ((json.buffers ?? []).length !== 1 || json.buffers[0].uri) return `${file}: skipped (external buffers)`;
  const plans = plan(json);
  const parts = [];
  let size = 0, fallback = 0, packed = 0;
  const put = (data) => { const off = align(size, 8); if (off > size) parts.push(Buffer.alloc(off - size)); parts.push(data); size = off + data.length; return off; };
  json.bufferViews.forEach((v, i) => {
    const raw = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const p = plans[i];
    let enc = null;
    if (p) {
      try { enc = MeshoptEncoder.encodeGltfBuffer(new Uint8Array(raw), p.count, p.stride, p.mode); } catch { enc = null; }
      if (enc && enc.length > raw.length * 0.92) enc = null; // not worth a decode
    }
    if (!enc) { v.byteOffset = put(raw); v.buffer = 0; return; }
    const off = put(Buffer.from(enc.buffer, enc.byteOffset, enc.length));
    v.buffer = 1;
    v.byteOffset = fallback = align(fallback, 8);
    fallback += v.byteLength;
    v.extensions = { ...(v.extensions ?? {}), [EXT]: { buffer: 0, byteOffset: off, byteLength: enc.length, byteStride: p.stride, mode: p.mode, count: p.count } };
    packed++;
  });
  if (!packed) return `${file}: nothing to compress`;
  json.buffers[0].byteLength = size;
  json.buffers[1] = { byteLength: fallback, extensions: { [EXT]: { fallback: true } } };
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), EXT])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), EXT])];
  const out = writeGlb(json, Buffer.concat(parts));
  writeFileSync(file, out);
  return `${file}: ${(src.length / 1e6).toFixed(1)} -> ${(out.length / 1e6).toFixed(1)} MB (${packed} views)`;
}

await MeshoptEncoder.ready;
for (const f of process.argv.slice(2)) {
  try { console.log(compress(f)); } catch (e) { console.log(`${f}: FAILED ${e.message}`); process.exitCode = 1; }
}
