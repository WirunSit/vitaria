import * as THREE from 'three';
import { PAINTED_TREES, hasFlora, plantFlora, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { buildAirship } from './Genovia';
import { propSlot } from '../models/PropModels';

/**
 * ซีเฟอเรีย — floating sky islands of Anemo (chapter 3: evolution, biodiversity, ecology).
 * Islands are joined by rope bridges; updrafts lift a gliding player between them. Below is a sea of clouds.
 */
export const ZEP = { x: -1800, z: 0 };
export const ZEP_SIZE = 360;
export const VOID_Y = -80;

export function inZepheria(x: number, z: number) {
  return Math.hypot(x - ZEP.x, z - ZEP.z) < ZEP_SIZE / 2 + 60;
}

export interface Island { id: string; x: number; z: number; r: number; top: number; tint: string }
/** Local coordinates (-z = north). */
export const ISLANDS: Island[] = [
  { id: 'port', x: 0, z: 82, r: 24, top: 0, tint: '#9cc86a' },
  { id: 'finch', x: -58, z: 30, r: 21, top: 5, tint: '#b8cc66' },
  { id: 'fossil', x: 58, z: 30, r: 21, top: 3, tint: '#d8c48a' },
  { id: 'hub', x: 0, z: 8, r: 10, top: 2, tint: '#a6cf72' },
  { id: 'taxon', x: -52, z: -42, r: 19, top: 10, tint: '#8fc070' },
  { id: 'web', x: 52, z: -42, r: 23, top: 8, tint: '#96c85e' },
  { id: 'fade', x: 0, z: -98, r: 27, top: 14, tint: '#a6c86a' },
];
export const ISLE = (id: string) => ISLANDS.find((i) => i.id === id)!;

/** Rope bridges (local endpoints are picked on the island rims at build time). */
const BRIDGES: [string, string][] = [['port', 'finch'], ['port', 'fossil'], ['port', 'hub'], ['fossil', 'web'], ['web', 'fade']];
/** Updraft columns (local). */
export const UPDRAFTS = [
  { x: -30, z: -6, r: 3.2, lift: 6.5 },  // hub → taxon
  { x: -40, z: -72, r: 3.2, lift: 7 },   // taxon → fade
  { x: -40, z: 8, r: 3, lift: 6 },       // finch → hub/taxon
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function rimRadius(i: Island, ang: number) {
  return i.r * (1 + 0.07 * Math.sin(ang * 5 + i.x * 0.1) + 0.05 * Math.sin(ang * 9 + i.z * 0.2));
}

/** Island surface height, or -Infinity if (x,z) is off this island. */
function islandHeight(i: Island, x: number, z: number) {
  const dx = x - i.x, dz = z - i.z, d = Math.hypot(dx, dz);
  const R = rimRadius(i, Math.atan2(dz, dx));
  if (d > R) return -Infinity;
  const bump = (fbm(x * 0.05 + 30, z * 0.05 + 11, 3) - 0.5) * 2.4 * smoothstep(R * 0.9, R * 0.35, d);
  return i.top + bump - smoothstep(R - 2.5, R, d) * 0.8;
}

interface Bridge { ax: number; az: number; ay: number; bx: number; bz: number; by: number; w: number }
const bridges: Bridge[] = (() => {
  const out: Bridge[] = [];
  for (const [a, b] of BRIDGES) {
    const A = ISLE(a), B = ISLE(b);
    const ang = Math.atan2(B.z - A.z, B.x - A.x);
    const ra = rimRadius(A, ang) - 2, rb = rimRadius(B, ang + Math.PI) - 2;
    out.push({
      ax: A.x + Math.cos(ang) * ra, az: A.z + Math.sin(ang) * ra, ay: A.top,
      bx: B.x - Math.cos(ang) * rb, bz: B.z - Math.sin(ang) * rb, by: B.top, w: 3.2,
    });
  }
  return out;
})();

/** Local height: islands, then bridges, else the void. */
export function zepHeightLocal(x: number, z: number): number {
  let h = -Infinity;
  for (const i of ISLANDS) h = Math.max(h, islandHeight(i, x, z));
  for (const b of bridges) {
    const vx = b.bx - b.ax, vz = b.bz - b.az, L2 = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((x - b.ax) * vx + (z - b.az) * vz) / L2));
    const px = b.ax + vx * t, pz = b.az + vz * t;
    if (Math.hypot(x - px, z - pz) < b.w / 2) {
      const sag = Math.sin(t * Math.PI) * 0.8;
      h = Math.max(h, b.ay + (b.by - b.ay) * t - sag + 0.25);
    }
  }
  return h === -Infinity ? VOID_Y : h;
}

export function updraftAtLocal(x: number, z: number): number {
  for (const u of UPDRAFTS) if (Math.hypot(x - u.x, z - u.z) < u.r) return u.lift;
  return 0;
}

export class Zepheria {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  private spin: THREE.Object3D[] = [];
  private drafts: THREE.Mesh[] = [];
  private clouds!: THREE.Mesh;
  private fadeMats: THREE.MeshToonMaterial[] = [];
  private t = 0;

  constructor() {
    this.root.position.set(ZEP.x, 0, ZEP.z);
    for (const i of ISLANDS) this.island(i);
    for (const b of bridges) this.bridge(b);
    for (const u of UPDRAFTS) this.updraft(u.x, u.z, u.r);
    this.cloudSea();
    this.port();
    this.finchIsland();
    this.fossilIsland();
    this.taxonIsland();
    this.webIsland();
    this.fadeIsland();
    this.trees();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
  }

  private h(x: number, z: number) { return zepHeightLocal(x, z); }
  /** A simple stand-in mesh inside a group, so a downloaded model can take its place (`propSlot`). */
  private slotted(geo: THREE.BufferGeometry, color: string, y: number) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, toon(color));
    m.position.y = y;
    g.add(m);
    return g;
  }
  private col(x: number, z: number, r: number) { this.colliders.push({ x: ZEP.x + x, z: ZEP.z + z, r }); }
  private add(o: THREE.Object3D, x: number, z: number, lift = 0) { o.position.set(x, this.h(x, z) + lift, z); this.root.add(o); return o; }
  private scan(id: string, codexId: string, tags: string[], x: number, y: number, z: number, radius: number, label: string) {
    const probe = new THREE.Object3D();
    probe.position.set(x, y, z);
    this.root.add(probe);
    this.scannables.push({ id, codexId, tags, obj: probe, radius, label });
  }

  // ---------------------------------------------------------------- islands
  private island(i: Island) {
    const Rmax = i.r * 1.13;
    const top = new THREE.RingGeometry(0.01, Rmax, 72, 14);
    top.rotateX(-Math.PI / 2);
    const pos = top.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(i.tint), deep = new THREE.Color(i.tint).multiplyScalar(0.82), rim = new THREE.Color('#b8a88c'), c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const lx = pos.getX(k), lz = pos.getZ(k);
      const x = i.x + lx, z = i.z + lz;
      const d = Math.hypot(lx, lz), R = rimRadius(i, Math.atan2(lz, lx));
      const hh = islandHeight(i, x, z);
      pos.setX(k, Math.cos(Math.atan2(lz, lx)) * Math.min(d, R + 0.4));
      pos.setZ(k, Math.sin(Math.atan2(lz, lx)) * Math.min(d, R + 0.4));
      pos.setY(k, hh === -Infinity ? i.top - 1.2 : hh);
      c.copy(grass).lerp(deep, smoothstep(0.45, 0.75, fbm(x * 0.06, z * 0.06, 2))).lerp(rim, smoothstep(R - 2.2, R, d));
      cols[k * 3] = c.r; cols[k * 3 + 1] = c.g; cols[k * 3 + 2] = c.b;
    }
    top.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    top.computeVertexNormals();
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
    if (i.id === 'fade') this.fadeMats.push(mat);
    const topMesh = new THREE.Mesh(top, mat);
    topMesh.position.set(i.x, 0, i.z);
    topMesh.receiveShadow = true;
    topMesh.userData.noShadow = true;
    this.root.add(topMesh);
    // rocky underside: an upside-down craggy cone
    const depth = i.r * 1.5;
    const under = new THREE.ConeGeometry(Rmax * 0.98, depth, 18, 5, true);
    under.rotateX(Math.PI);
    const up = under.attributes.position as THREE.BufferAttribute;
    const ucol = new Float32Array(up.count * 3);
    const r1 = new THREE.Color('#a39280'), r2 = new THREE.Color('#7a6e62');
    for (let k = 0; k < up.count; k++) {
      const x = up.getX(k), y = up.getY(k), z = up.getZ(k);
      const n = fbm(x * 0.15 + i.x, y * 0.15 + z * 0.15, 2);
      const s = 1 + (n - 0.5) * 0.35;
      up.setX(k, x * s); up.setZ(k, z * s);
      c.copy(r1).lerp(r2, smoothstep(depth * 0.4, -depth * 0.5, y) * 0.8 + (n - 0.5) * 0.4);
      ucol[k * 3] = c.r; ucol[k * 3 + 1] = c.g; ucol[k * 3 + 2] = c.b;
    }
    under.setAttribute('color', new THREE.BufferAttribute(ucol, 3));
    under.computeVertexNormals();
    const underMesh = new THREE.Mesh(under, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    underMesh.position.set(i.x, i.top - 1.1 - depth / 2, i.z);
    underMesh.userData.noShadow = true;
    this.root.add(underMesh);
    // a waterfall spilling over the rim of the bigger islands
    if (i.r > 20) {
      const ang = (i.x + i.z) * 0.05 + 1;
      const R = rimRadius(i, ang);
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 26), new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      fall.position.set(i.x + Math.cos(ang) * (R + 0.3), i.top - 13, i.z + Math.sin(ang) * (R + 0.3));
      fall.rotation.y = -ang + Math.PI / 2;
      fall.userData.noOutline = true;
      fall.userData.noShadow = true;
      this.root.add(fall);
    }
  }

  private bridge(b: Bridge) {
    const g = new THREE.Group();
    const L = Math.hypot(b.bx - b.ax, b.bz - b.az);
    const n = Math.ceil(L / 0.9);
    const wood = toon('#a07850'), wood2 = toon('#8a6243'), rope = toon('#d8c8a0');
    const ang = Math.atan2(b.bz - b.az, b.bx - b.ax);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = b.ax + (b.bx - b.ax) * t, z = b.az + (b.bz - b.az) * t;
      const y = b.ay + (b.by - b.ay) * t - Math.sin(t * Math.PI) * 0.8 + 0.1;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, b.w), k % 2 ? wood : wood2);
      plank.position.set(x, y, z);
      plank.rotation.y = -ang;
      g.add(plank);
      if (k % 4 === 0) for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 5), wood2);
        post.position.set(x - Math.sin(ang) * s * (b.w / 2), y + 0.55, z + Math.cos(ang) * s * (b.w / 2));
        g.add(post);
      }
    }
    for (const s of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        pts.push(new THREE.Vector3(b.ax + (b.bx - b.ax) * t - Math.sin(ang) * s * (b.w / 2), b.ay + (b.by - b.ay) * t - Math.sin(t * Math.PI) * 0.8 + 1.1, b.az + (b.bz - b.az) * t + Math.cos(ang) * s * (b.w / 2)));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.05, 4), rope));
    }
    this.root.add(g);
  }

  private updraft(x: number, z: number, r: number) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 256;
    const g = cv.getContext('2d')!;
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(200,255,240,${0.25 + Math.random() * 0.5})`;
      g.lineWidth = 1 + Math.random() * 2;
      const x0 = Math.random() * 64;
      g.beginPath(); g.moveTo(x0, 256); g.bezierCurveTo(x0 + 10, 180, x0 - 10, 90, x0 + 4, 0); g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: 0x9effe0 });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 46, 20, 1, true), mat);
    col.position.set(x, 4, z);
    col.userData.noOutline = true;
    col.userData.noShadow = true;
    this.drafts.push(col);
    this.root.add(col);
  }

  private cloudSea() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0)';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 512, y = Math.random() * 512, r = 18 + Math.random() * 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xf4f8ff }));
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = -36;
    this.clouds.userData.noOutline = true;
    this.clouds.userData.noShadow = true;
    this.root.add(this.clouds);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: 0xdfeefc }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -60;
    floor.userData.noShadow = true;
    this.root.add(floor);
  }

  // ---------------------------------------------------------------- landmarks
  private port() {
    const P = ISLE('port');
    // the Beagle — Sage Darwyn's exploration airship moored at the dock
    const dock = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 4), toon('#a07850'));
    deck.position.set(0, 0.25, 0);
    dock.add(deck);
    for (const sx of [-4.5, 4.5]) for (const sz of [-1.8, 1.8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), toon('#8a6243'));
      p.position.set(sx, -1, sz);
      dock.add(p);
    }
    const ship = buildAirship();
    ship.scale.setScalar(1.6);
    ship.position.set(0, 0.5, -2);
    dock.add(ship);
    void propSlot(ship, 'PRP_Airship', { w: 11 });
    addOutline(dock, 0.04);
    this.add(dock, P.x, P.z + 18);
    this.col(P.x, P.z + 18, 4);
    // windmill
    const mill = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 8, 8), toon('#f1ead8'));
    tower.position.y = 4;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.4, 8), toon('#5a8ad8'));
    roof.position.y = 9.2;
    const hub = new THREE.Group();
    hub.position.set(0, 7.4, 1.6);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.1), toon('#f4efe2'));
      blade.position.y = 2.6;
      const arm = new THREE.Group();
      arm.rotation.z = k * Math.PI / 2;
      arm.add(blade);
      hub.add(arm);
    }
    hub.userData.spinZ = 0.8;
    this.spin.push(hub);
    mill.add(tower, roof, hub);
    addOutline(mill, 0.04);
    void propSlot(mill, 'PRP_Windmill', { h: 10.5 });
    this.add(mill, P.x - 12, P.z - 4);
    this.col(P.x - 12, P.z - 4, 2.2);
    // a few cottages
    for (const [dx, dz, c] of [[10, -6, '#e8a060'], [14, 4, '#7aa8e8'], [-6, 10, '#e8d060']] as const) {
      const house = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 3.2), toon('#f4efe2'));
      body.position.y = 1.4;
      const roofH = new THREE.Mesh(new THREE.ConeGeometry(3, 2, 4), toon(c));
      roofH.position.y = 3.8;
      roofH.rotation.y = Math.PI / 4;
      house.add(body, roofH);
      addOutline(house, 0.03);
      house.rotation.y = Math.atan2(-dx, -dz); // face the plaza
      void propSlot(house, 'BLD_ZepCottage', { w: 5 });
      this.add(house, P.x + dx, P.z + dz);
      this.col(P.x + dx, P.z + dz, 2.4);
    }
  }

  private bird(beak: 'thick' | 'thin' | 'curved', color: string) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), toon(color));
    body.scale.set(1, 0.9, 1.3);
    body.position.y = 0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), toon(color));
    head.position.set(0, 0.92, 0.38);
    const bk = beak === 'thick'
      ? new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 8), toon('#3a3a40'))
      : beak === 'thin' ? new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), toon('#3a3a40'))
      : new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 10, Math.PI * 0.6), toon('#3a3a40'));
    bk.position.set(0, 0.9, 0.66);
    if (beak !== 'curved') bk.rotation.x = Math.PI / 2;
    else bk.rotation.set(0, Math.PI / 2, -0.4);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0x1a1830 }));
      eye.position.set(s * 0.15, 0.98, 0.58);
      eye.userData.noOutline = true;
      g.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 4), toon(color));
    tail.rotation.x = -Math.PI / 2 - 0.4;
    tail.position.set(0, 0.6, -0.65);
    g.add(body, head, bk, tail);
    g.scale.setScalar(1.4);
    return g;
  }

  private finchIsland() {
    const F = ISLE('finch');
    const birds: ['thick' | 'thin' | 'curved', string, string, string][] = [
      ['thick', '#8a6a4a', 'นกฟินช์จะงอยปากหนา (กินเมล็ดแข็ง)', 'seeds'],
      ['thin', '#6a7a8a', 'นกฟินช์จะงอยปากเรียวแหลม (กินแมลง)', 'insects'],
      ['curved', '#a08060', 'นกฟินช์จะงอยปากยาวโค้ง (ดูดน้ำหวานกระบองเพชร)', 'cactus'],
    ];
    const board = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6), toon('#8a6243'));
    post.position.y = 0.8;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.1), toon('#e8dcc4'));
    panel.position.y = 1.7;
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.4), toon('#8a6243'));
    roofB.position.y = 2.32;
    board.add(post, panel, roofB);
    addOutline(board, 0.03);
    this.add(board, F.x, F.z);
    this.col(F.x, F.z, 0.5);
    birds.forEach(([beak, color, label, food], k) => {
      const a = -0.9 + k * 0.9, x = F.x + Math.cos(a) * 9, z = F.z + Math.sin(a) * 9;
      const perch = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6), toon('#8a6243'));
      post.position.y = 0.8;
      perch.add(post);
      const b = this.bird(beak, color);
      b.position.y = 1.5;
      void propSlot(b, `PRP_Finch${beak === 'thick' ? 'Thick' : beak === 'thin' ? 'Thin' : 'Curved'}`, { h: 0.9 });
      b.rotation.y = Math.PI + a;
      perch.add(b);
      // its food beside it
      const foodObj = food === 'seeds' ? new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.5, 8), toon('#c8a060'))
        : food === 'insects' ? new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.4, 6), toon('#6a4a3a'))
        : new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2, 4, 8), toon('#5f9f4a'));
      const foodSlot = new THREE.Group();
      foodSlot.position.set(1.2, 0, 0);
      foodObj.position.set(0, food === 'seeds' ? 0.25 : 0.7, 0);
      foodSlot.add(foodObj);
      perch.add(foodSlot);
      void propSlot(foodSlot, food === 'seeds' ? 'PRP_SeedPile' : food === 'insects' ? 'PRP_InsectLog' : 'PRP_Cactus', { h: food === 'seeds' ? 0.5 : 1.4 });
      addOutline(perch, 0.03);
      this.add(perch, x, z);
      this.col(x, z, 0.6);
      this.scan(`OBJ_FINCH_${k + 1}`, 'CDX_FINCH', ['finch'], x, this.h(x, z) + 2.4, z, 1.2, label);
    });
  }

  private fossilIsland() {
    const F = ISLE('fossil');
    // dig site: a shallow pit ringed with stakes and three fossils
    const ring = new THREE.Mesh(new THREE.RingGeometry(5, 5.6, 24), toon('#c8a878', { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(F.x, this.h(F.x, F.z) + 0.05, F.z);
    this.root.add(ring);
    const bone = toon('#efe6d0');
    const fossils: [string, string, () => THREE.Object3D][] = [
      ['OBJ_FOSSIL_1', 'ฟอสซิลแอมโมไนต์', () => { const m = new THREE.Mesh(new THREE.TorusKnotGeometry(0.5, 0.18, 40, 6, 1, 3), toon('#c8a060')); m.scale.z = 0.4; m.rotation.x = Math.PI / 2; return m; }],
      ['OBJ_FOSSIL_2', 'ฟอสซิลปลาโบราณ', () => { const g = new THREE.Group(); for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.4 - Math.abs(k - 3) * 0.08, 0.04, 4, 10, Math.PI), bone); r.position.x = -1 + k * 0.32; r.rotation.y = Math.PI / 2; g.add(r); } const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), bone); sp.rotation.z = Math.PI / 2; g.add(sp); return g; }],
      ['OBJ_FOSSIL_3', 'ฟอสซิลอาร์คีออปเทอริกซ์', () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.8, 4, 6), bone); b.rotation.z = Math.PI / 2; g.add(b); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 3), bone); w.position.set(0, 0, s * 0.6); w.rotation.x = s * Math.PI / 2; g.add(w); } return g; }],
    ];
    fossils.forEach(([id, label, make], k) => {
      const a = k * 2.1, x = F.x + Math.cos(a) * 3.8, z = F.z + Math.sin(a) * 3.8;
      const slab = new THREE.Group();
      const stone = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 1.6), toon('#b8a888'));
      stone.position.y = 0.15;
      const f = make();
      f.position.y = 0.42;
      slab.add(stone, f);
      addOutline(slab, 0.03);
      void propSlot(slab, ['PRP_FossilAmmonite', 'PRP_FossilFish', 'PRP_FossilBird'][k], { w: 2.4 });
      this.add(slab, x, z);
      this.scan(id, 'CDX_EVOLUTION_EVIDENCE', ['fossil'], x, this.h(x, z) + 0.6, z, 1.4, label);
    });
    // homologous forelimbs: three statues of arm / wing / flipper with the same bones
    const hx = F.x + 10, hz = F.z - 6;
    const gal = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 2), toon('#e6dcc2'));
    plinth.position.y = 0.4;
    gal.add(plinth);
    const boneCols = ['#e8553a', '#3a8ad8', '#6fbf4a']; // humerus / radius-ulna / hand bones
    ['arm', 'wing', 'flipper'].forEach((kind, k) => {
      const limb = new THREE.Group();
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.9, 4, 6), toon(boneCols[0]));
      up.position.y = 0.6;
      const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, kind === 'flipper' ? 0.4 : 0.8, 4, 6), toon(boneCols[1]));
      lo.position.y = kind === 'flipper' ? 1.45 : 1.65;
      limb.add(up, lo);
      for (let f = 0; f < 5; f++) {
        const len = kind === 'wing' ? 1.4 : kind === 'flipper' ? 0.6 : 0.45;
        const digit = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, len, 3, 5), toon(boneCols[2]));
        digit.position.set((f - 2) * (kind === 'flipper' ? 0.14 : 0.1), (kind === 'flipper' ? 1.85 : 2.2) + len / 2, 0);
        digit.rotation.z = (f - 2) * (kind === 'wing' ? 0.28 : 0.1);
        limb.add(digit);
      }
      limb.position.set(-2.2 + k * 2.2, 0.8, 0);
      gal.add(limb);
    });
    addOutline(gal, 0.03);
    this.add(gal, hx, hz);
    this.col(hx, hz, 3.4);
    this.scan('OBJ_HOMOLOGY', 'CDX_HOMOLOGY', ['fossil', 'homology'], hx, this.h(hx, hz) + 2, hz, 3, 'โครงกระดูกขาหน้า: แขนคน ปีกค้างคาว ครีบวาฬ');
  }

  private taxonIsland() {
    const T = ISLE('taxon');
    // Taxonomy Totem: 8 stacked rings for domain → species
    const totem = new THREE.Group();
    const cols = ['#e8553a', '#f2a03a', '#f2d23a', '#7ae07a', '#3ab8a8', '#3a8ad8', '#8a5ad8', '#e85a9a'];
    for (let k = 0; k < 8; k++) {
      const block = new THREE.Mesh(new THREE.CylinderGeometry(1.6 - k * 0.12, 1.7 - k * 0.12, 0.9, 8), toon(cols[k]));
      block.position.y = 0.45 + k * 0.92;
      totem.add(block);
    }
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glow('#bff8e0', 1.4));
    crown.position.y = 8.2;
    crown.userData.noOutline = true;
    crown.userData.spin = 1.2;
    this.spin.push(crown);
    totem.add(crown);
    addOutline(totem, 0.04);
    this.add(totem, T.x, T.z);
    this.col(T.x, T.z, 1.9);
    // giant mushrooms (fungi are their own kingdom!)
    for (const [dx, dz, s] of [[-9, 6, 1.4], [8, 8, 1], [6, -9, 1.2]] as const) {
      const m = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 2.4, 8), toon('#f1ead8'));
      stem.position.y = 1.2;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#5aa8a0'));
      cap.position.y = 2.3;
      m.add(stem, cap);
      m.scale.setScalar(s);
      addOutline(m, 0.03);
      void propSlot(m, 'PRP_GiantMushroom', { h: 3.9 });
      this.add(m, T.x + dx, T.z + dz);
      this.col(T.x + dx, T.z + dz, 0.7 * s);
    }
  }

  private webIsland() {
    const W = ISLE('web');
    // a pond and the "stone circle of the food web": five standing stones with trophic glyphs
    const pond = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshToonMaterial({ color: 0x6fc4e8, transparent: true, opacity: 0.85 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(W.x - 8, this.h(W.x - 8, W.z + 6) + 0.08, W.z + 6);
    pond.userData.noShadow = true;
    this.root.add(pond);
    const glyphs = ['#6fbf4a', '#b8e05a', '#f2c45a', '#e8553a', '#8a6a4a'];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2, x = W.x + 4 + Math.cos(a) * 6, z = W.z - 4 + Math.sin(a) * 6;
      const st = new THREE.Group();
      const stone = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 0.8), toon('#c8c0b0'));
      stone.position.y = 1.5;
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), glow(glyphs[k], 1.3));
      mark.position.set(0, 2.2, 0.41);
      mark.userData.noOutline = true;
      mark.userData.keep = true; // the trophic glyph stays on the downloaded stone
      st.add(stone, mark);
      st.rotation.y = -a + Math.PI / 2;
      addOutline(st, 0.03);
      void propSlot(st, 'PRP_StandingStone', { h: 3, w: 1.6 });
      this.add(st, x, z);
      this.col(x, z, 0.8);
    }
    const center = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 10), toon('#e6dcc2'));
    center.position.set(W.x + 4, this.h(W.x + 4, W.z - 4) + 0.3, W.z - 4);
    this.root.add(center);
    this.col(W.x + 4, W.z - 4, 1.5);
  }

  private fadeIsland() {
    const F = ISLE('fade');
    // ruined observatory and the boss arena ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(15, 16.4, 8), toon('#cfc8b8', { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(F.x, F.top + 0.08, F.z);
    this.root.add(ring);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3, x = F.x + Math.cos(a) * 19, z = F.z + Math.sin(a) * 19;
      const pillar = this.slotted(new THREE.CylinderGeometry(0.7, 0.8, 4 + (k % 3) * 2, 8), '#d8d0bd', 2 + (k % 3));
      this.add(pillar, x, z);
      void propSlot(pillar, 'PRP_RuinPillar', { h: 4 + (k % 3) * 2, yaw: a });
      this.col(x, z, 1);
    }
    // a lone, faded tree: the last of its kind
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4, 7), toon('#8a7a6a'));
    trunk.position.y = 2;
    const leaves = new THREE.MeshToonMaterial({ color: 0xb8c0a8, gradientMap: toonGradient() });
    this.fadeMats.push(leaves);
    const can = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), leaves);
    can.position.y = 5;
    tree.add(trunk, can);
    addOutline(tree, 0.03);
    this.add(tree, F.x - 20, F.z - 4);
    this.col(F.x - 20, F.z - 4, 0.7);
    this.scan('OBJ_LAST_TREE', 'CDX_CONSERVATION', ['endangered'], F.x - 20, this.h(F.x - 20, F.z - 4) + 4, F.z - 4, 2.6, 'ต้นไม้ต้นสุดท้ายของสายพันธุ์');
  }

  /** After the boss: colour returns to the fading island. */
  setFadeRestored(ok: boolean) {
    const [ground, leaves] = this.fadeMats;
    if (ground) ground.color.set(ok ? 0xffffff : 0xdcdcd4);
    if (leaves) leaves.color.set(ok ? 0x7fc05a : 0xb8c0a8);
  }

  private trees() {
    const trunk = toon('#8a6243');
    const leafCols = ['#7fb24a', '#a6c95a', '#6aa055', '#e0c063'];
    let s = 33;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    // downloaded hand-painted trees when available (same spots), so the islands match Cytoria's groves
    const painted = hasFlora('NAT_TreesPainted');
    const spots: FloraSpot[] = [];
    for (const i of ISLANDS) {
      if (i.id === 'hub' || i.id === 'fade') continue;
      const n = Math.round(i.r * 0.35);
      for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
        const a = rand() * 6.28, d = i.r * (0.45 + rand() * 0.4);
        const x = i.x + Math.cos(a) * d, z = i.z + Math.sin(a) * d;
        if (Math.hypot(x - ISLE('port').x, z - ISLE('port').z - 18) < 7) continue;
        if (painted) {
          spots.push({ x, y: this.h(x, z) - 0.15, z, rot: rand() * 6.28, scale: 5.5 + rand() * 1.8 });
          this.col(x, z, 0.5);
          k++;
          continue;
        }
        const t = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 6), trunk);
        tr.position.y = 1.3;
        const can = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 + rand() * 0.6, 1), toon(leafCols[Math.floor(rand() * 4)]));
        can.position.y = 3.4;
        t.add(tr, can);
        addOutline(t, 0.03);
        this.add(t, x, z);
        this.col(x, z, 0.5);
        k++;
      }
    }
    if (spots.length) this.root.add(plantFlora(PAINTED_TREES, spots, rand));
  }

  update(dt: number) {
    this.t += dt;
    for (const o of this.spin) {
      if (o.userData.spinZ) o.rotation.z += dt * o.userData.spinZ;
      else o.rotation.y += dt * (o.userData.spin ?? 0.5);
    }
    for (const d of this.drafts) (d.material as THREE.MeshBasicMaterial).map!.offset.y -= dt * 0.6;
    (this.clouds.material as THREE.MeshBasicMaterial).map!.offset.x += dt * 0.004;
  }
}
