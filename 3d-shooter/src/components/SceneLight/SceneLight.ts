import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { CSMHelper } from 'three/addons/csm/CSMHelper.js';

import { GlobalStateService } from '../../services/global-state/global-state.service';

export class SceneLight {
  config = {
    // Sun is at offset (300, 200, −100) from origin; light direction is the opposite.
    lightDirection: new THREE.Vector3(300, 200, -100).normalize().negate(),
  }

  csm: CSM;
  hemisphereLight: THREE.HemisphereLight;
  private csmHelper: CSMHelper;

  constructor(scene: any, camera: THREE.PerspectiveCamera) {
    // Sky colour from above, ground colour from below — more natural than flat AmbientLight.
    this.hemisphereLight = new THREE.HemisphereLight(0xddeeff, 0x886644, 1);

    this.csm = new CSM({
      camera,
      parent: scene,
      cascades: 3,
      maxFar: camera.far,
      mode: 'practical',
      shadowMapSize: 2048,
      lightDirection: this.config.lightDirection,
      lightIntensity: 0.5,
      lightNear: 1,
      lightFar: 2000,
      lightMargin: 400,
    });

    this.csmHelper = new CSMHelper(this.csm);
    this.csmHelper.visible = false;
    this.csmHelper.displayFrustum = true;
    this.csmHelper.displayPlanes = true;
    this.csmHelper.displayShadowBounds = true;
    scene.add(this.csmHelper);

    GlobalStateService.stateChanged.addEventListener('stateChanged', () => {
      this.csmHelper.visible = GlobalStateService.state.lightDebuggerEnabled;
    });
  }

  /** Set intensity on both the CSM property and all cascade lights. */
  setIntensity(value: number) {
    this.csm.lightIntensity = value;
    this.csm.lights.forEach(light => (light.intensity = value));
  }

  update() {
    this.csm.update();
    if (GlobalStateService.state.lightDebuggerEnabled) {
      this.csmHelper.update();
    }
  }

  addToScene(scene: any) {
    scene.add(this.hemisphereLight);
    // CSM automatically adds its internal DirectionalLights to the parent scene
  }

  destroy() {
    this.csm.remove();
    this.csm.dispose();
  }
}
