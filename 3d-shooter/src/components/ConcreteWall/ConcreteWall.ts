import * as THREE from 'three';

import { loadTexture } from '../../utils/three-utils';
import { AbstractObject } from '../abstract-object';

import { Scene } from '../../types/extended-threejs-types/scene.type';

const wallTexture = loadTexture('wall.jpg');
let counter = 0;

export class ConcreteWall extends AbstractObject {
  constructor(scene: Scene) {
    super(scene);

    this.geometry = new THREE.BoxGeometry(5, 5, 5);
    this.material = new THREE.MeshLambertMaterial({ map: wallTexture, wireframe: false });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    this.mesh.userData = {
      type: 'wall',
      counter: counter++
    };
  }
}
