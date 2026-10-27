// Interface zoom on a phone: the viewport scaled as a browser zooms (./viewport.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitViewport, followViewport, viewportFor } from './viewport';

const meta = () => document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
const addMeta = () =>
  document.head.append(Object.assign(document.createElement('meta'), { name: 'viewport' }));

afterEach(() => meta()?.remove());

describe('the viewport', () => {
  it('at 100%, the screen’s width, as the page starts', () => {
    expect(viewportFor(100, 412)).toBe(
      'width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover',
    );
  });

  it('zoomed out, scaled down from the screen’s width, no smaller: laid out wider', () => {
    expect(viewportFor(80, 412)).toBe(
      'width=device-width, initial-scale=0.8, minimum-scale=0.8, viewport-fit=cover',
    );
  });

  it('zoomed in, the screen’s width over the scale spelt out: laid out again, not run past it', () => {
    expect(viewportFor(150, 412)).toBe(
      'width=275, initial-scale=1.5, minimum-scale=1.5, viewport-fit=cover',
    );
    expect(viewportFor(200, 706)).toContain('width=353,');
  });

  it('is written to the page’s viewport, only when it changes', () => {
    addMeta();
    const set = vi.spyOn(meta(), 'setAttribute');
    fitViewport(80);
    expect(meta().getAttribute('content')).toBe(viewportFor(80, screen.width));
    fitViewport(80);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('follows the screen as it turns or unfolds, a zoom in’s width with it', () => {
    addMeta();
    const width = vi.spyOn(screen, 'width', 'get').mockReturnValue(412);
    const stop = followViewport(() => 150);
    expect(meta().getAttribute('content')).toContain('width=275,');
    width.mockReturnValue(706); // unfolded
    window.dispatchEvent(new Event('resize'));
    expect(meta().getAttribute('content')).toContain('width=471,');
    stop();
    width.mockReturnValue(412);
    window.dispatchEvent(new Event('resize'));
    expect(meta().getAttribute('content')).toContain('width=471,');
  });
});
