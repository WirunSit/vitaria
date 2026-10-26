import * as THREE from 'three';
import { PAINTED_TREES, hasFlora, plantFlora, type FloraSet, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { RegionGround } from './RegionGround';
import { applyDetailTexture, hasProp, propSlot } from '../models/PropModels';
import { buildAirship } from './Genovia';
import { ExperimentPlant, planterBox } from './ExperimentPlant';

/**
 * ฟลอแรนทิส — rainforest of Dendro / plant biology (chapter 4). Its own zone south of the academy, reached by airship.
 * Giant trees whose trunks show their vessels (xylem up, phloem down), a meadow round a giant flower, sun terraces
 * for C3 / C4 / CAM crops, a hormone nursery, and the Mother Tree at the heart of the forest.
 * Until the chapter's boss is beaten the landmark canopies are grey ("the forest stopped photosynthesising").
 * Depth: shafts of sunlight through the canopy and leaves drifting down around the player.
 */
export const FLO = { x: 0, z: 1800 };
export const FLO_RADIUS = 160;
export const FLO_SIZE = 420;

export function inFlorantis(x: number, z: number) {
  return Math.hypot(x - FLO.x, z - FLO.z) < FLO_SIZE / 2 + 40;
}

/** Points of interest in local coordinates (-z = north). Mirrors locations.json. */
export const FLO_SITES = {
  dock: { x: 0, z: 122 },
  village: { x: 0, z: 70 },
  roots: { x: -72, z: 12 },
  bloom: { x: 70, z: 22 },
  terrace: { x: -64, z: -66 },
  nursery: { x: 66, z: -58 },
  heart: { x: 0, z: -104 },
};

const FLATS: { x: number; z: number; r: number; h: number }[] = [
  { ...FLO_SITES.dock, r: 12, h: 1 },
  { ...FLO_SITES.village, r: 20, h: 1 },
  { ...FLO_SITES.roots, r: 18, h: 1.5 },
  { ...FLO_SITES.bloom, r: 18, h: 0.8 },
  { ...FLO_SITES.terrace, r: 20, h: 3 },
  { ...FLO_SITES.nursery, r: 15, h: 1.2 },
  { ...FLO_SITES.heart, r: 26, h: 2 },
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Height in local coordinates: soft jungle hills inside a ring of steep green mountains. */
export function floHeightLocal(x: number, z: number): number {
  let h = (fbm(x * 0.014 + 71, z * 0.014 + 13) - 0.5) * 12 + (fbm(x * 0.06 + 5, z * 0.06, 2) - 0.5) * 1.2;
  const r = Math.hypot(x, z);
  h += smoothstep(158, 205, r) * 42 * (0.7 + 0.6 * fbm(x * 0.02 + 3, z * 0.02 + 8, 2));
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = h + (f.h - h) * (1 - smoothstep(f.r, f.r * 1.8, d));
  }
  return h;
}

/** Distance from (x, z) to the trodden path network (village hub → every site). */
function pathDist(x: number, z: number) {
  let best = Infinity;
  const hub = FLO_SITES.village;
  const seg = (ax: number, az: number, bx: number, bz: number) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    // a gentle wiggle so paths don't look ruled
    const wob = Math.sin(t * 9 + ax * 0.1) * 2.2 * Math.sin(t * Math.PI);
    best = Math.min(best, Math.hypot(x - (ax + (bx - ax) * t) - wob, z - (az + (bz - az) * t)));
  };
  seg(FLO_SITES.dock.x, FLO_SITES.dock.z, hub.x, hub.z);
  for (const s of [FLO_SITES.roots, FLO_SITES.bloom, FLO_SITES.heart]) seg(hub.x, hub.z, s.x, s.z);
  seg(FLO_SITES.roots.x, FLO_SITES.roots.z, FLO_SITES.terrace.x, FLO_SITES.terrace.z);
  seg(FLO_SITES.bloom.x, FLO_SITES.bloom.z, FLO_SITES.nursery.x, FLO_SITES.nursery.z);
  return best;
}

/** Soft vertical gradient used by the light shafts and leaf sprites. */
function shaftTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  v.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  // fade the sides
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

/** Buttress root: a fin whose top edge curves from high on the trunk down to the ground, extruded thin. */
function buttressGeo(len: number, hgt: number, thick: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(len, 0);
  s.quadraticCurveTo(len * 0.22, hgt * 0.12, 0, hgt);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.35, bevelSize: thick * 0.35, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** Trunk with an irregular, fluted outline and a flared base (y = 0 … h). */
function trunkGeo(rTop: number, rBot: number, h: number, flare = 0.5) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 20, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), t = (y + h / 2) / h;
    const k = 1 + 0.09 * Math.sin(a * 5 + t * 5) + 0.05 * Math.sin(a * 11 - t * 9) + flare * (1 - t) ** 4;
    p.setXYZ(i, x * k, y, z * k);
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return g;
}

function leafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(16, 16, 6, 13, 0.6, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(c);
}

export class Florantis {
  root = new THREE.Group();
  /** ground colours (look v3 meadow patches) and a sampler for the grass field */
  ground!: RegionGround;
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  /** canopy materials of the landmark trees: grey while the forest is sick, vivid once restored */
  private canopies: { mat: THREE.MeshToonMaterial; healthy: THREE.Color; sick: THREE.Color }[] = [];
  private flows: { obj: THREE.Object3D; speed: number; len: number }[] = [];
  /** landmark crowns (downloaded tree model): a grey-leaved and a green-leaved copy, swapped on restore */
  private crowns: { healthy: THREE.Object3D; sick: THREE.Object3D }[] = [];
  private shafts: THREE.Object3D[] = [];
  private shaftMat!: THREE.MeshBasicMaterial;
  private leaves!: THREE.Points;
  private leafBase = new Float32Array(0);
  private plants: ExperimentPlant[] = [];
  private spores: THREE.Points | null = null;
  private restored = false;
  private restoreK = 0;
  private t = 0;

  constructor() {
    this.root.position.set(FLO.x, 0, FLO.z);
    this.buildTerrain();
    const S = FLO_SITES;
    this.dock(S.dock.x, S.dock.z);
    this.village(S.village.x, S.village.z);
    this.xylemTree(S.roots.x, S.roots.z);
    this.giantFlower(S.bloom.x, S.bloom.z);
    this.terraces(S.terrace.x, S.terrace.z);
    this.nursery(S.nursery.x, S.nursery.z);
    this.motherTree(S.heart.x, S.heart.z);
    this.forest();
    this.buildShafts();
    this.buildLeaves();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
    this.applyRestore(0);
  }

  private h(x: number, z: number) { return floHeightLocal(x, z); }
  private col(x: number, z: number, r: number, id?: string) { this.colliders.push({ x: FLO.x + x, z: FLO.z + z, r, id }); }
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
  private canopy(healthy: string, sick = '#8f957e') {
    const mat = toon(healthy);
    this.canopies.push({ mat, healthy: new THREE.Color(healthy), sick: new THREE.Color(sick) });
    return mat;
  }

  /** A giant tree crown from the downloaded tree model (two copies: sick grey leaves / healthy green). */
  private crown(x: number, z: number, y: number, height: number, rot: number) {
    if (!hasFlora('NAT_TreePainted')) return false;
    const base: FloraSet = { file: 'NAT_TreePainted', sway: 0.006, far: 900, lodDist: 120 };
    const spot = [{ x, y, z, rot, scale: height }];
    const healthy = plantFlora({ ...base, foliage: ['#2e8a34', '#9ad04a'] }, spot);
    const sick = plantFlora({ ...base, foliage: ['#7f8270', '#b0aa8c'] }, spot);
    this.root.add(healthy, sick);
    this.crowns.push({ healthy, sick });
    return true;
  }

  /** Fluted trunk with curved buttress roots (and their colliders). */
  private bigTrunk(g: THREE.Group, x: number, z: number, rTop: number, rBot: number, h: number, roots: number, rootLen: number, rootH: number) {
    const bark = toon('#6b4a30');
    g.add(new THREE.Mesh(trunkGeo(rTop, rBot, h), bark));
    const fin = buttressGeo(rootLen, rootH, Math.max(0.4, rBot * 0.16));
    for (let i = 0; i < roots; i++) {
      const a = (i / roots) * Math.PI * 2 + 0.3 + Math.sin(i * 7.1) * 0.2;
      const m = new THREE.Mesh(fin, bark);
      m.position.set(Math.cos(a) * rBot * 0.8, 0, Math.sin(a) * rBot * 0.8);
      m.rotation.y = -a;
      m.scale.setScalar(0.8 + Math.abs(Math.sin(i * 3.3)) * 0.4);
      g.add(m);
      this.col(x + Math.cos(a) * (rBot + rootLen * 0.35), z + Math.sin(a) * (rBot + rootLen * 0.35), rootLen * 0.25);
    }
  }

  // ---------------------------------------------------------------- terrain
  private buildTerrain() {
    const seg = 150;
    const geo = new THREE.PlaneGeometry(FLO_SIZE, FLO_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#79b04e'), lush = new THREE.Color('#5a9a42'), moss = new THREE.Color('#4a8040');
    const rock = new THREE.Color('#8a9a78'), high = new THREE.Color('#a8c4a0'), path = new THREE.Color('#b9946a'), sand = new THREE.Color('#d8c08a');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.h(x, z);
      pos.setY(i, y);
      const e = 0.8;
      const nx = this.h(x + e, z) - this.h(x - e, z), nz = this.h(x, z + e) - this.h(x, z - e);
      const slope = 1 - 2 * e / Math.hypot(nx, 2 * e, nz);
      tmp.copy(grass).lerp(lush, smoothstep(0.35, 0.65, fbm(x * 0.03 + 2, z * 0.03, 3)));
      tmp.lerp(moss, smoothstep(0.55, 0.8, fbm(x * 0.08 + 9, z * 0.08 + 4, 2)) * 0.7);
      tmp.lerp(rock, smoothstep(0.2, 0.4, slope));
      tmp.lerp(high, smoothstep(8, 30, y) * 0.7); // the mountain ring fades toward a pale, hazy green
      // the CAM terrace is dry sand
      const t = FLO_SITES.terrace;
      if (Math.hypot(x - (t.x + 9), z - t.z) < 5.5) tmp.lerp(sand, 0.85);
      const pd = pathDist(x, z);
      if (pd < 2.6) tmp.lerp(path, 0.75 * (1 - smoothstep(1.4, 2.6, pd)));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.root.add(mesh);
    applyDetailTexture(mesh.material as THREE.MeshToonMaterial, 'TEX_Ground_Cytoria', 50);
    this.ground = new RegionGround(mesh, FLO.x, FLO.z, FLO_SIZE, seg, false);
  }

  // ---------------------------------------------------------------- landmarks
  private dock(x: number, z: number) {
    // round deck of planks (alternating tones) on a low stone rim
    const deck = new THREE.Group();
    const woodA = toon('#b08355'), woodB = toon('#9a7048');
    for (let i = 0; i < 13; i++) {
      const px = -6 + i;
      const len = 2 * Math.sqrt(Math.max(0, 6.6 * 6.6 - px * px));
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, len), i % 2 ? woodA : woodB);
      plank.position.set(px, 0.42, 0);
      deck.add(plank);
    }
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.9, 7.2, 0.4, 24), toon('#9a9a8a'));
    rim.position.y = 0.15;
    deck.add(rim);
    this.add(deck, x, z, 0);
    const ship = buildAirship();
    ship.rotation.y = Math.PI / 2;
    this.add(ship, x + 6, z + 4, 0);
    void propSlot(ship, 'PRP_Airship', { w: 11 });
    ship.traverse((o) => { if (o.userData.spin) this.flows.push({ obj: o, speed: -1, len: 0 }); });
    for (const a of [0.5, 2.6, 4.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 6), toon('#6a4a32'));
      this.add(post, x + Math.cos(a) * 6.6, z + Math.sin(a) * 6.6, 1.3);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glow('#c8ff9a', 1.4, 0.95));
      this.add(lamp, x + Math.cos(a) * 6.6, z + Math.sin(a) * 6.6, 2.75);
    }
  }

  /** Linnara's village: round huts with leaf roofs around a tall tree with a lookout. */
  private village(cx: number, cz: number) {
    const wall = toon('#c9a77a'), roof = toon('#6f9a3a'), trim = toon('#7a5634');
    let hn = 0;
    const hut = (x: number, z: number, r: number, rot: number) => {
      const g = new THREE.Group();
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 2.4, 12), wall);
      w.position.y = 1.2;
      const rf = new THREE.Mesh(new THREE.ConeGeometry(r * 1.45, 2.4, 12), roof);
      rf.position.y = 3.5;
      const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.08, 4, 20), trim);
      band.rotation.x = Math.PI / 2;
      band.position.y = 2.35;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), trim);
      door.position.set(0, 0.8, r + 0.02);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), glow('#ffe39a', 1.4, 0.95));
      lamp.position.set(0.8, 1.9, r + 0.2);
      g.add(w, rf, band, door, lamp);
      g.rotation.y = rot;
      addOutline(g, 0.04);
      this.add(g, x, z);
      this.col(x, z, r + 0.2);
      const variant = `BLD_FloHut${'ABCD'[hn++]}`;
      void propSlot(g, hasProp(variant) ? variant : 'BLD_FloHut', { w: r * 3, piece: (hn - 1) % 3 });
    };
    hut(cx - 13, cz - 4, 2.4, Math.PI / 2 + 0.2);
    hut(cx + 13, cz - 6, 2.6, -Math.PI / 2 - 0.2);
    hut(cx - 10, cz + 10, 2.2, Math.PI * 0.8);
    hut(cx + 11, cz + 9, 2.2, -Math.PI * 0.8);
    // central tree with a ring platform
    const trunk = new THREE.Mesh(trunkGeo(0.8, 1.2, 9), toon('#6a4a32'));
    const crown = new THREE.Group();
    if (!hasProp('BLD_FloTreehouse') && !this.crown(cx, cz - 2, this.h(cx, cz - 2) - 0.2, 20, 0.7)) {
      for (const [dx, dy, dz, s] of [[0, 13, 0, 4.2], [2.6, 11.5, 1.2, 3], [-2.4, 11.8, -1, 3.2], [0.6, 11.2, -2.6, 2.8], [-1, 12, 2.4, 2.6]]) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), this.canopy('#5cae3e', '#90957e'));
        b.position.set(dx, dy, dz);
        b.scale.y = 0.75;
        crown.add(b);
      }
    }
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 16, 1, true), trim);
    deck.position.y = 7;
    const floor = new THREE.Mesh(new THREE.RingGeometry(1.2, 3, 16), toon('#9a7148', { side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 7.1;
    const g = new THREE.Group();
    g.add(trunk, crown, deck, floor);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glow(i % 2 ? '#c8ff9a' : '#ffe39a', 1.4, 0.95));
      lan.position.set(Math.cos(a) * 3, 6.6, Math.sin(a) * 3);
      g.add(lan);
    }
    addOutline(g, 0.04);
    this.add(g, cx, cz - 2);
    this.col(cx, cz - 2, 1.5);
    void propSlot(g, 'BLD_FloTreehouse', { h: 18 });
  }

  /** The Great Xylem Tree: a huge trunk with buttress roots and a window cut into it showing the vessels. */
  private xylemTree(x: number, z: number) {
    const g = new THREE.Group();
    const bark = toon('#6b4a30');
    const hasCrown = this.crown(x, z, this.h(x, z) - 0.3, 34, 2.1);
    this.bigTrunk(g, x, z, hasCrown ? 1.7 : 2.4, 3.4, hasCrown ? 13 : 24, 6, 4.6, 5);
    if (!hasCrown) {
      for (const [dx, dy, dz, s] of [[0, 28, 0, 9], [6, 25, 3, 6], [-6, 25.5, -2, 6.5], [2, 25, -6.5, 5.5], [-3, 26, 6, 5.5]]) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), this.canopy('#3f9a3a'));
        b.position.set(dx, dy, dz);
        b.scale.y = 0.55;
        g.add(b);
      }
    }
    // cut-away window on the village-facing side: pale wood frame and vessels inside
    const face = Math.atan2(FLO_SITES.village.x - x, FLO_SITES.village.z - z);
    const win = new THREE.Group();
    win.rotation.y = face;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), toon('#e3cc9a'));
    back.position.set(0, 4.5, 3.25);
    win.add(back);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 6, 24), toon('#d9b97e'));
    frame.scale.set(0.8, 1.9, 1);
    frame.position.set(0, 4.5, 3.4);
    win.add(frame);
    // xylem: blue tubes, water rising (dots move up) · phloem: amber tubes, sugar sinking (dots move down)
    const tubeGeo = new THREE.CylinderGeometry(0.16, 0.16, 6.6, 8, 1, true);
    for (let i = 0; i < 6; i++) {
      const xylem = i < 3;
      const px = (i - 2.5) * 0.42;
      const tube = new THREE.Mesh(tubeGeo, new THREE.MeshToonMaterial({ color: xylem ? '#7ac8f0' : '#f0b45a', transparent: true, opacity: 0.55 }));
      tube.position.set(px, 4.5, 3.45);
      tube.userData.noOutline = true;
      win.add(tube);
      for (let k = 0; k < 4; k++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), glow(xylem ? '#bff0ff' : '#ffe08a', 1.6, 0.95));
        dot.position.set(px, 1.2 + k * 1.65, 3.5);
        dot.userData.base = 1.2 + k * 1.65;
        win.add(dot);
        this.flows.push({ obj: dot, speed: xylem ? 1.4 : -0.9, len: 6.6 });
      }
    }
    g.add(win);
    addOutline(g, 0.05);
    this.add(g, x, z, -0.3);
    this.col(x, z, 3.8);
    const wx = x + Math.sin(face) * 3.6, wz = z + Math.cos(face) * 3.6, wy = this.h(x, z) + 4.5;
    this.scan('OBJ_FLO_XYLEM', 'CDX_XYLEM', ['tissue'], wx - Math.cos(face) * 0.6, wy, wz + Math.sin(face) * 0.6, 3, 'ไซเลม (ท่อลำเลียงน้ำ)');
    this.scan('OBJ_FLO_PHLOEM', 'CDX_PHLOEM', ['tissue'], wx + Math.cos(face) * 0.6, wy - 0.5, wz - Math.sin(face) * 0.6, 3, 'โฟลเอ็ม (ท่อลำเลียงอาหาร)');
    // a fallen giant leaf with stomata on its underside (turned up)
    const lx = x + Math.sin(face + 0.9) * 10, lz = z + Math.cos(face + 0.9) * 10;
    const leaf = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), toon('#6cc04a'));
    blade.scale.set(2.2, 0.18, 4.2);
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 8, 6), toon('#c8e89a'));
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 0.17;
    leaf.add(blade, rib);
    for (let i = 0; i < 9; i++) {
      // stomata: pairs of guard cells around a pore
      const st = new THREE.Group();
      for (const s of [-1, 1]) {
        const gc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 10, Math.PI), toon('#9fe07a'));
        gc.rotation.set(-Math.PI / 2, 0, s > 0 ? 0 : Math.PI);
        st.add(gc);
      }
      st.position.set(((i % 3) - 1) * 0.9, 0.19, (Math.floor(i / 3) - 1) * 1.3 + (i % 2) * 0.3);
      leaf.add(st);
    }
    leaf.rotation.y = face + 0.6;
    this.add(leaf, lx, lz, 0.25);
    this.col(lx, lz, 2.2);
    this.scan('OBJ_FLO_STOMA', 'CDX_STOMATA', ['tissue'], lx, this.h(lx, lz) + 0.6, lz, 3, 'ปากใบ (Stomata)');
    // a root tip breaking out of the soil, its meristem glowing
    const rx = x + Math.sin(face - 0.9) * 9, rz = z + Math.cos(face - 0.9) * 9;
    const tip = new THREE.Group();
    const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 3, 8), bark);
    r1.rotation.z = 1.1;
    r1.position.set(-1, 0.7, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.9, 8), toon('#e8d0a0'));
    cap.rotation.z = Math.PI / 2 + 1.1;
    cap.position.set(0.55, 0.05, 0);
    const mer = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glow('#c8ff6a', 1.6, 0.9));
    mer.position.set(0.25, 0.2, 0);
    tip.add(r1, cap, mer);
    tip.rotation.y = face;
    this.add(tip, rx, rz, 0.3);
    this.scan('OBJ_FLO_MERISTEM', 'CDX_MERISTEM', ['tissue'], rx, this.h(rx, rz) + 0.6, rz, 3, 'เนื้อเยื่อเจริญปลายราก');
    // puzzle board under the window
    this.board(x + Math.sin(face) * 9, z + Math.cos(face) * 9, face, '#5fae3a');
  }

  /** Wooden notice board on a post (puzzle objects). */
  private board(x: number, z: number, face: number, accent: string) {
    const g = new THREE.Group();
    for (const s of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), toon('#6a4a32'));
      post.position.set(s, 0.9, 0);
      g.add(post);
    }
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.1), toon('#d9c08a'));
    b.position.y = 1.5;
    const leafSign = new THREE.Mesh(new THREE.CircleGeometry(0.3, 6), toon(accent));
    leafSign.position.set(0, 1.5, 0.06);
    g.add(b, leafSign);
    g.rotation.y = face;
    addOutline(g, 0.03);
    this.add(g, x, z);
    this.col(x, z, 0.8);
    void propSlot(g, 'PRP_PuzzleBoard', { h: 2.2, piece: Math.abs(Math.round(x + z)) % 3 });
  }

  /** A flower as tall as a house: sepals, petals, a ring of stamens and the pistil in the middle. */
  private giantFlower(x: number, z: number) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.4, 8), toon('#4f9a35'));
    stem.position.y = 1.7;
    g.add(stem);
    const head = new THREE.Group();
    head.position.y = 3.4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sepal = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), toon('#5fae3a'));
      sepal.scale.set(0.6, 0.15, 1.5);
      sepal.position.set(Math.cos(a) * 1, -0.25, Math.sin(a) * 1);
      sepal.rotation.y = -a + Math.PI / 2;
      sepal.rotation.x = 0.3;
      head.add(sepal);
    }
    const petal = toon('#ff9cc2');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const p = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), petal);
      p.scale.set(0.9, 0.18, 1.9);
      p.position.set(Math.cos(a) * 1.7, 0.35, Math.sin(a) * 1.7);
      p.rotation.y = -a + Math.PI / 2;
      p.rotation.x = -0.35;
      head.add(p);
    }
    // stamens (filament + anther) and the pistil (stigma, style, ovary)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 5), toon('#f4eac0'));
      fil.position.set(Math.cos(a) * 0.55, 0.9, Math.sin(a) * 0.55);
      fil.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      const anth = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 4, 6), toon('#f2b33a'));
      anth.position.set(Math.cos(a) * 0.72, 1.5, Math.sin(a) * 0.72);
      head.add(fil, anth);
    }
    const ovary = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), toon('#9fd060'));
    ovary.position.y = 0.4;
    const style = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 6), toon('#c8e07a'));
    style.position.y = 1.2;
    const stigma = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), glow('#ffef8a', 1.3, 0.95));
    stigma.position.y = 1.95;
    head.add(ovary, style, stigma);
    g.add(head);
    addOutline(g, 0.04);
    this.add(g, x, z);
    this.col(x, z, 1.2);
    void propSlot(g, 'PRP_GiantFlower', { h: 5.5 });
    this.scan('OBJ_FLO_FLOWERSCAN', 'CDX_FLOWER_PARTS', ['flower'], x, this.h(x, z) + 3.6, z, 4, 'ดอกไม้ยักษ์ (โครงสร้างดอก)');
  }

  /** Three terraces: flooded rice (C3), tall corn (C4), pineapples on dry sand (CAM), and a sundial. */
  private terraces(cx: number, cz: number) {
    const stone = toon('#a89a7a');
    const step = (x: number, z: number, w: number, d: number, hgt: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), stone);
      this.add(m, x, z, hgt / 2 - 0.4);
      m.userData.noShadow = true;
    };
    // C3: rice in water
    const rx = cx - 9, rz = cz;
    step(rx, rz, 7, 8, 0.7);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 7.4), new THREE.MeshToonMaterial({ color: '#7ac0d8', transparent: true, opacity: 0.75 }));
    water.rotation.x = -Math.PI / 2;
    this.add(water, rx, rz, 0.32);
    const riceMat = toon('#7ccf4a');
    const riceModel = hasProp('PRP_Rice');
    for (let i = 0; i < 42; i++) {
      if (riceModel && i % 2) continue; // the downloaded plant is fuller: half as many
      const tuft = new THREE.Group();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 4), riceMat);
      cone.position.y = 0.43;
      tuft.add(cone);
      this.add(tuft, rx - 2.8 + (i % 7) * 0.93, rz - 3.2 + Math.floor(i / 7) * 1.25, 0.32);
      void propSlot(tuft, 'PRP_Rice', { h: 1.1, yaw: i * 1.3, outline: 0 });
    }
    this.scan('OBJ_FLO_C3', 'CDX_C3_PLANT', ['psplant'], rx, this.h(rx, rz) + 1, rz, 4, 'ข้าว (พืช C3)');
    // C4: corn
    const kx = cx, kz = cz;
    step(kx, kz, 7, 8, 0.4);
    const stalk = toon('#6cb83a'), cob = toon('#f2c94a'), tassel = toon('#d8c07a');
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group();
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5), stalk);
      s.position.y = 1.2;
      const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), stalk);
      leaf1.scale.set(0.15, 0.08, 1.6);
      leaf1.position.set(0, 1.2, 0.5);
      leaf1.rotation.x = 0.5;
      const leaf2 = leaf1.clone();
      leaf2.position.set(0, 1.7, -0.5);
      leaf2.rotation.x = -0.5;
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 6), cob);
      ear.position.set(0.1, 1.4, 0);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 5), tassel);
      top.position.y = 2.5;
      c.add(s, leaf1, leaf2, ear, top);
      c.rotation.y = i * 1.7;
      this.add(c, kx - 2.4 + (i % 4) * 1.6, kz - 2.6 + Math.floor(i / 4) * 1.7, 0.2);
      void propSlot(c, 'PRP_Corn', { h: 2.6, outline: 0 });
    }
    this.scan('OBJ_FLO_C4', 'CDX_C4_PLANT', ['psplant'], kx, this.h(kx, kz) + 1.5, kz, 4, 'ข้าวโพด (พืช C4)');
    // CAM: pineapples and a cactus on sand
    const px = cx + 9, pz = cz;
    const pine = toon('#e0a83a'), spiky = toon('#4f8f4a');
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Group();
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), pine);
      fruit.scale.y = 1.35;
      fruit.position.y = 0.4;
      p.add(fruit);
      for (let k = 0; k < 7; k++) {
        const lf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.8, 4), spiky);
        const a = (k / 7) * Math.PI * 2;
        lf.position.set(Math.cos(a) * 0.1, 0.95, Math.sin(a) * 0.1);
        lf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        p.add(lf);
      }
      this.add(p, px - 1.8 + (i % 3) * 1.8, pz - 1.6 + Math.floor(i / 3) * 3.2, 0);
      void propSlot(p, 'PRP_Pineapple', { h: 1.2, yaw: i * 2.1, outline: 0 });
    }
    const cactus = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.6, 4, 8), spiky);
    body.position.y = 1.2;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 4, 6), spiky);
    arm.position.set(0.5, 1.5, 0);
    cactus.add(body, arm);
    this.add(cactus, px + 2.6, pz + 2.8);
    void propSlot(cactus, 'PRP_Cactus', { h: 2.6 });
    this.col(px + 2.6, pz + 2.8, 0.6);
    this.scan('OBJ_FLO_CAM', 'CDX_CAM_PLANT', ['psplant'], px, this.h(px, pz) + 1, pz, 4, 'สับปะรด (พืช CAM)');
    // sundial: a stone disc with a leaf-shaped gnomon
    const dial = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 16), stone);
    disc.position.y = 0.3;
    const gn = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 3), toon('#5fae3a'));
    gn.position.y = 1.2;
    gn.rotation.z = 0.4;
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glow('#ffe08a', 1.6, 0.95));
    sun.position.set(0, 2.3, 0);
    dial.add(disc, gn, sun);
    addOutline(dial, 0.03);
    this.add(dial, cx, cz + 8);
    void propSlot(dial, 'PRP_Sundial', { h: 2.2 });
    this.col(cx, cz + 8, 1.6);
  }

  /** Seedling nursery: planters of sunflower seedlings at different growth and a table of hormone vials. */
  private nursery(cx: number, cz: number) {
    for (let k = 0; k < 3; k++) {
      const bx = cx - 6 + k * 6, bz = cz + 3;
      const box = planterBox(4.2, 1.4, String.fromCharCode(65 + k));
      this.add(box, bx, bz);
      this.col(bx, bz, 1.2);
      for (let i = 0; i < 3; i++) {
        const p = new ExperimentPlant(0.6 + k * 0.35);
        p.group.position.set(-1.3 + i * 1.3, 0.38, 0);
        p.group.userData.keep = true; // stays when a planter model replaces the box
        p.setTarget([0.15, 0.6, 1][k], true);
        box.add(p.group);
        this.plants.push(p);
      }
      void propSlot(box, 'PRP_Planter', { w: 4.4 });
    }
    // table with vials: auxin, gibberellin, cytokinin, ethylene, abscisic acid
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.2), toon('#9a7148'));
    top.position.y = 1;
    table.add(top);
    for (const sx of [-1.4, 1.4]) for (const sz of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), toon('#6a4a32'));
      leg.position.set(sx, 0.5, sz);
      table.add(leg);
    }
    ['#ffd35a', '#7ae07a', '#6aa8ff', '#ff8a5a', '#c58bff'].forEach((c, i) => {
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.45, 8), new THREE.MeshToonMaterial({ color: c, transparent: true, opacity: 0.8, emissive: new THREE.Color(c), emissiveIntensity: 0.35 }));
      vial.position.set(-1.1 + i * 0.55, 1.29, 0);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 6), toon('#b08a5a'));
      cork.position.set(-1.1 + i * 0.55, 1.56, 0);
      table.add(vial, cork);
    });
    addOutline(table, 0.03);
    this.add(table, cx, cz - 4);
    void propSlot(table, 'PRP_PotionTable', { w: 3.4, piece: 4 }); // the alchemy table out of the wizard-props pack
    this.col(cx, cz - 4, 1.6);
  }

  /** The Mother Tree: the heart of the forest, a vast trunk and crown over a clearing (boss arena). */
  private motherTree(x: number, z: number) {
    const g = new THREE.Group();
    const tz = z - 14;
    const hasCrown = this.crown(x, tz, this.h(x, tz) - 0.4, 52, 0.4);
    this.bigTrunk(g, x, tz, hasCrown ? 2.4 : 3.6, 5, hasCrown ? 18 : 34, 8, 7, 7);
    if (!hasCrown) {
      for (const [dx, dy, dz, s] of [[0, 38, 0, 14], [10, 33, 4, 8], [-10, 33.5, -3, 9], [3, 33, -10, 8], [-4, 34, 10, 8], [8, 36, -7, 7]]) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), this.canopy('#4fb03a', '#8a8f7c'));
        b.position.set(dx, dy, dz);
        b.scale.y = 0.5;
        g.add(b);
      }
    }
    // glowing heartwood knot
    const knot = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), glow('#b8ff7a', 1.5, 0.9));
    knot.position.set(0, 6, 0);
    knot.scale.set(0.9, 1.3, 0.4);
    knot.position.z = 4.6;
    g.add(knot);
    addOutline(g, 0.06);
    // the tree stands at the north edge of the clearing so the arena stays open
    this.add(g, x, z - 14, -0.4);
    this.col(x, z - 14, 5.2);
    this.scan('OBJ_FLO_MOTHER', 'CDX_MOTHER_TREE', ['mother'], x, this.h(x, z - 14) + 6, z - 10, 6, 'ต้นไม้มารดาแห่งฟลอแรนทิส');
    // sickly spores drifting around the clearing until the forest is restored
    const n = 120, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 24;
      p[i * 3] = x + Math.cos(a) * r; p[i * 3 + 1] = 1 + Math.random() * 10; p[i * 3 + 2] = z + Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.spores = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc8a0ff, size: 0.35, transparent: true, opacity: 0.7, depthWrite: false, map: leafTexture() }));
    this.spores.userData.noShadow = true;
    this.root.add(this.spores);
  }

  // ---------------------------------------------------------------- forest
  private forest() {
    let s = 41;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const clear = (x: number, z: number, pad: number) =>
      Object.values(FLO_SITES).every((p) => Math.hypot(x - p.x, z - p.z) > (p === FLO_SITES.heart ? 34 : 22) + pad) && pathDist(x, z) > 4 + pad;
    if (!hasFlora('NAT_TreesPainted')) return this.fallbackTrees(rand, clear);
    const sets: Record<string, FloraSet> = {
      trees: { ...PAINTED_TREES, foliage: ['#2f8a36', '#a6d24a'] }, // the autumn pack re-leafed in jungle greens
      big: { file: 'NAT_TreePainted', sway: 0.02, far: 320, lodDist: 45, foliage: ['#2a7a34', '#8cc840'] },
      birch: { file: 'NAT_Birch', split: true, sway: 0.045, far: 300 },
      mushroom: { file: 'NAT_MushroomTree', sway: 0.01, far: 300 },
      bush: { file: 'NAT_Bush', sway: 0.06, far: 110 },
      glow: { file: 'NAT_GlowPlants', split: true, sway: 0.06, far: 90 },
      fallen: { file: 'NAT_FallenTree', far: 140 },
      blooms: { file: 'NAT_Flowers', split: true, sway: 0.1, far: 80, lodDist: 35 },
    };
    for (const k of Object.keys(sets)) if (!hasFlora(sets[k].file)) delete sets[k];
    const spots: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(sets).map((k) => [k, []]));
    const at = (k: string, x: number, z: number, scale: number, sink = 0.2) => { if (spots[k]) spots[k].push({ x, y: this.h(x, z) - sink, z, rot: rand() * Math.PI * 2, scale }); };
    // rainforest: tall trees in clumps, an understorey of bushes and glowing plants
    let n = 0;
    for (let i = 0; i < 900 && n < 170; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 140 || !clear(x, z, 0)) continue;
      if (fbm(x * 0.03 + 7, z * 0.03 + 1, 2) < 0.42) continue; // clumps and glades
      const roll = rand();
      const k = roll < 0.1 ? 'mushroom' : roll < 0.2 ? 'birch' : roll < 0.42 ? 'big' : 'trees';
      at(k, x, z, k === 'mushroom' ? 6 + rand() * 3 : k === 'birch' ? 10 + rand() * 3 : k === 'big' ? 14 + rand() * 6 : 11 + rand() * 7);
      this.col(x, z, 0.8);
      n++;
      if (rand() < 0.6) { const a = rand() * 6.28, d = 2.5 + rand() * 2; at(rand() < 0.6 ? 'bush' : 'glow', x + Math.cos(a) * d, z + Math.sin(a) * d, 1 + rand() * 0.8, 0.05); }
    }
    for (let i = 0; i < 14; i++) {
      const x = (rand() - 0.5) * 260, z = (rand() - 0.5) * 260;
      if (Math.hypot(x, z) < 135 && clear(x, z, 2)) { at('fallen', x, z, 1.4 + rand() * 0.6, 0.1); this.col(x, z, 1.2); }
    }
    // flower meadow around the giant flower
    const b = FLO_SITES.bloom;
    for (let i = 0; i < 60; i++) {
      const a = rand() * Math.PI * 2, r = 4 + rand() * 14;
      at('blooms', b.x + Math.cos(a) * r, b.z + Math.sin(a) * r, 0.22 + rand() * 0.18, 0.02);
    }
    for (const k of Object.keys(sets)) if (spots[k].length) this.root.add(plantFlora(sets[k], spots[k], rand));
  }

  /** Simple low-poly jungle trees when the downloaded nature models are missing. */
  private fallbackTrees(rand: () => number, clear: (x: number, z: number, pad: number) => boolean) {
    const trunk = toon('#6a4a32'), leaves = [toon('#3f9a3a'), toon('#2f7f3a'), toon('#5cae3e')];
    let n = 0;
    for (let i = 0; i < 600 && n < 110; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 140 || !clear(x, z, 0)) continue;
      const t = new THREE.Group();
      const hgt = 7 + rand() * 6;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, hgt, 6), trunk);
      tr.position.y = hgt / 2;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 + rand(), 0), leaves[n % 3]);
      crown.position.y = hgt + 0.8;
      crown.scale.y = 0.6;
      t.add(tr, crown);
      this.add(t, x, z);
      this.col(x, z, 0.7);
      n++;
    }
  }

  // ---------------------------------------------------------------- atmosphere
  /** Crossed planes of soft light falling through gaps in the canopy. */
  private buildShafts() {
    this.shaftMat = new THREE.MeshBasicMaterial({
      map: shaftTexture(), color: 0xfff2c0, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
    });
    const geo = new THREE.PlaneGeometry(3.4, 22);
    const spots = [[-30, 40], [25, 48], [-50, -20], [40, -10], [-20, -40], [30, -80], [-80, 50], [95, 40], [-100, -40], [10, 10], [-45, 85], [55, 85]];
    for (const [x, z] of spots) {
      const g = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(geo, this.shaftMat);
        m.rotation.y = k * Math.PI / 2 + x * 0.1;
        m.userData.noShadow = true;
        m.userData.noOutline = true;
        g.add(m);
      }
      g.rotation.z = 0.28; // slanted with the afternoon sun
      g.position.set(x, this.h(x, z) + 9, z);
      g.renderOrder = 2;
      this.root.add(g);
      this.shafts.push(g);
    }
  }

  /** Leaves drifting down in a box around the player. */
  private buildLeaves() {
    const n = 140;
    this.leafBase = new Float32Array(n * 3);
    const p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    const cols = [new THREE.Color('#8fd060'), new THREE.Color('#c8e070'), new THREE.Color('#f0c050')];
    for (let i = 0; i < n; i++) {
      this.leafBase[i * 3] = (Math.random() - 0.5) * 50;
      this.leafBase[i * 3 + 1] = Math.random() * 16;
      this.leafBase[i * 3 + 2] = (Math.random() - 0.5) * 50;
      const col = cols[i % 3];
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.leaves = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, map: leafTexture(), vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false }));
    this.leaves.frustumCulled = false;
    this.leaves.userData.noShadow = true;
    this.root.add(this.leaves);
  }

  // ---------------------------------------------------------------- state
  /** Restored = the canopies regain their colour and the sick spores clear (animated unless `instant`). */
  setRestored(on: boolean, instant = false) {
    this.restored = on;
    if (instant) { this.restoreK = on ? 1 : 0; this.applyRestore(this.restoreK); }
  }

  private applyRestore(k: number) {
    for (const c of this.canopies) c.mat.color.copy(c.sick).lerp(c.healthy, k);
    for (const c of this.crowns) { c.healthy.visible = k >= 0.5; c.sick.visible = k < 0.5; }
    if (this.spores) (this.spores.material as THREE.PointsMaterial).opacity = 0.7 * (1 - k);
  }

  /** `day` 0..1 (1 = full daylight) dims the light shafts at night. */
  update(dt: number, playerPos: THREE.Vector3, day = 1) {
    this.t += dt;
    const target = this.restored ? 1 : 0;
    if (this.restoreK !== target) {
      this.restoreK += Math.sign(target - this.restoreK) * Math.min(Math.abs(target - this.restoreK), dt * 0.35);
      this.applyRestore(this.restoreK);
    }
    for (const f of this.flows) {
      if (!f.len) { f.obj.rotation.x += dt * 6; continue; }
      const b = f.obj.userData.base as number;
      let y = f.obj.position.y + f.speed * dt;
      if (y > b + 1.65) y -= 1.65; else if (y < b - 1.65) y += 1.65;
      f.obj.position.y = y;
    }
    for (const p of this.plants) p.update(dt);
    const near = inFlorantis(playerPos.x, playerPos.z);
    this.shaftMat.opacity = (0.14 + Math.sin(this.t * 0.5) * 0.04) * day;
    for (const s of this.shafts) s.visible = day > 0.05;
    if (this.spores) {
      this.spores.visible = this.restoreK < 0.99;
      this.spores.rotation.y = Math.sin(this.t * 0.05) * 0.02;
    }
    this.leaves.visible = near;
    if (near) {
      const lx = playerPos.x - FLO.x, lz = playerPos.z - FLO.z;
      const p = this.leaves.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = this.leafBase[i * 3 + 1] - dt * (0.6 + (i % 4) * 0.15);
        if (y < 0) y += 16;
        this.leafBase[i * 3 + 1] = y;
        const sway = Math.sin(this.t * 1.3 + i) * 0.8;
        // world-anchored, wrapped around the player (run through them rather than dragging them along)
        const wx = this.leafBase[i * 3] + sway, wz = this.leafBase[i * 3 + 2] + Math.cos(this.t + i) * 0.5;
        const x = lx + ((((wx - lx + 25) % 50) + 50) % 50) - 25;
        const z = lz + ((((wz - lz + 25) % 50) + 50) % 50) - 25;
        p.setXYZ(i, x, playerPos.y - 2 + y, z);
      }
      p.needsUpdate = true;
    }
  }
}
