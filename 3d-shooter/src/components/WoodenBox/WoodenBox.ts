import * as THREE from 'three';

import { loadTexture } from '../../utils/three-utils';
import { AbstractObject } from '../abstract-object';

const boxTexture = loadTexture('woodBox.png');
let counter = 0;

export class WoodenBox extends AbstractObject {
  constructor(
    scene: THREE.Scene,
  ) {
    super(scene);

    this.geometry = new THREE.BoxGeometry(5, 5, 5);
    this.material = new THREE.MeshLambertMaterial({ map: boxTexture, wireframe: false });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;

    this.mesh.userData = {
      type: 'box',
      counter: counter++
    };
  }
}
