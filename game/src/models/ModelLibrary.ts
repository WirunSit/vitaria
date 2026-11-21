import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { LOOK } from '../render/Look';
import { VRMLoaderPlugin, VRMUtils, type MToonMaterial, type VRM } from '@pixiv/three-vrm';
import { toonGradient } from '../world/Materials';
import { isTouch } from '../core/Device';

/**
 * Real 3D models (VRoid .vrm for characters, AI image-to-3D .glb for enemies/props).
 * `game/tools/import_assets.py` copies them from Assets/_Project/Models and writes assets/models/models.json.
 * Anything not listed there keeps using the procedural placeholder models.
 */
const available = new Set<string>();
const glbCache = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

export async function loadModelManifest() {
  try {
    const res = await fetch('assets/models/models.json');
    if (!res.ok) return;
    const list = (await res.json()) as string[];
    for (const p of list) available.add(p);
  } catch { /* no models yet */ }
}

const overrides = new Map<string, string>();
/** Dev/testing: serve a model from a blob URL without copying files (used by tools/test-harness.js). */
export function debugRegisterModel(rel: string, url: string) { overrides.set(rel, url); available.add(rel); glbCache.delete(rel); }

export function hasModel(rel: string) { return available.has(rel); }
export function modelUrl(rel: string) { return overrides.get(rel) ?? `assets/models/${rel}`; }

/**
 * Phones: model textures are capped at these sizes. VRoid exports ship a dozen 2048² maps per character; at a
 * phone's render resolution 1024² looks the same and takes a quarter of the GPU memory (and uploads 4× faster).
 * Scenery, props and enemies (.glb, ~300 maps in the world) are seen smaller still, so they get 512².
 */
const MAX_TEX_VRM = isTouch ? 1024 : 0;
const MAX_TEX_GLB = isTouch ? 512 : 0;
type ModelImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;
const shrunk = new WeakMap<object, Promise<ModelImage | null>>();

async function shrinkImage(img: ModelImage, max: number): Promise<ModelImage | null> {
  const k = max / Math.max(img.width, img.height);
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  // createImageBitmap keeps the colours of fully transparent texels (a 2D canvas would turn them black and give
  // cut-out hair dark fringes); the canvas is only the fallback for browsers that ignore the resize options
  try {
    const bmp = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high', premultiplyAlpha: 'none' });
    if (bmp.width === w) return bmp;
    bmp.close();
  } catch { /* fall through */ }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d')?.drawImage(img, 0, 0, w, h);
  return c;
}

/** Downsizes every oversized texture under `root` (before it is first drawn, so the big version never reaches the GPU). */
async function shrinkTextures(root: THREE.Object3D, max: number) {
  if (!max) return;
  const jobs: Promise<void>[] = [];
  const visit = (t: unknown) => {
    const tex = t as THREE.Texture | null;
    if (!tex?.isTexture) return;
    const img = tex.image as ModelImage | null;
    if (!img?.width || Math.max(img.width, img.height) <= max) return;
    let p = shrunk.get(img);
    if (!p) { p = shrinkImage(img, max); shrunk.set(img, p); }
    jobs.push(p.then((small) => { if (small && tex.image === img) { tex.image = small; tex.needsUpdate = true; } }));
  };
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      for (const v of Object.values(m)) visit(v);
      const u = (m as THREE.ShaderMaterial).uniforms;
      if (u) for (const k in u) visit(u[k]?.value);
    }
  });
  await Promise.all(jobs);
}

export async function loadVRM(rel: string): Promise<VRM | null> {
  try {
    const gltf = await loader.loadAsync(modelUrl(rel));
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (!vrm) return null;
    await shrinkTextures(gltf.scene, MAX_TEX_VRM);
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm); // VRM 0.x faces -Z; turn it to +Z like our models
    vrm.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.frustumCulled = false;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // soft rim light on the silhouette (MToon's parametric rim) so characters stand out from the scenery
      for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as (THREE.Material & Partial<MToonMaterial>)[]) {
        if (!(m as { isMToonMaterial?: boolean }).isMToonMaterial || !m.parametricRimColorFactor) continue;
        // unset or near-black authored rims (many VRoid exports ship #0e0e0e) get ours; real authored rims are kept
        const rim = m.parametricRimColorFactor;
        if (rim.getHex() === 0 || (LOOK.v3 && Math.max(rim.r, rim.g, rim.b) < 0.05)) m.parametricRimColorFactor = LOOK.v3 ? new THREE.Color(0.42, 0.46, 0.56) : new THREE.Color(0.32, 0.34, 0.4);
        m.parametricRimFresnelPowerFactor = LOOK.v3 ? 4 : 3.2;
        m.parametricRimLiftFactor = 0.02;
        // look v3: let half the rim show on the shaded side too, so the silhouette reads against bright scenery
        if (LOOK.v3) m.rimLightingMixFactor = 0.5;
      }
    });
    return vrm;
  } catch (e) {
    console.warn('VRM load failed', rel, e);
    return null;
  }
}

/** Loads (once) and returns an independent clone of a .glb scene. */
export async function loadGLB(rel: string): Promise<THREE.Object3D | null> {
  return (await loadGLBAnimated(rel))?.obj ?? null;
}

/** Like loadGLB, but also returns the file's animation clips (rigged downloads walk/attack with them). */
export async function loadGLBAnimated(rel: string): Promise<{ obj: THREE.Object3D; clips: THREE.AnimationClip[] } | null> {
  try {
    if (!glbCache.has(rel)) glbCache.set(rel, loader.loadAsync(modelUrl(rel)).then(async (g) => { await shrinkTextures(g.scene, MAX_TEX_GLB); return g; }));
    const gltf = await glbCache.get(rel)!;
    return { obj: skeletonClone(gltf.scene), clips: gltf.animations };
  } catch (e) {
    console.warn('GLB load failed', rel, e);
    return null;
  }
}

/** Swap PBR materials for cel-shaded ones so AI-generated models match the art style. */
export function toonify(root: THREE.Object3D, tint?: THREE.ColorRepresentation, tintAmount = 0.45) {
  const tintCol = tint !== undefined ? new THREE.Color(tint) : null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // unlit models ship without normals; toon lighting and the outline shell turn that into NaN (black screen with bloom)
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
    const conv = (m: THREE.Material) => {
      if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        // hand-painted unlit models (KHR_materials_unlit): their light is painted into the texture, so lighting them
        // again only darkens them. Keep them unlit; blended foliage becomes an alpha cut-out (no sorting artefacts).
        const b = (m as THREE.MeshBasicMaterial).clone();
        if (b.map) b.map.colorSpace = THREE.SRGBColorSpace;
        if (b.transparent && b.map) { b.transparent = false; b.alphaTest = 0.45; b.depthWrite = true; }
        if (tintCol) b.color.lerp(tintCol, tintAmount * 0.25);
        return b;
      }
      const src = m as THREE.MeshStandardMaterial;
      const color = (src.color ?? new THREE.Color(0xffffff)).clone();
      // textured (downloaded) models keep most of their painted colours; flat AI models take the full tint
      if (tintCol) color.lerp(tintCol, src.map ? tintAmount * 0.25 : tintAmount);
      const t = new THREE.MeshToonMaterial({
        color, map: src.map ?? null, gradientMap: toonGradient(), transparent: src.transparent, opacity: src.opacity,
        alphaTest: src.alphaTest, alphaMap: src.alphaMap ?? null, depthWrite: src.depthWrite, // cut-out leaves stay cut out
        emissive: src.emissive ?? new THREE.Color(0), emissiveMap: src.emissiveMap ?? null, side: src.side,
        // models coloured per vertex (no texture) keep those colours
        vertexColors: !!src.vertexColors || (!src.map && !!mesh.geometry.attributes.color),
      });
      if (t.map) t.map.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
}

/** Scale an object so its bounding box is `height` tall and sits on y = 0, centred on x/z. */
/** Skinned meshes measure their bounds through the skeleton, whose bone matrices only refresh at render time. */
export function refreshSkins(obj: THREE.Object3D) {
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (sm.isSkinnedMesh) { sm.skeleton.update(); sm.computeBoundingBox(); sm.computeBoundingSphere(); }
  });
}

export function fitToHeight(obj: THREE.Object3D, height: number) {
  refreshSkins(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if (size.y <= 0) return;
  const s = height / size.y;
  obj.scale.multiplyScalar(s);
  refreshSkins(obj);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b2.min.y;
}
