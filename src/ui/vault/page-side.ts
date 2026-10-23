// One page of the pane, as the pages controller (./pages.ts) holds it: the
// page (../page/page.ts), its note (./open-note.ts, held in the window's
// open notes) and that note's seals (../versions), made together when a page
// opens and let go together when it closes, so a closed page leaves no view,
// timer or listener behind.

import type { VaultBridge } from '../../platform/bridge';
import type { PageView } from '../page/page';
import type { Written } from '../page/word-count';
import type { SettingsState } from '../settings/settings-state';
import { VersionsUI } from '../versions/versions-ui';
import { type NotePageParts, notePage } from './note-page';
import { OpenNote } from './open-note';
import type { OpenNotes } from './open-notes';

/** A page, the note it shows, and that note's seals. */
export interface Side {
  readonly page: PageView;
  readonly note: OpenNote;
  readonly versions: VersionsUI;
}

export interface SideOf extends Omit<NotePageParts, 'note' | 'close'> {
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

/** What the page tells its controller: its × pressed, its caret moved, the writer in it. */
export interface SideHooks {
  close(): void;
  caret(): void;
  entered(): void;
}

export function makeSide(of: SideOf, notes: OpenNotes, hooks: SideHooks): Side {
  let note: OpenNote | null = null;
  const page = notePage(of.area, { ...of, note: () => note as OpenNote, close: hooks.close });
  note = new OpenNote(notes, page);
  page.words.onWrote(of.wrote);
  page.words.onCounted(of.counted);
  page.onCaret(hooks.caret);
  // The writer in a page (a click, the keyboard): it's the active one.
  page.element.addEventListener('focusin', hooks.entered);
  page.element.addEventListener('pointerdown', hooks.entered);
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
  return { page, note, versions };
}

/** The page closed: its words counted, its note let go (still open on another page, or closed), the rest with it. */
export function closeSide(side: Side): void {
  side.note.close();
  side.versions.stop();
  side.page.dispose();
}

/** A page as the settings say: the quotes typed on it, its writing tools, Live's marks. */
export function followSettings(page: PageView, values: SettingsState['values']): void {
  page.editor.setQuotes(values['typography.quotes']);
  page.editor.setTools({
    focus: values['editor.focus'] === 'on',
    typewriter: values['editor.typewriter'] === 'on',
    spellcheck: values['editor.spellcheck'] === 'on',
  });
  page.editor.setMarks(values['editor.marks'] === 'on');
}
