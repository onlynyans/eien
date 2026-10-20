import { describe, expect, it } from 'vitest';
import {
  acceleratorOf,
  apply,
  type Edit,
  FORMAT_COMMANDS,
  formatCommand,
  toggleCheck,
} from './index';

/** "a «b» c" → the text and selection; "a|b" → a caret. */
function parse(marked: string) {
  const caret = marked.indexOf('|');
  if (caret !== -1) {
    return {
      text: marked.slice(0, caret) + marked.slice(caret + 1),
      selection: { from: caret, to: caret },
    };
  }
  const from = marked.indexOf('«');
  const to = marked.indexOf('»') - 1;
  return { text: marked.replace('«', '').replace('»', ''), selection: { from, to } };
}

/** The text after `edit`, with its selection marked the same way. */
function show(text: string, edit: Edit): string {
  const out = apply(text, edit.changes);
  const { from, to } = edit.selection;
  return from === to
    ? `${out.slice(0, from)}|${out.slice(from)}`
    : `${out.slice(0, from)}«${out.slice(from, to)}»${out.slice(to)}`;
}

const run = (id: string, marked: string) => {
  const { text, selection } = parse(marked);
  const command = formatCommand(id);
  if (!command) throw new Error(id);
  return show(text, command.run(text, selection));
};

describe('bold, italic and the rest: toggles', () => {
  it.each([
    ['bold', 'a «word» here', 'a **«word»** here'],
    ['bold', 'a **«word»** here', 'a «word» here'],
    ['bold', 'a «**word**» here', 'a «word» here'],
    ['italic', 'a «word» here', 'a *«word»* here'],
    ['italic', 'a *«word»* here', 'a «word» here'],
    ['underline', 'a «word» here', 'a <u>«word»</u> here'],
    ['underline', 'a <u>«word»</u> here', 'a «word» here'],
    ['strike', '«gone»', '~~«gone»~~'],
    ['highlight', '«this»', '==«this»=='],
    ['highlight', '==«this»==', '«this»'],
  ])('%s: %j → %j', (id, before, after) => {
    expect(run(id, before)).toBe(after);
  });

  it('keeps bold and italic apart, though they share the star', () => {
    expect(run('italic', '**«bold»**')).toBe('***«bold»***'); // italic on top of bold
    expect(run('italic', '***«both»***')).toBe('**«both»**'); // italic off, bold stays
    expect(run('bold', '***«both»***')).toBe('*«both»*'); // bold off, italic stays
    expect(run('bold', '*«italic»*')).toBe('***«italic»***');
    expect(run('italic', '**«bold»**')).not.toBe('*«bold»*'); // never mistakes bold for italic
  });

  it('takes the word the caret is in', () => {
    expect(run('bold', 'the scar|f holds')).toBe('the **scar|f** holds');
    expect(run('bold', 'the **scar|f** holds')).toBe('the scar|f holds');
    expect(run('italic', "she's do|n't")).toBe("she's *do|n't*"); // apostrophes stay in the word
  });

  it('puts both marks in, caret between, away from any word', () => {
    expect(run('bold', 'end. |')).toBe('end. **|**');
    expect(run('bold', 'end. **|**')).toBe('end. |'); // and takes an empty pair back out
    expect(run('underline', '|')).toBe('<u>|</u>');
  });

  it('marks each line of a selection over several lines, skipping blank ones', () => {
    expect(run('bold', '«One line\n\nAnother»')).toBe('«**One line**\n\n**Another**»');
    expect(run('bold', '«**One line**\n\n**Another**»')).toBe('«One line\n\nAnother»');
  });

  it('marks only the unmarked lines when some already are', () => {
    expect(run('italic', '«*one*\ntwo»')).toBe('«*one*\n*two*»');
  });
});

describe('links', () => {
  it('makes selected words a link, the caret waiting for the address', () => {
    expect(run('link', 'see «the archive» now')).toBe('see [the archive](|) now');
  });
  it('makes a selected address the target, the caret waiting for words', () => {
    expect(run('link', '«https://archiveofourown.org»')).toBe('[|](https://archiveofourown.org)');
  });
  it('makes an empty link at the caret', () => {
    expect(run('link', 'a |')).toBe('a [](|)');
  });
});

describe('line formats', () => {
  it.each([
    ['heading1', 'Sev|enteen', '# Sev|enteen'],
    ['heading1', '# Sev|enteen', 'Sev|enteen'],
    ['heading2', '# Sev|enteen', '## Sev|enteen'], // a different level replaces
    ['heading3', '### Sev|enteen', 'Sev|enteen'],
    ['heading1', '## Two|', '# Two|'],
    ['quote', 'Said |it', '> Said |it'],
    ['quote', '> Said |it', 'Said |it'],
    ['bullet', 'item|', '- item|'],
    ['bullet', '- item|', 'item|'],
    ['checklist', 'buy |thread', '- [ ] buy |thread'],
    ['checklist', '- [x] buy |thread', 'buy |thread'],
    ['bullet', '- [ ] task|', '- task|'], // a checklist becomes a plain list
    ['checklist', '1. step|', '- [ ] step|'],
  ])('%s: %j → %j', (id, before, after) => {
    expect(run(id, before)).toBe(after);
  });

  it('numbers a numbered list in order, and keeps blank lines out of it', () => {
    expect(run('numbered', '«one\ntwo\n\nthree»')).toBe('«1. one\n2. two\n\n3. three»');
    expect(run('numbered', '«1. one\n2. two»')).toBe('«one\ntwo»');
  });

  it('turns a mixed selection all on before any comes off', () => {
    expect(run('bullet', '«- one\ntwo»')).toBe('«- one\n- two»');
  });

  it('keeps an indented item indented', () => {
    expect(run('checklist', '  sub|item')).toBe('  - [ ] sub|item');
  });

  it('does not take the line a selection only touches at its very start', () => {
    expect(run('quote', '«one\n»two')).toBe('«> one\n»two');
  });

  it('keeps the caret in the same words when the line’s prefix changes', () => {
    expect(run('heading2', '# Ti|tle')).toBe('## Ti|tle');
  });
});

describe('toggleCheck', () => {
  const check = (marked: string) => {
    const { text, selection } = parse(marked);
    const edit = toggleCheck(text, selection.from);
    return edit ? apply(text, edit.changes) : null;
  };
  it('ticks and unticks the item on the caret’s line', () => {
    expect(check('- [ ] Tags|\n- [ ] Summary')).toBe('- [x] Tags\n- [ ] Summary');
    expect(check('- [x] Ta|gs')).toBe('- [ ] Tags');
    expect(check('- [X] Ta|gs')).toBe('- [ ] Tags');
    expect(check('  1. [ ] nested |step')).toBe('  1. [x] nested step');
  });
  it('is nothing on a line that is not a checklist item', () => {
    expect(check('Just |text')).toBeNull();
    expect(check('- plain |item')).toBeNull();
  });
});

describe('the command list', () => {
  it('has each command once, each key once', () => {
    const ids = FORMAT_COMMANDS.map((c) => c.id);
    const keys = FORMAT_COMMANDS.map((c) => c.key);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('writes keys as Electron accelerators', () => {
    expect(acceleratorOf('Mod-b')).toBe('CmdOrCtrl+B');
    expect(acceleratorOf('Mod-Shift-x')).toBe('CmdOrCtrl+Shift+X');
    expect(acceleratorOf('Mod-Alt-1')).toBe('CmdOrCtrl+Alt+1');
    expect(acceleratorOf('Mod-Shift-.')).toBe('CmdOrCtrl+Shift+.');
  });
});
