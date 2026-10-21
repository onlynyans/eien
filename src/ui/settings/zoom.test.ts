import { describe, expect, it } from 'vitest';
import { isZoomCommand, zoomedBy, zoomKeyFor } from './zoom';

describe('which zoom ⌘+ and ⌘− change (spec §4)', () => {
  it('is the page’s with the keyboard in it, the whole window’s elsewhere', () => {
    expect(zoomKeyFor(true, true)).toBe('page.zoom');
    expect(zoomKeyFor(false, true)).toBe('window.zoom');
  });

  it('is the page’s wherever the window has no zoom of its own (a phone)', () => {
    expect(zoomKeyFor(false, false)).toBe('page.zoom');
  });

  it('steps by 10%, stops at 50% and 200%, and ⌘0 puts back 100%', () => {
    expect(zoomedBy('zoom:in', 'window.zoom', 120)).toBe(130);
    expect(zoomedBy('zoom:out', 'window.zoom', 120)).toBe(110);
    expect(zoomedBy('zoom:in', 'window.zoom', 200)).toBe(200);
    expect(zoomedBy('zoom:out', 'page.zoom', 50)).toBe(50);
    expect(zoomedBy('zoom:reset', 'window.zoom', 170)).toBe(100);
  });

  it('knows the zoom commands, and only those', () => {
    expect(['zoom:in', 'zoom:out', 'zoom:reset'].every((c) => isZoomCommand(c as never))).toBe(
      true,
    );
    expect(isZoomCommand('seal')).toBe(false);
    expect(isZoomCommand('toString' as never)).toBe(false);
  });
});
