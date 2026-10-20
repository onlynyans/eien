/** What the preload exposes to the window as `window.eien`. Every capability
 * the window has beyond a web page is listed here, and nowhere else. */
export interface Bridge {
  /** The operating system: 'darwin', 'win32', 'linux', … */
  readonly platform: string;
}

declare global {
  interface Window {
    readonly eien: Bridge;
  }
}
