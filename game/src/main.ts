import { installImageFallback } from './core/Assets';
import { installDevice } from './core/Device';
import { requestPersistentStorage } from './core/Save';
import { data } from './core/Data';
import { Game } from './Game';
import * as ModelLib from './models/ModelLibrary';
import * as WeaponLib from './models/WeaponModels';
import * as PropLib from './models/PropModels';

async function boot() {
  installImageFallback();
  installDevice();
  requestPersistentStorage();
  const overlay = document.getElementById('overlay')!;
  overlay.innerHTML = `<div class="title-screen" id="loading" style="background:linear-gradient(rgba(6,10,24,.35),rgba(6,10,24,.8)),url(assets/ui/KEY_MainVisual.jpg) center/cover"><div class="title-logo" style="font-size:64px">VITARIA</div>
    <div class="title-sub">กำลังโหลด...</div><div style="width:300px;height:6px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden">
    <div id="load-bar" style="height:100%;width:0;background:var(--gold);transition:width .2s"></div></div></div>`;
  const bar = document.getElementById('load-bar')!;
  try {
    await data.load((p) => (bar.style.width = `${p * 70}%`));
  } catch (e) {
    overlay.innerHTML = `<div class="title-screen"><div class="title-sub">โหลดข้อมูลเกมไม่สำเร็จ</div><div>${String(e)}</div></div>`;
    throw e;
  }
  bar.style.width = '85%';
  await new Promise((r) => setTimeout(r, 30));
  const game = new Game(document.getElementById('game-canvas') as HTMLCanvasElement);
  game.init();
  bar.style.width = '100%';
  document.getElementById('loading')?.remove();
  game.showTitle();
  Object.assign(window, { game, __data: data, __models: ModelLib, __weapons: WeaponLib, __props: PropLib }); // handy for debugging in the console
  // Phones rarely fire beforeunload: they just hide the tab (home button, app switch, screen off) and may kill it later,
  // so save every time the page is hidden too.
  window.addEventListener('beforeunload', () => game.writeSave());
  window.addEventListener('pagehide', () => game.writeSave());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') game.writeSave(); });
}

boot();
