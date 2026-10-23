// The editor's extensions by what's chosen: its view (Live, Source,
// Reading), Live's marks on the caret's lines or hidden, and a note held
// still while it moves.

import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { EditorMode } from './editor';
import { hiddenMarkEditing } from './hidden-marks';
import { keepFrontMatter, livePreview, previewMode, showMarks } from './live-preview';
import { tableCells } from './live-tables';
import { tableEditing } from './table-editor';

export const marksExtensions = (shown: boolean): Extension =>
  shown ? [] : [showMarks.of(false), hiddenMarkEditing];

export const lockExtensions = (locked: boolean): Extension =>
  locked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];

export function modeExtensions(mode: EditorMode): Extension {
  switch (mode) {
    case 'live':
      return [previewMode.of('live'), livePreview, tableCells, keepFrontMatter, tableEditing];
    case 'source':
      return [EditorView.editorAttributes.of({ class: 'eien-source' })];
    case 'reading':
      return [
        previewMode.of('reading'),
        livePreview,
        tableCells,
        keepFrontMatter,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.editorAttributes.of({ class: 'eien-reading' }),
      ];
  }
}
