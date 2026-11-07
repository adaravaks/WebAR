import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EnvironmentManager } from './EnvironmentManager.js';
import { ModelLibrary } from './ModelLibrary.js';
import { HitTestController } from './HitTestController.js';
import { ObjectController } from './ObjectController.js';
import { UIPanel, HDRIS } from './UIPanel.js';

/**
 * Главный класс приложения: связывает рендерер, AR-сессию и остальные модули.
 * До запуска AR показывает предпросмотр модели на HDRI-фоне,
 * после запуска – размещение объектов через hit-test.
 */
export class ARApp {
  constructor(container, uiRoot) {
    this.uiRoot = uiRoot;
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 50);
    this.camera.position.set(0, 0.3, 1.25);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    // цель чуть ниже модели, чтобы в предпросмотре она была выше панели
    this.orbit.target.set(0, -0.06, 0);
    this.orbit.enableDamping = true;
    this.orbit.update();

    this.environment = new EnvironmentManager(this.renderer, this.scene);
    this.library = new ModelLibrary();
    this.objects = new ObjectController(this.scene, this.library);
    this.hitTest = new HitTestController(this.scene);
    // источники ввода XR: на телефоне – касание экрана, на шлеме – контроллеры;
    // у каждого свой луч, по которому можно выбрать уже стоящий объект
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('select', () => this.onSelect(controller));
      this.scene.add(controller);
    }

    this.ui = new UIPanel(uiRoot, {
      onModel: async (key) => {
        await this.objects.replaceSelected(key);
        this.objects.select(this.objects.selected); // обновить панель под новую модель
      },
      onColor: (hex) => this.objects.setColor(hex),
      onRotate: (d) => this.objects.rotateSelected(d),
      onAutoRotate: (on) => { this.objects.autoRotate = on; },
      onRoughness: (v) => this.objects.setRoughness(v),
      onMetalness: (v) => this.objects.setMetalness(v),
      onHdri: (url) => this.environment.load(url),
    });

    // при выборе другого объекта панель показывает его настройки
    this.objects.onSelectionChange = (holder) => {
      if (holder && holder.userData.model) {
        this.ui.sync({ modelKey: holder.userData.modelKey, ...this.objects.materialInfo(holder) });
      }
    };

    addEventListener('resize', () => this.onResize());
  }

  async init() {
    await this.environment.load(HDRIS[0].url);
    // объект для предпросмотра в центре сцены
    this.preview = await this.objects.place(this.ui.modelKey, new THREE.Matrix4());
    this.renderer.setAnimationLoop((t, frame) => this.render(t, frame));

    const supported = navigator.xr && await navigator.xr.isSessionSupported('immersive-ar');
    if (supported) this.ui.setArButton('Start AR', true, () => this.startAR());
    else this.ui.setArButton('WebXR AR не поддерживается', false);
  }

  async startAR() {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local-floor'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: this.uiRoot },
    });
    this.renderer.xr.setReferenceSpaceType('local-floor');
    await this.renderer.xr.setSession(session);
    await this.hitTest.start(session, this.renderer.xr.getReferenceSpace());

    // в AR фоном служит камера, HDRI остаётся только источником освещения
    this.environment.setBackgroundVisible(false);
    this.preview.visible = false;
    this.orbit.enabled = false;
    this.ui.setArMode(true);
    // dom-overlay есть в Chrome на Android; если браузер (или эмулятор на компьютере)
    // его не дал, поднимаем панель над холстом XR, чтобы она оставалась доступной
    this.ui.setOverlayFallback(!session.domOverlayState);

    session.addEventListener('end', () => this.onSessionEnd());
  }

  async onSelect(controller) {
    // тап по уже стоящему объекту – выбрать его, по маркеру – поставить новый
    if (this.objects.pick(controller)) return;
    if (this.hitTest.reticle.visible) {
      const camPos = new THREE.Vector3().setFromMatrixPosition(this.renderer.xr.getCamera().matrixWorld);
      await this.objects.place(this.ui.modelKey, this.hitTest.reticle.matrix, camPos);
    }
  }

  onSessionEnd() {
    this.hitTest.stop();
    this.environment.setBackgroundVisible(true);
    this.preview.visible = true;
    this.objects.select(this.preview);
    this.orbit.enabled = true;
    this.ui.setArMode(false);
  }

  render(time, frame) {
    const delta = this.clock.getDelta();
    this.hitTest.update(frame, time);
    this.objects.update(delta);
    if (this.orbit.enabled) this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
