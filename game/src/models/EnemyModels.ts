import * as THREE from 'three';
import { ELEMENT_COLOR } from '../core/types';
import type { Enemy } from '../enemies/Enemy';
import { addOutline } from '../world/Materials';
import { fitToHeight, hasModel, loadGLBAnimated, toonify } from './ModelLibrary';

/**
 * If a .glb exists for this enemy (assets/models/enemies/<model>.glb), replace the procedural body with it.
 * The Enemy class keeps animating `e.model` (hop/squash/flash) as before; on top of that, `e.modelAnim` drives
 * the downloaded model: its own clips when it is rigged (walk/attack), otherwise a body motion that suits the kind.
 */
export function attachEnemyModel(e: Enemy) {
  let name = e.def.model;
  if (!name) return;
  // every other phage uses the second drone model so a swarm doesn't look cloned
  if (e.def.kind === 'phage' && e.uid % 2 === 0 && hasModel(`enemies/${name}_B.glb`)) name = `${name}_B`;
  const file = `enemies/${name}.glb`;
  if (!hasModel(file)) return;
  loadGLBAnimated(file).then((res) => {
    if (!res || !e.alive) return;
    const { obj, clips } = res;
    const holder = new THREE.Group();
    holder.add(obj);
    toonify(obj, e.permanentElement ? ELEMENT_COLOR[e.permanentElement] : undefined, 0.5);
    // some downloads bake their own outline as a solid black unlit shell; ours replaces it (and theirs can cover the body)
    obj.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if ((o as THREE.Mesh).isMesh && m?.isMeshBasicMaterial && !m.map && m.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.06) o.visible = false;
    });
    // measure in the pose the model will actually show: some rigs scale their root bone in every clip
    const pose = clips.find((c) => usable(c) && /idle|idel|iddle|wait/i.test(c.name)) ?? clips.find(usable);
    if (pose) { const m = new THREE.AnimationMixer(obj); m.clipAction(pose).play(); m.update(0.01); m.stopAllAction(); }
    fitToHeight(obj, e.isBoss ? e.height + 0.2 : e.def.kind === 'phage' ? 1.2 : e.height + 0.05);
    if (e.def.kind === 'phage') holder.position.y = 0.2;
    holder.rotation.y = e.def.modelYaw ?? 0;
    if (e.def.modelFlip) {
      holder.rotation.x = Math.PI; // upside-down download: turn it over, keep it standing on y = 0
      holder.updateMatrixWorld(true);
      holder.position.y -= new THREE.Box3().setFromObject(holder).min.y;
    }
    holder.position.y += e.def.modelLift ?? 0;
    let tris = 0;
    obj.traverse((o) => { const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null; if (g) tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
    if (tris <= 20000) addOutline(holder, e.isBoss ? 0.05 : 0.02); // heavy textured models skip the doubling hull
    // keep the shield bubble etc. (children of root), swap only the body group
    e.model.clear();
    e.model.scale.setScalar(1); // the downloaded model is fitted to the enemy's height already
    const body = new THREE.Group(); // procedural motion goes here so it never fights the clip or e.model's hop
    body.add(holder);
    e.model.add(body);
    const moves = clips.some((c) => usable(c) && /walk|run|move|locomot|attack|atack|fight/i.test(c.name));
    e.modelAnim = moves ? clipAnimator(e, obj, clips, body) : clips.some(usable) ? idleAnimator(e, obj, clips, body) : bodyAnimator(e, body);
  });
}

const usable = (c: THREE.AnimationClip) => !/t-?pose/i.test(c.name) && c.duration > 0.1;
const moving = (e: Enemy) => e.state === 'chase' || e.vel.lengthSq() > 0.25;

/**
 * Rigged model with a real clip set (Genshin-style enemy animation):
 *  · idle ↔ walk ↔ run by actual speed (cross-faded, walk/run speed follows movement)
 *  · attack: starts on the wind-up and HOLDS at the anticipation frame (~40 %) until the strike lands, then
 *    plays through — so the swing always connects on the frame the damage happens; several attack clips rotate
 *  · hit reaction: a short flinch layered in when hit (not during an attack; bosses have poise and don't flinch)
 *  · death: the death clip plays out before the body fades (`e.deathHold` delays the removal)
 * Clips are found by name (idle/walk/run/attack/hit/death in the many spellings packs use).
 */
const CLIP = {
  skip: /t-?pose|eye |^eye|shutdown|startup|crippled|rootmotion|back$|walkcycleback|default ?pose|sleep|jump|land|fall|crouch|turn|nothing|attention|_rest|stand ?up|death ?pose/i,
  idle: /idle|idel|iddle|wait|rest|pose/i,
  walk: /walk|^swim$/i,
  run: /run|charge|sprint|^swimfast$/i,
  attack: /attack|atack|atk|fight|melee|punch|kick|smash|swipe|throw|fire|bite|ram|slam|strike|critical|catch|shoot|spell|cast/i,
  hit: /hit|damage|wound|flinch|disorient/i,
  death: /death|die|dead|deathfall/i,
};

function clipAnimator(e: Enemy, obj: THREE.Object3D, clips: THREE.AnimationClip[], body: THREE.Group) {
  const mixer = new THREE.AnimationMixer(obj);
  const list = clips.filter((c) => usable(c) && !CLIP.skip.test(c.name.split('|').pop()!));
  const all = clips.filter(usable);
  const name = (c: THREE.AnimationClip) => c.name.split('|').pop()!;
  const pick = (re: RegExp, pool = list) => pool.filter((c) => re.test(name(c)));
  const deathClips = pick(CLIP.death, all).filter((c) => !/pose/i.test(name(c)));
  const attacks = pick(CLIP.attack).filter((c) => !CLIP.death.test(name(c)));
  const hits = pick(CLIP.hit).filter((c) => !attacks.includes(c) && !CLIP.death.test(name(c)));
  const walk = pick(CLIP.walk)[0] ?? null;
  const run = pick(CLIP.run).filter((c) => !attacks.includes(c))[0] ?? null;
  const idle = pick(CLIP.idle).filter((c) => !attacks.includes(c) && !hits.includes(c))[0] ?? walk ?? list[0];
  const loop = (c: THREE.AnimationClip | null) => (c ? mixer.clipAction(c) : null);
  const aIdle = loop(idle)!, aWalk = loop(walk), aRun = loop(run);
  const once = (c: THREE.AnimationClip) => { const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; return a; };
  const aAttacks = attacks.map(once), aHits = hits.map(once), aDeath = deathClips[0] ? once(deathClips[0]) : null;
  for (const a of [aIdle, aWalk, aRun]) if (a) { a.play(); a.setEffectiveWeight(0); }
  aIdle.setEffectiveWeight(1);
  e.rigged = true;
  const lunge = lungeMotion(e, body);
  let base: THREE.AnimationAction = aIdle;
  let current: THREE.AnimationAction | null = null; // one-shot on top (attack / hit / death)
  let lastState = e.state, lastPulse = e.attackPulse, lastFlash = 0, atkIdx = 0, dead = false;
  const setBase = (a: THREE.AnimationAction) => {
    if (a === base) return;
    a.enabled = true; a.setEffectiveTimeScale(1); a.crossFadeFrom(base, 0.25, false); base = a;
  };
  const playOnce = (a: THREE.AnimationAction, fade = 0.12) => {
    if (current && current !== a) current.fadeOut(fade);
    a.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fade).play();
    current = a;
  };
  return (dt: number) => {
    if (!e.alive) {
      if (!dead) {
        dead = true;
        if (aDeath) { playOnce(aDeath, 0.1); e.deathHold = Math.min(2.4, aDeath.getClip().duration); }
      }
      mixer.update(dt);
      return;
    }
    // locomotion by real speed
    const speed = Math.hypot(e.vel.x, e.vel.z);
    const nominal = Math.max(0.8, e.def.speed || 2);
    const target = speed < 0.25 ? aIdle : aRun && speed > nominal * 1.15 ? aRun : aWalk ?? aRun ?? aIdle;
    setBase(target);
    if (base !== aIdle) base.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / nominal, 0.6, 1.5));
    // attack: wind-up start (or a boss pulse) → swing; hold the anticipation frame while winding up
    const startedWindup = e.state === 'windup' && lastState !== 'windup';
    const pulsed = e.attackPulse !== lastPulse;
    if ((startedWindup || pulsed) && aAttacks.length) {
      const a = aAttacks[atkIdx++ % aAttacks.length];
      playOnce(a);
    }
    if (current && aAttacks.includes(current)) {
      const hold = current.getClip().duration * 0.4;
      current.paused = e.state === 'windup' && current.time >= hold;
    }
    // flinch when a new hit lands (not mid-swing, not bosses)
    if (e.hitFlash > lastFlash + 0.01 && !e.isBoss && aHits.length && e.state !== 'windup' && e.state !== 'attack') playOnce(aHits[Math.floor(Math.random() * aHits.length)], 0.06);
    // one-shot finished → back to the base loop
    if (current && !current.paused && current.time >= current.getClip().duration - 0.02) { current.fadeOut(0.2); current = null; }
    lastState = e.state; lastPulse = e.attackPulse; lastFlash = e.hitFlash;
    mixer.update(dt);
    if (!aAttacks.length) lunge(dt);
  };
}

/** Rigged model that only ships an idle clip: keep it breathing and add the procedural walk on top. */
function idleAnimator(e: Enemy, obj: THREE.Object3D, clips: THREE.AnimationClip[], body: THREE.Group) {
  const mixer = new THREE.AnimationMixer(obj);
  mixer.clipAction(clips.find(usable)!).play();
  const walk = bodyAnimator(e, body);
  return (dt: number) => { mixer.update(dt); walk(dt); };
}

/** Lean back on wind-up, snap forward on the strike. */
function lungeMotion(e: Enemy, body: THREE.Group) {
  return (dt: number) => {
    const target = e.state === 'windup' ? -0.25 : e.state === 'attack' && e.stateT < 0.3 ? 0.35 : 0;
    body.rotation.x += (target - body.rotation.x) * Math.min(1, dt * 14);
  };
}

/** Static (unrigged) model: walk bob + waddle for walkers, gallop rock for beasts, float/spin for drifters. */
function bodyAnimator(e: Enemy, body: THREE.Group) {
  const k = e.def.kind;
  const lunge = lungeMotion(e, body);
  let t = Math.random() * 10;
  return (dt: number) => {
    t += dt;
    const go = moving(e);
    if (k === 'boss_virus') {
      body.rotation.y += dt * 0.5;
      body.rotation.z = Math.sin(t * 0.7) * 0.15;
      body.position.y = Math.sin(t * 1.4) * 0.4;
      return;
    }
    if (k === 'phage') {
      body.position.y = Math.sin(t * 3) * 0.12;
      body.rotation.z = Math.sin(t * 2.2) * 0.12;
      lunge(dt);
      return;
    }
    if (k === 'coccus' || k === 'boss_king' || k === 'bacillus') {
      // slimes already hop/squash on e.model; add a jelly wobble
      body.rotation.z = Math.sin(t * 5) * 0.05;
      body.rotation.x = Math.sin(t * 4.3) * 0.04;
      return;
    }
    if (k === 'boss_chimera') {
      const f = go ? 7 : 2;
      body.position.y = go ? Math.abs(Math.sin(t * f)) * 0.25 : Math.sin(t * f) * 0.04;
      body.rotation.x = (go ? Math.sin(t * f) * 0.08 : 0) + (e.state === 'windup' ? -0.2 : 0);
      return;
    }
    // walkers (trooper, gunner, caster, golem…): step bob, side-to-side waddle, lean into the run
    const f = e.isBoss ? 4 : 9;
    const step = Math.sin(t * f);
    body.position.y = go ? Math.abs(step) * (e.isBoss ? 0.15 : 0.08) : Math.sin(t * 2) * 0.02;
    body.rotation.z = go ? step * (e.isBoss ? 0.05 : 0.09) : 0;
    if (e.state === 'windup' || e.state === 'attack') lunge(dt);
    else body.rotation.x += ((go ? 0.1 : 0) - body.rotation.x) * Math.min(1, dt * 8);
  };
}
