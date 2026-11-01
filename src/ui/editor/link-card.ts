// 1 · A card under the link (docs/design/explorations/link-card.html, links.md).
//
// Intent: the writer, late at night in a planning note full of chapter
// links, asks of a [[link]] "which chapter is that?", fixes it, opens it,
// and keeps their line. The card answers with the note's own row from the
// list: its folders in label type, its title and first line in the text face
// (a person wrote them), its words in the mono (the machine counted them). A
// web link's card is its address, the site in ink and the rest in pencil.
// Palette: Washi's tokens; no vermilion but the caret in its fields.
// Depth: what floats, as a menu does: raised paper, a rule-strong hairline,
// the float shadow, --eien-radius-m. Surfaces: its fields are set in, the
// field wash, the well when focused. Spacing: the row's 12px inside, the
// tools 4px from its edge. Its width is the list's, a phone's the sheet's.

import { h } from '../dom';
import { canTakeOff } from './link-core';
import {
  addressParts,
  focusTools,
  LINK_KEYS,
  type LinkBox,
  type LinkDoes,
  type LinkHost,
  type LinkPresenter,
  MOD_CLICK,
  placeFloat,
  roving,
  type ShownLink,
  toolButton,
  touch,
  whereTo,
} from './link-presenter';

/** The pointer rests this long on a link before its card comes (links.md, Open: hover timing). */
const HOVER_MS = 400;

export function linkCard(host: LinkHost, does: LinkDoes): LinkPresenter {
  const card = h('div', { class: 'link-card', attrs: { role: 'group', hidden: true } });
  host.layer.append(card);
  let shown: ShownLink | null = null;
  let busy = false;

  const place = () => {
    const box: LinkBox | null = shown?.box() ?? null;
    if (box) placeFloat(card, box, 'below');
  };

  /** The card's face: where the link goes, then its tools. */
  const face = (at: ShownLink): HTMLElement[] => {
    const { link, note } = at;
    const body = h('div', { class: 'link-card__body' });
    if (link.kind === 'web') {
      const { site, rest } = addressParts(link.goesTo);
      body.append(
        h('span', { class: 'label', text: 'The web' }),
        h('span', { class: 'link-card__site', text: site }),
        rest ? h('span', { class: 'link-card__path', text: rest }) : '',
      );
    } else if (note) {
      body.append(
        h('span', { class: 'label', text: note.crumbs || 'The vault' }),
        h('span', { class: 'link-card__title', text: note.title }),
        note.preview ? h('span', { class: 'link-card__line', text: note.preview }) : '',
        h('span', { class: 'count', text: `${note.words.toLocaleString('en')} WORDS` }),
      );
    } else {
      body.append(
        h('span', { class: 'label', text: 'No note yet' }),
        h('span', { class: 'link-card__title link-card__title--none', text: link.goesTo }),
      );
    }
    const word = touch();
    const open = toolButton('openLink', `Open ${whereTo(at)}`, () => openOrSay(at), {
      keys: LINK_KEYS.open,
      ...(word ? { word: 'Open' } : {}),
    });
    if (link.kind === 'note' && !note) open.setAttribute('aria-disabled', 'true');
    const tools = h(
      'div',
      { class: 'link-card__tools', attrs: { role: 'toolbar', 'aria-label': 'Link' } },
      open,
      toolButton('rename', 'Edit the link', () => edit(), {
        keys: LINK_KEYS.edit,
        ...(word ? { word: 'Edit' } : {}),
      }),
      canTakeOff(link)
        ? toolButton('unlink', 'Take the link off: the words stay', () => does.takeOff(), {
            ...(word ? { word: 'Take off' } : {}),
          })
        : null,
      h('span', { class: 'link-card__hint label', text: `${MOD_CLICK} opens` }),
    );
    open.tabIndex = 0;
    roving(tools, () => does.back());
    return [body, tools];
  };

  /** A note not made yet says so, rather than opening nothing. */
  const openOrSay = (at: ShownLink) => {
    if (at.link.kind === 'note' && !at.note) does.tell(`No note called ${at.link.goesTo} yet`);
    else does.open();
  };

  /** The card's other face: the words and where it goes, as two fields. ↩ keeps, Esc puts back, leaving keeps. */
  const edit = () => {
    const at = shown;
    if (!at) return;
    busy = true;
    const field = (id: string, label: string, value: string, words: boolean) => {
      const input = h('input', {
        class: words ? 'field link-field link-field--words' : 'field link-field',
        attrs: { id, type: 'text', spellcheck: words ? undefined : 'false' },
      });
      input.value = value; // as text, never markup
      return {
        input,
        row: h(
          'div',
          { class: 'link-card__field' },
          h('label', { class: 'label', text: label, attrs: { for: id } }),
          input,
        ),
      };
    };
    const id = `link-${Math.random().toString(36).slice(2)}`;
    const words = field(`${id}-words`, 'Words', at.link.words, true);
    const goes = field(`${id}-goes`, 'Goes to', at.link.goesTo, false);
    goes.input.placeholder = 'A note’s name, or an address';
    const form = h(
      'form',
      { class: 'link-card__edit', attrs: { 'aria-label': 'Edit the link' } },
      words.row,
      goes.row,
      h('span', { class: 'label', text: '↩ keeps · esc puts back' }),
    );
    let done = false;
    /** Kept or put back; then the keyboard back to the text (↩, Esc) or left where it went (leaving). */
    const finish = (keep: boolean, back: boolean) => {
      if (done) return;
      done = true;
      busy = false;
      if (keep) does.change({ words: words.input.value, goesTo: goes.input.value });
      if (back) does.back();
      does.done();
    };
    // ↩ in either field: a form of two fields has no Enter of its own.
    form.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      if (event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === 'Enter', true);
    });
    // Leaving keeps, as renaming does.
    form.addEventListener('focusout', (event) => {
      if (!form.contains(event.relatedTarget as Node | null)) finish(true, false);
    });
    card.replaceChildren(form);
    place();
    words.input.focus();
    words.input.select();
  };

  const draw = (at: ShownLink) => {
    card.replaceChildren(...face(at));
    card.setAttribute('aria-label', `Link to ${whereTo(at)}`);
  };

  return {
    hoverMs: HOVER_MS,
    extension: [],
    get busy() {
      return busy;
    },
    show(at) {
      shown = at;
      draw(at);
      card.hidden = false;
      place();
    },
    hide() {
      shown = null;
      busy = false;
      card.hidden = true;
      card.replaceChildren();
    },
    place,
    edit,
    reach: () => !card.hidden && focusTools(card),
    holds: (node) => node !== null && card.contains(node),
    destroy() {
      card.remove();
    },
  };
}
