// @ts-check

/**
 * Centralized menu structure (menu list + menu items) for the editor MenuBar.
 * Extracted from `game.js` to keep UI wiring modular.
 */

/** @param {any} menuBar */
export function registerMenuStructure(menuBar) {
  if (!menuBar) return;

  // Register menus in order
  menuBar.registerMenu('file', 'File', 1);
  menuBar.registerMenu('view', 'View', 2);
  menuBar.registerMenu('scene', 'Scene', 3);
  menuBar.registerMenu('help', 'Help', 4);
  menuBar.registerMenu('debug', 'Debug', 100);

  // Register File menu items
  menuBar.addMenuItems('file', [
    { type: 'item', label: 'Create Project...', action: 'file.createProject' },
    { type: 'item', label: 'Open Project...', action: 'file.openProject' },
    { type: 'item', label: 'Open Folder...', action: 'file.openFolder' },
    { type: 'item', label: 'Editor Settings...', action: 'app.settings' },
    { type: 'separator' },
    { type: 'item', label: 'Save Scene (Ctrl+S)', action: 'file.saveScene' },
    { type: 'item', label: 'Export Game...', action: 'file.exportGame' },
    { type: 'item', label: 'Reload Scene', action: 'file.reloadScene' },
    { type: 'item', label: 'Reload App (Ctrl+R)', action: 'app.reload' },
  ]);

  // Register View menu items
  menuBar.addMenuItems('view', [
    { type: 'item', label: 'Toggle Help Overlay (F1)', action: 'view.toggleHelp' },
    { type: 'separator' },
    { type: 'item', label: 'Mode: 2D', action: 'view.mode2d' },
    { type: 'item', label: 'Mode: 3D', action: 'view.mode3d' },
  ]);

  // Register Scene menu items
  menuBar.addMenuItems('scene', [
    { type: 'item', label: 'Focus Selection (F)', action: 'scene.focusSelection' },
    { type: 'separator' },
    { type: 'item', label: 'Add Node...', action: 'scene.addNode' },
  ]);

  // Register Help menu items
  menuBar.addMenuItems('help', [
    { type: 'item', label: 'Toggle Help Overlay (F1)', action: 'view.toggleHelp' },
    { type: 'separator' },
    { type: 'item', label: 'About', action: 'help.about' },
  ]);

  // Register Debug menu items
  menuBar.addMenuItems('debug', [
    { type: 'item', label: 'Reload Scene', action: 'file.reloadScene' },
    { type: 'item', label: 'Reload App (Ctrl+R)', action: 'app.reload' },
  ]);
}
