// @ts-check

/**
 * Centralized menu action registration for the editor MenuBar.
 * Extracted from `game.js` to keep menu wiring separate from game logic.
 */

/** @typedef {import("../../engine/Fluxion/Core/Renderer.js").default} Renderer */

/**
 * @param {any} host
 * @param {any} ui
 * @param {Renderer} renderer
 */
export function registerMenuActions(host, ui, renderer) {
  if (!host || !host.menuBar) return;

  host.menuBar.registerAction('file.createProject', () => {
    host._createAndOpenNewProject().catch(console.error);
  });

  host.menuBar.registerAction('file.openProject', () => {
    host._openProjectFolderStrict().catch(console.error);
  });

  host.menuBar.registerAction('file.openFolder', () => {
    host._openWorkspaceFolder().catch(console.error);
  });

  host.menuBar.registerAction('file.reloadScene', () => {
    host.loadSelectedScene(renderer).catch(console.error);
  });

  host.menuBar.registerAction('file.saveScene', () => {
    host.saveCurrentScene().catch(console.error);
  });

  host.menuBar.registerAction('file.exportGame', () => {
    alert('Export Game is not implemented yet.');
  });

  host.menuBar.registerAction('app.reload', () => {
    window.location.reload();
  });

  host.menuBar.registerAction('app.settings', () => {
    host._openEditorSettings();
  });

  host.menuBar.registerAction('view.toggleHelp', () => {
    host._helpVisible = !host._helpVisible;
    if (ui && ui.overlay) ui.overlay.style.display = host._helpVisible ? 'block' : 'none';
  });

  host.menuBar.registerAction('scene.focusSelection', () => {
    host.focusSelection();
  });

  host.menuBar.registerAction('scene.addNode', () => {
    host._openAddNode();
  });

  host.menuBar.registerAction('view.mode2d', () => {
    host.setMode('2d');
  });

  host.menuBar.registerAction('view.mode3d', () => {
    host.setMode('3d');
  });

  host.menuBar.registerAction('help.about', () => {
    host._openAbout();
  });
}
