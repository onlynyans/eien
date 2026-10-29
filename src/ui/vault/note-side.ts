// A page that holds a note (./page-side.ts): the page (../page/page.ts), its
// note (./open-note.ts, held in the window's open notes) and that note's
// seals (../versions), made together when a page opens and let go together
// when it closes, so a closed page leaves no view, timer or listener behind.
// The note's kind, over all its pages, is ./note-pages.ts's.

import type { SettingValues } from '../../core/config';
import type { VaultBridge } from '../../platform/bridge';
import type { PageView } from '../page/page';
import type { Written } from '../page/word-count';
import { VersionsUI } from '../versions/versions-ui';
import { type NotePageParts, notePage } from './note-page';
import { OpenNote } from './open-note';
import type { OpenNotes } from './open-notes';
import type { Place, Side, SideHooks } from './page-side';

/** A page, the note it shows, and that note's seals. */
export interface NoteSide extends Side {
  readonly kind: 'note';
  readonly page: PageView;
  readonly note: OpenNote;
  readonly versions: VersionsUI;
}

export const isNote = (side: Side): side is NoteSide => side.kind === 'note';

export interface NoteSideOf extends Omit<NotePageParts, 'note' | 'close'> {
  /** The pane's element (the window's `main`): what floats over a page goes in it. */
  readonly area: HTMLElement;
  readonly vault: VaultBridge;
  /** The Mac's keys, for the keys the versions panel names. */
  readonly mac: boolean;
  /** What a seal's controls show changed (Compare's state, the panel open). */
  changed(): void;
  /** Run a file operation after those under way, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** Words the writer added on a page, for today's tally and a sprint (../counters). */
  wrote(added: number, when: Written): void;
  /** A page's words were counted again: the book's total moves with them. */
  counted(): void;
}

/** A page for a note, the note it shows and its seals, made together. */
export function makeNoteSide(
  of: NoteSideOf,
  notes: OpenNotes,
  hooks: SideHooks,
  left: Place | null,
): NoteSide {
  let note: OpenNote | null = null;
  const page = notePage(of.area, { ...of, note: () => note as OpenNote, close: hooks.close });
  note = new OpenNote(notes, page, left);
  const opened = note;
  page.words.onWrote(of.wrote);
  page.words.onCounted(of.counted);
  page.onCaret(hooks.caret);
  const versions = new VersionsUI({
    page,
    note,
    vault: of.vault,
    notesWithId: (id) => of.state.notesWithId(id),
    mac: of.mac,
    tell: of.tell,
    serial: of.act,
    changed: of.changed,
  });
  return {
    kind: 'note',
    page,
    note,
    versions,
    get path() {
      return opened.path;
    },
    get place() {
      return opened.place;
    },
    get left() {
      return opened.left;
    },
    open: (path, place) => opened.open(path, place),
    clear: () => opened.close(),
    follow: (values) => followSettings(page, values),
    dispose() {
      // Its words saved before its note is let go: a page closed mid-sentence loses none.
      opened.leave().catch(console.error);
      versions.stop();
      page.dispose();
    },
  };
}

/** A page as the settings say: the quotes typed on it, its writing tools, Live's marks, the tags and ids hidden. */
function followSettings(page: PageView, values: SettingValues): void {
  page.editor.setQuotes(values['typography.quotes']);
  page.editor.setTools({
    focus: values['editor.focus'] === 'on',
    typewriter: values['editor.typewriter'] === 'on',
    spellcheck: values['editor.spellcheck'] === 'on',
  });
  page.editor.setMarks(values['editor.marks'] === 'on');
  page.editor.setTagsAndIdsHidden(values['editor.hideTagsAndIds'] === 'on');
}
