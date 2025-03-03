import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { Scene } from '../../types/extended-threejs-types/scene.type';

import { Crosshair } from './Crosshair';
import { PlayerObject } from './PlayerObject';
import { LocalStorageService } from '../../services/localstorage/localstorage.service';

const vector000 = new THREE.Vector3(0, 0, 0);

export default class Player {
  readonly config = {
    jumpHeight: 40,
    movemetSpeed: 35,
    mass: 1,
    camera: {
      minAngle: THREE.MathUtils.degToRad(-89),
      maxAngle: THREE.MathUtils.degToRad(89),
      position: [0, 7.5, -2.6],
      thirdPerson: true,
      thirdPersonPosition: [0, 7.5, 10],
    },
  }

  mesh: any;
  cannonBody: CANNON.Body;

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

  private displayBlockerLastCallTime = 0;

  constructor(
    public camera: THREE.PerspectiveCamera,
    public scene: Scene
  ) {
    this.createPlayerModel();
    this.initEventListeners();
  }

  control = () => {
    if (document.pointerLockElement) {
      this.cannonBody.quaternion.setFromEuler(this.eulerY.x, this.eulerY.y, this.eulerY.z);

      this.cannonBody.velocity.x = 0;
      this.cannonBody.velocity.z = 0;

      this.movementDirection.z = +this.moveForward - +this.moveBackward;
      this.movementDirection.x = +this.moveLeft - +this.moveRight;

      let cameraDirection = this.convertXYZtoXZ(this.camera.getWorldDirection(vector000))
        .multiplyScalar(this.config.movemetSpeed);

      // Keyboard movement
      if (this.moveForward || this.moveBackward) {
        this.cannonBody.velocity.x += cameraDirection.x * this.movementDirection.z;
        this.cannonBody.velocity.z += cameraDirection.z * this.movementDirection.z;
      }

      if (this.moveLeft || this.moveRight) {
        this.cannonBody.velocity.x += cameraDirection.z * this.movementDirection.x;
        this.cannonBody.velocity.z += -cameraDirection.x * this.movementDirection.x;
      }

      if (this.jump && this.canJump) {
        this.cannonBody.velocity.y = this.config.jumpHeight;
        this.canJump = false;
      }
    }
  }

  savePosition = () => {
    LocalStorageService.set('player-position', {
      position: this.cannonBody.position,
      rotation: this.cannonBody.quaternion,
      camera: {
        eulerX: this.eulerX,
        eulerY: this.eulerY,
        position: this.camera.position,
      }
    });
  }

  loadPosition = () => {
    const playerPosition = LocalStorageService.get('player-position');
    if (playerPosition) {
      this.cannonBody.position.copy(playerPosition.position);
      this.cannonBody.quaternion.copy(playerPosition.rotation);
      this.eulerX.copy(playerPosition.camera.eulerX);
      this.eulerY.copy(playerPosition.camera.eulerY);
      this.camera.quaternion.setFromEuler(this.eulerX);
      this.camera.position.copy(playerPosition.camera.position);
    }
  }

  resetPosition = () => {
    this.cannonBody.position.set(0, 20, 50);
    this.eulerX.set(0, 0, 0);
    this.eulerY.set(0, 0, 0);
    // @ts-ignore`
    this.camera.position.set(...this.config.camera.position);
    this.camera.quaternion.setFromEuler(this.eulerX);
  }

  initEventListeners = () => {
    document.addEventListener('mousemove', this.onMouseMove, false);
    document.addEventListener('keydown', this.keydown, false);
    document.addEventListener('keyup', this.keyup, false);
    document.addEventListener('pointerlockchange', this.pointerlockchange);
    document.querySelector('#blocker').addEventListener('click', this.displayBlocker, false);
    window.addEventListener('click', this.playerShotHandler, false);
    this.cannonBody.addEventListener('collide', this.cannonBodyCollide);
  }

  removeEventListeners = () => {
    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('keydown', this.keydown, false);
    document.removeEventListener('keyup', this.keyup, false);
    document.removeEventListener('pointerlockchange', this.pointerlockchange);
    document.querySelector('#blocker').removeEventListener('click', this.displayBlocker, false);
    window.removeEventListener('click', this.playerShotHandler, false);
    this.cannonBody.removeEventListener('collide', this.cannonBodyCollide);
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
    const playerObject = new PlayerObject(this.scene);

    this.camera.add(crosshair.mesh);

    // @ts-ignore
    if (!this.config.camera.thirdPerson) this.camera.position.set(...this.config.camera.position);
    // @ts-ignore
    if (this.config.camera.thirdPerson) this.camera.position.set(...this.config.camera.thirdPersonPosition);
    playerObject.mesh.add(this.camera);
    playerObject.addToScene({ static: false });

    this.cannonBody = playerObject.cannonBody;
    this.mesh = playerObject.mesh;
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
    this.eulerX.x = Math.max(this.config.camera.minAngle, Math.min(this.config.camera.maxAngle, this.eulerX.x));

    if (this.config.camera.thirdPerson) {
      const [x, y, z] = this.config.camera.thirdPersonPosition;

      this.camera.position.y = this.eulerX.x > 0 ? y : Math.sin(-this.eulerX.x) * 10 + y; // Good
      this.camera.position.z = this.eulerX.x < 0 ? Math.cos(this.eulerX.x) * z : z; // ~ So so
    }

    this.camera.quaternion.setFromEuler(this.eulerX);
    this.cannonBody.quaternion.setFromEuler(this.eulerY.x, this.eulerY.y, this.eulerY.z);
  }

  private keydown = (event: any) => {
    switch (event.code) {
      case 'KeyW': case 'ArrowUp':    this.moveForward = true; break;   // W forward
      case 'KeyS': case 'ArrowDown':  this.moveBackward = true; break;  // S back
      case 'KeyA': case 'ArrowLeft':  this.moveLeft = true; break;      // A left
      case 'KeyD': case 'ArrowRight': this.moveRight = true; break;     // D right
      case 'KeyQ':                    this.rotationLeft = true; break;  // Q rotation left
      case 'KeyE':                    this.rotationRight = true; break; // E rotation right
      case 'ControlLeft':             this.crouch = true; break;        // Ctrl crouch
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
      case 'ControlLeft':             this.crouch = false; break;        // Ctrl crouch
      case 'Space':                   this.jump = false; break;          // Space jump
    }
  }

  private pointerlockchange = () => {
    this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = this.jump = false;

    document.getElementById('blocker').style.display = document.pointerLockElement ? 'none' : 'flex';

    this.displayBlockerLastCallTime = new Date().getTime();
  }

  private displayBlocker = () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    } else {
      // https://discourse.threejs.org/t/how-to-avoid-pointerlockcontrols-error/33017/3
      // > Seems to be a about a 1-second time window in Chrome before pointer can be locked again.
      const lastBlockInterval = new Date().getTime() - this.displayBlockerLastCallTime;
      const timeout = lastBlockInterval < 1250 ? 1250 - lastBlockInterval : 0;

      setTimeout(() => {
        document.body.requestPointerLock();
      }, timeout);
    }
  }
}
