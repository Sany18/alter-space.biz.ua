import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { XYZ } from '../types/xyz.type';
import { Mesh } from '../types/extended-threejs-types/mesh.type';
import { Scene } from '../types/extended-threejs-types/scene.type';

export class AbstractObject {
  scene: Scene;
  actionAfterAddedToScene: Function;

  geometry: THREE.BoxGeometry | THREE.PlaneGeometry;
  material: THREE.Material;
  mesh: Mesh | THREE.Line;
  group?: THREE.Group; // if group exists, mesh is inside group
  bufferGeometry?: THREE.BufferGeometry; // if geometry is BufferGeometry

  cannonBody?: CANNON.Body;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  setSize(size: any) {
    if (this.geometry instanceof THREE.BoxGeometry) {
      this.geometry = new THREE.BoxGeometry(...size);
      this.mesh.geometry = this.geometry;
    }

    return this;
  }

  setPosition(position: XYZ) {
    // @ts-ignore
    this.mesh.position.set(...position);
    return this;
  }

  setRotation(rotation: XYZ) { // degrees
    // @ts-ignore
    this.mesh.rotation.set(...rotation.map(THREE.MathUtils.degToRad));
    return this;
  }

  addToScene(params?: { cannonBody?: boolean; static?: boolean }) {
    const _params = {
      cannonBody: true,
      static: true,
      ...params
    }


    // Except THREE.Line or THREE.BufferGeometry
    if (_params.cannonBody) this.addCannonBody(!_params.static);

    this.mesh.name = this.generateName();
    this.scene.add(this.mesh);

    this.onAddedToScrene();

    return this;
  }

  protected onAddedToScrene() {
    if (this.actionAfterAddedToScene) this.actionAfterAddedToScene();
  }

  destroy() {
    this.scene.remove(this.mesh);
  }

  addCannonBody(moveable: boolean = false) {
    if (this.bufferGeometry) return;
    if (this.mesh instanceof THREE.Line) return;

    if (this.geometry instanceof THREE.BoxGeometry) {
      this.addCannonBoxBody(moveable);
    }

    if (this.geometry instanceof THREE.PlaneGeometry) {
      this.addCannonPlaneBody();
    }
  }

  private generateName() {
    return `${this.constructor.name} | ${this.cannonBody?.mass == 0 ? 'static' : 'dynamic'} | Nº ${this.mesh.userData.counter}`;
  }

  // Cannon physics engine
  private addCannonBoxBody(moveable: boolean = false) {
    const { position, rotation } = this.mesh;
    const parameters = this.geometry.parameters;

    // @ts-ignore
    const size: XYZ = [parameters.width / 2, parameters.height / 2, parameters.depth / 2];
    const cubeShape = new CANNON.Box(new CANNON.Vec3(...size));
    this.cannonBody = new CANNON.Body({ mass: moveable ? size[0] * size[1] * size[2] : 0 });
    this.cannonBody.addShape(cubeShape)
    this.cannonBody.position.set(position.x, position.y, position.z);
    this.cannonBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);

    // @ts-ignore
    this.mesh.cannonBody = this.cannonBody;
    this.scene.cannonWorld.addBody(this.cannonBody);
  }

  private addCannonPlaneBody() {
    const { position, rotation } = this.mesh;
    // const parameters = this.geometry.parameters;

    // const size: XYZ = [parameters.width, parameters.height, parameters.depth];
    const planeShape = new CANNON.Plane();
    this.cannonBody = new CANNON.Body({ mass: 0 });
    this.cannonBody.addShape(planeShape)
    this.cannonBody.position.set(position.x, position.y, position.z);
    this.cannonBody.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);

    // @ts-ignore
    this.mesh.cannonBody = this.cannonBody;
    this.scene.cannonWorld.addBody(this.cannonBody);
  }
}
