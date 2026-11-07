import * as THREE from 'three';

/**
 * Управление объектами в сцене: размещение, выбор, поворот,
 * цвет, параметры PBR-материала и замена модели.
 */
export class ObjectController {
  constructor(scene, library) {
    this.scene = scene;
    this.library = library;
    this.objects = [];
    this.selected = null;
    this.autoRotate = false;
    this.onSelectionChange = () => {};

    // кольцо под выбранным объектом
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.17, 0.19, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x5b9dff, transparent: true, opacity: 0.9 })
    );
    this.selectionRing.position.y = 0.003;
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      map: ObjectController.makeShadowTexture(), transparent: true, depthWrite: false,
    });
    this.raycaster = new THREE.Raycaster();
  }

  async place(modelKey, matrix, lookAt = null) {
    const holder = new THREE.Group();
    // у каждого объекта свои настройки материала; null – значения из самой модели
    holder.userData.material = { color: null, roughness: null, metalness: null };
    matrix.decompose(holder.position, holder.quaternion, holder.scale);
    if (lookAt) {
      // разворачиваем объект лицом к пользователю (только вокруг вертикали)
      holder.rotation.set(0, Math.atan2(lookAt.x - holder.position.x, lookAt.z - holder.position.z), 0);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4).rotateX(-Math.PI / 2), this.shadowMaterial);
    shadow.position.y = 0.002;
    holder.add(shadow);
    await this.setModel(holder, modelKey);
    this.scene.add(holder);
    this.objects.push(holder);
    this.select(holder);
    return holder;
  }

  /** Заменяет модель внутри держателя, сохраняя положение, поворот и настройки. */
  async setModel(holder, modelKey) {
    const model = await this.library.create(modelKey);
    if (holder.userData.model) holder.remove(holder.userData.model);
    holder.userData.model = model;
    holder.userData.modelKey = modelKey;
    holder.add(model);
    this.applyMaterialState(holder);
  }

  async replaceSelected(modelKey) {
    if (this.selected) await this.setModel(this.selected, modelKey);
  }

  select(holder) {
    this.selected = holder;
    if (holder) holder.add(this.selectionRing);
    this.onSelectionChange(holder);
  }

  /** Пробует выбрать уже стоящий объект лучом от контроллера / точки касания. */
  pick(controller) {
    this.raycaster.setFromXRController(controller);
    const models = this.objects.filter((o) => o.visible).map((o) => o.userData.model);
    const hit = this.raycaster.intersectObjects(models, true)[0];
    if (!hit) return false;
    const holder = this.objects.find((o) => o.userData.model === ObjectController.rootModel(hit.object, models));
    this.select(holder);
    return true;
  }

  static rootModel(object, models) {
    while (object && !models.includes(object)) object = object.parent;
    return object;
  }

  rotateSelected(deltaRadians) {
    if (this.selected) this.selected.userData.model.rotation.y += deltaRadians;
  }

  setColor(hex) { this.setMaterialParam('color', hex); }
  setRoughness(value) { this.setMaterialParam('roughness', value); }
  setMetalness(value) { this.setMaterialParam('metalness', value); }

  setMaterialParam(name, value) {
    if (!this.selected) return;
    this.selected.userData.material[name] = value;
    this.applyMaterialState(this.selected);
  }

  /** Текущие параметры PBR-материала выбранного объекта (для синхронизации UI). */
  materialInfo(holder) {
    let first = null;
    holder.userData.model.traverse((n) => { if (n.isMesh && !first) first = n.material; });
    return { color: holder.userData.material.color, roughness: first.roughness, metalness: first.metalness };
  }

  applyMaterialState(holder) {
    if (!holder || !holder.userData.model) return;
    const { color, roughness, metalness } = holder.userData.material;
    holder.userData.model.traverse((node) => {
      if (!node.isMesh) return;
      const m = node.material;
      if (color === null) m.color.copy(m.userData.originalColor);
      else m.color.set(color);
      if (roughness !== null) m.roughness = roughness;
      if (metalness !== null) m.metalness = metalness;
    });
  }

  update(delta) {
    if (this.autoRotate && this.selected) this.rotateSelected(delta * 0.8);
  }

  static makeShadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
}
