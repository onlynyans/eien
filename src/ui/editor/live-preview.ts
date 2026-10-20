// Live and Reading (spec §4): the note as it reads, the Markdown marks
// hidden. In Live the lines holding the selection show their marks, so what
// you edit is what's in the file; in Reading nothing does.

import { syntaxTree } from '@codemirror/language';
import { type EditorState, Facet, type Range, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';
import { CheckboxWidget, ImageWidget, SceneBreakWidget, TableWidget } from './widgets';

export type PreviewMode = 'live' | 'reading';

/** Which preview the editor is in; absent, there's none (Source). */
export const previewMode = Facet.define<PreviewMode, PreviewMode | null>({
  combine: (values) => values[0] ?? null,
});

const hide = Decoration.replace({});
const mark = (cls: string) => Decoration.mark({ class: cls });
const line = (cls: string) => Decoration.line({ class: cls });

/** HTML tags the spec lets a note use, and the look each gives. */
const INLINE_HTML: Record<string, string> = {
  u: 'eien-underline',
  em: 'eien-em',
  i: 'eien-em',
  strong: 'eien-strong',
  b: 'eien-strong',
  s: 'eien-strike',
  sup: 'eien-sup',
  sub: 'eien-sub',
};

function build(state: EditorState): DecorationSet {
  const mode = state.facet(previewMode);
  if (!mode) return Decoration.none;
  const doc = state.doc;
  const out: Range<Decoration>[] = [];

  // Lines the selection touches show their marks (Live only).
  const activeLines = new Set<number>();
  if (mode === 'live') {
    for (const range of state.selection.ranges) {
      for (let n = doc.lineAt(range.from).number; n <= doc.lineAt(range.to).number; n++) activeLines.add(n);
    }
  }
  const isActive = (from: number, to = from) => {
    for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) if (activeLines.has(n)) return true;
    return false;
  };
  /** Hide [from, to), and a space right after it when `andSpace`. */
  const hideMark = (from: number, to: number, andSpace = false) => {
    const end = andSpace && doc.sliceString(to, to + 1) === ' ' ? to + 1 : to;
    if (end > from) out.push(hide.range(from, end));
  };
  const lineClass = (from: number, to: number, cls: string) => {
    for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) out.push(line(cls).range(doc.line(n).from));
  };

  syntaxTree(state).iterate({
    enter(node: SyntaxNodeRef) {
      const { from, to } = node;
      const name = node.name;
      const active = isActive(from, to);

      const heading = /^ATXHeading(\d)$/.exec(name);
      if (heading) {
        lineClass(from, to, `eien-h${heading[1]}`);
        return;
      }
      switch (name) {
        case 'HeaderMark':
          if (!isActive(from) && node.node.parent?.name.startsWith('ATXHeading')) hideMark(from, to, true);
          return;
        case 'EmphasisMark':
        case 'StrikethroughMark':
        case 'HighlightMark':
        case 'CodeMark':
        case 'WikiLinkMark':
          if (name === 'CodeMark' && node.node.parent?.name === 'FencedCode') {
            out.push(mark('eien-mark').range(from, to));
            return;
          }
          if (!isActive(from)) hideMark(from, to);
          return;
        case 'Highlight':
          out.push(mark('eien-highlight').range(from, to));
          return;
        case 'InlineCode':
          out.push(mark('eien-code').range(from, to));
          return;
        case 'FencedCode':
          lineClass(from, to, 'eien-codeblock');
          return;
        case 'Blockquote':
          lineClass(from, to, 'eien-quote');
          return;
        case 'QuoteMark':
          if (!isActive(from)) hideMark(from, to, true);
          return;
        case 'WikiLink':
          out.push(mark('eien-link').range(from, to));
          return;
        case 'Link':
          linkDecorations(node, active, out);
          return false;
        case 'URL':
        case 'Autolink':
          out.push(mark('eien-link').range(from, to));
          return;
        case 'Image':
          if (!active) {
            const src = node.node.getChild('URL');
            const alt = /^!\[([^\]]*)\]/.exec(doc.sliceString(from, to))?.[1] ?? '';
            out.push(
              Decoration.replace({
                widget: new ImageWidget(src ? doc.sliceString(src.from, src.to) : '', alt),
              }).range(from, to),
            );
          }
          return false;
        case 'HorizontalRule':
          if (!active) out.push(Decoration.replace({ widget: new SceneBreakWidget() }).range(from, to));
          return;
        case 'Table':
          if (!active) {
            out.push(Decoration.replace({ widget: new TableWidget(doc.sliceString(from, to)), block: true }).range(from, to));
            return false;
          }
          return;
        case 'Task': {
          const marker = node.node.getChild('TaskMarker');
          if (!marker) return;
          const done = /\[[xX]\]/.test(doc.sliceString(marker.from, marker.to));
          if (done) out.push(mark('eien-done').range(marker.to, to));
          if (!isActive(from)) {
            const listMark = node.node.parent?.getChild('ListMark');
            if (listMark) hideMark(listMark.from, listMark.to, true);
            out.push(Decoration.replace({ widget: new CheckboxWidget(done) }).range(marker.from, marker.to));
          }
          return;
        }
        case 'HTMLTag':
          htmlTag(from, to);
          return;
      }
      return;
    },
  });

  /** Inline HTML: an allowed tag looks like what it means; the tag itself hides. */
  function htmlTag(from: number, to: number) {
    const tag = /^<\s*(\/?)\s*([a-zA-Z]+)\b[^>]*?(\/?)>$/.exec(doc.sliceString(from, to));
    if (!tag) return;
    const [, closing, rawName] = tag;
    const name = (rawName ?? '').toLowerCase();
    if (name === 'br' || name === 'p') {
      if (!isActive(from)) hideMark(from, to);
      return;
    }
    if (name === 'hr') {
      if (!isActive(from)) out.push(Decoration.replace({ widget: new SceneBreakWidget() }).range(from, to));
      return;
    }
    const look = INLINE_HTML[name];
    if (!look || closing) return; // the opening tag does the work, finding its own close
    const lineEnd = doc.lineAt(from).to;
    const rest = doc.sliceString(to, lineEnd);
    const close = new RegExp(`<\\s*/\\s*${name}\\s*>`, 'i').exec(rest);
    if (!close) return;
    const closeFrom = to + close.index;
    const closeTo = closeFrom + close[0].length;
    out.push(mark(look).range(to, closeFrom));
    if (!isActive(from)) {
      hideMark(from, to);
      hideMark(closeFrom, closeTo);
    }
  }

  return Decoration.set(out, true);
}

/** [words](address "title"): the words, underlined; the rest hidden unless being edited. */
function linkDecorations(node: SyntaxNodeRef, active: boolean, out: Range<Decoration>[]) {
  const marks = node.node.getChildren('LinkMark');
  const open = marks[0];
  const closeText = marks[1];
  if (!open || !closeText) return;
  out.push(mark('eien-link').range(open.to, closeText.from));
  if (active) return;
  out.push(hide.range(open.from, open.to));
  if (node.to > closeText.from) out.push(hide.range(closeText.from, node.to));
}

/** The decorations for Live and Reading, rebuilt as the text, selection, parse or mode change. */
export const livePreview = StateField.define<DecorationSet>({
  create: build,
  update(value, tr) {
    const parsed = syntaxTree(tr.state) !== syntaxTree(tr.startState);
    const modeChanged = tr.state.facet(previewMode) !== tr.startState.facet(previewMode);
    if (tr.docChanged || tr.selection || parsed || modeChanged) return build(tr.state);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
