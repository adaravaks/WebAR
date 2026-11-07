import * as THREE from 'three';

/**
 * Hit-test и визуальный маркер из Задания 4, вынесенные в отдельный класс.
 */
export class HitTestController {
  constructor(scene) {
    this.source = null;
    this.space = null;

    this.reticle = new THREE.Group();
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.015, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x5b9dff })
    );
    this.reticle.add(this.ring, dot);
    scene.add(this.reticle);
  }

  async start(session, referenceSpace) {
    this.space = referenceSpace;
    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.source = await session.requestHitTestSource({ space: viewerSpace });
  }

  stop() {
    this.source = null;
    this.reticle.visible = false;
  }

  update(frame, time) {
    if (!frame || !this.source) return;
    const results = frame.getHitTestResults(this.source);
    if (results.length > 0) {
      const pose = results[0].getPose(this.space);
      this.reticle.visible = true;
      this.reticle.matrix.fromArray(pose.transform.matrix);
      this.ring.scale.setScalar(1 + 0.08 * Math.sin(time / 200));
    } else {
      this.reticle.visible = false;
    }
  }
}
