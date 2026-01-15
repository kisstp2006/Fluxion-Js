/**
 * Represents an audio object for playing sound effects or music.
 * Uses the Web Audio API.
 */
export default class Audio {
  static audioContext = null;
 
  /**
   * Creates an instance of Audio.
   */
  constructor() {
      /** @type {'2D'|'3D'} */
      this.type = '2D';
      /** @type {string} */
      this.category = 'audio';

      if (!Audio.audioContext) {
          Audio.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      this.gainNode = Audio.audioContext.createGain();
      this.gainNode.connect(Audio.audioContext.destination);
      
      this.buffer = null;
      this.sourceNode = null;
      this.isPlaying = false;
      this.loop = false;
      this.volume = 1;
      this.startTime = 0;
      this.pauseTime = 0;
      this._active = true;
      this.stopOnSceneChange = true; // Default: stop audio when scene changes
      this.autoplay = false; // Whether this audio should autoplay when scene becomes active
  }

  /**
   * Gets the active state of the audio object.
   * @returns {boolean} True if active, false otherwise.
   */
  get active() { return this._active; }

  /**
   * Sets the active state of the audio object.
   * If set to false, the audio stops playing.
   * @param {boolean} value - The new active state.
   */
  set active(value) {
      this._active = value;
      if (!value) this.stop();
  }

  /**
   * Load an audio file from a given URL
   * @param {string} url - Path to audio file
   * @returns {Promise<void>}
   */
  async load(url) {
      try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          this.buffer = await Audio.audioContext.decodeAudioData(arrayBuffer);
      } catch (error) {
          console.error('Error loading audio:', error);
      }
  }

  /**
   * Play the audio
   * @param {boolean} [reset=false] - Whether to restart from the beginning
   */
  play(reset = false) {
      if (!this.active) return;
      if (!this.buffer || this.isPlaying) return;

      if (reset) this.stop();

      this.sourceNode = Audio.audioContext.createBufferSource();
      this.sourceNode.buffer = this.buffer;
      this.sourceNode.loop = this.loop;
      this.sourceNode.connect(this.gainNode);

      this.gainNode.gain.setValueAtTime(this.volume, Audio.audioContext.currentTime);
      
      const startOffset = reset ? 0 : this.pauseTime;
      this.sourceNode.start(0, startOffset);

      this.startTime = Audio.audioContext.currentTime - startOffset;
      this.isPlaying = true;

      this.sourceNode.onended = () => {
          if (!this.loop) {
              this.isPlaying = false;
              this.pauseTime = 0;
              this.startTime = 0;
          }
      };
  }

  /**
   * Pause the audio
   */
  pause() {
      if (!this.isPlaying || !this.sourceNode) return;

      try {
          this.sourceNode.stop();
          this.pauseTime = Audio.audioContext.currentTime - this.startTime;
          this.isPlaying = false;
      } catch (error) {
          // Source node may already be stopped or invalid
          console.warn('Audio pause error (node may already be stopped):', error);
          this.isPlaying = false;
          this.pauseTime = 0;
      }
  }

  /**
   * Stop the audio and reset position
   */
  stop() {
      if (!this.isPlaying && this.pauseTime === 0) return;

      if (this.sourceNode) {
          try {
              this.sourceNode.stop();
              this.sourceNode.disconnect();
          } catch (error) {
              // Source node may already be stopped or invalid
              console.warn('Audio stop error (node may already be stopped):', error);
          }
          this.sourceNode = null;
      }

      this.isPlaying = false;
      this.pauseTime = 0;
      this.startTime = 0;
  }

  /**
   * Enable or disable looping
   * @param {boolean} loop - Loop state
   */
  setLoop(loop) {
      this.loop = loop;
  }

  /**
   * Set playback volume
   * @param {number} volume - Volume between 0 (mute) and 1 (max)
   */
  setVolume(volume) {
      this.volume = Math.min(Math.max(volume, 0), 1);
      this.gainNode.gain.setValueAtTime(this.volume, Audio.audioContext.currentTime);
  }

  /**
   * Resume audio context after user interaction (required for autoplay)
   */
  static resumeAudioContext() {
      if (Audio.audioContext?.state === 'suspended') {
          Audio.audioContext.resume();
      }
  }
}
