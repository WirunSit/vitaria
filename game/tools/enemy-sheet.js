// Dev-only: spawn every enemy kind in a row next to the player and snapshot idle / attack / death poses with a
// private camera (works while the app window is hidden). Posts JPEGs to the local receiver on :5199.
//   const S = (await import('/tools/enemy-sheet.js')).default; await S.run(['EN_BAC_COCCI', …])
import '/tools/test-harness.js';
const T = window.T;

async function shot(name, ids, pose) {
  const g = T.g();
  const c = document.getElementById('game-canvas');
  g.renderer.setSize(1280, 720, false);
  const cam = new g.camera.constructor(45, 1280 / 720, 0.1, 400);
  const P = g.player.pos;
  const row = ids.map((_, i) => P.x - (ids.length - 1) * 3.5 + i * 7);
  cam.position.set(P.x, P.y + 3.5, P.z + 7);
  cam.lookAt(P.x, P.y + 1.2, P.z - 6);
  g.renderer.render(g.scene, cam);
  const o = document.createElement('canvas');
  o.width = 1280; o.height = 720;
  const x = o.getContext('2d');
  x.drawImage(c, 0, 0);
  x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif';
  x.fillText(pose, 20, 34);
  void row;
  return (await fetch('http://127.0.0.1:5199/' + name, { method: 'POST', body: o.toDataURL('image/jpeg', 0.85) })).text();
}

async function run(ids, tag = 'sheet') {
  const g = T.g();
  g.combat.clearQuestEnemies?.('SHEET');
  const P = g.player.pos.clone();
  const es = ids.map((id, i) => {
    const at = P.clone().add(new P.constructor(-(ids.length - 1) * 2.4 + i * 4.8, 0, -6));
    const e = g.combat.spawn(id, at, 5, null, 'SHEET');
    if (e) { e.aggro = false; e.atk = 0; e.def = { ...e.def, speed: 0 }; }
    return e;
  });
  // let the models load and settle into idle
  for (let k = 0; k < 40; k++) { T.step(3); await T.wait(60); }
  for (const e of es) if (e) { e.state = 'idle'; e.vel.set(0, 0, 0); e.root.rotation.y = 0; }
  T.step(10);
  const out = [await shot(`${tag}_idle`, ids, 'idle')];
  // attack: enter the wind-up then release
  for (const e of es) if (e) { e.state = 'windup'; e.stateT = 0; e.attackPulse++; }
  for (let k = 0; k < 4; k++) { for (const e of es) if (e) { e.state = 'windup'; e.vel.set(0, 0, 0); } T.step(3); }
  out.push(await shot(`${tag}_windup`, ids, 'wind-up (held)'));
  for (const e of es) if (e) { e.state = 'attack'; e.stateT = 0; }
  for (let k = 0; k < 4; k++) { for (const e of es) if (e) e.vel.set(0, 0, 0); T.step(2); }
  out.push(await shot(`${tag}_strike`, ids, 'strike'));
  for (const e of es) if (e) g.combat.kill(e);
  T.step(25);
  out.push(await shot(`${tag}_death`, ids, 'death'));
  return out;
}

export default { run, shot };
