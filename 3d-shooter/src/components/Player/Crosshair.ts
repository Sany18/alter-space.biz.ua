import * as THREE from 'three';

import { Scene } from '../../types/extended-threejs-types/scene.type';

import { AbstractObject } from '../abstract-object';

export class Crosshair extends AbstractObject {
  config = {
    size: .001
  };

  constructor(scene: Scene) {
    super(scene);

    this.bufferGeometry = new THREE.BufferGeometry();
    this.material = new THREE.LineBasicMaterial({ color: 'white' });

    this.bufferGeometry.setFromPoints([
      new THREE.Vector3(0, this.config.size, -.1),
      new THREE.Vector3(this.config.size, 0, -.1),
      new THREE.Vector3(0, -this.config.size, -.1),
      new THREE.Vector3(-this.config.size, 0, -.1),
      new THREE.Vector3(0, this.config.size, -.1)
    ]);

    this.mesh = new THREE.Line(this.bufferGeometry, this.material);
  }
}
