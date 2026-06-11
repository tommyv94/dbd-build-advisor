import { EntityMark } from './EntityMark';
import { AmbientMuteButton } from './AmbientMuteButton';
import { isDesktopApp } from '../lib/api-base';

function control(action: 'minimize' | 'maximize' | 'close') {
  window.electronAPI?.windowControls?.[action]();
}

interface TitleBarProps {
  subtle?: boolean;
  ambientMuted?: boolean;
  onToggleAmbient?: () => void;
}

export function TitleBar({ subtle = false, ambientMuted, onToggleAmbient }: TitleBarProps) {
  if (!isDesktopApp() || !window.electronAPI?.windowControls) return null;

  return (
    <header className={`window-titlebar ${subtle ? 'window-titlebar-subtle' : ''}`}>
      <div className="window-titlebar-drag">
        <EntityMark size="sm" />
        <span className="window-titlebar-title">Dead by Daylight · Build Advisor</span>
      </div>
      {onToggleAmbient != null && ambientMuted != null && (
        <div className="window-titlebar-actions">
          <AmbientMuteButton
            muted={ambientMuted}
            onToggle={onToggleAmbient}
            className="window-titlebar-mute"
          />
        </div>
      )}
      <div className="window-titlebar-controls">
        <button type="button" className="window-ctrl" onClick={() => control('minimize')} aria-label="Minimize">
          <svg viewBox="0 0 10 1" aria-hidden><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button type="button" className="window-ctrl" onClick={() => control('maximize')} aria-label="Maximize">
          <svg viewBox="0 0 10 10" aria-hidden><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" /></svg>
        </button>
        <button
          type="button"
          className="window-ctrl window-ctrl-close"
          onClick={() => control('close')}
          aria-label="Close"
        >
          <svg viewBox="0 0 10 10" aria-hidden>
            <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
