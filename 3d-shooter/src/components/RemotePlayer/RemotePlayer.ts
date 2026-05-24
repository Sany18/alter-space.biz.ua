import * as THREE from 'three';
import { Scene } from '../../types/extended-threejs-types/scene.type';
import { PlayerObject } from '../Player/PlayerObject';
import { config } from '../Player/Player';

export interface RemotePlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  crouching?: boolean;
  cameraPitch?: number;
}

export class RemotePlayer {
  private readonly _playerObject: PlayerObject;
  private readonly _root: THREE.Group;
  lastSeen: number = Date.now();

  private _lastUpdateTime = performance.now();
  private _lastTickTime = performance.now();
  private _lastX = NaN;
  private _lastZ = NaN;
  private _lastVelocityAngle = 0;

  // Persisted between WS updates — read every render frame by tick()
  private _currentSpeed = 0;
  private _eulerYaw = 0;
  private _crouching = false;
  private _cameraPitch = 0;

  private readonly _tmpQ = new THREE.Quaternion();
  private readonly _tmpE = new THREE.Euler();

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

    // Derive speed and direction from position delta between WS messages.
    // Guard delta > 0 to avoid division by zero when two messages land in the same ms.
    if (!isNaN(this._lastX) && delta > 0) {
      const dx = state.position.x - this._lastX;
      const dz = state.position.z - this._lastZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Ignore micro-slides smaller than this threshold — physics damping leaves
      // a tiny residual drift that would otherwise trigger the walk animation
      // even when the remote player is standing still.
      const MIN_MOVE_DIST = 0.05;
      if (dist > MIN_MOVE_DIST) {
        this._currentSpeed = Math.min((dist / delta) * 4, 500);
        this._lastVelocityAngle = Math.atan2(dx, dz);
      } else {
        this._currentSpeed = 0;
      }
    } else {
      this._currentSpeed = 0;
    }
    this._lastX = state.position.x;
    this._lastZ = state.position.z;

    // Cache yaw and crouch state — consumed every frame by tick()
    this._tmpQ.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    this._eulerYaw = this._tmpE.setFromQuaternion(this._tmpQ, 'YXZ').y;
    this._crouching = !!state.crouching;
    this._cameraPitch = state.cameraPitch ?? 0;

    this._root.position.set(state.position.x, state.position.y, state.position.z);
    this._root.quaternion.copy(this._tmpQ);

    this.lastSeen = Date.now();
  }

  /** Called every render frame — advances the animation at full FPS. */
  tick() {
    const now = performance.now();
    const delta = Math.min((now - this._lastTickTime) / 1000, 0.1);
    this._lastTickTime = now;
    this._playerObject.animate(delta, this._currentSpeed, this._currentSpeed, this._eulerYaw, this._lastVelocityAngle, false, this._crouching);
    this._playerObject.headPivot.rotation.x = -this._cameraPitch;
  }

  destroy() {
    this.scene.remove(this._root);
  }
}
