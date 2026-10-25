import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonGradient } from '../world/Materials';

/**
 * The Traveler's Geo constructs as natural amber crystal clusters instead of plain hex posts:
 * faceted hexagonal crystals (pointed tips, slight taper, random height and outward lean) growing out of a heap of
 * broken rock. Crystal shading: dark amber at the root → pale gold at the tip, a glowing fresnel rim and a slow
 * inner pulse (shared uniform). `grow(t)` animates the eruption (staggered, overshooting) and `sink(t)` the retreat.
 */
const pulse = { value: 0 };
let crystalMat: THREE.MeshToonMaterial | null = null;
let rockMat: THREE.MeshToonMaterial | null = null;
let crystalGeo: THREE.BufferGeometry | null = null;
let rockGeo: THREE.BufferGeometry | null = null;

function materials() {
  if (!crystalMat) {
    crystalMat = new THREE.MeshToonMaterial({ color: '#f2b84b', gradientMap: toonGradient(), emissive: new THREE.Color('#8a3f05'), emissiveIntensity: 0.3 });
    crystalMat.onBeforeCompile = (sh) => {
      sh.uniforms.uPulse = pulse;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vCH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCH = position.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCH;\nuniform float uPulse;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          // dark amber root → honey → pale gold tip
          vec3 root = vec3(0.42, 0.17, 0.03), mid = vec3(0.93, 0.5, 0.08), tip = vec3(1.0, 0.8, 0.38);
          float h = clamp(vCH, 0.0, 1.0);
          diffuseColor.rgb = mix(mix(root, mid, smoothstep(0.0, 0.55, h)), tip, smoothstep(0.55, 1.0, h));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // glowing facet edges facing away from the camera + a slow breathing glow inside
          float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
          totalEmissiveRadiance += vec3(1.0, 0.55, 0.12) * (rim * 0.45 + (0.08 + 0.07 * sin(uPulse * 2.4 + vCH * 3.0)) * smoothstep(0.2, 1.0, vCH));`);
    };
    rockMat = new THREE.MeshToonMaterial({ color: '#8a7a66', gradientMap: toonGradient() });
  }
  return { crystalMat: crystalMat!, rockMat: rockMat! };
}

/** One crystal of unit height: tapered hexagonal body + pyramid tip, y = 0..1 (used by the gradient). */
function geometries() {
  if (!crystalGeo) {
    const body = new THREE.CylinderGeometry(0.82, 1, 0.74, 6, 1);
    body.translate(0, 0.37, 0);
    const tip = new THREE.ConeGeometry(0.82, 0.26, 6, 1);
    tip.translate(0, 0.74 + 0.13, 0);
    const g = mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()])!;
    g.scale(1, 1 / 0.87, 1);
    g.computeVertexNormals(); // non-indexed → flat crystal facets
    crystalGeo = g;
    const r = new THREE.IcosahedronGeometry(1, 0);
    r.scale(1, 0.55, 1);
    r.computeVertexNormals(); // non-indexed → flat facets
    rockGeo = r;
  }
  return { crystalGeo: crystalGeo!, rockGeo: rockGeo! };
}

interface Piece { mesh: THREE.Mesh; delay: number; scale: THREE.Vector3; baseY: number }

export class GeoCrystals {
  readonly group = new THREE.Group();
  private pieces: Piece[] = [];

  /**
   * @param spots crystal roots in the group's local space: x, z, height, width, lean (rad, outward from `center`)
   */
  constructor(spots: { x: number; z: number; h: number; w: number; lean?: number; delay?: number }[], rocks: { x: number; z: number; s: number }[]) {
    const { crystalMat, rockMat } = materials();
    const { crystalGeo, rockGeo } = geometries();
    let seed = spots.length * 7.3;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (const s of spots) {
      const m = new THREE.Mesh(crystalGeo, crystalMat);
      m.position.set(s.x, 0, s.z);
      // lean outward from the cluster's centre line, plus a little random twist
      const out = Math.atan2(s.x, s.z);
      m.rotation.set(Math.cos(out) * (s.lean ?? 0.18), rnd() * Math.PI, Math.sin(out) * -(s.lean ?? 0.18));
      m.castShadow = true;
      const sc = new THREE.Vector3(s.w, s.h, s.w);
      m.scale.set(sc.x, 0.001, sc.z);
      this.group.add(m);
      this.pieces.push({ mesh: m, delay: s.delay ?? rnd() * 0.12, scale: sc, baseY: 0 });
    }
    for (const r of rocks) {
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(r.x, 0.05, r.z);
      m.rotation.set(rnd() * 0.6, rnd() * 6, rnd() * 0.6);
      m.scale.setScalar(0.001);
      m.castShadow = true;
      this.group.add(m);
      this.pieces.push({ mesh: m, delay: rnd() * 0.06, scale: new THREE.Vector3(r.s, r.s, r.s), baseY: 0.05 });
    }
  }

  /** Eruption: each piece shoots up with an overshoot after its own small delay. */
  grow(t: number) {
    pulse.value = performance.now() / 1000;
    for (const p of this.pieces) {
      const k = backOut(THREE.MathUtils.clamp((t - p.delay) / 0.32, 0, 1));
      p.mesh.scale.set(p.scale.x * Math.min(1, 0.4 + k * 0.6), Math.max(0.001, p.scale.y * k), p.scale.z * Math.min(1, 0.4 + k * 0.6));
    }
  }

  /** Retreat: crystals sink into the ground and thin out (0 → 1). */
  sink(t: number) {
    const k = THREE.MathUtils.clamp(t, 0, 1);
    for (const p of this.pieces) {
      const e = 1 - k * k;
      p.mesh.scale.set(p.scale.x * (0.6 + 0.4 * e), Math.max(0.001, p.scale.y * e), p.scale.z * (0.6 + 0.4 * e));
    }
  }

  dispose() { this.group.removeFromParent(); }

  // ------------------------------------------------------------------ presets
  /** Skill: a cell-wall of crystals across `width` metres — tall in the middle, smaller toward the ends. */
  static wall(width = 4) {
    const spots: { x: number; z: number; h: number; w: number; lean: number; delay: number }[] = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5;
      const centre = 1 - Math.abs(u) * 1.6;
      spots.push({ x: u * width, z: (i % 2 ? 0.25 : -0.2), h: 1.3 + centre * 1.6 + (i % 3) * 0.15, w: 0.38 + centre * 0.22, lean: 0.12 + Math.abs(u) * 0.5, delay: Math.abs(u) * 0.18 });
    }
    // small shards in front and behind
    for (let i = 0; i < 5; i++) spots.push({ x: (i / 4 - 0.5) * width * 0.8, z: i % 2 ? 0.75 : -0.7, h: 0.6 + (i % 2) * 0.3, w: 0.2, lean: 0.55, delay: 0.1 + i * 0.03 });
    const rocks = [];
    for (let i = 0; i < 8; i++) rocks.push({ x: (i / 7 - 0.5) * width * 1.1, z: (i % 2 ? 0.45 : -0.45), s: 0.35 + (i % 3) * 0.12 });
    return new GeoCrystals(spots, rocks);
  }

  /** Burst: a ring of `count` crystal clusters of `radius`, each 3 crystals leaning outward. */
  static ring(radius = 5.5, count = 8) {
    const spots: { x: number; z: number; h: number; w: number; lean: number; delay: number }[] = [];
    const rocks: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const cx = Math.cos(a) * radius, cz = Math.sin(a) * radius;
      const tx = -Math.sin(a), tz = Math.cos(a); // along the ring
      const d = i * 0.05;
      spots.push({ x: cx, z: cz, h: 3.2, w: 0.55, lean: 0.12, delay: d });
      spots.push({ x: cx + tx * 0.7 + Math.cos(a) * 0.2, z: cz + tz * 0.7 + Math.sin(a) * 0.2, h: 2.1, w: 0.4, lean: 0.35, delay: d + 0.06 });
      spots.push({ x: cx - tx * 0.65 - Math.cos(a) * 0.15, z: cz - tz * 0.65 - Math.sin(a) * 0.15, h: 1.6, w: 0.34, lean: 0.45, delay: d + 0.1 });
      rocks.push({ x: cx + Math.cos(a) * 0.4, z: cz + Math.sin(a) * 0.4, s: 0.55 }, { x: cx - Math.cos(a) * 0.3 + tx * 0.4, z: cz - Math.sin(a) * 0.3 + tz * 0.4, s: 0.4 });
    }
    return new GeoCrystals(spots, rocks);
  }
}

function backOut(t: number) { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
