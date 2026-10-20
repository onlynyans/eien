import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { type NoteEvents, NoteSession, SAVE_AFTER_MS, type SaveState } from './note-session';

const AT = new Date(2026, 9, 19, 16, 40);

function recorder() {
  const log: string[] = [];
  const states: SaveState[] = [];
  const events: NoteEvents = {
    status: (state) => states.push(state),
    replaced: (text) => log.push(`replaced:${text}`),
    movedToCopy: (path, from) => log.push(`moved:${from}->${path}`),
    gone: () => log.push('gone'),
  };
  return { log, states, events };
}

async function setup(path = 'Fic/Seventeen.md', text = 'She takes it.') {
  const vault = new MemoryStorage();
  vault.put(path, text);
  const write = vi.spyOn(vault, 'write');
  const { log, states, events } = recorder();
  const session = await NoteSession.open(vault, path, events, () => AT);
  if (!session) throw new Error('no session');
  return { vault, write, log, states, session };
}

describe('NoteSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Let timers fire and every queued save finish. */
  const settle = async (session: NoteSession, ms = SAVE_AFTER_MS) => {
    await vi.advanceTimersByTimeAsync(ms);
    await session.flush();
  };

  it('opens nothing for a missing note', async () => {
    const { events } = recorder();
    expect(await NoteSession.open(new MemoryStorage(), 'Nothing.md', events)).toBeNull();
  });

  it('saves once typing pauses, and not before', async () => {
    const { vault, write, session } = await setup();
    session.edit('She takes it. The stitches hold.');
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS - 1);
    expect(write).not.toHaveBeenCalled();
    session.edit('She takes it. The stitches hold taut.'); // still typing: the pause starts again
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS - 1);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await session.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe(
      'She takes it. The stitches hold taut.',
    );
    expect(session.state).toBe('saved');
  });

  it('saves at once on flush (switching notes, blur, quitting)', async () => {
    const { vault, session } = await setup();
    session.edit('Flushed.');
    await session.flush();
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('Flushed.');
  });

  it('never rewrites a note that has not changed', async () => {
    const { write, session } = await setup();
    session.edit('Changed.');
    session.edit('She takes it.'); // and back
    await settle(session);
    await session.flush();
    expect(write).not.toHaveBeenCalled();
    expect(session.state).toBe('saved');
  });

  it('writes back in the file’s own BOM and line endings', async () => {
    const { vault, session } = await setup('Note.md', '﻿One.\r\nTwo.\r\n');
    expect(session.text).toBe('One.\nTwo.\n');
    session.edit('One.\nTwo.\nThree.\n');
    await session.flush();
    expect((await vault.read('Note.md'))?.text).toBe('﻿One.\r\nTwo.\r\nThree.\r\n');
  });

  it('shows a change from elsewhere when nothing is unsaved here', async () => {
    const { vault, log, session } = await setup();
    vault.put('Fic/Seventeen.md', 'She takes it gently.');
    await session.diskChanged();
    expect(log).toEqual(['replaced:She takes it gently.']);
    expect(session.text).toBe('She takes it gently.');
    expect(session.state).toBe('saved');
  });

  it('keeps both when the file and the editor changed: the writer’s text moves to a copy', async () => {
    const { vault, log, session } = await setup();
    session.edit('Mine: she takes it slowly.');
    vault.put('Fic/Seventeen.md', 'Theirs: she takes it quickly.');
    await session.diskChanged();
    const copy = 'Fic/Seventeen (conflict 2026-10-19 16-40).md';
    expect(log).toEqual([`moved:Fic/Seventeen.md->${copy}`]);
    expect((await vault.read(copy))?.text).toBe('Mine: she takes it slowly.');
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('Theirs: she takes it quickly.');
    expect(session.path).toBe(copy);
    // writing carries on in the copy
    session.edit('Mine: she takes it slowly. More.');
    await session.flush();
    expect((await vault.read(copy))?.text).toBe('Mine: she takes it slowly. More.');
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('Theirs: she takes it quickly.');
  });

  it('keeps both when a save finds the file changed (the change arrived before the watcher said)', async () => {
    const { vault, log, session } = await setup();
    vault.put('Fic/Seventeen.md', 'Theirs.');
    session.edit('Mine.');
    await session.flush();
    expect(log).toEqual(['moved:Fic/Seventeen.md->Fic/Seventeen (conflict 2026-10-19 16-40).md']);
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('Theirs.');
  });

  it('numbers a second conflict copy rather than writing over the first', async () => {
    const { vault, session } = await setup();
    vault.put('Fic/Seventeen (conflict 2026-10-19 16-40).md', 'An earlier copy.');
    session.edit('Mine.');
    vault.put('Fic/Seventeen.md', 'Theirs.');
    await session.diskChanged();
    expect(session.path).toBe('Fic/Seventeen (conflict 2026-10-19 16-40) 2.md');
    expect((await vault.read('Fic/Seventeen (conflict 2026-10-19 16-40).md'))?.text).toBe(
      'An earlier copy.',
    );
  });

  it('makes no copy when the file already holds exactly what the editor holds', async () => {
    const { vault, log, write, session } = await setup();
    session.edit('Same words.');
    vault.put('Fic/Seventeen.md', 'Same words.');
    await session.diskChanged();
    await session.flush();
    expect(log).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    expect(session.state).toBe('saved');
  });

  it('closes a note deleted elsewhere when nothing is unsaved', async () => {
    const { vault, log, session } = await setup();
    vault.remove('Fic/Seventeen.md');
    await session.diskChanged();
    expect(log).toEqual(['gone']);
  });

  it('puts a deleted note back when there are unsaved words in it', async () => {
    const { vault, log, session } = await setup();
    session.edit('Words I typed.');
    vault.remove('Fic/Seventeen.md');
    await session.diskChanged();
    expect(log).toEqual([]);
    await session.flush();
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('Words I typed.');
  });

  it('retries a save that failed, and loses nothing meanwhile', async () => {
    const { vault, write, states, session } = await setup();
    write.mockRejectedValueOnce(new Error('disk unavailable'));
    session.edit('Typed while the disk was away.');
    await settle(session);
    expect(states).toContain('failed');
    expect(session.text).toBe('Typed while the disk was away.');
    await vi.advanceTimersByTimeAsync(SAVE_AFTER_MS * 4);
    await session.flush();
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('Typed while the disk was away.');
    expect(session.state).toBe('saved');
  });

  it('saves again what was typed during a save', async () => {
    const { vault, write, session } = await setup();
    let release: () => void = () => {};
    const original = write.getMockImplementation();
    write.mockImplementationOnce(async (...args) => {
      await new Promise<void>((done) => {
        release = done;
      });
      return (original as typeof vault.write).apply(vault, args);
    });
    session.edit('First.');
    const saving = session.flush();
    await vi.advanceTimersByTimeAsync(0); // the save is now waiting inside write
    expect(write).toHaveBeenCalledTimes(1);
    session.edit('First. Second.'); // typed while the first save is on its way
    release();
    await saving;
    await settle(session);
    expect((await vault.read('Fic/Seventeen.md'))?.text).toBe('First. Second.');
    expect(session.state).toBe('saved');
  });
});
