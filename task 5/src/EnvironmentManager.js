import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * HDRI-освещение: загружает .hdr-карту, готовит её через PMREMGenerator
 * и подключает как scene.environment. В режиме предпросмотра та же карта
 * служит фоном, в AR фон убирается, чтобы было видно камеру.
 */
export class EnvironmentManager {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.loader = new RGBELoader();
    this.cache = new Map();
    this.current = null;
    this.showBackground = true;
  }

  async load(url) {
    if (!this.cache.has(url)) {
      const hdr = await this.loader.loadAsync(url);
      const envMap = this.pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      this.cache.set(url, envMap);
    }
    this.current = this.cache.get(url);
    this.scene.environment = this.current;
    this.applyBackground();
  }

  setBackgroundVisible(visible) {
    this.showBackground = visible;
    this.applyBackground();
  }

  applyBackground() {
    this.scene.background = this.showBackground ? this.current : null;
    this.scene.backgroundBlurriness = 0.35;
  }
}
