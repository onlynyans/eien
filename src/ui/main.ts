// The window's entry point. Phase 2 shows only the app's name; the panes
// arrive with the vault in phase 3.

document.documentElement.dataset.platform = window.eien.platform;

const root = document.getElementById('app');
if (root) {
  const name = document.createElement('h1');
  name.className = 'app-name';
  name.textContent = 'Eien';
  root.append(name);
}
