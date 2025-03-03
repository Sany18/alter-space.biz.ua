import { useEffect, useState } from 'react';

export class GlobalStateService {
  static state: any = {
    cannonDebuggerEnabled: false,
    lightDebuggerEnabled: false,
  };

  static loggerEnabled = false;
  static stateChanged = document.createElement('event');

  static get(key: string): any {
    const item = this.state[key];

    if (this.loggerEnabled) console.log('get', key, item);

    return this.state[key];
  }

  static set(key: string, value: any): void {
    if (this.loggerEnabled) console.log('set', key, value);

    this.stateChanged.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));

    this.state[key] = value;
  }

  static remove(key: string): void {
    if (this.loggerEnabled) console.log('remove', key);

    delete this.state[key];
  }

  // React hook
  static useGlobalState(): any {
    const [value, setValue] = useState(this.state);

    useEffect(() => {
      this.state = value;
      this.stateChanged.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));
    }, [value]);

    return [value, setValue];
  }
}
