// Dev-only: drive chapter 5 (Metabolis) start to finish and log each step. Resumes from the current quest.
// Runs longer than a console call may wait:  (await import('/tools/ch5-test.js')).default(); …  window.__ch5log
// It edits the save (unlocks quests) — restore the save afterwards.
import '/tools/test-harness.js';
const T = window.T;
const { bus } = await import('/src/core/EventBus.ts');

// right answers for the chapter-5 select puzzles (row label start → option); longest key wins
const PUZZLE = {
  'ปาก': 'อะไมเลสย่อยแป้ง', 'กระเพาะอาหาร': 'เพปซินย่อยโปรตีนในสภาพกรด', 'ตับอ่อน': 'สร้างเอนไซม์ย่อยแป้ง โปรตีน และไขมันส่งเข้าลำไส้เล็ก', 'ตับ': 'สร้างน้ำดี ทำให้ไขมันแตกเป็นหยดเล็ก',
  'ลำไส้เล็ก': 'ดูดซึมสารอาหารเข้าสู่เลือด', 'ลำไส้ใหญ่': 'ดูดน้ำกลับ',
  'หายใจเข้า · กะบังลม': 'หดตัว แบนราบลง', 'หายใจเข้า · ปริมาตร': 'เพิ่มขึ้น', 'หายใจเข้า · ความดัน': 'ต่ำกว่าความดันบรรยากาศ', 'หายใจออก · กะบังลม': 'คลายตัว โค้งขึ้น', 'หายใจออก · ปริมาตร': 'ลดลง',
  'ไกลโคไลซิส': 'ไซโทพลาซึม', 'การสร้างแอซิทิล': 'เมทริกซ์ของไมโทคอนเดรีย', 'วัฏจักรเครบส์': 'เมทริกซ์ของไมโทคอนเดรีย', 'การถ่ายทอดอิเล็กตรอน': 'เยื่อหุ้มชั้นในของไมโทคอนเดรีย', 'การหมักกรดแลกติก': 'ไซโทพลาซึม',
  'ตัวรับอิเล็กตรอน': 'ออกซิเจน (เกิดน้ำ)', 'ตัวพาอิเล็กตรอน': 'NADH และ FADH₂', 'เอนไซม์ที่สร้าง ATP': 'ATP ซินเทส', 'CO₂ ที่เรา': 'การสลายไพรูเวตและวัฏจักรเครบส์', 'ยีสต์': 'การหมักแอลกอฮอล์ (เอทานอล + CO₂)',
};
const EXTRA = { 'dg-e': 'กลีเซอรอลและกรดไขมัน', 'br-e': 'การแพร่', 'gl-e': 'ไพรูเวต 2 โมเลกุล + ATP สุทธิ 2', 'kr-e': 'เซลล์ใช้ O₂ ไม่ได้ ATP ลดลงอย่างรวดเร็ว' };

async function solvePuzzle() {
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

const g = () => T.g();
const state = (id) => g().save.quests[id]?.state;
const step = () => Object.entries(g().save.quests).filter(([k]) => k.startsWith('MQ_5')).map(([k, v]) => `${k}:${v.state}:${v.stepIndex ?? ''}`).join(' ');
const continueCard = () => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('ดำเนินการต่อ'))?.click();
async function settle() { for (let i = 0; i < 12; i++) { continueCard(); await T.skip(); await T.answer(); T.step(10); await T.wait(120); } }
/** wait for a quest interaction to finish while answering whatever it opens (dialogue, quiz, chapter card) */
async function finish(p) {
  let done = false;
  p.finally(() => { done = true; });
  for (let i = 0; i < 80 && !done; i++) { continueCard(); await T.skip(); await T.answer(); T.step(5); await T.wait(150); }
}
async function clear(tag) {
  for (let k = 0; k < 6 && g().combat.enemies.some((e) => e.alive && e.questTag === tag); k++) {
    for (const e of g().combat.enemies) if (e.alive && e.questTag === tag && !e.isBoss) e.hp = Math.min(e.hp, 1);
    T.fight(tag, 300);
    await settle();
  }
}

export default async function run() {
  const log = [];
  window.__ch5log = log;
  try { await body(log); } catch (e) { log.push('ERR ' + e.message); }
  log.push('DONE');
  return log;
}

async function body(log) {
  const L = (s) => { log.push(`${s} → ${step()}`); };
  const s = g().save;
  if (state('MQ_5_01') !== 'COMPLETED') {
    s.quests.MQ_4_06 = { ...(s.quests.MQ_4_06 ?? {}), state: 'COMPLETED' };
    g().quests.refreshAvailability();
    if (!s.quests.MQ_5_01) g().quests.begin('MQ_5_01');
    await settle(); L('start');
    T.tpLoc('LOC_ACADEMY', 2, 2);
    await g().quests.interact('npc', 'NPC_LYSO_ACAD'); await settle(); L('lyso');
    await g().quests.interact('object', 'OBJ_AIRSHIP_CITY'); await settle(); L('airship');
    log.push('pos ' + g().player.pos.toArray().map((v) => v.toFixed(0)).join(','));
    await g().quests.interact('npc', 'NPC_KREBION'); await settle(); L('krebion quiz');
  }
  if (state('MQ_5_02') !== 'COMPLETED') {
    T.tpLoc('LOC_MET_DIGEST', 4, 8); T.step(20); await settle(); L('digest goto');
    await clear('M2');
    for (const id of ['OBJ_MET_MOUTH', 'OBJ_MET_STOMACH', 'OBJ_MET_VILLI', 'OBJ_MET_LIVER']) bus.emit('Scanned', { targetId: id, tags: ['digest'] });
    await settle(); L('fight + scans');
    const p = g().quests.interact('object', 'OBJ_MET_DIGESTBOARD'); log.push('puzzle ' + await solvePuzzle()); await finish(p); await settle(); L('digest puzzle+quiz');
  }
  if (state('MQ_5_03') !== 'COMPLETED') {
    T.tpLoc('LOC_MET_LUNGS', -6, 10); T.step(20); await settle(); L('lungs goto');
    await clear('M3');
    for (const id of ['OBJ_MET_TRACHEA', 'OBJ_MET_LUNG', 'OBJ_MET_DIAPHRAGM', 'OBJ_MET_ALVEOLI']) bus.emit('Scanned', { targetId: id, tags: ['breath'] });
    await settle(); L('fight + scans');
    const p = g().quests.interact('object', 'OBJ_MET_LUNGBOARD'); log.push('puzzle ' + await solvePuzzle()); await finish(p); await settle(); L('breath puzzle+quiz');
  }
  if (state('MQ_5_04') !== 'COMPLETED') {
    T.tpLoc('LOC_MET_GLYCO', 4, 12); T.step(20); await settle(); L('glyco goto');
    await clear('M4'); L('fight M4');
    const p = g().quests.interact('object', 'OBJ_MET_GLYCOBOARD'); log.push('puzzle ' + await solvePuzzle()); await finish(p); await settle(); L('glyco puzzle+quiz');
  }
  if (state('MQ_5_05') !== 'COMPLETED') {
    T.tpLoc('LOC_MET_KREBS', -4, 14); T.step(20); await settle(); L('krebs goto');
    bus.emit('Scanned', { targetId: 'OBJ_MET_WHEEL', tags: ['resp'] }); await settle(); L('wheel scan');
    const p = g().quests.interact('object', 'OBJ_MET_KREBSBOARD'); log.push('puzzle ' + await solvePuzzle()); await finish(p); await settle(); L('krebs puzzle+quiz');
  }
  if (state('MQ_5_06') !== 'COMPLETED') {
    T.tpLoc('LOC_MET_HEART', 4, 18); T.step(20); await settle(); L('heart goto');
    bus.emit('Scanned', { targetId: 'OBJ_MET_FURNACE', tags: ['furnace'] }); await settle(); L('furnace scan');
    const boss = g().combat.enemies.find((e) => e.alive && e.def.id === 'EN_BOSS_CYANO');
    log.push('boss ' + (boss ? `${boss.def.kind} hp ${boss.hp.toFixed(0)}/${boss.maxHp.toFixed(0)} el ${boss.permanentElement}` : 'MISSING'));
    if (boss) {
      // the test party is under-levelled: make the boss harmless, then walk it through both knowledge shields
      boss.atk = 1;
      T.tpLoc('LOC_MET_HEART', 2, 4);
      for (const frac of [0.67, 0.335, 0.004]) {
        boss.hp = Math.min(boss.hp, boss.maxHp * frac);
        for (const e of g().combat.enemies) if (e.alive && e.questTag === 'M6' && !e.isBoss) { e.hp = 1; e.atk = 1; }
        T.fight('M6', 150);
        await T.wait(1200);
        const q = document.querySelector('.quiz-card .quiz-head')?.innerText.split('\n')[0];
        if (q) log.push('shield quiz: ' + q);
        await settle();
      }
      for (let k = 0; k < 5 && boss.alive; k++) { boss.hp = Math.min(boss.hp, 5); T.fight('M6', 200); await settle(); }
    }
    log.push('boss alive after fight: ' + !!boss?.alive);
    await settle(); L('boss');
    log.push('restored flag ' + !!g().save.flags.met_restored);
    T.tpLoc('LOC_MET_KREBION_HEART', 2, 2);
    g().quests.interact('npc', 'NPC_KREBION_HEART');
    await settle();
    log.push('card: ' + (document.querySelector('.chapter-card,#chapter-card')?.innerText.split('\n').slice(0, 2).join(' / ') ?? 'none'));
    [...document.querySelectorAll('button')].find((b) => b.innerText.includes('ดำเนินการต่อ'))?.click();
    await settle(); L('final exam');
  }
}
