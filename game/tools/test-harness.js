// Dev-only test harness. In the browser console run:
//   await import('/tools/test-harness.js')
// then use window.T.* helpers to drive the game frame-by-frame (works even if the tab is hidden).
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const g = () => window.game;
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const step = (n = 1) => g().debugStep(n);
const hold = (code, frames) => { key(code, true); step(frames); key(code, false); step(1); };
const tap = (code) => { key(code, true); step(1); key(code, false); step(1); };
const canvas = () => document.getElementById('game-canvas');
const click = () => { canvas().dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); step(1); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })); step(13); };
const ov = () => document.getElementById('overlay').innerText.slice(0, 300);

async function skip() {
  for (let i = 0; i < 60 && document.querySelector('.dialogue-root'); i++) {
    const c = document.querySelector('.dlg-choice');
    if (c) c.click(); else { key('Space', true); key('Space', false); }
    await wait(110);
  }
}

/** Answers any open quiz correctly (looks answers up in the data registry). */
async function answer(wrong = false) {
  for (let k = 0; k < 20 && document.querySelector('.quiz-card'); k++) {
    if (document.querySelector('#qdone')) { document.querySelector('#qdone').click(); await wait(200); continue; }
    if (document.querySelector('#qnext')) { document.querySelector('#qnext').click(); await wait(250); continue; }
    if (document.querySelector('.puzzle-plots')) return;
    const stem = document.querySelector('.quiz-stem')?.innerText ?? '';
    const flat = stem.replace(/\s/g, '');
    const qs = [...window.__data.questions.values()].filter((x) => flat.startsWith(x.stem.th.replace(/\s|\*/g, '').slice(0, 15)));
    const q = qs.find((x) => flat.startsWith(x.stem.th.replace(/\s|\*/g, ''))) ?? qs[0];
    if (q && q.type === 'ORDER') {
      for (let guard = 0; guard < 30; guard++) {
        const items = [...document.querySelectorAll('.quiz-order .item')].map((e) => e.children[1].innerText);
        const i = items.findIndex((t, idx) => t !== q.items[idx]);
        if (i < 0) break;
        const j = items.indexOf(q.items[i]);
        document.querySelector(`[data-up="${j}"]`).click();
        await wait(20);
      }
    } else if (q) {
      const ansText = q.type === 'TF' ? (q.answer[0] === 'T' ? 'ถูก' : 'ผิด') : q.choices.find((c) => c.id === q.answer[0]).th;
      const btns = [...document.querySelectorAll('.quiz-choice')];
      const target = wrong ? btns.find((b) => !b.innerText.trim().endsWith(ansText)) : btns.find((b) => b.innerText.trim().endsWith(ansText));
      (target ?? btns[0])?.click();
    } else {
      document.querySelector('.quiz-choice')?.click();
    }
    await wait(60);
    document.querySelector('#qok')?.click();
    await wait(180);
  }
}

/** Simple auto-fight against enemies (optionally only those with a quest tag). */
function fight(tag = null, iters = 200, swapEvery = 25) {
  let it = 0;
  const game = g();
  for (; it < iters; it++) {
    const alive = game.combat.enemies.filter((e) => e.alive && e.def.kind !== 'dummy' && (!tag || e.questTag === tag));
    if (!alive.length) break;
    if (document.querySelector('.quiz-card,.dialogue-root')) break;
    const t = alive.sort((a, b) => a.pos.distanceTo(game.player.pos) - b.pos.distanceTo(game.player.pos))[0];
    const d = t.pos.distanceTo(game.player.pos);
    game.player.camYaw = Math.atan2(-(t.pos.x - game.player.pos.x), -(t.pos.z - game.player.pos.z));
    const ranged = ['CATALYST', 'BOW'].includes(game.player.active.def.weapon);
    if (d > (ranged ? 9 : 2.2)) { hold('KeyW', 6); continue; }
    const m = game.player.active;
    if (m.burstReady) { tap('KeyQ'); step(20); continue; }
    if (m.cdE <= 0) { tap('KeyE'); step(12); continue; }
    click();
    if (swapEvery && it % swapEvery === swapEvery - 1) tap(`Digit${((game.player.activeIndex + 1) % game.player.party.length) + 1}`);
  }
  return it;
}

function tp(x, z) { g().player.teleport({ x, y: 0, z }); step(5); }
function tpLoc(id, dx = 2, dz = 2) { const l = window.__data.locations.get(id); tp(l.x + dx, l.z + dz); }
function quest() { return JSON.stringify(g().save.quests); }

window.T = { wait, g, key, step, hold, tap, click, ov, skip, answer, fight, tp, tpLoc, quest };
export default window.T;
