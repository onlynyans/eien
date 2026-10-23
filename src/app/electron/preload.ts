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
    search: (query, within) => ipcRenderer.invoke(CHANNEL.search, query, within),
    listFiles: (folder) => ipcRenderer.invoke(CHANNEL.listFiles, folder),
    read: (path) => ipcRenderer.invoke(CHANNEL.read, path),
    readBytes: (path) => ipcRenderer.invoke(CHANNEL.readBytes, path),
    write: (path, text, expected) => ipcRenderer.invoke(CHANNEL.write, path, text, expected),
    writeNew: (path, bytes) => ipcRenderer.invoke(CHANNEL.writeNew, path, bytes),
    move: (from, to) => ipcRenderer.invoke(CHANNEL.move, from, to),
    trash: (path) => ipcRenderer.invoke(CHANNEL.trash, path),
    makeFolder: (path) => ipcRenderer.invoke(CHANNEL.makeFolder, path),
    importFolder: () => ipcRenderer.invoke(CHANNEL.importFolder),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, paths: string[], local: string[]) =>
        listener(paths, local);
      ipcRenderer.on(CHANNEL.changed, handler);
      return () => ipcRenderer.removeListener(CHANNEL.changed, handler);
    },
  },
  settings: {
    read: () => ipcRenderer.invoke(CHANNEL.settingsRead),
    set: (key, value) => ipcRenderer.invoke(CHANNEL.settingsSet, key, value),
    onChanged: (listener) => listen<void>(CHANNEL.settingsChanged, listener),
  },
  out: {
    kinds: ['html', 'epub', 'docx', 'pdf'],
    copy: (text, html) => ipcRenderer.invoke(CHANNEL.outCopy, text, html),
    saveAs: (name, file) => ipcRenderer.invoke(CHANNEL.outSaveAs, name, file),
  },
  onMenu: (listener) => listen<MenuCommand>(CHANNEL.menu, listener),
  onBack: () => () => undefined, // a desktop window has no system back
  onBeforeClose: (save) => {
    ipcRenderer.on(CHANNEL.beforeClose, () => {
      save().finally(() => ipcRenderer.send(CHANNEL.closeReady));
    });
  },
  paintControls: (paint) => ipcRenderer.invoke(CHANNEL.paintControls, paint),
};

contextBridge.exposeInMainWorld('eien', bridge);
