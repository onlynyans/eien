// The mix of a theme of the writer's own (themes.md, B · Custom): its name,
// editable in place (renaming renames its file); its file; the trash; its
// colours by day and by night; four knobs whose tracks show the colours they
// choose between; and the contrast verdict. It's worn as it changes and
// saved as it changes, a moment after the knob stops.

import { hsl, MIX_KEYS, MIX_RANGE, type Mix, type Palette, themePath } from '../../core/themes';
import type { WriterTheme } from '../../platform/theme-files';
import { h } from '../dom';
import { icon } from '../icons';
import { reasonOf } from '../reason';
import type { WriterThemes } from '../theme/writer-themes';

/** How long a knob rests before its mix is written. */
const SAVE_AFTER_MS = 300;

const KNOB_NAMES: Readonly<Record<keyof Mix, string>> = {
  paper: 'Paper',
  warmth: 'Warmth',
  ink: 'Ink',
  seal: 'Seal',
};

/** What a knob's track shows: the hues themselves, or the paper from grey to warm. */
function track(key: keyof Mix, mix: Mix): string {
  const hues = (color: (hue: number) => string) =>
    Array.from({ length: 13 }, (_, i) => color(i * 30)).join(', ');
  const along = (stops: string) => `linear-gradient(90deg, ${stops})`;
  if (key === 'warmth') return along(`${hsl(mix.paper, 0, 90)}, ${hsl(mix.paper, 40, 88)}`);
  if (key === 'paper') return along(hues((hue) => hsl(hue, Math.max(mix.warmth, 18), 86)));
  if (key === 'ink') return along(hues((hue) => hsl(hue, 48, 28)));
  return along(hues((hue) => hsl(hue, 63, 47)));
}

const SURFACE_CHIPS = ['desk', 'band', 'paper', 'selected'] as const;

/** A scheme's colours in a strip: the surfaces, the three inks on paper, the seal. */
function paintChips(strip: HTMLElement, palette: Palette, scheme: 0 | 1): void {
  const chip = (color: string, className?: string) => {
    const element = h('i', className ? { class: className } : {});
    element.style.setProperty('background', color);
    return element;
  };
  const inks = chip(palette.paper[scheme], 'mix__inks');
  inks.append(...(['ink', 'ink-soft', 'pencil'] as const).map((ink) => chip(palette[ink][scheme])));
  strip.replaceChildren(
    ...SURFACE_CHIPS.map((role) => chip(palette[role][scheme])),
    inks,
    chip(palette.seal[scheme]),
  );
}

export interface MixPanelOf {
  readonly themes: WriterThemes;
  /** Say what happened, or why it couldn't. */
  say(words: string): void;
}

export class MixPanel {
  readonly element = h('section', { class: 'mix' });
  readonly #of: MixPanelOf;
  #title = '';
  #mix: Mix | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #renaming = false;
  readonly #name = h('input', {
    class: 'mix__name',
    attrs: { type: 'text', 'aria-label': 'Theme name', spellcheck: 'false', autocomplete: 'off' },
  });
  readonly #file = h('span', { class: 'mix__file' });
  readonly #trash = h(
    'button',
    { class: 'icon-button mix__trash', attrs: { type: 'button' } },
    icon('trash'),
  );
  readonly #day = h('span', { class: 'mix__chips', attrs: { 'aria-hidden': 'true' } });
  readonly #night = h('span', { class: 'mix__chips', attrs: { 'aria-hidden': 'true' } });
  readonly #knobs = new Map<keyof Mix, { input: HTMLInputElement; shown: HTMLOutputElement }>();
  readonly #verdict = h('p', { class: 'mix__verdict', attrs: { 'aria-live': 'polite' } });
  readonly #unread = h('p', { class: 'mix__unread' });
  readonly #body: HTMLElement;

  constructor(of: MixPanelOf) {
    this.#of = of;
    this.#name.addEventListener('keydown', (event) => this.#nameKey(event));
    this.#name.addEventListener('change', () => void this.#rename());
    this.#trash.addEventListener('click', () => void this.#sendToTrash());
    const knobs = MIX_KEYS.map((key) => {
      const input = h('input', {
        class: 'mix__knob',
        attrs: {
          type: 'range',
          min: String(MIX_RANGE[key].min),
          max: String(MIX_RANGE[key].max),
          'data-knob': key,
        },
      });
      const shown = h('output', { class: 'count' });
      input.addEventListener('input', () => this.#turned(key, Number(input.value)));
      input.addEventListener('change', () => void this.flush());
      this.#knobs.set(key, { input, shown });
      return h(
        'label',
        { class: 'mix__knob-row' },
        h('span', { class: 'label', text: KNOB_NAMES[key] }),
        input,
        shown,
      );
    });
    this.#body = h(
      'div',
      { class: 'mix__body' },
      h(
        'div',
        { class: 'mix__preview' },
        h('span', { class: 'label', text: 'Day' }),
        this.#day,
        h('span', { class: 'label', text: 'Night' }),
        this.#night,
      ),
      ...knobs,
      this.#verdict,
    );
    this.element.append(
      h('div', { class: 'mix__head' }, this.#name, this.#file, this.#trash),
      this.#unread,
      this.#body,
    );
  }

  /** The theme it shows. */
  get title(): string {
    return this.#title;
  }

  /** Renaming: the theme is between names, so it's shown as it is meanwhile. */
  get renaming(): boolean {
    return this.#renaming;
  }

  /** Show `theme`, as its file is now; a knob being turned keeps where it is. */
  show(theme: WriterTheme): void {
    const another = theme.title !== this.#title;
    if (another) void this.flush();
    this.#title = theme.title;
    this.element.setAttribute('aria-label', theme.title);
    if (another || document.activeElement !== this.#name) this.#name.value = theme.title;
    this.#file.textContent = themePath(theme.title);
    this.#trash.setAttribute('aria-label', `Send ${theme.title} to the trash`);
    this.#trash.title = 'Send to the trash';
    this.#unread.hidden = theme.mix !== null;
    this.#body.hidden = theme.mix === null;
    this.#unread.textContent =
      theme.mix === null
        ? 'Eien can’t read this theme file, so Washi is shown instead and the file is left unchanged. Fix it manually or move it to the trash.'
        : '';
    if (theme.mix === null) {
      this.#mix = null;
      return;
    }
    const turning = this.#timer !== undefined;
    if (another || !turning) this.#mix = theme.mix;
    this.#draw(this.#mix ?? theme.mix);
  }

  /** Write the mix now, if a knob was turned since it was last written. */
  async flush(): Promise<void> {
    if (this.#timer === undefined) return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    const { themes, say } = this.#of;
    const [title, mix] = [this.#title, this.#mix];
    if (!mix) return;
    try {
      await themes.save(title, mix);
      say(`Saved to ${themePath(title)}`);
    } catch (error) {
      say(reasonOf(error));
    }
  }

  /** Put the keyboard in the name, all of it chosen, for a theme just made. */
  nameFirst(): void {
    this.#name.focus();
    this.#name.select();
  }

  #draw(mix: Mix): void {
    const { themes } = this.#of;
    const palette = themes.palette(mix);
    paintChips(this.#day, palette, 0);
    paintChips(this.#night, palette, 1);
    for (const [key, { input, shown }] of this.#knobs) {
      if (document.activeElement !== input || this.#timer === undefined) {
        input.value = String(mix[key]);
      }
      input.setAttribute('aria-valuetext', `${KNOB_NAMES[key]} ${mix[key]}`);
      shown.textContent = String(mix[key]);
      input.style.setProperty('--track', track(key, mix));
    }
    const verdict = themes.verdict(mix);
    this.#verdict.textContent = verdict.words;
    this.#verdict.classList.toggle('mix__verdict--short', !verdict.keeps);
  }

  #turned(key: keyof Mix, value: number): void {
    if (!this.#mix) return;
    this.#mix = { ...this.#mix, [key]: value };
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.flush(), SAVE_AFTER_MS);
    this.#of.themes.preview(this.#title, this.#mix); // worn at once; written when it rests
  }

  #nameKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.#rename();
    } else if (event.key === 'Escape') {
      // Esc puts the name back, and leaves Settings open.
      event.preventDefault();
      event.stopPropagation();
      this.#name.value = this.#title;
      this.#name.select();
    }
  }

  async #rename(): Promise<void> {
    const typed = this.#name.value.trim();
    if (typed === this.#title) return;
    const { themes, say } = this.#of;
    await this.flush();
    this.#renaming = true;
    try {
      const renamed = await themes.rename(this.#title, typed);
      if (renamed.ok) {
        this.#title = renamed.title;
        this.#name.value = renamed.title;
        say(`Renamed: ${themePath(renamed.title)}`);
        return;
      }
      say(
        renamed.problem === 'taken'
          ? `“${typed}” is a theme already: this one keeps its name.`
          : 'A theme needs a name: it keeps the one it had.',
      );
    } catch (error) {
      say(reasonOf(error));
    } finally {
      this.#renaming = false;
    }
    this.#name.value = this.#title;
  }

  async #sendToTrash(): Promise<void> {
    const { themes, say } = this.#of;
    const title = this.#title;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    try {
      await themes.trash(title);
      say(`“${title}” is in the trash, where you can take it back.`);
    } catch (error) {
      say(reasonOf(error));
    }
  }
}
