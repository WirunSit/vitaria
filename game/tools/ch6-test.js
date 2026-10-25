// Dev-only: drive chapter 6 (Aquorra) start to finish and log each step. Resumes from the current quest.
// Runs longer than a console call may wait:  (await import('/tools/ch6-test.js')).default(); …  window.__ch6log
// It edits the save (unlocks quests) — restore the save afterwards.
import '/tools/test-harness.js';
const T = window.T;
const { bus } = await import('/src/core/EventBus.ts');

// right answers for the chapter-6 select puzzles (row label start → option); longest key wins
const PUZZLE = {
  'หัวใจห้องบนขวา': 'หัวใจห้องล่างขวา', 'หัวใจห้องล่างขวา': 'ปอด (ทางหลอดเลือดแดงพัลโมนารี)', 'ปอด': 'หัวใจห้องบนซ้าย (ทางหลอดเลือดดำพัลโมนารี)', 'หัวใจห้องบนซ้าย': 'หัวใจห้องล่างซ้าย', 'หัวใจห้องล่างซ้าย': 'ทั่วร่างกาย (ทางเอออร์ตา)',
  'เม็ดเลือดแดง': 'ลำเลียง O₂ ด้วยฮีโมโกลบิน', 'เม็ดเลือดขาว': 'ต่อสู้และทำลายเชื้อโรค', 'เกล็ดเลือด': 'ช่วยให้เลือดแข็งตัวเมื่อเกิดบาดแผล', 'พลาสมา': 'ลำเลียงสารอาหาร ฮอร์โมน และของเสียที่ละลายน้ำ',
  'หลอดเลือดแดง': 'นำเลือดออกจากหัวใจ ผนังหนายืดหยุ่น', 'หลอดเลือดดำ': 'นำเลือดกลับหัวใจ มีลิ้นกันเลือดไหลย้อน', 'หลอดเลือดฝอย': 'แลกเปลี่ยนสารกับเซลล์ ผนังบางชั้นเดียว',
  'ผิวหนัง': 'ด่านแรกที่กั้นเชื้อโรคไม่ให้เข้าร่างกาย', 'แมโครฟาจ': 'กลืนกินเชื้อโรคด้วยฟาโกไซโทซิส', 'เซลล์บี': 'สร้างแอนติบอดีที่จับกับแอนติเจนจำเพาะ', 'เซลล์ทีผู้ช่วย': 'กระตุ้นเซลล์บีและเซลล์ทีพิฆาต', 'เซลล์ทีพิฆาต': 'ทำลายเซลล์ร่างกายที่ติดเชื้อไวรัส', 'เซลล์ความจำ': 'จดจำเชื้อ ตอบสนองได้เร็วและแรงในครั้งต่อไป',
  'โกลเมอรูลัส': 'กรองน้ำเลือดภายใต้ความดันสูง', 'โบว์แมนแคปซูล': 'รองรับของเหลวที่กรองได้', 'ท่อหน่วยไตส่วนต้น': 'ดูดกลับกลูโคส กรดอะมิโน น้ำ และเกลือแร่ส่วนใหญ่', 'ห่วงเฮนเล': 'ทำให้เนื้อไตชั้นในมีเกลือเข้มข้น ช่วยดูดน้ำกลับ', 'ท่อรวม': 'ดูดน้ำกลับมากขึ้นเมื่อมีฮอร์โมน ADH',
};
const EXTRA = { 'ht-e': 'หัวใจห้องล่างซ้าย', 'bl-e': 'ไม่มีทั้ง A และ B', 'im-e': 'กระตุ้นให้ร่างกายสร้างภูมิคุ้มกันและเซลล์ความจำเอง', 'np-e': 'กลูโคสและโปรตีน' };

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
const step = () => Object.entries(g().save.quests).filter(([k]) => k.startsWith('MQ_6')).map(([k, v]) => `${k}:${v.state}:${v.stepIndex ?? ''}`).join(' ');
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
  window.__ch6log = log;
  try { await body(log); } catch (e) { log.push('ERR ' + e.message); }
  log.push('DONE');
  return log;
}

const scan = (tag, ids) => { for (const id of ids) bus.emit('Scanned', { targetId: id, tags: [tag] }); };
async function board(log, id) { const p = g().quests.interact('object', id); log.push('puzzle ' + await solvePuzzle()); await finish(p); await settle(); }

async function body(log) {
  const L = (s) => { log.push(`${s} → ${step()}`); };
  const s = g().save;
  if (state('MQ_6_01') !== 'COMPLETED') {
    s.quests.MQ_5_06 = { ...(s.quests.MQ_5_06 ?? {}), state: 'COMPLETED' };
    g().quests.refreshAvailability();
    if (!s.quests.MQ_6_01) g().quests.begin('MQ_6_01');
    await settle(); L('start');
    T.tpLoc('LOC_ACADEMY', 2, 2);
    await g().quests.interact('npc', 'NPC_LYSO_ACAD'); await settle(); L('lyso');
    await g().quests.interact('object', 'OBJ_AIRSHIP_CITY'); await settle(); L('airship');
    log.push('pos ' + g().player.pos.toArray().map((v) => v.toFixed(0)).join(','));
    await g().quests.interact('npc', 'NPC_HARVENA'); await settle(); L('harvena quiz');
  }
  if (state('MQ_6_02') !== 'COMPLETED') {
    T.tpLoc('LOC_AQU_HEART', 4, 10); T.step(20); await settle(); L('heart goto');
    await clear('A2');
    scan('heart', ['OBJ_AQU_ATRIUM', 'OBJ_AQU_VENTRICLE', 'OBJ_AQU_VALVE', 'OBJ_AQU_AORTA']);
    await settle(); L('fight + scans');
    await board(log, 'OBJ_AQU_HEARTBOARD'); L('heart puzzle+quiz');
  }
  if (state('MQ_6_03') !== 'COMPLETED') {
    T.tpLoc('LOC_AQU_VESSELS', -4, 8); T.step(20); await settle(); L('vessels goto');
    scan('vessel', ['OBJ_AQU_ARTERY', 'OBJ_AQU_VEIN', 'OBJ_AQU_CAPILLARY', 'OBJ_AQU_RBC']); await settle(); L('scans');
    await board(log, 'OBJ_AQU_VESSELBOARD'); L('blood puzzle+quiz');
  }
  if (state('MQ_6_04') !== 'COMPLETED') {
    T.tpLoc('LOC_AQU_FORT', 4, 12); T.step(20); await settle(); L('fort goto');
    await clear('A4'); L('fight A4');
    await board(log, 'OBJ_AQU_FORTBOARD'); L('immune puzzle+quiz');
  }
  if (state('MQ_6_05') !== 'COMPLETED') {
    T.tpLoc('LOC_AQU_KIDNEY', -6, 4); T.step(20); await settle(); L('kidney goto');
    scan('nephron', ['OBJ_AQU_GLOMERULUS', 'OBJ_AQU_BOWMAN', 'OBJ_AQU_TUBULE', 'OBJ_AQU_KIDNEY']); await settle(); L('scans');
    await board(log, 'OBJ_AQU_NEPHRONBOARD'); L('nephron puzzle+quiz');
  }
  if (state('MQ_6_06') !== 'COMPLETED') {
    T.tpLoc('LOC_AQU_MARSH', 4, 20); T.step(20); await settle(); L('marsh goto');
    scan('marsh', ['OBJ_AQU_MARSH']); await settle(); L('marsh scan');
    const boss = g().combat.enemies.find((e) => e.alive && e.def.id === 'EN_BOSS_SUPERBUG');
    log.push('boss ' + (boss ? `${boss.def.kind} hp ${boss.hp.toFixed(0)}/${boss.maxHp.toFixed(0)} el ${boss.permanentElement}` : 'MISSING'));
    if (boss) {
      boss.atk = 1;
      T.tpLoc('LOC_AQU_MARSH', 2, 6);
      for (const frac of [0.67, 0.335, 0.004]) {
        boss.hp = Math.min(boss.hp, boss.maxHp * frac);
        for (const e of g().combat.enemies) if (e.alive && e.questTag === 'A6' && !e.isBoss) { e.hp = 1; e.atk = 1; }
        g().combat.shield.hp = 1e9; // the under-levelled test party would wipe
        T.tp(boss.pos.x + 2, boss.pos.z + 2); // the boss wanders through the marsh
        T.fight('A6', 150);
        await T.wait(1200);
        const q = document.querySelector('.quiz-card .quiz-head')?.innerText.split('\n')[0];
        if (q) log.push('shield quiz: ' + q);
        await settle();
      }
      for (let k = 0; k < 5 && boss.alive; k++) { boss.hp = Math.min(boss.hp, 5); g().combat.shield.hp = 1e9; T.tp(boss.pos.x + 2, boss.pos.z + 2); T.fight('A6', 200); await settle(); }
    }
    log.push('boss alive after fight: ' + !!boss?.alive);
    await settle(); L('boss');
    log.push('cured flag ' + !!g().save.flags.aqu_cured);
    T.tpLoc('LOC_AQU_HARVENA_MARSH', 2, 2);
    g().quests.interact('npc', 'NPC_HARVENA_MARSH');
    await settle();
    log.push('card: ' + (document.querySelector('.chapter-card,#chapter-card')?.innerText.split('\n').slice(0, 2).join(' / ') ?? 'none'));
    continueCard();
    await settle(); L('final exam');
  }
}
