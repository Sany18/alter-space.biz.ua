import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';

import Stats from '../../libs/stats.js';

import { Scene } from '../../types/extended-threejs-types/scene.type.js';
import { GlobalStateService } from '../../services/global-state/global-state.service';

const config = {
  renderer: {
    antialias: false
  }
}

export class World {
  private static instance: World;

  clock: THREE.Clock;
  scene: Scene;
  camera: THREE.PerspectiveCamera;
  renderer: any;
  babylonEngine: any;

  cannonWorld: CANNON.World;
  cannonDebugger: any;

  stats = new Stats();
  actions: { key: string; action: Function }[] = [];
  private internalActions: Function[] = []; // Phiysics, Stats, etc

  private animationLoopActive: boolean = false;

  constructor() {
    if (World.instance) return World.instance;
    World.instance = this;
  }

  init() {
    this.initClock();
    this.initScene();
    this.initCamera();
    this.initStats();
    this.initCannon();
    this.initRenderer(this.scene, this.camera);
    this.initListeners();

    this.runAnimationLoop();
  }

  addAction(key: string, action: Function) {
    this.actions.push({ key, action });
  }

  removeAction(key: string) {
    this.actions = this.actions.filter(action => action.key !== key);
  }

  removeActionsLike(key: string) {
    this.actions = this.actions.filter(action => !action.key.includes(key));
  }

  removeObjectsFromSceneByUUID(uuid: string | string[]) {
    if (typeof uuid === 'string') uuid = [uuid];

    uuid.forEach(uuid => {
      this.scene.remove(this.scene.getObjectByProperty('uuid', uuid));
    });
  }

  runAnimationLoop() {
    this.animationLoopActive = true;
    this.animate();
  }

  stopAnimationLoop() {
    this.animationLoopActive = false;
  }

  // Main loop
  private animate() {
    if (!this.animationLoopActive) return;

    this.actions.forEach(action => action.action());
    this.internalActions.forEach(action => action());

    requestAnimationFrame(() => this.animate());
  }

  private initClock() {
    this.clock = new THREE.Clock();
  }

  private initScene() {
    this.scene = new THREE.Scene();
  }

  private initCamera() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  }

  private initStats() {
    this.stats = new Stats();
    this.internalActions.push(() => this.stats.showFps());
  }

  // Must be called last
  private initRenderer(scene: typeof this.scene, camera: typeof this.camera) {
    this.renderer = new THREE.WebGLRenderer(config.renderer);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMapSoft = true;
    this.renderer.shadowCameraNear = 1;
    this.renderer.shadowCameraFar = this.camera.far;
    this.renderer.shadowCameraFov = 50;
    this.renderer.shadowMapBias = 0.0039;
    this.renderer.shadowMapDarkness = .5;
    this.renderer.shadowMapWidth = 1024;
    this.renderer.shadowMapHeight = 1024;
    document.body.appendChild(this.renderer.domElement);

    this.internalActions.push(() => {
      this.renderer.render(scene, camera);
    })
  }

  private initCannon() {
    this.cannonWorld = new CANNON.World();
    this.cannonWorld.gravity.set(0, -98.2, 0);
    this.cannonWorld.broadphase = new CANNON.NaiveBroadphase();
    this.scene.cannonWorld = this.cannonWorld;

    this.internalActions.push(() => this.updateCannon());
    this.internalActions.push(() => this.cannonWorld.step(
      0.016666666666666666, this.clock.getDelta(), 3
    ));

    this.cannonDebugger = CannonDebugger(this.scene, this.cannonWorld, {
      color: 0x00ff00,
      scale: 1,
      onInit: (body, mesh, shape) => {
        GlobalStateService.stateChanged.addEventListener('stateChanged', () => {
          mesh.visible = GlobalStateService.state.cannonDebuggerEnabled;
        });
      }
    });
    this.scene.cannonDebugger = this.cannonDebugger;

    this.internalActions.push(() => {
      GlobalStateService.state.cannonDebuggerEnabled && this.cannonDebugger.update();
    });
  }

  private updateCannon() {
    Object.values(this.scene.children).forEach((el: any) => {
      if (el.cannonBody && !el.cannonBody.sleepState) {
        el.position.copy(el.cannonBody.position);
        el.quaternion.copy(el.cannonBody.quaternion);
      }
    });
  }

  private initListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      // composer.setSize(window.innerWidth, window.innerHeight)
    }, false)
  }
}
