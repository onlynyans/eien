import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withDefaults } from '../../core/config';
import { galleryTheme } from '../../core/themes';
import { sealButton, storyFrame } from './page-overlay';

beforeEach(() => {
  document.documentElement.replaceChildren(document.createElement('body'));
  document.documentElement.removeAttribute('style');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

const sealIn = () =>
  document.querySelector('eien-extension')?.shadowRoot?.querySelector('button') ?? null;

describe('sealButton', () => {
  it('waits hidden, then opens the story page when pressed', () => {
    const open = vi.fn();
    const seal = sealButton(document, open);
    expect(sealIn()?.style.display).toBe('none');
    seal.show(true);
    sealIn()?.click();
    expect(open).toHaveBeenCalledOnce();
    expect(sealIn()?.getAttribute('aria-label')).toBe('Read in Eien');
  });

  it('wears the theme’s own seal, by night too', () => {
    const seal = sealButton(document, () => {});
    seal.paint(withDefaults({ 'appearance.palette': 'indigo', 'appearance.scheme': 'night' }));
    const indigo = galleryTheme('indigo')?.palette;
    const painted = document.createElement('i');
    painted.style.setProperty('background', indigo?.seal[1] ?? '');
    expect(sealIn()?.style.getPropertyValue('background')).toBe(
      painted.style.getPropertyValue('background'),
    );
  });
});

describe('storyFrame', () => {
  it('covers the page, which stops scrolling until it closes, as it was', () => {
    document.documentElement.style.setProperty('overflow', 'scroll');
    const frame = storyFrame(document, 'about:blank');
    const iframe = document.querySelector('eien-extension')?.shadowRoot?.querySelector('iframe');
    expect(iframe?.getAttribute('title')).toBe('Eien Reader');
    expect(document.documentElement.style.getPropertyValue('overflow')).toBe('hidden');
    frame.close();
    expect(document.querySelector('eien-extension')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('overflow')).toBe('scroll');
  });
});
