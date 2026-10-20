import { describe, expect, it } from 'vitest';
import { diskChange, hasUnsavedEdits } from './index';

describe('diskChange', () => {
  const base = 'She takes it.';

  it('does nothing when the file still holds what we knew', () => {
    expect(diskChange(base, 'She takes it. Edited.', base)).toEqual({ kind: 'none' });
  });

  it('shows the new text when there are no edits here', () => {
    expect(diskChange(base, base, 'She takes it gently.')).toEqual({
      kind: 'reload',
      text: 'She takes it gently.',
    });
  });

  it('notes it as saved when the file now matches the editor', () => {
    expect(diskChange(base, 'Same edit', 'Same edit')).toEqual({ kind: 'same' });
  });

  it('keeps both when both changed', () => {
    expect(diskChange(base, 'Edit here', 'Edit there')).toEqual({ kind: 'conflict' });
  });

  it('treats an emptied file as a change, never as nothing', () => {
    expect(diskChange(base, base, '')).toEqual({ kind: 'reload', text: '' });
    expect(diskChange(base, 'Edit here', '')).toEqual({ kind: 'conflict' });
  });
});

describe('hasUnsavedEdits', () => {
  it('is whether the editor differs from the file', () => {
    expect(hasUnsavedEdits('a', 'a')).toBe(false);
    expect(hasUnsavedEdits('a', 'ab')).toBe(true);
  });
});
