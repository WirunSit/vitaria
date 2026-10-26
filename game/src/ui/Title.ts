import { avatarPlaceholder, img } from '../core/Assets';
import { sfx } from '../core/Audio';
import { hasSave, importSave, loadSave, pickSaveFile, saveSummary } from '../core/Save';
import { canFullscreen, enterFullscreen, isFullscreen, isIOS, isStandalone, isTouch } from '../core/Device';
import { esc, h, openModal, toast } from './UI';

/** On phones, starting the game also goes fullscreen (needs the tap that started it). */
function phoneFullscreen() {
  if (isTouch && !isFullscreen() && canFullscreen()) void enterFullscreen();
}

export function showTitle(onContinue: () => void, onNew: (name: string, gender: 'M' | 'F') => void) {
  const saved = hasSave() ? loadSave() : null;
  const iosHint = isTouch && isIOS && !isStandalone() && !canFullscreen();
  const root = h(`<div class="title-screen with-bg">
    <img src="assets/ui/LOGO_Vitaria.png" class="title-logo-img" style="display:none" alt="">
    <h1 class="title-logo">VITARIA</h1>
    <div class="title-sub">ตำนานธาตุแห่งชีวิต</div>
    <div style="opacity:.75;font-size:16px">เกมผจญภัยเรียนรู้ชีววิทยา ม.ปลาย</div>
    <div class="title-buttons">
      ${saved ? '<button class="btn" id="t-cont">▶ เล่นต่อ</button>' : ''}
      <button class="btn ${saved ? 'secondary' : ''}" id="t-new">✦ เริ่มการผจญภัยใหม่</button>
    </div>
    ${saved ? `<div class="title-save">💾 ${esc(saveSummary(saved))}</div>` : ''}
    <div class="title-tools">
      <button class="btn secondary small" id="t-import">📥 นำเข้าเซฟจากไฟล์</button>
      ${isTouch && canFullscreen() ? '<button class="btn secondary small" id="t-fs">⛶ เต็มจอ</button>' : ''}
    </div>
    ${iosHint ? '<div class="title-hint">📱 เล่นเต็มจอบน iPhone: กดปุ่ม <b>แชร์</b> ⬆️ แล้วเลือก <b>"เพิ่มไปยังหน้าจอโฮม"</b> จากนั้นเปิดเกมจากไอคอนบนหน้าจอ</div>' : ''}
    <div class="title-foot">v0.18.0 · ภาพประกอบสร้างด้วย AI ตามแนวทางใน GPT_IMAGE_PROMPTS.md</div>
  </div>`);
  const close = openModal(root);
  // text logo by default; swap to the GPT logo image once it loads successfully
  const logo = root.querySelector('.title-logo-img') as HTMLImageElement;
  const useImage = () => {
    if (!logo.naturalWidth) return;
    logo.style.display = '';
    (root.querySelector('.title-logo') as HTMLElement).style.display = 'none';
  };
  logo.addEventListener('load', useImage);
  if (logo.complete) useImage();
  const cont = root.querySelector('#t-cont') as HTMLButtonElement | null;
  if (cont) cont.onclick = () => { sfx.ui(); phoneFullscreen(); close(); onContinue(); };
  (root.querySelector('#t-new') as HTMLButtonElement).onclick = () => {
    sfx.ui();
    phoneFullscreen();
    const go = () => { close(); showCreate(onNew); };
    if (!saved) return go();
    confirmBox('เริ่มเกมใหม่จะ <b>ลบข้อมูลที่บันทึกไว้</b> ทั้งหมด ต้องการดำเนินการต่อหรือไม่?<br><span style="font-size:15px;opacity:.8">(ถ้าอยากเก็บไว้ ให้กด "ส่งออกเซฟ" ในเมนูเกมก่อน)</span>', go);
  };
  (root.querySelector('#t-fs') as HTMLButtonElement | null)?.addEventListener('click', () => { sfx.ui(); void enterFullscreen(); });
  (root.querySelector('#t-import') as HTMLButtonElement).onclick = async () => {
    sfx.ui();
    const s = await pickSaveFile();
    if (!s) return;
    if (s === 'invalid') { toast('ไฟล์นี้ไม่ใช่เซฟของ VITARIA'); return; }
    const msg = `นำเข้าเซฟนี้?<br><b>${esc(saveSummary(s))}</b>${saved ? '<br><span style="font-size:15px;opacity:.8">เซฟเดิมในเครื่องนี้จะถูกแทนที่</span>' : ''}`;
    confirmBox(msg, () => {
      if (!importSave(s)) { toast('บันทึกไม่สำเร็จ (พื้นที่เบราว์เซอร์เต็ม?)'); return; }
      toast('นำเข้าเซฟแล้ว ✓');
      phoneFullscreen();
      close();
      onContinue();
    });
  };
}

export function confirmBox(html: string, onYes: () => void) {
  const root = h(`<div class="quiz-wrap"><div class="panel hex-bg" style="padding:24px 30px;max-width:460px;text-align:center">
    <p style="font-size:18px;line-height:1.6">${html}</p>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn secondary" id="cb-no">ยกเลิก</button><button class="btn" id="cb-yes">ยืนยัน</button></div></div></div>`);
  const close = openModal(root);
  (root.querySelector('#cb-no') as HTMLButtonElement).onclick = () => { sfx.ui(); close(); };
  (root.querySelector('#cb-yes') as HTMLButtonElement).onclick = () => { sfx.ui(); close(); onYes(); };
}

function showCreate(onNew: (name: string, gender: 'M' | 'F') => void) {
  let gender: 'M' | 'F' = 'F';
  const root = h(`<div class="title-screen"><div class="create-box panel hex-bg">
    <h2>เลือกนักเดินทางของเธอ</h2>
    <div class="gender-row">
      <div class="gender-card" data-g="M">${img(['assets/characters/CHR_Sion_Icon.png'], avatarPlaceholder('ซ', '#e8b54a'))}<div style="margin-top:8px;font-family:var(--font-head);font-size:20px">ไซออน</div></div>
      <div class="gender-card sel" data-g="F">${img(['assets/characters/CHR_Sira_Icon.png'], avatarPlaceholder('ซ', '#e8b54a'))}<div style="margin-top:8px;font-family:var(--font-head);font-size:20px">ไซร่า</div></div>
    </div>
    <input class="name-input" maxlength="16" value="ไซร่า" placeholder="ตั้งชื่อของเธอ">
    <button class="btn" id="c-go">เริ่มการผจญภัย</button>
  </div></div>`);
  const close = openModal(root);
  const input = root.querySelector('.name-input') as HTMLInputElement;
  root.querySelectorAll<HTMLElement>('.gender-card').forEach((c) => c.onclick = () => {
    gender = c.dataset.g as 'M' | 'F';
    root.querySelectorAll('.gender-card').forEach((x) => x.classList.toggle('sel', x === c));
    if (input.value === 'ไซร่า' || input.value === 'ไซออน' || !input.value) input.value = gender === 'M' ? 'ไซออน' : 'ไซร่า';
    sfx.ui();
  });
  const go = () => {
    const name = input.value.replace(/[<>]/g, '').trim().slice(0, 16) || (gender === 'M' ? 'ไซออน' : 'ไซร่า');
    sfx.ui();
    close();
    onNew(name, gender);
  };
  (root.querySelector('#c-go') as HTMLButtonElement).onclick = go;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  setTimeout(() => input.focus(), 50);
}
