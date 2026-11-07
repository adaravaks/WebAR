import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Загрузка и подготовка моделей. Каждый glTF грузится один раз,
 * дальше из кэша выдаются независимые копии с собственными материалами,
 * чтобы изменение цвета одного объекта не задевало остальные.
 */
export const MODELS = {
  cube:      { title: 'Куб (MeshStandardMaterial)', height: 0.25 },
  astronaut: { title: 'Астронавт', url: 'models/Astronaut.glb', height: 0.5 },
  boombox:   { title: 'Бумбокс (PBR-текстуры)', url: 'models/BoomBox.glb', height: 0.25 },
};

export class ModelLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async create(key) {
    const info = MODELS[key];
    const source = info.url ? await this.loadGltf(info.url) : ModelLibrary.makeCube();
    const model = source.clone(true);

    // у каждой копии – свои материалы и запомненный исходный цвет
    model.traverse((node) => {
      if (node.isMesh) {
        node.material = node.material.clone();
        node.material.userData.originalColor = node.material.color.clone();
      }
    });

    // приводим модель к нужной высоте и ставим её «на пол» (y = 0)
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(info.height / size.y);
    const scaled = new THREE.Box3().setFromObject(model);
    const center = scaled.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -scaled.min.y, -center.z);

    const wrapper = new THREE.Group();
    wrapper.add(model);
    wrapper.userData.modelKey = key;
    return wrapper;
  }

  async loadGltf(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, this.loader.loadAsync(url).then((gltf) => gltf.scene));
    }
    return this.cache.get(url);
  }

  static makeCube() {
    const material = new THREE.MeshStandardMaterial({ color: 0xd9dde6, roughness: 0.25, metalness: 1.0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), material);
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }
}
