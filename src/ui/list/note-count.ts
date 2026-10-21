// "1 note", "2 notes": how many notes, said the same at the list's head and the sidebar's foot.

export const noteCount = (n: number): string =>
  `${n.toLocaleString()} ${n === 1 ? 'note' : 'notes'}`;
