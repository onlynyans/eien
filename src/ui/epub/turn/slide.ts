// Slide (#40, Phase 3): the words carried a page, as Pages 1 and 2 first
// turned. The paper stays; the page's words go out toward where you came
// from as the next page's come in behind them, a page's width apart, so
// they read as one line of text moving on. `translate` moves them, so a
// page's own transform (a chapter's columns moved to the page) is kept.

export interface StepMotion {
  /** The words leaving (a copy's) and coming (the sheet's), 1 on or -1 back. */
  readonly leaving: HTMLElement;
  readonly coming: HTMLElement;
  readonly way: 1 | -1;
}

/** Slide over `time` on `ease`, the words `width` apart. */
export function slide(
  { leaving, coming, way }: StepMotion,
  width: number,
  time: number,
  ease: string,
): Animation[] {
  const timing: KeyframeAnimationOptions = { duration: time, easing: ease, fill: 'both' };
  const across = (x: number) => `${x}px 0`;
  return [
    leaving.animate([{ translate: across(0) }, { translate: across(-way * width) }], timing),
    coming.animate([{ translate: across(way * width) }, { translate: across(0) }], timing),
  ];
}
