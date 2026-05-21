import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { Scene } from '../../types/extended-threejs-types/scene.type';
import { loadTexture } from '../../utils/three-utils';
import { FloorVisibilityService } from '../../services/floor-visibility/floor-visibility.service';

const texture = loadTexture('floorSquare.png');

/** Size of one floor tile in world units. Must be a multiple of 10 (texture tile size). */
const TILE_SIZE = 50;
/** Max render distance for floor tiles in world units. */
const RENDER_DISTANCE = 600;
/** Texture repeats per tile — keeps the 10-unit texture grid world-aligned. */
const TEXTURE_REPEAT = TILE_SIZE / 10;
/**
 * Pre-allocated instance slots. Worst case: 75° FOV cone at 600 units with 50-unit tiles
 * ≈ 150 tiles + footprint. 500 is a safe upper bound.
 */
const MAX_INSTANCES = 500;

let counter = 0;

export class Floor {
  scene: Scene;
  mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(scene: Scene) {
    this.scene = scene;

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);

    const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const material = new THREE.MeshLambertMaterial({ map: texture });

    this.mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES);
    this.mesh.count = 0; // nothing rendered until first update()
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.userData = { type: 'floor', counter: counter++ };

    // Bake the -90° X rotation into the dummy so all tiles lie flat.
    this.dummy.rotation.x = Math.PI * -0.5;
  }

  addToScene() {
    this.scene.add(this.mesh);
    this.addCannonBody();
    return this;
  }

  /**
   * Recompute visible tiles from the camera's position and forward direction.
   * @param posX   Camera world X
   * @param posZ   Camera world Z
   * @param dirX   Normalised forward X (XZ projection)
   * @param dirZ   Normalised forward Z (XZ projection)
   * @param halfFOV  Half of horizontal FOV in radians
   */
  update(posX: number, posZ: number, dirX: number, dirZ: number, halfFOV: number) {
    const tiles = FloorVisibilityService.getTilesInCone(
      posX, posZ, dirX, dirZ, halfFOV, RENDER_DISTANCE, TILE_SIZE,
    );

    const count = Math.min(tiles.length, MAX_INSTANCES);
    for (let k = 0; k < count; k++) {
      this.dummy.position.set(tiles[k][0], 0, tiles[k][1]);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(k, this.dummy.matrix);
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private addCannonBody() {
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Plane());
    body.quaternion.setFromEuler(Math.PI * -0.5, 0, 0);
    this.scene.cannonWorld.addBody(body);
  }
}
