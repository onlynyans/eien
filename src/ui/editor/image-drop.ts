// An image dropped on the page, or pasted into it (spec §4): the editor only
// hands the files on, with where they go; the vault copies them in beside the
// note and the link comes back to be put there (../vault/note-images.ts).
// Anything else dropped or pasted is the editor's own business: text, HTML.

import { type EditorState, type Extension, Prec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { imageNameFor } from '../../core/vault';

/** Takes `files` for the place `at` (null: the caret); false to leave them be. */
export type TakeImages = (files: readonly File[], at: number | null) => boolean;

/** The images among `files`, the kinds a note shows. */
export const imagesAmong = (files: Iterable<File>): File[] =>
  [...files].filter((file) => imageNameFor(file.name, file.type) !== null);

/**
 * What a paste carries that's an image to add: its image files, unless it
 * carries text too (a word processor offers a picture of what was copied
 * beside its words, and the words are what's meant).
 */
export function pastedImages(data: DataTransfer | null): File[] {
  const text = data?.getData('text/plain') ?? '';
  return data && text.trim() === '' ? imagesAmong(data.files) : [];
}

/** A drop or paste of images, handed to `take`; before the editor's own (which would paste text). */
export const imageDrop = (take: TakeImages): Extension =>
  Prec.high(
    EditorView.domEventHandlers({
      drop(event, view) {
        const files = imagesAmong(event.dataTransfer?.files ?? []);
        if (files.length === 0 || !editable(view.state)) return false;
        const at = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (!take(files, at)) return false;
        event.preventDefault();
        return true;
      },
      paste(event, view) {
        const files = pastedImages(event.clipboardData);
        if (files.length === 0 || !editable(view.state) || !take(files, null)) return false;
        event.preventDefault();
        return true;
      },
    }),
  );

const editable = (state: EditorState) => !state.readOnly;
