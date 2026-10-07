/**
 * Adapter Registry and Factory for Video Model Adapters.
 */

import { MockVideoModelAdapter } from './mock-video-adapter.js';
import { Wan21VideoAdapter } from './wan21-video-adapter.js';
import { LightweightLocalVideoAdapter } from './lightweight-local-adapter.js';
import { HardwareDetector } from '../hardware/hardware-detector.js';

export class AdapterRegistry {
  /**
   * @param {object} [config={}]
   * @param {HardwareDetector} [hardwareDetector]
   */
  constructor(config = {}, hardwareDetector = new HardwareDetector()) {
    this.config = config;
    this.hardwareDetector = hardwareDetector;
    this.adapters = new Map();

    // Register built-in adapters
    this.register('mock', new MockVideoModelAdapter(config));
    this.register('mock-video', new MockVideoModelAdapter(config));
    this.register('wan2.1', new Wan21VideoAdapter(config, hardwareDetector));
    this.register('t2v-1.3b', new Wan21VideoAdapter(config, hardwareDetector));
    this.register('lightweight', new LightweightLocalVideoAdapter(config, hardwareDetector));
    this.register('lightweight-local', new LightweightLocalVideoAdapter(config, hardwareDetector));
  }

  /**
   * Registers a model adapter instance.
   * @param {string} name
   * @param {import('./video-model-adapter.js').VideoModelAdapter} adapter
   */
  register(name, adapter) {
    this.adapters.set(name.toLowerCase(), adapter);
  }

  /**
   * Retrieves an adapter by provider/model name.
   * @param {string} [name='mock']
   * @returns {import('./video-model-adapter.js').VideoModelAdapter}
   */
  getAdapter(name = 'mock') {
    const key = (name || 'mock').toLowerCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      // Fallback to mock adapter
      return this.adapters.get('mock');
    }
    return adapter;
  }
}
