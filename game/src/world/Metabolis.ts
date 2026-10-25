import * as THREE from 'three';
import { hasFlora, plantFlora, type FloraSet, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { buildAirship } from './Genovia';
import { hasProp, propSlot } from '../models/PropModels';

/**
 * เมแทบอลิส — volcanic forge city of Pyro / energy (chapter 5). Its own zone south-east, reached by airship.
 * The city runs on furnaces that work like mitochondria: a digestive tunnel feeds them, giant bellows-lungs blow
 * air in, a glycolysis conveyor splits glucose, the Krebs wheel turns, and the Great Mitochondrion Furnace at the
 * foot of the volcano makes the city's energy. Until the chapter's boss is beaten the furnaces are cold (grey, no
 * glow, turbines still); afterwards they glow and smoke again. Depth: embers rising, chimney smoke, lava rivers.
 */
export const MET = { x: 1800, z: 1800 };
export const MET_RADIUS = 160;
export const MET_SIZE = 420;

export function inMetabolis(x: number, z: number) {
  return Math.hypot(x - MET.x, z - MET.z) < MET_SIZE / 2 + 40;
}

/** Points of interest in local coordinates (-z = north). Mirrors locations.json. */
export const MET_SITES = {
  dock: { x: 0, z: 122 },
  town: { x: 0, z: 70 },
  digest: { x: -72, z: 10 },
  lungs: { x: 72, z: 18 },
  glyco: { x: -64, z: -62 },
  krebs: { x: 64, z: -60 },
  heart: { x: 0, z: -100 },
};

const FLATS: { x: number; z: number; r: number; h: number }[] = [
  { ...MET_SITES.dock, r: 12, h: 1 },
  { ...MET_SITES.town, r: 24, h: 1 },
  { ...MET_SITES.digest, r: 22, h: 1.2 },
  { ...MET_SITES.lungs, r: 18, h: 1.5 },
  { ...MET_SITES.glyco, r: 16, h: 2 },
  { ...MET_SITES.krebs, r: 16, h: 2 },
  { ...MET_SITES.heart, r: 28, h: 2 },
];

/** Lava rivers (local polylines) — kept clear of the sites and paths. */
const LAVA: [number, number][][] = [
  [[-150, -140], [-104, -96], [-118, -30], [-112, 30], [-150, 70]],
  [[150, -130], [112, -98], [118, -20], [116, 60], [160, 90]],
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
  return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
}

function lavaDist(x: number, z: number) {
  let best = Infinity;
  for (const r of LAVA) for (let i = 0; i < r.length - 1; i++) best = Math.min(best, segDist(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
  return best;
}

/** Height in local coordinates: rough basalt ground, a ring of dark peaks and a big volcano to the north. */
export function metHeightLocal(x: number, z: number): number {
  let h = (fbm(x * 0.016 + 31, z * 0.016 + 77) - 0.5) * 10 + (fbm(x * 0.07 + 2, z * 0.07, 2) - 0.5) * 1.4;
  const r = Math.hypot(x, z);
  h += smoothstep(158, 205, r) * 38 * (0.7 + 0.6 * fbm(x * 0.025 + 5, z * 0.025 + 1, 2));
  // the volcano: a tall cone with a crater, behind the Great Furnace
  const dv = Math.hypot(x, z + 200);
  h += Math.max(0, 85 - dv * 0.95) - Math.max(0, 14 - dv) * 1.6;
  // lava channels are carved a little into the ground
  const dl = lavaDist(x, z);
  if (dl < 7) h -= (1 - smoothstep(2.5, 7, dl)) * 1.3;
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = h + (f.h - h) * (1 - smoothstep(f.r, f.r * 1.8, d));
  }
  return h;
}

/** Distance from (x, z) to the paved roads (town hub → every site). */
function pathDist(x: number, z: number) {
  const hub = MET_SITES.town;
  let best = segDist(x, z, MET_SITES.dock.x, MET_SITES.dock.z, hub.x, hub.z);
  for (const s of [MET_SITES.digest, MET_SITES.lungs, MET_SITES.heart]) best = Math.min(best, segDist(x, z, hub.x, hub.z, s.x, s.z));
  best = Math.min(best, segDist(x, z, MET_SITES.digest.x, MET_SITES.digest.z, MET_SITES.glyco.x, MET_SITES.glyco.z));
  best = Math.min(best, segDist(x, z, MET_SITES.lungs.x, MET_SITES.lungs.z, MET_SITES.krebs.x, MET_SITES.krebs.z));
  return best;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** Tileable rock detail (multiplied over the vertex colours): mottled light/dark patches and thin cracks. */
function rockTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8e4e4';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 2 + Math.random() * 10, v = 200 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v - 6},${v - 8},0.3)`;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.7, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
  }
  g.strokeStyle = 'rgba(90,70,66,0.28)';
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * 256, y = Math.random() * 256;
    g.lineWidth = 0.5 + Math.random() * 0.7;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 30; y += (Math.random() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(110, 110);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Tileable lava: dark crust cracks over bright molten orange. */
function lavaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ff8a1a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 128, y = Math.random() * 128, r = 3 + Math.random() * 10;
    g.fillStyle = Math.random() < 0.55 ? 'rgba(255,214,90,0.8)' : 'rgba(150,30,10,0.55)';
    for (const [ox, oy] of [[0, 0], [128, 0], [-128, 0], [0, 128], [0, -128]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Smoke { pts: THREE.Points; base: Float32Array; x: number; z: number; y: number }

export class Metabolis {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  /** furnace glow materials: dull while the city is cold, glowing once restored */
  private glows: { mat: THREE.MeshToonMaterial; hot: number }[] = [];
  private spin: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number; needsHeat: boolean }[] = [];
  private belts: { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; split?: THREE.Object3D }[] = [];
  private lungs: { obj: THREE.Object3D; phase: number }[] = [];
  private diaphragm: THREE.Object3D | null = null;
  /** downloaded lungs model (breathes by scaling) */
  private lungProp: THREE.Object3D | null = null;
  private lavaTex = lavaTexture();
  private smokes: Smoke[] = [];
  private embers!: THREE.Points;
  private emberBase = new Float32Array(0);
  private restored = false;
  private heat = 0;
  private t = 0;

  constructor() {
    this.root.position.set(MET.x, 0, MET.z);
    this.buildTerrain();
    this.buildLava();
    const S = MET_SITES;
    this.dock(S.dock.x, S.dock.z);
    this.town(S.town.x, S.town.z);
    this.digestTunnel(S.digest.x, S.digest.z);
    this.lungHall(S.lungs.x, S.lungs.z);
    this.conveyor(S.glyco.x, S.glyco.z);
    this.krebsWheel(S.krebs.x, S.krebs.z);
    this.greatFurnace(S.heart.x, S.heart.z);
    this.scenery();
    this.buildEmbers();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
    this.applyHeat(0);
  }

  private h(x: number, z: number) { return metHeightLocal(x, z); }
  private col(x: number, z: number, r: number, id?: string) { this.colliders.push({ x: MET.x + x, z: MET.z + z, r, id }); }
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
  /** A material that glows `color` when the furnaces run (and is a dull grey when they are cold). */
  private hot(color: string, strength = 1.2) {
    const mat = new THREE.MeshToonMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0 });
    this.glows.push({ mat, hot: strength });
    return mat;
  }
  /** Puzzle board: an iron plaque on two posts. */
  private board(x: number, z: number, face: number) {
    const g = new THREE.Group();
    for (const s of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.8, 0.14), toon('#3a3438'));
      post.position.set(s, 0.9, 0);
      g.add(post);
    }
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.12), toon('#6a5a50'));
    b.position.y = 1.5;
    const gem = new THREE.Mesh(new THREE.CircleGeometry(0.28, 6), this.hot('#ff8a3a', 1.4));
    gem.position.set(0, 1.5, 0.07);
    g.add(b, gem);
    g.rotation.y = face;
    addOutline(g, 0.03);
    this.add(g, x, z);
    this.col(x, z, 0.8);
    void propSlot(g, 'PRP_PuzzleBoard', { h: 2.2, piece: Math.abs(Math.round(x + z)) % 3 });
  }

  // ---------------------------------------------------------------- terrain + lava
  private buildTerrain() {
    const seg = 150;
    const geo = new THREE.PlaneGeometry(MET_SIZE, MET_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    // compared with Natlan screenshots: volcanic, but sunlit and warm rather than near-black
    const basalt = new THREE.Color('#6e605c'), ash = new THREE.Color('#8e7f76'), ochre = new THREE.Color('#ad7a4c');
    const rock = new THREE.Color('#5e5054'), crust = new THREE.Color('#43302a'), road = new THREE.Color('#b8a48c'), high = new THREE.Color('#6f6374');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.h(x, z);
      pos.setY(i, y);
      const e = 0.8;
      const nx = this.h(x + e, z) - this.h(x - e, z), nz = this.h(x, z + e) - this.h(x, z - e);
      const slope = 1 - 2 * e / Math.hypot(nx, 2 * e, nz);
      tmp.copy(basalt).lerp(ash, smoothstep(0.35, 0.7, fbm(x * 0.03 + 4, z * 0.03, 3)));
      tmp.lerp(ochre, smoothstep(0.55, 0.8, fbm(x * 0.06 + 11, z * 0.06 + 3, 2)) * 0.6);
      tmp.lerp(rock, smoothstep(0.2, 0.4, slope));
      tmp.lerp(high, smoothstep(10, 40, y) * 0.6); // the peaks stay dark basalt
      if (y > 60) tmp.lerp(crust, smoothstep(60, 80, y) * 0.8); // the volcano's scorched cone
      const dl = lavaDist(x, z);
      if (dl < 6) tmp.lerp(crust, 1 - smoothstep(2.5, 6, dl)); // scorched banks
      const pd = pathDist(x, z);
      if (pd < 2.8) tmp.lerp(road, 0.8 * (1 - smoothstep(1.6, 2.8, pd)));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), map: rockTexture() }));
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.root.add(mesh);
  }

  /** Glowing ribbons of molten rock along the lava polylines, plus the volcano's crater pool. */
  private buildLava() {
    const mat = new THREE.MeshBasicMaterial({ map: this.lavaTex, toneMapped: false, fog: true });
    for (const r of LAVA) {
      const curve = new THREE.CatmullRomCurve3(r.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const n = 120, w = 2.6;
      const p = new Float32Array((n + 1) * 2 * 3), uv = new Float32Array((n + 1) * 2 * 2), idx: number[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, c = curve.getPointAt(t), d = curve.getTangentAt(t);
        const sx = -d.z * w, sz = d.x * w;
        for (const [k, s] of [[0, -1], [1, 1]] as const) {
          const x = c.x + sx * s, z = c.z + sz * s;
          p.set([x, this.h(x, z) + 0.35, z], (i * 2 + k) * 3);
          uv.set([k, t * curve.getLength() / 8], (i * 2 + k) * 2);
        }
        if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, mat);
      m.userData.noShadow = true;
      m.userData.noOutline = true;
      this.root.add(m);
    }
    const crater = new THREE.Mesh(new THREE.CircleGeometry(13, 24), mat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(0, this.h(0, -200) + 1.5, -200);
    crater.userData.noShadow = true;
    this.root.add(crater);
    // the volcano's plume
    this.smoke(0, -200, this.h(0, -200) + 3, 40, 26, 0x6a6064, 9);
  }

  /** A column of soft smoke puffs rising from (x, y, z). */
  private smoke(x: number, z: number, y: number, n = 14, height = 8, color = 0x9a9094, size = 3) {
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { base[i * 3] = Math.random() * 6.28; base[i * 3 + 1] = i / n; base[i * 3 + 2] = 0.5 + Math.random(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: dotTexture(), transparent: true, opacity: 0.35, depthWrite: false, sizeAttenuation: true }));
    pts.userData = { noShadow: true, height, base: new THREE.Color(color) };
    pts.frustumCulled = false;
    this.root.add(pts);
    this.smokes.push({ pts, base, x, z, y });
  }

  // ---------------------------------------------------------------- landmarks
  private dock(x: number, z: number) {
    const deck = new THREE.Group();
    const plateA = toon('#7a7078'), plateB = toon('#6a6068');
    for (let i = 0; i < 13; i++) {
      const px = -6 + i;
      const len = 2 * Math.sqrt(Math.max(0, 6.6 * 6.6 - px * px));
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.24, len), i % 2 ? plateA : plateB);
      plate.position.set(px, 0.42, 0);
      deck.add(plate);
    }
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.9, 7.2, 0.4, 24), toon('#4a4048'));
    rim.position.y = 0.15;
    deck.add(rim);
    this.add(deck, x, z);
    const ship = buildAirship();
    ship.rotation.y = Math.PI / 2;
    this.add(ship, x + 6, z + 4);
    void propSlot(ship, 'PRP_Airship', { w: 11 });
    ship.traverse((o) => { if (o.userData.spin) this.spin.push({ obj: o, axis: 'x', speed: 6, needsHeat: false }); });
    for (const a of [0.5, 2.6, 4.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 6), toon('#3a3438'));
      this.add(post, x + Math.cos(a) * 6.6, z + Math.sin(a) * 6.6, 1.3);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glow('#ffb060', 1.4, 0.95));
      this.add(lamp, x + Math.cos(a) * 6.6, z + Math.sin(a) * 6.6, 2.75);
    }
  }

  /** Forge town: brick houses with smoking chimneys around a plaza, Krebion's forge hall to the north. */
  private town(cx: number, cz: number) {
    const brick = toon('#9a5a44'), brickD = toon('#7a4434'), roof = toon('#4a4048'), trim = toon('#c8a070');
    const bricks = [brick, toon('#8a6a58'), toon('#a8704e')];
    const pipeMat = toon('#7a7078');
    let hn = 0;
    const house = (x: number, z: number, w: number, d: number, rot: number) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), bricks[hn++ % 3]);
      body.position.y = 1.6;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.75, 1.8, 4, 1), roof);
      top.rotation.y = Math.PI / 4;
      top.scale.z = d / w;
      top.position.y = 4.1;
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.25, d + 0.1), brickD);
      band.position.y = 3.15;
      const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.1), toon('#5a3a26'));
      door.position.set(0, 0.9, d / 2 + 0.02);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.06), this.hot('#ffb060', 0.9));
      win.position.set(w * 0.28, 2, d / 2 + 0.03);
      const win2 = win.clone();
      win2.position.x = -w * 0.28;
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.2), brickD);
      sill.position.set(w * 0.28, 1.66, d / 2 + 0.08);
      const sill2 = sill.clone();
      sill2.position.x = -w * 0.28;
      // a pipe running down the side wall with an elbow at the top
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 8), pipeMat);
      pipe.position.set(w / 2 + 0.15, 1.7, d * 0.25);
      const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.12, 6, 10, Math.PI / 2), pipeMat);
      elbow.position.set(w / 2 - 0.1, 3.4, d * 0.25);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), this.hot('#ffc070', 1.4));
      lamp.position.set(0.8, 2.3, d / 2 + 0.2);
      g.add(win2, sill, sill2, pipe, elbow, lamp);
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2, 0.6), brickD);
      chim.position.set(-w * 0.28, 4.6, -d * 0.2);
      g.add(body, top, band, door, win, chim);
      g.rotation.y = rot;
      addOutline(g, 0.04);
      this.add(g, x, z);
      this.col(x, z, Math.max(w, d) * 0.6);
      const variant = `BLD_MetHouse${'ABCD'[hn - 1]}`;
      // the village pack holds a market, a carrot farm, barracks, a forge house and a ground disc: use the town-like ones
      void propSlot(g, hasProp(variant) ? variant : 'BLD_MetHouse', { w: Math.max(w, d) * 1.5, piece: [3, 2, 0, 3][(hn - 1) % 4] });
      const c = new THREE.Vector3(-w * 0.28, 5.6, -d * 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      this.smoke(x + c.x, z + c.z, this.h(x, z) + c.y, 10, 7);
      void trim;
    };
    house(cx - 15, cz + 2, 5, 4, Math.PI / 2);
    house(cx + 15, cz, 5, 4.5, -Math.PI / 2);
    house(cx - 13, cz + 15, 4.5, 4, Math.PI * 0.8);
    house(cx + 13, cz + 15, 4.5, 4, -Math.PI * 0.8);
    // forge hall: wide building with a glowing furnace mouth, a big chimney and an anvil out front
    const hall = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 8), brick);
    body.position.y = 3;
    const roofM = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 9, 3, 4, 1), roof);
    roofM.rotation.y = Math.PI / 4;
    roofM.scale.z = 0.6;
    roofM.position.y = 7.5;
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.8, 16, 0, Math.PI), this.hot('#ff6a1a', 1.6));
    mouth.position.set(0, 0.05, 4.02);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.3, 6, 16, Math.PI), trim);
    arch.position.set(0, 0.05, 4.05);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 7, 10), brickD);
    stack.position.set(4.5, 9, -1.5);
    hall.add(body, roofM, mouth, arch, stack);
    addOutline(hall, 0.05);
    this.add(hall, cx, cz - 16);
    void propSlot(hall, 'BLD_Forge', { w: 15 });
    this.col(cx - 4, cz - 16, 4); this.col(cx + 4, cz - 16, 4);
    this.smoke(cx + 4.5, cz - 17.5, this.h(cx, cz - 16) + 12.5, 16, 12, 0x8a8084, 4.5);
    const anvil = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.5), toon('#3a3438'));
    base.position.y = 0.4;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.55), toon('#2e2a30'));
    top.position.y = 0.95;
    anvil.add(base, top);
    this.add(anvil, cx + 4, cz - 8);
    void propSlot(anvil, 'PRP_Anvil', { w: 1.4 });
    this.col(cx + 4, cz - 8, 0.8);
    // plaza brazier
    const braz = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.6, 0.8, 12), toon('#3a3438'));
    bowl.position.y = 1.2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1, 8), toon('#3a3438'));
    leg.position.y = 0.5;
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 8), this.hot('#ff8a2a', 1.8));
    fire.position.y = 2.1;
    fire.userData.keep = true;
    braz.add(bowl, leg, fire);
    this.add(braz, cx, cz + 4);
    void propSlot(braz, 'PRP_Brazier', { h: 1.8, piece: 0 });
    this.col(cx, cz + 4, 1.3);
  }

  /** Digestive tunnel: a stone mouth gate, the stomach dome with an acid pool, the coiled small intestine with villi, the liver. */
  private digestTunnel(cx: number, cz: number) {
    const flesh = toon('#d88a8a'), fleshD = toon('#b86a70'), stone = toon('#7a6e6a');
    // mouth gate (facing the road from the town)
    const face = Math.atan2(MET_SITES.town.x - cx, MET_SITES.town.z - cz);
    const gate = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.9, 8, 18, Math.PI), stone);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.35, 6, 18, Math.PI), flesh);
    lip.position.z = 0.6;
    gate.add(arch, lip);
    for (let i = 0; i < 6; i++) {
      const a = 0.35 + (i / 5) * (Math.PI - 0.7);
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 5), toon('#f4efe2'));
      tooth.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.3 - 0.3, 0.7);
      tooth.rotation.z = a + Math.PI / 2;
      gate.add(tooth);
    }
    gate.rotation.y = face;
    addOutline(gate, 0.04);
    const gx = cx + Math.sin(face) * 14, gz = cz + Math.cos(face) * 14;
    this.add(gate, gx, gz);
    void propSlot(gate, 'PRP_MouthGate', { w: 8.5 });
    this.col(gx + Math.cos(face) * 3.2, gz - Math.sin(face) * 3.2, 1); this.col(gx - Math.cos(face) * 3.2, gz + Math.sin(face) * 3.2, 1);
    this.scan('OBJ_MET_MOUTH', 'CDX_DIGEST_MOUTH', ['digest'], gx, this.h(gx, gz) + 2.5, gz, 3, 'ปาก (ย่อยเชิงกลและแป้ง)');
    // stomach: a half dome cut open, green acid pool inside
    const sx = cx - 8, sz = cz + 4;
    const stomach = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 12, 0, Math.PI * 1.4, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: '#d88a8a', side: THREE.DoubleSide }));
    dome.rotation.y = face + 0.9;
    const folds = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.3, 6, 24), fleshD);
    folds.rotation.x = Math.PI / 2;
    folds.position.y = 0.4;
    const acid = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), glow('#b8f05a', 1.1, 0.85));
    acid.rotation.x = -Math.PI / 2;
    acid.position.y = 0.25;
    stomach.add(dome, folds, acid);
    addOutline(stomach, 0.04);
    this.add(stomach, sx, sz);
    void propSlot(stomach, 'PRP_Stomach', { h: 6 });
    this.col(sx, sz, 4.6);
    this.scan('OBJ_MET_STOMACH', 'CDX_DIGEST_STOMACH', ['digest'], sx, this.h(sx, sz) + 2, sz, 4, 'กระเพาะอาหาร (เพปซิน + กรด)');
    // small intestine: a coil of tube rings with finger-like villi inside
    const ix = cx + 6, iz = cz - 8;
    const coil = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2 - k * 0.2, 0.75, 10, 28), flesh);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.8 + k * 1.3;
      coil.add(ring);
    }
    const villiMat = toon('#f0a8a8');
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 6), villiMat);
      v.position.set(Math.cos(a) * 2.5, 4.3, Math.sin(a) * 2.5);
      v.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      coil.add(v);
    }
    addOutline(coil, 0.04);
    this.add(coil, ix, iz);
    void propSlot(coil, 'PRP_Intestine', { w: 7 });
    this.col(ix, iz, 3.8);
    this.scan('OBJ_MET_VILLI', 'CDX_DIGEST_VILLI', ['digest'], ix, this.h(ix, iz) + 4, iz, 4, 'ลำไส้เล็ก (วิลลัส)');
    // liver: big lobed red-brown rock with a green gall bladder and a duct toward the intestine
    const lx = cx - 12, lz = cz - 10;
    const liver = new THREE.Group();
    for (const [dx, dy, dz, s] of [[0, 1.6, 0, 2.6], [2.2, 1.2, 0.6, 1.9], [-2, 1.1, -0.4, 1.7]]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10), toon('#8a3a30'));
      lobe.position.set(dx, dy, dz);
      lobe.scale.y = 0.6;
      liver.add(lobe);
    }
    const gb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), toon('#6ab04a'));
    gb.position.set(1, 0.5, 2);
    gb.scale.set(0.8, 1, 1.3);
    liver.add(gb);
    addOutline(liver, 0.04);
    this.add(liver, lx, lz);
    void propSlot(liver, 'PRP_Liver', { w: 6 });
    this.col(lx, lz, 3);
    this.scan('OBJ_MET_LIVER', 'CDX_DIGEST_LIVER', ['digest'], lx, this.h(lx, lz) + 1.8, lz, 3.5, 'ตับและถุงน้ำดี');
    this.board(cx + 2, cz + 16, face);
  }

  /** Bellows hall: two lungs on a frame that breathe, a pipe trachea splitting into bronchi, alveoli clusters, a diaphragm. */
  private lungHall(cx: number, cz: number) {
    const iron = toon('#4a4048'), pink = toon('#f0a0a8');
    const face = Math.atan2(MET_SITES.town.x - cx, MET_SITES.town.z - cz);
    const g = new THREE.Group();
    g.rotation.y = face;
    // frame
    for (const s of [-4.5, 4.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), iron);
      post.position.set(s, 4.5, -1);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.5, 0.5), iron);
    beam.position.set(0, 9, -1);
    g.add(beam);
    // trachea with cartilage rings → two bronchi
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.4, 10), toon('#e8c8c0'));
    tr.position.set(0, 7.3, -1);
    g.add(tr);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 14), toon('#f4efe2'));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 6 + i * 0.6, -1);
      g.add(ring);
    }
    for (const s of [-1, 1]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 2.4, 8), toon('#e8c8c0'));
      br.position.set(s * 1, 5.1, -1);
      br.rotation.z = s * 0.9;
      g.add(br);
      const lung = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), pink);
      lung.scale.set(0.85, 1.25, 0.8);
      lung.position.set(s * 2.6, 3.6, -1);
      g.add(lung);
      this.lungs.push({ obj: lung, phase: 0 });
    }
    // diaphragm dome under the lungs
    const dia = new THREE.Mesh(new THREE.SphereGeometry(4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), new THREE.MeshToonMaterial({ color: '#c86a6a', side: THREE.DoubleSide }));
    dia.scale.y = 0.5;
    dia.position.set(0, 0.6, -1);
    g.add(dia);
    this.diaphragm = dia;
    addOutline(g, 0.04);
    this.add(g, cx, cz);
    this.col(cx, cz, 4.5);
    void propSlot(g, 'PRP_Lungs', { h: 8 }).then((ok) => { if (ok) this.lungProp = g.children.find((c) => c.name.startsWith('prop:')) ?? null; });
    const w = (lx: number, ly: number) => {
      const v = new THREE.Vector3(lx, ly, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), face);
      return [cx + v.x, this.h(cx, cz) + v.y, cz + v.z] as const;
    };
    const [tx, ty, tz] = w(0, 7.3);
    this.scan('OBJ_MET_TRACHEA', 'CDX_BREATH_TRACHEA', ['breath'], tx, ty, tz, 2.5, 'ท่อลม (Trachea)');
    const [dx, dy, dz] = w(0, 0.8);
    this.scan('OBJ_MET_DIAPHRAGM', 'CDX_BREATH_DIAPHRAGM', ['breath'], dx, dy, dz, 3.5, 'กะบังลม (Diaphragm)');
    const [lx, ly, lz] = w(2.6, 3.6);
    this.scan('OBJ_MET_LUNG', 'CDX_BREATH_LUNG', ['breath'], lx, ly, lz, 2.5, 'ปอด');
    // alveoli cluster beside the hall: grape-like sacs in a net of capillaries
    const ax = cx + Math.cos(face) * 8, az = cz - Math.sin(face) * 8;
    const alv = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = 0.4 + (i % 4) * 0.35;
      const sac = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshToonMaterial({ color: '#f4b0b8', transparent: true, opacity: 0.9 }));
      sac.position.set(Math.cos(a) * r, 1.4 + (i % 3) * 0.55, Math.sin(a) * r);
      alv.add(sac);
    }
    const cap = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.06, 64, 6, 3, 5), toon('#d84a4a'));
    cap.position.y = 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.4, 8), toon('#e8c8c0'));
    stem.position.y = 0.7;
    alv.add(cap, stem);
    addOutline(alv, 0.03);
    this.add(alv, ax, az);
    void propSlot(alv, 'PRP_Alveoli', { h: 3 });
    this.col(ax, az, 1.4);
    this.scan('OBJ_MET_ALVEOLI', 'CDX_ALVEOLI', ['breath'], ax, this.h(ax, az) + 2, az, 2.5, 'ถุงลม (Alveoli)');
    this.board(cx - 8, cz + 10, face);
  }

  /** Glycolysis conveyor: glucose hexagons ride a belt and split into two pyruvate triangles (+ ATP coins). */
  private conveyor(cx: number, cz: number) {
    const iron = toon('#4a4048');
    const g = new THREE.Group();
    const belt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 2.2), toon('#2e2a30'));
    belt.position.y = 1.2;
    g.add(belt);
    for (let i = 0; i < 6; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 2), iron);
      leg.position.set(-7.5 + i * 3, 0.6, 0);
      g.add(leg);
    }
    // splitter press in the middle
    const press = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2.8), toon('#7a6a60'));
    press.position.set(0, 2.9, 0);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 2.4), this.hot('#ff8a3a', 1.2));
    blade.position.set(0, 1.6, 0);
    g.add(press, blade);
    addOutline(g, 0.04);
    this.add(g, cx, cz);
    void propSlot(g, 'PRP_Conveyor', { w: 16 });
    this.col(cx - 5, cz, 1.6); this.col(cx, cz, 1.6); this.col(cx + 5, cz, 1.6);
    const glucose = new THREE.CylinderGeometry(0.6, 0.6, 0.35, 6), pyruvate = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 3);
    const gMat = toon('#f2d24a'), pMat = toon('#ff9a4a');
    const y = this.h(cx, cz) + 1.55;
    for (let i = 0; i < 4; i++) {
      const o = new THREE.Group();
      const hex = new THREE.Mesh(glucose, gMat);
      const halves = new THREE.Group();
      for (const s of [-0.5, 0.5]) { const tri = new THREE.Mesh(pyruvate, pMat); tri.position.z = s; halves.add(tri); }
      halves.visible = false;
      o.add(hex, halves);
      this.root.add(o);
      this.belts.push({ obj: o, from: new THREE.Vector3(cx - 7.5, y, cz), to: new THREE.Vector3(cx + 7.5, y, cz), t: i / 4, split: halves });
    }
    this.scan('OBJ_MET_CONVEYOR', 'CDX_GLYCOLYSIS', ['resp'], cx, y + 1, cz, 4, 'สายพานไกลโคไลซิส');
    this.board(cx, cz + 9, 0);
  }

  /** The Krebs wheel: a tall wheel of eight buckets (one per cycle intermediate) turned by the furnace's heat. */
  private krebsWheel(cx: number, cz: number) {
    const iron = toon('#4a4048');
    const g = new THREE.Group();
    for (const s of [-1.6, 1.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), iron);
      leg.position.set(0, 3.5, s);
      g.add(leg);
    }
    const wheel = new THREE.Group();
    wheel.position.y = 6.5;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5, 0.3, 8, 32), iron);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    const cols = ['#ff7a6a', '#ffb05a', '#ffd35a', '#a8e06a', '#6ad0b0', '#6aa8ff', '#a88aff', '#ff8ad0'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 0.2), iron);
      spoke.position.set(0, Math.sin(a) * 2.5, Math.cos(a) * 2.5);
      spoke.rotation.x = -a;
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.8, 8), this.hot(cols[i], 0.8));
      bucket.position.set(0, Math.sin(a) * 5, Math.cos(a) * 5);
      wheel.add(spoke, bucket);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3.6, 12), this.hot('#ffb060', 1.2));
    hub.rotation.x = Math.PI / 2;
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    g.add(wheel);
    this.spin.push({ obj: wheel, axis: 'x', speed: 0.35, needsHeat: true });
    addOutline(g, 0.04);
    this.add(g, cx, cz);
    this.col(cx, cz, 2.2);
    void propSlot(g, 'PRP_KrebsWheel', { h: 12 });
    this.scan('OBJ_MET_WHEEL', 'CDX_KREBS', ['resp'], cx, this.h(cx, cz) + 6.5, cz, 5, 'วงล้อเครบส์');
    this.board(cx, cz + 10, 0);
  }

  /** The Great Mitochondrion Furnace: a giant bean with a translucent outer membrane, cristae fins, ATP-synthase turbines. */
  private greatFurnace(x: number, z: number) {
    const fz = z - 16;
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CapsuleGeometry(5, 12, 8, 20), new THREE.MeshToonMaterial({ color: '#e88a5a', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    outer.rotation.z = Math.PI / 2;
    outer.position.y = 5.5;
    outer.scale.set(1, 1, 0.75);
    g.add(outer);
    const inner = this.hot('#ff7a2a', 1.1);
    for (let i = 0; i < 7; i++) {
      // cristae: folded fins of the inner membrane
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6 - Math.abs(i - 3) * 0.6, 5), inner);
      fin.position.set(-7.2 + i * 2.4, 5.5 + (i % 2 ? 0.9 : -0.9), 0);
      g.add(fin);
    }
    const matrix = new THREE.Mesh(new THREE.CapsuleGeometry(3.6, 11, 6, 16), this.hot('#ffc070', 0.5));
    matrix.rotation.z = Math.PI / 2;
    matrix.position.y = 5.5;
    matrix.scale.set(1, 1, 0.6);
    g.add(matrix);
    // ATP-synthase turbines on top: stalk + spinning head
    for (const tx of [-6, -2, 2, 6]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.2, 8), toon('#6a5a50'));
      stalk.position.set(tx, 10.6, 0);
      const head = new THREE.Group();
      head.position.set(tx, 12, 0);
      for (let k = 0; k < 6; k++) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), this.hot('#ffd35a', 1));
        lobe.position.set(Math.cos(k) * 0.6, 0, Math.sin(k) * 0.6);
        head.add(lobe);
      }
      g.add(stalk, head);
      this.spin.push({ obj: head, axis: 'y', speed: 3, needsHeat: true });
    }
    // foundation and pipes
    const base = new THREE.Mesh(new THREE.BoxGeometry(22, 1.4, 11), toon('#4a4048'));
    base.position.y = 0.7;
    base.userData.keep = true; // the downloaded mitochondrion stands on this foundation
    g.add(base);
    for (const s of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 10), toon('#6a5a50'));
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(s * 9.5, 1.8, 6);
      pipe.userData.keep = true;
      g.add(pipe);
    }
    addOutline(g, 0.05);
    this.add(g, x, fz);
    // a downloaded mitochondrion takes the furnace's place; its own colours go grey while cold and glow once restored
    void propSlot(g, 'PRP_Mitochondrion', { w: 18, y: 1.2 }).then((ok) => {
      if (!ok) return;
      g.children.find((c) => c.name.startsWith('prop:'))?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !(m.material instanceof THREE.MeshToonMaterial)) return;
        const mat = m.material.clone();
        mat.emissive = mat.color.clone();
        m.material = mat;
        this.glows.push({ mat, hot: 0.35 });
      });
      this.applyHeat(this.heat);
    });
    for (let i = -2; i <= 2; i++) this.col(x + i * 4.5, fz, 5);
    this.scan('OBJ_MET_FURNACE', 'CDX_ETC', ['furnace'], x, this.h(x, fz) + 5.5, fz + 4, 7, 'เตาหลอมไมโทคอนเดรียใหญ่');
    for (const s of [-1, 1]) this.smoke(x + s * 6, fz, this.h(x, fz) + 13, 14, 12, 0x8a8084, 5);
  }

  /** Rocks, obsidian spikes and a few scorched trees. */
  private scenery() {
    let s = 77;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const clear = (x: number, z: number, pad: number) =>
      Object.values(MET_SITES).every((p) => Math.hypot(x - p.x, z - p.z) > (p === MET_SITES.heart ? 34 : 24) + pad) && pathDist(x, z) > 4 + pad && lavaDist(x, z) > 5;
    const sets: Record<string, FloraSet> = {
      rocks: { file: 'NAT_RocksStylized', split: true, far: 220, tint: '#5a5054' },
      boulder: { file: 'NAT_StonePack', split: true, only: /^Big|^BIG/, far: 340, tint: '#6a5e5c' },
      dead: { file: 'NAT_FallenTree', far: 140, tint: '#3a3034' },
    };
    for (const k of Object.keys(sets)) if (!hasFlora(sets[k].file)) delete sets[k];
    const spots: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(sets).map((k) => [k, []]));
    const at = (k: string, x: number, z: number, scale: number) => { if (spots[k]) spots[k].push({ x, y: this.h(x, z) - 0.3, z, rot: rand() * 6.28, scale }); };
    const obsidian = toon('#2a2430');
    for (let i = 0; i < 400; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 145 || !clear(x, z, 0)) continue;
      const roll = rand();
      if (roll < 0.35) { at('rocks', x, z, 1 + rand() * 2.5); if (rand() < 0.3) this.col(x, z, 1); }
      else if (roll < 0.5) { at('boulder', x, z, 3 + rand() * 4); this.col(x, z, 2); }
      else if (roll < 0.58) at('dead', x, z, 1.2 + rand() * 0.5);
      else if (roll < 0.66) {
        // obsidian spike cluster
        const c = new THREE.Group();
        for (let k = 0; k < 3; k++) {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rand() * 0.4, 2 + rand() * 3, 5), obsidian);
          sp.position.set((rand() - 0.5) * 1.6, 1, (rand() - 0.5) * 1.6);
          sp.rotation.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
          c.add(sp);
        }
        this.add(c, x, z);
        this.col(x, z, 1);
      }
    }
    for (const k of Object.keys(sets)) if (spots[k].length) this.root.add(plantFlora(sets[k], spots[k], rand));
  }

  /** Embers drifting up around the player (world-anchored, wrapped in a box around them). */
  private buildEmbers() {
    const n = 120;
    this.emberBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.emberBase[i * 3] = (Math.random() - 0.5) * 50;
      this.emberBase[i * 3 + 1] = Math.random() * 14;
      this.emberBase[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.16, map: dotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.embers.frustumCulled = false;
    this.embers.userData.noShadow = true;
    this.root.add(this.embers);
  }

  // ---------------------------------------------------------------- state
  /** Restored = the furnaces burn again (glow, turbines spin, smoke); animated unless `instant`. */
  setRestored(on: boolean, instant = false) {
    this.restored = on;
    if (instant) { this.heat = on ? 1 : 0; this.applyHeat(this.heat); }
  }

  private applyHeat(k: number) {
    const cold = new THREE.Color('#7a7680');
    for (const g of this.glows) {
      g.mat.emissiveIntensity = g.hot * k;
      if (!g.mat.userData.base) g.mat.userData.base = g.mat.color.clone();
      g.mat.color.copy(cold).lerp(g.mat.userData.base as THREE.Color, 0.25 + 0.75 * k);
    }
  }

  /** `day` 0..1 dims the (unlit) smoke at night */
  update(dt: number, playerPos: THREE.Vector3, day = 1) {
    this.t += dt;
    const target = this.restored ? 1 : 0;
    if (this.heat !== target) {
      this.heat += Math.sign(target - this.heat) * Math.min(Math.abs(target - this.heat), dt * 0.3);
      this.applyHeat(this.heat);
    }
    const flicker = 0.85 + 0.15 * Math.sin(this.t * 9) * Math.sin(this.t * 5.3);
    if (this.heat > 0) for (const g of this.glows) g.mat.emissiveIntensity = g.hot * this.heat * flicker;
    for (const s of this.spin) s.obj.rotation[s.axis] += dt * s.speed * (s.needsHeat ? 0.15 + this.heat * 0.85 : 1);
    this.lavaTex.offset.y -= dt * 0.05;
    // conveyor: glucose rides in, is split by the press at the middle, two pyruvate ride out
    const run = 0.25 + this.heat * 0.75;
    for (const b of this.belts) {
      b.t = (b.t + dt * 0.07 * run) % 1;
      b.obj.position.lerpVectors(b.from, b.to, b.t);
      const split = b.t > 0.5;
      (b.obj.children[0] as THREE.Object3D).visible = !split;
      if (b.split) b.split.visible = split;
    }
    // breathing: lungs swell as the diaphragm flattens (contracts), and back
    const br = Math.sin(this.t * (0.9 + this.heat * 0.5));
    for (const l of this.lungs) l.obj.scale.set(0.85 + br * 0.1, 1.25 + br * 0.12, 0.8 + br * 0.08);
    if (this.diaphragm) this.diaphragm.scale.y = 0.5 - br * 0.18;
    if (this.lungProp) this.lungProp.scale.setScalar(1 + br * 0.05);
    // smoke columns (thin while the city is cold)
    for (const s of this.smokes) {
      const p = s.pts.geometry.attributes.position as THREE.BufferAttribute;
      const H = s.pts.userData.height as number;
      for (let i = 0; i < p.count; i++) {
        let f = s.base[i * 3 + 1] + dt * 0.08 * s.base[i * 3 + 2];
        if (f > 1) f -= 1;
        s.base[i * 3 + 1] = f;
        const a = s.base[i * 3] + this.t * 0.3, r = 0.3 + f * H * 0.18;
        p.setXYZ(i, s.x + Math.cos(a) * r + f * H * 0.25, s.y + f * H, s.z + Math.sin(a) * r);
      }
      p.needsUpdate = true;
      const sm = s.pts.material as THREE.PointsMaterial;
      sm.opacity = s.pts.userData.height > 20 ? 0.4 : 0.08 + 0.3 * this.heat;
      sm.color.copy(s.pts.userData.base as THREE.Color).multiplyScalar(0.2 + 0.8 * day);
    }
    const near = inMetabolis(playerPos.x, playerPos.z);
    this.embers.visible = near;
    if (near) {
      const lx = playerPos.x - MET.x, lz = playerPos.z - MET.z;
      const p = this.embers.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        let y = this.emberBase[i * 3 + 1] + dt * (0.5 + (i % 4) * 0.2);
        if (y > 14) y -= 14;
        this.emberBase[i * 3 + 1] = y;
        const wx = this.emberBase[i * 3] + Math.sin(this.t * 0.9 + i) * 0.8, wz = this.emberBase[i * 3 + 2] + Math.cos(this.t * 0.7 + i) * 0.6;
        const x = lx + ((((wx - lx + 25) % 50) + 50) % 50) - 25;
        const z = lz + ((((wz - lz + 25) % 50) + 50) % 50) - 25;
        p.setXYZ(i, x, playerPos.y - 1 + y, z);
      }
      p.needsUpdate = true;
      (this.embers.material as THREE.PointsMaterial).opacity = 0.35 + 0.65 * this.heat;
    }
  }
}
