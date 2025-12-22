import Scene from './Scene.js';
import Sprite from './Sprite.js';
import AnimatedSprite from './AnimatedSprite.js';
import Audio from './Audio.js';
import Camera from './Camera.js';
import ClickableArea from './ClickableArea.js';
import Text from './Text.js';

export default class SceneLoader {
    static async load(url, renderer) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch scene file: ${url}`);
            
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/xml");
            
            const sceneNode = doc.querySelector("Scene");
            if (!sceneNode) throw new Error("Invalid scene file: No <Scene> tag found.");

            const scene = new Scene();
            if (sceneNode.hasAttribute("name")) {
                scene.name = sceneNode.getAttribute("name");
            }

            // Pre-load fonts
            const fontNodes = sceneNode.querySelectorAll("Font");
            const fontPromises = [];
            for (const fontNode of fontNodes) {
                const src = fontNode.getAttribute("src");
                const family = fontNode.getAttribute("family");
                if (src && family) {
                    console.log(`Loading font: ${family} from ${src}`);
                    const font = new FontFace(family, `url(${src})`);
                    fontPromises.push(
                        font.load()
                            .then(f => {
                                document.fonts.add(f);
                                console.log(`Font loaded: ${family}`);
                            })
                            .catch(err => console.error(`Failed to load font ${family}:`, err))
                    );
                }
            }
            if (fontPromises.length > 0) {
                await Promise.all(fontPromises);
            }

            // Parse children
            for (const child of sceneNode.children) {
                if (child.tagName === "Font") continue;
                const obj = await this.parseObject(child, renderer);
                if (obj) {
                    if (obj instanceof Camera) {
                        scene.setCamera(obj);
                    } else if (obj instanceof Audio) {
                        scene.addAudio(obj);
                    } else {
                        scene.add(obj);
                    }
                }
            }

            return scene;
        } catch (error) {
            console.error("SceneLoader Error:", error);
            return new Scene(); // Return empty scene on error
        }
    }

    static async parseObject(node, renderer) {
        const tagName = node.tagName;
        let obj = null;
        
        // Helper to get attributes
        const getFloat = (name, def = 0) => {
            const val = node.getAttribute(name);
            return val !== null ? parseFloat(val) : def;
        };
        const getFloatAny = (names, def = 0) => {
            for (const name of names) {
                const val = node.getAttribute(name);
                if (val !== null) return parseFloat(val);
            }
            return def;
        };
        const getString = (name, def = "") => node.getAttribute(name) || def;
        const getBool = (name, def = false) => node.getAttribute(name) === "true";

        if (tagName === "Sprite") {
            const src = getString("imageSrc");
            const x = getFloat("x");
            const y = getFloat("y");
            const w = getFloat("width", 1);
            const h = getFloat("height", 1);
            
            const sprite = new Sprite(renderer, src, x, y, w, h);
            sprite.name = getString("name");
            obj = sprite;
        }
        
        else if (tagName === "AnimatedSprite") {
            const src = getString("imageSrc");
            const x = getFloat("x");
            const y = getFloat("y");
            const w = getFloat("width", 1);
            const h = getFloat("height", 1);
            const fw = getFloat("frameWidth");
            const fh = getFloat("frameHeight");
            
            const sprite = new AnimatedSprite(renderer, src, x, y, w, h, fw, fh);
            sprite.name = getString("name");
            
            let firstAnimName = null;
            let hasAutoplay = false;

            // Parse animations
            for (const animNode of node.children) {
                if (animNode.tagName === "Animation") {
                    const name = animNode.getAttribute("name");
                    const framesStr = animNode.getAttribute("frames"); // "0,1,2"
                    const fps = parseFloat(animNode.getAttribute("speed") || "10");
                    const loop = animNode.getAttribute("loop") !== "false";
                    
                    if (name && framesStr) {
                        let frames;
                        // Check if frames are numeric indices or file paths
                        // If any part is not a number, treat as paths
                        if (/[^0-9,\s]/.test(framesStr)) {
                            frames = framesStr.split(',').map(s => s.trim());
                        } else {
                            frames = framesStr.split(',').map(s => parseInt(s.trim()));
                        }

                        sprite.addAnimation(name, frames, fps, loop);
                        
                        if (!firstAnimName) firstAnimName = name;

                        // Auto play if specified
                        if (animNode.getAttribute("autoplay") === "true") {
                            sprite.play(name);
                            hasAutoplay = true;
                        }
                    }
                }
            }
            
            // Default to first animation if no autoplay specified
            if (!hasAutoplay && firstAnimName) {
                sprite.play(firstAnimName);
            }
            
            obj = sprite;
        }

        else if (tagName === "ClickableArea") {
            const area = new ClickableArea(renderer);
            area.name = getString("name", "ClickableArea");

            // Optional hitbox rectangle (local to parent top-left).
            // If width/height are omitted, defaults to parent's bounds.
            // Coordinates are in pixels in the new coordinate system.
            area.x = getFloat("x", 0);
            area.y = getFloat("y", 0);
            if (node.hasAttribute("width")) area.width = getFloat("width");
            if (node.hasAttribute("height")) area.height = getFloat("height");

            obj = area;
        }

        else if (tagName === "Text") {
            const textContent = getString("text", "New Text");
            const x = getFloat("x", 0);
            const y = getFloat("y", 0);
            // Accept both XML-style `fontSize` and common XAML-style `FontSize`
            const fontSize = getFloatAny(["fontSize", "FontSize"], 16);
            let fontFamily = getString("fontFamily", "Inter");
            const color = getString("color", "white");

            // Check if fontFamily is actually a file path (contains '/' or ends in extension)
            if (fontFamily.includes('/') || fontFamily.match(/\.(ttf|otf|woff|woff2)$/i)) {
                const fontPath = fontFamily;
                // Generate a unique family name based on the filename
                const familyName = "AutoFont_" + fontPath.split('/').pop().replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "");
                
                // Check if already loaded
                let fontExists = false;
                document.fonts.forEach(f => {
                    if (f.family === familyName) fontExists = true;
                });

                if (!fontExists) {
                    console.log(`Auto-loading font from path: ${fontPath} as ${familyName}`);
                    try {
                        const font = new FontFace(familyName, `url(${fontPath})`);
                        await font.load();
                        document.fonts.add(font);
                    } catch (err) {
                        console.error(`Failed to auto-load font from ${fontPath}:`, err);
                        // Fallback to default if load fails
                    }
                }
                fontFamily = familyName;
            }

            const textObj = new Text(renderer, textContent, x, y, fontSize, fontFamily, color);
            textObj.name = getString("name", "Text");
            obj = textObj;
        }

        else if (tagName === "Audio") {
            const src = getString("src");
            const loop = getBool("loop", false);
            const volume = getFloat("volume", 1.0);
            const autoplay = getBool("autoplay", false);

            const audio = new Audio();
            audio.name = getString("name");
            if (src) {
                // Start loading but don't await it here to avoid blocking scene load too much?
                // Actually, Audio.load is async.
                await audio.load(src);
            }
            audio.loop = loop;
            audio.volume = volume;
            
            if (autoplay) {
                // We might need to wait for user interaction before playing audio in some browsers,
                // but let's assume the engine handles that or the user has already interacted.
                // Also, audio.play() checks if buffer is loaded. Since we awaited load, it should be fine.
                audio.play();
            }

            obj = audio;
        }

        else if (tagName === "Camera") {
            const x = getFloat("x", 0);
            const y = getFloat("y", 0);
            const zoom = getFloat("zoom", 1);
            const rotation = getFloat("rotation", 0);
            
            // Use renderer's target resolution as fallback if available, otherwise default to 1920x1080
            const defaultWidth = renderer ? renderer.targetWidth : 1920;
            const defaultHeight = renderer ? renderer.targetHeight : 1080;

            const width = getFloat("width", defaultWidth);
            const height = getFloat("height", defaultHeight);
            
            // Camera constructor: x, y, zoom, rotation, width, height
            const camera = new Camera(x, y, zoom, rotation, width, height);
            camera.name = getString("name");
            obj = camera;
        }

        // Common properties
        if (obj) {
            if (node.hasAttribute("layer")) {
                const layer = parseFloat(node.getAttribute("layer"));
                if (typeof obj.setLayer === 'function') {
                    obj.setLayer(layer);
                } else {
                    obj.layer = layer;
                }
            }

            const activeAttr = node.getAttribute("Active");
            if (activeAttr !== null) {
                obj.active = activeAttr !== "false";
            }
        }

        // Handle children
        if (obj && obj.addChild) {
             for (const childNode of node.children) {
                 if (childNode.tagName === "Animation") continue;
                 const childObj = await this.parseObject(childNode, renderer);
                 if (childObj) {
                     obj.addChild(childObj);
                 }
             }
        }

        return obj;
    }
}
