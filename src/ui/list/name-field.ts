// Renaming a note in place, in its row (docs/design/explorations/overall.md,
// "Renaming, made one thing"): the name itself becomes the field, in the
// same face, size and weight, its words chosen, with a hairline under it and
// the note's `.md` faded after it. Enter keeps the name, Esc puts the old one
// back, and leaving the field keeps it. A name that's taken says so under the
// row as it's typed, and the field stays open.
//
// The field lies over the row rather than inside it: the list and the tree
// draw their rows again whenever the vault changes (a sync, a save), and a
// long list draws only the rows in sight. So the field follows its row by
// its path, frame by frame, wherever that row is drawn now.

import { h } from '../dom';

export interface NameFieldSpec {
  /** The row's name as it is. */
  readonly name: string;
  /** What stays after the name (a note's ".md"), faded. */
  readonly suffix: string;
  /** The row's name element now: the one being renamed, as drawn this frame; null if out of sight. */
  label(): HTMLElement | null;
  /** What's wrong with `typed`, as the writer reads it; null when it can be kept. */
  problem(typed: string): string | null;
  /** Done: the name to keep, or null to keep the old one. `byKey` when Enter or Esc ended it. */
  done(typed: string | null, byKey: boolean): void;
}

/** The field that's open, if one is: a second rename ends it first, keeping its name. */
let open: { finish(keep: boolean): void } | null = null;

/** Open a name field over `spec`'s row. Returns false if the row isn't drawn. */
export function editName(spec: NameFieldSpec): boolean {
  const first = spec.label();
  if (!first) return false;
  open?.finish(true);
  const field = h('input', {
    class: 'name-field__input',
    attrs: { type: 'text', 'aria-label': `Rename ${spec.name}`, spellcheck: 'false' },
  });
  const said = h('p', { class: 'name-field__problem', attrs: { role: 'status', hidden: true } });
  const panel = h(
    'div',
    { class: 'name-field' },
    h(
      'div',
      { class: 'name-field__line' },
      field,
      spec.suffix ? h('span', { class: 'name-field__suffix', text: spec.suffix }) : null,
    ),
    said,
  );
  field.value = spec.name;
  let shown: HTMLElement | null = null;
  let frame = 0;

  /** Over the row's name as it's drawn now; the row's own name hidden under it. */
  const place = () => {
    const label = spec.label();
    if (label !== shown) {
      shown?.classList.remove('is-renamed');
      label?.classList.add('is-renamed');
      shown = label;
    }
    if (label) {
      const box = label.getBoundingClientRect();
      const row = label.closest('button')?.getBoundingClientRect() ?? box;
      const look = getComputedStyle(label);
      panel.style.setProperty('--name-x', `${box.left}px`);
      panel.style.setProperty('--name-y', `${box.top}px`);
      panel.style.setProperty('--name-w', `${Math.max(row.right - box.left - 8, 40)}px`);
      panel.style.setProperty('--name-h', `${box.height}px`);
      field.style.setProperty('font', look.font);
      field.style.setProperty('letter-spacing', look.letterSpacing);
    }
    frame = requestAnimationFrame(place);
  };
  const say = () => {
    const problem = spec.problem(field.value);
    said.textContent = problem ?? '';
    said.hidden = problem === null;
    field.setAttribute('aria-invalid', String(problem !== null));
    return problem;
  };
  const finish = (keep: boolean, byKey = false) => {
    if (open !== handle) return;
    // Enter on a name that can't be kept: the field stays, saying why.
    if (keep && byKey && say() !== null) return;
    open = null;
    cancelAnimationFrame(frame);
    shown?.classList.remove('is-renamed');
    panel.remove();
    const typed = field.value.trim();
    spec.done(keep && typed !== '' && typed !== spec.name ? typed : null, byKey);
  };
  const handle = { finish };
  open = handle;

  field.addEventListener('input', say);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') finish(true, true);
    else if (event.key === 'Escape') finish(false, true);
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  // Leaving the field keeps the name; the window losing focus to another app isn't leaving it.
  field.addEventListener('blur', () => {
    if (document.hasFocus()) finish(true);
  });
  document.body.append(panel);
  place();
  field.focus();
  field.select();
  return true;
}

/** Whether a name field is open. */
export const editingName = (): boolean => open !== null;
