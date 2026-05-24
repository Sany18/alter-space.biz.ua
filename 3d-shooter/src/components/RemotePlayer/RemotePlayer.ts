import * as THREE from 'three';
import { Scene } from '../../types/extended-threejs-types/scene.type';
import { PlayerObject } from '../Player/PlayerObject';
import { config } from '../Player/Player';

export interface RemotePlayerState {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  crouching?: boolean;
  cameraPitch?: number;
  deleted?: boolean;
}

interface Snapshot {
  px: number; py: number; pz: number;
  rx: number; ry: number; rz: number; rw: number;
}

export class RemotePlayer {
  private readonly _playerObject: PlayerObject;
  private readonly _root: THREE.Group;
  private _lastVelocityAngle = 0;

  // Persisted between WS updates — read every render frame by tick()
  private _currentSpeed = 0;
  private _eulerYaw = 0;
  private _crouching = false;
  private _cameraPitch = 0;

  // Snapshot interpolation state
  private _prev: Snapshot | null = null;
  private _target: Snapshot | null = null;
  private _targetReceivedAt = 0;
  private _interpStart = 0;
  private _interpDuration = 1;
  private _lastTickTime = performance.now();

  private readonly _prevQ = new THREE.Quaternion();
  private readonly _targetQ = new THREE.Quaternion();
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

    const snap: Snapshot = {
      px: state.position.x, py: state.position.y, pz: state.position.z,
      rx: state.rotation.x, ry: state.rotation.y, rz: state.rotation.z, rw: state.rotation.w,
    };

    if (this._target === null) {
      // First update: snap immediately with no interpolation
      this._prev = snap;
      this._target = snap;
      this._interpStart = now - 99999;
      this._interpDuration = 1;
    } else {
      // Derive speed and direction from position delta between WS messages.
      const dx = state.position.x - this._target.px;
      const dz = state.position.z - this._target.pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const dt = Math.max(now - this._targetReceivedAt, 1) / 1000;
      // Ignore micro-slides smaller than this threshold — physics damping leaves
      // a tiny residual drift that would otherwise trigger the walk animation
      // even when the remote player is standing still.
      const MIN_MOVE_DIST = 0.05;
      if (dist > MIN_MOVE_DIST) {
        this._currentSpeed = Math.min((dist / dt) * 4, 500);
        this._lastVelocityAngle = Math.atan2(dx, dz);
      } else {
        this._currentSpeed = 0;
      }

      this._interpDuration = Math.max(now - this._targetReceivedAt, 1);
      this._prev = this._target;
      this._target = snap;
      this._interpStart = now;
    }

    this._targetReceivedAt = now;

    this._tmpQ.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    this._eulerYaw = this._tmpE.setFromQuaternion(this._tmpQ, 'YXZ').y;
    this._crouching = !!state.crouching;
    this._cameraPitch = state.cameraPitch ?? 0;
  }

  tick() {
    const now = performance.now();
    const dt = (now - this._lastTickTime) / 1000;
    this._lastTickTime = now;

    if (!this._target) return;

    const t = Math.min((now - this._interpStart) / this._interpDuration, 1);

    if (this._prev && t < 1) {
      this._root.position.set(
        this._prev.px + (this._target.px - this._prev.px) * t,
        this._prev.py + (this._target.py - this._prev.py) * t,
        this._prev.pz + (this._target.pz - this._prev.pz) * t,
      );
      this._prevQ.set(this._prev.rx, this._prev.ry, this._prev.rz, this._prev.rw);
      this._targetQ.set(this._target.rx, this._target.ry, this._target.rz, this._target.rw);
      this._root.quaternion.copy(this._prevQ).slerp(this._targetQ, t);
    } else {
      this._root.position.set(this._target.px, this._target.py, this._target.pz);
      this._targetQ.set(this._target.rx, this._target.ry, this._target.rz, this._target.rw);
      this._root.quaternion.copy(this._targetQ);
    }

    this._playerObject.animate(dt, this._currentSpeed, this._currentSpeed, this._eulerYaw, this._lastVelocityAngle, false, this._crouching);
    this._playerObject.headPivot.rotation.x = -this._cameraPitch;
  }

  destroy() {
    this.scene.remove(this._root);
  }
}
