import { describe, expect, it } from 'vitest';
import { citation, quoted, withQuote } from './quote';

const SOURCE = { title: 'Pride and Prejudice', chapter: 'Chapter III' };

describe('a quote from a book', () => {
  it('is cited by the book’s title and its chapter, with no author', () => {
    expect(citation(SOURCE)).toBe('— Pride and Prejudice, Chapter III');
    expect(citation({ title: ' Persuasion ', chapter: null })).toBe('— Persuasion');
    expect(citation({ title: 'Emma', chapter: '  ' })).toBe('— Emma');
    // The book's words, never marks in the note: where the note would read a mark, it's escaped.
    expect(citation({ title: '*Emma* [1816]', chapter: 'Chapter <I>' })).toBe(
      '— \\*Emma\\* [1816], Chapter \\<I>',
    );
  });

  it('sets every line in a Markdown quote, the citation under a quoted blank line', () => {
    expect(quoted('It is a *truth* universally acknowledged.', SOURCE)).toBe(
      '> It is a *truth* universally acknowledged.\n>\n> — Pride and Prejudice, Chapter III',
    );
    expect(quoted('“Oh!” said Lydia.\n\n“I am not afraid.”\r\n', SOURCE)).toBe(
      '> “Oh!” said Lydia.\n>\n> “I am not afraid.”\n>\n> — Pride and Prejudice, Chapter III',
    );
    expect(quoted('  \n\n ', SOURCE)).toBe('');
  });

  it('goes at the note’s end after a blank line, the note’s own words untouched', () => {
    const quote = quoted('Words.', SOURCE);
    expect(withQuote('A scene of my own.', quote)).toBe(`A scene of my own.\n\n${quote}\n`);
    expect(withQuote('A scene.\n\n\n', quote)).toBe(`A scene.\n\n${quote}\n`);
    expect(withQuote('', quote)).toBe(`${quote}\n`);
    // Whatever the note holds before, it's still there, word for word.
    const note = '# Title\n\n- a list\n  \n';
    expect(withQuote(note, quote).startsWith(note.trimEnd())).toBe(true);
  });
});
