import * as THREE from 'three';
import { LOOK } from '../render/Look';

let gradient: THREE.DataTexture | null = null;

/** 3-step ramp used by every toon material (cel-shaded look). */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  // look v2: a lighter shadow step (the blue sky fill colours it), so forms read soft like Genshin's cel shading
  const data = LOOK.v2 ? new Uint8Array([150, 150, 150, 255, 212, 212, 212, 255, 255, 255, 255, 255]) : new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

export function toon(color: THREE.ColorRepresentation, opts: Partial<THREE.MeshToonMaterialParameters> = {}): THREE.MeshToonMaterial {
  const key = typeof color === 'string' || typeof color === 'number' ? `${color}|${JSON.stringify(opts)}` : '';
  if (key && cache.has(key)) return cache.get(key)!;
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts });
  if (key) cache.set(key, m);
  return m;
}

export function glow(color: THREE.ColorRepresentation, intensity = 1.5, opacity = 1): THREE.MeshBasicMaterial {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, toneMapped: false });
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1426, side: THREE.BackSide });

/** Leaf cards, grass and glass: an inverted hull around a flat cut-out card would draw a solid black card. */
function cutout(m: THREE.Material | THREE.Material[]): boolean {
  const list = Array.isArray(m) ? m : [m];
  return list.some((x) => x.transparent || x.alphaTest > 0 || !!(x as THREE.MeshStandardMaterial).alphaMap);
}

/** Inverted-hull outline: adds a slightly larger black back-face copy of each mesh. */
export function addOutline(root: THREE.Object3D, thickness = 0.035) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.noOutline && !cutout((o as THREE.Mesh).material)) meshes.push(o as THREE.Mesh);
  });
  for (const m of meshes) {
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) { skinnedOutline(root, m as THREE.SkinnedMesh, thickness); continue; }
    const o = new THREE.Mesh(m.geometry, outlineMat);
    o.userData.noOutline = true;
    o.userData.isOutline = true;
    const s = m.geometry.boundingSphere ?? (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere!);
    const r = Math.max(s.radius, 0.05);
    const k = 1 + thickness / r;
    o.scale.setScalar(k);
    o.castShadow = false;
    m.add(o);
  }
}

const extrudeCache = new Map<string, THREE.MeshBasicMaterial>();
/**
 * A rigged mesh can't use a scaled static copy (it would stay frozen in the bind pose — a dark T-pose ghost),
 * so its hull is a sibling SkinnedMesh on the same skeleton, pushed out along the normals in the shader.
 */
function skinnedOutline(root: THREE.Object3D, m: THREE.SkinnedMesh, thickness: number) {
  if (!m.parent) return;
  root.updateMatrixWorld(true);
  // the real size factor between geometry units and world units: downloaded rigs often keep their scale in the
  // bones (armature ×0.01 etc.), so the mesh node's own scale is not enough — compare world vs raw bounds
  m.skeleton.update();
  m.computeBoundingBox();
  const world = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).length();
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const raw = m.geometry.boundingBox!.getSize(new THREE.Vector3()).length();
  const eff = raw > 1e-6 && world > 1e-6 ? world / raw : m.getWorldScale(new THREE.Vector3()).x;
  const local = thickness / Math.max(eff, 1e-6);
  const key = local.toPrecision(3);
  let mat = extrudeCache.get(key);
  if (!mat) {
    mat = outlineMat.clone();
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += normalize(objectNormal) * ${local.toFixed(6)};`);
    };
    mat.customProgramCacheKey = () => `skinOutline${key}`;
    extrudeCache.set(key, mat);
  }
  if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
  const o = new THREE.SkinnedMesh(m.geometry, mat);
  o.bindMode = m.bindMode;
  o.bind(m.skeleton, m.bindMatrix);
  o.position.copy(m.position);
  o.quaternion.copy(m.quaternion);
  o.scale.copy(m.scale);
  o.userData.noOutline = true;
  o.userData.isOutline = true;
  o.castShadow = false;
  o.frustumCulled = false;
  m.parent.add(o);
}
