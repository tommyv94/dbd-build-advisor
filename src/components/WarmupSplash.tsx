import { EntityMark } from './EntityMark';
import { useAppVersion } from '../hooks/useAppVersion';

/** In-window warmup — visible while the main window loads behind the Electron splash. */
export function WarmupSplash({ status = 'Entering the Fog…' }: { status?: string }) {
  const appVersion = useAppVersion();
  return (
    <div className="warmup-splash warmup-splash-window">
      <div className="warmup-splash-fog" aria-hidden />
      <div className="warmup-splash-content">
        <EntityMark size="lg" />
        <p className="warmup-splash-dbd">Dead by Daylight</p>
        <h1 className="warmup-splash-title">Build Advisor</h1>
        <p className="warmup-splash-version">v{appVersion}</p>
        <p className="warmup-splash-status">{status}</p>
        <div className="warmup-splash-bar" aria-hidden>
          <div className="warmup-splash-bar-fill" />
        </div>
      </div>
    </div>
  );
}
