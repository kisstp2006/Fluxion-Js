/**
 * Comprehensive Docking Window System
 * Supports movable, resizable, dockable panels with floating window support.
 */

/** @typedef {Object} WindowState
 * @property {string} id - Unique window identifier
 * @property {string} title - Window title
 * @property {'docked'|'floating'|'tabbed'} state - Current window state
 * @property {number} [x] - X coordinate for floating windows
 * @property {number} [y] - Y coordinate for floating windows
 * @property {number} [width] - Width of the window
 * @property {number} [height] - Height of the window
 * @property {string} [dockedSide] - 'left'|'right'|'top'|'bottom'|'center' for docked windows
 * @property {string[]} [tabGroup] - Array of window IDs in this tab group
 * @property {number} [tabIndex] - Active tab index
 * @property {number} [size] - Size (width/height) for docked panels
 */

export class DockingSystem {
  constructor() {
    this.windows = new Map();
    this.tabGroups = new Map();
    this.layout = {
      left: null,
      right: null,
      top: null,
      bottom: null,
      center: null,
      floating: [],
    };
    this.draggingWindow = null;
    this.resizingPanel = null;
    this.activeTabGroup = null;
    this.snapDistance = 50;
    this.minSize = { width: 200, height: 150 };
    this.storageKey = 'fluxion-editor-layout';
    this.debounceTimers = new Map();
    this.autoSaveDebounceMs = 500;
    this.isPersistenceEnabled = true;
    this.lastSaveTime = 0;
    this.pendingSave = false;
    this._dirtyFloating = new Set();
    this._rafPending = false;
    this._dropZones = [];
    this._activeDropZone = null;
    this._floatingZOrder = 1000;
    // Bound handler refs
    this._bound = {
      dragMove: this._onDragMove.bind(this),
      dragEnd: this._onDragEnd.bind(this),
      resizeMove: this._onResizeMove.bind(this),
      resizeEnd: this._onResizeEnd.bind(this),
      edgeResizeMove: this._onEdgeResizeMove.bind(this),
      edgeResizeEnd: this._onEdgeResizeEnd.bind(this),
    };
    this._initDropZones();
    
    // Auto-save layout before unload
    window.addEventListener('beforeunload', () => this._flushPendingSaves());
    window.addEventListener('pagehide', () => this._flushPendingSaves());
  }

  /**
   * Initialize drop zones for docking visualization
   * @private
   */
  _initDropZones() {
    const zones = ['left', 'right', 'top', 'bottom', 'center'];
    zones.forEach(zone => {
      const el = document.createElement('div');
      el.className = `dock-drop-zone dock-drop-zone-${zone}`;
      el.style.cssText = `
        position: fixed;
        pointer-events: none;
        opacity: 0;
        transition: opacity 150ms ease;
        background: rgba(108, 210, 255, 0.15);
        border: 2px dashed rgba(108, 210, 255, 0.5);
        z-index: 9999;
      `;
      document.body.appendChild(el);
      this._dropZones.push({ zone, element: el });
    });
  }

  /**
   * Show drop zones during drag
   * @private
   */
  _showDropZones() {
    const app = document.querySelector('.app');
    if (!app) return;
    const rect = app.getBoundingClientRect();
    const margin = 60;
    
    this._dropZones.forEach(({ zone, element }) => {
      let style = '';
      switch(zone) {
        case 'left':
          style = `left: ${rect.left}px; top: ${rect.top}px; width: ${margin}%; height: ${rect.height}px;`;
          break;
        case 'right':
          style = `left: ${rect.right - (rect.width * margin / 100)}px; top: ${rect.top}px; width: ${margin}%; height: ${rect.height}px;`;
          break;
        case 'top':
          style = `left: ${rect.left}px; top: ${rect.top}px; width: ${rect.width}px; height: ${margin}%;`;
          break;
        case 'bottom':
          style = `left: ${rect.left}px; top: ${rect.bottom - (rect.height * margin / 100)}px; width: ${rect.width}px; height: ${margin}%;`;
          break;
        case 'center':
          const w = rect.width * 0.4;
          const h = rect.height * 0.4;
          style = `left: ${rect.left + (rect.width - w) / 2}px; top: ${rect.top + (rect.height - h) / 2}px; width: ${w}px; height: ${h}px;`;
          break;
      }
      element.style.cssText += style;
    });
  }

  /**
   * Hide drop zones
   * @private
   */
  _hideDropZones() {
    this._dropZones.forEach(({ element }) => {
      element.style.opacity = '0';
    });
    this._activeDropZone = null;
  }

  /**
   * Update drop zone highlighting based on mouse position
   * @private
   */
  _updateDropZones(x, y) {
    let hoveredZone = null;
    this._dropZones.forEach(({ zone, element }) => {
      const rect = element.getBoundingClientRect();
      const isHovered = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      element.style.opacity = isHovered ? '1' : '0.3';
      if (isHovered) hoveredZone = zone;
    });
    this._activeDropZone = hoveredZone;
  }

  /**
   * Register a window/panel in the docking system
   * @param {string} id - Unique identifier
   * @param {HTMLElement} element - DOM element
   * @param {string} title - Display title
   * @param {'left'|'right'|'top'|'bottom'|'center'} initialDock - Initial docking position
   */
  registerWindow(id, element, title, initialDock = 'center') {
    const windowState = {
      id,
      title,
      element,
      state: 'docked',
      dockedSide: initialDock,
      size: 320,
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      tabGroup: [id],
      tabIndex: 0,
    };

    this.windows.set(id, windowState);
    this.layout[initialDock] = id;

    // Add drag handle
    this._attachDragHandle(id, element);
    // Add resize handle
    this._attachResizeHandle(id, element);

    return windowState;
  }

  /**
   * Dock a window to a specific side
   * @param {string} windowId
   * @param {'left'|'right'|'top'|'bottom'|'center'} side
   * @param {number} [size] - Size in pixels
   */
  dockWindow(windowId, side, size = 320) {
    const window = this.windows.get(windowId);
    if (!window) return;

    // Remove from previous position (floating or docked)
    const floatingIndex = this.layout.floating.indexOf(windowId);
    if (floatingIndex !== -1) {
      this.layout.floating.splice(floatingIndex, 1);
    }
    
    // Remove from old docked position
    Object.keys(this.layout).forEach(key => {
      if (key !== 'floating' && this.layout[key] === windowId) {
        this.layout[key] = null;
      }
    });

    window.state = 'docked';
    window.dockedSide = side;
    window.size = size;

    // Clear floating styles if window was floating
    if (window.element) {
      window.element.style.cssText = '';
      window.element.style.gridArea = side;
    }

    // If there's already a window docked on this side, create tab group
    if (this.layout[side] && this.layout[side] !== windowId) {
      this._createTabGroup([this.layout[side], windowId]);
    } else {
      this.layout[side] = windowId;
    }

    this._updateLayout();
    this._saveLayout(); // Explicit save for critical state change
  }

  /**
   * Float a window (make it independent)
   * @param {string} windowId
   * @param {number} [x] - X position
   * @param {number} [y] - Y position
   * @param {number} [width] - Window width
   * @param {number} [height] - Window height
   */
  floatWindow(windowId, x = 100, y = 100, width = 640, height = 480) {
    const window = this.windows.get(windowId);
    if (!window) return;

    window.state = 'floating';
    window.x = x;
    window.y = y;
    window.width = width;
    window.height = height;

    // Remove from docked layout
    Object.keys(this.layout).forEach(side => {
      if (this.layout[side] === windowId) {
        this.layout[side] = null;
      }
    });

    // Add to floating list
    if (!this.layout.floating.includes(windowId)) {
      this.layout.floating.push(windowId);
    }

    this._applyFloatingStyle(window);
    this._updateLayout();
    this._saveLayout();
  }

  /**
   * Create a tab group for multiple windows
   * @param {string[]} windowIds
   */
  _createTabGroup(windowIds) {
    const groupId = `tabgroup-${Date.now()}`;
    const windows = windowIds.map(id => this.windows.get(id)).filter(w => w);

    if (windows.length === 0) return;

    windows.forEach((w, idx) => {
      w.state = 'tabbed';
      w.tabGroup = windowIds;
      w.tabIndex = idx;
    });

    this.tabGroups.set(groupId, {
      id: groupId,
      windows: windowIds,
      activeIndex: 0,
    });

    // Keep the first window as the container
    const container = windows[0];
    container.tabGroup = windowIds;

    return groupId;
  }

  /**
   * Switch active tab in a group
   * @param {string} windowId
   * @param {number} tabIndex
   */
  switchTab(windowId, tabIndex) {
    const window = this.windows.get(windowId);
    if (!window || !window.tabGroup) return;

    window.tabIndex = tabIndex;

    // Hide all tabs in group, show selected
    window.tabGroup.forEach((id, idx) => {
      const w = this.windows.get(id);
      if (w && w.element) {
        w.element.style.display = idx === tabIndex ? '' : 'none';
      }
    });

    this._saveLayout();
  }

  /**
   * Attach drag handle to window header
   * @private
   */
  _attachDragHandle(windowId, element) {
    let header = element.querySelector('[data-dock-header]') || element.querySelector('.panelHeader') || element.querySelector('.assetHeader');
    
    // If no header exists, create one
    if (!header) {
      header = document.createElement('div');
      header.className = 'dock-header';
      header.setAttribute('data-dock-header', '');
      
      const title = document.createElement('div');
      title.className = 'dock-header-title';
      title.textContent = this.windows.get(windowId)?.title || 'Window';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'dock-header-buttons';
      
      const menuBtn = document.createElement('button');
      menuBtn.textContent = '⋮';
      menuBtn.title = 'Panel Options';
      buttonContainer.appendChild(menuBtn);
      
      header.appendChild(title);
      header.appendChild(buttonContainer);
      element.insertBefore(header, element.firstChild);
    }

    header.style.cursor = 'grab';
    header.addEventListener('mousedown', e => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      this._startDrag(windowId, e);
    });
  }

  /**
   * Start dragging a window
   * @private
   */
  _startDrag(windowId, event) {
    const window = this.windows.get(windowId);
    if (!window) return;

    this.draggingWindow = {
      id: windowId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: window.x || 0,
      currentY: window.y || 0,
    };

    try { window.element?.classList.add('dragging'); } catch {}

    document.addEventListener('mousemove', this._bound.dragMove);
    document.addEventListener('mouseup', this._bound.dragEnd);

    event.preventDefault();
  }

  /**
   * Handle dragging motion
   * @private
   */
  _onDragMove(event) {
    if (!this.draggingWindow) return;

    const window = this.windows.get(this.draggingWindow.id);
    if (!window) return;

    const dx = event.clientX - this.draggingWindow.startX;
    const dy = event.clientY - this.draggingWindow.startY;

    // Show drop zones if not already visible
    if (this._dropZones.length > 0 && this._dropZones[0].element.style.opacity === '0') {
      this._showDropZones();
    }

    // Update drop zone highlighting
    this._updateDropZones(event.clientX, event.clientY);

    if (window.state === 'floating') {
      window.x = this.draggingWindow.currentX + dx;
      window.y = this.draggingWindow.currentY + dy;
      this._scheduleFloatingStyle(window.id);
    } else if (window.state === 'docked') {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        window.state = 'floating';
        window.x = event.clientX - 150;
        window.y = event.clientY - 20;
        this.floatWindow(window.id, window.x, window.y, window.width, window.height);
        this.draggingWindow.currentX = window.x;
        this.draggingWindow.currentY = window.y;
      }
    }
  }

  /**
   * End dragging
   * @private
   */
  _onDragEnd() {
    if (!this.draggingWindow) return;

    const window = this.windows.get(this.draggingWindow.id);
    if (window) {
      // Dock to active zone if hovering over one
      if (this._activeDropZone) {
        this.dockWindow(window.id, this._activeDropZone, window.size || 320);
      } else {
        this._snapToGrid(window);
      }
      this._debouncedSaveLayout();
      try { window.element?.classList.remove('dragging'); } catch {}
    }

    this._hideDropZones();
    document.removeEventListener('mousemove', this._bound.dragMove);
    document.removeEventListener('mouseup', this._bound.dragEnd);

    this.draggingWindow = null;
  }

  /**
   * Snap floating window to grid
   * @private
   */
  _snapToGrid(window) {
    if (window.state !== 'floating') return;

    const gridSize = 10;
    window.x = Math.round(window.x / gridSize) * gridSize;
    window.y = Math.round(window.y / gridSize) * gridSize;

    this._applyFloatingStyle(window);
  }

  /**
   * Attach resize handles to window (corner + edges)
   * @private
   */
  _attachResizeHandle(windowId, element) {
    // Corner resize handle (for floating windows)
    const cornerHandle = document.createElement('div');
    cornerHandle.className = 'dock-resize-handle';
    cornerHandle.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      bottom: 0;
      right: 0;
      cursor: se-resize;
      background: rgba(108,210,255,0.3);
      z-index: 1000;
      border-radius: 0 0 var(--radius) 0;
    `;
    element.appendChild(cornerHandle);
    cornerHandle.addEventListener('mousedown', e => this._startResize(windowId, e, 'corner'));

    // Edge handles for all windows
    const edges = [
      { name: 'right', cursor: 'ew-resize', style: 'position: absolute; right: 0; top: 0; bottom: 0; width: 4px;' },
      { name: 'bottom', cursor: 'ns-resize', style: 'position: absolute; bottom: 0; left: 0; right: 0; height: 4px;' },
      { name: 'left', cursor: 'ew-resize', style: 'position: absolute; left: 0; top: 0; bottom: 0; width: 4px;' },
      { name: 'top', cursor: 'ns-resize', style: 'position: absolute; top: 0; left: 0; right: 0; height: 4px;' }
    ];

    edges.forEach(({ name, cursor, style }) => {
      const handle = document.createElement('div');
      handle.className = `dock-edge-resize dock-edge-${name}`;
      handle.style.cssText = `${style} cursor: ${cursor}; z-index: 999;`;
      element.appendChild(handle);
      handle.addEventListener('mousedown', e => this._startResize(windowId, e, name));
    });

    element.style.position = 'relative';
  }

  /**
   * Start resizing a window
   * @private
   */
  _startResize(windowId, event, edge = 'corner') {
    const window = this.windows.get(windowId);
    if (!window) return;

    this.resizingPanel = {
      id: windowId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: window.width || 640,
      startHeight: window.height || 480,
      startSize: window.size || 320,
    };

    const moveHandler = edge === 'corner' ? this._bound.resizeMove : this._bound.edgeResizeMove;
    const endHandler = edge === 'corner' ? this._bound.resizeEnd : this._bound.edgeResizeEnd;

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', endHandler);

    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handle edge resizing motion for docked panels
   * @private
   */
  _onEdgeResizeMove(event) {
    if (!this.resizingPanel) return;

    const window = this.windows.get(this.resizingPanel.id);
    if (!window) return;

    const dx = event.clientX - this.resizingPanel.startX;
    const dy = event.clientY - this.resizingPanel.startY;
    const { edge } = this.resizingPanel;

    if (window.state === 'docked') {
      // Resize docked panel size
      if (edge === 'right' || edge === 'left') {
        const delta = edge === 'right' ? dx : -dx;
        window.size = Math.max(this.minSize.width, this.resizingPanel.startSize + delta);
      } else if (edge === 'bottom' || edge === 'top') {
        const delta = edge === 'bottom' ? dy : -dy;
        window.size = Math.max(this.minSize.height, this.resizingPanel.startSize + delta);
      }
      this._updateLayout();
    } else if (window.state === 'floating') {
      // Resize floating window
      if (edge === 'right') {
        window.width = Math.max(this.minSize.width, this.resizingPanel.startWidth + dx);
      } else if (edge === 'left') {
        const newWidth = Math.max(this.minSize.width, this.resizingPanel.startWidth - dx);
        window.x += this.resizingPanel.startWidth - newWidth;
        window.width = newWidth;
      }
      if (edge === 'bottom') {
        window.height = Math.max(this.minSize.height, this.resizingPanel.startHeight + dy);
      } else if (edge === 'top') {
        const newHeight = Math.max(this.minSize.height, this.resizingPanel.startHeight - dy);
        window.y += this.resizingPanel.startHeight - newHeight;
        window.height = newHeight;
      }
      this._scheduleFloatingStyle(window.id);
    }
  }

  /**
   * End edge resizing
   * @private
   */
  _onEdgeResizeEnd() {
    if (!this.resizingPanel) return;

    const window = this.windows.get(this.resizingPanel.id);
    if (window) {
      this._debouncedSaveLayout();
    }

    document.removeEventListener('mousemove', this._bound.edgeResizeMove);
    document.removeEventListener('mouseup', this._bound.edgeResizeEnd);

    this.resizingPanel = null;
  }

  /**
   * Handle resizing motion
   * @private
   */
  _onResizeMove(event) {
    if (!this.resizingPanel) return;

    const window = this.windows.get(this.resizingPanel.id);
    if (!window) return;

    const dx = event.clientX - this.resizingPanel.startX;
    const dy = event.clientY - this.resizingPanel.startY;

    window.width = Math.max(this.minSize.width, this.resizingPanel.startWidth + dx);
    window.height = Math.max(this.minSize.height, this.resizingPanel.startHeight + dy);

    this._scheduleFloatingStyle(window.id);
  }

  /**
   * End resizing
   * @private
   */
  _onResizeEnd() {
    if (!this.resizingPanel) return;

    const window = this.windows.get(this.resizingPanel.id);
    if (window) {
      this._debouncedSaveLayout(); // Debounce to avoid excessive writes
    }

    document.removeEventListener('mousemove', this._bound.resizeMove);
    document.removeEventListener('mouseup', this._bound.resizeEnd);

    this.resizingPanel = null;
  }

  /**
   * Apply floating style to window
   * @private
   */
  _applyFloatingStyle(window) {
    if (!window.element) return;
    const el = window.element;
    // Initialize static floating styles once
    el.classList.add('dock-panel', 'floating');
    el.style.position = 'fixed';
    el.style.zIndex = String(window.zIndex || this._floatingZOrder++);
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.overflow = 'hidden';
    // Apply size immediately
    el.style.width = `${Math.max(this.minSize.width, window.width || 0) | 0}px`;
    el.style.height = `${Math.max(this.minSize.height, window.height || 0) | 0}px`;
    // Use GPU-accelerated transform for position
    el.style.transform = `translate3d(${(window.x || 0) | 0}px, ${(window.y || 0) | 0}px, 0)`;

    // Bring to front on click
    if (!el.dataset.zorderListenerAdded) {
      el.addEventListener('mousedown', () => this._bringToFront(window.id));
      el.dataset.zorderListenerAdded = 'true';
    }
  }

  /**
   * Bring window to front
   * @private
   */
  _bringToFront(windowId) {
    const window = this.windows.get(windowId);
    if (!window || !window.element || window.state !== 'floating') return;

    window.zIndex = this._floatingZOrder++;
    window.element.style.zIndex = String(window.zIndex);
  }

  /**
   * Queue floating style updates on next animation frame
   * @private
   * @param {string} windowId
   */
  _scheduleFloatingStyle(windowId) {
    if (!windowId) return;
    this._dirtyFloating.add(windowId);
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      try {
        for (const id of Array.from(this._dirtyFloating)) {
          const w = this.windows.get(id);
          if (!w || !w.element) continue;
          const el = w.element;
          // Update transform and size only, avoid resetting entire style string
          el.style.transform = `translate3d(${(w.x || 0) | 0}px, ${(w.y || 0) | 0}px, 0)`;
          el.style.width = `${Math.max(this.minSize.width, w.width || 0) | 0}px`;
          el.style.height = `${Math.max(this.minSize.height, w.height || 0) | 0}px`;
        }
      } finally {
        this._dirtyFloating.clear();
        this._rafPending = false;
      }
    });
  }

  /**
   * Update layout without full rebuild
   * @private
   */
  _updateLayout() {
    // Use CSS grid or flex updates instead of DOM manipulation
    requestAnimationFrame(() => {
      const app = document.querySelector('.app');
      if (!app) return;

      // Update grid based on layout state
      const cols = [];
      let colTemplate = '';

      if (this.layout.left) {
        const leftSize = this.windows.get(this.layout.left)?.size || 320;
        cols.push(`${leftSize}px`);
        colTemplate += `${leftSize}px `;
      }

      cols.push('1fr');
      colTemplate += '1fr ';

      if (this.layout.right) {
        const rightSize = this.windows.get(this.layout.right)?.size || 340;
        cols.push(`${rightSize}px`);
        colTemplate += `${rightSize}px`;
      }

      app.style.gridTemplateColumns = colTemplate.trim();
    });
  }

  /**
   * Debounced layout save - prevents excessive localStorage writes during drag/resize
   * @private
   */
  _debouncedSaveLayout() {
    if (!this.isPersistenceEnabled) return;

    this.pendingSave = true;

    // Clear existing debounce timer
    if (this.debounceTimers.has('save')) {
      clearTimeout(this.debounceTimers.get('save'));
    }

    // Set new debounce timer
    const timerId = setTimeout(() => {
      this._saveLayout();
      this.debounceTimers.delete('save');
      this.pendingSave = false;
    }, this.autoSaveDebounceMs);

    this.debounceTimers.set('save', timerId);
  }

  /**
   * Immediately flush any pending layout saves (called before unload)
   * @private
   */
  _flushPendingSaves() {
    if (this.debounceTimers.has('save')) {
      clearTimeout(this.debounceTimers.get('save'));
      this.debounceTimers.delete('save');
      this._saveLayout();
    }
  }

  /**
   * Save layout to localStorage
   * @private
   */
  _saveLayout() {
    if (!this.isPersistenceEnabled) return;

    const layoutData = {
      version: 1, // For future compatibility
      timestamp: Date.now(),
      layout: this.layout,
      windows: Array.from(this.windows.entries()).map(([id, w]) => ({
        id,
        state: w.state,
        dockedSide: w.dockedSide,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        size: w.size,
        tabGroup: w.tabGroup,
        tabIndex: w.tabIndex,
      })),
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(layoutData));
      this.lastSaveTime = Date.now();
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[DockingSystem] Layout persisted to storage');
      }
    } catch (e) {
      console.warn('[DockingSystem] Failed to save layout:', e);
    }
  }

  /**
   * Load layout from localStorage with validation
   */
  loadLayout() {
    try {
      const rawData = localStorage.getItem(this.storageKey);
      if (!rawData) {
        if (typeof console !== 'undefined' && console.debug) {
          console.debug('[DockingSystem] No saved layout found');
        }
        return false;
      }

      const data = JSON.parse(rawData);
      if (!data || !Array.isArray(data.windows)) {
        console.warn('[DockingSystem] Invalid layout data structure');
        return false;
      }

      // Validate and restore window states
      let restoredCount = 0;
      data.windows.forEach(windowData => {
        if (!windowData || !windowData.id) return;

        const window = this.windows.get(windowData.id);
        if (!window) {
          if (typeof console !== 'undefined' && console.debug) {
            console.debug(`[DockingSystem] Skipping unknown window: ${windowData.id}`);
          }
          return;
        }

        // Validate state
        const validStates = ['docked', 'floating', 'tabbed'];
        if (!validStates.includes(windowData.state)) {
          console.warn(`[DockingSystem] Invalid state for ${windowData.id}: ${windowData.state}`);
          return;
        }

        // Restore window data
        Object.assign(window, {
          state: windowData.state,
          dockedSide: windowData.dockedSide,
          x: Number.isFinite(windowData.x) ? windowData.x : window.x,
          y: Number.isFinite(windowData.y) ? windowData.y : window.y,
          width: Number.isFinite(windowData.width) ? Math.max(this.minSize.width, windowData.width) : window.width,
          height: Number.isFinite(windowData.height) ? Math.max(this.minSize.height, windowData.height) : window.height,
          size: Number.isFinite(windowData.size) ? windowData.size : window.size,
          tabGroup: Array.isArray(windowData.tabGroup) ? windowData.tabGroup : window.tabGroup,
          tabIndex: Number.isFinite(windowData.tabIndex) ? windowData.tabIndex : 0,
        });

        if (window.state === 'floating') {
          this._applyFloatingStyle(window);
        } else if (window.state === 'docked' && window.dockedSide) {
          this.layout[window.dockedSide] = window.id;
        }

        restoredCount++;
      });

      this._updateLayout();

      if (typeof console !== 'undefined' && console.debug) {
        console.debug(`[DockingSystem] Layout restored: ${restoredCount} windows`);
      }
      return restoredCount > 0;
    } catch (e) {
      console.warn('[DockingSystem] Failed to load layout:', e);
      return false;
    }
  }

  /**
   * Clear all layout customizations and reload
   */
  resetLayout() {
    try {
      localStorage.removeItem(this.storageKey);
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[DockingSystem] Layout reset and cleared from storage');
      }
    } catch (e) {
      console.warn('[DockingSystem] Failed to clear layout from storage:', e);
    }
    location.reload();
  }

  /**
   * Enable or disable layout persistence
   * @param {boolean} enabled
   */
  setPersistenceEnabled(enabled) {
    this.isPersistenceEnabled = !!enabled;
    if (typeof console !== 'undefined' && console.debug) {
      console.debug(`[DockingSystem] Persistence ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get persistence status
   * @returns {boolean}
   */
  isPersistenceActive() {
    return this.isPersistenceEnabled;
  }

  /**
   * Get saved layout stats for debugging
   * @returns {Object}
   */
  getPersistenceStats() {
    try {
      const data = JSON.parse(localStorage.getItem(this.storageKey));
      if (!data) return { exists: false, size: 0 };

      const sizeInBytes = new Blob([JSON.stringify(data)]).size;
      return {
        exists: true,
        version: data.version || 0,
        timestamp: data.timestamp || 0,
        windowCount: Array.isArray(data.windows) ? data.windows.length : 0,
        sizeInBytes,
        lastSaveTime: this.lastSaveTime,
      };
    } catch (e) {
      return { exists: false, error: String(e) };
    }
  }

  /**
   * Get current layout state (for debugging)
   */
  getLayoutState() {
    return {
      layout: this.layout,
      windows: Array.from(this.windows.entries()).map(([id, w]) => ({
        id,
        state: w.state,
        dockedSide: w.dockedSide,
        size: w.size,
        position: { x: w.x, y: w.y },
        dimensions: { width: w.width, height: w.height },
      })),
      stats: this.getPersistenceStats(),
    };
  }
}

// Export singleton instance
export const dockingSystem = new DockingSystem();
