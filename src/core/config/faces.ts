// The faces Eien bundles (spec §6), one list for the three face settings: the
// text face's (anything a person wrote), the interface font's (what the
// machine counts and what you press) and the Source font's (the raw Markdown
// of the Source view, and code). A face added later is one entry here, with
// its family in tokens.css (`--eien-family-<id>`, and a `[data-face]` block
// for a text face) and its files in ui/theme/fonts.css.

/** A face's sizes in the machine's voice, in CSS pixels. */
export interface MachineSizes {
  /** Counts, dates, the status line (--eien-size-meta). */
  readonly meta: number;
  /** Labels and word buttons, set in capitals (--eien-size-label). */
  readonly label: number;
  /** The Source view's raw Markdown, set by the Source font (--eien-size-source). */
  readonly source: number;
}

export interface Face {
  /** The settings' value, and the `--eien-family-<id>` token's name. */
  readonly id: string;
  readonly name: string;
  /** Monospaced: for the interface and the Source view, never a text face. */
  readonly mono?: true;
  /**
   * Its machine sizes: faces of one size don't look one size (x-heights and
   * widths differ), so each is set by eye to read as Plex Mono does.
   */
  readonly machine: MachineSizes;
}

export const FACES = [
  {
    id: 'plex-mono',
    name: 'IBM Plex Mono',
    mono: true,
    machine: { meta: 11, label: 10, source: 14 },
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    mono: true,
    machine: { meta: 10.5, label: 10, source: 13.5 },
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    mono: true,
    machine: { meta: 11, label: 10, source: 13.5 },
  },
  {
    id: 'cascadia-code',
    name: 'Cascadia Code',
    mono: true,
    machine: { meta: 11, label: 10, source: 14 },
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    mono: true,
    machine: { meta: 11.5, label: 10.5, source: 14.5 },
  },
  { id: 'iosevka', name: 'Iosevka', mono: true, machine: { meta: 12, label: 11, source: 15 } },
  {
    id: 'commit-mono',
    name: 'Commit Mono',
    mono: true,
    machine: { meta: 11, label: 10, source: 14 },
  },
  {
    id: 'space-mono',
    name: 'Space Mono',
    mono: true,
    machine: { meta: 10.5, label: 10, source: 13.5 },
  },
  {
    id: 'victor-mono',
    name: 'Victor Mono',
    mono: true,
    machine: { meta: 11.5, label: 10.5, source: 14.5 },
  },
  {
    id: 'monaspace-radon',
    name: 'Monaspace Radon',
    mono: true,
    machine: { meta: 10.5, label: 10, source: 13.5 },
  },
  {
    id: 'comic-mono',
    name: 'Comic Mono',
    mono: true,
    machine: { meta: 11, label: 10, source: 14 },
  },
  { id: 'newsreader', name: 'Newsreader', machine: { meta: 12.5, label: 11.5, source: 16.5 } },
  { id: 'literata', name: 'Literata', machine: { meta: 11.5, label: 10.5, source: 15 } },
  { id: 'plex-sans', name: 'IBM Plex Sans', machine: { meta: 11.5, label: 10.5, source: 14.5 } },
  { id: 'source-sans', name: 'Source Sans 3', machine: { meta: 12, label: 11, source: 15.5 } },
  {
    id: 'atkinson',
    name: 'Atkinson Hyperlegible Next',
    machine: { meta: 11.5, label: 10.5, source: 14.5 },
  },
  {
    id: 'schibsted',
    name: 'Schibsted Grotesk',
    machine: { meta: 11.5, label: 10.5, source: 14.5 },
  },
  { id: 'hanken', name: 'Hanken Grotesk', machine: { meta: 12, label: 11, source: 15 } },
  { id: 'instrument', name: 'Instrument Sans', machine: { meta: 11.5, label: 10.5, source: 14.5 } },
] as const satisfies readonly Face[];

type Listed = (typeof FACES)[number];
type TextFace = Exclude<Listed, { readonly mono: true }>;

/**
 * The interface font's and the Source font's choices: every face, the monos
 * first and Plex Mono, both defaults, first of all.
 */
export const INTERFACE_FACES = FACES;
/** The text face's choices: every face but the monos. */
export const TEXT_FACES = FACES.filter((face): face is TextFace => !('mono' in face));

/** The face called `id`, if there is one. */
export const faceOf = (id: string): Face | undefined =>
  (FACES as readonly Face[]).find((face) => face.id === id);

/** `faces` as a setting's choices: id → name, in the list's order. */
export const faceChoices = <F extends readonly Face[]>(faces: F) =>
  Object.fromEntries(faces.map((face) => [face.id, face.name])) as Readonly<
    Record<F[number]['id'], string>
  >;
