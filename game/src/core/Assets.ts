import { ELEMENT_COLOR, type Element } from './types';

/**
 * Image helper. The game first tries to load real art from /public/assets (images made by GPT,
 * named per GPT_IMAGE_PROMPTS.md). If a file doesn't exist yet, it falls back to a generated
 * placeholder so the game always works.
 *
 * Usage in HTML strings:  img(['assets/a.png', 'assets/b.png'], placeholderDataUrl, 'class')
 */
const placeholderCache = new Map<string, string>();

export function installImageFallback() {
  window.addEventListener(
    'error',
    (e) => {
      const el = e.target as HTMLImageElement;
      if (!(el instanceof HTMLImageElement)) return;
      const chain = (el.dataset.fb || '').split('|').filter(Boolean);
      if (!chain.length) return;
      const next = chain.shift()!;
      el.dataset.fb = chain.join('|');
      el.src = next;
    },
    true,
  );
}

export function img(sources: string[], placeholder: string, cls = '', style = ''): string {
  const [first, ...rest] = sources;
  const fb = [...rest, placeholder].join('|');
  return `<img src="${first ?? placeholder}" data-fb="${fb}" class="${cls}" style="${style}" draggable="false" alt="">`;
}

/** Circular avatar placeholder with gradient + glyph/initial. */
export function avatarPlaceholder(label: string, color: string, color2 = '#1b2340'): string {
  const key = `av:${label}:${color}:${color2}`;
  const hit = placeholderCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(48, 40, 10, 64, 64, 70);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color2);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 62, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.6)';
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#fff';
  g.font = 'bold 52px Kanit, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,.5)';
  g.shadowBlur = 6;
  g.fillText(label, 64, 68);
  const url = c.toDataURL();
  placeholderCache.set(key, url);
  return url;
}

/** Amoeby jelly-blob portrait placeholder. */
export function amoebyPortraitPlaceholder(): string {
  const key = 'pt:amoeby';
  const hit = placeholderCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 400; c.height = 400;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(170, 170, 30, 200, 210, 180);
  grad.addColorStop(0, 'rgba(210,240,255,.95)');
  grad.addColorStop(1, 'rgba(150,200,255,.85)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(200, 50);
  g.bezierCurveTo(330, 50, 370, 170, 350, 250);
  g.bezierCurveTo(330, 340, 260, 360, 200, 355);
  g.bezierCurveTo(120, 360, 50, 330, 50, 240);
  g.bezierCurveTo(45, 150, 90, 50, 200, 50);
  g.fill();
  g.fillStyle = 'rgba(255,120,180,.75)';
  g.beginPath(); g.arc(185, 260, 22, 0, Math.PI * 2); g.arc(215, 260, 22, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(165, 268); g.lineTo(200, 305); g.lineTo(235, 268); g.fill();
  g.fillStyle = '#1a1830';
  g.beginPath(); g.ellipse(155, 180, 18, 26, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(245, 180, 18, 26, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(161, 170, 7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(251, 170, 7, 0, Math.PI * 2); g.fill();
  const url = c.toDataURL();
  placeholderCache.set(key, url);
  return url;
}

/** Tall portrait placeholder (bust silhouette) for dialogue. */
export function portraitPlaceholder(color: string, hair: string): string {
  const key = `pt:${color}:${hair}`;
  const hit = placeholderCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 560;
  const g = c.getContext('2d')!;
  // shoulders
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(200, 560, 170, 150, 0, Math.PI, 0);
  g.fill();
  // neck + head
  g.fillStyle = '#f6dcc8';
  g.fillRect(175, 330, 50, 70);
  g.beginPath();
  g.ellipse(200, 260, 92, 108, 0, 0, Math.PI * 2);
  g.fill();
  // hair
  g.fillStyle = hair;
  g.beginPath();
  g.ellipse(200, 222, 104, 90, 0, Math.PI, 0);
  g.fill();
  g.beginPath();
  g.ellipse(200, 205, 100, 60, 0, 0, Math.PI * 2);
  g.fill();
  // eyes
  g.fillStyle = '#2a2140';
  g.beginPath(); g.ellipse(166, 272, 11, 16, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(234, 272, 11, 16, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(169, 266, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(237, 266, 4, 0, Math.PI * 2); g.fill();
  const url = c.toDataURL();
  placeholderCache.set(key, url);
  return url;
}

export function elementIcon(el: Element, size = 22): string {
  const name = el.charAt(0) + el.slice(1).toLowerCase();
  const ph = elementPlaceholder(el);
  return img([`assets/ui/UI_Element_${name}.png`], ph, '', `width:${size}px;height:${size}px;vertical-align:middle`);
}

function elementPlaceholder(el: Element): string {
  const key = `el:${el}`;
  const hit = placeholderCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const col = ELEMENT_COLOR[el];
  g.fillStyle = col;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  const shapes: Record<Element, () => void> = {
    PYRO: () => { g.moveTo(32, 4); g.bezierCurveTo(56, 26, 52, 58, 32, 60); g.bezierCurveTo(12, 58, 8, 30, 32, 4); },
    HYDRO: () => { g.moveTo(32, 4); g.bezierCurveTo(60, 38, 52, 60, 32, 60); g.bezierCurveTo(12, 60, 4, 38, 32, 4); },
    ANEMO: () => { g.arc(32, 32, 26, 0, Math.PI * 1.6); g.lineTo(32, 32); },
    ELECTRO: () => { g.moveTo(36, 4); g.lineTo(14, 36); g.lineTo(30, 36); g.lineTo(24, 60); g.lineTo(50, 26); g.lineTo(34, 26); g.closePath(); },
    DENDRO: () => { g.moveTo(32, 4); g.quadraticCurveTo(64, 32, 32, 60); g.quadraticCurveTo(0, 32, 32, 4); },
    CRYO: () => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); } g.arc(32, 32, 10, 0, Math.PI * 2); },
    GEO: () => { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const f = i ? g.lineTo.bind(g) : g.moveTo.bind(g); f(32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); } g.closePath(); },
    PHYSICAL: () => { g.arc(32, 32, 24, 0, Math.PI * 2); },
  };
  shapes[el]();
  g.fill();
  g.stroke();
  const url = c.toDataURL();
  placeholderCache.set(key, url);
  return url;
}

/** File-name stem used for character art, e.g. CHR_Mitora_Icon.png */
export function charArtName(charId: string, gender: 'M' | 'F'): string {
  if (charId === 'SEEKER') return gender === 'M' ? 'Sion' : 'Sira';
  return charId.charAt(0) + charId.slice(1).toLowerCase();
}

const EMOTION_FILE: Record<string, string> = {
  neutral: 'Neutral', happy: 'Happy', sad: 'Sad', angry: 'Angry', surprised: 'Surprised',
  panic: 'Worried', worried: 'Worried', cry: 'Crying', thinking: 'Thinking', proud: 'Happy', excited: 'Happy',
};

export function portraitSources(artName: string, emotion = 'neutral'): string[] {
  const e = EMOTION_FILE[emotion] ?? 'Neutral';
  return [
    `assets/characters/CHR_${artName}_Portrait_${e}.webp`,
    `assets/characters/CHR_${artName}_Portrait_Neutral.webp`,
  ];
}

export function iconSources(artName: string): string[] {
  return [`assets/characters/CHR_${artName}_Icon.png`];
}


export function splashSources(artName: string): string[] {
  return [`assets/characters/CHR_${artName}_Splash.jpg`];
}

/** Skill icons are drawn per character (the traveler's are shared by Sion/Sira). */
export function skillArtName(charId: string): string {
  return charId === 'SEEKER' ? 'Seeker' : charId.charAt(0) + charId.slice(1).toLowerCase();
}

const ITEM_GLYPH: Record<string, string> = {};
export function registerItemGlyph(id: string, glyph: string) { ITEM_GLYPH[id] = glyph; }

/** Small inline item icon (GPT art in assets/items/<ID>.png, emoji fallback). */
export function itemIcon(id: string, size = 20): string {
  const glyph = ITEM_GLYPH[id] ?? '◆';
  return img([`assets/items/${id}.png`], avatarPlaceholder(glyph, '#3a4670', '#1b2340'), 'item-ic', `width:${size}px;height:${size}px;vertical-align:middle;object-fit:contain`);
}

export function reactionIcon(codexId: string, size = 28): string {
  const short = codexId.replace('CDX_R_', '');
  return `<img src="assets/ui/UI_Reaction_${short}.png" style="width:${size}px;height:${size}px;vertical-align:middle" onerror="this.style.display='none'" alt="">`;
}
