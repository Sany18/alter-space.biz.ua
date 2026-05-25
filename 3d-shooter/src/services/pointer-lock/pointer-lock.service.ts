class PointerLockServiceClass {
  lockChanged = new EventTarget();

  private lastChangeTime = 0;

  constructor() {
    document.addEventListener('pointerlockchange', () => {
      this.lastChangeTime = Date.now();
      this.lockChanged.dispatchEvent(new CustomEvent('change', { detail: this.locked() }));
    });
  }

  exit = () => {
    document.exitPointerLock();
  }

  request = () => new Promise<void>((resolve, reject) => {
    // https://discourse.threejs.org/t/how-to-avoid-pointerlockcontrols-error/33017/3
    // > 1250ms time window in Chrome before pointer can be locked again.
    const elapsed = Date.now() - this.lastChangeTime;
    const delay = elapsed < 1250 ? 1250 - elapsed : 0;
    setTimeout(() => {
      document.body.requestPointerLock();
      resolve();
    }, delay);
  });

  locked = () => !!document.pointerLockElement;
}

export const PointerLockService = new PointerLockServiceClass();
