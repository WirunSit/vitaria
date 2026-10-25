import * as THREE from 'three';
import { WIND } from './Nature';
import { toonGradient } from './Materials';
import { fbm } from './Terrain';

/**
 * Genshin-style meadow grass around the player. What sells it in Genshin, and what this copies:
 *  - blade roots take the exact ground colour (incl. the ground detail texture's tint) so the field melts into the terrain
 *  - dark roots → light tips; same toon ramp as the ground so lighting matches
 *  - big wind gusts roll across the field as bright bands on the tips, plus a small per-clump flutter
 *  - strong natural height variation: knee-high wild clumps, short lawn, tall seed-head stalks poking out and
 *    small flowers; grass thins and shortens toward bare dirt (GroundMask) so paths have soft edges
 *  - dense near the camera, thinning and shrinking to nothing at the edge (no visible border or pop-in)
 *  - blades part around the player
 * Three instanced meshes (blade clumps, seed stalks, flowers), re-scattered on a stable world grid every 8 m;
 * per-cell results are cached because the terrain lookups are the slow part.
 */
export interface GrassHost {
  height: (x: number, z: number) => number;
  /** ground colour at a point, or null where no grass should grow */
  colorAt: (x: number, z: number) => THREE.Color | null;
  /** 0..1 bare dirt amount (grass thins/shortens toward it) */
  dirtAt?: (x: number, z: number) => number;
}

/** Average linear colour of the ground detail texture (TEX_Ground_Cytoria) — the ground is vertexColor × texture. */
const GROUND_TINT = new THREE.Color(0.842, 0.811, 0.733);
const MAX = 15000, MAX_EXTRA = 1500;
const FLOWER_COLORS = ['#fffdf0', '#fff6c8', '#ffe066', '#fffdf0'].map((c) => new THREE.Color(c));
const STALK = new THREE.Color('#ffffff');
const V = new THREE.Vector3(), S = new THREE.Vector3(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), C = new THREE.Color();

/** per world cell: instance matrix (16) + colour (3) for the clump / stalk / flower, or null */
interface Cell { g: Float32Array | null; s: Float32Array | null; f: Float32Array | null }

export class Grass {
  mesh: THREE.InstancedMesh;
  private stalks: THREE.InstancedMesh;
  private flowers: THREE.InstancedMesh;
  private center = new THREE.Vector2(1e9, 1e9);
  private player = { value: new THREE.Vector3() };
  private radiusU = { value: 0 };
  private fraction = 1;
  private cache = new Map<number, Cell>();
  private m4 = new THREE.Matrix4();

  constructor(private host: GrassHost, private radius = 32) {
    this.radiusU.value = radius;
    this.mesh = new THREE.InstancedMesh(clumpGeometry(), this.material(true), MAX);
    const extra = this.material(false);
    this.stalks = new THREE.InstancedMesh(stalkGeometry(), extra, MAX_EXTRA);
    this.flowers = new THREE.InstancedMesh(flowerGeometry(), extra, MAX_EXTRA);
    for (const m of [this.mesh, this.stalks, this.flowers]) {
      m.frustumCulled = false;
      m.receiveShadow = true;
      m.count = 0;
      m.userData.noOutline = true;
    }
    this.mesh.add(this.stalks, this.flowers);
  }

  /** `blade` = grass clumps (root→tip gradient from the ground colour); otherwise stalks/flowers with their own vertex colours. */
  private material(blade: boolean) {
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient(), side: THREE.DoubleSide, vertexColors: !blade });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = WIND.time;
      shader.uniforms.uPlayer = this.player;
      shader.uniforms.uRadius = this.radiusU;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uPlayer;\nuniform float uRadius;\nvarying float vH;\nvarying float vGust;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = position.y;
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float bend = position.y * position.y;
          // shrink to nothing toward the edge of the field (no pop-in when re-scattered)
          float dl0 = distance(ip.xz, uPlayer.xz);
          transformed.y *= 1.0 - smoothstep(uRadius * 0.62, uRadius * 0.98, dl0);
          // big gusts roll across the meadow along the wind direction; small flutter per clump
          vec2 wdir = normalize(vec2(1.0, 0.45));
          float wave = dot(ip.xz, wdir) * 0.09 - uTime * 1.6;
          float gust = pow(sin(wave) * 0.5 + 0.5, 3.0) + 0.35 * (sin(wave * 0.37 + ip.z * 0.03) * 0.5 + 0.5);
          vGust = gust;
          float flutter = sin(uTime * 3.1 + ip.x * 1.7 + ip.z * 1.3) * 0.06;
          vec2 sway = wdir * (0.1 + gust * 0.32) + vec2(flutter, -flutter * 0.6);
          // part around the player
          vec2 d = ip.xz - uPlayer.xz;
          float near = 1.0 - smoothstep(0.3, 1.5, dl0);
          vec2 push = normalize(d + 1e-4) * near * 0.75;
          vec3 off = vec3(sway.x + push.x, -(gust * 0.08 + near * 0.25), sway.y + push.y) * bend;
          transformed += inverse(mat3(instanceMatrix)) * off;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;\nvarying float vGust;')
        // both blade sides keep the up-facing normal (double-sided would flip the back face dark)
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);')
        .replace('#include <color_fragment>', blade ? `#include <color_fragment>
          // roots = ground colour (AO-darkened), tips lighter and fresher, gust bands brighten the tips
          float t = clamp(vH, 0.0, 1.0);
          vec3 tip = diffuseColor.rgb * vec3(1.02, 1.14, 0.9) + vec3(0.0, 0.025, 0.0);
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.62, tip, smoothstep(0.0, 0.9, t));
          diffuseColor.rgb *= 1.0 + vGust * t * 0.18;` : `#include <color_fragment>
          diffuseColor.rgb *= 1.0 + vGust * clamp(vH, 0.0, 1.0) * 0.12;`);
    };
    return mat;
  }

  update(playerPos: THREE.Vector3) {
    this.player.value.copy(playerPos);
    if (this.fraction <= 0) return;
    if (Math.hypot(playerPos.x - this.center.x, playerPos.z - this.center.y) < 8) return;
    this.center.set(playerPos.x, playerPos.z);
    this.rebuild();
  }

  /** 0 = off, 1 = full. */
  setDensity(fraction: number) {
    this.fraction = fraction;
    this.mesh.visible = fraction > 0;
    this.center.set(1e9, 1e9);
    this.cache.clear();
  }

  private cell(ix: number, iz: number, x: number, z: number, h1: number, h2: number, h3: number): Cell {
    const key = (ix + 60000) * 120000 + (iz + 60000);
    let c = this.cache.get(key);
    if (c) return c;
    c = { g: null, s: null, f: null };
    const g = this.host.colorAt(x, z);
    const dirt = this.host.dirtAt?.(x, z) ?? 0;
    if (g && dirt < 0.55) {
      const y = this.host.height(x, z) - 0.03;
      // wild tall-grass zones vs short lawn (low-frequency noise) + per-clump jitter; shorter toward dirt
      const wild = smooth01((fbm(x * 0.045 + 31, z * 0.045 - 17, 2) - 0.42) / 0.2);
      // lawn areas stay sparse so the ground shows through; wild patches are fuller
      if (hash(iz * 13 + 5, ix * 7 - 11) > 0.35 + 0.6 * wild) { this.cache.set(key, c); return c; }
      const edge = 1 - Math.min(1, dirt / 0.55);
      const hgt = (0.2 + wild * 0.42 + h2 * 0.12) * (0.35 + 0.65 * edge);
      const w = 0.85 + h3 * 0.35;
      // greener, livelier than the old palette (same transform as the ground shader in GroundMask)
      vivid(C.copy(g).multiply(GROUND_TINT)).multiplyScalar(0.9 + h1 * 0.2);
      c.g = new Float32Array(19);
      this.m4.compose(V.set(x, y, z), Q.setFromAxisAngle(UP, h1 * 6.28), S.set(w, hgt, w)).toArray(c.g, 0);
      C.toArray(c.g, 16);
      // seed-head stalks poke out of wild grass, little flowers dot the lawn
      const h4 = hash(ix * 5 - 3, iz * 11 + 7);
      if (edge > 0.8 && h4 < 0.06 * wild) {
        c.s = new Float32Array(19);
        this.m4.compose(V.set(x + 0.1, y, z - 0.1), Q.setFromAxisAngle(UP, h2 * 6.28), S.set(1, 0.95 + h1 * 0.5, 1)).toArray(c.s, 0);
        STALK.toArray(c.s, 16);
      } else if (edge > 0.6 && h4 > 1 - 0.035 * (1 - wild * 0.7)) {
        c.f = new Float32Array(19);
        const fs = 0.8 + h3 * 0.5;
        this.m4.compose(V.set(x - 0.12, y, z + 0.08), Q.setFromAxisAngle(UP, h1 * 6.28), S.set(fs, fs, fs)).toArray(c.f, 0);
        FLOWER_COLORS[Math.floor(h2 * FLOWER_COLORS.length) % FLOWER_COLORS.length].toArray(c.f, 16);
      }
    }
    this.cache.set(key, c);
    return c;
  }

  private rebuild() {
    const meshes = [this.mesh, this.stalks, this.flowers];
    for (const m of meshes) if (!m.instanceColor) m.setColorAt(0, new THREE.Color());
    const counts = [0, 0, 0], caps = [Math.min(MAX, Math.round(MAX * this.fraction)), MAX_EXTRA, MAX_EXTRA];
    const put = (k: number, v: Float32Array | null) => {
      if (!v || counts[k] >= caps[k]) return;
      const m = meshes[k];
      (m.instanceMatrix.array as Float32Array).set(v.subarray(0, 16), counts[k] * 16);
      (m.instanceColor!.array as Float32Array).set(v.subarray(16), counts[k] * 3);
      counts[k]++;
    };
    if (this.cache.size > 120000) this.cache.clear(); // ~6 fields worth
    // stable pseudo-random per world cell so clumps don't jump when re-scattered
    const cell = 0.46, R = this.radius;
    const cx = Math.round(this.center.x / cell), cz = Math.round(this.center.y / cell), cr = Math.ceil(R / cell);
    for (let gx = -cr; gx <= cr; gx++) {
      for (let gz = -cr; gz <= cr; gz++) {
        const ix = cx + gx, iz = cz + gz;
        const h1 = hash(ix, iz), h2 = hash(iz + 17, ix - 5), h3 = hash(ix * 3 + 1, iz * 7 - 2);
        const x = (ix + h1 - 0.5) * cell, z = (iz + h2 - 0.5) * cell;
        const d = Math.hypot(x - this.center.x, z - this.center.y);
        if (d > R) continue;
        // full density close by, thinning to ~35% at the edge (and by the density setting)
        const keep = (d < 12 ? 1 : 1 - 0.65 * (d - 12) / (R - 12)) * Math.min(1, this.fraction * 1.4);
        if (h3 > keep) continue;
        const c = this.cell(ix, iz, x, z, h1, h2, h3);
        put(0, c.g);
        put(1, c.s);
        put(2, c.f);
      }
    }
    meshes.forEach((m, k) => {
      m.count = counts[k];
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor!.needsUpdate = true;
    });
  }
}

/** Same Genshin-green transform as the ground shader (GroundMask): red pulled toward green, +15% saturation. */
function vivid(c: THREE.Color) {
  c.r += (c.g * 0.45 - c.r) * 0.7;
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  c.setRGB(Math.max(0, lum + (c.r - lum) * 1.15), Math.max(0, lum + (c.g - lum) * 1.15), Math.max(0, lum + (c.b - lum) * 1.15));
  return c;
}

function smooth01(t: number) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

/** 6 long, thin, curved blades of different lengths leaning out from a small clump base; 3 triangles each. Normals point up like the ground. */
function clumpGeometry() {
  const pts: number[] = [];
  const blades = [[0, 0, 0, 1], [0.06, 0.03, 1.1, 0.7], [-0.05, 0.05, 2.2, 0.85], [0.02, -0.06, 3.3, 0.6], [-0.05, -0.03, 4.3, 0.92], [0.04, -0.01, 5.4, 0.75]];
  for (const [bx, bz, yaw, len] of blades) {
    const W = 0.04, lean = 0.32;
    const ca = Math.cos(yaw), sa = Math.sin(yaw);
    const v = (u: number, y: number) => {
      const fwd = lean * y * y * len;
      return [bx + u * ca + fwd * sa, y * len, bz - u * sa + fwd * ca];
    };
    const a = v(-W, 0), b = v(W, 0), c = v(W * 0.6, 0.55), d = v(-W * 0.6, 0.55), e = v(0, 1);
    pts.push(...a, ...b, ...c, ...a, ...c, ...d, ...d, ...c, ...e);
  }
  return upNormals(pts);
}

/** Tall thin stalk (two crossed quads) with a pale seed head, ~1.1 m before instance scale. */
function stalkGeometry() {
  const pts: number[] = [], cols: number[] = [];
  const push = (p: number[], c: [number, number, number]) => { pts.push(...p); cols.push(...c); };
  const green: [number, number, number] = [0.22, 0.4, 0.1], seed: [number, number, number] = [0.72, 0.6, 0.3];
  // stalk (two crossed thin quads) 0..0.85, then a seed head 0.85..1.1
  for (const r of [0, Math.PI / 2]) {
    const ca = Math.cos(r) * 0.012, sa = Math.sin(r) * 0.012;
    const q = [[-ca, 0, -sa], [ca, 0, sa], [ca, 0.85, sa], [-ca, 0.85, -sa]];
    for (const i of [0, 1, 2, 0, 2, 3]) push(q[i], green);
    const hw = 0.035;
    const h = [[-Math.cos(r) * hw * 0.3, 0.82, -Math.sin(r) * hw * 0.3], [Math.cos(r) * hw, 0.95, Math.sin(r) * hw], [0, 1.12, 0], [-Math.cos(r) * hw, 0.95, -Math.sin(r) * hw]];
    for (const i of [0, 1, 2, 0, 2, 3]) push(h[i], seed);
  }
  return upNormals(pts, cols);
}

/** Small 5-petal flower on a short stem (petals tinted per instance). */
function flowerGeometry() {
  const pts: number[] = [], cols: number[] = [];
  const push = (p: number[], c: [number, number, number]) => { pts.push(...p); cols.push(...c); };
  const green: [number, number, number] = [0.32, 0.5, 0.16], petal: [number, number, number] = [1, 1, 1], eye: [number, number, number] = [1, 0.75, 0.15];
  const q = [[-0.01, 0, 0], [0.01, 0, 0], [0.01, 0.22, 0], [-0.01, 0.22, 0]];
  for (const i of [0, 1, 2, 0, 2, 3]) push(q[i], green);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, b = a + 0.5, c = a - 0.5;
    push([0, 0.23, 0], eye);
    push([Math.cos(b) * 0.07, 0.24, Math.sin(b) * 0.07], petal);
    push([Math.cos(c) * 0.07, 0.24, Math.sin(c) * 0.07], petal);
  }
  return upNormals(pts, cols);
}

function upNormals(pts: number[], cols?: number[]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const nrm = new Float32Array(pts.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (cols) geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return geo;
}

function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) & 0xffff) / 0xffff;
}
