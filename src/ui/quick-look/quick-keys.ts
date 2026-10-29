// The quick look's keyboard (docs/design/explorations/look.md): each
// setting is one stop, as a radio group is, so Tab and ⇧Tab go round the
// settings and the foot's buttons, wrapping. Arrows in a choice or the faces
// choose at once (↑ and ↓ a row of the faces); in the stepper they move
// between − and +, which Enter and Space press. Settings' own screen keeps
// every button a stop: this is the popover's alone.

const enabled = (within: Element): HTMLButtonElement[] =>
  [...within.querySelectorAll('button')].filter((button) => !button.disabled && !button.hidden);

const groups = (panel: HTMLElement) => [...panel.querySelectorAll<HTMLElement>('[role="group"]')];

/**
 * Give each setting one stop: the button with the keyboard, else the chosen value, else the first.
 * `had` is what had the keyboard before the values were shown: a stepper's end, just disabled,
 * hands it to the other button, so the keyboard stays in the popover.
 */
export function setStops(panel: HTMLElement, had: Element | null = document.activeElement): void {
  for (const group of groups(panel)) {
    const buttons = enabled(group);
    if (had instanceof HTMLButtonElement && had.disabled && group.contains(had))
      buttons[0]?.focus();
    const active = document.activeElement;
    const stop =
      buttons.find((button) => button === active) ??
      buttons.find((button) => button.getAttribute('aria-pressed') === 'true') ??
      buttons[0];
    for (const button of group.querySelectorAll('button'))
      button.tabIndex = button === stop ? 0 : -1;
  }
}

/** The stops, in order: each setting's and the foot's buttons. */
export const stopsIn = (panel: HTMLElement): HTMLButtonElement[] =>
  enabled(panel).filter((button) => button.tabIndex >= 0);

const STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** The button a row up or down from `from` among the faces' cards, by where each is drawn. */
function rowStep(buttons: readonly HTMLButtonElement[], from: HTMLButtonElement, step: number) {
  const rows = [...new Set(buttons.map((button) => button.offsetTop))].sort((a, b) => a - b);
  // All in one row (the phone's sheet, or nothing laid out): a step along it.
  if (rows.length < 2) return buttons[buttons.indexOf(from) + step];
  const row = rows[rows.indexOf(from.offsetTop) + step];
  const there = buttons.filter((button) => button.offsetTop === row);
  const across = (button: HTMLButtonElement) => Math.abs(button.offsetLeft - from.offsetLeft);
  return there.sort((a, b) => across(a) - across(b))[0];
}

/** Handle `event` in `panel`, if it's one of its keys: whether it was. */
export function quickKey(event: KeyboardEvent, panel: HTMLElement): boolean {
  if (event.altKey || event.metaKey || event.ctrlKey) return false;
  const at = (event.target as Element | null)?.closest('button') ?? null;
  if (event.key === 'Tab') {
    const stops = stopsIn(panel);
    const index = at ? stops.indexOf(at) : -1;
    const by = event.shiftKey ? -1 : 1;
    stops[index < 0 ? 0 : (index + by + stops.length) % stops.length]?.focus();
    return true;
  }
  const step = STEPS[event.key];
  const group = at?.closest<HTMLElement>('[role="group"]');
  if (!step || !at || !group || event.shiftKey) return false;
  const buttons = enabled(group);
  const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
  const next =
    group.classList.contains('faces') && vertical
      ? rowStep(buttons, at, step)
      : buttons[buttons.indexOf(at) + step];
  if (next) {
    next.focus();
    // A choice is made as the keyboard reaches it; the stepper's buttons wait for Enter or Space.
    if (!group.classList.contains('stepper')) next.click();
    setStops(panel);
  }
  return true;
}
