// Dev-only: play every main quest from a fresh save, start to finish, and report any step that cannot progress.
//   (await import('/tools/quest-audit.js')).default();   …then read window.__auditLog
//   options: { from: 'continue' } carries on with the saved game, { stopAt: 'MQ_5_03' } stops when that quest begins
// GOTO teleports, TALK/INTERACT use the real quest interaction, quizzes are answered from the data, SCAN uses the
// world's own scannables (must exist and be visible), DEFEAT kills the enemies that are actually alive in the world.
// Puzzles are stubbed (each has its own UI); they are reported so they can be checked by hand.
// It starts a NEW GAME — back up the save first (localStorage vitaria_save_v1).
import '/tools/test-harness.js';
const T = window.T;
const { bus } = await import('/src/core/EventBus.ts');
const g = () => window.game;
const d = () => window.__data;

const { isModalOpen } = await import('/src/ui/UI.ts');
const busy = () => g().quests.isBusy || isModalOpen() || !!document.querySelector('.dialogue-root');
async function settle(max = 80) {
  for (let i = 0; i < max; i++) {
    [...document.querySelectorAll('button')].find((b) => b.innerText.includes('ดำเนินการต่อ'))?.click();
    await T.skip();
    await T.answer();
    T.step(4);
    await T.wait(60);
    if (!busy()) { T.step(4); if (!busy()) return true; }
  }
  return false;
}
const visibleInScene = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };

export default async function run({ from = null, stopAt = null, maxIters = 1500 } = {}) {
  const log = [];
  window.__auditLog = log;
  const issue = (s) => { log.push('❌ ' + s); console.warn(s); };
  const game = g();
  if (!game.running) {
    // from the title: a fresh game, or { from: 'continue' } to carry on with the saved one
    if (from === 'continue') document.querySelector('#t-cont')?.click();
    else {
      document.querySelector('#t-new')?.click();
      await T.wait(300);
      document.querySelector('#cb-yes')?.click();
      await T.wait(300);
      document.querySelector('#c-go')?.click();
    }
    for (let i = 0; i < 40 && !game.running; i++) await T.wait(200);
    if (!game.running) { issue('could not start the game'); return log; }
  }
  const qm = game.quests;
  qm.api.runPuzzle = async (id) => { log.push(`  puzzle ${id} (stubbed ✓)`); return true; };
  for (const m of game.player.party) m.hp = 1e6;

  let lastKey = '', stale = 0;
  for (let it = 0; it < maxIters; it++) {
    await settle();
    game.combat.shield.hp = 1e9;
    const q = qm.activeMain();
    if (!q || q.id === stopAt) break;
    const p = game.save.quests[q.id];
    const step = q.steps[p.stepIndex ?? 0];
    const key = `${q.id}/${step.id}/${(p.progress ?? []).join(',')}`;
    if (key !== lastKey) { if (!lastKey.startsWith(`${q.id}/${step.id}/`)) log.push(`${q.id} ${step.id} · ${step.log.th}`); lastKey = key; stale = 0; }
    else if (++stale >= 6) {
      issue(`STUCK ${key} — forcing the step`);
      step.objectives.forEach((o, i) => { p.progress[i] = o.count ?? 1; });
      qm.completeStep(q);
      stale = 0;
      continue;
    }
    for (let i = 0; i < step.objectives.length; i++) {
      const o = step.objectives[i];
      const need = o.count ?? 1;
      if ((p.progress?.[i] ?? 0) >= need) continue;
      const where = (id) => { const l = d().locations.get(id); if (l) T.tp(l.x + 1.5, l.z + 1.5); return l; };
      switch (o.type) {
        case 'GOTO': where(o.locationId); T.step(10); break;
        case 'TALK': case 'QUIZ': {
          if (!o.npcId) break; // gate-less quiz: auto-launched by the step
          const n = game.npcs.find((x) => x.id === o.npcId);
          if (!n?.visible) { if (stale === 2) issue(`${q.id}/${step.id}: NPC ${o.npcId} is not visible`); break; }
          T.tp(n.pos.x + 1.5, n.pos.z + 1.5);
          const used = qm.interact('npc', o.npcId);
          await settle(200);
          if (!(await used) && stale === 2) issue(`${q.id}/${step.id}: talking to ${o.npcId} did nothing`);
          break;
        }
        case 'INTERACT': case 'PUZZLE': {
          const l = where(o.objectId);
          T.step(3);
          if (!qm.objectsWithObjectives().has(o.objectId)) issue(`${q.id}/${step.id}: object ${o.objectId} has no prompt`);
          if (!l) break;
          qm.interact('object', o.objectId);
          await settle(200);
          break;
        }
        case 'COLLECT': {
          const m = game.world.sites.pickups.find((x) => x.item === o.itemId && x.obj.visible);
          if (!m) { if (stale === 2) issue(`${q.id}/${step.id}: no visible pickup left for ${o.itemId} (${p.progress[i]}/${need})`); break; }
          T.tp(m.obj.position.x, m.obj.position.z);
          T.step(4);
          break;
        }
        case 'DEFEAT': {
          const match = (e) => e.alive && (e.def.id === o.enemyId || (o.enemyTag && e.def.tags.includes(o.enemyTag)));
          const alive = game.combat.enemies.filter(match);
          if (!alive.length) { if (stale === 2) issue(`${q.id}/${step.id}: DEFEAT ${o.enemyId ?? o.enemyTag} ${p.progress[i]}/${need} but no such enemy alive`); T.step(30); break; }
          const e = alive[0];
          T.tp(e.pos.x + 3, e.pos.z + 3);
          game.combat.kill(e);
          T.step(3);
          break;
        }
        case 'SCAN': {
          const seen = p.seen ?? [];
          const cands = game.scannables().filter((s) => (s.id === o.targetId || (o.targetTag && s.tags.includes(o.targetTag))) && !seen.includes(`${i}:${s.id}`));
          const s = cands.find((c) => visibleInScene(c.obj));
          if (!s) { if (stale === 2) issue(`${q.id}/${step.id}: SCAN ${o.targetId ?? o.targetTag} ${p.progress[i]}/${need}: ${cands.length ? 'targets hidden' : 'no target left'}`); T.step(20); break; }
          const w = s.obj.getWorldPosition(new (s.obj.position.constructor)());
          T.tp(w.x + 4, w.z + 4);
          game.unlockCodex(s.codexId, true);
          bus.emit('Scanned', { targetId: s.id, tags: s.tags });
          break;
        }
        case 'USE_SKILL': {
          const m = game.player.active;
          m.energy = m.def.burstCost; m.cdE = 0;
          T.tap(o.skill === 'Q' ? 'KeyQ' : 'KeyE'); T.step(40);
          break;
        }
        case 'REACTION': bus.emit('Reaction', { reaction: o.reaction }); log.push(`  reaction ${o.reaction} (emitted)`); break;
        default: issue(`${q.id}/${step.id}: unhandled objective ${o.type}`);
      }
    }
  }
  const main = [...d().quests.values()].filter((x) => x.type === 'MAIN');
  const left = main.filter((x) => game.save.quests[x.id]?.state !== 'COMPLETED').map((x) => `${x.id}:${game.save.quests[x.id]?.state ?? '-'}`);
  log.push(left.length ? `❌ not completed: ${left.join(' ')}` : `✅ all ${main.length} main quests completed`);
  log.push('DONE');
  return log;
}
