import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hasModel, loadGLB } from '../models/ModelLibrary';
import { toonGradient } from './Materials';

/**
 * Low-poly CC0 nature models (Kenney Nature Kit) drawn as instanced meshes, recoloured to the game palette,
 * with a vertex-shader wind sway on foliage. Files live in assets/models/nature/*.glb.
 */

/** Shared clock for every wind-animated material. */
export const WIND = { time: { value: 0 } };

interface Part { geo: THREE.BufferGeometry; mat: string }
const partsCache = new Map<string, Promise<Part[] | null>>();

/** Off: the user preferred the original hand-built vegetation (kit files are kept for later use). */
export const USE_NATURE_KIT = false;
export function hasNature(name: string) { return USE_NATURE_KIT && hasModel(`nature/${name}.glb`); }

function loadParts(name: string): Promise<Part[] | null> {
  if (!partsCache.has(name)) {
    partsCache.set(name, loadGLB(`nature/${name}.glb`).then((root) => {
      if (!root) return null;
      root.updateMatrixWorld(true);
      const byMat = new Map<string, THREE.BufferGeometry[]>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        g.deleteAttribute('uv');
        if (mats.length === 1) {
          const key = mats[0].name || 'default';
          (byMat.get(key) ?? byMat.set(key, []).get(key)!).push(g.index ? g.toNonIndexed() : g);
        } else {
          // split multi-material geometry by group
          const src = g.index ? g.toNonIndexed() : g;
          for (const grp of src.groups) {
            const sub = new THREE.BufferGeometry();
            for (const [k, attr] of Object.entries(src.attributes)) {
              const a = attr as THREE.BufferAttribute;
              sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(grp.start * a.itemSize, (grp.start + grp.count) * a.itemSize), a.itemSize));
            }
            const key = mats[grp.materialIndex ?? 0]?.name || 'default';
            (byMat.get(key) ?? byMat.set(key, []).get(key)!).push(sub);
          }
        }
      });
      const parts: Part[] = [];
      for (const [mat, list] of byMat) {
        const merged = list.length === 1 ? list[0] : mergeGeometries(list);
        if (merged) parts.push({ geo: merged, mat });
      }
      return parts;
    }));
  }
  return partsCache.get(name)!;
}

/** Palette per Kenney material name. `null` = use the per-instance colour (foliage). */
export type Palette = Record<string, string | null>;
export const CYTORIA_PALETTE: Palette = {
  leafsGreen: null, leafsFall: null, leafsDark: null, leafs: null,
  woodBark: '#8a6243', woodBarkDark: '#7a5238', woodBirch: '#e9dcc4', woodInner: '#e8cfa8',
  grass: '#8fb553', dirt: '#a39280', stone: '#b9b4a8',
  colorRed: '#ff8fb5', colorYellow: '#ffd25e', colorPurple: '#b59cff', colorTan: '#e0b080',
  _defaultMat: '#f4efe2', default: '#f4efe2',
};
export const GENOVIA_PALETTE: Palette = {
  ...CYTORIA_PALETTE,
  grass: '#e8f0f8', dirt: '#9aa0b0', stone: '#a8b0c0',
};

/** Toon material whose vertices sway with the wind (amount grows with height above the model's base). */
function windMaterial(color: THREE.ColorRepresentation, sway: number, useInstanceColor: boolean) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
  if (useInstanceColor) m.color.set(0xffffff);
  if (sway > 0) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = WIND.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          #else
            vec3 ip = vec3(0.0);
          #endif
          float hgt = max(0.0, transformed.y);
          float w = sin(uTime * 1.6 + ip.x * 0.31 + ip.z * 0.23) + 0.35 * sin(uTime * 3.7 + ip.x * 0.7);
          transformed.x += w * ${sway.toFixed(3)} * hgt * hgt;
          transformed.z += cos(uTime * 1.3 + ip.z * 0.27) * ${(sway * 0.6).toFixed(3)} * hgt * hgt;`);
    };
    m.customProgramCacheKey = () => `wind${sway}${useInstanceColor}`;
  }
  return m;
}

export interface Spot { model: string; x: number; y: number; z: number; rot: number; scale: number; color?: THREE.Color }

/**
 * Build instanced meshes for a list of placements. Returns a group that fills in once the models load.
 * `foliageSway` is applied to leaf/grass materials, trunks stay still.
 */
export function scatter(spots: Spot[], palette: Palette, foliageSway = 0.05): THREE.Group {
  const out = new THREE.Group();
  const byModel = new Map<string, Spot[]>();
  for (const s of spots) (byModel.get(s.model) ?? byModel.set(s.model, []).get(s.model)!).push(s);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (const [model, list] of byModel) {
    void loadParts(model).then((parts) => {
      if (!parts) return;
      for (const part of parts) {
        const fixed = palette[part.mat];
        const isFoliage = fixed === null;
        const mat = windMaterial(fixed ?? '#ffffff', isFoliage || part.mat === 'grass' ? foliageSway : 0, isFoliage);
        const im = new THREE.InstancedMesh(part.geo, mat, list.length);
        list.forEach((s, i) => {
          m4.compose(p.set(s.x, s.y, s.z), q.setFromAxisAngle(up, s.rot), sc.setScalar(s.scale));
          im.setMatrixAt(i, m4);
          if (isFoliage) im.setColorAt(i, s.color ?? new THREE.Color('#7fb24a'));
        });
        im.castShadow = true;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        out.add(im);
      }
    });
  }
  return out;
}
