import * as THREE from 'three';
import { Scene } from '../../types/extended-threejs-types/scene.type';
import { PlayerObject } from '../Player/PlayerObject';
import { config } from '../Player/Player';

export interface RemotePlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  crouching?: boolean;
}

export class RemotePlayer {
  private readonly _playerObject: PlayerObject;
  private readonly _root: THREE.Group;
  lastSeen: number = Date.now();

  private _lastUpdateTime = performance.now();
  private _lastX = NaN;
  private _lastZ = NaN;
  private _lastVelocityAngle = 0;

  constructor(private scene: Scene) {
    this._playerObject = new PlayerObject(scene, config.body);

    // Use a plain Group as the world-space positioning root.
    // The invisible physics-box mesh (PlayerObject.mesh) is intentionally NOT
    // added to the scene — its material.visible=false can suppress child
    // rendering in certain Three.js builds. We parent bodyRoot directly here.
    this._root = new THREE.Group();
    this._root.name = 'remote_player';
    this._root.add(this._playerObject.bodyRoot);
    scene.add(this._root);
  }

  update(state: RemotePlayerState) {
    const now = performance.now();
    const delta = Math.min((now - this._lastUpdateTime) / 1000, 0.1);
    this._lastUpdateTime = now;

    // Derive speed and direction from position delta.
    // Guard delta > 0 to avoid division by zero (two messages in the same ms
    // give delta = 0, which turns dist / 0 into Infinity, and 0 * Infinity = NaN
    // corrupting _animPhase and making all joint rotations NaN / invisible).
    let actualSpeed = 0;
    if (!isNaN(this._lastX) && delta > 0) {
      const dx = state.position.x - this._lastX;
      const dz = state.position.z - this._lastZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      actualSpeed = Math.min((dist / delta) * 4, 500); // cap avoids huge spike on stale delta
      if (dist > 0.001) {
        this._lastVelocityAngle = Math.atan2(dx, dz);
      }
    }
    this._lastX = state.position.x;
    this._lastZ = state.position.z;

    // Yaw from quaternion
    const q = new THREE.Quaternion(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    const eulerYaw = euler.y;

    this._playerObject.animate(delta, actualSpeed, actualSpeed, eulerYaw, this._lastVelocityAngle, false, !!state.crouching);

    this._root.position.set(state.position.x, state.position.y, state.position.z);
    this._root.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);

    this.lastSeen = Date.now();
  }

  destroy() {
    this.scene.remove(this._root);
  }
}
