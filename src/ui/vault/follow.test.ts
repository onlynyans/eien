// What a shown vault follows of the settings (QA, #40 Phase 4d): Marks
// switched while a book is open draws the panes again, so the list's
// Contents and Marks come or go with it; a setting the panes don't show
// draws nothing.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type SettingValues } from '../../core/config';
import type { SettingsState } from '../settings/settings-state';
import { type FollowOf, follow } from './follow';

let stop = () => {};
afterEach(() => stop());

function followed() {
  let told: (values: SettingValues, before: SettingValues) => void = () => {};
  const settings = {
    onChange: (listener: typeof told) => {
      told = listener;
      return () => {};
    },
    reload: async () => {},
  } as unknown as SettingsState;
  const redraw = vi.fn(async () => {});
  const of = {
    vault: { onChange: () => () => {} },
    settings,
    panes: { setTwo: () => {}, refit: () => {} },
    menu: { on: () => () => {} },
    commands: {
      pages: { diskChanged: () => {}, flush: () => {} },
      list: document.createElement('div'),
    },
    organizer: {},
    tree: document.createElement('div'),
    dropFolder: () => {},
    pageDrop: {},
    placeNote: () => {},
    folderDrags: () => true,
    refresh: async () => {},
    redraw,
    act: async () => {},
    listOrdered: () => false,
    showFolder: () => {},
    tell: () => {},
  } as unknown as FollowOf;
  stop = follow(of);
  const change = (values: Partial<SettingValues>) =>
    told({ ...DEFAULT_SETTINGS, ...values } as SettingValues, DEFAULT_SETTINGS);
  return { change, redraw };
}

describe('the settings a shown vault follows', () => {
  it('draws the panes again when a book’s Marks move to the edge or back to the list', () => {
    const { change, redraw } = followed();
    change({ 'epub.marks': 'edge' });
    expect(redraw).toHaveBeenCalledOnce();
  });

  it('draws nothing for a setting the panes don’t show', () => {
    const { change, redraw } = followed();
    change({ 'epub.view': 'pages' });
    change({});
    expect(redraw).not.toHaveBeenCalled();
  });
});
