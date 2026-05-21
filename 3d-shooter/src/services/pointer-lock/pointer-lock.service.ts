class PointerLockServiceClass {
  readonly lockChanged = new EventTarget();
  private lastChangeTime = 0;

  constructor() {
    document.addEventListener('pointerlockchange', () => {
      this.lastChangeTime = Date.now();
      document.getElementById('blocker').style.display = document.pointerLockElement ? 'none' : 'flex';
      this.lockChanged.dispatchEvent(new Event('change'));
    });
  }

  exit = () => {
    document.exitPointerLock();
  }

  request = () => {
    // https://discourse.threejs.org/t/how-to-avoid-pointerlockcontrols-error/33017/3
    // > Seems to be about a 1-second time window in Chrome before pointer can be locked again.
    const elapsed = Date.now() - this.lastChangeTime;
    const delay = elapsed < 1250 ? 1250 - elapsed : 0;
    setTimeout(() => document.body.requestPointerLock(), delay);
  }

  toggle = () => {
    if (document.pointerLockElement) {
      this.exit();
    } else {
      this.request();
    }
  }
}

export const PointerLockService = new PointerLockServiceClass();
