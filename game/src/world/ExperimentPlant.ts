import * as THREE from 'three';
import { toon, toonGradient } from './Materials';
import { WIND } from './Nature';

/**
 * Plants for the watering experiment, built to read clearly as *wilted* vs *healthy*:
 * a jointed stem (curved segments, each a child of the one below, so bending them curls the whole stem), pairs of
 * shaped leaves with a midrib, and a sunflower-like head. One `health` value 0 (wilted) … 1 (healthy) drives
 * everything: stem droop, leaf angle and curl, colours (olive-brown → fresh green) and the flower opening.
 * `setTarget(1)` makes the plant recover smoothly; it also sways with the meadow wind.
 */
const SEGS = 6;

let leafGeo: THREE.BufferGeometry | null = null;
/** Pointed oval leaf, 1 long, lying along +Z with a slight cup, a midrib crease and a drooping tip. */
function leafGeometry() {
  if (leafGeo) return leafGeo;
  const g = new THREE.PlaneGeometry(0.42, 1, 4, 8);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, 0.5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const t = z; // 0 at the stalk, 1 at the tip
    const w = Math.sin(Math.PI * Math.min(1, t * 1.08)) * (1 - t * 0.35); // oval, pointed tip
    const nx = x / 0.21 * w * 0.21;
    p.setX(i, nx);
    p.setY(i, Math.abs(nx) * 0.35 - t * t * 0.12); // cupped edges, tip curving down a little
  }
  g.computeVertexNormals();
  leafGeo = g;
  return g;
}

interface Leaf { pivot: THREE.Object3D; side: number; level: number }

export class ExperimentPlant {
  readonly group = new THREE.Group();
  private segs: THREE.Object3D[] = [];
  private leaves: Leaf[] = [];
  private head: THREE.Group;
  private petals: THREE.Mesh[] = [];
  private stemMat: THREE.MeshToonMaterial;
  private leafMat: THREE.MeshToonMaterial;
  private petalMat: THREE.MeshToonMaterial;
  health = 0;
  private target = 0;
  private phase = Math.random() * 10;

  constructor(height = 1.25, private lean = (Math.random() - 0.5) * 0.4) {
    this.stemMat = new THREE.MeshToonMaterial({ color: '#8f8a4a', gradientMap: toonGradient() });
    this.leafMat = new THREE.MeshToonMaterial({ color: '#a38f4a', gradientMap: toonGradient(), side: THREE.DoubleSide });
    this.petalMat = new THREE.MeshToonMaterial({ color: '#c9a640', gradientMap: toonGradient(), side: THREE.DoubleSide });
    const segH = height / SEGS;
    let parent: THREE.Object3D = this.group;
    for (let i = 0; i < SEGS; i++) {
      const joint = new THREE.Group();
      joint.position.y = i === 0 ? 0 : segH;
      const r0 = 0.045 * (1 - i / SEGS * 0.6), r1 = 0.045 * (1 - (i + 1) / SEGS * 0.6);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, segH, 6), this.stemMat);
      m.position.y = segH / 2;
      m.castShadow = true;
      joint.add(m);
      parent.add(joint);
      this.segs.push(joint);
      // a pair of leaves at each middle node, each pair turned 90° from the one below
      if (i >= 1 && i < SEGS - 1) {
        for (const side of [-1, 1]) {
          const pivot = new THREE.Group();
          pivot.position.y = segH * 0.9;
          pivot.rotation.y = side * Math.PI / 2 + i * Math.PI / 2;
          const leaf = new THREE.Mesh(leafGeometry(), this.leafMat);
          const s = 0.42 + (1 - i / SEGS) * 0.25;
          leaf.scale.setScalar(s);
          leaf.userData.noOutline = true;
          leaf.castShadow = true;
          pivot.add(leaf);
          joint.add(pivot);
          this.leaves.push({ pivot, side, level: i });
        }
      }
      parent = joint;
    }
    // flower head on the top joint: a dark seed disc and a ring of petals that open with health
    this.head = new THREE.Group();
    this.head.position.y = segH;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.06, 12), toon('#5a3a1e'));
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.03;
    this.head.add(disc);
    const petalGeo = new THREE.PlaneGeometry(0.07, 0.17);
    petalGeo.translate(0, 0.085, 0);
    for (let k = 0; k < 12; k++) {
      const pv = new THREE.Group();
      pv.rotation.z = (k / 12) * Math.PI * 2;
      const pm = new THREE.Mesh(petalGeo, this.petalMat);
      pm.position.y = 0.08;
      pm.userData.noOutline = true;
      pv.add(pm);
      this.head.add(pv);
      this.petals.push(pm);
    }
    parent.add(this.head);
    this.apply(0);
  }

  /** Grow toward `h` (0 wilted … 1 healthy); `instant` skips the animation. */
  setTarget(h: number, instant = false) {
    this.target = h;
    if (instant) { this.health = h; this.apply(0); }
  }

  update(dt: number) {
    if (this.health !== this.target) {
      const d = this.target - this.health;
      this.health += Math.sign(d) * Math.min(Math.abs(d), dt * 0.45); // ~2 s to fully recover
    }
    this.apply(dt);
  }

  private apply(dt: number) {
    const h = this.health, w = 1 - h;
    this.phase += dt;
    const sway = Math.sin(WIND.time.value * 1.7 + this.phase) * (0.03 + h * 0.03);
    // wilted: the stem arcs over from low down (more bend near the top), healthy: nearly straight
    this.segs.forEach((s, i) => {
      const k = i / (SEGS - 1);
      s.rotation.x = w * (0.08 + k * 0.42) + sway * (0.5 + k);
      s.rotation.z = i === 0 ? this.lean * (0.3 + w) : 0;
    });
    // leaves: healthy reach up and out, wilted hang limp against the stem
    for (const l of this.leaves) {
      l.pivot.rotation.x = THREE.MathUtils.lerp(-0.55 + l.level * 0.04, 1.35, w) + Math.sin(WIND.time.value * 2.3 + l.level + this.phase) * 0.05;
    }
    // flower: closed, hanging bud when wilted → open, facing outward when healthy
    const open = THREE.MathUtils.smoothstep(h, 0.45, 1);
    this.head.rotation.x = THREE.MathUtils.lerp(-0.25, 1.2, w);
    this.head.scale.setScalar(0.55 + open * 0.55);
    this.petals.forEach((p) => { p.rotation.x = THREE.MathUtils.lerp(1.3, 0.15, open); });
    // colours
    // (linear RGB) wilted: dry olive-brown · healthy: deep fresh green, golden petals
    this.stemMat.color.setRGB(0.3 - h * 0.2, 0.24 + h * 0.08, 0.06 - h * 0.03);
    this.leafMat.color.setRGB(0.36 - h * 0.28, 0.27 + h * 0.13, 0.05 - h * 0.02);
    this.petalMat.color.setRGB(0.5 + h * 0.5, 0.36 + h * 0.3, 0.06 - h * 0.04);
  }
}

/** Wooden planter of `w` × `d` metres: plank walls, lumpy soil, a little sign with the plot number. */
export function planterBox(w: number, d: number, label: string): THREE.Group {
  const g = new THREE.Group();
  const wood = toon('#9a7148'), woodDark = toon('#7a5634');
  const plank = (len: number, alongX: boolean, x: number, z: number, y: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.12, 0.2, alongX ? 0.12 : len), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  for (const [y, mat] of [[0.11, woodDark], [0.32, wood]] as const) {
    plank(w + 0.12, true, 0, d / 2, y, mat);
    plank(w + 0.12, true, 0, -d / 2, y, mat);
    plank(d, false, w / 2, 0, y, mat);
    plank(d, false, -w / 2, 0, y, mat);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), woodDark);
    post.position.set(sx * w / 2, 0.26, sz * d / 2);
    g.add(post);
  }
  // soil: a slightly domed, bumpy surface
  const soilGeo = new THREE.PlaneGeometry(w - 0.1, d - 0.1, 12, 8);
  soilGeo.rotateX(-Math.PI / 2);
  const sp = soilGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), z = sp.getZ(i);
    const dome = (1 - (x / (w / 2)) ** 2) * (1 - (z / (d / 2)) ** 2);
    sp.setY(i, 0.36 + dome * 0.06 + (Math.sin(x * 9 + z * 5) * Math.cos(z * 11 - x * 3)) * 0.015);
  }
  soilGeo.computeVertexNormals();
  const soil = new THREE.Mesh(soilGeo, toon('#5e4129'));
  soil.receiveShadow = true;
  soil.userData.noOutline = true;
  g.add(soil);
  // clods
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05 + (i % 3) * 0.02, 0), toon('#4d3420'));
    c.position.set((((i * 37) % 10) / 10 - 0.5) * (w - 0.4), 0.39, (((i * 53) % 10) / 10 - 0.5) * (d - 0.4));
    c.userData.noOutline = true;
    g.add(c);
  }
  // sign: a little stake with the plot number
  const stake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), woodDark);
  stake.position.set(-w / 2 + 0.25, 0.6, d / 2 - 0.02);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.03), toon('#e9d9b0'));
  board.position.set(-w / 2 + 0.25, 0.86, d / 2 + 0.01);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e9d9b0'; x.fillRect(0, 0, 128, 80);
  x.fillStyle = '#4a3220'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(label, 64, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.set(-w / 2 + 0.25, 0.86, d / 2 + 0.03);
  face.userData.noOutline = true;
  g.add(stake, board, face);
  return g;
}
