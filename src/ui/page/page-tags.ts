// The open note's tags on its page (backlog #13): read from the editor's
// text, shown in the place the layout gives them, and changed in front
// matter alone (core/tags), as a quiet edit of Eien's that counts toward no
// one's words. While the writer types they're read again only once the
// typing pauses: nothing on the page changes mid-word.

import { noteTags } from '../../core/note';
import { type TagChoice, tagKey, withTagAdded, withTagRemoved } from '../../core/tags';
import type { TagSlot } from '../chrome/layout-spec';
import type { NoteEditor } from '../editor/editor';
import { findTag } from '../editor/find-tag';
import { TagSet } from './tag-set';

/** How long typing pauses before a #tag typed in the text shows on the head. */
const READ_AFTER_MS = 700;

export interface PageTagsOf {
  /** The vault's tags offered for `typed` to a note with `has`. */
  choices(typed: string, has: readonly string[]): readonly TagChoice[];
  /** Whether the note's text can be changed now (not while a seal is compared or held still). */
  editable(): boolean;
  /** Say why a tag couldn't be added or taken off. */
  tell(message: string): void;
}

export class PageTags {
  readonly set: TagSet;
  readonly #editor: NoteEditor;
  readonly #of: PageTagsOf;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #open = false;

  constructor(editor: NoteEditor, of: PageTagsOf) {
    this.#editor = editor;
    this.#of = of;
    this.set = new TagSet({
      choices: (typed, has) => of.choices(typed, has),
      add: (tag) => this.#change(withTagAdded, tag, 'add'),
      remove: (tag) => this.#change(withTagRemoved, tag, 'take off'),
      find: (tag) => {
        const at = findTag(editor.view.state, tagKey(tag));
        if (at) editor.reveal(at.from, at.to);
      },
    });
  }

  /** Put the tags in `slots[slot]`, if they aren't there already. */
  place(slots: Readonly<Record<TagSlot, HTMLElement>>, slot: TagSlot): void {
    if (this.set.element.parentElement !== slots[slot]) slots[slot].append(this.set.element);
  }

  /** A note shown (or its text replaced from elsewhere): its tags, at once. */
  show(text: string): void {
    this.#open = true;
    clearTimeout(this.#timer);
    this.set.show(noteTags(text));
  }

  /** The writer changed the text: its tags once the typing pauses. */
  edited(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.set.show(noteTags(this.#editor.text)), READ_AFTER_MS);
  }

  /** No note open. */
  clear(): void {
    this.#open = false;
    clearTimeout(this.#timer);
    this.set.show(null);
  }

  /** # on the page, outside the words and any field, opens the field (docs/design: tags.md). */
  listen(page: HTMLElement): void {
    page.addEventListener('keydown', (event) => {
      const target = event.target;
      if (event.key !== '#' || !this.#open || !(target instanceof HTMLElement)) return;
      if (target.closest('.editor-host, input, textarea, [contenteditable]')) return;
      event.preventDefault();
      this.set.open();
    });
  }

  #change(edit: (text: string, tag: string) => string | null, tag: string, verb: string): void {
    if (!this.#of.editable()) return;
    const text = this.#editor.text;
    const next = edit(text, tag);
    if (next === null) {
      this.#of.tell(
        `Couldn’t ${verb} #${tag}: the note’s front matter isn’t in a shape Eien can change without rewriting it. Its tags are in Source.`,
      );
      return;
    }
    // Not a step of ⌘Z's: the head adds and takes off, and the writer's typing stays theirs to undo.
    if (next !== text && !this.#editor.amend(next, false)) return;
    this.show(next);
  }
}
