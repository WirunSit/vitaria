import * as THREE from 'three';

/**
 * Genshin-style swing trail: a ribbon traced by the weapon's base and tip over the last few frames, bright at the
 * blade and fading toward the tail. Lives in the character's local space (so it can't lag behind a dashing player),
 * additive, one small dynamic mesh per character. `update(active)` samples while a swing / skill plays and lets the
 * ribbon shrink away afterwards.
 */
const N = 12; // samples kept
const SUB = 3; // interpolated segments between samples (smooth arcs at 60 fps)

export class WeaponTrail {
  readonly mesh: THREE.Mesh;
  private base: THREE.Vector3[] = [];
  private tip: THREE.Vector3[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private color: THREE.Color;

  constructor(color: THREE.Color, private parent: THREE.Object3D) {
    this.color = color;
    const verts = (N - 1) * SUB + 1;
    this.pos = new Float32Array(verts * 2 * 3);
    this.col = new Float32Array(verts * 2 * 3);
    const idx: number[] = [];
    for (let i = 0; i < verts - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    this.mesh.userData.noOutline = true;
    parent.add(this.mesh);
  }

  /** `baseW` / `tipW` are world positions of the blade's grip end and point. */
  update(baseW: THREE.Vector3 | null, tipW: THREE.Vector3 | null, active: boolean) {
    if (active && baseW && tipW) {
      this.base.unshift(this.parent.worldToLocal(baseW.clone()));
      this.tip.unshift(this.parent.worldToLocal(tipW.clone()));
      if (this.base.length > N) { this.base.pop(); this.tip.pop(); }
    } else if (this.base.length) {
      // let the tail catch up with the head, then disappear
      this.base.pop(); this.tip.pop();
      if (this.base.length > 1) { this.base.pop(); this.tip.pop(); }
    }
    const n = this.base.length;
    if (n < 2) { this.mesh.geometry.setDrawRange(0, 0); return; }
    const verts = (n - 1) * SUB + 1;
    const p = this.pos, c = this.col, k = this.color;
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < verts; i++) {
      const f = i / SUB, j = Math.min(n - 2, Math.floor(f)), t = f - j;
      catmull(this.base, j, t, v);
      catmull(this.tip, j, t, w);
      // ribbon narrows toward the tail (base slides up toward the tip) and fades out
      const age = i / (verts - 1);
      v.lerp(w, age * 0.55);
      const a = Math.pow(1 - age, 1.8) * 0.6;
      p.set([v.x, v.y, v.z, w.x, w.y, w.z], i * 6);
      c.set([k.r * a * 0.35, k.g * a * 0.35, k.b * a * 0.35, k.r * a, k.g * a, k.b * a], i * 6);
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, (verts - 1) * 6);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Catmull-Rom between samples j and j+1 of `pts` (newest first). */
function catmull(pts: THREE.Vector3[], j: number, t: number, out: THREE.Vector3) {
  const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(pts.length - 1, j + 2)];
  const t2 = t * t, t3 = t2 * t;
  out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
  return out;
}
