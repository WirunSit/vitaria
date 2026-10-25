// Dev-only: drive chapter 7 (Neurion) start to finish and log each step. Resumes from the current quest.
// Runs longer than a console call may wait:  (await import('/tools/ch7-test.js')).default(); …  window.__ch7log
// It edits the save (unlocks quests) — restore the save afterwards.
import '/tools/test-harness.js';
import { g, state, settle, clear, scan, board, bossFight, runner } from '/tools/chapter-kit.js';
const T = window.T;

// right answers for the chapter-7 select puzzles (row label start → option); longest key wins
const PUZZLE = {
  'เดนไดรต์': 'รับกระแสประสาทเข้าสู่ตัวเซลล์', 'ตัวเซลล์': 'มีนิวเคลียส รวบรวมสัญญาณที่รับเข้ามา', 'แอกซอน': 'นำกระแสประสาทออกจากตัวเซลล์',
  'เยื่อไมอีลิน': 'เป็นฉนวน ให้กระแสประสาทกระโดดข้ามโนดออฟรันเวียร์ได้เร็ว', 'ปลายแอกซอน': 'หลั่งสารสื่อประสาทไปยังเซลล์ถัดไป',
  'เลนส์ตา': 'หักเหแสงให้โฟกัสตกบนเรตินา', 'เรตินา': 'รับแสงแล้วเปลี่ยนเป็นกระแสประสาท', 'ม่านตา': 'ปรับขนาดรูม่านตาตามความเข้มของแสง',
  'คอเคลีย': 'เปลี่ยนการสั่นของเสียงเป็นกระแสประสาท', 'ช่องครึ่งวงกลม': 'รับรู้การเคลื่อนไหวและการทรงตัวของศีรษะ', 'ปุ่มรับรส': 'รับรสของสารเคมีที่ละลายน้ำ',
  'กระดูก': 'เป็นโครงค้ำจุนร่างกายและเป็นที่ยึดเกาะของกล้ามเนื้อ', 'เอ็นยึดกระดูก': 'ยึดกระดูกกับกระดูกที่ข้อต่อ', 'เอ็นยึดกล้ามเนื้อ': 'ยึดกล้ามเนื้อกับกระดูก',
  'กล้ามเนื้อลาย': 'ยึดกับกระดูก ทำงานภายใต้อำนาจจิตใจ', 'กล้ามเนื้อหัวใจ': 'หดตัวเป็นจังหวะตลอดชีวิต อยู่นอกอำนาจจิตใจ', 'กล้ามเนื้อเรียบ': 'อยู่ที่ผนังอวัยวะภายใน เช่น ลำไส้ อยู่นอกอำนาจจิตใจ',
  'ต่อมใต้สมองส่วนหน้า': 'โกรทฮอร์โมนและฮอร์โมนกระตุ้นต่อมอื่น (TSH, FSH, LH)', 'ต่อมไทรอยด์': 'ไทรอกซิน ควบคุมอัตราเมแทบอลิซึม',
  'ไอส์เลตส์': 'อินซูลินและกลูคากอน ควบคุมน้ำตาลในเลือด', 'ต่อมหมวกไตชั้นใน': 'อะดรีนาลีน เตรียมร่างกายในภาวะฉุกเฉิน', 'รังไข่': 'เอสโทรเจนและโพรเจสเทอโรน', 'อัณฑะ': 'เทสโทสเทอโรน',
};
const EXTRA = {
  'ne-e': 'Na⁺', 'se-e': 'เลนส์เว้า', 'mu-e': 'ฟิลาเมนต์แอกตินเลื่อนซ้อนเข้าหากันบนไมโอซิน ซาร์โคเมียร์สั้นลง', 'en-e': 'หลั่ง TSH น้อยลง (การควบคุมแบบป้อนกลับเชิงลบ)',
};
const solve = (log, id) => board(log, id, PUZZLE, EXTRA);

export default runner('__ch7log', 'MQ_7', async (log, L) => {
  const s = g().save;
  if (state('MQ_7_01') !== 'COMPLETED') {
    s.quests.MQ_6_06 = { ...(s.quests.MQ_6_06 ?? {}), state: 'COMPLETED' };
    g().quests.refreshAvailability();
    if (!s.quests.MQ_7_01) g().quests.begin('MQ_7_01');
    await settle(); L('start');
    T.tpLoc('LOC_ACADEMY', 2, 2);
    await g().quests.interact('npc', 'NPC_LYSO_ACAD'); await settle(); L('lyso');
    await g().quests.interact('object', 'OBJ_AIRSHIP_CITY'); await settle(); L('airship');
    log.push('pos ' + g().player.pos.toArray().map((v) => v.toFixed(0)).join(','));
    await g().quests.interact('npc', 'NPC_NEUROS'); await settle(); L('neuros quiz');
    log.push('party ' + g().player.party.map((m) => m.def?.id ?? m.id).join(',') + ' · neuros_joined ' + !!s.flags.neuros_joined);
  }
  if (state('MQ_7_02') !== 'COMPLETED') {
    T.tpLoc('LOC_NEU_NEURON', 4, 10); T.step(20); await settle(); L('axon goto');
    await clear('N2');
    scan('neuron', ['OBJ_NEU_DENDRITE', 'OBJ_NEU_SOMA', 'OBJ_NEU_AXON', 'OBJ_NEU_SYNAPSE']);
    await settle(); L('fight + scans');
    await solve(log, 'OBJ_NEU_NEURONBOARD'); L('neuron puzzle+quiz');
  }
  if (state('MQ_7_03') !== 'COMPLETED') {
    T.tpLoc('LOC_NEU_SENSES', -4, 8); T.step(20); await settle(); L('senses goto');
    scan('sense', ['OBJ_NEU_LENS', 'OBJ_NEU_RETINA', 'OBJ_NEU_COCHLEA', 'OBJ_NEU_SEMICIRC']); await settle(); L('scans');
    await solve(log, 'OBJ_NEU_SENSEBOARD'); L('sense puzzle+quiz');
  }
  if (state('MQ_7_04') !== 'COMPLETED') {
    T.tpLoc('LOC_NEU_FORGE', 4, 10); T.step(20); await settle(); L('forge goto');
    await clear('N4'); L('fight N4');
    scan('motion', ['OBJ_NEU_BONE', 'OBJ_NEU_JOINT', 'OBJ_NEU_MUSCLE', 'OBJ_NEU_SARCOMERE']); await settle(); L('scans');
    await solve(log, 'OBJ_NEU_FORGEBOARD'); L('muscle puzzle+quiz');
  }
  if (state('MQ_7_05') !== 'COMPLETED') {
    T.tpLoc('LOC_NEU_SPIRE', -4, 8); T.step(20); await settle(); L('spire goto');
    scan('gland', ['OBJ_NEU_PITUITARY', 'OBJ_NEU_THYROID', 'OBJ_NEU_PANCREAS', 'OBJ_NEU_ADRENAL']); await settle(); L('scans');
    await solve(log, 'OBJ_NEU_SPIREBOARD'); L('endocrine puzzle+quiz');
  }
  if (state('MQ_7_06') !== 'COMPLETED') {
    T.tpLoc('LOC_NEU_TOWER', 4, 14); T.step(20); await settle(); L('tower goto');
    scan('brain', ['OBJ_NEU_BRAIN']); await settle(); L('brain scan');
    await bossFight(log, 'EN_BOSS_MEDUSA', 'N6', [0.66, 0.33]);
    L('boss');
    log.push('freed flag ' + !!s.flags.neu_freed);
    T.tpLoc('LOC_NEU_CAJALIS', 2, 2);
    g().quests.interact('npc', 'NPC_CAJALIS');
    await settle();
    log.push('card: ' + (document.querySelector('.chapter-card')?.innerText.split('\n').slice(0, 2).join(' / ') ?? 'none'));
    await settle(); L('final exam');
  }
});
