// A link's tools in Live (backlog #38): when they show, and which way. The
// pointer resting on a link, or the caret in one, shows it; typing steps it
// aside until the caret moves again; Esc puts it away. The keys are the same
// whichever way it's shown: ⌥↩ opens the caret's link, ⌘K edits it, ⌥F10
// takes the keyboard to its tools. The "Link editing" setting chooses the
// presenter (./link-presenter.ts), here and nowhere else; what's done to the
// link is the core's (./link-core.ts).

import { Compartment, type Extension, Prec } from '@codemirror/state';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import type { SettingValues } from '../../core/config';
import { keyText } from '../chrome/keys';
import { h } from '../dom';
import { linkBar } from './link-bar';
import { linkCard } from './link-card';
import {
  caretLink,
  type Link,
  type LinkTarget,
  linkAt,
  linkEdit,
  linkOff,
  targetOf,
} from './link-core';
import { linkInline } from './link-inline';
import {
  LINK_KEYS,
  type LinkBox,
  type LinkDoes,
  type LinkHost,
  type LinkNote,
  type LinkPresenter,
  MAC,
  type PresenterOf,
  type ShownBy,
  type ShownLink,
  whereTo,
} from './link-presenter';
import { isEcho } from './note-doc';
import { previewMode } from './preview-mode';

export type LinkStyle = SettingValues['editor.links'];

/** Each style its presenter: the one place a style's name is read. */
const PRESENTERS: Record<LinkStyle, PresenterOf> = {
  card: linkCard,
  inline: linkInline,
  bar: linkBar,
};

/** As long as the tools wait for a pointer that left them to come back (--eien-quick). */
const GRACE_MS = 120;

export interface LinkParts {
  /** Follow it, as ⌘-click does (the editor's `follow`). */
  follow(target: LinkTarget): void;
  /** The note called `name`, or null when the vault has none. */
  about(name: string): LinkNote | null;
  /** Say it in the colophon. */
  tell(words: string): void;
}

const same = (a: Link | null | undefined, b: Link | null | undefined): boolean =>
  !!a && !!b && a.from === b.from && a.to === b.to && a.words === b.words && a.goesTo === b.goesTo;

export class LinkTooltips {
  /** What floats over the page (a card, a bar), out of the editor's shadow root: the page puts it in its layer. */
  readonly layer = h('div', { class: 'link-layer' });
  /** A phone's docked bar: the page puts it over the colophon. */
  readonly dock = h('div', { class: 'link-dock' });
  /** What a screen reader hears as the caret reaches a link. */
  readonly #said = h('div', { class: 'link-said', attrs: { role: 'status' } });
  readonly #view: () => EditorView;
  readonly #parts: LinkParts;
  readonly #host: LinkHost;
  readonly #does: LinkDoes;
  readonly #presenters = new Compartment();
  #style: LinkStyle = 'card';
  #presenter: LinkPresenter;
  #shown: { link: Link; by: ShownBy } | null = null;
  /** The link under the pointer, and whether the pointer is on the tools. */
  #hovered: Link | null = null;
  #onTools = false;
  /** Typing, or Esc: the caret's link waits till the caret moves. */
  #aside = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #follow = () => this.#presenter.place();

  constructor(view: () => EditorView, parts: LinkParts) {
    this.#view = view;
    this.#parts = parts;
    this.layer.append(this.#said);
    this.#host = {
      get view() {
        return view();
      },
      layer: this.layer,
      dock: this.dock,
    };
    this.#does = {
      open: (link) => this.#open(link ?? this.#current()),
      change: (change) => {
        const link = this.#current();
        // Held still (a move, a trash): nothing reaches the text.
        if (!link || view().state.readOnly) return false;
        const isNote = (name: string) => parts.about(name) !== null;
        const spec = linkEdit(view().state, link, change, isNote);
        if (spec) view().dispatch(spec);
        return true;
      },
      takeOff: () => {
        const link = view().state.readOnly ? null : this.#current();
        const spec = link && linkOff(link);
        if (spec) view().dispatch(spec);
        this.#does.back();
      },
      back: () => view().focus(),
      done: () => {
        this.#put(null);
        this.#settle(0);
      },
      tell: (words) => parts.tell(words),
    };
    this.#presenter = PRESENTERS[this.#style](this.#host, this.#does);
    for (const area of [this.layer, this.dock]) {
      area.addEventListener('pointerover', (event) => this.#pointerOnTools(event.target));
      area.addEventListener('pointerout', (event) => this.#pointerOnTools(event.relatedTarget));
    }
  }

  /** In the editor's state: the keys, the caret and pointer heard, and the presenter's own. */
  get extension(): Extension {
    return [
      Prec.high(
        keymap.of([
          { key: LINK_KEYS.open, run: () => this.#open(this.#caret(true)) },
          { key: LINK_KEYS.edit, run: () => this.#reach((presenter) => presenter.edit()) },
          { key: LINK_KEYS.tools, run: () => this.#reach((presenter) => presenter.reach()) },
          { key: 'Escape', run: () => this.#away() },
        ]),
      ),
      EditorView.updateListener.of((update) => this.#updated(update)),
      EditorView.domEventHandlers({
        pointermove: (event, view) => {
          if (event.pointerType === 'mouse') this.#hover(this.#linkUnder(event.target, view));
          return false;
        },
        pointerleave: () => {
          this.#hover(null);
          return false;
        },
      }),
      this.#presenters.of(this.#presenter.extension),
    ];
  }

  /** Show links the way `style` does, from now on (the setting changed). */
  use(style: LinkStyle): void {
    if (style === this.#style) return;
    this.#style = style;
    this.hide();
    this.#presenter.destroy();
    this.#presenter = PRESENTERS[style](this.#host, this.#does);
    this.#view().dispatch({ effects: this.#presenters.reconfigure(this.#presenter.extension) });
    this.#settle(0);
  }

  /** Nothing shown (another note on the page). */
  hide(): void {
    clearTimeout(this.#timer);
    this.#hovered = null;
    this.#onTools = false;
    this.#put(null);
  }

  destroy(): void {
    this.hide();
    this.#presenter.destroy();
    this.layer.remove();
    this.dock.remove();
  }

  #updated(update: ViewUpdate): void {
    // Typed, pasted or deleted in this view; a link's own edit isn't typing, nor another view's echo.
    const typed = update.transactions.some(
      (tr) =>
        tr.docChanged &&
        !isEcho(tr) &&
        !tr.isUserEvent('input.link') &&
        (tr.isUserEvent('input') || tr.isUserEvent('delete')),
    );
    if (typed) this.#aside = true;
    else if (update.selectionSet) this.#aside = false;
    const moved =
      typed ||
      update.selectionSet ||
      update.focusChanged ||
      update.startState.facet(previewMode) !== update.state.facet(previewMode);
    // The pointer's rest is spent once the caret moves: the caret's link is the one wanted.
    if (moved && (typed || update.selectionSet)) this.#hovered = null;
    // Read once the update is done: the presenters measure where the link stands.
    if (moved) queueMicrotask(() => this.#settle(0));
  }

  /** The link the caret is in, in Live, with nothing selected, while the keyboard's in the note or its tools. */
  #caret(evenAside = false): Link | null {
    const view = this.#view();
    const { state } = view;
    const { main } = state.selection;
    if (state.facet(previewMode) !== 'live' || state.readOnly || !main.empty) return null;
    if (this.#aside && !evenAside) return null;
    const keyboard = view.hasFocus || this.#presenter.holds(document.activeElement);
    return keyboard ? caretLink(state, main.head) : null;
  }

  /** The link drawn under `target` in Live (its words, marked `.eien-link`). */
  #linkUnder(target: EventTarget | null, view: EditorView): Link | null {
    if (view.state.facet(previewMode) !== 'live' || !(target instanceof Element)) return null;
    const words = target.closest('.eien-link');
    return words ? linkAt(view.state, view.posAtDOM(words, 0)) : null;
  }

  #hover(link: Link | null): void {
    if (same(link, this.#hovered) || (!link && !this.#hovered)) return;
    this.#hovered = link;
    this.#settle();
  }

  #pointerOnTools(target: EventTarget | null): void {
    const on = target instanceof Node && this.#presenter.holds(target);
    if (on === this.#onTools) return;
    this.#onTools = on;
    this.#settle();
  }

  /** What should show now, after `delay` (a new link under the pointer waits the presenter's time). */
  #settle(delay?: number): void {
    clearTimeout(this.#timer);
    if (this.#presenter.busy) return;
    const wanted = this.#wanted();
    const wait =
      delay ??
      (wanted?.by === 'hover' && !same(wanted.link, this.#shown?.link)
        ? this.#presenter.hoverMs
        : GRACE_MS);
    if (wait === 0) this.#put(this.#wanted());
    else this.#timer = setTimeout(() => this.#put(this.#wanted()), wait);
  }

  #wanted(): { link: Link; by: ShownBy } | null {
    if (this.#onTools && this.#shown) return this.#shown;
    if (this.#hovered) return { link: this.#hovered, by: 'hover' };
    const caret = this.#caret();
    if (caret) return { link: caret, by: 'caret' };
    // The keyboard on the tools of a link the pointer brought keeps them.
    if (this.#shown && this.#presenter.holds(document.activeElement)) return this.#shown;
    return null;
  }

  #put(wanted: { link: Link; by: ShownBy } | null): void {
    if (this.#presenter.busy) return;
    const was = this.#shown;
    if (!wanted) {
      if (!was) return;
      this.#shown = null;
      this.#presenter.hide();
      document.removeEventListener('scroll', this.#follow, true);
      window.removeEventListener('resize', this.#follow);
      return;
    }
    if (was && same(was.link, wanted.link) && was.by === wanted.by) return;
    this.#shown = wanted;
    const { link } = wanted;
    const shown: ShownLink = {
      link,
      note: link.kind === 'note' ? this.#parts.about(link.goesTo) : null,
      box: () => this.#box(link),
    };
    this.#presenter.show(shown, wanted.by);
    if (!was) {
      document.addEventListener('scroll', this.#follow, true);
      window.addEventListener('resize', this.#follow);
    }
    if (wanted.by === 'caret' && !same(was?.link, link)) this.#say(shown);
  }

  /** The link's words on the screen: from where they start to the foot of where they end. */
  #box(link: Link): LinkBox | null {
    const view = this.#view();
    const start = view.coordsAtPos(link.wordsAt.from, 1);
    const end = view.coordsAtPos(link.wordsAt.to, -1);
    if (!start || !end) return null;
    return { left: start.left, top: start.top, bottom: Math.max(start.bottom, end.bottom) };
  }

  #say(shown: ShownLink): void {
    const open = keyText(LINK_KEYS.open, MAC);
    const tools = keyText(LINK_KEYS.tools, MAC);
    this.#said.textContent = `Link to ${whereTo(shown)}. ${open} opens it; ${tools}, its tools.`;
  }

  /** The link shown, as the text has it now; null when it's gone from under it. */
  #current(): Link | null {
    const shown = this.#shown?.link;
    if (!shown) return null;
    const now = linkAt(this.#view().state, shown.wordsAt.from);
    return same(now, shown) ? now : null;
  }

  #open(link: Link | null): boolean {
    if (!link) return false;
    this.#parts.follow(targetOf(link));
    return true;
  }

  /** ⌘K and ⌥F10: the caret's link shown (even after typing), then its tools asked. */
  #reach(ask: (presenter: LinkPresenter) => unknown): boolean {
    const link = this.#caret(true);
    if (!link) return false;
    this.#aside = false;
    this.#hovered = null;
    clearTimeout(this.#timer);
    this.#put({ link, by: 'caret' });
    ask(this.#presenter);
    return true;
  }

  /** Esc: what's shown is put away, till the caret moves. */
  #away(): boolean {
    if (!this.#shown || this.#presenter.busy) return false;
    this.#aside = true;
    this.hide();
    return true;
  }
}
