// Adversarial: a PDF of a book whose one small image is shown in many
// places (an ornament under each chapter's heading). Spec §8 allows 48 MB of
// images in all for one export, each file counted once. The PDF's page holds
// each image as a data: address, but writes the whole address again at every
// place the image is shown, so a 3 MB ornament in 28 chapters makes a page of
// over 100 million characters, which the main process refuses (MAX_PAGE_CHARS,
// 96 Mi): the export fails, though its images are 3 MB in all.

import { describe, expect, it, vi } from 'vitest';
import { png } from '../../../tests/support/images';
import { type ExportImage, imageInfo, printHtml } from '../../core/export';

vi.mock('electron', () => ({}));

const { outFile } = await import('./out-session');

describe('a PDF whose one image is shown in every chapter', () => {
  it('is a page the main process takes', { timeout: 60_000 }, () => {
    const bytes = png(1000, 1000); // 3 MB, stored as the file has it
    const info = imageInfo(bytes);
    if (!info) throw new Error('not an image');
    const ornament: ExportImage = { key: 'Book/ornament.png', bytes, info };
    const images = new Map([['ornament.png', ornament]]);
    const html = printHtml({
      title: 'Book',
      notes: Array.from({ length: 28 }, (_, i) => ({
        title: `Chapter ${i + 1}`,
        markdown: `![](ornament.png)\n\nThe words of chapter ${i + 1}.`,
        images,
      })),
      book: true,
      quotes: 'curly',
      language: 'en-US',
      key: 'k',
      date: new Date(0),
    });
    expect(bytes.length).toBeLessThan(48 * 1024 * 1024); // well within the export's images
    expect(() => outFile({ kind: 'pdf', html, page: 'letter' })).not.toThrow();
  });
});
