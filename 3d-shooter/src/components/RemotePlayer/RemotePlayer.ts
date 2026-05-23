import * as THREE from 'three';
import { Scene } from '../../types/extended-threejs-types/scene.type';

export interface RemotePlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

export class RemotePlayer {
  readonly mesh: THREE.Mesh;
  lastSeen: number = Date.now();

  constructor(private scene: Scene) {
    const geometry = new THREE.BoxGeometry(5, 10, 5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff6600, wireframe: true });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(state: RemotePlayerState) {
    this.mesh.position.set(state.position.x, state.position.y, state.position.z);
    this.mesh.quaternion.set(
      state.rotation.x,
      state.rotation.y,
      state.rotation.z,
      state.rotation.w,
    );
    this.lastSeen = Date.now();
  }

  destroy() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.scene.remove(this.mesh);
  }
}
