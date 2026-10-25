import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Appearance, Element, WeaponType } from '../core/types';
import { ELEMENT_COLOR } from '../core/types';
import { CharacterModel, type AnimState, type CharModel } from '../player/CharacterModel';
import { glow, toon } from '../world/Materials';
import { fitToHeight, hasModel, loadVRM } from './ModelLibrary';
import { holdQuat, idleAim, WeaponSlot } from './WeaponModels';
import { clipSetFor, loadMixamoClips, type AnimKey } from './MixamoAnims';
import { WeaponTrail } from './WeaponTrail';

/**
 * VRoid (.vrm) character — same interface as the placeholder, so the rest of the game doesn't care which one it gets.
 * Plays the shared Mixamo clip set (MixamoAnims) once it has loaded; procedural bone posing covers the gap and gliding.
 */
export class VrmCharacterModel implements CharModel {
  root = new THREE.Group();
  readonly weapon: WeaponType;
  private holder = new THREE.Group();
  private t = 0;
  private phase = 0;
  private blinkT = 2;
  private catalyst: THREE.Object3D | null = null;
  private weaponObj: THREE.Object3D | null = null;
  private slot: WeaponSlot | null = null;
  private glider = new THREE.Group();
  private pose: Partial<Record<VRMHumanBoneName, THREE.Euler>> = {};
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<AnimKey, THREE.AnimationAction>();
  private cur: THREE.AnimationAction | null = null;
  private curKey: AnimKey | null = null;
  private prevAttackT = -1;
  private wasAir = false;
  private wasDash = false;
  private combatT = 0;
  /** time left on a skill/burst/charged clip that keeps playing after the game's (short) attack timer */
  private showT = 0;
  /** weapon's resting orientation in the hand, and how much it is currently re-aimed (see alignWeapon) */
  private baseQ = new THREE.Quaternion();
  private trail: WeaponTrail | null = null;
  private swinging = false;
  private aimW = 0;

  /** `animFor` = character id for its full move set; null = NPC (relaxed idle only) */
  constructor(private vrm: VRM, app: Appearance, element: Element, weapon: WeaponType, animFor: string | null = null) {
    this.weapon = weapon;
    this.holder.add(vrm.scene);
    this.root.add(this.holder);
    fitToHeight(vrm.scene, 1.68 * app.height);
    this.buildWeapon(weapon, element);
    // swing trail for blades, tinted toward the element
    if (weapon === 'SWORD' || weapon === 'CLAYMORE' || weapon === 'POLEARM') {
      this.trail = new WeaponTrail(new THREE.Color(ELEMENT_COLOR[element]).lerp(new THREE.Color('#ffffff'), 0.3), this.root);
    }
    this.buildGlider();
    loadMixamoClips(vrm, clipSetFor(weapon, animFor)).then((clips) => {
      if (!clips.size) return;
      this.mixer = new THREE.AnimationMixer(vrm.scene);
      for (const [k, c] of clips) {
        const a = this.mixer.clipAction(c);
        if (k !== 'idle' && k !== 'ready' && k !== 'run') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
        this.actions.set(k, a);
      }
    });
  }

  /** Which clip fits the controller state (null = gliding, use the procedural pose). */
  private pick(s: AnimState): AnimKey | null {
    if (s.glide || s.climb) return null;
    // a skill / burst / charged attack plays out at its own pace unless the player moves or attacks again
    if (this.showT > 0 && this.curKey && s.attackT < 0 && s.speed <= 0.05 && !s.dashing && !s.air) return this.curKey;
    if (s.attackT >= 0) {
      if (s.attackKind === 'skill') return 'skill';
      if (s.attackKind === 'burst') return 'burst';
      if (s.attackKind === 'charged') return 'heavy';
      return s.swingLast ? 'atk4' : (['atk1', 'atk2', 'atk3'] as const)[(s.swing ?? 0) % 3];
    }
    if (s.dashing) return 'dodge';
    if (s.air) return 'jump';
    if (s.speed > 0.05) return 'run';
    // keep the sword stance for a few seconds after a fight, then relax (like Genshin)
    return this.combatT > 0 ? 'ready' : 'idle';
  }

  /** Mixamo clips; returns false when the procedural pose should run instead. */
  private animate(dt: number, s: AnimState): boolean {
    const key = this.mixer ? this.pick(s) : null;
    const next = key && this.actions.get(key);
    if (!this.mixer || !key || !next) {
      if (this.cur) { this.cur.fadeOut(0.2); this.cur = null; this.curKey = null; }
      this.mixer?.update(dt);
      return false;
    }
    const showy = key === 'skill' || key === 'burst' || key === 'heavy';
    const restart = key !== this.curKey
      || (s.attackT >= 0 && (s.attackT < this.prevAttackT || this.prevAttackT < 0))
      || (key === 'jump' && !this.wasAir) || (key === 'dodge' && !this.wasDash);
    if (restart) {
      next.reset();
      next.timeScale = 1;
      // jump: skip the crouch (the controller already took off) · attacks are scrubbed by attackT below
      if (key === 'jump') next.time = next.getClip().duration * 0.3;
      if (key === 'dodge') next.timeScale = 1.6;
      // big moves: natural speed (a bit brisk), skipping the slow start, capped so they don't drag
      if (showy) {
        const d = next.getClip().duration;
        next.time = d * 0.08;
        next.timeScale = Math.max(1.25, d * 0.92 / 1.9);
        this.showT = d * 0.92 / next.timeScale;
      }
      next.play();
      if (this.cur && this.cur !== next) next.crossFadeFrom(this.cur, s.attackT >= 0 ? 0.08 : key === 'idle' ? 0.5 : 0.2, false);
      this.cur = next;
      this.curKey = key;
    }
    this.showT = showy ? Math.max(0, this.showT - dt) : 0;
    if (s.attackT >= 0 && !showy) {
      // keep the swing in step with the game's hit timing: the clip's wind-up + strike span the attack duration
      next.timeScale = 0;
      next.time = s.attackT * next.getClip().duration * 0.8;
    } else if (key === 'run') next.timeScale = THREE.MathUtils.clamp(s.speed, 0.6, 1.4);
    this.mixer.update(dt);
    return true;
  }

  private bone(name: VRMHumanBoneName) { return this.vrm.humanoid.getNormalizedBoneNode(name); }

  private buildWeapon(w: WeaponType, el: Element) {
    const elc = ELEMENT_COLOR[el];
    if (w === 'CATALYST') {
      const c = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
      cap.rotation.z = Math.PI / 2;
      c.add(cap, new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow(elc, 2)));
      c.position.set(0.45, 1.5, -0.15);
      this.root.add(c);
      this.catalyst = c;
      this.slot = new WeaponSlot(w, c, [...c.children], () => {});
      return;
    }
    const hand = this.vrm.humanoid.getRawBoneNode(w === 'BOW' ? 'leftHand' : 'rightHand');
    if (!hand) return;
    const g = new THREE.Group();
    const metal = toon('#dfe4ee');
    const len = w === 'CLAYMORE' ? 1.25 : w === 'POLEARM' ? 1.9 : w === 'BOW' ? 0.85 : 0.85;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(w === 'CLAYMORE' ? 0.16 : 0.05, len, 0.02), w === 'BOW' ? toon('#7a5a38') : metal);
    blade.position.y = len / 2;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05), toon(elc));
    g.add(blade, guard);
    // the hand bone's scale follows the model fit; compensate so the weapon keeps world size
    const s = 1 / (this.vrm.scene.scale.x || 1);
    g.scale.setScalar(s);
    // aim the blade in "hanging arm" space, then undo the arm-down roll so it sits right in the hand's frame
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), w === 'BOW' ? 1.35 : -1.35)
      .multiply(holdQuat(idleAim(w)));
    g.quaternion.copy(q);
    if (w === 'POLEARM') blade.position.y = len / 2 - 0.45;
    if (w === 'BOW') blade.position.y = 0; // the grip is the middle of the bow
    hand.add(g);
    this.weaponObj = g;
    this.baseQ.copy(q);
    this.slot = new WeaponSlot(w, hand, [g], (o) => o.quaternion.copy(q));
  }

  private buildGlider() {
    const mat = new THREE.MeshToonMaterial({ color: 0xe8d39a, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    for (const sx of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(0.3 * sx, 0.25, 1.1 * sx, 0.2, 1.3 * sx, 0.05);
      shape.bezierCurveTo(1.0 * sx, -0.12, 0.3 * sx, -0.1, 0, 0);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      wing.rotation.x = -Math.PI / 2;
      this.glider.add(wing);
    }
    this.glider.position.set(0, 1.95, -0.05);
    this.glider.visible = false;
    this.root.add(this.glider);
  }

  private set(name: VRMHumanBoneName, x: number, y: number, z: number, k: number) {
    const b = this.bone(name);
    if (!b) return;
    // VRM 0.x models are turned 180° on load, which mirrors the bones' x/z axes
    if (this.vrm.meta?.metaVersion === '0') { x = -x; z = -z; }
    b.rotation.x += (x - b.rotation.x) * k;
    b.rotation.y += (y - b.rotation.y) * k;
    b.rotation.z += (z - b.rotation.z) * k;
  }

  update(dt: number, s: AnimState) {
    this.t += dt;
    const moving = s.speed > 0.05;
    this.phase += dt * (moving ? 7 + s.speed * 4 : 0);
    const sw = Math.sin(this.phase);
    const amp = moving ? Math.min(1, s.speed) * 0.7 : 0;
    const k = Math.min(1, dt * 14);
    this.glider.visible = s.glide;
    this.combatT = s.attackT >= 0 ? 4 : Math.max(0, this.combatT - dt);
    this.swinging = s.attackT >= 0;
    const clipped = this.animate(dt, s);
    this.prevAttackT = s.attackT;
    this.wasAir = s.air;
    this.wasDash = s.dashing;
    if (clipped) {
      this.holder.position.y = 0;
      this.face(dt);
      return;
    }

    // defaults: arms hanging (VRM rest pose is a T-pose)
    let lArmX = sw * amp * 0.8, rArmX = -sw * amp * 0.8, lArmZ = -1.2, rArmZ = 1.2;
    let lLeg = -sw * amp, rLeg = sw * amp;
    let lKnee = Math.max(0, sw) * amp * 1.1, rKnee = Math.max(0, -sw) * amp * 1.1;
    let spine = moving ? 0.08 * s.speed : Math.sin(this.t * 2) * 0.02;
    let bob = moving ? Math.abs(Math.sin(this.phase)) * 0.035 : 0;

    if (s.air && !s.glide) { lLeg = -0.5; rLeg = 0.2; lKnee = 0.9; rKnee = 0.4; lArmZ = -0.7; rArmZ = 0.7; }
    if (s.glide) { lArmZ = -0.1; rArmZ = 0.1; lArmX = 0; rArmX = 0; lLeg = 0.1; rLeg = 0.2; spine = 0.35; bob = 0; }
    if (s.dashing) { spine = 0.45; lLeg = -0.6; rLeg = 0.6; }
    let lFore = -0.15, rFore = 0.15, chest = 0;
    if (s.climb) {
      // hand-over-hand: one arm reaches up the slope while the other pulls down, the opposite knee steps up
      // (the controller already leans the whole body toward the slope)
      const c = Math.sin(this.phase * 0.8), up = (v: number) => (v + 1) / 2;
      // (rest pose is a T-pose: z raises/lowers an arm, x then swings it forward)
      lArmZ = 0.95 + 0.5 * up(c); rArmZ = -0.95 - 0.5 * up(-c);
      lArmX = 0.35; rArmX = 0.35;
      lFore = 0.25 * up(-c); rFore = -0.25 * up(c);
      lLeg = -0.25 - 0.8 * up(-c); rLeg = -0.25 - 0.8 * up(c);
      lKnee = 0.35 + 1.0 * up(-c); rKnee = 0.35 + 1.0 * up(c);
      spine = 0.15; chest = 0.05;
      bob = Math.abs(c) * 0.03;
    }
    this.set('leftUpperArm', lArmX, 0, lArmZ, k);
    this.set('rightUpperArm', rArmX, 0, rArmZ, k);
    this.set('leftLowerArm', 0, 0, lFore, k);
    this.set('rightLowerArm', 0, 0, rFore, k);
    this.set('leftUpperLeg', lLeg, 0, 0, k);
    this.set('rightUpperLeg', rLeg, 0, 0, k);
    this.set('leftLowerLeg', lKnee, 0, 0, k);
    this.set('rightLowerLeg', rKnee, 0, 0, k);
    this.set('spine', spine, 0, 0, k);
    this.set('chest', chest, 0, 0, k);
    this.holder.position.y = bob;
    this.face(dt);
  }

  private face(dt: number) {
    // blink
    this.blinkT -= dt;
    const em = this.vrm.expressionManager;
    if (em) {
      const b = this.blinkT < 0.12 ? 1 : 0;
      em.setValue('blink', b);
      if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    }
    if (this.catalyst) {
      this.catalyst.position.y = 1.5 + Math.sin(this.t * 2.2) * 0.06;
      this.catalyst.rotation.y += dt * 1.2;
    }
    this.vrm.update(dt);
    this.alignWeapon(dt);
    this.updateTrail();
  }

  /** blade grip / point (world) → swing ribbon while attacking or while a skill/burst clip plays out */
  private updateTrail() {
    if (!this.trail) return;
    const w = this.slot?.active;
    const active = !!w && w.visible && (this.swinging || this.showT > 0);
    if (!w) { this.trail.update(null, null, false); return; }
    const len = this.weapon === 'CLAYMORE' ? 1.3 : this.weapon === 'POLEARM' ? 1.4 : 0.92;
    this.trail.update(w.localToWorld(_v1.set(0, len * 0.55, 0)), w.localToWorld(_v2.set(0, len, 0)), active);
  }

  /**
   * Mixamo clips grip two-handed weapons with both hands and aim bows upright; the weapon's fixed in-hand angle
   * can't follow that. Claymore/polearm: when both hands are on the handle, turn the weapon onto the line between
   * them. Bow: stand it up while shooting. Rotates from the resting angle each frame (keeps the weapon's roll).
   */
  private alignWeapon(dt: number) {
    const obj = this.slot?.active;
    if (!obj || this.weapon === 'SWORD' || this.weapon === 'CATALYST') return;
    const H = this.vrm.humanoid;
    const rh = H.getRawBoneNode('rightHand'), lh = H.getRawBoneNode('leftHand');
    if (!rh || !lh || !obj.parent) return;
    const R = rh.getWorldPosition(_v1), L = lh.getWorldPosition(_v2);
    let want = 0;
    if (this.weapon === 'BOW') {
      want = this.curKey && /^(atk|heavy|skill)/.test(this.curKey) ? 1 : 0;
      this.root.getWorldQuaternion(_q1);
      _dir.set(0, 1, 0.12).normalize().applyQuaternion(_q1);
    } else {
      const d = R.distanceTo(L);
      want = 1 - THREE.MathUtils.smoothstep(d, 0.3, 0.55);
      _dir.subVectors(L, R).normalize();
    }
    this.aimW += (want - this.aimW) * Math.min(1, dt * 12);
    obj.quaternion.copy(this.baseQ);
    if (this.aimW < 0.01) return;
    // current blade direction in world space → rotate it onto the wanted direction
    obj.parent.getWorldQuaternion(_q1);
    _q2.copy(_q1).multiply(this.baseQ);
    _blade.set(0, 1, 0).applyQuaternion(_q2);
    _q3.setFromUnitVectors(_blade, _dir);
    _q3.slerp(_IDENT, 1 - this.aimW);
    // local = parentWorld⁻¹ · delta · parentWorld · base
    obj.quaternion.copy(_q1).invert().multiply(_q3).multiply(_q1).multiply(this.baseQ);
  }

  setWeapon(id: string | null) { this.slot?.set(id); }

  castPoint(out: THREE.Vector3): THREE.Vector3 {
    if (this.catalyst) return this.catalyst.getWorldPosition(out);
    const hand = this.vrm.humanoid.getRawBoneNode(this.weapon === 'BOW' ? 'leftHand' : 'rightHand');
    return hand ? hand.getWorldPosition(out) : this.root.getWorldPosition(out).add(new THREE.Vector3(0, 1.3, 0));
  }

  dispose() {
    this.trail?.dispose();
    this.vrm.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    void this.weaponObj;
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3(), _blade = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _IDENT = new THREE.Quaternion();

/** Starts with the placeholder, swaps to the real model once it has loaded. */
export class SwappableModel implements CharModel {
  root = new THREE.Group();
  readonly weapon: WeaponType;
  private cur: CharModel;
  private disposed = false;
  private weaponId: string | null = null;

  constructor(fallback: CharModel, pending: Promise<CharModel | null> | null) {
    this.weapon = fallback.weapon;
    this.cur = fallback;
    this.root.add(fallback.root);
    pending?.then((m) => {
      if (!m || this.disposed) return;
      this.root.remove(this.cur.root);
      this.cur.dispose();
      this.cur = m;
      this.root.add(m.root);
      m.setWeapon?.(this.weaponId);
    });
  }
  get isReal() { return !(this.cur instanceof CharacterModel); }
  update(dt: number, s: AnimState) { this.cur.update(dt, s); }
  castPoint(out: THREE.Vector3) { return this.cur.castPoint(out); }
  setWeapon(id: string | null) { this.weaponId = id; this.cur.setWeapon?.(id); }
  dispose() { this.disposed = true; this.cur.dispose(); }
}

/** Factory used everywhere a character/NPC body is needed. `file` e.g. "characters/CHR_Sira.vrm". */
export function createCharacterModel(file: string | null, app: Appearance, element: Element, weapon: WeaponType, animFor: string | null = null): CharModel {
  const fallback = new CharacterModel(app, element, weapon);
  if (!file || !hasModel(file)) return fallback;
  const pending = loadVRM(file).then((vrm) => (vrm ? new VrmCharacterModel(vrm, app, element, weapon, animFor) : null));
  return new SwappableModel(fallback, pending);
}
