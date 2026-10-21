// The sidebar's foot: the last action's news (when there's no list to show
// it), how many notes, and the window's controls, which the layout draws in
// `controls` (../chrome: day or night, three panes or two, the settings).
// Made once and kept: a redraw of the tree changes its words, not its
// controls, so the keyboard stays where it was.

import { h } from '../dom';
import { noteCount } from '../list/note-count';

export interface FootModel {
  readonly notice: string | null;
  readonly noteCount: number;
}

export class SidebarFoot {
  readonly element: HTMLElement;
  /** Where the layout draws the foot's controls. */
  readonly controls = h('div', { class: 'sidebar__controls' });
  /** Before the controls: the sync status's place (backlog #10). */
  readonly sync = h('span', { class: 'sidebar__sync' });
  readonly #notice = h('p', { class: 'sidebar__notice', attrs: { role: 'status', hidden: true } });
  readonly #count = h('p', { class: 'count sidebar__count' });

  constructor() {
    this.element = h(
      'footer',
      { class: 'sidebar__foot' },
      this.#notice,
      h('div', { class: 'sidebar__foot-row' }, this.#count, this.sync, this.controls),
    );
  }

  /** Its words, written only where they changed: every redraw of the tree comes here. */
  draw(model: FootModel): void {
    const notice = model.notice ?? '';
    if (this.#notice.textContent !== notice) this.#notice.textContent = notice;
    if (this.#notice.hidden !== !model.notice) this.#notice.hidden = !model.notice;
    const count = noteCount(model.noteCount);
    if (this.#count.textContent !== count) this.#count.textContent = count;
  }
}
