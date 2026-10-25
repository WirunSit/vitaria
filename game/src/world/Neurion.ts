import * as THREE from 'three';
import { hasFlora, plantFlora, PAINTED_TREES, type FloraSet, type FloraSpot } from './Flora';
import { toon, glow, addOutline, toonGradient } from './Materials';
import { fbm } from './Terrain';
import type { Collider, Scannable } from './World';
import { buildAirship } from './Genovia';
import { hasProp, propSlot } from '../models/PropModels';

/**
 * นิวรีออน — neon city of Electro / nerves, senses, movement and hormones (chapter 7). North-east, reached by airship.
 * The streets are the city's nervous system: glowing "axon" cables run beside every road and carry signal pulses from
 * the plaza to each district and up to the Brain Tower in the north, where the Emperor sits under a neurotoxin
 * jellyfish's spell. Until the chapter's boss falls the pulses stutter and the tower is dim.
 * Every building / prop is a `propSlot` (downloaded model); the code only builds simple stand-ins until those exist.
 */
export const NEU = { x: 1800, z: -1800 };
export const NEU_RADIUS = 160;
export const NEU_SIZE = 420;

export function inNeurion(x: number, z: number) {
  return Math.hypot(x - NEU.x, z - NEU.z) < NEU_SIZE / 2 + 40;
}

/** Points of interest in local coordinates (-z = north). Mirrors locations.json. */
export const NEU_SITES = {
  dock: { x: 0, z: 122 },
  plaza: { x: 0, z: 66 },
  neuron: { x: -70, z: 10 },
  senses: { x: 70, z: 20 },
  forge: { x: -66, z: -60 },
  spire: { x: 66, z: -60 },
  tower: { x: 0, z: -100 },
};

const FLATS: { x: number; z: number; r: number; h: number }[] = [
  { ...NEU_SITES.dock, r: 12, h: 1.4 },
  { ...NEU_SITES.plaza, r: 24, h: 1.6 },
  { ...NEU_SITES.neuron, r: 18, h: 2 },
  { ...NEU_SITES.senses, r: 18, h: 1.8 },
  { ...NEU_SITES.forge, r: 18, h: 2.2 },
  { ...NEU_SITES.spire, r: 18, h: 2.2 },
  { x: 0, z: -84, r: 22, h: 2.6 }, // the arena in front of the Brain Tower
];

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
  return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
}

/** Avenues: plaza hub → every district and the tower (each one has an axon cable alongside). */
const S = NEU_SITES;
const PATHS: [number, number, number, number][] = [
  [S.dock.x, S.dock.z, S.plaza.x, S.plaza.z],
  ...[S.neuron, S.senses, { x: 0, z: -84 }].map((s) => [S.plaza.x, S.plaza.z, s.x, s.z] as [number, number, number, number]),
  [S.neuron.x, S.neuron.z, S.forge.x, S.forge.z],
  [S.senses.x, S.senses.z, S.spire.x, S.spire.z],
  [S.forge.x, S.forge.z, 0, -84],
  [S.spire.x, S.spire.z, 0, -84],
];
function pathDist(x: number, z: number) {
  let best = Infinity;
  for (const [ax, az, bx, bz] of PATHS) best = Math.min(best, segDist(x, z, ax, az, bx, bz));
  return best;
}

/** Height in local coordinates: a raised city plateau, flat districts, a ring of dark hills. */
export function neuHeightLocal(x: number, z: number): number {
  let h = 1.8 + (fbm(x * 0.018 + 41, z * 0.018 + 7) - 0.5) * 4;
  const r = Math.hypot(x, z);
  h += smoothstep(150, 205, r) * 38 * (0.7 + 0.6 * fbm(x * 0.022 + 5, z * 0.022 + 3, 2));
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.8) h = h + (f.h - h) * (1 - smoothstep(f.r, f.r * 1.8, d));
  }
  // avenues are levelled a little so the cables lie flat
  const pd = pathDist(x, z);
  if (pd < 5) h -= (1 - smoothstep(2.5, 5, pd)) * 0.25;
  return h;
}

/** A glowing pulse texture: one bright spike per repeat (an action potential running along the cable). */
function pulseTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 4;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(120,70,220,1)');
  gr.addColorStop(0.72, 'rgba(120,70,220,1)');
  gr.addColorStop(0.86, 'rgba(255,240,255,1)');
  gr.addColorStop(0.9, 'rgba(200,160,255,1)');
  gr.addColorStop(1, 'rgba(120,70,220,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Neurion {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  private freed = false;
  private freeK = 0;
  private t = 0;
  private pulseTex: THREE.Texture[] = [];
  private cableMat!: THREE.MeshBasicMaterial;
  private towerGlow: THREE.Mesh[] = [];
  private motes!: THREE.Points;
  private moteBase = new Float32Array(0);

  constructor() {
    this.root.position.set(NEU.x, 0, NEU.z);
    this.buildTerrain();
    this.cables();
    this.dock(S.dock.x, S.dock.z);
    this.plaza(S.plaza.x, S.plaza.z);
    this.neuronDistrict(S.neuron.x, S.neuron.z);
    this.senseGarden(S.senses.x, S.senses.z);
    this.motionForge(S.forge.x, S.forge.z);
    this.hormoneSpire(S.spire.x, S.spire.z);
    this.brainTower(S.tower.x, S.tower.z);
    this.scenery();
    this.buildMotes();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow && !o.userData.isOutline) m.castShadow = true; });
  }

  private h(x: number, z: number) { return neuHeightLocal(x, z); }
  private col(x: number, z: number, r: number, id?: string) { this.colliders.push({ x: NEU.x + x, z: NEU.z + z, r, id }); }
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
  /** A glowing part that stays visible when the model replaces the stand-in (signals, screens, lamps). */
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
    const geo = new THREE.PlaneGeometry(NEU_SIZE, NEU_SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#7fb79a'), lush = new THREE.Color('#68a48c'), pave = new THREE.Color('#9ea3c2');
    const rock = new THREE.Color('#8e8aa6'), high = new THREE.Color('#8a9ab8'), plaza = new THREE.Color('#b8bcd6');
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.h(x, z);
      pos.setY(i, y);
      const e = 0.8;
      const nx = this.h(x + e, z) - this.h(x - e, z), nz = this.h(x, z + e) - this.h(x, z - e);
      const slope = 1 - 2 * e / Math.hypot(nx, 2 * e, nz);
      tmp.copy(grass).lerp(lush, smoothstep(0.35, 0.7, fbm(x * 0.03 + 9, z * 0.03 + 2, 3)));
      tmp.lerp(rock, smoothstep(0.25, 0.45, slope));
      tmp.lerp(high, smoothstep(10, 30, y) * 0.7);
      for (const s of Object.values(S)) {
        const d = Math.hypot(x - s.x, z - s.z);
        if (d < 14) tmp.lerp(plaza, 0.8 * (1 - smoothstep(9, 14, d))); // paved squares
      }
      const pd = pathDist(x, z);
      if (pd < 3.2) tmp.lerp(pave, 0.9 * (1 - smoothstep(2.2, 3.2, pd)));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }));
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.root.add(mesh);
  }

  /** Axon cables beside every avenue: a glowing tube whose texture scrolls (signal pulses), with myelin sleeves. */
  private cables() {
    this.cableMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const sheath = toon('#e8e4f4');
    for (const [ax, az, bx, bz] of PATHS) {
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len; // side offset
      const pts: THREE.Vector3[] = [];
      const n = Math.ceil(len / 3);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t + nx * 4.4, z = az + (bz - az) * t + nz * 4.4;
        pts.push(new THREE.Vector3(x, this.h(x, z) + 0.35, z));
      }
      const tex = pulseTexture();
      tex.repeat.set(Math.max(1, Math.round(len / 14)), 1);
      this.pulseTex.push(tex);
      const mat = this.cableMat.clone();
      mat.map = tex;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 4, 0.16, 6), mat);
      tube.userData.noOutline = true;
      tube.userData.noShadow = true;
      this.root.add(tube);
      // myelin sleeves (the gaps between them are the nodes of Ranvier)
      for (let d = 4; d < len - 3; d += 5) {
        const t = d / len, x = ax + (bx - ax) * t + nx * 4.4, z = az + (bz - az) * t + nz * 4.4;
        const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 3, 10), sheath);
        sl.rotation.x = Math.PI / 2; // lies along the cable
        const grp = new THREE.Group();
        grp.add(sl);
        grp.rotation.y = Math.atan2(bx - ax, bz - az);
        grp.position.set(x, this.h(x, z) + 0.35, z);
        this.root.add(grp);
      }
    }
  }

  // ---------------------------------------------------------------- sites
  private dock(x: number, z: number) {
    const deck = new THREE.Group();
    const a = toon('#c9cbe0'), b = toon('#b4b6d0');
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

  /** Synapse Square: a plasma globe in the middle, neon houses and lamps around. */
  private plaza(cx: number, cz: number) {
    const globe = this.placeholder(new THREE.CylinderGeometry(1.6, 2.2, 1.6, 12), '#5a5878', 0.8);
    globe.add(this.light(new THREE.SphereGeometry(1.5, 20, 14), '#c8a0ff', 3.2, 1.2));
    this.add(globe, cx, cz + 4);
    this.col(cx, cz + 4, 2.2);
    void propSlot(globe, 'PRP_PlasmaGlobe', { h: 5 });
    let n = 0;
    for (const [dx, dz, yaw] of [[-16, -4, Math.PI / 2], [16, -4, -Math.PI / 2], [-15, 14, Math.PI * 0.8], [15, 14, -Math.PI * 0.8], [-26, 4, Math.PI / 2], [26, 4, -Math.PI / 2]] as const) {
      const house = this.placeholder(new THREE.BoxGeometry(5, 8, 5), '#6a6a8e', 4);
      house.add(this.light(new THREE.BoxGeometry(5.1, 0.25, 5.1), n % 2 ? '#5ad8ff' : '#d86aff', 6.4));
      house.rotation.y = yaw;
      this.add(house, cx + dx, cz + dz);
      this.col(cx + dx, cz + dz, 3);
      const variant = `BLD_NeuHouse${'AB'[n % 2]}`; // two house models, alternating round the square
      void propSlot(house, hasProp(variant) ? variant : 'BLD_NeuHouse', { w: 6.5 });
      n++;
    }
    for (const [dx, dz] of [[-7, 12], [7, 12], [-7, -6], [7, -6]]) this.lamp(cx + dx, cz + dz);
  }

  private lamp(x: number, z: number) {
    const lamp = this.placeholder(new THREE.CylinderGeometry(0.1, 0.12, 3.4, 6), '#3a3a50', 1.7);
    lamp.add(this.light(new THREE.SphereGeometry(0.24, 8, 6), '#b8f0ff', 3.5, 1.6));
    this.add(lamp, x, z);
    void propSlot(lamp, 'PRP_NeonLamp', { h: 3.6 });
  }

  /** Axon Highway: a giant neuron sculpture — dendrites, cell body, myelinated axon, terminals and a synapse gap. */
  private neuronDistrict(cx: number, cz: number) {
    const g = new THREE.Group();
    const body = toon('#c8a8f0'), dend = toon('#b090e0'), my = toon('#f0ecf8');
    const soma = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 14), body);
    soma.position.set(-6, 3.4, 0);
    g.add(soma);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const d = new THREE.Mesh(new THREE.ConeGeometry(0.4, 4, 6), dend);
      d.position.set(-6 - 2.8 - Math.cos(a) * 0.5, 3.4 + Math.sin(a) * 2.2, Math.cos(a) * 1.6);
      d.rotation.z = Math.PI / 2 + Math.sin(a) * 0.6;
      g.add(d);
    }
    const axon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 10, 8), dend);
    axon.rotation.z = Math.PI / 2;
    axon.position.set(1, 3.4, 0);
    g.add(axon);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 10), my);
      m.rotation.z = Math.PI / 2;
      m.position.set(-2.2 + k * 2.3, 3.4, 0);
      g.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const tb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), body);
      tb.position.set(6.6, 3.4 + (i - 1) * 1.1, (i - 1) * 0.6);
      g.add(tb);
    }
    this.add(g, cx, cz);
    this.col(cx - 6, cz, 2.4);
    this.col(cx + 6.6, cz, 1.2);
    void propSlot(g, 'PRP_Neuron', { w: 16 });
    const y = this.h(cx, cz) + 3.4;
    this.scan('OBJ_NEU_DENDRITE', 'CDX_DENDRITE', ['neuron'], cx - 9.5, y, cz, 1.6, 'เดนไดรต์');
    this.scan('OBJ_NEU_SOMA', 'CDX_NEURON', ['neuron'], cx - 6, y, cz, 2, 'ตัวเซลล์ประสาท');
    this.scan('OBJ_NEU_AXON', 'CDX_MYELIN', ['neuron'], cx + 1, y, cz, 1.6, 'แอกซอนและเยื่อไมอีลิน');
    this.scan('OBJ_NEU_SYNAPSE', 'CDX_SYNAPSE', ['neuron'], cx + 7.4, y, cz, 1.4, 'ไซแนปส์');
    this.board(cx + 4, cz + 13, Math.atan2(S.plaza.x - cx, S.plaza.z - cz));
  }

  /** Garden of the Senses: a giant eye and a giant ear. */
  private senseGarden(cx: number, cz: number) {
    const eye = this.placeholder(new THREE.SphereGeometry(2.4, 20, 16), '#f4f2f8', 2.6);
    eye.add(this.light(new THREE.CircleGeometry(1, 20).translate(0, 2.6, 2.41), '#5ab8ff', 0, 1.1));
    this.add(eye, cx - 7, cz);
    this.col(cx - 7, cz, 2.6);
    void propSlot(eye, 'PRP_EyeModel', { h: 5, yaw: Math.PI }); // iris towards the avenue
    const ear = this.placeholder(new THREE.TorusGeometry(1.8, 0.7, 10, 20, Math.PI * 1.5), '#f0c0a8', 2.8);
    this.add(ear, cx + 7, cz);
    this.col(cx + 7, cz, 2.4);
    void propSlot(ear, 'PRP_EarModel', { h: 5, yaw: -Math.PI / 2 });
    const y = this.h(cx, cz);
    this.scan('OBJ_NEU_LENS', 'CDX_EYE', ['sense'], cx - 7, y + 2.6, cz + 2.4, 1.4, 'เลนส์ตา');
    this.scan('OBJ_NEU_RETINA', 'CDX_RETINA', ['sense'], cx - 7, y + 2.6, cz - 1.8, 1.6, 'เรตินา');
    this.scan('OBJ_NEU_COCHLEA', 'CDX_EAR_COCHLEA', ['sense'], cx + 7, y + 2.2, cz, 1.4, 'คอเคลีย');
    this.scan('OBJ_NEU_SEMICIRC', 'CDX_EAR_BALANCE', ['sense'], cx + 7, y + 4, cz, 1.4, 'ช่องครึ่งวงกลม');
    this.board(cx - 3, cz + 12, Math.atan2(S.plaza.x - cx, S.plaza.z - cz));
  }

  /** Motion Forge: a skeleton and a muscle on display in front of the forge hall. */
  private motionForge(cx: number, cz: number) {
    const hall = this.placeholder(new THREE.BoxGeometry(12, 8, 8), '#706c8a', 4);
    this.add(hall, cx, cz - 9);
    for (let i = -1; i <= 1; i++) this.col(cx + i * 4, cz - 9, 4);
    void propSlot(hall, hasProp('BLD_NeuForge') ? 'BLD_NeuForge' : 'BLD_NeuHouse', { w: 13 }); // the forge reuses the neon building, larger
    const skel = this.placeholder(new THREE.CylinderGeometry(0.4, 0.5, 5, 8), '#efe8d8', 2.5);
    this.add(skel, cx - 5, cz + 2);
    this.col(cx - 5, cz + 2, 1);
    void propSlot(skel, 'PRP_Skeleton', { h: 5.5 });
    const muscle = this.placeholder(new THREE.CapsuleGeometry(0.9, 2.6, 6, 12), '#d86a6a', 2.4);
    this.add(muscle, cx + 5, cz + 2);
    this.col(cx + 5, cz + 2, 1.2);
    void propSlot(muscle, 'PRP_MuscleModel', { h: 4.5 });
    const y = this.h(cx, cz);
    this.scan('OBJ_NEU_BONE', 'CDX_SKELETON', ['motion'], cx - 5, y + 3.5, cz + 2, 1.4, 'กระดูก');
    this.scan('OBJ_NEU_JOINT', 'CDX_JOINT', ['motion'], cx - 5, y + 1.8, cz + 2, 1.2, 'ข้อต่อ');
    this.scan('OBJ_NEU_MUSCLE', 'CDX_MUSCLE_TYPES', ['motion'], cx + 5, y + 3, cz + 2, 1.4, 'กล้ามเนื้อ');
    this.scan('OBJ_NEU_SARCOMERE', 'CDX_SARCOMERE', ['motion'], cx + 5, y + 1.6, cz + 2.6, 1.2, 'ซาร์โคเมียร์');
    this.board(cx + 4, cz + 12, 0);
  }

  /** Hormone Spire: a tall glass spire, and a statue showing where the glands sit. */
  private hormoneSpire(cx: number, cz: number) {
    const spire = this.placeholder(new THREE.CylinderGeometry(2.2, 4, 18, 8), '#8a8ab4', 9);
    spire.add(this.light(new THREE.OctahedronGeometry(1.4), '#ffd27a', 19.5, 1.6));
    this.add(spire, cx, cz - 8);
    this.col(cx, cz - 8, 4.2);
    void propSlot(spire, 'BLD_HormoneSpire', { h: 20 });
    const statue = this.placeholder(new THREE.CapsuleGeometry(0.9, 3, 6, 12), '#e8dcc8', 2.6);
    this.add(statue, cx - 6, cz + 3);
    this.col(cx - 6, cz + 3, 1.2);
    void propSlot(statue, 'PRP_EndocrineBody', { h: 5.5 });
    const y = this.h(cx - 6, cz + 3);
    this.scan('OBJ_NEU_PITUITARY', 'CDX_PITUITARY', ['gland'], cx - 6, y + 5.1, cz + 3.3, 0.9, 'ต่อมใต้สมอง');
    this.scan('OBJ_NEU_THYROID', 'CDX_THYROID', ['gland'], cx - 6, y + 4.4, cz + 3.4, 0.9, 'ต่อมไทรอยด์');
    this.scan('OBJ_NEU_PANCREAS', 'CDX_ISLETS', ['gland'], cx - 6, y + 3, cz + 3.4, 0.9, 'ตับอ่อน (ไอส์เลตส์ออฟแลงเกอร์ฮานส์)');
    this.scan('OBJ_NEU_ADRENAL', 'CDX_ADRENAL', ['gland'], cx - 6, y + 2.7, cz + 2.6, 0.9, 'ต่อมหมวกไต');
    this.board(cx - 4, cz + 12, 0);
  }

  /** The Brain Tower: the Emperor's citadel, its crown a glowing brain; the arena lies in front of it. */
  private brainTower(cx: number, cz: number) {
    const tower = this.placeholder(new THREE.CylinderGeometry(5, 8, 30, 10), '#5e5a80', 15);
    const crown = this.light(new THREE.SphereGeometry(5, 20, 14), '#d8a8ff', 33, 0.6);
    tower.add(crown);
    this.towerGlow.push(crown);
    this.add(tower, cx, cz);
    this.col(cx, cz, 8.5);
    void propSlot(tower, 'BLD_NeuTower', { h: 38 });
    const brain = this.placeholder(new THREE.SphereGeometry(2.2, 18, 14), '#e8a8c8', 2.2);
    brain.scale.set(1.2, 0.9, 1);
    this.add(brain, cx, cz + 13);
    this.col(cx, cz + 13, 2.4);
    void propSlot(brain, 'PRP_BrainModel', { h: 4 });
    this.scan('OBJ_NEU_BRAIN', 'CDX_BRAIN', ['brain'], cx, this.h(cx, cz + 13) + 2.4, cz + 13, 2.4, 'สมองของนิวรีออน');
    for (const dx of [-12, 12]) this.lamp(cx + dx, cz + 22);
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

  /** Park trees between the avenues, neon lamps along them. */
  private scenery() {
    let s = 71;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const clear = (x: number, z: number) =>
      Object.values(S).every((p) => Math.hypot(x - p.x, z - p.z) > 26) && pathDist(x, z) > 6 && Math.hypot(x, z + 84) > 30;
    const sets: Record<string, FloraSet> = {
      trees: { ...PAINTED_TREES, foliage: ['#4f9a72', '#9ad0a8'] },
      sakura: { file: 'NAT_Sakura', sway: 0.03, far: 320 },
      bush: { file: 'NAT_Bush', sway: 0.06, far: 110 },
    };
    for (const k of Object.keys(sets)) if (!hasFlora(sets[k].file)) delete sets[k];
    const spots: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(sets).map((k) => [k, []]));
    const at = (k: string, x: number, z: number, scale: number) => { if (spots[k]) spots[k].push({ x, y: this.h(x, z) - 0.2, z, rot: rand() * 6.28, scale }); };
    let n = 0;
    for (let i = 0; i < 700 && n < 90; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (Math.hypot(x, z) > 140 || !clear(x, z)) continue;
      const roll = rand();
      if (roll < 0.45) { at('trees', x, z, 8 + rand() * 4); this.col(x, z, 0.7); n++; }
      else if (roll < 0.62) { at('sakura', x, z, 7 + rand() * 3); this.col(x, z, 0.7); n++; }
      else at('bush', x, z, 1 + rand() * 0.6);
    }
    for (const k of Object.keys(sets)) if (spots[k].length) this.root.add(plantFlora(sets[k], spots[k], rand));
    for (const [ax, az, bx, bz] of PATHS) {
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let d = 10; d < len - 8; d += 18) {
        const t = d / len, x = ax + (bx - ax) * t - nx * 3.2, z = az + (bz - az) * t - nz * 3.2;
        if (Object.values(S).some((p) => Math.hypot(x - p.x, z - p.z) < 14)) continue;
        this.lamp(x, z);
      }
    }
  }

  /** Electric sparks drifting around the player. */
  private buildMotes() {
    const n = 80;
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
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8b8ff, size: 0.14, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.motes.frustumCulled = false;
    this.motes.userData.noShadow = true;
    this.root.add(this.motes);
  }

  /** Freed = the Emperor is himself again: the tower shines and the signals run fast and steady. */
  setFreed(on: boolean, instant = false) {
    this.freed = on;
    if (instant) this.freeK = on ? 1 : 0;
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.t += dt;
    const target = this.freed ? 1 : 0;
    if (this.freeK !== target) this.freeK += Math.sign(target - this.freeK) * Math.min(Math.abs(target - this.freeK), dt * 0.4);
    // signals: a blocked city stutters (pulses stop and start), a freed one fires steadily
    const stutter = this.freeK + (1 - this.freeK) * (Math.sin(this.t * 1.7) > 0.3 ? 0.35 : 0);
    for (const tex of this.pulseTex) tex.offset.x -= dt * (0.25 + 0.9 * this.freeK) * stutter;
    for (const m of this.towerGlow) {
      const mat = m.material as THREE.MeshBasicMaterial;
      const k = 0.45 + 0.55 * this.freeK + (1 - this.freeK) * 0.15 * Math.sin(this.t * 6) * (Math.sin(this.t * 0.9) > 0.6 ? 1 : 0);
      mat.color.set(this.freeK > 0.5 ? '#e0c0ff' : '#9a7ac8').multiplyScalar(0.6 + 0.8 * k);
    }
    const near = inNeurion(playerPos.x, playerPos.z);
    this.motes.visible = near;
    if (near) {
      const lx = playerPos.x - NEU.x, lz = playerPos.z - NEU.z;
      const p = this.motes.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const wx = this.moteBase[i * 3] + Math.sin(this.t * 0.5 + i) * 1.4, wz = this.moteBase[i * 3 + 2] + Math.cos(this.t * 0.4 + i) * 1.4;
        const x = lx + ((((wx - lx + 25) % 50) + 50) % 50) - 25, z = lz + ((((wz - lz + 25) % 50) + 50) % 50) - 25;
        p.setXYZ(i, x, playerPos.y + this.moteBase[i * 3 + 1] - 1 + Math.sin(this.t * 1.3 + i) * 0.4, z);
      }
      p.needsUpdate = true;
    }
  }
}
