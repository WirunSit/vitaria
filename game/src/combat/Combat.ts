import * as THREE from 'three';
import type { Element } from '../core/types';
import { ELEMENT_COLOR } from '../core/types';
import { data } from '../core/Data';
import { bus } from '../core/EventBus';
import { sfx } from '../core/Audio';
import { Enemy, type EnemyCtx } from '../enemies/Enemy';
import { talentBonus, type PartyMember } from '../player/Party';
import { applyElement, decayAura, emAmp, emTransform, levelBase, REACTION_INFO, type ReactionId, type ReactionResult } from './Elements';
import { Blast, RingPulse, Telegraph, Timed, orbMesh, type Effect } from './Effects';
import { glow } from '../world/Materials';
import * as GE from '../gear/GearEffects';
import { attachEnemyModel } from '../models/EnemyModels';

const MELEE_WEAPONS = new Set(['SWORD', 'CLAYMORE', 'POLEARM']);

/** Beyond this distance (m) from the player an enemy is neither updated nor drawn. */
const ENEMY_SLEEP_DIST = 140;

export interface HitParams {
  member: PartyMember;
  mult: number;               // talent multiplier (1.0 = 100%)
  element: Element;
  units?: number;             // gauge units, default 1
  icd?: string | null;        // ICD group key; null = no ICD (always applies)
  heavy?: boolean;
  scaling?: 'atk' | 'hp' | 'def';
  dmgBonus?: number;          // extra additive % (0.2 = +20%)
  particles?: { count: number; castId: number };
  kb?: number;                // knockback force
  from?: THREE.Vector3;
  forceCrit?: boolean;
  critBonusFn?: (e: Enemy) => number;
  dmgBonusFn?: (e: Enemy) => number;
  onHit?: (e: Enemy) => void;
  kind?: 'normal' | 'charged';
}

export interface CombatHooks {
  damageNumber: (pos: THREE.Vector3, text: string, color: string, kind: 'normal' | 'crit' | 'reaction' | 'heal' | 'info') => void;
  reactionFirst: (r: ReactionId) => void;
  enemyKilled: (e: Enemy) => void;
  bossShield: (e: Enemy) => void;
  playerDamaged: (amount: number) => void;
  phageLysed: (host: Enemy) => void;
  firstSplit: () => void;
  shieldGained: (el: Element) => void;
  /** a boss tumor ripened (boss healed) */
  tumorRipe?: (boss: Enemy) => void;
  /** impact effect on a landed hit; `melee` hits also get a short hit-stop */
  impact?: (at: THREE.Vector3, color: string, strong: boolean, melee: boolean) => void;
}

interface Particle { mesh: THREE.Mesh; element: Element | null; t: number; vel: THREE.Vector3 }
interface Shard { mesh: THREE.Mesh; element: Element; t: number }
interface Remains { obj: THREE.Object3D; t: number; enemyId: string; codexId: string; tags: string[] }

const tmpV = new THREE.Vector3();

export class Combat {
  enemies: Enemy[] = [];
  effects: Effect[] = [];
  particles: Particle[] = [];
  shards: Shard[] = [];
  remains: Remains[] = [];
  private icd = new Map<string, { n: number; t: number }>();
  private particleCasts = new Set<number>();
  private castCounter = 1;
  private time = 0;
  private alviA1Cd = 0;
  private chlorenC6 = -10;
  private hemaC6 = -999;
  private splitAnnounced = false;
  /** Shield on the party (shared, Genshin-like). */
  shield = { hp: 0, element: null as Element | null, t: 0 };

  // set by Game
  party: () => PartyMember[] = () => [];
  active: () => PartyMember | null = () => null;
  playerPos = new THREE.Vector3();
  playerInvuln = () => false;
  groundY: (x: number, z: number) => number = () => 0;

  constructor(private scene: THREE.Scene, private hooks: CombatHooks) {}

  newCast() { return this.castCounter++; }

  addEffect(e: Effect) {
    this.effects.push(e);
    this.scene.add(e.obj);
  }

  spawn(enemyId: string, pos: THREE.Vector3, level: number, variant: Element | null = null, questTag: string | null = null): Enemy | null {
    const def = data.enemies.get(enemyId);
    if (!def) { console.warn('unknown enemy', enemyId); return null; }
    const p = pos.clone();
    p.y = this.groundY(p.x, p.z);
    const e = new Enemy(def, level, p, variant);
    e.questTag = questTag;
    attachEnemyModel(e);
    this.enemies.push(e);
    this.scene.add(e.root);
    return e;
  }

  clearQuestEnemies(tag: string) {
    for (const e of this.enemies) if (e.questTag === tag && e.alive) { e.alive = false; e.deadT = 0.39; }
  }

  // ------------------------------------------------------------------ queries
  enemiesInRadius(center: THREE.Vector3, r: number): Enemy[] {
    return this.enemies.filter((e) => e.alive && Math.hypot(e.pos.x - center.x, e.pos.z - center.z) < r + e.radius && Math.abs(e.pos.y + e.height * 0.5 - center.y) < r + e.height);
  }

  nearestEnemy(from: THREE.Vector3, maxDist = 30): Enemy | null {
    let best: Enemy | null = null, bd = maxDist;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.pos.distanceTo(from);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  hitArea(center: THREE.Vector3, r: number, p: HitParams) {
    const list = this.enemiesInRadius(center, r);
    for (const e of list) this.hit(e, { ...p, from: p.from ?? center });
    return list.length;
  }

  hitArc(origin: THREE.Vector3, yaw: number, range: number, halfAngle: number, p: HitParams) {
    let n = 0;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    for (const e of this.enemies) {
      if (!e.alive) continue;
      tmpV.subVectors(e.pos, origin).setY(0);
      const d = tmpV.length();
      if (d > range + e.radius) continue;
      if (Math.abs(e.pos.y - origin.y) > 3 + e.height) continue;
      if (d > e.radius + 0.3) {
        const ang = tmpV.normalize().angleTo(fwd);
        if (ang > halfAngle) continue;
      }
      this.hit(e, { ...p, from: origin });
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------------ core hit
  hit(e: Enemy, p: HitParams) {
    if (!e.alive) return;
    const m = p.member;
    const st = m.stats();
    const top = e.topPoint(new THREE.Vector3());

    if (e.shieldActive) {
      this.hooks.damageNumber(top, 'โล่ความรู้!', '#d7a5ff', 'info');
      return;
    }

    // ICD: element applies on 1st hit, then every 3rd hit or after 2.5s
    let applies = true;
    if (p.icd !== null && p.element !== 'PHYSICAL') {
      const key = `${e.uid}:${m.id}:${p.icd ?? 'default'}`;
      const rec = this.icd.get(key);
      if (!rec || this.time - rec.t >= 2.5) {
        this.icd.set(key, { n: 1, t: this.time });
      } else {
        applies = rec.n % 3 === 0;
        rec.n++;
      }
    }

    let reaction: ReactionResult = {};
    if (applies) reaction = applyElement(e, p.element, p.units ?? 1, p.heavy);

    const scale = p.scaling === 'hp' ? st.hp : p.scaling === 'def' ? st.def : st.atk;
    let dmg = scale * p.mult;
    if (reaction.flatCoef) dmg += levelBase(m.level) * reaction.flatCoef * (1 + (5 * st.bm) / (st.bm + 1200));
    const gm = GE.hitModifiers(m, p.kind, e);
    if (p.kind) gm.dmg += talentBonus(m.talent(0));
    let bonus = 1 + (p.dmgBonus ?? 0) + (p.dmgBonusFn?.(e) ?? 0) + m.buff('dmgBonus') + gm.dmg;
    if (p.element === m.element && p.element !== 'PHYSICAL') bonus += st.elemBonus;
    if (p.element === 'HYDRO') bonus += m.buff('hydroBonus');
    if (p.element === 'PYRO') bonus += m.buff('pyroBonus');
    if (p.element === 'PHYSICAL') bonus += st.physBonus;
    dmg *= bonus;
    const crit = p.forceCrit || Math.random() < st.critRate + (p.critBonusFn?.(e) ?? 0) + gm.crit;
    if (crit) dmg *= 1 + st.critDmg;
    dmg *= this.defMult(m.level, e.level);
    dmg *= this.resMult(e, p.element);
    if (reaction.amp) dmg *= reaction.amp * (1 + emAmp(st.bm));
    if (e.exposedT > 0) dmg *= 1.3;
    dmg = Math.max(1, Math.round(dmg));

    this.applyDamage(e, dmg);
    this.hooks.damageNumber(top, String(dmg), ELEMENT_COLOR[p.element], crit ? 'crit' : 'normal');
    const melee = (p.kind === 'normal' || p.kind === 'charged') && MELEE_WEAPONS.has(m.def.weapon);
    // impact on the enemy's surface, on the side facing the attacker (inside the body it would be hidden)
    const at = e.center(new THREE.Vector3());
    if (p.from) at.add(tmpV.subVectors(p.from, at).setY(0).normalize().multiplyScalar(e.radius * 0.9));
    this.hooks.impact?.(at, ELEMENT_COLOR[p.element], crit || (p.kb ?? 0) >= 4, melee);
    e.hitFlash = 0.15;
    if (!e.aggro) e.aggro = true;
    // fighting back: a regular enemy that is hit while not attacking sometimes counters almost at once
    if (!e.isBoss && e.state !== 'windup' && e.state !== 'attack' && e.attackCd > 0.5 && Math.random() < 0.35) e.attackCd = 0.3;
    if (p.kb && p.from) e.knockback(tmpV.subVectors(e.pos, p.from).setY(0).normalize(), p.kb);
    sfx.hit(p.element, crit, m.def.weapon, at); // body impact + element layer, at the target
    if (!e.isBoss && Math.random() < 0.25) sfx.enemyHurt(e.pos, e.isBacteria);
    if (m.id === 'NEUROS' && m.passives) m.addStacks(5);
    e.lastHitBy = m;
    GE.onHit(m, p.kind);
    p.onHit?.(e);

    if (p.particles && !this.particleCasts.has(p.particles.castId)) {
      this.particleCasts.add(p.particles.castId);
      this.spawnParticles(e.center(new THREE.Vector3()), m.element, p.particles.count);
    }

    if (reaction.reaction) this.resolveReaction(e, reaction, m, st.bm);
  }

  private defMult(charLv: number, enemyLv: number) {
    return (charLv + 100) / (charLv + 100 + (enemyLv + 100));
  }

  private resMult(e: Enemy, el: Element) {
    let r = e.res[el] ?? 0.1;
    if (el === 'PHYSICAL' && e.resDownT > 0) r -= 0.4;
    if (r < 0) return 1 - r / 2;
    if (r < 0.75) return 1 - r;
    return 1 / (4 * r + 1);
  }

  private applyDamage(e: Enemy, dmg: number) {
    if (e.def.kind === 'dummy') {
      e.hp = Math.max(1, e.hp - dmg);
      if (e.hp <= 1) e.hp = e.maxHp;
      return;
    }
    e.hp -= dmg;
    // boss knowledge-shield thresholds
    if (e.def.boss) {
      const th = e.def.boss.shields;
      if (e.shieldsDone < th.length && e.hp <= e.maxHp * th[e.shieldsDone]) {
        e.hp = Math.max(1, Math.round(e.maxHp * th[e.shieldsDone]));
        e.shieldsDone++;
        e.shieldActive = true;
        e.setShieldVisual(true);
        this.hooks.bossShield(e);
        return;
      }
    }
    if (e.hp <= 0) this.kill(e);
  }

  private resolveReaction(e: Enemy, r: ReactionResult, m: PartyMember, bm: number) {
    const id = r.reaction!;
    const info = REACTION_INFO[id];
    const top = e.topPoint(new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0));
    this.hooks.damageNumber(top, info.th, info.color, 'reaction');
    sfx.reaction();
    bus.emit('Reaction', { reaction: id });
    this.hooks.reactionFirst(id);
    GE.onReaction(m, id);
    const center = e.center(new THREE.Vector3());
    // gene-sequence hooks
    if (m.id === 'CHLOREN' && m.cons >= 6 && this.time - this.chlorenC6 > 1) { this.chlorenC6 = this.time; m.addEnergy(1); }
    if (m.id === 'NEUROS' && m.cons >= 4 && ['ELECTROLYTE', 'FEVER_SHOCK', 'SYNAPTIC_BLOCK', 'CATALYSIS', 'ENZYME_SURGE'].includes(id)) m.addStacks(10);

    const transformDmg = (target: Enemy, coef: number, el: Element) => {
      const d = Math.round(levelBase(m.level) * coef * (1 + emTransform(bm)) * this.resMult(target, el));
      this.applyDamage(target, d);
      target.hitFlash = 0.15;
      this.hooks.damageNumber(target.topPoint(new THREE.Vector3()).add(new THREE.Vector3(0.4, 0.2, 0)), String(d), ELEMENT_COLOR[el], 'normal');
    };

    if (r.transform) {
      const t = r.transform;
      const targets = t.aoe > 0 ? this.enemiesInRadius(center, t.aoe) : [e];
      for (const x of targets) transformDmg(x, t.coef, t.element);
      if (t.aoe > 0) this.addEffect(new Blast(center, t.aoe, ELEMENT_COLOR[t.element]));
      if (id === 'FEVER_SHOCK') for (const x of targets) x.knockback(tmpV.subVectors(x.pos, e.pos).setY(0).normalize(), 9);
    }
    if (id === 'DIFFUSION' && r.absorbed) {
      for (const x of this.enemiesInRadius(center, 5)) {
        if (x !== e) applyElement(x, r.absorbed, 1);
      }
      this.addEffect(new RingPulse(e.pos, 5, ELEMENT_COLOR[r.absorbed]));
      if (this.alviA1Cd <= 0 && this.party().some((p) => p.id === 'ALVI')) {
        this.alviA1Cd = 2;
        for (const p of this.party()) p.addEnergy(2);
      }
    }
    if (id === 'MEMBRANE_SHIELD' && r.absorbed) this.spawnShard(center, r.absorbed);
    if (r.resDown) e.resDownT = 12;
    if (r.burn) {
      e.burnT = 6;
      e.burnSource = { atk: 0, level: m.level, bm };
    }
    if (r.electrolyte) {
      e.electroTicks = 3;
      e.electroTickT = 0.2;
      e.electroSource = { level: m.level, bm };
    }
    if (r.seed) this.spawnSeed(center, m.level, bm);
  }

  kill(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    e.deadT = 0;
    e.setShieldVisual(false);
    sfx.enemyDie(e.pos, e.isBoss);
    bus.emit('EnemyDefeated', { enemyId: e.def.id, tags: e.def.tags });
    GE.onKill(e.lastHitBy, e);
    this.hooks.enemyKilled(e);
    if (e.isBacteria && !e.isBoss) {
      // scannable remains (used by the first quest)
      const obj = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshToonMaterial({ color: 0xa8dc7a, transparent: true, opacity: 0.6 }));
      obj.scale.set(1.4, 0.35, 1.4);
      obj.position.copy(e.pos).add(new THREE.Vector3(0, 0.1, 0));
      this.scene.add(obj);
      this.remains.push({ obj, t: 40, enemyId: e.def.id, codexId: e.def.codexId, tags: ['bacteria_remains', ...e.def.tags] });
    }
  }

  // ------------------------------------------------------------------ particles / shards / seeds
  spawnParticles(at: THREE.Vector3, el: Element | null, n: number) {
    for (let i = 0; i < n; i++) {
      const mesh = orbMesh(el ? ELEMENT_COLOR[el] : '#ffffff', 0.16);
      mesh.position.copy(at);
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ mesh, element: el, t: 0, vel: new THREE.Vector3(Math.cos(a) * 3, 4 + Math.random() * 2, Math.sin(a) * 3) });
    }
  }

  private spawnShard(at: THREE.Vector3, el: Element) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), glow(ELEMENT_COLOR[el], 1.5));
    mesh.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
    mesh.position.y = this.groundY(mesh.position.x, mesh.position.z) + 0.6;
    this.scene.add(mesh);
    this.shards.push({ mesh, element: el, t: 15 });
  }

  private spawnSeed(at: THREE.Vector3, level: number, bm: number) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), glow('#8be06a', 1.3));
    mesh.position.copy(at);
    mesh.position.y = this.groundY(at.x, at.z) + 0.4;
    const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), glow('#c6ff9a', 1.2));
    sprout.position.y = 0.4;
    mesh.add(sprout);
    this.addEffect(new Timed(mesh, 5, (_dt, t) => { mesh.scale.setScalar(1 + Math.sin(t * 8) * 0.06 + t * 0.05); }, () => {
      const c = mesh.position.clone();
      this.addEffect(new Blast(c, 4.5, '#8be06a'));
      for (const x of this.enemiesInRadius(c, 4.5)) {
        const d = Math.round(levelBase(level) * 2 * (1 + emTransform(bm)) * this.resMult(x, 'DENDRO'));
        this.applyDamage(x, d);
        this.hooks.damageNumber(x.topPoint(new THREE.Vector3()), String(d), ELEMENT_COLOR.DENDRO, 'normal');
      }
    }));
  }

  // ------------------------------------------------------------------ player damage
  damagePlayer(amount: number, from?: Enemy) {
    const m = this.active();
    if (!m || !m.alive) return;
    if (this.playerInvuln()) {
      this.hooks.damageNumber(this.playerPos.clone().setY(this.playerPos.y + 2), 'หลบ!', '#ffffff', 'info');
      return;
    }
    const st = m.stats();
    const lv = from?.level ?? 1;
    let dmg = amount * (1 - st.def / (st.def + 5 * lv + 500));
    dmg *= Math.max(0.1, 1 - m.buff('dr'));
    dmg = Math.max(1, Math.round(dmg));
    if (this.shield.hp > 0) {
      const absorb = this.shield.hp;
      const take = Math.min(absorb, dmg);
      this.shield.hp -= take;
      dmg -= take;
      if (this.shield.hp <= 0) this.shield.element = null;
    }
    if (dmg <= 0) return;
    m.hp = Math.max(0, m.hp - dmg);
    this.hooks.damageNumber(this.playerPos.clone().setY(this.playerPos.y + 2.1), String(dmg), '#ff6a5a', 'normal');
    // Hema C6 — emergency transfusion
    const hema = this.party().find((x) => x.id === 'HEMA' && x.cons >= 6 && x.alive);
    if (hema && m.alive && m.hp < st.hp * 0.25 && this.time - this.hemaC6 > 60) {
      this.hemaC6 = this.time;
      const healed = m.heal(st.hp * 0.3);
      this.hooks.damageNumber(this.playerPos.clone().setY(this.playerPos.y + 2.4), String(Math.round(healed)), '#9cf59a', 'heal');
    }
    this.hooks.playerDamaged(dmg);
    sfx.hurt();
  }

  giveShield(hp: number, el: Element | null, dur = 15) {
    hp *= GE.shieldMult(this.active());
    if (hp >= this.shield.hp) this.shield = { hp, element: el, t: dur };
    sfx.shield();
  }

  // ------------------------------------------------------------------ per-frame
  update(dt: number) {
    this.time += dt;
    if (this.alviA1Cd > 0) this.alviA1Cd -= dt;
    if (this.shield.t > 0) {
      this.shield.t -= dt;
      if (this.shield.t <= 0) this.shield.hp = 0;
    }

    const ctx: EnemyCtx = {
      playerPos: this.playerPos,
      playerAlive: !!this.active()?.alive,
      groundY: this.groundY,
      damagePlayer: (amt, from) => this.damagePlayer(amt, from),
      others: this.enemies,
      requestSplit: (e) => this.split(e),
      requestSummon: (boss) => this.summon(boss),
      telegraph: (pos, r, t, cb) => this.addEffect(new Telegraph(pos.clone().setY(this.groundY(pos.x, pos.z)), r, t, () => { cb(); this.addEffect(new Blast(pos, r, '#ff8a6a', 0.35)); })),
      onPhageLyse: (_phage, host) => this.lyse(host),
      onTumorRipe: (t) => this.tumorRipe(t),
      requestSplice: (from) => this.splice(from),
    };

    for (const e of this.enemies) {
      // far-away enemies sleep: no AI, no animation, not drawn (they wake as the player approaches)
      const asleep = e.alive && Math.hypot(e.pos.x - this.playerPos.x, e.pos.z - this.playerPos.z) > ENEMY_SLEEP_DIST;
      e.root.visible = !asleep;
      if (asleep) continue;
      if (e.alive) {
        decayAura(e, dt);
        this.tickDots(e, dt);
      }
      e.update(dt, ctx);
    }
    // remove fully dead
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.deadT > 0.4 + e.deathHold) {
        this.scene.remove(e.root);
        this.enemies.splice(i, 1);
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      if (!ef.update(dt)) {
        this.scene.remove(ef.obj);
        ef.dispose?.();
        this.effects.splice(i, 1);
      }
    }
    this.updateParticles(dt);
    this.updateShards(dt);
    for (let i = this.remains.length - 1; i >= 0; i--) {
      const r = this.remains[i];
      r.t -= dt;
      if (r.t <= 0) { this.scene.remove(r.obj); this.remains.splice(i, 1); }
    }
    if (this.icd.size > 500) this.icd.clear();
    if (this.particleCasts.size > 300) this.particleCasts.clear();
  }

  private tickDots(e: Enemy, dt: number) {
    if (e.burnT > 0 && e.burnSource) {
      e.burnT -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        const d = Math.round(levelBase(e.burnSource.level) * 0.5 * (1 + emTransform(e.burnSource.bm)) * this.resMult(e, 'PYRO'));
        this.applyDamage(e, d);
        this.hooks.damageNumber(e.topPoint(new THREE.Vector3()), String(d), ELEMENT_COLOR.PYRO, 'normal');
      }
    }
    if (e.electroTicks > 0 && e.electroSource) {
      e.electroTickT -= dt;
      if (e.electroTickT <= 0) {
        e.electroTickT = 1;
        e.electroTicks--;
        const src = e.electroSource;
        const targets = [e, ...this.enemiesInRadius(e.pos, 4).filter((x) => x !== e && x.aura?.element === 'HYDRO')];
        for (const x of targets) {
          const d = Math.round(levelBase(src.level) * 1.2 * (1 + emTransform(src.bm)) * this.resMult(x, 'ELECTRO'));
          this.applyDamage(x, d);
          this.hooks.damageNumber(x.topPoint(new THREE.Vector3()), String(d), ELEMENT_COLOR.ELECTRO, 'normal');
        }
      }
    }
  }

  private split(e: Enemy) {
    if (!e.alive || this.enemies.filter((x) => x.alive).length > 30) return;
    e.generation++;
    e.hp = Math.max(1, Math.round(e.hp * 0.6));
    const p = e.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
    const child = this.spawn(e.def.id, p, e.level, e.permanentElement, e.questTag);
    if (child) {
      child.generation = e.generation;
      child.hp = e.hp;
      child.aggro = true;
      child.state = 'chase';
    }
    this.addEffect(new RingPulse(e.pos, 2, '#c8ff9a'));
    if (!this.splitAnnounced) { this.splitAnnounced = true; this.hooks.firstSplit(); }
  }

  private tumorRipe(t: Enemy) {
    const boss = this.enemies.find((x) => x.alive && x.isBoss && x.questTag === t.questTag);
    t.alive = false; // bursts without loot
    t.deadT = 0;
    if (!boss) return;
    const heal = Math.round(boss.maxHp * 0.1);
    boss.hp = Math.min(boss.maxHp, boss.hp + heal);
    this.hooks.damageNumber(boss.topPoint(new THREE.Vector3()), `+${heal}`, '#9cf59a', 'heal');
    this.addEffect(new RingPulse(t.pos, 3, '#ff5a8a', 0.5));
    this.hooks.tumorRipe?.(boss);
  }

  /** Gene-gun: give up to 3 nearby allies a random new element. */
  private splice(from: Enemy) {
    const els: Element[] = ['PYRO', 'HYDRO', 'CRYO', 'ELECTRO'];
    const near = this.enemies.filter((e) => e.alive && e !== from && !e.isBoss && e.def.kind !== 'tumor' && e.pos.distanceTo(from.pos) < 12).slice(0, 3);
    for (const e of near) {
      const el = els[Math.floor(Math.random() * els.length)];
      e.setElement(el);
      this.addEffect(new RingPulse(e.pos, 1.4, ELEMENT_COLOR[el], 0.5));
    }
    if (near.length) this.hooks.damageNumber(from.topPoint(new THREE.Vector3()), 'ตัดต่อยีน!', '#7aff9a', 'info');
  }

  private summon(boss: Enemy) {
    if (boss.def.kind === 'boss_virus') {
      const minions = this.enemies.filter((x) => x.alive && !x.isBoss && x.questTag === boss.questTag).length;
      for (let i = minions; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4));
        const s = this.spawn('EN_PHAGE_S', p, Math.max(1, boss.level - 4), null, boss.questTag);
        if (s) s.aggro = true;
      }
      this.addEffect(new RingPulse(boss.pos, 7, '#9fffd0', 0.6));
      return;
    }
    if (boss.def.kind === 'boss_medusa' || boss.def.kind === 'boss_herald') {
      // the jellyfish drops charged polyps (phages); the Herald calls the Entropy Order's blight troopers
      const herald = boss.def.kind === 'boss_herald';
      const minions = this.enemies.filter((x) => x.alive && !x.isBoss && x.questTag === boss.questTag).length;
      for (let i = minions; i < (herald ? 2 : 3); i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0, Math.sin(a) * 5));
        const s = this.spawn(herald ? 'EN_BT_CLUB' : 'EN_PHAGE_S', p, Math.max(1, boss.level - 4), herald ? null : 'ELECTRO', boss.questTag);
        if (s) s.aggro = true;
      }
      this.addEffect(new RingPulse(boss.pos, 7, herald ? '#b06cff' : '#d8b8ff', 0.6));
      return;
    }
    if (boss.def.kind === 'boss_superbug') {
      // the resistant colony buds off bacteria
      const minions = this.enemies.filter((x) => x.alive && !x.isBoss && x.questTag === boss.questTag).length;
      for (let i = minions; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0, Math.sin(a) * 5));
        const s = this.spawn(i % 2 ? 'EN_BAC_BACIL' : 'EN_BAC_COCCI', p, Math.max(1, boss.level - 4), 'HYDRO', boss.questTag);
        if (s) { s.aggro = true; s.generation = 2; }
      }
      this.addEffect(new RingPulse(boss.pos, 7, '#9fe86a', 0.6));
      return;
    }
    if (boss.def.kind === 'boss_cyano') {
      // the core calls in syndicate gene-splicers
      const minions = this.enemies.filter((x) => x.alive && !x.isBoss && x.questTag === boss.questTag).length;
      for (let i = minions; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
        const s = this.spawn('EN_SYN_DOC', p, Math.max(1, boss.level - 4), null, boss.questTag);
        if (s) s.aggro = true;
      }
      this.addEffect(new RingPulse(boss.pos, 7, '#c8a0ff', 0.6));
      return;
    }
    if (boss.def.kind === 'boss_spore') {
      // the matriarch buds off spore mages
      const minions = this.enemies.filter((x) => x.alive && !x.isBoss && x.questTag === boss.questTag).length;
      for (let i = minions; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0, Math.sin(a) * 5));
        const s = this.spawn('EN_SPORE_MAGE', p, Math.max(1, boss.level - 4), 'DENDRO', boss.questTag);
        if (s) s.aggro = true;
      }
      this.addEffect(new RingPulse(boss.pos, 7, '#c8ff7a', 0.6));
      return;
    }
    if (boss.def.kind === 'boss_chimera') {
      const minions = this.enemies.filter((x) => x.alive && !x.isBoss && x.questTag === boss.questTag).length;
      for (let i = minions; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 6, 0, Math.sin(a) * 6));
        const s = this.spawn('EN_BAC_COCCI', p, Math.max(1, boss.level - 3), boss.permanentElement, boss.questTag);
        if (s) { s.aggro = true; s.generation = 2; }
      }
      this.addEffect(new RingPulse(boss.pos, 7, '#9fe3f0', 0.6));
      return;
    }
    if (boss.def.kind === 'boss_golem') {
      const tumors = this.enemies.filter((x) => x.alive && x.def.kind === 'tumor' && x.questTag === boss.questTag).length;
      for (let i = tumors; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7));
        const s = this.spawn('EN_TUMOR', p, boss.level, null, boss.questTag);
        if (s) s.aggro = true;
      }
      this.addEffect(new RingPulse(boss.pos, 8, '#ff5a8a', 0.7));
      return;
    }
    const alive = this.enemies.filter((x) => x.alive && x.questTag === boss.questTag && !x.isBoss).length;
    if (alive >= 4) return;
    const vars: (Element | null)[] = [null, 'HYDRO', 'PYRO'];
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = boss.pos.clone().add(new THREE.Vector3(Math.cos(a) * 5, 0, Math.sin(a) * 5));
      const s = this.spawn('EN_BAC_COCCI', p, Math.max(1, boss.level - 2), vars[Math.floor(Math.random() * 3)], boss.questTag);
      if (s) { s.aggro = true; s.generation = 2; }
    }
    this.addEffect(new RingPulse(boss.pos, 6, '#c8ff9a', 0.6));
  }

  private lyse(host: Enemy) {
    if (!host.alive) return;
    this.addEffect(new Blast(host.center(new THREE.Vector3()), 1.8, '#8fe0c8'));
    this.kill(host);
    this.hooks.phageLysed(host);
    const phages = this.enemies.filter((x) => x.alive && x.def.kind === 'phage').length;
    if (phages < 7) {
      for (let i = 0; i < 2; i++) {
        const s = this.spawn('EN_PHAGE_S', host.pos.clone().add(new THREE.Vector3(i - 0.5, 1.5, 0)), host.level, null, host.questTag);
        if (s) s.aggro = true;
      }
    }
  }

  private updateParticles(dt: number) {
    const target = this.playerPos.clone().setY(this.playerPos.y + 1);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t < 0.6) {
        p.vel.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        const gy = this.groundY(p.mesh.position.x, p.mesh.position.z) + 0.3;
        if (p.mesh.position.y < gy) { p.mesh.position.y = gy; p.vel.y = Math.abs(p.vel.y) * 0.3; }
      } else {
        const dir = target.clone().sub(p.mesh.position);
        const d = dir.length();
        p.mesh.position.addScaledVector(dir.normalize(), Math.min(d, dt * (12 + p.t * 20)));
        if (d < 0.5) {
          this.collectParticle(p.element);
          this.scene.remove(p.mesh);
          this.particles.splice(i, 1);
        }
      }
    }
  }

  private collectParticle(el: Element | null) {
    const act = this.active();
    for (const m of this.party()) {
      const base = el === null ? 2 : el === m.element ? 3 : 1;
      m.addEnergy(base * (m === act ? 1 : 0.6));
    }
  }

  private updateShards(dt: number) {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.t -= dt;
      s.mesh.rotation.y += dt * 2;
      const d = s.mesh.position.distanceTo(this.playerPos.clone().setY(this.playerPos.y + 0.6));
      if (d < 1.6) {
        const m = this.active();
        const lv = m?.level ?? 1;
        this.giveShield(Math.round(levelBase(lv) * 6 * (1 + emTransform(m?.stats().bm ?? 0))), s.element, 15);
        this.hooks.shieldGained(s.element);
        this.scene.remove(s.mesh);
        this.shards.splice(i, 1);
        continue;
      }
      if (s.t <= 0) { this.scene.remove(s.mesh); this.shards.splice(i, 1); }
    }
  }

  dispose() {
    for (const e of this.enemies) this.scene.remove(e.root);
    for (const ef of this.effects) this.scene.remove(ef.obj);
    for (const p of this.particles) this.scene.remove(p.mesh);
    for (const s of this.shards) this.scene.remove(s.mesh);
    for (const r of this.remains) this.scene.remove(r.obj);
    this.enemies = []; this.effects = []; this.particles = []; this.shards = []; this.remains = [];
  }
}
