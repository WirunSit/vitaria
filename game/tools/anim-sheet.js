// Dev-only: line up every playable VRM and render a contact sheet of their moves (one column per character,
// one row per move) with a private camera — works even while the app window is hidden.
//   const A = (await import('/tools/anim-sheet.js')).default; await A.setup(); const url = A.sheet();
// `sheet()` returns a JPEG data URL; `post(name)` sends it to a local receiver on :5199 (scratchpad recv.js).
import T from './test-harness.js';

const CHARS = [['SEEKER', 'Sira', 'SWORD'], ['NEUROS', 'Neuros', 'SWORD'], ['HELIX', 'Helix', 'CLAYMORE'], ['HEMA', 'Hema', 'POLEARM'],
  ['CHLOREN', 'Chloren', 'BOW'], ['MITORA', 'Mitora', 'CATALYST'], ['ALVI', 'Alvi', 'CATALYST']];
const ROWS = [['normal', 0.2, 0], ['normal', 0.25, 1], ['charged', 0.7], ['skill', 0.8], ['burst', 1.0]];
let LU = [], cam = null;

async function setup(chars = CHARS) {
  const g = T.g();
  const L = await import('/src/models/ModelLibrary.ts');
  const C = await import('/src/models/CharacterModels.ts');
  for (const m of LU) g.scene.remove(m.root);
  LU = [];
  T.tp(-30, 30);
  const P = g.player.pos.clone();
  for (let i = 0; i < chars.length; i++) {
    const [id, art, w] = chars[i];
    const v = await L.loadVRM(`characters/CHR_${art}.vrm`);
    const m = new C.VrmCharacterModel(v, { height: 1 }, 'PHYSICAL', w, id);
    m.root.position.set(P.x - 6 + i * 2, P.y, P.z - 6);
    g.scene.add(m.root);
    LU.push(m);
  }
  await T.wait(4000);
  cam = new g.camera.constructor(40, 0.8, 0.1, 200);
  return LU.map((m) => m.actions.size);
}

// kind: 'normal' | 'charged' | 'skill' | 'burst', or 'run' / 'ready' (combat stance) for locomotion rows
function adv(kind, secs, swing = 0) {
  if (kind === 'run' || kind === 'ready' || kind === 'idle') {
    for (const m of LU) { m.curKey = null; m.combatT = kind === 'ready' ? 4 : 0; }
    const n = Math.round(secs / 0.033);
    for (let i = 0; i < n; i++) for (const m of LU) m.update(0.033, { speed: kind === 'run' ? 1 : 0, air: false, glide: false, attackT: -1, attackKind: 'normal', dashing: false });
    return;
  }
  const st = (t) => ({ speed: 0, air: false, glide: false, attackT: t, attackKind: kind, dashing: false, swing, swingLast: false });
  for (const m of LU) { m.prevAttackT = -1; m.curKey = null; m.showT = 0; m.combatT = 0; m.update(0.016, st(0)); }
  const n = Math.round(secs / 0.033);
  for (let i = 0; i < n; i++) for (const m of LU) m.update(0.033, st(kind === 'normal' ? Math.min(1, (i + 1) * 0.033 / 0.4) : -1));
}

function shot(m) {
  const g = T.g(), p = m.root.position, c = document.getElementById('game-canvas');
  cam.position.set(p.x + 0.6, p.y + 1.3, p.z + 3.6);
  cam.lookAt(p.x, p.y + 0.95, p.z);
  g.renderer.render(g.scene, cam);
  const o = document.createElement('canvas');
  o.width = 220; o.height = 275;
  const sw = c.height * 0.8;
  o.getContext('2d').drawImage(c, (c.width - sw) / 2, 0, sw, c.height, 0, 0, 220, 275);
  return o;
}

function sheet(rows = ROWS) {
  const S = document.createElement('canvas');
  S.width = 220 * LU.length; S.height = 275 * rows.length;
  const ctx = S.getContext('2d');
  rows.forEach(([k, t, sw], j) => { adv(k, t, sw || 0); LU.forEach((m, i) => ctx.drawImage(shot(m), i * 220, j * 275)); });
  return S.toDataURL('image/jpeg', 0.8);
}

async function post(name, rows) {
  return (await fetch('http://127.0.0.1:5199/' + name, { method: 'POST', body: sheet(rows) })).text();
}

export default { setup, adv, sheet, post, get models() { return LU; } };
