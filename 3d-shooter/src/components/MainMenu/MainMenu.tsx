import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

import { PointerLockService } from '../../services/pointer-lock/pointer-lock.service';
import { GlobalStateService } from '../../services/global-state/global-state.service';
import { LocalStorageService } from '../../services/localstorage/localstorage.service';

import './MainMenu.scss';

type Page = 'main' | 'settings';

const SHADOW_QUALITY_OPTIONS = ['low', 'mid', 'high', 'super'] as const;
type ShadowQuality = typeof SHADOW_QUALITY_OPTIONS[number];

const SHADOW_QUALITY_LABELS: Record<ShadowQuality, string> = {
  low: 'Low',
  mid: 'Medium',
  high: 'High',
  super: 'Ultra',
};

function MainMenu() {
  const [page, setPage] = React.useState<Page>('main');
  const [globalState, setGlobalState] = GlobalStateService.useGlobalState();

  const handleShadowQuality = (quality: ShadowQuality) => {
    const next = { ...globalState, shadowQuality: quality };
    setGlobalState(next);
    LocalStorageService.set('graphics-settings', { shadowQuality: quality });
  };

  const handleContinue = (e: React.MouseEvent) => {
    e.stopPropagation();
    PointerLockService.request();
  };

  if (page === 'settings') {
    return (
      <div className="main-menu">
        <div className="main-menu__panel">
          <h2 className="main-menu__title">Settings</h2>

          <div className="main-menu__field">
            <label className="main-menu__label" htmlFor="shadow-quality">
              Shadow Quality
            </label>
            <select
              id="shadow-quality"
              className="main-menu__select"
              value={globalState.shadowQuality}
              onChange={e => handleShadowQuality(e.target.value as ShadowQuality)}
            >
              {SHADOW_QUALITY_OPTIONS.map(q => (
                <option key={q} value={q}>{SHADOW_QUALITY_LABELS[q]}</option>
              ))}
            </select>
          </div>

          <button className="main-menu__btn" onClick={() => setPage('main')}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu">
      <div className="main-menu__panel">
        <h1 className="main-menu__title">3D Shooter</h1>
        <button className="main-menu__btn main-menu__btn--primary" onClick={handleContinue}>
          Continue
        </button>
        <button className="main-menu__btn" onClick={() => setPage('settings')}>
          Settings
        </button>
      </div>
    </div>
  );
}

let _root: ReactDOM.Root | null = null;

export function mountMainMenu() {
  const blockerEl = document.getElementById('blocker')!;
  _root = ReactDOM.createRoot(blockerEl);
  _root.render(<MainMenu />);
}

export function unmountMainMenu() {
  _root?.unmount();
  _root = null;
}
