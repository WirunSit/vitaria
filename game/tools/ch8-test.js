// Dev-only: drive the finale (the Roots) start to finish and log each step. Resumes from the current quest.
// Runs longer than a console call may wait:  (await import('/tools/ch8-test.js')).default(); …  window.__ch8log
// It edits the save (unlocks quests) — restore the save afterwards.
import '/tools/test-harness.js';
import { g, state, settle, clear, scan, board, bossFight, runner } from '/tools/chapter-kit.js';
const T = window.T;

// right answers for the finale's select puzzles (row label start → option); longest key wins
const PUZZLE = {
  'หนาว · หลอดเลือด': 'หดตัว ลดการสูญเสียความร้อน', 'หนาว · กล้ามเนื้อ': 'หดตัวถี่ ๆ (หนาวสั่น) สร้างความร้อน',
  'ร้อน · หลอดเลือด': 'ขยายตัว ระบายความร้อนออกทางผิวหนัง', 'ร้อน · ต่อมเหงื่อ': 'หลั่งเหงื่อมากขึ้น การระเหยพาความร้อนออก',
  'หลังกินอาหาร · ฮอร์โมน': 'อินซูลิน', 'หลังกินอาหาร · ตับ': 'เปลี่ยนกลูโคสเป็นไกลโคเจนเก็บไว้',
  'อดอาหาร/ออกกำลังกายนาน · ฮอร์โมน': 'กลูคากอน', 'อดอาหาร/ออกกำลังกายนาน · ตับ': 'สลายไกลโคเจนเป็นกลูโคสปล่อยเข้าสู่เลือด',
  'ขาดน้ำ · ADH': 'หลั่งมากขึ้น', 'ขาดน้ำ · ปัสสาวะ': 'น้อยและเข้มข้น', 'ดื่มน้ำมาก · ADH': 'หลั่งน้อยลง', 'ดื่มน้ำมาก · ปัสสาวะ': 'มากและเจือจาง',
  'ผู้ผลิต': 'สร้างอาหารเองด้วยการสังเคราะห์ด้วยแสง', 'ผู้บริโภค': 'ได้พลังงานจากการกินสิ่งมีชีวิตอื่น', 'ผู้ย่อยสลาย': 'ย่อยซากสิ่งมีชีวิตและคืนแร่ธาตุสู่ดิน',
  'พลังงาน': 'ถ่ายทอดต่อได้ราว 10% ที่เหลือสูญเสียเป็นความร้อน', 'วัฏจักรคาร์บอน': 'คาร์บอนหมุนเวียนระหว่างสิ่งมีชีวิตและสิ่งแวดล้อม',
};
const EXTRA = {
  'th-e': 'ไฮโพทาลามัส', 'gl2-e': 'เซลล์ในตับอ่อนสร้างอินซูลินไม่ได้', 'wa-e': 'หายใจเร็วและลึกขึ้น', 'ec-e': 'ใช้ทรัพยากรโดยไม่ทำลายโอกาสของคนรุ่นหลัง',
};
const solve = (log, id) => board(log, id, PUZZLE, EXTRA);

export default runner('__ch8log', 'MQ_8', async (log, L) => {
  const s = g().save;
  if (state('MQ_8_01') !== 'COMPLETED') {
    s.quests.MQ_7_06 = { ...(s.quests.MQ_7_06 ?? {}), state: 'COMPLETED' };
    g().quests.refreshAvailability();
    if (!s.quests.MQ_8_01) g().quests.begin('MQ_8_01');
    await settle(); L('start');
    T.tpLoc('LOC_ACADEMY', 2, 2);
    await g().quests.interact('npc', 'NPC_LYSO_ACAD'); await settle(); L('lyso');
    await g().quests.interact('object', 'OBJ_AIRSHIP_CITY'); await settle(); L('airship');
    log.push('pos ' + g().player.pos.toArray().map((v) => v.toFixed(0)).join(','));
    await g().quests.interact('npc', 'NPC_ARB_HOOKIA'); await settle(); L('hookia quiz');
  }
  const trials = [
    ['MQ_8_02', 'LOC_ARB_THERMO', 'R2', 'OBJ_ARB_THERMO', 'OBJ_ARB_THERMOBOARD'],
    ['MQ_8_03', 'LOC_ARB_GLUCOSE', null, 'OBJ_ARB_GLUCOSE', 'OBJ_ARB_GLUCOSEBOARD'],
    ['MQ_8_04', 'LOC_ARB_WATER', 'R4', 'OBJ_ARB_WATER', 'OBJ_ARB_WATERBOARD'],
    ['MQ_8_05', 'LOC_ARB_WORLD', null, 'OBJ_ARB_WORLD', 'OBJ_ARB_WORLDBOARD'],
  ];
  for (const [q, loc, tag, scanId, boardId] of trials) {
    if (state(q) === 'COMPLETED') continue;
    T.tpLoc(loc, 4, 8); T.step(20); await settle(); L(`${q} goto`);
    if (tag) await clear(tag);
    scan('trial', [scanId]); await settle(); L(`${q} fight + scan`);
    await solve(log, boardId); L(`${q} puzzle+quiz`);
  }
  if (state('MQ_8_06') !== 'COMPLETED') {
    T.tpLoc('LOC_ARB_ARENA', 4, 14); T.step(20); await settle(); L('arena goto');
    scan('seed', ['OBJ_ARB_SEED']); await settle(); L('seed scan');
    await bossFight(log, 'EN_BOSS_HERALD', 'R6', [0.75, 0.5, 0.25]);
    L('boss');
    log.push('healed flag ' + !!s.flags.arb_healed);
    T.tpLoc('LOC_ARB_HOOKIA_SEED', 2, 2);
    g().quests.interact('npc', 'NPC_HOOKIA_SEED');
    for (let i = 0; i < 4; i++) await settle();
    log.push('card: ' + (document.querySelector('.chapter-card')?.innerText.split('\n').slice(0, 2).join(' / ') ?? 'none'));
    await settle(); L('final exam');
    log.push('game_complete ' + !!s.flags.game_complete);
  }
});
