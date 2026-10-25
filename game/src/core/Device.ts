/** Phone / tablet support: touch detection, fullscreen + landscape lock, and UI scaling for small screens. */

const forced = new URLSearchParams(location.search).get('touch'); // ?touch=1 / ?touch=0 overrides detection (testing)
export const isTouch: boolean = forced !== null ? forced !== '0' :
  (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 1) &&
  !window.matchMedia?.('(pointer: fine)').matches;

export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Launched from the home screen (installed web app) — already fullscreen, no browser bars. */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

export function canFullscreen(): boolean {
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement) || isStandalone();
}

/** Must be called from a tap/click handler (browsers only allow fullscreen from a user gesture). */
export async function enterFullscreen(): Promise<boolean> {
  const el = document.documentElement as FsEl;
  try {
    if (!(document as FsDoc).fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else return false;
    }
  } catch {
    return false;
  }
  // phones: keep the game in landscape while fullscreen (unsupported on iOS — ignored there)
  try { await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape'); } catch { /* ignore */ }
  return true;
}

export async function exitFullscreen() {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen && d.fullscreenElement) await d.exitFullscreen();
    else if (d.webkitExitFullscreen && d.webkitFullscreenElement) await d.webkitExitFullscreen();
  } catch { /* ignore */ }
}

export function toggleFullscreen() {
  return (document as FsDoc).fullscreenElement || (document as FsDoc).webkitFullscreenElement ? exitFullscreen() : enterFullscreen();
}

/**
 * The HUD and menus are laid out for a ~1280×760 desktop window. On smaller screens (phones in landscape)
 * they are zoomed down as a whole so everything still fits; the touch controls stay at finger size.
 */
function applyUiScale() {
  const w = window.innerWidth, h = window.innerHeight;
  // menus size themselves to the screen (and scroll), so height may be cut further than width
  // (desktop windows keep the full-size UI unless they're really small)
  const z = Math.max(0.5, Math.min(1, w / (isTouch ? 1280 : 1000), h / 600));
  document.documentElement.style.setProperty('--uiz', z.toFixed(3));
  document.body.classList.toggle('ui-scaled', z < 0.999);
  document.body.classList.toggle('portrait', isTouch && h > w);
}

export function installDevice() {
  document.body.classList.toggle('touch', isTouch);
  applyUiScale();
  window.addEventListener('resize', applyUiScale);
  window.addEventListener('orientationchange', () => setTimeout(applyUiScale, 200));
  const fsChange = () => document.body.classList.toggle('fullscreen', isFullscreen());
  document.addEventListener('fullscreenchange', fsChange);
  document.addEventListener('webkitfullscreenchange', fsChange);
  fsChange();
  if (isTouch) {
    // no pinch-zoom / double-tap zoom / long-press menus on the game itself (inputs and text areas still work)
    const block = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.('input,textarea,select,.allow-touch')) e.preventDefault(); };
    document.addEventListener('gesturestart', block);
    document.addEventListener('dblclick', block);
    document.addEventListener('contextmenu', block);
  }
}
