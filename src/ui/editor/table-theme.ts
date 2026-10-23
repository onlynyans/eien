// How the table's controls look (./table-tools.ts), from the design tokens
// alone (docs/design/explorations/table-menus.html): a grip as a list row's
// grip, faded in for the row and column under the pointer or the caret; a +
// on raised paper at a line's end, with the line, 2px ink-soft, where the
// new row or column goes; the drop line as your order's. Nothing on a pointer
// that can't hover: a phone has the table bar.

import { EditorView } from '@codemirror/view';

export const tableTheme = EditorView.theme({
  '.eien-table-tools': {
    position: 'absolute',
    inset: '0',
    zIndex: '2',
    pointerEvents: 'none',
  },
  '.eien-table-tools > *': { pointerEvents: 'auto' },
  '.eien-table-tools .icon': {
    width: '14px',
    height: '14px',
    strokeWidth: 'var(--eien-icon-stroke)',
  },
  '.eien-table-grip, .eien-table-add': {
    position: 'absolute',
    translate: '-50% -50%',
    display: 'grid',
    placeItems: 'center',
    padding: '0',
    appearance: 'none',
    border: 'var(--eien-hairline) solid transparent',
    borderRadius: 'var(--eien-radius-s)',
    background: 'none',
    color: 'var(--eien-pencil)',
    font: 'inherit',
  },
  '.eien-table-grip': {
    cursor: 'grab',
    touchAction: 'none',
    opacity: '0',
    transition: 'opacity var(--eien-quick) var(--eien-ease)',
  },
  '.eien-table-grip--row': { width: '20px', height: '26px' },
  '.eien-table-grip--column': { width: '32px', height: '20px' },
  '.eien-table-grip.is-shown, .eien-table-grip:hover, .eien-table-grip:focus-visible, .eien-table-grip[aria-expanded="true"], .eien-table-grip.is-carried':
    { opacity: '1' },
  '.eien-table-grip:hover': { color: 'var(--eien-ink)', background: 'var(--eien-hover)' },
  '.eien-table-grip[aria-expanded="true"]': {
    color: 'var(--eien-ink)',
    borderColor: 'var(--eien-rule-strong)',
  },
  '.eien-table-grip.is-carried': {
    cursor: 'grabbing',
    color: 'var(--eien-ink)',
    background: 'var(--eien-paper-raised)',
    borderColor: 'var(--eien-rule-strong)',
  },
  '.eien-table-grip:focus-visible, .eien-table-add:focus-visible': {
    outline: 'var(--eien-mark-w) solid var(--eien-focus)',
  },
  '.eien-table-add': { cursor: 'pointer', color: 'var(--eien-ink-soft)' },
  '.eien-table-add--column': { width: '16px', height: '24px' },
  '.eien-table-add--row': { width: '24px', height: '16px' },
  // The + itself: raised paper, shown only on its line.
  '.eien-table-add .icon': {
    width: '18px',
    height: '18px',
    padding: '2px',
    boxSizing: 'border-box',
    background: 'var(--eien-paper-raised)',
    border: 'var(--eien-hairline) solid var(--eien-rule-strong)',
    borderRadius: 'var(--eien-radius-s)',
    opacity: '0',
    transition: 'opacity var(--eien-quick) var(--eien-ease)',
  },
  '.eien-table-add.is-near .icon, .eien-table-add:hover .icon, .eien-table-add:focus-visible .icon':
    { opacity: '1' },
  // Where the new row or column goes: a line across or down the table.
  '.eien-table-add::after': {
    content: '""',
    position: 'absolute',
    pointerEvents: 'none',
    background: 'var(--eien-ink-soft)',
    borderRadius: 'var(--eien-radius-dot)',
    opacity: '0',
  },
  '.eien-table-add--column::after': {
    top: 'calc(50% + 14px)',
    left: 'calc(50% - 1px)',
    width: 'var(--eien-mark-w)',
    height: 'var(--table-height)',
  },
  '.eien-table-add--row::after': {
    left: 'calc(50% + 40px)',
    top: 'calc(50% - 1px)',
    height: 'var(--eien-mark-w)',
    width: 'var(--table-width)',
  },
  '.eien-table-add.is-near::after, .eien-table-add:hover::after, .eien-table-add:focus-visible::after':
    { opacity: '1' },
  // The drop line, as your order's.
  '.eien-table-drop': {
    position: 'absolute',
    display: 'none',
    pointerEvents: 'none',
    background: 'var(--eien-ink-soft)',
    borderRadius: 'var(--eien-radius-dot)',
  },
  '.eien-table-drop.is-on': { display: 'block' },
  '@media (hover: none)': { '.eien-table-tools': { display: 'none' } },
  '@media (prefers-reduced-motion: reduce)': {
    '.eien-table-grip, .eien-table-add .icon': { transition: 'none' },
  },
});
