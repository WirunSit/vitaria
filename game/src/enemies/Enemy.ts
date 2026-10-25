import * as THREE from 'three';
import type { Element, EnemyDef } from '../core/types';
import { ELEMENT_COLOR } from '../core/types';
import type { Aura, AuraHolder } from '../combat/Elements';
import { toon, glow, addOutline } from '../world/Materials';

const HP_MULT: [number, number][] = [[1, 1], [10, 2.6], [20, 4.5], [40, 12], [50, 20], [70, 45], [90, 90]];
const ATK_MULT: [number, number][] = [[1, 1], [10, 1.8], [20, 3], [40, 6.5], [50, 8.5], [70, 14], [90, 20]];
function interp(tbl: [number, number][], lv: number) {
  for (let i = 1; i < tbl.length; i++) {
    const [l1, v1] = tbl[i - 1], [l2, v2] = tbl[i];
    if (lv <= l2) return v1 + ((v2 - v1) * (lv - l1)) / (l2 - l1);
  }
  return tbl[tbl.length - 1][1];
}

export interface EnemyCtx {
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  groundY: (x: number, z: number) => number;
  damagePlayer: (amount: number, from: Enemy) => void;
  others: Enemy[];
  requestSplit: (e: Enemy) => void;
  requestSummon: (boss: Enemy) => void;
  telegraph: (pos: THREE.Vector3, radius: number, time: number, onHit: () => void) => void;
  onPhageLyse: (phage: Enemy, host: Enemy) => void;
  /** a tumor nobody destroyed in time: its boss regains HP */
  onTumorRipe: (tumor: Enemy) => void;
  /** Syndicate gene-gun: rewrite the element of nearby enemies */
  requestSplice: (from: Enemy) => void;
}

const SIZE: Partial<Record<EnemyDef['kind'], [number, number]>> = {
  boss_king: [2.3, 4.4], boss_golem: [2.8, 6.2], bacillus: [0.75, 1.1], phage: [0.6, 1],
  trooper: [0.6, 1.5], machine: [0.9, 1.7], tumor: [0.7, 1.3], gunner: [0.55, 1.75], boss_chimera: [2.4, 4], caster: [0.55, 1.6], boss_virus: [2.6, 6.5], boss_spore: [2.2, 5.2], boss_cyano: [2.4, 4.6], boss_superbug: [2.6, 4.8], boss_medusa: [2.8, 6], boss_herald: [0.9, 3.4],
};

let nextId = 1;

export class Enemy implements AuraHolder {
  uid = nextId++;
  root = new THREE.Group();
  model = new THREE.Group();
  pos: THREE.Vector3;
  home: THREE.Vector3;
  vel = new THREE.Vector3();
  yaw = Math.random() * Math.PI * 2;
  hp: number;
  maxHp: number;
  atk: number;
  defense: number;
  res: Record<Element, number>;
  radius: number;
  height: number;
  aura: Aura | null = null;
  frozen = 0;
  catalyzed = 0;
  permanentElement: Element | null;
  alive = true;
  deadT = 0;
  aggro = false;
  state: 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'latched' = 'idle';
  stateT = 0;
  /** set by attachEnemyModel when a downloaded model replaces the procedural body */
  modelAnim: ((dt: number) => void) | null = null;
  /** a rigged model drives the body (procedural hop/squash/arm swings are skipped) */
  rigged = false;
  /** bumped whenever an attack starts that has no wind-up state (boss patterns) — the animator swings on it */
  attackPulse = 0;
  /** seconds the death clip plays before the body fades out */
  deathHold = 0;
  attackCd = 1;
  splitT = 0;
  generation = 0;
  burnT = 0;
  burnTick = 0;
  burnSource: { atk: number; level: number; bm: number } | null = null;
  electroTicks = 0;
  electroTickT = 0;
  electroSource: { level: number; bm: number } | null = null;
  resDownT = 0;
  exposedT = 0;
  hitFlash = 0;
  latchHost: Enemy | null = null;
  latchT = 0;
  // boss knowledge shield
  shieldActive = false;
  shieldsDone = 0;
  summonT = 10;
  questTag: string | null = null;
  private bobT = Math.random() * 10;
  body!: THREE.Mesh;
  private tail: THREE.Object3D | null = null;
  private shieldMesh: THREE.Mesh | null = null;
  invulnerable = false;
  /** movement/attack speed factor (domain modifiers) */
  speedMul = 1;
  /** last party member that hit this enemy (weapon kill effects) */
  lastHitBy: import('../player/Party').PartyMember | null = null;

  constructor(public def: EnemyDef, public level: number, pos: THREE.Vector3, variant: Element | null) {
    this.pos = pos.clone();
    this.home = pos.clone();
    this.permanentElement = variant;
    this.maxHp = Math.round(def.base.hp * interp(HP_MULT, level));
    this.hp = this.maxHp;
    this.atk = def.base.atk * interp(ATK_MULT, level);
    this.defense = 5 * level + 500;
    this.res = { PYRO: 0.1, HYDRO: 0.1, ANEMO: 0.1, ELECTRO: 0.1, DENDRO: 0.1, CRYO: 0.1, GEO: 0.1, PHYSICAL: 0.1 };
    if (variant) {
      this.res[variant] = 10; // immune to own element
      this.aura = { element: variant, units: 1, decay: 0.02 };
    }
    [this.radius, this.height] = SIZE[def.kind] ?? [0.6, 1.1];
    if (def.kind === 'dummy') { this.radius = 0.5; this.height = 1.9; this.invulnerable = false; }
    this.buildModel();
    this.root.add(this.model);
    this.root.position.copy(this.pos);
    if (this.isBoss) this.attackCd = 3;
    if (def.kind === 'boss_golem') this.summonT = 20;
    if (def.kind === 'boss_chimera') { this.summonT = 18; this.setElement('CRYO'); }
    if (def.kind === 'boss_virus') { this.summonT = 12; this.permanentElement = 'ANEMO'; this.res.ANEMO = 10; }
    if (def.kind === 'boss_medusa') { this.summonT = 12; this.permanentElement = 'ELECTRO'; this.res.ELECTRO = 10; }
    if (def.kind === 'boss_herald') { this.summonT = 16; this.setElement('ANEMO'); }
    if (def.kind === 'boss_superbug') { this.summonT = 12; this.permanentElement = 'HYDRO'; this.res.HYDRO = 10; }
    if (def.kind === 'boss_cyano') { this.summonT = 14; this.permanentElement = 'ELECTRO'; this.res.ELECTRO = 10; }
    if (def.kind === 'boss_spore') { this.summonT = 14; this.permanentElement = 'DENDRO'; this.res.DENDRO = 10; }
  }

  get isBoss() { return !!this.def.boss; }
  get isBacteria() { return this.def.tags.includes('bacteria'); }
  get isVirus() { return this.def.tags.includes('virus'); }
  get tags() { return this.def.tags; }

  private buildModel() {
    const k = this.def.kind;
    const base = this.permanentElement ? ELEMENT_COLOR[this.permanentElement] : k === 'phage' ? '#8fe0c8' : '#a8dc7a';
    const jelly = new THREE.MeshToonMaterial({ color: base, transparent: true, opacity: 0.88, emissive: new THREE.Color(base).multiplyScalar(0.18) });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1830 });
    const addEyes = (parent: THREE.Object3D, y: number, z: number, sep: number, s: number) => {
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), eyeMat);
        e.scale.set(0.8, 1.15, 0.5);
        e.position.set(sep * sx, y, z);
        e.userData.noOutline = true;
        const hi = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        hi.position.set(sep * sx + s * 0.3, y + s * 0.4, z + s * 0.4);
        hi.userData.noOutline = true;
        parent.add(e, hi);
      }
    };
    if (k === 'coccus' || k === 'boss_king') {
      const r = k === 'boss_king' ? 2.2 : 0.55;
      this.body = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), jelly);
      this.body.position.y = r;
      this.model.add(this.body);
      // diplococcus buddy
      const buddy = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 14, 10), jelly);
      buddy.position.set(-r * 0.8, r * 0.5, -r * 0.6);
      this.model.add(buddy);
      const nuc = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 10, 8), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      nuc.position.set(0, r * 0.9, -r * 0.1);
      nuc.userData.noOutline = true;
      this.model.add(nuc);
      addEyes(this.body, r * 0.15, r * 0.85, r * 0.32, r * 0.16);
      if (k === 'boss_king') {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 5), toon('#ffd36a'));
          spike.position.set(Math.cos(a) * 0.9, r * 1.85, Math.sin(a) * 0.9);
          spike.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
          this.model.add(spike);
        }
        const band = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 6, 20), toon('#e8c468'));
        band.rotation.x = Math.PI / 2;
        band.position.y = r * 1.72;
        this.model.add(band);
      }
    } else if (k === 'bacillus') {
      this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 6, 12), jelly);
      this.body.rotation.x = Math.PI / 2;
      this.body.position.y = 0.45;
      this.model.add(this.body);
      const tail = new THREE.Group();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(Math.sin(i * 0.9) * 0.15, 0, -i * 0.12));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.035, 5), toon('#6fa65a'));
      tail.add(tube);
      tail.position.set(0, 0.45, -0.75);
      this.model.add(tail);
      this.tail = tail;
      const eyesGrp = new THREE.Group();
      eyesGrp.position.set(0, 0.55, 0.62);
      addEyes(eyesGrp, 0, 0.12, 0.15, 0.09);
      this.model.add(eyesGrp);
    } else if (k === 'phage') {
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshToonMaterial({ color: base, emissive: new THREE.Color(base).multiplyScalar(0.25) }));
      head.position.y = 0.7;
      this.body = head;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6), toon('#cfd5e2'));
      collar.position.y = 0.3;
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6), toon('#cfd5e2'));
      tail.position.y = 0.08;
      this.model.add(head, collar, tail);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), toon('#cfd5e2'));
        leg.position.set(Math.cos(a) * 0.22, -0.2, Math.sin(a) * 0.22);
        leg.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
        this.model.add(leg);
      }
      addEyes(head, 0.05, 0.36, 0.12, 0.07);
    } else if (k === 'trooper') {
      this.buildTrooper();
    } else if (k === 'boss_superbug' || k === 'boss_medusa') {
      this.buildVirus();
    } else if (k === 'boss_herald') {
      this.buildTrooper();
      this.model.scale.setScalar(2.2); // the Herald: a towering cloaked figure
    } else if (k === 'machine' || k === 'boss_cyano') {
      this.buildMachine();
      if (k === 'boss_cyano') this.model.scale.setScalar(3.4); // the Cyano-Core: a towering syndicate machine
    } else if (k === 'tumor') {
      this.buildTumor();
    } else if (k === 'boss_golem') {
      this.buildGolem();
    } else if (k === 'gunner') {
      this.buildGunner();
    } else if (k === 'caster' || k === 'boss_spore') {
      this.buildSporeMage();
      if (k === 'boss_spore') this.model.scale.setScalar(3.2); // the matriarch: a towering spore mage
    } else if (k === 'boss_virus') {
      this.buildVirus();
    } else if (k === 'boss_chimera') {
      this.buildChimera();
    } else {
      // training dummy
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.8, 8), toon('#8a6243'));
      post.position.y = 0.9;
      const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.9, 10), toon('#d9c08a'));
      bodyM.position.y = 1.2;
      const target = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), toon('#e8553a'));
      target.rotation.x = Math.PI / 2;
      target.position.set(0, 1.25, 0.31);
      const headM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toon('#d9c08a'));
      headM.position.y = 1.85;
      this.body = bodyM;
      this.model.add(post, bodyM, target, headM);
    }
    addOutline(this.model, this.isBoss ? 0.06 : 0.025);
    this.model.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.isOutline) o.castShadow = true; });
  }

  // --- chapter 1 enemies (procedural until a .glb exists) ---
  private arms: THREE.Object3D[] = [];
  private glowParts: THREE.Mesh[] = [];

  private buildTrooper() {
    const cloak = toon('#5a4636'), fur = toon('#8a3a3a'), bone = toon('#efe6d6'), skin = toon('#4a3a4a');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.45, 6, 10), cloak);
    body.position.y = 0.75;
    this.body = body;
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.45, 8), skin);
    legs.position.y = 0.25;
    const mane = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.5, 8), fur);
    mane.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
    head.position.set(0, 1.32, 0.02);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), bone);
    mask.rotation.x = Math.PI / 2;
    mask.position.set(0, 1.33, 0.12);
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 5), bone);
      horn.position.set(sx * 0.2, 1.62, 0.05);
      horn.rotation.z = -sx * 0.4;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd070ff }));
      eye.position.set(sx * 0.1, 1.36, 0.4);
      eye.userData.noOutline = true;
      this.model.add(horn, eye);
    }
    // club arm
    const arm = new THREE.Group();
    arm.position.set(0.45, 0.95, 0);
    const club = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 6), toon('#8a6243'));
    club.position.set(0, -0.1, 0.35);
    club.rotation.x = Math.PI / 2.4;
    const knob = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), toon('#6a5a6a'));
    knob.position.set(0, 0.1, 0.75);
    arm.add(club, knob);
    this.arms.push(arm);
    this.model.add(legs, body, mane, head, mask, arm);
  }

  private buildMachine() {
    const metal = toon('#5a5f70'), dark = toon('#2e3240');
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.1), metal);
    box.position.y = 0.6;
    this.body = box;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 8, 16), new THREE.MeshToonMaterial({ color: 0xff5a2a, emissive: 0xff3a00, emissiveIntensity: 1 }));
    coil.position.set(0, 0.65, 0.58);
    this.glowParts.push(coil);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.8, 8), dark);
    chimney.position.set(0.35, 1.5, -0.2);
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 12), toon('#f4f4f4'));
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(-0.4, 0.95, 0.56);
    // Syndicate emblem: half a double helix
    const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12, Math.PI), toon('#7aff9a'));
    emblem.position.set(0.4, 0.95, 0.57);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), dark);
      leg.position.set(sx * 0.5, 0.05, sz * 0.4);
      this.model.add(leg);
    }
    this.model.add(box, coil, chimney, gauge, emblem);
  }

  private buildTumor() {
    const mat = new THREE.MeshToonMaterial({ color: 0x8a5ab0, emissive: 0xff3a5a, emissiveIntensity: 0.35 });
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mat);
    core.position.y = 0.6;
    this.body = core;
    this.glowParts.push(core);
    for (let i = 0; i < 5; i++) {
      const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 2) * 0.1, 0), mat);
      const a = i * 1.26;
      lump.position.set(Math.cos(a) * 0.45, 0.35 + (i % 3) * 0.25, Math.sin(a) * 0.45);
      this.model.add(lump);
    }
    const spike = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), toon('#ffcf6a'));
    spike.position.y = 1.15;
    spike.scale.y = 1.8;
    this.model.add(core, spike);
  }

  private buildGolem() {
    const rock = toon('#4a3658'), rock2 = toon('#5e4570');
    const gold = new THREE.MeshToonMaterial({ color: 0xffc85a, emissive: 0xff9a2a, emissiveIntensity: 0.5 });
    const hex = (r: number, hgt: number, m: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 6), m);
    // torso: a heap of hexagonal "cells" piled up without order
    const torso = new THREE.Group();
    torso.position.y = 3.6;
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const c = hex(0.55 + rnd() * 0.45, 0.8 + rnd() * 0.6, i % 2 ? rock : rock2);
      c.position.set((rnd() - 0.5) * 2.6, (rnd() - 0.5) * 2.4, (rnd() - 0.5) * 1.6);
      c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      torso.add(c);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 1), new THREE.MeshToonMaterial({ color: 0xff3a3a, emissive: 0xff1a1a, emissiveIntensity: 1.2 }));
    core.position.set(0, 0.2, 0.95);
    this.glowParts.push(core);
    torso.add(core);
    for (let i = 0; i < 9; i++) {
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1 + rnd(), 5), gold);
      cr.position.set((rnd() - 0.5) * 2.4, 1 + rnd() * 0.8, (rnd() - 0.6) * 1.4);
      cr.rotation.set((rnd() - 0.5) * 0.9, 0, (rnd() - 0.5) * 0.9);
      torso.add(cr);
    }
    this.body = core;
    const head = hex(0.6, 0.9, rock2);
    head.position.set(0, 5.6, 0.2);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
      eye.position.set(sx * 0.22, 5.65, 0.72);
      eye.userData.noOutline = true;
      this.model.add(eye);
      const arm = new THREE.Group();
      arm.position.set(sx * 1.9, 4.6, 0);
      for (let k = 0; k < 3; k++) {
        const seg = hex(0.45 - k * 0.04, 0.9, k % 2 ? rock : rock2);
        seg.position.set(sx * 0.15 * k, -0.6 - k * 0.85, 0);
        arm.add(seg);
      }
      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), rock2);
      fist.position.set(sx * 0.4, -3.2, 0.1);
      arm.add(fist);
      this.arms.push(arm);
      const leg = hex(0.6, 2.2, rock);
      leg.position.set(sx * 0.9, 1.1, 0);
      this.model.add(arm, leg);
    }
    this.model.add(torso, head);
  }

  private buildGunner() {
    const coat = toon('#2a2e3a'), skin = toon('#e8d0c0'), metal = toon('#8a90a0');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 6, 10), coat);
    body.position.y = 0.9;
    this.body = body;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
    head.position.y = 1.55;
    const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 12), new THREE.MeshToonMaterial({ color: 0x7aff9a, emissive: 0x3aff6a, emissiveIntensity: 0.8 }));
    goggles.position.set(0, 1.6, 0.12);
    this.glowParts.push(goggles);
    const arm = new THREE.Group();
    arm.position.set(0.32, 1.15, 0.1);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.7, 8), metal);
    gun.rotation.x = Math.PI / 2;
    gun.position.z = 0.35;
    const vial = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 6), glow('#7aff9a', 1.4));
    vial.position.set(0, 0.12, 0.2);
    vial.userData.noOutline = true;
    arm.add(gun, vial);
    this.arms.push(arm);
    this.model.add(body, head, goggles, arm);
  }

  private buildSporeMage() {
    const robe = toon('#e8efe0'), cap = new THREE.MeshToonMaterial({ color: 0x4aa898, emissive: 0x1a6a5a, emissiveIntensity: 0.3 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 10), robe);
    body.position.y = 0.55;
    this.body = body;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.9, 12), cap);
    hat.position.y = 1.35;
    hat.rotation.z = 0.25;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 14), cap);
    brim.position.y = 1.0;
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), toon('#bff0e0'));
      const a = i * 1.05;
      dot.position.set(Math.cos(a) * 0.38, 1.3 + (i % 2) * 0.18, Math.sin(a) * 0.38);
      this.model.add(dot);
    }
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd8ff8a }));
      eye.position.set(s * 0.12, 0.92, 0.42);
      eye.userData.noOutline = true;
      this.model.add(eye);
    }
    const arm = new THREE.Group();
    arm.position.set(0.45, 0.8, 0.1);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6), toon('#8a6243'));
    staff.position.y = 0.2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow('#d8ffb0', 1.3));
    puff.position.y = 1.0;
    puff.userData.noOutline = true;
    arm.add(staff, puff);
    this.arms.push(arm);
    this.glowParts.push(hat);
    this.model.add(body, hat, brim, arm);
  }

  private virusCore: THREE.Object3D | null = null;
  private buildVirus() {
    const g = new THREE.Group();
    g.position.y = 3.2;
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshToonMaterial({ color: 0x7ae0b0, transparent: true, opacity: 0.55, emissive: 0x2a8a6a, emissiveIntensity: 0.4, depthWrite: false }));
    shell.userData.noOutline = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.22, 0)), new THREE.LineBasicMaterial({ color: 0xd8fff0 }));
    this.body = shell;
    // coiled genome inside
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push(new THREE.Vector3(Math.cos(t * 18) * (0.9 - t * 0.4), (t - 0.5) * 2.2, Math.sin(t * 18) * (0.9 - t * 0.4))); }
    const genome = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.08, 6), glow('#ffe88a', 1.6));
    genome.userData.noOutline = true;
    this.glowParts.push(shell);
    // protein spike crowns on the 12 vertices
    const ico = new THREE.IcosahedronGeometry(2.2, 0);
    const p = ico.attributes.position as THREE.BufferAttribute;
    const seen: THREE.Vector3[] = [];
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      if (seen.some((s) => s.distanceTo(v) < 0.1)) continue;
      seen.push(v);
      const spike = new THREE.Group();
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), toon('#cfe6d8'));
      stalk.position.y = 0.45;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toon('#9fe8a0'));
      knob.position.y = 0.95;
      spike.add(stalk, knob);
      spike.position.copy(v);
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      g.add(spike);
    }
    g.add(shell, edges, genome);
    this.virusCore = g;
    this.model.add(g);
  }

  private chimeraMats: THREE.MeshToonMaterial[] = [];
  private buildChimera() {
    const fur = new THREE.MeshToonMaterial({ color: 0xbfe6f4 }), dark = toon('#3a4a6a'), mane = new THREE.MeshToonMaterial({ color: 0x7ad0f0, emissive: 0x2a8ad0, emissiveIntensity: 0.5 });
    this.chimeraMats.push(fur, mane);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.4, 8, 14), fur);
    torso.rotation.x = Math.PI / 2;
    torso.position.y = 2.1;
    this.body = torso;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), fur);
    head.position.set(0, 2.9, 2);
    const maneM = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), mane);
    maneM.position.set(0, 2.9, 1.75);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff4a6a }));
      eye.position.set(sx * 0.3, 3.05, 2.75);
      eye.userData.noOutline = true;
      // bird wing
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.bezierCurveTo(1.2 * sx, 0.8, 2.6 * sx, 0.6, 3.2 * sx, -0.2);
      shape.bezierCurveTo(2.2 * sx, -0.3, 1 * sx, -0.4, 0, 0);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshToonMaterial({ color: 0xe0f4ff, side: THREE.DoubleSide }));
      const wingG = new THREE.Group();
      wingG.add(wing);
      wingG.position.set(sx * 0.6, 3, 0.2);
      wingG.rotation.x = -0.3;
      this.arms.push(wingG);
      for (const fz of [1.2, -1.2]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 1.6, 8), dark);
        leg.position.set(sx * 0.7, 0.8, fz);
        this.model.add(leg);
      }
      this.model.add(eye, wingG);
    }
    // fish tail: the stitched-on part that gives it away
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 8), new THREE.MeshToonMaterial({ color: 0x4ac0a0 }));
    tail.rotation.x = -Math.PI / 2 - 0.3;
    tail.position.set(0, 2.4, -2.6);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.5, 3), new THREE.MeshToonMaterial({ color: 0x4ac0a0 }));
    fin.position.set(0, 2.9, -3.7);
    fin.rotation.z = Math.PI / 2;
    // stitches
    for (let i = 0; i < 6; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), toon('#2a2e3a'));
      st.position.set(-0.5 + i * 0.2, 2.1 + Math.sin(i) * 0.1, -1.6);
      st.rotation.z = 0.6;
      this.model.add(st);
    }
    this.glowParts.push(maneM);
    this.model.add(torso, head, maneM, tail, fin);
  }

  /** Change permanent element (used by gene splicing). */
  setElement(el: Element) {
    if (this.permanentElement) this.res[this.permanentElement] = 0.1;
    this.permanentElement = el;
    this.res[el] = 10;
    this.aura = { element: el, units: 1, decay: 0.02 };
    const c = new THREE.Color(ELEMENT_COLOR[el]);
    for (const m of this.chimeraMats) { m.color.lerp(c, 0.6); if (m.emissive) m.emissive.copy(c).multiplyScalar(0.4); }
    if (this.def.kind !== 'boss_chimera') {
      this.model.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
        if (m && (o as THREE.Mesh).isMesh && m.transparent && m.emissive) { m.color.set(c); m.emissive.copy(c).multiplyScalar(0.18); }
      });
    }
  }

  setShieldVisual(on: boolean) {
    if (on && !this.shieldMesh) {
      this.shieldMesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(this.radius * 1.6, 2),
        new THREE.MeshBasicMaterial({ color: 0xc58bff, transparent: true, opacity: 0.28, wireframe: false, depthWrite: false }),
      );
      this.shieldMesh.position.y = this.height * 0.5;
      this.root.add(this.shieldMesh);
    }
    if (this.shieldMesh) this.shieldMesh.visible = on;
  }

  /** world point used for damage numbers / bars */
  topPoint(out: THREE.Vector3) {
    return out.copy(this.pos).setY(this.pos.y + this.height + 0.35);
  }
  center(out: THREE.Vector3) {
    return out.copy(this.pos).setY(this.pos.y + this.height * 0.5);
  }

  knockback(dir: THREE.Vector3, force: number) {
    if (this.isBoss || this.def.kind === 'dummy') return;
    this.vel.x += dir.x * force;
    this.vel.z += dir.z * force;
  }

  update(dt: number, ctx: EnemyCtx) {
    this.bobT += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.resDownT > 0) this.resDownT -= dt;
    if (this.exposedT > 0) this.exposedT -= dt;
    if (this.shieldMesh?.visible) this.shieldMesh.rotation.y += dt;

    if (!this.alive) {
      this.deadT += dt;
      this.modelAnim?.(dt);
      // rigged models play their death clip first, then sink away; procedural bodies squash flat
      const t = Math.max(0, this.deadT - this.deathHold);
      if (this.rigged) this.model.position.y = -t * 2.5;
      else { const s = Math.max(0.01, 1 - t * 2.5); this.model.scale.set(1 + t, s, 1 + t); }
      return;
    }
    if (this.def.kind === 'dummy') {
      this.model.rotation.z = Math.sin(this.bobT * 10) * 0.08 * Math.max(0, this.hitFlash * 3);
      this.pos.y = ctx.groundY(this.pos.x, this.pos.z);
      this.root.position.copy(this.pos);
      return;
    }

    // re-apply own element (elemental slimes)
    if (this.permanentElement && !this.aura) {
      this.reapplyT += dt;
      if (this.reapplyT > 3) { this.reapplyT = 0; this.aura = { element: this.permanentElement, units: 1, decay: 0.02 }; }
    }

    const toP = new THREE.Vector3().subVectors(ctx.playerPos, this.pos);
    toP.y = 0;
    const dist = toP.length();
    if (!this.aggro && ctx.playerAlive && dist < (this.isBoss ? 26 : 14)) this.aggro = true;
    if (this.aggro && (!ctx.playerAlive || dist > 40) && !this.isBoss) { this.aggro = false; this.state = 'idle'; }

    // knockback friction
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));

    const frozen = this.frozen > 0;
    if (frozen || this.shieldActive) {
      this.groundSnap(ctx);
      return;
    }

    if (this.def.kind === 'machine' || this.def.kind === 'tumor') {
      this.updateStatic(dt, ctx, dist);
      this.groundSnap(ctx);
      this.animate(dt);
      return;
    }
    if (this.def.kind === 'gunner') {
      this.updateGunner(dt, ctx, toP, dist);
      this.groundSnap(ctx);
      this.animate(dt);
      return;
    }
    if (this.def.kind === 'caster') {
      this.updateCaster(dt, ctx, toP, dist);
      this.groundSnap(ctx);
      this.animate(dt);
      return;
    }
    if (this.def.kind === 'boss_virus' || this.def.kind === 'boss_spore' || this.def.kind === 'boss_cyano' || this.def.kind === 'boss_superbug' || this.def.kind === 'boss_medusa') {
      this.updateVirus(dt, ctx, toP, dist);
      this.groundSnap(ctx);
      this.animate(dt);
      return;
    }
    if (this.def.kind === 'boss_chimera' || this.def.kind === 'boss_herald') {
      this.updateChimera(dt, ctx, toP, dist);
      this.groundSnap(ctx);
      this.animate(dt);
      return;
    }
    if (this.def.kind === 'boss_golem') {
      this.updateGolem(dt, ctx, toP, dist);
      this.groundSnap(ctx);
      this.animate(dt);
      return;
    }

    // binary fission timer
    if (this.aggro && (this.def.kind === 'coccus' || this.def.kind === 'bacillus') && this.generation < 2) {
      this.splitT += dt;
      if (this.splitT > 20) {
        this.splitT = 0;
        ctx.requestSplit(this);
      }
    }

    if (this.isBoss) {
      this.summonT -= dt;
      if (this.summonT <= 0) { this.summonT = 16; ctx.requestSummon(this); }
    }

    this.attackCd -= dt * this.speedMul;
    this.stateT += dt;
    const speed = this.def.speed * this.speedMul;

    if (this.def.kind === 'phage') {
      this.updatePhage(dt, ctx, toP, dist);
      return;
    }

    switch (this.state) {
      case 'idle': {
        // gentle wander around home
        const toHome = new THREE.Vector3().subVectors(this.home, this.pos).setY(0);
        if (toHome.length() > 3) this.moveDir(toHome.normalize(), speed * 0.4, dt);
        if (this.aggro) { this.state = 'chase'; this.stateT = 0; }
        break;
      }
      case 'chase': {
        const reach = this.isBoss ? 9 : this.def.kind === 'bacillus' ? 7 : this.def.kind === 'trooper' ? 1.9 : 1.7;
        if (dist > reach) {
          this.moveDir(toP.clone().normalize(), speed, dt);
        } else if (this.attackCd <= 0) {
          this.state = 'windup';
          this.stateT = 0;
        }
        this.faceDir(toP, dt);
        break;
      }
      case 'windup': {
        const wind = this.isBoss ? 0.3 : this.def.kind === 'bacillus' || this.def.kind === 'trooper' ? 0.6 : 0.5;
        this.faceDir(toP, dt);
        if (this.stateT >= wind) {
          this.state = 'attack';
          this.stateT = 0;
          if (this.isBoss) {
            // telegraphed slam at player's position
            const target = ctx.playerPos.clone();
            ctx.telegraph(target, 4.2, 1.2, () => {
              const d = Math.hypot(ctx.playerPos.x - target.x, ctx.playerPos.z - target.z);
              if (d < 4.2) ctx.damagePlayer(this.atk * 1.6, this);
            });
          } else if (this.def.kind === 'bacillus') {
            const dir = toP.clone().normalize();
            this.vel.set(dir.x * 13, 0, dir.z * 13);
          } else {
            const dir = toP.clone().normalize();
            this.vel.set(dir.x * 7, 0, dir.z * 7);
          }
        }
        break;
      }
      case 'attack': {
        const dur = this.isBoss ? 1.4 : 0.45;
        if (!this.isBoss && dist < this.radius + 0.9 && this.stateT < 0.4 && this.stateT > 0.05 && !this.userDataHit) {
          this.userDataHit = true;
          ctx.damagePlayer(this.atk, this);
        }
        if (this.stateT >= dur) {
          this.state = 'recover';
          this.stateT = 0;
          this.userDataHit = false;
          this.attackCd = this.isBoss ? 2.2 : 1.6 + Math.random();
        }
        break;
      }
      case 'recover':
        if (this.stateT > 0.5) { this.state = 'chase'; this.stateT = 0; }
        break;
    }

    // separation from other enemies
    for (const o of ctx.others) {
      if (o === this || !o.alive || o.def.kind === 'phage') continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz), min = this.radius + o.radius;
      if (d < min && d > 1e-3) {
        const push = (min - d) * 0.5;
        this.pos.x += (dx / d) * push;
        this.pos.z += (dz / d) * push;
      }
    }
    this.groundSnap(ctx);
    this.animate(dt);
  }
  private userDataHit = false;
  private reapplyT = 0;
  private lifeT = 0;
  private pulseT = 2;
  private metaT = 8;

  /** Heater machines (pulse heat around them) and tumors (ripen after 15 s). */
  private updateStatic(dt: number, ctx: EnemyCtx, dist: number) {
    if (this.def.kind === 'tumor') {
      this.lifeT += dt;
      if (this.lifeT > 15) { this.lifeT = -999; ctx.onTumorRipe(this); }
      return;
    }
    this.pulseT -= dt;
    if (this.pulseT <= 0 && (this.aggro || dist < 16)) {
      this.pulseT = 4.5;
      const at = this.pos.clone();
      ctx.telegraph(at, 4, 1.2, () => {
        if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 4) ctx.damagePlayer(this.atk * 0.8, this);
      });
    }
  }

  private spliceT = 8;

  /** Syndicate researcher: keeps its distance, fires gene-gun shots and splices the elements of its allies. */
  private updateGunner(dt: number, ctx: EnemyCtx, toP: THREE.Vector3, dist: number) {
    this.attackCd -= dt * this.speedMul;
    this.stateT += dt;
    this.faceDir(toP, dt);
    if (!this.aggro) return;
    this.spliceT -= dt;
    if (this.spliceT <= 0) { this.spliceT = 12; ctx.requestSplice(this); }
    if (this.state === 'windup') {
      if (this.stateT > 0.8) {
        this.state = 'recover'; this.stateT = 0; this.attackCd = 2.2 + Math.random();
        const at = ctx.playerPos.clone();
        ctx.telegraph(at, 1.8, 0.9, () => {
          if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 1.8) ctx.damagePlayer(this.atk * 0.9, this);
        });
      }
      return;
    }
    const sp = this.def.speed * this.speedMul;
    if (dist < 6) this.moveDir(toP.clone().normalize().negate(), sp, dt);
    else if (dist > 11) this.moveDir(toP.clone().normalize(), sp, dt);
    else this.moveDir(new THREE.Vector3(-toP.z, 0, toP.x).normalize(), sp * 0.4, dt);
    if (this.attackCd <= 0 && dist < 14) { this.state = 'windup'; this.stateT = 0; }
  }

  /** Spore Mage (fungus): keeps its distance and plants lingering spore clouds under the player. */
  private updateCaster(dt: number, ctx: EnemyCtx, toP: THREE.Vector3, dist: number) {
    this.attackCd -= dt * this.speedMul;
    this.stateT += dt;
    this.faceDir(toP, dt);
    if (!this.aggro) return;
    if (this.state === 'windup') {
      if (this.stateT > 0.9) {
        this.state = 'recover'; this.stateT = 0; this.attackCd = 3.2 + Math.random();
        const at = ctx.playerPos.clone();
        // a cloud that bursts three times
        for (let k = 0; k < 3; k++) {
          ctx.telegraph(at, 2.4, 0.9 + k * 0.9, () => {
            if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 2.4) ctx.damagePlayer(this.atk * 0.45, this);
          });
        }
      }
      return;
    }
    const sp = this.def.speed * this.speedMul;
    if (dist < 7) this.moveDir(toP.clone().normalize().negate(), sp, dt);
    else if (dist > 12) this.moveDir(toP.clone().normalize(), sp, dt);
    if (this.attackCd <= 0 && dist < 15) { this.state = 'windup'; this.stateT = 0; }
  }

  private virusT = 0;
  /** Viral Tempest: drifts around the arena, rains protein spikes, gusts, and releases copies of itself (phages). */
  private updateVirus(dt: number, ctx: EnemyCtx, toP: THREE.Vector3, dist: number) {
    const phase = this.shieldsDone;
    const mul = (phase >= 2 ? 1.3 : 1) * this.speedMul;
    this.virusT += dt;
    this.attackCd -= dt * mul;
    this.summonT -= dt;
    if (this.summonT <= 0) { this.summonT = phase >= 1 ? 14 : 20; ctx.requestSummon(this); }
    // orbit slowly around home, leaning towards the player
    const orbit = new THREE.Vector3(Math.cos(this.virusT * 0.25) * 7, 0, Math.sin(this.virusT * 0.25) * 7).add(this.home);
    const want = orbit.lerp(ctx.playerPos, 0.25).sub(this.pos).setY(0);
    if (want.length() > 0.5) this.moveDir(want.normalize(), this.def.speed * mul, dt);
    this.faceDir(toP, dt);
    if (!this.aggro || this.attackCd > 0) return;
    this.attackCd = phase >= 2 ? 2.4 : 3.2;
    this.attackPulse++;
    const pattern = Math.floor(this.virusT * 7) % 3;
    if (pattern === 0 || phase === 0) {
      // spike rain around the player
      for (let i = 0; i < 5 + phase * 2; i++) {
        const a = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 2 + Math.random() * 7;
        const at = ctx.playerPos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        ctx.telegraph(at, 1.8, 1.1 + i * 0.08, () => {
          if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 1.8) ctx.damagePlayer(this.atk * 0.8, this);
        });
      }
    } else {
      // a ring of wind blasts around itself
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const at = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0, Math.sin(a) * 5));
        ctx.telegraph(at, 2.4, 1.2, () => {
          if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 2.4) ctx.damagePlayer(this.atk * 1.0, this);
        });
      }
    }
    void dist;
  }

  private chimeraPhase = 0;
  /** Chimera Beast: pounces and breathes a line of frost; every shield it splices in a new element (Cryo → Pyro → Hydro). */
  private updateChimera(dt: number, ctx: EnemyCtx, toP: THREE.Vector3, dist: number) {
    if (this.shieldsDone !== this.chimeraPhase) {
      this.chimeraPhase = this.shieldsDone;
      // the Chimera splices in Cryo → Pyro → Hydro; the Herald cycles through stolen elements, one per shield
      const seq: Element[] = this.def.kind === 'boss_herald' ? ['ANEMO', 'PYRO', 'ELECTRO', 'DENDRO'] : ['CRYO', 'PYRO', 'HYDRO'];
      this.setElement(seq[Math.min(seq.length - 1, this.chimeraPhase)]);
    }
    const mul = (this.chimeraPhase >= 2 ? 1.25 : 1) * this.speedMul;
    this.attackCd -= dt * mul;
    this.stateT += dt;
    this.summonT -= dt;
    if (this.summonT <= 0) { this.summonT = 24; ctx.requestSummon(this); }
    if (this.state === 'windup') {
      this.faceDir(toP, dt);
      if (this.stateT > 0.6 / mul) {
        this.state = 'attack'; this.stateT = 0;
        if (dist > 7 || Math.random() < 0.5) {
          // pounce onto where the player stands
          const at = ctx.playerPos.clone();
          this.pounceTo = at;
          ctx.telegraph(at, 3.4, 0.9, () => {
            if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 3.4) ctx.damagePlayer(this.atk * 1.5, this);
          });
        } else {
          // breath: a line of blasts towards the player
          const dir = toP.clone().normalize();
          for (let i = 1; i <= 4; i++) {
            const at = this.pos.clone().addScaledVector(dir, 2.5 + i * 2.6);
            ctx.telegraph(at, 2, 0.8 + i * 0.12, () => {
              if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 2) ctx.damagePlayer(this.atk * 0.8, this);
            });
          }
        }
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.pounceTo) {
        const to = this.pounceTo.clone().sub(this.pos).setY(0);
        const step = Math.min(to.length(), dt * 16);
        if (to.length() > 0.3) this.pos.addScaledVector(to.normalize(), step); else this.pounceTo = null;
      }
      if (this.stateT > 1.2) { this.state = 'chase'; this.stateT = 0; this.attackCd = 2; this.pounceTo = null; }
      return;
    }
    this.faceDir(toP, dt);
    if (this.aggro) {
      if (dist > 4) this.moveDir(toP.clone().normalize(), this.def.speed * mul, dt);
      if (this.attackCd <= 0 && dist < 16) { this.state = 'windup'; this.stateT = 0; }
    }
  }
  private pounceTo: THREE.Vector3 | null = null;

  /** Carcinoma Golem: slam up close, hurl crystals from afar; after shield 1 it scatters metastasis shards, after shield 2 it speeds up. */
  private updateGolem(dt: number, ctx: EnemyCtx, toP: THREE.Vector3, dist: number) {
    const phase = this.shieldsDone; // 0, 1, 2
    const mul = (phase >= 2 ? 1.3 : 1) * this.speedMul;
    this.attackCd -= dt * mul;
    this.stateT += dt;
    this.summonT -= dt;
    if (this.summonT <= 0) { this.summonT = phase >= 2 ? 18 : 30; ctx.requestSummon(this); }
    if (phase >= 1) {
      this.metaT -= dt * mul;
      if (this.metaT <= 0) {
        this.metaT = 11;
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 9;
          const at = ctx.playerPos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
          if (i === 0) at.copy(ctx.playerPos);
          ctx.telegraph(at, 2.2, 2.0, () => {
            if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < 2.2) ctx.damagePlayer(this.atk * 0.9, this);
          });
        }
      }
    }
    this.faceDir(toP, dt);
    if (this.state === 'windup') {
      if (this.stateT > 0.45 / mul) {
        this.state = 'attack';
        this.stateT = 0;
        const far = dist > 10;
        const at = ctx.playerPos.clone();
        const r = far ? 2.6 : 4.8;
        ctx.telegraph(at, r, far ? 1.3 : 1.1, () => {
          if (Math.hypot(ctx.playerPos.x - at.x, ctx.playerPos.z - at.z) < r) ctx.damagePlayer(this.atk * (far ? 1.2 : 1.7), this);
        });
      }
      return;
    }
    if (this.state === 'attack') {
      if (this.stateT > 1.3) { this.state = 'chase'; this.stateT = 0; this.attackCd = 2.4; }
      return;
    }
    if (this.aggro) {
      if (dist > 5) this.moveDir(toP.clone().normalize(), this.def.speed * mul, dt);
      if (this.attackCd <= 0 && dist < 18) { this.state = 'windup'; this.stateT = 0; }
    }
  }

  private updatePhage(dt: number, ctx: EnemyCtx, toP: THREE.Vector3, dist: number) {
    if (this.state === 'latched' && this.latchHost) {
      const h = this.latchHost;
      if (!h.alive) { this.state = 'chase'; this.latchHost = null; }
      else {
        this.pos.copy(h.pos).setY(h.pos.y + h.height + 0.3);
        this.latchT += dt;
        this.root.position.copy(this.pos);
        this.model.rotation.y += dt * 4;
        if (this.latchT > 4) { ctx.onPhageLyse(this, h); this.state = 'chase'; this.latchHost = null; this.latchT = 0; }
        return;
      }
    }
    // look for a bacterial host nearby (lytic cycle)
    if (this.state !== 'latched' && Math.random() < dt * 0.4) {
      const host = ctx.others.find((o) => o.alive && o.isBacteria && !o.isBoss && o.pos.distanceTo(this.pos) < 9 && !ctx.others.some((p) => p.latchHost === o));
      if (host) { this.latchHost = host; this.state = 'latched'; this.latchT = 0; return; }
    }
    const targetY = ctx.groundY(this.pos.x, this.pos.z) + 2.4 + Math.sin(this.bobT * 2) * 0.3;
    if (this.aggro) {
      if (this.state === 'windup') {
        if (this.stateT > 0.7) {
          this.state = 'attack'; this.stateT = 0;
          const dir = new THREE.Vector3().subVectors(ctx.playerPos, this.pos).normalize();
          this.vel.copy(dir).multiplyScalar(14);
        }
      } else if (this.state === 'attack') {
        this.pos.addScaledVector(this.vel, dt);
        if (this.pos.distanceTo(ctx.playerPos.clone().setY(ctx.playerPos.y + 1)) < 1.2 && !this.userDataHit) {
          this.userDataHit = true;
          ctx.damagePlayer(this.atk, this);
        }
        if (this.stateT > 0.4) { this.state = 'recover'; this.stateT = 0; this.userDataHit = false; this.attackCd = 2 + Math.random(); this.vel.set(0, 0, 0); }
      } else {
        const want = dist > 5 ? speedTo(toP, this.def.speed) : orbit(toP, this.def.speed);
        this.pos.x += want.x * dt;
        this.pos.z += want.z * dt;
        if (dist < 7 && this.attackCd <= 0) { this.state = 'windup'; this.stateT = 0; }
        if (this.state === 'recover' && this.stateT > 0.6) this.state = 'chase';
      }
      this.faceDir(toP, dt);
    }
    if (this.state !== 'attack') this.pos.y += (targetY - this.pos.y) * Math.min(1, dt * 3);
    this.root.position.copy(this.pos);
    this.model.rotation.z = Math.sin(this.bobT * 3) * 0.15;
  }

  private moveDir(dir: THREE.Vector3, speed: number, dt: number) {
    if (this.def.kind === 'coccus' || this.def.kind === 'boss_king') {
      // hop motion: move during the airborne half of a hop
      const hop = Math.sin(this.bobT * (this.isBoss ? 3 : 6));
      if (hop < 0) return;
      speed *= 1.8;
    }
    this.pos.x += dir.x * speed * dt;
    this.pos.z += dir.z * speed * dt;
  }

  private faceDir(d: THREE.Vector3, dt: number) {
    const target = Math.atan2(d.x, d.z);
    let diff = target - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * 6);
  }

  private groundSnap(ctx: EnemyCtx) {
    this.pos.y = ctx.groundY(this.pos.x, this.pos.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  private animate(dt: number) {
    const k = this.def.kind;
    if (this.rigged) { this.modelAnim?.(dt); this.model.position.x = this.hitFlash > 0 ? Math.sin(this.bobT * 80) * 0.04 : 0; return; }
    if (k === 'coccus' || k === 'boss_king') {
      const f = this.isBoss ? 3 : 6;
      const hop = Math.max(0, Math.sin(this.bobT * f));
      const moving = this.state === 'chase' || (this.state === 'idle' && this.vel.lengthSq() > 0.1);
      const squash = this.state === 'windup' ? 0.75 : 1;
      this.model.position.y = moving ? hop * (this.isBoss ? 0.8 : 0.5) : 0;
      this.model.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    } else if (k === 'bacillus') {
      if (this.tail) this.tail.rotation.y = Math.sin(this.bobT * 14) * 0.5;
      this.model.scale.setScalar(this.state === 'windup' ? 0.9 + Math.sin(this.bobT * 40) * 0.05 : 1);
    } else if (k === 'gunner') {
      this.model.position.y = this.state === 'windup' ? 0 : Math.abs(Math.sin(this.bobT * 6)) * 0.03;
      for (const a of this.arms) a.rotation.x += ((this.state === 'windup' ? -0.3 : 0.4) - a.rotation.x) * Math.min(1, dt * 10);
    } else if (k === 'caster' || k === 'boss_spore') {
      this.model.position.y = Math.sin(this.bobT * 2) * 0.05;
      for (const a of this.arms) a.rotation.x += ((this.state === 'windup' ? -1.4 : 0) - a.rotation.x) * Math.min(1, dt * 8);
    } else if (k === 'boss_virus') {
      if (this.virusCore) {
        this.virusCore.rotation.y += dt * 0.6;
        this.virusCore.rotation.x += dt * 0.25;
        this.virusCore.position.y = 3.2 + Math.sin(this.bobT * 1.4) * 0.4;
      }
      for (const g of this.glowParts) (g.material as THREE.MeshToonMaterial).emissiveIntensity = 0.3 + Math.sin(this.bobT * 3) * 0.2;
    } else if (k === 'boss_chimera') {
      const flap = Math.sin(this.bobT * (this.state === 'attack' ? 14 : 4)) * 0.5;
      this.arms.forEach((w, i) => { w.rotation.z = (i === 0 ? 1 : -1) * flap; });
      this.model.position.y = this.state === 'attack' && this.pounceTo ? 1.2 : Math.abs(Math.sin(this.bobT * 4)) * 0.1;
      for (const g of this.glowParts) (g.material as THREE.MeshToonMaterial).emissiveIntensity = 0.5 + Math.sin(this.bobT * 3) * 0.3;
    } else if (k === 'trooper' || k === 'boss_golem') {
      const walking = this.state === 'chase' || this.state === 'idle';
      const sw = walking ? Math.sin(this.bobT * (k === 'trooper' ? 10 : 3)) : 0;
      this.model.position.y = Math.abs(sw) * (k === 'trooper' ? 0.06 : 0.12);
      const swing = this.state === 'windup' ? -2.2 : this.state === 'attack' && this.stateT < 0.25 ? 0.9 : sw * 0.4;
      this.arms.forEach((a, i) => { a.rotation.x += ((i === 0 || k === 'boss_golem' ? swing : -sw * 0.4) - a.rotation.x) * Math.min(1, dt * 12); });
    } else if (k === 'machine' || k === 'tumor') {
      const t = k === 'machine' ? Math.max(0, 1 - this.pulseT / 4.5) : Math.min(1, Math.max(0, this.lifeT) / 15);
      for (const g of this.glowParts) (g.material as THREE.MeshToonMaterial).emissiveIntensity = 0.3 + t * 1.4;
      if (k === 'tumor') this.model.scale.setScalar(0.8 + t * 0.5 + Math.sin(this.bobT * 6) * 0.03);
    }
    if (k === 'boss_golem') for (const g of this.glowParts) (g.material as THREE.MeshToonMaterial).emissiveIntensity = 1 + Math.sin(this.bobT * 4) * 0.4;
    if (this.hitFlash > 0) this.model.position.x = Math.sin(this.bobT * 80) * 0.05;
    else this.model.position.x = 0;
    this.modelAnim?.(dt);
  }
}

function speedTo(d: THREE.Vector3, s: number) { return d.clone().normalize().multiplyScalar(s); }
function orbit(d: THREE.Vector3, s: number) { return new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(s * 0.6); }

export function enemyGlowMaterial(color: string) { return glow(color, 1.4); }
