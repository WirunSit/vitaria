import * as THREE from 'three';
import {
  ApplyForce, BatchedRenderer, Bezier, ColorOverLife, ConstantColor, ConstantValue, Gradient, IntervalValue, ParticleSystem,
  PiecewiseBezier, RenderMode, SizeOverLife, SphereEmitter, Vector3 as QV3, Vector4 as QV4,
} from 'three.quarks';

/**
 * Colours are pushed above 1.0 so the bloom pass picks them up — plain additive light barely shows on the
 * bright meadow. Hit effects with three.quarks and the Kenney Particle Pack (CC0, assets/fx): a flash, a ring of streak sparks and
 * a few stars on every hit, in the element's colour (bigger on crits). Systems share materials so three.quarks
 * batches them into a handful of draw calls; each system removes itself when done.
 */
const loader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();
const materials = new Map<string, THREE.MeshBasicMaterial>();

export function fxTexture(name: string) {
  let t = textures.get(name);
  if (!t) {
    t = loader.load(`assets/fx/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(name, t);
  }
  return t;
}

/** Shared particle material per texture (+ blending) so three.quarks can batch systems together. */
export function fxMaterial(name: string, normal = false) {
  const key = normal ? name + ':n' : name;
  let m = materials.get(key);
  if (!m) {
    // normal blending uses the white "_w" variant (shape in alpha only) so particles take their colour cleanly;
    // the Kenney originals keep the shape in grey brightness, which only works additively
    const file = normal && !name.startsWith('fx_') ? name + '_w' : name;
    const map = textures.get(file) ?? fxTexture(file);
    m = new THREE.MeshBasicMaterial({ map, transparent: true, blending: normal ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    materials.set(key, m);
  }
  return m;
}

/** Register a texture made in code (e.g. flame / leaf / shard shapes that the Kenney pack lacks). */
export function registerFxTexture(name: string, tex: THREE.Texture) { textures.set(name, tex); }
const additive = (name: string) => fxMaterial(name);

const FADE = new Gradient([[new QV3(1, 1, 1), 0], [new QV3(1, 1, 1), 1]], [[1, 0], [0, 1]]);
const SHRINK = new PiecewiseBezier([[new Bezier(1, 0.85, 0.45, 0), 0]]);
const POP = new PiecewiseBezier([[new Bezier(0.4, 1.2, 1.1, 0.9), 0]]);

export class CombatFX {
  readonly batch = new BatchedRenderer();

  constructor(private scene: THREE.Scene) {
    scene.add(this.batch);
  }

  /** Advance particles (use real time so sparks keep flying during hit-stop). */
  update(dt: number) { this.batch.update(dt); }

  /** Impact at `pos`: flash + streak sparks + stars. `strong` = crit / last combo hit. */
  hit(pos: THREE.Vector3, color: string, strong: boolean) {
    const c = new THREE.Color(color === '#ffffff' ? '#fff0c8' : color);
    const k = strong ? 1.5 : 1;
    // flash
    this.burst(pos, 'light_01', RenderMode.BillBoard, c, 2.6, {
      count: 1, life: [0.12, 0.16], speed: [0, 0], size: [1.3 * k, 1.6 * k], radius: 0.05, sizeCurve: POP,
    });
    // streak sparks
    this.burst(pos, 'trace_01', RenderMode.StretchedBillBoard, c, 2.4, {
      count: strong ? 22 : 12, life: [0.16, 0.32], speed: [6, 12 * k], size: [0.3, 0.5], radius: 0.1, gravity: 9, speedFactor: 0.05,
    });
    // stars
    this.burst(pos, 'star_06', RenderMode.BillBoard, c.clone().lerp(new THREE.Color('#ffffff'), 0.4), 1.2, {
      count: strong ? 6 : 3, life: [0.3, 0.5], speed: [1.5, 4], size: [0.35 * k, 0.6 * k], radius: 0.3, gravity: 2,
    });
  }

  private burst(pos: THREE.Vector3, tex: string, mode: RenderMode, color: THREE.Color, intensity: number, o: {
    count: number; life: [number, number]; speed: [number, number]; size: [number, number]; radius: number;
    gravity?: number; speedFactor?: number; sizeCurve?: PiecewiseBezier;
  }) {
    const ps = new ParticleSystem({
      duration: o.life[1] + 0.05,
      looping: false,
      autoDestroy: true,
      worldSpace: true,
      startLife: new IntervalValue(o.life[0], o.life[1]),
      startSpeed: new IntervalValue(o.speed[0], o.speed[1]),
      startSize: new IntervalValue(o.size[0], o.size[1]),
      startColor: new ConstantColor(new QV4(color.r * intensity, color.g * intensity, color.b * intensity, 1)),
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new ConstantValue(o.count), cycle: 1, interval: 0.01, probability: 1 }],
      shape: new SphereEmitter({ radius: o.radius, thickness: 1 }),
      material: additive(tex),
      renderMode: mode,
      speedFactor: o.speedFactor ?? 0,
      renderOrder: 2,
    });
    ps.addBehavior(new SizeOverLife(o.sizeCurve ?? SHRINK));
    ps.addBehavior(new ColorOverLife(FADE));
    if (o.gravity) ps.addBehavior(new ApplyForce(new QV3(0, -1, 0), new ConstantValue(o.gravity)));
    ps.emitter.position.copy(pos);
    this.scene.add(ps.emitter);
    this.batch.addSystem(ps);
  }
}
