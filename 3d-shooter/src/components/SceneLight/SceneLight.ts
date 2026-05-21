import * as THREE from 'three';

import { GlobalStateService } from '../../services/global-state/global-state.service';

export class SceneLight {
  config = {
    position: { x: 300, y: 200, z: -100 }, // init
    size1: 100,
    size2: 1000,
    color: 0xffffff,
    shadowResolution: 2048
  }

  directionalLight1: THREE.DirectionalLight;
  directionalLight2: THREE.DirectionalLight;
  hemisphereLight: THREE.HemisphereLight;

  constructor(scene: any) {
    this.directionalLight1 = new THREE.DirectionalLight(this.config.color, .5);
    // Sky colour from above, ground colour from below — more natural than flat AmbientLight.
    this.hemisphereLight = new THREE.HemisphereLight(0xddeeff, 0x886644, 1);

    this.directionalLight1.position.set(this.config.position.x, this.config.position.y, this.config.position.z);
    this.directionalLight1.target.position.set(0, 0, 0);

    this.directionalLight1.castShadow = true;
    this.directionalLight1.shadow.camera.left = -this.config.size1;
    this.directionalLight1.shadow.camera.right = this.config.size1;
    this.directionalLight1.shadow.camera.top = this.config.size1;
    this.directionalLight1.shadow.camera.bottom = -this.config.size1;
    this.directionalLight1.shadow.mapSize.width = this.config.shadowResolution;
    this.directionalLight1.shadow.mapSize.height = this.config.shadowResolution;

    // LOD 2 shadow
    this.directionalLight2 = new THREE.DirectionalLight(this.config.color, .5);
    this.directionalLight2.position.set(this.config.position.x, this.config.position.y, this.config.position.z);
    this.directionalLight2.target.position.set(0, 0, 0);

    this.directionalLight2.castShadow = true;
    this.directionalLight2.shadow.camera.left = -this.config.size2;
    this.directionalLight2.shadow.camera.right = this.config.size2;
    this.directionalLight2.shadow.camera.top = this.config.size2;
    this.directionalLight2.shadow.camera.bottom = -this.config.size2;
    this.directionalLight2.shadow.mapSize.width = this.config.shadowResolution;
    this.directionalLight2.shadow.mapSize.height = this.config.shadowResolution;
    this.directionalLight2.shadow.camera.near = this.config.size1;
    this.directionalLight2.shadow.camera.far = this.config.size2;

    let helper = new THREE.CameraHelper(this.directionalLight1.shadow.camera);
    GlobalStateService.stateChanged.addEventListener('stateChanged', () => {
      helper.visible = GlobalStateService.state.lightDebuggerEnabled;
    });

    scene.add(helper)
  }

  addToScene(scene: any) {
    scene.add(this.directionalLight1);
    // scene.add(this.directionalLight2);
    scene.add(this.hemisphereLight);
  }
}
