import * as THREE from 'three';
import { addOutline } from '../world/Materials';
import { hasModel, loadGLB, modelUrl, refreshSkins, toonify } from './ModelLibrary';

/**
 * Drop-in 3D replacements for buildings and props.
 * Every procedural landmark calls `propSlot(group, 'BLD_Name', fit)`. When `assets/models/props/BLD_Name.glb`
 * exists (from AI image-to-3D), the procedural meshes are hidden and the model takes their place.
 * Children flagged `userData.keep` (glowing cores, doors that animate, portals…) stay visible.
 */
export interface PropFit {
  /** target height (m) */
  h?: number;
  /** target footprint — the larger of width/depth (m) */
  w?: number;
  yaw?: number;
  y?: number;
  outline?: number;
  /** with both w and h: scale the footprint to w and the height to h separately (a bridge made longer, not taller) */
  stretch?: boolean;
  /** the file is a pack of several objects (houses, signs…): keep only piece N (wraps around) */
  piece?: number | number[];
}

const slots = new WeakMap<THREE.Object3D, THREE.Object3D>();

/** Pack files: walk down single-child wrappers to the list of objects, then keep one of them. */
function keepPiece(root: THREE.Object3D, piece: number | number[]) {
  let node = root;
  while (node.children.length === 1) node = node.children[0];
  const parts = node.children.filter((c) => { let mesh = false; c.traverse((o) => { if ((o as THREE.Mesh).isMesh) mesh = true; }); return mesh; });
  if (parts.length < 2) return;
  const want = (Array.isArray(piece) ? piece : [piece]).map((i) => parts[((i % parts.length) + parts.length) % parts.length]);
  for (const c of parts) if (!want.includes(c)) c.removeFromParent();
}

export function hasProp(name: string) { return hasModel(`props/${name}.glb`); }

export function propSlot(holder: THREE.Object3D, name: string, fit: PropFit): Promise<boolean> {
  const file = `props/${name}.glb`;
  if (!hasModel(file)) return Promise.resolve(false);
  const lodFile = `props/${name}_lod.glb`;
  return Promise.all([loadGLB(file), hasModel(lodFile) ? loadGLB(lodFile) : Promise.resolve(null)]).then(([obj, low]) => {
    if (!obj) return false;
    if (fit.piece !== undefined) keepPiece(obj, fit.piece);
    if (low && fit.piece !== undefined) keepPiece(low, fit.piece);
    toonify(obj);
    refreshSkins(obj); // rigged props (an animated skeleton) measure through their bones
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (fit.stretch && fit.w && fit.h) {
      const sw = fit.w / Math.max(size.x, size.z);
      obj.scale.multiply(new THREE.Vector3(sw, fit.h / size.y, sw));
      s = 1;
    } else if (fit.w && fit.h) s = Math.min(fit.w / Math.max(size.x, size.z), fit.h / size.y);
    else if (fit.w) s = fit.w / Math.max(size.x, size.z);
    else if (fit.h) s = fit.h / size.y;
    obj.scale.multiplyScalar(s);
    refreshSkins(obj);
    const b2 = new THREE.Box3().setFromObject(obj);
    const c = b2.getCenter(new THREE.Vector3());
    obj.position.set(obj.position.x - c.x, obj.position.y - b2.min.y, obj.position.z - c.z);
    const wrap = new THREE.Group();
    wrap.name = `prop:${name}`;
    wrap.add(distanceSwitch(obj, low, b2.getSize(new THREE.Vector3()).length(), fit.outline === 0 ? 0 : fit.outline ?? 0.03));
    wrap.rotation.y = fit.yaw ?? 0;
    wrap.position.y = fit.y ?? 0;
    const old = slots.get(holder);
    if (old) old.removeFromParent();
    for (const ch of holder.children) if (!ch.userData.keep && !ch.name.startsWith('prop:')) ch.visible = false;
    holder.add(wrap);
    slots.set(holder, wrap);
    return true;
  });
}

/**
 * Distance switch for a placed model (three.js picks the level per frame from the camera distance):
 * full detail up close, the low-detail copy past a few times its size, nothing once it is lost in the fog.
 * Big landmarks stay visible further than small props.
 */
function distanceSwitch(hi: THREE.Object3D, low: THREE.Object3D | null, size: number, outline: number): THREE.LOD {
  const lod = new THREE.LOD();
  // the black inverted-hull outline doubles a model's triangles: detailed (already textured) models skip it
  if (outline && triangles(hi) <= OUTLINE_MAX_TRIS) addOutline(hi, outline);
  lod.addLevel(hi, 0);
  if (low) {
    toonify(low);
    low.scale.copy(hi.scale);
    low.position.copy(hi.position);
    low.quaternion.copy(hi.quaternion);
    if (outline) addOutline(low, outline);
    lod.addLevel(low, Math.max(30, size * 3));
  }
  lod.addLevel(new THREE.Object3D(), Math.min(360, Math.max(120, size * 25)));
  return lod;
}

const OUTLINE_MAX_TRIS = 20000;

function triangles(root: THREE.Object3D) {
  let t = 0;
  root.traverse((o) => { const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null; if (g) t += (g.index ? g.index.count : g.attributes.position.count) / 3; });
  return t;
}

/** Ground detail texture (seamless, light, low contrast) multiplied over the terrain's vertex colours. */
export function applyDetailTexture(mat: THREE.MeshToonMaterial, name: string, repeat: number) {
  const rel = `textures/${name}.webp`;
  if (!hasModel(rel)) return;
  new THREE.TextureLoader().load(modelUrl(rel), (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    mat.map = t;
    mat.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ hinged chest lids
const lidSplits = new Map<string, { body: THREE.BufferGeometry; lid: THREE.BufferGeometry } | null>();

/** A copy of `geo` drawing only the listed triangles (vertex data is shared, only the index is new). */
function subsetGeometry(geo: THREE.BufferGeometry, tris: number[], index: ArrayLike<number>): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) out.setAttribute(name, attr);
  const idx: number[] = [];
  for (const t of tris) idx.push(index[t * 3], index[t * 3 + 1], index[t * 3 + 2]);
  out.setIndex(idx);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * Split a one-piece chest mesh into body + lid. Prefers whole pieces (the lid is usually its own island of
 * triangles) lying above `seam` (a height in the mesh's own units); falls back to cutting triangles above it.
 */
function splitLid(geo: THREE.BufferGeometry, toLocal: (v: THREE.Vector3) => THREE.Vector3, seam: number, box: THREE.Box3, mode: 'auto' | 'cut' | 'pieces') {
  const minY = box.min.y;
  const key = `${geo.uuid}:${seam.toFixed(4)}:${mode}`;
  if (lidSplits.has(key)) return lidSplits.get(key)!;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const index: ArrayLike<number> = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const nTri = Math.floor(index.length / 3);
  const v = new THREE.Vector3();
  const ys = new Float32Array(pos.count), xs = new Float32Array(pos.count), zs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const p = toLocal(v.fromBufferAttribute(pos, i)); xs[i] = p.x; ys[i] = p.y; zs[i] = p.z; }
  // islands: vertices joined by triangles, plus vertices at the same spot (UV seams split vertices)
  const parent = new Int32Array(pos.count).map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const join = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const spot = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    const j = spot.get(k);
    if (j === undefined) spot.set(k, i); else join(i, j);
  }
  for (let t = 0; t < nTri; t++) { join(index[t * 3], index[t * 3 + 1]); join(index[t * 3], index[t * 3 + 2]); }
  const lowest = new Map<number, number>();
  for (let i = 0; i < pos.count; i++) { const r = find(i); lowest.set(r, Math.min(lowest.get(r) ?? Infinity, ys[i])); }
  const H = seam - minY;
  let lid: number[] = [], body: number[] = [];
  // a lid piece starts near the seam; detail pieces (studs on the lid) must sit right at it or above
  const above = mode === 'pieces' ? seam - H * 0.08 : minY + H * 0.75;
  for (let t = 0; t < nTri; t++) (lowest.get(find(index[t * 3]))! > above ? lid : body).push(t);
  // pieces up there must cover the top to be the lid (not just handles, a lock plate or an ornament)
  const lb = new THREE.Box3();
  for (const t of lid) for (let k = 0; k < 3; k++) { const i = index[t * 3 + k]; lb.expandByPoint(v.set(xs[i], ys[i], zs[i])); }
  const covers = !lb.isEmpty() && lb.max.x - lb.min.x > (box.max.x - box.min.x) * 0.7 && lb.max.z - lb.min.z > (box.max.z - box.min.z) * 0.6;
  if (mode === 'cut' || (mode === 'auto' && (!covers || lid.length < nTri * 0.05 || lid.length > nTri * 0.7))) {
    // welded into one piece: cut at the seam
    lid = []; body = [];
    for (let t = 0; t < nTri; t++) {
      const c = (ys[index[t * 3]] + ys[index[t * 3 + 1]] + ys[index[t * 3 + 2]]) / 3;
      (c > seam ? lid : body).push(t);
    }
  }
  const res = lid.length && body.length ? { body: subsetGeometry(geo, body, index), lid: subsetGeometry(geo, lid, index) } : null;
  lidSplits.set(key, res);
  return res;
}

/**
 * Turn a chest model's lid into a hinged group (pivot on the lid's back edge, model -Z = back) so it can swing
 * open with `rotation.x < 0`. Uses a part named like a lid ("Top", "Lid") when there is one, otherwise splits it
 * off the mesh. `seamFrac` = where the lid starts, as a fraction of the chest's height.
 */
export function chestLid(model: THREE.Object3D, seamFrac = 0.55, mode: 'auto' | 'cut' = 'auto'): THREE.Group | null {
  model.updateMatrixWorld(true);
  const inv = model.matrixWorld.clone().invert();
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.isOutline) meshes.push(o as THREE.Mesh); });
  if (!meshes.length) return null;
  const box = new THREE.Box3();
  const local = (m: THREE.Mesh) => new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
  for (const m of meshes) {
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!.clone().applyMatrix4(local(m)));
  }
  const seam = box.min.y + (box.max.y - box.min.y) * seamFrac;
  const M = new THREE.Matrix4(), v = new THREE.Vector3();
  /** move the part of `m` that belongs to the lid into a sibling mesh; returns that mesh */
  const cutOff = (m: THREE.Mesh, how: 'auto' | 'cut' | 'pieces') => {
    M.copy(local(m));
    const split = splitLid(m.geometry, (p) => v.copy(p).applyMatrix4(M), seam, box, how);
    if (!split) return null;
    const lidMesh = m.clone();
    lidMesh.geometry = split.lid;
    for (const c of lidMesh.children) if (c.userData.isOutline) (c as THREE.Mesh).geometry = split.lid;
    m.geometry = split.body;
    for (const c of m.children) if (c.userData.isOutline) (c as THREE.Mesh).geometry = split.body;
    m.parent!.add(lidMesh);
    return lidMesh;
  };
  const named = (m: THREE.Mesh) => /(^|[^a-z])(top|lid)/i.test(m.name);
  let parts: THREE.Mesh[] = meshes.filter(named);
  if (parts.length) {
    // studs, straps and trims of the lid often live in a separate "details" mesh: take the pieces up there too
    for (const m of meshes) if (!named(m)) { const extra = cutOff(m, 'pieces'); if (extra) parts.push(extra); }
  } else {
    // one-piece chest: the biggest mesh is the chest itself
    const m = meshes.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
    const lidMesh = cutOff(m, mode);
    if (!lidMesh) return null;
    parts = [lidMesh];
  }
  // hinge along the lid's lowest back edge
  model.updateMatrixWorld(true);
  const lb = new THREE.Box3();
  for (const p of parts) { if (!p.geometry.boundingBox) p.geometry.computeBoundingBox(); lb.union(p.geometry.boundingBox!.clone().applyMatrix4(local(p))); }
  const pivot = new THREE.Group();
  pivot.name = 'lid-hinge';
  pivot.position.set((lb.min.x + lb.max.x) / 2, lb.min.y, lb.min.z);
  model.add(pivot);
  pivot.updateMatrixWorld(true);
  for (const p of parts) pivot.attach(p);
  return pivot;
}

/** The detailed + low-detail copies placed by `propSlot` in `holder` (empty until the model has loaded). */
export function propLevels(holder: THREE.Object3D): THREE.Object3D[] {
  const wrap = slots.get(holder);
  const lod = wrap?.children[0] as THREE.LOD | undefined;
  return lod?.levels ? lod.levels.map((l) => l.object).filter((o) => o.children.length || (o as THREE.Mesh).isMesh) : [];
}
