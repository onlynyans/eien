// 3 · A bar with the caret (docs/design/explorations/link-bar.html, links.md).
//
// Intent: the same writer, who wants the least over the page and nothing new
// to learn: the selection bar's sibling, its place, look and way. With the
// caret in a link, a small bar sits over its line: an icon for the kind (a
// page or the web), where it goes (a note's title in the text face, an
// address in the mono, cut short), then Open, Edit, Take off. Edit, or
// pressing where it goes, makes that a field in the bar; the words are edited
// on the page, where they are. A hover gets only a tooltip, the window's own
// look: where it goes and the pointer's way to open it.
// Palette: Washi's tokens; the kind's icon in pencil, the tools ink-soft.
// Depth: the selection bar's surface exactly (editor.css): raised paper, a
// rule hairline, --eien-radius-m, the float shadow, 4px round. On a phone,
// the table bar's dock instead: the band ground, a rule above, no shadow,
// 44px targets, above the keyboard. Spacing: 4px padding, half a step between
// tools, a hairline rule after where it goes.

import { h } from '../dom';
import { icon } from '../icons';
import { canTakeOff } from './link-core';
import {
  focusTools,
  LINK_KEYS,
  type LinkDoes,
  type LinkHost,
  type LinkPresenter,
  MOD_CLICK,
  placeFloat,
  roving,
  type ShownBy,
  type ShownLink,
  toolButton,
  touch,
  whereTo,
} from './link-presenter';

/** The window's tooltip's own wait (../chrome/tooltip.ts). */
const HOVER_MS = 450;

export function linkBar(host: LinkHost, does: LinkDoes): LinkPresenter {
  const bar = h('div', { class: 'link-bar', attrs: { role: 'toolbar', hidden: true } });
  const words = h('span', { class: 'tooltip__words' });
  const key = h('span', { class: 'tooltip__key' });
  const tip = h(
    'div',
    { class: 'tooltip link-tip', attrs: { 'aria-hidden': 'true', hidden: true } },
    words,
    key,
  );
  host.layer.append(bar, tip);
  roving(bar, () => does.back());
  let shown: ShownLink | null = null;
  let by: ShownBy = 'caret';
  let busy = false;

  /** Over the link's line, or on a phone docked above the keyboard. */
  const place = () => {
    const docked = touch();
    bar.classList.toggle('link-bar--docked', docked);
    const home = docked ? host.dock : host.layer;
    if (bar.parentElement !== home) home.append(bar);
    const box = shown?.box() ?? null;
    if (!box) return;
    if (by === 'hover') placeFloat(tip, box, 'below');
    else if (!docked) placeFloat(bar, box, 'above');
  };

  const draw = (at: ShownLink) => {
    const { link, note } = at;
    const missing = link.kind === 'note' && !note;
    const to = h('button', {
      class: `link-bar__to${link.kind === 'note' ? ' link-bar__to--note' : ''}${missing ? ' link-bar__to--none' : ''}`,
      text: whereTo(at),
      attrs: {
        type: 'button',
        tabindex: '-1',
        'aria-label': `Goes to ${whereTo(at)}: edit`,
        'data-tip': 'Edit where it goes',
      },
      on: { mousedown: (event) => event.preventDefault(), click: () => edit() },
    });
    const open = toolButton(
      'openLink',
      `Open ${whereTo(at)}`,
      () => {
        if (missing) does.tell(`No note called ${link.goesTo} yet`);
        else does.open();
      },
      { keys: LINK_KEYS.open },
    );
    if (missing) open.setAttribute('aria-disabled', 'true');
    open.tabIndex = 0;
    bar.replaceChildren(
      h('span', { class: 'link-bar__kind' }, icon(link.kind === 'web' ? 'web' : 'note')),
      to,
      h('span', { class: 'link-bar__rule', attrs: { 'aria-hidden': 'true' } }),
      open,
      toolButton('rename', 'Edit where it goes', () => edit(), { keys: LINK_KEYS.edit }),
      ...(canTakeOff(link)
        ? [toolButton('unlink', 'Take the link off: the words stay', () => does.takeOff())]
        : []),
    );
    bar.setAttribute('aria-label', `Link to ${whereTo(at)}`);
  };

  /** Where it goes, as a field in the bar. ↩ keeps, Esc puts back, leaving keeps. */
  const edit = () => {
    const at = shown;
    if (!at || by !== 'caret') return;
    busy = true;
    const input = h('input', {
      class: 'field link-field',
      attrs: {
        type: 'text',
        spellcheck: 'false',
        'aria-label': 'Goes to: a note’s name, or an address',
        placeholder: 'A note’s name, or an address',
      },
    });
    input.value = at.link.goesTo; // as text, never markup
    let done = false;
    const finish = (keep: boolean, back: boolean) => {
      if (done) return;
      done = true;
      busy = false;
      if (keep) does.change({ goesTo: input.value });
      if (back) does.back();
      does.done();
    };
    input.addEventListener('keydown', (event) => {
      if ((event.key !== 'Enter' && event.key !== 'Escape') || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === 'Enter', true);
    });
    input.addEventListener('blur', () => finish(true, false));
    const kind = bar.querySelector('.link-bar__kind');
    bar.replaceChildren(...(kind ? [kind] : []), input);
    place();
    input.focus();
    input.select();
  };

  return {
    hoverMs: HOVER_MS,
    extension: [],
    get busy() {
      return busy;
    },
    show(at, how) {
      shown = at;
      by = how;
      if (how === 'hover') {
        bar.hidden = true;
        words.textContent = `→ ${whereTo(at)}`;
        key.textContent = MOD_CLICK;
        tip.hidden = false;
      } else {
        tip.hidden = true;
        draw(at);
        bar.hidden = false;
      }
      place();
    },
    hide() {
      shown = null;
      busy = false;
      bar.hidden = true;
      tip.hidden = true;
      bar.replaceChildren();
    },
    place,
    edit,
    reach: () => !bar.hidden && focusTools(bar),
    holds: (node) => node !== null && bar.contains(node),
    destroy() {
      bar.remove();
      tip.remove();
    },
  };
}
