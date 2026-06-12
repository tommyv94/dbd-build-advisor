import { EntityMark } from './EntityMark';
import { FogAtmosphere } from './FogAtmosphere';

interface UpdateInstallOverlayProps {
  version?: string;
}

export function UpdateInstallOverlay({ version }: UpdateInstallOverlayProps) {
  return (
    <div className="install-overlay" role="alert" aria-live="assertive">
      <FogAtmosphere />
      <div className="install-overlay-vignette" aria-hidden />
      <div className="install-overlay-card">
        <EntityMark size="md" />
        <p className="install-overlay-dbd">Dead by Daylight</p>
        <h2 className="install-overlay-title">Updating Build Advisor</h2>
        {version && <p className="install-overlay-version">v{version}</p>}
        <p className="install-overlay-status">Installing the update and restarting…</p>
        <div className="install-overlay-bar" aria-hidden>
          <div className="install-overlay-bar-fill" />
        </div>
        <p className="install-overlay-hint">The app will reopen automatically when finished.</p>
      </div>
    </div>
  );
}
