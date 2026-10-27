// What the content script lays over a story site's page (spec §14): the seal
// in its corner, which opens the story page, and the story frame over the
// whole page. Styled through the CSS object model alone, which no site's
// content security policy refuses, and set inside a shadow root, so the
// site's styles don't reach them. (The site's script could reach them
// whatever their root: what guards the story page is that it only shows
// cleaned words and only asks for turns, core/extension.)

import type { SettingValues } from '../../core/config';
import { galleryTheme, PAPER } from '../../core/themes';

/** Above anything a site puts on its page. */
const TOP = '2147483647';

/** Day's colour or night's, as the story page would wear them now. */
const schemeOf = (values: SettingValues): 0 | 1 =>
  values['appearance.scheme'] === 'night' ||
  (values['appearance.scheme'] !== 'day' && matchMedia('(prefers-color-scheme: dark)').matches)
    ? 1
    : 0;

function styled<E extends HTMLElement>(element: E, style: Record<string, string>): E {
  for (const [name, value] of Object.entries(style)) element.style.setProperty(name, value);
  return element;
}

export interface Seal {
  show(shown: boolean): void;
  /** In the theme's own seal, by day or night, as the story page would wear it. */
  paint(values: SettingValues): void;
}

/** The seal in the page's corner: pressed, it opens the story page. */
export function sealButton(page: Document, open: () => void): Seal {
  const host = page.createElement('eien-extension');
  const button = styled(page.createElement('button'), {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    'z-index': TOP,
    width: '44px',
    height: '44px',
    margin: '0',
    padding: '0',
    border: '0',
    'border-radius': '2px',
    font: '28px/1 "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
    cursor: 'pointer',
    'outline-offset': '3px',
    // Shown once it's known the story page isn't to open at once.
    display: 'none',
  });
  button.type = 'button';
  button.textContent = '永';
  button.setAttribute('aria-label', 'Read in Eien');
  button.title = 'Read in Eien';
  button.addEventListener('click', open);
  // :focus-visible needs a style sheet; the keyboard's focus is told apart here instead.
  button.addEventListener('focus', () => {
    if (button.matches(':focus-visible'))
      button.style.setProperty('outline', '2px solid currentColor');
  });
  button.addEventListener('blur', () => button.style.removeProperty('outline'));
  host.attachShadow({ mode: 'open' }).append(button);
  page.documentElement.append(host);
  return {
    show: (shown) => button.style.setProperty('display', shown ? 'block' : 'none'),
    paint(values) {
      const palette = (galleryTheme(values['appearance.palette']) ?? PAPER).palette;
      const scheme = schemeOf(values);
      button.style.setProperty('background', palette.seal[scheme]);
      button.style.setProperty('color', scheme === 0 ? palette.paper[0] : palette.desk[1]);
    },
  };
}

export interface StoryFrame {
  readonly window: Window | null;
  close(): void;
}

/** The story page over the whole of `page`, which stops scrolling under it until it closes. */
export function storyFrame(page: Document, src: string): StoryFrame {
  const root = page.documentElement;
  const overflow = root.style.getPropertyValue('overflow');
  const host = page.createElement('eien-extension');
  const frame = styled(page.createElement('iframe'), {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    'z-index': TOP,
    border: '0',
    margin: '0',
    background: 'transparent',
  });
  frame.title = 'Eien Reader';
  frame.src = src;
  frame.addEventListener('load', () => frame.focus());
  host.attachShadow({ mode: 'open' }).append(frame);
  root.append(host);
  root.style.setProperty('overflow', 'hidden');
  return {
    get window() {
      return frame.contentWindow;
    },
    close() {
      host.remove();
      if (overflow) root.style.setProperty('overflow', overflow);
      else root.style.removeProperty('overflow');
    },
  };
}
