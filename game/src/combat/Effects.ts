import * as THREE from 'three';
import { glow } from '../world/Materials';
import { fxTexture } from '../render/CombatFX';
import { efx, elementOfColor } from '../render/ElementFX';

export interface Effect {
  obj: THREE.Object3D;
  /** return false to remove */
  update(dt: number): boolean;
  dispose?(): void;
}

/** Ground shockwave for an AoE: a soft textured ring racing outward (ElementFX), plus a thin crisp edge. */
export class RingPulse implements Effect {
  obj: THREE.Mesh;
  private t = 0;
  constructor(pos: THREE.Vector3, private radius: number, color: string, private dur = 0.45, thick = 0.25) {
    const geo = new THREE.RingGeometry(1 - Math.min(thick, 0.12), 1, 48);
    geo.rotateX(-Math.PI / 2);
    this.obj = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.obj.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
    this.obj.scale.setScalar(0.2);
    efx()?.ring(pos, radius, elementOfColor(color), dur * 1.2);
  }
  update(dt: number) {
    this.t += dt;
    const p = this.t / this.dur;
    this.obj.scale.setScalar(0.2 + easeOut(p) * this.radius);
    (this.obj.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p) * (1 - p);
    return p < 1;
  }
  dispose() { this.obj.geometry.dispose(); (this.obj.material as THREE.Material).dispose(); }
}

/**
 * Explosion: element particles from ElementFX (flames, droplets, swirls, sparks, shards, leaves, rock chips) with a
 * flash and a shockwave ring.
 */
export class Blast implements Effect {
  obj = new THREE.Group();
  private t = 0;
  constructor(pos: THREE.Vector3, radius: number, color: string, private dur = 0.4) {
    efx()?.burst(pos, elementOfColor(color), radius);
  }
  update(dt: number) {
    this.t += dt;
    return this.t < this.dur;
  }
}

/**
 * Slash in front of the character: a glowing crescent (Kenney slash texture) that sweeps open and fades.
 * `flip` mirrors it for alternate combo hits so a chain reads as left/right swings.
 */
export class SlashArc implements Effect {
  obj: THREE.Mesh;
  private t = 0;
  private static n = 0;
  constructor(pos: THREE.Vector3, yaw: number, color: string, radius = 1.8, flip = false) {
    const geo = new THREE.PlaneGeometry(radius * 2.3, radius * 2.3);
    geo.rotateX(-Math.PI / 2);
    const tex = fxTexture(['slash_01', 'slash_02', 'slash_04'][SlashArc.n++ % 3]);
    const c = new THREE.Color(color === '#ffffff' ? '#fff4d8' : color).multiplyScalar(1.6);
    this.obj = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.obj.position.copy(pos).add(new THREE.Vector3(Math.sin(yaw) * radius * 0.35, 1.0, Math.cos(yaw) * radius * 0.35));
    this.obj.rotation.order = 'YXZ';
    this.obj.rotation.y = yaw + Math.PI; // crescent bulges away from the character
    this.obj.rotation.z = flip ? 0.45 : -0.35;
    if (flip) this.obj.scale.x = -1;
  }
  update(dt: number) {
    this.t += dt;
    const p = this.t / 0.22;
    (this.obj.material as THREE.MeshBasicMaterial).opacity = 1 - p * p;
    const sc = 0.75 + Math.min(1, p * 2.2) * 0.35;
    this.obj.scale.set(this.obj.scale.x < 0 ? -sc : sc, 1, sc);
    return p < 1;
  }
  dispose() { this.obj.geometry.dispose(); (this.obj.material as THREE.Material).dispose(); }
}

/** Telegraph circle that fills up before an enemy attack lands. */
export class Telegraph implements Effect {
  obj = new THREE.Group();
  private t = 0;
  private fill: THREE.Mesh;
  constructor(pos: THREE.Vector3, private radius: number, private dur: number, private onHit: () => void) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.15, radius, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    this.obj.add(ring, this.fill);
    this.obj.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0));
    this.fill.scale.setScalar(0.01);
  }
  update(dt: number) {
    this.t += dt;
    const p = Math.min(1, this.t / this.dur);
    this.fill.scale.setScalar(Math.max(0.01, p));
    if (this.t >= this.dur) { this.onHit(); return false; }
    return true;
  }
}

/** Generic timed object with custom tick (fields, walls, totems...). */
export class Timed implements Effect {
  t = 0;
  constructor(public obj: THREE.Object3D, public life: number, private tick: (dt: number, t: number, self: Timed) => void, private end?: () => void) {}
  update(dt: number) {
    this.t += dt;
    this.tick(dt, this.t, this);
    if (this.t >= this.life) { this.end?.(); return false; }
    return true;
  }
  kill() { this.life = 0; }
}

export function orbMesh(color: string, r = 0.18): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), glow(color, 1.8));
  return m;
}

function easeOut(t: number) { return 1 - Math.pow(1 - Math.min(1, t), 3); }
