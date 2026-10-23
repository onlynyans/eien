// The two-pane lens (backlog #33, and 2026-10-22): no head in the sidebar,
// only its icons at the search field's end and its chips while a lens is on.

import { describe, expect, it } from 'vitest';
import { h } from '../dom';
import { drawLensSlot, type LensSlot } from './lens-slot';

const slotOf = (): LensSlot => ({ tools: h('span'), chips: h('div') });
const button = (key: string) => h('button', { attrs: { 'data-key': key }, text: key });

describe('the two-pane lens', () => {
  it('draws the icons alone, named for the row they act on, with no head', () => {
    const slot = slotOf();
    drawLensSlot(slot, { name: 'Fic', controls: [button('lens-filter:tree')], chips: null });
    expect(slot.tools.hidden).toBe(false);
    expect(slot.tools.getAttribute('aria-label')).toBe('Sort and filter Fic');
    expect([...slot.tools.children].map((each) => each.textContent)).toEqual(['lens-filter:tree']);
    expect(slot.tools.textContent).not.toContain('Fic');
    expect(slot.chips.hidden).toBe(true);
  });

  it('shows the chips only while a lens is on, and hides everything for none', () => {
    const slot = slotOf();
    const chips = h('div', { class: 'list__lens', text: '#posted' });
    drawLensSlot(slot, { name: 'Fic', controls: [], chips });
    expect(slot.chips.hidden).toBe(false);
    expect(slot.chips.textContent).toBe('#posted');
    drawLensSlot(slot, null);
    expect(slot.tools.hidden).toBe(true);
    expect(slot.chips.hidden).toBe(true);
    expect(slot.tools.childElementCount + slot.chips.childElementCount).toBe(0);
  });

  it('keeps the keyboard on the control it was on across a redraw', () => {
    const slot = slotOf();
    document.body.append(slot.tools, slot.chips);
    drawLensSlot(slot, { name: 'Fic', controls: [button('lens-sort:tree')], chips: null });
    slot.tools.querySelector('button')?.focus();
    drawLensSlot(slot, { name: 'Fic', controls: [button('lens-sort:tree')], chips: null });
    expect(document.activeElement?.getAttribute('data-key')).toBe('lens-sort:tree');
    slot.tools.remove();
    slot.chips.remove();
  });
});
