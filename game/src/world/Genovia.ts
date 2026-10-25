import * as THREE from 'three';
import { hasFlora, plantFlora, type FloraSet, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { applyDetailTexture, propSlot, hasProp } from '../models/PropModels';
import { GENOVIA_PALETTE, hasNature, scatter, type Spot } from './Nature';

/**
 * เจโนเวีย — snowy region of Cryo/genetics (chapter 2). Its own zone far from Cytoria, reached by airship.
 * Ice here grows into DNA double helices; the Gene Library sits at the foot of a glacier.
 */
export const GEN = { x: 1800, z: 0 };
export const GEN_RADIUS = 160;
export const GEN_SIZE = 420;

export function inGenovia(x: number, z: number) {
  return Math.hypot(x - GEN.x, z - GEN.z) < GEN_SIZE / 2 + 40;
}

/** Points of interest in local coordinates (-z = north). Mirrors locations.json. */
export const GEN_SITES = {
  dock: { x: 0, z: 118 },
  plaza: { x: 0, z: 42 },
  village: { x: -32, z: 72 },
  greenhouse: { x: 52, z: 58 },
  lake: { x: 62, z: -8, r: 26 },
  cave: { x: -82, z: -6 },
  library: { x: 0, z: -62 },
  fort: { x: 92, z: -82 },
};

const FLATS: { x: number; z: number; r: number; h: number }[] = [
  { ...GEN_SITES.dock, r: 12, h: 1 },
  { ...GEN_SITES.plaza, r: 12, h: 1 },
  { ...GEN_SITES.village, r: 20, h: 1.2 },
  { ...GEN_SITES.greenhouse, r: 13, h: 1.5 },
  { x: GEN_SITES.library.x, z: GEN_SITES.library.z, r: 16, h: 2 },
  { ...GEN_SITES.cave, r: 11, h: 2 },
  { x: GEN_SITES.fort.x, z: GEN_SITES.fort.z, r: 26, h: 1.5 },
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Height in local coordinates. */
export function genHeightLocal(x: number, z: number): number {
  let h = (fbm(x * 0.012 + 40, z * 0.012 + 7) - 0.5) * 16 + (fbm(x * 0.05 + 3, z * 0.05, 2) - 0.5) * 1.4;
  // glacier plateau along the north (library is carved into its southern face)
  const gx = Math.max(-80, Math.min(80, x)), dg = Math.hypot(x - gx, z + 112);
  h += 24 * (1 - smoothstep(26, 44, dg));
  // frozen lake basin
  const dl = Math.hypot(x - GEN_SITES.lake.x, z - GEN_SITES.lake.z);
  if (dl < GEN_SITES.lake.r + 14) h = h + (-1.2 - h) * (1 - smoothstep(GEN_SITES.lake.r, GEN_SITES.lake.r + 14, dl));
  // mountain ring
  const r = Math.hypot(x, z);
  h += smoothstep(140, 195, r) * 60 * (0.7 + 0.6 * fbm(x * 0.02 + 9, z * 0.02, 2));
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = h + (f.h - h) * (1 - smoothstep(f.r, f.r * 1.8, d));
  }
  return h;
}

export function isGenIce(x: number, z: number) {
  return Math.hypot(x - GEN.x - GEN_SITES.lake.x, z - GEN.z - GEN_SITES.lake.z) < GEN_SITES.lake.r;
}

/** Cell-shaped airship used at both docks (Cellaria academy and Genovia). */
export function buildAirship() {
  const g = new THREE.Group();
  const envelope = new THREE.Mesh(new THREE.CapsuleGeometry(2.2, 6, 8, 16), new THREE.MeshToonMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.85 }));
  envelope.rotation.z = Math.PI / 2;
  envelope.position.y = 7;
  const band = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.12, 6, 20), toon('#e8c468'));
  band.rotation.y = Math.PI / 2;
  band.position.y = 7;
  const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), toon('#b490e0'));
  nucleus.position.set(1, 7.2, 0);
  nucleus.userData.noOutline = true;
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.8), toon('#8a6243'));
  gondola.position.y = 3.6;
  for (const sx of [-1.6, 1.6]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 4), toon('#5a4636'));
    rope.position.set(sx, 5, 0);
    g.add(rope);
  }
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.3), toon('#5a5f70'));
  prop.position.set(-4.6, 7, 0);
  prop.userData.spin = 6;
  g.add(envelope, band, nucleus, gondola, prop);
  return g;
}


export class Genovia {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  private libraryDoor!: THREE.Object3D;
  private doorOpenT = 0;
  private doorOpen = false;
  private fortLights: THREE.MeshToonMaterial[] = [];
  private spin: THREE.Object3D[] = [];
  private snow!: THREE.Points;
  private t = 0;

  constructor() {
    this.root.position.set(GEN.x, 0, GEN.z);
    this.buildTerrain();
    const S = GEN_SITES;
    this.dnaSpire(S.plaza.x, S.plaza.z, 15, true);
    for (const [x, z, hgt] of [[-40, 20, 8], [30, 10, 7], [-15, -20, 9], [70, 30, 6], [-60, 45, 7], [20, 90, 6], [-90, 60, 8], [110, 0, 7]]) this.dnaSpire(x, z, hgt, false);
    this.dock(S.dock.x, S.dock.z);
    this.village(S.village.x, S.village.z);
    this.greenhouse(S.greenhouse.x, S.greenhouse.z);
    this.library(S.library.x, S.library.z);
    this.cave(S.cave.x, S.cave.z);
    this.fort(S.fort.x, S.fort.z);
    this.trees();
    this.buildSnow();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
  }

  private h(x: number, z: number) { return genHeightLocal(x, z); }
  private col(x: number, z: number, r: number, id?: string) { this.colliders.push({ x: GEN.x + x, z: GEN.z + z, r, id }); }
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

  // ---------------------------------------------------------------- terrain + snowfall
  private buildTerrain() {
    const seg = 150;
    const geo = new THREE.PlaneGeometry(GEN_SIZE, GEN_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const snow = new THREE.Color('#eef4fb'), shade = new THREE.Color('#cfdcec'), rock = new THREE.Color('#8a8fa0'), ice = new THREE.Color('#a8e4f4'), path = new THREE.Color('#d9d2c4');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.h(x, z);
      pos.setY(i, y);
      const e = 0.8;
      const nx = this.h(x + e, z) - this.h(x - e, z), nz = this.h(x, z + e) - this.h(x, z - e);
      const slope = 1 - 2 * e / Math.hypot(nx, 2 * e, nz);
      tmp.copy(snow).lerp(shade, smoothstep(0.4, 0.7, fbm(x * 0.04, z * 0.04, 3)));
      tmp.lerp(rock, smoothstep(0.16, 0.32, slope));
      if (Math.hypot(x - GEN_SITES.lake.x, z - GEN_SITES.lake.z) < GEN_SITES.lake.r) tmp.copy(ice);
      // trodden paths from the dock to every site
      for (const s of [GEN_SITES.village, GEN_SITES.greenhouse, GEN_SITES.library, GEN_SITES.cave, GEN_SITES.fort]) {
        const ax = GEN_SITES.plaza.x, az = GEN_SITES.plaza.z, bx = s.x, bz = s.z;
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
        const d = Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
        if (d < 2.4) tmp.lerp(path, 0.6);
      }
      if (Math.abs(x) < 2.4 && z > GEN_SITES.plaza.z && z < GEN_SITES.dock.z) tmp.lerp(path, 0.6);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.root.add(mesh);
    applyDetailTexture(mesh.material as THREE.MeshToonMaterial, 'TEX_Ground_Genovia', 50);
  }

  private buildSnow() {
    const n = 1400;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 70; p[i * 3 + 1] = Math.random() * 30; p[i * 3 + 2] = (Math.random() - 0.5) * 70; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85, depthWrite: false }));
    this.snow.frustumCulled = false;
    this.snow.userData.noShadow = true;
    this.root.add(this.snow);
  }

  // ---------------------------------------------------------------- landmarks
  private dnaSpire(x: number, z: number, hgt: number, scannable: boolean) {
    const g = new THREE.Group();
    const iceA = new THREE.MeshToonMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.9, emissive: 0x4ab8e0, emissiveIntensity: 0.35 });
    const iceB = new THREE.MeshToonMaterial({ color: 0xe0f8ff, transparent: true, opacity: 0.9, emissive: 0x7ad0f0, emissiveIntensity: 0.25 });
    const baseCols = ['#ff7a6a', '#ffd35a', '#7ae07a', '#6aa8ff']; // A T C G
    const steps = Math.round(hgt * 2.2);
    for (let i = 0; i < steps; i++) {
      const a = i * 0.5, y = 0.6 + i * (hgt / steps);
      const r = 1.1;
      for (const [s, m] of [[0, iceA], [Math.PI, iceB]] as const) {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), m);
        c.position.set(Math.cos(a + s) * r, y, Math.sin(a + s) * r);
        c.scale.y = 1.6;
        g.add(c);
      }
      // base pair rung: two halves in complementary colours
      const k = i % 4;
      for (const [sgn, col] of [[1, baseCols[k]], [-1, baseCols[k ^ 1]]] as const) {
        const half = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, r, 5), toon(col));
        half.position.set(Math.cos(a) * r * 0.5 * sgn, y, Math.sin(a) * r * 0.5 * sgn);
        half.rotation.z = Math.PI / 2;
        half.rotation.y = -a;
        g.add(half);
      }
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 0.8, 6), toon('#cfdcec'));
    base.position.y = 0.2;
    g.add(base);
    if (scannable) g.scale.setScalar(1.25);
    addOutline(g, 0.03);
    this.add(g, x, z);
    void propSlot(g, 'PRP_DNASpire', { h: hgt + 1 });
    this.col(x, z, scannable ? 2.6 : 1.9);
    if (scannable) this.scan('OBJ_DNA_SPIRE', 'CDX_DNA', ['dna_spire'], x, this.h(x, z) + 4, z, 3.5, 'เกลียวน้ำแข็ง DNA');
  }

  private dock(x: number, z: number) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.8, 8), toon('#d9d2c4'));
    pad.position.y = 0.4;
    const g = new THREE.Group();
    g.add(pad);
    const ship = buildAirship();
    ship.position.y = 0.6;
    ship.rotation.y = Math.PI / 2;
    g.add(ship);
    void propSlot(ship, 'PRP_Airship', { w: 11 });
    this.spin.push(...ship.children.filter((c) => c.userData.spin));
    addOutline(g, 0.04);
    this.add(g, x, z);
    this.col(x, z, 4.5);
  }

  private village(cx: number, cz: number) {
    const walls = ['#e9d8c0', '#d8c8e8', '#c8e0d8', '#f0d0c0', '#d0dcef', '#efe0b0'];
    const doors = ['#e8553a', '#3a8ad8', '#6fbf4a', '#f2c45a', '#8a5ad8', '#e85a9a'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, x = cx + Math.cos(a) * 14, z = cz + Math.sin(a) * 12;
      const house = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3, 3.6), toon(walls[i]));
      body.position.y = 1.5;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.4, 4), toon('#7a5a9a'));
      roof.position.y = 4.2;
      roof.rotation.y = Math.PI / 4;
      const snowCap = new THREE.Mesh(new THREE.ConeGeometry(3.7, 1, 4), toon('#ffffff'));
      snowCap.position.y = 5.1;
      snowCap.rotation.y = Math.PI / 4;
      const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.1), toon(doors[i]));
      door.position.set(0, 0.9, 1.82);
      house.add(body, roof, snowCap, door);
      house.rotation.y = Math.atan2(cx - x, cz - z);
      addOutline(house, 0.03);
      this.add(house, x, z);
      // six downloaded house models, one per house; the shared GenHouse model (or the procedural hut) otherwise
      const variant = `BLD_House${'ABCDEF'[i]}`;
      void propSlot(house, hasProp(variant) ? variant : 'BLD_GenHouse', { w: 5, y: -0.15 }); // sunk a little so no gap shows under the floor
      this.col(x, z, 2.8);
    }
    // village well with a Punnett-square mosaic on top
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 1, 12), toon('#cfc6b0'));
    well.position.y = 0.5;
    const g = new THREE.Group();
    g.add(well);
    for (let i = 0; i < 4; i++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), toon(['#6fbf4a', '#6fbf4a', '#6fbf4a', '#e8c468'][i]));
      tile.position.set((i % 2 ? 0.5 : -0.5), 1.05, (i < 2 ? -0.5 : 0.5));
      g.add(tile);
    }
    this.add(g, cx, cz);
    this.col(cx, cz, 1.7);
  }

  private greenhouse(x: number, z: number) {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.28, depthWrite: false }));
    glass.scale.set(1.3, 0.75, 1);
    glass.userData.noOutline = true;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(7, 0.12, 6, 32), toon('#e8c468'));
    frame.rotation.x = Math.PI / 2;
    frame.scale.set(1.3, 1, 1);
    g.add(glass, frame);
    // pea plants in rows: purple and white flowers, round and wrinkled peas
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const px = -6 + c * 2.4, pz = -3 + r * 3;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 5), toon('#4f9f3a'));
      stem.position.set(px, 0.7, pz);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), toon('#6fcf5a'));
      leaf.scale.set(1, 0.5, 1);
      leaf.position.set(px, 1.1, pz);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), toon((r + c) % 4 === 0 ? '#ffffff' : '#a060d0'));
      flower.position.set(px, 1.5, pz);
      g.add(stem, leaf, flower);
    }
    addOutline(g, 0.03);
    this.add(g, x, z);
    void propSlot(g, 'BLD_PeaGreenhouse', { w: 19 });
    // walls of the dome are solid except the doorway on the south
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.35) continue;
      this.col(x + Math.cos(a) * 8.6, z + Math.sin(a) * 6.6, 1.2);
    }
  }

  private library(x: number, z: number) {
    const g = new THREE.Group();
    const ice = new THREE.MeshToonMaterial({ color: 0xd8f4ff, emissive: 0x6ac8f0, emissiveIntensity: 0.15 });
    const stone = toon('#e6eef8');
    // facade carved into the glacier face
    const facade = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 3), ice);
    facade.position.set(0, 7, -6);
    facade.userData.noOutline = true;
    g.add(facade);
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const colm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 11, 8), stone);
      colm.position.set(i * 3.4, 5.5, -3.8);
      g.add(colm);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 2.6), stone);
    lintel.position.set(0, 11.4, -4);
    g.add(lintel);
    // DNA emblem over the door
    const emblem = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = i * 0.65;
      for (const s of [0, Math.PI]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glow('#9fe3f0', 1.4));
        b.position.set(Math.cos(a + s) * 0.8, i * 0.32, Math.sin(a + s) * 0.3);
        b.userData.noOutline = true;
        emblem.add(b);
      }
    }
    emblem.position.set(0, 7.6, -4.2);
    g.add(emblem);
    // the great door (opens with the base-pairing puzzle)
    const door = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6, 0.5), new THREE.MeshToonMaterial({ color: 0x6aa8d8, emissive: 0x2a6aa0, emissiveIntensity: 0.4 }));
    door.position.set(0, 3, -4.4);
    const glowBack = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 5.8), glow('#bff4ff', 1.6));
    glowBack.position.set(0, 3, -4.7);
    glowBack.userData.noOutline = true;
    door.userData.keep = true;
    glowBack.userData.keep = true;
    g.add(door, glowBack);
    this.libraryDoor = door;
    // ice bookshelves in the courtyard
    const books = ['#ff7a6a', '#ffd35a', '#7ae07a', '#6aa8ff', '#c58bff'];
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
      const shelf = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 1), ice);
      frame.position.y = 1.6;
      shelf.add(frame);
      for (let row = 0; row < 3; row++) for (let b = 0; b < 8; b++) {
        const bk = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.75, 0.6), toon(books[(b + row + k) % 5]));
        bk.position.set(-1.55 + b * 0.44, 0.55 + row * 1, 0.3);
        shelf.add(bk);
      }
      shelf.position.set(sx * (6 + k * 5), 0, 3 + k * 1.5);
      shelf.rotation.y = -sx * 0.25;
      g.add(shelf);
      this.col(x + sx * (6 + k * 5), z + 3 + k * 1.5, 2);
    }
    addOutline(g, 0.04);
    this.add(g, x, z);
    void propSlot(g, 'BLD_GeneLibrary', { w: 27 });
    for (let i = -6; i <= 6; i++) this.col(x + i * 2, z - 5, 1.6, Math.abs(i) <= 1 ? 'libdoor' : undefined);
  }

  setLibraryOpen(open: boolean, instant = false) {
    this.doorOpen = open;
    if (open && instant) this.doorOpenT = 1;
    this.libraryDoor.position.y = 3 - this.doorOpenT * 6.2;
  }

  private cave(x: number, z: number) {
    const rockM = toon('#7a7f90'), rock2 = toon('#9095a6');
    const g = new THREE.Group();
    // rock arch tunnel
    for (let i = 0; i < 5; i++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 1.6, 6, 10, Math.PI), i % 2 ? rockM : rock2);
      arch.position.set(0, 0, -6 + i * 3);
      g.add(arch);
    }
    // three pairs of X-shaped chromosome crystals
    const pairCols = [['#ff9ad0', '#ff9ad0'], ['#7ab8ff', '#ff9ad0'], ['#9be06a', '#9be06a']];
    pairCols.forEach((cols, p) => {
      for (let k = 0; k < 2; k++) {
        const chr = new THREE.Group();
        const isY = p === 1 && k === 0;
        for (const s of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, isY ? 1.1 : 1.8, 4, 8), new THREE.MeshToonMaterial({ color: cols[k], emissive: cols[k], emissiveIntensity: 0.35 }));
          arm.rotation.z = s * 0.35;
          chr.add(arm);
        }
        const cen = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), toon('#ffffff'));
        chr.add(cen);
        chr.position.set(-3.5 + p * 3.5 + (k ? 0.75 : -0.75), 1.8, -3 + (p % 2) * 2);
        g.add(chr);
      }
      this.scan(`OBJ_CHR_${p + 1}`, 'CDX_CHROMOSOME', ['chromosome'], x - 3.5 + p * 3.5, this.h(x, z) + 1.8, z - 3 + (p % 2) * 2, 1.6,
        ['โครโมโซมคู่เหมือน (ออโตโซม)', 'โครโมโซมเพศ X และ Y', 'โครโมโซมคู่เหมือนที่จำลองแล้ว'][p]);
    });
    addOutline(g, 0.04);
    g.rotation.y = Math.PI / 2;
    this.add(g, x, z);
    // rotate the scan probes with the cave
    for (const s of this.scannables) if (s.id.startsWith('OBJ_CHR_')) {
      const lx = s.obj.position.x - x, lz = s.obj.position.z - z;
      s.obj.position.set(x + lz, s.obj.position.y, z - lx);
    }
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) this.col(x - 6 + i * 3, z + sx * 6.2, 1.8);
  }

  private fort(x: number, z: number) {
    const steel = toon('#3a3f50'), trim = toon('#7aff9a');
    const g = new THREE.Group();
    const R = 18;
    for (let side = 0; side < 4; side++) {
      for (let k = -2; k <= 2; k++) {
        if (side === 3 && Math.abs(k) <= 0) continue; // gate on the south side
        const seg = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 1.4), steel);
        seg.userData.noOutline = true;
        const a = side * Math.PI / 2;
        const px = Math.cos(a) * R - Math.sin(a) * k * 7, pz = Math.sin(a) * R + Math.cos(a) * k * 7;
        seg.position.set(px, 3, pz);
        seg.rotation.y = -a + Math.PI / 2;
        g.add(seg);
        for (let c = -1; c <= 1; c++) this.col(x + px - Math.sin(a) * c * 2.4, z + pz + Math.cos(a) * c * 2.4, 1.3);
      }
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 10, 8), steel);
      tw.position.set(sx * R, 5, sz * R);
      tw.userData.noOutline = true;
      const lamp = new THREE.MeshToonMaterial({ color: 0x7aff9a, emissive: 0x3aff6a, emissiveIntensity: 0.8 });
      this.fortLights.push(lamp);
      const top = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), lamp);
      top.position.set(sx * R, 10.6, sz * R);
      g.add(tw, top);
      this.col(x + sx * R, z + sz * R, 2.6);
    }
    // half-double-helix banner over the gate
    const banner = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 6, 16, Math.PI), trim);
    banner.position.set(0, 7.5, R);
    g.add(banner);
    // PCR machine + gel electrophoresis bench in the courtyard
    const pcr = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.6), toon('#d8dce8'));
    box.position.y = 0.6;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1.6), toon('#5a6278'));
    lid.position.y = 1.3;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.4), glow('#7aff9a', 1.3));
    screen.position.set(0, 0.8, 0.81);
    screen.userData.noOutline = true;
    pcr.add(box, lid, screen);
    pcr.position.set(-9, 0, -9);
    const gel = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.5), toon('#8a6243'));
    table.position.y = 0.5;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1.1), new THREE.MeshToonMaterial({ color: 0x6aa8ff, transparent: true, opacity: 0.8 }));
    slab.position.y = 1.06;
    gel.add(table, slab);
    for (let lane = 0; lane < 4; lane++) for (let b = 0; b < 3; b++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.06), glow('#ffb0ff', 1.3));
      band.position.set(-0.7 + lane * 0.45, 1.13, -0.35 + ((lane * 3 + b * 5) % 7) * 0.11);
      band.userData.noOutline = true;
      gel.add(band);
    }
    gel.position.set(9, 0, -9);
    g.add(pcr, gel);
    void propSlot(pcr, 'PRP_PCRMachine', { w: 2.4 });
    void propSlot(gel, 'PRP_GelBench', { w: 3.2 });
    addOutline(g, 0.04);
    this.add(g, x, z);
    this.col(x - 9, z - 9, 1.5);
    this.col(x + 9, z - 9, 1.8);
    this.scan('OBJ_PCR', 'CDX_PCR', ['biotech'], x - 9, this.h(x, z) + 1, z - 9, 1.6, 'เครื่อง PCR ของซินดิเคต');
    this.scan('OBJ_GEL', 'CDX_GEL', ['biotech'], x + 9, this.h(x, z) + 1, z - 9, 1.6, 'แผ่นเจลอิเล็กโทรโฟรีซิส');
  }

  private trees() {
    if (hasNature('tree_pineRoundA')) return this.kitTrees();
    const trunk = toon('#6a4a3a'), pine = toon('#3a7a6a'), snowM = toon('#ffffff');
    let s = 21;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    let n = 0;
    // downloaded pines (snow-dusted in the shader) replace the stacked cones when available
    const pineSets: FloraSet[] = [
      { file: 'NAT_Pine1', sway: 0.02, snow: 0.75, far: 300 },
      { file: 'NAT_Pine2', sway: 0.02, snow: 0.75, far: 300 },
      { file: 'NAT_PinePack', split: true, sway: 0.02, snow: 0.75, far: 300 },
    ].filter((f) => hasFlora(f.file));
    const pineSpots: FloraSpot[][] = pineSets.map(() => []);
    for (let i = 0; i < 500 && n < 90; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 135) continue;
      if (Object.values(GEN_SITES).some((p) => Math.hypot(x - p.x, z - p.z) < ('r' in p ? (p as { r: number }).r + 6 : 24))) continue;
      if (Math.abs(x) < 6 && z > 40) continue;
      if (this.h(x, z) > 6) continue;
      if (pineSets.length) {
        pineSpots[Math.floor(rand() * pineSets.length)].push({ x, y: this.h(x, z) - 0.15, z, rot: rand() * 6.28, scale: 4.5 + rand() * 3 });
        this.col(x, z, 0.6);
        n++;
        continue;
      }
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), trunk);
      tr.position.y = 0.7;
      t.add(tr);
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6 - k * 0.4, 1.8, 7), pine);
        cone.position.y = 1.8 + k * 1.1;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.2 - k * 0.35, 0.6, 7), snowM);
        cap.position.y = 2.5 + k * 1.1;
        t.add(cone, cap);
      }
      t.scale.setScalar(0.9 + rand() * 0.6);
      this.add(t, x, z);
      this.col(x, z, 0.6);
      n++;
    }
    pineSets.forEach((set, k) => { if (pineSpots[k].length) this.root.add(plantFlora(set, pineSpots[k], rand)); });
  }

  /** Pines and stones from the nature kit, with snowy foliage tints. */
  private kitTrees() {
    let s = 21;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const spots: Spot[] = [];
    const pines = ['tree_pineRoundA', 'tree_pineRoundB', 'tree_pineRoundC', 'tree_pineTallA_detailed', 'tree_pineTallB_detailed', 'tree_pineSmallA', 'tree_pineSmallB'];
    const tints = ['#4f8a7e', '#5f9a8e', '#6fa89a', '#8fbcb0'].map((c) => new THREE.Color(c));
    const ok = (x: number, z: number, pad: number) => Math.hypot(x, z) < 138
      && !Object.values(GEN_SITES).some((p) => Math.hypot(x - p.x, z - p.z) < ('r' in p ? (p as { r: number }).r + 6 : 22) + pad)
      && !(Math.abs(x) < 6 && z > 40) && this.h(x, z) < 6;
    let n = 0;
    for (let i = 0; i < 900 && n < 150; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (!ok(x, z, 0) || fbm(x * 0.025 + 3, z * 0.025, 2) < 0.42) continue;
      const sc = 4.5 + rand() * 3;
      spots.push({ model: pines[Math.floor(rand() * pines.length)], x: GEN.x + x, y: this.h(x, z) - 0.1, z: GEN.z + z, rot: rand() * 6.28, scale: sc, color: tints[Math.floor(rand() * 4)] });
      this.col(x, z, 0.6);
      n++;
    }
    for (let i = 0; i < 260 && n < 230; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (!ok(x, z, 2)) continue;
      const big = rand() < 0.4;
      spots.push({ model: big ? ['stone_largeA', 'stone_largeB', 'stone_largeC', 'stone_tallA'][Math.floor(rand() * 4)] : ['stone_smallA', 'stone_smallB'][Math.floor(rand() * 2)],
        x: GEN.x + x, y: this.h(x, z) - 0.1, z: GEN.z + z, rot: rand() * 6.28, scale: big ? 3 + rand() * 3 : 3 + rand() * 2 });
      if (big) this.col(x, z, 1);
      n++;
    }
    // scatter() places in world coordinates: add it to the scene root via a world-space group
    const g = scatter(spots, GENOVIA_PALETTE, 0.03);
    g.position.set(-GEN.x, 0, -GEN.z);
    this.root.add(g);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.t += dt;
    for (const o of this.spin) o.rotation.x += dt * (o.userData.spin ?? 1);
    if (this.doorOpen && this.doorOpenT < 1) {
      this.doorOpenT = Math.min(1, this.doorOpenT + dt * 0.4);
      this.libraryDoor.position.y = 3 - this.doorOpenT * 6.2;
    }
    for (const m of this.fortLights) m.emissiveIntensity = 0.5 + Math.sin(this.t * 3) * 0.3;
    // snowfall follows the player
    const near = inGenovia(playerPos.x, playerPos.z);
    this.snow.visible = near;
    if (near) {
      this.snow.position.set(playerPos.x - GEN.x, playerPos.y - 4, playerPos.z - GEN.z);
      const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * (1.2 + (i % 5) * 0.2);
        if (y < 0) y += 30;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(this.t + i) * dt * 0.3);
      }
      p.needsUpdate = true;
    }
  }
}
