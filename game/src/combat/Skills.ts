import * as THREE from 'three';
import type { Element } from '../core/types';
import { ELEMENT_COLOR } from '../core/types';
import { data } from '../core/Data';
import { sfx } from '../core/Audio';
import { talentBonus, type PartyMember } from '../player/Party';
import type { World } from '../world/World';
import { Combat, type HitParams } from './Combat';
import { Blast, RingPulse, SlashArc, Timed, orbMesh, type Effect } from './Effects';
import { GeoCrystals } from './GeoCrystal';
import type { Enemy } from '../enemies/Enemy';
import { glow, toon } from '../world/Materials';
import { efx } from '../render/ElementFX';
import { CharacterModel } from '../player/CharacterModel';
import { skillGearBonus } from '../gear/GearEffects';

export interface KitCtx {
  combat: Combat;
  world: World;
  member: PartyMember;
  party: PartyMember[];
  pos: THREE.Vector3;          // feet position (live reference)
  yaw: number;
  castPoint: () => THREE.Vector3;
  isDay: boolean;
  healActive: (amount: number) => void;
  /** Move the player quickly along `dir` (default: facing). Grants i-frames. */
  dash: (distance: number, duration: number, dir?: THREE.Vector3) => void;
  /** Throw the player straight up at `vy` m/s on a wind current: they float down on their own at the top. */
  launch: (vy: number) => void;
  activeMember: () => PartyMember;
}

const fwd = (yaw: number) => new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
/** Gene Sequence C3/C5 = "+3 talent levels" → approximated as +15% damage. */
const skillBonus = (m: PartyMember) => (m.cons >= (SKILL_AT_C5.has(m.id) ? 5 : 3) ? 0.15 : 0) + skillGearBonus(m) + talentBonus(m.talent(1));
const burstBonus = (m: PartyMember) => (m.cons >= (SKILL_AT_C5.has(m.id) ? 3 : 5) ? 0.15 : 0) + talentBonus(m.talent(2));
/** Characters whose C3 boosts the burst and C5 the skill (doc 03). */
const SKILL_AT_C5 = new Set(['NEUROS']);

const ICE_SHARD = new THREE.OctahedronGeometry(0.2, 0);
const ICE_MAT_A = new THREE.MeshToonMaterial({ color: 0xbfefff, emissive: 0x3a8ab0, emissiveIntensity: 0.6, transparent: true, opacity: 0.88 });
const ICE_MAT_B = new THREE.MeshToonMaterial({ color: 0xeafcff, emissive: 0x5aa8d0, emissiveIntensity: 0.6, transparent: true, opacity: 0.88 });

/** A small flower for Chloren's garden: stem, two leaves, a ring of petals around a golden centre. */
const PETAL_COLORS = ['#ffd1e6', '#fff3b0', '#ffffff', '#d9c8ff'];
function gardenFlower(i: number): THREE.Group {
  const f = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 5), toon('#4f9a35'));
  stem.position.y = 0.27;
  f.add(stem);
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), toon('#5fbf3c'));
    leaf.scale.set(1.6, 0.25, 0.7);
    leaf.position.set(sx * 0.1, 0.18, 0);
    leaf.rotation.z = sx * 0.4;
    f.add(leaf);
  }
  const head = new THREE.Group();
  head.position.y = 0.58;
  head.rotation.x = -0.5;
  const petalMat = toon(PETAL_COLORS[i % PETAL_COLORS.length]);
  for (let k = 0; k < 6; k++) {
    const pt = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), petalMat);
    pt.scale.set(1, 0.3, 1.7);
    const a = (k / 6) * Math.PI * 2;
    pt.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1);
    pt.rotation.y = -a + Math.PI / 2;
    head.add(pt);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), toon('#f2b33a'));
  head.add(eye);
  f.add(head);
  f.scale.setScalar(1.6);
  return f;
}

/** Homing-ish projectile. */
class Projectile implements Effect {
  obj: THREE.Object3D;
  private t = 0;
  private dead = false;
  constructor(
    private combat: Combat,
    from: THREE.Vector3,
    private vel: THREE.Vector3,
    private hit: HitParams,
    private opts: { radius?: number; life?: number; target?: Enemy | null; aoe?: number; color: string; size?: number; onHit?: (at: THREE.Vector3) => void },
  ) {
    const g = new THREE.Group();
    const size = opts.size ?? 0.18;
    // element orbs made of particles instead of solid spheres: a real fireball / a spinning wind orb
    if (hit.element === 'PYRO') this.fire = efx()?.flameBall(g, size) ?? null;
    else if (hit.element === 'ANEMO') this.fire = efx()?.windBall(g, size) ?? null;
    if (!this.fire) {
      const core = orbMesh(opts.color, size);
      g.add(core);
      const trail = new THREE.Mesh(new THREE.ConeGeometry(size * 0.9, size * 4, 8), glow(opts.color, 1.2, 0.5));
      trail.rotation.x = -Math.PI / 2;
      trail.position.z = -size * 2;
      g.add(trail);
    }
    g.position.copy(from);
    this.obj = g;
  }
  private fire: { stop(): void } | null = null;
  dispose() { this.fire?.stop(); }
  update(dt: number) {
    if (this.dead) return false;
    this.t += dt;
    const tg = this.opts.target;
    if (tg && tg.alive) {
      const want = tg.center(new THREE.Vector3()).sub(this.obj.position).normalize().multiplyScalar(this.vel.length());
      this.vel.lerp(want, Math.min(1, dt * 6));
    }
    this.obj.position.addScaledVector(this.vel, dt);
    this.obj.lookAt(this.obj.position.clone().add(this.vel));
    const p = this.obj.position;
    for (const e of this.combat.enemies) {
      if (!e.alive) continue;
      const c = e.center(new THREE.Vector3());
      if (c.distanceTo(p) < e.radius + (this.opts.radius ?? 0.4) + e.height * 0.3) {
        if (this.opts.aoe) {
          this.combat.hitArea(p, this.opts.aoe, this.hit);
          this.combat.addEffect(new Blast(p.clone(), this.opts.aoe, this.opts.color, 0.3));
        } else {
          this.combat.hit(e, { ...this.hit, from: p.clone().sub(this.vel.clone().normalize()) });
          if (this.fire) efx()?.burst(p.clone(), this.hit.element, 1.1); // the orb bursts on impact (flames / a gust)
        }
        this.opts.onHit?.(p.clone());
        this.dead = true;
        return false;
      }
    }
    if (p.y < this.combat.groundY(p.x, p.z)) {
      if (this.opts.aoe) {
        this.combat.hitArea(p, this.opts.aoe, this.hit);
        this.combat.addEffect(new Blast(p.clone(), this.opts.aoe, this.opts.color, 0.3));
      }
      return false;
    }
    return this.t < (this.opts.life ?? 1.4);
  }
}

function aimAt(ctx: KitCtx, range = 18): { dir: THREE.Vector3; target: Enemy | null } {
  const f = fwd(ctx.yaw);
  let best: Enemy | null = null, bs = -1;
  for (const e of ctx.combat.enemies) {
    if (!e.alive) continue;
    const to = e.pos.clone().sub(ctx.pos).setY(0);
    const d = to.length();
    if (d > range) continue;
    const dot = to.normalize().dot(f);
    if (dot < 0.5) continue;
    const score = dot * 2 - d / range;
    if (score > bs) { bs = score; best = e; }
  }
  const from = ctx.castPoint();
  const dir = best ? best.center(new THREE.Vector3()).sub(from).normalize() : f.clone().setY(0.02).normalize();
  return { dir, target: best };
}

function shoot(ctx: KitCtx, hit: HitParams, color: string, speed: number, opts: Partial<ConstructorParameters<typeof Projectile>[4]> = {}) {
  const { dir, target } = aimAt(ctx);
  const from = ctx.castPoint();
  ctx.combat.addEffect(new Projectile(ctx.combat, from, dir.multiplyScalar(speed), hit, { color, target: opts.target === undefined ? target : opts.target, ...opts }));
}

/** Hit every enemy within `width` of the segment a→b once. */
function hitSegment(ctx: KitCtx, a: THREE.Vector3, b: THREE.Vector3, width: number, p: HitParams) {
  const ab = b.clone().sub(a).setY(0);
  const len = Math.max(0.01, ab.length());
  ab.normalize();
  let n = 0;
  for (const e of ctx.combat.enemies) {
    if (!e.alive) continue;
    const ap = e.pos.clone().sub(a).setY(0);
    const t = THREE.MathUtils.clamp(ap.dot(ab), 0, len);
    const closest = a.clone().addScaledVector(ab, t);
    if (Math.hypot(e.pos.x - closest.x, e.pos.z - closest.z) < width + e.radius) { ctx.combat.hit(e, { ...p, from: a }); n++; }
  }
  return n;
}

// ---------------------------------------------------------------- per-character kits
export interface Kit {
  normal: number[];                // multipliers per combo hit
  normalElement?: Element;         // catalysts deal elemental normals
  normalStyle: 'melee' | 'projectile' | 'arrow';
  heavy?: boolean;                 // claymore: blunt hits (Lysis)
  charged: (ctx: KitCtx) => void;
  chargedStamina: number;
  skill: (ctx: KitCtx) => number;  // returns cooldown
  /** optional hold-E version (fires once E has been held HOLD_E seconds; a quick tap still uses `skill`) */
  skillHold?: (ctx: KitCtx) => number;
  burst: (ctx: KitCtx) => void;
}

const MELEE_REACH: Record<string, [number, number]> = { SWORD: [2.4, 1.2], CLAYMORE: [2.7, 1.4], POLEARM: [3.1, 0.9] };

function normalHit(ctx: KitCtx, kit: Kit, combo: number) {
  const m = ctx.member;
  const mult = kit.normal[combo % kit.normal.length];
  const last = combo % kit.normal.length === kit.normal.length - 1;
  const el = kit.normalElement ?? 'PHYSICAL';
  const hit: HitParams = { member: m, mult, element: el, icd: 'normal', kb: last ? 4 : 1.2, heavy: kit.heavy, kind: 'normal' };
  if (m.id === 'HELIX') { hit.dmgBonusFn = helixPairBonus(m); if (m.passives) hit.critBonusFn = helixA4; }
  if (kit.normalStyle === 'melee') {
    const [reach, arc] = MELEE_REACH[m.def.weapon] ?? [2.4, 1.2];
    ctx.combat.addEffect(new SlashArc(ctx.pos, ctx.yaw, el === 'PHYSICAL' ? '#ffffff' : ELEMENT_COLOR[el], reach - 0.2, combo % 2 === 1));
    sfx.swing(m.def.weapon, combo, last);
    ctx.combat.hitArc(ctx.pos, ctx.yaw, reach, arc, hit);
  } else if (kit.normalStyle === 'projectile') {
    sfx.swing(m.def.weapon, combo, last);
    shoot(ctx, hit, ELEMENT_COLOR[el], 20);
  } else {
    sfx.swing(m.def.weapon, combo, last);
    shoot(ctx, hit, '#f2e6c0', 34, { size: 0.08, target: null });
  }
  // Mitora A1 — ATP Yield
  if (m.id === 'MITORA' && m.passives) {
    m.normalHits++;
    if (m.normalHits % 3 === 0) m.atpStacks = Math.min(m.cons >= 2 ? 38 : 32, m.atpStacks + 1);
  }
}

// Helix helpers ------------------------------------------------------------
const paired = new WeakMap<Enemy, number>(); // enemy → time until which it is "paired"
let clock = 0;
const helixA4 = (e: Enemy) => (e.aura?.element === 'CRYO' || e.frozen > 0 ? 0.15 : 0);
function helixPairBonus(m: PartyMember) {
  return (e: Enemy) => ((paired.get(e) ?? -1) > clock ? (m.passives ? 0.15 : 0) + (m.cons >= 4 ? 0.15 : 0) : 0);
}

function spawnHelixClone(ctx: KitCtx, at: THREE.Vector3, yaw: number) {
  const m = ctx.member, combat = ctx.combat;
  const def = data.characters.get('HELIX')!;
  const model = new CharacterModel(def.appearance, 'CRYO', 'CLAYMORE');
  const iceMat = new THREE.MeshToonMaterial({ color: 0xbff2ff, transparent: true, opacity: 0.6, emissive: 0x3a8ab0 });
  model.root.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh && !mesh.userData.isOutline) mesh.material = iceMat; });
  model.root.position.copy(at);
  model.root.rotation.y = yaw;
  const life = m.cons >= 1 ? 12 : 8;
  const mult = m.cons >= 2 ? 0.75 : 0.5;
  let tick = 0.6, swing = -1;
  combat.addEffect(new Timed(model.root, life, (dt) => {
    tick -= dt;
    const tgt = combat.nearestEnemy(model.root.position, 9);
    if (tgt) {
      const d = tgt.pos.clone().sub(model.root.position).setY(0);
      model.root.rotation.y = Math.atan2(d.x, d.z);
      if (d.length() > 2.2) model.root.position.addScaledVector(d.normalize(), Math.min(d.length() - 2, dt * 5));
      model.root.position.y = ctx.world.groundH(model.root.position.x, model.root.position.z);
    }
    if (swing >= 0) swing += dt * 2.2;
    if (tick <= 0 && tgt) {
      tick = 1.1;
      swing = 0;
      const yawC = model.root.rotation.y;
      combat.addEffect(new SlashArc(model.root.position, yawC, ELEMENT_COLOR.CRYO, 2.5));
      combat.hitArc(model.root.position, yawC, 2.8, 1.4, {
        member: m, mult: 0.9 * mult, element: 'CRYO', icd: 'clone', heavy: true,
        onHit: (e) => paired.set(e, clock + 3),
      });
    }
    model.update(dt, { speed: 0, air: false, glide: false, attackT: swing >= 0 && swing < 1 ? swing : -1, attackKind: 'normal', dashing: false });
  }, () => model.dispose()));
}

export const KITS: Record<string, Kit> = {
  SEEKER: {
    normal: [0.45, 0.44, 0.54, 0.59, 0.72],
    normalStyle: 'melee',
    chargedStamina: 20,
    charged(ctx) {
      const hit: HitParams = { member: ctx.member, mult: 0.56, element: 'PHYSICAL', icd: 'charged', kind: 'charged', kb: 3 };
      ctx.combat.addEffect(new SlashArc(ctx.pos, ctx.yaw, '#ffffff', 2.6));
      ctx.combat.hitArc(ctx.pos, ctx.yaw, 2.6, 1.4, hit);
      setTimeout(() => {
        ctx.combat.addEffect(new SlashArc(ctx.pos, ctx.yaw, '#ffffff', 2.6, true));
        ctx.combat.hitArc(ctx.pos, ctx.yaw, 2.6, 1.4, { ...hit, mult: 0.72 });
      }, 150);
    },
    skill(ctx) {
      const f = fwd(ctx.yaw);
      const at = ctx.pos.clone().addScaledVector(f, 3);
      at.y = ctx.world.h(at.x, at.z);
      const wall = GeoCrystals.wall(4); // amber crystal cell-wall
      const mesh = wall.group;
      mesh.position.copy(at);
      mesh.rotation.y = ctx.yaw;
      const cast = ctx.combat.newCast();
      const m = ctx.member;
      ctx.combat.hitArea(at.clone().setY(at.y + 1), 3, { member: m, mult: 2.48, element: 'GEO', icd: null, dmgBonus: skillBonus(m), particles: { count: 3 + (Math.random() < 0.5 ? 1 : 0), castId: cast }, kb: 6 });
      ctx.combat.addEffect(new RingPulse(at, 3.5, ELEMENT_COLOR.GEO));
      efx()?.burst(at.clone().setY(at.y + 0.6), 'GEO', 3); // rock chips as the wall bursts out of the ground
      const id = `wall_${cast}`;
      const right = new THREE.Vector3(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw));
      for (const o of [-1.3, 0, 1.3]) ctx.world.colliders.push({ x: at.x + right.x * o, z: at.z + right.z * o, r: 0.85, id });
      const combat = ctx.combat, world = ctx.world;
      combat.addEffect(new Timed(mesh, 20, (_dt, t) => {
        if (t > 19.4) wall.sink((t - 19.4) / 0.6);
        else wall.grow(t);
      }, () => {
        world.colliders = world.colliders.filter((c) => c.id !== id);
        const mult = (m.passives ? 0.6 : 0) + (m.cons >= 2 ? 1.0 : 0);
        if (mult > 0) {
          combat.hitArea(at.clone().setY(at.y + 1), 3, { member: m, mult, element: 'GEO', icd: null });
          combat.addEffect(new Blast(at.clone().setY(at.y + 1), 3, ELEMENT_COLOR.GEO));
        } else efx()?.burst(at.clone().setY(at.y + 1), 'GEO', 2); // the wall crumbles
      }));
      sfx.skill();
      return m.passives ? 6 : 8;
    },
    burst(ctx) {
      const center = ctx.pos.clone();
      const ring = GeoCrystals.ring(5.5, 8); // eight amber crystal clusters — the cytoskeleton
      const g = ring.group;
      const baseY = ctx.world.h(center.x, center.z);
      g.position.copy(center).setY(baseY);
      let waves = 0, refund = 0;
      const m = ctx.member, combat = ctx.combat, party = ctx.party;
      const maxWaves = m.cons >= 6 ? 6 : 4;
      const life = 2.2 + maxWaves * 0.55;
      if (m.cons >= 1) for (const p of party) p.addBuff('seeker_c1', 'critRate', 0.1, life);
      combat.addEffect(new Timed(g, life, (_dt, t) => {
        if (t > life - 0.5) ring.sink((t - (life - 0.5)) / 0.5);
        else ring.grow(t);
        const due = Math.floor(t / 0.55);
        while (waves <= due && waves < maxWaves) {
          waves++;
          const n = combat.hitArea(center.clone().setY(baseY + 1), 6.2, { member: m, mult: 1.48, element: 'GEO', icd: 'burst', kb: 2, dmgBonus: burstBonus(m) });
          if (m.cons >= 4 && n > 0 && refund < 20) { refund += 5; for (const p of party) p.addEnergy(5); }
          combat.addEffect(new RingPulse(center.clone().setY(baseY), 6.5, ELEMENT_COLOR.GEO, 0.5, 0.15));
          // debris erupts at the pillars with each quake wave
          for (let k = 0; k < 2; k++) {
            const a = (waves * 2 + k) * 0.785;
            efx()?.burst(center.clone().setY(baseY + 0.5).add(new THREE.Vector3(Math.cos(a) * 5.5, 0, Math.sin(a) * 5.5)), 'GEO', 1.6);
          }
        }
      }));
      sfx.burst();
    },
  },

  MITORA: {
    normal: [0.38, 0.34, 0.48, 0.6],
    normalElement: 'PYRO',
    normalStyle: 'projectile',
    chargedStamina: 50,
    charged(ctx) {
      shoot(ctx, { member: ctx.member, mult: 1.5, element: 'PYRO', icd: 'charged', kind: 'charged', kb: 5 }, ELEMENT_COLOR.PYRO, 16, { size: 0.4, aoe: 2.5 });
    },
    skill(ctx) {
      const member = ctx.member, combat = ctx.combat, pos = ctx.pos;
      const g = new THREE.Group();
      const orbs: THREE.Object3D[] = [];
      const count = member.cons >= 1 ? 10 : 8;
      const radius = member.cons >= 1 ? 2.8 : 2.3;
      for (let i = 0; i < count; i++) {
        const o = new THREE.Group(); // each orb is a small particle fireball (flameBall below)
        g.add(o);
        orbs.push(o);
      }
      const cast = combat.newCast();
      let tick = 0;
      const trails = orbs.map((o) => efx()?.flameBall(o, 0.22, 0.5)); // eight living fireballs circling Mitora
      combat.addEffect(new Timed(g, 10, (dt, t) => {
        g.position.copy(pos).setY(pos.y + 1);
        orbs.forEach((o, i) => {
          const a = t * 3 + (i / count) * Math.PI * 2;
          o.position.set(Math.cos(a) * radius, Math.sin(t * 4 + i) * 0.15, Math.sin(a) * radius);
        });
        tick -= dt;
        if (tick <= 0) {
          tick = 0.5;
          for (const e of combat.enemiesInRadius(g.position, radius + 1.1)) {
            combat.hit(e, { member, mult: 0.52, element: 'PYRO', icd: 'krebs', dmgBonus: skillBonus(member), particles: { count: 3, castId: cast } });
          }
        }
      }, () => trails.forEach((tr) => tr?.stop())));
      sfx.skill();
      return 12;
    },
    burst(ctx) {
      const m = ctx.member;
      const at = ctx.pos.clone().addScaledVector(fwd(ctx.yaw), 2);
      at.y = ctx.world.h(at.x, at.z) + 1;
      const bonus = (m.passives && ctx.party.some((p) => p.element === 'ANEMO') ? 0.2 : 0) + burstBonus(m);
      ctx.combat.hitArea(at, 7, { member: m, mult: 4.2, element: 'PYRO', units: 2, icd: null, dmgBonus: bonus, kb: 8 });
      ctx.combat.addEffect(new Blast(at, 7, ELEMENT_COLOR.PYRO, 0.6));
      ctx.combat.addEffect(new RingPulse(at.clone().setY(at.y - 1), 8, '#ffcf5a', 0.6));
      if (m.cons < 6) m.atpStacks = 0;
      const field = new THREE.Mesh(new THREE.CircleGeometry(5, 32).rotateX(-Math.PI / 2), glow('#ff7a3a', 1.2, 0.35));
      field.position.copy(at).setY(at.y - 0.9);
      let tick = 0;
      const combat = ctx.combat;
      const flames = efx()?.attach(field, 'PYRO', 'field', 4.5); // dancing flames over the burning ground
      combat.addEffect(new Timed(field, 6, (dt, t) => {
        (field.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t / 6) + Math.sin(t * 12) * 0.05;
        tick -= dt;
        if (tick <= 0) {
          tick = 1;
          combat.hitArea(at, 5, { member: m, mult: 0.6, element: 'PYRO', icd: 'burstfield', dmgBonus: burstBonus(m) });
        }
      }, () => flames?.stop()));
      sfx.burst();
    },
  },

  ALVI: {
    normal: [0.4, 0.4, 0.55],
    normalElement: 'ANEMO',
    normalStyle: 'projectile',
    chargedStamina: 50,
    charged(ctx) {
      shoot(ctx, { member: ctx.member, mult: 1.35, element: 'ANEMO', icd: 'charged', kind: 'charged', kb: 6 }, ELEMENT_COLOR.ANEMO, 22, { size: 0.35, target: null, aoe: 2 });
    },
    skill(ctx) {
      const at = ctx.pos.clone().addScaledVector(fwd(ctx.yaw), 4);
      at.y = ctx.world.h(at.x, at.z) + 1;
      const member = ctx.member, combat = ctx.combat;
      const cast = combat.newCast();
      const pull = member.cons >= 1 ? 11 : 8;
      for (const e of combat.enemiesInRadius(at, pull)) {
        if (e.isBoss) continue;
        const dir = at.clone().sub(e.pos).setY(0);
        const d = dir.length();
        e.vel.add(dir.normalize().multiplyScalar(Math.min(14, d * 3)));
      }
      if (member.cons >= 4) member.addBuff('alvi_c4', 'dr', 0.25, 6);
      efx()?.inhale(at, 'ANEMO', 4.5); // the air rushes in
      const swirl = new THREE.Object3D(); // the visuals are the inhale particles; this just times the release
      swirl.position.copy(at);
      combat.addEffect(new Timed(swirl, 0.6, () => {}, () => {
        combat.hitArea(at, 4, { member, mult: 1.8, element: 'ANEMO', icd: null, dmgBonus: skillBonus(member), particles: { count: 3, castId: cast } });
        combat.addEffect(new Blast(at, 4, ELEMENT_COLOR.ANEMO, 0.35));
      }));
      sfx.skill();
      return 10;
    },
    /**
     * Hold E — "หายใจลึก (Deep Breath)": a rising column of air under Alvi pulls nearby enemies in, hits them, and
     * carries Alvi about 12 m up; at the top the wind lets him float down (glide) even before the samara wings.
     */
    skillHold(ctx) {
      const at = ctx.pos.clone();
      const member = ctx.member, combat = ctx.combat;
      const cast = combat.newCast();
      for (const e of combat.enemiesInRadius(at, member.cons >= 1 ? 9 : 7)) {
        if (e.isBoss) continue;
        const dir = at.clone().sub(e.pos).setY(0);
        e.vel.add(dir.normalize().multiplyScalar(Math.min(12, dir.length() * 3)));
      }
      if (member.cons >= 4) member.addBuff('alvi_c4', 'dr', 0.25, 6);
      combat.hitArea(at.clone().setY(at.y + 1), 4, { member, mult: 2.4, element: 'ANEMO', icd: null, dmgBonus: skillBonus(member), particles: { count: 4, castId: cast } });
      combat.addEffect(new RingPulse(at.clone().setY(at.y + 0.1), 4.5, ELEMENT_COLOR.ANEMO));
      efx()?.inhale(at.clone().setY(at.y + 1), 'ANEMO', 3.5);
      const column = new THREE.Object3D();
      column.position.copy(at);
      const twister = efx()?.tornado(column, 7, 1.1);
      combat.addEffect(new Timed(column, 1.3, () => {}, () => twister?.stop()));
      ctx.launch(24);
      sfx.skill();
      return 15;
    },
    burst(ctx) {
      const member = ctx.member, combat = ctx.combat, world = ctx.world;
      const dir = fwd(ctx.yaw);
      const pos = ctx.pos.clone().addScaledVector(dir, 2.5);
      const g = new THREE.Group();
      let absorbed: Element | null = null;
      let tick = 0;
      const anemoBonus = burstBonus(member) + (member.cons >= 2 ? 0.2 : 0);
      const absMult = member.cons >= 6 ? 0.36 : 0.3;
      const twister = efx()?.tornado(g, 4.6, 1.4); // particle funnel: wind arcs, streaks, dust and leaves
      combat.addEffect(new Timed(g, 8, (dt) => {
        pos.addScaledVector(dir, dt * 2.5);
        pos.y = world.h(pos.x, pos.z);
        g.position.copy(pos);
        tick -= dt;
        if (tick <= 0) {
          tick = 0.5;
          const center = pos.clone().setY(pos.y + 1);
          for (const e of combat.enemiesInRadius(center, 7)) {
            if (!e.isBoss) e.vel.add(center.clone().sub(e.pos).setY(0).normalize().multiplyScalar(5));
          }
          const inside = combat.enemiesInRadius(center, 3.5);
          if (!absorbed) {
            const src = inside.find((e) => e.aura && ['PYRO', 'HYDRO', 'ELECTRO', 'CRYO'].includes(e.aura.element));
            if (src) {
              absorbed = src.aura!.element;
              twister?.absorb(absorbed); // the funnel takes on the absorbed element
            }
          }
          for (const e of inside) {
            combat.hit(e, { member, mult: 0.6, element: 'ANEMO', icd: 'tornado', dmgBonus: anemoBonus });
            if (absorbed) combat.hit(e, { member, mult: absMult, element: absorbed, icd: 'tornado_abs', dmgBonus: burstBonus(member) });
          }
        }
      }, () => twister?.stop()));
      if (member.passives) for (const p of ctx.party) { p.bmBuff = 100; p.bmBuffT = 8; }
      sfx.burst();
    },
  },

  CHLOREN: {
    normal: [0.42, 0.41, 0.53, 0.68],
    normalStyle: 'arrow',
    chargedStamina: 0,
    charged(ctx) {
      shoot(ctx, { member: ctx.member, mult: 1.24, element: 'DENDRO', icd: null, kb: 3, kind: 'charged' }, ELEMENT_COLOR.DENDRO, 40, { size: 0.16 });
    },
    skill(ctx) {
      const at = ctx.pos.clone().addScaledVector(fwd(ctx.yaw), 2.5);
      at.y = ctx.world.h(at.x, at.z);
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 14), toon(i % 2 ? '#5fae3a' : '#8bd25a'));
        disc.position.y = 0.4 + i * 0.25;
        g.add(disc);
      }
      const sun = orbMesh('#fff2a0', 0.25);
      sun.position.y = 1.7;
      g.add(sun);
      g.position.copy(at);
      const member = ctx.member, combat = ctx.combat;
      const cast = combat.newCast();
      const interval = member.cons >= 1 ? 1.5 : 2;
      let tick = 0.5;
      const glowFx = efx()?.attach(sun, 'DENDRO', 'trail', 1, 0.5); // light motes drifting off the sun totem
      combat.addEffect(new Timed(g, 12, (dt, t) => {
        sun.position.y = 1.7 + Math.sin(t * 3) * 0.1;
        tick -= dt;
        if (tick <= 0) {
          tick = interval;
          const from = at.clone().setY(at.y + 1.7);
          const target = combat.nearestEnemy(from, 12);
          if (target) {
            const to = target.center(new THREE.Vector3());
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, from.distanceTo(to), 6), glow('#c6ff7a', 1.6, 0.9));
            beam.position.copy(from).add(to).multiplyScalar(0.5);
            beam.lookAt(to);
            beam.rotateX(Math.PI / 2);
            combat.addEffect(new Timed(beam, 0.2, () => {}));
            efx()?.streak(from, to, 'DENDRO');
            combat.hit(target, { member, mult: 0.8, element: 'DENDRO', icd: 'totem', dmgBonus: skillBonus(member), particles: { count: 3, castId: cast } });
          }
        }
      }, () => glowFx?.stop()));
      combat.addEffect(new RingPulse(at, 2, ELEMENT_COLOR.DENDRO));
      sfx.skill();
      return 14;
    },
    burst(ctx) {
      const at = ctx.pos.clone();
      at.y = ctx.world.h(at.x, at.z);
      const g = new THREE.Group();
      const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 40).rotateX(-Math.PI / 2), glow('#8bd25a', 1, 0.3));
      ground.position.y = 0.12;
      g.add(ground);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const flower = gardenFlower(i);
        flower.position.set(Math.cos(a) * 5.6, 0.05, Math.sin(a) * 5.6);
        flower.rotation.y = -a;
        g.add(flower);
      }
      g.position.copy(at);
      const member = ctx.member, combat = ctx.combat;
      const maxHp = member.stats().hp;
      const life = member.cons >= 4 ? 16 : 12;
      const bonus = burstBonus(member) + (member.cons >= 2 ? 0.2 : 0);
      let tick = 0;
      const garden = efx()?.attach(g, 'DENDRO', 'field', 5.5); // leaves and motes floating up in the garden
      combat.addEffect(new Timed(g, life, (dt) => {
        g.rotation.y += dt * 0.4;
        tick -= dt;
        if (tick <= 0) {
          tick = 2;
          const c = at.clone().setY(at.y + 1);
          combat.hitArea(c, 6, {
            member, mult: 0.7, element: 'DENDRO', icd: 'garden', dmgBonus: bonus,
            dmgBonusFn: member.passives ? (e) => (e.burnT > 0 ? 0.2 : 0) : undefined,
          });
          combat.addEffect(new RingPulse(at, 6, ELEMENT_COLOR.DENDRO, 0.5, 0.1));
          if (combat.playerPos.distanceTo(at) < 6.5) ctx.healActive(maxHp * 0.03 + 120);
        }
      }, () => garden?.stop()));
      sfx.burst();
    },
  },

  // ================================================================ ★5 — Gene Wish
  HEMA: {
    normal: [0.48, 0.47, 0.6, 0.66, 0.78],
    normalStyle: 'melee',
    chargedStamina: 25,
    charged(ctx) {
      const m = ctx.member;
      ctx.combat.addEffect(new RingPulse(ctx.pos, 3, '#ffffff', 0.3));
      ctx.combat.hitArea(ctx.pos.clone().setY(ctx.pos.y + 1), 3, { member: m, mult: 1.2, element: 'PHYSICAL', icd: 'charged', kind: 'charged', kb: 3 });
    },
    skill(ctx) {
      const m = ctx.member, combat = ctx.combat;
      const start = ctx.pos.clone();
      const dir = fwd(ctx.yaw);
      const end = start.clone().addScaledVector(dir, 7);
      const cast = combat.newCast();
      ctx.dash(7, 0.25);
      hitSegment(ctx, start, end, 1.6, { member: m, mult: 1.9, element: 'HYDRO', icd: null, dmgBonus: skillBonus(m), particles: { count: 3 + (Math.random() < 0.5 ? 1 : 0), castId: cast }, kb: 4 });
      combat.addEffect(new RingPulse(end, 2.5, ELEMENT_COLOR.HYDRO));
      efx()?.streak(start.clone().setY(start.y + 1), end.clone().setY(end.y + 1), 'HYDRO'); // spray along the dash
      efx()?.burst(end.clone().setY(end.y + 0.8), 'HYDRO', 2.5);
      // oxygen bubbles along the path
      const n = m.cons >= 1 ? 6 : 4;
      const maxHp = m.stats().hp;
      for (let i = 0; i < n; i++) {
        const p = start.clone().lerp(end, (i + 0.5) / n).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
        p.y = ctx.world.groundH(p.x, p.z) + 1;
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.6 }));
        bubble.position.copy(p);
        const baseY = p.y;
        const fx = new Timed(bubble, 12, (_dt, t, self) => {
          bubble.position.y = baseY + Math.sin(t * 3 + i) * 0.15;
          if (t > 0.8 && combat.playerPos.distanceTo(bubble.position) < 1.6) { // not instantly eaten by the dash itself
            const target = ctx.activeMember();
            let amt = maxHp * 0.08 + 600;
            if (m.passives && target.hp < target.stats().hp * 0.5) amt *= 1.2;
            ctx.healActive(amt);
            if (m.cons >= 4) m.addEnergy(2);
            sfx.pickup();
            self.kill();
          }
        });
        combat.addEffect(fx);
      }
      sfx.skill();
      return 10;
    },
    burst(ctx) {
      const m = ctx.member, combat = ctx.combat, pos = ctx.pos;
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 8, 48), glow(ELEMENT_COLOR.HYDRO, 1.3, 0.8));
      ring.rotation.x = Math.PI / 2;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.06, 6, 48), glow('#ff6a6a', 1.2, 0.7));
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = 0.3;
      g.add(ring, ring2);
      const maxHp = m.stats().hp;
      const healMult = m.cons >= 5 ? 1.15 : 1;
      if (m.cons >= 2) for (const p of ctx.party) p.addBuff('hema_c2', 'hydroBonus', 0.15, 15);
      let tick = 0.2;
      const tide = efx()?.attach(g, 'HYDRO', 'swirl', 2.1, 0.8); // droplets circling with the ring
      combat.addEffect(new Timed(g, 15, (dt, t) => {
        g.position.copy(pos).setY(pos.y + 0.8);
        ring.rotation.z += dt * 2;
        ring2.rotation.z -= dt * 3;
        tick -= dt;
        if (tick <= 0) {
          tick = 2;
          const target = ctx.activeMember();
          let amt = (maxHp * 0.04 + 400) * healMult;
          if (m.passives && target.hp < target.stats().hp * 0.5) amt *= 1.2;
          ctx.healActive(amt);
          const enemy = combat.nearestEnemy(pos, 12);
          if (enemy) {
            const from = pos.clone().setY(pos.y + 1.5);
            combat.addEffect(new Projectile(combat, from, enemy.center(new THREE.Vector3()).sub(from).normalize().multiplyScalar(18),
              { member: m, mult: 0.06, scaling: 'hp', element: 'HYDRO', icd: 'tide', dmgBonus: burstBonus(m) }, { color: ELEMENT_COLOR.HYDRO, target: enemy, size: 0.22 }));
          }
        }
      }, () => tide?.stop()));
      sfx.burst();
    },
  },

  NEUROS: {
    normal: [0.49, 0.48, 0.62, 0.68, 0.81],
    normalStyle: 'melee',
    chargedStamina: 20,
    charged(ctx) {
      const hit: HitParams = { member: ctx.member, mult: 0.6, element: 'PHYSICAL', icd: 'charged', kind: 'charged', kb: 3 };
      ctx.combat.addEffect(new SlashArc(ctx.pos, ctx.yaw, '#d9b8ff', 2.6));
      ctx.combat.hitArc(ctx.pos, ctx.yaw, 2.6, 1.3, hit);
      setTimeout(() => ctx.combat.hitArc(ctx.pos, ctx.yaw, 2.6, 1.3, { ...hit, mult: 0.7 }), 140);
    },
    skill(ctx) {
      const m = ctx.member, combat = ctx.combat;
      if (m.windowT <= 0) { m.windowT = 5; m.charges = m.cons >= 1 ? 4 : 3; }
      m.charges--;
      const start = ctx.pos.clone();
      // dash toward the nearest enemy in front, else straight ahead
      const { dir } = aimAt(ctx, 9);
      dir.setY(0).normalize();
      const end = start.clone().addScaledVector(dir, 6);
      ctx.dash(6, 0.16, dir);
      const cast = combat.newCast();
      hitSegment(ctx, start, end, 1.4, { member: m, mult: 1.2, element: 'ELECTRO', icd: null, dmgBonus: skillBonus(m), particles: { count: 2, castId: cast }, kb: 2 });
      if (m.cons >= 2) m.addStacks(15);
      // lightning trail between "nodes"
      for (const p of [start, end]) combat.addEffect(new Blast(p.clone().setY(p.y + 1), 0.8, ELEMENT_COLOR.ELECTRO, 0.25));
      efx()?.streak(start.clone().setY(start.y + 1), end.clone().setY(end.y + 1), 'ELECTRO'); // crackling along the leap
      sfx.skill();
      if (m.charges > 0) return 0.3;    // next leap available shortly
      m.windowT = 0;
      return 9;
    },
    burst(ctx) {
      const m = ctx.member, combat = ctx.combat;
      const f = fwd(ctx.yaw);
      const at = ctx.pos.clone().addScaledVector(f, 2.5);
      at.y = ctx.world.groundH(at.x, at.z) + 1;
      const crit = m.stacks >= 100;
      const hit: HitParams = { member: m, mult: 6.0, element: 'ELECTRO', units: 2, icd: null, forceCrit: crit, dmgBonus: burstBonus(m), kb: 7 };
      combat.hitArea(at, 5, hit);
      combat.addEffect(new Blast(at, 5, ELEMENT_COLOR.ELECTRO, 0.5));
      efx()?.lightning(at.clone().setY(at.y - 1), 13); // a jagged bolt from the sky
      efx()?.streak(at.clone().setY(at.y + 12), at.clone(), 'ELECTRO'); // sparks racing down the bolt
      if (m.cons >= 6) setTimeout(() => { combat.hitArea(at, 5, { ...hit, mult: 3.0 }); combat.addEffect(new Blast(at, 4, ELEMENT_COLOR.ELECTRO, 0.4)); }, 450);
      m.stacks = 0;
      if (m.passives) { m.refractoryT = 3; m.addBuff('neuros_a4', 'dr', 0.3, 3); }
      sfx.burst();
    },
  },

  HELIX: {
    normal: [0.82, 0.76, 0.86, 1.12],
    normalStyle: 'melee',
    heavy: true,
    chargedStamina: 40,
    charged(ctx) {
      const m = ctx.member;
      ctx.combat.addEffect(new RingPulse(ctx.pos, 3.2, '#dff6ff', 0.35));
      ctx.combat.hitArea(ctx.pos.clone().setY(ctx.pos.y + 1), 3.2, { member: m, mult: 1.15, element: 'PHYSICAL', icd: 'charged', kind: 'charged', heavy: true, kb: 4 });
    },
    skill(ctx) {
      const m = ctx.member, combat = ctx.combat;
      const cast = combat.newCast();
      combat.addEffect(new SlashArc(ctx.pos, ctx.yaw, ELEMENT_COLOR.CRYO, 2.8));
      combat.hitArc(ctx.pos, ctx.yaw, 3.2, 1.5, {
        member: m, mult: 2.2, element: 'CRYO', icd: null, heavy: true, kb: 4, dmgBonus: skillBonus(m),
        particles: { count: 4, castId: cast }, critBonusFn: m.passives ? helixA4 : undefined,
      });
      const side = new THREE.Vector3(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw));
      const at = ctx.pos.clone().addScaledVector(side, 1.6);
      at.y = ctx.world.groundH(at.x, at.z);
      spawnHelixClone(ctx, at, ctx.yaw);
      efx()?.burst(ctx.pos.clone().addScaledVector(fwd(ctx.yaw), 1.8).setY(ctx.pos.y + 1), 'CRYO', 2.5); // frost off the slash
      efx()?.burst(at.clone().setY(at.y + 1), 'CRYO', 1.6); // the clone condenses out of ice
      sfx.skill();
      return 15;
    },
    burst(ctx) {
      const m = ctx.member, combat = ctx.combat, world = ctx.world;
      const dir = fwd(ctx.yaw);
      const pos = ctx.pos.clone().addScaledVector(dir, 2);
      const g = new THREE.Group();
      const strands: THREE.Mesh[] = [];
      for (let s = 0; s < 2; s++) {
        for (let i = 0; i < 10; i++) {
          const b = new THREE.Mesh(ICE_SHARD, s ? ICE_MAT_A : ICE_MAT_B); // ice crystals spiralling as a double helix
          b.scale.set(1, 1.8 + (i % 3) * 0.4, 1);
          g.add(b);
          strands.push(b);
        }
      }
      const pairBonus = helixPairBonus(m);
      let tick = 0;
      const storm = efx()?.attach(g, 'CRYO', 'swirl', 1.4, 1.2); // snow whirling around the double helix
      combat.addEffect(new Timed(g, 6, (dt, t) => {
        pos.addScaledVector(dir, dt * 3);
        pos.y = world.groundH(pos.x, pos.z);
        g.position.copy(pos);
        strands.forEach((b, k) => {
          const s = k < 10 ? 0 : 1, i = k % 10;
          const a = t * 6 + i * 0.6 + s * Math.PI;
          b.position.set(Math.cos(a) * 1.3, i * 0.42, Math.sin(a) * 1.3);
          b.rotation.set(t * 3 + k, t * 4 + i, 0.4);
        });
        tick -= dt;
        if (tick <= 0) {
          tick = 0.5;
          combat.hitArea(pos.clone().setY(pos.y + 1.5), 3, {
            member: m, mult: 0.9, element: 'CRYO', icd: 'helix_q', dmgBonus: burstBonus(m), dmgBonusFn: pairBonus,
            critBonusFn: m.passives ? helixA4 : undefined,
          });
        }
      }, () => storm?.stop()));
      if (m.cons >= 6) {
        const side = new THREE.Vector3(Math.cos(ctx.yaw), 0, -Math.sin(ctx.yaw));
        const at = ctx.pos.clone().addScaledVector(side, -1.6);
        at.y = world.groundH(at.x, at.z);
        spawnHelixClone(ctx, at, ctx.yaw);
      }
      sfx.burst();
    },
  },
};

/** Advance the shared Helix clock (pairing timers). Call once per frame. */
export function tickKits(dt: number) { clock += dt; }

export function doNormal(ctx: KitCtx, combo: number) {
  const kit = KITS[ctx.member.id];
  if (!kit) return;
  normalHit(ctx, kit, combo);
}

export function comboLength(id: string) { return KITS[id]?.normal.length ?? 4; }
export function hasKit(id: string) { return !!KITS[id]; }
