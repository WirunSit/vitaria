import * as THREE from 'three';
import {
  ApplyForce, BatchedRenderer, Bezier, CircleEmitter, ColorOverLife, ConeEmitter, ConstantValue, Gradient, IntervalValue, Noise,
  OrbitOverLife, ParticleSystem, PiecewiseBezier, PointEmitter, RandomColor, RenderMode, RotationOverLife, SizeOverLife, SphereEmitter,
  Vector3 as QV3, Vector4 as QV4,
} from 'three.quarks';
import type { Element } from '../core/types';
import { ELEMENT_COLOR } from '../core/types';
import { fxMaterial, fxTexture, registerFxTexture } from './CombatFX';

/**
 * Elemental particle library for skills and bursts (three.quarks + Kenney Particle Pack, plus flame / leaf / shard
 * sprites drawn in code). Every element has its own "motif":
 *   Pyro flames + embers · Hydro droplets + mist · Anemo swirls · Electro crackling sparks · Cryo ice shards + snow ·
 *   Dendro leaves + motes · Geo rock chips + gold glints.
 * Entry points: `cast` (magic circle under the caster), `burst` (explosion), `ring` (ground shockwave),
 * `attach` (looping trail / field / swirl that follows an object) and `streak` (sparks along a line).
 * Colours go above 1.0 so the bloom pass catches them. Systems share materials so they batch into few draw calls.
 */
type El = Element | 'PHYSICAL';

/** sprites that are pure light and stay additive */
const GLOW = new Set(['light_01', 'magic_03', 'trace_01', 'trace_04', 'star_01', 'star_04', 'star_06', 'flare_01', 'spark_05']);
const ALL_TEX = ['circle_05', 'flare_01', 'light_01', 'light_03', 'magic_01', 'magic_02', 'magic_03', 'smoke_03', 'spark_01', 'spark_02', 'spark_04', 'spark_05', 'star_01', 'star_04', 'star_06', 'trace_01', 'trace_04', 'twirl_01', 'twirl_02'];

const ZERO_ONE_ZERO = new Gradient([[new QV3(1, 1, 1), 0], [new QV3(1, 1, 1), 1]], [[0, 0], [1, 0.15], [1, 0.6], [0, 1]]);
const FADE = new Gradient([[new QV3(1, 1, 1), 0], [new QV3(1, 1, 1), 1]], [[1, 0], [0, 1]]);
const SHRINK = new PiecewiseBezier([[new Bezier(1, 0.9, 0.5, 0), 0]]);
const GROW = new PiecewiseBezier([[new Bezier(0.35, 0.8, 1, 1.1), 0]]);
const POP = new PiecewiseBezier([[new Bezier(0.2, 1.1, 1.05, 0.85), 0]]);
const FLAME = new Gradient(
  [[new QV3(1, 0.95, 0.75), 0], [new QV3(1, 0.62, 0.22), 0.3], [new QV3(0.9, 0.25, 0.08), 0.7], [new QV3(0.35, 0.08, 0.05), 1]],
  [[0, 0], [1, 0.12], [0.8, 0.55], [0, 1]],
);

function tint(el: El): THREE.Color {
  if (el === 'PHYSICAL') return new THREE.Color('#fff2d6');
  return new THREE.Color(ELEMENT_COLOR[el]);
}
const v4 = (c: THREE.Color, k: number, a = 1) => new QV4(c.r * k, c.g * k, c.b * k, a);

/** Sprites the Kenney pack doesn't have, drawn once on a canvas. */
function makeSprites() {
  const make = (name: string, draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.translate(32, 32);
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    registerFxTexture(name, t);
  };
  const soft = (g: CanvasRenderingContext2D, r: number) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    return grad;
  };
  // flame tongue: soft-edged teardrop (blurred), solid at the base and fading out to a wispy tip, hot core low down
  make('fx_flame', (g) => {
    g.filter = 'blur(2.5px)';
    const fade = g.createLinearGradient(0, 28, 0, -30);
    fade.addColorStop(0, 'rgba(255,255,255,0.95)');
    fade.addColorStop(0.55, 'rgba(255,255,255,0.7)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fade;
    g.beginPath();
    g.moveTo(1, -30);
    g.bezierCurveTo(10, -12, 20, 6, 13, 18);
    g.bezierCurveTo(7, 27, -7, 27, -13, 18);
    g.bezierCurveTo(-20, 6, -9, -10, 1, -30);
    g.fill();
    const core = g.createRadialGradient(0, 12, 0, 0, 12, 13);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(0, 12, 13, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
  });
  // leaf with a midrib
  make('fx_leaf', (g) => {
    g.rotate(0.5);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(0, -28);
    g.quadraticCurveTo(20, 0, 0, 28);
    g.quadraticCurveTo(-20, 0, 0, -28);
    g.fill();
    g.strokeStyle = 'rgba(120,120,120,0.6)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 24); g.stroke();
  });
  // crystal shard / rock chip
  make('fx_shard', (g) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(0, -30); g.lineTo(11, -4); g.lineTo(5, 28); g.lineTo(-8, 22); g.lineTo(-12, -6);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.moveTo(0, -30); g.lineTo(11, -4); g.lineTo(0, 4); g.closePath(); g.fill();
  });
}

interface Spec {
  tex: string;
  mode?: RenderMode;
  /** blending override; by default only glow sprites (flashes, streaks, glints, tiny motes) are additive — every
   *  other particle uses normal blending in the element's own colour so it reads on bright grass even without bloom */
  add?: boolean;
  count?: number;              // burst count
  rate?: number;               // per-second emission (looping systems)
  life: [number, number];
  speed: [number, number];
  size: [number, number];
  color: QV4 | [QV4, QV4];
  colorLife?: Gradient;
  sizeLife?: PiecewiseBezier;
  shape?: 'sphere' | 'up' | 'ring' | 'disc' | 'point';
  radius?: number;
  angle?: number;              // cone half-angle for 'up'
  gravity?: number;            // + falls, - rises
  spin?: [number, number];     // angular velocity (rad/s)
  orbit?: number;              // orbit speed around the emitter's Y axis
  noise?: number;
  stretch?: number;            // stretched billboard speed factor
  duration?: number;
  /** simulate in the emitter's space (particles travel with the object) */
  local?: boolean;
}

export class ElementFX {
  constructor(private scene: THREE.Scene, private batch: BatchedRenderer) {
    makeSprites();
    // load every sprite now, or the first skill of a session would draw before its textures arrive
    for (const t of ALL_TEX) { fxTexture(t); fxTexture(t + '_w'); }
  }

  private sys(o: Spec, at: THREE.Vector3 | THREE.Object3D, looping = false) {
    const add = o.add ?? (GLOW.has(o.tex) || (o.tex === 'circle_05' && o.size[1] <= 0.2));
    // normal-blended colours must stay ≤ 1 or they clip to white: keep the hue, scale the brightest channel to 1
    const fit = (v: QV4) => { if (add) return v; const m = Math.max(1, v.x, v.y, v.z); return new QV4(v.x / m, v.y / m, v.z / m, v.w); };
    const [ca, cb] = Array.isArray(o.color) ? o.color : [o.color, o.color];
    const col = new RandomColor(fit(ca), fit(cb));
    const shape = o.shape === 'up' ? new ConeEmitter({ radius: o.radius ?? 0.2, angle: o.angle ?? 0.35, thickness: 1 })
      : o.shape === 'ring' ? new CircleEmitter({ radius: o.radius ?? 1, thickness: 0.05 })
      : o.shape === 'disc' ? new CircleEmitter({ radius: o.radius ?? 1, thickness: 1 })
      : o.shape === 'point' ? new PointEmitter()
      : new SphereEmitter({ radius: o.radius ?? 0.3, thickness: 1 });
    const ps = new ParticleSystem({
      duration: o.duration ?? (looping ? 1 : o.life[1] + 0.05),
      looping,
      autoDestroy: true,
      // orbiting particles must live in the emitter's space (in world space they'd orbit the world origin);
      // that also makes them travel with a moving tornado / ring
      worldSpace: !(o.orbit || o.local),
      startLife: new IntervalValue(o.life[0], o.life[1]),
      startSpeed: new IntervalValue(o.speed[0], o.speed[1]),
      startSize: new IntervalValue(o.size[0], o.size[1]),
      startRotation: new IntervalValue(0, Math.PI * 2),
      startColor: col,
      emissionOverTime: new ConstantValue(o.rate ?? 0),
      emissionBursts: o.count ? [{ time: 0, count: new ConstantValue(o.count), cycle: 1, interval: 0.01, probability: 1 }] : [],
      shape,
      material: fxMaterial(o.tex, !add),
      renderMode: o.mode ?? RenderMode.BillBoard,
      speedFactor: o.stretch ?? 0,
      renderOrder: 2,
    });
    ps.addBehavior(new ColorOverLife(o.colorLife ?? FADE));
    ps.addBehavior(new SizeOverLife(o.sizeLife ?? SHRINK));
    // shapes that are tipped over (see below) have their local +Z pointing up; matters for local-space systems
    const tipped = o.shape === 'up' || o.shape === 'ring' || o.shape === 'disc';
    const up = o.orbit && tipped ? new QV3(0, 0, 1) : new QV3(0, 1, 0);
    if (o.gravity) ps.addBehavior(new ApplyForce(new QV3(-up.x, -up.y, -up.z), new ConstantValue(o.gravity)));
    if (o.spin) ps.addBehavior(new RotationOverLife(new IntervalValue(o.spin[0], o.spin[1])));
    if (o.orbit) ps.addBehavior(new OrbitOverLife(new ConstantValue(o.orbit), up));
    if (o.noise) ps.addBehavior(new Noise(new ConstantValue(0.6), new ConstantValue(o.noise)));
    // emitter shapes emit along local +Z / lie in local XY: tip them so "up" is up and rings lie on the ground
    if (o.shape === 'up' || o.shape === 'ring' || o.shape === 'disc') ps.emitter.rotation.x = -Math.PI / 2;
    if (at instanceof THREE.Vector3) {
      ps.emitter.position.copy(at);
      this.scene.add(ps.emitter);
    } else at.add(ps.emitter);
    this.batch.addSystem(ps);
    return ps;
  }

  /** The element's signature particles, scaled by `k` (explosions, impacts). */
  private motif(el: El, at: THREE.Vector3, k: number) {
    const c = tint(el);
    const n = (x: number) => Math.max(1, Math.round(x * k));
    switch (el) {
      case 'PYRO':
        this.sys({ tex: 'fx_flame', count: n(16), life: [0.35, 0.75], speed: [1.5, 4 * k], size: [0.6 * k, 1.3 * k], color: new QV4(2.4, 1.6, 0.8, 1), colorLife: FLAME, sizeLife: POP, gravity: -4, radius: 0.4 * k }, at);
        this.sys({ tex: 'circle_05', count: n(26), life: [0.5, 1.1], speed: [3, 9 * k], size: [0.07, 0.16], color: new QV4(3, 1.4, 0.4, 1), gravity: -1.5, noise: 1.5, radius: 0.3 }, at);
        this.sys({ tex: 'smoke_03', count: n(5), life: [0.8, 1.4], speed: [0.6, 1.4], size: [1 * k, 1.8 * k], color: new QV4(0.25, 0.2, 0.2, 0.45), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, gravity: -1.2, radius: 0.5 * k }, at);
        break;
      case 'HYDRO':
        this.sys({ tex: 'circle_05', shape: 'up', angle: 0.9, count: n(30), life: [0.45, 0.9], speed: [4, 9 * k], size: [0.1, 0.26], color: [v4(c, 1.6), new QV4(1.4, 1.7, 2, 1)], gravity: 14, radius: 0.4 * k }, at);
        this.sys({ tex: 'trace_01', mode: RenderMode.StretchedBillBoard, stretch: 0.06, count: n(14), life: [0.2, 0.35], speed: [6, 12 * k], size: [0.25, 0.4], color: v4(c, 2), gravity: 6, radius: 0.3 }, at);
        this.sys({ tex: 'smoke_03', count: n(6), life: [0.6, 1], speed: [0.5, 1.5], size: [1.2 * k, 2 * k], color: new QV4(0.6, 0.85, 1.2, 0.35), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, radius: 0.6 * k }, at);
        break;
      case 'ANEMO':
        this.sys({ tex: 'twirl_01', count: n(5), life: [0.45, 0.7], speed: [0, 0.3], size: [1.6 * k, 2.6 * k], color: v4(c, 2.2), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, spin: [5, 9], radius: 0.2 }, at);
        this.sys({ tex: 'twirl_02', count: n(4), life: [0.5, 0.8], speed: [0, 0.3], size: [2.4 * k, 3.4 * k], color: v4(c, 1.6), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, spin: [-8, -5], radius: 0.2 }, at);
        this.sys({ tex: 'trace_01', mode: RenderMode.StretchedBillBoard, stretch: 0.08, shape: 'ring', radius: 1.2 * k, count: n(18), life: [0.4, 0.7], speed: [1, 3], size: [0.2, 0.35], color: v4(c, 2.4), orbit: 7, gravity: -2 }, at);
        break;
      case 'ELECTRO':
        for (const [t, d] of [['spark_01', 0], ['spark_02', 0.08], ['spark_04', 0.16]] as const) {
          const ps = this.sys({ tex: t, count: n(4), life: [0.1, 0.22], speed: [0, 1], size: [1 * k, 2 * k], color: [v4(c, 1), new QV4(0.95, 0.85, 1, 1)], sizeLife: POP, spin: [-3, 3], radius: 0.6 * k }, at);
          ps.emissionBursts = [{ time: d, count: new ConstantValue(n(4)), cycle: 1, interval: 0.01, probability: 1 }];
        }
        this.sys({ tex: 'spark_05', count: n(4), life: [0.12, 0.2], speed: [0, 0.5], size: [1.8 * k, 2.6 * k], color: new QV4(2.4, 1.9, 3.4, 1), spin: [-1, 1], radius: 0.8 * k }, at);
        this.sys({ tex: 'circle_05', count: n(20), life: [0.2, 0.45], speed: [5, 11 * k], size: [0.06, 0.12], color: new QV4(2.6, 2, 3.4, 1), radius: 0.3 }, at);
        break;
      case 'CRYO':
        this.sys({ tex: 'fx_shard', count: n(18), life: [0.5, 0.9], speed: [4, 9 * k], size: [0.25, 0.55], color: [v4(c, 1.8), new QV4(2, 2.3, 2.6, 1)], gravity: 10, spin: [-8, 8], radius: 0.4 * k, shape: 'up', angle: 1.1 }, at);
        this.sys({ tex: 'circle_05', count: n(30), life: [1, 1.8], speed: [0.5, 2.5], size: [0.05, 0.12], color: new QV4(2, 2.3, 2.6, 1), gravity: 0.8, noise: 0.6, radius: 1 * k }, at);
        this.sys({ tex: 'smoke_03', count: n(6), life: [0.8, 1.3], speed: [0.4, 1.2], size: [1.4 * k, 2.4 * k], color: new QV4(0.8, 1, 1.2, 0.35), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, radius: 0.8 * k }, at);
        break;
      case 'DENDRO':
        this.sys({ tex: 'fx_leaf', count: n(16), life: [0.9, 1.6], speed: [2, 5 * k], size: [0.22, 0.4], color: [new QV4(0.45, 0.85, 0.25, 1), new QV4(0.7, 0.95, 0.3, 1)], colorLife: ZERO_ONE_ZERO, gravity: 1.2, spin: [-4, 4], noise: 1, radius: 0.5 * k }, at);
        this.sys({ tex: 'circle_05', count: n(24), life: [0.7, 1.3], speed: [1, 4], size: [0.08, 0.16], color: new QV4(1.6, 2.4, 0.8, 1), gravity: -1.2, noise: 0.8, radius: 0.6 * k }, at);
        this.sys({ tex: 'star_04', count: n(6), life: [0.4, 0.7], speed: [0.5, 2], size: [0.5, 0.9], color: new QV4(1.8, 2.6, 1, 1), sizeLife: POP, radius: 0.8 * k }, at);
        break;
      case 'GEO':
        this.sys({ tex: 'fx_shard', count: n(18), life: [0.6, 1], speed: [5, 9 * k], size: [0.3, 0.7], color: [new QV4(0.75, 0.55, 0.3, 1), new QV4(0.95, 0.75, 0.4, 1)], gravity: 16, spin: [-10, 10], shape: 'up', angle: 0.9, radius: 0.5 * k }, at);
        this.sys({ tex: 'star_06', count: n(10), life: [0.3, 0.6], speed: [1, 4], size: [0.4, 0.8], color: new QV4(2.8, 2.1, 0.8, 1), sizeLife: POP, radius: 0.6 * k }, at);
        this.sys({ tex: 'smoke_03', count: n(6), life: [0.7, 1.2], speed: [0.8, 2], size: [1.2 * k, 2 * k], color: new QV4(0.75, 0.62, 0.45, 0.5), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, radius: 0.6 * k }, at);
        break;
      default:
        this.sys({ tex: 'smoke_03', count: n(6), life: [0.5, 0.9], speed: [1, 2.5], size: [0.9 * k, 1.6 * k], color: new QV4(0.9, 0.86, 0.8, 0.45), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, radius: 0.4 * k }, at);
        this.sys({ tex: 'star_06', count: n(6), life: [0.2, 0.4], speed: [2, 5], size: [0.4, 0.7], color: new QV4(2.4, 2.3, 2, 1), radius: 0.3 }, at);
    }
  }

  /** Explosion: flash + element motif + ground shockwave. `radius` ≈ the AoE in metres. */
  burst(pos: THREE.Vector3, el: El, radius = 3) {
    const k = THREE.MathUtils.clamp(radius / 3, 0.6, 2.2);
    const c = tint(el);
    this.sys({ tex: 'light_01', shape: 'point', count: 1, life: [0.16, 0.2], speed: [0, 0], size: [radius * 1.0, radius * 1.2], color: v4(c, 1.5), sizeLife: POP }, pos);
    this.sys({ tex: 'magic_03', shape: 'point', count: 1, life: [0.14, 0.18], speed: [0, 0], size: [radius * 0.7, radius * 0.85], color: v4(c.clone().lerp(new THREE.Color('#ffffff'), 0.4), 1.3), sizeLife: POP, spin: [-1, 1] }, pos);
    this.motif(el, pos, k);
    this.ring(pos.clone().setY(pos.y - 0.9), radius, el);
  }

  /** Ground shockwave ring (soft textured ring that races outward). */
  ring(pos: THREE.Vector3, radius: number, el: El, dur = 0.5) {
    const c = tint(el);
    this.sys({ tex: 'light_03', mode: RenderMode.HorizontalBillBoard, shape: 'point', count: 1, life: [dur, dur], speed: [0, 0], size: [radius * 2.2, radius * 2.2], color: v4(c, 2, 0.5), colorLife: FADE, sizeLife: new PiecewiseBezier([[new Bezier(0.15, 0.85, 1, 1), 0]]) }, pos.clone().setY(pos.y + 0.12));
  }

  /**
   * Cast flourish under the caster: a turning rune circle on the ground, a burst of rising element particles and
   * (for bursts) a column of light streaks shooting up plus a shockwave.
   */
  cast(pos: THREE.Vector3, el: El, big: boolean) {
    const c = tint(el);
    const R = big ? 3.4 : 2;
    const ground = pos.clone().setY(pos.y + 0.08);
    this.sys({ tex: big ? 'magic_02' : 'magic_01', mode: RenderMode.HorizontalBillBoard, shape: 'point', count: 1, life: [big ? 1.5 : 1, big ? 1.5 : 1], speed: [0, 0], size: [R * 2, R * 2], color: v4(c, 2.6), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, spin: [big ? 1.6 : 2.4, big ? 1.6 : 2.4] }, ground);
    this.sys({ tex: big ? 'magic_02' : 'magic_01', add: true, mode: RenderMode.HorizontalBillBoard, shape: 'point', count: 1, life: [big ? 1.5 : 1, big ? 1.5 : 1], speed: [0, 0], size: [R * 2.1, R * 2.1], color: v4(c, 1.4), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, spin: [big ? 1.6 : 2.4, big ? 1.6 : 2.4] }, ground);
    this.sys({ tex: 'light_03', mode: RenderMode.HorizontalBillBoard, shape: 'point', count: 1, life: [0.6, 0.6], speed: [0, 0], size: [R * 1.3, R * 1.3], color: v4(c, 1.8, 0.4), colorLife: ZERO_ONE_ZERO, sizeLife: GROW }, ground);
    // rising motes around the circle
    this.sys({ tex: 'circle_05', shape: 'ring', radius: R * 0.8, count: big ? 40 : 22, life: [0.6, 1.1], speed: [0.2, 0.8], size: [0.08, 0.18], color: v4(c, 2.6), gravity: big ? -5 : -3.5, noise: 0.4 }, ground);
    this.motif(el, pos.clone().setY(pos.y + 1), big ? 0.9 : 0.55);
    if (big) {
      this.sys({ tex: 'trace_01', mode: RenderMode.StretchedBillBoard, stretch: 0.09, shape: 'disc', radius: 1.2, count: 30, life: [0.35, 0.6], speed: [12, 20], size: [0.35, 0.6], color: v4(c.clone().lerp(new THREE.Color('#ffffff'), 0.35), 2.6), gravity: 0 }, ground)
        .emitter.rotation.set(-Math.PI / 2, 0, 0);
      this.sys({ tex: 'light_01', shape: 'point', count: 1, life: [0.35, 0.4], speed: [0, 0], size: [5, 6], color: v4(c, 1.8), sizeLife: POP }, pos.clone().setY(pos.y + 1.2));
      this.ring(pos, 5, el, 0.7);
    }
  }

  /**
   * Looping particles that follow `obj` until `stop()`:
   *  'trail' — element sparks/flames left behind a moving object
   *  'field' — particles rising from a ground disc of `radius`
   *  'swirl' — particles orbiting the object's Y axis at `radius` (tornadoes, water rings)
   */
  attach(obj: THREE.Object3D, el: El, kind: 'trail' | 'field' | 'swirl', radius = 1, rate = 1) {
    const c = tint(el);
    const sys: ParticleSystem[] = [];
    const add = (o: Spec) => sys.push(this.sys({ ...o, rate: (o.rate ?? 10) * rate }, obj, true));
    const motifTex: Record<El, string> = { PYRO: 'fx_flame', HYDRO: 'circle_05', ANEMO: 'twirl_02', ELECTRO: 'spark_04', CRYO: 'circle_05', DENDRO: 'fx_leaf', GEO: 'star_06', PHYSICAL: 'star_06' };
    if (kind === 'trail') {
      if (el === 'PYRO') add({ tex: 'fx_flame', rate: 26, life: [0.25, 0.5], speed: [0.2, 0.8], size: [0.35, 0.7], color: new QV4(2.4, 1.6, 0.8, 1), colorLife: FLAME, sizeLife: POP, gravity: -3, radius: 0.15 });
      else if (el === 'ELECTRO') add({ tex: 'spark_04', rate: 30, life: [0.08, 0.16], speed: [0, 0.4], size: [0.6, 1.1], color: v4(c, 1), spin: [-4, 4], radius: 0.3 });
      else add({ tex: motifTex[el], rate: 18, life: [0.4, 0.8], speed: [0.2, 1], size: [0.12, 0.28], color: el === 'DENDRO' ? new QV4(0.5, 0.9, 0.3, 1) : v4(c, 2.2), gravity: el === 'CRYO' || el === 'HYDRO' ? 2 : -0.5, spin: [-3, 3], radius: 0.2 });
      add({ tex: 'circle_05', rate: 16, life: [0.3, 0.6], speed: [0.1, 0.6], size: [0.05, 0.11], color: v4(c, 2.8), radius: 0.15, noise: 0.5 });
    } else if (kind === 'field') {
      const area = Math.max(1, radius * radius / 9);
      if (el === 'PYRO') add({ tex: 'fx_flame', shape: 'disc', radius, rate: 18 * area, life: [0.5, 1], speed: [0.1, 0.4], size: [0.5, 1.1], color: new QV4(2.2, 1.4, 0.7, 1), colorLife: FLAME, sizeLife: POP, gravity: -2.5 });
      add({ tex: motifTex[el], shape: 'disc', radius, rate: 10 * area, life: [1, 2], speed: [0.1, 0.5], size: el === 'DENDRO' ? [0.2, 0.35] : [0.08, 0.18], color: el === 'DENDRO' ? new QV4(0.5, 0.9, 0.3, 1) : v4(c, 2.4), colorLife: ZERO_ONE_ZERO, gravity: el === 'CRYO' ? 0.4 : -0.8, noise: 0.5, spin: [-2, 2] });
      add({ tex: 'circle_05', shape: 'disc', radius, rate: 8 * area, life: [1, 1.8], speed: [0.1, 0.3], size: [0.06, 0.12], color: v4(c, 2.8), colorLife: ZERO_ONE_ZERO, gravity: -0.6, noise: 0.4 });
    } else {
      // swirl: element-shaped sprites circling and climbing — wind arcs, water arcs, ice shards, or glowing motes
      const swirlTex: Partial<Record<El, string>> = { ANEMO: 'twirl_01', HYDRO: 'twirl_02', CRYO: 'fx_shard' };
      const tex = swirlTex[el];
      if (tex) add({ tex, shape: 'ring', radius, rate: 34, life: [0.7, 1.2], speed: [0, 0.3], size: el === 'CRYO' ? [0.3, 0.6] : [1.3, 2.1], color: [v4(c, 1), new QV4(0.95, 1, 1, 0.9)], colorLife: ZERO_ONE_ZERO, orbit: 4.5, gravity: -1.4, spin: [2, 6] });
      add({ tex: 'circle_05', shape: 'ring', radius, rate: 44, life: [0.6, 1.1], speed: [0, 0.4], size: [0.22, 0.4], color: v4(c, 1.1), colorLife: ZERO_ONE_ZERO, orbit: 5, gravity: -1.8, noise: 0.3 });
      add({ tex: 'trace_01', mode: RenderMode.StretchedBillBoard, stretch: 0.06, shape: 'ring', radius: radius * 0.9, rate: 18, life: [0.4, 0.7], speed: [0.5, 1.5], size: [0.35, 0.55], color: v4(c, 2.4), orbit: 6, gravity: -2.5 });
      if (el === 'CRYO' || el === 'HYDRO') add({ tex: 'smoke_03', shape: 'ring', radius, rate: 6, life: [0.8, 1.4], speed: [0, 0.2], size: [1.2, 2], color: el === 'CRYO' ? new QV4(0.9, 0.97, 1, 0.35) : new QV4(0.6, 0.85, 1, 0.3), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, orbit: 3 });
    }
    return {
      stop() { for (const s of sys) { s.endEmit(); if (s.emitter.parent && !(s.emitter.parent instanceof THREE.Scene)) s.emitter.removeFromParent(); } },
    };
  }

  /**
   * A living fireball on `obj` (radius ≈ `size`): white-hot core glow, flickering flame tongues around it (they move
   * with the ball) and a trail of flames, embers and thin smoke left behind in the world. `k` scales emission.
   */
  flameBall(obj: THREE.Object3D, size = 0.2, k = 1) {
    const sys: ParticleSystem[] = [];
    const add = (o: Spec) => sys.push(this.sys({ ...o, rate: (o.rate ?? 10) * k }, obj, true));
    // core: bright pulsing glow + hot inner flames
    add({ tex: 'light_01', add: true, local: true, shape: 'point', rate: 30, life: [0.08, 0.12], speed: [0, 0], size: [size * 2.2, size * 2.6], color: new QV4(2.2, 1.1, 0.35, 1), sizeLife: POP });
    add({ tex: 'fx_flame', add: true, local: true, radius: size * 0.35, rate: 40, life: [0.14, 0.22], speed: [0.1, 0.5], size: [size * 1.1, size * 1.7], color: new QV4(2.6, 1.6, 0.6, 1), colorLife: FLAME, sizeLife: POP });
    // flame tongues licking around the ball
    add({ tex: 'fx_flame', add: true, local: true, radius: size * 0.6, rate: 70, life: [0.18, 0.32], speed: [0.3, 1], size: [size * 1.9, size * 3], color: new QV4(1.9, 1.05, 0.38, 1), colorLife: FLAME, sizeLife: POP, gravity: -5, spin: [-2, 2] });
    // solid orange-red outer tongues keep the colour readable in daylight (additive alone washes out to yellow)
    add({ tex: 'fx_flame', local: true, radius: size * 0.7, rate: 34, life: [0.2, 0.34], speed: [0.4, 1.1], size: [size * 2, size * 3.2], color: new QV4(1, 0.42, 0.1, 0.85), colorLife: FLAME, sizeLife: POP, gravity: -5, spin: [-2, 2] });
    // trail left in the world: flames, embers, smoke
    add({ tex: 'fx_flame', add: true, radius: size * 0.4, rate: 35, life: [0.2, 0.42], speed: [0, 0.4], size: [size * 1.4, size * 2.3], color: new QV4(1.7, 0.85, 0.3, 1), colorLife: FLAME, sizeLife: SHRINK, gravity: -3 });
    add({ tex: 'circle_05', radius: size * 0.5, rate: 45, life: [0.3, 0.6], speed: [0.3, 1.5], size: [0.05, 0.12], color: new QV4(3, 1.4, 0.4, 1), gravity: -1.5, noise: 1.2 });
    add({ tex: 'smoke_03', radius: size * 0.4, rate: 10, life: [0.5, 0.8], speed: [0.1, 0.4], size: [size * 2, size * 3.2], color: new QV4(0.22, 0.18, 0.16, 0.3), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, gravity: -1 });
    return {
      stop() { for (const s of sys) { s.endEmit(); if (s.emitter.parent && !(s.emitter.parent instanceof THREE.Scene)) s.emitter.removeFromParent(); } },
    };
  }

  /**
   * A wind orb on `obj` (radius ≈ `size`): soft mint core, wind arcs spinning fast around it (mint outside, white
   * inside), streaks orbiting the ball, and a trail of fading swirls, streaks and a few leaves caught in the gust.
   */
  windBall(obj: THREE.Object3D, size = 0.2, k = 1) {
    const sys: ParticleSystem[] = [];
    const add = (o: Spec) => sys.push(this.sys({ ...o, rate: (o.rate ?? 10) * k }, obj, true));
    const mint = new QV4(0.42, 0.9, 0.76, 0.9);
    add({ tex: 'light_01', add: true, local: true, shape: 'point', rate: 26, life: [0.1, 0.14], speed: [0, 0], size: [size * 1.9, size * 2.3], color: new QV4(0.9, 1.7, 1.45, 1), sizeLife: POP });
    // spinning wind arcs (normal-blend mint so they read on grass, + bright white inner swirl)
    add({ tex: 'twirl_01', local: true, shape: 'point', rate: 20, life: [0.28, 0.42], speed: [0, 0], size: [size * 2.6, size * 3.4], color: mint, colorLife: ZERO_ONE_ZERO, sizeLife: GROW, spin: [9, 13] });
    add({ tex: 'twirl_02', add: true, local: true, shape: 'point', rate: 14, life: [0.25, 0.38], speed: [0, 0], size: [size * 1.7, size * 2.3], color: new QV4(1.3, 2, 1.8, 1), colorLife: ZERO_ONE_ZERO, spin: [-13, -9] });
    add({ tex: 'trace_01', add: true, mode: RenderMode.StretchedBillBoard, stretch: 0.05, shape: 'ring', radius: size * 1.2, rate: 34, life: [0.18, 0.3], speed: [0, 0.3], size: [size * 0.6, size * 0.9], color: new QV4(1.2, 2, 1.7, 1), orbit: 10 });
    // trail left in the world
    add({ tex: 'twirl_02', radius: size * 0.3, rate: 14, life: [0.35, 0.6], speed: [0, 0.3], size: [size * 1.6, size * 2.4], color: new QV4(0.5, 0.92, 0.8, 0.7), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, spin: [3, 6] });
    add({ tex: 'trace_01', add: true, mode: RenderMode.StretchedBillBoard, stretch: 0.06, radius: size * 0.6, rate: 22, life: [0.2, 0.35], speed: [0.5, 1.5], size: [size * 0.5, size * 0.8], color: new QV4(1, 1.8, 1.5, 1), noise: 0.8 });
    add({ tex: 'fx_leaf', radius: size * 0.8, rate: 5, life: [0.6, 1], speed: [0.5, 1.5], size: [0.12, 0.2], color: [new QV4(0.45, 0.8, 0.35, 1), new QV4(0.65, 0.9, 0.4, 1)], colorLife: ZERO_ONE_ZERO, spin: [-8, 8], noise: 1.2, gravity: 0.5 });
    return {
      stop() { for (const s of sys) { s.endEmit(); if (s.emitter.parent && !(s.emitter.parent instanceof THREE.Scene)) s.emitter.removeFromParent(); } },
    };
  }

  /**
   * A tornado on `obj` (base at its origin): wind arcs spiralling up a funnel that widens with height, fast streaks,
   * dust and leaves whirled at the foot. `absorb(el)` adds a second swirl in an absorbed element's colour.
   */
  tornado(obj: THREE.Object3D, height = 4.5, radius = 1.4) {
    const sys: ParticleSystem[] = [];
    const add = (o: Spec) => sys.push(this.sys(o, obj, true));
    const c = tint('ANEMO');
    // funnel: several rings at increasing height and radius, each spinning and drifting upward
    for (let i = 0; i < 4; i++) {
      const y = (i / 4) * height;
      const ring = new THREE.Object3D();
      ring.position.y = y + 0.2;
      obj.add(ring);
      const r = radius * (0.55 + i * 0.35);
      sys.push(this.sys({ tex: i % 2 ? 'twirl_01' : 'twirl_02', shape: 'ring', radius: r, rate: 16, life: [0.5, 0.8], speed: [0, 0.2], size: [r * 1.1, r * 1.6], color: new QV4(0.5, 0.92, 0.8, 0.75), colorLife: ZERO_ONE_ZERO, orbit: 6 - i * 0.6, gravity: -height * 0.5, spin: [4, 7] }, ring, true));
      sys.push(this.sys({ tex: 'trace_01', add: true, mode: RenderMode.StretchedBillBoard, stretch: 0.05, shape: 'ring', radius: r * 0.9, rate: 22, life: [0.3, 0.5], speed: [0.3, 1], size: [0.3, 0.55], color: v4(c, 2.2), orbit: 8 - i, gravity: -height * 0.6 }, ring, true));
    }
    // dust and leaves at the foot
    add({ tex: 'smoke_03', shape: 'ring', radius: radius * 0.8, rate: 10, life: [0.7, 1.1], speed: [0.2, 0.6], size: [1.2, 2], color: new QV4(0.82, 0.88, 0.8, 0.35), colorLife: ZERO_ONE_ZERO, sizeLife: GROW, orbit: 5, gravity: -1.5 });
    add({ tex: 'fx_leaf', shape: 'ring', radius: radius, rate: 12, life: [0.8, 1.4], speed: [0.5, 1.5], size: [0.15, 0.26], color: [new QV4(0.45, 0.8, 0.35, 1), new QV4(0.7, 0.85, 0.35, 1)], colorLife: ZERO_ONE_ZERO, orbit: 7, gravity: -3, spin: [-6, 6] });
    const self = this;
    return {
      absorb(el: El) {
        const k = tint(el);
        sys.push(self.sys({ tex: el === 'PYRO' ? 'fx_flame' : 'twirl_01', add: true, shape: 'ring', radius: radius * 1.1, rate: 26, life: [0.4, 0.7], speed: [0.2, 0.6], size: [radius * 0.9, radius * 1.4], color: v4(k, 1.8), colorLife: ZERO_ONE_ZERO, orbit: 6, gravity: -height * 0.6, spin: [4, 8] }, obj, true));
      },
      stop() { for (const s of sys) { s.endEmit(); if (s.emitter.parent && !(s.emitter.parent instanceof THREE.Scene)) s.emitter.removeFromParent(); } },
    };
  }

  /** A jagged lightning bolt from `height` metres above `at` down to it: flashing segments, sparks, a ground ring. */
  lightning(at: THREE.Vector3, height = 12) {
    const c = tint('ELECTRO');
    const p = at.clone().setY(at.y + height);
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const q = p.clone().lerp(at, (i + 1) / segs).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2));
      const mid = p.clone().lerp(q, 0.5);
      this.sys({ tex: 'spark_05', add: true, shape: 'point', count: 2, life: [0.16, 0.26], speed: [0, 0], size: [height / segs * 1.6, height / segs * 2], color: new QV4(c.r * 2 + 0.8, c.g * 2 + 0.7, c.b * 2 + 1, 1), spin: [-0.3, 0.3] }, mid);
      p.copy(q);
    }
    this.sys({ tex: 'light_01', add: true, shape: 'point', count: 1, life: [0.25, 0.3], speed: [0, 0], size: [7, 8], color: new QV4(2, 1.6, 3, 1), sizeLife: POP }, at.clone().setY(at.y + 1));
    this.ring(at, 4, 'ELECTRO', 0.45);
  }

  /** Particles streaking inward to a point from a ring of `radius` (suction / gathering energy). */
  inhale(pos: THREE.Vector3, el: El, radius: number) {
    const c = tint(el);
    this.sys({ tex: 'trace_01', mode: RenderMode.StretchedBillBoard, stretch: 0.07, shape: 'ring', radius, count: 34, life: [0.35, 0.5], speed: [-radius * 2.6, -radius * 2.1], size: [0.3, 0.5], color: v4(c, 2.4), orbit: 2.5 }, pos);
    this.sys({ tex: el === 'ANEMO' ? 'twirl_01' : 'circle_05', shape: 'ring', radius: radius * 0.8, count: 10, life: [0.4, 0.55], speed: [-radius * 1.8, -radius * 1.4], size: [0.5, 1], color: v4(c, 1.8), colorLife: ZERO_ONE_ZERO, spin: [4, 8] }, pos);
  }

  /** Sparks / motes strewn along a line (dash paths, beams). */
  streak(from: THREE.Vector3, to: THREE.Vector3, el: El) {
    const c = tint(el);
    const len = from.distanceTo(to);
    const steps = Math.max(2, Math.round(len / 0.8));
    const p = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      p.lerpVectors(from, to, i / steps);
      if (el === 'ELECTRO') this.sys({ tex: i % 2 ? 'spark_01' : 'spark_04', count: 1, life: [0.12, 0.22], speed: [0, 0], size: [0.9, 1.4], color: v4(c, 1), spin: [-2, 2], radius: 0.2 }, p.clone());
      this.sys({ tex: 'circle_05', count: 3, life: [0.3, 0.6], speed: [0.5, 2], size: [0.06, 0.14], color: v4(c, 2.6), gravity: el === 'HYDRO' ? 6 : -1, radius: 0.25 }, p.clone());
    }
  }
}

/** Set by Game once the renderer exists; effects and kits reach the library through `efx()`. */
let instance: ElementFX | null = null;
export function initElementFX(scene: THREE.Scene, batch: BatchedRenderer) { instance = new ElementFX(scene, batch); return instance; }
export function efx() { return instance; }

/** Best-effort element from an effect colour (Blast / RingPulse only know their colour). */
export function elementOfColor(color: string): El {
  const lc = color.toLowerCase();
  for (const [el, c] of Object.entries(ELEMENT_COLOR)) if (c.toLowerCase() === lc) return el as El;
  return 'PHYSICAL';
}
