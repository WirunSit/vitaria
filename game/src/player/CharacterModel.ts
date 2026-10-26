import * as THREE from 'three';
import type { Appearance, Element, WeaponType } from '../core/types';
import { ELEMENT_COLOR } from '../core/types';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { fitToHeight, hasModel, loadVRM } from '../models/ModelLibrary';
import { loadMixamoClips } from '../models/MixamoAnims';
import { toon, glow, addOutline } from '../world/Materials';
import { holdQuat, idleAim, WeaponSlot } from '../models/WeaponModels';
import { SamaraGlider } from '../models/Glider';

export interface AnimState {
  speed: number;      // 0 idle, 1 run, 1.6 sprint
  air: boolean;
  glide: boolean;
  attackT: number;    // 0..1 progress of current swing, -1 none
  attackKind: 'normal' | 'skill' | 'burst' | 'charged';
  dashing: boolean;
  /** climbing a steep slope / cliff (hand-over-hand) */
  climb?: boolean;
  /** …and it is near-vertical (cliff face rather than a steep slope) */
  climbSteep?: boolean;
  swing?: number;     // index of the current normal-attack swing in the combo
  swingLast?: boolean; // current swing is the combo finisher
}

/** Anything that can stand in for a character body (procedural placeholder or a real VRoid model). */
export interface CharModel {
  root: THREE.Group;
  readonly weapon: WeaponType;
  update(dt: number, s: AnimState): void;
  castPoint(out: THREE.Vector3): THREE.Vector3;
  /** Show the equipped weapon (weapon id from weapons.json, null = default look). */
  setWeapon?(id: string | null): void;
  /** Put a prop model (props/<name>.glb) on the head, e.g. a hat. */
  wearOnHead?(prop: string): void;
  dispose(): void;
}

/**
 * Procedural chibi-anime placeholder model built from the character's Appearance.
 * Will be replaced by real 3D models (VRoid/Blender) later — the interface stays the same.
 */
export class CharacterModel implements CharModel {
  root = new THREE.Group();
  body = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private glider = new SamaraGlider(0.85);
  private catalyst: THREE.Object3D | null = null;
  private weaponObj: THREE.Object3D | null = null;
  private slot: WeaponSlot | null = null;
  private phase = 0;
  private t = 0;
  readonly weapon: WeaponType;

  constructor(app: Appearance, element: Element, weapon: WeaponType) {
    this.weapon = weapon;
    const H = app.height;
    const skin = toon(app.skin);
    const outfit = toon(app.outfit);
    const outfit2 = toon(app.outfit2);
    const accent = toon(app.accent);
    const hair = toon(app.hair);
    const hairTip = toon(app.hairTip ?? app.hair);

    this.root.add(this.body);
    this.body.scale.setScalar(H);

    // legs
    for (const [leg, sx] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(0.1 * sx, 0.86, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.62, 4, 8), app.skirt ? skin : outfit2);
      thigh.position.y = -0.38;
      const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.2, 4, 8), toon(app.skirt ? app.outfit2 : '#3a3550'));
      boot.position.set(0, -0.72, 0.02);
      leg.add(thigh, boot);
      this.body.add(leg);
    }

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.32, 4, 10), outfit);
    torso.scale.set(1, 1, 0.72);
    torso.position.y = 1.18;
    this.body.add(torso);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 12), outfit2);
    belt.scale.z = 0.75;
    belt.position.y = 0.98;
    this.body.add(belt);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), glow(ELEMENT_COLOR[element], 1.6));
    core.position.set(0.1, 0.98, 0.13);
    core.userData.noOutline = true;
    this.body.add(core);

    if (app.skirt) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, 0.34, 12, 1, true), toon(app.outfit2, { side: THREE.DoubleSide }));
      skirt.position.y = 0.84;
      skirt.scale.z = 0.85;
      this.body.add(skirt);
    }
    if (app.coat) {
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.34, 0.75, 12, 1, true), toon(app.outfit, { side: THREE.DoubleSide }));
      coat.position.y = 0.72;
      coat.scale.z = 0.8;
      this.body.add(coat);
    }
    if (app.cape) {
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.03), accent);
      cape.position.set(0, 1.08, -0.15);
      cape.rotation.x = 0.12;
      this.body.add(cape);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 14), accent);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.42;
    this.body.add(collar);

    // arms
    for (const [arm, sx] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(0.235 * sx, 1.38, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.42, 4, 8), outfit);
      upper.position.y = -0.24;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin);
      hand.position.y = -0.5;
      hand.name = 'hand';
      arm.add(upper, hand);
      arm.rotation.z = 0.12 * sx;
      this.body.add(arm);
    }

    // head
    this.head.position.y = 1.64;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.205, 18, 14), skin);
    face.scale.set(1, 1.04, 0.96);
    this.head.add(face);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), toon(app.eyes));
      eye.scale.set(0.042, 0.06, 0.02);
      eye.position.set(0.075 * sx, -0.01, 0.188);
      eye.userData.noOutline = true;
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi.position.set(0.075 * sx + 0.012, 0.012, 0.205);
      hi.userData.noOutline = true;
      this.head.add(eye, hi);
    }
    this.buildHair(app, hair, hairTip);
    if (app.hat === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 20), toon('#e9cf86'));
      brim.position.y = 0.17;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#e9cf86'));
      dome.position.y = 0.17;
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), toon('#6fbf4a'));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), toon('#6fbf4a'));
      leaf.scale.set(1.6, 0.4, 1);
      leaf.position.set(0.18, 0.22, 0.08);
      this.head.add(brim, dome, band, leaf);
    } else if (app.hat === 'goggles') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 6, 18), toon('#5a4a3a'));
      band.rotation.x = Math.PI / 2 - 0.5;
      band.position.y = 0.1;
      this.head.add(band);
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12), glow('#ffcf8a', 1.1));
        lens.rotation.x = Math.PI / 2 - 0.5;
        lens.position.set(0.07 * sx, 0.2, 0.15);
        this.head.add(lens);
      }
    } else if (app.hat === 'monocle') {
      const mono = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), toon('#d8dde8'));
      mono.position.set(0.075, -0.01, 0.205);
      this.head.add(mono);
    }
    this.body.add(this.head);

    this.buildWeapon(weapon, element);
    this.buildGlider();
    addOutline(this.root, 0.018);
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.isOutline) o.castShadow = true; });
  }

  private buildHair(app: Appearance, hair: THREE.Material, tip: THREE.Material) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    cap.position.set(0, 0.02, -0.01);
    cap.rotation.x = -0.25;
    this.head.add(cap);
    // bangs
    for (let i = -2; i <= 2; i++) {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), hair);
      b.position.set(i * 0.065, 0.08, 0.17);
      b.rotation.set(Math.PI + 0.35, 0, i * 0.15);
      this.head.add(b);
    }
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), hair);
    back.position.set(0, -0.02, -0.07);
    back.scale.set(1.05, 1, 0.9);
    this.head.add(back);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], r: [number, number, number] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...p);
      m.rotation.set(...r);
      this.head.add(m);
      return m;
    };
    switch (app.hairStyle) {
      case 'long':
      case 'halfup':
        add(new THREE.CapsuleGeometry(0.17, 0.45, 4, 10), hair, [0, -0.32, -0.1], [0.08, 0, 0]).scale.z = 0.6;
        add(new THREE.SphereGeometry(0.12, 8, 6), tip, [0, -0.62, -0.13]).scale.set(1.3, 0.6, 0.6);
        if (app.hairStyle === 'halfup') add(new THREE.SphereGeometry(0.07, 8, 6), tip, [0, 0.12, -0.2]);
        break;
      case 'twintail':
        for (const sx of [-1, 1]) {
          add(new THREE.SphereGeometry(0.05, 8, 6), toon('#ffffff'), [0.19 * sx, 0.08, -0.04]);
          for (let k = 0; k < 4; k++) {
            add(new THREE.SphereGeometry(0.085 - k * 0.008, 10, 8), k === 3 ? tip : hair, [(0.26 + k * 0.03) * sx, -0.02 - k * 0.15, -0.06], [0, 0, 0.3 * sx]);
          }
        }
        break;
      case 'ponytail':
        add(new THREE.SphereGeometry(0.06, 8, 6), tip, [0, 0.14, -0.2]);
        add(new THREE.CapsuleGeometry(0.075, 0.55, 4, 8), hair, [0, -0.2, -0.28], [0.35, 0, 0]);
        add(new THREE.SphereGeometry(0.08, 8, 6), tip, [0, -0.52, -0.38]);
        break;
      case 'fluffy':
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          add(new THREE.SphereGeometry(0.1, 8, 6), hair, [Math.cos(a) * 0.17, 0.12 + Math.sin(i) * 0.03, Math.sin(a) * 0.17 - 0.02]);
        }
        break;
      case 'braids':
        for (const sx of [-1, 1]) {
          for (let k = 0; k < 6; k++) {
            add(new THREE.SphereGeometry(0.055, 8, 6), k % 2 ? tip : hair, [0.05 * sx + Math.sin(k * 1.2 + sx) * 0.03, -0.15 - k * 0.11, -0.17 - k * 0.01]);
          }
        }
        add(new THREE.CapsuleGeometry(0.16, 0.2, 4, 10), hair, [0, -0.18, -0.1]).scale.z = 0.6;
        break;
      default:
        add(new THREE.SphereGeometry(0.13, 10, 8), tip, [0, -0.17, -0.1]).scale.set(1.4, 0.8, 0.9);
    }
  }

  private buildWeapon(w: WeaponType, el: Element) {
    const hand = this.armR.getObjectByName('hand')!;
    const metal = toon('#dfe4ee');
    const elc = ELEMENT_COLOR[el];
    const g = new THREE.Group();
    if (w === 'SWORD') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.018), metal);
      blade.position.y = 0.52;
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 6), toon(elc));
      guard.position.y = 0.08;
      guard.rotation.z = Math.PI / 2;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), toon('#3a3550'));
      g.add(blade, guard, grip);
      g.rotation.x = Math.PI / 2;
    } else if (w === 'CLAYMORE') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.25, 0.04), toon(el === 'CRYO' ? '#cdf3fb' : '#cfd5e2'));
      blade.position.y = 0.75;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.08), toon(elc));
      guard.position.y = 0.12;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 6), toon('#3a3550'));
      g.add(blade, guard, grip);
      g.rotation.x = Math.PI / 2;
    } else if (w === 'POLEARM') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.9, 6), toon('#cfe6f5'));
      shaft.position.y = 0.4;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), metal);
      tip.position.y = 1.5;
      g.add(shaft, tip);
      g.rotation.x = Math.PI / 2;
    } else if (w === 'BOW') {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 6, 16, Math.PI * 0.9), toon('#7a5a38'));
      arc.rotation.z = Math.PI / 2 + Math.PI * 0.05;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), toon('#6fbf4a'));
      leaf.scale.set(1.5, 0.4, 1);
      leaf.position.set(0.05, 0.35, 0);
      g.add(arc, leaf);
      g.rotation.y = Math.PI / 2;
      const handL = this.armL.getObjectByName('hand')!;
      handL.add(g);
      this.weaponObj = g;
      this.slot = new WeaponSlot(w, handL, [g], (o) => o.quaternion.copy(holdQuat(idleAim(w))));
      return;
    } else if (w === 'CATALYST') {
      const c = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
      cap.rotation.z = Math.PI / 2;
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow(elc, 2));
      flame.userData.noOutline = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 16), toon('#e8c468'));
      c.add(cap, flame, ring);
      c.position.set(0.45, 1.55, -0.15);
      this.body.add(c);
      this.catalyst = c;
      this.slot = new WeaponSlot(w, c, [...c.children], () => {});
      return;
    }
    hand.add(g);
    this.weaponObj = g;
    this.slot = new WeaponSlot(w, hand, [g], (o) => o.quaternion.copy(holdQuat(idleAim(w))));
  }

  setWeapon(id: string | null) { this.slot?.set(id); }

  private buildGlider() {
    // on the back, at shoulder-blade height
    this.glider.root.position.set(0, 1.05, -0.2);
    this.body.add(this.glider.root);
  }

  update(dt: number, s: AnimState) {
    this.t += dt;
    const moving = s.speed > 0.05;
    this.phase += dt * (moving ? 7 + s.speed * 4 : 0);
    const sw = Math.sin(this.phase);
    const amp = moving ? Math.min(1, s.speed) * 0.75 : 0;

    this.glider.update(dt, s.glide);
    let lx = sw * amp, rx = -sw * amp;
    let alx = -sw * amp * 0.8, arx = sw * amp * 0.8;
    let alz = -0.12, arz = 0.12;
    let bodyTilt = moving ? 0.08 * s.speed : 0;
    let bob = moving ? Math.abs(Math.sin(this.phase)) * 0.04 : Math.sin(this.t * 2) * 0.008;

    if (s.air && !s.glide) { lx = -0.6; rx = 0.3; alx = -0.4; arx = -0.4; alz = -0.6; arz = 0.6; }
    if (s.glide) { lx = 0.1; rx = 0.25; alx = -2.9; arx = -2.9; alz = -0.25; arz = 0.25; bodyTilt = 0.35; bob = 0; }
    if (s.dashing) { bodyTilt = 0.5; lx = 0.6; rx = -0.6; alx = 0.6; arx = 0.6; }

    if (s.attackT >= 0) {
      const p = s.attackT;
      if (this.weapon === 'BOW') {
        alx = -1.5; arx = -1.45; alz = 0.15; arz = -0.2;
      } else if (this.weapon === 'CATALYST') {
        arx = -1.5 + Math.sin(p * Math.PI) * -0.4; alx = s.attackKind === 'burst' ? -2.6 : -0.3; arz = -0.1;
        if (s.attackKind === 'burst') arx = -2.8;
      } else {
        const heavy = this.weapon === 'CLAYMORE' ? 1.25 : 1;
        arx = THREE.MathUtils.lerp(-2.6 * heavy, 0.7, easeOut(p));
        arz = THREE.MathUtils.lerp(-0.6, 0.4, p);
        bodyTilt += Math.sin(p * Math.PI) * 0.15;
        if (s.attackKind === 'burst' || s.attackKind === 'skill') { alx = -1.2; }
      }
    }
    const k = Math.min(1, dt * 18);
    this.legL.rotation.x += (lx - this.legL.rotation.x) * k;
    this.legR.rotation.x += (rx - this.legR.rotation.x) * k;
    this.armL.rotation.x += (alx - this.armL.rotation.x) * k;
    this.armR.rotation.x += (arx - this.armR.rotation.x) * k;
    this.armL.rotation.z += (alz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (arz - this.armR.rotation.z) * k;
    this.body.rotation.x += (bodyTilt - this.body.rotation.x) * k;
    this.body.position.y = bob;
    if (this.catalyst) {
      this.catalyst.position.y = 1.55 + Math.sin(this.t * 2.2) * 0.06;
      this.catalyst.rotation.y += dt * 1.2;
      if (s.attackT >= 0) this.catalyst.position.z = 0.25; else this.catalyst.position.z += (-0.15 - this.catalyst.position.z) * k;
    }
  }

  /** World-space position of the weapon tip / casting point (for projectiles). */
  castPoint(out: THREE.Vector3): THREE.Vector3 {
    if (this.catalyst) return this.catalyst.getWorldPosition(out);
    const hand = (this.weapon === 'BOW' ? this.armL : this.armR).getObjectByName('hand')!;
    return hand.getWorldPosition(out);
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}

function easeOut(t: number) { return 1 - (1 - t) * (1 - t); }

/** Amoeby — the floating amoeba mascot. */
/** The floating companion. A VRoid model (npcs/NPC_Vita.vrm) when present, else the procedural amoeba blob. */
const COMPANION_VRM = 'npcs/NPC_Vita.vrm';
/** Vita's butterfly wings (cyan in the original model): repainted as glowing, half-see-through white */
const COMPANION_WING_MATERIALS = new Set(['マテリアル 1']);

function paintGlowingWings(vrm: VRM) {
  vrm.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
      if (!COMPANION_WING_MATERIALS.has(m.name)) continue;
      m.map = null; // the cyan texture would tint the white
      m.color.set(0xffffff);
      (m as unknown as { shadeColorFactor?: THREE.Color }).shadeColorFactor?.set(0xffffff);
      m.emissive.set(0xffffff);
      m.emissiveIntensity = 0.44; // a soft glow (2.2 bloomed far too bright)
      m.transparent = true;
      m.opacity = 0.5;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
  });
}

export class AmoebyModel {
  root = new THREE.Group();
  private blob: THREE.Mesh;
  private t = Math.random() * 10;
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private blinkT = 2;
  constructor() {
    this.blob = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 20, 16),
      new THREE.MeshToonMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.8, emissive: 0x2a4a6a }),
    );
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshToonMaterial({ color: 0xffb3d9, transparent: true, opacity: 0.55 }));
    inner.position.y = -0.04;
    const heart = new THREE.Group();
    for (const sx of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), toon('#ff5fa2'));
      lobe.position.set(0.035 * sx, 0.02, 0);
      heart.add(lobe);
    }
    const tipc = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.09, 8), toon('#ff5fa2'));
    tipc.rotation.x = Math.PI;
    tipc.position.y = -0.03;
    heart.add(tipc);
    heart.position.set(0, -0.06, -0.02);
    this.root.add(this.blob, inner, heart);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1a1830 }));
      eye.scale.set(0.8, 1.1, 0.5);
      eye.position.set(0.1 * sx, 0.06, 0.28);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi.position.set(0.1 * sx + 0.02, 0.09, 0.31);
      this.root.add(eye, hi);
      const arm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshToonMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85 }));
      arm.position.set(0.3 * sx, -0.08, 0.05);
      arm.scale.set(1.2, 0.8, 0.8);
      this.root.add(arm);
    }
    const hat = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 16), toon('#e8c468'));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.6 }));
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), toon('#8a6243'));
    handle.position.set(0.07, -0.08, 0);
    handle.rotation.z = 0.7;
    hat.add(ring, lens, handle);
    hat.position.set(-0.08, 0.34, 0.05);
    hat.rotation.set(-0.3, 0, 0.3);
    this.root.add(hat);
    addOutline(this.root, 0.012);
    if (hasModel(COMPANION_VRM)) void this.loadCompanion();
  }

  /** Small floating girl: ~0.9 m, relaxed breathing idle with the legs tucked as if sitting on air. */
  private async loadCompanion() {
    const vrm = await loadVRM(COMPANION_VRM);
    if (!vrm) return;
    for (const c of [...this.root.children]) this.root.remove(c); // drop the blob
    paintGlowingWings(vrm);
    fitToHeight(vrm.scene, 0.9);
    vrm.scene.position.y = -0.55; // the follow point is ~shoulder height: hang the body around it
    this.root.add(vrm.scene);
    this.vrm = vrm;
    const clips = await loadMixamoClips(vrm, { idle: 'relax_idle' });
    const idle = clips.get('idle');
    if (idle) {
      this.mixer = new THREE.AnimationMixer(vrm.scene);
      this.mixer.clipAction(idle).play();
    }
  }

  private bone(n: VRMHumanBoneName) { return this.vrm?.humanoid.getNormalizedBoneNode(n) ?? null; }

  update(dt: number) {
    this.t += dt;
    if (!this.vrm) {
      const s = 1 + Math.sin(this.t * 3) * 0.04;
      this.blob.scale.set(s, 1 / s, s);
      return;
    }
    this.mixer?.update(dt);
    // floating pose on top of the idle: knees tucked, feet swinging a little, arms relaxed outward
    const sw = Math.sin(this.t * 1.6);
    // (offsets are added on top of the clip's pose each frame — only valid while the mixer rewrites the bones)
    // VRM 0.x models are turned 180° on load, which mirrors the x/z bone axes
    const k = this.vrm.meta?.metaVersion === '0' ? -1 : 1;
    if (this.mixer) for (const [side, ph] of [['left', 0], ['right', 1.3]] as const) {
      const ul = this.bone(`${side}UpperLeg`), ll = this.bone(`${side}LowerLeg`), ua = this.bone(`${side}UpperArm`);
      if (ul) ul.rotation.x += k * (-0.55 + Math.sin(this.t * 1.6 + ph) * 0.08);
      if (ll) ll.rotation.x += k * (1.0 + Math.sin(this.t * 1.6 + ph) * 0.12);
      if (ua) ua.rotation.z += k * (side === 'left' ? 0.25 : -0.25);
    }
    this.vrm.scene.rotation.z = sw * 0.04;
    this.vrm.scene.position.y = -0.55 + Math.sin(this.t * 2.1) * 0.03;
    // blink
    this.blinkT -= dt;
    this.vrm.expressionManager?.setValue('blink', this.blinkT < 0.12 ? 1 : 0);
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
    this.vrm.update(dt);
  }
}
