// Adversarial: images in an import's plan (spec §8, Import a folder of
// Markdown). "At most 10,000 notes come in at once": the limit is on notes.
// An image is a PNG, JPEG, GIF, WebP, AVIF or SVG file, known by its
// extension; a file with no extension isn't one.

import { describe, expect, it } from 'vitest';
import { imageTypeOf } from '../vault';
import { MAX_IMPORT_NOTES, planImport } from './plan';

const LIMITS = { note: 8 * 1024 * 1024, image: 32 * 1024 * 1024 };

describe('an import with images', () => {
  it('brings its notes in, however many images come with them', () => {
    // A writer's picture folder sorted before the one note: the images take the notes' room.
    const images = Array.from({ length: MAX_IMPORT_NOTES }, (_, i) => ({
      path: `art/${String(i).padStart(5, '0')}.png`,
      size: 100,
    }));
    const plan = planImport([...images, { path: 'story.md', size: 100 }], 'Drafts', [], LIMITS);
    expect(plan.left.filter((each) => each.path === 'story.md')).toEqual([]);
    expect(plan.copies.filter((each) => each.kind === 'note')).toHaveLength(1);
  });

  it('takes a file with no extension for neither a note nor an image', () => {
    // "png", "svg", "gif": names, not extensions.
    expect(imageTypeOf('png')).toBeNull();
    expect(imageTypeOf('svg')).toBeNull();
    const plan = planImport(
      [
        { path: 'gif', size: 10 },
        { path: 'Notes/svg', size: 10 },
      ],
      'Drafts',
      [],
      LIMITS,
    );
    expect(plan.copies).toEqual([]);
    expect(plan.left.map((each) => each.reason)).toEqual(['not-a-note', 'not-a-note']);
  });
});
