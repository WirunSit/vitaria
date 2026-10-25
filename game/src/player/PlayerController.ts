import * as THREE from 'three';
import type { Input } from '../core/Input';
import { data } from '../core/Data';
import { bus } from '../core/EventBus';
import { sfx } from '../core/Audio';
import type { World } from '../world/World';
import { WATER_LEVEL, isWater } from '../world/Terrain';
import type { Combat } from '../combat/Combat';
import { KITS, doNormal, comboLength, type KitCtx } from '../combat/Skills';
import { AmoebyModel, type AnimState, type CharModel } from './CharacterModel';
import { createCharacterModel } from '../models/CharacterModels';
import { charArtName } from '../core/Assets';
import type { PartyMember } from './Party';

const GRAVITY = -24;
const RUN = 6.2;
const SPRINT = 9.5;
const DASH = 15;

export class PlayerController {
  pos = new THREE.Vector3();
  velY = 0;
  onGround = true;
  yaw = 0;
  camYaw = Math.PI;
  camPitch = 0.2; // lower default angle shows more horizon and sky
  camDist = 6.2;
  stamina = 120;
  maxStamina = 120;
  private staminaIdle = 0;
  gliding = false;
  private dashT = 0;
  iframeT = 0;
  private attackT = -1;
  private attackDur = 0.4;
  private attackHitDone = false;
  private attackKind: AnimState['attackKind'] = 'normal';
  private combo = 0;
  private swingIdx = 0;
  private swingLast = false;
  private comboWindow = 0;
  private holdT = 0;
  private switchCd = 0;
  private sprinting = false;
  moveSpeed = 0;
  models = new Map<string, CharModel>();
  amoeby = new AmoebyModel();
  amoebyVisible = true;
  /**
   * Genshin-style companion presence: she vanishes (sparkle poof) while you keep exploring or fight, and pops back
   * when you stop for a moment, when she has something to say / a dialogue is open, or now and then on her own
   * to keep you company for a few seconds.
   */
  companionInCombat = false;
  private comp = { shown: 1, target: 1, moveT: 0, idleT: 0, hiddenT: 0, hold: 0, visitT: 0, nextHide: 12, nextVisit: 35 };
  private sparkles: { pts: THREE.Points; t: number; base: Float32Array }[] = [];
  /** keep the companion out for `sec` seconds (she talks, a dialogue opens, a story beat) */
  companionCue(sec = 8) { this.comp.hold = Math.max(this.comp.hold, sec); }
  activeIndex = 0;
  gliderUnlocked = false;
  inWater = false;
  canControl = true;
  isDay = () => true;
  private amoebyPos = new THREE.Vector3();
  private amoebyYaw = 0;

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private combat: Combat,
    public party: PartyMember[],
    private gender: 'M' | 'F',
  ) {
    scene.add(this.amoeby.root);
    this.rebuildModels();
  }

  get active(): PartyMember { return this.party[this.activeIndex]; }

  rebuildModels() {
    for (const m of this.models.values()) this.scene.remove(m.root);
    this.models.clear();
    for (const p of this.party) {
      const def = p.def;
      const app = def.id === 'SEEKER' && this.gender === 'F' && def.appearanceF ? def.appearanceF : def.appearance;
      const model = createCharacterModel(`characters/CHR_${charArtName(def.id, this.gender)}.vrm`, app, def.element, def.weapon, def.id);
      model.root.visible = false;
      this.scene.add(model.root);
      this.models.set(p.id, model);
    }
    if (this.activeIndex >= this.party.length) this.activeIndex = 0;
    this.showActive();
  }

  private showActive() {
    for (const [id, m] of this.models) m.root.visible = id === this.active.id;
  }

  setParty(party: PartyMember[], activeIndex = 0) {
    this.party = party;
    this.activeIndex = Math.min(activeIndex, party.length - 1);
    this.rebuildModels();
  }

  teleport(p: THREE.Vector3) {
    this.pos.copy(p);
    this.pos.y = this.world.groundH(p.x, p.z);
    this.velY = 0;
    this.gliding = false;
    this.amoebyPos.copy(this.pos).add(new THREE.Vector3(1, 2, 0));
  }

  switchTo(i: number): boolean {
    if (i === this.activeIndex || i >= this.party.length) return false;
    if (!this.party[i].alive || this.switchCd > 0) return false;
    this.activeIndex = i;
    this.switchCd = 1;
    this.attackT = -1;
    this.combo = 0;
    this.showActive();
    bus.emit('PartyChanged', {});
    this.onSwitchIn?.(this.active);
    sfx.ui();
    return true;
  }

  forward(): THREE.Vector3 { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  private kitCtx(): KitCtx {
    const model = this.models.get(this.active.id)!;
    const member = this.active;
    return {
      combat: this.combat,
      world: this.world,
      member: this.active,
      party: this.party,
      pos: this.pos,
      yaw: this.yaw,
      castPoint: () => model.castPoint(new THREE.Vector3()),
      isDay: this.isDay(),
      healActive: (amt) => {
        const healer = member; // the caster of the healing skill
        const healed = this.active.heal(amt * (1 + healer.stats().healBonus));
        if (healed > 0) { this.onHeal?.(healed); this.onHealBy?.(healer, healed); }
      },
      dash: (distance, duration, dir) => {
        const d = (dir ?? this.forward()).clone().setY(0).normalize();
        this.yaw = Math.atan2(d.x, d.z);
        this.skillDash = { t: duration, speed: distance / duration, dir: d };
        this.iframeT = Math.max(this.iframeT, duration + 0.1);
      },
      activeMember: () => this.active,
    };
  }
  onHeal?: (n: number) => void;
  onHealBy?: (healer: PartyMember, n: number) => void;
  onSwitchIn?: (m: PartyMember) => void;
  private skillDash: { t: number; speed: number; dir: THREE.Vector3 } | null = null;

  private faceTarget() {
    // turn toward camera forward, or nearest enemy roughly in front
    const camF = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const tgt = this.combat.nearestEnemy(this.pos, 10);
    if (tgt) {
      const d = tgt.pos.clone().sub(this.pos).setY(0);
      if (d.length() < 10) { this.yaw = Math.atan2(d.x, d.z); return; }
    }
    this.yaw = Math.atan2(camF.x, camF.z);
  }

  update(dt: number, input: Input, camera: THREE.PerspectiveCamera, sens = 1) {
    const m = this.active;
    for (const p of this.party) p.update(dt);
    if (this.switchCd > 0) this.switchCd -= dt;
    if (this.iframeT > 0) this.iframeT -= dt;
    if (this.comboWindow > 0) this.comboWindow -= dt; else this.combo = 0;

    // ----- camera look
    if (input.mouseDX || input.mouseDY) {
      this.camYaw -= input.mouseDX * 0.0024 * sens;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + input.mouseDY * 0.0022 * sens, -0.6, 1.25);
    }
    if (input.wheel) this.camDist = THREE.MathUtils.clamp(this.camDist + input.wheel * 0.8, 2.5, 12);

    const ctl = this.canControl && m.alive;

    // ----- party switching
    if (ctl) for (let i = 0; i < 4; i++) if (input.pressed(`Digit${i + 1}`)) this.switchTo(i);

    // ----- movement input
    const mv = new THREE.Vector3();
    if (ctl) {
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) mv.z -= 1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) mv.z += 1;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mv.x -= 1;
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) mv.x += 1;
    }
    const moving = mv.lengthSq() > 0;
    if (moving) {
      mv.normalize();
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      mv.set(mv.x * cos + mv.z * sin, 0, -mv.x * sin + mv.z * cos);
    }

    // dash / sprint
    const shiftPressed = input.pressed('ShiftLeft') || input.pressed('ShiftRight') || input.pressed('Mouse2');
    const shiftDown = input.isDown('ShiftLeft') || input.isDown('ShiftRight') || input.isDown('Mouse2');
    if (ctl && shiftPressed && this.onGround && this.dashT <= 0 && this.stamina >= 18) {
      this.stamina -= 18;
      this.staminaIdle = 0;
      this.dashT = 0.32;
      this.iframeT = 0.32;
      sfx.dodge();
      this.attackT = -1;
      if (moving) this.yaw = Math.atan2(mv.x, mv.z);
    }
    this.sprinting = ctl && shiftDown && moving && this.onGround && this.dashT <= 0 && this.stamina > 0;

    this.inWater = isWater(this.pos.x, this.pos.z, this.pos.y);
    let speed = 0;
    let dir = mv;
    if (this.skillDash) {
      this.skillDash.t -= dt;
      speed = this.skillDash.speed;
      dir = this.skillDash.dir;
      if (this.skillDash.t <= 0) this.skillDash = null;
    } else if (this.dashT > 0) {
      this.dashT -= dt;
      speed = DASH;
      dir = this.forward();
    } else if (moving) {
      speed = this.gliding ? 7.5 : this.sprinting ? SPRINT : RUN;
      if (this.inWater) speed *= 0.55;
      if (this.attackT >= 0) speed *= 0.25;
    }
    const skillDashing = !!this.skillDash;
    if (this.sprinting) { this.stamina -= 18 * dt; this.staminaIdle = 0; }

    // facing
    if ((moving || this.dashT > 0) && this.attackT < 0) {
      const target = Math.atan2(dir.x, dir.z);
      let diff = target - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 14);
    }

    // horizontal move with slope limit
    if (speed > 0) {
      const nx = this.pos.x + dir.x * speed * dt;
      const nz = this.pos.z + dir.z * speed * dt;
      const h0 = this.world.groundH(this.pos.x, this.pos.z);
      const h1 = this.world.groundH(nx, nz);
      const step = Math.hypot(nx - this.pos.x, nz - this.pos.z);
      const tooSteep = this.onGround && !skillDashing && step > 0 && (h1 - h0) / step > 1.35;
      if (!tooSteep) { this.pos.x = nx; this.pos.z = nz; }
    }

    // jump / glide
    if (ctl && input.pressed('Space')) {
      if (this.onGround && this.attackT < 0) {
        this.velY = 8.6;
        this.onGround = false;
        sfx.jump();
      } else if (!this.onGround && this.gliderUnlocked && this.stamina > 5) {
        const ground = this.world.groundH(this.pos.x, this.pos.z);
        if (this.gliding) this.gliding = false;
        else if (this.pos.y - ground > 1.6 || this.world.updraftAt(this.pos.x, this.pos.z, this.pos.y) > 0) this.gliding = true;
      }
    }
    if (this.gliding) {
      const lift = this.world.updraftAt(this.pos.x, this.pos.z, this.pos.y);
      this.velY = lift > 0 ? Math.min(lift, this.velY + 18 * dt) : -2.4;
      this.stamina -= 4 * dt;
      this.staminaIdle = 0;
      if (this.stamina <= 0) this.gliding = false;
    } else {
      this.velY += GRAVITY * dt;
    }
    this.pos.y += this.velY * dt;
    const gh = this.world.groundH(this.pos.x, this.pos.z);
    if (this.pos.y <= gh) {
      if (!this.onGround && this.velY < -16) this.onLand?.(-this.velY);
      if (!this.onGround && this.velY < -4) sfx.land(-this.velY);
      this.pos.y = gh;
      this.velY = 0;
      this.onGround = true;
      this.gliding = false;
    } else if (this.pos.y > gh + 0.05) {
      this.onGround = false;
    }
    this.world.resolve(this.pos, 0.42);

    // stamina regen
    this.staminaIdle += dt;
    if (this.staminaIdle > 1 && this.onGround && !this.sprinting) this.stamina = Math.min(this.maxStamina, this.stamina + 28 * dt);
    this.stamina = Math.max(0, this.stamina);

    // ----- combat input
    const kit = KITS[m.id];
    if (ctl && kit && !this.gliding) {
      if (input.isDown('Mouse0')) this.holdT += dt;
      if (input.pressed('Mouse0') && this.dashT <= 0) {
        if (this.attackT < 0 || this.attackT > this.attackDur * 0.7) this.startNormal();
      }
      if (input.released('Mouse0')) {
        if (this.holdT >= 0.45 && this.stamina >= kit.chargedStamina) {
          this.stamina -= kit.chargedStamina;
          this.staminaIdle = 0;
          this.faceTarget();
          this.attackT = 0;
          this.attackDur = 0.5;
          this.attackKind = 'charged';
          this.attackHitDone = true;
          kit.charged(this.kitCtx());
        }
        this.holdT = 0;
      }
      if (input.pressed('KeyE') && m.cdE <= 0) {
        this.faceTarget();
        m.cdE = kit.skill(this.kitCtx());
        this.attackT = 0;
        this.attackDur = 0.45;
        this.attackKind = 'skill';
        this.attackHitDone = true;
        bus.emit('SkillUsed', { charId: m.id, kind: 'E' });
      }
      if (input.pressed('KeyQ') && m.burstReady) {
        this.faceTarget();
        m.energy = 0;
        m.cdQ = 15;
        kit.burst(this.kitCtx());
        this.attackT = 0;
        this.attackDur = 0.8;
        this.attackKind = 'burst';
        this.attackHitDone = true;
        this.iframeT = Math.max(this.iframeT, 0.8);
        bus.emit('SkillUsed', { charId: m.id, kind: 'Q' });
      }
    }

    if (this.attackT >= 0) {
      this.attackT += dt;
      // melee swings carry the body forward a little (Genshin feel), stopping short of the target
      if (this.attackKind === 'normal' && this.attackT < this.attackDur * 0.45 && KITS[m.id]?.normalStyle === 'melee') {
        const tgt = this.combat.nearestEnemy(this.pos, 4);
        if (!tgt || tgt.pos.distanceTo(this.pos) > 1.7 + tgt.radius) {
          this.pos.addScaledVector(this.forward(), dt * (m.def.weapon === 'CLAYMORE' ? 1.6 : 2.6));
          this.world.resolve(this.pos, 0.42);
        }
      }
      if (!this.attackHitDone && this.attackT >= this.attackDur * 0.35) {
        this.attackHitDone = true;
        doNormal(this.kitCtx(), this.combo);
        this.combo = (this.combo + 1) % comboLength(m.id);
        this.comboWindow = this.attackDur + 0.6;
      }
      if (this.attackT >= this.attackDur) this.attackT = -1;
    }

    // ----- animate model
    this.moveSpeed = speed > 0 && this.dashT <= 0 ? speed / RUN : 0;
    const model = this.models.get(m.id);
    if (model) {
      model.root.position.copy(this.pos);
      model.root.rotation.y = this.yaw;
      model.setWeapon?.(m.weaponInst()?.id ?? null);
      model.update(dt, {
        speed: this.moveSpeed,
        air: !this.onGround,
        glide: this.gliding,
        attackT: this.attackT >= 0 ? Math.min(1, this.attackT / this.attackDur) : -1,
        attackKind: this.attackKind,
        dashing: this.dashT > 0,
        swing: this.swingIdx,
        swingLast: this.swingLast,
      });
      model.root.visible = m.alive;
    }

    // Amoeby follows behind the right shoulder
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const want = this.pos.clone().addScaledVector(right, 1.1).add(new THREE.Vector3(0, 2.1 + Math.sin(performance.now() / 500) * 0.12, 0)).addScaledVector(this.forward(), -0.6);
    this.updateCompanionPresence(dt, want);
    this.amoebyPos.lerp(want, Math.min(1, dt * 4));
    this.amoeby.root.position.copy(this.amoebyPos);
    // face where we're going while travelling (a slight lean into the flight); turn to look at the player only when
    // standing still or when she has something to say — like the real companion
    const travelling = this.moveSpeed > 0.3 && this.comp.hold <= 0;
    const fwd = this.forward();
    const faceYaw = travelling ? Math.atan2(fwd.x, fwd.z) : Math.atan2(camera.position.x - this.amoebyPos.x, camera.position.z - this.amoebyPos.z);
    let dYaw = faceYaw - this.amoebyYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    this.amoebyYaw += dYaw * Math.min(1, dt * (travelling ? 5 : 3));
    this.amoeby.root.rotation.set(0, this.amoebyYaw, 0);
    this.amoeby.root.rotateX((travelling ? 0.18 : 0) * Math.min(1, this.moveSpeed));
    // pop in with a little overshoot, shrink away when leaving
    const k = this.comp.shown, pop = k <= 0 ? 0 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
    this.amoeby.root.scale.setScalar(Math.max(0.001, this.comp.target ? pop : k * k));
    this.amoeby.root.visible = this.amoebyVisible && k > 0.01;
    if (this.amoeby.root.visible) this.amoeby.update(dt);
    this.updateSparkles(dt);

    this.updateCamera(dt, camera);
  }
  onLand?: (v: number) => void;

  private updateCompanionPresence(dt: number, want: THREE.Vector3) {
    const c = this.comp;
    const moving = this.moveSpeed > 0.3 || !this.onGround || this.gliding;
    c.hold = Math.max(0, c.hold - dt);
    if (moving) { c.moveT += dt; c.idleT = 0; } else { c.idleT += dt; c.moveT = 0; }
    let target = c.target;
    if (c.hold > 0) target = 1;
    else if (this.companionInCombat) target = 0;
    else if (c.idleT > 2.5) target = 1;
    else if (c.target === 1) {
      if (c.visitT > 0) c.visitT -= dt; // dropping in for a moment, then off again
      else if (c.moveT > c.nextHide) target = 0;
    } else {
      c.hiddenT += dt;
      if (moving && c.hiddenT > c.nextVisit) { target = 1; c.visitT = 8 + Math.random() * 4; }
    }
    if (target !== c.target) {
      c.target = target;
      if (target === 0) { c.hiddenT = 0; c.nextVisit = 25 + Math.random() * 25; c.nextHide = 10 + Math.random() * 10; }
      else { c.moveT = 0; if (c.shown < 0.05) this.amoebyPos.copy(want); } // reappear right beside the player
      if (this.amoebyVisible) this.sparkle(target === 1 ? want : this.amoebyPos);
    }
    c.shown += Math.sign(c.target - c.shown) * Math.min(Math.abs(c.target - c.shown), dt / 0.35);
  }

  /** a small burst of golden stars where the companion appears / vanishes */
  private sparkle(at: THREE.Vector3) {
    const n = 18, base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      base.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1b0, size: 0.14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.position.copy(at);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.sparkles.push({ pts, t: 0, base });
  }

  private updateSparkles(dt: number) {
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.t += dt;
      const k = s.t / 0.7, r = 0.15 + Math.sqrt(k) * 0.9;
      const p = s.pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let j = 0; j < p.count; j++) p.setXYZ(j, s.base[j * 3] * r, s.base[j * 3 + 1] * r + k * 0.3, s.base[j * 3 + 2] * r);
      p.needsUpdate = true;
      (s.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.scene.remove(s.pts); s.pts.geometry.dispose(); (s.pts.material as THREE.Material).dispose(); this.sparkles.splice(i, 1); }
    }
  }

  private startNormal() {
    this.faceTarget();
    this.attackT = 0;
    this.attackHitDone = false;
    this.attackKind = 'normal';
    this.swingIdx = this.combo;
    this.swingLast = this.combo === comboLength(this.active.id) - 1;
    const style = KITS[this.active.id]?.normalStyle;
    const w = this.active.def.weapon;
    const meleeDur = w === 'CLAYMORE' ? 0.62 : w === 'POLEARM' ? 0.4 : 0.38;
    this.attackDur = style === 'melee' ? (this.combo === comboLength(this.active.id) - 1 ? meleeDur + 0.12 : meleeDur) : style === 'arrow' ? 0.36 : 0.42;
  }

  updateCamera(dt: number, camera: THREE.PerspectiveCamera, overShoulder = false) {
    const target = this.pos.clone().add(new THREE.Vector3(0, 1.55, 0));
    let dist = overShoulder ? 2.2 : this.camDist;
    const dir = new THREE.Vector3(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch),
    );
    if (overShoulder) target.add(new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).multiplyScalar(0.6));
    // pull in if terrain or a building blocks (big colliders only — trees don't count)
    const walls = this.world.colliders.filter((c) => c.r >= 1.2 && Math.hypot(c.x - target.x, c.z - target.z) < dist + c.r + 1);
    for (let d = 1; d <= dist; d += 0.5) {
      const p = target.clone().addScaledVector(dir, d);
      const gy = this.world.groundH(p.x, p.z);
      if (p.y < gy + 0.3) { dist = Math.max(1.2, d - 0.5); break; }
      if (p.y < gy + 9 && walls.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.3)) { dist = Math.max(1.2, d - 0.6); break; }
    }
    const camPos = target.clone().addScaledVector(dir, dist);
    let minY = this.world.groundH(camPos.x, camPos.z) + 0.35;
    if (isWater(camPos.x, camPos.z, minY)) minY = WATER_LEVEL + 0.4; // keep the camera above the lake surface
    if (camPos.y < minY) camPos.y = minY;
    camera.position.lerp(camPos, overShoulder ? 1 : Math.min(1, dt * 20));
    camera.lookAt(target);
  }

  /** Direction the camera looks (for scanner raycasts). */
  cameraForward(camera: THREE.Camera) {
    return camera.getWorldDirection(new THREE.Vector3());
  }

  get charDefs() { return data.characters; }
}
