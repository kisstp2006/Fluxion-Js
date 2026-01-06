// @ts-check

import { Engine, SceneLoader } from "../Fluxion/index.js";

/** @typedef {import("../Fluxion/Core/Renderer.js").default} Renderer */
/** @typedef {import("../Fluxion/Core/Scene.js").default} Scene */

/**
 * Fluxion Editor
 * Modern dark-themed game engine editor with docking capabilities
 */

class HierarchyPanel {
    constructor() {
        this.contentEl = document.getElementById('hierarchy-content');
        this.selectedItem = null;
        /** @type {Scene | null} */
        this.currentScene = null;
    }

    /**
     * Update hierarchy tree with scene objects
     * @param {Scene | null} scene - The current scene
     */
    updateHierarchy(scene) {
        if (!scene || !this.contentEl) {
            this.showNoScene();
            return;
        }

        this.currentScene = scene;
        this.contentEl.innerHTML = '';

        const tree = document.createElement('ul');
        tree.className = 'hierarchy-tree';

        // Add scene root
        const sceneItem = this.createHierarchyItem('Scene', '🎬', scene);
        tree.appendChild(sceneItem);

        // Add scene children
        if (scene.children && scene.children.length > 0) {
            scene.children.forEach((child) => {
                const childItem = this.createHierarchyItem(
                    child.name || 'Unnamed',
                    this.getIconForType(child.type || 'Unknown'),
                    child
                );
                tree.appendChild(childItem);
            });
        }

        this.contentEl.appendChild(tree);
    }

    /**
     * Create a hierarchy item element
     * @param {string} name - Object name
     * @param {string} icon - Icon character
     * @param {any} object - The object reference
     * @returns {HTMLElement}
     */
    createHierarchyItem(name, icon, object) {
        const item = document.createElement('li');
        item.className = 'hierarchy-item';

        const iconEl = document.createElement('span');
        iconEl.className = 'hierarchy-item-icon';
        iconEl.textContent = icon;

        const nameEl = document.createElement('span');
        nameEl.textContent = name;

        item.appendChild(iconEl);
        item.appendChild(nameEl);

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectItem(item, object);
        });

        return item;
    }

    /**
     * Select an item in the hierarchy
     * @param {HTMLElement} item - The item element
     * @param {any} object - The object reference
     */
    selectItem(item, object) {
        // Deselect previous item
        if (this.selectedItem) {
            this.selectedItem.classList.remove('selected');
        }

        // Select new item
        item.classList.add('selected');
        this.selectedItem = item;

        // Notify inspector
        if (window.editorInspector) {
            window.editorInspector.updateInspector(object);
        }
    }

    /**
     * Get icon for object type
     * @param {string} type - Object type
     * @returns {string}
     */
    getIconForType(type) {
        const icons = {
            'Sprite': '🖼️',
            'Text': '📝',
            'ClickableArea': '👆',
            'AnimatedSprite': '🎞️',
            'Camera': '📷',
            'Scene': '🎬',
            'Unknown': '❓'
        };
        return icons[type] || icons['Unknown'];
    }

    showNoScene() {
        if (this.contentEl) {
            this.contentEl.innerHTML = '<p class="no-selection">No scene loaded</p>';
        }
    }
}

class EditorState {
    constructor() {
        /** @type {Scene | null} */
        this.currentScene = null;
        this.selectedObject = null;
        this.isPanning = false;
        this.lastMousePos = { x: 0, y: 0 };
    }
}

const editorState = new EditorState();

// Title bar window controls
function setupTitleBar() {
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (typeof window.electronAPI !== 'undefined') {
        minimizeBtn?.addEventListener('click', () => {
            window.electronAPI.minimize();
        });

        maximizeBtn?.addEventListener('click', () => {
            window.electronAPI.maximize();
        });

        closeBtn?.addEventListener('click', () => {
            window.electronAPI.close();
        });
    }
}

// Inspector panel functionality
class InspectorPanel {
    constructor() {
        this.contentEl = document.getElementById('inspector-content');
    }

    /**
     * Update inspector content for selected object
     * @param {any} object - The selected object
     */
    updateInspector(object) {
        if (!object || !this.contentEl) {
            this.showNoSelection();
            return;
        }

        this.contentEl.innerHTML = '';
        
        // Name field
        this.addField('name', 'Name', object.name || 'Unnamed', 'text');
        
        // Position field (if transform exists)
        if (object.transform) {
            this.addVectorField('position', 'Position', 
                object.transform.x || 0,
                object.transform.y || 0,
                object.transform.z || 0
            );
        }

        // Add more fields based on object type
        if (object.type === 'Sprite') {
            this.addColorField('color', 'Tint Color', '#ffffff');
        }
    }

    showNoSelection() {
        if (this.contentEl) {
            this.contentEl.innerHTML = '<p class="no-selection">No object selected</p>';
        }
    }

    /**
     * Add a text/number field to inspector
     * @param {string} id - Field ID
     * @param {string} label - Field label
     * @param {string | number} value - Field value
     * @param {string} type - Input type
     */
    addField(id, label, value, type = 'text') {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'field-group';

        const fieldLabel = document.createElement('label');
        fieldLabel.className = 'field-label';
        fieldLabel.textContent = label;
        fieldLabel.htmlFor = id;

        const fieldInput = document.createElement('input');
        fieldInput.className = 'field-input';
        fieldInput.type = type;
        fieldInput.id = id;
        fieldInput.value = String(value);

        fieldGroup.appendChild(fieldLabel);
        fieldGroup.appendChild(fieldInput);
        this.contentEl?.appendChild(fieldGroup);
    }

    /**
     * Add a vector field (X, Y, Z) to inspector
     * @param {string} id - Field ID
     * @param {string} label - Field label
     * @param {number} x - X value
     * @param {number} y - Y value
     * @param {number} z - Z value
     */
    addVectorField(id, label, x, y, z) {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'field-group';

        const fieldLabel = document.createElement('label');
        fieldLabel.className = 'field-label';
        fieldLabel.textContent = label;

        const vectorField = document.createElement('div');
        vectorField.className = 'vector-field';

        const axes = [
            { axis: 'X', value: x },
            { axis: 'Y', value: y },
            { axis: 'Z', value: z }
        ];

        axes.forEach(({ axis, value }) => {
            const vectorInput = document.createElement('div');
            vectorInput.className = 'vector-input';
            vectorInput.setAttribute('data-axis', axis);

            const input = document.createElement('input');
            input.className = 'field-input';
            input.type = 'number';
            input.step = '0.1';
            input.value = String(value);

            vectorInput.appendChild(input);
            vectorField.appendChild(vectorInput);
        });

        fieldGroup.appendChild(fieldLabel);
        fieldGroup.appendChild(vectorField);
        this.contentEl?.appendChild(fieldGroup);
    }

    /**
     * Add a color field to inspector
     * @param {string} id - Field ID
     * @param {string} label - Field label
     * @param {string} value - Color value
     */
    addColorField(id, label, value) {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'field-group';

        const fieldLabel = document.createElement('label');
        fieldLabel.className = 'field-label';
        fieldLabel.textContent = label;

        const colorField = document.createElement('div');
        colorField.className = 'color-field';

        const colorPreview = document.createElement('div');
        colorPreview.className = 'color-preview';
        colorPreview.style.backgroundColor = value;

        const colorInput = document.createElement('input');
        colorInput.className = 'field-input';
        colorInput.type = 'color';
        colorInput.value = value;

        colorInput.addEventListener('input', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            colorPreview.style.backgroundColor = target.value;
        });

        colorField.appendChild(colorPreview);
        colorField.appendChild(colorInput);

        fieldGroup.appendChild(fieldLabel);
        fieldGroup.appendChild(colorField);
        this.contentEl?.appendChild(fieldGroup);
    }
}

/**
 * Game object for the editor
 * @type {{
 *   currentScene: Scene | null,
 *   inspector: InspectorPanel,
 *   hierarchy: HierarchyPanel,
 *   init(renderer: Renderer): Promise<void>,
 *   update(dt: number): void,
 *   draw(renderer: Renderer): void,
 * }}
 */
const game = {
    currentScene: null,
    inspector: new InspectorPanel(),
    hierarchy: new HierarchyPanel(),

    /** @param {Renderer} renderer */
    async init(renderer) {
        console.log('Fluxion Editor initialized');
        
        // Setup title bar controls
        setupTitleBar();

        // Make inspector available globally for hierarchy panel
        window.editorInspector = this.inspector;

        // Load a default scene if available
        try {
            const scene = await SceneLoader.load("../Examples/TextTest/scene.xml", renderer);
            this.currentScene = scene;
            console.log("Scene loaded:", scene);

            // Apply scene camera resolution if defined
            const cam = scene.camera;
            if (cam && cam.width > 0 && cam.height > 0) {
                console.log(`Setting resolution from scene: ${cam.width}x${cam.height}`);
                renderer.targetWidth = cam.width;
                renderer.targetHeight = cam.height;
                renderer.targetAspectRatio = cam.width / cam.height;
                renderer.resizeCanvas();
            }

            // Update hierarchy with loaded scene
            this.hierarchy.updateHierarchy(scene);
        } catch (error) {
            console.warn('No default scene loaded:', error);
            this.hierarchy.showNoScene();
        }

        // Show initial inspector state
        this.inspector.showNoSelection();
    },

    /** @param {number} dt */
    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
    },

    /** @param {Renderer} renderer */
    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

// Initialize the engine with editor game object
new Engine("gameCanvas", game, 1280, 720);
