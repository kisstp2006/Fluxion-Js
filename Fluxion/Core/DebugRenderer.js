import Text from './Text.js';

/**
 * Debug rendering utility for drawing lines, shapes, and debug text.
 * Useful for visualizing physics, collision boundaries, raycasts, etc.
 * 
 * @example
 * // Access debug renderer from renderer
 * const debug = renderer.debug;
 * 
 * // Draw a line
 * debug.drawLine(0, 0, 100, 100, [255, 0, 0, 255], 2);
 * 
 * // Draw a rectangle outline
 * debug.drawRect(50, 50, 100, 100, [0, 255, 0, 255], 2);
 * 
 * // Draw a filled circle
 * debug.drawCircleFilled(200, 200, 50, [0, 0, 255, 128]);
 * 
 * // Draw debug text
 * debug.drawText("Position: " + x + ", " + y, x, y, [255, 255, 255, 255], 12);
 * 
 * // Enable/disable debug rendering
 * debug.setEnabled(false); // Disable all debug rendering
 */
export default class DebugRenderer {
  /**
   * Creates an instance of DebugRenderer.
   * @param {import('./Renderer.js').default} renderer - The main renderer instance.
   */
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    
    // Command queue (cleared each frame)
    this._lineCommands = [];
    this._rectCommands = [];
    this._circleCommands = [];
    this._pointCommands = [];
    this._textCommands = [];
    
    // Create a 1x1 white texture for drawing shapes
    this._whiteTexture = null;
    
    // Text object pool for debug text rendering
    this._textPool = [];
    this._activeTextObjects = [];
    
    // Default colors (RGBA 0-255)
    this.defaultLineColor = [255, 0, 0, 255]; // Red
    this.defaultRectColor = [0, 255, 0, 128]; // Green with transparency
    this.defaultCircleColor = [0, 0, 255, 128]; // Blue with transparency
    this.defaultPointColor = [255, 255, 0, 255]; // Yellow
    this.defaultTextColor = [255, 255, 255, 255]; // White
  }

  /**
   * Initialize a 1x1 white texture for drawing shapes.
   * @private
   */
  _initWhiteTexture() {
    if (!this.renderer || !this.renderer.gl || !this.renderer.isReady) {
      return false;
    }
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 1, 1);
      
      this._whiteTexture = this.renderer.createTexture(canvas);
      return this._whiteTexture !== null;
    } catch (e) {
      console.warn('Failed to create debug white texture:', e);
      return false;
    }
  }
  
  /**
   * Get a Text object from the pool or create a new one.
   * @private
   */
  _getTextObject(text, x, y, fontSize, color) {
    let textObj = this._textPool.pop();
    if (!textObj) {
      textObj = new Text(this.renderer, text, x, y, fontSize, 'Inter', color);
    } else {
      // Reuse existing text object
      textObj.text = text;
      textObj.x = x;
      textObj.y = y;
      textObj.fontSize = fontSize;
      textObj.textColor = color;
      textObj.updateTexture();
    }
    return textObj;
  }
  
  /**
   * Return a Text object to the pool.
   * @private
   */
  _returnTextObject(textObj) {
    if (textObj && this._textPool.length < 20) { // Limit pool size
      this._textPool.push(textObj);
    }
  }

  /**
   * Enable or disable debug rendering.
   * @param {boolean} enabled - Whether debug rendering is enabled.
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Clear all debug commands for the current frame.
   * Called automatically at the start of each frame.
   */
  clear() {
    // Return text objects to pool
    for (const textObj of this._activeTextObjects) {
      this._returnTextObject(textObj);
    }
    this._activeTextObjects.length = 0;
    
    // Clear command queues
    this._lineCommands.length = 0;
    this._rectCommands.length = 0;
    this._circleCommands.length = 0;
    this._pointCommands.length = 0;
    this._textCommands.length = 0;
  }

  /**
   * Draw a line from point A to point B.
   * @param {number} x1 - Start X coordinate.
   * @param {number} y1 - Start Y coordinate.
   * @param {number} x2 - End X coordinate.
   * @param {number} y2 - End Y coordinate.
   * @param {number[]} [color=[255,0,0,255]] - Line color [R, G, B, A] (0-255).
   * @param {number} [thickness=1] - Line thickness in pixels.
   */
  drawLine(x1, y1, x2, y2, color = null, thickness = 1) {
    if (!this.enabled) return;
    this._lineCommands.push({
      x1, y1, x2, y2,
      color: color || this.defaultLineColor,
      thickness: Math.max(1, thickness)
    });
  }

  /**
   * Draw a rectangle outline.
   * @param {number} x - X coordinate (top-left).
   * @param {number} y - Y coordinate (top-left).
   * @param {number} width - Rectangle width.
   * @param {number} height - Rectangle height.
   * @param {number[]} [color=[0,255,0,128]] - Line color [R, G, B, A] (0-255).
   * @param {number} [thickness=1] - Line thickness in pixels.
   * @param {boolean} [filled=false] - Whether to fill the rectangle.
   */
  drawRect(x, y, width, height, color = null, thickness = 1, filled = false) {
    if (!this.enabled) return;
    this._rectCommands.push({
      x, y, width, height,
      color: color || (filled ? this.defaultRectColor : this.defaultRectColor),
      thickness: Math.max(1, thickness),
      filled
    });
  }

  /**
   * Draw a filled rectangle.
   * @param {number} x - X coordinate (top-left).
   * @param {number} y - Y coordinate (top-left).
   * @param {number} width - Rectangle width.
   * @param {number} height - Rectangle height.
   * @param {number[]} [color=[0,255,0,128]] - Fill color [R, G, B, A] (0-255).
   */
  drawRectFilled(x, y, width, height, color = null) {
    this.drawRect(x, y, width, height, color, 1, true);
  }

  /**
   * Draw a circle outline.
   * @param {number} x - Center X coordinate.
   * @param {number} y - Center Y coordinate.
   * @param {number} radius - Circle radius.
   * @param {number[]} [color=[0,0,255,128]] - Line color [R, G, B, A] (0-255).
   * @param {number} [thickness=1] - Line thickness in pixels.
   * @param {boolean} [filled=false] - Whether to fill the circle.
   * @param {number} [segments=32] - Number of segments for the circle (more = smoother).
   */
  drawCircle(x, y, radius, color = null, thickness = 1, filled = false, segments = 32) {
    if (!this.enabled) return;
    this._circleCommands.push({
      x, y, radius,
      color: color || (filled ? this.defaultCircleColor : this.defaultCircleColor),
      thickness: Math.max(1, thickness),
      filled,
      segments: Math.max(8, segments)
    });
  }

  /**
   * Draw a filled circle.
   * @param {number} x - Center X coordinate.
   * @param {number} y - Center Y coordinate.
   * @param {number} radius - Circle radius.
   * @param {number[]} [color=[0,0,255,128]] - Fill color [R, G, B, A] (0-255).
   * @param {number} [segments=32] - Number of segments for the circle.
   */
  drawCircleFilled(x, y, radius, color = null, segments = 32) {
    this.drawCircle(x, y, radius, color, 1, true, segments);
  }

  /**
   * Draw a point (small square).
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @param {number[]} [color=[255,255,0,255]] - Point color [R, G, B, A] (0-255).
   * @param {number} [size=4] - Point size in pixels.
   */
  drawPoint(x, y, color = null, size = 4) {
    if (!this.enabled) return;
    this._pointCommands.push({
      x, y,
      color: color || this.defaultPointColor,
      size: Math.max(1, size)
    });
  }

  /**
   * Draw debug text at a world position.
   * @param {string} text - Text to display.
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @param {number[]} [color=[255,255,255,255]] - Text color [R, G, B, A] (0-255).
   * @param {number} [fontSize=12] - Font size in pixels.
   */
  drawText(text, x, y, color = null, fontSize = 12) {
    if (!this.enabled) return;
    this._textCommands.push({
      text: String(text),
      x, y,
      color: color || this.defaultTextColor,
      fontSize: Math.max(8, fontSize)
    });
  }

  /**
   * Render all queued debug commands.
   * Should be called after the main game rendering, typically in endFrame.
   */
  render() {
    if (!this.enabled || !this.renderer || !this.renderer.isReady) return;
    
    // Ensure white texture is initialized
    if (!this._whiteTexture) {
      if (!this._initWhiteTexture()) {
        // Failed to create texture, skip rendering this frame
        return;
      }
    }

    // Render lines
    for (const cmd of this._lineCommands) {
      this._drawLineImpl(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.color, cmd.thickness);
    }

    // Render rectangles
    for (const cmd of this._rectCommands) {
      if (cmd.filled) {
        // drawQuad(texture, x, y, width, height, color)
        this.renderer.drawQuad(this._whiteTexture, cmd.x, cmd.y, cmd.width, cmd.height, cmd.color);
      } else {
        // Draw rectangle outline as 4 lines
        const t = cmd.thickness;
        this._drawLineImpl(cmd.x, cmd.y, cmd.x + cmd.width, cmd.y, cmd.color, t);
        this._drawLineImpl(cmd.x + cmd.width, cmd.y, cmd.x + cmd.width, cmd.y + cmd.height, cmd.color, t);
        this._drawLineImpl(cmd.x + cmd.width, cmd.y + cmd.height, cmd.x, cmd.y + cmd.height, cmd.color, t);
        this._drawLineImpl(cmd.x, cmd.y + cmd.height, cmd.x, cmd.y, cmd.color, t);
      }
    }

    // Render circles
    for (const cmd of this._circleCommands) {
      if (cmd.filled) {
        this._drawCircleFilledImpl(cmd.x, cmd.y, cmd.radius, cmd.color, cmd.segments);
      } else {
        this._drawCircleOutlineImpl(cmd.x, cmd.y, cmd.radius, cmd.color, cmd.thickness, cmd.segments);
      }
    }

    // Render points
    for (const cmd of this._pointCommands) {
      const halfSize = cmd.size * 0.5;
      this.renderer.drawQuad(
        this._whiteTexture,
        cmd.x - halfSize,
        cmd.y - halfSize,
        cmd.size,
        cmd.size,
        cmd.color
      );
    }

    // Render text (using Text class with object pooling)
    for (const cmd of this._textCommands) {
      const colorStr = `rgba(${cmd.color[0]},${cmd.color[1]},${cmd.color[2]},${cmd.color[3] / 255})`;
      const textObj = this._getTextObject(cmd.text, cmd.x, cmd.y, cmd.fontSize, colorStr);
      textObj.draw();
      this._activeTextObjects.push(textObj);
    }
  }

  /**
   * Internal implementation for drawing a line.
   * @private
   */
  _drawLineImpl(x1, y1, x2, y2, color, thickness) {
    // Calculate line direction and length
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 0.001) {
      // Degenerate line, draw as point
      this.renderer.drawQuad(this._whiteTexture, x1 - thickness * 0.5, y1 - thickness * 0.5, thickness, thickness, color);
      return;
    }

    // Calculate angle
    const angle = Math.atan2(dy, dx);
    
    // Calculate center
    const cx = (x1 + x2) * 0.5;
    const cy = (y1 + y2) * 0.5;
    
    // Draw line as a rotated rectangle
    // For simplicity, we'll draw it as a series of small quads or use a single rotated quad
    // Since we don't have rotation in drawQuad, we'll approximate with a thick line using multiple quads
    const segments = Math.max(1, Math.ceil(length / thickness));
    const segmentLength = length / segments;
    
    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      const sx1 = x1 + dx * t1;
      const sy1 = y1 + dy * t1;
      const sx2 = x1 + dx * t2;
      const sy2 = y1 + dy * t2;
      
      // Draw segment as a small rectangle
      const segDx = sx2 - sx1;
      const segDy = sy2 - sy1;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      
      if (segLen > 0.001) {
        // Perpendicular vector for thickness
        const perpX = -segDy / segLen * thickness;
        const perpY = segDx / segLen * thickness;
        
        // Draw as a quad (approximation - not perfect rotation but good enough for debug)
        const midX = (sx1 + sx2) * 0.5;
        const midY = (sy1 + sy2) * 0.5;
        
        this.renderer.drawQuad(
          this._whiteTexture,
          midX - thickness * 0.5,
          midY - thickness * 0.5,
          segLen + thickness,
          thickness,
          color
        );
      }
    }
  }

  /**
   * Internal implementation for drawing a circle outline.
   * @private
   */
  _drawCircleOutlineImpl(x, y, radius, color, thickness, segments) {
    const angleStep = (Math.PI * 2) / segments;
    let prevX = x + radius;
    let prevY = y;
    
    for (let i = 1; i <= segments; i++) {
      const angle = i * angleStep;
      const currX = x + Math.cos(angle) * radius;
      const currY = y + Math.sin(angle) * radius;
      
      this._drawLineImpl(prevX, prevY, currX, currY, color, thickness);
      
      prevX = currX;
      prevY = currY;
    }
  }

  /**
   * Internal implementation for drawing a filled circle.
   * @private
   */
  _drawCircleFilledImpl(x, y, radius, color, segments) {
    // Draw circle as a simple filled square for debug rendering
    // This is fast and reliable - good enough for debug visualization
    const diameter = radius * 2;
    
    // drawQuad(texture, x, y, width, height, color)
    this.renderer.drawQuad(
      this._whiteTexture,
      x - radius,
      y - radius,
      diameter,
      diameter,
      color
    );
  }
}

