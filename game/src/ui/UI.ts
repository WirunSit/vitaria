import { amoebyPortraitPlaceholder, avatarPlaceholder, charArtName, iconSources, img, portraitPlaceholder, portraitSources } from '../core/Assets';
import { data } from '../core/Data';
import { ELEMENT_COLOR } from '../core/types';

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export function h(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Speaker registry for dialogue / quiz askers. */
export interface Speaker { name: string; art: string | null; color: string; hair: string }

let playerName = 'นักเดินทาง';
let playerGender: 'M' | 'F' = 'F';
export function setPlayerIdentity(name: string, gender: 'M' | 'F') { playerName = name; playerGender = gender; }
export function getPlayerName() { return playerName; }
export function getGender() { return playerGender; }

const NPC_SPEAKERS: Record<string, Speaker> = {
  AMOEBY: { name: 'อะมีบี้', art: 'Amoeby', color: '#9fd8ff', hair: '#ffb3d9' },
  NARRATOR: { name: '', art: null, color: '#888', hair: '#888' },
  STATUE: { name: 'รูปปั้นต้นไม้แห่งชีวิต', art: null, color: '#e8c468', hair: '#d8d0bd' },
  LYSO: { name: 'ศาสตราจารย์ไลโซ', art: 'ProfLyso', color: '#cfd5e2', hair: '#9a9a9a' },
  KING: { name: 'ราชาแบคทีเรีย', art: null, color: '#a8dc7a', hair: '#ffd36a' },
  HOOKIA: { name: 'ปราชญ์ฮูเคีย', art: 'SageHookia', color: '#e8b54a', hair: '#d9a03a' },
  INSCRIPTION: { name: 'จารึกโบราณ', art: null, color: '#7ee0c0', hair: '#7ee0c0' },
  RIBO: { name: 'ไรโบ', art: 'Ribo', color: '#e8553a', hair: '#6a4a3a' },
  GOLGI: { name: 'ป้ากอลจี', art: 'AuntieGolgi', color: '#f2c45a', hair: '#c8763a' },
  UNCLE_ER: { name: 'ลุงอีอาร์', art: 'UncleER', color: '#7aa8e8', hair: '#3a2a20' },
  CHIMERA: { name: 'ดร.ไคเมร่า', art: 'DrChimera', color: '#7aff9a', hair: '#2a2a30' },
  TWIN: { name: '???', art: 'LostTwin', color: '#8a5ad8', hair: '#1a1a22' },
  GOLEM: { name: 'โกเลมมะเร็ง', art: null, color: '#c58bff', hair: '#ffc85a' },
  CHIMERA2: { name: 'ดร.ไคเมร่า', art: 'DrChimera', color: '#7aff9a', hair: '#2a2a30' },
  MENDELION: { name: 'ปราชญ์เมนเดลิออน', art: 'SageMendelion', color: '#9fe3f0', hair: '#e8e8e8' },
  ROSA: { name: 'คุณแม่โรซา', art: 'VillagerRosa', color: '#c85a6a', hair: '#8a4a3a' },
  LENS: { name: 'เด็กชายเลนซ์', art: 'VillagerLens', color: '#3a8ad8', hair: '#e8c468' },
  FOSS: { name: 'ลุงฟอสส์', art: 'VillagerFoss', color: '#6a8a4a', hair: '#5a4a3a' },
  DARWYN: { name: 'กัปตันดาร์วิน', art: 'SageDarwyn', color: '#7ad0b0', hair: '#c8b8a0' },
  GRANNY: { name: 'ยายเซฟีรา', art: 'GrannyZephyra', color: '#7ad0b0', hair: '#f0f0f0' },
  RANGER: { name: 'เรนเจอร์ไลลา', art: 'RangerLila', color: '#5a7a4a', hair: '#4a3a2a' },
  HARVENA: { name: 'ราชินีฮาร์วีน่า', art: 'QueenHarvena', color: '#3da5f4', hair: '#e8e0f0' },
  CAJALIS: { name: 'จักรพรรดิคาฮาลิส', art: 'SageCajalis', color: '#b06cff', hair: '#2a2440' },
  TWIN_FREE: { name: 'ฝาแฝดของเธอ', art: 'LostTwin', color: '#b06cff', hair: '#1a1a22' },
  HERALD: { name: 'ผู้ประกาศเอนโทรปี', art: 'EntropyHerald', color: '#8a7aa8', hair: '#1a1a22' },
  KREBION: { name: 'ปราชญ์เครบิออน', art: 'SageKrebion', color: '#e8553a', hair: '#3a2a20' },
  LINNARA: { name: 'ปราชญ์ลินนาร่า', art: 'SageLinnara', color: '#8bc34a', hair: '#8a5a2e' },
};

export function speaker(id: string): Speaker {
  if (id === 'PLAYER') {
    const c = data.characters.get('SEEKER')!;
    return { name: playerName, art: charArtName('SEEKER', playerGender), color: ELEMENT_COLOR.GEO, hair: c.appearance.hair };
  }
  const c = data.characters.get(id);
  if (c) return { name: c.name.th, art: charArtName(id, playerGender), color: ELEMENT_COLOR[c.element], hair: c.appearance.hair };
  return NPC_SPEAKERS[id] ?? { name: id, art: null, color: '#888', hair: '#888' };
}

export function speakerAvatar(id: string, cls = 'avatar'): string {
  const s = speaker(id);
  const ph = avatarPlaceholder(id === 'AMOEBY' ? '◕‿◕' : (s.name || '?').charAt(0), s.color);
  if (!s.art) return `<img src="${ph}" class="${cls}" alt="">`;
  const prefix = id === 'AMOEBY' || NPC_SPEAKERS[id] ? (id === 'AMOEBY' ? 'CHR' : 'NPC') : 'CHR';
  const sources = prefix === 'CHR' ? iconSources(s.art) : [`assets/characters/NPC_${s.art}_Icon.png`];
  return img(sources, ph, cls);
}

export function speakerPortrait(id: string, emotion: string): string {
  const s = speaker(id);
  if (!s.art) return '';
  const ph = id === 'AMOEBY' ? amoebyPortraitPlaceholder() : portraitPlaceholder(s.color, s.hair);
  const sources = NPC_SPEAKERS[id] && id !== 'AMOEBY' ? [`assets/characters/NPC_${s.art}_Portrait.webp`] : portraitSources(s.art, emotion);
  return img(sources, ph, 'dlg-portrait');
}

export function fmtText(s: string): string {
  return esc(s).replace(/\{player\}/g, esc(playerName)).replace(/\*\*(.+?)\*\*/g, '<b style="color:var(--gold)">$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
}

// ---------------------------------------------------------------- toasts
export function toast(text: string, big = false, ms = 2600) {
  let box = $('.toasts', document.getElementById('hud')!);
  if (!box) { box = h('<div class="toasts"></div>'); document.getElementById('hud')!.appendChild(box); }
  const t = h(`<div class="toast ${big ? 'big' : ''}">${text}</div>`);
  box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, ms);
}

export function sideToast(text: string, ms = 3000) {
  let box = $('.side-toasts', document.getElementById('hud')!);
  if (!box) { box = h('<div class="side-toasts"></div>'); document.getElementById('hud')!.appendChild(box); }
  const t = h(`<div class="side-toast">${text}</div>`);
  box.appendChild(t);
  while (box.children.length > 6) box.firstElementChild?.remove();
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, ms);
}

// ---------------------------------------------------------------- modal stack
type ModalListener = (open: boolean) => void;
let modalCount = 0;
const listeners: ModalListener[] = [];
export function onModalChange(fn: ModalListener) { listeners.push(fn); }
export function isModalOpen() { return modalCount > 0; }

export function openModal(node: HTMLElement): () => void {
  const overlay = document.getElementById('overlay')!;
  overlay.appendChild(node);
  modalCount++;
  listeners.forEach((l) => l(true));
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    node.remove();
    modalCount = Math.max(0, modalCount - 1);
    listeners.forEach((l) => l(modalCount > 0));
  };
}
