import { describe, expect, it } from 'vitest';
import { curlyQuote, curlyQuotes, revisedQuote, straightQuotes, withQuotes } from './quotes';

describe('curlyQuotes', () => {
  it('opens and closes double and single quotes by what’s around them', () => {
    expect(curlyQuotes('"Look," he said.')).toBe('“Look,” he said.');
    expect(curlyQuotes("She said 'hi' and left.")).toBe('She said ‘hi’ and left.');
    expect(curlyQuotes('"She said \'hi.\'"')).toBe('“She said ‘hi.’”');
  });

  it('makes an apostrophe of one in a word, before a year, and in an elision', () => {
    expect(curlyQuotes("don't, it's, the dog's")).toBe('don’t, it’s, the dog’s');
    expect(curlyQuotes("the '90s")).toBe('the ’90s');
    expect(curlyQuotes("'Tis the season; 'twas not")).toBe('’Tis the season; ’twas not');
    expect(curlyQuotes("rock 'n' roll")).toBe('rock ’n’ roll');
    expect(curlyQuotes("lookin' good")).toBe('lookin’ good');
    expect(curlyQuotes("'S fine. 'Cause I said.")).toBe('’S fine. ’Cause I said.');
  });

  it('looks past emphasis marks and an opening tag to the words before them', () => {
    expect(curlyQuote('"', '*', 'Hi')).toBe('“');
    expect(curlyQuote('"', 'said **', 'Hi')).toBe('“');
    expect(curlyQuote('"', 'Hi*', '')).toBe('”');
    expect(curlyQuote('"', '<u>', 'Hi')).toBe('“');
    expect(curlyQuote('"', 'a <span class="x">', 'Hi')).toBe('“');
    expect(curlyQuote('"', '</u>', '')).toBe('”');
    expect(curlyQuotes('*"Hi,"* he said, ==\'no\'==')).toBe('*“Hi,”* he said, ==‘no’==');
  });

  it('opens a quote after a dash, a bracket or a slash', () => {
    expect(curlyQuotes('She stopped—"No."')).toBe('She stopped—“No.”');
    expect(curlyQuotes('("Yes.")')).toBe('(“Yes.”)');
    expect(curlyQuotes('either/"or"')).toBe('either/“or”');
  });

  it('closes a quote after a dash when no words follow it: interrupted speech', () => {
    expect(curlyQuotes('"I was going to—" he said.')).toBe('“I was going to—” he said.');
    expect(curlyQuotes("'Wait—' he said.")).toBe('‘Wait—’ he said.');
    expect(curlyQuotes('"I can\'t–"')).toBe('“I can’t–”');
  });

  it('opens a quote after HTML that starts a line or a paragraph', () => {
    expect(curlyQuote('"', 'One.<br>', 'Two')).toBe('“');
    expect(curlyQuote('"', 'One.<br />*', 'Two')).toBe('“');
    expect(curlyQuote('"', 'One.</p><p>', 'Two')).toBe('“');
    expect(curlyQuote('"', 'One.</p>', 'Two')).toBe('“');
    expect(curlyQuote('"', 'One.</u>', '')).toBe('”');
  });

  it('opens a quote at a line’s start', () => {
    expect(curlyQuotes('Line one.\n"Two," she said.')).toBe('Line one.\n“Two,” she said.');
  });

  it('leaves curly quotes, and everything else, as they are', () => {
    expect(curlyQuotes('“Already,” she said. ‘Fine.’')).toBe('“Already,” she said. ‘Fine.’');
    expect(curlyQuotes('No quotes here.')).toBe('No quotes here.');
    expect(curlyQuotes('')).toBe('');
  });
});

describe('revisedQuote: a quote that turns out, as typing goes on, to be the other way', () => {
  const at = (before: string, next: string) => revisedQuote(before, next);

  it('an apostrophe before a year, as soon as its first digit is typed', () => {
    expect(at('the ‘', '9')).toEqual({ at: 4, mark: '’' });
    expect(at('‘', '9')).toEqual({ at: 0, mark: '’' });
    expect(at('the ‘', 'n')).toBeNull();
    expect(at('the ’', '9')).toBeNull();
  });

  it('an apostrophe in an elision, once the word ends', () => {
    expect(at('‘Tis', ' ')).toEqual({ at: 0, mark: '’' });
    expect(at('He said ‘em', ',')).toEqual({ at: 8, mark: '’' });
    expect(at('rock ‘n', "'")).toEqual({ at: 5, mark: '’' });
    expect(at('‘S', ' ')).toEqual({ at: 0, mark: '’' });
    expect(at('‘Ti', 's')).toBeNull(); // the word isn't over
    expect(at('‘Tisk', ' ')).toBeNull(); // not an elision
    expect(at('‘Hello', ' ')).toBeNull();
    expect(at('“Tis', ' ')).toBeNull(); // a double quote is never an apostrophe
    expect(at('', ' ')).toBeNull();
  });

  it('an opening quote after a dash, once words follow it', () => {
    expect(at('She stopped—”', 'N')).toEqual({ at: 12, mark: '“' });
    expect(at('either/’', 'o')).toEqual({ at: 7, mark: '‘' });
    expect(at('I was going to—”', ' ')).toBeNull(); // a space: it closed
    expect(at('Hello”', 'N')).toBeNull(); // no dash before it
  });
});

describe('straightQuotes', () => {
  it('makes every curly quote straight, low and reversed ones too', () => {
    expect(straightQuotes('“Look,” he said. ‘Hi’ — don’t „x‟ ‚y‛')).toBe(
      "\"Look,\" he said. 'Hi' — don't \"x\" 'y'",
    );
  });
});

describe('toggling', () => {
  it('gives back the same text: straight, curled, straight again', () => {
    for (const text of [
      '"Look," he said.',
      "She said 'hi' — don't, the '90s, rock 'n' roll.",
      '"She said \'hi.\'"',
      'No quotes.',
    ]) {
      expect(straightQuotes(curlyQuotes(text)), text).toBe(text);
    }
  });

  it('gives back the same text: curly, straightened, curled again', () => {
    for (const text of ['“Look,” he said.', 'She said ‘hi’ — don’t, the ’90s, rock ’n’ roll.']) {
      expect(curlyQuotes(straightQuotes(text)), text).toBe(text);
    }
  });

  it('follows the setting', () => {
    expect(withQuotes('"a"', 'curly')).toBe('“a”');
    expect(withQuotes('“a”', 'straight')).toBe('"a"');
  });
});

describe('curlyQuote, as typed', () => {
  it('opens at the start, after a space or a dash; closes after a word or a stop', () => {
    expect(curlyQuote('"', '', '')).toBe('“');
    expect(curlyQuote('"', 'said ', '')).toBe('“');
    expect(curlyQuote('"', 'said.', '')).toBe('”');
    expect(curlyQuote("'", 'don', 't')).toBe('’');
    expect(curlyQuote("'", ' ', '90s')).toBe('’');
    expect(curlyQuote("'", '—', 'No')).toBe('‘');
    expect(curlyQuote("'", '—', '')).toBe('’'); // nothing after it yet: it closes, until words come
    expect(curlyQuote("'", '—', ' he')).toBe('’');
  });
});
