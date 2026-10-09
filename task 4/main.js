import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- сцена, камера, рендерер ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// освещение – та же пара источников, что и в Заданиях 2–3
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 2.0));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(1, 2, 1);
scene.add(dirLight);

// ---------- модель для размещения (Astronaut.glb из Задания 1) ----------
const MODEL_HEIGHT = 0.5; // высота фигурки в метрах
let modelTemplate = null;
new GLTFLoader().load('models/Astronaut.glb', (gltf) => {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(MODEL_HEIGHT / size.y);
  // ставим модель «ногами» в начало координат, чтобы она стояла на плоскости
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.y -= scaledBox.min.y;
  modelTemplate = new THREE.Group();
  modelTemplate.add(model);
});

// мягкая круглая тень под объектом
function makeShadowTexture() {
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
const shadowGeometry = new THREE.PlaneGeometry(0.32, 0.32).rotateX(-Math.PI / 2);
const shadowMaterial = new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false });

// ---------- визуальный маркер (reticle) ----------
const reticle = new THREE.Group();
reticle.matrixAutoUpdate = false;
reticle.visible = false;
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.08, 0.1, 48).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
const dot = new THREE.Mesh(
  new THREE.CircleGeometry(0.015, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x5b9dff })
);
reticle.add(ring, dot);
scene.add(reticle);

// ---------- AR-сессия ----------
const button = document.getElementById('ar-btn');
let hitTestSource = null;
let localSpace = null;

async function startAR() {
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'local-floor'],
  });

  renderer.xr.setReferenceSpaceType('local-floor');
  await renderer.xr.setSession(session);
  localSpace = renderer.xr.getReferenceSpace();

  // hit-test «из глаз» пользователя: луч идёт из viewer-пространства (центр экрана)
  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

  session.addEventListener('select', onSelect); // тап по экрану / курок контроллера
  session.addEventListener('end', () => {
    hitTestSource = null;
    reticle.visible = false;
    button.hidden = false;
  });
  button.hidden = true;
}

function onSelect() {
  if (!reticle.visible || !modelTemplate) return;

  const obj = modelTemplate.clone();
  // берём позицию и ориентацию точки пересечения из матрицы маркера
  reticle.matrix.decompose(obj.position, obj.quaternion, obj.scale);
  // разворачиваем объект лицом к пользователю (только вокруг вертикальной оси)
  const camPos = new THREE.Vector3().setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
  obj.rotation.set(0, Math.atan2(camPos.x - obj.position.x, camPos.z - obj.position.z), 0);

  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.position.y = 0.002;
  obj.add(shadow);

  scene.add(obj); // объект живёт в мировых координатах local-floor и больше не двигается
}

// ---------- цикл рендеринга ----------
renderer.setAnimationLoop((time, frame) => {
  if (frame && hitTestSource) {
    const results = frame.getHitTestResults(hitTestSource);
    if (results.length > 0) {
      const pose = results[0].getPose(localSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      // лёгкая «пульсация» кольца, чтобы маркер было лучше видно
      ring.scale.setScalar(1 + 0.08 * Math.sin(time / 200));
    } else {
      reticle.visible = false;
    }
  }
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- проверка поддержки ----------
(async () => {
  const supported = navigator.xr && await navigator.xr.isSessionSupported('immersive-ar');
  if (supported) {
    button.textContent = 'Start AR';
    button.disabled = false;
    button.addEventListener('click', () => startAR().catch((e) => {
      console.error(e);
      button.textContent = 'Не удалось запустить AR';
    }));
  } else {
    button.textContent = 'WebXR AR не поддерживается';
  }
})();
