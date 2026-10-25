// Dev-only: render the ElementFX library for all seven elements side by side (one column per element) with a
// private camera — works while the app window is hidden. Posts JPEGs to the local receiver on :5199.
//   const F = (await import('/tools/fx-sheet.js')).default; await F.run();
import T from './test-harness.js';

const ELS = ['PYRO', 'HYDRO', 'ANEMO', 'ELECTRO', 'CRYO', 'DENDRO', 'GEO'];

async function shot(name, fire, wait) {
  const g = T.g();
  const E = await import('/src/render/ElementFX.ts');
  const P = g.player.pos.clone();
  const c = document.getElementById('game-canvas');
  const cam = new g.camera.constructor(50, c.width / c.height, 0.1, 300);
  ELS.forEach((el, i) => { const x = P.x - 11.4 + i * 3.8, z = P.z - 8; fire(E.efx(), new P.constructor(x, g.world.h(x, z), z), el); });
  for (let k = 0; k < Math.round(wait / 0.033); k++) g.fx.update(0.033);
  cam.position.set(P.x, P.y + 8, P.z + 9);
  cam.lookAt(P.x, P.y + 0.5, P.z - 8);
  g.renderer.render(g.scene, cam);
  const o = document.createElement('canvas');
  o.width = 1100; o.height = Math.round(1100 * c.height / c.width);
  o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
  for (let k = 0; k < 90; k++) g.fx.update(0.033); // let everything finish before the next shot
  return (await fetch('http://127.0.0.1:5199/' + name, { method: 'POST', body: o.toDataURL('image/jpeg', 0.8) })).text();
}

async function run() {
  T.tp(-30, 30);
  return [
    await shot('fx_cast', (f, p, el) => f.cast(p, el, false), 0.35),
    await shot('fx_castQ', (f, p, el) => f.cast(p, el, true), 0.3),
    await shot('fx_burst', (f, p, el) => f.burst(p.clone().setY(p.y + 1), el, 3), 0.15),
  ];
}

export default { run, shot };
