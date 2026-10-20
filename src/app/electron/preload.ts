import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';
import { type Bridge, CHANNEL, type MenuCommand } from '../../platform/bridge';

// The window's only door to the system. It runs sandboxed: nothing here may
// import Node modules, and nothing but these calls crosses to the window.

/** Subscribe to a channel; returns a function that unsubscribes. */
function listen<T>(channel: string, listener: (value: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const bridge: Bridge = {
  platform: process.platform,
  vault: {
    current: () => ipcRenderer.invoke(CHANNEL.current),
    choose: () => ipcRenderer.invoke(CHANNEL.choose),
    list: () => ipcRenderer.invoke(CHANNEL.list),
    notes: () => ipcRenderer.invoke(CHANNEL.notes),
    search: (query) => ipcRenderer.invoke(CHANNEL.search, query),
    listFiles: (folder) => ipcRenderer.invoke(CHANNEL.listFiles, folder),
    read: (path) => ipcRenderer.invoke(CHANNEL.read, path),
    readBytes: (path) => ipcRenderer.invoke(CHANNEL.readBytes, path),
    write: (path, text, expected) => ipcRenderer.invoke(CHANNEL.write, path, text, expected),
    move: (from, to) => ipcRenderer.invoke(CHANNEL.move, from, to),
    trash: (path) => ipcRenderer.invoke(CHANNEL.trash, path),
    makeFolder: (path) => ipcRenderer.invoke(CHANNEL.makeFolder, path),
    onChange: (listener) => listen<string[]>(CHANNEL.changed, listener),
  },
  settings: {
    read: () => ipcRenderer.invoke(CHANNEL.settingsRead),
    set: (key, value) => ipcRenderer.invoke(CHANNEL.settingsSet, key, value),
  },
  out: {
    copy: (text, html) => ipcRenderer.invoke(CHANNEL.outCopy, text, html),
    saveAs: (name, text) => ipcRenderer.invoke(CHANNEL.outSaveAs, name, text),
  },
  onMenu: (listener) => listen<MenuCommand>(CHANNEL.menu, listener),
  onBeforeClose: (save) => {
    ipcRenderer.on(CHANNEL.beforeClose, () => {
      save().finally(() => ipcRenderer.send(CHANNEL.closeReady));
    });
  },
};

contextBridge.exposeInMainWorld('eien', bridge);
