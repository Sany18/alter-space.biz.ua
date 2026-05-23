import * as THREE from 'three';

import { Scene } from '../../types/extended-threejs-types/scene.type';

import { AbstractObject } from '../abstract-object';

// ── Palette ──────────────────────────────────────────────────────────────────
const C_SKIN  = 0xf5cba7;  // exposed skin
const C_CLOTH = 0x2c3e50;  // dark navy clothing
const C_SHOE  = 0x1a1a1a;  // near-black shoes
const C_HAIR  = 0x2c1810;  // dark-brown hair

export class PlayerObject extends AbstractObject {
  config = { showTrigger: true };

  // ── Animation pivot groups (public for external animation systems) ──────────
  bodyRoot!: THREE.Group;

  // ── Walk animation state ─────────────────────────────────────────────────────
  private _animPhase = 0;
  private _walkBlend = 0;

  // spine chain
  hips!: THREE.Group;
  spine!: THREE.Group;
  neckPivot!: THREE.Group;
  headPivot!: THREE.Group;

  // leg pivots
  leftHipPivot!: THREE.Group;
  leftKneePivot!: THREE.Group;
  rightHipPivot!: THREE.Group;
  rightKneePivot!: THREE.Group;

  // arm pivots
  leftShoulderPivot!: THREE.Group;
  leftElbowPivot!: THREE.Group;
  rightShoulderPivot!: THREE.Group;
  rightElbowPivot!: THREE.Group;

  constructor(scene: Scene) {
    super(scene);

    // Invisible box — only drives CANNON physics body (unchanged)
    this.geometry = new THREE.BoxGeometry(3, 10, 2.5);
    this.material = new THREE.MeshBasicMaterial({ visible: false });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(0, 20, 50);
    this.mesh.name = 'me';

    // Detailed humanoid visual attached as a child of the physics mesh
    this.bodyRoot = this.buildBody();
    this.mesh.add(this.bodyRoot);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private box(w: number, h: number, d: number, color: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── Body builder ─────────────────────────────────────────────────────────────
  //
  //  Hierarchy (each Group is a named animation pivot):
  //
  //  bodyRoot
  //  └── hips                        (y ≈  0.0 in mesh space)
  //      ├── hipsMesh
  //      ├── leftHipPivot             (hip joint)
  //      │   ├── leftThigh
  //      │   └── leftKneePivot        (knee joint)
  //      │       ├── leftShin
  //      │       └── leftFoot
  //      ├── rightHipPivot
  //      │   └── … (mirror)
  //      └── spine                   (torso pivot, child of hips)
  //          ├── torso
  //          ├── leftShoulderPivot    (shoulder joint)
  //          │   ├── leftUpperArm
  //          │   └── leftElbowPivot   (elbow joint)
  //          │       ├── leftForearm
  //          │       └── leftHand
  //          ├── rightShoulderPivot
  //          │   └── … (mirror)
  //          └── neckPivot            (neck joint)
  //              ├── neckMesh
  //              └── headPivot        (head joint — yaw / pitch here)
  //                  ├── headMesh
  //                  └── hairMesh

  private buildBody(): THREE.Group {
    // ── HIPS ────────────────────────────────────────────────────────────────
    this.hips = new THREE.Group();
    this.hips.name = 'hips';
    this.hips.position.y = 0.0; // hips center sits at cannon body center

    const hipsMesh = this.box(2.0, 1.0, 1.0, C_CLOTH);
    hipsMesh.name = 'hips_mesh';
    this.hips.add(hipsMesh);

    // ── LEFT LEG ─────────────────────────────────────────────────────────────
    this.leftHipPivot = new THREE.Group();
    this.leftHipPivot.name = 'left_hip_pivot';
    this.leftHipPivot.position.set(-0.65, -0.5, 0); // hip joint in hips space

    const leftThigh = this.box(0.85, 2.0, 0.85, C_CLOTH);
    leftThigh.name = 'left_thigh';
    leftThigh.position.y = -1.0; // hangs down from hip joint

    this.leftKneePivot = new THREE.Group();
    this.leftKneePivot.name = 'left_knee_pivot';
    this.leftKneePivot.position.y = -2.0; // end of thigh

    const leftShin = this.box(0.75, 2.0, 0.75, C_CLOTH);
    leftShin.name = 'left_shin';
    leftShin.position.y = -1.0;

    const leftFoot = this.box(0.8, 0.5, 1.2, C_SHOE);
    leftFoot.name = 'left_foot';
    leftFoot.position.set(0, -2.25, 0.15); // foot bottom lands at y = –5 in mesh space

    this.leftKneePivot.add(leftShin, leftFoot);
    this.leftHipPivot.add(leftThigh, this.leftKneePivot);
    this.hips.add(this.leftHipPivot);

    // ── RIGHT LEG ────────────────────────────────────────────────────────────
    this.rightHipPivot = new THREE.Group();
    this.rightHipPivot.name = 'right_hip_pivot';
    this.rightHipPivot.position.set(0.65, -0.5, 0);

    const rightThigh = this.box(0.85, 2.0, 0.85, C_CLOTH);
    rightThigh.name = 'right_thigh';
    rightThigh.position.y = -1.0;

    this.rightKneePivot = new THREE.Group();
    this.rightKneePivot.name = 'right_knee_pivot';
    this.rightKneePivot.position.y = -2.0;

    const rightShin = this.box(0.75, 2.0, 0.75, C_CLOTH);
    rightShin.name = 'right_shin';
    rightShin.position.y = -1.0;

    const rightFoot = this.box(0.8, 0.5, 1.2, C_SHOE);
    rightFoot.name = 'right_foot';
    rightFoot.position.set(0, -2.25, 0.15);

    this.rightKneePivot.add(rightShin, rightFoot);
    this.rightHipPivot.add(rightThigh, this.rightKneePivot);
    this.hips.add(this.rightHipPivot);

    // ── SPINE / TORSO ─────────────────────────────────────────────────────────
    this.spine = new THREE.Group();
    this.spine.name = 'spine';
    this.spine.position.y = 0.5; // torso base sits just above hips center

    const torso = this.box(2.2, 2.8, 1.0, C_CLOTH);
    torso.name = 'torso';
    torso.position.y = 1.4; // torso center = 1.4 above spine origin
    this.spine.add(torso);

    // ── LEFT ARM ──────────────────────────────────────────────────────────────
    this.leftShoulderPivot = new THREE.Group();
    this.leftShoulderPivot.name = 'left_shoulder_pivot';
    this.leftShoulderPivot.position.set(-1.4, 2.6, 0); // shoulder joint in spine space

    const leftUpperArm = this.box(0.65, 1.5, 0.65, C_CLOTH);
    leftUpperArm.name = 'left_upper_arm';
    leftUpperArm.position.y = -0.75;

    this.leftElbowPivot = new THREE.Group();
    this.leftElbowPivot.name = 'left_elbow_pivot';
    this.leftElbowPivot.position.y = -1.5;

    const leftForearm = this.box(0.55, 1.4, 0.55, C_SKIN);
    leftForearm.name = 'left_forearm';
    leftForearm.position.y = -0.7;

    const leftHand = this.box(0.55, 0.5, 0.3, C_SKIN);
    leftHand.name = 'left_hand';
    leftHand.position.y = -1.65;

    this.leftElbowPivot.add(leftForearm, leftHand);
    this.leftShoulderPivot.add(leftUpperArm, this.leftElbowPivot);
    this.spine.add(this.leftShoulderPivot);

    // ── RIGHT ARM ─────────────────────────────────────────────────────────────
    this.rightShoulderPivot = new THREE.Group();
    this.rightShoulderPivot.name = 'right_shoulder_pivot';
    this.rightShoulderPivot.position.set(1.4, 2.6, 0);

    const rightUpperArm = this.box(0.65, 1.5, 0.65, C_CLOTH);
    rightUpperArm.name = 'right_upper_arm';
    rightUpperArm.position.y = -0.75;

    this.rightElbowPivot = new THREE.Group();
    this.rightElbowPivot.name = 'right_elbow_pivot';
    this.rightElbowPivot.position.y = -1.5;

    const rightForearm = this.box(0.55, 1.4, 0.55, C_SKIN);
    rightForearm.name = 'right_forearm';
    rightForearm.position.y = -0.7;

    const rightHand = this.box(0.55, 0.5, 0.3, C_SKIN);
    rightHand.name = 'right_hand';
    rightHand.position.y = -1.65;

    this.rightElbowPivot.add(rightForearm, rightHand);
    this.rightShoulderPivot.add(rightUpperArm, this.rightElbowPivot);
    this.spine.add(this.rightShoulderPivot);

    // ── NECK & HEAD ───────────────────────────────────────────────────────────
    this.neckPivot = new THREE.Group();
    this.neckPivot.name = 'neck_pivot';
    this.neckPivot.position.y = 2.8; // top of torso, in spine space

    const neckMesh = this.box(0.5, 0.45, 0.5, C_SKIN);
    neckMesh.name = 'neck';
    neckMesh.position.y = 0.22;

    this.headPivot = new THREE.Group();
    this.headPivot.name = 'head_pivot'; // rotate here for look-up/down & head-turn
    this.headPivot.position.y = 0.45;

    const headMesh = this.box(1.2, 1.3, 1.2, C_SKIN);
    headMesh.name = 'head';
    headMesh.position.y = 0.65;

    const hairMesh = this.box(1.25, 0.45, 1.25, C_HAIR);
    hairMesh.name = 'hair';
    hairMesh.position.set(0, 1.52, -0.08); // slightly back

    this.headPivot.add(headMesh, hairMesh);
    this.neckPivot.add(neckMesh, this.headPivot);
    this.spine.add(this.neckPivot);

    // ── ASSEMBLE ──────────────────────────────────────────────────────────────
    this.hips.add(this.spine);

    const root = new THREE.Group();
    root.name = 'body_root';
    root.rotation.y = Math.PI; // model faces same direction as the physics body
    root.add(this.hips);
    return root;
  }

  // ── Procedural walk animation ─────────────────────────────────────────────
  //
  //  Call every frame with:
  //    delta         – seconds since last frame
  //    xzSpeed       – actual horizontal speed (cannon velocity magnitude)
  //    eulerYaw      – current player yaw (eulerY.y from Player)
  //    velocityAngle – atan2(vx, vz) of cannon velocity — world-space movement direction
  //
  //  camRel convention (after correction for Three.js coordinate system):
  //    0     = moving forward (same direction camera faces)
  //    ±π    = moving backward
  //    ±π/2  = strafing left / right

  animate(delta: number, xzSpeed: number, eulerYaw: number, velocityAngle: number): void {
    const isMoving = xzSpeed > 0.5;

    // Exponential blend towards 1 (walking) or 0 (idle)
    const blendRate = isMoving ? 12 : 5;
    this._walkBlend += (+(isMoving) - this._walkBlend) * (1 - Math.exp(-blendRate * delta));

    // Camera-relative movement angle.
    // velocityAngle = π when moving forward (camera faces -Z → atan2(0,-1) = π),
    // so subtract π to shift the convention to: 0 = forward, ±π = backward.
    let camRel = velocityAngle - eulerYaw - Math.PI;
    camRel = Math.atan2(Math.sin(camRel), Math.cos(camRel)); // wrap to [-π, π]

    // Phase direction: +1 when moving forward (cos > 0), -1 when backward (cos < 0).
    // This makes the leg swing reverse for backward movement.
    if (isMoving) {
      const phaseDir = Math.cos(camRel) >= 0 ? 1 : -1;
      this._animPhase += delta * (4.5 + xzSpeed * 0.05) * phaseDir;
    }

    const t  = this._animPhase;
    const b  = this._walkBlend;
    const lr  = 1 - Math.exp(-20 * delta); // fast limb lerp
    const lrS = 1 - Math.exp(-8 * delta);  // slower body-turn lerp

    // ── Leg swing (opposite phase) ──────────────────────────────────────────
    const thighSwing = 0.55; // ±~31°
    lerp_to(this.leftHipPivot,  'rx',  Math.sin(t) * thighSwing * b, lr);
    lerp_to(this.rightHipPivot, 'rx', -Math.sin(t) * thighSwing * b, lr);

    // ── Knee bend (only bends on the backstroke, never negative) ────────────
    const kneeBend = 0.6; // ~34°
    lerp_to(this.leftKneePivot,  'rx', Math.max(0,  Math.sin(t + Math.PI * 0.5)) * kneeBend * b, lr);
    lerp_to(this.rightKneePivot, 'rx', Math.max(0, -Math.sin(t + Math.PI * 0.5)) * kneeBend * b, lr);

    // ── Arm swing (cross: left arm swings with right leg) ───────────────────
    const armSwing = 0.4; // ~23°
    lerp_to(this.leftShoulderPivot,  'rx', -Math.sin(t) * armSwing * b, lr);
    lerp_to(this.rightShoulderPivot, 'rx',  Math.sin(t) * armSwing * b, lr);

    // ── Hip bob (twice per step cycle, always upward) ───────────────────────
    lerp_to(this.hips, 'y', Math.abs(Math.sin(t)) * 0.15 * b, lr);

    // ── Slight forward lean while walking ───────────────────────────────────
    lerp_to(this.spine, 'rx', -0.05 * b, lr);

    // ── Lower-body yaw: rotate for strafing only ────────────────────────────
    //  Using the sin component of camRel means:
    //    • forward / backward → sin ≈ 0 → no body rotation (no 180° flip)
    //    • strafe left/right  → sin ≈ ±1 → body turns up to maxBodyRot
    //  Short-arc lerp avoids wrapping through ±π.
    const maxBodyRot  = 1.0; // ~57° max strafe twist
    const targetBodyYaw = Math.PI + Math.sin(camRel) * maxBodyRot * b;
    let bodyYawDiff = targetBodyYaw - this.bodyRoot.rotation.y;
    bodyYawDiff = Math.atan2(Math.sin(bodyYawDiff), Math.cos(bodyYawDiff)); // wrap to [-π,π]
    this.bodyRoot.rotation.y += bodyYawDiff * lrS;

    // Spine counteracts half the body rotation — upper body stays aimed at camera
    lerp_to(this.spine, 'ry', -Math.sin(camRel) * maxBodyRot * 0.5 * b, lr);
  }
}

// Tiny helper — lerp a rotation or position channel towards a target
function lerp_to(obj: THREE.Object3D, channel: 'x' | 'y' | 'z' | 'rx' | 'ry' | 'rz', target: number, t: number) {
  if (channel === 'x')  obj.position.x  = THREE.MathUtils.lerp(obj.position.x, target, t);
  else if (channel === 'y')  obj.position.y = THREE.MathUtils.lerp(obj.position.y, target, t);
  else if (channel === 'z')  obj.position.z = THREE.MathUtils.lerp(obj.position.z, target, t);
  else if (channel === 'rx') obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, target, t);
  else if (channel === 'ry') obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, target, t);
  else if (channel === 'rz') obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, target, t);
}
