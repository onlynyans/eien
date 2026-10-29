// How a link in Live is shown (backlog #38): one small interface each way of
// showing it implements (./link-card.ts, ./link-inline.ts, ./link-bar.ts),
// and the pieces they share. A presenter only draws and forwards: what a
// link is and what's done to it is ./link-core.ts's, and when it shows is
// ./link-tooltips.ts's. Words and addresses go into the window as text,
// never as HTML.

import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { ariaKeys, keyText } from '../chrome/keys';
import { h } from '../dom';
import { type IconName, icon } from '../icons';
import type { Link, LinkChange } from './link-core';

export const MAC = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/** The note a wiki link names, as the note list shows it (its folders, title, first line, words). */
export interface LinkNote {
  readonly crumbs: string;
  readonly title: string;
  readonly preview: string;
  readonly words: number;
}

/** A link being shown: the link, the note it names, and where it stands now. */
export interface ShownLink {
  readonly link: Link;
  /** The note a wiki link names; null for the web, or a note not made yet. */
  readonly note: LinkNote | null;
  /** Its box in the window, or null when it's out of sight. */
  box(): LinkBox | null;
}

export interface LinkBox {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
}

/** What brought it: the pointer resting on it, or the caret in it. */
export type ShownBy = 'hover' | 'caret';

/** What a presenter may do to the link it shows: ./link-tooltips.ts runs it with ./link-core.ts. */
export interface LinkDoes {
  /** Follow the link shown, or `link` (In place's ↗, which stands by its own). */
  open(link?: Link): void;
  /** False when the link has gone from under it, and nothing changed. */
  change(change: LinkChange): boolean;
  takeOff(): void;
  /** The keyboard back to the text, the caret where it was. */
  back(): void;
  /** Its own editing is over (kept or put back): show what's wanted now. */
  done(): void;
  /** Say it in the colophon. */
  tell(words: string): void;
}

/** Where a presenter draws: over the page, docked at its foot, or in the text itself. */
export interface LinkHost {
  readonly view: EditorView;
  /** Floats over the page, outside the editor's shadow root: the window's own controls. */
  readonly layer: HTMLElement;
  /** Over the colophon, above a phone's keyboard. */
  readonly dock: HTMLElement;
}

export interface LinkPresenter {
  /** How long the pointer rests on a link before it shows. */
  readonly hoverMs: number;
  /** What it adds to the editor (In place's decorations), while it's the one chosen. */
  readonly extension: Extension;
  /** Editing in its own field: the caret and the pointer leave it be. */
  readonly busy: boolean;
  show(shown: ShownLink, by: ShownBy): void;
  hide(): void;
  /** Where it stands moved (a scroll, a resize): follow it. */
  place(): void;
  /** ⌘K: edit the link, its own way. */
  edit(): void;
  /** ⌥F10: the keyboard onto its tools; false when it has none to give. */
  reach(): boolean;
  /** Whether `node` is part of it, where the pointer or the keyboard may go without leaving the link. */
  holds(node: Node | null): boolean;
  destroy(): void;
}

export type PresenterOf = (host: LinkHost, does: LinkDoes) => LinkPresenter;

/** The keys every presenter names: open, edit, the tools. */
export const LINK_KEYS = { open: 'Alt-Enter', edit: 'Mod-k', tools: 'Alt-F10' } as const;

/** ⌘-click or Ctrl-click: the pointer's way to follow any link. */
export const MOD_CLICK = MAC ? '⌘-click' : 'Ctrl-click';

/** A tool: the icon control with its name and its key's tooltip; its word beside it where asked (a phone's card). */
export function toolButton(
  name: IconName,
  label: string,
  run: () => void,
  options: { readonly keys?: string; readonly word?: string } = {},
): HTMLButtonElement {
  const { keys, word } = options;
  return h(
    'button',
    {
      class: word ? 'icon-button link-tool link-tool--word' : 'icon-button link-tool',
      attrs: {
        type: 'button',
        tabindex: '-1',
        'aria-label': label,
        'data-tip': label,
        'data-shortcut': keys ? keyText(keys, MAC) : undefined,
        'aria-keyshortcuts': keys ? ariaKeys(keys, MAC) : undefined,
      },
      on: {
        // The pointer's press keeps the caret in the text, and the link's tools with it.
        mousedown: (event) => event.preventDefault(),
        click: run,
      },
    },
    icon(name),
    word ? h('span', { class: 'link-tool__word', text: word }) : null,
  );
}

/**
 * A toolbar's keys: one tab stop, the arrows along it, Home and End, Esc
 * back to the text (as the table's bar).
 */
export function roving(bar: HTMLElement, back: () => void): void {
  bar.addEventListener('keydown', (event) => {
    const buttons = [...bar.querySelectorAll<HTMLButtonElement>('button:not([hidden])')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') back();
    else if (at === -1) return;
    else {
      const last = buttons.length - 1;
      const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: last }[event.key];
      if (to === undefined) return;
      buttons[(to + buttons.length) % buttons.length]?.focus();
    }
    event.preventDefault();
    event.stopPropagation();
  });
  bar.addEventListener('focusin', (event) => {
    for (const button of bar.querySelectorAll('button'))
      button.tabIndex = button === event.target ? 0 : -1;
  });
}

/** Its tools' first stop, given the keyboard. */
export function focusTools(bar: HTMLElement): boolean {
  const first =
    bar.querySelector<HTMLButtonElement>('button[tabindex="0"]') ??
    bar.querySelector<HTMLButtonElement>('button');
  first?.focus();
  return first !== null;
}

/** An address as the machine shows it: its site, then the rest, without "https://". */
export function addressParts(address: string): { readonly site: string; readonly rest: string } {
  const bare = address.replace(/^https?:\/\//i, '');
  const cut = bare.search(/[/?#]/);
  return cut === -1
    ? { site: bare, rest: '' }
    : { site: bare.slice(0, cut), rest: bare.slice(cut) };
}

/** Where a link goes, in a few words: a note's title, or its address. */
export function whereTo(shown: ShownLink): string {
  const { link, note } = shown;
  if (link.kind === 'web') {
    const { site, rest } = addressParts(link.goesTo);
    return site + rest;
  }
  return note ? note.title : `${link.goesTo}, not made yet`;
}

/** A float's place: under the link (`below`) or over it, turned to the other side if there's no room, kept in the window. */
export function placeFloat(element: HTMLElement, box: LinkBox, side: 'below' | 'above'): void {
  const gap = 4; // the scale's first step: close enough to read as the link's
  const room = 8; // and the second, from the window's edge
  const { offsetWidth: width, offsetHeight: height } = element;
  let below = side === 'below';
  if (below && box.bottom + gap + height > window.innerHeight - room) below = false;
  if (!below && box.top - gap - height < room) below = true;
  const left = Math.max(room, Math.min(box.left, window.innerWidth - width - room));
  element.style.setProperty('--link-x', `${left}px`);
  element.style.setProperty('--link-y', `${below ? box.bottom + gap : box.top - gap - height}px`);
  element.dataset.side = below ? 'below' : 'above';
}

/** Whether nothing can hover here (a phone): a tap is the pointer, and tools take a finger's size. */
export const touch = (): boolean => window.matchMedia('(hover: none)').matches;
