import { contextBridge } from 'electron';
import type { Bridge } from '../../platform/bridge';

// The window's only door to the system. It runs sandboxed: nothing here may
// import Node modules.
const bridge: Bridge = {
  platform: process.platform,
};

contextBridge.exposeInMainWorld('eien', bridge);
