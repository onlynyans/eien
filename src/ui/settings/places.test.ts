// Where each setting sits in Settings: every one in exactly one tab, the
// vault's own under This vault and nowhere else (#31).

import { describe, expect, it } from 'vitest';
import { SETTING_GROUPS, SETTINGS } from '../../core/config';
import { CATEGORIES, isShelfs, placesHere, quickIn, settingsIn } from './places';

const tabs = CATEGORIES.flatMap((category) => category.tabs.map((tab) => ({ category, tab })));

describe('the categories', () => {
  it('give every group of the schema one tab', () => {
    const shown = tabs.flatMap(({ tab }) => (tab.group ? [tab.group] : []));
    expect([...shown].sort()).toEqual([...SETTING_GROUPS].sort());
  });

  it('put every setting in one tab, the vault’s own only under This vault', () => {
    for (const setting of SETTINGS.filter((each) => !isShelfs(each))) {
      // Each where it's offered: a system's own on the first system it names.
      const platform = 'platforms' in setting ? setting.platforms[0] : 'darwin';
      const holding = tabs.filter(({ tab }) =>
        settingsIn(tab, platform).some((each) => each.key === setting.key),
      );
      expect(holding, setting.key).toHaveLength(1);
      expect(holding[0]?.category.scope, setting.key).toBe(setting.scope);
    }
    expect(CATEGORIES.filter((category) => category.scope === 'vault').map((c) => c.name)).toEqual([
      'This vault',
    ]);
  });

  it('show only the tabs with something in them here, Themes always', () => {
    // A phone's Lists, all panes' settings, shows only while there are panes (settings-screen.test.ts).
    expect(
      placesHere('android')
        .find((category) => category.name === 'Themes')
        ?.tabs.map((t) => t.name),
    ).toEqual(['Gallery', 'Custom']);
    expect(placesHere('darwin').map((category) => category.name)).toEqual([
      'Look',
      'Themes',
      'Writing',
      'This vault',
    ]);
  });
});

describe('the quick look’s settings (#49)', () => {
  it('are the marked ones, in the schema’s order', () => {
    const notes = [
      'appearance.scheme',
      'appearance.face',
      'appearance.textSize',
      'appearance.leading',
      'page.width',
      'appearance.frame',
    ];
    expect(quickIn('darwin', false, 'note').map((setting) => setting.key)).toEqual(notes);
    // A book's own (#40), Pages or Scroll and the scroll style, with a book in front alone.
    expect(quickIn('darwin', false, 'epub').map((setting) => setting.key)).toEqual([
      ...notes,
      'epub.view',
      'epub.turn',
      'epub.turnSpeed',
      'epub.scroll',
      'epub.marks',
    ]);
  });

  it('keep a book’s own out of Settings, which sets notes (#40)', () => {
    const shown = tabs.flatMap(({ tab }) => settingsIn(tab, 'darwin').map((each) => each.key));
    expect(shown).not.toContain('epub.view');
    expect(shown).not.toContain('epub.scroll');
    expect(SETTINGS.filter(isShelfs).map((setting) => setting.key)).toEqual([
      'epub.view',
      'epub.turn',
      'epub.turnSpeed',
      'epub.scroll',
      'epub.marks',
    ]);
  });

  it('leave out what the room doesn’t offer: a phone’s one pane has no page width', () => {
    expect(quickIn('android', true, 'note').map((setting) => setting.key)).not.toContain(
      'page.width',
    );
    expect(quickIn('android', false, 'note').map((setting) => setting.key)).toContain('page.width');
  });
});
