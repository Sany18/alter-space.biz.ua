import * as THREE from 'three';

import { Scene } from '../../types/extended-threejs-types/scene.type';
import { loadTexture } from '../../utils/three-utils';
import { AbstractObject } from '../abstract-object';

const texture = loadTexture('floorSquare.png');
let counter = 0;

export class Floor extends AbstractObject {
  constructor(scene: Scene) {
    super(scene);

    this.geometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
    this.material = new THREE.MeshLambertMaterial({ map: texture, wireframe: false });
    this.mesh = new THREE.Mesh(this.geometry, this.material);

    // for(let i = 0; i < this.geometry.vertices.length; i++) {
    //   this.geometry.vertices[i].z = Math.floor((Math.random()*10)+1)
    // }

    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.magFilter = THREE.NearestFilter
    texture.repeat.set(100, 100) // repeats

    this.mesh.receiveShadow = true;
    this.mesh.rotation.x = Math.PI * -.5;

    this.mesh.userData = {
      type: 'floor',
      counter: counter++
    };
  }
}
