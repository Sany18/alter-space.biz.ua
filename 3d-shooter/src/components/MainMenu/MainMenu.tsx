import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import { PointerLockService } from '../../services/pointer-lock/pointer-lock.service';
import { GlobalStateService } from '../../services/global-state/global-state.service';
import { LocalStorageService } from '../../services/localstorage/localstorage.service';
import { MobileControls } from '../MobileControls/MobileControls';

import './MainMenu.scss';

type Page = 'main' | 'settings';

const SHADOW_QUALITY_OPTIONS = ['none', 'low', 'mid', 'high', 'super'] as const;
type ShadowQuality = typeof SHADOW_QUALITY_OPTIONS[number];

function MainMenu() {
  const [page, setPage] = React.useState<Page>('main');
  const [globalState, setGlobalState] = GlobalStateService.useGlobalState();
  const [nicknameInput, setNicknameInput] = React.useState<string>(globalState.playerName ?? '');

  React.useEffect(() => {
    if (MobileControls.isTouchDevice()) return;

    const handleLockChange = (e: Event) => {
      const locked = (e as CustomEvent<boolean>).detail;
      setGlobalState(prev => ({ ...prev, menuOpen: !locked }));
    };

    PointerLockService.lockChanged.addEventListener('change', handleLockChange);
    return () => {
      PointerLockService.lockChanged.removeEventListener('change', handleLockChange);
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && globalState.menuOpen && !PointerLockService.locked()) {
        PointerLockService.request();
      }
    };

    document.addEventListener('keyup', handleKeyDown);
    return () => {
      document.removeEventListener('keyup', handleKeyDown);
    };
  }, [globalState.menuOpen]);

  const handleShadowQuality = (quality: ShadowQuality) => {
    const next = { ...globalState, shadowQuality: quality };
    setGlobalState(next);
    LocalStorageService.set('graphics-settings', { shadowQuality: quality });
  };

  const handleNicknameSave = () => {
    const trimmed = nicknameInput.trim() || globalState.playerName;
    setNicknameInput(trimmed);
    const next = { ...globalState, playerName: trimmed };
    setGlobalState(next);
    LocalStorageService.set('player-settings', { playerName: trimmed });
  };

  const handlePauseMenu = (e?) => {
    e?.stopPropagation();

    if (MobileControls.isTouchDevice()) {
      setGlobalState({ ...globalState, menuOpen: false });
      return;
    }

    if (PointerLockService.locked()) {
      PointerLockService.exit();
    } else {
      PointerLockService.request();
    }
  };

  if (page === 'settings') {
    return (
      <div className="main-menu">
        <div className="main-menu__panel">
          <h2 className="main-menu__title">Settings</h2>

          <div className="main-menu__field">
            <label className="main-menu__label" htmlFor="nickname">
              Nickname
            </label>

            <input
              id="nickname"
              className="main-menu__input"
              type="text"
              value={nicknameInput}
              maxLength={24}
              onChange={e => setNicknameInput(e.target.value)}
              onBlur={handleNicknameSave}
              onKeyDown={e => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}/>
          </div>

          <div className="main-menu__field">
            <label className="main-menu__label" htmlFor="shadow-quality">
              Shadow Quality
            </label>
            <select
              id="shadow-quality"
              className="main-menu__select"
              value={globalState.shadowQuality}
              onChange={e => handleShadowQuality(e.target.value as ShadowQuality)}>
              {SHADOW_QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          </div>

          <button className="main-menu__btn" onClick={() => setPage('main')}>
            ← Back
          </button>
        </div>
      </div>
    );
  }
  
  if (globalState.menuOpen) {
    return <div className="main-menu">
        <div className="main-menu__panel">
          <h1 className="main-menu__title">3D Shooter</h1>

        <button className="main-menu__btn main-menu__btn--primary" onClick={handlePauseMenu}>
          Continue
        </button>

        <button className="main-menu__btn" onClick={() => setPage('settings')}>
          Settings
        </button>
      </div>
    </div>;
  }

  return null;
}

export function mountMainMenu() {
  ReactDOM.createRoot(document.getElementById('blocker'))
    .render(<MainMenu />);
}
