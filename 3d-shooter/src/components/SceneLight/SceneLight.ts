import * as THREE from 'three';

import { GlobalStateService } from '../../services/global-state/global-state.service';

export class SceneLight {
  config = {
    position: { x: 300, y: 200, z: -100 },
    size: 100,
    color: 0xffffff,
    shadowResolution: 2048
  }

  directionalLight: THREE.DirectionalLight
  ambientlight: THREE.AmbientLight;

  constructor(scene: any) {
    this.directionalLight = new THREE.DirectionalLight(this.config.color, .5);
    this.ambientlight = new THREE.AmbientLight(0x404040);

    this.directionalLight.position.set(this.config.position.x, this.config.position.y, this.config.position.z);
    this.directionalLight.target.position.set(0, 0, 0);

    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.left = -this.config.size;
    this.directionalLight.shadow.camera.right = this.config.size;
    this.directionalLight.shadow.camera.top = this.config.size;
    this.directionalLight.shadow.camera.bottom = -this.config.size;
    this.directionalLight.shadow.mapSize.width = this.config.shadowResolution;
    this.directionalLight.shadow.mapSize.height = this.config.shadowResolution;

    let helper = new THREE.CameraHelper(this.directionalLight.shadow.camera);

    GlobalStateService.stateChanged.addEventListener('stateChanged', () => {
      helper.visible = GlobalStateService.state.lightDebuggerEnabled;
    });

    scene.add(helper)
  }

  addToScene(scene: any) {
    scene.add(this.directionalLight);
    scene.add(this.ambientlight);
  }
}
