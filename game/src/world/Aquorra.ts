import * as THREE from 'three';
import { hasFlora, plantFlora, PAINTED_TREES, type FloraSet, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { buildAirship } from './Genovia';
import { hasProp, propSlot } from '../models/PropModels';
import { regionWater } from '../render/Water';

/**
 * อควอร์รา — water city of Hydro / circulation, immunity and excretion (chapter 6). South-west, reached by airship.
 * Islands linked by bridges over two kinds of canal: rosy "artery" canals flowing out from the Heart Temple and
 * deep-blue "vein" canals flowing back to it. The Queen's palace on the plaza, the white-blood-cell fortress, the
 * kidney lagoon with its nephron towers, and the Plague Marsh where the resistant superbug hides (toxic green water
 * that clears once the chapter's boss is beaten).
 * Every building / prop is a `propSlot` (downloaded model); the code only builds simple stand-ins until those exist.
 */
export const AQU = { x: -1800, z: 1800 };
export const AQU_RADIUS = 160;
export const AQU_SIZE = 420;
const WATER_LEVEL = -0.3;

export function inAquorra(x: number, z: number) {
  return Math.hypot(x - AQU.x, z - AQU.z) < AQU_SIZE / 2 + 40;
}

/** Points of interest in local coordinates (-z = north). Mirrors locations.json. */
export const AQU_SITES = {
  dock: { x: 0, z: 122 },
  plaza: { x: 0, z: 66 },
  heart: { x: -70, z: 12 },
  vessels: { x: 70, z: 22 },
  fort: { x: -66, z: -64 },
  kidney: { x: 66, z: -60 },
  marsh: { x: 0, z: -100 },
};

/** Canals (local polylines) and their kind: 1 artery (rosy) · 2 vein (deep blue). */
const CANALS: { kind: number; pts: [number, number][] }[] = [
  { kind: 1, pts: [[-56, 16], [-30, 34], [-8, 40], [30, 40], [56, 30], [96, 34]] },
  { kind: 1, pts: [[-62, -2], [-58, -34], [-40, -58], [-30, -96], [-40, -140]] },
  { kind: 2, pts: [[52, -52], [30, -30], [0, -18], [-30, -6], [-56, 6]] },
  { kind: 2, pts: [[96, -10], [72, -4], [60, 4]] },
  { kind: 2, pts: [[14, -84], [20, -50], [30, -30]] },
];
const KIDNEY_LAGOON = { x: 66, z: -60, rx: 22, rz: 14 };
const MARSH = { x: 0, z: -100, r: 18 };

const FLATS: { x: number; z: number; r: number; h: number }[] = [
  { ...AQU_SITES.dock, r: 12, h: 1 },
  { ...AQU_SITES.plaza, r: 22, h: 1.2 },
  { ...AQU_SITES.heart, r: 16, h: 1.6 },
  { ...AQU_SITES.vessels, r: 16, h: 1.2 },
  { ...AQU_SITES.fort, r: 18, h: 2 },
  { x: AQU_SITES.kidney.x - 18, z: AQU_SITES.kidney.z + 14, r: 10, h: 1.2 },
  { x: MARSH.x, z: MARSH.z + 22, r: 14, h: 1 },
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
  return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
}

function canalInfo(x: number, z: number) {
  let best = Infinity, kind = 0;
  for (const c of CANALS) for (let i = 0; i < c.pts.length - 1; i++) {
    const d = segDist(x, z, c.pts[i][0], c.pts[i][1], c.pts[i + 1][0], c.pts[i + 1][1]);
    if (d < best) { best = d; kind = c.kind; }
  }
  return { d: best, kind };
}

/** Walkways: plaza hub → every site (they cross canals on bridges). */
const PATHS: [number, number, number, number][] = [
  [AQU_SITES.dock.x, AQU_SITES.dock.z, AQU_SITES.plaza.x, AQU_SITES.plaza.z],
  ...[AQU_SITES.heart, AQU_SITES.vessels, AQU_SITES.marsh].map((s) => [AQU_SITES.plaza.x, AQU_SITES.plaza.z, s.x, s.z] as [number, number, number, number]),
  [AQU_SITES.heart.x, AQU_SITES.heart.z, AQU_SITES.fort.x, AQU_SITES.fort.z],
  [AQU_SITES.vessels.x, AQU_SITES.vessels.z, AQU_SITES.kidney.x - 18, AQU_SITES.kidney.z + 14],
];
function pathDist(x: number, z: number) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of PATHS) best = Math.min(best, segDist(x, z, ax, az, bx, bz));
  return best;
}

/** Height in local coordinates: low green islands, canals carved between them (kept dry under the walkways). */
export function aquHeightLocal(x: number, z: number): number {
  let h = 1.2 + (fbm(x * 0.02 + 17, z * 0.02 + 5) - 0.5) * 3;
  const r = Math.hypot(x, z);
  h += smoothstep(150, 205, r) * 34 * (0.7 + 0.6 * fbm(x * 0.022 + 2, z * 0.022 + 9, 2));
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = h + (f.h - h) * (1 - smoothstep(f.r, f.r * 1.8, d));
  }
  const dry = smoothstep(4.5, 2.5, pathDist(x, z)); // bridges: the walkway stays above the water
  const c = canalInfo(x, z);
  if (c.d < 7) h = h + (-1.8 - h) * (1 - smoothstep(3.5, 7, c.d)) * (1 - dry);
  const kl = Math.hypot((x - KIDNEY_LAGOON.x) / KIDNEY_LAGOON.rx, (z - KIDNEY_LAGOON.z) / KIDNEY_LAGOON.rz) + 0.25 * Math.sin(Math.atan2(z - KIDNEY_LAGOON.z, x - KIDNEY_LAGOON.x) * 1) ;
  if (kl < 1.4) h = h + (-2.4 - h) * (1 - smoothstep(0.9, 1.4, kl));
  const dm = Math.hypot(x - MARSH.x, z - MARSH.z);
  if (dm < MARSH.r * 1.5) h = h + (-1.2 - h) * (1 - smoothstep(MARSH.r, MARSH.r * 1.5, dm));
  return h;
}

/** Where the paths cross a canal: bridge spots (position + yaw along the path). */
function bridgeSpots() {
  const out: { x: number; z: number; yaw: number }[] = [];
  for (const [ax, az, bx, bz] of PATHS) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 1.5);
    let inCanal = false, startT = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const wet = canalInfo(x, z).d < 4;
      if (wet && !inCanal) { inCanal = true; startT = t; }
      if (!wet && inCanal) {
        inCanal = false;
        const m = (startT + t) / 2;
        out.push({ x: ax + (bx - ax) * m, z: az + (bz - az) * m, yaw: Math.atan2(bx - ax, bz - az) });
      }
    }
  }
  return out;
}

export class Aquorra {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  private water!: THREE.Mesh;
  private beating: THREE.Object3D[] = [];
  private cured = false;
  private cureK = 0;
  private t = 0;
  private motes!: THREE.Points;
  private moteBase = new Float32Array(0);

  constructor() {
    this.root.position.set(AQU.x, 0, AQU.z);
    this.buildTerrain();
    this.water = regionWater(AQU_SIZE, 180, WATER_LEVEL, (x, z) => this.h(x, z), (x, z) => {
      if (Math.hypot(x - MARSH.x, z - MARSH.z) < MARSH.r * 1.6) return 3;
      const c = canalInfo(x, z);
      return c.d < 9 ? c.kind : 0;
    });
    this.root.add(this.water);
    const S = AQU_SITES;
    this.dock(S.dock.x, S.dock.z);
    this.plaza(S.plaza.x, S.plaza.z);
    this.heartTemple(S.heart.x, S.heart.z);
    this.vesselQuarter(S.vessels.x, S.vessels.z);
    this.fort(S.fort.x, S.fort.z);
    this.kidneyLagoon(S.kidney.x, S.kidney.z);
    this.marsh(MARSH.x, MARSH.z);
    for (const b of bridgeSpots()) this.bridge(b.x, b.z, b.yaw);
    this.scenery();
    this.buildMotes();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
  }

  private h(x: number, z: number) { return aquHeightLocal(x, z); }
  private col(x: number, z: number, r: number, id?: string) { this.colliders.push({ x: AQU.x + x, z: AQU.z + z, r, id }); }
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
  /** Stand-in until the model exists: a simple shape; `slot` takes over when assets/models/props/<slot>.glb is there. */
  private placeholder(geo: THREE.BufferGeometry, color: string, y = 0) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, toon(color));
    m.position.y = y;
    g.add(m);
    return g;
  }

  // ---------------------------------------------------------------- terrain
  private buildTerrain() {
    const seg = 160;
    const geo = new THREE.PlaneGeometry(AQU_SIZE, AQU_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#86c47c'), lush = new THREE.Color('#6eb470'), sand = new THREE.Color('#e6d6a8');
    const stone = new THREE.Color('#d8d2c4'), rock = new THREE.Color('#a9aab2'), high = new THREE.Color('#8fb59a'), mud = new THREE.Color('#7f8a5a');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.h(x, z);
      pos.setY(i, y);
      const e = 0.8;
      const nx = this.h(x + e, z) - this.h(x - e, z), nz = this.h(x, z + e) - this.h(x, z - e);
      const slope = 1 - 2 * e / Math.hypot(nx, 2 * e, nz);
      tmp.copy(grass).lerp(lush, smoothstep(0.35, 0.7, fbm(x * 0.03 + 3, z * 0.03 + 8, 3)));
      if (y < 0.6) tmp.lerp(sand, smoothstep(0.6, -0.4, y)); // sandy banks
      tmp.lerp(rock, smoothstep(0.25, 0.45, slope));
      tmp.lerp(high, smoothstep(10, 30, y) * 0.6);
      if (Math.hypot(x - MARSH.x, z - MARSH.z) < MARSH.r * 1.9) tmp.lerp(mud, 0.5 * (1 - smoothstep(MARSH.r * 1.2, MARSH.r * 1.9, Math.hypot(x - MARSH.x, z - MARSH.z))));
      const pd = pathDist(x, z);
      if (pd < 2.6) tmp.lerp(stone, 0.85 * (1 - smoothstep(1.6, 2.6, pd))); // pale paving
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.root.add(mesh);
  }

  // ---------------------------------------------------------------- sites
  private dock(x: number, z: number) {
    const deck = new THREE.Group();
    const a = toon('#e8e2d4'), b = toon('#d6cfbf');
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

  /** Royal plaza: the Queen's palace to the north, a fountain in the middle, canal houses around. */
  private plaza(cx: number, cz: number) {
    const palace = this.placeholder(new THREE.BoxGeometry(16, 9, 10), '#f2eee6', 4.5);
    this.add(palace, cx, cz - 14);
    for (let i = -1; i <= 1; i++) this.col(cx + i * 5, cz - 14, 4.5);
    void propSlot(palace, 'BLD_AquPalace', { w: 20 });
    const fountain = this.placeholder(new THREE.CylinderGeometry(2.4, 2.8, 1, 16), '#d8d2c4', 0.5);
    this.add(fountain, cx, cz + 4);
    this.col(cx, cz + 4, 2.6);
    void propSlot(fountain, 'PRP_Fountain', { w: 5.5 });
    let n = 0;
    for (const [dx, dz, yaw] of [[-15, -2, Math.PI / 2], [15, -2, -Math.PI / 2], [-14, 14, Math.PI * 0.8], [14, 14, -Math.PI * 0.8], [-24, 6, Math.PI / 2], [24, 6, -Math.PI / 2]] as const) {
      const house = this.placeholder(new THREE.BoxGeometry(5, 6, 5), '#e9d6c0', 3);
      house.rotation.y = yaw;
      this.add(house, cx + dx, cz + dz);
      this.col(cx + dx, cz + dz, 3);
      const variant = `BLD_AquHouse${'AB'[n % 2]}`; // two house models, alternating round the plaza
      void propSlot(house, hasProp(variant) ? variant : 'BLD_AquHouse', { w: 6 });
      n++;
    }
    for (const [dx, dz] of [[-7, 10], [7, 10], [-7, -4], [7, -4]]) {
      const lamp = this.placeholder(new THREE.CylinderGeometry(0.1, 0.12, 3, 6), '#3a3f50', 1.5);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glow('#ffe6a0', 1.4, 0.95));
      bulb.position.y = 3.1;
      bulb.userData.keep = true;
      lamp.add(bulb);
      this.add(lamp, cx + dx, cz + dz);
      void propSlot(lamp, 'PRP_CanalLamp', { h: 3.4 });
    }
  }

  /** Heart Temple: a ring of columns around a giant beating heart on a dais; its chambers and valves are scannable. */
  private heartTemple(cx: number, cz: number) {
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.6, 0.8, 32), toon('#e8e2d4'));
    this.add(dais, cx, cz, 0.2);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const col = this.placeholder(new THREE.CylinderGeometry(0.45, 0.55, 6, 10), '#f0ebe0', 3);
      this.add(col, cx + Math.cos(a) * 8.4, cz + Math.sin(a) * 8.4, 0.5);
      this.col(cx + Math.cos(a) * 8.4, cz + Math.sin(a) * 8.4, 0.6);
    }
    const heart = this.placeholder(new THREE.SphereGeometry(2.4, 18, 14), '#d84a5a', 3.2);
    this.add(heart, cx, cz, 0.6);
    this.col(cx, cz, 3);
    void propSlot(heart, 'PRP_HeartModel', { h: 6 });
    this.beating.push(heart);
    const y = this.h(cx, cz) + 3.6;
    this.scan('OBJ_AQU_ATRIUM', 'CDX_HEART_ATRIUM', ['heart'], cx - 1.2, y + 1.2, cz + 1.4, 1.6, 'หัวใจห้องบน (เอเทรียม)');
    this.scan('OBJ_AQU_VENTRICLE', 'CDX_HEART_VENTRICLE', ['heart'], cx + 0.6, y - 1.4, cz + 1.6, 1.8, 'หัวใจห้องล่าง (เวนทริเคิล)');
    this.scan('OBJ_AQU_VALVE', 'CDX_HEART_VALVE', ['heart'], cx + 0.2, y, cz + 2, 1.2, 'ลิ้นหัวใจ');
    this.scan('OBJ_AQU_AORTA', 'CDX_HEART_AORTA', ['heart'], cx + 0.8, y + 2.6, cz + 0.6, 1.4, 'หลอดเลือดแดงใหญ่ (เอออร์ตา)');
    this.board(cx + 6, cz + 13, Math.atan2(AQU_SITES.plaza.x - cx, AQU_SITES.plaza.z - cz));
  }

  /** Vessel quarter: where an artery canal and a vein canal meet through a mesh of thin capillary channels; blood-cell sculptures. */
  private vesselQuarter(cx: number, cz: number) {
    const rbc = this.placeholder(new THREE.TorusGeometry(1.4, 0.7, 10, 20), '#e05060', 1.8);
    this.add(rbc, cx - 6, cz + 4);
    this.col(cx - 6, cz + 4, 1.8);
    void propSlot(rbc, 'PRP_RBC', { w: 3.6 });
    const wbc = this.placeholder(new THREE.SphereGeometry(1.5, 14, 10), '#f4f1ff', 1.6);
    this.add(wbc, cx + 6, cz + 4);
    this.col(cx + 6, cz + 4, 1.8);
    void propSlot(wbc, 'PRP_WBC', { w: 3.6 });
    // a little grid of capillary channels (glowing threads) between the two canals
    const cap = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), glow(i % 2 ? '#ff9aa8' : '#9ab8ff', 1.2, 0.9));
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0, 0.25, -3 + i);
      cap.add(tube);
    }
    this.add(cap, cx, cz - 6);
    const y = this.h(cx, cz) + 1;
    this.scan('OBJ_AQU_ARTERY', 'CDX_ARTERY', ['vessel'], cx + 2, y - 1, cz + 16, 4, 'คลองหลอดเลือดแดง');
    this.scan('OBJ_AQU_VEIN', 'CDX_VEIN', ['vessel'], cx + 2, y - 1, cz - 22, 4, 'คลองหลอดเลือดดำ');
    this.scan('OBJ_AQU_CAPILLARY', 'CDX_CAPILLARY', ['vessel'], cx, y, cz - 6, 3, 'หลอดเลือดฝอย');
    this.scan('OBJ_AQU_RBC', 'CDX_RBC', ['vessel'], cx - 6, y + 1, cz + 4, 2.4, 'เม็ดเลือดแดง');
    this.board(cx, cz + 12, Math.atan2(AQU_SITES.plaza.x - cx, AQU_SITES.plaza.z - cz));
  }

  /** White-blood-cell fortress. */
  private fort(cx: number, cz: number) {
    const keep = this.placeholder(new THREE.CylinderGeometry(5, 6, 12, 8), '#e9e6f2', 6);
    this.add(keep, cx, cz - 6);
    this.col(cx, cz - 6, 6);
    void propSlot(keep, 'BLD_ImmuneFort', { w: 14 });
    for (const dx of [-7, 7]) {
      const guard = this.placeholder(new THREE.SphereGeometry(1.2, 12, 10), '#f4f1ff', 1.3);
      this.add(guard, cx + dx, cz + 6);
      this.col(cx + dx, cz + 6, 1.4);
      void propSlot(guard, 'PRP_WBC', { w: 2.8 });
    }
    this.scan('OBJ_AQU_FORT', 'CDX_IMMUNE_SYSTEM', ['immune'], cx, this.h(cx, cz) + 6, cz - 6, 6, 'ป้อมเม็ดเลือดขาว');
    this.board(cx + 4, cz + 12, 0);
  }

  /** Kidney lagoon: a bean-shaped lake, the giant kidney on its shore and a nephron tower. */
  private kidneyLagoon(cx: number, cz: number) {
    const sx = cx - 18, sz = cz + 14;
    const kidney = this.placeholder(new THREE.SphereGeometry(3, 16, 12), '#a8404a', 3);
    kidney.scale.set(0.7, 1, 0.45);
    this.add(kidney, sx - 4, sz - 6);
    this.col(sx - 4, sz - 6, 2.6);
    void propSlot(kidney, 'PRP_Kidney', { h: 6 });
    const neph = this.placeholder(new THREE.CylinderGeometry(0.6, 0.6, 7, 10), '#e8b070', 3.5);
    this.add(neph, sx + 5, sz - 6);
    this.col(sx + 5, sz - 6, 1.6);
    void propSlot(neph, 'PRP_Nephron', { h: 8 });
    const y = this.h(sx, sz) + 2;
    this.scan('OBJ_AQU_GLOMERULUS', 'CDX_GLOMERULUS', ['nephron'], sx + 5, y + 4.5, sz - 6, 1.5, 'โกลเมอรูลัส');
    this.scan('OBJ_AQU_BOWMAN', 'CDX_BOWMAN', ['nephron'], sx + 5.6, y + 4, sz - 5.4, 1.5, 'โบว์แมนแคปซูล');
    this.scan('OBJ_AQU_TUBULE', 'CDX_TUBULE', ['nephron'], sx + 5, y + 1.5, sz - 6, 1.5, 'ท่อหน่วยไต');
    this.scan('OBJ_AQU_KIDNEY', 'CDX_KIDNEY', ['nephron'], sx - 4, y + 1, sz - 6, 2.5, 'ไต');
    this.board(sx, sz + 6, 0);
  }

  /** Plague Marsh: toxic green water and sick reeds until cured. */
  private marsh(cx: number, cz: number) {
    const reed = toon('#7a8a4a');
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + Math.sin(i) * 0.2, r = MARSH.r * (1.05 + (i % 3) * 0.12);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.6 + (i % 4) * 0.3, 4), reed);
      this.add(stalk, x, z, 0.6);
    }
    this.scan('OBJ_AQU_MARSH', 'CDX_SUPERBUG', ['marsh'], cx, this.h(cx, cz) + 1.5, cz, 6, 'หนองน้ำพิษ');
  }

  private bridge(x: number, z: number, yaw: number) {
    const g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 9), toon('#c9a77a'));
    deck.position.y = 0.2;
    g.add(deck);
    g.rotation.y = yaw;
    this.add(g, x, z, 0);
    void propSlot(g, 'PRP_AquBridge', { w: 10, h: 2.4, stretch: true, yaw: Math.PI / 2, y: -0.35 });
  }

  /** Puzzle board stand-in (same slot as the other regions). */
  private board(x: number, z: number, face: number) {
    const g = this.placeholder(new THREE.BoxGeometry(1.8, 1.2, 0.12), '#d9c08a', 1.5);
    g.rotation.y = face;
    addOutline(g, 0.03);
    this.add(g, x, z);
    this.col(x, z, 0.8);
    void propSlot(g, 'PRP_PuzzleBoard', { h: 2.2, piece: Math.abs(Math.round(x + z)) % 3 });
  }

  /** Trees on the islands (downloaded flora), boats moored along the canals. */
  private scenery() {
    let s = 61;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const clear = (x: number, z: number) =>
      Object.values(AQU_SITES).every((p) => Math.hypot(x - p.x, z - p.z) > 24) && pathDist(x, z) > 5 && canalInfo(x, z).d > 8 && this.h(x, z) > 0.5;
    const sets: Record<string, FloraSet> = {
      trees: { ...PAINTED_TREES, foliage: ['#4fa65a', '#b6dc7a'] },
      sakura: { file: 'NAT_Sakura', sway: 0.03, far: 320 },
      bush: { file: 'NAT_Bush', sway: 0.06, far: 110 },
      blooms: { file: 'NAT_Flowers', split: true, sway: 0.1, far: 80, lodDist: 35 },
    };
    for (const k of Object.keys(sets)) if (!hasFlora(sets[k].file)) delete sets[k];
    const spots: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(sets).map((k) => [k, []]));
    const at = (k: string, x: number, z: number, scale: number) => { if (spots[k]) spots[k].push({ x, y: this.h(x, z) - 0.2, z, rot: rand() * 6.28, scale }); };
    let n = 0;
    for (let i = 0; i < 700 && n < 110; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 140 || !clear(x, z)) continue;
      const roll = rand();
      if (roll < 0.45) { at('trees', x, z, 8 + rand() * 4); this.col(x, z, 0.7); n++; }
      else if (roll < 0.6) { at('sakura', x, z, 7 + rand() * 3); this.col(x, z, 0.7); n++; }
      else if (roll < 0.8) at('bush', x, z, 1 + rand() * 0.6);
      else at('blooms', x, z, 0.25 + rand() * 0.2);
    }
    for (const k of Object.keys(sets)) if (spots[k].length) this.root.add(plantFlora(sets[k], spots[k], rand));
    // moored boats
    for (const c of CANALS) for (let i = 0; i < c.pts.length - 1; i += 2) {
      const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1];
      const x = (ax + bx) / 2 + 2, z = (az + bz) / 2;
      if (pathDist(x, z) < 6) continue;
      const boat = this.placeholder(new THREE.BoxGeometry(1.2, 0.4, 4), '#8a5a3a', 0.2);
      boat.rotation.y = Math.atan2(bx - ax, bz - az);
      boat.position.set(x, WATER_LEVEL, z);
      this.root.add(boat);
      void propSlot(boat, 'PRP_Gondola', { w: 4.2, yaw: Math.PI / 2 });
    }
  }

  /** Floating light motes over the water (the city's "plasma"), drifting around the player. */
  private buildMotes() {
    const n = 90;
    this.moteBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.moteBase[i * 3] = (Math.random() - 0.5) * 50; this.moteBase[i * 3 + 1] = Math.random() * 6; this.moteBase[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfe8ff, size: 0.16, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.motes.frustumCulled = false;
    this.motes.userData.noShadow = true;
    this.root.add(this.motes);
  }

  /** Cured = the marsh water clears (animated unless `instant`). */
  setCured(on: boolean, instant = false) {
    this.cured = on;
    if (instant) this.cureK = on ? 1 : 0;
    (this.water.material as THREE.ShaderMaterial).uniforms.uCure.value = this.cureK;
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.t += dt;
    const target = this.cured ? 1 : 0;
    if (this.cureK !== target) {
      this.cureK += Math.sign(target - this.cureK) * Math.min(Math.abs(target - this.cureK), dt * 0.3);
      (this.water.material as THREE.ShaderMaterial).uniforms.uCure.value = this.cureK;
    }
    // the temple heart beats (~70 bpm: a quick double "lub-dub" squeeze)
    const ph = (this.t * 1.17) % 1;
    const beat = 1 + 0.06 * Math.exp(-((ph - 0.05) ** 2) / 0.002) + 0.04 * Math.exp(-((ph - 0.22) ** 2) / 0.002);
    for (const b of this.beating) b.scale.setScalar(beat);
    const near = inAquorra(playerPos.x, playerPos.z);
    this.motes.visible = near;
    if (near) {
      const lx = playerPos.x - AQU.x, lz = playerPos.z - AQU.z;
      const p = this.motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const wx = this.moteBase[i * 3] + Math.sin(this.t * 0.3 + i) * 1.2, wz = this.moteBase[i * 3 + 2] + Math.cos(this.t * 0.25 + i) * 1.2;
        const x = lx + ((((wx - lx + 25) % 50) + 50) % 50) - 25, z = lz + ((((wz - lz + 25) % 50) + 50) % 50) - 25;
        p.setXYZ(i, x, playerPos.y + this.moteBase[i * 3 + 1] - 1 + Math.sin(this.t + i) * 0.3, z);
      }
      p.needsUpdate = true;
    }
  }
}
