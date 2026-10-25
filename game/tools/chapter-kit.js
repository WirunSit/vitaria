// Dev-only helpers shared by the chapter tests (ch7-test.js, ch8-test.js): drive a quest chain step by step while
// answering whatever it opens (dialogues, quizzes, chapter cards, select puzzles) and log each step.
import '/tools/test-harness.js';
const T = window.T;
const { bus } = await import('/src/core/EventBus.ts');

export const g = () => T.g();
export const state = (id) => g().save.quests[id]?.state;
export const continueCard = () => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('ดำเนินการต่อ'))?.click();

export async function settle() { for (let i = 0; i < 12; i++) { continueCard(); await T.skip(); await T.answer(); T.step(10); await T.wait(120); } }

/** Wait for a quest interaction to finish while answering whatever it opens. */
export async function finish(p) {
  let done = false;
  p.finally(() => { done = true; });
  for (let i = 0; i < 120 && !done; i++) { continueCard(); await T.skip(); await T.answer(); T.step(5); await T.wait(150); }
}

/** Beat every enemy with this quest tag (weakened first; the test party is under-levelled). */
export async function clear(tag) {
  for (let k = 0; k < 6 && g().combat.enemies.some((e) => e.alive && e.questTag === tag); k++) {
    for (const e of g().combat.enemies) if (e.alive && e.questTag === tag && !e.isBoss) { e.hp = Math.min(e.hp, 1); e.atk = 1; }
    g().combat.shield.hp = 1e9;
    const near = g().combat.enemies.find((e) => e.alive && e.questTag === tag);
    if (near) T.tp(near.pos.x + 2, near.pos.z + 2);
    T.fight(tag, 300);
    await settle();
  }
}

export const scan = (tag, ids) => { for (const id of ids) bus.emit('Scanned', { targetId: id, tags: [tag] }); };

/** Answer the open select puzzle: rows by label (longest key wins), extra questions by select id. */
export async function solvePuzzle(PUZZLE, EXTRA) {
  for (let i = 0; i < 30 && !document.querySelector('#sp-ok'); i++) await T.wait(100);
  if (!document.querySelector('#sp-ok')) return 'NO PUZZLE OPEN';
  const keys = Object.keys(PUZZLE).sort((a, b) => b.length - a.length);
  for (const row of document.querySelectorAll('.sel-row')) {
    const sel = row.querySelector('select');
    if (!sel) continue;
    if (sel.id && EXTRA[sel.id]) { sel.value = EXTRA[sel.id]; continue; }
    const label = row.querySelector('span').innerText.replace(/^\S+\s/, '');
    sel.value = PUZZLE[keys.find((k) => label.startsWith(k))];
  }
  document.querySelector('#sp-ok').click();
  await T.wait(150);
  const msg = document.querySelector('#sp-msg')?.innerText.slice(0, 40);
  document.querySelector('#sp-ok')?.click();
  await T.wait(150);
  return msg;
}

export async function board(log, id, PUZZLE, EXTRA) {
  const p = g().quests.interact('object', id);
  log.push('puzzle ' + (await solvePuzzle(PUZZLE, EXTRA)).replace(/\n/g, ' '));
  await finish(p);
  await settle();
}

/** Walk a boss through every knowledge shield (harmless boss, invulnerable party), then finish it. */
export async function bossFight(log, enemyId, tag, shields) {
  const boss = g().combat.enemies.find((e) => e.alive && e.def.id === enemyId);
  log.push('boss ' + (boss ? `${boss.def.kind} hp ${boss.hp.toFixed(0)}/${boss.maxHp.toFixed(0)} el ${boss.permanentElement ?? boss.aura?.element ?? '-'} rigged ${!!boss.rigged}` : 'MISSING'));
  if (!boss) return false;
  boss.atk = 1;
  for (const frac of [...shields.map((s) => s + 0.01), 0.004]) {
    boss.hp = Math.min(boss.hp, boss.maxHp * frac);
    for (const e of g().combat.enemies) if (e.alive && e.questTag === tag && !e.isBoss) { e.hp = 1; e.atk = 1; }
    g().combat.shield.hp = 1e9;
    T.tp(boss.pos.x + 2, boss.pos.z + 2);
    T.fight(tag, 150);
    await T.wait(1200);
    const q = document.querySelector('.quiz-card .quiz-head')?.innerText.split('\n')[0];
    if (q) log.push('shield quiz: ' + q + ' · element now ' + (boss.aura?.element ?? boss.permanentElement ?? '-'));
    await settle();
  }
  for (let k = 0; k < 5 && boss.alive; k++) { boss.hp = Math.min(boss.hp, 5); g().combat.shield.hp = 1e9; T.tp(boss.pos.x + 2, boss.pos.z + 2); T.fight(tag, 200); await settle(); }
  log.push('boss alive after fight: ' + !!boss.alive);
  await settle();
  return !boss.alive;
}

/** Runs `body(log, L)` and keeps the log on window[name] (the run outlasts a console call). */
export function runner(name, prefix, body) {
  return async function run() {
    const log = [];
    window[name] = log;
    const L = (s) => log.push(`${s} → ${Object.entries(g().save.quests).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => `${k}:${v.state}:${v.stepIndex ?? ''}`).join(' ')}`);
    try { await body(log, L); } catch (e) { log.push('ERR ' + e.message); }
    log.push('DONE');
    return log;
  };
}
