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

  const onKeydown = (e: KeyboardEvent) => {
    if (e.code == 'Backquote') setOpen(open => !open);
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
      <div>
        <input
          id="cannon-debugger-enabled"
          type="checkbox"
          checked={globalState.cannonDebuggerEnabled}
          onChange={e => inputHandler({ cannonDebuggerEnabled: e.target.checked })} />
        <label htmlFor="cannon-debugger-enabled">Cannon Debugger Enabled</label>
      </div>

      {/* GlobalStateService.state.lightDebuggerEnabled checkbox */}
      <div>
        <input
          id="light-debugger-enabled"
          type="checkbox"
          checked={globalState.lightDebuggerEnabled}
          onChange={e => inputHandler({ lightDebuggerEnabled: e.target.checked })} />
        <label htmlFor="light-debugger-enabled">Light Debugger Enabled</label>
      </div>
    </div>
  );
}
