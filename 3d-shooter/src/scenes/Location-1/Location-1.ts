import * as THREE from 'three';

import { Scene } from '../../types/extended-threejs-types/scene.type';
import { LocationInterface } from '../Locationinterface';

import { Floor } from '../../components/Floor/Floor';
import { WoodenBox } from '../../components/WoodenBox/WoodenBox';
import { SceneLight } from '../../components/SceneLight/SceneLight';
import { ConcreteWall } from '../../components/ConcreteWall/ConcreteWall';

import './Sidebar/Sidebar';
import { getTexturePath } from '../../utils/three-utils';
import { GlobalStateService } from '../../services/global-state/global-state.service';
import { World } from '../../components/World/World';
import { PhysicsAuthorityService } from '../../services/physics-authority/physics-authority.service';

export class Location1 implements LocationInterface {
  isLocationAlive = true;

  scene: Scene;
  sceneObjects: THREE.Object3D[] = [];

  light!: SceneLight;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  init() {
    // Skybox
    const skyboxNames = ['ft', 'bk', 'up', 'dn', 'rt', 'lf'];
    const skyCube = new THREE.CubeTextureLoader().load(
      skyboxNames.map(name => getTexturePath(`${name}.jpg`, 'skybox-clouds')));
    const nightSkyCube = new THREE.CubeTextureLoader().load(
      skyboxNames.map((_, i) => getTexturePath(`${i + 1}.png`, 'skybox-space')));
    this.scene.background = skyCube;

    const world = new World();

    // Light
    this.light = new SceneLight(this.scene, world.camera);
    this.light.addToScene(this.scene);
    this.sceneObjects.push(this.light.hemisphereLight);

    // Fog
    // this.scene.fog = new THREE.Fog(0xffffff);

    // Daytime
    const applyDaytime = (isDay: boolean) => {
      if (isDay) {
        this.scene.background = skyCube;
        this.scene.fog = new THREE.Fog(0xffffff);
        this.light.setIntensity(0.5);
        this.light.hemisphereLight.color.set(0xddeeff);
        this.light.hemisphereLight.groundColor.set(0x886644);
        this.light.hemisphereLight.intensity = 0.1;
      } else {
        this.scene.background = nightSkyCube;
        this.scene.fog = new THREE.Fog(0x000000);
        this.light.setIntensity(0.1);
        this.light.hemisphereLight.color.set(0x111133);
        this.light.hemisphereLight.groundColor.set(0x000000);
        this.light.hemisphereLight.intensity = 0.1;
      }
    };
    applyDaytime(GlobalStateService.state.daytime);
    GlobalStateService.stateChanged.addEventListener('stateChanged', () => {
      applyDaytime(GlobalStateService.state.daytime);
    });

    // Scene objects

    // Floor
    const floor = new Floor(this.scene).addToScene();
    this.light.csm.setupMaterial(floor.mesh.material as THREE.Material);
    this.sceneObjects.push(floor.mesh);

    const _cameraDir = new THREE.Vector3();
    const _cameraPos = new THREE.Vector3();
    world.addAction('floor-follow-camera', () => {
      world.camera.getWorldPosition(_cameraPos);
      world.camera.getWorldDirection(_cameraDir);
      // halfFOV + 10° buffer so tiles don't pop in at screen edges
      const halfFOV = THREE.MathUtils.degToRad(world.camera.fov + 15);
      floor.update(
        _cameraPos.x, _cameraPos.z,
        _cameraDir.x, _cameraDir.z,
        halfFOV,
      );
    });

    // Walls
    // Layout: arena X[-200..200], Z[-160..220]. Player spawns near (0,20,50).
    const walls = [
      // === OUTER PERIMETER ===
      [[10, 24, 390],  [-200, 12,   30], [0, 0, 0]], // W outer wall
      [[10, 24, 390],  [ 200, 12,   30], [0, 0, 0]], // E outer wall
      [[410, 24, 10],  [   0, 12, -160], [0, 0, 0]], // N outer wall
      [[410, 24, 10],  [   0, 12,  220], [0, 0, 0]], // S outer wall

      // === CENTRAL BUILDING (X:-30..30, Z:-70..10) – two doorways N & S ===
      [[10, 24, 80],   [-30, 12, -30], [0, 0, 0]],   // W side
      [[10, 24, 80],   [ 30, 12, -30], [0, 0, 0]],   // E side
      [[20, 24, 10],   [-20, 12, -70], [0, 0, 0]],   // N wall left  (20-unit door gap in centre)
      [[20, 24, 10],   [ 20, 12, -70], [0, 0, 0]],   // N wall right
      [[20, 24, 10],   [-20, 12,  10], [0, 0, 0]],   // S wall left  (20-unit door gap in centre)
      [[20, 24, 10],   [ 20, 12,  10], [0, 0, 0]],   // S wall right

      // === NW BUNKER (X:-170..-110, Z:-130..-70) – open on south-east ===
      [[60, 20, 10],   [-140, 10, -130], [0, 0, 0]], // N wall
      [[10, 20, 60],   [-170, 10, -100], [0, 0, 0]], // W wall
      [[10, 20, 30],   [-110, 10, -114], [0, 0, 0]], // E partial wall (S door gap)

      // === NE BUNKER (X:110..170, Z:-130..-70) – open on south-west ===
      [[60, 20, 10],   [ 140, 10, -130], [0, 0, 0]], // N wall
      [[10, 20, 60],   [ 170, 10, -100], [0, 0, 0]], // E wall
      [[10, 20, 30],   [ 110, 10, -114], [0, 0, 0]], // W partial wall (S door gap)

      // === COVER WALLS (scattered throughout open areas) ===
      [[40, 16, 10],   [-100, 8,   60], [0, 0, 0]],  // SW cover – horizontal
      [[10, 16, 40],   [-124, 8,   36], [0, 0, 0]],  // SW cover – vertical
      [[40, 16, 10],   [ 100, 8,   60], [0, 0, 0]],  // SE cover – horizontal
      [[10, 16, 40],   [ 124, 8,   36], [0, 0, 0]],  // SE cover – vertical
      [[10, 16, 40],   [ -64, 8,  -36], [0, 0, 0]],  // W approach to central building
      [[10, 16, 40],   [  64, 8,  -36], [0, 0, 0]],  // E approach to central building
      [[40, 16, 10],   [   0, 8, -110], [0, 0, 0]],  // N centre cover
      [[40, 16, 10],   [   0, 8, -136], [0, 0, 0]],  // Far-N centre cover
      [[30, 16, 10],   [-144, 8,   20], [0, 0, 0]],  // W mid-area cover
      [[30, 16, 10],   [ 144, 8,   20], [0, 0, 0]],  // E mid-area cover
    ];
    walls.forEach(([size, position, rotation]) => {
      const wall = new ConcreteWall(this.scene)
        .setSize(size).setPosition(position).setRotation(rotation)
        .addToScene();

      this.light.csm.setupMaterial(wall.mesh.material as THREE.Material);
      this.sceneObjects.push(wall.mesh);
    });

    // Boxes
    const boxes = [
      // Near spawn – SW cluster
      [[16, 16, 16],  [ -56,  8, 144], [0,  15, 0]],
      [[16, 16, 16],  [ -70,  8, 124], [0,   0, 0]],
      [[16,  8, 16],  [ -56, 20, 144], [0,  30, 0]], // stacked on top

      // Near spawn – SE cluster
      [[16, 16, 16],  [  60,  8, 156], [0, -20, 0]],
      [[16, 16, 16],  [  76,  8, 130], [0,   0, 0]],

      // Central building – south entrance flanks
      [[12, 12, 12],  [ -44,  6,  16], [0,   0, 0]],
      [[12, 12, 12],  [  44,  6,  16], [0,  10, 0]],

      // Central building – interior cover
      [[10, 10, 10],  [ -16,  5,  -40], [0,  45, 0]],
      [[10, 10, 10],  [  16,  5,  -40], [0, -30, 0]],

      // NW bunker
      [[16, 16, 16],  [-136,  8,  -96], [0,  10, 0]],
      [[16, 16, 16],  [-150,  8, -110], [0,   0, 0]],

      // NE bunker
      [[16, 16, 16],  [ 136,  8,  -96], [0, -10, 0]],
      [[16, 16, 16],  [ 150,  8, -110], [0,   0, 0]],

      // N cover area – box cluster
      [[12, 12, 12],  [ -24,  6, -124], [0,  20, 0]],
      [[12, 12, 12],  [  24,  6, -124], [0,   0, 0]],
      [[12, 24, 12],  [   0, 12, -124], [0,  45, 0]], // tall central crate

      // Mid-arena scattered
      [[10, 10, 10],  [-104,  5,  -10], [0,  20, 0]],
      [[10, 10, 10],  [ 104,  5,  -10], [0, -15, 0]],
      [[10, 10, 10],  [   0,  5,  -94], [0,   0, 0]],
      [[10, 10, 10],  [-156,  5,   70], [0,  45, 0]],
      [[10, 10, 10],  [ 156,  5,   70], [0,   0, 0]],
    ];
    boxes.forEach(([size, position, rotation]) => {
      const box = new WoodenBox(this.scene)
        .setSize(size).setPosition(position).setRotation(rotation)
        .addToScene();

      this.light.csm.setupMaterial(box.mesh.material as THREE.Material);
      this.sceneObjects.push(box.mesh);
    });

    // Small dynamic cubes spread across the map
    [
      [ -80, 8,  100], [  80, 8,  100], [   0, 8,  160],
      [-160, 8,   80], [ 160, 8,   80], [ -40, 8,   80],
      [  40, 8,   80], [ -80, 8,  -20], [  80, 8,  -20],
      [   0, 8,  -50], [-140, 8,  -90], [ 140, 8,  -90],
      [ -60, 8, -140], [  60, 8, -140], [   0, 8, -148],
      [-180, 8,   8], [ 180, 8,   8], [ -20, 8,  200],
      [  20, 8,  200], [ 100, 8, -140],
    ].forEach(([x, y, z]) => {
      const box = new WoodenBox(this.scene)
        .setSize([8, 8, 8])
        .setPosition([x, y, z])
        .addToScene({ static: false });

      this.light.csm.setupMaterial(box.mesh.material as THREE.Material);
      this.sceneObjects.push(box.mesh);
      PhysicsAuthorityService.registerBody(box.mesh.userData.counter, box.cannonBody!);
    })}

  destroy() {
    this.isLocationAlive = false;

    this.light.destroy();
    this.sceneObjects.forEach(obj => {
      this.scene.remove(obj);
    })
  }
}
