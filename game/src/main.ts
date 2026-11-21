import { installImageFallback } from './core/Assets';
import { autoFullscreen, installDevice, isTouch, setAutoFullscreen } from './core/Device';
import { waitForLoads } from './core/LoadTracker';
import { bootLoader } from './ui/Loading';
import { hasSave, loadSave, requestPersistentStorage } from './core/Save';
import { data } from './core/Data';
import { Game } from './Game';
import { installHeightFog } from './render/Look';
import * as ModelLib from './models/ModelLibrary';
import * as WeaponLib from './models/WeaponModels';
import * as PropLib from './models/PropModels';

async function boot() {
  installImageFallback();
  installDevice();
  installHeightFog();
  requestPersistentStorage();
  setAutoFullscreen((hasSave() ? loadSave()?.settings.autoFullscreen : undefined) ?? isTouch);
  const loader = bootLoader();
  loader.set(0.02, 'กำลังโหลดข้อมูลเกม…');
  try {
    await data.load((p) => loader.set(0.02 + p * 0.2));
  } catch (e) {
    document.getElementById('boot')?.remove();
    document.getElementById('overlay')!.innerHTML = `<div class="title-screen"><div class="title-sub">โหลดข้อมูลเกมไม่สำเร็จ</div><div>${String(e)}</div></div>`;
    throw e;
  }
  loader.set(0.24, 'กำลังสร้างโลก…');
  await new Promise((r) => setTimeout(r, 50)); // let the bar paint before the long synchronous build
  const game = new Game(document.getElementById('game-canvas') as HTMLCanvasElement);
  game.init();
  game.showTitle();
  Object.assign(window, { game, __data: data, __models: ModelLib, __weapons: WeaponLib, __props: PropLib }); // handy for debugging in the console
  // Phones rarely fire beforeunload: they just hide the tab (home button, app switch, screen off) and may kill it later,
  // so save every time the page is hidden too.
  window.addEventListener('beforeunload', () => game.writeSave());
  window.addEventListener('pagehide', () => game.writeSave());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') game.writeSave(); });

  // the world's models and their textures stream in after init: wait for them so the title doesn't pop in
  // (a slow connection can skip ahead after a while; the rest keeps loading behind the title)
  let skipTimer = 0;
  const skip = new Promise<void>((r) => { skipTimer = window.setTimeout(() => loader.offerSkip('ข้ามไปก่อน (โหลดต่อเบื้องหลัง)', r), 12000); });
  await Promise.race([
    waitForLoads((p, n, total) => loader.set(0.3 + p * 0.66, total ? `กำลังโหลดโมเดล 3 มิติ ${n}/${total}` : undefined), isTouch ? 45000 : 30000),
    skip,
  ]);
  clearTimeout(skipTimer);
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);
  // the tap that closes the screen also unlocks audio and (phones) enters fullscreen
  await loader.waitForTap(isTouch ? 'แตะเพื่อเริ่ม' : 'คลิกเพื่อเริ่ม', () => autoFullscreen());
  loader.close();
}

boot();
