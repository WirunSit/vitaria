import * as THREE from 'three';
import { addOutline } from '../world/Materials';
import { hasModel, loadGLB, modelUrl, refreshSkins, toonify } from './ModelLibrary';

/**
 * Drop-in 3D replacements for buildings and props.
 * Every procedural landmark calls `propSlot(group, 'BLD_Name', fit)`. When `assets/models/props/BLD_Name.glb`
 * exists (from AI image-to-3D), the procedural meshes are hidden and the model takes their place.
 * Children flagged `userData.keep` (glowing cores, doors that animate, portals…) stay visible.
 */
export interface PropFit {
  /** target height (m) */
  h?: number;
  /** target footprint — the larger of width/depth (m) */
  w?: number;
  yaw?: number;
  y?: number;
  outline?: number;
  /** with both w and h: scale the footprint to w and the height to h separately (a bridge made longer, not taller) */
  stretch?: boolean;
  /** the file is a pack of several objects (houses, signs…): keep only piece N (wraps around) */
  piece?: number | number[];
}

const slots = new WeakMap<THREE.Object3D, THREE.Object3D>();

/** Pack files: walk down single-child wrappers to the list of objects, then keep one of them. */
function keepPiece(root: THREE.Object3D, piece: number | number[]) {
  let node = root;
  while (node.children.length === 1) node = node.children[0];
  const parts = node.children.filter((c) => { let mesh = false; c.traverse((o) => { if ((o as THREE.Mesh).isMesh) mesh = true; }); return mesh; });
  if (parts.length < 2) return;
  const want = (Array.isArray(piece) ? piece : [piece]).map((i) => parts[((i % parts.length) + parts.length) % parts.length]);
  for (const c of parts) if (!want.includes(c)) c.removeFromParent();
}

export function hasProp(name: string) { return hasModel(`props/${name}.glb`); }

export function propSlot(holder: THREE.Object3D, name: string, fit: PropFit): Promise<boolean> {
  const file = `props/${name}.glb`;
  if (!hasModel(file)) return Promise.resolve(false);
  const lodFile = `props/${name}_lod.glb`;
  return Promise.all([loadGLB(file), hasModel(lodFile) ? loadGLB(lodFile) : Promise.resolve(null)]).then(([obj, low]) => {
    if (!obj) return false;
    if (fit.piece !== undefined) keepPiece(obj, fit.piece);
    if (low && fit.piece !== undefined) keepPiece(low, fit.piece);
    toonify(obj);
    refreshSkins(obj); // rigged props (an animated skeleton) measure through their bones
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    let s = 1;
    if (fit.stretch && fit.w && fit.h) {
      const sw = fit.w / Math.max(size.x, size.z);
      obj.scale.multiply(new THREE.Vector3(sw, fit.h / size.y, sw));
      s = 1;
    } else if (fit.w && fit.h) s = Math.min(fit.w / Math.max(size.x, size.z), fit.h / size.y);
    else if (fit.w) s = fit.w / Math.max(size.x, size.z);
    else if (fit.h) s = fit.h / size.y;
    obj.scale.multiplyScalar(s);
    refreshSkins(obj);
    const b2 = new THREE.Box3().setFromObject(obj);
    const c = b2.getCenter(new THREE.Vector3());
    obj.position.set(obj.position.x - c.x, obj.position.y - b2.min.y, obj.position.z - c.z);
    const wrap = new THREE.Group();
    wrap.name = `prop:${name}`;
    wrap.add(distanceSwitch(obj, low, b2.getSize(new THREE.Vector3()).length(), fit.outline === 0 ? 0 : fit.outline ?? 0.03));
    wrap.rotation.y = fit.yaw ?? 0;
    wrap.position.y = fit.y ?? 0;
    const old = slots.get(holder);
    if (old) old.removeFromParent();
    for (const ch of holder.children) if (!ch.userData.keep && !ch.name.startsWith('prop:')) ch.visible = false;
    holder.add(wrap);
    slots.set(holder, wrap);
    return true;
  });
}

/**
 * Distance switch for a placed model (three.js picks the level per frame from the camera distance):
 * full detail up close, the low-detail copy past a few times its size, nothing once it is lost in the fog.
 * Big landmarks stay visible further than small props.
 */
function distanceSwitch(hi: THREE.Object3D, low: THREE.Object3D | null, size: number, outline: number): THREE.LOD {
  const lod = new THREE.LOD();
  // the black inverted-hull outline doubles a model's triangles: detailed (already textured) models skip it
  if (outline && triangles(hi) <= OUTLINE_MAX_TRIS) addOutline(hi, outline);
  lod.addLevel(hi, 0);
  if (low) {
    toonify(low);
    low.scale.copy(hi.scale);
    low.position.copy(hi.position);
    low.quaternion.copy(hi.quaternion);
    if (outline) addOutline(low, outline);
    lod.addLevel(low, Math.max(30, size * 3));
  }
  lod.addLevel(new THREE.Object3D(), Math.min(360, Math.max(120, size * 25)));
  return lod;
}

const OUTLINE_MAX_TRIS = 20000;

function triangles(root: THREE.Object3D) {
  let t = 0;
  root.traverse((o) => { const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null; if (g) t += (g.index ? g.index.count : g.attributes.position.count) / 3; });
  return t;
}

/** Ground detail texture (seamless, light, low contrast) multiplied over the terrain's vertex colours. */
export function applyDetailTexture(mat: THREE.MeshToonMaterial, name: string, repeat: number) {
  const rel = `textures/${name}.webp`;
  if (!hasModel(rel)) return;
  new THREE.TextureLoader().load(modelUrl(rel), (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    mat.map = t;
    mat.needsUpdate = true;
  });
}
