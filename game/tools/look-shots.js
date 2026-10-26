// Dev-only: fixed camera shots for comparing visual changes (same spot, time and camera every run).
//   1) node tools/recv-bin.cjs <outDir>                      (saves the posted images)
//   2) in a running game (after "เริ่มการผจญภัย"):
//        const S = (await import('/tools/look-shots.js')).default; await S.run('after');
//      → <outDir>/after_A.jpg … after_D.jpg. Works while the tab is hidden (frames are stepped by hand).
// Toggle Esc → "ภาพมิติลึก" / "ภาพแบบใหม่" and reload between runs to shoot before/after.
await import('/tools/test-harness.js');
const T = window.T;

/** name: [x, z, camYaw, camPitch, camDist, hour] */
export const VIEWS = {
  A: [0, 22, 0, 0.2, 6.2, 10], // start plaza, where a new game begins
  B: [30, -40, 2.4, 0.12, 6.2, 10], // open meadow toward the crystal and the eastern ridge
  C: [-40, 30, -0.8, 0.12, 6.2, 10], // dirt path through tall grass
  D: [30, -40, 2.4, 0.12, 6.2, 17.4], // the meadow at sunset
};

function view([x, z, yaw, pitch, dist, hour]) {
  const g = T.g(), p = g.player;
  T.tp(x, z);
  p.camYaw = yaw; p.camPitch = pitch; p.camDist = dist;
  g.save.timeOfDay = hour;
  T.step(20);
}

async function capture(name, port = 5198) {
  const c = document.getElementById('game-canvas');
  // render and read back in the same task, before the drawing buffer is cleared
  const blob = await new Promise((r) => { T.g().debugStep(0); c.toBlob(r, 'image/jpeg', 0.9); });
  return (await fetch(`http://127.0.0.1:${port}/${name}.jpg`, { method: 'POST', body: blob })).text();
}

async function run(prefix = 'shot', only = Object.keys(VIEWS)) {
  const out = [];
  for (const k of only) { view(VIEWS[k]); out.push(await capture(`${prefix}_${k}`)); }
  return out;
}

export default { run, view, capture, VIEWS };
