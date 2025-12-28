import { Engine, Sprite, Input } from "../../Fluxion/index.js";

const input = new Input();
const LOGO = "../../Fluxion/Icon/Fluxion_icon.png";

function setActiveEffectsText(text) {
    const el = document.getElementById("activeEffects");
    if (el) el.textContent = text;
}

const game = {
    engine: null,
    sprites: [],
    t: 0,

    init(renderer) {
        // Background + moving logo so post effects are obvious.
        this.sprites.push(new Sprite(renderer, LOGO, 0, 0, 1920, 1080));
        this.sprites.push(new Sprite(renderer, LOGO, 760, 340, 400, 400));
        setActiveEffectsText("(none)");
    },

    update(dt) {
        this.t += dt;

        // Move the foreground logo in a smooth loop.
        const s = this.sprites[1];
        if (s) {
            s.x = 760 + Math.cos(this.t * 0.9) * 200;
            s.y = 340 + Math.sin(this.t * 1.1) * 200;
        }

        const pp = this.engine?.renderer?.postProcessing;
        if (pp && pp.isReady) {
            const toggle = (key, effectName) => {
                if (!input.getKeyDown(key)) return;
                if (pp.activeEffects.includes(effectName)) pp.disableEffect(effectName);
                else pp.enableEffect(effectName);
            };

            toggle("1", "grayscale");
            toggle("2", "blur");
            toggle("3", "crt");
            toggle("4", "contrast");

            if (input.getKeyDown("0")) {
                pp.clearEffects();
            }

            // Update time uniform for CRT effect (only needed when enabled)
            if (pp.activeEffects.includes("crt")) {
                pp.setUniform("crt", "time", performance.now() / 1000);
            }

            setActiveEffectsText(pp.activeEffects.length ? pp.activeEffects.join(", ") : "(none)");
        }

        // Update previous input state AFTER we query getKeyDown.
        // Input is updated by Engine each frame.
    },

    draw(renderer) {
        // Engine already clears + applies camera transform.
        for (const sprite of this.sprites) sprite.draw();
    },
};

window.addEventListener("load", () => {
    game.engine = new Engine("gameCanvas", game, 1920, 1080, true, true);
});
