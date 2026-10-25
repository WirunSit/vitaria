// Dev-only: fire every character's real skill (E) and burst (Q) next to a dummy enemy and render a contact sheet
// (rows = characters, columns = E early / E later / Q early / Q later). Uses throw-away PartyMember copies, so the
// save is untouched. Posts the JPEG to the local receiver on :5199.
//   const K = (await import('/tools/kit-fx.js')).default; await K.run();
import T from './test-harness.js';

const IDS = ['SEEKER', 'MITORA', 'ALVI', 'CHLOREN', 'HEMA', 'NEUROS', 'HELIX'];
let W = 300, H = 220;

function clearEffects(g) {
  for (const e of g.combat.effects) if ('life' in e) e.life = 0;
  T.step(2);
}

function frame(g, cam) {
  const c = document.getElementById('game-canvas');
  g.renderer.render(g.scene, cam);
  const o = document.createElement('canvas');
  o.width = W; o.height = H;
  const sh = c.width * H / W;
  o.getContext('2d').drawImage(c, 0, (c.height - sh) / 2, c.width, sh, 0, 0, W, H);
  return o;
}

async function run(ids = IDS, size) {
  if (size) [W, H] = size;
  const g = T.g();
  const { KITS } = await import('/src/combat/Skills.ts');
  const { PartyMember } = await import('/src/player/Party.ts');
  const { data } = await import('/src/core/Data.ts');
  const p = g.player;
  T.tp(-30, 30);
  p.yaw = Math.PI; // face -z
  const c = document.getElementById('game-canvas');
  const cam = new g.camera.constructor(55, W / H, 0.1, 300);
  const S = document.createElement('canvas');
  S.width = W * 4; S.height = H * ids.length;
  const ctx2 = S.getContext('2d');
  for (let r = 0; r < ids.length; r++) {
    const id = ids[r];
    const m = new PartyMember(data.characters.get(id), { level: 40, ascension: 2, exp: 0, hpFrac: 1, relics: {} });
    T.tp(-30, 30);
    p.yaw = Math.PI;
    const pos = p.pos.clone();
    const dummy = g.combat.spawn('EN_BAC_COCCI', pos.clone().add(new pos.constructor(0, 0, -5)), 30, null, null);
    if (dummy) { dummy.hp = dummy.maxHp = 1e7; }
    const ctx = { ...p.kitCtx(), member: m, activeMember: () => m, yaw: Math.PI };
    for (const [k, kind] of [[0, 'skill'], [2, 'burst']]) {
      T.tp(pos.x, pos.z);
      p.yaw = Math.PI;
      KITS[id][kind]({ ...ctx, pos: p.pos, yaw: Math.PI });
      for (const [col, steps] of [[k, 6], [k + 1, 40]]) {
        T.step(steps);
        cam.position.set(pos.x + (window.KCAM?.[0] ?? 4), pos.y + (window.KCAM?.[1] ?? 4.5), pos.z + (window.KCAM?.[2] ?? 6));
        cam.lookAt(pos.x, pos.y + 1, pos.z - 3);
        ctx2.drawImage(frame(g, cam), col * W, r * H);
      }
      clearEffects(g);
    }
    if (dummy) { dummy.hp = 0; dummy.alive = false; }
    ctx2.fillStyle = '#fff'; ctx2.font = '16px sans-serif'; ctx2.fillText(id, 6, r * H + 18);
  }
  return (await fetch('http://127.0.0.1:5199/kitfx', { method: 'POST', body: S.toDataURL('image/jpeg', 0.8) })).text();
}

export default { run };
