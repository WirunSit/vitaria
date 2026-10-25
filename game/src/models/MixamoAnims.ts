import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type { WeaponType } from '../core/types';

/**
 * Mixamo motion clips (FBX without skin, 30 fps, assets/anims/*.fbx) retargeted onto any VRM —
 * after three-vrm's `loadMixamoAnimation` example. Each weapon has its own move set (stance, run, 4-hit combo,
 * charged attack, skill, burst) and characters can swap in their own skill/burst to match their element's kit.
 * FBX files load lazily and once; each VRM gets its own retargeted clips (track names point at its bones).
 */
export const ANIM_KEYS = ['idle', 'ready', 'run', 'jump', 'dodge', 'atk1', 'atk2', 'atk3', 'atk4', 'heavy', 'skill', 'burst'] as const;
export type AnimKey = (typeof ANIM_KEYS)[number];
type ClipSet = Partial<Record<AnimKey, string>>;

/** shared by everyone: relaxed standing idle, jump, dodge roll */
const BASE: ClipSet = { idle: 'relax_idle', jump: 'sword_jump', dodge: 'sword_dodge' };

/** 'ready' = combat stance held for a few seconds after fighting */
const WEAPON_SETS: Record<WeaponType, ClipSet> = {
  SWORD: { ready: 'sword_idle', run: 'sword_run', atk1: 'sword_atk1', atk2: 'sword_atk2', atk3: 'sword_atk3', atk4: 'sword_atk4', heavy: 'sword_heavy', skill: 'sword_skill', burst: 'sword_burst' },
  // Great Sword pack: wide two-handed swings, the charged attack is the claymore spin
  CLAYMORE: { ready: 'gs_idle', run: 'gs_run', atk1: 'gs_down', atk2: 'gs_low', atk3: 'gs_crouch', atk4: 'gs_combo', heavy: 'gs_spin', skill: 'gs_power', burst: 'gs_powerup' },
  // spear thrust + two-handed swings; skill = leaping strike, burst = battle cry
  POLEARM: { ready: 'ax_idle', run: 'ax_run', atk1: 'sp_stab', atk2: 'ax_rl', atk3: 'ax_up', atk4: 'ax_spin', heavy: 'ax_down', skill: 'ax_jump', burst: 'ax_cry' },
  BOW: { ready: 'bow_idle', run: 'bow_run', atk1: 'bow_fire', atk2: 'bow_shoot', atk3: 'bow_fire', atk4: 'bow_shoot', heavy: 'bow_charge', skill: 'bow_shoot', burst: 'mg_upwards' },
  CATALYST: { ready: 'mg_ready', run: 'mg_run', atk1: 'mg_fwd1', atk2: 'mg_sweep', atk3: 'mg_up1', atk4: 'mg_fwd2', heavy: 'mg_sustain', skill: 'mg_wide', burst: 'mg_blast' },
};

/** character-specific skill/burst so each element's kit reads differently */
const CHAR_SETS: Record<string, ClipSet> = {
  // Saltatory Leap = quick lunging slash; Action Potential = huge two-handed overhead strike
  NEUROS: { skill: 'sw_out', burst: 'gs_power' },
  // Inhale = pulling the air in; Exhale Gale = conjure and hurl the tornado
  ALVI: { skill: 'mg_pull', burst: 'mg_throw' },
  // (MITORA keeps the catalyst set: wide fire-ring summon + "pull in, blast out" explosion)
};

/** Clip files for a character (`null` = NPC: the relaxed idle only). */
export function clipSetFor(weapon: WeaponType, charId: string | null): ClipSet {
  if (!charId) return { idle: BASE.idle };
  return { ...BASE, ...WEAPON_SETS[weapon], ...(CHAR_SETS[charId] ?? {}) };
}

const RIG: Record<string, VRMHumanBoneName> = {
  mixamorigHips: 'hips', mixamorigSpine: 'spine', mixamorigSpine1: 'chest', mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck', mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder', mixamorigLeftArm: 'leftUpperArm', mixamorigLeftForeArm: 'leftLowerArm', mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal', mixamorigLeftHandThumb2: 'leftThumbProximal', mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal', mixamorigLeftHandIndex2: 'leftIndexIntermediate', mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal', mixamorigLeftHandMiddle2: 'leftMiddleIntermediate', mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal', mixamorigLeftHandRing2: 'leftRingIntermediate', mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal', mixamorigLeftHandPinky2: 'leftLittleIntermediate', mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder', mixamorigRightArm: 'rightUpperArm', mixamorigRightForeArm: 'rightLowerArm', mixamorigRightHand: 'rightHand',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal', mixamorigRightHandThumb2: 'rightThumbProximal', mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal', mixamorigRightHandIndex2: 'rightIndexIntermediate', mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal', mixamorigRightHandMiddle2: 'rightMiddleIntermediate', mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1: 'rightRingProximal', mixamorigRightHandRing2: 'rightRingIntermediate', mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandPinky1: 'rightLittleProximal', mixamorigRightHandPinky2: 'rightLittleIntermediate', mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg', mixamorigLeftLeg: 'leftLowerLeg', mixamorigLeftFoot: 'leftFoot', mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg', mixamorigRightLeg: 'rightLowerLeg', mixamorigRightFoot: 'rightFoot', mixamorigRightToeBase: 'rightToes',
};

/** Clips where the game already moves the body: drop the clip's own lift (travel is always dropped). */
const NO_LIFT = new Set<string>(['sword_jump', 'sword_dodge', 'ax_jump']);

const loader = new FBXLoader();
const files = new Map<string, Promise<THREE.Group | null>>();

function loadFile(name: string) {
  let f = files.get(name);
  if (!f) {
    f = loader.loadAsync(`assets/anims/${name}.fbx`).catch(() => null);
    files.set(name, f);
  }
  return f;
}

const qA = new THREE.Quaternion();
const restInv = new THREE.Quaternion();
const parentRest = new THREE.Quaternion();

function retarget(asset: THREE.Group, vrm: VRM, key: AnimKey, file: string): THREE.AnimationClip | null {
  const src = asset.animations[0];
  const hipsNode = asset.getObjectByName('mixamorigHips');
  if (!src || !hipsNode) return null;
  const vrm0 = vrm.meta?.metaVersion === '0';
  const restHips = vrm.humanoid.normalizedRestPose.hips?.position;
  const hipsScale = (restHips ? Math.abs(restHips[1]) : 0.9) / hipsNode.position.y;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of src.tracks) {
    const [rigName, prop] = track.name.split('.');
    const bone = RIG[rigName];
    const nodeName = bone && vrm.humanoid.getNormalizedBoneNode(bone)?.name;
    const rigNode = asset.getObjectByName(rigName);
    if (!nodeName || !rigNode?.parent) continue;
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      rigNode.getWorldQuaternion(restInv).invert();
      rigNode.parent.getWorldQuaternion(parentRest);
      const v = track.values.slice();
      for (let i = 0; i < v.length; i += 4) {
        qA.fromArray(v, i).premultiply(parentRest).multiply(restInv).toArray(v, i);
        if (vrm0) { v[i] = -v[i]; v[i + 2] = -v[i + 2]; }
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${nodeName}.${prop}`, Array.from(track.times), Array.from(v)));
    } else if (track instanceof THREE.VectorKeyframeTrack && rigName === 'mixamorigHips' && prop === 'position') {
      const v = track.values.slice();
      const y0 = v[1];
      for (let i = 0; i < v.length; i += 3) {
        // the controller moves the character; keep only the hips' up/down
        v[i] = restHips?.[0] ?? 0;
        v[i + 2] = restHips?.[2] ?? 0;
        v[i + 1] = (NO_LIFT.has(file) ? Math.min(v[i + 1], y0) : v[i + 1]) * hipsScale;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${nodeName}.${prop}`, Array.from(track.times), Array.from(v)));
    }
  }
  return new THREE.AnimationClip(key, src.duration, tracks);
}

/** Retargeted clips for one VRM (missing files are simply left out). */
export async function loadMixamoClips(vrm: VRM, set: ClipSet): Promise<Map<AnimKey, THREE.AnimationClip>> {
  const entries = Object.entries(set) as [AnimKey, string][];
  const assets = await Promise.all(entries.map(([, f]) => loadFile(f)));
  const out = new Map<AnimKey, THREE.AnimationClip>();
  entries.forEach(([k, f], i) => {
    const asset = assets[i];
    const c = asset && retarget(asset, vrm, k, f);
    if (c) out.set(k, c);
  });
  return out;
}
