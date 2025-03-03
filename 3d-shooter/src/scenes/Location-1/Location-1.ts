import * as THREE from 'three';

import { Scene } from '../../types/extended-threejs-types/scene.type';
import { LocationInterface } from '../Locationinterface';

import { Floor } from '../../components/Floor/Floor';
import { WoodenBox } from '../../components/WoodenBox/WoodenBox';
import { SceneLight } from '../../components/SceneLight/SceneLight';
import { ConcreteWall } from '../../components/ConcreteWall/ConcreteWall';

import './Sidebar/Sidebar';
import { getTexturePath } from '../../utils/three-utils';

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

    // Light
    this.light = new SceneLight(this.scene);
      this.light.addToScene(this.scene);
    this.sceneObjects.push(this.light.directionalLight, this.light.ambientlight);

    // Fog
    // this.scene.fog = new THREE.Fog(0xffffff);

    // Daytime
    document.getElementsByName('daytime')[0]?.addEventListener('change', (e: any) => {
      if (e.target.checked) {
        this.scene.background = nightSkyCube;
        this.scene.fog = new THREE.Fog(0x000000);
        this.light.directionalLight.intensity = 0.1;
        this.light.ambientlight.intensity = 0.3;
      } else {
        this.scene.background = skyCube;
        this.scene.fog = new THREE.Fog(0xffffff);
        this.light.directionalLight.intensity = 0.5;
        this.light.ambientlight.intensity = 1;
      }
    })

    // Scene objects

    // Floor
    const floor = new Floor(this.scene).addToScene();
    this.sceneObjects.push(floor.mesh);

    // Walls
    const walls = [
      [[5, 10, 20], [-20, 5, 20], [0, 0, 0]],
      [[5, 10, 20], [-10, 5, 10], [0, 90, 0]],
      [[5, 20, 20], [0, 10, -50], [0, 90, 0]],
      [[5, 20, 20], [50, 10, 50], [0, -45, 0]],
      [[5, 50, 20], [-30, 3, 40], [0, 0, 60]],
      [[5, 50, 20], [-110, 15.2, 25], [0, 90, 90]],
      [[5, 50, 20], [-75.5, 15.2, 40], [0, 0, 90]],
    ]
    walls.forEach(([size, position, rotation]) => {
      const wall = new ConcreteWall(this.scene)
        .setSize(size).setPosition(position).setRotation(rotation)
        .addToScene();

      this.sceneObjects.push(wall.mesh);
    });

    // Boxes
    const boxes = [
      [[10, 10, 10], [-110, 5, 50], [0, 0, 0]],
      [[10, 10, 10], [30, 5, 20], [0, 0, 0]],
      [[10, 10, 10], [40, 5, 20], [0, 0, 0]],
      [[10, 10, 10], [30, 15, 20], [0, 12, 0]],
    ];
    boxes.forEach(([size, position, rotation]) => {
      const box = new WoodenBox(this.scene)
        .setSize(size).setPosition(position).setRotation(rotation)
        .addToScene();

      this.sceneObjects.push(box.mesh);
    });

    // Cubes
    let coubes = 20;
    const createCube = () => {
      setTimeout(() => {
        if (!this.isLocationAlive) return;

        const box = new WoodenBox(this.scene)
          .setPosition([5, 5, 0])
          .addToScene({ static: false });

        this.sceneObjects.push(box.mesh);

        if (--coubes >= 0) createCube();
      }, 200)
    }; createCube();
  }

  destroy() {
    this.isLocationAlive = false;

    this.sceneObjects.forEach(obj => {
      this.scene.remove(obj);
    })
  }
}
