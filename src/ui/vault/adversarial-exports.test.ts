// Adversarial: a note's own Export… (spec §8) for a note that isn't open,
// read from the disk as it's stored. Fails on the code as it stands.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { OutBridge, OutFile, VaultBridge } from '../../platform/bridge';
import { SettingsState } from '../settings/settings-state';
import { exportsOf } from './exports';
import type { Navigation } from './navigation';
import { VaultState } from './vault-state';

/** A note as another app saved it: a byte-order mark, then its front matter. */
const STORED = '﻿---\r\nid: 01JB2X4Q7Z\r\ntags: [private]\r\n---\r\nShe mended the scarf.\r\n';

async function exportsWith(files: Record<string, string>) {
  const saved: { name: string; file: OutFile }[] = [];
  const told: string[] = [];
  const read = async (path: string) => {
    const text = files[path];
    return text === undefined ? null : { text, version: 'v1' };
  };
  const state = new VaultState(
    {
      list: async () =>
        Object.keys(files).map((path) => ({ path, kind: 'note' as const, modified: 0, size: 0 })),
      notes: async () => [],
      search: async () => ({ total: 0, hits: [] }),
      read,
    },
    'Vault',
  );
  await state.refresh();
  const out: OutBridge = {
    kinds: ['html', 'epub', 'docx', 'pdf'],
    copy: async () => undefined,
    saveAs: async (name, file) => {
      saved.push({ name, file });
      return `${name}.out`;
    },
  };
  const settings = await SettingsState.load({
    read: async () => DEFAULT_SETTINGS,
    set: async () => DEFAULT_SETTINGS,
  });
  const exports = exportsOf({
    state,
    nav: {} as Navigation,
    openPath: () => null, // no note open
    openText: () => null,
    vault: { read } as unknown as VaultBridge,
    out,
    settings,
    tell: (message) => told.push(message),
  });
  return { exports, saved, told };
}

describe('a note’s Export… → HTML, for a note that isn’t open', () => {
  it('never posts the front matter of a note stored with a byte-order mark', async () => {
    const { exports, saved } = await exportsWith({ 'Mending.md': STORED });
    await exports.note('Mending.md', 'html');
    expect(saved).toHaveLength(1);
    const file = saved[0]?.file;
    const html = file?.kind === 'html' ? file.text : '';
    expect(html).toContain('She mended the scarf.');
    expect(html).not.toContain('01JB2X4Q7Z'); // spec §8: "The front matter is never posted."
    expect(html).not.toContain('private');
  });
});
