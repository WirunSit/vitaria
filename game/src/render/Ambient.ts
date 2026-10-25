import * as THREE from 'three';

/**
 * Floating pollen by day and fireflies by night.
 *  · pollen: a light cloud around the player, but anchored in the world (positions wrap around the player in a
 *    44 m tile), so you run *through* it instead of dragging it along
 *  · fireflies: only at a few places (dense groves, the Enzyme Grove, the lake shore — see `setFireflySpots`),
 *    each drifting slowly and blinking on and off; they fade in near a swarm, dim gradually while the player runs
 *    (and scatter from right next to them), and come back when the player slows down
 */
const POLLEN = 160, TILE = 44;
const PER_SPOT = 26;

function dotTexture() {
  const dot = document.createElement('canvas');
  dot.width = dot.height = 32;
  const g = dot.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(dot);
}

export interface FireflySpot { x: number; y: number; z: number; r: number }

export class Ambient {
  /** both point clouds (add this to the scene) */
  points = new THREE.Group();
  private t = 0;
  private pollen: THREE.Points;
  private pollenBase = new Float32Array(POLLEN * 3);
  private pollenMat: THREE.PointsMaterial;
  private flies: THREE.Points | null = null;
  private flyBase = new Float32Array(0);
  private flyPhase = new Float32Array(0);
  private flyMat: THREE.PointsMaterial;
  private runFade = 1;
  private tex = dotTexture();

  constructor() {
    for (let i = 0; i < POLLEN; i++) {
      this.pollenBase[i * 3] = Math.random() * TILE;
      this.pollenBase[i * 3 + 1] = 0.4 + Math.random() * 5;
      this.pollenBase[i * 3 + 2] = Math.random() * TILE;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POLLEN * 3), 3));
    this.pollenMat = new THREE.PointsMaterial({
      size: 0.18, map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff4c0, toneMapped: false,
    });
    this.pollen = new THREE.Points(geo, this.pollenMat);
    this.pollen.frustumCulled = false;
    this.flyMat = new THREE.PointsMaterial({
      size: 0.6, map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, toneMapped: false,
    });
    this.points.add(this.pollen);
  }

  /** Where fireflies live (ground position + radius of each swarm). */
  setFireflySpots(spots: FireflySpot[]) {
    if (this.flies) { this.points.remove(this.flies); this.flies.geometry.dispose(); }
    const n = spots.length * PER_SPOT;
    this.flyBase = new Float32Array(n * 3);
    this.flyPhase = new Float32Array(n);
    spots.forEach((s, k) => {
      for (let j = 0; j < PER_SPOT; j++) {
        const i = k * PER_SPOT + j, a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * s.r;
        this.flyBase[i * 3] = s.x + Math.cos(a) * d;
        this.flyBase[i * 3 + 1] = s.y + 0.3 + Math.random() * 2.4;
        this.flyBase[i * 3 + 2] = s.z + Math.sin(a) * d;
        this.flyPhase[i] = Math.random() * 100;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.flies = new THREE.Points(geo, this.flyMat);
    this.flies.frustumCulled = false;
    this.points.add(this.flies);
  }

  /** day 0..1 (1 = full day) · speed = player's run speed (0 idle, 1 run, 1.6 sprint) */
  update(dt: number, center: THREE.Vector3, day: number, visible: boolean, speed = 0) {
    this.t += dt;
    this.points.visible = visible;
    if (!visible) return;
    const night = 1 - day;
    // running makes the little lights fade out gradually; standing still lets them come back
    this.runFade += ((speed > 0.3 ? 0.2 : 1) - this.runFade) * Math.min(1, dt * (speed > 0.3 ? 0.9 : 0.5));

    // pollen (daytime, fades out at night) — world-anchored, wrapped around the player
    this.pollen.visible = day > 0.05;
    if (this.pollen.visible) {
      this.pollenMat.opacity = 0.5 * day * (0.4 + 0.6 * this.runFade);
      const p = this.pollen.geometry.attributes.position as THREE.BufferAttribute;
      const half = TILE / 2;
      for (let i = 0; i < POLLEN; i++) {
        const k = i * 1.37;
        const wx = this.pollenBase[i * 3] + Math.sin(this.t * 0.3 + k) * 1.6;
        const wz = this.pollenBase[i * 3 + 2] + Math.cos(this.t * 0.25 + k) * 1.6;
        // nearest copy of this mote's tile position to the player
        const x = center.x + ((((wx - center.x + half) % TILE) + TILE) % TILE) - half;
        const z = center.z + ((((wz - center.z + half) % TILE) + TILE) % TILE) - half;
        p.setXYZ(i, x, center.y + this.pollenBase[i * 3 + 1] + Math.sin(this.t * 0.5 + k * 2) * 0.6, z);
      }
      p.needsUpdate = true;
    }

    // fireflies (night only, at their spots)
    const f = this.flies;
    if (!f) return;
    f.visible = night > 0.25;
    if (!f.visible) return;
    const pos = f.geometry.attributes.position as THREE.BufferAttribute;
    const col = f.geometry.attributes.color as THREE.BufferAttribute;
    const nightK = THREE.MathUtils.smoothstep(night, 0.25, 0.7);
    for (let i = 0; i < pos.count; i++) {
      const ph = this.flyPhase[i];
      let x = this.flyBase[i * 3] + Math.sin(this.t * 0.35 + ph) * 1.4 + Math.sin(this.t * 1.1 + ph * 3) * 0.25;
      let y = this.flyBase[i * 3 + 1] + Math.sin(this.t * 0.6 + ph * 2) * 0.5;
      let z = this.flyBase[i * 3 + 2] + Math.cos(this.t * 0.3 + ph) * 1.4 + Math.cos(this.t * 0.9 + ph * 2) * 0.25;
      const dx = x - center.x, dz = z - center.z;
      const d = Math.hypot(dx, dz);
      // scatter away and upward from the player when they come close
      if (d < 3) { const push = (3 - d) * 0.6; x += (dx / (d || 1)) * push; z += (dz / (d || 1)) * push; y += push * 0.4; }
      pos.setXYZ(i, x, y, z);
      // blink: glow for ~1 s, dark for ~2 s, each on its own rhythm
      const cyc = (this.t * 0.33 + ph) % 1;
      const blink = cyc < 0.35 ? Math.sin((cyc / 0.35) * Math.PI) : 0;
      const near = (1 - THREE.MathUtils.smoothstep(d, 30, 48)) * (d < 2 ? d / 2 : 1);
      const b = blink * near * nightK * this.runFade * 3;
      col.setXYZ(i, b * 0.85, b, b * 0.35);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}
