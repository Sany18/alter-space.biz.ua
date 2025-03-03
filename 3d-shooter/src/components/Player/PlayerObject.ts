import * as THREE from 'three';

import { Scene } from '../../types/extended-threejs-types/scene.type';

import { AbstractObject } from '../abstract-object';

export class PlayerObject extends AbstractObject {
  config = {
    showTrigger: true,
  }

  constructor(scene: Scene) {
    super(scene);

    this.geometry = new THREE.BoxGeometry(5, 10, 5);
    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity: 1 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 20, 50);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'me';
  }
}
