// Live and Reading (spec §4): the note as it reads, the Markdown marks
// hidden. In Live the lines holding the selection show their marks, so what
// you edit is what's in the file; in Reading nothing does.

import { syntaxTree } from '@codemirror/language';
import {
  EditorSelection,
  EditorState,
  Facet,
  type Range,
  RangeSet,
  StateField,
  Transaction,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';
import { isLink, referenceLabels } from '../../core/markdown';
import { frontMatterEnd } from '../../core/text';
import { noteIdOf } from '../../core/versions';
import { CheckboxWidget, ImageWidget, SceneBreakWidget, TableWidget } from './widgets';

export type PreviewMode = 'live' | 'reading';

/** Which preview the editor is in; absent, there's none (Source). */
export const previewMode = Facet.define<PreviewMode, PreviewMode | null>({
  combine: (values) => values[0] ?? null,
});

const hide = Decoration.replace({});
/** Whole lines out of sight: the front matter that only holds the note's id. */
const hideLines = Decoration.replace({ block: true });

/** Front matter that is Eien's own and nothing else: the "id:" a note's first seal gave it. */
const ID_ONLY = /^---\nid:[ \t]*([A-Za-z0-9_-]{1,64})[ \t]*\n(?:---|\.\.\.)[ \t]*(?:\n|$)/;

/**
 * Where the writing starts when the front matter only holds the note's id
 * (spec §2: Eien adds it, and nothing else, on the first seal), which Live
 * and Reading keep out of sight; 0 when there's none to hide. Source shows
 * it, and front matter the writer wrote is shown wherever it is.
 */
export function hiddenFrontMatter(state: EditorState): number {
  if (!state.facet(previewMode)) return 0;
  const match = ID_ONLY.exec(state.doc.sliceString(0, 200));
  // As YAML reads it: "id: null" or "id: true" isn't an id, and stays in sight.
  return match && noteIdOf(match[0]) === match[1] ? match[0].length : 0;
}

/**
 * The hidden front matter is kept whole: the caret never rests in it, and
 * the writer's own edits never reach into it (a Backspace at the start of the
 * writing would join it to the closing "---"). Eien's own changes — a reload,
 * a seal giving the note its id, a restore — come with no user event, and pass.
 */
export const keepFrontMatter = [
  EditorState.transactionFilter.of((tr) => {
    const before = hiddenFrontMatter(tr.startState);
    if (before > 0 && tr.docChanged && tr.annotation(Transaction.userEvent) !== undefined) {
      let reaches = false;
      let atEnd = false;
      tr.changes.iterChangedRanges((from) => {
        if (from < before) reaches = true;
        if (from === before) atEnd = true;
      });
      if (reaches) return [];
      // A note that ends with its closing "---": what's typed after it starts a line of its
      // own, or it would join "---" and the front matter would be gone.
      if (atEnd && tr.startState.doc.sliceString(before - 1, before) !== '\n') {
        return [tr, { changes: { from: before, insert: '\n' }, sequential: true }];
      }
    }
    const start = hiddenFrontMatter(tr.state);
    const { ranges, mainIndex } = tr.newSelection;
    if (start === 0 || ranges.every((range) => range.from >= start)) return tr;
    const kept = ranges.map((range) =>
      EditorSelection.range(Math.max(range.anchor, start), Math.max(range.head, start)),
    );
    return [tr, { selection: EditorSelection.create(kept, mainIndex), sequential: true }];
  }),
  EditorView.atomicRanges.of((view) => {
    const start = hiddenFrontMatter(view.state);
    return start > 0 ? RangeSet.of([hide.range(0, start)]) : RangeSet.empty;
  }),
];
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
      for (let n = doc.lineAt(range.from).number; n <= doc.lineAt(range.to).number; n++)
        activeLines.add(n);
    }
  }
  const isActive = (from: number, to = from) => {
    for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++)
      if (activeLines.has(n)) return true;
    return false;
  };
  /** Hide [from, to), and a space right after it when `andSpace`. */
  const hideMark = (from: number, to: number, andSpace = false) => {
    const end = andSpace && doc.sliceString(to, to + 1) === ' ' ? to + 1 : to;
    if (end > from) out.push(hide.range(from, end));
  };
  const lineClass = (from: number, to: number, cls: string) => {
    for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++)
      out.push(line(cls).range(doc.line(n).from));
  };

  const tree = syntaxTree(state);
  const slice = (from: number, to: number) => doc.sliceString(from, to);
  const references = referenceLabels(tree, slice);

  // Front matter is the note's data, not its Markdown: shown quietly, never drawn as a
  // scene break and a heading. It's short; past 64 KB a "---" isn't front matter.
  const frontMatter = frontMatterEnd(doc.sliceString(0, Math.min(doc.length, 65_536)));
  const hidden = hiddenFrontMatter(state);
  if (hidden > 0) out.push(hideLines.range(0, doc.lineAt(hidden - 1).to));
  else if (frontMatter > 0) lineClass(0, Math.max(0, frontMatter - 1), 'eien-front-matter');

  tree.iterate({
    enter(node: SyntaxNodeRef) {
      const { from, to } = node;
      const name = node.name;
      if (from < frontMatter && name !== 'Document') return to <= frontMatter ? false : undefined;
      const active = isActive(from, to);

      const heading = /^ATXHeading(\d)$/.exec(name);
      if (heading) {
        lineClass(from, to, `eien-h${heading[1]}`);
        return;
      }
      switch (name) {
        case 'HeaderMark':
          if (!isActive(from) && node.node.parent?.name.startsWith('ATXHeading'))
            hideMark(from, to, true);
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
          if (!isLink(node.node, slice, references)) return; // "[sic]": the writer's brackets
          linkDecorations(node, active, out);
          return false;
        case 'URL':
        case 'Autolink':
          out.push(mark('eien-link').range(from, to));
          return;
        case 'Image':
          if (!isLink(node.node, slice, references)) return;
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
          if (!active)
            out.push(Decoration.replace({ widget: new SceneBreakWidget() }).range(from, to));
          return;
        case 'Table':
          if (!active) {
            out.push(
              Decoration.replace({
                widget: new TableWidget(doc.sliceString(from, to)),
                block: true,
              }).range(from, to),
            );
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
            out.push(
              Decoration.replace({ widget: new CheckboxWidget(done) }).range(
                marker.from,
                marker.to,
              ),
            );
          }
          return;
        }
        case 'HTMLTag':
          htmlTag(from, to);
          return;
        case 'HTMLBlock':
          // A line that starts with a tag, as AO3's "<p>…</p>" do: each tag, as mid-line.
          for (const tag of doc.sliceString(from, to).matchAll(/<[^<>]*>/g)) {
            htmlTag(from + tag.index, from + tag.index + tag[0].length);
          }
          return false;
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
      if (!isActive(from))
        out.push(Decoration.replace({ widget: new SceneBreakWidget() }).range(from, to));
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
