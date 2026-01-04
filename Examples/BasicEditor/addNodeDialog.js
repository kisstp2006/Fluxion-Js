// @ts-check

/**
 * Add Node dialog logic extracted from `game.js`.
 *
 * This module owns:
 * - modal open/close
 * - rendering + filtering + grouping
 * - UI event wiring (search, selection, group toggle, double click)
 *
 * Node instantiation stays in `game.js` (host provides `_add2DNodeByType`).
 */

/**
 * @typedef {{
 *  addNodeModal: HTMLDivElement|null,
 *  addNodeCloseBtn: HTMLButtonElement|null,
 *  addNodeSearchInput: HTMLInputElement|null,
 *  addNodeFavorites: HTMLDivElement|null,
 *  addNodeRecent: HTMLDivElement|null,
 *  addNodeMatches: HTMLDivElement|null,
 *  addNodeDescription: HTMLDivElement|null,
 *  addNodeOkBtn: HTMLButtonElement|null,
 * }} AddNodeUI
 */

/**
 * @typedef {{
 *  _addNodeOpen: boolean,
 *  _addNodeSearch: string,
 *  _addNodeSelectedId: string|null,
 *  _addNodeExpanded: { [k: string]: boolean },
 *  _addNodeFavorites: string[],
 *  _addNodeRecent: string[],
 *  _closeTopbarMenus: () => void,
 *  _getProjectRenderEnableFlags: () => { allow2D: boolean, allow3D: boolean },
 *  _add2DNodeByType: (type: string) => void,
 * }} AddNodeHost
 */

/** @typedef {{id:string,label:string,group:string,description:string}} AddNodeEntry */

/** @returns {AddNodeEntry[]} */
export function getAddNodeRegistry() {
  return [
    {
      id: 'Sprite',
      label: 'Sprite',
      group: 'Node2D',
      description: 'Represents a 2D sprite object that can be rendered on the screen.',
    },
    {
      id: 'AnimatedSprite',
      label: 'AnimatedSprite',
      group: 'Node2D',
      description: 'A Sprite that supports animations (sprite sheets or multi-image animations).',
    },
    {
      id: 'ClickableArea',
      label: 'ClickableArea',
      group: 'Node2D',
      description: 'A clickable area that detects mouse interactions (typically attached to a parent Sprite).',
    },
    {
      id: 'Text',
      label: 'Text',
      group: 'Control',
      description: 'Text object rendered to a texture (editable text content, font size, and color).',
    },
  ];
}

export function openAddNode(/** @type {AddNodeHost} */ host, /** @type {AddNodeUI} */ ui) {
  if (!ui.addNodeModal) return;

  // Add Node currently creates only 2D nodes; disable when 2D is disabled for the project.
  const { allow2D } = host._getProjectRenderEnableFlags();
  if (!allow2D) return;

  host._addNodeOpen = true;
  ui.addNodeModal.hidden = false;
  host._closeTopbarMenus();

  // Reset selection and render the dialog.
  host._addNodeSelectedId = host._addNodeSelectedId || 'Sprite';
  renderAddNodeDialog(host, ui);
  ui.addNodeSearchInput?.focus();
}

export function closeAddNode(/** @type {AddNodeHost} */ host, /** @type {AddNodeUI} */ ui) {
  if (!ui.addNodeModal) return;
  host._addNodeOpen = false;
  ui.addNodeModal.hidden = true;
}

export function renderAddNodeDialog(/** @type {AddNodeHost} */ host, /** @type {AddNodeUI} */ ui) {
  if (!host._addNodeOpen) return;
  const reg = getAddNodeRegistry();

  const q = String(host._addNodeSearch || '').trim().toLowerCase();
  const filtered = q ? reg.filter(n => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) : reg;

  // Sidebar lists (visual only)
  /** @param {HTMLDivElement|null} el @param {string[]} ids */
  const renderSideList = (el, ids) => {
    if (!el) return;
    el.innerHTML = '';
    for (const id of ids) {
      const n = reg.find(x => x.id === id);
      if (!n) continue;
      const row = document.createElement('div');
      row.className = 'nodeRow' + (id === host._addNodeSelectedId ? ' selected' : '');
      row.setAttribute('data-node-id', id);
      const icon = document.createElement('div');
      icon.className = 'nodeRowIcon';
      const label = document.createElement('div');
      label.className = 'nodeRowLabel';
      label.textContent = n.label;
      row.appendChild(icon);
      row.appendChild(label);
      row.addEventListener('click', () => {
        host._addNodeSelectedId = id;
        renderAddNodeDialog(host, ui);
      });
      row.addEventListener('dblclick', () => host._add2DNodeByType(id));
      el.appendChild(row);
    }
  };

  renderSideList(ui.addNodeFavorites, host._addNodeFavorites);
  renderSideList(ui.addNodeRecent, host._addNodeRecent);

  // Matches list: Godot-like grouping
  if (ui.addNodeMatches) {
    ui.addNodeMatches.innerHTML = '';

    /** @param {string} name @param {number} depth @param {boolean} expanded */
    const mkGroup = (name, depth, expanded) => {
      const row = document.createElement('div');
      row.className = 'nodeRow' + (` depth${depth}`);
      row.style.paddingLeft = `${10 + depth * 14}px`;
      row.setAttribute('data-node-id', `group:${name}`);
      const caret = document.createElement('div');
      caret.className = 'nodeRowCaret';
      caret.textContent = expanded ? '▾' : '▸';
      const icon = document.createElement('div');
      icon.className = 'nodeRowIcon';
      const label = document.createElement('div');
      label.className = 'nodeRowLabel';
      label.textContent = name;
      row.appendChild(caret);
      row.appendChild(icon);
      row.appendChild(label);
      return row;
    };

    /** @param {AddNodeEntry} node @param {number} depth */
    const mkNode = (node, depth) => {
      const row = document.createElement('div');
      row.className = 'nodeRow' + (node.id === host._addNodeSelectedId ? ' selected' : '');
      row.style.paddingLeft = `${10 + depth * 14}px`;
      row.setAttribute('data-node-id', node.id);
      const caret = document.createElement('div');
      caret.className = 'nodeRowCaret';
      caret.textContent = '';
      const icon = document.createElement('div');
      icon.className = 'nodeRowIcon';
      const label = document.createElement('div');
      label.className = 'nodeRowLabel';
      label.textContent = node.label;
      row.appendChild(caret);
      row.appendChild(icon);
      row.appendChild(label);
      return row;
    };

    const expCanvas = !!host._addNodeExpanded.CanvasItem;
    const expNode2D = !!host._addNodeExpanded.Node2D;
    const expControl = !!host._addNodeExpanded.Control;

    ui.addNodeMatches.appendChild(mkGroup('CanvasItem', 0, expCanvas));

    if (expCanvas) {
      ui.addNodeMatches.appendChild(mkGroup('Node2D', 1, expNode2D));
      if (expNode2D) {
        for (const n of filtered.filter(x => x.group === 'Node2D')) {
          ui.addNodeMatches.appendChild(mkNode(n, 2));
        }
      }

      ui.addNodeMatches.appendChild(mkGroup('Control', 1, expControl));
      if (expControl) {
        for (const n of filtered.filter(x => x.group === 'Control')) {
          ui.addNodeMatches.appendChild(mkNode(n, 2));
        }
      }
    }
  }

  // Description
  const sel = host._addNodeSelectedId ? reg.find(n => n.id === host._addNodeSelectedId) : null;
  if (ui.addNodeDescription) {
    ui.addNodeDescription.textContent = sel ? sel.description : '';
  }

  if (ui.addNodeOkBtn) {
    ui.addNodeOkBtn.hidden = !sel;
    ui.addNodeOkBtn.disabled = !sel;
  }
}

export function wireAddNodeUI(/** @type {AddNodeHost} */ host, /** @type {AddNodeUI} */ ui) {
  // Ensure Add Node starts closed.
  if (ui.addNodeModal) ui.addNodeModal.hidden = true;

  // Close behavior
  ui.addNodeCloseBtn?.addEventListener('click', () => closeAddNode(host, ui));
  ui.addNodeModal?.addEventListener('mousedown', (e) => {
    if (e.target === ui.addNodeModal) closeAddNode(host, ui);
  });

  ui.addNodeOkBtn?.addEventListener('click', () => {
    if (host._addNodeSelectedId) host._add2DNodeByType(host._addNodeSelectedId);
  });

  // Search
  ui.addNodeSearchInput?.addEventListener('input', () => {
    host._addNodeSearch = String(ui.addNodeSearchInput?.value || '');
    renderAddNodeDialog(host, ui);
  });
  ui.addNodeSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (host._addNodeSelectedId) host._add2DNodeByType(host._addNodeSelectedId);
    }
  });

  // Matches selection + group toggle (event delegation; robust to text-node targets)
  ui.addNodeMatches?.addEventListener('click', (e) => {
    const rawT = /** @type {any} */ (e.target);
    const t = /** @type {HTMLElement|null} */ (
      rawT instanceof HTMLElement
        ? rawT
        : (rawT && rawT.parentElement instanceof HTMLElement ? rawT.parentElement : null)
    );
    const row = t?.closest('[data-node-id]');
    const id = row?.getAttribute('data-node-id');
    if (!id) return;

    // Group toggle
    if (id.startsWith('group:')) {
      const key = id.slice('group:'.length);
      host._addNodeExpanded[key] = !host._addNodeExpanded[key];
      renderAddNodeDialog(host, ui);
      return;
    }

    host._addNodeSelectedId = id;
    renderAddNodeDialog(host, ui);
  });

  ui.addNodeMatches?.addEventListener('dblclick', (e) => {
    const rawT = /** @type {any} */ (e.target);
    const t = /** @type {HTMLElement|null} */ (
      rawT instanceof HTMLElement
        ? rawT
        : (rawT && rawT.parentElement instanceof HTMLElement ? rawT.parentElement : null)
    );
    const row = t?.closest('[data-node-id]');
    const id = row?.getAttribute('data-node-id');
    if (!id || id.startsWith('group:')) return;
    host._add2DNodeByType(id);
  });
}
