// Dev-only: drive chapter 4 (Florantis) start to finish and report each step. Resumes from the current quest.
// It runs longer than a console call may wait, so start it and read the log later:
//   (await import('/tools/ch4-test.js')).default(); …  window.__ch4log
import '/tools/test-harness.js';
const T = window.T;
const { bus } = await import('/src/core/EventBus.ts');

// right answers for the chapter-4 select puzzles (row label start → option)
const PUZZLE = {
  'ไซเลม': 'ลำเลียงน้ำและแร่ธาตุจากรากขึ้นสู่ใบ', 'โฟลเอ็ม': 'ลำเลียงน้ำตาลจากใบไปส่วนต่าง ๆ', 'เนื้อเยื่อเจริญ': 'แบ่งเซลล์ทำให้รากและลำต้นยาวขึ้น',
  'เซลล์คุม': 'ควบคุมการเปิด–ปิดปากใบ', 'เอพิเดอร์มิส': 'ปกคลุมผิวนอก ลดการสูญเสียน้ำ',
  'อับเรณู': 'สร้างละอองเรณู', 'ยอดเกสร': 'รับละอองเรณู', 'รังไข่': 'เจริญเป็นผล', 'ออวุล': 'เจริญเป็นเมล็ด', 'กลีบดอก': 'ล่อแมลงผสมเกสร',
  'ข้าวโพด': 'C4', 'ข้าว': 'C3', 'สับปะรด': 'CAM', 'อ้อย': 'C4', 'กระบองเพชร': 'CAM', 'ถั่วเหลือง': 'C3',
  'ยอดอ่อน': 'ออกซิน', 'ผลองุ่น': 'จิบเบอเรลลิน', 'กระตุ้นการแบ่ง': 'ไซโทไคนิน', 'เร่งการสุก': 'เอทิลีน', 'ปิดปากใบ': 'กรดแอบไซซิก',
};
const EXTRA = { 'flw-e': 'เอนโดสเปิร์ม (3n)', 'ps-e': 'สโตรมา' };

async function solvePuzzle() {
  for (let i = 0; i < 30 && !document.querySelector('#sp-ok'); i++) await T.wait(100);
  if (!document.querySelector('#sp-ok')) return 'NO PUZZLE OPEN';
  for (const row of document.querySelectorAll('.sel-row')) {
    const sel = row.querySelector('select');
    if (!sel) continue;
    if (sel.id && EXTRA[sel.id]) { sel.value = EXTRA[sel.id]; continue; }
    const label = row.querySelector('span').innerText.replace(/^\S+\s/, '');
    const key = Object.keys(PUZZLE).sort((a, b) => b.length - a.length).find((k) => label.startsWith(k));
    sel.value = PUZZLE[key];
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
const step = () => Object.entries(g().save.quests).filter(([k]) => k.startsWith('MQ_4')).map(([k, v]) => `${k}:${v.state}:${v.stepIndex ?? ''}`).join(' ');
async function settle() { for (let i = 0; i < 12; i++) { await T.skip(); await T.answer(); T.step(10); await T.wait(120); } }
/** quest fights: weaken the tagged minions (the test's auto-fight is not a real player), then fight */
async function clear(tag) {
  for (let k = 0; k < 6 && g().combat.enemies.some((e) => e.alive && e.questTag === tag); k++) {
    for (const e of g().combat.enemies) if (e.alive && e.questTag === tag && !e.isBoss) e.hp = Math.min(e.hp, 1);
    T.fight(tag, 300);
    await settle();
  }
}

export default async function run() {
  const log = [];
  window.__ch4log = log;
  try { await body(log); } catch (e) { log.push('ERR ' + e.message); }
  log.push('DONE');
  return log;
}

async function body(log) {
  const L = (s) => { log.push(`${s} → ${step()}`); };
  const s = g().save;
  if (state('MQ_4_01') !== 'COMPLETED') {
    s.quests.MQ_3_06 = { ...(s.quests.MQ_3_06 ?? {}), state: 'COMPLETED' };
    g().quests.refreshAvailability();
    if (!s.quests.MQ_4_01) g().quests.begin('MQ_4_01');
    await settle(); L('start');
    T.tpLoc('LOC_ACADEMY', 2, 2);
    await g().quests.interact('npc', 'NPC_LYSO_ACAD'); await settle(); L('lyso');
    await g().quests.interact('object', 'OBJ_AIRSHIP_CITY'); await settle(); L('airship');
    log.push('pos ' + g().player.pos.toArray().map((v) => v.toFixed(0)).join(','));
    await g().quests.interact('npc', 'NPC_LINNARA'); await settle(); L('linnara quiz');
  }
  if (state('MQ_4_02') !== 'COMPLETED') {
    T.tpLoc('LOC_FLO_ROOTS', 8, 8); T.step(20); await settle(); L('roots goto');
    await clear('F2'); L('fight F2');
    for (const id of ['OBJ_FLO_XYLEM', 'OBJ_FLO_PHLOEM', 'OBJ_FLO_STOMA', 'OBJ_FLO_MERISTEM']) bus.emit('Scanned', { targetId: id, tags: ['tissue'] });
    await settle(); L('tissue scans');
    const p = g().quests.interact('object', 'OBJ_FLO_ROOTBOARD'); log.push('puzzle ' + await solvePuzzle()); await p; await settle(); L('tissue puzzle+quiz');
  }
  if (state('MQ_4_03') !== 'COMPLETED') {
    T.tpLoc('LOC_FLO_BLOOM', 8, 8); T.step(20); await settle(); L('bloom goto');
    await clear('F3'); L('fight F3');
    const p = g().quests.interact('object', 'OBJ_FLO_FLOWER'); log.push('puzzle ' + await solvePuzzle()); await p; await settle(); L('flower puzzle+quiz');
  }
  if (state('MQ_4_04') !== 'COMPLETED') {
    T.tpLoc('LOC_FLO_TERRACE', 4, 14); T.step(20); await settle(); L('terrace goto');
    for (const id of ['OBJ_FLO_C3', 'OBJ_FLO_C4', 'OBJ_FLO_CAM']) bus.emit('Scanned', { targetId: id, tags: ['psplant'] });
    await settle(); L('ps scans');
    const p = g().quests.interact('object', 'OBJ_FLO_SUNDIAL'); log.push('puzzle ' + await solvePuzzle()); await p; await settle(); L('photo puzzle+quiz');
  }
  if (state('MQ_4_05') !== 'COMPLETED') {
    T.tpLoc('LOC_FLO_NURSERY', -6, 10); T.step(20); await settle(); L('nursery goto');
    await clear('F5'); L('fight F5');
    const p = g().quests.interact('object', 'OBJ_FLO_HORMONE'); log.push('puzzle ' + await solvePuzzle()); await p; await settle(); L('hormone puzzle+quiz');
  }
  if (state('MQ_4_06') !== 'COMPLETED') {
    T.tpLoc('LOC_FLO_HEART', 4, 18); T.step(20); await settle(); L('heart goto');
    bus.emit('Scanned', { targetId: 'OBJ_FLO_MOTHER', tags: ['mother'] }); await settle(); L('mother scan');
    const boss = g().combat.enemies.find((e) => e.alive && e.def.id === 'EN_BOSS_SPORE');
    log.push('boss ' + (boss ? `${boss.def.kind} hp ${boss.hp.toFixed(0)}/${boss.maxHp.toFixed(0)} el ${boss.permanentElement}` : 'MISSING'));
    for (let k = 0; k < 10 && g().combat.enemies.some((e) => e.alive && e.def.id === 'EN_BOSS_SPORE'); k++) {
      T.fight('F6', 400);
      await settle();
    }
    log.push('boss alive after fight: ' + g().combat.enemies.some((e) => e.alive && e.def.id === 'EN_BOSS_SPORE'));
    await settle(); L('boss');
    log.push('restored flag ' + !!g().save.flags.flo_restored);
    await g().quests.interact('npc', 'NPC_LINNARA_HEART'); await settle(); L('final exam');
  }
}
