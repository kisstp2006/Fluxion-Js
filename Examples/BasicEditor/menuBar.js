/**
 * Modular Menu Bar System
 * Allows dynamic registration of menus and menu items
 * Can be extended from game code
 * 
 * @example
 * // Access the menu bar from the editor
 * const menuBar = game.menuBar;
 * 
 * // Add a custom menu
 * menuBar.registerMenu('custom', 'Custom', 50);
 * 
 * // Add items to your menu
 * menuBar.addMenuItems('custom', [
 *   { type: 'item', label: 'My Action', action: 'custom.myAction' },
 *   { type: 'separator' },
 *   { type: 'item', label: 'Another Action', action: 'custom.another' }
 * ]);
 * 
 * // Register action handlers
 * menuBar.registerAction('custom.myAction', (context) => {
 *   console.log('Custom action executed!', context);
 * });
 * 
 * // Add items to existing menus
 * menuBar.addMenuItem('file', {
 *   type: 'item',
 *   label: 'Export Project',
 *   action: 'file.export'
 * });
 * 
 * menuBar.registerAction('file.export', () => {
 *   console.log('Exporting project...');
 * });
 */

export default class MenuBar {
  constructor() {
    /** @type {Map<string, MenuDefinition>} */
    this.menus = new Map();
    
    /** @type {HTMLElement|null} */
    this.container = null;
    
    /** @type {HTMLElement|null} */
    this.openRoot = null;
    
    /** @type {Map<string, (context: any) => void>} */
    this.actionHandlers = new Map();
    
    this.mounted = false;
  }

  /**
   * Register a menu
   * @param {string} id - Unique menu identifier
   * @param {string} label - Display label
   * @param {number} [order=100] - Sort order (lower = left)
   */
  registerMenu(id, label, order = 100) {
    this.menus.set(id, {
      id,
      label,
      order,
      items: []
    });
    
    if (this.mounted) {
      this.render();
    }
    
    return this;
  }

  /**
   * Check if a menu exists
   * @param {string} menuId - Menu ID to check
   * @returns {boolean}
   */
  hasMenu(menuId) {
    return this.menus.has(menuId);
  }

  /**
   * Get a menu by ID
   * @param {string} menuId - Menu ID
   * @returns {MenuDefinition|undefined}
   */
  getMenu(menuId) {
    return this.menus.get(menuId);
  }

  /**
   * Add an item to a menu
   * @param {string} menuId - Menu to add to
   * @param {MenuItem} item - Menu item definition
   */
  addMenuItem(menuId, item) {
    const menu = this.menus.get(menuId);
    if (!menu) {
      console.warn(`[MenuBar] Menu "${menuId}" not found`);
      return this;
    }
    
    menu.items.push(item);
    
    if (this.mounted) {
      this.render();
    }
    
    return this;
  }

  /**
   * Add multiple items to a menu
   * @param {string} menuId - Menu to add to
   * @param {MenuItem[]} items - Array of menu items
   */
  addMenuItems(menuId, items) {
    for (const item of items) {
      this.addMenuItem(menuId, item);
    }
    return this;
  }

  /**
   * Register an action handler
   * @param {string} action - Action identifier
   * @param {(context: any) => void} handler - Action handler function
   */
  registerAction(action, handler) {
    this.actionHandlers.set(action, handler);
    return this;
  }

  /**
   * Remove a menu
   * @param {string} menuId - Menu to remove
   */
  removeMenu(menuId) {
    this.menus.delete(menuId);
    if (this.mounted) {
      this.render();
    }
    return this;
  }

  /**
   * Clear all items from a menu
   * @param {string} menuId - Menu to clear
   */
  clearMenu(menuId) {
    const menu = this.menus.get(menuId);
    if (menu) {
      menu.items = [];
      if (this.mounted) {
        this.render();
      }
    }
    return this;
  }

  /**
   * Mount the menu bar to a container
   * @param {HTMLElement|string} container - Container element or selector
   * @param {any} [context] - Context passed to action handlers
   */
  mount(container, context = null) {
    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else {
      this.container = container;
    }

    if (!this.container) {
      console.error('[MenuBar] Container not found');
      return this;
    }

    this.context = context;
    this.mounted = true;
    this.render();
    this._setupEventListeners();
    
    return this;
  }

  /**
   * Render the menu bar
   */
  render() {
    if (!this.container) return;

    // Clear container
    this.container.innerHTML = '';

    // Sort menus by order
    const sortedMenus = Array.from(this.menus.values()).sort((a, b) => a.order - b.order);

    // Render each menu
    for (const menu of sortedMenus) {
      const menuRoot = this._createMenuRoot(menu);
      this.container.appendChild(menuRoot);
    }

    // Add spacer
    const spacer = document.createElement('div');
    spacer.className = 'topbarSpacer';
    spacer.setAttribute('aria-hidden', 'true');
    this.container.appendChild(spacer);
  }

  /**
   * Create a menu root element
   * @private
   */
  _createMenuRoot(menu) {
    const root = document.createElement('div');
    root.className = 'menuRoot';
    root.dataset.menuId = menu.id;

    // Create button
    const btn = document.createElement('button');
    btn.className = 'menuBtn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = menu.label;
    btn.dataset.menuId = menu.id;

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'menu';
    dropdown.setAttribute('role', 'menu');

    // Add items
    for (const item of menu.items) {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.className = 'menuSep';
        sep.setAttribute('role', 'separator');
        sep.setAttribute('aria-hidden', 'true');
        dropdown.appendChild(sep);
      } else {
        const menuItem = document.createElement('button');
        menuItem.className = 'menuItem';
        menuItem.type = 'button';
        menuItem.setAttribute('role', 'menuitem');
        menuItem.textContent = item.label;
        
        if (item.action) {
          menuItem.dataset.action = item.action;
        }
        
        if (item.disabled) {
          menuItem.disabled = true;
          menuItem.classList.add('disabled');
        }
        
        dropdown.appendChild(menuItem);
      }
    }

    root.appendChild(btn);
    root.appendChild(dropdown);

    return root;
  }

  /**
   * Setup global event listeners
   * @private
   */
  _setupEventListeners() {
    if (!this.container) return;

    // Click on menu buttons to toggle
    this.container.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const btn = target.closest('.menuBtn');
      
      if (btn && btn.dataset.menuId) {
        e.preventDefault();
        this._toggleMenu(btn.dataset.menuId);
      }
    });

    // Click on menu items to execute actions
    this.container.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const item = target.closest('.menuItem');
      
      if (item && item.dataset.action && !item.disabled) {
        const action = item.dataset.action;
        this._closeAllMenus();
        this._executeAction(action);
      }
    });

    // Close menus on outside click
    document.addEventListener('mousedown', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (!target.closest('.topbar .menuRoot')) {
        this._closeAllMenus();
      }
    });
  }

  /**
   * Toggle a menu
   * @private
   */
  _toggleMenu(menuId) {
    const root = this.container?.querySelector(`[data-menu-id="${menuId}"]`);
    if (!root) return;

    if (this.openRoot === root) {
      this._closeAllMenus();
    } else {
      this._closeAllMenus();
      this._openMenu(root);
    }
  }

  /**
   * Open a menu
   * @private
   */
  _openMenu(root) {
    if (!root) return;
    
    root.classList.add('open');
    const btn = root.querySelector('.menuBtn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    
    this.openRoot = root;
  }

  /**
   * Close all menus
   * @private
   */
  _closeAllMenus() {
    if (!this.container) return;
    
    const roots = this.container.querySelectorAll('.menuRoot');
    for (const root of roots) {
      root.classList.remove('open');
      const btn = root.querySelector('.menuBtn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    
    this.openRoot = null;
  }

  /**
   * Execute an action
   * @private
   */
  _executeAction(action) {
    const handler = this.actionHandlers.get(action);
    
    if (handler) {
      try {
        handler(this.context);
      } catch (err) {
        console.error(`[MenuBar] Error executing action "${action}":`, err);
      }
    } else {
      console.warn(`[MenuBar] No handler registered for action "${action}"`);
    }
  }

  /**
   * Close all open menus (public API for Escape key, etc.)
   */
  closeMenus() {
    this._closeAllMenus();
  }
}

/**
 * @typedef {Object} MenuDefinition
 * @property {string} id
 * @property {string} label
 * @property {number} order
 * @property {MenuItem[]} items
 */

/**
 * @typedef {Object} MenuItem
 * @property {'item'|'separator'} [type='item']
 * @property {string} [label]
 * @property {string} [action]
 * @property {boolean} [disabled=false]
 */
