// 2 · In place (docs/design/explorations/link-inline.html, links.md).
//
// Intent: the same writer, who wants nothing over the page and to edit the
// Markdown the file holds, nothing else. With the caret in a link, that
// link's own Markdown opens where it stands, as a name opens for Rename:
// its marks faded as Live shows them (./live-preview.ts, `linkInPlace`), an
// address in the Source font, the 2px focus mark under the part with the
// caret, the caret in the seal. One small control follows it, ↗, to open it.
// Where a link goes, on a hover or with the caret in it, is said in the
// colophon, as a browser's status line says it.
// Palette: Washi's tokens; the marks faded, the address ink-soft, ↗ pencil.
// Depth: none: no surface but the sheet's paper and the colophon's band.
// Typography: the words in the text face; an address in --eien-face-source
// at its size; the colophon in the mono. Spacing: ↗ a step short of a
// control, a step after the link; a finger's reach round it on a phone
// without making the line taller.

import { type EditorState, type Extension, type Range, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { ariaKeys, keyText } from '../chrome/keys';
import { icon } from '../icons';
import { caretLink, type Link } from './link-core';
import {
  LINK_KEYS,
  type LinkDoes,
  type LinkHost,
  type LinkPresenter,
  MAC,
  MOD_CLICK,
  type ShownLink,
  whereTo,
} from './link-presenter';
import { linkInPlace, previewMode } from './preview-mode';

/** The colophon is far from the eye: it says so almost at once (links.md, Open: hover timing). */
const HOVER_MS = 120;

/** ↗ after the link: the one control In place adds, a button the keyboard reaches with ⌥F10. */
class OpenWidget extends WidgetType {
  constructor(
    readonly link: Link,
    readonly press: (link: Link) => void,
    readonly back: () => void,
  ) {
    super();
  }

  override eq(other: OpenWidget): boolean {
    return other.link.from === this.link.from && other.link.goesTo === this.link.goesTo;
  }

  toDOM(): HTMLElement {
    const label = `Open ${this.link.goesTo}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'eien-link-open';
    button.tabIndex = -1;
    button.setAttribute('aria-label', label); // as text, never markup
    button.dataset.tip = label;
    button.dataset.shortcut = keyText(LINK_KEYS.open, MAC);
    button.setAttribute('aria-keyshortcuts', ariaKeys(LINK_KEYS.open, MAC));
    button.append(icon('openLink'));
    // The press keeps the caret in the link; the click opens it.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => this.press(this.link));
    button.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.back();
    });
    return button;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

const address = Decoration.mark({ class: 'eien-link-address' });
const here = Decoration.mark({ class: 'eien-link-here' });

/** The caret's link opened: its address in the Source font, the focus mark under the caret's part, ↗ after. */
function opened(state: EditorState, press: (link: Link) => void, back: () => void): DecorationSet {
  if (state.facet(previewMode) !== 'live') return Decoration.none;
  const head = state.selection.main.head;
  const link = caretLink(state, head);
  if (!link) return Decoration.none;
  const out: Range<Decoration>[] = [];
  const { wordsAt, goesAt } = link;
  const onAddress = head >= goesAt.from && head <= goesAt.to && goesAt.from !== wordsAt.from;
  if (link.kind === 'web' && link.form === 'inline' && goesAt.to > goesAt.from)
    out.push(address.range(goesAt.from, goesAt.to));
  const part = onAddress ? goesAt : wordsAt;
  if (part.to > part.from) out.push(here.range(part.from, part.to));
  out.push(
    Decoration.widget({ widget: new OpenWidget(link, press, back), side: 1 }).range(link.to),
  );
  return Decoration.set(out, true);
}

/** Its look, beside it: the window's sheets don't reach into the editor's shadow root. */
const look = EditorView.theme({
  '.eien-link-address': {
    fontFamily: 'var(--eien-face-source)',
    fontSize: 'var(--eien-size-source)',
    color: 'var(--eien-ink-soft)',
  },
  // Rename's focus mark, under the part being edited.
  '.eien-link-here': {
    textDecoration: 'none',
    boxShadow: '0 var(--eien-mark-w) 0 var(--eien-focus)',
  },
  '.eien-link-open': {
    position: 'relative',
    display: 'inline-grid',
    placeItems: 'center',
    width: 'calc(var(--eien-control) - var(--eien-space-1))',
    height: 'calc(var(--eien-control) - var(--eien-space-1))',
    marginInlineStart: 'var(--eien-space-1)',
    padding: '0',
    verticalAlign: 'middle',
    border: 'var(--eien-hairline) solid transparent',
    borderRadius: 'var(--eien-radius-s)',
    background: 'none',
    color: 'var(--eien-pencil)',
    cursor: 'pointer',
    transition:
      'color var(--eien-quick) var(--eien-ease), background var(--eien-quick) var(--eien-ease)',
  },
  '.eien-link-open .icon': {
    width: 'var(--eien-icon)',
    height: 'var(--eien-icon)',
    strokeWidth: 'var(--eien-icon-stroke)',
  },
  '.eien-link-open:active': {
    background: 'var(--eien-press)',
    borderColor: 'var(--eien-rule-strong)',
  },
  '.eien-link-open:focus-visible': {
    outline: 'var(--eien-mark-w) solid var(--eien-focus)',
    outlineOffset: 'calc(var(--eien-mark-w) * -1)',
  },
  '@media (hover: hover)': {
    '.eien-link-open:hover': { color: 'var(--eien-ink)', background: 'var(--eien-hover)' },
  },
  // A finger's reach, round the control, without making the line taller.
  '@media (hover: none)': {
    '.eien-link-open::before': {
      content: '""',
      position: 'absolute',
      inset: 'calc((var(--eien-touch) - var(--eien-control)) / -2)',
    },
  },
});

export function linkInline(host: LinkHost, does: LinkDoes): LinkPresenter {
  let shown: ShownLink | null = null;
  /** ↗ pressed: a note not made yet says so, rather than opening nothing. */
  const press = (link: Link) => {
    const known = shown?.link.from === link.from ? shown : null;
    if (link.kind === 'note' && known && !known.note)
      does.tell(`No note called ${link.goesTo} yet`);
    else does.open(link);
  };
  const back = () => does.back();
  const decorations = StateField.define<DecorationSet>({
    create: (state) => opened(state, press, back),
    update: (value, tr) =>
      tr.docChanged || tr.selection || tr.reconfigured ? opened(tr.state, press, back) : value,
    provide: (field) => EditorView.decorations.from(field),
  });
  const button = () => host.view.contentDOM.querySelector<HTMLButtonElement>('.eien-link-open');
  const extension: Extension = [linkInPlace.of(true), decorations, look];

  return {
    hoverMs: HOVER_MS,
    extension,
    busy: false,
    show(at) {
      shown = at;
      does.tell(`→ ${whereTo(at)} · ${MOD_CLICK} opens`);
    },
    hide() {
      shown = null;
    },
    place() {},
    /** ⌘K: where it goes, chosen in the text, to type over. */
    edit() {
      const link = shown?.link;
      if (!link) return;
      host.view.dispatch({
        selection: { anchor: link.goesAt.from, head: link.goesAt.to },
        scrollIntoView: true,
      });
      host.view.focus();
    },
    reach() {
      const open = button();
      open?.focus();
      return open !== null;
    },
    holds(node) {
      // ↗ is in the editor's shadow root: from outside, the root's host stands for it.
      const open = button();
      if (!open || !node) return false;
      const root = host.view.dom.getRootNode();
      const outside = root instanceof ShadowRoot && node === root.host;
      return node === open || (outside && host.view.root.activeElement === open);
    },
    destroy() {
      shown = null;
    },
  };
}
