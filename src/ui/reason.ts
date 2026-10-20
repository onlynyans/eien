// What went wrong, as the writer should read it.

/** The main process's reason, without Electron's wrapping ("Error invoking remote method…"). */
export function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, '');
}
