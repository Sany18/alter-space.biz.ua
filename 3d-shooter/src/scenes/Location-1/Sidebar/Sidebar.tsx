import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import { GlobalStateService } from '../../../services/global-state/global-state.service';
import { LocalStorageService } from '../../../services/localstorage/localstorage.service';
import { PointerLockService } from '../../../services/pointer-lock/pointer-lock.service';
import { WsService } from '../../../services/ws/ws.service';

import './Sidebar.scss';

const sideMenuEl = document.createElement('div');
sideMenuEl.id = 'side-menu';
document.body.appendChild(sideMenuEl);

const root = ReactDOM.createRoot(sideMenuEl);
root.render(<Sidebar />);

function Sidebar() {
  const [open, setOpen] = React.useState(false);
  const [globalState, setGlobalState] = GlobalStateService.useGlobalState();

  const inputHandler = (object: any) => {
    const next = { ...globalState, ...object };
    setGlobalState(next);
    LocalStorageService.set('debug-settings', {
      cannonDebuggerEnabled: next.cannonDebuggerEnabled,
      lightDebuggerEnabled: next.lightDebuggerEnabled,
      daytime: next.daytime,
      thirdPerson: next.thirdPerson,
    });
  };

  const onKeydown = (e: KeyboardEvent) => {
    if (e.code !== 'Backquote' || e.repeat) return;
    setOpen(open => {
      if (!open) {
        PointerLockService.exit();
      } else {
        PointerLockService.request();
      }
      return !open;
    });
  };

  React.useEffect(() => {
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);

  return (
    <div className={`side-menu-content ${open ? 'open' : ''}`}>
      {/* Reset player position */}
      <button
        className="reset-player-position"
        onClick={() => globalState.player.resetPosition()}>
        Reset Player Position
      </button>

      {/* GlobalStateService.state.cannonDebuggerEnabled checkbox */}
      <label htmlFor="cannon-debugger-enabled">
        <input
          id="cannon-debugger-enabled"
          type="checkbox"
          checked={globalState.cannonDebuggerEnabled}
          onChange={e => inputHandler({ cannonDebuggerEnabled: e.target.checked })} />
        Cannon Debugger Enabled
      </label>

      {/* GlobalStateService.state.lightDebuggerEnabled checkbox */}
      <label htmlFor="light-debugger-enabled">
        <input
          id="light-debugger-enabled"
          type="checkbox"
          checked={globalState.lightDebuggerEnabled}
          onChange={e => inputHandler({ lightDebuggerEnabled: e.target.checked })} />
        Light Debugger Enabled
      </label>

      {/* Skybox toggle */}
      <label htmlFor="daytime">
        <input
          id="daytime"
          type="checkbox"
          checked={globalState.daytime}
          onChange={e => inputHandler({ daytime: e.target.checked })} />
        Daytime
      </label>

      {/* Third person toggle */}
      <label htmlFor="third-person">
        <input
          id="third-person"
          type="checkbox"
          checked={globalState.thirdPerson ?? true}
          onChange={e => inputHandler({ thirdPerson: e.target.checked })} />
        Third Person
      </label>

      {/* Physics server role */}
      <label htmlFor="physics-server">
        <input
          id="physics-server"
          type="checkbox"
          checked={globalState.isPhysicsServer ?? false}
          onChange={e => { if (e.target.checked) WsService.send({ type: 'claim_server' }); }} />
        Physics Server
      </label>
    </div>
  );
}
