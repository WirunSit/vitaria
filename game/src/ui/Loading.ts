import { isTouch } from '../core/Device';

/**
 * Loading screens: the boot screen (already drawn by index.html before any script runs, so a phone on a slow
 * connection sees it straight away) and the veil shown while the world around a loaded save streams in.
 * Both show real progress, rotate short biology tips and fade out when done.
 */
const TIPS = [
  'ไมโทคอนเดรียสร้าง ATP จากการหายใจระดับเซลล์ — พลังงานที่ใช้เปิดโดเมนในเกมก็ชื่อ ATP',
  'แบคทีเรียแบ่งตัวแบบ Binary Fission: 1 → 2 → 4 → 8 จัดการให้ได้ก่อนที่มันจะเพิ่มจำนวน!',
  'ยาปฏิชีวนะได้ผลกับแบคทีเรีย แต่ใช้กับไวรัสอย่างเฟจไม่ได้',
  'เฟจเพิ่มจำนวนในเซลล์แบคทีเรียจนเซลล์แตก แล้วปล่อยเฟจรุ่นใหม่ออกมา — วัฏจักรแบบไลติก',
  'คลอโรพลาสต์เปลี่ยนพลังงานแสงเป็นพลังงานเคมีในกระบวนการสังเคราะห์ด้วยแสง',
  'ไรโบโซมคือโรงงานสร้างโปรตีนของเซลล์ อ่านรหัสจาก mRNA ทีละโคดอน',
  'เมล็ดซามาราของเมเปิลหมุนเหมือนใบพัดตอนตก จึงลอยไปได้ไกล — ที่มาของปีกร่อนในเกม',
  'ใช้ Bio-Scanner สแกนสิ่งรอบตัวเพื่อปลดการ์ดความรู้ใน Bio-Pedia',
  'ตอบผิดไม่เป็นไร ทุกข้อมีคำอธิบาย และการทบทวนประจำวันช่วยให้จำได้นานขึ้น',
  'ปฏิกิริยาธาตุเกิดเมื่อโจมตีด้วยธาตุหนึ่งใส่ศัตรูที่ติดอีกธาตุอยู่ — ลองสลับตัวละครดู',
];

export interface Loader {
  /** 0..1; the bar never moves backwards */
  set(p: number, label?: string): void;
  /** Swaps the bar for a "tap to start" prompt; `onTap` runs inside the tap itself (needed for fullscreen). */
  waitForTap(text: string, onTap: () => void): Promise<void>;
  /** Shows a button that ends the wait early (slow connections). */
  offerSkip(text: string, onSkip: () => void): void;
  close(): void;
}

const markup = (title: string) => `
  <div class="ld-center">
    <div class="ld-logo">VITARIA</div>
    <div class="ld-sub">${title}</div>
    <div class="ld-cell"><i></i><i></i><i></i></div>
    <div class="ld-bar"><div class="ld-fill"></div></div>
    <div class="ld-label"><span class="ld-text">กำลังเริ่ม…</span><span class="ld-pct">0%</span></div>
    <button class="ld-go" hidden></button>
    <button class="ld-skip" hidden></button>
  </div>
  <div class="ld-tip"><b>รู้หรือไม่?</b> <span></span></div>
  <div class="ld-rotate">📱↻ หมุนโทรศัพท์เป็นแนวนอนเพื่อเล่น</div>`;

function control(el: HTMLElement): Loader {
  // absolute URL: a url() inside a custom property resolves against the stylesheet that uses it
  el.style.setProperty('--ld-img', `url("${new URL('assets/ui/KEY_MainVisual.jpg', document.baseURI).href}")`);
  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const fill = q('.ld-fill'), text = q('.ld-text'), pct = q('.ld-pct'), go = q<HTMLButtonElement>('.ld-go'), skip = q<HTMLButtonElement>('.ld-skip');
  const tip = q('.ld-tip span');
  let shown = 0;
  let tipI = Math.floor(Math.random() * TIPS.length);
  const nextTip = () => { tip.textContent = TIPS[tipI++ % TIPS.length]; };
  nextTip();
  const tipTimer = window.setInterval(nextTip, 5500);
  return {
    set(p, label) {
      shown = Math.max(shown, Math.min(1, p));
      fill.style.width = `${(shown * 100).toFixed(1)}%`;
      pct.textContent = `${Math.round(shown * 100)}%`;
      if (label) text.textContent = label;
    },
    waitForTap(label, onTap) {
      this.set(1);
      el.classList.add('ready');
      go.textContent = label;
      go.hidden = false;
      skip.hidden = true;
      return new Promise((resolve) => {
        const fire = (e: Event) => {
          if (e instanceof KeyboardEvent && ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
          el.removeEventListener('click', fire);
          window.removeEventListener('keydown', fire);
          onTap();
          resolve();
        };
        el.addEventListener('click', fire);
        window.addEventListener('keydown', fire);
      });
    },
    offerSkip(label, onSkip) {
      skip.textContent = label;
      skip.hidden = false;
      skip.onclick = (e) => { e.stopPropagation(); skip.hidden = true; onSkip(); };
    },
    close() {
      clearInterval(tipTimer);
      el.classList.add('out');
      setTimeout(() => el.remove(), 500);
    },
  };
}

/** The boot screen from index.html (rebuilt if it is somehow missing). */
export function bootLoader(): Loader {
  let el = document.getElementById('boot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'boot';
    el.className = 'loader';
    document.body.appendChild(el);
  }
  el.innerHTML = markup('ตำนานธาตุแห่งชีวิต');
  if (isTouch) el.classList.add('touch');
  return control(el);
}

/** A fresh loading veil over the game (e.g. while the world around a save streams in). */
export function showLoader(title: string): Loader {
  const el = document.createElement('div');
  el.className = 'loader veil';
  el.innerHTML = markup(title);
  document.body.appendChild(el);
  return control(el);
}
