import { data } from '../core/Data';
import type { DialogueNode } from '../core/types';
import { sfx } from '../core/Audio';
import { fmtText, h, openModal, speaker, speakerPortrait } from './UI';
import { isTouch } from '../core/Device';

/** Plays a dialogue by id. Resolves when finished. Unknown ids resolve immediately. */
export function playDialogue(id: string): Promise<void> {
  const def = data.dialogues.get(id);
  if (!def) { console.warn('missing dialogue', id); return Promise.resolve(); }
  const nodes = new Map(def.nodes.map((n) => [n.id, n]));
  return new Promise((resolve) => {
    const root = h(`<div class="dialogue-root" style="position:absolute;inset:0"><div class="dialogue"></div></div>`);
    const close = openModal(root);
    let current: DialogueNode | undefined = def.nodes[0];
    let typing: number | null = null;
    let fullText = '';

    const finish = () => {
      window.removeEventListener('keydown', onKey);
      close();
      resolve();
    };

    const advance = () => {
      if (!current) return finish();
      if (typing !== null) {
        clearInterval(typing);
        typing = null;
        const t = root.querySelector('.dlg-text');
        if (t) t.innerHTML = fullText;
        return;
      }
      if (current.type === 'CHOICE') return;
      const next = current.next;
      if (!next || next === 'END') return finish();
      current = nodes.get(next);
      render();
    };

    const render = () => {
      if (!current) return finish();
      const n = current;
      const sp = speaker(n.speaker);
      const portrait = n.speaker === 'PLAYER' || n.speaker === 'NARRATOR' ? '' : speakerPortrait(n.speaker, n.emotion ?? 'neutral');
      const isChoice = n.type === 'CHOICE';
      root.classList.toggle('has-portrait', !!portrait);
      root.innerHTML = `
        <div class="dialogue"></div>
        ${portrait}
        <div class="dlg-box">
          ${sp.name ? `<div class="dlg-name" style="color:${sp.color}">${sp.name}</div>` : ''}
          <div class="dlg-text" style="${n.speaker === 'NARRATOR' ? 'font-style:italic;color:var(--cream-dim)' : ''}"></div>
          ${isChoice ? '' : `<div class="dlg-next">▼ ${isTouch ? 'แตะเพื่อไปต่อ' : 'คลิก / Space'}</div>`}
        </div>
        ${isChoice ? `<div class="dlg-choices">${(n.choices ?? []).map((c, i) => `<button class="dlg-choice" data-i="${i}">${fmtText(c.text.th)}</button>`).join('')}</div>` : ''}
      `;
      const textEl = root.querySelector('.dlg-text') as HTMLElement;
      fullText = fmtText(n.text?.th ?? (isChoice ? '...' : ''));
      if (isChoice) {
        textEl.innerHTML = fullText === '...' ? '' : fullText;
        root.querySelectorAll<HTMLButtonElement>('.dlg-choice').forEach((b) => {
          b.onclick = (ev) => {
            ev.stopPropagation();
            sfx.ui();
            const c = n.choices![Number(b.dataset.i)];
            if (c.next === 'END') return finish();
            current = nodes.get(c.next);
            render();
          };
        });
      } else {
        // typewriter (plain text length based on stripped html)
        let i = 0;
        const plain = fullText;
        textEl.innerHTML = '';
        typing = window.setInterval(() => {
          i += 2;
          if (i >= plain.length) {
            textEl.innerHTML = plain;
            if (typing !== null) clearInterval(typing);
            typing = null;
          } else {
            // avoid cutting inside a tag
            let cut = i;
            const open = plain.lastIndexOf('<', cut);
            const closeTag = plain.lastIndexOf('>', cut);
            if (open > closeTag) cut = plain.indexOf('>', open) + 1;
            textEl.innerHTML = plain.slice(0, cut);
          }
        }, 18);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') {
        e.preventDefault();
        advance();
      }
      if (current?.type === 'CHOICE' && /^Digit[1-4]$/.test(e.code)) {
        const btn = root.querySelectorAll<HTMLButtonElement>('.dlg-choice')[Number(e.code.slice(5)) - 1];
        btn?.click();
      }
    };
    root.addEventListener('click', () => advance());
    window.addEventListener('keydown', onKey);
    render();
  });
}
