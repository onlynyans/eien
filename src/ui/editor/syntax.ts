// The Markdown Eien reads (spec §4): CommonMark with GitHub's extensions
// (tables, task lists, strikethrough, autolinks), plus ==highlight== and
// [[wiki links]] between notes, defined in core/markdown.

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import type { LanguageSupport } from '@codemirror/language';
import { Highlight, WikiLink } from '../../core/markdown';

export const eienMarkdown = (): LanguageSupport =>
  markdown({ base: markdownLanguage, extensions: [Highlight, WikiLink], addKeymap: true });
