import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { Scene } from '../../types/extended-threejs-types/scene.type';

import { Crosshair } from './Crosshair';
import { WsService } from '../../services/ws/ws.service';
import { PlayerObject } from './PlayerObject';
import { GlobalStateService } from '../../services/global-state/global-state.service';
import { PointerLockService } from '../../services/pointer-lock/pointer-lock.service';

const vector000 = new THREE.Vector3(0, 0, 0);

export const config = {
  jumpHeight: 40,
  movementSpeed: 35,
  mass: 1,
  camera: {
    minAngle: THREE.MathUtils.degToRad(-89),
    maxAngle: THREE.MathUtils.degToRad(89),
    position: [0, 4.6, -1.0] as [number, number, number],
    thirdPerson: false,
    thirdPersonPosition: [0, 7.5, 10],
  },
  body: {
    size: [3, 10, 3] as [number, number, number],
    crouchHeight: 6,
  },
  crouchingMovementSpeedMultiplier: 0.5,
}

export default class Player {
  mesh: any;
  cannonBody: CANNON.Body;
  private _playerObject?: PlayerObject;
  private _lastFrameTime = performance.now();
  private _lastVelocityAngle = 0;
  private _lastBodyX = 0;
  private _lastBodyZ = 0;

  /*get*/
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
  rotationRight = false;
  rotationLeft = false;
  jump = false;
  crouch = false;
  canJump = true;

  movementDirection = new THREE.Vector3();
  mainDirectionVector = new THREE.Vector3(0, 0, 1);
  quaternion = new THREE.Quaternion();

  eulerX = new THREE.Euler(0, 0, 0);
  eulerY = new THREE.Euler(0, 0, 0);

  // Cannon
  contactNormal = new CANNON.Vec3() // Normal in the contact, pointing *out* of whatever the player touched
  upAxis = new CANNON.Vec3(0, 1, 0)

  constructor(
    public camera: THREE.PerspectiveCamera,
    public scene: Scene
  ) {
    this.createPlayerModel();
    this.initEventListeners();
  }

  control = () => {
    // Frame delta — capped so a tab-switch spike doesn't break the animation
    const now = performance.now();
    const delta = Math.min((now - this._lastFrameTime) / 1000, 0.1);
    this._lastFrameTime = now;

    // Drive walk animation from keyboard input + camera direction.
    // Physics velocity alone is unreliable: moving boxes give velocity without input,
    // and wall collisions zero out velocity while keys are still held.
    const anyKeyPressed = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;

    // Position-delta speed: measures how far the body actually moved (immune to velocity overrides + wall blocks)
    const bx = this.cannonBody?.position.x ?? 0;
    const bz = this.cannonBody?.position.z ?? 0;
    const dx = bx - this._lastBodyX;
    const dz = bz - this._lastBodyZ;
    this._lastBodyX = bx;
    this._lastBodyZ = bz;
    const actualSpeed = (Math.sqrt(dx * dx + dz * dz) / delta) * 4; // *4 to match xzSpeed scale (~140 at full walk)

    let xzSpeed: number;
    let velocityAngle: number;
    if (anyKeyPressed) {
      // Compute intended direction from input + camera yaw (wall-collision-proof)
      const yaw = this.eulerY.y;
      const camFwdX = -Math.sin(yaw);
      const camFwdZ = -Math.cos(yaw);
      const fwd    = +this.moveForward  - +this.moveBackward;
      const strafe = +this.moveLeft     - +this.moveRight;
      const dirX   = camFwdX * fwd + camFwdZ * strafe;
      const dirZ   = camFwdZ * fwd - camFwdX * strafe;
      // Ensure animation plays even when blocked by a wall (blend activates on keypress);
      // actual cycle rate is driven by actualSpeed (position-delta) in animate()
      const speed  = config.movementSpeed * (this.crouch ? config.crouchingMovementSpeedMultiplier : 1);
      xzSpeed       = speed;
      velocityAngle = Math.atan2(dirX, dirZ);
      this._lastVelocityAngle = velocityAngle; // cache for blend-out
    } else {
      xzSpeed       = 0;
      velocityAngle = this._lastVelocityAngle; // keep last clean angle during walk blend-out
    }
    this._playerObject?.animate(delta, xzSpeed, actualSpeed, this.eulerY.y, velocityAngle, !this.canJump, this.crouch);

    if (document.pointerLockElement) {
      this.applyCrouch(this.crouch);

      this.cannonBody.quaternion.setFromEuler(this.eulerY.x, this.eulerY.y, this.eulerY.z);

      this.cannonBody.velocity.x = 0;
      this.cannonBody.velocity.z = 0;

      this.movementDirection.z = +this.moveForward - +this.moveBackward;
      this.movementDirection.x = +this.moveLeft - +this.moveRight;

      const speed = config.movementSpeed * (this.crouch ? config.crouchingMovementSpeedMultiplier : 1);
      let cameraDirection = this.convertXYZtoXZ(this.camera.getWorldDirection(vector000))
        .multiplyScalar(speed);

      // Combined, normalized movement — prevents diagonal speed boost (would be ×√2 otherwise)
      const inputVelX = cameraDirection.x * this.movementDirection.z + cameraDirection.z * this.movementDirection.x;
      const inputVelZ = cameraDirection.z * this.movementDirection.z - cameraDirection.x * this.movementDirection.x;
      const inputLen  = Math.sqrt(inputVelX * inputVelX + inputVelZ * inputVelZ);
      if (inputLen > 0) {
        this.cannonBody.velocity.x += inputVelX * (speed / inputLen);
        this.cannonBody.velocity.z += inputVelZ * (speed / inputLen);
      }

      if (this.jump && this.canJump) {
        this.cannonBody.velocity.y = config.jumpHeight;
        this.canJump = false;
      }
    }
  }

  private crouchingPreviousState = false;
  private applyCrouch(crouching: boolean) {
    if (crouching === this.crouchingPreviousState) return;
    const [bodyWidth, standHeight, bodyDepth] = config.body.size;
    const { crouchHeight } = config.body;
    const heigthDiff = standHeight - crouchHeight; // 2.5

    // Swap Cannon body shape.
    while (this.cannonBody.shapes.length > 0) {
      this.cannonBody.removeShape(this.cannonBody.shapes[0]);
    }

    if (crouching) {
      this.cannonBody.addShape(new CANNON.Box(new CANNON.Vec3(bodyWidth / 2, crouchHeight / 2, bodyDepth / 2)));
      this.cannonBody.position.y -= heigthDiff / 2; // keep feet at ground level
    } else {
      this.cannonBody.addShape(new CANNON.Box(new CANNON.Vec3(bodyWidth / 2, standHeight / 2, bodyDepth / 2)));
      this.cannonBody.position.y += heigthDiff / 2;
    }

    // this.camera.position.y = config.camera.thirdPersonPosition[1] + this.cameraYOffset;
    this.crouchingPreviousState = crouching;
  }

  setThirdPerson = (enabled: boolean) => {
    config.camera.thirdPerson = enabled;
    if (enabled) {
      const [x, y, z] = config.camera.thirdPersonPosition;
      this.camera.position.x = x;
      this.camera.position.y = this.eulerX.x > 0 ? y : Math.sin(-this.eulerX.x) * 10 + y;
      this.camera.position.z = this.eulerX.x < 0 ? Math.cos(this.eulerX.x) * z : z;
    } else {
      // @ts-ignore
      this.camera.position.set(...config.camera.position);
    }
  }

  private onStateChanged = () => {
    this.setThirdPerson(GlobalStateService.state.thirdPerson);
  }

  savePosition = () => {
    WsService.send({
      type: 'save_position',
      state: {
        position: this.cannonBody.position,
        rotation: this.cannonBody.quaternion,
        camera: {
          eulerX: this.eulerX,
          eulerY: this.eulerY,
          position: this.camera.position,
        },
      },
    });
  }

  private applyPosition = (state: { position: any; rotation: any; camera: any }) => {
    this.cannonBody.position.copy(state.position);
    this.cannonBody.quaternion.copy(state.rotation);
    this.eulerX.copy(state.camera.eulerX);
    this.eulerY.copy(state.camera.eulerY);
    this.camera.quaternion.setFromEuler(this.eulerX);
    // Camera local offset is a config setting — do not restore from saved state
    // to ensure config.camera.position changes always take effect.
    this.setThirdPerson(config.camera.thirdPerson);
  }

  resetPosition = () => {
    this.cannonBody.position.set(0, 20, 50);
    this.eulerX.set(0, 0, 0);
    this.eulerY.set(0, 0, 0);
    if (config.camera.thirdPerson) {
      // @ts-ignore
      this.camera.position.set(...config.camera.thirdPersonPosition);
    } else {
      // @ts-ignore
      this.camera.position.set(...config.camera.position);
    }
    this.camera.quaternion.setFromEuler(this.eulerX);
  }

  initEventListeners = () => {
    document.addEventListener('mousemove', this.onMouseMove, false);
    document.addEventListener('keydown', this.keydown, false);
    document.addEventListener('keyup', this.keyup, false);
    PointerLockService.lockChanged.addEventListener('change', this.pointerlockchange);
    window.addEventListener('click', this.playerShotHandler, false);
    this.cannonBody.addEventListener('collide', this.cannonBodyCollide);
    GlobalStateService.stateChanged.addEventListener('stateChanged', this.onStateChanged);
    WsService.on('position_init', (msg: any) => this.applyPosition(msg.state));
  }

  removeEventListeners = () => {
    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('keydown', this.keydown, false);
    document.removeEventListener('keyup', this.keyup, false);
    PointerLockService.lockChanged.removeEventListener('change', this.pointerlockchange);
    window.removeEventListener('click', this.playerShotHandler, false);
    this.cannonBody.removeEventListener('collide', this.cannonBodyCollide);
    GlobalStateService.stateChanged.removeEventListener('stateChanged', this.onStateChanged);
    WsService.off('position_init');
  }

  private playerShotHandler = () => {
    let raycaster = new THREE.Raycaster();
    let position = this.camera.getWorldPosition(new THREE.Vector3())
    let direction = this.camera.getWorldDirection(new THREE.Vector3())

    raycaster.set(position, direction)
    raycaster.intersectObjects(this.scene.children, true).forEach((i, ind) => {
      if (i.object.name && ind == 4) console.log('hit', i.object.name)
    })
  }

  private createPlayerModel = () => {
    const crosshair = new Crosshair(this.scene);
    const playerObject = new PlayerObject(this.scene, config.body)

    this.camera.add(crosshair.mesh);

    // @ts-ignore
    if (!config.camera.thirdPerson) this.camera.position.set(...config.camera.position);
    // @ts-ignore
    if (config.camera.thirdPerson) this.camera.position.set(...config.camera.thirdPersonPosition);
    playerObject.mesh.add(this.camera);
    playerObject.addToScene({ static: false });

    this.cannonBody = playerObject.cannonBody;
    this.cannonBody.linearDamping = 0.99; // prevent physics micro-slide when idle
    this.mesh = playerObject.mesh;
    this._playerObject = playerObject;
  }

  private convertXYZtoXZ = (vector: THREE.Vector3) => {
    const xzVector = new THREE.Vector3(vector.x, 0, vector.z);
    return xzVector.normalize();
  }

  // Example here:
  // https://github.com/pmndrs/cannon-es/blob/master/examples/js/PointerLockControlsCannon.js
  private cannonBodyCollide = (event: any) => {
    const { contact } = event

    // contact.bi and contact.bj are the colliding bodies, and contact.ni is the collision normal.
    // We do not yet know which one is which! Let's check.
    if (contact.bi.id === this.cannonBody.id) {
      // bi is the player body, flip the contact normal
      contact.ni.negate(this.contactNormal);
    } else {
      // bi is something else. Keep the normal as it is
      this.contactNormal.copy(contact.ni);
    }

    // If contactNormal.dot(upAxis) is between 0 and 1, we know that the contact normal is somewhat in the up direction.
    if (this.contactNormal.dot(this.upAxis) > 0.5) {
      // Use a "good" threshold value between 0 and 1 here!
      this.canJump = true;
    }
  }

  private onMouseMove = (event: any) => {
    if (!document.pointerLockElement) return;

    let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    this.eulerY.y -= movementX * 0.002;
    this.eulerX.x -= movementY * 0.002;
    this.eulerX.x = Math.max(config.camera.minAngle, Math.min(config.camera.maxAngle, this.eulerX.x));

    if (config.camera.thirdPerson) {
      const [x, y, z] = config.camera.thirdPersonPosition;
      this.camera.position.y = this.eulerX.x > 0 ? y : Math.sin(-this.eulerX.x) * 10 + y; // Good
      this.camera.position.z = this.eulerX.x < 0 ? Math.cos(this.eulerX.x) * z : z; // ~ So so
    }

    this.camera.quaternion.setFromEuler(this.eulerX);
    this.cannonBody.quaternion.setFromEuler(this.eulerY.x, this.eulerY.y, this.eulerY.z);
  }

  private keydown = (event: any) => {
    // Prevent CMD+W/Q/S/A/D etc. from triggering browser actions while in-game.
    // CMD+R (reload) is intentionally left through.
    // Note: CMD+W cannot be blocked in Chrome/Safari — the browser intercepts it.
    if (event.metaKey && event.code !== 'KeyR') event.preventDefault();

    switch (event.code) {
      case 'KeyW': case 'ArrowUp':    this.moveForward = true; break;   // W forward
      case 'KeyS': case 'ArrowDown':  this.moveBackward = true; break;  // S back
      case 'KeyA': case 'ArrowLeft':  this.moveLeft = true; break;      // A left
      case 'KeyD': case 'ArrowRight': this.moveRight = true; break;     // D right
      case 'KeyQ':                    this.rotationLeft = true; break;  // Q rotation left
      case 'KeyE':                    this.rotationRight = true; break; // E rotation right
      case 'ShiftLeft':
      case 'ControlLeft':
      case 'MetaLeft':
      case 'MetaRight':               this.crouch = true; break;  // Ctrl / CMD crouch
      case 'Space':                   this.jump = true; break;          // Space jump
    }
  }

  private keyup = (event: any) => {
    switch (event.code) {
      case 'KeyW': case 'ArrowUp':    this.moveForward = false; break;   // W forward
      case 'KeyS': case 'ArrowDown':  this.moveBackward = false; break;  // S back
      case 'KeyA': case 'ArrowLeft':  this.moveLeft = false; break;      // A left
      case 'KeyD': case 'ArrowRight': this.moveRight = false; break;     // D right
      case 'KeyQ':                    this.rotationLeft = false; break;  // Q rotation left
      case 'KeyE':                    this.rotationRight = false; break; // E rotation right
      case 'ShiftLeft':               
      case 'ControlLeft':
      case 'MetaLeft':
      case 'MetaRight':               this.crouch = false; break; // Ctrl / CMD crouch
      case 'Space':                   this.jump = false; break;          // Space jump
    }
  }

  private pointerlockchange = () => {
    this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = this.jump = this.crouch = false;
  }
}
