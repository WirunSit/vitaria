import { h, openModal } from './UI';
import { sfx } from '../core/Audio';

/** Puzzles of chapter 2 (genetics). Each resolves true when solved, false when the player backs out. */

const BASE_COLOR: Record<string, string> = { A: '#ff7a6a', T: '#ffd35a', C: '#7ae07a', G: '#6aa8ff' };
const PAIR: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };

/** Library door: build the complementary strand of a DNA template. */
export function runBasePairPuzzle(): Promise<boolean> {
  return new Promise((resolve) => {
    const template = Array.from({ length: 8 }, () => 'ATCG'[Math.floor(Math.random() * 4)]);
    const answer: (string | null)[] = template.map(() => null);
    const root = h(`<div class="quiz-wrap"><div class="quiz-card panel hex-bg" style="width:min(900px,94vw)">
      <div class="quiz-head"><span class="ctx">ปริศนา · ประตูรหัสเบสคู่</span><span>หอสมุดพันธุกรรม</span></div>
      <div class="quiz-stem" style="font-size:19px">ประตูจะเปิดเมื่อสร้าง <b style="color:var(--gold)">สายพอลินิวคลีโอไทด์ที่เป็นคู่สม</b> กับสายแม่แบบได้ถูกต้อง — คลิกช่องด้านล่างเพื่อเปลี่ยนเบส</div>
      <div class="bp-grid">
        <div class="bp-label">5′</div>${template.map((b) => `<div class="bp-tile" style="background:${BASE_COLOR[b]}">${b}</div>`).join('')}<div class="bp-label">3′</div>
        <div class="bp-label"></div>${template.map(() => '<div class="bp-bond">┊</div>').join('')}<div class="bp-label"></div>
        <div class="bp-label">3′</div>${template.map((_, i) => `<button class="bp-tile bp-slot" data-i="${i}">?</button>`).join('')}<div class="bp-label">5′</div>
      </div>
      <div class="quiz-explain" id="bp-msg" style="display:none"></div>
      <div class="quiz-foot"><div class="quiz-hint">💡 A คู่กับ T (พันธะไฮโดรเจน 2 พันธะ) · C คู่กับ G (3 พันธะ) · สองสายวางสลับทิศทางกัน</div>
        <div class="row"><button class="btn secondary small" id="bp-cancel">ไว้ทีหลัง</button><button class="btn" id="bp-ok">ตรวจคำตอบ</button></div></div>
    </div></div>`);
    const close = openModal(root);
    root.querySelectorAll<HTMLButtonElement>('.bp-slot').forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i);
      const order = ['A', 'T', 'C', 'G'];
      const next = order[(order.indexOf(answer[i] ?? 'G') + 1) % 4];
      answer[i] = next;
      b.textContent = next;
      b.style.background = BASE_COLOR[next];
      sfx.ui();
    });
    (root.querySelector('#bp-cancel') as HTMLButtonElement).onclick = () => { close(); resolve(false); };
    (root.querySelector('#bp-ok') as HTMLButtonElement).onclick = () => {
      const msg = root.querySelector('#bp-msg') as HTMLElement;
      msg.style.display = '';
      const wrong = template.map((b, i) => (answer[i] === PAIR[b] ? -1 : i)).filter((i) => i >= 0);
      root.querySelectorAll<HTMLElement>('.bp-slot').forEach((el, i) => el.classList.toggle('bad', wrong.includes(i)));
      if (wrong.length) {
        sfx.wrong();
        msg.innerHTML = `<div class="res" style="color:var(--bad)">✘ ยังมี ${wrong.length} ตำแหน่งที่จับคู่ผิด</div>ตรวจช่องที่มีกรอบแดงอีกครั้ง — เบสพิวรีน (A, G) ต้องจับคู่กับเบสไพริมิดีน (T, C) เสมอ`;
        return;
      }
      sfx.correct();
      msg.innerHTML = `<div class="res" style="color:var(--good)">✔ ประตูรหัสเปิดแล้ว!</div>สายคู่สมคือ 3′-${template.map((b) => PAIR[b]).join('')}-5′ — นี่คือหลักเดียวกับการจำลอง DNA: แต่ละสายเป็นแม่แบบให้สร้างสายใหม่ที่เป็นคู่สม`;
      const ok = root.querySelector('#bp-ok') as HTMLButtonElement;
      ok.textContent = 'เข้าสู่หอสมุด ▶';
      ok.onclick = () => { close(); resolve(true); };
    };
  });
}

interface Cross { gene: string; dom: string; rec: string; trait: string; p1: string; p2: string }
const CROSSES: Cross[] = [
  { gene: 'R', dom: 'เมล็ดกลม', rec: 'เมล็ดขรุขระ', trait: 'รูปร่างเมล็ด', p1: 'Rr', p2: 'Rr' },
  { gene: 'Y', dom: 'เมล็ดสีเหลือง', rec: 'เมล็ดสีเขียว', trait: 'สีเมล็ด', p1: 'Yy', p2: 'yy' },
  { gene: 'T', dom: 'ต้นสูง', rec: 'ต้นเตี้ย', trait: 'ความสูงของต้น', p1: 'Tt', p2: 'Tt' },
  { gene: 'P', dom: 'ดอกสีม่วง', rec: 'ดอกสีขาว', trait: 'สีดอก', p1: 'PP', p2: 'pp' },
];
const sortG = (a: string, b: string) => (a === a.toUpperCase() ? a + b : b + a);

/** Mendelion's pea bed: fill a Punnett square and read the phenotype ratio. */
export function runPunnettPuzzle(): Promise<boolean> {
  return new Promise((resolve) => {
    const c = CROSSES[Math.floor(Math.random() * CROSSES.length)];
    const g1 = [c.p1[0], c.p1[1]], g2 = [c.p2[0], c.p2[1]];
    const D = c.gene, r = c.gene.toLowerCase();
    const options = [D + D, D + r, r + r];
    const cells: (string | null)[] = [null, null, null, null];
    const truth = [0, 1, 2, 3].map((i) => sortG(g1[i % 2], g2[Math.floor(i / 2)]));
    const domCount = truth.filter((t) => t.includes(D)).length;
    const ratios = ['เด่นทั้งหมด (4 : 0)', 'เด่น : ด้อย = 3 : 1', 'เด่น : ด้อย = 1 : 1', 'ด้อยทั้งหมด (0 : 4)'];
    const right = domCount === 4 ? 0 : domCount === 3 ? 1 : domCount === 2 ? 2 : 3;
    const root = h(`<div class="quiz-wrap"><div class="quiz-card panel hex-bg" style="width:min(900px,94vw)">
      <div class="quiz-head"><span class="ctx">ปริศนา · ตารางพันเนตต์</span><span>เรือนกระจกของปราชญ์เมนเดลิออน</span></div>
      <div class="quiz-stem" style="font-size:19px">ลักษณะ<b>${c.trait}</b>: ${D} = ${c.dom} (เด่น), ${r} = ${c.rec} (ด้อย)<br>
        ผสมต้นถั่ว <b style="color:var(--gold)">${c.p1} × ${c.p2}</b> — เติมจีโนไทป์ของลูกในตาราง แล้วเลือกอัตราส่วนฟีโนไทป์</div>
      <div class="pn-wrap">
        <div class="pn-grid">
          <div class="pn-corner">♀ \\ ♂</div><div class="pn-head">${g1[0]}</div><div class="pn-head">${g1[1]}</div>
          <div class="pn-head">${g2[0]}</div><button class="pn-cell" data-i="0">?</button><button class="pn-cell" data-i="1">?</button>
          <div class="pn-head">${g2[1]}</div><button class="pn-cell" data-i="2">?</button><button class="pn-cell" data-i="3">?</button>
        </div>
        <div class="pn-ratios">${ratios.map((t, i) => `<label class="pn-ratio"><input type="radio" name="pn" value="${i}"> ${t}</label>`).join('')}</div>
      </div>
      <div class="quiz-explain" id="pn-msg" style="display:none"></div>
      <div class="quiz-foot"><div class="quiz-hint">💡 เซลล์สืบพันธุ์แต่ละเซลล์ได้รับอัลลีลเพียง 1 ตัวจากแต่ละคู่ (กฎการแยกตัว) — นำมาจับคู่กันในแต่ละช่อง</div>
        <div class="row"><button class="btn secondary small" id="pn-cancel">ไว้ทีหลัง</button><button class="btn" id="pn-ok">ตรวจคำตอบ</button></div></div>
    </div></div>`);
    const close = openModal(root);
    root.querySelectorAll<HTMLButtonElement>('.pn-cell').forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.i);
      const next = options[(options.indexOf(cells[i] ?? options[2]) + 1) % 3];
      cells[i] = next;
      b.textContent = next;
      b.classList.toggle('dom', next.includes(D));
      sfx.ui();
    });
    (root.querySelector('#pn-cancel') as HTMLButtonElement).onclick = () => { close(); resolve(false); };
    (root.querySelector('#pn-ok') as HTMLButtonElement).onclick = () => {
      const msg = root.querySelector('#pn-msg') as HTMLElement;
      msg.style.display = '';
      const wrong = truth.map((t, i) => (cells[i] === t ? -1 : i)).filter((i) => i >= 0);
      root.querySelectorAll<HTMLElement>('.pn-cell').forEach((el, i) => el.classList.toggle('bad', wrong.includes(i)));
      const picked = (root.querySelector('input[name="pn"]:checked') as HTMLInputElement | null)?.value;
      if (wrong.length) {
        sfx.wrong();
        msg.innerHTML = `<div class="res" style="color:var(--bad)">✘ ตารางยังมี ${wrong.length} ช่องที่ผิด</div>แต่ละช่องคืออัลลีลจากแถว (แม่) รวมกับอัลลีลจากคอลัมน์ (พ่อ)`;
        return;
      }
      if (picked === undefined || Number(picked) !== right) {
        sfx.wrong();
        msg.innerHTML = `<div class="res" style="color:var(--bad)">✘ ตารางถูกแล้ว แต่อัตราส่วนยังไม่ใช่</div>นับช่องที่มี <b>${D}</b> อย่างน้อย 1 ตัว (แสดงลักษณะเด่น) เทียบกับช่อง <b>${r}${r}</b> (แสดงลักษณะด้อย)`;
        return;
      }
      sfx.correct();
      const gt = [...new Set(truth)].map((t) => `${t} ${truth.filter((x) => x === t).length}`).join(' : ');
      msg.innerHTML = `<div class="res" style="color:var(--good)">✔ ถูกต้อง!</div>จีโนไทป์ของลูก = ${gt} · ฟีโนไทป์ ${ratios[right]} — ตรงกับที่เมนเดลสังเกตจากถั่วลันเตานับพันต้น`;
      const ok = root.querySelector('#pn-ok') as HTMLButtonElement;
      ok.textContent = 'เสร็จสิ้น ▶';
      ok.onclick = () => { close(); resolve(true); };
    };
  });
}

// ------------------------------------------------------------------ chapter 3 (evolution, biodiversity, ecology)

/** Shared shell for "pick an answer from a dropdown on every row" puzzles. */
function selectPuzzle(opts: {
  ctx: string; place: string; stem: string; hint: string;
  rows: { label: string; right: string }[]; options: string[];
  wrongMsg: (n: number) => string; okMsg: string; okBtn: string; extra?: string; checkExtra?: (root: HTMLElement) => string | null;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const root = h(`<div class="quiz-wrap"><div class="quiz-card panel hex-bg" style="width:min(900px,94vw)">
      <div class="quiz-head"><span class="ctx">ปริศนา · ${opts.ctx}</span><span>${opts.place}</span></div>
      <div class="quiz-stem" style="font-size:19px">${opts.stem}</div>
      <div class="sel-rows">${opts.rows.map((r, i) => `<div class="sel-row"><span>${r.label}</span>
        <select data-i="${i}"><option value="">— เลือก —</option>${opts.options.map((o) => `<option value="${o}">${o}</option>`).join('')}</select></div>`).join('')}</div>
      ${opts.extra ?? ''}
      <div class="quiz-explain" id="sp-msg" style="display:none"></div>
      <div class="quiz-foot"><div class="quiz-hint">💡 ${opts.hint}</div>
        <div class="row"><button class="btn secondary small" id="sp-cancel">ไว้ทีหลัง</button><button class="btn" id="sp-ok">ตรวจคำตอบ</button></div></div>
    </div></div>`);
    const close = openModal(root);
    (root.querySelector('#sp-cancel') as HTMLButtonElement).onclick = () => { close(); resolve(false); };
    (root.querySelector('#sp-ok') as HTMLButtonElement).onclick = () => {
      const msg = root.querySelector('#sp-msg') as HTMLElement;
      msg.style.display = '';
      const sels = [...root.querySelectorAll<HTMLSelectElement>('.sel-rows select')];
      const wrong = sels.filter((s, i) => s.value !== opts.rows[i].right);
      sels.forEach((s) => s.classList.toggle('bad', wrong.includes(s)));
      if (wrong.length) { sfx.wrong(); msg.innerHTML = `<div class="res" style="color:var(--bad)">✘ ยังไม่ถูก</div>${opts.wrongMsg(wrong.length)}`; return; }
      const extraErr = opts.checkExtra?.(root);
      if (extraErr) { sfx.wrong(); msg.innerHTML = `<div class="res" style="color:var(--bad)">✘ เกือบแล้ว</div>${extraErr}`; return; }
      sfx.correct();
      msg.innerHTML = `<div class="res" style="color:var(--good)">✔ ถูกต้อง!</div>${opts.okMsg}`;
      const ok = root.querySelector('#sp-ok') as HTMLButtonElement;
      ok.textContent = opts.okBtn;
      ok.onclick = () => { close(); resolve(true); };
    };
  });
}

/** Darwin's finches: match each beak to the food it is adapted for. */
export function runBeakPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'จะงอยปากกับอาหาร', place: 'เกาะนกฟินช์',
    stem: 'นกฟินช์บนแต่ละเกาะมี <b style="color:var(--gold)">จะงอยปากต่างกัน</b> จับคู่จะงอยปากกับอาหารที่เหมาะสมที่สุด',
    hint: 'รูปร่างที่เหมาะกับการหาอาหารช่วยให้อยู่รอดและสืบพันธุ์ได้มากกว่า',
    rows: [
      { label: '🐦 จะงอยปากหนา สั้น แข็งแรง', right: 'เมล็ดพืชเปลือกแข็ง' },
      { label: '🐦 จะงอยปากเรียว แหลม', right: 'แมลงตามซอกเปลือกไม้' },
      { label: '🐦 จะงอยปากยาว โค้งลง', right: 'น้ำหวานในดอกกระบองเพชร' },
    ],
    options: ['เมล็ดพืชเปลือกแข็ง', 'แมลงตามซอกเปลือกไม้', 'น้ำหวานในดอกกระบองเพชร'],
    wrongMsg: (n) => `มี ${n} คู่ที่ยังไม่เหมาะ ลองคิดว่าจะงอยปากแบบไหน "ใช้งาน" กับอาหารชนิดนั้นได้ดีที่สุด`,
    okMsg: 'นกที่มีจะงอยปากเหมาะกับอาหารบนเกาะของตัวเองอยู่รอดและมีลูกได้มากกว่า ลักษณะนั้นจึงถ่ายทอดสะสมรุ่นต่อรุ่น — นี่คือ <b>การคัดเลือกโดยธรรมชาติ</b> ที่ดาร์วินสังเกตจากหมู่เกาะกาลาปากอส',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

const ORGANISMS: [string, string][] = [
  ['🦠 แบคทีเรีย E. coli ในลำไส้', 'แบคทีเรีย'], ['♨️ จุลินทรีย์ในบ่อน้ำพุร้อนกรดจัด', 'อาร์เคีย'], ['🫧 อะมีบา', 'โพรทิสต์'],
  ['🍞 ราขนมปัง', 'ฟังไจ'], ['🍺 ยีสต์', 'ฟังไจ'], ['🌿 เฟิร์น', 'พืช'], ['🌱 มอส', 'พืช'], ['🧽 ฟองน้ำทะเล', 'สัตว์'], ['🪼 แมงกะพรุน', 'สัตว์'], ['🟢 พารามีเซียม', 'โพรทิสต์'],
];

/** Taxonomy Totem: sort organisms into their groups. */
export function runTaxonomyPuzzle(): Promise<boolean> {
  const pool = [...ORGANISMS].sort(() => Math.random() - 0.5).slice(0, 6);
  return selectPuzzle({
    ctx: 'เสาจัดหมวดหมู่', place: 'เกาะจัดหมวดหมู่',
    stem: 'จัดสิ่งมีชีวิตแต่ละชนิดเข้ากลุ่มให้ถูกต้อง — ระบบ 3 โดเมน: <b>แบคทีเรีย · อาร์เคีย · ยูแคริโอต</b> (ยูแคริโอตแบ่งเป็น โพรทิสต์ / ฟังไจ / พืช / สัตว์)',
    hint: 'ไม่มีนิวเคลียส = แบคทีเรียหรืออาร์เคีย · ย่อยอาหารภายนอกแล้วดูดซึม + ผนังเซลล์ไคทิน = ฟังไจ · สังเคราะห์ด้วยแสงและมีเนื้อเยื่อ = พืช',
    rows: pool.map(([label, right]) => ({ label, right })),
    options: ['แบคทีเรีย', 'อาร์เคีย', 'โพรทิสต์', 'ฟังไจ', 'พืช', 'สัตว์'],
    wrongMsg: (n) => `ยังจัดผิด ${n} ชนิด — เห็ดและราไม่ใช่พืชนะ! ส่วนฟองน้ำแม้ไม่ขยับก็เป็นสัตว์`,
    okMsg: 'เสาจัดหมวดหมู่เรืองแสงครบทุกชั้น! การจัดหมวดหมู่ช่วยให้เราเข้าใจความสัมพันธ์ทางวิวัฒนาการ และตั้งชื่อวิทยาศาสตร์แบบทวินาม (สกุล + คำระบุชนิด) ที่ใช้ได้ทั่วโลก',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Food-web stone circle: assign trophic levels and apply the 10% rule. */
export function runPyramidPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'พีระมิดพลังงาน', place: 'เกาะสายใยอาหาร',
    stem: 'โซ่อาหารบนเกาะ: <b>หญ้า → ตั๊กแตน → กบ → งู</b> และมีเห็ดราย่อยสลายซากทั้งหมด<br>จัดแต่ละชนิดให้ตรงกับระดับในระบบนิเวศ แล้วคำนวณพลังงานที่ถึงงู',
    hint: 'พลังงานถ่ายทอดไปลำดับถัดไปได้ประมาณ 10% ที่เหลือสูญเสียเป็นความร้อนจากการหายใจระดับเซลล์',
    rows: [
      { label: '🌾 หญ้า', right: 'ผู้ผลิต' }, { label: '🦗 ตั๊กแตน', right: 'ผู้บริโภคลำดับที่ 1' },
      { label: '🐸 กบ', right: 'ผู้บริโภคลำดับที่ 2' }, { label: '🐍 งู', right: 'ผู้บริโภคลำดับที่ 3' }, { label: '🍄 เห็ดรา', right: 'ผู้ย่อยสลาย' },
    ],
    options: ['ผู้ผลิต', 'ผู้บริโภคลำดับที่ 1', 'ผู้บริโภคลำดับที่ 2', 'ผู้บริโภคลำดับที่ 3', 'ผู้ย่อยสลาย'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>⚡ หญ้าตรึงพลังงานได้ 10,000 กิโลจูล งูจะได้รับประมาณ</span>
      <select id="pyr-e"><option value="">— เลือก —</option><option>1,000 กิโลจูล</option><option>100 กิโลจูล</option><option>10 กิโลจูล</option><option>1 กิโลจูล</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#pyr-e') as HTMLSelectElement).value === '10 กิโลจูล' ? null : 'ระดับถูกแล้ว แต่พลังงานยังไม่ใช่ — 10,000 → ตั๊กแตน 1,000 → กบ 100 → งู ?'),
    wrongMsg: (n) => `ยังมี ${n} ชนิดอยู่ผิดระดับ — ผู้ผลิตสร้างอาหารเองได้ ผู้ย่อยสลายย่อยซากทุกระดับ`,
    okMsg: 'งูได้รับพลังงานเพียงประมาณ 10 กิโลจูล — เพราะพลังงานลดลงทุกลำดับ ผู้ล่าลำดับสูงจึงมีจำนวนน้อย และระบบนิเวศต้องมีผู้ผลิตมากที่สุดเสมอ',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

// ------------------------------------------------------------------ chapter 4 (plants: tissues, flowers, photosynthesis, hormones)

/** Great Xylem Tree: match each plant tissue to its job. */
export function runTissuePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'เนื้อเยื่อพืช', place: 'ต้นไซเลมยักษ์',
    stem: 'ต้นไม้ยักษ์ "หยุดหายใจ" เพราะท่อลำเลียงถูกอุด จับคู่ <b style="color:var(--gold)">เนื้อเยื่อ</b> แต่ละชนิดกับหน้าที่ให้ถูก เพื่อเปิดทางให้น้ำและอาหารไหลอีกครั้ง',
    hint: 'ไซเลมลำเลียงขึ้น (น้ำ + แร่ธาตุ) · โฟลเอ็มลำเลียงได้ 2 ทิศ (อาหาร) · เนื้อเยื่อเจริญแบ่งเซลล์ได้ตลอด',
    rows: [
      { label: '💧 ไซเลม (Xylem)', right: 'ลำเลียงน้ำและแร่ธาตุจากรากขึ้นสู่ใบ' },
      { label: '🍯 โฟลเอ็ม (Phloem)', right: 'ลำเลียงน้ำตาลจากใบไปส่วนต่าง ๆ' },
      { label: '🌱 เนื้อเยื่อเจริญปลายราก/ยอด', right: 'แบ่งเซลล์ทำให้รากและลำต้นยาวขึ้น' },
      { label: '🍃 เซลล์คุม (Guard cell)', right: 'ควบคุมการเปิด–ปิดปากใบ' },
      { label: '🛡️ เอพิเดอร์มิส', right: 'ปกคลุมผิวนอก ลดการสูญเสียน้ำ' },
    ],
    options: ['ลำเลียงน้ำและแร่ธาตุจากรากขึ้นสู่ใบ', 'ลำเลียงน้ำตาลจากใบไปส่วนต่าง ๆ', 'แบ่งเซลล์ทำให้รากและลำต้นยาวขึ้น', 'ควบคุมการเปิด–ปิดปากใบ', 'ปกคลุมผิวนอก ลดการสูญเสียน้ำ'],
    wrongMsg: (n) => `ยังมี ${n} เนื้อเยื่อที่จับคู่ผิด — นึกถึงสีของท่อในหน้าต่างต้นไม้: น้ำสีฟ้าไหลขึ้น น้ำตาลสีอำพันไหลลง`,
    okMsg: 'ท่อลำเลียงเปิดแล้ว! น้ำถูก "ดึง" ขึ้นทางไซเลมด้วยแรงดึงจากการคายน้ำ (transpiration pull) ร่วมกับแรงโคฮีชันและแอดฮีชัน ส่วนน้ำตาลจากการสังเคราะห์ด้วยแสงไหลทางโฟลเอ็มจากแหล่งสร้าง (source) ไปแหล่งใช้ (sink)',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Giant flower: name each part's role, then pick what double fertilisation produces. */
export function runFlowerPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'โครงสร้างดอก', place: 'ทุ่งดอกไม้ยักษ์',
    stem: 'ดอกไม้ยักษ์บานแล้วแต่ <b style="color:var(--gold)">ไม่ติดผล</b> ระบุหน้าที่ของแต่ละส่วนของดอก แล้วตอบว่าเกิดอะไรขึ้นหลังการปฏิสนธิซ้อน',
    hint: 'เกสรเพศผู้ = อับเรณู + ก้านชูอับเรณู · เกสรเพศเมีย = ยอดเกสร + ก้านเกสร + รังไข่ (มีออวุล)',
    rows: [
      { label: '🌼 อับเรณู (Anther)', right: 'สร้างละอองเรณู' },
      { label: '🎯 ยอดเกสรเพศเมีย (Stigma)', right: 'รับละอองเรณู' },
      { label: '🫙 รังไข่ (Ovary)', right: 'เจริญเป็นผล' },
      { label: '🥚 ออวุล (Ovule)', right: 'เจริญเป็นเมล็ด' },
      { label: '🌸 กลีบดอก (Petal)', right: 'ล่อแมลงผสมเกสร' },
    ],
    options: ['สร้างละอองเรณู', 'รับละอองเรณู', 'เจริญเป็นผล', 'เจริญเป็นเมล็ด', 'ล่อแมลงผสมเกสร'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🧬 ปฏิสนธิซ้อน: สเปิร์มตัวที่ 2 + โพลาร์นิวเคลียส 2 นิวเคลียส ได้</span>
      <select id="flw-e"><option value="">— เลือก —</option><option>ไซโกต (2n)</option><option>เอนโดสเปิร์ม (3n)</option><option>เปลือกเมล็ด (2n)</option><option>ละอองเรณู (n)</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#flw-e') as HTMLSelectElement).value === 'เอนโดสเปิร์ม (3n)' ? null : 'ส่วนของดอกถูกหมดแล้ว แต่ผลของปฏิสนธิซ้อนยังไม่ใช่ — n + n + n = ?'),
    wrongMsg: (n) => `ยังผิด ${n} ส่วน — จำไว้: รังไข่ → ผล · ออวุล → เมล็ด`,
    okMsg: 'ดอกไม้ยักษ์เริ่มติดผล! ในพืชดอก สเปิร์มตัวที่ 1 ผสมกับเซลล์ไข่ได้ <b>ไซโกต (2n)</b> → เอ็มบริโอ ส่วนสเปิร์มตัวที่ 2 ผสมกับโพลาร์นิวเคลียส 2 นิวเคลียสได้ <b>เอนโดสเปิร์ม (3n)</b> → อาหารสะสมในเมล็ด',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Sun terraces: classify each crop as C3 / C4 / CAM and say where the Calvin cycle runs. */
export function runPhotoPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'การสังเคราะห์ด้วยแสง', place: 'ลานขั้นบันไดแสงตะวัน',
    stem: 'นาฬิกาแดดจะเรืองแสงเมื่อจัดพืชแต่ละชนิดเข้ากลุ่ม <b style="color:var(--gold)">C3 · C4 · CAM</b> ได้ถูก แล้วตอบว่าวัฏจักรคัลวินเกิดที่ใด',
    hint: 'C4 ตรึง CO₂ ครั้งแรกในเซลล์มีโซฟิลล์ แล้วส่งไปบันเดิลชีท · CAM เปิดปากใบกลางคืน (พืชทะเลทราย/อวบน้ำ)',
    rows: [
      { label: '🌾 ข้าว', right: 'C3' }, { label: '🌽 ข้าวโพด', right: 'C4' }, { label: '🍍 สับปะรด', right: 'CAM' },
      { label: '🎋 อ้อย', right: 'C4' }, { label: '🌵 กระบองเพชร', right: 'CAM' }, { label: '🫘 ถั่วเหลือง', right: 'C3' },
    ],
    options: ['C3', 'C4', 'CAM'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🔄 วัฏจักรคัลวิน (ตรึง CO₂ ด้วยรูบิสโก) เกิดขึ้นที่</span>
      <select id="ps-e"><option value="">— เลือก —</option><option>ไทลาคอยด์</option><option>สโตรมา</option><option>ไมโทคอนเดรีย</option><option>นิวเคลียส</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#ps-e') as HTMLSelectElement).value === 'สโตรมา' ? null : 'จัดกลุ่มพืชถูกหมดแล้ว! แต่ตำแหน่งของวัฏจักรคัลวินยังไม่ใช่ — ปฏิกิริยาแสงอยู่ที่ไทลาคอยด์ แล้ววัฏจักรคัลวินล่ะ?'),
    wrongMsg: (n) => `ยังจัดผิด ${n} ชนิด — หญ้าเขตร้อนที่โตเร็ว (ข้าวโพด อ้อย) มักเป็น C4 · พืชอวบน้ำทนแล้งเป็น CAM`,
    okMsg: 'นาฬิกาแดดเรืองแสงแล้ว! <b>C3</b> ตรึง CO₂ ด้วยรูบิสโกโดยตรงจึงเกิดโฟโตเรสไพเรชันได้ง่ายเมื่ออากาศร้อน · <b>C4</b> แยก "สถานที่" (มีโซฟิลล์ → บันเดิลชีท) · <b>CAM</b> แยก "เวลา" (ตรึง CO₂ กลางคืน ใช้กลางวัน) ช่วยประหยัดน้ำ',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Nursery bench: which hormone does each job? */
export function runHormonePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ฮอร์โมนพืช', place: 'เรือนเพาะชำ',
    stem: 'ขวดฮอร์โมน 5 สีบนโต๊ะของลินนาร่าหลุดฉลาก! จับคู่ <b style="color:var(--gold)">ผลที่สังเกตได้</b> กับฮอร์โมนที่เป็นสาเหตุ',
    hint: 'ออกซิน = ปลายยอด/โค้งเข้าหาแสง · จิบเบอเรลลิน = ยืดลำต้น/งอก · ไซโทไคนิน = แบ่งเซลล์ · เอทิลีน = แก๊สบ่มผล · ABA = เครียดแล้ง',
    rows: [
      { label: '🌱 ยอดอ่อนโค้งเข้าหาแสง', right: 'ออกซิน' },
      { label: '🍇 ผลองุ่นไร้เมล็ดขยายใหญ่ ลำต้นยืดยาว', right: 'จิบเบอเรลลิน' },
      { label: '🧫 กระตุ้นการแบ่งเซลล์ ชะลอใบแก่', right: 'ไซโทไคนิน' },
      { label: '🍌 เร่งการสุกของผลไม้ (เป็นแก๊ส)', right: 'เอทิลีน' },
      { label: '🏜️ ปิดปากใบเมื่อขาดน้ำ ทำให้เมล็ดพักตัว', right: 'กรดแอบไซซิก' },
    ],
    options: ['ออกซิน', 'จิบเบอเรลลิน', 'ไซโทไคนิน', 'เอทิลีน', 'กรดแอบไซซิก'],
    wrongMsg: (n) => `ยังผิด ${n} ขวด — เอทิลีนเป็นฮอร์โมนพืชชนิดเดียวที่เป็นแก๊ส`,
    okMsg: 'ฉลากกลับมาครบ! ฮอร์โมนพืชทำงานร่วมกันเสมอ เช่น สัดส่วน <b>ออกซิน : ไซโทไคนิน</b> ในการเพาะเลี้ยงเนื้อเยื่อ — ออกซินสูงกระตุ้นราก ไซโทไคนินสูงกระตุ้นยอด',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

// ------------------------------------------------------------------ chapter 5 (digestion, breathing, cellular respiration)

/** Digestive tunnel: match each organ to its job, then the end products of fat digestion. */
export function runDigestPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบย่อยอาหาร', place: 'อุโมงค์ย่อยอาหาร',
    stem: 'อาหารที่ส่งเข้าเตาหลอมติดค้างอยู่ในอุโมงค์! จับคู่ <b style="color:var(--gold)">อวัยวะ</b> กับหน้าที่ให้ถูก เพื่อให้สารอาหารไหลไปถึงเตาอีกครั้ง',
    hint: 'แป้งเริ่มย่อยที่ปาก · โปรตีนเริ่มย่อยที่กระเพาะ · ไขมันย่อยที่ลำไส้เล็ก (มีน้ำดีช่วย) · ลำไส้ใหญ่ไม่มีเอนไซม์ย่อย',
    rows: [
      { label: '👄 ปาก (ต่อมน้ำลาย)', right: 'อะไมเลสย่อยแป้ง' },
      { label: '🫃 กระเพาะอาหาร', right: 'เพปซินย่อยโปรตีนในสภาพกรด' },
      { label: '🟤 ตับ', right: 'สร้างน้ำดี ทำให้ไขมันแตกเป็นหยดเล็ก' },
      { label: '🟠 ตับอ่อน', right: 'สร้างเอนไซม์ย่อยแป้ง โปรตีน และไขมันส่งเข้าลำไส้เล็ก' },
      { label: '🌀 ลำไส้เล็ก (วิลลัส)', right: 'ดูดซึมสารอาหารเข้าสู่เลือด' },
      { label: '🟫 ลำไส้ใหญ่', right: 'ดูดน้ำกลับ' },
    ],
    options: ['อะไมเลสย่อยแป้ง', 'เพปซินย่อยโปรตีนในสภาพกรด', 'สร้างน้ำดี ทำให้ไขมันแตกเป็นหยดเล็ก', 'สร้างเอนไซม์ย่อยแป้ง โปรตีน และไขมันส่งเข้าลำไส้เล็ก', 'ดูดซึมสารอาหารเข้าสู่เลือด', 'ดูดน้ำกลับ'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🧈 ไขมันถูกย่อยจนสุดท้ายได้</span>
      <select id="dg-e"><option value="">— เลือก —</option><option>กรดอะมิโน</option><option>กลีเซอรอลและกรดไขมัน</option><option>กลูโคส</option><option>นิวคลีโอไทด์</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#dg-e') as HTMLSelectElement).value === 'กลีเซอรอลและกรดไขมัน' ? null : 'อวัยวะถูกหมดแล้ว แต่ผลการย่อยไขมันยังไม่ใช่ — ไลเพสตัดไขมันออกเป็น 2 ส่วนอะไร?'),
    wrongMsg: (n) => `ยังผิด ${n} อวัยวะ — น้ำดีไม่ใช่เอนไซม์นะ มันแค่ช่วยให้ไขมันแตกตัว`,
    okMsg: 'อาหารไหลผ่านอุโมงค์ได้แล้ว! แป้ง → กลูโคส · โปรตีน → กรดอะมิโน · ไขมัน → กลีเซอรอล + กรดไขมัน แล้วถูกดูดซึมผ่าน <b>วิลลัส</b> ที่เพิ่มพื้นที่ผิวของลำไส้เล็กหลายร้อยเท่า — กลูโคสคือเชื้อเพลิงของเตาหลอมไมโทคอนเดรีย',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Bellows-lungs: what the diaphragm, chest volume and lung pressure do when breathing in / out; how gases cross. */
export function runBreathPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบหายใจ', place: 'โรงสูบลมปอดยักษ์',
    stem: 'ปอดยักษ์สูบลมผิดจังหวะ! บอกว่า <b style="color:var(--gold)">ตอนหายใจเข้าและหายใจออก</b> เกิดอะไรขึ้น แล้วตอบว่าแก๊สผ่านถุงลมได้อย่างไร',
    hint: 'หายใจเข้า: กล้ามเนื้อหดตัว ช่องอกขยาย ความดันในปอดลด อากาศจึงไหลเข้า · หายใจออก: กล้ามเนื้อคลายตัว กลับกัน',
    rows: [
      { label: '🫁 หายใจเข้า · กะบังลม', right: 'หดตัว แบนราบลง' },
      { label: '🫁 หายใจเข้า · ปริมาตรช่องอก', right: 'เพิ่มขึ้น' },
      { label: '🫁 หายใจเข้า · ความดันในปอด', right: 'ต่ำกว่าความดันบรรยากาศ' },
      { label: '💨 หายใจออก · กะบังลม', right: 'คลายตัว โค้งขึ้น' },
      { label: '💨 หายใจออก · ปริมาตรช่องอก', right: 'ลดลง' },
    ],
    options: ['หดตัว แบนราบลง', 'คลายตัว โค้งขึ้น', 'เพิ่มขึ้น', 'ลดลง', 'ต่ำกว่าความดันบรรยากาศ', 'สูงกว่าความดันบรรยากาศ'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🫧 O₂ และ CO₂ ผ่านผนังถุงลมกับหลอดเลือดฝอยโดย</span>
      <select id="br-e"><option value="">— เลือก —</option><option>การแพร่</option><option>ออสโมซิส</option><option>การลำเลียงแบบใช้พลังงาน</option><option>ฟาโกไซโทซิส</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#br-e') as HTMLSelectElement).value === 'การแพร่' ? null : 'จังหวะถูกหมดแล้ว แต่วิธีที่แก๊สผ่านถุงลมยังไม่ใช่ — แก๊สเคลื่อนจากที่ความเข้มข้นสูงไปต่ำเอง ไม่ต้องใช้พลังงาน'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — อากาศไหลจากที่ความดันสูงไปที่ความดันต่ำเสมอ`,
    okMsg: 'ปอดยักษ์กลับมาสูบลมเป็นจังหวะ! ที่ <b>ถุงลม</b> O₂ แพร่เข้าสู่เลือด (ความเข้มข้นในถุงลมสูงกว่า) และ CO₂ แพร่ออกจากเลือด — ถุงลมนับร้อยล้านถุงมีผนังบางเพียงชั้นเดียว ล้อมด้วยหลอดเลือดฝอย ทำให้แลกเปลี่ยนแก๊สได้เร็ว',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Glycolysis conveyor: where each stage of respiration happens, and what glycolysis nets. */
export function runGlycoPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'การหายใจระดับเซลล์', place: 'สายพานไกลโคไลซิส',
    stem: 'สายพานส่งน้ำตาลไปผิดห้อง! ระบุว่า <b style="color:var(--gold)">แต่ละขั้นของการหายใจระดับเซลล์</b> เกิดขึ้นที่ส่วนใดของเซลล์',
    hint: 'ไกลโคไลซิสไม่ต้องใช้ O₂ และเกิดนอกไมโทคอนเดรีย · ขั้นที่ใช้เยื่อพับซ้อน (คริสตี) คือขั้นสุดท้าย',
    rows: [
      { label: '🍬 ไกลโคไลซิส', right: 'ไซโทพลาซึม' },
      { label: '🔗 การสร้างแอซิทิลโคเอนไซม์เอ', right: 'เมทริกซ์ของไมโทคอนเดรีย' },
      { label: '🔄 วัฏจักรเครบส์', right: 'เมทริกซ์ของไมโทคอนเดรีย' },
      { label: '⚡ การถ่ายทอดอิเล็กตรอน', right: 'เยื่อหุ้มชั้นในของไมโทคอนเดรีย' },
      { label: '🥛 การหมักกรดแลกติก', right: 'ไซโทพลาซึม' },
    ],
    options: ['ไซโทพลาซึม', 'เมทริกซ์ของไมโทคอนเดรีย', 'เยื่อหุ้มชั้นในของไมโทคอนเดรีย', 'เยื่อหุ้มชั้นนอกของไมโทคอนเดรีย'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🍬 ไกลโคไลซิส: กลูโคส 1 โมเลกุลได้</span>
      <select id="gl-e"><option value="">— เลือก —</option><option>ไพรูเวต 2 โมเลกุล + ATP สุทธิ 2</option><option>ไพรูเวต 2 โมเลกุล + ATP สุทธิ 36</option><option>ไพรูเวต 1 โมเลกุล + ATP สุทธิ 2</option><option>CO₂ 6 โมเลกุล + ATP สุทธิ 4</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#gl-e') as HTMLSelectElement).value === 'ไพรูเวต 2 โมเลกุล + ATP สุทธิ 2' ? null : 'ตำแหน่งถูกหมดแล้ว แต่ผลของไกลโคไลซิสยังไม่ใช่ — กลูโคสมี 6 คาร์บอน ไพรูเวตมี 3 คาร์บอน'),
    wrongMsg: (n) => `ยังผิด ${n} ขั้น — มีเพียงไกลโคไลซิส (และการหมัก) ที่เกิดนอกไมโทคอนเดรีย`,
    okMsg: 'สายพานส่งน้ำตาลถูกห้องแล้ว! กลูโคส (6C) แตกเป็น <b>ไพรูเวต 2 โมเลกุล (3C)</b> ได้ ATP สุทธิ 2 และ NADH 2 ในไซโทพลาซึม จากนั้นไพรูเวตเข้าไมโทคอนเดรียกลายเป็นแอซิทิลโคเอ แล้วเข้าวัฏจักรเครบส์',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Krebs wheel: the electron transport chain, ATP synthase and fermentation. */
export function runKrebsPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'วัฏจักรเครบส์และการถ่ายทอดอิเล็กตรอน', place: 'วงล้อเครบส์',
    stem: 'วงล้อเครบส์หมุนแล้ว แต่พลังงานยังไปไม่ถึงเตา! จับคู่ <b style="color:var(--gold)">ส่วนของระบบ</b> ให้ถูก แล้วตอบว่าซินดิเคตทำอะไรกับเตาหลอม',
    hint: 'NADH/FADH₂ พาอิเล็กตรอนไปลูกโซ่ · ปลายลูกโซ่อิเล็กตรอนรวมกับ O₂ ได้น้ำ · H⁺ ไหลกลับผ่านเอนไซม์ที่หมุนได้',
    rows: [
      { label: '🎯 ตัวรับอิเล็กตรอนตัวสุดท้าย', right: 'ออกซิเจน (เกิดน้ำ)' },
      { label: '🔋 ตัวพาอิเล็กตรอนจากวัฏจักรเครบส์', right: 'NADH และ FADH₂' },
      { label: '⚙️ เอนไซม์ที่สร้าง ATP เมื่อ H⁺ ไหลผ่าน', right: 'ATP ซินเทส' },
      { label: '💨 CO₂ ที่เราหายใจออกเกิดจาก', right: 'การสลายไพรูเวตและวัฏจักรเครบส์' },
      { label: '🍺 ยีสต์ที่ขาดออกซิเจน', right: 'การหมักแอลกอฮอล์ (เอทานอล + CO₂)' },
    ],
    options: ['ออกซิเจน (เกิดน้ำ)', 'NADH และ FADH₂', 'ATP ซินเทส', 'การสลายไพรูเวตและวัฏจักรเครบส์', 'การหมักแอลกอฮอล์ (เอทานอล + CO₂)'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>☠️ ไซยาไนด์ยับยั้งปลายลูกโซ่การถ่ายทอดอิเล็กตรอน ทำให้</span>
      <select id="kr-e"><option value="">— เลือก —</option><option>เซลล์ใช้ O₂ ไม่ได้ ATP ลดลงอย่างรวดเร็ว</option><option>เซลล์สร้าง ATP ได้มากขึ้น</option><option>เซลล์สังเคราะห์กลูโคสเพิ่ม</option><option>ไม่มีผลต่อการสร้าง ATP</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#kr-e') as HTMLSelectElement).value === 'เซลล์ใช้ O₂ ไม่ได้ ATP ลดลงอย่างรวดเร็ว' ? null : 'ระบบถูกหมดแล้ว แต่ผลของไซยาไนด์ยังไม่ใช่ — ถ้าอิเล็กตรอนส่งต่อให้ O₂ ไม่ได้ ลูกโซ่ทั้งสายจะเป็นอย่างไร?'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — ATP ส่วนใหญ่ (~26–28 จาก ~30–32 ต่อกลูโคส) มาจากขั้นการถ่ายทอดอิเล็กตรอน`,
    okMsg: 'ความลับของเตาที่มอดดับ: ซินดิเคตใช้ <b>สารยับยั้งแบบไซยาไนด์</b> ปิดปลายลูกโซ่การถ่ายทอดอิเล็กตรอน! อิเล็กตรอนส่งต่อให้ O₂ ไม่ได้ ปั๊ม H⁺ หยุด ATP ซินเทสจึงหยุดหมุน — แม้จะมีทั้งกลูโคสและออกซิเจนครบก็ตาม',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

// ------------------------------------------------------------------ chapter 6 (circulation, blood, immunity, excretion)

/** Heart temple: where does the blood go next? (double circulation) + the thickest wall. */
export function runHeartPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบหมุนเวียนเลือด', place: 'วิหารหัวใจ',
    stem: 'ลิ้นหัวใจของวิหารพัง เลือดไหลวน! บอกว่า <b style="color:var(--gold)">จากแต่ละห้อง เลือดต้องไหลไปที่ใดต่อ</b> เพื่อซ่อมทางไหลให้ถูกทิศ',
    hint: 'เลือดจากร่างกายเข้าหัวใจซีกขวา → ไปปอด → กลับเข้าซีกซ้าย → ออกไปทั่วร่างกาย · ห้องบนส่งลงห้องล่างซีกเดียวกันเสมอ',
    rows: [
      { label: '❤️ หัวใจห้องบนขวา (รับเลือดจากร่างกาย)', right: 'หัวใจห้องล่างขวา' },
      { label: '❤️ หัวใจห้องล่างขวา', right: 'ปอด (ทางหลอดเลือดแดงพัลโมนารี)' },
      { label: '🫁 ปอด', right: 'หัวใจห้องบนซ้าย (ทางหลอดเลือดดำพัลโมนารี)' },
      { label: '❤️ หัวใจห้องบนซ้าย', right: 'หัวใจห้องล่างซ้าย' },
      { label: '❤️ หัวใจห้องล่างซ้าย', right: 'ทั่วร่างกาย (ทางเอออร์ตา)' },
    ],
    options: ['หัวใจห้องล่างขวา', 'ปอด (ทางหลอดเลือดแดงพัลโมนารี)', 'หัวใจห้องบนซ้าย (ทางหลอดเลือดดำพัลโมนารี)', 'หัวใจห้องล่างซ้าย', 'ทั่วร่างกาย (ทางเอออร์ตา)'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>💪 ห้องที่มีผนังกล้ามเนื้อหนาที่สุดคือ</span>
      <select id="ht-e"><option value="">— เลือก —</option><option>หัวใจห้องบนขวา</option><option>หัวใจห้องล่างขวา</option><option>หัวใจห้องบนซ้าย</option><option>หัวใจห้องล่างซ้าย</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#ht-e') as HTMLSelectElement).value === 'หัวใจห้องล่างซ้าย' ? null : 'ทางไหลถูกหมดแล้ว แต่ห้องที่ผนังหนาที่สุดยังไม่ใช่ — ห้องไหนต้องสูบแรงพอส่งเลือดไปทั้งร่างกาย?'),
    wrongMsg: (n) => `ยังผิด ${n} ทาง — จำไว้: หลอดเลือดที่ออกจากหัวใจเรียกว่าหลอดเลือดแดงเสมอ แม้หลอดเลือดแดงพัลโมนารีจะนำเลือดที่มี O₂ ต่ำก็ตาม`,
    okMsg: 'ลิ้นหัวใจปิด-เปิดเป็นจังหวะอีกครั้ง! นี่คือ <b>การหมุนเวียนเลือดสองวงจร</b>: วงจรปอด (หัวใจขวา → ปอด → หัวใจซ้าย) และวงจรร่างกาย (หัวใจซ้าย → ร่างกาย → หัวใจขวา) ลิ้นหัวใจกั้นไม่ให้เลือดไหลย้อน — วิลเลียม ฮาร์วีย์ พิสูจน์เรื่องนี้เมื่อ ค.ศ. 1628',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Vessel quarter: blood components and vessel types; blood group O. */
export function runBloodPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'เลือดและหลอดเลือด', place: 'ย่านคลองแดง-คลองน้ำเงิน',
    stem: 'ประตูน้ำของย่านคลองสับสนไปหมด! จับคู่ <b style="color:var(--gold)">ส่วนประกอบของเลือดและหลอดเลือด</b> กับหน้าที่ให้ถูก',
    hint: 'เม็ดเลือดแดงมีฮีโมโกลบิน · เกล็ดเลือดเกี่ยวกับแผล · หลอดเลือดดำมีลิ้น · หลอดเลือดฝอยผนังบางชั้นเดียว',
    rows: [
      { label: '🔴 เม็ดเลือดแดง', right: 'ลำเลียง O₂ ด้วยฮีโมโกลบิน' },
      { label: '⚪ เม็ดเลือดขาว', right: 'ต่อสู้และทำลายเชื้อโรค' },
      { label: '🩹 เกล็ดเลือด', right: 'ช่วยให้เลือดแข็งตัวเมื่อเกิดบาดแผล' },
      { label: '💧 พลาสมา', right: 'ลำเลียงสารอาหาร ฮอร์โมน และของเสียที่ละลายน้ำ' },
      { label: '🟥 หลอดเลือดแดง', right: 'นำเลือดออกจากหัวใจ ผนังหนายืดหยุ่น' },
      { label: '🟦 หลอดเลือดดำ', right: 'นำเลือดกลับหัวใจ มีลิ้นกันเลือดไหลย้อน' },
      { label: '🕸️ หลอดเลือดฝอย', right: 'แลกเปลี่ยนสารกับเซลล์ ผนังบางชั้นเดียว' },
    ],
    options: ['ลำเลียง O₂ ด้วยฮีโมโกลบิน', 'ต่อสู้และทำลายเชื้อโรค', 'ช่วยให้เลือดแข็งตัวเมื่อเกิดบาดแผล', 'ลำเลียงสารอาหาร ฮอร์โมน และของเสียที่ละลายน้ำ', 'นำเลือดออกจากหัวใจ ผนังหนายืดหยุ่น', 'นำเลือดกลับหัวใจ มีลิ้นกันเลือดไหลย้อน', 'แลกเปลี่ยนสารกับเซลล์ ผนังบางชั้นเดียว'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🩸 เม็ดเลือดแดงของคนหมู่เลือด O มีแอนติเจน</span>
      <select id="bl-e"><option value="">— เลือก —</option><option>แอนติเจน A</option><option>แอนติเจน B</option><option>ทั้ง A และ B</option><option>ไม่มีทั้ง A และ B</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#bl-e') as HTMLSelectElement).value === 'ไม่มีทั้ง A และ B' ? null : 'ส่วนประกอบถูกหมดแล้ว แต่แอนติเจนของหมู่เลือด O ยังไม่ใช่ — ทำไมหมู่ O จึงเป็น "ผู้ให้" เม็ดเลือดแดงได้กว้างที่สุด?'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — เม็ดเลือดแดงของคนไม่มีนิวเคลียส จึงมีที่ว่างบรรจุฮีโมโกลบินได้มาก`,
    okMsg: 'ประตูน้ำเปิดถูกทางแล้ว! เลือดประกอบด้วย <b>พลาสมา (~55%)</b> และ <b>เซลล์เม็ดเลือด (~45%)</b> หลอดเลือดแดงพาเลือดออกจากหัวใจภายใต้ความดันสูง หลอดเลือดดำพากลับโดยมีลิ้นช่วย ส่วนหลอดเลือดฝอยคือจุดแลกเปลี่ยนสารจริง ๆ',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** White-blood-cell fortress: who does what in the immune response; what a vaccine does. */
export function runImmunePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบภูมิคุ้มกัน', place: 'ป้อมเม็ดเลือดขาว',
    stem: 'ทหารเม็ดเลือดขาวสับสนหน้าที่กันหมด! มอบหมาย <b style="color:var(--gold)">หน้าที่</b> ให้แต่ละหน่วยรบให้ถูก',
    hint: 'ด่านแรก: ผิวหนัง เมือก · แบบไม่จำเพาะ: แมโครฟาจกลืนกิน · แบบจำเพาะ: เซลล์บีสร้างแอนติบอดี เซลล์ทีพิฆาตทำลายเซลล์ติดเชื้อ',
    rows: [
      { label: '🛡️ ผิวหนังและเมือก', right: 'ด่านแรกที่กั้นเชื้อโรคไม่ให้เข้าร่างกาย' },
      { label: '🍽️ แมโครฟาจ', right: 'กลืนกินเชื้อโรคด้วยฟาโกไซโทซิส' },
      { label: '🎯 เซลล์บี (พลาสมาเซลล์)', right: 'สร้างแอนติบอดีที่จับกับแอนติเจนจำเพาะ' },
      { label: '📣 เซลล์ทีผู้ช่วย', right: 'กระตุ้นเซลล์บีและเซลล์ทีพิฆาต' },
      { label: '⚔️ เซลล์ทีพิฆาต', right: 'ทำลายเซลล์ร่างกายที่ติดเชื้อไวรัส' },
      { label: '🧠 เซลล์ความจำ', right: 'จดจำเชื้อ ตอบสนองได้เร็วและแรงในครั้งต่อไป' },
    ],
    options: ['ด่านแรกที่กั้นเชื้อโรคไม่ให้เข้าร่างกาย', 'กลืนกินเชื้อโรคด้วยฟาโกไซโทซิส', 'สร้างแอนติบอดีที่จับกับแอนติเจนจำเพาะ', 'กระตุ้นเซลล์บีและเซลล์ทีพิฆาต', 'ทำลายเซลล์ร่างกายที่ติดเชื้อไวรัส', 'จดจำเชื้อ ตอบสนองได้เร็วและแรงในครั้งต่อไป'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>💉 วัคซีนป้องกันโรคได้เพราะ</span>
      <select id="im-e"><option value="">— เลือก —</option><option>ให้แอนติบอดีสำเร็จรูปที่หมดไปในไม่กี่สัปดาห์</option><option>กระตุ้นให้ร่างกายสร้างภูมิคุ้มกันและเซลล์ความจำเอง</option><option>ฆ่าเชื้อโรคที่อยู่ในร่างกายตอนนี้ทันที</option><option>ทำให้เชื้อดื้อยาน้อยลง</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#im-e') as HTMLSelectElement).value === 'กระตุ้นให้ร่างกายสร้างภูมิคุ้มกันและเซลล์ความจำเอง' ? null : 'หน่วยรบถูกหมดแล้ว แต่หลักการของวัคซีนยังไม่ใช่ — วัคซีนคือภูมิคุ้มกันก่อเอง (active) หรือรับมา (passive)?'),
    wrongMsg: (n) => `ยังผิด ${n} หน่วย — แอนติบอดีมาจากเซลล์บี ไม่ใช่เซลล์ที`,
    okMsg: 'กองทัพเม็ดเลือดขาวพร้อมรบ! ภูมิคุ้มกันมี <b>แบบไม่จำเพาะ</b> (ผิวหนัง การอักเสบ ฟาโกไซต์) และ <b>แบบจำเพาะ</b> (เซลล์บี-แอนติบอดี เซลล์ที) <b>วัคซีน</b> ใช้เชื้อที่อ่อนฤทธิ์หรือชิ้นส่วนของเชื้อกระตุ้นให้เกิดเซลล์ความจำ — ภูมิคุ้มกันก่อเอง',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Kidney lagoon: the nephron's stations; what should never be in urine. */
export function runNephronPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบขับถ่าย', place: 'ทะเลสาบหน่วยไต',
    stem: 'หอกรองน้ำของทะเลสาบหยุดทำงาน น้ำในเมืองเริ่มเน่า! ระบุว่า <b style="color:var(--gold)">แต่ละส่วนของหน่วยไต (เนฟรอน)</b> ทำหน้าที่อะไร',
    hint: 'กรอง (โกลเมอรูลัส → โบว์แมนแคปซูล) → ดูดกลับ (ท่อส่วนต้นมากที่สุด) → ห่วงเฮนเลสร้างความเข้มข้น → ท่อรวมปรับน้ำตาม ADH',
    rows: [
      { label: '🌀 โกลเมอรูลัส', right: 'กรองน้ำเลือดภายใต้ความดันสูง' },
      { label: '🥣 โบว์แมนแคปซูล', right: 'รองรับของเหลวที่กรองได้' },
      { label: '↩️ ท่อหน่วยไตส่วนต้น', right: 'ดูดกลับกลูโคส กรดอะมิโน น้ำ และเกลือแร่ส่วนใหญ่' },
      { label: '➰ ห่วงเฮนเล', right: 'ทำให้เนื้อไตชั้นในมีเกลือเข้มข้น ช่วยดูดน้ำกลับ' },
      { label: '🚰 ท่อรวม', right: 'ดูดน้ำกลับมากขึ้นเมื่อมีฮอร์โมน ADH' },
    ],
    options: ['กรองน้ำเลือดภายใต้ความดันสูง', 'รองรับของเหลวที่กรองได้', 'ดูดกลับกลูโคส กรดอะมิโน น้ำ และเกลือแร่ส่วนใหญ่', 'ทำให้เนื้อไตชั้นในมีเกลือเข้มข้น ช่วยดูดน้ำกลับ', 'ดูดน้ำกลับมากขึ้นเมื่อมีฮอร์โมน ADH'],
    extra: `<div class="sel-row" style="margin-top:8px"><span>🧪 ปัสสาวะของคนปกติไม่ควรพบ</span>
      <select id="np-e"><option value="">— เลือก —</option><option>ยูเรีย</option><option>น้ำ</option><option>กลูโคสและโปรตีน</option><option>โซเดียมคลอไรด์</option></select></div>`,
    checkExtra: (root) => ((root.querySelector('#np-e') as HTMLSelectElement).value === 'กลูโคสและโปรตีน' ? null : 'ทุกส่วนถูกแล้ว แต่สารในปัสสาวะยังไม่ใช่ — โปรตีนโมเลกุลใหญ่กรองไม่ผ่าน ส่วนกลูโคสถูกดูดกลับหมด'),
    wrongMsg: (n) => `ยังผิด ${n} ส่วน — การกรองเกิดที่ปลายต้นของหน่วยไต ส่วนการปรับปริมาณน้ำครั้งสุดท้ายเกิดที่ท่อรวม`,
    okMsg: 'หอกรองทำงานอีกครั้ง! ไตแต่ละข้างมีหน่วยไตราว 1 ล้านหน่วย กรองเลือดวันละ ~180 ลิตร แต่ขับเป็นปัสสาวะเพียง ~1.5 ลิตร เพราะดูดกลับเกือบทั้งหมด — ถ้าพบกลูโคสในปัสสาวะอาจเป็นสัญญาณของเบาหวาน ถ้าพบโปรตีนอาจเป็นโรคไต',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

// ------------------------------------------------------------------ chapter 7 and the finale (nerves, senses, movement, hormones, homeostasis)

/** One extra multiple-choice line under a select puzzle: its HTML, and the check that returns `hint` when wrong. */
function extraQuestion(id: string, label: string, options: string[], right: string, hint: string) {
  return {
    extra: `<div class="sel-row" style="margin-top:8px"><span>${label}</span>
      <select id="${id}"><option value="">— เลือก —</option>${options.map((o) => `<option>${o}</option>`).join('')}</select></div>`,
    checkExtra: (root: HTMLElement) => ((root.querySelector(`#${id}`) as HTMLSelectElement).value === right ? null : hint),
  };
}

/** Axon Highway: the parts of a neuron; which ion rushes in during an action potential. */
export function runNeuronPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบประสาท', place: 'ทางด่วนแอกซอน',
    stem: 'สัญญาณของเมืองถูกตัดขาด! บอกหน้าที่ของ <b style="color:var(--gold)">แต่ละส่วนของเซลล์ประสาท</b> เพื่อต่อสายประสาทของนิวรีออนใหม่',
    hint: 'กระแสประสาทไหลทางเดียว: เดนไดรต์ → ตัวเซลล์ → แอกซอน → ปลายแอกซอน · ไมอีลินคือฉนวน',
    rows: [
      { label: '🌿 เดนไดรต์', right: 'รับกระแสประสาทเข้าสู่ตัวเซลล์' },
      { label: '⚪ ตัวเซลล์', right: 'มีนิวเคลียส รวบรวมสัญญาณที่รับเข้ามา' },
      { label: '➖ แอกซอน', right: 'นำกระแสประสาทออกจากตัวเซลล์' },
      { label: '🧈 เยื่อไมอีลิน', right: 'เป็นฉนวน ให้กระแสประสาทกระโดดข้ามโนดออฟรันเวียร์ได้เร็ว' },
      { label: '🧪 ปลายแอกซอนที่ไซแนปส์', right: 'หลั่งสารสื่อประสาทไปยังเซลล์ถัดไป' },
    ],
    options: ['รับกระแสประสาทเข้าสู่ตัวเซลล์', 'มีนิวเคลียส รวบรวมสัญญาณที่รับเข้ามา', 'นำกระแสประสาทออกจากตัวเซลล์', 'เป็นฉนวน ให้กระแสประสาทกระโดดข้ามโนดออฟรันเวียร์ได้เร็ว', 'หลั่งสารสื่อประสาทไปยังเซลล์ถัดไป'],
    ...extraQuestion('ne-e', '⚡ ขณะเกิดดีโพลาไรเซชัน ไอออนที่แพร่เข้าสู่เซลล์ประสาทคือ', ['K⁺', 'Na⁺', 'Cl⁻', 'Ca²⁺'], 'Na⁺',
      'ส่วนประกอบถูกหมดแล้ว แต่ไอออนยังไม่ใช่ — ตอนพัก ภายนอกเซลล์มีไอออนบวกตัวไหนมากเป็นพิเศษ?'),
    wrongMsg: (n) => `ยังผิด ${n} ส่วน — เดนไดรต์ "รับ" ส่วนแอกซอน "ส่งออก"`,
    okMsg: 'สายประสาทของเมืองกลับมาเชื่อมกันแล้ว! เมื่อถูกกระตุ้นถึงระดับขีดเริ่มเปลี่ยน ช่อง <b>Na⁺</b> เปิด Na⁺ ไหลเข้า (ดีโพลาไรเซชัน) แล้ว K⁺ ไหลออก (รีโพลาไรเซชัน) — เกิดแบบ <b>ทั้งหมดหรือไม่เกิดเลย</b> ที่ไซแนปส์ สารสื่อประสาทเช่น <b>แอซิทิลโคลีน</b> ส่งสัญญาณต่อไปยังเซลล์ถัดไป',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Garden of the Senses: eye and ear structures; how myopia is corrected. */
export function runSensePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'อวัยวะรับความรู้สึก', place: 'สวนประสาทสัมผัส',
    stem: 'ชาวเมืองมองไม่ชัด ได้ยินไม่ชัด! บอกหน้าที่ของ <b style="color:var(--gold)">แต่ละส่วนของอวัยวะรับความรู้สึก</b> เพื่อปรับรูปปั้นในสวนให้กลับมาทำงาน',
    hint: 'แสง: กระจกตา → เลนส์ → เรตินา · เสียง: แก้วหู → กระดูกหู 3 ชิ้น → คอเคลีย · ทรงตัว: ช่องครึ่งวงกลม',
    rows: [
      { label: '🔍 เลนส์ตา', right: 'หักเหแสงให้โฟกัสตกบนเรตินา' },
      { label: '🟣 เรตินา (เซลล์รูปแท่ง/รูปกรวย)', right: 'รับแสงแล้วเปลี่ยนเป็นกระแสประสาท' },
      { label: '🎚️ ม่านตา', right: 'ปรับขนาดรูม่านตาตามความเข้มของแสง' },
      { label: '🐚 คอเคลีย', right: 'เปลี่ยนการสั่นของเสียงเป็นกระแสประสาท' },
      { label: '🌀 ช่องครึ่งวงกลม', right: 'รับรู้การเคลื่อนไหวและการทรงตัวของศีรษะ' },
      { label: '👅 ปุ่มรับรส', right: 'รับรสของสารเคมีที่ละลายน้ำ' },
    ],
    options: ['หักเหแสงให้โฟกัสตกบนเรตินา', 'รับแสงแล้วเปลี่ยนเป็นกระแสประสาท', 'ปรับขนาดรูม่านตาตามความเข้มของแสง', 'เปลี่ยนการสั่นของเสียงเป็นกระแสประสาท', 'รับรู้การเคลื่อนไหวและการทรงตัวของศีรษะ', 'รับรสของสารเคมีที่ละลายน้ำ'],
    ...extraQuestion('se-e', '👓 คนสายตาสั้น (ภาพตกก่อนถึงเรตินา) แก้ไขได้ด้วย', ['เลนส์นูน', 'เลนส์เว้า', 'เลนส์ทรงกระบอก', 'ปริซึม'], 'เลนส์เว้า',
      'ทุกส่วนถูกแล้ว แต่แว่นยังไม่ใช่ — ต้องกระจายแสงออก หรือรวมแสงเข้า ให้ภาพเลื่อนไปตกบนเรตินาพอดี?'),
    wrongMsg: (n) => `ยังผิด ${n} ส่วน — เซลล์รูปแท่งไวต่อแสงสลัว เซลล์รูปกรวยแยกสี อยู่บนเรตินาทั้งคู่`,
    okMsg: 'สวนประสาทสัมผัสกลับมามีชีวิต! อวัยวะรับความรู้สึกทุกชนิดทำหน้าที่ <b>เปลี่ยนสิ่งเร้า (แสง เสียง สารเคมี) เป็นกระแสประสาท</b> แล้วส่งไปแปลผลที่สมอง — คนสายตาสั้นใช้ <b>เลนส์เว้า</b> สายตายาวใช้เลนส์นูน',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Motion Forge: skeleton, joints and the three kinds of muscle; the sliding-filament theory. */
export function runMusclePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบโครงร่างและการเคลื่อนที่', place: 'โรงหลอมการเคลื่อนไหว',
    stem: 'หุ่นยามของเมืองขยับไม่ได้! จับคู่ <b style="color:var(--gold)">ส่วนของระบบโครงร่างและกล้ามเนื้อ</b> กับหน้าที่ให้ถูก',
    hint: 'เอ็นยึดกระดูก (ligament) ต่อกระดูกกับกระดูก · เอ็นยึดกล้ามเนื้อ (tendon) ต่อกล้ามเนื้อกับกระดูก · กล้ามเนื้อ 3 ชนิด: ลาย เรียบ หัวใจ',
    rows: [
      { label: '🦴 กระดูก', right: 'เป็นโครงค้ำจุนร่างกายและเป็นที่ยึดเกาะของกล้ามเนื้อ' },
      { label: '🔗 เอ็นยึดกระดูก (ligament)', right: 'ยึดกระดูกกับกระดูกที่ข้อต่อ' },
      { label: '🪢 เอ็นยึดกล้ามเนื้อ (tendon)', right: 'ยึดกล้ามเนื้อกับกระดูก' },
      { label: '💪 กล้ามเนื้อลาย', right: 'ยึดกับกระดูก ทำงานภายใต้อำนาจจิตใจ' },
      { label: '🫀 กล้ามเนื้อหัวใจ', right: 'หดตัวเป็นจังหวะตลอดชีวิต อยู่นอกอำนาจจิตใจ' },
      { label: '🌀 กล้ามเนื้อเรียบ', right: 'อยู่ที่ผนังอวัยวะภายใน เช่น ลำไส้ อยู่นอกอำนาจจิตใจ' },
    ],
    options: ['เป็นโครงค้ำจุนร่างกายและเป็นที่ยึดเกาะของกล้ามเนื้อ', 'ยึดกระดูกกับกระดูกที่ข้อต่อ', 'ยึดกล้ามเนื้อกับกระดูก', 'ยึดกับกระดูก ทำงานภายใต้อำนาจจิตใจ', 'หดตัวเป็นจังหวะตลอดชีวิต อยู่นอกอำนาจจิตใจ', 'อยู่ที่ผนังอวัยวะภายใน เช่น ลำไส้ อยู่นอกอำนาจจิตใจ'],
    ...extraQuestion('mu-e', '⚙️ เส้นใยกล้ามเนื้อหดตัวได้เพราะ', ['ฟิลาเมนต์แอกตินเลื่อนซ้อนเข้าหากันบนไมโอซิน ซาร์โคเมียร์สั้นลง', 'ฟิลาเมนต์แอกตินและไมโอซินหดสั้นลงเอง', 'กระดูกดึงกล้ามเนื้อให้สั้นลง', 'เซลล์กล้ามเนื้อแบ่งตัวเพิ่มขึ้นทันที'], 'ฟิลาเมนต์แอกตินเลื่อนซ้อนเข้าหากันบนไมโอซิน ซาร์โคเมียร์สั้นลง',
      'ทุกส่วนถูกแล้ว แต่กลไกการหดตัวยังไม่ใช่ — ความยาวของฟิลาเมนต์แต่ละเส้นเปลี่ยนไหม หรือแค่เลื่อนซ้อนกัน?'),
    wrongMsg: (n) => `ยังผิด ${n} ส่วน — มีเพียงกล้ามเนื้อลายที่เราสั่งได้ตามใจ`,
    okMsg: 'หุ่นยามขยับได้อีกครั้ง! กล้ามเนื้อลายทำงานเป็นคู่ <b>สภาวะตรงกันข้าม</b> เช่น ตอนงอแขน ไบเซปส์หดตัว ไตรเซปส์คลายตัว — ภายในเส้นใยกล้ามเนื้อ <b>แอกตินเลื่อนซ้อนบนไมโอซิน</b> (ทฤษฎีการเลื่อนของฟิลาเมนต์) โดยใช้ ATP และ Ca²⁺',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Hormone Spire: glands and their hormones; negative feedback on thyroxine. */
export function runEndocrinePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ระบบต่อมไร้ท่อ', place: 'หอฮอร์โมน',
    stem: 'หอฮอร์โมนปล่อยสารผิดชนิด ทั้งเมืองตื่นตระหนก! จับคู่ <b style="color:var(--gold)">ต่อมไร้ท่อกับฮอร์โมน</b> ที่สร้างให้ถูก',
    hint: 'ต่อมใต้สมองเป็น "ต่อมผู้คุม" ที่กระตุ้นต่อมอื่น · ไทรอกซินคุมอัตราเมแทบอลิซึม · ตับอ่อนคุมน้ำตาล · ต่อมหมวกไตชั้นในคือ "สู้หรือหนี"',
    rows: [
      { label: '🧠 ต่อมใต้สมองส่วนหน้า', right: 'โกรทฮอร์โมนและฮอร์โมนกระตุ้นต่อมอื่น (TSH, FSH, LH)' },
      { label: '🦋 ต่อมไทรอยด์', right: 'ไทรอกซิน ควบคุมอัตราเมแทบอลิซึม' },
      { label: '🍬 ไอส์เลตส์ออฟแลงเกอร์ฮานส์ (ตับอ่อน)', right: 'อินซูลินและกลูคากอน ควบคุมน้ำตาลในเลือด' },
      { label: '⚡ ต่อมหมวกไตชั้นใน', right: 'อะดรีนาลีน เตรียมร่างกายในภาวะฉุกเฉิน' },
      { label: '🌸 รังไข่', right: 'เอสโทรเจนและโพรเจสเทอโรน' },
      { label: '🔷 อัณฑะ', right: 'เทสโทสเทอโรน' },
    ],
    options: ['โกรทฮอร์โมนและฮอร์โมนกระตุ้นต่อมอื่น (TSH, FSH, LH)', 'ไทรอกซิน ควบคุมอัตราเมแทบอลิซึม', 'อินซูลินและกลูคากอน ควบคุมน้ำตาลในเลือด', 'อะดรีนาลีน เตรียมร่างกายในภาวะฉุกเฉิน', 'เอสโทรเจนและโพรเจสเทอโรน', 'เทสโทสเทอโรน'],
    ...extraQuestion('en-e', '🔁 เมื่อไทรอกซินในเลือดสูงเกินไป ร่างกายจะ', ['หลั่ง TSH มากขึ้น', 'หลั่ง TSH น้อยลง (การควบคุมแบบป้อนกลับเชิงลบ)', 'หยุดสร้างอินซูลิน', 'หลั่งอะดรีนาลีนเพิ่ม'], 'หลั่ง TSH น้อยลง (การควบคุมแบบป้อนกลับเชิงลบ)',
      'ต่อมถูกหมดแล้ว แต่การควบคุมยังไม่ใช่ — ถ้าฮอร์โมนมากเกินไป ร่างกายควรเร่งหรือชะลอตัวกระตุ้น?'),
    wrongMsg: (n) => `ยังผิด ${n} ต่อม — ฮอร์โมนเพศสร้างจากอวัยวะสืบพันธุ์ แต่ถูกกระตุ้นด้วย FSH/LH จากต่อมใต้สมอง`,
    okMsg: 'หอฮอร์โมนกลับมาสมดุล! ฮอร์โมนเดินทางไปกับ <b>กระแสเลือด</b> ออกฤทธิ์ช้ากว่ากระแสประสาทแต่นานกว่า ระดับฮอร์โมนส่วนใหญ่ถูกคุมด้วย <b>การป้อนกลับเชิงลบ</b> — ไทรอกซินสูงจะยับยั้งไฮโพทาลามัสและต่อมใต้สมองให้หลั่ง TSH น้อยลง',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Trial of warmth: how the body keeps its temperature; where the thermostat is. */
export function runThermoPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ดุลยภาพ · อุณหภูมิร่างกาย', place: 'ศิลาแห่งความอบอุ่น',
    stem: 'บลายต์ทำให้ความร้อนแปรปรวน! บอกว่า <b style="color:var(--gold)">ร่างกายตอบสนองอย่างไร</b> เมื่ออากาศหนาวและร้อน เพื่อรักษาอุณหภูมิไว้ที่ราว 37 °C',
    hint: 'หนาว: เก็บความร้อนและสร้างความร้อนเพิ่ม · ร้อน: ระบายความร้อนออก',
    rows: [
      { label: '🥶 หนาว · หลอดเลือดที่ผิวหนัง', right: 'หดตัว ลดการสูญเสียความร้อน' },
      { label: '🥶 หนาว · กล้ามเนื้อ', right: 'หดตัวถี่ ๆ (หนาวสั่น) สร้างความร้อน' },
      { label: '🥵 ร้อน · หลอดเลือดที่ผิวหนัง', right: 'ขยายตัว ระบายความร้อนออกทางผิวหนัง' },
      { label: '🥵 ร้อน · ต่อมเหงื่อ', right: 'หลั่งเหงื่อมากขึ้น การระเหยพาความร้อนออก' },
    ],
    options: ['หดตัว ลดการสูญเสียความร้อน', 'หดตัวถี่ ๆ (หนาวสั่น) สร้างความร้อน', 'ขยายตัว ระบายความร้อนออกทางผิวหนัง', 'หลั่งเหงื่อมากขึ้น การระเหยพาความร้อนออก', 'หลั่งเหงื่อน้อยลง'],
    ...extraQuestion('th-e', '🌡️ ศูนย์ควบคุมอุณหภูมิของร่างกายอยู่ที่', ['ซีรีเบลลัม', 'ไฮโพทาลามัส', 'เมดัลลาออบลองกาตา', 'ต่อมไทรอยด์'], 'ไฮโพทาลามัส',
      'การตอบสนองถูกหมดแล้ว แต่ศูนย์ควบคุมยังไม่ใช่ — สมองส่วนไหนคุมทั้งอุณหภูมิ ความหิว และสมดุลน้ำ?'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — ตอนหนาว ร่างกาย "เก็บ" ความร้อน ตอนร้อน ร่างกาย "ระบาย" ความร้อน`,
    okMsg: 'เส้นเลือดแห่งความอบอุ่นสว่างขึ้น! นี่คือ <b>ดุลยภาพ (Homeostasis)</b>: <b>ไฮโพทาลามัส</b> ทำหน้าที่เหมือนเทอร์โมสตัต รับรู้อุณหภูมิของเลือดแล้วสั่งการให้ร่างกายปรับกลับสู่ค่าปกติ — การปรับให้ตรงข้ามกับการเปลี่ยนแปลงคือ <b>การป้อนกลับเชิงลบ</b>',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Trial of sugar: insulin and glucagon; what type-1 diabetes is. */
export function runGlucosePuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ดุลยภาพ · น้ำตาลในเลือด', place: 'ศิลาแห่งน้ำตาล',
    stem: 'บลายต์ทำให้พลังงานของรากขึ้นลงไม่หยุด! บอกว่า <b style="color:var(--gold)">ร่างกายคุมระดับน้ำตาลในเลือดอย่างไร</b>',
    hint: 'อินซูลิน "เก็บ" น้ำตาลออกจากเลือด · กลูคากอน "ปล่อย" น้ำตาลกลับเข้าเลือด · ที่เก็บคือไกลโคเจนในตับ',
    rows: [
      { label: '🍚 หลังกินอาหาร · ฮอร์โมนที่หลั่ง', right: 'อินซูลิน' },
      { label: '🍚 หลังกินอาหาร · ตับและกล้ามเนื้อ', right: 'เปลี่ยนกลูโคสเป็นไกลโคเจนเก็บไว้' },
      { label: '🏃 อดอาหาร/ออกกำลังกายนาน · ฮอร์โมนที่หลั่ง', right: 'กลูคากอน' },
      { label: '🏃 อดอาหาร/ออกกำลังกายนาน · ตับ', right: 'สลายไกลโคเจนเป็นกลูโคสปล่อยเข้าสู่เลือด' },
    ],
    options: ['อินซูลิน', 'กลูคากอน', 'เปลี่ยนกลูโคสเป็นไกลโคเจนเก็บไว้', 'สลายไกลโคเจนเป็นกลูโคสปล่อยเข้าสู่เลือด', 'อะดรีนาลีน'],
    ...extraQuestion('gl2-e', '💉 โรคเบาหวานชนิดที่ 1 เกิดจาก', ['กินน้ำตาลมากเกินในวันเดียว', 'เซลล์ในตับอ่อนสร้างอินซูลินไม่ได้', 'ไตกรองน้ำตาลไม่ได้', 'ร่างกายขาดกลูคากอน'], 'เซลล์ในตับอ่อนสร้างอินซูลินไม่ได้',
      'การควบคุมถูกหมดแล้ว แต่สาเหตุของเบาหวานชนิดที่ 1 ยังไม่ใช่ — ถ้าขาดฮอร์โมนที่ "เก็บ" น้ำตาล จะเกิดอะไรขึ้น?'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — อินซูลินลดน้ำตาล กลูคากอนเพิ่มน้ำตาล ทั้งสองมาจากไอส์เลตส์ออฟแลงเกอร์ฮานส์`,
    okMsg: 'เส้นเลือดแห่งน้ำตาลสว่างขึ้น! อินซูลินกับกลูคากอนทำงาน <b>ตรงข้ามกัน</b> คุมน้ำตาลให้อยู่ราว 70–100 mg/dL ตอนอดอาหาร — เบาหวานชนิดที่ 1 ร่างกาย <b>สร้างอินซูลินไม่ได้</b> ชนิดที่ 2 เซลล์ <b>ตอบสนองต่ออินซูลินลดลง</b>',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Trial of water: ADH and urine; how breathing keeps blood pH. */
export function runWaterPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ดุลยภาพ · น้ำและกรด-เบส', place: 'ศิลาแห่งสายน้ำ',
    stem: 'บลายต์ทำให้รากขาดน้ำสลับกับน้ำท่วม! บอกว่า <b style="color:var(--gold)">ร่างกายรักษาสมดุลน้ำอย่างไร</b>',
    hint: 'ADH สร้างจากไฮโพทาลามัส หลั่งจากต่อมใต้สมองส่วนหลัง ทำให้ท่อรวมดูดน้ำกลับ',
    rows: [
      { label: '🏜️ ขาดน้ำ · ADH', right: 'หลั่งมากขึ้น' },
      { label: '🏜️ ขาดน้ำ · ปัสสาวะ', right: 'น้อยและเข้มข้น' },
      { label: '🌊 ดื่มน้ำมาก · ADH', right: 'หลั่งน้อยลง' },
      { label: '🌊 ดื่มน้ำมาก · ปัสสาวะ', right: 'มากและเจือจาง' },
    ],
    options: ['หลั่งมากขึ้น', 'หลั่งน้อยลง', 'น้อยและเข้มข้น', 'มากและเจือจาง'],
    ...extraQuestion('wa-e', '🫁 เมื่อ CO₂ ในเลือดสูง (เลือดเป็นกรดมากขึ้น) ร่างกายรักษาดุลยภาพโดย', ['หายใจช้าลง', 'หายใจเร็วและลึกขึ้น', 'หลั่งอินซูลิน', 'หยุดสร้างเหงื่อ'], 'หายใจเร็วและลึกขึ้น',
      'สมดุลน้ำถูกหมดแล้ว แต่สมดุลกรด-เบสยังไม่ใช่ — ต้องกำจัด CO₂ ออกให้เร็วขึ้นหรือช้าลง?'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — ADH ย่อมาจาก Anti-Diuretic Hormone แปลว่า "ฮอร์โมนต้านการขับปัสสาวะ"`,
    okMsg: 'เส้นเลือดแห่งสายน้ำสว่างขึ้น! <b>ไต</b>และ <b>ADH</b> คุมปริมาณน้ำ ส่วน <b>การหายใจ</b>และไตช่วยคุม pH ของเลือดให้อยู่ราว 7.4 — ทุกระบบในร่างกายทำงานร่วมกันเพื่อดุลยภาพ',
    okBtn: 'เสร็จสิ้น ▶',
  });
}

/** Trial of the living world: roles in an ecosystem, energy flow, sustainability. */
export function runEcoPuzzle(): Promise<boolean> {
  return selectPuzzle({
    ctx: 'ดุลยภาพของระบบนิเวศ', place: 'ศิลาแห่งโลกที่มีชีวิต',
    stem: 'ไม่ใช่แค่ร่างกาย — โลกทั้งใบก็ต้องสมดุล! บอกบทบาทของ <b style="color:var(--gold)">แต่ละส่วนในระบบนิเวศ</b>',
    hint: 'พลังงานไหลทางเดียว (ลดลงทุกลำดับขั้น) แต่สารหมุนเวียนเป็นวัฏจักร',
    rows: [
      { label: '☀️ ผู้ผลิต', right: 'สร้างอาหารเองด้วยการสังเคราะห์ด้วยแสง' },
      { label: '🐛 ผู้บริโภค', right: 'ได้พลังงานจากการกินสิ่งมีชีวิตอื่น' },
      { label: '🍄 ผู้ย่อยสลาย', right: 'ย่อยซากสิ่งมีชีวิตและคืนแร่ธาตุสู่ดิน' },
      { label: '🔺 พลังงานในแต่ละลำดับขั้น', right: 'ถ่ายทอดต่อได้ราว 10% ที่เหลือสูญเสียเป็นความร้อน' },
      { label: '♻️ วัฏจักรคาร์บอน', right: 'คาร์บอนหมุนเวียนระหว่างสิ่งมีชีวิตและสิ่งแวดล้อม' },
    ],
    options: ['สร้างอาหารเองด้วยการสังเคราะห์ด้วยแสง', 'ได้พลังงานจากการกินสิ่งมีชีวิตอื่น', 'ย่อยซากสิ่งมีชีวิตและคืนแร่ธาตุสู่ดิน', 'ถ่ายทอดต่อได้ราว 10% ที่เหลือสูญเสียเป็นความร้อน', 'คาร์บอนหมุนเวียนระหว่างสิ่งมีชีวิตและสิ่งแวดล้อม'],
    ...extraQuestion('ec-e', '🌍 การพัฒนาที่ยั่งยืน หมายถึง', ['ใช้ทรัพยากรให้หมดเร็วที่สุด', 'ใช้ทรัพยากรโดยไม่ทำลายโอกาสของคนรุ่นหลัง', 'ห้ามใช้ทรัพยากรธรรมชาติทุกชนิด', 'ปลูกพืชชนิดเดียวทั้งประเทศ'], 'ใช้ทรัพยากรโดยไม่ทำลายโอกาสของคนรุ่นหลัง',
      'ระบบนิเวศถูกหมดแล้ว แต่ความยั่งยืนยังไม่ใช่ — เราจะใช้ทรัพยากรอย่างไรให้ลูกหลานยังมีใช้?'),
    wrongMsg: (n) => `ยังผิด ${n} ข้อ — ถ้าไม่มีผู้ย่อยสลาย แร่ธาตุจะติดอยู่ในซากและไม่กลับสู่ดิน`,
    okMsg: 'เส้นเลือดแห่งโลกสว่างขึ้น! ระบบนิเวศรักษาดุลยภาพด้วย <b>การไหลของพลังงาน</b>และ <b>การหมุนเวียนของสาร</b> — มนุษย์เป็นส่วนหนึ่งของระบบนี้ <b>การพัฒนาที่ยั่งยืน</b>คือการใช้ทรัพยากรโดยไม่ทำลายโอกาสของคนรุ่นหลัง',
    okBtn: 'เสร็จสิ้น ▶',
  });
}
