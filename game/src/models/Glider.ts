import * as THREE from 'three';
import { hasModel, loadGLB } from './ModelLibrary';

/** Ready-made feathered wings (Sketchfab "Angel wings", tools/model_picks.json WG-02); the painted samara pair is the fallback. */
const MODEL = 'props/PRP_Glider.glb';
const SPAN = 2.7;    // tip-to-tip when open (m)
const TILT = -0.95;  // lean the (upright) wing pair back so it spreads like a glider over the shoulders

/** Left/right halves of the wing model, baked into the pair's own frame with the wing roots at the origin. */
let halves: Promise<{ geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[] | null> | null = null;
function loadHalves() {
  halves ??= loadGLB(MODEL).then((obj) => {
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    let mesh: THREE.Mesh | null = null;
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh; });
    if (!mesh) return null;
    const m = mesh as THREE.Mesh;
    const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    const k = SPAN / (b.max.x - b.min.x);
    // wing roots: the middle of the back edge, a little above the bottom
    geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + (b.max.y - b.min.y) * 0.3), -b.max.z);
    geo.scale(k, k, k);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const index = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i);
    const sides: number[][] = [[], []];
    for (let t = 0; t < index.length / 3; t++) {
      const cx = pos.getX(index[t * 3]) + pos.getX(index[t * 3 + 1]) + pos.getX(index[t * 3 + 2]);
      sides[cx < 0 ? 0 : 1].push(index[t * 3], index[t * 3 + 1], index[t * 3 + 2]);
    }
    // toon-shaded like the rest of the game (the file's PBR material reads dark grey without an environment map);
    // crisp feather cut-outs instead of blended transparency (no sorting trouble)
    const mat = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => new THREE.MeshToonMaterial({
      map: (x as THREE.MeshStandardMaterial).map, color: (x as THREE.MeshStandardMaterial).color, alphaTest: 0.45, side: THREE.DoubleSide,
    }));
    return sides.map((idx) => {
      const g = new THREE.BufferGeometry();
      for (const [n, a] of Object.entries(geo.attributes)) g.setAttribute(n, a);
      g.setIndex(idx);
      g.computeBoundingSphere();
      return { geo: g, mat: mat.length === 1 ? mat[0] : mat };
    });
  });
  return halves;
}

/**
 * The "samara wings" glider (fallback): a pair of maple-seed wings (a real double samara is two winged seeds joined at the
 * nut) worn on the back. Each wing is a gently curved card with a painted texture — the seed, the thick leading
 * vein and the fine veins fanning out across a thin, slightly see-through membrane — and it unfolds from the
 * back when gliding starts and folds away when it ends.
 */

const LEN = 1.25;   // wing length (m)

let wingMat: THREE.MeshStandardMaterial | null = null;
let wingGeo: THREE.BufferGeometry | null = null;

/** Paint one samara wing (root/seed on the left, tip on the right) — returns colour+alpha in one texture. */
function paintWing(): THREE.CanvasTexture {
  const W = 1024, H = 400;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  // outline: straight-ish leading edge on top, the trailing edge bellies out toward the tip, rounded tip
  const outline = new Path2D();
  outline.moveTo(70, 205);
  outline.bezierCurveTo(220, 120, 520, 60, 820, 58);    // leading edge
  outline.bezierCurveTo(960, 58, 1012, 120, 990, 190);  // rounded tip
  outline.bezierCurveTo(960, 300, 760, 352, 520, 330);  // trailing edge
  outline.bezierCurveTo(330, 312, 190, 270, 70, 205);
  g.save();
  g.clip(outline);
  // membrane: warm reddish-brown near the seed fading to pale gold at the tip
  const grad = g.createLinearGradient(70, 0, 1000, 0);
  grad.addColorStop(0, 'rgba(150,82,52,0.97)');
  grad.addColorStop(0.25, 'rgba(196,128,78,0.92)');
  grad.addColorStop(0.6, 'rgba(226,186,118,0.84)');
  grad.addColorStop(1, 'rgba(238,212,150,0.8)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // darker rim along the trailing edge
  g.lineWidth = 26;
  g.strokeStyle = 'rgba(140,84,48,0.35)';
  g.stroke(outline);
  // fine veins fanning from the leading edge toward the trailing edge
  for (let i = 0; i < 46; i++) {
    const t = i / 45;
    const x0 = 140 + t * 760, y0 = 200 - 140 * Math.sin(Math.min(1, t * 1.6) * 1.2) * (0.6 + 0.4 * t);
    const x1 = x0 + 120 + 60 * t, y1 = 330 - 30 * t;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + 40, (y0 + y1) / 2 + 10, x1, y1);
    g.lineWidth = 1.6 + (i % 3 === 0 ? 1.4 : 0);
    g.strokeStyle = `rgba(120,70,40,${0.28 + (i % 3 === 0 ? 0.18 : 0)})`;
    g.stroke();
  }
  // a few cross veins and a faint mottling so the membrane doesn't read as flat plastic
  for (let i = 0; i < 900; i++) {
    const x = 120 + Math.random() * 880, y = 60 + Math.random() * 280;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,236,190' : '120,70,40'},${0.04 + Math.random() * 0.05})`;
    g.fillRect(x, y, 2 + Math.random() * 6, 1 + Math.random() * 3);
  }
  g.restore();
  // thick leading vein (the samara's strong upper edge)
  g.beginPath();
  g.moveTo(80, 200);
  g.bezierCurveTo(220, 120, 520, 62, 820, 62);
  g.bezierCurveTo(920, 62, 975, 92, 985, 140);
  g.lineCap = 'round';
  g.lineWidth = 16;
  g.strokeStyle = 'rgba(112,58,34,1)';
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(200,140,90,0.8)';
  g.stroke();
  // the seed (nutlet) at the root: a plump veined oval
  const nut = g.createRadialGradient(110, 215, 8, 120, 215, 92);
  nut.addColorStop(0, '#c98a5a');
  nut.addColorStop(0.6, '#8f5232');
  nut.addColorStop(1, '#5e321e');
  g.fillStyle = nut;
  g.beginPath();
  g.ellipse(125, 212, 98, 66, -0.25, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(60,30,18,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.ellipse(125, 212, 80 - i * 12, 52 - i * 8, -0.25, -1.2, 1.4);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A thin card curved like a real samara wing: cupped across, slightly arched along its length. */
function wingGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(LEN, LEN * (400 / 1024), 24, 8);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + LEN / 2;          // 0 at the seed → LEN at the tip
    const y = p.getY(i);
    const u = x / LEN;
    // arch along the length + cup across the width + a little twist toward the tip
    // (negative = up once the card is laid flat: the wing arches like a canopy)
    const z = -(0.1 * Math.sin(u * Math.PI) + 0.35 * y * y) - 0.12 * y * u;
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function material(): THREE.MeshStandardMaterial {
  if (!wingMat) {
    wingMat = new THREE.MeshStandardMaterial({
      map: paintWing(), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, roughness: 0.75, metalness: 0,
      // light shining through the thin membrane
      emissive: new THREE.Color('#5a3418'), emissiveIntensity: 0.35, depthWrite: false,
    });
  }
  return wingMat;
}

export class SamaraGlider {
  /** add this to the character's back (it is positioned at the mount point by the caller) */
  readonly root = new THREE.Group();
  private wings: THREE.Group[] = [];
  /** true once the ready-made feathered wings replaced the painted samara pair */
  private feathered = false;
  private open = 0;
  private t = 0;

  constructor(scale = 1) {
    wingGeo ??= wingGeometry();
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(wingGeo, material());
      mesh.renderOrder = 2;
      // the texture's seed end sits at the pivot; mirror for the left wing
      mesh.scale.x = side;
      mesh.rotation.x = Math.PI / 2 - 0.5; // lay the card flat, leading edge (texture top) forward and raised, so the camera behind sees the wing's face
      pivot.add(mesh);
      pivot.userData.side = side;
      this.root.add(pivot);
      this.wings.push(pivot);
    }
    this.root.scale.setScalar(scale);
    this.root.visible = false;
    if (hasModel(MODEL)) void loadHalves().then((h) => { if (h) this.useModel(h); });
  }

  private useModel(h: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[]) {
    for (const w of this.wings) w.removeFromParent();
    const pair = new THREE.Group();
    pair.rotation.x = TILT;
    this.root.add(pair);
    this.wings = h.map((half, i) => {
      const pivot = new THREE.Group();
      const mesh = new THREE.Mesh(half.geo, half.mat);
      mesh.castShadow = true;
      pivot.add(mesh);
      pivot.userData.side = i === 0 ? -1 : 1;
      pair.add(pivot);
      return pivot;
    });
    this.feathered = true;
  }

  /** `gliding` = whether the wings should be out. Unfolds/folds smoothly and flexes a little in the wind. */
  update(dt: number, gliding: boolean) {
    this.t += dt;
    this.open = THREE.MathUtils.clamp(this.open + (gliding ? dt * 4.5 : -dt * 6), 0, 1);
    this.root.visible = this.open > 0.01;
    if (!this.root.visible) return;
    const k = this.open * this.open * (3 - 2 * this.open); // smoothstep
    for (const w of this.wings) {
      const s = w.userData.side as number;
      const flex = Math.sin(this.t * 7 + s) * 0.03 * k;
      if (this.feathered) {
        // folded: each wing swept back along the body · open: spread out, tips lifting a little in the wind
        w.rotation.set(0, s * THREE.MathUtils.lerp(1.3, 0, k), s * flex);
        w.scale.setScalar(THREE.MathUtils.lerp(0.3, 1, k));
        continue;
      }
      // folded: wings hang down along the back · open: spread wide with a slight upward V (dihedral) and sweep
      w.rotation.set(0, s * 0.12 * k, s * (THREE.MathUtils.lerp(-1.35, 0.38, k) + flex));
      w.scale.setScalar(THREE.MathUtils.lerp(0.35, 1, k));
    }
  }

  dispose() {
    this.root.removeFromParent();
  }
}
