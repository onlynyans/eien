// Paste from what real apps put on the clipboard (tests/support/clipboards.ts):
// a web page's HTML becomes Markdown, its words as they were; an editor's
// styled copy of Markdown is the Markdown as typed.

import { describe, expect, it } from 'vitest';
import {
  GOOGLE_ANSWER,
  SUBLIME_COPY_AS_HTML,
  SUBLIME_TYPED,
} from '../../../tests/support/clipboards';
import { pastedMarkdown } from './from-html';

describe('a web page’s HTML (Google’s answer)', () => {
  const md = pastedMarkdown(GOOGLE_ANSWER.html, GOOGLE_ANSWER.text) ?? '';

  it('keeps the brackets round its citations as written, links inside', () => {
    expect(md).not.toMatch(/\\[[\]]/u);
    expect(md).toContain(
      'ship code faster. [[1](https://www.coursera.org/articles/devops-vs-cicd), [2](https://www.geeksforgeeks.org/software-engineering/difference-between-ci-cd-and-devops/), [3](https://octopus.com/devops/ci-cd/)]',
    );
  });

  it('lists the items it wraps in <div>s, one list, one line each', () => {
    const list = md.split('\n\n').find((block) => block.startsWith('- **Culture')) ?? '';
    expect(list.split('\n').map((line) => /^- \*\*[\w ]+/u.exec(line)?.[0])).toEqual([
      '- **Culture and Collaboration',
      '- **Full Lifecycle',
      '- **Broader Practices',
    ]);
  });

  it('keeps its table, headings and rules', () => {
    expect(md).toContain('| **Feature** | **DevOps** | **CI/CD** |\n| --- | --- | --- |');
    expect(md).toContain('\n\n***\n\n**What is DevOps?**\n\n');
    expect(md.split('\n\n')).toHaveLength(13);
  });
});

describe('an editor’s copy of Markdown (Sublime Text)', () => {
  it('pastes Copy as HTML as the Markdown typed, not its HTML or its colours', () => {
    expect(pastedMarkdown(SUBLIME_COPY_AS_HTML.html, SUBLIME_COPY_AS_HTML.text)).toBe(
      SUBLIME_TYPED,
    );
  });

  it('pastes Copy as HTML as typed in any face', () => {
    const html = SUBLIME_COPY_AS_HTML.html.replace('font-family:Menlo', 'font-family:Georgia');
    expect(pastedMarkdown(html, html)).toBe(SUBLIME_TYPED);
  });

  it('pastes the plain Copy as it is', () => {
    expect(pastedMarkdown('', SUBLIME_TYPED)).toBeNull();
  });
});
