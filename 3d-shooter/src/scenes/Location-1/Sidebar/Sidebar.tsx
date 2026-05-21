import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import { GlobalStateService } from '../../../services/global-state/global-state.service';

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
    setGlobalState({ ...globalState, ...object });
  };

  const lastExitRef = React.useRef(0);

  const onKeydown = (e: KeyboardEvent) => {
    if (e.code !== 'Backquote' || e.repeat) return;
    setOpen(open => {
      if (!open) {
        document.exitPointerLock();
        lastExitRef.current = Date.now();
      } else {
        const elapsed = Date.now() - lastExitRef.current;
        const delay = elapsed < 1250 ? 1250 - elapsed : 0;
        setTimeout(() => document.body.requestPointerLock(), delay);
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
    </div>
  );
}
