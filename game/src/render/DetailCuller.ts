import * as THREE from 'three';

/**
 * Phones: small static meshes (stones, lamps, signs, fence posts — the procedural set dressing) stop being drawn
 * past a distance that grows with their size. Hundreds of them sit 60–150 m out, where on a phone screen they are
 * a few pixels inside the fog, yet each one is a draw call.
 *
 * Hiding goes through render layers instead of `visible`, so game logic that shows/hides objects is untouched:
 * a culled mesh is simply moved off the camera's layer until the player comes closer.
 */
const CULLED_LAYER = 3;
/** only meshes smaller than this (bounding radius, m) are candidates */
const MAX_RADIUS = 2.5;

/** `c` = the geometry's centre in the mesh's own space (merged set dressing often sits far from its origin) */
interface Entry { mesh: THREE.Mesh; c: THREE.Vector3; dist2: number; culled: boolean }

export class DetailCuller {
  private entries: Entry[] = [];
  /** per mesh: its entry, or null when it isn't a candidate */
  private info = new WeakMap<THREE.Object3D, Entry | null>();
  private cursor = 0;
  private rescanT = 0;
  enabled = true;
  /** multiplies every cull distance (graphics quality) */
  distK = 1;

  constructor(private scene: THREE.Scene) {}

  private candidate(m: THREE.Mesh, sphere: THREE.Sphere): Entry | null {
    // skinned bodies, instanced flora (culled per tile already), the sky and anything flagged always-on are left alone
    if ((m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh || !m.frustumCulled) return null;
    const g = m.geometry;
    if (!g) return null;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere) return null;
    m.updateWorldMatrix(true, false);
    sphere.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
    if (sphere.radius > MAX_RADIUS || !Number.isFinite(sphere.radius)) return null;
    const d = THREE.MathUtils.clamp(40 + sphere.radius * 45, 50, 140);
    return { mesh: m, c: g.boundingSphere.center.clone(), dist2: d * d, culled: false };
  }

  /**
   * Rebuilds the list from what is in the scene now (the world keeps adding and removing things: camps, enemies,
   * pickups). Meshes that left the scene are dropped and put back on the camera's layer in case they return.
   */
  private scan() {
    const sphere = new THREE.Sphere();
    const next: Entry[] = [];
    const live = new Set<Entry>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      let e = this.info.get(m);
      if (e === undefined) { e = this.candidate(m, sphere); this.info.set(m, e); }
      if (e) { next.push(e); live.add(e); }
    });
    for (const e of this.entries) if (!live.has(e) && e.culled) { e.culled = false; e.mesh.layers.set(0); }
    this.entries = next;
    this.cursor = 0;
  }

  update(dt: number, viewer: THREE.Vector3) {
    if (!this.enabled) return;
    this.rescanT -= dt;
    if (this.rescanT <= 0) { this.rescanT = 3; this.scan(); }
    const list = this.entries;
    if (!list.length) return;
    const k2 = this.distK * this.distK;
    const n = Math.max(1, Math.ceil(list.length / 8)); // whole list every ~8 frames
    for (let i = 0; i < n; i++) {
      if (this.cursor >= list.length) this.cursor = 0;
      const e = list[this.cursor++];
      const w = e.mesh.matrixWorld.elements, { x, y, z } = e.c;
      const dx = w[0] * x + w[4] * y + w[8] * z + w[12] - viewer.x;
      const dy = w[1] * x + w[5] * y + w[9] * z + w[13] - viewer.y;
      const dz = w[2] * x + w[6] * y + w[10] * z + w[14] - viewer.z;
      const cull = dx * dx + dy * dy + dz * dz > e.dist2 * k2;
      if (cull !== e.culled) {
        e.culled = cull;
        if (cull) e.mesh.layers.set(CULLED_LAYER);
        else e.mesh.layers.set(0);
      }
    }
  }
}
