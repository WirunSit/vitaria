import * as THREE from 'three';
import type { WeaponType } from '../core/types';
import { gearData, weaponImage } from '../gear/Gear';
import { toonGradient } from '../world/Materials';
import { hasModel, loadGLB, toonify } from './ModelLibrary';

/**
 * Weapon visuals. Every weapon has a GPT image; we turn its silhouette into a thin extruded mesh with the
 * picture on both faces (catalysts become a floating sprite). A real `.glb` in models/weapons/ wins if present.
 *
 * Returned objects share one convention: grip at the origin, blade/shaft along +Y, flat faces along ±Z.
 */

const LENGTH: Record<WeaponType, number> = { SWORD: 1.0, CLAYMORE: 1.45, POLEARM: 2.1, BOW: 1.15, CATALYST: 0.42 };
const THICK: Record<WeaponType, number> = { SWORD: 0.028, CLAYMORE: 0.045, POLEARM: 0.035, BOW: 0.03, CATALYST: 0.06 };
/** Fallback grip position along the length (0 = bottom end) for GLB models without hold data. */
const GRIP_AT: Record<WeaponType, number> = { SWORD: 0.12, CLAYMORE: 0.12, POLEARM: 0.38, BOW: 0.5, CATALYST: 0.5 };

const cache = new Map<string, Promise<THREE.Object3D | null>>();

export function loadWeaponVisual(id: string, type: WeaponType): Promise<THREE.Object3D | null> {
  if (!cache.has(id)) cache.set(id, build(id, type));
  return cache.get(id)!.then((o) => (o ? o.clone() : null));
}

async function build(id: string, type: WeaponType): Promise<THREE.Object3D | null> {
  try {
    const glb = `weapons/WPN_${id}.glb`;
    if (hasModel(glb)) {
      const m = await loadGLB(glb);
      if (m) return fromGLB(m, type);
    }
    const img = await loadImage(weaponImage(id));
    if (type === 'CATALYST') return sprite(img);
    return extrude(img, type, gearData.weapons.get(id)?.hold);
  } catch (e) {
    console.warn('[weapon] build failed', id, e);
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
}

function texture(img: HTMLImageElement) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function sprite(img: HTMLImageElement) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(img), alphaTest: 0.3, toneMapped: false }));
  s.scale.setScalar(LENGTH.CATALYST);
  s.userData.noOutline = true;
  const g = new THREE.Group();
  g.add(s);
  return g;
}

// ------------------------------------------------------------------ silhouette → mesh

type P = [number, number];

function extrude(img: HTMLImageElement, type: WeaponType, hold?: { grip: P; tip: P; butt?: P }) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, W, H).data;

  // mask (alpha > 40), dilated by 1px so hair-thin bow strings stay connected
  const raw = new Uint8Array(W * H);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < W * H; i++) {
    if (px[i * 4 + 3] > 40) {
      raw[i] = 1;
      r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2]; n++;
    }
  }
  if (!n) return null;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let on = 0;
    for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && raw[yy * W + xx]) { on = 1; break; }
    }
    mask[y * W + x] = on;
  }

  const shapes: THREE.Shape[] = [];
  for (const c of components(mask, W, H)) {
    if (c.area < 16) continue;
    const pts = simplify(trace(mask, W, H, c.label, c.labels, c.start), 0.8);
    if (pts.length < 3) continue;
    shapes.push(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, -y))));
  }
  if (!shapes.length) return null;

  // pixel space → metres: grip at origin, grip→tip along +Y
  const grip = hold ? snap(raw, W, H, hold.grip) : ([W / 2, H * 0.8] as P);
  const from = hold?.butt ?? grip;
  const to = hold?.tip ?? ([W / 2, 0] as P);
  const dir = new THREE.Vector2(to[0] - from[0], -(to[1] - from[1])).normalize();
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  // UVs straight from the image so both faces show the picture
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W, 1 + pos.getY(i) / H);
  uv.needsUpdate = true;
  geo.translate(-grip[0], grip[1], -0.5);
  geo.rotateZ(Math.atan2(dir.x, dir.y));
  geo.computeBoundingBox();
  const len = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
  const s = LENGTH[type] / len;
  geo.scale(s, s, THICK[type]);
  geo.computeVertexNormals();

  const map = texture(img);
  const face = new THREE.MeshToonMaterial({
    map, gradientMap: toonGradient(), alphaTest: 0.45, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.3,
  });
  const avg = new THREE.Color(r / n / 255, g / n / 255, b / n / 255).convertSRGBToLinear().multiplyScalar(0.75);
  const side = new THREE.MeshToonMaterial({ color: avg, gradientMap: toonGradient() });
  const mesh = new THREE.Mesh(geo, [face, side]);
  mesh.castShadow = true;
  mesh.userData.noOutline = true;
  const out = new THREE.Group();
  out.add(mesh);
  return out;
}

/** Nearest opaque pixel to p (hold points are hand-picked and may sit a pixel off the shape). */
function snap(m: Uint8Array, W: number, H: number, p: P): P {
  let best = p, bd = Infinity;
  for (let y = Math.max(0, p[1] - 12); y < Math.min(H, p[1] + 13); y++)
    for (let x = Math.max(0, p[0] - 12); x < Math.min(W, p[0] + 13); x++) {
      if (!m[y * W + x]) continue;
      const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;
      if (d < bd) { bd = d; best = [x, y]; }
    }
  return best;
}

function components(m: Uint8Array, W: number, H: number) {
  const labels = new Int32Array(W * H);
  const out: { label: number; area: number; start: number; labels: Int32Array }[] = [];
  const stack: number[] = [];
  let next = 1;
  for (let i = 0; i < W * H; i++) {
    if (!m[i] || labels[i]) continue;
    const label = next++;
    let area = 0;
    labels[i] = label;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      area++;
      const x = j % W, y = (j / W) | 0;
      for (const [dx, dy] of N8) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const k = yy * W + xx;
        if (m[k] && !labels[k]) { labels[k] = label; stack.push(k); }
      }
    }
    out.push({ label, area, start: i, labels });
  }
  return out;
}

// clockwise (y down): W, NW, N, NE, E, SE, S, SW
const N8: P[] = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];

/** Moore-neighbour boundary trace of one component; `start` is its first pixel in raster order. */
function trace(_m: Uint8Array, W: number, H: number, label: number, labels: Int32Array, start: number): P[] {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && labels[y * W + x] === label;
  const sx = start % W, sy = (start / W) | 0;
  const pts: P[] = [[sx, sy]];
  let cx = sx, cy = sy, back = 0; // we "came from" the west (raster order guarantees it is empty)
  for (let guard = 0; guard < W * H * 2; guard++) {
    let moved = false;
    for (let i = 1; i <= 8; i++) {
      const d = (back + i) % 8;
      const nx = cx + N8[d][0], ny = cy + N8[d][1];
      if (!on(nx, ny)) continue;
      // last empty cell we checked, seen from the new pixel, is where the next scan starts
      const pd = (d + 7) % 8;
      const rx = cx + N8[pd][0] - nx, ry = cy + N8[pd][1] - ny;
      back = N8.findIndex(([a, b]) => a === rx && b === ry);
      cx = nx; cy = ny;
      moved = true;
      break;
    }
    if (!moved) break; // single pixel
    // Jacob's stop: leaving the start pixel the same way as the first time means the ring is closed
    const prev = pts[pts.length - 1];
    if (pts.length > 2 && prev[0] === sx && prev[1] === sy && cx === pts[1][0] && cy === pts[1][1]) { pts.pop(); break; }
    pts.push([cx, cy]);
  }
  return pts;
}

/** Douglas–Peucker on a closed ring. */
function simplify(pts: P[], eps: number): P[] {
  if (pts.length < 8) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const a = dp(pts.slice(0, far + 1), eps);
  const b = dp([...pts.slice(far), pts[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function dp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const L = Math.hypot(bx - ax, by - ay) || 1;
  let idx = 0, md = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
    if (d > md) { md = d; idx = i; }
  }
  if (md <= eps) return [pts[0], pts[pts.length - 1]];
  const l = dp(pts.slice(0, idx + 1), eps);
  return [...l.slice(0, -1), ...dp(pts.slice(idx), eps)];
}

// ------------------------------------------------------------------ GLB

function fromGLB(m: THREE.Object3D, type: WeaponType) {
  toonify(m);
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m);
  const size = box.getSize(new THREE.Vector3());
  // longest axis becomes +Y (AI generators usually output weapons standing tip-up)
  const holder = new THREE.Group();
  holder.add(m);
  if (size.x > size.y && size.x >= size.z) holder.rotation.z = Math.PI / 2;
  else if (size.z > size.y) holder.rotation.x = -Math.PI / 2;
  holder.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(holder);
  const len = b2.max.y - b2.min.y || 1;
  const s = (type === 'CATALYST' ? LENGTH.CATALYST : LENGTH[type]) / len;
  const c = b2.getCenter(new THREE.Vector3());
  const gripY = b2.min.y + len * GRIP_AT[type];
  const out = new THREE.Group();
  holder.position.set(-c.x * s, -gripY * s, -c.z * s);
  holder.scale.setScalar(s);
  out.add(holder);
  out.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  return out;
}

// ------------------------------------------------------------------ mounting

/** Rotation for a weapon whose blade should point along `aim` with its flat faces looking sideways (±X). */
export function holdQuat(aim: THREE.Vector3): THREE.Quaternion {
  const y = aim.clone().normalize();
  const z = new THREE.Vector3(1, 0, 0).addScaledVector(y, -y.x).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Idle aim of each weapon type relative to a hanging arm (+Z = forward). */
export function idleAim(type: WeaponType): THREE.Vector3 {
  return (type === 'BOW' ? new THREE.Vector3(0, 1, 0.15)
    : type === 'POLEARM' ? new THREE.Vector3(0, 1, 0.25)
    : type === 'CLAYMORE' ? new THREE.Vector3(0, -0.75, 0.65)
    : new THREE.Vector3(0, -0.5, 0.85)).normalize();
}

/**
 * Swaps the placeholder weapon on a mount for the equipped weapon's visual (loaded async).
 * `place` positions the loaded object inside the mount.
 */
export class WeaponSlot {
  private id: string | null = null;
  private custom: THREE.Object3D | null = null;

  constructor(
    private type: WeaponType,
    private mount: THREE.Object3D,
    private fallback: THREE.Object3D[],
    private place: (o: THREE.Object3D) => void,
  ) {}

  set(id: string | null) {
    if (id === this.id) return;
    this.id = id;
    if (!id) { this.clear(); return; }
    void loadWeaponVisual(id, this.type).then((o) => {
      if (this.id !== id || !o) return;
      this.clear();
      this.place(o);
      // keep real-world size whatever the hand bone's inherited scale is
      this.mount.updateWorldMatrix(true, false);
      o.scale.divideScalar(this.mount.getWorldScale(new THREE.Vector3()).x || 1);
      this.mount.add(o);
      this.custom = o;
      for (const f of this.fallback) f.visible = false;
    });
  }

  /** the weapon object currently shown in the hand */
  get active(): THREE.Object3D | null { return this.custom ?? this.fallback[0] ?? null; }

  private clear() {
    this.custom?.removeFromParent();
    this.custom = null;
    for (const f of this.fallback) f.visible = true;
  }
}
