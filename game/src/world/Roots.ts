import * as THREE from 'three';
import { hasFlora, plantFlora, PAINTED_TREES, type FloraSet, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { buildAirship } from './Genovia';
import { propSlot } from '../models/PropModels';

/**
 * รากต้นไม้แห่งชีวิต — the finale (บทสรุป). North-west, reached by airship. A sacred valley where the roots of the
 * Arbor Vitae break the surface; seven vital veins (one per element) run along the ground into the Heart Seed in the
 * north. The Entropy Herald's blight stains the valley purple and dims the veins until the final battle is won.
 * Four "trials of balance" (homeostasis: temperature, blood glucose, water, the living world) sit on the way.
 * Every building / prop is a `propSlot` (downloaded model); the code only builds simple stand-ins until those exist.
 */
export const ARB = { x: -1800, z: -1800 };
export const ARB_RADIUS = 160;
export const ARB_SIZE = 420;

export function inRoots(x: number, z: number) {
  return Math.hypot(x - ARB.x, z - ARB.z) < ARB_SIZE / 2 + 40;
}

/** Points of interest in local coordinates (-z = north). Mirrors locations.json. */
export const ARB_SITES = {
  dock: { x: 0, z: 122 },
  camp: { x: 0, z: 66 },
  thermo: { x: -70, z: 10 },
  glucose: { x: 70, z: 20 },
  water: { x: -66, z: -60 },
  world: { x: 66, z: -60 },
  heart: { x: 0, z: -100 },
};
const S = ARB_SITES;
const ARENA = { x: 0, z: -80 };

/** The seven vital veins: element colour, and the trial site each one passes before reaching the Heart Seed. */
const VEINS: { color: string; from: [number, number] }[] = [
  { color: '#ffd36a', from: [-150, 40] },  // Geo
  { color: '#9fe3f0', from: [-120, -110] }, // Cryo
  { color: '#7ad0b0', from: [150, 40] },    // Anemo
  { color: '#8bc34a', from: [120, -110] },  // Dendro
  { color: '#ff8a3a', from: [-90, 120] },   // Pyro
  { color: '#3da5f4', from: [90, 120] },    // Hydro
  { color: '#b06cff', from: [0, 150] },     // Electro
];

const FLATS: { x: number; z: number; r: number; h: number }[] = [
  { ...S.dock, r: 12, h: 1.6 },
  { ...S.camp, r: 20, h: 1.8 },
  { ...S.thermo, r: 16, h: 2.4 },
  { ...S.glucose, r: 16, h: 2.4 },
  { ...S.water, r: 16, h: 2.6 },
  { ...S.world, r: 16, h: 2.6 },
  { ...ARENA, r: 24, h: 3 },
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
  return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
}

const PATHS: [number, number, number, number][] = [
  [S.dock.x, S.dock.z, S.camp.x, S.camp.z],
  ...[S.thermo, S.glucose, ARENA].map((s) => [S.camp.x, S.camp.z, s.x, s.z] as [number, number, number, number]),
  [S.thermo.x, S.thermo.z, S.water.x, S.water.z],
  [S.glucose.x, S.glucose.z, S.world.x, S.world.z],
  [S.water.x, S.water.z, ARENA.x, ARENA.z],
  [S.world.x, S.world.z, ARENA.x, ARENA.z],
];
function pathDist(x: number, z: number) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of PATHS) best = Math.min(best, segDist(x, z, ax, az, bx, bz));
  return best;
}

/** Blight: purple stains around the arena and the trial sites (they fade once the valley is healed). */
const BLIGHT: { x: number; z: number; r: number }[] = [
  { ...ARENA, r: 34 }, { x: S.thermo.x, z: S.thermo.z, r: 16 }, { x: S.glucose.x, z: S.glucose.z, r: 16 },
  { x: S.water.x, z: S.water.z, r: 18 }, { x: S.world.x, z: S.world.z, r: 18 }, { x: -30, z: -20, r: 14 }, { x: 34, z: -10, r: 12 },
];

/** Height in local coordinates: a sunken valley ringed by cliffs, with the root mound rising in the north. */
export function arbHeightLocal(x: number, z: number): number {
  let h = 2 + (fbm(x * 0.02 + 61, z * 0.02 + 13) - 0.5) * 4;
  const r = Math.hypot(x, z);
  h += smoothstep(145, 200, r) * 44 * (0.7 + 0.6 * fbm(x * 0.02 + 8, z * 0.02 + 1, 2));
  h += 10 * (1 - smoothstep(14, 40, Math.hypot(x - S.heart.x, z - S.heart.z))); // the mound around the Heart Seed
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = h + (f.h - h) * (1 - smoothstep(f.r, f.r * 1.8, d));
  }
  return h;
}

export class Roots {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  private healed = false;
  private healK = 0;
  private t = 0;
  private veinMats: THREE.MeshBasicMaterial[] = [];
  private veinTex: THREE.Texture[] = [];
  private veinCols: THREE.Color[] = [];
  private blight: THREE.Mesh[] = [];
  private seed: THREE.Mesh | null = null;
  private motes!: THREE.Points;
  private moteBase = new Float32Array(0);

  constructor() {
    this.root.position.set(ARB.x, 0, ARB.z);
    this.buildTerrain();
    this.veins();
    this.buildBlight();
    this.dock(S.dock.x, S.dock.z);
    this.camp(S.camp.x, S.camp.z);
    this.trial(S.thermo.x, S.thermo.z, '#ff8a6a', 'OBJ_ARB_THERMO', 'CDX_THERMOREG', 'thermo', 'ศิลาแห่งความอบอุ่น');
    this.trial(S.glucose.x, S.glucose.z, '#ffd36a', 'OBJ_ARB_GLUCOSE', 'CDX_GLUCOSE_REG', 'glucose', 'ศิลาแห่งน้ำตาล');
    this.trial(S.water.x, S.water.z, '#5ab8ff', 'OBJ_ARB_WATER', 'CDX_OSMOREG', 'water', 'ศิลาแห่งสายน้ำ');
    this.trial(S.world.x, S.world.z, '#8bc34a', 'OBJ_ARB_WORLD', 'CDX_ECO_BALANCE', 'world', 'ศิลาแห่งโลกที่มีชีวิต');
    this.heart(S.heart.x, S.heart.z);
    this.scenery();
    this.buildMotes();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
  }

  private h(x: number, z: number) { return arbHeightLocal(x, z); }
  private col(x: number, z: number, r: number, id?: string) { this.colliders.push({ x: ARB.x + x, z: ARB.z + z, r, id }); }
  private add(o: THREE.Object3D, x: number, z: number, lift = 0) {
    o.position.set(x, this.h(x, z) + lift, z);
    this.root.add(o);
    return o;
  }
  private scan(id: string, codexId: string, tags: string[], x: number, y: number, z: number, radius: number, label: string) {
    const probe = new THREE.Object3D();
    probe.position.set(x, y, z);
    this.root.add(probe);
    this.scannables.push({ id, codexId, tags, obj: probe, radius, label });
  }
  private placeholder(geo: THREE.BufferGeometry, color: string, y = 0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, toon(color));
    m.position.y = y;
    g.add(m);
    return g;
  }
  private light(geo: THREE.BufferGeometry, color: string, y: number, intensity = 1.4) {
    const m = new THREE.Mesh(geo, glow(color, intensity));
    m.position.y = y;
    m.userData.keep = true;
    m.userData.noOutline = true;
    m.userData.noShadow = true;
    return m;
  }

  // ---------------------------------------------------------------- terrain
  private buildTerrain() {
    const seg = 160;
    const geo = new THREE.PlaneGeometry(ARB_SIZE, ARB_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#8cc47a'), lush = new THREE.Color('#72b46e'), moss = new THREE.Color('#a8c86a');
    const earth = new THREE.Color('#c8b088'), rock = new THREE.Color('#a49a8a'), high = new THREE.Color('#90b496');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.h(x, z);
      pos.setY(i, y);
      const e = 0.8;
      const nx = this.h(x + e, z) - this.h(x - e, z), nz = this.h(x, z + e) - this.h(x, z - e);
      const slope = 1 - 2 * e / Math.hypot(nx, 2 * e, nz);
      tmp.copy(grass).lerp(lush, smoothstep(0.35, 0.7, fbm(x * 0.03 + 4, z * 0.03 + 6, 3)));
      tmp.lerp(moss, smoothstep(0.55, 0.8, fbm(x * 0.06 + 1, z * 0.06 + 2, 2)) * 0.5);
      tmp.lerp(rock, smoothstep(0.25, 0.45, slope));
      tmp.lerp(high, smoothstep(12, 34, y) * 0.6);
      const pd = pathDist(x, z);
      if (pd < 2.6) tmp.lerp(earth, 0.8 * (1 - smoothstep(1.6, 2.6, pd)));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.root.add(mesh);
  }

  /** Seven glowing veins winding from the valley rim to the Heart Seed; their light flows inward. */
  private veins() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 4;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, 'rgba(150,150,150,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(150,150,150,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 4);
    VEINS.forEach((v, k) => {
      const [fx, fz] = v.from;
      const pts: THREE.Vector3[] = [];
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const bx = fx + (S.heart.x - fx) * t, bz = fz + (S.heart.z + 16 - fz) * t;
        const wob = Math.sin(t * 9 + k * 1.7) * 7 * (1 - t);
        const x = bx + wob * ((S.heart.z - fz) / 200), z = bz - wob * ((S.heart.x - fx) / 200);
        pts.push(new THREE.Vector3(x, this.h(x, z) + 0.12, z));
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(8, 1);
      this.veinTex.push(tex);
      const col = new THREE.Color(v.color);
      this.veinCols.push(col);
      const mat = new THREE.MeshBasicMaterial({ color: col.clone(), map: tex, toneMapped: false });
      this.veinMats.push(mat);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.28, 6), mat);
      tube.userData.noOutline = true;
      tube.userData.noShadow = true;
      this.root.add(tube);
    });
  }

  private buildBlight() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    for (const b of BLIGHT) {
      const geo = new THREE.CircleGeometry(b.r, 40);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setY(i, this.h(b.x + p.getX(i), b.z + p.getZ(i)) + 0.08);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#5a2a7a', map: tex, transparent: true, opacity: 0.55, depthWrite: false }));
      m.position.set(b.x, 0, b.z);
      m.userData.noOutline = true;
      m.userData.noShadow = true;
      m.renderOrder = 1;
      this.blight.push(m);
      this.root.add(m);
    }
  }

  // ---------------------------------------------------------------- sites
  private dock(x: number, z: number) {
    const deck = new THREE.Group();
    const a = toon('#d8c8a8'), b = toon('#c8b898');
    for (let i = 0; i < 13; i++) {
      const px = -6 + i, len = 2 * Math.sqrt(Math.max(0, 6.6 * 6.6 - px * px));
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.24, len), i % 2 ? a : b);
      plank.position.set(px, 0.42, 0);
      deck.add(plank);
    }
    this.add(deck, x, z);
    const ship = buildAirship();
    ship.rotation.y = Math.PI / 2;
    this.add(ship, x + 6, z + 4);
    void propSlot(ship, 'PRP_Airship', { w: 11 });
  }

  /** The expedition camp: tents round a campfire. */
  private camp(cx: number, cz: number) {
    const fire = this.placeholder(new THREE.CylinderGeometry(1, 1.2, 0.4, 10), '#6a5a4a', 0.2);
    fire.add(this.light(new THREE.ConeGeometry(0.6, 1.4, 8), '#ffb050', 1, 1.6));
    this.add(fire, cx, cz);
    this.col(cx, cz, 1.3);
    void propSlot(fire, 'PRP_Campfire', { w: 2.4 });
    for (const [dx, dz, yaw] of [[-9, -4, Math.PI / 2.5], [9, -4, -Math.PI / 2.5], [-6, 9, Math.PI * 0.85], [6, 9, -Math.PI * 0.85]] as const) {
      const tent = this.placeholder(new THREE.ConeGeometry(2.4, 3, 4), '#e8dcc0', 1.5);
      tent.rotation.y = yaw;
      this.add(tent, cx + dx, cz + dz);
      this.col(cx + dx, cz + dz, 2);
      void propSlot(tent, 'PRP_Tent', { w: 4.2 });
    }
  }

  /** A trial of balance: a vital crystal on a ring of ruined pillars, with a puzzle board. */
  private trial(cx: number, cz: number, color: string, scanId: string, codexId: string, tag: string, label: string) {
    const crystal = this.placeholder(new THREE.CylinderGeometry(0.8, 1.4, 0.8, 8), '#b8ae98', 0.4);
    crystal.add(this.light(new THREE.OctahedronGeometry(1.3), color, 2.4, 1.3));
    this.add(crystal, cx, cz);
    this.col(cx, cz, 1.6);
    void propSlot(crystal, 'PRP_VitalCrystal', { h: 4 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const pil = this.placeholder(new THREE.CylinderGeometry(0.5, 0.6, 3 + (i % 3), 8), '#cfc6b2', (3 + (i % 3)) / 2);
      this.add(pil, cx + Math.cos(a) * 8, cz + Math.sin(a) * 8);
      this.col(cx + Math.cos(a) * 8, cz + Math.sin(a) * 8, 0.7);
      void propSlot(pil, 'PRP_RuinPillar', { h: 3 + (i % 3), yaw: a });
    }
    this.scan(scanId, codexId, [tag], cx, this.h(cx, cz) + 2.4, cz, 1.6, label);
    this.board(cx, cz + 11, 0);
  }

  /** The Heart Seed under an arch of giant roots, on the mound north of the arena. */
  private heart(cx: number, cz: number) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / 6));
      const r = this.placeholder(new THREE.TorusGeometry(9, 1.3, 8, 16, Math.PI * 0.9), '#7a5a3e', 0);
      r.rotation.y = a;
      this.add(r, cx + Math.cos(a) * 14, cz - Math.sin(a) * 6);
      this.col(cx + Math.cos(a) * 14, cz - Math.sin(a) * 6, 2);
      void propSlot(r, 'PRP_GiantRoot', { w: 18, yaw: a });
    }
    const seed = this.light(new THREE.IcosahedronGeometry(3, 1), '#b8ffb0', 6, 0.7);
    const holder = new THREE.Group();
    holder.add(seed);
    this.add(holder, cx, cz + 2);
    this.col(cx, cz + 2, 3.5);
    void propSlot(holder, 'PRP_VitalSeed', { h: 8, y: 2 });
    this.seed = seed;
    this.scan('OBJ_ARB_SEED', 'CDX_ARBOR_VITAE', ['seed'], cx, this.h(cx, cz) + 6, cz + 2, 3, 'เมล็ดหัวใจแห่งต้นไม้แห่งชีวิต');
  }

  private board(x: number, z: number, face: number) {
    const g = this.placeholder(new THREE.BoxGeometry(1.8, 1.2, 0.12), '#d9c08a', 1.5);
    g.rotation.y = face;
    addOutline(g, 0.03);
    this.add(g, x, z);
    this.col(x, z, 0.8);
    void propSlot(g, 'PRP_PuzzleBoard', { h: 2.2, piece: Math.abs(Math.round(x + z)) % 3 });
  }

  /** Old trees and giant roots breaking the surface around the valley. */
  private scenery() {
    let s = 83;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const clear = (x: number, z: number) =>
      Object.values(S).every((p) => Math.hypot(x - p.x, z - p.z) > 24) && pathDist(x, z) > 5 && Math.hypot(x - ARENA.x, z - ARENA.z) > 32;
    const sets: Record<string, FloraSet> = {
      trees: { ...PAINTED_TREES, foliage: ['#4fa65a', '#c8e07a'] },
      sakura: { file: 'NAT_Sakura', sway: 0.03, far: 320 },
      bush: { file: 'NAT_Bush', sway: 0.06, far: 110 },
      blooms: { file: 'NAT_Flowers', split: true, sway: 0.1, far: 80, lodDist: 35 },
    };
    for (const k of Object.keys(sets)) if (!hasFlora(sets[k].file)) delete sets[k];
    const spots: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(sets).map((k) => [k, []]));
    const at = (k: string, x: number, z: number, scale: number) => { if (spots[k]) spots[k].push({ x, y: this.h(x, z) - 0.2, z, rot: rand() * 6.28, scale }); };
    let n = 0;
    for (let i = 0; i < 800 && n < 110; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 140 || !clear(x, z)) continue;
      const roll = rand();
      if (roll < 0.45) { at('trees', x, z, 9 + rand() * 5); this.col(x, z, 0.8); n++; }
      else if (roll < 0.55) { at('sakura', x, z, 7 + rand() * 3); this.col(x, z, 0.7); n++; }
      else if (roll < 0.75) at('bush', x, z, 1 + rand() * 0.6);
      else at('blooms', x, z, 0.25 + rand() * 0.2);
    }
    for (const k of Object.keys(sets)) if (spots[k].length) this.root.add(plantFlora(sets[k], spots[k], rand));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.4, r = 100 + rand() * 30;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!clear(x, z)) continue;
      const root = this.placeholder(new THREE.TorusGeometry(7, 1, 8, 14, Math.PI * 0.8), '#7a5a3e', 0);
      root.rotation.y = a;
      this.add(root, x, z, -1);
      this.col(x, z, 2);
      void propSlot(root, 'PRP_GiantRoot', { w: 14, yaw: a });
    }
  }

  /** Floating seeds of light drifting around the player. */
  private buildMotes() {
    const n = 90;
    this.moteBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.moteBase[i * 3] = (Math.random() - 0.5) * 50; this.moteBase[i * 3 + 1] = Math.random() * 7; this.moteBase[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8ffc8, size: 0.16, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.motes.frustumCulled = false;
    this.motes.userData.noShadow = true;
    this.root.add(this.motes);
  }

  /** Healed = the Herald is beaten: the blight fades, the veins and the Heart Seed shine. */
  setHealed(on: boolean, instant = false) {
    this.healed = on;
    if (instant) this.healK = on ? 1 : 0;
    this.applyHeal();
  }

  private applyHeal() {
    const k = this.healK;
    for (const b of this.blight) { (b.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k); b.visible = k < 0.99; }
    this.veinMats.forEach((m, i) => m.color.copy(this.veinCols[i]).multiplyScalar(0.35 + 1.15 * k));
    if (this.seed) (this.seed.material as THREE.MeshBasicMaterial).color.set(k > 0.5 ? '#d8ffc8' : '#8aa080').multiplyScalar(0.7 + 0.9 * k);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.t += dt;
    const target = this.healed ? 1 : 0;
    if (this.healK !== target) {
      this.healK += Math.sign(target - this.healK) * Math.min(Math.abs(target - this.healK), dt * 0.25);
      this.applyHeal();
    }
    for (const tex of this.veinTex) tex.offset.x -= dt * (0.08 + 0.4 * this.healK);
    if (this.seed) { this.seed.rotation.y += dt * 0.3; this.seed.scale.setScalar(1 + 0.04 * Math.sin(this.t * 1.6)); }
    const near = inRoots(playerPos.x, playerPos.z);
    this.motes.visible = near;
    if (near) {
      const lx = playerPos.x - ARB.x, lz = playerPos.z - ARB.z;
      const p = this.motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const wx = this.moteBase[i * 3] + Math.sin(this.t * 0.3 + i) * 1.2, wz = this.moteBase[i * 3 + 2] + Math.cos(this.t * 0.25 + i) * 1.2;
        const x = lx + ((((wx - lx + 25) % 50) + 50) % 50) - 25, z = lz + ((((wz - lz + 25) % 50) + 50) % 50) - 25;
        p.setXYZ(i, x, playerPos.y + this.moteBase[i * 3 + 1] - 1 + Math.sin(this.t * 0.8 + i) * 0.4, z);
      }
      p.needsUpdate = true;
    }
  }
}
