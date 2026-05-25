import { GlobalStateService } from '../../services/global-state/global-state.service';
import Player from '../Player/Player';
import { config } from '../Player/Player';

import './MobileControls.scss';

const JOYSTICK_MAX_OFFSET = 27; // max knob travel in px (base_radius - knob_radius)
const DEAD_ZONE = 0.2;
const LOOK_SENSITIVITY = 0.004;

export class MobileControls {
  private player: Player;
  private container!: HTMLDivElement;
  private lookArea!: HTMLDivElement;
  private joystickBase!: HTMLDivElement;
  private joystickKnob!: HTMLDivElement;
  private jumpBtn!: HTMLButtonElement;
  private menuBtn!: HTMLButtonElement;

  private joystickTouchId: number | null = null;
  private joystickCenterX = 0;
  private joystickCenterY = 0;

  private lookTouchId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

  static isTouchDevice(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  constructor(player: Player) {
    this.player = player;
    this.player.isMobileActive = true;
    this.build();
    this.attachEvents();
  }

  private build() {
    this.container = document.createElement('div');
    this.container.className = 'mobile-controls';

    this.lookArea = document.createElement('div');
    this.lookArea.className = 'mobile-controls__look-area';

    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'mobile-controls__joystick-base';

    this.joystickKnob = document.createElement('div');
    this.joystickKnob.className = 'mobile-controls__joystick-knob';
    this.joystickBase.appendChild(this.joystickKnob);

    this.jumpBtn = document.createElement('button');
    this.jumpBtn.className = 'mobile-controls__jump-btn';
    this.jumpBtn.setAttribute('type', 'button');
    this.jumpBtn.textContent = '↑';

    this.menuBtn = document.createElement('button');
    this.menuBtn.className = 'mobile-controls__menu-btn';
    this.menuBtn.setAttribute('type', 'button');
    this.menuBtn.textContent = '☰';
    this.menuBtn.addEventListener('click', this.onMenuTap);

    this.container.appendChild(this.lookArea);
    this.container.appendChild(this.joystickBase);
    this.container.appendChild(this.jumpBtn);
    this.container.appendChild(this.menuBtn);
    document.body.appendChild(this.container);
  }

  private attachEvents() {
    this.joystickBase.addEventListener('touchstart', this.onJoystickStart, { passive: false });
    this.lookArea.addEventListener('touchstart', this.onLookStart, { passive: false });
    this.jumpBtn.addEventListener('touchstart', this.onJumpStart, { passive: false });
    this.jumpBtn.addEventListener('touchend', this.onJumpEnd);
    document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('touchcancel', this.onTouchEnd);
  }

  // ── Joystick ──────────────────────────────────────────────────

  private onJoystickStart = (e: TouchEvent) => {
    e.preventDefault();
    if (this.joystickTouchId !== null) return;
    const touch = e.changedTouches[0];
    this.joystickTouchId = touch.identifier;
    const rect = this.joystickBase.getBoundingClientRect();
    this.joystickCenterX = rect.left + rect.width / 2;
    this.joystickCenterY = rect.top + rect.height / 2;
  };

  private updateJoystick(touch: Touch) {
    const dx = touch.clientX - this.joystickCenterX;
    const dy = touch.clientY - this.joystickCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_MAX_OFFSET);
    const angle = Math.atan2(dy, dx);

    this.joystickKnob.style.transform =
      `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;

    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const mag = Math.min(dist / JOYSTICK_MAX_OFFSET, 1);

    this.player.moveForward  = ny * mag < -DEAD_ZONE;
    this.player.moveBackward = ny * mag >  DEAD_ZONE;
    this.player.moveLeft     = nx * mag < -DEAD_ZONE;
    this.player.moveRight    = nx * mag >  DEAD_ZONE;
  }

  private resetJoystick() {
    this.joystickTouchId = null;
    this.joystickKnob.style.transform = 'translate(0, 0)';
    this.player.moveForward = this.player.moveBackward =
      this.player.moveLeft  = this.player.moveRight = false;
  }

  // ── Look area ─────────────────────────────────────────────────

  private onLookStart = (e: TouchEvent) => {
    e.preventDefault();
    if (this.lookTouchId !== null) return;
    const touch = e.changedTouches[0];
    this.lookTouchId = touch.identifier;
    this.lastLookX = touch.clientX;
    this.lastLookY = touch.clientY;
  };

  private updateLook(touch: Touch) {
    const dx = touch.clientX - this.lastLookX;
    const dy = touch.clientY - this.lastLookY;
    this.lastLookX = touch.clientX;
    this.lastLookY = touch.clientY;

    this.player.eulerY.y -= dx * LOOK_SENSITIVITY;
    this.player.eulerX.x -= dy * LOOK_SENSITIVITY;
    this.player.eulerX.x = Math.max(
      config.camera.minAngle,
      Math.min(config.camera.maxAngle, this.player.eulerX.x),
    );

    if (config.camera.thirdPerson) {
      const [, y, z] = config.camera.thirdPersonPosition;
      this.player.camera.position.y = this.player.eulerX.x > 0
        ? y : Math.sin(-this.player.eulerX.x) * 10 + y;
      this.player.camera.position.z = this.player.eulerX.x < 0
        ? Math.cos(this.player.eulerX.x) * z : z;
    }

    this.player.camera.quaternion.setFromEuler(this.player.eulerX);
    this.player.cannonBody.quaternion.setFromEuler(
      this.player.eulerY.x, this.player.eulerY.y, this.player.eulerY.z,
    );
  }

  // ── Jump ──────────────────────────────────────────────────────

  private onJumpStart = (e: TouchEvent) => {
    e.preventDefault();
    this.player.jump = true;
  };

  private onJumpEnd = () => {
    this.player.jump = false;
  };

  private onMenuTap = (e: TouchEvent) => {
    e.preventDefault();
    GlobalStateService.set('menuOpen', true);
  };

  // ── Shared move/end handlers ──────────────────────────────────

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.joystickTouchId) this.updateJoystick(t);
      if (t.identifier === this.lookTouchId)     this.updateLook(t);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.joystickTouchId) this.resetJoystick();
      if (t.identifier === this.lookTouchId)     this.lookTouchId = null;
    }
  };

  // ── Cleanup ───────────────────────────────────────────────────

  destroy() {
    this.player.isMobileActive = false;
    this.player.moveForward = this.player.moveBackward =
      this.player.moveLeft  = this.player.moveRight = this.player.jump = false;
    this.joystickBase.removeEventListener('touchstart', this.onJoystickStart);
    this.lookArea.removeEventListener('touchstart', this.onLookStart);
    this.jumpBtn.removeEventListener('touchstart', this.onJumpStart);
    this.jumpBtn.removeEventListener('touchend', this.onJumpEnd);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
    document.removeEventListener('touchcancel', this.onTouchEnd);
    document.body.removeChild(this.container);
  }
}
