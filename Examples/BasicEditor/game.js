// @ts-check

import { Engine, SceneLoader, Vector3, Mat4, Input, Camera, Camera3D, AnimatedSprite, Sprite, Text, ClickableArea, MeshNode, DirectionalLight, PointLight, SpotLight } from "../../Fluxion/index.js";
import Scene from "../../Fluxion/Core/Scene.js";
import { createAssetBrowser } from "./assetBrowser.js";
import { createProjectDialog } from "./createProjectDialog.js";
import {
  wireProjectSelectionUI,
  openProjectSelect,
  closeProjectSelect,
  createAndOpenNewProject,
  openProjectFolderStrict,
  openLegacyProjectFolder,
  loadRecentProjectsFromStorage,
  saveRecentProjectsToStorage,
  rememberRecentProject,
  removeRecentProject,
  renderProjectSelectRecents,
  openRecentProject,
  openWorkspaceAtPath,
  openProjectAtPathStrict,
} from "./projectSelection.js";
import {
  wireEditorSettingsUI,
  loadEditorSettingsFromStorage,
  saveEditorSettingsToStorage,
  applyEditorSettingsFilter,
  setEditorSettingsCategory,
  rebuildEditorSettingsUI,
  openEditorSettings,
  closeEditorSettings,
} from "./editorSettings.js";
import { wireAboutUI, openAbout, closeAbout } from "./aboutDialog.js";
import { wireAddNodeUI, openAddNode, closeAddNode, renderAddNodeDialog } from "./addNodeDialog.js";
import {
  isEditingInspector,
  blockInspectorAutoRefresh,
  setupInspectorInteractionGuards,
  rebuildInspector as rebuildInspectorPanel,
  rebuildInspectorXmlStub as rebuildInspectorXmlStubPanel,
} from "./inspectorPanel.js";

import * as InspectorFields from "./inspectorFields.js";

/** @typedef {import("../../Fluxion/Core/Renderer.js").default} Renderer */

const ui = {
  topReloadBtn: /** @type {HTMLButtonElement|null} */ (null),
  fileMenuBtn: /** @type {HTMLButtonElement|null} */ (null),
  viewMenuBtn: /** @type {HTMLButtonElement|null} */ (null),
  sceneMenuBtn: /** @type {HTMLButtonElement|null} */ (null),
  helpMenuBtn: /** @type {HTMLButtonElement|null} */ (null),
  debugMenuBtn: /** @type {HTMLButtonElement|null} */ (null),
  aboutModal: /** @type {HTMLDivElement|null} */ (null),
  aboutCloseBtn: /** @type {HTMLButtonElement|null} */ (null),
  aboutVersionsText: /** @type {HTMLTextAreaElement|null} */ (null),
  aboutCopyBtn: /** @type {HTMLButtonElement|null} */ (null),
  editorSettingsModal: /** @type {HTMLDivElement|null} */ (null),
  editorSettingsCloseBtn: /** @type {HTMLButtonElement|null} */ (null),
  editorSettingsFilterInput: /** @type {HTMLInputElement|null} */ (null),
  editorSettingsNav: /** @type {HTMLDivElement|null} */ (null),
  editorSettingsSectionTitle: /** @type {HTMLDivElement|null} */ (null),
  editorSettingsForm: /** @type {HTMLDivElement|null} */ (null),
  editorSettingsCatGeneral: /** @type {HTMLButtonElement|null} */ (null),
  editorSettingsCatGrid2D: /** @type {HTMLButtonElement|null} */ (null),
  editorSettingsCatGrid3D: /** @type {HTMLButtonElement|null} */ (null),
  animSpriteModal: /** @type {HTMLDivElement|null} */ (null),
  animSpriteCloseBtn: /** @type {HTMLButtonElement|null} */ (null),
  animSpriteSubtitle: /** @type {HTMLDivElement|null} */ (null),
  animSpriteAnimList: /** @type {HTMLDivElement|null} */ (null),
  animSpriteNameInput: /** @type {HTMLInputElement|null} */ (null),
  animSpriteApplyBtn: /** @type {HTMLButtonElement|null} */ (null),
  animSpritePreviewWrap: /** @type {HTMLDivElement|null} */ (null),
  animSpriteFrameLabel: /** @type {HTMLDivElement|null} */ (null),
  animSpriteFramePreview: /** @type {HTMLImageElement|null} */ (null),
  animSpriteFramesStrip: /** @type {HTMLDivElement|null} */ (null),
  animSpriteError: /** @type {HTMLDivElement|null} */ (null),
  createProjectModal: /** @type {HTMLDivElement|null} */ (null),
  createProjectNameInput: /** @type {HTMLInputElement|null} */ (null),
  createProjectTemplateSelect: /** @type {HTMLSelectElement|null} */ (null),
  createProjectPathInput: /** @type {HTMLInputElement|null} */ (null),
  createProjectBrowseBtn: /** @type {HTMLButtonElement|null} */ (null),
  createProjectOkBtn: /** @type {HTMLButtonElement|null} */ (null),
  createProjectCancelBtn: /** @type {HTMLButtonElement|null} */ (null),
  projectSelectModal: /** @type {HTMLDivElement|null} */ (null),
  projectSelectCreateBtn: /** @type {HTMLButtonElement|null} */ (null),
  projectSelectOpenBtn: /** @type {HTMLButtonElement|null} */ (null),
  projectSelectOpenLegacyBtn: /** @type {HTMLButtonElement|null} */ (null),
  projectSelectRecentList: /** @type {HTMLDivElement|null} */ (null),
  addNodeModal: /** @type {HTMLDivElement|null} */ (null),
  addNodeCloseBtn: /** @type {HTMLButtonElement|null} */ (null),
  addNodeSearchInput: /** @type {HTMLInputElement|null} */ (null),
  addNodeFavorites: /** @type {HTMLDivElement|null} */ (null),
  addNodeRecent: /** @type {HTMLDivElement|null} */ (null),
  addNodeMatches: /** @type {HTMLDivElement|null} */ (null),
  addNodeDescription: /** @type {HTMLDivElement|null} */ (null),
  addNodeOkBtn: /** @type {HTMLButtonElement|null} */ (null),
  assetUpBtn: /** @type {HTMLButtonElement|null} */ (null),
  assetPath: /** @type {HTMLDivElement|null} */ (null),
  assetFolders: /** @type {HTMLDivElement|null} */ (null),
  assetGrid: /** @type {HTMLDivElement|null} */ (null),
  assetTabAssetsBtn: /** @type {HTMLButtonElement|null} */ (null),
  assetTabConsoleBtn: /** @type {HTMLButtonElement|null} */ (null),
  assetHeaderAssetsTools: /** @type {HTMLDivElement|null} */ (null),
  assetHeaderConsoleTools: /** @type {HTMLDivElement|null} */ (null),
  assetPanelAssets: /** @type {HTMLDivElement|null} */ (null),
  assetPanelConsole: /** @type {HTMLDivElement|null} */ (null),
  consoleOutput: /** @type {HTMLDivElement|null} */ (null),
  mainTabViewportBtn: /** @type {HTMLButtonElement|null} */ (null),
  mainTabsDynamic: /** @type {HTMLDivElement|null} */ (null),
  viewportView: /** @type {HTMLDivElement|null} */ (null),
  scriptView: /** @type {HTMLDivElement|null} */ (null),
  scriptPath: /** @type {HTMLDivElement|null} */ (null),
  scriptSaveBtn: /** @type {HTMLButtonElement|null} */ (null),
  scriptEditorWrap: /** @type {HTMLDivElement|null} */ (null),
  scriptHighlight: /** @type {HTMLPreElement|null} */ (null),
  scriptEditorText: /** @type {HTMLTextAreaElement|null} */ (null),
  mode2dBtn: /** @type {HTMLButtonElement|null} */ (null),
  mode3dBtn: /** @type {HTMLButtonElement|null} */ (null),
  tree: /** @type {HTMLDivElement|null} */ (null),
  inspectorSubtitle: /** @type {HTMLDivElement|null} */ (null),
  common: /** @type {HTMLDivElement|null} */ (null),
  transform: /** @type {HTMLDivElement|null} */ (null),
  overlay: /** @type {HTMLDivElement|null} */ (null),
  dbgShowAxes: /** @type {HTMLInputElement|null} */ (null),
  dbgShowAabb: /** @type {HTMLInputElement|null} */ (null),
  dbgDepthTest: /** @type {HTMLInputElement|null} */ (null),
};

/**
 * Minimal editor-style example:
 * - Loads a scene via SceneLoader
 * - Displays a scene tree
 * - Allows selecting an object and editing basic fields
 * - Draws simple 3D debug overlays for the selection
 */
const game = {
  /** @type {import("../../Fluxion/Core/Scene.js").default | null} */
  currentScene: null,

  /** @type {any | null} */
  selected: null,

  /** @type {'2d' | '3d'} */
  mode: '2d',

  /** @type {Renderer | null} */
  _renderer: null,

  /** @type {import("../../Fluxion/Core/Input.js").default | null} */
  _input: null,

  /** @type {import("../../Fluxion/Core/Camera.js").default | null} */
  _editorCamera2D: null,
  /** @type {import("../../Fluxion/Core/Camera3D.js").default | null} */
  _editorCamera3D: null,
  /** @type {import("../../Fluxion/Core/Camera.js").default | null} */
  _sceneCamera2D: null,
  /** @type {import("../../Fluxion/Core/Camera3D.js").default | null} */
  _sceneCamera3D: null,
  _usingEditorCamera2D: false,
  _usingEditorCamera3D: false,

  _editorCam3DState: {
    yaw: 0,
    pitch: 0,
    yawTarget: 0,
    pitchTarget: 0,
    moveSpeed: 6, // units/sec
    // Lower = snappier, higher = floatier.
    smoothTimeRot: 0.06,
    smoothTimePos: 0.05,
    posTarget: { x: 0, y: 0, z: 0 },
  },

  _wheelDeltaY: 0,

  _editorPointerLocked: false,
  /** @type {HTMLCanvasElement|null} */
  _editorPointerLockCanvas: null,

  _viewportQuality: {
    scale: 1,
    queued: false,
  },

  _gizmo: {
    active: false,
    mode: /** @type {'translate'|'rotate'} */ ('translate'),
    axis: /** @type {'x'|'y'|'z'|'center'|'rot'|null} */ (null),
    startPos2D: /** @type {{x:number,y:number}|null} */ (null),
    startPos3D: /** @type {{x:number,y:number,z:number}|null} */ (null),
    startMouseWorld2D: /** @type {{x:number,y:number}|null} */ (null),
    startMouseAngle2D: 0,
    startRot2D: 0,
    startAxisAngle3D: 0,
    startEuler3D: /** @type {{x:number,y:number,z:number}|null} */ (null),
    startDir3D: /** @type {[number,number,number]|null} */ (null),
    startCamDir3D: /** @type {{x:number,y:number,z:number}|null} */ (null),
    startAxisT: 0,
    startPlaneHit: /** @type {{x:number,y:number,z:number}|null} */ (null),
  },

  _helpVisible: true,

  _closeTopbarMenus: /** @type {() => void} */ (() => {}),

  _aboutOpen: false,

  _editorSettingsOpen: false,

  _editorSettingsCategory: /** @type {'general'|'grid2d'|'grid3d'} */ ('general'),
  _editorSettingsFilter: '',

  _editorSettings: /** @type {{
    general: { showHelpOverlay: boolean, fluxionInstallPath: string },
    grid2d: { enabled: boolean, baseMinor: number, majorMultiplier: number, minGridPx: number, maxGridLines: number, showAxes: boolean },
    grid3d: { enabled: boolean, autoScale: boolean, minor: number, majorMultiplier: number, halfSpan: number, showAxes: boolean }
  }} */ ({
    general: { showHelpOverlay: true, fluxionInstallPath: '' },
    grid2d: { enabled: true, baseMinor: 32, majorMultiplier: 2, minGridPx: 10, maxGridLines: 240, showAxes: true },
    grid3d: { enabled: true, autoScale: true, minor: 1, majorMultiplier: 5, halfSpan: 50, showAxes: true },
  }),

  _projectSelectOpen: false,

  /** @type {{ path: string, legacy: boolean, t: number }[]} */
  _recentProjects: [],
  _recentProjectsMax: 10,

  /** @type {{ name: string, creator: string, resolution: { width: number, height: number }, engineVersion: string, enable2D?: boolean, enable3D?: boolean } | null} */
  _projectMeta: null,
  /** @type {string[]} */
  _projectMetaFiles: [],
  _projectMetaSaveT: 0,

  /** @type {'assets'|'console'} */
  _bottomTab: 'assets',

  /** @type {'viewport'|'script'} */
  _mainTab: 'viewport',
  /** @type {string|null} */
  _activeScriptPath: null,
  /** @type {{ pathRel: string, name: string, text: string, dirty: boolean }[]} */
  _openScripts: [],

  _consoleCaptureInstalled: false,
  _consoleMaxLines: 500,

  _addNodeOpen: false,
  _addNodeSearch: '',
  /** @type {string|null} */
  _addNodeSelectedId: null,
  _addNodeExpanded: {
    Spatial: true,
    CanvasItem: true,
    Node2D: true,
    Control: true,
    Node3D: true,
    Light: true,
  },
  /** @type {string[]} */
  _addNodeFavorites: [],
  /** @type {string[]} */
  _addNodeRecent: [],

  _defaultSpriteIconUrl: new URL('../../Fluxion/Icon/Fluxion_icon.png', import.meta.url).toString(),

  _animSpriteOpen: false,
  /** @type {any|null} */
  _animSpriteTarget: null,
  /** @type {string|null} */
  _animSpriteAnimName: null,
  /** @type {number|null} */
  _animSpriteFrameIndex: null,
  /** @type {{ animName: string|null, frameIndex: number, wasPlaying: boolean } | null} */
  _animSpritePrevPlayback: null,

  _inspectorAutoRefreshT: 0,

  _speakerIconUrl: new URL('../../Fluxion/Icon/Speaker.png', import.meta.url).toString(),
  /** @type {WebGLTexture|null} */
  _speakerIconTexture: null,
  /** @type {Promise<boolean>|null} */
  _speakerIconLoadPromise: null,

  // When the inspector auto-refreshes, it rebuilds DOM. If that happens between
  // pointer down/up, the browser may not fire a click on the original element.
  // Use a short cooldown after interactions inside the inspector.
  _inspectorRefreshBlockT: 0,

  _createProjectDialog: /** @type {ReturnType<typeof createProjectDialog> | null} */ (null),

  _assetBrowser: {
    root: '.',
    cwd: '.',
    selected: /** @type {string|null} */ (null),
  },

  _assetBrowserCtl: /** @type {ReturnType<typeof createAssetBrowser> | null} */ (null),

  /** @type {string|null} */
  _scenePath: null,

  _lastSceneSaveOkT: 0,

  /** @param {Renderer} renderer */
  async init(renderer) {
    this._renderer = renderer;
    this._input = new Input();

    // Best-effort preload for the Audio viewport icon.
    // (If it isn't ready yet, it will be lazily loaded on first draw.)
    this._ensureSpeakerIconTexture(renderer);

    // Keep the renderer sized to the editor viewport.
    // (Window resize is not enough in editor layouts; panels can affect canvas size.)
    this._setupViewportResize(renderer);

    this._setupEditorCameraInput(renderer);

    // Wire DOM
    ui.topReloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById("topReloadBtn"));
    ui.fileMenuBtn = /** @type {HTMLButtonElement} */ (document.getElementById("fileMenuBtn"));
    ui.viewMenuBtn = /** @type {HTMLButtonElement} */ (document.getElementById("viewMenuBtn"));
    ui.sceneMenuBtn = /** @type {HTMLButtonElement} */ (document.getElementById("sceneMenuBtn"));
    ui.helpMenuBtn = /** @type {HTMLButtonElement} */ (document.getElementById("helpMenuBtn"));
    ui.debugMenuBtn = /** @type {HTMLButtonElement} */ (document.getElementById("debugMenuBtn"));
    ui.aboutModal = /** @type {HTMLDivElement} */ (document.getElementById("aboutModal"));
    ui.aboutCloseBtn = /** @type {HTMLButtonElement} */ (document.getElementById("aboutCloseBtn"));
    ui.aboutVersionsText = /** @type {HTMLTextAreaElement} */ (document.getElementById('aboutVersionsText'));
    ui.aboutCopyBtn = /** @type {HTMLButtonElement} */ (document.getElementById('aboutCopyBtn'));

    ui.editorSettingsModal = /** @type {HTMLDivElement} */ (document.getElementById('editorSettingsModal'));
    ui.editorSettingsCloseBtn = /** @type {HTMLButtonElement} */ (document.getElementById('editorSettingsCloseBtn'));
    ui.editorSettingsFilterInput = /** @type {HTMLInputElement} */ (document.getElementById('editorSettingsFilterInput'));
    ui.editorSettingsNav = /** @type {HTMLDivElement} */ (document.getElementById('editorSettingsNav'));
    ui.editorSettingsSectionTitle = /** @type {HTMLDivElement} */ (document.getElementById('editorSettingsSectionTitle'));
    ui.editorSettingsForm = /** @type {HTMLDivElement} */ (document.getElementById('editorSettingsForm'));
    ui.editorSettingsCatGeneral = /** @type {HTMLButtonElement} */ (document.getElementById('editorSettingsCatGeneral'));
    ui.editorSettingsCatGrid2D = /** @type {HTMLButtonElement} */ (document.getElementById('editorSettingsCatGrid2D'));
    ui.editorSettingsCatGrid3D = /** @type {HTMLButtonElement} */ (document.getElementById('editorSettingsCatGrid3D'));

    ui.animSpriteModal = /** @type {HTMLDivElement} */ (document.getElementById('animSpriteModal'));
    ui.animSpriteCloseBtn = /** @type {HTMLButtonElement} */ (document.getElementById('animSpriteCloseBtn'));
    ui.animSpriteSubtitle = /** @type {HTMLDivElement} */ (document.getElementById('animSpriteSubtitle'));
    ui.animSpriteAnimList = /** @type {HTMLDivElement} */ (document.getElementById('animSpriteAnimList'));
    ui.animSpriteNameInput = /** @type {HTMLInputElement} */ (document.getElementById('animSpriteNameInput'));
    ui.animSpriteApplyBtn = /** @type {HTMLButtonElement} */ (document.getElementById('animSpriteApplyBtn'));
    ui.animSpritePreviewWrap = /** @type {HTMLDivElement} */ (document.getElementById('animSpritePreviewWrap'));
    ui.animSpriteFrameLabel = /** @type {HTMLDivElement} */ (document.getElementById('animSpriteFrameLabel'));
    ui.animSpriteFramePreview = /** @type {HTMLImageElement} */ (document.getElementById('animSpriteFramePreview'));
    ui.animSpriteFramesStrip = /** @type {HTMLDivElement} */ (document.getElementById('animSpriteFramesStrip'));
    ui.animSpriteError = /** @type {HTMLDivElement} */ (document.getElementById('animSpriteError'));
    ui.createProjectModal = /** @type {HTMLDivElement} */ (document.getElementById("createProjectModal"));
    ui.createProjectNameInput = /** @type {HTMLInputElement} */ (document.getElementById("createProjectNameInput"));
    ui.createProjectTemplateSelect = /** @type {HTMLSelectElement} */ (document.getElementById("createProjectTemplateSelect"));
    ui.createProjectPathInput = /** @type {HTMLInputElement} */ (document.getElementById("createProjectPathInput"));
    ui.createProjectBrowseBtn = /** @type {HTMLButtonElement} */ (document.getElementById("createProjectBrowseBtn"));
    ui.createProjectOkBtn = /** @type {HTMLButtonElement} */ (document.getElementById("createProjectOkBtn"));
    ui.createProjectCancelBtn = /** @type {HTMLButtonElement} */ (document.getElementById("createProjectCancelBtn"));

    ui.projectSelectModal = /** @type {HTMLDivElement} */ (document.getElementById('projectSelectModal'));
    ui.projectSelectCreateBtn = /** @type {HTMLButtonElement} */ (document.getElementById('projectSelectCreateBtn'));
    ui.projectSelectOpenBtn = /** @type {HTMLButtonElement} */ (document.getElementById('projectSelectOpenBtn'));
    ui.projectSelectOpenLegacyBtn = /** @type {HTMLButtonElement} */ (document.getElementById('projectSelectOpenLegacyBtn'));
    ui.projectSelectRecentList = /** @type {HTMLDivElement} */ (document.getElementById('projectSelectRecentList'));

    ui.addNodeModal = /** @type {HTMLDivElement} */ (document.getElementById('addNodeModal'));
    ui.addNodeCloseBtn = /** @type {HTMLButtonElement} */ (document.getElementById('addNodeCloseBtn'));
    ui.addNodeSearchInput = /** @type {HTMLInputElement} */ (document.getElementById('addNodeSearchInput'));
    ui.addNodeFavorites = /** @type {HTMLDivElement} */ (document.getElementById('addNodeFavorites'));
    ui.addNodeRecent = /** @type {HTMLDivElement} */ (document.getElementById('addNodeRecent'));
    ui.addNodeMatches = /** @type {HTMLDivElement} */ (document.getElementById('addNodeMatches'));
    ui.addNodeDescription = /** @type {HTMLDivElement} */ (document.getElementById('addNodeDescription'));
    ui.addNodeOkBtn = /** @type {HTMLButtonElement} */ (document.getElementById('addNodeOkBtn'));
    ui.assetUpBtn = /** @type {HTMLButtonElement} */ (document.getElementById("assetUpBtn"));
    ui.assetPath = /** @type {HTMLDivElement} */ (document.getElementById("assetPath"));
    ui.assetFolders = /** @type {HTMLDivElement} */ (document.getElementById("assetFolders"));
    ui.assetGrid = /** @type {HTMLDivElement} */ (document.getElementById("assetGrid"));
    ui.assetTabAssetsBtn = /** @type {HTMLButtonElement} */ (document.getElementById('assetTabAssetsBtn'));
    ui.assetTabConsoleBtn = /** @type {HTMLButtonElement} */ (document.getElementById('assetTabConsoleBtn'));
    ui.assetHeaderAssetsTools = /** @type {HTMLDivElement} */ (document.getElementById('assetHeaderAssetsTools'));
    ui.assetHeaderConsoleTools = /** @type {HTMLDivElement} */ (document.getElementById('assetHeaderConsoleTools'));
    ui.assetPanelAssets = /** @type {HTMLDivElement} */ (document.getElementById('assetPanelAssets'));
    ui.assetPanelConsole = /** @type {HTMLDivElement} */ (document.getElementById('assetPanelConsole'));
    ui.consoleOutput = /** @type {HTMLDivElement} */ (document.getElementById('consoleOutput'));

    ui.mainTabViewportBtn = /** @type {HTMLButtonElement} */ (document.getElementById('mainTabViewportBtn'));
    ui.mainTabsDynamic = /** @type {HTMLDivElement} */ (document.getElementById('mainTabsDynamic'));
    ui.viewportView = /** @type {HTMLDivElement} */ (document.getElementById('viewportView'));
    ui.scriptView = /** @type {HTMLDivElement} */ (document.getElementById('scriptView'));
    ui.scriptPath = /** @type {HTMLDivElement} */ (document.getElementById('scriptPath'));
    ui.scriptSaveBtn = /** @type {HTMLButtonElement} */ (document.getElementById('scriptSaveBtn'));
    ui.scriptEditorWrap = /** @type {HTMLDivElement} */ (document.getElementById('scriptEditorWrap'));
    ui.scriptHighlight = /** @type {HTMLPreElement} */ (document.getElementById('scriptHighlight'));
    ui.scriptEditorText = /** @type {HTMLTextAreaElement} */ (document.getElementById('scriptEditorText'));

    // Ensure About starts closed.
    if (ui.aboutModal) ui.aboutModal.hidden = true;
    if (ui.editorSettingsModal) ui.editorSettingsModal.hidden = true;
    if (ui.animSpriteModal) ui.animSpriteModal.hidden = true;
    // Ensure Create Project starts closed.
    if (ui.createProjectModal) ui.createProjectModal.hidden = true;
    // Ensure Project Select starts closed (we open it after initial boot).
    if (ui.projectSelectModal) ui.projectSelectModal.hidden = true;
    // Ensure Add Node starts closed.
    if (ui.addNodeModal) ui.addNodeModal.hidden = true;

    this._setupAssetBrowser();
    ui.mode2dBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mode2dBtn"));
    ui.mode3dBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mode3dBtn"));
    ui.tree = /** @type {HTMLDivElement} */ (document.getElementById("sceneTree"));
    ui.inspectorSubtitle = /** @type {HTMLDivElement} */ (document.getElementById("inspectorSubtitle"));
    ui.common = /** @type {HTMLDivElement} */ (document.getElementById("inspectorCommon"));
    ui.transform = /** @type {HTMLDivElement} */ (document.getElementById("inspectorTransform"));
    ui.overlay = /** @type {HTMLDivElement} */ (document.getElementById("overlay"));
    ui.dbgShowAxes = /** @type {HTMLInputElement} */ (document.getElementById("dbgShowAxes"));
    ui.dbgShowAabb = /** @type {HTMLInputElement} */ (document.getElementById("dbgShowAabb"));
    ui.dbgDepthTest = /** @type {HTMLInputElement} */ (document.getElementById("dbgDepthTest"));

    // Load editor settings (best-effort) and apply immediately.
    this._loadEditorSettingsFromStorage();
    this._helpVisible = !!this._editorSettings.general.showHelpOverlay;
    if (ui.overlay) ui.overlay.style.display = this._helpVisible ? 'block' : 'none';

    // Avoid inspector auto-refresh fighting clicks.
    this._setupInspectorInteractionGuards();

    // Bottom panel tabs
    ui.assetTabAssetsBtn?.addEventListener('click', () => this._setBottomTab('assets'));
    ui.assetTabConsoleBtn?.addEventListener('click', () => this._setBottomTab('console'));
    this._setBottomTab('assets');

    // Main tabs (viewport + scripts)
    ui.mainTabViewportBtn?.addEventListener('click', () => this._setMainTab('viewport'));
    ui.scriptSaveBtn?.addEventListener('click', () => this._saveActiveScript().catch(console.error));
    ui.scriptEditorText?.addEventListener('input', () => {
      this._markActiveScriptDirty();
      this._updateScriptHighlight();
    });
    ui.scriptEditorText?.addEventListener('scroll', () => this._syncScriptHighlightScroll());
    this._setMainTab('viewport');

    // Capture logs into the Console tab
    this._installEditorConsoleCapture();

    ui.topReloadBtn?.addEventListener("click", () => {
      window.location.reload();
    });

    this._setupTopbarMenus(renderer);

    // About modal behavior (extracted to module)
    wireAboutUI(this, ui);

    // Editor Settings modal behavior (extracted to module)
    wireEditorSettingsUI(this, ui);

    // Add Node modal behavior (extracted to module)
    wireAddNodeUI(this, ui);

    // AnimatedSprite modal close behavior
    ui.animSpriteCloseBtn?.addEventListener('click', () => this._closeAnimSpriteEditor());
    ui.animSpriteModal?.addEventListener('mousedown', (e) => {
      if (e.target === ui.animSpriteModal) this._closeAnimSpriteEditor();
    });

    ui.animSpriteApplyBtn?.addEventListener('click', () => this._applyAnimSpriteRename());
    ui.animSpriteNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._applyAnimSpriteRename();
      }
    });

    // Project Select behavior (mandatory - cannot dismiss without choosing/creating)
    wireProjectSelectionUI(this, /** @type {any} */ (ui));

    // Create Project dialog
    this._createProjectDialog = createProjectDialog({
      ui: /** @type {any} */ (ui),
      closeMenus: () => this._closeTopbarMenus(),
      getFluxionInstallPath: () => String(this._editorSettings?.general?.fluxionInstallPath || ''),
    });
    this._createProjectDialog.init();

    ui.mode2dBtn?.addEventListener('click', () => {
      this.setMode('2d');
    });
    ui.mode3dBtn?.addEventListener('click', () => {
      this.setMode('3d');
    });

    window.addEventListener("keydown", (e) => {
      // Ctrl+S / Cmd+S should work even while typing.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (this._mainTab === 'script') {
          this._saveActiveScript().catch(console.error);
        } else {
          this.saveCurrentScene().catch(console.error);
        }
        return;
      }

      // Don't trigger global shortcuts while typing.
      const keyTarget = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
      if (keyTarget) {
        const tag = String(keyTarget.tagName || '').toLowerCase();
        const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || !!keyTarget.isContentEditable;
        if (isTyping) return;
      }

      // Menu actions
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        // Match browser/Electron refresh behavior.
        e.preventDefault();
        window.location.reload();
        return;
      }

      if (e.key === "Escape") {
        // Mandatory project selection screen: Escape does nothing.
        if (this._projectSelectOpen) {
          e.preventDefault();
          return;
        }
        const canvas = this._editorPointerLockCanvas;
        if (canvas && document.pointerLockElement === canvas) {
          e.preventDefault();
          document.exitPointerLock?.();
          return;
        }
        if (this._createProjectDialog?.isOpen()) this._createProjectDialog.cancel();
        else if (this._animSpriteOpen) this._closeAnimSpriteEditor();
        else if (this._addNodeOpen) this._closeAddNode();
        else if (this._editorSettingsOpen) this._closeEditorSettings();
        else if (this._aboutOpen) this._closeAbout();
        else this._closeTopbarMenus();
      }

      // Delete selected node (viewport/tree selection) with confirmation.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Avoid deleting while any modal/dialog is open.
        if (this._projectSelectOpen || this._addNodeOpen || this._editorSettingsOpen || this._aboutOpen || this._animSpriteOpen || this._createProjectDialog?.isOpen()) {
          return;
        }
        const did = this._confirmAndDeleteSelectedNode();
        if (did) e.preventDefault();
        return;
      }

      if (e.key === "F1") {
        e.preventDefault();
        this._helpVisible = !this._helpVisible;
        if (ui.overlay) ui.overlay.style.display = this._helpVisible ? "block" : "none";
      }
      if (e.key.toLowerCase() === "f") {
        this.focusSelection();
      }
    });

    // Ensure renderer layer visibility matches the default mode.
    this._applyRenderLayers();

    // Apply project mode availability (mode buttons + mode clamping).
    this._applyModeAvailability();

    await this.loadSelectedScene(renderer);

    // Show the startup project selection screen when the editor launches.
    this._openProjectSelect();
  },

  /** @param {'assets'|'console'} tab */
  _setBottomTab(tab) {
    this._bottomTab = tab;
    const isAssets = tab === 'assets';

    if (ui.assetTabAssetsBtn) {
      ui.assetTabAssetsBtn.classList.toggle('active', isAssets);
      ui.assetTabAssetsBtn.setAttribute('aria-selected', isAssets ? 'true' : 'false');
    }
    if (ui.assetTabConsoleBtn) {
      ui.assetTabConsoleBtn.classList.toggle('active', !isAssets);
      ui.assetTabConsoleBtn.setAttribute('aria-selected', !isAssets ? 'true' : 'false');
    }

    if (ui.assetPanelAssets) {
      ui.assetPanelAssets.hidden = !isAssets;
      ui.assetPanelAssets.style.display = isAssets ? '' : 'none';
      ui.assetPanelAssets.setAttribute('aria-hidden', isAssets ? 'false' : 'true');
    }
    if (ui.assetPanelConsole) {
      ui.assetPanelConsole.hidden = isAssets;
      ui.assetPanelConsole.style.display = isAssets ? 'none' : '';
      ui.assetPanelConsole.setAttribute('aria-hidden', isAssets ? 'true' : 'false');
    }

    if (ui.assetHeaderAssetsTools) {
      ui.assetHeaderAssetsTools.hidden = !isAssets;
      ui.assetHeaderAssetsTools.style.display = isAssets ? '' : 'none';
    }
    if (ui.assetHeaderConsoleTools) {
      ui.assetHeaderConsoleTools.hidden = isAssets;
      ui.assetHeaderConsoleTools.style.display = isAssets ? 'none' : '';
    }
  },

  _installEditorConsoleCapture() {
    if (this._consoleCaptureInstalled) return;
    this._consoleCaptureInstalled = true;

    /** @type {(level: 'log'|'info'|'warn'|'error'|string, args: any[]) => void} */
    const append = (level, args) => {
      try {
        this._appendConsoleLine(String(level || 'log'), args);
      } catch {}
    };

    const original = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args) => { original.log.apply(console, args); append('log', args); };
    console.info = (...args) => { original.info.apply(console, args); append('info', args); };
    console.warn = (...args) => { original.warn.apply(console, args); append('warn', args); };
    console.error = (...args) => { original.error.apply(console, args); append('error', args); };

    window.addEventListener('error', (ev) => {
      try {
        append('error', [ev.message || 'Error', ev.filename ? `(${ev.filename}:${ev.lineno || 0})` : '']);
      } catch {}
    });

    window.addEventListener('unhandledrejection', (ev) => {
      try {
        append('error', ['Unhandled Promise Rejection', ev.reason]);
      } catch {}
    });
  },

  /** @param {string} level @param {any[]} args */
  _appendConsoleLine(level, args) {
    const out = ui.consoleOutput;
    if (!out) return;

    const line = document.createElement('div');
    line.className = 'consoleLine';

    const text = this._formatConsoleArgs(args);
    const prefix = level && level !== 'log' ? `[${level}] ` : '';
    line.textContent = prefix + text;
    out.appendChild(line);

    // Trim
    const max = Math.max(50, Number(this._consoleMaxLines) || 500);
    while (out.childElementCount > max) {
      const first = out.firstElementChild;
      if (!first) break;
      first.remove();
    }

    // Auto-scroll if user is near the bottom.
    const dist = out.scrollHeight - out.scrollTop - out.clientHeight;
    if (dist < 40) out.scrollTop = out.scrollHeight;
  },

  /** @param {any[]} args */
  _formatConsoleArgs(args) {
    const parts = [];
    for (const a of (Array.isArray(args) ? args : [])) {
      if (typeof a === 'string') parts.push(a);
      else if (a instanceof Error) parts.push(a.stack || a.message || String(a));
      else {
        try {
          parts.push(JSON.stringify(a));
        } catch {
          parts.push(String(a));
        }
      }
    }
    return parts.join(' ');
  },

  _openProjectSelect() {
    openProjectSelect(this, /** @type {any} */ (ui));
  },

  _closeProjectSelect() {
    closeProjectSelect(this, /** @type {any} */ (ui));
  },

  async _createAndOpenNewProject() {
    return createAndOpenNewProject(this, /** @type {any} */ (ui));
  },

  async _openProjectFolderStrict() {
    return openProjectFolderStrict(this, /** @type {any} */ (ui));
  },

  async _openLegacyProjectFolder() {
    return openLegacyProjectFolder(this, /** @type {any} */ (ui));
  },

  _loadRecentProjectsFromStorage() {
    loadRecentProjectsFromStorage(this);
  },

  _saveRecentProjectsToStorage() {
    saveRecentProjectsToStorage(this);
  },

  /** @param {string} absPath @param {boolean} legacy */
  _rememberRecentProject(absPath, legacy) {
    rememberRecentProject(this, /** @type {any} */ (ui), absPath, legacy);
  },

  /** @param {string} absPath */
  _removeRecentProject(absPath) {
    removeRecentProject(this, /** @type {any} */ (ui), absPath);
  },

  _renderProjectSelectRecents() {
    renderProjectSelectRecents(this, /** @type {any} */ (ui));
  },

  /** @param {{ path: string, legacy: boolean }} ent */
  async _openRecentProject(ent) {
    return openRecentProject(this, /** @type {any} */ (ui), ent);
  },

  /** @param {string} abs @returns {Promise<boolean>} */
  async _openWorkspaceAtPath(abs) {
    return openWorkspaceAtPath(this, /** @type {any} */ (ui), abs);
  },

  /** @param {string} abs @returns {Promise<boolean>} */
  async _openProjectAtPathStrict(abs) {
    return openProjectAtPathStrict(this, /** @type {any} */ (ui), abs);
  },

  async _loadProjectMetaFromWorkspace() {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (!electronAPI || typeof electronAPI.listProjectDir !== 'function') {
      this._projectMeta = null;
      this._projectMetaFiles = [];
      this.rebuildInspector();
      return;
    }

    try {
      const rootList = await electronAPI.listProjectDir('.');
      const entries = (rootList && rootList.ok && Array.isArray(rootList.entries))
        ? /** @type {{ name?: string, isDir?: boolean }[]} */ (rootList.entries)
        : /** @type {{ name?: string, isDir?: boolean }[]} */ ([]);

      const files = entries.filter((e) => !e.isDir).map((e) => String(e.name || '')).filter(Boolean);
      const hasJson = files.includes('fluxion.project.json');
      const fluxFiles = files.filter((n) => n.toLowerCase().endsWith('.flux')).sort();

      /** @type {string[]} */
      const metaFiles = [];
      if (hasJson) metaFiles.push('fluxion.project.json');
      if (fluxFiles.length > 0) metaFiles.push(fluxFiles[0]);

      // Prefer JSON project file for reading; fall back to .flux.
      const primary = hasJson ? 'fluxion.project.json' : (fluxFiles[0] || null);
      if (!primary) {
        this._projectMeta = null;
        this._projectMetaFiles = [];
        this.rebuildInspector();
        return;
      }

      const res = await fetch(`fluxion://workspace/${encodeURIComponent(primary)}`);
      if (!res.ok) throw new Error('Failed to load project descriptor');
      const data = await res.json();

      const name = String(data && data.name ? data.name : '').trim() || 'My Game';
      const creator = String(data && data.creator ? data.creator : '');
      const engineVersion = String(data && data.engineVersion ? data.engineVersion : '');
      const r = /** @type {any} */ (data && data.resolution ? data.resolution : null);
      let w = 1280;
      let h = 720;
      if (Array.isArray(r) && r.length >= 2) {
        w = Math.max(1, Number(r[0]) || 1280);
        h = Math.max(1, Number(r[1]) || 720);
      } else if (r && typeof r === 'object') {
        w = Math.max(1, Number(r.width) || 1280);
        h = Math.max(1, Number(r.height) || 720);
      }

      const enable2D = (data && typeof data.enable2D === 'boolean') ? data.enable2D : true;
      const enable3D = (data && typeof data.enable3D === 'boolean') ? data.enable3D : true;

      this._projectMeta = { name, creator, resolution: { width: w | 0, height: h | 0 }, engineVersion, enable2D, enable3D };
      this._projectMetaFiles = metaFiles;
      this._applyRenderLayers();
      this._applyModeAvailability();
      this.rebuildInspector();
    } catch (e) {
      console.warn(e);
      this._projectMeta = null;
      this._projectMetaFiles = [];
      this.rebuildInspector();
    }
  },

  _scheduleSaveProjectMeta() {
    // Debounce saves while typing.
    const now = performance.now();
    this._projectMetaSaveT = now + 350;
  },

  async _flushSaveProjectMetaIfDue() {
    if (!this._projectMeta) return;
    if (!this._projectMetaFiles || this._projectMetaFiles.length === 0) return;
    if (this._projectMetaSaveT <= 0) return;
    const now = performance.now();
    if (now < this._projectMetaSaveT) return;
    this._projectMetaSaveT = 0;

    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (!electronAPI || typeof electronAPI.getWorkspaceRoot !== 'function' || typeof electronAPI.saveProjectFile !== 'function') return;

    const root = await electronAPI.getWorkspaceRoot();
    const rootAbs = root && root.ok && root.path ? String(root.path) : '';
    if (!rootAbs) return;

    const meta = this._projectMeta;
    const payload = {
      name: String(meta.name || ''),
      creator: String(meta.creator || ''),
      resolution: { width: Number(meta.resolution?.width) || 1280, height: Number(meta.resolution?.height) || 720 },
      engineVersion: String(meta.engineVersion || ''),
      enable2D: typeof meta.enable2D === 'boolean' ? meta.enable2D : true,
      enable3D: typeof meta.enable3D === 'boolean' ? meta.enable3D : true,
      // Preserve mainScene if it exists in the file by writing only known fields? For now,
      // keep it stable by also attempting to read+merge at save time.
    };

    for (const rel of this._projectMetaFiles) {
      try {
        // Merge with existing so we don't accidentally drop fields like mainScene.
        let existing = {};
        try {
          const fr = await fetch(`fluxion://workspace/${encodeURIComponent(rel)}`);
          if (fr.ok) existing = await fr.json();
        } catch {}
        const merged = { ...(existing && typeof existing === 'object' ? existing : {}), ...payload };

        const sep = rootAbs.includes('\\') ? '\\' : '/';
        const absPath = rootAbs.replace(/[\\/]+$/, '') + sep + rel;
        await electronAPI.saveProjectFile(absPath, JSON.stringify(merged, null, 2) + '\n');
      } catch (e) {
        console.warn(e);
      }
    }
  },

  /** @param {HTMLElement | null} container */
  _rebuildProjectInspector(container) {
    if (!container) return;

    const title = document.createElement('div');
    title.className = 'sectionTitle';
    title.textContent = 'Project';
    title.style.marginTop = '0px';
    container.appendChild(title);

    if (!this._projectMeta) {
      this._addReadonly(container, 'status', 'No project file loaded');
      return;
    }

    const meta = this._projectMeta;

    // Editable fields
    const nameObj = /** @type {any} */ ({ name: meta.name });
    this._addStringWith(container, 'name', nameObj, 'name', () => {
      meta.name = String(nameObj.name || '');
      this._scheduleSaveProjectMeta();
    });

    const creatorObj = /** @type {any} */ ({ creator: meta.creator });
    this._addStringWith(container, 'creator', creatorObj, 'creator', () => {
      meta.creator = String(creatorObj.creator || '');
      this._scheduleSaveProjectMeta();
    });

    const resObj = /** @type {{ width: number, height: number }} */ ({ width: meta.resolution.width, height: meta.resolution.height });
    /** @param {string} label @param {'width'|'height'} key */
    const addResNumber = (label, key) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '1';
      input.min = '1';
      input.value = String(Number(resObj[key]) || 0);
      const apply = () => {
        const v = Math.max(1, Number(input.value) || 1) | 0;
        resObj[key] = v;
        if (key === 'width') meta.resolution.width = v;
        else meta.resolution.height = v;
        this._scheduleSaveProjectMeta();
      };
      input.addEventListener('input', apply);
      input.addEventListener('change', apply);
      this._addField(container, label, input);
    };
    addResNumber('resolution.width', 'width');
    addResNumber('resolution.height', 'height');

    // Renderer enable/disable
    const enable2DObj = /** @type {any} */ ({ enable2D: typeof meta.enable2D === 'boolean' ? meta.enable2D : true });
    this._addToggleWith(container, 'enable2D', enable2DObj, 'enable2D', () => {
      meta.enable2D = !!enable2DObj.enable2D;
      let changedOther = false;
      if (meta.enable2D === false && meta.enable3D === false) {
        meta.enable3D = true;
        changedOther = true;
      }
      this._applyRenderLayers();
      this._applyModeAvailability();
      this._scheduleSaveProjectMeta();
      if (changedOther) this.rebuildInspector();
    });

    const enable3DObj = /** @type {any} */ ({ enable3D: typeof meta.enable3D === 'boolean' ? meta.enable3D : true });
    this._addToggleWith(container, 'enable3D', enable3DObj, 'enable3D', () => {
      meta.enable3D = !!enable3DObj.enable3D;
      let changedOther = false;
      if (meta.enable3D === false && meta.enable2D === false) {
        meta.enable2D = true;
        changedOther = true;
      }
      this._applyRenderLayers();
      this._applyModeAvailability();
      this._scheduleSaveProjectMeta();
      if (changedOther) this.rebuildInspector();
    });

    // Engine version is typically informational; keep read-only.
    this._addReadonly(container, 'engineVersion', meta.engineVersion || '(unknown)');
  },

  /** @param {string|null} fluxProjectFileName */
  async _tryLoadProjectMainScene(fluxProjectFileName = null) {
    const r = this._renderer;
    if (!r) return;

    // Best-effort: read fluxion.project.json (preferred) or a *.flux file and load its mainScene.
    try {
      let res = await fetch('fluxion://workspace/fluxion.project.json');
      if (!res.ok) {
        const n = String(fluxProjectFileName || '').trim();
        if (!n || !n.toLowerCase().endsWith('.flux')) return;
        res = await fetch(`fluxion://workspace/${encodeURIComponent(n)}`);
        if (!res.ok) return;
      }

      const txt = await res.text();
      const data = JSON.parse(txt);
      const mainScene = String(data && data.mainScene ? data.mainScene : '').trim();
      if (!mainScene) return;
      const clean = mainScene.replace(/^\.(?:\/)?/, '').replace(/^\/+/, '');
      this._scenePath = `fluxion://workspace/${clean}`;
      await this.loadSelectedScene(r);
    } catch {
      // Ignore; user can open a scene manually from the asset browser.
    }
  },

  /** @param {Renderer} renderer */
  _ensureSpeakerIconTexture(renderer) {
    if (this._speakerIconTexture) return this._speakerIconTexture;
    if (!renderer) return null;

    const key = String(this._speakerIconUrl || '');
    if (!key) return null;

    // If already cached, just grab it.
    const cached = renderer.getCachedTexture?.(key);
    if (cached) {
      this._speakerIconTexture = cached;
      return cached;
    }

    // Kick off a single load request.
    if (this._speakerIconLoadPromise) return null;

    const img = new Image();
    img.decoding = 'async';
    // Note: When running under Electron with local assets, CORS is typically not an issue,
    // but setting this keeps browser-hosted runs happier.
    img.crossOrigin = 'anonymous';

    this._speakerIconLoadPromise = new Promise((resolve) => {
      img.onload = () => {
        try {
          const tex = renderer.createAndAcquireTexture?.(img, key) || null;
          if (tex) this._speakerIconTexture = tex;
          resolve(!!tex);
        } catch (e) {
          console.warn('Failed to create Speaker icon texture', e);
          resolve(false);
        }
      };
      img.onerror = () => resolve(false);
      img.src = key;
    });

    renderer.trackAssetPromise?.(this._speakerIconLoadPromise);
    return null;
  },

  /** @param {Renderer} renderer @param {any} cam2 */
  _drawAudioIcons2D(renderer, cam2) {
    const scene = this.currentScene;
    if (!scene || !Array.isArray(scene.audio) || scene.audio.length === 0) return;

    const tex = this._ensureSpeakerIconTexture(renderer);
    if (!tex || typeof renderer.drawQuad !== 'function') return;

    const zoom = Math.max(0.0001, Number(cam2?.zoom) || 1);
    const left = Number(cam2?.x) || 0;
    const top = Number(cam2?.y) || 0;

    // Keep icon a constant size in screen pixels by scaling with 1/zoom.
    const iconPx = 22;
    const size = iconPx / zoom;
    const padX = 8 / zoom;
    const padY = 22 / zoom;

    renderer.drawQuad(tex, left + padX, top + padY, size, size, [255, 255, 255, 255]);
  },

  _setupAssetBrowser() {
    if (!this._assetBrowserCtl) {
      this._assetBrowserCtl = createAssetBrowser({
        ui,
        root: this._assetBrowser.root,
        onOpenFile: (pathRel) => this._tryOpenAssetFromBrowser(pathRel),
      });
    }
    this._assetBrowserCtl.init();
  },

  /** @param {string} pathRel */
  async _tryOpenAssetFromBrowser(pathRel) {
    const p = String(pathRel || '');
    const lower = p.toLowerCase();
    if (lower.endsWith('.js')) {
      await this._openScript(p);
      return;
    }
    await this._tryOpenSceneFromAsset(p);
  },

  /**
   * Select a folder and return its project-root-relative path.
   * Only works in the Electron editor and only for folders inside the app's project root
   * (enforced in the main process for safety).
   * @returns {Promise<string|null>}
   */
  async _pickProjectRelativeFolder() {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (!electronAPI || typeof electronAPI.selectFolder !== 'function') {
      alert('Open Folder/Project is only available in the Electron editor.');
      return null;
    }

    const pick = await electronAPI.selectFolder();
    if (!pick || !pick.ok || pick.canceled) return null;

    // Newer Electron host returns insideProjectRoot + projectRel (projectRel may be null when outside root).
    const hasWorkspaceInfo = (pick && (Object.prototype.hasOwnProperty.call(pick, 'insideProjectRoot') || Object.prototype.hasOwnProperty.call(pick, 'projectRel')));
    if (hasWorkspaceInfo) {
      if (pick.insideProjectRoot === false) {
        alert('That folder is outside the current editor workspace.\n\nOpen Folder/Project currently only supports folders inside this Fluxion-Js repo.');
        return null;
      }

      const rel = String(pick.projectRel || '').trim();
      return rel || '.';
    }

    // Older host: cannot safely derive a project-root-relative folder in the renderer.
    alert('Open Folder/Project requires an updated Electron host.\n\nPlease restart after pulling the latest changes (select-folder IPC must return insideProjectRoot/projectRel).');
    return null;
  },

  /** @param {string} relRoot */
  async _setAssetBrowserRoot(relRoot) {
    const ctl = this._assetBrowserCtl;
    if (!ctl) return;

    const root = String(relRoot || '.');
    ctl.state.root = root;
    ctl.state.cwd = root;
    ctl.state.selected = null;

    this._assetBrowser.root = root;
    this._assetBrowser.cwd = root;
    this._assetBrowser.selected = null;

    await ctl.render();
  },

  /** @param {string} pathRel */
  async _tryOpenSceneFromAsset(pathRel) {
    const ext = String(pathRel || '').toLowerCase();
    const isScene = ext.endsWith('.xml') || ext.endsWith('.xaml');
    if (!isScene) return;

    const r = this._renderer;
    if (!r) return;

    const clean = String(pathRel || '').replace(/^\.(?:\/)?/, '').replace(/^\/+/, '');
    this._scenePath = `fluxion://workspace/${clean}`;
    await this.loadSelectedScene(r);
  },

  /** @param {'viewport'|'script'} tab */
  _setMainTab(tab) {
    this._mainTab = tab;

    const isViewport = tab === 'viewport';
    const isScript = tab === 'script';

    if (ui.mainTabViewportBtn) {
      ui.mainTabViewportBtn.classList.toggle('active', isViewport);
      ui.mainTabViewportBtn.setAttribute('aria-selected', isViewport ? 'true' : 'false');
    }

    if (ui.viewportView) {
      ui.viewportView.hidden = isScript;
      ui.viewportView.style.display = isScript ? 'none' : '';
      ui.viewportView.setAttribute('aria-hidden', isScript ? 'true' : 'false');
    }
    if (ui.scriptView) {
      ui.scriptView.hidden = !isScript;
      ui.scriptView.style.display = isScript ? '' : 'none';
      ui.scriptView.setAttribute('aria-hidden', isScript ? 'false' : 'true');
    }

    if (isScript) {
      // Ensure the editor has focus when switching to script.
      ui.scriptEditorText?.focus();
    }

    this._renderMainScriptTabs();
  },

  _renderMainScriptTabs() {
    const host = ui.mainTabsDynamic;
    if (!host) return;
    host.innerHTML = '';

    for (const s of this._openScripts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mainTabBtn' + (this._mainTab === 'script' && this._activeScriptPath === s.pathRel ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', (this._mainTab === 'script' && this._activeScriptPath === s.pathRel) ? 'true' : 'false');
      btn.textContent = (s.dirty ? '*' : '') + s.name;
      btn.addEventListener('click', () => {
        this._activeScriptPath = s.pathRel;
        this._loadActiveScriptIntoEditor();
        this._setMainTab('script');
      });
      host.appendChild(btn);
    }
  },

  /** @param {string} pathRel */
  async _openScript(pathRel) {
    const p = String(pathRel || '').replace(/^\.(?:\/)?/, '').replace(/^\/+/, '').replace(/\\/g, '/');
    if (!p) return;

    const existing = this._openScripts.find(s => s.pathRel === p);
    if (!existing) {
      const electronAPI = /** @type {any} */ (window).electronAPI;
      const canRead = !!(electronAPI && typeof electronAPI.readProjectTextFile === 'function');
      if (!canRead) {
        alert('Script editor is only available in the Electron editor.');
        return;
      }

      const res = await electronAPI.readProjectTextFile(p);
      if (!res || !res.ok) {
        alert(res && res.error ? res.error : 'Failed to open script');
        return;
      }

      const base = p.split('/').pop() || p;
      this._openScripts.push({ pathRel: p, name: base, text: String(res.content ?? ''), dirty: false });
    }

    this._activeScriptPath = p;
    this._loadActiveScriptIntoEditor();
    this._setMainTab('script');
  },

  _loadActiveScriptIntoEditor() {
    const p = String(this._activeScriptPath || '');
    const s = this._openScripts.find(x => x.pathRel === p) || null;
    if (ui.scriptPath) ui.scriptPath.textContent = s ? s.pathRel : 'No script opened';
    if (ui.scriptEditorText) ui.scriptEditorText.value = s ? s.text : '';
    this._updateScriptHighlight();
    this._renderMainScriptTabs();
  },

  _syncScriptHighlightScroll() {
    if (!ui.scriptEditorText || !ui.scriptHighlight) return;
    ui.scriptHighlight.scrollTop = ui.scriptEditorText.scrollTop;
    ui.scriptHighlight.scrollLeft = ui.scriptEditorText.scrollLeft;
  },

  _updateScriptHighlight() {
    if (!ui.scriptEditorText || !ui.scriptHighlight) return;

    const text = String(ui.scriptEditorText.value ?? '');
    // Avoid locking up the UI on huge files.
    if (text.length > 200_000) {
      ui.scriptHighlight.textContent = text;
      this._syncScriptHighlightScroll();
      return;
    }

    ui.scriptHighlight.innerHTML = this._highlightJsToHtml(text);
    this._syncScriptHighlightScroll();
  },

  /** @param {string} s */
  _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** @param {string} text */
  _highlightJsToHtml(text) {
    /** @type {(s: string) => string} */
    const esc = (s) => this._escapeHtml(s);
    const out = [];

    /** @type {Set<string>} */
    const keywords = new Set([
      'break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally',
      'for','function','if','import','in','instanceof','let','new','return','super','switch','this','throw','try','typeof',
      'var','void','while','with','yield','await','async','from','as'
    ]);

    /** @type {(c: string) => boolean} */
    const isIdStart = (c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$';
    /** @type {(c: string) => boolean} */
    const isId = (c) => isIdStart(c) || (c >= '0' && c <= '9');
    /** @type {(c: string) => boolean} */
    const isDigit = (c) => (c >= '0' && c <= '9');

    const s = String(text ?? '');
    const n = s.length;
    let i = 0;

    while (i < n) {
      const c = s[i];
      const c2 = i + 1 < n ? s[i + 1] : '';

      // Line comment
      if (c === '/' && c2 === '/') {
        let j = i + 2;
        while (j < n && s[j] !== '\n') j++;
        out.push('<span class="tok-comment">' + esc(s.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      // Block comment
      if (c === '/' && c2 === '*') {
        let j = i + 2;
        while (j < n) {
          if (s[j] === '*' && j + 1 < n && s[j + 1] === '/') { j += 2; break; }
          j++;
        }
        out.push('<span class="tok-comment">' + esc(s.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      // String / template literal
      if (c === '"' || c === "'" || c === '`') {
        const quote = c;
        let j = i + 1;
        let escaped = false;
        while (j < n) {
          const ch = s[j];
          if (escaped) { escaped = false; j++; continue; }
          if (ch === '\\') { escaped = true; j++; continue; }
          if (ch === quote) { j++; break; }
          j++;
        }
        out.push('<span class="tok-string">' + esc(s.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      // Number (very small heuristic)
      if (isDigit(c)) {
        let j = i + 1;
        while (j < n) {
          const ch = s[j];
          if (isDigit(ch) || ch === '.' || ch === '_' || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F') || ch === 'x' || ch === 'X' || ch === 'b' || ch === 'B' || ch === 'o' || ch === 'O' || ch === 'e' || ch === 'E' || ch === '+' || ch === '-') {
            j++;
            continue;
          }
          break;
        }
        out.push('<span class="tok-number">' + esc(s.slice(i, j)) + '</span>');
        i = j;
        continue;
      }

      // Identifier / keyword
      if (isIdStart(c)) {
        let j = i + 1;
        while (j < n && isId(s[j])) j++;
        const word = s.slice(i, j);
        if (keywords.has(word)) out.push('<span class="tok-keyword">' + esc(word) + '</span>');
        else out.push('<span class="tok-ident">' + esc(word) + '</span>');
        i = j;
        continue;
      }

      out.push(esc(c));
      i++;
    }

    return out.join('');
  },

  _markActiveScriptDirty() {
    if (this._mainTab !== 'script') return;
    const p = String(this._activeScriptPath || '');
    const s = this._openScripts.find(x => x.pathRel === p);
    if (!s || !ui.scriptEditorText) return;
    const next = String(ui.scriptEditorText.value ?? '');
    s.text = next;
    if (!s.dirty) {
      s.dirty = true;
      this._renderMainScriptTabs();
    }
  },

  async _saveActiveScript() {
    const p = String(this._activeScriptPath || '');
    const s = this._openScripts.find(x => x.pathRel === p) || null;
    if (!s || !ui.scriptEditorText) return;

    const electronAPI = /** @type {any} */ (window).electronAPI;
    const canWrite = !!(electronAPI && typeof electronAPI.writeProjectTextFile === 'function');
    if (!canWrite) {
      alert('Script editor is only available in the Electron editor.');
      return;
    }

    const content = String(ui.scriptEditorText.value ?? '');
    const res = await electronAPI.writeProjectTextFile(s.pathRel, content);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Failed to save script');
      return;
    }
    s.text = content;
    s.dirty = false;
    this._renderMainScriptTabs();
  },

  /**
   * Pick any folder on disk and set it as the editor workspace root.
   * @returns {Promise<boolean>}
   */
  async _openWorkspaceFolder() {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (!electronAPI || typeof electronAPI.selectFolder !== 'function' || typeof electronAPI.setWorkspaceRoot !== 'function') {
      alert('Open Folder is only available in the Electron editor.');
      return false;
    }

    const pick = await electronAPI.selectFolder();
    if (!pick || !pick.ok || pick.canceled) return false;

    const abs = String(pick.path || '').trim();
    if (!abs) return false;

    const res = await electronAPI.setWorkspaceRoot(abs);
    if (!res || !res.ok) {
      alert(`Failed to set workspace root: ${res && res.error ? res.error : 'Unknown error'}`);
      return false;
    }

    // Point asset browser at the new workspace root.
    await this._setAssetBrowserRoot('.');
    return true;
  },

  /** @param {any} dbg @param {boolean} depth */
  _draw3DViewportGrid(dbg, depth) {
    if (!dbg || typeof dbg.drawLine3D !== 'function') return;

    const s = this._editorSettings?.grid3d;
    if (!s || !s.enabled) return;
    const cam3 = /** @type {any} */ (this.currentScene?.camera3D);
    if (!cam3) return;

    let minor = 1;
    if (s.autoScale) {
      const posY = Math.abs(Number(cam3.position?.y) || 0);
      minor = 1;
      if (posY > 40) minor = 10;
      else if (posY > 18) minor = 5;
      else if (posY > 8) minor = 2;
    } else {
      minor = Math.max(0.0001, Number(s.minor) || 1);
    }

    const majorMul = Math.max(1, Math.floor(Number(s.majorMultiplier) || 5));
    const major = minor * majorMul;

    const halfSpan = Math.max(minor, Number(s.halfSpan) || 50);
    const y = 0;

    const cMinor = [120, 120, 120, 70];
    const cMajor = [160, 160, 160, 110];
    const cAxisX = [255, 80, 80, 160];
    const cAxisZ = [80, 160, 255, 160];

    // X-parallel lines (varying Z)
    for (let z = -halfSpan; z <= halfSpan; z += minor) {
      const isMajor = (Math.round(z / minor) % majorMul) === 0;
      const c = isMajor ? cMajor : cMinor;
      dbg.drawLine3D(-halfSpan, y, z, halfSpan, y, z, c, 1, depth);
    }

    // Z-parallel lines (varying X)
    for (let x = -halfSpan; x <= halfSpan; x += minor) {
      const isMajor = (Math.round(x / minor) % majorMul) === 0;
      const c = isMajor ? cMajor : cMinor;
      dbg.drawLine3D(x, y, -halfSpan, x, y, halfSpan, c, 1, depth);
    }

    // World axes on the plane
    if (s.showAxes) {
      dbg.drawLine3D(-halfSpan, y, 0, halfSpan, y, 0, cAxisX, 2, depth);
      dbg.drawLine3D(0, y, -halfSpan, 0, y, halfSpan, cAxisZ, 2, depth);
    }
  },

  /** @param {Renderer} renderer */
  _setupTopbarMenus(renderer) {
    const roots = Array.from(document.querySelectorAll('.topbar .menuRoot'));
    /** @type {HTMLElement|null} */
    let openRoot = null;

    const closeAll = () => {
      for (const r of roots) r.classList.remove('open');
      for (const btn of [ui.fileMenuBtn, ui.viewMenuBtn, ui.sceneMenuBtn, ui.helpMenuBtn, ui.debugMenuBtn]) {
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
      openRoot = null;
    };

    /** @param {HTMLElement} root */
    const open = (root) => {
      if (!root) return;
      closeAll();
      root.classList.add('open');
      const btn = root.querySelector('button.menuBtn');
      if (btn) btn.setAttribute('aria-expanded', 'true');
      openRoot = root;
    };

    /** @param {HTMLButtonElement | null} btn */
    const toggleForBtn = (btn) => {
      const root = /** @type {HTMLElement|null} */ (btn?.closest('.menuRoot'));
      if (!root) return;
      if (openRoot === root) closeAll();
      else open(root);
    };

    ui.fileMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); toggleForBtn(ui.fileMenuBtn); });
    ui.viewMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); toggleForBtn(ui.viewMenuBtn); });
    ui.sceneMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); toggleForBtn(ui.sceneMenuBtn); });
    ui.helpMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); toggleForBtn(ui.helpMenuBtn); });
    ui.debugMenuBtn?.addEventListener('click', (e) => { e.preventDefault(); toggleForBtn(ui.debugMenuBtn); });

    // Close on outside click
    document.addEventListener('mousedown', (e) => {
      const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
      if (!t) return;
      if (t.closest('.topbar .menuRoot')) return;
      closeAll();
    });

    // Execute menu actions
    document.addEventListener('click', (e) => {
      const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
      const action = t?.getAttribute('data-action');
      if (!action) return;

      closeAll();

      switch (action) {
        case 'file.createProject':
          this._createProjectDialog?.createProjectFromEditor().catch(console.error);
          break;
        case 'file.openProject':
          this._openProjectFolderStrict().catch(console.error);
          break;
        case 'file.openFolder':
          this._openWorkspaceFolder().catch(console.error);
          break;
        case 'file.reloadScene':
          this.loadSelectedScene(renderer).catch(console.error);
          break;
        case 'file.saveScene':
          this.saveCurrentScene().catch(console.error);
          break;
        case 'app.reload':
          window.location.reload();
          break;
        case 'app.settings':
          this._openEditorSettings();
          break;
        case 'view.toggleHelp':
          this._helpVisible = !this._helpVisible;
          if (ui.overlay) ui.overlay.style.display = this._helpVisible ? 'block' : 'none';
          break;
        case 'scene.focusSelection':
          this.focusSelection();
          break;
        case 'scene.addNode':
          this._openAddNode();
          break;
        case 'view.mode2d':
          this.setMode('2d');
          break;
        case 'view.mode3d':
          this.setMode('3d');
          break;
        case 'help.about':
          this._openAbout();
          break;
      }
    });

    // Expose close helper for Escape key
    this._closeTopbarMenus = closeAll;
  },

  /**
   * Save the currently open scene back to its XML file.
   * Uses Electron IPC (dev workflow) and refuses to write outside the workspace root.
   */
  async saveCurrentScene() {
    const scene = this.currentScene;
    if (!scene) return;

    const sceneUrl = String(this._scenePath || '').trim();
    if (!sceneUrl) {
      alert('No scene is currently open.');
      return;
    }

    const rel = this._scenePathToProjectRel(sceneUrl);
    if (!rel) {
      alert(`Can't save this scene URL: ${sceneUrl}`);
      return;
    }

    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (!electronAPI || typeof electronAPI.getWorkspaceRoot !== 'function' || typeof electronAPI.saveProjectFile !== 'function') {
      alert('Save Scene is only available in the Electron editor.');
      return;
    }

    const rootRes = await electronAPI.getWorkspaceRoot();
    if (!rootRes || !rootRes.ok || !rootRes.path) {
      alert(`Failed to resolve workspace root: ${rootRes && rootRes.error ? rootRes.error : 'Unknown error'}`);
      return;
    }

    const rootAbs = String(rootRes.path || '').replace(/[\\/]+$/, '');
    const relClean = String(rel || '').replace(/^\.(?:\\|\/)?/, '').replace(/^\/+/, '');
    const absPath = `${rootAbs}/${relClean}`;

    const xml = this._serializeSceneToXml();
    const res = await electronAPI.saveProjectFile(absPath, xml);
    if (!res || !res.ok) {
      alert(`Failed to save scene: ${res && res.error ? res.error : 'Unknown error'}`);
      return;
    }

    this._lastSceneSaveOkT = 1.25;
    console.log('Scene saved:', res.path || absPath);
  },

  /** @param {string} sceneUrl */
  _scenePathToProjectRel(sceneUrl) {
    const u = String(sceneUrl || '').trim();
    const prefix = 'fluxion://workspace/';
    if (!u.startsWith(prefix)) return null;
    const rel = u.slice(prefix.length);
    return rel ? rel : null;
  },

  _serializeSceneToXml() {
    const scene = this.currentScene;
    if (!scene) return '<Scene name="Untitled" />\n';

    /** @type {any} */
    const sceneAny = /** @type {any} */ (scene);

    /** @param {any} v */
    const esc = (v) => this._xmlEscapeAttr(v);
    /** @param {any} n */
    const fmtNum = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return null;
      // Keep authored precision (avoid rounding aggressively).
      return String(x);
    };
    /**
     * @param {string[]} parts
     * @param {string} k
     * @param {any} v
     * @param {{ allowEmpty?: boolean }=} opts
     */
    const addAttr = (parts, k, v, opts = {}) => {
      const allowEmpty = !!opts.allowEmpty;
      if (v === undefined || v === null) return;
      const s = String(v);
      if (!allowEmpty && s === '') return;
      parts.push(`${k}="${esc(s)}"`);
    };
    /** @param {string[]} parts @param {string} k @param {any} v */
    const addNumAttr = (parts, k, v) => {
      const s = fmtNum(v);
      if (s === null) return;
      parts.push(`${k}="${esc(s)}"`);
    };

    /** @type {string[]} */
    const lines = [];
    const sceneName = scene.name ? String(scene.name) : 'Untitled';
    lines.push(`<Scene name="${esc(sceneName)}">`);

    // Cameras: use authored cameras if available (editor forces rendering cameras).
    const cam2 = /** @type {any} */ (this._sceneCamera2D || null);
    if (cam2) {
      /** @type {string[]} */
      const parts = [];
      addAttr(parts, 'name', cam2.name || 'MainCamera');
      addNumAttr(parts, 'x', cam2.x ?? 0);
      addNumAttr(parts, 'y', cam2.y ?? 0);
      addNumAttr(parts, 'zoom', cam2.zoom ?? 1);
      // Rotation is optional in many scenes.
      if (Number.isFinite(Number(cam2.rotation)) && Number(cam2.rotation) !== 0) addNumAttr(parts, 'rotation', cam2.rotation);
      addNumAttr(parts, 'width', cam2.width ?? 1920);
      addNumAttr(parts, 'height', cam2.height ?? 1080);
      lines.push(`    <Camera ${parts.join(' ')} />`);
      lines.push('');
    }

    const cam3 = /** @type {any} */ (this._sceneCamera3D || null);
    if (cam3) {
      /** @type {string[]} */
      const parts = [];
      addAttr(parts, 'name', cam3.name || 'Camera3D');
      addNumAttr(parts, 'x', cam3.position?.x);
      addNumAttr(parts, 'y', cam3.position?.y);
      addNumAttr(parts, 'z', cam3.position?.z);
      addNumAttr(parts, 'targetX', cam3.target?.x);
      addNumAttr(parts, 'targetY', cam3.target?.y);
      addNumAttr(parts, 'targetZ', cam3.target?.z);
      if (Number.isFinite(Number(cam3.fovY))) addNumAttr(parts, 'fovY', cam3.fovY);
      if (Number.isFinite(Number(cam3.near))) addNumAttr(parts, 'near', cam3.near);
      if (Number.isFinite(Number(cam3.far))) addNumAttr(parts, 'far', cam3.far);
      lines.push(`    <Camera3D ${parts.join(' ')} />`);
      lines.push('');
    }

    // Optional font declarations (if loaded via <Font> support).
    const fonts = /** @type {any[]} */ (Array.isArray(sceneAny.fonts) ? sceneAny.fonts : []);
    if (fonts.length > 0) {
      for (const f of fonts) {
        /** @type {string[]} */
        const parts = [];
        addAttr(parts, 'family', f?.family);
        addAttr(parts, 'src', f?.src);
        if (parts.length > 0) lines.push(`    <Font ${parts.join(' ')} />`);
      }
      lines.push('');
    }

    // Optional mesh/material declarations (top-level <Mesh/> and <Material/> tags).
    const meshesXml = /** @type {any[]} */ (Array.isArray(sceneAny._meshXml) ? sceneAny._meshXml : []);
    if (meshesXml.length > 0) {
      for (const m of meshesXml) {
        if (!m) continue;
        /** @type {string[]} */
        const parts = [];
        addAttr(parts, 'name', m.name);
        // Preserve authoring: if source is present, write it; else write type.
        if (m.source) addAttr(parts, 'source', m.source);
        else if (m.type) addAttr(parts, 'type', m.type);
        if (m.color) addAttr(parts, 'color', m.color);
        const p = m.params;
        if (p && typeof p === 'object') {
          for (const k of ['width', 'height', 'depth', 'size', 'radius', 'subdivisions', 'radialSegments', 'heightSegments', 'capSegments']) {
            if (p[k] === undefined || p[k] === null || p[k] === '') continue;
            addNumAttr(parts, k, p[k]);
          }
        }
        if (parts.length > 0) lines.push(`    <Mesh ${parts.join(' ')} />`);
      }
      lines.push('');
    }

    const materialsXml = /** @type {any[]} */ (Array.isArray(sceneAny._materialXml) ? sceneAny._materialXml : []);
    if (materialsXml.length > 0) {
      for (const m of materialsXml) {
        if (!m) continue;
        /** @type {string[]} */
        const parts = [];
        addAttr(parts, 'name', m.name);
        if (m.source) addAttr(parts, 'source', m.source);

        // Inline fields (and optional overrides when source is present): save only non-empty values.
        addAttr(parts, 'baseColorFactor', m.baseColorFactor);
        addAttr(parts, 'metallicFactor', m.metallicFactor);
        addAttr(parts, 'roughnessFactor', m.roughnessFactor);
        addAttr(parts, 'normalScale', m.normalScale);
        addAttr(parts, 'aoStrength', m.aoStrength);
        addAttr(parts, 'emissiveFactor', m.emissiveFactor);
        addAttr(parts, 'alphaMode', m.alphaMode);
        addAttr(parts, 'alphaCutoff', m.alphaCutoff);

        addAttr(parts, 'baseColorTexture', m.baseColorTexture);
        addAttr(parts, 'metallicTexture', m.metallicTexture);
        addAttr(parts, 'roughnessTexture', m.roughnessTexture);
        addAttr(parts, 'normalTexture', m.normalTexture);
        addAttr(parts, 'aoTexture', m.aoTexture);
        addAttr(parts, 'emissiveTexture', m.emissiveTexture);
        addAttr(parts, 'alphaTexture', m.alphaTexture);

        if (parts.length > 0) lines.push(`    <Material ${parts.join(' ')} />`);
      }
      lines.push('');
    }

    const skyboxXml = /** @type {any} */ (sceneAny._skyboxXml || null);
    if (skyboxXml) {
      /** @type {string[]} */
      const parts = [];
      if (skyboxXml.color) addAttr(parts, 'color', skyboxXml.color);
      if (skyboxXml.ambientColor) addAttr(parts, 'ambientColor', skyboxXml.ambientColor);
      if (skyboxXml.source) addAttr(parts, 'source', skyboxXml.source);
      if (skyboxXml.equirectangular) addAttr(parts, 'equirectangular', 'true');
      if (skyboxXml.right) addAttr(parts, 'right', skyboxXml.right);
      if (skyboxXml.left) addAttr(parts, 'left', skyboxXml.left);
      if (skyboxXml.top) addAttr(parts, 'top', skyboxXml.top);
      if (skyboxXml.bottom) addAttr(parts, 'bottom', skyboxXml.bottom);
      if (skyboxXml.front) addAttr(parts, 'front', skyboxXml.front);
      if (skyboxXml.back) addAttr(parts, 'back', skyboxXml.back);
      if (parts.length > 0) {
        lines.push(`    <Skybox ${parts.join(' ')} />`);
        lines.push('');
      }
    }

    // Use loader-preserved ordering when available.
    const ordered = Array.isArray(sceneAny._sourceOrder) ? sceneAny._sourceOrder : null;
    const objsFallback = [];
    if (!ordered) {
      if (Array.isArray(scene.objects)) objsFallback.push(...scene.objects);
      if (Array.isArray(scene.audio)) objsFallback.push(...scene.audio);
      if (Array.isArray(scene.lights)) objsFallback.push(...scene.lights);
    }
    const toWrite = ordered || objsFallback;

    for (const o of toWrite) {
      if (!o) continue;
      // Cameras are emitted from authored state above.
      const cn = String(o?.constructor?.name || '');
      if (cn === 'Camera' || cn === 'Camera3D') continue;
      const block = this._serializeNodeXml(o, 1);
      if (block) lines.push(block);
    }

    lines.push(`</Scene>`);
    // Ensure trailing newline.
    return lines.filter((l, i, arr) => {
      // Keep intentional blank lines but avoid multiple blanks at end.
      if (l !== '') return true;
      // allow blank if next is non-blank and not last
      return i < arr.length - 1 && arr[i + 1] !== '';
    }).join('\n') + '\n';
  },

  /**
   * @param {any} obj
   * @param {number} indentLevel
   * @returns {string|null}
   */
  _serializeNodeXml(obj, indentLevel) {
    const indent = '    '.repeat(Math.max(0, indentLevel));
    /** @param {any} v */
    const esc = (v) => this._xmlEscapeAttr(v);
    /**
     * @param {string[]} parts
     * @param {string} k
     * @param {any} v
     * @param {{ allowEmpty?: boolean }=} opts
     */
    const addAttr = (parts, k, v, opts = {}) => {
      const allowEmpty = !!opts.allowEmpty;
      if (v === undefined || v === null) return;
      const s = String(v);
      if (!allowEmpty && s === '') return;
      parts.push(`${k}="${esc(s)}"`);
    };
    /** @param {string[]} parts @param {string} k @param {any} v */
    const addNumAttr = (parts, k, v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      parts.push(`${k}="${esc(String(n))}"`);
    };
    /** @param {string[]} parts @param {string} k @param {any} v */
    const addBoolAttr = (parts, k, v) => {
      if (v === undefined || v === null) return;
      parts.push(`${k}="${v ? 'true' : 'false'}"`);
    };
    /** @param {string[]} parts @param {any} o */
    const addCommon = (parts, o) => {
      addAttr(parts, 'name', o?.name);

      // Active is capitalized in loader.
      if (Object.prototype.hasOwnProperty.call(o, 'active') && o.active === false) {
        addAttr(parts, 'Active', 'false');
      }

      // followCamera special handling: store x/y as base offsets.
      if (Object.prototype.hasOwnProperty.call(o, 'followCamera') && o.followCamera === true) {
        addBoolAttr(parts, 'followCamera', true);
      }

      // Layer
      if (Object.prototype.hasOwnProperty.call(o, 'layer')) {
        const lv = Number(o.layer);
        if (Number.isFinite(lv)) addNumAttr(parts, 'layer', lv);
      }

      // Opacity (author-facing): 0..1, derived from Sprite transparency (0..255)
      if (typeof o?.transparency === 'number' && Number.isFinite(o.transparency) && o.transparency !== 255) {
        const op = Math.max(0, Math.min(1, Number(o.transparency) / 255));
        // Keep clean integers like 0/1, else keep a few decimals.
        const s = (op === 0 || op === 1) ? String(op) : String(Math.round(op * 1000000) / 1000000);
        addAttr(parts, 'opacity', s);
      }
    };

    const ctor = String(obj?.constructor?.name || '');

    // ClickableArea
    if (ctor === 'ClickableArea' || (obj && obj.width === null && obj.height === null && typeof obj.onClick !== 'undefined')) {
      /** @type {string[]} */
      const parts = [];
      addCommon(parts, obj);
      if (Number.isFinite(Number(obj.x)) && Number(obj.x) !== 0) addNumAttr(parts, 'x', obj.x);
      if (Number.isFinite(Number(obj.y)) && Number(obj.y) !== 0) addNumAttr(parts, 'y', obj.y);
      if (obj.width !== null && obj.width !== undefined) addNumAttr(parts, 'width', obj.width);
      if (obj.height !== null && obj.height !== undefined) addNumAttr(parts, 'height', obj.height);
      return `${indent}<ClickableArea ${parts.join(' ')} />`;
    }

    // Audio
    if (ctor === 'Audio' || (obj && Object.prototype.hasOwnProperty.call(obj, 'autoplay') && Object.prototype.hasOwnProperty.call(obj, 'stopOnSceneChange') && typeof obj.play === 'function')) {
      /** @type {string[]} */
      const parts = [];
      addCommon(parts, obj);
      addAttr(parts, 'src', obj.src);
      addBoolAttr(parts, 'loop', !!obj.loop);
      addBoolAttr(parts, 'autoplay', !!obj.autoplay);
      if (Number.isFinite(Number(obj.volume)) && Number(obj.volume) !== 1) addNumAttr(parts, 'volume', obj.volume);
      if (Object.prototype.hasOwnProperty.call(obj, 'stopOnSceneChange') && obj.stopOnSceneChange === false) {
        addBoolAttr(parts, 'stopOnSceneChange', false);
      }
      return `${indent}<Audio ${parts.join(' ')} />`;
    }

    // Lights
    if (obj && obj.isLight) {
      /** @type {string[]} */
      const parts = [];
      addAttr(parts, 'name', obj.name);

      // Color: store as #RRGGBB for readability when possible.
      const c = obj.color;
      if (Array.isArray(c) && c.length >= 3) {
        const r = Math.max(0, Math.min(255, Math.round((Number(c[0]) || 0) * 255)));
        const g = Math.max(0, Math.min(255, Math.round((Number(c[1]) || 0) * 255)));
        const b = Math.max(0, Math.min(255, Math.round((Number(c[2]) || 0) * 255)));
        /** @param {number} n */
        const toHex2 = (n) => n.toString(16).padStart(2, '0');
        addAttr(parts, 'color', `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`);
      }
      if (Number.isFinite(Number(obj.intensity))) addNumAttr(parts, 'intensity', obj.intensity);

      if (ctor === 'DirectionalLight') {
        if (Array.isArray(obj.direction) && obj.direction.length >= 3) {
          addAttr(parts, 'direction', `${obj.direction[0]},${obj.direction[1]},${obj.direction[2]}`);
        }
        return `${indent}<DirectionalLight ${parts.join(' ')} />`;
      }
      if (ctor === 'PointLight') {
        if (Array.isArray(obj.position) && obj.position.length >= 3) {
          addNumAttr(parts, 'x', obj.position[0]);
          addNumAttr(parts, 'y', obj.position[1]);
          addNumAttr(parts, 'z', obj.position[2]);
        }
        if (Number.isFinite(Number(obj.range)) && Number(obj.range) !== 0) addNumAttr(parts, 'range', obj.range);
        return `${indent}<PointLight ${parts.join(' ')} />`;
      }
      if (ctor === 'SpotLight') {
        if (Array.isArray(obj.position) && obj.position.length >= 3) {
          addNumAttr(parts, 'x', obj.position[0]);
          addNumAttr(parts, 'y', obj.position[1]);
          addNumAttr(parts, 'z', obj.position[2]);
        }
        if (Array.isArray(obj.direction) && obj.direction.length >= 3) {
          addAttr(parts, 'direction', `${obj.direction[0]},${obj.direction[1]},${obj.direction[2]}`);
        }
        if (Number.isFinite(Number(obj.range)) && Number(obj.range) !== 0) addNumAttr(parts, 'range', obj.range);
        if (Number.isFinite(Number(obj.innerAngleDeg))) addNumAttr(parts, 'innerAngleDeg', obj.innerAngleDeg);
        if (Number.isFinite(Number(obj.outerAngleDeg))) addNumAttr(parts, 'outerAngleDeg', obj.outerAngleDeg);
        return `${indent}<SpotLight ${parts.join(' ')} />`;
      }
    }

    // MeshNode
    if (ctor === 'MeshNode' || (obj && obj.renderLayer === 0 && typeof obj.draw3D === 'function')) {
      /** @type {string[]} */
      const parts = [];
      addCommon(parts, obj);
      addNumAttr(parts, 'x', obj.x);
      addNumAttr(parts, 'y', obj.y);
      addNumAttr(parts, 'z', obj.z);
      addNumAttr(parts, 'scaleX', obj.scaleX);
      addNumAttr(parts, 'scaleY', obj.scaleY);
      addNumAttr(parts, 'scaleZ', obj.scaleZ);
      addNumAttr(parts, 'rotX', obj.rotX);
      addNumAttr(parts, 'rotY', obj.rotY);
      addNumAttr(parts, 'rotZ', obj.rotZ);
      addAttr(parts, 'source', obj.source || obj.mesh || 'Cube');

      // Preserve material name even if the loader resolved it to an instance.
      const matName = (typeof obj.materialName === 'string' && obj.materialName)
        ? obj.materialName
        : ((typeof obj.material === 'string' && obj.material) ? obj.material : '');
      if (matName) addAttr(parts, 'material', matName);

      // Optional per-node color.
      if (Array.isArray(obj.color) && obj.color.length >= 3) {
        const r = Math.max(0, Math.min(255, Math.round((Number(obj.color[0]) || 0) * 255)));
        const g = Math.max(0, Math.min(255, Math.round((Number(obj.color[1]) || 0) * 255)));
        const b = Math.max(0, Math.min(255, Math.round((Number(obj.color[2]) || 0) * 255)));
        /** @param {number} n */
        const toHex2 = (n) => n.toString(16).padStart(2, '0');
        addAttr(parts, 'color', `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`);
      }

      // Optional primitive params (only meaningful for direct primitive meshes).
      const p = obj?.meshDefinition?.params;
      if (p && typeof p === 'object') {
        for (const k of ['width', 'height', 'depth', 'size', 'radius', 'subdivisions', 'radialSegments', 'heightSegments', 'capSegments']) {
          if (p[k] === undefined || p[k] === null || p[k] === '') continue;
          addNumAttr(parts, k, p[k]);
        }
      }
      return `${indent}<MeshNode ${parts.join(' ')} />`;
    }

    // Text
    if (ctor === 'Text' || (obj && (typeof obj.textColor === 'string' || typeof obj.textContent === 'string') && typeof obj.updateTexture === 'function')) {
      /** @type {string[]} */
      const parts = [];
      addCommon(parts, obj);
      // followCamera: save base offsets if available.
      if (obj.followCamera) {
        addNumAttr(parts, 'x', Number.isFinite(Number(obj.baseX)) ? obj.baseX : obj.x);
        addNumAttr(parts, 'y', Number.isFinite(Number(obj.baseY)) ? obj.baseY : obj.y);
      } else {
        addNumAttr(parts, 'x', obj.x);
        addNumAttr(parts, 'y', obj.y);
      }
      addAttr(parts, 'text', (typeof obj.text === 'string') ? obj.text : obj.textContent);
      addNumAttr(parts, 'fontSize', obj.fontSize ?? obj._fontSize);
      addAttr(parts, 'fontFamily', obj._fontFamily || obj.fontFamily);
      addAttr(parts, 'color', obj.textColor || obj._textColor);

      const children = Array.isArray(obj.children) ? obj.children.filter(Boolean) : [];
      if (children.length === 0) {
        return `${indent}<Text ${parts.join(' ')} />`;
      }

      const childBlocks = [];
      for (const ch of children) {
        const b = this._serializeNodeXml(ch, indentLevel + 1);
        if (b) childBlocks.push(b);
      }
      if (childBlocks.length === 0) {
        return `${indent}<Text ${parts.join(' ')} />`;
      }
      return `${indent}<Text ${parts.join(' ')}>\n${childBlocks.join('\n')}\n${indent}</Text>`;
    }

    // AnimatedSprite
    if (this._isAnimatedSprite(obj)) {
      /** @type {string[]} */
      const parts = [];
      addCommon(parts, obj);
      // followCamera: save base offsets if available.
      if (obj.followCamera) {
        addNumAttr(parts, 'x', Number.isFinite(Number(obj.baseX)) ? obj.baseX : obj.x);
        addNumAttr(parts, 'y', Number.isFinite(Number(obj.baseY)) ? obj.baseY : obj.y);
      } else {
        addNumAttr(parts, 'x', obj.x);
        addNumAttr(parts, 'y', obj.y);
      }
      addNumAttr(parts, 'width', obj.width);
      addNumAttr(parts, 'height', obj.height);
      addNumAttr(parts, 'frameWidth', obj.frameWidth);
      addNumAttr(parts, 'frameHeight', obj.frameHeight);
      addAttr(parts, 'imageSrc', obj.imageSrc ?? obj.textureKey ?? '', { allowEmpty: true });

      const childLines = [];
      if (obj.animations instanceof Map) {
        for (const [name, anim] of obj.animations.entries()) {
          if (!name || !anim) continue;
          /** @type {string[]} */
          const aParts = [];
          addAttr(aParts, 'name', name);
          const frames = Array.isArray(anim._frameKeys) ? anim._frameKeys : anim.frames;
          if (Array.isArray(frames)) {
            const s = frames.map(f => String(f).trim()).filter(Boolean).join(', ');
            addAttr(aParts, 'frames', s);
          }
          addNumAttr(aParts, 'speed', anim.fps ?? anim.speed ?? 10);
          addBoolAttr(aParts, 'loop', (anim.loop !== false));
          addBoolAttr(aParts, 'autoplay', !!anim.autoplay);
          childLines.push(`${indent}    <Animation ${aParts.join(' ')} />`);
        }
      }

      const children = Array.isArray(obj.children) ? obj.children.filter(Boolean) : [];
      for (const ch of children) {
        const b = this._serializeNodeXml(ch, indentLevel + 1);
        if (b) childLines.push(b);
      }

      if (childLines.length === 0) {
        return `${indent}<AnimatedSprite ${parts.join(' ')} />`;
      }
      return `${indent}<AnimatedSprite ${parts.join(' ')}>\n${childLines.join('\n')}\n${indent}</AnimatedSprite>`;
    }

    // Sprite (generic)
    if (ctor === 'Sprite' || (obj && typeof obj.x === 'number' && typeof obj.y === 'number' && typeof obj.width === 'number' && typeof obj.height === 'number' && (('textureKey' in obj) || ('imageSrc' in obj)))) {
      /** @type {string[]} */
      const parts = [];
      addCommon(parts, obj);
      if (obj.followCamera) {
        addNumAttr(parts, 'x', Number.isFinite(Number(obj.baseX)) ? obj.baseX : obj.x);
        addNumAttr(parts, 'y', Number.isFinite(Number(obj.baseY)) ? obj.baseY : obj.y);
      } else {
        addNumAttr(parts, 'x', obj.x);
        addNumAttr(parts, 'y', obj.y);
      }
      addNumAttr(parts, 'width', obj.width);
      addNumAttr(parts, 'height', obj.height);
      addAttr(parts, 'imageSrc', obj.imageSrc ?? obj.textureKey ?? '', { allowEmpty: true });

      const children = Array.isArray(obj.children) ? obj.children.filter(Boolean) : [];
      if (children.length === 0) {
        return `${indent}<Sprite ${parts.join(' ')} />`;
      }
      const childBlocks = [];
      for (const ch of children) {
        const b = this._serializeNodeXml(ch, indentLevel + 1);
        if (b) childBlocks.push(b);
      }
      if (childBlocks.length === 0) {
        return `${indent}<Sprite ${parts.join(' ')} />`;
      }
      return `${indent}<Sprite ${parts.join(' ')}>\n${childBlocks.join('\n')}\n${indent}</Sprite>`;
    }

    // Unknown node: skip for now.
    return null;
  },

  /** @param {any} v */
  _xmlEscapeAttr(v) {
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
  },

  _openAbout() {
    openAbout(this, ui);
  },

  _openEditorSettings() {
    openEditorSettings(this, ui);
  },

  _closeEditorSettings() {
    closeEditorSettings(this, ui);
  },

  _openAddNode() {
    openAddNode(this, ui);
  },

  _renderAddNodeDialog() {
    renderAddNodeDialog(this, ui);
  },

  /** @param {string} type */
  _addNodeByType(type) {
    const id = String(type);
    if (id === 'Skybox') {
      this._addSkyboxByStub();
      return;
    }
    if (id === 'MeshNode' || id === 'DirectionalLight' || id === 'PointLight' || id === 'SpotLight') {
      this._add3DNodeByType(id);
      return;
    }
    this._add2DNodeByType(id);
  },

  _addSkyboxByStub() {
    const scene = this.currentScene;
    if (!scene) return;

    const r = this._renderer;

    // Project may disable 3D rendering.
    const { allow3D } = this._getProjectRenderEnableFlags();
    if (!allow3D) return;

    // Environment edits are 3D-centric.
    if (this.mode !== '3d') this.setMode('3d');

    const sceneAny = /** @type {any} */ (scene);

    if (!sceneAny._skyboxXml || typeof sceneAny._skyboxXml !== 'object') {
      /** @type {any} */
      const stub = {
        __xmlTag: 'Skybox',
        // Default "basic" skybox is a neutral gray.
        color: '#808080',
        ambientColor: '',
        source: '',
        equirectangular: false,
        right: '',
        left: '',
        top: '',
        bottom: '',
        front: '',
        back: '',
      };

      // Initialize from current renderer state when possible.
      // This makes "Add Skybox" reflect what you're currently seeing.
      /** @param {number} n */
      const toHex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
      /** @param {number} rr @param {number} gg @param {number} bb */
      const rgbToHex = (rr, gg, bb) => `#${toHex2(rr)}${toHex2(gg)}${toHex2(bb)}`;

      if (r) {
        // Ambient (u_ambientColor)
        const ac = Array.isArray(r.pbrAmbientColor) ? r.pbrAmbientColor : null;
        if (ac && ac.length >= 3) {
          const ar = Number(ac[0]);
          const ag = Number(ac[1]);
          const ab = Number(ac[2]);
          if (Number.isFinite(ar) && Number.isFinite(ag) && Number.isFinite(ab)) {
            stub.ambientColor = rgbToHex(ar * 255, ag * 255, ab * 255);
          }
        }

        // Skybox source parameters
        const sb = /** @type {any} */ (r.currentSkybox || null);
        const spec = sb && typeof sb.getSourceSpec === 'function' ? sb.getSourceSpec() : null;

        if (spec && spec.kind === 'color' && Array.isArray(spec.color) && spec.color.length >= 3) {
          const cr = Number(spec.color[0]);
          const cg = Number(spec.color[1]);
          const cb = Number(spec.color[2]);
          if (Number.isFinite(cr) && Number.isFinite(cg) && Number.isFinite(cb)) {
            stub.color = rgbToHex(cr * 255, cg * 255, cb * 255);
          }
        } else if (spec && spec.kind === 'equirectangular') {
          // Color is not meaningful for an equirect skybox.
          stub.color = '';
          if (typeof spec.source === 'string') stub.source = spec.source;
          stub.equirectangular = true;
        } else if (spec && spec.kind === 'cubemap' && Array.isArray(spec.faces) && spec.faces.length === 6) {
          // Color is not meaningful for a cubemap skybox.
          stub.color = '';
          const faces = spec.faces;
          if (typeof faces[0] === 'string') stub.right = faces[0];
          if (typeof faces[1] === 'string') stub.left = faces[1];
          if (typeof faces[2] === 'string') stub.top = faces[2];
          if (typeof faces[3] === 'string') stub.bottom = faces[3];
          if (typeof faces[4] === 'string') stub.front = faces[4];
          if (typeof faces[5] === 'string') stub.back = faces[5];
        }
      }

      sceneAny._skyboxXml = stub;
    } else {
      // Ensure newly-added fields exist for older scenes.
      if (!('ambientColor' in sceneAny._skyboxXml)) sceneAny._skyboxXml.ambientColor = '';
    }

    // Track recents (UI only)
    const id = 'Skybox';
    this._addNodeRecent = [id, ...this._addNodeRecent.filter(x => x !== id)].slice(0, 12);

    this.selected = sceneAny._skyboxXml;
    this.rebuildTree();
    this.rebuildInspector();
    if (this._renderer) this._requestViewportSync(this._renderer);

    this._closeAddNode();
  },

  /** @param {string} type */
  _add2DNodeByType(type) {
    const r = this._renderer;
    const scene = this.currentScene;
    if (!r || !scene) return;

    // Project may disable 2D rendering.
    const { allow2D } = this._getProjectRenderEnableFlags();
    if (!allow2D) return;

    // Adding 2D nodes is only really useful in 2D mode (tree filters by mode).
    if (this.mode !== '2d') this.setMode('2d');

    // Spawn at the current editor camera origin.
    const cam2 = /** @type {any} */ (this._editorCamera2D || this._sceneCamera2D || null);
    const spawnX = Number(cam2?.x) || 0;
    const spawnY = Number(cam2?.y) || 0;

    const iconUrl = String(this._defaultSpriteIconUrl || '').trim();

    /** @param {string} base */
    const uniqueName = (base) => {
      const used = new Set();
      /** @param {any} obj */
      const addName = (obj) => {
        const n = obj?.name ? String(obj.name).trim() : '';
        if (n) used.add(n);
      };
      /** @param {any} obj */
      const visit = (obj) => {
        if (!obj) return;
        addName(obj);
        const kids = Array.isArray(obj.children) ? obj.children : [];
        for (const ch of kids) visit(ch);
      };
      if (Array.isArray(scene.objects)) {
        for (const o of scene.objects) visit(o);
      }
      if (Array.isArray(scene.audio)) {
        for (const a of scene.audio) addName(a);
      }
      const b = String(base || 'Node').trim() || 'Node';
      if (!used.has(b)) return b;
      for (let i = 2; i < 1000; i++) {
        const n = `${b}${i}`;
        if (!used.has(n)) return n;
      }
      return `${b}${Date.now()}`;
    };

    /** @type {any|null} */
    let created = null;

    switch (String(type)) {
      case 'Sprite': {
        const sp = new Sprite(r, iconUrl, spawnX, spawnY, 96, 96);
        // @ts-ignore
        sp.name = uniqueName('Sprite');
        scene.add(sp);
        created = sp;
        break;
      }
      case 'AnimatedSprite': {
        const sp = new AnimatedSprite(r, iconUrl, spawnX, spawnY, 96, 96);
        // @ts-ignore
        sp.name = uniqueName('AnimatedSprite');
        scene.add(sp);
        created = sp;
        break;
      }
      case 'Text': {
        const tx = new Text(r, 'New Text', spawnX, spawnY, 32);
        // @ts-ignore
        tx.name = uniqueName('Text');
        scene.add(tx);
        created = tx;
        break;
      }
      case 'ClickableArea': {
        // ClickableArea is typically used as a child of a Sprite so it has a visible host.
        const host = new Sprite(r, iconUrl, spawnX, spawnY, 120, 120);
        // @ts-ignore
        host.name = uniqueName('ClickableAreaHost');

        const area = new ClickableArea(r);
        // @ts-ignore
        area.name = uniqueName('ClickableArea');
        host.addChild(area);
        scene.add(host);
        created = area;
        break;
      }
      default:
        return;
    }

    // Track recents (UI only)
    const id = String(type);
    this._addNodeRecent = [id, ...this._addNodeRecent.filter(x => x !== id)].slice(0, 12);

    if (created) {
      this.selected = created;
      this.rebuildTree();
      this.rebuildInspector();
      if (this._renderer) this._requestViewportSync(this._renderer);
    }

    this._closeAddNode();
  },

  /** @param {string} type */
  _add3DNodeByType(type) {
    const scene = this.currentScene;
    if (!scene) return;

    // Project may disable 3D rendering.
    const { allow3D } = this._getProjectRenderEnableFlags();
    if (!allow3D) return;

    // Adding 3D nodes is only really useful in 3D mode (tree filters by mode).
    if (this.mode !== '3d') this.setMode('3d');

    // Spawn in front of the current 3D camera.
    const cam3 = /** @type {any} */ (this._editorCamera3D || this._sceneCamera3D || null);
    const px = Number(cam3?.position?.x) || 0;
    const py = Number(cam3?.position?.y) || 0;
    const pz = Number(cam3?.position?.z) || 0;

    const tx = Number(cam3?.target?.x);
    const ty = Number(cam3?.target?.y);
    const tz = Number(cam3?.target?.z);

    let fx = Number.isFinite(tx) ? (tx - px) : 0;
    let fy = Number.isFinite(ty) ? (ty - py) : 0;
    let fz = Number.isFinite(tz) ? (tz - pz) : -1;
    let fl = Math.hypot(fx, fy, fz);
    if (!Number.isFinite(fl) || fl <= 1e-6) {
      fx = 0; fy = 0; fz = -1;
      fl = 1;
    }
    fx /= fl; fy /= fl; fz /= fl;

    const spawnDist = 3;
    const spawnX = px + fx * spawnDist;
    const spawnY = py + fy * spawnDist;
    const spawnZ = pz + fz * spawnDist;

    /** @param {string} base */
    const uniqueName = (base) => {
      const used = new Set();
      /** @param {any} obj */
      const addName = (obj) => {
        const n = obj?.name ? String(obj.name).trim() : '';
        if (n) used.add(n);
      };
      /** @param {any} obj */
      const visit = (obj) => {
        if (!obj) return;
        addName(obj);
        const kids = Array.isArray(obj.children) ? obj.children : [];
        for (const ch of kids) visit(ch);
      };
      if (Array.isArray(scene.objects)) {
        for (const o of scene.objects) visit(o);
      }
      if (Array.isArray(scene.audio)) {
        for (const a of scene.audio) addName(a);
      }
      if (Array.isArray(scene.lights)) {
        for (const l of scene.lights) addName(l);
      }
      const b = String(base || 'Node').trim() || 'Node';
      if (!used.has(b)) return b;
      for (let i = 2; i < 1000; i++) {
        const n = `${b}${i}`;
        if (!used.has(n)) return n;
      }
      return `${b}${Date.now()}`;
    };

    /** @type {any|null} */
    let created = null;

    switch (String(type)) {
      case 'MeshNode': {
        const m = new MeshNode();
        m.name = uniqueName('MeshNode');
        m.setPosition(spawnX, spawnY, spawnZ);
        scene.add(m);
        created = m;
        break;
      }
      case 'DirectionalLight': {
        const l = new DirectionalLight({ name: uniqueName('DirectionalLight') });
        scene.addLight(l);
        created = l;
        break;
      }
      case 'PointLight': {
        const l = new PointLight({ name: uniqueName('PointLight'), position: [spawnX, spawnY, spawnZ] });
        scene.addLight(l);
        created = l;
        break;
      }
      case 'SpotLight': {
        const l = new SpotLight({ name: uniqueName('SpotLight'), position: [spawnX, spawnY, spawnZ] });
        scene.addLight(l);
        created = l;
        break;
      }
      default:
        return;
    }

    // Track recents (UI only)
    const id = String(type);
    this._addNodeRecent = [id, ...this._addNodeRecent.filter(x => x !== id)].slice(0, 12);

    if (created) {
      this.selected = created;
      this.rebuildTree();
      this.rebuildInspector();
      if (this._renderer) this._requestViewportSync(this._renderer);
    }

    this._closeAddNode();
  },

  /** @param {any} obj */
  _isAnimatedSprite(obj) {
    if (!obj) return false;
    if (obj instanceof AnimatedSprite) return true;
    // Fallback for cross-realm/module duplication: heuristic.
    return (obj?.animations instanceof Map) && (typeof obj?.play === 'function') && (typeof obj?.stop === 'function');
  },

  _openAnimSpriteEditor() {
    const obj = this.selected;
    if (!this._isAnimatedSprite(obj)) return;
    if (!ui.animSpriteModal) return;

    this._animSpriteOpen = true;
    this._animSpriteTarget = obj;
    this._animSpriteAnimName = null;
    this._animSpriteFrameIndex = null;

    // Capture prior playback state so the editor can preview frames in the viewport
    // without permanently changing the scene.
    this._animSpritePrevPlayback = {
      animName: (obj && typeof obj.currentAnimationName === 'string') ? obj.currentAnimationName : null,
      frameIndex: Number(obj?.currentFrameIndex) || 0,
      wasPlaying: !!obj?.isPlaying,
    };

    ui.animSpriteModal.hidden = false;
    this._populateAnimSpriteEditor();
    this._closeTopbarMenus();
    ui.animSpriteCloseBtn?.focus();
  },

  _closeAnimSpriteEditor() {
    if (!ui.animSpriteModal) return;

    // Restore prior playback state if possible.
    const sprite = this._animSpriteTarget;
    const prev = this._animSpritePrevPlayback;
    if (this._isAnimatedSprite(sprite) && prev) {
      try {
        if (prev.animName && (sprite.animations instanceof Map) && sprite.animations.has(prev.animName)) {
          sprite.currentAnimationName = prev.animName;
          sprite.currentAnimation = sprite.animations.get(prev.animName);
        }
        const fi = Number(prev.frameIndex);
        sprite.currentFrameIndex = Number.isFinite(fi) ? Math.max(0, Math.trunc(fi)) : 0;
        sprite.isPlaying = !!prev.wasPlaying;
      } catch {}
    }

    this._animSpriteOpen = false;
    this._animSpriteTarget = null;
    this._animSpriteAnimName = null;
    this._animSpriteFrameIndex = null;
    this._animSpritePrevPlayback = null;
    ui.animSpriteModal.hidden = true;
  },

  /** @param {string} msg */
  _setAnimSpriteError(msg) {
    if (!ui.animSpriteError) return;
    ui.animSpriteError.textContent = msg ? String(msg) : '';
  },

  _updateAnimSpriteFramePreview() {
    const sprite = this._animSpriteTarget;
    const animName = this._animSpriteAnimName;

    /** @param {string} label */
    const setEmpty = (label) => {
      if (ui.animSpriteFrameLabel) ui.animSpriteFrameLabel.textContent = label;
      if (ui.animSpriteFramePreview) ui.animSpriteFramePreview.removeAttribute('src');
    };

    if (!this._isAnimatedSprite(sprite) || !animName) {
      setEmpty('No frame');
      return;
    }

    const anims = sprite.animations;
    if (!(anims instanceof Map)) {
      setEmpty('No frame');
      return;
    }

    const anim = anims.get(animName);
    if (!anim || !Array.isArray(anim.frames) || anim.frames.length === 0) {
      setEmpty('No frame');
      return;
    }

    let idx = Number(this._animSpriteFrameIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= anim.frames.length) idx = 0;
    this._animSpriteFrameIndex = idx;

    const frame = anim.frames[idx];
    if (ui.animSpriteFrameLabel) ui.animSpriteFrameLabel.textContent = `Frame ${idx}`;

    if (typeof frame === 'string') {
      const src = String(frame || '').trim();
      if (ui.animSpriteFramePreview) {
        if (src) ui.animSpriteFramePreview.src = src;
        else ui.animSpriteFramePreview.removeAttribute('src');
      }

      // While the editor modal is open, force the sprite to display the selected frame
      // so it's visible in the main viewport.
      if (this._animSpriteOpen && this._isAnimatedSprite(sprite) && (sprite.animations instanceof Map)) {
        const anim = sprite.animations.get(animName);
        if (anim) {
          sprite.currentAnimationName = animName;
          sprite.currentAnimation = anim;
          sprite.currentFrameIndex = idx;
          // Pause playback during manual frame inspection.
          sprite.isPlaying = false;
        }
      }
    } else {
      // Preview is only meaningful for image-path frames.
      if (ui.animSpriteFrameLabel) ui.animSpriteFrameLabel.textContent = `Frame ${idx} (no image preview)`;
      if (ui.animSpriteFramePreview) ui.animSpriteFramePreview.removeAttribute('src');
    }
  },

  _populateAnimSpriteEditor() {
    const sprite = this._animSpriteTarget;
    if (!ui.animSpriteAnimList || !ui.animSpriteFramesStrip || !ui.animSpriteNameInput) return;

    if (!this._isAnimatedSprite(sprite)) {
      if (ui.animSpriteSubtitle) ui.animSpriteSubtitle.textContent = 'No selection';
      ui.animSpriteAnimList.innerHTML = '';
      ui.animSpriteFramesStrip.innerHTML = '';
      ui.animSpriteNameInput.value = '';
      this._animSpriteFrameIndex = null;
      this._updateAnimSpriteFramePreview();
      this._setAnimSpriteError('Select an AnimatedSprite to edit its animations.');
      return;
    }

    const name = sprite?.name ? String(sprite.name) : (sprite?.constructor?.name || 'AnimatedSprite');
    if (ui.animSpriteSubtitle) ui.animSpriteSubtitle.textContent = name;

    const anims = sprite.animations;
    if (!(anims instanceof Map)) {
      ui.animSpriteAnimList.innerHTML = '';
      ui.animSpriteFramesStrip.innerHTML = '';
      ui.animSpriteNameInput.value = '';
      this._setAnimSpriteError('This sprite has no animations map.');
      return;
    }

    /** @type {string[]} */
    const keys = Array.from(anims.keys()).map((k) => String(k));

    const preferred = (sprite.currentAnimationName && anims.has(sprite.currentAnimationName))
      ? String(sprite.currentAnimationName)
      : (keys.length ? keys[0] : null);

    if (!this._animSpriteAnimName || !anims.has(this._animSpriteAnimName)) {
      this._animSpriteAnimName = preferred;
    }

    ui.animSpriteAnimList.innerHTML = '';
    for (const k of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'animListItem' + (k === this._animSpriteAnimName ? ' active' : '');
      btn.textContent = k;
      btn.addEventListener('click', () => {
        this._animSpriteAnimName = k;
        this._animSpriteFrameIndex = null;
        this._populateAnimSpriteEditor();
      });
      ui.animSpriteAnimList.appendChild(btn);
    }

    if (!this._animSpriteAnimName) {
      ui.animSpriteNameInput.value = '';
      ui.animSpriteFramesStrip.innerHTML = '';
      this._animSpriteFrameIndex = null;
      this._updateAnimSpriteFramePreview();
      this._setAnimSpriteError('No animations found on this sprite.');
      return;
    }

    ui.animSpriteNameInput.value = this._animSpriteAnimName;
    this._setAnimSpriteError('');
    this._renderAnimSpriteFrames();
  },

  _applyAnimSpriteRename() {
    const sprite = this._animSpriteTarget;
    if (!this._isAnimatedSprite(sprite)) return;
    if (!ui.animSpriteNameInput) return;
    const anims = sprite.animations;
    if (!(anims instanceof Map)) return;

    const oldName = this._animSpriteAnimName;
    const newName = String(ui.animSpriteNameInput.value || '').trim();
    if (!oldName) return;
    if (!newName) {
      this._setAnimSpriteError('Animation name cannot be empty.');
      ui.animSpriteNameInput.value = oldName;
      return;
    }
    if (newName === oldName) {
      this._setAnimSpriteError('');
      return;
    }
    if (anims.has(newName)) {
      this._setAnimSpriteError('An animation with that name already exists.');
      ui.animSpriteNameInput.value = oldName;
      return;
    }

    const anim = anims.get(oldName);
    if (!anim) return;
    anims.delete(oldName);
    anims.set(newName, anim);

    if (sprite.currentAnimationName === oldName) {
      sprite.currentAnimationName = newName;
    }

    this._animSpriteAnimName = newName;
    this._setAnimSpriteError('');
    this._populateAnimSpriteEditor();
    this.rebuildInspector();
  },

  _renderAnimSpriteFrames() {
    const sprite = this._animSpriteTarget;
    const animName = this._animSpriteAnimName;
    if (!this._isAnimatedSprite(sprite) || !animName) return;
    if (!ui.animSpriteFramesStrip) return;

    const anims = sprite.animations;
    if (!(anims instanceof Map)) return;
    const anim = anims.get(animName);
    if (!anim || !Array.isArray(anim.frames)) {
      ui.animSpriteFramesStrip.innerHTML = '';
      this._setAnimSpriteError('This animation has no frames array.');
      return;
    }

    const frames = anim.frames;
    const isImageFrames = frames.length > 0 && typeof frames[0] === 'string';

    if (frames.length === 0) {
      this._animSpriteFrameIndex = null;
      this._updateAnimSpriteFramePreview();
      return;
    }

    // Default to the sprite's current frame when editing its current animation.
    if (this._animSpriteFrameIndex === null || this._animSpriteFrameIndex === undefined) {
      const preferredIdx = (sprite.currentAnimationName === animName)
        ? Number(sprite.currentFrameIndex)
        : 0;
      this._animSpriteFrameIndex = Number.isFinite(preferredIdx)
        ? Math.max(0, Math.min(frames.length - 1, Math.trunc(preferredIdx)))
        : 0;
    }

    let selectedIndex = Number(this._animSpriteFrameIndex);
    if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= frames.length) selectedIndex = 0;
    this._animSpriteFrameIndex = selectedIndex;
    if (isImageFrames && !Array.isArray(anim.images)) {
      anim.images = new Array(frames.length).fill(null);
    }
    if (isImageFrames && !Array.isArray(anim._frameKeys)) {
      anim._frameKeys = frames.slice();
    }

    ui.animSpriteFramesStrip.className = isImageFrames
      ? 'framesStrip framesStripImage'
      : 'framesStrip framesStripGrid';
    ui.animSpriteFramesStrip.innerHTML = '';

    /** @param {number} index */
    const ensureImage = (index) => {
      const src = String(frames[index] || '');
      if (!src) return;
      if (sprite.renderer?.hasCachedTexture?.(src)) {
        anim.images[index] = sprite.renderer.acquireTexture?.(src) || sprite.renderer.getCachedTexture?.(src) || anim.images[index];
        return;
      }

      const img = new Image();
      const loadPromise = new Promise((resolve) => {
        img.onload = () => {
          if (sprite._disposed) {
            resolve(false);
            return;
          }
          anim.images[index] = sprite.renderer?.createAndAcquireTexture?.(img, src) || sprite.renderer?.createTexture?.(img, src) || null;
          resolve(true);
        };
        img.onerror = () => resolve(false);
      });
      sprite.renderer?.trackAssetPromise?.(loadPromise);
      img.src = src;
    };

    for (let i = 0; i < frames.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'frameCell' + (i === selectedIndex ? ' active' : '');
      cell.dataset.index = String(i);
      cell.addEventListener('click', () => {
        this._animSpriteFrameIndex = i;
        const strip = ui.animSpriteFramesStrip;
        if (strip) {
          for (const el of Array.from(strip.children)) {
            if (!(el instanceof HTMLElement)) continue;
            el.classList.toggle('active', el.dataset.index === String(i));
          }
        }
        this._updateAnimSpriteFramePreview();
      });

      const idx = document.createElement('div');
      idx.className = 'frameIdx';
      idx.textContent = `Frame ${i}`;
      cell.appendChild(idx);

      const frame = frames[i];

      if (typeof frame === 'number') {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '1';
        input.value = String(frame);
        input.addEventListener('input', () => {
          const v = Number(input.value);
          if (!Number.isFinite(v)) return;
          frames[i] = Math.trunc(v);
        });
        cell.appendChild(input);
      } else if (typeof frame === 'string') {
        const thumb = document.createElement('img');
        thumb.className = 'frameThumb';
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        thumb.alt = `Frame ${i}`;
        thumb.src = String(frame);
        cell.appendChild(thumb);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = String(frame);
        input.placeholder = 'image path';
        input.addEventListener('input', () => {
          const v = String(input.value || '').trim();
          frames[i] = v;
          if (Array.isArray(anim._frameKeys)) anim._frameKeys[i] = v;
          if (Array.isArray(anim.images)) anim.images[i] = null;
          thumb.src = v;
          if (this._animSpriteFrameIndex === i) this._updateAnimSpriteFramePreview();
        });
        input.addEventListener('change', () => {
          // Re-load texture on commit.
          ensureImage(i);
        });
        cell.appendChild(input);
      } else if (frame && typeof frame === 'object') {
        const fx = document.createElement('input');
        fx.type = 'number';
        fx.step = '1';
        fx.value = String(Number(frame.x) || 0);
        fx.placeholder = 'x';

        const fy = document.createElement('input');
        fy.type = 'number';
        fy.step = '1';
        fy.value = String(Number(frame.y) || 0);
        fy.placeholder = 'y';

        const fw = document.createElement('input');
        fw.type = 'number';
        fw.step = '1';
        fw.value = String(Number(frame.w ?? frame.width) || 0);
        fw.placeholder = 'w';

        const fh = document.createElement('input');
        fh.type = 'number';
        fh.step = '1';
        fh.value = String(Number(frame.h ?? frame.height) || 0);
        fh.placeholder = 'h';

        const applyObj = () => {
          const nx = Number(fx.value);
          const ny = Number(fy.value);
          const nw = Number(fw.value);
          const nh = Number(fh.value);
          if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || !Number.isFinite(nh)) return;
          frames[i] = { x: Math.trunc(nx), y: Math.trunc(ny), w: Math.trunc(nw), h: Math.trunc(nh) };
        };
        fx.addEventListener('input', applyObj);
        fy.addEventListener('input', applyObj);
        fw.addEventListener('input', applyObj);
        fh.addEventListener('input', applyObj);

        cell.appendChild(fx);
        cell.appendChild(fy);
        cell.appendChild(fw);
        cell.appendChild(fh);
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '';
        input.placeholder = 'frame';
        input.addEventListener('input', () => {
          frames[i] = String(input.value || '');
        });
        cell.appendChild(input);
      }

      ui.animSpriteFramesStrip.appendChild(cell);
    }

    this._updateAnimSpriteFramePreview();
  },

  _closeAbout() {
    closeAbout(this, ui);
  },

  _closeAddNode() {
    closeAddNode(this, ui);
  },

  /** @param {Renderer} renderer */
  _setupEditorCameraInput(renderer) {
    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('gameCanvas'));
    if (!canvas) return;

    this._editorPointerLockCanvas = canvas;

    // Unity-like FPS camera: while holding RMB in 3D view, lock the mouse (pointer lock)
    // so mouse movement uses movementX/movementY and the cursor can't leave the viewport.
    try {
      const onLockChange = () => {
        this._editorPointerLocked = (document.pointerLockElement === canvas);
      };
      document.addEventListener('pointerlockchange', onLockChange);
      onLockChange();

      canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 2) return;
        if (this.mode !== '3d') return;

        // Only if the click started inside the canvas bounds.
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX, y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

        e.preventDefault();
        canvas.requestPointerLock?.();
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button !== 2) return;
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      });

      window.addEventListener('blur', () => {
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
      });
    } catch {
      // Pointer lock may be unavailable; controls will still work without it.
    }

    // Avoid the browser context menu when using RMB orbit.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse wheel zoom (2D zoom / 3D dolly).
    canvas.addEventListener('wheel', (e) => {
      // Only when hovering canvas.
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

      e.preventDefault();
      this._wheelDeltaY += e.deltaY;
    }, { passive: false });

    // 2D picking: click in the viewport to select the topmost 2D object.
    // Uses renderer.screenToWorld so it matches the engine camera math.
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.mode !== '2d') return;
      if (this._gizmo.active) return;

      const scene = this.currentScene;
      const cam2 = /** @type {any} */ (scene?.camera);
      if (!scene || !cam2 || !renderer || typeof renderer.screenToWorld !== 'function') return;

      // Only if click started inside the canvas bounds.
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;

      const picked = this._pick2DObjectAt(x, y, cam2);
      this.selected = picked;
      this.rebuildTree();
      this.rebuildInspector();
      if (this._renderer) this._requestViewportSync(this._renderer);
    });
  },

  /**
   * Pick the topmost 2D object under the given screen position.
   * @param {number} screenX
   * @param {number} screenY
   * @param {any} cam2
   */
  _pick2DObjectAt(screenX, screenY, cam2) {
    const r = this._renderer;
    const scene = this.currentScene;
    if (!r || !scene || typeof r.screenToWorld !== 'function') return null;

    const world = r.screenToWorld(screenX, screenY, cam2);
    const wx = Number(world?.x) || 0;
    const wy = Number(world?.y) || 0;

    /** @type {any[]} */
    const flat = [];
    /** @param {any} o */
    const visit = (o) => {
      if (!o) return;
      flat.push(o);
      if (Array.isArray(o.children)) {
        for (const c of o.children) visit(c);
      }
    };
    if (Array.isArray(scene.objects)) {
      for (const o of scene.objects) visit(o);
    }

    let best = null;
    let bestLayer = -Infinity;
    let bestOrder = -Infinity;

    for (let i = 0; i < flat.length; i++) {
      const o = flat[i];
      if (!o) continue;
      // Only consider 2D objects for 2D picking.
      if (!this._matchesMode(o)) continue;
      if (o.visible === false || o.active === false) continue;

      const hasXY = (typeof o.x === 'number') && (typeof o.y === 'number');
      const hasWH = (typeof o.width === 'number') && (typeof o.height === 'number');
      if (!hasXY || !hasWH) continue;

      const ox = Number(o.x) || 0;
      const oy = Number(o.y) || 0;
      const ow = Number(o.width) || 0;
      const oh = Number(o.height) || 0;

      // Allow negative sizes (some draw paths can use negative width/height).
      const x1 = ox;
      const y1 = oy;
      const x2 = ox + ow;
      const y2 = oy + oh;
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      const hit = (wx >= minX && wx <= maxX && wy >= minY && wy <= maxY);
      if (!hit) continue;

      const layer = (o.layer !== undefined) ? (Number(o.layer) || 0) : 0;
      // Tie-break by traversal order (later wins). This also works for children.
      const order = i;

      if (layer > bestLayer || (layer === bestLayer && order >= bestOrder)) {
        best = o;
        bestLayer = layer;
        bestOrder = order;
      }
    }

    return best;
  },

  _applyRenderLayers() {
    const r = this._renderer;
    if (!r || typeof r.setRenderLayerEnabled !== 'function') return;

    // Respect project settings (if available) AND editor mode.
    const meta = this._projectMeta;
    const allow2D = (meta && typeof meta.enable2D === 'boolean') ? meta.enable2D : true;
    const allow3D = (meta && typeof meta.enable3D === 'boolean') ? meta.enable3D : true;

    // Exclusive: 2D mode shows only 2D pass, 3D mode shows only 3D pass, but also respect project disable flags.
    r.setRenderLayerEnabled(0, this.mode === '3d' && allow3D);
    r.setRenderLayerEnabled(1, this.mode === '2d' && allow2D);
  },

  _getProjectRenderEnableFlags() {
    const meta = this._projectMeta;
    const allow2D = (meta && typeof meta.enable2D === 'boolean') ? meta.enable2D : true;
    const allow3D = (meta && typeof meta.enable3D === 'boolean') ? meta.enable3D : true;
    return { allow2D, allow3D };
  },

  _applyModeAvailability() {
    const { allow2D, allow3D } = this._getProjectRenderEnableFlags();

    // If only one mode is available, hide the mode switch buttons.
    const canSwitch = !!(allow2D && allow3D);
    if (ui.mode2dBtn) ui.mode2dBtn.style.display = canSwitch ? '' : 'none';
    if (ui.mode3dBtn) ui.mode3dBtn.style.display = canSwitch ? '' : 'none';

    // Clamp current mode to an allowed one.
    if (this.mode === '2d' && !allow2D && allow3D) this.setMode('3d');
    else if (this.mode === '3d' && !allow3D && allow2D) this.setMode('2d');

    // Add Node should be available if either pipeline is enabled.
    if (!allow2D && !allow3D && this._addNodeOpen) this._closeAddNode();
  },

  /** @param {Renderer} renderer */
  _setupViewportResize(renderer) {
    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('gameCanvas'));
    if (!canvas || typeof ResizeObserver === 'undefined') {
      // Fallback: at least respond to window resize.
      window.addEventListener('resize', () => renderer.resizeCanvas());
      return;
    }

    let queued = false;
    const requestResize = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        // Layout-driven canvases can settle a frame later (scrollbars/panels/etc).
        // Use the editor's multi-pass sync to avoid viewport/letterbox drift.
        this._requestViewportSync(renderer);
      });
    };

    // Observe both the canvas and its parent viewport container.
    const ro = new ResizeObserver(() => requestResize());
    ro.observe(canvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Also respond to window DPI changes / resizes.
    window.addEventListener('resize', () => requestResize());

    // Initial sizing pass.
    requestResize();
  },

  /**
   * Re-sync the WebGL viewport after opening a scene.
   * This handles cases where UI/layout changes (tree/inspector) settle a frame later,
   * which can otherwise leave the letterboxed viewport offset.
   * @param {Renderer} renderer
   */
  _requestViewportSync(renderer) {
    const r = renderer;
    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('gameCanvas'));
    if (!r || !canvas) return;

    let attempts = 0;
    let lastW = -1;
    let lastH = -1;

    const step = () => {
      attempts++;
      const w = canvas.clientWidth | 0;
      const h = canvas.clientHeight | 0;

      // If the canvas is layout-driven and currently has no size, wait until the next frame.
      if (r.respectCssSize && (w <= 0 || h <= 0)) {
        if (attempts < 10) requestAnimationFrame(step);
        return;
      }

      // Apply resize/viewport math and keep camera logical size in sync.
      r.resizeCanvas();
      this._syncActiveCameraSizes();

      // If the canvas size is still changing due to layout, run a couple more passes.
      const changed = (w !== lastW || h !== lastH);
      lastW = w;
      lastH = h;
      if (attempts < 3 && changed) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  },

  _syncActiveCameraSizes() {
    const r = this._renderer;
    const scene = this.currentScene;
    if (!r || !scene) return;

    const cam2 = scene.camera;
    if (cam2 && typeof cam2.setSize === 'function') {
      // If the authored scene camera specified a logical resolution (XML width/height),
      // keep it stable in the editor. Only fall back to renderer target resolution when
      // no explicit camera size was provided.
      const authored = this._sceneCamera2D;
      const aw = Number(authored?.width);
      const ah = Number(authored?.height);
      const hasAuthoredSize = Number.isFinite(aw) && Number.isFinite(ah) && aw > 0 && ah > 0;
      const w = hasAuthoredSize ? aw : (r.targetWidth || 0);
      const h = hasAuthoredSize ? ah : (r.targetHeight || 0);
      cam2.setSize(w, h);
    }
  },

  _freezeAnimatedSpritesOnSceneOpen() {
    const scene = this.currentScene;
    if (!scene || !Array.isArray(scene.objects)) return;

    /** @param {any} o */
    const visit = (o) => {
      if (!o) return;

      if (this._isAnimatedSprite(o) && (o.animations instanceof Map) && o.animations.size > 0) {
        // Pick a stable default animation.
        let name = (typeof o.currentAnimationName === 'string' && o.currentAnimationName) ? o.currentAnimationName : '';
        if (!name || !o.animations.has(name)) {
          for (const k of o.animations.keys()) { name = k; break; }
        }

        if (name && o.animations.has(name)) {
          const anim = o.animations.get(name);
          o.currentAnimationName = name;
          o.currentAnimation = anim;
          o.currentFrameIndex = 0;
          o.timer = 0;
          o.isPlaying = false;
          if (anim) {
            o.loop = !!anim.loop;
            o.fps = Number(anim.fps) || o.fps;
          }
        }
      }

      if (Array.isArray(o.children)) {
        for (const c of o.children) visit(c);
      }
    };

    for (const o of scene.objects) visit(o);
  },

  /** @param {any} cam2 @param {any|null|undefined} sceneCam2 */
  _draw2DViewportOverlay(cam2, sceneCam2) {
    const r = this._renderer;
    const scene = this.currentScene;
    if (!r || !scene) return;
    const dbg = r.debug;
    if (!dbg) return;

    const zoom = Math.max(0.0001, Number(cam2?.zoom) || 1);
    const qScale = Number.isFinite(Number(r.renderScale)) ? Number(r.renderScale) : 1;
    // Supersample debug text when zoomed in to keep it sharp.
    const textPpu = Math.max(1, Math.min(4, zoom * qScale));
    const left = Number(cam2?.x) || 0;
    const top = Number(cam2?.y) || 0;
    const w = (r.targetWidth || 0) / zoom;
    const h = (r.targetHeight || 0) / zoom;
    if (w <= 0 || h <= 0) return;

    const right = left + w;
    const bottom = top + h;

    const g2 = this._editorSettings?.grid2d;
    const drawGrid = !!(g2 && g2.enabled);

    // Grid settings (approximate Godot 2D editor feel)
    // IMPORTANT: adapt spacing to zoom to avoid drawing thousands of lines when zoomed out.
    const baseMinor = Math.max(0.0001, Number(g2?.baseMinor) || 32);
    const minGridPx = Math.max(1, Number(g2?.minGridPx) || 10);
    const maxGridLines = Math.max(10, Math.floor(Number(g2?.maxGridLines) || 240));
    const majorMul = Math.max(1, Math.floor(Number(g2?.majorMultiplier) || 2));

    let minor = baseMinor;
    // Keep minor spacing readable (>= minGridPx) when zoomed out.
    while (minor * zoom < minGridPx) minor *= 2;
    // Safety cap: if viewport covers a huge world span, increase minor further.
    while ((w / minor) > maxGridLines || (h / minor) > maxGridLines) minor *= 2;

    const major = minor * majorMul;
    const startX = Math.floor(left / minor) * minor;
    const endX = Math.ceil(right / minor) * minor;
    const startY = Math.floor(top / minor) * minor;
    const endY = Math.ceil(bottom / minor) * minor;

    const cMinor = [255, 255, 255, 24];
    const cMajor = [255, 255, 255, 46];
    const cAxis = [120, 200, 255, 110];
    const cFrame = [160, 180, 255, 180];
    const cCam = [255, 230, 120, 230];
    const cSceneFrame = [140, 255, 140, 170];
    const cSceneCam = [140, 255, 140, 220];
    const cText = [220, 220, 220, 200];

    // Grid lines
    if (drawGrid) {
      const showAxes = !!(g2 && g2.showAxes);
      for (let x = startX; x <= endX; x += minor) {
        const isAxis = showAxes && x === 0;
        const isMajor = (x % major) === 0;
        dbg.drawLine(x, startY, x, endY, isAxis ? cAxis : (isMajor ? cMajor : cMinor), 1);
      }
      for (let y = startY; y <= endY; y += minor) {
        const isAxis = showAxes && y === 0;
        const isMajor = (y % major) === 0;
        dbg.drawLine(startX, y, endX, y, isAxis ? cAxis : (isMajor ? cMajor : cMinor), 1);
      }
    }

    // Camera frame (current viewport in world space)
    dbg.drawRect(left, top, w, h, cFrame, 2, false);

    // "CAM" marker at the frame origin (top-left)
    const camMark = 10 / zoom;
    dbg.drawLine(left - camMark, top, left + camMark, top, cCam, 2);
    dbg.drawLine(left, top - camMark, left, top + camMark, cCam, 2);
    // Text is CPU-expensive (generates textures). When zoomed out (or low render scale), reduce labels.
    const showRulerLabels = (zoom * qScale) >= 0.25;
    dbg.drawText('CAM', left + (14 / zoom), top + (8 / zoom), cCam, Math.max(8, Math.min(32, 12 / zoom)), textPpu);

    // Also show the scene's authored 2D camera ("MainCamera") if present.
    if (sceneCam2 && sceneCam2 !== cam2 && (typeof sceneCam2.x === 'number' || typeof sceneCam2.y === 'number') && typeof sceneCam2.zoom === 'number') {
      const z2 = Math.max(0.0001, Number(sceneCam2.zoom) || 1);
      const l2 = Number(sceneCam2.x) || 0;
      const t2 = Number(sceneCam2.y) || 0;
      const w2 = (r.targetWidth || 0) / z2;
      const h2 = (r.targetHeight || 0) / z2;
      if (w2 > 0 && h2 > 0) {
        dbg.drawRect(l2, t2, w2, h2, cSceneFrame, 2, false);
        const mk = 10 / zoom;
        dbg.drawLine(l2 - mk, t2, l2 + mk, t2, cSceneCam, 2);
        dbg.drawLine(l2, t2 - mk, l2, t2 + mk, cSceneCam, 2);
        if (showRulerLabels) {
          dbg.drawText('MainCamera', l2 + (14 / zoom), t2 + (8 / zoom), cSceneCam, Math.max(8, Math.min(32, 12 / zoom)), textPpu);
        }
      }
    }

    // Rulers (simple ticks + labels along top/left of the viewport)
    const tickMinor = 6 / zoom;
    const tickMajor = 12 / zoom;
    const labelSize = Math.max(8, Math.min(32, 12 / zoom));

    // Reduce label density when zoomed out (debug text is relatively expensive).
    const minLabelPx = 90;
    let labelStep = major;
    while (labelStep * zoom < minLabelPx) labelStep *= 2;

    // Top ruler
    for (let x = startX; x <= right; x += minor) {
      const isMajor = (x % major) === 0;
      const t = isMajor ? tickMajor : tickMinor;
      dbg.drawLine(x, top, x, top + t, cText, 1);
      if (showRulerLabels && isMajor && (x % labelStep) === 0) {
        dbg.drawText(String(x), x + (2 / zoom), top + (t + 2 / zoom), cText, labelSize, textPpu);
      }
    }

    // Left ruler
    for (let y = startY; y <= bottom; y += minor) {
      const isMajor = (y % major) === 0;
      const t = isMajor ? tickMajor : tickMinor;
      dbg.drawLine(left, y, left + t, y, cText, 1);
      if (showRulerLabels && isMajor && (y % labelStep) === 0) {
        dbg.drawText(String(y), left + (t + 2 / zoom), y + (2 / zoom), cText, labelSize, textPpu);
      }
    }
  },

  /** @param {any} cam2 */
  _update2DViewportQuality(cam2) {
    const r = this._renderer;
    if (!r || typeof r.setRenderScale !== 'function') return;

    // Editor: keep viewport resolution stable (no auto downscaling).
    // Scene loads can change camera zoom; dynamic scaling would otherwise make the viewport
    // appear to change resolution when opening a scene.
    if (this._viewportQuality.scale !== 1) this._viewportQuality.scale = 1;
    if (Number(r.renderScale) !== 1) {
      r.setRenderScale(1.0);
      r.resizeCanvas();
      this._syncActiveCameraSizes();
    }
  },

  /** @param {'2d' | '3d'} mode */
  setMode(mode) {
    const { allow2D, allow3D } = this._getProjectRenderEnableFlags();
    if (mode === '2d' && !allow2D && allow3D) mode = '3d';
    else if (mode === '3d' && !allow3D && allow2D) mode = '2d';
    else if ((mode === '2d' && !allow2D) || (mode === '3d' && !allow3D)) return;

    if (this.mode === mode) return;
    this.mode = mode;

    this._applyRenderLayers();

    // Keep full resolution in both modes inside the editor.
    const r = this._renderer;
    if (r && typeof r.setRenderScale === 'function') {
      r.setRenderScale(1.0);
      r.resizeCanvas();
      this._syncActiveCameraSizes();
    }

    if (ui.mode2dBtn && ui.mode3dBtn) {
      ui.mode2dBtn.classList.toggle('active', mode === '2d');
      ui.mode3dBtn.classList.toggle('active', mode === '3d');
      ui.mode2dBtn.setAttribute('aria-selected', mode === '2d' ? 'true' : 'false');
      ui.mode3dBtn.setAttribute('aria-selected', mode === '3d' ? 'true' : 'false');
    }

    // Pick a default selection that matches the mode.
    this.selected = this._pickDefaultSelectionForMode();
    this.rebuildTree();
    this.rebuildInspector();
  },

  /** @param {Renderer} renderer */
  async loadSelectedScene(renderer) {
    const path = this._scenePath;

    // Editor: reset environment defaults on load so settings don't leak between scenes.
    if (renderer) {
      renderer.pbrAmbientColor = [0.03, 0.03, 0.03];
      if (typeof renderer.setSkybox === 'function') renderer.setSkybox(null);
    }

    if (!path) {
      const empty = new Scene();
      empty.name = 'Empty Scene';

      // New scenes should include an authored 2D camera so saving produces a usable scene.
      // The editor will still render using its own editor camera.
      try {
        const r = this._renderer || renderer;
        const w = Math.max(1, Number(r?.targetWidth) || 1920);
        const h = Math.max(1, Number(r?.targetHeight) || 1080);
        const cam2 = new Camera(0, 0, 1, 0, w, h);
        // @ts-ignore - scenes often treat cameras as named objects
        cam2.name = 'MainCamera';
        cam2.active = true;
        // Store as the scene's authored camera.
        // @ts-ignore
        empty.camera = cam2;
      } catch {}

      this.currentScene = empty;
    } else {
      this.currentScene = await SceneLoader.load(path, renderer);
    }

    this._ensureEditorCameras();

    // Editor: don't autoplay AnimatedSprites when opening scenes.
    // Keep them on their default animation's first frame until explicitly played.
    this._freezeAnimatedSpritesOnSceneOpen();

    // Ensure viewport resolution doesn't change due to scene camera zoom or editor heuristics.
    if (renderer && typeof renderer.setRenderScale === 'function') {
      renderer.setRenderScale(1.0);
      renderer.resizeCanvas();
      this._syncActiveCameraSizes();
    }

    // Default selection follows editor mode.
    this.selected = path ? this._pickDefaultSelectionForMode() : null;

    this.rebuildTree();
    this.rebuildInspector();

    // Final pass after UI/layout updates settle.
    this._requestViewportSync(renderer);
  },

  _ensureEditorCameras() {
    const scene = this.currentScene;
    const r = this._renderer;
    if (!scene || !r) return;

    // Store authored cameras (if any), but always render using editor cameras.
    this._sceneCamera2D = scene.camera || null;
    this._sceneCamera3D = scene.camera3D || null;

    const authoredW = Number(this._sceneCamera2D?.width);
    const authoredH = Number(this._sceneCamera2D?.height);
    const hasAuthoredSize = Number.isFinite(authoredW) && Number.isFinite(authoredH) && authoredW > 0 && authoredH > 0;
    const desiredCamW = hasAuthoredSize ? authoredW : (r.targetWidth || 0);
    const desiredCamH = hasAuthoredSize ? authoredH : (r.targetHeight || 0);

    // In the editor, the canvas is embedded in a resizable panel.
    // To avoid stretched scenes (especially fixed-resolution UI scenes), letterbox to the authored camera aspect.
    if (r) {
      r.maintainAspectRatio = true;
      // IMPORTANT: renderer shaders use targetWidth/targetHeight as the logical world resolution.
      // If we only change aspect ratio but keep targetWidth/Height at the engine defaults (e.g. 1280x720),
      // 2D scenes authored for 1920x1080 will appear offset (often “pushed down”).
      const logicW = (Number.isFinite(desiredCamW) && desiredCamW > 0) ? desiredCamW : Number(r.targetWidth) || 0;
      const logicH = (Number.isFinite(desiredCamH) && desiredCamH > 0) ? desiredCamH : Number(r.targetHeight) || 0;
      if (Number.isFinite(logicW) && Number.isFinite(logicH) && logicW > 0 && logicH > 0) {
        r.targetWidth = logicW;
        r.targetHeight = logicH;
        r.targetAspectRatio = logicW / logicH;
      }
    }

    if (!this._editorCamera2D) {
      const cam2 = new Camera(0, 0, 1, 0, desiredCamW, desiredCamH);
      // @ts-ignore - scenes often treat cameras as named objects
      cam2.name = 'EditorCamera2D';
      cam2.active = true;
      this._editorCamera2D = cam2;
    } else {
      // Update editor camera logical size to match authored camera (if provided).
      if (typeof this._editorCamera2D.setSize === 'function') {
        this._editorCamera2D.setSize(desiredCamW, desiredCamH);
      } else {
        // @ts-ignore
        this._editorCamera2D.width = desiredCamW;
        // @ts-ignore
        this._editorCamera2D.height = desiredCamH;
      }
    }

    // When opening a scene, initialize the editor camera transform from the authored scene camera
    // so the viewport isn't visually offset compared to the game.
    if (this._sceneCamera2D && this._editorCamera2D) {
      // @ts-ignore
      this._editorCamera2D.x = Number(this._sceneCamera2D.x) || 0;
      // @ts-ignore
      this._editorCamera2D.y = Number(this._sceneCamera2D.y) || 0;
      // @ts-ignore
      this._editorCamera2D.zoom = Math.max(0.0001, Number(this._sceneCamera2D.zoom) || 1);
      // @ts-ignore
      this._editorCamera2D.rotation = Number(this._sceneCamera2D.rotation) || 0;
    }

    if (!this._editorCamera3D) {
      const cam3 = new Camera3D();
      // @ts-ignore - scenes often treat cameras as named objects
      cam3.name = 'EditorCamera3D';
      this._editorCamera3D = cam3;
    }

    // Reset FP state per scene load (simple + predictable).
    this._editorCam3DState.yaw = 0;
    this._editorCam3DState.pitch = 0;
    this._editorCam3DState.yawTarget = 0;
    this._editorCam3DState.pitchTarget = 0;
    this._editorCamera3D.position.x = 0;
    this._editorCamera3D.position.y = 1.5;
    this._editorCamera3D.position.z = 6;
    this._editorCam3DState.posTarget.x = this._editorCamera3D.position.x;
    this._editorCam3DState.posTarget.y = this._editorCamera3D.position.y;
    this._editorCam3DState.posTarget.z = this._editorCamera3D.position.z;
    this._updateEditorCamera3DTarget(this._editorCamera3D);

    // Force the scene to render using editor cameras.
    scene.setCamera(this._editorCamera2D);
    scene.setCamera3D(this._editorCamera3D);
    this._usingEditorCamera2D = true;
    this._usingEditorCamera3D = true;

    this._syncActiveCameraSizes();

    // Recompute viewport with the updated camera/aspect settings.
    this._requestViewportSync(r);
  },

  /** @param {import("../../Fluxion/Core/Camera3D.js").default} cam3 */
  _updateEditorCamera3DTarget(cam3) {
    const st = this._editorCam3DState;
    const yaw = st.yaw;
    const pitch = st.pitch;

    // Forward vector (yaw around Y, pitch around X). yaw=0 looks down -Z.
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const fx = cp * sy;
    const fy = sp;
    const fz = -cp * cy;

    cam3.target.x = cam3.position.x + fx;
    cam3.target.y = cam3.position.y + fy;
    cam3.target.z = cam3.position.z + fz;
    cam3._dirty = true;
  },

  /** @param {number} dt */
  _updateEditorCamera(dt) {
    const scene = this.currentScene;
    const r = this._renderer;
    const input = this._input;
    if (!scene || !r || !input) return;

    // Don't move camera while dragging gizmos.
    if (this._gizmo.active) {
      this._wheelDeltaY = 0;
      return;
    }

    const mouse = input.getMousePosition();
    const pointerLocked = !!(this._editorPointerLockCanvas && document.pointerLockElement === this._editorPointerLockCanvas);
    const overCanvas = pointerLocked || this._isPointInCanvas(mouse.x, mouse.y);
    if (!overCanvas) {
      this._wheelDeltaY = 0;
      return;
    }

    // Apply wheel zoom (batched).
    const wheel = this._wheelDeltaY;
    this._wheelDeltaY = 0;

    if (this.mode === '2d') {
      const cam2 = /** @type {any} */ (scene.camera || scene.getObjectByName?.('MainCamera'));
      if (!cam2) return;

      // Pan with middle mouse drag.
      if (input.getMouseButton(1)) {
        const md = input.getMouseDelta();
        const z = Number(cam2.zoom) || 1;
        // Drag direction: move camera opposite mouse delta.
        if (typeof cam2.x === 'number') cam2.x -= md.x / z;
        if (typeof cam2.y === 'number') cam2.y -= md.y / z;
      }

      // Zoom with wheel.
      if (wheel !== 0 && typeof cam2.zoom === 'number') {
        const zoomFactor = wheel > 0 ? (1 / 1.1) : 1.1;
        const next = Math.max(0.05, Math.min(50, cam2.zoom * zoomFactor));
        cam2.zoom = next;
      }

      // Dynamic quality scaling based on zoom.
      this._update2DViewportQuality(cam2);

      return;
    }

    // 3D editor navigation (scene.camera3D is forced to the editor camera).
    const cam3 = /** @type {any} */ (scene.camera3D);
    if (!cam3 || !this._usingEditorCamera3D) return;

    const st = this._editorCam3DState;
    // Back-compat if state was created before smoothing fields existed.
    if (typeof st.yawTarget !== 'number') st.yawTarget = Number(st.yaw) || 0;
    if (typeof st.pitchTarget !== 'number') st.pitchTarget = Number(st.pitch) || 0;
    if (!st.posTarget || typeof st.posTarget !== 'object') st.posTarget = { x: cam3.position.x, y: cam3.position.y, z: cam3.position.z };
    if (!Number.isFinite(Number(st.smoothTimeRot))) st.smoothTimeRot = 0.06;
    if (!Number.isFinite(Number(st.smoothTimePos))) st.smoothTimePos = 0.05;

    const key = (/** @type {string} */ k) => input.getKey(k) || input.getKey(String(k).toUpperCase());
    const isRmb = input.getMouseButton(2);
    const isMmb = input.getMouseButton(1);

    /** @type {(a: number, b: number, t: number) => number} */
    const lerp = (a, b, t) => a + (b - a) * t;
    /** @type {(a: number, b: number, t: number) => number} */
    const lerpAngle = (a, b, t) => {
      // Shortest path around the circle.
      const twoPi = Math.PI * 2;
      let d = (b - a) % twoPi;
      if (d > Math.PI) d -= twoPi;
      if (d < -Math.PI) d += twoPi;
      return a + d * t;
    };
    /** @type {(smoothTime: number) => number} */
    const smoothAlpha = (smoothTime) => {
      const t = Math.max(0, Number(dt) || 0);
      const st = Math.max(0.0001, Number(smoothTime) || 0.05);
      // Exponential smoothing: stable across framerates.
      return 1 - Math.exp(-t / st);
    };

    // Mouse look (hold RMB)
    if (isRmb) {
      const md = input.getMouseDelta();
      const rotSpeed = 0.003;
      st.yawTarget += md.x * rotSpeed;
      st.pitchTarget -= md.y * rotSpeed;
      // Clamp pitch to avoid flipping.
      st.pitchTarget = Math.max(-1.5, Math.min(1.5, st.pitchTarget));
    }

    // Smooth rotation (always, so motion feels consistent).
    const aRot = smoothAlpha(st.smoothTimeRot);
    st.yaw = lerpAngle(Number(st.yaw) || 0, Number(st.yawTarget) || 0, aRot);
    st.pitch = lerp(Number(st.pitch) || 0, Number(st.pitchTarget) || 0, aRot);
    st.pitch = Math.max(-1.5, Math.min(1.5, st.pitch));

    // Pan (hold MMB): move along camera right (XZ) + world up.
    if (isMmb) {
      const md = input.getMouseDelta();
      const yaw = st.yaw;
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      const rX = cy;
      const rZ = sy;

      const speedBase = Number(this._editorCam3DState.moveSpeed) || 6;
      const panScale = Math.max(0.0005, speedBase * 0.002);

      st.posTarget.x += (-md.x * rX) * panScale;
      st.posTarget.z += (-md.x * rZ) * panScale;
      st.posTarget.y += (md.y) * panScale;
    }

    // Fly movement (WASD + QE). Only active while RMB is held,
    // so typing in the inspector doesn't move the camera.
    const moveForward = (isRmb && key('w')) ? 1 : 0;
    const moveBack = (isRmb && key('s')) ? 1 : 0;
    const moveLeft = (isRmb && key('a')) ? 1 : 0;
    const moveRight = (isRmb && key('d')) ? 1 : 0;
    const moveUp = (isRmb && (key('e') || key(' '))) ? 1 : 0;
    const moveDown = (isRmb && (key('q') || key('Control'))) ? 1 : 0;

    const moveX = (moveRight - moveLeft);
    const moveZ = (moveForward - moveBack);
    const moveY = (moveUp - moveDown);

    const speedBase = Number(this._editorCam3DState.moveSpeed) || 6;
    const speedMul = input.getKey('Shift') ? 3 : (input.getKey('Alt') ? 0.35 : 1);
    const speed = speedBase * speedMul;
    const step = speed * Math.max(0, dt);

    if (moveX !== 0 || moveZ !== 0 || moveY !== 0) {
      const yaw = st.yaw;
      const pitch = st.pitch;
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);

      // Forward direction follows where the camera looks (yaw + pitch).
      // yaw=0 looks down -Z.
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const fX = cp * sy;
      const fY = sp;
      const fZ = -cp * cy;

      // Strafe stays horizontal (yaw only) for predictable editor feel.
      const rX = cy;
      const rZ = sy;

      // Normalize diagonal
      const len = Math.hypot(moveX, moveZ, moveY) || 1;
      const nX = moveX / len;
      const nZ = moveZ / len;
      const nY = moveY / len;

      st.posTarget.x += (rX * nX + fX * nZ) * step;
      st.posTarget.z += (rZ * nX + fZ * nZ) * step;
      st.posTarget.y += (fY * nZ) * step;
      st.posTarget.y += nY * step;
    }

    // Wheel dolly along forward (scaled by delta magnitude; supports trackpads).
    if (wheel !== 0) {
      const yaw = st.yaw;
      const pitch = st.pitch;
      const sy = Math.sin(yaw);
      const cy = Math.cos(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const fX = cp * sy;
      const fY = sp;
      const fZ = -cp * cy;
      const wheelSteps = Math.max(-10, Math.min(10, (Number(wheel) || 0) / 100));
      const amount = (wheelSteps) * (speedBase * 0.25);
      st.posTarget.x += fX * amount;
      st.posTarget.y += fY * amount;
      st.posTarget.z += fZ * amount;
    }

    // Smooth position toward its target.
    const aPos = smoothAlpha(st.smoothTimePos);
    cam3.position.x = lerp(Number(cam3.position.x) || 0, Number(st.posTarget.x) || 0, aPos);
    cam3.position.y = lerp(Number(cam3.position.y) || 0, Number(st.posTarget.y) || 0, aPos);
    cam3.position.z = lerp(Number(cam3.position.z) || 0, Number(st.posTarget.z) || 0, aPos);

    this._updateEditorCamera3DTarget(cam3);
  },

  _pickDefaultSelectionForMode() {
    const scene = this.currentScene;
    if (!scene) return null;
    const objs = Array.isArray(scene.objects) ? scene.objects : [];
    for (const o of objs) {
      if (o && this._matchesMode(o)) return o;
    }

    // Don't auto-select editor cameras (they're editor-only, not scene content).
    return null;
  },

  /** @param {any} obj */
  _matchesMode(obj) {
    // Match engine behavior: objects in the 3D pass are those with renderLayer===0
    // or a draw3D() method. Everything else is considered 2D pass.
    const is3DPass = (obj?.renderLayer === 0) || (typeof obj?.draw3D === 'function');
    return this.mode === '3d' ? is3DPass : !is3DPass;
  },

  rebuildTree() {
    if (!ui.tree) return;
    const tree = ui.tree;
    tree.innerHTML = "";

    const scene = this.currentScene;
    if (!scene) return;

    /** @typedef {{ obj:any, depth:number, label:string }} TreeEntry */
    /** @type {TreeEntry[]} */
    const entries = [];

    /** @param {any} obj @param {string} fallback */
    const nameOf = (obj, fallback) => {
      if (!obj) return fallback;
      if (typeof obj.__xmlTag === 'string') {
        const tag = String(obj.__xmlTag);
        if (tag === 'Font') {
          const fam = String(obj.family || '').trim();
          return fam ? `Font: ${fam}` : 'Font';
        }
        if (tag === 'Mesh') {
          const n = String(obj.name || '').trim();
          return n ? `Mesh: ${n}` : 'Mesh';
        }
        if (tag === 'Material') {
          const n = String(obj.name || '').trim();
          return n ? `Material: ${n}` : 'Material';
        }
        if (tag === 'Skybox') return 'Skybox';
        return tag;
      }
      const n = obj?.name ? String(obj.name) : '';
      if (n) return n;
      return obj?.constructor?.name || fallback;
    };

    /** @param {any} obj @param {number} depth */
    const addNodeRecursive = (obj, depth) => {
      if (!obj) return;
      entries.push({ obj, depth, label: nameOf(obj, '(node)') });
      const kids = Array.isArray(obj.children) ? obj.children.filter(Boolean) : [];
      for (const ch of kids) addNodeRecursive(ch, depth + 1);
    };

    const sceneAny = /** @type {any} */ (scene);

    // XML resources / scene-level declarations
    if (sceneAny._skyboxXml) entries.push({ obj: sceneAny._skyboxXml, depth: 0, label: nameOf(sceneAny._skyboxXml, 'Skybox') });
    const fonts = Array.isArray(sceneAny.fonts) ? sceneAny.fonts : [];
    for (const f of fonts) entries.push({ obj: f, depth: 0, label: nameOf(f, 'Font') });
    const meshes = Array.isArray(sceneAny._meshXml) ? sceneAny._meshXml : [];
    for (const m of meshes) entries.push({ obj: m, depth: 0, label: nameOf(m, 'Mesh') });
    const materials = Array.isArray(sceneAny._materialXml) ? sceneAny._materialXml : [];
    for (const m of materials) entries.push({ obj: m, depth: 0, label: nameOf(m, 'Material') });

    // Cameras: show authored cameras (editor forces render cameras).
    const authoredCam2D = /** @type {any} */ (this._sceneCamera2D || null);
    const authoredCam3D = /** @type {any} */ (this._sceneCamera3D || null);
    if (this.mode === '2d') {
      if (authoredCam2D) entries.push({ obj: authoredCam2D, depth: 0, label: `Camera: ${nameOf(authoredCam2D, 'Camera')}` });
    } else {
      if (authoredCam3D) entries.push({ obj: authoredCam3D, depth: 0, label: `Camera3D: ${nameOf(authoredCam3D, 'Camera3D')}` });
    }

    // Audio & lights
    if (Array.isArray(scene.audio)) {
      for (const a of scene.audio) {
        if (!a) continue;
        entries.push({ obj: a, depth: 0, label: `Audio: ${nameOf(a, 'Audio')}` });
      }
    }
    if (Array.isArray(scene.lights)) {
      for (const l of scene.lights) {
        if (!l) continue;
        entries.push({ obj: l, depth: 0, label: `Light: ${nameOf(l, 'Light')}` });
      }
    }

    // Scene objects (and children), filtered by mode.
    if (Array.isArray(scene.objects)) {
      for (const obj of scene.objects) {
        if (!obj) continue;
        if (!this._matchesMode(obj)) continue;
        addNodeRecursive(obj, 0);
      }
    }

    for (const e of entries) {
      const div = document.createElement('div');
      div.className = 'treeItem' + (e.obj === this.selected ? ' selected' : '');
      div.textContent = e.label;
      div.style.paddingLeft = `${10 + Math.max(0, e.depth) * 14}px`;
      div.addEventListener('click', () => {
        this.selected = e.obj;
        this.rebuildTree();
        this.rebuildInspector();
        if (this._renderer) this._requestViewportSync(this._renderer);
      });
      tree.appendChild(div);
    }
  },

  /**
   * @param {any} target
   * @returns {{ parent: any|null, index: number } | null}
   */
  _findObjectInSceneObjects(target) {
    const scene = this.currentScene;
    if (!scene || !target || !Array.isArray(scene.objects)) return null;

    /**
     * @param {any} node
     * @returns {{ parent: any, index: number } | null}
     */
    const visit = (node) => {
      if (!node) return null;
      const kids = Array.isArray(node.children) ? node.children : [];
      for (let i = 0; i < kids.length; i++) {
        const ch = kids[i];
        if (ch === target) return { parent: node, index: i };
        /** @type {{ parent: any, index: number } | null} */
        const r = visit(ch);
        if (r) return r;
      }
      return null;
    };

    for (let i = 0; i < scene.objects.length; i++) {
      const root = scene.objects[i];
      if (root === target) return { parent: null, index: i };
      const r = visit(root);
      if (r) return r;
    }
    return null;
  },

  /** @param {any} obj */
  _getDeleteLabel(obj) {
    if (!obj) return 'this node';
    const n = obj?.name ? String(obj.name).trim() : '';
    if (n) return `"${n}"`;
    const t = String(obj?.constructor?.name || '').trim();
    return t ? `this ${t}` : 'this node';
  },

  /** @returns {boolean} */
  _confirmAndDeleteSelectedNode() {
    const scene = this.currentScene;
    const obj = this.selected;
    if (!scene || !obj) return false;

    // Only delete real scene objects (scene.objects + their children).
    // Disallow deleting XML stubs/resources, cameras, lights, audio, etc.
    if (obj && typeof obj === 'object' && typeof obj.__xmlTag === 'string') return false;
    if (obj === this._sceneCamera2D || obj === this._sceneCamera3D) return false;

    const loc = this._findObjectInSceneObjects(obj);
    if (!loc) return false;

    const label = this._getDeleteLabel(obj);
    const ok = window.confirm(`Delete ${label}?`);
    if (!ok) return true;

    if (loc.parent === null) {
      if (typeof scene.remove === 'function') scene.remove(obj);
      else if (Array.isArray(scene.objects)) scene.objects.splice(loc.index, 1);
    } else {
      const kids = Array.isArray(loc.parent.children) ? loc.parent.children : null;
      if (kids) kids.splice(loc.index, 1);
      // Best-effort: mark scene sorting dirty if present.
      if (scene && typeof scene === 'object' && ('_objectsDirty' in scene)) {
        // @ts-ignore
        scene._objectsDirty = true;
      }
    }

    // Pick a reasonable follow-up selection.
    this.selected = loc.parent ? loc.parent : this._pickDefaultSelectionForMode();

    // Refresh editor UI.
    this.rebuildTree();
    this.rebuildInspector();
    if (this._renderer) this._requestViewportSync(this._renderer);

    return true;
  },

  _isEditingInspector() {
    return isEditingInspector();
  },

  /** @param {number} seconds */
  _blockInspectorAutoRefresh(seconds) {
    blockInspectorAutoRefresh(this, seconds);
  },

  _setupInspectorInteractionGuards() {
    setupInspectorInteractionGuards(this);
  },

  rebuildInspector() {
    rebuildInspectorPanel(this, /** @type {any} */ (ui));
  },

  /**
   * Inspector for scene-level XML stub entries like <Font/>, <Mesh/>, <Material/>, <Skybox/>.
   * @param {any} stub
   */
  _rebuildInspectorXmlStub(stub) {
    rebuildInspectorXmlStubPanel(this, /** @type {any} */ (ui), stub);
  },

  /**
   * 2D position editing: if followCamera is enabled, write baseX/baseY instead of x/y
   * to avoid the engine overwriting the value next frame.
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {'x'|'y'} key
   */
  _addNumber2DPos(container, label, obj, key) {
    InspectorFields.addNumber2DPos(container, label, obj, key);
  },

  /**
   * Layer support for 2D objects: allow editing even if the object didn't explicitly
   * define a numeric layer (engine treats missing as 0).
   * Also forces scene resorting so changes take effect immediately.
   * @param {HTMLElement | null} container
   * @param {any} obj
   */
  _add2DLayerField(container, obj) {
    InspectorFields.add2DLayerField(this, container, obj);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} labelText
   * @param {HTMLElement} node
   */
  _addField(container, labelText, node) {
    return InspectorFields.addField(container, labelText, node);
  },

  _loadEditorSettingsFromStorage() {
    loadEditorSettingsFromStorage(this);
  },

  _saveEditorSettingsToStorage() {
    saveEditorSettingsToStorage(this);
  },

  _applyEditorSettingsFilter() {
    applyEditorSettingsFilter(this, ui);
  },

  /** @param {'general'|'grid2d'|'grid3d'} cat */
  _setEditorSettingsCategory(cat) {
    setEditorSettingsCategory(this, ui, cat);
  },

  _rebuildEditorSettingsUI() {
    rebuildEditorSettingsUI(this, ui);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {string | number} text
   */
  _addReadonly(container, label, text) {
    InspectorFields.addReadonly(container, label, text);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addToggle(container, label, obj, key) {
    InspectorFields.addToggle(container, label, obj, key);
  },

  /**
   * Like _addToggle but runs a callback after change.
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   * @param {() => void} onChanged
   */
  _addToggleWith(container, label, obj, key, onChanged) {
    InspectorFields.addToggleWith(container, label, obj, key, onChanged);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addNumber(container, label, obj, key) {
    InspectorFields.addNumber(this, container, label, obj, key);
  },

  /**
   * Like _addNumber but runs a callback after change.
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   * @param {{ step?: number, min?: number, max?: number }=} opts
   * @param {() => void} onChanged
   */
  _addNumberWith(container, label, obj, key, onChanged, opts = {}) {
    InspectorFields.addNumberWith(container, label, obj, key, onChanged, opts);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addString(container, label, obj, key) {
    InspectorFields.addString(container, label, obj, key);
  },

  /**
   * Like _addString but also runs a callback after applying.
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   * @param {() => void} onChanged
   */
  _addStringWith(container, label, obj, key, onChanged) {
    InspectorFields.addStringWith(container, label, obj, key, onChanged);
  },

  /**
   * Nullable number input: allows clearing the field to represent "unset".
   * - For ClickableArea width/height, empty sets to null.
   * - For plain objects (e.g. mesh params), empty deletes the key.
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addNullableNumber(container, label, obj, key) {
    InspectorFields.addNullableNumber(container, label, obj, key);
  },

  /**
   * Edit a vec3 stored as an array [x,y,z].
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {number[]} arr
   * @param {{ normalize?: boolean }=} opts
   */
  _addVec3Array(container, label, arr, opts = {}) {
    InspectorFields.addVec3Array(container, label, arr, opts);
  },

  /**
   * Edit an RGB vec3 (0..1) stored as an array [r,g,b].
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {number[]} arr
   */
  _addColorVec3(container, label, arr) {
    InspectorFields.addColorVec3(container, label, arr);
  },

  /** @param {number} r @param {number} g @param {number} b */
  _rgb01ToHex(r, g, b) {
    return InspectorFields.rgb01ToHex(r, g, b);
  },

  /** @param {string} hex @returns {[number,number,number] | null} */
  _hexToRgb01(hex) {
    return InspectorFields.hexToRgb01(hex);
  },

  /**
   * Text font family is stored as _fontFamily (no public setter).
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} textObj
   */
  _addTextFontFamily(container, label, textObj) {
    InspectorFields.addTextFontFamily(container, label, textObj);
  },

  /**
   * Better color input: color picker (when possible) + text field (always).
   * Stores the color as a CSS string (e.g. "#ff00aa", "white", "rgba(...)"),
   * which matches Text.textColor.
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addCssColor(container, label, obj, key) {
    InspectorFields.addCssColor(container, label, obj, key);
  },

  /**
   * Convert a CSS color string to #RRGGBB if possible.
   * Returns null if the browser can't parse it.
   * @param {string} css
   * @returns {string|null}
   */
  _cssColorToHex(css) {
    return InspectorFields.cssColorToHex(css);
  },

  /**
   * Opacity shown as 0..1 but stored as Sprite transparency 0..255.
   * Works for Sprite-derived nodes (including Text).
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   */
  _addOpacity01(container, label, obj) {
    InspectorFields.addOpacity01(container, label, obj);
  },

  focusSelection() {
    if (!this.currentScene || !this.selected) return;
    if (this.mode === '3d') {
      const cam = /** @type {any} */ (this.currentScene.camera3D);
      if (!cam || !cam.position) return;

      const p = this._getWorldPos(this.selected);
      if (!p) return;

      cam.position.x = p.x + 0.0;
      cam.position.y = p.y + 1.0;
      cam.position.z = p.z + 3.5;

      // Update yaw/pitch so the editor camera controller doesn't immediately
      // override the focused direction next frame.
      const dx = p.x - cam.position.x;
      const dy = p.y - cam.position.y;
      const dz = p.z - cam.position.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const fx = dx / len;
      const fy = dy / len;
      const fz = dz / len;

      // Our convention: yaw=0 looks down -Z.
      this._editorCam3DState.yaw = Math.atan2(fx, -fz);
      this._editorCam3DState.pitch = Math.asin(Math.max(-1, Math.min(1, fy)));
      this._editorCam3DState.pitch = Math.max(-1.5, Math.min(1.5, this._editorCam3DState.pitch));
      this._updateEditorCamera3DTarget(cam);
      return;
    }

    // 2D focus: move the 2D camera to the selection.
    const cam2 = /** @type {any} */ (this.currentScene.camera);
    if (!cam2) return;
    const p2 = this._get2DPos(this.selected);
    if (!p2) return;
    if (typeof cam2.x === 'number') cam2.x = p2.x;
    if (typeof cam2.y === 'number') cam2.y = p2.y;
  },

  /** @param {any} obj */
  _get2DPos(obj) {
    if (!obj) return null;
    if (typeof obj.x === 'number' || typeof obj.y === 'number') {
      return { x: Number(obj.x) || 0, y: Number(obj.y) || 0 };
    }
    return null;
  },

  /** @param {any} obj */
  _getWorldPos(obj) {
    if (!obj) return null;
    // Lights store position as a vec3 array.
    if (obj.isLight && Array.isArray(obj.position) && obj.position.length >= 3) {
      return {
        x: Number(obj.position[0]) || 0,
        y: Number(obj.position[1]) || 0,
        z: Number(obj.position[2]) || 0,
      };
    }
    if (obj.position && typeof obj.position.x === "number") {
      return { x: Number(obj.position.x) || 0, y: Number(obj.position.y) || 0, z: Number(obj.position.z) || 0 };
    }
    if (typeof obj.x === "number" || typeof obj.y === "number" || typeof obj.z === "number") {
      return { x: Number(obj.x) || 0, y: Number(obj.y) || 0, z: Number(obj.z) || 0 };
    }
    return null;
  },

  /** @param {any} obj @param {number} x @param {number} y */
  _set2DPos(obj, x, y) {
    if (!obj) return;
    if (typeof obj.x === 'number') obj.x = x;
    if (typeof obj.y === 'number') obj.y = y;
  },

  /** @param {any} obj @param {number} x @param {number} y @param {number} z */
  _setWorldPos(obj, x, y, z) {
    if (!obj) return;
    // Lights store position as a vec3 array.
    if (obj.isLight && Array.isArray(obj.position) && obj.position.length >= 3) {
      obj.position[0] = x;
      obj.position[1] = y;
      obj.position[2] = z;
      return;
    }
    if (obj.position && typeof obj.position.x === 'number') {
      obj.position.x = x;
      obj.position.y = y;
      obj.position.z = z;
      return;
    }
    if (typeof obj.x === 'number') obj.x = x;
    if (typeof obj.y === 'number') obj.y = y;
    if (typeof obj.z === 'number') obj.z = z;
  },

  _getCanvasRect() {
    const r = this._renderer;
    const canvas = r?.canvas;
    if (!r || !canvas) return null;
    return canvas.getBoundingClientRect();
  },

  /** @param {number} x @param {number} y */
  _isPointInCanvas(x, y) {
    const rect = this._getCanvasRect();
    if (!rect) return false;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  },

  /**
   * @param {number} px
   * @param {number} py
   * @param {number} ax
   * @param {number} ay
   * @param {number} bx
   * @param {number} by
   */
  _distPointToSegment2D(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 <= 1e-8) {
      const dx = px - ax;
      const dy = py - ay;
      return Math.hypot(dx, dy);
    }
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  },

  /** @param {any} camera3D @param {number} clientX @param {number} clientY */
  _getMouseRay3D(camera3D, clientX, clientY) {
    const r = this._renderer;
    if (!r || !camera3D) return null;

    const viewport = r.viewport;
    if (!viewport) return null;

    /** @type {HTMLCanvasElement} */
    // @ts-ignore - renderer.canvas is a canvas at runtime
    const canvas = r.canvas;

    const rect = canvas.getBoundingClientRect();
    const localCssX = clientX - rect.left;
    const localCssY = clientY - rect.top;
    const cssToDeviceX = canvas.width / rect.width;
    const cssToDeviceY = canvas.height / rect.height;
    const localDeviceX = localCssX * cssToDeviceX;
    const localDeviceY = localCssY * cssToDeviceY;
    const webglDeviceX = localDeviceX;
    const webglDeviceY = canvas.height - localDeviceY;

    const u = (webglDeviceX - viewport.x) / viewport.width;
    const v = (webglDeviceY - viewport.y) / viewport.height;
    const uClamped = Math.max(0, Math.min(1, u));
    const vClamped = Math.max(0, Math.min(1, v));

    const ndcX = uClamped * 2 - 1;
    const ndcY = vClamped * 2 - 1;

    const vp = camera3D.getViewProjectionMatrix?.();
    if (!vp) return null;
    const inv = Mat4.invert(vp);
    if (!inv) return null;

    const unproject = (/** @type {number} */ z) => {
      const x = ndcX, y = ndcY;
      const w = 1;
      const vx = inv[0] * x + inv[4] * y + inv[8] * z + inv[12] * w;
      const vy = inv[1] * x + inv[5] * y + inv[9] * z + inv[13] * w;
      const vz = inv[2] * x + inv[6] * y + inv[10] * z + inv[14] * w;
      const vw = inv[3] * x + inv[7] * y + inv[11] * z + inv[15] * w;
      if (Math.abs(vw) < 1e-8) return { x: vx, y: vy, z: vz };
      return { x: vx / vw, y: vy / vw, z: vz / vw };
    };

    const pNear = unproject(-1);
    const pFar = unproject(1);
    const dx = pFar.x - pNear.x;
    const dy = pFar.y - pNear.y;
    const dz = pFar.z - pNear.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    return {
      origin: pNear,
      dir: { x: dx / len, y: dy / len, z: dz / len },
    };
  },

  /** @param {{x:number,y:number,z:number}} rayO @param {{x:number,y:number,z:number}} rayD @param {{x:number,y:number,z:number}} planeP @param {{x:number,y:number,z:number}} planeN */
  _rayPlane(rayO, rayD, planeP, planeN) {
    const denom = planeN.x * rayD.x + planeN.y * rayD.y + planeN.z * rayD.z;
    if (Math.abs(denom) < 1e-6) return null;
    const t = (planeN.x * (planeP.x - rayO.x) + planeN.y * (planeP.y - rayO.y) + planeN.z * (planeP.z - rayO.z)) / denom;
    if (!Number.isFinite(t)) return null;
    return { x: rayO.x + rayD.x * t, y: rayO.y + rayD.y * t, z: rayO.z + rayD.z * t };
  },

  /** @param {{x:number,y:number,z:number}} p0 @param {{x:number,y:number,z:number}} d0 @param {{x:number,y:number,z:number}} p1 @param {{x:number,y:number,z:number}} d1 */
  _closestAxisT(p0, d0, p1, d1) {
    // Returns t along axis line (p0 + d0 * t) closest to ray (p1 + d1 * s)
    const b = d0.x * d1.x + d0.y * d1.y + d0.z * d1.z;
    const rX = p0.x - p1.x;
    const rY = p0.y - p1.y;
    const rZ = p0.z - p1.z;
    const d = d0.x * rX + d0.y * rY + d0.z * rZ;
    const e = d1.x * rX + d1.y * rY + d1.z * rZ;
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-6) return null;
    return (b * e - d) / denom;
  },

  /** @param {any} obj */
  _get2DRot(obj) {
    if (!obj) return null;
    const v = Number(obj.rotation);
    return Number.isFinite(v) ? v : null;
  },

  /** @param {any} obj @param {number} rot */
  _set2DRot(obj, rot) {
    if (!obj) return;
    if (typeof obj.rotation === 'number' || obj.rotation === undefined) {
      obj.rotation = Number(rot) || 0;
    }
  },

  /** @param {{x:number,y:number,z:number}} v @param {{x:number,y:number,z:number}} axis @param {number} angle */
  _rotateVecAxisAngle(v, axis, angle) {
    const ax = axis.x, ay = axis.y, az = axis.z;
    const al = Math.hypot(ax, ay, az) || 1;
    const x = ax / al, y = ay / al, z = az / al;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    // Rodrigues rotation formula
    return {
      x: v.x * (t * x * x + c) + v.y * (t * x * y - s * z) + v.z * (t * x * z + s * y),
      y: v.x * (t * x * y + s * z) + v.y * (t * y * y + c) + v.z * (t * y * z - s * x),
      z: v.x * (t * x * z - s * y) + v.y * (t * y * z + s * x) + v.z * (t * z * z + c),
    };
  },

  /** @param {any} obj */
  _getGizmoPos3D(obj) {
    const p = this._getWorldPos(obj);
    if (p) return p;
    // Direction-only objects (e.g. DirectionalLight) still need a gizmo anchor.
    return { x: 0, y: 0, z: 0 };
  },

  /** @param {any} obj */
  _canRotate3D(obj) {
    if (!obj) return false;
    if (typeof obj.rotX === 'number' || typeof obj.rotY === 'number' || typeof obj.rotZ === 'number') return true;
    if (obj.isLight && Array.isArray(obj.direction) && obj.direction.length >= 3) return true;
    if (obj.position && obj.target && typeof obj.position === 'object' && typeof obj.target === 'object') return true;
    return false;
  },

  /** @param {any} obj @param {'x'|'y'|'z'} axis @param {number} angle */
  _applyRotate3D(obj, axis, angle) {
    if (!obj) return;
    if (typeof obj.rotX === 'number' || typeof obj.rotY === 'number' || typeof obj.rotZ === 'number') {
      if (axis === 'x' && typeof obj.rotX === 'number') obj.rotX = (Number(obj.rotX) || 0) + angle;
      if (axis === 'y' && typeof obj.rotY === 'number') obj.rotY = (Number(obj.rotY) || 0) + angle;
      if (axis === 'z' && typeof obj.rotZ === 'number') obj.rotZ = (Number(obj.rotZ) || 0) + angle;
      return;
    }

    const axisVec = axis === 'x' ? { x: 1, y: 0, z: 0 } : axis === 'y' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: -1 };

    // Lights: rotate their direction vector.
    if (obj.isLight && Array.isArray(obj.direction) && obj.direction.length >= 3) {
      const d = { x: Number(obj.direction[0]) || 0, y: Number(obj.direction[1]) || 0, z: Number(obj.direction[2]) || 0 };
      const rd = this._rotateVecAxisAngle(d, axisVec, angle);
      const len = Math.hypot(rd.x, rd.y, rd.z) || 1;
      obj.direction[0] = rd.x / len;
      obj.direction[1] = rd.y / len;
      obj.direction[2] = rd.z / len;
      return;
    }

    // Camera3D-like: rotate (target - position) and update target.
    if (obj.position && obj.target && typeof obj.position === 'object' && typeof obj.target === 'object') {
      const px = Number(obj.position.x) || 0;
      const py = Number(obj.position.y) || 0;
      const pz = Number(obj.position.z) || 0;
      const dx = (Number(obj.target.x) || 0) - px;
      const dy = (Number(obj.target.y) || 0) - py;
      const dz = (Number(obj.target.z) || 0) - pz;
      const rd = this._rotateVecAxisAngle({ x: dx, y: dy, z: dz }, axisVec, angle);
      obj.target.x = px + rd.x;
      obj.target.y = py + rd.y;
      obj.target.z = pz + rd.z;
    }
  },

  /** @param {any} dbg @param {number} cx @param {number} cy @param {number} r @param {number[]} color @param {number} width */
  _drawCircle2D(dbg, cx, cy, r, color, width) {
    const segs = 48;
    let px = cx + r;
    let py = cy;
    for (let i = 1; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      const nx = cx + Math.cos(t) * r;
      const ny = cy + Math.sin(t) * r;
      dbg.drawLine(px, py, nx, ny, color, width);
      px = nx;
      py = ny;
    }
  },

  /** @param {any} dbg @param {{x:number,y:number,z:number}} c @param {number} r @param {'x'|'y'|'z'} axis @param {number[]} color @param {number} width @param {any} depth */
  _drawCircle3D(dbg, c, r, axis, color, width, depth) {
    const segs = 64;
    const b1 = axis === 'x' ? { x: 0, y: 1, z: 0 } : axis === 'y' ? { x: 1, y: 0, z: 0 } : { x: 1, y: 0, z: 0 };
    const b2 = axis === 'x' ? { x: 0, y: 0, z: -1 } : axis === 'y' ? { x: 0, y: 0, z: -1 } : { x: 0, y: 1, z: 0 };
    let px = c.x + b1.x * r;
    let py = c.y + b1.y * r;
    let pz = c.z + b1.z * r;
    for (let i = 1; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      const nx = c.x + (b1.x * Math.cos(t) + b2.x * Math.sin(t)) * r;
      const ny = c.y + (b1.y * Math.cos(t) + b2.y * Math.sin(t)) * r;
      const nz = c.z + (b1.z * Math.cos(t) + b2.z * Math.sin(t)) * r;
      dbg.drawLine3D(px, py, pz, nx, ny, nz, color, width, depth);
      px = nx;
      py = ny;
      pz = nz;
    }
  },

  _updateGizmo() {
    const scene = this.currentScene;
    const r = this._renderer;
    const input = this._input;
    const obj = this.selected;
    if (!scene || !r || !input || !obj) {
      this._gizmo.active = false;
      this._gizmo.axis = null;
      return;
    }

    const mouse = input.getMousePosition();
    const mouseDown = input.getMouseButtonDown(0);
    const mouseHeld = input.getMouseButton(0);
    const mouseUp = input.getMouseButtonUp(0);

    // Only interact when the mouse is over the canvas (avoid dragging via UI panels).
    const overCanvas = this._isPointInCanvas(mouse.x, mouse.y);

    if (mouseUp) {
      this._gizmo.active = false;
      this._gizmo.axis = null;
    }

    if (this.mode === '2d') {
      const cam2 = /** @type {any} */ (scene.camera || scene.getObjectByName?.('MainCamera'));
      const p = this._get2DPos(obj);
      if (!cam2 || !p) return;

      const mouseWorld = r.screenToWorld(mouse.x, mouse.y, cam2);
      const zoom = Number(cam2.zoom) || 1;
      const axisLen = 80 / zoom;
      const hitTh = 10 / zoom;

      // Rotate gizmo (2D)
      if (this._gizmo.mode === 'rotate') {
        const curRot = this._get2DRot(obj);
        if (curRot === null) return;

        const ringR = 55 / zoom;
        const ringTh = 8 / zoom;

        if (!this._gizmo.active && mouseDown && overCanvas) {
          const dist = Math.hypot(mouseWorld.x - p.x, mouseWorld.y - p.y);
          if (Math.abs(dist - ringR) <= ringTh) {
            this._gizmo.active = true;
            this._gizmo.axis = 'rot';
            this._gizmo.startPos2D = { x: p.x, y: p.y };
            this._gizmo.startRot2D = curRot;
            this._gizmo.startMouseAngle2D = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
          }
        }

        if (this._gizmo.active && mouseHeld && this._gizmo.axis === 'rot' && this._gizmo.startPos2D) {
          const a0 = Number(this._gizmo.startMouseAngle2D) || 0;
          const a1 = Math.atan2(mouseWorld.y - this._gizmo.startPos2D.y, mouseWorld.x - this._gizmo.startPos2D.x);
          const delta = a1 - a0;
          this._set2DRot(obj, (Number(this._gizmo.startRot2D) || 0) + delta);
        }

        return;
      }

      const ax = p.x, ay = p.y;
      const x1 = ax + axisLen, y1 = ay;
      const x2 = ax, y2 = ay + axisLen;

      // Start drag: pick axis/center.
      if (!this._gizmo.active && mouseDown && overCanvas) {
        const dX = this._distPointToSegment2D(mouseWorld.x, mouseWorld.y, ax, ay, x1, y1);
        const dY = this._distPointToSegment2D(mouseWorld.x, mouseWorld.y, ax, ay, x2, y2);
        const dC = Math.hypot(mouseWorld.x - ax, mouseWorld.y - ay);

        let axis = /** @type {'x'|'y'|'center'|null} */ (null);
        let best = hitTh;
        if (dC < best) { best = dC; axis = 'center'; }
        if (dX < best) { best = dX; axis = 'x'; }
        if (dY < best) { best = dY; axis = 'y'; }

        if (axis) {
          this._gizmo.active = true;
          this._gizmo.axis = axis;
          this._gizmo.startPos2D = { x: p.x, y: p.y };
          this._gizmo.startMouseWorld2D = { x: mouseWorld.x, y: mouseWorld.y };
        }
      }

      // Dragging.
      if (this._gizmo.active && mouseHeld && this._gizmo.startPos2D && this._gizmo.startMouseWorld2D) {
        const dx = mouseWorld.x - this._gizmo.startMouseWorld2D.x;
        const dy = mouseWorld.y - this._gizmo.startMouseWorld2D.y;
        const s = this._gizmo.startPos2D;
        const a = this._gizmo.axis;
        const nx = (a === 'y') ? s.x : (s.x + dx);
        const ny = (a === 'x') ? s.y : (s.y + dy);
        this._set2DPos(obj, nx, ny);
      }

      return;
    }

    // 3D gizmo
    const cam3 = /** @type {any} */ (scene.camera3D || scene.getObjectByName?.('MainCamera3D'));
    if (!cam3) return;
    const p3 = this._getGizmoPos3D(obj);

    const ray = this._getMouseRay3D(cam3, mouse.x, mouse.y);
    if (!ray) return;

    // Rotate gizmo (3D)
    if (this._gizmo.mode === 'rotate') {
      if (!this._canRotate3D(obj)) return;

      const center = { x: p3.x, y: p3.y, z: p3.z };
      const ringR = 1.0;
      const ringTh = 0.18;

      const planes = /** @type {Array<{axis:'x'|'y'|'z', n:{x:number,y:number,z:number}, b1:{x:number,y:number,z:number}, b2:{x:number,y:number,z:number}}>} */ ([
        { axis: 'x', n: { x: 1, y: 0, z: 0 }, b1: { x: 0, y: 1, z: 0 }, b2: { x: 0, y: 0, z: -1 } },
        { axis: 'y', n: { x: 0, y: 1, z: 0 }, b1: { x: 1, y: 0, z: 0 }, b2: { x: 0, y: 0, z: -1 } },
        { axis: 'z', n: { x: 0, y: 0, z: -1 }, b1: { x: 1, y: 0, z: 0 }, b2: { x: 0, y: 1, z: 0 } },
      ]);

      if (!this._gizmo.active && mouseDown && overCanvas) {
        let picked = /** @type {'x'|'y'|'z'|null} */ (null);
        let best = Infinity;
        let bestAngle = 0;

        for (const pl of planes) {
          const hit = this._rayPlane(ray.origin, ray.dir, center, pl.n);
          if (!hit) continue;
          const vx = hit.x - center.x;
          const vy = hit.y - center.y;
          const vz = hit.z - center.z;
          const dist = Math.hypot(vx, vy, vz);
          const err = Math.abs(dist - ringR);
          if (err <= ringTh && err < best) {
            best = err;
            picked = pl.axis;
            const u = vx * pl.b1.x + vy * pl.b1.y + vz * pl.b1.z;
            const v = vx * pl.b2.x + vy * pl.b2.y + vz * pl.b2.z;
            bestAngle = Math.atan2(v, u);
          }
        }

        if (picked) {
          this._gizmo.active = true;
          this._gizmo.axis = picked;
          this._gizmo.startPos3D = { x: center.x, y: center.y, z: center.z };
          this._gizmo.startAxisAngle3D = bestAngle;

          // Snapshot values so rotation is stable during drag.
          if (typeof obj.rotX === 'number' || typeof obj.rotY === 'number' || typeof obj.rotZ === 'number') {
            this._gizmo.startEuler3D = {
              x: Number(obj.rotX) || 0,
              y: Number(obj.rotY) || 0,
              z: Number(obj.rotZ) || 0,
            };
          } else if (obj.isLight && Array.isArray(obj.direction) && obj.direction.length >= 3) {
            this._gizmo.startDir3D = [Number(obj.direction[0]) || 0, Number(obj.direction[1]) || 0, Number(obj.direction[2]) || 0];
          } else if (obj.position && obj.target) {
            const px = Number(obj.position.x) || 0;
            const py = Number(obj.position.y) || 0;
            const pz = Number(obj.position.z) || 0;
            this._gizmo.startCamDir3D = {
              x: (Number(obj.target.x) || 0) - px,
              y: (Number(obj.target.y) || 0) - py,
              z: (Number(obj.target.z) || 0) - pz,
            };
          }
        }
      }

      if (this._gizmo.active && mouseHeld && this._gizmo.startPos3D && (this._gizmo.axis === 'x' || this._gizmo.axis === 'y' || this._gizmo.axis === 'z')) {
        const axis = /** @type {'x'|'y'|'z'} */ (this._gizmo.axis);
        const pl = planes.find(p => p.axis === axis);
        if (!pl) return;
        const hit = this._rayPlane(ray.origin, ray.dir, this._gizmo.startPos3D, pl.n);
        if (!hit) return;
        const vx = hit.x - this._gizmo.startPos3D.x;
        const vy = hit.y - this._gizmo.startPos3D.y;
        const vz = hit.z - this._gizmo.startPos3D.z;
        const u = vx * pl.b1.x + vy * pl.b1.y + vz * pl.b1.z;
        const v = vx * pl.b2.x + vy * pl.b2.y + vz * pl.b2.z;
        const a1 = Math.atan2(v, u);
        const delta = a1 - (Number(this._gizmo.startAxisAngle3D) || 0);

        // Restore snapshot then apply delta.
        if (this._gizmo.startEuler3D) {
          obj.rotX = this._gizmo.startEuler3D.x;
          obj.rotY = this._gizmo.startEuler3D.y;
          obj.rotZ = this._gizmo.startEuler3D.z;
        } else if (this._gizmo.startDir3D && obj.isLight && Array.isArray(obj.direction)) {
          obj.direction[0] = this._gizmo.startDir3D[0];
          obj.direction[1] = this._gizmo.startDir3D[1];
          obj.direction[2] = this._gizmo.startDir3D[2];
        } else if (this._gizmo.startCamDir3D && obj.position && obj.target) {
          const px = Number(obj.position.x) || 0;
          const py = Number(obj.position.y) || 0;
          const pz = Number(obj.position.z) || 0;
          obj.target.x = px + this._gizmo.startCamDir3D.x;
          obj.target.y = py + this._gizmo.startCamDir3D.y;
          obj.target.z = pz + this._gizmo.startCamDir3D.z;
        }

        this._applyRotate3D(obj, axis, delta);
      }

      return;
    }

    const axisLen = 1.2;
    const hitTh = 0.25;
    const o = { x: p3.x, y: p3.y, z: p3.z };

    const axisVecs = /** @type {Array<{axis:'x'|'y'|'z', d:{x:number,y:number,z:number}}>} */ ([
      { axis: 'x', d: { x: 1, y: 0, z: 0 } },
      { axis: 'y', d: { x: 0, y: 1, z: 0 } },
      { axis: 'z', d: { x: 0, y: 0, z: -1 } },
    ]);

    if (!this._gizmo.active && mouseDown && overCanvas) {
      // Center handle: plane perpendicular to camera forward.
      const fwd = {
        x: (cam3.target?.x ?? 0) - (cam3.position?.x ?? 0),
        y: (cam3.target?.y ?? 0) - (cam3.position?.y ?? 0),
        z: (cam3.target?.z ?? 0) - (cam3.position?.z ?? 0),
      };
      const fLen = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
      const planeN = { x: fwd.x / fLen, y: fwd.y / fLen, z: fwd.z / fLen };
      const hit = this._rayPlane(ray.origin, ray.dir, o, planeN);
      const dC = hit ? Math.hypot(hit.x - o.x, hit.y - o.y, hit.z - o.z) : Infinity;

      let picked = /** @type {'x'|'y'|'z'|'center'|null} */ (null);
      let best = hitTh;
      if (dC < best) { best = dC; picked = 'center'; }

      for (const a of axisVecs) {
        const t = this._closestAxisT(o, a.d, ray.origin, ray.dir);
        if (t === null) continue;
        const tClamped = Math.max(0, Math.min(axisLen, t));
        const px = o.x + a.d.x * tClamped;
        const py = o.y + a.d.y * tClamped;
        const pz = o.z + a.d.z * tClamped;

        // Closest point on ray to this point (project)
        const rx = px - ray.origin.x;
        const ry = py - ray.origin.y;
        const rz = pz - ray.origin.z;
        const s = rx * ray.dir.x + ry * ray.dir.y + rz * ray.dir.z;
        const qx = ray.origin.x + ray.dir.x * s;
        const qy = ray.origin.y + ray.dir.y * s;
        const qz = ray.origin.z + ray.dir.z * s;
        const dist = Math.hypot(px - qx, py - qy, pz - qz);
        if (dist < best) {
          best = dist;
          picked = a.axis;
        }
      }

      if (picked) {
        this._gizmo.active = true;
        this._gizmo.axis = picked;
        this._gizmo.startPos3D = { x: o.x, y: o.y, z: o.z };
        if (picked === 'center') {
          this._gizmo.startPlaneHit = hit;
        } else {
          const d = axisVecs.find(v => v.axis === picked)?.d;
          const t0 = d ? this._closestAxisT(o, d, ray.origin, ray.dir) : null;
          this._gizmo.startAxisT = Number(t0) || 0;
        }
      }
    }

    if (this._gizmo.active && mouseHeld && this._gizmo.startPos3D) {
      const start = this._gizmo.startPos3D;
      const a = this._gizmo.axis;

      if (a === 'center') {
        const fwd = {
          x: (cam3.target?.x ?? 0) - (cam3.position?.x ?? 0),
          y: (cam3.target?.y ?? 0) - (cam3.position?.y ?? 0),
          z: (cam3.target?.z ?? 0) - (cam3.position?.z ?? 0),
        };
        const fLen = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
        const planeN = { x: fwd.x / fLen, y: fwd.y / fLen, z: fwd.z / fLen };
        const hit = this._rayPlane(ray.origin, ray.dir, start, planeN);
        if (hit && this._gizmo.startPlaneHit) {
          const dx = hit.x - this._gizmo.startPlaneHit.x;
          const dy = hit.y - this._gizmo.startPlaneHit.y;
          const dz = hit.z - this._gizmo.startPlaneHit.z;
          this._setWorldPos(obj, start.x + dx, start.y + dy, start.z + dz);
        }
      } else {
        const d = axisVecs.find(v => v.axis === a)?.d;
        if (d) {
          const tNow = this._closestAxisT(start, d, ray.origin, ray.dir);
          if (tNow !== null) {
            const delta = tNow - (this._gizmo.startAxisT || 0);
            this._setWorldPos(obj, start.x + d.x * delta, start.y + d.y * delta, start.z + d.z * delta);
          }
        }
      }
    }
  },

  /** @param {number} dt */
  update(dt) {
    if (!this.currentScene) return;

    // Gizmo mode toggles (avoid switching while typing in the inspector).
    if (this._input && !this._isEditingInspector()) {
      if (this._input.getKeyDown('r') || this._input.getKeyDown('R')) this._gizmo.mode = 'rotate';
      if (this._input.getKeyDown('t') || this._input.getKeyDown('T')) this._gizmo.mode = 'translate';
    }

    // Editor camera navigation (fallback cameras, plus 2D pan/zoom).
    this._updateEditorCamera(dt);

    // Gizmo manipulation (uses input + debug-drawn handles).
    this._updateGizmo();

    // Keep the loaded scene running normally.
    // IMPORTANT: In the editor we render with an editor camera, but game logic (including
    // Sprite.followCamera) should use the authored scene camera, not the editor camera.
    const scene = this.currentScene;
    const prevCam2D = scene.camera;
    const authoredCam2D = this._sceneCamera2D;
    try {
      if (authoredCam2D && prevCam2D && authoredCam2D !== prevCam2D) {
        scene.camera = authoredCam2D;
      }
      scene.update(dt);
    } finally {
      // Restore editor camera for rendering/picking.
      if (prevCam2D) scene.camera = prevCam2D;
    }

    // Keep inspector values reasonably fresh, but don’t fight user input while typing.
    if (this._inspectorRefreshBlockT > 0) {
      this._inspectorRefreshBlockT = Math.max(0, this._inspectorRefreshBlockT - dt);
    }

    // Save project meta edits (debounced)
    this._flushSaveProjectMetaIfDue().catch(console.warn);

    if (this._lastSceneSaveOkT > 0) {
      this._lastSceneSaveOkT = Math.max(0, this._lastSceneSaveOkT - dt);
    }

    if (this.selected && !this._isEditingInspector() && this._inspectorRefreshBlockT <= 0) {
      this._inspectorAutoRefreshT += dt;
      if (this._inspectorAutoRefreshT >= 0.2) {
        this._inspectorAutoRefreshT = 0;
        this.rebuildInspector();
      }
    }
  },

  /** @param {Renderer} renderer */
  draw(renderer) {
    const dbg = renderer?.debug;
    const obj = this.selected;

    if (!dbg) return;

    const depth = !!ui.dbgDepthTest?.checked;

    // Empty scenes short-circuit Scene.draw() before any 3D pass begins.
    // But 3D debug primitives (grid/gizmos) are only rendered at end3D().
    // So when the scene has no objects, we explicitly begin/end a minimal 3D pass
    // to flush queued 3D debug lines.
    const sceneHasNoObjects = !!(this.currentScene && Array.isArray(this.currentScene.objects) && this.currentScene.objects.length === 0);
    const needsEmpty3DPass = (this.mode === '3d') && sceneHasNoObjects;
    let didBeginEmpty3DPass = false;
    if (needsEmpty3DPass && typeof renderer.begin3D === 'function' && typeof renderer.end3D === 'function') {
      // Guard against internal state weirdness; Engine.endFrame() also forces end3D().
      // @ts-ignore - internal flag
      if (!renderer._in3DPass) {
        didBeginEmpty3DPass = !!renderer.begin3D(/** @type {any} */ (this.currentScene?.camera3D));
      }
    }

    // 2D viewport overlay (grid/rulers/frame) should show even with no selection.
    if (this.mode === '2d') {
      const cam2 = /** @type {any} */ (this.currentScene?.camera);
      if (cam2) this._draw2DViewportOverlay(cam2, this._sceneCamera2D);
    }

    // 3D viewport grid should show regardless of selection and is not part of the scene.
    if (this.mode === '3d') {
      this._draw3DViewportGrid(dbg, depth);
    }

    if (didBeginEmpty3DPass) {
      renderer.end3D();
      didBeginEmpty3DPass = false;
    }

    if (obj) {

      // 2D debug (uses existing 2D debug renderer)
      if (this.mode === '2d') {
        const p2 = this._get2DPos(obj);
        if (p2) {
          // Translate/Rotate gizmo (2D)
          const cam2 = /** @type {any} */ (this.currentScene?.camera || this.currentScene?.getObjectByName?.('MainCamera'));
          const zoom = cam2 ? (Number(cam2.zoom) || 1) : 1;
          const axisLen = 80 / zoom;
          const cX = (this._gizmo.active && this._gizmo.axis === 'x') ? [255, 180, 180, 255] : [255, 80, 80, 230];
          const cY = (this._gizmo.active && this._gizmo.axis === 'y') ? [180, 255, 180, 255] : [80, 255, 80, 230];
          const cC = (this._gizmo.active && this._gizmo.axis === 'center') ? [255, 255, 255, 255] : [255, 255, 255, 160];

          if (this._gizmo.mode === 'rotate' && this._get2DRot(obj) !== null) {
            const ringR = 55 / zoom;
            const ringC = (this._gizmo.active && this._gizmo.axis === 'rot') ? [255, 255, 180, 255] : [255, 255, 0, 200];
            this._drawCircle2D(dbg, p2.x, p2.y, ringR, ringC, 2);
          } else {
            dbg.drawLine(p2.x, p2.y, p2.x + axisLen, p2.y, cX, 3);
            dbg.drawLine(p2.x, p2.y, p2.x, p2.y + axisLen, cY, 3);
            const hs = 6 / zoom;
            dbg.drawRect(p2.x - hs, p2.y - hs, hs * 2, hs * 2, cC, 2, false);
          }

          const size = 10;
          // Crosshair at position
          dbg.drawLine(p2.x - size, p2.y, p2.x + size, p2.y, [255, 255, 0, 220], 2);
          dbg.drawLine(p2.x, p2.y - size, p2.x, p2.y + size, [255, 255, 0, 220], 2);

          // Rect if width/height are available
          if (typeof obj.width === 'number' && typeof obj.height === 'number') {
            dbg.drawRect(p2.x, p2.y, Number(obj.width) || 0, Number(obj.height) || 0, [255, 0, 255, 120], 2, false);
          }
        }
      }

      // 3D debug (renders at end of 3D pass)
      if (this.mode === '3d' && typeof dbg.drawLine3D === 'function') {
        const p = this._getGizmoPos3D(obj);
        if (p) {
          // Translate/Rotate gizmo (3D)
          const s = 1.2;
          const cX = (this._gizmo.active && this._gizmo.axis === 'x') ? [255, 180, 180, 255] : [255, 80, 80, 255];
          const cY = (this._gizmo.active && this._gizmo.axis === 'y') ? [180, 255, 180, 255] : [80, 255, 80, 255];
          const cZ = (this._gizmo.active && this._gizmo.axis === 'z') ? [180, 220, 255, 255] : [80, 160, 255, 255];

          if (this._gizmo.mode === 'rotate' && this._canRotate3D(obj)) {
            const ringR = 1.0;
            this._drawCircle3D(dbg, p, ringR, 'x', cX, 2, depth);
            this._drawCircle3D(dbg, p, ringR, 'y', cY, 2, depth);
            this._drawCircle3D(dbg, p, ringR, 'z', cZ, 2, depth);
          } else {
            dbg.drawLine3D(p.x, p.y, p.z, p.x + s, p.y, p.z, cX, 2, depth);
            dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y + s, p.z, cY, 2, depth);
            dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y, p.z - s, cZ, 2, depth);
          }

          if (ui.dbgShowAxes?.checked) {
            const s = 0.8;
            dbg.drawLine3D(p.x, p.y, p.z, p.x + s, p.y, p.z, [255, 80, 80, 255], 2, depth);
            dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y + s, p.z, [80, 255, 80, 255], 2, depth);
            dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y, p.z - s, [80, 160, 255, 255], 2, depth);
          }

          if (ui.dbgShowAabb?.checked) {
            // Approx AABB as a 2x2x2 cube around the position.
            const s = 1.0;
            const minX = p.x - s, maxX = p.x + s;
            const minY = p.y - s, maxY = p.y + s;
            const minZ = p.z - s, maxZ = p.z + s;
            const c = [255, 0, 255, 170];

            // bottom
            dbg.drawLine3D(minX, minY, minZ, maxX, minY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, minZ, maxX, minY, maxZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, maxZ, minX, minY, maxZ, c, 1, depth);
            dbg.drawLine3D(minX, minY, maxZ, minX, minY, minZ, c, 1, depth);
            // top
            dbg.drawLine3D(minX, maxY, minZ, maxX, maxY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, maxY, minZ, maxX, maxY, maxZ, c, 1, depth);
            dbg.drawLine3D(maxX, maxY, maxZ, minX, maxY, maxZ, c, 1, depth);
            dbg.drawLine3D(minX, maxY, maxZ, minX, maxY, minZ, c, 1, depth);
            // sides
            dbg.drawLine3D(minX, minY, minZ, minX, maxY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, minZ, maxX, maxY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, maxZ, maxX, maxY, maxZ, c, 1, depth);
            dbg.drawLine3D(minX, minY, maxZ, minX, maxY, maxZ, c, 1, depth);
          }
        }
      }
    }

    if (this.currentScene) this.currentScene.draw(renderer);

    // Viewport icon overlays (draw after scene so they stay visible).
    if (this.mode === '2d') {
      const cam2 = /** @type {any} */ (this.currentScene?.camera);
      if (cam2) this._drawAudioIcons2D(renderer, cam2);
    }
  },
};

new Engine("gameCanvas", game, 1280, 720, true, true, {
  renderer: {
    webglVersion: 2,
    allowFallback: true,
    renderTargets: { msaaSamples: 4 },
    // The editor embeds the canvas in a layout; let CSS drive its on-page size.
    respectCssSize: true,
  },
  input: {
    lockMouse: false,
  },
});
