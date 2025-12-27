import Scene from './Scene.js';
import Sprite from './Sprite.js';
import AnimatedSprite from './AnimatedSprite.js';
import Audio from './Audio.js';
import Camera from './Camera.js';
import ClickableArea from './ClickableArea.js';
import Text from './Text.js';

/**
 * Utility class for loading scenes from XML files.
 */
export default class SceneLoader {
    /**
     * Loads a scene from an XML file.
     * @param {string} url - The URL of the XML file.
     * @param {Object} renderer - The renderer instance.
     * @returns {Promise<Scene>} The loaded scene.
     */
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

            // Parse children
            for (const child of sceneNode.children) {
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

    /**
     * Parses an XML node into a game object.
     * @param {Element} node - The XML element.
     * @param {Object} renderer - The renderer instance.
     * @returns {Promise<Object|null>} The parsed object, or null if unknown.
     */
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
            const fontFamily = getString("fontFamily", "Inter");
            const color = getString("color", "white");

            const textObj = new Text(renderer, textContent, x, y, fontSize, fontFamily, color);
            textObj.name = getString("name", "Text");

            // Optional: allow Text nodes to be clickable without requiring a non-self-closing tag.
            // Example:
            //   <Text name="Play" text="Play" x="..." y="..." clickable="true" />
            // This will create a ClickableArea child that defaults to the Text's bounds.
            const clickableAttr = node.getAttribute("clickable");
            const shouldAutoClickable = clickableAttr !== null && clickableAttr.toLowerCase() === "true";
            if (shouldAutoClickable) {
                // Avoid duplicating if a ClickableArea child is already declared.
                let hasClickableChild = false;
                for (const child of node.children) {
                    if (child.tagName === "ClickableArea") {
                        hasClickableChild = true;
                        break;
                    }
                }

                if (!hasClickableChild) {
                    const area = new ClickableArea(renderer);
                    area.name = getString("clickableName", `${textObj.name}_Hitbox`);
                    // width/height remain null so it inherits Text width/height like Sprites do.
                    textObj.addChild(area);
                }
            }

            obj = textObj;
        }

        else if (tagName === "Audio") {
            const src = getString("src");
            const loop = getBool("loop", false);
            const volume = getFloat("volume", 1.0);
            const autoplay = getBool("autoplay", false);
            const stopOnSceneChange = getBool("stopOnSceneChange", true);

            const audio = new Audio();
            audio.name = getString("name");
            if (src) {
                // Start loading but don't await it here to avoid blocking scene load too much?
                // Actually, Audio.load is async.
                await audio.load(src);
            }
            audio.loop = loop;
            audio.volume = volume;
            audio.stopOnSceneChange = stopOnSceneChange;
            audio.autoplay = autoplay; // Store autoplay flag for later use
            
            // Don't autoplay here - let the scene switching logic handle it
            // This prevents audio from playing when loading scenes that aren't active yet

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
            if (node.hasAttribute("opacity")) {
                const opacity = parseFloat(node.getAttribute("opacity"));
                if (typeof obj.setTransparency === 'function') {
                    obj.setTransparency(opacity);
                }
            }

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

            const followCameraAttr = node.getAttribute("followCamera");
            if (followCameraAttr !== null && obj.hasOwnProperty('followCamera')) {
                obj.followCamera = followCameraAttr === "true";
                // If following camera, the initial x/y from XML are treated as the relative base positions
                if (obj.followCamera) {
                    obj.baseX = obj.x;
                    obj.baseY = obj.y;
                }
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
