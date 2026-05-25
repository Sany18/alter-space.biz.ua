import { useEffect, useState } from 'react';
import { LocalStorageService } from '../localstorage/localstorage.service';

const _savedDebugSettings = LocalStorageService.get('debug-settings') || {};
const _savedGraphicsSettings = LocalStorageService.get('graphics-settings') || {};
const _savedPlayerSettings = LocalStorageService.get('player-settings') || {};

function _getOrCreatePlayerName(): string {
  if (_savedPlayerSettings.playerName) return _savedPlayerSettings.playerName;
  const name = 'Player' + Math.floor(1000 + Math.random() * 9000);
  LocalStorageService.set('player-settings', { ..._savedPlayerSettings, playerName: name });
  return name;
}

export class GlobalStateService {
  // Initial state
  static state: any = {
    cannonDebuggerEnabled: _savedDebugSettings.cannonDebuggerEnabled ?? false,
    lightDebuggerEnabled: _savedDebugSettings.lightDebuggerEnabled ?? false,
    daytime: _savedDebugSettings.daytime ?? true,
    thirdPerson: _savedDebugSettings.thirdPerson ?? false,
    shadowQuality: _savedGraphicsSettings.shadowQuality ?? 'high',
    playerName: _getOrCreatePlayerName(),
    menuOpen: true,
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

    this.stateChanged.dispatchEvent(new CustomEvent('stateChanged', { detail: this.state }));

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
