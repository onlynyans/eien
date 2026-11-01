// The window's name is its page's (a note's title, a book's, #40), or, with
// nothing open, its vault's: the system lists windows by it (macOS's Window
// menu, the taskbar), so with several open each is found by what it shows.

/** Name the window for the page named `page`, or the vault `vault` when it shows nothing. */
export function nameWindow(page: string | null, vault: string): void {
  const name = page || vault;
  if (document.title !== name) document.title = name;
}
