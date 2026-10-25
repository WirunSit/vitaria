import * as THREE from 'three';
import { LOOK } from '../render/Look';
import { fbm, noise2 } from './Terrain';

/**
 * Bare-earth mask for the overworld, Genshin-style: worn dirt paths linking the landmarks, bare plazas around
 * sites and a few natural bald spots. 1024² over the island (~0.43 m/px), shared by the ground shader (sandy
 * dirt) and the grass field (no grass on dirt, thinner/shorter grass along the edges).
 */
const SIZE = 1024;

export class GroundMask {
  readonly data = new Uint8Array(SIZE * SIZE);
  readonly texture: THREE.DataTexture;
  /** 0 = old look (no dirt, original colours), 1 = Genshin-style ground */
  readonly enabled = { value: 1 };

  constructor(private worldSize: number) {
    this.texture = new THREE.DataTexture(this.data, SIZE, SIZE, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = this.texture.minFilter = THREE.LinearFilter;
  }

  private px(x: number) { return (x / this.worldSize + 0.5) * SIZE; }

  /** Soft disc of dirt (max-blended). */
  stamp(x: number, z: number, r: number, soft = 0.8) {
    const cx = this.px(x), cz = this.px(z), pr = (r / this.worldSize) * SIZE, ps = Math.max(1, (soft / this.worldSize) * SIZE);
    const x0 = Math.max(0, Math.floor(cx - pr - ps)), x1 = Math.min(SIZE - 1, Math.ceil(cx + pr + ps));
    const z0 = Math.max(0, Math.floor(cz - pr - ps)), z1 = Math.min(SIZE - 1, Math.ceil(cz + pr + ps));
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const d = Math.hypot(i - cx, j - cz);
        const v = d <= pr ? 255 : d >= pr + ps ? 0 : Math.round(255 * (1 - (d - pr) / ps));
        const k = j * SIZE + i;
        if (v > this.data[k]) this.data[k] = v;
      }
    }
  }

  /** Wavy worn path from a to b (skipped where `blocked` says so, e.g. water). */
  path(ax: number, az: number, bx: number, bz: number, width: number, blocked: (x: number, z: number) => boolean) {
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    const seed = ax * 0.13 + bz * 0.07;
    for (let t = 0; t <= len; t += 0.35) {
      const u = t / len;
      // meander: low-frequency sideways drift, tapered to 0 at both ends
      const off = (noise2(t * 0.025 + seed, seed) - 0.5) * 14 * Math.sin(u * Math.PI);
      const x = ax + (bx - ax) * u + nx * off, z = az + (bz - az) * u + nz * off;
      if (blocked(x, z)) continue;
      const w = width * (0.75 + noise2(t * 0.12, seed + 3) * 0.5);
      this.stamp(x, z, w * 0.5, 1.1);
    }
  }

  /** Natural bald patches from noise (cheap: evaluated on a 256 grid, written bilinearly). */
  patches(allow: (x: number, z: number) => boolean) {
    const G = 256, cell = this.worldSize / G;
    const g = new Float32Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const x = (i / G - 0.5) * this.worldSize, z = (j / G - 0.5) * this.worldSize;
      g[j * (G + 1) + i] = allow(x, z) ? fbm(x * 0.035 + 11, z * 0.035 - 7, 3) : 0;
    }
    const sc = G / SIZE;
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const fx = i * sc, fz = j * sc, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
      const a = g[iz * (G + 1) + ix], b = g[iz * (G + 1) + ix + 1], c = g[(iz + 1) * (G + 1) + ix], d = g[(iz + 1) * (G + 1) + ix + 1];
      const n = a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
      const v = Math.max(0, Math.min(255, Math.round((n - 0.66) / 0.05 * 255)));
      const k = j * SIZE + i;
      if (v > this.data[k]) this.data[k] = v;
    }
    void cell;
  }

  finish() { this.texture.needsUpdate = true; }

  /** 0..1 dirt amount at a world point (bilinear). */
  dirtAt(x: number, z: number): number {
    if (!this.enabled.value) return 0;
    const fx = Math.min(SIZE - 1.001, Math.max(0, this.px(x) - 0.5)), fz = Math.min(SIZE - 1.001, Math.max(0, this.px(z) - 0.5));
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, k = iz * SIZE + ix, D = this.data;
    const a = D[k], b = D[k + 1], c = D[k + SIZE], d = D[k + SIZE + 1];
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz) / 255;
  }

  /**
   * Ground shader hook: sandy dirt where the mask says so (keeps the detail texture's grain) and a livelier,
   * more saturated green elsewhere. `enabled` = 0 restores the original look.
   */
  applyTo(mat: THREE.MeshToonMaterial) {
    const worldSize = this.worldSize;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uDirt = { value: this.texture };
      shader.uniforms.uGroundOn = this.enabled;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundUV;\nvarying vec2 vWorldXZ;')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vec4 gwp = modelMatrix * vec4(transformed, 1.0);
          vWorldXZ = gwp.xz;
          vGroundUV = gwp.xz / ${worldSize.toFixed(1)} + 0.5;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uDirt;
          uniform float uGroundOn;
          varying vec2 vGroundUV;
          varying vec2 vWorldXZ;
          float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (uGroundOn > 0.5) {
            // Genshin-green meadow: pull red down relative to green (gold patches become sunlit yellow-green), +15% saturation
            // (only grass tones: sand, rock and snow have much more blue and are left alone)
            vec3 viv = diffuseColor.rgb;
            float grassy = 1.0 - smoothstep(0.22, 0.38, viv.b / max(viv.g, 0.01));
            viv.r = mix(viv.r, viv.g * 0.45, ${LOOK.v2 ? '0.0' : '0.7'} * grassy);
            float lum = dot(viv, vec3(0.3, 0.59, 0.11));
            viv = max(mix(vec3(lum), viv, 1.0 + ${LOOK.v2 ? '0.0' : '0.15'} * grassy), 0.0);
            // dirt: mask with a little per-pixel breakup on the edge, sandy with darker worn rim
            float m = texture2D(uDirt, vGroundUV).r;
            float br = gHash(floor(vWorldXZ * 3.0)) * 0.18 - 0.09;
            float dirt = smoothstep(0.32, 0.62, m + br);
            vec3 tex = diffuseColor.rgb / max(vColor.rgb, vec3(0.04));
            // warm packed earth, lighter in the middle of worn paths, a darker damp rim where it meets the grass
            float grain = gHash(floor(vWorldXZ * 1.3)) * 0.08;
            vec3 sand = mix(vec3(0.42, 0.29, 0.15), vec3(0.66, 0.5, 0.29), smoothstep(0.5, 0.95, m)) * (clamp(tex, 0.8, 1.12) + grain);
            sand *= mix(0.82, 1.0, smoothstep(0.32, 0.5, m));
            diffuseColor.rgb = mix(viv, sand, dirt);
          }`);
    };
    mat.needsUpdate = true;
  }
}
