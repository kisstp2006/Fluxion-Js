/**
 * Simple DOM-based splash overlay.
 *
 * - Enabled mode: shows a centered logo with slow fade in/out and slow zoom.
 * - Disabled mode: optionally shows "Made with Fluxion" for a fixed duration.
 */
export default class SplashScreen {
    static _styleInjected = false;

    constructor() {
        this._root = null;
        this._mode = null;
        this._hidePromise = null;

        if (!SplashScreen._styleInjected) {
            SplashScreen._injectStyles();
            SplashScreen._styleInjected = true;
        }
    }

    static _injectStyles() {
        const style = document.createElement('style');
        style.setAttribute('data-fluxion-splash', 'true');
        style.textContent = `
            .fluxion-splash {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #000;
                z-index: 999999;
                pointer-events: none;
                opacity: 1;
            }

            .fluxion-splash__content {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                transform-origin: center;
            }

            .fluxion-splash__logo {
                color: #fff;
                font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                font-size: 48px;
                letter-spacing: 0.08em;
                text-transform: none;
                user-select: none;
                will-change: transform, opacity;
            }

            .fluxion-splash__logo-img {
                width: 160px;
                height: auto;
                display: block;
                user-select: none;
                -webkit-user-drag: none;
            }

            .fluxion-splash--loading .fluxion-splash__content {
                animation: fluxionSplashZoom 8s ease-in-out infinite alternate;
            }

            .fluxion-splash--loading .fluxion-splash__logo,
            .fluxion-splash--loading .fluxion-splash__logo-img {
                animation: fluxionSplashFade 3.6s ease-in-out infinite alternate;
            }

            .fluxion-splash--branding .fluxion-splash__logo {
                animation: fluxionSplashBrandFadeIn 250ms ease-out forwards;
                font-size: 28px;
                letter-spacing: 0.02em;
            }

            .fluxion-splash--hide {
                transition: opacity 300ms ease-out;
                opacity: 0;
            }

            @keyframes fluxionSplashFade {
                from { opacity: 0.25; }
                to   { opacity: 1; }
            }

            @keyframes fluxionSplashZoom {
                from { transform: scale(0.96); }
                to   { transform: scale(1.06); }
            }

            @keyframes fluxionSplashBrandFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;

        document.head.appendChild(style);
    }

    _ensureRoot() {
        if (this._root && document.body.contains(this._root)) return;

        const root = document.createElement('div');
        root.className = 'fluxion-splash';

        const content = document.createElement('div');
        content.className = 'fluxion-splash__content';

        root.appendChild(content);

        document.body.appendChild(root);
        this._root = root;
    }

    showLoading({ logoText = 'Fluxion', logoUrl = null } = {}) {
        this._mode = 'loading';
        this._hidePromise = null;
        this._ensureRoot();

        this._root.classList.remove('fluxion-splash--branding', 'fluxion-splash--hide');
        this._root.classList.add('fluxion-splash--loading');

        const content = this._root.firstChild;
        content.replaceChildren();

        if (logoUrl) {
            const img = document.createElement('img');
            img.className = 'fluxion-splash__logo-img';
            img.alt = logoText;
            img.src = logoUrl;
            content.appendChild(img);
        } else {
            const logo = document.createElement('div');
            logo.className = 'fluxion-splash__logo';
            logo.textContent = logoText;
            content.appendChild(logo);
        }
    }

    showMadeWithFluxion(durationMs = 3000) {
        this._mode = 'branding';
        this._hidePromise = null;
        this._ensureRoot();

        this._root.classList.remove('fluxion-splash--loading', 'fluxion-splash--hide');
        this._root.classList.add('fluxion-splash--branding');

        const content = this._root.firstChild;
        content.replaceChildren();

        const text = document.createElement('div');
        text.className = 'fluxion-splash__logo';
        text.textContent = 'Made with Fluxion';
        content.appendChild(text);

        window.setTimeout(() => {
            // Don’t remove if something else took over (e.g., loading splash).
            if (this._mode === 'branding') {
                this.hide();
            }
        }, durationMs);
    }

    hide() {
        if (!this._root || !document.body.contains(this._root)) {
            return Promise.resolve();
        }

        if (this._hidePromise) return this._hidePromise;

        this._hidePromise = new Promise((resolve) => {
            const root = this._root;
            root.classList.add('fluxion-splash--hide');

            const cleanup = () => {
                root.removeEventListener('transitionend', cleanup);
                if (root.parentNode) root.parentNode.removeChild(root);
                if (this._root === root) this._root = null;
                resolve();
            };

            // Transition end is best-effort; also add a timeout fallback.
            root.addEventListener('transitionend', cleanup);
            window.setTimeout(cleanup, 400);
        });

        return this._hidePromise;
    }
}
