import * as THREE from 'three';

/**
 * Far mountain ranges painted around the horizon (Genshin-style layered depth): two rings of silhouettes that
 * follow the player, unlit, each fading into the haze colour toward its foot. The nearer range is a deeper
 * blue-grey, the farther one lighter with a few snowy peaks, so the horizon reads as layers of distance.
 */
interface Layer { radius: number; base: number; height: number; seed: number; tint: string; haze: number; snow: number }

const LAYERS: Layer[] = [
  { radius: 360, base: -30, height: 95, seed: 3, tint: '#6f8cb4', haze: 0.35, snow: 0 },
  { radius: 385, base: -30, height: 150, seed: 11, tint: '#9cb4d4', haze: 0.55, snow: 1 },
];

function ridge(a: number, seed: number) {
  // sum of a few octaves around the circle (periodic in a) → peaks and saddles
  let h = 0, amp = 1, f = 3;
  for (let k = 0; k < 5; k++) {
    h += amp * (0.5 + 0.5 * Math.sin(a * f + seed * (k + 1.7)) * Math.cos(a * (f * 0.5 + 1) + seed * 0.37 * k));
    amp *= 0.55;
    f = Math.round(f * 2.1);
  }
  return Math.pow(h / 2.2, 1.6);
}

export class Backdrop {
  readonly group = new THREE.Group();
  private mats: THREE.ShaderMaterial[] = [];

  constructor() {
    for (const L of LAYERS) {
      const seg = 360;
      const pos = new Float32Array((seg + 1) * 2 * 3), hf = new Float32Array((seg + 1) * 2), idx: number[] = [];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2, x = Math.cos(a) * L.radius, z = Math.sin(a) * L.radius;
        const top = L.base + 20 + ridge(a, L.seed) * L.height;
        pos.set([x, L.base, z, x, top, z], i * 6);
        hf.set([0, 1], i * 2);
        if (i < seg) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('hf', new THREE.BufferAttribute(hf, 1));
      g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        fog: false,
        uniforms: { uTint: { value: new THREE.Color(L.tint) }, uHaze: { value: new THREE.Color('#d6e9f6') }, uHazeK: { value: L.haze }, uSnow: { value: L.snow }, uDay: { value: 1 } },
        vertexShader: `attribute float hf; varying float vH; varying float vY;
          void main() { vH = hf; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uTint; uniform vec3 uHaze; uniform float uHazeK; uniform float uSnow; uniform float uDay; varying float vH; varying float vY;
          void main() {
            // foot of the range dissolves into the haze; the crest keeps its colour; tall far peaks get snow
            vec3 c = mix(uHaze, uTint * mix(0.35, 1.0, uDay), (1.0 - uHazeK) * smoothstep(0.0, 0.9, vH));
            c = mix(c, mix(uHaze, vec3(1.0), 0.7 * uDay + 0.1), uSnow * smoothstep(70.0, 100.0, vY) * smoothstep(0.75, 1.0, vH));
            gl_FragColor = vec4(c, 1.0);
          }`,
      });
      this.mats.push(mat);
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      m.renderOrder = -0.5; // after the sky, before everything else
      this.group.add(m);
    }
  }

  /** Follow the player horizontally; haze = current fog/horizon colour, day 0..1. */
  update(center: THREE.Vector3, haze: THREE.Color, day: number, visible: boolean) {
    this.group.visible = visible;
    if (!visible) return;
    this.group.position.set(center.x, 0, center.z);
    for (const m of this.mats) { (m.uniforms.uHaze.value as THREE.Color).copy(haze); m.uniforms.uDay.value = day; }
  }
}
