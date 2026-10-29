// How the editor looks, from the design tokens alone. The editor lives in
// a shadow root; the tokens reach it because custom properties inherit.

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/** Code beside the words, in a line or a block: a size short of theirs, as a mono face runs large. */
const CODE_SIZE = '0.86em';

export const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--eien-ink)',
    backgroundColor: 'transparent',
    fontSize: 'var(--eien-size-prose)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--eien-face-text)',
    // Line spacing's step over the face's own (ui/settings/look-properties.ts).
    lineHeight: 'calc(var(--eien-leading-prose) * var(--look-lead, 1))',
    overflow: 'visible',
  },
  '.cm-content': {
    padding: '0',
    caretColor: 'var(--eien-seal)',
    minHeight: '40vh',
  },
  '.cm-line': { padding: '0' },
  // Focus mode: every paragraph but the caret's fades back (ui/editor/writing-tools.ts).
  '&.eien-focus .cm-line': {
    opacity: 'var(--eien-dimmed)',
    transition: 'opacity var(--eien-calm) var(--eien-ease)',
  },
  '&.eien-focus .cm-line.eien-current': { opacity: '1' },
  // What Live draws as a block (lines it hides) isn't a line, and is never where the caret writes.
  '&.eien-focus .cm-content > :not(.cm-line)': {
    opacity: 'var(--eien-dimmed)',
    transition: 'opacity var(--eien-calm) var(--eien-ease)',
  },
  // Typewriter scrolling: room below the last line, so it too can come to the middle.
  '&.eien-typewriter .cm-content': { paddingBottom: '50vh' },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--eien-seal)',
    borderLeftWidth: 'var(--eien-mark-w)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--eien-seal-wash)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--eien-seal-wash)' },
  // Find's matches (./find-bar.ts): each a neutral fill over a hairline, never the highlight's
  // ochre; the current one is the selection, so the selection's wash, over the focus ink's mark.
  '.cm-searchMatch': {
    backgroundColor: 'var(--eien-selected)',
    boxShadow: 'inset 0 calc(var(--eien-hairline) * -1) var(--eien-rule-strong)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--eien-seal-wash)',
    boxShadow: 'inset 0 calc(var(--eien-mark-w) * -1) var(--eien-focus)',
  },

  // Source: the raw file, in the Source font.
  '&.eien-source .cm-scroller': {
    fontFamily: 'var(--eien-face-source)',
    fontSize: 'var(--eien-size-source)',
    lineHeight: 'calc(var(--eien-leading-prose) * var(--look-lead, 1))',
  },
  // Reading: no caret, nothing to edit.
  '&.eien-reading .cm-content': { caretColor: 'transparent', cursor: 'default' },

  // Live and Reading: what the marks mean, without the marks.
  '.eien-h1': { fontSize: 'var(--eien-size-title)', fontWeight: '500', lineHeight: '1.25' },
  '.eien-h2': { fontSize: 'var(--eien-size-heading)', fontWeight: '600', lineHeight: '1.3' },
  '.eien-h3, .eien-h4, .eien-h5, .eien-h6': { fontWeight: '600' },
  '.eien-quote': {
    borderLeft: 'var(--eien-mark-w) solid var(--eien-rule-strong)',
    paddingLeft: 'var(--eien-space-4) !important',
    color: 'var(--eien-ink-soft)',
  },
  '.eien-underline': { textDecoration: 'underline', textUnderlineOffset: '0.18em' },
  '.eien-em': { fontStyle: 'italic' },
  '.eien-strong': { fontWeight: '600' },
  '.eien-strike': { textDecoration: 'line-through' },
  '.eien-highlight': { backgroundColor: 'var(--eien-caution-wash)', color: 'inherit' },
  '.eien-sup': { verticalAlign: 'super', fontSize: '0.75em' },
  '.eien-sub': { verticalAlign: 'sub', fontSize: '0.75em' },
  '.eien-code': {
    fontFamily: 'var(--eien-face-mono)',
    fontSize: CODE_SIZE,
    backgroundColor: 'var(--eien-well)',
    padding: '0.05em 0.25em',
  },
  // Front matter: the note's data, in the machine's voice, set back.
  '.eien-front-matter': {
    fontFamily: 'var(--eien-face-mono)',
    fontSize: 'var(--eien-size-meta)',
    color: 'var(--eien-pencil)',
  },
  '.eien-codeblock': {
    fontFamily: 'var(--eien-face-source)',
    fontSize: CODE_SIZE,
    backgroundColor: 'var(--eien-well)',
    padding: '0 var(--eien-space-3) !important',
  },
  // A fence out of sight: its line the block's margin above or below the code, one line of the
  // code's size without its leading (CodeMirror keeps an em either side of what it hides).
  '.eien-fence': { lineHeight: '1' },
  '.eien-link': {
    color: 'var(--eien-ink)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--eien-rule-strong)',
    textUnderlineOffset: '0.18em',
  },
  '.eien-mark': { color: 'var(--eien-faded)' },
  '.eien-scene-break': {
    display: 'block',
    textAlign: 'center',
    letterSpacing: '0.6em',
    textIndent: '0.6em',
    color: 'var(--eien-pencil)',
    // The blank lines round "***" already give it room.
    margin: '0',
  },
  '.eien-check': {
    width: '0.9em',
    height: '0.9em',
    margin: '0 0.35em 0 0',
    verticalAlign: '-0.1em',
    accentColor: 'var(--eien-ink-soft)',
    cursor: 'pointer',
  },
  '.eien-done': {
    color: 'var(--eien-pencil)',
    textDecoration: 'line-through',
    textDecorationColor: 'var(--eien-rule-strong)',
  },
  '.eien-image': { display: 'block', maxWidth: '100%', margin: 'var(--eien-space-3) 0' },
  '.eien-image-note': {
    fontFamily: 'var(--eien-face-mono)',
    fontSize: 'var(--eien-size-meta)',
    color: 'var(--eien-pencil)',
  },
  // A table's rows are lines (ui/editor/live-tables.ts), each a row of equal columns: every
  // cell is one element, so the rows' columns line up. Hairlines between, the header on the band.
  '.cm-line.eien-table-row': {
    display: 'flex',
    fontSize: '0.9em',
    borderRight: 'var(--eien-hairline) solid var(--eien-rule)',
    borderBottom: 'var(--eien-hairline) solid var(--eien-rule)',
  },
  '.cm-line.eien-table-head': {
    backgroundColor: 'var(--eien-band)',
    borderTop: 'var(--eien-hairline) solid var(--eien-rule)',
    fontWeight: '600',
  },
  '.eien-cell': {
    flex: '1 1 0',
    minWidth: '0',
    padding: 'var(--eien-space-1) var(--eien-space-3)',
    borderLeft: 'var(--eien-hairline) solid var(--eien-rule)',
  },
  // A column aligned in its delimiter row (":-:", "--:"); figures on the right line up.
  '.eien-cell--center': { textAlign: 'center' },
  '.eien-cell--right': { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  // A pipe on the caret's row, shown as it's written: on the cells' edge, taking no room,
  // so the columns stay where they are.
  '.eien-table-pipe': {
    flex: '0 0 0',
    width: '0',
    overflow: 'visible',
    padding: 'var(--eien-space-1) 0',
    color: 'var(--eien-faded)',
  },
});

/** Markdown's look in every view: marks quiet, words in ink. No seal, no colour for colour's sake. */
const markdownHighlight = HighlightStyle.define([
  { tag: tags.processingInstruction, color: 'var(--eien-faded)' },
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    fontWeight: '600',
  },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], textDecoration: 'underline', color: 'var(--eien-ink-soft)' },
  {
    tag: [tags.monospace, tags.contentSeparator, tags.quote, tags.list, tags.meta],
    color: 'var(--eien-ink-soft)',
  },
  { tag: [tags.angleBracket, tags.tagName, tags.attributeName], color: 'var(--eien-pencil)' },
]);

export const markdownColours = syntaxHighlighting(markdownHighlight);
