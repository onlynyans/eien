// ⌘K: make the selection a link, leaving the caret where the next thing
// goes. A selected address becomes the link's target; other selected text
// becomes its words.

import type { Edit, Selection } from './edit';

const ADDRESS = /^(?:https?:\/\/|mailto:)\S+$/i;

export function insertLink(text: string, selection: Selection): Edit {
  const selected = text.slice(selection.from, selection.to);
  if (ADDRESS.test(selected)) {
    // [](address): the caret waits for the words.
    const insert = `[](${selected})`;
    return {
      changes: [{ from: selection.from, to: selection.to, insert }],
      selection: { from: selection.from + 1, to: selection.from + 1 },
    };
  }
  // [words](): the caret waits for the address.
  const insert = `[${selected}]()`;
  const caret = selection.from + insert.length - 1;
  return {
    changes: [{ from: selection.from, to: selection.to, insert }],
    selection: { from: caret, to: caret },
  };
}
