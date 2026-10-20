// The window's entry point.

import { startApp } from './app';

document.documentElement.dataset.platform = window.eien.platform;

const root = document.getElementById('app');
if (root) void startApp(root, window.eien);
