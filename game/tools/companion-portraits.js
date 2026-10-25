// Dev-only: render the floating companion's portraits (icon + one bust per emotion) from its VRoid model,
// so the dialogue / HUD pictures match the 3D model. Run a receiver first:
//   node tools/recv-bin.cjs "../Assets/_Project/Art/Characters/Companion" 5199
// then in the game tab's console:  await (await import('/tools/companion-portraits.js')).default()
// and run `python tools/import_assets.py` to copy them into public/assets.
import * as THREE from 'three';
import { loadMixamoClips } from '/src/models/MixamoAnims.ts';

const FILE = 'npcs/NPC_Paimon.vrm';
/**
 * game emotion file name → VRM expression weights (+ a small head tilt). Chosen by eye for NPC_Paimon.vrm (VRM 0.x):
 * its "sad" preset draws round shocked eyes and its custom "Surprised" is the teary face, "happy" at full closes
 * the eyes into flat bars — so a half smile reads better.
 */
const EMOTIONS = {
  Neutral: { ex: {}, tilt: 0 },
  Happy: { ex: { happy: 0.5, aa: 0.25 }, tilt: 0.06 },
  Sad: { ex: { Surprised: 0.7 }, tilt: -0.08 },
  Angry: { ex: { angry: 1 }, tilt: 0 },
  Surprised: { ex: { sad: 1, aa: 0.35 }, tilt: 0.03 },
  Worried: { ex: { Surprised: 0.5, ou: 0.2 }, tilt: -0.05 },
  Crying: { ex: { Surprised: 1 }, tilt: -0.12 },
  Thinking: { ex: { lookUp: 0.6, ou: 0.3 }, tilt: 0.12 },
};

export default async function run(port = 5199, emotions = EMOTIONS, tag = '') {
  const vrm = await window.__models.loadVRM(FILE);
  if (!vrm) throw new Error('no companion model');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4e0, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.6, 1.2, 1.4);
  scene.add(key, vrm.scene);
  // the same relaxed idle the game plays on her, frozen at a calm moment
  const H = vrm.humanoid;
  const clips = await loadMixamoClips(vrm, { idle: 'relax_idle' });
  const mixer = new THREE.AnimationMixer(vrm.scene);
  const idle = clips.get('idle');
  if (idle) { mixer.clipAction(idle).play(); mixer.setTime(idle.duration * 0.25); }
  const headBase = H.getNormalizedBoneNode('head').rotation.clone();
  const rot = (b, x, y, z) => { const n = H.getNormalizedBoneNode(b); if (n) n.rotation.set(headBase.x + x, headBase.y + y, headBase.z + z); };
  vrm.update(0);
  vrm.scene.updateMatrixWorld(true);
  const head = H.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3());
  const box = new THREE.Box3().setFromObject(vrm.scene);
  const tall = box.max.y - box.min.y;
  const cam = new THREE.PerspectiveCamera(22, 1, 0.01, 50);
  const send = async (name, w, h) => {
    const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/png'));
    return (await fetch(`http://127.0.0.1:${port}/${name}`, { method: 'POST', body: blob })).text();
  };
  const setFace = (e) => {
    const em = vrm.expressionManager;
    if (!em) return;
    for (const k of Object.keys(em.expressionMap ?? {})) em.setValue(k, 0);
    for (const [k, v] of Object.entries(e.ex)) em.setValue(k, v);
    rot('head', 0, 0, e.tilt);
    vrm.update(0);
  };
  const out = [];
  // portraits: head to waist, face slightly turned toward the viewer's left like the other character art
  renderer.setSize(512, 720, false);
  cam.aspect = 512 / 720;
  cam.updateProjectionMatrix();
  const top = box.max.y + tall * 0.02, bottom = head.y - tall * 0.42;
  const mid = (top + bottom) / 2, span = top - bottom;
  const dist = (span / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 1.08;
  cam.position.set(head.x - dist * 0.22, mid, head.z + dist);
  cam.lookAt(head.x, mid, head.z);
  for (const [name, e] of Object.entries(emotions)) {
    setFace(e);
    renderer.render(scene, cam);
    out.push(await send(`${tag}CHR_Companion_Portrait_${name}.png`));
  }
  // icon: face close-up, square
  setFace(EMOTIONS.Neutral);
  renderer.setSize(256, 256, false);
  cam.aspect = 1;
  cam.updateProjectionMatrix();
  const r = tall * 0.2;
  const d2 = r / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(head.x - d2 * 0.12, head.y + tall * 0.06, head.z + d2);
  cam.lookAt(head.x, head.y + tall * 0.05, head.z);
  renderer.render(scene, cam);
  out.push(await send(`${tag}CHR_Companion_Icon.png`));
  renderer.dispose();
  return out;
}
