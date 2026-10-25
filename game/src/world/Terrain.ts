import * as THREE from 'three';
import { LOOK } from '../render/Look';

// look v2 palette measured against Genshin meadow screenshots (lit grass ≈ #8bc274: light, a touch of blue, moderate saturation)
const V2_GREEN = '#7ec27e';
const V2_GOLD = new THREE.Color('#a6d27a');
import { toonGradient } from './Materials';

// ---------- value noise ----------
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0xffff) / 0xffff;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4): number {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * noise2(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}
function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
const gauss = (x: number, z: number, cx: number, cz: number, s: number) =>
  Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

export const WORLD_SIZE = 440;
export const WORLD_RADIUS = 185;
export const WATER_LEVEL = -0.6;
/** The only body of water (Membrane Lake). */
export const LAKE = { x: 60, z: 50, r: 58 };
export function isWater(x: number, z: number, h: number) {
  return h < WATER_LEVEL && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r;
}

export interface Flatten { x: number; z: number; r: number; h: number }
const GOLD = new THREE.Color('#d7bd63'), DEEP = new THREE.Color('#6f9a45');

/** Height field for "Cell Hollow" (หุบเซลล์). */
export class Terrain {
  mesh!: THREE.Mesh;
  flats: Flatten[] = [];

  constructor(flats: Flatten[]) {
    this.flats = flats;
  }

  rawHeight(x: number, z: number): number {
    let h = (fbm(x * 0.011 + 10, z * 0.011 + 3) - 0.5) * 14 + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 1.6;
    // Alvi's hill (west): a mesa with a gentle ramp on the north side and cliffs elsewhere (glide off!)
    {
      const dx = x + 95, dz = z - 10, d = Math.hypot(dx, dz);
      const north = d > 0.01 ? Math.max(0, -dz / d) : 0;
      const width = 9 + 34 * north * north;
      h += 30 * (1 - smoothstep(11, 11 + width, d));
    }
    h += 10 * gauss(x, z, -70, -40, 18);
    // eastern ridge
    h += 12 * gauss(x, z, 130, 40, 25);
    // membrane lake
    h -= 7 * gauss(x, z, 60, 50, 17);
    // ring of mountains bounds the map
    const r = Math.hypot(x, z);
    h += smoothstep(150, 200, r) * 55 * (0.7 + 0.6 * fbm(x * 0.02, z * 0.02, 2));
    return h;
  }

  height(x: number, z: number): number {
    let h = this.rawHeight(x, z);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r * 1.8) {
        const t = 1 - smoothstep(f.r, f.r * 1.8, d);
        h = h + (f.h - h) * t;
      }
    }
    return h;
  }

  normalAt(x: number, z: number): THREE.Vector3 {
    const e = 0.8;
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    return new THREE.Vector3(-hx, 2 * e, -hz).normalize();
  }

  /** Field colour without rock/snow (used by the grass system). Returns null on steep, sandy or snowy ground. */
  grassColor(x: number, z: number, out = new THREE.Color()): THREE.Color | null {
    const h = this.height(x, z);
    if (h > 30) return null;
    if (h < WATER_LEVEL + 0.9 && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) return null;
    if (this.normalAt(x, z).y < 0.84) return null;
    const k = fbm(x * 0.03 + 50, z * 0.03, 3);
    out.set(LOOK.v2 ? V2_GREEN : '#93b551').lerp(LOOK.v2 ? V2_GOLD : GOLD, smoothstep(0.35, 0.65, k)).lerp(DEEP, smoothstep(0.62, 0.85, fbm(x * 0.08, z * 0.08, 2)) * 0.5);
    return out.multiplyScalar(1.05);
  }

  build(): THREE.Mesh {
    const seg = 176;
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    // look v2: deeper meadow greens, sunlit patches yellow-green instead of straw, cool grey rock with strata
    const cGold = new THREE.Color(LOOK.v2 ? '#a6d27a' : '#d7bd63');
    const cGreen = new THREE.Color(LOOK.v2 ? V2_GREEN : '#93b551');
    const cDeep = new THREE.Color(LOOK.v2 ? '#68a867' : '#6f9a45');
    const cMount = new THREE.Color('#78a37a');
    const cRock = new THREE.Color(LOOK.v2 ? '#aaa59c' : '#a39280');
    const cStrata = new THREE.Color('#bcb2a4');
    const cSnow = new THREE.Color('#e9e4d4');
    const cSand = new THREE.Color('#d9c99b');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.height(x, z);
      pos.setY(i, h);
      const n = this.normalAt(x, z);
      const slope = 1 - n.y;
      const k = fbm(x * 0.03 + 50, z * 0.03, 3);
      tmp.copy(cGreen).lerp(cGold, smoothstep(0.35, 0.65, k));
      tmp.lerp(cDeep, smoothstep(0.62, 0.85, fbm(x * 0.08, z * 0.08, 2)) * 0.5);
      if (h < WATER_LEVEL + 0.8 && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) tmp.lerp(cSand, smoothstep(WATER_LEVEL + 0.8, WATER_LEVEL - 0.4, h));
      if (LOOK.v2) {
        // look v2: the bounding ring is wooded mountain green; rock bands only on steep faces; snow just on the tips
        tmp.lerp(cMount, smoothstep(140, 175, Math.hypot(x, z)) * 0.85);
        tmp.lerp(cRock.clone().lerp(cStrata, 0.5 + 0.5 * Math.sin(h * 0.55 + fbm(x * 0.05, z * 0.05, 2) * 4)), smoothstep(0.3, 0.5, slope));
        if (h > 52) tmp.lerp(cSnow, smoothstep(52, 62, h) * 0.9);
      } else {
        tmp.lerp(cRock, smoothstep(0.18, 0.35, slope));
        if (h > 38) tmp.lerp(cSnow, smoothstep(38, 50, h));
      }
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
    return this.mesh;
  }
}
