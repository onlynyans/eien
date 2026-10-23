// Properties of Copy as HTML and Paste over generated notes: the HTML,
// pasted back as Markdown and copied again, is the same HTML; and a note
// written as Paste writes it comes back as it was.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromHtml } from './from-html';
import { type HtmlOptions, toHtml } from './to-html';

const OPTIONS: HtmlOptions = { quotes: 'straight', sceneBreak: 'spacer' };

/** Words and marks a note is made of, Markdown's own among them. */
const token = fc.constantFrom(
  'scarf',
  'Needle',
  'tore.',
  '2',
  '*',
  '**',
  '_',
  '~~',
  '~',
  '^',
  '==',
  '`',
  '[',
  ']',
  '(',
  ')',
  '<u>',
  '</u>',
  '<em>',
  '</em>',
  '&',
  '&amp;',
  '\\',
  '"',
  "'",
  '#',
  '>',
  '-',
  '1.',
  '<',
  '|',
  '—',
  ' ',
);
const line = fc
  .array(fc.tuple(token, fc.constantFrom(' ', '', ' ')), { minLength: 1, maxLength: 8 })
  .map((parts) =>
    parts
      .map(([t, space]) => t + space)
      .join('')
      .trim(),
  )
  .filter((l) => l !== '');
const block = fc.oneof(
  fc.array(line, { minLength: 1, maxLength: 3 }).map((lines) => lines.join('\n')),
  line.map((l) => `# ${l}`),
  line.map((l) => `> ${l}`),
  fc.constant('***'),
  line.map((l) => `- ${l}`),
);
const note = fc.array(block, { minLength: 1, maxLength: 5 }).map((blocks) => blocks.join('\n\n'));

/**
 * HTML as a page shows it: a line end is a space (but after a <br />), a
 * space just inside an inline tag is the same as one just outside it, and
 * runs of spaces are one.
 */
function shown(html: string): string {
  let out = html.replace(/<br \/>\n/gu, '<br />').replace(/\n/gu, ' ');
  for (let before = ''; before !== out; ) {
    before = out;
    out = out
      // Italics side by side, or either side of a line break, are one run of italics.
      .replace(/<\/(em|strong|s|u|sub|sup)><\1>/gu, '')
      .replace(/<\/(em|strong|s|u|sub|sup)><br \/><\1>/gu, '<br />')
      .replace(/<(em|strong|s|u|sub|sup)><\/\1>/gu, '')
      // Bold round all of an italic shows as italic round all of a bold ("***both***").
      .replace(
        /<strong><em>((?:(?!<\/?(?:em|strong)>).)*)<\/em><\/strong>/gu,
        '<em><strong>$1</strong></em>',
      )
      // A space at an inline tag's edge is the same just outside it (Paste puts it there).
      .replace(/<(em|strong|s|u|sub|sup)>([ \u00a0]+)/gu, '$2<$1>')
      .replace(/([ \u00a0]+)<\/(em|strong|s|u|sub|sup)>/gu, '</$2>$1')
      .replace(/ {2,}/gu, ' ')
      // A space beside a line break, or at a block's start or end, shows as nothing.
      .replace(/ *<br \/> */gu, '<br />')
      .replace(/(<(?:p|h[1-6]|li|blockquote|td|th)>) +/gu, '$1')
      .replace(/ +(<\/(?:p|h[1-6]|li|blockquote|td|th)>)/gu, '$1')
      // A line break just inside an inline tag's start or end is the same just outside it.
      .replace(/<(em|strong|s|u|sub|sup)><br \/>/gu, '<br /><$1>')
      .replace(/<br \/><\/(em|strong|s|u|sub|sup)>/gu, '</$1><br />');
  }
  return out;
}

describe('Copy as HTML, pasted back', () => {
  it('copied again, shows as the same HTML', () => {
    fc.assert(
      fc.property(note, (md) => {
        const html = toHtml(md, OPTIONS);
        expect(shown(toHtml(fromHtml(html), OPTIONS))).toBe(shown(html));
      }),
    );
  });

  it('pasted once more, is the same Markdown', () => {
    fc.assert(
      fc.property(note, (md) => {
        const pasted = fromHtml(toHtml(md, OPTIONS));
        expect(fromHtml(toHtml(pasted, OPTIONS))).toBe(pasted);
      }),
    );
  });
});
