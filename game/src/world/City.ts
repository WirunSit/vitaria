import * as THREE from 'three';
import { toon, glow, addOutline } from './Materials';
import type { Collider, Scannable } from './World';
import { buildAirship } from './Genovia';
import { propSlot } from '../models/PropModels';
import { hasFlora, plantFlora, PAINTED_TREES, type FloraSpot } from './Flora';

/**
 * นครเซลลาเรีย — a capital city laid out like a (plant) cell: every district is an organelle.
 * It lives in its own walled zone far from the overworld (like the lab domains); the gates fade-teleport between them.
 */
export const CITY = { x: 0, z: -1300 };
export const CITY_RADIUS = 76; // walkable radius inside the cell wall
/** Spot just inside the south gate (player arrives here). */
export const CITY_ENTRY = { x: CITY.x, z: CITY.z + 64 };
export const CITY_GATE_IN = { x: CITY.x, z: CITY.z + 71 };

export function inCity(x: number, z: number) {
  return Math.hypot(x - CITY.x, z - CITY.z) < CITY_RADIUS + 60;
}

/** Where a city point is drawn on the overworld map (a small inset just north of the gate). */
export function mapXZ(x: number, z: number) {
  if (!inCity(x, z)) return { x, z };
  return { x: (x - CITY.x) * 0.3, z: -195 + (z - CITY.z) * 0.3 };
}

/** Organelle districts (offsets from the city centre; -z = north). */
export const DISTRICTS = [
  { id: 'ORG_NUCLEUS', codex: 'CDX_ORG_NUCLEUS', label: 'ย่านนิวเคลียส (ศาลากลาง)', x: 0, z: 0, r: 13, color: '#b490e0' },
  { id: 'ORG_MITO', codex: 'CDX_MITOCHONDRIA', label: 'ย่านไมโทคอนเดรีย (โรงไฟฟ้า)', x: 48, z: -6, r: 11, color: '#ff9a4a' },
  { id: 'ORG_RER', codex: 'CDX_ORG_RER', label: 'ร่างแหเอนโดพลาซึมแบบขรุขระ (โรงตีเหล็ก)', x: 32, z: -44, r: 9, color: '#7aa8e8' },
  { id: 'ORG_RIBOSOME', codex: 'CDX_ORG_RIBOSOME', label: 'ไรโบโซม (ครัวโปรตีน)', x: 12, z: -36, r: 4, color: '#3b5fb0' },
  { id: 'ORG_SER', codex: 'CDX_ORG_SER', label: 'ร่างแหเอนโดพลาซึมแบบเรียบ (โรงกลั่นไขมัน)', x: -14, z: -52, r: 9, color: '#f0a8c8' },
  { id: 'ORG_GOLGI', codex: 'CDX_ORG_GOLGI', label: 'กอลจิคอมเพล็กซ์ (ที่ทำการไปรษณีย์)', x: 34, z: 38, r: 8, color: '#f2c45a' },
  { id: 'ORG_LYSOSOME', codex: 'CDX_ORG_LYSOSOME', label: 'ไลโซโซม (ศูนย์รีไซเคิล)', x: 56, z: 22, r: 5, color: '#b8e05a' },
  { id: 'ORG_VACUOLE', codex: 'CDX_ORG_VACUOLE', label: 'แวคิวโอล (อ่างเก็บน้ำกลาง)', x: -32, z: 42, r: 11, color: '#7fd0f0' },
  { id: 'ORG_CHLORO', codex: 'CDX_CHLOROPLAST', label: 'คลอโรพลาสต์ (เรือนกระจก)', x: -50, z: 4, r: 9, color: '#6fcf5a' },
  { id: 'ORG_ACADEMY', codex: '', label: 'สถาบันเซลลาเรีย', x: -36, z: -34, r: 9, color: '#f1ead8' },
  { id: 'DOCK', codex: '', label: 'ลานเรือเหาะของสถาบัน', x: -46, z: -54, r: 5, color: '#9fe3f0' },
  { id: 'ORG_MEMBRANE', codex: 'CDX_ORG_MEMBRANE', label: 'เยื่อหุ้มเซลล์และผนังเซลล์ (กำแพงเมือง)', x: 0, z: 71, r: 6, color: '#cfe6ff' },
] as const;

/** Downloaded replacement models for each district (name, footprint in m, optional height cap for tall models). */
const CITY_PROPS: Record<string, [string, number, number?]> = {
  ORG_NUCLEUS: ['BLD_NucleusPalace', 30], ORG_MITO: ['BLD_MitoPlant', 21, 16], ORG_RER: ['BLD_RERForge', 16],
  ORG_RIBOSOME: ['BLD_RiboKitchen', 6], ORG_SER: ['BLD_SERRefinery', 14], ORG_GOLGI: ['BLD_GolgiPost', 14],
  ORG_LYSOSOME: ['BLD_LysosomeCenter', 9], ORG_VACUOLE: ['BLD_VacuoleReservoir', 21, 13], ORG_CHLORO: ['BLD_ChloroGreenhouse', 18],
  ORG_ACADEMY: ['BLD_Academy', 19],
};

export class City {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  private spin: THREE.Object3D[] = [];
  private pulse: THREE.Mesh[] = [];
  private t = 0;

  constructor() {
    this.root.position.set(CITY.x, 0, CITY.z);
    this.buildGround();
    this.buildWall();
    for (const d of DISTRICTS) {
      const g = new THREE.Group();
      g.position.set(d.x, 0, d.z);
      this.root.add(g);
      switch (d.id) {
        case 'ORG_NUCLEUS': this.nucleus(g); break;
        case 'ORG_MITO': this.mitochondria(g); break;
        case 'ORG_RER': this.roughER(g); break;
        case 'ORG_RIBOSOME': this.ribosomeKitchen(g); break;
        case 'ORG_SER': this.smoothER(g); break;
        case 'ORG_GOLGI': this.golgi(g); break;
        case 'ORG_LYSOSOME': this.lysosome(g); break;
        case 'ORG_VACUOLE': this.vacuole(g); break;
        case 'ORG_CHLORO': this.chloroplast(g); break;
        case 'ORG_ACADEMY': this.academy(g); break;
        case 'DOCK': this.dock(g); break;
        case 'ORG_MEMBRANE': break; // the wall itself
      }
      const prop = CITY_PROPS[d.id];
      if (prop) void propSlot(g, prop[0], { w: prop[1], h: prop[2] });
      if (d.codex) {
        const probe = new THREE.Object3D();
        probe.position.set(d.x, d.id === 'ORG_MEMBRANE' ? 6 : 4, d.z);
        this.root.add(probe);
        this.scannables.push({ id: d.id, codexId: d.codex, tags: ['organelle'], obj: probe, radius: d.r, label: d.label });
      }
    }
    this.buildDecor();
    this.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !o.userData.noShadow) { m.castShadow = true; m.receiveShadow = true; } });
  }

  /** collider in city-local coords */
  private col(x: number, z: number, r: number) { this.colliders.push({ x: CITY.x + x, z: CITY.z + z, r }); }

  update(dt: number) {
    this.t += dt;
    for (const o of this.spin) o.rotation.y += dt * (o.userData.spin ?? 0.4);
    for (const p of this.propellers) p.rotation.x += dt * 6;
    for (const m of this.pulse) {
      const mat = m.material as THREE.MeshToonMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(this.t * 2 + m.id) * 0.35;
    }
  }

  // ---------------------------------------------------------------- ground / wall / dome
  private buildGround() {
    const S = 1024, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d')!;
    const R = 90; // texture covers ±R metres
    const P = (m: number) => (m / R) * (S / 2) + S / 2;
    const L = (m: number) => (m / R) * (S / 2);
    g.fillStyle = '#9cc46a'; g.fillRect(0, 0, S, S);
    // grass variation
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(120,170,80,.35)' : 'rgba(190,210,110,.3)';
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 4 + Math.random() * 14, 0, Math.PI * 2); g.fill();
    }
    // canals (cytoplasm streaming) and ring roads
    const ring = (r: number, w: number, c: string) => { g.strokeStyle = c; g.lineWidth = L(w); g.beginPath(); g.arc(P(0), P(0), L(r), 0, Math.PI * 2); g.stroke(); };
    ring(66, 5, '#e6dcc2');
    ring(58, 2.4, '#6fc4e8');
    ring(26, 6, '#e6dcc2');
    ring(20, 1.6, '#6fc4e8');
    // radial avenues to each district
    g.strokeStyle = '#e6dcc2'; g.lineCap = 'round';
    for (const d of DISTRICTS) {
      if (d.id === 'ORG_NUCLEUS') continue;
      g.lineWidth = L(d.id === 'ORG_MEMBRANE' ? 7 : 4);
      g.beginPath(); g.moveTo(P(0), P(0)); g.lineTo(P(d.x), P(d.z)); g.stroke();
    }
    // district plazas
    for (const d of DISTRICTS) {
      g.fillStyle = '#efe6cf';
      g.beginPath(); g.arc(P(d.x), P(d.z), L(d.r + 5), 0, Math.PI * 2); g.fill();
      g.strokeStyle = d.color; g.lineWidth = L(0.8);
      g.beginPath(); g.arc(P(d.x), P(d.z), L(d.r + 4.6), 0, Math.PI * 2); g.stroke();
    }
    // hexagon tiles on the central plaza
    g.strokeStyle = 'rgba(160,140,100,.35)'; g.lineWidth = 2;
    for (let y = -30; y <= 30; y += 3) for (let x = -30; x <= 30; x += 3.4) {
      const hx = x + ((Math.round(y / 3) % 2) ? 1.7 : 0);
      if (Math.hypot(hx, y) > 30) continue;
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(P(hx + Math.cos(a) * 1.6), P(y + Math.sin(a) * 1.6)); }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshToonMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.userData.noShadow = true;
    ground.receiveShadow = true;
    this.root.add(ground);
    // countryside beyond the wall (hidden mostly by fog)
    const outside = new THREE.Mesh(new THREE.RingGeometry(R - 1, 420, 48), toon('#86ad58'));
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -0.05;
    outside.userData.noShadow = true;
    this.root.add(outside);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = 180 + Math.random() * 90;
      const hgt = 40 + Math.random() * 60;
      const m = new THREE.Mesh(new THREE.ConeGeometry(30 + Math.random() * 30, hgt, 6), toon(i % 3 ? '#9a8c7a' : '#a99a86'));
      m.position.set(Math.cos(a) * r, hgt / 2 - 4, Math.sin(a) * r);
      m.userData.noShadow = true;
      this.root.add(m);
    }
  }

  private buildWall() {
    const stone = toon('#e9e0c8');
    const gold = toon('#e8c468');
    const W = new THREE.Group();
    const R = CITY_RADIUS + 3, n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const gap = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.07; // south gate opening
      if (gap) continue;
      const seg = new THREE.Mesh(new THREE.BoxGeometry((2 * Math.PI * R) / n + 0.4, 7, 2.2), stone);
      seg.position.set(Math.cos(a) * R, 3.5, Math.sin(a) * R);
      seg.rotation.y = -a + Math.PI / 2;
      W.add(seg);
      if (i % 5 === 0) {
        const tw = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.4, 11, 6), stone);
        tw.position.set(Math.cos(a) * R, 5.5, Math.sin(a) * R);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 6), gold);
        cap.position.set(Math.cos(a) * R, 12.5, Math.sin(a) * R);
        W.add(tw, cap);
      }
    }
    // south gate (the membrane "channel")
    const gz = CITY_RADIUS + 3;
    for (const sx of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 14, 6), stone);
      tw.position.set(sx * 7, 7, gz);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 6), gold);
      cap.position.set(sx * 7, 16, gz);
      W.add(tw, cap);
      this.col(sx * 7, gz, 3);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(6, 0.8, 8, 12, Math.PI), gold);
    arch.position.set(0, 9, gz);
    W.add(arch);
    const film = new THREE.Mesh(new THREE.CircleGeometry(5.6, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xa6f0ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    film.position.set(0, 9, gz);
    film.userData.noOutline = true;
    W.add(film);
    // lipid-bilayer trim along the inner face (two rows of "heads")
    const headMat = toon('#ffd9a8');
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 4), headMat, 2 * 160);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      for (const y of [6.2, 7.3]) {
        m4.setPosition(Math.cos(a) * (R - 1.2), y, Math.sin(a) * (R - 1.2));
        heads.setMatrixAt(k++, m4);
      }
    }
    heads.userData.noOutline = true;
    W.add(heads);
    addOutline(W, 0.05);
    this.root.add(W);
    // colliders along the ring (gate gap left open)
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.06) continue;
      this.col(Math.cos(a) * R, Math.sin(a) * R, 2.3);
    }
    // the cell membrane dome
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(R + 18, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshToonMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    );
    dome.userData.noOutline = true;
    dome.userData.noShadow = true;
    dome.scale.y = 0.55;
    this.root.add(dome);
  }

  // ---------------------------------------------------------------- districts
  private nucleus(g: THREE.Group) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 1.4, 6), toon('#efe6cf'));
    base.position.y = 0.7;
    const steps = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 12.5, 1, 6), toon('#e2d6b8'));
    steps.position.y = 1.9;
    g.add(base, steps);
    // nuclear envelope (double membrane with pores)
    const outer = new THREE.Mesh(new THREE.SphereGeometry(9.4, 32, 20), new THREE.MeshToonMaterial({ color: 0xc8a8f0, transparent: true, opacity: 0.38, depthWrite: false }));
    outer.position.y = 11.5;
    outer.userData.noOutline = true;
    const inner = new THREE.Mesh(new THREE.SphereGeometry(8.6, 32, 20), new THREE.MeshToonMaterial({ color: 0x9d78d8, transparent: true, opacity: 0.5, emissive: 0x4a2a80, emissiveIntensity: 0.6 }));
    inner.position.y = 11.5;
    inner.userData.noOutline = true;
    const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(3.2, 20, 14), new THREE.MeshToonMaterial({ color: 0x6a3fb0, emissive: 0x8a50ff, emissiveIntensity: 0.8 }));
    nucleolus.position.set(1.5, 11, 1);
    this.pulse.push(nucleolus);
    // chromatin threads
    const chromo = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 9; k++) pts.push(new THREE.Vector3((Math.random() - 0.5) * 11, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 11));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.12, 5), glow('#e0b8ff', 1.2));
      tube.userData.noOutline = true;
      chromo.add(tube);
    }
    chromo.position.y = 11.5;
    chromo.userData.spin = 0.15;
    this.spin.push(chromo);
    // pores
    const poreMat = toon('#e8c468');
    for (let i = 0; i < 26; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < -0.4) v.y = -v.y;
      const pore = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 6, 10), poreMat);
      pore.position.copy(v.clone().multiplyScalar(9.4)).add(new THREE.Vector3(0, 11.5, 0));
      pore.lookAt(pore.position.clone().add(v));
      g.add(pore);
    }
    // golden crown + four arch gates
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 6), toon('#e8c468'));
    crown.position.y = 23;
    g.add(outer, inner, nucleolus, chromo, crown);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 9, 8), toon('#f4efe2'));
      pillar.position.set(Math.cos(a) * 11, 6.5, Math.sin(a) * 11);
      g.add(pillar);
    }
    this.col(g.position.x, g.position.z, 13.5);
  }

  private mitochondria(g: THREE.Group) {
    const shell = new THREE.MeshToonMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.55, depthWrite: false });
    const fold = new THREE.MeshToonMaterial({ color: 0xffd36a, emissive: 0xff7a1a, emissiveIntensity: 0.6 });
    for (const [ox, oz, ry] of [[-3, -5, 0.2], [4, 5, -0.25]] as const) {
      const cap = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.CapsuleGeometry(3.6, 9, 8, 16), shell);
      outer.rotation.z = Math.PI / 2;
      outer.position.y = 3.8;
      outer.userData.noOutline = true;
      cap.add(outer);
      // cristae: folded inner membrane plates
      for (let i = 0; i < 7; i++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.6, 5.4), fold);
        plate.position.set(-5 + i * 1.65, 3.8 + (i % 2 ? 0.8 : -0.8), 0);
        cap.add(plate);
        this.pulse.push(plate);
      }
      cap.position.set(ox, 0, oz);
      cap.rotation.y = ry;
      g.add(cap);
      this.col(g.position.x + ox, g.position.z + oz, 5.5);
    }
    // power pylons with floating ATP orbs
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7, 6), toon('#cfd5e2'));
      p.position.set(9, 3.5, -6 + i * 6);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), glow('#ffe08a', 1.6));
      orb.position.set(9, 8, -6 + i * 6);
      orb.userData.noOutline = true;
      orb.userData.spin = 1.5;
      this.spin.push(orb);
      g.add(p, orb);
    }
  }

  private roughER(g: THREE.Group) {
    const sheet = toon('#9cc0f0');
    const dot = new THREE.MeshToonMaterial({ color: 0x2c4a9a });
    const ribos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 4), dot, 7 * 40);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < 7; i++) {
      // stacked, folded cisternae
      const shape = new THREE.Shape();
      shape.moveTo(-7, 0);
      for (let x = -7; x <= 7; x += 0.5) shape.lineTo(x, Math.sin(x * 0.9 + i) * 0.8);
      for (let x = 7; x >= -7; x -= 0.5) shape.lineTo(x, Math.sin(x * 0.9 + i) * 0.8 + 0.6);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false });
      geo.translate(0, 0, -2.5);
      const m = new THREE.Mesh(geo, sheet);
      m.position.y = 0.6 + i * 1.2;
      g.add(m);
      for (let j = 0; j < 40; j++) {
        const x = -6.8 + (j % 20) * 0.7, z = j < 20 ? 2.55 : -2.55;
        m4.setPosition(x, 0.6 + i * 1.2 + Math.sin(x * 0.9 + i) * 0.8 + 0.3, z);
        ribos.setMatrixAt(k++, m4);
      }
    }
    ribos.userData.noOutline = true;
    g.add(ribos);
    // forge: anvil + fire
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.8), toon('#5a5f70'));
    anvil.position.set(0, 0.45, 5.2);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 6), glow('#ff8a3a', 2));
    fire.position.set(2.4, 0.7, 5.2);
    fire.userData.noOutline = true;
    g.add(anvil, fire);
    this.col(g.position.x, g.position.z, 7.5);
  }

  private ribosomeKitchen(g: THREE.Group) {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.6), toon('#c89a6a'));
    counter.position.y = 0.55;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 2.6), toon('#e8553a'));
    awning.position.set(0, 3.2, -0.3);
    awning.rotation.x = 0.15;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), toon('#8a6243'));
      post.position.set(sx * 2.5, 1.6, 0.6);
      g.add(post);
    }
    // the giant ribosome sign: large + small subunit reading an mRNA ribbon
    const sign = new THREE.Group();
    const big = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), toon('#3b5fb0'));
    big.scale.set(1.2, 0.9, 1);
    const small = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), toon('#6f8fe0'));
    small.position.set(0, 1.05, 0);
    small.scale.set(1.3, 0.7, 1);
    const mrna = new THREE.Mesh(new THREE.TorusGeometry(2, 0.07, 4, 32, Math.PI * 1.2), toon('#e8c468'));
    mrna.rotation.z = Math.PI * 0.4;
    mrna.position.y = 0.6;
    sign.add(big, small, mrna);
    sign.position.set(0, 5.3, 0);
    sign.userData.spin = 0.5;
    this.spin.push(sign);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.7, 10), toon('#5a5f70'));
    pot.position.set(-1.4, 1.45, 0);
    g.add(counter, awning, sign, pot);
    // amino-acid "beads" on the counter
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), toon(['#e8553a', '#6fcf5a', '#f2c45a', '#7aa8e8'][i % 4]));
      b.position.set(0.4 + i * 0.3, 1.25, 0.2);
      g.add(b);
    }
    this.col(g.position.x, g.position.z, 2.8);
  }

  private smoothER(g: THREE.Group) {
    const mat = toon('#f6bcd6');
    for (let i = 0; i < 6; i++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 7; k++) pts.push(new THREE.Vector3(Math.sin(k * 1.3 + i) * 6, 0.8 + k * 1.1 + Math.sin(i) * 0.5, Math.cos(k * 0.9 + i * 2) * 5));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.55, 8), mat);
      g.add(tube);
    }
    // stored lipid droplets
    for (let i = 0; i < 6; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 12, 8), new THREE.MeshToonMaterial({ color: 0xffe07a, transparent: true, opacity: 0.85 }));
      drop.position.set((Math.random() - 0.5) * 9, 0.6, 5.5 + Math.random());
      g.add(drop);
    }
    this.col(g.position.x, g.position.z, 7);
  }

  private golgi(g: THREE.Group) {
    const mats = ['#f6d27a', '#f2c45a', '#ecb440', '#e6a52c', '#dc9520'].map((c) => toon(c));
    for (let i = 0; i < 5; i++) {
      // curved, flattened cisternae stacked like pancakes
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(6 - i * 0.6, 6 - i * 0.6, 0.7, 24, 1, false, -1.2, 2.4 + i * 0.1), mats[i]);
      disc.position.set(0, 0.6 + i * 1.15, -i * 0.5);
      disc.rotation.y = Math.PI;
      g.add(disc);
    }
    // vesicles budding off
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshToonMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.85 }));
      const a = -0.9 + i * 0.25;
      v.position.set(Math.sin(a) * 7.5, 2 + (i % 3), Math.cos(a) * -7.5 + 3);
      g.add(v);
    }
    // parcels at the post office counter
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), toon(i % 2 ? '#c89a6a' : '#e0b88a'));
      p.position.set(-2 + i * 0.9, 0.25 + (i % 2) * 0.5, 4.5);
      g.add(p);
    }
    this.col(g.position.x, g.position.z, 6);
  }

  private lysosome(g: THREE.Group) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), new THREE.MeshToonMaterial({ color: 0xc8e86a, transparent: true, opacity: 0.6, depthWrite: false }));
    ball.position.y = 4.2;
    ball.userData.noOutline = true;
    const core = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const enz = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), toon('#6a9a2a'));
      enz.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(2.6));
      core.add(enz);
    }
    core.position.y = 4.2;
    core.userData.spin = 0.6;
    this.spin.push(core);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.8, 8), toon('#d9cfb6'));
    base.position.y = 0.4;
    g.add(ball, core, base);
    for (let i = 0; i < 3; i++) {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.1, 8), toon(['#e8553a', '#3a8ad8', '#6fcf5a'][i]));
      bin.position.set(-1.5 + i * 1.5, 0.55, 4.6);
      g.add(bin);
    }
    this.col(g.position.x, g.position.z, 4.5);
  }

  private vacuole(g: THREE.Group) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(10, 0.9, 8, 40), toon('#e9e0c8'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.9;
    const water = new THREE.Mesh(new THREE.CircleGeometry(10, 40), new THREE.MeshToonMaterial({ color: 0x6fc4e8, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.7;
    water.userData.noOutline = true;
    // tonoplast: the vacuole's own membrane as a low glassy dome
    const tono = new THREE.Mesh(new THREE.SphereGeometry(10.2, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.18, depthWrite: false }));
    tono.scale.y = 0.35;
    tono.position.y = 0.8;
    tono.userData.noOutline = true;
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.2, 3, 8), glow('#bff0ff', 1.2));
    fountain.position.y = 2;
    fountain.userData.noOutline = true;
    g.add(rim, water, tono, fountain);
    this.col(g.position.x, g.position.z, 10.5);
  }

  private chloroplast(g: THREE.Group) {
    const glass = new THREE.Mesh(new THREE.SphereGeometry(7, 28, 16), new THREE.MeshToonMaterial({ color: 0xaef0a0, transparent: true, opacity: 0.3, depthWrite: false }));
    glass.scale.set(1.25, 0.6, 0.9);
    glass.position.y = 3.6;
    glass.userData.noOutline = true;
    g.add(glass);
    // grana: stacks of thylakoid discs, linked by stroma lamellae
    const thyl = new THREE.MeshToonMaterial({ color: 0x3fa83a, emissive: 0x1f6a1a, emissiveIntensity: 0.4 });
    for (let s = 0; s < 5; s++) {
      const x = -5 + s * 2.5, z = (s % 2 ? 1.2 : -1.2);
      for (let k = 0; k < 6; k++) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.28, 14), thyl);
        disc.position.set(x, 1.2 + k * 0.42, z);
        g.add(disc);
      }
      if (s < 4) {
        const lam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.4), thyl);
        lam.position.set(x + 1.25, 2.2, 0);
        lam.rotation.y = s % 2 ? 0.7 : -0.7;
        g.add(lam);
      }
    }
    for (let i = 0; i < 8; i++) {
      const plant = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), toon('#5fbf4a'));
      plant.position.set(-7 + i * 2, 0.7, 5.6);
      g.add(plant);
    }
    this.col(g.position.x, g.position.z, 8);
  }

  private academy(g: THREE.Group) {
    const white = toon('#f4efe2');
    const gold = toon('#e8c468');
    const win = new THREE.MeshToonMaterial({ color: 0x8fd0ff, emissive: 0x3a7ac0, emissiveIntensity: 0.5 });
    const towers: [number, number, number][] = [[0, -2, 18], [-6, 3, 12], [6, 3, 12]];
    for (const [x, z, hgt] of towers) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, hgt, 6), white);
      t.position.set(x, hgt / 2, z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3.2, 4.5, 6), gold);
      cap.position.set(x, hgt + 2.2, z);
      g.add(t, cap);
      for (let k = 1; k < hgt / 3; k++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 6), win);
        w.rotation.x = Math.PI / 2;
        w.position.set(x, k * 3, z + 2.65);
        g.add(w);
      }
      this.col(g.position.x + x, g.position.z + z, 3.3);
    }
    const hall = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 5), white);
    hall.position.set(0, 3, 0.5);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.6, 5.6), gold);
    roof.position.set(0, 6.3, 0.5);
    g.add(hall, roof);
    for (let i = -2; i <= 2; i++) this.col(g.position.x + i * 3.2, g.position.z + 0.5, 2.8);
    // microscope statue
    const ms = new THREE.Group();
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.8), toon('#e8c468'));
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.5), toon('#e8c468'));
    arm.position.set(0, 1.3, -0.5);
    arm.rotation.x = 0.3;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.8, 10), toon('#cfd5e2'));
    tube.position.set(0, 2.4, 0.1);
    tube.rotation.x = -0.4;
    ms.add(foot, arm, tube);
    ms.scale.setScalar(1.3);
    ms.position.set(0, 0.2, 7);
    g.add(ms);
  }

  private dock(g: THREE.Group) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.8, 8), toon('#d9d2c4'));
    pad.position.y = 0.4;
    const ship = buildAirship();
    ship.position.y = 0.6;
    ship.rotation.y = 0.6;
    g.add(pad, ship);
    void propSlot(ship, 'PRP_Airship', { w: 11 });
    for (const c of ship.children) if (c.userData.spin) this.propellers.push(c);
    addOutline(g, 0.04);
    this.col(g.position.x, g.position.z, 4.5);
  }
  private propellers: THREE.Object3D[] = [];

  // ---------------------------------------------------------------- decor
  private buildDecor() {
    const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const free = (x: number, z: number) => {
      if (Math.hypot(x, z) > CITY_RADIUS - 4 || Math.hypot(x, z) < 18) return false;
      for (const d of DISTRICTS) if (Math.hypot(x - d.x, z - d.z) < d.r + 7) return false;
      if (Math.abs(x) < 6 && z > 20) return false; // main avenue
      return true;
    };
    // park trees: the downloaded painted trees (instanced) — smaller than out in the valley, it is a city
    const spots: FloraSpot[] = [];
    let placed = 0;
    for (let i = 0; i < 400 && placed < 70; i++) {
      const a = rand() * Math.PI * 2, r = 20 + rand() * 54;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!free(x, z)) continue;
      spots.push({ x, y: -0.1, z, rot: rand() * 6.28, scale: 4.5 + rand() * 2 });
      this.col(x, z, 0.5);
      placed++;
    }
    if (hasFlora(PAINTED_TREES.file) && spots.length) this.root.add(plantFlora({ ...PAINTED_TREES, foliage: ['#5fb05a', '#c8e07a'] }, spots, rand));
    // lamp posts along the main avenue (the stylized street light model; the bulb keeps glowing)
    for (let z = 28; z < 70; z += 8) for (const sx of [-1, 1]) {
      const lamp = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), toon('#5a6278'));
      post.position.y = 1.6;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glow('#fff2b0', 1.5));
      bulb.position.y = 3.3;
      bulb.userData.noOutline = true;
      bulb.userData.keep = true;
      lamp.add(post, bulb);
      lamp.position.set(sx * 4.2, 0, z);
      this.root.add(lamp);
      void propSlot(lamp, 'PRP_CanalLamp', { h: 3.4, yaw: sx > 0 ? Math.PI : 0 });
    }
    // plaza fountain-statue of a dividing cell (foreshadows chapter 1)
    const f = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 16), toon('#e9e0c8'));
    basin.position.y = 0.4;
    const w = new THREE.Mesh(new THREE.CircleGeometry(2.9, 16), new THREE.MeshToonMaterial({ color: 0x7fd0f0 }));
    w.rotation.x = -Math.PI / 2;
    w.position.y = 0.82;
    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), toon('#cfe6ff'));
    c1.position.set(-0.75, 2.6, 0);
    const c2 = c1.clone();
    c2.position.x = 0.75;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.8, 8), toon('#e9e0c8'));
    ped.position.y = 1.2;
    f.add(basin, w, ped, c1, c2);
    f.position.set(0, 0, 40);
    this.root.add(f);
    void propSlot(f, 'PRP_CityFountain', { w: 7 });
    this.col(0, 40, 3.4);
  }
}
