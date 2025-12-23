/**
 * Handles window management, providing an abstraction over Electron API and browser fallback.
 */
export default class Window {
    /**
     * Creates an instance of Window.
     */
    constructor() {
        this.api = window.electronAPI;
        this.isElectron = !!this.api;
    }

    /**
     * Sets the window title.
     * @param {string} title - The new title.
     */
    setTitle(title) {
        if (this.isElectron) {
            this.api.setTitle(title);
        } else {
            document.title = title;
        }
    }

    /**
     * Sets the window to full screen mode.
     * @param {boolean} flag - True to enable full screen, false to disable.
     */
    setFullScreen(flag) {
        if (this.isElectron) {
            this.api.setFullScreen(flag);
        } else {
            // Browser fallback
            if (flag) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.warn(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        }
    }

    /**
     * Minimizes the window.
     * Only supported in Electron.
     */
    minimize() {
        if (this.isElectron) {
            this.api.minimize();
        } else {
            console.warn("Minimize not supported in browser mode.");
        }
    }

    /**
     * Maximizes the window.
     * Only supported in Electron.
     */
    maximize() {
        if (this.isElectron) {
            this.api.maximize();
        } else {
            console.warn("Maximize not supported in browser mode.");
        }
    }

    /**
     * Closes the window.
     * Only supported in Electron.
     */
    close() {
        if (this.isElectron) {
            this.api.close();
        } else {
            console.warn("Close not supported in browser mode. Try closing the tab.");
            window.close(); // Might work if script opened the window
        }
    }

    /**
     * Resizes the window.
     * Only supported in Electron.
     * @param {number} width - The new width.
     * @param {number} height - The new height.
     */
    resize(width, height) {
        if (this.isElectron) {
            this.api.resize(width, height);
        } else {
            console.warn("Resize not supported in browser mode.");
            // Could potentially resize canvas, but that's renderer's job
        }
    }
}
