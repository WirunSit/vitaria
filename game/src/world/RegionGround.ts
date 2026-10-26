import * as THREE from 'three';
import { LOOK } from '../render/Look';
import { applyDetailTexture } from '../models/PropModels';
import { isGrassyColor, v3Meadow } from './Terrain';

/**
 * look v3 for the outlying regions' ground (Florantis, Aquorra, the Roots, Neurion): the same large warm/cool
 * meadow patches as Cytoria on the grassy vertices, the painted detail texture where a region had none, and a
 * colour sampler so the shader grass field can grow there in the soil's own colour.
 * The ground is a PlaneGeometry(size, size, seg, seg) rotated flat, child of a root placed at the region centre.
 */
export class RegionGround {
  private col: THREE.BufferAttribute;
  private step: number;
  private half: number;

  constructor(mesh: THREE.Mesh, private cx: number, private cz: number, size: number, private seg: number, detail: boolean) {
    const geo = mesh.geometry as THREE.BufferGeometry;
    this.col = geo.attributes.color as THREE.BufferAttribute;
    this.half = size / 2;
    this.step = size / seg;
    if (!LOOK.v3) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      c.fromBufferAttribute(this.col, i);
      if (!isGrassyColor(c)) continue;
      v3Meadow(pos.getX(i) + cx, pos.getZ(i) + cz, c);
      this.col.setXYZ(i, c.r, c.g, c.b);
    }
    this.col.needsUpdate = true;
    if (detail) applyDetailTexture(mesh.material as THREE.MeshToonMaterial, 'TEX_Ground_Cytoria', 50);
  }

  /** Ground colour at a world point (bilinear over the vertex grid), or null outside the region's plane. */
  colorAt(x: number, z: number, out = new THREE.Color()): THREE.Color | null {
    const fx = (x - this.cx + this.half) / this.step, fz = (z - this.cz + this.half) / this.step;
    if (fx < 0 || fz < 0 || fx >= this.seg || fz >= this.seg) return null;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, row = this.seg + 1;
    const a = iz * row + ix, b = a + 1, c = a + row, d = c + 1, C = this.col;
    const mix = (k: number) => {
      const p = C.getComponent(a, k), q = C.getComponent(b, k), r = C.getComponent(c, k), s = C.getComponent(d, k);
      return (p + (q - p) * tx) * (1 - tz) + (r + (s - r) * tx) * tz;
    };
    return out.setRGB(mix(0), mix(1), mix(2));
  }
}
