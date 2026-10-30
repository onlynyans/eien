import { describe, expect, it, vi } from 'vitest';
import { buildTree } from '../../core/vault';
import { FolderField } from './folder-field';

const tree = buildTree([{ path: 'Both/a.md', kind: 'note', modified: 0, size: 0 }], 'Vault');
const both = tree.folders[0];

describe('a folder renamed in place', () => {
  it('is a field in the section it was asked from alone, though the folder is in both (#40)', () => {
    if (!both) throw new Error('no folder');
    const done = vi.fn();
    const field = new FolderField({ drawing: () => false, done });
    field.start('Both', 'shelf');
    expect(field.row(both, 0, 'folders')).toBeNull();
    const row = field.row(both, 0, 'shelf') as HTMLElement;
    const input = row.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('Both');
    input.value = 'Reading';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(done).toHaveBeenCalledWith(both, 'Reading', 'shelf');
  });
});
