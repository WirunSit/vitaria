import * as THREE from 'three';
import { hasModel, loadGLB, toonify } from '../models/ModelLibrary';
import { WIND } from './Nature';

/**
 * Downloaded trees, bushes and rocks (assets/models/nature/NAT_*.glb) drawn as instanced meshes that keep their
 * painted textures. A pack file is split into one variant per piece; other files are one variant each.
 * Every variant is normalised to height 1 standing on y = 0, so a spot's `scale` is its height in metres.
 *
 * Performance: placements are cut into map tiles (CELL m) so the camera only draws tiles in view; each tile swaps
 * to the low-detail copy (<file>_lod.glb, made by tools/import_downloads.py) past `lodDist`, stops casting
 * shadows past SHADOW_DIST and is hidden past `far`. `updateFlora()` runs that check a few times a second.
 */

export interface FloraSpot { x: number; y: number; z: number; rot: number; scale: number }
interface Variant { name: string; parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[]; radius: number }

export interface FloraSet {
  file: string;
  /** split the file into one variant per mesh piece (rock/tree packs) */
  split?: boolean;
  /** keep only pieces whose name matches */
  only?: RegExp;
  /** foliage sway strength (0 = rigid, e.g. rocks) */
  sway?: number;
  /** 0..1: whiten surfaces that face up (snow-dusted pines) */
  snow?: number;
  /** recolour by brightness into this colour (e.g. ice crystals → the valley's gold calcite) */
  tint?: string;
  /** recolour only the foliage (bright, saturated texels) into a green range "from,to" — trunks keep their colour */
  foliage?: [string, string];
  /** hide beyond this distance (m); small things go first */
  far?: number;
  /** switch to the low-detail copy beyond this distance (m) */
  lodDist?: number;
}

const CELL = 40;
const SHADOW_DIST = 50; // the sun's shadow box only reaches ~45 m around the player

/** The hand-painted tree pack (TE-01); its "5" variants read blue-teal so they are left out. */
export const PAINTED_TREES: FloraSet = { file: 'NAT_TreesPainted', split: true, only: /^TR[SWT][1-4]_/, sway: 0.035, far: 300 };

const cache = new Map<string, Promise<Variant[]>>();

export function hasFlora(file: string) { return hasModel(`nature/${file}.glb`); }

function pieceName(o: THREE.Object3D) {
  // a multi-material mesh loads as a group "Name" holding "Name_1", "Name_2"…: they are one piece
  const p0 = o.parent && o.name.startsWith(`${o.parent.name}_`) ? o.parent : o;
  for (let p: THREE.Object3D | null = p0; p; p = p.parent) if (p.name && !/^Object_\d+$/.test(p.name)) return p.name;
  return o.name;
}

function loadVariants(set: FloraSet, lod = false): Promise<Variant[]> {
  const file = `nature/${set.file}${lod ? '_lod' : ''}.glb`;
  if (lod && !hasModel(file)) return Promise.resolve([]);
  const key = `${file}|${set.split}|${set.only}|${set.sway}|${set.snow}|${set.tint}|${set.foliage}`;
  if (!cache.has(key)) {
    cache.set(key, loadGLB(file).then((root) => {
      if (!root) return [];
      toonify(root);
      // double-sided see-through leaves would otherwise draw twice (back pass + front pass)
      root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.forceSinglePass = true; });
      root.updateMatrixWorld(true);
      const groups = new Map<string, THREE.Mesh[]>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const name = set.split ? pieceName(m) : set.file;
        if (set.only && !set.only.test(name)) return;
        (groups.get(name) ?? groups.set(name, []).get(name)!).push(m);
      });
      const out: Variant[] = [];
      for (const [name, meshes] of groups) {
        const geos = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
        const box = new THREE.Box3();
        for (const g of geos) { g.computeBoundingBox(); box.union(g.boundingBox!); }
        const size = box.getSize(new THREE.Vector3());
        if (size.y < 1e-6) continue; // flat ground decals
        const c = box.getCenter(new THREE.Vector3());
        const s = 1 / size.y;
        const fix = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
        out.push({
          name,
          radius: (Math.max(size.x, size.z) * s) / 2,
          parts: geos.map((g, i) => ({ geo: g.applyMatrix4(fix), mat: floraMaterial(meshes[i].material as THREE.Material, set) })),
        });
      }
      return out;
    }));
  }
  return cache.get(key)!;
}

const matCache = new Map<string, THREE.Material>();
/**
 * Clone of a toon material for instanced flora: upper vertices sway in the wind (height is 0..1 in the normalised
 * variant), up-facing surfaces can be dusted with snow, and the colour can be re-tinted by brightness.
 */
function floraMaterial(src: THREE.Material, set: FloraSet): THREE.Material {
  const sway = set.sway ?? 0, snow = set.snow ?? 0, tint = set.tint, fol = set.foliage;
  if (sway <= 0 && snow <= 0 && !tint && !fol) return src;
  const key = `${src.uuid}|${sway}|${snow}|${tint}|${fol}`;
  const fa = new THREE.Color(fol?.[0] ?? '#000'), fb = new THREE.Color(fol?.[1] ?? '#000');
  const v3 = (c: THREE.Color) => `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`;
  if (matCache.has(key)) return matCache.get(key)!;
  const m = src.clone() as THREE.MeshToonMaterial;
  if (tint) m.emissive = new THREE.Color(tint).multiplyScalar(0.12);
  const tc = new THREE.Color(tint ?? '#ffffff');
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vSnow;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float hgt = max(0.0, transformed.y);
        float w = sin(uTime * 1.4 + ip.x * 0.31 + ip.z * 0.23) + 0.35 * sin(uTime * 3.1 + ip.x * 0.7);
        transformed.x += w * ${sway.toFixed(3)} * hgt * hgt;
        transformed.z += cos(uTime * 1.2 + ip.z * 0.27) * ${(sway * 0.6).toFixed(3)} * hgt * hgt;
        vSnow = smoothstep(0.3, 0.75, normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal).y); // the raw attribute: unlit (MeshBasic) shaders have no objectNormal`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSnow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${tint ? `float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = vec3(${tc.r.toFixed(3)}, ${tc.g.toFixed(3)}, ${tc.b.toFixed(3)}) * (0.45 + lum * 1.2);` : ''}
        ${fol ? `{
          // foliage = saturated texels of any hue except dark red-brown (bark); redder / brighter leaves → the lighter green
          vec3 c = diffuseColor.rgb;
          float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
          float bark = step(c.b, c.g) * step(c.g, c.r) * (1.0 - smoothstep(0.2, 0.34, mx));
          float leaf = smoothstep(0.03, 0.09, mx) * smoothstep(0.3, 0.5, (mx - mn) / max(mx, 0.001)) * (1.0 - bark);
          vec3 gcol = mix(${v3(fa)}, ${v3(fb)}, clamp((c.r - c.g) * 1.2 + mx * 0.7, 0.0, 1.0)) * (0.55 + mx * 0.9);
          diffuseColor.rgb = mix(c, gcol, leaf);
        }` : ''}
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 1.0), vSnow * ${snow.toFixed(2)});`);
  };
  m.customProgramCacheKey = () => `flora${sway}|${snow}|${tint}|${fol}`;
  matCache.set(key, m);
  return m;
}

interface Cell { obj: THREE.Group; hi: THREE.Group; lo: THREE.Group | null; center: THREE.Vector3; far: number; lodDist: number; shadow: boolean; castsShadow?: boolean }
const cells: Cell[] = [];
const tmp = new THREE.Vector3();

/** Instanced placement in map tiles; each spot gets a random variant of the set (seeded by `pick`). Fills in once loaded. */
export function plantFlora(set: FloraSet, spots: FloraSpot[], pick: () => number = Math.random): THREE.Group {
  const out = new THREE.Group();
  out.name = `flora:${set.file}`;
  if (!spots.length) return out;
  const choice = spots.map(() => pick());
  const tiles = new Map<string, number[]>();
  spots.forEach((sp, i) => { const k = `${Math.floor(sp.x / CELL)},${Math.floor(sp.z / CELL)}`; (tiles.get(k) ?? tiles.set(k, []).get(k)!).push(i); });
  void Promise.all([loadVariants(set), loadVariants(set, true)]).then(([hiV, loV]) => {
    if (!hiV.length) return;
    const loByName = new Map(loV.map((v) => [v.name, v]));
    for (const idx of tiles.values()) {
      const byVariant = hiV.map(() => [] as FloraSpot[]);
      const c = new THREE.Vector3();
      for (const i of idx) { byVariant[Math.floor(choice[i] * hiV.length) % hiV.length].push(spots[i]); c.add(tmp.set(spots[i].x, spots[i].y, spots[i].z)); }
      c.divideScalar(idx.length);
      const obj = new THREE.Group();
      const hi = new THREE.Group();
      const lo = loV.length ? new THREE.Group() : null;
      hiV.forEach((v, vi) => {
        if (!byVariant[vi].length) return;
        instance(v, byVariant[vi], hi);
        const lv = loByName.get(v.name);
        if (lo) instance(lv ?? v, byVariant[vi], lo);
      });
      obj.add(hi);
      if (lo) { lo.visible = false; obj.add(lo); }
      out.add(obj);
      cells.push({ obj, hi, lo, center: c, far: set.far ?? 260, lodDist: set.lodDist ?? 70, shadow: true });
    }
  });
  return out;
}

/**
 * Same map-tile culling for any hand-built instanced decoration (e.g. grass tufts): one InstancedMesh per tile,
 * hidden past `far`. `items` are per-instance matrices with an optional colour.
 */
export function plantTiled(geo: THREE.BufferGeometry, mat: THREE.Material, items: { m: THREE.Matrix4; color?: THREE.Color }[], far: number, shadow = false): THREE.Group {
  const out = new THREE.Group();
  const tiles = new Map<string, typeof items>();
  const p = new THREE.Vector3();
  for (const it of items) { p.setFromMatrixPosition(it.m); const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`; (tiles.get(k) ?? tiles.set(k, []).get(k)!).push(it); }
  for (const list of tiles.values()) {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const c = new THREE.Vector3();
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.color) im.setColorAt(i, it.color); c.add(p.setFromMatrixPosition(it.m)); });
    c.divideScalar(list.length);
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    const obj = new THREE.Group();
    obj.add(im);
    out.add(obj);
    cells.push({ obj, hi: obj, lo: null, center: c, far, lodDist: Infinity, shadow, castsShadow: shadow });
  }
  return out;
}

function instance(v: Variant, list: FloraSpot[], into: THREE.Group) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const part of v.parts) {
    const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
    im.name = v.name;
    list.forEach((s, i) => im.setMatrixAt(i, m4.compose(p.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.rot), sc.setScalar(s.scale))));
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere(); // per tile, so the camera can skip tiles that are out of view
    into.add(im);
  }
}

let cursor = 0;
/** Distance pass over the flora tiles (call every frame; it only looks at a slice of the tiles each time). */
export function updateFlora(viewer: THREE.Vector3) {
  if (!cells.length) return;
  const n = Math.max(1, Math.ceil(cells.length / 6)); // whole set every ~6 frames
  for (let k = 0; k < n; k++) {
    const c = cells[cursor = (cursor + 1) % cells.length];
    tmp.copy(c.center).applyMatrix4(c.obj.matrixWorld);
    const d = Math.hypot(tmp.x - viewer.x, tmp.z - viewer.z) - CELL * 0.7; // distance to the tile's near edge
    const show = d < c.far;
    c.obj.visible = show;
    if (!show) continue;
    const useLo = !!c.lo && d > c.lodDist;
    c.hi.visible = !useLo;
    if (c.lo) c.lo.visible = useLo;
    const shadow = c.castsShadow !== false && d < SHADOW_DIST;
    if (shadow !== c.shadow) {
      c.shadow = shadow;
      c.obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = shadow; });
    }
  }
}
