export default class Window {
    constructor() {
        this.api = window.electronAPI;
        this.isElectron = !!this.api;
    }

    setTitle(title) {
        if (this.isElectron) {
            this.api.setTitle(title);
        } else {
            document.title = title;
        }
    }

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

    minimize() {
        if (this.isElectron) {
            this.api.minimize();
        } else {
            console.warn("Minimize not supported in browser mode.");
        }
    }

    maximize() {
        if (this.isElectron) {
            this.api.maximize();
        } else {
            console.warn("Maximize not supported in browser mode.");
        }
    }

    close() {
        if (this.isElectron) {
            this.api.close();
        } else {
            console.warn("Close not supported in browser mode. Try closing the tab.");
            window.close(); // Might work if script opened the window
        }
    }

    resize(width, height) {
        if (this.isElectron) {
            this.api.resize(width, height);
        } else {
            console.warn("Resize not supported in browser mode.");
            // Could potentially resize canvas, but that's renderer's job
        }
    }
}
