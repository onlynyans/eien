// The system's window controls, drawn over the page's band on Windows and
// Linux (spec §4), take the band's colours: told again whenever day, night,
// the palette or a zoom changes what the band looks like.

import type { Bridge, ControlsPaint } from '../../platform/bridge';
import { h } from '../dom';

/** Follow the band's look; returns a function to tell the controls it may have changed. */
export function paintWindowControls(bridge: Pick<Bridge, 'paintControls'>): () => void {
  // An unseen band of its own, styled as the panes' bands are (./shell.css), to read them from.
  const probe = h('div', { class: 'band-probe', attrs: { 'aria-hidden': 'true' } });
  document.body.append(probe);
  let last = '';
  const tell = () => {
    const style = getComputedStyle(probe);
    const paint: ControlsPaint = {
      band: style.backgroundColor,
      ink: style.color,
      height: probe.getBoundingClientRect().height,
    };
    const now = JSON.stringify(paint);
    if (now === last) return;
    last = now;
    void bridge.paintControls(paint).catch(console.error);
  };
  // The system's day or night, when the scheme follows it.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tell);
  tell();
  return tell;
}
